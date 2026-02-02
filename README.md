# Tampermonkey Module Converter

Web tool untuk mengkonversi script Tampermonkey ke format modular Skrining Auto.

## Fitur
- Upload file `.user.js`
- Extract metadata otomatis
- Generate `script.js` dan `meta.json`
- Copy manifest entry untuk `global-manifest.json`
- Drag & drop support

## Cara Hosting di GitHub Pages

1. Buat file `converter.html` di root repository
2. Buka repository Settings → Pages
3. Pilih source: `Deploy from a branch`
4. Pilih branch: `main` dan folder: `/ (root)`
5. Save

URL akan tersedia di: `https://cobrabagaskara.github.io/tambak/converter.html`

## Cara Penggunaan

1. Buka web converter
2. Upload file Tampermonkey (.user.js)
3. Review dan edit metadata jika perlu
4. Download `script.js` dan `meta.json`
5. Copy manifest entry
6. Upload ke GitHub:
   - `script.js` dan `meta.json` ke `/modules/module-id/`
   - Tambah entry ke `global-manifest.json`
