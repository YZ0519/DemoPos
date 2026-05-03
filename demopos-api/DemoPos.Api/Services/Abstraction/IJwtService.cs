using DemoPos.Api.Models;

namespace DemoPos.Api.Services.Abstraction;

public interface IJwtService
{
    string GenerateToken(User user, IList<string> permissions);
}
