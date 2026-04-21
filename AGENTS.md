# AGENTS.md

## Project Overview
Kelola Tugas adalah aplikasi React + Supabase untuk manajemen tugas staf.

Modul tambahan: **Modul Anggaran**
Tujuan: kontrol penyerapan anggaran (bukan sistem keuangan penuh).

---

## Core Architecture Rules (CRITICAL)

Agent WAJIB mengikuti aturan ini:

- Modul anggaran TIDAK terhubung langsung ke task
- Integrasi hanya pada level **Sub Kegiatan**
- **Sub Kegiatan adalah pusat data anggaran**
- Nilai anggaran hanya boleh di **Belanja Level 5 (leaf)**
- Tidak boleh ada nilai di level lain
- RAK:
  - berbasis versi
  - immutable (tidak overwrite)
- Monitoring berbasis **bulanan**

Jika melanggar → STOP dan beri warning.

---

## Development Scope

Fitur modul anggaran:
- Master Data
- RAK (versioning)
- Realisasi
- Saldo
- Tracking
- Dashboard

Pengembangan dilakukan bertahap. Fokus saat ini:

> MASTER DATA

Jangan kerjakan fitur lain tanpa instruksi.

---

## Database Conventions

Naming:
- tabel: fin_*
- view: fin_v_*
- function: fin_*

Rules:
- budget_account harus:
  - active
  - leaf
  - level 5
- unique (rak_sub_activity_id, budget_account_id)
- rak_version_id konsisten via sub_activity

---

## Coding Guidelines

React:
- functional components
- hooks
- pisahkan UI dan data logic

Supabase:
- gunakan view
- hindari duplikasi SQL di frontend

General:
- TypeScript
- simple > complex

---

## Agent Workflow

1. Baca konteks
2. Analisa struktur
3. Validasi terhadap rules
4. Identifikasi gap
5. Perbaikan minimal
6. Implementasi

---

## Output Format

1. Pemahaman
2. Asumsi
3. Analisis
4. Solusi
5. Kode
6. Risiko

---

## Forbidden

- Hubungkan task ke anggaran
- Simpan nilai selain level 5
- Hapus histori
- Hilangkan versioning
- Overengineering

---

## Preferred Approach

- Minimal change
- Gunakan constraint DB
- Konsistensi

---

## Testing

- gunakan transaction
- buat smoke test:
  - valid → sukses
  - invalid → gagal

---

## Notes

- Repo sudah ada struktur
- Jangan redesign
- Tanya jika ragu
