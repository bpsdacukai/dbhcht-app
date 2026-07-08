// ── BIDANG DBH CHT ────────────────────────────────────────────
export const BIDANG = [
  { id:'kesmas',    label:'Bidang Kesejahteraan Masyarakat', short:'Kesej. Masyarakat', icon:'🌿', color:'#2d6a4f', pct:50 },
  { id:'kesehatan', label:'Bidang Kesehatan',                short:'Kesehatan',          icon:'🏥', color:'#1e6091', pct:40 },
  { id:'hukum',     label:'Bidang Penegakan Hukum',          short:'Penegakan Hukum',    icon:'⚖️', color:'#7b2d00', pct:10 },
]
export const KOORDINASI = {
  id:'koordinasi', label:'Kegiatan Koordinasi Pengelolaan DBH CHT',
  short:'Koordinasi DBH CHT', icon:'📋', color:'#5f4b1a', isKoordinasi:true,
}
export const SEMUA_BIDANG = [...BIDANG, KOORDINASI]
export const TAHUN_LIST = [2025, 2026, 2027, 2028, 2029, 2030]

// ── PROGRAM PER BIDANG ────────────────────────────────────────
// Kegiatan Koordinasi & Kegiatan Pendukung ditambahkan ke semua bidang
// agar bisa dipilih di form Asistensi/Rekonsiliasi tanpa batasan bidang
export const PROGRAM_BY_BIDANG = {
  kesmas: [
    'Program Peningkatan Kualitas Bahan Baku',
    'Program Pembinaan Industri',
    'Program Pembinaan Lingkungan Sosial',
    'Kegiatan Koordinasi Pengelolaan DBH CHT',
    'Kegiatan Pendukung Pengelolaan DBH CHT',
  ],
  kesehatan: [
    'Pelayanan Kesehatan Promotif/Preventif/Kuratif',
    'Penyediaan/Peningkatan Sarana/Prasarana Fasilitas Kesehatan',
    'Penyediaan Sarana Sanitasi, Pengelolaan Limbah & Air Bersih',
    'Pembayaran Iuran Jaminan Kesehatan',
    'Kegiatan Koordinasi Pengelolaan DBH CHT',
    'Kegiatan Pendukung Pengelolaan DBH CHT',
  ],
  hukum: [
    'Program Pembinaan Industri',
    'Program Sosialisasi Ketentuan di Bidang Cukai',
    'Program Pemberantasan BKC Ilegal',
    'Kegiatan Koordinasi Pengelolaan DBH CHT',
    'Kegiatan Pendukung Pengelolaan DBH CHT',
  ],
  koordinasi: [
    'Kegiatan Koordinasi Pengelolaan DBH CHT',
    'Kegiatan Pendukung Pengelolaan DBH CHT',
  ],
  // Untuk form Asistensi: gabungan semua program + koordinasi
  all: [
    'Program Peningkatan Kualitas Bahan Baku',
    'Program Pembinaan Industri',
    'Program Pembinaan Lingkungan Sosial',
    'Pelayanan Kesehatan Promotif/Preventif/Kuratif',
    'Penyediaan/Peningkatan Sarana/Prasarana Fasilitas Kesehatan',
    'Penyediaan Sarana Sanitasi, Pengelolaan Limbah & Air Bersih',
    'Pembayaran Iuran Jaminan Kesehatan',
    'Program Sosialisasi Ketentuan di Bidang Cukai',
    'Program Pemberantasan BKC Ilegal',
    'Kegiatan Koordinasi Pengelolaan DBH CHT',
    'Kegiatan Pendukung Pengelolaan DBH CHT',
  ],
}

export const SUB_KEGIATAN_KOORDINASI = [
  'Koordinasi, Sinkronisasi dan Evaluasi Kebijakan Pertanian, Kehutanan, Kelautan, dan Perikanan',
  'Koordinasi, Fasilitasi, Asistensi, Sinkronisasi, Supervisi, Monitoring dan Evaluasi Pengelolaan Dana Perimbangan dan Dana Transfer Lainnya',
  'Penyusunan RKP DBH CHT',
  'Monitoring dan Evaluasi Penggunaan DBH CHT',
  'Pelaporan Penggunaan DBH CHT',
  'Administrasi dan Dukungan Operasional Tim Koordinasi',
]

