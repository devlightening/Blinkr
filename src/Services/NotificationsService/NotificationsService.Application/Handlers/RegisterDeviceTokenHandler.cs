using MediatR;
using NotificationsService.Application.Commands;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Application.Handlers;

public class RegisterDeviceTokenHandler : IRequestHandler<RegisterDeviceTokenCommand,Unit>
{
    private readonly IDeviceTokenRepository _repo;
    public RegisterDeviceTokenHandler(IDeviceTokenRepository repo) => _repo = repo;

    public async Task<Unit> Handle(RegisterDeviceTokenCommand req, CancellationToken ct)
    {
        await _repo.UpsertAsync(new DeviceToken {
            UserId = req.UserId,
            Token = req.Token,
            Platform = req.Platform
        }, ct);
        return Unit.Value;
    }
}