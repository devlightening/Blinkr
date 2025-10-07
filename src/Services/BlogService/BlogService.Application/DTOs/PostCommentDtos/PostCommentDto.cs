using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.DTOs.PostCommentDtos
{
    public class PostCommentDto() : IRequest<Guid>
    {

        public Guid PostId { get; set; }
        public string? CommentText { get; set; }
        public Guid AuthorId { get; set; }
        public Guid? ParentCommentId { get; set; }

    }

}
