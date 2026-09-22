# 02 — Bilgi Mimarisi, Navigasyon ve Akışlar

## 1. Alt sekme çubuğu (Tab Bar)

Mevcut: `Sohbet · Harita · (+) · Yakında · Profil`
Yeni:   `Harita · Keşfet · (+) · Sohbet · Profil`

| Sekme | İkon | Açıklama | Değişiklik |
|---|---|---|---|
| **Harita** (varsayılan açılış) | map | Canlı sinyaller, yerler, hikaye şeridi | İlk sekmeye taşındı, uygulama bununla açılır |
| **Keşfet** | compass | Yakınımda / Takip akışı + hikayeler | "Yakında" listesinin yerini alır ve genişler |
| **(+) Oluştur** | + (sarı, büyük) | Tam ekran kamera (modal) | Önce seçim sayfası çıkıyordu; artık doğrudan kamera açılır |
| **Sohbet** | chat bubble | Konuşmalar, snap'ler | Rozet: okunmamış sayısı |
| **Profil** | avatar (kullanıcının kendi avatarı) | Instagram tarzı profil | İkon yerine küçük avatar (aktif hikaye varsa halkalı) |

Kurallar:
- Tab bar koyu, blur'lu, yüzen kapsül (mevcut hissi koru), safe-area uyumlu.
- Aktif sekmeye tekrar dokunmak: listeyi en üste kaydırır / haritayı konumuna ortalar.
- (+) butonuna uzun basma: doğrudan "Sadece metin sinyali" modunu açar (kısa yol).
- Harita sekmesindeyken yukarı kaydırılan sayfalar tab bar'ı gizlemez; Keşfet'te aşağı kaydırırken
  tab bar yarı saydamlaşır.

## 2. Ekran haritası

```
Root
├── (auth)                      Giriş yapılmamışsa
│   ├── welcome                 Değer önerisi, 3 slayt
│   ├── sign-in                 Apple / Google / e-posta
│   ├── sign-up                 e-posta + şifre
│   ├── onboarding/username     @kullanıcıadı seç (uygunluk kontrolü canlı)
│   ├── onboarding/profile      ad, avatar, doğum yılı (yaş kapısı)
│   ├── onboarding/permissions  konum → bildirim → kamera (her biri gerekçeli)
│   └── onboarding/follow       önerilen kişiler / yakındaki popüler yerler
│
├── (tabs)
│   ├── map                     Harita (ana)
│   ├── explore                 Keşfet (Yakınımda | Takip)
│   ├── create                  (modal olarak açılır, sekme değil)
│   ├── chat                    Konuşma listesi
│   └── profile                 Kendi profilin
│
├── signal/[id]                 Gönderi detayı (tam ekran, yorumlar)
├── signal/[id]/media           Tam ekran medya görüntüleyici (modal)
├── place/[id]                  Yer sayfası
├── user/[username]             Başka kullanıcının profili
├── user/[username]/followers   Takipçiler / Takip edilenler (sekmeli)
├── stories/[userId]            Hikaye görüntüleyici (tam ekran modal)
├── create/camera               Kamera
├── create/edit                 Filtre, çıkartma, metin
├── create/details              Tip, seviye, yer, açıklama, görünürlük
├── create/send                 Hedef seçimi: Harita / Hikayem / Arkadaşlar
├── chat/[conversationId]       Sohbet ekranı
├── chat/new                    Yeni sohbet (kişi seç)
├── snap/[messageId]            Snap görüntüleyici (bir kez)
├── notifications               Aktivite / bildirim merkezi
├── search                      Kişi + yer arama (sekmeli)
├── saved                       Kaydedilenler (koleksiyonlar)
├── saved/[collectionId]
├── settings                    Ayarlar kökü
│   ├── account                 e-posta, şifre, bağlı hesaplar, hesabı sil
│   ├── privacy                 gizli hesap, kim mesaj atabilir, varsayılan görünürlük, anonim
│   ├── notifications           bildirim tercihleri
│   ├── blocked                 engellenenler
│   ├── language                dil
│   ├── appearance              tema: sistem / koyu / açık
│   └── about                   sürüm, kullanım şartları, gizlilik politikası, iletişim
└── edit-profile                Profili düzenle
```

