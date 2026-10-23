import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, fmtRp, maxBop } from '../lib/constants.js'
import { Modal, StatBox } from '../components/UI.jsx'
import {
  S, fmt, KOTA, JABATAN_DIWAKILI_OPTIONS, TandaTanganFleksibel,
  setPageOrientation, OrientToggle, buildBarisRkpPerubahan,
} from './Laporan.jsx'

// ══════════════════════════════════════════════════════════════
//  REKAP RKP LENGKAP (Murni / Perubahan)
//  Semua bidang + kegiatan koordinasi dalam 1 dokumen, siap cetak & unduh.
//  Format mengikuti dokumen RKP yang sudah dipakai di menu Laporan:
//   - Murni     : kolom (1)–(8) Bidang, Program, Kegiatan, Kode, Vol, Sat, Pagu, Ket.
//   - Perubahan : kolom Semula / Menjadi (Lampiran F PMK 22/2026)
//  Data hanya dibaca (SELECT) — tidak ada penulisan ke tabel apa pun dari sini.
// ══════════════════════════════════════════════════════════════

const TTD_KEY = 'simdbh_ttd_rekap'
const TTD_EMPTY = {
  namaKoordinator: '', nipKoordinator: '', jabatanKoordinator: '',
  tempat: KOTA, tanggal: '',
  jabatanPenandatangan: '', namaPejabat: '', nipPejabat: '', atasNama: false,
  jabatanDiwakili: JABATAN_DIWAKILI_OPTIONS[0],
}

function loadTtd() {
  try {
    const raw = localStorage.getItem(TTD_KEY)
    if (raw) return { ...TTD_EMPTY, ...JSON.parse(raw), tanggal: '' }
  } catch { /* storage bisa diblokir — abaikan */ }
  return TTD_EMPTY
}
function saveTtd(t) {
  try { localStorage.setItem(TTD_KEY, JSON.stringify({ ...t, tanggal: '' })) } catch { /* abaikan */ }
}

