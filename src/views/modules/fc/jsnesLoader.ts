// ============================================================================
// jsnes UMD 核心的按需加载器（懒加载挂载的关键一环）
//  - 模拟器核心 jsnes.min.js（约 130KB）不进主包：仅当用户进入 FC 模拟器模块时，
//    才向 <head> 注入 <script>，加载完成后挂到 window.jsnes 供核心模块使用。
//  - 使用模块级缓存的 Promise，保证多次进入模块只加载/注入一次。
//  - 加载失败时抛出可恢复的错误，由上层展示重试入口。
// ============================================================================

declare global {
  interface Window { jsnes?: any; }
}

/** 脚本部署地址：跟随 Vite base（如 /home-page/jsnes.min.js） */
const JSNES_SRC = `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/jsnes.min.js`;

let loading: Promise<void> | null = null;

function isReady(): boolean {
  return typeof window !== "undefined" && !!window.jsnes && !!window.jsnes.NES;
}

/**
 * 加载并注入 jsnes 核心。重复调用返回同一 Promise（幂等）。
 * 已就绪时立即 resolve。
 */
export function loadJsnes(): Promise<void> {
  if (isReady()) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = JSNES_SRC;
    script.async = true;
    script.onload = () => {
      if (isReady()) resolve();
      else {
        loading = null;
        reject(new Error("jsnes 已加载但未挂载 window.jsnes，请检查脚本内容"));
      }
    };
    script.onerror = () => {
      // 失败后清除缓存，允许上层“重试”重新注入
      loading = null;
      script.remove();
      reject(new Error(`jsnes 核心加载失败：${JSNES_SRC}`));
    };
    document.head.appendChild(script);
  });

  return loading;
}
