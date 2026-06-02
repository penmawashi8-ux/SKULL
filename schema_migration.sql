-- ============================================================
-- BOMB Game — Full Migration (既存DBを最新スキーマに更新)
-- Supabase ダッシュボード → SQL Editor で全体を貼り付けて実行
-- 何度実行しても安全（idempotent）
-- ============================================================

-- 1. players: skull_count → bomb_count にリネーム
--    ※ すでに bomb_count が存在する場合はスキップ
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'players'
      AND column_name  = 'skull_count'
  ) THEN
    ALTER TABLE public.players RENAME COLUMN skull_count TO bomb_count;
    RAISE NOTICE 'players.skull_count → bomb_count renamed';
  ELSE
    RAISE NOTICE 'players.bomb_count already exists, skipping rename';
  END IF;
END $$;

-- 2. players: bomb_count が存在しない場合は追加（完全新規DBへの安全策）
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS bomb_count int NOT NULL DEFAULT 1;

-- 3. game_states: turn_started_at カラムを追加
ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS turn_started_at timestamptz;

-- 4. game_states: last_emote カラムを追加
ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS last_emote jsonb;

-- 5. 先にデータを更新してから制約を変更（順番重要）
--    'flower' と 'bomb' 以外の値（'skull' など）を全て 'bomb' に統一
UPDATE public.placed_discs
  SET disc_type = 'bomb'
  WHERE disc_type IS NULL OR disc_type NOT IN ('flower', 'bomb');

-- 6. placed_discs: disc_type チェック制約を 'flower'/'bomb' に更新
ALTER TABLE public.placed_discs
  DROP CONSTRAINT IF EXISTS placed_discs_disc_type_check;
ALTER TABLE public.placed_discs
  ADD CONSTRAINT placed_discs_disc_type_check
  CHECK (disc_type IN ('flower', 'bomb'));

-- ============================================================
-- BBS (掲示板) テーブル追加
-- ============================================================

-- スレッドテーブル
CREATE TABLE IF NOT EXISTS public.bbs_threads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text        NOT NULL DEFAULT 'general',
  title           text        NOT NULL,
  body            text        NOT NULL,
  author_name     text        NOT NULL DEFAULT '名無し',
  reply_count     int         NOT NULL DEFAULT 0,
  last_replied_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 返信テーブル
CREATE TABLE IF NOT EXISTS public.bbs_posts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid        NOT NULL REFERENCES public.bbs_threads(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  author_name text        NOT NULL DEFAULT '名無し',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS (匿名ユーザーも読み書き可)
ALTER TABLE public.bbs_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbs_posts   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='bbs_threads' AND policyname='bbs_threads_all'
  ) THEN
    CREATE POLICY "bbs_threads_all" ON public.bbs_threads FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='bbs_posts' AND policyname='bbs_posts_all'
  ) THEN
    CREATE POLICY "bbs_posts_all" ON public.bbs_posts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 返信を挿入したらスレッドの reply_count / last_replied_at を更新するトリガー
CREATE OR REPLACE FUNCTION public.bbs_on_post_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.bbs_threads
  SET reply_count     = reply_count + 1,
      last_replied_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bbs_post_insert ON public.bbs_posts;
CREATE TRIGGER trg_bbs_post_insert
AFTER INSERT ON public.bbs_posts
FOR EACH ROW EXECUTE FUNCTION public.bbs_on_post_insert();

-- パフォーマンス用インデックス
CREATE INDEX IF NOT EXISTS idx_bbs_threads_category_replied
  ON public.bbs_threads (category, last_replied_at DESC);
CREATE INDEX IF NOT EXISTS idx_bbs_posts_thread
  ON public.bbs_posts (thread_id, created_at);

-- ============================================================
-- 確認クエリ（別で実行するとカラム一覧を確認できます）
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'players'
--   ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'game_states'
--   ORDER BY ordinal_position;
-- ============================================================
