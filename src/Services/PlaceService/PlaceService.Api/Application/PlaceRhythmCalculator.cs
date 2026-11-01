using PlaceService.Api.Domain;

namespace PlaceService.Api.Application;

/// <summary>
/// "Yerin Ritmi" (D-037): how busy a place usually is by weekday and hour, built only from Blinkr's own verified
/// observations - never from passive location tracking. Pure and deterministic, like <see cref="CurrentPlaceStateCalculator"/>.
/// </summary>
public interface IPlaceRhythmCalculator
{
    PlaceRhythmDto Calculate(IReadOnlyList<PlaceSignalDocument> signals, DateTime nowUtc);
}

public sealed class PlaceRhythmCalculator : IPlaceRhythmCalculator
{
    /// <summary>History window: eight weeks, so a habit shows and a one-off event fades.</summary>
    public static readonly TimeSpan Window = TimeSpan.FromDays(56);

    /// <summary>
    /// k-anonymity: an hour is shown only when at least this many different people reported in it. Otherwise one
    /// person's routine ("every Monday 08:00 at this gym") could be read off the chart.
    /// </summary>
    public const int MinPeoplePerHour = 3;

    /// <summary>Below this many usable observations in total the place has no rhythm yet ("henüz yeterli veri yok").</summary>
    public const int MinObservations = 8;

    /// <summary>Hours a person can plausibly visit; the chart is 06:00-23:00.</summary>
    public const int FirstHour = 6;
    public const int LastHour = 23;

    // Turkey has no DST (UTC+3 all year); the named zone is used when the host knows it.
    private static readonly TimeZoneInfo Turkey = ResolveTurkey();

    /// <summary>
    /// Crowd and Queue answers on one 0..1 "busyness" scale; any other value is not used. Case-insensitive: the app
    /// sends "Busy", older clients and seeds "BUSY", and the legacy "EMPTY" (calm) / "LONG" (long line) still appear.
    /// </summary>
    public static double? Busyness(string signalType, string? value) => (signalType, value?.Trim().ToUpperInvariant()) switch
    {
        ("Crowd", "CALM" or "EMPTY") => 0.0,
        ("Crowd", "MODERATE") => 0.5,
        ("Crowd", "BUSY") => 1.0,
        ("Queue", "NONE") => 0.0,
        ("Queue", "5TO15") => 0.5,
        ("Queue", "OVER15" or "LONG") => 1.0,
        _ => null,
    };

    public PlaceRhythmDto Calculate(IReadOnlyList<PlaceSignalDocument> signals, DateTime nowUtc)
    {
        var since = nowUtc - Window;
        var observations = signals
            .Where(s => s.PublicationTrust == "VERIFIED_LIVE" && s.CreatedAtUtc >= since && s.CreatedAtUtc <= nowUtc)
            .Select(s => (Signal: s, Value: Busyness(s.SignalType, s.SignalValue), Local: TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(s.CreatedAtUtc, DateTimeKind.Utc), Turkey)))
            .Where(o => o.Value.HasValue)
            // One voice per person per day and hour: re-confirming the same moment does not weigh more.
            .GroupBy(o => (Who: o.Signal.AuthorId?.ToString() ?? o.Signal.PostId.ToString(), Day: o.Local.Date, Hour: o.Local.Hour))
            .Select(g => (g.Key.Who, Weekday: (int)g.Key.Day.DayOfWeek, g.Key.Hour, Value: g.Average(o => o.Value!.Value)))
            .ToList();

        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc), Turkey);
        var days = Enumerable.Range(0, 7).Select(weekday => new PlaceRhythmDayDto(
            weekday,
            Enumerable.Range(FirstHour, LastHour - FirstHour + 1).Select(hour =>
            {
                var bucket = observations.Where(o => o.Weekday == weekday && o.Hour == hour).ToList();
                var people = bucket.Select(o => o.Who).Distinct().Count();
                return people >= MinPeoplePerHour
                    ? new PlaceRhythmHourDto(hour, Math.Round(bucket.Average(o => o.Value), 2))
                    : new PlaceRhythmHourDto(hour, null);
            }).ToList())).ToList();

        var shownHours = days.Sum(d => d.Hours.Count(h => h.Level.HasValue));
        var enough = observations.Count >= MinObservations && shownHours > 0;
        return new PlaceRhythmDto(
            enough,
            observations.Count,
            (int)localNow.DayOfWeek,
            localNow.Hour,
            enough ? days : Array.Empty<PlaceRhythmDayDto>());
    }

    private static TimeZoneInfo ResolveTurkey()
    {
        foreach (var id in new[] { "Europe/Istanbul", "Turkey Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); } catch (TimeZoneNotFoundException) { } catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.CreateCustomTimeZone("UTC+3", TimeSpan.FromHours(3), "UTC+3", "UTC+3");
    }
}

/// <param name="Enough">False until the place has enough verified history; the app then says so instead of guessing.</param>
/// <param name="Observations">Usable observations in the window (after one-voice-per-person-hour), for "N gözleme dayanır".</param>
/// <param name="Today">Weekday in Turkey time, 0 = Sunday (same as JavaScript's getDay()).</param>
/// <param name="CurrentHour">Hour in Turkey time.</param>
public sealed record PlaceRhythmDto(bool Enough, int Observations, int Today, int CurrentHour, IReadOnlyList<PlaceRhythmDayDto> Days);

public sealed record PlaceRhythmDayDto(int Weekday, IReadOnlyList<PlaceRhythmHourDto> Hours);

/// <param name="Level">0 (sakin) .. 1 (kalabalık); null when too few different people reported in that hour.</param>
public sealed record PlaceRhythmHourDto(int Hour, double? Level);
