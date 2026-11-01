namespace PlaceService.Api.Application;

/// <summary>
/// The heat layer (D-045, after Snap Map's Explore heat): far out, the map shows where something is happening instead
/// of hundreds of pins. Built only from verified, still-active signals of the last three hours - the same window in
/// which a signal counts toward a place's live state - and grouped into a fixed grid, so panning never reshuffles the
/// cells. Aggregates only, like "Yerin Ritmi": a cell appears when at least <see cref="MinPeoplePerCell"/> different
/// people reported in it, and only a cell centre and a coarse level leave the service - never counts, places or people.
/// Pure and deterministic, like <see cref="PlaceRhythmCalculator"/>.
/// </summary>
public interface IPlaceHeatCalculator
{
    PlaceHeatDto Calculate(IReadOnlyList<PlaceHeatSource> sources, HeatBounds bounds);
}

public sealed class PlaceHeatCalculator : IPlaceHeatCalculator
{
    public static readonly TimeSpan Window = TimeSpan.FromHours(3);

    /// <summary>k-anonymity, the rhythm's rule (<see cref="PlaceRhythmCalculator.MinPeoplePerHour"/>) applied to space.</summary>
    public const int MinPeoplePerCell = PlaceRhythmCalculator.MinPeoplePerHour;

    /// <summary>Roughly this many cells across the visible area.</summary>
    public const int TargetCellsAcross = 12;

    /// <summary>
    /// Cell sizes in degrees (about 250 m to 35 km). Snapping to a fixed ladder keeps a cell the same cell while the
    /// map moves, and the smallest size stays coarse enough that a cell never stands for one building.
    /// </summary>
    public static readonly double[] CellSizes = [0.0025, 0.005, 0.01, 0.02, 0.04, 0.08, 0.16, 0.32];

    public static double CellSizeFor(HeatBounds bounds)
    {
        var span = Math.Max(bounds.MaxLat - bounds.MinLat, bounds.MaxLon - bounds.MinLon);
        // Bounds arrive as decimals that doubles cannot hold exactly (0.125 - 0.005 = 0.12000000000000455); without the
        // tolerance the same view could jump to the next size and every cell would move.
        var wanted = span / TargetCellsAcross - 1e-9;
        foreach (var size in CellSizes)
            if (size >= wanted) return size;
        return CellSizes[^1];
    }

    /// <summary>1 = a few people, 2 = lively, 3 = a lot going on. Coarse on purpose.</summary>
    public static int Level(int people) => people >= 12 ? 3 : people >= 6 ? 2 : 1;

    public PlaceHeatDto Calculate(IReadOnlyList<PlaceHeatSource> sources, HeatBounds bounds)
    {
        var cell = CellSizeFor(bounds);
        var cells = sources
            .Where(s => s.Latitude >= bounds.MinLat && s.Latitude <= bounds.MaxLat && s.Longitude >= bounds.MinLon && s.Longitude <= bounds.MaxLon)
            .GroupBy(s => (Row: (long)Math.Floor(s.Latitude / cell), Col: (long)Math.Floor(s.Longitude / cell)))
            .Select(g => (g.Key.Row, g.Key.Col, People: g.Select(s => s.Who).Distinct().Count()))
            .Where(c => c.People >= MinPeoplePerCell)
            .OrderBy(c => c.Row).ThenBy(c => c.Col)
            .Select(c => new PlaceHeatCellDto(Math.Round((c.Row + 0.5) * cell, 5), Math.Round((c.Col + 0.5) * cell, 5), Level(c.People)))
            .ToList();
        return new PlaceHeatDto(cell, cells);
    }
}

public sealed record HeatBounds(double MinLat, double MinLon, double MaxLat, double MaxLon);

/// <param name="Who">The author id, or the post id for older events without one: one voice per person per cell.</param>
public sealed record PlaceHeatSource(double Latitude, double Longitude, string Who);

/// <param name="CellDegrees">Cell edge in degrees; the app sizes each circle from it.</param>
public sealed record PlaceHeatDto(double CellDegrees, IReadOnlyList<PlaceHeatCellDto> Cells);

/// <param name="Level">1..3, see <see cref="PlaceHeatCalculator.Level"/>.</param>
public sealed record PlaceHeatCellDto(double Latitude, double Longitude, int Level);
