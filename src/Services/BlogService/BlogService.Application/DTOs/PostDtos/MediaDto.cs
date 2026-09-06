namespace BlogService.Application.DTOs.PostDtos;

public record MediaDto
{
    public Guid? Id { get; init; }
    public string Url { get; init; } = string.Empty;
    public string MediaType { get; init; } = string.Empty;
    public string? ContentType { get; init; }
    public long? SizeBytes { get; init; }
    public int? Width { get; init; }
    public int? Height { get; init; }
    public double? DurationSeconds { get; init; }
    public string? ThumbnailUrl { get; init; }
}
