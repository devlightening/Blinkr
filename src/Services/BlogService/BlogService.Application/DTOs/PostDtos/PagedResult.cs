namespace BlogService.Application.DTOs.PostDtos;

/// <summary>
/// Paged result wrapper for API responses
/// </summary>
/// <typeparam name="T">Item type</typeparam>
public record PagedResult<T>
{
    /// <summary>
    /// Items in current page
    /// </summary>
    public IEnumerable<T> Items { get; init; } = Enumerable.Empty<T>();

    /// <summary>
    /// Total count of items (for pagination)
    /// </summary>
    public long Total { get; init; }

    /// <summary>
    /// Current page number
    /// </summary>
    public int Page { get; init; }

    /// <summary>
    /// Items per page
    /// </summary>
    public int PageSize { get; init; }

    /// <summary>
    /// Total pages
    /// </summary>
    public int TotalPages => (int)Math.Ceiling((double)Total / PageSize);

    /// <summary>
    /// Has next page
    /// </summary>
    public bool HasNext => Page < TotalPages;

    /// <summary>
    /// Has previous page
    /// </summary>
    public bool HasPrevious => Page > 1;

    public PagedResult(IEnumerable<T> items, long total, int page, int pageSize)
    {
        Items = items;
        Total = total;
        Page = page;
        PageSize = pageSize;
    }
}
