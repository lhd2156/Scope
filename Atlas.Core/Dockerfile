# Base images are pinned to minor tags; for production release builds, replace
# with explicit sha256 digests (e.g. `...sdk:8.0@sha256:<digest>`) so that a
# compromised tag cannot silently swap our build base. Dependabot tracks these.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore Atlas.Core.sln
# PublishReadyToRun performs AOT compilation of framework + app IL to native
# code during publish. Startup is cut by ~30–50% (JIT cost moves to build),
# and first-request latency improves because hot methods are pre-compiled.
# TieredCompilation stays on so tier-1 PGO-optimized code still kicks in for
# the hottest methods after warmup.
RUN dotnet publish Atlas.Core.API/Atlas.Core.API.csproj \
        -c Release \
        -o /app/publish \
        /p:UseAppHost=false \
        /p:PublishReadyToRun=true \
        /p:TieredCompilation=true \
        /p:PublishTrimmed=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 atlas \
    && useradd --system --uid 10001 --gid atlas --home /app --shell /usr/sbin/nologin atlas
COPY --from=build --chown=atlas:atlas /app/publish .
# Runtime tuning envs: server GC + concurrent collections + tiered PGO. These
# duplicate the MSBuild properties as a defense-in-depth measure — if a future
# publish configuration forgets a flag, the container still runs hot.
# DOTNET_SYSTEM_GLOBALIZATION_INVARIANT is intentionally left unset because
# SqlServer string collation and Username/Email comparisons use culture-aware
# APIs; switching to invariant mode would change comparison semantics.
ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_PRINT_TELEMETRY_MESSAGE=false \
    DOTNET_gcServer=1 \
    DOTNET_GCConcurrent=1 \
    DOTNET_TieredCompilation=1 \
    DOTNET_TieredPGO=1 \
    DOTNET_ReadyToRun=1 \
    DOTNET_TC_QuickJitForLoops=1
EXPOSE 8080
USER atlas
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:8080/api/core/health || exit 1
ENTRYPOINT ["dotnet", "Atlas.Core.API.dll"]
