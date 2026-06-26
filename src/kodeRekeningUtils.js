/**
 * kodeRekeningUtils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utility TERPUSAT untuk sinkronisasi kode rekening di seluruh menu SIMDBHCHT.
 * Import file ini di: RKP, Realisasi, Asistensi, Rekonsiliasi, Laporan, Cetak.
 *
 * MASALAH YANG DISELESAIKAN:
 *  1. Spasi tersembunyi di awal/akhir kode rekening
 *  2. Perbedaan uppercase/lowercase (meski jarang, untuk jaga-jaga)
 *  3. Lookup gagal karena format tidak konsisten saat match antar tabel
 *  4. Nama rekening kosong karena kode tidak ditemukan di constants.js
 *  5. Grouping di Laporan terpisah karena kode rekening "mirip tapi beda"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { KODE_REKENING_BY_BIDANG } from './constants';

// ── 1. FLATTEN semua kode rekening dari semua bidang ─────────────────────────

/**
 * Daftar flat semua kode rekening dari seluruh bidang.
 * Digunakan untuk lookup nama dari kode.
 * @type {Array<{kode: string, nama: string, bidang: string}>}
 */
export const ALL_KODE_REKENING = Object.entries(KODE_REKENING_BY_BIDANG).flatMap(
  ([bidang, items]) => items.map(item => ({ ...item, bidang }))
);

// ── 2. NORMALISASI kode rekening ──────────────────────────────────────────────

/**
 * Normalisasi string kode rekening.
 * - Trim spasi di awal/akhir
 * - Lowercase (untuk keamanan matching)
 * - Hapus spasi ganda di tengah
 *
 * @param {string} kode
 * @returns {string}
 *
 * @example
 *   normalizeKode('  1.02.02.2.02.0043 ') → '1.02.02.2.02.0043'
 *   normalizeKode('1.02.02.2.02.0043')    → '1.02.02.2.02.0043'
 */
export function normalizeKode(kode) {
  if (!kode) return '';
  return String(kode).trim().replace(/\s+/g, '').toLowerCase();
}

// ── 3. LOOKUP: Kode → Nama Rekening ──────────────────────────────────────────

/**
 * Cari nama rekening berdasarkan kode.
 * Match dilakukan setelah normalisasi kedua sisi.
 *
 * @param {string} kode
 * @returns {string} nama rekening, atau string kosong jika tidak ditemukan
 *
 * @example
 *   getNamaRekening('1.02.02.2.02.0043') → 'Pengelolaan Kawasan Tanpa Rokok'
 *   getNamaRekening('  1.02.02.2.02.0043 ') → 'Pengelolaan Kawasan Tanpa Rokok'
 *   getNamaRekening('TIDAK_ADA') → ''
 */
export function getNamaRekening(kode) {
  const normalKode = normalizeKode(kode);
  const found = ALL_KODE_REKENING.find(
    item => normalizeKode(item.kode) === normalKode
  );
  return found ? found.nama : '';
}

/**
 * Cari nama rekening berdasarkan kode, dengan fallback jika tidak ditemukan.
 *
 * @param {string} kode
 * @param {string} [fallback=''] - nilai jika kode tidak ditemukan
 * @returns {string}
 */
export function getNamaRekeningOrFallback(kode, fallback = '') {
  return getNamaRekening(kode) || fallback;
}

// ── 4. LOOKUP: Kode → Bidang ──────────────────────────────────────────────────

/**
 * Cari bidang (kesmas/kesehatan/hukum/koordinasi) dari kode rekening.
 *
 * @param {string} kode
 * @returns {string} bidang atau ''
 */
export function getBidangByKode(kode) {
  const normalKode = normalizeKode(kode);
  const found = ALL_KODE_REKENING.find(
    item => normalizeKode(item.kode) === normalKode
  );
  return found ? found.bidang : '';
}

// ── 5. MATCHING: Bandingkan dua kode rekening ─────────────────────────────────

/**
 * Cek apakah dua kode rekening sama (setelah normalisasi).
 * Gunakan ini di semua tempat yang selama ini pakai === langsung.
 *
 * @param {string} kodeA
 * @param {string} kodeB
 * @returns {boolean}
 *
 * @example
 *   // SEBELUM (rentan bug):
 *   item.kode_rekening === rkp.kode_rekening
 *
 *   // SESUDAH (aman):
 *   kodeMatch(item.kode_rekening, rkp.kode_rekening)
 */
export function kodeMatch(kodeA, kodeB) {
  return normalizeKode(kodeA) === normalizeKode(kodeB);
}

// ── 6. SANITASI: Pastikan kode yang disimpan ke DB sudah bersih ───────────────

