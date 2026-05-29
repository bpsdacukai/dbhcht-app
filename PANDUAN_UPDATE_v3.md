# 🔄 PANDUAN UPDATE SIMDBHCHT v3
## Update Aman untuk Aplikasi Live di https://simdbhcht.vercel.app

---

## ✅ PRINSIP ZERO-DOWNTIME

Semua perubahan dirancang **tidak merusak data yang sudah ada**:
- SQL hanya `ADD COLUMN` / `CREATE TABLE IF NOT EXISTS` — tidak DROP data
- Frontend diganti via Vercel → aplikasi lama tetap jalan sampai deploy selesai
- Rollback mudah di Vercel jika ada masalah

---

## LANGKAH 1 — Jalankan SQL di Supabase (5 menit)

Buka https://supabase.com → Project Anda → **SQL Editor → New Query**

Jalankan file **`004_laporan_fixes.sql`** terlebih dahulu (paling kecil, paling aman):
```sql
-- Paste isi file 004_laporan_fixes.sql → Run
```

Jika belum menjalankan migration 003 sebelumnya, jalankan juga:
```sql
-- Paste isi file 003_v2_improvements.sql → Run
```

Keduanya **idempotent** — aman dijalankan ulang jika sudah pernah dijalankan.

---

## LANGKAH 2 — Push ke GitHub → Vercel Auto-Deploy (3 menit)

```bash
# Di folder project lokal (simdbhcht/)
git add .
git commit -m "v3: laporan cetak format resmi, login username, BOP"
git push origin main
```

Vercel akan otomatis build dan deploy. Durasi ~2–3 menit.
Selama proses, aplikasi lama masih berjalan normal.

---

## LANGKAH 3 — Verifikasi (5 menit)

Buka https://simdbhcht.vercel.app dan cek:

- [ ] Login dengan **username** (bukan email) berhasil
- [ ] Menu **🖨️ Laporan & Cetak** muncul di sidebar (semua user)
- [ ] Di Laporan → tab **BA Asistensi**: daftar BA muncul, klik Pratinjau → format resmi tampil
- [ ] Di Laporan → tab **Rekap Asistensi**: tabel rekap semua OPD
- [ ] Di Laporan → tab **BA Rekonsiliasi**: pilih BA, format resmi tampil
- [ ] Di Laporan → tab **Rekap Rekonsiliasi**: tabel rekap + filter triwulan
- [ ] Di Laporan → tab **Cetak RKP**: format tabel 10 kolom sesuai PMK
- [ ] Di Laporan → tab **Laporan Realisasi**: format tabel 10 kolom sesuai PMK
- [ ] Tombol **🖨️ Cetak** mencetak hanya area dokumen (sidebar/header hilang)
- [ ] **Nama Kab/Kota** bisa diedit di header halaman Laporan

---

## 📋 Fitur Baru v3

### 1. Halaman Laporan & Cetak (menu 🖨️)
Semua akun (sekretariat dan OPD) memiliki akses. Fitur:
- **BA Asistensi** — pratinjau satu BA sesuai format resmi (A–D + tanda tangan)
- **Rekap Asistensi** — tabel rekap semua BA asistensi
- **BA Rekonsiliasi** — pratinjau satu BA sesuai format resmi (A–E + tanda tangan)
- **Rekap Rekonsiliasi** — tabel rekap, bisa filter per triwulan
- **Cetak RKP** — format 10 kolom sesuai Format_RKP_DBH_CHT.pdf
- **Laporan Realisasi** — format 10 kolom sesuai Format_Realisasi_DBH_CHT.pdf

### 2. Distribusi BA ke OPD
Akun OPD **hanya melihat BA yang terkait dengan OPD-nya** (via `opd_user_id`):
- Sekretariat → lihat semua BA semua OPD
- OPD A → hanya lihat BA yang berisi nama OPD A

### 3. Format Dokumen Sesuai Lampiran Resmi
- **BA Asistensi**: mengikuti `Format_Hasil_Asistensi_dan_Hasil_Rekonsiliasi_DBH_CHT.pdf`
  - Bagian A: Identitas Perangkat Daerah (7 baris)
  - Bagian B: Pelaksana Asistensi (peserta sekretariat + OPD)
  - Bagian C: Hasil Asistensi (7 poin uraian)
  - Bagian D: Kesimpulan (checkbox)
  - Tanda tangan 3 pihak
- **BA Rekonsiliasi**: format sama dengan penambahan
  - Bagian C: Tabel realisasi (Program, Kegiatan, Sub Kegiatan)
  - Bagian D: Permasalahan & Tindak Lanjut
  - Bagian E: Kesimpulan
- **RKP**: 10 kolom (No, Bidang/Program/Kegiatan, Rincian, Kode, Vol, Sat, Pagu, BOP, Total, Ket)
- **Realisasi**: 10 kolom (No, Bidang/Program, Rincian, Kode, Vol, Sat, Pagu, Output Rencana, Realisasi Dana, Realisasi Fisik%)

### 4. Nama Kab/Kota Persisten
Input nama kabupaten/kota di halaman Laporan tersimpan di browser (localStorage).
Muncul di header semua dokumen cetak.

---

## 🔁 Cara Rollback (Jika Diperlukan)

### Rollback Frontend (Vercel):
1. Buka vercel.com → Project → **Deployments**
2. Klik deployment sebelumnya → **Promote to Production**
3. Selesai dalam 30 detik

### Rollback SQL:
Migration 004 hanya menambah kolom — data tidak berubah.
Jika ingin hapus kolom tambahan:
```sql
alter table public.realisasi_dbhcht drop column if exists target_output;
drop index if exists idx_asis_tahun;
drop index if exists idx_rekon_tahun;
```

---

## 📁 File yang Berubah di v3

```
src/
  App.jsx              ← tambah route 'laporan'
  components/
    Layout.jsx         ← tambah menu 🖨️ Laporan & Cetak
  pages/
    Laporan.jsx        ← BARU: halaman laporan & cetak
    Login.jsx          ← login dengan username
    Dashboard.jsx      ← stat card diperbarui
    RKP.jsx            ← kolom BOP, validasi 10%
    Realisasi.jsx      ← kolom BOP, auto-fill dari RKP
    OtherPages.jsx     ← Asistensi+peserta, Rekonsiliasi+peserta, Pagu OPD

supabase/migrations/
  004_laporan_fixes.sql   ← BARU: kolom target_output, indeks
  003_v2_improvements.sql ← dari update sebelumnya
```

---

## 📞 Catatan Penting

1. **Akun BKAD** tidak perlu khusus — jika BKAD adalah sekretariat, gunakan role `sekretariat`. Jika OPD pengguna DBH CHT, buat akun dengan role `opd` dan bidang sesuai.

2. **Cetak dokumen** terbaik menggunakan Chrome/Edge. Atur:
   - File → Print → More settings → uncheck "Headers and footers"
   - Paper size: A4, Margins: Minimum atau None

3. **Tanda tangan** di dokumen cetak masih berupa baris kosong. Untuk tanda tangan digital, perlu integrasi modul terpisah.

4. **Backup data** sebelum update besar:
   ```
   Supabase Dashboard → Project → Database → Backups
   ```
