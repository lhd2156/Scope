namespace Scope.Core.Domain.Interfaces;

public interface IPasswordPolicy
{
    PasswordValidationResult Validate(string password, string? username = null, string? email = null);
}

public readonly record struct PasswordValidationResult(bool IsValid, string? Reason)
{
    public static PasswordValidationResult Ok() => new(true, null);

    public static PasswordValidationResult Fail(string reason) => new(false, reason);
}
