namespace BlogService.Application.DTOs.PostDtos
{
    public class PostResponseDto
    {
        public Guid Id { get; set; }
        public string? Title { get; set; }
        public string? Content { get; set; }
        public Guid AuthorId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<PostMediaDto> Media { get; set; } = new();
    }
}
