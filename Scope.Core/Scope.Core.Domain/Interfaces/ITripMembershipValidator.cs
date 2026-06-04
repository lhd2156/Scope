namespace Scope.Core.Domain.Interfaces;

public interface ITripMembershipValidator
{
    Task<bool> IsMemberAsync(Guid tripId, Guid userId, string bearerToken, CancellationToken cancellationToken = default);
    Task<string?> GetRoleAsync(Guid tripId, Guid userId, string bearerToken, CancellationToken cancellationToken = default);
}
