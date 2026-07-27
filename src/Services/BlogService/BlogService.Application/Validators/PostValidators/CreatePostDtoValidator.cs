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

        // Location is mandatory for all posts
        RuleFor(x => x.Latitude)
            .NotNull().WithMessage("Location is required - latitude cannot be empty")
            .InclusiveBetween(-90, 90).WithMessage("Latitude must be between -90 and 90");

        RuleFor(x => x.Longitude)
            .NotNull().WithMessage("Location is required - longitude cannot be empty")
            .InclusiveBetween(-180, 180).WithMessage("Longitude must be between -180 and 180");

        RuleFor(x => x.AccuracyMeters)
            .NotNull().WithMessage("Location accuracy is required")
            .GreaterThan(0).WithMessage("Accuracy must be greater than 0 meters")
            .LessThan(5000).WithMessage("Accuracy must be less than 5000 meters");

        RuleFor(x => x.LocationName)
            .NotEmpty().WithMessage("Location name is required")
            .MaximumLength(500).WithMessage("Location name cannot exceed 500 characters");
    }
}
