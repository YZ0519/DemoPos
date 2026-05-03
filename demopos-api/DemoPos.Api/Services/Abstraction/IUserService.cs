using DemoPos.Api.DTOs.Users;

namespace DemoPos.Api.Services.Abstraction;

public interface IUserService
{
    Task<List<UserDto>> GetAllAsync(CancellationToken ct = default);
    Task<UserDto> GetProfileAsync(int userId, CancellationToken ct = default);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default);
    Task<UserDto> UpdateAsync(int id, UpdateUserRequest request, int currentUserId, string demoEmail, CancellationToken ct = default);
    Task DeleteAsync(int id, int currentUserId, string demoEmail, CancellationToken ct = default);
    Task<UserDto> SuspendAsync(int id, SuspendUserRequest request, string demoEmail, CancellationToken ct = default);
    Task<UserDto> UpdateProfileAsync(int userId, UpdateProfileRequest request, string demoEmail, CancellationToken ct = default);
}
