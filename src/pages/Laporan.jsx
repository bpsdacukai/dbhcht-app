import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, fmtRp, fmtPct, today } from '../lib/constants.js'
import { Modal, ProgressBar, StatBox } from '../components/UI.jsx'
import { analysisDashboard } from '../lib/ai.js'

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
  tbl: { width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: 8, tableLayout: 'fixed' },
  td:  { border: '1px solid #000', padding: '3px 6px', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' },
  th:  { border: '1px solid #000', padding: '3px 6px', background: '#d9d9d9',
         fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' },
  bold: { fontWeight: 'bold' },
  center: { textAlign: 'center' },
  right:  { textAlign: 'right' },
}

// ── Tabel peserta (B. PELAKSANA) ───────────────────────────────
function TabelPeserta({ judul, peserta }) {
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
              <td style={{ ...S.td, minHeight: 18 }}>{p.jabatan || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ── Tanda tangan ──────────────────────────────────────────────
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
//  HASIL ASISTENSI
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

  const nomorDoc = fmtNomorAsist(data.nomor_ba, data.tanggal)

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

      <p style={{ marginBottom: 12, textAlign: 'justify' }}>
        Pada hari ini <strong>{fmtHari(data.tanggal)}</strong> tanggal{' '}
        <strong>{fmtTgl(data.tanggal)}</strong>{' '}
        bertempat di <strong>{data.tempat || '____________________________'}</strong>,
        telah dilaksanakan asistensi Rancangan Kegiatan dan Penganggaran Dana Bagi Hasil Cukai Hasil
        Tembakau (RKP DBH CHT) antara Sekretariat Tim Koordinasi Penggunaan DBH CHT dengan perangkat
        daerah pengguna DBH CHT sebagai berikut:
      </p>

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

      {snap.length > 0 && (
        <>
          <div style={{ marginBottom: 3, fontSize: 11, fontStyle: 'italic' }}>
            Rincian Kegiatan yang Diasistensikan:
          </div>
          <table style={{ ...S.tbl, marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: '4%' }}>No</th>
                <th style={{ ...S.th, width: '30%' }}>Program / Kegiatan / Sub Kegiatan</th>
                <th style={{ ...S.th, width: '18%' }}>Kode Rekening</th>
                <th style={{ ...S.th, width: '6%' }}>Vol</th>
                <th style={{ ...S.th, width: '6%' }}>Sat</th>
                <th style={{ ...S.th, width: '13%' }}>Pagu Utama (Rp)</th>
                <th style={{ ...S.th, width: '11%' }}>BOP (Rp)</th>
                <th style={{ ...S.th, width: '12%' }}>Total (Rp)</th>
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

      <div style={{ ...S.bold, marginBottom: 4 }}>B. PELAKSANA ASISTENSI</div>
      <TabelPeserta judul="1. Sekretariat Tim Koordinasi Penggunaan DBH CHT" peserta={ps} />
      <TabelPeserta judul="2. Perangkat Daerah Pengguna" peserta={po} />

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
              <td style={{ ...S.td, minHeight: 22 }}></td>
            </tr>
          ))}
        </tbody>
      </table>

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

      <TandaTangan ps={ps} po={po} kota={kabupaten} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  HASIL REKONSILIASI
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

      <p style={{ marginBottom: 12, textAlign: 'justify' }}>
        Pada hari ini <strong>{fmtHari(data.tanggal)}</strong> tanggal{' '}
        <strong>{fmtTgl(data.tanggal)}</strong>{' '}
        bertempat di <strong>{data.tempat || '____________________________'}</strong>,
        telah dilaksanakan rekonsiliasi realisasi kegiatan dan anggaran penggunaan Dana Bagi Hasil
        Cukai Hasil Tembakau (DBH CHT) Triwulan <strong>{data.triwulan}</strong> Tahun Anggaran{' '}
        <strong>{tahun}</strong> antara Sekretariat Tim Koordinasi Penggunaan DBH CHT dengan
        Perangkat Daerah pengguna DBH CHT.
      </p>

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

      <div style={{ ...S.bold, marginBottom: 4 }}>B. PELAKSANA REKONSILIASI</div>
      <TabelPeserta judul="1. Sekretariat Tim Koordinasi Penggunaan DBH CHT" peserta={ps} />
      <TabelPeserta judul="2. Perangkat Daerah Pengguna" peserta={po} />

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
          <tr>
            <td style={{ ...S.td, ...S.center }}>1</td>
            <td style={S.td}><strong>Program</strong><br />{data.program || ''}</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(data.pagu || 0)}</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(data.realisasi_keu || 0)}</td>
            <td style={{ ...S.td, ...S.center }}>{data.realisasi_fisik || 0}%</td>
            <td style={S.td}></td>
          </tr>
          <tr>
            <td style={{ ...S.td, ...S.center }}>2</td>
            <td style={S.td}><strong>Kegiatan</strong><br />{data.kegiatan || ''}</td>
            <td style={S.td}></td><td style={S.td}></td><td style={S.td}></td><td style={S.td}></td>
          </tr>
          <tr>
            <td style={{ ...S.td, ...S.center }}>3</td>
            <td style={S.td}><strong>Sub Kegiatan</strong><br />{data.sub_kegiatan || ''}</td>
            <td style={S.td}></td><td style={S.td}></td><td style={S.td}></td><td style={S.td}></td>
          </tr>
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
            <th style={{ ...S.th, width: '4%' }}>No</th>
            <th style={{ ...S.th, width: '14%' }}>Nomor BA</th>
            <th style={{ ...S.th, width: '9%' }}>Tanggal</th>
            <th style={{ ...S.th, width: '17%' }}>OPD / Perangkat Daerah</th>
            <th style={{ ...S.th, width: '32%' }}>Program / Kegiatan</th>
            <th style={{ ...S.th, width: '13%' }}>Pagu Usulan (Rp)</th>
            <th style={{ ...S.th, width: '11%' }}>Kesimpulan</th>
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
            <th style={{ ...S.th, width: '3%' }}>No</th>
            <th style={{ ...S.th, width: '13%' }}>Nomor BA</th>
            <th style={{ ...S.th, width: '8%' }}>Tanggal</th>
            <th style={{ ...S.th, width: '14%' }}>OPD</th>
            <th style={{ ...S.th, width: '18%' }}>Program</th>
            <th style={{ ...S.th, width: '4%' }}>Tw</th>
            <th style={{ ...S.th, width: '10%' }}>Pagu (Rp)</th>
            <th style={{ ...S.th, width: '10%' }}>Real. Keu (Rp)</th>
            <th style={{ ...S.th, width: '6%' }}>% Keu</th>
            <th style={{ ...S.th, width: '5%' }}>Fisik</th>
            <th style={{ ...S.th, width: '9%' }}>Kesimpulan</th>
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
//  RKP PERUBAHAN — gabungkan Semula (rkp_dbhcht/Murni) + Menjadi (rkp_perubahan_dbhcht)
//  (pure helper, tidak menyentuh/menulis data RKP Murni)
// ══════════════════════════════════════════════════════════════
export function buildBarisRkpPerubahan(murniRows = [], perubahanRows = []) {
  const perubahanByRkpId = new Map(perubahanRows.filter(p => p.rkp_id).map(p => [p.rkp_id, p]))
  const dariMurni = murniRows.map(m => {
    const p = perubahanByRkpId.get(m.id) || null
    const semulaPagu = m.pagu || 0, semulaBop = m.pagu_bop || 0
    const menjadiPagu = p ? (p.pagu_menjadi || 0) : semulaPagu
    const menjadiBop  = p ? (p.pagu_bop_menjadi || 0) : semulaBop
    return {
      id: p?.id || m.id,
      bidang_id: m.bidang_id, is_koordinasi: m.is_koordinasi,
      program: m.program, kegiatan: m.kegiatan, sub_kegiatan: m.sub_kegiatan,
      kode_rekening: m.kode_rekening, nama_rekening: m.nama_rekening,
      isBaru: false, keterangan: p?.keterangan || '',
      volumeSemula: m.volume, satuanSemula: m.satuan, paguSemula: semulaPagu, bopSemula: semulaBop,
      volumeMenjadi: p ? p.volume_menjadi : m.volume,
      satuanMenjadi: p ? (p.satuan_menjadi || m.satuan) : m.satuan,
      paguMenjadi: menjadiPagu, bopMenjadi: menjadiBop,
    }
  })
  const baruTanpaMurni = perubahanRows.filter(p => !p.rkp_id).map(p => ({
    id: p.id, bidang_id: p.bidang_id, is_koordinasi: p.is_koordinasi,
    program: p.program, kegiatan: p.kegiatan, sub_kegiatan: p.sub_kegiatan,
    kode_rekening: p.kode_rekening, nama_rekening: p.nama_rekening,
    isBaru: true, keterangan: p.keterangan || '',
    volumeSemula: null, satuanSemula: '', paguSemula: 0, bopSemula: 0,
    volumeMenjadi: p.volume_menjadi, satuanMenjadi: p.satuan_menjadi,
    paguMenjadi: p.pagu_menjadi || 0, bopMenjadi: p.pagu_bop_menjadi || 0,
  }))
  return [...dariMurni, ...baruTanpaMurni]
}

