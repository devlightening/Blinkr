using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Domain.Entities
{
    public class AuditLog
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;

        public Guid? UserId { get; set; }
        public string? UserName { get; set; }

        public string Action { get; set; } = default;
        public string Entity { get; set; } = default;
        public Guid EntityId { get; set; }


        public string? OldValues { get; set; }
        public string? NewValues { get; set; }

    }
}
