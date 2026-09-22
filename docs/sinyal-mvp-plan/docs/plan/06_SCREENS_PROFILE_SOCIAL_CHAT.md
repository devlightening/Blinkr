# 06 — Profil, Sosyal Grafik, Kaydedilenler, Sohbet, Bildirimler, Ayarlar, Onboarding

## 1. Kendi profilin (`profile`) — tamamen yeniden tasarım

```
┌───────────────────────────────────────┐
│ @ahmet ▾                     ＋   ☰   │  ← kullanıcı adı (hesap değiştir V2) · oluştur · menü
│  ╭────╮    128       1.204     340     │
│ │ (◉) │   Sinyal   Takipçi   Takip     │  ← Bricolage, tabular rakamlar
│  ╰────╯                                │  ← avatar + aktif hikaye halkası
│ Ahmet Yılmaz                           │  headline
│ 🛡 Güven 82 · Rehber · 📍 Osmaniye     │  ← güven puanı + seviye + şehir (opsiyonel)
│ Osmaniye'nin nabzı burada.             │  bio (150 karakter)
│ ◉◉◉ gamze, baris ve 12 kişi takip ediyor│ ← (başka profillerde) ortak takip
│ [Profili düzenle] [Profili paylaş] [👤+]│
│ ── Rozetler ── (yatay)                 │
│ 🏅İlk sinyal 🔥7 gün seri ✅50 doğrulama│
│ ─────────────────────────────────────  │
│   ▦        🗺        🔖        ✓       │  ← ProfileTabs
│ ▦ ▦ ▦                                  │
│ ▦ ▦ ▦   ← ızgara                        │
└───────────────────────────────────────┘
```

