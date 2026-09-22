# 14 — Test, Seed Verisi, QA ve Yayın

## 1. Test stratejisi
| Katman | Araç | Kapsam |
|---|---|---|
| Birim (backend) | Vitest/Jest | Sinyal motoru (TTL, uzatma, bulanıklaştırma, canlı durum, güven, sıralama), görünürlük fonksiyonu, metin filtresi, rate limit |
| Entegrasyon (backend) | Vitest + test DB (docker postgis) + supertest | Her uç nokta: mutlu yol + yetki + doğrulama hatası |
| Birim (mobil) | Jest + React Native Testing Library | Tasarım sistemi bileşenleri, formatlayıcılar (zaman, mesafe, sayı), sinyal tipi kataloğu, optimistic güncelleme mantığı |
| E2E (mobil) | Maestro (tercih) veya Detox | §3 senaryoları |
| Manuel | iOS simülatör + gerçek cihaz | Kamera, konum, push, haptik |

**Zorunlu test grupları (atlanamaz):**
1. Gerçek konum sızmıyor: tüm DTO serializer'ları için `location` alanı ve gerçek koordinat değerleri
   yanıtlarda bulunmuyor (seed'de bilinen koordinatla arama yapan test).
2. Görünürlük matrisi: {public, followers, private} × {açık, gizli hesap} × {yabancı, takipçi, istek
   bekleyen, engellenen, sahibi} × {anonim, değil} — beklenen sonuç tablosuyla parametrik test.
3. Doğrulama mesafesi: 499 m kabul, 501 m `TOO_FAR`; kendi sinyali reddedilir.
4. Snap tek seferlik: ikinci `open` 410/403.
5. Sayaç tutarlılığı: tepki ekle/kaldır, yorum ekle/sil sonrası sayaçlar gerçek sayıya eşit.

## 2. Seed verisi (`pnpm db:seed`)
Mevcut sorun: giriş yapan kullanıcıya 20.035 sinyal bağlanmış ve metinlerde `(#19741)` kimlikleri var.
Yeni seed:
- **Kullanıcılar (25):** Mevcut sohbet listesindeki isimler korunur (gamze_tekin, sibel_dogan,
  baris_cakir, yusuf_aksoy, nur_bulut, tolga_kurt, ipek_korkmaz, kaan_yildiz, hatice_gunes,
  oguz_erdogan …) + 15 ek kullanıcı. Çeşitli güven puanları (20–95), 3'ü gizli hesap, illüstrasyon avatarları.
- **Takip grafiği:** Gerçekçi dağılım (bazıları 1–5, bazıları 50+ takipçi), karşılıklı takipler (arkadaşlar).
- **Yerler (60):** Osmaniye merkez (Raufbey Mh., İstiklal Mh., Kent Meydanı, Alparslan Türkeş Bulvarı,
  Mimar Sinan Mh., Adnan Menderes Mh., Fatih, Park 328 AVM, Kent Müzesi, Bülbül Camii, BİM, hastaneler,
  bankalar, eczaneler, parklar) — kategori ve `is_sensitive` doğru işaretli. Kod içinde şehir sabit
  değil; seed yapılandırılabilir (`SEED_CITY=osmaniye|istanbul|london`) ki global demo yapılabilsin.
- **Sinyaller (~800):** Son 48 saate yayılmış; tip dağılımı (crowd %30, wait %25, observation %15,
  traffic %10, status %8, event %5, weather %4, parking %3), ~%40 medyalı (lisanssız yer tutucu
  görseller: düz renk + desen, insan yüzü yok), şu anda aktif ~120 sinyal. Metinler doğal ve ID'siz:
  "Kent Meydanı'nda yer bulmak zor", "Kısa bir bekleme var", "Park dolu, çocuklar çok".
- **Etkileşimler:** Tepkiler, yorumlar (yanıt ve @bahsetme içeren), doğrulamalar (tutarlı ve çelişkili
  örnekler), kaydedilenler, koleksiyonlar.
- **Sohbetler:** Mevcut sohbet örnekleri korunur ("Gamze, çocuk parkı bu saatte nasıl?" …) + snap ve
  paylaşılan sinyal mesajları.
- **Giriş kullanıcısı (demo):** `demo@example.com` — 12 sinyal, 40 takipçi, 35 takip, 3 rozet. Gerçek
  bir e-posta adresi kullanılmaz.
- Seed deterministik (sabit rastgele tohum) ve tekrar çalıştırılabilir (`--reset`).
- **Mevcut kullanıcının seed sinyalleri:** Migration ile demo kullanıcılara yeniden dağıtılır veya
  silinir (kullanıcıya sorulmadan veri silme yok: DECISIONS.md + soru).

## 3. E2E senaryoları
1. **Onboarding:** Kayıt → kullanıcı adı → profil → izinler → öneriden 2 kişi takip → haritada ilk görev kartı.
2. **Haritadan bilgi:** Harita açılır → pine dokun → Sinyal Kartı → sağa kaydır (2. sinyal) → medyaya
   dokun → tam ekran → kapat → "Evet, hâlâ böyle" → sayaç +1.
3. **Paylaşım:** (+) → foto → filtre kaydır → "Kalabalık" çıkartması → İleri → tip otomatik Doluluk →
   seviye → yer → Gönder (Harita + Hikayem) → toast "Paylaşıldı" → haritada kendi pini.
4. **Çevrimdışı paylaşım:** Ağ kapalı → paylaş → ilerleme çipi bekliyor → ağ açık → yüklendi.
5. **Yorum:** Kart → yorum ekle → @gamze bahset → gönder → detayda görünür → gamze hesabında bildirim.
6. **Takip:** Keşfet → karttan profile → Takip et → Takip sekmesinde sinyalleri → takibi bırak.
7. **Gizli hesap:** Gizli hesaba istek → o hesapla kabul → içerik görünür.
8. **Engelleme:** Kullanıcıyı engelle → haritadan pinleri, akıştan kartları kalkar → profili bulunamaz.
9. **Snap:** Sohbet → kamera → snap gönder → alıcı açar → ikinci kez açılamaz → göndericide "Açıldı".
10. **Hikaye:** Şeritten hikaye aç → dokunarak geç → yanıt gönder → DM'de hikaye yanıtı.
11. **Yer takibi:** Yer sayfası → takip et (durum değişince) → başka hesaptan farklı seviyede sinyal →
    bildirim satırı oluşur.
12. **Hesap silme:** Ayarlar → hesabı sil → çıkış → tekrar giriş → "Geri al" seçeneği.
13. **Dil:** Ayarlar → English → tüm ekranlar İngilizce, göreli zamanlar "min ago".

## 4. Manuel QA kontrol listesi (her faz sonunda ilgili kısım)
- [ ] Koyu ve açık temada tüm yeni ekranlar
- [ ] Küçük ekran (iPhone SE / 375pt) ve büyük ekran (Pro Max); Android orta seviye cihaz
- [ ] En büyük yazı boyutunda taşma yok
- [ ] Ağ yavaş (3G profili) iken skeleton'lar ve hata durumları
- [ ] İzin reddedilmiş durumlar (konum, kamera, bildirim, fotoğraflar)
- [ ] Uygulama arka plana alınıp dönünce realtime yeniden bağlanıyor, eksik veri tamamlanıyor
- [ ] Hareketi Azalt açık

## 5. Yayın kontrol listesi
- [ ] Sürüm numarası ve build numarası artırıldı; değişiklik notları (tr/en)
- [ ] Production env değişkenleri tanımlı; `.env.example` güncel; secret'lar repoda yok
- [ ] Migration'lar production'a karşı prova edildi (staging kopyası), yedek alındı
- [ ] Sentry release + source map'ler yüklendi
- [ ] Push sertifikaları/anahtarları (APNs, FCM) yapılandırıldı
- [ ] Evrensel link dosyaları (`apple-app-site-association`, `assetlinks.json`) yayında
- [ ] App Privacy / Data Safety formları, yaş derecelendirmesi (UGC nedeniyle 12+/Teen üstü)
- [ ] 11 §7 UGC kontrol listesi tamam
- [ ] Mağaza ekran görüntüleri demo modundan (gerçek kullanıcı verisi/yüzü yok)
- [ ] İnceleme ekibi için demo hesap bilgileri ve not ("konum tabanlı içerik için Osmaniye demo verisi")
- [ ] Kademeli yayın (phased release) açık; çökme oranı izleniyor (hedef crash-free > %99,5)
