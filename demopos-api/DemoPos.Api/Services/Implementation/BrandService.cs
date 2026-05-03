using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Brands;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class BrandService(AppDbContext db, IMapper mapper, IWebHostEnvironment env) : IBrandService
{
    private const string EntityFolder = "brands";

    public async Task<List<BrandDto>> GetAllAsync(CancellationToken ct = default)
    {
        var brands = await db.Brands
            .AsNoTracking()
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(ct);

        return mapper.Map<List<BrandDto>>(brands);
    }

    public async Task<BrandDto> CreateAsync(CreateBrandRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Brand name is required");

        if (await db.Brands.AnyAsync(b => b.Name == request.Name.Trim(), ct))
            throw new ArgumentException("A brand with that name already exists");

        var brand = new Brand
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Status = request.Status,
        };

        if (request.Image != null)
            brand.Image = await SaveImageAsync(request.Image);

        db.Brands.Add(brand);
        await db.SaveChangesAsync(ct);

        return mapper.Map<BrandDto>(brand);
    }

    public async Task<BrandDto> UpdateAsync(int id, UpdateBrandRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Brand name is required");

        var brand = await db.Brands.FirstOrDefaultAsync(b => b.Id == id, ct)
            ?? throw new KeyNotFoundException("Brand not found");

        if (await db.Brands.AnyAsync(b => b.Name == request.Name.Trim() && b.Id != id, ct))
            throw new ArgumentException("A brand with that name already exists");

        brand.Name = request.Name.Trim();
        brand.Description = request.Description?.Trim();
        brand.Status = request.Status;
        brand.UpdatedAt = DateTime.UtcNow;

        if (request.Image != null)
        {
            DeleteImageFile(brand.Image);
            brand.Image = await SaveImageAsync(request.Image);
        }

        await db.SaveChangesAsync(ct);

        return mapper.Map<BrandDto>(brand);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var brand = await db.Brands.FirstOrDefaultAsync(b => b.Id == id, ct)
            ?? throw new KeyNotFoundException("Brand not found");

        DeleteImageFile(brand.Image);

        db.Brands.Remove(brand);
        await db.SaveChangesAsync(ct);
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
