(function () {
  'use strict';

  // ─── TUNGGU DOM SIAP ──────────────────────────────────────
  const tidur = ms => new Promise(r => setTimeout(r, ms));

  async function init() {
    // Tunggu elemen kritis muncul (halaman kadang lambat render)
    await tidur(800);

    // ─── AMBIL TOTAL TARIF ──────────────────────────────────
    // <th class="total">20,000</th>
    const thTotal = document.querySelector('th.total');
    if (!thTotal) {
      setStatus('⚠️ Total Tarif tidak ditemukan', 'err');
      return;
    }
    const totalTarif = parseInt(thTotal.textContent.replace(/\D/g, '')) || 0;

    // ─── AMBIL INPUT DIBAYAR ────────────────────────────────
    // <input name="Pembayaran[uang_bayar]" ...>
    const inputDibayar = document.querySelector('input[name="Pembayaran[uang_bayar]"]');
    if (!inputDibayar) {
      setStatus('⚠️ Input Dibayar tidak ditemukan', 'err');
      return;
    }

    // ─── AMBIL TOMBOL BAYAR ─────────────────────────────────
    // <button id="button_save" ...>Bayar</button>
    const tombolBayar = document.querySelector('#button_save');
    if (!tombolBayar) {
      setStatus('⚠️ Tombol Bayar tidak ditemukan', 'err');
      return;
    }

    // ─── AMBIL LINK LIHAT SEMUA ─────────────────────────────
    // <a id="button_index" href="/pembayaran">Lihat Semua</a>
    const linkLihatSemua = document.querySelector('#button_index');

    // Update UI panel
    setStatus(`💰 Total Tarif: Rp ${totalTarif.toLocaleString('id-ID')}`, 'ready');
    panelSetTarif(totalTarif);

    // ─── AUTO KLIK BAYAR setelah 1 detik ───────────────────
    let hitungan = 1;
    setStatus(`⏳ Auto bayar dalam ${hitungan} detik... (klik BATAL untuk stop)`, 'run');
    document.getElementById('epus-bayar-btn').textContent = 'BATAL';
    document.getElementById('epus-bayar-btn').classList.add('batal');

    const interval = setInterval(() => {
      hitungan--;
      if (hitungan > 0) {
        setStatus(`⏳ Auto bayar dalam ${hitungan} detik... (klik BATAL untuk stop)`, 'run');
      }
    }, 1000);

    const autoTimer = setTimeout(async () => {
      clearInterval(interval);
      document.getElementById('epus-bayar-btn').textContent = 'BAYAR';
      document.getElementById('epus-bayar-btn').classList.remove('batal');
      document.getElementById('epus-bayar-btn').disabled = true;
      await window.__epusAutoBayar();
      document.getElementById('epus-bayar-btn').disabled = false;
    }, 1000);

    // Simpan referensi agar bisa dibatalkan
    window.__epusAutoTimer    = autoTimer;
    window.__epusAutoInterval = interval;

    // ─── AKSI BAYAR ─────────────────────────────────────────

    window.__epusAutoBayar = async function () {
      setStatus('⏳ Mengisi form...', 'run');

      // Isi input Dibayar
      inputDibayar.focus();
      inputDibayar.value = '';

      // Trigger native setter agar event countHarga() terpanggil
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;
      if (nativeSetter) nativeSetter.call(inputDibayar, String(totalTarif));
      else inputDibayar.value = String(totalTarif);

      inputDibayar.dispatchEvent(new Event('input',  { bubbles: true }));
      inputDibayar.dispatchEvent(new Event('change', { bubbles: true }));
      inputDibayar.dispatchEvent(new Event('blur',   { bubbles: true }));

      // Panggil fungsi countHarga jika ada (dari oninput di HTML)
      if (typeof countHarga === 'function') {
        try { countHarga(String(totalTarif)); } catch(e) {}
      }

      await tidur(600);
      setStatus('💳 Klik Bayar...', 'run');

      // Klik tombol Bayar
      tombolBayar.click();
      await tidur(2000);

      setStatus('↩️ Kembali ke daftar...', 'run');

      // Klik Lihat Semua untuk kembali ke halaman list
      if (linkLihatSemua) {
        linkLihatSemua.click();
      } else {
        window.location.href = 'https://cirebon.epuskesmas.id/pembayaran';
      }
    };
  }

  // ─── BUAT UI PANEL ────────────────────────────────────────

  // Inject font
  const font  = document.createElement('link');
  font.rel    = 'stylesheet';
  font.href   = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap';
  document.head.appendChild(font);

  const panel = document.createElement('div');
  panel.id    = 'epus-bayar';
  panel.innerHTML = `
    <div id="epus-bayar-header">
      <span>⚕ AUTO BAYAR</span>
      <button id="epus-bayar-toggle">−</button>
    </div>
    <div id="epus-bayar-body">
      <div id="epus-bayar-tarif">Membaca halaman...</div>
      <button id="epus-bayar-btn" disabled>BAYAR</button>
      <div id="epus-bayar-status">Menunggu...</div>
    </div>
  `;
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    #epus-bayar {
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

    #epus-bayar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      font-size: 11px;
      font-weight: 600;
      color: #3fb950;
      letter-spacing: 1.5px;
    }

    #epus-bayar-toggle {
      background: none;
      border: 1px solid #30363d;
      color: #8b949e;
      width: 20px; height: 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #epus-bayar-toggle:hover { color: #fff; border-color: #8b949e; }

    #epus-bayar-body {
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #epus-bayar-body.collapsed { display: none; }

    #epus-bayar-tarif {
      font-size: 12px;
      color: #e6edf3;
      font-weight: 600;
      text-align: center;
      padding: 8px;
      background: #161b22;
      border-radius: 6px;
      border: 1px solid #30363d;
    }

    #epus-bayar-btn {
      width: 100%;
      padding: 9px;
      background: #238636;
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
    #epus-bayar-btn:hover:not(:disabled)  { background: #2ea043; }
    #epus-bayar-btn:active:not(:disabled) { transform: scale(.97); }
    #epus-bayar-btn.batal {
      background: #b91c1c;
    }
    #epus-bayar-btn.batal:hover { background: #dc2626; }
    #epus-bayar-btn:disabled {
      background: #21262d;
      color: #8b949e;
      cursor: not-allowed;
    }

    #epus-bayar-status {
      font-size: 10px;
      color: #8b949e;
      line-height: 1.5;
      min-height: 14px;
    }
    #epus-bayar-status.run   { color: #d29922; }
    #epus-bayar-status.ready { color: #3fb950; }
    #epus-bayar-status.err   { color: #f85149; }
  `;
  document.head.appendChild(style);

  // Toggle collapse
  document.getElementById('epus-bayar-toggle').addEventListener('click', () => {
    const body      = document.getElementById('epus-bayar-body');
    const collapsed = body.classList.toggle('collapsed');
    document.getElementById('epus-bayar-toggle').textContent = collapsed ? '+' : '−';
  });

  // Tombol BAYAR / BATAL
  document.getElementById('epus-bayar-btn').addEventListener('click', () => {
    const btn = document.getElementById('epus-bayar-btn');
    if (btn.classList.contains('batal')) {
      clearTimeout(window.__epusAutoTimer);
      clearInterval(window.__epusAutoInterval);
      btn.textContent = 'BAYAR';
      btn.classList.remove('batal');
      setStatus('🚫 Dibatalkan — klik BAYAR untuk manual', 'err');
      return;
    }
    if (typeof window.__epusAutoBayar === 'function') {
      btn.disabled = true;
      window.__epusAutoBayar().finally(() => { btn.disabled = false; });
    }
  });

  // Helper update UI
  function setStatus(pesan, tipe = '') {
    const el = document.getElementById('epus-bayar-status');
    el.className = tipe;
    el.textContent = pesan;
  }

  function panelSetTarif(tarif) {
    document.getElementById('epus-bayar-tarif').textContent =
      `Rp ${tarif.toLocaleString('id-ID')}`;
    document.getElementById('epus-bayar-btn').disabled = false;
  }

  // Jalankan init
  init().catch(e => {
    document.getElementById('epus-bayar-status').textContent = '❌ ' + e.message;
  });

})();