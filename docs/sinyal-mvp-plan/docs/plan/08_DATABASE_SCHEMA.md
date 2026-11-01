# 08 — Veritabanı Şeması (PostgreSQL 16 + PostGIS)

> Mevcut tablolar Faz 0'da AUDIT.md'ye çıkarılır. Aşağıdaki hedef şemaya **migration ile** geçilir;
> mevcut veriler korunur (eşleme tablosu DECISIONS.md'ye). ORM kullanılıyorsa bu SQL, ORM şemasına
> çevrilir; PostGIS kolonları için raw SQL migration kullanılır.

## 1. Uzantılar ve tipler
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE signal_type AS ENUM ('crowd','wait','status','traffic','event','weather','parking','observation');
CREATE TYPE signal_status AS ENUM ('pending_media','active','expired','hidden','deleted');
CREATE TYPE visibility AS ENUM ('public','followers','close_friends','private');
CREATE TYPE follow_status AS ENUM ('accepted','pending');
CREATE TYPE media_kind AS ENUM ('image','video');
CREATE TYPE media_status AS ENUM ('uploading','processing','ready','failed','deleted');
CREATE TYPE message_type AS ENUM ('text','snap','media','signal_share','story_reply','system');
CREATE TYPE report_target AS ENUM ('signal','comment','user','message','place_question');
CREATE TYPE moderation_state AS ENUM ('ok','flagged','hidden','removed');
```
Tüm `id`'ler `uuid` (v7 tercih edilir: zaman sıralı) — `DEFAULT gen_random_uuid()` geçici çözüm.

## 2. Kullanıcılar ve oturumlar
```sql
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username        citext UNIQUE NOT NULL,           -- @kullanıcıadı
  display_name    text NOT NULL,
  email           citext UNIQUE,                    -- ASLA public API'de dönmez
  password_hash   text,
  apple_sub       text UNIQUE,
  google_sub      text UNIQUE,
  avatar_media_id uuid,                             -- FK media (sonra eklenir)
  avatar_preset   text,                             -- illüstrasyon avatar anahtarı
  bio             text CHECK (char_length(bio) <= 150),
  city            text,
  website         text,
  birth_year      smallint,
  locale          text NOT NULL DEFAULT 'tr',
  is_private      boolean NOT NULL DEFAULT false,
  dm_policy       text NOT NULL DEFAULT 'following' CHECK (dm_policy IN ('everyone','following','friends')),
  show_activity   boolean NOT NULL DEFAULT true,
  show_map_tab    boolean NOT NULL DEFAULT true,
  default_visibility visibility NOT NULL DEFAULT 'public',
  trust_score     smallint NOT NULL DEFAULT 50,     -- 0..100
  xp              integer NOT NULL DEFAULT 0,
  level           smallint NOT NULL DEFAULT 1,
  streak_days     smallint NOT NULL DEFAULT 0,
  streak_last_day date,
  username_changed_at timestamptz,
  moderation      moderation_state NOT NULL DEFAULT 'ok',
  deleted_at      timestamptz,                      -- silme talebi (30 gün sonra purge)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_username_trgm ON users USING gin (username gin_trgm_ops);
CREATE INDEX users_display_trgm  ON users USING gin (display_name gin_trgm_ops);

CREATE TABLE user_stats (                            -- denormalize sayaçlar
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  signals_count    integer NOT NULL DEFAULT 0,
  followers_count  integer NOT NULL DEFAULT 0,
  following_count  integer NOT NULL DEFAULT 0,
  verifications_given    integer NOT NULL DEFAULT 0,
  verifications_received integer NOT NULL DEFAULT 0,
  thanks_received  integer NOT NULL DEFAULT 0
);

CREATE TABLE sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id       uuid NOT NULL,                    -- rotasyon ailesi
  refresh_hash    text NOT NULL UNIQUE,
  device_name     text,
  revoked_at      timestamptz,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_token  text NOT NULL UNIQUE,
  platform    text NOT NULL CHECK (platform IN ('ios','android')),
  locale      text,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
```

## 3. Sosyal grafik
```sql
CREATE TABLE follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      follow_status NOT NULL DEFAULT 'accepted',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee ON follows (followee_id, status, created_at DESC);

CREATE TABLE blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX blocks_blocked ON blocks (blocked_id);

CREATE TABLE mutes (
  muter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mute_signals boolean NOT NULL DEFAULT true,
  mute_stories boolean NOT NULL DEFAULT true,
  PRIMARY KEY (muter_id, muted_id)
);
-- "Arkadaş" = karşılıklı accepted follow. Görünüm:
CREATE VIEW friendships AS
  SELECT a.follower_id AS user_id, a.followee_id AS friend_id
  FROM follows a JOIN follows b
    ON b.follower_id = a.followee_id AND b.followee_id = a.follower_id
  WHERE a.status = 'accepted' AND b.status = 'accepted';
```

## 4. Yerler
```sql
CREATE TABLE places (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  category     text NOT NULL,          -- health, market, bank, public, transit, food, park, worship, education, shopping, entertainment, sports, other
  location     geography(Point,4326) NOT NULL,
  radius_m     smallint NOT NULL DEFAULT 120,        -- konum doğrulama yarıçapı
  address      text,
  district     text,
  city         text,
  country_code char(2),
  provider     text,                   -- osm | google | foursquare | manual
  provider_id  text,
  is_sensitive boolean NOT NULL DEFAULT false,       -- sağlık, ibadet, eğitim, sığınma vb.
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_id)
);
CREATE INDEX places_location ON places USING gist (location);
CREATE INDEX places_name_trgm ON places USING gin (name gin_trgm_ops);

