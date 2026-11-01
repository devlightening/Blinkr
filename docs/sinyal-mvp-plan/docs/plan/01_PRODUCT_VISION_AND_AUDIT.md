# 01 — Ürün Vizyonu ve Mevcut Durum Denetimi

## 1. Tek cümlelik ürün tanımı
**"Şu an orada ne oluyor?"** sorusunu, orada bulunan insanların paylaştığı canlı, kısa ömürlü ve
doğrulanabilir gönderilerle yanıtlayan, harita merkezli bir sosyal ağ.

Snapchat'ten aldıklarımız: kamera-öncelikli paylaşım, harita (Snap Map hissi), hikayeler, kaybolan
snap'ler, hızlı ve oyunsu etkileşim.
Instagram'dan aldıklarımız: gönderi kartı, yorum/tepki, profil ızgarası, takip/takipçi, kaydedilenler.
Bize özgü olan: **sinyal tipi + seviye** (doluluk, bekleme süresi, kapalı/açık…), **canlılık süresi**
(TTL), **"Hâlâ böyle mi?" topluluk doğrulaması**, **yer başına canlı durum özeti** ve **güven puanı**.

## 2. Hedef kullanıcılar
| Persona | İhtiyaç | Uygulamadaki karşılığı |
|---|---|---|
| Şehirli pratik kullanıcı | "Hastane acil / banka / market şu an kalabalık mı?" | Harita + yer canlı durumu + bildirim |
| Sosyal genç kullanıcı | Arkadaşlarının nerede ne yaptığını görmek, paylaşmak | Hikayeler, snap, takip, keşfet |
| Yerel katkıcı ("rehber") | Şehrine katkı, tanınma | Güven puanı, rozetler, seviyeler |
| Mekân / işletme (V2) | Doğru bilgi yayınlamak | Doğrulanmış mekân hesabı (MVP dışı) |

## 3. Çekirdek döngüler (core loops)
1. **Bilgi döngüsü:** Haritayı aç → pine dokun → Sinyal Kartı → karar ver (git/gitme) → oradaysan
   "Hâlâ böyle mi?" ile doğrula → güven puanın artar.
2. **Paylaşım döngüsü:** + → kamera → çek → tip/seviye seç → paylaş → tepki/yorum/doğrulama
   bildirimi gelir → tekrar paylaş.
3. **Sosyal döngü:** Keşfet'te hikaye/gönderi gör → takip et → takip ettiklerinin sinyalleri
   akışında → sohbet/snap ile konuş.
4. **Yer takibi döngüsü:** Sık gittiğin yeri kaydet/takip et → yeni sinyalde push bildirim → uygulamaya dön.

## 4. Mevcut durum denetimi (ekran görüntülerinden tespit edilenler)

### 4.1 İyi olan ve korunacaklar
- Koyu tema + mint yeşili vurgu + sarı "Kullan/+" butonu: marka DNA'sı. **Korunacak, rafine edilecek.**
- "Hâlâ böyle mi? → Evet, hâlâ böyle / Değişti" doğrulama fikri: ürünün kalbi. **Merkeze taşınacak.**
- Sinyal tipi + seviye (Bekleme · 5–15 dk, Doluluk · Kalabalık, Geçici durum · Kapalı): güçlü yapı.
- Efekt/filtre isimleri (Normal, Gün batımı, Nane, Neon, Buz, Retro, Sinema, Gece) ve bağlam
  çıkartmaları (saat, Kalabalık, Sıra var, Etkinlik, Yol çalışması, Güzel hava): eğlenceli, korunacak.
- "Konum doğrulandı" vs "Yakındaki yer paylaşımı" ayrımı: güven sistemi için temel.
- "Kesin cihaz konumun diğer kullanıcılara gösterilmez" ilkesi: korunacak ve teknik olarak garanti edilecek.
- Snap (bir kez izlenip kaybolan fotoğraf) özelliği: korunacak.

