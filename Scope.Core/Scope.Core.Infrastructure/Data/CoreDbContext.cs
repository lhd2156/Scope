using Scope.Core.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.Infrastructure.Data;

public sealed class CoreDbContext(DbContextOptions<CoreDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordReset> PasswordResets => Set<PasswordReset>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<NotificationOutbox> NotificationOutbox => Set<NotificationOutbox>();
    public DbSet<NotificationDelivery> NotificationDeliveries => Set<NotificationDelivery>();
    public DbSet<UserBlock> UserBlocks => Set<UserBlock>();
    public DbSet<UserReport> UserReports => Set<UserReport>();
    public DbSet<LiveSession> LiveSessions => Set<LiveSession>();
    public DbSet<UserPresence> UserPresences => Set<UserPresence>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("core");
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.Username).IsUnique();
            entity.HasIndex(x => x.PhoneNumber).IsUnique().HasFilter("[PhoneNumber] IS NOT NULL");
            entity.HasIndex(x => new { x.IsShowcase, x.IsActive, x.CreatedAt });
            entity.Property(x => x.Email).HasMaxLength(255).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(32);
            entity.Property(x => x.Username).HasMaxLength(30).IsRequired();
            entity.Property(x => x.DisplayName).HasMaxLength(60).IsRequired();
            entity.Property(x => x.DateOfBirth).HasColumnType("date");
            entity.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
            entity.Property(x => x.HomeBase).HasMaxLength(120);
            entity.Property(x => x.InterestsJson).HasMaxLength(1000);
            entity.Property(x => x.ShowActivityStatus).HasDefaultValue(true);
            entity.Property(x => x.IsShowcase).HasDefaultValue(false);
            entity.Property(x => x.Role).HasMaxLength(20).IsRequired();
            entity.Property(x => x.EmailVerificationTokenHash).HasMaxLength(128);
            entity.Property(x => x.MfaSecret).HasMaxLength(128);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("RefreshTokens");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Token).IsUnique();
            entity.Property(x => x.Token).HasMaxLength(128);
            entity.Property(x => x.ReplacedByTokenHash).HasMaxLength(128);
            entity.Property(x => x.RevokedReason).HasMaxLength(64);
        });

        modelBuilder.Entity<PasswordReset>(entity =>
        {
            entity.ToTable("PasswordResets");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.HasIndex(x => new { x.UserId, x.ExpiresAt });
            entity.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
            entity.Property(x => x.RequestIpHash).HasMaxLength(128);
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<Friendship>(entity =>
        {
            entity.ToTable("Friendships");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.RequesterId, x.AddresseeId }).IsUnique();
            entity.HasIndex(x => new { x.Status, x.RequesterId, x.CreatedAt });
            entity.HasIndex(x => new { x.Status, x.AddresseeId, x.CreatedAt });
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("Notifications");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAt });
            entity.HasIndex(x => new { x.UserId, x.Category, x.CreatedAt });
            entity.HasIndex(x => new { x.UserId, x.SourceEventId }).IsUnique().HasFilter("[SourceEventId] IS NOT NULL");
            entity.HasIndex(x => x.GroupKey).HasFilter("[GroupKey] IS NOT NULL");
            entity.Property(x => x.Type).HasMaxLength(80).IsRequired();
            entity.Property(x => x.TemplateKey).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Priority).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Body).HasMaxLength(1000);
            entity.Property(x => x.ActionUrl).HasMaxLength(500);
            entity.Property(x => x.ReferenceType).HasMaxLength(60);
            entity.Property(x => x.ReferenceId).HasMaxLength(120);
            entity.Property(x => x.SourceEventId).HasMaxLength(160);
            entity.Property(x => x.GroupKey).HasMaxLength(180);
            entity.Property(x => x.MetadataJson).HasMaxLength(4000);
        });

        modelBuilder.Entity<NotificationPreference>(entity =>
        {
            entity.ToTable("NotificationPreferences");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.UserId, x.Category }).IsUnique();
            entity.Property(x => x.Category).HasMaxLength(40).IsRequired();
            entity.Property(x => x.DigestCadence).HasMaxLength(20).IsRequired();
            entity.Property(x => x.TimeZoneId).HasMaxLength(80).IsRequired();
        });

        modelBuilder.Entity<PushSubscription>(entity =>
        {
            entity.ToTable("PushSubscriptions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.Endpoint).IsUnique();
            entity.HasIndex(x => new { x.UserId, x.IsEnabled });
            entity.Property(x => x.Endpoint).HasMaxLength(1200).IsRequired();
            entity.Property(x => x.P256dh).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Auth).HasMaxLength(256).IsRequired();
            entity.Property(x => x.UserAgent).HasMaxLength(300);
        });

        modelBuilder.Entity<NotificationOutbox>(entity =>
        {
            entity.ToTable("NotificationOutbox");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.SourceEventId).IsUnique();
            entity.HasIndex(x => new { x.Status, x.AvailableAt });
            entity.Property(x => x.SourceEventId).HasMaxLength(160).IsRequired();
            entity.Property(x => x.EventType).HasMaxLength(80).IsRequired();
            entity.Property(x => x.PayloadJson).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
            entity.Property(x => x.LastError).HasMaxLength(1000);
        });

        modelBuilder.Entity<NotificationDelivery>(entity =>
        {
            entity.ToTable("NotificationDeliveries");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.Status, x.NextAttemptAt });
            entity.HasIndex(x => new { x.NotificationId, x.Channel }).IsUnique();
            entity.Property(x => x.Channel).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
            entity.Property(x => x.ProviderMessageId).HasMaxLength(200);
            entity.Property(x => x.ErrorCode).HasMaxLength(80);
            entity.Property(x => x.LastError).HasMaxLength(1000);
            entity.HasOne(x => x.Notification).WithMany().HasForeignKey(x => x.NotificationId);
        });

        modelBuilder.Entity<UserBlock>(entity =>
        {
            entity.ToTable("UserBlocks");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.BlockerId, x.BlockedId }).IsUnique();
        });

        modelBuilder.Entity<UserReport>(entity =>
        {
            entity.ToTable("UserReports");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.Property(x => x.TargetType).HasMaxLength(60).IsRequired();
            entity.Property(x => x.TargetId).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Reason).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Details).HasMaxLength(1000);
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
        });

        modelBuilder.Entity<LiveSession>(entity =>
        {
            entity.ToTable("LiveSessions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TripId, x.IsActive });
            entity.HasIndex(x => new { x.TripId, x.UserId, x.IsActive });
        });

        modelBuilder.Entity<UserPresence>(entity =>
        {
            entity.ToTable("UserPresence");
            entity.HasKey(x => x.UserId);
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
            entity.Property(x => x.RouteContext).HasMaxLength(160);
            entity.HasIndex(x => new { x.Status, x.LastActiveAt });
            entity.HasOne(x => x.User).WithOne().HasForeignKey<UserPresence>(x => x.UserId);
        });
    }
}
