import { useEffect, useRef, useState } from "preact/hooks";
import { loadJsnes } from "./jsnesLoader";
import "./emulator.less";

type Phase = "loading" | "ready" | "error";

/**
 * JASMINE·FC —— NES/FC 在线模拟器（由独立静态项目改造而来的可嵌入功能模块）
 *
 * 集成要点：
 * 1. 统一入口：作为 Preact 组件挂载到站点 hash 路由（见 @/layout/router）。
 * 2. 懒加载：jsnes 运行时核心与模拟器业务模块均“仅在进入本页面时”动态注入 / import，
 *    不进入站点首屏主包；ROM 清单在启动时按需拉取，ROM 二进制在选中游戏时才下载并缓存。
 * 3. 生命周期：createEmulatorApp 返回 destroy()，组件卸载时释放 rAF / 音频 / 全局监听，
 *    确保反复进出路由不泄漏、不影响站点其他功能。
 * 4. 加载态与失败处理：核心初始化中显示遮罩，失败时展示错误与“重试”。
 */
export default function NesEmulator() {
  const rootRef = useRef<HTMLDivElement>(null);
  const destroyRef = useRef<null | (() => void)>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase("loading");
      setErrMsg("");
      try {
        // 1) 按需注入 jsnes 核心（UMD → window.jsnes）
        await loadJsnes();
        if (cancelled) return;
        // 2) jsnes 就绪后再动态加载业务模块（其内部求值依赖 window.jsnes）
        const mod = await import("./core/app");
        if (cancelled || !rootRef.current) return;
        const handle = mod.createEmulatorApp(rootRef.current);
        destroyRef.current = handle.destroy;
        // 聚焦模拟器容器，使快捷键仅在模拟器上下文内生效（详见 core/app 的 keydown 过滤）
        rootRef.current?.focus({ preventScroll: true });
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        setErrMsg(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      destroyRef.current?.();
      destroyRef.current = null;
    };
  }, [attempt]);

  return (
    <div class="jf-app" ref={rootRef} tabIndex={-1}>
      {/* 背景层：细网格 + 极光光斑 + 噪点 */}
      <div class="bg" aria-hidden="true">
        <div class="bg-grid"></div>
        <div class="bg-glow g1"></div>
        <div class="bg-glow g2"></div>
        <div class="bg-glow g3"></div>
        <div class="bg-noise"></div>
      </div>

      {/* ======================= 顶部状态栏 ======================= */}
      <header id="topbar">
        <button id="btnLibrary" class="icon-btn only-mobile" title="游戏库" aria-label="打开游戏库">
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div class="brand">
          <span class="brand-mark">◆</span>
          <span class="brand-name">JASMINE<span class="brand-accent">·FC</span></span>
          <span class="brand-sub">NES WEB EMULATOR</span>
        </div>
        <div class="status-chips">
          <span class="chip" id="chipFps" title="模拟帧率"><i class="dot"></i><b id="fpsVal">--</b>{"\u00A0"}FPS</span>
          <span class="chip chip-rom" id="chipRom" title="当前 ROM">未加载 ROM</span>
          <span class="chip" id="chipPad" title="手柄连接状态">
            <svg viewBox="0 0 24 24" class="chip-ico"><path d="M6 9h12a4 4 0 0 1 4 4v3a3 3 0 0 1-3 3c-1.5 0-2.5-1-3.5-2h-7C7.5 18 6.5 19 5 19a3 3 0 0 1-3-3v-3a4 4 0 0 1 4-4zM8 12v3M6.5 13.5h3M15.5 12.5h.01M18 14.5h.01" /></svg>
            <b id="padCount">0</b>
          </span>
          <span class="chip" id="chipAudio" title="点击恢复音频">音频待机</span>
        </div>
        <div class="top-actions">
          <button id="btnShot" class="icon-btn" title="截图 (P)" aria-label="截图">
            <svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /></svg>
          </button>
          <button id="btnFull" class="icon-btn" title="全屏 (F)" aria-label="全屏">
            <svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          </button>
          <button id="btnPanel" class="icon-btn" title="折叠/展开面板" aria-label="折叠面板">
            <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM15 5v14" /></svg>
          </button>
        </div>
      </header>

      {/* ======================= 主布局 ======================= */}
      <main id="layout">
        {/* 左侧：游戏库 */}
        <aside id="library" class="glass">
          <div class="lib-head">
            <h2>游戏库 <span class="count-tag" id="libCount">0</span></h2>
            <div class="lib-tools">
              <input id="libSearch" type="search" placeholder="搜索游戏…" autocomplete="off" />
              <select id="libSort" title="排序方式">
                <option value="recent">最近游玩</option>
                <option value="name">名称</option>
                <option value="added">加入时间</option>
              </select>
            </div>
          </div>
          <div id="libList" class="lib-list" role="list"></div>
          <div class="lib-foot">
            <button id="btnImportRom" class="btn primary block">
              <svg viewBox="0 0 24 24" class="btn-ico"><path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v3h16v-3" /></svg>
              导入本地 .nes
            </button>
            <p class="hint">也可以把 ROM 文件拖拽到页面任意位置</p>
          </div>
        </aside>

        {/* 中间：主画布 + 传输控制 */}
        <section id="stage">
          <div id="screenShell">
            <div id="screenBox">
              <canvas id="screen" width={256} height={240}></canvas>
              <div id="crtOverlay" aria-hidden="true"></div>
              <div id="screenMsg">
                <div class="msg-inner">
                  <div class="pixel-logo">JASMINE<span>·FC</span></div>
                  <p class="msg-line">从左侧游戏库选择游戏，或将 <b>.nes</b> 文件拖入此处</p>
                  <p class="kbd-hint"><kbd>X</kbd>{"\u00A0\u00A0"}A{"\u00A0\u00A0"}<kbd>Z</kbd>{"\u00A0\u00A0"}B{"\u00A0\u00A0"}<kbd>Enter</kbd>{"\u00A0\u00A0"}Start{"\u00A0\u00A0"}<kbd>RShift</kbd>{"\u00A0\u00A0"}Select</p>
                  <p class="kbd-hint dim"><kbd>F5</kbd>{"\u00A0"}存档{"\u00A0\u00A0"}<kbd>F8</kbd>{"\u00A0"}读档{"\u00A0\u00A0"}<kbd>Space</kbd>{"\u00A0"}暂停</p>
                </div>
              </div>
              <div id="pauseBadge" hidden><span>❚❚</span>{"\u00A0"}已暂停</div>
              <div id="ffBadge" hidden>▶▶ 2×</div>
              <div id="loadingOverlay" hidden>
                <div class="loader"><i></i><i></i><i></i><i></i></div>
                <p id="loadingText">正在加载 ROM…</p>
              </div>
            </div>
          </div>

          <div id="transport" class="glass">
            <button id="btnPlay" class="tbtn" title="暂停/继续 (Space)" disabled>
              <svg viewBox="0 0 24 24" id="icoPlay"><path d="M8 5v14l11-7z" /></svg>
              <svg viewBox="0 0 24 24" id="icoPause" hidden><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
            </button>
            <button id="btnReset" class="tbtn" title="重置 (R)" disabled>
              <svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5" /></svg>
            </button>
            <div class="tsep"></div>
            <button id="btnSave" class="tbtn accent" title="即时存档到当前槽位 (F5)" disabled>存档</button>
            <button id="btnLoad" class="tbtn accent" title="读取最近存档 (F8)" disabled>读档</button>
            <div class="tsep"></div>
            <label class="ff-wrap" title="快进倍率（快进时静音）">快进
              <select id="ffSelect">
                <option value="1">1×</option><option value="2">2×</option>
                <option value="3">3×</option><option value="4">4×</option>
              </select>
            </label>
            <div class="vol-wrap">
              <button id="btnMute" class="tbtn" title="静音 (M)">
                <svg viewBox="0 0 24 24" id="icoVol"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>
                <svg viewBox="0 0 24 24" id="icoMute" hidden><path d="M4 9v6h4l5 4V5L8 9zM16 9l5 6M21 9l-5 6" /></svg>
              </button>
              <input id="volSlider" type="range" min="0" max="100" value="80" title="音量" />
            </div>
            <span id="scaleInfo" class="scale-info" title="当前整数缩放倍率">×1</span>
          </div>

          {/* 移动端触屏虚拟手柄 */}
          <div id="touchpad" hidden>
            <div class="tp-dpad">
              <button class="tp-btn tp-up" data-btn="UP" aria-label="上">▲</button>
              <button class="tp-btn tp-left" data-btn="LEFT" aria-label="左">◀</button>
              <button class="tp-btn tp-right" data-btn="RIGHT" aria-label="右">▶</button>
              <button class="tp-btn tp-down" data-btn="DOWN" aria-label="下">▼</button>
              <span class="tp-center"></span>
            </div>
            <div class="tp-mid">
              <button class="tp-btn tp-small" data-btn="SELECT">SELECT</button>
              <button class="tp-btn tp-small" data-btn="START">START</button>
            </div>
            <div class="tp-ab">
              <button class="tp-btn tp-round tp-b" data-btn="B">B</button>
              <button class="tp-btn tp-round tp-a" data-btn="A">A</button>
              <button class="tp-btn tp-round tp-turbo" data-btn="TURBO_A" title="A 连发">A⁺</button>
            </div>
          </div>
        </section>

        {/* 右侧：可折叠功能面板 */}
        <aside id="sidepanel" class="glass">
          <nav id="tabs" role="tablist">
            <button data-tab="states" class="active" role="tab">存档</button>
            <button data-tab="pads" role="tab">手柄</button>
            <button data-tab="video" role="tab">画质·音频</button>
            <button data-tab="cheats" role="tab">金手指</button>
          </nav>

          {/* 存档面板 */}
          <div class="tabpane" id="pane-states">
            <div class="pane-head">
              <h3>即时存档槽位</h3>
              <button id="btnImportState" class="btn tiny">导入存档</button>
            </div>
            <div id="slotList"></div>
            <div class="sram-box">
              <h4>电池存档（SRAM / .sav）</h4>
              <p id="sramStatus" class="hint">加载带电池存档的游戏后自动保存进度</p>
              <div class="row">
                <button id="btnSramExport" class="btn tiny" disabled>导出 .sav</button>
                <button id="btnSramImport" class="btn tiny" disabled>导入 .sav</button>
              </div>
            </div>
          </div>

          {/* 手柄面板 */}
          <div class="tabpane" id="pane-pads" hidden>
            <h3>已连接手柄</h3>
            <div id="padList"><p class="hint">未检测到手柄</p></div>
            <p class="hint" id="padHint">浏览器隐私限制：连接手柄后需先按任意键，页面才能识别设备。第 1 个手柄 = 玩家 1，第 2 个 = 玩家 2。</p>

            <div class="pane-head">
              <h3>按键映射</h3>
              <select id="mapPlayer" title="选择要配置的玩家">
                <option value="1">玩家 1</option><option value="2">玩家 2</option>
              </select>
            </div>
            <div id="lampRow" title="实时按键状态"></div>
            <table id="mapTable"></table>
            <div class="setting-row">
              <label htmlFor="dzSlider">摇杆死区</label>
              <input id="dzSlider" type="range" min="5" max="60" value="25" />
              <span class="val" id="dzVal">0.25</span>
            </div>
            <div class="setting-row">
              <label htmlFor="turboRate">连发频率</label>
              <input id="turboRate" type="range" min="4" max="30" value="15" />
              <span class="val" id="turboRateVal">15 Hz</span>
            </div>
            <div class="row switch-row">
              <label class="switch"><input type="checkbox" id="turboA" /><i></i>A 键连发</label>
              <label class="switch"><input type="checkbox" id="turboB" /><i></i>B 键连发</label>
            </div>
            <button id="btnResetMap" class="btn tiny">恢复默认映射</button>

            <div class="haptic-box">
              <div class="pane-head">
                <h3>震动反馈</h3>
                <span id="hapticSupport" class="tag">未检测</span>
              </div>
              <p class="hint">NES 原机与 ROM 不存在震动信号，震动由前端事件模拟触发（存档 / 读档 / 重置 / 开始游戏）。需 HTTPS 或 localhost。</p>
              <label class="switch"><input type="checkbox" id="hapEnabled" checked /><i></i>启用震动</label>
              <div class="setting-row">
                <label htmlFor="hapIntensity">强度</label>
                <input id="hapIntensity" type="range" min="0" max="100" value="70" />
                <span class="val" id="hapIntensityVal">70%</span>
              </div>
              <div class="setting-row">
                <label htmlFor="hapDuration">时长</label>
                <input id="hapDuration" type="range" min="50" max="600" step="10" value="150" />
                <span class="val" id="hapDurationVal">150ms</span>
              </div>
              <div id="hapTriggers" class="row switch-row wrap">
                <label class="switch mini"><input type="checkbox" data-trigger="save" checked /><i></i>存档</label>
                <label class="switch mini"><input type="checkbox" data-trigger="load" checked /><i></i>读档</label>
                <label class="switch mini"><input type="checkbox" data-trigger="reset" checked /><i></i>重置</label>
                <label class="switch mini"><input type="checkbox" data-trigger="start" checked /><i></i>开始</label>
              </div>
              <button id="btnHapTest" class="btn block">测试震动</button>
            </div>
          </div>

          {/* 画质·音频面板 */}
          <div class="tabpane" id="pane-video" hidden>
            <h3>画面</h3>
            <div class="row switch-row">
              <label class="switch"><input type="checkbox" id="optCrt" checked /><i></i>CRT 滤镜</label>
              <label class="switch"><input type="checkbox" id="optPixel" checked /><i></i>整数缩放</label>
            </div>
            <div class="row switch-row">
              <label class="switch"><input type="checkbox" id="optOverscan" /><i></i>TV 过扫描裁剪</label>
            </div>
            <p class="hint">裁剪会隐藏画面左右各 8 像素（模拟老式电视）；部分游戏 HUD 贴边绘制，建议保持关闭。</p>
            <div class="setting-row">
              <label htmlFor="optScanline">扫描线强度</label>
              <input id="optScanline" type="range" min="0" max="100" value="55" />
              <span class="val" id="optScanlineVal">55%</span>
            </div>
            <div class="row switch-row">
              <label class="switch"><input type="checkbox" id="optTouch" /><i></i>触屏手柄</label>
            </div>
            <h3>音频</h3>
            <div class="setting-row">
              <label htmlFor="optBuffer">音频缓冲</label>
              <input id="optBuffer" type="range" min="1024" max="16384" step="512" value="4096" />
              <span class="val" id="optBufferVal">~85ms</span>
            </div>
            <p class="hint">缓冲越小延迟越低，但性能不足时容易爆音；快进时自动静音。</p>
            <h3>当前 ROM 信息</h3>
            <table id="romInfo" class="info-table"><tbody><tr><td colSpan={2} class="hint">未加载</td></tr></tbody></table>
          </div>

          {/* 金手指面板 */}
          <div class="tabpane" id="pane-cheats" hidden>
            <div class="pane-head">
              <h3>Game Genie 金手指</h3>
              <label class="switch mini"><input type="checkbox" id="cheatMaster" checked /><i></i>总开关</label>
            </div>
            <p class="hint">支持 6 / 8 位 Game Genie 码（如 SXIOPO）或十六进制格式（如 8000:FF?A5）。码作用于 PRG ROM 读取，对部分切换 bank 的游戏可能无效；读档不会丢失金手指。</p>
            <div class="row">
              <input id="cheatInput" type="text" placeholder="输入金手指码…" autocomplete="off" spellcheck={false} />
              <button id="btnCheatAdd" class="btn tiny">添加</button>
            </div>
            <div id="cheatList"></div>
          </div>
        </aside>
      </main>

      {/* 浮层：提示 / 重映射捕获 / 拖拽 / 重命名 */}
      <div id="toasts" aria-live="polite"></div>

      <div id="captureOverlay" hidden>
        <div class="capture-card glass">
          <div class="capture-ring"></div>
          <p id="captureText">请按下键盘按键…</p>
          <button id="captureCancel" class="btn tiny">取消 (Esc)</button>
        </div>
      </div>

      <div id="dropOverlay" hidden>
        <div class="drop-card">
          <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v3h16v-3" /></svg>
          <p>松开以载入文件</p>
          <span>.nes 游戏 · .sav 电池存档 · .json 即时存档</span>
        </div>
      </div>

      <div id="renameModal" hidden>
        <div class="modal-card glass">
          <h3>重命名存档</h3>
          <input id="renameInput" type="text" maxlength={40} autocomplete="off" />
          <div class="row end">
            <button id="renameCancel" class="btn tiny">取消</button>
            <button id="renameOk" class="btn tiny primary">确定</button>
          </div>
        </div>
      </div>

      <div id="scrim" hidden></div>

      {/* 核心初始化遮罩（懒加载 / 失败重试） */}
      {phase !== "ready" && (
        <div class="jf-boot-mask">
          {phase === "loading" ? (
            <>
              <div class="loader"><i></i><i></i><i></i><i></i></div>
              <div class="jf-boot-title">JASMINE·FC</div>
              <div>正在按需装载模拟器核心（首次进入约 130KB 运行时）…</div>
            </>
          ) : (
            <>
              <div class="jf-boot-title">核心加载失败</div>
              <div class="jf-boot-error">{errMsg || "模拟器运行时加载出错，请检查网络后重试"}</div>
              <button class="jf-retry" type="button" onClick={() => setAttempt((a) => a + 1)}>重试</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
