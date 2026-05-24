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
  type MapConfig,
  type WaveConfig,
  type GridPos,
  type UpgradeVisualRegistry,
} from '../types/index.js';
import { migrateEnemyPathToGraph } from '../level/graph/migration.js';

// ---- Tower Configs ----

export const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  [TowerType.Arrow]: {
    type: TowerType.Arrow,
    name: '箭塔',
    cost: 50,
    hp: 100,
    atk: 11,
    attackSpeed: 1.0,
    range: 200,
    damageType: 'physical',
    upgradeCosts: [45, 65, 95, 140],
    upgradeAtkBonus: [5, 7, 10, 15],
    upgradeRangeBonus: [15, 20, 20, 25],
    color: '#4fc3f7',
    buildTime: 1.5,
  },
  [TowerType.Cannon]: {
    type: TowerType.Cannon,
    name: '炮塔',
    cost: 85,
    hp: 120,
    atk: 24,
    attackSpeed: 0.4,
    range: 180,
    damageType: 'physical',
    splashRadius: 80,
    stunDuration: 0.8,
    upgradeCosts: [55, 85, 120, 165],
    upgradeAtkBonus: [8, 11, 14, 18],
    upgradeRangeBonus: [15, 20, 20, 25],
    color: '#ff8a65',
    buildTime: 2.0,
  },
  [TowerType.Ice]: {
    type: TowerType.Ice,
    name: '冰塔',
    cost: 60,
    hp: 100,
    atk: 8,
    attackSpeed: 1.1,
    range: 200,
    damageType: 'magic',
    slowPercent: 25,
    slowMaxStacks: 4,
    freezeDuration: 1.0,
    upgradeCosts: [45, 65, 90, 130],
    upgradeAtkBonus: [3, 4, 5, 7],
    upgradeRangeBonus: [15, 20, 20, 25],
    color: '#81d4fa',
    buildTime: 1.5,
  },
  [TowerType.Lightning]: {
    type: TowerType.Lightning,
    name: '电塔',
    cost: 80,
    hp: 100,
    atk: 13,
    attackSpeed: 0.9,
    range: 170,
    damageType: 'magic',
    chainCount: 3,
    chainDecay: 0.22,
    upgradeCosts: [55, 80, 115, 155],
    upgradeAtkBonus: [6, 8, 11, 14],
    upgradeRangeBonus: [15, 20, 20, 25],
    color: '#fff176',
    buildTime: 2.0,
  },
  [TowerType.Laser]: {
    type: TowerType.Laser,
    name: '激光塔',
    cost: 90,
    hp: 80,
    atk: 20,
    attackSpeed: 0.5,
    range: 260,
    damageType: 'magic',
    upgradeCosts: [55, 75, 105, 145],
    upgradeAtkBonus: [6, 8, 10, 13],
    upgradeRangeBonus: [15, 20, 20, 25],
    color: '#e040fb',
    buildTime: 2.0,
  },
  [TowerType.Bat]: {
    type: TowerType.Bat,
    name: '蝙蝠塔',
    cost: 85,
    hp: 90,
    atk: 12,
    attackSpeed: 0.8,
    range: 200,
    damageType: 'magic',
    upgradeCosts: [55, 75, 105, 150],
    upgradeAtkBonus: [5, 6, 8, 10],
    upgradeRangeBonus: [15, 20, 20, 25],
    color: '#7c4dff',
    buildTime: 2.0,
    batCount: 4,
    batReplenishCD: 12,
    batHP: 30,
    batDamage: 6,
    batAttackRange: 150,
    batAttackSpeed: 0.8,
    batSpeed: 120,
  },
  [TowerType.Missile]: {
    type: TowerType.Missile,
    name: '导弹塔',
    cost: 220,
    hp: 150,
    atk: 90,
    attackSpeed: 0.14,
    range: 600,
    damageType: 'physical',
    splashRadius: 130,
    upgradeCosts: [120, 180, 260, 360],
    upgradeAtkBonus: [30, 35, 45, 60],
    upgradeRangeBonus: [0, 0, 0, 0],
    color: '#ff1744',
    buildTime: 3.0,
    cantTargetFlying: true,
    centerBonusRadiusRatio: 0.1,
    centerBonusMultiplier: 1.2,
  },
  [TowerType.Fire]: {
    type: TowerType.Fire,
    name: '火塔',
    cost: 75,
    hp: 100,
    atk: 15,
    attackSpeed: 0.8,
    range: 180,
    damageType: 'magic',
    dotDamage: 8,
    dotDuration: 3,
    dotMaxStacks: 3,
    upgradeCosts: [50, 70, 100, 140],
    upgradeAtkBonus: [5, 7, 10, 15],
    upgradeRangeBonus: [15, 20, 20, 25],
    color: '#ff5722',
    buildTime: 2.0,
  },
  [TowerType.Poison]: {
    type: TowerType.Poison,
    name: '毒塔',
    cost: 70,
    hp: 90,
    atk: 8,
    attackSpeed: 0.7,
    range: 180,
    damageType: 'magic',
    dotDamage: 10,
    dotDuration: 5,
    dotMaxStacks: 5,
    upgradeCosts: [45, 65, 90, 130],
    upgradeAtkBonus: [3, 4, 6, 8],
    upgradeRangeBonus: [15, 20, 20, 25],
    color: '#66bb6a',
    buildTime: 1.5,
  },
  [TowerType.Ballista]: {
    type: TowerType.Ballista,
    name: '弩炮塔',
    cost: 100,
    hp: 110,
    atk: 45,
    attackSpeed: 0.25,
    range: 320,
    damageType: 'physical',
    pierceCount: 2,
    armorPenetration: 0,
    upgradeCosts: [70, 100, 140, 190],
    upgradeAtkBonus: [13, 17, 21, 29],
    upgradeRangeBonus: [20, 20, 20, 20],
    color: '#8d6e63',
    buildTime: 2.0,
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
};

