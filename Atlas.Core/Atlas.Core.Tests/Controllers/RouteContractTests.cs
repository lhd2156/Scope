using System.Reflection;
using Atlas.Core.API.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace Atlas.Core.Tests.Controllers;

public sealed class RouteContractTests
{
    [Fact]
    public void CoreControllers_ExposeEveryArchitectureEndpoint()
    {
        var discoveredEndpoints = DiscoverControllerEndpoints();
        var expectedEndpoints = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "POST api/core/auth/register",
            "POST api/core/auth/login",
            "POST api/core/auth/refresh",
            "POST api/core/auth/logout",
            "POST api/core/auth/forgot-password",
            "POST api/core/auth/reset-password",
            "POST api/core/auth/oauth/cognito",
            "GET api/core/auth/me",
            "GET api/core/users/{id:guid}",
            "PUT api/core/users/{id:guid}",
            "DELETE api/core/users/{id:guid}",
            "GET api/core/users/search",
            "PUT api/core/users/{id:guid}/avatar",
            "GET api/core/users/{id:guid}/stats",
            "POST api/core/friends/request/{userId:guid}",
            "PUT api/core/friends/{id:guid}/accept",
            "PUT api/core/friends/{id:guid}/decline",
            "DELETE api/core/friends/{id:guid}",
            "GET api/core/friends",
            "GET api/core/friends/pending",
            "POST api/core/friends/{userId:guid}/block",
            "GET api/core/notifications",
            "PUT api/core/notifications/{id:guid}/read",
            "PUT api/core/notifications/read-all",
            "DELETE api/core/notifications/{id:guid}",
            "GET api/core/notifications/unread-count",
            "POST api/core/live/start/{tripId:guid}",
            "PUT api/core/live/ping",
            "POST api/core/live/stop",
            "GET api/core/live/trip/{tripId:guid}",
            "GET api/core/health"
        };

        var missingEndpoints = expectedEndpoints.Except(discoveredEndpoints).OrderBy(x => x).ToArray();
        var unexpectedEndpoints = discoveredEndpoints.Except(expectedEndpoints).OrderBy(x => x).ToArray();

        Assert.True(missingEndpoints.Length == 0, $"Missing endpoints:{Environment.NewLine}{string.Join(Environment.NewLine, missingEndpoints)}");
        Assert.True(unexpectedEndpoints.Length == 0, $"Unexpected endpoints:{Environment.NewLine}{string.Join(Environment.NewLine, unexpectedEndpoints)}");
    }

    private static HashSet<string> DiscoverControllerEndpoints()
    {
        var assembly = typeof(AuthController).Assembly;
        var controllers = assembly
            .GetTypes()
            .Where(type => typeof(ControllerBase).IsAssignableFrom(type) && !type.IsAbstract)
            .ToArray();

        var endpoints = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var controller in controllers)
        {
            var controllerRoute = controller.GetCustomAttribute<RouteAttribute>()?.Template ?? string.Empty;
            var actionMethods = controller.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
            foreach (var method in actionMethods)
            {
                foreach (var httpAttribute in method.GetCustomAttributes<HttpMethodAttribute>(inherit: true))
                {
                    var route = Combine(controllerRoute, httpAttribute.Template);
                    foreach (var httpMethod in httpAttribute.HttpMethods)
                    {
                        endpoints.Add($"{httpMethod.ToUpperInvariant()} {route}");
                    }
                }
            }
        }

        return endpoints;
    }

    private static string Combine(string controllerRoute, string? actionRoute)
    {
        var left = controllerRoute.Trim('/');
        var right = (actionRoute ?? string.Empty).Trim('/');

        if (string.IsNullOrWhiteSpace(left))
        {
            return right;
        }

        if (string.IsNullOrWhiteSpace(right))
        {
            return left;
        }

        return $"{left}/{right}";
    }
}
