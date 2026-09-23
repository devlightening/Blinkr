# 00 — Buradan Devam

## 1. Ne bitti, ne bitmedi

### İşlevsel olarak biten ve ekranda doğrulanan
- Kimlik: kayıt/giriş ekranları ("Gitmeden önce bil."), oturum, ayarlar, engellenen kişiler
- Harita: pin, kümeleme (34 / 2 rozetleri), tip filtre çipleri, "Yayınlandı" toast'ı, arama ekranı
  (Yerler | Kişiler, kategori çipleri, son aramalar)
- Keşfet: Yakınımda | Takip | Yerler sekmeleri, hikaye şeridi ("Hikayen"), gönderi kartları,
  kullanıcı alt sayfası (Takip et / Arkadaş ekle / Mesaj gönder / Engelle / Bildir)
- Yorumlar: yorum yazma, listeleme, En yeni | En eski, beğeni sayacı
- Profil: takipçi/takip sayaçları, Izgara | Liste sekmeleri, metin sinyallerinin renkli kareleri,
  kaydedilen yerler (artık "Hesabında saklanır"), e-posta profilden kaldırıldı
- Avatar üreteci (renk / yüz / aksesuar, "Fotoğrafın hiçbir yerde saklanmaz")
- Moderasyon, yetkilendirme, log gizliliği (Faz 10'un yarısı)
- Bileşen önizleme ekranı (Ayarlar > Geliştirici)

### Planda söz verilip koda yansımayanlar (bu paketin konusu)
| Konu | Planda | Uygulamada |
|---|---|---|
| Palet / tema (D-006) | Açık tema varsayılan, adaçayı vurgu, Outfit, yumuşak zemin | Uygulanmamış. Bileşen önizleme hâlâ eski ölçeği gösteriyor: `Display 30/36`, `Title1 22/28`, `Title2 18/24`. Zemin saf siyaha yakın, vurgu parlak mint |
| Sinyal Kartı (merkez pop-up) | Pine dokun → ortada gönderi kartı | Yok. Hâlâ alttan yer sayfası açılıyor |
| Medya kırpması | 4:5, kırpmasız | Yer sayfası üstünde banner'a kırpılıyor, yüz kesiliyor |
| StatRow etiket tekrarı | "Canlı · Orta güven · 283 m" | Hâlâ "Taze **tazelik**", "Orta **güven**" |
| Kamera-öncelikli akış | (+) → kamera, 3 dokunuş | Hâlâ 4 adımlı sihirbaz (Yer → Tür → İçerik → …) |
| Başlık alanı | Kaldırılacaktı | Duruyor ("Başlık" + "Gözlemin") → kartlarda başlık/etiket tekrarı |
| Sohbet | Balon, gün ayırıcı, okundu | Hâlâ sol çizgili log; dün/bugün ayrımı yok |

### Gerçek hatalar (ekran görüntülerinden)
1. **Test verisi canlı ortamda.** Keşfet'te `tf_a_1790169633`, `anonymous-1790171056`,
   "Author privacy smoke (public-1790171056)", "Media privacy smoke", "Taze içerik" kayıtları
   görünüyor. Smoke/kabul betikleri gerçek veritabanına yazıp temizlemiyor.
2. **Yorumlar sayfasında medya boş gri kutu** olarak geliyor (gönderi görseli yüklenmiyor).
3. **Yorumlar sayfasında iki ayrı beğeni/yorum sayaç satırı** üst üste (kartın ve sayfanın).
4. Bileşen önizlemede StatRow'un iki öğesi aynı ikonu kullanıyor (ikisi de konuşma balonu).
5. Profilde 20.038 seed sinyal ve eski uygunsuz metin ("Keyif var amk") duruyor.
6. Sihirbaz sayfalarında üstte ekranın yarısı kadar boşluk.

## 2. Neden bu sıra
Faz A önce, çünkü test verisi ve seed gürültüsü içindeyken hiçbir ekranı doğru değerlendiremezsin.
Faz B ikinci, çünkü C/D/E'de dokunacağımız ekranlar token'ların üstüne kurulu; paleti sonra
uygulamak aynı ekranları iki kez elden geçirmek demek. C-D-E sırası ise kullanıcının hissettiği
etkiye göre: harita kartı → paylaşım → sohbet. Faz 10'un kalanı (F) ve Faz 11–12 (G) en sonda,
çünkü bunlar yayın hazırlığı ve görsel işten bağımsız.

## 3. Faz 10 kalanlarına dair hatırlatma
- **Destek/itiraz adresi:** Hâlâ gerçek bir adres yok. Uydurma. Faz F'de kullanıcıya sor; vermezse
  yer tutucu olarak işaretle ve DECISIONS'a yaz.
- **Görsel moderasyon (P10.2):** Ücretli anahtar gerektirdiği için ertelendi (D-015). Bu paket bunu
  değiştirmiyor.

## 4. Çalışma kuralları (devam paketine özel)
- Her faz tek başına commit edilebilir olmalı; yarım bırakılan iş `[~]` ile işaretlenir.
- Bir ekranı yeniden yazarken mevcut çalışan davranışı (API çağrıları, doğrulama akışı, moderasyon
  kancaları) koru. Bu paket görünüm ve akış değiştiriyor, iş mantığı değil.
- Kabul kriterleri "ekranda şu görünüyor" biçimindedir; simülatörde doğrula.
- Test betikleri artık üretim/geliştirme veritabanına kalıcı veri bırakmamalı (A1).
- Kullanıcı test ederken duraklamak istersen: `PROGRESS_DEVAM.md`'yi güncelle ve durum özetini yaz.
