using MediatR;
using NotificationsService.Application.Queries;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Application.Handlers;

public class GetUnreadCountHandler : IRequestHandler<GetUnreadCountQuery, long>
{
    private readonly INotificationRepository _repo;
    public GetUnreadCountHandler(INotificationRepository repo) => _repo = repo;

    public Task<long> Handle(GetUnreadCountQuery request, CancellationToken ct) =>
        _repo.UnreadCountAsync(request.UserId, ct);
}