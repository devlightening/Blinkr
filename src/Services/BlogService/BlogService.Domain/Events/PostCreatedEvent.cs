using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Domain.Events
{
    public record PostCreatedEvent(Post Post) : IDomainEvent;

}
