// @ts-nocheck
// ============================================================================
// ROM 模块：iNES / NES 2.0 头部解析、CRC32 指纹、ROM 清单（manifest）懒加载
// 参考：https://www.nesdev.org/wiki/INES  与  https://www.nesdev.org/wiki/NES_2.0
// 改造说明：
//  - 原实现依赖本地 serve.mjs 的 /api/roms 目录扫描；在纯静态 Web 部署下不可用。
//  - 现改为读取 public/roms/manifest.json 清单（进入模块时按需拉取），
//    ROM 二进制仅在用户选中某个游戏时才按需 fetch，并缓存进 IndexedDB。
// ============================================================================

// JSNES 3.0 实际实现的 Mapper（与 vendor 核心保持一致）
export const SUPPORTED_MAPPERS = {
  0: "NROM", 1: "MMC1", 2: "UNROM", 3: "CNROM", 4: "MMC3", 5: "MMC5",
  7: "AxROM", 9: "MMC2", 11: "ColorDreams", 34: "BNROM", 38: "PCI556",
  66: "GxROM", 71: "Camerica", 79: "AVE", 94: "UN1ROM", 118: "TxSROM",
  119: "TQROM", 140: "Jaleco JF-11/14", 180: "Crazy Climber", 240: "C&E",
  241: "BxROM",
};

const RAM_SHIFT = (v) => (v === 0 ? 0 : 64 << v); // NES 2.0 RAM 大小编码

/**
 * 解析 16 字节 iNES / NES 2.0 头部。
 * @param {Uint8Array} b ROM 完整字节
 * @returns 头部信息对象；非法 ROM 返回 { valid:false, error }
 */
export function parseHeader(b) {
  if (!b || b.length < 16 || b[0] !== 0x4e || b[1] !== 0x45 || b[2] !== 0x53 || b[3] !== 0x1a) {
    return { valid: false, error: "不是有效的 NES ROM（缺少 NES\\x1a 魔数）" };
  }
  const h = b.subarray(0, 16);
  const nes2 = (h[7] & 0x0c) === 0x08;
  const trainer = !!(h[6] & 4);
  const battery = !!(h[6] & 2);
  const fourScreen = !!(h[6] & 8);
  const mirroring = fourScreen ? "四屏" : h[6] & 1 ? "垂直" : "水平";

  let mapper, submapper = 0, prgSize, chrSize, prgRam = 0, nvRam = 0, chrRam = 0, timing = 0, consoleType = 0;

  if (nes2) {
    mapper = (h[6] >> 4) | (h[7] & 0xf0) | ((h[8] & 0x0f) << 8);
    submapper = (h[8] >> 4) & 0x0f;
    const prgMsb = h[9] & 0x0f;
    prgSize = prgMsb === 0x0f
      ? Math.pow(2, (h[4] >> 2) & 0x3f) * ((h[4] & 3) * 2 + 1)
      : ((prgMsb << 8) | h[4]) * 16384;
    const chrMsb = (h[9] >> 4) & 0x0f;
    chrSize = chrMsb === 0x0f
      ? Math.pow(2, (h[5] >> 2) & 0x3f) * ((h[5] & 3) * 2 + 1)
      : ((chrMsb << 8) | h[5]) * 8192;
    prgRam = RAM_SHIFT(h[10] & 0x0f);
    nvRam = RAM_SHIFT((h[10] >> 4) & 0x0f);
    chrRam = RAM_SHIFT(h[11] & 0x0f);
    timing = h[12] & 3;
    consoleType = h[7] & 3;
  } else {
    mapper = (h[6] >> 4) | (h[7] & 0xf0);
    // 旧 dumps 可能在 8-15 字节写入 "DiskDude!" 等垃圾数据，此时忽略高 4 位
    let dirty = false;
    for (let i = 8; i < 16; i++) if (h[i] !== 0) { dirty = true; break; }
    if (dirty) mapper &= 0x0f;
    prgSize = h[4] * 16384;
    chrSize = h[5] * 8192;
    if (battery) nvRam = 8192; // iNES 1.0 惯例：电池 SRAM 8KB
  }

  const region = ["NTSC", "PAL", "多区域", "Dendy"][timing];
  const expected = 16 + (trainer ? 512 : 0) + prgSize + chrSize;
  return {
    valid: true, nes2, mapper, submapper, prgSize, chrSize, prgRam, nvRam, chrRam,
    mirroring, battery, trainer, region, consoleType,
    supported: mapper in SUPPORTED_MAPPERS,
    mapperName: SUPPORTED_MAPPERS[mapper] || `未知 Mapper ${mapper}`,
    sizeMismatch: b.length < expected,
    headerBytes: Array.from(h),
  };
}

// CRC32（IEEE），用于生成 ROM 指纹（存档 / SRAM / 金手指均按指纹关联）
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ROM 指纹：对 PRG+CHR 数据（跳过头部与 trainer）做 CRC32 */
export function romFingerprint(bytes, header) {
  const start = 16 + (header.trainer ? 512 : 0);
  return crc32(bytes.subarray(start)).toString(16).padStart(8, "0") + "-" + bytes.length;
}

/** 站点部署基路径（Vite base，如 "/home-page/"），末尾保证带斜杠 */
const BASE = (import.meta.env?.BASE_URL || "/").replace(/\/$/, "") + "/";

/**
 * 懒加载 ROM 清单。
 * 读取 <BASE>roms/manifest.json；文件不存在或解析失败时优雅降级为空列表。
 * 每项补全可下载的绝对 url（指向 <BASE>roms/<file>），供按需 fetch。
 */
export async function loadRomManifest() {
  try {
    const r = await fetch(`${BASE}roms/manifest.json`, { cache: "no-store" });
    if (!r.ok) return [];
    const j = await r.json();
    const roms = Array.isArray(j?.roms) ? j.roms : [];
    return roms
      .filter((x) => x && x.file)
      .map((x) => ({
        name: x.name || String(x.file).replace(/\.nes$/i, ""),
        file: x.file,
        size: x.size || 0,
        url: /^https?:/i.test(x.url || "")
          ? x.url
          : `${BASE}roms/${encodeURIComponent(x.file)}`,
      }));
  } catch {
    return [];
  }
}

export function fmtSize(n) {
  if (!n) return "—";
  if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB";
  return Math.round(n / 1024) + " KB";
}

export function fmtTime(ts) {
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
