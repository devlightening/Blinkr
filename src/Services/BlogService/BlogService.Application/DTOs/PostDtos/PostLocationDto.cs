using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.DTOs.PostDtos
{
    public record PostLocationDto(
        Guid Id,
        string Title,
        double Lat,
        double Lng,
        string? MediaUrl = null,
        string? AuthorGender = null  // "Male", "Female", "Other", null
    );

}
