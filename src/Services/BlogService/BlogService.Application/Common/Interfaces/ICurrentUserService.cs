namespace BlogService.Application.Common.Interfaces
{
    public interface ICurrentUserService
    {
        public Guid? UserId { get;}
        bool IsInRole(string role);
    }
}
