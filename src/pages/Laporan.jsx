import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, fmtRp } from '../lib/constants.js'

// ── helpers ────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('id-ID').format(Math.round(n || 0))
const KOTA = 'Kota Batu'
const KODE_WILAYAH = '35.79.121'

// Format nomor BA asistensi: 027/001/HA-RKP/35.79.121/2026
function fmtNomorAsist(noBA, tanggal) {
  const tgl   = tanggal ? new Date(tanggal) : new Date()
  const tahun = tgl.getFullYear()
  const urut  = noBA ? String(noBA).padStart(3, '0') : '___'
  return `027/${urut}/HA-RKP/${KODE_WILAYAH}/${tahun}`
}

// Format nomor BA rekonsiliasi: 027/001/HA-Rekon/35.79.121/2026
function fmtNomorRekon(noBA, tanggal) {
  const tgl   = tanggal ? new Date(tanggal) : new Date()
  const tahun = tgl.getFullYear()
  const urut  = noBA ? String(noBA).padStart(3, '0') : '___'
  return `027/${urut}/HA-Rekon/${KODE_WILAYAH}/${tahun}`
}

function fmtHari(tgl) {
  if (!tgl) return '__________'
  return new Date(tgl).toLocaleDateString('id-ID', { weekday: 'long' })
}
function fmtTgl(tgl) {
  if (!tgl) return '__________ bulan __________ tahun __________'
  return new Date(tgl).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}
function getYear(tgl) {
  return tgl ? new Date(tgl).getFullYear() : new Date().getFullYear()
}

