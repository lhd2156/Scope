using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace Atlas.Core.API.Contracts.Requests;

public sealed record RegisterRequest(
    [property: Required, MaxLength(100)] string Username,
    [property: Required, EmailAddress] string Email,
    [property: Required, MinLength(8)] string Password,
    [property: Required, MaxLength(200)] string DisplayName);

public sealed record LoginRequest(
    [property: Required, EmailAddress] string Email,
    [property: Required] string Password);

public sealed record RefreshRequest([property: Required] string RefreshToken);

public sealed record LogoutRequest([property: Required] string RefreshToken);

public sealed record ForgotPasswordRequest([property: Required, EmailAddress] string Email);

public sealed record ResetPasswordRequest(
    [property: Required] string Token,
    [property: Required, MinLength(8)] string Password);

public sealed record CognitoLoginRequest(
    [property: Required, EmailAddress] string Email,
    [property: MaxLength(100)] string? Username,
    [property: MaxLength(200)] string? DisplayName,
    string? Subject);

public sealed record UpdateUserRequest(
    [property: Required, MaxLength(200)] string DisplayName,
    [property: MaxLength(500)] string? Bio);

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
