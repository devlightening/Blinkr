namespace IdentityService.Domain.Entities
{
    /// <summary>
    /// Age from a birth year alone (plan-devam F5). Without the birthday the youngest possible age is used, so a child is
    /// never let in or treated as an adult a year early.
    /// </summary>
    public static class AgeRules
    {
        public const int MinimumAge = 13;
        public const int AdultAge = 18;

        public static int YoungestAge(int birthYear, int thisYear) => thisYear - birthYear - 1;
        public static bool IsMinor(int birthYear, int thisYear) => YoungestAge(birthYear, thisYear) < AdultAge;
        public static bool IsMinor(int? birthYear) => birthYear is { } year && IsMinor(year, DateTime.UtcNow.Year);
    }
}
