using BlogService.Domain.Common.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Domain.Events
{
    public record PostUnlikedEvent(
       Guid PostId,
       Guid UserId,
       DateTime OccurredOn) : IDomainEvent;
}
