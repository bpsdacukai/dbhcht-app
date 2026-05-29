-- ============================================================
-- SIMDBHCHT — Migration 003: Perbaikan Komprehensif v2
-- Jalankan di Supabase SQL Editor (aman untuk aplikasi live)
-- Semua perubahan bersifat additive (ALTER/ADD), tidak DROP data
-- ============================================================

-- ── 1. LOGIN DENGAN USERNAME (bukan email) ────────────────────
-- Tambah fungsi custom sign-in by username
-- Frontend akan lookup email dari username dulu, lalu auth

-- ── 2. PAGU OPD: tambah kolom pagu_utama + bop per OPD ───────
-- Pagu ditetapkan per OPD per tahun/jenis oleh sekretariat (TAPD)
create table if not exists public.pagu_opd (
  id            uuid default uuid_generate_v4() primary key,
  profile_id    uuid references public.profiles(id) on delete cascade not null,
  tahun         integer not null,
  jenis         text not null default 'Murni' check (jenis in ('Murni','Perubahan')),
  pagu_utama    bigint not null default 0,
  -- BOP maks 10% dari pagu_utama, disimpan eksplisit agar bisa dikunci
  bop           bigint not null default 0,
  keterangan    text,
  ditetapkan_oleh uuid references auth.users(id),
  ditetapkan_at timestamptz default now(),
  unique(profile_id, tahun, jenis)
);

alter table public.pagu_opd enable row level security;

create policy "Semua user bisa lihat pagu_opd"
  on public.pagu_opd for select using (true);

create policy "Sekretariat bisa kelola pagu_opd"
  on public.pagu_opd for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat'));


-- ── 3. RKP: tambah kolom bop, pagu_total dihitung otomatis ───
alter table public.rkp_dbhcht
  add column if not exists pagu_bop    bigint default 0,
  add column if not exists rincian     text,   -- rincian belanja
  add column if not exists target_output text;  -- output/keluaran kegiatan

-- ── 4. REALISASI: tambah kolom realisasi_bop ──────────────────
alter table public.realisasi_dbhcht
  add column if not exists realisasi_bop  bigint default 0,
  add column if not exists capaian_output text;  -- capaian output

-- ── 5. ASISTENSI: tambah kolom peserta (JSONB array) ──────────
-- Format: [{"nama":"Budi","jabatan":"Kasubag"},...]
alter table public.asistensi_dbhcht
  add column if not exists peserta_sekretariat  jsonb default '[]'::jsonb,
  add column if not exists peserta_opd          jsonb default '[]'::jsonb,
  add column if not exists nomor_ba             text,
  add column if not exists tempat               text,
  -- Data otomatis dari RKP OPD saat dipilih
  add column if not exists rkp_snapshot         jsonb default '[]'::jsonb;

-- ── 6. REKONSILIASI: tambah kolom peserta ─────────────────────
alter table public.rekonsiliasi_dbhcht
  add column if not exists peserta_sekretariat  jsonb default '[]'::jsonb,
  add column if not exists peserta_opd          jsonb default '[]'::jsonb,
  add column if not exists nomor_ba             text,
  add column if not exists tempat               text,
  -- Snapshot realisasi terkini saat rekonsiliasi
  add column if not exists realisasi_snapshot   jsonb default '[]'::jsonb;

-- ── 7. PROFILES: tambah helper lookup by username ─────────────
-- Fungsi untuk frontend: cari email dari username
create or replace function public.get_email_by_username(p_username text)
returns text
language plpgsql security definer
as $$
declare
  v_email text;
begin
  select email into v_email
  from public.profiles
  where lower(username) = lower(p_username)
    and aktif = true
  limit 1;
  return v_email;
end;
$$;

-- Grant eksekusi ke anon (diperlukan saat login sebelum authenticated)
grant execute on function public.get_email_by_username(text) to anon;
grant execute on function public.get_email_by_username(text) to authenticated;


-- ── 8. RLS RKP: OPD hanya lihat data milik sendiri ────────────
-- DROP policy lama yang memperbolehkan semua user lihat semua RKP
drop policy if exists "Semua user bisa lihat RKP" on public.rkp_dbhcht;

