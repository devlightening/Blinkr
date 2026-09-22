# 13 — Yol Haritası: Fazlar, Görevler, Kabul Kriterleri

Her faz: **Amaç → Okunacaklar → Görevler → Kabul kriterleri**. Görev kimlikleri (`P3.4` gibi)
`PROGRESS.md`'de aynen kullanılır. Görevler sırayla yapılır; aynı faz içinde bağımsız olanlar
paralel düşünülebilir.

---

## Faz 0 — Keşif ve denetim
**Amaç:** Mevcut kodu anlamak, planı gerçekliğe eşlemek. Kod değişikliği yok.
**Oku:** 00, 01, 02, 08 (§13), 13
- [ ] P0.1 Repo yapısını, paket dosyalarını, env dosyalarını incele
- [ ] P0.2 Mobil ve backend stack'ini tespit et
- [ ] P0.3 Mevcut özellik envanterini çıkar (her ekran → dosya → API)
- [ ] P0.4 Mevcut veri modelini çıkar
- [ ] P0.5 Gap analizi (plan başlıkları: var / kısmen / yok)
- [ ] P0.6 Stack eşleme tablosu (referans kütüphane → mevcut karşılığı / eklenecek)
- [ ] P0.7 `AUDIT.md` ve ilk `DECISIONS.md` kayıtlarını yaz; açık soruları listele
**Kabul:** AUDIT.md 7 bölümü içeriyor; her faz için gerekli yeni bağımlılıklar listelenmiş.

---

