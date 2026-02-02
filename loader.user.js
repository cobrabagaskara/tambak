// ==UserScript==
// @name         Skrining Auto - Module Loader
// @namespace    https://github.com/cobrabagaskara/tambak
// @version      1.0.1
// @description  Modular Tampermonkey Loader for Skrining Auto System
// @author       cobrabagaskara
// @match        https://cirebon.epuskesmas.id/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
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
        VERSION: '1.0.0'
    };

    // ============== STATE MANAGEMENT ==============
    let modules = {};
    let enabledModules = {};

    // ============== UTILITY FUNCTIONS ==============
    function log(...args) {
        console.log('[SkriningAuto-Loader]', ...args);
    }

    function error(...args) {
        console.error('[SkriningAuto-Loader]', ...args);
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
        
        // Set default enabled state from manifest
        for (const [moduleId, moduleConfig] of Object.entries(modules)) {
            enabledModules[moduleId] = moduleConfig.enabled_by_default !== false;
        }
        
        log('New preferences initialized with defaults');
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

    // ============== SIMPLE DASHBOARD ==============
    function createSimpleDashboard() {
        const style = `
            .skrining-auto-dashboard {
                position: fixed;
                top: 10px;
                right: 10px;
                background: white;
                border: 2px solid #4CAF50;
                border-radius: 8px;
                padding: 15px;
                z-index: 999999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                font-family: Arial, sans-serif;
                min-width: 300px;
                max-width: 400px;
            }
            .skrining-auto-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #eee;
            }
            .skrining-auto-title {
                font-size: 16px;
                font-weight: bold;
                color: #2E7D32;
            }
            .skrining-auto-btn {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            .skrining-auto-btn:hover {
                background: #388E3C;
            }
            .skrining-auto-module {
                margin: 8px 0;
                padding: 8px;
                background: #f9f9f9;
                border-radius: 4px;
                border-left: 3px solid #4CAF50;
            }
            .skrining-auto-module-name {
                font-weight: bold;
                margin-bottom: 4px;
            }
            .skrining-auto-module-desc {
                font-size: 12px;
                color: #666;
                margin-bottom: 4px;
            }
            .skrining-auto-status {
                font-size: 11px;
                color: #888;
            }
            .skrining-auto-toggle {
                margin-right: 8px;
                transform: scale(0.8);
            }
        `;
        
        GM_addStyle(style);
        
        const dashboard = document.createElement('div');
        dashboard.className = 'skrining-auto-dashboard';
        dashboard.innerHTML = `
            <div class="skrining-auto-header">
                <div class="skrining-auto-title">Skrining Auto Loader</div>
                <button class="skrining-auto-btn" id="skrining-refresh">Refresh</button>
            </div>
            <div id="skrining-modules-list">
                Loading modules...
            </div>
        `;
        
        document.body.appendChild(dashboard);
        
        // Refresh button
        document.getElementById('skrining-refresh').addEventListener('click', async () => {
            await init();
        });
        
        return dashboard;
    }

    function updateDashboard() {
        const modulesList = document.getElementById('skrining-modules-list');
        if (!modulesList) return;
        
        let html = '';
        
        for (const [moduleId, moduleConfig] of Object.entries(modules)) {
            const isEnabled = enabledModules[moduleId] !== false;
            const isMatched = shouldLoadModule(moduleConfig, window.location.href);
            
            html += `
                <div class="skrining-auto-module">
                    <div>
                        <input type="checkbox" 
                               class="skrining-auto-toggle" 
                               data-module="${moduleId}"
                               ${isEnabled ? 'checked' : ''}>
                        <span class="skrining-auto-module-name">${moduleConfig.name || moduleId}</span>
                    </div>
                    <div class="skrining-auto-module-desc">${moduleConfig.description || 'No description'}</div>
                    <div class="skrining-auto-status">
                        Status: ${isEnabled ? 'Enabled' : 'Disabled'} | 
                        Match: ${isMatched ? '✓' : '✗'} | 
                        Ver: ${moduleConfig.version || '1.0.0'}
                    </div>
                </div>
            `;
        }
        
        if (Object.keys(modules).length === 0) {
            html = '<div>No modules loaded</div>';
        }
        
        modulesList.innerHTML = html;
        
        // Add event listeners to toggles
        document.querySelectorAll('.skrining-auto-toggle').forEach(toggle => {
            toggle.addEventListener('change', function() {
                const moduleId = this.getAttribute('data-module');
                enabledModules[moduleId] = this.checked;
                savePreferences();
                
                // Reload modules if toggled
                if (this.checked) {
                    checkAndLoadModules();
                }
            });
        });
    }

    // ============== INITIALIZATION ==============
    async function init() {
        log('Initializing Skrining Auto Loader v' + CONFIG.VERSION);
        
        try {
            // Load preferences
            loadPreferences();
            
            // Load manifest
            await loadManifest();
            
            // Create dashboard
            createSimpleDashboard();
            
            // Update dashboard with module list
            updateDashboard();
            
            // Check and load modules for current URL
            await checkAndLoadModules();
            
            log('Loader initialized successfully');
        } catch (e) {
            error('Initialization failed:', e);
            
            // Show error in dashboard
            const modulesList = document.getElementById('skrining-modules-list');
            if (modulesList) {
                modulesList.innerHTML = `
                    <div style="color: red; padding: 10px; background: #ffe6e6; border-radius: 4px;">
                        Error loading modules: ${e.message}<br>
                        Using cached modules if available.
                    </div>
                `;
            }
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