### 4.2 Hatalar ve UX sorunları (düzeltilecek)
| # | Sorun | Nerede | Çözüm |
|---|---|---|---|
| 1 | Etiket tekrarı: "Taze **tazelik**", "Orta güven **güven**", "~283 m **uzaklık**" | Yer detayı istatistik satırı | Değer + ikon + tek etiket. Bkz. `04` StatRow |
| 2 | Paylaşılan fotoğraf banner'a kırpılıyor, yüz kesiliyor; tam görüntülenemiyor | Yer detayı üst görsel | Sinyal Kartı'nda 4:5 medya, dokununca tam ekran görüntüleyici (pinch-zoom) |
| 3 | Sayaç tutarsızlığı: "1 sinyal" yazarken "Son sinyaller 2" | Yer detayı | Sayılar tek kaynaktan (backend), aynı filtreyle |
| 4 | Başlık ve etiket aynı: başlık "Gözlem", etiket "Gözlem" | Sinyal listesi | Açıklama yoksa başlık gösterme; tip rozeti + yer adı yeterli |
| 5 | Profilde e-posta herkese açık görünüyor (`ahmet@gmail.com`) | Profil | Herkese açık profilde e-posta ASLA gösterilmez; yalnızca Ayarlar > Hesap |
| 6 | Kullanıcıya 20.035 seed sinyal bağlanmış, metinlerde `(#19741)` gibi ID'ler var | Profil > Sinyallerim | Seed verisi demo kullanıcılara dağıtılır, metinlerde ID olmaz (`14_TESTING`) |
| 7 | Kaydedilen yerler sadece cihazda ("Bu cihazda saklanır") | Profil | Sunucuya taşınır, cihazlar arası senkron; ilk girişte yerel kayıtlar migrate edilir |
| 8 | Çıkartmalar üst üste biniyor (Kalabalık + Sıra var) | Efekt ekranı | Sürüklenebilir, pinch/rotate, otomatik yerleşim, silmek için çöpe sürükle |
| 9 | Filtre dairesi seçimi ekrandan taşıyor; filtre ön izlemesi yok | Efekt ekranı | Snapchat gibi: fotoğrafın üzerinde yatay kaydırarak filtre değiştir |
| 10 | Sohbet log gibi (sol çizgili satırlar), balon yok, gün ayırıcı yok (dün 16:34 ile bugün 14:19 karışık) | Sohbet | Balon UI, gün ayırıcı, okundu bilgisi, yazıyor… göstergesi |
| 11 | Arama çubuğu durum çubuğuna çok yakın, sayfa açıkken arka plan harita karışık görünüyor | Harita üst bar | Safe-area uyumlu, blur arka planlı üst bar |
| 12 | "0 görünür" rozeti ve "Bu alanı tara" belirsiz | Harita | Otomatik yükleme (harita durunca), sadece gerektiğinde "Bu alanda ara" |
| 13 | Profanite/moderasyon yok ("… amk" metni yayında) | Sinyallerim | Moderasyon hattı (`11_SAFETY`) |
| 14 | Hastane acil gibi sağlık yerlerinde "Acile gelmeyin" tavsiyesi zarar verebilir | Sağlık kategorisi | Sağlık yerlerinde kalıcı uyarı bandı: "Acil durumda 112'yi ara. Bekleme bilgisi kullanıcı bildirimidir." |
| 15 | Takip/takipçi yok, sadece "Arkadaş: 0" | Profil | Takip grafiği + karşılıklı takip = arkadaş |
| 16 | Yorum, tepki, paylaşım içi etkileşim yok | Sinyal | Tepki, yorum, yanıt, bahsetme (@) |
| 17 | Bildirim merkezi yok | Genel | Aktivite ekranı + push |

### 4.3 Eksik olan ve eklenecek ana yetenekler
1. **Sinyal Kartı (merkez pop-up):** Pine dokununca ekranın ortasında gönderi kartı açılır; medya,
   yazar, tip/seviye, doğrulama, tepki, yorum önizlemesi, yorum yazma. Aynı noktadaki diğer sinyaller
   arasında yatay kaydırma.
2. **Gönderi detayı + yorumlar:** Tam ekran, yanıtlı yorumlar, @bahsetme, yorum beğenme.
3. **Tam ekran medya görüntüleyici:** Pinch-zoom, kaydırarak kapatma, video oynatma.
4. **Hikayeler:** Takip edilenlerin aktif sinyalleri hikaye halkası olarak; tam ekran hikaye
   görüntüleyici; hikayeye DM ile yanıt.