### 1.1 Üst bölüm
- **E-posta ASLA gösterilmez** (mevcut hata #5). Yalnızca Ayarlar > Hesap'ta.
- **Sayaçlar:** Sinyal (arşiv hariç görünür sinyaller), Takipçi, Takip. Dokununca liste ekranı.
  Büyük sayılar yerelleştirilmiş kısaltma: `1,2 B` (tr) / `1.2K` (en).
- **Güven puanı + seviye:** Dokununca açıklama alt sayfası ("Güven puanın, paylaştığın sinyallerin
  başkalarınca doğrulanmasıyla artar.") + seviye ilerleme çubuğu.
- **Seviyeler:** Çaylak (0–99 puan XP) → Gözcü → Rehber → Usta Rehber → Şehir Elçisi. XP:
  sinyal +5, doğrulanan sinyal (her doğrulama) +2, başkasını doğrulama +1, "Teşekkürler" tepkisi +3.
- **Rozetler:** İlk sinyal, İlk doğrulama, 7/30 gün seri, 50/500 doğrulama, Gece kuşu (22–06 arası 10
  sinyal), Kaşif (10 farklı yer), Yardımsever (50 teşekkür). Kilitli rozetler gri, dokununca koşulu.
- **Butonlar:** Profili düzenle, Profili paylaş (link + QR kodu), Kişi bul (öneriler + rehber davet).
- **☰ menü:** Ayarlar, Kaydedilenler, Arşiv, QR kodum, Takip istekleri (gizli hesapsa), Oturumu kapat.

### 1.2 Sekmeler
| Sekme | İçerik | Görünürlük |
|---|---|---|
| ▦ Sinyaller | 3 sütun ızgara (kare kırpılmış küçük resim; tam görüntü detayda). Sol üstte TypeBadge ikonu, aktifse sağ üstte FreshnessRing, sona erenlerde hafif karartma. Metin sinyali = tip renkli kare + ikon + seviye | Herkese (görünürlük kurallarına göre) |
| 🗺 Harita | Kullanıcının sinyallerinin haritası (kümelenmiş, bulanık konum), "Ziyaret ettiği yerler" sayısı | Herkese (kullanıcı ayardan kapatabilir) |
| 🔖 Kaydedilenler | Koleksiyonlar: "Tümü", "Yerler", kullanıcı koleksiyonları | Yalnızca kendin |
| ✓ Doğrulamalar | Doğruladığın sinyaller | Yalnızca kendin |

- Anonim sinyaller yalnızca sahibinin ızgarasında "Anonim" rozetiyle görünür.
- Izgaraya uzun basma: önizleme (peek) + hızlı eylemler (Haritada göster, Arşivle, Sil).

## 2. Başka kullanıcının profili (`user/[username]`)
- Aynı düzen; butonlar: `[Takip et]` `[Mesaj]` `[▾]` (öneriler).
- **Takip durumu butonu:** Takip et → Takip ediliyor (dokununca alt sayfa: Yakın arkadaşlara ekle
  (V1.1), Sessize al, Takibi bırak) · İstek gönderildi (dokununca isteği geri çek) · Geri takip et
  (seni takip ediyorsa).
- **Arkadaş rozeti:** Karşılıklı takip → isim altında "Arkadaşsınız" küçük etiketi.
- **Gizli hesap:** Takip etmiyorsan: kilit ikonu + "Bu hesap gizli. Sinyallerini görmek için takip et."
  (sayaçlar görünür, ızgara ve harita gizli).
- **⋯ menü:** Bildir, Engelle, Sessize al (sinyal/hikaye), Profil bağlantısını kopyala, QR.
- Engellenmişsen: profil "Kullanıcı bulunamadı" gibi görünür (engellendiğini açık etme).

## 3. Takipçi / takip listeleri (`user/[username]/followers`)
- Sekmeler: Takipçiler · Takip · (kendi profilinde) Ortak / Önerilenler.
- Arama kutusu, UserRow + FollowButton, sonsuz kaydırma.
- Kendi takipçi listende her satırda ⋯ → "Takipçiyi çıkar".

## 4. Sosyal grafik kuralları
- **Takip (asimetrik):** A, B'yi takip eder. B açık hesapsa anında; gizliyse `pending` istek.
- **Arkadaş = karşılıklı takip** (ayrı tablo yok, sorgu ile). Snap gönderme ve varsayılan DM izni
  arkadaşlara açık.
- **Mesaj izni (Ayarlar > Gizlilik):** Herkes · Takip ettiklerim · Yalnızca arkadaşlar (varsayılan:
  Takip ettiklerim). İzin dışındakilerden gelen mesaj "Mesaj istekleri" klasörüne düşer.
- **Engelleme:** İki yönlü görünmezlik: birbirinin profilini, sinyalini, yorumunu, hikayesini göremez;
  takip ilişkileri silinir; DM kapanır; haritada pinleri gizlenir.
- **Sessize alma:** Takip sürer; kişinin sinyalleri/hikayeleri akışta ve şeritte görünmez. Karşı taraf
  bilmez.
- **Kısıtlama (restrict, V1.1):** Yorumları yalnızca kendisine görünür.
- **Öneriler:** Ortak takip sayısı, yakınlık (son 30 günde aynı yerlerde sinyal), rehber eşleşmesi
  (kullanıcı izin verirse, telefon numarası hash'li), popüler yerel katkıcılar.

## 5. Profili düzenle (`edit-profile`)
- Avatar (kamera/galeri, kare kırpma, 512px'e küçült; ya da mevcut illüstrasyon avatarlardan seç —
  mevcut sevimli avatar seti korunur ve "avatar oluşturucu" olarak sunulur).
- Ad (30), Kullanıcı adı (3–20, `a-z 0-9 _ .`, 14 günde bir değiştirilebilir, canlı uygunluk kontrolü),
  Bio (150), Şehir (opsiyonel, yalnızca şehir seviyesi), Web bağlantısı (opsiyonel).
- Gizli hesap anahtarı burada da kısayol olarak.

## 6. Kaydedilenler (`saved`)
- Sunucuda saklanır (mevcut "Bu cihazda saklanır" kaldırılır). İlk girişte cihazdaki kayıtlı yerler
  `POST /v1/me/saved/import` ile sunucuya taşınır, sonra yerel kayıt silinir.
- Kaydedilebilenler: Sinyal, Yer. Koleksiyonlar: "Tümü" (otomatik), "Yerler" (otomatik), kullanıcı
  koleksiyonları (ad + kapak).
- Kaydedilen sinyal sona erse de kayıtta kalır (soluk, "Sona erdi"). Silinirse "Bu sinyal artık yok".
- Kaydedilen yer: canlı durum rozetiyle listelenir → "sık gittiğim yerlerin durumu" paneli gibi
  çalışır. Yer satırında zil ikonu = takip et (bildirim).

## 7. Sohbet

### 7.1 Konuşma listesi (`chat`)
```
┌───────────────────────────────────────┐
│ Sohbet                          ✎     │
│ [🔍 Ara                            ]   │
│ Mesaj istekleri (2) ›                  │
│ (◉) gamze_tekin          ■ Yeni snap   │  ← kırmızı dolu kare = açılmamış foto snap
│     14:19                              │
│ (◉) sibel_dogan   Olur, teşekkürler  ●  │  ← okunmamış noktası
│     Dün                                │
│ (◉) baris_cakir   Sen: Tamam 18:00 olsun│
│     Pzt                          📷    │  ← hızlı snap kamerası
└───────────────────────────────────────┘
```
- Snapchat durum dili: ■ kırmızı dolu = açılmamış foto snap, ▶ mor dolu = açılmamış video snap,
  □ boş = açıldı, ➤ = gönderildi, ↩ = ekran görüntüsü alındı (iOS'ta algılanabildiği kadarıyla).
- Satır kaydırma: Sessize al, Sil (yalnızca kendin için).
- Çevrimiçi yeşil nokta (kullanıcı ayardan kapatabilir: "Aktiflik durumunu göster").

### 7.2 Sohbet ekranı (`chat/[id]`)
```
┌───────────────────────────────────────┐
│ ← (◉) gamze_tekin · aktif          📷 │
│              Dün                        │  ← gün ayırıcı (mevcut hata #10)
│ ┌───────────────────────┐              │
│ │Gamze, çocuk parkı bu  │              │  giden: mint zemin, sağda
│ │saatte nasıl?     16:34│              │
│ └───────────────────────┘              │
│ ┌──────────────────┐                   │  gelen: surface zemin, solda
│ │Şu an neredeyse boş│                  │
│ └──────────────────┘                   │
│              Bugün                      │
│ ➤ Snap gönderildi · 14:19              │  ← SnapBubble
│ ┌ SharedSignalBubble ────────────┐     │  ← paylaşılan sinyal kartı
│ │ [küçük medya] ⏱ Bekleme 5–15 dk│     │
│ │ Özel Yeni Hayat Hastanesi      │     │
│ └────────────────────────────────┘     │
│                    Görüldü 14:21        │
│ gamze yazıyor…                          │
│ [📷] [ Mesaj                ] [😊][➤]   │
└───────────────────────────────────────┘
```
- **Balonlar:** Ardışık mesajlar gruplanır (köşe yarıçapları grup içinde küçülür), zaman damgası
  yalnızca grup sonunda veya kaydırarak (sola çek = tüm zamanlar, iMessage tarzı).
- **Mesaj tipleri:** text, snap (foto/video, bir kez), media (kalıcı foto), signal_share, story_reply,
  system ("Arkadaş oldunuz").
- **Mesaja uzun basma:** tepki (❤️ 😂 😮 👍 🙏), yanıtla (alıntılı), kopyala, (kendi mesajınsa) geri
  al (herkesten sil), bildir.
- **Snap görüntüleyici (`snap/[id]`):** Tam ekran, 10 sn sayaç (video kendi süresi), dokununca kapanır,
  açıldıktan sonra sunucudan medya erişimi kaldırılır (URL süresi dolar, obje 24 saat içinde silinir).
  Tekrar oynatma yok (MVP).
- **Okundu, yazıyor, çevrimiçi:** Socket olayları (`09_API_SPEC.md` §9).
- **Yeni sohbet (`chat/new`):** Kişi arama, önce arkadaşlar; izin yoksa "Mesaj isteği" olarak gider.
- Grup sohbeti V1.1.

## 8. Bildirimler (`notifications`)
```
┌───────────────────────────────────────┐
│ Bildirimler                    ⚙      │
│ [Takip istekleri (3) ›]                │
│ ── Bugün ──                            │
│ (◉) gamze seni takip etmeye başladı [Geri takip et] │
│ (◉) 12 kişi sinyalini doğruladı ✓   [▦]│
│ (◉) ayse sinyaline yorum yaptı: "aynen…" [▦]│
│ 🔔 Özel Yeni Hayat Hast.: bekleme 5–15 dk'ya düştü │
│ ── Bu hafta ──                          │
└───────────────────────────────────────┘
```
- **Tipler:** follow, follow_request, follow_accept, reaction (gruplanır: "ayse ve 23 kişi"),
  comment, comment_reply, mention, verify (gruplanır), place_update (takip edilen yer), question
  (yakındaki soru), badge_earned, signal_expiring ("Sinyalin 10 dk sonra haritadan kalkacak · Hâlâ
  böyle mi?" — sahibine), system.
- Gruplama sunucuda (aynı hedef + tip + 6 saat penceresi).
- Dokununca ilgili ekrana deep link. Okundu işaretleme ekran açılınca toplu.
- **Push:** Aynı tipler, kullanıcı tercihine göre. Sessiz saatler (varsayılan 23:00–08:00, yalnızca
  DM ve takip edilen yer hariç sessiz). Push metinleri kullanıcının dilinde.

## 9. Ayarlar (`settings`)
- **Hesap:** E-posta (maskeli), şifre değiştir, bağlı hesaplar (Apple/Google), **Hesabı sil** (App
  Store zorunluluğu: 2 adım onay, 30 gün içinde geri alınabilir, sonra kalıcı silme işi), verilerimi
  indir (KVKK/GDPR, V1.1'de otomatik; MVP'de talep kaydı).
- **Gizlilik:** Gizli hesap, kim mesaj atabilir, aktiflik durumu, varsayılan sinyal görünürlüğü,
  varsayılan anonim, profilde harita sekmesi, sinyallerimi arşivde tut / süresi bitince sil,
  engellenenler, sessize alınanlar.
- **Bildirimler:** Tip bazında aç/kapa, sessiz saatler, yer takip bildirimleri.
- **Konum:** İzin durumu, "Yakınımdaki sorular için bildirim al" (varsayılan açık), hassas konum
  paylaşmama bilgisi.
- **Görünüm:** Sistem / Koyu / Açık · Dil · Birimler (km/mi, otomatik).
- **Hakkında:** Topluluk kuralları, Kullanım şartları, Gizlilik politikası, Lisanslar, İletişim/Destek,
  sürüm.

## 10. Onboarding
1. **Hoş geldin (3 slayt):** "Şu an orada ne oluyor, gör." · "Oradaysan paylaş, başkalarına yardım et."
   · "Doğrula, güven kazan." Altta Apple ile devam et / Google ile devam et / E-posta.
2. **Kullanıcı adı:** Canlı uygunluk kontrolü, öneriler (ad + sayı).
3. **Profil:** Ad, avatar (illüstrasyon setinden seç veya foto), doğum yılı (13 yaş altı kayıt olamaz;
   yaş sınırı ülkeye göre `11_SAFETY` §5).
4. **İzinler (sırayla, her biri önce uygulama içi açıklama sonra sistem diyaloğu):**
   Konum ("Yakınındaki canlı sinyalleri göstermek için") → Bildirim → Kamera (ilk paylaşımda istenir,
   onboarding'de değil).
5. **Takip önerileri:** Yakındaki aktif katkıcılar + popüler yerler (yer takip et). Atla butonu.
6. **İlk görev kartı (haritada):** "İlk sinyalini bırak — oradaysan 10 saniye sürer." (1 kez).

## 11. Arama (`search`)
- Sekmeler: Üst sonuçlar · Kişiler · Yerler. Son aramalar (silinebilir).
- Kişi araması: kullanıcı adı ve ad üzerinde trigram (pg_trgm). Yer araması: ad + kategori, konuma
  yakınlık ağırlıklı.
