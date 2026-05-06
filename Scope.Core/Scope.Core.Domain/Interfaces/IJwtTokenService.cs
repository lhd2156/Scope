using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Models;

namespace Scope.Core.Domain.Interfaces;

public interface IJwtTokenService
{
    TokenPair CreateTokens(User user);
}
