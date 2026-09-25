// BLK-CONTRACTS-01 (CLAUDE.md §21 P1 "API/event schema compatibility"): compares the event contracts with the committed
// baseline docs/contracts/event-schema.json and fails on a change that would break data already written or in flight.
//
// Why it matters here:
// - Domain events live in EventStoreDB under their assembly-qualified type name, and EventStoreDbRepository skips a
//   type it cannot resolve. A renamed or moved event would silently vanish from every aggregate replay.
// - Integration events are routed by MassTransit by namespace + type name, and older messages sit in queues.
//
// Rules: a type or property may not disappear, a property type may not change (T -> T? widening is allowed), and a
// new constructor parameter of a domain event must be optional (a default value or nullable), so events written before
// it existed still deserialize. Additions must also be recorded in the baseline, so every change is a visible diff.
//
//   dotnet run --project src/Tools/Blinkr.Tools.EventContracts            check (CI)
//   dotnet run --project src/Tools/Blinkr.Tools.EventContracts -- --update  record the current contracts
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using BlogService.Domain.Common.Interfaces;
using Shared.Events.Abstractions;

var update = args.Contains("--update");
var root = FindRepoRoot();
var baselinePath = Path.Combine(root, "docs", "contracts", "event-schema.json");

var current = Collect();
if (update)
{
    Directory.CreateDirectory(Path.GetDirectoryName(baselinePath)!);
    File.WriteAllText(baselinePath, ToJson(current).ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + "\n");
    Console.WriteLine($"BLK-CONTRACTS-01 baseline written: {current.Count} types");
    return 0;
}
if (!File.Exists(baselinePath))
{
    Console.WriteLine($"FAIL no baseline at {baselinePath}; run with --update");
    return 1;
}

var baseline = FromJson(JsonNode.Parse(File.ReadAllText(baselinePath))!);
var failures = new List<string>();
var pending = new List<string>();
foreach (var (name, old) in baseline)
{
    if (!current.TryGetValue(name, out var now)) { failures.Add($"type removed or renamed: {name}"); continue; }
    foreach (var (prop, oldType) in old.Properties)
    {
        if (!now.Properties.TryGetValue(prop, out var newType)) failures.Add($"{name}.{prop} removed");
        else if (newType != oldType && newType != oldType + "?") failures.Add($"{name}.{prop} changed {oldType} -> {newType}");
        else if (newType != oldType) pending.Add($"{name}.{prop} widened to {newType}");
    }
    foreach (var prop in now.Properties.Keys.Except(old.Properties.Keys))
    {
        if (now.Kind == "domain" && now.Required.Contains(prop)) failures.Add($"{name}.{prop} is new but required; old events in EventStoreDB do not have it (give it a default or make it nullable)");
        else pending.Add($"{name}.{prop} added");
    }
}
foreach (var name in current.Keys.Except(baseline.Keys)) pending.Add($"type added: {name}");

foreach (var line in failures) Console.WriteLine($"FAIL {line}");
foreach (var line in pending) Console.WriteLine($"NEW  {line}");
if (failures.Count > 0) { Console.WriteLine($"BLK-CONTRACTS-01 FAIL ({failures.Count})"); return 1; }
if (pending.Count > 0) { Console.WriteLine("BLK-CONTRACTS-01 FAIL baseline out of date: compatible changes found; run with --update and commit the diff"); return 1; }
Console.WriteLine($"BLK-CONTRACTS-01 PASS ({current.Count} types)");
return 0;

static SortedDictionary<string, Contract> Collect()
{
    var result = new SortedDictionary<string, Contract>(StringComparer.Ordinal);
    var shared = typeof(IIntegrationEvent).Assembly;
    var domain = typeof(IDomainEvent).Assembly;
    var queue = new Queue<(Type Type, string Kind)>();
    foreach (var t in shared.GetExportedTypes().Where(t => t.Namespace is { } ns && (ns.StartsWith("Shared.Events.Events") || ns.StartsWith("Shared.Events.Abstractions")) && (t.IsClass || t.IsInterface)))
        queue.Enqueue((t, "integration"));
    foreach (var t in domain.GetExportedTypes().Where(t => typeof(IDomainEvent).IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract))
        queue.Enqueue((t, "domain"));

    var nullability = new NullabilityInfoContext();
    while (queue.Count > 0)
    {
        var (type, kind) = queue.Dequeue();
        var key = $"{type.FullName}, {type.Assembly.GetName().Name}";
        if (result.ContainsKey(key)) continue;
        var contract = new Contract(kind, new SortedDictionary<string, string>(StringComparer.Ordinal), new HashSet<string>());
        result[key] = contract;

        var props = type.IsInterface
            ? type.GetProperties().Concat(type.GetInterfaces().SelectMany(i => i.GetProperties()))
            : type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
        var ctorParams = type.GetConstructors().OrderByDescending(c => c.GetParameters().Length).FirstOrDefault()?.GetParameters() ?? [];
        foreach (var p in props.Where(p => p.GetIndexParameters().Length == 0))
        {
            var info = nullability.Create(p);
            contract.Properties[p.Name] = TypeName(p.PropertyType, info);
            var param = ctorParams.FirstOrDefault(c => string.Equals(c.Name, p.Name, StringComparison.OrdinalIgnoreCase));
            var nullable = Nullable.GetUnderlyingType(p.PropertyType) is not null || info.ReadState == NullabilityState.Nullable;
            if (param is not null && !param.HasDefaultValue && !nullable) contract.Required.Add(p.Name);
            foreach (var nested in Shapes(p.PropertyType)) queue.Enqueue((nested, "shape"));
        }
    }
    return result;
}

