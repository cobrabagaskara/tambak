// ============================================================
// Jamu Loader — Background Service Worker v1.1.0
// ============================================================

const DEFAULT_CHECK_INTERVAL = 60; // minutes
const ALARM_NAME = "jamuloader-version-check";
const EXTENSION_VERSION = "1.1.0";

// Tracking config — dibaca dari manifest, tidak hardcode
let TRACKING_ENDPOINT = "";
let TRACKING_KEY      = "";

// Whitelist cache — di-fetch dari URL di manifest
let whitelistCache    = null;
let whitelistSelector = "#menu_user .label-default";

function log(...args) { console.log("[JamuLoader BG]", ...args); }
async function getStorage(keys) { return new Promise((res) => chrome.storage.local.get(keys, res)); }
async function setStorage(obj)  { return new Promise((res) => chrome.storage.local.set(obj, res)); }

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally { clearTimeout(timer); }
}

// ── Manifest ─────────────────────────────────────────────────

async function refreshManifest() {
  const { manifestUrl } = await getStorage(["manifestUrl"]);
  if (!manifestUrl) { log("No manifest URL configured."); return null; }
  try {
    const res      = await fetchWithTimeout(manifestUrl);
    const manifest = await res.json();
    await setStorage({ cachedManifest: manifest, lastManifestFetch: Date.now() });
    log("Manifest refreshed:", manifest);
    loadConfigFromManifest(manifest);
    await checkMinVersion(manifest);
    await checkForUpdates(manifest);
    return manifest;
  } catch (err) { log("Error fetching manifest:", err.message); return null; }
}

function loadConfigFromManifest(manifest) {
  // Tracking
  if (manifest.tracking?.endpoint) {
    TRACKING_ENDPOINT = manifest.tracking.endpoint;
    TRACKING_KEY      = manifest.tracking.key || "";
    log("Tracking config loaded from manifest");
  } else {
    TRACKING_ENDPOINT = "";
    TRACKING_KEY      = "";
  }

  // Whitelist
  if (manifest.whitelist?.selector) {
    whitelistSelector = manifest.whitelist.selector;
  }

  // Reset whitelist cache setiap manifest refresh agar selalu fresh
  whitelistCache = null;
}

// ── Min Version Check ─────────────────────────────────────────
// Jika manifest mendefinisikan minExtensionVersion dan versi extension
// lebih lama → tampilkan notifikasi dan blokir semua injeksi.

async function checkMinVersion(manifest) {
  if (!manifest.minExtensionVersion) return;
  const required = manifest.minExtensionVersion;
  if (versionLessThan(EXTENSION_VERSION, required)) {
    log(`Extension version ${EXTENSION_VERSION} < required ${required} — blocking all modules`);
    await setStorage({ versionBlocked: true, versionRequired: required });
    chrome.notifications.create("jamuloader-version-blocked", {
      type:     "basic",
      iconUrl:  "icons/icon48.png",
      title:    "Jamu Loader — Update Diperlukan",
      message:  `Versi extension Anda (${EXTENSION_VERSION}) sudah tidak didukung. Silakan install versi terbaru (${required}).`,
      priority: 2,
    });
  } else {
    await setStorage({ versionBlocked: false, versionRequired: required });
  }
}

function versionLessThan(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na < nb) return true;
    if (na > nb) return false;
  }
  return false;
}

// ── Whitelist ─────────────────────────────────────────────────
// Fetch whitelist.json dari GitHub (cache di memory selama service worker hidup).
// Whitelist hanya berlaku untuk modul yang matches-nya mengandung "epuskesmas.id".
// Modul lain (BPJS, Google, dll) bebas — tidak dicek whitelist.

async function fetchWhitelist(url) {
  if (whitelistCache !== null) return whitelistCache;
  try {
    const res  = await fetchWithTimeout(url);
    whitelistCache = await res.json(); // array of string
    log("Whitelist loaded:", whitelistCache);
    return whitelistCache;
  } catch (err) {
    log("Error fetching whitelist:", err.message);
    return null; // null = gagal fetch, biarkan lolos (fail open)
  }
}