// ── shared print styles ────────────────────────────────────────
const S = {
  doc: {
    fontFamily: 'Arial, sans-serif', fontSize: '11px',
    lineHeight: 1.5, color: '#000', background: '#fff',
    padding: '24px 28px', maxWidth: 794, margin: '0 auto',
  },
  tbl: { width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: 8 },
  td:  { border: '1px solid #000', padding: '3px 6px', verticalAlign: 'top' },
  th:  { border: '1px solid #000', padding: '3px 6px', background: '#d9d9d9',
         fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' },
  bold: { fontWeight: 'bold' },
  center: { textAlign: 'center' },
  right:  { textAlign: 'right' },
}

// ── Tabel peserta (B. PELAKSANA) ───────────────────────────────
// Kolom: No | Nama | NIP  (bukan Jabatan)
function TabelPeserta({ judul, peserta }) {
  // hanya baris yang ada nama atau NIP
  const list = Array.isArray(peserta) ? peserta.filter(p => p.nama || p.jabatan) : []
  const rows = list.length > 0 ? list : [{ nama: '', jabatan: '' }]
  return (
    <>
      <div style={{ marginBottom: 2, fontSize: 11 }}>{judul}</div>
      <table style={{ ...S.tbl, marginBottom: 8 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 30 }}>No</th>
            <th style={S.th}>Nama</th>
            <th style={{ ...S.th, width: 140 }}>NIP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i}>
              <td style={{ ...S.td, ...S.center }}>{i + 1}</td>
              <td style={{ ...S.td, minHeight: 18 }}>{p.nama || ''}</td>
              {/* jabatan field dipakai untuk menyimpan NIP */}
              <td style={{ ...S.td, minHeight: 18 }}>{p.jabatan || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ── Tanda tangan — format TABEL sesuai lampiran format_kolom ──
// Kolom: No | Nama | NIP | OPD/Sekretariat | Tanda Tangan
// Semua peserta (Sekretariat + OPD) dalam SATU tabel
function TandaTangan({ ps, po, kota }) {
  const sekList = (ps || []).filter(p => p.nama)
  const opdList = (po || []).filter(p => p.nama)
  const all = [
    ...sekList.map(p => ({ nama: p.nama, nip: p.jabatan, unit: 'Sekretariat Tim Koordinasi' })),
    ...opdList.map(p => ({ nama: p.nama, nip: p.jabatan, unit: 'Perangkat Daerah' })),
  ]
  const rows = Math.max(all.length, 3)
  return (
    <div style={{ marginTop: 20, fontSize: 11 }}>
      <table style={{ ...S.tbl, marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 28 }}>No</th>
            <th style={S.th}>Nama</th>
            <th style={{ ...S.th, width: 115 }}>NIP</th>
            <th style={{ ...S.th, width: 150 }}>OPD / Sekretariat</th>
            <th style={{ ...S.th, width: 110 }}>Tanda Tangan</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => {
            const p = all[i] || {}
            return (
              <tr key={i}>
                <td style={{ ...S.td, ...S.center }}>{i + 1}</td>
                <td style={{ ...S.td, height: 34 }}>{p.nama || ''}</td>
                <td style={S.td}>{p.nip || ''}</td>
                <td style={S.td}>{p.unit || ''}</td>
                <td style={S.td}></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <div>Mengetahui,</div>
        <div>a.n. Ketua Tim Koordinasi Penggunaan DBH CHT</div>
        <div>{kota}</div>
        <div>Sekretaris</div>
        <div style={{ marginTop: 50 }}>(__________________________)</div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  HASIL ASISTENSI  —  data terisi penuh dari inputan
// ══════════════════════════════════════════════════════════════
export function CetakAistensi({ data, kabupaten = KOTA }) {
  if (!data) return null
  const ps    = Array.isArray(data.peserta_sekretariat) ? data.peserta_sekretariat : []
  const po    = Array.isArray(data.peserta_opd)         ? data.peserta_opd         : []
  const snap  = Array.isArray(data.rkp_snapshot)        ? data.rkp_snapshot        : []
  const tahun = getYear(data.tanggal)

  const bidangLabel = (() => {
    const b = [...BIDANG, KOORDINASI].find(x => x.id === data.bidang_id)
    return b ? b.label : (data.bidang_id || '')
  })()

  // Nomor otomatis dari nomor urut BA + tanggal
  const nomorDoc = fmtNomorAsist(data.nomor_ba, data.tanggal)

  // C. Hasil Asistensi — 7 poin
  // hasil_pembahasan → poin 1, catatan → poin 4, tindak lanjut KOSONG
  const hasilItems = [
    { no: 1, uraian: 'Kesesuaian bidang penggunaan DBH CHT',    catatan: data.hasil_pembahasan || '' },
    { no: 2, uraian: 'Kesesuaian indikator dan target',          catatan: '' },
    { no: 3, uraian: 'Kesesuaian komponen belanja',              catatan: '' },
    { no: 4, uraian: 'Kesesuaian dengan PMK terkait DBH CHT',   catatan: data.catatan || '' },
    { no: 5, uraian: 'Kelengkapan dokumen pendukung',            catatan: '' },
    { no: 6, uraian: 'Efisiensi dan efektivitas anggaran',       catatan: '' },
    { no: 7, uraian: 'Catatan lainnya',                          catatan: '' },
  ]

  return (
    <div style={S.doc}>
      {/* JUDUL */}
      <div style={{ textAlign: 'center', marginBottom: 14, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 'bold', fontSize: 13 }}>
          HASIL ASISTENSI RANCANGAN KEGIATAN DAN PENGANGGARAN
        </div>
        <div style={{ fontWeight: 'bold', fontSize: 13 }}>
          DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)
        </div>
        <div style={{ fontWeight: 'bold', fontSize: 13 }}>
          TAHUN ANGGARAN {tahun}
        </div>
        <div style={{ marginTop: 6 }}>
          Nomor : {nomorDoc}
        </div>
      </div>

      {/* PEMBUKAAN */}
      <p style={{ marginBottom: 12, textAlign: 'justify' }}>
        Pada hari ini <strong>{fmtHari(data.tanggal)}</strong> tanggal{' '}
        <strong>{fmtTgl(data.tanggal)}</strong>{' '}
        bertempat di <strong>{data.tempat || '____________________________'}</strong>,
        telah dilaksanakan asistensi Rancangan Kegiatan dan Penganggaran Dana Bagi Hasil Cukai Hasil
        Tembakau (RKP DBH CHT) antara Sekretariat Tim Koordinasi Penggunaan DBH CHT dengan perangkat
        daerah pengguna DBH CHT sebagai berikut:
      </p>

      {/* A. IDENTITAS */}
      <div style={{ ...S.bold, marginBottom: 4 }}>A. IDENTITAS PERANGKAT DAERAH</div>
      <table style={{ ...S.tbl, marginBottom: 12 }}>
        <tbody>
          {[
            [1, 'Nama Perangkat Daerah',    data.opd || ''],
            [2, 'Program',                   data.program || ''],
            [3, 'Kegiatan',                  data.kegiatan || ''],
            [4, 'Sub Kegiatan',              data.sub_kegiatan || ''],
            [5, 'Bidang Penggunaan DBH CHT', bidangLabel],
            [6, 'Pagu Anggaran Usulan',      'Rp. ' + fmt(data.pagu_usulan || 0)],
            [7, 'Sumber Pendanaan',          'DBH CHT Tahun Anggaran ' + tahun],
          ].map(([no, uraian, ket]) => (
            <tr key={no}>
              <td style={{ ...S.td, width: 28, ...S.center }}>{no}</td>
              <td style={{ ...S.td, width: 200 }}>{uraian}</td>
              <td style={S.td}>{ket}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Rincian RKP jika ada snapshot */}
      {snap.length > 0 && (
        <>
          <div style={{ marginBottom: 3, fontSize: 11, fontStyle: 'italic' }}>
            Rincian Kegiatan yang Diasistensikan:
          </div>
          <table style={{ ...S.tbl, marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 25 }}>No</th>
                <th style={S.th}>Program / Kegiatan / Sub Kegiatan</th>
                <th style={S.th}>Kode Rekening</th>
                <th style={{ ...S.th, width: 35 }}>Vol</th>
                <th style={{ ...S.th, width: 35 }}>Sat</th>
                <th style={{ ...S.th, width: 90 }}>Pagu Utama (Rp)</th>
                <th style={{ ...S.th, width: 75 }}>BOP (Rp)</th>
                <th style={{ ...S.th, width: 90 }}>Total (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {snap.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...S.td, ...S.center }}>{i + 1}</td>
                  <td style={S.td}>
                    <div style={S.bold}>{r.program}</div>
                    {r.kegiatan     && <div style={{ fontSize: 9 }}>{r.kegiatan}</div>}
                    {r.sub_kegiatan && <div style={{ fontSize: 9 }}>{r.sub_kegiatan}</div>}
                  </td>
                  <td style={{ ...S.td, fontSize: 9 }}>
                    <div>{r.kode_rekening || ''}</div>
                    {r.nama_rekening && <div style={{ fontSize: 8 }}>{r.nama_rekening}</div>}
                  </td>
                  <td style={{ ...S.td, ...S.center }}>{r.volume || ''}</td>
                  <td style={{ ...S.td, ...S.center }}>{r.satuan || ''}</td>
                  <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu || 0)}</td>
                  <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu_bop || 0)}</td>
                  <td style={{ ...S.td, ...S.right, ...S.bold }}>
                    {fmt((r.pagu || 0) + (r.pagu_bop || 0))}
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#f5f5f5' }}>
                <td colSpan={5} style={{ ...S.td, ...S.right, ...S.bold }}>JUMLAH</td>
                <td style={{ ...S.td, ...S.right, ...S.bold }}>
                  {fmt(snap.reduce((s, r) => s + (r.pagu || 0), 0))}
                </td>
                <td style={{ ...S.td, ...S.right, ...S.bold }}>
                  {fmt(snap.reduce((s, r) => s + (r.pagu_bop || 0), 0))}
                </td>
                <td style={{ ...S.td, ...S.right, ...S.bold }}>
                  {fmt(snap.reduce((s, r) => s + (r.pagu || 0) + (r.pagu_bop || 0), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* B. PELAKSANA — kolom NIP */}
      <div style={{ ...S.bold, marginBottom: 4 }}>B. PELAKSANA ASISTENSI</div>
      <TabelPeserta judul="1. Sekretariat Tim Koordinasi Penggunaan DBH CHT" peserta={ps} />
      <TabelPeserta judul="2. Perangkat Daerah Pengguna" peserta={po} />

      {/* C. HASIL ASISTENSI — 7 poin, tindak lanjut KOSONG */}
      <div style={{ ...S.bold, margin: '8px 0 4px' }}>C. HASIL ASISTENSI</div>
      <table style={{ ...S.tbl, marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 28 }}>No</th>
            <th style={S.th}>Uraian yang Diasistensikan</th>
            <th style={{ ...S.th, width: 210 }}>Hasil Pembahasan / Catatan</th>
            <th style={{ ...S.th, width: 130 }}>Tindak Lanjut</th>
          </tr>
        </thead>
        <tbody>
          {hasilItems.map(item => (
            <tr key={item.no}>
              <td style={{ ...S.td, ...S.center }}>{item.no}</td>
              <td style={S.td}>{item.uraian}</td>
              <td style={{ ...S.td, minHeight: 22 }}>{item.catatan}</td>
              {/* Tindak lanjut kosong — diisi manual */}
              <td style={{ ...S.td, minHeight: 22 }}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* D. KESIMPULAN */}
      <div style={{ ...S.bold, margin: '8px 0 4px' }}>D. KESIMPULAN</div>
      <p style={{ marginBottom: 6 }}>
        Berdasarkan hasil asistensi, Rancangan Kegiatan dan Penganggaran DBH CHT pada Perangkat
        Daerah <strong>{data.opd || '______________________________'}</strong>:
      </p>
      <div style={{ marginBottom: 8, paddingLeft: 4 }}>
        <div style={{ marginBottom: 4 }}>
          <span style={{ marginRight: 6, fontSize: 13 }}>
            {data.kesimpulan === 'dapat_ditindaklanjuti' ? '☑' : '☐'}
          </span>
          Dapat ditindaklanjuti pada tahapan penganggaran berikutnya.
        </div>
        <div>
          <span style={{ marginRight: 6, fontSize: 13 }}>
            {data.kesimpulan === 'perlu_perbaikan' ? '☑' : '☐'}
          </span>
          Perlu dilakukan perbaikan/penyesuaian sebagaimana hasil asistensi.
        </div>
      </div>
      <p>Demikian Berita Acara Hasil Asistensi ini dibuat untuk digunakan sebagaimana mestinya.</p>

      {/* TANDA TANGAN */}
      <TandaTangan ps={ps} po={po} kota={kabupaten} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  HASIL REKONSILIASI  —  data terisi penuh dari inputan
// ══════════════════════════════════════════════════════════════
export function CetakRekonsiliasi({ data, kabupaten = KOTA }) {
  if (!data) return null
  const ps    = Array.isArray(data.peserta_sekretariat) ? data.peserta_sekretariat : []
  const po    = Array.isArray(data.peserta_opd)         ? data.peserta_opd         : []
  const snap  = Array.isArray(data.realisasi_snapshot)  ? data.realisasi_snapshot  : []
  const tahun = getYear(data.tanggal)
  const nomorDoc = fmtNomorRekon(data.nomor_ba, data.tanggal)

  return (
    <div style={S.doc}>
      {/* JUDUL */}
      <div style={{ textAlign: 'center', marginBottom: 14, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 'bold', fontSize: 13 }}>
          HASIL REKONSILIASI REALISASI KEGIATAN DAN ANGGARAN
        </div>
        <div style={{ fontWeight: 'bold', fontSize: 13 }}>
          PENGGUNAAN DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)
        </div>
        <div style={{ fontWeight: 'bold', fontSize: 13 }}>
          TRIWULAN {data.triwulan} TAHUN ANGGARAN {tahun}
        </div>
        <div style={{ marginTop: 6 }}>
          Nomor : {nomorDoc}
        </div>
      </div>

      {/* PEMBUKAAN */}
      <p style={{ marginBottom: 12, textAlign: 'justify' }}>
        Pada hari ini <strong>{fmtHari(data.tanggal)}</strong> tanggal{' '}
        <strong>{fmtTgl(data.tanggal)}</strong>{' '}
        bertempat di <strong>{data.tempat || '____________________________'}</strong>,
        telah dilaksanakan rekonsiliasi realisasi kegiatan dan anggaran penggunaan Dana Bagi Hasil
        Cukai Hasil Tembakau (DBH CHT) Triwulan <strong>{data.triwulan}</strong> Tahun Anggaran{' '}
        <strong>{tahun}</strong> antara Sekretariat Tim Koordinasi Penggunaan DBH CHT dengan
        Perangkat Daerah pengguna DBH CHT.
      </p>

      {/* A. IDENTITAS */}
      <div style={{ ...S.bold, marginBottom: 4 }}>A. IDENTITAS PERANGKAT DAERAH</div>
      <table style={{ ...S.tbl, marginBottom: 12 }}>
        <tbody>
          {[
            [1, 'Nama Perangkat Daerah',    data.opd || ''],
            [2, 'Program',                   data.program || ''],
            [3, 'Kegiatan',                  data.kegiatan || ''],
            [4, 'Sub Kegiatan',              ''],
            [5, 'Bidang Penggunaan DBH CHT', (() => {
              const b = [...BIDANG, KOORDINASI].find(x => x.id === data.bidang_id)
              return b ? b.label : ''
            })()],
            [6, 'Pagu Anggaran',             'Rp. ' + fmt(data.pagu || 0)],
            [7, 'Periode Rekonsiliasi',      'Triwulan ' + data.triwulan + ' Tahun ' + tahun],
          ].map(([no, uraian, ket]) => (
            <tr key={no}>
              <td style={{ ...S.td, width: 28, ...S.center }}>{no}</td>
              <td style={{ ...S.td, width: 200 }}>{uraian}</td>
              <td style={S.td}>{ket}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* B. PELAKSANA — kolom NIP */}
      <div style={{ ...S.bold, marginBottom: 4 }}>B. PELAKSANA REKONSILIASI</div>
      <TabelPeserta judul="1. Sekretariat Tim Koordinasi Penggunaan DBH CHT" peserta={ps} />
      <TabelPeserta judul="2. Perangkat Daerah Pengguna" peserta={po} />

      {/* C. HASIL REKONSILIASI */}
      <div style={{ ...S.bold, margin: '8px 0 4px' }}>C. HASIL REKONSILIASI REALISASI</div>
      <table style={{ ...S.tbl, marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 28 }}>No</th>
            <th style={S.th}>Uraian</th>
            <th style={{ ...S.th, width: 95 }}>Anggaran (Rp)</th>
            <th style={{ ...S.th, width: 95 }}>Realisasi Keuangan (Rp)</th>
            <th style={{ ...S.th, width: 58 }}>Realisasi Fisik (%)</th>
            <th style={{ ...S.th, width: 110 }}>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {/* Baris Program */}
          <tr>
            <td style={{ ...S.td, ...S.center }}>1</td>
            <td style={S.td}><strong>Program</strong><br />{data.program || ''}</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(data.pagu || 0)}</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(data.realisasi_keu || 0)}</td>
            <td style={{ ...S.td, ...S.center }}>{data.realisasi_fisik || 0}%</td>
            <td style={S.td}></td>
          </tr>
          {/* Baris Kegiatan */}
          <tr>
            <td style={{ ...S.td, ...S.center }}>2</td>
            <td style={S.td}><strong>Kegiatan</strong><br />{data.kegiatan || ''}</td>
            <td style={S.td}></td>
            <td style={S.td}></td>
            <td style={S.td}></td>
            <td style={S.td}></td>
          </tr>
          {/* Baris Sub Kegiatan */}
          <tr>
            <td style={{ ...S.td, ...S.center }}>3</td>
            <td style={S.td}><strong>Sub Kegiatan</strong><br />{data.sub_kegiatan || ''}</td>
            <td style={S.td}></td>
            <td style={S.td}></td>
            <td style={S.td}></td>
            <td style={S.td}></td>
          </tr>
          {/* Jika ada snapshot realisasi detail */}
          {snap.length > 0 && snap.map((r, i) => (
            <tr key={'snap-' + i}>
              <td style={{ ...S.td, ...S.center }}>{i + 4}</td>
              <td style={S.td}>{r.program}{r.kegiatan ? ' — ' + r.kegiatan : ''}</td>
              <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu || 0)}</td>
              <td style={{ ...S.td, ...S.right }}>{fmt(r.realisasi_keu || 0)}</td>
              <td style={{ ...S.td, ...S.center }}>{r.realisasi_fisik || 0}%</td>
              <td style={S.td}>{r.keterangan || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* D. PERMASALAHAN DAN TINDAK LANJUT */}
      <div style={{ ...S.bold, margin: '8px 0 4px' }}>D. PERMASALAHAN DAN TINDAK LANJUT</div>
      <table style={{ ...S.tbl, marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 28 }}>No</th>
            <th style={S.th}>Permasalahan/Hambatan</th>
            <th style={{ ...S.th, width: 155 }}>Tindak Lanjut</th>
            <th style={{ ...S.th, width: 110 }}>Penanggung Jawab</th>
            <th style={{ ...S.th, width: 90 }}>Target Penyelesaian</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...S.td, ...S.center }}>1</td>
            <td style={{ ...S.td, minHeight: 30 }}>{data.permasalahan || ''}</td>
            {/* Tindak lanjut KOSONG — diisi manual */}
            <td style={{ ...S.td, minHeight: 30 }}></td>
            <td style={{ ...S.td, minHeight: 30 }}>{data.penanggung_jawab || ''}</td>
            <td style={{ ...S.td, minHeight: 30 }}></td>
          </tr>
          <tr>
            <td style={{ ...S.td, ...S.center }}>2</td>
            <td style={{ ...S.td, height: 26 }}></td>
            <td style={{ ...S.td, height: 26 }}></td>
            <td style={{ ...S.td, height: 26 }}></td>
            <td style={{ ...S.td, height: 26 }}></td>
          </tr>
        </tbody>
      </table>

      {/* E. KESIMPULAN */}
      <div style={{ ...S.bold, margin: '8px 0 4px' }}>E. KESIMPULAN</div>
      <p style={{ marginBottom: 6 }}>
        Berdasarkan hasil rekonsiliasi Triwulan <strong>{data.triwulan}</strong> Tahun
        Anggaran <strong>{tahun}</strong>, realisasi penggunaan DBH CHT pada Perangkat Daerah{' '}
        <strong>{data.opd || '______________________________'}</strong> telah:
      </p>
      <div style={{ marginBottom: 8, paddingLeft: 4 }}>
        <div style={{ marginBottom: 4 }}>
          <span style={{ marginRight: 6, fontSize: 13 }}>
            {data.kesimpulan === 'sesuai' ? '☑' : '☐'}
          </span>
          Sesuai dengan ketentuan penggunaan DBH CHT.
        </div>
        <div>
          <span style={{ marginRight: 6, fontSize: 13 }}>
            {data.kesimpulan === 'perlu_perbaikan' ? '☑' : '☐'}
          </span>
          Memerlukan perbaikan dan tindak lanjut sebagaimana hasil rekonsiliasi.
        </div>
      </div>
      <p>Demikian Berita Acara Hasil Rekonsiliasi ini dibuat untuk digunakan sebagaimana mestinya.</p>

      {/* TANDA TANGAN */}
      <TandaTangan ps={ps} po={po} kota={kabupaten} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  REKAP ASISTENSI
// ══════════════════════════════════════════════════════════════
export function RekapAisistensi({ rows = [], tahun, kabupaten = KOTA }) {
  return (
    <div style={S.doc}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>REKAPITULASI HASIL ASISTENSI</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>RKP DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>TAHUN ANGGARAN {tahun}</div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>
      <table style={S.tbl}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 28 }}>No</th>
            <th style={S.th}>Nomor BA</th>
            <th style={S.th}>Tanggal</th>
            <th style={S.th}>OPD / Perangkat Daerah</th>
            <th style={S.th}>Program / Kegiatan</th>
            <th style={{ ...S.th, width: 90 }}>Pagu Usulan (Rp)</th>
            <th style={{ ...S.th, width: 80 }}>Kesimpulan</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} style={{ ...S.td, ...S.center, padding: 12 }}>Belum ada data</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td style={{ ...S.td, ...S.center }}>{i + 1}</td>
              <td style={{ ...S.td, fontSize: 9 }}>{fmtNomorAsist(r.nomor_ba, r.tanggal)}</td>
              <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{r.tanggal}</td>
              <td style={S.td}>{r.opd}</td>
              <td style={S.td}>
                <div>{r.program}</div>
                {r.kegiatan && <div style={{ fontSize: 9 }}>{r.kegiatan}</div>}
              </td>
              <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu_usulan || 0)}</td>
              <td style={{ ...S.td, ...S.center }}>
                {r.kesimpulan === 'dapat_ditindaklanjuti' ? '✓ Lanjut' : '⚠ Perbaikan'}
              </td>
            </tr>
          ))}
          <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
            <td colSpan={5} style={{ ...S.td, ...S.right }}>TOTAL</td>
            <td style={{ ...S.td, ...S.right }}>
              {fmt(rows.reduce((s, r) => s + (r.pagu_usulan || 0), 0))}
            </td>
            <td style={S.td} />
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: 9 }}>
        OPD diasistensikan: {rows.length} | Lanjut: {rows.filter(r => r.kesimpulan === 'dapat_ditindaklanjuti').length} | Perlu Perbaikan: {rows.filter(r => r.kesimpulan === 'perlu_perbaikan').length}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  REKAP REKONSILIASI
// ══════════════════════════════════════════════════════════════
export function RekapRekonsiliasi({ rows = [], tahun, triwulan, kabupaten = KOTA }) {
  const totalPagu = rows.reduce((s, r) => s + (r.pagu || 0), 0)
  const totalReal = rows.reduce((s, r) => s + (r.realisasi_keu || 0), 0)
  const pctReal   = totalPagu > 0 ? ((totalReal / totalPagu) * 100).toFixed(1) : '0.0'
  const avgFisik  = rows.length ? (rows.reduce((s, r) => s + (r.realisasi_fisik || 0), 0) / rows.length).toFixed(1) : '0.0'
  return (
    <div style={S.doc}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>REKAPITULASI HASIL REKONSILIASI REALISASI</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>PENGGUNAAN DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>
          {triwulan ? 'TRIWULAN ' + triwulan + ' ' : ''}TAHUN ANGGARAN {tahun}
        </div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>
      <table style={S.tbl}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 28 }}>No</th>
            <th style={S.th}>Nomor BA</th>
            <th style={S.th}>Tanggal</th>
            <th style={S.th}>OPD</th>
            <th style={S.th}>Program</th>
            <th style={{ ...S.th, width: 28 }}>Tw</th>
            <th style={{ ...S.th, width: 85 }}>Pagu (Rp)</th>
            <th style={{ ...S.th, width: 85 }}>Real. Keu (Rp)</th>
            <th style={{ ...S.th, width: 48 }}>% Keu</th>
            <th style={{ ...S.th, width: 48 }}>Fisik</th>
            <th style={{ ...S.th, width: 70 }}>Kesimpulan</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={11} style={{ ...S.td, ...S.center, padding: 12 }}>Belum ada data</td></tr>
          )}
          {rows.map((r, i) => {
            const pct = r.pagu > 0 ? ((r.realisasi_keu / r.pagu) * 100).toFixed(1) : '0.0'
            return (
              <tr key={r.id}>
                <td style={{ ...S.td, ...S.center }}>{i + 1}</td>
                <td style={{ ...S.td, fontSize: 9 }}>{fmtNomorRekon(r.nomor_ba, r.tanggal)}</td>
                <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{r.tanggal}</td>
                <td style={S.td}>{r.opd}</td>
                <td style={S.td}>{r.program}</td>
                <td style={{ ...S.td, ...S.center }}>{r.triwulan}</td>
                <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu || 0)}</td>
                <td style={{ ...S.td, ...S.right }}>{fmt(r.realisasi_keu || 0)}</td>
                <td style={{ ...S.td, ...S.center }}>{pct}%</td>
                <td style={{ ...S.td, ...S.center }}>{r.realisasi_fisik || 0}%</td>
                <td style={{ ...S.td, ...S.center }}>
                  {r.kesimpulan === 'sesuai' ? '✓ Sesuai' : '⚠ Perbaikan'}
                </td>
              </tr>
            )
          })}
          <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
            <td colSpan={6} style={{ ...S.td, ...S.right }}>TOTAL</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(totalPagu)}</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(totalReal)}</td>
            <td style={{ ...S.td, ...S.center }}>{pctReal}%</td>
            <td style={{ ...S.td, ...S.center }}>{avgFisik}%</td>
            <td style={S.td} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  CETAK RKP
