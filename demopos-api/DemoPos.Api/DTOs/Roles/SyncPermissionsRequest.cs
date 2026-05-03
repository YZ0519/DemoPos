namespace DemoPos.Api.DTOs.Roles;

public class SyncPermissionsRequest
{
    public List<string> Permissions { get; set; } = new();
}