// ---- Enemy Configs ----

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  // Phase 0: stub configs — Phase 3 will fill real data
  [EnemyType.Goblin]: { type: EnemyType.Goblin, name: '哥布林', hp: 60, speed: 75, atk: 5, defense: 0, magicResist: 0, attackRange: 0, attackSpeed: 1, canAttackBuildings: false, rewardGold: 10, color: '#ef5350', radius: 16, attackAnimDuration: 0.45 },
  [EnemyType.Boar]: { type: EnemyType.Boar, name: '野猪', hp: 120, speed: 120, atk: 8, defense: 10, magicResist: 0, attackRange: 0, attackSpeed: 1, canAttackBuildings: false, rewardGold: 15, color: '#8d6e63', radius: 18, attackAnimDuration: 0.4 },
  [EnemyType.Elephant]: { type: EnemyType.Elephant, name: '巨象', hp: 500, speed: 30, atk: 25, defense: 50, magicResist: 10, attackRange: 0, attackSpeed: 0.6, canAttackBuildings: true, rewardGold: 40, color: '#78909c', radius: 30, attackAnimDuration: 0.6 },
  [EnemyType.Giant]: { type: EnemyType.Giant, name: '巨人', hp: 800, speed: 25, atk: 40, defense: 70, magicResist: 15, attackRange: 0, attackSpeed: 0.5, canAttackBuildings: true, rewardGold: 60, color: '#4e342e', radius: 32, isBoss: true, attackAnimDuration: 0.7 },
  [EnemyType.GiantSlime]: { type: EnemyType.GiantSlime, name: '巨型史莱姆', hp: 300, speed: 50, atk: 10, defense: 30, magicResist: 40, attackRange: 0, attackSpeed: 1, canAttackBuildings: false, rewardGold: 30, color: '#66bb6a', radius: 26, attackAnimDuration: 0.5 },
  [EnemyType.DesertBeetle]: { type: EnemyType.DesertBeetle, name: '沙漠甲虫', hp: 80, speed: 60, atk: 7, defense: 15, magicResist: 0, attackRange: 0, attackSpeed: 1, canAttackBuildings: false, rewardGold: 12, color: '#c8a96e', radius: 14, attackAnimDuration: 0.35 },
  [EnemyType.BurrowBeetle]: { type: EnemyType.BurrowBeetle, name: '钻地甲虫', hp: 100, speed: 70, atk: 12, defense: 20, magicResist: 0, attackRange: 0, attackSpeed: 0.8, canAttackBuildings: false, rewardGold: 18, color: '#a1887f', radius: 16, attackAnimDuration: 0.4 },
  [EnemyType.Locust]: { type: EnemyType.Locust, name: '蝗虫', hp: 30, speed: 150, atk: 3, defense: 0, magicResist: 0, attackRange: 0, attackSpeed: 1.5, canAttackBuildings: false, rewardGold: 5, color: '#cddc39', radius: 8, attackAnimDuration: 0.2 },
  [EnemyType.BombBeetle]: { type: EnemyType.BombBeetle, name: '炸弹甲虫', hp: 45, speed: 80, atk: 8, defense: 5, magicResist: 0, attackRange: 0, attackSpeed: 1, canAttackBuildings: false, rewardGold: 20, color: '#ff5722', radius: 12, specialOnDeath: 'explode', deathDamage: 50, deathRadius: 100, attackAnimDuration: 0.3 },
  [EnemyType.QueenBeetle]: { type: EnemyType.QueenBeetle, name: '甲虫女王', hp: 1200, speed: 30, atk: 30, defense: 60, magicResist: 30, attackRange: 0, attackSpeed: 0.5, canAttackBuildings: true, rewardGold: 100, color: '#d32f2f', radius: 34, isBoss: true, bossPhase2HpRatio: 0.5, attackAnimDuration: 0.7 },
  [EnemyType.Werewolf]: { type: EnemyType.Werewolf, name: '狼人', hp: 200, speed: 100, atk: 20, defense: 15, magicResist: 10, attackRange: 0, attackSpeed: 0.9, canAttackBuildings: false, rewardGold: 25, color: '#5d4037', radius: 20, attackAnimDuration: 0.4 },
  [EnemyType.VampireBat]: { type: EnemyType.VampireBat, name: '吸血蝙蝠', hp: 70, speed: 120, atk: 10, defense: 5, magicResist: 15, attackRange: 120, attackSpeed: 1.2, canAttackBuildings: false, rewardGold: 15, color: '#6a1b9a', radius: 12, attackAnimDuration: 0.3 },
  [EnemyType.Wizard]: { type: EnemyType.Wizard, name: '巫师', hp: 100, speed: 45, atk: 25, defense: 10, magicResist: 50, attackRange: 250, attackSpeed: 0.6, canAttackBuildings: true, rewardGold: 22, color: '#7b1fa2', radius: 14, attackAnimDuration: 0.5 },
  [EnemyType.Priest]: { type: EnemyType.Priest, name: '祭司', hp: 120, speed: 40, atk: 8, defense: 20, magicResist: 45, attackRange: 0, attackSpeed: 0.7, canAttackBuildings: false, rewardGold: 25, color: '#e0e0e0', radius: 16, attackAnimDuration: 0.45 },
  [EnemyType.Frankenstein]: { type: EnemyType.Frankenstein, name: '弗兰肯斯坦', hp: 600, speed: 35, atk: 35, defense: 50, magicResist: 20, attackRange: 0, attackSpeed: 0.5, canAttackBuildings: true, rewardGold: 50, color: '#2e7d32', radius: 28, attackAnimDuration: 0.6 },
  [EnemyType.Lucifer]: { type: EnemyType.Lucifer, name: '路西法', hp: 1500, speed: 30, atk: 50, defense: 60, magicResist: 50, attackRange: 300, attackSpeed: 0.5, canAttackBuildings: true, rewardGold: 150, color: '#b71c1c', radius: 36, isBoss: true, bossPhase2HpRatio: 0.5, attackAnimDuration: 0.8 },
  [EnemyType.Plane]: { type: EnemyType.Plane, name: '战机', hp: 120, speed: 200, atk: 15, defense: 5, magicResist: 5, attackRange: 0, attackSpeed: 1, canAttackBuildings: true, rewardGold: 30, color: '#78909c', radius: 20, attackAnimDuration: 0.25 },
  [EnemyType.Tank]: { type: EnemyType.Tank, name: '坦克', hp: 400, speed: 25, atk: 30, defense: 80, magicResist: 15, attackRange: 250, attackSpeed: 0.4, canAttackBuildings: true, rewardGold: 45, color: '#505050', radius: 28, attackAnimDuration: 0.7 },
  [EnemyType.OilTruck]: { type: EnemyType.OilTruck, name: '油罐车', hp: 200, speed: 40, atk: 10, defense: 15, magicResist: 0, attackRange: 0, attackSpeed: 1, canAttackBuildings: true, rewardGold: 35, color: '#bf360c', radius: 24, specialOnDeath: 'explode', deathDamage: 100, deathRadius: 150, attackAnimDuration: 0.35 },
  [EnemyType.RobotDog]: { type: EnemyType.RobotDog, name: '机器狗', hp: 80, speed: 130, atk: 12, defense: 10, magicResist: 5, attackRange: 0, attackSpeed: 1.2, canAttackBuildings: false, rewardGold: 12, color: '#90a4ae', radius: 14, attackAnimDuration: 0.3 },
  [EnemyType.GiantRobot]: { type: EnemyType.GiantRobot, name: '巨型机器人', hp: 1000, speed: 20, atk: 45, defense: 90, magicResist: 30, attackRange: 280, attackSpeed: 0.3, canAttackBuildings: true, rewardGold: 80, color: '#37474f', radius: 34, isBoss: true, bossPhase2HpRatio: 0.5, attackAnimDuration: 0.8 },
  [EnemyType.Drone]: { type: EnemyType.Drone, name: '无人机', hp: 50, speed: 180, atk: 8, defense: 0, magicResist: 5, attackRange: 200, attackSpeed: 1.5, canAttackBuildings: false, rewardGold: 15, color: '#4fc3f7', radius: 10, attackAnimDuration: 0.2 },
  [EnemyType.SuperRobot]: { type: EnemyType.SuperRobot, name: '超级机器人', hp: 2000, speed: 15, atk: 60, defense: 100, magicResist: 50, attackRange: 350, attackSpeed: 0.2, canAttackBuildings: true, rewardGold: 200, color: '#212121', radius: 40, isBoss: true, bossPhase2HpRatio: 0.5, attackAnimDuration: 0.9 },
  [EnemyType.AbyssLord]: { type: EnemyType.AbyssLord, name: '深渊领主', hp: 3000, speed: 20, atk: 80, defense: 80, magicResist: 60, attackRange: 400, attackSpeed: 0.3, canAttackBuildings: true, rewardGold: 300, color: '#4a148c', radius: 44, isBoss: true, bossPhase2HpRatio: 0.5, attackAnimDuration: 1.0 },
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

