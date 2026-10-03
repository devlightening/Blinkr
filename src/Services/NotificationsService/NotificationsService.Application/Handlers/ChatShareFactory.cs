using NotificationsService.Application.Commands;
using NotificationsService.Application.Exceptions;
using NotificationsService.Domain.Entities;

namespace NotificationsService.Application.Handlers;

/// <summary>
/// Turns what a client asks to share (a signal, a place) into the stored payload: required ids checked, every display
/// field trimmed and capped. One place for these rules, so the send handler only decides what kind of message it is.
/// </summary>
public static class ChatShareFactory
{
    public const string TextKind = "text";
    public const string SignalKind = "signal";
    public const string PlaceKind = "place";

    public static string? Clip(string? value, int max)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed.Length <= max ? trimmed : trimmed[..max];
    }

    public static SignalSharePayload? Signal(SignalShareInput? input)
    {
        if (input is null) return null;
        if (input.PostId == Guid.Empty) throw new ChatValidationException("Paylaşılan sinyal seçilemedi.");
        return new SignalSharePayload
        {
            PostId = input.PostId,
            SignalType = Clip(input.SignalType, 40) ?? "GeneralObservation",
            SignalValue = Clip(input.SignalValue, 40),
            Title = Clip(input.Title, 120),
            LocationName = Clip(input.LocationName, 120),
        };
    }

    public static PlaceSharePayload? Place(PlaceShareInput? input)
    {
        if (input is null) return null;
        var name = Clip(input.Name, 120);
        if (input.PlaceId == Guid.Empty || name is null) throw new ChatValidationException("Paylaşılan yer seçilemedi.");
        return new PlaceSharePayload { PlaceId = input.PlaceId, Name = name, Category = Clip(input.Category, 40) };
    }

    /// <summary>The kind of a new message; a message shares at most one thing.</summary>
    public static string KindOf(SignalSharePayload? signal, PlaceSharePayload? place)
    {
        if (signal is not null && place is not null) throw new ChatValidationException("Bir mesaj tek bir şey paylaşabilir.");
        return signal is not null ? SignalKind : place is not null ? PlaceKind : TextKind;
    }

    /// <summary>The conversation list line: the sender's note if any, otherwise what was shared.</summary>
    public static string Preview(string kind, string text) =>
        !string.IsNullOrEmpty(text) ? text : kind switch
        {
            SignalKind => "Sinyal paylaştı",
            PlaceKind => "Yer paylaştı",
            _ => text,
        };

    /// <summary>What a quote of this message shows (at most 120 characters).</summary>
    public static string QuoteText(ChatMessage quoted) => quoted.Kind switch
    {
        "snap" or "unsent" => string.Empty,
        SignalKind => Clip(quoted.Signal?.Title ?? quoted.Text, 120) ?? string.Empty,
        PlaceKind => Clip(quoted.Place?.Name ?? quoted.Text, 120) ?? string.Empty,
        _ => Clip(quoted.Text, 120) ?? string.Empty,
    };
}
