# Nasıl kullanılır?

## 1. Dosyaları projeye koy
ZIP'i aç, içindekileri **projenin kök klasörüne** kopyala:
```
CLAUDE_DEVAM.md            → kök (içeriğini mevcut CLAUDE.md'nin sonuna ekle)
docs/plan-devam/*.md       → olduğu gibi
```
Mevcut `docs/plan/` klasörüne dokunma; ayrıntılı ekran ve mimari tanımları orada duruyor ve bu
paket oraya referans veriyor.

## 2. Claude Code'u başlat
```
CLAUDE_DEVAM.md ve docs/plan-devam/00_BURADAN_DEVAM.md dosyalarını oku.
Faz A'dan başla (docs/plan-devam/01_FAZ_A_DOGRULAMA_TEMIZLIK.md).
Veri silen adımlarda (A2, A3) bana sormadan silme.
Her faz sonunda PROGRESS_DEVAM.md'yi güncelle ve bana kısa özet ver.
```

## 3. Sonraki oturumlarda
```
docs/plan-devam/PROGRESS_DEVAM.md dosyasını oku, kaldığın yerden devam et.
```

## 4. Bilmen gerekenler
- **Faz A'da sana iki kez soru soracak**: hangi test/seed kayıtlarının silineceği konusunda.
  Listeyi görüp onaylaman lazım.
- **Faz F'de destek e-posta adresi isteyecek.** Gerçek bir adres (ör. `destek@alanadın.com`)
  vermen gerekiyor; App Store uygulama içinde iletişim bilgisi şart koşuyor. Adres yoksa faz
  yer tutucuyla devam eder ama yayından önce mutlaka doldurulmalı.
- **Faz B'den sonra uygulama açık temada açılacak.** Görüp "şu ton fazla soluk" dersen token'lar
  tek dosyada olduğu için ince ayar birkaç dakikalık iş.
- **Faz C, D, E görsel olarak en büyük değişimi getirecek.** Her birinin sonunda simülatörde
  gezip onay vermen en sağlıklısı; hatalı bir yön varsa bir sonraki faza geçmeden söyle.
- Faz A ve B kısa (yarım–bir gün). C, D, E daha uzun. F ve G yayın hazırlığı.

## 5. Öneri
Her fazın sonunda "bana ekran görüntüsü alıp göster" demek yerine kendin simülatörde gez.
Kabul kriterleri bilerek "ekranda şu görünüyor" biçiminde yazıldı; okuyup tek tek bakabilirsin.
