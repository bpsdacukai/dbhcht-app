-- ============================================================
-- SIMDBHCHT — Skema Database Supabase
-- Jalankan di Supabase SQL Editor: https://app.supabase.com
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── TABEL PROFIL PENGGUNA ──────────────────────────────────────
-- Melengkapi tabel auth.users bawaan Supabase
create table if not exists public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  username     text unique not null,
  nama         text not null,
  role         text not null default 'opd' check (role in ('sekretariat','opd','viewer')),
  bidang       text not null default 'all',
  email        text,
  aktif        boolean default true,
  created_at   timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Semua user bisa lihat profil"
  on public.profiles for select using (true);

create policy "User bisa update profil sendiri"
  on public.profiles for update using (auth.uid() = id);

create policy "Sekretariat bisa insert profil"
  on public.profiles for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
    or auth.uid() = id
  );

create policy "Sekretariat bisa hapus profil OPD"
  on public.profiles for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
  );

-- ── TABEL PAGU ALOKASI ────────────────────────────────────────
create table if not exists public.pagu_alokasi (
  id            uuid default uuid_generate_v4() primary key,
  tahun         integer not null,
  jenis         text not null default 'Murni' check (jenis in ('Murni','Perubahan')),
  total_pagu    bigint not null default 0,
  pct_kesmas    numeric(5,2) default 50,
  pct_kesehatan numeric(5,2) default 40,
  pct_hukum     numeric(5,2) default 10,
  pct_koordinasi numeric(5,2) default 2,
  updated_by    uuid references auth.users(id),
  updated_at    timestamptz default now(),
  unique(tahun, jenis)
);

alter table public.pagu_alokasi enable row level security;

create policy "Semua user bisa lihat pagu"
  on public.pagu_alokasi for select using (true);

create policy "Sekretariat bisa kelola pagu"
  on public.pagu_alokasi for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat'));

-- ── TABEL RKP DBH CHT ─────────────────────────────────────────
create table if not exists public.rkp_dbhcht (
  id              uuid default uuid_generate_v4() primary key,
  tahun           integer not null,
  jenis           text not null default 'Murni',
  bidang_id       text not null,
  program         text not null,
  kegiatan        text,
  sub_kegiatan    text,
  kode_rekening   text,
  nama_rekening   text,
  volume          numeric,
  satuan          text default 'Paket',
  pagu            bigint default 0,
  keterangan      text,
  is_koordinasi   boolean default false,
  created_by      uuid references auth.users(id),
  created_by_nama text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.rkp_dbhcht enable row level security;

create policy "Semua user bisa lihat RKP"
  on public.rkp_dbhcht for select using (true);

create policy "OPD bisa insert RKP sesuai bidang"
  on public.rkp_dbhcht for insert
  with check (
    auth.uid() is not null and (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
      or exists (select 1 from public.profiles where id = auth.uid() and bidang = bidang_id)
      or bidang_id = 'koordinasi'
    )
  );

create policy "OPD bisa update RKP miliknya, sekretariat semua"
  on public.rkp_dbhcht for update
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
  );

create policy "Sekretariat atau pemilik bisa hapus RKP"
  on public.rkp_dbhcht for delete
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
  );

-- ── TABEL REALISASI ───────────────────────────────────────────
create table if not exists public.realisasi_dbhcht (
  id              uuid default uuid_generate_v4() primary key,
  tahun           integer not null,
  triwulan        text not null check (triwulan in ('I','II','III','IV')),
  bidang_id       text not null,
  program         text not null,
  kegiatan        text,
  sub_kegiatan    text,
  pagu            bigint default 0,
  realisasi_keu   bigint default 0,
  realisasi_fisik numeric(5,2) default 0,
  is_koordinasi   boolean default false,
  keterangan      text,
  created_by      uuid references auth.users(id),
  created_by_nama text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.realisasi_dbhcht enable row level security;

create policy "Semua user bisa lihat realisasi"
  on public.realisasi_dbhcht for select using (true);

create policy "OPD bisa insert realisasi sesuai bidang"
  on public.realisasi_dbhcht for insert
  with check (
    auth.uid() is not null and (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
      or exists (select 1 from public.profiles where id = auth.uid() and bidang = bidang_id)
      or bidang_id = 'koordinasi'
    )
  );

create policy "OPD bisa update realisasi miliknya"
  on public.realisasi_dbhcht for update
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
  );

create policy "Sekretariat atau pemilik bisa hapus realisasi"
  on public.realisasi_dbhcht for delete
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat')
  );

