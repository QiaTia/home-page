// @ts-nocheck
// ============================================================================
// 应用工厂：装配 模拟核心 / 输入 / 震动 / 存储 / UI，并实现全部业务动作。
// 由原 main.js 的“模块加载即自启动”改造为 createEmulatorApp(root) 工厂：
//  - 所有 DOM 查找限定在传入的 root 容器内，可随组件挂载 / 卸载反复创建销毁；
//  - 全部 window/document 监听登记后由 destroy() 统一移除；
//  - ROM 清单（manifest）在启动时按需拉取，ROM 二进制在选中游戏时按需下载并缓存。
// ============================================================================
import { EmulatorCore } from "./emulator";
import { InputManager } from "./input";
import { Haptics } from "./haptics";
import { UI } from "./ui";
import { db, loadSettings, saveSettings, downloadBlob } from "./storage";
import { parseHeader, romFingerprint, loadRomManifest, fmtTime } from "./rom";

/**
 * 在指定容器内创建一个完整的模拟器应用实例。
 * @param {HTMLElement} root 组件渲染好的骨架容器（内含 #screen / #layout 等）
 * @param {object} opts { onStatus } 预留：向 Preact 层回传运行状态
 * @returns {{ destroy: () => void }}
 */
export function createEmulatorApp(root, opts = {}) {
  const settings = loadSettings();

  const app = {
    settings,
    root,
    core: null, input: null, haptics: null, ui: null,
    serverRoms: [],
    library: new Map(),       // romId → 元数据
    currentRom: null,         // { id, name, bytes, header, file?, url? }
    states: [],               // 当前 ROM 的存档记录
    cheats: { enabled: true, codes: [] },
    quickSlot: 1,
    actions: {},
  };

  const _cleanups = [];
  const _listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    _cleanups.push(() => target.removeEventListener(type, fn, options));
  };
  const _timers = new Set();
  const _setTimeout = (fn, ms) => {
    const id = setTimeout(() => { _timers.delete(id); fn(); }, ms);
    _timers.add(id);
    return id;
  };

  // ------------------------------ 核心装配 ------------------------------
  app.core = new EmulatorCore(root.querySelector("#screen"), {
    onFps: (fps) => app.ui?.setFps(fps),
    onPoll: (t) => app.input?.poll(t),
    onAudioState: (st) => app.ui?.setAudioChip(st),
    onSramDirty: () => persistSram(),
    onCrash: (err) => {
      app.ui?.setRunning(false);
      app.ui?.toast(`模拟核心异常：${err.message || err}。请重置游戏或更换 ROM。`, "error");
    },
  });
  app.input = new InputManager(app.core, settings, {
    onPadsChanged: (pads) => app.ui?.renderPadList(pads),
    onLamps: (player, states) => app.ui?.updateLamps(player, states),
  });
  app.haptics = new Haptics(settings);
  app.ui = new UI(app, root);

  // ------------------------------ 业务动作 ------------------------------
  const A = app.actions;

  /** 从游戏库条目启动（服务器/清单条目先下载，本地条目读 IndexedDB 缓存） */
  A.playEntry = async (m) => {
    app.ui.setLoading(true, `正在加载「${m.name}」…`);
    try {
      let bytes = null;
      if (!m.transient) {
        const rec = await db.get("roms", m.id);
        if (rec?.data) bytes = rec.data instanceof Uint8Array ? rec.data : new Uint8Array(rec.data);
      }
      if (!bytes && m.url) {
        const r = await fetch(m.url);
        if (!r.ok) throw new Error(`下载失败 HTTP ${r.status}`);
        bytes = new Uint8Array(await r.arrayBuffer());
      }
      if (!bytes) throw new Error("找不到 ROM 数据");
      await startRom(bytes, m.name, m);
    } catch (err) {
      app.ui.toast(`加载失败：${err.message || err}`, "error");
    } finally {
      app.ui.setLoading(false);
    }
  };

  /** 本地文件导入（拖拽 / 选择） */
  A.importRomFile = async (file) => {
    app.ui.setLoading(true, `正在读取 ${file.name}…`);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await startRom(bytes, file.name.replace(/\.nes$/i, ""), { source: "local", file: file.name });
    } catch (err) {
      app.ui.toast(`导入失败：${err.message || err}`, "error");
    } finally {
      app.ui.setLoading(false);
    }
  };

  /** 校验头部 → 装载核心 → 恢复 SRAM/金手指 → 更新游戏库 */
  async function startRom(bytes, name, meta = {}) {
    const header = parseHeader(bytes);
    if (!header.valid) throw new Error(header.error);
    const id = romFingerprint(bytes, header);

    if (!header.supported) {
      // 不支持的 Mapper：友好提示并记录到游戏库（置灰显示）
      const bad = { ...meta, id, name, file: meta.file, url: meta.url, source: meta.source || "local", mapper: header.mapper, mapperName: header.mapperName, supported: false, region: header.region, addedAt: meta.addedAt || Date.now(), lastPlayed: meta.lastPlayed || 0, playCount: meta.playCount || 0 };
      app.library.set(id, bad);
      await db.put("library", bad).catch(() => {});
      app.ui.renderLibrary();
      throw new Error(`暂不支持 Mapper ${header.mapper}（${header.mapperName}）。JSNES 支持：0/1/2/3/4/5/7/9/11/34/38/66/71/79/94/118/119/140/180/240/241`);
    }
    if (header.sizeMismatch) app.ui.toast("警告：ROM 实际大小小于头部声明，可能被截断", "warn");

    app.core.ensureAudio();
    app.input.releaseAll();

    // 恢复电池 SRAM 与金手指
    const sramRec = header.battery ? await db.get("sram", id).catch(() => null) : null;
    app.core.loadRom(bytes, header, sramRec?.data ? new Uint8Array(sramRec.data) : null);

    const cheatRec = await db.get("cheats", id).catch(() => null);
    app.cheats = cheatRec ? { enabled: cheatRec.enabled !== false, codes: cheatRec.codes || [] } : { enabled: true, codes: [] };
    applyCheatsToCore();

    // 更新游戏库元数据
    const prev = app.library.get(id);
    const libMeta = {
      id, name, file: meta.file || prev?.file, url: meta.url || prev?.url,
      source: meta.source || prev?.source || "local",
      mapper: header.mapper, mapperName: header.mapperName, supported: true, region: header.region,
      addedAt: prev?.addedAt || Date.now(),
      lastPlayed: Date.now(),
      playCount: (prev?.playCount || 0) + 1,
      cover: prev?.cover || null,
    };
    app.library.set(id, libMeta);
    await db.put("roms", { id, data: bytes }).catch(() => {});   // 缓存 ROM 二进制，下次免下载
    await db.put("library", libMeta).catch(() => {});

    app.currentRom = { id, name, bytes, header, file: libMeta.file, url: libMeta.url };
    app.states = (await db.all("states").catch(() => [])).filter((s) => s.romId === id);
    app.quickSlot = 1;

    app.ui.setRomChip(name);
    app.ui.setRunning(true);
    app.ui.renderLibrary();
    app.ui.renderSlots();
    app.ui.renderRomInfo();
    app.ui.renderCheats();
    app.ui.setSramStatus(
      header.battery
        ? (sramRec ? `已恢复电池存档 · ${fmtTime(sramRec.ts)}` : "电池存档已启用，游戏内保存后自动持久化")
        : "当前游戏不支持电池存档",
      header.battery
    );
    app.haptics.pulse("start");
    app.ui.toast(`已启动「${name}」 · Mapper ${header.mapper} ${header.mapperName}`, "success");

    // 运行一段时间后抓取封面缩略图；部分游戏开机画面纯黑，检测到黑屏则延后重试
    const captureCover = async (attempt = 0) => {
      if (app.currentRom?.id !== id || !app.core.running || app.core.destroyed) return;
      const buf = app.core.buf32;
      let lit = 0;
      for (let i = 0; i < buf.length; i += 97) if (buf[i] !== 0xff000000) lit++;
      if (lit < 4 && attempt < 3) { _setTimeout(() => captureCover(attempt + 1), 2500); return; }
      libMeta.cover = app.core.screenshot();
      await db.put("library", libMeta).catch(() => {});
      app.ui.renderLibrary();
    };
    _setTimeout(() => captureCover(), 2200);

    // 窄屏下启动游戏后自动收起侧面板，避免遮挡画布
    if (matchMedia("(max-width: 1024px)").matches) {
      app.ui.el.layout.classList.add("panel-collapsed");
      settings.panelCollapsed = true;
      saveSettings(settings);
      app.ui._updateScrim();
      _setTimeout(() => app.ui.fitScreen(), 320);
    }
  }

  // ------------------------------ 即时存档 ------------------------------
  A.saveSlot = async (slot) => {
    if (!app.core.romLoaded || !app.currentRom) return;
    const romId = app.currentRom.id;
    const prev = app.states.find((s) => s.slot === slot);
    const rec = {
      id: `${romId}:${slot}`, romId, slot,
      name: prev?.name || `存档 ${slot}`,
      ts: Date.now(),
      thumb: app.core.screenshot(),
      state: app.core.saveState(),
    };
    try {
      await db.put("states", rec);
    } catch (err) {
      app.ui.toast(`存档写入 IndexedDB 失败：${err.message || err}`, "error");
      return;
    }
    app.states = app.states.filter((s) => s.slot !== slot).concat(rec);
    app.quickSlot = slot;
    app.ui.renderSlots();
    app.ui.toast(`已存入槽位 ${slot}（F8 快速读取）`, "success");
    app.haptics.pulse("save");
  };

  A.loadSlot = async (slot) => {
    const rec = app.states.find((s) => s.slot === slot);
    if (!rec) { app.ui.toast(`槽位 ${slot} 为空`, "warn"); return; }
    try {
      app.input.releaseAll();
      app.core.loadState(rec.state);
      app.core.resume();
      app.quickSlot = slot;
      app.ui.setRunning(true);
      app.ui.renderSlots();
      app.ui.toast(`已读取槽位 ${slot} · ${rec.name}`, "success");
      app.haptics.pulse("load");
      if (app.currentRom?.header.battery) persistSram(); // 状态中含 SRAM，同步持久化
    } catch (err) {
      app.ui.toast(`读档失败：${err.message || err}（存档版本不兼容？）`, "error");
    }
  };

  A.loadLatest = () => {
    const filled = app.states.filter(Boolean);
    if (!filled.length) { app.ui.toast("当前游戏没有存档", "warn"); return; }
    const latest = filled.reduce((a, b) => (a.ts > b.ts ? a : b));
    A.loadSlot(latest.slot);
  };

  A.deleteSlot = async (slot) => {
    const rec = app.states.find((s) => s.slot === slot);
    if (!rec) return;
    await db.del("states", rec.id).catch(() => {});
    app.states = app.states.filter((s) => s.slot !== slot);
    app.ui.renderSlots();
    app.ui.toast(`已删除槽位 ${slot}`, "info", {
      label: "撤销",
      fn: async () => {
        await db.put("states", rec).catch(() => {});
        if (app.currentRom?.id === rec.romId) {
          app.states = app.states.concat(rec);
          app.ui.renderSlots();
        }
        app.ui.toast("已恢复存档", "success");
      },
    });
  };

  A.renameSlot = async (slot, name) => {
    const rec = app.states.find((s) => s.slot === slot);
    if (!rec) return;
    rec.name = name;
    await db.put("states", rec).catch(() => {});
    app.ui.renderSlots();
  };

  A.exportSlot = (slot) => {
    const rec = app.states.find((s) => s.slot === slot);
    if (!rec) return;
    const payload = {
      format: "jasmine-fc-state", version: 1, core: "jsnes-3.0",
      romId: rec.romId, romName: app.currentRom?.name || "", slot: rec.slot,
      name: rec.name, ts: rec.ts, thumb: rec.thumb, state: rec.state,
    };
    downloadBlob(new Blob([JSON.stringify(payload)], { type: "application/json" }),
      `${payload.romName || "nes"}-S${slot}.json`);
    app.ui.toast("存档已导出为 JSON 文件", "success");
  };

  A.importStateFile = async (file) => {
    try {
      const j = JSON.parse(await file.text());
      if (j.format !== "jasmine-fc-state" || !j.state) throw new Error("不是本模拟器的存档文件");
      // 若存档属于其他 ROM，尝试先从库中装载对应 ROM
      if (app.currentRom?.id !== j.romId) {
        const romRec = await db.get("roms", j.romId).catch(() => null);
        const meta = app.library.get(j.romId);
        if (!romRec || !meta) throw new Error("存档对应的 ROM 不在游戏库中，请先加载该游戏");
        await startRom(new Uint8Array(romRec.data), meta.name, meta);
      }
      const used = new Set(app.states.map((s) => s.slot));
      let slot = j.slot >= 1 && j.slot <= 6 && !used.has(j.slot) ? j.slot : 0;
      if (!slot) { for (let i = 1; i <= 6; i++) if (!used.has(i)) { slot = i; break; } }
      if (!slot) slot = 6; // 全满时覆盖最后一个槽位
      const rec = {
        id: `${app.currentRom.id}:${slot}`, romId: app.currentRom.id, slot,
        name: j.name || file.name.replace(/\.json$/i, ""), ts: j.ts || Date.now(),
        thumb: j.thumb || app.core.screenshot(), state: j.state,
      };
      await db.put("states", rec);
      app.states = app.states.filter((s) => s.slot !== slot).concat(rec);
      app.ui.renderSlots();
      app.ui.toast(`存档已导入到槽位 ${slot}`, "success");
    } catch (err) {
      app.ui.toast(`导入存档失败：${err.message || err}`, "error");
    }
  };

  // ------------------------------ 电池 SRAM ------------------------------
  async function persistSram() {
    if (!app.currentRom?.header?.battery || app.core.destroyed) return;
    const data = app.core.readSram();
    const ts = Date.now();
    await db.put("sram", { romId: app.currentRom.id, data, ts }).catch(() => {});
    app.ui?.setSramStatus(`电池存档已自动保存 · ${fmtTime(ts)}`, true);
  }

  A.exportSram = () => {
    if (!app.currentRom?.header.battery) return;
    downloadBlob(new Blob([app.core.readSram()], { type: "application/octet-stream" }), `${app.currentRom.name}.sav`);
    app.ui.toast("电池存档已导出为 .sav", "success");
  };

  A.importSramFile = async (file) => {
    if (!app.core.romLoaded) { app.ui.toast("请先加载游戏", "warn"); return; }
    if (!app.currentRom.header.battery) { app.ui.toast("当前游戏不支持电池存档", "warn"); return; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length < 0x2000) { app.ui.toast(".sav 文件过小（需 8KB SRAM 镜像）", "error"); return; }
    app.core.writeSram(bytes);
    await persistSram();
    app.ui.toast("SRAM 已导入，部分游戏需重置后生效", "success");
  };

  // ------------------------------ 播放控制 ------------------------------
  A.togglePause = () => {
    if (!app.core.romLoaded) return;
    app.core.ensureAudio();
    app.core.togglePause();
    if (!app.core.running) app.core.flushSram();
    app.ui.setRunning(app.core.running);
  };

  A.reset = () => {
    if (!app.core.romLoaded) return;
    app.input.releaseAll();
    app.core.reset();
    app.ui.setRunning(true);
    app.ui.toast("已重置游戏", "info");
    app.haptics.pulse("reset");
  };

  A.setSpeed = (x) => {
    app.core.setSpeed(x);
    app.ui.setRunning(app.core.running);
  };

  A.screenshot = () => {
    if (!app.core.romLoaded) { app.ui.toast("请先加载游戏", "warn"); return; }
    app.core.canvas.toBlob((blob) => {
      if (!blob) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      downloadBlob(blob, `${app.currentRom?.name || "nes"}-${stamp}.png`);
      app.ui.toast("截图已保存", "success");
    }, "image/png");
  };

  // ------------------------------ 金手指 ------------------------------
  function applyCheatsToCore() {
    app.core.clearCheats();
    for (const c of app.cheats.codes) {
      if (!c.on) continue;
      try { app.core.addCheat(c.code); } catch { /* 无效码跳过 */ }
    }
    app.core.setCheatsEnabled(app.cheats.enabled);
  }

  async function persistCheats() {
    if (!app.currentRom) return;
    await db.put("cheats", { romId: app.currentRom.id, enabled: app.cheats.enabled, codes: app.cheats.codes }).catch(() => {});
  }

  A.addCheat = (code) => {
    if (!app.core.romLoaded) { app.ui.toast("请先加载游戏", "warn"); return false; }
    code = code.toUpperCase().replace(/\s+/g, "");
    if (app.cheats.codes.some((c) => c.code === code)) { app.ui.toast("该金手指已存在", "warn"); return false; }
    try {
      app.core.nes.gameGenie.decode(code); // 先校验格式
    } catch { /* decode 不抛错时下面 addCheat 校验 */ }
    try {
      app.core.addCheat(code);
    } catch {
      app.ui.toast("无效的金手指码（支持 6/8 位 GG 码或 地址:值?比较值）", "error");
      return false;
    }
    app.cheats.codes.push({ code, on: true });
    persistCheats();
    app.ui.renderCheats();
    app.ui.toast(`金手指 ${code} 已生效`, "success");
    return true;
  };

  A.toggleCheat = (i, on) => {
    app.cheats.codes[i].on = on;
    applyCheatsToCore();
    persistCheats();
    app.ui.renderCheats();
  };

  A.removeCheat = (i) => {
    app.cheats.codes.splice(i, 1);
    applyCheatsToCore();
    persistCheats();
    app.ui.renderCheats();
  };

  A.setCheatsEnabled = (on) => {
    app.cheats.enabled = on;
    app.core.setCheatsEnabled(on);
    persistCheats();
    app.ui.toast(on ? "金手指总开关：开" : "金手指总开关：关", "info");
  };

  // ------------------------------ 游戏库管理 ------------------------------
  A.deleteLibrary = async (id) => {
    const meta = app.library.get(id);
    if (!meta) return;
    const romRec = await db.get("roms", id).catch(() => null);
    const states = (await db.all("states").catch(() => [])).filter((s) => s.romId === id);
    const sram = await db.get("sram", id).catch(() => null);
    const cheats = await db.get("cheats", id).catch(() => null);

    app.library.delete(id);
    await Promise.all([
      db.del("library", id), db.del("roms", id), db.del("sram", id), db.del("cheats", id),
      ...states.map((s) => db.del("states", s.id)),
    ].map((p) => p.catch(() => {})));

    if (app.currentRom?.id === id) {
      app.core.pause();
      app.currentRom = null;
      app.states = [];
      app.ui.setRomChip(null);
      app.ui.setRunning(false);
      app.ui.renderSlots();
      app.ui.renderRomInfo();
      app.ui.setSramStatus("加载带电池存档的游戏后自动保存进度");
    }
    app.ui.renderLibrary();
    app.ui.toast(`已从游戏库移除「${meta.name}」`, "info", {
      label: "撤销",
      fn: async () => {
        app.library.set(id, meta);
        const puts = [db.put("library", meta)];
        if (romRec) puts.push(db.put("roms", romRec));
        if (sram) puts.push(db.put("sram", sram));
        if (cheats) puts.push(db.put("cheats", cheats));
        for (const s of states) puts.push(db.put("states", s));
        await Promise.all(puts.map((p) => p.catch(() => {})));
        app.ui.renderLibrary();
        app.ui.toast("已恢复", "success");
      },
    });
  };

  // ------------------------------ 全局快捷键（生命周期内注册） ------------------------------
  _listen(window, "keydown", (e) => {
    const t = e.target;
    // 仅处理源自模拟器区域内的按键，放行导航栏 / Footer / BackTop 等站点元素
    if (!(t instanceof Node) || !root.contains(t)) return;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (app.input.capturing || !root.querySelector("#renameModal").hidden) return;
    const loaded = app.core.romLoaded;
    // 未装载 ROM 时不拦截默认行为（保留浏览器刷新 / 页面滚动等）
    switch (e.code) {
      case "F5": if (loaded) { e.preventDefault(); A.saveSlot(app.quickSlot); } break;
      case "F8": if (loaded) { e.preventDefault(); A.loadLatest(); } break;
      case "Space": if (loaded) { e.preventDefault(); A.togglePause(); } break;
      case "KeyR": if (loaded) { e.preventDefault(); A.reset(); } break;
      case "KeyP": if (loaded) { e.preventDefault(); A.screenshot(); } break;
      case "KeyF": e.preventDefault(); root.querySelector("#btnFull").click(); break;
      case "KeyM": e.preventDefault(); root.querySelector("#btnMute").click(); break;
    }
  });

  // 首次交互时激活音频（浏览器自动播放策略）
  const wakeAudio = () => app.core.ensureAudio();
  _listen(window, "pointerdown", wakeAudio, { once: true });
  _listen(window, "keydown", wakeAudio, { once: true });

  // 页面隐藏 / 关闭前：落盘 SRAM 并暂停，避免后台空转
  _listen(document, "visibilitychange", () => {
    if (document.hidden) {
      app.core.flushSram();
      if (app.core.running) { app.core.pause(); app.ui.setRunning(false); }
    }
  });
  _listen(window, "pagehide", () => app.core.flushSram());

  // ------------------------------ 启动 ------------------------------
  (async function boot() {
    try {
      await db.open();
      if (app.core.destroyed) return;
      const metas = await db.all("library");
      if (app.core.destroyed) return;
      for (const m of metas) app.library.set(m.id, m);
    } catch (err) {
      if (app.core.destroyed) return;
      app.ui.toast("IndexedDB 不可用（隐私模式？），存档与游戏库将无法持久化", "error");
    }
    if (app.core.destroyed) return;
    app.ui.setRunning(false);
    app.ui.renderPadList(app.input.getConnectedPads());
    app.ui.renderLibrary();

    try {
      app.serverRoms = await loadRomManifest();
    } catch { app.serverRoms = []; }
    if (app.core.destroyed) return;   // 挂载已被卸载
    app.ui.renderLibrary();
    if (app.serverRoms.length) {
      app.ui.toast(`发现 ${app.serverRoms.length} 个站点 ROM（懒加载）`, "info");
    } else {
      app.ui.toast("未配置站点 ROM，可将自有 .nes 文件拖入页面开始", "warn");
    }
    opts.onStatus?.("ready");
  })().catch((err) => {
    console.error("[fc] 启动失败", err);
    opts.onStatus?.("error", err);
  });

  // ------------------------------ 资源释放 ------------------------------
  function destroy() {
    try { app.core.flushSram(); } catch {}
    _cleanups.forEach((off) => { try { off(); } catch {} });
    _cleanups.length = 0;
    _timers.forEach((id) => clearTimeout(id));
    _timers.clear();
    try { app.input.destroy(); } catch {}
    try { app.ui.destroy(); } catch {}
    try { app.core.destroy(); } catch {}
  }

  return { destroy };
}
