using System.Security.Claims;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Scope.Core.Tests;

public static class TestData
{
    public static CoreDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new CoreDbContext(options);
    }

    public static User User(
        Guid? id = null,
        string username = "user",
        string? email = null,
        string displayName = "Scope User",
        bool isActive = true,
        string? interestsJson = null,
        string? homeBase = null,
        bool showActivityStatus = true)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var storedUsername = $"{username}-{suffix}";
        if (storedUsername.Length > 30)
        {
            storedUsername = storedUsername[..30];
        }

        return new User
        {
            Id = id ?? Guid.NewGuid(),
            Username = storedUsername,
            Email = email ?? $"{username}-{suffix}@example.com",
            DisplayName = displayName,
            PasswordHash = "hash",
            IsActive = isActive,
            InterestsJson = interestsJson,
            HomeBase = homeBase,
            ShowActivityStatus = showActivityStatus,
            DateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-24)),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
    }

    public static T WithUser<T>(this T controller, Guid userId) where T : ControllerBase
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                ], "test"))
            }
        };
        return controller;
    }

    public static ApiResponse<object> Response(OkObjectResult result)
        => Assert.IsType<ApiResponse<object>>(result.Value);

    public static T Prop<T>(object payload, string name)
    {
        var value = payload.GetType().GetProperty(name)?.GetValue(payload)
            ?? throw new InvalidOperationException($"Property {name} was missing.");
        return Assert.IsAssignableFrom<T>(value);
    }
}

public sealed class CapturingKafkaProducerService : IKafkaProducerService
{
    public List<(string Topic, object Payload)> Published { get; } = [];

    public Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default)
    {
        Published.Add((topic, payload));
        return Task.CompletedTask;
    }
}

public sealed class CapturingNotificationService : INotificationService
{
    public List<NotificationCreateRequest> Created { get; } = [];
    public List<(Guid UserId, NotificationDigestItem Item)> Digests { get; } = [];

    public Task<Notification?> CreateAsync(NotificationCreateRequest request, CancellationToken cancellationToken = default)
    {
        Created.Add(request);
        return Task.FromResult<Notification?>(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            Type = request.Type,
            TemplateKey = request.TemplateKey,
            Category = request.Category,
            Priority = request.Priority,
            Title = request.Title,
            Body = request.Body,
            ActionUrl = request.ActionUrl,
            ActorUserId = request.ActorUserId,
            ReferenceType = request.ReferenceType,
            ReferenceId = request.ReferenceId,
            SourceEventId = request.SourceEventId,
            CreatedAt = request.CreatedAt ?? DateTimeOffset.UtcNow,
        });
    }

    public Task<Notification?> UpsertFriendActivityDigestAsync(Guid userId, NotificationDigestItem item, CancellationToken cancellationToken = default)
    {
        Digests.Add((userId, item));
        return Task.FromResult<Notification?>(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = "friend.activity.digest",
            Category = "friend",
            Title = item.Title,
            CreatedAt = item.OccurredAt,
        });
    }

    public Task QueueDeliveryAttemptsAsync(Notification notification, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}
