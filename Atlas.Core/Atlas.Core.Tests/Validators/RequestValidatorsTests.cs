using Atlas.Core.API.Contracts.Requests;
using Atlas.Core.API.Contracts.Validators;
using Atlas.Core.Domain.Constants;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Atlas.Core.Tests.Validators;

public sealed class RequestValidatorsTests
{
    [Fact]
    public void AllRequestValidators_AcceptCanonicalPayloads()
    {
        Assert.True(new RegisterRequestValidator().Validate(new RegisterRequest("louisdo", "louis@example.com", "SecurePass123!", "Louis Do")).IsValid);
        Assert.True(new LoginRequestValidator().Validate(new LoginRequest("louis@example.com", "SecurePass123!")).IsValid);
        Assert.True(new RefreshRequestValidator().Validate(new RefreshRequest("refresh-token")).IsValid);
        Assert.True(new LogoutRequestValidator().Validate(new LogoutRequest("refresh-token")).IsValid);
        Assert.True(new ForgotPasswordRequestValidator().Validate(new ForgotPasswordRequest("louis@example.com")).IsValid);
        Assert.True(new ResetPasswordRequestValidator().Validate(new ResetPasswordRequest("reset-token", "SecurePass123!")).IsValid);
        Assert.True(new CognitoLoginRequestValidator().Validate(new CognitoLoginRequest("louis@example.com", "louisdo", "Louis Do", "cognito-subject")).IsValid);
        Assert.True(new UpdateUserRequestValidator().Validate(new UpdateUserRequest("Louis Do", "Weekend explorer")).IsValid);
        Assert.True(new PingLocationRequestValidator().Validate(new PingLocationRequest(Guid.NewGuid(), 32.7555d, -97.3308d)).IsValid);
        Assert.True(new StopLiveSessionRequestValidator().Validate(new StopLiveSessionRequest(Guid.NewGuid())).IsValid);
        Assert.True(new AvatarUploadRequestValidator().Validate(new AvatarUploadRequest { File = CreateFormFile("avatar.webp", "image/webp", 2048) }).IsValid);
    }

    [Fact]
    public void StringValidators_RejectSchemaOverflowsAndMissingRequiredFields()
    {
        var registerResult = new RegisterRequestValidator().Validate(new RegisterRequest(new string('u', CoreLimits.UsernameMaxLength + 1), "invalid-email", "short", " "));
        Assert.False(registerResult.IsValid);
        Assert.Contains(registerResult.Errors, error => error.PropertyName == nameof(RegisterRequest.Username));
        Assert.Contains(registerResult.Errors, error => error.PropertyName == nameof(RegisterRequest.Email));
        Assert.Contains(registerResult.Errors, error => error.PropertyName == nameof(RegisterRequest.Password));
        Assert.Contains(registerResult.Errors, error => error.PropertyName == nameof(RegisterRequest.DisplayName));

        var updateResult = new UpdateUserRequestValidator().Validate(new UpdateUserRequest(new string('d', CoreLimits.DisplayNameMaxLength + 1), new string('b', CoreLimits.BioMaxLength + 1)));
        Assert.False(updateResult.IsValid);
        Assert.Contains(updateResult.Errors, error => error.PropertyName == nameof(UpdateUserRequest.DisplayName));
        Assert.Contains(updateResult.Errors, error => error.PropertyName == nameof(UpdateUserRequest.Bio));

        var cognitoResult = new CognitoLoginRequestValidator().Validate(new CognitoLoginRequest("louis@example.com", new string('u', CoreLimits.UsernameMaxLength + 1), new string('d', CoreLimits.DisplayNameMaxLength + 1), new string('s', CoreLimits.CognitoSubjectMaxLength + 1)));
        Assert.False(cognitoResult.IsValid);
        Assert.Contains(cognitoResult.Errors, error => error.PropertyName == nameof(CognitoLoginRequest.Username));
        Assert.Contains(cognitoResult.Errors, error => error.PropertyName == nameof(CognitoLoginRequest.DisplayName));
        Assert.Contains(cognitoResult.Errors, error => error.PropertyName == nameof(CognitoLoginRequest.Subject));
    }

