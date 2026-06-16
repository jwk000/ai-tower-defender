// ============================================================
// Tower Defender — 预定义规则处理器
//
// 这些是 RuleEngine 在生命周期事件中调用的具体处理器。
// 设计文档中引用的各种效果：deal_aoe_damage, play_effect,
// drop_gold, flash_color, spawn_projectile 等。
//
// 设计文档: design/02-unit-system.md (Section 3.1)
// ============================================================

import type { World } from 'bitecs';
import { addEntity, addComponent, entityExists } from 'bitecs';
import type { RuleHandlerFn, EventContext } from '../core/RuleEngine.js';
import {
  Health,
  Position,
  FactionVal,
  Faction,
  Visual,
  ShapeVal,
  Boss,
  UnitTag,
  Attack,
  Movement,
  MoveModeVal,
  DamageTypeVal,
  LightningBolt,
  ExplosionEffect,
  DeathEffect,
  Category,
  CategoryVal,
} from '../core/components.js';
import { getGlobalRandom } from '../utils/Random.js';
import type { BuffData } from '../systems/BuffSystem.js';
import { hexToRgb } from '../utils/visualHelpers.js';
import { normalizeSfxKey, Sound } from '../utils/Sound.js';
import { getBossDeathSfx, getBossEnterSfx, getEnemyDeathSfx, getEnemySpawnSfx } from '../utils/audioKeys.js';

// ============================================================
// 回调注册（用于系统间解耦）
// ============================================================

/** 金币增加回调 — 由 EconomySystem 注册 */
let goldCallback: ((amount: number) => void) | null = null;

/** 设置金币回调函数 */
export function setGoldCallback(fn: (amount: number) => void): void {
  goldCallback = fn;
}

/** Buff 应用回调 — 由 BuffSystem 注册（绕过 TowerWorld 类型限制） */
let buffApplier: ((targetId: number, sourceId: number, buffData: BuffData) => void) | null = null;

/** 设置 Buff 应用回调函数 */
export function setBuffApplier(fn: (targetId: number, sourceId: number, buffData: BuffData) => void): void {
  buffApplier = fn;
}

// ============================================================
// 战斗相关处理器
// ============================================================

/**
 * AOE范围伤害
 * YAML: { type: deal_aoe_damage, radius: 100, damage: 50, targets: [Player] }
 */
export const dealAoeDamage: RuleHandlerFn = (world, entityId, params, _context) => {
  const radius = params['radius'] as number ?? 100;
  const damage = params['damage'] as number ?? 50;
  const targetFactions = params['targets'] as number[] ?? [FactionVal.Justice];

  const posX = Position.x[entityId];
  const posY = Position.y[entityId];
  if (posX === undefined || posY === undefined) return;

  for (let eid = 0; eid < Health.current.length; eid++) {
    const hp = Health.current[eid];
    if (hp === undefined || hp <= 0) continue;

    const faction = Faction.value[eid];
    if (faction === undefined || !targetFactions.includes(faction)) continue;

    const ex = Position.x[eid];
    const ey = Position.y[eid];
    if (ex === undefined || ey === undefined) continue;

    const dx = ex - posX;
    const dy = ey - posY;
    if (dx * dx + dy * dy <= radius * radius) {
      Health.current[eid] = Math.max(0, hp - damage);
    }
  }
};

/**
 * 对单体造成伤害
 * YAML: { type: deal_damage, damage: 25 }
 */
export const dealDamage: RuleHandlerFn = (world, entityId, params, context) => {
  const damage = params['damage'] as number ?? 0;
  const targetId = context.sourceId;
  if (targetId !== undefined && Health.current[targetId] !== undefined) {
    Health.current[targetId] = Math.max(0, Health.current[targetId]! - damage);
  }
};

/**
 * AOE爆炸伤害 + 视觉效果
 * YAML: { type: explode, radius: 100, damage: 50, targets: [Justice] }
 */
export const explode: RuleHandlerFn = (world, entityId, params, _context) => {
  const radius = params['radius'] as number ?? 100;
  const damage = params['damage'] as number ?? 50;
  const targetFactions = params['targets'] as number[] ?? [FactionVal.Justice];

  const posX = Position.x[entityId];
  const posY = Position.y[entityId];
  if (posX === undefined || posY === undefined) return;

  // AOE 伤害
  for (let eid = 0; eid < Health.current.length; eid++) {
    const hp = Health.current[eid];
    if (hp === undefined || hp <= 0) continue;

    const faction = Faction.value[eid];
    if (faction === undefined || !targetFactions.includes(faction)) continue;

    const ex = Position.x[eid];
    const ey = Position.y[eid];
    if (ex === undefined || ey === undefined) continue;

    const dx = ex - posX;
    const dy = ey - posY;
    if (dx * dx + dy * dy <= radius * radius) {
      Health.current[eid] = Math.max(0, hp - damage);
    }
  }

  // 创建爆炸视觉效果实体
  const explosionId = addEntity(world);
  addComponent(world, Position, explosionId);
  Position.x[explosionId] = posX;
  Position.y[explosionId] = posY;

  addComponent(world, ExplosionEffect, explosionId);
  ExplosionEffect.duration[explosionId] = 0.6;
  ExplosionEffect.elapsed[explosionId] = 0;
  ExplosionEffect.radius[explosionId] = 10;
  ExplosionEffect.maxRadius[explosionId] = radius;
  ExplosionEffect.colorR[explosionId] = 255;
  ExplosionEffect.colorG[explosionId] = 120;
  ExplosionEffect.colorB[explosionId] = 0;

  addComponent(world, Category, explosionId);
  Category.value[explosionId] = CategoryVal.Effect;

  addComponent(world, Visual, explosionId);
  Visual.shape[explosionId] = ShapeVal.Circle;
  Visual.colorR[explosionId] = 255;
  Visual.colorG[explosionId] = 120;
  Visual.colorB[explosionId] = 0;
  Visual.size[explosionId] = radius * 2;
  Visual.alpha[explosionId] = 0.8;
  Visual.outline[explosionId] = 0;
  Visual.hitFlashTimer[explosionId] = 0;
  Visual.idlePhase[explosionId] = 0;
  Visual.facing[explosionId] = 1;
  Visual.bobPhase[explosionId] = 0;
  Visual.breathPhase[explosionId] = 0;
  Visual.attackAnimTimer[explosionId] = 0;
  Visual.attackAnimDuration[explosionId] = 0;
  Visual.partsId[explosionId] = 0;
};

