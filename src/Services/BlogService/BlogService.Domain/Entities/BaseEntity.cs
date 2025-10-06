using BlogService.Domain.Common.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Domain.Entities
{
    public abstract class BaseEntity : IAuditable
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public DateTime CreatedAt { get; set; }
        public Guid? CreatedBy { get; set; } 
        public DateTime? LastModifiedAt { get; set; }
        public Guid? LastModifiedBy { get; set; }
    }
}
