namespace IdentityService.Domain
{
    /// <summary>
    /// Avatars are chosen from a fixed set of drawn characters, never uploaded photos (privacy by default: nobody's
    /// face is stored). A key is three digits: colour (0-7), face (0-5), accessory (0-5). The client draws the
    /// character; the server only decides which keys exist, so an arbitrary string can never be stored.
    /// </summary>
    public static class AvatarCatalog
    {
        public const int ColorCount = 8;
        public const int FaceCount = 6;
        public const int AccessoryCount = 6;
        public const int MaxKeyLength = 3;

        public static bool IsValid(string? key) =>
            key is { Length: MaxKeyLength }
            && key[0] >= '0' && key[0] < '0' + ColorCount
            && key[1] >= '0' && key[1] < '0' + FaceCount
            && key[2] >= '0' && key[2] < '0' + AccessoryCount;
    }
}
