using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.DTOs.PostDtos
{
    public class PostListItemDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = default!;
        public string? Content { get; set; }
        public Guid AuthorId { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
