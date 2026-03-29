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

## Local validation
Run from `Atlas.Core/`:

```bash
dotnet build Atlas.Core.sln
dotnet test Atlas.Core.sln
```

## Notes
- The service follows the Atlas architecture sections for auth, users, friends, notifications, live sessions, SignalR hubs, middleware, and health checks.
- Docker uses a multi-stage .NET 8 build and exposes the API on port 80 for local compose parity.
