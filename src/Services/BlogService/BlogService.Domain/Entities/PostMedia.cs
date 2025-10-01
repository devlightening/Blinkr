using BlogService.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Domain.Entities
{
    public class PostMedia
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PostId { get; set; }
        public string Url { get; set; } = string.Empty;
        public MediaType Type { get; set; }
        public Post Post { get; set; } = null!;
    }
}
