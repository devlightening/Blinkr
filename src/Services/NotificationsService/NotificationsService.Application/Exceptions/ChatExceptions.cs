namespace NotificationsService.Application.Exceptions;

/// <summary>
/// Expected, user-facing chat failures. The API layer maps each type to an HTTP status;
/// anything that is not a <see cref="ChatException"/> remains a genuine server error.
/// </summary>
public abstract class ChatException : Exception
{
    public string Code { get; }

    protected ChatException(string code, string message) : base(message) => Code = code;
}

public sealed class ChatValidationException : ChatException
{
    public ChatValidationException(string message) : base("CHAT_INVALID_REQUEST", message) { }
}

public sealed class ChatForbiddenException : ChatException
{
    public ChatForbiddenException(string message) : base("CHAT_FORBIDDEN", message) { }
}

public sealed class ChatNotFoundException : ChatException
{
    public ChatNotFoundException(string message) : base("CHAT_CONVERSATION_NOT_FOUND", message) { }
}
