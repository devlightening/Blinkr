using BlogService.Domain.Enums;

namespace BlogService.Application.DTOs.PostDtos
{
    public class CreatePostMediaDto
    {
        public string Url { get; set; }
        public MediaType MediaType { get; set; }
    }
}
