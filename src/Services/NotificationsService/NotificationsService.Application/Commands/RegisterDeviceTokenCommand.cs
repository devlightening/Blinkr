using MediatR;

namespace NotificationsService.Application.Commands;

public record RegisterDeviceTokenCommand(Guid UserId, string Token, string Platform) : IRequest<Unit>;