-- ============================================================
-- 006_laporan_tahunan.sql
-- Tabel BARU untuk Laporan Tahunan Pelaksanaan Kegiatan & Anggaran
-- DBH CHT, format naratif mengacu PMK 22/2026.
--
-- PENTING: 100% ADDITIVE.
-- - Tidak ada ALTER/UPDATE/DELETE terhadap rkp_dbhcht, realisasi_dbhcht,
--   rkp_perubahan_dbhcht, asistensi_dbhcht, rekonsiliasi_dbhcht, profiles.
-- - Narasi Asistensi & Rekonsiliasi TIDAK diduplikasi di sini — cukup
--   dibaca langsung (read-only) dari asistensi_dbhcht.catatan/
--   tindak_lanjut dan rekonsiliasi_dbhcht.permasalahan/tindak_lanjut
--   saat menyusun slide/laporan.
-- ============================================================

-- ── TABEL 1: HEADER LAPORAN TAHUNAN ───────────────────────────
create table if not exists public.laporan_tahunan_dbhcht (
  id                  uuid default uuid_generate_v4() primary key,
  tahun               integer not null,
  nomor_laporan       text,
  judul_laporan       text not null default 'Laporan Tahunan Pelaksanaan Kegiatan dan Anggaran DBH CHT',
  ringkasan_eksekutif text,
  status              text not null default 'draft' check (status in ('draft','final')),
  disusun_oleh        uuid references auth.users(id),
  disahkan_oleh       uuid references auth.users(id),
  tanggal_pengesahan  date,
  penandatangan       jsonb,   -- fleksibel: {nama, jabatan, a_n, atas_nama_dari} — selaras pola TandaTanganFleksibel
  created_by          uuid references auth.users(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique(tahun)
);

comment on table public.laporan_tahunan_dbhcht is
  'Header/metadata Laporan Tahunan DBH CHT per tahun anggaran. Data kuantitatif tetap diambil live dari rkp_dbhcht, realisasi_dbhcht, rkp_perubahan_dbhcht, asistensi_dbhcht, rekonsiliasi_dbhcht.';

alter table public.laporan_tahunan_dbhcht enable row level security;

create policy "Semua user bisa lihat laporan tahunan"
  on public.laporan_tahunan_dbhcht for select using (true);

create policy "Sekretariat bisa kelola laporan tahunan"
  on public.laporan_tahunan_dbhcht for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat'));

create trigger laporan_tahunan_updated_at before update on public.laporan_tahunan_dbhcht
  for each row execute procedure public.set_updated_at();

-- ── TABEL 2: NARASI PER TAHAPAN & BIDANG ──────────────────────
-- Hanya untuk tahapan yang BELUM punya kolom naratif ringkas:
-- RKP Murni, Triwulanan (rangkuman, bukan per-item), Semester I,
-- RKP Perubahan. Untuk Asistensi & Rekonsiliasi, form ini cukup
-- dipakai sebagai "catatan tambahan level laporan tahunan" (opsional),
-- bukan pengganti data asistensi_dbhcht/rekonsiliasi_dbhcht.
create table if not exists public.narasi_tahapan_dbhcht (
  id                  uuid default uuid_generate_v4() primary key,
  laporan_tahunan_id  uuid references public.laporan_tahunan_dbhcht(id) on delete cascade not null,
  tahapan             text not null check (tahapan in (
    'penyusunan_rkp','asistensi_rkp','laporan_triwulanan',
    'rekonsiliasi_triwulanan','laporan_semester_1','rkp_perubahan'
  )),
  triwulan            text check (triwulan in ('I','II','III','IV')),  -- diisi jika tahapan = triwulanan/rekonsiliasi
  bidang_id           text not null check (bidang_id in ('kesmas','kesehatan','hukum')),
  is_koordinasi       boolean default false,
  opd_user_id         uuid references auth.users(id),

  capaian             text,
  kendala             text,
  tindak_lanjut       text,
  rekomendasi         text,

  status_review       text not null default 'draft' check (status_review in ('draft','diajukan','revisi','disetujui')),
  catatan_sekretariat text,
  direview_oleh       uuid references auth.users(id),
  tanggal_review       timestamptz,

  created_by          uuid references auth.users(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),

  unique(laporan_tahunan_id, tahapan, triwulan, bidang_id, is_koordinasi)
);

comment on table public.narasi_tahapan_dbhcht is
  'Narasi capaian/kendala/tindak lanjut per tahapan & bidang untuk Laporan Tahunan. Diisi OPD, direview/disetujui Sekretariat.';

alter table public.narasi_tahapan_dbhcht enable row level security;

create policy "Sekretariat bisa semua narasi tahapan"
  on public.narasi_tahapan_dbhcht for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat'));

create policy "OPD bisa lihat narasi bidangnya"
  on public.narasi_tahapan_dbhcht for select
  using (
    opd_user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and bidang = bidang_id)
  );