// ---- Unit Configs ----

export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  [UnitType.ShieldGuard]: {
    type: UnitType.ShieldGuard,
    name: '盾卫',
    hp: 400,
    atk: 6,
    attackSpeed: 0.7,
    attackRange: 64,
    alertRange: 200,
    speed: 60,
    defense: 30,
    popCost: 2,
    color: '#64b5f6',
    size: 28,
    skillId: 'taunt',
    cost: 55,
    moveRange: 180,
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
  [UnitType.Archer]: {
    type: UnitType.Archer,
    name: '弓箭手',
    hp: 150,
    atk: 18,
    attackSpeed: 1.2,
    attackRange: 250,
    alertRange: 300,
    speed: 70,
    defense: 5,
    popCost: 2,
    color: '#66bb6a',
    size: 20,
    skillId: 'volley',
    cost: 50,
    moveRange: 200,
    maxLevel: 3,
    upgradeCosts: [40, 60],
    upgradeHpBonus: [50, 75],
    upgradeAtkBonus: [5, 8],
    shape: 'rect',
    attackAnimDuration: 0.35,
  },
  [UnitType.Mage]: {
    type: UnitType.Mage,
    name: '法师',
    hp: 120,
    atk: 25,
    attackSpeed: 0.8,
    attackRange: 280,
    alertRange: 320,
    speed: 55,
    defense: 3,
    popCost: 2,
    color: '#7b1fa2',
    size: 18,
    skillId: 'fireball',
    cost: 60,
    moveRange: 180,
    maxLevel: 3,
    upgradeCosts: [45, 65],
    upgradeHpBonus: [40, 60],
    upgradeAtkBonus: [7, 11],
    shape: 'rect',
    attackAnimDuration: 0.4,
  },
  [UnitType.Priest]: {
    type: UnitType.Priest,
    name: '祭司',
    hp: 130,
    atk: 10,
    attackSpeed: 0.6,
    attackRange: 200,
    alertRange: 250,
    speed: 60,
    defense: 8,
    popCost: 2,
    color: '#ffffff',
    size: 20,
    skillId: 'heal',
    cost: 55,
    moveRange: 180,
    maxLevel: 3,
    upgradeCosts: [40, 60],
    upgradeHpBonus: [45, 70],
    upgradeAtkBonus: [3, 5],
    shape: 'rect',
    attackAnimDuration: 0.35,
  },
};

