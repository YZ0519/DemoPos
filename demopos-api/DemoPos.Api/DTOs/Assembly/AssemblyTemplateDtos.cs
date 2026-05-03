namespace DemoPos.Api.DTOs.Assembly;

// ── Summary (list view) ────────────────────────────────────────────────────────

public class AssemblyTemplateSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string AssemblyType { get; set; } = string.Empty;
    public int OutputProductId { get; set; }
    public string? OutputProductName { get; set; }
    public decimal DefaultYield { get; set; }
    public bool IsActive { get; set; }
    public int ItemCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

// ── Template item within detail ────────────────────────────────────────────────

public class AssemblyTemplateItemDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string? ProductName { get; set; }
    public decimal DefaultQuantity { get; set; }
    public int SortOrder { get; set; }
}

// ── Detail (single item view) ─────────────────────────────────────────────────

public class AssemblyTemplateDetailDto : AssemblyTemplateSummaryDto
{
    public string? Description { get; set; }
    public List<AssemblyTemplateItemDto> Items { get; set; } = new();
}

// ── Create request ─────────────────────────────────────────────────────────────

public class CreateAssemblyTemplateRequest
{
    public string Name { get; set; } = string.Empty;
    /// <summary>"split" or "production"</summary>
    public string AssemblyType { get; set; } = "split";
    public int OutputProductId { get; set; }
    public decimal DefaultYield { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public List<AssemblyTemplateItemRequest> Items { get; set; } = new();
}

public class AssemblyTemplateItemRequest
{
    public int ProductId { get; set; }
    public decimal DefaultQuantity { get; set; }
    public int SortOrder { get; set; } = 0;
}

// ── Update request (same shape, full replace) ─────────────────────────────────

public class UpdateAssemblyTemplateRequest : CreateAssemblyTemplateRequest { }