/**
 * 单体吸血伤害 — 造成伤害并治疗来源
 * YAML: { type: steal_hp, percent: 20 }
 */
export const stealHp: RuleHandlerFn = (world, entityId, params, context) => {
  const percent = params['percent'] as number ?? 20;
  const targetId = context.sourceId;
  if (targetId === undefined) return;

  const targetHp = Health.current[targetId];
  if (targetHp === undefined || targetHp <= 0) return;

  // 计算伤害（基于参数中的固定伤害值，或实体攻击力）
  const rawDamage = (params['damage'] as number) ?? (Attack.damage?.[entityId] ?? 10);
  const actualDamage = Math.min(rawDamage, targetHp);
  Health.current[targetId] = Math.max(0, targetHp - actualDamage);

  // 治疗来源
  const healAmount = actualDamage * (percent / 100);
  if (healAmount > 0) {
    const sourceCurrent = Health.current[entityId];
    const sourceMax = Health.max[entityId];
    if (sourceCurrent !== undefined && sourceMax !== undefined) {
      Health.current[entityId] = Math.min(sourceMax, sourceCurrent + healAmount);
    }
  }
};

/**
 * 闪电链攻击 — 在目标间弹跳，伤害逐跳衰减
 * YAML: { type: chain_attack, chainCount: 4, chainRange: 150, chainDecay: 0.25 }
 */
export const chainAttack: RuleHandlerFn = (world, entityId, params, _context) => {
  const chainCount = params['chainCount'] as number ?? 3;
  const chainRange = params['chainRange'] as number ?? 150;
  const chainDecay = params['chainDecay'] as number ?? 0.25;
  const baseDamage = params['damage'] as number ?? 30;
  const targetFactions = params['targets'] as number[] ?? [FactionVal.Justice];

  const sourceX = Position.x[entityId];
  const sourceY = Position.y[entityId];
  if (sourceX === undefined || sourceY === undefined) return;

  let currentDamage = baseDamage;
  let lastX = sourceX;
  let lastY = sourceY;
  let hitIds = new Set<number>();
  hitIds.add(entityId); // 不攻击自身

  for (let hop = 0; hop < chainCount; hop++) {
    // 找最近的满足条件的实体
    let bestId: number | undefined;
    let bestDist = Infinity;

    for (let eid = 0; eid < Health.current.length; eid++) {
      if (hitIds.has(eid)) continue;

      const hp = Health.current[eid];
      if (hp === undefined || hp <= 0) continue;

      const faction = Faction.value[eid];
      if (faction === undefined || !targetFactions.includes(faction)) continue;

      const ex = Position.x[eid];
      const ey = Position.y[eid];
      if (ex === undefined || ey === undefined) continue;

      const dx = ex - lastX;
      const dy = ey - lastY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist && dist <= chainRange * chainRange) {
        bestDist = dist;
        bestId = eid;
      }
    }

    if (bestId === undefined) break;

    // 造成伤害
    Health.current[bestId] = Math.max(0, Health.current[bestId]! - currentDamage);

    // 创建闪电视觉效果
    const boltId = addEntity(world);
    addComponent(world, LightningBolt, boltId);
    LightningBolt.sourceId[boltId] = entityId;
    LightningBolt.targetId[boltId] = bestId;
    LightningBolt.damage[boltId] = currentDamage;
    LightningBolt.duration[boltId] = 0.2;
    LightningBolt.elapsed[boltId] = 0;
    LightningBolt.chainIndex[boltId] = hop;

    // 更新追踪状态
    hitIds.add(bestId);
    lastX = Position.x[bestId]!;
    lastY = Position.y[bestId]!;
    currentDamage *= (1 - chainDecay);
    if (currentDamage < 1) break;
  }
};

// ============================================================
// 近战/陷阱击退
// ============================================================

/** 方向 → X/Y 偏移映射 */
function directionToOffset(dir: number): { dx: number; dy: number } {
  switch (dir) {
    case 0: return { dx: 1, dy: 0 };   // 右
    case 1: return { dx: 0, dy: 1 };   // 下
    case 2: return { dx: -1, dy: 0 };  // 左
    case 3: return { dx: 0, dy: -1 };  // 上
    default: return { dx: 0, dy: 0 };
  }
}

/**
 * 击退 — 把目标沿指定方向推开
 * YAML: { type: push_enemy, distance: 64 }
 */
export const pushEnemy: RuleHandlerFn = (world, entityId, params, context) => {
  const targetId = context.sourceId;
  if (targetId === undefined) return;

  const distance = params['distance'] as number ?? 64;
  const rawDir = context.data?.['direction'] as number ?? 0;
  const { dx, dy } = directionToOffset(rawDir);

  const tx = Position.x[targetId];
  const ty = Position.y[targetId];
  if (tx === undefined || ty === undefined) return;

  Position.x[targetId] = tx + dx * distance;
  Position.y[targetId] = ty + dy * distance;

  // 同步 homeX/homeY 如果有 Movement 组件（用于 path-recovery）
  if (Movement.speed[targetId] !== undefined) {
    if (Movement.homeX[targetId] !== undefined) Movement.homeX[targetId] += dx * distance;
    if (Movement.homeY[targetId] !== undefined) Movement.homeY[targetId] += dy * distance;
  }
};

