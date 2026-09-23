using System.Security.Claims;

namespace Shared.Moderation;

/// <summary>
/// Accounts created by the smoke/acceptance scripts all start with <see cref="Prefix"/> (plan-devam Faz A1). In a
/// development stack (config <c>TestAccounts:Hide</c> = true) their people and signals are left out of Keşfet, the map
/// and people search for everyone except other test accounts, so the scripts still see what they create while a
/// person testing the app by hand only sees real and demo data. <c>scripts/cleanup-test-data.cjs</c> removes them.
/// </summary>
public static class TestAccounts
{
    public const string Prefix = "e2e_";
    public const string HideSetting = "TestAccounts:Hide";
    /// <summary>Scripts written before the prefix named users label_timestamp or label_hex (e.g. tf_a_1790169633).</summary>
    public const string LegacyPattern = "^[a-z][a-z0-9_.-]*?([0-9]{10,14}|_[0-9a-f]{12})$";
    private static readonly System.Text.RegularExpressions.Regex Legacy = new(LegacyPattern, System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    public static bool IsTestName(string? userName) =>
        userName is not null && (userName.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase) || Legacy.IsMatch(userName));

    /// <summary>True when test content should be hidden from this viewer.</summary>
    public static bool HideFrom(ClaimsPrincipal viewer, bool enabled) =>
        enabled && !IsTestName(viewer.FindFirst("preferred_username")?.Value ?? viewer.FindFirst("username")?.Value);
}
