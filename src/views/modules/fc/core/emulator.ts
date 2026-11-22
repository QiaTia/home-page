// @ts-nocheck
// ============================================================================
// 模拟核心接入模块（基于 JSNES 3.0，Apache-2.0，jsnes 由 <script> 注入为全局）
// 职责：
//  - 帧循环（rAF + 时间累积器，NTSC 60.0988fps / PAL 50.007fps，快进倍率）
//  - Canvas 2D 渲染（256×240，Uint32 直写 ImageData，像素完美由 UI 层缩放）
//  - Web Audio 输出：AudioWorklet 环形缓冲（降级 ScriptProcessor）+ 音量 Gain
//  - 即时存档 toJSON/fromJSON、电池 SRAM 读写、Game Genie 金手指
//  - destroy()：停止帧循环、清理定时器、断开并关闭音频，释放资源
// ============================================================================
/* global jsnes */

const NES_W = 256, NES_H = 240;
const NTSC_FPS = 60.0988, PAL_FPS = 50.007;

// AudioWorklet 处理器：环形缓冲接收主线程批量样本，process() 中持续输出。
// 缓冲欠载时输出静音并上报，避免爆音。
const WORKLET_CODE = `
class JasmineAudioProcessor extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    this.capacity = (opts.processorOptions && opts.processorOptions.capacity) || 4096;
    this.bufL = new Float32Array(this.capacity);
    this.bufR = new Float32Array(this.capacity);
    this.readPos = 0; this.writePos = 0; this.count = 0;
    this.port.onmessage = (e) => {
      if (e.data.type === 'samples') {
        const L = e.data.left, R = e.data.right, n = L.length;
        if (this.count + n > this.capacity) {
          const drop = this.count + n - this.capacity;
          this.readPos = (this.readPos + drop) % this.capacity;
          this.count -= drop;
        }
        for (let i = 0; i < n; i++) {
          this.bufL[this.writePos] = L[i];
          this.bufR[this.writePos] = R[i];
          this.writePos = (this.writePos + 1) % this.capacity;
        }
        this.count += n;
      } else if (e.data.type === 'clear') {
        this.readPos = this.writePos = this.count = 0;
      }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length < 2) return true;
    const oL = out[0], oR = out[1], size = oL.length;
    const avail = Math.min(this.count, size);
    for (let i = 0; i < avail; i++) {
      oL[i] = this.bufL[this.readPos];
      oR[i] = this.bufR[this.readPos];
      this.readPos = (this.readPos + 1) % this.capacity;
    }
    for (let i = avail; i < size; i++) { oL[i] = 0; oR[i] = 0; }
    this.count -= avail;
    if (avail < size) this.port.postMessage({ type: 'underrun' });
    return true;
  }
}
registerProcessor('jasmine-audio', JasmineAudioProcessor);
`;

export class EmulatorCore {
  /**
   * @param {HTMLCanvasElement} canvas 256×240 画布
   * @param {object} hooks { onFps, onStatus, onSramDirty, onCrash, onPoll, onAudioState }
   */
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.ctx2d = canvas.getContext("2d", { alpha: false });
    this.imageData = this.ctx2d.createImageData(NES_W, NES_H);
    this.buf32 = new Uint32Array(this.imageData.data.buffer);
    this.buf32.fill(0xff000000);
    this.ctx2d.putImageData(this.imageData, 0, 0);

    this.romLoaded = false;
    this.running = false;
    this.destroyed = false;
    this.speed = 1;
    this.frameMs = 1000 / NTSC_FPS;
    this.header = null;
    this._acc = 0;
    this._lastT = 0;
    this._fpsCount = 0;
    this._fpsLast = performance.now();
    this._sramDirty = false;
    this._sramTimer = 0;
    this._audioReady = false;
    this._batchL = new Float32Array(256);
    this._batchR = new Float32Array(256);
    this._batchPos = 0;
    this._volume = 0.8;
    this._muted = false;
    this._bufferCapacity = 4096;
    this._overscan = false; // 默认不裁剪边缘（部分游戏 HUD 贴边绘制）

