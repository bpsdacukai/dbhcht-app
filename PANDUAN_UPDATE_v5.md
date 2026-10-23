# Update v5 — Rekap RKP Lengkap + Modernisasi Tampilan

## Fitur baru
- Menu **Penyusunan RKP** (Murni & Perubahan) → tombol **Input Data | Rekap Lengkap**.
- Rekap Lengkap: semua bidang + Kegiatan Koordinasi dalam 1 dokumen (ringkasan per bidang + rincian),
  Cetak, Unduh PDF (printer "Simpan sebagai PDF"), Unduh Excel, data penandatangan, pemeriksaan otomatis.
- File baru: `src/pages/RekapRKP.jsx`. Tidak ada migrasi database (hanya membaca data).

## Tampilan
- Desain baru (warna-warni, animasi, mode gelap otomatis mengikuti perangkat, menu laci + navigasi bawah di ponsel,
  aksesibilitas keyboard/pembaca layar, hormati "kurangi gerakan"). Aturan cetak lama tidak diubah.
- Halaman dimuat per-menu (lebih cepat).

## Keamanan (WAJIB dilakukan saat deploy)
1. `supabase/config.toml`: `verify_jwt = true` untuk ai-proxy → deploy ulang: `supabase functions deploy ai-proxy`.
2. `src/lib/ai.js` kini memanggil Edge Function (sebelumnya langsung ke api.anthropic.com tanpa kunci).
3. `vercel.json`: header keamanan + CSP. Uji dulu di Preview Vercel (login, dashboard, cetak).
4. File `url dan anon.txt` (berisi SERVICE ROLE KEY) tidak disertakan. Segera **rotasi service role key**
   di Supabase (Settings → API) karena sudah pernah berada di dalam zip.
5. File duplikat dihapus: `src/RKP.jsx`, `src/pages/Rkpperubahan.jsx`, file kosong `main`.
