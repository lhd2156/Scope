using Scope.Core.Infrastructure.Services;
using Xunit;

namespace Scope.Core.Tests.Services;

public sealed class PasswordPolicyTests
{
    private readonly PasswordPolicy sut = new();

    [Theory]
    [InlineData("short1!A")]
    [InlineData("alllowercase")]
    [InlineData("password123")]
    public void Validate_RejectsWeakPasswords(string password)
    {
        var result = sut.Validate(password);
        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData("SecurePass123!")]
    [InlineData("Long-Enough-Passphrase-42")]
    public void Validate_AcceptsStrongPasswords(string password)
    {
        var result = sut.Validate(password);
        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_RejectsPasswordContainingUsername()
    {
        var result = sut.Validate("louispassword!A", username: "louis");
        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_RejectsPasswordContainingEmailLocalPart()
    {
        var result = sut.Validate("louisIsGreat9!", email: "louis@example.com");
        Assert.False(result.IsValid);
    }
}
