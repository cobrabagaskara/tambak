(function() {
    'use strict';

    // ============== CONFIG ==============
    const THEME_CONFIG = {
        theme: GM_getValue('dashboard_theme', 'light'),
        version: '1.1.0'
    };

    // ============== THEME DEFINITIONS ==============
    const THEMES = {
        dark: `
            /* DARK THEME - HIGH SPECIFICITY */
            body #skrining-auto-dashboard,
            body #skrining-auto-dashboard.dashboard-loaded {
                background: #1e1e1e !important;
                border-color: #333 !important;
                color: #e0e0e0 !important;
            }
            body #skrining-dashboard-header {
                background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%) !important;
            }
            body .skrining-module-card {
                background: #2d2d2d !important;
                border-color: #444 !important;
                color: #e0e0e0 !important;
            }
            body .skrining-module-name {
                color: #4CAF50 !important;
            }
        `,

        blue: `
            /* BLUE THEME */
            body #skrining-auto-dashboard,
            body #skrining-auto-dashboard.dashboard-loaded {
                background: #e3f2fd !important;
                border-color: #2196F3 !important;
            }
            body #skrining-dashboard-header {
                background: linear-gradient(135deg, #1976D2 0%, #0D47A1 100%) !important;
            }
            body .skrining-module-card {
                background: #bbdefb !important;
                border-color: #90caf9 !important;
                color: #0d47a1 !important;
            }
            body .skrining-module-name {
                color: #1565c0 !important;
                font-weight: bold !important;
            }
        `,

        green: `
            /* GREEN THEME - EXTRA SPECIFIC */
            body #skrining-auto-dashboard,
            body #skrining-auto-dashboard.dashboard-loaded,
            html body #skrining-auto-dashboard {
                background: #e8f5e9 !important;
                border-color: #4CAF50 !important;
            }
            body #skrining-dashboard-header {
                background: linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%) !important;
            }
            body .skrining-module-card,
            #skrining-dashboard-content .skrining-module-card {
                background: #c8e6c9 !important;
                border-color: #a5d6a7 !important;
                color: #1b5e20 !important;
            }
            body .skrining-module-name,
            .skrining-module-header .skrining-module-name {
                color: #1b5e20 !important;
                font-weight: bold !important;
                text-shadow: 0 1px 1px rgba(0,0,0,0.1) !important;
            }
        `,

        purple: `
            /* PURPLE THEME */
            body #skrining-auto-dashboard,
            body #skrining-auto-dashboard.dashboard-loaded {
                background: #f3e5f5 !important;
                border-color: #9C27B0 !important;
            }
            body #skrining-dashboard-header {
                background: linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%) !important;
            }
            body .skrining-module-card {
                background: #e1bee7 !important;
                border-color: #ce93d8 !important;
                color: #4a148c !important;
            }
            body .skrining-module-name {
                color: #7b1fa2 !important;
                font-weight: bold !important;
            }
        `,

        orange: `
            /* ORANGE THEME */
            body #skrining-auto-dashboard {
                background: #fff3e0 !important;
                border-color: #ff9800 !important;
            }
            body #skrining-dashboard-header {
                background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%) !important;
            }
            body .skrining-module-card {
                background: #ffe0b2 !important;
                border-color: #ffcc80 !important;
                color: #e65100 !important;
            }
        `,

        pink: `
            /* PINK THEME */
            body #skrining-auto-dashboard {
                background: #fce4ec !important;
                border-color: #e91e63 !important;
            }
            body #skrining-dashboard-header {
                background: linear-gradient(135deg, #c2185b 0%, #880e4f 100%) !important;
            }
            body .skrining-module-card {
                background: #f8bbd0 !important;
                border-color: #f48fb1 !important;
                color: #880e4f !important;
            }
        `,

        gray: `
            /* GRAY/MONOCHROME THEME */
            body #skrining-auto-dashboard {
                background: #f5f5f5 !important;
                border-color: #9e9e9e !important;
                color: #212121 !important;
            }
            body #skrining-dashboard-header {
                background: linear-gradient(135deg, #616161 0%, #424242 100%) !important;
            }
            body .skrining-module-card {
                background: #eeeeee !important;
                border-color: #e0e0e0 !important;
                color: #424242 !important;
            }
        `
    };

    // ============== IMPROVED FUNCTIONS ==============
    let currentThemeStyle = null;

    function applyTheme(themeName) {
        // 1. Remove old theme
        if (currentThemeStyle && currentThemeStyle.parentNode) {
            currentThemeStyle.remove();
        }

        // 2. Skip if light theme (default)
        if (themeName === 'light') {
            GM_setValue('dashboard_theme', 'light');
            updateThemeButton('light');
            return;
        }

        // 3. Get theme CSS
        const themeCSS = THEMES[themeName];
        if (!themeCSS) {
            console.warn(`[Theme] Unknown theme: ${themeName}`);
            return;
        }

        // 4. Create new style with unique ID and timestamp
        currentThemeStyle = document.createElement('style');
        currentThemeStyle.id = `dashboard-theme-${themeName}-${Date.now()}`;
        currentThemeStyle.textContent = themeCSS;

        // 5. Inject into head
        document.head.appendChild(currentThemeStyle);

        // 6. Mark dashboard as themed
        const dashboard = document.getElementById('skrining-auto-dashboard');
        if (dashboard) {
            dashboard.classList.add('dashboard-themed', `theme-${themeName}`);
            dashboard.classList.remove(...Object.keys(THEMES).map(t => `theme-${t}`).filter(t => t !== `theme-${themeName}`));

            // Force reflow for green theme especially
            if (themeName === 'green') {
                void dashboard.offsetHeight;
            }
        }

        // 7. Save preference
        GM_setValue('dashboard_theme', themeName);

        // 8. Update UI
        updateThemeButton(themeName);
        updateThemeSelector(themeName);

        console.log(`[Theme] Applied: ${themeName}`);
    }

    function updateThemeButton(themeName) {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;

        const icons = {
            light: '☀️', dark: '🌙', blue: '🔵',
            green: '🟢', purple: '🟣', orange: '🟠',
            pink: '💖', gray: '⚫'
        };

        btn.innerHTML = icons[themeName] || '🎨';
        btn.title = `Theme: ${themeName} (Ctrl+Shift+T)`;
    }

    // ============== ENHANCED DASHBOARD WAITER ==============
    function waitForDashboardEnhanced() {
        return new Promise((resolve) => {
            // Method 1: Check existing
            const existing = document.getElementById('skrining-auto-dashboard');
            if (existing) {
                console.log('[Theme] Dashboard already exists');
                resolve(existing);
                return;
            }

            // Method 2: Mutation Observer
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.id === 'skrining-auto-dashboard') {
                                observer.disconnect();
                                console.log('[Theme] Dashboard detected via observer');
                                resolve(node);
                            }
                        });
                    }
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Method 3: Fallback interval
            const interval = setInterval(() => {
                const dashboard = document.getElementById('skrining-auto-dashboard');
                if (dashboard) {
                    clearInterval(interval);
                    observer.disconnect();
                    console.log('[Theme] Dashboard found via interval');
                    resolve(dashboard);
                }
            }, 500);

            // Timeout after 15 seconds
            setTimeout(() => {
                clearInterval(interval);
                observer.disconnect();
                console.warn('[Theme] Dashboard not found after 15s');
                resolve(null);
            }, 15000);
        });
    }

    // ============== THEME SELECTOR UI ==============
    function addThemeSelector(dashboard) {
        const header = dashboard.querySelector('#skrining-dashboard-header');
        if (!header) return;

        // Create theme button
        const themeBtn = document.createElement('button');
        themeBtn.id = 'themeToggleBtn';
        themeBtn.innerHTML = '🎨';
        themeBtn.title = 'Change theme (Ctrl+Shift+T)';
        themeBtn.style.cssText = `
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 8px;
            transition: all 0.2s;
        `;

        // Insert button
        const refreshBtn = header.querySelector('#skrining-refresh-btn');
        if (refreshBtn && refreshBtn.parentNode) {
            refreshBtn.parentNode.insertBefore(themeBtn, refreshBtn.nextSibling);
        } else {
            header.appendChild(themeBtn);
        }

        // Create theme selector panel
        const selector = document.createElement('div');
        selector.id = 'themeSelectorPanel';
        selector.style.cssText = `
            position: absolute;
            top: 50px;
            right: 10px;
            background: white;
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 5px 25px rgba(0,0,0,0.2);
            z-index: 1000001;
            display: none;
            min-width: 200px;
            max-height: 400px;
            overflow-y: auto;
        `;

        // Build theme options
        let themeOptions = '<div style="font-weight: bold; margin-bottom: 12px; color: #333;">🎨 Select Theme:</div>';
        themeOptions += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">';

        Object.keys(THEMES).forEach(theme => {
            themeOptions += `
                <div class="theme-option" data-theme="${theme}"
                     style="padding: 10px; border-radius: 8px; cursor: pointer; text-align: center; border: 2px solid #eee;"
                     onmouseover="this.style.borderColor='#4CAF50'"
                     onmouseout="this.style.borderColor='#eee'">
                    <div style="font-size: 20px; margin-bottom: 5px;">
                        ${getThemeIcon(theme)}
                    </div>
                    <div style="font-size: 11px; text-transform: capitalize;">${theme}</div>
                </div>
            `;
        });

        themeOptions += '</div>';
        themeOptions += `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
                <label style="font-size: 12px; color: #666; display: flex; align-items: center;">
                    <input type="checkbox" id="themeAutoToggle" style="margin-right: 8px;">
                    Auto-theme (follows system)
                </label>
            </div>
        `;

        selector.innerHTML = themeOptions;
        dashboard.appendChild(selector);

        // Event Listeners
        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = selector.style.display === 'block';
            selector.style.display = isVisible ? 'none' : 'block';
        });

        // Theme option clicks
        selector.querySelectorAll('.theme-option').forEach(opt => {
            opt.addEventListener('click', function() {
                const theme = this.getAttribute('data-theme');
                applyTheme(theme);
                selector.style.display = 'none';

                // Highlight selected
                selector.querySelectorAll('.theme-option').forEach(o => {
                    o.style.borderColor = '#eee';
                    o.style.background = '';
                });
                this.style.borderColor = '#4CAF50';
                this.style.background = '#f1f8e9';
            });
        });

        // Auto-theme toggle
        const autoToggle = selector.querySelector('#themeAutoToggle');
        autoToggle.checked = GM_getValue('theme_auto', false);
        autoToggle.addEventListener('change', function() {
            GM_setValue('theme_auto', this.checked);
            if (this.checked) applyAutoTheme();
        });

        // Close when clicking outside
        document.addEventListener('click', function(e) {
            if (!selector.contains(e.target) && e.target !== themeBtn) {
                selector.style.display = 'none';
            }
        });

        // Hotkey
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                cycleThemes();
            }
        });

        console.log('[Theme] Selector UI added');
    }

    function getThemeIcon(theme) {
        const icons = {
            light: '☀️', dark: '🌙', blue: '🔵',
            green: '🟢', purple: '🟣', orange: '🟠',
            pink: '💖', gray: '⚫'
        };
        return icons[theme] || '🎨';
    }

    function updateThemeSelector(themeName) {
        const panel = document.getElementById('themeSelectorPanel');
        if (!panel) return;

        panel.querySelectorAll('.theme-option').forEach(opt => {
            if (opt.getAttribute('data-theme') === themeName) {
                opt.style.borderColor = '#4CAF50';
                opt.style.background = '#f1f8e9';
            } else {
                opt.style.borderColor = '#eee';
                opt.style.background = '';
            }
        });
    }

    function cycleThemes() {
        const themes = Object.keys(THEMES);
        const current = GM_getValue('dashboard_theme', 'light');
        const currentIndex = themes.indexOf(current);
        const nextIndex = (currentIndex + 1) % themes.length;

        applyTheme(themes[nextIndex]);
    }

    function applyAutoTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const hour = new Date().getHours();
        const isNight = hour >= 18 || hour < 6;

        let theme = 'light';
        if (prefersDark && isNight) theme = 'dark';
        else if (prefersDark) theme = 'blue';
        else if (isNight) theme = 'dark';

        applyTheme(theme);
    }

    // ============== INITIALIZATION ==============
    async function init() {
        console.log('[Theme v' + THEME_CONFIG.version + '] Initializing...');

        // Wait for dashboard
        const dashboard = await waitForDashboardEnhanced();
        if (!dashboard) {
            console.warn('[Theme] Dashboard not found, retrying in 3s...');
            setTimeout(init, 3000);
            return;
        }

        // Add theme selector
        addThemeSelector(dashboard);

        // Apply saved theme
        const savedTheme = GM_getValue('dashboard_theme', 'light');
        if (savedTheme !== 'light') {
            // Small delay to ensure dashboard is fully rendered
            setTimeout(() => applyTheme(savedTheme), 300);
        }

        // Auto theme if enabled
        if (GM_getValue('theme_auto', false)) {
            setTimeout(() => applyAutoTheme(), 500);
        }

        console.log('[Theme] Ready!');

        // Re-apply theme if dashboard gets recreated
        const backupApply = () => {
            const theme = GM_getValue('dashboard_theme', 'light');
            if (theme !== 'light') {
                setTimeout(() => applyTheme(theme), 100);
            }
        };

        // Reapply when modules are refreshed
        const refreshBtn = document.getElementById('skrining-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', backupApply);
        }
    }

    // ============== START ==============
    // Run at document-end to ensure dashboard exists
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Small delay to let loader initialize
        setTimeout(init, 1500);
    }

})();