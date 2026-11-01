using System.Globalization;
using System.Text;

namespace PlaceService.Api.Application;

/// <summary>
/// Turkish-aware text folding for place search. "Şifa Eczanesi", "SIFA ECZANESİ" and "sifa eczanesi" all fold to
/// "sifa eczanesi", so people can type without Turkish characters (the usual case on a phone keyboard) and a name
/// written "Soul Mate" still meets a query typed "soulmate".
/// </summary>
public static class PlaceSearchText
{
    public const int MaxTokensPerName = 12;

    /// <summary>Lowercase ASCII words separated by single spaces; punctuation becomes a space.</summary>
    public static string Fold(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        var builder = new StringBuilder(text.Length);
        foreach (var raw in text.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(raw) == UnicodeCategory.NonSpacingMark) continue;
            var c = raw switch
            {
                'ı' or 'İ' or 'I' or 'i' => 'i',
                'ş' or 'Ş' => 's',
                'ğ' or 'Ğ' => 'g',
                'ü' or 'Ü' => 'u',
                'ö' or 'Ö' => 'o',
                'ç' or 'Ç' => 'c',
                _ => char.ToLowerInvariant(raw),
            };
            builder.Append(c is >= 'a' and <= 'z' or >= '0' and <= '9' ? c : ' ');
        }

        return string.Join(' ', builder.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    /// <summary>The words a person typed (at most six, no duplicates).</summary>
    public static string[] QueryTokens(string? query) =>
        Fold(query).Split(' ', StringSplitOptions.RemoveEmptyEntries).Distinct().Take(6).ToArray();

    /// <summary>
    /// What a stored name can be found by: each of its words plus, for multi-word names, the words joined
    /// together ("soul mate" is also found as "soulmate"). Stored lowercase and folded, so prefix matches are
    /// plain anchored regexes that a Mongo index can serve.
    /// </summary>
    public static List<string> NameTokens(string? name)
    {
        var words = Fold(name).Split(' ', StringSplitOptions.RemoveEmptyEntries).Distinct().Take(MaxTokensPerName).ToList();
        if (words.Count is > 1 and <= 6)
        {
            var joined = string.Concat(words);
            if (!words.Contains(joined)) words.Add(joined.Length > 32 ? joined[..32] : joined);
        }
        return words;
    }
}