/**
 * 拉扯 — 把目标沿指定方向拉近
 * YAML: { type: pull_enemy, distance: 64 }
 */
export const pullEnemy: RuleHandlerFn = (world, entityId, params, context) => {
  const targetId = context.sourceId;
  if (targetId === undefined) return;

  const distance = params['distance'] as number ?? 64;
  const rawDir = context.data?.['direction'] as number ?? 0;
  const { dx, dy } = directionToOffset(rawDir);

  const tx = Position.x[targetId];
  const ty = Position.y[targetId];
  if (tx === undefined || ty === undefined) return;

  // 反向移动 = 拉近
  Position.x[targetId] = tx - dx * distance;
  Position.y[targetId] = ty - dy * distance;

  // 同步 homeX/homeY 如果有 Movement 组件
  if (Movement.speed[targetId] !== undefined) {
    if (Movement.homeX[targetId] !== undefined) Movement.homeX[targetId] -= dx * distance;
    if (Movement.homeY[targetId] !== undefined) Movement.homeY[targetId] -= dy * distance;
  }
};

// ============================================================
// 视觉反馈处理器
// ============================================================

/**
 * 受击闪白
 * YAML: { type: flash_color, color: "#ffffff", duration: 0.1 }
 */
export const flashColor: RuleHandlerFn = (world, entityId, params, _context) => {
  Visual.hitFlashTimer[entityId] = params['duration'] as number ?? 0.1;
};

/**
 * 颜色渐变过渡
 * YAML: { type: change_color, color: "#d32f2f", blend: 0.35 }
 */
export const changeColor: RuleHandlerFn = (_world, entityId, params, _context) => {
  const color = params['color'] as string ?? '#ffffff';
  const blend = (params['blend'] as number) ?? 1.0;
  const rgb = hexToRgb(color);
  const currentR = Visual.colorR[entityId] ?? 128;
  const currentG = Visual.colorG[entityId] ?? 128;
  const currentB = Visual.colorB[entityId] ?? 128;
  Visual.colorR[entityId] = Math.round(currentR * (1 - blend) + rgb.r * blend);
  Visual.colorG[entityId] = Math.round(currentG * (1 - blend) + rgb.g * blend);
  Visual.colorB[entityId] = Math.round(currentB * (1 - blend) + rgb.b * blend);
};

/**
 * 持续闪烁效果
 * YAML: { type: visual_flash_loop, alphaRange: [0.5, 1.0], speed: 8 }
 */
export const visualFlashLoop: RuleHandlerFn = (_world, _entityId, _params, _context) => {
  // 标记实体需要循环闪烁
};

// ============================================================
// 特效处理器
// ============================================================

/**
 * 播放粒子特效 — 创建实际的视觉效果实体
 * YAML: { type: play_effect, effect: destruction_particles }
 */
export const playEffect: RuleHandlerFn = (world, entityId, params, _context) => {
  const effectType = params['effect'] as string ?? 'death_basic';

  const ex = Position.x[entityId];
  const ey = Position.y[entityId];
  if (ex === undefined || ey === undefined) return;

  // 根据特效类型选择组件
  const isExplosion = effectType.startsWith('explosion_') ||
    effectType === 'destruction_particles' ||
    effectType === 'boss_rage' ||
    effectType === 'boss_death' ||
    effectType === 'boss_split' ||
    effectType === 'boss_void_enter' ||
    effectType === 'boss_phase_shift' ||
    effectType === 'boss_death_void' ||
    effectType === 'gold_burst' ||
    effectType === 'upgrade_gold' ||
    effectType === 'upgrade_energy';

  const isDeathEffect = effectType === 'death_basic' ||
    effectType === 'death_heavy' ||
    effectType === 'death_magic' ||
    effectType === 'death_soldier' ||
    effectType === 'death_boss_small' ||
    effectType === 'death_spore' ||
    effectType === 'death_split' ||
    effectType === 'ice_shatter' ||
    effectType === 'crystal_shatter' ||
    effectType === 'bat_dissolve' ||
    effectType === 'electric_spark';

  const effectId = addEntity(world);

  addComponent(world, Position, effectId);
  Position.x[effectId] = ex;
  Position.y[effectId] = ey;

  addComponent(world, Category, effectId);
  Category.value[effectId] = CategoryVal.Effect;

  addComponent(world, Visual, effectId);
  Visual.shape[effectId] = ShapeVal.Circle;
  Visual.size[effectId] = 60;
  Visual.alpha[effectId] = 0.8;
  Visual.outline[effectId] = 0;
  Visual.hitFlashTimer[effectId] = 0;
  Visual.idlePhase[effectId] = 0;
  Visual.facing[effectId] = 1;
  Visual.bobPhase[effectId] = 0;
  Visual.breathPhase[effectId] = 0;
  Visual.attackAnimTimer[effectId] = 0;
  Visual.attackAnimDuration[effectId] = 0;
  Visual.partsId[effectId] = 0;

  if (isExplosion) {
    addComponent(world, ExplosionEffect, effectId);
    // Per-effect-type customization
    let eR = 255, eG = 150, eB = 30;
    let eDur = 0.5, eMaxR = 60, eSize = 120;
    switch (effectType) {
      case 'boss_void_enter':
        eR = 26; eG = 0; eB = 51; eDur = 1.5; eMaxR = 200; eSize = 400;
        break;
      case 'boss_phase_shift':
        eR = 79; eG = 195; eB = 247; eDur = 1.0; eMaxR = 150; eSize = 300;
        break;
      case 'boss_death_void':
        eR = 74; eG = 20; eB = 140; eDur = 2.0; eMaxR = 300; eSize = 600;
        break;
      case 'boss_rage':
        eR = 200; eG = 50; eB = 50; eDur = 0.8; eMaxR = 120; eSize = 240;
        break;
      case 'boss_death':
        eR = 255; eG = 200; eB = 50; eDur = 1.0; eMaxR = 100; eSize = 200;
        break;
      case 'boss_split':
        eR = 100; eG = 220; eB = 80; eDur = 0.5; eMaxR = 60; eSize = 120;
        break;
    }
    ExplosionEffect.duration[effectId] = eDur;
    ExplosionEffect.elapsed[effectId] = 0;
    ExplosionEffect.radius[effectId] = 10;
    ExplosionEffect.maxRadius[effectId] = eMaxR;
    ExplosionEffect.colorR[effectId] = eR;
    ExplosionEffect.colorG[effectId] = eG;
    ExplosionEffect.colorB[effectId] = eB;
    Visual.colorR[effectId] = eR;
    Visual.colorG[effectId] = eG;
    Visual.colorB[effectId] = eB;
    Visual.size[effectId] = eSize;
  } else if (isDeathEffect) {
    addComponent(world, DeathEffect, effectId);
    // Per-effect-type customization
    let dR = 180, dG = 180, dB = 180, dDur = 0.5;
    switch (effectType) {
      case 'death_boss_small':
        dR = 141; dG = 110; dB = 99; dDur = 0.6;
        break;
      case 'death_spore':
        dR = 165; dG = 214; dB = 167; dDur = 1.0;
        break;
      case 'death_split':
        dR = 255; dG = 112; dB = 67; dDur = 0.5;
        break;
    }
    DeathEffect.duration[effectId] = dDur;
    DeathEffect.elapsed[effectId] = 0;
    Visual.colorR[effectId] = dR;
    Visual.colorG[effectId] = dG;
    Visual.colorB[effectId] = dB;
  } else {
    // 默认使用 ExplosionEffect（光效）
    addComponent(world, ExplosionEffect, effectId);
    ExplosionEffect.duration[effectId] = 0.3;
    ExplosionEffect.elapsed[effectId] = 0;
    ExplosionEffect.radius[effectId] = 5;
    ExplosionEffect.maxRadius[effectId] = 40;
    ExplosionEffect.colorR[effectId] = 200;
    ExplosionEffect.colorG[effectId] = 200;
    ExplosionEffect.colorB[effectId] = 100;
    Visual.colorR[effectId] = 200;
    Visual.colorG[effectId] = 200;
    Visual.colorB[effectId] = 100;
  }
};

