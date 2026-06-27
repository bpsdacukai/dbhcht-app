-- Verifikasi: pastikan security_invoker sudah TRUE untuk v_rekap_realisasi
select
  c.relname as view_name,
  c.reloptions
from pg_class c
where c.relname = 'v_rekap_realisasi';

-- Hasil yang diharapkan: reloptions berisi {security_invoker=true}
-- Jika reloptions kosong/null, jalankan ulang:
--   alter view v_rekap_realisasi set (security_invoker = true);
