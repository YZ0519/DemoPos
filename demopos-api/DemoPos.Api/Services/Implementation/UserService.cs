using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Users;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class UserService(AppDbContext db, IMapper mapper) : IUserService
{
    public async Task<List<UserDto>> GetAllAsync(CancellationToken ct = default)
    {
        var users = await db.Users
            .AsNoTracking()
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync(ct);

        return mapper.Map<List<UserDto>>(users);
    }

    public async Task<UserDto> GetProfileAsync(int userId, CancellationToken ct = default)
    {
        var user = await db.Users
            .AsNoTracking()
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new KeyNotFoundException("User not found");

        return mapper.Map<UserDto>(user);
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail, ct))
            throw new ArgumentException("Email is already taken");

        // Validate role exists and load it so we can embed the name in the response DTO
        // without a second query after save.
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == request.RoleId, ct)
            ?? throw new ArgumentException("Selected role does not exist");

        // Prevent creating new Admin-role users via the API.
        // The sole Admin account is seeded at startup and cannot be replicated.
        if (role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Cannot create a user with the Admin role");

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = normalizedEmail,
            Username = Guid.NewGuid().ToString("N")[..12],
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            RoleId = role.Id,
            Role = role,
            EmailVerifiedAt = DateTime.UtcNow,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        // Reload with full navigation chain so the DTO includes the permissions list.
        // The role loaded above did not include RolePermissions, so we must re-fetch.
        var created = await db.Users
            .AsNoTracking()
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .FirstAsync(u => u.Id == user.Id, ct);

        return mapper.Map<UserDto>(created);
    }

    public async Task<UserDto> UpdateAsync(
        int id,
        UpdateUserRequest request,
        int currentUserId,
        string demoEmail,
        CancellationToken ct = default)
    {
        var user = await db.Users
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException("User not found");

        if (user.Email == demoEmail)
            throw new InvalidOperationException("Demo user cannot be updated");

        if (user.Id == currentUserId)
            throw new InvalidOperationException("Use the profile page to edit your own account");

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail && u.Id != id, ct))
            throw new ArgumentException("Email is already taken by another user");

        // Validate and load new role so the DTO can be built without a second query.
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == request.RoleId, ct)
            ?? throw new ArgumentException("Selected role does not exist");

        // Prevent promoting an existing user to Admin via the API.
        if (role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Cannot assign the Admin role to a user");

        user.Name = request.Name.Trim();
        user.Email = normalizedEmail;
        user.RoleId = role.Id;
        user.UpdatedAt = DateTime.UtcNow;

        // Only update password when a new one is explicitly supplied.
        if (!string.IsNullOrWhiteSpace(request.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        await db.SaveChangesAsync(ct);

        // Reload with full navigation chain so the DTO includes the permissions list.
        // The role fetched above was loaded without RolePermissions, so re-fetch
        // the complete user graph from the DB after save.
        var updated = await db.Users
            .AsNoTracking()
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .FirstAsync(u => u.Id == id, ct);

        return mapper.Map<UserDto>(updated);
    }

    public async Task DeleteAsync(
        int id,
        int currentUserId,
        string demoEmail,
        CancellationToken ct = default)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException("User not found");

        if (user.Id == currentUserId)
            throw new InvalidOperationException("You cannot delete your own account");

        if (user.Id == 1)
            throw new InvalidOperationException("The master admin account cannot be deleted");

        if (user.Email == demoEmail)
            throw new InvalidOperationException("Demo user cannot be deleted");

        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);
    }

    public async Task<UserDto> SuspendAsync(
        int id,
        SuspendUserRequest request,
        string demoEmail,
        CancellationToken ct = default)
    {
        var user = await db.Users
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException("User not found");

        if (user.Email == demoEmail)
            throw new InvalidOperationException("Demo user cannot be suspended");

        if (user.IsSuspended == request.IsSuspended)
            throw new InvalidOperationException(
                request.IsSuspended ? "User is already suspended" : "User is already active");

        user.IsSuspended = request.IsSuspended;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return mapper.Map<UserDto>(user);
    }

    public async Task<UserDto> UpdateProfileAsync(
        int userId,
        UpdateProfileRequest request,
        string demoEmail,
        CancellationToken ct = default)
    {
        var user = await db.Users
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new KeyNotFoundException("User not found");

        if (user.Email == demoEmail)
            throw new InvalidOperationException("Demo profile cannot be updated");

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail && u.Id != userId, ct))
            throw new ArgumentException("Email is already taken by another user");

        // Password change — only when a new password is supplied
        if (!string.IsNullOrEmpty(request.NewPassword))
        {
            if (string.IsNullOrEmpty(request.CurrentPassword))
                throw new ArgumentException("Current password is required to change password");

            if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
                throw new ArgumentException("Current password is incorrect");

            if (request.NewPassword != request.NewPasswordConfirmation)
                throw new ArgumentException("New passwords do not match");

            if (request.NewPassword.Length < 6)
                throw new ArgumentException("Password must be at least 6 characters");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        }

        user.Name = request.Name.Trim();
        user.Email = normalizedEmail;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return mapper.Map<UserDto>(user);
    }
}
