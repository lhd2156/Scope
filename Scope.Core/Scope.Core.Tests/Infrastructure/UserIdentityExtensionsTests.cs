using System.Reflection;
using System.Security.Claims;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Exceptions;
using Microsoft.AspNetCore.SignalR;
using Moq;
using Xunit;

namespace Scope.Core.Tests.Infrastructure;

public sealed class UserIdentityExtensionsTests
{
    [Fact]
    public void GetRequiredUserId_AcceptsSubjectFallbackAndRejectsMissingIdentity()
    {
        var method = UserIdentityMethod();
        var userId = Guid.NewGuid();
        var subjectPrincipal = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim("sub", userId.ToString())
        ], "test"));

        Assert.Equal(userId, method.Invoke(null, [subjectPrincipal]));

        var exception = Assert.Throws<TargetInvocationException>(() => method.Invoke(null, [new ClaimsPrincipal()]));
        Assert.IsType<UnauthorizedException>(exception.InnerException);
    }

    [Fact]
    public void HubIdentityExtensions_UseUserIdentifierNameIdentifierSubjectAndRejectMissingValues()
    {
        var getString = HubUserIdStringMethod();
        var getRequired = HubRequiredUserIdMethod();
        var userIdentifier = Guid.NewGuid();
        var nameIdentifier = Guid.NewGuid();
        var subject = Guid.NewGuid();

        Assert.Equal(userIdentifier.ToString(), getString.Invoke(null, [HubContext(userIdentifier.ToString(), null)]));
        Assert.Equal(nameIdentifier.ToString(), getString.Invoke(null, [HubContext(null, ClaimTypes.NameIdentifier, nameIdentifier)]));
        Assert.Equal(subject.ToString(), getString.Invoke(null, [HubContext(null, "sub", subject)]));
        Assert.Null(getString.Invoke(null, [HubContext(null, null)]));

        Assert.Equal(nameIdentifier, getRequired.Invoke(null, [HubContext(null, ClaimTypes.NameIdentifier, nameIdentifier)]));

        var exception = Assert.Throws<TargetInvocationException>(() => getRequired.Invoke(null, [HubContext("not-a-guid", null)]));
        Assert.IsType<UnauthorizedException>(exception.InnerException);
    }

    private static MethodInfo UserIdentityMethod()
    {
        var type = typeof(HealthController).Assembly.GetType("Scope.Core.API.Infrastructure.UserIdentityExtensions")
            ?? throw new InvalidOperationException("UserIdentityExtensions type was not found.");
        return type.GetMethod("GetRequiredUserId", BindingFlags.Public | BindingFlags.Static, [typeof(ClaimsPrincipal)])
            ?? throw new MissingMethodException("UserIdentityExtensions", "GetRequiredUserId");
    }

    private static MethodInfo HubUserIdStringMethod()
    {
        var type = typeof(HealthController).Assembly.GetType("Scope.Core.API.Infrastructure.UserIdentityExtensions")
            ?? throw new InvalidOperationException("UserIdentityExtensions type was not found.");
        return type.GetMethod("GetUserIdString", BindingFlags.Public | BindingFlags.Static, [typeof(HubCallerContext)])
            ?? throw new MissingMethodException("UserIdentityExtensions", "GetUserIdString");
    }

    private static MethodInfo HubRequiredUserIdMethod()
    {
        var type = typeof(HealthController).Assembly.GetType("Scope.Core.API.Infrastructure.UserIdentityExtensions")
            ?? throw new InvalidOperationException("UserIdentityExtensions type was not found.");
        return type.GetMethod("GetRequiredUserId", BindingFlags.Public | BindingFlags.Static, [typeof(HubCallerContext)])
            ?? throw new MissingMethodException("UserIdentityExtensions", "GetRequiredUserId");
    }

    private static HubCallerContext HubContext(string? userIdentifier, string? claimType, Guid? claimValue = null)
    {
        var context = new Mock<HubCallerContext>();
        context.Setup(x => x.UserIdentifier).Returns(userIdentifier);
        if (claimType is not null && claimValue is { } userId)
        {
            context.Setup(x => x.User).Returns(new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(claimType, userId.ToString())
            ], "test")));
        }
        return context.Object;
    }
}