export function CetakRKPPerubahan({ rows = [], tahun, kabupaten = KOTA, paguAlokasi = 0, sisaSilpa = 0 }) {
  const koorRows   = rows.filter(r => r.is_koordinasi)
  const normalRows = rows.filter(r => !r.is_koordinasi)
  const byBidang   = {}
  BIDANG.forEach(b => { byBidang[b.id] = normalRows.filter(r => r.bidang_id === b.id) })
  const totalSemula  = rows.reduce((s, r) => s + (r.paguSemula || 0) + (r.bopSemula || 0), 0)
  const totalMenjadi = rows.reduce((s, r) => s + (r.paguMenjadi || 0) + (r.bopMenjadi || 0), 0)

  function BarisKegiatan(r, ri) {
    const semulaTotal  = (r.paguSemula || 0) + (r.bopSemula || 0)
    const menjadiTotal = (r.paguMenjadi || 0) + (r.bopMenjadi || 0)
    return (
      <tr key={r.id}>
        <td style={{ ...S.td, ...S.center }}>{ri + 1}</td>
        <td style={S.td}><div style={S.bold}>{r.program}</div>{r.kegiatan && <div>{r.kegiatan}{r.isBaru && <span style={{ fontStyle: 'italic' }}> (Kegiatan Baru)</span>}</div>}</td>
        <td style={S.td}>{r.sub_kegiatan || ''}</td>
        <td style={{ ...S.td, whiteSpace: 'normal', wordBreak: 'break-word' }}><div>{r.kode_rekening || ''}</div>{r.nama_rekening && <div style={{ fontSize: 8 }}>{r.nama_rekening}</div>}</td>
        {/* Semula */}
        <td style={{ ...S.td, ...S.center }}>{r.isBaru ? '—' : (r.volumeSemula || '')}</td>
        <td style={{ ...S.td, ...S.center }}>{r.isBaru ? '—' : (r.satuanSemula || '')}</td>
        <td style={{ ...S.td, ...S.right }}>{r.isBaru ? '—' : fmt(semulaTotal)}</td>
        {/* Menjadi */}
        <td style={{ ...S.td, ...S.center }}>{r.volumeMenjadi || ''}</td>
        <td style={{ ...S.td, ...S.center }}>{r.satuanMenjadi || ''}</td>
        <td style={{ ...S.td, ...S.right, ...S.bold }}>{fmt(menjadiTotal)}</td>
        <td style={{ ...S.td, whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.keterangan || ''}</td>
      </tr>
    )
  }

  return (
    <div style={{ ...S.doc, maxWidth: 1050 }}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>RANCANGAN KEGIATAN DAN PENGANGGARAN PERUBAHAN</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>TAHUN ANGGARAN {tahun}</div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>

      <table style={{ width: 320, fontSize: 10, marginBottom: 10 }}>
        <tbody>
          <tr><td style={{ padding: '1px 4px' }}>Pagu Alokasi DBH CHT</td><td style={{ padding: '1px 4px' }}>:</td><td style={{ padding: '1px 4px', textAlign: 'right' }}>Rp {fmt(paguAlokasi)}</td></tr>
          <tr><td style={{ padding: '1px 4px' }}>Sisa Pagu DBH CHT TA Sebelumnya yang dianggarkan</td><td style={{ padding: '1px 4px' }}>:</td><td style={{ padding: '1px 4px', textAlign: 'right' }}>Rp {fmt(sisaSilpa)}</td></tr>
          <tr style={{ fontWeight: 'bold', borderTop: '1px solid #000' }}><td style={{ padding: '1px 4px' }}>Total</td><td style={{ padding: '1px 4px' }}>:</td><td style={{ padding: '1px 4px', textAlign: 'right' }}>Rp {fmt(paguAlokasi + sisaSilpa)}</td></tr>
        </tbody>
      </table>

      <table style={{ ...S.tbl, fontSize: 8.5, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...S.th, width: '3%' }}>No.</th>
            <th rowSpan={2} style={{ ...S.th, width: '19%' }}>Bidang, Program, dan Kegiatan</th>
            <th rowSpan={2} style={{ ...S.th, width: '16%' }}>Rincian Kegiatan dalam Ketentuan Teknis</th>
            <th rowSpan={2} style={{ ...S.th, width: '17%', whiteSpace: 'normal' }}>Kode/Klasifikasi Nomenklatur dalam Penganggaran APBD</th>
            <th colSpan={3} style={S.th}>Semula</th>
            <th colSpan={3} style={S.th}>Menjadi</th>
            <th rowSpan={2} style={{ ...S.th, width: '11%', whiteSpace: 'normal' }}>Keterangan</th>
          </tr>
          <tr>
            <th style={{ ...S.th, width: '4%' }}>Vol</th>
            <th style={{ ...S.th, width: '4%' }}>Sat</th>
            <th style={{ ...S.th, width: '9%' }}>Pagu Kegiatan (Rp)</th>
            <th style={{ ...S.th, width: '4%' }}>Vol</th>
            <th style={{ ...S.th, width: '4%' }}>Sat</th>
            <th style={{ ...S.th, width: '9%' }}>Pagu Kegiatan (Rp)</th>
          </tr>
          <tr>
            <th style={S.th}>(1)</th>
            <th style={S.th}>(2)</th>
            <th style={S.th}>(3)</th>
            <th style={S.th}>(4)</th>
            <th style={S.th}>(5)</th>
            <th style={S.th}>(6)</th>
            <th style={S.th}>(7)</th>
            <th style={S.th}>(8)</th>
            <th style={S.th}>(9)</th>
            <th style={S.th}>(10)</th>
            <th style={S.th}>(11)</th>
          </tr>
        </thead>
        <tbody>
          {BIDANG.map((b, bi) => {
            const bRows = byBidang[b.id] || []
            const bSemula  = bRows.reduce((s, r) => s + (r.paguSemula || 0) + (r.bopSemula || 0), 0)
            const bMenjadi = bRows.reduce((s, r) => s + (r.paguMenjadi || 0) + (r.bopMenjadi || 0), 0)
            return [
              <tr key={'h-' + b.id} style={{ background: '#c6e0b4' }}>
                <td style={{ ...S.td, ...S.bold, ...S.center }}>{String.fromCharCode(65 + bi)}.</td>
                <td colSpan={10} style={{ ...S.td, ...S.bold }}>{b.label}</td>
              </tr>,
              ...bRows.map((r, ri) => BarisKegiatan(r, ri)),
              bRows.length === 0 ? (
                <tr key={'e-' + b.id}><td colSpan={11} style={{ ...S.td, ...S.center, color: '#999', fontStyle: 'italic' }}>—</td></tr>
              ) : null,
              <tr key={'t-' + b.id} style={{ background: '#e2efda', fontWeight: 'bold' }}>
                <td colSpan={6} style={{ ...S.td, ...S.right }}>Total {b.label}</td>
                <td style={{ ...S.td, ...S.right }}>{fmt(bSemula)}</td>
                <td colSpan={2} style={S.td} />
                <td style={{ ...S.td, ...S.right }}>{fmt(bMenjadi)}</td>
                <td style={S.td} />
              </tr>,
            ]
          })}
          {koorRows.length > 0 && [
            <tr key="h-koor" style={{ background: '#fce4d6' }}>
              <td style={{ ...S.td, ...S.bold, ...S.center }}>{String.fromCharCode(65 + BIDANG.length)}.</td>
              <td colSpan={10} style={{ ...S.td, ...S.bold }}>Kegiatan Koordinasi Pengelolaan DBH CHT</td>
            </tr>,
            ...koorRows.map((r, ri) => BarisKegiatan(r, ri)),
            <tr key="t-koor" style={{ background: '#fce4d6', fontWeight: 'bold' }}>
              <td colSpan={6} style={{ ...S.td, ...S.right }}>Total Kegiatan Koordinasi Pengelolaan DBH CHT</td>
              <td style={{ ...S.td, ...S.right }}>{fmt(koorRows.reduce((s, r) => s + (r.paguSemula || 0) + (r.bopSemula || 0), 0))}</td>
              <td colSpan={2} style={S.td} />
              <td style={{ ...S.td, ...S.right }}>{fmt(koorRows.reduce((s, r) => s + (r.paguMenjadi || 0) + (r.bopMenjadi || 0), 0))}</td>
              <td style={S.td} />
            </tr>,
          ]}
          <tr style={{ background: '#a9d18e', fontWeight: 'bold', fontSize: 9 }}>
            <td colSpan={6} style={{ ...S.td, ...S.right }}>TOTAL</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(totalSemula)}</td>
            <td colSpan={2} style={S.td} />
            <td style={{ ...S.td, ...S.right }}>{fmt(totalMenjadi)}</td>
            <td style={S.td} />
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: 9, fontStyle: 'italic' }}>
        *Biaya operasional pendukung (BOP) maksimal sebesar 10% dari masing-masing kegiatan. Kolom Semula bersumber dari RKP Murni TA {tahun}.
      </div>

      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
        <div style={{ textAlign: 'center', width: 220 }}>
          <div>Koordinator DBH CHT</div>
          <div>{kabupaten}</div>
          <div style={{ marginTop: 55 }}>(__________________________)</div>
          <div>NIP.</div>
        </div>
        <div style={{ textAlign: 'center', width: 220 }}>
          <div>Disetujui Oleh</div>
          <div>Gubernur/Bupati/Walikota …..</div>
          <div style={{ marginTop: 55 }}>(__________________________)</div>
        </div>
      </div>
    </div>
  )
}

