import { describe, expect, it, vi } from 'vitest';
import { defineQuery } from 'bitecs';
import { TowerWorld } from '../core/World.js';
import {
  Boss,
  Category,
  CategoryVal,
  DeathEffect,
  DisintegrateEffect,
  Faction,
  FactionVal,
  Health,
  Position,
  UnitTag,
  Visual,
} from '../core/components.js';
import { BossType } from './BossSystem.js';
import { DeathEffectSystem } from './DeathEffectSystem.js';
import { LifecycleSystem } from './LifecycleSystem.js';
import { getDeathSpriteArtId, registerDeathSpriteArtId } from '../utils/deathSpriteRegistry.js';
import { Sound } from '../utils/Sound.js';
import { ruleEngine } from '../core/RuleEngine.js';

const deathFxQuery = defineQuery([DeathEffect, DisintegrateEffect]);

function makeEnemy(world: TowerWorld, hp = 100, isBoss = false): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 100 + eid * 10, y: 100 });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, UnitTag, { isEnemy: 1, isBoss: isBoss ? 1 : 0, atk: 10 });
  world.addComponent(eid, Category, { value: CategoryVal.Enemy });
  world.addComponent(eid, Faction, { value: FactionVal.Evil });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 180,
    colorG: 60,
    colorB: 60,
    size: isBoss ? 80 : 24,
    alpha: 1,
  });
  if (isBoss) {
    world.addComponent(eid, Boss, { bossType: 0xff, phase: 1, phase2HpRatio: 0.5, selfDestructTimer: -1 });
  }
  return eid;
}

function makeSoldier(world: TowerWorld, hp = 100): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 100, y: 120 });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, UnitTag, { isEnemy: 0, isBoss: 0, atk: 10 });
  world.addComponent(eid, Category, { value: CategoryVal.Soldier });
  world.addComponent(eid, Faction, { value: FactionVal.Justice });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 60,
    colorG: 180,
    colorB: 180,
    size: 24,
    alpha: 1,
  });
  return eid;
}

function makeGiantSlime(world: TowerWorld, hp: number, splitCount: number): number {
  const eid = makeEnemy(world, hp, true);
  Boss.bossType[eid] = BossType.GiantSlime;
  Boss.splitCount[eid] = splitCount;
  return eid;
}

describe('LifecycleSystem — Boss死亡与敌方灰飞烟灭', () => {
  it('普通敌方单位死亡会生成灰飞烟灭破碎效果', () => {
    const world = new TowerWorld();
    const system = new LifecycleSystem();
    makeEnemy(world, 0);

    system.update(world, 0.016);

    const effects = deathFxQuery(world.world);
    expect(effects.length).toBe(1);
    expect(DeathEffect.duration[effects[0]!]).toBeCloseTo(0.65);
    expect(DisintegrateEffect.shardCount[effects[0]!]).toBe(16);
    expect(DisintegrateEffect.radius[effects[0]!]).toBeGreaterThanOrEqual(42);
  });

  it('普通敌方单位死亡效果继承原单位death动作资源', () => {
    const world = new TowerWorld();
    const system = new LifecycleSystem();
    makeEnemy(world, 0);

    system.update(world, 0.016);

    const effects = deathFxQuery(world.world);
    expect(effects.length).toBe(1);
    expect(getDeathSpriteArtId(effects[0]!)).toBe('enemy_goblin');
  });

  it('普通敌方单位死亡会播放类型化死亡音效', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const world = new TowerWorld();
    const system = new LifecycleSystem();
    makeEnemy(world, 0);

    system.update(world, 0.016);

    expect(playSpy).toHaveBeenCalledWith('enemy_death');
  });

  it('实体 onDeath 已配置 play_sound 时不额外播放兜底死亡音', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const world = new TowerWorld();
    const system = new LifecycleSystem();
    const enemy = makeEnemy(world, 0);
    ruleEngine.registerHandler('play_sound', (_ruleWorld, _entityId, params) => {
      if (typeof params['sound'] === 'string') Sound.play(params['sound'] as never);
    });
    ruleEngine.registerEntityConfig(enemy, 'enemy_with_sound');
    ruleEngine.registerLifecycleRules('enemy_with_sound', new Map([
      ['onDeath', [{ type: 'play_sound', sound: 'enemy_death_magic' }]],
    ]));

    system.update(world, 0.016);

    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalledWith('enemy_death_magic');
  });

  it('士兵死亡会播放士兵死亡音效', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const world = new TowerWorld();
    const system = new LifecycleSystem();
    makeSoldier(world, 0);

    system.update(world, 0.016);

    expect(playSpy).toHaveBeenCalledWith('soldier_death');
  });

  it('Boss死亡会立即让场上剩余敌方单位进入死亡状态并生成破碎效果', () => {
    const world = new TowerWorld();
    const system = new LifecycleSystem();
    const boss = makeEnemy(world, 0, true);
    const enemyA = makeEnemy(world, 100);
    const enemyB = makeEnemy(world, 100);

    system.update(world, 0.016);

    expect(Health.current[boss]).toBe(0);
    expect(Health.current[enemyA]).toBe(0);
    expect(Health.current[enemyB]).toBe(0);
    expect(deathFxQuery(world.world).length).toBe(3);
  });

  it('巨型史莱姆非最终分裂层血量归零时不触发真正死亡清场', () => {
    const world = new TowerWorld();
    const system = new LifecycleSystem();
    const slime = makeGiantSlime(world, 0, 0);
    const enemy = makeEnemy(world, 100);

    system.update(world, 0.016);

    expect(Health.current[slime]).toBe(0);
    expect(Health.current[enemy]).toBe(100);
    expect(deathFxQuery(world.world).length).toBe(0);
  });

  it('小型史莱姆未全部死亡时不会触发Boss真正死亡清场', () => {
    const world = new TowerWorld();
    const system = new LifecycleSystem();
    makeGiantSlime(world, 0, 2);
    makeGiantSlime(world, 80, 2);
    const enemy = makeEnemy(world, 100);

    system.update(world, 0.016);

    expect(Health.current[enemy]).toBe(100);
    expect(deathFxQuery(world.world).length).toBe(1);
  });

  it('最后一个小型史莱姆血量归零才触发Boss真正死亡和清场', () => {
    const world = new TowerWorld();
    const system = new LifecycleSystem();
    makeGiantSlime(world, 0, 2);
    const enemy = makeEnemy(world, 100);

    system.update(world, 0.016);

    expect(Health.current[enemy]).toBe(0);
    expect(deathFxQuery(world.world).length).toBe(2);
  });
});

describe('DeathEffectSystem — 死亡动作生命周期', () => {
  it('死亡效果结束后清理死亡动作资源映射并销毁实体', () => {
    const world = new TowerWorld();
    const system = new DeathEffectSystem();
    const effect = world.createEntity();
    world.addComponent(effect, DeathEffect, { duration: 0.3, elapsed: 0, renderedFrames: 1 });
    registerDeathSpriteArtId(effect, 'enemy_goblin');

    system.update(world, 0.31);

    expect(getDeathSpriteArtId(effect)).toBeNull();
  });
});