    [Fact]
    public void TokenAndCredentialValidators_RejectInvalidPayloads()
    {
        var loginResult = new LoginRequestValidator().Validate(new LoginRequest(string.Empty, new string('p', CoreLimits.PasswordMaxLength + 1)));
        Assert.False(loginResult.IsValid);
        Assert.Contains(loginResult.Errors, error => error.PropertyName == nameof(LoginRequest.Email));
        Assert.Contains(loginResult.Errors, error => error.PropertyName == nameof(LoginRequest.Password));

        var refreshResult = new RefreshRequestValidator().Validate(new RefreshRequest(new string('r', CoreLimits.TokenMaxLength + 1)));
        Assert.False(refreshResult.IsValid);
        Assert.Contains(refreshResult.Errors, error => error.PropertyName == nameof(RefreshRequest.RefreshToken));

        var logoutResult = new LogoutRequestValidator().Validate(new LogoutRequest(string.Empty));
        Assert.False(logoutResult.IsValid);
        Assert.Contains(logoutResult.Errors, error => error.PropertyName == nameof(LogoutRequest.RefreshToken));

        var forgotPasswordResult = new ForgotPasswordRequestValidator().Validate(new ForgotPasswordRequest("not-an-email"));
        Assert.False(forgotPasswordResult.IsValid);
        Assert.Contains(forgotPasswordResult.Errors, error => error.PropertyName == nameof(ForgotPasswordRequest.Email));

        var resetPasswordResult = new ResetPasswordRequestValidator().Validate(new ResetPasswordRequest(new string('t', CoreLimits.TokenMaxLength + 1), "short"));
        Assert.False(resetPasswordResult.IsValid);
        Assert.Contains(resetPasswordResult.Errors, error => error.PropertyName == nameof(ResetPasswordRequest.Token));
        Assert.Contains(resetPasswordResult.Errors, error => error.PropertyName == nameof(ResetPasswordRequest.Password));
    }

    [Fact]
    public void LiveSessionValidators_RejectEmptyTripIdsAndOutOfRangeCoordinates()
    {
        var pingResult = new PingLocationRequestValidator().Validate(new PingLocationRequest(Guid.Empty, 91d, -181d));
        Assert.False(pingResult.IsValid);
        Assert.Contains(pingResult.Errors, error => error.PropertyName == nameof(PingLocationRequest.TripId));
        Assert.Contains(pingResult.Errors, error => error.PropertyName == nameof(PingLocationRequest.Latitude));
        Assert.Contains(pingResult.Errors, error => error.PropertyName == nameof(PingLocationRequest.Longitude));

        var stopResult = new StopLiveSessionRequestValidator().Validate(new StopLiveSessionRequest(Guid.Empty));
        Assert.False(stopResult.IsValid);
        Assert.Contains(stopResult.Errors, error => error.PropertyName == nameof(StopLiveSessionRequest.TripId));
    }

    [Fact]
    public void AvatarUploadValidator_RejectsNullEmptyOversizedAndUnsupportedContentTypes()
    {
        var validator = new AvatarUploadRequestValidator();

        Assert.False(validator.Validate(new AvatarUploadRequest()).IsValid);
        Assert.False(validator.Validate(new AvatarUploadRequest { File = CreateFormFile("avatar.png", "image/png", 0) }).IsValid);
        Assert.False(validator.Validate(new AvatarUploadRequest { File = CreateFormFile("avatar.png", "image/png", CoreLimits.AvatarUploadBytes + 1) }).IsValid);
        Assert.False(validator.Validate(new AvatarUploadRequest { File = CreateFormFile("avatar.gif", "image/gif", 512) }).IsValid);
    }

    private static IFormFile CreateFormFile(string fileName, string contentType, long length)
    {
        var stream = new MemoryStream(new byte[checked((int)Math.Max(length, 0L))]);
        var formFile = new FormFile(stream, 0, length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };

        return formFile;
    }
}
