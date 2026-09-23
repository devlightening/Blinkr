# Denetim — Faz 3, 5 ve 8 kabul kriterleri (plan-devam A9)

> Kaynak: `docs/sinyal-mvp-plan/docs/plan/13_ROADMAP_PHASES.md`. Durum koddan ve tarayıcı ekran
> görüntülerinden (react-native-web, `scripts/ui-test.cjs`) denetlendi; fiziksel cihaz gerektiren maddeler
> öyle işaretlendi. ✅ sağlanıyor · 🟡 kısmen · ❌ yok. Sağlanmayanların hangi fazda kapanacağı sağ sütunda.

## Faz 3 — Harita, pinler, Sinyal Kartı

| Madde | Durum | Ekranda / kodda ne var | Kapanacağı yer |
|---|---|---|---|
| P3.1 Üst bar, filtre çipleri, konumuma dön, alt özet | 🟡 | `MapTopChrome` arama + katman çubuğu + tip çipleri var; "Bu alanı tara" satırı hâlâ görünüyor, alt mini özet bandı yok | C11 |
| P3.2 Otomatik bbox, "0 görünür" kalkar | 🟡 | Görünüm durunca otomatik yükleme var; "Bu alanı tara" düğmesi ve görünür sayısı rozeti duruyor | C11 |
| P3.3 MapPin (halka, tip ikonu, opaklık), ClusterPin, PlacePin | ✅ | `MapMarkerVisuals`, `markerGeometry.ts`; opaklık artık tek tazelik kuralından (A8) | B9 (renk/kenarlık) |
| P3.4 Kümeleme | 🟡 | İstemci kümelemesi (`mapClusters.ts`); zoom<12 sunucu kümesi yok | C13 |
| P3.5 CenterModal + Sinyal Kartı | ❌ | Pine dokununca alttan yer sayfası (`PostDetailSheet`) açılıyor; ortada kart yok | C1–C3 |
| P3.6 Pinden merkeze animasyon, aşağı kaydırarak kapatma | ❌ | Yok (sheet animasyonu var) | C1 |
| P3.7 Kart içi yatay kaydırma | ❌ | Yok | C5 |
| P3.8 Doğrulama (Evet/Değişti, uzaklık, pasif) | 🟡 | "Hâlâ böyle mi?" yer sayfasında; normal sinyal akışına gider, sunucu güveni belirler. Uzaktayken pasif gösterim ve son doğrulama zamanı yok | C7 |
| P3.9 Tepki, kaydet, paylaş, ⋯ menüsü | 🟡 | Beğeni ve yorum var (Faz 4), sohbette paylaş var (Faz 8), yer kaydetme var; çift dokunma ❤️, ReactionBar ve kart ⋯ menüsü yok | C6, C8 |
| P3.10 Realtime pinler | ❌ | Realtime yok (bilinçli, yoklama); yeni pin nabzı yok | D9 (kendi pini nabızla), realtime ertelendi |
| P3.11 Görüntülenme toplu gönderimi | ❌ | Yok | C12 |
| P3.12 Yer sayfası | 🟡 | Canlı durum, StatRow (A4/A5 düzeldi), yol tarifi, son sinyaller var; üst görsel banner'a kırpılıyor; "takip et" ve "soru sor" yok | C4, C10 |
| P3.13 Arama (Yerler \| Kişiler) | ✅ | `MapSearchOverlay`, sonuca uçma | — |
| **Kabul:** kart < 150 ms | ❌ | Kart yok | C13, G9 |
| **Kabul:** fotoğraf kırpılmıyor | ❌ | Yer sayfası üst görselinde kırpılıyor | C4 |
| **Kabul:** aynı yerdeki 3 sinyalde kaydırma | ❌ | — | C5 |
| **Kabul:** uzaktayken doğrulama pasif | ❌ | — | C7 |
| **Kabul:** 300 pinde akıcı | 🟡 | Fiziksel cihazda ölçülmedi | C13, G9 |
| **Kabul:** yer sayfası sayısı = liste | 🟡 | Sayı `activeSignalCount` (kişi başına bir ses), liste son sinyaller; ikisi farklı filtreden | C10 |

## Faz 5 — Kamera ve oluşturma

