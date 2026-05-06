using System.Text.RegularExpressions;
using Scope.Core.Domain.Interfaces;

namespace Scope.Core.Infrastructure.Services;

// Enforced on registration and password change. Defense-in-depth beyond the
// DataAnnotation MinLength(8): requires three of four character classes and a
// minimum length of 10 to resist dictionary attacks while staying usable.
// We intentionally do NOT cap maximum length (bcrypt handles up to 72 bytes;
// longer passphrases are silently truncated by bcrypt which is acceptable here).
public sealed class PasswordPolicy : IPasswordPolicy
{
    private const int MinLength = 10;

    private static readonly Regex HasLower = new("[a-z]", RegexOptions.Compiled);
    private static readonly Regex HasUpper = new("[A-Z]", RegexOptions.Compiled);
    private static readonly Regex HasDigit = new("[0-9]", RegexOptions.Compiled);
    private static readonly Regex HasSymbol = new("[^A-Za-z0-9]", RegexOptions.Compiled);

    // Small, high-impact list of obvious weak passwords. We keep this inline
    // rather than bundling a multi-MB HIBP corpus; operators wiring up
    // `/api/auth/register` in production should also enable a breach-list
    // check via an external service (see SECURITY.md credential runbook).
    private static readonly HashSet<string> CommonPasswords = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "password1", "password123", "qwerty123", "letmein", "welcome1",
        "admin1234", "scope1234", "scope_dev_2026!", "changeme", "p@ssw0rd",
    };

    public PasswordValidationResult Validate(string password, string? username = null, string? email = null)
    {
        if (string.IsNullOrEmpty(password))
        {
            return PasswordValidationResult.Fail("Password is required.");
        }
        if (password.Length < MinLength)
        {
            return PasswordValidationResult.Fail($"Password must be at least {MinLength} characters long.");
        }
        int classes = 0;
        if (HasLower.IsMatch(password)) classes++;
        if (HasUpper.IsMatch(password)) classes++;
        if (HasDigit.IsMatch(password)) classes++;
        if (HasSymbol.IsMatch(password)) classes++;
        if (classes < 3)
        {
            return PasswordValidationResult.Fail("Password must include at least three of: lowercase, uppercase, digit, symbol.");
        }
        if (CommonPasswords.Contains(password))
        {
            return PasswordValidationResult.Fail("Password is too common. Choose a less predictable one.");
        }
        if (!string.IsNullOrWhiteSpace(username) && password.Contains(username, StringComparison.OrdinalIgnoreCase))
        {
            return PasswordValidationResult.Fail("Password must not contain your username.");
        }
        if (!string.IsNullOrWhiteSpace(email))
        {
            var local = email.Split('@', 2)[0];
            if (!string.IsNullOrWhiteSpace(local) && password.Contains(local, StringComparison.OrdinalIgnoreCase))
            {
                return PasswordValidationResult.Fail("Password must not contain the local-part of your email.");
            }
        }
        return PasswordValidationResult.Ok();
    }
}
