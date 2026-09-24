# UI-COMPONENTS — bileşen şartnameleri

Tüm bileşenler `src/components/`. Stil yalnız `theme.ts` token'ları; metin `tx()`.
"Durumlar" sütunu her bileşenin tarayıcı sahnesinde (`scripts/ui-scenes.tsx`) gösterilmesi gerekenlerdir.

## Temel (ui/)
### GradientRing (V2)
```ts
type GradientRingProps = { size: number; seen?: boolean; thickness?: number; children: ReactNode; testID?: string };
```
- `LinearGradient` (gradients.story ya da storySeen) → iç halka (background rengi, `thickness` boşluk) → çocuk.
- Durumlar: görülmemiş, görülmüş, kendi (+ rozeti ile).

### GradientButton (V2)
```ts
type GradientButtonProps = { label: string; onPress(): void; size?: 'md' | 'lg'; loading?: boolean; disabled?: boolean; icon?: LucideIcon };
```
- Yükseklik 48/56, hap; metin `onCreate` (koyu). Basma ölçeği 0.96. `disabled` → opaklık 0.4, gradyan korunur.
- Durumlar: normal, basılı, yükleniyor (spinner), pasif.

### BlinkrBottomBar (V2 yenilenir)
```ts
type Tab = 'map' | 'discover' | 'chat' | 'profile';
type Props = { active: Tab; onChange(t: Tab): void; onCreate(): void; onCreateLong(): void;
               avatarKey?: string | null; userId?: string; badges?: Partial<Record<Tab, number | boolean>> };
```
- Sıra: Harita (`Map`) · Keşfet (`Compass`) · (+) · Mesaj (`MessageCircle`) · Profil (avatar).
- Aktif: dolu/kalın ikon + gradyan nokta. Rozet: kırmızı nokta (boolean) veya sayı (≤ 99+).
- a11y: `accessibilityRole="tab"`, `accessibilityState={{ selected }}`.

### BlinkrSheetPanel, BlinkrChip, BlinkrButton, BlinkrCard, BlinkrEmptyState, BlinkrSkeleton
Mevcut; koyu temada yeni yüzey token'larını kullanır, API değişmez.

## Harita ve gönderi (signal/)
### SignalCardModal (V2 genişler)
```ts
type Props = { items: SignalCardItem[]; initialIndex?: number; place?: PlaceStrip | null;
               onClose(): void; onOpenPlace?(id: string): void; initialExpanded?: boolean };
```
- Durak noktaları: `card` (içerik yüksekliği, en fazla ekranın %62'si), `full` (tam ekran, köşe 0).
- Jestler: başlıktan aşağı → kapat (120 pt / 900 pt/s) ya da tam sayfadan karta dön; yukarı → tam sayfa.
- "Genişlet" düğmesi (a11y alternatifi). Durumlar: kart, tam sayfa, çok sayfa (1/3), yer şeridi.

### PostFullView (V2 yeni)
```ts
type Props = { post: SignalCardItem; onClose(): void; onOpenProfile(userId: string): void; onOpenHashtag(tag: string): void };
```
- Üst: geri, yazar satırı, ⋯ menü. Medya tam genişlik (video → VideoPlayer). Açıklama tam (RichText).
- Tepki çubuğu, yer satırı, "Hâlâ böyle mi?". Yorumlar (`useComments`), altta sabit giriş (mention önerisi).
- Durumlar: yükleniyor, yorum yok, yorumlar + yanıtlar, klavye açık.

### VideoPlayer (V2 yeni)
```ts
type Props = { uri: string; poster?: string; autoPlay?: boolean; muted?: boolean; loop?: boolean;
               controls?: 'minimal' | 'full'; onFullscreen?(): void; testID?: string };
```
- `expo-video` `useVideoPlayer`. `minimal`: ortada oynat/duraklat, köşede ses. `full`: + ilerleme (sürüklenebilir),
  süre, hız menüsü (0.5/1/1.25/1.5/2), tam ekran.
- Kontroller 3 sn hareketsizlikte solar; dokununca geri gelir. Görünür alandan çıkınca duraklar.
- Durumlar: yükleniyor (poster + iskelet), oynuyor, duraklatıldı, bitti (tekrar oynat), hata.

### MediaCarousel, MediaViewer, SignalCard, SignalThreadPanel
Mevcut. MediaCarousel video için VideoPlayer'ı (`minimal`) kullanır. SignalThreadPanel mantığı `useComments`'e taşınır.

### RichText (V2 yeni)
```ts
type Props = { text: string; numberOfLines?: number; onMention(userName: string): void; onHashtag(tag: string): void; style?: TextStyle };
```
- `@kullanıcı` ve `#etiket` `primary` renkte, dokunulabilir. Ayrıştırma saf fonksiyon `richText.ts` (test).

### ReactionBar (V2 yeni)
```ts
type Props = { counts: Record<string, number>; mine?: string | null; onReact(emoji: string | null): void };
```
- Kısa dokunma: ❤️ aç/kapa. Uzun basma: 6 emojilik balon (❤️🔥😂😮😢👏), parmak üzerinde büyür.
- Toplam sayı + en çok kullanılan 3 emoji.

## Hikayeler (stories/)
### StoryTray
```ts
type Props = { items: StoryTrayItem[]; me: { userId: string; avatarKey?: string | null; hasStory: boolean }; onOpen(authorId: string): void; onCreate(): void };
```
- 72 pt genişlik öğeler; GradientRing 64; ad tek satır (caption). İlk öğe "Hikayen".

### StoryViewer
```ts
type Props = { authors: StoryTrayItem[]; startAuthorId: string; onClose(): void; onReply(authorId: string, text: string): void };
```
- Segment çubukları (üstte, 2 pt, aralık 4), yazar satırı + zaman + ⋯ + ✕.
- Sol üçte bir dokun = geri, sağ = ileri; basılı tut = duraklat (krom gizlenir); aşağı kaydır = kapat;
  yatay kaydır = önceki/sonraki kişi (küp); yukarı kaydır (kendi hikayen) = görüntüleyenler.
- Alt: "Mesaj gönder" alanı + ♥ + 6 hızlı emoji (alan odaklanınca).

## Akış (feed/)
### FeedCard (V2 yenilenir)
Başlık, medya karuseli (nokta göstergesi), ReactionBar, yorum/paylaş/kaydet, RichText açıklama, yorum önizlemesi.
Çift dokunma → gradyan kalp animasyonu + ❤️ tepkisi.

## Bildirim (activity/, V2)
### ActivityScreen
Gruplar: "Yeni", "Bugün", "Bu hafta", "Daha eski". Satır: avatar, "**ad** gönderine ❤️ bıraktı · 2 sa", sağda
küçük medya önizlemesi ya da "Takip et" düğmesi.
