using MongoDB.Bson.Serialization.Attributes;

namespace BlogService.Api.ReadModels;

/// <summary>
/// MongoDB document model for Post read model
/// Must match the structure created by Worker projections
/// </summary>
public class PostDocument
{
    [BsonId]
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
    public Guid Id { get; set; }

    public Guid AuthorId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }

    public int LikeCount { get; set; }
    public List<CommentEntity> Comments { get; set; } = new();
    public List<MediaEntity> Media { get; set; } = new();

    /// <summary>
    /// Computed property for comment count
    /// </summary>
    public int CommentCount => Comments?.Count ?? 0;
}

public class CommentEntity
{
    [BsonId]
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
    public Guid Id { get; set; }
    
    public Guid AuthorId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}

public class MediaEntity
{
    [BsonId]
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
    public Guid Id { get; set; }
    
    public string Url { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
}
