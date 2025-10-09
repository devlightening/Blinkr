using BlogService.Domain.Common.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Domain.Events
{
    public record PostDeletedEvent(
        Guid PostId,
        DateTime OccurredOn) : IDomainEvent;
}
