using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;

namespace Scope.Core.API.Controllers;

[ApiController]
[EnableRateLimiting("auth")]
[Route("api/core/auth")]
public sealed class AuthController(
    IAuthService authService,
    IPasswordResetService passwordResetService,
    IEmailVerificationService emailVerificationService,
    IMfaService mfaService) : ControllerBase
{
    [HttpPost("register")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
        => StatusCode(StatusCodes.Status201Created, new ApiResponse<object>(await authService.RegisterAsync(request.Username, request.Email, request.Password, request.DisplayName, request.DateOfBirth, request.PhoneNumber, cancellationToken)));

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var outcome = await authService.LoginAsync(request.ResolvedIdentifier, request.Password, request.MfaCode, cancellationToken);
        if (outcome.MfaRequired)
        {
            // 401 with a structured payload keeps the error surface consistent
            // with other auth failures but lets the client prompt for a code
            // without fully unwinding the login flow.
            Response.Headers["WWW-Authenticate"] = "Scope realm=\"mfa\"";
            return StatusCode(StatusCodes.Status401Unauthorized, new ApiResponse<object>(new { mfaRequired = true }));
        }
        return Ok(new ApiResponse<object>(outcome.Result!));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest? request, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await authService.RefreshAsync(request?.RefreshToken ?? string.Empty, cancellationToken)));

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest? request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request?.RefreshToken))
        {
            await authService.LogoutAsync(request.RefreshToken, cancellationToken);
        }

        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await authService.GetCurrentUserAsync(User.GetRequiredUserId(), cancellationToken)));

    [HttpPost("password-reset/request")]
    public async Task<IActionResult> RequestPasswordReset([FromBody] PasswordResetRequest request, CancellationToken cancellationToken)
    {
        // Always return 202 regardless of whether the email exists. Do not
        // branch on the response — that would be a trivial account enumeration
        // oracle.
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        await passwordResetService.RequestResetAsync(request.Email, ip, cancellationToken);
        return StatusCode(StatusCodes.Status202Accepted, new ApiResponse<object>(new { accepted = true }));
    }

    [HttpPost("password-reset/complete")]
    public async Task<IActionResult> CompletePasswordReset([FromBody] PasswordResetCompleteRequest request, CancellationToken cancellationToken)
    {
        await passwordResetService.CompleteResetAsync(request.Token, request.NewPassword, cancellationToken);
        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [Authorize]
    [HttpPost("email/verify/send")]
    public async Task<IActionResult> SendEmailVerification(CancellationToken cancellationToken)
    {
        await emailVerificationService.SendAsync(User.GetRequiredUserId(), cancellationToken);
        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [HttpPost("email/verify")]
    public async Task<IActionResult> ConfirmEmail([FromBody] VerifyEmailRequest request, CancellationToken cancellationToken)
    {
        var verified = await emailVerificationService.ConfirmAsync(request.Token, cancellationToken);
        return Ok(new ApiResponse<object>(new { verified }));
    }

    [Authorize]
    [HttpPost("mfa/enroll")]
    public async Task<IActionResult> StartMfaEnrollment(CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await mfaService.StartEnrollmentAsync(User.GetRequiredUserId(), cancellationToken)));

    [Authorize]
    [HttpPost("mfa/enroll/confirm")]
    public async Task<IActionResult> ConfirmMfaEnrollment([FromBody] MfaConfirmRequest request, CancellationToken cancellationToken)
    {
        await mfaService.ConfirmAsync(User.GetRequiredUserId(), request.Code, cancellationToken);
        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [Authorize]
    [HttpPost("mfa/disable")]
    public async Task<IActionResult> DisableMfa([FromBody] MfaDisableRequest request, CancellationToken cancellationToken)
    {
        await mfaService.DisableAsync(User.GetRequiredUserId(), request.Code, cancellationToken);
        return Ok(new ApiResponse<object>(new { success = true }));
    }
}
