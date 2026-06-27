import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, fmtRp } from '../lib/constants.js'
import { StatBox, ProgressBar } from '../components/UI.jsx'
import { analysisDashboard } from '../lib/ai.js'

export default function Dashboard() {
  const { tahun, jenis } = useApp()
  const { profile } = useAuth()
  const [pagu,     setPagu]     = useState(null)
  const [rkpData,  setRkpData]  = useState([])
  const [realData, setRealData] = useState([])
  const [asisLen,  setAsisLen]  = useState(0)
  const [nOpd,     setNOpd]     = useState(0)
  const [aiText,   setAiText]   = useState('')
  const [aiLoad,   setAiLoad]   = useState(false)
  const [aiDone,   setAiDone]   = useState(false)

  useEffect(() => { loadData() }, [tahun, jenis])

  async function loadData() {
    const [{ data: p }, { data: r }, { data: rl }, { data: a }, { data: op }] = await Promise.all([
      supabase.from('pagu_alokasi').select('*').eq('tahun', tahun).eq('jenis', jenis).maybeSingle(),
      supabase.from('rkp_dbhcht').select('bidang_id,pagu,pagu_bop,is_koordinasi').eq('tahun', tahun).eq('jenis', jenis),
      supabase.from('realisasi_dbhcht').select('bidang_id,pagu,pagu_bop,realisasi_pagu_utama,realisasi_bop,realisasi_fisik,is_koordinasi,triwulan').eq('tahun', tahun),
      supabase.from('asistensi_dbhcht').select('id').eq('tahun', tahun),
      supabase.from('profiles').select('id').eq('role', 'opd').eq('aktif', true),
    ])
    setPagu(p); setRkpData(r || []); setRealData(rl || [])
    setAsisLen((a||[]).length); setNOpd((op||[]).length)
    setAiDone(false)
  }

  const tp      = pagu?.total_pagu || 0
  const sumRkp  = (bid, isK) => rkpData.filter(r => isK ? r.is_koordinasi : r.bidang_id === bid && !r.is_koordinasi).reduce((s,r)=>s+(r.pagu||0)+(r.pagu_bop||0),0)
  const realKeu = (r) => (r.realisasi_pagu_utama||0) + (r.realisasi_bop||0)
  const sumReal = (bid, isK) => realData.filter(r => isK ? r.is_koordinasi : r.bidang_id === bid && !r.is_koordinasi).reduce((s,r)=>s+realKeu(r),0)
  const totalRkpAll  = rkpData.reduce((s,r)=>s+(r.pagu||0)+(r.pagu_bop||0),0)
  const totalReal    = realData.reduce((s,r)=>s+realKeu(r),0)
  const pctReal      = tp > 0 ? (totalReal/tp*100) : 0
  const realByTw = tw => realData.filter(r=>r.triwulan===tw).reduce((s,r)=>s+realKeu(r),0)
  const sem1 = realByTw('I') + realByTw('II')

  async function doAI() {
    setAiLoad(true)
    const t = await analysisDashboard({ tahun, totalPagu: tp, totalReal, pctReal, nOpd })
    setAiText(t); setAiLoad(false); setAiDone(true)
  }

  return (
    <div>
      <div className="page-title">🏠 Dashboard <span className="chip">TA {tahun} — {jenis}</span></div>

      <div className="g4 mb-2">
        <StatBox label="Total Pagu DBH CHT"    value={fmtRp(tp)}         sub={`TA ${tahun} · ${jenis}`} />
        <StatBox label="Total Anggaran RKP"    value={fmtRp(totalRkpAll)} sub="sudah terinput" color="var(--gold)" />
        <StatBox label="Total Realisasi"       value={fmtRp(totalReal)}   sub={`${pctReal.toFixed(1)}% dari pagu`} color="var(--info)" />
        <StatBox label="Capaian Realisasi (%)" value={pctReal.toFixed(1)+'%'} sub={`Semester I: ${((sem1/tp)*100||0).toFixed(1)}%`} color={pctReal>=80?'var(--accent)':pctReal>=50?'var(--gold)':'var(--danger)'} />
      </div>

      <div className="g2">
        <div className="card">
          <div className="card-title">📊 Alokasi & Realisasi per Bidang</div>
          {BIDANG.map(b => {
            const alok = tp * (pagu?.[`pct_${b.id}`] || b.pct) / 100
            const real = sumReal(b.id, false)
            const pct  = alok > 0 ? (real/alok*100) : 0
            return (
              <div key={b.id} style={{ marginBottom: '.85rem' }}>
                <div className="flex-between" style={{ marginBottom: 3 }}>
                  <span style={{ fontSize: '.83rem' }}>{b.icon} {b.label}</span>
                  <span style={{ fontSize: '.73rem', color: 'var(--text2)' }}>{pagu?.[`pct_${b.id}`]||b.pct}% · {fmtRp(alok)}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <ProgressBar value={pct} color={b.color} height={7} />
                  <span style={{ fontSize: '.72rem', width: 42 }}>{pct.toFixed(1)}%</span>
                </div>
                <div style={{ fontSize:'.7rem', color:'var(--text2)', marginTop:2 }}>
                  Realisasi: {fmtRp(real)} · RKP: {fmtRp(sumRkp(b.id, false))}
                </div>
              </div>
            )
          })}
          <div style={{ borderTop:'1px dashed var(--border)', paddingTop:'.75rem' }}>
            <div className="flex-between" style={{ marginBottom: 3 }}>
              <span style={{ fontSize:'.83rem' }}>{KOORDINASI.icon} {KOORDINASI.short}</span>
              <span style={{ fontSize:'.73rem', color:'var(--text2)' }}>Lintas Bidang</span>
            </div>
            <div className="flex-between" style={{ fontSize:'.75rem' }}>
              <span style={{ color:'var(--text2)' }}>RKP: {fmtRp(sumRkp(null,true))}</span>
              <span style={{ color: KOORDINASI.color }}>Realisasi: {fmtRp(sumReal(null,true))}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">💰 Ringkasan Realisasi</div>
          {BIDANG.map(b => {
            const alok = tp*(pagu?.[`pct_${b.id}`]||b.pct)/100
            const real = sumReal(b.id,false)
            const pct  = alok>0?(real/alok*100).toFixed(1):0
            return (
              <div key={b.id} className="flex-between" style={{ padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:'.83rem' }}>{b.icon} {b.label.replace('Bidang ','')}</span>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:600, fontSize:'.83rem', color:b.color }}>{fmtRp(real)}</div>
                  <div style={{ fontSize:'.7rem', color:'var(--text2)' }}>{pct}%</div>
                </div>
              </div>
            )
          })}
          <div className="flex-between" style={{ padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:'.83rem' }}>{KOORDINASI.icon} {KOORDINASI.short}</span>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:600, fontSize:'.83rem', color:KOORDINASI.color }}>{fmtRp(sumReal(null,true))}</div>
              <div style={{ fontSize:'.7rem', color:'var(--text2)' }}>koordinasi</div>
            </div>
          </div>
          <div className="flex-between" style={{ padding:'7px 0', fontWeight:700 }}>
            <span>TOTAL</span><span style={{ color:'var(--accent)' }}>{fmtRp(totalReal)}</span>
          </div>
          <hr className="divider" />
          <div className="card-title" style={{ marginBottom:'.5rem' }}>📅 Realisasi per Triwulan</div>
          {['I','II','III','IV'].map(tw => (
            <div key={tw} className="flex-between" style={{ fontSize:'.82rem', padding:'3px 0' }}>
              <span>Triwulan {tw}</span>
              <strong style={{ color: tw==='I'||tw==='II' ? 'var(--info)' : 'var(--text)' }}>{fmtRp(realByTw(tw))}</strong>
            </div>
          ))}
          <div style={{ marginTop:'.6rem' }}>
            <ProgressBar value={pctReal} height={8} />
            <div style={{ fontSize:'.72rem', color:'var(--text2)', marginTop:3 }}>
              Capaian: {pctReal.toFixed(1)}% dari total pagu
            </div>
          </div>
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <div className="card-title">🤝 Asistensi & OPD TA {tahun}</div>
          <div className="g2">
            <StatBox label="Berita Acara Asistensi" value={asisLen} sub="dokumen" />
            <StatBox label="OPD Pengguna Aktif" value={nOpd} sub="OPD terdaftar" />
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
            <button className="btn btn-ghost btn-sm mt-1" onClick={() => { setAiDone(false); setAiText('') }}>
              🔄 Refresh Analisa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
