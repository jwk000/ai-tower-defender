// ============================================================
// factionUtils 测试 — 4阵营交互规则矩阵
// design/02-gameplay.md §6.2
// ============================================================

import { describe, it, expect } from 'vitest';
import { areHostile, canAttackFaction, areFriendly, getHostileFactions } from './factionUtils.js';
import { FactionVal } from '../core/components.js';

describe('factionUtils — 阵营交互规则', () => {
  const J = FactionVal.Justice;  // 0
  const E = FactionVal.Evil;     // 1
  const C = FactionVal.Chaos;    // 2
  const N = FactionVal.Neutral;  // 3

  describe('areHostile — 敌对判定', () => {
    it('Justice vs Evil: 敌对', () => {
      expect(areHostile(J, E)).toBe(true);
    });

    it('Justice vs Chaos: 敌对', () => {
      expect(areHostile(J, C)).toBe(true);
    });

    it('Evil vs Chaos: 敌对', () => {
      expect(areHostile(E, C)).toBe(true);
    });

    it('Chaos vs Chaos: 敌对（混乱内斗）', () => {
      expect(areHostile(C, C)).toBe(true);
    });

    it('Justice vs Justice: 友好（同阵营）', () => {
      expect(areHostile(J, J)).toBe(false);
    });

    it('Evil vs Evil: 友好（同阵营）', () => {
      expect(areHostile(E, E)).toBe(false);
    });

    it('Neutral vs Justice: 不可攻击', () => {
      expect(areHostile(N, J)).toBe(false);
    });

    it('Justice vs Neutral: 不可攻击', () => {
      expect(areHostile(J, N)).toBe(false);
    });

    it('Neutral vs Evil: 不可攻击', () => {
      expect(areHostile(N, E)).toBe(false);
    });

    it('Neutral vs Chaos: 不可攻击', () => {
      expect(areHostile(N, C)).toBe(false);
    });

    it('Neutral vs Neutral: 友好', () => {
      expect(areHostile(N, N)).toBe(false);
    });
  });

  describe('areHostile — 对称性', () => {
    const combos: [number, number][] = [
      [J, E], [J, C], [J, J], [J, N],
      [E, C], [E, E], [E, N],
      [C, C], [C, N],
      [N, N],
    ];
    for (const [a, b] of combos) {
      it(`areHostile(${a}, ${b}) === areHostile(${b}, ${a})`, () => {
        expect(areHostile(a, b)).toBe(areHostile(b, a));
      });
    }
  });

  describe('canAttackFaction — 与 areHostile 一致', () => {
    it('canAttackFaction 结果与 areHostile 相同', () => {
      expect(canAttackFaction(J, E)).toBe(areHostile(J, E));
      expect(canAttackFaction(J, C)).toBe(areHostile(J, C));
      expect(canAttackFaction(J, J)).toBe(areHostile(J, J));
      expect(canAttackFaction(J, N)).toBe(areHostile(J, N));
    });
  });

  describe('areFriendly — 友好判定', () => {
    it('同阵营为友好', () => {
      expect(areFriendly(J, J)).toBe(true);
      expect(areFriendly(E, E)).toBe(true);
    });

    it('与Neutral为友好', () => {
      expect(areFriendly(J, N)).toBe(true);
      expect(areFriendly(E, N)).toBe(true);
      expect(areFriendly(C, N)).toBe(true);
    });

    it('敌对阵营不为友好', () => {
      expect(areFriendly(J, E)).toBe(false);
      expect(areFriendly(J, C)).toBe(false);
      expect(areFriendly(E, C)).toBe(false);
    });
  });

  describe('getHostileFactions — 敌对阵营列表', () => {
    it('Justice的敌对阵营: Evil + Chaos', () => {
      const result = getHostileFactions(J);
      expect(result).toContain(E);
      expect(result).toContain(C);
      expect(result).not.toContain(J);
      expect(result).not.toContain(N);
    });

    it('Evil的敌对阵营: Justice + Chaos', () => {
      const result = getHostileFactions(E);
      expect(result).toContain(J);
      expect(result).toContain(C);
      expect(result).not.toContain(E);
      expect(result).not.toContain(N);
    });

    it('Chaos的敌对阵营: Justice + Evil', () => {
      const result = getHostileFactions(C);
      expect(result).toContain(J);
      expect(result).toContain(E);
      expect(result).not.toContain(C);
      expect(result).not.toContain(N);
    });

    it('Neutral: 无敌对阵营', () => {
      expect(getHostileFactions(N)).toEqual([]);
    });
  });
});
