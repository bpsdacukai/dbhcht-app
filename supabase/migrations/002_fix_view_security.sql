-- ============================================================
-- SIMDBHCHT — Patch: Fix SECURITY DEFINER pada Views
-- Jalankan di Supabase SQL Editor
-- 
-- Masalah: View dengan SECURITY DEFINER menggunakan permission
-- dan RLS milik pembuat view (superuser), bukan pengguna yang
-- sedang melakukan query — ini melemahkan Row Level Security.
--
-- Solusi: Tambahkan WITH (security_invoker = true) agar view
-- menghormati RLS dan permission pengguna yang aktif.
-- ============================================================

-- ── Drop dan buat ulang view v_rekap_rkp ─────────────────────
drop view if exists public.v_rekap_rkp;

create or replace view public.v_rekap_rkp
  with (security_invoker = true)   -- ← gunakan RLS pengguna yang query
as
select
  tahun,
  jenis,
  bidang_id,
  is_koordinasi,
  count(*)        as jumlah_kegiatan,
  sum(pagu)       as total_pagu
from public.rkp_dbhcht
group by tahun, jenis, bidang_id, is_koordinasi;

-- Berikan akses SELECT ke semua role yang perlu (authenticated & anon)
grant select on public.v_rekap_rkp to authenticated;
grant select on public.v_rekap_rkp to anon;


-- ── Drop dan buat ulang view v_rekap_realisasi ────────────────
drop view if exists public.v_rekap_realisasi;

create or replace view public.v_rekap_realisasi
  with (security_invoker = true)   -- ← gunakan RLS pengguna yang query
as
select
  tahun,
  triwulan,
  bidang_id,
  is_koordinasi,
  count(*)              as jumlah_kegiatan,
  sum(pagu)             as total_pagu,
  sum(realisasi_keu)    as total_realisasi,
  avg(realisasi_fisik)  as avg_fisik
from public.realisasi_dbhcht
group by tahun, triwulan, bidang_id, is_koordinasi;

-- Berikan akses SELECT ke semua role yang perlu
grant select on public.v_rekap_realisasi to authenticated;
grant select on public.v_rekap_realisasi to anon;


-- ── Verifikasi (opsional, jalankan terpisah untuk cek) ────────
-- Pastikan kedua view sudah menggunakan security_invoker:
--
-- select viewname, definition
-- from pg_views
-- where schemaname = 'public'
--   and viewname in ('v_rekap_rkp', 'v_rekap_realisasi');
--
-- Atau cek via information_schema:
-- select table_name, view_definition
-- from information_schema.views
-- where table_schema = 'public'
--   and table_name in ('v_rekap_rkp', 'v_rekap_realisasi');