function isEpuskesmasModule(mod) {
  return (mod.matches || []).some(p => p.includes("epuskesmas.id"));
}

// Ekstrak info puskesmas dari fungsi openBantuan() di halaman ePuskesmas.
// URL WhatsApp punya pola:
//   ...ePuskesmas:%20[nama_user],%20[jabatan]%20(pkm...)%20-%20[kode]%20[nama_pkm]%20-%20...
// Return: { kode, namaUser, namaPkm } atau null jika tidak ditemukan.
async function readEpuskesmasInfoFromTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world:  "MAIN",
      func: () => {
        // Ambil source kode fungsi openBantuan dari script tags
        const scripts = Array.from(document.querySelectorAll("script"));
        for (const s of scripts) {
          const src = s.textContent || "";
          if (!src.includes("openBantuan") && !src.includes("notif_wa")) continue;

          // Cari URL WhatsApp di dalam source
          const urlMatch = src.match(/https:\/\/api\.whatsapp\.com\/send\/\?[^"'\s]+/);
          if (!urlMatch) continue;

          const waUrl = decodeURIComponent(urlMatch[0]);
          // Pola: "ePuskesmas: Nama User - KODE NAMA_PKM -"
          const m = waUrl.match(/ePuskesmas:\s*(.+?)\s*\(pkm[^)]*\)\s*-\s*(\d+)\s+([A-Z\s]+?)\s*-/i);
          if (m) {
            return {
              namaUser: m[1].trim(),
              kode:     m[2].trim(),
              namaPkm:  m[3].trim()
            };
          }
        }
        return null;
      }
    });
    return results?.[0]?.result || null;
  } catch {
    return null;
  }
}

// ── Version Checking ─────────────────────────────────────────

async function checkForUpdates(manifest) {
  const { installedVersions = {}, moduleStates = {} } = await getStorage(["installedVersions", "moduleStates"]);
  const modules = manifest.modules || [];
  const updatesFound = [];
  let moduleStatesChanged = false;

  for (const mod of modules) {
    const installed = installedVersions[mod.id];
    if (installed === undefined) {
      installedVersions[mod.id] = mod.version;
      log(`New module registered: ${mod.id} @ ${mod.version}`);
      if (mod.defaultEnabled === false) {
        moduleStates[mod.id] = false;
        moduleStatesChanged = true;
      }
    } else if (installed !== mod.version) {
      updatesFound.push(mod);
      log(`Update detected: ${mod.id}  installed=${installed}  latest=${mod.version}`);
    }
  }

  await setStorage({ installedVersions });
  if (moduleStatesChanged) await setStorage({ moduleStates });

  const { pendingUpdates: existing = [] } = await getStorage(["pendingUpdates"]);
  const merged = [...new Set([...existing, ...updatesFound.map((m) => m.id)])];
  await setStorage({ pendingUpdates: merged });

  if (merged.length > 0) await setBadge(merged.length.toString(), "#f59e0b");
  else await clearBadge();

  if (updatesFound.length > 0) {
    chrome.notifications.create("jamuloader-update-" + Date.now(), {
      type:     "basic",
      iconUrl:  "icons/icon48.png",
      title:    "Jamu Loader — Module Updates Available",
      message:  `${updatesFound.length} module(s) have new versions: ${updatesFound.map((m) => m.name).join(", ")}`,
      priority: 1,
    });
  }
}

async function setBadge(text, color = "#ef4444") {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}
async function clearBadge() { chrome.action.setBadgeText({ text: "" }); }

// ── Script Cache ─────────────────────────────────────────────

async function fetchAndCacheScript(mod) {
  log(`Fetching script: ${mod.id} v${mod.version}`);
  const res  = await fetchWithTimeout(mod.scriptUrl);
  const code = await res.text();
  await setStorage({ [`script_${mod.id}`]: { code, version: mod.version, fetchedAt: Date.now() } });
  return code;
}

async function getModuleScript(mod) {
  const { [`script_${mod.id}`]: cached } = await getStorage([`script_${mod.id}`]);
  if (cached && cached.version === mod.version) return cached.code;
  return await fetchAndCacheScript(mod);
}

