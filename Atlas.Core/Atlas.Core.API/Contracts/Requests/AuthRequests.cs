using System.ComponentModel.DataAnnotations;

namespace Atlas.Core.API.Contracts.Requests;

public sealed record RegisterRequest([Required][MaxLength(100)] string Username, [Required][EmailAddress] string Email, [Required][MinLength(8)] string Password, [Required][MaxLength(200)] string DisplayName);
public sealed record LoginRequest([Required][EmailAddress] string Email, [Required] string Password);
public sealed record RefreshRequest([Required] string RefreshToken);
public sealed record LogoutRequest([Required] string RefreshToken);
public sealed record UpdateUserRequest([Required][MaxLength(200)] string DisplayName, [MaxLength(500)] string? Bio);
public sealed record PingLocationRequest(Guid TripId, double Latitude, double Longitude);
