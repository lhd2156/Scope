using System.Reflection;
using System.Text.RegularExpressions;
using Atlas.Core.API.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace Atlas.Core.Tests.Controllers;

public sealed class FinalEndpointSpecificationAuditTests
{
    private static readonly HashSet<string> ExpectedEndpointContract =
    [
        "POST /api/core/auth/register",
        "POST /api/core/auth/login",
        "POST /api/core/auth/refresh",
        "POST /api/core/auth/logout",
        "POST /api/core/auth/forgot-password",
        "POST /api/core/auth/reset-password",
        "POST /api/core/auth/oauth/cognito",
        "GET /api/core/auth/me",
        "GET /api/core/users/{}",
        "PUT /api/core/users/{}",
        "DELETE /api/core/users/{}",
        "GET /api/core/users/search",
        "PUT /api/core/users/{}/avatar",
        "GET /api/core/users/{}/stats",
        "POST /api/core/friends/request/{}",
        "PUT /api/core/friends/{}/accept",
        "PUT /api/core/friends/{}/decline",
        "DELETE /api/core/friends/{}",
        "GET /api/core/friends",
        "GET /api/core/friends/pending",
        "POST /api/core/friends/{}/block",
        "GET /api/core/notifications",
        "PUT /api/core/notifications/{}/read",
        "PUT /api/core/notifications/read-all",
        "DELETE /api/core/notifications/{}",
        "GET /api/core/notifications/unread-count",
        "POST /api/core/live/start/{}",
        "PUT /api/core/live/ping",
        "POST /api/core/live/stop",
        "GET /api/core/live/trip/{}",
        "GET /api/core/health"
    ];

    private static readonly HashSet<string> ExpectedAnonymousEndpoints =
    [
        "POST /api/core/auth/register",
        "POST /api/core/auth/login",
        "POST /api/core/auth/refresh",
        "POST /api/core/auth/logout",
        "POST /api/core/auth/forgot-password",
        "POST /api/core/auth/reset-password",
        "POST /api/core/auth/oauth/cognito",
        "GET /api/core/health"
    ];

    [Fact]
    public void RestControllerRoutes_MatchArchitectureSpecExactly()
    {
        var actualEndpoints = DiscoverEndpointDescriptors()
            .Select(descriptor => descriptor.ContractKey)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Equal(ExpectedEndpointContract.Count, actualEndpoints.Count);
        Assert.Equal(ExpectedEndpointContract.OrderBy(x => x), actualEndpoints.OrderBy(x => x));
    }

    [Fact]
    public void RestControllerAnonymousSurface_MatchesArchitectureSpec()
    {
        var endpointDescriptors = DiscoverEndpointDescriptors().ToList();
        var actualAnonymousEndpoints = endpointDescriptors
            .Where(descriptor => descriptor.AllowAnonymous)
            .Select(descriptor => descriptor.ContractKey)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Equal(ExpectedAnonymousEndpoints.OrderBy(x => x), actualAnonymousEndpoints.OrderBy(x => x));
        Assert.All(endpointDescriptors, descriptor =>
        {
            var shouldBeAnonymous = ExpectedAnonymousEndpoints.Contains(descriptor.ContractKey);
            Assert.Equal(shouldBeAnonymous, descriptor.AllowAnonymous);
        });
    }

    private static IEnumerable<EndpointDescriptor> DiscoverEndpointDescriptors()
    {
        var apiAssembly = typeof(AuthController).Assembly;
        var controllerTypes = apiAssembly
            .GetTypes()
            .Where(type => type.Namespace == typeof(AuthController).Namespace)
            .Where(type => typeof(ControllerBase).IsAssignableFrom(type))
            .Where(type => type is { IsAbstract: false, IsPublic: true })
            .OrderBy(type => type.Name);

        foreach (var controllerType in controllerTypes)
        {
            var controllerRoute = controllerType.GetCustomAttribute<RouteAttribute>(inherit: true)?.Template;
            if (string.IsNullOrWhiteSpace(controllerRoute))
            {
                continue;
            }

            var controllerAllowAnonymous = controllerType.IsDefined(typeof(AllowAnonymousAttribute), inherit: true);

            foreach (var method in controllerType.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly))
            {
                var httpMethodAttributes = method.GetCustomAttributes(inherit: true).OfType<HttpMethodAttribute>().ToArray();
                if (httpMethodAttributes.Length == 0)
                {
                    continue;
                }

                var methodAllowAnonymous = method.IsDefined(typeof(AllowAnonymousAttribute), inherit: true);
                foreach (var httpMethodAttribute in httpMethodAttributes)
                {
                    var combinedTemplate = AttributeRouteModel.CombineTemplates(controllerRoute, httpMethodAttribute.Template);
                    var normalizedPath = NormalizePath(combinedTemplate);
                    foreach (var httpMethod in httpMethodAttribute.HttpMethods)
                    {
                        yield return new EndpointDescriptor(
                            ContractKey: $"{httpMethod.ToUpperInvariant()} {normalizedPath}",
                            AllowAnonymous: controllerAllowAnonymous || methodAllowAnonymous);
                    }
                }
            }
        }
    }

    private static string NormalizePath(string? template)
    {
        var path = "/" + (template ?? string.Empty).Trim('/');
        path = Regex.Replace(path, "\\{[^}/]+(?::[^}]+)?\\}", "{}");
        path = Regex.Replace(path, "/{2,}", "/");
        return path.TrimEnd('/');
    }

    private sealed record EndpointDescriptor(string ContractKey, bool AllowAnonymous);
}