CREATE TABLE place_live_status (      -- worker hesaplar (10_SIGNAL_ENGINE §5)
  place_id        uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  type            signal_type NOT NULL,
  level           smallint,           -- baskın seviye
  confidence      text NOT NULL CHECK (confidence IN ('low','medium','high')),
  freshness       text NOT NULL CHECK (freshness IN ('live','recent','stale')),
  active_signals  smallint NOT NULL,
  verifications   smallint NOT NULL,
  last_signal_at  timestamptz NOT NULL,
  last_verified_at timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, type)
);

CREATE TABLE place_follows (
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id  uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  mode      text NOT NULL DEFAULT 'changes' CHECK (mode IN ('all','changes')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);
CREATE INDEX place_follows_place ON place_follows (place_id);

CREATE TABLE place_questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id   uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       text NOT NULL CHECK (char_length(text) <= 140),
  expires_at timestamptz NOT NULL,
  answered_signal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## 5. Medya
```sql
CREATE TABLE media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        media_kind NOT NULL,
  status      media_status NOT NULL DEFAULT 'uploading',
  purpose     text NOT NULL CHECK (purpose IN ('signal','avatar','snap','message')),
  raw_key     text NOT NULL,
  variants    jsonb,                 -- {"w1080":"…","w540":"…","w240":"…","mp4":"…","poster":"…"}
  width       int, height int, duration_ms int,
  blurhash    text,
  captured_at timestamptz,           -- cihazdan (EXIF'ten okunmuş, dosyadan silinmiş)
  source      text NOT NULL DEFAULT 'camera' CHECK (source IN ('camera','gallery')),
  moderation  moderation_state NOT NULL DEFAULT 'ok',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD CONSTRAINT users_avatar_fk FOREIGN KEY (avatar_media_id) REFERENCES media(id) ON DELETE SET NULL;
```

## 6. Sinyaller
```sql
CREATE TABLE signals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             signal_type NOT NULL,
  level            smallint,                         -- tipe göre 0..3 (10_SIGNAL_ENGINE)
  status_value     text,                              -- 'status' tipi için: open|closed|out_of_stock|out_of_order|...
  caption          text CHECK (char_length(caption) <= 280),
  place_id         uuid REFERENCES places(id) ON DELETE SET NULL,
  location         geography(Point,4326) NOT NULL,   -- GERÇEK konum: API'de ASLA dönmez
  display_location geography(Point,4326) NOT NULL,   -- bulanıklaştırılmış / yer merkezine oturtulmuş
  accuracy_m       smallint,
  location_verified boolean NOT NULL DEFAULT false,
  geohash5         text NOT NULL,                     -- realtime oda anahtarı
  visibility       visibility NOT NULL DEFAULT 'public',
  is_anonymous     boolean NOT NULL DEFAULT false,
  in_story         boolean NOT NULL DEFAULT false,
  story_expires_at timestamptz,
  source           text NOT NULL DEFAULT 'camera' CHECK (source IN ('camera','gallery','text')),
  is_delayed       boolean NOT NULL DEFAULT false,
  replaces_signal_id uuid REFERENCES signals(id) ON DELETE SET NULL,  -- "Değişti" zinciri
  question_id      uuid REFERENCES place_questions(id) ON DELETE SET NULL,
  stickers         jsonb,                             -- çıkartma/filtre metadatası
  comments_enabled boolean NOT NULL DEFAULT true,
  status           signal_status NOT NULL DEFAULT 'active',
  moderation       moderation_state NOT NULL DEFAULT 'ok',
  captured_at      timestamptz NOT NULL,
  expires_at       timestamptz NOT NULL,
  -- denormalize sayaçlar
  reactions_count  integer NOT NULL DEFAULT 0,
  thanks_count     integer NOT NULL DEFAULT 0,
  comments_count   integer NOT NULL DEFAULT 0,
  verify_yes_count integer NOT NULL DEFAULT 0,
  verify_changed_count integer NOT NULL DEFAULT 0,
  views_count      integer NOT NULL DEFAULT 0,
  saves_count      integer NOT NULL DEFAULT 0,
  last_verified_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signals_active_geo ON signals USING gist (display_location) WHERE status = 'active';
CREATE INDEX signals_author     ON signals (author_id, created_at DESC);
CREATE INDEX signals_place      ON signals (place_id, created_at DESC);
CREATE INDEX signals_expiry     ON signals (expires_at) WHERE status = 'active';
CREATE INDEX signals_geohash    ON signals (geohash5) WHERE status = 'active';
CREATE INDEX signals_story      ON signals (author_id, story_expires_at) WHERE in_story;

CREATE TABLE signal_media (
  signal_id uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  media_id  uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position  smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (signal_id, media_id)
);

CREATE TABLE signal_verifications (
  signal_id  uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verdict    text NOT NULL CHECK (verdict IN ('still_true','changed')),
  new_level  smallint,
  distance_m integer NOT NULL,        -- doğrulama anındaki uzaklık (≤ 500)
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, user_id)
);

CREATE TABLE signal_reactions (
  signal_id uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji     text NOT NULL CHECK (emoji IN ('heart','fire','wow','laugh','thanks')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, user_id)     -- kullanıcı başına tek tepki (değiştirilebilir)
);

CREATE TABLE signal_views (           -- günlük tekil görüntülenme
  signal_id uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, user_id)
);

CREATE TABLE story_views (
  signal_id uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, viewer_id)
);
```

## 7. Yorumlar
```sql
CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id   uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES comments(id) ON DELETE CASCADE,   -- tek seviye yanıt
  text        text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  mentions    uuid[] NOT NULL DEFAULT '{}',
  likes_count integer NOT NULL DEFAULT 0,
  replies_count integer NOT NULL DEFAULT 0,
  moderation  moderation_state NOT NULL DEFAULT 'ok',
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_signal ON comments (signal_id, parent_id, created_at DESC);

CREATE TABLE comment_likes (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
```

## 8. Kaydedilenler
```sql
CREATE TABLE collections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) <= 40),
  cover_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE saves (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('signal','place')),
  target_id   uuid NOT NULL,
  collection_id uuid REFERENCES collections(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);
```

## 9. Sohbet
```sql
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group    boolean NOT NULL DEFAULT false,
  dm_key      text UNIQUE,                 -- 1:1 için sıralı "userA:userB" (tekrar oluşmasın)
  last_message_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversation_members (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_request      boolean NOT NULL DEFAULT false,   -- mesaj isteği klasörü
  muted           boolean NOT NULL DEFAULT false,
  last_read_at    timestamptz,
  cleared_at      timestamptz,                      -- "benim için sil"
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conv_members_user ON conversation_members (user_id);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            message_type NOT NULL,
  text            text CHECK (char_length(text) <= 2000),
  media_id        uuid REFERENCES media(id) ON DELETE SET NULL,
  signal_id       uuid REFERENCES signals(id) ON DELETE SET NULL,
  reply_to_id     uuid REFERENCES messages(id) ON DELETE SET NULL,
  snap_opened_at  timestamptz,
  snap_screenshot_at timestamptz,
  client_id       text,                              -- istemci idempotency anahtarı
  unsent_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, client_id)
);
CREATE INDEX messages_conv ON messages (conversation_id, created_at DESC);

CREATE TABLE message_reactions (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  PRIMARY KEY (message_id, user_id)
);
```

## 10. Bildirimler, rozetler, moderasyon
```sql
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,              -- follow, follow_request, reaction, comment, mention, verify, place_update, question, badge_earned, signal_expiring, system
  group_key   text,                        -- gruplama: type:target_id:pencere
  actor_ids   uuid[] NOT NULL DEFAULT '{}',-- son aktörler (maks 3 saklanır)
  actor_count integer NOT NULL DEFAULT 1,
  target_type text, target_id uuid,
  data        jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON notifications (user_id, updated_at DESC);
CREATE UNIQUE INDEX notifications_group ON notifications (user_id, group_key) WHERE group_key IS NOT NULL AND read_at IS NULL;

CREATE TABLE notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prefs   jsonb NOT NULL DEFAULT '{}',      -- {"comment":true,"reaction":false,...}
  quiet_start time DEFAULT '23:00', quiet_end time DEFAULT '08:00'
);

CREATE TABLE badges (key text PRIMARY KEY, criteria jsonb NOT NULL);
CREATE TABLE user_badges (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key text NOT NULL REFERENCES badges(key),
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_key)
);

CREATE TABLE reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type report_target NOT NULL,
  target_id   uuid NOT NULL,
  reason      text NOT NULL,  -- spam, harassment, hate, nudity, violence, false_info, privacy, self_harm, other
  note        text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX reports_open ON reports (status, created_at) WHERE status = 'open';

CREATE TABLE moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type report_target NOT NULL, target_id uuid NOT NULL,
  action text NOT NULL,        -- auto_hide, hide, remove, restore, warn_user, suspend_user
  actor text NOT NULL,         -- 'system' veya admin user id
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## 11. Görünürlük kuralı (tek yerde, SQL fonksiyonu veya servis katmanı)
Bir kullanıcı (`viewer`) bir sinyali görebilir ⇔
1. `status IN ('active','expired')` ve `moderation NOT IN ('hidden','removed')` (sahibi kendi
   gizlenenini "İnceleniyor" etiketiyle görür), **ve**
2. viewer ile author arasında herhangi bir yönde `blocks` kaydı yok, **ve**
3. görünürlük: `public` → herkes (author gizli hesapsa: yalnızca onaylı takipçiler + kendisi);
   `followers` → onaylı takipçiler + kendisi; `close_friends` → V1.1; `private` → yalnızca kendisi.
4. `is_anonymous` ise yanıtta yazar alanları `null` döner (sahibi hariç).
Bu kural `shared/visibility.ts`'de (veya Supabase RLS'te) tek fonksiyon olarak yazılır ve **tüm**
okuma sorgularında kullanılır. Birim testi zorunlu.

## 12. Sayaç tutarlılığı
Sayaçlar (reactions_count, comments_count, followers_count…) aynı transaction içinde artırılır/azaltılır
(`UPDATE … SET x = x + 1`). Gece çalışan `counters.reconcile` işi gerçek sayılarla karşılaştırıp düzeltir.
Yer sayfasındaki "n sinyal" ile "Son sinyaller" listesi **aynı sorgu filtresini** kullanır (hata #3).

## 13. Mevcut veriden geçiş
- Mevcut sinyal tablosu → `signals` (tip eşlemesi: Gözlem→observation, Bekleme→wait, Doluluk→crowd,
  Geçici durum→status). Başlık alanı varsa ve açıklamayla aynıysa atılır; farklıysa açıklamanın başına eklenir.
- Mevcut konum alanı → `location`; `display_location` migration sırasında hesaplanır.
- Metinlerdeki `(#12345)` seed ekleri regex ile temizlenir: `\s*\(#\d+\)\s*$`.
- Mevcut "arkadaş" ilişkileri → iki yönlü `follows (accepted)`.
- Mevcut sohbet ve snap'ler → `conversations/messages`.
