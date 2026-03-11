(function () {
  'use strict';

  // Hanya aktif di halaman LIST (bukan /edit/)
  if (location.pathname.includes('/edit')) return;

  // Hanya aktif jika URL punya parameter status_bayar=BELUM
  const params = new URLSearchParams(location.search);
  if (params.get('status_bayar') !== 'BELUM') return;

  // ─── UTILITAS ──────────────────────────────────────────────
  const tidur = ms => new Promise(r => setTimeout(r, ms));

  function ambilBarisPertama() {
    const tbody = document.querySelector('table.datatable tbody');
    if (!tbody) return null;
    const baris = [...tbody.querySelectorAll('tr')]
      .filter(tr => tr.querySelectorAll('td').length >= 5);
    return baris[0] || null;
  }

  function ambilNamaPasien(tr) {
    return tr.querySelector('td:nth-child(7)')?.textContent?.trim() || '?';
  }

  function hitungSisaBaris() {
    const tbody = document.querySelector('table.datatable tbody');
    if (!tbody) return 0;
    return [...tbody.querySelectorAll('tr')]
      .filter(tr => tr.querySelectorAll('td').length >= 5).length;
  }

  // ─── INJECT FONT & STYLE ───────────────────────────────────
  const font = document.createElement('link');
  font.rel   = 'stylesheet';
  font.href  = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap';
  document.head.appendChild(font);

  const style = document.createElement('style');
  style.textContent = `
    #epus-autoklik {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      width: 220px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,.5);
      font-family: 'IBM Plex Mono', monospace;
      overflow: hidden;
    }
    #epus-autoklik-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      font-size: 11px;
      font-weight: 600;
      color: #f0883e;
      letter-spacing: 1.5px;
    }
    #epus-autoklik-toggle {
      background: none;
      border: 1px solid #30363d;
      color: #8b949e;
      width: 20px; height: 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0;
      display: flex; align-items: center; justify-content: center;
    }
    #epus-autoklik-toggle:hover { color: #fff; border-color: #8b949e; }
    #epus-autoklik-body {
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #epus-autoklik-body.collapsed { display: none; }
    #epus-autoklik-info {
      font-size: 11px;
      color: #e6edf3;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 8px 10px;
      line-height: 1.6;
    }
    #epus-autoklik-info span {
      display: block;
      color: #8b949e;
      font-size: 9px;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    #epus-autoklik-btn {
      width: 100%;
      padding: 9px;
      background: #9e6a03;
      border: none;
      border-radius: 6px;
      color: #fff;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2px;
      cursor: pointer;
      transition: background .15s, transform .1s;
    }
    #epus-autoklik-btn:hover:not(:disabled)  { background: #d29922; }
    #epus-autoklik-btn:active:not(:disabled) { transform: scale(.97); }
    #epus-autoklik-btn.batal  { background: #b91c1c; }
    #epus-autoklik-btn.batal:hover { background: #dc2626; }
    #epus-autoklik-btn:disabled {
      background: #21262d; color: #8b949e; cursor: not-allowed;
    }
    #epus-autoklik-status {
      font-size: 10px;
      color: #8b949e;
      line-height: 1.5;
      min-height: 14px;
    }
    #epus-autoklik-status.run  { color: #d29922; }
    #epus-autoklik-status.ok   { color: #3fb950; }
    #epus-autoklik-status.err  { color: #f85149; }
  `;
  document.head.appendChild(style);

  // ─── BUAT PANEL ────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id    = 'epus-autoklik';
  panel.innerHTML = `
    <div id="epus-autoklik-header">
      <span>⚕ AUTO KLIK</span>
      <button id="epus-autoklik-toggle">−</button>
    </div>
    <div id="epus-autoklik-body">
      <div id="epus-autoklik-info">
        <span>SISA ANTRIAN</span>
        <span id="epus-sisa">Menghitung...</span>
      </div>
      <button id="epus-autoklik-btn" disabled>BATAL</button>
      <div id="epus-autoklik-status" class="run">⏳ Memuat tabel...</div>
    </div>
  `;
  document.body.appendChild(panel);

  // Toggle
  document.getElementById('epus-autoklik-toggle').addEventListener('click', () => {
    const body = document.getElementById('epus-autoklik-body');
    const col  = body.classList.toggle('collapsed');
    document.getElementById('epus-autoklik-toggle').textContent = col ? '+' : '−';
  });

  function setStatus(msg, tipe = '') {
    const el = document.getElementById('epus-autoklik-status');
    el.className = tipe;
    el.textContent = msg;
  }

  function setSisa(n) {
    document.getElementById('epus-sisa').textContent =
      n === null ? '—' : `${n} baris`;
  }

  // ─── LOGIKA AUTO KLIK ──────────────────────────────────────

  let autoTimer    = null;
  let autoInterval = null;

  async function jalankanAutoKlik() {
    const tr = ambilBarisPertama();
    if (!tr) {
      setStatus('✅ Tidak ada lagi baris — selesai!', 'ok');
      document.getElementById('epus-autoklik-btn').disabled = true;
      setSisa(0);
      return;
    }

    const nama = ambilNamaPasien(tr);
    const sisa = hitungSisaBaris();
    setSisa(sisa);
    setStatus(`👆 Membuka: ${nama}`, 'run');

    await new Promise(r => setTimeout(r, 300));

    tr.dispatchEvent(new MouseEvent('dblclick', {
      bubbles: true, cancelable: true,
      clientX: tr.getBoundingClientRect().x + 10,
      clientY: tr.getBoundingClientRect().y + 10,
    }));
  }

  function mulaiHitungan() {
    const btn = document.getElementById('epus-autoklik-btn');
    let   hitung = 1;

    btn.textContent = 'BATAL';
    btn.classList.add('batal');
    btn.disabled = false;
    setStatus(`⏳ Auto klik dalam ${hitung} detik...`, 'run');

    autoInterval = setInterval(() => {
      hitung--;
      if (hitung > 0) setStatus(`⏳ Auto klik dalam ${hitung} detik...`, 'run');
    }, 1000);

    autoTimer = setTimeout(async () => {
      clearInterval(autoInterval);
      btn.disabled = true;
      btn.classList.remove('batal');
      btn.textContent = 'PROSES...';
      await jalankanAutoKlik();
    }, 1000);
  }

  // Tombol BATAL / manual trigger
  document.getElementById('epus-autoklik-btn').addEventListener('click', () => {
    const btn = document.getElementById('epus-autoklik-btn');
    if (btn.classList.contains('batal')) {
      clearTimeout(autoTimer);
      clearInterval(autoInterval);
      btn.classList.remove('batal');
      btn.textContent = 'KLIK SEKARANG';
      setStatus('🚫 Dibatalkan — klik manual jika perlu', 'err');
      return;
    }
    // Klik manual
    btn.disabled = true;
    jalankanAutoKlik().finally(() => { btn.disabled = false; });
  });

  // ─── TUNGGU TABEL SIAP LALU MULAI ─────────────────────────
  // Tabel dirender oleh JS (DataTable), jadi perlu polling

  async function tunggutabel() {
    for (let i = 0; i < 20; i++) {   // coba max 5 detik
      const tr = ambilBarisPertama();
      if (tr) {
        const sisa = hitungSisaBaris();
        setSisa(sisa);

        if (sisa === 0) {
          setStatus('✅ Tidak ada baris belum bayar', 'ok');
          document.getElementById('epus-autoklik-btn').disabled = true;
          return;
        }

        mulaiHitungan();
        return;
      }
      await tidur(250);
    }
    setStatus('⚠️ Tabel tidak ditemukan', 'err');
  }

  tunggutabel();

})();