create policy "OPD bisa insert narasi sesuai bidang"
  on public.narasi_tahapan_dbhcht for insert
  with check (
    auth.uid() is not null and (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
      or exists (select 1 from public.profiles where id = auth.uid() and bidang = bidang_id and role = 'opd')
    )
  );

create policy "OPD bisa update narasi draft/revisi miliknya"
  on public.narasi_tahapan_dbhcht for update
  using (
    (opd_user_id = auth.uid() and status_review in ('draft','revisi'))
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
  );

create trigger narasi_tahapan_updated_at before update on public.narasi_tahapan_dbhcht
  for each row execute procedure public.set_updated_at();

-- ── TABEL 3: DOKUMENTASI / LAMPIRAN (untuk Slide & Infografis) ─
create table if not exists public.dokumentasi_laporan_dbhcht (
  id                  uuid default uuid_generate_v4() primary key,
  laporan_tahunan_id  uuid references public.laporan_tahunan_dbhcht(id) on delete cascade not null,
  tahapan             text,
  bidang_id           text check (bidang_id in ('kesmas','kesehatan','hukum')),
  judul               text not null,
  deskripsi           text,
  url_file            text not null,       -- Supabase Storage public URL
  urutan_tampil       integer default 0,   -- urutan slide/infografis
  diunggah_oleh       uuid references auth.users(id),
  created_at          timestamptz default now()
);

comment on table public.dokumentasi_laporan_dbhcht is
  'Foto/lampiran pendukung Laporan Tahunan untuk mode Slide & Infografis.';

alter table public.dokumentasi_laporan_dbhcht enable row level security;

create policy "Semua user bisa lihat dokumentasi laporan"
  on public.dokumentasi_laporan_dbhcht for select using (true);

create policy "OPD & Sekretariat bisa unggah dokumentasi"
  on public.dokumentasi_laporan_dbhcht for insert
  with check (auth.uid() is not null);

create policy "Sekretariat atau pengunggah bisa kelola dokumentasi"
  on public.dokumentasi_laporan_dbhcht for all
  using (
    diunggah_oleh = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
  );

-- ── INDEX ───────────────────────────────────────────────────
create index if not exists idx_laptah_tahun         on public.laporan_tahunan_dbhcht(tahun);
create index if not exists idx_narasi_laptah         on public.narasi_tahapan_dbhcht(laporan_tahunan_id);
create index if not exists idx_narasi_tahapan_bidang on public.narasi_tahapan_dbhcht(tahapan, bidang_id);
create index if not exists idx_dok_laptah            on public.dokumentasi_laporan_dbhcht(laporan_tahunan_id, urutan_tampil);

-- ── VIEW: Rekap Agregat untuk Slide/Infografis (baca dari tabel lama) ──
create or replace view public.v_rekap_laporan_tahunan
  with (security_invoker = true)
as
select
  r.tahun,
  r.bidang_id,
  r.is_koordinasi,
  sum(r.pagu)            as total_pagu,
  sum(r.realisasi_keu)   as total_realisasi,
  avg(r.realisasi_fisik) as avg_fisik
from public.realisasi_dbhcht r
group by r.tahun, r.bidang_id, r.is_koordinasi;

grant select on public.v_rekap_laporan_tahunan to authenticated;
grant select on public.v_rekap_laporan_tahunan to anon;
