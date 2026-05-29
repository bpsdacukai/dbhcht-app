import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, PROGRAM_BY_BIDANG, fmtRp, maxBop, today } from '../lib/constants.js'
import { Modal, EmptyRow, DelBtn, PageHeader } from '../components/UI.jsx'
import { tindakLanjutAsistensi, tindakLanjutRekonsiliasi } from '../lib/ai.js'

// ── PESERTA COMPONENT ────────────────────────────────────────
function PesertaEditor({ label, peserta, onChange }) {
  const add    = () => onChange([...peserta, { nama:'', jabatan:'' }])
  const remove = (i) => onChange(peserta.filter((_,idx)=>idx!==i))
  const update = (i, field, val) => onChange(peserta.map((p,idx)=>idx===i?{...p,[field]:val}:p))
  return (
    <div style={{marginBottom:'.75rem'}}>
      <div className="flex-between mb-1">
        <label className="form-label" style={{margin:0}}>{label}</label>
        <button className="btn btn-outline btn-sm" type="button" onClick={add}>+ Tambah</button>
      </div>
      {peserta.length===0&&<div className="text-muted" style={{fontSize:'.78rem'}}>Belum ada peserta. Klik + Tambah.</div>}
      {peserta.map((p,i)=>(
        <div key={i} className="form-row" style={{marginBottom:'.4rem',alignItems:'center'}}>
          <div style={{flex:2}}>
            <input className="form-control" value={p.nama} onChange={e=>update(i,'nama',e.target.value)} placeholder={`Nama peserta ${i+1}`} />
          </div>
          <div style={{flex:2}}>
            <input className="form-control" value={p.jabatan} onChange={e=>update(i,'jabatan',e.target.value)} placeholder="Jabatan/NIP" />
          </div>
          <button className="btn btn-sm" style={{background:'rgba(192,57,43,.12)',color:'var(--danger)',border:'none',flexShrink:0}} onClick={()=>remove(i)}>×</button>
        </div>
      ))}
    </div>
  )
}

