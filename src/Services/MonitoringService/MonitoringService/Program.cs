var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecksUI()
    .AddSqlServerStorage(builder.Configuration.GetConnectionString("SQLServer"));

var app = builder.Build();

app.UseHealthChecksUI(options =>
{
    options.UIPath = "/health-ui";
    options.AddCustomStylesheet("health-checks-ui.css");
});

app.UseHttpsRedirection();

app.Run();
