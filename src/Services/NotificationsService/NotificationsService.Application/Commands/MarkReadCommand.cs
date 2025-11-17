using MediatR;

namespace NotificationsService.Application.Commands;

public record MarkReadCommand(Guid UserId, IReadOnlyList<string> NotificationIds) : IRequest<Unit>;