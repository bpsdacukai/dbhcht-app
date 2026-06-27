-- ════════════════════════════════════════════════════════════════
-- FIX: Security Definer View warning pada v_rekap_realisasi
-- Tujuan: agar view mematuhi RLS (Row Level Security) milik user yang
-- query, BUKAN RLS milik pembuat view. Tanpa ini, OPD yang seharusnya
-- hanya boleh lihat datanya sendiri berisiko bisa melihat semua data
-- lewat view ini.
-- ════════════════════════════════════════════════════════════════

alter view v_rekap_realisasi set (security_invoker = true);
