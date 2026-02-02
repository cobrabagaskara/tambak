# 📦 Panduan Hosting Installer Page

## **CARA HOSTING INSTALLER:**

### **Option 1: GitHub Pages (GRATIS & Recommended)**
1. Buat file `install.html` di root repo `tambak`
2. Buka **Settings → Pages**
3. Source: `Deploy from a branch`
4. Branch: `main`, folder: `/ (root)`
5. Save → Tunggu 1-2 menit

**URL Installer:** `https://cobrabagaskara.github.io/tambak/install.html`

### **Option 2: Netlify/Vercel (GRATIS)**
1. Drag & drop file `install.html`
2. Dapatkan URL otomatis
3. Bisa pakai custom domain

### **Option 3: Local Server**
1. Buka terminal di folder file `install.html`
2. Jalankan: `python -m http.server 8000`
3. Buka: `http://localhost:8000/install.html`

## **CARA PAKAI INSTALLER PAGE:**

### **Untuk Developer (Anda):**
1. Host file `install.html`
2. Share link ke tim/kolega
3. Mereka tinggal buka link & klik install

### **Untuk End User:**
1. Buka link installer
2. Pastikan Tampermonkey sudah terinstal
3. Klik "INSTAL LOADER SEKARANG"
4. Klik "Install" di popup Tampermonkey
5. Buka epuskesmas.id → selesai!

## **FITUR INSTALLER PAGE:**
✅ Auto-deteksi Tampermonkey  
✅ One-click installation  
✅ QR code untuk mobile  
✅ FAQ & troubleshooting  
✅ Manual install option  
✅ Responsive design  
✅ Multi-browser support  

## **CUSTOMIZATION:**
- Ganti `LOADER_URL` di JavaScript jika URL berubah
- Update versi di header
- Tambah screenshot jika perlu
- Customize warna di CSS

## **TROUBLESHOOTING:**
- Jika instalasi gagal, user bisa pakai "Manual Installation"
- Pastikan Tampermonkey extension aktif
- Refresh halaman setelah instalasi
- Cek Console untuk error (F12)
