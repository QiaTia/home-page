// @ts-nocheck
// ============================================================================
// UI 层：游戏库 / 存档槽位 / 手柄映射 / 画质音频 / 金手指 / 状态栏 / 浮层
// 所有业务动作通过 app.actions 调用（app.ts 提供），UI 只负责渲染与事件绑定。
// 改造说明：
//  - 元素查找从全局 document.getElementById 收敛为 root 容器内 querySelector，
//    避免与站点其他模块的同名节点冲突，并保证多实例/重挂载安全。
//  - 需在卸载时移除的全局（window/document）监听统一登记在 this._cleanup，
//    由 destroy() 逐一注销；ResizeObserver 亦在此释放。
// ============================================================================
import { fmtSize, fmtTime } from "./rom";
import { NES_BUTTONS, padButtonLabel } from "./input";
import { DEFAULT_SETTINGS, saveSettings, pickFile } from "./storage";

const SLOT_COUNT = 6;

const KEY_LABELS = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  Enter: "Enter", ShiftRight: "RShift", ShiftLeft: "LShift", Space: "Space",
  ControlRight: "RCtrl", ControlLeft: "LCtrl", AltRight: "RAlt", AltLeft: "LAlt",
  Backspace: "Backsp", Tab: "Tab", Escape: "Esc",
};
function keyLabel(code) {
  if (!code) return "—";
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  return code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num");
}
function padKeyLabel(k) {
  if (k == null) return "—";
  const s = String(k);
  if (s.startsWith("axis")) {
    const n = s.slice(4, -1);
    return `轴${n}${s.endsWith("-") ? "−" : "+"}`;
  }
  return padButtonLabel(Number(s));
}

