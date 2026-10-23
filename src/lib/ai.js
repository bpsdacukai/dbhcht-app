// Panggil Claude AI lewat Supabase Edge Function "ai-proxy".
// API key Anthropic TIDAK pernah ada di browser — hanya tersimpan sebagai secret di server.
// Fungsi mewajibkan pengguna sudah login (verify_jwt = true), token dikirim otomatis oleh supabase-js.
import { supabase } from './supabase.js'

export async function callAI(prompt) {
  try {
    const { data, error } = await supabase.functions.invoke('ai-proxy', { body: { prompt } })
    if (error) throw error
    return data?.content?.[0]?.text || 'Tidak ada respons dari AI.'
  } catch {
    return 'Gagal terhubung ke layanan AI.'
  }
}

export async function analysisDashboard({ tahun, totalPagu, totalReal, pctReal, nOpd }) {
  return callAI(
    `Kamu adalah analis keuangan pemerintah daerah ahli DBH CHT (Dana Bagi Hasil Cukai Hasil Tembakau).
Berikan analisis singkat (4-5 kalimat) dalam bahasa Indonesia formal:
- Tahun Anggaran: ${tahun}
- Total Pagu: Rp ${fmt(totalPagu)}
- Total Realisasi: Rp ${fmt(totalReal)}
- Persentase Realisasi: ${pctReal.toFixed(1)}%
- Jumlah OPD Pengguna: ${nOpd}
Nilai capaian, identifikasi potensi masalah, dan berikan rekomendasi singkat.`
  )
}

export async function tindakLanjutAsistensi({ opd, program, hasil, catatan }) {
  return callAI(
    `Kamu adalah Sekretariat Tim Koordinasi DBH CHT. Berikan rekomendasi tindak lanjut spesifik dan actionable dalam 3-4 poin pendek, bahasa Indonesia formal:
OPD: ${opd}
Program: ${program}
Hasil Pembahasan: ${hasil}
Catatan: ${catatan}`
  )
}

export async function tindakLanjutRekonsiliasi({ opd, triwulan, pagu, realisasiKeu, realisasiFisik, permasalahan }) {
  const pct = pagu > 0 ? ((realisasiKeu / pagu) * 100).toFixed(1) : 0
  return callAI(
    `Kamu adalah analis keuangan daerah. Berikan rekomendasi tindak lanjut rekonsiliasi DBH CHT dalam 3-4 poin, bahasa Indonesia formal:
OPD: ${opd}
Triwulan: ${triwulan}
Realisasi Keuangan: ${pct}% (Rp ${fmt(realisasiKeu)} dari Rp ${fmt(pagu)})
Realisasi Fisik: ${realisasiFisik}%
Permasalahan: ${permasalahan}`
  )
}

function fmt(n) { return new Intl.NumberFormat('id-ID').format(Math.round(n || 0)) }
