namespace DemoPos.Api.Constants;

public static class DiscountTypes
{
    public const string Fixed      = "fixed";
    public const string Percentage = "percentage";
    public const string Percent    = "percent";    // Purchase domain
    public const string Override   = "override";
    public const string Member     = "member";     // Zero-total (prepaid trial card) redemption
}
