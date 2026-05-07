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
--    既存の 'skull' レコードを 'bomb' に移行
UPDATE public.placed_discs
  SET disc_type = 'bomb'
  WHERE disc_type = 'skull';

-- 6. placed_discs: disc_type チェック制約を 'flower'/'bomb' に更新
ALTER TABLE public.placed_discs
  DROP CONSTRAINT IF EXISTS placed_discs_disc_type_check;
ALTER TABLE public.placed_discs
  ADD CONSTRAINT placed_discs_disc_type_check
  CHECK (disc_type IN ('flower', 'bomb'));

-- ============================================================
-- 確認クエリ（別で実行するとカラム一覧を確認できます）
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'players'
--   ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'game_states'
--   ORDER BY ordinal_position;
-- ============================================================
