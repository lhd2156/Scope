using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Models;
using Xunit;

namespace Atlas.Core.Tests.Domain;

public sealed class DomainModelTests
{
    [Fact]
    public void Entities_ExposeExpectedDefaultsAndRoundTripProperties()
    {
        var user = new User();
        Assert.Equal(CoreRoles.User, user.Role);
        Assert.True(user.IsActive);
        Assert.Empty(user.RefreshTokens);

        var refreshToken = new RefreshToken { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), Token = "refresh-token", User = user };
        var friendship = new Friendship { Id = Guid.NewGuid(), RequesterId = Guid.NewGuid(), AddresseeId = Guid.NewGuid() };
        var notification = new Notification { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), Type = NotificationTypes.FriendRequest, Title = "New request" };
        var liveSession = new LiveSession { Id = Guid.NewGuid(), TripId = Guid.NewGuid(), UserId = Guid.NewGuid(), Latitude = 1.5, Longitude = 2.5 };

        Assert.Equal("refresh-token", refreshToken.Token);
        Assert.Equal(FriendshipStatuses.Pending, friendship.Status);
        Assert.Equal(NotificationTypes.FriendRequest, notification.Type);
        Assert.True(liveSession.IsActive);
        Assert.Equal(1.5, liveSession.Latitude);
    }

    [Fact]
    public void ExceptionTypes_ExposeExpectedCodesStatusesAndDetails()
    {
        var validation = new ValidationException("Invalid input", [("field", "problem")]);
        var notFound = new NotFoundException("Missing");
        var unauthorized = new UnauthorizedException("Nope");
        var forbidden = new ForbiddenException("Forbidden");
        var conflict = new ConflictException("Conflict");
        var unprocessable = new UnprocessableException("Unprocessable");

        Assert.Equal("VALIDATION_ERROR", validation.Code);
        Assert.Equal(400, validation.StatusCode);
        Assert.Single(validation.Details);
        Assert.Equal("NOT_FOUND", notFound.Code);
        Assert.Equal(404, notFound.StatusCode);
        Assert.Equal("UNAUTHORIZED", unauthorized.Code);
        Assert.Equal(401, unauthorized.StatusCode);
        Assert.Equal("FORBIDDEN", forbidden.Code);
        Assert.Equal(403, forbidden.StatusCode);
        Assert.Equal("CONFLICT", conflict.Code);
        Assert.Equal(409, conflict.StatusCode);
        Assert.Equal("UNPROCESSABLE", unprocessable.Code);
        Assert.Equal(422, unprocessable.StatusCode);
    }

    [Fact]
    public void Records_PreservePayloadShape()
    {
        var traceId = Guid.NewGuid().ToString("N");
        var response = new ApiResponse<string>("payload", new { page = 1 });
        var envelope = new ErrorEnvelope(new ErrorBody("VALIDATION_ERROR", "Invalid", [new ErrorDetail("field", "problem")], traceId));
        var tokenPair = new TokenPair("access", "refresh", DateTimeOffset.UtcNow.AddMinutes(15));
        var authResult = new AuthResult(Guid.NewGuid(), "louis", "louis@example.com", "Louis", "access", "refresh");
        var userProfile = new UserProfile(Guid.NewGuid(), "louis", "louis@example.com", "Louis", "Bio", null, DateTimeOffset.UtcNow);
        var page = new PagedResult<string>(["a", "b"], 1, 20, 2);

        Assert.Equal("payload", response.Data);
        Assert.Equal("VALIDATION_ERROR", envelope.Error.Code);
        Assert.Equal("access", tokenPair.AccessToken);
        Assert.Equal("louis", authResult.Username);
        Assert.Equal("Bio", userProfile.Bio);
        Assert.Equal(2, page.Items.Count);
    }
}
