namespace Atlas.Core.Domain.Constants;

public static class CoreClaimTypes
{
    public const string Subject = "sub";
    public const string DisplayName = "name";
    public const string Roles = "roles";
}

public static class CoreConfigurationKeys
{
    public const string DatabaseConnection = "CORE_DB_CONNECTION";
    public const string JwtSecret = "CORE_JWT_SECRET";
    public const string JwtIssuer = "CORE_JWT_ISSUER";
    public const string JwtAudience = "CORE_JWT_AUDIENCE";
    public const string JwtExpirationMinutes = "CORE_JWT_EXPIRATION_MINUTES";
    public const string RefreshTokenDays = "CORE_REFRESH_TOKEN_DAYS";
    public const string KafkaBootstrapServers = "KAFKA_BOOTSTRAP_SERVERS";
    public const string MediaRoot = "CORE_MEDIA_ROOT";
    public const string FrontendOrigin = "CORE_FRONTEND_ORIGIN";
}

public static class CoreDefaults
{
    public const int AccessTokenLifetimeMinutes = 15;
    public const int RefreshTokenLifetimeDays = 7;
    public const int PasswordResetLifetimeHours = 1;
    public const string JwtIssuer = "atlas-core";
    public const string JwtAudience = "atlas-frontend";
    public const string ServiceVersion = "1.0.0";
    public const string DefaultGeneratedUsername = "user";
    public const int GeneratedUsernameMinSuffix = 100000;
    public const int GeneratedUsernameMaxSuffixExclusive = 1_000_000;
    public const string AvatarMediaPath = "/media/avatars";
    public const string DevelopmentFrontendOrigin = "http://localhost:5173";
    public const string CorsPolicyName = "core-api";
    public const double InitialLatitude = 0d;
    public const double InitialLongitude = 0d;
}

public static class CoreLimits
{
    public const int UserSearchResultCount = 20;
    public const int DefaultNotificationPageSize = 20;
    public const int MaxNotificationPageSize = 100;
    public const int UsernameMaxLength = 50;
    public const int EmailMaxLength = 255;
    public const int DisplayNameMaxLength = 100;
    public const int BioMaxLength = 500;
    public const int PasswordMinLength = 8;
    public const int PasswordMaxLength = 256;
    public const int TokenMaxLength = 512;
    public const int CognitoSubjectMaxLength = 255;
    public const long AvatarUploadBytes = 10 * 1024 * 1024;
    public const int GlobalRequestsPerMinute = 100;
    public const int AuthRequestsPerMinute = 10;
}

public static class FriendshipStatuses
{
    public const string Pending = "pending";
    public const string Accepted = "accepted";
    public const string Declined = "declined";
    public const string Blocked = "blocked";
}

public static class NotificationTypes
{
    public const string FriendRequest = "friend.request";
    public const string FriendAccepted = "friend.accepted";
}

public static class KafkaTopics
{
    public const string UserRegistered = "user.registered";
    public const string UserUpdated = "user.updated";
    public const string FriendAccepted = "friend.accepted";
    public const string LiveLocationUpdated = "live.location.updated";
}

public static class CoreRoles
{
    public const string User = "user";
    public const string Admin = "admin";
}
