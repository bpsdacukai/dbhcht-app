import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, PROGRAM_BY_BIDANG, KODE_REKENING_BY_BIDANG, fmtRp } from '../lib/constants.js'
import { Modal, EmptyRow, DelBtn, EditBtn, PageHeader, ProgressBar, PctBadge } from '../components/UI.jsx'
import { getPaguOpd } from '../lib/supabase.js'

const EMPTY = { bidang_id:'', program:'', kegiatan:'', sub_kegiatan:'', kode_rekening:'', nama_rekening:'', volume:'', satuan:'', pagu:'', realisasi_keu:'', realisasi_bop:'', realisasi_fisik:'', capaian_output:'', triwulan:'I', keterangan:'', is_koordinasi:false }
const TWS = ['I','II','III','IV']

export default function Realisasi() {
  const { tahun, jenis, notify } = useApp()
  const { profile, isSekretariat } = useAuth()
  const [rows,    setRows]    = useState([])
  const [rkpRows, setRkpRows] = useState([]) // untuk auto-fill dari RKP
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState(EMPTY)
  const [editId,  setEditId]  = useState(null)
  const [twTab,   setTwTab]   = useState('I')
  const [bidTab,  setBidTab]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [paguOpd, setPaguOpd] = useState(null)
  const [totalPaguTA, setTotalPaguTA] = useState(0)

  useEffect(() => {
    if (!bidTab && profile) setBidTab(isSekretariat ? 'kesmas' : (profile.bidang||'kesmas'))
  }, [profile])

  useEffect(() => { if (bidTab) load() }, [tahun, bidTab])
  useEffect(() => { if (profile?.id) getPaguOpd(profile.id, tahun, 'Murni').then(p=>setPaguOpd(p)) }, [profile, tahun])

  // Load total pagu TA dari pagu_alokasi (Murni untuk Sem I, Perubahan untuk Sem II)
  useEffect(() => {
    async function loadTotalPagu() {
      const { data } = await supabase.from('pagu_alokasi').select('total_pagu').eq('tahun', tahun).eq('jenis', jenis).maybeSingle()
      setTotalPaguTA(data?.total_pagu || 0)
    }
    loadTotalPagu()
  }, [tahun, jenis])

  async function load() {
    let q = supabase.from('realisasi_dbhcht').select('*').eq('tahun', tahun).order('created_at')
    if (!isSekretariat) q = q.eq('created_by', profile?.id)
    const { data } = await q
    setRows(data||[])

    // Load RKP milik OPD ini untuk auto-fill — filter jenis agar sinkron dengan laporan
    let rq = supabase.from('rkp_dbhcht').select('*').eq('tahun', tahun).eq('jenis', jenis)
    if (!isSekretariat) rq = rq.eq('created_by', profile?.id)
    const { data: rd } = await rq
    setRkpRows(rd||[])
  }

  const isKoor   = bidTab === 'koordinasi'
  const twRows   = rows.filter(r => r.triwulan === twTab)
  const visRows  = isKoor
    ? twRows.filter(r => r.is_koordinasi)
    : twRows.filter(r => r.bidang_id === bidTab && !r.is_koordinasi)

  const sumKeu  = (arr) => arr.reduce((s,r)=>s+(r.realisasi_keu||0),0)
  const sumBop  = (arr) => arr.reduce((s,r)=>s+(r.realisasi_bop||0),0)
  // Pagu dihitung unik per program+kegiatan+sub_kegiatan+OPD karena 1 program hanya punya 1 pagu anggaran
  const uniquePagu = (arr) => {
    const seen = new Set()
    return arr.reduce((s,r) => {
      const key = `${r.program}|${r.kegiatan||''}|${r.sub_kegiatan||''}|${r.created_by||''}`
      if (seen.has(key)) return s
      seen.add(key)
      return s + (r.pagu||0)
    }, 0)
  }
  const sumPagu = uniquePagu
  // sem1 = Real.Keu + Real.BOP semua bidang & koordinasi, Triwulan I+II
  const rowsSem1   = rows.filter(r => ['I','II'].includes(r.triwulan))
  const sem1       = sumKeu(rowsSem1) + sumBop(rowsSem1)
  // Capaian = sem1 dibanding Total Pagu TA dari pagu_alokasi (bukan pagu 1 OPD)
  const pctCapaian = totalPaguTA > 0 ? (sem1 / totalPaguTA * 100) : 0
  const totalPaguOpd = (paguOpd?.pagu_utama||0) + (paguOpd?.bop||0)

  const canEdit = isSekretariat
    || (profile?.role === 'opd' && (!bidTab || profile.bidang === bidTab || isKoor))

  function openAdd() {
    const defBid = isKoor ? 'koordinasi' : (isSekretariat ? bidTab : profile?.bidang||bidTab)
    setForm({ ...EMPTY, bidang_id: defBid||'kesmas', triwulan: twTab, is_koordinasi: isKoor })
    setEditId(null); setModal(true)
  }
  function openEdit(r) {
    setForm({ ...r, pagu:String(r.pagu||''), realisasi_keu:String(r.realisasi_keu||''), realisasi_bop:String(r.realisasi_bop||''), realisasi_fisik:String(r.realisasi_fisik||''), kode_rekening:r.kode_rekening||'', nama_rekening:r.nama_rekening||'', volume:String(r.volume||''), satuan:r.satuan||'' })
    setEditId(r.id); setModal(true)
  }

  // Auto-fill dari RKP yang sudah diinput
  function autoFillFromRkp(rkpId) {
    const r = rkpRows.find(x => x.id === rkpId)
    if (!r) return
    setForm(f => ({
      ...f,
      program:        r.program,
      kegiatan:       r.kegiatan,
      sub_kegiatan:   r.sub_kegiatan,
      kode_rekening:  r.kode_rekening  || '',
      nama_rekening:  r.nama_rekening  || '',
      volume:         String(r.volume  || ''),
      satuan:         r.satuan         || '',
      pagu:           String((r.pagu || 0) + (r.pagu_bop || 0)),  // pagu total = utama + BOP dari RKP
      realisasi_bop:  String(r.pagu_bop || 0),   // batas BOP dari RKP
      bidang_id:      r.bidang_id,
      is_koordinasi:  r.is_koordinasi,
    }))
  }

  async function save() {
    if (!form.program) { notify('Program wajib!', 'warn'); return }
    setLoading(true)
    const payload = {
      tahun, triwulan: form.triwulan,
      bidang_id:       form.is_koordinasi ? 'koordinasi' : form.bidang_id,
      program: form.program, kegiatan: form.kegiatan, sub_kegiatan: form.sub_kegiatan,
      kode_rekening:   form.kode_rekening || '',
      nama_rekening:   form.nama_rekening || '',
      volume:          form.volume ? Number(form.volume) : null,
      satuan:          form.satuan || '',
      pagu:            Number(form.pagu)||0,
      realisasi_keu:   Number(form.realisasi_keu)||0,
      realisasi_bop:   Number(form.realisasi_bop)||0,
      realisasi_fisik: Number(form.realisasi_fisik)||0,
      capaian_output:  form.capaian_output||'',
      is_koordinasi:   form.is_koordinasi,
      keterangan:      form.keterangan,
      created_by:      profile?.id,
      created_by_nama: profile?.nama,
    }
    const { error } = editId
      ? await supabase.from('realisasi_dbhcht').update(payload).eq('id', editId)
      : await supabase.from('realisasi_dbhcht').insert(payload)
    setLoading(false)
    if (error) { notify('Gagal: '+error.message, 'error'); return }
    notify(editId?'Realisasi diperbarui':'Realisasi ditambahkan', 'success')
    setModal(false); load()
  }

  async function del(id) {
    if (!confirm('Hapus?')) return
    await supabase.from('realisasi_dbhcht').delete().eq('id', id)
    notify('Dihapus', 'warn'); load()
  }

  const tabs = isSekretariat
    ? [...BIDANG, KOORDINASI]
    : [...(BIDANG.filter(b=>b.id===profile?.bidang)), KOORDINASI]

  if (!bidTab) return <div className="text-muted" style={{padding:'2rem'}}>Memuat...</div>

  return (
    <div>
      <PageHeader title="📈 Realisasi DBH CHT">
        {paguOpd&&<span className="chip" style={{color:'var(--gold)'}}>Pagu OPD: {fmtRp(totalPaguOpd)}</span>}
        {canEdit&&<button className="btn btn-primary btn-sm" onClick={openAdd}>+ Input</button>}
        <button className="btn btn-outline btn-sm no-print" onClick={()=>window.print()}>🖨️ Cetak</button>
      </PageHeader>

      <div className="g2 mb-2">
        <div className="stat-box">
          <div className="stat-lbl">Realisasi Semester I (Tw I+II)</div>
          <div className="stat-val" style={{color:'var(--info)'}}>{fmtRp(sem1)}</div>
          <div className="stat-sub">Real. Keu + BOP · Semua Bidang & Koordinasi</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Capaian Realisasi (%)</div>
          <div className="stat-val" style={{color:pctCapaian>=80?'var(--accent)':pctCapaian>=50?'var(--gold)':'var(--danger)'}}>
            {pctCapaian.toFixed(1)}%
          </div>
          <div className="stat-sub">{fmtRp(sem1)} dari Pagu TA {fmtRp(totalPaguTA)}</div>
        </div>
      </div>

      {/* Triwulan tabs */}
      <div className="tabs">
        {TWS.map(t=>(
          <div key={t} className={`tab ${twTab===t?'active':''}`} onClick={()=>setTwTab(t)}>
            Triwulan {t}
            <span style={{fontSize:'.7rem',color:'var(--text2)',marginLeft:4}}>
              · {fmtRp(sumKeu(rows.filter(r=>r.triwulan===t)))}
            </span>
          </div>
        ))}
      </div>

      {/* Bidang sub-tabs */}
      <div style={{display:'flex',gap:'.3rem',flexWrap:'wrap',marginBottom:'.75rem'}}>
        {tabs.map(b=>(
          <div key={b.id}
            className={`tab ${bidTab===b.id?'active':''}`}
            style={{fontSize:'.75rem',padding:'4px 10px',border:'1px solid var(--border)',borderRadius:5,
              ...(bidTab===b.id&&b.id==='koordinasi'?{color:KOORDINASI.color,borderColor:KOORDINASI.color}:{})}}
            onClick={()=>setBidTab(b.id)}
          >{b.icon} {b.short}</div>
        ))}
      </div>

      <div className="card">
        <div className="flex-between mb-1">
          <div className="card-title" style={{margin:0}}>
            Triwulan {twTab} — {isKoor?KOORDINASI.label:BIDANG.find(b=>b.id===bidTab)?.label}
          </div>
          <strong style={{color:'var(--accent)'}}>
            {fmtRp(sumKeu(visRows))} / {fmtRp(sumPagu(visRows))}
          </strong>
        </div>

        {/* ⚠️ Peringatan jika belum ada entri realisasi untuk triwulan ini */}
        {visRows.length === 0 && canEdit && (
          <div style={{
            background:'#fff3cd', border:'1px solid #ffc107', borderRadius:6,
            padding:'.65rem .9rem', marginBottom:'.75rem',
            display:'flex', alignItems:'flex-start', gap:'.6rem', fontSize:'.83rem'
          }}>
            <span style={{fontSize:'1.1rem', lineHeight:1}}>⚠️</span>
            <div>
              <strong>Belum ada data realisasi untuk Triwulan {twTab}.</strong>
              <div style={{marginTop:'.2rem', color:'#856404'}}>
                Wajib mengisi realisasi setiap triwulan, termasuk jika realisasi masih <strong>Rp 0</strong> dan fisik <strong>0%</strong>.
                Klik <strong>+ Input</strong> di atas untuk menambahkan.
              </div>
            </div>
          </div>
        )}

        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>No</th><th>Program / Kegiatan</th>
              <th>Kode Rekening</th><th style={{width:50}}>Vol</th><th style={{width:70}}>Satuan</th>
              <th>Pagu (Rp)</th><th>Real. Keu (Rp)</th><th>Real. BOP (Rp)</th>
              <th>% Keu</th><th>Fisik %</th><th>OPD</th>
              {canEdit&&<th className="no-print">Aksi</th>}
            </tr></thead>
            <tbody>
              {visRows.length===0&&<EmptyRow cols={canEdit?12:11} />}
              {visRows.map((r,i)=>{
                const pct = r.pagu>0?(r.realisasi_keu/r.pagu*100):0
                return (
                  <tr key={r.id} className={r.is_koordinasi?'koordinasi-row':''}>
                    <td style={{fontSize:'.75rem',color:'var(--text2)'}}>{i+1}</td>
                    <td>
                      <div className="td-bold" style={{fontSize:'.8rem'}}>{r.program}</div>
                      <div className="td-muted">{r.kegiatan}</div>
                    </td>
                    <td style={{fontSize:'.72rem',color:'var(--text2)'}}>
                      {r.kode_rekening||'—'}
                      {r.nama_rekening&&<div style={{fontSize:'.68rem',color:'var(--text3)',fontStyle:'italic'}}>{r.nama_rekening}</div>}
                    </td>
                    <td style={{textAlign:'center',fontSize:'.8rem'}}>{r.volume||'—'}</td>
                    <td style={{fontSize:'.78rem'}}>{r.satuan||'—'}</td>
                    <td className="td-muted">{fmtRp(r.pagu)}</td>
                    <td className="td-money">{fmtRp(r.realisasi_keu)}</td>
                    <td style={{color:'var(--gold)',fontWeight:600}}>{fmtRp(r.realisasi_bop||0)}</td>
                    <td><PctBadge value={pct} /></td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <ProgressBar value={r.realisasi_fisik} height={6} />
                        <span style={{fontSize:'.72rem',width:34}}>{r.realisasi_fisik}%</span>
                      </div>
                    </td>
                    <td className="td-muted">{r.created_by_nama}</td>
                    {canEdit&&<td className="no-print"><div className="action-row">
                      <EditBtn onClick={()=>openEdit(r)} /><DelBtn onClick={()=>del(r.id)} />
                    </div></td>}
                  </tr>
                )
              })}
              {visRows.length>0&&(
                <tr style={{background:'var(--bg3)',fontWeight:700}}>
                  <td colSpan={5} style={{textAlign:'right',fontSize:'.8rem'}}>TOTAL</td>
                  <td className="td-money">{fmtRp(sumPagu(visRows))}</td>
                  <td className="td-money">{fmtRp(sumKeu(visRows))}</td>
                  <td style={{color:'var(--gold)',fontWeight:600}}>{fmtRp(visRows.reduce((s,r)=>s+(r.realisasi_bop||0),0))}</td>
                  <td colSpan={canEdit?4:3}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal&&(
        <Modal title={editId?'Edit Realisasi':'Input Realisasi'} onClose={()=>setModal(false)} wide>
          {/* Auto-fill dari RKP */}
          {rkpRows.length>0&&!editId&&(
            <div className="form-group" style={{background:'#dbeafe20',border:'1px solid #93c5fd40',borderRadius:6,padding:'.6rem .8rem'}}>
              <label className="form-label" style={{marginBottom:'.3rem'}}>⚡ Isi Otomatis dari RKP</label>
              <select className="form-control" defaultValue="" onChange={e=>autoFillFromRkp(e.target.value)}>
                <option value="">-- Pilih kegiatan dari RKP untuk auto-fill --</option>
                {rkpRows.map(r=><option key={r.id} value={r.id}>{r.program} — {r.kegiatan||r.sub_kegiatan||''}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:'.5rem',cursor:'pointer',fontSize:'.85rem',fontWeight:600}}>
              <input type="checkbox" checked={form.is_koordinasi}
                onChange={e=>setForm({...form,is_koordinasi:e.target.checked,bidang_id:e.target.checked?'koordinasi':bidTab})} />
              📋 Ini adalah Kegiatan Koordinasi Pengelolaan DBH CHT
            </label>
          </div>

          <div className="form-row">
            {!form.is_koordinasi&&(
              <div className="form-group" style={{flex:1}}>
                <label className="form-label">Bidang</label>
                <select className="form-control" value={form.bidang_id} onChange={e=>setForm({...form,bidang_id:e.target.value})} disabled={!isSekretariat}>
                  {BIDANG.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </div>
            )}
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Triwulan</label>
              <select className="form-control" value={form.triwulan} onChange={e=>setForm({...form,triwulan:e.target.value})}>
                {TWS.map(t=><option key={t} value={t}>Triwulan {t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Program *</label>
            <select className="form-control" value={form.program} onChange={e=>setForm({...form,program:e.target.value})}>
              <option value="">-- Pilih Program --</option>
              {(PROGRAM_BY_BIDANG[form.is_koordinasi?'koordinasi':form.bidang_id]||[]).map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Kegiatan / Sub Kegiatan</label>
            <input className="form-control" value={form.kegiatan} onChange={e=>setForm({...form,kegiatan:e.target.value})} />
          </div>

          {/* ── Kode Rekening ── */}
          <div className="form-group">
            <label className="form-label">Kode / Klasifikasi Nomenklatur dalam Penganggaran APBD</label>
            <select className="form-control" value={form.kode_rekening||''} onChange={e => {
              const bid = form.is_koordinasi ? 'koordinasi' : form.bidang_id
              const list = KODE_REKENING_BY_BIDANG[bid] || []
              const item = list.find(x => x.kode === e.target.value)
              setForm({...form, kode_rekening: e.target.value, nama_rekening: item?.nama||''})
            }}>
              <option value="">-- Pilih kode rekening --</option>
              {(KODE_REKENING_BY_BIDANG[form.is_koordinasi?'koordinasi':form.bidang_id]||[]).map(x=>(
                <option key={x.kode} value={x.kode}>{x.kode} — {x.nama}</option>
              ))}
            </select>
            {form.nama_rekening && (
              <div style={{fontSize:'.75rem',color:'var(--text2)',marginTop:3,fontStyle:'italic'}}>{form.nama_rekening}</div>
            )}
          </div>

          {/* ── Volume dan Satuan ── */}
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Volume</label>
              <input className="form-control" type="number" min="0" step="any"
                value={form.volume||''} placeholder="Contoh: 100"
                onChange={e=>setForm({...form,volume:e.target.value})} />
            </div>
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">Satuan</label>
              <input className="form-control"
                value={form.satuan||''} placeholder="Contoh: orang, unit, paket, kegiatan"
                onChange={e=>setForm({...form,satuan:e.target.value})} />
            </div>
          </div>

          <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'.75rem',marginBottom:'.75rem'}}>
            <div style={{fontSize:'.8rem',fontWeight:600,marginBottom:'.5rem',color:'var(--text2)'}}>💰 Realisasi Anggaran</div>
            <div className="form-row">
              <div className="form-group" style={{flex:1}}>
                <label className="form-label">Pagu (Rp)</label>
                <input className="form-control" type="number" value={form.pagu} onChange={e=>setForm({...form,pagu:e.target.value})} />
              </div>
              <div className="form-group" style={{flex:1}}>
                <label className="form-label">Realisasi Keuangan (Rp)</label>
                <input className="form-control" type="number" value={form.realisasi_keu} onChange={e=>setForm({...form,realisasi_keu:e.target.value})} />
              </div>
              <div className="form-group" style={{flex:1}}>
                <label className="form-label">Realisasi BOP (Rp)</label>
                <input className="form-control" type="number" value={form.realisasi_bop||''} onChange={e=>setForm({...form,realisasi_bop:e.target.value})} placeholder="0" />
                {Number(form.pagu) > 0 && (
                  <div style={{fontSize:'.72rem',color:'var(--gold)',marginTop:2}}>
                    Maks. BOP: Rp {new Intl.NumberFormat('id-ID').format(Math.floor(Number(form.pagu)*0.1))}
                  </div>
                )}
              </div>
            </div>
            {Number(form.pagu) > 0 && (
              <div style={{fontSize:'.75rem',color:'var(--text2)',display:'flex',gap:'1.5rem',flexWrap:'wrap'}}>
                <span>Capaian keu: <strong>{((Number(form.realisasi_keu)||0)/Number(form.pagu)*100).toFixed(1)}%</strong></span>
                {Number(form.realisasi_bop)>0&&<span style={{color:'var(--gold)'}}>BOP: <strong>{((Number(form.realisasi_bop)||0)/Number(form.pagu)*100).toFixed(1)}%</strong> dari pagu</span>}
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Realisasi Fisik (%)</label>
              <input className="form-control" type="number" min="0" max="100" value={form.realisasi_fisik} onChange={e=>setForm({...form,realisasi_fisik:e.target.value})} />
            </div>
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">Capaian Output</label>
              <input className="form-control" value={form.capaian_output||''} onChange={e=>setForm({...form,capaian_output:e.target.value})} placeholder="Contoh: 85 dari 100 petani terlatih" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Keterangan</label>
            <textarea className="form-control" rows={2} value={form.keterangan||''} onChange={e=>setForm({...form,keterangan:e.target.value})} />
          </div>

          {/* Info: boleh simpan dengan realisasi 0 — ini wajar untuk pelaporan rutin */}
          {(Number(form.realisasi_keu)||0) === 0 && (Number(form.realisasi_fisik)||0) === 0 && (
            <div style={{
              background:'#e8f4fd', border:'1px solid #90cdf4', borderRadius:6,
              padding:'.5rem .75rem', fontSize:'.78rem', color:'#1a56db',
              marginBottom:'.5rem', display:'flex', gap:'.5rem', alignItems:'flex-start'
            }}>
              <span>ℹ️</span>
              <span>Realisasi <strong>Rp 0 / 0%</strong> tetap <strong>wajib disimpan</strong> sebagai bukti pelaporan bahwa anggaran belum terserap pada periode ini.</span>
            </div>
          )}
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>{loading?'⏳...':'💾 Simpan'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
