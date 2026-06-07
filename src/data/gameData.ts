import {
  TileType,
  TowerType,
  EnemyType,
  UnitType,
  ProductionType,
  SkillTrigger,
  type TowerConfig,
  type EnemyConfig,
  type UnitConfig,
  type ProductionConfig,
  type SkillConfig,
  type TrapConfig,
  type MapConfig,
  type WaveConfig,
  type GridPos,
  type UpgradeVisualRegistry,
  type UnitVisualParts,
} from '../types/index.js';
import { migrateEnemyPathToGraph } from '../level/graph/migration.js';

// ============================================================
// TOWER_BASE_VISUAL_PARTS — 塔的基础复合几何外观
// 每种塔由 3-6 个 CompositePart 构成独特剪影，实现"简约不简单"
// ============================================================

export const TOWER_BASE_VISUAL_PARTS: Record<TowerType, UnitVisualParts> = {
  // ── 箭塔：弓臂+弓弦+箭头 ──
  [TowerType.Arrow]: {
    bobStyle: 'static',
    bodyParts: [
      { shape: 'rect', offsetX: -10, offsetY: -4, size: 16, h: 3, color: '#0288d1', alpha: 0.9, rotation: -0.55 },
      { shape: 'rect', offsetX: 10, offsetY: -4, size: 16, h: 3, color: '#0288d1', alpha: 0.9, rotation: 0.55 },
      { shape: 'rect', offsetX: 0, offsetY: 0, size: 16, h: 1, color: '#b0bec5', alpha: 0.7 },
      { shape: 'triangle', offsetX: 0, offsetY: -15, size: 8, color: '#ffffff', alpha: 0.9 },
    ],
  },
  // ── 弩塔：横弩臂+弩弦+弩头 ──
  [TowerType.Ballista]: {
    bobStyle: 'static',
    bodyParts: [
      { shape: 'rect', offsetX: 0, offsetY: -2, size: 30, h: 5, color: '#455a64', alpha: 1, stroke: '#546e7a', strokeWidth: 1 },
      { shape: 'rect', offsetX: 0, offsetY: -8, size: 12, h: 1, color: '#cfd8dc', alpha: 0.8 },
      { shape: 'triangle', offsetX: 18, offsetY: -2, size: 10, color: '#37474f', alpha: 0.9 },
      { shape: 'rect', offsetX: -14, offsetY: 2, size: 6, h: 10, color: '#546e7a', alpha: 0.8 },
      { shape: 'rect', offsetX: 14, offsetY: 2, size: 6, h: 10, color: '#546e7a', alpha: 0.8 },
    ],
  },
  // ── 炮塔：炮管+炮口+轮子 ──
  [TowerType.Cannon]: {
    bobStyle: 'static',
    bodyParts: [
      { shape: 'rect', offsetX: 0, offsetY: -4, size: 14, h: 10, color: '#4e342e', alpha: 1, rotation: Math.PI / 2 },
      { shape: 'circle', offsetX: 0, offsetY: -14, size: 8, color: '#3e2723', alpha: 1 },
      { shape: 'circle', offsetX: 0, offsetY: -14, size: 4, color: '#1b0000', alpha: 0.9 },
      { shape: 'circle', offsetX: -10, offsetY: 10, size: 8, color: '#37474f', alpha: 0.9 },
      { shape: 'circle', offsetX: 10, offsetY: 10, size: 8, color: '#37474f', alpha: 0.9 },
    ],
  },
  // ── 激光塔：晶体+聚焦镜 ──
  [TowerType.Laser]: {
    bobStyle: 'static',
    bodyParts: [
      { shape: 'diamond', offsetX: 0, offsetY: -2, size: 14, color: '#00b8d4', alpha: 0.8 },
      { shape: 'triangle', offsetX: 0, offsetY: -16, size: 8, color: '#e0f7fa', alpha: 0.9 },
      { shape: 'rect', offsetX: -10, offsetY: 0, size: 5, h: 10, color: '#006064', alpha: 0.7 },
      { shape: 'rect', offsetX: 10, offsetY: 0, size: 5, h: 10, color: '#006064', alpha: 0.7 },
      { shape: 'circle', offsetX: 0, offsetY: -2, size: 4, color: '#ffffff', alpha: 0.7 },
    ],
  },
  // ── 蝙蝠塔：双翼+尖顶+核心眼 ──
  [TowerType.Bat]: {
    bobStyle: 'static',
    bodyParts: [
      { shape: 'triangle', offsetX: -8, offsetY: -4, size: 16, color: '#311b92', alpha: 0.85, rotation: -0.25 },
      { shape: 'triangle', offsetX: 8, offsetY: -4, size: 16, color: '#311b92', alpha: 0.85, rotation: 0.25 },
      { shape: 'triangle', offsetX: 0, offsetY: -16, size: 8, color: '#1a237e', alpha: 0.9 },
      { shape: 'circle', offsetX: 0, offsetY: 2, size: 7, color: '#ff1744', alpha: 0.7 },
      { shape: 'circle', offsetX: 0, offsetY: 2, size: 3, color: '#ffffff', alpha: 0.5 },
    ],
  },
  // ── 导弹塔：发射管+雷达 ──
  [TowerType.Missile]: {
    bobStyle: 'static',
    bodyParts: [
      { shape: 'rect', offsetX: -6, offsetY: 0, size: 14, h: 4, color: '#b71c1c', alpha: 1, rotation: -0.7 },
      { shape: 'rect', offsetX: 6, offsetY: 0, size: 14, h: 4, color: '#b71c1c', alpha: 1, rotation: 0.7 },
      { shape: 'rect', offsetX: 0, offsetY: -12, size: 10, h: 3, color: '#757575', alpha: 0.9 },
      { shape: 'circle', offsetX: 0, offsetY: -18, size: 4, color: '#ffeb3b', alpha: 0.9 },
      { shape: 'triangle', offsetX: 0, offsetY: -8, size: 8, color: '#ff1744', alpha: 0.8 },
    ],
  },
  // ── 冰塔：冰晶+雾环 ──
  [TowerType.Ice]: {
    bobStyle: 'static',
    bodyParts: [
      { shape: 'diamond', offsetX: 0, offsetY: -2, size: 14, color: '#e1f5fe', alpha: 0.8 },
      { shape: 'triangle', offsetX: -6, offsetY: 6, size: 6, color: '#b3e5fc', alpha: 0.7, rotation: Math.PI },
      { shape: 'triangle', offsetX: 6, offsetY: 6, size: 6, color: '#b3e5fc', alpha: 0.7, rotation: Math.PI },
      { shape: 'circle', offsetX: 0, offsetY: 2, size: 5, color: '#0277bd', alpha: 0.6 },
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 30, color: '#81d4fa', alpha: 0.15, stroke: '#81d4fa', strokeWidth: 1 },
    ],
  },
  // ── 火塔：火焰+火星 ──
  [TowerType.Fire]: {
    bobStyle: 'static',
    bodyParts: [
      { shape: 'triangle', offsetX: 0, offsetY: -6, size: 14, color: '#ff9800', alpha: 0.9 },
      { shape: 'triangle', offsetX: 0, offsetY: -14, size: 10, color: '#ff5722', alpha: 0.85 },
      { shape: 'triangle', offsetX: 0, offsetY: -20, size: 6, color: '#ffcc80', alpha: 0.7 },
      { shape: 'circle', offsetX: -4, offsetY: -2, size: 3, color: '#ff9800', alpha: 0.6 },
      { shape: 'circle', offsetX: 4, offsetY: -8, size: 2, color: '#ff5722', alpha: 0.5 },
    ],
  },
  // ── 毒塔：毒囊+毒腺+毒液 ──
  [TowerType.Poison]: {
    bobStyle: 'static',
    bodyParts: [
      { shape: 'circle', offsetX: 0, offsetY: -8, size: 10, color: '#388e3c', alpha: 0.8 },
      { shape: 'circle', offsetX: -6, offsetY: -12, size: 7, color: '#2e7d32', alpha: 0.8 },
      { shape: 'circle', offsetX: 6, offsetY: -12, size: 7, color: '#2e7d32', alpha: 0.8 },
      { shape: 'triangle', offsetX: 0, offsetY: 8, size: 5, color: '#33691e', alpha: 0.7 },
      { shape: 'circle', offsetX: 2, offsetY: -4, size: 3, color: '#a5d6a7', alpha: 0.6 },
    ],
  },
  // ── 电塔：天线+线圈+电弧 ──
  [TowerType.Lightning]: {
    bobStyle: 'static',
    bodyParts: [
      { shape: 'rect', offsetX: 0, offsetY: -6, size: 12, h: 3, color: '#f57f17', alpha: 0.8 },
      { shape: 'circle', offsetX: 0, offsetY: -18, size: 10, color: '#ffd600', alpha: 0.8 },
      { shape: 'circle', offsetX: 0, offsetY: -18, size: 5, color: '#ffffff', alpha: 0.5 },
      { shape: 'triangle', offsetX: -10, offsetY: -2, size: 8, color: '#ffd600', alpha: 0.7, rotation: -0.3 },
      { shape: 'triangle', offsetX: 10, offsetY: -2, size: 8, color: '#ffd600', alpha: 0.7, rotation: 0.3 },
    ],
  },
};

