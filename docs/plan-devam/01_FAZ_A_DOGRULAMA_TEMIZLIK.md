# Faz A — Doğrulama ve Temizlik

**Amaç:** Ekranı gerçek veriyle görebilir hâle getirmek ve "tamam" denmiş ama ekranda karşılığı
olmayan maddeleri kapatmak. Yeni ekran yazılmaz.
**Süre beklentisi:** yarım gün.

- [ ] **A1 — Test verisini izole et.** Smoke/kabul betikleri (`scripts/test-*.ps1`, `tests/*`)
      geliştirme veritabanına kalıcı kayıt bırakıyor: Keşfet'te `tf_a_1790169633`,
      `anonymous-1790171056`, "Author privacy smoke", "Media privacy smoke", "Taze içerik" gibi
      kayıtlar görünüyor. İki şeyi birden yap:
      (a) Betikler ürettikleri kullanıcı/sinyal/yorumları sonunda **silsin** (finally bloğu; betik
      yarıda kesilse de temizlensin — oluşturulan id'leri bir dosyaya yazıp sonraki çalıştırmada
      artıkları toplayan bir temizlik adımı ekle).
      (b) Test hesapları ortak bir önek alsın (`e2e_`), ve bu önekli hesaplar Keşfet/harita/arama
      sonuçlarından hariç tutulsun (yalnızca geliştirme ortamında geçerli bayrak).
- [ ] **A2 — Mevcut artıkları temizle.** Şu an veritabanında duran smoke kayıtlarını sil
      (kullanıcılar, sinyaller, yorumlar, medya). **Veri silen işlem: önce kullanıcıya sor**, hangi
      kayıtların silineceğini listele.
- [ ] **A3 — Seed sinyalleri.** Giriş kullanıcısına bağlı 20.038 sinyal demo hesaplara dağıtılsın
      ya da silinsin (bkz. `docs/plan/14_TESTING_QA_RELEASE.md` §2). Demo kullanıcı sinyal sayısı
      gerçekçi olsun (10–40). **Silme gerekiyorsa kullanıcıya sor.**
      Eski uygunsuz metinler (ör. "Keyif var amk") bu temizlikte gitmeli; gitmiyorsa moderasyon
      filtresini geçmiş içeriğe bir kez toplu uygula.
- [ ] **A4 — StatRow etiket tekrarı.** "Taze **tazelik**", "Orta **güven**" → değer + tek etiket:
      `⚡ Canlı` · `🛡 Orta güven` · `📍 283 m`. Yer sayfasında, bileşen önizlemede ve kullanıldığı
      her yerde aynı bileşenden gelmeli.
- [ ] **A5 — StatRow ikonları.** Bileşen önizlemede iki öğe aynı konuşma balonu ikonunu kullanıyor;
      her öğe kendi ikonunu almalı (sinyal sayısı, tazelik, güven, uzaklık).
- [ ] **A6 — Yorumlar sayfasındaki boş medya.** Gönderi görseli gri boş kutu olarak geliyor.
      Kaynağı bul (yanlış varyant url'i mi, yükleme hatası mı, oran hesabı mı) ve düzelt;
      yüklenemezse blurhash/yer tutucu göster, boş kutu bırakma.
- [ ] **A7 — Yorumlar sayfasında çift sayaç satırı.** Kartın kendi beğeni/yorum satırı ile sayfanın
      satırı üst üste duruyor. Tek satır kalsın (sayfa başlığının altındaki).
- [ ] **A8 — Tazelik tek kaynak.** "Canlı / Taze / Güncel / Eski" hesabı tek paylaşılan fonksiyondan
      gelsin (eşikler: canlı < 15 dk, güncel < 45 dk, sonrası eski). Keşfet başlığı, filtre çipleri,
      pin opaklığı, yer durumu ve kart rozetleri aynı fonksiyonu kullansın. Birim testi yaz.
      (Daha önce başlıkta "1 taze sinyal" yazarken çipte "Canlı 0" görünüyordu.)
- [ ] **A9 — Faz 3/5/8 kabul denetimi.** `docs/plan/13_ROADMAP_PHASES.md`'deki Faz 3, 5 ve 8 kabul
      kriterlerini tek tek oku, hangisinin ekranda gerçekten sağlandığını tabloya yaz
      (`docs/plan-devam/DENETIM_FAZ_3_5_8.md`). Sağlanmayanlar Faz C/D/E kapsamındadır; beklenmedik
      bir eksik çıkarsa ilgili faza görev olarak ekle.

## Kabul kriterleri (ekranda)
- Keşfet'te `smoke`, `anonymous-`, `tf_a_`, `priv_author_` içeren hiçbir kayıt görünmüyor.
- Profil sinyal sayısı gerçekçi; hiçbir metinde `(#sayı)` yok.
- Yer sayfasındaki istatistik satırında hiçbir etiket tekrarı yok.
- Yorumlar sayfasında görsel görünüyor ve tek sayaç satırı var.
- Keşfet başlığındaki sayı ile filtre çiplerindeki sayılar tutarlı.
- `DENETIM_FAZ_3_5_8.md` dosyası oluşturuldu.
