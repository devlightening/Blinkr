namespace NotificationsService.Infrastructure.Config;

public class MongoOptions
{
    public string ConnectionString { get; set; } = "mongodb://localhost:27017";
    public string Database { get; set; } = "blinkr_notifications";
}

public class RabbitOptions
{
    public string HostName { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string UserName { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string Exchange { get; set; } = "blinkr.events";
    public string QueueName { get; set; } = "notifications.worker";
}

public class FcmOptions
{
    public string? CredentialsPath { get; set; }
}