import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { BIDANG, KOORDINASI, PROGRAM_BY_BIDANG, SUB_KEGIATAN_KOORDINASI, KODE_REKENING_BY_BIDANG, fmtRp, maxBop } from '../lib/constants.js'
import { Modal, EmptyRow, DelBtn, EditBtn, PageHeader } from '../components/UI.jsx'
import { getPaguOpd } from '../lib/supabase.js'

// Bentuk baris gabungan Semula (dari rkp_dbhcht) + Menjadi (dari rkp_perubahan_dbhcht)
// murniRow  : baris asli RKP Murni (bisa null jika kegiatan baru murni hasil Perubahan)
// perubahan : baris rkp_perubahan_dbhcht terkait (bisa null jika belum pernah diisi OPD)
function buildRow(murniRow, perubahan) {
  const semulaPagu    = murniRow?.pagu || 0
  const semulaBop     = murniRow?.pagu_bop || 0
  const menjadiPagu   = perubahan ? (perubahan.pagu_menjadi || 0) : semulaPagu
  const menjadiBop    = perubahan ? (perubahan.pagu_bop_menjadi || 0) : semulaBop
  return {
    key:            perubahan?.id || murniRow?.id,
    perubahanId:    perubahan?.id || null,
    rkp_id:         murniRow?.id || null,
    bidang_id:      perubahan?.bidang_id || murniRow?.bidang_id,
    is_koordinasi:  perubahan?.is_koordinasi ?? murniRow?.is_koordinasi ?? false,
    program:        perubahan?.program || murniRow?.program || '',
    kegiatan:       perubahan?.kegiatan || murniRow?.kegiatan || '',
    sub_kegiatan:   perubahan?.sub_kegiatan || murniRow?.sub_kegiatan || '',
    kode_rekening:  perubahan?.kode_rekening || murniRow?.kode_rekening || '',
    nama_rekening:  perubahan?.nama_rekening || murniRow?.nama_rekening || '',
    createdByNama:  perubahan?.created_by_nama || murniRow?.created_by_nama || '',
    isBaru:         !murniRow,          // kegiatan yang tidak ada di RKP Murni
    sudahDiisi:     !!perubahan,        // OPD sudah mengisi kolom Menjadi
    keterangan:     perubahan?.keterangan || '',
    semula: {
      volume: murniRow?.volume ?? null,
      satuan: murniRow?.satuan || '',
      pagu:   semulaPagu,
      bop:    semulaBop,
      total:  semulaPagu + semulaBop,
    },
    menjadi: {
      volume: perubahan?.volume_menjadi ?? (murniRow ? murniRow.volume : null),
      satuan: perubahan?.satuan_menjadi || (murniRow ? murniRow.satuan : 'Paket'),
      pagu:   menjadiPagu,
      bop:    menjadiBop,
      total:  menjadiPagu + menjadiBop,
    },
  }
}

const EMPTY_FORM = {
  perubahanId:null, rkp_id:null,
  bidang_id:'', program:'', kegiatan:'', sub_kegiatan:'',
  kode_rekening:'', nama_rekening:'',
  volume_menjadi:'', satuan_menjadi:'Paket',
  pagu_menjadi:'', pagu_bop_menjadi:'',
  keterangan:'', is_koordinasi:false,
  semulaDisplay:null, // { volume, satuan, pagu, bop, total } — hanya untuk ditampilkan
}

