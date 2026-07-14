-- ============================================================
-- 005_rkp_perubahan.sql
-- Tabel BARU untuk Rancangan Kegiatan dan Penganggaran PERUBAHAN
-- DBH CHT, mengacu pada format Lampiran F PMK 22/2026.
--
-- PENTING: Migration ini 100% ADDITIVE.
-- - TIDAK ada ALTER/UPDATE/DELETE terhadap tabel rkp_dbhcht.
-- - Data RKP Murni yang sudah ada tidak tersentuh sama sekali.
-- - Kolom "Semula" pada RKP Perubahan diambil (read-only) via
--   join/rkp_id ke rkp_dbhcht (jenis = 'Murni'), BUKAN disalin
--   permanen ke tabel baru, sehingga selalu sinkron dengan data
--   RKP Murni yang berjalan.
-- - Kolom "Menjadi" adalah data baru yang diisi OPD, disimpan
--   di tabel baru ini saja.
-- ============================================================

-- ── TABEL RKP PERUBAHAN ─────────────────────────────────────
create table if not exists public.rkp_perubahan_dbhcht (
  id                uuid default uuid_generate_v4() primary key,
  tahun             integer not null,

  -- Relasi ke RKP Murni (sumber kolom "Semula").
  -- NULL diperbolehkan khusus untuk kegiatan BARU yang baru
  -- muncul di Perubahan (mis. dari tambahan alokasi SILPA)
  -- dan belum pernah ada di RKP Murni.
  rkp_id            uuid references public.rkp_dbhcht(id) on delete set null,

  bidang_id         text not null,
  program           text not null,
  kegiatan          text,
  sub_kegiatan      text,
  kode_rekening     text,
  nama_rekening     text,

  -- ── Kolom "MENJADI" (diisi OPD, sesuai alokasi perubahan) ──
  volume_menjadi    numeric,
  satuan_menjadi    text default 'Paket',
  pagu_menjadi      bigint default 0,
  pagu_bop_menjadi  bigint default 0,

  keterangan        text,
  is_koordinasi     boolean default false,

  created_by        uuid references auth.users(id),
  created_by_nama   text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),

  -- Satu baris Menjadi per baris Murni (kalau rkp_id diisi)
  constraint uq_rkp_perubahan_rkp_id unique (rkp_id)
);

comment on table public.rkp_perubahan_dbhcht is
  'Data RKP Perubahan DBH CHT (kolom Menjadi). Kolom Semula diambil dari rkp_dbhcht via rkp_id, tidak disimpan ulang.';

alter table public.rkp_perubahan_dbhcht enable row level security;

-- ── RLS: SELECT ──────────────────────────────────────────────
-- OPD hanya lihat miliknya, sekretariat lihat semua
-- (konsisten dengan pola RLS rkp_dbhcht di migration 003)
create policy "RKP Perubahan: OPD hanya lihat miliknya, sekretariat semua"
  on public.rkp_perubahan_dbhcht for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
    or created_by = auth.uid()
  );

-- ── RLS: INSERT ──────────────────────────────────────────────
create policy "OPD bisa insert RKP Perubahan sesuai bidang atau koordinasi"
  on public.rkp_perubahan_dbhcht for insert
  with check (
    auth.uid() is not null and (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
      or exists (select 1 from public.profiles where id = auth.uid() and bidang = bidang_id and role = 'opd')
      or (is_koordinasi = true and exists (select 1 from public.profiles where id = auth.uid() and role = 'opd'))
    )
  );

-- ── RLS: UPDATE ──────────────────────────────────────────────
create policy "OPD bisa update RKP Perubahan miliknya, sekretariat semua"
  on public.rkp_perubahan_dbhcht for update
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
  );

-- ── RLS: DELETE ──────────────────────────────────────────────
create policy "Sekretariat atau pemilik bisa hapus RKP Perubahan"
  on public.rkp_perubahan_dbhcht for delete
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
  );

-- ── TRIGGER updated_at (reuse fungsi yang sudah ada) ──────────
create trigger rkp_perubahan_updated_at before update on public.rkp_perubahan_dbhcht
  for each row execute procedure public.set_updated_at();

-- ── INDEX ───────────────────────────────────────────────────
create index if not exists idx_rkp_perubahan_tahun     on public.rkp_perubahan_dbhcht(tahun);
create index if not exists idx_rkp_perubahan_bidang     on public.rkp_perubahan_dbhcht(bidang_id);
create index if not exists idx_rkp_perubahan_created_by on public.rkp_perubahan_dbhcht(created_by);
create index if not exists idx_rkp_perubahan_rkp_id     on public.rkp_perubahan_dbhcht(rkp_id);

-- ── VIEW: gabungan Semula + Menjadi (untuk laporan cetak) ─────
-- security_invoker = true supaya RLS pengguna tetap berlaku
create or replace view public.v_rkp_perubahan_lengkap
  with (security_invoker = true)
as
select
  p.id,
  p.tahun,
  p.rkp_id,
  p.bidang_id,
  p.is_koordinasi,
  coalesce(p.program, m.program)             as program,
  coalesce(p.kegiatan, m.kegiatan)            as kegiatan,
  coalesce(p.sub_kegiatan, m.sub_kegiatan)    as sub_kegiatan,
  coalesce(p.kode_rekening, m.kode_rekening)  as kode_rekening,
  coalesce(p.nama_rekening, m.nama_rekening)  as nama_rekening,
  -- Semula (dari RKP Murni; kosong/0 jika kegiatan baru)
  m.volume                                    as volume_semula,
  m.satuan                                    as satuan_semula,
  coalesce(m.pagu,0)                          as pagu_semula,
  coalesce(m.pagu_bop,0)                      as pagu_bop_semula,
  coalesce(m.pagu,0) + coalesce(m.pagu_bop,0) as total_semula,
  -- Menjadi
  p.volume_menjadi,
  p.satuan_menjadi,
  coalesce(p.pagu_menjadi,0)                  as pagu_menjadi,
  coalesce(p.pagu_bop_menjadi,0)              as pagu_bop_menjadi,
  coalesce(p.pagu_menjadi,0) + coalesce(p.pagu_bop_menjadi,0) as total_menjadi,
  -- Selisih
  (coalesce(p.pagu_menjadi,0) + coalesce(p.pagu_bop_menjadi,0))
    - (coalesce(m.pagu,0) + coalesce(m.pagu_bop,0))            as selisih,
  p.keterangan,
  p.created_by,
  p.created_by_nama,
  p.created_at,
  p.updated_at
from public.rkp_perubahan_dbhcht p
left join public.rkp_dbhcht m on m.id = p.rkp_id;

grant select on public.v_rkp_perubahan_lengkap to authenticated;
grant select on public.v_rkp_perubahan_lengkap to anon;
