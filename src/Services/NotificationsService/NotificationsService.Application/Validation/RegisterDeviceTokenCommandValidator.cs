using FluentValidation;
using NotificationsService.Application.Commands;

namespace NotificationsService.Application.Validation;

public class RegisterDeviceTokenCommandValidator : AbstractValidator<RegisterDeviceTokenCommand>
{
    public RegisterDeviceTokenCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Token).NotEmpty().MinimumLength(16);
        RuleFor(x => x.Platform).NotEmpty();
    }
}