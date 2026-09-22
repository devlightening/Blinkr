# CLAUDE.md — Proje Talimatları

Bu repo, konum tabanlı canlı "sinyal" paylaşım uygulamasıdır. Uygulama; Snapchat'in kamera-öncelikli
ve harita odaklı deneyimini, Instagram'ın profil/takip/gönderi yapısıyla birleştiren bir sosyal
ağa dönüştürülüyor.

## Önce bunu oku
Tüm plan `docs/plan/` klasöründedir. Çalışmaya başlamadan önce sırasıyla oku:

1. `docs/plan/00_START_HERE.md`  → çalışma kuralları ve yürütme sırası (ZORUNLU)
2. `docs/plan/PROGRESS.md`       → nerede kaldık? (her oturumun başında oku)
3. `docs/plan/13_ROADMAP_PHASES.md` → faz faz görev listesi ve kabul kriterleri

Diğer dokümanlar, ilgili faz geldiğinde referans olarak okunur (00_START_HERE içinde hangi fazda
hangi dosyanın okunacağı yazıyor).

## Değişmez kurallar (kısa özet)
- Sıfırdan yazma. Mevcut stack'i koru, kademeli refactor yap. Uygulama her fazdan sonra çalışır olmalı.
- Plan ile mevcut kod çelişirse en küçük değişiklik yolunu seç, kararı `docs/plan/DECISIONS.md`'ye yaz.
- Renk, boşluk, font gibi değerleri asla hardcode etme; tasarım token'larını kullan (`03_DESIGN_SYSTEM.md`).
- Kullanıcıya görünen her metin i18n anahtarı ile gelir (en az `tr` ve `en`).
- Secret/API key asla koda yazılmaz; `.env.example` güncel tutulur.
- Her faz sonunda: typecheck + lint + test çalıştır, `PROGRESS.md`'yi güncelle, commit at
  (`feat(phase-N): ...` formatında).
- Kullanıcıya yalnızca şu durumlarda soru sor: secret/API anahtarı gerekiyorsa, ücretli servis
  seçimi gerekiyorsa, veri silen (destructive) migration gerekiyorsa.

## Oturum başlangıç ritüeli
Her yeni oturumda: `PROGRESS.md`'yi oku → son tamamlanan görevi bul → bir sonraki `[ ]` görevden devam et.