// ============================================================
// TOWER_CONFIGS — v4.0 塔配置（per design/03-units.md §2）
// ============================================================
// 升级数量变更摘要（v3.1 → v4.0）：
//   Arrow: 4 → 2, Ballista: 4 → 2, Cannon: 4 → 2, Laser: 4 → 1,
//   Bat: 4 → 2, Missile: 4 → 2, Ice: 4 → 2, Fire: 4 → 1,
//   Poison: 4 → 1, Lightning: 4 → 3（唯一有 L4 的塔）

export const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  // ---- 2.1 箭塔 ----
  [TowerType.Arrow]: {
    type: TowerType.Arrow,
    name: '箭塔',
    cost: 50,
    hp: 150,
    atk: 15,
    attackSpeed: 1.5,
    range: 180,
    damageType: 'physical',
    // L2: 同时射 2 箭（可锁不同目标）; L3: 3 箭 + 射程 200
    upgradeCosts: [80, 150],
    upgradeAtkBonus: [0, 0],
    upgradeRangeBonus: [0, 20],
    projectileCount: [1, 2, 3],
    color: '#4fc3f7',
    buildTime: 1.5,
    visualParts: TOWER_BASE_VISUAL_PARTS[TowerType.Arrow],
  },

  // ---- 2.2 弩塔 ----
  [TowerType.Ballista]: {
    type: TowerType.Ballista,
    name: '弩塔',
    cost: 100,
    hp: 120,
    atk: 45,
    attackSpeed: 0.8,
    range: 220,
    damageType: 'physical',
    pierceCount: 99, // 穿透：箭矢直线飞行，伤害路径上所有敌人
    // L2: ATK=65; L3: ATK=65 + AS=1.2 + range=240
    upgradeCosts: [100, 180],
    upgradeAtkBonus: [20, 0],
    upgradeRangeBonus: [0, 20],
    color: '#8d6e63',
    buildTime: 2.0,
    visualParts: TOWER_BASE_VISUAL_PARTS[TowerType.Ballista],
  },

  // ---- 2.3 炮塔 ----
  [TowerType.Cannon]: {
    type: TowerType.Cannon,
    name: '炮塔',
    cost: 85,
    hp: 120,
    atk: 30,
    attackSpeed: 1.0,
    range: 160,
    damageType: 'physical',
    splashRadius: 60,
    // L2: ATK=40 + 30% 概率眩晕 1s; L3: ATK=50 + splash=80 + 眩晕 + 击退
    upgradeCosts: [120, 200],
    upgradeAtkBonus: [10, 10],
    upgradeRangeBonus: [0, 20],
    color: '#ff8a65',
    buildTime: 2.0,
    visualParts: TOWER_BASE_VISUAL_PARTS[TowerType.Cannon],
  },

  // ---- 2.4 激光塔 ----
  [TowerType.Laser]: {
    type: TowerType.Laser,
    name: '激光塔',
    cost: 90,
    hp: 80,
    atk: 8,
    attackSpeed: 0.5, // CD = 2s；激光束持续 5s，伤害 S 形递增（拐点 2.5s），上限 = 箭塔 atk × 3 = 45
    range: 200,
    damageType: 'magic',
    // 激光束伤害随照射时间 S 形递增，上限为箭塔 atk × 3 = 45
    upgradeCosts: [150],
    upgradeAtkBonus: [0],
    upgradeRangeBonus: [0],
    color: '#e040fb',
    buildTime: 2.0,
    visualParts: TOWER_BASE_VISUAL_PARTS[TowerType.Laser],
  },

  // ---- 2.5 蝙蝠塔 ----
  [TowerType.Bat]: {
    type: TowerType.Bat,
    name: '蝙蝠塔',
    cost: 85,
    hp: 90,
    atk: 10,
    attackSpeed: 1.0,
    range: 200,
    damageType: 'physical',
    batCount: 3,
    batReplenishCD: 8,
    batHP: 30,
    batDamage: 10,
    batAttackRange: 80,
    batAttackSpeed: 1.0,
    batSpeed: 60,
    // L2: 4 bats + ATK=14 + CD=7s; L3: 5 bats + ATK=18 + CD=6s
    upgradeCosts: [100, 150],
    upgradeAtkBonus: [0, 0],
    upgradeRangeBonus: [0, 0],
    color: '#7c4dff',
    buildTime: 2.0,
    visualParts: TOWER_BASE_VISUAL_PARTS[TowerType.Bat],
  },

  // ---- 2.6 导弹塔 ----
  [TowerType.Missile]: {
    type: TowerType.Missile,
    name: '导弹塔',
    cost: 220,
    hp: 150,
    atk: 80,
    attackSpeed: 0.3,
    range: 672, // 半棋盘射程
    damageType: 'physical',
    splashRadius: 80,
    cantTargetFlying: true,
    // L2: 2 missiles × 60 dmg; L3: 3 missiles × 45 dmg
    upgradeCosts: [200, 300],
    upgradeAtkBonus: [0, 0],
    upgradeRangeBonus: [0, 0],
    projectileCount: [1, 2, 3],
    color: '#ff1744',
    buildTime: 3.0,
    visualParts: TOWER_BASE_VISUAL_PARTS[TowerType.Missile],
  },

  // ---- 2.7 冰塔 ----
  [TowerType.Ice]: {
    type: TowerType.Ice,
    name: '冰塔',
    cost: 60,
    hp: 100,
    atk: 10,
    attackSpeed: 1.5,
    range: 160,
    damageType: 'magic',
    slowPercent: 30,
    slowMaxStacks: 1,
    // L2: ATK=15 + 30% 冰冻 1s; L3: ATK=20 + 40% 冰冻 + ATK-20%/3s
    upgradeCosts: [120, 180],
    upgradeAtkBonus: [5, 5],
    upgradeRangeBonus: [0, 20],
    color: '#81d4fa',
    buildTime: 1.5,
    visualParts: TOWER_BASE_VISUAL_PARTS[TowerType.Ice],
  },

  // ---- 2.8 火塔 ----
  [TowerType.Fire]: {
    type: TowerType.Fire,
    name: '火塔',
    cost: 75,
    hp: 100,
    atk: 12,
    attackSpeed: 1.2,
    range: 150,
    damageType: 'magic',
    dotDamage: 5,
    dotDuration: 3,
    // L2: ATK=18 + DOT=8/s×3s + 5% 直接击杀（非 BOSS）
    upgradeCosts: [150],
    upgradeAtkBonus: [6],
    upgradeRangeBonus: [0],
    color: '#ff5722',
    buildTime: 2.0,
    visualParts: TOWER_BASE_VISUAL_PARTS[TowerType.Fire],
  },

  // ---- 2.9 毒塔 ----
  [TowerType.Poison]: {
    type: TowerType.Poison,
    name: '毒塔',
    cost: 70,
    hp: 90,
    atk: 10,
    attackSpeed: 1.0,
    range: 150,
    damageType: 'magic',
    dotDamage: 4,
    dotDuration: 5,
    // L2: ATK=15 + DOT=6/s×5s + 传染（3 hops, 80px, half damage）
    upgradeCosts: [150],
    upgradeAtkBonus: [5],
    upgradeRangeBonus: [0],
    color: '#66bb6a',
    buildTime: 1.5,
    visualParts: TOWER_BASE_VISUAL_PARTS[TowerType.Poison],
  },

  // ---- 2.10 电塔 ----
  [TowerType.Lightning]: {
    type: TowerType.Lightning,
    name: '电塔',
    cost: 80,
    hp: 100,
    atk: 20,
    attackSpeed: 1.5,
    range: 160,
    damageType: 'magic',
    chainCount: 1,
    chainDecay: 0.2,
    // L2: ATK=25, chain=2; L3: ATK=30, range=180, chain=3;
    // L4: 弹跳 + 10% 全屏闪电（1.5x, CD≥10s）
    upgradeCosts: [100, 160, 220],
    upgradeAtkBonus: [5, 5, 0],
    upgradeRangeBonus: [0, 20, 0],
    color: '#fff176',
    buildTime: 2.0,
    visualParts: TOWER_BASE_VISUAL_PARTS[TowerType.Lightning],
  },
};

