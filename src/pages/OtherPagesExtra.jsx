import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, PROGRAM_BY_BIDANG, KODE_REKENING_BY_BIDANG, fmtRp, maxBop } from '../lib/constants.js'
import { Modal, EmptyRow, DelBtn, PageHeader } from '../components/UI.jsx'

// ── PAGU ALOKASI ───────────────────────────────────────────────
export function Pagu() {
  const { tahun, jenis, notify } = useApp()
  const { profile } = useAuth()
  const [data,     setData]     = useState(null)
  const [opds,     setOpds]     = useState([])
  const [paguOpds, setPaguOpds] = useState([])
  const [editing,  setEdit]     = useState(false)
  const [editOpd,  setEditOpd]  = useState(null)
  const [form,     setForm]     = useState({})
  const [opdForm,  setOpdForm]  = useState({ profile_id:'', bidang:'', program:'', kegiatan:'', pagu_utama:'', bop:'', keterangan:'' })
  const [loading,  setLoading]  = useState(false)

  useEffect(() => { load(); loadOpds() }, [tahun, jenis])

  async function load() {
    const { data:d } = await supabase.from('pagu_alokasi').select('*')
      .eq('tahun', tahun).eq('jenis', jenis).maybeSingle()
    setData(d)
    if (d) setForm(d)
    else setForm({ tahun, jenis, total_pagu:0, pct_kesmas:50, pct_kesehatan:40, pct_hukum:10, pct_koordinasi:2 })
    const { data:po } = await supabase.from('pagu_opd')
      .select('*,profiles(nama,bidang)').eq('tahun', tahun).eq('jenis', jenis)
    setPaguOpds(po||[])
  }

  async function loadOpds() {
    const { data } = await supabase.from('profiles').select('id,nama,bidang')
      .eq('role','opd').eq('aktif',true).order('nama')
    setOpds(data||[])
  }

  async function savePagu() {
    setLoading(true)
    const payload = { ...form, tahun, jenis, updated_by:profile?.id, updated_at:new Date().toISOString() }
    const { error } = data
      ? await supabase.from('pagu_alokasi').update(payload).eq('id', data.id)
      : await supabase.from('pagu_alokasi').insert(payload)
    setLoading(false)
    if (error) { notify('Gagal: '+error.message, 'error'); return }
    notify('Pagu alokasi disimpan', 'success'); setEdit(false); load()
  }

  async function saveOpdPagu() {
    if (!opdForm.profile_id) { notify('OPD wajib dipilih!', 'error'); return }
    if (!opdForm.bidang)     { notify('Bidang wajib dipilih!', 'error'); return }
    if (!opdForm.program)    { notify('Program wajib diisi!', 'error'); return }
    if (!opdForm.kegiatan)   { notify('Kegiatan wajib diisi!', 'error'); return }
    const bop = Number(opdForm.bop)||0
    const mx  = maxBop(Number(opdForm.pagu_utama)||0)
    if (bop > mx) { notify('BOP melebihi 10%! Maks: '+fmtRp(mx), 'error'); return }
    setLoading(true)
    const payload = {
      profile_id: opdForm.profile_id, tahun, jenis,
      bidang:     opdForm.bidang,
      program:    opdForm.program,
      kegiatan:   opdForm.kegiatan,
      pagu_utama: Number(opdForm.pagu_utama)||0,
      bop, keterangan: opdForm.keterangan,
      ditetapkan_oleh: profile?.id
    }
    // Composite key: 1 OPD bisa punya beberapa kegiatan berbeda
    const exists = paguOpds.find(p=>
      p.profile_id===opdForm.profile_id &&
      p.bidang===opdForm.bidang &&
      p.program===opdForm.program &&
      p.kegiatan===opdForm.kegiatan
    )
    const { error } = exists
      ? await supabase.from('pagu_opd').update(payload).eq('id', exists.id)
      : await supabase.from('pagu_opd').insert(payload)
    setLoading(false)
    if (error) { notify('Gagal: '+error.message, 'error'); return }
    notify('Pagu OPD disimpan', 'success'); setEditOpd(null); load()
  }

  const tp = Number(form.total_pagu)||0

  return (
    <div>
      <PageHeader title="💰 Pagu Alokasi DBH CHT">
        {!editing && <button className="btn btn-primary btn-sm" onClick={()=>setEdit(true)}>✏️ Edit Total</button>}
      </PageHeader>

      {/* Total Pagu & Komposisi */}
      <div className="card">
        <div className="card-title">Total Pagu TA {tahun} — {jenis}</div>
        {editing ? (
          <>
            <div className="form-group">
              <label className="form-label">Total Pagu DBH CHT (Rp)</label>
              <input className="form-control" type="number"
                value={form.total_pagu||''} onChange={e=>setForm({...form,total_pagu:e.target.value})}
                style={{ fontSize:'1.1rem', fontWeight:700 }} />
            </div>
            <hr className="divider"/>
            <div className="card-title">Komposisi per Bidang (%)</div>
            {[
              ['kesmas',    '🌿 Bidang Kesejahteraan Masyarakat'],
              ['kesehatan', '🏥 Bidang Kesehatan'],
              ['hukum',     '⚖️  Bidang Penegakan Hukum'],
              ['koordinasi','📋 Koordinasi Pengelolaan DBH CHT'],
            ].map(([k,l])=>(
              <div className="form-group" key={k}>
                <label className="form-label">{l} (%)</label>
                <input className="form-control" type="number" min="0" max="100"
                  value={form[`pct_${k}`]||0}
                  onChange={e=>setForm({...form,[`pct_${k}`]:e.target.value})} />
              </div>
            ))}
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setEdit(false)}>Batal</button>
              <button className="btn btn-primary" onClick={savePagu} disabled={loading}>
                {loading?'⏳...':'💾 Simpan'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.9rem', fontWeight:700, color:'var(--accent)', marginBottom:'1rem' }}>
              {fmtRp(tp)}
            </div>
            <div className="g3">
              {[['kesmas','🌿','Kesejahteraan Masyarakat','#2d6a4f'],
                ['kesehatan','🏥','Kesehatan','#1e6091'],
                ['hukum','⚖️','Penegakan Hukum','#7b2d00']].map(([k,ic,l,c])=>(
                <div key={k} className="stat-box" style={{ borderLeft:`4px solid ${c}` }}>
                  <div className="stat-lbl">{ic} {l}</div>
                  <div className="stat-val" style={{ color:c }}>{fmtRp(tp*(Number(form[`pct_${k}`])||0)/100)}</div>
                  <div className="stat-sub">{form[`pct_${k}`]||0}% dari total</div>
                </div>
              ))}
            </div>
            <div className="stat-box mt-2" style={{ borderLeft:'4px solid #5f4b1a' }}>
              <div className="stat-lbl">📋 Koordinasi Pengelolaan DBH CHT</div>
              <div className="stat-val" style={{ color:'#5f4b1a' }}>{fmtRp(tp*(Number(form.pct_koordinasi)||2)/100)}</div>
              <div className="stat-sub">{form.pct_koordinasi||2}% — kegiatan lintas bidang</div>
            </div>
          </>
        )}
      </div>

      {/* Pagu per OPD (penetapan TAPD) */}
      <div className="card">
        <div className="flex-between mb-2">
          <div className="card-title" style={{ margin:0 }}>🏢 Penetapan Pagu per OPD (TAPD) — TA {tahun} {jenis}</div>
          <button className="btn btn-primary btn-sm"
            onClick={()=>{ setOpdForm({profile_id:'',pagu_utama:'',bop:'',keterangan:''}); setEditOpd(true) }}>
            + Tetapkan Pagu OPD
          </button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>No</th><th>OPD</th><th>Bidang</th><th>Program</th><th>Kegiatan</th>
              <th>Pagu Utama (Rp)</th><th>BOP (Rp)</th><th>Total (Rp)</th><th>Keterangan</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              {paguOpds.length===0 && <EmptyRow cols={10} msg="Belum ada pagu OPD ditetapkan." />}
              {paguOpds.map((p,i)=>(
                <tr key={p.id}>
                  <td style={{ textAlign:'center', color:'var(--text2)', fontSize:'.8rem' }}>{i+1}</td>
                  <td className="td-bold">{p.profiles?.nama}</td>
                  <td>
                    <span className="badge badge-green" style={{ fontSize:'.7rem' }}>
                      {[...BIDANG,KOORDINASI].find(b=>b.id===(p.bidang||p.profiles?.bidang))?.short||(p.bidang||p.profiles?.bidang)}
                    </span>
                  </td>
                  <td style={{ fontSize:'.78rem', maxWidth:180 }}>{p.program||'-'}</td>
                  <td style={{ fontSize:'.78rem', maxWidth:200 }}>{p.kegiatan||'-'}</td>
                  <td className="td-money">{fmtRp(p.pagu_utama)}</td>
                  <td style={{ color:'var(--gold)', fontWeight:600 }}>
                    {fmtRp(p.bop)}
                    <span style={{ fontSize:'.7rem', fontWeight:400, color:'var(--text2)' }}>
                      {' '}({p.pagu_utama>0?(p.bop/p.pagu_utama*100).toFixed(1):0}%)
                    </span>
                  </td>
                  <td className="td-money">{fmtRp((p.pagu_utama||0)+(p.bop||0))}</td>
                  <td className="td-muted">{p.keterangan}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={()=>{
                      setOpdForm({
                        profile_id:p.profile_id, bidang:p.bidang||p.profiles?.bidang||'',
                        program:p.program||'', kegiatan:p.kegiatan||'',
                        pagu_utama:String(p.pagu_utama), bop:String(p.bop), keterangan:p.keterangan||''
                      })
                      setEditOpd(true)
                    }}>✏️</button>
                  </td>
                </tr>
              ))}
              {paguOpds.length>0 && (
                <tr style={{ background:'var(--bg3)', fontWeight:700 }}>
                  <td colSpan={5} style={{ textAlign:'right', fontSize:'.8rem' }}>TOTAL</td>
                  <td className="td-money">{fmtRp(paguOpds.reduce((s,p)=>s+(p.pagu_utama||0),0))}</td>
                  <td style={{ color:'var(--gold)', fontWeight:600 }}>{fmtRp(paguOpds.reduce((s,p)=>s+(p.bop||0),0))}</td>
                  <td className="td-money">{fmtRp(paguOpds.reduce((s,p)=>s+(p.pagu_utama||0)+(p.bop||0),0))}</td>
                  <td colSpan={2}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editOpd && (
        <Modal title="Tetapkan Pagu OPD" onClose={()=>setEditOpd(null)}>
          {/* OPD */}
          <div className="form-group">
            <label className="form-label">OPD *</label>
            <select className="form-control" value={opdForm.profile_id}
              onChange={e=>{
                const opd = opds.find(o=>o.id===e.target.value)
                setOpdForm({...opdForm, profile_id:e.target.value, bidang:opd?.bidang||'', program:'', kegiatan:''})
              }}>
              <option value="">-- Pilih OPD --</option>
              {opds.map(o=><option key={o.id} value={o.id}>{o.nama}</option>)}
            </select>
          </div>

          {/* Bidang — bisa override dari default bidang OPD */}
          <div className="form-group">
            <label className="form-label">Bidang *</label>
            <select className="form-control" value={opdForm.bidang}
              onChange={e=>setOpdForm({...opdForm, bidang:e.target.value, program:'', kegiatan:''})}>
              <option value="">-- Pilih Bidang --</option>
              {[...BIDANG, KOORDINASI].map(b=>(
                <option key={b.id} value={b.id}>{b.icon} {b.label}</option>
              ))}
            </select>
          </div>

          {/* Program */}
          <div className="form-group">
            <label className="form-label">Program *</label>
            <select className="form-control" value={opdForm.program}
              onChange={e=>setOpdForm({...opdForm, program:e.target.value, kegiatan:''})}>
              <option value="">-- Pilih Program --</option>
              {(PROGRAM_BY_BIDANG[opdForm.bidang]||PROGRAM_BY_BIDANG.all).map(pr=>(
                <option key={pr} value={pr}>{pr}</option>
              ))}
            </select>
          </div>

          {/* Kegiatan — ambil dari KODE_REKENING sesuai bidang, atau input manual */}
          <div className="form-group">
            <label className="form-label">Kegiatan / Sub Kegiatan *</label>
            <select className="form-control" value={opdForm.kegiatan}
              onChange={e=>setOpdForm({...opdForm, kegiatan:e.target.value})}>
              <option value="">-- Pilih Kegiatan --</option>
              {(KODE_REKENING_BY_BIDANG[opdForm.bidang]||[]).map(k=>(
                <option key={k.kode} value={k.nama}>[{k.kode}] {k.nama}</option>
              ))}
              <option value="__manual">✏️ Ketik manual...</option>
            </select>
            {opdForm.kegiatan==='__manual' && (
              <input className="form-control" style={{ marginTop:'.4rem' }}
                placeholder="Ketik nama kegiatan / sub kegiatan..."
                onChange={e=>setOpdForm({...opdForm, kegiatan:e.target.value})} />
            )}
          </div>

          {/* Pagu & BOP */}
          <div className="form-row">
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Pagu Utama (Rp) *</label>
              <input className="form-control" type="number" value={opdForm.pagu_utama}
                onChange={e=>setOpdForm({...opdForm,pagu_utama:e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">
                BOP / Biaya Operasional (Rp)
                <span style={{ fontSize:'.7rem', color:'var(--text2)', fontWeight:400, marginLeft:'.3rem' }}>
                  maks 10% = {fmtRp(maxBop(Number(opdForm.pagu_utama)||0))}
                </span>
              </label>
              <input className="form-control" type="number" value={opdForm.bop}
                onChange={e=>setOpdForm({...opdForm,bop:e.target.value})}
                style={Number(opdForm.bop)>maxBop(Number(opdForm.pagu_utama))?{borderColor:'var(--danger)'}:{}} />
              {Number(opdForm.bop)>maxBop(Number(opdForm.pagu_utama)) && (
                <div style={{ color:'var(--danger)', fontSize:'.75rem', marginTop:'.2rem' }}>⚠️ Melebihi batas 10%</div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Total Pagu Kegiatan</label>
            <input className="form-control" readOnly
              value={fmtRp((Number(opdForm.pagu_utama)||0)+(Number(opdForm.bop)||0))}
              style={{ fontWeight:700, color:'var(--accent)', background:'var(--bg3)' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Keterangan (Nomor SK TAPD, dll)</label>
            <input className="form-control" value={opdForm.keterangan}
              onChange={e=>setOpdForm({...opdForm,keterangan:e.target.value})}
              placeholder="SK Bupati No. ... / TAPD ..." />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setEditOpd(null)}>Batal</button>
            <button className="btn btn-primary" onClick={saveOpdPagu}
              disabled={loading||Number(opdForm.bop)>maxBop(Number(opdForm.pagu_utama))}>
              {loading?'⏳...':'💾 Simpan'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── MANAJEMEN OPD ──────────────────────────────────────────────
export function ManajemenOPD() {
  const { notify } = useApp()
  const [users,   setUsers]   = useState([])
  const [modal,   setModal]   = useState(false)
  const [editId,  setEditId]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email:'', password:'dbhcht#2026', username:'', nama:'', bidang:'kesmas', role:'opd'
  })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('nama')
    setUsers(data||[])
  }

  async function save() {
    if (!form.nama||!form.username) { notify('Nama dan Username wajib!','warn'); return }
    setLoading(true)
    if (editId) {
      const { error } = await supabase.from('profiles').update({
        username:form.username, nama:form.nama, bidang:form.bidang,
        role:form.role, email:form.email, aktif:true
      }).eq('id', editId)
      if (error) notify('Gagal: '+error.message,'error')
      else notify('Profil diperbarui','success')
    } else {
      if (!form.email||!form.password) {
        notify('Email dan Password wajib untuk akun baru!','warn')
        setLoading(false); return
      }
      const { error } = await supabase.auth.signUp({
        email:form.email, password:form.password,
        options:{ data:{ username:form.username, nama:form.nama, role:form.role, bidang:form.bidang } }
      })
      if (error) notify('Gagal membuat akun: '+error.message,'error')
      else notify('Akun dibuat. Username: '+form.username+' | Password: '+form.password,'success')
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
    await supabase.from('profiles').update({ aktif:!u.aktif }).eq('id', u.id)
    notify(u.aktif?'Akun dinonaktifkan':'Akun diaktifkan', u.aktif?'warn':'success')
    load()
  }

  const BIDANG_OPTS = [
    ...BIDANG,
    KOORDINASI,
    { id:'all', label:'Semua Bidang (Sekretariat/BKAD)', icon:'⚙️' },
  ]

  return (
    <div>
      <PageHeader title="👥 Manajemen Akun OPD">
        <button className="btn btn-primary btn-sm" onClick={()=>{
          setForm({ email:'', password:'dbhcht#2026', username:'', nama:'', bidang:'kesmas', role:'opd' })
          setEditId(null); setModal(true)
        }}>+ Tambah OPD</button>
      </PageHeader>

      <div style={{
        background:'#dbeafe40', border:'1px solid #93c5fd', borderRadius:8,
        padding:'.7rem 1rem', marginBottom:'.9rem', fontSize:'.8rem', color:'var(--info)'
      }}>
        ℹ️ Login menggunakan <strong>username</strong> (bukan email). Password default: <code>dbhcht#2026</code>.
        Setiap OPD hanya dapat melihat dan menginput data miliknya sendiri.
        Akun dengan role <strong>sekretariat</strong> memiliki akses penuh termasuk membuat BA Asistensi dan Rekonsiliasi.
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>Nama OPD</th><th>Username</th><th>Bidang</th>
              <th>Email</th><th>Role</th><th>Status</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              {users.length===0 && <EmptyRow cols={7} />}
              {users.map(u=>(
                <tr key={u.id} style={!u.aktif?{opacity:.6}:{}}>
                  <td className="td-bold">{u.nama}</td>
                  <td><code>{u.username}</code></td>
                  <td>
                    <span style={{ fontSize:'.75rem' }}>
                      {BIDANG_OPTS.find(b=>b.id===u.bidang)?.icon}{' '}
                      {BIDANG_OPTS.find(b=>b.id===u.bidang)?.label?.replace('Bidang ','').slice(0,20)||u.bidang}
                    </span>
                  </td>
                  <td className="td-muted">{u.email}</td>
                  <td>
                    <span className={`badge ${u.role==='sekretariat'?'badge-amber':u.role==='viewer'?'badge-gray':'badge-blue'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.aktif?'badge-green':'badge-red'}`}>
                      {u.aktif?'Aktif':'Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      <button className="btn btn-outline btn-sm" onClick={()=>{
                        setForm({...u, password:'(tidak berubah)'}); setEditId(u.id); setModal(true)
                      }}>✏️</button>
                      <button className="btn btn-info btn-sm" onClick={()=>resetPw(u)}>🔑</button>
                      <button className="btn btn-sm"
                        style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)' }}
                        onClick={()=>toggleAktif(u)}>
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

      {modal && (
        <Modal title={editId?'Edit Profil OPD':'Tambah Akun OPD Baru'} onClose={()=>setModal(false)}>
          {!editId && (
            <div className="form-row">
              <div className="form-group" style={{ flex:1 }}>
                <label className="form-label">Email *</label>
                <input className="form-control" type="email" value={form.email}
                  onChange={e=>setForm({...form,email:e.target.value})} placeholder="opd@pemda.go.id" />
              </div>
              <div className="form-group" style={{ flex:1 }}>
                <label className="form-label">Password Awal</label>
                <input className="form-control" value={form.password}
                  onChange={e=>setForm({...form,password:e.target.value})} />
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Nama OPD *</label>
              <input className="form-control" value={form.nama}
                onChange={e=>setForm({...form,nama:e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">
                Username *
                <span style={{ fontWeight:400, fontSize:'.72rem', color:'var(--text2)', marginLeft:'.3rem' }}>
                  (untuk login, tanpa spasi)
                </span>
              </label>
              <input className="form-control" value={form.username}
                onChange={e=>setForm({...form,username:e.target.value.toLowerCase().replace(/\s/g,'')})}
                placeholder="contoh: dinaspertanian" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Bidang Penggunaan DBH CHT</label>
              <select className="form-control" value={form.bidang}
                onChange={e=>setForm({...form,bidang:e.target.value})}>
                {BIDANG_OPTS.map(b=><option key={b.id} value={b.id}>{b.icon} {b.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Role</label>
              <select className="form-control" value={form.role}
                onChange={e=>setForm({...form,role:e.target.value})}>
                <option value="opd">OPD Pengguna</option>
                <option value="sekretariat">Sekretariat Tim (akses penuh)</option>
                <option value="viewer">Viewer (hanya lihat)</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>
              {loading?'⏳...':'💾 Simpan'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── REGULASI ───────────────────────────────────────────────────
export function Regulasi() {
  const { notify } = useApp()
  const { isSekretariat, profile } = useAuth()
  const [rows,    setRows]    = useState([])
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState({ judul:'', tentang:'', tahun:new Date().getFullYear(), nomor:'', link_url:'' })
  const [loading, setLoad]    = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('regulasi_dbhcht').select('*')
      .eq('aktif', true).order('urutan').order('tahun', { ascending:false })
    setRows(data||[])
  }

  async function save() {
    if (!form.judul) { notify('Judul wajib!','warn'); return }
    setLoad(true)
    const { error } = await supabase.from('regulasi_dbhcht').insert({
      ...form, tahun:Number(form.tahun), created_by:profile?.id
    })
    setLoad(false)
    if (error) { notify('Gagal: '+error.message,'error'); return }
    notify('Regulasi ditambahkan','success'); setModal(false); load()
  }

  async function del(id) {
    if (!confirm('Hapus?')) return
    await supabase.from('regulasi_dbhcht').update({ aktif:false }).eq('id', id)
    notify('Dihapus','warn'); load()
  }

  return (
    <div>
      <PageHeader title="📚 Regulasi DBH CHT">
        {isSekretariat && (
          <button className="btn btn-primary btn-sm" onClick={()=>{
            setForm({ judul:'', tentang:'', tahun:new Date().getFullYear(), nomor:'', link_url:'' })
            setModal(true)
          }}>+ Tambah</button>
        )}
      </PageHeader>

      <div className="card">
        {rows.length===0 && <div className="empty-state">Belum ada data regulasi.</div>}
        {rows.map(r=>(
          <div key={r.id} style={{
            padding:'.8rem 0', borderBottom:'1px solid var(--border)',
            display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem'
          }}>
            <div>
              <div style={{ fontWeight:700, color:'var(--accent)', marginBottom:'.2rem' }}>{r.judul}</div>
              <div style={{ fontSize:'.83rem' }}>{r.tentang}</div>
              <div style={{ marginTop:'.25rem', display:'flex', gap:'.3rem', flexWrap:'wrap' }}>
                <span className="badge badge-amber">Tahun {r.tahun}</span>
                {r.nomor && <span className="badge badge-gray">No. {r.nomor}</span>}
              </div>
            </div>
            <div style={{ display:'flex', gap:'.4rem', flexShrink:0 }}>
              {r.link_url && (
                <a href={r.link_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                  📥 Unduh
                </a>
              )}
              {isSekretariat && <DelBtn onClick={()=>del(r.id)} />}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title="Tambah Regulasi" onClose={()=>setModal(false)}>
          <div className="form-group">
            <label className="form-label">Judul Regulasi *</label>
            <input className="form-control" value={form.judul}
              onChange={e=>setForm({...form,judul:e.target.value})}
              placeholder="PMK No. .../PMK.07/..." />
          </div>
          <div className="form-group">
            <label className="form-label">Tentang</label>
            <input className="form-control" value={form.tentang}
              onChange={e=>setForm({...form,tentang:e.target.value})} />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Nomor</label>
              <input className="form-control" value={form.nomor}
                onChange={e=>setForm({...form,nomor:e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Tahun</label>
              <input className="form-control" type="number" value={form.tahun}
                onChange={e=>setForm({...form,tahun:e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Link / URL Dokumen</label>
            <input className="form-control" type="url" value={form.link_url}
              onChange={e=>setForm({...form,link_url:e.target.value})} placeholder="https://..." />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>
              {loading?'⏳...':'💾 Simpan'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
