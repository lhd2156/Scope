using System.ComponentModel.DataAnnotations;

namespace Scope.Core.API.Contracts.Requests;

public sealed record NotificationPreferenceRequest(
    [Required][MaxLength(40)] string Category,
    bool InAppEnabled,
    bool PushEnabled,
    bool EmailEnabled,
    [Required][MaxLength(20)] string DigestCadence,
    int? QuietHoursStartMinutes,
    int? QuietHoursEndMinutes,
    [Required][MaxLength(80)] string TimeZoneId);

public sealed record PushSubscriptionRequest(
    [Required][MaxLength(1200)] string Endpoint,
    [Required][MaxLength(256)] string P256dh,
    [Required][MaxLength(256)] string Auth,
    [MaxLength(300)] string? UserAgent);

public sealed record NotificationActionRequest([Required][MaxLength(80)] string Action);

public sealed record ReportRequest(
    Guid? TargetUserId,
    [Required][MaxLength(60)] string TargetType,
    [Required][MaxLength(120)] string TargetId,
    [Required][MaxLength(80)] string Reason,
    [MaxLength(1000)] string? Details);
