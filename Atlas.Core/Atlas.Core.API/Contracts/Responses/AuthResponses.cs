using Atlas.Core.Domain.Models;

namespace Atlas.Core.API.Contracts.Responses;

public sealed record RegisterResponse(Guid Id, string Username, string Email, string DisplayName, string AccessToken, string RefreshToken)
{
    public static RegisterResponse FromAuthResult(AuthResult result)
        => new(result.Id, result.Username, result.Email, result.DisplayName, result.AccessToken, result.RefreshToken);
}

public sealed record AuthSessionResponse(Guid Id, string Username, string AccessToken, string RefreshToken)
{
    public static AuthSessionResponse FromAuthResult(AuthResult result)
        => new(result.Id, result.Username, result.AccessToken, result.RefreshToken);
}
