using MediatR;

namespace NotificationsService.Application.Queries;

public record GetUnreadCountQuery(Guid UserId) : IRequest<long>;