// ── Tanda tangan fleksibel (Koordinator + Pejabat Penandatangan) ──
// Dipakai oleh dokumen yang menyediakan modal "Download PDF" untuk mengisi
// data penandatangan (lihat komponen ModalTtdPdf di halaman utama Laporan).
function TandaTanganFleksibel({ ttd, kabupaten = KOTA }) {
  const t = ttd || {}
  const tempat  = t.tempat  || kabupaten
  const tanggal = t.tanggal ? fmtTgl(t.tanggal) : '__________ bulan __________ tahun __________'
  return (
    <div style={{ marginTop: 30, fontSize: 11 }}>
      <div style={{ textAlign: 'right', marginBottom: 6 }}>
        {tempat}, {tanggal}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ textAlign: 'center', width: '46%' }}>
          <div>Koordinator DBH CHT</div>
          {t.jabatanKoordinator && <div>{t.jabatanKoordinator}</div>}
          <div>{kabupaten}</div>
          <div style={{ marginTop: 55 }}>(__________________________)</div>
          <div style={{ fontWeight: 'bold' }}>{t.namaKoordinator || ''}</div>
          <div>NIP. {t.nipKoordinator || ''}</div>
        </div>
        <div style={{ textAlign: 'center', width: '46%' }}>
          <div>{t.atasNama ? 'a.n. Koordinator DBH CHT' : '\u00A0'}</div>
          <div>{t.jabatanPenandatangan || 'Pejabat yang Berwenang'}</div>
          <div style={{ marginTop: 55 }}>(__________________________)</div>
          <div style={{ fontWeight: 'bold' }}>{t.namaPejabat || ''}</div>
          <div>NIP. {t.nipPejabat || ''}</div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  LAPORAN REALISASI
