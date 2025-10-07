using MediatR;

namespace BlogService.Domain.Common.Interfaces
{
    public interface IDomainEvent : INotification
    {
        DateTime OccurredOn { get; }
    }
}