export const KODE_REKENING_BY_BIDANG = {
  kesmas: [
    { kode:'3.27.07.2.01.0002', nama:'Pengembangan Kapasitas Kelembagaan Petani di Kecamatan dan Desa' },
    { kode:'3.27.07.2.01.0009', nama:'Diseminasi Informasi Teknis, Sosial, Ekonomi dan Inovasi Pertanian' },
    { kode:'3.27.05.2.01.0001', nama:'Pengendalian Organisme Pengganggu Tumbuhan (OPT)' },
    { kode:'3.27.03.2.01.0003', nama:'Koordinasi dan Sinkronisasi Prasarana Pendukung Pertanian Lainnya' },
    { kode:'3.27.03.2.01.0007', nama:'Pengendalian dan Pemanfaatan Prasarana Pascapanen Perkebunan' },
    { kode:'3.27.03.2.01.0010', nama:'Peningkatan Pascapanen dan Pengolahan Hasil Perkebunan' },
    { kode:'3.27.03.2.02.0009', nama:'Pembangunan, Rehabilitasi dan Pemeliharaan Prasarana Pertanian Lainnya' },
    { kode:'3.27.02.2.01.0001', nama:'Pengawasan Penggunaan Sarana Pendukung Pertanian' },
    { kode:'3.27.02.2.01.0002', nama:'Pendampingan Penggunaan Sarana Pendukung Pertanian' },
    { kode:'3.27.02.2.01.0008', nama:'Perbanyakan Benih Bersertifikat Perkebunan Berbentuk Batang' },
    { kode:'3.27.02.2.02.0002', nama:'Peningkatan Kualitas SDG Hewan/Tanaman' },
    { kode:'3.27.02.2.02.0004', nama:'Penjaminan Kemurnian dan Kelestarian SDG Tanaman' },
    { kode:'3.31.02.2.01.0004', nama:'Koordinasi, Sinkronisasi, Pembangunan Sarana dan Prasarana Industri' },
    { kode:'3.31.02.2.01.0005', nama:'Koordinasi, Sinkronisasi, Pemberdayaan Industri dan Peran Serta Masyarakat' },
    { kode:'1.06.05.2.02.0006', nama:'Fasilitasi Bantuan Sosial Kesejahteraan Keluarga' },
    { kode:'2.07.03.2.01.0001', nama:'Proses Pelaksanaan Pendidikan dan Pelatihan Keterampilan bagi Pencari Kerja' },
    { kode:'2.07.05.2.02.0005', nama:'Pengembangan Pelaksanaan Jaminan Sosial Tenaga Kerja' },
    { kode:'2.17.07.2.01.0015', nama:'Peningkatan Pemahaman dan Pengetahuan UMKM serta Kapasitas SDM UMKM' },
    { kode:'3.27.03.2.02.0002', nama:'Pembangunan, Rehabilitasi dan Pemeliharaan Embung Pertanian' },
    { kode:'1.03.02.2.01.0089', nama:'Operasi dan Pemeliharaan Embung dan Penampung Lainnya' },
    { kode:'1.03.10.2.01.0051', nama:'Pemeliharaan Rutin Jalan' },
    { kode:'1.03.10.2.01.0053', nama:'Pembangunan Jalan' },
    { kode:'1.03.10.2.01.0055', nama:'Rehabilitasi Jalan' },
  ],
  kesehatan: [
    { kode:'1.02.02.2.02.0043', nama:'Pengelolaan Kawasan Tanpa Rokok' },
    { kode:'1.02.05.2.02.0001', nama:'Penyelenggaraan Promosi Kesehatan dan Perilaku Hidup Bersih dan Sehat' },
    { kode:'1.02.02.2.02.0015', nama:'Pengelolaan Pelayanan Kesehatan Gizi Masyarakat' },
    { kode:'1.02.02.2.02.0001', nama:'Pengelolaan Pelayanan Kesehatan Ibu Hamil' },
    { kode:'1.02.02.2.02.0002', nama:'Pengelolaan Pelayanan Kesehatan Ibu Bersalin' },
    { kode:'1.02.02.2.02.0003', nama:'Pengelolaan Pelayanan Kesehatan Bayi Baru Lahir' },
    { kode:'1.02.02.2.02.0004', nama:'Pengelolaan Pelayanan Kesehatan Balita' },
    { kode:'1.02.02.2.02.0025', nama:'Pelayanan Kesehatan Penyakit Menular dan Tidak Menular' },
    { kode:'1.02.02.2.02.0026', nama:'Pengelolaan Jaminan Kesehatan Masyarakat' },
    { kode:'1.02.02.2.02.0048', nama:'Pengelolaan Layanan Imunisasi' },
    { kode:'1.02.02.2.01.0014', nama:'Pengadaan Alat Kesehatan/Alat Penunjang Medik' },
    { kode:'1.02.02.2.01.0023', nama:'Pengadaan Obat, Bahan Habis Pakai, Vaksin' },
    { kode:'1.02.02.2.01.0006', nama:'Pengembangan Puskesmas' },
    { kode:'1.02.02.2.01.0022', nama:'Pengembangan Rumah Sakit' },
    { kode:'1.02.03.2.03.0001', nama:'Pengembangan Mutu dan Peningkatan Kompetensi Teknis SDM Kesehatan' },
    { kode:'1.02.05.2.01.0001', nama:'Peningkatan Upaya Promosi Kesehatan, Advokasi, Kemitraan dan Pemberdayaan Masyarakat' },
  ],
  hukum: [
    { kode:'1.05.02.2.01.0023', nama:'Penyediaan Layanan Informasi dalam Penyelenggaraan Ketentraman dan Ketertiban Umum' },
    { kode:'2.16.02.2.01.0021', nama:'Pengelolaan Media Komunikasi Publik' },
    { kode:'2.16.02.2.01.0023', nama:'Penyusunan Konten' },
    { kode:'1.05.02.2.01.0022', nama:'Penyusunan Peta Rawan Gangguan Ketentraman dan Ketertiban Umum' },
    { kode:'1.05.02.2.01.0006', nama:'Kerja Sama antar Lembaga dalam Teknik Pencegahan Gangguan Ketentraman' },
    { kode:'1.05.02.2.02.0006', nama:'Pengadaan dan Pemeliharaan Sarana Prasarana Penegakan Peraturan Daerah' },
    { kode:'1.05.02.2.01.0025', nama:'Peningkatan Kapasitas SDM Satuan Polisi Pamong Praja' },
    { kode:'3.31.02.2.01.0004', nama:'Koordinasi, Sinkronisasi, dan Pelaksanaan Pembangunan Sarana dan Prasarana Industri' },
  ],
  koordinasi: [
    { kode:'4.01.03.2.04.0001', nama:'Koordinasi, Sinkronisasi dan Evaluasi Kebijakan Pertanian, Kehutanan, Kelautan, dan Perikanan' },
    { kode:'5.02.02.2.02.0005', nama:'Koordinasi, Fasilitasi, Asistensi, Sinkronisasi, Supervisi, Monitoring dan Evaluasi Pengelolaan Dana Perimbangan dan Dana Transfer Lainnya' },
  ],
}

export const KODE_REKENING_KOORDINASI = KODE_REKENING_BY_BIDANG.koordinasi

export const fmt    = (n) => new Intl.NumberFormat('id-ID').format(Math.round(n||0))
export const fmtRp  = (n) => 'Rp '+fmt(n)
export const fmtPct = (n) => (n||0).toFixed(1)+'%'
export const today  = () => new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})
export const maxBop = (paguUtama) => Math.floor((Number(paguUtama)||0)*0.1)
