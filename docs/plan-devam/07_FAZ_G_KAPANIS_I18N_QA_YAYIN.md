# Faz G — Kapanış: i18n, Erişilebilirlik, Performans, Analitik, QA, Yayın

Bu faz eski plandaki Faz 11 ve Faz 12'yi birleştirir. Referans:
`docs/plan/12_I18N_A11Y_PERFORMANCE_ANALYTICS.md` ve `docs/plan/14_TESTING_QA_RELEASE.md`.

## i18n (asıl ağır kısım — P1.4'te bilinçli ertelenmişti)
- [ ] **G1 — Ekran taraması.** Sabit Türkçe metni kalan ekranlar anahtarlara taşınır. Bilinen
      adaylar: ReportPanel, EditProfileSheet, SignalComposer, avatar seçici, arama ekranı, ayarlar
      alt metinleri, yasal ekranlar. Tarama yöntemi: JSX içindeki Türkçe karakter içeren string
      literal'lerini grep'le.
- [ ] **G2 — Anahtar eşitliği.** CI'da `tr` ve `en` anahtar setleri eşit olmalı; eksikte hata ver.
- [ ] **G3 — Yerelleştirme.** Göreli zaman (`Intl.RelativeTimeFormat`), sayı kısaltma (1,2 B / 1.2K),
      mesafe birimi (km/mi, ülkeye göre), 12/24 saat. Sohbet gün ayırıcıları da yerelleşir.
- [ ] **G4 — RTL hazırlık.** Yerleşimlerde `left/right` yerine `start/end`; ikon yönleri RTL'de çevrilir.

## Erişilebilirlik
- [ ] **G5 — Etiketler ve dokunma alanı.** Her dokunulabilir öğede `accessibilityLabel` ve rol;
      minimum 44×44 pt. İkon-only butonlar (harita kontrolleri, ⋯, kapat) öncelikli.
- [ ] **G6 — Harita erişilebilirliği.** Pin etiketi: "Bekleme, 5 ila 15 dakika, BİM, 2 dakika önce,
      canlı". Harita üstünde "Liste olarak göster" butonu (Keşfet > Yakınımda'ya gider).
- [ ] **G7 — Renk tek başına anlam taşımaz.** Seviye hem renk hem çubuk hem metinle; tip hem renk
      hem ikonla. Kontrast denetimi (4.5:1 / 3:1) iki temada.
- [ ] **G8 — Hareketi Azalt.** Nabız, taşmalı yay ve paylaşılan öğe geçişleri kapanır.

## Performans
- [ ] **G9 — Bütçe ölçümü.** Soğuk açılış → harita < 2 sn · (+) → kamera < 500 ms ·
      pin → kart < 150 ms · 300 pinde 55+ fps · API p95 < 300 ms. Ölçülen değerleri
      `PROGRESS_DEVAM.md`'deki tabloya yaz; hedefi tutmayanları iyileştir.
- [ ] **G10 — Liste ve görsel.** Uzun listelerde sanallaştırma, görsel varyantları (ızgara/kart/tam
      ekran ayrı boyut), blurhash yer tutucu, önbellek.

## Analitik
- [ ] **G11 — Soyutlama + olay şeması.** `analytics.track` soyutlaması (anahtar yoksa no-op).
      Olaylar `12_I18N...` §4 tablosundan. **Konum, e-posta, mesaj ve açıklama metni gönderilmez**;
      konum gerekiyorsa yalnızca şehir. Ayarlar > Gizlilik altında "Kullanım verilerini paylaş"
      anahtarı (AB kullanıcılarında varsayılan kapalı).

## QA ve yayın
- [ ] **G12 — Seed ve demo modu.** Mağaza ekran görüntüleri için gerçek kullanıcı verisi ve yüzü
      olmayan demo veri seti. Seed deterministik ve `--reset` ile tekrar çalıştırılabilir.
- [ ] **G13 — E2E senaryoları.** `14_TESTING_QA_RELEASE.md` §3'teki 13 senaryo (Maestro/Detox).
      En az şunlar: onboarding, haritadan bilgi + doğrulama, paylaşım, çevrimdışı paylaşım, yorum,
      takip, gizli hesap, engelleme, snap tek seferlik, hesap silme, dil değişimi.
- [ ] **G14 — Yayın kontrol listesi.** `14_TESTING_QA_RELEASE.md` §5: sürüm/build numarası, env ve
      secret'lar, migration provası + yedek, Sentry (DSN secret olduğu için kullanıcıdan iste),
      push sertifikaları, evrensel link dosyaları, App Privacy / Data Safety formları, yaş
      derecelendirmesi, inceleme ekibi için demo hesap ve not, kademeli yayın.

## Kabul kriterleri
- Uygulama İngilizce'ye alındığında hiçbir ekranda Türkçe metin kalmıyor.
- VoiceOver ile sinyal oluşturma akışı baştan sona tamamlanabiliyor.
- Bütçe tablosundaki değerler ölçülüp yazıldı.
- E2E senaryoları geçiyor.
- Yayın kontrol listesindeki her madde işaretli ya da gerekçeli.