| Madde | Durum | Ekranda / kodda ne var | Kapanacağı yer |
|---|---|---|---|
| P5.1 (+) → kamera, uzun basma → metin | ✅ | `BlinkrBottomBar` + `SignalCamera`; uzun basma composer'ı açar | — |
| P5.2 Foto/video (15 sn halka), flaş, çevir, zoom, galeri, "Aa" | ✅ | `SignalCamera`, `recordingProgress` | D2 (Foto · Video mod anahtarı) |
| P5.3 Yer çipi, konum belirsiz, hassas yer, okulda medya kapalı | 🟡 | Hassas yer/okul kuralları ve belirsiz konum uyarısı composer'da; kameranın üstünde yer çipi yok (D-007) | D3 |
| P5.4 Kaydırarak filtre, filtre adı | 🟡 | `LensSwipe` var ama efekt ekranında daire listesi de duruyor | D4 |
| P5.5 Çıkartmalar | ✅ | `DraggableSticker`: sürükle/döndür/çöp, çakışmasız yerleşim | D5 (eğim, iki parmak ölçek) |
| P5.6 Metin aracı | 🟡 | Tek stil metin katmanı | D5 |
| P5.7 Flatten, sıkıştırma, EXIF silme | ✅ | `react-native-view-shot`; sunucu EXIF/PNG/WebP metaverisini siliyor (BLK-MEDIA-PRIVACY-01) | — |
| P5.8 Detaylar tek sayfa | ❌ | Çekimden sonra 4 adımlı sihirbaz (Yer → Sinyal → İçerik → Kontrol); "Başlık" alanı duruyor; sayfaların üst yarısı boş | D6, D7 |
| P5.9 Gönder sayfası (Harita/Hikayem/Arkadaşlar) | 🟡 | Composer içinde arkadaşlara snap seçeneği var; ayrı gönder ekranı ve "Hikayem" hedefi yok | D8 |
| P5.10 Arka plan yükleme, taslak, yeniden deneme | ❌ | Yayın modal açıkken bekler; çevrimdışı taslak yok | D9 |
| P5.11 Galeri 2 saat kuralı | ✅ | `galleryCapture.ts` + sunucu `GalleryMediaPolicy` | D10 ("Galeriden" etiketi kartta) |
| P5.12 Kopya sinyal birleştirme UI'ı | ❌ | Sunucuda birleştirme yok | ertelenebilir |
| **Kabul:** (+) → önizleme < 500 ms | 🟡 | Fiziksel cihazda ölçülmedi | G9 |
| **Kabul:** 3 dokunuşta paylaşım | ❌ | Sihirbaz yüzünden 6+ dokunuş | D6, D8 |
| **Kabul:** uçak modunda paylaş → otomatik yükleme | ❌ | — | D9 |
| **Kabul:** EXIF GPS yok | ✅ | BLK-MEDIA-PRIVACY-01 | — |

## Faz 8 — Sohbet

| Madde | Durum | Ekranda / kodda ne var | Kapanacağı yer |
|---|---|---|---|
| P8.1 Backend (idempotent, okundu, snap, geri al, tepki) | 🟡 | Hepsi var; istek klasörü ve dm_policy yok (D-011) | E8 |
| P8.2 Konuşma listesi | 🟡 | Snapchat durum ikonları, okunmamış, hızlı kamera var; kaydırma eylemleri ve istek klasörü yok | E8 |
| P8.3 Balonlar, gruplama, gün ayırıcı, okundu, yazıyor | ❌ | Sol çizgili satırlar, her mesajda ad; gün ayırıcı yok | E1–E4 |
| P8.4 Mesaj tipleri | 🟡 | text, snap, signal var; signal balonu düz satır | E5, E6 |
| P8.5 Tepki, yanıtla, kopyala, geri al, bildir | 🟡 | Tepki ve geri al var; yanıtla (alıntı), kopyala, bildir yok | E7 |
| P8.6 Snap görüntüleyici | ✅ | `SnapViewer`, Android ekran görüntüsü engeli | — |
| P8.7 Sinyali sohbete paylaş | ✅ | `ShareToChatSheet` (Keşfet kartından) | E6 (dokununca Sinyal Kartı) |
| P8.8 Yeni sohbet, izin yoksa istek | 🟡 | Kişi seçici var; istek gönderimi yok (D-011) | E8 |
| P8.9 Veri göçü | ✅ | Geriye uyumlu alanlar | — |
| **Kabul:** snap tek sefer | ✅ | BLK-SNAP-01 | — |
| **Kabul:** yazıyor/okundu anlık | ❌ | Okundu verisi var, gösterilmiyor; yazıyor yok | E4 |
| **Kabul:** gün ayırıcı | ❌ | — | E3 |

## Beklenmedik eksikler
- Yer sayfasındaki sinyal sayısı ile "Son sinyaller" listesi farklı kurallardan geliyor → C10'a eklendi.
- Keşfet kartındaki "Canlı" rozeti her süresi dolmamış sinyalde görünüyordu; A8'de tek kurala bağlandı ve sunucu güveni okuma modeline taşındı (`PublicationTrust`).
