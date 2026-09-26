-- Kantin Uimsya Putri — Supabase schema & security (v2: Role System)
-- Jalankan di Supabase > SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tabel utama data kantin ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kantin_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id text UNIQUE NOT NULL,
  tipe text NOT NULL,
  tgl text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- ── Tabel role pengguna (BARU) ─────────────────────────────────────────────
-- Menyimpan pemetaan user_id Supabase Auth → role (admin/kasir)
CREATE TABLE IF NOT EXISTS kantin_user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  username text NOT NULL,
  role text NOT NULL DEFAULT 'kasir' CHECK (role IN ('admin','kasir')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Tabel lama (dipertahankan untuk kompatibilitas)
CREATE TABLE IF NOT EXISTS kantin_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── Indeks ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kantin_data_tipe_tgl ON kantin_data (tipe, tgl);
CREATE INDEX IF NOT EXISTS idx_kantin_data_tgl ON kantin_data (tgl);
CREATE INDEX IF NOT EXISTS idx_kantin_data_libur ON kantin_data (tgl) WHERE tipe = 'libur';
CREATE INDEX IF NOT EXISTS idx_kantin_user_roles_uid ON kantin_user_roles (user_id);

-- ── Fungsi helper (SECURITY DEFINER menghindari rekursi RLS) ──────────────
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS boolean
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM kantin_user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- ── RLS kantin_data ────────────────────────────────────────────────────────
ALTER TABLE kantin_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kantin_data_authenticated_select" ON kantin_data;
DROP POLICY IF EXISTS "kantin_data_authenticated_insert" ON kantin_data;
DROP POLICY IF EXISTS "kantin_data_authenticated_update" ON kantin_data;
DROP POLICY IF EXISTS "kantin_data_authenticated_delete" ON kantin_data;

-- Semua user terotentikasi bisa baca
CREATE POLICY "kantin_data_authenticated_select" ON kantin_data
  FOR SELECT TO authenticated USING (true);

-- Semua user terotentikasi bisa insert
CREATE POLICY "kantin_data_authenticated_insert" ON kantin_data
  FOR INSERT TO authenticated WITH CHECK (true);

-- Semua user terotentikasi bisa update
CREATE POLICY "kantin_data_authenticated_update" ON kantin_data
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- HANYA ADMIN yang bisa menghapus data
CREATE POLICY "kantin_data_admin_delete" ON kantin_data
  FOR DELETE TO authenticated USING (auth_is_admin());

-- ── RLS kantin_user_roles ─────────────────────────────────────────────────
ALTER TABLE kantin_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select" ON kantin_user_roles;
DROP POLICY IF EXISTS "roles_insert" ON kantin_user_roles;
DROP POLICY IF EXISTS "roles_update" ON kantin_user_roles;
DROP POLICY IF EXISTS "roles_delete" ON kantin_user_roles;

-- Semua user terotentikasi bisa baca daftar role
CREATE POLICY "roles_select" ON kantin_user_roles
  FOR SELECT TO authenticated USING (true);

-- Admin bisa insert role baru ATAU tidak ada role sama sekali (bootstrap admin pertama)
CREATE POLICY "roles_insert" ON kantin_user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_is_admin()
    OR NOT EXISTS (SELECT 1 FROM kantin_user_roles)
  );

-- Hanya admin bisa update role
CREATE POLICY "roles_update" ON kantin_user_roles
  FOR UPDATE TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- Admin bisa hapus role orang lain (tidak bisa hapus diri sendiri)
CREATE POLICY "roles_delete" ON kantin_user_roles
  FOR DELETE TO authenticated
  USING (auth_is_admin() AND user_id <> auth.uid());

-- ── RLS kantin_users (lama) ────────────────────────────────────────────────
ALTER TABLE kantin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kantin_users_authenticated_select" ON kantin_users;
CREATE POLICY "kantin_users_authenticated_select" ON kantin_users
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────
-- Tipe record kantin_data
-- ─────────────────────────────────────────────────────────────────────────
-- 'harian'              → Laporan harian (record_id: 'harian:YYYY-MM-DD')
-- 'libur'               → Hari libur   (record_id: 'libur:YYYY-MM-DD')
-- 'pemasukan'           → Kas masuk
-- 'pengeluaran'         → Kas keluar
-- 'transfer'            → Transfer antar akun
-- 'setoran_tabungan'    → Setoran tabungan manual
-- 'penarikan'           → Penarikan tabungan
-- 'piutang'             → Piutang pelanggan
-- 'hutang'              → Hutang supplier
-- 'pembayaran_piutang'  → Pembayaran piutang
-- 'pembayaran_hutang'   → Pembayaran hutang
-- 'persediaan'          → Stok barang
-- 'pemasok'             → Data supplier
