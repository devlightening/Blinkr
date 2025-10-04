using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Common.Models
{
    public record PagedQuery(
        int Page = 1,
        int PageSize = 20,
        string? Search = null,
        string? OrderBy = null,
        string? Sort = null );
   
}
