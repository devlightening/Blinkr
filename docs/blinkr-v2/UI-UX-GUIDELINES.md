# UI-UX-GUIDELINES — Blinkr V2 tasarım sistemi

Hedef his: **gece haritası üzerinde parlayan canlı anlar.** Koyu, sakin yüzeyler; enerji yalnız
gradyandan ve içerikten (fotoğraf, video, sinyal renkleri) gelir. Snapchat'in oyunculuğu + Instagram'ın düzeni.

## 1. Renk
### 1.1 Koyu tema (varsayılan)
| Token | Değer | Kullanım |
|---|---|---|
| `background` | `#0E0F12` | Ekran zemini |
| `surface` | `#17191D` | Kart, sheet, alt bar |
| `surfaceElevated` | `#20232A` | Çip, giriş alanı, basılı durum |
| `line` | `#2A2E36` | Nadir ayırıcı (yüzeyler tercihen tonla ayrılır) |
| `border` | `rgba(255,255,255,0.06)` | Kıl çizgi |
| `text` | `#F5F6F8` | Birincil metin |
| `textSecondary` | `#A3A9B4` | İkincil metin |
| `textMuted` | `#6F7682` | Zaman damgası, pasif |
| `primary` | `#FF6B6B` (gradyan orta) | Tek renk gereken vurgu (bağlantı, seçili ikon) |
| `danger` | `#FF5A5F` | Silme, hata |
| `success` | `#4ADE80` | "Konumda" doğrulama |

### 1.2 Gradyan
```ts
export const gradients = {
  brand: ['#FFC83D', '#FF6B6B', '#B06BFF'] as const,   // (+), birincil düğme, seçili sekme noktası
  story: ['#FFC83D', '#FF6B6B', '#B06BFF'] as const,   // görülmemiş hikaye halkası
  storySeen: ['#3A3F48', '#3A3F48'] as const,          // görülmüş halka (düz gri)
  scrimTop: ['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'] as const,     // medya üstü okunabilirlik
  scrimBottom: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)'] as const,
};
export const gradientAngle = { start: { x: 0, y: 1 }, end: { x: 1, y: 0 } };  // sol-alt → sağ-üst (IG gibi)
```
Kurallar:
- Gradyan **yalnız**: (+) oluştur düğmesi, hikaye halkası, birincil CTA ("Paylaş", "Gönder"), seçili sekme göstergesi, beğeni patlaması.
- Gradyan üstündeki metin `#0E0F12` (koyu) — sarı uçta kontrast için; beyaz metin yalnız mor uçta.
- Bir ekranda en fazla **bir** gradyan dolgulu büyük öğe.

### 1.3 Açık tema (ayarlardan)
Mevcut kağıt paleti (`#FCFBF8` zemin, beyaz kart) korunur; `primary` açıkta `#E0484F` (AA kontrast),
gradyan aynı.

### 1.4 Sinyal türü renkleri
Mevcut `signalTints` (dolgu) + `signalInks` (yazı) çiftleri korunur: Kalabalık=apricot, Sıra=butter,
Durum=coral, Fırsat=bubblegum, Etkinlik=grape, Genel=sky, Yeni açılış=periwinkle.

## 2. Tipografi
| Stil | Boyut/satır | Font | Kullanım |
|---|---|---|---|
| display | 34/40 | Outfit ExtraBold | Profil adı büyük |
| headline | 24/30 | Outfit Bold | Ekran başlığı |
| title | 19/25 | Outfit Bold | Kart başlığı, sheet başlığı |
| heading | 16/21 | Outfit SemiBold | Liste başlığı, kullanıcı adı |
| body | 15/21 | Sistem 400 | Gövde, açıklama, yorum |
| callout | 14/19 | Sistem 500 | Meta satırı |
| caption | 12/16 | Sistem 500 | Zaman, sayaç |
| micro | 11/13 | Sistem 600 | Rozet |
Büyük harf etiket yok. Dinamik tip: `allowFontScaling` açık, satır sığmazsa `numberOfLines` + kısaltma.

