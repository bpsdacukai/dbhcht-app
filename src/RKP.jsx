import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, PROGRAM_BY_BIDANG, SUB_KEGIATAN_KOORDINASI, KODE_REKENING_BY_BIDANG, fmtRp, maxBop } from '../lib/constants.js'
import { Modal, EmptyRow, DelBtn, EditBtn, PageHeader } from '../components/UI.jsx'
import { getPaguOpd } from '../lib/supabase.js'
import RKPPerubahan from './RKPPerubahan.jsx'

const EMPTY = {
  bidang_id:'', program:'', kegiatan:'', sub_kegiatan:'',
  kode_rekening:'', nama_rekening:'', volume:'', satuan:'Paket',
  pagu:'', pagu_bop:'', rincian:'', target_output:'',
  keterangan:'', is_koordinasi:false
}

export default function RKP() {
  const { tahun, jenis, notify } = useApp()
  const { profile, isSekretariat } = useAuth()
  const [rows,    setRows]    = useState([])
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState(EMPTY)
  const [editId,  setEditId]  = useState(null)
  const [activeTab, setTab]   = useState(null) // null = set after profile loads
  const [loading, setLoading] = useState(false)
  const [paguOpd, setPaguOpd] = useState(null)
  const [bopWarn, setBopWarn] = useState('')

  // set default tab berdasarkan role
  useEffect(() => {
    if (!activeTab && profile) {
      setTab(isSekretariat ? 'kesmas' : (profile.bidang || 'kesmas'))
    }
  }, [profile])

  useEffect(() => { if (activeTab) load() }, [tahun, jenis, activeTab])

  useEffect(() => {
    if (profile?.id) getPaguOpd(profile.id, tahun, jenis).then(p => setPaguOpd(p))
  }, [profile, tahun, jenis])

  // Format RKP Perubahan berbeda dari RKP Murni (ada kolom Semula/Menjadi
  // sesuai PMK 22/2026). Logika & tampilan RKP Murni di bawah ini tidak diubah.
  if (jenis === 'Perubahan') return <RKPPerubahan />

  async function load() {
    let q = supabase.from('rkp_dbhcht').select('*').eq('tahun', tahun).eq('jenis', jenis).order('created_at')
    // OPD hanya lihat data miliknya (RLS juga enforce ini di server)
    if (!isSekretariat) q = q.eq('created_by', profile?.id)
    const { data } = await q
    setRows(data || [])
  }

  const isKoor   = activeTab === 'koordinasi'
  const tabRows  = isKoor
    ? rows.filter(r => r.is_koordinasi)
    : rows.filter(r => r.bidang_id === activeTab && !r.is_koordinasi)
  const totalTab = tabRows.reduce((s,r)=>s+(r.pagu||0)+(r.pagu_bop||0),0)
  const totalAll = rows.reduce((s,r)=>s+(r.pagu||0)+(r.pagu_bop||0),0)

  // OPD bisa edit jika tab = bidangnya ATAU tab koordinasi
  const canEdit = isSekretariat
    || (profile?.role === 'opd' && (!activeTab || profile.bidang === activeTab || isKoor))

  function openAdd() {
    const defBid = isKoor ? 'koordinasi' : (isSekretariat ? activeTab : profile?.bidang || activeTab)
    setForm({ ...EMPTY, bidang_id: defBid || 'kesmas', is_koordinasi: isKoor })
    setBopWarn(''); setEditId(null); setModal(true)
  }
  function openEdit(r) {
    setForm({ ...r, pagu: String(r.pagu||''), pagu_bop: String(r.pagu_bop||''), volume: String(r.volume||'') })
    setBopWarn(''); setEditId(r.id); setModal(true)
  }

  function handlePaguChange(val) {
    const p = Number(val) || 0
    const bop = Number(form.pagu_bop) || 0
    const mx  = maxBop(p)
    setBopWarn(bop > mx ? `⚠️ BOP melebihi 10% (maks: ${fmtRp(mx)})` : '')
    setForm(f => ({ ...f, pagu: val }))
  }
  function handleBopChange(val) {
    const bop = Number(val) || 0
    const mx  = maxBop(Number(form.pagu) || 0)
    setBopWarn(bop > mx ? `⚠️ BOP melebihi 10% (maks: ${fmtRp(mx)})` : '')
    setForm(f => ({ ...f, pagu_bop: val }))
  }

  async function save() {
    if (!form.program || !form.pagu) { notify('Program dan Pagu wajib diisi!', 'warn'); return }
    const bop = Number(form.pagu_bop) || 0
    const mx  = maxBop(Number(form.pagu))
    if (bop > mx) { notify('BOP melebihi batas 10% dari pagu!', 'error'); return }
    setLoading(true)
    const payload = {
      tahun, jenis,
      bidang_id:     form.is_koordinasi ? 'koordinasi' : form.bidang_id,
      program:       form.program,
      kegiatan:      form.kegiatan,
      sub_kegiatan:  form.sub_kegiatan,
      kode_rekening: form.kode_rekening,
      nama_rekening: form.nama_rekening,
      volume:        Number(form.volume)||null,
      satuan:        form.satuan,
      pagu:          Number(form.pagu)||0,
      pagu_bop:      bop,
      rincian:       form.rincian,
      target_output: form.target_output,
      keterangan:    form.keterangan,
      is_koordinasi: form.is_koordinasi,
      created_by:    profile?.id,
      created_by_nama: profile?.nama,
    }
    const { error } = editId
      ? await supabase.from('rkp_dbhcht').update(payload).eq('id', editId)
      : await supabase.from('rkp_dbhcht').insert(payload)
    setLoading(false)
    if (error) { notify('Gagal: ' + error.message, 'error'); return }
    notify(editId ? 'RKP diperbarui' : 'RKP ditambahkan', 'success')
    setModal(false); load()
  }

  async function del(id) {
    if (!confirm('Hapus data RKP ini?')) return
    await supabase.from('rkp_dbhcht').delete().eq('id', id)
    notify('Data dihapus', 'warn'); load()
  }

  const kodeOpts = KODE_REKENING_BY_BIDANG[form.is_koordinasi ? 'koordinasi' : form.bidang_id] || []
  const progOpts = PROGRAM_BY_BIDANG[form.is_koordinasi ? 'koordinasi' : form.bidang_id] || []

  const tabs = isSekretariat
    ? [...BIDANG, KOORDINASI]
    : (profile?.bidang === 'all' ? [...BIDANG, KOORDINASI] : [
        ...(BIDANG.filter(b => b.id === profile?.bidang)),
        KOORDINASI
      ])

  if (!activeTab) return <div className="text-muted" style={{padding:'2rem'}}>Memuat...</div>

  return (
    <div>
      <PageHeader title="📄 Penyusunan RKP DBH CHT">
        <span className="chip">TA {tahun} · {jenis}</span>
        {paguOpd && <span className="chip" style={{color:'var(--gold)'}}>Pagu OPD: {fmtRp((paguOpd.pagu_utama||0)+(paguOpd.bop||0))}</span>}
        <span className="chip">Total RKP: {fmtRp(totalAll)}</span>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Tambah</button>}
        <button className="btn btn-outline btn-sm no-print" onClick={()=>window.print()}>🖨️ Cetak</button>
      </PageHeader>

      <div className="tabs">
        {tabs.map(b => (
          <div key={b.id}
            className={`tab ${activeTab===b.id?'active':''}`}
            style={activeTab===b.id&&b.id==='koordinasi'?{color:KOORDINASI.color,borderBottomColor:KOORDINASI.color}:{}}
            onClick={()=>setTab(b.id)}
          >
            {b.icon} {b.short}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex-between mb-1">
          <div className="card-title" style={{margin:0}}>
            {isKoor ? <>{KOORDINASI.icon} {KOORDINASI.label}</> : <>{BIDANG.find(b=>b.id===activeTab)?.icon} {BIDANG.find(b=>b.id===activeTab)?.label}</>}
          </div>
          <strong style={{color:'var(--accent)'}}>{fmtRp(totalTab)}</strong>
        </div>

        {isKoor && (
          <div style={{background:'#fdf5e430',border:'1px solid #b5832a40',borderRadius:6,padding:'.6rem .8rem',marginBottom:'.75rem',fontSize:'.8rem',color:'var(--text2)'}}>
            📋 Kegiatan Koordinasi Pengelolaan DBH CHT — diisi oleh semua OPD yang melaksanakan kegiatan koordinasi. Kode rekening: <code>4.01.03.2.04.0001</code> atau <code>5.02.02.2.02.0005</code>
          </div>
        )}

        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>No</th><th>Program / Kegiatan</th><th>Sub Kegiatan</th>
              <th>Kode Rekening</th><th>Vol.</th>
              <th>Pagu Utama (Rp)</th><th>BOP (Rp)</th><th>Total (Rp)</th>
              <th>OPD</th>{canEdit&&<th className="no-print">Aksi</th>}
            </tr></thead>
            <tbody>
              {tabRows.length===0&&<EmptyRow cols={canEdit?10:9} msg="Belum ada data RKP." />}
              {tabRows.map((r,i)=>(
                <tr key={r.id} className={r.is_koordinasi?'koordinasi-row':''}>
                  <td style={{fontSize:'.75rem',color:'var(--text2)'}}>{i+1}</td>
                  <td>
                    <div className="td-bold" style={{fontSize:'.8rem'}}>{r.program}</div>
                    <div className="td-muted">{r.kegiatan}</div>
                  </td>
                  <td style={{fontSize:'.78rem'}}>{r.sub_kegiatan||'—'}</td>
                  <td><span className="td-code">{r.kode_rekening||'—'}</span>
                    {r.nama_rekening&&<div className="td-muted" style={{fontSize:'.7rem'}}>{r.nama_rekening.slice(0,40)}{r.nama_rekening.length>40?'...':''}</div>}
                  </td>
                  <td style={{fontSize:'.78rem',whiteSpace:'nowrap'}}>{r.volume||''} {r.satuan||''}</td>
                  <td className="td-money">{fmtRp(r.pagu)}</td>
                  <td style={{color:'var(--gold)',fontWeight:600}}>{fmtRp(r.pagu_bop||0)}</td>
                  <td className="td-money">{fmtRp((r.pagu||0)+(r.pagu_bop||0))}</td>
                  <td className="td-muted">{r.created_by_nama}</td>
                  {canEdit&&<td className="no-print"><div className="action-row">
                    <EditBtn onClick={()=>openEdit(r)} />
                    <DelBtn onClick={()=>del(r.id)} />
                  </div></td>}
                </tr>
              ))}
              {tabRows.length>0&&(
                <tr style={{background:'var(--bg3)',fontWeight:700}}>
                  <td colSpan={5} style={{textAlign:'right',fontSize:'.8rem'}}>TOTAL</td>
                  <td className="td-money">{fmtRp(tabRows.reduce((s,r)=>s+(r.pagu||0),0))}</td>
                  <td style={{color:'var(--gold)',fontWeight:600}}>{fmtRp(tabRows.reduce((s,r)=>s+(r.pagu_bop||0),0))}</td>
                  <td className="td-money">{fmtRp(totalTab)}</td>
                  <td colSpan={canEdit?2:1}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal&&(
        <Modal title={editId?'Edit Data RKP':'Tambah Data RKP'} onClose={()=>setModal(false)} wide>
          {/* Toggle Koordinasi — semua OPD bisa */}
          <div className="form-group" style={{background:'#fdf5e430',border:'1px solid #b5832a40',borderRadius:6,padding:'.6rem .8rem'}}>
            <label style={{display:'flex',alignItems:'center',gap:'.5rem',cursor:'pointer',fontSize:'.85rem',fontWeight:600}}>
              <input type="checkbox" checked={form.is_koordinasi}
                onChange={e=>setForm({...form,is_koordinasi:e.target.checked,bidang_id:e.target.checked?'koordinasi':(isSekretariat?activeTab:profile?.bidang||activeTab)})} />
              📋 Ini adalah Kegiatan Koordinasi Pengelolaan DBH CHT
            </label>
            <div style={{fontSize:'.75rem',color:'var(--text2)',marginTop:'.3rem',marginLeft:'1.3rem'}}>
              Centang jika kegiatan ini termasuk koordinasi tim DBH CHT (kode 4.01.03... atau 5.02.02...)
            </div>
          </div>

          <div className="form-row" style={{marginTop:'.5rem'}}>
            {!form.is_koordinasi&&(
              <div className="form-group" style={{flex:1,minWidth:160}}>
                <label className="form-label">Bidang</label>
                <select className="form-control" value={form.bidang_id}
                  onChange={e=>setForm({...form,bidang_id:e.target.value,program:'',kode_rekening:'',nama_rekening:''})}
                  disabled={!isSekretariat}>
                  {BIDANG.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </div>
            )}
            <div className="form-group" style={{flex:2,minWidth:200}}>
              <label className="form-label">Program *</label>
              <select className="form-control" value={form.program} onChange={e=>setForm({...form,program:e.target.value})}>
                <option value="">-- Pilih Program --</option>
                {progOpts.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Kegiatan</label>
            <input className="form-control" value={form.kegiatan} onChange={e=>setForm({...form,kegiatan:e.target.value})} placeholder="Nama kegiatan" />
          </div>

          <div className="form-group">
            <label className="form-label">Sub Kegiatan</label>
            {form.is_koordinasi?(
              <select className="form-control" value={form.sub_kegiatan} onChange={e=>setForm({...form,sub_kegiatan:e.target.value})}>
                <option value="">-- Pilih Sub Kegiatan --</option>
                {SUB_KEGIATAN_KOORDINASI.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            ):(
              <input className="form-control" value={form.sub_kegiatan} onChange={e=>setForm({...form,sub_kegiatan:e.target.value})} />
            )}
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Kode Rekening</label>
              <select className="form-control" value={form.kode_rekening} onChange={e=>{
                const k=kodeOpts.find(x=>x.kode===e.target.value)
                setForm({...form,kode_rekening:e.target.value,nama_rekening:k?.nama||form.nama_rekening})
              }}>
                <option value="">-- Pilih Kode --</option>
                {kodeOpts.map(k=><option key={k.kode} value={k.kode}>{k.kode}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">Nama Rekening</label>
              <input className="form-control" value={form.nama_rekening} onChange={e=>setForm({...form,nama_rekening:e.target.value})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Volume</label>
              <input className="form-control" type="number" value={form.volume} onChange={e=>setForm({...form,volume:e.target.value})} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Satuan</label>
              <input className="form-control" value={form.satuan} onChange={e=>setForm({...form,satuan:e.target.value})} placeholder="Paket/Orang/Unit" />
            </div>
          </div>

          <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,padding:'.75rem',marginBottom:'.75rem'}}>
            <div style={{fontSize:'.8rem',fontWeight:600,marginBottom:'.5rem',color:'var(--text2)'}}>💰 Anggaran</div>
            <div className="form-row">
              <div className="form-group" style={{flex:1}}>
                <label className="form-label">Pagu Utama (Rp) *</label>
                <input className="form-control" type="number" value={form.pagu} onChange={e=>handlePaguChange(e.target.value)} placeholder="0" />
              </div>
              <div className="form-group" style={{flex:1}}>
                <label className="form-label">
                  BOP (maks 10%) *
                  <span style={{fontSize:'.7rem',color:'var(--text2)',fontWeight:400,marginLeft:'.3rem'}}>
                    maks: {fmtRp(maxBop(Number(form.pagu)||0))}
                  </span>
                </label>
                <input className="form-control" type="number" value={form.pagu_bop} onChange={e=>handleBopChange(e.target.value)} placeholder="0"
                  style={bopWarn?{borderColor:'var(--danger)'}:{}} />
              </div>
              <div className="form-group" style={{flex:1}}>
                <label className="form-label">Total Anggaran</label>
                <input className="form-control" readOnly value={fmtRp((Number(form.pagu)||0)+(Number(form.pagu_bop)||0))}
                  style={{fontWeight:700,color:'var(--accent)',background:'var(--bg3)'}} />
              </div>
            </div>
            {bopWarn&&<div style={{color:'var(--danger)',fontSize:'.78rem',marginTop:'-.3rem'}}>{bopWarn}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Target / Output Kegiatan</label>
            <input className="form-control" value={form.target_output||''} onChange={e=>setForm({...form,target_output:e.target.value})} placeholder="Contoh: 100 petani terlatih" />
          </div>
          <div className="form-group">
            <label className="form-label">Rincian Belanja</label>
            <textarea className="form-control" rows={2} value={form.rincian||''} onChange={e=>setForm({...form,rincian:e.target.value})} placeholder="Uraian rincian penggunaan anggaran" />
          </div>
          <div className="form-group">
            <label className="form-label">Keterangan</label>
            <textarea className="form-control" rows={2} value={form.keterangan||''} onChange={e=>setForm({...form,keterangan:e.target.value})} />
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading||!!bopWarn}>
              {loading?'⏳ Menyimpan...':'💾 Simpan'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
