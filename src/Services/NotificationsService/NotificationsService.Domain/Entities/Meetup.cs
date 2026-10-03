using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace NotificationsService.Domain.Entities;

/// <summary>
/// "Buluşalım" (design doc B2): a proposal to meet at a catalog place at a time, sent as a chat message of kind
/// "meetup" whose place is the message's <see cref="ChatMessage.Place"/>. It carries a place and a time only - never
/// anyone's position - and the other person answers "going" or "declined". Rules live here, not in the handlers.
/// </summary>
public class MeetupPayload
{
    /// <summary>A proposal may be a little in the past (clock drift, "now") but not more.</summary>
    public static readonly TimeSpan PastTolerance = TimeSpan.FromMinutes(5);
    /// <summary>How far ahead a meetup may be proposed.</summary>
    public static readonly TimeSpan MaxAhead = TimeSpan.FromDays(14);
    /// <summary>After this long past the time, answers are closed and the card reads "geçti".</summary>
    public static readonly TimeSpan OpenAfterStart = TimeSpan.FromHours(2);

    public const string Going = "going";
    public const string Declined = "declined";

    public DateTime AtUtc { get; set; }

    public List<MeetupResponse> Responses { get; set; } = new();

    public static bool IsValidTime(DateTime atUtc, DateTime nowUtc) =>
        atUtc >= nowUtc - PastTolerance && atUtc <= nowUtc + MaxAhead;

    public static MeetupPayload Create(DateTime atUtc, DateTime nowUtc)
    {
        var at = DateTime.SpecifyKind(atUtc, DateTimeKind.Utc);
        if (!IsValidTime(at, nowUtc)) throw new ArgumentOutOfRangeException(nameof(atUtc), "Meetup time is outside the allowed window.");
        return new MeetupPayload { AtUtc = at };
    }

    public bool IsClosed(DateTime nowUtc) => nowUtc > AtUtc + OpenAfterStart;

    public static bool IsAnswer(string? answer) => answer is Going or Declined;

    /// <summary>Sets (or with null clears) one person's answer; the latest answer replaces an earlier one.</summary>
    public void Respond(Guid userId, string? answer, DateTime nowUtc)
    {
        Responses = Responses.Where(r => r.UserId != userId).ToList();
        if (answer is not null) Responses.Add(new MeetupResponse { UserId = userId, Answer = answer, AtUtc = nowUtc });
    }
}

public class MeetupResponse
{
    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }
    public string Answer { get; set; } = MeetupPayload.Going;
    public DateTime AtUtc { get; set; }
}
