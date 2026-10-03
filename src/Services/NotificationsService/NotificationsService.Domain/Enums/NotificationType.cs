namespace NotificationsService.Domain.Enums;

public enum NotificationType
{
    PostCreated = 1,
    PostLiked = 2,
    CommentCreated = 3,
    UserFollowed = 4,
    FollowRequested = 5,
    FollowAccepted = 6,
    /// <summary>A moderation warning or sanction (Faz 10 P10.4).</summary>
    ModerationNotice = 7,
    /// <summary>Someone liked your story (V2-3).</summary>
    StoryLiked = 8,
    /// <summary>Someone @mentioned you in a signal or comment (V2-4).</summary>
    Mentioned = 9,
    /// <summary>A place you watch reached the state you waited for (D-038, "Haber ver").</summary>
    PlaceWatch = 10
}