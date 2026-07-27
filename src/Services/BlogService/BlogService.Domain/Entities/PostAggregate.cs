using BlogService.Domain.Common.Root;
using BlogService.Domain.Enums;
using BlogService.Domain.Events;
using System;
using System.Collections.Generic;
using System.Linq;

namespace BlogService.Domain.Entities
{
    public class PostAggregate : AggregateRoot
    {
        public Guid AuthorId { get; private set; }
        public string Title { get; private set; }
        public string Content { get; private set; }
        public bool IsDeleted { get; private set; }
        
        // Location properties for geospatial support
        public double? Latitude { get; private set; }
        public double? Longitude { get; private set; }
        public double? AccuracyMeters { get; private set; }
        public string? LocationName { get; private set; }
        public Guid? PlaceId { get; private set; }
        public string SignalType { get; private set; } = "GeneralObservation";
        public string? SignalValue { get; private set; }
        public string AudienceType { get; private set; } = "Public";
        public string IdentityDisclosure { get; private set; } = "LimitedProfile";
        public string LocationPrecision { get; private set; } = "ApproximateArea";
        public string SourceType { get; private set; } = "Community";
        public DateTime? ExpiresAt { get; private set; }
        
        public ICollection<PostMedia> Media { get; private set; } = new List<PostMedia>();
        public ICollection<PostComment> Comments { get; private set; } = new List<PostComment>();
        public ICollection<PostLike> Likes { get; private set; } = new List<PostLike>();

        public PostAggregate() { }

        // --- İŞ METOTLARI (BUSINESS METHODS) ---

        public static PostAggregate Create(
            Guid postId, 
            Guid authorId, 
            string title, 
            string content,
            double? latitude = null,
            double? longitude = null,
            double? accuracyMeters = null,
            string? locationName = null,
            string? authorName = null,
            string? authorGender = null,
            Guid? placeId = null,
            string signalType = "GeneralObservation",
            string? signalValue = null,
            string audienceType = "Public",
            string identityDisclosure = "LimitedProfile",
            string locationPrecision = "ApproximateArea",
            string sourceType = "Community",
            DateTime? expiresAt = null)
        {
            var post = new PostAggregate();
            post.ApplyNewEvent(new PostCreatedEvent(
                postId, 
                authorId, 
                title, 
                content, 
                DateTime.UtcNow,
                latitude,
                longitude,
                accuracyMeters,
                locationName,
                authorName,
                authorGender,
                placeId,
                signalType,
                signalValue,
                audienceType,
                identityDisclosure,
                locationPrecision,
                sourceType,
                expiresAt));
            return post;
        }

        public void UpdateContent(string newTitle, string newContent)
        {
            if (IsDeleted) throw new InvalidOperationException("Silinmiş bir post güncellenemez.");
            if (string.IsNullOrWhiteSpace(newTitle) || string.IsNullOrWhiteSpace(newContent))
            {
                throw new ArgumentException("Başlık ve içerik boş olamaz.");
            }
            ApplyNewEvent(new PostContentUpdatedEvent(this.Id, newTitle, newContent, DateTime.UtcNow));
        }

        public void Delete()
        {
            if (IsDeleted) throw new InvalidOperationException("Post zaten silinmiş.");
            ApplyNewEvent(new PostDeletedEvent(this.Id, DateTime.UtcNow));
        }

        public void AddMedia(string url, string mediaType)
        {
            if (IsDeleted) throw new InvalidOperationException("Silinmiş bir posta medya eklenemez.");
            if (string.IsNullOrWhiteSpace(url)) throw new ArgumentException("Medya URL'i boş olamaz.");

            var mediaId = Guid.NewGuid();
            ApplyNewEvent(new PostMediaAddedEvent(this.Id, mediaId, url, mediaType, DateTime.UtcNow));
        }