// ---- Upgrade Visual Configs ----

export const UPGRADE_VISUALS: UpgradeVisualRegistry = {
  arrow_tower: [
    // L1: base form
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    // L2: slightly larger, 1 diamond
    { level: 2, scaleMultiplier: 1.08, extraParts: [] },
    // L3: larger, glow, passive visual
    { level: 3, scaleMultiplier: 1.17, extraParts: [
      { shape: 'triangle', offsetX: -7, offsetY: -25, size: 6, color: '#8d6e63', alpha: 0.7 },
      { shape: 'triangle', offsetX: 7, offsetY: -25, size: 6, color: '#8d6e63', alpha: 0.7 },
    ], glow: { radius: 24, color: '#4fc3f7', alpha: 0.15 }, passiveVisual: { type: 'crit_flash', description: '15% crit — golden flash on arrow tip' } },
    // L4
    { level: 4, scaleMultiplier: 1.25, extraParts: [
      { shape: 'triangle', offsetX: -8, offsetY: -28, size: 8, color: '#8d6e63', alpha: 0.8 },
      { shape: 'triangle', offsetX: 8, offsetY: -28, size: 8, color: '#8d6e63', alpha: 0.8 },
      { shape: 'circle', offsetX: -6, offsetY: -5, size: 3, color: '#ffd700', alpha: 0.8 },
      { shape: 'circle', offsetX: 6, offsetY: -5, size: 3, color: '#ffd700', alpha: 0.8 },
    ], glow: { radius: 28, color: '#4fc3f7', alpha: 0.25 } },
    // L5: final form
    { level: 5, scaleMultiplier: 1.36, extraParts: [
      { shape: 'triangle', offsetX: 0, offsetY: -30, size: 20, color: '#4fc3f7', alpha: 1 },
      { shape: 'triangle', offsetX: -9, offsetY: -24, size: 14, color: '#4fc3f7', alpha: 0.85 },
      { shape: 'triangle', offsetX: 9, offsetY: -24, size: 14, color: '#4fc3f7', alpha: 0.85 },
      { shape: 'triangle', offsetX: -10, offsetY: -30, size: 10, color: '#ffd700', alpha: 0.8 },
      { shape: 'triangle', offsetX: 10, offsetY: -30, size: 10, color: '#ffd700', alpha: 0.8 },
      { shape: 'circle', offsetX: 0, offsetY: -35, size: 6, color: '#ffffff', alpha: 0.8 },
    ], glow: { radius: 36, color: '#4fc3f7', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  cannon_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.08, extraParts: [] },
    { level: 3, scaleMultiplier: 1.16, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: -2, size: 22, color: '#616161', alpha: 0.6, stroke: '#616161', strokeWidth: 2 },
    ], glow: { radius: 24, color: '#ff8a65', alpha: 0.15 }, passiveVisual: { type: 'aoe_ring', description: 'AOE +30%, splash 80%' } },
    { level: 4, scaleMultiplier: 1.24, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: -2, size: 26, color: '#616161', alpha: 0.7, stroke: '#616161', strokeWidth: 2 },
      { shape: 'circle', offsetX: -8, offsetY: 8, size: 4, color: '#9e9e9e', alpha: 0.8 },
      { shape: 'circle', offsetX: 8, offsetY: 8, size: 4, color: '#9e9e9e', alpha: 0.8 },
      { shape: 'circle', offsetX: -8, offsetY: -8, size: 4, color: '#9e9e9e', alpha: 0.8 },
      { shape: 'circle', offsetX: 8, offsetY: -8, size: 4, color: '#9e9e9e', alpha: 0.8 },
    ], glow: { radius: 30, color: '#ff8a65', alpha: 0.25 } },
    { level: 5, scaleMultiplier: 1.34, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: -3, size: 30, color: '#ffd700', alpha: 0.7, stroke: '#ffd700', strokeWidth: 2 },
      { shape: 'circle', offsetX: 0, offsetY: 12, size: 10, color: '#37474f', alpha: 1 },
      { shape: 'circle', offsetX: -10, offsetY: 5, size: 10, color: '#455a64', alpha: 0.8 },
      { shape: 'circle', offsetX: 10, offsetY: 5, size: 10, color: '#455a64', alpha: 0.8 },
      { shape: 'triangle', offsetX: 0, offsetY: 20, size: 8, color: '#ff6e40', alpha: 0.6 },
    ], glow: { radius: 45, color: '#ff8a65', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  ice_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.09, extraParts: [] },
    { level: 3, scaleMultiplier: 1.18, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 40, color: '#b2ebf2', alpha: 0.3, stroke: '#b2ebf2', strokeWidth: 1 },
    ], glow: { radius: 24, color: '#81d4fa', alpha: 0.15 }, passiveVisual: { type: 'shatter_effect', description: 'freeze ends in 30 dmg AOE' } },
    { level: 4, scaleMultiplier: 1.26, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 46, color: '#b2ebf2', alpha: 0.35, stroke: '#b2ebf2', strokeWidth: 1.5 },
      { shape: 'triangle', offsetX: 0, offsetY: -24, size: 8, color: '#b2ebf2', alpha: 0.7 },
      { shape: 'triangle', offsetX: 21, offsetY: -12, size: 8, color: '#b2ebf2', alpha: 0.7, rotation: Math.PI / 3 },
      { shape: 'triangle', offsetX: 21, offsetY: 12, size: 8, color: '#b2ebf2', alpha: 0.7, rotation: Math.PI * 2/3 },
      { shape: 'triangle', offsetX: 0, offsetY: 24, size: 8, color: '#b2ebf2', alpha: 0.7, rotation: Math.PI },
      { shape: 'triangle', offsetX: -21, offsetY: 12, size: 8, color: '#b2ebf2', alpha: 0.7, rotation: Math.PI * 4/3 },
      { shape: 'triangle', offsetX: -21, offsetY: -12, size: 8, color: '#b2ebf2', alpha: 0.7, rotation: Math.PI * 5/3 },
    ], glow: { radius: 30, color: '#81d4fa', alpha: 0.25 } },
    { level: 5, scaleMultiplier: 1.38, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 52, color: '#e0f7fa', alpha: 0.4, stroke: '#e0f7fa', strokeWidth: 2 },
      { shape: 'diamond', offsetX: 0, offsetY: 0, size: 20, color: '#ffffff', alpha: 0.5 },
    ], glow: { radius: 48, color: '#81d4fa', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  lightning_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.09, extraParts: [] },
    { level: 3, scaleMultiplier: 1.18, extraParts: [
      { shape: 'triangle', offsetX: -10, offsetY: -18, size: 10, color: '#ffb300', alpha: 0.9 },
    ], glow: { radius: 22, color: '#fff176', alpha: 0.15 }, passiveVisual: { type: 'arc_upgrade', description: 'bounces +2, decay down to 15%' } },
    { level: 4, scaleMultiplier: 1.26, extraParts: [
      { shape: 'triangle', offsetX: -12, offsetY: -20, size: 11, color: '#ffb300', alpha: 0.9 },
      { shape: 'triangle', offsetX: 12, offsetY: -20, size: 11, color: '#ffb300', alpha: 0.9 },
      { shape: 'circle', offsetX: -10, offsetY: 12, size: 6, color: '#ffb300', alpha: 0.6 },
      { shape: 'circle', offsetX: 10, offsetY: 12, size: 6, color: '#ffb300', alpha: 0.6 },
    ], glow: { radius: 28, color: '#fff176', alpha: 0.25 } },
    { level: 5, scaleMultiplier: 1.38, extraParts: [
      { shape: 'triangle', offsetX: 0, offsetY: -22, size: 14, color: '#ffb300', alpha: 1 },
      { shape: 'triangle', offsetX: -10, offsetY: -16, size: 11, color: '#ffb300', alpha: 0.85 },
      { shape: 'triangle', offsetX: 10, offsetY: -16, size: 11, color: '#ffb300', alpha: 0.85 },
      { shape: 'triangle', offsetX: -18, offsetY: -10, size: 10, color: '#ffb300', alpha: 0.7 },
      { shape: 'triangle', offsetX: 18, offsetY: -10, size: 10, color: '#ffb300', alpha: 0.7 },
    ], glow: { radius: 42, color: '#fff176', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  laser_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.08, extraParts: [] },
    { level: 3, scaleMultiplier: 1.17, extraParts: [
      { shape: 'diamond', offsetX: 0, offsetY: -20, size: 10, color: '#ffffff', alpha: 0.5 },
    ], glow: { radius: 22, color: '#00e5ff', alpha: 0.15 }, passiveVisual: { type: 'beam_widen', description: 'beam width 6px -> 8px' } },
    { level: 4, scaleMultiplier: 1.25, extraParts: [
      { shape: 'diamond', offsetX: 0, offsetY: -22, size: 12, color: '#ffffff', alpha: 0.6 },
      { shape: 'rect', offsetX: -8, offsetY: -5, size: 6, color: '#26c6da', alpha: 0.6 },
      { shape: 'rect', offsetX: 8, offsetY: -5, size: 6, color: '#26c6da', alpha: 0.6 },
    ], glow: { radius: 28, color: '#00e5ff', alpha: 0.25 } },
    { level: 5, scaleMultiplier: 1.36, extraParts: [
      { shape: 'diamond', offsetX: 0, offsetY: -24, size: 14, color: '#ffffff', alpha: 0.8 },
      { shape: 'rect', offsetX: -8, offsetY: -5, size: 6, color: '#18ffff', alpha: 0.7 },
      { shape: 'rect', offsetX: 8, offsetY: -5, size: 6, color: '#18ffff', alpha: 0.7 },
      { shape: 'rect', offsetX: -14, offsetY: -10, size: 6, color: '#18ffff', alpha: 0.5 },
      { shape: 'rect', offsetX: 14, offsetY: -10, size: 6, color: '#18ffff', alpha: 0.5 },
    ], glow: { radius: 48, color: '#00e5ff', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  bat_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.09, extraParts: [] },
    { level: 3, scaleMultiplier: 1.18, extraParts: [
      { shape: 'triangle', offsetX: -8, offsetY: -10, size: 14, color: '#7b1fa2', alpha: 0.8, rotation: -0.2 },
      { shape: 'triangle', offsetX: 8, offsetY: -10, size: 14, color: '#7b1fa2', alpha: 0.8, rotation: 0.2 },
      { shape: 'triangle', offsetX: 0, offsetY: -26, size: 8, color: '#311b92', alpha: 0.9 },
    ], glow: { radius: 22, color: '#7c4dff', alpha: 0.15 }, passiveVisual: { type: 'bat_plus', description: 'bat swarm +1 (4->5)' } },
    { level: 4, scaleMultiplier: 1.26, extraParts: [
      { shape: 'triangle', offsetX: -9, offsetY: -10, size: 16, color: '#7b1fa2', alpha: 0.85, rotation: -0.3 },
      { shape: 'triangle', offsetX: 9, offsetY: -10, size: 16, color: '#7b1fa2', alpha: 0.85, rotation: 0.3 },
      { shape: 'triangle', offsetX: 0, offsetY: 8, size: 14, color: '#7b1fa2', alpha: 0.7 },
      { shape: 'triangle', offsetX: 0, offsetY: -28, size: 10, color: '#311b92', alpha: 0.9 },
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 36, color: '#311b92', alpha: 0.3, stroke: '#311b92', strokeWidth: 1 },
    ], glow: { radius: 26, color: '#7c4dff', alpha: 0.25 } },
    { level: 5, scaleMultiplier: 1.38, extraParts: [
      { shape: 'triangle', offsetX: -10, offsetY: -10, size: 18, color: '#9c27b0', alpha: 0.9, rotation: -0.3 },
      { shape: 'triangle', offsetX: 10, offsetY: -10, size: 18, color: '#9c27b0', alpha: 0.9, rotation: 0.3 },
      { shape: 'triangle', offsetX: 0, offsetY: 10, size: 16, color: '#9c27b0', alpha: 0.8 },
      { shape: 'triangle', offsetX: -10, offsetY: 18, size: 14, color: '#9c27b0', alpha: 0.6, rotation: 0.5 },
      { shape: 'triangle', offsetX: 10, offsetY: 18, size: 14, color: '#9c27b0', alpha: 0.6, rotation: -0.5 },
      { shape: 'triangle', offsetX: 0, offsetY: -30, size: 12, color: '#311b92', alpha: 1 },
      { shape: 'circle', offsetX: 0, offsetY: -33, size: 8, color: '#e53935', alpha: 0.8 },
    ], glow: { radius: 40, color: '#7c4dff', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  missile_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [
      { shape: 'rect', offsetX: 0, offsetY: 4, size: 14, color: '#616161', alpha: 1 },
      { shape: 'rect', offsetX: 0, offsetY: -4, size: 8, color: '#424242', alpha: 1 },
      { shape: 'triangle', offsetX: 0, offsetY: -16, size: 10, color: '#ff1744', alpha: 1 },
      { shape: 'circle', offsetX: 0, offsetY: -24, size: 4, color: '#ff7043', alpha: 0.6 },
    ] },
    { level: 2, scaleMultiplier: 1.08, extraParts: [
      { shape: 'rect', offsetX: 0, offsetY: 4, size: 16, color: '#616161', alpha: 1 },
      { shape: 'rect', offsetX: 0, offsetY: -4, size: 9, color: '#424242', alpha: 1 },
      { shape: 'triangle', offsetX: 0, offsetY: -18, size: 12, color: '#ff1744', alpha: 1 },
      { shape: 'circle', offsetX: 0, offsetY: -26, size: 5, color: '#ff7043', alpha: 0.7 },
      { shape: 'rect', offsetX: -6, offsetY: -10, size: 4, color: '#90a4ae', alpha: 0.8 },
      { shape: 'rect', offsetX: 6, offsetY: -10, size: 4, color: '#90a4ae', alpha: 0.8 },
    ] },
    { level: 3, scaleMultiplier: 1.16, extraParts: [
      { shape: 'rect', offsetX: 0, offsetY: 5, size: 18, color: '#757575', alpha: 1 },
      { shape: 'rect', offsetX: 0, offsetY: -4, size: 10, color: '#424242', alpha: 1 },
      { shape: 'triangle', offsetX: 0, offsetY: -20, size: 14, color: '#ff1744', alpha: 1 },
      { shape: 'triangle', offsetX: -4, offsetY: -20, size: 8, color: '#d50000', alpha: 0.8 },
      { shape: 'circle', offsetX: 0, offsetY: -28, size: 8, color: '#ff7043', alpha: 0.8 },
      { shape: 'circle', offsetX: 0, offsetY: -26, size: 12, color: '#ff1744', alpha: 0.3, stroke: '#ff1744', strokeWidth: 1 },
    ], glow: { radius: 28, color: '#ff1744', alpha: 0.15 }, passiveVisual: { type: 'double_explosion', description: '二段爆炸 — 二次冲击波50%伤害' } },
    { level: 4, scaleMultiplier: 1.24, extraParts: [
      { shape: 'rect', offsetX: 0, offsetY: 6, size: 22, color: '#757575', alpha: 1 },
      { shape: 'rect', offsetX: 0, offsetY: -4, size: 12, color: '#424242', alpha: 1 },
      { shape: 'triangle', offsetX: 0, offsetY: -22, size: 18, color: '#ff1744', alpha: 1 },
      { shape: 'triangle', offsetX: -5, offsetY: -22, size: 10, color: '#d50000', alpha: 0.85 },
      { shape: 'triangle', offsetX: 5, offsetY: -22, size: 10, color: '#d50000', alpha: 0.85 },
      { shape: 'circle', offsetX: 0, offsetY: -30, size: 10, color: '#ff7043', alpha: 0.9 },
      { shape: 'circle', offsetX: -6, offsetY: -10, size: 3, color: '#ff0000', alpha: 0.6 },
      { shape: 'circle', offsetX: 6, offsetY: -10, size: 3, color: '#ff0000', alpha: 0.6 },
      { shape: 'rect', offsetX: 0, offsetY: -2, size: 16, color: '#616161', alpha: 0.6, stroke: '#90a4ae', strokeWidth: 1 },
    ], glow: { radius: 36, color: '#ff1744', alpha: 0.25, pulseAmplitude: 0.1 } },
    { level: 5, scaleMultiplier: 1.36, extraParts: [
      { shape: 'rect', offsetX: 0, offsetY: 6, size: 26, color: '#757575', alpha: 1 },
      { shape: 'rect', offsetX: 0, offsetY: -4, size: 14, color: '#424242', alpha: 1 },
      { shape: 'triangle', offsetX: 0, offsetY: -26, size: 22, color: '#ffd600', alpha: 1 },
      { shape: 'triangle', offsetX: -6, offsetY: -24, size: 12, color: '#ff1744', alpha: 0.9 },
      { shape: 'triangle', offsetX: 6, offsetY: -24, size: 12, color: '#ff1744', alpha: 0.9 },
      { shape: 'triangle', offsetX: -10, offsetY: -20, size: 10, color: '#d50000', alpha: 0.7 },
      { shape: 'triangle', offsetX: 10, offsetY: -20, size: 10, color: '#d50000', alpha: 0.7 },
      { shape: 'circle', offsetX: 0, offsetY: -34, size: 12, color: '#ff7043', alpha: 1 },
      { shape: 'rect', offsetX: 0, offsetY: -6, size: 20, color: '#616161', alpha: 0.7, stroke: '#90a4ae', strokeWidth: 2 },
      { shape: 'triangle', offsetX: -7, offsetY: 12, size: 6, color: '#9e9e9e', alpha: 0.6 },
      { shape: 'triangle', offsetX: 7, offsetY: 12, size: 6, color: '#9e9e9e', alpha: 0.6 },
    ], glow: { radius: 52, color: '#ff1744', alpha: 0.4, pulseAmplitude: 0.15 } },
  ],
  // ── 火塔（L1=L1, L2=L2）──
  fire_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.12, extraParts: [
      { shape: 'triangle', offsetX: 0, offsetY: -22, size: 7, color: '#ffcc80', alpha: 0.8 },
      { shape: 'triangle', offsetX: -3, offsetY: -16, size: 12, color: '#ff7033', alpha: 0.85 },
      { shape: 'triangle', offsetX: 3, offsetY: -16, size: 12, color: '#ff7033', alpha: 0.85 },
    ], glow: { radius: 22, color: '#ff5722', alpha: 0.15 }, passiveVisual: { type: 'crit_flash', description: '5% chance execute non-BOSS' } },
    { level: 3, scaleMultiplier: 1.25, extraParts: [
      { shape: 'triangle', offsetX: 0, offsetY: -24, size: 9, color: '#ffcc80', alpha: 0.9 },
      { shape: 'triangle', offsetX: -4, offsetY: -18, size: 14, color: '#ff5722', alpha: 0.9 },
      { shape: 'triangle', offsetX: 4, offsetY: -18, size: 14, color: '#ff5722', alpha: 0.9 },
      { shape: 'circle', offsetX: 0, offsetY: -26, size: 4, color: '#fff3e0', alpha: 0.7 },
    ], glow: { radius: 28, color: '#ff5722', alpha: 0.25 } },
  ],
  // ── 毒塔（L1=L1, L2=L2）──
  poison_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.12, extraParts: [
      { shape: 'circle', offsetX: -8, offsetY: -12, size: 8, color: '#1b5e20', alpha: 0.9 },
      { shape: 'circle', offsetX: 8, offsetY: -12, size: 8, color: '#1b5e20', alpha: 0.9 },
      { shape: 'circle', offsetX: 0, offsetY: -4, size: 5, color: '#a5d6a7', alpha: 0.5 },
    ], glow: { radius: 20, color: '#4caf50', alpha: 0.15 }, passiveVisual: { type: 'crit_flash', description: 'poison spreads to nearby enemies' } },
    { level: 3, scaleMultiplier: 1.25, extraParts: [
      { shape: 'circle', offsetX: -9, offsetY: -14, size: 9, color: '#1b5e20', alpha: 0.9 },
      { shape: 'circle', offsetX: 9, offsetY: -14, size: 9, color: '#1b5e20', alpha: 0.9 },
      { shape: 'circle', offsetX: 0, offsetY: -2, size: 6, color: '#c8e6c9', alpha: 0.6 },
      { shape: 'triangle', offsetX: 0, offsetY: 10, size: 5, color: '#2e7d32', alpha: 0.8 },
    ], glow: { radius: 24, color: '#4caf50', alpha: 0.25 } },
  ],
  // ── 弩塔（L1=L1, L2=L2, L3=L3）──
  ballista_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.08, extraParts: [
      { shape: 'rect', offsetX: 0, offsetY: -4, size: 16, h: 1, color: '#90a4ae', alpha: 0.7 },
      { shape: 'triangle', offsetX: 20, offsetY: -2, size: 12, color: '#455a64', alpha: 0.9 },
    ] },
    { level: 3, scaleMultiplier: 1.17, extraParts: [
      { shape: 'rect', offsetX: 0, offsetY: -4, size: 20, h: 2, color: '#b0bec5', alpha: 0.8 },
      { shape: 'triangle', offsetX: 22, offsetY: -3, size: 14, color: '#37474f', alpha: 1 },
      { shape: 'circle', offsetX: -16, offsetY: 2, size: 4, color: '#78909c', alpha: 0.7 },
      { shape: 'circle', offsetX: 16, offsetY: 2, size: 4, color: '#78909c', alpha: 0.7 },
    ], glow: { radius: 22, color: '#78909c', alpha: 0.15 }, passiveVisual: { type: 'crit_flash', description: 'pierce damage no decay, 50% bonus on 3+ hits' } },
  ],
};