export default function RKPPerubahan() {
  const { tahun, notify } = useApp()
  const { profile, isSekretariat } = useAuth()
  const [murniRows, setMurniRows] = useState([])
  const [perubahanRows, setPerubahanRows] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [activeTab, setTab] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paguOpd, setPaguOpd] = useState(null)
  const [bopWarn, setBopWarn] = useState('')

  useEffect(() => {
    if (!activeTab && profile) setTab(isSekretariat ? 'kesmas' : (profile.bidang || 'kesmas'))
  }, [profile])

  useEffect(() => { if (activeTab) load() }, [tahun, activeTab])

  useEffect(() => {
    if (profile?.id) getPaguOpd(profile.id, tahun, 'Perubahan').then(p => setPaguOpd(p))
  }, [profile, tahun])

  async function load() {
    setLoading(true)
    // Semula = RKP Murni tahun berjalan (READ ONLY, tidak pernah ditulis dari sini)
    let qm = supabase.from('rkp_dbhcht').select('*').eq('tahun', tahun).eq('jenis', 'Murni').order('created_at')
    // Menjadi = tabel baru rkp_perubahan_dbhcht
    let qp = supabase.from('rkp_perubahan_dbhcht').select('*').eq('tahun', tahun).order('created_at')
    if (!isSekretariat) {
      qm = qm.eq('created_by', profile?.id)
      qp = qp.eq('created_by', profile?.id)
    }
    const [{ data: m }, { data: p }] = await Promise.all([qm, qp])
    setMurniRows(m || [])
    setPerubahanRows(p || [])
    setLoading(false)
  }

  const isKoor = activeTab === 'koordinasi'

  // Gabungkan: semua baris Murni pada bidang aktif + baris Perubahan "kegiatan baru" (rkp_id null) pada bidang aktif
  const murniOnTab = murniRows.filter(r => isKoor ? r.is_koordinasi : (r.bidang_id === activeTab && !r.is_koordinasi))
  const perubahanBaruOnTab = perubahanRows.filter(r => !r.rkp_id && (isKoor ? r.is_koordinasi : (r.bidang_id === activeTab && !r.is_koordinasi)))

  const rows = [
    ...murniOnTab.map(m => buildRow(m, perubahanRows.find(p => p.rkp_id === m.id))),
    ...perubahanBaruOnTab.map(p => buildRow(null, p)),
  ]

  const totalSemula  = rows.reduce((s, r) => s + r.semula.total, 0)
  const totalMenjadi = rows.reduce((s, r) => s + r.menjadi.total, 0)

  const canEdit = isSekretariat
    || (profile?.role === 'opd' && (!activeTab || profile.bidang === activeTab || isKoor))

  function openEditMenjadi(row) {
    setForm({
      perubahanId:  row.perubahanId,
      rkp_id:       row.rkp_id,
      bidang_id:    row.bidang_id,
      program:      row.program,
      kegiatan:     row.kegiatan,
      sub_kegiatan: row.sub_kegiatan,
      kode_rekening: row.kode_rekening,
      nama_rekening: row.nama_rekening,
      volume_menjadi: String(row.menjadi.volume ?? ''),
      satuan_menjadi: row.menjadi.satuan || 'Paket',
      pagu_menjadi:   String(row.menjadi.pagu || ''),
      pagu_bop_menjadi: String(row.menjadi.bop || ''),
      keterangan:   row.keterangan,
      is_koordinasi: row.is_koordinasi,
      semulaDisplay: row.isBaru ? null : row.semula,
    })
    setBopWarn(''); setModal(true)
  }

  function openTambahBaru() {
    const defBid = isKoor ? 'koordinasi' : (isSekretariat ? activeTab : profile?.bidang || activeTab)
    setForm({ ...EMPTY_FORM, bidang_id: defBid || 'kesmas', is_koordinasi: isKoor, semulaDisplay: null })
    setBopWarn(''); setModal(true)
  }

  function handlePaguChange(val) {
    const p = Number(val) || 0
    const bop = Number(form.pagu_bop_menjadi) || 0
    const mx = maxBop(p)
    setBopWarn(bop > mx ? `⚠️ BOP melebihi 10% (maks: ${fmtRp(mx)})` : '')
    setForm(f => ({ ...f, pagu_menjadi: val }))
  }
  function handleBopChange(val) {
    const bop = Number(val) || 0
    const mx = maxBop(Number(form.pagu_menjadi) || 0)
    setBopWarn(bop > mx ? `⚠️ BOP melebihi 10% (maks: ${fmtRp(mx)})` : '')
    setForm(f => ({ ...f, pagu_bop_menjadi: val }))
  }

  async function save() {
    if (!form.program || form.pagu_menjadi === '') { notify('Program dan Pagu Menjadi wajib diisi!', 'warn'); return }
    const bop = Number(form.pagu_bop_menjadi) || 0
    const mx = maxBop(Number(form.pagu_menjadi))
    if (bop > mx) { notify('BOP melebihi batas 10% dari pagu!', 'error'); return }
    setSaving(true)
    const payload = {
      tahun,
      rkp_id:           form.rkp_id || null,
      bidang_id:        form.is_koordinasi ? 'koordinasi' : form.bidang_id,
      program:          form.program,
      kegiatan:         form.kegiatan,
      sub_kegiatan:     form.sub_kegiatan,
      kode_rekening:    form.kode_rekening,
      nama_rekening:    form.nama_rekening,
      volume_menjadi:   Number(form.volume_menjadi) || null,
      satuan_menjadi:   form.satuan_menjadi,
      pagu_menjadi:     Number(form.pagu_menjadi) || 0,
      pagu_bop_menjadi: bop,
      keterangan:       form.keterangan,
      is_koordinasi:    form.is_koordinasi,
      created_by:       profile?.id,
      created_by_nama:  profile?.nama,
    }
    const { error } = form.perubahanId
      ? await supabase.from('rkp_perubahan_dbhcht').update(payload).eq('id', form.perubahanId)
      : await supabase.from('rkp_perubahan_dbhcht').insert(payload)
    setSaving(false)
    if (error) { notify('Gagal: ' + error.message, 'error'); return }
    notify('Data Perubahan (Menjadi) disimpan', 'success')
    setModal(false); load()
  }

  async function resetKeSemula(row) {
    if (!row.perubahanId) return
    if (!confirm(row.isBaru ? 'Hapus kegiatan baru ini dari RKP Perubahan?' : 'Kembalikan kolom Menjadi ke nilai Semula (hapus entri perubahan)?')) return
    await supabase.from('rkp_perubahan_dbhcht').delete().eq('id', row.perubahanId)
    notify('Data diperbarui', 'warn'); load()
  }

  const kodeOpts = KODE_REKENING_BY_BIDANG[form.is_koordinasi ? 'koordinasi' : form.bidang_id] || []
  const progOpts = PROGRAM_BY_BIDANG[form.is_koordinasi ? 'koordinasi' : form.bidang_id] || []

  const tabs = isSekretariat
    ? [...BIDANG, KOORDINASI]
    : (profile?.bidang === 'all' ? [...BIDANG, KOORDINASI] : [
        ...(BIDANG.filter(b => b.id === profile?.bidang)),
        KOORDINASI
      ])

  if (!activeTab) return <div className="text-muted" style={{ padding: '2rem' }}>Memuat...</div>

  return (
    <div>
      <PageHeader title="📝 Rancangan Kegiatan &amp; Penganggaran Perubahan DBH CHT">
        <span className="chip">TA {tahun} · Perubahan</span>
        {paguOpd && <span className="chip" style={{ color: 'var(--gold)' }}>Pagu OPD Perubahan: {fmtRp((paguOpd.pagu_utama || 0) + (paguOpd.bop || 0))}</span>}
        <span className="chip">Total Semula: {fmtRp(totalSemula)}</span>
        <span className="chip" style={{ color: 'var(--accent)' }}>Total Menjadi: {fmtRp(totalMenjadi)}</span>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={openTambahBaru}>+ Kegiatan Baru</button>}
        <button className="btn btn-outline btn-sm no-print" onClick={() => window.print()}>🖨️ Cetak</button>
      </PageHeader>

      <div style={{ background: '#fdf5e430', border: '1px solid #b5832a40', borderRadius: 6, padding: '.6rem .8rem', marginBottom: '.75rem', fontSize: '.8rem', color: 'var(--text2)' }}>
        ℹ️ Kolom <strong>Semula</strong> diambil otomatis dari data RKP Murni TA {tahun} dan tidak dapat diubah di sini. Isi kolom <strong>Menjadi</strong> sesuai tambahan alokasi Perubahan setelah penetapan SILPA TA sebelumnya. Kegiatan yang benar-benar baru (belum ada di RKP Murni) bisa ditambahkan lewat tombol "+ Kegiatan Baru".
      </div>

      <div className="tabs">
        {tabs.map(b => (
          <div key={b.id}
            className={`tab ${activeTab === b.id ? 'active' : ''}`}
            style={activeTab === b.id && b.id === 'koordinasi' ? { color: KOORDINASI.color, borderBottomColor: KOORDINASI.color } : {}}
            onClick={() => setTab(b.id)}
          >
            {b.icon} {b.short}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex-between mb-1">
          <div className="card-title" style={{ margin: 0 }}>
            {isKoor ? <>{KOORDINASI.icon} {KOORDINASI.label}</> : <>{BIDANG.find(b => b.id === activeTab)?.icon} {BIDANG.find(b => b.id === activeTab)?.label}</>}
          </div>
          <strong style={{ color: 'var(--accent)' }}>{fmtRp(rows.reduce((s, r) => s + r.menjadi.total, 0))}</strong>
        </div>

        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th rowSpan={2}>No</th>
                <th rowSpan={2}>Program / Kegiatan</th>
                <th rowSpan={2}>Kode Rekening</th>
                <th colSpan={3} style={{ textAlign: 'center' }}>Semula</th>
                <th colSpan={3} style={{ textAlign: 'center' }}>Menjadi</th>
                <th rowSpan={2}>Selisih (Rp)</th>
                {canEdit && <th rowSpan={2} className="no-print">Aksi</th>}
              </tr>
              <tr>
                <th style={{ fontSize: '.72rem' }}>Vol/Satuan</th>
                <th style={{ fontSize: '.72rem' }}>Pagu (Rp)</th>
                <th style={{ fontSize: '.72rem' }}>Total (Rp)</th>
                <th style={{ fontSize: '.72rem' }}>Vol/Satuan</th>
                <th style={{ fontSize: '.72rem' }}>Pagu (Rp)</th>
                <th style={{ fontSize: '.72rem' }}>Total (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {loading && <EmptyRow cols={canEdit ? 10 : 9} msg="Memuat data..." />}
              {!loading && rows.length === 0 && <EmptyRow cols={canEdit ? 10 : 9} msg="Belum ada data RKP Murni pada bidang ini untuk dijadikan dasar Perubahan." />}
              {rows.map((r, i) => {
                const selisih = r.menjadi.total - r.semula.total
                return (
                  <tr key={r.key} style={r.isBaru ? { background: 'rgba(45,106,79,.06)' } : {}}>
                    <td style={{ fontSize: '.75rem', color: 'var(--text2)' }}>{i + 1}</td>
                    <td>
                      <div className="td-bold" style={{ fontSize: '.8rem' }}>{r.program} {r.isBaru && <span className="chip" style={{ fontSize: '.65rem' }}>Kegiatan Baru</span>}</div>
                      <div className="td-muted">{r.kegiatan}</div>
                    </td>
                    <td><span className="td-code">{r.kode_rekening || '—'}</span></td>

                    <td style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>{r.isBaru ? '—' : `${r.semula.volume || ''} ${r.semula.satuan || ''}`}</td>
                    <td className="td-money">{r.isBaru ? '—' : fmtRp(r.semula.pagu)}</td>
                    <td className="td-money">{r.isBaru ? '—' : fmtRp(r.semula.total)}</td>

                    <td style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>{r.menjadi.volume || ''} {r.menjadi.satuan || ''}</td>
                    <td className="td-money">{fmtRp(r.menjadi.pagu)}</td>
                    <td className="td-money" style={{ fontWeight: r.sudahDiisi ? 700 : 400 }}>{fmtRp(r.menjadi.total)}</td>

                    <td className="td-money" style={{ color: selisih > 0 ? 'var(--accent)' : selisih < 0 ? 'var(--danger)' : 'var(--text2)' }}>
                      {selisih === 0 ? '—' : (selisih > 0 ? '+' : '') + fmtRp(selisih)}
                    </td>
                    {canEdit && <td className="no-print"><div className="action-row">
                      <EditBtn onClick={() => openEditMenjadi(r)} />
                      {r.perubahanId && <DelBtn onClick={() => resetKeSemula(r)} />}
                    </div></td>}
                  </tr>
                )
              })}
              {rows.length > 0 && (
                <tr style={{ background: 'var(--bg3)', fontWeight: 700 }}>
                  <td colSpan={5} style={{ textAlign: 'right', fontSize: '.8rem' }}>TOTAL</td>
                  <td className="td-money">{fmtRp(totalSemula)}</td>
                  <td colSpan={2} style={{ fontSize: '.72rem', color: 'var(--text2)' }}></td>
                  <td className="td-money">{fmtRp(totalMenjadi)}</td>
                  <td className="td-money">{fmtRp(totalMenjadi - totalSemula)}</td>
                  {canEdit && <td className="no-print"></td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={form.perubahanId ? 'Edit Kolom Menjadi' : (form.rkp_id ? 'Isi Kolom Menjadi' : 'Tambah Kegiatan Baru (Perubahan)')} onClose={() => setModal(false)} wide>
          {form.semulaDisplay && (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '.6rem .8rem', marginBottom: '.75rem', fontSize: '.8rem' }}>
              <strong style={{ color: 'var(--text2)' }}>Semula (dari RKP Murni, tidak dapat diubah):</strong>{' '}
              {form.semulaDisplay.volume || ''} {form.semulaDisplay.satuan} · Pagu {fmtRp(form.semulaDisplay.pagu)} · BOP {fmtRp(form.semulaDisplay.bop)} · Total {fmtRp(form.semulaDisplay.total)}
            </div>
          )}

          {/* Field program/kegiatan/kode rekening hanya bisa diedit untuk kegiatan BARU (rkp_id null) */}
          {!form.rkp_id && (
            <>
              <div className="form-group" style={{ background: '#fdf5e430', border: '1px solid #b5832a40', borderRadius: 6, padding: '.6rem .8rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>
                  <input type="checkbox" checked={form.is_koordinasi}
                    onChange={e => setForm({ ...form, is_koordinasi: e.target.checked, bidang_id: e.target.checked ? 'koordinasi' : (isSekretariat ? activeTab : profile?.bidang || activeTab) })} />
                  📋 Ini adalah Kegiatan Koordinasi Pengelolaan DBH CHT
                </label>
              </div>

              <div className="form-row" style={{ marginTop: '.5rem' }}>
                {!form.is_koordinasi && (
                  <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                    <label className="form-label">Bidang</label>
                    <select className="form-control" value={form.bidang_id}
                      onChange={e => setForm({ ...form, bidang_id: e.target.value, program: '', kode_rekening: '', nama_rekening: '' })}
                      disabled={!isSekretariat}>
                      {BIDANG.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group" style={{ flex: 2, minWidth: 200 }}>
                  <label className="form-label">Program *</label>
                  <select className="form-control" value={form.program} onChange={e => setForm({ ...form, program: e.target.value })}>
                    <option value="">-- Pilih Program --</option>
                    {progOpts.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Kegiatan</label>
                <input className="form-control" value={form.kegiatan} onChange={e => setForm({ ...form, kegiatan: e.target.value })} placeholder="Nama kegiatan" />
              </div>

              <div className="form-group">
                <label className="form-label">Sub Kegiatan</label>
                {form.is_koordinasi ? (
                  <select className="form-control" value={form.sub_kegiatan} onChange={e => setForm({ ...form, sub_kegiatan: e.target.value })}>
                    <option value="">-- Pilih Sub Kegiatan --</option>
                    {SUB_KEGIATAN_KOORDINASI.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className="form-control" value={form.sub_kegiatan} onChange={e => setForm({ ...form, sub_kegiatan: e.target.value })} />
                )}
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Kode Rekening</label>
                  <select className="form-control" value={form.kode_rekening} onChange={e => {
                    const k = kodeOpts.find(x => x.kode === e.target.value)
                    setForm({ ...form, kode_rekening: e.target.value, nama_rekening: k?.nama || form.nama_rekening })
                  }}>
                    <option value="">-- Pilih Kode --</option>
                    {kodeOpts.map(k => <option key={k.kode} value={k.kode}>{k.kode}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Nama Rekening</label>
                  <input className="form-control" value={form.nama_rekening} onChange={e => setForm({ ...form, nama_rekening: e.target.value })} />
                </div>
              </div>
            </>
          )}

          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '.75rem', marginTop: '.5rem', marginBottom: '.75rem' }}>
            <div style={{ fontSize: '.8rem', fontWeight: 600, marginBottom: '.5rem', color: 'var(--accent)' }}>💰 Menjadi (data Perubahan)</div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Volume</label>
                <input className="form-control" type="number" value={form.volume_menjadi} onChange={e => setForm({ ...form, volume_menjadi: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Satuan</label>
                <input className="form-control" value={form.satuan_menjadi} onChange={e => setForm({ ...form, satuan_menjadi: e.target.value })} placeholder="Paket/Orang/Unit" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Pagu Utama (Rp) *</label>
                <input className="form-control" type="number" value={form.pagu_menjadi} onChange={e => handlePaguChange(e.target.value)} placeholder="0" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">
                  BOP (maks 10%)
                  <span style={{ fontSize: '.7rem', color: 'var(--text2)', fontWeight: 400, marginLeft: '.3rem' }}>
                    maks: {fmtRp(maxBop(Number(form.pagu_menjadi) || 0))}
                  </span>
                </label>
                <input className="form-control" type="number" value={form.pagu_bop_menjadi} onChange={e => handleBopChange(e.target.value)} placeholder="0"
                  style={bopWarn ? { borderColor: 'var(--danger)' } : {}} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Total Menjadi</label>
                <input className="form-control" readOnly value={fmtRp((Number(form.pagu_menjadi) || 0) + (Number(form.pagu_bop_menjadi) || 0))}
                  style={{ fontWeight: 700, color: 'var(--accent)', background: 'var(--bg3)' }} />
              </div>
            </div>
            {bopWarn && <div style={{ color: 'var(--danger)', fontSize: '.78rem', marginTop: '-.3rem' }}>{bopWarn}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Keterangan Perubahan</label>
            <textarea className="form-control" rows={2} value={form.keterangan || ''} onChange={e => setForm({ ...form, keterangan: e.target.value })} placeholder="Alasan/uraian perubahan pagu, volume, dsb." />
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !!bopWarn}>
              {saving ? '⏳ Menyimpan...' : '💾 Simpan'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