-- OPD hanya lihat RKP miliknya, sekretariat lihat semua
create policy "RKP: OPD hanya lihat miliknya, sekretariat semua"
  on public.rkp_dbhcht for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
    or created_by = auth.uid()
  );

-- ── 9. RLS REALISASI: OPD hanya lihat data milik sendiri ──────
drop policy if exists "Semua user bisa lihat realisasi" on public.realisasi_dbhcht;

create policy "Realisasi: OPD hanya lihat miliknya, sekretariat semua"
  on public.realisasi_dbhcht for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
    or created_by = auth.uid()
  );

-- ── 10. FIX INSERT RKP: semua OPD bisa input Koordinasi ───────
-- (tidak berubah, sudah benar — koordinasi boleh untuk semua)
-- Tapi perlu memastikan bidang_id sesuai profil OPD
drop policy if exists "OPD bisa insert RKP sesuai bidang" on public.rkp_dbhcht;

create policy "OPD bisa insert RKP sesuai bidang atau koordinasi"
  on public.rkp_dbhcht for insert
  with check (
    auth.uid() is not null and (
      -- Sekretariat bisa semua
      exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
      -- OPD bisa insert untuk bidangnya sendiri
      or exists (select 1 from public.profiles where id = auth.uid() and bidang = bidang_id and role = 'opd')
      -- Semua OPD (termasuk satpolpp, diskominfo, dll) bisa input Koordinasi
      or (is_koordinasi = true and exists (select 1 from public.profiles where id = auth.uid() and role = 'opd'))
    )
  );

-- FIX INSERT Realisasi: sama
drop policy if exists "OPD bisa insert realisasi sesuai bidang" on public.realisasi_dbhcht;

create policy "OPD bisa insert realisasi sesuai bidang atau koordinasi"
  on public.realisasi_dbhcht for insert
  with check (
    auth.uid() is not null and (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
      or exists (select 1 from public.profiles where id = auth.uid() and bidang = bidang_id and role = 'opd')
      or (is_koordinasi = true and exists (select 1 from public.profiles where id = auth.uid() and role = 'opd'))
    )
  );


-- ── 11. INDEX untuk performa ───────────────────────────────────
create index if not exists idx_rkp_created_by   on public.rkp_dbhcht(created_by);
create index if not exists idx_rkp_tahun_jenis  on public.rkp_dbhcht(tahun, jenis);
create index if not exists idx_real_created_by  on public.realisasi_dbhcht(created_by);
create index if not exists idx_real_tahun       on public.realisasi_dbhcht(tahun, triwulan);
create index if not exists idx_pagu_opd_lookup  on public.pagu_opd(profile_id, tahun, jenis);


-- ── 12. UPDATE VIEW dengan kolom BOP ──────────────────────────
drop view if exists public.v_rekap_rkp;
create or replace view public.v_rekap_rkp
  with (security_invoker = true)
as
select
  tahun, jenis, bidang_id, is_koordinasi, created_by,
  count(*)            as jumlah_kegiatan,
  sum(pagu)           as total_pagu,
  sum(pagu_bop)       as total_bop,
  sum(pagu + coalesce(pagu_bop,0)) as total_keseluruhan
from public.rkp_dbhcht
group by tahun, jenis, bidang_id, is_koordinasi, created_by;

grant select on public.v_rekap_rkp to authenticated;
grant select on public.v_rekap_rkp to anon;

drop view if exists public.v_rekap_realisasi;
create or replace view public.v_rekap_realisasi
  with (security_invoker = true)
as
select
  tahun, triwulan, bidang_id, is_koordinasi, created_by,
  count(*)                          as jumlah_kegiatan,
  sum(pagu)                         as total_pagu,
  sum(realisasi_keu)                as total_realisasi,
  sum(coalesce(realisasi_bop,0))    as total_realisasi_bop,
  avg(realisasi_fisik)              as avg_fisik
from public.realisasi_dbhcht
group by tahun, triwulan, bidang_id, is_koordinasi, created_by;

grant select on public.v_rekap_realisasi to authenticated;
grant select on public.v_rekap_realisasi to anon;


-- ── SELESAI ───────────────────────────────────────────────────
-- Tidak ada data yang dihapus. Semua perubahan aman untuk live.
