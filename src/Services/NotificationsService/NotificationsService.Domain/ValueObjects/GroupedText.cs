namespace NotificationsService.Domain.ValueObjects;

/// <summary>V2-7 (D-029): the text of a grouped notification, newest names first.</summary>
public static class GroupedText
{
    /// <summary>"ayse gönderine tepki verdi" / "ayse ve mert ..." / "ayse, mert ve 3 kişi daha ...".</summary>
    public static string Of(IReadOnlyList<string> names, int count, string verb)
    {
        var shown = names.Where(n => !string.IsNullOrWhiteSpace(n)).ToList();
        if (shown.Count == 0) return count <= 1 ? $"Biri {verb}" : $"{count} kişi {verb}";
        if (count <= 1 || shown.Count == 1 && count == 1) return $"{shown[0]} {verb}";
        if (count == 2 && shown.Count >= 2) return $"{shown[0]} ve {shown[1]} {verb}";
        if (shown.Count == 1) return $"{shown[0]} ve {count - 1} kişi daha {verb}";
        return $"{shown[0]}, {shown[1]} ve {count - 2} kişi daha {verb}";
    }
}
