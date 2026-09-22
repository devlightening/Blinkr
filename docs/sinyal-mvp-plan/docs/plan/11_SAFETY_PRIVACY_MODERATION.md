# 11 — Güvenlik, Gizlilik, Moderasyon ve Mağaza Uyumluluğu

> Konum tabanlı + fotoğraflı bir sosyal ağ, kötüye kullanıma en açık ürün türlerinden biridir. Bu
> dosyadaki kurallar "sonra eklenecek" değil; her fazda ilgili kısım uygulanır. Faz 10 eksikleri kapatır.
> Hukuki metinler (gizlilik politikası, kullanım şartları) için bir hukukçudan görüş alınmalıdır;
> bu doküman teknik gereksinimleri tanımlar.

## 1. Konum gizliliği (en kritik)
- Gerçek konum (`signals.location`) API'de, loglarda, analitikte, hata raporlarında **yer almaz**.
  Sentry/pino için konum alanlarını maskeleyen serializer yazılır.
- Gösterim yalnızca `display_location` (bkz. `10` §3). Mesafeler 10 m'ye yuvarlanır.
- Profil harita sekmesi kullanıcı ayarıyla kapatılabilir; açıkken yalnızca yer bazlı sinyaller ve
  500 m ızgaraya oturtulmuş yer'siz sinyaller gösterilir (ev konumu tahmini önlenir).
- Medyadaki EXIF/GPS metaverisi sunucuda **zorunlu** olarak silinir (worker), istemci de yüklemeden
  önce siler (çift güvence).
- Arkadaş konumu özelliği (V1.1) varsayılan kapalı, yalnızca karşılıklı arkadaşlara, süreli.
- Harita üzerinde "bu kullanıcının son 7 günde nerelerde olduğu" türünden birleştirilmiş görünüm
  başka kullanıcılara sunulmaz.

## 2. KVKK / GDPR / global gizlilik
- **Aydınlatma + açık rıza:** Onboarding'de gizlilik politikası ve kullanım şartları onayı; konum
  işleme amacı açık yazılır. Pazarlama bildirimi ayrı ve opsiyonel onay.
- **Veri minimizasyonu:** Doğum tarihi yerine doğum yılı; şehir opsiyonel; telefon numarası MVP'de yok.
- **Hesap silme:** Uygulama içinden (App Store 5.1.1(v) zorunluluğu). 30 gün geri alma süresi, sonra
  `account.purge`: kullanıcı satırı anonimleştirilir, medya silinir, sinyaller silinir, mesajlar
  "Silinmiş kullanıcı" olarak kalır (karşı tarafın sohbet bütünlüğü için metin silinir).
- **Veri indirme talebi:** MVP'de Ayarlar'dan talep → destek e-postası kuyruğu; V1.1'de otomatik ZIP.
- **Saklama süreleri:** Süresi dolmuş sinyal medyası 1 yıl (kullanıcı "süresi bitince sil" seçtiyse 7 gün),
  snap medyası açıldıktan sonra en geç 24 sa, raporlanan içerik inceleme bitene kadar + 90 gün,
  gerçek konum kolonu 30 gün sonra `display_location` ile üzerine yazılır (veri minimizasyonu).
- Veri bölgesi: Kullanıcı tabanı AB'ye açılırsa AB veri merkezi değerlendirilir (DECISIONS.md).

## 3. Hassas yerler ve üçüncü kişilerin mahremiyeti
- `places.is_sensitive = true`: sağlık (hastane, klinik, eczane), ibadet, okul/kreş, sığınma evi, adliye.
- Bu yerlerde kamera açıldığında tek seferlik (yer başına) uyarı: "Burada çekim yaparken başkalarının
  yüzlerini paylaşma. İnsanların mahremiyetine saygı göster." + "Anladım".
- Okul/kreş kategorisinde **fotoğraf/video paylaşımı kapalı**, yalnızca metin sinyali (çocuk güvenliği).
- Sağlık yerlerinde Sinyal Kartı ve yer sayfasında kalıcı `HealthNotice`: "Acil bir durumdaysan 112'yi
  ara ya da en yakın acile git. Bekleme süreleri kullanıcı bildirimidir." (Ülkeye göre acil numarası:
  TR 112, AB 112, ABD 911, UK 999 — `i18n` + ülke kodu.)
- V1.1: Cihaz üzerinde yüz algılama (ML Kit / Vision) ile paylaşım öncesi "Yüzleri bulanıklaştır"
  önerisi (yazar dışındaki yüzler).