        public void AddComment(Guid authorId, string commentText)
        {
            if (IsDeleted) throw new InvalidOperationException("Silinmiş bir posta yorum yapılamaz.");
            if (string.IsNullOrWhiteSpace(commentText)) throw new ArgumentException("Yorum boş olamaz.");

            var commentId = Guid.NewGuid();
            ApplyNewEvent(new PostCommentAddedEvent(this.Id, commentId, authorId, commentText, DateTime.UtcNow));
        }

        public void AddLike(Guid userId)
        {
            if (IsDeleted) return; // Silinmiş posta işlem yapma
            if (Likes.Any(like => like.UserId == userId)) return;

            ApplyNewEvent(new PostLikedEvent(this.Id, userId, DateTime.UtcNow));
        }

        public void UnlikePost(Guid userId)
        {
            var existingLike = Likes.FirstOrDefault(like => like.UserId == userId);
            if (existingLike != null)
            {
                ApplyNewEvent(new PostUnlikedEvent(Id, userId, DateTime.UtcNow));
            }
        }

        public void AddLocation(double latitude, double longitude, string? locationName)
        {
            ApplyNewEvent(new PostLocationAddedEvent(Id, latitude, longitude, locationName, DateTime.UtcNow));
        }

        public void UpdateLocation(double latitude, double longitude, string? locationName)
        {
            ApplyNewEvent(new PostLocationUpdatedEvent(Id, latitude, longitude, locationName, DateTime.UtcNow));
        }

        public void RemoveLocation()
        {
            ApplyNewEvent(new PostLocationRemovedEvent(Id, DateTime.UtcNow));
        }

        // --- OLAY UYGULAMA METOTLARI (APPLY METHODS) ---

        private void Apply(PostCreatedEvent e)
        {
            Id = e.PostId;
            AuthorId = e.AuthorId;
            Title = e.Title;
            Content = e.Content;
            IsDeleted = false;
            
            // Set location fields from event
            Latitude = e.Latitude;
            Longitude = e.Longitude;
            AccuracyMeters = e.AccuracyMeters;
            LocationName = e.LocationName;
            PlaceId = e.PlaceId;
            SignalType = e.SignalType;
            SignalValue = e.SignalValue;
            AudienceType = e.AudienceType;
            IdentityDisclosure = e.IdentityDisclosure;
            LocationPrecision = e.LocationPrecision;
            SourceType = e.SourceType;
            ExpiresAt = e.ExpiresAt;
        }

        private void Apply(PostContentUpdatedEvent e)
        {
            Title = e.NewTitle;
            Content = e.NewContent;
        }

        private void Apply(PostDeletedEvent e)
        {
            IsDeleted = true;
        }

        private void Apply(PostMediaAddedEvent e)
        {
            Enum.TryParse<MediaType>(e.MediaType, true, out var mediaTypeEnum);
            Media.Add(new PostMedia
            {
                Id = e.MediaId,
                PostId = e.PostId,
                Url = e.Url,
                Type = mediaTypeEnum 
            });
        }

        private void Apply(PostCommentAddedEvent e)
        {
            Comments.Add(new PostComment { Id = e.CommentId, PostId = e.PostId, AuthorId = e.AuthorId, CommentText = e.CommentText });
        }

        private void Apply(PostLikedEvent e)
        {
            Likes.Add(new PostLike { PostId = e.PostId, UserId = e.UserId });
        }

        private void Apply(PostUnlikedEvent e)
        {
            var likeToRemove = Likes.FirstOrDefault(like => like.UserId == e.UserId);
            if (likeToRemove != null)
            {
                Likes.Remove(likeToRemove);
            }
        }

        // --- LOCATION APPLY METHODS ---

        private void Apply(PostLocationAddedEvent e)
        {
            // Location is handled by read model projections
            // No state change needed in aggregate
        }

        private void Apply(PostLocationUpdatedEvent e)
        {
            // Location is handled by read model projections
            // No state change needed in aggregate
        }

        private void Apply(PostLocationRemovedEvent e)
        {
            // Location is handled by read model projections
            // No state change needed in aggregate
        }
    }
}