export const UNIT_TYPE_BY_ID: readonly UnitType[] = [
  UnitType.ShieldGuard,
  UnitType.Archer,
  UnitType.Mage,
  UnitType.Priest,
];

export const UNIT_ID_BY_TYPE: Readonly<Record<UnitType, number>> = {
  [UnitType.ShieldGuard]: 0,
  [UnitType.Archer]: 1,
  [UnitType.Mage]: 2,
  [UnitType.Priest]: 3,
};

// ---- Production Configs ----

export const PRODUCTION_CONFIGS: Record<ProductionType, ProductionConfig> = {
  [ProductionType.GoldMine]: {
    type: ProductionType.GoldMine,
    name: '金矿',
    cost: 85,
    hp: 80,
    resourceType: 'gold',
    baseRate: 2.5,
    upgradeRateBonus: 2.5,
    upgradeCosts: [55, 100],
    maxLevel: 3,
    color: '#ffd54f',
  },
  [ProductionType.EnergyTower]: {
    type: ProductionType.EnergyTower,
    name: '能量塔 (Phase 3)',
    cost: 65,
    hp: 60,
    resourceType: 'energy',
    baseRate: 1.5,
    upgradeRateBonus: 1.0,
    upgradeCosts: [50, 90],
    maxLevel: 3,
    color: '#81c784',
  },
};

// ---- Skill Configs ----

export const SKILL_CONFIGS: Record<string, SkillConfig> = {
  taunt: {
    id: 'taunt',
    name: '嘲讽',
    trigger: SkillTrigger.Active,
    cooldown: 8,
    energyCost: 20,
    range: 130,
    value: 3,
    buffId: null,
    description: '强制周围敌人攻击自己3秒',
  },
  whirlwind: {
    id: 'whirlwind',
    name: '旋风斩',
    trigger: SkillTrigger.Active,
    cooldown: 6,
    energyCost: 15,
    range: 80,
    value: 35,
    buffId: null,
    description: '对周围敌人造成AOE伤害',
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