// ══════════════════════════════════════════════════════════════
export function CetakRealisasi({ rows = [], tahun, label, kabupaten = KOTA, ttd = null }) {
  const koorRows   = rows.filter(r => r.is_koordinasi)
  const normalRows = rows.filter(r => !r.is_koordinasi)
  const byBidang   = {}
  BIDANG.forEach(b => { byBidang[b.id] = normalRows.filter(r => r.bidang_id === b.id) })
  const totalPaguUtama = rows.reduce((s, r) => s + (r.pagu || 0), 0)
  const totalBop = rows.reduce((s, r) => s + (r.pagu_bop || 0), 0)
  const totalPagu = totalPaguUtama + totalBop
  const totalRealPagu = rows.reduce((s, r) => s + (r.realisasi_pagu_utama || 0), 0)
  const totalRealBop = rows.reduce((s, r) => s + (r.realisasi_bop || 0), 0)
  const totalReal = totalRealPagu + totalRealBop
  const totalSisa = totalPagu - totalReal
  return (
    <div style={{ ...S.doc, maxWidth: 1300 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>LAPORAN REALISASI PENGGUNAAN</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>{label} TAHUN ANGGARAN {tahun}</div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>
      <table style={{ ...S.tbl, fontSize: 8.5 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 24 }}>(1)<br />No</th>
            <th style={S.th}>(2)<br />Bidang, Program, dan Kegiatan</th>
            <th style={{ ...S.th, width: 38 }}>(3)<br />Vol.<br />Rencana</th>
            <th style={{ ...S.th, width: 60 }}>(4)<br />Pagu Utama (Rp)</th>
            <th style={{ ...S.th, width: 55 }}>(5)<br />BOP (Rp)</th>
            <th style={{ ...S.th, width: 40 }}>(6)<br />Real. Volume</th>
            <th style={{ ...S.th, width: 60 }}>(7)<br />Real. Pagu Utama (Rp)</th>
            <th style={{ ...S.th, width: 55 }}>(8)<br />Real. BOP (Rp)</th>
            <th style={{ ...S.th, width: 45 }}>(9)<br />Capaian (%)</th>
            <th style={{ ...S.th, width: 60 }}>(10)<br />Sisa Anggaran (Rp)</th>
            <th style={{ ...S.th, width: 40 }}>(11)<br />Real. Fisik (%)</th>
            <th style={S.th}>Ket</th>
          </tr>
        </thead>
        <tbody>
          {BIDANG.map((b, bi) => {
            const bRows = byBidang[b.id] || []
            const bPaguUtama = bRows.reduce((s, r) => s + (r.pagu || 0), 0)
            const bBop = bRows.reduce((s, r) => s + (r.pagu_bop || 0), 0)
            const bPagu = bPaguUtama + bBop
            const bRealPagu = bRows.reduce((s, r) => s + (r.realisasi_pagu_utama || 0), 0)
            const bRealBop = bRows.reduce((s, r) => s + (r.realisasi_bop || 0), 0)
            const bReal = bRealPagu + bRealBop
            const bSisa = bPagu - bReal
            return [
              <tr key={'h-' + b.id} style={{ background: '#c6e0b4' }}>
                <td style={{ ...S.td, ...S.bold, ...S.center }}>{String.fromCharCode(65 + bi)}.</td>
                <td colSpan={10} style={{ ...S.td, ...S.bold }}>{b.label}</td>
              </tr>,
              ...bRows.map((r, ri) => {
                const rPagu = (r.pagu || 0) + (r.pagu_bop || 0)
                const rReal = (r.realisasi_pagu_utama || 0) + (r.realisasi_bop || 0)
                const rPct  = rPagu > 0 ? (rReal / rPagu * 100) : 0
                const rSisa = rPagu - rReal
                return (
                  <tr key={r.id}>
                    <td style={{ ...S.td, ...S.center }}>{ri + 1}</td>
                    <td style={S.td}><div style={S.bold}>{r.program}</div>{r.kegiatan && <div>{r.kegiatan}</div>}</td>
                    <td style={{ ...S.td, ...S.center }}>{r.volume || ''} {r.satuan || ''}</td>
                    <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu || 0)}</td>
                    <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu_bop || 0)}</td>
                    <td style={{ ...S.td, ...S.center }}>{r.realisasi_volume || 0} {r.satuan || ''}</td>
                    <td style={{ ...S.td, ...S.right, ...S.bold }}>{fmt(r.realisasi_pagu_utama || 0)}</td>
                    <td style={{ ...S.td, ...S.right }}>{fmt(r.realisasi_bop || 0)}</td>
                    <td style={{ ...S.td, ...S.center }}>{rPct.toFixed(1)}%</td>
                    <td style={{ ...S.td, ...S.right, color: rSisa < 0 ? '#c00' : undefined }}>{fmt(rSisa)}</td>
                    <td style={{ ...S.td, ...S.center }}>{r.realisasi_fisik || 0}%</td>
                    <td style={S.td}>{r.keterangan || ''}</td>
                  </tr>
                )
              }),
              bRows.length === 0 ? (
                <tr key={'e-' + b.id}><td colSpan={11} style={{ ...S.td, ...S.center, color: '#999', fontStyle: 'italic' }}>—</td></tr>
              ) : null,
              <tr key={'t-' + b.id} style={{ background: '#e2efda', fontWeight: 'bold' }}>
                <td colSpan={2} style={{ ...S.td, ...S.right }}>Total {b.label}</td>
                <td style={S.td} />
                <td style={{ ...S.td, ...S.right }}>{fmt(bPaguUtama)}</td>
                <td style={{ ...S.td, ...S.right }}>{fmt(bBop)}</td>
                <td style={S.td} />
                <td style={{ ...S.td, ...S.right }}>{fmt(bRealPagu)}</td>
                <td style={{ ...S.td, ...S.right }}>{fmt(bRealBop)}</td>
                <td style={{ ...S.td, ...S.center }}>{bPagu > 0 ? (bReal / bPagu * 100).toFixed(1) : '0.0'}%</td>
                <td style={{ ...S.td, ...S.right, color: bSisa < 0 ? '#c00' : undefined }}>{fmt(bSisa)}</td>
                <td style={S.td} />
                <td style={S.td} />
              </tr>,
            ]
          })}
          {koorRows.length > 0 && [
            <tr key="h-koor" style={{ background: '#fce4d6' }}>
              <td style={{ ...S.td, ...S.bold, ...S.center }}>D.</td>
              <td colSpan={10} style={{ ...S.td, ...S.bold }}>Kegiatan Koordinasi Pengelolaan DBH CHT</td>
            </tr>,
            ...koorRows.map((r, ri) => {
              const rPagu = (r.pagu || 0) + (r.pagu_bop || 0)
              const rReal = (r.realisasi_pagu_utama || 0) + (r.realisasi_bop || 0)
              const rPct  = rPagu > 0 ? (rReal / rPagu * 100) : 0
              const rSisa = rPagu - rReal
              return (
                <tr key={r.id}>
                  <td style={{ ...S.td, ...S.center }}>{ri + 1}</td>
                  <td style={S.td}><div style={S.bold}>{r.program}</div>{r.kegiatan && <div>{r.kegiatan}</div>}</td>
                  <td style={{ ...S.td, ...S.center }}>{r.volume || ''} {r.satuan || ''}</td>
                  <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu || 0)}</td>
                  <td style={{ ...S.td, ...S.right }}>{fmt(r.pagu_bop || 0)}</td>
                  <td style={{ ...S.td, ...S.center }}>{r.realisasi_volume || 0} {r.satuan || ''}</td>
                  <td style={{ ...S.td, ...S.right, ...S.bold }}>{fmt(r.realisasi_pagu_utama || 0)}</td>
                  <td style={{ ...S.td, ...S.right }}>{fmt(r.realisasi_bop || 0)}</td>
                  <td style={{ ...S.td, ...S.center }}>{rPct.toFixed(1)}%</td>
                  <td style={{ ...S.td, ...S.right, color: rSisa < 0 ? '#c00' : undefined }}>{fmt(rSisa)}</td>
                  <td style={{ ...S.td, ...S.center }}>{r.realisasi_fisik || 0}%</td>
                  <td style={S.td}>{r.keterangan || ''}</td>
                </tr>
              )
            }),
          ]}
          <tr style={{ background: '#a9d18e', fontWeight: 'bold', fontSize: 10 }}>
            <td colSpan={2} style={{ ...S.td, ...S.right }}>TOTAL</td>
            <td style={S.td} />
            <td style={{ ...S.td, ...S.right }}>{fmt(totalPaguUtama)}</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(totalBop)}</td>
            <td style={S.td} />
            <td style={{ ...S.td, ...S.right }}>{fmt(totalRealPagu)}</td>
            <td style={{ ...S.td, ...S.right }}>{fmt(totalRealBop)}</td>
            <td style={{ ...S.td, ...S.center }}>
              {totalPagu > 0 ? (totalReal / totalPagu * 100).toFixed(1) : '0.0'}%
            </td>
            <td style={{ ...S.td, ...S.right, color: totalSisa < 0 ? '#c00' : undefined }}>{fmt(totalSisa)}</td>
            <td style={S.td} />
            <td style={S.td} />
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: 9, fontStyle: 'italic' }}>
        *Biaya operasional pendukung (BOP) maksimal sebesar 10% dari masing-masing kegiatan. Sisa Anggaran = (Pagu Utama + BOP) − (Realisasi Pagu Utama + Realisasi BOP).
      </div>
      <TandaTanganFleksibel ttd={ttd} kabupaten={kabupaten} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  PRINT INFRASTRUCTURE
// ══════════════════════════════════════════════════════════════
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
  ].join('\n')
  document.head.appendChild(s)
}

// Set orientasi kertas (portrait/landscape) sebelum window.print() dipanggil.
// Menyuntik/mengganti isi <style id="sdb-page-orient"> — ukuran A4 & margin
// 1,25cm tetap sama, cuma orientasinya yang berubah.
function setPageOrientation(orientasi = 'portrait') {
  let el = document.getElementById('sdb-page-orient')
  if (!el) {
    el = document.createElement('style')
    el.id = 'sdb-page-orient'
    document.head.appendChild(el)
  }
  el.textContent = `@page { size: A4 ${orientasi}; margin: 1.25cm; }`
}

// Kontrol Portrait/Landscape mirip pengaturan printer, dipasang di sebelah
// tiap tombol Cetak.
function OrientToggle({ value, onChange }) {
  const opt = (v, label, icon) => (
    <button type="button" className="no-print"
      onClick={() => onChange(v)}
      style={{
        display: 'flex', alignItems: 'center', gap: '.3rem',
        padding: '5px 10px', fontSize: '.75rem', borderRadius: 5, cursor: 'pointer',
        border: '1px solid ' + (value === v ? 'var(--accent)' : 'var(--border)'),
        background: value === v ? 'var(--accent)' : 'transparent',
        color: value === v ? '#fff' : 'var(--text2)', fontWeight: value === v ? 700 : 400,
      }}>
      {icon} {label}
    </button>
  )
  return (
    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
      <span style={{ fontSize: '.72rem', color: 'var(--text2)', marginRight: '.15rem' }}>Orientasi:</span>
      {opt('portrait', 'Portrait', '📄')}
      {opt('landscape', 'Landscape', '📃')}
    </div>
  )
}

