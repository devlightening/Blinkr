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
    ModerationNotice = 7
}