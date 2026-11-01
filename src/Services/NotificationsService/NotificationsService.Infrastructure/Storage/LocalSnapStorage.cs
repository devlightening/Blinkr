using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Infrastructure.Storage;

/// <summary>Snap media on the local disk under a private root that no static-file middleware ever serves.</summary>
public sealed class LocalSnapStorage : ISnapStorage
{
    private readonly string _root;

    public LocalSnapStorage(string storageRoot, string contentRootPath)
    {
        _root = Path.GetFullPath(Path.Combine(contentRootPath, storageRoot));
    }

    private string PathFor(string key)
    {
        var full = Path.GetFullPath(Path.Combine(_root, key.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(_root, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Unsafe snap key.");
        return full;
    }

    public async Task SaveAsync(string key, byte[] content, CancellationToken ct)
    {
        var path = PathFor(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllBytesAsync(path, content, ct);
    }

    public async Task<byte[]?> ReadAsync(string key, CancellationToken ct)
    {
        var path = PathFor(key);
        return File.Exists(path) ? await File.ReadAllBytesAsync(path, ct) : null;
    }

    public Task DeleteAsync(string key, CancellationToken ct)
    {
        var path = PathFor(key);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }
}