// ── Tracking ─────────────────────────────────────────────────

function todayDate() { return new Date().toISOString().slice(0, 10); }

async function shouldTrack(moduleId, username) {
  if (!TRACKING_ENDPOINT) return false;
  const { trackingLog = {} } = await getStorage(["trackingLog"]);
  return trackingLog[`${moduleId}::${username}`] !== todayDate();
}

async function markTracked(moduleId, username) {
  const { trackingLog = {} } = await getStorage(["trackingLog"]);
  trackingLog[`${moduleId}::${username}`] = todayDate();
  await setStorage({ trackingLog });
}

async function sendTracking(moduleId, moduleName, tabUrl, username, hostname) {
  if (!TRACKING_ENDPOINT) return;
  try {
    await fetch(TRACKING_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: TRACKING_KEY, timestamp: Date.now(),
        moduleId, moduleName, url: tabUrl, username, hostname
      })
    });
    log(`Tracking sent: ${moduleId} by ${username}`);
  } catch (err) { log(`Tracking failed (silent): ${err.message}`); }
}

// Baca username dari DOM via selector biasa (untuk non-ePuskesmas)
async function readUsernameFromTab(tabId, userSelector) {
  if (!userSelector) return "-";
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world:  "MAIN",
      func: (selector) => {
        const el = document.querySelector(selector);
        if (!el) return "-";
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) return text;
          }
        }
        return el.textContent.trim() || "-";
      },
      args: [userSelector]
    });
    return results?.[0]?.result || "-";
  } catch { return "-"; }
}

// ── First-Run Notice ─────────────────────────────────────────

