// ==UserScript==
// @name         PKMK Dashboard Dark Theme
// @version      1.0.0
// @description  Dark mode theme untuk dashboard PKMKedawung
// @author       cobrabagaskara
// @match        https://cirebon.epuskesmas.id/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';
    
    // ============== CONFIG ==============
    const THEME_CONFIG = {
        theme: GM_getValue('dashboard_theme', 'auto'), // auto, light, dark
        toggleHotkey: 'Ctrl+Shift+T',
        version: '1.0.0'
    };
    
    // ============== DARK THEME CSS ==============
    const DARK_THEME_CSS = `
        /* Dark Theme untuk Dashboard PKMKedawung */
        #skrining-auto-dashboard {
            background: #1e1e1e !important;
            border-color: #333 !important;
            color: #e0e0e0 !important;
        }
        
        #skrining-dashboard-header {
            background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%) !important;
            color: white !important;
        }
        
        .skrining-module-card {
            background: #2d2d2d !important;
            border-color: #444 !important;
            color: #e0e0e0 !important;
        }
        
        .skrining-module-card:hover {
            background: #363636 !important;
            border-color: #4CAF50 !important;
        }
        
        .skrining-module-name {
            color: #4CAF50 !important;
        }
        
        .skrining-module-desc {
            color: #aaa !important;
        }
        
        .skrining-module-meta {
            color: #888 !important;
        }
        
        .skrining-module-match {
            background: #0d47a1 !important;
            color: #bbdefb !important;
        }
        
        .skrining-module-match.matched {
            background: #1b5e20 !important;
            color: #c8e6c9 !important;
        }
        
        #skrining-dashboard-content {
            background: #1e1e1e !important;
        }
        
        /* Toggle Switch Dark Mode */
        .skrining-slider {
            background-color: #555 !important;
        }
        
        .skrining-toggle input:checked + .skrining-slider {
            background-color: #4CAF50 !important;
        }
        
        /* Footer */
        #skrining-auto-dashboard > div:last-child {
            background: #252525 !important;
            border-color: #333 !important;
            color: #aaa !important;
        }
        
        /* Notification */
        .skrining-notification {
            background: #333 !important;
            color: white !important;
            border-color: #444 !important;
        }
        
        /* Theme Toggle Button */
        .theme-toggle-btn {
            background: #333 !important;
            color: #4CAF50 !important;
            border: 1px solid #444 !important;
        }
        
        /* Scrollbar */
        #skrining-dashboard-content::-webkit-scrollbar {
            width: 8px;
        }
        
        #skrining-dashboard-content::-webkit-scrollbar-track {
            background: #2d2d2d;
        }
        
        #skrining-dashboard-content::-webkit-scrollbar-thumb {
            background: #4CAF50;
            border-radius: 4px;
        }
        
        /* Theme Selector UI */
        .theme-selector {
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 10px;
            margin: 10px 0;
        }
        
        .theme-option {
            display: inline-block;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            margin: 5px;
            cursor: pointer;
            border: 2px solid transparent;
        }
        
        .theme-option:hover {
            transform: scale(1.1);
        }
        
        .theme-option.active {
            border-color: #4CAF50;
            box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3);
        }
        
        .theme-dark { background: #1e1e1e; }
        .theme-light { background: #ffffff; }
        .theme-blue { background: #0d47a1; }
        .theme-green { background: #1b5e20; }
        .theme-purple { background: #4a148c; }
    `;
    
    // ============== BLUE THEME (Contoh tema lain) ==============
    const BLUE_THEME_CSS = `
        #skrining-auto-dashboard {
            background: #e3f2fd !important;
            border-color: #2196F3 !important;
        }
        
        #skrining-dashboard-header {
            background: linear-gradient(135deg, #1976D2 0%, #0D47A1 100%) !important;
        }
        
        .skrining-module-card {
            background: #bbdefb !important;
            border-color: #90caf9 !important;
        }
    `;
    
    // ============== FUNCTIONS ==============
    function waitForDashboard() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const dashboard = document.getElementById('skrining-auto-dashboard');
                if (dashboard) {
                    clearInterval(checkInterval);
                    resolve(dashboard);
                }
            }, 500);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(null);
            }, 10000);
        });
    }
    
    function applyTheme(themeName) {
        // Remove existing theme
        const existingTheme = document.getElementById('dashboard-theme-style');
        if (existingTheme) existingTheme.remove();
        
        if (themeName === 'dark') {
            GM_addStyle(DARK_THEME_CSS);
        } else if (themeName === 'blue') {
            GM_addStyle(BLUE_THEME_CSS);
        }
        // Light theme = tidak inject CSS (default)
        
        // Save preference
        GM_setValue('dashboard_theme', themeName);
        
        // Update toggle button if exists
        updateThemeToggle(themeName);
        
        console.log(`[Dashboard Theme] Applied: ${themeName}`);
    }
    
    function addThemeToggle(dashboard) {
        const header = dashboard.querySelector('#skrining-dashboard-header');
        if (!header) return;
        
        // Create theme toggle button
        const themeBtn = document.createElement('button');
        themeBtn.id = 'themeToggleBtn';
        themeBtn.className = 'theme-toggle-btn';
        themeBtn.innerHTML = '🌓';
        themeBtn.title = 'Toggle theme (Ctrl+Shift+T)';
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
        
        // Insert after refresh button
        const refreshBtn = header.querySelector('#skrining-refresh-btn');
        if (refreshBtn) {
            refreshBtn.parentNode.insertBefore(themeBtn, refreshBtn.nextSibling);
        } else {
            header.appendChild(themeBtn);
        }
        
        // Theme selector dropdown (hidden by default)
        const themeSelector = document.createElement('div');
        themeSelector.id = 'themeSelector';
        themeSelector.style.cssText = `
            position: absolute;
            top: 50px;
            right: 10px;
            background: white;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 1000001;
            display: none;
            min-width: 150px;
        `;
        
        themeSelector.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 10px; color: #333;">Select Theme:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <div class="theme-option theme-light" data-theme="light" title="Light Mode">☀️</div>
                <div class="theme-option theme-dark" data-theme="dark" title="Dark Mode">🌙</div>
                <div class="theme-option theme-blue" data-theme="blue" title="Blue Theme">🔵</div>
                <div class="theme-option theme-green" data-theme="green" title="Green Theme">🟢</div>
                <div class="theme-option theme-purple" data-theme="purple" title="Purple Theme">🟣</div>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #666;">
                Auto: <input type="checkbox" id="themeAuto">
            </div>
        `;
        
        dashboard.appendChild(themeSelector);
        
        // Event listeners
        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = themeSelector.style.display === 'block';
            themeSelector.style.display = isVisible ? 'none' : 'block';
        });
        
        // Theme option clicks
        themeSelector.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', function() {
                const theme = this.getAttribute('data-theme');
                applyTheme(theme);
                
                // Update active state
                themeSelector.querySelectorAll('.theme-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                this.classList.add('active');
                
                // Hide selector
                themeSelector.style.display = 'none';
            });
        });
        
        // Auto theme toggle
        const autoToggle = themeSelector.querySelector('#themeAuto');
        autoToggle.addEventListener('change', function() {
            if (this.checked) {
                applyAutoTheme();
            }
        });
        
        // Close selector when clicking outside
        document.addEventListener('click', function(e) {
            if (!themeSelector.contains(e.target) && e.target !== themeBtn) {
                themeSelector.style.display = 'none';
            }
        });
        
        // Hotkey for theme toggle
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                toggleTheme();
            }
        });
        
        // Set initial active theme
        const currentTheme = GM_getValue('dashboard_theme', 'light');
        const activeOption = themeSelector.querySelector(`[data-theme="${currentTheme}"]`);
        if (activeOption) activeOption.classList.add('active');
    }
    
    function updateThemeToggle(themeName) {
        const themeBtn = document.getElementById('themeToggleBtn');
        if (!themeBtn) return;
        
        const icons = {
            light: '☀️',
            dark: '🌙', 
            blue: '🔵',
            green: '🟢',
            purple: '🟣'
        };
        
        themeBtn.innerHTML = icons[themeName] || '🎨';
    }
    
    function toggleTheme() {
        const current = GM_getValue('dashboard_theme', 'light');
        const themes = ['light', 'dark', 'blue', 'green', 'purple'];
        const currentIndex = themes.indexOf(current);
        const nextIndex = (currentIndex + 1) % themes.length;
        
        applyTheme(themes[nextIndex]);
    }
    
    function applyAutoTheme() {
        // Auto detect based on system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const hour = new Date().getHours();
        
        let theme = 'light';
        if (prefersDark) {
            theme = 'dark';
        } else if (hour >= 18 || hour < 6) {
            theme = 'dark'; // Night time
        }
        
        applyTheme(theme);
    }
    
    // ============== INITIALIZATION ==============
    async function init() {
        console.log('[Dashboard Theme] Initializing...');
        
        // Wait for dashboard
        const dashboard = await waitForDashboard();
        if (!dashboard) {
            console.warn('[Dashboard Theme] Dashboard not found');
            return;
        }
        
        // Add theme toggle button
        addThemeToggle(dashboard);
        
        // Apply saved theme
        const savedTheme = GM_getValue('dashboard_theme', 'light');
        if (savedTheme !== 'light') {
            applyTheme(savedTheme);
        }
        
        // Auto theme if enabled
        if (GM_getValue('theme_auto', false)) {
            applyAutoTheme();
        }
        
        console.log('[Dashboard Theme] Ready!');
    }
    
    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
    
})();
