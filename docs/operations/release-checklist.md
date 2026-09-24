# Yayın kontrol listesi (plan-devam G14)

> `docs/sinyal-mvp-plan/docs/plan/14_TESTING_QA_RELEASE.md` §5'in bu depodaki durumu. `[x]` hazır, `[~]` kısmen,
> `[ ]` yapılmadı — nedeni yanında. Sahibi gereken maddeler kullanıcının kararını/hesabını ister.

- [ ] **Sürüm ve build numarası; değişiklik notları (tr/en)** — `app.json` 1.0.0; iOS `buildNumber` / Android
      `versionCode` ve EAS (`eas.json`) henüz yok. İlk mağaza derlemesinde eklenmeli.
- [~] **Env ve secret'lar** — `.env.example` (kök ve Expo) eklendi. **Dikkat:** kökteki `.env` (yerel geliştirme
      kimlik bilgileri) git'te izleniyor; yayından önce bu dosya izlemeden çıkarılmalı ve içindeki parolalar
      değiştirilmeli (geçmişten silmek kullanıcı kararı). JWT imza anahtarı üretimde ortam değişkeni olmalı.
- [ ] **Migration provası + yedek** — Identity EF migration'ları açılışta uygulanıyor (`MigrateAsync`); üretimde
      staging kopyasında prova ve öncesinde yedek gerekiyor. Yedek/geri yükleme politikası yazılmadı (CLAUDE.md §20.1).
- [ ] **Sentry release + source map** — Sentry kurulmadı; DSN bir secret, kullanıcıdan alınmalı.
- [ ] **Push (APNs, FCM)** — uygulamada push yok (CLAUDE.md §20.1); izin metni de bu yüzden istenmiyor.
- [ ] **Evrensel link dosyaları** — derin bağlantı alan adı yok.
- [~] **App Privacy / Data Safety, yaş derecelendirmesi** — yanıtlar hazır: `store-privacy-answers.md`; derecelendirme
      UGC nedeniyle 12+/Teen. Konsolda doldurulacak.
- [~] **11 §7 UGC listesi** — tek açık madde destek/itiraz adresi (`{{DESTEK_EPOSTA}}`, D-021).
- [x] **Ekran görüntüleri demo verisinden** — `node scripts/seed-demo.cjs` (yüz yok, çizilmiş avatarlar; `--reset`).
- [~] **İnceleme ekibi için demo hesap ve not** — demo hesapları seed ile oluşur (`demo_ayse` vb., parola betikte).
      Not taslağı: "Konum tabanlı içerik Osmaniye merkezinde; uygulama içi konum izni gerekir, test için konumu
      37.0746, 36.2464 olarak ayarlayın." Üretim sunucusunda aynı seed koşulmalı.
- [ ] **Kademeli yayın, crash-free > %99,5** — mağaza konsolunda açılır; çökme izleme için Sentry gerekli.

## Yayından önce ayrıca
- Fiziksel iki cihaz kabul testi (CLAUDE.md §19.3) ve `e2e/maestro` akışlarının ilk koşusu.
- Test verisi temizliği (plan-devam A2/A3) — kullanıcı onayıyla.
- EventStore'da silinen hesapların eski olayları için tombstone + scavenge operasyonu (D-021).
- TLS, CORS, rate limit sertleştirmesi (CLAUDE.md §20.1).
