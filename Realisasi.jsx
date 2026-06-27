import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, fmtRp, fmtPct } from '../lib/constants.js'
import { Modal, EmptyRow, DelBtn, EditBtn, PageHeader, ProgressBar, PctBadge } from '../components/UI.jsx'
import { getPaguOpd } from '../lib/supabase.js'

const EMPTY = {
  rkp_id:'', bidang_id:'', program:'', kegiatan:'', sub_kegiatan:'',
  volume:'', satuan:'', pagu_utama:0, bop:0,
  realisasi_volume:'', realisasi_pagu_utama:'', realisasi_bop:'',
  realisasi_fisik:'', capaian_output:'', triwulan:'I', keterangan:'',
  is_koordinasi:false,
}
const TWS = ['I','II','III','IV']

export default function Realisasi() {
  const { tahun, jenis, notify } = useApp()
  const { profile, isSekretariat } = useAuth()
  const [rows,    setRows]    = useState([])
  const [rkpRows, setRkpRows] = useState([]) // sumber data: hasil Penyusunan RKP
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState(EMPTY)
  const [editId,  setEditId]  = useState(null)
  const [twTab,   setTwTab]   = useState('I')
  const [bidTab,  setBidTab]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [paguOpd, setPaguOpd] = useState(null)

  useEffect(() => {
    if (!bidTab && profile) setBidTab(isSekretariat ? 'kesmas' : (profile.bidang||'kesmas'))
  }, [profile])

  useEffect(() => { if (bidTab) load() }, [tahun, jenis, bidTab])
  useEffect(() => { if (profile?.id) getPaguOpd(profile.id, tahun, jenis).then(p=>setPaguOpd(p)) }, [profile, tahun, jenis])

  async function load() {
    let q = supabase.from('realisasi_dbhcht').select('*').eq('tahun', tahun).eq('jenis', jenis).order('created_at')
    if (!isSekretariat) q = q.eq('created_by', profile?.id)
    const { data } = await q
    setRows(data || [])

    // Sumber data Realisasi = tabel hasil Penyusunan RKP (jenis & tahun yang sama)
    let rq = supabase.from('rkp_dbhcht').select('*').eq('tahun', tahun).eq('jenis', jenis)
    if (!isSekretariat) rq = rq.eq('created_by', profile?.id)
    const { data: rd } = await rq
    setRkpRows(rd || [])
  }

  const isKoor   = bidTab === 'koordinasi'
  const twRows   = rows.filter(r => r.triwulan === twTab)
  const visRows  = isKoor
    ? twRows.filter(r => r.is_koordinasi)
    : twRows.filter(r => r.bidang_id === bidTab && !r.is_koordinasi)

  // ── Helper hitung (dipakai tabel & rekap) ───────────────────────
  const paguTotal       = (r) => (r.pagu_utama||0) + (r.bop||0)
  const realisasiTotal  = (r) => (r.realisasi_pagu_utama||0) + (r.realisasi_bop||0)
  const sisaAnggaran    = (r) => paguTotal(r) - realisasiTotal(r)
  const capaianPct      = (r) => paguTotal(r) > 0 ? (realisasiTotal(r) / paguTotal(r) * 100) : 0

  const sumPaguUtama = (arr) => arr.reduce((s,r)=>s+(r.pagu_utama||0),0)
  const sumBopPagu   = (arr) => arr.reduce((s,r)=>s+(r.bop||0),0)
  const sumRealKeu   = (arr) => arr.reduce((s,r)=>s+(r.realisasi_pagu_utama||0),0)
  const sumRealBop   = (arr) => arr.reduce((s,r)=>s+(r.realisasi_bop||0),0)
  const sumSisa      = (arr) => arr.reduce((s,r)=>s+sisaAnggaran(r),0)

  const sem1   = sumRealKeu(rows.filter(r=>['I','II'].includes(r.triwulan))) + sumRealBop(rows.filter(r=>['I','II'].includes(r.triwulan)))
  const semAll = sumRealKeu(rows) + sumRealBop(rows)
  const totalPaguOpd = (paguOpd?.pagu_utama||0) + (paguOpd?.bop||0)
  const pctCapaian   = totalPaguOpd > 0 ? (semAll/totalPaguOpd*100) : 0

  const canEdit = isSekretariat
    || (profile?.role === 'opd' && (!bidTab || profile.bidang === bidTab || isKoor))

  // RKP yang belum ada Realisasi-nya di triwulan aktif (supaya tidak dobel input per triwulan)
  const rkpTersedia = rkpRows.filter(r =>
    (isKoor ? r.is_koordinasi : (r.bidang_id === bidTab && !r.is_koordinasi))
  )

  function openAdd() {
    setForm({ ...EMPTY, triwulan: twTab, is_koordinasi: isKoor })
    setEditId(null); setModal(true)
  }
  function openEdit(r) {
    setForm({
      ...r,
      realisasi_volume:     String(r.realisasi_volume||''),
      realisasi_pagu_utama: String(r.realisasi_pagu_utama||''),
      realisasi_bop:        String(r.realisasi_bop||''),
      realisasi_fisik:      String(r.realisasi_fisik||''),
    })
    setEditId(r.id); setModal(true)
  }

  // Pilih kegiatan dari hasil Penyusunan RKP — Pagu Utama, BOP, Volume,
  // Satuan, Program, Kegiatan ikut otomatis & terkunci (read-only).
  // Catatan: r.pagu / r.pagu_bop di sini adalah kolom milik tabel RKP
  // (rkp_dbhcht), namanya TIDAK berubah. Yang disalin ke form pakai
  // nama field baru (pagu_utama/bop) sesuai skema realisasi_dbhcht.
  function pilihRkp(rkpId) {
    const r = rkpRows.find(x => x.id === rkpId)
    if (!r) { setForm(f => ({ ...f, rkp_id:'' })); return }
    setForm(f => ({
      ...f,
      rkp_id: r.id,
      bidang_id: r.bidang_id, is_koordinasi: r.is_koordinasi,
      program: r.program, kegiatan: r.kegiatan, sub_kegiatan: r.sub_kegiatan,
      volume: r.volume, satuan: r.satuan,
      pagu_utama: r.pagu || 0, bop: r.pagu_bop || 0,
    }))
  }

  async function save() {
    if (!form.rkp_id) { notify('Pilih kegiatan dari Penyusunan RKP terlebih dahulu!', 'warn'); return }
    setLoading(true)
    const payload = {
      tahun, jenis, triwulan: form.triwulan,
      rkp_id:          form.rkp_id,
      bidang_id:       form.is_koordinasi ? 'koordinasi' : form.bidang_id,
      program:         form.program, kegiatan: form.kegiatan, sub_kegiatan: form.sub_kegiatan,
      volume:          Number(form.volume)||null,
      satuan:          form.satuan,
      pagu_utama:      Number(form.pagu_utama)||0,
      bop:             Number(form.bop)||0,
      realisasi_volume:     Number(form.realisasi_volume)||0,
      realisasi_pagu_utama: Number(form.realisasi_pagu_utama)||0,
      realisasi_bop:        Number(form.realisasi_bop)||0,
      realisasi_fisik:      Number(form.realisasi_fisik)||0,
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
        {canEdit&&<button className="btn btn-primary btn-sm" onClick={openAdd}>+ Input Realisasi</button>}
        <button className="btn btn-outline btn-sm no-print" onClick={()=>window.print()}>🖨️ Cetak</button>
      </PageHeader>

      <div className="g2 mb-2">
        <div className="stat-box">
          <div className="stat-lbl">Realisasi Semester I (Tw I+II)</div>
          <div className="stat-val" style={{color:'var(--info)'}}>{fmtRp(sem1)}</div>
          <div className="stat-sub">{totalPaguOpd>0?fmtPct(sem1/totalPaguOpd*100):'0.0%'} dari pagu OPD</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Capaian Realisasi (%)</div>
          <div className="stat-val" style={{color:pctCapaian>=80?'var(--accent)':pctCapaian>=50?'var(--gold)':'var(--danger)'}}>
            {fmtPct(pctCapaian)}
          </div>
          <div className="stat-sub">Total: {fmtRp(semAll)}</div>
        </div>
      </div>

      {/* Triwulan tabs */}
      <div className="tabs">
        {TWS.map(t=>(
          <div key={t} className={`tab ${twTab===t?'active':''}`} onClick={()=>setTwTab(t)}>
            Triwulan {t}
            <span style={{fontSize:'.7rem',color:'var(--text2)',marginLeft:4}}>
              · {fmtRp(sumRealKeu(rows.filter(r=>r.triwulan===t))+sumRealBop(rows.filter(r=>r.triwulan===t)))}
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
            {fmtRp(sumRealKeu(visRows)+sumRealBop(visRows))} / {fmtRp(sumPaguUtama(visRows)+sumBopPagu(visRows))}
          </strong>
        </div>

        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>No</th><th>Program / Kegiatan</th>
              <th>Vol.</th>
              <th>Pagu Utama (Rp)</th><th>BOP (Rp)</th>
              <th>Real. Volume</th>
              <th>Real. Pagu Utama (Rp)</th><th>Real. BOP (Rp)</th>
              <th>Capaian (%)</th><th>Sisa Anggaran (Rp)</th>
              <th>Fisik %</th><th>OPD</th>
              {canEdit&&<th className="no-print">Aksi</th>}
            </tr></thead>
            <tbody>
              {visRows.length===0&&<EmptyRow cols={canEdit?13:12} msg="Belum ada data Realisasi." />}
              {visRows.map((r,i)=>{
                const pct  = capaianPct(r)
                const sisa = sisaAnggaran(r)
                return (
                  <tr key={r.id} className={r.is_koordinasi?'koordinasi-row':''}>
                    <td style={{fontSize:'.75rem',color:'var(--text2)'}}>{i+1}</td>
                    <td>
                      <div className="td-bold" style={{fontSize:'.8rem'}}>{r.program}</div>
                      <div className="td-muted">{r.kegiatan}</div>
                    </td>
                    <td style={{fontSize:'.78rem',whiteSpace:'nowrap'}}>{r.volume||''} {r.satuan||''}</td>
                    <td className="td-muted">{fmtRp(r.pagu_utama)}</td>
                    <td style={{color:'var(--gold)',fontWeight:600}}>{fmtRp(r.bop||0)}</td>
                    <td style={{fontSize:'.78rem',whiteSpace:'nowrap'}}>{r.realisasi_volume||0} {r.satuan||''}</td>
                    <td className="td-money">{fmtRp(r.realisasi_pagu_utama)}</td>
                    <td style={{color:'var(--gold)',fontWeight:600}}>{fmtRp(r.realisasi_bop||0)}</td>
                    <td><PctBadge value={pct} /></td>
                    <td className="td-muted" style={{color: sisa<0 ? 'var(--danger)' : undefined}}>{fmtRp(sisa)}</td>
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
                  <td colSpan={2} style={{textAlign:'right',fontSize:'.8rem'}}>TOTAL</td>
                  <td></td>
                  <td className="td-money">{fmtRp(sumPaguUtama(visRows))}</td>
                  <td style={{color:'var(--gold)',fontWeight:600}}>{fmtRp(sumBopPagu(visRows))}</td>
                  <td></td>
                  <td className="td-money">{fmtRp(sumRealKeu(visRows))}</td>
                  <td style={{color:'var(--gold)',fontWeight:600}}>{fmtRp(sumRealBop(visRows))}</td>
                  <td>{fmtPct((sumPaguUtama(visRows)+sumBopPagu(visRows))>0 ? (sumRealKeu(visRows)+sumRealBop(visRows))/(sumPaguUtama(visRows)+sumBopPagu(visRows))*100 : 0)}</td>
                  <td className="td-muted">{fmtRp(sumSisa(visRows))}</td>
                  <td colSpan={canEdit?3:2}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal&&(
        <Modal title={editId?'Edit Realisasi':'Input Realisasi'} onClose={()=>setModal(false)} wide>
          {/* Sumber data: hasil Penyusunan RKP */}
          <div className="form-group" style={{background:'#dbeafe20',border:'1px solid #93c5fd40',borderRadius:6,padding:'.6rem .8rem'}}>
            <label className="form-label" style={{marginBottom:'.3rem'}}>⚡ Pilih Kegiatan dari Penyusunan RKP *</label>
            <select className="form-control" value={form.rkp_id} disabled={!!editId}
              onChange={e=>pilihRkp(e.target.value)}>
              <option value="">-- Pilih kegiatan hasil Penyusunan RKP --</option>
              {rkpTersedia.map(r=><option key={r.id} value={r.id}>{r.program} — {r.kegiatan||r.sub_kegiatan||''}</option>)}
            </select>
            {rkpTersedia.length===0&&(
              <div style={{fontSize:'.75rem',color:'var(--text2)',marginTop:'.3rem'}}>
                Belum ada data di menu Penyusunan RKP untuk bidang ini. Tambahkan dahulu di menu RKP.
              </div>
            )}
          </div>

          {form.rkp_id&&(
            <>
              <div className="form-row">
                <div className="form-group" style={{flex:1}}>
                  <label className="form-label">Triwulan</label>
                  <select className="form-control" value={form.triwulan} onChange={e=>setForm({...form,triwulan:e.target.value})}>
                    {TWS.map(t=><option key={t} value={t}>Triwulan {t}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{flex:2}}>
                  <label className="form-label">Program / Kegiatan</label>
                  <input className="form-control" readOnly value={`${form.program}${form.kegiatan?' — '+form.kegiatan:''}`}
                    style={{background:'var(--bg3)'}} />
                </div>
              </div>

              <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'.75rem',marginBottom:'.75rem'}}>
                <div style={{fontSize:'.8rem',fontWeight:600,marginBottom:'.5rem',color:'var(--text2)'}}>📄 Rencana (dari RKP — tidak dapat diubah di sini)</div>
                <div className="form-row">
                  <div className="form-group" style={{flex:1}}>
                    <label className="form-label">Volume</label>
                    <input className="form-control" readOnly value={`${form.volume||''} ${form.satuan||''}`} style={{background:'var(--bg2)'}} />
                  </div>
                  <div className="form-group" style={{flex:1}}>
                    <label className="form-label">Pagu Utama (Rp)</label>
                    <input className="form-control" readOnly value={fmtRp(form.pagu_utama)} style={{background:'var(--bg2)'}} />
                  </div>
                  <div className="form-group" style={{flex:1}}>
                    <label className="form-label">BOP (Rp)</label>
                    <input className="form-control" readOnly value={fmtRp(form.bop)} style={{background:'var(--bg2)'}} />
                  </div>
                </div>
              </div>

              <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'.75rem',marginBottom:'.75rem'}}>
                <div style={{fontSize:'.8rem',fontWeight:600,marginBottom:'.5rem',color:'var(--text2)'}}>💰 Realisasi</div>
                <div className="form-row">
                  <div className="form-group" style={{flex:1}}>
                    <label className="form-label">Realisasi Volume</label>
                    <input className="form-control" type="number" value={form.realisasi_volume}
                      onChange={e=>setForm({...form,realisasi_volume:e.target.value})} placeholder="0" />
                  </div>
                  <div className="form-group" style={{flex:1}}>
                    <label className="form-label">Realisasi Pagu Utama (Rp)</label>
                    <input className="form-control" type="number" value={form.realisasi_pagu_utama}
                      onChange={e=>setForm({...form,realisasi_pagu_utama:e.target.value})} placeholder="0" />
                  </div>
                  <div className="form-group" style={{flex:1}}>
                    <label className="form-label">Realisasi BOP (Rp)</label>
                    <input className="form-control" type="number" value={form.realisasi_bop}
                      onChange={e=>setForm({...form,realisasi_bop:e.target.value})} placeholder="0" />
                  </div>
                </div>
                <div style={{display:'flex',gap:'1.5rem',fontSize:'.78rem',color:'var(--text2)',marginTop:'.3rem'}}>
                  <span>Capaian Realisasi: <strong style={{color:'var(--accent)'}}>
                    {fmtPct((Number(form.pagu_utama)||0)+(Number(form.bop)||0) > 0
                      ? ((Number(form.realisasi_pagu_utama)||0)+(Number(form.realisasi_bop)||0)) / ((Number(form.pagu_utama)||0)+(Number(form.bop)||0)) * 100
                      : 0)}
                  </strong></span>
                  <span>Sisa Anggaran: <strong>
                    {fmtRp(((Number(form.pagu_utama)||0)+(Number(form.bop)||0)) - ((Number(form.realisasi_pagu_utama)||0)+(Number(form.realisasi_bop)||0)))}
                  </strong></span>
                </div>
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
            </>
          )}

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading||!form.rkp_id}>{loading?'⏳...':'💾 Simpan'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
