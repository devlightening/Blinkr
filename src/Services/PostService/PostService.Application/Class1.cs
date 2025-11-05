namespace PostService.Application.DTOs;

/// <summary>
/// Lightweight DTO for map markers (nearby endpoint)
/// </summary>
public record PostLocationDto(
    Guid Id,
    string Title,
    double Lat,
    double Lng,
    string? MediaUrl = null
);
