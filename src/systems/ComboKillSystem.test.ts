/**
 * 连杀系统测试 — ComboKillSystem
 *
 * 设计: 用户需求（combo连杀设计）
 * - 5秒内连续击杀触发连杀
 * - 连杀 ≥ 2 时金币掉落 1.2x
 * - 连杀飘字在连杀 ≥ 2 时生成
 * - 5秒窗口超时后连杀重置
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../core/World.js';
import { ComboKillSystem } from './ComboKillSystem.js';
import { Position, ComboFloatingText, UnitTag, defineQuery } from '../core/components.js';

const comboTextQuery = defineQuery([Position, ComboFloatingText]);

/** 创建测试用的最小游戏世界 */
function createTestWorld(): TowerWorld {
  const world = new TowerWorld();
  return world;
}

/** 在 world 中创建一个测试敌人实体 */
function createEnemy(world: TowerWorld, x: number, y: number, rewardGold: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    isElite: 0,
    isBoss: 0,
    isRanged: 0,
    canAttackBuildings: 0,
    rewardGold,
    rewardEnergy: 0,
    popCost: 0,
    cost: 0,
    atk: 0,
    level: 1,
    maxLevel: 1,
    totalInvested: 0,
    unitTypeNum: 0,
  });
  return eid;
}

describe('ComboKillSystem', () => {
  let system: ComboKillSystem;
  let world: TowerWorld;

  beforeEach(() => {
    system = new ComboKillSystem();
    world = createTestWorld();
  });

  describe('连杀计数', () => {
    it('首次击杀：连杀计数为 1，金币倍率 1.0', () => {
      const enemyId = createEnemy(world, 100, 200, 10);

      // 模拟时间推进
      system.update(world, 1.0);

      const multiplier = system.notifyEnemyKilled(enemyId, world);
      expect(multiplier).toBe(1.0);
      expect(system.getComboCount()).toBe(1);
    });

    it('5秒内连续击杀两次：连杀计数为 2，金币倍率 1.2', () => {
      const enemy1 = createEnemy(world, 100, 200, 10);
      const enemy2 = createEnemy(world, 150, 200, 10);

      // 第一杀
      system.update(world, 1.0);
      const m1 = system.notifyEnemyKilled(enemy1, world);
      expect(m1).toBe(1.0);
      expect(system.getComboCount()).toBe(1);

      // 第二杀（2秒后）
      system.update(world, 2.0);
      const m2 = system.notifyEnemyKilled(enemy2, world);
      expect(m2).toBe(1.2);
      expect(system.getComboCount()).toBe(2);
    });

    it('5秒内连续击杀三次：连杀计数为 3，金币倍率 1.2', () => {
      const enemy1 = createEnemy(world, 100, 200, 10);
      const enemy2 = createEnemy(world, 150, 200, 10);
      const enemy3 = createEnemy(world, 200, 200, 10);

      system.update(world, 1.0);
      system.notifyEnemyKilled(enemy1, world);
      expect(system.getComboCount()).toBe(1);

      system.update(world, 3.0);  // 2秒后
      system.notifyEnemyKilled(enemy2, world);
      expect(system.getComboCount()).toBe(2);

      system.update(world, 5.0);  // 再过2秒
      const m3 = system.notifyEnemyKilled(enemy3, world);
      expect(m3).toBe(1.2);
      expect(system.getComboCount()).toBe(3);
    });

    it('超过5秒后击杀：连杀重置为 1', () => {
      const enemy1 = createEnemy(world, 100, 200, 10);
      const enemy2 = createEnemy(world, 150, 200, 10);

      // 第一杀
      system.update(world, 1.0);
      system.notifyEnemyKilled(enemy1, world);
      expect(system.getComboCount()).toBe(1);

      // 6秒后击杀
      system.update(world, 7.0);
      const m2 = system.notifyEnemyKilled(enemy2, world);
      expect(m2).toBe(1.0);
      expect(system.getComboCount()).toBe(1);
    });

    it('10连杀：金币倍率保持 1.2，连杀计数持续累加', () => {
      for (let i = 0; i < 10; i++) {
        system.update(world, i * 0.5 + 0.5); // 每次间隔 0.5 秒
        const enemyId = createEnemy(world, 100 + i * 20, 200, 10);
        const multiplier = system.notifyEnemyKilled(enemyId, world);

        if (i === 0) {
          expect(multiplier).toBe(1.0);
        } else {
          expect(multiplier).toBe(1.2);
        }
        expect(system.getComboCount()).toBe(i + 1);
      }
    });
  });

  describe('连杀窗口超时', () => {
    it('连杀窗口超时后 comboCount 归零', () => {
      const enemy1 = createEnemy(world, 100, 200, 10);
      const enemy2 = createEnemy(world, 150, 200, 10);

      // 达成2连杀
      system.update(world, 1.0);
      system.notifyEnemyKilled(enemy1, world);
      system.update(world, 3.0);
      system.notifyEnemyKilled(enemy2, world);
      expect(system.getComboCount()).toBe(2);

      // 等待超过5秒（连杀窗口超时）
      system.update(world, 9.0);
      expect(system.getComboCount()).toBe(0);
    });

    it('在窗口内的 update 不会重置连杀计数', () => {
      const enemy1 = createEnemy(world, 100, 200, 10);
      const enemy2 = createEnemy(world, 150, 200, 10);

      system.update(world, 1.0);
      system.notifyEnemyKilled(enemy1, world);
      expect(system.getComboCount()).toBe(1);

      // 仅过3秒，连杀仍保持
      system.update(world, 4.0);
      expect(system.getComboCount()).toBe(1);

      // 5秒内再次击杀
      system.notifyEnemyKilled(enemy2, world);
      expect(system.getComboCount()).toBe(2);
    });
  });

  describe('飘字实体', () => {
    it('连杀 ≥ 2 时生成 ComboFloatingText 实体', () => {
      const enemy1 = createEnemy(world, 100, 200, 10);
      const enemy2 = createEnemy(world, 200, 200, 10);

      // 第一杀 — 不生成飘字
      system.update(world, 1.0);
      system.notifyEnemyKilled(enemy1, world);

      // 第二杀 — 应生成飘字
      system.update(world, 3.0);
      system.notifyEnemyKilled(enemy2, world);

      // 通过 query 查找生成的 ComboFloatingText 实体
      const entities = comboTextQuery(world.world);
      expect(entities.length).toBe(1);
      expect(ComboFloatingText.comboCount[entities[0]!]).toBe(2);
    });

    it('连杀 = 1 时不生成飘字', () => {
      const enemy1 = createEnemy(world, 100, 200, 10);

      system.update(world, 1.0);
      system.notifyEnemyKilled(enemy1, world);

      const entities = comboTextQuery(world.world);
      expect(entities.length).toBe(0);
    });

    it('飘字实体随时间向上浮动并最终销毁', () => {
      const enemy1 = createEnemy(world, 100, 200, 10);
      const enemy2 = createEnemy(world, 200, 200, 10);

      system.update(world, 1.0);
      system.notifyEnemyKilled(enemy1, world);
      system.update(world, 2.0);
      system.notifyEnemyKilled(enemy2, world);

      // 通过 query 找到飘字实体
      let entities = comboTextQuery(world.world);
      expect(entities.length).toBe(1);
      const comboEid = entities[0]!;

      const initialY = Position.y[comboEid];
      expect(initialY).toBeDefined();

      // 推进时间 — 飘字应向上移动
      system.update(world, 0.5);
      const movedY = Position.y[comboEid];
      expect(movedY).toBeLessThan(initialY!);

      // 推进足够长时间 — 飘字应被销毁
      system.update(world, 3.0);
      world.cleanupDeadEntities();
      entities = comboTextQuery(world.world);
      expect(entities.length).toBe(0);
    });
  });

  describe('reset', () => {
    it('reset 后连杀计数归零', () => {
      const enemy1 = createEnemy(world, 100, 200, 10);
      const enemy2 = createEnemy(world, 150, 200, 10);

      system.update(world, 1.0);
      system.notifyEnemyKilled(enemy1, world);
      system.update(world, 2.0);
      system.notifyEnemyKilled(enemy2, world);
      expect(system.getComboCount()).toBe(2);

      system.reset();
      expect(system.getComboCount()).toBe(0);

      // reset 后新击杀从 1 开始
      const enemy3 = createEnemy(world, 300, 200, 10);
      system.update(world, 1.0);
      const m3 = system.notifyEnemyKilled(enemy3, world);
      expect(m3).toBe(1.0);
      expect(system.getComboCount()).toBe(1);
    });
  });
});
