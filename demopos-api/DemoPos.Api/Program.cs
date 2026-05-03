using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using DemoPos.Api.Data;
using DemoPos.Api.Mappings;
using DemoPos.Api.Middleware;
using DemoPos.Api.Services.Implementation;
using DemoPos.Api.Services.Abstraction;

var builder = WebApplication.CreateBuilder(args);

// ── CORS — restrict to configured origins ────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy
            .WithOrigins(
                builder.Configuration["Cors:AllowedOrigins"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    ?? ["https://localhost:3000"])
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
});

// ── EF Core + SQL Server ──────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── JWT Authentication ────────────────────────────────────────────────────────
// Read the signing key from an environment variable first, falling back to config.
// This keeps the secret out of appsettings.json in production deployments.
var jwtKey = Environment.GetEnvironmentVariable("DEMOPOS_JWT_KEY")
    ?? builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "JWT signing key is not configured. Set DEMOPOS_JWT_KEY environment variable.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            // ClockSkew = TimeSpan.Zero removes the default 5-minute grace window
            // so tokens expire exactly when the JWT says they do.
            ClockSkew = TimeSpan.Zero,
        };

        // Item 3: Also accept the JWT from the httpOnly "access_token" cookie so that
        // the React SPA does not need to send an Authorization header.
        // Bearer header auth continues to work — both paths are supported simultaneously.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                if (ctx.Request.Cookies.TryGetValue("access_token", out var cookieToken))
                    ctx.Token = cookieToken;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ── Rate limiting (Item 2) ─────────────────────────────────────────────────────
// "auth" policy: max 10 requests per minute per client IP, applied to auth endpoints.
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 10;
        opt.QueueLimit = 0;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            """{"success":false,"message":"Too many requests. Please wait before trying again."}""", token);
    };
});

// ── ProblemDetails (RFC 7807) ─────────────────────────────────────────────────
builder.Services.AddProblemDetails();

// ── Response compression ──────────────────────────────────────────────────────
builder.Services.AddResponseCompression(opts => opts.EnableForHttps = true);

// ── TimeProvider — injected into JwtService for testable clock access ─────────
builder.Services.AddSingleton(TimeProvider.System);

// ── AutoMapper (v13 built-in DI — no separate Extensions package needed) ─────
builder.Services.AddAutoMapper(typeof(MappingProfile));

// ── Application services ──────────────────────────────────────────────────────
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();

// Module 3 — Product & Inventory
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IBrandService, BrandService>();
builder.Services.AddScoped<IUnitService, UnitService>();
builder.Services.AddScoped<IProductService, ProductService>();

// Module 7 — Customers & Suppliers
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<ISupplierService, SupplierService>();

// Module 5 — Sales
builder.Services.AddScoped<ISaleService, SaleService>();

// Module 6 — Purchases
builder.Services.AddScoped<IPurchaseService, PurchaseService>();

// Module 4 — POS Terminal
builder.Services.AddScoped<ICartService, CartService>();

// Module 11 — Payment Methods
builder.Services.AddScoped<IPaymentMethodService, PaymentMethodService>();

// Module 9 — Reporting & Analytics
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IReportService, ReportService>();

// Module 10 — Currency Management
builder.Services.AddScoped<ICurrencyService, CurrencyService>();

// Module 11 — Settings & Configuration
builder.Services.AddScoped<ISettingService, SettingService>();

// Module 15 — Stock Assembly
builder.Services.AddScoped<IAssemblyService, AssemblyService>();

// Module 22 — Audit Log
builder.Services.AddScoped<IAuditService, AuditService>();

// Stock Bundle
builder.Services.AddScoped<IProductBundleService, ProductBundleService>();

// Restaurant R1 — Table Management
builder.Services.AddScoped<ITableService, TableService>();

// Restaurant R4 — Item Modifiers
builder.Services.AddScoped<IModifierService, ModifierService>();

// Restaurant R9 — Vouchers
builder.Services.AddScoped<IVoucherService, VoucherService>();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Serialize all JSON responses (including anonymous objects from controllers)
        // in camelCase so the React frontend can access properties without
        // manual casing conversion (e.g. item.productName, res.data?.data, etc.)
        options.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// ── Health checks ─────────────────────────────────────────────────────────────
builder.Services.AddHealthChecks();

// ── OpenAPI (native .NET 9) ───────────────────────────────────────────────────
builder.Services.AddOpenApi();

var app = builder.Build();

// ── Seed database ─────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    await SeedData.SeedAsync(db);
}

// ── Middleware pipeline (order matters) ───────────────────────────────────────
// ErrorHandlingMiddleware must be first so it wraps all subsequent middleware.
// CORS must come before UseHttpsRedirection so that OPTIONS preflight responses
// carry CORS headers even when the browser sends the preflight over HTTP.
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseResponseCompression();
app.UseCors("AllowAll");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

// UseDefaultFiles rewrites bare "/" and "/index.html" to serve the SPA shell.
// It must be registered BEFORE UseStaticFiles so the rewrite happens first.
app.UseDefaultFiles();

// Serve wwwroot/media/ for uploaded product/category/brand images
// Also serves the React SPA assets (JS/CSS/index.html) copied there at publish time.
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();
app.MapHealthChecks("/health");

// Fallback for client-side React Router routes: any request that does not
// match an API route or a static file gets served index.html so the SPA
// can handle the route itself (e.g. /sales, /pos, /dashboard, etc.)
app.MapFallbackToFile("index.html");

app.Run();
