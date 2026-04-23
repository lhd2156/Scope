FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore Atlas.Core.sln || true
RUN dotnet publish Atlas.Core.API/Atlas.Core.API.csproj -c Release -o /app/publish || true

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
HEALTHCHECK CMD curl -f http://localhost:8080/api/core/health || exit 1
ENTRYPOINT ["dotnet", "Atlas.Core.API.dll"]
