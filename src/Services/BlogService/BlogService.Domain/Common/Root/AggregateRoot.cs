using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Entities;
using System.Reflection;

namespace BlogService.Domain.Common.Root
{
    public abstract class AggregateRoot : BaseEntity, IAggregateRoot
    {
        public int Version { get; protected set; } = -1;

        // Kaydedilmemiş event'ler listesi
        private readonly List<IDomainEvent> _uncommittedEvents = new();
        public IReadOnlyList<IDomainEvent> GetUncommittedEvents() => _uncommittedEvents.AsReadOnly();

        // Olayları (events) kaydetmek için
        public void MarkEventsAsCommitted()
        {
            _uncommittedEvents.Clear();  // Olaylar kaydedildiği için temizleniyor
        }

        // Geçmiş olaylardan Aggregate'ı oluşturma (LoadFromHistory)
        public void LoadFromHistory(IEnumerable<IDomainEvent> history)
        {
            if (history == null || !history.Any()) return;

            var currentVersion = -1;
            foreach (var @event in history)
            {
                ApplyEvent(@event, ++currentVersion);  // Her olayı sırayla uygula
            }
        }

        // Olayları işleyip state'i güncelleme metodu
        public void ApplyEvent(IDomainEvent @event, int version)
        {
            // Her event için ilgili Apply metodunu buluyoruz
            var applyMethod = GetType().GetMethod("Apply", BindingFlags.NonPublic | BindingFlags.Instance, null, new[] { @event.GetType() }, null);
            if (applyMethod == null)
            {
                throw new InvalidOperationException($"'{GetType().Name}' içinde '{@event.GetType().Name}' için Apply metodu bulunamadı.");
            }

            // Apply metodunu çağırıyoruz
            applyMethod.Invoke(this, new object[] { @event });

            // Olayı versiyon numarasıyla birlikte işledik
            Version = version;
        }

        // Olayları kaydederken, new event'leri ekleyip işleme
        protected void ApplyNewEvent(IDomainEvent @event)
        {
            ApplyEvent(@event, Version + 1);  // Version'ı artırarak uygulama
            _uncommittedEvents.Add(@event);   // Yeni olayları kaydetme
        }
    }
}
