## Table Font Styling Standard (Acuan Saat Ini)

Konsep: clean, minimalis, tegas, dan terbaca. Fokusnya konsistensi lintas halaman supaya tabel mudah di-scan tanpa terlihat "berat".

### Prinsip
- Maksimal font weight `600` (hindari `700/800` untuk tabel).
- Hierarki dibentuk oleh `size + color`, bukan ketebalan berlebihan.
- Jangan hardcode `fontFamily` di komponen; gunakan token/helper.
- `th` selalu uppercase (sudah ada di CSS global).

### Source Of Truth (Sudah Ada di Repo)
- Tokens: `src/index.css` (bagian `Typography Scale for Tables`).
- Helpers + style builders: `src/lib/controlStyles.js`.

### Tokens (CSS Variables)
Lokasi: `src/index.css`.

| Token | Default | Dipakai Untuk |
|------|---------|---------------|
| `--table-font-family` | `"Inter", sans-serif` | Font family tabel |
| `--table-header-font-size` | `12px` | Ukuran header |
| `--table-header-font-weight` | `500` | Weight header |
| `--table-header-letter-spacing` | `0.3px` | Tracking huruf header |
| `--table-body-font-size` | `13px` | Ukuran body |
| `--table-body-font-weight` | `400` | Weight body |
| `--table-body-line-height` | `1.45` | Line height body |
| `--table-cell-label-font-size` | `14px` | Label/title di cell |
| `--table-cell-label-font-weight` | `600` | Weight label/title |
| `--table-cell-subtitle-font-size` | `13px` | Subtitle/context di cell |
| `--table-cell-subtitle-font-weight` | `400` | Weight subtitle |
| `--table-cell-compact-font-size` | `12px` | Mode compact |
| `--table-cell-compact-font-weight` | `500` | Weight compact |
| `--table-col-task-width-mode2` | `clamp(350px, 42vw, 520px)` | Lebar kolom "Sub Task / Task" (mode kolom sedikit) |
| `--table-col-task-min-width-mode3` | `350px` | Lebar minimum kolom primary (mode tabel padat) |
| `--table-col-task-width-mode3` | `clamp(280px, 34vw, 420px)` | Lebar kolom "Sub Task / Task" (mode tabel padat) |

Catatan: warna untuk tabel mengacu ke tokens `--text-h`, `--text-muted`, serta header table tokens `--table-header-bg`, `--table-header-color`, `--table-header-border`.

### Helpers (Typography)
Lokasi: `src/lib/controlStyles.js`.

| Helper | Default | Kapan Dipakai |
|--------|---------|---------------|
| `getTableHeaderTypography()` | `12/500`, `var(--text-muted)`, uppercase | Judul kecil/label section bernuansa tabel |
| `getTableBodyTypography()` | `13/400`, `var(--text-h)` | Isi teks tabel yang "normal" |
| `getTableCellLabelTypography()` | `14/600`, `var(--text-h)` | Nama task / judul utama dalam cell |
| `getTableCellSubtitleTypography()` | `13/400`, `var(--text-muted)` | Keterangan tambahan (sub-kegiatan, meta) |
| `getTableCellCompactTypography()` | `12/500`, `var(--text-h)` | Data padat, kolom angka, tombol kecil |

### Builders (Header/Body Cell Style)
Lokasi: `src/lib/controlStyles.js`.

| Builder | Default | Catatan |
|---------|---------|---------|
| `getTableHeaderCellStyle()` | `12/500`, uppercase, padding `14px 14px` | Gunakan untuk `th`. Ada `alignMode` + `label` |
| `getTableBodyCellStyle()` | `14px` line-height `1.45`, padding `16px 14px` | Gunakan untuk `td` (spacing + border) |

### Aturan Pemakaian (Yang Disarankan)
Header (`th`):
```jsx
<th
  style={{
    ...getTableHeaderCellStyle({ alignMode: tableHeaderAlignMode, label }),
    whiteSpace: "nowrap",
  }}
>
  {label}
</th>
```

Body (`td`) + konten label/subtitle:
```jsx
<td style={getTableBodyCellStyle()}>
  <div style={getTableCellLabelTypography()}>{title}</div>
  <div style={{ ...getTableCellSubtitleTypography(), marginTop: 4 }}>
    {subtitle}
  </div>
</td>
```

Kolom padat / meta / tombol kecil:
```jsx
<div style={getTableCellCompactTypography()}>{value}</div>
```

### Special Cases (Boleh, Tapi Disengaja)
- Timeline "day header" yang sangat padat: `11px/400` boleh, tapi konsisten dan dibatasi hanya untuk header kalender harian.
- Kolom angka: boleh `textAlign: "right"` + `getTableCellCompactTypography({ fontWeight: 600 })` jika perlu emphasis.
- Jangan mix `800` untuk tabel (kecuali benar-benar ada alasan kuat).

### Mode Lebar + Trunc Kolom "Sub Task / Task" (Standar Global)
Lokasi helper: `src/lib/controlStyles.js`.
Lokasi class CSS: `src/index.css`.

- Mode 1 (default): tanpa `maxWidth` kolom 1, judul ditrunc `100` karakter via `getCompactText(value, 100)`.
- Mode 2: max width `--table-col-task-width-mode2`, judul di-clamp `2` baris (desktop) dan `3` baris (mobile) via class `table-line-clamp table-line-clamp--mode2`.
- Mode 3: min width `--table-col-task-min-width-mode3`, max width `--table-col-task-width-mode3`, clamp `3` baris (desktop & mobile) via class `table-line-clamp table-line-clamp--mode3`.

### Checklist Review (Saat Menyentuh Halaman Tabel)
- Header pakai `getTableHeaderCellStyle()` (bukan font inline manual).
- Body cell pakai `getTableBodyCellStyle()` untuk padding/border.
- Title dalam cell pakai `getTableCellLabelTypography()`.
- Subtitle/context pakai `getTableCellSubtitleTypography()`.
- Compact/meta pakai `getTableCellCompactTypography()`.
- Tidak ada hardcode `fontFamily: '"Inter"...` di komponen tabel.
