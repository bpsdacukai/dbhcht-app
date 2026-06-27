import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, fmtRp } from '../lib/constants.js'
import { StatBox, ProgressBar } from '../components/UI.jsx'
import { analysisDashboard } from '../lib/ai.js'

const fmtPct = (v) => (v||0).toFixed(1) + '%'

export default function Dashboard() {
  const { tahun, jenis } = useApp()
  const { profile } = useAuth()
  const [pagu,      setPagu]     = useState(null)
  const [rkpData,   setRkpData]  = useState([])
  const [realData,  setRealData] = useState([])
  const [rkpMap,    setRkpMap]   = useState({})  // id→rkp row, untuk lookup pagu dari realisasi
  const [asisLen,   setAsisLen]  = useState(0)
  const [nOpd,      setNOpd]     = useState(0)
  const [aiText,    setAiText]   = useState('')
  const [aiLoad,    setAiLoad]   = useState(false)
  const [aiDone,    setAiDone]   = useState(false)
  const [loading,   setLoading]  = useState(true)

  useEffect(() => { loadData() }, [tahun, jenis])

  async function loadData() {
    setLoading(true)
    const [{ data: p }, { data: r }, { data: rl }, { data: a }, { data: op }] = await Promise.all([
      supabase.from('pagu_alokasi').select('*').eq('tahun', tahun).eq('jenis', jenis).maybeSingle(),
      supabase.from('rkp_dbhcht').select('id,bidang_id,pagu,pagu_bop,is_koordinasi,program,kegiatan').eq('tahun', tahun).eq('jenis', jenis),
      // realisasi TIDAK punya kolom pagu/pagu_bop — ambil dari rkp via rkp_id
      supabase.from('realisasi_dbhcht').select('rkp_id,bidang_id,realisasi_pagu_utama,realisasi_bop,realisasi_fisik,is_koordinasi,triwulan').eq('tahun', tahun),
      supabase.from('asistensi_dbhcht').select('id').eq('tahun', tahun),
      supabase.from('profiles').select('id').eq('role', 'opd').eq('aktif', true),
    ])
    const rkpList = r || []
    const map = Object.fromEntries(rkpList.map(x => [x.id, x]))
    setPagu(p); setRkpData(rkpList); setRkpMap(map)
    setRealData(rl || [])
    setAsisLen((a||[]).length); setNOpd((op||[]).length)
    setAiDone(false); setLoading(false)
  }

  // ── Kalkulasi ──────────────────────────────────────────────────────────────
  const tp = pagu?.total_pagu || 0

  // Pagu dari RKP (anggaran rencana)
  const sumRkpPagu = (bid, isK) =>
    rkpData.filter(r => isK ? r.is_koordinasi : r.bidang_id === bid && !r.is_koordinasi)
           .reduce((s,r) => s + (r.pagu||0) + (r.pagu_bop||0), 0)
  const totalRkpAll = rkpData.reduce((s,r) => s + (r.pagu||0) + (r.pagu_bop||0), 0)

  // Realisasi keuangan (pagu dari rkpMap via rkp_id)
  const realKeu = (r) => (r.realisasi_pagu_utama||0) + (r.realisasi_bop||0)
  const realPagu = (r) => {
    const rkp = rkpMap[r.rkp_id]
    return rkp ? (rkp.pagu||0) + (rkp.pagu_bop||0) : 0
  }

  // Filter per bidang
  const byBidang = (bid, isK) =>
    realData.filter(r => isK ? r.is_koordinasi : r.bidang_id === bid && !r.is_koordinasi)

  const sumReal     = (bid, isK) => byBidang(bid, isK).reduce((s,r) => s + realKeu(r), 0)
  const sumRealPagu = (bid, isK) => byBidang(bid, isK).reduce((s,r) => s + realPagu(r), 0)

  const totalReal = realData.reduce((s,r) => s + realKeu(r), 0)
  const pctReal   = tp > 0 ? (totalReal / tp * 100) : 0

  // Per triwulan
  const realByTw  = (tw) => realData.filter(r => r.triwulan === tw).reduce((s,r) => s + realKeu(r), 0)
  const paguByTw  = (tw) => realData.filter(r => r.triwulan === tw).reduce((s,r) => s + realPagu(r), 0)
  const sem1      = realByTw('I') + realByTw('II')
  const pctSem1   = tp > 0 ? (sem1/tp*100) : 0

  // Top kegiatan per realisasi tertinggi
  const rkpRealMap = {}
  for (const r of realData) {
    const key = r.rkp_id || (r.bidang_id + '|' + r.is_koordinasi)
    if (!rkpRealMap[key]) rkpRealMap[key] = { rkp_id: r.rkp_id, bidang_id: r.bidang_id, is_koordinasi: r.is_koordinasi, real: 0, pagu: 0 }
    rkpRealMap[key].real += realKeu(r)
    rkpRealMap[key].pagu += realPagu(r)
  }
  const topKegiatan = Object.values(rkpRealMap)
    .sort((a,b) => b.real - a.real).slice(0, 5)

  async function doAI() {
    setAiLoad(true)
    const t = await analysisDashboard({ tahun, totalPagu: tp, totalReal, pctReal, nOpd })
    setAiText(t); setAiLoad(false); setAiDone(true)
  }

  const triwulans = ['I','II','III','IV']

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'3rem', color:'var(--text2)' }}>
      <span style={{ fontSize:'1.5rem', marginRight:'.5rem' }}>⏳</span> Memuat data dashboard...
    </div>
  )

  return (
    <div>
      <div className="page-title">🏠 Dashboard
        <span className="chip">TA {tahun} — {jenis}</span>
        {loading && <span className="chip">⏳</span>}
      </div>

      {/* ── Baris 1: Stat boxes utama ── */}
      <div className="g4 mb-2">
        <StatBox label="Total Pagu DBH CHT"    value={fmtRp(tp)}           sub={`TA ${tahun} · ${jenis}`} />
        <StatBox label="Total Anggaran RKP"    value={fmtRp(totalRkpAll)}  sub="sudah terinput" color="var(--gold)" />
        <StatBox label="Total Realisasi (Rp)"  value={fmtRp(totalReal)}    sub={`${fmtPct(pctReal)} dari Pagu DBH CHT`} color="var(--info)" />
        <StatBox label="Capaian Realisasi (%)"
          value={fmtPct(pctReal)}
          sub={`Sem I: ${fmtPct(pctSem1)} · Sem II: ${fmtPct(pctReal)}`}
          color={pctReal>=80?'var(--accent)':pctReal>=50?'var(--gold)':'var(--danger)'} />
      </div>

      {/* ── Baris 2: Realisasi per Bidang & Ringkasan ── */}
      <div className="g2 mb-2">

        {/* Kiri: Progress bar per bidang */}
        <div className="card">
          <div className="card-title">📊 Alokasi & Realisasi per Bidang</div>
          {BIDANG.map(b => {
            const alok    = tp * (pagu?.[`pct_${b.id}`] || b.pct) / 100
            const real    = sumReal(b.id, false)
            const rkpVal  = sumRkpPagu(b.id, false)
            const pct     = alok > 0 ? (real/alok*100) : 0
            const pctRkp  = alok > 0 ? (rkpVal/alok*100) : 0
            return (
              <div key={b.id} style={{ marginBottom:'.9rem' }}>
                <div className="flex-between" style={{ marginBottom:3 }}>
                  <span style={{ fontSize:'.83rem', fontWeight:600 }}>{b.icon} {b.label}</span>
                  <span style={{ fontSize:'.72rem', color:'var(--text2)' }}>
                    {pagu?.[`pct_${b.id}`]||b.pct}% alokasi · {fmtRp(alok)}
                  </span>
                </div>
                {/* Bar RKP (abu) */}
                <div style={{ position:'relative', height:6, background:'var(--border)', borderRadius:3, marginBottom:3, overflow:'hidden' }}>
                  <div style={{ position:'absolute', left:0, top:0, height:'100%', width:Math.min(pctRkp,100)+'%', background:'#93c5fd', borderRadius:3 }} />
                </div>
                {/* Bar Realisasi (hijau) */}
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <ProgressBar value={pct} color={b.color} height={7} />
                  <span style={{ fontSize:'.72rem', width:42, flexShrink:0, fontWeight:700, color:pct>=80?'var(--accent)':pct>=50?'var(--gold)':'var(--danger)' }}>
                    {fmtPct(pct)}
                  </span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.7rem', color:'var(--text2)', marginTop:2 }}>
                  <span>RKP: {fmtRp(rkpVal)}</span>
                  <span style={{ color:b.color, fontWeight:600 }}>Realisasi: {fmtRp(real)}</span>
                </div>
              </div>
            )
          })}
          {/* Koordinasi */}
          <div style={{ borderTop:'1px dashed var(--border)', paddingTop:'.75rem' }}>
            <div className="flex-between" style={{ marginBottom:3 }}>
              <span style={{ fontSize:'.83rem', fontWeight:600 }}>{KOORDINASI.icon} {KOORDINASI.short}</span>
              <span style={{ fontSize:'.72rem', color:'var(--text2)' }}>Koordinasi DBH CHT</span>
            </div>
            {(() => {
              const real   = sumReal(null,true)
              const rkpVal = sumRkpPagu(null,true)
              const paguK  = rkpVal // koordinasi tidak punya alokasi % tetap
              const pct    = paguK > 0 ? (real/paguK*100) : 0
              return (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <ProgressBar value={pct} color={KOORDINASI.color} height={7} />
                    <span style={{ fontSize:'.72rem', width:42, flexShrink:0, fontWeight:700, color:KOORDINASI.color }}>{fmtPct(pct)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.7rem', color:'var(--text2)', marginTop:2 }}>
                    <span>RKP: {fmtRp(rkpVal)}</span>
                    <span style={{ color:KOORDINASI.color, fontWeight:600 }}>Realisasi: {fmtRp(real)}</span>
                  </div>
                </>
              )
            })()}
          </div>
        </div>

        {/* Kanan: Tabel ringkasan realisasi per bidang */}
        <div className="card">
          <div className="card-title">💰 Ringkasan Realisasi per Bidang</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th style={{ textAlign:'left', paddingLeft:6 }}>Bidang</th>
                <th>Pagu RKP (Rp)</th>
                <th>Realisasi (Rp)</th>
                <th>Capaian</th>
              </tr></thead>
              <tbody>
                {BIDANG.map(b => {
                  const alok   = tp * (pagu?.[`pct_${b.id}`] || b.pct) / 100
                  const rkpVal = sumRkpPagu(b.id, false)
                  const real   = sumReal(b.id, false)
                  const pct    = alok > 0 ? (real/alok*100) : 0
                  return (
                    <tr key={b.id}>
                      <td style={{ fontSize:'.82rem' }}>{b.icon} {b.label.replace('Bidang ','')}</td>
                      <td style={{ textAlign:'right', fontSize:'.8rem', color:'var(--text2)' }}>{fmtRp(rkpVal)}</td>
                      <td style={{ textAlign:'right', fontWeight:700, color:b.color }}>{fmtRp(real)}</td>
                      <td style={{ textAlign:'center' }}>
                        <span style={{ fontSize:'.75rem', fontWeight:700,
                          color: pct>=80?'var(--accent)':pct>=50?'var(--gold)':'var(--danger)' }}>
                          {fmtPct(pct)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {/* Koordinasi */}
                {(() => {
                  const real   = sumReal(null, true)
                  const rkpVal = sumRkpPagu(null, true)
                  const pct    = rkpVal > 0 ? (real/rkpVal*100) : 0
                  return (
                    <tr style={{ background:'#fdf5e430' }}>
                      <td style={{ fontSize:'.82rem' }}>{KOORDINASI.icon} {KOORDINASI.short}</td>
                      <td style={{ textAlign:'right', fontSize:'.8rem', color:'var(--text2)' }}>{fmtRp(rkpVal)}</td>
                      <td style={{ textAlign:'right', fontWeight:700, color:KOORDINASI.color }}>{fmtRp(real)}</td>
                      <td style={{ textAlign:'center' }}>
                        <span style={{ fontSize:'.75rem', fontWeight:700, color:KOORDINASI.color }}>{fmtPct(pct)}</span>
                      </td>
                    </tr>
                  )
                })()}
                {/* Total */}
                <tr style={{ background:'var(--bg3)', fontWeight:700 }}>
                  <td>TOTAL</td>
                  <td style={{ textAlign:'right' }}>{fmtRp(totalRkpAll)}</td>
                  <td style={{ textAlign:'right', color:'var(--accent)' }}>{fmtRp(totalReal)}</td>
                  <td style={{ textAlign:'center', color: pctReal>=80?'var(--accent)':pctReal>=50?'var(--gold)':'var(--danger)' }}>
                    {fmtPct(pctReal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Baris 3: Realisasi Triwulanan (Rp + %) ── */}
      <div className="card mb-2">
        <div className="card-title">📅 Realisasi Triwulanan</div>
        <div className="g4" style={{ gap:'.6rem', marginBottom:'.75rem' }}>
          {triwulans.map(tw => {
            const real = realByTw(tw)
            const pagu_tw = paguByTw(tw)
            const pct  = tp > 0 ? (real/tp*100) : 0
            const pctOfPagu = pagu_tw > 0 ? (real/pagu_tw*100) : 0
            return (
              <div key={tw} className="stat-box" style={{ position:'relative' }}>
                <div className="stat-lbl">Triwulan {tw}</div>
                <div className="stat-val" style={{ fontSize:'.95rem', color:'var(--info)' }}>{fmtRp(real)}</div>
                <div className="stat-sub">{fmtPct(pct)} dari Pagu DBH CHT</div>
                <div style={{ marginTop:'.4rem' }}>
                  <ProgressBar value={pctOfPagu} height={5} />
                  <div style={{ fontSize:'.68rem', color:'var(--text2)', marginTop:2 }}>
                    {fmtPct(pctOfPagu)} dari pagu kegiatan Tw {tw}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bar chart triwulan */}
        <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:70, padding:'0 4px' }}>
          {triwulans.map(tw => {
            const real    = realByTw(tw)
            const maxReal = Math.max(...triwulans.map(t => realByTw(t)), 1)
            const h       = real > 0 ? Math.max((real/maxReal*60), 4) : 0
            const isSem1  = tw==='I'||tw==='II'
            return (
              <div key={tw} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <div style={{ fontSize:'.68rem', color:'var(--text2)', fontWeight:600 }}>{fmtPct(tp>0?realByTw(tw)/tp*100:0)}</div>
                <div style={{ width:'100%', height:h, background: isSem1 ? 'var(--info)' : 'var(--accent2)',
                  borderRadius:'3px 3px 0 0', transition:'height .4s', minHeight: real>0?4:0 }} />
                <div style={{ fontSize:'.75rem', fontWeight:600, color:'var(--text2)' }}>Tw {tw}</div>
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', gap:'1rem', fontSize:'.7rem', color:'var(--text2)', marginTop:'.5rem', justifyContent:'center' }}>
          <span>🟦 Semester I (Tw I+II): <strong style={{ color:'var(--info)' }}>{fmtRp(sem1)} ({fmtPct(pctSem1)})</strong></span>
          <span>🟩 Semester II (Tw III+IV): <strong style={{ color:'var(--accent2)' }}>{fmtRp(realByTw('III')+realByTw('IV'))} ({fmtPct(tp>0?(realByTw('III')+realByTw('IV'))/tp*100:0)})</strong></span>
        </div>
      </div>

      {/* ── Baris 4: Asistensi + AI ── */}
      <div className="g2">
        <div className="card">
          <div className="card-title">🤝 Asistensi & OPD TA {tahun}</div>
          <div className="g2">
            <StatBox label="Berita Acara Asistensi" value={asisLen} sub="dokumen" />
            <StatBox label="OPD Pengguna Aktif"     value={nOpd}    sub="OPD terdaftar" />
          </div>
        </div>
        <div className="card">
          <div className="card-title">🤖 Analisa AI — Realisasi TA {tahun}</div>
          {!aiDone && !aiLoad && (
            <button className="btn btn-ai" onClick={doAI} style={{ width:'100%', padding:'9px' }}>
              ✨ Generate Analisa AI
            </button>
          )}
          {aiLoad && <div className="text-muted">⏳ AI sedang menganalisis...</div>}
          {aiDone && <div className="ai-box">{aiText}</div>}
          {aiDone && (
            <button className="btn btn-ghost btn-sm mt-1" onClick={()=>{ setAiDone(false); setAiText('') }}>
              🔄 Refresh Analisa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
