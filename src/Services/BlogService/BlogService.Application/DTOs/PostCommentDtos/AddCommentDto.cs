using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.DTOs.PostCommentDtos
{
    public record AddCommentDto(string CommentText, Guid? ParentCommentId);

}
