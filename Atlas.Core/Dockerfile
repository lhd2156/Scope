FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Atlas.Core.sln ./
COPY Directory.Build.props ./
COPY Atlas.Core.API/*.csproj Atlas.Core.API/
COPY Atlas.Core.Domain/*.csproj Atlas.Core.Domain/
COPY Atlas.Core.Infrastructure/*.csproj Atlas.Core.Infrastructure/
COPY Atlas.Core.Tests/*.csproj Atlas.Core.Tests/
RUN dotnet restore Atlas.Core.sln
COPY . .
RUN dotnet publish Atlas.Core.API/Atlas.Core.API.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
EXPOSE 80
ENV ASPNETCORE_URLS=http://+:80
HEALTHCHECK CMD curl -f http://localhost/api/core/health || exit 1
ENTRYPOINT ["dotnet", "Atlas.Core.API.dll"]
