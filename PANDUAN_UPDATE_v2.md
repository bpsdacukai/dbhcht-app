# 🔄 Panduan Update SIMDBHCHT v2 (Tanpa Mengganggu Aplikasi Live)

## Prinsip: Zero-Downtime Update

Semua perubahan dirancang agar **aman untuk aplikasi yang sudah berjalan**:
- SQL migration bersifat `ALTER/ADD` — tidak menghapus data existing
- File frontend diganti langsung via Vercel (redeploy otomatis)
- Tidak ada perubahan struktur tabel yang merusak data lama

---

## LANGKAH 1 — Jalankan SQL Migration (Supabase)

> ⏱️ Waktu: ~2 menit | ✅ Aman: tidak ada data yang hilang

1. Buka [supabase.com](https://supabase.com) → Project Anda → **SQL Editor**
2. Klik **New Query**
3. Paste isi file **`supabase/migrations/003_v2_improvements.sql`**
4. Klik **Run**
5. Pastikan muncul pesan sukses (tidak ada error merah)

Apa yang berubah di database:
- ✅ Tabel baru `pagu_opd` untuk penetapan pagu per OPD
- ✅ Kolom baru `pagu_bop`, `rincian`, `target_output` di `rkp_dbhcht`
- ✅ Kolom baru `realisasi_bop`, `capaian_output` di `realisasi_dbhcht`
- ✅ Kolom baru `peserta_sekretariat`, `peserta_opd`, `nomor_ba`, `tempat`, `rkp_snapshot` di `asistensi_dbhcht`
- ✅ Kolom baru `peserta_*`, `nomor_ba`, `tempat`, `realisasi_snapshot` di `rekonsiliasi_dbhcht`
- ✅ Fungsi `get_email_by_username()` untuk login dengan username
- ✅ RLS diperketat: OPD hanya lihat data miliknya

---

## LANGKAH 2 — Update Kode Frontend (Vercel)

### Cara A — GitHub Push (paling mudah):

```bash
# Di folder project lokal
git add .
git commit -m "v2: username login, BOP, peserta, koordinasi fix"
git push origin main
```

Vercel akan otomatis deploy dalam ~2 menit. Aplikasi lama tetap berjalan sampai deploy baru selesai.

### Cara B — Upload manual ke Vercel:

```bash
npm run build           # Build dulu
vercel --prod           # Deploy ke production
```

### Cara C — Drag & drop (tanpa Git):

1. Jalankan `npm run build` di komputer lokal
2. Buka [vercel.com](https://vercel.com) → Project → **Deployments**
3. Drag folder `dist/` ke area upload

---

## LANGKAH 3 — Verifikasi Setelah Update

Cek setiap poin ini setelah update:

- [ ] Login dengan **username** (bukan email) berhasil
- [ ] OPD dengan bidang `hukum` (satpolpp, dll) muncul tombol **+ Tambah** di RKP dan Realisasi
- [ ] Tab **Koordinasi DBH CHT** tersedia di RKP dan Realisasi untuk semua OPD
- [ ] Form RKP menampilkan kolom **Pagu Utama + BOP** dengan validasi 10%
- [ ] Form Asistensi menampilkan **auto-fill dari RKP** saat OPD dipilih
- [ ] Form Asistensi/Rekonsiliasi memiliki **tabel peserta** yang bisa ditambah/hapus
- [ ] Dashboard menampilkan **Total Anggaran RKP** (nominal) dan **Capaian Realisasi (%)**
- [ ] AI Analisa di Dashboard **hanya muncul setelah tombol diklik** (tidak otomatis)

---

## Jika Ada Masalah

### Rollback SQL (jika ada error):
SQL migration 003 bisa di-rollback manual jika diperlukan:
```sql
-- Hapus tabel dan kolom baru (TIDAK menghapus data lama)
DROP TABLE IF EXISTS public.pagu_opd;
ALTER TABLE public.rkp_dbhcht DROP COLUMN IF EXISTS pagu_bop, DROP COLUMN IF EXISTS rincian, DROP COLUMN IF EXISTS target_output;
ALTER TABLE public.realisasi_dbhcht DROP COLUMN IF EXISTS realisasi_bop, DROP COLUMN IF EXISTS capaian_output;
DROP FUNCTION IF EXISTS public.get_email_by_username(text);
```

### Rollback Vercel:
Di Vercel Dashboard → **Deployments** → klik deployment lama → **Promote to Production**

### Login username tidak bisa:
Pastikan fungsi `get_email_by_username` sudah dibuat di Supabase. Cek dengan:
```sql
SELECT public.get_email_by_username('sekretariat');
-- Harus return email sekretariat
```

---

## Perubahan Lengkap v2

| # | Masalah | Solusi |
|---|---------|--------|
| 1 | Koordinasi tidak muncul di semua OPD | Tab Koordinasi tersedia untuk semua OPD, checkbox toggle di form |
| 2 | Tidak ada kolom BOP | Kolom Pagu Utama + BOP (maks 10%), validasi real-time |
| 3 | Login dengan email | Login dengan **username** via fungsi RPC Supabase |
| 4 | Pagu OPD belum ada | Tabel `pagu_opd`, form penetapan pagu per OPD di menu Pagu Alokasi |
| 5 | OPD lain lihat data OPD ini | RLS diperketat: OPD hanya lihat data `created_by = auth.uid()` |
| 6 | Asistensi/Rekonsiliasi manual | Auto-fill dari RKP/Realisasi OPD terpilih, tabel peserta dinamis |
| 7 | Dashboard "Entri RKP" = jumlah kegiatan | Diganti nominal **Total Anggaran RKP** (Rp) |
| 8 | Capaian realisasi tidak jelas | Stat card "Capaian Realisasi (%)" dengan warna hijau/kuning/merah |
| 9 | AI otomatis = lambat | AI hanya jalan saat tombol **✨ Generate** diklik |
| 10 | Tombol Tambah hilang di beberapa OPD | Logika `canEdit` diperbaiki: OPD bisa tambah di bidang sendiri + koordinasi |
| 11 | Tidak ada nomor BA, tempat, tanggal | Ditambahkan di form Asistensi dan Rekonsiliasi |
| 12 | Format BA tidak lengkap | Tombol 👁️ lihat detail BA + cetak |
