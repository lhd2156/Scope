using System.Security.Claims;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Core.Tests.Infrastructure;

internal static class TestSupport
{
    public static CoreDbContext CreateDbContext()
        => new(new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options);

    public static void AttachUser(ControllerBase controller, Guid userId)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = CreatePrincipal(userId)
            }
        };
    }

    public static ClaimsPrincipal CreatePrincipal(Guid userId)
        => new(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(CoreClaimTypes.Subject, userId.ToString())
        ],
        authenticationType: "Test"));

    public static User CreateUser(
        Guid? id = null,
        string username = "louis",
        string email = "louis@example.com",
        string displayName = "Louis Do",
        string passwordHash = "hashed-password",
        bool isActive = true)
        => new()
        {
            Id = id ?? Guid.NewGuid(),
            Username = username,
            Email = email,
            DisplayName = displayName,
            PasswordHash = passwordHash,
            Role = CoreRoles.User,
            IsActive = isActive,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-7),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };

    public static IFormFile CreateFormFile(string fileName, string contentType, byte[] bytes)
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }
}
