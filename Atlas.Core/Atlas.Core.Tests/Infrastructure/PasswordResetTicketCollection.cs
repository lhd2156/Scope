using Xunit;

namespace Atlas.Core.Tests.Infrastructure;

public static class PasswordResetTicketCollections
{
    public const string SharedPasswordResetTickets = "SharedPasswordResetTickets";
}

[CollectionDefinition(PasswordResetTicketCollections.SharedPasswordResetTickets)]
public sealed class PasswordResetTicketCollectionDefinition;