// Our own complex types inside a contract (e.g. MentionRef, media metadata) are part of the contract too.
static IEnumerable<Type> Shapes(Type t)
{
    if (t.IsArray) { foreach (var s in Shapes(t.GetElementType()!)) yield return s; yield break; }
    if (t.IsGenericType) { foreach (var s in t.GetGenericArguments().SelectMany(Shapes)) yield return s; yield break; }
    var name = t.Assembly.GetName().Name ?? "";
    if ((name == "Shared.Events" || name == "BlogService.Domain") && (t.IsClass || t.IsInterface || (t.IsValueType && !t.IsEnum))) yield return t;
}

static string TypeName(Type t, NullabilityInfo? info)
{
    if (Nullable.GetUnderlyingType(t) is { } inner) return TypeName(inner, null) + "?";
    string name;
    if (t.IsArray) name = TypeName(t.GetElementType()!, info?.ElementType) + "[]";
    else if (t.IsGenericType)
    {
        var args = t.GetGenericArguments();
        var parts = args.Select((a, i) => TypeName(a, info is not null && i < info.GenericTypeArguments.Length ? info.GenericTypeArguments[i] : null));
        name = $"{t.GetGenericTypeDefinition().FullName![..t.GetGenericTypeDefinition().FullName!.IndexOf('`')]}<{string.Join(",", parts)}>";
    }
    else name = t.FullName ?? t.Name;
    if (t.IsEnum) name += "(" + string.Join("|", Enum.GetNames(t)) + ")";
    return !t.IsValueType && info?.ReadState == NullabilityState.Nullable ? name + "?" : name;
}

static JsonObject ToJson(SortedDictionary<string, Contract> contracts)
{
    var types = new JsonObject();
    foreach (var (name, c) in contracts)
    {
        var props = new JsonObject();
        foreach (var (p, t) in c.Properties) props[p] = t;
        var entry = new JsonObject { ["kind"] = c.Kind, ["properties"] = props };
        if (c.Required.Count > 0) entry["required"] = new JsonArray(c.Required.Order(StringComparer.Ordinal).Select(r => (JsonNode)r!).ToArray());
        types[name] = entry;
    }
    return new JsonObject { ["check"] = "BLK-CONTRACTS-01: dotnet run --project src/Tools/Blinkr.Tools.EventContracts", ["types"] = types };
}

static SortedDictionary<string, Contract> FromJson(JsonNode node)
{
    var result = new SortedDictionary<string, Contract>(StringComparer.Ordinal);
    foreach (var (name, entry) in node["types"]!.AsObject())
    {
        var props = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var (p, t) in entry!["properties"]!.AsObject()) props[p] = t!.GetValue<string>();
        var required = entry["required"]?.AsArray().Select(r => r!.GetValue<string>()).ToHashSet() ?? [];
        result[name] = new Contract(entry["kind"]!.GetValue<string>(), props, required);
    }
    return result;
}

static string FindRepoRoot()
{
    for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        if (File.Exists(Path.Combine(dir.FullName, "Blinkr.sln"))) return dir.FullName;
    for (var dir = new DirectoryInfo(Directory.GetCurrentDirectory()); dir is not null; dir = dir.Parent)
        if (File.Exists(Path.Combine(dir.FullName, "Blinkr.sln"))) return dir.FullName;
    throw new InvalidOperationException("Blinkr.sln not found above the tool or the working directory.");
}

sealed record Contract(string Kind, SortedDictionary<string, string> Properties, HashSet<string> Required);
