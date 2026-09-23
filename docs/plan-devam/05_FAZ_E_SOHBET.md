# Faz E — Sohbet Yenileme

**Amaç:** Sohbeti log görünümünden gerçek mesajlaşma arayüzüne çevirmek. İşlevler (mesaj gönderme,
snap, süre dolumu, konuşma listesi) çalışıyor; eksik olan görünüm ve okunabilirlik.

Şu anki durum: mesajlar sol renkli çizgili satırlar hâlinde, gönderen adı her mesajın üstünde,
gün ayırıcı yok (dün 16:34 ile bugünün mesajları ayrımsız), okundu/yazıyor göstergesi yok.

Ayrıntılı tanım: `docs/plan/06_SCREENS_PROFILE_SOCIAL_CHAT.md` §7.

## Görevler

- [ ] **E1 — Balon UI.** Giden mesaj sağda (`accent.primarySoft` zemin, koyu metin), gelen solda
      (`bg.surfaceSunken`). Sol renkli çizgi ve "Ben / kullanıcı adı" satırı kalkar.
- [ ] **E2 — Gruplama.** Aynı kişiden ardışık mesajlar gruplanır; köşe yarıçapları grup içinde
      küçülür; zaman damgası yalnızca grubun sonunda görünür.
- [ ] **E3 — Gün ayırıcı.** Bugün / Dün / hafta içi gün adı / tarih. Mesaj listesinde tarih değişen
      her yerde ayırıcı.
- [ ] **E4 — Okundu ve yazıyor.** "Görüldü ss:dd" son giden mesajın altında; karşı taraf yazarken
      "… yazıyor" göstergesi. (Realtime atlandıysa — D-005 — yoklama ile göster ve DECISIONS'a yaz:
      hangi aralıkla, hangi ekran öndeyken.)
- [ ] **E5 — Snap balonu.** Durum dili: gönderildi ➤ · açılmadı (dolu kare) · açıldı (boş kare) ·
      süresi doldu. Şu an "Snap · Süresi doldu" düz metin satırı olarak görünüyor; balon bileşenine
      taşınır.
- [ ] **E6 — Paylaşılan sinyal balonu.** Sohbete gönderilen sinyal, küçük medya + TypeBadge + yer
      adı içeren kart olarak görünür; dokununca Sinyal Kartı açılır.
- [ ] **E7 — Mesaj eylemleri.** Uzun basma: tepki (❤️ 😂 😮 👍 🙏), yanıtla (alıntılı), kopyala,
      kendi mesajınsa geri al, bildir.
- [ ] **E8 — Konuşma listesi.** Satırda son mesaj önizlemesi + snap durumu ikonu + okunmamış noktası;
      kaydırma eylemleri (sessize al, sil). Mesaj istekleri klasörü girişi (izin dışı kişilerden
      gelenler).
- [ ] **E9 — Klavye davranışı.** Giriş alanı klavyeye yapışık, liste otomatik en alta kayar, güvenli
      alan altında kesilme olmaz.

## Kabul kriterleri (ekranda)
- Mesajlar balon olarak görünüyor; gönderen adı tekrar etmiyor.
- Dünkü ve bugünkü mesajlar arasında gün ayırıcı var.
- Son giden mesajın altında okundu bilgisi görünüyor.
- Snap'ler balon olarak ve doğru durum ikonuyla görünüyor.
- Sohbete paylaşılan sinyal kart olarak görünüyor ve dokununca açılıyor.
