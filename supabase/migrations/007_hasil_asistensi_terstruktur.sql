-- ============================================================
-- 007_hasil_asistensi_terstruktur.sql
-- Tambah kolom hasil_asistensi (jsonb, 7 kriteria sesuai lampiran
-- resmi BA Asistensi). Kolom lama (hasil_pembahasan, catatan,
-- tindak_lanjut, kesimpulan) TIDAK dihapus/diubah — tetap dipakai
-- untuk kesimpulan (D. KESIMPULAN) dan kompatibilitas data lama.
-- ============================================================

alter table public.asistensi_dbhcht
  add column if not exists hasil_asistensi jsonb default '[
    {"no":1,"uraian":"Kesesuaian bidang penggunaan DBH CHT","catatan":"","tindak_lanjut":""},
    {"no":2,"uraian":"Kesesuaian indikator dan target","catatan":"","tindak_lanjut":""},
    {"no":3,"uraian":"Kesesuaian komponen belanja","catatan":"","tindak_lanjut":""},
    {"no":4,"uraian":"Kesesuaian dengan PMK terkait DBH CHT","catatan":"","tindak_lanjut":""},
    {"no":5,"uraian":"Kelengkapan dokumen pendukung","catatan":"","tindak_lanjut":""},
    {"no":6,"uraian":"Efisiensi dan efektivitas anggaran","catatan":"","tindak_lanjut":""},
    {"no":7,"uraian":"Catatan lainnya","catatan":"","tindak_lanjut":""}
  ]'::jsonb;

-- Backfill data BA lama (isi baris 1 dari hasil_pembahasan, baris 4 dari catatan)
-- supaya BA yang sudah dibuat sebelumnya tetap tampil datanya di format baru.
update public.asistensi_dbhcht
set hasil_asistensi = jsonb_build_array(
  jsonb_build_object('no',1,'uraian','Kesesuaian bidang penggunaan DBH CHT','catatan',coalesce(hasil_pembahasan,''),'tindak_lanjut',coalesce(tindak_lanjut,'')),
  jsonb_build_object('no',2,'uraian','Kesesuaian indikator dan target','catatan','','tindak_lanjut',''),
  jsonb_build_object('no',3,'uraian','Kesesuaian komponen belanja','catatan','','tindak_lanjut',''),
  jsonb_build_object('no',4,'uraian','Kesesuaian dengan PMK terkait DBH CHT','catatan',coalesce(catatan,''),'tindak_lanjut',''),
  jsonb_build_object('no',5,'uraian','Kelengkapan dokumen pendukung','catatan','','tindak_lanjut',''),
  jsonb_build_object('no',6,'uraian','Efisiensi dan efektivitas anggaran','catatan','','tindak_lanjut',''),
  jsonb_build_object('no',7,'uraian','Catatan lainnya','catatan','','tindak_lanjut','')
)
where (hasil_pembahasan is not null and hasil_pembahasan <> '')
   or (catatan is not null and catatan <> '');