/**
 * 生成弹道
 * YAML: { type: spawn_projectile, projectile: arrow }
 */
export const spawnProjectile: RuleHandlerFn = (_world, _entityId, _params, _context) => {
  // 由 AttackSystem 处理弹道生成
};

// ============================================================
// 音效处理器
// ============================================================

/**
 * 播放音效
 * YAML: { type: play_sound, sound: tower_arrow }
 */
export const playSound: RuleHandlerFn = (_world, _entityId, params, _context) => {
  const sound = params['sound'];
  if (typeof sound !== 'string') return;
  if (sound === 'SFX_BOSS_SPAWN') {
    Sound.play(getBossEnterSfx(Boss.bossType[_entityId]));
    return;
  }
  if (sound === 'SFX_BOSS_DIE') {
    Sound.play(getBossDeathSfx(Boss.bossType[_entityId]));
    return;
  }
  if (sound === 'SFX_ENEMY_SPAWN') {
    Sound.play(getEnemySpawnSfx(_entityId));
    return;
  }
  if (sound === 'SFX_ENEMY_DIE') {
    Sound.play(getEnemyDeathSfx(_entityId));
    return;
  }
  const key = normalizeSfxKey(sound);
  if (!key) return;
  Sound.play(key);
};

// ============================================================
// 经济相关处理器
// ============================================================

/**
 * 掉落金币
 * YAML: { type: drop_gold }
 */
export const dropGold: RuleHandlerFn = (_world, entityId, _params, _context) => {
  const reward = UnitTag.rewardGold[entityId];
  if (reward !== undefined && reward > 0 && goldCallback) {
    goldCallback(reward);
  }
};

/**
 * 随机掉落金币（宝箱）
 * YAML: { type: drop_gold_random, min: 50, max: 100 }
 */
export const dropGoldRandom: RuleHandlerFn = (_world, _entityId, params, _context) => {
  const min = params['min'] as number ?? 0;
  const max = params['max'] as number ?? 0;
  const amount = getGlobalRandom().drop.nextFloat(min, max);
  if (goldCallback) {
    goldCallback(Math.floor(amount));
  }
};

// ============================================================
// 状态相关处理器
// ============================================================

/**
 * 世界暂停
 * YAML: { type: pause_world, duration: 0.3 }
 */
export const pauseWorld: RuleHandlerFn = (_world, _entityId, _params, _context) => {
  // 全局暂停标记由 Game 管理，此处留空
};

/**
 * Boss 进入二阶段
 * YAML: { type: enter_phase2 }
 */
export const enterPhase2: RuleHandlerFn = (world, entityId, _params, _context) => {
  // 设置 Boss.phase = 2
  if (Boss.phase[entityId] !== undefined) {
    Boss.phase[entityId] = 2;
  }

  // 创建视觉特效
  const ex = Position.x[entityId];
  const ey = Position.y[entityId];
  if (ex === undefined || ey === undefined) return;

  const effectId = addEntity(world);
  addComponent(world, Position, effectId);
  Position.x[effectId] = ex;
  Position.y[effectId] = ey;

  addComponent(world, ExplosionEffect, effectId);
  ExplosionEffect.duration[effectId] = 1.0;
  ExplosionEffect.elapsed[effectId] = 0;
  ExplosionEffect.radius[effectId] = 20;
  ExplosionEffect.maxRadius[effectId] = 120;
  ExplosionEffect.colorR[effectId] = 200;
  ExplosionEffect.colorG[effectId] = 50;
  ExplosionEffect.colorB[effectId] = 50;

  addComponent(world, Category, effectId);
  Category.value[effectId] = CategoryVal.Effect;

  addComponent(world, Visual, effectId);
  Visual.shape[effectId] = ShapeVal.Circle;
  Visual.colorR[effectId] = 200;
  Visual.colorG[effectId] = 50;
  Visual.colorB[effectId] = 50;
  Visual.size[effectId] = 240;
  Visual.alpha[effectId] = 0.6;
  Visual.outline[effectId] = 0;
  Visual.hitFlashTimer[effectId] = 0;
  Visual.idlePhase[effectId] = 0;
  Visual.facing[effectId] = 1;
  Visual.bobPhase[effectId] = 0;
  Visual.breathPhase[effectId] = 0;
  Visual.attackAnimTimer[effectId] = 0;
  Visual.attackAnimDuration[effectId] = 0;
  Visual.partsId[effectId] = 0;
};