## 3. Derin bağlantılar (deep links)
Şema: `app://` ve evrensel link `https://<domain>/…`
- `/s/{signalId}` → signal/[id]
- `/p/{placeId}` → place/[id]
- `/u/{username}` → user/[username]
- `/invite/{code}` → kayıt + otomatik takip
Paylaş butonları bu linkleri üretir. Giriş yapılmamışsa önce auth, sonra hedefe yönlendir.

## 4. Kritik kullanıcı akışları

### Akış A — Haritadan bilgi alma
```
Harita → pine dokun → [Sinyal Kartı pop-up, merkezde]
   ├─ medyaya dokun → Tam ekran görüntüleyici
   ├─ yatay kaydır → aynı yerdeki / kümedeki sonraki sinyal
   ├─ "Hâlâ böyle mi?" → Evet (anında +1, haptik) / Değişti (seviye seçici açılır)
   ├─ tepki → hızlı emoji çubuğu
   ├─ "Yorumlar (8)" veya yorum alanı → Gönderi detayı (paylaşılan öğe geçişi)
   ├─ yer adına dokun → Yer sayfası
   ├─ yazar adına dokun → Kullanıcı profili
   └─ aşağı kaydır / arka plana dokun → kapat
```

### Akış B — Sinyal paylaşma (Snapchat tarzı, 3 dokunuşta)
```
(+) → Kamera (anında açık)
   → dokun = foto / basılı tut = video (maks 15 sn) / galeri / "Aa" = sadece metin
   → Düzenleme: yatay kaydır = filtre, çıkartma, metin
   → "İleri" → Detaylar sayfası:
        tip (büyük çipler) → seviye (segment) → yer (otomatik öneri) → açıklama (opsiyonel)
   → "Gönder" → Gönder ekranı:
        [✓ Harita (herkese açık)] [✓ Hikayem] [arkadaş listesi, çoklu seçim]
   → Paylaşıldı toast'ı + haritada kendi pinin nabızla belirir
```

### Akış C — Takip etme
```
Sinyal Kartı / Keşfet / Arama → kullanıcı adı → Profil
   → "Takip et" → (hesap açıksa) Takip ediliyor | (gizliyse) İstek gönderildi
   → karşılıklı takip olunca: "Arkadaşsınız" rozeti, snap gönderebilir
```

### Akış D — Yer takibi
```
Yer sayfası → "Takip et" (zil ikonlu) → bildirim tercihi: Tüm sinyaller / Sadece durum değişince
   → yeni sinyal gelince push → dokun → Sinyal Kartı açık halde harita
```

### Akış E — Hikaye izleme
```
Harita üst şeridi veya Keşfet üst şeridi → avatar halkası
   → tam ekran hikaye: dokun sağ = sonraki, sol = önceki, basılı tut = durdur
   → yukarı kaydır = gönderi detayı/yorumlar, "Yanıtla" alanı = DM
   → aşağı kaydır = kapat
```

## 5. Modal ve sayfa kuralları
- **Sinyal Kartı:** Harita üzerinde merkezde açılan kart (tam ekran değil). Arka plan karartılır +
  blur. Tek seferde tek kart.
- **Alt sayfa (bottom sheet):** Filtreler, seviye seçimi, paylaş menüsü, "…" menüsü, rapor.
- **Tam ekran modal:** Kamera, hikaye, medya görüntüleyici, snap görüntüleyici.
- **Push navigasyon:** Profil, yer, gönderi detayı, sohbet, ayarlar.
- Geri hareketi (iOS kenardan kaydırma, Android geri tuşu) her yerde çalışır.
