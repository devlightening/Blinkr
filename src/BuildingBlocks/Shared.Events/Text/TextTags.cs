using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Shared.Events.Text;

/// <summary>
/// @mentions and #hashtags in user text (V2-4, D-027). The mobile client applies the same rules (`richText.ts`), so what
/// looks like a link on screen is exactly what the server resolved.
/// <list type="bullet">
/// <item>mention: <c>@</c> + a user name (3-30 letters, digits, <c>_ . -</c>), not glued to a word or another <c>@</c>
/// (e-mail addresses are not mentions). A trailing <c>.</c> or <c>-</c> is punctuation, not part of the name.</item>
/// <item>hashtag: <c>#</c> + 2-40 letters, digits or <c>_</c> (Turkish letters included), stored folded:
/// lower case, no diacritics (<c>#AkşamKahvesi</c> = <c>#aksamkahvesi</c>).</item>
/// </list>
/// </summary>
public static class TextTags
{
    public const int MaxMentions = 10;
    public const int MaxHashtags = 10;

    private static readonly Regex MentionPattern = new(@"(?<![\p{L}\p{N}_@.])@([\p{L}\p{N}_.\-]{3,30})", RegexOptions.Compiled);
    private static readonly Regex HashtagPattern = new(@"(?<![\p{L}\p{N}_#])#([\p{L}\p{N}_]{2,40})", RegexOptions.Compiled);

    /// <summary>Distinct mentioned names in the order they appear (case-insensitive), trailing punctuation removed.</summary>
    public static IReadOnlyList<string> Mentions(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return Array.Empty<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var names = new List<string>();
        foreach (Match match in MentionPattern.Matches(text))
        {
            var name = match.Groups[1].Value.TrimEnd('.', '-');
            if (name.Length >= 3 && seen.Add(name)) names.Add(name);
        }
        return names;
    }

    /// <summary>Distinct folded hashtags in the order they appear, at most <see cref="MaxHashtags"/>.</summary>
    public static IReadOnlyList<string> Hashtags(params string?[] texts)
    {
        var tags = new List<string>();
        foreach (var text in texts)
        {
            if (string.IsNullOrWhiteSpace(text)) continue;
            foreach (Match match in HashtagPattern.Matches(text))
            {
                var tag = Fold(match.Groups[1].Value);
                if (tag.Length >= 2 && !tags.Contains(tag)) tags.Add(tag);
                if (tags.Count == MaxHashtags) return tags;
            }
        }
        return tags;
    }

    /// <summary>Lower case, Turkish letters to their ASCII base, other diacritics dropped; letters, digits and _ kept.</summary>
    public static string Fold(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var builder = new StringBuilder(text.Length);
        foreach (var raw in text.Trim().TrimStart('#').Normalize(NormalizationForm.FormD))
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
            if (char.IsLetterOrDigit(c) || c == '_') builder.Append(c);
        }
        return builder.ToString();
    }
}
