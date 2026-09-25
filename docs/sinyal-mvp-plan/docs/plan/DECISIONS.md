# DECISIONS — Mimari Karar Kaydı

> Plandan saptığın, stack'e uyarladığın veya kullanıcıdan onay aldığın her karar buraya yazılır.
> En yeni en üstte. Kısa tut: bağlam birkaç cümle, karar tek cümle.

## Şablon
```
### D-XXX — Başlık (YYYY-AA-GG)
- Bağlam: Neden bu karar gerekti?
- Seçenekler: A / B / C
- Karar: Seçilen seçenek
- Gerekçe: Neden?
- Etki: Hangi dokümanlar/fazlar etkileniyor?
```

## Kararlar

### D-031 — Refresh token erişim token'ı olarak kabul edilmez (2026-09-25)
- Bağlam: BLK-TOKENS-01 (servisler arası token kuralları testi) gerçek bir açık buldu: refresh token aynı anahtarla imzalı, aynı issuer/audience'lı bir JWT ve dört servis de onu erişim token'ı olarak kabul ediyordu. Sızan bir refresh token 7 gün boyunca API erişimi veriyordu; "diğer cihazlardan çıkış" da onu durduramıyordu (JWT süresi dolana kadar geçerliydi).
- Karar: Her servisin JwtBearer `OnTokenValidated` olayı `token_use=refresh` taşıyan token'ı reddeder (`BlinkrJwtOptions.IsAccessToken`; claim'siz eski erişim token'ları süresi dolana kadar geçerli). Test kalıcı: doğru token kabul, yanlış audience/issuer, süresi dolmuş, yanlış anahtar, `alg: none`, değiştirilmiş payload ve refresh token 401.
- Etki: CLAUDE.md §14, SECURITY.md.