// ══════════════════════════════════════════════════════════════
export function CetakRKP({ rows = [], tahun, jenis, kabupaten = KOTA }) {
  const koorRows   = rows.filter(r => r.is_koordinasi)
  const normalRows = rows.filter(r => !r.is_koordinasi)
  const byBidang   = {}
  BIDANG.forEach(b => { byBidang[b.id] = normalRows.filter(r => r.bidang_id === b.id) })
  const totalAll = rows.reduce((s, r) => s + (r.pagu || 0) + (r.pagu_bop || 0), 0)
  return (
    <div style={{ ...S.doc, maxWidth: 1050 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>RENCANA KEGIATAN DAN PENGANGGARAN (RKP)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>TAHUN ANGGARAN {tahun} — {jenis?.toUpperCase()}</div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>
      <table style={{ ...S.tbl, fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 28 }}>(1)<br />No.</th>
            <th style={S.th}>(2)<br />Bidang, Program, dan Kegiatan</th>
            <th style={S.th}>(3)<br />Rincian Kegiatan dalam Ketentuan Teknis</th>
            <th style={S.th}>(4)<br />Kode/Klasifikasi Nomenklatur dalam Penganggaran APBD</th>
            <th style={{ ...S.th, width: 38 }}>(5)<br />Vol</th>
            <th style={{ ...S.th, width: 38 }}>(6)<br />Sat</th>
            <th style={{ ...S.th, width: 85 }}>(7)<br />Pagu Kegiatan (Rp)</th>
            <th style={{ ...S.th, width: 72 }}>BOP ≤10% (Rp)</th>
            <th style={{ ...S.th, width: 85 }}>Total (Rp)</th>
            <th style={S.th}>(8)<br />Ket.</th>
          </tr>
        </thead>
        <tbody>
          {BIDANG.map((b, bi) => {
            const bRows  = byBidang[b.id] || []
            const bTotal = bRows.reduce((s, r) => s + (r.pagu || 0) + (r.pagu_bop || 0), 0)
            return [
              <tr key={'h-' + b.id} style={{ background: '#c6e0b4' }}>
                <td style={{ ...S.td, ...S.bold, ...S.center }}>{String.fromCharCode(65 + bi)}.</td>
                <td colSpan={9} style={{ ...S.td, ...S.bold }}>{b.label}</td>
              </tr>,
              ...bRows.map((r, ri) => (
                <tr key={r.id}>
                  <td style={{ ...S.td, ...S.center }}>{ri + 1}</td>
                  <td style={S.td}><div style={S.bold}>{r.program}</div>{r.kegiatan && <div>{r.kegiatan}</div>}</td>
                  <td style={S.td}>{r.sub_kegiatan || ''}</td>
                  <td style={S.td}><div>{r.kode_rekening || ''}</div>{r.nama_rekening && <div style={{ fontSize: 8 }}>{r.nama_rekening}</div>}</td>
                  <td style={{ ...S.td, ...S.center }}>{r.volume || ''}</td>
                  <td style={{ ...S.td, ...S.center }}>{r.satuan || ''}</td>
                  <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu || 0)}</td>
                  <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu_bop || 0)}</td>
                  <td style={{ ...S.td, ...S.right, ...S.bold }}>{fmt((r.pagu || 0) + (r.pagu_bop || 0))}</td>
                  <td style={S.td}>{r.keterangan || ''}</td>
                </tr>
              )),
              bRows.length === 0 ? (
                <tr key={'e-' + b.id}><td colSpan={10} style={{ ...S.td, ...S.center, color: '#999', fontStyle: 'italic' }}>—</td></tr>
              ) : null,
              <tr key={'t-' + b.id} style={{ background: '#e2efda', fontWeight: 'bold' }}>
                <td colSpan={8} style={{ ...S.td, ...S.right }}>Total {b.label}</td>
                <td style={{ ...S.td, ...S.right }}>{fmt(bTotal)}</td>
                <td style={S.td} />
              </tr>,
            ]
          })}
          {koorRows.length > 0 && [
            <tr key="h-koor" style={{ background: '#fce4d6' }}>
              <td style={{ ...S.td, ...S.bold, ...S.center }}>D.</td>
              <td colSpan={9} style={{ ...S.td, ...S.bold }}>Kegiatan Koordinasi Pengelolaan DBH CHT</td>
            </tr>,
            ...koorRows.map((r, ri) => (
              <tr key={r.id}>
                <td style={{ ...S.td, ...S.center }}>{ri + 1}</td>
                <td style={S.td}><div style={S.bold}>{r.program}</div>{r.kegiatan && <div>{r.kegiatan}</div>}</td>
                <td style={S.td}>{r.sub_kegiatan || ''}</td>
                <td style={S.td}><div>{r.kode_rekening || ''}</div>{r.nama_rekening && <div style={{ fontSize: 8 }}>{r.nama_rekening}</div>}</td>
                <td style={{ ...S.td, ...S.center }}>{r.volume || ''}</td>
                <td style={{ ...S.td, ...S.center }}>{r.satuan || ''}</td>
                <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu || 0)}</td>
                <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu_bop || 0)}</td>
                <td style={{ ...S.td, ...S.right, ...S.bold }}>{fmt((r.pagu || 0) + (r.pagu_bop || 0))}</td>
                <td style={S.td}>{r.keterangan || ''}</td>
              </tr>
            )),
            <tr key="t-koor" style={{ background: '#fce4d6', fontWeight: 'bold' }}>
              <td colSpan={8} style={{ ...S.td, ...S.right }}>Total Kegiatan Koordinasi Pengelolaan DBH CHT</td>
              <td style={{ ...S.td, ...S.right }}>{fmt(koorRows.reduce((s, r) => s + (r.pagu || 0) + (r.pagu_bop || 0), 0))}</td>
              <td style={S.td} />
            </tr>,
          ]}
          <tr style={{ background: '#a9d18e', fontWeight: 'bold', fontSize: 10 }}>
            <td colSpan={8} style={{ ...S.td, ...S.right }}>TOTAL</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(totalAll)}</td>
            <td style={S.td} />
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: 9, fontStyle: 'italic' }}>
        *Biaya operasional pendukung (BOP) maksimal sebesar 10% dari masing-masing kegiatan
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  LAPORAN REALISASI  (triwulan, semester I, semester II)
// ══════════════════════════════════════════════════════════════
export function CetakRealisasi({ rows = [], tahun, label, kabupaten = KOTA }) {
  const koorRows   = rows.filter(r => r.is_koordinasi)
  const normalRows = rows.filter(r => !r.is_koordinasi)
  const byBidang   = {}
  BIDANG.forEach(b => { byBidang[b.id] = normalRows.filter(r => r.bidang_id === b.id) })
  const totalPagu = rows.reduce((s, r) => s + (r.pagu || 0), 0)
  const totalReal = rows.reduce((s, r) => s + (r.realisasi_keu || 0), 0)
  return (
    <div style={{ ...S.doc, maxWidth: 1100 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>LAPORAN REALISASI PENGGUNAAN</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>{label} TAHUN ANGGARAN {tahun}</div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>
      <table style={{ ...S.tbl, fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 28 }}>(1)<br />No</th>
            <th style={S.th}>(2)<br />Bidang, Program, dan Kegiatan</th>
            <th style={S.th}>(3)<br />Rincian Kegiatan dalam Ketentuan Teknis</th>
            <th style={S.th}>(4)<br />Kode/Klasifikasi Nomenklatur dalam Penganggaran APBD</th>
            <th style={{ ...S.th, width: 35 }}>(5)<br />Vol</th>
            <th style={{ ...S.th, width: 35 }}>(6)<br />Sat</th>
            <th style={{ ...S.th, width: 82 }}>(7)<br />Pagu Kegiatan (Rp)</th>
            <th style={{ ...S.th, width: 72 }}>(8)<br />Rencana Output</th>
            <th style={{ ...S.th, width: 82 }}>(9)<br />Realisasi Dana (Rp)</th>
            <th style={{ ...S.th, width: 55 }}>(10)<br />Realisasi Fisik (%)</th>
            <th style={S.th}>Ket</th>
          </tr>
        </thead>
        <tbody>
          {BIDANG.map((b, bi) => {
            const bRows  = byBidang[b.id] || []
            const bPagu  = bRows.reduce((s, r) => s + (r.pagu || 0), 0)
            const bReal  = bRows.reduce((s, r) => s + (r.realisasi_keu || 0), 0)
            return [
              <tr key={'h-' + b.id} style={{ background: '#c6e0b4' }}>
                <td style={{ ...S.td, ...S.bold, ...S.center }}>{String.fromCharCode(65 + bi)}.</td>
                <td colSpan={10} style={{ ...S.td, ...S.bold }}>{b.label}</td>
              </tr>,
              ...bRows.map((r, ri) => (
                <tr key={r.id}>
                  <td style={{ ...S.td, ...S.center }}>{ri + 1}</td>
                  <td style={S.td}><div style={S.bold}>{r.program}</div>{r.kegiatan && <div>{r.kegiatan}</div>}</td>
                  <td style={S.td}>{r.sub_kegiatan || ''}</td>
                  <td style={S.td}>{r.kode_rekening || ''}</td>
                  <td style={{ ...S.td, ...S.center }}>{r.volume || ''}</td>
                  <td style={{ ...S.td, ...S.center }}>{r.satuan || ''}</td>
                  <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu || 0)}</td>
                  <td style={S.td}>{r.target_output || r.capaian_output || ''}</td>
                  <td style={{ ...S.td, ...S.right, ...S.bold }}>{fmt(r.realisasi_keu || 0)}</td>
                  <td style={{ ...S.td, ...S.center }}>{r.realisasi_fisik || 0}%</td>
                  <td style={S.td}>{r.keterangan || ''}</td>
                </tr>
              )),
              bRows.length === 0 ? (
                <tr key={'e-' + b.id}><td colSpan={11} style={{ ...S.td, ...S.center, color: '#999', fontStyle: 'italic' }}>—</td></tr>
              ) : null,
              <tr key={'t-' + b.id} style={{ background: '#e2efda', fontWeight: 'bold' }}>
                <td colSpan={6} style={{ ...S.td, ...S.right }}>Total {b.label}</td>
                <td style={{ ...S.td, ...S.right }}>{fmt(bPagu)}</td>
                <td style={S.td} />
                <td style={{ ...S.td, ...S.right }}>{fmt(bReal)}</td>
                <td style={{ ...S.td, ...S.center }}>{bPagu > 0 ? ((bReal / bPagu) * 100).toFixed(1) : '0.0'}%</td>
                <td style={S.td} />
              </tr>,
            ]
          })}
          {koorRows.length > 0 && [
            <tr key="h-koor" style={{ background: '#fce4d6' }}>
              <td style={{ ...S.td, ...S.bold, ...S.center }}>D.</td>
              <td colSpan={10} style={{ ...S.td, ...S.bold }}>Kegiatan Koordinasi Pengelolaan DBH CHT</td>
            </tr>,
            ...koorRows.map((r, ri) => (
              <tr key={r.id}>
                <td style={{ ...S.td, ...S.center }}>{ri + 1}</td>
                <td style={S.td}><div style={S.bold}>{r.program}</div>{r.kegiatan && <div>{r.kegiatan}</div>}</td>
                <td style={S.td}>{r.sub_kegiatan || ''}</td>
                <td style={S.td}>{r.kode_rekening || ''}</td>
                <td style={{ ...S.td, ...S.center }}>{r.volume || ''}</td>
                <td style={{ ...S.td, ...S.center }}>{r.satuan || ''}</td>
                <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu || 0)}</td>
                <td style={S.td}>{r.target_output || r.capaian_output || ''}</td>
                <td style={{ ...S.td, ...S.right, ...S.bold }}>{fmt(r.realisasi_keu || 0)}</td>
                <td style={{ ...S.td, ...S.center }}>{r.realisasi_fisik || 0}%</td>
                <td style={S.td}>{r.keterangan || ''}</td>
              </tr>
            )),
          ]}
          <tr style={{ background: '#a9d18e', fontWeight: 'bold', fontSize: 10 }}>
            <td colSpan={6} style={{ ...S.td, ...S.right }}>TOTAL</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(totalPagu)}</td>
            <td style={S.td} />
            <td style={{ ...S.td, ...S.right }}>{fmt(totalReal)}</td>
            <td style={{ ...S.td, ...S.center }}>
              {totalPagu > 0 ? ((totalReal / totalPagu) * 100).toFixed(1) : '0.0'}%
            </td>
            <td style={S.td} />
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: 9, fontStyle: 'italic' }}>
        *Biaya operasional pendukung (BOP) maksimal sebesar 10% dari masing-masing kegiatan
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  HALAMAN LAPORAN UTAMA
// ══════════════════════════════════════════════════════════════

