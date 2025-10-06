using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Domain.Common.Interfaces
{
    public interface IHasDomainEvent
    {
        // Okuma amaçlı event koleksiyonu
        IReadOnlyCollection<IDomainEvent> DomainEvents { get; }

        // Event ekleme metodu
        void AddDomainEvent(IDomainEvent domainEvent);

        // Eventleri temizleme metodu (DbContext'in kullanması için)
        void ClearDomainEvents();
    }
}
