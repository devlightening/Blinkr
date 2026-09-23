# Faz F — Faz 10 Kalanları (güvenlik, gizlilik, hukuk)

Faz 10'un yarısı bitti: metin filtresi (P10.1), raporlar ve yaptırımlar (P10.3/P10.4), log gizliliği
(P10.8), yetkilendirme testleri (P10.9). Görsel moderasyon (P10.2) ücretli anahtar gerektirdiği için
ertelendi (D-015). Kalanlar:

- [ ] **F1 — Destek ve itiraz adresi (engelleyici).** Projede gerçek bir destek adresi yok ve
      **uydurulmayacak**. Kullanıcıya sor: itiraz/destek için hangi e-posta kullanılacak?
      Cevap gelene kadar metinlerde `{{DESTEK_EPOSTA}}` yer tutucusu kalsın, ekranda "yakında"
      yerine açıkça belirtilmesin; DECISIONS'a D-016 olarak yaz. App Store UGC kuralı uygulama
      içinde iletişim bilgisi ister, bu yüzden yayından önce mutlaka doldurulmalı.
- [ ] **F2 — P10.10 Yasal metin ekranları.** Ayarlar > Hakkında altında: Topluluk kuralları,
      Kullanım şartları, Gizlilik politikası. Metinler yer tutucu + her ekranın başında
      "Bu metin taslaktır, hukuki inceleme gerekir" notu. i18n tr + en. Yaptırım bildirimlerine
      itiraz yolu buradan bağlanır (F1'e bağımlı).
- [ ] **F3 — P10.7 Hesap silme.** İki adım onay → 30 gün bekleme → purge işi → bu süre içinde
      girişte "Geri al" seçeneği. Kapsam eksiksiz olmalı (kök CLAUDE.md §20.1 "yarım silme yok"):
      Identity (hesap), Blog (sinyaller → PostDeleted), Notifications (sohbet "Silinmiş kullanıcı",
      snap/hikâye medyası), Place (yer durumuna katkıları), medya deposu. Yapılamayan kısım varsa
      DECISIONS'a yaz ve kullanıcıya bildir.
- [ ] **F4 — Veri indirme talebi.** Ayarlar > Hesap altında talep kaydı (MVP'de otomatik ZIP yok);
      talep bir kayda düşer ve F1'deki adrese bildirim gider.
- [ ] **F5 — P10.6 18 yaş altı varsayılanları.** Bugün doğum yılı toplanmıyor. İki seçenek:
      (a) Kayıt akışına doğum yılı ekle (13 yaş altı kayıt olamaz) ve 18 altı için varsayılanları
      uygula: gizli hesap açık, DM yalnızca arkadaşlardan, profil harita sekmesi kapalı,
      yakındaki soru bildirimleri kapalı, önerilen kişilerde gösterilmez.
      (b) Gerekçesiyle ertele ve DECISIONS'a yaz.
      **Karar kullanıcıya sorulmaz; (a) tercih edilir**, çünkü mağaza yaş derecelendirmesi ve KVKK
      açısından sonradan eklemek daha pahalı. Yalnızca teknik olarak imkânsızsa (b).
- [ ] **F6 — İzin metinleri.** `Info.plist` / `AndroidManifest` konum, kamera, fotoğraf, bildirim
      açıklamaları tr + en, amaca uygun ve açık.
- [ ] **F7 — Faz 10 kapanışı.** `docs/plan/11_SAFETY_PRIVACY_MODERATION.md` §7 kontrol listesini
      tek tek işaretle; işaretlenemeyenleri nedeniyle yaz. PROGRESS'te Faz 10 özetini yaz.

## Kabul kriterleri
- Ayarlar > Hakkında altında üç yasal ekran açılıyor, iki dilde.
- Uygulama içinden hesap silinebiliyor; 30 gün içinde girişte geri alma çıkıyor.
- Silme sonrası kullanıcının sinyalleri haritadan ve akıştan kalkıyor, sohbetlerde
  "Silinmiş kullanıcı" görünüyor.
- 11 §7 listesindeki her madde ya işaretli ya gerekçeli.
