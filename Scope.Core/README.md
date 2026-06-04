# Scope.Core

Core Platform service for Scope built with ASP.NET Core 8.

## Projects
- Scope.Core.API
- Scope.Core.Domain
- Scope.Core.Infrastructure
- Scope.Core.Tests

## Environment
Expected env vars:
- CORE_DB_CONNECTION
- CORE_JWT_SECRET
- CORE_JWT_ISSUER
- CORE_JWT_AUDIENCE
- CORE_JWT_EXPIRATION_MINUTES
- KAFKA_BOOTSTRAP_SERVERS

## Notes
Local build/test execution depends on a .NET 8 SDK being installed and available on PATH.
