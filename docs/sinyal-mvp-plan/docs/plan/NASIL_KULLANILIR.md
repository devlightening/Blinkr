# Nasıl kullanılır? (Senin için kısa rehber)

## 1. Dosyaları projeye koy
ZIP'i açınca şu yapı çıkar:
```
CLAUDE.md
docs/plan/00_START_HERE.md … 14_TESTING_QA_RELEASE.md
docs/plan/PROGRESS.md
docs/plan/DECISIONS.md
docs/plan/NASIL_KULLANILIR.md
```
Bunları **projenin kök klasörüne** kopyala (mobil + backend aynı repodaysa o reponun köküne; ayrı
repolarsa ikisini de içeren üst klasöre ya da ana repoya).
Projende zaten bir `CLAUDE.md` varsa, bu dosyanın içeriğini mevcut olanın sonuna ekle.

## 2. Claude Code'u başlat
Proje klasöründe terminalde `claude` komutunu çalıştır ve ilk mesaj olarak şunu yaz:

```
CLAUDE.md ve docs/plan/00_START_HERE.md dosyalarını oku. Faz 0'dan başla:
repoyu incele ve docs/plan/AUDIT.md dosyasını oluştur. Bitince bana özet ver
ve açık soruları sor, sonra Faz 1'e geç.
```

## 3. Sonraki oturumlarda
Claude Code'un bağlamı dolduğunda veya yeni oturum açtığında sadece şunu yaz:
```
docs/plan/PROGRESS.md dosyasını oku ve kaldığın yerden devam et.
```

## 4. İpuçları
- Her fazın sonunda uygulamayı simülatörde açıp dene. Beğenmediğin bir şey varsa hemen söyle
  ("Sinyal Kartı'nda medya daha büyük olsun" gibi); Claude bunu DECISIONS.md'ye yazıp uygular.
- Faz 2 (backend) büyük bir faz. İstersen "Faz 2'yi alt görevlere böl ve her alt görevden sonra dur"
  diyebilirsin.
- Senden isteyeceği şeyler genelde: API anahtarları (Apple/Google giriş, push, depolama), ücretli
  servis tercihi (moderasyon sağlayıcısı gibi) ve veri silen işlemler için onay.
- Gizlilik politikası ve kullanım şartları metinleri yer tutucu olarak gelir; yayından önce bir
  hukukçuya kontrol ettir.
