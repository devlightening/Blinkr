using System.Text;
using System.Text.RegularExpressions;

namespace Shared.Moderation;

/// <summary>How a piece of user text is treated (sinyal-mvp-plan 11 §4).</summary>
public enum TextVerdict
{
    /// <summary>Nothing found.</summary>
    Clean,
    /// <summary>Light swearing: published, but ranked lower and labelled "Hassas içerik" in feeds.</summary>
    Mild,
    /// <summary>Threat, hate or a targeted insult: refused with 422 <see cref="ContentTextFilter.BlockedCode"/>.</summary>
    Blocked,
}

/// <param name="Verdict">What the filter decided.</param>
/// <param name="Text">The text to store: national ID numbers and number plates masked.</param>
/// <param name="Masked">True when something was masked.</param>
public sealed record TextReview(TextVerdict Verdict, string Text, bool Masked);

/// <summary>
/// Synchronous text filter for user content (sinyal-mvp-plan Faz 10 P10.1). Text is normalised before matching so
/// Turkish letters, leetspeak, repeated letters and s.p.a.c.e.d letters do not slip through (ı→i, ş→s, 0→o, 1→i,
/// @→a …). Terms are whole words (a long term also matches with a suffix: "siktirin"). Personal data: Turkish
/// national ID numbers (checksum-valid) and number plates are masked in public text; phone numbers and addresses are
/// only warned about in the app. The word lists are a starting point and need a native-speaker review (D-014).
/// </summary>
public static class ContentTextFilter
{
    public const string BlockedCode = "CONTENT_BLOCKED";
    public const char MaskChar = '•';

    // Normalised forms (see Normalize). Multi-word entries are phrases.
    private static readonly string[] BlockedTerms =
    {
        // Threats (tr)
        "oldurecegim", "oldururum", "gebertecegim", "seni oldur", "adresini biliyorum", "kendini oldur",
        "canini alacagim",
        // Targeted insults (tr)
        "anani sikeyim", "anani sikerim", "orospu cocugu", "orospu evladi", "sikerim seni", "seni sikerim",
        "pic kurusu", "bacini sikeyim",
        // Hate (tr): "pis <group>" and slurs
        "pis kurt", "pis suriyeli", "pis arap", "pis ermeni", "pis yahudi", "pis rum", "pis cingene", "pis afgan",
        "pis gavur", "ibne", "gavat",
        // Threats and hate (en)
        "i will kill you", "ill kill you", "im going to kill you", "gonna kill you", "kill yourself", "kys",
        "i know where you live", "go die", "nigger", "nigga", "faggot", "kike", "retard",
    };

    private static readonly string[] MildTerms =
    {
        // tr
        "amk", "aq", "amq", "amina", "siktir", "hassiktir", "sikeyim", "sikim", "sikik", "yarrak", "yarak", "orospu",
        "yavsak", "serefsiz", "pezevenk", "kahpe", "salak", "aptal", "gerizekali", "dangalak", "bok", "boktan",
        // en
        "fuck", "fucking", "fucked", "shit", "bitch", "asshole", "bastard", "dick", "wtf", "crap", "damn",
    };

    private static readonly (string[] Words, bool Prefix)[] Blocked = Prepare(BlockedTerms);
    private static readonly (string[] Words, bool Prefix)[] Mild = Prepare(MildTerms);

    // TC kimlik no: 11 digits, first not 0 (checksum verified below).
    private static readonly Regex NationalId = new(@"(?<!\d)[1-9]\d{10}(?!\d)", RegexOptions.CultureInvariant);
    // Turkish plates: province 01-81, then 1 letter + 4-5 digits, 2 letters + 3-4 digits or 3 letters + 2-3 digits.
    private static readonly Regex Plate = new(
        @"(?<![\p{L}\d])(0[1-9]|[1-7]\d|8[01])\s?([A-Z]\s?\d{4,5}|[A-Z]{2}\s?\d{3,4}|[A-Z]{3}\s?\d{2,3})(?![\p{L}\d])",
        RegexOptions.CultureInvariant);

    /// <summary>Reviews and masks one text. Null or empty is clean.</summary>
    public static TextReview Review(string? text, bool maskPersonalData = true)
    {
        if (string.IsNullOrWhiteSpace(text)) return new TextReview(TextVerdict.Clean, text ?? string.Empty, false);
        var tokens = Tokens(text);
        var verdict = Matches(tokens, Blocked) ? TextVerdict.Blocked
            : Matches(tokens, Mild) ? TextVerdict.Mild
            : TextVerdict.Clean;
        if (!maskPersonalData) return new TextReview(verdict, text, false);
        var masked = MaskPersonalData(text);
        return new TextReview(verdict, masked, masked != text);
    }

