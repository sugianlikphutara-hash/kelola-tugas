# 📘 Panduan Pembangunan Modul Anggaran

## 1. Gambaran Umum
Modul terdiri dari:
- Master Data
- Halaman Anggaran (Rencana, Realisasi, Saldo)
- Tracking
- Dashboard

## 2. Master Data
- Program → Kegiatan → Sub Kegiatan
- Belanja sampai Level 5 (nilai di sini)

## 3. RAK
- Versi tahunan (RAK-YYYYMMDD)
- Snapshot penuh
- Bisa direvisi (tidak overwrite)

## 4. Halaman Anggaran
### Rencana
- Tabel: Sub kegiatan + total
- Detail: lv5 + bulan

### Realisasi
- Tabel: Plan, Realisasi, Saldo
- Detail: lv5 + per bulan

### Saldo
- Sisa anggaran

## 5. Tracking
### Deviasi
- OVERSPEND / UNDERSPEND

### Warning
- NO_REALIZATION

### Progress
- % serapan

## 6. Dashboard
- Grafik serapan
- Perbandingan

## 7. Prinsip
- Data tidak dihapus
- Deviasi bukan error
- Tracking berbasis bulan

## 8. Status Master Data Saat Ini
- Struktur pusat anggaran tetap di `Sub Kegiatan`
- Nilai anggaran rencana disimpan di item belanja `Level 5`
- Modul anggaran tidak menghubungkan task langsung ke item anggaran
- Pondasi versioning RAK sudah ada dan siap dipakai untuk tahap berikutnya

## 9. Guardrail Schema yang Sudah Aktif
- `fin_rak_versions.is_active` harus konsisten dengan `status = 'ACTIVE'`
- `fin_budget_realizations.period_month` harus sesuai dengan bulan pada `realization_date`
- `fin_rak_budget_items.budget_account_id` hanya boleh mengarah ke akun yang aktif, leaf, dan `Level 5`
- `fin_rak_budget_items.rak_version_id` otomatis diselaraskan dari `rak_sub_activity_id`

## 10. Dampak ke Workflow Aplikasi
- Tidak mengubah logic UI atau alur halaman yang sudah berjalan
- Tidak mengubah hubungan task yang sudah ada di aplikasi utama
- Perubahan hanya memperketat integritas data di level database
- Input yang tidak sesuai aturan bisnis sekarang akan ditolak lebih awal oleh schema

## 11. Catatan Penting Sub Kegiatan
- Tidak semua `Sub Kegiatan` wajib masuk ke modul anggaran
- Hanya `Sub Kegiatan` yang direncanakan dan memiliki anggaran yang masuk ke `fin_rak_sub_activities`
- `Sub Kegiatan` insidental atau non-anggaran tetap boleh ada di aplikasi utama, tetapi tidak perlu muncul di RAK
- Contoh kasus: `SUB-05` valid sebagai sub kegiatan operasional, namun tidak masuk RAK karena tidak memiliki penganggaran
