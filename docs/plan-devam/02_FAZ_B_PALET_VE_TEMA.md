# Faz B — Palet ve Tema (D-006'nın uygulanması)

**Amaç:** Kullanıcının seçtiği yönü koda taşımak: **açık tema varsayılan** (koyu tema tam destekli),
vurgu **adaçayı**, his **yumuşak renk + cesur form** (BeReal/Snapchat enerjisi neonla değil
yuvarlaklık, büyük tipografi ve zıplayan hareketle verilir).

Bu karar `docs/plan/DECISIONS.md` D-006'da kayıtlı ama koda yansımamış. Bileşen önizleme hâlâ eski
ölçeği (`Display 30/36`, `Title1 22/28`, `Title2 18/24`) ve eski paleti gösteriyor.

> Uygulamadan önce: `theme.ts` (veya karşılığı) token dosyasının mevcut yapısını oku ve **token
> adlarını koru**; yalnızca değerleri ve eksik olanları değiştir/ekle. Ekranların token adlarıyla
> kurduğu bağ bozulmasın.

## B1–B11 görevleri

- [ ] **B1 — Ham palet.** Aşağıdaki değerleri token dosyasına yaz. Eski `mint*` anahtarları kalkar
      (kullanımları adaçayına eşlenir).
```ts
// Sıcak kağıt (açık tema zeminleri)
paper50:'#FCFBF8'  paper100:'#F6F4EE'  paper200:'#EDEAE2'  paper300:'#E1DDD3'
// Mürekkep (açık temada metin)
ink900:'#15181B'   ink700:'#3A4046'    ink500:'#6C757D'    ink400:'#949CA3'
// Kömür (koyu tema zeminleri — saf siyah DEĞİL)
coal900:'#16191D'  coal800:'#1E2227'   coal700:'#272C32'   coal600:'#343A41'
chalk50:'#F3F1EC'  chalk300:'#A6AFB7'
// Adaçayı (marka vurgusu)
sage200:'#D6F0E4'  sage300:'#A8DCC6'   sage400:'#7FCAA9'
sage500:'#5DB693'  sage600:'#3E9A7A'   sage700:'#2E7A60'  sage900:'#16352B'
// Güneş (yalnızca oluştur/gönder)
sun400:'#FFD86E'   sun500:'#FFC83D'    sun600:'#D99F1F'
// Sinyal tipleri: tint + ink çifti
apricot:'#FFA45B'/'#A85B15'   butter:'#F4C95D'/'#946A0C'   coral:'#FF7A6B'/'#C23D2E'
bubblegum:'#F49AC2'/'#B2517D' grape:'#A78BFA'/'#6D4AC9'    sky:'#6EC1F0'/'#1F7BAD'
periwinkle:'#8E9BFF'/'#4A57C9' stone:'#9AA7B4'/'#5A6672'
```
- [ ] **B2 — Semantik token'lar.**

| Token | Açık (varsayılan) | Koyu |
|---|---|---|
| `bg.canvas` | paper50 | coal900 |
| `bg.surface` | #FFFFFF | coal800 |
| `bg.surfaceRaised` | #FFFFFF | coal700 |
| `bg.surfaceSunken` | paper100 | coal700 |
| `bg.overlay` | rgba(21,24,27,0.32) | rgba(10,12,14,0.56) |
| `bg.glass` | rgba(252,251,248,0.82) | rgba(30,34,39,0.78) |
| `border.subtle` | rgba(21,24,27,0.06) | rgba(255,255,255,0.07) |
| `border.default` | paper300 | coal600 |
| `border.strong` | ink900 | chalk50 |
| `text.primary` | ink900 | chalk50 |
| `text.secondary` | ink500 | chalk300 |
| `text.tertiary` | ink400 | #7C858D |
| `text.onAccent` | #FFFFFF | ink900 |
| `text.onCreate` | ink900 | ink900 |
| `accent.primary` | sage600 | sage400 |
| `accent.primaryBold` | sage700 | sage300 |
| `accent.primarySoft` | sage200 | sage900 |
| `accent.create` | sun500 | sun500 |
| `state.danger` | coralInk | coral |
| `state.success` | sage600 | sage400 |
| `state.info` | skyInk | sky |

