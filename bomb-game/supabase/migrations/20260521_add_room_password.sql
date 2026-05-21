-- Add optional password to rooms table
-- NULL = public room, non-null = password-protected room
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS password text DEFAULT NULL;
