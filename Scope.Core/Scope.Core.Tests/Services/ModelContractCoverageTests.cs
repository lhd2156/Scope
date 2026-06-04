using Scope.Core.Domain.Models;
using Xunit;

namespace Scope.Core.Tests.Services;

public sealed class ModelContractCoverageTests
{
    [Fact]
    public void UserProfileAndNotificationPreferencePayload_ExposeAllContractFields()
    {
        var userId = Guid.NewGuid();
        var createdAt = DateTimeOffset.UtcNow;
        var profile = new UserProfile(
            userId,
            "lou",
            "lou@example.com",
            "Lou",
            "bio",
            "avatar",
            "Austin",
            ["food", "music"],
            false,
            createdAt);

        Assert.Equal(userId, profile.Id);
        Assert.Equal("lou", profile.Username);
        Assert.Equal("lou@example.com", profile.Email);
        Assert.Equal("Lou", profile.DisplayName);
        Assert.Equal("bio", profile.Bio);
        Assert.Equal("avatar", profile.AvatarUrl);
        Assert.Equal("Austin", profile.HomeBase);
        Assert.Equal(["food", "music"], profile.Interests);
        Assert.False(profile.ShowActivityStatus);
        Assert.Equal(createdAt, profile.CreatedAt);

        var preference = new NotificationPreferencePayload("security", true, false, true, "instant", 10, 20, "UTC");
        Assert.Equal("security", preference.Category);
        Assert.True(preference.InAppEnabled);
        Assert.False(preference.PushEnabled);
        Assert.True(preference.EmailEnabled);
        Assert.Equal("instant", preference.DigestCadence);
        Assert.Equal(10, preference.QuietHoursStartMinutes);
        Assert.Equal(20, preference.QuietHoursEndMinutes);
        Assert.Equal("UTC", preference.TimeZoneId);
    }
}
