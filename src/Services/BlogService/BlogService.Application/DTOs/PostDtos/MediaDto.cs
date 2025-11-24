namespace BlogService.Application.DTOs.PostDtos;

public record MediaDto
{
    public string Url { get; init; } = string.Empty;
    public string MediaType { get; init; } = string.Empty;
}
