namespace Scope.Core.Domain.Interfaces;

public interface IPasswordBreachChecker
{
    Task<bool> IsBreachedAsync(string password, CancellationToken cancellationToken = default);
}
