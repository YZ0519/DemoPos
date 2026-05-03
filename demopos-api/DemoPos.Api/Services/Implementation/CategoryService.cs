using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Categories;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class CategoryService(AppDbContext db, IMapper mapper, IWebHostEnvironment env) : ICategoryService
{
    private const string EntityFolder = "categories";

    public async Task<List<CategoryDto>> GetAllAsync(CancellationToken ct = default)
    {
        var categories = await db.Categories
            .AsNoTracking()
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        return mapper.Map<List<CategoryDto>>(categories);
    }

    public async Task<CategoryDto> CreateAsync(CreateCategoryRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Category name is required");

        if (await db.Categories.AnyAsync(c => c.Name == request.Name.Trim(), ct))
            throw new ArgumentException("A category with that name already exists");

        var category = new Category
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Status = request.Status,
        };

        if (request.Image != null)
            category.Image = await SaveImageAsync(request.Image);

        db.Categories.Add(category);
        await db.SaveChangesAsync(ct);

        return mapper.Map<CategoryDto>(category);
    }

    public async Task<CategoryDto> UpdateAsync(int id, UpdateCategoryRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Category name is required");

        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new KeyNotFoundException("Category not found");

        if (await db.Categories.AnyAsync(c => c.Name == request.Name.Trim() && c.Id != id, ct))
            throw new ArgumentException("A category with that name already exists");

        category.Name = request.Name.Trim();
        category.Description = request.Description?.Trim();
        category.Status = request.Status;
        category.UpdatedAt = DateTime.UtcNow;

        if (request.Image != null)
        {
            DeleteImageFile(category.Image);
            category.Image = await SaveImageAsync(request.Image);
        }

        await db.SaveChangesAsync(ct);

        return mapper.Map<CategoryDto>(category);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new KeyNotFoundException("Category not found");

        DeleteImageFile(category.Image);

        db.Categories.Remove(category);
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
