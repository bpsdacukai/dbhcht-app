# 🌿 SIMDBHCHT
**Sistem Informasi DBH Cukai Hasil Tembakau**

Aplikasi multi-user untuk pengelolaan DBH CHT dari tahap perencanaan (RKP), asistensi, realisasi, hingga rekonsiliasi — dengan analisa AI otomatis berbasis Claude.

---

## 🚀 Cara Deploy (Supabase + Vercel)

### Langkah 1 — Setup Supabase

1. Buat akun di [supabase.com](https://supabase.com) → **New Project**
2. Catat `Project URL` dan `anon public key` dari **Settings → API**
3. Buka **SQL Editor** → New Query → paste isi file:
   ```
   supabase/migrations/001_init_schema.sql
   ```
   Klik **Run** untuk membuat semua tabel, RLS, trigger, dan data awal.

4. Di **Authentication → Settings**:
   - Matikan **"Enable email confirmations"** untuk kemudahan testing
   - Atau aktifkan dan setup SMTP untuk produksi

5. Buat akun **Sekretariat** pertama:
   - Buka **Authentication → Users → Add User**
   - Email: `sekretariat@pemda.go.id`
   - Password: `dbhcht#2026`
   - Klik **Create User**
   - Buka **Table Editor → profiles** → Edit baris yang baru dibuat:
     - `username` = `sekretariat`
     - `nama` = `Sekretariat Tim Koordinasi`
     - `role` = `sekretariat`
     - `bidang` = `all`

### Langkah 2 — Konfigurasi Project

```bash
# Clone / download project ini
cd simdbhcht

# Install dependencies
npm install

# Salin file environment
cp .env.example .env
```

Edit file `.env`:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Langkah 3 — Test Lokal

```bash
npm run dev
```
Buka `http://localhost:5173` dan login dengan akun sekretariat.

### Langkah 4 — Deploy ke Vercel

**Cara A — Via GitHub (Recommended):**
1. Push project ke GitHub (repo baru)
2. Buka [vercel.com](https://vercel.com) → **New Project** → Import repo
3. Di **Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL` → URL Supabase Anda
   - `VITE_SUPABASE_ANON_KEY` → Anon key Supabase Anda
4. Klik **Deploy** → tunggu selesai
5. Akses URL Vercel yang diberikan

**Cara B — Via Vercel CLI:**
```bash
npm install -g vercel
vercel login
vercel --prod
# Ikuti prompt, isi environment variables saat ditanya
```

**Cara C — Via Netlify:**
```bash
npm run build
# Upload folder `dist/` ke Netlify Drop: app.netlify.com/drop
# Tambahkan environment variables di Site Settings → Environment
```

---

## 👤 Menambah Akun OPD (setelah deploy)

Login sebagai **sekretariat** → menu **Manajemen OPD** → **+ Tambah OPD**

Atau manual via Supabase:
1. **Authentication → Users → Add User** (isi email & password)
2. **Table Editor → profiles** → Edit baris baru (isi username, nama, role=opd, bidang)

---

## 🔑 Fitur Utama

| Fitur | Sekretariat | OPD |
|-------|:-----------:|:---:|
| Dashboard (ringkasan + AI) | ✅ | ✅ |
| Pagu Alokasi | ✅ edit | ✅ lihat |
| Penyusunan RKP | ✅ semua | ✅ bidang sendiri |
| Asistensi RKP + AI | ✅ | ✅ lihat |
| Realisasi Triwulan | ✅ semua | ✅ bidang sendiri |
| Rekonsiliasi + AI | ✅ | ✅ lihat |
| Regulasi | ✅ edit | ✅ lihat |
| Manajemen Akun OPD | ✅ | ❌ |
| Cetak Laporan | ✅ | ✅ |

### Koordinasi DBH CHT
Kegiatan Koordinasi Pengelolaan DBH CHT **bukan bidang tersendiri**, melainkan kegiatan lintas bidang yang dilaksanakan oleh Sekretariat. Tersedia sebagai tab setara di RKP dan Realisasi dengan kode rekening:
- `4.01.03.2.04.0001` — Koordinasi, Sinkronisasi dan Evaluasi
- `5.02.02.2.02.0005` — Koordinasi Pengelolaan Dana Transfer

---

## 🤖 Integrasi Claude AI

AI digunakan untuk:
- **Dashboard** — analisis otomatis kondisi realisasi DBH CHT
- **Asistensi** — rekomendasi tindak lanjut hasil asistensi
- **Rekonsiliasi** — rekomendasi tindak lanjut hasil rekonsiliasi

Untuk produksi, **jangan simpan API key Anthropic di environment variable frontend**. Gunakan Supabase Edge Function sebagai proxy:

```bash
# Install Supabase CLI
npm install -g supabase
supabase functions deploy ai-proxy --project-ref YOUR_PROJECT_REF
```

---

## 🗄️ Struktur Database

| Tabel | Deskripsi |
|-------|-----------|
| `profiles` | Profil pengguna (extend auth.users) |
| `pagu_alokasi` | Pagu DBH CHT per tahun/jenis |
| `rkp_dbhcht` | Rencana Kerja dan Penganggaran |
| `realisasi_dbhcht` | Realisasi per triwulan |
| `asistensi_dbhcht` | Berita Acara Asistensi |
| `rekonsiliasi_dbhcht` | Berita Acara Rekonsiliasi |
| `regulasi_dbhcht` | Referensi regulasi |

---

## 📁 Struktur Project

```
simdbhcht/
├── index.html
├── vite.config.js
├── vercel.json
├── package.json
├── .env.example
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.js      ← Supabase client & auth helpers
│   │   ├── constants.js     ← Bidang, program, kode rekening
│   │   └── ai.js            ← Claude AI integration
│   ├── hooks/
│   │   ├── useAuth.jsx      ← Auth context
│   │   └── useApp.jsx       ← App state (tahun, dark mode, notif)
│   ├── components/
│   │   ├── Layout.jsx       ← Topbar, Sidebar
│   │   └── UI.jsx           ← Shared UI components
│   └── pages/
│       ├── Login.jsx
│       ├── Dashboard.jsx
│       ├── RKP.jsx
│       ├── Realisasi.jsx
│       └── OtherPages.jsx   ← Asistensi, Rekonsiliasi, Pagu, OPD, Regulasi
└── supabase/
    └── migrations/
        └── 001_init_schema.sql
```

---

## ⚙️ Tech Stack

- **Frontend**: React 18 + Vite
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **Deployment**: Vercel / Netlify
- **AI**: Claude claude-sonnet-4-20250514 (Anthropic)
- **Styling**: Pure CSS (no framework dependency)

---

*Dikembangkan untuk mendukung pengelolaan DBH CHT yang transparan, akuntabel, dan berbasis data.*