## Faz 1 — Tasarım sistemi temeli
**Amaç:** Tüm yeni UI'ın üzerine kurulacağı token + bileşen katmanı; mevcut ekranların görsel olarak tutarlı hale gelmesi.
**Oku:** 03, 12 (§1–2)
- [ ] P1.1 `design-system/tokens`: palette, semantik renkler (koyu + açık), tipografi, boşluk, radius, motion, haptics
- [ ] P1.2 `ThemeProvider` + `useTheme()`; sistem temasını izle, Ayarlar'dan değiştirilebilir altyapı
- [ ] P1.3 Font kurulumu (Bricolage Grotesque, Türkçe glif testi) + `Text` bileşeni (variant prop'lu)
- [ ] P1.4 i18n altyapısı (i18next, tr/en, dil algılama); mevcut ekranlardaki ham metinleri anahtarlara taşı
- [ ] P1.5 Temel bileşenler: Button, IconButton, Chip, TypeBadge, LevelMeter, Avatar (story halkası), FreshnessRing, StatRow, SegmentedControl, Sheet, CenterModal, Toast, Skeleton, EmptyState, ErrorState
- [ ] P1.6 Sinyal tipi kataloğu (istemci): tip → ikon, renk, seviye etiketleri (i18n), TTL bilgisi — tek kaynak dosya
- [ ] P1.7 Yeni tab bar: Harita · Keşfet · (+) · Sohbet · Profil (Keşfet şimdilik mevcut "Yakında" ekranını gösterir); Harita varsayılan açılış
- [ ] P1.8 Mevcut ekranlarda hızlı düzeltmeler: "Taze tazelik / Orta güven güven" → StatRow; tekrarlanan başlık/etiket (#4); profilde e-postayı gizle (#5); üst bar safe-area (#11)
- [ ] P1.9 Bileşen önizleme ekranı (yalnızca dev build'de: `/dev/components`)
**Kabul:** UI dosyalarında ham hex/ham metin yok (lint kuralı veya grep ile doğrulanır); açık/koyu tema geçişi çalışıyor; bileşen önizleme ekranında tüm bileşenler iki temada da doğru.

---

## Faz 2 — Backend temeli
**Amaç:** Hedef şema, API iskeleti, medya hattı, realtime ve iş kuyruğu.
**Oku:** 07, 08, 09, 10, 11 (§1, §6)
- [ ] P2.1 Yerel geliştirme ortamı: docker-compose (postgres+postgis, redis, minio), `.env.example`
- [ ] P2.2 Migration'lar: 08'deki şema (mevcut tablolarla eşlemeli, veri koruyan)
- [ ] P2.3 Veri göçü: tip eşleme, `(#12345)` temizliği, konum → display_location, arkadaşlık → follows
- [ ] P2.4 Ortak altyapı: hata biçimi, zod doğrulama, cursor sayfalama, idempotency, rate limit, logger (konum maskeleme)
- [ ] P2.5 Auth: register/login/Apple/Google/refresh rotasyonu/logout (mevcut auth varsa uyarlama)
- [ ] P2.6 Görünürlük fonksiyonu (`shared/visibility`) + birim testleri (açık/gizli hesap, engel, anonim, takipçi)
- [ ] P2.7 Sinyal motoru saf fonksiyonları (10 §1–§7) + birim testleri: TTL, uzatma, doğrulama kuralları, bulanıklaştırma, canlı durum, güven puanı, sıralama
- [ ] P2.8 Medya: upload-url, complete, worker (EXIF sil, varyantlar, blurhash, video), temizlik işi
- [ ] P2.9 Sinyal uç noktaları: POST/GET/PATCH/DELETE, harita (bbox + kümeleme), yakındaki yerler
- [ ] P2.10 Realtime gateway: auth, odalar, `map:*`, `signal:*` olayları
- [ ] P2.11 İşler: `signal.expire`, `place.aggregate`, `counters.reconcile`
- [ ] P2.12 Paylaşılan tipler (`shared/types/api.ts`) mobil tarafa bağlandı; mobil API istemcisi (TanStack Query hook'ları, token refresh)
- [ ] P2.13 API entegrasyon testleri (sinyal oluştur → haritada görün → süresi dolsun)
**Kabul:** Tüm testler geçiyor; `GET /map/signals` 10k seed sinyalde p95 < 300 ms (yerel); gerçek konum hiçbir yanıtta yok (test ile doğrulanır); mevcut mobil uygulama yeni API ile en azından eski işlevlerini sürdürüyor.

---

## Faz 3 — Harita, pinler, Sinyal Kartı
**Amaç:** Uygulamanın ana deneyimi: pine dokun → merkezde gönderi kartı.
**Oku:** 04 (§1–2), 03 (§6–8), 10 (§4–5)
- [ ] P3.1 Harita ekranı yeniden yerleşim: glass üst bar (arama, bildirim zili, avatar), filtre çipleri, konumuma dön, katmanlar sayfası, alt mini özet
- [ ] P3.2 Otomatik bbox yükleme (debounce), "Bu alanı tara" ve "0 görünür" kaldırıldı; boş durum mini özette
- [ ] P3.3 MapPin (FreshnessRing, tip ikonu, avatar varyantı, yaşlanma opaklığı, canlı nabız), ClusterPin, PlacePin
- [ ] P3.4 supercluster entegrasyonu; zoom<12 sunucu kümeleri
- [ ] P3.5 `CenterModal` + `SignalCard modal`: başlık, MediaCarousel (kırpmasız), TypeBadge, yer satırı, açıklama, HealthNotice, VerifyBar, ActionRow, yorum önizleme, yorum ekle alanı
- [ ] P3.6 Açılış/kapanış animasyonu (pinden merkeze), aşağı kaydırarak kapatma, overlay + blur
- [ ] P3.7 Kart içi yatay kaydırma (küme/yer sinyalleri), medya carousel önceliği
- [ ] P3.8 Doğrulama akışı: Evet (optimistic), Değişti (seviye alt sayfası → yeni sinyal), uzaklık kontrolü ve pasif durum
- [ ] P3.9 Tepki (çift dokunma ❤️, uzun basma ReactionBar), kaydet, paylaş sayfası, ⋯ menüsü (Bildir/Engelle/Sil)
- [ ] P3.10 Realtime: `geo:` abonelikleri, yeni pin nabızla belirir, süresi dolan pin kaybolur; açık kart için `signal:` odası
- [ ] P3.11 Görüntülenme toplu gönderimi
- [ ] P3.12 Yer sayfası (04 §5): canlı durum, StatRow, takip et, yol tarifi, soru sor (UI + API), son sinyaller ızgarası, geçmiş
- [ ] P3.13 Arama ekranı (Yerler | Kişiler), sonuçtan haritaya uçma
**Kabul:** Pine dokunmadan kart görünene kadar < 150 ms (önbellekte); fotoğraf hiçbir oranda kırpılmıyor; aynı yerdeki 3 sinyal arasında kaydırılabiliyor; uzaktayken doğrulama pasif; 300 pinde akıcı kaydırma; yer sayfasındaki sinyal sayısı ile liste tutarlı.

---

## Faz 4 — Gönderi detayı, yorumlar, medya görüntüleyici
**Amaç:** Tam sosyal etkileşim.
**Oku:** 04 (§3–4), 09 (§7)
- [ ] P4.1 Backend: yorum uç noktaları, yanıtlar, beğeni, @bahsetme çözümleme, yorum kapatma, moderasyon kancası
- [ ] P4.2 Gönderi detayı ekranı; karttan paylaşılan öğe geçişi
- [ ] P4.3 Yorum listesi (sıralama: öne çıkan/en yeni), yanıtlar, "n yanıtı gör", sonsuz kaydırma
- [ ] P4.4 CommentInput: klavyeye yapışık, hızlı emoji satırı, @ otomatik tamamlama, yanıtla modu
- [ ] P4.5 Yorum eylemleri: beğen (çift dokunma), uzun basma menüsü, sil, bildir; "Paylaşan" rozeti
- [ ] P4.6 Realtime yeni yorum; optimistic gönderim + hata geri alma
- [ ] P4.7 Tam ekran medya görüntüleyici: pinch-zoom, kaydırarak kapatma, video kontrolleri
- [ ] P4.8 Tepki verenler listesi (alt sayfa)
**Kabul:** Yorum yaz → anında listede → diğer cihazda realtime görünür; @bahsetme bildirimi tetikleniyor (bildirim satırı oluşuyor); moderasyon engellediğinde doğru hata metni.

---

## Faz 5 — Kamera ve oluşturma akışı
**Amaç:** 3 dokunuşta paylaşım, Snapchat hissi.
**Oku:** 05 (§1), 10 (§1–3), 11 (§3)
- [ ] P5.1 (+) → doğrudan tam ekran kamera (eski seçim sayfası kaldırıldı); uzun basma → metin modu
- [ ] P5.2 Kamera: foto/video (basılı tut, 15 sn halka), flaş, çevir, zoom, galeri, "Aa"
- [ ] P5.3 Yer algılama + en yakın yer çipi; konum belirsiz uyarısı; hassas yer uyarısı; okulda medya kapalı
- [ ] P5.4 Düzenleme: kaydırarak filtre (Skia; mevcut 8 filtre), filtre adı gösterimi
- [ ] P5.5 Çıkartmalar: bağlam + tip + emoji; sürükle/ölçekle/döndür/çöpe at; çakışmasız yerleşim
- [ ] P5.6 Metin aracı (3 stil, renk)
- [ ] P5.7 Flatten + stickers metadata; istemci sıkıştırma; EXIF silme
- [ ] P5.8 Detaylar sayfası: tip çipleri, seviye segmenti, yer listesi, açıklama (@, sayaç), görünürlük, anonim, TTL bilgisi
- [ ] P5.9 Gönder sayfası: Harita, Hikayem, arkadaşlar (snap)
- [ ] P5.10 Arka plan yükleme kuyruğu, ilerleme çipi, yeniden deneme, taslak saklama, gecikmeli sinyal
- [ ] P5.11 Galeri: EXIF tarih/konum okuma, "Galeriden" etiketi, 2 saat kuralı
- [ ] P5.12 Kopya sinyal birleştirme yanıtının UI'ı ("Mevcut sinyalin güncellendi")
**Kabul:** (+) → önizleme < 500 ms; foto çek → tip seç → gönder 3 dokunuş; uçak modunda paylaş → bağlantı gelince otomatik yüklenir; yüklenen dosyada EXIF GPS yok (test).

---

## Faz 6 — Profil, takip, kaydedilenler
**Amaç:** Instagram tarzı profil ve sosyal grafik.
**Oku:** 06 (§1–6, §11), 08 (§3, §8), 09 (§4–5, §8)
- [ ] P6.1 Backend: follow/unfollow/istek/kabul/red, takipçi çıkar, block, mute, öneriler, arama (trigram), user_stats sayaçları
- [ ] P6.2 Kendi profil ekranı: üst bölüm, sayaçlar, güven/seviye, bio, butonlar, rozetler şeridi
- [ ] P6.3 ProfileTabs: Izgara (3 sütun, rozetler, halka, soluk sona erenler, metin kareleri), Harita sekmesi, Kaydedilenler, Doğrulamalar
- [ ] P6.4 Başka kullanıcı profili: FollowButton durumları, Mesaj, ortak takipçiler, gizli hesap kilidi, ⋯ menüsü
- [ ] P6.5 Takipçi/takip listeleri + arama + takipçi çıkarma
- [ ] P6.6 Takip istekleri ekranı (gizli hesap)
- [ ] P6.7 Profili düzenle: avatar (foto veya illüstrasyon seti), ad, kullanıcı adı (canlı kontrol, 14 gün kuralı), bio, şehir, bağlantı
- [ ] P6.8 Kaydedilenler: koleksiyonlar, sinyal/yer kaydetme, cihazdaki kayıtlı yerlerin sunucuya göçü (`/me/saved/import`)
- [ ] P6.9 Profil paylaş: link + QR kodu; derin link `/u/{username}`
- [ ] P6.10 Güven puanı açıklama sayfası, seviye ilerleme; rozet detayları
- [ ] P6.11 Engelleme sonrası içerik anında her yerden kalkar (React Query önbellek temizliği)
**Kabul:** Gizli hesabı takip et → istek → kabul → içerik görünür; engelle → iki taraf da birbirini göremiyor (entegrasyon testi); profil herkese açık yanıtında e-posta yok; kayıtlı yerler iki cihazda aynı.

---

## Faz 7 — Keşfet akışı ve hikayeler
**Oku:** 05 (§2–3), 10 (§7)
- [ ] P7.1 Backend: `/feed/nearby` (skor + çeşitlilik), `/feed/following`, yer durum şeridi, önerilen kişiler
- [ ] P7.2 Keşfet ekranı: başlık (arama, zil), StoryTray, Yakınımda|Takip, filtreler, yarıçap seçici
- [ ] P7.3 SignalCard feed varyantı; yer durum kartları şeridi; önerilen kişiler kartı; boş durumlar
- [ ] P7.4 Çekerek yenile, sonsuz kaydırma, sekmeye tekrar dokun = başa kaydır
- [ ] P7.5 Backend: stories tray, kullanıcı hikayeleri, seen, viewers
- [ ] P7.6 StoryTray (harita + keşfet) sıralama ve görüldü durumları
- [ ] P7.7 Hikaye görüntüleyici: ilerleme çubukları, dokun/tut/kaydır hareketleri, kullanıcılar arası küp geçiş, ön yükleme
- [ ] P7.8 Hikayeye yanıt → DM (story_reply), görüntüleyenler listesi (kendi hikayen), hikayeden kaldır
**Kabul:** Takip edilen kişi hikaye paylaşınca şeritte görülmemiş halkayla çıkar; izlenince gri halka; Yakınımda sıralaması aynı yazarı art arda göstermiyor.

---

## Faz 8 — Sohbet yenileme
**Oku:** 06 (§7), 09 (§9, §11)
- [ ] P8.1 Backend: konuşmalar, mesajlar (idempotent client_id), okundu, istek klasörü, dm_policy, snap aç/tek sefer, geri al, tepki
- [ ] P8.2 Konuşma listesi: Snapchat durum ikonları, okunmamış, mesaj istekleri, hızlı kamera, kaydırma eylemleri
- [ ] P8.3 Sohbet ekranı: balonlar, gruplama, gün ayırıcı, okundu, yazıyor, çevrimiçi
- [ ] P8.4 Mesaj tipleri: text, snap, media, signal_share (SharedSignalBubble), story_reply, system
- [ ] P8.5 Mesaj eylemleri: tepki, yanıtla (alıntı), kopyala, geri al, bildir
- [ ] P8.6 Snap görüntüleyici (tek sefer, 10 sn), ekran görüntüsü bildirimi
- [ ] P8.7 Sinyali sohbete paylaş (karttan ve detaydan)
- [ ] P8.8 Yeni sohbet (kişi seçici), mesaj izni yoksa istek olarak gönderim
- [ ] P8.9 Mevcut sohbet verisinin yeni yapıya geçişi
**Kabul:** Snap bir kez açılır, ikinci açma denemesi reddedilir ve medya URL'si süresi dolmuş olur; iki cihaz arasında yazıyor/okundu anlık; dün ve bugün mesajları gün ayırıcıyla ayrılıyor.

---

## Faz 9 — Bildirimler
**Oku:** 06 (§8), 07 (§7)
- [ ] P9.1 Backend: notification satırları, gruplama (group_key, 6 sa pencere), tercihler, sessiz saatler, `notify.fanout`
- [ ] P9.2 Push: cihaz kaydı, Expo Push gönderimi, geçersiz token temizliği, push metinleri tr/en
- [ ] P9.3 Bildirimler ekranı: gruplar (Bugün/Bu hafta/Daha önce), takip istekleri girişi, satır içi eylemler (Geri takip et)
- [ ] P9.4 Derin link yönlendirme (bildirime dokun → doğru ekran, uygulama kapalıyken de)
- [ ] P9.5 Tüm tetikleyiciler: follow, follow_request/accept, reaction, comment, reply, mention, verify, place_update, question, badge_earned, signal_expiring
- [ ] P9.6 Rozet sayıları: tab bar (Sohbet), zil; uygulama ikonu rozeti
- [ ] P9.7 Bildirim tercihleri ekranı
**Kabul:** 20 kişi aynı sinyale tepki verince tek gruplanmış bildirim; sessiz saatte push gitmiyor (uygulama içi satır oluşuyor); kapalı uygulamada push'a dokununca doğru sinyal açılıyor.

---

## Faz 10 — Güvenlik, gizlilik, moderasyon
**Oku:** 11 (tamamı)
- [ ] P10.1 Metin filtresi (tr/en, normalizasyon), kişisel veri kalıbı uyarısı ve maskeleme
- [ ] P10.2 Görsel moderasyon sağlayıcı soyutlaması (`MODERATION_PROVIDER`), auto_hide
- [ ] P10.3 Rapor akışı (UI: neden seçimi + not), ağırlıklı rapor skoru, auto_hide
- [ ] P10.4 Admin uç noktaları + minimal admin sayfası/CLI; yaptırım merdiveni; kullanıcıya bildirim
- [ ] P10.5 Hassas yer kuralları (uyarı, okulda medya kapalı, HealthNotice + ülke acil numarası)
- [ ] P10.6 18 yaş altı varsayılanları
- [ ] P10.7 Hesap silme (2 adım, 30 gün, purge işi) + geri alma; veri indirme talebi
- [ ] P10.8 Konum gizliliği denetimi: log/analitik/hata raporlarında konum yok (otomatik test); ev bulanıklaştırma kuralı
- [ ] P10.9 Yetkilendirme test paketi (başkasının kaynağına erişim denemeleri)
- [ ] P10.10 Topluluk kuralları, kullanım şartları, gizlilik politikası ekranları (metinler yer tutucu + hukuki inceleme notu)
**Kabul:** 11 §7 kontrol listesinin tamamı işaretli; yetkilendirme testleri geçiyor.

---

## Faz 11 — i18n, erişilebilirlik, performans, analitik
**Oku:** 12 (tamamı)
- [ ] P11.1 Tüm ekranlarda eksik çeviri taraması; CI anahtar eşitliği kontrolü
- [ ] P11.2 Birim/saat/sayı yerelleştirmesi; RTL hazırlık denetimi (start/end)
- [ ] P11.3 a11y geçişi: etiketler, roller, dokunma alanları, VoiceOver ile ana akışlar, "Liste olarak göster"
- [ ] P11.4 Hareketi Azalt desteği her animasyonda
- [ ] P11.5 Performans ölçümü (bütçe tablosu) ve iyileştirmeler; harita 300 pin testi
- [ ] P11.6 Analitik soyutlaması + olay şeması + rıza ayarı
- [ ] P11.7 Onboarding akışı (06 §10) ve ilk görev kartı
**Kabul:** Uygulama İngilizce'de baştan sona Türkçe metin göstermiyor; VoiceOver ile sinyal oluşturulabiliyor; bütçe tablosundaki hedefler ölçülüp PROGRESS.md'ye yazıldı.

---

## Faz 12 — QA, seed data, yayın hazırlığı
**Oku:** 14 (tamamı)
- [ ] P12.1 Seed script'i: demo kullanıcılar, yerler, gerçekçi sinyaller, sohbetler (14 §2); mevcut kullanıcıya bağlı 20.035 seed sinyal temizliği
- [ ] P12.2 E2E senaryoları (14 §3) — Maestro veya Detox
- [ ] P12.3 Hata takibi (Sentry) mobil + backend
- [ ] P12.4 Uygulama ikonu, splash, mağaza ekran görüntüleri için demo modu
- [ ] P12.5 İzin metinleri (Info.plist / AndroidManifest) tr + en
- [ ] P12.6 Yayın kontrol listesi (14 §5)
**Kabul:** Tüm E2E senaryoları geçiyor; 14 §5 listesi işaretli.

---

## Faz 13 — (Opsiyonel / V1.1)
- [ ] P13.1 Arkadaş konumu (Ghost Mode varsayılan açık, süreli paylaşım, yalnızca arkadaşlar)
- [ ] P13.2 Yakın arkadaşlar listesi (`close_friends` görünürlüğü)
- [ ] P13.3 Grup sohbeti
- [ ] P13.4 Şehir lider tablosu, haftalık "en yardımsever" kartları
- [ ] P13.5 Cihaz üzerinde yüz bulanıklaştırma önerisi
- [ ] P13.6 Yer "genelde ne kadar kalabalık" saatlik grafiği (geçmiş sinyallerden)
- [ ] P13.7 Isı haritası katmanı (gerekirse Mapbox'a geçiş kararı)
- [ ] P13.8 #etiket araması ve etiket sayfaları
