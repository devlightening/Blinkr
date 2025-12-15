using BlogService.Domain.Enums;
using System.Text.Json.Serialization;

namespace BlogService.Application.DTOs.PostDtos
{
    public class CreatePostMediaDto
    {
        public string? Url { get; set; }
        
        [JsonPropertyName("mediaType")]
        public MediaType MediaType { get; set; }
    }
}