5. **Keşfet akışı:** "Yakınımda" ve "Takip" sekmeleri, gönderi kartları, yer durum kartları.
6. **Profil (Instagram tarzı):** Avatar + hikaye halkası, sayaçlar (Sinyal, Takipçi, Takip), bio,
   @kullanıcıadı, rozetler, güven puanı, sekmeler (Izgara / Harita / Kaydedilenler).
7. **Sosyal grafik:** Takip, gizli hesap + takip isteği, karşılıklı takip = arkadaş, engelle,
   sessize al, kişi arama, önerilen kişiler.
8. **Kaydedilenler:** Sinyal ve yer kaydetme, koleksiyonlar, sunucuda senkron.
9. **Yer sayfası + yer takibi:** Yerin canlı durumu, son sinyaller ızgarası, "Bu yeri takip et" →
   yeni sinyalde bildirim.
10. **Kamera-öncelikli oluşturma:** + → anında tam ekran kamera; foto/video/metin modu; filtre
    kaydırma; çıkartma; metin; tek "Gönder" ekranında hedef seçimi (Harita / Hikayem / Arkadaşlar).
11. **Bildirimler:** Uygulama içi aktivite + push + ayarlar.
12. **Güven & oyunlaştırma:** Güven puanı, seviyeler, rozetler, seri (streak).
13. **Global hazırlık:** tr/en (genişletilebilir), birim/saat formatı, açık/koyu tema, erişilebilirlik.
14. **Güvenlik:** Moderasyon, raporlama, engelleme, hesap silme, konum bulanıklaştırma, EXIF temizleme.

### 4.4 Ben olsam ayrıca ne koyardım (ürün önerileri)
- **Tazelik halkası (imza öğe):** Sinyaller kısa ömürlü; bu yüzden her pin, avatar ve kart başlığında
  sinyalin kalan ömrünü gösteren ince bir halka olur. Halka zamanla azalır, "canlı" sinyallerde hafif
  nabız atar. Bu, uygulamanın görsel kimliğinin tek cesur öğesidir; geri kalan arayüz sade kalır.
- **"Oraya gitmeden sor":** Bir yerde aktif sinyal yoksa "Soru sor" butonu; o yerin 300 m yakınındaki
  gönüllü kullanıcılara bildirim gider ("Kent Meydanı şu an kalabalık mı?"). Cevap = yeni sinyal.
  (MVP'de basit sürüm: soru yer sayfasına düşer, yakındakilere push gider.)
- **"Faydalı" tepkisi:** Standart emoji tepkilerinin yanında "🙏 Teşekkürler" tepkisi; güven puanını
  besler. Pratik bilginin sosyal ödülü.
- **Yer takibi + akıllı bildirim:** "Hastane acil: bekleme 30+ dk'dan 5–15 dk'ya düştü."
- **Sinyali sohbete paylaş:** DM'de zengin kart olarak.
- **Arşiv:** Haritadan kalkan sinyaller profilde kalır (kullanıcı isterse gizler) — Snap "Anılar" hissi.
- **Arkadaş konumu (V1.1, opt-in):** Snap Map benzeri; varsayılan kapalı (Ghost Mode), süreli paylaşım.

## 5. MVP kapsamı
**MVP'ye dahil:** 4.3'teki 1–14 arası maddeler, 4.4'teki tazelik halkası, "Faydalı" tepkisi, yer
takibi, sinyali sohbete paylaşma, arşiv, basit "Soru sor".
**MVP dışı (V1.1+):** Arkadaş konumu, grup sohbeti, lider tablosu, işletme hesapları, "genelde ne
kadar kalabalık" saatlik grafiği, otomatik yüz bulanıklaştırma (V1.1'de on-device), web sürümü.

## 6. Başarı metrikleri (MVP)
- Aktivasyon: kayıttan sonraki 24 saatte ilk sinyal veya ilk doğrulama oranı ≥ %35
- Sinyal başına ortalama doğrulama ≥ 1,5 (bilgi güvenilirliği)
- D7 retention ≥ %20, D30 ≥ %10
- Pin → Sinyal Kartı açılma oranı, kart → yorum/tepki oranı
- Takip eden kullanıcı başına ortalama takip ≥ 5 (sosyal grafik sağlığı)
- Rapor edilen içerik oranı < %1, rapor sonrası ortalama müdahale süresi < 24 saat
