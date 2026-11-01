# Mağaza gizlilik formları için yanıtlar (App Privacy / Play Data Safety)

> plan-devam F7 / 11_SAFETY §7. Formlar mağaza konsolunda doldurulur; bu belge kodun gerçekte ne yaptığına göre
> hazırlanmış yanıtlardır. Kod değişirse bu belge de güncellenmelidir.

| Veri türü | Toplanıyor mu | Amaç | Kimlikle ilişkili | İzleme (tracking) |
|---|---|---|---|---|
| E-posta | Evet | Hesap, giriş | Evet | Hayır |
| Kullanıcı adı, avatar, kısa "hakkında" | Evet | Uygulama işlevi (profil) | Evet | Hayır |
| Doğum yılı | Evet | Yaş sınırı (13+), 18 altı korumaları | Evet | Hayır |
| Kesin konum | Evet, yalnız uygulama kullanılırken | Yakındaki yerler, paylaşımın o yerde yapıldığını sunucuda doğrulama | Evet (paylaşım anında) | Hayır |
| Fotoğraf / video | Evet, kişi seçerse | Sinyal, hikaye, snap | Evet | Hayır |
| Kullanıcı içeriği (sinyal, yorum, mesaj) | Evet | Uygulama işlevi | Evet | Hayır |
| Arama geçmişi | Cihazda (son aramalar) | Kolaylık | Hayır (sunucuya gitmez) | Hayır |
| Tanılama / çökme | Hayır (henüz analitik yok, Faz G) | — | — | — |
| Reklam kimliği | Hayır | — | — | — |

- **Arka plan konumu kullanılmaz** (`ACCESS_BACKGROUND_LOCATION` engelli, iOS yalnız "When In Use").
- Veri satılmaz, üçüncü taraflarla paylaşılmaz. Harita altlığı Apple/Google, yer verisi OpenStreetMap.
- Aktarımda şifreleme: yayında TLS zorunlu (şu an yerel geliştirmede HTTP; kök CLAUDE.md §20.1 "TLS hardening").
- Silme: uygulama içinden hesap silme var (30 gün bekleme, sonra tüm servislerde silme).
- Fotoğraflardan EXIF (konum dahil) sunucuda saklanmadan önce silinir.
