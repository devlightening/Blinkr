
namespace BlogService.Application.DTOs.PostDtos
{
    public class CreatePostDto
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public ICollection<CreatePostMediaDto> Media { get; set; }
        
        // Location fields for geospatial support
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public double? AccuracyMeters { get; set; }
        public string? LocationName { get; set; }
    }

}
