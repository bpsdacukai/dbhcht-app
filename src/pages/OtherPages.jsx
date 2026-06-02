import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, SEMUA_BIDANG, PROGRAM_BY_BIDANG, fmtRp, maxBop, today } from '../lib/constants.js'
import { Modal, EmptyRow, DelBtn, PageHeader } from '../components/UI.jsx'
import { tindakLanjutAsistensi, tindakLanjutRekonsiliasi } from '../lib/ai.js'
import { CetakAistensi, CetakRekonsiliasi } from './Laporan.jsx'

// ── CSS untuk cetak dokumen BA (hanya area dokumen) ────────────
const PRINT_DOC_CSS = `
@media print {
  body > * { display: none !important; }
  #ba-print-area { display: block !important; position: fixed; top: 0; left: 0; width: 100%; background: white; z-index: 99999; }
}
`
function injectPrintDocCss() {
  if (document.getElementById('ba-print-css')) return
  const s = document.createElement('style'); s.id = 'ba-print-css'
  s.textContent = PRINT_DOC_CSS; document.head.appendChild(s)
}

// ── Komponen Pratinjau BA (fullscreen overlay untuk cetak) ─────
function BAPreview({ type, data, kabupaten, onClose }) {
  useEffect(() => { injectPrintDocCss() }, [])

  const doPrint = () => { window.print() }

  return (
    <>
      {/* Overlay layer yang terlihat di browser */}
      <div style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.7)',
        zIndex:400, display:'flex', flexDirection:'column',
      }}>
        {/* Toolbar — hanya tampil di browser, hilang saat cetak */}
        <div id="ba-toolbar" style={{
          background:'#1a3a1c', color:'#fff', padding:'10px 16px',
          display:'flex', alignItems:'center', gap:'1rem', flexShrink:0,
        }}>
          <span style={{ fontSize:'1rem', fontWeight:600 }}>
            {type==='asistensi'?'🤝 Berita Acara Asistensi':'🔄 Berita Acara Rekonsiliasi'} — {data.opd}
          </span>
          <div style={{ flex:1 }} />
          <button
            onClick={doPrint}
            style={{ background:'#52b788', color:'#fff', border:'none', padding:'6px 16px', borderRadius:5, cursor:'pointer', fontWeight:600 }}>
            🖨️ Cetak
          </button>
          <button
            onClick={onClose}
            style={{ background:'transparent', color:'#aaa', border:'1px solid #3a5a3c', padding:'6px 14px', borderRadius:5, cursor:'pointer' }}>
            ✕ Tutup
          </button>
        </div>
        {/* Dokumen */}
        <div style={{ flex:1, overflow:'auto', background:'#f0f0f0', padding:'1rem' }}>
          <div id="ba-print-area" style={{ boxShadow:'0 2px 20px rgba(0,0,0,.25)' }}>
            {type==='asistensi'
              ? <CetakAistensi data={data} kabupaten={kabupaten} />
              : <CetakRekonsiliasi data={data} kabupaten={kabupaten} />
            }
          </div>
        </div>
      </div>
    </>
  )
}

// ── Komponen editor peserta ─────────────────────────────────────
function PesertaEditor({ label, peserta, onChange }) {
  const add    = () => onChange([...peserta, { nama:'', jabatan:'' }])
  const remove = (i) => onChange(peserta.filter((_,idx)=>idx!==i))
  const update = (i, field, val) => onChange(peserta.map((p,idx)=>idx===i?{...p,[field]:val}:p))
  return (
    <div style={{ marginBottom:'.75rem' }}>
      <div className="flex-between mb-1">
        <label className="form-label" style={{ margin:0 }}>{label}</label>
        <button className="btn btn-outline btn-sm" type="button" onClick={add}>+ Tambah</button>
      </div>
      {peserta.length===0&&<div className="text-muted" style={{ fontSize:'.78rem' }}>Belum ada peserta. Klik + Tambah.</div>}
      {peserta.map((p,i)=>(
        <div key={i} className="form-row" style={{ marginBottom:'.4rem', alignItems:'center' }}>
          <div style={{ flex:2 }}>
            <input className="form-control" value={p.nama} onChange={e=>update(i,'nama',e.target.value)} placeholder={`Nama peserta ${i+1}`} />
          </div>
          <div style={{ flex:2 }}>
            <input className="form-control" value={p.jabatan} onChange={e=>update(i,'jabatan',e.target.value)} placeholder="Jabatan/NIP" />
          </div>
          <button className="btn btn-sm"
            style={{ background:'rgba(192,57,43,.12)', color:'var(--danger)', border:'none', flexShrink:0 }}
            onClick={()=>remove(i)}>×</button>
        </div>
      ))}
    </div>
  )
}

