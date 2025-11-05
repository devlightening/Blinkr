namespace BlogService.Application.DTOs.PostDtos
{
    /// <summary>
    /// Full post response with all details
    /// </summary>
    public class PostResponseDto
    {
        public Guid Id { get; set; }
        public string? Title { get; set; }
        public string? Content { get; set; }
        
        // Author
        public Guid AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string? AuthorAvatarUrl { get; set; }
        
        // Timestamps
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        
        // Engagement
        public int LikeCount { get; set; }
        public int CommentCount { get; set; }
        
        // Location
        public string? LocationName { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        
        // Media
        public List<PostMediaDto> Media { get; set; } = new();
    }
}
