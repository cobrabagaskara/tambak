(function() {
    'use strict';

    // =====================================
    // DATA SKRINING (Dari recording terbaru)
    // =====================================
    const screeningData = {
        "metadata": {
            "url": "https://cirebon.epuskesmas.id/skriningthalasemia/create/",
            "skrining": "Thalasemia",
            "judul": "Skrining Thalasemia",
            "recordedAt": "2026-01-28T04:13:40.733Z",
            "totalActions": 8
        },
        "actions": [
            {
                "type": "setRadio",
                "name": "mudah_lelah",
                "value": "Tidak",
                "time": "2026-01-28T04:12:59.507Z"
            },
            {
                "type": "setRadio",
                "name": "konsumsi_sayur_buah",
                "value": "Tidak",
                "time": "2026-01-28T04:13:00.936Z"
            },
            {
                "type": "setRadio",
                "name": "konsumsi_protein_hewani",
                "value": "Ya",
                "time": "2026-01-28T04:13:19.541Z"
            },
            {
                "type": "setRadio",
                "name": "konsumsi_tablet_tambah_darah",
                "value": "Tidak",
                "time": "2026-01-28T04:13:21.155Z"
            },
            {
                "type": "setRadio",
                "name": "riwayat_kelainan_darah",
                "value": "Tidak",
                "time": "2026-01-28T04:13:22.005Z"
            },
            {
                "type": "setRadio",
                "name": "keluarga_thalasemia",
                "value": "Tidak",
                "time": "2026-01-28T04:13:22.631Z"
            },
            {
                "type": "setRadio",
                "name": "riwayat_transfusi",
                "value": "Tidak",
                "time": "2026-01-28T04:13:23.830Z"
            },
            {
                "type": "setValue",
                "name": "skor",
                "value": "1",
                "time": "2026-01-28T04:13:29.773Z"
            }
        ]
    };

    // =====================================
    // CONFIG
    // =====================================
    const CONFIG = {
        DELAY_BETWEEN_FIELDS: 250,   // Delay antar field (ms)
        SCROLL_DELAY: 100,           // Delay setelah scroll (ms)
        MAX_WAIT_TIME: 5000          // Max wait untuk element (ms)
    };

    // =====================================
    // HELPERS
    // =====================================
    const now = () => new Date().toISOString();

    function log(message, type = 'info') {
        const prefix = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            progress: '📝'
        }[type] || 'ℹ️';
        console.log(`${prefix} [${now()}] ${message}`);
    }

    // =====================================
    // WAIT FOR ELEMENT
    // =====================================
    function waitForElement(selector, timeout = CONFIG.MAX_WAIT_TIME) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timeout: ${selector} tidak ditemukan`));
            }, timeout);
        });
    }

    // =====================================
    // SET RADIO BUTTON
    // =====================================
    async function setRadio(name, value) {
        try {
            // Cari radio button dengan case-insensitive matching
            const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);

            if (radios.length === 0) {
                log(`Radio [${name}] tidak ditemukan`, 'warning');
                return false;
            }

            let radio = null;
            for (const r of radios) {
                if (r.value.trim().toLowerCase() === value.trim().toLowerCase()) {
                    radio = r;
                    break;
                }
            }

            if (radio) {
                // Scroll ke element
                radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, CONFIG.SCROLL_DELAY));

                // Set checked
                radio.checked = true;

                // Trigger events
                ['click', 'change', 'input'].forEach(eventType => {
                    radio.dispatchEvent(new Event(eventType, { bubbles: true }));
                });

                log(`Radio [${name}] = [${value}]`, 'success');
                return true;
            } else {
                log(`Radio [${name}] dengan value [${value}] tidak ditemukan`, 'warning');
                return false;
            }
        } catch (error) {
            log(`Error setting radio [${name}]: ${error.message}`, 'error');
            return false;
        }
    }

    // =====================================
    // SET INPUT/SELECT VALUE
    // =====================================
    async function setValue(name, value) {
        try {
            // Cek apakah element adalah select atau input
            const select = document.querySelector(`select[name="${name}"]`);
            const input = document.querySelector(`input[name="${name}"], textarea[name="${name}"]`);

            let element = select || input;

            if (!element) {
                log(`Element [${name}] tidak ditemukan`, 'warning');
                return false;
            }

            // Scroll ke element
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, CONFIG.SCROLL_DELAY));

            // Set value berdasarkan tipe element
            if (element.tagName === 'SELECT') {
                // Handle dropdown
                for (const option of element.options) {
                    if (option.value === value ||
                        option.value.trim() === value.trim() ||
                        option.textContent.trim().toLowerCase() === value.trim().toLowerCase()) {
                        element.value = option.value;
                        break;
                    }
                }
            } else {
                // Handle input/textarea
                element.value = value;
            }

            // Trigger events
            ['input', 'change'].forEach(eventType => {
                element.dispatchEvent(new Event(eventType, { bubbles: true }));
            });

            log(`${element.tagName === 'SELECT' ? 'Select' : 'Input'} [${name}] = [${value}]`, 'success');
            return true;
        } catch (error) {
            log(`Error setting value [${name}]: ${error.message}`, 'error');
            return false;
        }
    }

    // =====================================
    // VALIDASI FORM SEBELUM SUBMIT
    // =====================================
    function validateForm() {
        const results = {
            total: screeningData.actions.length,
            filled: 0,
            missing: []
        };

        screeningData.actions.forEach(item => {
            let found = false;

            if (item.type === "setRadio") {
                const radio = document.querySelector(`input[type="radio"][name="${item.name}"][value="${item.value}"]`);
                if (radio && radio.checked) {
                    found = true;
                }
            } else if (item.type === "setValue") {
                const select = document.querySelector(`select[name="${item.name}"]`);
                const input = document.querySelector(`input[name="${item.name}"], textarea[name="${item.name}"]`);
                const element = select || input;

                if (element) {
                    if (element.tagName === 'SELECT') {
                        if (element.value === item.value) {
                            found = true;
                        }
                    } else {
                        if (element.value === item.value) {
                            found = true;
                        }
                    }
                }
            }

            if (found) {
                results.filled++;
            } else {
                results.missing.push(item.name);
            }
        });

        return results;
    }

    // =====================================
    // MAIN AUTOMATION FUNCTION
    // =====================================
    async function runAutomation() {
        log('🚀 === MEMULAI OTOMASI SKRINING THALASEMIA ===', 'info');
        log(`📄 Form: ${screeningData.metadata.judul}`, 'info');
        log(`📊 Total fields: ${screeningData.actions.length}`, 'info');

        let successCount = 0;
        let failCount = 0;
        const failedFields = [];

        // Proses setiap field
        for (let i = 0; i < screeningData.actions.length; i++) {
            const item = screeningData.actions[i];
            const progress = Math.round(((i + 1) / screeningData.actions.length) * 100);

            log(`Progress: ${progress}% - [${i + 1}/${screeningData.actions.length}] ${item.type} (${item.name})`, 'progress');

            let success = false;

            try {
                if (item.type === "setRadio") {
                    success = await setRadio(item.name, item.value);
                } else if (item.type === "setValue") {
                    success = await setValue(item.name, item.value);
                }

                // Delay antar field
                await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_FIELDS));

            } catch (error) {
                log(`Error processing field ${item.name}: ${error.message}`, 'error');
                success = false;
            }

            if (success) {
                successCount++;
            } else {
                failCount++;
                failedFields.push({ name: item.name, type: item.type });
            }
        }

        // Validasi hasil
        const validation = validateForm();

        // Tampilkan hasil
        console.log('\n' + '='.repeat(60));
        log(`OTOMASI SELESAI!`, 'success');
        console.log('='.repeat(60));
        log(`✓ Berhasil diisi: ${successCount}`, 'success');
        log(`✗ Gagal diisi: ${failCount}`, 'error');
        log(`📊 Terisi: ${validation.filled}/${validation.total} fields terisi`, 'info');
        console.log('='.repeat(60));

        if (failedFields.length > 0) {
            log(`\n⚠️ Field yang gagal:`, 'warning');
            failedFields.forEach(field => {
                console.log(`   - ${field.name} (${field.type})`);
            });
        }

        if (validation.missing.length > 0) {
            log(`\n⚠️ Field yang belum terisi (validasi):`, 'warning');
            validation.missing.forEach(name => {
                console.log(`   - ${name}`);
            });
        }

        // Tampilkan notifikasi
        showNotification(successCount, failCount, validation);

        return { successCount, failCount, validation };
    }

    // =====================================
    // SHOW NOTIFICATION
    // =====================================
    function showNotification(success, fail, validation) {
        const message = `✅ Otomasi Selesai!\n\n` +
                       `✓ Berhasil: ${success}\n` +
                       `✗ Gagal: ${fail}\n` +
                       `📊 Terisi: ${validation.filled}/${validation.total}\n\n` +
                       `Silakan periksa form sebelum submit.`;

        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                title: '✅ Otomasi Skrining Thalasemia Selesai',
                text: message,
                timeout: 8000,
                onclick: () => {
                    console.log('User clicked notification');
                }
            });
        } else {
            alert(message);
        }
    }

    // =====================================
    // ADD BUTTON
    // =====================================
    function addButton() {
        // Hapus button lama jika ada
        const oldBtn = document.getElementById('tampermonkey-otomasi-btn');
        if (oldBtn) oldBtn.remove();

        const button = document.createElement('button');
        button.id = 'tampermonkey-otomasi-btn';
        button.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span>🩸</span>
                <div style="text-align: left;">
                    <div style="font-weight: bold; font-size: 14px;">Jalankan Otomasi</div>
                    <div style="font-size: 11px; opacity: 0.9;">Skrining Thalasemia</div>
                </div>
            </div>
        `;

        Object.assign(button.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '999999',
            padding: '14px 20px',
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            boxShadow: '0 6px 20px rgba(255, 107, 107, 0.4)',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        button.onmouseover = () => {
            button.style.transform = 'translateY(-3px) scale(1.02)';
            button.style.boxShadow = '0 8px 25px rgba(255, 107, 107, 0.6)';
        };

        button.onmouseout = () => {
            button.style.transform = 'translateY(0) scale(1)';
            button.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.4)';
        };

        button.onclick = async () => {
            if (button.disabled) return;

            // Disable button saat processing
            button.disabled = true;
            button.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>⏳</span>
                    <div style="text-align: left;">
                        <div style="font-weight: bold; font-size: 14px;">Processing...</div>
                        <div style="font-size: 11px; opacity: 0.9;">Mohon tunggu</div>
                    </div>
                </div>
            `;
            button.style.background = '#6c757d';
            button.style.cursor = 'wait';
            button.style.transform = 'scale(0.98)';

            try {
                await runAutomation();
            } catch (error) {
                log(`Error during automation: ${error.message}`, 'error');
                alert(`❌ Terjadi error:\n${error.message}`);
            } finally {
                // Re-enable button
                setTimeout(() => {
                    button.disabled = false;
                    button.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span>✅</span>
                            <div style="text-align: left;">
                                <div style="font-weight: bold; font-size: 14px;">Selesai!</div>
                                <div style="font-size: 11px; opacity: 0.9;">Klik untuk Ulangi</div>
                            </div>
                        </div>
                    `;
                    button.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                    button.style.cursor = 'pointer';
                    button.style.transform = 'scale(1)';

                    // Reset setelah 3 detik
                    setTimeout(() => {
                        button.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span>🩸</span>
                                <div style="text-align: left;">
                                    <div style="font-weight: bold; font-size: 14px;">Jalankan Otomasi</div>
                                    <div style="font-size: 11px; opacity: 0.9;">Skrining Thalasemia</div>
                                </div>
                            </div>
                        `;
                        button.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
                    }, 3000);
                }, 500);
            }
        };

        document.body.appendChild(button);
        log('🔘 Tombol otomasi berhasil ditambahkan', 'success');
    }

    // =====================================
    // AUTO-RUN (Optional)
    // =====================================
    function autoRunIfNeeded() {
        // Uncomment jika ingin auto-run
        /*
        const autoRunUrls = [
            '/skriningthalasemia/create/'
        ];

        autoRunUrls.forEach(pattern => {
            if (window.location.pathname.includes(pattern)) {
                log('🤖 Auto-running otomasi dalam 3 detik...', 'info');
                setTimeout(() => {
                    runAutomation();
                }, 3000);
            }
        });
        */
    }

    // =====================================
    // INITIALIZATION
    // =====================================
    log('Intialized Tampermonkey - Otomasi Skrining Thalasemia v1.0', 'info');
    log(`📄 Data source: ${screeningData.metadata.judul}`, 'info');
    log(`📅 Recorded at: ${screeningData.metadata.recordedAt}`, 'info');
    log(`📊 Total actions: ${screeningData.metadata.totalActions}`, 'info');

    // Tambahkan tombol setelah halaman siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addButton);
    } else {
        addButton();
    }

    // Cek untuk auto-run
    autoRunIfNeeded();

})();