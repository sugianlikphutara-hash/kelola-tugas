# 📘 Desain Modul Anggaran (Final)

Dokumen ini berisi struktur desain database dan arsitektur modul Anggaran berdasarkan diskusi dan kesepakatan.

---

# 🎯 Tujuan Modul
Modul anggaran digunakan untuk:
- Mengelola RAK (Rencana Anggaran Kas) berbasis versi
- Mencatat realisasi anggaran
- Menghitung saldo dan serapan
- Menyediakan data untuk dashboard dan tracking

---

# 🧩 Struktur Halaman Aplikasi

## 1. Master Data
- Master belanja (lv1–lv5)
- Master versi RAK
- Master status

## 2. Halaman Anggaran
- Rencana
- Realisasi
- Saldo

## 3. Dashboard
- Grafik
- Ringkasan
- Insight

## 4. Tracking
- Tracking Tugas
- Tracking Masalah
- Tracking Anggaran:
  - Perubahan RAK
  - Deviasi
  - Warning
  - Progress

---

# 🏷️ Standar Penamaan

Semua tabel anggaran menggunakan prefix:

- `fin_` → tabel utama
- `fin_v_` → view
- `fin_mv_` → materialized view (opsional)

---

# 🧱 STRUKTUR TABEL

---

## 🔹 MASTER DATA

### 1. fin_budget_levels
Level hirarki belanja (lv1–lv5)

---

### 2. fin_budget_accounts
Struktur belanja dari DPA (hirarki)

Contoh:
- 5.1
- 5.1.02
- ...
- 5.1.02.01.001.00004 (lv5)

Field utama:
- parent_id
- level
- code
- name
- is_leaf

---

### 3. fin_sub_activity_rak_statuses
Status sub kegiatan:
- Tetap
- Berubah
- Dihapus
- Baru

---

### 4. fin_budget_item_change_statuses
Status perubahan item belanja:
- Tetap
- Berubah
- Dihapus
- Baru

---

## 🔹 VERSIONING RAK

### 5. fin_rak_versions
Header versi RAK

Field utama:
- fiscal_year_id
- code (RAK-YYYYMMDD)
- previous_rak_version_id
- status
- is_active

📌 Aturan:
- 1 tahun = banyak versi
- hanya 1 versi aktif

---

### 6. fin_rak_sub_activities
Sub kegiatan dalam versi RAK

Field utama:
- rak_version_id
- sub_activity_id
- status (Tetap/Baru/Dihapus/dll)

---

## 🔹 RENCANA ANGGARAN

### 7. fin_rak_budget_items
Detail anggaran per:
- versi RAK
- sub kegiatan
- belanja lv5

Field utama:
- annual_amount
- jan_amount ... dec_amount

📌 Catatan:
- nilai hanya di lv5
- triwulan & semester dihitung (tidak disimpan)

---

### 8. fin_rak_budget_item_details *(opsional)*
Detail dari DPA:
- volume
- satuan
- harga
- spesifikasi

---

## 🔹 REALISASI

### 9. fin_budget_realizations

Field utama:
- fiscal_year_id
- sub_activity_id
- budget_account_id (lv5)
- realization_date
- period_month
- amount

📌 Aturan:
- realisasi = data faktual
- tidak berubah saat RAK berubah
- dibandingkan dengan RAK aktif

---

### 10. fin_budget_realization_statuses *(opsional)*
Untuk approval:
- Draft
- Diajukan
- Disetujui
- Ditolak

---

# 📊 VIEW HALAMAN ANGGARAN

---

### 11. fin_v_rak_sub_activity_summary
Ringkasan RAK per sub kegiatan

---

### 12. fin_v_rak_budget_item_summary
Detail item belanja lv5 per sub kegiatan

---

### 13. fin_v_budget_realization_summary
Rekap realisasi:
- per bulan
- kumulatif
- triwulan
- semester

---

### 14. fin_v_budget_balance_summary
Saldo berbasis RAK aktif

Field:
- plan
- realization
- balance
- absorption %
- deviation

---

# 📈 VIEW TRACKING ANGGARAN

---

### 15. fin_v_tracking_rak_changes
Perbandingan 2 versi RAK

---

### 16. fin_v_tracking_budget_deviations
Deviasi rencana vs realisasi

---

### 17. fin_v_tracking_budget_warnings
Daftar masalah:
- Over budget
- Belum realisasi
- Deviasi tinggi
- Dihapus tapi ada transaksi

---

### 18. fin_v_tracking_budget_progress
Progress serapan

---

# 🔗 RELASI UTAMA

- fiscal_years → fin_rak_versions
- sub_activities → fin_rak_sub_activities
- fin_rak_versions → fin_rak_budget_items
- fin_budget_accounts → fin_rak_budget_items
- fin_budget_realizations → dibandingkan dengan RAK aktif

---

# 🔄 ALUR DATA

1. Input master belanja (DPA)
2. Buat RAK awal
3. Revisi RAK → versi baru (snapshot)
4. Input realisasi
5. Sistem:
   - bandingkan dengan RAK aktif
   - hitung saldo & deviasi
6. Dashboard & Tracking membaca dari view

---

# ⚙️ STRATEGI IMPLEMENTASI

## Tahap 1 (Wajib)
- fin_budget_accounts
- fin_rak_versions
- fin_rak_sub_activities
- fin_rak_budget_items
- fin_budget_realizations

## Tahap 2
- view summary
- view saldo

## Tahap 3
- view tracking

## Tahap 4
- detail DPA (opsional)

---

# 🔒 ATURAN BISNIS UTAMA

- RAK bersifat versioned
- Snapshot penuh setiap revisi
- Nilai hanya di lv5
- Realisasi tidak berubah
- Evaluasi selalu pakai RAK aktif
- Item dihapus:
  - tanpa realisasi → 0
  - dengan realisasi → ≥ realisasi

---

# ✅ KESIMPULAN

Struktur ini mendukung:
- multi versi RAK
- histori lengkap
- tracking perubahan
- analisis realisasi
- dashboard dan monitoring

---


