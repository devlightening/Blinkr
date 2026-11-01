namespace IdentityService.Application.DTOs
{
    /// <summary>Outcome of a registration: the signed-in user, or a stable error code plus a message for the user.</summary>
    public sealed record RegisterResult(AuthResponse? Auth, string? ErrorCode = null, string? ErrorMessage = null)
    {
        public bool Succeeded => Auth is not null;

        public static RegisterResult Success(AuthResponse auth) => new(auth);
        public static RegisterResult Fail(string code, string message) => new(null, code, message);
    }
}
