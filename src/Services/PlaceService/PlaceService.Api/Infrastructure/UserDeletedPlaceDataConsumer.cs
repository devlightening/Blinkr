using MassTransit;
using Shared.Events.Events.Identity;

namespace PlaceService.Api.Infrastructure;

/// <summary>
/// Account deletion (plan-devam F3) for what PlaceService itself keeps about a person: their attribute votes (D-040)
/// and their place in open questions (D-039). Their signals leave through the PostDeleted events BlogService publishes.
/// Idempotent.
/// </summary>
public sealed class UserDeletedPlaceDataConsumer : IConsumer<UserDeletedIntegrationEvent>
{
    private readonly IPlaceAttributeRepository _attributes;
    private readonly IPlaceQuestionRepository _questions;
    private readonly ILogger<UserDeletedPlaceDataConsumer> _logger;

    public UserDeletedPlaceDataConsumer(IPlaceAttributeRepository attributes, IPlaceQuestionRepository questions, ILogger<UserDeletedPlaceDataConsumer> logger)
    {
        _attributes = attributes;
        _questions = questions;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<UserDeletedIntegrationEvent> context)
    {
        var userId = context.Message.UserId;
        if (userId == Guid.Empty) return;
        await _attributes.DeleteForUserAsync(userId, context.CancellationToken);
        await _questions.RemoveAskerEverywhereAsync(userId, context.CancellationToken);
        _logger.LogInformation("Account erased in PlaceService | UserId={UserId}", userId);
    }
}
