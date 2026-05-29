-- ============================================================
-- SIMDBHCHT — Migration 004: Tambahan kolom untuk Laporan
-- Aman dijalankan pada aplikasi live (hanya ADD COLUMN)
-- ============================================================

-- Tambah kolom target_output di realisasi (untuk cetak format resmi kolom 8)
alter table public.realisasi_dbhcht
  add column if not exists target_output text;

-- Indeks tambahan untuk query laporan (filter by tahun+bidang)
create index if not exists idx_asis_tahun   on public.asistensi_dbhcht(tahun, created_at);
create index if not exists idx_rekon_tahun  on public.rekonsiliasi_dbhcht(tahun, triwulan);

-- Pastikan fungsi get_email_by_username sudah ada (idempotent)
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

grant execute on function public.get_email_by_username(text) to anon;
grant execute on function public.get_email_by_username(text) to authenticated;

-- Pastikan tabel pagu_opd sudah ada (idempotent dari migration 003)
create table if not exists public.pagu_opd (
  id            uuid default uuid_generate_v4() primary key,
  profile_id    uuid references public.profiles(id) on delete cascade not null,
  tahun         integer not null,
  jenis         text not null default 'Murni' check (jenis in ('Murni','Perubahan')),
  pagu_utama    bigint not null default 0,
  bop           bigint not null default 0,
  keterangan    text,
  ditetapkan_oleh uuid references auth.users(id),
  ditetapkan_at timestamptz default now(),
  unique(profile_id, tahun, jenis)
);

alter table public.pagu_opd enable row level security;

-- Policies pagu_opd (idempotent)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='pagu_opd' and policyname='Semua user bisa lihat pagu_opd'
  ) then
    create policy "Semua user bisa lihat pagu_opd"
      on public.pagu_opd for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where tablename='pagu_opd' and policyname='Sekretariat bisa kelola pagu_opd'
  ) then
    create policy "Sekretariat bisa kelola pagu_opd"
      on public.pagu_opd for all
      using (exists (select 1 from public.profiles where id = auth.uid() and role = 'sekretariat'));
  end if;
end $$;
