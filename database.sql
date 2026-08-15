-- Kantin Uimsya Putri - Supabase schema & security
-- Jalankan di Supabase > SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS kantin_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id text UNIQUE NOT NULL,
  tipe text NOT NULL,
  tgl text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kantin_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kantin_data_tipe_tgl ON kantin_data (tipe, tgl);
CREATE INDEX IF NOT EXISTS idx_kantin_data_tgl ON kantin_data (tgl);

-- Aplikasi memakai Supabase Auth untuk password. Password JANGAN disimpan di kantin_users.
-- Tabel kantin_users dipertahankan untuk kompatibilitas data lama.

ALTER TABLE kantin_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE kantin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kantin_data_authenticated_select" ON kantin_data;
DROP POLICY IF EXISTS "kantin_data_authenticated_insert" ON kantin_data;
DROP POLICY IF EXISTS "kantin_data_authenticated_update" ON kantin_data;
DROP POLICY IF EXISTS "kantin_data_authenticated_delete" ON kantin_data;

CREATE POLICY "kantin_data_authenticated_select" ON kantin_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kantin_data_authenticated_insert" ON kantin_data
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "kantin_data_authenticated_update" ON kantin_data
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "kantin_data_authenticated_delete" ON kantin_data
  FOR DELETE TO authenticated USING (true);

-- kantin_users tidak dibutuhkan untuk proses login frontend.
-- Jangan berikan akses baca/tulis ke anon.
DROP POLICY IF EXISTS "kantin_users_authenticated_select" ON kantin_users;
CREATE POLICY "kantin_users_authenticated_select" ON kantin_users
  FOR SELECT TO authenticated USING (true);