- [ ] **B3 — Açık tema varsayılan.** Tema çözümü: kullanıcı ayarı > sistem > **açık**.
      Ayarlar > Görünüm ekranı: Sistem / Açık / Koyu. Tema değişimi anlık ve harita dahil her
      yüzeyi kapsamalı.
- [ ] **B4 — Tipografi.** `Outfit` (Google Fonts, OFL) başlık/rakam/buton fontu olarak eklenir;
      gövde sistem fontu kalır. Türkçe glifleri (ğ ş ı İ ç ö ü) kurulumdan önce test et; sorun
      varsa sistem fontuna düş ve DECISIONS'a yaz. Yeni ölçek:

| Token | Boyut/Satır | Ağırlık | Font |
|---|---|---|---|
| display | 34/40 | 800 | Outfit |
| title1 | 24/30 | 700 | Outfit |
| title2 | 19/25 | 700 | Outfit |
| headline | 16/21 | 600 | Outfit |
| body | 15/21 | 400 | Sistem |
| callout | 14/19 | 500 | Sistem |
| caption | 12/16 | 500 | Sistem |
| micro | 11/13 | 600 | Sistem |

      Rakamlar `tabular-nums`. Büyük harf (ALL CAPS) etiket yok — mevcut "İSTEĞE BAĞLI",
      "HARİTA KONUMU" gibi etiketler cümle düzenine çevrilir.
- [ ] **B5 — Köşe, boşluk, buton.** radius: sm 10 · md 16 · lg 24 · xl 32 · pill 999.
      Buton yükseklikleri 40 / 48 / 56. Ekran yatay padding 16.
- [ ] **B6 — Gölge.** Açık temada kart gölgesi `0 2 12 rgba(21,24,27,0.06)`, yüzen öğe
      `0 8 24 rgba(21,24,27,0.10)`. Koyu temada gölge yerine kenarlık + zemin kademesi.
- [ ] **B7 — Hareket.** Varsayılan yay `{damping:14, stiffness:200}` (hafif taşmalı); ciddi
      bağlamlarda (hata, silme onayı) `{damping:22, stiffness:240}` taşmasız. Basma ölçeği 0.96.
      "Hareketi Azalt" açıkken taşma ve nabız kapanır.
- [ ] **B8 — Sinyal tipi renkleri.** Tip kataloğu `tint` + `ink` çiftine geçer:
      Doluluk apricot · Bekleme butter · Geçici durum coral · Trafik bubblegum · Etkinlik grape ·
      Hava sky · Park periwinkle · Gözlem stone. Rozet zemini `tint`, metin/ikon `ink`.
      Koyu temada `tint` %22 opak zemin, metin `tint` rengin kendisi.
- [ ] **B9 — Harita stili + pin okunabilirliği.** Açık temada sakin/düşük doygunluklu harita stili,
      koyu temada kömür. Pastel pinler açık zeminde kaybolmasın diye her pin:
      2px `border.strong` kenarlık + `0 3 10 rgba(21,24,27,0.18)` gölge; dolgu tip `tint`,
      ikon tip `ink`; seçili pin beyaz halka + ölçek 1.2.
- [ ] **B10 — Bileşen önizleme güncellemesi.** Ekran yeni ölçeği ve token'ları göstermeli
      (`Display 34/40`, `Title1 24/30`, `Title2 19/25`). Bu ekran fazın kanıtıdır: iki temada da
      açıp kontrast kontrolü yap (metin 4.5:1, büyük metin 3:1). Başarısız kombinasyonları düzelt.
- [ ] **B11 — Ham renk taraması.** UI dosyalarında `#` hex ve `rgba(` kullanımını grep'le, sıfıra
      indir. Kalanları token'a taşı.

## Kabul kriterleri (ekranda)
- Uygulama açık temada açılıyor; zemin kırık beyaz, kartlar beyaz, vurgu adaçayı.
- Sarı yalnızca (+) ve "Gönder" eyleminde; başka hiçbir yerde yok.
- Bileşen önizleme yeni ölçeği gösteriyor ve iki temada da doğru.
- Haritada sekiz tipin pini açık zeminde birbirinden ayırt edilebiliyor.
- Hiçbir UI dosyasında ham renk yok.
- Uygulamada ALL CAPS etiket kalmadı.
