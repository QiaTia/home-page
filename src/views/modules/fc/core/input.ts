// @ts-nocheck
// ============================================================================
// 输入模块：键盘 + Gamepad API（热插拔 / 多手柄 / 死区 / 重映射）+ 触屏虚拟手柄
//  - 每帧轮询 navigator.getGamepads()（规范要求在循环内重新获取快照）
//  - 浏览器隐私策略：必须先按一次手柄按键，页面才能看到设备（UI 有提示）
//  - 连发（Turbo）：按 turboRate 频率交替按下/松开，支持 A/B 独立开关
//  - destroy()：注销全部 window 监听，保证组件卸载后无残留
// ============================================================================
/* global jsnes */

// NES 按键名 → JSNES Controller 常量（模块求值时 jsnes 已就绪：由 app 动态 import）
if (typeof jsnes === "undefined" || !jsnes?.Controller) {
  throw new Error("[fc] jsnes 未加载即引用 input.ts，请通过 ./core/app 动态导入");
}
export const BTN = {
  A: jsnes.Controller.BUTTON_A,
  B: jsnes.Controller.BUTTON_B,
  SELECT: jsnes.Controller.BUTTON_SELECT,
  START: jsnes.Controller.BUTTON_START,
  UP: jsnes.Controller.BUTTON_UP,
  DOWN: jsnes.Controller.BUTTON_DOWN,
  LEFT: jsnes.Controller.BUTTON_LEFT,
  RIGHT: jsnes.Controller.BUTTON_RIGHT,
};
export const NES_BUTTONS = ["A", "B", "SELECT", "START", "UP", "DOWN", "LEFT", "RIGHT"];

const STANDARD_PAD_LABELS = {
  0: "A / ✕", 1: "B / ○", 2: "X / □", 3: "Y / △",
  4: "LB / L1", 5: "RB / R1", 6: "LT / L2", 7: "RT / R2",
  8: "Back / Share", 9: "Start / Options", 10: "L3", 11: "R3",
  12: "↑", 13: "↓", 14: "←", 15: "→", 16: "Home",
};
export function padButtonLabel(i) { return STANDARD_PAD_LABELS[i] || `键${i}`; }

export class InputManager {
  /**
   * @param {EmulatorCore} core
   * @param {object} settings 可变配置引用（UI 直接修改后 saveSettings）
   * @param {object} hooks { onPadsChanged, onLamps }
   */
  constructor(core, settings, hooks = {}) {
    this.core = core;
    this.settings = settings;
    this.hooks = hooks;
    this.kb = new Set();      // 键盘按下的 NES 键名
    this.touch = new Set();   // 触屏按下的 NES 键名
    this.padState = { 1: new Set(), 2: new Set() };
    this._prev = { 1: new Array(8).fill(false), 2: new Array(8).fill(false) };
    this._capture = null;     // 重映射捕获 { type, player, cb }
    this._captureBaseline = null;
    this._padsSignature = "";

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    this._onBlur = () => { this.kb.clear(); this.touch.clear(); };
    this._onPadConn = () => this._notifyPads();
    this._onPadDisconn = () => this._notifyPads();
    window.addEventListener("blur", this._onBlur);
    window.addEventListener("gamepadconnected", this._onPadConn);
    window.addEventListener("gamepaddisconnected", this._onPadDisconn);
  }

  // ------------------------------ 键盘 ------------------------------
  _isTypingTarget(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  }

  _onKeyDown = (e) => {
    if (this._capture && this._capture.type === "key") {
      e.preventDefault();
      // Esc 保留为“取消捕获”，不能被绑定为游戏按键
      if (e.code === "Escape") {
        this._capture = null;
        this.hooks.onCaptureCancel?.();
        return;
      }
      const cb = this._capture.cb;
      this._capture = null;
      cb(e.code);
      return;
    }
    if (this._isTypingTarget(e)) return;
    const btn = this.settings.keymap[e.code];
    if (btn) {
      e.preventDefault();
      if (!e.repeat) this.kb.add(btn);
    }
  };

  _onKeyUp = (e) => {
    const btn = this.settings.keymap[e.code];
    if (btn) this.kb.delete(btn);
  };

  // ------------------------------ 触屏 ------------------------------
  bindTouchPad(root) {
    root.querySelectorAll("[data-btn]").forEach((el) => {
      const btn = el.dataset.btn;
      const down = (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        this.touch.add(btn);
        el.classList.add("pressed");
      };
      const up = (e) => {
        e.preventDefault();
        this.touch.delete(btn);
        el.classList.remove("pressed");
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("lostpointercapture", up);
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    });
  }

  // ------------------------------ 手柄 ------------------------------
  getConnectedPads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const out = [];
    for (const p of pads) if (p && p.connected) out.push(p);
    return out;
  }

  _notifyPads() {
    const pads = this.getConnectedPads();
    const sig = pads.map((p) => p.index + ":" + p.id).join("|");
    if (sig !== this._padsSignature) {
      this._padsSignature = sig;
      this.hooks.onPadsChanged?.(pads);
    }
  }

