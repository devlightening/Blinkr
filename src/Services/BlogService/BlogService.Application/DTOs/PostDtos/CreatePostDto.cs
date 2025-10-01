
namespace BlogService.Application.DTOs.PostDtos
{
    public class CreatePostDto
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public ICollection<CreatePostMediaDto> Media { get; set; }
    }

}
