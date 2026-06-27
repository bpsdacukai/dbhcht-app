# 📘 PANDUAN LENGKAP UPDATE SIMDBHCHT
## Dari Download hingga Aplikasi Live di https://simdbhcht.vercel.app

---

## 🗂️ DAFTAR ISI
1. [Prasyarat & Persiapan](#1-prasyarat--persiapan)
2. [Struktur File yang Dibutuhkan](#2-struktur-file-yang-dibutuhkan)
3. [Langkah A — Update Database Supabase](#3-langkah-a--update-database-supabase)
4. [Langkah B — Update Kode di GitHub](#4-langkah-b--update-kode-di-github)
5. [Langkah C — Vercel Auto-Deploy](#5-langkah-c--vercel-auto-deploy)
6. [Verifikasi Setelah Update](#6-verifikasi-setelah-update)
7. [Cara Rollback Jika Ada Masalah](#7-cara-rollback-jika-ada-masalah)
8. [Troubleshooting Umum](#8-troubleshooting-umum)
9. [Panduan Cetak Dokumen](#9-panduan-cetak-dokumen)
10. [Ringkasan Hak Akses per Akun](#10-ringkasan-hak-akses-per-akun)

---

## 1. PRASYARAT & PERSIAPAN

Pastikan tersedia:

| Kebutuhan | Keterangan |
|-----------|-----------|
| Akun GitHub | github.com — tempat menyimpan kode |
| Akun Vercel | vercel.com — tempat deploy frontend |
| Akun Supabase | supabase.com — database & auth |
| Git (di komputer lokal) | Unduh di git-scm.com |
| Node.js 18+ | Unduh di nodejs.org |
| VS Code atau text editor | Untuk mengedit file jika perlu |

Jika belum punya Git di komputer, alternatif termudah:
- Gunakan **GitHub Desktop** (desktop.github.com) — antarmuka visual untuk Git

---

## 2. STRUKTUR FILE YANG DIBUTUHKAN

Setelah extract ZIP (`SIMDBHCHT_v4.zip`), struktur folder:

```
simdbhcht/
├── src/
│   ├── App.jsx                    ← Router utama
│   ├── index.css                  ← Semua styling
│   ├── main.jsx                   ← Entry point React
│   ├── components/
│   │   ├── Layout.jsx             ← Topbar + Sidebar
│   │   └── UI.jsx                 ← Komponen reusable
│   ├── hooks/
│   │   ├── useAuth.jsx            ← Context autentikasi
│   │   └── useApp.jsx             ← Context app (tahun, dark mode)
│   ├── lib/
│   │   ├── supabase.js            ← Koneksi Supabase + login username
│   │   ├── constants.js           ← Data bidang, program, kode rekening
│   │   └── ai.js                  ← Integrasi Claude AI
│   └── pages/
│       ├── Login.jsx              ← Halaman login (username-based)
│       ├── Dashboard.jsx          ← Dashboard + analisa AI
│       ├── RKP.jsx                ← Penyusunan RKP
│       ├── Realisasi.jsx          ← Input realisasi
│       ├── OtherPages.jsx         ← Asistensi + Rekonsiliasi
│       ├── OtherPagesExtra.jsx    ← Pagu, Manajemen OPD, Regulasi
│       └── Laporan.jsx            ← Cetak semua dokumen
├── supabase/migrations/
│   ├── 001_init_schema.sql        ← Schema awal (sudah dijalankan)
│   ├── 002_fix_view_security.sql  ← Fix RLS views (sudah dijalankan)
│   ├── 003_v2_improvements.sql    ← Perbaikan v2 (sudah dijalankan)
│   └── 004_laporan_fixes.sql      ← Tambahan kolom laporan
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── .env.example
```

---

## 3. LANGKAH A — UPDATE DATABASE SUPABASE

> ⏱️ Waktu: 5 menit
> ✅ Aman: hanya ADD COLUMN / CREATE TABLE, tidak menghapus data

### A1. Buka Supabase SQL Editor

1. Login ke **https://supabase.com**
2. Pilih project **SIMDBHCHT**
3. Di menu kiri klik **SQL Editor**
4. Klik **New Query** (tombol + di pojok kiri atas)

### A2. Jalankan Migration 004 (jika belum)

Buka file `supabase/migrations/004_laporan_fixes.sql`, salin semua isinya, tempel di SQL Editor, klik **Run**.

Hasilnya harus: `Success. No rows returned.`

### A3. Cek apakah Migration 003 sudah dijalankan

Jalankan query berikut untuk cek:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'asistensi_dbhcht'
AND column_name = 'peserta_sekretariat';
```

- Jika hasilnya ada 1 baris → migration 003 sudah dijalankan ✅
- Jika kosong → jalankan `003_v2_improvements.sql` dulu

### A4. Cek fungsi login username

```sql
SELECT public.get_email_by_username('sekretariat');
```

- Harus mengembalikan email sekretariat
- Jika error → jalankan ulang bagian fungsi di `003_v2_improvements.sql`

---

## 4. LANGKAH B — UPDATE KODE DI GITHUB

Ada dua cara tergantung kondisi:

---

### 📌 CARA 1 — Sudah ada repo GitHub (update dari versi sebelumnya)

Ini cara paling cepat jika sudah pernah push ke GitHub sebelumnya.

**Langkah:**

```bash
# 1. Masuk ke folder project
cd C:\Users\NamaAnda\simdbhcht     # Windows
# atau
cd ~/simdbhcht                      # Mac/Linux

# 2. Salin file baru dari ZIP ke folder ini
#    (copy semua isi folder simdbhcht dari ZIP ke sini,
#     timpa file yang sudah ada — JANGAN hapus folder .git)

# 3. Cek file yang berubah
git status

# 4. Tambah semua perubahan
git add .

# 5. Commit dengan pesan
git commit -m "v4: asistensi view-only OPD, program koordinasi, cetak BA format resmi"

# 6. Push ke GitHub
git push origin main
```

**Selesai!** Vercel akan otomatis deploy dalam 2–3 menit.

---

### 📌 CARA 2 — Belum ada repo GitHub (pertama kali setup)

**Langkah:**

#### B2a. Buat repo baru di GitHub
1. Buka **https://github.com** → login
2. Klik tombol **+** → **New repository**
3. Nama: `simdbhcht`
4. Pilih **Private** (agar kode tidak publik)
5. Klik **Create repository**
6. Salin URL repo, contoh: `https://github.com/namaanda/simdbhcht.git`

#### B2b. Extract ZIP dan init Git

```bash
# 1. Extract ZIP ke folder simdbhcht/
# 2. Buka terminal / command prompt di dalam folder itu

cd simdbhcht

# 3. Init git
git init
git add .
git commit -m "Initial commit SIMDBHCHT v4"

# 4. Hubungkan ke GitHub
git remote add origin https://github.com/namaanda/simdbhcht.git
git branch -M main
git push -u origin main
```

#### B2c. Buat file .env dari template

```bash
cp .env.example .env
```

Edit file `.env` dan isi:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ File `.env` TIDAK boleh di-commit ke GitHub (sudah ada di `.gitignore`)

---

### 📌 CARA 3 — Menggunakan GitHub Desktop (tanpa command line)

1. Unduh **GitHub Desktop** dari https://desktop.github.com
2. Login dengan akun GitHub
3. **File → Add Local Repository** → pilih folder `simdbhcht`
4. Jika diminta init, klik **Initialize Repository**
5. Salin file baru dari ZIP ke folder (timpa yang lama)
6. Di GitHub Desktop: isi summary commit misal `v4 update`
7. Klik **Commit to main**
8. Klik **Push origin**

---

## 5. LANGKAH C — VERCEL AUTO-DEPLOY

### C1. Hubungkan GitHub ke Vercel (sekali saja, jika belum)

1. Buka **https://vercel.com** → login
2. Klik **Add New → Project**
3. Import dari GitHub → pilih repo `simdbhcht`
4. **Framework Preset**: Vite (otomatis terdeteksi)
5. **Environment Variables** → klik **Add**:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | URL Supabase Anda |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase Anda |

6. Klik **Deploy**

### C2. Update berikutnya (otomatis)

Setelah `git push`, Vercel **otomatis** mendeteksi perubahan dan deploy ulang.
Durasi: **2–3 menit**.

Pantau di: Vercel Dashboard → Project → **Deployments**

Status yang muncul:
- 🟡 **Building** → sedang proses
- 🟢 **Ready** → selesai, aplikasi sudah update
- 🔴 **Failed** → ada error (lihat log untuk detail)

### C3. Pastikan domain sudah custom (opsional)

Jika ingin URL tetap `simdbhcht.vercel.app` atau domain sendiri:
- Vercel Dashboard → Project → **Settings → Domains**

---

## 6. VERIFIKASI SETELAH UPDATE

Buka https://simdbhcht.vercel.app dan cek poin-poin ini:

### ✅ Login & Akses
- [ ] Login dengan **username** (bukan email) berhasil
- [ ] Akun sekretariat melihat semua menu termasuk **Manajemen OPD**, **Pagu Alokasi**
- [ ] Akun OPD (misal: satpolppkwb) melihat menu **Asistensi** dan **Rekonsiliasi** dengan badge "Lihat"
- [ ] Akun OPD TIDAK melihat tombol **+ Tambah BA** di Asistensi/Rekonsiliasi

### ✅ RKP & Realisasi
- [ ] Akun satpolppkwb dan diskominfokwb melihat tombol **+ Tambah** di Penyusunan RKP
- [ ] Tab **Koordinasi DBH CHT** tersedia untuk semua OPD
- [ ] Kolom **Pagu Utama** dan **BOP (maks 10%)** tampil di form RKP
- [ ] Validasi BOP aktif — jika melebihi 10% muncul peringatan merah

### ✅ Asistensi
- [ ] Dropdown Program mencakup **Kegiatan Koordinasi Pengelolaan DBH CHT** dan **Kegiatan Pendukung**
- [ ] Saat OPD dipilih, dropdown ⚡ Auto-fill menampilkan daftar RKP OPD itu
- [ ] Memilih RKP dari dropdown otomatis mengisi Program, Kegiatan, Sub Kegiatan, Pagu
- [ ] Memilih "Semua RKP OPD ini" mengisi pagu total
- [ ] Tombol 👁️ Lihat membuka pratinjau BA format resmi (fullscreen overlay)
- [ ] Tombol 🖨️ Cetak di overlay mencetak HANYA dokumen (tanpa sidebar/header)
- [ ] Tombol ✕ Tutup menutup overlay kembali ke daftar

### ✅ Rekonsiliasi
- [ ] Saat OPD Diskominfo/SatpolPP dipilih, dropdown ⚡ Auto-fill menampilkan realisasi mereka
- [ ] Auto-fill sama persis dengan OPD lain (Dinkes, Disnaker, dll)
- [ ] Tombol 👁️ Lihat membuka format BA Rekonsiliasi resmi

### ✅ Laporan & Cetak
- [ ] Menu 🖨️ **Laporan & Cetak** tersedia di sidebar semua akun
- [ ] Tab BA Asistensi: daftar BA + tombol Pratinjau
- [ ] Tab Rekap Asistensi: tabel rekap semua OPD
- [ ] Tab Cetak RKP: format 10 kolom sesuai PMK
- [ ] Tab Laporan Realisasi: format 10 kolom + filter triwulan

---

## 7. CARA ROLLBACK JIKA ADA MASALAH

### Rollback Frontend (Vercel) — paling cepat

1. Buka **https://vercel.com** → masuk ke project SIMDBHCHT
2. Klik tab **Deployments**
3. Cari deployment sebelumnya (status Ready)
4. Klik titik tiga (⋯) → **Promote to Production**
5. Konfirmasi → selesai dalam 30 detik

### Rollback Database (Supabase)

Semua migration v3 dan v4 hanya menambah kolom. Data lama tidak terganggu.
Jika ingin hapus kolom tambahan:

```sql
-- Hapus kolom tambahan v4 (tidak akan hilangkan data lama)
ALTER TABLE public.realisasi_dbhcht DROP COLUMN IF EXISTS target_output;

-- Hapus kolom tambahan v3
ALTER TABLE public.asistensi_dbhcht
  DROP COLUMN IF EXISTS peserta_sekretariat,
  DROP COLUMN IF EXISTS peserta_opd,
  DROP COLUMN IF EXISTS nomor_ba,
  DROP COLUMN IF EXISTS tempat,
  DROP COLUMN IF EXISTS rkp_snapshot;
```

---

## 8. TROUBLESHOOTING UMUM

### ❌ "Username tidak ditemukan atau tidak aktif"
**Penyebab:** Fungsi `get_email_by_username` belum dibuat atau username salah.

**Solusi:**
```sql
-- Cek apakah fungsi ada
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'get_email_by_username';

-- Jika tidak ada, jalankan ulang bagian ini dari 003_v2_improvements.sql
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles
  WHERE lower(username) = lower(p_username) AND aktif = true LIMIT 1;
  RETURN v_email;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated;
```

---

### ❌ Vercel build gagal (status merah)

1. Di Vercel → **Deployments** → klik deployment yang gagal
2. Klik **View Build Logs**
3. Cari baris berwarna merah

Penyebab umum:
- **Cannot find module** → file baru belum di-commit
- **Environment variable missing** → VITE_SUPABASE_URL belum diset
- **Syntax error** → ada typo di file JSX

Cara cepat: salin pesan error, cari di file yang disebutkan, perbaiki, push ulang.

---

### ❌ Tombol cetak mencetak seluruh halaman (termasuk sidebar)

Pastikan browser menggunakan Chrome atau Edge (bukan Firefox).

Di dialog cetak Chrome:
1. Klik **More settings**
2. Centang **Background graphics** (untuk warna tabel)
3. Uncheck **Headers and footers**
4. Paper size: **A4**
5. Margins: **Minimum** atau **None**

---

### ❌ Auto-fill RKP tidak muncul di form Asistensi

Penyebab: OPD belum punya data RKP di tahun yang dipilih.

Solusi:
1. Pastikan tahun di topbar sesuai
2. Login sebagai OPD tersebut → input RKP dulu
3. Kembali ke sekretariat → coba auto-fill lagi

---

### ❌ OPD tidak bisa input RKP (tidak ada tombol + Tambah)

Penyebab: `profile.bidang` OPD kosong atau tidak sesuai dengan tab yang aktif.

Solusi:
1. Login sekretariat → **Manajemen OPD**
2. Edit akun OPD → pastikan **Bidang** terisi dengan benar
3. Untuk SatpolPP → pilih `Bidang Penegakan Hukum`
4. Untuk Diskominfo → pilih sesuai program DBH CHT mereka
5. Semua OPD bisa input tab **Koordinasi DBH CHT**

---

### ❌ Data OPD A terlihat oleh OPD B

Penyebab: RLS policy belum aktif atau ada bug di migration 003.

Cek di Supabase:
```sql
-- Cek policy yang ada
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'rkp_dbhcht';
```

Harus ada policy "RKP: OPD hanya lihat miliknya". Jika tidak ada, jalankan ulang bagian RLS dari `003_v2_improvements.sql`.

---

## 9. PANDUAN CETAK DOKUMEN

### Format dokumen yang tersedia:

| Dokumen | Lokasi | Keterangan |
|---------|--------|-----------|
| BA Asistensi | Asistensi → 👁️ Lihat | Format resmi A–D + tanda tangan |
| BA Rekonsiliasi | Rekonsiliasi → 👁️ Lihat | Format resmi A–E + tanda tangan |
| Rekap Asistensi | Laporan → tab Rekap Asistensi | Tabel semua BA per TA |
| Rekap Rekonsiliasi | Laporan → tab Rekap Rekonsiliasi | Tabel + filter triwulan |
| RKP | Laporan → tab Cetak RKP | Format 10 kolom sesuai PMK |
| Laporan Realisasi | Laporan → tab Laporan Realisasi | Format 10 kolom + triwulan |

### Tips cetak terbaik:

1. **Browser**: Gunakan **Chrome** atau **Edge**
2. **Orientasi**: Landscape untuk tabel RKP dan Realisasi (banyak kolom)
3. **Ukuran**: A4
4. **Setting Chrome**:
   - Buka Print (`Ctrl+P`)
   - More settings → uncheck **Headers and footers**
   - Background graphics: **centang** (agar warna header tabel muncul)
   - Margins: **Minimum**
5. **Nama Kab/Kota**: Isi di kolom input di halaman Laporan (tersimpan otomatis)

### Tanda tangan:

Dokumen cetak menyediakan baris kosong untuk tanda tangan basah.
Untuk tanda tangan digital, perlu integrasi modul e-signature tersendiri.

---

## 10. RINGKASAN HAK AKSES PER AKUN

| Fitur | Sekretariat | OPD | Viewer |
|-------|:-----------:|:---:|:------:|
| Dashboard | ✅ | ✅ | ✅ |
| Pagu Alokasi (edit) | ✅ | — | — |
| Pagu Alokasi (lihat) | ✅ | ✅* | ✅ |
| Penyusunan RKP (input) | ✅ semua | ✅ bidangnya | — |
| Penyusunan RKP (lihat) | ✅ semua | ✅ miliknya | — |
| Asistensi (buat BA) | ✅ | — | — |
| Asistensi (lihat BA) | ✅ semua | ✅ miliknya | — |
| Realisasi (input) | ✅ semua | ✅ bidangnya | — |
| Rekonsiliasi (buat BA) | ✅ | — | — |
| Rekonsiliasi (lihat BA) | ✅ semua | ✅ miliknya | — |
| Laporan & Cetak | ✅ semua | ✅ miliknya | ✅* |
| Regulasi (tambah) | ✅ | — | — |
| Regulasi (lihat) | ✅ | ✅ | ✅ |
| Manajemen OPD | ✅ | — | — |

> *OPD hanya melihat data yang terkait dengan OPD mereka sendiri.

### Catatan khusus akun BKAD:
- Jika BKAD adalah bagian dari **Sekretariat Tim Koordinasi** → role: `sekretariat`
- Jika BKAD adalah **OPD pengguna DBH CHT** → role: `opd`, bidang sesuai program
- Jika BKAD hanya perlu **memantau** → role: `viewer`

### Tab Koordinasi DBH CHT:
Tersedia untuk **semua OPD** di halaman RKP dan Realisasi, karena kegiatan koordinasi dapat dilaksanakan oleh OPD manapun.

---

## 📞 CATATAN TEKNIS

- **Backup rutin**: Supabase → Project → Database → Backups (otomatis harian)
- **Monitoring**: Vercel Dashboard → Analytics (pantau traffic dan error)
- **Log error**: Supabase → Logs → API (untuk debug query database)
- **Update selanjutnya**: Ikuti prosedur yang sama — SQL migration dulu, baru push kode

---

*Panduan ini berlaku untuk SIMDBHCHT v4. Dibuat: Mei 2026.*