// ============================================================
// ENEMY_CONFIGS — v4.0 敌人配置（per design/03-units.md §5-6）
// ============================================================
// 字段映射: defense=armor, attackRange=射程, rewardGold=击杀奖励

export const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  // ===== §5.1 绿野仙踪（怪兽族）=====
  [EnemyType.Goblin]: {
    type: EnemyType.Goblin, name: '哥布林', hp: 18, speed: 45, atk: 8,
    defense: 3, magicResist: 0, attackRange: 30, attackSpeed: 1.0,
    canAttackBuildings: false, rewardGold: 5, color: '#ef5350', radius: 16, attackAnimDuration: 0.45,
  },
  [EnemyType.Boar]: {
    type: EnemyType.Boar, name: '疯狂野猪', hp: 60, speed: 80, atk: 12,
    defense: 0, magicResist: 0, attackRange: 30, attackSpeed: 1.5,
    canAttackBuildings: false, rewardGold: 8, color: '#8d6e63', radius: 18, attackAnimDuration: 0.4,
  },
  [EnemyType.Elephant]: {
    type: EnemyType.Elephant, name: '铁甲大象', hp: 300, speed: 20, atk: 15,
    defense: 25, magicResist: 5, attackRange: 40, attackSpeed: 0.6,
    canAttackBuildings: true, rewardGold: 20, color: '#78909c', radius: 30, attackAnimDuration: 0.6,
  },
  [EnemyType.Giant]: {
    type: EnemyType.Giant, name: '草原巨人', hp: 400, speed: 15, atk: 30,
    defense: 15, magicResist: 10, attackRange: 60, attackSpeed: 0.5,
    canAttackBuildings: true, rewardGold: 30, color: '#4e342e', radius: 32, attackAnimDuration: 0.7,
  },

  // ===== §5.2 沙漠虫潮（虫族）=====
  [EnemyType.DesertBeetle]: {
    type: EnemyType.DesertBeetle, name: '沙漠黑虫', hp: 40, speed: 35, atk: 6,
    defense: 2, magicResist: 0, attackRange: 20, attackSpeed: 1.5,
    canAttackBuildings: false, rewardGold: 3, color: '#c8a96e', radius: 14, attackAnimDuration: 0.35,
  },
  [EnemyType.BurrowBeetle]: {
    type: EnemyType.BurrowBeetle, name: '钻地甲虫', hp: 120, speed: 40, atk: 15,
    defense: 10, magicResist: 0, attackRange: 30, attackSpeed: 1.0,
    canAttackBuildings: false, rewardGold: 12, color: '#a1887f', radius: 16, attackAnimDuration: 0.4,
  },
  [EnemyType.Locust]: {
    type: EnemyType.Locust, name: '吸血蝗虫', hp: 30, speed: 25, atk: 10,
    defense: 0, magicResist: 0, attackRange: 30, attackSpeed: 1.0,
    canAttackBuildings: false, rewardGold: 4, color: '#cddc39', radius: 8, attackAnimDuration: 0.2,
  },
  [EnemyType.BombBeetle]: {
    type: EnemyType.BombBeetle, name: '自爆甲虫', hp: 50, speed: 50, atk: 80,
    defense: 0, magicResist: 0, attackRange: 60, attackSpeed: 1.0,
    canAttackBuildings: true, rewardGold: 15, color: '#ff5722', radius: 12,
    specialOnDeath: 'explode', deathDamage: 80, deathRadius: 50, attackAnimDuration: 0.3,
  },

  // ===== §5.3 黑暗古堡（黑暗族）=====
  [EnemyType.Werewolf]: {
    type: EnemyType.Werewolf, name: '狼人', hp: 150, speed: 55, atk: 20,
    defense: 8, magicResist: 5, attackRange: 40, attackSpeed: 1.5,
    canAttackBuildings: false, rewardGold: 12, color: '#5d4037', radius: 20, attackAnimDuration: 0.4,
  },
  [EnemyType.VampireBat]: {
    type: EnemyType.VampireBat, name: '吸血蝙蝠', hp: 40, speed: 60, atk: 8,
    defense: 0, magicResist: 5, attackRange: 40, attackSpeed: 1.2,
    canAttackBuildings: false, rewardGold: 5, color: '#6a1b9a', radius: 12, attackAnimDuration: 0.3,
  },
  [EnemyType.Wizard]: {
    type: EnemyType.Wizard, name: '巫师', hp: 100, speed: 30, atk: 25,
    defense: 5, magicResist: 20, attackRange: 180, attackSpeed: 0.8,
    canAttackBuildings: true, rewardGold: 15, color: '#7b1fa2', radius: 14, attackAnimDuration: 0.5,
  },
  [EnemyType.Priest]: {
    type: EnemyType.Priest, name: '黑暗牧师', hp: 120, speed: 25, atk: 1,
    defense: 10, magicResist: 15, attackRange: 150, attackSpeed: 0,
    canAttackBuildings: false, rewardGold: 18, color: '#e0e0e0', radius: 16, attackAnimDuration: 0.45,
  },
  [EnemyType.Frankenstein]: {
    type: EnemyType.Frankenstein, name: '弗兰肯斯坦', hp: 500, speed: 20, atk: 35,
    defense: 20, magicResist: 10, attackRange: 50, attackSpeed: 0.6,
    canAttackBuildings: true, rewardGold: 30, color: '#2e7d32', radius: 28, attackAnimDuration: 0.6,
  },

  // ===== §5.4 末日废土（机械族）=====
  [EnemyType.Plane]: {
    type: EnemyType.Plane, name: '飞机', hp: 80, speed: 70, atk: 15,
    defense: 5, magicResist: 5, attackRange: 60, attackSpeed: 1.0,
    canAttackBuildings: true, rewardGold: 10, color: '#78909c', radius: 20, attackAnimDuration: 0.25,
  },
  [EnemyType.Tank]: {
    type: EnemyType.Tank, name: '坦克', hp: 350, speed: 15, atk: 40,
    defense: 35, magicResist: 5, attackRange: 80, attackSpeed: 0.5,
    canAttackBuildings: true, rewardGold: 25, color: '#505050', radius: 28, attackAnimDuration: 0.7,
  },
  [EnemyType.OilTruck]: {
    type: EnemyType.OilTruck, name: '油罐车', hp: 150, speed: 35, atk: 5,
    defense: 10, magicResist: 0, attackRange: 30, attackSpeed: 1.0,
    canAttackBuildings: true, rewardGold: 18, color: '#bf360c', radius: 24,
    specialOnDeath: 'explode', deathDamage: 50, deathRadius: 70, attackAnimDuration: 0.35,
  },
  [EnemyType.RobotDog]: {
    type: EnemyType.RobotDog, name: '机器狗', hp: 50, speed: 80, atk: 10,
    defense: 5, magicResist: 0, attackRange: 25, attackSpeed: 2.0,
    canAttackBuildings: false, rewardGold: 6, color: '#90a4ae', radius: 14, attackAnimDuration: 0.3,
  },
  [EnemyType.GiantRobot]: {
    type: EnemyType.GiantRobot, name: '巨型机器人', hp: 600, speed: 10, atk: 50,
    defense: 40, magicResist: 10, attackRange: 100, attackSpeed: 0.4,
    canAttackBuildings: true, rewardGold: 40, color: '#37474f', radius: 34, attackAnimDuration: 0.8,
  },
  [EnemyType.Drone]: {
    type: EnemyType.Drone, name: '无人机', hp: 30, speed: 65, atk: 8,
    defense: 0, magicResist: 5, attackRange: 50, attackSpeed: 1.5,
    canAttackBuildings: false, rewardGold: 4, color: '#4fc3f7', radius: 10, attackAnimDuration: 0.2,
  },

  // ===== §6 BOSS =====
  [EnemyType.GiantSlime]: {
    type: EnemyType.GiantSlime, name: '巨型史莱姆', hp: 800, speed: 15, atk: 20,
    defense: 10, magicResist: 5, attackRange: 50, attackSpeed: 0.5,
    canAttackBuildings: true, rewardGold: 100, color: '#66bb6a', radius: 26,
    isBoss: true, bossPhase2HpRatio: 0.5, attackAnimDuration: 0.5,
  },
  [EnemyType.QueenBeetle]: {
    type: EnemyType.QueenBeetle, name: '虫族女王', hp: 1000, speed: 20, atk: 30,
    defense: 15, magicResist: 20, attackRange: 80, attackSpeed: 0.6,
    canAttackBuildings: true, rewardGold: 150, color: '#d32f2f', radius: 34,
    isBoss: true, bossPhase2HpRatio: 0.5, attackAnimDuration: 0.7,
  },
  [EnemyType.Lucifer]: {
    type: EnemyType.Lucifer, name: '路西法', hp: 1200, speed: 18, atk: 40,
    defense: 20, magicResist: 25, attackRange: 60, attackSpeed: 0.5,
    canAttackBuildings: true, rewardGold: 200, color: '#b71c1c', radius: 36,
    isBoss: true, bossPhase2HpRatio: 0.5, attackAnimDuration: 0.8,
  },
  [EnemyType.SuperRobot]: {
    type: EnemyType.SuperRobot, name: '超级机器人', hp: 2000, speed: 10, atk: 60,
    defense: 40, magicResist: 15, attackRange: 100, attackSpeed: 0.3,
    canAttackBuildings: true, rewardGold: 250, color: '#212121', radius: 40,
    isBoss: true, bossPhase2HpRatio: 0.5, attackAnimDuration: 0.9,
  },
  [EnemyType.AbyssLord]: {
    type: EnemyType.AbyssLord, name: '深渊领主', hp: 3000, speed: 8, atk: 50,
    defense: 30, magicResist: 30, attackRange: 150, attackSpeed: 0.5,
    canAttackBuildings: true, rewardGold: 400, color: '#4a148c', radius: 44,
    isBoss: true, bossPhase2HpRatio: 0.5, attackAnimDuration: 1.0,
  },
};

