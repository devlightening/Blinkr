using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Validators.PostValidators
{
    public class RemovePostCommandValidator : AbstractValidator<RemovePostCommand>
    {
        public RemovePostCommandValidator()
        {
            RuleFor(x => x.Id).NotEmpty();
        }
    }
}