// Cetak dokumen: render ke div overlay → tombol cetak mencetak HANYA div tersebut
// Menggunakan createPortal + @media print isolation per elemen

// Inject style cetak SEKALI ke head — hanya mencetak #simdbh-doc-area
function ensurePrintStyle() {
  if (document.getElementById('sdb-ps')) return
  const s = document.createElement('style')
  s.id = 'sdb-ps'
  s.textContent = [
    '@media print {',
    '  body { margin: 0 !important; }',
    '  body > *:not([data-simdbh-print]) { display: none !important; visibility: hidden !important; }',
    '  [data-simdbh-print] { display: block !important; visibility: visible !important; position: static !important; }',
    '  [data-simdbh-print] .no-print-inner { display: none !important; }',
    '}',
    '@page { size: A4; margin: 15mm 12mm; }',
  ].join('\n')
  document.head.appendChild(s)
}

// PrintPortal: overlay di layar, cetak HANYA area dokumen
function PrintPortal({ children, onClose, title }) {
  const [printEl] = useState(() => {
    ensurePrintStyle()
    const el = document.createElement('div')
    el.setAttribute('data-simdbh-print', '1')
    el.style.cssText = 'display:none;position:absolute;top:0;left:0;width:100%;background:#fff;z-index:0;'
    document.body.appendChild(el)
    return el
  })

  useEffect(() => {
    return () => {
      if (printEl && document.body.contains(printEl)) {
        document.body.removeChild(printEl)
      }
    }
  }, [])

  function doPrint() {
    // Tampilkan div cetak, sembunyikan semua yang lain via @media print
    printEl.style.display = 'block'
    window.print()
    // Setelah dialog cetak ditutup, sembunyikan lagi
    setTimeout(() => { printEl.style.display = 'none' }, 500)
  }

  return (
    <>
      {/* Overlay di layar (tidak tercetak karena body>* disembunyikan kecuali data-simdbh-print) */}
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)',
        zIndex: 600, display: 'flex', flexDirection: 'column',
      }}>
        {/* Toolbar */}
        <div style={{
          background: '#1a3a1c', color: '#fff', padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</span>
          <div style={{ flex: 1 }} />
          <button onClick={doPrint}
            style={{ background: '#52b788', color: '#fff', border: 'none', padding: '8px 22px', borderRadius: 5, cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>
            🖨️ Cetak
          </button>
          <button onClick={onClose}
            style={{ background: 'transparent', color: '#ccc', border: '1px solid #3a5a3c', padding: '8px 14px', borderRadius: 5, cursor: 'pointer' }}>
            ✕ Tutup
          </button>
        </div>
        {/* Preview dokumen di layar */}
        <div style={{ flex: 1, overflow: 'auto', background: '#c8c8c8', padding: '1.5rem' }}>
          <div style={{ background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,.35)', display: 'inline-block', minWidth: 500, maxWidth: 820 }}>
            {children}
          </div>
        </div>
      </div>
      {/* Portal ke div cetak — ini yang tercetak */}
      {createPortal(
        <div className="no-print-inner">{children}</div>,
        printEl
      )}
    </>
  )
}

// Gabungkan realisasi — jika satu OPD punya data di beberapa triwulan,
// jumlahkan realisasi_keu dan rata-rata realisasi_fisik
function mergeRealisasi(rows) {
  const map = {}
  for (const r of rows) {
    const key = r.bidang_id + '|' + r.program + '|' + r.kegiatan + '|' + r.sub_kegiatan + '|' + (r.is_koordinasi ? '1' : '0')
    if (!map[key]) {
      map[key] = { ...r, realisasi_keu: 0, realisasi_fisik: 0, _count: 0 }
    }
    map[key].realisasi_keu += (r.realisasi_keu || 0)
    map[key].realisasi_fisik += (r.realisasi_fisik || 0)
    map[key]._count++
  }
  return Object.values(map).map(r => ({
    ...r,
    realisasi_fisik: r._count > 0 ? (r.realisasi_fisik / r._count) : 0,
  }))
}

export default function Laporan() {
  
  const { tahun, jenis } = useApp()
  const { profile, isSekretariat } = useAuth()
  const [menu,      setMenu]     = useState('asistensi')
  const [asisRows,  setAsis]     = useState([])
  const [rekonRows, setRekon]    = useState([])
  const [rkpRows,   setRkp]      = useState([])
  const [realRows,  setReal]     = useState([])
  const [selBA,     setSelBA]    = useState(null)
  const [prevType,  setPrevType] = useState(null)
  const [twFilter,  setTwFilter] = useState('')

  useEffect(() => { loadAll() }, [tahun, jenis])

  async function loadAll() {
    const uid    = profile?.id
    const isSkrt = isSekretariat
    const [{ data: a }, { data: rk }, { data: rv }, { data: rl }] = await Promise.all([
      (() => { let q = supabase.from('asistensi_dbhcht').select('*').eq('tahun', tahun).order('tanggal'); if (!isSkrt && uid) q = q.eq('opd_user_id', uid); return q })(),
      (() => { let q = supabase.from('rekonsiliasi_dbhcht').select('*').eq('tahun', tahun).order('tanggal'); if (!isSkrt && uid) q = q.eq('opd_user_id', uid); return q })(),
      (() => { let q = supabase.from('rkp_dbhcht').select('*').eq('tahun', tahun).eq('jenis', jenis).order('bidang_id'); if (!isSkrt && uid) q = q.eq('created_by', uid); return q })(),
      (() => { let q = supabase.from('realisasi_dbhcht').select('*').eq('tahun', tahun).order('triwulan'); if (!isSkrt && uid) q = q.eq('created_by', uid); return q })(),
    ])
    setAsis(a || []); setRekon(rk || []); setRkp(rv || []); setReal(rl || [])
  }

  const rekonFiltered = twFilter ? rekonRows.filter(r => r.triwulan === twFilter) : rekonRows

  // Semester I = Triwulan I + II
  const realSem1 = mergeRealisasi(realRows.filter(r => ['I', 'II'].includes(r.triwulan)))
  // Semester II = Triwulan I + II + III + IV
  const realSem2 = mergeRealisasi(realRows)
  // Per triwulan
  const realTw   = twFilter ? realRows.filter(r => r.triwulan === twFilter) : realRows

  const MENUS = [
    { id: 'asistensi',    label: '🤝 BA Asistensi',        count: asisRows.length },
    { id: 'rekap_asis',   label: '📋 Rekap Asistensi',     count: asisRows.length },
    { id: 'rekonsiliasi', label: '🔄 BA Rekonsiliasi',      count: rekonRows.length },
    { id: 'rekap_rekon',  label: '📋 Rekap Rekonsiliasi',   count: rekonRows.length },
    { id: 'rkp',          label: '📄 Cetak RKP',            count: rkpRows.length },
    { id: 'realisasi_tw', label: '📈 Real. Per Triwulan',   count: realRows.length },
    { id: 'realisasi_s1', label: '📊 Real. Semester I',     count: realSem1.length },
    { id: 'realisasi_s2', label: '📊 Real. Semester II',    count: realSem2.length },
  ]

  function openPreview(type, row) { setSelBA(row); setPrevType(type) }
  function closePreview()         { setSelBA(null); setPrevType(null) }

  return (
    <div>
      {/* Overlay preview cetak */}
      {selBA && prevType && (
        <PrintPortal
          title={prevType === 'asistensi' ? `🤝 Hasil Asistensi — ${selBA.opd}` : `🔄 Hasil Rekonsiliasi — ${selBA.opd}`}
          onClose={closePreview}>
          {prevType === 'asistensi'
            ? <CetakAistensi data={selBA} kabupaten={KOTA} />
            : <CetakRekonsiliasi data={selBA} kabupaten={KOTA} />}
        </PrintPortal>
      )}

      {/* Header halaman */}
      <div className="flex-between mb-2 no-print" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
        <div className="page-title" style={{ margin: 0 }}>🖨️ Laporan & Cetak Dokumen</div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <span className="chip">📍 {KOTA}</span>
        </div>
      </div>

      {/* Tabs menu */}
      <div className="tabs no-print" style={{ flexWrap: 'wrap' }}>
        {MENUS.map(m => (
          <div key={m.id} className={`tab ${menu === m.id ? 'active' : ''}`}
            onClick={() => { setMenu(m.id); setSelBA(null) }}>
            {m.label} <span style={{ fontSize: '.7rem', color: 'var(--text2)', marginLeft: 3 }}>({m.count})</span>
          </div>
        ))}
      </div>

      {/* Filter triwulan (hanya untuk rekonsiliasi dan realisasi triwulan) */}
      {(menu === 'rekonsiliasi' || menu === 'rekap_rekon' || menu === 'realisasi_tw') && (
        <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '.82rem', color: 'var(--text2)' }}>Filter Triwulan:</label>
          <select className="form-control" style={{ width: 160 }} value={twFilter} onChange={e => setTwFilter(e.target.value)}>
            <option value="">Semua Triwulan</option>
            {['I', 'II', 'III', 'IV'].map(t => <option key={t} value={t}>Triwulan {t}</option>)}
          </select>
        </div>
      )}

      {/* ── Konten ── */}

      {/* Daftar BA Asistensi */}
      {menu === 'asistensi' && (
        <div className="card">
          <div className="card-title">📋 Berita Acara Asistensi TA {tahun}</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th>Nomor BA</th><th>Tanggal</th><th>OPD</th><th>Program</th>
                <th>Pagu Usulan</th><th>Peserta</th><th>Kesimpulan</th>
                <th className="no-print">Aksi</th>
              </tr></thead>
              <tbody>
                {asisRows.length === 0 && <tr><td colSpan={8} className="empty-state">Belum ada data asistensi</td></tr>}
                {asisRows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontSize: '.78rem' }}>{fmtNomorAsist(r.nomor_ba, r.tanggal)}</td>
                    <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{r.tanggal}</td>
                    <td className="td-bold">{r.opd}</td>
                    <td style={{ fontSize: '.8rem' }}>{r.program}</td>
                    <td className="td-money">{fmtRp(r.pagu_usulan)}</td>
                    <td style={{ fontSize: '.75rem' }}>
                      {(r.peserta_sekretariat||[]).filter(p=>p.nama).length} Skrt +{' '}
                      {(r.peserta_opd||[]).filter(p=>p.nama).length} OPD
                    </td>
                    <td>
                      <span className={`badge ${r.kesimpulan === 'dapat_ditindaklanjuti' ? 'badge-green' : 'badge-amber'}`}>
                        {r.kesimpulan === 'dapat_ditindaklanjuti' ? '✅ Lanjut' : '⚠️ Perbaikan'}
                      </span>
                    </td>
                    <td className="no-print">
                      <button className="btn btn-primary btn-sm" onClick={() => openPreview('asistensi', r)}>
                        👁️ Lihat & Cetak
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rekap Asistensi */}
      {menu === 'rekap_asis' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem' }}>
            <button className="btn btn-primary" onClick={() => { document.body.classList.add('printing-doc'); window.print(); setTimeout(() => document.body.classList.remove('printing-doc'), 800) }}>🖨️ Cetak Rekap</button>
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <RekapAisistensi rows={asisRows} tahun={tahun} kabupaten={KOTA} />
          </div>
        </>
      )}

      {/* Daftar BA Rekonsiliasi */}
      {menu === 'rekonsiliasi' && (
        <div className="card">
          <div className="card-title">📋 Berita Acara Rekonsiliasi TA {tahun}</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th>Nomor BA</th><th>Tanggal</th><th>OPD</th><th>Tw</th>
                <th>Pagu</th><th>Real. Keu.</th><th>Fisik</th><th>Kesimpulan</th>
                <th className="no-print">Aksi</th>
              </tr></thead>
              <tbody>
                {rekonFiltered.length === 0 && <tr><td colSpan={9} className="empty-state">Belum ada data rekonsiliasi</td></tr>}
                {rekonFiltered.map(r => {
                  const pct = r.pagu > 0 ? ((r.realisasi_keu / r.pagu) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={r.id}>
                      <td style={{ fontSize: '.78rem' }}>{fmtNomorRekon(r.nomor_ba, r.tanggal)}</td>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>{r.tanggal}</td>
                      <td className="td-bold">{r.opd}</td>
                      <td><span className="badge badge-blue">Tw {r.triwulan}</span></td>
                      <td className="td-muted">{fmtRp(r.pagu)}</td>
                      <td className="td-money">{fmtRp(r.realisasi_keu)} <span style={{ fontSize: '.7rem', fontWeight: 400 }}>({pct}%)</span></td>
                      <td style={{ fontSize: '.78rem' }}>{r.realisasi_fisik}%</td>
                      <td>
                        <span className={`badge ${r.kesimpulan === 'sesuai' ? 'badge-green' : 'badge-amber'}`}>
                          {r.kesimpulan === 'sesuai' ? '✅ Sesuai' : '⚠️ Perbaikan'}
                        </span>
                      </td>
                      <td className="no-print">
                        <button className="btn btn-primary btn-sm" onClick={() => openPreview('rekonsiliasi', r)}>
                          👁️ Lihat & Cetak
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rekap Rekonsiliasi */}
      {menu === 'rekap_rekon' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem' }}>
            <button className="btn btn-primary" onClick={() => { document.body.classList.add('printing-doc'); window.print(); setTimeout(() => document.body.classList.remove('printing-doc'), 800) }}>🖨️ Cetak Rekap</button>
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <RekapRekonsiliasi rows={rekonFiltered} tahun={tahun} triwulan={twFilter} kabupaten={KOTA} />
          </div>
        </>
      )}

      {/* Cetak RKP */}
      {menu === 'rkp' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem' }}>
            <button className="btn btn-primary" onClick={() => { document.body.classList.add('printing-doc'); window.print(); setTimeout(() => document.body.classList.remove('printing-doc'), 800) }}>🖨️ Cetak RKP</button>
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <CetakRKP rows={rkpRows} tahun={tahun} jenis={jenis} kabupaten={KOTA} />
          </div>
        </>
      )}

      {/* Realisasi Per Triwulan */}
      {menu === 'realisasi_tw' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem' }}>
            <button className="btn btn-primary" onClick={() => { document.body.classList.add('printing-doc'); window.print(); setTimeout(() => document.body.classList.remove('printing-doc'), 800) }}>🖨️ Cetak Laporan</button>
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <CetakRealisasi rows={realTw} tahun={tahun}
              label={twFilter ? 'TRIWULAN ' + twFilter : 'SEMUA TRIWULAN'}
              kabupaten={KOTA} />
          </div>
        </>
      )}

      {/* Realisasi Semester I */}
      {menu === 'realisasi_s1' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => { document.body.classList.add('printing-doc'); window.print(); setTimeout(() => document.body.classList.remove('printing-doc'), 800) }}>🖨️ Cetak Laporan Semester I</button>
            <span className="chip">Triwulan I + II</span>
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <CetakRealisasi rows={realSem1} tahun={tahun} label="SEMESTER I (TRIWULAN I DAN II)" kabupaten={KOTA} />
          </div>
        </>
      )}

      {/* Realisasi Semester II */}
      {menu === 'realisasi_s2' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => { document.body.classList.add('printing-doc'); window.print(); setTimeout(() => document.body.classList.remove('printing-doc'), 800) }}>🖨️ Cetak Laporan Semester II</button>
            <span className="chip">Triwulan I + II + III + IV</span>
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <CetakRealisasi rows={realSem2} tahun={tahun} label="SEMESTER II / KUMULATIF (TRIWULAN I S.D. IV)" kabupaten={KOTA} />
          </div>
        </>
      )}
    </div>
  )
}
