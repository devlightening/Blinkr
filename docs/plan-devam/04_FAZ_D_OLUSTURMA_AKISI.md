# Faz D — Kamera-Öncelikli Oluşturma Akışı

**Amaç:** 4 adımlı form sihirbazını, Snapchat hissi veren kamera-öncelikli akışa çevirmek.
Hedef: (+) dokunuşundan paylaşıma **3 dokunuş**.

Şu anki durum: (+) → "Adım 1/4 · Yer" → "Adım 2/4 · Sinyal" → "Adım 3/4 · İçerik" → … Kamera ve
efekt ekranı mevcut ve iyi çalışıyor ama akışın sonuna iliştirilmiş; sihirbaz sayfalarının üst
yarısı boş.

Ayrıntılı tanım: `docs/plan/05_SCREENS_CREATE_FEED_STORIES.md` §1.

## Görevler

- [ ] **D1 — (+) doğrudan kamerayı açar.** Sihirbazın 1. ve 2. adımı ön koşul olmaktan çıkar.
      Kamera izni varsa < 500 ms'de önizleme. (+) uzun basma → "Sadece metin sinyali" modu.
- [ ] **D2 — Kamera ekranı tamamlanır.** Mevcut ekranın üstüne: sol altta galeri küçük resmi,
      deklanşör (dokun = foto, basılı tut = video 15 sn halka ilerlemesi), sağ altta "Aa" metin modu,
      üstte flaş + kamera çevir. Mod anahtarı Foto · Video. Zoom basılıyken yukarı kaydırma.
- [ ] **D3 — Yer algılama kamerada.** Kamera açılırken konum alınır ve en yakın yer çip olarak
      üstte gösterilir ("📍 BİM ▾"), dokununca yer seçici alt sayfası. Doğruluk > 100 m ise
      "Konum belirsiz" uyarısı. Böylece "Adım 1/4 · Yer" ekranı gereksizleşir (yer seçici alt sayfa
      olarak yaşamaya devam eder: Yer ara / Yakınımdaki yerler / Haritadaki nokta).
- [ ] **D4 — Efekt ekranı: filtre kaydırmayla.** Filtre daire listesi kalkar; fotoğrafın üzerinde
      yatay kaydırma ile filtre değişir, filtre adı 1 sn ortada görünür, haptik `selection`.
      Mevcut 8 filtre korunur (Normal, Gün batımı, Nane, Neon, Buz, Retro, Sinema, Gece).
- [ ] **D5 — Çıkartmalar.** Sürükle, iki parmakla ölçekle/döndür, çöpe sürükleyince sil (× rozeti
      kalabilir ama sürükleme zorunlu). Yeni çıkartma boş alana yerleşir, üst üste binmez.
      Rastgele ±2–4° eğim (sticker hissi). Tip çıkartması seçilirse sinyal tipi otomatik seçilir.
- [ ] **D6 — Detaylar tek sayfa.** Kalan tek form adımı: tip çipleri (büyük, ikonlu) → seviye
      segmenti → yer (önceden seçili, değiştirilebilir) → açıklama → görünürlük + anonim →
      "Haritada X saat kalır" bilgisi. **"Başlık" alanı kaldırılır**, tek açıklama alanı kalır
      (280 karakter). Sheet tam sayfa; üstteki boş alan kalkar.
- [ ] **D7 — Başlık verisi göçü.** Mevcut kayıtlarda başlık açıklamadan farklıysa açıklamanın
      başına taşınır, aynıysa atılır. Böylece kartlardaki "Kapalı bim / Geçici durum" tekrarı biter.
      Liste ve kart bileşenleri artık başlık alanını hiç göstermez.
- [ ] **D8 — Gönder ekranı.** Tek ekranda hedef seçimi: `[✓] Haritaya paylaş` `[✓] Hikayem`
      `[ ] Arkadaşlar (snap olarak)` + arama. Sarı "Gönder" butonu.
- [ ] **D9 — Arka planda yükleme.** Gönder'e basınca modal kapanır, yükleme arka planda sürer,
      "Paylaşılıyor…" ilerleme çipi görünür; biterse toast + haritada kendi pini nabızla belirir.
      Başarısızsa taslak cihazda kalır ve bağlantı gelince otomatik yeniden denenir.
- [ ] **D10 — Galeri kuralları.** EXIF tarih/konum yalnızca doğrulama için okunur, sunucuya
      EXIF'siz gider. 2 saatten eski medya "Galeriden" etiketi alır ve güven ağırlığı düşer.
- [ ] **D11 — Hassas yer uyarısı.** Sağlık/ibadet/okul kategorilerinde kamera açılırken tek seferlik
      uyarı; okul/kreş kategorisinde medya paylaşımı kapalı, yalnızca metin sinyali.

## Kabul kriterleri (ekranda)
- (+) dokunuşu doğrudan kamerayı açıyor; önce form gelmiyor.
- Foto çek → tip seç → Gönder ile paylaşım tamamlanıyor (3 dokunuş).
- Filtreler fotoğrafın üstünde kaydırılarak değişiyor.
- Hiçbir ekranda "Başlık" alanı yok; kartlarda başlık/etiket tekrarı yok.
- Sihirbaz sayfalarında ekranın yarısı boş değil.
- Uçak modunda paylaş → bağlantı gelince otomatik yükleniyor.
