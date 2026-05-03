using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Settings;

public class UpdateGeneralSettingsRequest
{
    [Required]
    public string SiteName { get; set; } = string.Empty;

    public string? SiteUrl { get; set; }
    public string? MetaDescription { get; set; }
    public bool   RoundingEnabled { get; set; } = false;
    public string RoundingQuantum { get; set; } = "0.05";
    public bool   PurchaseRoundingEnabled { get; set; } = false;
    public string PurchaseRoundingQuantum { get; set; } = "0.05";

    // Restaurant settings (Phase 3)
    public bool    RestaurantMode { get; set; } = false;
    public bool    TakeawayChargeEnabled { get; set; } = false;
    public decimal TakeawayChargeAmount { get; set; } = 0m;
}