async function maybeShowFirstRunNotice(tabId) {
  if (!TRACKING_ENDPOINT) return;
  const { firstRunNoticeSeen } = await getStorage(["firstRunNoticeSeen"]);
  if (firstRunNoticeSeen) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world:  "MAIN",
      func: () => {
        if (document.getElementById("jamu-first-run-notice")) return;
        const overlay = document.createElement("div");
        overlay.id = "jamu-first-run-notice";
        overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif";
        const box = document.createElement("div");
        box.style.cssText = "background:#0d0f12;border:1px solid rgba(0,212,170,0.4);border-radius:12px;padding:28px 32px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.6);color:#c8d0db";
        box.innerHTML = `
          <div style="font-size:20px;font-weight:bold;color:#00d4aa;margin-bottom:6px;">🍵 Jamu Loader</div>
          <div style="font-size:14px;font-weight:600;color:#e8edf3;margin-bottom:14px;">Pemberitahuan Penggunaan Data</div>
          <p style="font-size:13px;line-height:1.8;color:#b8c5d3;margin-bottom:20px;">
            Extension ini mencatat <strong style="color:#fff">nama akun</strong> dan
            <strong style="color:#fff">modul yang dijalankan</strong> untuk keperluan
            monitoring penggunaan internal.<br><br>
            Pencatatan hanya dilakukan <strong style="color:#fff">1 kali per hari</strong>
            per modul. Data hanya diakses oleh administrator dan tidak disebarkan ke pihak lain.
          </p>
          <div style="display:flex;justify-content:flex-end">
            <button id="jamu-notice-btn" style="padding:10px 28px;background:#00d4aa;border:none;border-radius:8px;color:#000;font-size:14px;font-weight:700;cursor:pointer;">
              Saya Mengerti
            </button>
          </div>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        document.getElementById("jamu-notice-btn").addEventListener("click", () => {
          overlay.style.opacity = "0";
          overlay.style.transition = "opacity 0.3s";
          setTimeout(() => overlay.remove(), 300);
        });
      }
    });
    await setStorage({ firstRunNoticeSeen: true });
    log("First-run notice shown");
  } catch (err) {
    log("First-run notice failed:", err.message);
    await setStorage({ firstRunNoticeSeen: true });
  }
}

// ── Inject ───────────────────────────────────────────────────

async function injectModulesIntoTab(tabId, tabUrl) {
  // Cek version block
  const { versionBlocked, cachedManifest, moduleStates = {} } = await getStorage(["versionBlocked", "cachedManifest", "moduleStates"]);
  if (versionBlocked) { log("Injection blocked — extension version too old"); return; }
  if (!cachedManifest) return;

  // Ambil whitelist URL dari manifest (jika ada)
  const whitelistUrl = cachedManifest.whitelist?.url || null;

  // Info ePuskesmas — dibaca sekali per tab, dipakai untuk whitelist + tracking
  // { kode, namaUser, namaPkm } atau null
  let epuskesmasInfo = null;
  let epuskesmasInfoFetched = false;

  let firstInjection = true;

  for (const mod of cachedManifest.modules || []) {
    if (moduleStates[mod.id] === false) continue;
    const shouldInject = (mod.matches || []).some((p) => matchUrlPattern(p, tabUrl));
    if (!shouldInject) continue;

    // ── Cek whitelist hanya untuk modul ePuskesmas ──
    if (isEpuskesmasModule(mod) && whitelistUrl) {
      // Baca info dari openBantuan() — hanya sekali per tab
      if (!epuskesmasInfoFetched) {
        epuskesmasInfo = await readEpuskesmasInfoFromTab(tabId);
        epuskesmasInfoFetched = true;
        log(`ePuskesmas info:`, epuskesmasInfo);
      }

      if (epuskesmasInfo) {
        const list = await fetchWhitelist(whitelistUrl);
        if (list !== null && !list.includes(epuskesmasInfo.kode)) {
          log(`Kode "${epuskesmasInfo.kode}" not in whitelist — skipping ${mod.id}`);
          continue;
        }
      }
    }

    log(`Injecting "${mod.id}" into tab ${tabId}`);
    try {
      const code = await getModuleScript(mod);
      const meta = { id: mod.id, version: mod.version, name: mod.name };

      await chrome.scripting.executeScript({
        target: { tabId },
        world:  "MAIN",
        func: (moduleCode, moduleId, moduleMeta) => {
          if (!window.__jamuloader_injected) window.__jamuloader_injected = {};
          if (window.__jamuloader_injected[moduleId]) return;
          window.__jamuloader_injected[moduleId] = true;
          const script = document.createElement("script");
          script.textContent = `(function(){
  var __meta__ = ${JSON.stringify(moduleMeta)};
  ${moduleCode}
})();`;
          (document.head || document.documentElement).appendChild(script);
          script.remove();
        },
        args: [code, mod.id, meta],
      });

      // ── Tracking ──
      if (TRACKING_ENDPOINT) {
        if (firstInjection) {
          firstInjection = false;
          await maybeShowFirstRunNotice(tabId);
        }

        // Untuk modul ePuskesmas → pakai namaUser dari openBantuan()
        // Untuk modul lain → pakai userSelector dari manifest (jika ada)
        let username = "-";
        if (isEpuskesmasModule(mod) && epuskesmasInfo?.namaUser) {
          username = `${epuskesmasInfo.namaUser} (${epuskesmasInfo.namaPkm})`;
        } else if (mod.userSelector) {
          username = await readUsernameFromTab(tabId, mod.userSelector);
        }

        const hostname = new URL(tabUrl).hostname;
        if (await shouldTrack(mod.id, username)) {
          await sendTracking(mod.id, mod.name, tabUrl, username, hostname);
          await markTracked(mod.id, username);
        } else {
          log(`Tracking skipped (already tracked today): ${mod.id} by ${username}`);
        }
      }

    } catch (err) { log(`Failed to inject ${mod.id}:`, err.message); }
  }
}

function matchUrlPattern(pattern, url) {
  if (pattern === "<all_urls>" || pattern === "*") return true;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  try { return new RegExp(`^${escaped}$`).test(url); } catch { return url.includes(pattern); }
}

// ── Messages ─────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {

      case "GET_STATE": {
        const data = await getStorage(["manifestUrl","cachedManifest","moduleStates","pendingUpdates","lastManifestFetch","installedVersions","versionBlocked","versionRequired"]);
        sendResponse({ ok: true, data });
        break;
      }

      case "SET_MANIFEST_URL": {
        await setStorage({ manifestUrl: msg.url, installedVersions: {}, pendingUpdates: [] });
        await clearBadge();
        const manifest = await refreshManifest();
        sendResponse({ ok: !!manifest, manifest });
        break;
      }

      case "REFRESH_MANIFEST": {
        const manifest = await refreshManifest();
        sendResponse({ ok: !!manifest, manifest });
        break;
      }

      case "SET_MODULE_STATE": {
        const { moduleStates = {} } = await getStorage(["moduleStates"]);
        moduleStates[msg.moduleId] = msg.enabled;
        await setStorage({ moduleStates });
        sendResponse({ ok: true });
        break;
      }

      case "UPDATE_MODULE": {
        const { cachedManifest, installedVersions = {} } = await getStorage(["cachedManifest","installedVersions"]);
        const mod = (cachedManifest?.modules || []).find((m) => m.id === msg.moduleId);
        if (!mod) { sendResponse({ ok: false, error: "Module not found" }); break; }
        await setStorage({ [`script_${mod.id}`]: null });
        await fetchAndCacheScript(mod);
        installedVersions[mod.id] = mod.version;
        await setStorage({ installedVersions });
        const { pendingUpdates = [] } = await getStorage(["pendingUpdates"]);
        const newPending = pendingUpdates.filter((id) => id !== mod.id);
        await setStorage({ pendingUpdates: newPending });
        if (newPending.length === 0) await clearBadge();
        else await setBadge(newPending.length.toString(), "#f59e0b");
        sendResponse({ ok: true });
        break;
      }

      case "UPDATE_ALL_MODULES": {
        const { cachedManifest, pendingUpdates = [], installedVersions = {} } = await getStorage(["cachedManifest","pendingUpdates","installedVersions"]);
        for (const id of pendingUpdates) {
          const mod = (cachedManifest?.modules || []).find((m) => m.id === id);
          if (!mod) continue;
          await setStorage({ [`script_${mod.id}`]: null });
          await fetchAndCacheScript(mod);
          installedVersions[mod.id] = mod.version;
        }
        await setStorage({ installedVersions, pendingUpdates: [] });
        await clearBadge();
        sendResponse({ ok: true });
        break;
      }

      case "INJECT_CURRENT_TAB": {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) await injectModulesIntoTab(tab.id, tab.url);
        sendResponse({ ok: true });
        break;
      }

      case "RESET_FIRST_RUN": {
        await setStorage({ firstRunNoticeSeen: false });
        sendResponse({ ok: true });
        break;
      }

      case "RESET_TRACKING": {
        await setStorage({ trackingLog: {} });
        sendResponse({ ok: true });
        break;
      }

      case "DEBUG_STATE": {
        const all = await getStorage(["manifestUrl","installedVersions","pendingUpdates","moduleStates","trackingLog","firstRunNoticeSeen","versionBlocked","versionRequired"]);
        console.table(all.installedVersions);
        console.log("pendingUpdates:", all.pendingUpdates);
        console.log("trackingLog:", all.trackingLog);
        console.log("versionBlocked:", all.versionBlocked, "| required:", all.versionRequired);
        sendResponse({ ok: true, data: all });
        break;
      }

      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  })();
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) injectModulesIntoTab(tabId, tab.url);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) { log("Alarm fired."); await refreshManifest(); }
});

async function setupAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: DEFAULT_CHECK_INTERVAL });
    log(`Alarm set: every ${DEFAULT_CHECK_INTERVAL} minutes`);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  log("Jamu Loader installed.");
  await setupAlarm();
  const { manifestUrl } = await getStorage(["manifestUrl"]);
  if (manifestUrl) await refreshManifest();
});

chrome.runtime.onStartup.addListener(async () => {
  log("Browser started.");
  await setupAlarm();
  await refreshManifest();
});

// Restore config dari cache saat service worker restart
(async () => {
  const { cachedManifest } = await getStorage(["cachedManifest"]);
  if (cachedManifest) loadConfigFromManifest(cachedManifest);
})();

setupAlarm();
