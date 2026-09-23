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
        /// <summary>Poster frame for a video; the card draws it instead of the video file.</summary>
        public string? ThumbnailUrl { get; set; }
        /// <summary>Pixel size when known, so the card keeps the original aspect ratio (no crop, plan-devam C4).</summary>
        public int? Width { get; set; }
        public int? Height { get; set; }
    }
}