/**
 * 分裂为子单位 (Slime Boss)
 * YAML: { type: split_into, count: 2, unitType: boss_beast_spawn }
 */
export const splitInto: RuleHandlerFn = (world, entityId, params, _context) => {
  const count = params['count'] as number ?? 2;
  const radius = params['radius'] as number ?? 40;

  const parentX = Position.x[entityId];
  const parentY = Position.y[entityId];
  if (parentX === undefined || parentY === undefined) return;

  const parentFaction = Faction.value[entityId] ?? FactionVal.Evil;
  const childHp = (params['hp'] as number) ?? 100;
  const childAtk = (params['atk'] as number) ?? 5;

  for (let i = 0; i < count; i++) {
    // 在半径内随机分布
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = Math.random() * radius;
    const cx = parentX + Math.cos(angle) * dist;
    const cy = parentY + Math.sin(angle) * dist;

    const childId = addEntity(world);

    // Position
    addComponent(world, Position, childId);
    Position.x[childId] = cx;
    Position.y[childId] = cy;

    // Health
    addComponent(world, Health, childId);
    Health.current[childId] = childHp;
    Health.max[childId] = childHp;
    Health.armor[childId] = 0;
    Health.magicResist[childId] = 0;

    // Faction
    addComponent(world, Faction, childId);
    Faction.value[childId] = parentFaction;

    // UnitTag
    addComponent(world, UnitTag, childId);
    UnitTag.isEnemy[childId] = parentFaction === FactionVal.Evil || parentFaction === FactionVal.Chaos ? 1 : 0;
    UnitTag.isBoss[childId] = 0;
    UnitTag.isRanged[childId] = 0;
    UnitTag.canAttackBuildings[childId] = 0;
    UnitTag.rewardGold[childId] = 10;
    UnitTag.rewardEnergy[childId] = 0;
    UnitTag.popCost[childId] = 0;
    UnitTag.cost[childId] = 0;
    UnitTag.atk[childId] = childAtk;
    UnitTag.level[childId] = 1;
    UnitTag.maxLevel[childId] = 1;
    UnitTag.totalInvested[childId] = 0;
    UnitTag.unitTypeNum[childId] = 0;

    // Attack
    addComponent(world, Attack, childId);
    Attack.damage[childId] = childAtk;
    Attack.attackSpeed[childId] = 1;
    Attack.range[childId] = 30;
    Attack.alertRange[childId] = 100;
    Attack.damageType[childId] = 0;
    Attack.cooldownTimer[childId] = 0;
    Attack.targetId[childId] = 0;
    Attack.targetSelection[childId] = 0;
    Attack.attackMode[childId] = 0;
    Attack.isRanged[childId] = 0;
    Attack.canTargetLowAir[childId] = 0;
    Attack.splashRadius[childId] = 0;
    Attack.chainCount[childId] = 0;
    Attack.chainRange[childId] = 0;
    Attack.chainDecay[childId] = 0;
    Attack.drainPercent[childId] = 0;
    Attack.tauntCapacity[childId] = 0;
    Attack.attackerCount[childId] = 0;

    // Movement
    addComponent(world, Movement, childId);
    Movement.speed[childId] = 60;
    Movement.currentSpeed[childId] = 60;
    Movement.targetX[childId] = cx;
    Movement.targetY[childId] = cy;
    Movement.pathIndex[childId] = 0;
    Movement.progress[childId] = 0;
    Movement.moveMode[childId] = MoveModeVal.ChaseTarget;
    Movement.homeX[childId] = cx;
    Movement.homeY[childId] = cy;
    Movement.moveRange[childId] = 500;

    // Visual
    addComponent(world, Visual, childId);
    Visual.shape[childId] = ShapeVal.Circle;
    Visual.colorR[childId] = 100;
    Visual.colorG[childId] = 220;
    Visual.colorB[childId] = 80;
    Visual.size[childId] = 20;
    Visual.alpha[childId] = 1;
    Visual.outline[childId] = 1;
    Visual.hitFlashTimer[childId] = 0;
    Visual.idlePhase[childId] = Math.random();
    Visual.facing[childId] = 1;
    Visual.bobPhase[childId] = 0;
    Visual.breathPhase[childId] = Math.random() * Math.PI * 2;
    Visual.attackAnimTimer[childId] = 0;
    Visual.attackAnimDuration[childId] = 0;
    Visual.partsId[childId] = 0;
  }
};

/**
 * 召唤单位 (路西法召唤骷髅)
 * YAML: { type: spawn_unit, unitId: "enemy_skeleton", count: 3, maxCount: 15 }
 */
