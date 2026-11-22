// @ts-nocheck
// ============================================================================
// 存储模块：
//  - IndexedDB：ROM 二进制、游戏库元数据、即时存档（含缩略图）、电池 SRAM、金手指
//  - localStorage：仅存配置（音量 / 滤镜 / 键位 / 手柄映射 / 震动策略等）
// 说明：db 为模块级单例，跨组件挂载/卸载复用连接（ROM 二进制与存档即为缓存层）。
// ============================================================================

const DB_NAME = "jasmine-fc";
const DB_VERSION = 1;
const STORES = ["roms", "library", "states", "sram", "cheats"];

class DB {
  constructor() { this._db = null; }

  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) {
            // states 以 "romId:slot" 为主键；其余以 id / romId 为主键
            db.createObjectStore(s, { keyPath: s === "sram" || s === "cheats" ? "romId" : "id" });
          }
        }
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  }

  async _tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  put(store, val) { return this._tx(store, "readwrite", (s) => s.put(val)); }
  get(store, key) { return this._tx(store, "readonly", (s) => s.get(key)); }
  del(store, key) { return this._tx(store, "readwrite", (s) => s.delete(key)); }
  all(store) { return this._tx(store, "readonly", (s) => s.getAll()); }
}

export const db = new DB();

// ---------------------------- 配置（localStorage） ----------------------------
const SETTINGS_KEY = "jasmine-fc.settings";

export const DEFAULT_SETTINGS = {
  volume: 0.8,
  muted: false,
  crt: true,               // CRT 扫描线滤镜
  scanlineIntensity: 0.55, // 扫描线强度 0-1
  pixelPerfect: true,      // 整数缩放
  overscan: false,         // TV 过扫描裁剪（隐藏左右各 8px，默认关闭以免切掉贴边 HUD）
  ffSpeed: 1,              // 快进倍率 1/2/3/4
  audioBuffer: 4096,       // 音频环形缓冲（样本数，越大越稳但延迟越高）
  deadzone: 0.25,          // 摇杆死区
  turboA: false,           // A 键连发
  turboB: false,           // B 键连发
  turboRate: 15,           // 连发频率 Hz
  // 键盘映射（KeyboardEvent.code → NES 按键名）
  keymap: {
    ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
    KeyX: "A", KeyZ: "B", Enter: "START", ShiftRight: "SELECT",
    KeyS: "TURBO_A", KeyD: "TURBO_B",
  },
  // 手柄映射（标准 Gamepad 按键索引 / 轴 → NES 按键名），按玩家 1/2 分别存储
  padmap: {
    1: { 0: "A", 1: "B", 2: "TURBO_A", 3: "TURBO_B", 8: "SELECT", 9: "START", 12: "UP", 13: "DOWN", 14: "LEFT", 15: "RIGHT", "axis0-": "LEFT", "axis0+": "RIGHT", "axis1-": "UP", "axis1+": "DOWN" },
    2: { 0: "A", 1: "B", 2: "TURBO_A", 3: "TURBO_B", 8: "SELECT", 9: "START", 12: "UP", 13: "DOWN", 14: "LEFT", 15: "RIGHT", "axis0-": "LEFT", "axis0+": "RIGHT", "axis1-": "UP", "axis1+": "DOWN" },
  },
  haptics: {
    enabled: true,
    intensity: 0.7,   // 总强度 0-1
    duration: 150,    // 基础时长 ms
    triggers: { save: true, load: true, reset: true, start: true },
  },
  panelCollapsed: false,
  activeTab: "states",
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const saved = JSON.parse(raw);
    // 深合并，保证新增配置项有默认值
    const merge = (base, patch) => {
      const out = { ...base };
      for (const k of Object.keys(patch || {})) {
        out[k] = base[k] && typeof base[k] === "object" && !Array.isArray(base[k])
          ? merge(base[k], patch[k]) : patch[k];
      }
      return out;
    };
    return merge(DEFAULT_SETTINGS, saved);
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 隐私模式等 */ }
}

// ---------------------------- 文件下载 / 读取 ----------------------------
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);
    let done = false;
    let focusTimer = 0;
    // 统一收口：清理定时器 / 移监听 / 移除临时 input，避免滞留 body
    function finish(f) {
      if (done) return; done = true;
      clearTimeout(focusTimer);
      window.removeEventListener("focus", onFocus);
      if (document.body.contains(input)) input.remove();
      resolve(f || null);
    }
    function onFocus() { focusTimer = setTimeout(() => finish(null), 500); }
    input.onchange = () => finish(input.files && input.files[0]);
    // 现代浏览器：取消文件选择对话框会触发 cancel 事件
    input.oncancel = () => finish(null);
    // 兜底：部分旧浏览器无 cancel 事件，回到窗口聚焦且仍未选择则视为取消
    window.addEventListener("focus", onFocus, { once: true });
    input.click();
  });
}
