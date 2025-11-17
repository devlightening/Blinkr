using FluentValidation;
using NotificationsService.Application.Commands;

namespace NotificationsService.Application.Validation;

public class MarkReadCommandValidator : AbstractValidator<MarkReadCommand>
{
    public MarkReadCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.NotificationIds)
            .NotEmpty()
            .Must(list => list.All(id => !string.IsNullOrWhiteSpace(id)));
    }
}