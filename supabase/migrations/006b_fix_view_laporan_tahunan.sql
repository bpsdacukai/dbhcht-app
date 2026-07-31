-- ============================================================
-- 006b_fix_view_laporan_tahunan.sql
-- Perbaikan view v_rekap_laporan_tahunan:
-- pagu diambil via join rkp_dbhcht (rkp_id), bukan kolom
-- realisasi_dbhcht.pagu yang memang tidak ada di skema live.
-- ============================================================

drop view if exists public.v_rekap_laporan_tahunan;

create or replace view public.v_rekap_laporan_tahunan
  with (security_invoker = true)
as
select
  r.tahun,
  r.bidang_id,
  r.is_koordinasi,
  count(*)                                              as jumlah_kegiatan,
  sum(coalesce(m.pagu,0) + coalesce(m.pagu_bop,0))       as total_pagu,
  sum(coalesce(r.realisasi_pagu_utama,0) + coalesce(r.realisasi_bop,0)) as total_realisasi,
  avg(r.realisasi_fisik)                                as avg_fisik
from public.realisasi_dbhcht r
left join public.rkp_dbhcht m on m.id = r.rkp_id
group by r.tahun, r.bidang_id, r.is_koordinasi;

grant select on public.v_rekap_laporan_tahunan to authenticated;
grant select on public.v_rekap_laporan_tahunan to anon;
