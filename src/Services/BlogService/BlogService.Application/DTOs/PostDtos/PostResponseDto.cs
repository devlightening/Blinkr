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
        /// <summary>Whether the requesting user currently has this post liked (false for an anonymous caller).</summary>
        public bool IsLikedByCurrentUser { get; set; }
        
        // Location
        public string? LocationName { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public Guid? PlaceId { get; set; }
        public string SignalType { get; set; } = "GeneralObservation";
        public string? SignalValue { get; set; }
        public string AudienceType { get; set; } = "Public";
        public string IdentityDisclosure { get; set; } = "LimitedProfile";
        public string LocationPrecision { get; set; } = "ApproximateArea";
        public string SourceType { get; set; } = "Community";
        public DateTime? ExpiresAt { get; set; }
        /// <summary>The server's publication trust (VERIFIED_LIVE shows "Konumda" on the Sinyal Kartı, plan-devam C3).</summary>
        public string? PublicationTrust { get; set; }
        public bool FromGallery { get; set; }
        /// <summary>True only for the author asking about their own signal (anonymous ones too): menu and verify rules.</summary>
        public bool IsMine { get; set; }
        /// <summary>People who looked at the Sinyal Kartı (once per person per day); only returned to the author.</summary>
        public int? ViewCount { get; set; }

        // Media
        public List<PostMediaDto> Media { get; set; } = new();
    }
}
