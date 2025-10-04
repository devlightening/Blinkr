using Microsoft.AspNetCore.Authorization;

namespace BlogService.Api.Auth
{
    public class OwnerOrAdminRequirement : IAuthorizationRequirement
    {
        public Guid AuthorId { get; }
        public OwnerOrAdminRequirement(Guid authorId)
        {
            AuthorId = authorId;
        }
    }

}
    