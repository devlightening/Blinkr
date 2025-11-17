using MediatR;
using NotificationsService.Application.Mapping;
using NotificationsService.Application.Queries;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Application.Handlers;

public class GetNotificationsHandler : IRequestHandler<GetNotificationsQuery, (IReadOnlyList<NotificationsService.Application.DTOs.NotificationDto>, string?)>
{
    private readonly INotificationRepository _repo;
    public GetNotificationsHandler(INotificationRepository repo) => _repo = repo;

    public async Task<(IReadOnlyList<NotificationsService.Application.DTOs.NotificationDto>, string?)> Handle(
        GetNotificationsQuery q, CancellationToken ct)
    {
        var (items, next) = await _repo.ListAsync(q.UserId, q.Limit, q.Cursor, ct);
        return (items.Select(i => i.ToDto()).ToList(), next);
    }
}