## 3. Boşluk, yarıçap, ölçü
- Boşluk: 4 / 8 / 12 / 16 / 24 / 32. Ekran kenarı 16.
- Yarıçap: 10 (küçük), 16 (kart içi, çip), 24 (kart), 32 (yüzen kart, sheet), 999 (hap).
- Dokunma alanı ≥ 44×44. Düğme yükseklikleri 40 / 48 / 56.
- Alt bar: 64 yükseklik + güvenli alan; (+) 52 çap.
- Hikaye halkası: avatar 60, halka kalınlığı 2.5, halka ile avatar arası 2.5 boşluk (zemin rengi).

## 4. Derinlik
- Koyu temada gölge yerine **ton farkı** (background → surface → surfaceElevated).
- Yüzen öğeler (kart, alt bar, arama): `shadowFloat` + koyuda 1px `rgba(255,255,255,0.06)` üst kenar.
- Medya üstü krom: `gradients.scrimTop/Bottom`, asla düz siyah kutu.

## 5. Hareket
| Durum | Değer |
|---|---|
| Basma | ölçek 0.96, `springs.snappy` |
| Sheet / kart açılış | `springs.sheet` (sıçramasız) |
| Kart → tam sayfa | `springs.sheet`, köşe 32 → 0, kenar boşluğu 10 → 0 |
| Sekme geçişi | 180 ms opaklık + 8 pt dikey kayma |
| Hikaye kişi geçişi | 3D küp (rotateY ±90°, perspective 800), parmağı izler |
| Beğeni | kalp 0 → 1.2 → 1 ölçek, 350 ms; gradyan dolgu |
| Hareketi Azalt | tüm yaylar 150 ms opaklığa düşer, küp → yatay kayma |

## 6. Kalıplar
- **Alt bar** (Instagram): 5 öğe, etiket yok, aktif = dolu ikon + altında 4 pt gradyan nokta; Profil = 26 pt avatar,
  aktifken gradyan halka. (+) gradyan daire, beyaz `Plus` ikonu, basınca hafif titreşim.
- **Hikaye tepsisi**: Keşfet'in en üstünde yatay kaydırma, ilk öğe "Hikayen" (+ rozeti).
- **Gönderi kartı** (Keşfet): başlık satırı (avatar 32, ad, yer · zaman, ⋯), tam genişlik medya (4:5),
  eylem satırı (tepki, yorum, paylaş, kaydet), beğeni sayısı, açıklama (2 satır, "devamı"), "N yorumun tümünü gör".
- **Harita kartı**: alttan yükselen yüzen kart → yukarı çekince tam sayfa.
- **Boş durum**: ikon + tek cümle + tek eylem; asla boş ekran.
- **Yükleme**: iskelet (satır şekilli), spinner yalnız düğme içinde.
- **Hata**: sade cümle + "Tekrar dene"; önceki veri ekranda kalır.

## 7. Erişilebilirlik
- Kontrast: metin AA (4.5:1), büyük metin/ikon 3:1 — `npm run test:theme` her iki temada denetler.
- Her dokunulabilir öğe `accessibilityRole` + `accessibilityLabel` (i18n).
- Renk tek başına anlam taşımaz (tür = renk + ikon).
- Hikaye ve video: ekran okuyucuda otomatik ilerleme durur; "sonraki/önceki" eylemleri.
- Hareketi Azalt ve Kalın Metin sistem ayarlarına uyulur.

## 8. Küresellik
- Tüm metin i18n (tr, en; yeni dil = yeni JSON). Tarih/sayı `i18n/locale.ts` ile.
- Metinler %40 uzamaya dayanıklı yerleşim (Almanca testi).
- İkonlar evrensel (lucide); kültüre özgü emoji yerine standart set.
- RTL: yerleşimde `start/end` kullanılır (RTL dil eklendiğinde çevirme yeter).
