namespace Atlas.Core.Tests.Infrastructure;

public sealed class DevelopmentApiTestWebApplicationFactory : ApiTestWebApplicationFactory
{
    protected override string HostEnvironment => "Development";
}
