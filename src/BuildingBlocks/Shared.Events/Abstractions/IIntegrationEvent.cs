using System;

namespace Shared.Events.Abstractions
{
    public interface IIntegrationEvent
    {
        Guid Id { get; }
        DateTime OccurredOn { get; }
    }
}