/**
 * Sanitasi kode rekening sebelum disimpan ke Supabase.
 * Mengembalikan format canonical (trim, lowercase untuk normalisasi,
 * tapi dikembalikan ke format asli dari constants untuk konsistensi display).
 *
 * @param {string} kode - kode rekening yang akan disimpan
 * @returns {string} kode canonical dari constants, atau kode asli jika tidak ditemukan
 */
export function sanitizeKodeForDB(kode) {
  const normalKode = normalizeKode(kode);
  const found = ALL_KODE_REKENING.find(
    item => normalizeKode(item.kode) === normalKode
  );
  // Kembalikan kode dari constants (format bersih & konsisten)
  return found ? found.kode : kode.trim();
}

// ── 7. HELPER: Opsi dropdown kode rekening per bidang ────────────────────────

/**
 * Ambil daftar kode rekening untuk satu bidang, siap pakai sebagai opsi select.
 *
 * @param {'kesmas'|'kesehatan'|'hukum'|'koordinasi'} bidang
 * @returns {Array<{value: string, label: string}>}
 *
 * @example
 *   getKodeRekeningOptions('kesehatan')
 *   // → [{ value: '1.02.02.2.02.0043', label: '1.02.02.2.02.0043 — Pengelolaan Kawasan Tanpa Rokok' }, ...]
 */
export function getKodeRekeningOptions(bidang) {
  const items = KODE_REKENING_BY_BIDANG[bidang] ?? [];
  return items.map(item => ({
    value: item.kode,
    label: `${item.kode} — ${item.nama}`,
    nama: item.nama,
  }));
}

/**
 * Ambil semua kode rekening dari semua bidang sebagai opsi select.
 * Berguna untuk Sekretariat yang melihat semua OPD.
 *
 * @returns {Array<{value: string, label: string, bidang: string}>}
 */
export function getAllKodeRekeningOptions() {
  return ALL_KODE_REKENING.map(item => ({
    value: item.kode,
    label: `${item.kode} — ${item.nama}`,
    nama: item.nama,
    bidang: item.bidang,
  }));
}

// ── 8. HELPER: Enrich data dari DB dengan nama rekening ──────────────────────

/**
 * Enrich array data dari Supabase dengan menambahkan `nama_rekening`
 * dari constants.js berdasarkan `kode_rekening`.
 *
 * Berguna di Laporan dan Cetak agar nama rekening selalu sinkron
 * dengan constants.js, bukan bergantung pada nilai di DB.
 *
 * @param {Array<Object>} rows - data dari Supabase (harus punya field kode_rekening)
 * @param {string} [kodeField='kode_rekening'] - nama field kode di data
 * @returns {Array<Object>} data yang sudah dilengkapi nama_rekening
 *
 * @example
 *   const realisasi = await supabase.from('realisasi_dbhcht').select('*');
 *   const enriched = enrichWithNamaRekening(realisasi.data);
 *   // enriched[0].nama_rekening → 'Pengelolaan Kawasan Tanpa Rokok'
 */
export function enrichWithNamaRekening(rows, kodeField = 'kode_rekening') {
  return (rows ?? []).map(row => ({
    ...row,
    nama_rekening: getNamaRekeningOrFallback(
      row[kodeField],
      row.nama_rekening ?? '' // fallback ke nilai DB jika ada
    ),
  }));
}

// ── 9. HELPER: Group/merge data berdasarkan kode rekening (untuk Laporan) ────

/**
 * Group rows berdasarkan kode rekening yang sudah dinormalisasi.
 * Menggantikan grouping manual yang rentan perbedaan format.
 *
 * @param {Array<Object>} rows
 * @param {string} [kodeField='kode_rekening']
 * @returns {Map<string, Array<Object>>} Map dengan key = kode canonical
 */
export function groupByKodeRekening(rows, kodeField = 'kode_rekening') {
  const map = new Map();
  (rows ?? []).forEach(row => {
    const key = normalizeKode(row[kodeField]);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

// ── 10. VALIDASI: Cek kode rekening valid di constants ───────────────────────

/**
 * Cek apakah kode rekening terdaftar di constants.js.
 *
 * @param {string} kode
 * @returns {boolean}
 */
export function isKodeValid(kode) {
  return !!getNamaRekening(kode);
}

/**
 * Validasi array kode rekening, kembalikan yang tidak valid.
 *
 * @param {string[]} kodeList
 * @returns {string[]} kode yang tidak ditemukan di constants
 */
export function findInvalidKode(kodeList) {
  return kodeList.filter(kode => !isKodeValid(kode));
}
