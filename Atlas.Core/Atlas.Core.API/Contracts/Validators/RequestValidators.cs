using Atlas.Core.API.Contracts.Requests;
using Atlas.Core.Domain.Constants;
using FluentValidation;

namespace Atlas.Core.API.Contracts.Validators;

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty()
            .MaximumLength(CoreLimits.UsernameMaxLength);

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(CoreLimits.EmailMaxLength);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(CoreLimits.PasswordMinLength)
            .MaximumLength(CoreLimits.PasswordMaxLength);

        RuleFor(x => x.DisplayName)
            .NotEmpty()
            .MaximumLength(CoreLimits.DisplayNameMaxLength);
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(CoreLimits.EmailMaxLength);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MaximumLength(CoreLimits.PasswordMaxLength);
    }
}

public sealed class RefreshRequestValidator : AbstractValidator<RefreshRequest>
{
    public RefreshRequestValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty()
            .MaximumLength(CoreLimits.TokenMaxLength);
    }
}

public sealed class LogoutRequestValidator : AbstractValidator<LogoutRequest>
{
    public LogoutRequestValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty()
            .MaximumLength(CoreLimits.TokenMaxLength);
    }
}

public sealed class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(CoreLimits.EmailMaxLength);
    }
}

public sealed class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty()
            .MaximumLength(CoreLimits.TokenMaxLength);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(CoreLimits.PasswordMinLength)
            .MaximumLength(CoreLimits.PasswordMaxLength);
    }
}

public sealed class CognitoLoginRequestValidator : AbstractValidator<CognitoLoginRequest>
{
    public CognitoLoginRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(CoreLimits.EmailMaxLength);

        RuleFor(x => x.Username)
            .MaximumLength(CoreLimits.UsernameMaxLength)
            .When(x => !string.IsNullOrWhiteSpace(x.Username));

        RuleFor(x => x.DisplayName)
            .MaximumLength(CoreLimits.DisplayNameMaxLength)
            .When(x => !string.IsNullOrWhiteSpace(x.DisplayName));

        RuleFor(x => x.Subject)
            .MaximumLength(CoreLimits.CognitoSubjectMaxLength)
            .When(x => !string.IsNullOrWhiteSpace(x.Subject));
    }
}

public sealed class UpdateUserRequestValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserRequestValidator()
    {
        RuleFor(x => x.DisplayName)
            .NotEmpty()
            .MaximumLength(CoreLimits.DisplayNameMaxLength);

        RuleFor(x => x.Bio)
            .MaximumLength(CoreLimits.BioMaxLength)
            .When(x => !string.IsNullOrWhiteSpace(x.Bio));
    }
}

public sealed class PingLocationRequestValidator : AbstractValidator<PingLocationRequest>
{
    public PingLocationRequestValidator()
    {
        RuleFor(x => x.TripId)
            .NotEmpty();

        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90d, 90d);

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180d, 180d);
    }
}

public sealed class StopLiveSessionRequestValidator : AbstractValidator<StopLiveSessionRequest>
{
    public StopLiveSessionRequestValidator()
    {
        RuleFor(x => x.TripId)
            .NotEmpty();
    }
}

public sealed class AvatarUploadRequestValidator : AbstractValidator<AvatarUploadRequest>
{
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp"
    };

    public AvatarUploadRequestValidator()
    {
        RuleFor(x => x.File)
            .NotNull()
            .WithMessage("File is required");

        RuleFor(x => x.File)
            .Must(file => file is null || file.Length > 0)
            .WithMessage("File must not be empty");

        RuleFor(x => x.File)
            .Must(file => file is null || file.Length <= CoreLimits.AvatarUploadBytes)
            .WithMessage($"File size must be {CoreLimits.AvatarUploadBytes} bytes or less");

        RuleFor(x => x.File)
            .Must(file => file is null || AllowedContentTypes.Contains(file.ContentType))
            .WithMessage("Only JPEG, PNG, or WebP uploads are allowed");
    }
}