export const spawnUnit: RuleHandlerFn = (world, entityId, params, _context) => {
  const count = params['count'] as number ?? 1;
  const maxCount = params['maxCount'] as number ?? 15;

  const sourceX = Position.x[entityId];
  const sourceY = Position.y[entityId];
  if (sourceX === undefined || sourceY === undefined) return;

  // 统计已有召唤物数量
  let currentSpawns = 0;
  for (let eid = 0; eid < UnitTag.isEnemy.length; eid++) {
    // Chaos 阵营 + 是敌人 = 召唤物
    if (
      UnitTag.isEnemy[eid] === 1 &&
      Faction.value[eid] === FactionVal.Chaos &&
      eid !== entityId
    ) {
      currentSpawns++;
    }
  }

  const allowedToSpawn = Math.max(0, maxCount - currentSpawns);
  const actualCount = Math.min(count, allowedToSpawn);

  const unitHp = (params['hp'] as number) ?? 80;
  const unitAtk = (params['atk'] as number) ?? 12;
  const unitSpeed = (params['speed'] as number) ?? 50;

  for (let i = 0; i < actualCount; i++) {
    const angle = (i / Math.max(1, actualCount)) * Math.PI * 2;
    const spawnDist = (params['spawnRadius'] as number) ?? 50;
    const sx = sourceX + Math.cos(angle) * spawnDist;
    const sy = sourceY + Math.sin(angle) * spawnDist;

    const spawnedId = addEntity(world);

    // Position
    addComponent(world, Position, spawnedId);
    Position.x[spawnedId] = sx;
    Position.y[spawnedId] = sy;

    // Health
    addComponent(world, Health, spawnedId);
    Health.current[spawnedId] = unitHp;
    Health.max[spawnedId] = unitHp;
    Health.armor[spawnedId] = 0;
    Health.magicResist[spawnedId] = 0;

    // Faction — Chaos
    addComponent(world, Faction, spawnedId);
    Faction.value[spawnedId] = FactionVal.Chaos;

    // UnitTag
    addComponent(world, UnitTag, spawnedId);
    UnitTag.isEnemy[spawnedId] = 1;
    UnitTag.isBoss[spawnedId] = 0;
    UnitTag.isRanged[spawnedId] = 0;
    UnitTag.canAttackBuildings[spawnedId] = 0;
    UnitTag.rewardGold[spawnedId] = 5;
    UnitTag.rewardEnergy[spawnedId] = 0;
    UnitTag.popCost[spawnedId] = 0;
    UnitTag.cost[spawnedId] = 0;
    UnitTag.atk[spawnedId] = unitAtk;
    UnitTag.level[spawnedId] = 1;
    UnitTag.maxLevel[spawnedId] = 1;
    UnitTag.totalInvested[spawnedId] = 0;
    UnitTag.unitTypeNum[spawnedId] = 0;

    // Attack
    addComponent(world, Attack, spawnedId);
    Attack.damage[spawnedId] = unitAtk;
    Attack.attackSpeed[spawnedId] = 1;
    Attack.range[spawnedId] = 30;
    Attack.alertRange[spawnedId] = 120;
    Attack.damageType[spawnedId] = 0;
    Attack.cooldownTimer[spawnedId] = 0;
    Attack.targetId[spawnedId] = 0;
    Attack.targetSelection[spawnedId] = 0;
    Attack.attackMode[spawnedId] = 0;
    Attack.isRanged[spawnedId] = 0;
    Attack.canTargetLowAir[spawnedId] = 0;
    Attack.splashRadius[spawnedId] = 0;
    Attack.chainCount[spawnedId] = 0;
    Attack.chainRange[spawnedId] = 0;
    Attack.chainDecay[spawnedId] = 0;
    Attack.drainPercent[spawnedId] = 0;
    Attack.tauntCapacity[spawnedId] = 0;
    Attack.attackerCount[spawnedId] = 0;

    // Movement
    addComponent(world, Movement, spawnedId);
    Movement.speed[spawnedId] = unitSpeed;
    Movement.currentSpeed[spawnedId] = unitSpeed;
    Movement.targetX[spawnedId] = sx;
    Movement.targetY[spawnedId] = sy;
    Movement.pathIndex[spawnedId] = 0;
    Movement.progress[spawnedId] = 0;
    Movement.moveMode[spawnedId] = MoveModeVal.ChaseTarget;
    Movement.homeX[spawnedId] = sx;
    Movement.homeY[spawnedId] = sy;
    Movement.moveRange[spawnedId] = 600;

    // Visual
    addComponent(world, Visual, spawnedId);
    Visual.shape[spawnedId] = ShapeVal.Triangle;
    Visual.colorR[spawnedId] = 150;
    Visual.colorG[spawnedId] = 60;
    Visual.colorB[spawnedId] = 200;
    Visual.size[spawnedId] = 18;
    Visual.alpha[spawnedId] = 1;
    Visual.outline[spawnedId] = 1;
    Visual.hitFlashTimer[spawnedId] = 0;
    Visual.idlePhase[spawnedId] = Math.random();
    Visual.facing[spawnedId] = 1;
    Visual.bobPhase[spawnedId] = 0;
    Visual.breathPhase[spawnedId] = Math.random() * Math.PI * 2;
    Visual.attackAnimTimer[spawnedId] = 0;
    Visual.attackAnimDuration[spawnedId] = 0;
    Visual.partsId[spawnedId] = 0;
  }
};

/**
 * 通用 Buff 应用 — 通过注册的回调函数调用 BuffSystem.addBuff
 * YAML: { type: apply_buff, buffId: "ice_slow", attribute: "speed", value: -30, duration: 3, isPercent: true }
 */
export const applyBuff: RuleHandlerFn = (world, entityId, params, context) => {
  if (buffApplier === null) return;

  const targetId = context.sourceId;
  if (targetId === undefined || !entityExists(world, targetId)) return;

  const buffData: BuffData = {
    id: params['buffId'] as string ?? 'unknown_buff',
    attribute: params['attribute'] as string ?? '',
    value: params['value'] as number ?? 0,
    isPercent: params['isPercent'] as boolean ?? false,
    duration: params['duration'] as number ?? 0,
    stacks: 1,
    maxStacks: params['maxStacks'] as number ?? 5,
    sourceId: entityId,
  };

  buffApplier(targetId, entityId, buffData);
};

// ============================================================
// 建筑相关处理器
// ============================================================