// ---- MVP Map ----

const MAP_01_WAYPOINTS: GridPos[] = [
  { row: 1, col: 0 },
  { row: 1, col: 4 },
  { row: 4, col: 4 },
  { row: 4, col: 1 },
  { row: 6, col: 1 },
  { row: 6, col: 5 },
  { row: 4, col: 5 },
  { row: 4, col: 8 },
  { row: 6, col: 8 },
  { row: 6, col: 20 },
];

const MAP_01_GRAPH = migrateEnemyPathToGraph({ enemyPath: MAP_01_WAYPOINTS });

export const MAP_01: MapConfig = {
  name: '第一关 — 平原',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: buildMapTiles(),
  pathGraph: MAP_01_GRAPH.pathGraph,
  spawns: MAP_01_GRAPH.spawns,
  neutralUnits: [],
};

function buildMapTiles(): TileType[][] {
  const tiles: TileType[][] = [];
  for (let row = 0; row < 9; row++) {
    const line: TileType[] = [];
    for (let col = 0; col < 21; col++) {
      const onPath = isOnPath(row, col);
      if (col === 0 && row === 1) line.push(TileType.Spawn);
      else if (col === 20 && row === 6) line.push(TileType.Base);
      else if (onPath) line.push(TileType.Path);
      else line.push(TileType.Empty);
    }
    tiles.push(line);
  }
  return tiles;
}

