using MassTransit;
using NotificationsService.Domain.Interfaces;
using Shared.Events.Events.Blog;

namespace NotificationsService.Infrastructure.Messaging;

/// <summary>
/// V2-5 (D-028): tells the people looking at a signal's comments ("post:{id}" room, joined through the hub after a
/// visibility check) that its comments or reactions changed. Ids only; the apps refetch through REST, which applies
/// anonymity and every other rule. Its own queue, so a slow notification consumer never delays it.
/// </summary>
public sealed class PostRealtimeConsumer :
    IConsumer<PostCommentAddedIntegrationEvent>,
    IConsumer<PostCommentRemovedIntegrationEvent>,
    IConsumer<PostCommentLikedIntegrationEvent>,
    IConsumer<PostCommentUnlikedIntegrationEvent>,
    IConsumer<PostLikedIntegrationEvent>,
    IConsumer<PostUnlikedIntegrationEvent>
{
    private readonly IRealtimePublisher _realtime;

    public PostRealtimeConsumer(IRealtimePublisher realtime) => _realtime = realtime;

    private Task Room(Guid postId, string evt, object payload) =>
        _realtime.ToGroupAsync(RealtimeEvents.PostGroup(postId), evt, payload);

    public Task Consume(ConsumeContext<PostCommentAddedIntegrationEvent> context) =>
        Room(context.Message.PostId, RealtimeEvents.CommentAdded, new { postId = context.Message.PostId, commentId = context.Message.CommentId });

    public Task Consume(ConsumeContext<PostCommentRemovedIntegrationEvent> context) =>
        Room(context.Message.PostId, RealtimeEvents.CommentDeleted, new { postId = context.Message.PostId, commentId = context.Message.CommentId });

    public Task Consume(ConsumeContext<PostCommentLikedIntegrationEvent> context) =>
        Room(context.Message.PostId, RealtimeEvents.CommentChanged, new { postId = context.Message.PostId, commentId = context.Message.CommentId });

    public Task Consume(ConsumeContext<PostCommentUnlikedIntegrationEvent> context) =>
        Room(context.Message.PostId, RealtimeEvents.CommentChanged, new { postId = context.Message.PostId, commentId = context.Message.CommentId });

    public Task Consume(ConsumeContext<PostLikedIntegrationEvent> context) =>
        Room(context.Message.PostId, RealtimeEvents.ReactionChanged, new { postId = context.Message.PostId });

    public Task Consume(ConsumeContext<PostUnlikedIntegrationEvent> context) =>
        Room(context.Message.PostId, RealtimeEvents.ReactionChanged, new { postId = context.Message.PostId });
}
