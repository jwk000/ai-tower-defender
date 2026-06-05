// ============================================================
// Tower Defender — Faction Utility Functions (v4.0)
//
// 4阵营交互规则矩阵（design/02-gameplay.md §6.2）:
//   - 同阵营: 友好，不可攻击
//   - Justice vs Evil: 敌对
//   - Justice vs Chaos: 敌对
//   - Evil vs Chaos: 敌对
//   - Chaos vs Chaos: 敌对（混乱互相攻击）
//   - 任何 vs Neutral: 不可攻击中立
//
// 使用方式:
//   import { areHostile } from '../utils/factionUtils.js';
//   if (areHostile(attackerFaction, targetFaction)) { ... }
// ============================================================

import { FactionVal } from '../core/components.js';

/**
 * 检查两个阵营是否互相敌对。
 * 对称关系: areHostile(a, b) === areHostile(b, a)
 */
export function areHostile(factionA: number, factionB: number): boolean {
  // 中立阵营不可攻击，也不可被攻击
  if (factionA === FactionVal.Neutral || factionB === FactionVal.Neutral) {
    return false;
  }

  // 同阵营友好（例外：Chaos vs Chaos 为敌对——混乱内斗）
  // design/02-gameplay.md §6.2: "混乱vs混乱 互相视为敌方，可以攻击"
  if (factionA === factionB) {
    return factionA === FactionVal.Chaos;
  }

  // 不同非中立阵营: 全部敌对
  // Justice(0)-Evil(1), Justice(0)-Chaos(2), Evil(1)-Chaos(2) 皆敌对
  return true;
}

/**
 * 检查 attacker 是否可以攻击 target。
 * 非对称版本（未来可能的扩展点，如单向敌对）
 */
export function canAttackFaction(attackerFaction: number, targetFaction: number): boolean {
  return areHostile(attackerFaction, targetFaction);
}

/**
 * 检查两个阵营是否友好（同阵营或任意一方为中立）。
 */
export function areFriendly(factionA: number, factionB: number): boolean {
  return !areHostile(factionA, factionB);
}

/**
 * 获取某阵营对应的敌方阵营列表（不含自身）。
 * 用于查询时预过滤。
 */
export function getHostileFactions(faction: number): number[] {
  if (faction === FactionVal.Neutral) {
    return [];
  }
  // 所有非中立的非自身阵营
  return [FactionVal.Justice, FactionVal.Evil, FactionVal.Chaos]
    .filter(f => f !== faction);
}
