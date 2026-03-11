(function() {
    'use strict';

    let isStarted = false;

    const btn = document.createElement('button');
    btn.textContent = '🤖 Auto Fill Survey';
    btn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 99999;
        background: #00a651;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        cursor: grab;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: background 0.2s;
        user-select: none;
    `;
    document.body.appendChild(btn);

    // ── Draggable logic ──────────────────────────────────────────────────
    let isDragging = false;
    let hasDragged = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    btn.addEventListener('mousedown', function(e) {
        isDragging = true;
        hasDragged = false;
        dragOffsetX = e.clientX - btn.getBoundingClientRect().left;
        dragOffsetY = e.clientY - btn.getBoundingClientRect().top;
        btn.style.cursor = 'grabbing';
        btn.style.transition = 'background 0.2s'; // matikan transition posisi saat drag
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        hasDragged = true;

        const x = e.clientX - dragOffsetX;
        const y = e.clientY - dragOffsetY;

        // Batasi dalam viewport
        const maxX = window.innerWidth  - btn.offsetWidth;
        const maxY = window.innerHeight - btn.offsetHeight;

        btn.style.left   = Math.min(Math.max(0, x), maxX) + 'px';
        btn.style.top    = Math.min(Math.max(0, y), maxY) + 'px';
        btn.style.right  = 'auto';
        btn.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', function() {
        if (!isDragging) return;
        isDragging = false;
        btn.style.cursor = isStarted ? 'not-allowed' : 'grab';
    });

    // Batalkan klik jika user baru saja drag
    btn.addEventListener('click', function(e) {
        if (hasDragged) {
            hasDragged = false;
            return;
        }
        if (isStarted) return;
        startFill();
    });

    // Hover hanya jika tidak sedang proses
    btn.addEventListener('mouseenter', () => { if (!isStarted) btn.style.background = '#007a3d'; });
    btn.addEventListener('mouseleave', () => { if (!isStarted) btn.style.background = '#00a651'; });

    // ── Observer untuk modal konfirmasi ──────────────────────────────────
    const observer = new MutationObserver(function(mutations) {
        if (!isStarted) return;
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType !== 1) return;
                const confirmBtn = node.querySelector
                    ? node.querySelector('button[data-bb-handler="confirm"]')
                    : null;
                if (confirmBtn) {
                    setTimeout(() => {
                        console.log('[BPJS Auto Fill] Modal terdeteksi, klik Setuju');
                        confirmBtn.click();
                        isStarted = false;
                        setDone();
                    }, 300);
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ── Start ─────────────────────────────────────────────────────────────
    function startFill() {
        isStarted = true;
        btn.disabled = false; // tetap bisa di-drag
        btn.style.background = '#aaa';
        btn.style.cursor = 'not-allowed';
        console.log('[BPJS Auto Fill] Memulai pengisian survey...');
        processCurrentPage();
    }

    // ── Proses halaman saat ini ───────────────────────────────────────────
    function processCurrentPage() {
        const pageInfo = getPageInfo();
        btn.textContent = `⏳ Halaman ${pageInfo.current} / ${pageInfo.total}...`;
        console.log(`[BPJS Auto Fill] Mengisi halaman ${pageInfo.current} dari ${pageInfo.total}`);

        const filled = fillRadioTidak();
        console.log(`[BPJS Auto Fill] ${filled} pertanyaan dijawab 'Tidak'`);

        setTimeout(() => {
            if (isLastPage()) {
                console.log('[BPJS Auto Fill] Halaman terakhir, klik Simpan');
                clickSimpan();
            } else {
                clickNext();
            }
        }, 600);
    }

    function getPageInfo() {
        const el = document.getElementById('progresSurvey');
        if (!el) return { current: 1, total: 1 };
        const match = el.textContent.match(/(\d+)\s+dari\s+(\d+)/i);
        if (match) return { current: parseInt(match[1]), total: parseInt(match[2]) };
        return { current: 1, total: 1 };
    }

    function isLastPage() {
        const { current, total } = getPageInfo();
        const nextBtn = document.getElementById('nextGenBtn');
        const nextHidden = !nextBtn || nextBtn.style.display === 'none' || nextBtn.classList.contains('disabled');
        return current >= total || nextHidden;
    }

    function clickNext() {
        const nextBtn = document.getElementById('nextGenBtn');
        if (!nextBtn) {
            console.warn('[BPJS Auto Fill] nextGenBtn tidak ditemukan, coba Simpan');
            clickSimpan();
            return;
        }
        const { current } = getPageInfo();
        console.log(`[BPJS Auto Fill] Klik Selanjutnya dari halaman ${current}`);
        nextBtn.click();
        waitForPageChange(current, () => processCurrentPage());
    }

    function waitForPageChange(prevPage, callback, attempts = 0) {
        if (attempts > 50) {
            console.warn('[BPJS Auto Fill] Timeout tunggu halaman berikutnya');
            return;
        }
        const { current } = getPageInfo();
        if (current !== prevPage) {
            setTimeout(callback, 300);
        } else {
            setTimeout(() => waitForPageChange(prevPage, callback, attempts + 1), 100);
        }
    }

    function fillRadioTidak() {
        let count = 0;
        const radioGroups = {};

        document.querySelectorAll('input[type="radio"]').forEach(radio => {
            const name = radio.name || radio.getAttribute('name');
            if (name) {
                if (!radioGroups[name]) radioGroups[name] = [];
                radioGroups[name].push(radio);
            }
        });

        Object.keys(radioGroups).forEach(name => {
            const group = radioGroups[name];
            if (group.some(r => r.checked)) return;

            let tidakRadio = null;

            tidakRadio = group.find(r => /tidak|no|0|false/i.test(r.value));

            if (!tidakRadio) {
                tidakRadio = group.find(r => {
                    if (r.id) {
                        const label = document.querySelector(`label[for="${r.id}"]`);
                        if (label && /tidak|no/i.test(label.textContent)) return true;
                    }
                    const parentLabel = r.closest('label');
                    if (parentLabel && /tidak|no/i.test(parentLabel.textContent)) return true;
                    const nextSibling = r.nextSibling;
                    if (nextSibling && /tidak|no/i.test(nextSibling.textContent || '')) return true;
                    return false;
                });
            }

            if (!tidakRadio && group.length >= 2) {
                tidakRadio = group[group.length - 1];
                console.warn(`[Radio] "${name}" fallback ke opsi terakhir`);
            }

            if (tidakRadio) {
                tidakRadio.click();
                tidakRadio.checked = true;
                tidakRadio.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`[Radio] "${name}" → Tidak (value: "${tidakRadio.value}")`);
                count++;
            }
        });

        return count;
    }

    function clickSimpan() {
        let simpanBtn = null;
        document.querySelectorAll('button, input[type="submit"], a.btn').forEach(el => {
            const text = el.textContent || el.value || '';
            if (/simpan|submit|kirim|selesai/i.test(text)) simpanBtn = el;
        });

        if (simpanBtn) {
            console.log('[BPJS Auto Fill] Klik tombol Simpan:', simpanBtn.textContent.trim());
            btn.textContent = '⏳ Menyimpan...';
            simpanBtn.click();
            setTimeout(clickSetuju, 1500);
        } else {
            console.warn('[BPJS Auto Fill] Tombol Simpan tidak ditemukan');
            btn.textContent = '⚠️ Simpan tidak ditemukan';
            btn.style.background = '#e53e3e';
            isStarted = false;
            btn.style.cursor = 'grab';
        }
    }

    function clickSetuju() {
        if (!isStarted) return;

        let setujuBtn =
            document.querySelector('button[data-bb-handler="confirm"]') ||
            document.querySelector('.modal-footer .btn-success');

        if (!setujuBtn) {
            document.querySelectorAll('button').forEach(b => {
                if (/setuju/i.test(b.textContent.trim())) setujuBtn = b;
            });
        }

        if (setujuBtn && setujuBtn.offsetParent !== null) {
            console.log('[BPJS Auto Fill] Klik tombol Setuju (fallback)');
            setujuBtn.click();
            isStarted = false;
            setDone();
        } else {
            setTimeout(clickSetuju, 500);
        }
    }

    function setDone() {
        btn.textContent = '✅ Selesai!';
        btn.style.background = '#2b6cb0';
        btn.style.cursor = 'grab';
    }

})();