-- ── TABEL ASISTENSI ───────────────────────────────────────────
create table if not exists public.asistensi_dbhcht (
  id              uuid default uuid_generate_v4() primary key,
  tahun           integer not null,
  tanggal         date default current_date,
  opd             text not null,
  opd_user_id     uuid references auth.users(id),
  bidang_id       text,
  program         text,
  kegiatan        text,
  sub_kegiatan    text,
  pagu_usulan     bigint default 0,
  hasil_pembahasan text,
  catatan         text,
  tindak_lanjut   text,
  kesimpulan      text default 'dapat_ditindaklanjuti' check (kesimpulan in ('dapat_ditindaklanjuti','perlu_perbaikan')),
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

alter table public.asistensi_dbhcht enable row level security;

create policy "Sekretariat bisa semua asistensi"
  on public.asistensi_dbhcht for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat'));

create policy "OPD bisa lihat asistensi miliknya"
  on public.asistensi_dbhcht for select
  using (opd_user_id = auth.uid());

-- ── TABEL REKONSILIASI ────────────────────────────────────────
create table if not exists public.rekonsiliasi_dbhcht (
  id              uuid default uuid_generate_v4() primary key,
  tahun           integer not null,
  triwulan        text not null,
  tanggal         date default current_date,
  opd             text not null,
  opd_user_id     uuid references auth.users(id),
  program         text,
  kegiatan        text,
  pagu            bigint default 0,
  realisasi_keu   bigint default 0,
  realisasi_fisik numeric(5,2) default 0,
  permasalahan    text,
  tindak_lanjut   text,
  penanggung_jawab text,
  target_selesai  date,
  kesimpulan      text default 'sesuai' check (kesimpulan in ('sesuai','perlu_perbaikan')),
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

alter table public.rekonsiliasi_dbhcht enable row level security;

create policy "Sekretariat bisa semua rekonsiliasi"
  on public.rekonsiliasi_dbhcht for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat'));

create policy "OPD bisa lihat rekonsiliasi miliknya"
  on public.rekonsiliasi_dbhcht for select
  using (opd_user_id = auth.uid());

-- ── TABEL REGULASI ────────────────────────────────────────────
create table if not exists public.regulasi_dbhcht (
  id          uuid default uuid_generate_v4() primary key,
  judul       text not null,
  tentang     text,
  tahun       integer,
  nomor       text,
  link_url    text,
  aktif       boolean default true,
  urutan      integer default 0,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);

alter table public.regulasi_dbhcht enable row level security;

create policy "Semua user bisa lihat regulasi"
  on public.regulasi_dbhcht for select using (true);

create policy "Sekretariat bisa kelola regulasi"
  on public.regulasi_dbhcht for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat'));

-- ── TRIGGER: update updated_at otomatis ──────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rkp_updated_at before update on public.rkp_dbhcht
  for each row execute procedure public.set_updated_at();

create trigger realisasi_updated_at before update on public.realisasi_dbhcht
  for each row execute procedure public.set_updated_at();

-- ── TRIGGER: buat profil otomatis saat user baru daftar ───────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, nama, role, bidang, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'nama', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'opd'),
    coalesce(new.raw_user_meta_data->>'bidang', 'kesmas'),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── DATA AWAL: Regulasi ───────────────────────────────────────
insert into public.regulasi_dbhcht (judul, tentang, tahun, nomor, link_url, urutan) values
  ('PMK No. 22/PMK.07/2026','Penggunaan Dana Bagi Hasil Cukai Hasil Tembakau',2026,'22/PMK.07/2026','https://jdih.kemenkeu.go.id',1),
  ('PMK No. 215/PMK.07/2021','Penggunaan, Pemantauan, dan Evaluasi Dana Bagi Hasil Cukai Hasil Tembakau',2021,'215/PMK.07/2021','https://jdih.kemenkeu.go.id',2),
  ('PP No. 55 Tahun 2008','Pengenaan Cukai Etil Alkohol, Minuman yang Mengandung Etil Alkohol, dan Hasil Tembakau',2008,'55/2008','https://peraturan.go.id',3),
  ('UU No. 39 Tahun 2007','Perubahan atas UU No. 11 Tahun 1995 tentang Cukai',2007,'39/2007','https://peraturan.go.id',4);

-- ── DATA AWAL: Pagu 2026 ──────────────────────────────────────
insert into public.pagu_alokasi (tahun, jenis, total_pagu, pct_kesmas, pct_kesehatan, pct_hukum, pct_koordinasi)
values (2026, 'Murni', 120000000000, 50, 40, 10, 2)
on conflict (tahun, jenis) do nothing;

-- ── VIEW: Rekap RKP per Bidang ────────────────────────────────
-- Catatan: security_invoker = true agar view menghormati RLS
-- pengguna yang sedang query, bukan permission pembuat view.
create or replace view public.v_rekap_rkp
  with (security_invoker = true)
as
select
  tahun,
  jenis,
  bidang_id,
  is_koordinasi,
  count(*)  as jumlah_kegiatan,
  sum(pagu) as total_pagu
from public.rkp_dbhcht
group by tahun, jenis, bidang_id, is_koordinasi;

grant select on public.v_rekap_rkp to authenticated;
grant select on public.v_rekap_rkp to anon;

-- ── VIEW: Rekap Realisasi per Bidang per Triwulan ─────────────
create or replace view public.v_rekap_realisasi
  with (security_invoker = true)
as
select
  tahun,
  triwulan,
  bidang_id,
  is_koordinasi,
  count(*)             as jumlah_kegiatan,
  sum(pagu)            as total_pagu,
  sum(realisasi_keu)   as total_realisasi,
  avg(realisasi_fisik) as avg_fisik
from public.realisasi_dbhcht
group by tahun, triwulan, bidang_id, is_koordinasi;

grant select on public.v_rekap_realisasi to authenticated;
grant select on public.v_rekap_realisasi to anon;
