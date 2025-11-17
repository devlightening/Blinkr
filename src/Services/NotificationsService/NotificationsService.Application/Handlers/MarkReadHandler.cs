using MediatR;
using NotificationsService.Application.Commands;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Application.Handlers;

public sealed class MarkReadHandler : IRequestHandler<MarkReadCommand, Unit>
{
    private readonly INotificationRepository _repo;

    public MarkReadHandler(INotificationRepository repo) => _repo = repo;

    public async Task<Unit> Handle(MarkReadCommand req, CancellationToken ct)
    {
        await _repo.MarkReadAsync(req.NotificationIds, req.UserId, ct);
        return Unit.Value;
    }
}
