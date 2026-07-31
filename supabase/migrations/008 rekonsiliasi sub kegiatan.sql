-- ============================================================
-- SIMDBHCHT — Migration 008: Kolom Sub Kegiatan di Rekonsiliasi
-- Aman dijalankan pada aplikasi live (hanya ADD COLUMN)
--
-- Sebelumnya tabel rekonsiliasi_dbhcht hanya punya kolom
-- "kegiatan" sehingga baris "Sub Kegiatan" pada BA Rekonsiliasi
-- (Bagian A & C, form Laporan.jsx) selalu kosong. Migration ini
-- menambah kolom sub_kegiatan agar bisa diisi dan ditampilkan.
-- ============================================================

alter table public.rekonsiliasi_dbhcht
  add column if not exists sub_kegiatan text;
