# Atlas.Core

Core Platform service for Atlas built with ASP.NET Core 8.

## Projects
- Atlas.Core.API
- Atlas.Core.Domain
- Atlas.Core.Infrastructure
- Atlas.Core.Tests

## Environment
Expected env vars:
- CORE_DB_CONNECTION
- CORE_JWT_SECRET
- CORE_JWT_ISSUER
- CORE_JWT_AUDIENCE
- CORE_JWT_EXPIRATION_MINUTES
- KAFKA_BOOTSTRAP_SERVERS

## Notes
This workspace was scaffolded to match `atlas_architecture.tex` sections for the core service, but local build/test execution depends on a .NET 8 SDK being installed and available on PATH.
