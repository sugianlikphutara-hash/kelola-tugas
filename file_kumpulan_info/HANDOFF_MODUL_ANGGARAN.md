# Handoff Modul Anggaran

## Tujuan
- Modul anggaran untuk kontrol penyerapan anggaran, bukan modul keuangan penuh.
- Fokus saat ini: pondasi data master, belum UI anggaran penuh.

## Prinsip Bisnis Final
- Pusat struktur anggaran adalah `Sub Kegiatan`.
- Nilai anggaran hanya ada di `Belanja Level 5`.
- Task tidak boleh terhubung langsung ke item anggaran.
- Modul anggaran berdiri sendiri, bertemu modul tugas hanya di level `Sub Kegiatan`.
- Struktur harus mendukung `RAK versioning`.
- Tidak semua `Sub Kegiatan` wajib masuk RAK.
- Contoh: `SUB-05` adalah sub kegiatan operasional/insidental dan tidak masuk RAK karena tidak punya anggaran.

## Yang Sudah Selesai
- Guardrail schema sudah dipasang di database:
  - `fin_rak_versions.is_active` harus konsisten dengan `status = 'ACTIVE'`
  - `fin_budget_realizations.period_month` harus cocok dengan bulan `realization_date`
  - `fin_rak_budget_items.budget_account_id` hanya boleh akun aktif, leaf, level 5
  - `fin_rak_budget_items.rak_version_id` diselaraskan dari `rak_sub_activity_id`
- Hirarki akun `fin_budget_accounts.parent_id` sudah dibackfill dan tervalidasi benar.
- Dokumentasi utama sudah diperbarui di `panduan_modul_anggaran.md`.

## Migration Lokal yang Sudah Dibuat
- `supabase/migrations/20260420_harden_budget_master_schema.sql`
- `supabase/migrations/20260420_backfill_budget_account_parent_id.sql`

## Hasil Review Data yang Sudah Terkonfirmasi
- Hirarki `program -> activity -> sub_activity` konsisten.
- `fin_budget_levels` dan `fin_budget_accounts` konsisten dengan aturan level 1 sampai 5.
- `fin_rak_sub_activities` dan `fin_rak_budget_items` konsisten dengan aturan bisnis.
- `fin_v_rak_sub_activity_summary` dan `fin_v_rak_budget_item_summary` sudah sejalan dengan data yang ada.
- `fin_v_budget_realization_summary` dan `fin_v_budget_balance_summary` sudah membaca data nyata dengan wajar untuk kasus yang ada.

## Keputusan Penting untuk Warning
- `REALIZATION_WITHOUT_PLAN` tetap diperlukan sebagai warning terpisah.
- Logika yang diinginkan user sederhana:
  - bandingkan `plan` bulanan vs `realisasi` bulanan
  - jika `plan_bulan = 0` dan `realisasi_bulan > 0`
  - maka `warning_type = 'REALIZATION_WITHOUT_PLAN'`
- Jangan dibuat terlalu rumit.
- Pendekatan kerja yang diinginkan:
  - pengujian sederhana dulu
  - bangun aplikasi
  - lihat kekurangan
  - perbaiki
  - lanjutkan

## Status View Khusus Warning
- View `public.fin_v_tracking_realization_without_plan` sudah dibuat di STAGING.
- Pengujian dummy untuk view itu belum tuntas karena data STAGING yang dipakai saat itu tidak siap / target query kosong.
- Belum ada bukti final bahwa logika view salah; blocker terakhir ada pada kesiapan data uji STAGING.

## Aturan Kerja untuk Agent Berikutnya
- Sebelum meminta user menjalankan SQL, selalu tulis jelas: `STAGING` atau `PRODUCTION`.
- `INSERT`, `UPDATE`, `DELETE` untuk pengujian hanya di `STAGING`.
- Jangan memperpanjang eksplorasi jika prasyarat data tidak ada.
- Fokus ke solusi sederhana yang cukup, bukan arsitektur berat.
- Gaya kerja yang diminta user:
  - langsung ke inti
  - tidak muter-muter
  - simple core, smart finish

## Langkah Lanjut yang Paling Aman
- Jangan mulai dari nol.
- Baca file ini dulu.
- Lanjutkan dari masalah sederhana: warning bulanan `REALIZATION_WITHOUT_PLAN`.
- Jika ingin menguji lagi, siapkan dulu data STAGING yang benar-benar ada sebelum menulis query dummy.
