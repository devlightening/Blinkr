using System.Globalization;

namespace PlaceService.Api.Application;

public interface IOpeningHoursCalculator
{
    OpeningHoursDto? Calculate(string? raw, DateTime nowUtc);
}

/// <summary>
/// Parses the deterministic weekly subset used by most OSM POIs: 24/7, plain daily ranges and weekday rules such as
/// "Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off". Public-holiday, seasonal and free-text rules fail closed to unknown;
/// Blinkr would rather show no estimate than a wrong one.
/// </summary>
public sealed class OpeningHoursCalculator : IOpeningHoursCalculator
{
    public const string PlaceTimeZoneId = "Europe/Istanbul";
    private static readonly string[] DayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    private static readonly TimeZoneInfo PlaceTimeZone = ResolveTimeZone();

    public OpeningHoursDto? Calculate(string? raw, DateTime nowUtc)
    {
        raw = raw?.Trim();
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var utc = nowUtc.Kind == DateTimeKind.Utc ? nowUtc : DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc);
        if (string.Equals(raw, "24/7", StringComparison.OrdinalIgnoreCase))
            return new OpeningHoursDto(raw, true, null, null, PlaceTimeZoneId);

        if (!TryParse(raw, out var schedule))
            return new OpeningHoursDto(raw, null, null, null, PlaceTimeZoneId);

        var localNow = TimeZoneInfo.ConvertTimeFromUtc(utc, PlaceTimeZone);
        var intervals = new List<(DateTime StartUtc, DateTime EndUtc)>();
        for (var offset = -1; offset <= 8; offset++)
        {
            var date = localNow.Date.AddDays(offset);
            foreach (var range in schedule[(int)date.DayOfWeek])
            {
                var startLocal = DateTime.SpecifyKind(date.AddMinutes(range.StartMinute), DateTimeKind.Unspecified);
                var endLocal = DateTime.SpecifyKind(date.AddMinutes(range.EndMinute), DateTimeKind.Unspecified);
                intervals.Add((TimeZoneInfo.ConvertTimeToUtc(startLocal, PlaceTimeZone), TimeZoneInfo.ConvertTimeToUtc(endLocal, PlaceTimeZone)));
            }
        }

        var current = intervals.Where(i => i.StartUtc <= utc && utc < i.EndUtc).OrderBy(i => i.EndUtc).FirstOrDefault();
        if (current != default)
            return new OpeningHoursDto(raw, true, null, current.EndUtc, PlaceTimeZoneId);

        var next = intervals.Where(i => i.StartUtc > utc).OrderBy(i => i.StartUtc).FirstOrDefault();
        var nextOpen = next == default ? (DateTime?)null : next.StartUtc;
        var nextOpenLocalTime = nextOpen.HasValue
            ? TimeZoneInfo.ConvertTimeFromUtc(nextOpen.Value, PlaceTimeZone).ToString("HH:mm", CultureInfo.InvariantCulture)
            : null;
        return new OpeningHoursDto(raw, false, nextOpen, null, PlaceTimeZoneId, nextOpenLocalTime);
    }

    private static bool TryParse(string raw, out List<Range>[] schedule)
    {
        schedule = Enumerable.Range(0, 7).Select(_ => new List<Range>()).ToArray();
        var rules = raw.Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (rules.Length == 0) return false;

        foreach (var rule in rules)
        {
            var firstDigit = rule.IndexOfAny(['0', '1', '2']);
            string dayPart;
            string hoursPart;
            if (firstDigit == 0)
            {
                dayPart = "Mo-Su";
                hoursPart = rule;
            }
            else
            {
                var split = rule.IndexOf(' ');
                if (split <= 0) return false;
                dayPart = rule[..split].Trim();
                hoursPart = rule[(split + 1)..].Trim();
            }

            if (!TryDays(dayPart, out var days)) return false;
            if (hoursPart.Equals("off", StringComparison.OrdinalIgnoreCase) || hoursPart.Equals("closed", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var day in days) schedule[day].Clear();
                continue;
            }

            var ranges = new List<Range>();
            foreach (var text in hoursPart.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            {
                var pair = text.Split('-', StringSplitOptions.TrimEntries);
                if (pair.Length != 2 || !TryMinute(pair[0], out var start) || !TryMinute(pair[1], out var end)) return false;
                if (end <= start) end += 24 * 60;
                ranges.Add(new Range(start, end));
            }
            if (ranges.Count == 0) return false;
            foreach (var day in days) schedule[day].AddRange(ranges);
        }
        return true;
    }

    private static bool TryDays(string text, out IReadOnlyList<int> days)
    {
        var result = new HashSet<int>();
        foreach (var token in text.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            var bounds = token.Split('-', StringSplitOptions.TrimEntries);
            if (bounds.Length is < 1 or > 2 || !TryDay(bounds[0], out var from)) { days = []; return false; }
            var to = from;
            if (bounds.Length == 2 && !TryDay(bounds[1], out to)) { days = []; return false; }
            for (var day = from; ; day = (day + 1) % 7)
            {
                result.Add(day);
                if (day == to) break;
            }
        }
        days = result.OrderBy(x => x).ToArray();
        return days.Count > 0;
    }

    private static bool TryDay(string text, out int day)
    {
        day = Array.FindIndex(DayNames, d => string.Equals(d, text, StringComparison.OrdinalIgnoreCase));
        return day >= 0;
    }

    private static bool TryMinute(string text, out int minute)
    {
        minute = 0;
        var pair = text.Split(':');
        if (pair.Length != 2
            || !int.TryParse(pair[0], NumberStyles.None, CultureInfo.InvariantCulture, out var hour)
            || !int.TryParse(pair[1], NumberStyles.None, CultureInfo.InvariantCulture, out var minutes)
            || hour is < 0 or > 24 || minutes is < 0 or > 59 || (hour == 24 && minutes != 0)) return false;
        minute = hour * 60 + minutes;
        return true;
    }

    private static TimeZoneInfo ResolveTimeZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(PlaceTimeZoneId); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time"); }
    }

    private sealed record Range(int StartMinute, int EndMinute);
}
