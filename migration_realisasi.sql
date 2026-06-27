-- ════════════════════════════════════════════════════════════════
-- MIGRATION: Update tabel realisasi_dbhcht (v2)
-- Tujuan:
--   1. Realisasi wajib mereferensi RKP (rkp_id) — saat kegiatan RKP
--      dipilih, Pagu Utama/BOP/Volume/Satuan disalin (snapshot) ke
--      tabel realisasi, read-only di form.
--   2. Rename kolom agar tidak rancu dengan kolom milik RKP:
--        pagu          -> pagu_utama
--        pagu_bop      -> bop
--        realisasi_keu -> realisasi_pagu_utama   (sudah dilakukan di
--                                                   migration sebelumnya;
--                                                   aman dijalankan ulang)
--   3. Tambah kolom realisasi_volume, jenis (jika belum ada).
--   4. Recreate view v_rekap_realisasi dengan skema final.
--
-- CATATAN: Jika sebelumnya Anda sempat menjalankan migration yang
-- men-DROP kolom 'pagu', jalankan migration ini untuk MENAMBAHKAN
-- kembali kolom-kolom tersebut dengan nama baru (pagu_utama, bop).
-- Script ini aman dijalankan baik di database yang masih punya
-- kolom 'pagu' lama, maupun yang sudah ter-drop sebelumnya.
-- ════════════════════════════════════════════════════════════════

-- 0) Drop dulu view yang mungkin masih depend ke kolom lama
drop view if exists v_rekap_realisasi;

-- 1) Tambah kolom baru (aman jika sudah ada / belum ada)
alter table realisasi_dbhcht
  add column if not exists rkp_id uuid references rkp_dbhcht(id) on delete set null,
  add column if not exists realisasi_volume numeric default 0,
  add column if not exists jenis text default 'Murni',
  add column if not exists pagu_utama numeric default 0,
  add column if not exists bop numeric default 0;

-- 1b) Isi kolom jenis untuk baris yang sudah ada (data lama), default 'Murni'
update realisasi_dbhcht set jenis = 'Murni' where jenis is null;

-- 2) Jika kolom lama 'pagu' MASIH ADA (belum pernah di-drop), pindahkan
--    datanya ke 'pagu_utama' lalu hapus kolom lama. Blok ini aman
--    dijalankan walau kolom 'pagu' sudah tidak ada (akan di-skip).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'realisasi_dbhcht' and column_name = 'pagu'
  ) then
    update realisasi_dbhcht set pagu_utama = pagu where pagu_utama = 0 or pagu_utama is null;
    alter table realisasi_dbhcht drop column pagu;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'realisasi_dbhcht' and column_name = 'pagu_bop'
  ) then
    update realisasi_dbhcht set bop = pagu_bop where bop = 0 or bop is null;
    alter table realisasi_dbhcht drop column pagu_bop;
  end if;

  -- Rename realisasi_keu -> realisasi_pagu_utama, hanya jika belum di-rename
  if exists (
    select 1 from information_schema.columns
    where table_name = 'realisasi_dbhcht' and column_name = 'realisasi_keu'
  ) then
    alter table realisasi_dbhcht rename column realisasi_keu to realisasi_pagu_utama;
  end if;
end $$;

-- 3) Index untuk performa join/filter
create index if not exists idx_realisasi_rkp_id on realisasi_dbhcht(rkp_id);
create index if not exists idx_realisasi_tahun_triwulan on realisasi_dbhcht(tahun, triwulan);
create index if not exists idx_realisasi_tahun_jenis on realisasi_dbhcht(tahun, jenis);

-- 4) Recreate view v_rekap_realisasi dengan skema final.
--    security_invoker=true: view mematuhi RLS milik user yang query,
--    bukan RLS milik pembuat view (mencegah Supabase linter warning
--    "Security Definer View" dan mencegah view membypass RLS OPD).
--    Pagu Utama/BOP dibaca dari kolom snapshot pagu_utama/bop di tabel
--    realisasi (diisi otomatis oleh aplikasi saat kegiatan RKP dipilih).
create view v_rekap_realisasi
with (security_invoker = true)
as
select
  r.tahun,
  r.jenis,
  r.triwulan,
  r.bidang_id,
  r.is_koordinasi,
  r.created_by,
  count(*) as jumlah_kegiatan,
  sum(coalesce(r.pagu_utama, 0))                          as total_pagu_utama,
  sum(coalesce(r.bop, 0))                                 as total_bop,
  sum(coalesce(r.pagu_utama, 0) + coalesce(r.bop, 0))      as total_pagu,
  sum(coalesce(r.realisasi_volume, 0))                    as total_realisasi_volume,
  sum(coalesce(r.realisasi_pagu_utama, 0))                as total_realisasi,
  sum(coalesce(r.realisasi_bop, 0))                       as total_realisasi_bop,
  sum(coalesce(r.realisasi_pagu_utama, 0) + coalesce(r.realisasi_bop, 0)) as total_realisasi_keseluruhan,
  sum(
    (coalesce(r.pagu_utama, 0) + coalesce(r.bop, 0))
    - (coalesce(r.realisasi_pagu_utama, 0) + coalesce(r.realisasi_bop, 0))
  ) as total_sisa_anggaran,
  case when sum(coalesce(r.pagu_utama, 0) + coalesce(r.bop, 0)) > 0
    then round(
      100.0 * sum(coalesce(r.realisasi_pagu_utama, 0) + coalesce(r.realisasi_bop, 0))
      / sum(coalesce(r.pagu_utama, 0) + coalesce(r.bop, 0)), 1)
    else 0
  end as total_capaian_pct,
  avg(r.realisasi_fisik) as avg_fisik
from realisasi_dbhcht r
group by r.tahun, r.jenis, r.triwulan, r.bidang_id, r.is_koordinasi, r.created_by;

-- ════════════════════════════════════════════════════════════════
-- CATATAN MIGRASI DATA LAMA:
-- Baris realisasi yang dibuat SEBELUM migration ini tidak memiliki
-- rkp_id maupun pagu_utama/bop terisi otomatis dari RKP (karena dulu
-- form Realisasi input manual, bukan pilih dari RKP). Untuk data
-- tersebut, pagu_utama/bop akan bernilai 0 kecuali sempat ter-migrasi
-- dari kolom 'pagu'/'pagu_bop' lama (lihat langkah 2 di atas, hanya
-- berlaku jika kolom lama itu masih ada saat migration ini berjalan).
-- Sekretariat/OPD dapat mencocokkan manual via menu Edit Realisasi
-- (pilih ulang kegiatan RKP yang sesuai) untuk melengkapi data lama.
-- ════════════════════════════════════════════════════════════════