function isOnPath(row: number, col: number): boolean {
  for (let i = 0; i < MAP_01_WAYPOINTS.length - 1; i++) {
    const a = MAP_01_WAYPOINTS[i]!;
    const b = MAP_01_WAYPOINTS[i + 1]!;
    if (a.row === b.row) {
      const minCol = Math.min(a.col, b.col);
      const maxCol = Math.max(a.col, b.col);
      if (row === a.row && col >= minCol && col <= maxCol) return true;
    } else if (a.col === b.col) {
      const minRow = Math.min(a.row, b.row);
      const maxRow = Math.max(a.row, b.row);
      if (col === a.col && row >= minRow && row <= maxRow) return true;
    }
  }
  return false;
}

function buildEnemyPath() {
  return MAP_01_WAYPOINTS;
}

// ---- MVP Waves ----

export const MVP_WAVES: WaveConfig[] = [
  {
    waveNumber: 1,
    enemies: [{ enemyType: EnemyType.Goblin, count: 5, spawnInterval: 1.2 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 2,
    enemies: [{ enemyType: EnemyType.Goblin, count: 8, spawnInterval: 1.0 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 3,
    enemies: [{ enemyType: EnemyType.Goblin, count: 12, spawnInterval: 0.8 }],
    spawnDelay: 2,
  },
];

// ============================================================
// UNIT_CONFIGS — v4.0 士兵配置（per design/03-units.md §3）
// ============================================================

export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  // ---- 3.1 盾卫 ----
  [UnitType.ShieldGuard]: {
    type: UnitType.ShieldGuard,
    name: '盾卫',
    hp: 300,
    atk: 12,
    attackSpeed: 1.0,
    attackRange: 40,
    alertRange: 200,
    speed: 40,
    defense: 30,
    popCost: 2,
    color: '#64b5f6',
    size: 28,
    skillId: 'taunt',
    cost: 55,
    moveRange: 120,
    tauntCapacity: 2,
    tauntCapacityPerLevel: 1,
    maxLevel: 3,
    upgradeCosts: [40, 60],
    upgradeHpBonus: [120, 180],
    upgradeAtkBonus: [2, 3],
    upgradeTauntCapacityBonus: [1, 1],
    shape: 'rect',
    attackAnimDuration: 0.4,
    visualParts: {
      eyes: {
        offsetX: 5,
        offsetY: -4,
        scleraRadius: 3,
        scleraColor: '#ffffff',
        pupilRadius: 1.6,
        pupilColor: '#1a237e',
      },
      weapon: {
        anchorX: 13,
        anchorY: 2,
        length: 14,
        width: 3,
        color: '#cfd8dc',
        stroke: '#37474f',
        strokeWidth: 1,
        restAngle: -0.25,
        swingAngle: 1.2,
      },
      bodyParts: [
        { shape: 'circle', offsetX: -14, offsetY: 0, size: 18, color: '#1976d2', stroke: '#0d47a1', strokeWidth: 2 },
        { shape: 'rect', offsetX: -14, offsetY: 0, size: 2, color: '#bbdefb' },
        { shape: 'rect', offsetX: -14, offsetY: 0, size: 14, h: 2, color: '#bbdefb' },
      ],
    },
  },
  // ---- 3.2 弓手 ----
  [UnitType.Archer]: {
    type: UnitType.Archer,
    name: '弓箭手',
    hp: 120,
    atk: 30,
    attackSpeed: 1.5,
    attackRange: 200,
    alertRange: 300,
    speed: 35,
    defense: 5,
    popCost: 2,
    color: '#66bb6a',
    size: 20,
    skillId: 'volley',
    cost: 50,
    moveRange: 100,
    maxLevel: 3,
    upgradeCosts: [40, 60],
    upgradeHpBonus: [40, 60],
    upgradeAtkBonus: [8, 12],
    shape: 'rect',
    attackAnimDuration: 0.35,
    visualParts: {
      eyes: {
        offsetX: 4,
        offsetY: -3,
        scleraRadius: 3,
        scleraColor: '#ffffff',
        pupilRadius: 1.5,
        pupilColor: '#1b5e20',
      },
    },
  },
  // ---- 3.3 法师 ----
  [UnitType.Mage]: {
    type: UnitType.Mage,
    name: '法师',
    hp: 100,
    atk: 25,
    attackSpeed: 1.0,
    attackRange: 150,
    alertRange: 280,
    speed: 30,
    defense: 5,
    popCost: 2,
    color: '#7b1fa2',
    size: 18,
    skillId: 'fireball',
    cost: 60,
    moveRange: 80,
    splashRadius: 40,
    maxLevel: 3,
    upgradeCosts: [45, 65],
    upgradeHpBonus: [35, 55],
    upgradeAtkBonus: [7, 11],
    shape: 'rect',
    attackAnimDuration: 0.4,
    visualParts: {
      eyes: {
        offsetX: 3,
        offsetY: -2,
        scleraRadius: 2.5,
        scleraColor: '#ffffff',
        pupilRadius: 1.2,
        pupilColor: '#4a148c',
      },
    },
  },
  // ---- 3.4 牧师（治疗者） ----
  [UnitType.Priest]: {
    type: UnitType.Priest,
    name: '祭司',
    hp: 100,
    atk: 0,
    attackSpeed: 1.0,
    attackRange: 150,
    alertRange: 250,
    speed: 30,
    defense: 5,
    popCost: 2,
    color: '#ffffff',
    size: 20,
    skillId: 'heal',
    cost: 55,
    moveRange: 80,
    maxLevel: 3,
    upgradeCosts: [40, 60],
    upgradeHpBonus: [40, 60],
    upgradeAtkBonus: [0, 0],
    shape: 'rect',
    attackAnimDuration: 0,
    visualParts: {
      eyes: {
        offsetX: 4,
        offsetY: -3,
        scleraRadius: 3,
        scleraColor: '#ffffff',
        pupilRadius: 1.5,
        pupilColor: '#455a64',
      },
    },
  },
  // ---- 3.5 剑士 ----
  [UnitType.Swordsman]: {
    type: UnitType.Swordsman,
    name: '剑士',
    hp: 150,
    atk: 20,
    attackSpeed: 1.2,
    attackRange: 45,
    alertRange: 200,
    speed: 50,
    defense: 10,
    popCost: 2,
    color: '#ef5350',
    size: 24,
    skillId: 'whirlwind',
    cost: 50,
    moveRange: 150,
    splashRadius: 60,
    maxLevel: 3,
    upgradeCosts: [40, 60],
    upgradeHpBonus: [50, 80],
    upgradeAtkBonus: [5, 8],
    shape: 'circle',
    attackAnimDuration: 0.35,
    visualParts: {
      eyes: {
        offsetX: 4,
        offsetY: -3,
        scleraRadius: 3,
        scleraColor: '#ffffff',
        pupilRadius: 1.5,
        pupilColor: '#b71c1c',
      },
    },
  },
  // ---- 3.6 工程师 ----
  [UnitType.Engineer]: {
    type: UnitType.Engineer,
    name: '工程师',
    hp: 90,
    atk: 8,
    attackSpeed: 0.8,
    attackRange: 50,
    alertRange: 180,
    speed: 40,
    defense: 15,
    popCost: 2,
    color: '#ffa726',
    size: 22,
    skillId: 'repair',
    cost: 60,
    moveRange: 100,
    maxLevel: 3,
    upgradeCosts: [45, 65],
    upgradeHpBonus: [30, 50],
    upgradeAtkBonus: [2, 4],
    shape: 'circle',
    attackAnimDuration: 0.4,
    visualParts: {
      eyes: {
        offsetX: 4,
        offsetY: -3,
        scleraRadius: 3,
        scleraColor: '#ffffff',
        pupilRadius: 1.5,
        pupilColor: '#e65100',
      },
    },
  },
  // ---- 3.7 刺客 ----
  [UnitType.Assassin]: {
    type: UnitType.Assassin,
    name: '刺客',
    hp: 80,
    atk: 40,
    attackSpeed: 1.8,
    attackRange: 35,
    alertRange: 250,
    speed: 70,
    defense: 0,
    popCost: 2,
    color: '#ab47bc',
    size: 20,
    skillId: 'assassinate',
    cost: 65,
    moveRange: 200,
    maxLevel: 3,
    upgradeCosts: [50, 70],
    upgradeHpBonus: [25, 40],
    upgradeAtkBonus: [10, 15],
    shape: 'circle',
    attackAnimDuration: 0.25,
    visualParts: {
      eyes: {
        offsetX: 3,
        offsetY: -2,
        scleraRadius: 2.5,
        scleraColor: '#ffffff',
        pupilRadius: 1.2,
        pupilColor: '#4a148c',
      },
    },
  },
};

// ============================================================
// TRAP_CONFIGS — 机关配置（per design/03-units.md §4）
// ============================================================

export const TRAP_CONFIGS: Record<string, TrapConfig> = {
  spike_trap: {
    type: 'SpikeTrap',
    name: '地刺',
    hp: 99999,
    damagePerSecond: 8,
    radius: 32,
    cooldown: 0,
    maxTriggers: 0,
    color: '#757575',
    size: 28,
    cost: 40,
    shape: 'triangle',
    layer: 'AboveGrid',
  },
  bear_trap: {
    type: 'BearTrap',
    name: '捕兽夹',
    hp: 99999,
    damagePerSecond: 0,
    radius: 0,
    cooldown: 0,
    maxTriggers: 1,
    color: '#8d6e63',
    size: 24,
    cost: 50,
    shape: 'rect',
    layer: 'AboveGrid',
    stunDuration: 2.0,
    damage: 20,
    bossImmune: true,
  },
  tar_pit: {
    type: 'TarPit',
    name: '焦油坑',
    hp: 99999,
    damagePerSecond: 0,
    radius: 32,
    cooldown: 0,
    maxTriggers: 0,
    color: '#424242',
    size: 30,
    cost: 45,
    shape: 'circle',
    layer: 'AboveGrid',
    slowPercent: 20,
  },
  boulder: {
    type: 'Boulder',
    name: '巨石',
    hp: 200,
    damagePerSecond: 0,
    radius: 0,
    cooldown: 0,
    maxTriggers: 0,
    color: '#78909c',
    size: 40,
    cost: 60,
    shape: 'circle',
    layer: 'Ground',
  },
};

/** 机关 YAML ID → TrapTypeVal 数值映射 */
export const TRAP_TYPE_VAL: Record<string, number> = {
  SpikeTrap: 0,
  BearTrap: 1,
  TarPit: 2,
  Boulder: 3,
};

export const UNIT_TYPE_BY_ID: readonly UnitType[] = [
  UnitType.ShieldGuard,
  UnitType.Swordsman,
  UnitType.Archer,
  UnitType.Priest,
  UnitType.Engineer,
  UnitType.Assassin,
  UnitType.Mage,
];

export const UNIT_ID_BY_TYPE: Readonly<Record<UnitType, number>> = {
  [UnitType.ShieldGuard]: 0,
  [UnitType.Swordsman]: 1,
  [UnitType.Archer]: 2,
  [UnitType.Priest]: 3,
  [UnitType.Engineer]: 4,
  [UnitType.Assassin]: 5,
  [UnitType.Mage]: 6,
};

// ---- Skill Configs (v4.0 士兵技能) ----

// v4.0: Production buildings removed. Keep for backward compat; empty record.
export const PRODUCTION_CONFIGS: Partial<Record<ProductionType, ProductionConfig>> = {};

export const SKILL_CONFIGS: Record<string, SkillConfig> = {
  taunt: {
    id: 'taunt',
    name: '嘲讽',
    trigger: SkillTrigger.Passive,
    cooldown: 0,
    energyCost: 0,
    range: 130,
    value: 3,
    buffId: null,
    description: '范围内敌人优先攻击盾卫',
  },
  volley: {
    id: 'volley',
    name: '齐射',
    trigger: SkillTrigger.Active,
    cooldown: 10,
    energyCost: 25,
    range: 200,
    value: 30,
    buffId: null,
    description: '对目标区域连射3箭',
  },
  heal: {
    id: 'heal',
    name: '治疗',
    trigger: SkillTrigger.Passive,
    cooldown: 1.0,
    energyCost: 0,
    range: 150,
    value: 15,
    buffId: null,
    description: '持续治疗范围内HP最低的友方单位',
  },
  fireball: {
    id: 'fireball',
    name: '火球术',
    trigger: SkillTrigger.Passive,
    cooldown: 0,
    energyCost: 0,
    range: 150,
    value: 25,
    buffId: null,
    description: '法师普攻自带AOE（半径40px）',
  },
};

export const PHASE2_WAVES: WaveConfig[] = [
  {
    waveNumber: 1,
    enemies: [{ enemyType: EnemyType.Goblin, count: 6, spawnInterval: 1.0 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 2,
    enemies: [
      { enemyType: EnemyType.Goblin, count: 4, spawnInterval: 1.0 },
      { enemyType: EnemyType.Goblin, count: 3, spawnInterval: 0.6 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 3,
    enemies: [{ enemyType: EnemyType.Goblin, count: 10, spawnInterval: 0.8 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 4,
    enemies: [
      { enemyType: EnemyType.Goblin, count: 3, spawnInterval: 1.0 },
      { enemyType: EnemyType.Boar, count: 4, spawnInterval: 0.5 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 5,
    enemies: [
      { enemyType: EnemyType.Goblin, count: 2, spawnInterval: 1.0 },
      { enemyType: EnemyType.Giant, count: 3, spawnInterval: 2.0 },
    ],
    spawnDelay: 3,
  },
];