function PrintPortal({ children, onClose, title }) {
  const [orientasi, setOrientasi] = useState('portrait')
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
    setPageOrientation(orientasi)
    printEl.style.display = 'block'
    window.print()
    setTimeout(() => { printEl.style.display = 'none' }, 500)
  }

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)',
        zIndex: 600, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          background: '#1a3a1c', color: '#fff', padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0, flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</span>
          <div style={{ flex: 1 }} />
          <OrientToggle value={orientasi} onChange={setOrientasi} />
          <button onClick={doPrint}
            style={{ background: '#52b788', color: '#fff', border: 'none', padding: '8px 22px', borderRadius: 5, cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>
            🖨️ Cetak
          </button>
          <button onClick={onClose}
            style={{ background: 'transparent', color: '#ccc', border: '1px solid #3a5a3c', padding: '8px 14px', borderRadius: 5, cursor: 'pointer' }}>
            ✕ Tutup
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#c8c8c8', padding: '1.5rem' }}>
          <div style={{ background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,.35)', display: 'inline-block', minWidth: 500, maxWidth: 820 }}>
            {children}
          </div>
        </div>
      </div>
      {createPortal(
        <div className="no-print-inner">{children}</div>,
        printEl
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════
//  MERGE REALISASI
// ══════════════════════════════════════════════════════════════
function mergeRealisasi(rows, rkpMap = {}) {
  const map = {}
  for (const r of rows) {
    const key = r.bidang_id + '|' + r.program + '|' + r.kegiatan + '|' + r.sub_kegiatan + '|' + (r.is_koordinasi ? '1' : '0') + '|' + (r.created_by || '')
    if (!map[key]) {
      // Ambil pagu & volume dari tabel RKP jika ada rkp_id (sumber kebenaran)
      const rkp = r.rkp_id ? rkpMap[r.rkp_id] : null
      map[key] = {
        ...r,
        pagu:     rkp ? (rkp.pagu     || 0) : (r.pagu     || 0),
        pagu_bop: rkp ? (rkp.pagu_bop || 0) : (r.pagu_bop || 0),
        volume:   rkp ? (rkp.volume   || '') : (r.volume   || ''),
        satuan:   rkp ? (rkp.satuan   || '') : (r.satuan   || ''),
        realisasi_volume: 0, realisasi_pagu_utama: 0, realisasi_bop: 0,
        realisasi_fisik: 0, _count: 0,
      }
    }
    map[key].realisasi_volume     += (r.realisasi_volume || 0)
    map[key].realisasi_pagu_utama += (r.realisasi_pagu_utama || 0)
    map[key].realisasi_bop        += (r.realisasi_bop || 0)
    map[key].realisasi_fisik      += (r.realisasi_fisik || 0)
    map[key]._count++
  }
  return Object.values(map).map(r => {
    const paguT = (r.pagu || 0) + (r.pagu_bop || 0)
    const realT = (r.realisasi_pagu_utama || 0) + (r.realisasi_bop || 0)
    return {
      ...r,
      realisasi_fisik: r._count > 0 ? (r.realisasi_fisik / r._count) : 0,
      capaian_pct: paguT > 0 ? (realT / paguT * 100) : 0,
      sisa_anggaran: paguT - realT,
    }
  })
}

// ══════════════════════════════════════════════════════════════
//  SLIDE PRESENTASI — Laporan Pelaksanaan Penggunaan DBH CHT
// ══════════════════════════════════════════════════════════════
// Menghitung ulang agregat pagu/realisasi dengan pola YANG SAMA seperti
// Dashboard.jsx (realKeu, realPagu via join rkp_id) supaya angka di slide
// selalu konsisten dengan Dashboard & tabel Cetak lainnya — satu sumber
// kebenaran, tidak ada rumus baru yang berisiko beda hasil.
function SlidePresentasi({
  tahun, jenis, kabupaten = KOTA,
  rkpRows = [], realRows = [], rkpMap = {},
  asisRows = [], rekonRows = [], nOpd = 0,
  pagu, ttd, onClose,
}) {
  const [idx, setIdx] = useState(0)
  const [aiText, setAiText] = useState('')
  const [aiLoad, setAiLoad] = useState(false)
  const [aiDone, setAiDone] = useState(false)

  const tp = pagu?.total_pagu || 0

  const sumRkpPagu = (bid, isK) =>
    rkpRows.filter(r => isK ? r.is_koordinasi : r.bidang_id === bid && !r.is_koordinasi)
           .reduce((s, r) => s + (r.pagu || 0) + (r.pagu_bop || 0), 0)
  const totalRkpAll = rkpRows.reduce((s, r) => s + (r.pagu || 0) + (r.pagu_bop || 0), 0)

  const realKeu = (r) => (r.realisasi_pagu_utama || 0) + (r.realisasi_bop || 0)
  const realPagu = (r) => {
    const rkp = rkpMap[r.rkp_id]
    return rkp ? (rkp.pagu || 0) + (rkp.pagu_bop || 0) : 0
  }
  const byBidang = (bid, isK) =>
    realRows.filter(r => isK ? r.is_koordinasi : r.bidang_id === bid && !r.is_koordinasi)
  const sumReal = (bid, isK) => byBidang(bid, isK).reduce((s, r) => s + realKeu(r), 0)

  const totalReal = realRows.reduce((s, r) => s + realKeu(r), 0)
  const pctReal = tp > 0 ? (totalReal / tp * 100) : 0

  const realByTw = (tw) => realRows.filter(r => r.triwulan === tw).reduce((s, r) => s + realKeu(r), 0)
  const paguByTw = (tw) => realRows.filter(r => r.triwulan === tw).reduce((s, r) => s + realPagu(r), 0)
  const sem1 = realByTw('I') + realByTw('II')
  const sem2 = realByTw('III') + realByTw('IV')
  const pctSem1 = tp > 0 ? (sem1 / tp * 100) : 0
  const pctSem2 = tp > 0 ? (sem2 / tp * 100) : 0
  const triwulans = ['I', 'II', 'III', 'IV']

  async function doAI() {
    setAiLoad(true)
    const t = await analysisDashboard({ tahun, totalPagu: tp, totalReal, pctReal, nOpd })
    setAiText(t); setAiLoad(false); setAiDone(true)
  }

  const slides = [
    // 0 — Cover
    () => (
      <div style={St.center}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: 'var(--text2)', marginBottom: 18 }}>PEMERINTAH KOTA BATU</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>DOKUMEN LAPORAN PELAKSANAAN PENGGUNAAN</div>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.3, marginBottom: 6 }}>DANA BAGI HASIL CUKAI HASIL TEMBAKAU</div>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>(DBH CHT) {kabupaten.toUpperCase()}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)', border: '2px solid var(--gold)', borderRadius: 8, padding: '6px 24px', display: 'inline-block' }}>
          TAHUN ANGGARAN {tahun} — {jenis}
        </div>
        <div style={{ marginTop: 40, fontSize: 12, color: 'var(--text2)' }}>Disusun oleh Bagian Perekonomian dan SDA · {today()}</div>
      </div>
    ),
    // 1 — Dasar Hukum & Pendahuluan
    () => (
      <div>
        <SlideTitle icon="📖" text="Dasar Hukum & Pendahuluan" />
        <ul style={St.list}>
          <li>Peraturan Menteri Keuangan tentang Pengelolaan Dana Bagi Hasil Cukai Hasil Tembakau (PMK DBH CHT) tahun berjalan.</li>
          <li>Peraturan Kepala Daerah tentang Petunjuk Teknis Penggunaan DBH CHT {kabupaten}.</li>
          <li>Dokumen Rencana Kerja dan Penganggaran (RKP) DBH CHT Tahun Anggaran {tahun} — jenis {jenis}.</li>
        </ul>
        <div style={St.note}>
          Laporan ini disusun untuk menyajikan gambaran menyeluruh atas perencanaan, alokasi, dan
          realisasi penggunaan DBH CHT {kabupaten} Tahun Anggaran {tahun} kepada pimpinan, sebagai bentuk
          pertanggungjawaban dan transparansi pengelolaan anggaran.
        </div>
      </div>
    ),
    // 2 — Gambaran Umum Alokasi
    () => (
      <div>
        <SlideTitle icon="📊" text="Gambaran Umum Alokasi Anggaran" />
        <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
          <StatBox label="Total Pagu DBH CHT" value={fmtRp(tp)} sub={`TA ${tahun} · ${jenis}`} />
          <StatBox label="Total Anggaran RKP" value={fmtRp(totalRkpAll)} sub="sudah terinput" color="var(--gold)" />
        </div>
        {BIDANG.map(b => {
          const alok = tp * (pagu?.[`pct_${b.id}`] || b.pct) / 100
          const rkpVal = sumRkpPagu(b.id, false)
          const pct = alok > 0 ? (rkpVal / alok * 100) : 0
          return (
            <div key={b.id} style={{ marginBottom: 14 }}>
              <div style={St.rowBetween}>
                <span style={{ fontWeight: 600 }}>{b.icon} {b.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{pagu?.[`pct_${b.id}`] || b.pct}% · {fmtRp(alok)}</span>
              </div>
              <ProgressBar value={pct} color={b.color} height={10} />
            </div>
          )
        })}
      </div>
    ),
    // 3 — Realisasi Keuangan per Bidang
    () => (
      <div>
        <SlideTitle icon="💰" text="Realisasi Keuangan per Bidang" />
        <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
          <StatBox label="Total Realisasi" value={fmtRp(totalReal)} sub={`${fmtPct(pctReal)} dari Pagu`} color="var(--info)" />
          <StatBox label="Capaian Realisasi" value={fmtPct(pctReal)}
            color={pctReal >= 80 ? 'var(--accent)' : pctReal >= 50 ? 'var(--gold)' : 'var(--danger)'} />
        </div>
        {[...BIDANG, KOORDINASI].map(b => {
          const isK = !!b.isKoordinasi
          const alok = isK ? sumRkpPagu(null, true) : tp * (pagu?.[`pct_${b.id}`] || b.pct) / 100
          const real = sumReal(isK ? null : b.id, isK)
          const pct = alok > 0 ? (real / alok * 100) : 0
          return (
            <div key={b.id} style={{ marginBottom: 14 }}>
              <div style={St.rowBetween}>
                <span style={{ fontWeight: 600 }}>{b.icon} {b.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: b.color }}>{fmtRp(real)} ({fmtPct(pct)})</span>
              </div>
              <ProgressBar value={pct} color={b.color} height={10} />
            </div>
          )
        })}
      </div>
    ),
    // 4 — Realisasi per Triwulan
    () => (
      <div>
        <SlideTitle icon="📅" text="Realisasi per Triwulan" />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 140, padding: '0 10px', marginBottom: 20 }}>
          {triwulans.map(tw => {
            const real = realByTw(tw)
            const maxReal = Math.max(...triwulans.map(t => realByTw(t)), 1)
            const h = real > 0 ? Math.max((real / maxReal * 110), 6) : 0
            const isSem1 = tw === 'I' || tw === 'II'
            return (
              <div key={tw} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{fmtPct(tp > 0 ? real / tp * 100 : 0)}</div>
                <div style={{ width: '100%', height: h, background: isSem1 ? 'var(--info)' : 'var(--accent2)', borderRadius: '4px 4px 0 0' }} />
                <div style={{ fontSize: 13, fontWeight: 700 }}>Tw {tw}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtRp(real)}</div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', fontSize: 13 }}>
          <span>🟦 Semester I: <strong style={{ color: 'var(--info)' }}>{fmtRp(sem1)} ({fmtPct(pctSem1)})</strong></span>
          <span>🟩 Semester II: <strong style={{ color: 'var(--accent2)' }}>{fmtRp(sem2)} ({fmtPct(pctSem2)})</strong></span>
        </div>
      </div>
    ),
    // 5 — Ringkasan Koordinasi & Asistensi
    () => (
      <div>
        <SlideTitle icon="🤝" text="Ringkasan Asistensi & Rekonsiliasi" />
        <div style={{ display: 'flex', gap: 14 }}>
          <StatBox label="Berita Acara Asistensi" value={asisRows.length} sub="dokumen" />
          <StatBox label="Berita Acara Rekonsiliasi" value={rekonRows.length} sub="dokumen" />
          <StatBox label="OPD Pengguna Aktif" value={nOpd} sub="OPD terdaftar" />
        </div>
        <div style={St.note}>
          Proses asistensi dan rekonsiliasi dilaksanakan secara berkala bersama OPD pengampu
          kegiatan untuk memastikan kesesuaian perencanaan dan realisasi penggunaan DBH CHT.
        </div>
      </div>
    ),
    // 6 — Catatan & Rekomendasi (AI)
    () => (
      <div>
        <SlideTitle icon="🤖" text="Catatan & Rekomendasi" />
        {!aiDone && !aiLoad && (
          <button className="btn btn-ai" onClick={doAI} style={{ padding: '10px 20px' }}>
            ✨ Generate Analisa Otomatis
          </button>
        )}
        {aiLoad && <div className="text-muted">⏳ AI sedang menganalisis data realisasi...</div>}
        {aiDone && <div className="ai-box" style={{ fontSize: 14, lineHeight: 1.7 }}>{aiText}</div>}
        {aiDone && (
          <button className="btn btn-ghost btn-sm mt-1" onClick={() => { setAiDone(false); setAiText('') }}>
            🔄 Ulangi Analisa
          </button>
        )}
        <div style={{ ...St.note, marginTop: 16 }}>
          Catatan: hasil analisa otomatis bersifat draf awal — mohon direview sebelum disampaikan
          secara resmi kepada pimpinan.
        </div>
      </div>
    ),
    // 7 — Penutup & Tanda Tangan
    () => (
      <div>
        <SlideTitle icon="✅" text="Penutup" />
        <div style={St.note}>
          Demikian laporan pelaksanaan penggunaan Dana Bagi Hasil Cukai Hasil Tembakau (DBH CHT)
          {' '}{kabupaten} Tahun Anggaran {tahun} ini disusun sebagai bahan pertanggungjawaban dan
          pengambilan keputusan lebih lanjut.
        </div>
        <TandaTanganFleksibel ttd={ttd} kabupaten={kabupaten} />
      </div>
    ),
  ]

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') setIdx(i => Math.min(i + 1, slides.length - 1))
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0))
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length, onClose])

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#10201a', zIndex: 700, display: 'flex', flexDirection: 'column' }} className="no-print">
      {/* Toolbar */}
      <div style={{ background: '#1a3a1c', color: '#fff', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontWeight: 700 }}>🎬 Slide Presentasi — Laporan DBH CHT {tahun}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: '#cde8cd' }}>{idx + 1} / {slides.length}</span>
        <button onClick={toggleFullscreen} style={St.btnGhost}>⛶ Fullscreen</button>
        <button onClick={onClose} style={St.btnClose}>✕ Tutup</button>
      </div>

      {/* Slide area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
        <div style={{
          background: 'var(--bg2)', color: 'var(--text)', width: '100%', maxWidth: 980, minHeight: 540,
          borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,.4)', padding: '42px 56px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          {slides[idx]()}
        </div>
      </div>

      {/* Navigasi bawah */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '12px 0', flexShrink: 0 }}>
        <button onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0} style={St.navBtn}>◀ Sebelumnya</button>
        <div style={{ display: 'flex', gap: 6 }}>
          {slides.map((_, i) => (
            <span key={i} onClick={() => setIdx(i)}
              style={{ width: 8, height: 8, borderRadius: '50%', cursor: 'pointer', background: i === idx ? '#52b788' : '#3a5a3c' }} />
          ))}
        </div>
        <button onClick={() => setIdx(i => Math.min(i + 1, slides.length - 1))} disabled={idx === slides.length - 1} style={St.navBtn}>Berikutnya ▶</button>
      </div>
    </div>
  )
}

