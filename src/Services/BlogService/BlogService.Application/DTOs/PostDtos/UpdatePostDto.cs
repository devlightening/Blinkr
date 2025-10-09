using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.DTOs.PostDtos
{
    public record UpdatePostDto(string Title, string Content);
}