// ── ASISTENSI ──────────────────────────────────────────────────
export function Asistensi() {
  const { tahun, notify } = useApp()
  const { profile } = useAuth()
  const [rows,   setRows]   = useState([])
  const [modal,  setModal]  = useState(false)
  const [detail, setDetail] = useState(null) // view detail BA
  const [opds,   setOpds]   = useState([])
  const [rkpOPD, setRkpOPD] = useState([]) // RKP dari OPD terpilih
  const [aiLoad, setAiLoad] = useState(false)
  const [loading,setLoading]= useState(false)
  const [form, setForm] = useState({
    nomor_ba:'', tanggal: new Date().toISOString().slice(0,10), tempat:'',
    opd:'', opd_user_id:'', bidang_id:'kesmas',
    program:'', kegiatan:'', sub_kegiatan:'', pagu_usulan:'',
    peserta_sekretariat:[], peserta_opd:[],
    hasil_pembahasan:'', catatan:'', tindak_lanjut:'',
    kesimpulan:'dapat_ditindaklanjuti', rkp_snapshot:[]
  })

  useEffect(()=>{ load(); loadOpds() },[tahun])

  async function load() {
    const { data } = await supabase.from('asistensi_dbhcht').select('*').eq('tahun',tahun).order('created_at',{ascending:false})
    setRows(data||[])
  }
  async function loadOpds() {
    const { data } = await supabase.from('profiles').select('id,nama,bidang').eq('role','opd').eq('aktif',true).order('nama')
    setOpds(data||[])
  }

  // Saat OPD dipilih, load RKP-nya dan auto-fill
  async function onSelectOpd(opdNama, opdId) {
    setForm(f=>({...f, opd:opdNama, opd_user_id:opdId, program:'', kegiatan:'', sub_kegiatan:'', pagu_usulan:'', rkp_snapshot:[]}))
    if (!opdId) { setRkpOPD([]); return }
    const { data } = await supabase.from('rkp_dbhcht').select('*').eq('tahun',tahun).eq('created_by',opdId).order('created_at')
    setRkpOPD(data||[])
  }

  // Auto-fill dari RKP yang dipilih
  function onSelectRkp(rkpId) {
    if (rkpId === '__all__') {
      // Snapshot semua RKP OPD ini
      setForm(f=>({...f, rkp_snapshot:rkpOPD}))
      return
    }
    const r = rkpOPD.find(x=>x.id===rkpId)
    if (!r) return
    setForm(f=>({
      ...f,
      program:    r.program||'',
      kegiatan:   r.kegiatan||'',
      sub_kegiatan: r.sub_kegiatan||'',
      pagu_usulan:  String((r.pagu||0)+(r.pagu_bop||0)),
      bidang_id:  r.bidang_id,
      rkp_snapshot: [r]
    }))
  }

  async function genAI() {
    if (!form.hasil_pembahasan) { notify('Isi hasil pembahasan terlebih dahulu','warn'); return }
    setAiLoad(true)
    const text = await tindakLanjutAsistensi({ opd:form.opd, program:form.program, hasil:form.hasil_pembahasan, catatan:form.catatan })
    setForm(f=>({...f, tindak_lanjut:text}))
    setAiLoad(false)
  }

  async function save() {
    if (!form.opd||!form.program) { notify('OPD dan Program wajib!','warn'); return }
    setLoading(true)
    const { error } = await supabase.from('asistensi_dbhcht').insert({
      tahun, tanggal:form.tanggal, nomor_ba:form.nomor_ba, tempat:form.tempat,
      opd:form.opd, opd_user_id:form.opd_user_id||null,
      bidang_id:form.bidang_id, program:form.program,
      kegiatan:form.kegiatan, sub_kegiatan:form.sub_kegiatan,
      pagu_usulan:Number(form.pagu_usulan)||0,
      peserta_sekretariat:form.peserta_sekretariat,
      peserta_opd:form.peserta_opd,
      hasil_pembahasan:form.hasil_pembahasan, catatan:form.catatan,
      tindak_lanjut:form.tindak_lanjut, kesimpulan:form.kesimpulan,
      rkp_snapshot:form.rkp_snapshot,
      created_by:profile?.id,
    })
    setLoading(false)
    if (error) { notify('Gagal: '+error.message,'error'); return }
    notify('Berita Acara Asistensi tersimpan','success'); setModal(false); load()
  }

  async function del(id) {
    if (!confirm('Hapus?')) return
    await supabase.from('asistensi_dbhcht').delete().eq('id',id)
    notify('Dihapus','warn'); load()
  }

  return (
    <div>
      <PageHeader title="🤝 Asistensi RKP DBH CHT">
        <button className="btn btn-primary btn-sm" onClick={()=>{
          setForm({nomor_ba:'',tanggal:new Date().toISOString().slice(0,10),tempat:'',opd:'',opd_user_id:'',bidang_id:'kesmas',program:'',kegiatan:'',sub_kegiatan:'',pagu_usulan:'',peserta_sekretariat:[],peserta_opd:[],hasil_pembahasan:'',catatan:'',tindak_lanjut:'',kesimpulan:'dapat_ditindaklanjuti',rkp_snapshot:[]})
          setRkpOPD([]); setModal(true)
        }}>+ Tambah</button>
        <button className="btn btn-outline btn-sm no-print" onClick={()=>window.print()}>🖨️ Cetak</button>
      </PageHeader>

      <div className="card">
        <div className="card-title">📋 Berita Acara Asistensi TA {tahun}</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>No. BA</th><th>Tanggal</th><th>OPD</th><th>Program</th>
              <th>Pagu Usulan</th><th>Peserta</th><th>Kesimpulan</th>
              <th className="no-print">Aksi</th>
            </tr></thead>
            <tbody>
              {rows.length===0&&<EmptyRow cols={8} />}
              {rows.map(r=>(
                <tr key={r.id}>
                  <td style={{fontSize:'.78rem'}}>{r.nomor_ba||'—'}</td>
                  <td className="td-muted" style={{whiteSpace:'nowrap'}}>{r.tanggal}</td>
                  <td className="td-bold">{r.opd}</td>
                  <td style={{fontSize:'.8rem'}}>{r.program}</td>
                  <td className="td-money">{fmtRp(r.pagu_usulan)}</td>
                  <td style={{fontSize:'.75rem'}}>
                    {Array.isArray(r.peserta_sekretariat)?r.peserta_sekretariat.length:0} Skrt +&nbsp;
                    {Array.isArray(r.peserta_opd)?r.peserta_opd.length:0} OPD
                  </td>
                  <td>
                    <span className={`badge ${r.kesimpulan==='dapat_ditindaklanjuti'?'badge-green':'badge-amber'}`}>
                      {r.kesimpulan==='dapat_ditindaklanjuti'?'✅ Lanjut':'⚠️ Perbaikan'}
                    </span>
                  </td>
                  <td className="no-print">
                    <div className="action-row">
                      <button className="btn btn-outline btn-sm" onClick={()=>setDetail(r)}>👁️</button>
                      <DelBtn onClick={()=>del(r.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / Print modal */}
      {detail&&(
        <Modal title={`BA Asistensi — ${detail.opd}`} onClose={()=>setDetail(null)} wide>
          <div style={{fontSize:'.83rem',lineHeight:1.7}}>
            <div className="g2 mb-1">
              <div><strong>Nomor BA:</strong> {detail.nomor_ba||'—'}</div>
              <div><strong>Tanggal:</strong> {detail.tanggal}</div>
              <div><strong>Tempat:</strong> {detail.tempat||'—'}</div>
              <div><strong>OPD:</strong> {detail.opd}</div>
              <div><strong>Program:</strong> {detail.program}</div>
              <div><strong>Pagu Usulan:</strong> {fmtRp(detail.pagu_usulan)}</div>
            </div>
            <hr className="divider"/>
            <strong>Peserta Sekretariat:</strong>
            <table style={{marginTop:'.3rem',marginBottom:'.6rem'}}><tbody>
              {(detail.peserta_sekretariat||[]).map((p,i)=>(
                <tr key={i}><td style={{paddingRight:12}}>{i+1}. {p.nama}</td><td className="td-muted">{p.jabatan}</td></tr>
              ))}
              {!(detail.peserta_sekretariat||[]).length&&<tr><td className="td-muted">—</td></tr>}
            </tbody></table>
            <strong>Peserta OPD:</strong>
            <table style={{marginTop:'.3rem',marginBottom:'.6rem'}}><tbody>
              {(detail.peserta_opd||[]).map((p,i)=>(
                <tr key={i}><td style={{paddingRight:12}}>{i+1}. {p.nama}</td><td className="td-muted">{p.jabatan}</td></tr>
              ))}
              {!(detail.peserta_opd||[]).length&&<tr><td className="td-muted">—</td></tr>}
            </tbody></table>
            <hr className="divider"/>
            {(detail.rkp_snapshot||[]).length>0&&(
              <>
                <strong>Data RKP yang Diasistensikan:</strong>
                <div className="tbl-wrap" style={{marginTop:'.4rem',marginBottom:'.6rem'}}>
                  <table><thead><tr><th>Program</th><th>Kegiatan</th><th>Kode Rekening</th><th>Pagu Utama</th><th>BOP</th></tr></thead>
                    <tbody>{detail.rkp_snapshot.map((r,i)=>(
                      <tr key={i}>
                        <td style={{fontSize:'.78rem'}}>{r.program}</td>
                        <td style={{fontSize:'.78rem'}}>{r.kegiatan}</td>
                        <td><span className="td-code">{r.kode_rekening||'—'}</span></td>
                        <td className="td-money">{fmtRp(r.pagu)}</td>
                        <td style={{color:'var(--gold)'}}>{fmtRp(r.pagu_bop||0)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <hr className="divider"/>
              </>
            )}
            <strong>Hasil Pembahasan:</strong>
            <div style={{margin:'.3rem 0 .6rem',whiteSpace:'pre-wrap'}}>{detail.hasil_pembahasan||'—'}</div>
            <strong>Catatan:</strong>
            <div style={{margin:'.3rem 0 .6rem',whiteSpace:'pre-wrap'}}>{detail.catatan||'—'}</div>
            <strong>Tindak Lanjut (AI):</strong>
            <div className="ai-box" style={{marginTop:'.3rem'}}>{detail.tindak_lanjut||'—'}</div>
            <div style={{marginTop:'.75rem'}}>
              <span className={`badge ${detail.kesimpulan==='dapat_ditindaklanjuti'?'badge-green':'badge-amber'}`} style={{fontSize:'.82rem',padding:'4px 12px'}}>
                {detail.kesimpulan==='dapat_ditindaklanjuti'
                  ?'✅ Dapat ditindaklanjuti pada tahapan penganggaran berikutnya'
                  :'⚠️ Perlu dilakukan perbaikan/penyesuaian'}
              </span>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline btn-sm" onClick={()=>window.print()}>🖨️ Cetak</button>
            <button className="btn btn-outline" onClick={()=>setDetail(null)}>Tutup</button>
          </div>
        </Modal>
      )}

      {modal&&(
        <Modal title="📝 Berita Acara Asistensi" onClose={()=>setModal(false)} wide>
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Nomor BA</label>
              <input className="form-control" value={form.nomor_ba} onChange={e=>setForm({...form,nomor_ba:e.target.value})} placeholder="BA-001/DBH CHT/2026" />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Tanggal</label>
              <input className="form-control" type="date" value={form.tanggal} onChange={e=>setForm({...form,tanggal:e.target.value})} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Tempat</label>
              <input className="form-control" value={form.tempat} onChange={e=>setForm({...form,tempat:e.target.value})} placeholder="Ruang Rapat..." />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">OPD *</label>
              <select className="form-control" value={form.opd} onChange={e=>{
                const o=opds.find(x=>x.nama===e.target.value)
                onSelectOpd(e.target.value, o?.id||'')
              }}>
                <option value="">-- Pilih OPD --</option>
                {opds.map(o=><option key={o.id} value={o.nama}>{o.nama}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">⚡ Auto-fill dari RKP OPD</label>
              <select className="form-control" defaultValue="" onChange={e=>onSelectRkp(e.target.value)} disabled={!rkpOPD.length}>
                <option value="">{rkpOPD.length?'-- Pilih RKP untuk auto-fill --':'-- Pilih OPD dulu --'}</option>
                {rkpOPD.length>0&&<option value="__all__">📋 Semua RKP OPD ini</option>}
                {rkpOPD.map(r=><option key={r.id} value={r.id}>{r.program} — {r.kegiatan||r.sub_kegiatan||''} ({fmtRp(r.pagu)})</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">Program *</label>
              <select className="form-control" value={form.program} onChange={e=>setForm({...form,program:e.target.value})}>
                <option value="">-- Pilih Program --</option>
                {(PROGRAM_BY_BIDANG[form.bidang_id]||[]).map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Pagu Usulan (Rp)</label>
              <input className="form-control" type="number" value={form.pagu_usulan} onChange={e=>setForm({...form,pagu_usulan:e.target.value})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Kegiatan</label>
              <input className="form-control" value={form.kegiatan} onChange={e=>setForm({...form,kegiatan:e.target.value})} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Sub Kegiatan</label>
              <input className="form-control" value={form.sub_kegiatan} onChange={e=>setForm({...form,sub_kegiatan:e.target.value})} />
            </div>
          </div>

          <hr className="divider"/>
          <PesertaEditor label="👥 Peserta Sekretariat Tim Koordinasi"
            peserta={form.peserta_sekretariat}
            onChange={v=>setForm(f=>({...f,peserta_sekretariat:v}))} />
          <PesertaEditor label="👥 Peserta OPD"
            peserta={form.peserta_opd}
            onChange={v=>setForm(f=>({...f,peserta_opd:v}))} />
          <hr className="divider"/>

          <div className="form-group">
            <label className="form-label">Hasil Pembahasan / Uraian Asistensi</label>
            <textarea className="form-control" rows={4} value={form.hasil_pembahasan} onChange={e=>setForm({...form,hasil_pembahasan:e.target.value})} placeholder="Uraikan hasil pembahasan asistensi secara lengkap..." />
          </div>
          <div className="form-group">
            <label className="form-label">Catatan</label>
            <textarea className="form-control" rows={2} value={form.catatan} onChange={e=>setForm({...form,catatan:e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Kesimpulan</label>
            <select className="form-control" value={form.kesimpulan} onChange={e=>setForm({...form,kesimpulan:e.target.value})}>
              <option value="dapat_ditindaklanjuti">✅ Dapat ditindaklanjuti pada tahapan penganggaran berikutnya</option>
              <option value="perlu_perbaikan">⚠️ Perlu dilakukan perbaikan/penyesuaian sebagaimana hasil asistensi</option>
            </select>
          </div>
          <div className="form-group">
            <div className="flex-between mb-1">
              <label className="form-label" style={{margin:0}}>🤖 Tindak Lanjut (AI Otomatis)</label>
              <button className="btn btn-ai btn-sm" onClick={genAI} disabled={aiLoad}>{aiLoad?'⏳ Memproses...':'✨ Generate AI'}</button>
            </div>
            <textarea className="form-control ai-box" rows={5} value={form.tindak_lanjut} onChange={e=>setForm({...form,tindak_lanjut:e.target.value})} placeholder="Klik Generate AI untuk tindak lanjut otomatis..." />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>{loading?'⏳...':'💾 Simpan BA'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── REKONSILIASI ──────────────────────────────────────────────
export function Rekonsiliasi() {
  const { tahun, notify } = useApp()
  const { profile } = useAuth()
  const [rows,   setRows]   = useState([])
  const [modal,  setModal]  = useState(false)
  const [detail, setDetail] = useState(null)
  const [opds,   setOpds]   = useState([])
  const [realOPD,setRealOPD]= useState([])
  const [aiLoad, setAiLoad] = useState(false)
  const [loading,setLoading]= useState(false)
  const [form, setForm] = useState({
    nomor_ba:'', tanggal:new Date().toISOString().slice(0,10), tempat:'',
    opd:'', opd_user_id:'', triwulan:'I',
    program:'', kegiatan:'', pagu:'', realisasi_keu:'', realisasi_fisik:'',
    peserta_sekretariat:[], peserta_opd:[],
    permasalahan:'', tindak_lanjut:'', penanggung_jawab:'',
    kesimpulan:'sesuai', realisasi_snapshot:[]
  })

  useEffect(()=>{ load(); loadOpds() },[tahun])
  async function load() {
    const { data } = await supabase.from('rekonsiliasi_dbhcht').select('*').eq('tahun',tahun).order('created_at',{ascending:false})
    setRows(data||[])
  }
  async function loadOpds() {
    const { data } = await supabase.from('profiles').select('id,nama,bidang').eq('role','opd').eq('aktif',true).order('nama')
    setOpds(data||[])
  }

  async function onSelectOpd(opdNama, opdId) {
    setForm(f=>({...f,opd:opdNama,opd_user_id:opdId,program:'',kegiatan:'',pagu:'',realisasi_keu:'',realisasi_snapshot:[]}))
    if (!opdId) { setRealOPD([]); return }
    const { data } = await supabase.from('realisasi_dbhcht').select('*').eq('tahun',tahun).eq('created_by',opdId).order('created_at')
    setRealOPD(data||[])
  }

  function onSelectReal(realId) {
    if (realId==='__all__') {
      setForm(f=>({...f, realisasi_snapshot:realOPD}))
      return
    }
    const r = realOPD.find(x=>x.id===realId)
    if (!r) return
    setForm(f=>({
      ...f,
      program:r.program||'', kegiatan:r.kegiatan||'',
      pagu:String(r.pagu||0), realisasi_keu:String(r.realisasi_keu||0),
      realisasi_fisik:String(r.realisasi_fisik||0),
      realisasi_snapshot:[r]
    }))
  }

  async function genAI() {
    setAiLoad(true)
    const text = await tindakLanjutRekonsiliasi({ opd:form.opd, triwulan:form.triwulan, pagu:Number(form.pagu), realisasiKeu:Number(form.realisasi_keu), realisasiFisik:form.realisasi_fisik, permasalahan:form.permasalahan })
    setForm(f=>({...f,tindak_lanjut:text}))
    setAiLoad(false)
  }

  async function save() {
    if (!form.opd) { notify('OPD wajib!','warn'); return }
    setLoading(true)
    const { error } = await supabase.from('rekonsiliasi_dbhcht').insert({
      tahun, triwulan:form.triwulan, tanggal:form.tanggal,
      nomor_ba:form.nomor_ba, tempat:form.tempat,
      opd:form.opd, opd_user_id:form.opd_user_id||null,
      program:form.program, kegiatan:form.kegiatan,
      pagu:Number(form.pagu)||0, realisasi_keu:Number(form.realisasi_keu)||0,
      realisasi_fisik:Number(form.realisasi_fisik)||0,
      peserta_sekretariat:form.peserta_sekretariat,
      peserta_opd:form.peserta_opd,
      permasalahan:form.permasalahan, tindak_lanjut:form.tindak_lanjut,
      penanggung_jawab:form.penanggung_jawab, kesimpulan:form.kesimpulan,
      realisasi_snapshot:form.realisasi_snapshot,
      created_by:profile?.id,
    })
    setLoading(false)
    if (error) { notify('Gagal: '+error.message,'error'); return }
    notify('Berita Acara Rekonsiliasi tersimpan','success'); setModal(false); load()
  }

  async function del(id) {
    if (!confirm('Hapus?')) return
    await supabase.from('rekonsiliasi_dbhcht').delete().eq('id',id)
    notify('Dihapus','warn'); load()
  }

  return (
    <div>
      <PageHeader title="🔄 Rekonsiliasi Realisasi DBH CHT">
        <button className="btn btn-primary btn-sm" onClick={()=>{
          setForm({nomor_ba:'',tanggal:new Date().toISOString().slice(0,10),tempat:'',opd:'',opd_user_id:'',triwulan:'I',program:'',kegiatan:'',pagu:'',realisasi_keu:'',realisasi_fisik:'',peserta_sekretariat:[],peserta_opd:[],permasalahan:'',tindak_lanjut:'',penanggung_jawab:'',kesimpulan:'sesuai',realisasi_snapshot:[]})
          setRealOPD([]); setModal(true)
        }}>+ Tambah</button>
        <button className="btn btn-outline btn-sm no-print" onClick={()=>window.print()}>🖨️ Cetak</button>
      </PageHeader>

      <div className="card">
        <div className="card-title">📋 Berita Acara Rekonsiliasi TA {tahun}</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>No. BA</th><th>Tanggal</th><th>OPD</th><th>Tw</th>
              <th>Pagu</th><th>Real. Keu.</th><th>Fisik</th>
              <th>Peserta</th><th>Kesimpulan</th>
              <th className="no-print">Aksi</th>
            </tr></thead>
            <tbody>
              {rows.length===0&&<EmptyRow cols={10} />}
              {rows.map(r=>{
                const pct=r.pagu>0?(r.realisasi_keu/r.pagu*100).toFixed(1):0
                return (
                  <tr key={r.id}>
                    <td style={{fontSize:'.78rem'}}>{r.nomor_ba||'—'}</td>
                    <td className="td-muted" style={{whiteSpace:'nowrap'}}>{r.tanggal}</td>
                    <td className="td-bold">{r.opd}</td>
                    <td><span className="badge badge-blue">Tw {r.triwulan}</span></td>
                    <td className="td-muted">{fmtRp(r.pagu)}</td>
                    <td className="td-money">{fmtRp(r.realisasi_keu)} <span style={{fontSize:'.7rem',fontWeight:400,color:'var(--text2)'}}>({pct}%)</span></td>
                    <td style={{fontSize:'.78rem'}}>{r.realisasi_fisik}%</td>
                    <td style={{fontSize:'.75rem'}}>
                      {Array.isArray(r.peserta_sekretariat)?r.peserta_sekretariat.length:0}+
                      {Array.isArray(r.peserta_opd)?r.peserta_opd.length:0}
                    </td>
                    <td><span className={`badge ${r.kesimpulan==='sesuai'?'badge-green':'badge-amber'}`}>{r.kesimpulan==='sesuai'?'✅ Sesuai':'⚠️ Perbaikan'}</span></td>
                    <td className="no-print"><div className="action-row">
                      <button className="btn btn-outline btn-sm" onClick={()=>setDetail(r)}>👁️</button>
                      <DelBtn onClick={()=>del(r.id)} />
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detail&&(
        <Modal title={`BA Rekonsiliasi — ${detail.opd}`} onClose={()=>setDetail(null)} wide>
          <div style={{fontSize:'.83rem',lineHeight:1.7}}>
            <div className="g2 mb-1">
              <div><strong>Nomor BA:</strong> {detail.nomor_ba||'—'}</div>
              <div><strong>Tanggal:</strong> {detail.tanggal}</div>
              <div><strong>Tempat:</strong> {detail.tempat||'—'}</div>
              <div><strong>Triwulan:</strong> {detail.triwulan}</div>
              <div><strong>OPD:</strong> {detail.opd}</div>
              <div><strong>Program:</strong> {detail.program}</div>
              <div><strong>Pagu:</strong> {fmtRp(detail.pagu)}</div>
              <div><strong>Realisasi Keuangan:</strong> {fmtRp(detail.realisasi_keu)} ({detail.pagu>0?(detail.realisasi_keu/detail.pagu*100).toFixed(1):0}%)</div>
              <div><strong>Realisasi Fisik:</strong> {detail.realisasi_fisik}%</div>
            </div>
            <hr className="divider"/>
            <strong>Peserta Sekretariat:</strong>
            <table style={{marginTop:'.3rem',marginBottom:'.6rem'}}><tbody>
              {(detail.peserta_sekretariat||[]).map((p,i)=>(
                <tr key={i}><td style={{paddingRight:12}}>{i+1}. {p.nama}</td><td className="td-muted">{p.jabatan}</td></tr>
              ))}
            </tbody></table>
            <strong>Peserta OPD:</strong>
            <table style={{marginTop:'.3rem',marginBottom:'.6rem'}}><tbody>
              {(detail.peserta_opd||[]).map((p,i)=>(
                <tr key={i}><td style={{paddingRight:12}}>{i+1}. {p.nama}</td><td className="td-muted">{p.jabatan}</td></tr>
              ))}
            </tbody></table>
            <hr className="divider"/>
            <strong>Permasalahan/Hambatan:</strong>
            <div style={{margin:'.3rem 0 .6rem',whiteSpace:'pre-wrap'}}>{detail.permasalahan||'—'}</div>
            <strong>Tindak Lanjut (AI):</strong>
            <div className="ai-box" style={{marginTop:'.3rem'}}>{detail.tindak_lanjut||'—'}</div>
            <div style={{marginTop:'.75rem'}}>
              <span className={`badge ${detail.kesimpulan==='sesuai'?'badge-green':'badge-amber'}`} style={{fontSize:'.82rem',padding:'4px 12px'}}>
                {detail.kesimpulan==='sesuai'?'✅ Sesuai dengan ketentuan':'⚠️ Memerlukan perbaikan dan tindak lanjut'}
              </span>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline btn-sm" onClick={()=>window.print()}>🖨️ Cetak</button>
            <button className="btn btn-outline" onClick={()=>setDetail(null)}>Tutup</button>
          </div>
        </Modal>
      )}

      {modal&&(
        <Modal title="📝 Berita Acara Rekonsiliasi" onClose={()=>setModal(false)} wide>
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Nomor BA</label>
              <input className="form-control" value={form.nomor_ba} onChange={e=>setForm({...form,nomor_ba:e.target.value})} placeholder="BA-Rekon-001/2026" />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Tanggal</label>
              <input className="form-control" type="date" value={form.tanggal} onChange={e=>setForm({...form,tanggal:e.target.value})} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Tempat</label>
              <input className="form-control" value={form.tempat} onChange={e=>setForm({...form,tempat:e.target.value})} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Triwulan</label>
              <select className="form-control" value={form.triwulan} onChange={e=>setForm({...form,triwulan:e.target.value})}>
                {['I','II','III','IV'].map(t=><option key={t} value={t}>Triwulan {t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">OPD *</label>
              <select className="form-control" value={form.opd} onChange={e=>{
                const o=opds.find(x=>x.nama===e.target.value)
                onSelectOpd(e.target.value,o?.id||'')
              }}>
                <option value="">-- Pilih OPD --</option>
                {opds.map(o=><option key={o.id} value={o.nama}>{o.nama}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">⚡ Auto-fill dari Realisasi OPD</label>
              <select className="form-control" defaultValue="" onChange={e=>onSelectReal(e.target.value)} disabled={!realOPD.length}>
                <option value="">{realOPD.length?'-- Pilih realisasi untuk auto-fill --':'-- Pilih OPD dulu --'}</option>
                {realOPD.length>0&&<option value="__all__">📋 Semua realisasi OPD ini</option>}
                {realOPD.map(r=><option key={r.id} value={r.id}>Tw {r.triwulan} — {r.program} ({fmtRp(r.realisasi_keu)})</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">Program</label>
              <input className="form-control" value={form.program} onChange={e=>setForm({...form,program:e.target.value})} />
            </div>
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">Kegiatan/Sub Kegiatan</label>
              <input className="form-control" value={form.kegiatan} onChange={e=>setForm({...form,kegiatan:e.target.value})} />
            </div>
          </div>

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
              <label className="form-label">Realisasi Fisik (%)</label>
              <input className="form-control" type="number" min="0" max="100" value={form.realisasi_fisik} onChange={e=>setForm({...form,realisasi_fisik:e.target.value})} />
            </div>
          </div>

          <hr className="divider"/>
          <PesertaEditor label="👥 Peserta Sekretariat Tim Koordinasi"
            peserta={form.peserta_sekretariat}
            onChange={v=>setForm(f=>({...f,peserta_sekretariat:v}))} />
          <PesertaEditor label="👥 Peserta OPD"
            peserta={form.peserta_opd}
            onChange={v=>setForm(f=>({...f,peserta_opd:v}))} />
          <hr className="divider"/>

          <div className="form-row">
            <div className="form-group" style={{flex:2}}>
              <label className="form-label">Permasalahan / Hambatan</label>
              <textarea className="form-control" rows={3} value={form.permasalahan} onChange={e=>setForm({...form,permasalahan:e.target.value})} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Penanggung Jawab</label>
              <input className="form-control" value={form.penanggung_jawab} onChange={e=>setForm({...form,penanggung_jawab:e.target.value})} />
              <div style={{marginTop:'.5rem'}}>
                <label className="form-label">Kesimpulan</label>
                <select className="form-control" value={form.kesimpulan} onChange={e=>setForm({...form,kesimpulan:e.target.value})}>
                  <option value="sesuai">✅ Sesuai dengan ketentuan</option>
                  <option value="perlu_perbaikan">⚠️ Memerlukan perbaikan</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <div className="flex-between mb-1">
              <label className="form-label" style={{margin:0}}>🤖 Tindak Lanjut (AI)</label>
              <button className="btn btn-ai btn-sm" onClick={genAI} disabled={aiLoad}>{aiLoad?'⏳...':'✨ Generate AI'}</button>
            </div>
            <textarea className="form-control ai-box" rows={5} value={form.tindak_lanjut} onChange={e=>setForm({...form,tindak_lanjut:e.target.value})} placeholder="Klik Generate AI..." />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>{loading?'⏳...':'💾 Simpan BA'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── PAGU ALOKASI ──────────────────────────────────────────────
export function Pagu() {
  const { tahun, jenis, notify } = useApp()
  const { profile } = useAuth()
  const [data,    setData]    = useState(null)
  const [opds,    setOpds]    = useState([])
  const [paguOpds,setPaguOpds]= useState([])
  const [editing, setEdit]    = useState(false)
  const [editOpd, setEditOpd] = useState(null)
  const [form,    setForm]    = useState({})
  const [opdForm, setOpdForm] = useState({ profile_id:'', pagu_utama:'', bop:'', keterangan:'' })
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ load(); loadOpds() },[tahun,jenis])

  async function load() {
    const { data:d } = await supabase.from('pagu_alokasi').select('*').eq('tahun',tahun).eq('jenis',jenis).maybeSingle()
    setData(d)
    if (d) setForm(d); else setForm({tahun,jenis,total_pagu:0,pct_kesmas:50,pct_kesehatan:40,pct_hukum:10,pct_koordinasi:2})
    const { data:po } = await supabase.from('pagu_opd').select('*,profiles(nama,bidang)').eq('tahun',tahun).eq('jenis',jenis)
    setPaguOpds(po||[])
  }
  async function loadOpds() {
    const { data } = await supabase.from('profiles').select('id,nama,bidang').eq('role','opd').eq('aktif',true).order('nama')
    setOpds(data||[])
  }

  async function savePagu() {
    setLoading(true)
    const payload = {...form,tahun,jenis,updated_by:profile?.id,updated_at:new Date().toISOString()}
    const { error } = data
      ? await supabase.from('pagu_alokasi').update(payload).eq('id',data.id)
      : await supabase.from('pagu_alokasi').insert(payload)
    setLoading(false)
    if (error) { notify('Gagal: '+error.message,'error'); return }
    notify('Pagu alokasi disimpan','success'); setEdit(false); load()
  }

  async function saveOpdPagu() {
    const bop = Number(opdForm.bop)||0
    const mx  = maxBop(Number(opdForm.pagu_utama)||0)
    if (bop>mx) { notify('BOP melebihi 10%! Maks: '+fmtRp(mx),'error'); return }
    setLoading(true)
    const payload = { profile_id:opdForm.profile_id, tahun, jenis, pagu_utama:Number(opdForm.pagu_utama)||0, bop, keterangan:opdForm.keterangan, ditetapkan_oleh:profile?.id }
    const exists = paguOpds.find(p=>p.profile_id===opdForm.profile_id)
    const { error } = exists
      ? await supabase.from('pagu_opd').update(payload).eq('id',exists.id)
      : await supabase.from('pagu_opd').insert(payload)
    setLoading(false)
    if (error) { notify('Gagal: '+error.message,'error'); return }
    notify('Pagu OPD disimpan','success'); setEditOpd(null); load()
  }

  const tp = Number(form.total_pagu)||0

  return (
    <div>
      <PageHeader title="💰 Pagu Alokasi DBH CHT">
        {!editing&&<button className="btn btn-primary btn-sm" onClick={()=>setEdit(true)}>✏️ Edit Total</button>}
      </PageHeader>

      {/* Total Pagu */}
      <div className="card">
        <div className="card-title">Total Pagu TA {tahun} — {jenis}</div>
        {editing?(
          <>
            <div className="form-group">
              <label className="form-label">Total Pagu DBH CHT (Rp)</label>
              <input className="form-control" type="number" value={form.total_pagu||''} onChange={e=>setForm({...form,total_pagu:e.target.value})} style={{fontSize:'1.1rem',fontWeight:700}} />
            </div>
            <hr className="divider"/>
            <div className="card-title">Komposisi per Bidang (%)</div>
            {[['kesmas','🌿 Bidang Kesejahteraan Masyarakat'],['kesehatan','🏥 Bidang Kesehatan'],['hukum','⚖️ Bidang Penegakan Hukum'],['koordinasi','📋 Koordinasi DBH CHT']].map(([k,l])=>(
              <div className="form-group" key={k}>
                <label className="form-label">{l} (%)</label>
                <input className="form-control" type="number" min="0" max="100" value={form[`pct_${k}`]||0} onChange={e=>setForm({...form,[`pct_${k}`]:e.target.value})} />
              </div>
            ))}
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setEdit(false)}>Batal</button>
              <button className="btn btn-primary" onClick={savePagu} disabled={loading}>{loading?'⏳...':'💾 Simpan'}</button>
            </div>
          </>
        ):(
          <>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.9rem',fontWeight:700,color:'var(--accent)',marginBottom:'1rem'}}>{fmtRp(tp)}</div>
            <div className="g3">
              {[['kesmas','🌿','Kesejahteraan Masyarakat','#2d6a4f'],['kesehatan','🏥','Kesehatan','#1e6091'],['hukum','⚖️','Penegakan Hukum','#7b2d00']].map(([k,ic,l,c])=>(
                <div key={k} className="stat-box" style={{borderLeft:`4px solid ${c}`}}>
                  <div className="stat-lbl">{ic} {l}</div>
                  <div className="stat-val" style={{color:c}}>{fmtRp(tp*(Number(form[`pct_${k}`])||0)/100)}</div>
                  <div className="stat-sub">{form[`pct_${k}`]||0}% dari total</div>
                </div>
              ))}
            </div>
            <div className="stat-box mt-2" style={{borderLeft:'4px solid #5f4b1a'}}>
              <div className="stat-lbl">📋 Koordinasi Pengelolaan DBH CHT</div>
              <div className="stat-val" style={{color:'#5f4b1a'}}>{fmtRp(tp*(Number(form.pct_koordinasi)||2)/100)}</div>
              <div className="stat-sub">{form.pct_koordinasi||2}% — kegiatan lintas bidang</div>
            </div>
          </>
        )}
      </div>

      {/* Pagu per OPD */}
      <div className="card">
        <div className="flex-between mb-2">
          <div className="card-title" style={{margin:0}}>🏢 Penetapan Pagu per OPD (TAPD)</div>
          <button className="btn btn-primary btn-sm" onClick={()=>{setOpdForm({profile_id:'',pagu_utama:'',bop:'',keterangan:''});setEditOpd(true)}}>+ Tetapkan Pagu OPD</button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>OPD</th><th>Bidang</th><th>Pagu Utama (Rp)</th><th>BOP (Rp)</th><th>Total (Rp)</th><th>Keterangan</th><th>Aksi</th></tr></thead>
            <tbody>
              {paguOpds.length===0&&<EmptyRow cols={7} msg="Belum ada pagu OPD ditetapkan." />}
              {paguOpds.map(p=>(
                <tr key={p.id}>
                  <td className="td-bold">{p.profiles?.nama}</td>
                  <td><span className="badge badge-green" style={{fontSize:'.7rem'}}>{[...BIDANG,KOORDINASI].find(b=>b.id===p.profiles?.bidang)?.short||p.profiles?.bidang}</span></td>
                  <td className="td-money">{fmtRp(p.pagu_utama)}</td>
                  <td style={{color:'var(--gold)',fontWeight:600}}>{fmtRp(p.bop)} <span style={{fontSize:'.7rem',fontWeight:400,color:'var(--text2)'}}>({p.pagu_utama>0?(p.bop/p.pagu_utama*100).toFixed(1):0}%)</span></td>
                  <td className="td-money">{fmtRp((p.pagu_utama||0)+(p.bop||0))}</td>
                  <td className="td-muted">{p.keterangan}</td>
                  <td><button className="btn btn-outline btn-sm" onClick={()=>{setOpdForm({profile_id:p.profile_id,pagu_utama:String(p.pagu_utama),bop:String(p.bop),keterangan:p.keterangan||''});setEditOpd(true)}}>✏️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editOpd&&(
        <Modal title="Tetapkan Pagu OPD" onClose={()=>setEditOpd(null)}>
          <div className="form-group">
            <label className="form-label">OPD *</label>
            <select className="form-control" value={opdForm.profile_id} onChange={e=>setOpdForm({...opdForm,profile_id:e.target.value})}>
              <option value="">-- Pilih OPD --</option>
              {opds.map(o=><option key={o.id} value={o.id}>{o.nama}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Pagu Utama (Rp) *</label>
              <input className="form-control" type="number" value={opdForm.pagu_utama} onChange={e=>setOpdForm({...opdForm,pagu_utama:e.target.value})} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">BOP / Biaya Operasional (Rp)
                <span style={{fontSize:'.7rem',color:'var(--text2)',fontWeight:400,marginLeft:'.3rem'}}>maks 10% = {fmtRp(maxBop(Number(opdForm.pagu_utama)||0))}</span>
              </label>
              <input className="form-control" type="number" value={opdForm.bop} onChange={e=>setOpdForm({...opdForm,bop:e.target.value})}
                style={Number(opdForm.bop)>maxBop(Number(opdForm.pagu_utama))?{borderColor:'var(--danger)'}:{}} />
              {Number(opdForm.bop)>maxBop(Number(opdForm.pagu_utama))&&(
                <div style={{color:'var(--danger)',fontSize:'.75rem',marginTop:'.2rem'}}>⚠️ Melebihi batas 10%</div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Total Pagu OPD</label>
            <input className="form-control" readOnly value={fmtRp((Number(opdForm.pagu_utama)||0)+(Number(opdForm.bop)||0))} style={{fontWeight:700,color:'var(--accent)',background:'var(--bg3)'}} />
          </div>
          <div className="form-group">
            <label className="form-label">Keterangan (Nomor SK TAPD, dll)</label>
            <input className="form-control" value={opdForm.keterangan} onChange={e=>setOpdForm({...opdForm,keterangan:e.target.value})} placeholder="SK Bupati No. ... / TAPD ..." />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setEditOpd(null)}>Batal</button>
            <button className="btn btn-primary" onClick={saveOpdPagu} disabled={loading||Number(opdForm.bop)>maxBop(Number(opdForm.pagu_utama))}>{loading?'⏳...':'💾 Simpan'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── MANAJEMEN OPD ─────────────────────────────────────────────
export function ManajemenOPD() {
  const { tahun, jenis, notify } = useApp()
  const [users,  setUsers]  = useState([])
  const [modal,  setModal]  = useState(false)
  const [editId, setEditId] = useState(null)
  const [loading,setLoading]= useState(false)
  const [form, setForm] = useState({ email:'', password:'dbhcht#2026', username:'', nama:'', bidang:'kesmas', role:'opd' })

  useEffect(()=>{ load() },[])
  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('nama')
    setUsers(data||[])
  }

  async function save() {
    if (!form.nama||!form.username) { notify('Nama dan Username wajib!','warn'); return }
    setLoading(true)
    if (editId) {
      const { error } = await supabase.from('profiles').update({ username:form.username, nama:form.nama, bidang:form.bidang, role:form.role, email:form.email, aktif:true }).eq('id',editId)
      if (error) notify('Gagal: '+error.message,'error'); else notify('Profil diperbarui','success')
    } else {
      if (!form.email||!form.password) { notify('Email dan Password wajib untuk akun baru!','warn'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({
        email:form.email, password:form.password,
        options:{ data:{ username:form.username, nama:form.nama, role:form.role, bidang:form.bidang } }
      })
      if (error) notify('Gagal: '+error.message,'error')
      else notify('Akun dibuat. Username: '+form.username+' | Pass: '+form.password,'success')
    }
    setLoading(false); setModal(false); load()
  }

  async function resetPw(u) {
    if (!u.email) { notify('Email tidak ada','error'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(u.email)
    if (error) notify('Gagal: '+error.message,'error')
    else notify('Link reset dikirim ke '+u.email,'success')
  }

  async function toggleAktif(u) {
    await supabase.from('profiles').update({aktif:!u.aktif}).eq('id',u.id)
    notify(u.aktif?'Akun dinonaktifkan':'Akun diaktifkan', u.aktif?'warn':'success')
    load()
  }

  return (
    <div>
      <PageHeader title="👥 Manajemen Akun OPD">
        <button className="btn btn-primary btn-sm" onClick={()=>{setForm({email:'',password:'dbhcht#2026',username:'',nama:'',bidang:'kesmas',role:'opd'});setEditId(null);setModal(true)}}>+ Tambah OPD</button>
      </PageHeader>

      <div style={{background:'#dbeafe40',border:'1px solid #93c5fd',borderRadius:8,padding:'.7rem 1rem',marginBottom:'.9rem',fontSize:'.8rem',color:'var(--info)'}}>
        ℹ️ Login menggunakan <strong>username</strong> (bukan email). Password default: <code>dbhcht#2026</code>. Setiap OPD hanya dapat melihat dan menginput data miliknya sendiri.
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Nama OPD</th><th>Username</th><th>Bidang</th><th>Email</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {users.length===0&&<EmptyRow cols={7} />}
              {users.map(u=>(
                <tr key={u.id} style={!u.aktif?{opacity:.6}:{}}>
                  <td className="td-bold">{u.nama}</td>
                  <td><code>{u.username}</code></td>
                  <td><span style={{fontSize:'.75rem'}}>{[...BIDANG,KOORDINASI].find(b=>b.id===u.bidang)?.icon} {[...BIDANG,KOORDINASI].find(b=>b.id===u.bidang)?.short||u.bidang}</span></td>
                  <td className="td-muted">{u.email}</td>
                  <td><span className={`badge ${u.role==='sekretariat'?'badge-amber':u.role==='viewer'?'badge-gray':'badge-blue'}`}>{u.role}</span></td>
                  <td><span className={`badge ${u.aktif?'badge-green':'badge-red'}`}>{u.aktif?'Aktif':'Nonaktif'}</span></td>
                  <td>
                    <div className="action-row">
                      <button className="btn btn-outline btn-sm" onClick={()=>{setForm({...u,password:'(tidak berubah)'});setEditId(u.id);setModal(true)}}>✏️</button>
                      <button className="btn btn-info btn-sm" onClick={()=>resetPw(u)}>🔑</button>
                      <button className="btn btn-sm" style={{background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text2)'}} onClick={()=>toggleAktif(u)}>
                        {u.aktif?'🔒':'🔓'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal&&(
        <Modal title={editId?'Edit Profil OPD':'Tambah Akun OPD Baru'} onClose={()=>setModal(false)}>
          {!editId&&(
            <div className="form-row">
              <div className="form-group" style={{flex:1}}><label className="form-label">Email *</label><input className="form-control" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="opd@pemda.go.id" /></div>
              <div className="form-group" style={{flex:1}}><label className="form-label">Password Awal</label><input className="form-control" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group" style={{flex:1}}><label className="form-label">Nama OPD *</label><input className="form-control" value={form.nama} onChange={e=>setForm({...form,nama:e.target.value})} /></div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Username * <span style={{fontWeight:400,fontSize:'.72rem',color:'var(--text2)'}}>(untuk login)</span></label>
              <input className="form-control" value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase().replace(/\s/g,'')})} placeholder="contoh: dinaspertanian" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Bidang</label>
              <select className="form-control" value={form.bidang} onChange={e=>setForm({...form,bidang:e.target.value})}>
                {[...BIDANG,KOORDINASI].map(b=><option key={b.id} value={b.id}>{b.icon} {b.label}</option>)}
                <option value="all">Semua Bidang (Sekretariat)</option>
              </select>
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Role</label>
              <select className="form-control" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                <option value="opd">OPD Pengguna</option>
                <option value="sekretariat">Sekretariat Tim</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>{loading?'⏳...':'💾 Simpan'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── REGULASI ──────────────────────────────────────────────────
export function Regulasi() {
  const { notify } = useApp()
  const { isSekretariat, profile } = useAuth()
  const [rows,  setRows]  = useState([])
  const [modal, setModal] = useState(false)
  const [form,  setForm]  = useState({judul:'',tentang:'',tahun:new Date().getFullYear(),nomor:'',link_url:''})
  const [loading,setLoad] = useState(false)

  useEffect(()=>{ load() },[])
  async function load() {
    const { data } = await supabase.from('regulasi_dbhcht').select('*').eq('aktif',true).order('urutan').order('tahun',{ascending:false})
    setRows(data||[])
  }
  async function save() {
    if (!form.judul) { notify('Judul wajib!','warn'); return }
    setLoad(true)
    const { error } = await supabase.from('regulasi_dbhcht').insert({...form,tahun:Number(form.tahun),created_by:profile?.id})
    setLoad(false)
    if (error) { notify('Gagal: '+error.message,'error'); return }
    notify('Regulasi ditambahkan','success'); setModal(false); load()
  }
  async function del(id) {
    if (!confirm('Hapus?')) return
    await supabase.from('regulasi_dbhcht').update({aktif:false}).eq('id',id)
    notify('Dihapus','warn'); load()
  }

  return (
    <div>
      <PageHeader title="📚 Regulasi DBH CHT">
        {isSekretariat&&<button className="btn btn-primary btn-sm" onClick={()=>{setForm({judul:'',tentang:'',tahun:new Date().getFullYear(),nomor:'',link_url:''});setModal(true)}}>+ Tambah</button>}
      </PageHeader>
      <div className="card">
        {rows.map(r=>(
          <div key={r.id} style={{padding:'.8rem 0',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'1rem'}}>
            <div>
              <div style={{fontWeight:700,color:'var(--accent)',marginBottom:'.2rem'}}>{r.judul}</div>
              <div style={{fontSize:'.83rem'}}>{r.tentang}</div>
              <div style={{marginTop:'.25rem',display:'flex',gap:'.3rem',flexWrap:'wrap'}}>
                <span className="badge badge-amber">Tahun {r.tahun}</span>
                {r.nomor&&<span className="badge badge-gray">No. {r.nomor}</span>}
              </div>
            </div>
            <div style={{display:'flex',gap:'.4rem',flexShrink:0}}>
              {r.link_url&&<a href={r.link_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">📥 Unduh</a>}
              {isSekretariat&&<DelBtn onClick={()=>del(r.id)} />}
            </div>
          </div>
        ))}
        {rows.length===0&&<div className="empty-state">Belum ada data regulasi.</div>}
      </div>
      {modal&&(
        <Modal title="Tambah Regulasi" onClose={()=>setModal(false)}>
          <div className="form-group"><label className="form-label">Judul *</label><input className="form-control" value={form.judul} onChange={e=>setForm({...form,judul:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Tentang</label><input className="form-control" value={form.tentang} onChange={e=>setForm({...form,tentang:e.target.value})} /></div>
          <div className="form-row">
            <div className="form-group" style={{flex:1}}><label className="form-label">Nomor</label><input className="form-control" value={form.nomor} onChange={e=>setForm({...form,nomor:e.target.value})} /></div>
            <div className="form-group" style={{flex:1}}><label className="form-label">Tahun</label><input className="form-control" type="number" value={form.tahun} onChange={e=>setForm({...form,tahun:e.target.value})} /></div>
          </div>
          <div className="form-group"><label className="form-label">Link URL</label><input className="form-control" type="url" value={form.link_url} onChange={e=>setForm({...form,link_url:e.target.value})} placeholder="https://..." /></div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>{loading?'⏳...':'💾 Simpan'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
