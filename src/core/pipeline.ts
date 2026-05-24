// ============================================================
// Tower Defender — System Pipeline (v4.0)
//
// 系统注册顺序基于拓扑排序：
//   1. PHASE_MANAGERS   — 经济管理器、波次系统、天气调度
//   2. PHASE_VFX        — 死亡动画、爆炸计时、弹道生命周期
//   3. PHASE_MODIFIERS  — Buff更新/过期/移除
//   4. PHASE_GAMEPLAY   — 移动、攻击、弹道、技能、陷阱
//   5. PHASE_LIFECYCLE  — 生命周期事件分发、死亡检测
//   6. PHASE_CREATION   — 建造/部署、实体新建
//   7. PHASE_AI         — 士兵状态机(重构为 SoldierAISystem)
//   8. PHASE_RENDER     — RenderSystem + UISystem（始终最后）
// ============================================================

import type { System } from './World.js';

/**
 * Phase 1 — 独立管理器（无 entity 依赖）
 */
export const PHASE_MANAGERS: System[] = [
  // WaveSystem      — 波次控制、敌人产出、波间/关间过渡
  // EconomySystem   — 金币计算（纯金币，去掉能量E）
  // WeatherSystem   — 天气调度、粒子管理（仅视觉，不影响数值）
];

/**
 * Phase 2 — 视觉效果/临时系统（仅读/写自身计时器）
 * 包含弹道生命周期、死亡特效、爆炸特效、激光束、闪电、屏幕震动等
 */
export const PHASE_VFX: System[] = [
  // DeathEffectSystem     — 死亡特效计时 → 到期销毁
  // ExplosionEffectSystem — 爆炸特效计时 → 到期销毁
  // LaserBeamSystem       — 激光束计时 → 持续伤害 → 到期销毁
  // LightningBoltSystem   — 闪电特效计时 → 到期销毁
  // BloodParticleSystem   — 血液粒子 → 到期销毁
  // FadingMarkSystem      — 渐消地面标记 → 到期销毁
  // ScreenShakeSystem     — 屏幕震动衰减
  // TileDamageSystem      — 地格破损标记
  // MissileTargeting      — 导弹塔目标标记更新
  // ProjectileSystem      — 弹道飞行、碰撞检测
];

/**
 * Phase 3 — Buff & 状态修改
 */
export const PHASE_MODIFIERS: System[] = [
  // BuffSystem    — Buff计时、层叠、过期、移除
];

/**
 * Phase 4 — 核心游戏逻辑
 */
export const PHASE_GAMEPLAY: System[] = [
  // MovementSystem      — 敌人沿路径移动、士兵巡逻
  // UnitSystem          — 玩家单位移动和目标选择（将重构为 SoldierAISystem）
  // AttackSystem        — 目标选择、攻击判定、伤害结算
  // BatSwarmSystem      — 蝙蝠群 AI 和攻击
  // TrapSystem          — 机关触发逻辑
  // SkillSystem         — 技能卡释放逻辑
  // ProductionSystem    — 召唤物管理（蝙蝠塔等）
];

/**
 * Phase 5 — 实体生命周期
 */
export const PHASE_LIFECYCLE: System[] = [
  // LifecycleSystem  — 规则引擎生命周期事件分发 (onDeath → 爆炸等)
  // HealthSystem     — HP归零检测、死亡触发
];

/**
 * Phase 6 — 实体创建
 */
export const PHASE_CREATION: System[] = [
  // BuildSystem — 拖卡部署、建造校验、单位生成
];

/**
 * Phase 7 — AI（重构后为士兵状态机 + 敌人特殊AI）
 */
export const PHASE_AI: System[] = [
  // SoldierAISystem — 士兵四状态机（Idle/Combat/Returning/Healing）
];

/**
 * Phase 8 — 渲染（始终最后，读取所有组件的最新状态）
 */
export const PHASE_RENDER: System[] = [
  // DecorationSystem     — 背景 + 装饰物渲染
  // ScreenFXSystem       — 全屏环境特效（雾气、光线等）
  // ScreenShakeSystem    — 屏幕震动偏移
  // RenderSystem         — ECS实体→PixiJS同步
  // UnitAnimationSystem  — 单位动画更新
  // UISystem             — HUD + 手牌区 + 面板
];

/**
 * 获取完整管线（按执行顺序排列）
 */
export function getPipeline(): System[] {
  return [
    ...PHASE_MANAGERS,
    ...PHASE_VFX,
    ...PHASE_MODIFIERS,
    ...PHASE_GAMEPLAY,
    ...PHASE_LIFECYCLE,
    ...PHASE_CREATION,
    ...PHASE_AI,
    ...PHASE_RENDER,
  ];
}

/**
 * Post-render hook（在 endFrame() 之后）
 * LightningBoltSystem 在 Canvas 缓冲渲染完成后绘制
 */
export const POST_RENDER_SYSTEMS: string[] = [
  // 'LightningBoltSystem.renderBolts()',
  // 'LaserBeamSystem.renderBeams()',
];
