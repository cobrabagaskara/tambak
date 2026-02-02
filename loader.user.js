// ==UserScript==
// @name         PKMKedawung - Modular System Loader (Solid)
// @namespace    https://github.com/cobrabagaskara/tambak
// @version      2.0.0
// @description  Advanced modular Tampermonkey loader with draggable dashboard
// @author       cobrabagaskara
// @match        https://cirebon.epuskesmas.id/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @updateURL    https://raw.githubusercontent.com/cobrabagaskara/tambak/main/loader.user.js
// @downloadURL  https://raw.githubusercontent.com/cobrabagaskara/tambak/main/loader.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ============== KONFIGURASI ==============
    const CONFIG = {
        GITHUB_REPO: 'https://raw.githubusercontent.com/cobrabagaskara/tambak/main',
        MANIFEST_URL: 'https://raw.githubusercontent.com/cobrabagaskara/tambak/main/modules/global-manifest.json',
        FALLBACK_URLS: [
            'https://raw.githubusercontent.com/cobrabagaskara/tambak/main',
            'https://cdn.jsdelivr.net/gh/cobrabagaskara/tambak@main'
        ],
        CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 jam
        VERSION: '2.0.0'
    };

    // ============== STATE MANAGEMENT ==============
    let modules = {};
    let enabledModules = {};
    let dashboard = null;
    let isDashboardVisible = false;

    // ============== UTILITY FUNCTIONS ==============
    function log(...args) {
        console.log('[PKMKedawung-Loader]', ...args);
    }

    function error(...args) {
        console.error('[PKMKedawung-Loader]', ...args);
    }

    // ============== URL MATCHING ==============
    function matchesPattern(url, pattern) {
        try {
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '\\?');
            const regex = new RegExp('^' + regexPattern + '$');
            return regex.test(url);
        } catch (e) {
            return false;
        }
    }

    function shouldLoadModule(module, currentUrl) {
        if (!module.match || !Array.isArray(module.match)) return false;

        for (const pattern of module.match) {
            if (matchesPattern(currentUrl, pattern)) {
                return true;
            }
        }
        return false;
    }

    // ============== STORAGE MANAGEMENT ==============
    function savePreferences() {
        GM_setValue('skrining_auto_prefs', {
            enabledModules: enabledModules,
            lastUpdate: Date.now(),
            version: CONFIG.VERSION
        });
        log('Preferences saved');
    }

    function loadPreferences() {
        const prefs = GM_getValue('skrining_auto_prefs', null);
        if (prefs && prefs.version === CONFIG.VERSION) {
            enabledModules = prefs.enabledModules || {};
            log('Preferences loaded');
        } else {
            // Initialize with default values from manifest
            enabledModules = {};
            log('New preferences initialized');
        }
        return prefs;
    }

    // ============== MANIFEST LOADING ==============
    function loadManifest() {
        log('Loading manifest from:', CONFIG.MANIFEST_URL);

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: CONFIG.MANIFEST_URL,
                timeout: 10000,
                onload: function(response) {
                    try {
                        if (response.status === 200) {
                            const manifest = JSON.parse(response.responseText);
                            modules = manifest.modules || {};
                            log(`Loaded ${Object.keys(modules).length} modules`);

                            // Cache manifest
                            GM_setValue('cached_manifest', {
                                data: manifest,
                                timestamp: Date.now()
                            });

                            resolve(manifest);
                        } else {
                            reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    log('Failed to load manifest, trying cache...');
                    const cached = GM_getValue('cached_manifest', null);
                    if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_DURATION) {
                        modules = cached.data.modules || {};
                        log(`Loaded ${Object.keys(modules).length} modules from cache`);
                        resolve(cached.data);
                    } else {
                        reject(error);
                    }
                },
                ontimeout: function() {
                    reject(new Error('Timeout loading manifest'));
                }
            });
        });
    }

    // ============== MODULE LOADING ==============
    function loadModuleScript(moduleId, moduleConfig) {
        const scriptUrl = `${CONFIG.GITHUB_REPO}/modules/${moduleConfig.file}`;
        log(`Loading module ${moduleId} from: ${scriptUrl}`);

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: scriptUrl,
                timeout: 15000,
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error(`HTTP ${response.status} for module ${moduleId}`));
                    }
                },
                onerror: function(err) {
                    reject(new Error(`Failed to load module ${moduleId}: ${err}`));
                }
            });
        });
    }

    function executeModule(moduleId, code) {
        try {
            // Create isolated execution context
            const moduleFunction = new Function('module', 'exports', 'require', code);
            const moduleExports = {};
            const moduleRequire = () => ({});

            moduleFunction({exports: moduleExports}, moduleExports, moduleRequire);

            log(`Module ${moduleId} executed successfully`);
            return true;
        } catch (e) {
            error(`Error executing module ${moduleId}:`, e);
            return false;
        }
    }

    // ============== MODULE MANAGEMENT ==============
    async function checkAndLoadModules() {
        const currentUrl = window.location.href;
        log('Checking modules for URL:', currentUrl);

        for (const [moduleId, moduleConfig] of Object.entries(modules)) {
            // Skip jika module tidak enabled
            if (enabledModules[moduleId] === false) {
                continue;
            }

            // Cek apakah URL match
            if (shouldLoadModule(moduleConfig, currentUrl)) {
                log(`Module ${moduleId} matched for current URL`);

                try {
                    const code = await loadModuleScript(moduleId, moduleConfig);
                    const success = executeModule(moduleId, code);

                    if (success) {
                        log(`✓ Module ${moduleId} loaded and executed`);
                    } else {
                        error(`✗ Failed to execute module ${moduleId}`);
                    }
                } catch (e) {
                    error(`Failed to load module ${moduleId}:`, e);
                }
            }
        }
    }

    // ============== NOTIFICATION SYSTEM ==============
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 1000001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease-out;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            max-width: 300px;
        `;

        notification.innerHTML = `
            <span style="font-size: 18px;">
                ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}
            </span>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) notification.remove();
            }, 300);
        }, 3000);
    }

    // ============== DRAGGABLE DASHBOARD ==============
    function createAdvancedDashboard() {
        // Remove existing dashboard if any
        if (dashboard) {
            dashboard.remove();
        }

        // Create main container
        dashboard = document.createElement('div');
        dashboard.id = 'skrining-auto-dashboard';
        dashboard.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            width: 450px;
            background: white;
            border: 2px solid #4CAF50;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.25);
            z-index: 1000000;
            font-family: 'Segoe UI', Arial, sans-serif;
            display: none;
            resize: both;
            overflow: hidden;
            min-width: 350px;
            min-height: 300px;
            max-width: 90vw;
            max-height: 90vh;
        `;

        // Dashboard header (draggable area)
        const header = document.createElement('div');
        header.id = 'skrining-dashboard-header';
        header.style.cssText = `
            background: linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px 10px 0 0;
            cursor: move;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
        `;

        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="font-size: 20px;">⚙️</div>
                <div>
                    <div style="font-weight: bold; font-size: 16px;">PKMKedawung - Modular System</div>
                    <div style="font-size: 11px; opacity: 0.9;">${Object.keys(modules).length} modules loaded</div>
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button id="skrining-refresh-btn" style="
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                ">🔄 Refresh</button>
                <button id="skrining-check-updates" style="
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                ">📡 Check Updates</button>
                <button id="skrining-close-btn" style="
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    border-radius: 50%;
                    width: 28px;
                    height: 28px;
                    cursor: pointer;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                ">✕</button>
            </div>
        `;

        // Dashboard content
        const content = document.createElement('div');
        content.id = 'skrining-dashboard-content';
        content.style.cssText = `
            padding: 20px;
            overflow-y: auto;
            max-height: 500px;
        `;

        content.innerHTML = `
            <div id="skrining-modules-list">
                <div style="text-align: center; padding: 20px; color: #666;">
                    <div class="loader" style="
                        border: 3px solid #f3f3f3;
                        border-top: 3px solid #4CAF50;
                        border-radius: 50%;
                        width: 30px;
                        height: 30px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 15px;
                    "></div>
                    Loading modules...
                </div>
            </div>
        `;

        // Dashboard footer
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 15px 20px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
            border-radius: 0 0 10px 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: #6c757d;
        `;

        footer.innerHTML = `
            <div>
                <span id="skrining-stats-enabled">0</span> enabled •
                <span id="skrining-stats-total">${Object.keys(modules).length}</span> total
            </div>
            <div>v${CONFIG.VERSION}</div>
        `;

        // Assemble dashboard
        dashboard.appendChild(header);
        dashboard.appendChild(content);
        dashboard.appendChild(footer);
        document.body.appendChild(dashboard);

        // Add CSS styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes slideIn {
                from { transform: translateX(100px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100px); opacity: 0; }
            }

            .skrining-module-card {
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 12px;
                transition: all 0.2s;
            }

            .skrining-module-card:hover {
                border-color: #4CAF50;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }

            .skrining-module-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .skrining-module-name {
                font-weight: bold;
                color: #2E7D32;
                font-size: 14px;
            }

            .skrining-module-desc {
                font-size: 12px;
                color: #6c757d;
                margin-bottom: 8px;
                line-height: 1.4;
            }

            .skrining-module-meta {
                font-size: 11px;
                color: #adb5bd;
                display: flex;
                gap: 10px;
            }

            .skrining-module-match {
                display: inline-block;
                padding: 2px 6px;
                background: #e3f2fd;
                color: #1976d2;
                border-radius: 3px;
                font-size: 10px;
            }

            .skrining-module-match.matched {
                background: #e8f5e9;
                color: #2E7D32;
            }

            .skrining-toggle {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 20px;
            }

            .skrining-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .skrining-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: .4s;
                border-radius: 20px;
            }

            .skrining-slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }

            .skrining-toggle input:checked + .skrining-slider {
                background-color: #4CAF50;
            }

            .skrining-toggle input:checked + .skrining-slider:before {
                transform: translateX(20px);
            }

            #skrining-dashboard-header button:hover {
                background: rgba(255,255,255,0.3) !important;
                transform: scale(1.05);
            }

            #skrining-close-btn:hover {
                background: rgba(255,0,0,0.3) !important;
                color: #ff6b6b !important;
            }
        `;
        document.head.appendChild(style);

        // Initialize dashboard functionality
        initDashboardFunctionality();
    }

    function initDashboardFunctionality() {
        // Draggable functionality
        makeDraggable(dashboard, document.getElementById('skrining-dashboard-header'));

        // Close button
        document.getElementById('skrining-close-btn').addEventListener('click', hideDashboard);

        // Refresh button
        document.getElementById('skrining-refresh-btn').addEventListener('click', async () => {
            log('Manual refresh triggered');
            await loadManifest();
            updateDashboardContent();
            showNotification('Modules refreshed successfully');
        });

        // Check updates button
        document.getElementById('skrining-check-updates').addEventListener('click', async () => {
            log('Checking for updates...');
            showNotification('Checking for updates...');
            try {
                await loadManifest();
                updateDashboardContent();
                showNotification('Update check completed');
            } catch (e) {
                showNotification('Update check failed: ' + e.message, 'error');
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && isDashboardVisible) {
                hideDashboard();
            }
        });
    }

    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();

            // Get the mouse cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;

            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();

            // Calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            // Set the element's new position
            const newTop = element.offsetTop - pos2;
            const newLeft = element.offsetLeft - pos1;

            // Keep within viewport bounds
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const elementWidth = element.offsetWidth;
            const elementHeight = element.offsetHeight;

            element.style.top = Math.max(0, Math.min(newTop, viewportHeight - elementHeight)) + 'px';
            element.style.left = Math.max(0, Math.min(newLeft, viewportWidth - elementWidth)) + 'px';
            element.style.right = 'auto'; // Remove right positioning when dragging
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    function updateDashboardContent() {
        const modulesList = document.getElementById('skrining-modules-list');
        const currentUrl = window.location.href;

        if (!modulesList) return;

        let html = '';
        let enabledCount = 0;

        for (const [moduleId, moduleConfig] of Object.entries(modules)) {
            const isEnabled = enabledModules[moduleId] !== false;
            const isMatched = shouldLoadModule(moduleConfig, currentUrl);

            if (isEnabled) enabledCount++;

            html += `
                <div class="skrining-module-card" data-module="${moduleId}">
                    <div class="skrining-module-header">
                        <div class="skrining-module-name">${moduleConfig.name || moduleId}</div>
                        <label class="skrining-toggle">
                            <input type="checkbox" ${isEnabled ? 'checked' : ''}>
                            <span class="skrining-slider"></span>
                        </label>
                    </div>
                    <div class="skrining-module-desc">${moduleConfig.description || 'No description available'}</div>
                    <div class="skrining-module-meta">
                        <span>Ver: ${moduleConfig.version || '1.0.0'}</span>
                        <span>By: ${moduleConfig.author || 'Unknown'}</span>
                        <span class="skrining-module-match ${isMatched ? 'matched' : ''}">
                            ${isMatched ? '✓ Match' : '✗ No Match'}
                        </span>
                    </div>
                </div>
            `;
        }

        if (Object.keys(modules).length === 0) {
            html = `
                <div style="text-align: center; padding: 40px 20px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📭</div>
                    <div style="font-weight: bold; margin-bottom: 10px;">No Modules Found</div>
                    <div>Add modules to your global-manifest.json</div>
                </div>
            `;
        }

        modulesList.innerHTML = html;

        // Update stats in footer
        const enabledSpan = document.getElementById('skrining-stats-enabled');
        const totalSpan = document.getElementById('skrining-stats-total');

        if (enabledSpan) enabledSpan.textContent = enabledCount;
        if (totalSpan) totalSpan.textContent = Object.keys(modules).length;

        // Add event listeners to toggles
        document.querySelectorAll('.skrining-toggle input').forEach(toggle => {
            const moduleCard = toggle.closest('.skrining-module-card');
            const moduleId = moduleCard.getAttribute('data-module');

            toggle.addEventListener('change', function() {
                enabledModules[moduleId] = this.checked;
                savePreferences();

                // Show notification
                showNotification(
                    `Module "${modules[moduleId]?.name || moduleId}" ${this.checked ? 'enabled' : 'disabled'}`,
                    this.checked ? 'success' : 'warning'
                );

                // Reload modules if enabled
                if (this.checked) {
                    setTimeout(() => checkAndLoadModules(), 300);
                }
            });
        });
    }

    function showDashboard() {
        if (!dashboard) {
            createAdvancedDashboard();
        }

        dashboard.style.display = 'block';
        dashboard.style.animation = 'slideIn 0.3s ease-out';
        isDashboardVisible = true;

        // Update content
        updateDashboardContent();

        // Bring to front
        dashboard.style.zIndex = '1000000';
    }

    function hideDashboard() {
        if (!dashboard) return;

        dashboard.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (dashboard) {
                dashboard.style.display = 'none';
                isDashboardVisible = false;
            }
        }, 250);
    }

    function toggleDashboard() {
        if (isDashboardVisible) {
            hideDashboard();
        } else {
            showDashboard();
        }
    }

    // ============== MENU ACCESS BUTTON ==============
    (function addMenuAccessButton() {
        // Create menu button in page
        const menuBtn = document.createElement('button');
        menuBtn.id = 'skrining-menu-btn';
        menuBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%);
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            font-size: 24px;
            cursor: pointer;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        menuBtn.textContent = '⚙️';
        menuBtn.title = 'PKMKedawung Modular System';

        menuBtn.addEventListener('mouseenter', () => {
            menuBtn.style.transform = 'scale(1.1) rotate(90deg)';
            menuBtn.style.boxShadow = '0 6px 25px rgba(0,0,0,0.4)';
        });

        menuBtn.addEventListener('mouseleave', () => {
            menuBtn.style.transform = 'scale(1) rotate(0deg)';
            menuBtn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        });

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDashboard();
        });

     //   document.body.appendChild(menuBtn); // buang koment akan ada gearnya

        // Add to Tampermonkey menu
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('Show PKMKedawung Dashboard', toggleDashboard);
            GM_registerMenuCommand('Reload All Modules', async () => {
                await loadManifest();
                updateDashboardContent();
                checkAndLoadModules();
                showNotification('All modules reloaded');
            });
            GM_registerMenuCommand('Check for Updates', async () => {
                log('Checking for updates via menu...');
                showNotification('Checking for updates...');
                try {
                    await loadManifest();
                    updateDashboardContent();
                    showNotification('Update check completed');
                } catch (e) {
                    showNotification('Update check failed: ' + e.message, 'error');
                }
            });
        }
    })();

    // ============== INITIALIZATION ==============
    async function init() {
        log('Initializing PKMKedawung Loader v' + CONFIG.VERSION);

        try {
            // Load preferences
            loadPreferences();

            // Load manifest
            await loadManifest();

            // Initialize dashboard system (but don't show it automatically)
            createAdvancedDashboard();

            // Check and load modules for current URL
            await checkAndLoadModules();

            log('Loader initialized successfully');

            // Show small notification that loader is ready
            setTimeout(() => {
               // showNotification(`PKMKedawung Loader ready (${Object.keys(modules).length} modules)`); // hilangin notif dashboard ready
            }, 1000);

        } catch (e) {
            error('Initialization failed:', e);
            showNotification('Loader initialization failed: ' + e.message, 'error');
        }
    }

    // ============== START APPLICATION ==============
    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
