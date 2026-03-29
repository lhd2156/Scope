using System.ComponentModel.DataAnnotations;
using Atlas.Core.Domain.Constants;
using Microsoft.AspNetCore.Http;

namespace Atlas.Core.API.Contracts.Requests;

public sealed record RegisterRequest(
    [property: Required, MaxLength(CoreLimits.UsernameMaxLength)] string Username,
    [property: Required, EmailAddress, MaxLength(CoreLimits.EmailMaxLength)] string Email,
    [property: Required, MinLength(CoreLimits.PasswordMinLength), MaxLength(CoreLimits.PasswordMaxLength)] string Password,
    [property: Required, MaxLength(CoreLimits.DisplayNameMaxLength)] string DisplayName);

public sealed record LoginRequest(
    [property: Required, EmailAddress, MaxLength(CoreLimits.EmailMaxLength)] string Email,
    [property: Required, MaxLength(CoreLimits.PasswordMaxLength)] string Password);

public sealed record RefreshRequest([property: Required, MaxLength(CoreLimits.TokenMaxLength)] string RefreshToken);

public sealed record LogoutRequest([property: Required, MaxLength(CoreLimits.TokenMaxLength)] string RefreshToken);

public sealed record ForgotPasswordRequest([property: Required, EmailAddress, MaxLength(CoreLimits.EmailMaxLength)] string Email);

public sealed record ResetPasswordRequest(
    [property: Required, MaxLength(CoreLimits.TokenMaxLength)] string Token,
    [property: Required, MinLength(CoreLimits.PasswordMinLength), MaxLength(CoreLimits.PasswordMaxLength)] string Password);

public sealed record CognitoLoginRequest(
    [property: Required, EmailAddress, MaxLength(CoreLimits.EmailMaxLength)] string Email,
    [property: MaxLength(CoreLimits.UsernameMaxLength)] string? Username,
    [property: MaxLength(CoreLimits.DisplayNameMaxLength)] string? DisplayName,
    [property: MaxLength(CoreLimits.CognitoSubjectMaxLength)] string? Subject);

public sealed record UpdateUserRequest(
    [property: Required, MaxLength(CoreLimits.DisplayNameMaxLength)] string DisplayName,
    [property: MaxLength(CoreLimits.BioMaxLength)] string? Bio);

public sealed record PingLocationRequest(
    Guid TripId,
    [property: Range(-90d, 90d)] double Latitude,
    [property: Range(-180d, 180d)] double Longitude);

public sealed record StopLiveSessionRequest(Guid TripId);

public sealed class AvatarUploadRequest
{
    [Required]
    public IFormFile? File { get; init; }
}
