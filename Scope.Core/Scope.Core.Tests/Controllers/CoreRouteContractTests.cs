using System.Reflection;
using Scope.Core.API.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.RateLimiting;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class CoreRouteContractTests
{
    private static readonly HashSet<string> ExpectedRoutes =
    [
        "POST /api/core/auth/register",
        "POST /api/core/auth/login",
        "POST /api/core/auth/refresh",
        "POST /api/core/auth/logout",
        "GET /api/core/auth/me",
        "POST /api/core/auth/password-reset/request",
        "POST /api/core/auth/password-reset/complete",
        "POST /api/core/auth/email/verify/send",
        "POST /api/core/auth/email/verify",
        "POST /api/core/auth/mfa/enroll",
        "POST /api/core/auth/mfa/enroll/confirm",
        "POST /api/core/auth/mfa/disable",
        "POST /api/core/friends/request/{userId:guid}",
        "PUT /api/core/friends/{id:guid}/accept",
        "PUT /api/core/friends/{id:guid}/reject",
        "DELETE /api/core/friends/{id:guid}",
        "GET /api/core/friends",
        "GET /api/core/friends/pending",
        "GET /api/core/friends/suggestions",
        "GET /api/core/health",
        "POST /api/core/live/start/{tripId:guid}",
        "PUT /api/core/live/ping",
        "GET /api/core/live/trip/{tripId:guid}",
        "POST /api/core/live/stop/{tripId:guid}",
        "GET /api/core/notifications",
        "GET /api/core/notifications/admin/deliveries",
        "GET /api/core/notifications/admin/outbox",
        "GET /api/core/notifications/preferences",
        "GET /api/core/notifications/unread-count",
        "POST /api/core/notifications/admin/deliveries/{id:guid}/replay",
        "POST /api/core/notifications/admin/outbox/{id:guid}/replay",
        "POST /api/core/notifications/push-subscriptions",
        "POST /api/core/notifications/{id:guid}/actions",
        "PUT /api/core/presence/heartbeat",
        "PUT /api/core/notifications/preferences",
        "PUT /api/core/notifications/{id:guid}/read",
        "PUT /api/core/notifications/read-all",
        "DELETE /api/core/notifications/push-subscriptions/{id:guid}",
        "DELETE /api/core/notifications/{id:guid}",
        "GET /api/core/social-safety/blocks",
        "POST /api/core/social-safety/blocks/{blockedUserId:guid}",
        "POST /api/core/social-safety/reports",
        "DELETE /api/core/social-safety/blocks/{blockedUserId:guid}",
        "GET /api/core/users/{id:guid}",
        "PUT /api/core/users/{id:guid}",
        "DELETE /api/core/users/{id:guid}",
        "GET /api/core/users/{id:guid}/stats",
        "GET /api/core/users/search",
    ];

    private static readonly HashSet<string> PublicRoutes =
    [
        "POST /api/core/auth/register",
        "POST /api/core/auth/login",
        "POST /api/core/auth/refresh",
        "POST /api/core/auth/logout",
        "POST /api/core/auth/password-reset/request",
        "POST /api/core/auth/password-reset/complete",
        "POST /api/core/auth/email/verify",
        "GET /api/core/health",
    ];

    [Fact]
    public void CoreRouteSurfaceMatchesBackendContract()
    {
        var actual = ActualRoutes().Keys.ToHashSet();
        Assert.True(
            ExpectedRoutes.SetEquals(actual),
            $"Missing: {string.Join(", ", ExpectedRoutes.Except(actual).Order())}; Extra: {string.Join(", ", actual.Except(ExpectedRoutes).Order())}");
    }

    [Fact]
    public void CoreEndpointAuthorizationMatchesBackendContract()
    {
        foreach (var (route, endpoint) in ActualRoutes())
        {
            var isPublic = PublicRoutes.Contains(route);
            var hasAuthorize = endpoint.Controller.GetCustomAttribute<AuthorizeAttribute>() is not null
                || endpoint.Method.GetCustomAttribute<AuthorizeAttribute>() is not null;
            var allowsAnonymous = endpoint.Method.GetCustomAttribute<AllowAnonymousAttribute>() is not null;

            if (isPublic)
            {
                Assert.True(allowsAnonymous || !hasAuthorize, $"{route} should remain public");
            }
            else
            {
                Assert.True(hasAuthorize, $"{route} should require authorization");
            }
        }
    }

    [Fact]
    public void AuthControllerUsesNarrowRateLimitPolicies()
    {
        Assert.Null(typeof(AuthController).GetCustomAttribute<EnableRateLimitingAttribute>());

        AssertRateLimit(nameof(AuthController.Register), "auth");
        AssertRateLimit(nameof(AuthController.Login), "auth");
        AssertRateLimit(nameof(AuthController.Refresh), "auth");
        AssertRateLimit(nameof(AuthController.RequestPasswordReset), "auth");
        AssertRateLimit(nameof(AuthController.CompletePasswordReset), "auth");
        AssertRateLimit(nameof(AuthController.SendEmailVerification), "auth");
        AssertRateLimit(nameof(AuthController.ConfirmEmail), "auth");
        AssertRateLimit(nameof(AuthController.StartMfaEnrollment), "auth");
        AssertRateLimit(nameof(AuthController.ConfirmMfaEnrollment), "auth");
        AssertRateLimit(nameof(AuthController.DisableMfa), "auth");

        AssertRateLimit(nameof(AuthController.Logout), "global");
        AssertRateLimit(nameof(AuthController.Me), "global");
    }

    private static void AssertRateLimit(string methodName, string expectedPolicy)
    {
        var method = typeof(AuthController).GetMethod(methodName);
        Assert.NotNull(method);
        var attribute = method!.GetCustomAttribute<EnableRateLimitingAttribute>();
        Assert.NotNull(attribute);
        Assert.Equal(expectedPolicy, attribute.PolicyName);
    }

    private static Dictionary<string, EndpointDescriptor> ActualRoutes()
    {
        var controllers = typeof(AuthController).Assembly
            .GetTypes()
            .Where(type => type.IsClass && !type.IsAbstract && type.Name.EndsWith("Controller", StringComparison.Ordinal))
            .Where(type => type.Namespace == typeof(AuthController).Namespace);

        var routes = new Dictionary<string, EndpointDescriptor>();
        foreach (var controller in controllers)
        {
            var controllerRoute = controller.GetCustomAttribute<RouteAttribute>()?.Template ?? string.Empty;
            foreach (var method in controller.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly))
            {
                foreach (var httpAttribute in method.GetCustomAttributes().OfType<HttpMethodAttribute>())
                {
                    var path = CombineRoute(controllerRoute, httpAttribute.Template);
                    foreach (var verb in httpAttribute.HttpMethods)
                    {
                        routes[$"{verb} {path}"] = new EndpointDescriptor(controller, method);
                    }
                }
            }
        }

        return routes;
    }

    private static string CombineRoute(string controllerRoute, string? actionRoute)
    {
        var left = controllerRoute.Trim('/');
        var right = (actionRoute ?? string.Empty).Trim('/');
        return string.IsNullOrWhiteSpace(right) ? $"/{left}" : $"/{left}/{right}";
    }

    private sealed record EndpointDescriptor(Type Controller, MethodInfo Method);
}