export class UI {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    // 作用域化的元素查找
    const $ = (id) => root.querySelector("#" + id);
    this.$ = $;
    this.el = {
      layout: $("layout"), library: $("library"), libList: $("libList"), libCount: $("libCount"),
      libSearch: $("libSearch"), libSort: $("libSort"),
      screenShell: $("screenShell"), screenBox: $("screenBox"), canvas: $("screen"),
      crt: $("crtOverlay"), screenMsg: $("screenMsg"), pauseBadge: $("pauseBadge"), ffBadge: $("ffBadge"),
      loading: $("loadingOverlay"), loadingText: $("loadingText"),
      fpsVal: $("fpsVal"), chipFps: $("chipFps"), chipRom: $("chipRom"), chipPad: $("chipPad"),
      padCount: $("padCount"), chipAudio: $("chipAudio"),
      btnPlay: $("btnPlay"), btnReset: $("btnReset"), btnSave: $("btnSave"), btnLoad: $("btnLoad"),
      icoPlay: $("icoPlay"), icoPause: $("icoPause"),
      ffSelect: $("ffSelect"), volSlider: $("volSlider"), btnMute: $("btnMute"),
      icoVol: $("icoVol"), icoMute: $("icoMute"), scaleInfo: $("scaleInfo"),
      slotList: $("slotList"), sramStatus: $("sramStatus"),
      padList: $("padList"), lampRow: $("lampRow"), mapTable: $("mapTable"), mapPlayer: $("mapPlayer"),
      romInfo: $("romInfo"), cheatList: $("cheatList"), cheatInput: $("cheatInput"),
      toasts: $("toasts"), captureOverlay: $("captureOverlay"), captureText: $("captureText"),
      dropOverlay: $("dropOverlay"), renameModal: $("renameModal"), renameInput: $("renameInput"),
      touchpad: $("touchpad"), scrim: $("scrim"), sidepanel: $("sidepanel"),
      hapticSupport: $("hapticSupport"),
    };
    this._lampCache = { 1: "", 2: "" };
    this._dragDepth = 0;
    this._renameCb = null;
    this._cleanup = []; // 需卸载时移除的监听/观察者
    this._timers = new Set(); // 需卸载时清除的 setTimeout 句柄
    this._buildLamps();
    this._bind();
    // 捕获模式下按 Esc 取消：由输入层回调通知 UI 关闭浮层
    this.app.input.hooks.onCaptureCancel = () => this.cancelRemap();
    // 窄屏（≤1024px）侧面板为抽屉，默认收起避免遮挡画布
    if (matchMedia("(max-width: 1024px)").matches) {
      this.el.layout.classList.add("panel-collapsed");
    }
    this.syncSettings();
    this.renderSlots();
    this.renderMapTable();
    this.renderCheats();
    this.fitScreen();
    const ro = new ResizeObserver(() => this.fitScreen());
    ro.observe(this.el.screenShell);
    this._ro = ro;
    const onFsChange = () => this._later(() => this.fitScreen(), 60);
    document.addEventListener("fullscreenchange", onFsChange);
    this._cleanup.push(() => document.removeEventListener("fullscreenchange", onFsChange));
  }

  /** 登记 window/document 监听并纳入卸载清理 */
  _listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this._cleanup.push(() => target.removeEventListener(type, fn, opts));
  }

  /** 受管 setTimeout：句柄登记，destroy() 时统一清除，避免卸载后回调仍执行 */
  _later(fn, ms) {
    const id = setTimeout(() => { this._timers.delete(id); fn(); }, ms);
    this._timers.add(id);
    return id;
  }

  persist() { saveSettings(this.app.settings); }

  // ------------------------------ 事件绑定 ------------------------------
  _bind() {
    const a = this.app.actions, s = this.app.settings, el = this.el, $ = this.$;

    // 顶栏
    $("btnShot").onclick = () => a.screenshot();
    $("btnFull").onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else el.screenShell.requestFullscreen?.().catch(() => this.toast("浏览器拒绝了全屏请求", "warn"));
    };
    $("btnPanel").onclick = () => {
      el.layout.classList.toggle("panel-collapsed");
      s.panelCollapsed = el.layout.classList.contains("panel-collapsed");
      this.persist();
      this._later(() => this.fitScreen(), 320);
      this._updateScrim();
    };
    $("btnLibrary").onclick = () => { el.library.classList.toggle("open"); this._updateScrim(); };
    el.scrim.onclick = () => {
      el.library.classList.remove("open");
      el.layout.classList.add("panel-collapsed");
      s.panelCollapsed = true; this.persist();
      this._updateScrim();
    };
    el.chipAudio.onclick = () => this.app.core.ensureAudio();

    // 传输控制
    el.btnPlay.onclick = () => a.togglePause();
    el.btnReset.onclick = () => a.reset();
    el.btnSave.onclick = () => a.saveSlot(this.app.quickSlot);
    el.btnLoad.onclick = () => a.loadLatest();
    el.ffSelect.onchange = () => { s.ffSpeed = Number(el.ffSelect.value); a.setSpeed(s.ffSpeed); this.persist(); };
    el.volSlider.oninput = () => {
      s.volume = Number(el.volSlider.value) / 100;
      this.app.core.setVolume(s.volume);
      if (s.volume > 0 && s.muted) { s.muted = false; this.app.core.setMuted(false); this._syncMuteIcon(); }
      this.persist();
    };
    el.btnMute.onclick = () => {
      s.muted = !s.muted;
      this.app.core.setMuted(s.muted);
      this._syncMuteIcon(); this.persist();
    };

    // 游戏库
    el.libSearch.oninput = () => this.renderLibrary();
    el.libSort.onchange = () => this.renderLibrary();
    $("btnImportRom").onclick = async () => {
      const f = await pickFile(".nes,application/octet-stream");
      if (f) a.importRomFile(f);
    };

    // 标签页
    this.root.querySelectorAll("#tabs button").forEach((btn) => {
      btn.onclick = () => this.openTab(btn.dataset.tab);
    });

    // 存档
    $("btnImportState").onclick = async () => {
      const f = await pickFile(".json,application/json");
      if (f) a.importStateFile(f);
    };
    $("btnSramExport").onclick = () => a.exportSram();
    $("btnSramImport").onclick = async () => {
      const f = await pickFile(".sav,application/octet-stream");
      if (f) a.importSramFile(f);
    };

    // 手柄 / 映射
    el.mapPlayer.onchange = () => this.renderMapTable();
    $("dzSlider").oninput = (e) => {
      s.deadzone = Number(e.target.value) / 100;
      $("dzVal").textContent = s.deadzone.toFixed(2); this.persist();
    };
    $("turboRate").oninput = (e) => {
      s.turboRate = Number(e.target.value);
      $("turboRateVal").textContent = s.turboRate + " Hz"; this.persist();
    };
    $("turboA").onchange = (e) => { s.turboA = e.target.checked; this.persist(); };
    $("turboB").onchange = (e) => { s.turboB = e.target.checked; this.persist(); };
    $("btnResetMap").onclick = () => {
      s.keymap = structuredClone(DEFAULT_SETTINGS.keymap);
      s.padmap = structuredClone(DEFAULT_SETTINGS.padmap);
      this.persist(); this.renderMapTable();
      this.toast("已恢复默认按键映射", "success");
    };
    $("captureCancel").onclick = () => this.cancelRemap();

    // 震动
    $("hapEnabled").onchange = (e) => { s.haptics.enabled = e.target.checked; this.persist(); };
    $("hapIntensity").oninput = (e) => {
      s.haptics.intensity = Number(e.target.value) / 100;
      $("hapIntensityVal").textContent = e.target.value + "%"; this.persist();
    };
    $("hapDuration").oninput = (e) => {
      s.haptics.duration = Number(e.target.value);
      $("hapDurationVal").textContent = e.target.value + "ms"; this.persist();
    };
    this.root.querySelectorAll("#hapTriggers input").forEach((cb) => {
      cb.onchange = () => { s.haptics.triggers[cb.dataset.trigger] = cb.checked; this.persist(); };
    });
    $("btnHapTest").onclick = () => {
      const ok = this.app.haptics.pulse("test");
      this.toast(ok ? "已发送震动指令（感受手柄振动）" : "当前设备 / 浏览器不支持震动，已静默禁用", ok ? "success" : "warn");
      this.refreshHapticSupport();
    };

    // 画质 / 音频
    $("optCrt").onchange = (e) => { s.crt = e.target.checked; this.applyVideo(); this.persist(); };
    $("optPixel").onchange = (e) => { s.pixelPerfect = e.target.checked; this.fitScreen(); this.persist(); };
    $("optOverscan").onchange = (e) => { s.overscan = e.target.checked; this.app.core.setOverscan(s.overscan); this.persist(); };
    $("optScanline").oninput = (e) => {
      s.scanlineIntensity = Number(e.target.value) / 100;
      $("optScanlineVal").textContent = e.target.value + "%";
      this.applyVideo(); this.persist();
    };
    $("optTouch").onchange = (e) => { el.touchpad.hidden = !e.target.checked; this.fitScreen(); };
    $("optBuffer").oninput = (e) => {
      s.audioBuffer = Number(e.target.value);
      this.app.core.setAudioBuffer(s.audioBuffer);
      this._bufferLabel(); this.persist();
    };

    // 金手指
    $("btnCheatAdd").onclick = () => {
      const code = el.cheatInput.value.trim();
      if (!code) return;
      if (a.addCheat(code)) el.cheatInput.value = "";
    };
    el.cheatInput.onkeydown = (e) => { if (e.key === "Enter") $("btnCheatAdd").click(); };
    $("cheatMaster").onchange = (e) => a.setCheatsEnabled(e.target.checked);

    // 重命名弹窗
    $("renameOk").onclick = () => this._closeRename(true);
    $("renameCancel").onclick = () => this._closeRename(false);
    el.renameInput.onkeydown = (e) => {
      if (e.key === "Enter") this._closeRename(true);
      if (e.key === "Escape") this._closeRename(false);
    };

    // Esc：取消捕获 / 关闭弹窗与抽屉
    this._listen(window, "keydown", (e) => {
      if (e.key !== "Escape") return;
      if (this.app.input.capturing) this.cancelRemap();
      else if (!el.renameModal.hidden) this._closeRename(false);
      else if (el.library.classList.contains("open")) { el.library.classList.remove("open"); this._updateScrim(); }
    });

    // 拖拽加载
    this._listen(window, "dragenter", (e) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      this._dragDepth++;
      el.dropOverlay.hidden = false;
    });
    this._listen(window, "dragover", (e) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    });
    this._listen(window, "dragleave", (e) => {
      e.preventDefault();
      this._dragDepth = Math.max(0, this._dragDepth - 1);
      if (this._dragDepth === 0) el.dropOverlay.hidden = true;
    });
    this._listen(window, "drop", (e) => {
      e.preventDefault();
      this._dragDepth = 0;
      el.dropOverlay.hidden = true;
      const files = Array.from(e.dataTransfer?.files || []);
      for (const f of files) {
        if (/\.nes$/i.test(f.name)) a.importRomFile(f);
        else if (/\.sav$/i.test(f.name)) a.importSramFile(f);
        else if (/\.json$/i.test(f.name)) a.importStateFile(f);
        else this.toast(`不支持的文件类型：${f.name}`, "warn");
      }
    });

    // 触屏手柄
    this.app.input.bindTouchPad(el.touchpad);
    if (matchMedia("(pointer: coarse)").matches) {
      el.touchpad.hidden = false;
      $("optTouch").checked = true;
    }

    // 点击按钮后释放焦点：避免焦点留在传输栏按钮上时，
    // Enter/Space（游戏 Start/暂停快捷键）误触发按钮点击。
    // 监听收敛到 root，仅作用于模拟器内部按钮，不影响站点其他区域焦点。
    this._listen(this.root, "click", (e) => {
      const b = e.target?.closest?.("button");
      if (b && !b.classList.contains("map-key")) b.blur();
    });
  }

  _updateScrim() {
    const mobile = matchMedia("(max-width: 1024px)").matches;
    const libOpen = this.el.library.classList.contains("open");
    const panelOpen = mobile && !this.el.layout.classList.contains("panel-collapsed");
    this.el.scrim.hidden = !(libOpen || panelOpen);
  }

  // ------------------------------ 设置同步 ------------------------------
  syncSettings() {
    const s = this.app.settings, el = this.el, $ = this.$;
    el.volSlider.value = Math.round(s.volume * 100);
    el.ffSelect.value = String(s.ffSpeed);
    $("optCrt").checked = s.crt;
    $("optPixel").checked = s.pixelPerfect;
    $("optOverscan").checked = s.overscan;
    $("optScanline").value = Math.round(s.scanlineIntensity * 100);
    $("optScanlineVal").textContent = Math.round(s.scanlineIntensity * 100) + "%";
    $("optBuffer").value = s.audioBuffer;
    $("dzSlider").value = Math.round(s.deadzone * 100);
    $("dzVal").textContent = s.deadzone.toFixed(2);
    $("turboRate").value = s.turboRate;
    $("turboRateVal").textContent = s.turboRate + " Hz";
    $("turboA").checked = s.turboA;
    $("turboB").checked = s.turboB;
    $("hapEnabled").checked = s.haptics.enabled;
    $("hapIntensity").value = Math.round(s.haptics.intensity * 100);
    $("hapIntensityVal").textContent = Math.round(s.haptics.intensity * 100) + "%";
    $("hapDuration").value = s.haptics.duration;
    $("hapDurationVal").textContent = s.haptics.duration + "ms";
    this.root.querySelectorAll("#hapTriggers input").forEach((cb) => {
      cb.checked = s.haptics.triggers[cb.dataset.trigger] !== false;
    });
    if (s.panelCollapsed) el.layout.classList.add("panel-collapsed");
    this.openTab(s.activeTab || "states", true);
    this._syncMuteIcon();
    this._bufferLabel();
    this.applyVideo();
    this.app.core.setVolume(s.volume);
    this.app.core.setMuted(s.muted);
    this.app.core.setSpeed(s.ffSpeed);
    this.app.core.setAudioBuffer(s.audioBuffer);
    this.app.core.setOverscan(s.overscan);
    this._updateFfBadge();
  }

  _syncMuteIcon() {
    const m = this.app.settings.muted;
    this.el.icoVol.hidden = m;
    this.el.icoMute.hidden = !m;
    this.el.btnMute.classList.toggle("playing", !m);
  }

  _bufferLabel() {
    const rate = this.app.core.audioCtx?.sampleRate || 48000;
    const ms = Math.round((this.app.settings.audioBuffer / rate) * 1000);
    this.$("optBufferVal").textContent = `~${ms}ms`;
  }

  applyVideo() {
    const s = this.app.settings;
    this.el.crt.classList.toggle("off", !s.crt);
    this.el.crt.style.setProperty("--scan", s.scanlineIntensity);
  }

  openTab(name, silent = false) {
    this.root.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    this.root.querySelectorAll(".tabpane").forEach((p) => { p.hidden = p.id !== "pane-" + name; });
    if (!silent) { this.app.settings.activeTab = name; this.persist(); }
  }

  // ------------------------------ 画面缩放 ------------------------------
  fitScreen() {
    const shell = this.el.screenShell;
    const pad = 20;
    const w = shell.clientWidth - pad, h = shell.clientHeight - pad;
    if (w <= 0 || h <= 0) return;
    const fit = Math.min(w / 256, h / 240);
    const scale = this.app.settings.pixelPerfect ? Math.max(1, Math.floor(fit)) : Math.max(0.5, fit);
    this.el.canvas.style.width = Math.round(256 * scale) + "px";
    this.el.canvas.style.height = Math.round(240 * scale) + "px";
    this.el.scaleInfo.textContent = this.app.settings.pixelPerfect ? `×${scale}` : `×${scale.toFixed(2)}`;
  }

  // ------------------------------ 状态栏 ------------------------------
  setFps(fps) {
    const v = Math.round(fps);
    this.el.fpsVal.textContent = fps > 0 ? v : "--";
    this.el.chipFps.classList.toggle("live", v >= 55);
    this.el.chipFps.classList.toggle("warn", v > 0 && v < 55);
    this.el.chipFps.classList.toggle("bad", v === 0 && this.app.core.romLoaded && this.app.core.running);
  }
  setRomChip(name) { this.el.chipRom.textContent = name || "未加载 ROM"; }
  setPadCount(n) {
    this.el.padCount.textContent = n;
    this.el.chipPad.classList.toggle("on", n > 0);
  }
  setAudioChip(state) {
    const c = this.el.chipAudio;
    c.classList.remove("on", "off");
    if (state === "running") { c.textContent = "音频运行中"; c.classList.add("on"); }
    else if (state === "suspended") { c.textContent = "音频待激活"; c.classList.add("off"); }
    else { c.textContent = "音频不可用"; c.classList.add("off"); }
  }

  setRunning(running) {
    const loaded = this.app.core.romLoaded;
    this.el.btnPlay.disabled = !loaded;
    this.el.btnReset.disabled = !loaded;
    this.el.btnSave.disabled = !loaded;
    this.el.btnLoad.disabled = !loaded || !this.app.states.some(Boolean);
    this.el.icoPlay.hidden = running;
    this.el.icoPause.hidden = !running;
    this.el.btnPlay.classList.toggle("playing", running);
    this.el.pauseBadge.hidden = running || !loaded;
    this.el.screenMsg.classList.toggle("hidden", loaded);
    this._updateFfBadge();
  }

  _updateFfBadge() {
    const sp = this.app.settings.ffSpeed;
    this.el.ffBadge.hidden = sp <= 1 || !this.app.core.romLoaded;
    this.el.ffBadge.textContent = `▶▶ ${sp}×`;
  }

  setLoading(on, text = "正在加载 ROM…") {
    this.el.loading.hidden = !on;
    this.el.loadingText.textContent = text;
  }

  // ------------------------------ 游戏库 ------------------------------
  renderLibrary() {
    const app = this.app;
    const q = this.el.libSearch.value.trim().toLowerCase();
    const sort = this.el.libSort.value;
    const libEntries = [...app.library.values()];
    const knownFiles = new Set(libEntries.map((m) => m.file).filter(Boolean));
    const serverOnly = app.serverRoms
      .filter((r) => !knownFiles.has(r.file))
      .map((r) => ({ id: "srv:" + r.file, name: r.name, file: r.file, url: r.url, size: r.size, source: "server", transient: true, lastPlayed: 0, addedAt: 0 }));
    let items = [...libEntries, ...serverOnly];
    if (q) items = items.filter((m) => m.name.toLowerCase().includes(q));
    const byName = (a, b) => a.name.localeCompare(b.name, "zh-CN");
    if (sort === "name") items.sort(byName);
    else if (sort === "added") items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0) || byName(a, b));
    else items.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || byName(a, b));

    this.el.libCount.textContent = items.length;
    const list = this.el.libList;
    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML = `<div class="lib-empty">未找到游戏<br>点击下方按钮导入 .nes 文件<br>或将自有 ROM 放入站点 roms/ 目录并更新清单</div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    for (const m of items) {
      const item = document.createElement("button");
      item.className = "lib-item";
      item.type = "button";
      if (app.currentRom?.id === m.id) item.classList.add("active");
      if (m.supported === false) item.classList.add("unsupported");
      const cover = m.cover
        ? `<span class="lib-cover"><img src="${m.cover}" alt=""></span>`
        : `<span class="lib-cover">${escapeHtml(m.name.slice(0, 1))}</span>`;
      const mapperTag = m.mapper != null
        ? `<span class="mapper-tag${m.supported === false ? " bad" : ""}">M${m.mapper}${m.supported === false ? " ✕" : ""}</span>` : "";
      const sub = m.lastPlayed ? fmtTime(m.lastPlayed) : "未游玩";
      item.innerHTML = `${cover}
        <span class="lib-meta">
          <span class="lib-name">${escapeHtml(m.name)}</span>
          <span class="lib-sub">${mapperTag}<span>${sub}</span></span>
        </span>
        ${m.transient ? "<span></span>" : `<span class="lib-del" role="button" title="从游戏库移除" tabindex="0">✕</span>`}`;
      item.onclick = () => {
        app.actions.playEntry(m);
        if (matchMedia("(max-width: 760px)").matches) {
          this.el.library.classList.remove("open");
          this._updateScrim();
        }
      };
      const del = item.querySelector(".lib-del");
      if (del) del.onclick = (e) => { e.stopPropagation(); app.actions.deleteLibrary(m.id); };
      frag.appendChild(item);
    }
    list.appendChild(frag);
  }

  // ------------------------------ 存档槽位 ------------------------------
  renderSlots() {
    const app = this.app;
    const list = this.el.slotList;
    list.innerHTML = "";
    const loaded = app.core.romLoaded;
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      const rec = app.states.find((r) => r && r.slot === slot);
      const card = document.createElement("div");
      card.className = "slot-card" + (rec ? " filled" : "");
      card.innerHTML = `
        <span class="slot-thumb">${rec?.thumb ? `<img src="${rec.thumb}" alt="存档缩略图">` : `槽位 ${slot}`}</span>
        <span class="slot-info">
          <span class="slot-title"><span class="slot-no">SLOT ${slot}${app.quickSlot === slot ? " ⚡" : ""}</span></span>
          <span class="slot-ts">${rec ? escapeHtml(rec.name) + " · " + fmtTime(rec.ts) : "空"}</span>
          <span class="slot-actions">
            <button class="btn tiny" data-act="save" ${loaded ? "" : "disabled"}>存入</button>
            <button class="btn tiny" data-act="load" ${rec ? "" : "disabled"}>读取</button>
            <button class="btn tiny" data-act="export" ${rec ? "" : "disabled"}>导出</button>
            <button class="btn tiny" data-act="rename" ${rec ? "" : "disabled"}>改名</button>
            <button class="btn tiny danger" data-act="del" ${rec ? "" : "disabled"}>删除</button>
          </span>
        </span>`;
      card.querySelector('[data-act="save"]').onclick = () => app.actions.saveSlot(slot);
      card.querySelector('[data-act="load"]').onclick = () => app.actions.loadSlot(slot);
      card.querySelector('[data-act="export"]').onclick = () => app.actions.exportSlot(slot);
      card.querySelector('[data-act="rename"]').onclick = () => {
        this.openRename(rec.name, (name) => app.actions.renameSlot(slot, name));
      };
      card.querySelector('[data-act="del"]').onclick = () => app.actions.deleteSlot(slot);
      list.appendChild(card);
    }
    this.el.btnLoad.disabled = !loaded || !app.states.some(Boolean);
  }

  setSramStatus(text, ok = false) {
    this.el.sramStatus.textContent = text;
    this.el.sramStatus.classList.toggle("ok", ok);
    const has = this.app.currentRom?.header?.battery;
    this.$("btnSramExport").disabled = !has;
    this.$("btnSramImport").disabled = !this.app.core.romLoaded;
  }

  openRename(current, cb) {
    this._renameCb = cb;
    this.el.renameInput.value = current;
    this.el.renameModal.hidden = false;
    this._later(() => { this.el.renameInput.focus(); this.el.renameInput.select(); }, 30);
  }
  _closeRename(ok) {
    this.el.renameModal.hidden = true;
    const cb = this._renameCb;
    this._renameCb = null;
    if (ok && cb) cb(this.el.renameInput.value.trim() || "未命名存档");
  }

  // ------------------------------ 手柄 ------------------------------
  renderPadList(pads) {
    const box = this.el.padList;
    this.setPadCount(pads.length);
    if (!pads.length) {
      box.innerHTML = `<p class="hint">未检测到手柄</p>`;
    } else {
      box.innerHTML = pads.map((gp, i) => {
        const hap = this.app.haptics.probe(gp);
        return `<div class="pad-card">
          <div class="pad-name">🎮 ${escapeHtml(gp.id.slice(0, 60))}</div>
          <div class="pad-sub">
            <span class="tag ok">玩家 ${i + 1}</span>
            <span class="tag">${gp.mapping === "standard" ? "标准映射" : "非标准映射"}</span>
            <span class="tag ${hap ? "ok" : "no"}">${hap ? "支持震动" : "不支持震动"}</span>
          </div>
        </div>`;
      }).join("");
    }
    this.refreshHapticSupport(pads);
  }

  refreshHapticSupport(pads) {
    pads = pads || this.app.input.getConnectedPads();
    const tag = this.el.hapticSupport;
    if (!pads.length) { tag.textContent = "未检测"; tag.className = "tag"; return; }
    const any = pads.some((gp) => this.app.haptics.probe(gp));
    tag.textContent = any ? "可用" : "设备不支持";
    tag.className = "tag " + (any ? "ok" : "no");
  }

  _buildLamps() {
    const labels = ["A", "B", "SEL", "STA", "↑", "↓", "←", "→"];
    this.el.lampRow.innerHTML = labels.map((l) => `<span class="lamp">${l}</span>`).join("");
    this._lamps = [...this.el.lampRow.children];
  }

  updateLamps(player, states) {
    if (player !== Number(this.el.mapPlayer.value)) return;
    const sig = states.map((v) => (v ? 1 : 0)).join("");
    if (sig === this._lampCache[player]) return;
    this._lampCache[player] = sig;
    this._lamps.forEach((lamp, i) => lamp.classList.toggle("on", !!states[i]));
  }

  renderMapTable() {
    const s = this.app.settings;
    const player = Number(this.el.mapPlayer.value);
    const rows = [...NES_BUTTONS, "TURBO_A", "TURBO_B"];
    const labels = { A: "A", B: "B", SELECT: "Select", START: "Start", UP: "上", DOWN: "下", LEFT: "左", RIGHT: "右", TURBO_A: "A 连发", TURBO_B: "B 连发" };
    const findKey = (obj, btn) => Object.keys(obj).find((k) => obj[k] === btn);
    let html = `<tr><th>NES</th><th>键盘</th><th>手柄 P${player}</th></tr>`;
    for (const btn of rows) {
      const kc = findKey(s.keymap, btn);
      const pk = findKey(s.padmap[player] || {}, btn);
      html += `<tr><td>${labels[btn]}</td>
        <td><button class="map-key" data-kind="key" data-btn="${btn}">${keyLabel(kc)}</button></td>
        <td><button class="map-key" data-kind="pad" data-btn="${btn}">${padKeyLabel(pk)}</button></td></tr>`;
    }
    this.el.mapTable.innerHTML = html;
    this.el.mapTable.querySelectorAll(".map-key").forEach((b) => {
      b.onclick = () => this.startRemap(b.dataset.kind, player, b.dataset.btn, b);
    });
    this._lampCache[player] = "";
  }

  startRemap(kind, player, btn, btnEl) {
    this.app.input.cancelCapture();
    this.root.querySelectorAll(".map-key.listening").forEach((x) => x.classList.remove("listening"));
    btnEl?.classList.add("listening");
    this.el.captureText.textContent = kind === "key"
      ? `为「${btn}」按下键盘按键…`
      : `为「${btn}」按下手柄按键 / 拨动摇杆…`;
    this.el.captureOverlay.hidden = false;
    this.app.input.startCapture(kind, player, (result) => {
      this.el.captureOverlay.hidden = true;
      btnEl?.classList.remove("listening");
      const s = this.app.settings;
      if (kind === "key") {
        for (const k of Object.keys(s.keymap)) if (s.keymap[k] === btn) delete s.keymap[k];
        s.keymap[result] = btn;
      } else {
        const map = s.padmap[player];
        for (const k of Object.keys(map)) if (map[k] === btn) delete map[k];
        map[result] = btn;
      }
      this.persist();
      this.renderMapTable();
      this.toast(`映射已更新：${btn}`, "success");
    });
  }

  cancelRemap() {
    this.app.input.cancelCapture();
    this.el.captureOverlay.hidden = true;
    this.root.querySelectorAll(".map-key.listening").forEach((x) => x.classList.remove("listening"));
  }

  // ------------------------------ ROM 信息 / 金手指 ------------------------------
  renderRomInfo() {
    const rom = this.app.currentRom;
    const tb = this.el.romInfo.querySelector("tbody") || this.el.romInfo;
    if (!rom) { tb.innerHTML = `<tr><td colspan="2" class="hint">未加载</td></tr>`; return; }
    const h = rom.header;
    const rows = [
      ["名称", rom.name], ["指纹", rom.id],
      ["Mapper", `${h.mapper} · ${h.mapperName}${h.submapper ? " (sub " + h.submapper + ")" : ""}`],
      ["PRG / CHR", `${fmtSize(h.prgSize)} / ${h.chrSize ? fmtSize(h.chrSize) : "CHR-RAM"}`],
      ["镜像 / 区域", `${h.mirroring} · ${h.region}`],
      ["电池存档", h.battery ? "支持 (8KB SRAM)" : "无"],
      ["头部格式", h.nes2 ? "NES 2.0" : "iNES 1.0"],
      ["文件大小", fmtSize(rom.bytes.length)],
    ];
    tb.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${escapeHtml(String(v))}</td></tr>`).join("");
  }

  renderCheats() {
    const app = this.app;
    const list = this.el.cheatList;
    this.$("cheatMaster").checked = app.cheats.enabled;
    if (!app.cheats.codes.length) {
      list.innerHTML = `<p class="hint">当前游戏暂无金手指码</p>`;
      return;
    }
    list.innerHTML = "";
    app.cheats.codes.forEach((c, i) => {
      const item = document.createElement("div");
      item.className = "cheat-item" + (c.on ? "" : " off");
      item.innerHTML = `<span class="cheat-code">${escapeHtml(c.code)}</span>
        <label class="switch mini"><input type="checkbox" ${c.on ? "checked" : ""}><i></i></label>
        <button class="btn tiny danger">✕</button>`;
      item.querySelector("input").onchange = (e) => app.actions.toggleCheat(i, e.target.checked);
      item.querySelector("button").onclick = () => app.actions.removeCheat(i);
      list.appendChild(item);
    });
  }

  // ------------------------------ Toast ------------------------------
  toast(msg, type = "info", action = null) {
    const box = this.el.toasts;
    while (box.children.length >= 4) box.firstChild.remove();
    const t = document.createElement("div");
    t.className = "toast " + type;
    const span = document.createElement("span");
    span.textContent = msg;
    t.appendChild(span);
    if (action) {
      const b = document.createElement("button");
      b.className = "btn tiny toast-act";
      b.textContent = action.label;
      b.onclick = () => { action.fn(); dismiss(); };
      t.appendChild(b);
    }
    box.appendChild(t);
    const dismiss = () => {
      if (!t.parentNode) return;
      t.classList.add("out");
      this._later(() => t.remove(), 260);
    };
    this._later(dismiss, action ? 6000 : 3400);
  }

  // ------------------------------ 资源释放 ------------------------------
  destroy() {
    // 移除 window/document 全局监听与 ResizeObserver
    this._cleanup.forEach((off) => { try { off(); } catch {} });
    this._cleanup = [];
    this._timers.forEach((id) => clearTimeout(id));
    this._timers.clear();
    if (this._ro) { try { this._ro.disconnect(); } catch {} this._ro = null; }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
