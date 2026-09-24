# 01 — Kimlik ve oturum (mevcut, V2'de görsel yenilenir)

## Durum
Çalışıyor: kayıt (doğum yılı zorunlu, 13 altı reddedilir, 18 altı gizli hesap), giriş, refresh, SecureStore,
401'de tek refresh denemesi, hesap silme (30 gün), veri talebi, askıya alma/kısıtlama.

## Akış
```
AuthScreen ──register/login──► IdentityService ──► { token (HS256, iss Blinkr.Identity, aud blinkr.api), refreshToken }
     │                                                             │
     └─► SecureStore (access + refresh)  ◄─────────────────────────┘
api.ts: istek → 401 → refresh (tek uçuş, kilitli) → tekrar; refresh 401 → oturumu temizle → AuthScreen
```
```ts
// src/api.ts (özet)
let refreshing: Promise<boolean> | null = null;
async function withAuth(req: () => Promise<Response>) {
  let res = await req();
  if (res.status !== 401) return res;
  refreshing ??= refreshSession().finally(() => { refreshing = null; });
  return (await refreshing) ? req() : (signOut(), res);
}
```

## V2 görsel hedef
- Tam ekran koyu zemin, üstte yumuşak gradyan ışıma (brand, %18 opaklık, bulanık daire).
- Logo + tek satır değer önerisi ("Şu an nerede ne oluyor, gör.").
- Segment: Giriş / Kayıt (hap). Alanlar `surfaceElevated`, odakta 1.5 pt gradyan kenar.
- Birincil düğme `GradientButton`.
- Hata satır içinde, alanın altında; sunucu kodu → i18n metni.

## Kabul
- [ ] Koyu/açık ekran görüntüsü; yanlış şifre, kısa şifre, yaş hatası metinleri tr/en.
- [ ] `scripts/test-auth-gateway-smoke.ps1` PASS.