    /// <summary>Reviews several fields together (title + body): the worst verdict wins, each field masked on its own.</summary>
    public static (TextVerdict Verdict, string?[] Texts) ReviewAll(params string?[] texts)
    {
        var verdict = TextVerdict.Clean;
        var result = new string?[texts.Length];
        for (var i = 0; i < texts.Length; i++)
        {
            if (texts[i] is null) continue;
            var review = Review(texts[i]);
            if (review.Verdict > verdict) verdict = review.Verdict;
            result[i] = review.Text;
        }
        return (verdict, result);
    }

    /// <summary>True for light swearing (or worse) - used to rank and label feed items at read time.</summary>
    public static bool IsSensitive(params string?[] texts) =>
        texts.Any(t => !string.IsNullOrWhiteSpace(t) && Review(t, maskPersonalData: false).Verdict != TextVerdict.Clean);

    public static string MaskPersonalData(string text)
    {
        var result = NationalId.Replace(text, m => IsValidNationalId(m.Value) ? new string(MaskChar, m.Value.Length) : m.Value);
        result = Plate.Replace(result, m =>
        {
            var province = m.Groups[1].Value;
            var rest = m.Value[province.Length..];
            var sb = new StringBuilder(province);
            foreach (var c in rest) sb.Append(char.IsWhiteSpace(c) ? c : MaskChar);
            return sb.ToString();
        });
        return result;
    }

    public static bool IsValidNationalId(string value)
    {
        if (value.Length != 11 || value[0] == '0' || !value.All(char.IsAsciiDigit)) return false;
        var d = value.Select(c => c - '0').ToArray();
        var odd = d[0] + d[2] + d[4] + d[6] + d[8];
        var even = d[1] + d[3] + d[5] + d[7];
        var tenth = ((odd * 7 - even) % 10 + 10) % 10;
        if (tenth != d[9]) return false;
        return d.Take(10).Sum() % 10 == d[10];
    }

    /// <summary>Lower case, Turkish letters folded, leetspeak mapped, everything else a space, repeated letters collapsed.</summary>
    public static string Normalize(string text)
    {
        var sb = new StringBuilder(text.Length);
        foreach (var raw in text)
        {
            var c = raw switch
            {
                'İ' or 'I' or 'ı' or 'î' or 'Î' => 'i',
                'Ş' or 'ş' => 's',
                'Ğ' or 'ğ' => 'g',
                'Ü' or 'ü' or 'û' or 'Û' => 'u',
                'Ö' or 'ö' => 'o',
                'Ç' or 'ç' => 'c',
                'Â' or 'â' => 'a',
                '0' => 'o',
                '1' => 'i',
                '3' => 'e',
                '4' or '@' => 'a',
                '5' or '$' => 's',
                '7' => 't',
                _ => char.ToLowerInvariant(raw),
            };
            if (c is >= 'a' and <= 'z') { if (sb.Length == 0 || sb[^1] != c) sb.Append(c); }
            else if (sb.Length > 0 && sb[^1] != ' ') sb.Append(' ');
        }
        return sb.ToString().Trim();
    }

    /// <summary>Normalised words; runs of single letters ("s i k t i r", "s.i.k.t.i.r") are joined back into one word.</summary>
    private static List<string> Tokens(string text)
    {
        var words = Normalize(text).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var tokens = new List<string>(words.Length);
        var run = new StringBuilder();
        foreach (var w in words)
        {
            if (w.Length == 1) { run.Append(w); continue; }
            if (run.Length > 0) { tokens.Add(run.Length > 2 ? Collapse(run.ToString()) : run.ToString()); run.Clear(); }
            tokens.Add(w);
        }
        if (run.Length > 0) tokens.Add(run.Length > 2 ? Collapse(run.ToString()) : run.ToString());
        return tokens;
    }

    private static string Collapse(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var c in s) if (sb.Length == 0 || sb[^1] != c) sb.Append(c);
        return sb.ToString();
    }

    private static (string[] Words, bool Prefix)[] Prepare(IEnumerable<string> terms) => terms
        .Select(Normalize)
        .Where(t => t.Length > 0)
        .Distinct()
        // A long last word also matches with a Turkish suffix ("siktirin", "oldurecegimi"); short ones must be exact.
        .Select(t => (t.Split(' '), t.Split(' ')[^1].Length >= 5))
        .ToArray();

    private static bool Matches(List<string> tokens, (string[] Words, bool Prefix)[] terms)
    {
        foreach (var (words, prefix) in terms)
        {
            for (var i = 0; i + words.Length <= tokens.Count; i++)
            {
                var ok = true;
                for (var j = 0; j < words.Length && ok; j++)
                {
                    var last = j == words.Length - 1;
                    ok = last && prefix ? tokens[i + j].StartsWith(words[j], StringComparison.Ordinal) : tokens[i + j] == words[j];
                }
                if (ok) return true;
            }
        }
        return false;
    }
}
