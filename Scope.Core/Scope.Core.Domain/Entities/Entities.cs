namespace Scope.Core.Domain.Entities;

public sealed class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }
    public string? HomeBase { get; set; }
    public string? InterestsJson { get; set; }
    public bool ShowActivityStatus { get; set; } = true;
    public string ProfileVisibility { get; set; } = "friends";
    public bool IsShowcase { get; set; }
    public string Role { get; set; } = "user";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
    public int FailedLoginAttempts { get; set; }
    public DateTimeOffset? LockoutUntil { get; set; }
    public DateTimeOffset? EmailVerifiedAt { get; set; }
    public string? EmailVerificationTokenHash { get; set; }
    public DateTimeOffset? EmailVerificationSentAt { get; set; }
    public bool MfaEnabled { get; set; }
    public string? MfaSecret { get; set; }
    public string? MfaRecoveryCodesHash { get; set; }
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}

public sealed class PasswordReset
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
    public string? RequestIpHash { get; set; }
    public User User { get; set; } = null!;
}

public sealed class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; }
    public string? RevokedReason { get; set; }
    public User User { get; set; } = null!;
}

public sealed class Friendship
{
    public Guid Id { get; set; }
    public Guid RequesterId { get; set; }
    public Guid AddresseeId { get; set; }
    public string Status { get; set; } = "pending";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string TemplateKey { get; set; } = string.Empty;
    public int TemplateVersion { get; set; } = 1;
    public string Category { get; set; } = "general";
    public string Priority { get; set; } = "normal";
    public string Title { get; set; } = string.Empty;
    public string? Body { get; set; }
    public string? ActionUrl { get; set; }
    public Guid? ActorUserId { get; set; }
    public string? ReferenceType { get; set; }
    public string? ReferenceId { get; set; }
    public string? SourceEventId { get; set; }
    public string? GroupKey { get; set; }
    public string? MetadataJson { get; set; }
    public bool IsRead { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
}

public sealed class NotificationPreference
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Category { get; set; } = "general";
    public bool InAppEnabled { get; set; } = true;
    public bool PushEnabled { get; set; } = true;
    public bool EmailEnabled { get; set; }
    public string DigestCadence { get; set; } = "daily";
    public int? QuietHoursStartMinutes { get; set; }
    public int? QuietHoursEndMinutes { get; set; }
    public string TimeZoneId { get; set; } = "UTC";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class PushSubscription
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
    public string? UserAgent { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? LastUsedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}

public sealed class NotificationOutbox
{
    public Guid Id { get; set; }
    public string SourceEventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public int Attempts { get; set; }
    public DateTimeOffset AvailableAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public string? LastError { get; set; }
}

public sealed class NotificationDelivery
{
    public Guid Id { get; set; }
    public Guid NotificationId { get; set; }
    public Guid UserId { get; set; }
    public string Channel { get; set; } = "in_app";
    public string Status { get; set; } = "pending";
    public int Attempts { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public string? ProviderMessageId { get; set; }
    public string? ErrorCode { get; set; }
    public string? LastError { get; set; }
    public Notification Notification { get; set; } = null!;
}

public sealed class UserBlock
{
    public Guid Id { get; set; }
    public Guid BlockerId { get; set; }
    public Guid BlockedId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class UserReport
{
    public Guid Id { get; set; }
    public Guid ReporterId { get; set; }
    public Guid? TargetUserId { get; set; }
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? Details { get; set; }
    public string Status { get; set; } = "open";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
}

public sealed class LiveSession
{
    public Guid Id { get; set; }
    public Guid TripId { get; set; }
    public Guid UserId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset LastPingAt { get; set; }
}

public sealed class UserPresence
{
    public Guid UserId { get; set; }
    public string Status { get; set; } = "offline";
    public string? RouteContext { get; set; }
    public bool IsIdle { get; set; }
    public DateTimeOffset LastActiveAt { get; set; }
    public DateTimeOffset? LastPlanningAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public User User { get; set; } = null!;
}
