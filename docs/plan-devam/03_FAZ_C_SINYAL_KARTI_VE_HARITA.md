# Faz C — Sinyal Kartı ve Harita

**Amaç:** Uygulamanın ana deneyimini planlandığı hâle getirmek: pine dokun → **ekranın ortasında
gönderi kartı**. Şu an pine dokununca alttan yer sayfası açılıyor; kart hiç yok.

Ayrıntılı tanım: `docs/plan/04_SCREENS_MAP_AND_SIGNAL.md` §2. Burada yalnızca eksik kalanlar ve
mevcut koda göre yapılacaklar var.

## Görevler

- [ ] **C1 — CenterModal kabı.** Overlay (`bg.overlay` + blur) + ortada kart. Giriş: pin konumundan
      ölçek 0.85→1 + opaklık, taşmalı yay, 350 ms. Çıkış tersine, pine doğru. Aşağı kaydırarak ve
      overlay'e dokunarak kapanır. Genişlik ekran − 32, maksimum yükseklik ekranın %82'si; fazlası
      kart içinde kaydırılır. Köşe `xl 32`, zemin `bg.surfaceRaised`.
- [ ] **C2 — Pin dokunuşu artık Sinyal Kartı'nı açar.** Yer pinine dokunma da kartı açar (o yerin
      sinyalleriyle), kartın üstünde küçük yer özeti şeridi olur. Yer sayfasına yalnızca karttaki
      yer satırından gidilir.
- [ ] **C3 — Kart içeriği** (yukarıdan aşağı):
      başlık satırı (avatar + FreshnessRing, ad, "Konumda" rozeti, kalan süre, ⋯ menüsü) →
      medya (4:5, **kırpmasız**) + sol altta TypeBadge → yer satırı (ikon, ad, uzaklık, ›) →
      açıklama (maks 3 satır + "devamı") → sağlık kategorisindeyse HealthNotice →
      VerifyBar ("Hâlâ böyle mi?" + Evet/Değişti + son doğrulama zamanı) →
      ActionRow (tepki, yorum, paylaş, kaydet) → en iyi 1 yorum önizlemesi → "Yorum ekle…".
- [ ] **C4 — Medya kırpması düzeltmesi.** Orijinal oran korunur; 4:5'ten yataysa 4:5 kapsayıcıda
      `contain` + blurhash arka plan; 9:16'dan dikse 9:16'ya sınırlanır. Yüz/ana içerik asla
      kırpılmaz. Aynı düzeltme **yer sayfasının üst görselinde de** yapılır (şu an banner'a
      kırpılıp yüz kesiliyor).
- [ ] **C5 — Kart içi yatay kaydırma.** Aynı yerdeki/kümedeki önceki–sonraki sinyal; altta `‹ 1/3 ›`
      göstergesi. Medya carousel'i önceliklidir (medyaların sonunda kart geçişine devreder).
- [ ] **C6 — Etkileşimler.** Medyaya dokun → tam ekran görüntüleyici (pinch-zoom, kaydırarak
      kapatma). Çift dokunma → ❤️ + kalp animasyonu. ♡ uzun basma → ReactionBar (❤️ 🔥 😮 😂 🙏).
      Yazar adına dokunma → profil (anonimse pasif). Yer satırı → yer sayfası.
- [ ] **C7 — Doğrulama akışı kartta.** "Evet" optimistic + haptik; "Değişti" → seviye seçimi alt
      sayfası → yeni sinyal (`replacesSignalId`). 500 m'den uzaktaysa butonlar pasif ve altında
      "Doğrulamak için bu yere yakın olmalısın". Kendi sinyalini doğrulayamaz. Bu kurallar backend'de
      zaten var; kart yalnızca doğru durumu göstermeli.
- [ ] **C8 — ⋯ menüsü.** Bildir, sessize al, engelle; kendi sinyalinse düzenle, haritadan kaldır,
      sil. Moderasyon/rapor akışı mevcut; yeniden yazma, bağla.
- [ ] **C9 — Kümeye dokunma.** Zoom 16'dan küçükse yakınlaştır; 16+ ise (aynı nokta) kartı kümedeki
      sinyallerle aç.
- [ ] **C10 — Yer sayfası düzeltmeleri.** Üst görsel kırpması (C4), StatRow (Faz A'da düzeldi),
      "Son sinyaller" sayısı ile listenin aynı filtreden gelmesi. Sağlık kategorisinde HealthNotice
      kalıcı: "Acil durumda 112'yi ara. Bekleme süreleri kullanıcı bildirimidir."
- [ ] **C11 — Harita üst barı.** Arama çubuğu safe-area altında; filtre çipleri tek satırda yatay
      kaydırmalı; "0 görünür / 1 görünür" rozeti kalkar, bilgi alttaki özet bandına taşınır
      ("Bu bölgede canlı sinyal yok · İlk sinyali bırak").
- [ ] **C12 — Görüntülenme sayımı.** Kart ≥ 1 sn görünür kalınca görüntülenme kaydedilir, 10 sn'de
      bir toplu gönderilir.
- [ ] **C13 — Performans.** Pin bileşenleri memoize, görünür alan dışındakiler render edilmez,
      maksimum 300 pin; fazlası kümelenir. Kart açılışı önbellekten < 150 ms.

## Kabul kriterleri (ekranda)
- Pine dokununca ortada kart açılıyor, alttan sayfa açılmıyor.
- Fotoğraftaki yüz hiçbir yerde kesilmiyor (kartta da, yer sayfasında da).
- Aynı yerdeki birden çok sinyal arasında yatay kaydırma çalışıyor.
- Uzaktayken doğrulama butonları pasif ve açıklaması görünüyor.
- Haritada "0 görünür" rozeti yok; boş durumda alt bantta davet var.
