using BlogService.Application.DTOs.PostDtos;
using FluentValidation;

namespace BlogService.Application.Validators.PostValidators;

public class CreatePostDtoValidator : AbstractValidator<CreatePostDto>
{
    public CreatePostDtoValidator()
    {
        RuleFor(x => x)
            .Must(x => HasSignal(x) || HasText(x) || HasMedia(x))
            .WithMessage("Post must contain signal, text, or media");

        RuleFor(x => x.Title)
            .MaximumLength(200).WithMessage("Title cannot exceed 200 characters");

        RuleFor(x => x.Content)
            .MinimumLength(5).When(x => !string.IsNullOrWhiteSpace(x.Content))
            .WithMessage("Content must be at least 5 characters");

        RuleFor(x => x.SignalType)
            .Must(value => new[] { "GeneralObservation", "Crowd", "Queue", "Event", "Offer", "NewOpening", "TemporaryStatus" }.Contains(value))
            .WithMessage("Unsupported signal type");

        RuleFor(x => x.SignalValue)
            .NotEmpty().When(x => x.SignalType != "GeneralObservation")
            .WithMessage("A structured signal value is required");

        RuleFor(x => x.AudienceType)
            .Must(value => new[] { "Public", "Followers", "Friends", "CloseFriends", "Private" }.Contains(value))
            .WithMessage("Unsupported audience type");

        RuleFor(x => x.IdentityDisclosure)
            .Must(value => new[] { "FullProfile", "LimitedProfile", "AnonymousMap" }.Contains(value))
            .WithMessage("Unsupported identity disclosure");

        RuleFor(x => x.LocationPrecision)
            .Must(value => new[] { "PlaceCenter", "ApproximateArea", "Delayed" }.Contains(value))
            .WithMessage("Unsupported location precision");

        RuleFor(x => x.ExpiresAt)
            .GreaterThan(DateTime.UtcNow).When(x => x.ExpiresAt.HasValue)
            .WithMessage("Expiry must be in the future")
            .LessThanOrEqualTo(DateTime.UtcNow.AddDays(30)).When(x => x.ExpiresAt.HasValue)
            .WithMessage("Expiry cannot be more than 30 days away");

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

    private static bool HasSignal(CreatePostDto dto) =>
        !string.Equals(dto.SignalType, "GeneralObservation", StringComparison.Ordinal)
        && !string.IsNullOrWhiteSpace(dto.SignalValue);

    private static bool HasText(CreatePostDto dto) =>
        !string.IsNullOrWhiteSpace(dto.Title) || !string.IsNullOrWhiteSpace(dto.Content);

    private static bool HasMedia(CreatePostDto dto) =>
        dto.Media?.Any(m => m.MediaId.HasValue) == true;
}
