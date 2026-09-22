# 12 — Çoklu Dil (i18n), Erişilebilirlik, Performans, Analitik

## 1. Çoklu dil ve yerelleştirme
- **Diller (MVP):** `tr` (varsayılan kaynak), `en`. Yapı; `de`, `ar` (RTL), `es` eklenebilecek şekilde kurulur.
- **Kütüphane:** i18next + react-i18next; dosyalar `src/i18n/locales/{tr,en}/{common,map,signal,create,feed,profile,chat,settings,errors}.json`.
- **Dil seçimi:** Cihaz dili → desteklenmiyorsa `en`. Ayarlar > Dil ile değiştirilebilir; `PATCH /me { locale }`
  ile backend'e bildirilir (push ve bildirim metinleri bu dilde üretilir).
- **Çoğullar:** i18next plural kuralları (`_one`, `_other`). Örnek: `"signal.count_one": "{{count}} sinyal"`.
- **Tarih/saat:** `Intl.DateTimeFormat` + göreli zaman `Intl.RelativeTimeFormat` ("2 dk önce" / "2 min ago").
  12/24 saat cihaz ayarından. Sohbet gün ayırıcıları: Bugün, Dün, hafta içi gün adı, sonra tarih.
- **Sayılar:** `Intl.NumberFormat` compact (`1,2 B` / `1.2K`). Mesafe: km/m veya mi/ft (ülkeye göre otomatik, Ayarlar'dan değiştirilebilir).
- **RTL hazırlığı:** Yerleşimlerde `start/end` kullan (`left/right` değil), ikon yönleri `I18nManager.isRTL`'e göre çevrilir.
- **Terim sözlüğü (tutarlılık için):**

| TR | EN | Not |
|---|---|---|
| Sinyal | Signal | Uygulama adı "Signal" olacaksa marka çakışması riski (Signal Messenger) — ürün adı ayrı seçilmeli; UI terimi olarak "Signal" genel isim olarak kullanılabilir |
| Sinyal bırak | Drop a signal | |
| Hâlâ böyle mi? | Still like this? | |
| Evet, hâlâ böyle | Yes, still true | |
| Değişti | It changed | |
| Canlı | Live | |
| Güncel / Eski | Recent / Stale | |
| Doluluk / Bekleme / Geçici durum | Crowd / Wait / Status | |
| Keşfet | Explore | |
| Hikayem | My story | |
| Kaydet / Kaydedilenler | Save / Saved | |
| Takip et / Takip ediliyor / İstek gönderildi | Follow / Following / Requested | |
| Güven puanı | Trust score | |
| Snap | Snap | Genel isim olarak |

- **Yer adları:** Sağlayıcıdan gelen yerel ad gösterilir; çevrilmez.
- **Kaynak kontrol:** CI'da eksik anahtar kontrolü (`tr` ve `en` anahtar setleri eşit olmalı).

## 2. Erişilebilirlik (a11y)
- Her dokunulabilir öğe: `accessibilityRole`, `accessibilityLabel` (ikon butonlarda zorunlu), durum
  (`accessibilityState: { selected, disabled }`). Minimum dokunma alanı 44×44 pt (`hitSlop` ile).
- **Harita pinleri:** Etiket örneği: "Bekleme, 5 ila 15 dakika, Özel Yeni Hayat Hastanesi, 2 dakika önce, canlı".
  VoiceOver kullanıcıları için harita üstünde "Liste olarak göster" butonu (Keşfet > Yakınımda'ya gider).
- **Renk tek başına anlam taşımaz:** Seviye hem renk hem çubuk sayısı hem metinle; tip hem renk hem ikonla.
- **Kontrast:** Metin/zemin en az 4.5:1 (büyük metin 3:1). Token'lar bu kurala göre seçildi; açık temada
  mint ve sarı metin olarak kullanılmaz (yalnızca zemin/ikon).
- **Dinamik yazı:** Font ölçeği destekli, maks 1.4× ile sınırlı; kartlar metin büyüyünce taşmaz (esnek yükseklik).
- **Hareket:** "Hareketi Azalt" açıkken nabız, yay, paylaşılan öğe geçişleri kapanır (opaklık geçişi).
- **Medya:** Kullanıcı fotoğrafları için otomatik alt metin: "{yazar} tarafından {yer}'de paylaşılan fotoğraf, {tip}: {seviye}".
  Kullanıcı açıklaması varsa eklenir.
- **Hikaye/snap sayaçları:** VoiceOver açıkken otomatik geçiş durur, manuel ilerleme.

## 3. Performans bütçeleri ve teknikleri
| Metrik | Hedef |
|---|---|
| Soğuk açılış → harita etkileşime hazır | < 2,0 sn (orta seviye cihaz) |
| (+) → kamera önizlemesi | < 500 ms |
| Pin dokunuşu → Sinyal Kartı görünür | < 150 ms (önbellekten), veri < 400 ms |
| Akış kaydırma | 60 fps, JS thread boşta kareleri < %5 |
| Harita: 300 pinle kaydırma | 55+ fps |
| Uygulama paketi (iOS indirme) | < 60 MB |
| API p95 (harita/akış) | < 300 ms |

- **Liste:** FlashList + `estimatedItemSize`, `getItemType` (görsel/metin kart), memo'lu satırlar.
- **Görsel:** expo-image, `cachePolicy="memory-disk"`, blurhash placeholder, sunucu varyantları
  (ızgara `w240`, kart `w540`, tam ekran `w1080`). Asla tam boy görseli küçük alanda yükleme.
- **Ön yükleme:** Sinyal Kartı açılınca kümedeki sonraki 2 sinyalin medyası; hikayede sonraki 2 öğe.
- **Harita:** Pin bileşenleri memo, `tracksViewChanges=false`, bbox değişiminde debounce, React Query
  ile bbox anahtarlı önbellek (yakın bbox'larda yeniden kullanım), realtime güncellemeleri toplu uygula (250 ms).
- **Animasyonlar:** Yalnızca Reanimated worklet'leri (UI thread). JS thread'de animasyon yok.
- **Ağ:** İstek birleştirme (views, stories/seen toplu), HTTP keep-alive, gzip/brotli. Çevrimdışıyken
  son harita/akış verisi React Query persist (MMKV) ile gösterilir, üstte "Çevrimdışı" bandı.
- **Backend:** Tüm harita/akış sorguları `EXPLAIN ANALYZE` ile kontrol edilir; GIST indeks kullanımı doğrulanır.

## 4. Analitik (ürün metrikleri)
- **Sağlayıcı:** PostHog (açık kaynak, self-host edilebilir) veya mevcut çözüm. Anahtar yoksa analitik
  katmanı no-op çalışır (`analytics.track` soyutlaması).
- **Kişisel veri yok:** Olaylarda gerçek konum, e-posta, mesaj içeriği, açıklama metni **gönderilmez**.
  Konum gerekirse yalnızca şehir/ülke.
- **Rıza:** Ayarlar > Gizlilik > "Kullanım verilerini paylaş" (AB kullanıcılarında varsayılan kapalı).
- **Olay şeması** (`snake_case`, `object_action`):

| Olay | Özellikler |
|---|---|
| `app_opened` | `cold_start`, `from_push` |
| `map_viewed` | `zoom_bucket`, `pins_visible` |
| `pin_tapped` | `signal_type`, `is_cluster`, `is_place` |
| `signal_card_opened` / `signal_card_swiped` | `signal_type`, `position` |
| `signal_create_started` | `entry` (tab_button, empty_state, place_page, question) |
| `signal_create_step` | `step` (camera, edit, details, send), `duration_ms` |
| `signal_created` | `signal_type`, `has_media`, `source`, `is_anonymous`, `visibility`, `to_story`, `snap_recipients` |
| `signal_verified` | `verdict`, `signal_age_min` |
| `reaction_added` | `reaction` |
| `comment_posted` | `is_reply`, `has_mention` |
| `user_followed` | `source` (card, profile, suggestions, search) |
| `place_followed` | `mode` |
| `story_viewed` | `items_seen` |
| `message_sent` | `type` |
| `notification_opened` | `type` |
| `onboarding_step` | `step`, `result` |

- **Hunilerin tanımı:** Aktivasyon (kayıt → ilk sinyal/doğrulama 24 sa içinde), paylaşım hunisi
  (create_started → created, adım bazlı düşüş), sosyal (profil görüntüleme → takip).