    // 音频上下文提前创建（处于 suspended 状态），以获得真实采样率；
    // 浏览器要求用户手势后才能 resume —— ensureAudio() 在交互时调用。
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = AC ? new AC() : null;
    } catch { this.audioCtx = null; }

    // NES 实例：onFrame 直写像素缓冲；onAudioSample 收集立体声样本
    this.nes = new jsnes.NES({
      onFrame: (buffer) => {
        for (let i = 0; i < NES_W * NES_H; i++) this.buf32[i] = 0xff000000 | buffer[i];
        this._frameDirty = true;
      },
      onAudioSample: (l, r) => this._pushSample(l, r),
      onBatteryRamWrite: () => this._markSramDirty(),
      emulateSound: true,
      sampleRate: this.audioCtx ? this.audioCtx.sampleRate : 48000,
    });

    this._initAudio();
    this._raf = requestAnimationFrame(this._tick);
  }

  // ------------------------------ 音频 ------------------------------
  async _initAudio() {
    const ctx = this.audioCtx;
    if (!ctx) { this.hooks.onAudioState?.("unsupported"); return; }
    this.gain = ctx.createGain();
    this.gain.gain.value = this._muted ? 0 : this._volume;
    this.gain.connect(ctx.destination);
    try {
      if (!ctx.audioWorklet) throw new Error("no worklet");
      const url = URL.createObjectURL(new Blob([WORKLET_CODE], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this._workletModuleReady = true;
      this._buildWorkletNode();
      this._audioReady = true;
      this.hooks.onAudioState?.(ctx.state === "running" ? "running" : "suspended");
    } catch {
      this._buildScriptProcessorFallback();
    }
  }

  _buildWorkletNode() {
    const ctx = this.audioCtx;
    if (this.node) { try { this.node.disconnect(); } catch {} this.node = null; }
    this.node = new AudioWorkletNode(ctx, "jasmine-audio", {
      outputChannelCount: [2],
      processorOptions: { capacity: this._bufferCapacity },
    });
    this.node.connect(this.gain);
  }

  // 降级：ScriptProcessorNode（已废弃但全浏览器可用）
  _buildScriptProcessorFallback() {
    const ctx = this.audioCtx;
    if (!ctx || !ctx.createScriptProcessor) { this.hooks.onAudioState?.("unsupported"); return; }
    const cap = this._bufferCapacity;
    const ringL = new Float32Array(cap), ringR = new Float32Array(cap);
    let rp = 0, wp = 0, count = 0;
    this._spWrite = (l, r) => {
      if (count >= cap) { rp = (rp + 1) % cap; count--; }
      ringL[wp] = l; ringR[wp] = r; wp = (wp + 1) % cap; count++;
    };
    this.node = ctx.createScriptProcessor(1024, 0, 2);
    this.node.onaudioprocess = (e) => {
      const oL = e.outputBuffer.getChannelData(0), oR = e.outputBuffer.getChannelData(1);
      for (let i = 0; i < oL.length; i++) {
        if (count > 0) { oL[i] = ringL[rp]; oR[i] = ringR[rp]; rp = (rp + 1) % cap; count--; }
        else { oL[i] = 0; oR[i] = 0; }
      }
    };
    this.node.connect(this.gain);
    this._audioReady = true;
    this._isFallback = true;
    this.hooks.onAudioState?.(ctx.state === "running" ? "running" : "suspended");
  }

  _pushSample(l, r) {
    if (!this._audioReady) return;
    if (this._isFallback) { this._spWrite(l, r); return; }
    this._batchL[this._batchPos] = l;
    this._batchR[this._batchPos] = r;
    this._batchPos++;
    if (this._batchPos >= 256) this._flushSamples();
  }

  _flushSamples() {
    if (!this._audioReady || this._isFallback || this._batchPos === 0 || !this.node) { this._batchPos = 0; return; }
    this.node.port.postMessage({
      type: "samples",
      left: this._batchL.slice(0, this._batchPos),
      right: this._batchR.slice(0, this._batchPos),
    });
    this._batchPos = 0;
  }

  _clearAudio() {
    if (this.node && this.node.port) this.node.port.postMessage({ type: "clear" });
    this._batchPos = 0;
  }

  /** 用户手势中调用，恢复音频上下文 */
  async ensureAudio() {
    if (!this.audioCtx) return;
    if (this.audioCtx.state !== "running") {
      try { await this.audioCtx.resume(); } catch {}
    }
    this.hooks.onAudioState?.(this.audioCtx.state === "running" ? "running" : "suspended");
  }

  setVolume(v) {
    this._volume = v;
    this._applyGain();
  }
  setMuted(m) { this._muted = m; this._applyGain(); }
  _applyGain() {
    if (!this.gain) return;
    // 快进时静音，避免缓冲溢出导致的卡顿噪声
    const v = this._muted || this.speed > 1 ? 0 : this._volume;
    this.gain.gain.setTargetAtTime(v, this.audioCtx.currentTime, 0.02);
  }
  setAudioBuffer(cap) {
    this._bufferCapacity = cap;
    if (this._workletModuleReady) this._buildWorkletNode();
    else if (this._isFallback) { try { this.node.disconnect(); } catch {} this._buildScriptProcessorFallback(); }
  }
  get audioState() { return this.audioCtx ? this.audioCtx.state : "unsupported"; }

  // ------------------------------ ROM 装载 ------------------------------
  /**
   * @param {Uint8Array} bytes ROM 数据
   * @param {object} header parseHeader 结果
   * @param {Uint8Array|null} sram 已保存的电池 SRAM（可选）
   */
  loadRom(bytes, header, sram = null) {
    this.nes.loadROM(bytes);
    this.header = header;
    this.romLoaded = true;
    this._frameDirty = true;
    // PAL ROM：切换 PAL 调色板与 50fps 目标（时序仍为 NTSC 近似，见 README 限制）
    if (header.region === "PAL") {
      this.nes.ppu.palTable.loadPALPalette();
      this.frameMs = 1000 / PAL_FPS;
    } else {
      this.nes.ppu.palTable.loadNTSCPalette();
      this.frameMs = 1000 / NTSC_FPS;
    }
    if (sram && header.battery) this.writeSram(sram);
    this.nes.ppu.clipToTvSize = this._overscan;
    this._sramDirty = false;
    this._acc = 0;
    this._clearAudio();
    this.running = true;
  }

  /** 硬重置：reloadROM 会重建 CPU/PPU/APU，需要重新注入 SRAM */
  reset() {
    if (!this.romLoaded) return;
    const sram = this.header.battery ? this.readSram() : null;
    this.nes.reloadROM();
    if (sram) this.writeSram(sram);
    if (this.header.region === "PAL") this.nes.ppu.palTable.loadPALPalette();
    this.nes.ppu.clipToTvSize = this._overscan;
    this._acc = 0;
    this._clearAudio();
    this.running = true;
  }

  pause() { this.running = false; this._flushSamples(); }
  resume() { if (this.romLoaded) { this.running = true; this._acc = 0; this._lastT = performance.now(); } }
  togglePause() { this.running ? this.pause() : this.resume(); }
  setSpeed(x) { this.speed = x; this._applyGain(); }

  /** TV 过扫描裁剪：true 时隐藏左右各 8 像素（模拟老式电视） */
  setOverscan(on) {
    this._overscan = !!on;
    if (this.romLoaded) this.nes.ppu.clipToTvSize = this._overscan;
  }

  // ------------------------------ 存档 / SRAM ------------------------------
  saveState() { return this.nes.toJSON(); }
  loadState(state) {
    this.nes.fromJSON(state);
    this._acc = 0;
    this._clearAudio();
    this._frameDirty = true;
  }

  readSram() { return this.nes.cpu.mem.slice(0x6000, 0x8000); }
  writeSram(bytes) {
    if (!bytes || bytes.length < 0x2000) return;
    this.nes.cpu.mem.set(bytes.subarray(0, 0x2000), 0x6000);
  }
  _markSramDirty() {
    this._sramDirty = true;
    clearTimeout(this._sramTimer);
    // 防抖 800ms 后通知上层持久化，避免频繁写 IndexedDB
    this._sramTimer = setTimeout(() => {
      if (this._sramDirty) { this._sramDirty = false; this.hooks.onSramDirty?.(); }
    }, 800);
  }
  flushSram() {
    if (this._sramDirty) { this._sramDirty = false; clearTimeout(this._sramTimer); this.hooks.onSramDirty?.(); }
  }

  // ------------------------------ 金手指 ------------------------------
  addCheat(code) { this.nes.gameGenie.addCode(code); }
  removeCheat(index) {
    this.nes.gameGenie.patches.splice(index, 1);
    this.nes.gameGenie.onChange?.();
  }
  clearCheats() { this.nes.gameGenie.removeAllCodes(); }
  setCheatsEnabled(on) { this.nes.gameGenie.setEnabled(on); }

  // ------------------------------ 画面 ------------------------------
  screenshot() { return this.canvas.toDataURL("image/png"); }

  // ------------------------------ 资源释放 ------------------------------
  /** 停止帧循环、清理定时器、断开并关闭音频上下文 */
  destroy() {
    this.destroyed = true;
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    clearTimeout(this._sramTimer);
    this._sramTimer = 0;
    try { this.node && this.node.disconnect(); } catch {}
    try { this.gain && this.gain.disconnect(); } catch {}
    this.node = null;
    this.gain = null;
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
  }

  // ------------------------------ 主循环 ------------------------------
  _tick = (t) => {
    if (this.destroyed) return;
    this._raf = requestAnimationFrame(this._tick);
    const dt = Math.min(t - (this._lastT || t), 100); // 切后台回来时钳制，避免追帧风暴
    this._lastT = t;

    this.hooks.onPoll?.(t); // 输入轮询（暂停时也执行，保证手柄热插拔 UI 更新）

    if (this.romLoaded && this.running) {
      this._acc += dt * this.speed;
      let steps = 0;
      const maxSteps = 4 * this.speed; // 每 tick 最多追 4 帧 × 倍率
      try {
        while (this._acc >= this.frameMs && steps < maxSteps) {
          this.nes.frame();
          this._acc -= this.frameMs;
          steps++;
          this._fpsCount++;
        }
        if (this._acc > this.frameMs * maxSteps) this._acc = 0;
      } catch (err) {
        this.running = false;
        this.hooks.onCrash?.(err);
      }
      if (steps > 0) {
        this._flushSamples();
        if (this._frameDirty) {
          this.ctx2d.putImageData(this.imageData, 0, 0);
          this._frameDirty = false;
        }
      }
    }

    // FPS 统计（每 500ms 上报一次）
    const now = performance.now();
    if (now - this._fpsLast >= 500) {
      const fps = (this._fpsCount * 1000) / (now - this._fpsLast);
      this._fpsCount = 0;
      this._fpsLast = now;
      this.hooks.onFps?.(this.romLoaded && this.running ? fps : 0);
    }
  };
}