  /** 读取单个手柄 → NES 键名集合（含摇杆死区处理） */
  _readPad(gp, player) {
    const set = new Set();
    const map = this.settings.padmap[player] || {};
    const dz = this.settings.deadzone;
    for (let i = 0; i < gp.buttons.length; i++) {
      const b = gp.buttons[i];
      const pressed = typeof b === "object" ? b.pressed || b.value > 0.5 : b > 0.5;
      if (pressed && map[i]) set.add(map[i]);
    }
    for (let a = 0; a < Math.min(gp.axes.length, 4); a += 2) {
      const x = gp.axes[a] || 0, y = gp.axes[a + 1] || 0;
      if (x < -dz && map[`axis${a}-`]) set.add(map[`axis${a}-`]);
      if (x > dz && map[`axis${a}+`]) set.add(map[`axis${a}+`]);
      if (y < -dz && map[`axis${a + 1}-`]) set.add(map[`axis${a + 1}-`]);
      if (y > dz && map[`axis${a + 1}+`]) set.add(map[`axis${a + 1}+`]);
    }
    return set;
  }

  /** 重映射捕获：type='key' 由 keydown 完成；type='pad' 在 poll 中检测新按下 */
  startCapture(type, player, cb) {
    this._capture = { type, player, cb };
    if (type === "pad") {
      // 记录基线，避免把捕获开始前已按住的键误判为新按下
      const gp = this.getConnectedPads()[player - 1];
      this._captureBaseline = gp ? gp.buttons.map((b) => (typeof b === "object" ? b.pressed : b > 0.5)) : [];
    }
  }
  cancelCapture() { this._capture = null; }
  get capturing() { return !!this._capture; }

  _pollCapture() {
    if (!this._capture || this._capture.type !== "pad") return;
    const gp = this.getConnectedPads()[this._capture.player - 1];
    if (!gp) return;
    for (let i = 0; i < gp.buttons.length; i++) {
      const b = gp.buttons[i];
      const pressed = typeof b === "object" ? b.pressed || b.value > 0.5 : b > 0.5;
      if (pressed && !this._captureBaseline[i]) {
        const cb = this._capture.cb;
        this._capture = null;
        cb(String(i));
        return;
      }
    }
    for (let a = 0; a < Math.min(gp.axes.length, 4); a++) {
      const v = gp.axes[a] || 0;
      if (Math.abs(v) > 0.6) {
        const cb = this._capture.cb;
        this._capture = null;
        cb(`axis${a}${v < 0 ? "-" : "+"}`);
        return;
      }
    }
    this._captureBaseline = gp.buttons.map((b) => (typeof b === "object" ? b.pressed : b > 0.5));
  }

  // ------------------------------ 每帧合并与下发 ------------------------------
  poll(t) {
    this._pollCapture();
    this._notifyPads();
    const pads = this.getConnectedPads();
    this.padState[1] = pads[0] ? this._readPad(pads[0], 1) : new Set();
    this.padState[2] = pads[1] ? this._readPad(pads[1], 2) : new Set();

    const s = this.settings;
    const period = 1000 / Math.max(2, s.turboRate);
    const turboPhase = Math.floor(t / (period / 2)) % 2 === 0;

    for (const player of [1, 2]) {
      const sources = player === 1
        ? [this.kb, this.touch, this.padState[1]]
        : [this.padState[2]];
      const held = (name) => sources.some((set) => set.has(name));

      const effective = {};
      for (const name of NES_BUTTONS) effective[name] = held(name);
      // Turbo：独立 TURBO 键，或设置中开启的 A/B 连发（按住时按频率交替）
      if (held("TURBO_A") || (s.turboA && held("A"))) effective.A = turboPhase;
      if (held("TURBO_B") || (s.turboB && held("B"))) effective.B = turboPhase;
      // 互斥方向（同时按左+右时保持中立，避免部分游戏异常）
      if (effective.LEFT && effective.RIGHT) { effective.LEFT = effective.RIGHT = false; }
      if (effective.UP && effective.DOWN) { effective.UP = effective.DOWN = false; }

      const prev = this._prev[player];
      for (let i = 0; i < 8; i++) {
        const name = NES_BUTTONS[i];
        const now = !!effective[name];
        if (now !== prev[i]) {
          if (this.core.romLoaded && !this.core.destroyed) {
            now ? this.core.nes.buttonDown(player, BTN[name]) : this.core.nes.buttonUp(player, BTN[name]);
          }
          prev[i] = now;
        }
      }
      this.hooks.onLamps?.(player, prev);
    }
  }

  /** 释放所有按键（切换 ROM / 读档前调用，防止卡键） */
  releaseAll() {
    this.kb.clear();
    this.touch.clear();
    for (const player of [1, 2]) {
      for (let i = 0; i < 8; i++) {
        if (this._prev[player][i] && this.core.romLoaded && !this.core.destroyed) this.core.nes.buttonUp(player, i);
        this._prev[player][i] = false;
      }
    }
  }

  /** 注销全局事件监听 */
  destroy() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    window.removeEventListener("gamepadconnected", this._onPadConn);
    window.removeEventListener("gamepaddisconnected", this._onPadDisconn);
    this._capture = null;
    this.kb.clear();
    this.touch.clear();
  }
}