function SlideTitle({ icon, text }) {
  return (
    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span>{icon}</span><span>{text}</span>
    </div>
  )
}

const St = {
  center: { textAlign: 'center' },
  rowBetween: { display: 'flex', justifyContent: 'space-between', marginBottom: 5 },
  list: { fontSize: 14, lineHeight: 2, paddingLeft: 20 },
  note: { fontSize: 14, lineHeight: 1.8, color: 'var(--text2)', marginTop: 14 },
  navBtn: { padding: '8px 18px', borderRadius: 6, border: '1px solid #3a5a3c', background: 'transparent', color: '#e8f0e0', cursor: 'pointer', fontSize: 13 },
  btnGhost: { padding: '6px 14px', borderRadius: 5, border: '1px solid #3a5a3c', background: 'transparent', color: '#cde8cd', cursor: 'pointer', fontSize: 12.5 },
  btnClose: { padding: '6px 14px', borderRadius: 5, border: 'none', background: '#c0392b', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 },
}

// ══════════════════════════════════════════════════════════════
//  HALAMAN LAPORAN UTAMA
// ══════════════════════════════════════════════════════════════
export default function Laporan() {
  // ✅ FIX 1: hapus useEffect ensurePrintCss() yang tidak ada — penyebab crash utama
  // ✅ FIX 2: isSekretariat diturunkan dari profile.role, bukan destructure dari useAuth
  const { tahun, jenis } = useApp()
  const { profile } = useAuth()
  const isSekretariat = profile?.role === 'sekretariat'

  const [menu,      setMenu]     = useState('asistensi')
  const [asisRows,  setAsis]     = useState([])
  const [rekonRows, setRekon]    = useState([])
  const [rkpRows,   setRkp]      = useState([])
  const [realRows,  setReal]     = useState([])
  const [selBA,     setSelBA]    = useState(null)
  const [prevType,  setPrevType] = useState(null)
  const [twFilter,  setTwFilter] = useState('')

  // ── Data untuk Cetak RKP Perubahan (Semula/Menjadi) ───────────
  // Selalu ambil RKP Murni (bukan mengikuti toggle jenis di atas),
  // karena Semula pada dokumen Perubahan harus tetap RKP Murni.
  const [murniUntukPerubahan, setMurniUntukPerubahan] = useState([])
  const [perubahanRows, setPerubahanRows] = useState([])
  const [paguMurniInfo, setPaguMurniInfo] = useState(null)
  const [paguPerubahanInfo, setPaguPerubahanInfo] = useState(null)
  const [orientasi, setOrientasi] = useState('portrait')

  // ── Modal "Download PDF Laporan Realisasi" — data penandatangan ──
  const TTD_EMPTY = {
    namaKoordinator: '', nipKoordinator: '', jabatanKoordinator: '',
    tempat: KOTA, tanggal: '',
    jabatanPenandatangan: '', namaPejabat: '', nipPejabat: '', atasNama: false,
  }
  const [showTtdModal, setShowTtdModal] = useState(false)
  const [ttdForm, setTtdForm] = useState(TTD_EMPTY)
  const [ttd, setTtd] = useState(null)

  // ── Slide Presentasi ──────────────────────────────────────────
  const [showSlide, setShowSlide] = useState(false)
  const [nOpd, setNOpd] = useState(0)

  function openTtdModal() { setTtdForm(f => ({ ...TTD_EMPTY, ...f })); setShowTtdModal(true) }
  function generatePdf() {
    setTtd(ttdForm)
    setShowTtdModal(false)
    setTimeout(doCetak, 100) // beri waktu render ulang blok tanda tangan sebelum print
  }

  useEffect(() => { if (profile) loadAll() }, [tahun, jenis, profile])

  async function loadAll() {
    const uid    = profile?.id
    const isSkrt = isSekretariat
    const [{ data: a }, { data: rk }, { data: rv }, { data: rl }, { data: mp }, { data: pr }, { data: pm }, { data: pp }] = await Promise.all([
      (() => { let q = supabase.from('asistensi_dbhcht').select('*').eq('tahun', tahun).order('tanggal'); if (!isSkrt && uid) q = q.eq('opd_user_id', uid); return q })(),
      (() => { let q = supabase.from('rekonsiliasi_dbhcht').select('*').eq('tahun', tahun).order('tanggal'); if (!isSkrt && uid) q = q.eq('opd_user_id', uid); return q })(),
      (() => { let q = supabase.from('rkp_dbhcht').select('*').eq('tahun', tahun).eq('jenis', jenis).order('bidang_id'); if (!isSkrt && uid) q = q.eq('created_by', uid); return q })(),
      (() => { let q = supabase.from('realisasi_dbhcht').select('*').eq('tahun', tahun).order('triwulan,created_at'); if (!isSkrt && uid) q = q.eq('created_by', uid); return q })(),
      (() => { let q = supabase.from('rkp_dbhcht').select('*').eq('tahun', tahun).eq('jenis', 'Murni').order('bidang_id'); if (!isSkrt && uid) q = q.eq('created_by', uid); return q })(),
      (() => { let q = supabase.from('rkp_perubahan_dbhcht').select('*').eq('tahun', tahun).order('bidang_id'); if (!isSkrt && uid) q = q.eq('created_by', uid); return q })(),
      supabase.from('pagu_alokasi').select('*').eq('tahun', tahun).eq('jenis', 'Murni').maybeSingle(),
      supabase.from('pagu_alokasi').select('*').eq('tahun', tahun).eq('jenis', 'Perubahan').maybeSingle(),
    ])
    setAsis(a || []); setRekon(rk || []); setRkp(rv || []); setReal(rl || [])
    setMurniUntukPerubahan(mp || []); setPerubahanRows(pr || [])
    setPaguMurniInfo(pm); setPaguPerubahanInfo(pp)

    // Hitung jumlah OPD aktif untuk slide presentasi (pola sama seperti Dashboard.jsx)
    const { data: op } = await supabase.from('profiles').select('id').eq('role', 'opd').eq('aktif', true)
    setNOpd((op || []).length)
  }

  const rkpPerubahanRows = buildBarisRkpPerubahan(murniUntukPerubahan, perubahanRows)

  const rekonFiltered = twFilter ? rekonRows.filter(r => r.triwulan === twFilter) : rekonRows

  // Index RKP by id — sumber kebenaran untuk pagu, pagu_bop, volume, satuan
  const rkpMap = Object.fromEntries(rkpRows.map(r => [r.id, r]))

  const realSem1 = mergeRealisasi(realRows.filter(r => ['I', 'II'].includes(r.triwulan)), rkpMap)
  const realSem2 = mergeRealisasi(realRows, rkpMap)
  const realTw   = twFilter ? realRows.filter(r => r.triwulan === twFilter) : realRows

  const MENUS = [
    { id: 'asistensi',    label: '🤝 BA Asistensi',        count: asisRows.length },
    { id: 'rekap_asis',   label: '📋 Rekap Asistensi',     count: asisRows.length },
    { id: 'rekonsiliasi', label: '🔄 BA Rekonsiliasi',      count: rekonRows.length },
    { id: 'rekap_rekon',  label: '📋 Rekap Rekonsiliasi',   count: rekonRows.length },
    { id: 'rkp',          label: '📄 Cetak RKP',            count: rkpRows.length },
    { id: 'rkp_perubahan', label: '📝 Cetak RKP Perubahan', count: rkpPerubahanRows.length },
    { id: 'realisasi_tw', label: '📈 Real. Per Triwulan',   count: realRows.length },
    { id: 'realisasi_s1', label: '📊 Real. Semester I',     count: realSem1.length },
    { id: 'realisasi_s2', label: '📊 Real. Semester II',    count: realSem2.length },
    { id: 'slide',        label: '🎬 Slide Presentasi' },
  ]

  const paguAktif = jenis === 'Murni' ? paguMurniInfo : paguPerubahanInfo

  function openPreview(type, row) { setSelBA(row); setPrevType(type) }
  function closePreview()         { setSelBA(null); setPrevType(null) }

  // Tabel RKP/RKP Perubahan lebih lebar (banyak kolom) — sarankan Landscape
  // secara default saat pindah ke tab tsb, tapi tetap bisa diganti manual.
  useEffect(() => {
    setOrientasi(['rkp', 'rkp_perubahan'].includes(menu) ? 'landscape' : 'portrait')
  }, [menu])

  function doCetak() {
    setPageOrientation(orientasi)
    document.body.classList.add('printing-doc')
    window.print()
    setTimeout(() => document.body.classList.remove('printing-doc'), 800)
  }

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
            {m.label}{m.count !== undefined && (
              <span style={{ fontSize: '.7rem', color: 'var(--text2)', marginLeft: 3 }}>({m.count})</span>
            )}
          </div>
        ))}
      </div>

      {/* Filter triwulan */}
      {(menu === 'rekonsiliasi' || menu === 'rekap_rekon' || menu === 'realisasi_tw') && (
        <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '.82rem', color: 'var(--text2)' }}>Filter Triwulan:</label>
          <select className="form-control" style={{ width: 160 }} value={twFilter} onChange={e => setTwFilter(e.target.value)}>
            <option value="">Semua Triwulan</option>
            {['I', 'II', 'III', 'IV'].map(t => <option key={t} value={t}>Triwulan {t}</option>)}
          </select>
        </div>
      )}

      {/* ── Daftar BA Asistensi ── */}
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

      {/* ── Rekap Asistensi ── */}
      {menu === 'rekap_asis' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doCetak}>🖨️ Cetak Rekap</button>
            <OrientToggle value={orientasi} onChange={setOrientasi} />
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <RekapAisistensi rows={asisRows} tahun={tahun} kabupaten={KOTA} />
          </div>
        </>
      )}

      {/* ── Daftar BA Rekonsiliasi ── */}
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

      {/* ── Rekap Rekonsiliasi ── */}
      {menu === 'rekap_rekon' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doCetak}>🖨️ Cetak Rekap</button>
            <OrientToggle value={orientasi} onChange={setOrientasi} />
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <RekapRekonsiliasi rows={rekonFiltered} tahun={tahun} triwulan={twFilter} kabupaten={KOTA} />
          </div>
        </>
      )}

      {/* ── Cetak RKP ── */}
      {menu === 'rkp' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doCetak}>🖨️ Cetak RKP</button>
            <OrientToggle value={orientasi} onChange={setOrientasi} />
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <CetakRKP rows={rkpRows} tahun={tahun} jenis={jenis} kabupaten={KOTA} />
          </div>
        </>
      )}

      {/* ── Cetak RKP Perubahan (Semula/Menjadi, Lampiran F PMK 22/2026) ── */}
      {menu === 'rkp_perubahan' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doCetak}>🖨️ Cetak RKP Perubahan</button>
            <OrientToggle value={orientasi} onChange={setOrientasi} />
            {orientasi !== 'landscape' && <span className="chip" style={{ fontSize: '.72rem' }}>💡 Disarankan orientasi Landscape agar kolom tidak terpotong</span>}
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <CetakRKPPerubahan
              rows={rkpPerubahanRows} tahun={tahun} kabupaten={KOTA}
              paguAlokasi={paguMurniInfo?.total_pagu || 0}
              sisaSilpa={(paguPerubahanInfo?.total_pagu || 0) - (paguMurniInfo?.total_pagu || 0)}
            />
          </div>
        </>
      )}

      {/* ── Realisasi Per Triwulan ── */}
      {menu === 'realisasi_tw' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doCetak}>🖨️ Cetak Laporan</button>
            <button className="btn btn-outline" onClick={openTtdModal}>📥 Download PDF</button>
            <OrientToggle value={orientasi} onChange={setOrientasi} />
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <CetakRealisasi rows={mergeRealisasi(realTw, rkpMap)} tahun={tahun}
              label={twFilter ? 'TRIWULAN ' + twFilter : 'SEMUA TRIWULAN'}
              kabupaten={KOTA} ttd={ttd} />
          </div>
        </>
      )}

      {/* ── Realisasi Semester I ── */}
      {menu === 'realisasi_s1' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doCetak}>🖨️ Cetak Laporan Semester I</button>
            <button className="btn btn-outline" onClick={openTtdModal}>📥 Download PDF</button>
            <OrientToggle value={orientasi} onChange={setOrientasi} />
            <span className="chip">Triwulan I + II</span>
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <CetakRealisasi rows={realSem1} tahun={tahun} label="SEMESTER I (TRIWULAN I DAN II)" kabupaten={KOTA} ttd={ttd} />
          </div>
        </>
      )}

      {/* ── Realisasi Semester II ── */}
      {menu === 'realisasi_s2' && (
        <>
          <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doCetak}>🖨️ Cetak Laporan Semester II</button>
            <button className="btn btn-outline" onClick={openTtdModal}>📥 Download PDF</button>
            <OrientToggle value={orientasi} onChange={setOrientasi} />
            <span className="chip">Triwulan I + II + III + IV</span>
          </div>
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <CetakRealisasi rows={realSem2} tahun={tahun} label="SEMESTER II / KUMULATIF (TRIWULAN I S.D. IV)" kabupaten={KOTA} ttd={ttd} />
          </div>
        </>
      )}

      {menu === 'slide' && (
        <div className="no-print" style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
            Dokumen Laporan Pelaksanaan Penggunaan DBH CHT {KOTA} TA {tahun}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            Ringkasan interaktif berupa slide — data pagu, realisasi, dan capaian diambil langsung
            (real-time) dari data RKP &amp; Realisasi jenis <strong>{jenis}</strong> tahun berjalan.
            Cocok ditampilkan langsung ke pimpinan dari layar atau proyektor.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ padding: '10px 22px', fontSize: 14 }} onClick={() => setShowSlide(true)}>
              🎬 Mulai Presentasi
            </button>
            {!ttd && (
              <button className="btn btn-outline" style={{ padding: '10px 18px', fontSize: 14 }} onClick={openTtdModal}>
                ✍️ Isi Data Penandatangan Dahulu
              </button>
            )}
          </div>
          {ttd && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
              ✅ Data penandatangan sudah diisi — akan tampil di slide penutup.{' '}
              <span style={{ cursor: 'pointer', color: 'var(--accent)', textDecoration: 'underline' }} onClick={openTtdModal}>Ubah</span>
            </div>
          )}
        </div>
      )}

      {showSlide && (
        <SlidePresentasi
          tahun={tahun} jenis={jenis} kabupaten={KOTA}
          rkpRows={rkpRows} realRows={realRows} rkpMap={rkpMap}
          asisRows={asisRows} rekonRows={rekonRows} nOpd={nOpd}
          pagu={paguAktif} ttd={ttd}
          onClose={() => setShowSlide(false)}
        />
      )}

      {/* ── Modal Download PDF Laporan Realisasi ── */}
      {showTtdModal && (
        <Modal title="Download PDF Laporan Realisasi" onClose={() => setShowTtdModal(false)} wide>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Nama Koordinator</label>
              <input className="form-control" value={ttdForm.namaKoordinator}
                onChange={e => setTtdForm({ ...ttdForm, namaKoordinator: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Jabatan Penandatangan</label>
              <input className="form-control" value={ttdForm.jabatanPenandatangan}
                onChange={e => setTtdForm({ ...ttdForm, jabatanPenandatangan: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">NIP Koordinator</label>
              <input className="form-control" value={ttdForm.nipKoordinator}
                onChange={e => setTtdForm({ ...ttdForm, nipKoordinator: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Nama Pejabat Penandatangan</label>
              <input className="form-control" value={ttdForm.namaPejabat}
                onChange={e => setTtdForm({ ...ttdForm, namaPejabat: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Jabatan Koordinator</label>
              <input className="form-control" placeholder="Opsional" value={ttdForm.jabatanKoordinator}
                onChange={e => setTtdForm({ ...ttdForm, jabatanKoordinator: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">NIP Pejabat Penandatangan</label>
              <input className="form-control" value={ttdForm.nipPejabat}
                onChange={e => setTtdForm({ ...ttdForm, nipPejabat: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Tempat Penandatanganan</label>
              <input className="form-control" placeholder="Contoh: Jakarta" value={ttdForm.tempat}
                onChange={e => setTtdForm({ ...ttdForm, tempat: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={ttdForm.atasNama}
                  onChange={e => setTtdForm({ ...ttdForm, atasNama: e.target.checked })} />
                Atas nama (a.n.)?
              </label>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Tanggal Penandatanganan</label>
              <input className="form-control" type="date" value={ttdForm.tanggal}
                onChange={e => setTtdForm({ ...ttdForm, tanggal: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1 }} />
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setShowTtdModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={generatePdf}>📄 Generate PDF</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