/**
 * 留下废墟
 * YAML: { type: leave_ruins }
 */
export const leaveRuins: RuleHandlerFn = (_world, _entityId, _params, _context) => {
  // 在实体位置创建废墟装饰实体
};

// ============================================================
// Boss 阶段转换 & 数据驱动处理器
// ============================================================

/**
 * 属性修改 — Boss阶段转换时修改属性
 * YAML: { type: stat_change, speedBonus: 0.3, attackSpeedBonus: 0.5, atkOverride: 80 }
 */
export const statChange: RuleHandlerFn = (_world, entityId, params, _context) => {
  // 百分比加成
  if (params['speedBonus'] !== undefined) {
    const current = Movement.speed[entityId] ?? 0;
    Movement.speed[entityId] = current * (1 + (params['speedBonus'] as number));
  }
  if (params['attackSpeedBonus'] !== undefined) {
    const current = Attack.attackSpeed[entityId] ?? 0;
    Attack.attackSpeed[entityId] = current * (1 + (params['attackSpeedBonus'] as number));
  }
  // 绝对值覆盖
  if (params['hpSet'] !== undefined) {
    Health.max[entityId] = params['hpSet'] as number;
    Health.current[entityId] = params['hpSet'] as number;
  }
  if (params['atkOverride'] !== undefined) {
    Attack.damage[entityId] = params['atkOverride'] as number;
  }
  if (params['armorOverride'] !== undefined) {
    Health.armor[entityId] = params['armorOverride'] as number;
  }
  if (params['mrOverride'] !== undefined) {
    Health.magicResist[entityId] = params['mrOverride'] as number;
  }
  if (params['speedOverride'] !== undefined) {
    Movement.speed[entityId] = params['speedOverride'] as number;
  }
  if (params['attackSpeedOverride'] !== undefined) {
    Attack.attackSpeed[entityId] = params['attackSpeedOverride'] as number;
  }
  if (params['rangeOverride'] !== undefined) {
    Attack.range[entityId] = params['rangeOverride'] as number;
  }
  if (params['damageTypeOverride'] !== undefined) {
    Attack.damageType[entityId] = params['damageTypeOverride'] === 'magic'
      ? DamageTypeVal.Magic : DamageTypeVal.Physical;
  }
};

/**
 * Boss 进入三阶段
 * YAML: { type: enter_phase3 }
 */
export const enterPhase3: RuleHandlerFn = (world, entityId, _params, _context) => {
  if (Boss.phase[entityId] !== undefined) {
    Boss.phase[entityId] = 3;
  }
  // 紫色爆炸特效
  const ex = Position.x[entityId];
  const ey = Position.y[entityId];
  if (ex === undefined || ey === undefined) return;

  const effectId = addEntity(world);
  addComponent(world, Position, effectId);
  Position.x[effectId] = ex;
  Position.y[effectId] = ey;

  addComponent(world, ExplosionEffect, effectId);
  ExplosionEffect.duration[effectId] = 1.2;
  ExplosionEffect.elapsed[effectId] = 0;
  ExplosionEffect.radius[effectId] = 20;
  ExplosionEffect.maxRadius[effectId] = 150;
  ExplosionEffect.colorR[effectId] = 150;
  ExplosionEffect.colorG[effectId] = 50;
  ExplosionEffect.colorB[effectId] = 200;

  addComponent(world, Category, effectId);
  Category.value[effectId] = CategoryVal.Effect;

  addComponent(world, Visual, effectId);
  Visual.shape[effectId] = ShapeVal.Circle;
  Visual.colorR[effectId] = 150;
  Visual.colorG[effectId] = 50;
  Visual.colorB[effectId] = 200;
  Visual.size[effectId] = 300;
  Visual.alpha[effectId] = 0.6;
  Visual.outline[effectId] = 0;
  Visual.hitFlashTimer[effectId] = 0;
  Visual.idlePhase[effectId] = 0;
  Visual.facing[effectId] = 1;
  Visual.bobPhase[effectId] = 0;
  Visual.breathPhase[effectId] = 0;
  Visual.attackAnimTimer[effectId] = 0;
  Visual.attackAnimDuration[effectId] = 0;
  Visual.partsId[effectId] = 0;
};

/**
 * 启动自爆倒计时
 * YAML: { type: start_timer, timerId: self_destruct, duration: 20 }
 */
export const startTimer: RuleHandlerFn = (_world, entityId, params, _context) => {
  const duration = (params['duration'] as number) ?? 20;
  Boss.selfDestructTimer[entityId] = duration;
};

/** 胜利回调 — 由 Game 注册 */
let victoryCallback: (() => void) | null = null;
export function setVictoryCallback(fn: () => void): void {
  victoryCallback = fn;
}

/**
 * 最终胜利 — 击杀最终Boss触发
 * YAML: { type: final_victory }
 */
export const finalVictory: RuleHandlerFn = (_world, _entityId, _params, _context) => {
  victoryCallback?.();
};

/**
 * 释放孢子云 — e_sporeling死亡时释放增益云
 * YAML: { type: release_spore_cloud, radius: 80, duration: 4, buffHpPct: 30, buffSpdPct: 20, buffAtkPct: 20 }
 */
