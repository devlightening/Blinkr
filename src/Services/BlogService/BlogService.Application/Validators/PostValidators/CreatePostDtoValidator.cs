using BlogService.Application.DTOs.PostDtos;
using FluentValidation;

namespace BlogService.Application.Validators.PostValidators;

public class CreatePostDtoValidator : AbstractValidator<CreatePostDto>
{
    public CreatePostDtoValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required")
            .MaximumLength(200).WithMessage("Title cannot exceed 200 characters");

        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Content is required")
            .MinimumLength(5).WithMessage("Content must be at least 5 characters");
    }
}
