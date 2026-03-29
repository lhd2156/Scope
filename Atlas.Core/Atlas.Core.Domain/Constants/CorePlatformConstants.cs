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
    public const string DbContextPoolSize = "CORE_DB_CONTEXT_POOL_SIZE";
    public const string DatabaseMinPoolSize = "CORE_DB_MIN_POOL_SIZE";
    public const string DatabaseMaxPoolSize = "CORE_DB_MAX_POOL_SIZE";
    public const string DatabaseConnectTimeoutSeconds = "CORE_DB_CONNECT_TIMEOUT_SECONDS";
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
    public const int HealthCheckTimeoutMilliseconds = 2000;
    public const int DbContextPoolSize = 128;
    public const int DatabaseMinPoolSize = 5;
    public const int DatabaseMaxPoolSize = 100;
    public const int DatabaseConnectTimeoutSeconds = 15;
    public const string JwtIssuer = "atlas-core";
    public const string JwtAudience = "atlas-frontend";
    public const string ServiceVersion = "1.0.0";
    public const string KafkaEventSource = "core-platform";
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

public static class CoreSecurityHeaders
{
    public const string ContentSecurityPolicyName = "Content-Security-Policy";
    public const string XssProtectionName = "X-XSS-Protection";
    public const string ContentSecurityPolicyValue = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; img-src 'self' data: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:;";
    public const string XssProtectionValue = "1; mode=block";
}

public static class CoreLogging
{
    public const string ServiceName = "atlas-core-api";
    public const string ServicePropertyName = "Service";
    public const string CorrelationIdHeaderName = "X-Correlation-Id";
    public const string CorrelationIdPropertyName = "CorrelationId";
    public const string TraceIdPropertyName = "TraceId";
    public const string MethodPropertyName = "Method";
    public const string PathPropertyName = "Path";
    public const string StatusCodePropertyName = "StatusCode";
    public const string DurationMillisecondsPropertyName = "DurationMs";
    public const string RequestContentTypePropertyName = "RequestContentType";
    public const string RequestContentLengthPropertyName = "RequestContentLength";
    public const string ResponseContentTypePropertyName = "ResponseContentType";
    public const string ResponseContentLengthPropertyName = "ResponseContentLength";
    public const int MaxCorrelationIdLength = 128;
}

public static class CoreCaching
{
    public const string EntityTagHeaderName = "ETag";
    public const string IfNoneMatchHeaderName = "If-None-Match";
    public const string CacheControlHeaderName = "Cache-Control";
    public const string CacheControlValue = "private, no-cache";
    public const string VaryHeaderName = "Vary";
    public const string VaryAuthorizationValue = "Authorization";
    public const string VaryAcceptEncodingValue = "Accept-Encoding";
}