### D-030 — Güvenlik S3: hız sınırları kişi başına, giriş koruması, şifre en az 8 (2026-09-25)
- Bağlam: V2 kapanışında iki kök hata bulundu: (1) Blog'un genel sınırı (100 istek/dk) ve Redis kovası bağlantı IP'sine göre sayıyordu; Gateway arkasında herkesin IP'si aynı olduğundan üretimde tüm kullanıcılar tek kovayı paylaşacaktı (testlerde 429'ların nedeni). Redis ara katmanı kimlik doğrulamadan önce çalıştığından kullanıcı hiç bilinmiyordu. (2) Kayıtta şifre uzunluğu kuralı yoktu; yanlış girişte düz İngilizce "Invalid credentials." dönüyordu.
- Karar:
  - Blog: sınırlar kimlik doğrulamadan sonra çalışır ve kişiye göre sayar (kullanıcı → cihaz başlığı → Gateway'in X-Forwarded-For ilk adresi). Yeni politikalar: gönderi oluşturma (10, 3/dk dolum), yorum (20, 12/dk), tepki/beğeni (60, 60/dk).
  - Identity: giriş/kayıt IP başına kayan pencere (`RateLimits:AuthPerMinute`, varsayılan 30; Development 2000); bir hesap 15 dk içinde 10 kez yanlış girilirse doğru şifreyle bile 15 dk 429 `TOO_MANY_ATTEMPTS` (başarı sayacı sıfırlar). Bellek içi: tek örnek için; çok örnekte Redis gerekir.
  - Notifications: sohbet mesajı ve snap kişi başına 60/dk (`RateLimits:ChatPerMinute`), 429 `TOO_MANY_MESSAGES`.
  - Kayıt şifresi 8-128 karakter (`PASSWORD_TOO_SHORT`/`PASSWORD_TOO_LONG`); yanlış giriş 401 `INVALID_CREDENTIALS`. Uygulama bu kodları kendi dilinde gösterir (`authErrors.ts`), kayıt formunda "En az 8 karakter".
  - Kabul: `test-rate-limits.ps1` (BLK-RATELIMIT-01); `test-auth-gateway-smoke` kodları denetler; `test-text-filter` kalabalık alana düşmesin diye kendi noktasında.
- Etki: SECURITY.md S3/S4, CLAUDE.md §13/§20.1.

### D-029 — V2-7: gruplu bildirimler ve paylaşım menüsü (2026-09-25)
- Karar:
  - Aynı gönderiye tepkiler (`reaction:{postId}`) ve aynı hikayeye beğeniler (`story_like:{storyId}`) 1 saat içinde tek bildirim satırında toplanır: `ActorIds` (herkes, aynı kişi iki kez sayılmaz), `ActorNames` (son 3, en yeni önce), `ActorCount`; metin sunucuda `GroupedText` ile ("a ve b ...", "a, b ve N kişi daha ..."). Büyüyen satır en üste çıkar ve yeniden okunmamış olur; aynı kişinin tekrar tepkisi yeni bir şey söylemez (push da gitmez). Yorumlar, takip, mention gruplanmaz (her birinin kendi metni/eylemi var). Planın ayrı `UpdatedAtUtc` alanı yerine `CreatedAtUtc` güncellenir (liste zaten ona göre sıralı).
  - Paylaşım menüsü mevcut `ShareToChatSheet`'in üstüne kuruldu (yeni sheet yok): bağlantıyı kopyala, diğer uygulamalar (RN `Share`; metin: sinyalin özeti + yer + `blinkr://posts/{id}`, paylaşanın adı asla), sohbette arkadaşa gönder. Web alan adı gelince bağlantı https olacak.
- Etki: CLAUDE.md §6.5, §12.1; PROGRESS_V2 7.1-7.2.

### D-028 — V2-5: SignalR ile gerçek zamanlılık, olaylar yalnız "değişti" der (2026-09-25)
- Karar:
  - Hub NotificationsService'te: `/hubs/realtime`, Gateway `/hubs/{**catch-all}` rotası (YARP WebSocket). Kimlik: JWT, WebSocket başlık taşıyamadığı için yalnız `/hubs` yolunda `?access_token=`; token hiçbir logda yok (`test-log-privacy`). Her bağlantı `user:{id}` grubuna girer.
  - Olaylar içerik taşımaz, yalnız kimlik: `message.created/updated/read`, `typing` `{ conversationId, userId }`; `comment.added/deleted/changed` `{ postId, commentId }`; `reaction.changed` `{ postId }`; `notification.created` `{ id, type }`. Planın `{ message }`/`{ comment }`/`{ counts }` yükleri uygulanmadı: anonimlik, `isMine/canDelete`, engeller ve "görüldü" gibi kişiye göre değişen kurallar REST uçlarında zaten var; olay yalnız "yenile" der, uygulama REST'ten çeker. Böylece gizlilik kuralı tek yerde kalır.
  - Sohbet olayları tek bir `RealtimeChatFilter` ile yazma başarılı olduktan sonra iki katılımcıya gider (yazıyor yalnız karşı tarafa); `notification.created` bildirim deposu dekoratöründen; yorum/tepki olayları ayrı kuyruklu `PostRealtimeConsumer`'dan `post:{id}` odasına. Odaya `JoinPost` ile girilir; NotificationsService, BlogService `GET /api/posts/{id}`'ye kişinin kendi token'ıyla sorar, okuyamıyorsa sessizce reddeder (var olup olmadığı söylenmez).
  - Yorum/tepki olayı okuma modelinden önce gelebilir (projeksiyon ve hub aynı olayı paralel tüketir): uygulama 0 / 0,8 / 2 / 4 sn'de, beklenen değişikliği görene kadar yeniler.
  - İstemci: tek bağlantı (`realtime.ts`), otomatik yeniden bağlanma (0, 2, 5, 10, 30 sn), katılınan odalar yeniden bağlanınca yeniden istenir, arka planda 30 sn sonra kapanır. Hub bağlıyken ekran yoklamaları 30 sn'lik güvenlik ağına iner, bağlı değilken eski hızına (sohbet 4 sn, liste 8 sn, yorum 8 sn) döner; hub olmadan her şey eskisi gibi çalışır. Yayın hatası yazmayı asla bozmaz.
  - Ölçek: tek örnekte bellek içi; çok örnekte Redis backplane gerekir (PERFORMANCE.md).
- Etki: CLAUDE.md §6.5, §13; API-SPEC §5; PROGRESS_V2 5.1-5.5.

### D-027 — V2-4: emoji tepkileri, yorum beğenisi, @mention, #hashtag (2026-09-24)
- Karar:
  - Tepki mevcut beğeni olayının üstündedir: `PostLikedEvent` + `Reaction` (null = ❤️, eski olaylar da böyle okunur) + `Replaces`. Planın "değiştirme = Unliked + Liked" önerisi uygulanmadı: iki ayrı kuyrukta sıra garanti değil, ters gelirse tepki kaybolurdu. Emoji değişimi tek olaydır, yazara ikinci bildirim gitmez. Worker her kişinin tepkisini zaman damgasıyla tutar (`Reactions[]`); eski tarihli mesaj yenisini ezemez, geri alma yalnız gerçekten silinen bir şey varsa sayıyı düşürür. `LikeCount`/`LikedByUserIds` aynen kalır, eski `/likes` ucu ❤️ olarak çalışır. Uç: `POST /api/posts/{id}/reactions { reaction }` → `{ reaction, counts }` (sayılar aggregate'ten, ekran projeksiyonu beklemez); kendi sinyaline 400 `CANNOT_LIKE_OWN`, set dışı 400 `INVALID_REACTION`.
  - Yorum beğenisi yeni olaylarla: `PostCommentLiked/UnlikedEvent` (+ integration event + worker consumer); kendi yorumunu beğenmek serbest; beğenenler listesi hiçbir API'de dönmez (yalnız `likeCount`, `likedByMe`). Yorum beğenisi bildirim üretmez.
  - @mention sunucu tarafında çözülür: istemci `mentionedUserIds` göndermez, BlogService metindeki adları okur ve IdentityService `POST /api/users/resolve`'a yazarın kendi token'ıyla sorar; silinmiş hesaplar ve iki yönlü engelliler düşer, 10'dan fazla ad 400 `TOO_MANY_MENTIONS`. Identity cevap vermezse metin mention'sız yayımlanır (mention bir nezakettir, sinyalin parçası değil). Çözülen kişiler olayda ad ile saklanır (`MentionRef`), okuma modeli bağlantıyı Identity'ye sormadan çizer. Bildirim `Mentioned` (9): gönderi sahibine zaten yorum bildirimi gidiyorsa ikinci kez söylenmez; anonim sinyalde ve anonim yazarın kendi yorumunda "Biri ..." denir, aktör yazılmaz.
  - #hashtag worker'da metinden çıkarılır, katlanmış saklanır (`TextTags.Fold`: küçük harf, Türkçe harfler ASCII, işaretler atılır; en fazla 10), içerik düzenlenince yeniden hesaplanır. `GET /api/discover/hashtag/{tag}`: son 7 gün, herkese açık, anonim sinyal ASLA (etiket yazar bulmanın yolu olmasın), engelliler düşer. `GET /api/discover/hashtags/search?q=`: son 30 günde öneke uyan etiketler. Eski gönderiler için geri doldurma yapılmadı (sinyaller saatler içinde bitiyor).
  - Kural tek yerde: `Shared.Events.Text.TextTags` / `ReactionCatalog` (Domain katmanı RabbitMQ bağımlılığı almasın diye kalp sabiti aggregate'te ayrıca durur); istemci `richText.ts` aynı kuralı uygular ve yalnız sunucunun çözdüğü @adı bağlantı yapar.
  - Mobil: `ui/ReactionButton` (dokun = ❤️ / geri al, uzun bas = 6 emoji, en çok kullanılanlar özet), `ui/RichText`, `ui/MentionSuggestions` (300 ms, 2+ harf, arkadaşlar önce). Etikete dokunmak Keşfet içinde etiket akışını açar (haritadaki karttan da).
- Etki: CLAUDE.md §6.2, §12.1, §13; API-SPEC; PROGRESS_V2 4.1-4.6.

### D-026 — V2-3: hikaye beğenisi, hızlı emoji, küp geçiş (2026-09-24)
- Karar:
  - `POST/DELETE /api/stories/{id}/like` (NotificationsService): hikayeyi görebilen herkes, kendi hikayesi hariç (400 `SELF`), yetkisize 403; iki yönde idempotent. İlk beğeni görüldü sayılır ve yazara bir kez `StoryLiked` bildirimi gider (geri alınıp yeniden beğenmek ikinci bildirim üretmez). Beğeni sayısı yalnız yazara döner (`likeCount`); izleyen yalnız kendi `likedByMe`'sini görür; görüntüleyenler listesinde beğenenler üstte ve kalpli.
  - Hızlı emoji (😂 😮 😍 😢 👏 🔥) ayrı bir tepki kaydı değil, mevcut "Hikayene yanıt" DM yoludur: yeni veri modeli ve bildirim türü gerekmedi.
  - Kişiler arası geçiş: yana kaydırma küp dönüşüdür (yüz paylaştığı kenarda döner, UI thread'de tek `face` değeri); Hareketi Azalt açıkken düz kayma. Aşağı kaydırma hikayeyi küçülterek kapatır, arkası görünür. Bir kaydırmanın bırakılışı dokunma bölgesine ayrıca dokunma sayılmaz (350 ms koruma; web'de RNGH Pressable'ı iptal etmiyordu).
  - Sonraki kişinin hikaye listesi önceden çekilir ve ilk fotoğrafı görünmez bir resimle önbelleğe alınır.
- Etki: CLAUDE.md §6.5 ve §13 Stories, PROGRESS_V2 3.2-3.5.

### D-025 — V2-2: Sinyal Kartı tam sayfaya büyür, tek video oynatıcı, paylaşılan bağlantı (2026-09-24)
- Karar:
  - Kart iki durakta: yüzen kart ve tam sayfa. Başlıktan yukarı çekmek, yorum düğmesi ya da (tek sinyalde) "Tam sayfa aç" kartı tüm ekrana büyütür; başlıktan aşağı çekmek ya da Geri kartı geri küçültür, karttan aşağı çekmek kapatır; Android geri tuşu da aynı sırayı izler. Tek `expand` değeri UI thread'de kenar boşluğunu, köşeyi ve yüksekliği (ölçülen kart yüksekliğinden ekran yüksekliğine) birlikte taşır.
  - Tam sayfa, mevcut `SignalThreadPanel`'i (`fill`, `hideActions`, `title`) yeniden kullanır: kart üstte, açıklamanın tamamı, tüm yorumlar ve altta sabit yorum kutusu. Planın "`useComments` hook'una çıkar" adımı yapılmadı: aynı bileşeni kullanmak aynı sonucu kod çoğaltmadan verdi. Eski ayrı yorum sayfası (ikinci sheet) kaldırıldı.
  - `signal/VideoPlayer` tüm videolar için tek bileşen: kartta sessiz döngü + ses düğmesi + ince ilerleme; tam ekran görüntüleyicide oynat/duraklat, sürüklenebilir ilerleme (sürüklerken durur, bırakınca kaldığı yerden), hız 1 → 1,25 → 1,5 → 2 → 0,5, ses; krom oynarken 3 sn sonra solar. Kurallar `videoControls.ts` (test). Kaydırmalı medyada yalnız görünen video oynar.
  - Paylaşılan bağlantı biçimi, bildirimlerin zaten kullandığı `blinkr://posts/{id}` (planda yazılan `/post/` değil); `app.json` `scheme: "blinkr"`. Bağlantı sinyali haritada açar; silinmiş/gizli sinyalde uygulama olduğu yerde kalır.

### D-024 — Blinkr V2: koyu varsayılan tema, marka gradyanı, Instagram tarzı alt çubuk (2026-09-24)
- Bağlam: Kullanıcı "Snapchat + Instagram = Blinkr" hedefiyle V2 planını onayladı (`docs/blinkr-v2/`); varsayılan tema olarak "Koyu tema + gradyan vurgular"ı, alt çubuk olarak Harita · Keşfet · (+) · Mesaj · Profil'i seçti.
- Karar:
  - Kayıtlı tercih yoksa tema **koyu** (`themeBoot.ts`); Ayarlar > Görünüm'de Sistem/Açık/Koyu seçimi kalır. Koyu yüzeyler: zemin #0E0F12, kart #17191D, yükseltilmiş #20232A.
  - Marka gradyanı `gradients.brand` = #FFC83D → #FF6B6B → #B06BFF (sol-alttan sağ-üste). Yalnız (+) oluştur, görülmemiş hikaye halkası, oluştur/gönder düğmeleri (`BlinkrButton variant="create"`) ve seçili sekme noktası; üstündeki metin koyu (`onCreate`), üç durakta da AA (`test:theme`).
  - Tek renkli vurgu (`primary`) adaçayından gülkurusu-mercana geçti: koyuda #FF6B6B, açıkta #D43A48 (beyaz yazıyla AA). "Canlı/doğrulandı" anlamı için yeşil token'lar (`mint`, `green`) yerinde kaldı.
  - Alt çubuk Instagram gibi etiketsiz (etiket ekran okuyucuda), seçili sekme ikon + altında 4 pt gradyan nokta; Profil sekmesi kişinin avatarı, seçiliyken gradyan halka; (+) gradyan disk.
  - Hikaye tepsisi: görülmemiş gradyan halka, görülmüş düz gri, "Hikayen" gradyan "+" rozeti (`ui/GradientRing`).
- Etki: D-017'nin "açık tema varsayılan, adaçayı tek marka rengi" kısmı bu kararla değişti.

### D-023 — Sinyal Kartı sunumu ve "yumuşak premium" görünüm (Snap Map örneği) (2026-09-24)
- Bağlam: Kullanıcı cihazda kartın açılış animasyonunu kötü, genel görünümü "MVP/basic" buldu; Snapchat mantığında yumuşak ve küresel bir arayüz istedi.
- Karar:
  - Kart artık ortada büyüyen değil, Snap Map'in yer kartı gibi alttan yükselen, kenarlardan 10 pt içeride yüzen bir kart (köşe 32, çizgisiz, geniş yumuşak gölge). Harita bulanıklaştırılmıyor, hafifçe karartılıyor (`scrimSoft`); yer ve sayfa (1/3) kartın başlığında. Tek animasyon modeli UI thread'de: `progress` yay (`springs.sheet`, sönüm oranı ~0.87, sıçramasız) ile açılır; başlıktan sürüklenince parmağı izler, 120 pt ya da hızlı fırlatma kapatır; her kapanış önce animasyonla çıkar, sonra kaldırılır (eski sürümde PanResponder + layout animasyonu çakışıyordu ve kapanışta sıçrama vardı). Hareketi Azalt açıksa kısa solma.
  - Harita üstü: arama tek hap (çizgisiz, yüzen gölge); katman ve tür filtreleri tek kaydırmalı çip satırında, seçili katman koyu hap (Snapchat'in seçili durumu gibi); konum ve liste düğmeleri yuvarlak, çizgisiz.
  - Pinler: siyah dış çizgi yerine beyaz çizgi + yumuşak gölge; kümeler marka renginde dolu disk + beyaz çizgi (çift halka kalktı). Alt çubuk hap biçiminde, çizgisiz; (+) halkasız, sıcak ışıltılı.
  - Genel: `colors.border` neredeyse görünmez bir kıl çizgiye indi (yüzeyler ton ve yumuşak gölgeyle ayrılıyor), çipler çizgisiz, segment kontrolü hap, akış kartları gölgeyle yükselir. Snapchat'in kendi sarısı kullanılmadı: marka adaçayı + güneş sarısı (yalnız oluştur/gönder) korunuyor.
- Etki: plan-devam C1'in "ortada kart" kararı (D-018) bu kararla değişti.

### D-022 — plan-devam Faz G: i18n yöntemi, dil ayarı, analitik, ölçüm ve E2E kapsamı (2026-09-24)
- Karar:
  - i18n: tüm kullanıcı metni `tx('ns:anahtar', 'Türkçe kaynak')` ile (`src/i18n/tx.ts`); Türkçe kaynak kodda kalır ki saf mantık testleri i18next olmadan çalışsın ve eksik anahtar asla ham anahtar göstermesin. i18n, tema gibi açılışta ekranlar yüklenmeden başlatılır (`initAsync: false`); modül yüklenirken kurulan etiketler (sinyal türleri, kategoriler) doğru dilde olur. Dil değiştirmek (Ayarlar > Dil) uygulamayı yeniden yükler — tema ile aynı yol. `scripts/i18n-scan.cjs` kodda kalan kullanıcı metnini bulur; `test:i18n` tek bulguda başarısız olur. Sunucunun Türkçe hata mesajları İngilizcede çevrilmiş genel metne düşer (sunucu mesajları çevrilmedi).
  - Tarih/saat/sayı uygulama diline göre (`i18n/locale.ts`); mesafe birimi metrik kaldı (mil/12 saat yalnız ABD/İngiltere için gerekir, MVP dilleri tr/en-GB).
  - G4 RTL ertelendi: MVP'de RTL dil yok.
  - Analitik: `analytics.track` soyutlaması, şema dışı alan ve uzun metin atılır; rıza varsayılan **herkes için kapalı** (plan yalnız AB için kapalı diyordu; daha güvenli olanı seçildi). Sağlayıcı bağlanmadı (PostHog anahtarı secret/ücretli) — olaylar yalnız bellekte tutulur.
  - G9: API p95 yerelde ölçüldü (`scripts/measure-api-latency.ps1`); açılış, kamera, kart ve fps ölçümleri cihaz ister.
  - G10 (görsel varyantları, blurhash) ertelendi: sunucu tek boyut üretiyor; listeler zaten FlatList ile sanallaştırılmış.
  - G13: Maestro akışları yazıldı (`e2e/maestro`) ama simülatör olmadığı için koşulmadı; her senaryonun otomatik karşılığı README'de. "Yer takibi" (senaryo 11) özelliği MVP'de yok.
  - G14: `docs/operations/release-checklist.md`. Kökteki `.env` (yerel kimlik bilgileri) git'te izleniyor — yayından önce izlemeden çıkarılıp parolalar değiştirilmeli; geçmişi silmek kullanıcı kararı.

### D-021 — plan-devam Faz F: destek adresi yer tutucusu, hesap silme kapsamı, yaş, veri talebi (2026-09-24)
- Bağlam: F1–F7 (Faz 10 kalanları). Kullanıcı "bana bir şey sorma" dedi; plan F1'de destek adresini kullanıcıya sormayı istiyor ve adres uydurulmayacak.
- Karar:
  - F1: Destek/itiraz adresi `{{DESTEK_EPOSTA}}` yer tutucusu olarak kalıyor (`legalContent.ts` → `SUPPORT_EMAIL`, kurallar/şartlar/gizlilik metinleri, veri talebi ekranı, moderasyon rehberi). App Store UGC kuralı çalışan bir iletişim ister: **yayından önce doldurulmalı** (Faz G yayın kontrol listesi).
  - F2: Üç yasal metin taslak olarak kodda (i18next `{{ }}` yer tutucusunu yorumlayacağı için JSON'da değil), her ekranda "taslak, hukuki inceleme gerekir" notu; kayıtta EULA kabul satırı ve metinlere bağlantı.
  - F3 hesap silme: iki adım (açıklama → şifre), 30 gün bekleme (girişte "Silmeyi geri al"), sonra `AccountPurgeService` `UserDeleted` yayınlar ve Identity verisini siler (arkadaşlık, engel, takip, kayıtlı yer, açtığı raporlar, oturumlar); kullanıcı satırı moderasyon kayıtları çözülsün diye kişisel verisi boşaltılarak kalır. Blog: sinyaller olay kaynaklı `PostDeleted` ile (projeksiyon, harita, akış, yer durumu düşer), başkalarının sinyallerindeki yorum ve beğenileri kaldırılır, görüntülenme kayıtları ve yüklenen medya dosyaları silinir. Notifications: yazdığı mesajlar boşaltılır ("Silinmiş kullanıcı"), snap/hikaye dosyaları, tepkiler, bildirimler, cihaz jetonları, konum abonelikleri silinir.
  - **Yapılamayan kısım:** EventStoreDB olay geçmişinde silinen sinyallerin eski olayları (içerik dahil) kalıyor; kalıcı silme için akış tombstone + scavenge operasyonu gerekiyor (yayın öncesi işletim görevi). Rapor kayıtlarında silinen kişinin kimliği (boşaltılmış hesap) denetim izi için kalıyor.
  - F4: "Verilerimi iste" yalnız kayıt oluşturur (30 günde bir); otomatik ZIP ve e-posta yok, kopya destek adresinden elle gönderilir (işletim rehberi).
  - F5 (a): kayıtta doğum yılı zorunlu; yalnız yıl bilindiği için en küçük olası yaş kullanılır (13'ten küçük olabilecek kayıt olamaz, 18'den küçük olabilecek korunur). 18 altı: hesap gizli başlar; o kişiyle yalnız arkadaşları mesajlaşabilir (her iki yönde). Planın diğer maddeleri (profil harita sekmesi, yakındaki soru bildirimleri, önerilen kişiler) uygulamada özellik olarak yok. Geliştirmede yalnız `e2e_` test hesapları doğum yılı vermeden kayıt olabilir (yetişkin sayılır) — mevcut kabul betikleri değişmeden çalışsın diye.
  - F6: iOS izin metinleri tr (taban) + en (`locales/`), kamera/mikrofon/fotoğraf/konum; arka plan konumu Android'de engelli. `userInterfaceStyle` "automatic" (koyu tema "Sistem" modunda iOS/Android'de doğru çalışsın diye; `expo-system-ui` eklendi).
- Etki: Kayıt API'si `birthYear` ister; oturum cevapları `deletionScheduledForUtc` taşır; `GET /api/blocks/status` `canMessage`/`reason` döner.

### D-020 — plan-devam Faz E: balon sohbet, "yazıyor" yoklamayla, yanıt alıntısı (2026-09-24)
- Bağlam: E1–E9 balon görünümü, gruplama, gün ayırıcı, okundu/yazıyor, snap ve sinyal balonları, mesaj eylemleri istiyor; sohbet gerçek zamanlı değil (CLAUDE.md §6.5, D-005).
- Karar:
  - "Yazıyor": istemci yazarken en fazla 3 sn'de bir `POST /api/chat/conversations/{id}/typing` gönderir; sunucu bunu yalnız bellekte 6 sn tutar (hiç saklanmaz), karşı tarafın açık konuşma ekranındaki ~4 sn'lik yoklaması `otherTyping` ile görür. Mesaj gönderilince silinir. Tek servis örneği varsayımı; çok örnekte Redis'e taşınmalı.
  - "Görüldü": yalnız kendi mesajlarında `seen` + `seenAtUtc` (karşı taraf ilk okuduğunda yazılır); eski mesajlarda saat yok, yalnız "Görüldü". Snap'lerde gösterilmez (snap kendi durumunu taşır).
  - Yanıt: `replyToId` ile gönderilir, sunucu aynı konuşmadan en fazla 120 karakterlik alıntı saklar; alıntılanan mesaj geri alınınca alıntılar da boşalır; snap alıntısı medya taşımaz.
  - Mesaj eylemleri (uzun bas): mevcut sabit tepki seti (❤️😂😮😢👍🔥; plan 🙏 diyordu, sunucu seti değişmedi), Yanıtla, Kopyala (`expo-clipboard`), kendi mesajında Geri al, karşı tarafınkinde Bildir (kişi bildirimi, not "Sohbet mesajı").
  - Paylaşılan sinyal balonu dokununca Sinyal Kartı'nı açar (konum bilinmediği için "Hâlâ böyle mi?" pasif).
  - Ertelenen (E8): liste satırında kaydırma eylemleri (sessize al/sil) ve "mesaj istekleri" klasörü — sunucuda sessize alma/silme ve istek modeli yok; liste zaten önizleme + snap durumu + okunmamış göstergesi taşıyor.
- Etki: `ChatMessageDto` geriye uyumlu alanlar kazandı (`replyTo`, `seen`, `seenAtUtc`); mesaj listesi yanıtı `otherTyping` taşır.

### D-019 — plan-devam Faz D: tek sayfa oluşturma, gönder hedefleri ve giden kutusu (2026-09-24)
- Bağlam: D1–D11 dört adımlı sihirbazı kamera-öncelikli, 3 dokunuşlu bir akışa çevirmeyi ve çevrimdışı paylaşımı istiyor.
- Karar:
  - Composer tek sayfa: medya, yer satırı (+ yakındaki yer çipleri; "Yer seç/Değiştir" eski 1. adımı ayrı görünümde açar), büyük tür kareleri + seviye, tek açıklama (280), görünürlük, "Nereye gönderilsin?" (Haritaya her zaman; Hikayem medya varsa varsayılan açık, anonimde kapalı; Arkadaşlar = snap, yalnız fotoğrafla ve anonim değilken), sarı Gönder. Başlık alanı kalktı; sunucu başlık veya metin istediği için yalnız fotoğraflı sinyalde başlık = tür adı (her yüzey bunu `cardText` ile gizler).
  - D7 veri göçü yapılmadı: EventStore geçmişi yeniden yazılmaz; bütün liste/kart yüzeyleri (FeedCard, PostRow, yer sayfası, kart) başlık+açıklamayı `cardText` ile tek metin gösteriyor, tekrar görünmüyor.
  - Giden kutusu (D9): Gönder yer sinyalinde taze konumu alır, paylaşımı cihazdaki kuyruğa (`outbox.json`, medya kopyası uygulama klasöründe) yazar ve kapanır. Yükleme/yayın arka planda; bağlantı yoksa bekler, NetInfo/ön plana dönüş/5 sn'de bir uyanır, 5 sn→5 dk artan bekleme. Sunucunun reddettiği (4xx) paylaşım "Paylaşılamadı" çipiyle durur (tekrar dene/vazgeç), sessizce yeniden denenmez. Medya bir kez yüklenir (mediaId hatırlanır). Hikaye/snap en iyi çabadır, sinyali geri almaz.
  - Kamera (D3/D11): kamera açıkken, konum izni zaten varsa (asla burada sorulmaz) konum alınır; 100 m içinde ve doğruluk ≤ 100 m ise en yakın yer çipte gösterilir ve composer onunla başlar, değilse "Yaklaşık alan"; doğruluk > 100 m ise "Konum belirsiz". Okul/sağlık/ibadet yerinde tek seferlik uyarı; okulda "Yazılı sinyal" seçeneği.
  - D4: lens daire listesi kalktı; kaydırma + küçük "‹ ad ›" göstergesi (erişilebilirlik için oklar).
  - D10: sunucu yalnız `fromGallery` bayrağını saklar (2 saatten eski galeri medyası), çekim zamanını saklamaz; kart "Galeriden" der.
  - Ertelenen: kendi pininin nabızla belirmesi (toast + harita yenileme var), zoom için deklanşörde yukarı kaydırma (iki parmak zoom var), tip çıkartmasının composer'da türü değiştirmesi zaten P5.5'te vardı.
- Etki: (+) → çek → tür → Gönder = 3 dokunuş. `PostCreated` olayına geriye uyumlu `FromGallery` alanı eklendi (eski mesajlarda false).

### D-018 — plan-devam Faz C: Sinyal Kartı kapsamı ve sapmalar (2026-09-24)
- Bağlam: C1–C13 merkez kartı, doğrulama, menü, görüntülenme ve harita düzeltmelerini istiyor.
- Karar:
  - Kart ortadan hafif taşan yayla büyüyerek açılır (pin konumundan uçan animasyon yerine; native harita marker'ının ekran koordinatını almak ek köprü ister). Aşağı sürükleme, overlay, X ve geri tuşu kapatır.
  - "Evet" artık tek dokunuşla aynı tür/değerde normal bir sinyal yayınlar (cihazın gerçek konumuyla); canlı sayılıp sayılmadığına yine sunucu karar verir. "Değişti" composer'ı aynı türle açar (`replacesSignalId` bağlantısı sunucuda yok; eski sinyal süresi dolunca düşer, kişi başına tek ses kuralı yeni değeri öne alır).
  - 500 m kuralı istemcide yalnız düğmeleri pasifleştirmek içindir; güven kuralı sunucuda değişmedi.
  - Görüntülenme (C12) ayrı bir Mongo koleksiyonunda (`post_views`, kişi+sinyal+gün başına bir kayıt); EventStore'a olay yazılmaz, konum saklanmaz, sayıyı yalnız yazar görür.
  - Ertelenen: ReactionBar (❤️ 🔥 😮 😂 🙏) — gönderiler için sunucuda yalnız beğeni var; "sessize al", "düzenle", "haritadan kaldır" menü öğeleri; Android'de tam ekran görselde iki parmak yakınlaştırma (iOS ScrollView zoom'u kullanıldı).
  - Kümeye dokunma: zoom < 16 yakınlaştırır, 16+ kümedeki sinyalleri kart olarak açar.
  - Geliştirme ortamında test hesabı gizleme artık yalnız oturum açmış gerçek kullanıcılara uygulanır (token'sız çağrılar betik/araçtır; uygulama her zaman oturum açar).
- Etki: Pin'e dokunmak artık alttan yer sayfası açmıyor; yer sayfası kartın yer satırından/şeridinden açılıyor.

### D-017 — plan-devam Faz B: tema önyüklemede seçilir, değişince uygulama yeniden yüklenir; kontrast için tonlar bir adım koyu (2026-09-23)
- Bağlam: B3 anlık tema değişimi ister; ama yüzlerce ekran stilini modül yüklenirken `StyleSheet.create` ile kuruyor. Ayrıca planın bazı açık tema tonları (sage600 üzerinde beyaz yazı 3,4:1; butter/sky ink) WCAG AA'yı tutturmuyordu.
- Karar:
  - Tema `src/themeBoot.ts`'te (index.ts'in ilk importu) tercih (senkron SecureStore) > sistem > açık sırasıyla seçilir; `applyThemeMode` token tablolarını yerinde doldurur. Tercih değişince (veya "Sistem" seçiliyken cihaz teması değişince) uygulama `expo-updates` `reloadAsync` ile yeniden yüklenir (geliştirme derlemesinde dev-settings). Oturum güvenli depoda olduğu için veri kaybı yok; bütün yüzeyler, harita dahil, yeni temayla çizilir.
  - Açık temada birincil dolgu ve vurgu metni sage700 (#2E7A60, beyaz yazıyla 5,2:1); ink500 #636C74, butterInk #8A620B, skyInk #1D72A1 — hepsi AA. Plan adları (sage600 vb.) palette korunuyor.
  - Blinkr'ın sinyal tipleri planın sekiz renginden şöyle eşlendi: Doluluk apricot, Bekleme butter, Geçici durum coral, Etkinlik grape, Fırsat bubblegum, Yeni açılış sky, Gözlem stone (Trafik/Hava/Park tipleri Blinkr'da yok; periwinkle yedekte).
  - Kamera/snap/hikâye ekranları görüntü üstünde çizildiği için tema ne olursa olsun koyu medya paletini kullanır.
  - Sheet girişleri taşmasız yay kullanır (taşan sheet altında boşluk parlıyordu); taşmalı yay kartlar/pinler içindir (Faz C).
- Etki: Tema değişince ~1 sn yeniden açılış. `expo-updates` bağımlılığı eklendi (yayın hazırlığında da gerekli). `@expo-google-fonts/bricolage-grotesque` kaldırıldı, `@expo-google-fonts/outfit` eklendi.

### D-016 — plan-devam Faz A: test verisi izolasyonu, tek tazelik kuralı, "Canlı" yalnız doğrulanmış sinyalde (2026-09-23)
- Bağlam: Kullanıcı elle testte Keşfet/aramada smoke kayıtları, 20.038 seed gönderisi, tekrarlı StatRow etiketleri ve tutarsız "taze/canlı" sayıları gördü (plan-devam A1-A8).
- Karar:
  - Test hesapları artık `e2e_` önekiyle açılır (tüm `scripts/test-*.ps1` ve `tests/PlacePosting`). Geliştirme ortamında (`TestAccounts:Hide`) `e2e_` ve eski `ad_zamanDamgası` biçimli hesaplar test hesabı olmayan kişilerden Keşfet, harita pinleri ve kişi aramasında gizlenir; testler kendi verisini görmeye devam eder.
  - `scripts/cleanup-test-data.cjs` test hesaplarını ve ürettiklerini siler (sinyaller API üzerinden geçici admin ile → PostDeleted zinciri; sohbet/bildirim/hikâye Mongo'dan; hesaplar Postgres'ten). Demo hesaplar (`sentetik_01..08`, seed-chat kişileri) korunur. `--backup` önce pg_dump + mongodump alır. Koşucuda `-Cleanup` anahtarıyla isteğe bağlı.
  - Tazelik tek fonksiyondan (`src/freshness.ts`): canlı < 15 dk, güncel < 45 dk, sonrası eski. "Canlı" yalnız sunucunun doğruladığı (VERIFIED_LIVE) gözlemde; doğrulanmamış genç sinyal "Taze". Bunun için okuma modeline `PublicationTrust` eklendi ve Keşfet `verified` döndürür.
  - StatRow değer + ayrı etiket yerine tek ifade + kendi ikonu ("2 sinyal · Orta güven · ~120 m"); gözlem zamanı yoksa tazelik öğesi gösterilmez.
- Uygulanamayan: A2/A3 toplu silme (795 test hesabı, 765 test sinyali, ahmet'teki 20.024 seed gönderisi) otomatik izin denetiminden geçmedi; betikler hazır, kullanıcı onayıyla çalıştırılacak. Kullanıcının kendi yazdığı eski küfürlü 5 gönderi silinmedi (kullanıcı içeriği); metin filtresi bunları artık Keşfet'te "Hassas içerik" olarak işaretleyip geriye itiyor.
- Etki: Faz C'deki Sinyal Kartı "Konumda" rozeti için `PublicationTrust` hazır.

### D-015 — P10.2-P10.4 moderasyon: raporlar Identity'de, gizleme koleksiyon taşıma ile, görsel moderasyon sağlayıcısı ertelendi (2026-09-23)
- Bağlam: 11 §4 ağırlıklı rapor skoru ≥ 3 → auto_hide, admin inceleme kuyruğu, yaptırım merdiveni, denetim izi ve `MODERATION_PROVIDER` ile görsel moderasyon istiyor.
- Karar:
  - Raporların sahibi IdentityService (zaten oradaydı). Ağırlık: 1 günden genç hesap 0,5, diğerleri 1. Açık raporların ağırlıklı toplamı 3'e ulaşınca `PostModerationChangedIntegrationEvent` (hidden) yayınlanır; her karar `ModerationActions` tablosuna (denetim izi) ancak olay yayınlandıktan sonra yazılır.
  - Gizleme okuma yollarına tek tek filtre eklenerek değil, worker'ın dokümanı `posts`'tan `posts_moderated`'a taşımasıyla yapılır (PlaceService'te `place_signals` → `place_signals_moderated`); geri alma geri taşır. Böylece harita, akışlar, arama, profil ve detay filtre unutulsa bile gizli sinyali gösteremez. EventStore'a olay yazılmaz: moderasyon içeriğin değil görünürlüğün kararıdır ve Identity'de denetim iziyle tutulur.
  - Admin: `/api/admin/reports`, `/api/admin/reports/resolve`, `/api/admin/actions` (yalnız Admin rolü; JwtBearer "role" talebini `ClaimTypes.Role`'e çevirdiği için `[Authorize(Roles)]` yerine iki türü de kabul eden politika). Arayüz: `scripts/moderation.ps1` (CLI) + `scripts/make-admin.ps1`; web sayfası yok (plan "en azından CLI script" diyor).
  - Yaptırımlar: warn → restrict_24h (erişim token'ında `posting_restricted_until`; sinyal/yorum/hikâye 403 `POSTING_RESTRICTED`, sohbet serbest) → suspend_7d/ban (giriş 403 `ACCOUNT_SUSPENDED`, yenileme 401, refresh token'lar iptal). Kişiye uygulama içi bildirim (`ModerationNotice`).
  - Görsel moderasyon sağlayıcısı (P10.2) ertelendi: openai/aws/google seçeneklerinin hepsi API anahtarı ve ücretli hesap ister (00_START_HERE kuralı: kullanıcıya sorulmadan eklenmez). `none` davranışı, yani yalnız rapor tabanlı çalışma, bugünkü durumdur.
- Gerekçe: Tek sahip, tek denetim izi; taşıma yaklaşımı en az kodla en güvenli sonucu verir.
- Etki: Kısıtlama/askı en geç bir erişim token ömrü (60 dk) içinde etkili olur. Gizliyken gelen beğeni/yorum/düzenleme okuma modeline yansımaz (geri alınınca eski hâli döner). İtiraz için gerçek bir destek iletişim adresi henüz yok; bildirim metni itiraz adresi içermiyor (P10.10 ile birlikte karar verilmeli). Bu işte bulunan eski bir hata da düzeltildi: PlaceService silinen sinyali canlı durumdan hiç çıkarmıyordu (`PostDeletedPlaceSignalConsumer`).

### D-014 — P10.1 metin filtresi: tek paylaşılan sınıf, başlangıç kelime listesi, özel sohbet maskelenmez (2026-09-23)
- Bağlam: 11 §4 senkron metin filtresi (tr/en, normalizasyon), ağır ihlalde 422 `CONTENT_BLOCKED`, hafif küfürde yayın + sıralama cezası + "Hassas içerik", TC no./plaka maskeleme ve kişisel veri uyarısı istiyor.
- Karar: `BuildingBlocks/Shared/Moderation/ContentTextFilter` (Blog, Notifications, Identity API'leri zaten `Shared`'a bağlı). Gönderi başlık/metni + düzenleme, yorum, hikâye alt yazısı ve bio: engelle + maskele. Sohbet mesajı ve snap alt yazısı: yalnız engelle (kişi kendi plakasını bir arkadaşına yazabilir). Hafif küfür okuma anında hesaplanır: Keşfet "Yakınımda" skoru ×0,5 ve `sensitive: true` (olay sözleşmesi değişmedi). Telefon ve açık adres yalnız uygulamada uyarılır (`textSafety.ts`, `PersonalDataNotice`); sunucu bunları değiştirmez.
- Gerekçe: Tek kural kümesi, üç serviste aynı davranış; read-time hesap, EventStore/worker/PlaceService zincirine yeni alan eklemeden çalışır. Kelime listeleri kodda ve kısa: yanlış pozitifleri önlemek için "kendini as" (≈"kendini aş"), "pic", "seni bulurum", "evini biliyorum" gibi girdiler bilinçli olarak çıkarıldı.
- Etki: Listeler bir Türkçe/İngilizce anadil moderatörüyle gözden geçirilmeli. Asenkron metin/görsel moderasyon ve auto_hide (P10.2/P10.3) ayrı; "Hassas içerik" etiketi şimdilik yalnız Keşfet kartında (harita detayında yok).

### D-013 — P10.8: loglarda konum yok; "ev bulanıklaştırma" mevcut 110 m ızgara ile karşılanıyor (2026-09-23)
- Bağlam: P10.8 log/analitik/hata raporlarında konum olmamasını ve ev bulanıklaştırma kuralını istiyor. Denetimde ~30 açık log satırı (Blog, Notifications, Worker) ham enlem/boylam yazıyordu; ASP.NET istek logu, HttpClient ve YARP da URL'deki `?lat=&lon=` sorgusunu yazıyordu.
- Karar: Açık log satırlarından koordinatlar çıkarıldı (PostId, yarıçap, sayılar kaldı); `Microsoft.AspNetCore.Hosting.Diagnostics`, `System.Net.Http.HttpClient` ve `Yarp` tüm servislerde Warning'e çekildi; PlaceService kapsama anahtarı logda tek yönlü kısa kimlikle (`CoverageLogId`) geçiyor. `test-log-privacy.ps1` (BLK-LOGPRIV-01) çalışan servislerin test sırasında yazdığı loglarda ayırt edici bir noktanın rakamlarını arar. Ev bulanıklaştırma için ayrı bir "ev" kavramı eklenmedi: yer seçilmeyen sinyal zaten yazılırken 3 ondalığa (~110 m) yuvarlanıyor ve harita bu değeri gösteriyor.
- Gerekçe: Servisler farklı log yığınları kullanıyor (Serilog / Microsoft logging); merkezi bir maskeleyici yerine kaynağı temizlemek her yığında aynı sonucu veriyor. Ev adresi saklamak, gizlemek istediğimiz veriyi yeni bir yere yazmak olurdu.
- Etki: Analitik ve hata raporlayıcı henüz yok (Faz 11/12); eklendiklerinde aynı test genişletilmeli.

### D-012 — Push bildirimleri ertelendi (secret gerekli); uygulama içi bildirimler var (2026-09-23)
- Bağlam: P9.2 Expo/FCM/APNs push, P9.7 tercihler.
- Karar: Push için `expo-notifications` + FCM sunucu anahtarı/APNs sertifikası + EAS proje kimliği gerekir; bunlar secret/hesap ister ve 00_START_HERE kuralı gereği kullanıcıya sorulmadan eklenmez. Bu yüzden bildirimler şimdilik uygulama içi (zil + liste). Tercihler ve sessiz saatler push ile birlikte yapılacak.
- Etki: Uygulama kapalıyken bildirim gelmez; kök CLAUDE.md §20.1'deki "Push bildirimi yok" maddesi geçerli.

### D-011 — Faz 8: mesaj istekleri klasörü ve dm_policy ertelendi; satır düzeni korunuyor (2026-09-23)
- Bağlam: Plan "mesaj izni yoksa istek olarak gönderim" ve balonlu sohbet istiyor.
- Karar: Bugünkü davranış korunuyor: herkes herkese mesaj başlatabilir, engel her iki yönde kapatır (BLK-SAFETY-01). İstek klasörü ve gizlilik ayarı ayrı bir iş olarak kalıyor. Sohbet ekranı kullanıcının daha önce seçtiği balonsuz Snapchat satır düzeninde kalıyor.
- Gerekçe: İstek klasörü okunmamış sayacı, bildirim ve sohbet listesi davranışını birlikte değiştirir; bu faz sinyal paylaşımı/tepki/geri alma ile sınırlı tutuldu.

### D-010 — Faz 6 kalanları ertelendi: kullanıcı adı değiştirme, QR/derin link, güven puanı (2026-09-23)
- Bağlam: P6.7'nin kullanıcı adı/şehir/bağlantı kısmı, P6.9 profil paylaşımı ve P6.10 güven/seviye/rozetler.
- Karar: Ertelendi. Kullanıcı adı JWT içinde ve eski gönderilerde yazar adı olarak kopyalanıyor; değiştirmek oturum yenileme ve read model güncellemesi ister. QR/derin link için uygulama henüz bağlantı şeması ve yönlendirme işlemiyor (Faz 9 P9.4). Güven puanı/seviye sunucuda hesaplanmıyor; kök CLAUDE.md §12.1 gereği karşılığı olmayan puan/rozet gösterilmez.
- Etki: Profil yalnız gerçek verileri gösteriyor (sayaçlar, bio, avatar, ızgara).

### D-009 — Takip, arkadaşlığın yanına eklendi (yerine geçmedi); gizli hesap (2026-09-23)
- Bağlam: Plan (06 §4) "Arkadaş = karşılıklı takip, ayrı tablo yok" diyor. Mevcut sistemde onaylı, karşılıklı
  `Friendship` tablosu var ve sohbet/snap/arama bunun üzerine kurulu (kök CLAUDE.md §2.2). Arkadaşlığı takibe
  çevirmek mevcut veriyi dönüştüren (yıkıcı) bir göç olurdu.
- Seçenekler: (A) Arkadaşlığı sil, karşılıklı takibe göç et. (B) Takibi ayrı, tek yönlü ilişki olarak ekle;
  arkadaşlık sohbet/snap için aynen kalsın.
- Karar: (B). Yeni `Follows` tablosu (Pending/Accepted) + `Users.IsPrivate` (EF göçü yalnız ekleme yapar).
  Takip konum paylaşmaz, haritada kimin neyi göreceğini değiştirmez. Gizli hesapta profil ızgarası ve
  takipçi/takip listeleri yalnız onaylı takipçilere açık; bu kural **sunucuda**: Identity
  `GET /api/follows/visibility/{id}`, BlogService `posts-read/author/{id}` bunu kullanıcının kendi token'ıyla
  sorar ve cevap alamazsa kapalı başarısız olur (503). Engel her iki yöndeki takipleri siler. Takipçi/takip
  **sayıları** herkese açık (pivot §2.3); arkadaş listesi ve sayısı hâlâ kimseye gösterilmez.
- Gerekçe: Veri silmeden ilerlemek (00_START_HERE: yıkıcı göç için kullanıcıya sorulur), mevcut sohbet/snap
  güvenliğini bozmamak.
- Etki: Kabul testi `test-follows.ps1` (BLK-FOLLOW-01, 30 kontrol). Bilinen açık: herkese açık
  `GET /api/posts-read?authorId=` listesi gizli hesap kuralını uygulamıyor — gizli hesabın sinyalleri zaten
  haritada herkese açık (anayasa: map-first), bu yüzden ızgara kilidi bir profil gizliliği, içerik gizliliği değil.
  Sinyal başına "yalnız takipçiler" görünürlüğü yok (ayrı iş).

### D-008 — Faz 5 kapanışı: arka plan yükleme kuyruğu ve kopya birleştirme ertelendi (2026-09-23)
- Bağlam: P5.10 (çevrimdışı yükleme kuyruğu, taslak saklama, gecikmeli sinyal) ve P5.12 (kopya sinyal
  birleştirme UI'ı) kalan iki madde.
- Karar: İkisi de ertelendi. P5.10 için mevcut davranış korunuyor: yayın sırasında composer açık kalır,
  medya yüklemesi composer içinde yapılır, hata olursa taslak composer'da durur ve "Tekrar dene" vardır.
  P5.12: sunucuda "kopya birleştirme" kuralı yok (her sinyal ayrı event; canlı durumda kişi başına tek ses
  zaten `CurrentPlaceStateCalculator`'da); karşılığı olmayan bir UI mesajı yazılmadı.
- Gerekçe: P5.10 kalıcı kuyruk (MMKV kurulu değil), uygulama yeniden açılınca sürdürme ve çift gönderimi
  önleyen istemci idempotency anahtarı gerektirir; sunucu `POST /api/posts` henüz idempotency anahtarı
  almıyor. Anahtar olmadan otomatik yeniden deneme çift sinyal üretebilir (kök CLAUDE.md §16).
- Etki: Faz 5 kabulündeki "uçak modunda paylaş → otomatik yüklenir" maddesi karşılanmıyor; açık iş.

### D-007 — Hassas yerler: okulda medya sunucuda kapalı, EDUCATION kategorisinin tamamına uygulanıyor (2026-09-23)
- Bağlam: 11_SAFETY §3 "okul/kreşte foto/video kapalı" diyor. Yer kataloğu yalnız normalize kategoriyi
  saklıyor; OSM `school/kindergarten/university/college/library` hepsi `EDUCATION`'a düşüyor.
- Karar: Kural sunucuda (`SensitivePlacePolicy`, BlogService create) `EDUCATION` kategorisinin tamamına
  uygulanır (422 `MEDIA_NOT_ALLOWED_AT_PLACE`); istemci aynı kuralı önceden gösterir (medya düğmeleri
  gizli, eklenmiş medya kaldırılabilir). Üniversite/kütüphanede de medya kapalı kalır.
- Gerekçe: Çocuk güvenliğinde fazla kısıt, eksik kısıttan iyidir; alt kategori ayrımı katalog importuna
  yeni alan gerektirir (ayrı iş). "Trust is server-owned" gereği istemci gizlemesi tek başına yetmez.
- Etki: Hassas yer (sağlık/ibadet) mahremiyet uyarısı kamera yerine composer'ın medya adımında
  gösterilir, çünkü yer kameradan sonra seçiliyor; sağlık yerlerinde kalıcı `HealthNotice` (112/911/999).
  Kamera ekranında "en yakın yer çipi" yapılmadı: yer seçimi composer'ın tek sahipli nearby akışında
  (kök CLAUDE.md §12.3), kamerada ikinci bir nearby isteği açmak o kuralı bozardı.

### D-006 — Faz 4 kapsamı: yorum/beğeni gerçek bug'larla birlikte, @bahsetme/yorum beğenisi/medya görüntüleyici ertelendi (2026-09-23)
- Bağlam: Faz 4'e başlarken "yorum/beğeni zaten var" sanılan backend'de birbirine bağlı gerçek bug'lar
  çıktı: (1) `PostUnlikedConsumer` yanlış dosyadaydı ve sayacı negatife düşürebiliyordu; (2)
  `IsLikedByCurrentUser` hep `false`'du, read model'de kim beğendi (`LikedByUserIds`) yoktu; (3)
  `GET /api/posts/{id}/comments` her zaman boş liste dönüyordu (paylaşılan önbellekteki DTO'da
  `Comments = new()`); (4) Infrastructure `CommentEntity.Id` binary GUID okunuyordu, worker ise string
  yazıyor — yorumu olan her gönderiyi okumak patlardı; (5) kendi gönderini beğenmek 500 dönüyordu; (6)
  var olmayan bir gönderiye beğeni/yorum/güncelleme yeni bir EventStore akışı açıyordu (yeni aggregate
  `Guid.Empty` değil rastgele Id alıyor, `Id == Guid.Empty` kontrolü hiç tutmuyordu → `Version < 0`).
- Karar: Bu bug'lar düzeltildi; yorumlara yanıt (tek seviye), yazar adı, silme (yeni
  `PostCommentRemovedEvent` → worker `post-comment-removed`), anonim gönderide yazarın kendi yorumunda
  kimliğin gizlenmesi eklendi; mobilde aynı sheet içinde `SignalThreadPanel` (beğeni, yorum, yanıt,
  sil, bildir, iyimser güncelleme + geri alma, 8 sn polling). **Ertelenenler:** @bahsetme çözümleme ve
  bildirimi, yorum beğenisi (çift dokunma), yorum kapatma, moderasyon kancası (Faz 10), tam ekran medya
  görüntüleyici (P4.7), beğenenler listesi (P4.8 — Identity'de toplu kullanıcı özeti uç noktası gerekir,
  Faz 6 takipçi listeleriyle birlikte yapılacak).
- Gerekçe: Önce var olanın doğru çalışması (kök CLAUDE.md §2.1 "Reliability is product value");
  realtime D-005 gereği polling.
- Etki: Yeni kabul testi `scripts/test-post-engagement.ps1` (BLK-ENGAGE-01) `test-product-08.ps1`'e eklendi.
  `PostCommentAddedEvent`/`PostLikedEvent`'e eklenen alanlar isteğe bağlı (eski olaylar okunur).

### D-005 — P2.10 realtime gateway: dokunulmuyor, REST polling korunuyor (2026-09-22)
- Bağlam: D-004, P2.10'u (socket.io tarzı realtime gateway) kök CLAUDE.md §6.5'in bilinçli REST
  polling kararıyla çeliştiği için kullanıcı onayına bloke etmişti.
- Seçenekler: (A) Dokunma, polling korunur, P2.10 Faz 2'de atlanır. (B) WebSocket/SignalR eklenir
  (§6.5'teki kararı tersine çevirir). (C) Karar ertelenir.
- Karar: **(A) — Şimdilik dokunma.** REST polling mimarisi korunuyor; P2.10 Faz 2 kapsamından
  çıkarıldı.
- Gerekçe: Kullanıcının kendi açık tercihi (önerilen seçenek); küçük/geri alınabilir olmayan bir
  mimari değişikliği gerektirmeden mevcut, çalışan ve testli davranış korunuyor.
- Etki: Faz 2'nin geri kalanı (P2.4/P2.8/P2.11) mevcut REST polling mimarisiyle ilerler. P2.10 kalıcı
  olarak `[-]` (uygulanmayacak) olarak işaretlendi; ileride tekrar gündeme gelirse yeni bir karar
  kaydı (D-00X) gerekir, bu karar sessizce geçersiz sayılmaz.

### D-004 — Faz 2 görev listesinin mevcut .NET backend'ine eşlenmesi (2026-09-22)
- Bağlam: Faz 1 tamamlandı, sıra Faz 2'de. Planın Faz 2 görev listesi (`13_ROADMAP_PHASES.md` P2.1-P2.13)
  Node/Postgres+PostGIS referans backend'ini varsayıyor; D-001/D-003 gereği gerçek backend .NET 10 +
  EventStoreDB + MongoDB + PostgreSQL(yalnız Identity) olarak kalıyor. Kod yazmadan önce her P2.x
  görevinin mevcut backend'de karşılığı olup olmadığı netleştirilmeli — aksi halde zaten var olan bir
  şey yeniden yazılır veya kök CLAUDE.md §22'nin "önce darboğazı kanıtla" ilkesi çiğnenir.
- Eşleme (görev → durum → not):
  - **P2.1** (docker-compose: postgres+postgis, redis, minio) → **[-] büyük ölçüde gereksiz.**
    Mevcut `docker-compose.yml` zaten Postgres+Mongo+Redis+RabbitMQ+EventStoreDB çalıştırıyor;
    coğrafi sorgular PostGIS değil Mongo `2dsphere` ile çözülüyor (AUDIT.md §6). Gerçek eksik yalnız
    nesne depolama (MinIO/S3) — bu kök CLAUDE.md §20.1'de zaten bilinen bir gap, MVP'yi bloklamıyor,
    ayrıca **ücretli/hesap gerektiren bir servis seçimi** olduğu için kullanıcıya sorulmadan eklenmez.
  - **P2.2/P2.3** (migration'lar + veri göçü, `08_DATABASE_SCHEMA.md`'ye göre) → **[-] uygulanmaz.**
    Bu, sıfırdan yeni bir şemaya geçişi varsayıyor; mevcut EF Core migration'ları ve Mongo koleksiyonları
    zaten üretimde çalışıyor, kök CLAUDE.md kural 1 ("sıfırdan yazma") bunu yasaklıyor.
  - **P2.4** (ortak altyapı: hata biçimi, doğrulama, sayfalama, idempotency, rate limit, logger) →
    **[ ] kısmen gerçek iş.** Idempotency zaten var (projection inbox). Standart hata biçimi ve
    rate limiting servisler arasında tutarlı değil — bu kök CLAUDE.md §21 "P1 Quality gate" ve
    "P1 Guvenlik ve auth" maddeleriyle örtüşüyor, ayrı bir Faz 2 görevi olarak değil o yol haritası
    altında ele alınacak.
  - **P2.5** (auth: register/login/refresh) → **[x] zaten var.** IdentityService bunu karşılıyor
    (bkz. kök CLAUDE.md §6.1, §14). Apple/Google sosyal girişi yok — ayrı, küçük bir eklenti olur,
    şimdilik plan kapsamında zorunlu değil.
  - **P2.6** (görünürlük fonksiyonu: açık/gizli hesap, engel, anonim, takipçi) → **[x] kısmen zaten
    var.** Anonim paylaşım (`AnonymousMap`) ve engelleme (`BLK-SAFETY-01`, block→relation) üretimde ve
    testli. "Gizli hesap" (private account, takip isteği onaylı görünürlük) kavramı **bilinçli olarak
    yok** — mevcut model "arkadaşlık" (karşılıklı onaylı, bkz. kök CLAUDE.md §2.2 madde 2) ile planın
    tek yönlü "takip" modelinin nasıl bir arada yaşayacağı hâlâ açık bir soru (D-003'te not edildi);
    Faz 6 P6.1'e kadar ertelenir.
  - **P2.7** (sinyal motoru: TTL, doğrulama, bulanıklaştırma, canlı durum, güven puanı, sıralama) →
    **[ ] gerçek iş, kısmen var.** Canlı durum/güven puanı/tazelik zaten üretimde
    (`CurrentPlaceStateCalculator`, kök CLAUDE.md §10.2). Sabit bir TTL motoru YOK — `ExpiresAtUtc`
    çağıran taraf tarafından veriliyor (P1.6'da da not edildi). Bu gerçek, dar kapsamlı bir Faz 2 işi.
  - **P2.8** (medya: presign/complete/worker, EXIF silme, varyant, blurhash, video, temizlik) →
    **[ ] gerçek iş, kısmen var.** Presign sözleşmesi ve EXIF silme snap'lerde zaten var (kök CLAUDE.md
    §6.5); post medyasında blurhash/varyant/orphan temizliği yok — kök CLAUDE.md §15 bunu zaten
    "goz onunde bulundur" diye işaretlemiş bir alan.
  - **P2.9** (sinyal uç noktaları: CRUD, harita bbox+kümeleme, yakındaki yerler) → **[x] zaten var.**
    `POST/GET/PATCH/DELETE /api/posts`, `/api/map/bounds`, `/api/places/nearby` üretimde ve
    `test-product-08.ps1`'de testli (bkz. §13 API Yüzeyi).
  - **P2.10** (realtime gateway: socket.io, `map:*`/`signal:*` odaları) → **[BLOKE — kullanıcı kararı
    gerekir.]** Kök CLAUDE.md §6.5 bilinçli olarak "Chat v1 gerçek zamanlılık için WebSocket/SignalR
    kullanmaz… kısa aralıklı REST polling… sonsuz/agresif polling'e dönüştürülmemeli" diyor — bu daha
    önce verilmiş, belgelenmiş bir karar. Realtime gateway eklemek bu kararı tersine çevirir ve
    Gateway/servisler arası yeni bir bağlantı modeli (WebSocket/SignalR) demektir; küçük/geri alınabilir
    bir değişiklik değil. D-002/D-003'teki gibi **önce kullanıcıya sorulacak**, sessizce eklenmeyecek.
  - **P2.11** (işler: `signal.expire`, `place.aggregate`, `counters.reconcile`) → **[ ] gerçek iş,
    kısmen var.** Projection worker zaten idempotent tüketiyor; sinyal süresi dolması zaten sorgu
    zamanında (`Freshness`/`ExpiresAtUtc`) hesaplanıyor, ayrı bir arka plan expire job'u yok. Açık
    reconciliation/error-queue görünürlüğü kök CLAUDE.md §21 "P1 Uretim guvenilirligi"nde zaten
    listeli — Faz 2'nin kendi görevi olarak değil o yol haritası altında ele alınacak.
  - **P2.12** (paylaşılan tipler + TanStack Query mobil istemcisi) → **[-] şimdilik ertelendi.**
    Mobil zaten kendi `api.ts` sarmalayıcısını kullanıyor (AUDIT.md §6); TanStack Query'ye geçiş büyük
    bir refactor, somut bir sorunu çözdüğü kanıtlanmadan (kök CLAUDE.md §22) başlanmaz.
  - **P2.13** (API entegrasyon testleri: sinyal oluştur → haritada gör → süre dolsun) → **[x] büyük
    ölçüde zaten var.** `test-product-08.ps1`'deki `BLK-LOCATION-01/02`, `BLK-CORE-02` zaten bu zinciri
    kanıtlıyor (bu oturumda tekrar çalıştırıldı, hepsi PASS).
- Karar: Faz 2, yukarıdaki eşlemeye göre **yeniden kapsamlanır**: P2.1/P2.2/P2.3/P2.12 uygulanmaz (`[-]`),
  P2.5/P2.6/P2.9/P2.13 zaten büyük ölçüde karşılanmış sayılır (`[x]`, açık uçları not edilerek),
  P2.4/P2.7/P2.8/P2.11 gerçek, dar kapsamlı işler olarak kalır, P2.10 kullanıcı onayı gelmeden
  başlamaz. Sıradaki somut iş: **P2.7 sinyal motoru TTL'i** (en dar kapsamlı, en az riskli, mevcut
  `ExpiresAtUtc` sözleşmesine ek yapıyor, hiçbir şeyi kırmıyor).
- Gerekçe: Kök CLAUDE.md kural 13 "gereksiz yeni abstraction veya mikroservis ekleme" ve §22 "önce
  darboğazı kanıtla" ilkeleriyle uyumlu; zaten var olanı yeniden yazmamak, gerçek boşlukları dar ve
  geri alınabilir adımlarla kapatmak.
- Etki: `PROGRESS.md`'nin Faz 2 kontrol listesi bu eşlemeyle güncellendi. P2.10 için kullanıcıya
  sorulacak; onaylanmadan Faz 2'de realtime/WebSocket/SignalR kodu yazılmayacak.

### D-003 — Kullanıcı kararı: plan aynen uygulanır, kök anayasa mevcut mimariyi koruyarak güncellendi (2026-09-22)
- Bağlam: D-002'deki iki açık soru kullanıcıya soruldu.
- Karar: (1) Seçenek A — plan aynen uygulanır; kök `CLAUDE.md` §1/§2.1/§2.2'ye eklenen bir §2.3 ile
  bilinçli pivot olarak güncellendi (hikayeler, takip/takipçi, Keşfet feed'i, rozet/seviye/güven puanı
  artık MVP kapsamında; V1.1 "arkadaş konumu" hâlâ Faz 13'te, varsayılan kapalı/opt-in kalmak
  koşuluyla). (2) Backend mimarisi **korunur** — PostgreSQL+PostGIS'e geçiş YOK, EventStoreDB+MongoDB
  authoritative kalır (D-001 ile birebir aynı yönde, artık kesinleşti).
- Gerekçe: Kullanıcının kendi açık tercihi; iki soru da netti, geri dönüş riski taşımıyordu (belge
  güncellemesi + mevcut mimariyi koruma, tersine çevrilebilir kararlar).
- Etki: Faz 1 artık başlayabilir. Kök `CLAUDE.md` §1, §2.1, §2.2 (madde 2 alt satırı), §21 güncellendi.
  Faz 1'den P1.1 (design tokens, kısmi: palet eklendi, `ThemeProvider`/açık tema çalışması hâlâ
  gerekiyor) ve P1.7 (tab bar `Harita · Keşfet · (+) · Sohbet · Profil`, Harita zaten varsayılan
  açılıştı) bu oturumda tamamlandı. Faz 6 P6.1'de "arkadaşlık" (mevcut, karşılıklı onaylı) ile
  planın "takip" (tek yönlü) modelinin nasıl bir arada yaşayacağına karar verilmeli — kök CLAUDE.md
  §2.2 madde 2'de bu açık nokta not edildi.

### D-002 — Faz 1'e geçmeden kullanıcı onayı bekleniyor (2026-09-22, ÇÖZÜLDÜ → bkz. D-003)
- Bağlam: AUDIT.md §7.1 — bu plan (hikayeler, takip/takipçi, feed, rozet/seviye/streak, V1.1 arkadaş
  konumu) kök `CLAUDE.md` Ürün Anayasası'nın §2.2 "Bilinçli olarak yapılmayanlar" listesiyle doğrudan
  çelişiyor. AUDIT.md §7.2 backend'in EventStoreDB+Mongo'dan PostgreSQL+PostGIS'e taşınmasının kök
  belgenin "EventStoreDB authoritative store" kuralıyla çeliştiğini ve veri kaybı riski taşıyan bir
  migrasyon olduğunu tespit etti.
- Seçenekler: (A) Plan aynen uygulanır, kök anayasa bilinçli bir pivot olarak güncellenir. (B) Plan,
  anayasayla çelişen maddeler (hikaye/feed/takip/rozet/streak/arkadaş konumu) çıkarılarak budanır;
  yalnız çelişmeyen kısımlar (Sinyal Kartı, tazelik halkası, StatRow, filtre/çıkartma iyileştirmeleri,
  yorum/tepki — post event sözleşmesinde zaten var) alınır. (C) Plan şimdilik uygulanmaz, ileri-vizyon
  belgesi olarak kalır.
- Karar: **Bekliyor — kullanıcıya soruldu, henüz yanıtlanmadı.**
- Gerekçe: Bu üç seçenek arasında yalnızca kullanıcı karar verebilir; kod veya belge bunu tek başına
  çözemez (00_START_HERE.md §5 kural 12 ve kök CLAUDE.md §25 "celiski kanitla, sonra … karar ver").
- Etki: Faz 1 ve sonrası bu karara kadar başlamıyor.

### D-001 — Backend yeniden yazılmıyor; plan .NET mikroservislerine uyarlanacak (2026-09-22)
- Bağlam: Plan referans stack'i Node/Fastify/NestJS + Prisma/Drizzle varsayıyor; mevcut backend .NET 10
  mikroservisleri (IdentityService/BlogService/PlaceService/NotificationsService + YARP Gateway).
- Karar: 00_START_HERE.md §5 kural 1 ("Sıfırdan yazma, mevcut stack'i koru") gereği backend .NET'te
  kalır. Faz 2'nin görevleri (endpoint'ler, iş kuyrukları, realtime) .NET/EF Core/MongoDB
  repository desenlerine uyarlanır; PostgreSQL+PostGIS'e tam geçiş D-002 çözülmeden yapılmaz.
- Gerekçe: Mevcut mimari zaten çalışıyor, event-sourced ve kanıtlanmış (331 otomatik kontrol); ölçüm
  olmadan büyük mimari değişiklik kök CLAUDE.md §22'nin "önce darboğazı kanıtla" ilkesine aykırı.
- Etki: `07_BACKEND_ARCHITECTURE.md`, `08_DATABASE_SCHEMA.md`, `09_API_SPEC.md` referans olarak
  kullanılır ama birebir uygulanmaz; her sapma burada ayrı satır olarak kayda geçer.

### D-000 — Planın mevcut stack'e uyarlanması
- Bağlam: Plan React Native (Expo) + Node/PostgreSQL referansıyla yazıldı.
- Karar: AUDIT.md §6'daki stack eşleme tablosu doldurulmuştur; öne çıkanlar: Reanimated zaten 3 değil
  4.5.1 ile kurulu (fazla, sorun değil); `expo-router`, TanStack Query, Zustand, `@gorhom/bottom-sheet`,
  `@shopify/flash-list`, `i18next`, Socket.IO, PostGIS, S3/R2, Sentry **hiçbiri kurulu değil** ve
  D-002 çözülene kadar eklenmeyecek.