## 4. Moderasyon hattı
```
İçerik oluşturuldu → (senkron) metin filtresi → yayınla
                                   │ ağır ihlal (tehdit, nefret, doxxing kalıbı) → 422 CONTENT_BLOCKED
                   → (asenkron) moderation.text / görsel moderasyon
                                   │ skor > eşik → moderation='hidden' (auto_hide) + inceleme kuyruğu
                   → raporlar → ağırlıklı rapor skoru ≥ 3 (raporlayanın güveniyle ağırlıklı) → auto_hide
                   → inceleme (admin) → restore | remove (+ kullanıcıya uyarı / askıya alma)
```
- **Metin filtresi:** tr + en küfür/hakaret listeleri (leetspeak ve Türkçe karakter varyasyonlarıyla
  normalize: `ı→i, ş→s, 0→o, 1→i, @→a` …). Hafif küfür → yayınlanır ama akış sıralamasında cezalandırılır
  ve "Hassas içerik" etiketi alabilir; hedefli hakaret/tehdit → engellenir.
- **Kişisel veri kalıpları:** Telefon numarası, TC kimlik numarası, plaka, açık adres kalıbı açıklamada
  varsa uyarı: "Kişisel bilgi paylaşmak üzeresin" ve plakalar/TC no. otomatik maskelenir.
- **Görsel moderasyon:** `MODERATION_PROVIDER` ile takılabilir sağlayıcı (none | openai | aws-rekognition |
  google-safesearch). `none` iken yalnızca rapor tabanlı çalışır. Çıplaklık/şiddet skoru yüksekse auto_hide.
- **Rapor nedenleri:** Spam, Taciz/zorbalık, Nefret söylemi, Çıplaklık/cinsel içerik, Şiddet,
  Yanlış bilgi, Mahremiyet ihlali (benim/başkasının görüntüsü izinsiz), Kendine zarar, Diğer.
  "Kendine zarar" raporu önceliklidir ve kullanıcıya yardım kaynakları gösterilir.
- **Admin:** MVP'de basit korumalı admin uç noktaları (`/admin/reports`, `/admin/actions`) ve rolü
  `admin` olan kullanıcılar için minimal web sayfası (tek HTML sayfası yeterli) veya en azından CLI script.
- **Yaptırımlar:** uyarı → 24 sa paylaşım kısıtı → 7 gün askı → kalıcı kapatma. Her yaptırım
  `moderation_actions`'a yazılır, kullanıcıya uygulama içi bildirim + itiraz e-postası bilgisi.

## 5. Yaş ve çocuk güvenliği
- Minimum yaş 13; AB ülkelerinde yerel dijital rıza yaşına göre (13–16) ayarlanabilir tablo.
- 18 yaş altı hesaplar: varsayılan gizli hesap, DM yalnızca arkadaşlardan, konum tabanlı "Soru sor"
  bildirimleri kapalı, profil harita sekmesi kapalı, yetişkinlerin önerilen kişiler listesinde
  gösterilmez. (Yaş, onboarding'deki doğum yılından.)
- Okul/kreş yerlerinde medya paylaşımı kapalı (bkz. §3).

## 6. Hesap güvenliği
- Şifre: argon2id, min 8 karakter, sızdırılmış şifre kontrolü (HIBP k-anonymity, opsiyonel).
- Giriş brute-force koruması (rate limit), yeni cihaz girişinde e-posta bildirimi (V1.1).
- Refresh token rotasyonu + yeniden kullanım tespiti. Ayarlar > Hesap > "Aktif oturumlar" (V1.1).
- Tüm trafik HTTPS/WSS; sertifika sabitleme gerekmez (MVP).
- Presigned URL'ler kısa ömürlü; bucket'lar public-write değil.
- Girdi doğrulama her uç noktada (zod); SQL yalnızca parametreli.
- Yetkilendirme testleri: başka kullanıcının sinyalini silme/düzenleme, gizli hesabın sinyalini okuma,
  engelleyen kullanıcının içeriğini görme → 403/404 döndüğü entegrasyon testleriyle kanıtlanır.

## 7. App Store / Google Play UGC gereksinimleri (kontrol listesi)
- [ ] Kullanım şartları (EULA) kabulü ve istenmeyen içeriğe sıfır tolerans ifadesi
- [ ] İçerik filtreleme mekanizması (§4)
- [ ] Her içerik ve kullanıcı için "Bildir"
- [ ] Kullanıcı engelleme (engelleyince içerik anında akıştan kalkar)
- [ ] Raporlara 24 saat içinde müdahale taahhüdü (süreç dokümante)
- [ ] Uygulama içinde iletişim/destek bilgisi
- [ ] Uygulama içinden hesap silme
- [ ] Sign in with Apple (başka sosyal giriş varsa)
- [ ] Konum, kamera, fotoğraf, bildirim izin açıklama metinleri (`Info.plist` usage descriptions, tr + en)
- [ ] Gizlilik "beslenme etiketi" (App Privacy) ve Play Data Safety formu doğru doldurulmuş
- [ ] Arka plan konumu KULLANILMAZ (yalnızca "uygulama kullanılırken")
