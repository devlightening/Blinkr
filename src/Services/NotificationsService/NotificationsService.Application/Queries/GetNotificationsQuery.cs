using MediatR;
using NotificationsService.Application.DTOs;

namespace NotificationsService.Application.Queries;

public record GetNotificationsQuery(Guid UserId, int Limit = 20, string? Cursor = null)
    : IRequest<(IReadOnlyList<NotificationDto> Items, string? NextCursor)>;