export const releaseSporeCloud: RuleHandlerFn = (world, entityId, params, _context) => {
  const radius = (params['radius'] as number) ?? 80;
  const duration = (params['duration'] as number) ?? 4;
  const buffSpdPct = (params['buffSpdPct'] as number) ?? 0;
  const buffAtkPct = (params['buffAtkPct'] as number) ?? 0;

  const posX = Position.x[entityId];
  const posY = Position.y[entityId];
  if (posX === undefined || posY === undefined) return;

  // 给范围内友军施加增益
  for (let eid = 0; eid < Movement.speed.length; eid++) {
    const hp = Health.current[eid];
    if (hp === undefined || hp <= 0) continue;
    if (Faction.value[eid] !== FactionVal.Evil) continue;

    const ex = Position.x[eid];
    const ey = Position.y[eid];
    if (ex === undefined || ey === undefined) continue;

    const dx = ex - posX;
    const dy = ey - posY;
    if (dx * dx + dy * dy <= radius * radius) {
      if (buffSpdPct > 0 && Movement.speed[eid] !== undefined) {
        Movement.speed[eid] = Movement.speed[eid]! * (1 + buffSpdPct / 100);
      }
      if (buffAtkPct > 0 && Attack.damage[eid] !== undefined) {
        Attack.damage[eid] = Math.round(Attack.damage[eid]! * (1 + buffAtkPct / 100));
      }
    }
  }

  // 绿色云雾特效
  const effectId = addEntity(world);
  addComponent(world, Position, effectId);
  Position.x[effectId] = posX;
  Position.y[effectId] = posY;
  addComponent(world, Category, effectId);
  Category.value[effectId] = CategoryVal.Effect;
  addComponent(world, ExplosionEffect, effectId);
  ExplosionEffect.duration[effectId] = duration;
  ExplosionEffect.elapsed[effectId] = 0;
  ExplosionEffect.radius[effectId] = 10;
  ExplosionEffect.maxRadius[effectId] = radius;
  ExplosionEffect.colorR[effectId] = 165;
  ExplosionEffect.colorG[effectId] = 214;
  ExplosionEffect.colorB[effectId] = 167;
  addComponent(world, Visual, effectId);
  Visual.shape[effectId] = ShapeVal.Circle;
  Visual.colorR[effectId] = 165;
  Visual.colorG[effectId] = 214;
  Visual.colorB[effectId] = 167;
  Visual.size[effectId] = radius * 2;
  Visual.alpha[effectId] = 0.5;
  Visual.outline[effectId] = 0;
  Visual.hitFlashTimer[effectId] = 0;
  Visual.idlePhase[effectId] = 0;
  Visual.facing[effectId] = 1;
  Visual.bobPhase[effectId] = 0;
  Visual.breathPhase[effectId] = 0;
  Visual.attackAnimTimer[effectId] = 0;
  Visual.attackAnimDuration[effectId] = 0;
  Visual.partsId[effectId] = 0;
};

/**
 * 生成传送门 — e_void_blinker死亡时生成传送门
 * YAML: { type: spawn_portal, duration: 8, spawnUnit: e_void_thrall, spawnInterval: 2 }
 */
export const spawnPortal: RuleHandlerFn = (world, entityId, params, _context) => {
  const posX = Position.x[entityId];
  const posY = Position.y[entityId];
  if (posX === undefined || posY === undefined) return;

  // 创建传送门视觉效果（持续存在的紫色光环）
  const portalId = addEntity(world);
  addComponent(world, Position, portalId);
  Position.x[portalId] = posX;
  Position.y[portalId] = posY;
  addComponent(world, Category, portalId);
  Category.value[portalId] = CategoryVal.Effect;
  addComponent(world, ExplosionEffect, portalId);
  ExplosionEffect.duration[portalId] = (params['duration'] as number) ?? 8;
  ExplosionEffect.elapsed[portalId] = 0;
  ExplosionEffect.radius[portalId] = 20;
  ExplosionEffect.maxRadius[portalId] = 40;
  ExplosionEffect.colorR[portalId] = 100;
  ExplosionEffect.colorG[portalId] = 20;
  ExplosionEffect.colorB[portalId] = 160;
  addComponent(world, Visual, portalId);
  Visual.shape[portalId] = ShapeVal.Circle;
  Visual.colorR[portalId] = 100;
  Visual.colorG[portalId] = 20;
  Visual.colorB[portalId] = 160;
  Visual.size[portalId] = 80;
  Visual.alpha[portalId] = 0.6;
  Visual.outline[portalId] = 1;
  Visual.hitFlashTimer[portalId] = 0;
  Visual.idlePhase[portalId] = 0;
  Visual.facing[portalId] = 1;
  Visual.bobPhase[portalId] = 0;
  Visual.breathPhase[portalId] = 0;
  Visual.attackAnimTimer[portalId] = 0;
  Visual.attackAnimDuration[portalId] = 0;
  Visual.partsId[portalId] = 0;
};

// ============================================================
// 所有预定义处理器的注册表
// ============================================================

/** 预定义处理器映射表 */
export const BUILTIN_HANDLERS: Record<string, RuleHandlerFn> = {
  // 战斗
  'deal_aoe_damage': dealAoeDamage,
  'deal_damage': dealDamage,
  'explode': explode,
  'steal_hp': stealHp,
  'chain_attack': chainAttack,
  // 近战/陷阱位移
  'push_enemy': pushEnemy,
  'pull_enemy': pullEnemy,
  // 视觉
  'flash_color': flashColor,
  'change_color': changeColor,
  'visual_flash_loop': visualFlashLoop,
  'visual_flash_bright': flashColor,  // same as flashColor
  'visual_dim': changeColor,          // dim = alpha reduction
  'visual_pulse': visualFlashLoop,    // pulse effect
  // 特效
  'play_effect': playEffect,
  'spawn_projectile': spawnProjectile,
  // 音效
  'play_sound': playSound,
  // 经济
  'drop_gold': dropGold,
  'drop_gold_random': dropGoldRandom,
  // 状态
  'pause_world': pauseWorld,
  'enter_phase2': enterPhase2,
  'enter_phase3': enterPhase3,
  'split_into': splitInto,
  'spawn_unit': spawnUnit,
  'apply_buff': applyBuff,
  'stat_change': statChange,
  'start_timer': startTimer,
  'final_victory': finalVictory,
  'release_spore_cloud': releaseSporeCloud,
  'spawn_portal': spawnPortal,
  // 建筑
  'leave_ruins': leaveRuins,
  // Boss血条
  'hp_bar_boss': playEffect,
};
