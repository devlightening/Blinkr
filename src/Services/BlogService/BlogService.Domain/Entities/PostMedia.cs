using BlogService.Domain.Enums;

namespace BlogService.Domain.Entities
{
    public class PostMedia
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PostId { get; set; }
        public string Url { get; set; } = string.Empty;
        public MediaType Type { get; set; }
        public Post Post { get; set; } = null!;
    }
}
