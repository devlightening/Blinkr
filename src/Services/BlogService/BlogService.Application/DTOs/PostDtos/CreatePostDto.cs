using System.Text.Json.Serialization;

namespace BlogService.Application.DTOs.PostDtos
{
    public class CreatePostDto
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public ICollection<CreatePostMediaDto> Media { get; set; } = new List<CreatePostMediaDto>();
        
        // Location fields for geospatial support
        [JsonPropertyName("latitude")]
        public double? Latitude { get; set; }
        
        [JsonPropertyName("longitude")]
        public double? Longitude { get; set; }
        
        [JsonPropertyName("accuracyMeters")]
        public double? AccuracyMeters { get; set; }
        
        [JsonPropertyName("locationName")]
        public string? LocationName { get; set; }

        public Guid? PlaceId { get; set; }
        public string SignalType { get; set; } = "GeneralObservation";
        public string? SignalValue { get; set; }
        public string AudienceType { get; set; } = "Public";
        public string IdentityDisclosure { get; set; } = "LimitedProfile";
        public string LocationPrecision { get; set; } = "ApproximateArea";
        public DateTime? ExpiresAt { get; set; }
    }

}