// ── ASISTENSI ──────────────────────────────────────────────────
export function Asistensi() {
  const { tahun, notify } = useApp()
  const { profile, isSekretariat } = useAuth()
  const [rows,    setRows]    = useState([])
  const [modal,   setModal]   = useState(false)
  const [preview, setPreview] = useState(null) // BA untuk preview/cetak
  const [opds,    setOpds]    = useState([])
  const [rkpOPD,  setRkpOPD]  = useState([])
  const [aiLoad,  setAiLoad]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [kabupaten] = useState(() => localStorage.getItem('simdbh_kabupaten')||'…………………')

  // 7 uraian hasil asistensi sesuai format resmi
  const URAIAN_ASISTENSI = [
    'Kesesuaian bidang penggunaan DBH CHT',
    'Kesesuaian indikator dan target',
    'Kesesuaian komponen belanja',
    'Kesesuaian dengan PMK terkait DBH CHT',
    'Kelengkapan dokumen pendukung',
    'Efisiensi dan efektivitas anggaran',
    'Catatan lainnya',
  ]

  const EMPTY_FORM = {
    nomor_ba:'', tanggal:new Date().toISOString().slice(0,10), tempat:'',
    opd:'', opd_user_id:'', bidang_id:'kesmas',
    program:'', kegiatan:'', sub_kegiatan:'', pagu_usulan:'',
    peserta_sekretariat:[], peserta_opd:[],
    // hasil_pembahasan disimpan sebagai JSON array 7 elemen, index 0–6
    hasil_pembahasan: JSON.stringify(['','','','','','','']),
    catatan:'', tindak_lanjut:'',
    kesimpulan:'dapat_ditindaklanjuti', rkp_snapshot:[]
  }
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => { load(); loadOpds() }, [tahun])

  async function load() {
    let q = supabase.from('asistensi_dbhcht').select('*').eq('tahun', tahun).order('tanggal', {ascending:false})
    // OPD hanya lihat BA yang ditujukan untuk mereka
    if (!isSekretariat && profile?.id) {
      q = q.eq('opd_user_id', profile.id)
    }
    const { data } = await q
    setRows(data||[])
  }

  async function loadOpds() {
    const { data } = await supabase.from('profiles').select('id,nama,bidang').eq('role','opd').eq('aktif',true).order('nama')
    setOpds(data||[])
  }

  // Saat OPD dipilih → load semua RKP OPD itu
  async function onSelectOpd(opdNama, opdId) {
    setForm(f=>({ ...f, opd:opdNama, opd_user_id:opdId,
      program:'', kegiatan:'', sub_kegiatan:'', pagu_usulan:'', rkp_snapshot:[] }))
    if (!opdId) { setRkpOPD([]); return }
    const { data } = await supabase.from('rkp_dbhcht').select('*')
      .eq('tahun', tahun).eq('created_by', opdId).order('created_at')
    setRkpOPD(data||[])
  }

  // Auto-fill: pilih satu RKP atau semua
  function onSelectRkp(val) {
    if (!val) return
    if (val === '__all__') {
      // Isi program dari RKP pertama, pagu total semua, snap semua
      const totalPagu = rkpOPD.reduce((s,r)=>s+(r.pagu||0)+(r.pagu_bop||0), 0)
      setForm(f=>({
        ...f,
        program: rkpOPD[0]?.program||'',
        pagu_usulan: String(totalPagu),
        rkp_snapshot: rkpOPD,
      }))
      return
    }
    const r = rkpOPD.find(x=>x.id===val)
    if (!r) return
    setForm(f=>({
      ...f,
      program:      r.program||'',
      kegiatan:     r.kegiatan||'',
      sub_kegiatan: r.sub_kegiatan||'',
      pagu_usulan:  String((r.pagu||0)+(r.pagu_bop||0)),
      bidang_id:    r.is_koordinasi ? 'koordinasi' : (r.bidang_id||f.bidang_id),
      rkp_snapshot: [r],
    }))
  }

  async function genAI() {
    if (!form.hasil_pembahasan) { notify('Isi hasil pembahasan terlebih dahulu','warn'); return }
    setAiLoad(true)
    const text = await tindakLanjutAsistensi({
      opd:form.opd, program:form.program,
      hasil:form.hasil_pembahasan, catatan:form.catatan
    })
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
      hasil_pembahasan:form.hasil_pembahasan,
      catatan:form.catatan,
      tindak_lanjut:form.tindak_lanjut,
      kesimpulan:form.kesimpulan,
      rkp_snapshot:form.rkp_snapshot,
      created_by:profile?.id,
    })
    setLoading(false)
    if (error) { notify('Gagal: '+error.message,'error'); return }
    notify('Berita Acara Asistensi tersimpan','success')
    setModal(false); load()
  }

  async function del(id) {
    if (!confirm('Hapus BA ini?')) return
    await supabase.from('asistensi_dbhcht').delete().eq('id', id)
    notify('Dihapus','warn'); load()
  }

  // Program options: gabungan semua program + koordinasi untuk form asistensi
  const allPrograms = PROGRAM_BY_BIDANG.all

  return (
    <div>
      <PageHeader title="🤝 Asistensi RKP DBH CHT">
        {/* Hanya sekretariat yang bisa membuat BA baru */}
        {isSekretariat && (
          <button className="btn btn-primary btn-sm" onClick={()=>{ setForm(EMPTY_FORM); setRkpOPD([]); setModal(true) }}>
            + Tambah BA
          </button>
        )}
      </PageHeader>

      {/* Info untuk OPD: halaman ini hanya menampilkan BA yang dikirim ke OPD ini */}
      {!isSekretariat && (
        <div style={{
          background:'#dbeafe40', border:'1px solid #93c5fd', borderRadius:8,
          padding:'.7rem 1rem', marginBottom:'.9rem', fontSize:'.82rem', color:'var(--info)'
        }}>
          ℹ️ Halaman ini menampilkan Berita Acara Asistensi yang telah dilaksanakan untuk OPD Anda.
          Untuk melihat dan mencetak BA, klik tombol <strong>👁️ Lihat</strong>.
          Pembuatan BA Asistensi merupakan kewenangan Sekretariat Tim Koordinasi.
        </div>
      )}

      <div className="card">
        <div className="card-title">
          📋 Berita Acara Asistensi TA {tahun}
          {!isSekretariat && <span className="chip" style={{ marginLeft:'.5rem' }}>Hanya milik OPD Anda</span>}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>No. BA</th><th>Tanggal</th><th>OPD</th><th>Program</th>
              <th>Pagu Usulan</th><th>Peserta</th><th>Kesimpulan</th>
              <th>Aksi</th>
            </tr></thead>
            <tbody>
              {rows.length===0 && <EmptyRow cols={8} msg={isSekretariat?'Belum ada data asistensi.':'Belum ada Berita Acara Asistensi untuk OPD Anda.'} />}
              {rows.map(r=>(
                <tr key={r.id}>
                  <td style={{ fontSize:'.78rem' }}>{r.nomor_ba||'—'}</td>
                  <td className="td-muted" style={{ whiteSpace:'nowrap' }}>{r.tanggal}</td>
                  <td className="td-bold">{r.opd}</td>
                  <td style={{ fontSize:'.8rem' }}>{r.program}</td>
                  <td className="td-money">{fmtRp(r.pagu_usulan)}</td>
                  <td style={{ fontSize:'.75rem' }}>
                    {(r.peserta_sekretariat||[]).length} Skrt + {(r.peserta_opd||[]).length} OPD
                  </td>
                  <td>
                    <span className={`badge ${r.kesimpulan==='dapat_ditindaklanjuti'?'badge-green':'badge-amber'}`}>
                      {r.kesimpulan==='dapat_ditindaklanjuti'?'✅ Lanjut':'⚠️ Perbaikan'}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      <button className="btn btn-primary btn-sm" onClick={()=>setPreview(r)}>👁️ Lihat</button>
                      {isSekretariat && <DelBtn onClick={()=>del(r.id)} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview BA fullscreen — hanya area dokumen yang tampil saat cetak */}
      {preview && (
        <BAPreview
          type="asistensi"
          data={preview}
          kabupaten={kabupaten}
          onClose={()=>setPreview(null)}
        />
      )}

      {/* Modal form tambah BA — hanya sekretariat */}
      {modal && isSekretariat && (
        <Modal title="📝 Berita Acara Asistensi" onClose={()=>setModal(false)} wide>
          <div className="form-row">
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Nomor BA</label>
              <input className="form-control" value={form.nomor_ba}
                onChange={e=>setForm({...form,nomor_ba:e.target.value})}
                placeholder="BA-001/DBH CHT/2026" />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Tanggal</label>
              <input className="form-control" type="date" value={form.tanggal}
                onChange={e=>setForm({...form,tanggal:e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Tempat</label>
              <input className="form-control" value={form.tempat}
                onChange={e=>setForm({...form,tempat:e.target.value})}
                placeholder="Ruang Rapat..." />
            </div>
          </div>

          {/* Pilih OPD → auto-load RKP */}
          <div className="form-row">
            <div className="form-group" style={{ flex:2 }}>
              <label className="form-label">OPD *</label>
              <select className="form-control" value={form.opd}
                onChange={e=>{
                  const o = opds.find(x=>x.nama===e.target.value)
                  onSelectOpd(e.target.value, o?.id||'')
                }}>
                <option value="">-- Pilih OPD --</option>
                {opds.map(o=><option key={o.id} value={o.nama}>{o.nama}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex:2 }}>
              <label className="form-label">
                ⚡ Auto-fill dari RKP OPD
                <span style={{ fontWeight:400, fontSize:'.72rem', color:'var(--text2)', marginLeft:'.4rem' }}>
                  (Program, Kegiatan, Sub Kegiatan & Pagu otomatis terisi)
                </span>
              </label>
              <select className="form-control"
                value=""
                onChange={e=>onSelectRkp(e.target.value)}
                disabled={!rkpOPD.length}>
                <option value="">{rkpOPD.length?'-- Pilih RKP untuk auto-fill --':'-- Pilih OPD terlebih dahulu --'}</option>
                {rkpOPD.length>0 && <option value="__all__">📋 Semua RKP OPD ini (total: {fmtRp(rkpOPD.reduce((s,r)=>s+(r.pagu||0)+(r.pagu_bop||0),0))})</option>}
                {rkpOPD.map(r=>(
                  <option key={r.id} value={r.id}>
                    {r.is_koordinasi?'📋 ':''}
                    {r.program}
                    {r.kegiatan?' — '+r.kegiatan:''}
                    {' ('+fmtRp((r.pagu||0)+(r.pagu_bop||0))+')'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Program — semua program termasuk Koordinasi */}
          <div className="form-row">
            <div className="form-group" style={{ flex:2 }}>
              <label className="form-label">Program *</label>
              <select className="form-control" value={form.program}
                onChange={e=>setForm({...form,program:e.target.value})}>
                <option value="">-- Pilih Program --</option>
                {allPrograms.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Pagu Usulan (Rp)</label>
              <input className="form-control" type="number" value={form.pagu_usulan}
                onChange={e=>setForm({...form,pagu_usulan:e.target.value})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Kegiatan</label>
              <input className="form-control" value={form.kegiatan}
                onChange={e=>setForm({...form,kegiatan:e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Sub Kegiatan</label>
              <input className="form-control" value={form.sub_kegiatan}
                onChange={e=>setForm({...form,sub_kegiatan:e.target.value})} />
            </div>
          </div>

          <hr className="divider" />
          <PesertaEditor label="👥 Peserta Sekretariat Tim Koordinasi"
            peserta={form.peserta_sekretariat}
            onChange={v=>setForm(f=>({...f,peserta_sekretariat:v}))} />
          <PesertaEditor label="👥 Peserta OPD"
            peserta={form.peserta_opd}
            onChange={v=>setForm(f=>({...f,peserta_opd:v}))} />
          <hr className="divider" />

          {/* 7 uraian hasil asistensi — sesuai format resmi C. HASIL ASISTENSI */}
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, padding:'.75rem', marginBottom:'.75rem' }}>
            <div style={{ fontWeight:600, fontSize:'.85rem', marginBottom:'.6rem', color:'var(--text)' }}>
              C. Hasil Asistensi
              <span style={{ fontWeight:400, fontSize:'.75rem', color:'var(--text2)', marginLeft:'.5rem' }}>
                (Hasil Pembahasan / Catatan untuk setiap uraian — kosongkan jika tidak ada catatan)
              </span>
            </div>
            {URAIAN_ASISTENSI.map((uraian, i) => {
              const vals = (() => { try { return JSON.parse(form.hasil_pembahasan) } catch { return ['','','','','','',''] } })()
              return (
                <div key={i} style={{ display:'flex', gap:'.6rem', marginBottom:'.5rem', alignItems:'flex-start' }}>
                  <div style={{ width:28, height:28, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.8rem', fontWeight:600, flexShrink:0, marginTop:1 }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'.8rem', color:'var(--text2)', marginBottom:2 }}>{uraian}</div>
                    <input className="form-control" style={{ fontSize:'.82rem' }}
                      value={vals[i] || ''}
                      placeholder={`Hasil pembahasan / catatan poin ${i+1}...`}
                      onChange={e => {
                        const arr = (() => { try { return JSON.parse(form.hasil_pembahasan) } catch { return ['','','','','','',''] } })()
                        arr[i] = e.target.value
                        setForm({...form, hasil_pembahasan: JSON.stringify(arr)})
                      }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="form-group">
            <label className="form-label">Kesimpulan</label>
            <select className="form-control" value={form.kesimpulan}
              onChange={e=>setForm({...form,kesimpulan:e.target.value})}>
              <option value="dapat_ditindaklanjuti">✅ Dapat ditindaklanjuti pada tahapan penganggaran berikutnya</option>
              <option value="perlu_perbaikan">⚠️ Perlu dilakukan perbaikan/penyesuaian sebagaimana hasil asistensi</option>
            </select>
          </div>
          <div className="form-group">
            <div className="flex-between mb-1">
              <label className="form-label" style={{ margin:0 }}>🤖 Tindak Lanjut (AI Otomatis)</label>
              <button className="btn btn-ai btn-sm" onClick={genAI} disabled={aiLoad}>
                {aiLoad?'⏳ Memproses...':'✨ Generate AI'}
              </button>
            </div>
            <textarea className="form-control ai-box" rows={5} value={form.tindak_lanjut}
              onChange={e=>setForm({...form,tindak_lanjut:e.target.value})}
              placeholder="Klik Generate AI untuk tindak lanjut otomatis..." />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>
              {loading?'⏳ Menyimpan...':'💾 Simpan BA'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── REKONSILIASI ───────────────────────────────────────────────
export function Rekonsiliasi() {
  const { tahun, notify } = useApp()
  const { profile, isSekretariat } = useAuth()
  const [rows,    setRows]    = useState([])
  const [modal,   setModal]   = useState(false)
  const [preview, setPreview] = useState(null)
  const [opds,    setOpds]    = useState([])
  const [realOPD, setRealOPD] = useState([])
  const [aiLoad,  setAiLoad]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [kabupaten] = useState(() => localStorage.getItem('simdbh_kabupaten')||'…………………')

  const EMPTY_FORM = {
    nomor_ba:'', tanggal:new Date().toISOString().slice(0,10), tempat:'',
    opd:'', opd_user_id:'', triwulan:'I',
    program:'', kegiatan:'', pagu:'', realisasi_keu:'', realisasi_fisik:'',
    peserta_sekretariat:[], peserta_opd:[],
    permasalahan:'', tindak_lanjut:'', penanggung_jawab:'',
    kesimpulan:'sesuai', realisasi_snapshot:[]
  }
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => { load(); loadOpds() }, [tahun])

  async function load() {
    let q = supabase.from('rekonsiliasi_dbhcht').select('*').eq('tahun', tahun).order('tanggal', {ascending:false})
    // OPD hanya lihat BA rekonsiliasi miliknya
    if (!isSekretariat && profile?.id) {
      q = q.eq('opd_user_id', profile.id)
    }
    const { data } = await q
    setRows(data||[])
  }

  async function loadOpds() {
    const { data } = await supabase.from('profiles').select('id,nama,bidang').eq('role','opd').eq('aktif',true).order('nama')
    setOpds(data||[])
  }

  // Saat OPD dipilih → load semua realisasi OPD itu
  // FIX: semua OPD mendapat akses yang sama tanpa filter bidang khusus
  async function onSelectOpd(opdNama, opdId) {
    setForm(f=>({ ...f, opd:opdNama, opd_user_id:opdId,
      program:'', kegiatan:'', pagu:'', realisasi_keu:'', realisasi_snapshot:[] }))
    if (!opdId) { setRealOPD([]); return }
    // Load realisasi dari OPD ini (semua triwulan, tanpa filter bidang)
    const { data } = await supabase.from('realisasi_dbhcht').select('*')
      .eq('tahun', tahun).eq('created_by', opdId).order('triwulan')
    setRealOPD(data||[])
  }

  // Auto-fill dari realisasi terpilih
  function onSelectReal(val) {
    if (!val) return
    if (val === '__all__') {
      const totalPagu = realOPD.reduce((s,r)=>s+(r.pagu||0),0)
      const totalReal = realOPD.reduce((s,r)=>s+(r.realisasi_keu||0),0)
      const avgFisik  = realOPD.length ? (realOPD.reduce((s,r)=>s+(r.realisasi_fisik||0),0)/realOPD.length).toFixed(1) : 0
      setForm(f=>({
        ...f,
        program:      realOPD[0]?.program||'',
        pagu:         String(totalPagu),
        realisasi_keu: String(totalReal),
        realisasi_fisik: String(avgFisik),
        realisasi_snapshot: realOPD,
      }))
      return
    }
    const r = realOPD.find(x=>x.id===val)
    if (!r) return
    setForm(f=>({
      ...f,
      program:         r.program||'',
      kegiatan:        r.kegiatan||'',
      pagu:            String(r.pagu||0),
      realisasi_keu:   String(r.realisasi_keu||0),
      realisasi_fisik: String(r.realisasi_fisik||0),
      realisasi_snapshot: [r],
    }))
  }

  async function genAI() {
    setAiLoad(true)
    const text = await tindakLanjutRekonsiliasi({
      opd:form.opd, triwulan:form.triwulan,
      pagu:Number(form.pagu), realisasiKeu:Number(form.realisasi_keu),
      realisasiFisik:form.realisasi_fisik, permasalahan:form.permasalahan
    })
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
      pagu:Number(form.pagu)||0,
      realisasi_keu:Number(form.realisasi_keu)||0,
      realisasi_fisik:Number(form.realisasi_fisik)||0,
      peserta_sekretariat:form.peserta_sekretariat,
      peserta_opd:form.peserta_opd,
      permasalahan:form.permasalahan,
      tindak_lanjut:form.tindak_lanjut,
      penanggung_jawab:form.penanggung_jawab,
      kesimpulan:form.kesimpulan,
      realisasi_snapshot:form.realisasi_snapshot,
      created_by:profile?.id,
    })
    setLoading(false)
    if (error) { notify('Gagal: '+error.message,'error'); return }
    notify('Berita Acara Rekonsiliasi tersimpan','success')
    setModal(false); load()
  }

  async function del(id) {
    if (!confirm('Hapus?')) return
    await supabase.from('rekonsiliasi_dbhcht').delete().eq('id', id)
    notify('Dihapus','warn'); load()
  }

  return (
    <div>
      <PageHeader title="🔄 Rekonsiliasi Realisasi DBH CHT">
        {isSekretariat && (
          <button className="btn btn-primary btn-sm"
            onClick={()=>{ setForm(EMPTY_FORM); setRealOPD([]); setModal(true) }}>
            + Tambah BA
          </button>
        )}
      </PageHeader>

      {!isSekretariat && (
        <div style={{
          background:'#dbeafe40', border:'1px solid #93c5fd', borderRadius:8,
          padding:'.7rem 1rem', marginBottom:'.9rem', fontSize:'.82rem', color:'var(--info)'
        }}>
          ℹ️ Halaman ini menampilkan Berita Acara Rekonsiliasi yang telah dilaksanakan untuk OPD Anda.
          Pembuatan BA Rekonsiliasi merupakan kewenangan Sekretariat Tim Koordinasi.
        </div>
      )}

      <div className="card">
        <div className="card-title">
          📋 Berita Acara Rekonsiliasi TA {tahun}
          {!isSekretariat && <span className="chip" style={{ marginLeft:'.5rem' }}>Hanya milik OPD Anda</span>}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>No. BA</th><th>Tanggal</th><th>OPD</th><th>Tw</th>
              <th>Pagu</th><th>Real. Keu.</th><th>Fisik</th>
              <th>Peserta</th><th>Kesimpulan</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              {rows.length===0 && <EmptyRow cols={10} msg={isSekretariat?'Belum ada data rekonsiliasi.':'Belum ada Berita Acara Rekonsiliasi untuk OPD Anda.'} />}
              {rows.map(r=>{
                const pct = r.pagu>0?(r.realisasi_keu/r.pagu*100).toFixed(1):0
                return (
                  <tr key={r.id}>
                    <td style={{ fontSize:'.78rem' }}>{r.nomor_ba||'—'}</td>
                    <td className="td-muted" style={{ whiteSpace:'nowrap' }}>{r.tanggal}</td>
                    <td className="td-bold">{r.opd}</td>
                    <td><span className="badge badge-blue">Tw {r.triwulan}</span></td>
                    <td className="td-muted">{fmtRp(r.pagu)}</td>
                    <td className="td-money">{fmtRp(r.realisasi_keu)} <span style={{ fontSize:'.7rem',fontWeight:400,color:'var(--text2)' }}>({pct}%)</span></td>
                    <td style={{ fontSize:'.78rem' }}>{r.realisasi_fisik}%</td>
                    <td style={{ fontSize:'.75rem' }}>
                      {(r.peserta_sekretariat||[]).length}+{(r.peserta_opd||[]).length}
                    </td>
                    <td><span className={`badge ${r.kesimpulan==='sesuai'?'badge-green':'badge-amber'}`}>
                      {r.kesimpulan==='sesuai'?'✅ Sesuai':'⚠️ Perbaikan'}
                    </span></td>
                    <td>
                      <div className="action-row">
                        <button className="btn btn-primary btn-sm" onClick={()=>setPreview(r)}>👁️ Lihat</button>
                        {isSekretariat && <DelBtn onClick={()=>del(r.id)} />}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview BA fullscreen */}
      {preview && (
        <BAPreview
          type="rekonsiliasi"
          data={preview}
          kabupaten={kabupaten}
          onClose={()=>setPreview(null)}
        />
      )}

      {/* Modal form — hanya sekretariat */}
      {modal && isSekretariat && (
        <Modal title="📝 Berita Acara Rekonsiliasi" onClose={()=>setModal(false)} wide>
          <div className="form-row">
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Nomor BA</label>
              <input className="form-control" value={form.nomor_ba}
                onChange={e=>setForm({...form,nomor_ba:e.target.value})}
                placeholder="BA-Rekon-001/2026" />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Tanggal</label>
              <input className="form-control" type="date" value={form.tanggal}
                onChange={e=>setForm({...form,tanggal:e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Tempat</label>
              <input className="form-control" value={form.tempat}
                onChange={e=>setForm({...form,tempat:e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Triwulan</label>
              <select className="form-control" value={form.triwulan}
                onChange={e=>setForm({...form,triwulan:e.target.value})}>
                {['I','II','III','IV'].map(t=><option key={t} value={t}>Triwulan {t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex:2 }}>
              <label className="form-label">OPD *</label>
              <select className="form-control" value={form.opd}
                onChange={e=>{
                  const o = opds.find(x=>x.nama===e.target.value)
                  onSelectOpd(e.target.value, o?.id||'')
                }}>
                <option value="">-- Pilih OPD --</option>
                {opds.map(o=><option key={o.id} value={o.nama}>{o.nama}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex:2 }}>
              <label className="form-label">
                ⚡ Auto-fill dari Realisasi OPD
                <span style={{ fontWeight:400, fontSize:'.72rem', color:'var(--text2)', marginLeft:'.4rem' }}>
                  (Program, Pagu, Realisasi otomatis terisi)
                </span>
              </label>
              <select className="form-control"
                value=""
                onChange={e=>onSelectReal(e.target.value)}
                disabled={!realOPD.length}>
                <option value="">{realOPD.length?'-- Pilih realisasi untuk auto-fill --':'-- Pilih OPD terlebih dahulu --'}</option>
                {realOPD.length>0 && (
                  <option value="__all__">📋 Semua realisasi OPD ini</option>
                )}
                {realOPD.map(r=>(
                  <option key={r.id} value={r.id}>
                    Tw {r.triwulan} — {r.program}
                    {r.kegiatan?' | '+r.kegiatan.slice(0,30):''}
                    {' ('+fmtRp(r.realisasi_keu)+')'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex:2 }}>
              <label className="form-label">Program</label>
              <input className="form-control" value={form.program}
                onChange={e=>setForm({...form,program:e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:2 }}>
              <label className="form-label">Kegiatan/Sub Kegiatan</label>
              <input className="form-control" value={form.kegiatan}
                onChange={e=>setForm({...form,kegiatan:e.target.value})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Pagu (Rp)</label>
              <input className="form-control" type="number" value={form.pagu}
                onChange={e=>setForm({...form,pagu:e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Realisasi Keuangan (Rp)</label>
              <input className="form-control" type="number" value={form.realisasi_keu}
                onChange={e=>setForm({...form,realisasi_keu:e.target.value})} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Realisasi Fisik (%)</label>
              <input className="form-control" type="number" min="0" max="100"
                value={form.realisasi_fisik}
                onChange={e=>setForm({...form,realisasi_fisik:e.target.value})} />
            </div>
          </div>

          <hr className="divider" />
          <PesertaEditor label="👥 Peserta Sekretariat Tim Koordinasi"
            peserta={form.peserta_sekretariat}
            onChange={v=>setForm(f=>({...f,peserta_sekretariat:v}))} />
          <PesertaEditor label="👥 Peserta OPD"
            peserta={form.peserta_opd}
            onChange={v=>setForm(f=>({...f,peserta_opd:v}))} />
          <hr className="divider" />

          <div className="form-row">
            <div className="form-group" style={{ flex:2 }}>
              <label className="form-label">Permasalahan / Hambatan</label>
              <textarea className="form-control" rows={3} value={form.permasalahan}
                onChange={e=>setForm({...form,permasalahan:e.target.value})}
                placeholder="Uraikan permasalahan..." />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label className="form-label">Penanggung Jawab</label>
              <input className="form-control" value={form.penanggung_jawab}
                onChange={e=>setForm({...form,penanggung_jawab:e.target.value})} />
              <div style={{ marginTop:'.5rem' }}>
                <label className="form-label">Kesimpulan</label>
                <select className="form-control" value={form.kesimpulan}
                  onChange={e=>setForm({...form,kesimpulan:e.target.value})}>
                  <option value="sesuai">✅ Sesuai dengan ketentuan</option>
                  <option value="perlu_perbaikan">⚠️ Memerlukan perbaikan</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <div className="flex-between mb-1">
              <label className="form-label" style={{ margin:0 }}>🤖 Tindak Lanjut (AI)</label>
              <button className="btn btn-ai btn-sm" onClick={genAI} disabled={aiLoad}>
                {aiLoad?'⏳...':'✨ Generate AI'}
              </button>
            </div>
            <textarea className="form-control ai-box" rows={5} value={form.tindak_lanjut}
              onChange={e=>setForm({...form,tindak_lanjut:e.target.value})}
              placeholder="Klik Generate AI..." />
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>
              {loading?'⏳...':'💾 Simpan BA'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Export halaman lainnya (Pagu, ManajemenOPD, Regulasi) ──────
// (tidak berubah — diimpor dari file yang sama untuk efisiensi)
export { Pagu, ManajemenOPD, Regulasi } from './OtherPagesExtra.jsx'