// ── Switch tampilan "Input Data | Rekap Lengkap" (dipakai RKP.jsx) ──
export function RkpViewSwitch({ view, onChange }) {
  const opts = [
    { id: 'input', icon: '✍️', label: 'Input Data' },
    { id: 'rekap', icon: '📚', label: 'Rekap Lengkap' },
  ]
  return (
    <div className="seg no-print" role="tablist" aria-label="Tampilan penyusunan RKP">
      {opts.map(o => (
        <button key={o.id} type="button" role="tab" aria-selected={view === o.id}
          className={`seg-btn ${view === o.id ? 'active' : ''}`} onClick={() => onChange(o.id)}>
          <span aria-hidden="true">{o.icon}</span> {o.label}
        </button>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  MODEL DATA — satu bentuk baris untuk Murni & Perubahan
//  pagu/bop/total/vol/sat = nilai berlaku (Murni, atau "Menjadi" pada Perubahan)
//  totalS/volS/satS       = nilai "Semula" (hanya Perubahan)
// ══════════════════════════════════════════════════════════════
function normalisasi(mode, murniRows, perubahanRows) {
  if (mode === 'Perubahan') {
    return buildBarisRkpPerubahan(murniRows, perubahanRows).map(r => ({
      id: r.id, bidang_id: r.bidang_id, is_koordinasi: !!r.is_koordinasi,
      program: r.program || '(Tanpa Program)', kegiatan: r.kegiatan || '', sub: r.sub_kegiatan || '',
      kode: r.kode_rekening || '', namaRek: r.nama_rekening || '', ket: r.keterangan || '', isBaru: !!r.isBaru,
      vol: r.volumeMenjadi, sat: r.satuanMenjadi || '',
      pagu: r.paguMenjadi || 0, bop: r.bopMenjadi || 0,
      volS: r.volumeSemula, satS: r.satuanSemula || '',
      paguS: r.paguSemula || 0, bopS: r.bopSemula || 0,
    }))
  }
  return murniRows.map(r => ({
    id: r.id, bidang_id: r.bidang_id, is_koordinasi: !!r.is_koordinasi,
    program: r.program || '(Tanpa Program)', kegiatan: r.kegiatan || '', sub: r.sub_kegiatan || '',
    kode: r.kode_rekening || '', namaRek: r.nama_rekening || '', ket: r.keterangan || '', isBaru: false,
    vol: r.volume, sat: r.satuan || '',
    pagu: r.pagu || 0, bop: r.pagu_bop || 0,
    volS: null, satS: '', paguS: 0, bopS: 0,
  }))
}

function buildModel(mode, murniRows, perubahanRows, paguMurni, paguPerubahan) {
  const rows = normalisasi(mode, murniRows, perubahanRows)
  const paguAktif = mode === 'Perubahan' ? paguPerubahan : paguMurni

  const defs = [
    ...BIDANG.map(b => ({ id: b.id, label: b.label, short: b.short, icon: b.icon, isKoor: false })),
    { id: 'koordinasi', label: KOORDINASI.label, short: KOORDINASI.short, icon: KOORDINASI.icon, isKoor: true },
  ]
  const known = new Set(defs.map(d => d.id))
  const groupOf = r => (r.is_koordinasi || r.bidang_id === 'koordinasi') ? 'koordinasi' : r.bidang_id

  // Baris dengan bidang tak dikenal tetap dihitung (supaya total selalu cocok), dikelompokkan sendiri.
  const orphan = rows.filter(r => !known.has(groupOf(r)))
  if (orphan.length) defs.push({ id: '__lain', label: 'Lainnya (bidang belum terklasifikasi)', short: 'Lainnya', icon: '❔', isKoor: false })

  const totalPaguAlokasi = paguAktif?.total_pagu || 0

  const groups = defs.map((d, i) => {
    const gRows = rows.filter(r => d.id === '__lain' ? !known.has(groupOf(r)) : groupOf(r) === d.id)
    // kelompokkan per program (urutan kemunculan dipertahankan)
    const progMap = new Map()
    gRows.forEach(r => { if (!progMap.has(r.program)) progMap.set(r.program, []); progMap.get(r.program).push(r) })
    let no = 0
    const programs = [...progMap.entries()].map(([name, list]) => ({
      name,
      rows: list.map(r => ({ ...r, no: ++no, total: r.pagu + r.bop, totalS: r.paguS + r.bopS })),
    }))
    const sumPagu = gRows.reduce((s, r) => s + r.pagu, 0)
    const sumBop = gRows.reduce((s, r) => s + r.bop, 0)
    const sumS = gRows.reduce((s, r) => s + r.paguS + r.bopS, 0)
    const pctAlok = d.isKoor || d.id === '__lain' ? null : (paguAktif?.[`pct_${d.id}`] ?? BIDANG.find(b => b.id === d.id)?.pct ?? null)
    const alokasi = pctAlok != null && totalPaguAlokasi > 0 ? Math.round(totalPaguAlokasi * pctAlok / 100) : null
    return {
      ...d, letter: String.fromCharCode(65 + i), programs, count: gRows.length,
      sumPagu, sumBop, sum: sumPagu + sumBop, sumS, pctAlok, alokasi,
    }
  })

  const total = groups.reduce((s, g) => s + g.sum, 0)
  const totalS = groups.reduce((s, g) => s + g.sumS, 0)
  const totalPagu = groups.reduce((s, g) => s + g.sumPagu, 0)
  const totalBop = groups.reduce((s, g) => s + g.sumBop, 0)
  const count = groups.reduce((s, g) => s + g.count, 0)

  // Pagu alokasi untuk kop dokumen
  const paguAlokasi = mode === 'Perubahan' ? (paguMurni?.total_pagu || 0) : totalPaguAlokasi
  const sisaSilpa = mode === 'Perubahan' ? ((paguPerubahan?.total_pagu || 0) - (paguMurni?.total_pagu || 0)) : 0
  const batasPagu = mode === 'Perubahan' ? paguAlokasi + sisaSilpa : paguAlokasi

  // Pemeriksaan otomatis
  const bopLebih = rows.filter(r => r.bop > maxBop(r.pagu)).length
  const tanpaKode = rows.filter(r => !r.kode).length
  const tanpaProgram = rows.filter(r => r.program === '(Tanpa Program)').length

  return {
    mode, groups, total, totalS, totalPagu, totalBop, count,
    paguAlokasi, sisaSilpa, batasPagu, sisaBelum: batasPagu - total,
    checks: { bopLebih, tanpaKode, tanpaProgram, adaPagu: batasPagu > 0 },
  }
}

// ══════════════════════════════════════════════════════════════
//  DOKUMEN CETAK
// ══════════════════════════════════════════════════════════════
const BG = { head: '#c6e0b4', sub: '#e2efda', koor: '#fce4d6', prog: '#f2f2f2', total: '#a9d18e' }

function DokumenRekapRKP({ model, tahun, jenis, kabupaten = KOTA, ttd }) {
  const per = model.mode === 'Perubahan'
  const colSpanAll = per ? 11 : 10
  const num = (v, bold) => ({ ...S.td, ...S.right, ...(bold ? S.bold : {}) })
  const cap = (n) => (n < 0 ? `(${fmt(Math.abs(n))})` : fmt(n))

  return (
    <div style={{ ...S.doc, maxWidth: 1050 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>REKAPITULASI RENCANA KEGIATAN DAN PENGANGGARAN {per ? 'PERUBAHAN ' : ''}(RKP)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</div>
        <div style={{ fontWeight: 'bold', fontSize: 12 }}>TAHUN ANGGARAN {tahun} — {jenis?.toUpperCase()}</div>
        <div style={{ fontStyle: 'italic', fontSize: 10, marginTop: 2 }}>{kabupaten}</div>
      </div>

      {/* Kop pagu */}
      <table style={{ width: 430, fontSize: 10, marginBottom: 10, borderCollapse: 'collapse' }}>
        <tbody>
          <tr><td style={{ padding: '1px 4px' }}>{per ? 'Pagu Alokasi DBH CHT (Murni)' : 'Pagu Alokasi DBH CHT'}</td><td style={{ padding: '1px 4px' }}>:</td><td style={{ padding: '1px 4px', textAlign: 'right' }}>Rp {fmt(model.paguAlokasi)}</td></tr>
          {per && <tr><td style={{ padding: '1px 4px' }}>Sisa Pagu DBH CHT TA Sebelumnya yang dianggarkan</td><td style={{ padding: '1px 4px' }}>:</td><td style={{ padding: '1px 4px', textAlign: 'right' }}>Rp {fmt(model.sisaSilpa)}</td></tr>}
          {per && <tr style={{ fontWeight: 'bold', borderTop: '1px solid #000' }}><td style={{ padding: '1px 4px' }}>Total Pagu</td><td style={{ padding: '1px 4px' }}>:</td><td style={{ padding: '1px 4px', textAlign: 'right' }}>Rp {fmt(model.batasPagu)}</td></tr>}
          <tr><td style={{ padding: '1px 4px' }}>Total RKP yang disusun</td><td style={{ padding: '1px 4px' }}>:</td><td style={{ padding: '1px 4px', textAlign: 'right' }}>Rp {fmt(model.total)}</td></tr>
          <tr style={{ fontWeight: 'bold' }}><td style={{ padding: '1px 4px' }}>Sisa pagu belum dianggarkan</td><td style={{ padding: '1px 4px' }}>:</td><td style={{ padding: '1px 4px', textAlign: 'right' }}>Rp {cap(model.sisaBelum)}</td></tr>
        </tbody>
      </table>

      {/* I. Rekapitulasi per bidang */}
      <div style={{ fontWeight: 'bold', fontSize: 11, margin: '4px 0 4px' }}>I. REKAPITULASI PER BIDANG</div>
      <table style={{ ...S.tbl, fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 34 }}>No.</th>
            <th style={S.th}>Bidang / Kegiatan</th>
            <th style={S.th}>Jumlah Kegiatan</th>
            {per ? (<>
              <th style={S.th}>Semula (Rp)</th>
              <th style={S.th}>Menjadi (Rp)</th>
              <th style={S.th}>Selisih (Rp)</th>
            </>) : (<>
              <th style={S.th}>Pagu Kegiatan (Rp)</th>
              <th style={S.th}>BOP ≤10% (Rp)</th>
              <th style={S.th}>Total (Rp)</th>
            </>)}
            <th style={S.th}>% thd Total RKP</th>
            <th style={S.th}>Alokasi (Rp)</th>
            <th style={S.th}>Sisa Alokasi (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {model.groups.map(g => (
            <tr key={g.id} style={g.isKoor ? { background: BG.koor } : undefined}>
              <td style={{ ...S.td, ...S.center, ...S.bold }}>{g.letter}.</td>
              <td style={S.td}>{g.label}</td>
              <td style={{ ...S.td, ...S.center }}>{g.count}</td>
              {per ? (<>
                <td style={num()}>{fmt(g.sumS)}</td>
                <td style={num(true)}>{fmt(g.sum)}</td>
                <td style={num()}>{cap(g.sum - g.sumS)}</td>
              </>) : (<>
                <td style={num()}>{fmt(g.sumPagu)}</td>
                <td style={num()}>{fmt(g.sumBop)}</td>
                <td style={num(true)}>{fmt(g.sum)}</td>
              </>)}
              <td style={{ ...S.td, ...S.center }}>{model.total > 0 ? ((g.sum / model.total) * 100).toFixed(1) + '%' : '0,0%'}</td>
              <td style={num()}>{g.alokasi != null ? `${fmt(g.alokasi)}` : '—'}</td>
              <td style={num()}>{g.alokasi != null ? cap(g.alokasi - g.sum) : '—'}</td>
            </tr>
          ))}
          <tr style={{ background: BG.total, fontWeight: 'bold' }}>
            <td colSpan={2} style={{ ...S.td, ...S.right }}>TOTAL</td>
            <td style={{ ...S.td, ...S.center }}>{model.count}</td>
            {per ? (<>
              <td style={num()}>{fmt(model.totalS)}</td>
              <td style={num()}>{fmt(model.total)}</td>
              <td style={num()}>{cap(model.total - model.totalS)}</td>
            </>) : (<>
              <td style={num()}>{fmt(model.totalPagu)}</td>
              <td style={num()}>{fmt(model.totalBop)}</td>
              <td style={num()}>{fmt(model.total)}</td>
            </>)}
            <td style={{ ...S.td, ...S.center }}>100%</td>
            <td style={num()}>—</td>
            <td style={num()}>—</td>
          </tr>
        </tbody>
      </table>

      {/* II. Rincian */}
      <div style={{ fontWeight: 'bold', fontSize: 11, margin: '10px 0 4px' }}>II. RINCIAN KEGIATAN</div>
      <table style={{ ...S.tbl, fontSize: per ? 8.5 : 9 }}>
        <thead>
          {per ? (<>
            <tr>
              <th rowSpan={2} style={{ ...S.th, width: '3%', minWidth: 34 }}>No.</th>
              <th rowSpan={2} style={{ ...S.th, width: '19%' }}>Bidang, Program, dan Kegiatan</th>
              <th rowSpan={2} style={{ ...S.th, width: '16%' }}>Rincian Kegiatan dalam Ketentuan Teknis</th>
              <th rowSpan={2} style={{ ...S.th, width: '17%' }}>Kode/Klasifikasi Nomenklatur dalam Penganggaran APBD</th>
              <th colSpan={3} style={S.th}>Semula</th>
              <th colSpan={3} style={S.th}>Menjadi</th>
              <th rowSpan={2} style={{ ...S.th, width: '11%' }}>Keterangan</th>
            </tr>
            <tr>
              <th style={{ ...S.th, width: '4%' }}>Vol</th>
              <th style={{ ...S.th, width: '4%' }}>Sat</th>
              <th style={{ ...S.th, width: '9%' }}>Pagu Kegiatan (Rp)</th>
              <th style={{ ...S.th, width: '4%' }}>Vol</th>
              <th style={{ ...S.th, width: '4%' }}>Sat</th>
              <th style={{ ...S.th, width: '9%' }}>Pagu Kegiatan (Rp)</th>
            </tr>
            <tr>{Array.from({ length: 11 }, (_, i) => <th key={i} style={S.th}>({i + 1})</th>)}</tr>
          </>) : (<>
            <tr>
              <th style={{ ...S.th, width: 34 }}>(1)<br />No.</th>
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
          </>)}
        </thead>
        <tbody>
          {model.groups.map(g => {
            const headBg = g.isKoor ? BG.koor : BG.head
            const subBg = g.isKoor ? BG.koor : BG.sub
            return [
              <tr key={'h-' + g.id} style={{ background: headBg }}>
                <td style={{ ...S.td, ...S.bold, ...S.center }}>{g.letter}.</td>
                <td colSpan={colSpanAll - 1} style={{ ...S.td, ...S.bold }}>{g.label}</td>
              </tr>,
              ...(g.count === 0 ? [
                <tr key={'e-' + g.id}><td colSpan={colSpanAll} style={{ ...S.td, ...S.center, color: '#999', fontStyle: 'italic' }}>— belum ada kegiatan —</td></tr>,
              ] : g.programs.flatMap((p, pi) => [
                <tr key={`p-${g.id}-${pi}`} style={{ background: BG.prog }}>
                  <td style={S.td} />
                  <td colSpan={colSpanAll - 1} style={{ ...S.td, ...S.bold, fontStyle: 'italic' }}>{p.name}</td>
                </tr>,
                ...p.rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...S.td, ...S.center }}>{r.no}</td>
                    <td style={S.td}>
                      {r.kegiatan || <span style={{ color: '#777' }}>—</span>}
                      {r.isBaru && <span style={{ fontStyle: 'italic' }}> (Kegiatan Baru)</span>}
                    </td>
                    <td style={S.td}>{r.sub}</td>
                    <td style={S.td}><div>{r.kode}</div>{r.namaRek && <div style={{ fontSize: 8 }}>{r.namaRek}</div>}</td>
                    {per ? (<>
                      <td style={{ ...S.td, ...S.center }}>{r.isBaru ? '—' : (r.volS ?? '')}</td>
                      <td style={{ ...S.td, ...S.center }}>{r.isBaru ? '—' : r.satS}</td>
                      <td style={num()}>{r.isBaru ? '—' : fmt(r.totalS)}</td>
                      <td style={{ ...S.td, ...S.center }}>{r.vol ?? ''}</td>
                      <td style={{ ...S.td, ...S.center }}>{r.sat}</td>
                      <td style={num(true)}>{fmt(r.total)}</td>
                    </>) : (<>
                      <td style={{ ...S.td, ...S.center }}>{r.vol ?? ''}</td>
                      <td style={{ ...S.td, ...S.center }}>{r.sat}</td>
                      <td style={num()}>{fmt(r.pagu)}</td>
                      <td style={num()}>{fmt(r.bop)}</td>
                      <td style={num(true)}>{fmt(r.total)}</td>
                    </>)}
                    <td style={S.td}>{r.ket}</td>
                  </tr>
                )),
              ])),
              <tr key={'t-' + g.id} style={{ background: subBg, fontWeight: 'bold' }}>
                {per ? (<>
                  <td colSpan={6} style={{ ...S.td, ...S.right }}>Total {g.label}</td>
                  <td style={num()}>{fmt(g.sumS)}</td>
                  <td colSpan={2} style={S.td} />
                  <td style={num()}>{fmt(g.sum)}</td>
                  <td style={S.td} />
                </>) : (<>
                  <td colSpan={6} style={{ ...S.td, ...S.right }}>Total {g.label}</td>
                  <td style={num()}>{fmt(g.sumPagu)}</td>
                  <td style={num()}>{fmt(g.sumBop)}</td>
                  <td style={num()}>{fmt(g.sum)}</td>
                  <td style={S.td} />
                </>)}
              </tr>,
            ]
          })}
          <tr style={{ background: BG.total, fontWeight: 'bold', fontSize: 10 }}>
            {per ? (<>
              <td colSpan={6} style={{ ...S.td, ...S.right }}>TOTAL KESELURUHAN</td>
              <td style={num()}>{fmt(model.totalS)}</td>
              <td colSpan={2} style={S.td} />
              <td style={num()}>{fmt(model.total)}</td>
              <td style={S.td} />
            </>) : (<>
              <td colSpan={6} style={{ ...S.td, ...S.right }}>TOTAL KESELURUHAN</td>
              <td style={num()}>{fmt(model.totalPagu)}</td>
              <td style={num()}>{fmt(model.totalBop)}</td>
              <td style={num()}>{fmt(model.total)}</td>
              <td style={S.td} />
            </>)}
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 6, fontSize: 9, fontStyle: 'italic' }}>
        *Biaya operasional pendukung (BOP) maksimal sebesar 10% dari masing-masing kegiatan.
        {per && ` Kolom Semula bersumber dari RKP Murni TA ${tahun}.`}
      </div>
      <TandaTanganFleksibel ttd={ttd} kabupaten={kabupaten} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  EXPORT EXCEL (.xls berbasis tabel HTML — terbuka langsung di Excel/LibreOffice)
//  Semua nilai di-escape; sel teks dipaksa bertipe teks agar tidak dieksekusi sebagai rumus.
// ══════════════════════════════════════════════════════════════
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const tx = (v, extra = '') => `<td style="mso-number-format:'\\@';border:.5pt solid #000;vertical-align:top;${extra}">${esc(v)}</td>`
const nm = (v, extra = '') => `<td style="mso-number-format:'#,##0';border:.5pt solid #000;text-align:right;${extra}">${Number(v) || 0}</td>`
const th = (v, extra = '') => `<th style="border:.5pt solid #000;background:#d9d9d9;${extra}">${esc(v)}</th>`

function buildExcelHtml(model, tahun, jenis, ttd) {
  const per = model.mode === 'Perubahan'
  const cols = per ? 12 : 11
  const out = []
  out.push(`<tr><td colspan="${cols}" style="font-weight:bold;font-size:13pt;text-align:center">REKAPITULASI RENCANA KEGIATAN DAN PENGANGGARAN ${per ? 'PERUBAHAN ' : ''}(RKP)</td></tr>`)
  out.push(`<tr><td colspan="${cols}" style="font-weight:bold;text-align:center">DANA BAGI HASIL CUKAI HASIL TEMBAKAU (DBH CHT)</td></tr>`)
  out.push(`<tr><td colspan="${cols}" style="font-weight:bold;text-align:center">TAHUN ANGGARAN ${esc(tahun)} — ${esc(jenis.toUpperCase())}</td></tr>`)
  out.push(`<tr><td colspan="${cols}" style="text-align:center;font-style:italic">${esc(KOTA)}</td></tr><tr><td></td></tr>`)
  out.push(`<tr><td colspan="3">Pagu Alokasi DBH CHT${per ? ' (Murni)' : ''}</td>${nm(model.paguAlokasi)}</tr>`)
  if (per) {
    out.push(`<tr><td colspan="3">Sisa Pagu TA Sebelumnya yang dianggarkan</td>${nm(model.sisaSilpa)}</tr>`)
    out.push(`<tr><td colspan="3">Total Pagu</td>${nm(model.batasPagu)}</tr>`)
  }
  out.push(`<tr><td colspan="3">Total RKP yang disusun</td>${nm(model.total)}</tr>`)
  out.push(`<tr><td colspan="3"><b>Sisa pagu belum dianggarkan</b></td>${nm(model.sisaBelum)}</tr><tr><td></td></tr>`)

  // I. Rekap
  out.push(`<tr><td colspan="${cols}" style="font-weight:bold">I. REKAPITULASI PER BIDANG</td></tr>`)
  out.push('<tr>' + [th('No'), th('Bidang / Kegiatan'), th('Jumlah Kegiatan'),
    ...(per ? [th('Semula (Rp)'), th('Menjadi (Rp)'), th('Selisih (Rp)')] : [th('Pagu Kegiatan (Rp)'), th('BOP (Rp)'), th('Total (Rp)')]),
    th('% thd Total'), th('Alokasi (Rp)'), th('Sisa Alokasi (Rp)')].join('') + '</tr>')
  model.groups.forEach(g => {
    out.push('<tr>' + [tx(g.letter + '.'), tx(g.label), nm(g.count),
      ...(per ? [nm(g.sumS), nm(g.sum), nm(g.sum - g.sumS)] : [nm(g.sumPagu), nm(g.sumBop), nm(g.sum)]),
      tx(model.total > 0 ? ((g.sum / model.total) * 100).toFixed(1) + '%' : '0%'),
      g.alokasi != null ? nm(g.alokasi) : tx('—'), g.alokasi != null ? nm(g.alokasi - g.sum) : tx('—')].join('') + '</tr>')
  })
  out.push('<tr style="font-weight:bold;background:#a9d18e">' + [tx(''), tx('TOTAL'), nm(model.count),
    ...(per ? [nm(model.totalS), nm(model.total), nm(model.total - model.totalS)] : [nm(model.totalPagu), nm(model.totalBop), nm(model.total)]),
    tx('100%'), tx(''), tx('')].join('') + '</tr><tr><td></td></tr>')

  // II. Rincian
  out.push(`<tr><td colspan="${cols}" style="font-weight:bold">II. RINCIAN KEGIATAN</td></tr>`)
  out.push('<tr>' + [th('No'), th('Bidang, Program, dan Kegiatan'), th('Rincian Kegiatan dalam Ketentuan Teknis'), th('Kode/Klasifikasi Nomenklatur'), th('Nama Rekening'),
    ...(per ? [th('Vol Semula'), th('Sat Semula'), th('Pagu Semula (Rp)'), th('Vol Menjadi'), th('Sat Menjadi'), th('Pagu Menjadi (Rp)')] : [th('Vol'), th('Sat'), th('Pagu Kegiatan (Rp)'), th('BOP (Rp)'), th('Total (Rp)')]),
    th('Keterangan')].join('') + '</tr>')
  model.groups.forEach(g => {
    const span = per ? 12 : 11
    out.push(`<tr style="font-weight:bold;background:${g.isKoor ? '#fce4d6' : '#c6e0b4'}">${tx(g.letter + '.')}<td colspan="${span - 1}" style="border:.5pt solid #000">${esc(g.label)}</td></tr>`)
    g.programs.forEach(p => {
      out.push(`<tr style="background:#f2f2f2;font-style:italic">${tx('')}<td colspan="${span - 1}" style="border:.5pt solid #000"><b>${esc(p.name)}</b></td></tr>`)
      p.rows.forEach(r => {
        out.push('<tr>' + [tx(r.no), tx(r.kegiatan + (r.isBaru ? ' (Kegiatan Baru)' : '')), tx(r.sub), tx(r.kode), tx(r.namaRek),
          ...(per ? [tx(r.isBaru ? '—' : (r.volS ?? '')), tx(r.isBaru ? '—' : r.satS), r.isBaru ? tx('—') : nm(r.totalS), tx(r.vol ?? ''), tx(r.sat), nm(r.total)]
            : [tx(r.vol ?? ''), tx(r.sat), nm(r.pagu), nm(r.bop), nm(r.total)]),
          tx(r.ket)].join('') + '</tr>')
      })
    })
    out.push(`<tr style="font-weight:bold;background:${g.isKoor ? '#fce4d6' : '#e2efda'}"><td colspan="${per ? 7 : 7}" style="border:.5pt solid #000;text-align:right">Total ${esc(g.label)}</td>` +
      (per ? nm(g.sumS) + '<td colspan="2" style="border:.5pt solid #000"></td>' + nm(g.sum) : nm(g.sumPagu) + nm(g.sumBop) + nm(g.sum)) + '<td style="border:.5pt solid #000"></td></tr>')
  })
  out.push(`<tr style="font-weight:bold;background:#a9d18e"><td colspan="7" style="border:.5pt solid #000;text-align:right">TOTAL KESELURUHAN</td>` +
    (per ? nm(model.totalS) + '<td colspan="2" style="border:.5pt solid #000"></td>' + nm(model.total) : nm(model.totalPagu) + nm(model.totalBop) + nm(model.total)) + '<td style="border:.5pt solid #000"></td></tr>')

  const t = ttd || {}
  out.push('<tr><td></td></tr>')
  out.push(`<tr><td colspan="4">Koordinator DBH CHT${t.jabatanKoordinator ? ', ' + esc(t.jabatanKoordinator) : ''}</td><td colspan="${cols - 4}">${esc(t.tempat || KOTA)}${t.tanggal ? ', ' + esc(t.tanggal) : ''}</td></tr>`)
  out.push(`<tr><td colspan="4"></td><td colspan="${cols - 4}">${t.atasNama ? 'a.n. ' + esc(t.jabatanDiwakili) : ''}</td></tr>`)
  out.push(`<tr><td colspan="4"></td><td colspan="${cols - 4}">${esc(t.jabatanPenandatangan || 'Pejabat yang Berwenang')}</td></tr><tr><td></td></tr><tr><td></td></tr>`)
  out.push(`<tr><td colspan="4"><b>${esc(t.namaKoordinator || '')}</b></td><td colspan="${cols - 4}"><b>${esc(t.namaPejabat || '')}</b></td></tr>`)
  out.push(`<tr><td colspan="4">NIP. ${esc(t.nipKoordinator || '')}</td><td colspan="${cols - 4}">NIP. ${esc(t.nipPejabat || '')}</td></tr>`)

  return '﻿<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Rekap RKP</x:Name>' +
    '<x:WorksheetOptions><x:Print><x:FitWidth>1</x:FitWidth><x:FitHeight>0</x:FitHeight><x:PaperSizeIndex>9</x:PaperSizeIndex></x:Print><x:PageSetup><x:Layout x:Orientation="Landscape"/></x:PageSetup></x:WorksheetOptions>' +
    '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>' +
    `<body><table style="font-family:Arial;font-size:10pt;border-collapse:collapse">${out.join('')}</table></body></html>`
}

function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// ══════════════════════════════════════════════════════════════
//  MODAL PENANDATANGAN
// ══════════════════════════════════════════════════════════════
function TtdModal({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial)
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const fld = (label, k, props = {}) => (
    <div className="form-group" style={{ flex: 1 }}>
      <label className="form-label" htmlFor={'ttd-' + k}>{label}</label>
      <input id={'ttd-' + k} className="form-control" value={f[k]} onChange={set(k)} {...props} />
    </div>
  )
  return (
    <Modal title="✍️ Data Penandatangan Rekap RKP" onClose={onClose} wide>
      <div className="form-row">{fld('Nama Koordinator', 'namaKoordinator')}{fld('Jabatan Penandatangan', 'jabatanPenandatangan')}</div>
      <div className="form-row">{fld('NIP Koordinator', 'nipKoordinator', { inputMode: 'numeric' })}{fld('Nama Pejabat Penandatangan', 'namaPejabat')}</div>
      <div className="form-row">{fld('Jabatan Koordinator', 'jabatanKoordinator', { placeholder: 'Opsional' })}{fld('NIP Pejabat Penandatangan', 'nipPejabat', { inputMode: 'numeric' })}</div>
      <div className="form-row">
        {fld('Tempat Penandatanganan', 'tempat')}
        {fld('Tanggal Penandatanganan', 'tanggal', { type: 'date' })}
      </div>
      <label className="check-row">
        <input type="checkbox" checked={f.atasNama} onChange={set('atasNama')} /> Atas nama (a.n.)
      </label>
      {f.atasNama && (
        <div className="form-group">
          <label className="form-label" htmlFor="ttd-diwakili">Jabatan yang Diwakili</label>
          <select id="ttd-diwakili" className="form-control" value={f.jabatanDiwakili} onChange={set('jabatanDiwakili')}>
            {JABATAN_DIWAKILI_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}
      <div className="modal-footer">
        <button className="btn btn-outline" onClick={onClose}>Batal</button>
        <button className="btn btn-primary" onClick={() => onSave(f)}>💾 Simpan</button>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════
//  HALAMAN REKAP
// ══════════════════════════════════════════════════════════════
export default function RekapRKP() {
  const { tahun, jenis, notify } = useApp()
  const { profile, isSekretariat } = useAuth()
  const [murni, setMurni] = useState([])
  const [perubahan, setPerubahan] = useState([])
  const [paguMurni, setPaguMurni] = useState(null)
  const [paguPerubahan, setPaguPerubahan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orientasi, setOrientasi] = useState('landscape')
  const [ttd, setTtd] = useState(loadTtd)
  const [showTtd, setShowTtd] = useState(false)
  const reqId = useRef(0)

  const load = useCallback(async () => {
    if (!profile?.id) return
    const my = ++reqId.current
    setLoading(true); setError('')
    const scoped = (q) => (isSekretariat ? q : q.eq('created_by', profile.id))
    try {
      const [m, p, pm, pp] = await Promise.all([
        scoped(supabase.from('rkp_dbhcht').select('*').eq('tahun', tahun).eq('jenis', 'Murni').order('created_at')),
        jenis === 'Perubahan'
          ? scoped(supabase.from('rkp_perubahan_dbhcht').select('*').eq('tahun', tahun).order('created_at'))
          : Promise.resolve({ data: [], error: null }),
        supabase.from('pagu_alokasi').select('*').eq('tahun', tahun).eq('jenis', 'Murni').maybeSingle(),
        supabase.from('pagu_alokasi').select('*').eq('tahun', tahun).eq('jenis', 'Perubahan').maybeSingle(),
      ])
      if (my !== reqId.current) return // respon basi (tahun/jenis sudah berganti)
      const err = m.error || p.error
      if (err) throw err
      setMurni(m.data || []); setPerubahan(p.data || [])
      setPaguMurni(pm.data || null); setPaguPerubahan(pp.data || null)
    } catch (e) {
      if (my === reqId.current) setError(e?.message || 'Gagal memuat data RKP.')
    } finally {
      if (my === reqId.current) setLoading(false)
    }
  }, [tahun, jenis, profile?.id, isSekretariat])

  useEffect(() => { load() }, [load])

  const model = useMemo(
    () => buildModel(jenis, murni, perubahan, paguMurni, paguPerubahan),
    [jenis, murni, perubahan, paguMurni, paguPerubahan]
  )
  const per = jenis === 'Perubahan'
  const nama = `Rekap RKP DBH CHT ${jenis} TA ${tahun}`

  function doCetak(kind) {
    if (model.count === 0) { notify('Belum ada data RKP untuk dicetak.', 'warn'); return }
    if (kind === 'pdf') notify('Pada jendela cetak, pilih printer "Simpan sebagai PDF" lalu klik Simpan.', 'info')
    setPageOrientation(orientasi)
    const prevTitle = document.title
    document.title = nama // jadi nama berkas bawaan saat "Simpan sebagai PDF"
    document.body.classList.add('printing-doc')
    const cleanup = () => {
      document.body.classList.remove('printing-doc')
      document.title = prevTitle
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    setTimeout(() => window.print(), kind === 'pdf' ? 900 : 60)
    setTimeout(cleanup, 180000) // jaring pengaman bila afterprint tidak terpicu
  }

  function doExcel() {
    if (model.count === 0) { notify('Belum ada data RKP untuk diunduh.', 'warn'); return }
    const t = { ...ttd, tanggal: ttd.tanggal ? new Date(ttd.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '' }
    downloadBlob(buildExcelHtml(model, tahun, jenis, t), `${nama.replace(/\s+/g, '-')}.xls`, 'application/vnd.ms-excel;charset=utf-8')
    notify('Berkas Excel diunduh.', 'success')
  }

  const { checks } = model
  const sisaOk = model.sisaBelum >= 0

  return (
    <div>
      {/* ── Toolbar (tidak ikut tercetak) ── */}
      <div className="rekap-toolbar no-print">
        <div className="rekap-actions">
          <button className="btn btn-primary" onClick={() => doCetak('print')} disabled={loading}>🖨️ Cetak</button>
          <button className="btn btn-gold" onClick={() => doCetak('pdf')} disabled={loading}>📄 Unduh PDF</button>
          <button className="btn btn-info" onClick={doExcel} disabled={loading}>📊 Unduh Excel</button>
          <button className="btn btn-outline" onClick={() => setShowTtd(true)}>✍️ Penandatangan</button>
          <button className="btn btn-ghost" onClick={load} disabled={loading} aria-label="Muat ulang data">🔄 Muat ulang</button>
        </div>
        <OrientToggle value={orientasi} onChange={setOrientasi} />
      </div>

      {error && (
        <div className="alert alert-error no-print" role="alert">
          ⚠️ {error} <button className="btn btn-outline btn-sm" onClick={load}>Coba lagi</button>
        </div>
      )}

      {/* ── Ringkasan ── */}
      <div className="g4 mb-2 no-print stagger">
        <StatBox tone="green" label={per ? 'Total Menjadi' : 'Total RKP'} value={fmtRp(model.total)} sub={`${model.count} kegiatan`} />
        <StatBox tone="blue" label={per ? 'Total Pagu (Murni + Sisa)' : 'Pagu Alokasi DBH CHT'} value={fmtRp(model.batasPagu)} sub={checks.adaPagu ? `TA ${tahun}` : 'Pagu alokasi belum diatur'} />
        <StatBox tone={sisaOk ? 'amber' : 'rose'} label="Sisa Belum Dianggarkan" value={fmtRp(model.sisaBelum)} sub={sisaOk ? 'masih dalam batas pagu' : 'MELEBIHI pagu alokasi'} />
        <StatBox tone="violet" label={per ? 'Selisih vs Semula' : 'Total BOP'} value={fmtRp(per ? model.total - model.totalS : model.totalBop)} sub={per ? `Semula ${fmtRp(model.totalS)}` : 'maks. 10% per kegiatan'} />
      </div>

      {/* ── Pemeriksaan otomatis ── */}
      {!loading && (
        <div className="card no-print">
          <div className="card-title">🔎 Pemeriksaan Otomatis</div>
          <div className="check-grid">
            <Check ok={checks.adaPagu && sisaOk} text={!checks.adaPagu ? 'Pagu alokasi belum diatur di menu Pagu Alokasi' : sisaOk ? 'Total RKP tidak melebihi pagu alokasi' : `Total RKP melebihi pagu sebesar ${fmtRp(-model.sisaBelum)}`} />
            <Check ok={checks.bopLebih === 0} text={checks.bopLebih === 0 ? 'BOP semua kegiatan ≤ 10% dari pagu' : `${checks.bopLebih} kegiatan dengan BOP melebihi 10%`} />
            <Check ok={checks.tanpaKode === 0} text={checks.tanpaKode === 0 ? 'Semua kegiatan memiliki kode rekening' : `${checks.tanpaKode} kegiatan belum memiliki kode rekening`} />
            <Check ok={model.count > 0} text={model.count > 0 ? `${model.count} kegiatan tersusun pada ${model.groups.filter(g => g.count > 0).length} kelompok` : 'Belum ada kegiatan RKP'} />
          </div>
          {!isSekretariat && (
            <p className="text-muted" style={{ marginTop: '.6rem' }}>ℹ️ Anda melihat rekap untuk data milik Anda sendiri. Rekap seluruh OPD tersedia pada akun Sekretariat.</p>
          )}
        </div>
      )}

      {/* ── Pratinjau dokumen ── */}
      {loading ? (
        <div className="card no-print"><div className="skeleton" style={{ height: 14, width: '40%' }} /><div className="skeleton" style={{ height: 180, marginTop: 14 }} /></div>
      ) : (
        <div className="doc-scroll">
          <div className="doc-printable" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8 }}>
            <DokumenRekapRKP model={model} tahun={tahun} jenis={jenis} kabupaten={KOTA}
              ttd={{ ...ttd, tanggal: ttd.tanggal }} />
          </div>
        </div>
      )}

      {showTtd && (
        <TtdModal initial={ttd} onClose={() => setShowTtd(false)}
          onSave={(t) => { setTtd(t); saveTtd(t); setShowTtd(false); notify('Data penandatangan disimpan', 'success') }} />
      )}
    </div>
  )
}

function Check({ ok, text }) {
  return (
    <div className={`check-item ${ok ? 'ok' : 'bad'}`}>
      <span className="check-ic" aria-hidden="true">{ok ? '✓' : '!'}</span>
      <span>{text}</span>
    </div>
  )
}
