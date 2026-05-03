using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Constants;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Products;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;
using System.Text.RegularExpressions;

namespace DemoPos.Api.Services.Implementation;

public class ProductService(AppDbContext db, IMapper mapper, IWebHostEnvironment env) : IProductService
{
    private const string EntityFolder = "products";

    public async Task<List<ProductDto>> GetAllAsync(CancellationToken ct = default)
    {
        var products = await db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Brand)
            .Include(p => p.Unit)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        return mapper.Map<List<ProductDto>>(products);
    }

    public async Task<List<ProductDto>> SearchAsync(string term, CancellationToken ct = default)
    {
        var normalised = term.Trim().ToLowerInvariant();

        var products = await db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Brand)
            .Include(p => p.Unit)
            .Where(p => p.Status && p.Quantity >= 1 && p.PosEnabled
                && (p.Name.ToLower().Contains(normalised) || p.Sku == term.Trim()))
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

        return mapper.Map<List<ProductDto>>(products);
    }

    // ── GetPosProductsAsync ───────────────────────────────────────────────────
    // POS product browser: active + stocked products only (status=1, quantity>=1),
    // with optional name/SKU filter and cursor-style pagination for infinite scroll.
    // Returns the page items and a hasMore flag — frontend never needs total count.
    public async Task<(List<ProductDto> Items, bool HasMore)> GetPosProductsAsync(
        string? q, int page, int pageSize, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 200) pageSize = 200;

        IQueryable<Product> query = db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Brand)
            .Include(p => p.Unit)
            .Where(p => p.Status && p.Quantity >= 1 && p.PosEnabled);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            var lower = term.ToLowerInvariant();
            // Exact SKU match takes priority; otherwise name substring search.
            query = query.Where(p =>
                p.Sku == term || p.Name.ToLower().Contains(lower));
        }

        query = query.OrderBy(p => p.Name);

        // Fetch one extra row to determine hasMore without a COUNT query.
        var rows = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize + 1)
            .ToListAsync(ct);

        var hasMore = rows.Count > pageSize;
        var items   = hasMore ? rows.Take(pageSize).ToList() : rows;

        var dtos = mapper.Map<List<ProductDto>>(items);

        // Populate HasModifiers in one batch query — avoids N+1 modifier group lookups on the POS grid.
        if (dtos.Count > 0)
        {
            var pageIds = dtos.Select(d => d.Id).ToList();
            var withModifiers = await db.ProductModifierGroups
                .Where(g => pageIds.Contains(g.ProductId) && g.IsActive)
                .Select(g => g.ProductId)
                .Distinct()
                .ToHashSetAsync(ct);
            foreach (var dto in dtos)
                dto.HasModifiers = withModifiers.Contains(dto.Id);
        }

        return (dtos, hasMore);
    }

    // ── FormProductSearchAsync ─────────────────────────────────────────────────
    // Paginated product lookup for Sales and Purchase forms. Unlike SearchAsync (POS),
    // this does NOT filter by status or quantity — staff need to select discontinued or
    // out-of-stock products. Uses the Skip/Take+1 pattern for hasMore detection.
    // Omits Category/Brand/Unit Includes — the form dropdown only needs core product fields.
    public async Task<(List<ProductDto> Items, bool HasMore)> FormProductSearchAsync(
        string? q, int page, int pageSize, CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        pageSize = Math.Clamp(pageSize, 10, 100);

        IQueryable<Product> query = db.Products.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            // SQL Server default collation is case-insensitive; no need for ToLower().
            // Exact SKU match OR name substring search.
            query = query.Where(p =>
                p.Sku == term || p.Name.Contains(term));
        }

        // Fetch one extra row to determine hasMore without a COUNT query.
        var rows = await query
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize + 1)
            .ToListAsync(ct);

        var hasMore = rows.Count > pageSize;
        var items = hasMore ? rows.Take(pageSize).ToList() : rows;

        return (mapper.Map<List<ProductDto>>(items), hasMore);
    }

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct = default)
    {
        ValidateProductRequest(request.Name, request.Sku, request.DiscountType);

        if (await db.Products.AnyAsync(p => p.Sku == request.Sku.Trim(), ct))
            throw new ArgumentException("A product with that SKU already exists");

        var slug = await GenerateUniqueSlugAsync(request.Name, null, ct);

        var product = new Product
        {
            Name = request.Name.Trim(),
            Slug = slug,
            Sku = request.Sku.Trim(),
            Description = request.Description?.Trim(),
            CategoryId = request.CategoryId,
            BrandId = request.BrandId,
            UnitId = request.UnitId,
            Price = request.Price,
            Discount = request.Discount,
            DiscountType = string.IsNullOrWhiteSpace(request.DiscountType) ? null : request.DiscountType.Trim(),
            PurchasePrice = request.PurchasePrice,
            Quantity = request.Quantity,
            ExpireDate = request.ExpireDate,
            Status = request.Status,
            PosEnabled = request.PosEnabled,
            AutoAssemblyTemplateId = request.AutoAssemblyTemplateId,
        };

        if (request.Image != null)
            product.Image = await SaveImageAsync(request.Image);

        db.Products.Add(product);
        await db.SaveChangesAsync(ct);

        var created = await LoadProductWithNavigationsAsync(product.Id, ct);
        return mapper.Map<ProductDto>(created);
    }

    public async Task<ProductDto> UpdateAsync(int id, UpdateProductRequest request, CancellationToken ct = default)
    {
        ValidateProductRequest(request.Name, request.Sku, request.DiscountType);

        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new KeyNotFoundException("Product not found");

        if (await db.Products.AnyAsync(p => p.Sku == request.Sku.Trim() && p.Id != id, ct))
            throw new ArgumentException("A product with that SKU already exists");

        product.Name = request.Name.Trim();
        product.Sku = request.Sku.Trim();
        product.Description = request.Description?.Trim();
        product.CategoryId = request.CategoryId;
        product.BrandId = request.BrandId;
        product.UnitId = request.UnitId;
        product.Price = request.Price;
        product.Discount = request.Discount;
        product.DiscountType = string.IsNullOrWhiteSpace(request.DiscountType) ? null : request.DiscountType.Trim();
        product.PurchasePrice = request.PurchasePrice;
        product.Quantity = request.Quantity;
        product.ExpireDate = request.ExpireDate;
        product.Status = request.Status;
        product.PosEnabled = request.PosEnabled;
        product.AutoAssemblyTemplateId = request.AutoAssemblyTemplateId;
        product.UpdatedAt = DateTime.UtcNow;

        if (request.Image != null)
        {
            DeleteImageFile(product.Image);
            product.Image = await SaveImageAsync(request.Image);
        }

        await db.SaveChangesAsync(ct);

        var updated = await LoadProductWithNavigationsAsync(id, ct);
        return mapper.Map<ProductDto>(updated);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new KeyNotFoundException("Product not found");

        DeleteImageFile(product.Image);

        db.Products.Remove(product);
        await db.SaveChangesAsync(ct);
    }

    public async Task<int> BulkSetPosEnabledAsync(
        List<int> ids, bool enabled, CancellationToken ct = default)
    {
        if (ids == null || ids.Count == 0)
            throw new ArgumentException("At least one product ID is required");

        var updated = await db.Products
            .Where(p => ids.Contains(p.Id))
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.PosEnabled, enabled)
                .SetProperty(p => p.UpdatedAt, DateTime.UtcNow),
            ct);

        return updated;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static void ValidateProductRequest(string name, string sku, string? discountType)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Product name is required");

        if (string.IsNullOrWhiteSpace(sku))
            throw new ArgumentException("SKU is required");

        if (!string.IsNullOrWhiteSpace(discountType)
            && discountType != DiscountTypes.Fixed
            && discountType != DiscountTypes.Percentage)
            throw new ArgumentException("Discount type must be 'fixed' or 'percentage'");
    }

    private async Task<Product> LoadProductWithNavigationsAsync(int id, CancellationToken ct)
    {
        return await db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Brand)
            .Include(p => p.Unit)
            .FirstAsync(p => p.Id == id, ct);
    }

    private async Task<string> GenerateUniqueSlugAsync(string name, int? excludeId, CancellationToken ct)
    {
        var baseSlug = Slugify(name);
        var candidate = baseSlug;
        var counter = 1;

        while (await db.Products.AnyAsync(
            p => p.Slug == candidate && (excludeId == null || p.Id != excludeId), ct))
        {
            candidate = $"{baseSlug}-{counter++}";
        }

        return candidate;
    }

    private static string Slugify(string text)
    {
        var lower = text.Trim().ToLowerInvariant();
        var hyphenated = Regex.Replace(lower, @"\s+", "-");
        var slug = Regex.Replace(hyphenated, @"[^a-z0-9\-]", string.Empty);
        slug = Regex.Replace(slug, @"-{2,}", "-");
        return slug.Trim('-');
    }

    private async Task<string> SaveImageAsync(IFormFile file)
    {
        var uploadsDir = Path.Combine(env.WebRootPath, "media", EntityFolder);
        Directory.CreateDirectory(uploadsDir);

        var ext = Path.GetExtension(file.FileName);
        var fileName = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(uploadsDir, fileName);

        await using var stream = new FileStream(fullPath, FileMode.Create);
        await file.CopyToAsync(stream);

        return $"media/{EntityFolder}/{fileName}";
    }

    private void DeleteImageFile(string? relativePath)
    {
        if (string.IsNullOrEmpty(relativePath)) return;
        var fullPath = Path.Combine(env.WebRootPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        if (File.Exists(fullPath))
            File.Delete(fullPath);
    }
}
