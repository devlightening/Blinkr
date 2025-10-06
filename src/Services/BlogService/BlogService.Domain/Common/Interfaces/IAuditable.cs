namespace BlogService.Domain.Common.Interfaces
{
    public interface IAuditable
    {
        DateTime CreatedAt { get; set; } 

        Guid? CreatedBy { get; set; }

        DateTime? LastModifiedAt { get; set; }

        Guid? LastModifiedBy { get; set; }
    }
}
