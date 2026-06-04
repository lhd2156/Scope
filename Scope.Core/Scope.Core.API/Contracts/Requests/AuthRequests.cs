using System.ComponentModel.DataAnnotations;

namespace Scope.Core.API.Contracts.Requests;

public sealed record RegisterRequest(
    [Required]
    [MinLength(3)]
    [MaxLength(30)]
    [RegularExpression(@"^[A-Za-z0-9._-]+$", ErrorMessage = "Username can only contain letters, numbers, underscores, periods, or hyphens.")]
    string Username,
    [Required][EmailAddress] string Email,
    [Required][MinLength(10)] string Password,
    [Required][MinLength(2)][MaxLength(60)] string DisplayName,
    [Required] DateOnly? DateOfBirth,
    [MaxLength(32)] string? PhoneNumber = null);
public sealed record LoginRequest(
    [Required(ErrorMessage = "Email, phone number, or display name is required.")][MaxLength(200)] string Email,
    [Required] string Password,
    [MaxLength(12)] string? MfaCode = null,
    [MaxLength(200)] string? Identifier = null)
{
    public string ResolvedIdentifier => string.IsNullOrWhiteSpace(Identifier) ? Email : Identifier;
}
public sealed record RefreshRequest([Required] string RefreshToken);
public sealed record LogoutRequest([Required] string RefreshToken);
public sealed record PingLocationRequest(
    [Required] Guid TripId,
    [Range(-90, 90)] double Latitude,
    [Range(-180, 180)] double Longitude);
public sealed record UserProfileUpdateRequest(
    [MinLength(2)]
    [MaxLength(60)]
    string? DisplayName = null,
    [MaxLength(500)]
    string? Bio = null,
    [MaxLength(1000)]
    string? AvatarUrl = null,
    [MaxLength(120)]
    string? HomeBase = null,
    IReadOnlyList<string>? Interests = null,
    bool? ShowActivityStatus = null);
public sealed record PresenceHeartbeatRequest(
    [MaxLength(20)] string? Status = null,
    [MaxLength(160)] string? RouteContext = null,
    bool IsIdle = false,
    bool IsPlanning = false);
public sealed record PasswordResetRequest([Required][EmailAddress] string Email);
public sealed record PasswordResetCompleteRequest([Required] string Token, [Required][MinLength(10)] string NewPassword);
public sealed record VerifyEmailRequest([Required] string Token);
public sealed record MfaConfirmRequest([Required][MaxLength(12)] string Code);
public sealed record MfaDisableRequest([Required][MaxLength(12)] string Code);
