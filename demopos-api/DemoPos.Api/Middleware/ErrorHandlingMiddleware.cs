using System.Net;
using System.Runtime.ExceptionServices;
using System.Text.Json;

namespace DemoPos.Api.Middleware;

/// <summary>
/// Global exception handler that converts known exception types into consistent
/// JSON error responses without leaking stack traces to the client.
/// </summary>
public class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    // Allocate once and reuse — JsonSerializerOptions is thread-safe after construction.
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client disconnected — not a server error; do not log as an error.
            // Let ASP.NET Core handle the connection reset silently.
            context.Response.StatusCode = 499; // Nginx convention: "Client Closed Request"
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception for {Method} {Path}: {Message}",
                context.Request.Method, context.Request.Path, ex.Message);

            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        // Do not attempt to write if the response has already started streaming.
        if (context.Response.HasStarted)
            return;

        context.Response.ContentType = "application/json";

        var (statusCode, message) = ex switch
        {
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized, ex.Message),
            KeyNotFoundException        => (HttpStatusCode.NotFound,     ex.Message),
            ArgumentException           => (HttpStatusCode.BadRequest,   ex.Message),
            InvalidOperationException   => (HttpStatusCode.BadRequest,   ex.Message),
            _                           => (HttpStatusCode.InternalServerError, "An unexpected error occurred"),
        };

        context.Response.StatusCode = (int)statusCode;

        var response = new
        {
            success = false,
            message,
            errors = new { },
        };

        await context.Response.WriteAsync(
            JsonSerializer.Serialize(response, SerializerOptions));
    }
}
