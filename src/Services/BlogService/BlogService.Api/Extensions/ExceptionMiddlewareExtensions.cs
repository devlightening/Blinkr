using BlogService.Api.Middlewares;


public static class ExceptionMiddlewareExtensions
{
    public static IApplicationBuilder UseGlobalException(this IApplicationBuilder app)
        => app.UseMiddleware<ExceptionMiddleware>();
}
