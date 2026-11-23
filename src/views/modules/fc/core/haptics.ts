// @ts-nocheck
// ============================================================================
// 震动（Rumble）模块
// 重要事实：NES 原机与 ROM 中不存在任何震动信号 —— 震动完全由前端事件模拟触发。
// 实现：Gamepad API 的 vibrationActuator.playEffect('dual-rumble', {...})
// 兼容策略：
//  - 逐设备能力探测（不同手柄 / 浏览器差异大），不支持时静默禁用并标注
//  - 需要安全上下文（HTTPS 或 localhost）；部分浏览器要求用户手势后才能震动
//  - 移动端降级：navigator.vibrate（若可用）
// ============================================================================

// 各触发事件的震动特征（相对时长倍率 / 强度倍率）
const TRIGGER_PROFILES = {
  save:  { dur: 1.0, strong: 0.5, weak: 0.9 },  // 存档成功：轻快双脉冲
  load:  { dur: 1.0, strong: 0.7, weak: 0.5 },  // 读档成功
  reset: { dur: 1.6, strong: 1.0, weak: 0.6 },  // 重置：较强
  start: { dur: 0.6, strong: 0.4, weak: 0.7 },  // 开始游戏：短促
  test:  { dur: 2.0, strong: 1.0, weak: 1.0 },  // 测试按钮
};

export class Haptics {
  /** @param {object} settings 含 haptics 子配置（可变引用） */
  constructor(settings) {
    this.settings = settings;
    this.supportedPads = new Map(); // gamepad.index → boolean
    this.lastError = "";
  }

  /** 探测某个手柄的震动能力（只读探测，不实际震动） */
  probe(gp) {
    if (!gp) return false;
    const act = gp.vibrationActuator || (gp.hapticActuators && gp.hapticActuators[0]);
    if (!act || typeof act.playEffect !== "function") return false;
    // effects 属性为实验性（Chrome 126+），存在时优先检查
    if (Array.isArray(act.effects) && act.effects.length && !act.effects.includes("dual-rumble")) return false;
    return true;
  }

  get anySupported() {
    for (const v of this.supportedPads.values()) if (v) return true;
    return false;
  }

  /**
   * 触发一次震动。kind ∈ save/load/reset/start/test
   * 不支持时静默返回 false（UI 已提前标注能力状态）。
   */
  pulse(kind) {
    const cfg = this.settings.haptics;
    if (!cfg.enabled) return false;
    if (kind !== "test" && cfg.triggers[kind] === false) return false;
    const profile = TRIGGER_PROFILES[kind] || TRIGGER_PROFILES.test;
    const duration = Math.min(5000, Math.round(cfg.duration * profile.dur));
    const strong = Math.min(1, cfg.intensity * profile.strong);
    const weak = Math.min(1, cfg.intensity * profile.weak);

    let fired = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const ok = this.probe(gp);
      this.supportedPads.set(gp.index, ok);
      if (!ok) continue;
      const act = gp.vibrationActuator || gp.hapticActuators[0];
      try {
        // playEffect 返回 Promise；部分实现会 reject（如设备被占用），静默处理
        const p = act.playEffect("dual-rumble", {
          startDelay: 0,
          duration,
          strongMagnitude: strong,
          weakMagnitude: weak,
        });
        if (p && p.catch) p.catch(() => {});
        fired = true;
      } catch (e) {
        this.lastError = String((e && e.message) || e);
        this.supportedPads.set(gp.index, false);
      }
    }
    // 移动端降级：手机振动马达（同样受用户手势 / 权限限制）
    if (!fired && navigator.vibrate && kind !== "test") {
      try { navigator.vibrate(duration); fired = true; } catch {}
    }
    return fired;
  }

  /** 停止所有手柄震动 */
  stop() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const act = gp.vibrationActuator || (gp.hapticActuators && gp.hapticActuators[0]);
      try { act && act.reset && act.reset(); } catch {}
    }
  }
}
