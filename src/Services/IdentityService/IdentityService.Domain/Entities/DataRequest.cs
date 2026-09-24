namespace IdentityService.Domain.Entities
{
    /// <summary>
    /// "Verilerimi iste" (plan-devam F4): a request for a copy of one's data. The MVP only records it; the copy is
    /// prepared by hand and sent from the support address (D-021). One open request per 30 days.
    /// </summary>
    public class DataRequest
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        /// <summary>received | sent</summary>
        public string Status { get; set; } = "received";
    }
}
