using BlogService.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommands
{
    public record MediaItem(string Url, MediaType Type);
}
