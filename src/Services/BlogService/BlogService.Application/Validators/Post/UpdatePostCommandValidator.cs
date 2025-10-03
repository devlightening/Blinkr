using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Validators.Post
{
    public class UpdatePostCommandValidator : AbstractValidator<UpdatePostCommand>
    {
        public UpdatePostCommandValidator()
        {
            RuleFor(x => x.PostId).NotEmpty();
            RuleFor(x => x.Title).NotEmpty().MaximumLength(150);
            RuleFor(x => x.Content).NotEmpty().MaximumLength(4000);
        }
    }
}
