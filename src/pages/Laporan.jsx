import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, fmtRp } from '../lib/constants.js'

// ── Helpers ────────────────────────────────────────────────────
const fmt  = (n) => new Intl.NumberFormat('id-ID').format(Math.round(n||0))
const fmtR = (n) => 'Rp '+fmt(n)

// ─── PRINT CSS (injected once) ─────────────────────────────────
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
}
@page { size: A4; margin: 20mm 15mm; }
`

function injectPrintCss() {
  if (document.getElementById('simdbh-print-css')) return
  const s = document.createElement('style')
  s.id = 'simdbh-print-css'
  s.textContent = PRINT_CSS
  document.head.appendChild(s)
}

// ─── SHARED STYLES FOR DOCUMENTS ──────────────────────────────
const docStyle = {
  fontFamily: 'Arial, sans-serif',
  fontSize: '11px',
  lineHeight: '1.5',
  color: '#000',
  background: '#fff',
  padding: '20px',
  maxWidth: 794,
  margin: '0 auto',
}

const tblStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '10px',
  marginBottom: 8,
}

const tdBorder = {
  border: '1px solid #000',
  padding: '3px 5px',
  verticalAlign: 'top',
}

const thStyle = {
  ...tdBorder,
  background: '#e0e0e0',
  fontWeight: 'bold',
  textAlign: 'center',
}

// ─── BA ASISTENSI (sesuai format resmi) ────────────────────────
export function CetakAistensi({ data, kabupaten = '…………………' }) {
  if (!data) return null
  const ps = Array.isArray(data.peserta_sekretariat) ? data.peserta_sekretariat : []
  const po = Array.isArray(data.peserta_opd) ? data.peserta_opd : []
  const maxRow = Math.max(ps.length, po.length, 3)
  const snap = Array.isArray(data.rkp_snapshot) ? data.rkp_snapshot : []

  // Baris tabel C (Hasil Asistensi)
  const hasilItems = [
    { no: 1, uraian: 'Kesesuaian bidang penggunaan DBH CHT' },
    { no: 2, uraian: 'Kesesuaian indikator dan target' },
    { no: 3, uraian: 'Kesesuaian komponen belanja' },
    { no: 4, uraian: 'Kesesuaian dengan PMK terkait DBH CHT' },
    { no: 5, uraian: 'Kelengkapan dokumen pendukung' },
    { no: 6, uraian: 'Efisiensi dan efektivitas anggaran' },
    { no: 7, uraian: 'Catatan lainnya' },
  ]

  return (
    <div style={docStyle}>
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>
          HASIL ASISTENSI RANCANGAN KEGIATAN DAN PENGANGGARAN
        </div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>
          DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)
        </div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>
          TAHUN ANGGARAN {new Date(data.tanggal||Date.now()).getFullYear()}
        </div>
        <div style={{ marginTop: 4 }}>
          Nomor : {data.nomor_ba || '……………………………………………'}
        </div>
      </div>

      {/* PEMBUKAAN */}
      <p style={{ marginBottom: 8, textAlign: 'justify' }}>
        Pada hari ini <strong>{data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID',{weekday:'long'}) : '__________'}</strong> tanggal{' '}
        <strong>{data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : '__________ bulan __________ tahun __________'}</strong>{' '}
        bertempat di <strong>{data.tempat || '__________________________'}</strong>, telah dilaksanakan asistensi
        Rancangan Kegiatan dan Penganggaran Dana Bagi Hasil Cukai Hasil Tembakau (RKP DBH CHT) antara
        Sekretariat Tim Koordinasi Penggunaan DBH CHT dengan perangkat daerah pengguna DBH CHT sebagai berikut:
      </p>

      {/* A. IDENTITAS */}
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>A. IDENTITAS PERANGKAT DAERAH</div>
      <table style={tblStyle}>
        <tbody>
          {[
            ['1', 'Nama Perangkat Daerah', data.opd || ''],
            ['2', 'Program', data.program || ''],
            ['3', 'Kegiatan', data.kegiatan || ''],
            ['4', 'Sub Kegiatan', data.sub_kegiatan || ''],
            ['5', 'Bidang Penggunaan DBH CHT', (() => {
              const b = [...BIDANG, KOORDINASI].find(x => x.id === data.bidang_id)
              return b ? b.label : (data.bidang_id || '')
            })()],
            ['6', 'Pagu Anggaran Usulan', 'Rp. ' + fmt(data.pagu_usulan || 0)],
            ['7', 'Sumber Pendanaan', 'DBH CHT Tahun Anggaran ' + new Date(data.tanggal||Date.now()).getFullYear()],
          ].map(([no, uraian, ket]) => (
            <tr key={no}>
              <td style={{ ...tdBorder, width: 24, textAlign: 'center' }}>{no}</td>
              <td style={{ ...tdBorder, width: 220 }}>{uraian}</td>
              <td style={tdBorder}>{ket}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* DATA RKP (jika ada snapshot) */}
      {snap.length > 0 && (
        <>
          <div style={{ fontWeight: 'bold', marginBottom: 4, marginTop: 8 }}>
            Data RKP yang Diasistensikan:
          </div>
          <table style={tblStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 24 }}>No</th>
                <th style={thStyle}>Program / Kegiatan</th>
                <th style={thStyle}>Kode Rekening</th>
                <th style={thStyle}>Vol</th>
                <th style={{ ...thStyle, width: 90 }}>Pagu Utama (Rp)</th>
                <th style={{ ...thStyle, width: 80 }}>BOP (Rp)</th>
                <th style={{ ...thStyle, width: 90 }}>Total (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {snap.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
                  <td style={tdBorder}>
                    <div style={{ fontWeight: 600 }}>{r.program}</div>
                    <div style={{ fontSize: 9 }}>{r.kegiatan}</div>
                  </td>
                  <td style={{ ...tdBorder, fontSize: 9 }}>{r.kode_rekening}</td>
                  <td style={{ ...tdBorder, textAlign: 'center' }}>{r.volume} {r.satuan}</td>
                  <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.pagu)}</td>
                  <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.pagu_bop || 0)}</td>
                  <td style={{ ...tdBorder, textAlign: 'right', fontWeight: 600 }}>
                    {fmt((r.pagu || 0) + (r.pagu_bop || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* B. PELAKSANA */}
      <div style={{ fontWeight: 'bold', margin: '8px 0 4px' }}>B. PELAKSANA ASISTENSI</div>
      <div style={{ marginBottom: 2 }}>1. Sekretariat Tim Koordinasi Penggunaan DBH CHT</div>
      <table style={tblStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>No</th>
            <th style={thStyle}>Nama</th>
            <th style={thStyle}>Jabatan</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(maxRow, 3) }).map((_, i) => (
            <tr key={i}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ ...tdBorder, minHeight: 20 }}>{ps[i]?.nama || ''}</td>
              <td style={{ ...tdBorder, minHeight: 20 }}>{ps[i]?.jabatan || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginBottom: 2 }}>2. Perangkat Daerah Pengguna</div>
      <table style={tblStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>No</th>
            <th style={thStyle}>Nama</th>
            <th style={thStyle}>Jabatan</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(maxRow, 3) }).map((_, i) => (
            <tr key={i}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ ...tdBorder, minHeight: 20 }}>{po[i]?.nama || ''}</td>
              <td style={{ ...tdBorder, minHeight: 20 }}>{po[i]?.jabatan || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* C. HASIL ASISTENSI */}
      <div style={{ fontWeight: 'bold', margin: '8px 0 4px' }}>C. HASIL ASISTENSI</div>
      <table style={tblStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>No</th>
            <th style={thStyle}>Uraian yang Diasistensikan</th>
            <th style={{ ...thStyle, width: 200 }}>Hasil Pembahasan / Catatan</th>
            <th style={{ ...thStyle, width: 120 }}>Tindak Lanjut</th>
          </tr>
        </thead>
        <tbody>
          {hasilItems.map((item) => (
            <tr key={item.no}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{item.no}</td>
              <td style={tdBorder}>{item.uraian}</td>
              <td style={{ ...tdBorder, minHeight: 24 }}>
                {item.no === 1 ? (data.hasil_pembahasan || '') : ''}
              </td>
              <td style={{ ...tdBorder, minHeight: 24 }}>
                {item.no === 1 ? (data.tindak_lanjut || '') : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* D. KESIMPULAN */}
      <div style={{ fontWeight: 'bold', margin: '8px 0 4px' }}>D. KESIMPULAN</div>
      <p>
        Berdasarkan hasil asistensi, Rancangan Kegiatan dan Penganggaran DBH CHT pada Perangkat Daerah{' '}
        <strong>{data.opd || '__________________________'}</strong>:
      </p>
      <div style={{ margin: '6px 0' }}>
        <div>
          {data.kesimpulan === 'dapat_ditindaklanjuti' ? '☑' : '☐'}{' '}
          Dapat ditindaklanjuti pada tahapan penganggaran berikutnya.
        </div>
        <div>
          {data.kesimpulan === 'perlu_perbaikan' ? '☑' : '☐'}{' '}
          Perlu dilakukan perbaikan/penyesuaian sebagaimana hasil asistensi.
        </div>
      </div>
      <p style={{ marginTop: 6 }}>
        Demikian Berita Acara Hasil Asistensi ini dibuat untuk digunakan sebagaimana mestinya.
      </p>

      {/* TANDA TANGAN */}
      <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ width: '45%', verticalAlign: 'top', textAlign: 'center', padding: '0 8px' }}>
              <div style={{ fontWeight: 'bold' }}>PIHAK SEKRETARIAT TIM KOORDINASI</div>
              <div style={{ marginTop: 4 }}>Nama :</div>
              <div>Jabatan :</div>
              <div>Tanda Tangan</div>
              <div style={{ marginTop: 50 }}>(__________________________)</div>
            </td>
            <td style={{ width: '10%' }} />
            <td style={{ width: '45%', verticalAlign: 'top', textAlign: 'center', padding: '0 8px' }}>
              <div style={{ fontWeight: 'bold' }}>PIHAK PERANGKAT DAERAH</div>
              <div style={{ marginTop: 4 }}>Nama :</div>
              <div>Jabatan :</div>
              <div>Tanda Tangan</div>
              <div style={{ marginTop: 50 }}>(__________________________)</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <div>Mengetahui,</div>
        <div>a.n Ketua Tim Koordinasi Penggunaan DBH CHT</div>
        <div>{kabupaten}</div>
        <div>Sekretaris</div>
        <div style={{ marginTop: 50 }}>(__________________________)</div>
      </div>
    </div>
  )
}

// ─── BA REKONSILIASI (sesuai format resmi) ─────────────────────
export function CetakRekonsiliasi({ data, kabupaten = '…………………' }) {
  if (!data) return null
  const ps = Array.isArray(data.peserta_sekretariat) ? data.peserta_sekretariat : []
  const po = Array.isArray(data.peserta_opd) ? data.peserta_opd : []
  const snap = Array.isArray(data.realisasi_snapshot) ? data.realisasi_snapshot : []
  const maxRow = Math.max(ps.length, po.length, 3)

  return (
    <div style={docStyle}>
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>
          HASIL REKONSILIASI REALISASI KEGIATAN DAN ANGGARAN
        </div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>
          PENGGUNAAN DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)
        </div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>
          TRIWULAN {data.triwulan} TAHUN ANGGARAN {new Date(data.tanggal||Date.now()).getFullYear()}
        </div>
        <div style={{ marginTop: 4 }}>
          Nomor : {data.nomor_ba || '……………………………………………'}
        </div>
      </div>

      {/* PEMBUKAAN */}
      <p style={{ marginBottom: 8, textAlign: 'justify' }}>
        Pada hari ini <strong>{data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { weekday: 'long' }) : '__________'}</strong> tanggal{' '}
        <strong>{data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '__________ bulan __________ tahun __________'}</strong>{' '}
        bertempat di <strong>{data.tempat || '__________________________'}</strong>, telah dilaksanakan rekonsiliasi
        realisasi kegiatan dan anggaran penggunaan Dana Bagi Hasil Cukai Hasil Tembakau (DBH CHT) Triwulan{' '}
        <strong>{data.triwulan}</strong> Tahun Anggaran <strong>{new Date(data.tanggal||Date.now()).getFullYear()}</strong> antara
        Sekretariat Tim Koordinasi Penggunaan DBH CHT dengan Perangkat Daerah pengguna DBH CHT.
      </p>

      {/* A. IDENTITAS */}
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>A. IDENTITAS PERANGKAT DAERAH</div>
      <table style={tblStyle}>
        <tbody>
          {[
            ['1', 'Nama Perangkat Daerah', data.opd || ''],
            ['2', 'Program', data.program || ''],
            ['3', 'Kegiatan', data.kegiatan || ''],
            ['4', 'Sub Kegiatan', ''],
            ['5', 'Bidang Penggunaan DBH CHT', (() => {
              const b = [...BIDANG, KOORDINASI].find(x => x.id === data.bidang_id)
              return b ? b.label : ''
            })()],
            ['6', 'Pagu Anggaran', 'Rp. ' + fmt(data.pagu || 0)],
            ['7', 'Periode Rekonsiliasi', 'Triwulan ' + data.triwulan + ' Tahun ' + new Date(data.tanggal||Date.now()).getFullYear()],
          ].map(([no, uraian, ket]) => (
            <tr key={no}>
              <td style={{ ...tdBorder, width: 24, textAlign: 'center' }}>{no}</td>
              <td style={{ ...tdBorder, width: 220 }}>{uraian}</td>
              <td style={tdBorder}>{ket}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* B. PELAKSANA */}
      <div style={{ fontWeight: 'bold', margin: '8px 0 4px' }}>B. PELAKSANA REKONSILIASI</div>
      <div style={{ marginBottom: 2 }}>1. Sekretariat Tim Koordinasi Penggunaan DBH CHT</div>
      <table style={tblStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>No</th>
            <th style={thStyle}>Nama</th>
            <th style={thStyle}>Jabatan</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(maxRow, 3) }).map((_, i) => (
            <tr key={i}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ ...tdBorder, minHeight: 20 }}>{ps[i]?.nama || ''}</td>
              <td style={{ ...tdBorder, minHeight: 20 }}>{ps[i]?.jabatan || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginBottom: 2 }}>2. Perangkat Daerah Pengguna</div>
      <table style={tblStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>No</th>
            <th style={thStyle}>Nama</th>
            <th style={thStyle}>Jabatan</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(maxRow, 3) }).map((_, i) => (
            <tr key={i}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ ...tdBorder, minHeight: 20 }}>{po[i]?.nama || ''}</td>
              <td style={{ ...tdBorder, minHeight: 20 }}>{po[i]?.jabatan || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* C. HASIL REKONSILIASI */}
      <div style={{ fontWeight: 'bold', margin: '8px 0 4px' }}>C. HASIL REKONSILIASI REALISASI</div>
      <table style={tblStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>No</th>
            <th style={thStyle}>Uraian</th>
            <th style={{ ...thStyle, width: 90 }}>Anggaran (Rp)</th>
            <th style={{ ...thStyle, width: 90 }}>Realisasi Keuangan (Rp)</th>
            <th style={{ ...thStyle, width: 60 }}>Realisasi Fisik (%)</th>
            <th style={{ ...thStyle, width: 120 }}>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {snap.length > 0 ? snap.map((r, i) => (
            <tr key={i}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
              <td style={tdBorder}>
                <div style={{ fontWeight: 600 }}>{r.program}</div>
                <div style={{ fontSize: 9 }}>{r.kegiatan}</div>
              </td>
              <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.pagu)}</td>
              <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.realisasi_keu)}</td>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{r.realisasi_fisik}%</td>
              <td style={tdBorder}>{r.keterangan || ''}</td>
            </tr>
          )) : (
            <>
              {[['1', 'Program'], ['2', 'Kegiatan'], ['3', 'Sub Kegiatan']].map(([no, label]) => (
                <tr key={no}>
                  <td style={{ ...tdBorder, textAlign: 'center' }}>{no}</td>
                  <td style={tdBorder}>
                    {no === '1' ? data.program || label :
                     no === '2' ? data.kegiatan || label : label}
                  </td>
                  <td style={{ ...tdBorder, textAlign: 'right' }}>
                    {no === '1' ? fmt(data.pagu || 0) : ''}
                  </td>
                  <td style={{ ...tdBorder, textAlign: 'right' }}>
                    {no === '1' ? fmt(data.realisasi_keu || 0) : ''}
                  </td>
                  <td style={{ ...tdBorder, textAlign: 'center' }}>
                    {no === '1' ? (data.realisasi_fisik || 0) + '%' : ''}
                  </td>
                  <td style={tdBorder} />
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>

      {/* D. PERMASALAHAN */}
      <div style={{ fontWeight: 'bold', margin: '8px 0 4px' }}>D. PERMASALAHAN DAN TINDAK LANJUT</div>
      <table style={tblStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>No</th>
            <th style={thStyle}>Permasalahan/Hambatan</th>
            <th style={{ ...thStyle, width: 150 }}>Tindak Lanjut</th>
            <th style={{ ...thStyle, width: 100 }}>Penanggung Jawab</th>
            <th style={{ ...thStyle, width: 90 }}>Target Penyelesaian</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...tdBorder, textAlign: 'center' }}>1</td>
            <td style={{ ...tdBorder, minHeight: 30 }}>{data.permasalahan || ''}</td>
            <td style={{ ...tdBorder, minHeight: 30 }}>{data.tindak_lanjut || ''}</td>
            <td style={{ ...tdBorder, minHeight: 30 }}>{data.penanggung_jawab || ''}</td>
            <td style={{ ...tdBorder, minHeight: 30 }} />
          </tr>
          <tr>
            <td style={{ ...tdBorder, textAlign: 'center' }}>2</td>
            <td style={tdBorder} /><td style={tdBorder} /><td style={tdBorder} /><td style={tdBorder} />
          </tr>
        </tbody>
      </table>

      {/* E. KESIMPULAN */}
      <div style={{ fontWeight: 'bold', margin: '8px 0 4px' }}>E. KESIMPULAN</div>
      <p>
        Berdasarkan hasil rekonsiliasi Triwulan <strong>{data.triwulan}</strong> Tahun Anggaran{' '}
        <strong>{new Date(data.tanggal||Date.now()).getFullYear()}</strong>, realisasi penggunaan DBH CHT pada
        Perangkat Daerah <strong>{data.opd || '__________________________'}</strong> telah:
      </p>
      <div style={{ margin: '6px 0' }}>
        <div>{data.kesimpulan === 'sesuai' ? '☑' : '☐'} Sesuai dengan ketentuan penggunaan DBH CHT.</div>
        <div>{data.kesimpulan === 'perlu_perbaikan' ? '☑' : '☐'} Memerlukan perbaikan dan tindak lanjut sebagaimana hasil rekonsiliasi.</div>
      </div>
      <p>Demikian Berita Acara Hasil Rekonsiliasi ini dibuat untuk digunakan sebagaimana mestinya.</p>

      {/* TANDA TANGAN */}
      <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'top' }}>
              <div style={{ fontWeight: 'bold' }}>PIHAK SEKRETARIAT TIM KOORDINASI</div>
              <div>Nama :</div><div>Jabatan :</div><div>Tanda Tangan</div>
              <div style={{ marginTop: 50 }}>(__________________________)</div>
            </td>
            <td style={{ width: '10%' }} />
            <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'top' }}>
              <div style={{ fontWeight: 'bold' }}>PIHAK PERANGKAT DAERAH</div>
              <div>Nama :</div><div>Jabatan :</div><div>Tanda Tangan</div>
              <div style={{ marginTop: 50 }}>(__________________________)</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <div>Mengetahui,</div>
        <div>An. Ketua Tim Koordinasi Penggunaan DBH CHT</div>
        <div>{kabupaten}</div>
        <div>Sekretaris,</div>
        <div style={{ marginTop: 50 }}>(__________________________)</div>
      </div>
    </div>
  )
}

// ─── REKAP ASISTENSI ───────────────────────────────────────────
export function RekapAisistensi({ rows = [], tahun, kabupaten = '…………………' }) {
  return (
    <div style={docStyle}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>REKAPITULASI HASIL ASISTENSI</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>RENCANA KEGIATAN DAN PENGANGGARAN (RKP) DBH CHT</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>TAHUN ANGGARAN {tahun}</div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>
      <table style={tblStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>No</th>
            <th style={thStyle}>No. BA</th>
            <th style={thStyle}>Tanggal</th>
            <th style={thStyle}>OPD / Perangkat Daerah</th>
            <th style={thStyle}>Program</th>
            <th style={{ ...thStyle, width: 90 }}>Pagu Usulan (Rp)</th>
            <th style={thStyle}>Kesimpulan</th>
            <th style={thStyle}>Tindak Lanjut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
              <td style={tdBorder}>{r.nomor_ba || '—'}</td>
              <td style={{ ...tdBorder, whiteSpace: 'nowrap' }}>{r.tanggal}</td>
              <td style={tdBorder}>{r.opd}</td>
              <td style={tdBorder}>{r.program}</td>
              <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.pagu_usulan)}</td>
              <td style={{ ...tdBorder, textAlign: 'center' }}>
                {r.kesimpulan === 'dapat_ditindaklanjuti' ? '✓ Lanjut' : '⚠ Perbaikan'}
              </td>
              <td style={tdBorder}>{(r.tindak_lanjut || '').slice(0, 80)}{(r.tindak_lanjut || '').length > 80 ? '...' : ''}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={8} style={{ ...tdBorder, textAlign: 'center', padding: 12 }}>Belum ada data asistensi</td></tr>
          )}
          <tr style={{ background: '#f0f0f0' }}>
            <td colSpan={5} style={{ ...tdBorder, textAlign: 'right', fontWeight: 'bold' }}>TOTAL</td>
            <td style={{ ...tdBorder, textAlign: 'right', fontWeight: 'bold' }}>
              {fmt(rows.reduce((s, r) => s + (r.pagu_usulan || 0), 0))}
            </td>
            <td colSpan={2} style={tdBorder} />
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 9 }}>
        Keterangan: Jumlah OPD diasistensikan = {rows.length} OPD, Lanjut = {rows.filter(r => r.kesimpulan === 'dapat_ditindaklanjuti').length}, Perlu Perbaikan = {rows.filter(r => r.kesimpulan === 'perlu_perbaikan').length}
      </div>
    </div>
  )
}

// ─── REKAP REKONSILIASI ────────────────────────────────────────
export function RekapRekonsiliasi({ rows = [], tahun, triwulan, kabupaten = '…………………' }) {
  const totalPagu = rows.reduce((s, r) => s + (r.pagu || 0), 0)
  const totalReal = rows.reduce((s, r) => s + (r.realisasi_keu || 0), 0)
  const avgFisik  = rows.length ? (rows.reduce((s, r) => s + (r.realisasi_fisik || 0), 0) / rows.length).toFixed(1) : 0
  const pctReal   = totalPagu > 0 ? ((totalReal / totalPagu) * 100).toFixed(1) : 0

  return (
    <div style={docStyle}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>REKAPITULASI HASIL REKONSILIASI REALISASI</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>PENGGUNAAN DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>
          TRIWULAN {triwulan || 'I–IV'} TAHUN ANGGARAN {tahun}
        </div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>
      <table style={tblStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>No</th>
            <th style={thStyle}>No. BA</th>
            <th style={thStyle}>Tanggal</th>
            <th style={thStyle}>OPD / Perangkat Daerah</th>
            <th style={thStyle}>Program</th>
            <th style={thStyle}>Tw</th>
            <th style={{ ...thStyle, width: 80 }}>Pagu (Rp)</th>
            <th style={{ ...thStyle, width: 80 }}>Real. Keu (Rp)</th>
            <th style={{ ...thStyle, width: 55 }}>% Keu</th>
            <th style={{ ...thStyle, width: 50 }}>Fisik %</th>
            <th style={thStyle}>Kesimpulan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pct = r.pagu > 0 ? ((r.realisasi_keu / r.pagu) * 100).toFixed(1) : 0
            return (
              <tr key={r.id}>
                <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
                <td style={tdBorder}>{r.nomor_ba || '—'}</td>
                <td style={{ ...tdBorder, whiteSpace: 'nowrap' }}>{r.tanggal}</td>
                <td style={tdBorder}>{r.opd}</td>
                <td style={tdBorder}>{r.program}</td>
                <td style={{ ...tdBorder, textAlign: 'center' }}>{r.triwulan}</td>
                <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.pagu)}</td>
                <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.realisasi_keu)}</td>
                <td style={{ ...tdBorder, textAlign: 'center' }}>{pct}%</td>
                <td style={{ ...tdBorder, textAlign: 'center' }}>{r.realisasi_fisik}%</td>
                <td style={{ ...tdBorder, textAlign: 'center' }}>
                  {r.kesimpulan === 'sesuai' ? '✓ Sesuai' : '⚠ Perbaikan'}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={11} style={{ ...tdBorder, textAlign: 'center', padding: 12 }}>Belum ada data rekonsiliasi</td></tr>
          )}
          <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
            <td colSpan={6} style={{ ...tdBorder, textAlign: 'right' }}>TOTAL</td>
            <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(totalPagu)}</td>
            <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(totalReal)}</td>
            <td style={{ ...tdBorder, textAlign: 'center' }}>{pctReal}%</td>
            <td style={{ ...tdBorder, textAlign: 'center' }}>{avgFisik}%</td>
            <td style={tdBorder} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── CETAK RKP (sesuai format resmi 8 kolom) ──────────────────
export function CetakRKP({ rows = [], tahun, jenis, kabupaten = '…………………' }) {
  // Kelompokkan per bidang
  const byBidang = {}
  const koorRows = rows.filter(r => r.is_koordinasi)
  const normalRows = rows.filter(r => !r.is_koordinasi)
  BIDANG.forEach(b => {
    byBidang[b.id] = normalRows.filter(r => r.bidang_id === b.id)
  })

  const totalAll = rows.reduce((s, r) => s + (r.pagu || 0) + (r.pagu_bop || 0), 0)

  return (
    <div style={{ ...docStyle, maxWidth: 1050 }}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>RENCANA KEGIATAN DAN PENGANGGARAN (RKP)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>TAHUN ANGGARAN {tahun} — ANGGARAN {jenis.toUpperCase()}</div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>

      <table style={{ ...tblStyle, fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>(1)<br />No.</th>
            <th style={thStyle}>(2)<br />Bidang, Program, dan Kegiatan</th>
            <th style={thStyle}>(3)<br />Rincian Kegiatan dalam Ketentuan Teknis</th>
            <th style={thStyle}>(4)<br />Kode/Klasifikasi Nomenklatur dalam Penganggaran APBD</th>
            <th style={{ ...thStyle, width: 40 }}>(5)<br />Volume</th>
            <th style={{ ...thStyle, width: 40 }}>(6)<br />Satuan</th>
            <th style={{ ...thStyle, width: 80 }}>(7)<br />Pagu Kegiatan (Rp)</th>
            <th style={{ ...thStyle, width: 80 }}>BOP (Rp)<br />(maks 10%)</th>
            <th style={{ ...thStyle, width: 80 }}>Total (Rp)</th>
            <th style={thStyle}>(8)<br />Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {BIDANG.map((b, bi) => {
            const bRows = byBidang[b.id] || []
            const bTotal = bRows.reduce((s, r) => s + (r.pagu || 0) + (r.pagu_bop || 0), 0)
            return (
              <>
                <tr key={'bid-'+b.id} style={{ background: '#d0e8d0' }}>
                  <td style={{ ...tdBorder, fontWeight: 'bold', textAlign: 'center' }}>{String.fromCharCode(65 + bi)}.</td>
                  <td colSpan={9} style={{ ...tdBorder, fontWeight: 'bold' }}>{b.label}</td>
                </tr>
                {bRows.map((r, ri) => (
                  <tr key={r.id}>
                    <td style={{ ...tdBorder, textAlign: 'center' }}>{ri + 1}</td>
                    <td style={tdBorder}>
                      <div style={{ fontWeight: 600 }}>{r.program}</div>
                      <div>{r.kegiatan}</div>
                    </td>
                    <td style={tdBorder}>{r.sub_kegiatan}</td>
                    <td style={tdBorder}>{r.kode_rekening}<br /><span style={{ fontSize: 8 }}>{r.nama_rekening}</span></td>
                    <td style={{ ...tdBorder, textAlign: 'center' }}>{r.volume}</td>
                    <td style={{ ...tdBorder, textAlign: 'center' }}>{r.satuan}</td>
                    <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.pagu)}</td>
                    <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.pagu_bop || 0)}</td>
                    <td style={{ ...tdBorder, textAlign: 'right', fontWeight: 600 }}>{fmt((r.pagu||0)+(r.pagu_bop||0))}</td>
                    <td style={tdBorder}>{r.keterangan}</td>
                  </tr>
                ))}
                {bRows.length === 0 && (
                  <tr key={'empty-'+b.id}>
                    <td colSpan={10} style={{ ...tdBorder, textAlign: 'center', color: '#999', fontStyle: 'italic' }}>—</td>
                  </tr>
                )}
                <tr key={'total-'+b.id} style={{ background: '#e8f4e8', fontWeight: 'bold' }}>
                  <td colSpan={8} style={{ ...tdBorder, textAlign: 'right' }}>Total {b.label}</td>
                  <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(bTotal)}</td>
                  <td style={tdBorder} />
                </tr>
              </>
            )
          })}
          {/* Koordinasi */}
          {koorRows.length > 0 && (
            <>
              <tr style={{ background: '#fdf5e4' }}>
                <td style={{ ...tdBorder, fontWeight: 'bold', textAlign: 'center' }}>D.</td>
                <td colSpan={9} style={{ ...tdBorder, fontWeight: 'bold' }}>Kegiatan Koordinasi Pengelolaan DBH CHT</td>
              </tr>
              {koorRows.map((r, ri) => (
                <tr key={r.id}>
                  <td style={{ ...tdBorder, textAlign: 'center' }}>{ri + 1}</td>
                  <td style={tdBorder}><div style={{ fontWeight: 600 }}>{r.program}</div><div>{r.kegiatan}</div></td>
                  <td style={tdBorder}>{r.sub_kegiatan}</td>
                  <td style={tdBorder}>{r.kode_rekening}<br /><span style={{ fontSize: 8 }}>{r.nama_rekening}</span></td>
                  <td style={{ ...tdBorder, textAlign: 'center' }}>{r.volume}</td>
                  <td style={{ ...tdBorder, textAlign: 'center' }}>{r.satuan}</td>
                  <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.pagu)}</td>
                  <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(r.pagu_bop || 0)}</td>
                  <td style={{ ...tdBorder, textAlign: 'right', fontWeight: 600 }}>{fmt((r.pagu||0)+(r.pagu_bop||0))}</td>
                  <td style={tdBorder}>{r.keterangan}</td>
                </tr>
              ))}
            </>
          )}
          {/* Grand Total */}
          <tr style={{ background: '#c8e6c9', fontWeight: 'bold', fontSize: 11 }}>
            <td colSpan={8} style={{ ...tdBorder, textAlign: 'right' }}>TOTAL KESELURUHAN</td>
            <td style={{ ...tdBorder, textAlign: 'right' }}>{fmt(totalAll)}</td>
            <td style={tdBorder} />
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: 9, fontStyle: 'italic' }}>
        *Biaya operasional pendukung (BOP) maksimal sebesar 10% dari masing-masing pagu kegiatan
      </div>
    </div>
  )
}

// ─── CETAK REALISASI (sesuai format resmi 10 kolom) ───────────
export function CetakRealisasi({ rows = [], tahun, triwulan, kabupaten = '…………………' }) {
  const byBidang = {}
  const koorRows = rows.filter(r => r.is_koordinasi)
  BIDANG.forEach(b => {
    byBidang[b.id] = rows.filter(r => r.bidang_id === b.id && !r.is_koordinasi)
  })
  const totalPagu = rows.reduce((s,r)=>s+(r.pagu||0),0)
  const totalReal = rows.reduce((s,r)=>s+(r.realisasi_keu||0),0)

  return (
    <div style={{ ...docStyle, maxWidth: 1100 }}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>LAPORAN REALISASI PENGGUNAAN</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>
          {triwulan ? 'TRIWULAN ' + triwulan + ' ' : ''}TAHUN ANGGARAN {tahun}
        </div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>
      <table style={{ ...tblStyle, fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }}>(1)<br />No</th>
            <th style={thStyle}>(2)<br />Bidang, Program, dan Kegiatan</th>
            <th style={thStyle}>(3)<br />Rincian Kegiatan dalam Ketentuan Teknis</th>
            <th style={thStyle}>(4)<br />Kode/Klasifikasi Nomenklatur dalam Penganggaran APBD</th>
            <th style={{ ...thStyle, width: 40 }}>(5)<br />Vol</th>
            <th style={{ ...thStyle, width: 40 }}>(6)<br />Sat</th>
            <th style={{ ...thStyle, width: 80 }}>(7)<br />Pagu Kegiatan (Rp)</th>
            <th style={{ ...thStyle, width: 60 }}>(8)<br />Output Rencana</th>
            <th style={{ ...thStyle, width: 80 }}>(9)<br />Realisasi Dana (Rp)</th>
            <th style={{ ...thStyle, width: 60 }}>(10)<br />Realisasi Output / Fisik (%)</th>
            <th style={thStyle}>Ket</th>
          </tr>
        </thead>
        <tbody>
          {BIDANG.map((b, bi) => {
            const bRows = byBidang[b.id] || []
            const bPagu = bRows.reduce((s,r)=>s+(r.pagu||0),0)
            const bReal = bRows.reduce((s,r)=>s+(r.realisasi_keu||0),0)
            return (
              <>
                <tr key={'bid-'+b.id} style={{ background: '#d0e8d0' }}>
                  <td style={{ ...tdBorder, fontWeight: 'bold', textAlign: 'center' }}>{String.fromCharCode(65+bi)}.</td>
                  <td colSpan={10} style={{ ...tdBorder, fontWeight: 'bold' }}>{b.label}</td>
                </tr>
                {bRows.map((r,ri)=>(
                  <tr key={r.id}>
                    <td style={{ ...tdBorder, textAlign: 'center' }}>{ri+1}</td>
                    <td style={tdBorder}><div style={{ fontWeight:600 }}>{r.program}</div><div>{r.kegiatan}</div></td>
                    <td style={tdBorder}>{r.sub_kegiatan}</td>
                    <td style={tdBorder}>{r.kode_rekening}</td>
                    <td style={{ ...tdBorder, textAlign:'center' }}>{r.volume}</td>
                    <td style={{ ...tdBorder, textAlign:'center' }}>{r.satuan}</td>
                    <td style={{ ...tdBorder, textAlign:'right' }}>{fmt(r.pagu)}</td>
                    <td style={tdBorder}>{r.target_output||r.capaian_output||''}</td>
                    <td style={{ ...tdBorder, textAlign:'right', fontWeight:600 }}>{fmt(r.realisasi_keu)}</td>
                    <td style={{ ...tdBorder, textAlign:'center' }}>{r.realisasi_fisik||0}%</td>
                    <td style={tdBorder}>{r.keterangan}</td>
                  </tr>
                ))}
                {bRows.length===0&&(
                  <tr><td colSpan={11} style={{ ...tdBorder, textAlign:'center', color:'#999', fontStyle:'italic' }}>—</td></tr>
                )}
                <tr key={'total-'+b.id} style={{ background:'#e8f4e8', fontWeight:'bold' }}>
                  <td colSpan={6} style={{ ...tdBorder, textAlign:'right' }}>Total {b.label}</td>
                  <td style={{ ...tdBorder, textAlign:'right' }}>{fmt(bPagu)}</td>
                  <td style={tdBorder}/>
                  <td style={{ ...tdBorder, textAlign:'right' }}>{fmt(bReal)}</td>
                  <td style={{ ...tdBorder, textAlign:'center' }}>{bPagu>0?((bReal/bPagu)*100).toFixed(1):0}%</td>
                  <td style={tdBorder}/>
                </tr>
              </>
            )
          })}
          {koorRows.length>0&&(
            <>
              <tr style={{ background:'#fdf5e4' }}>
                <td style={{ ...tdBorder, fontWeight:'bold', textAlign:'center' }}>D.</td>
                <td colSpan={10} style={{ ...tdBorder, fontWeight:'bold' }}>Kegiatan Koordinasi Pengelolaan DBH CHT</td>
              </tr>
              {koorRows.map((r,ri)=>(
                <tr key={r.id}>
                  <td style={{ ...tdBorder, textAlign:'center' }}>{ri+1}</td>
                  <td style={tdBorder}><div style={{ fontWeight:600 }}>{r.program}</div><div>{r.kegiatan}</div></td>
                  <td style={tdBorder}>{r.sub_kegiatan}</td>
                  <td style={tdBorder}>{r.kode_rekening}</td>
                  <td style={{ ...tdBorder, textAlign:'center' }}>{r.volume}</td>
                  <td style={{ ...tdBorder, textAlign:'center' }}>{r.satuan}</td>
                  <td style={{ ...tdBorder, textAlign:'right' }}>{fmt(r.pagu)}</td>
                  <td style={tdBorder}>{r.target_output||r.capaian_output||''}</td>
                  <td style={{ ...tdBorder, textAlign:'right', fontWeight:600 }}>{fmt(r.realisasi_keu)}</td>
                  <td style={{ ...tdBorder, textAlign:'center' }}>{r.realisasi_fisik||0}%</td>
                  <td style={tdBorder}>{r.keterangan}</td>
                </tr>
              ))}
            </>
          )}
          <tr style={{ background:'#c8e6c9', fontWeight:'bold', fontSize:11 }}>
            <td colSpan={6} style={{ ...tdBorder, textAlign:'right' }}>TOTAL KESELURUHAN</td>
            <td style={{ ...tdBorder, textAlign:'right' }}>{fmt(totalPagu)}</td>
            <td style={tdBorder}/>
            <td style={{ ...tdBorder, textAlign:'right' }}>{fmt(totalReal)}</td>
            <td style={{ ...tdBorder, textAlign:'center' }}>{totalPagu>0?((totalReal/totalPagu)*100).toFixed(1):0}%</td>
            <td style={tdBorder}/>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── HALAMAN LAPORAN UTAMA ─────────────────────────────────────
export default function Laporan() {
  useEffect(() => { injectPrintCss() }, [])

  const { tahun, jenis, notify } = useApp()
  const { profile, isSekretariat } = useAuth()
  const [menu,     setMenu]    = useState('asistensi') // asistensi|rekonsiliasi|rkp|realisasi
  const [asisRows, setAsis]    = useState([])
  const [rekonRows,setRekon]   = useState([])
  const [rkpRows,  setRkp]     = useState([])
  const [realRows, setReal]    = useState([])
  const [selBA,    setSelBA]   = useState(null)
  const [twFilter, setTwFilter]= useState('')
  const [kabupaten,setKab]     = useState(() => localStorage.getItem('simdbh_kabupaten') || 'Kabupaten …………………')
  const printRef = useRef()

  useEffect(() => { loadAll() }, [tahun, jenis])

  async function loadAll() {
    const uid = profile?.id
    const isSkrt = isSekretariat

    // Asistensi — sekretariat lihat semua, OPD lihat miliknya
    const aq = supabase.from('asistensi_dbhcht').select('*').eq('tahun', tahun).order('tanggal')
    if (!isSkrt && uid) aq.eq('opd_user_id', uid)
    const { data: a } = await aq
    setAsis(a || [])

    // Rekonsiliasi
    const rq = supabase.from('rekonsiliasi_dbhcht').select('*').eq('tahun', tahun).order('tanggal')
    if (!isSkrt && uid) rq.eq('opd_user_id', uid)
    const { data: rk } = await rq
    setRekon(rk || [])

    // RKP
    let rkpQ = supabase.from('rkp_dbhcht').select('*').eq('tahun', tahun).eq('jenis', jenis).order('bidang_id')
    if (!isSkrt && uid) rkpQ = rkpQ.eq('created_by', uid)
    const { data: rv } = await rkpQ
    setRkp(rv || [])

    // Realisasi
    let realQ = supabase.from('realisasi_dbhcht').select('*').eq('tahun', tahun).order('triwulan')
    if (!isSkrt && uid) realQ = realQ.eq('created_by', uid)
    const { data: rl } = await realQ
    setReal(rl || [])
  }

  function doPrint() {
    window.print()
  }

  const rekonFiltered = twFilter ? rekonRows.filter(r => r.triwulan === twFilter) : rekonRows
  const realFiltered  = twFilter ? realRows.filter(r => r.triwulan === twFilter)  : realRows

  const MENUS = [
    { id: 'asistensi',    label: '🤝 BA Asistensi',      count: asisRows.length },
    { id: 'rekap_asis',   label: '📋 Rekap Asistensi',   count: asisRows.length },
    { id: 'rekonsiliasi', label: '🔄 BA Rekonsiliasi',    count: rekonRows.length },
    { id: 'rekap_rekon',  label: '📋 Rekap Rekonsiliasi', count: rekonRows.length },
    { id: 'rkp',          label: '📄 Cetak RKP',          count: rkpRows.length },
    { id: 'realisasi',    label: '📈 Laporan Realisasi',  count: realRows.length },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
        <div className="page-title" style={{ margin: 0 }}>🖨️ Laporan & Cetak Dokumen</div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-control"
            style={{ width: 220 }}
            value={kabupaten}
            onChange={e => { setKab(e.target.value); localStorage.setItem('simdbh_kabupaten', e.target.value) }}
            placeholder="Nama Kab/Kota (untuk header dokumen)"
          />
          <button className="btn btn-primary" onClick={doPrint}>🖨️ Cetak</button>
        </div>
      </div>

      {/* Menu tabs */}
      <div className="tabs no-print">
        {MENUS.map(m => (
          <div key={m.id} className={`tab ${menu === m.id ? 'active' : ''}`} onClick={() => { setMenu(m.id); setSelBA(null) }}>
            {m.label} <span style={{ fontSize: '.7rem', color: 'var(--text2)', marginLeft: 3 }}>({m.count})</span>
          </div>
        ))}
      </div>

      {/* Filter triwulan untuk rekonsiliasi/realisasi */}
      {(menu === 'rekonsiliasi' || menu === 'rekap_rekon' || menu === 'realisasi') && (
        <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '.82rem', color: 'var(--text2)' }}>Filter Triwulan:</label>
          <select className="form-control" style={{ width: 160 }} value={twFilter} onChange={e => setTwFilter(e.target.value)}>
            <option value="">Semua Triwulan</option>
            {['I','II','III','IV'].map(t => <option key={t} value={t}>Triwulan {t}</option>)}
          </select>
        </div>
      )}

      {/* Print area */}
      <div id="print-area" ref={printRef}>

        {/* BA ASISTENSI — pilih satu per satu */}
        {menu === 'asistensi' && (
          <div>
            {!selBA ? (
              <div className="card no-print">
                <div className="card-title">Pilih Berita Acara untuk Pratinjau</div>
                <table>
                  <thead><tr>
                    <th>No. BA</th><th>Tanggal</th><th>OPD</th><th>Program</th><th>Pagu</th><th>Kesimpulan</th><th>Aksi</th>
                  </tr></thead>
                  <tbody>
                    {asisRows.length === 0 && <tr><td colSpan={7} className="empty-state">Belum ada data asistensi</td></tr>}
                    {asisRows.map(r => (
                      <tr key={r.id}>
                        <td>{r.nomor_ba||'—'}</td>
                        <td>{r.tanggal}</td>
                        <td className="td-bold">{r.opd}</td>
                        <td style={{ fontSize: '.8rem' }}>{r.program}</td>
                        <td className="td-money">{fmtRp(r.pagu_usulan)}</td>
                        <td><span className={`badge ${r.kesimpulan==='dapat_ditindaklanjuti'?'badge-green':'badge-amber'}`}>{r.kesimpulan==='dapat_ditindaklanjuti'?'✅ Lanjut':'⚠️ Perbaikan'}</span></td>
                        <td><button className="btn btn-primary btn-sm" onClick={() => setSelBA(r)}>👁️ Pratinjau</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setSelBA(null)}>← Kembali ke Daftar</button>
                  <button className="btn btn-primary btn-sm" onClick={doPrint}>🖨️ Cetak BA Ini</button>
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <CetakAistensi data={selBA} kabupaten={kabupaten} />
                </div>
              </>
            )}
          </div>
        )}

        {/* REKAP ASISTENSI */}
        {menu === 'rekap_asis' && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <RekapAisistensi rows={asisRows} tahun={tahun} kabupaten={kabupaten} />
          </div>
        )}

        {/* BA REKONSILIASI */}
        {menu === 'rekonsiliasi' && (
          <div>
            {!selBA ? (
              <div className="card no-print">
                <div className="card-title">Pilih Berita Acara Rekonsiliasi untuk Pratinjau</div>
                <table>
                  <thead><tr>
                    <th>No. BA</th><th>Tanggal</th><th>OPD</th><th>Tw</th><th>Pagu</th><th>Real. Keu</th><th>Fisik</th><th>Aksi</th>
                  </tr></thead>
                  <tbody>
                    {rekonFiltered.length === 0 && <tr><td colSpan={8} className="empty-state">Belum ada data rekonsiliasi</td></tr>}
                    {rekonFiltered.map(r => (
                      <tr key={r.id}>
                        <td>{r.nomor_ba||'—'}</td>
                        <td>{r.tanggal}</td>
                        <td className="td-bold">{r.opd}</td>
                        <td><span className="badge badge-blue">Tw {r.triwulan}</span></td>
                        <td className="td-muted">{fmtRp(r.pagu)}</td>
                        <td className="td-money">{fmtRp(r.realisasi_keu)}</td>
                        <td>{r.realisasi_fisik}%</td>
                        <td><button className="btn btn-primary btn-sm" onClick={() => setSelBA(r)}>👁️ Pratinjau</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div className="no-print" style={{ marginBottom: '.75rem', display: 'flex', gap: '.5rem' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setSelBA(null)}>← Kembali</button>
                  <button className="btn btn-primary btn-sm" onClick={doPrint}>🖨️ Cetak BA Ini</button>
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <CetakRekonsiliasi data={selBA} kabupaten={kabupaten} />
                </div>
              </>
            )}
          </div>
        )}

        {/* REKAP REKONSILIASI */}
        {menu === 'rekap_rekon' && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <RekapRekonsiliasi rows={rekonFiltered} tahun={tahun} triwulan={twFilter} kabupaten={kabupaten} />
          </div>
        )}

        {/* CETAK RKP */}
        {menu === 'rkp' && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <CetakRKP rows={rkpRows} tahun={tahun} jenis={jenis} kabupaten={kabupaten} />
          </div>
        )}

        {/* LAPORAN REALISASI */}
        {menu === 'realisasi' && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <CetakRealisasi rows={realFiltered} tahun={tahun} triwulan={twFilter} kabupaten={kabupaten} />
          </div>
        )}
      </div>
    </div>
  )
}
