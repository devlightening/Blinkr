using BlogService.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.DTOs.PostDtos
{
    public class PostMediaDto
    {
        public Guid Id { get; set; }
        public string Url { get; set; } = string.Empty;
        public MediaType Type { get; set; }
    }
}
