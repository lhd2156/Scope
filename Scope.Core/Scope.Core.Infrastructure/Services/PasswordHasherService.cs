using Scope.Core.Domain.Interfaces;

namespace Scope.Core.Infrastructure.Services;

public sealed class PasswordHasherService : IPasswordHasher
{
    private const int BcryptWorkFactor = 12;

    public string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, workFactor: BcryptWorkFactor);

    public bool Verify(string password, string passwordHash) => BCrypt.Net.BCrypt.Verify(password, passwordHash);
}
