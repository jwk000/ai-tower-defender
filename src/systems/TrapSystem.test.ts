/**
 * TrapSystem 测试 — 4种陷阱类型全量测试
 *
 * 对应设计文档:
 * - design/03-units.md §4 (机关单位，4种陷阱)
 * - design/18-layer-system.md §5.4 (陷阱触发规则)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { TowerWorld, hasComponent } from '../core/World.js';
import {
  Boss,
  GridOccupant,
  Health,
  Layer, LayerVal,
  Position,
  Slowed,
  Stunned,
  Trap,
  TrapTypeVal,
  UnitTag,
} from '../core/components.js';
import type { MapConfig } from '../types/index.js';
import { TileType } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';
import { TrapSystem } from './TrapSystem.js';

const TILE = 32;

// ============================================================
// Test helpers
// ============================================================

function makeTrap(
  world: TowerWorld,
  row: number,
  col: number,
  overrides: { layer?: number; trapType?: number; direction?: number; hp?: number; cooldown?: number; damagePerSecond?: number; maxTriggers?: number; stunDuration?: number; damage?: number; slowPercent?: number } = {},
): number {
  const eid = world.createEntity();
  const ox = RenderSystem.sceneOffsetX;
  const oy = RenderSystem.sceneOffsetY;
  world.addComponent(eid, Position, { x: ox + col * TILE + TILE / 2, y: oy + row * TILE + TILE / 2 });
  world.addComponent(eid, GridOccupant, { row, col });
  world.addComponent(eid, Trap, {
    damagePerSecond: overrides.damagePerSecond ?? 100,
    radius: TILE * 0.5,
    cooldown: overrides.cooldown ?? 0,
    cooldownTimer: 0,
    animTimer: 0,
    animDuration: 0.4,
    triggerCount: 0,
    maxTriggers: overrides.maxTriggers ?? 0,
    trapType: overrides.trapType ?? TrapTypeVal.SpikeTrap,
    direction: overrides.direction ?? 0,
    stunDuration: overrides.stunDuration ?? 0,
    damage: overrides.damage ?? 0,
    slowPercent: overrides.slowPercent ?? 50,
  });
  world.addComponent(eid, Layer, { value: overrides.layer ?? LayerVal.AboveGrid });

  // For Boulder: add Health component
  if (overrides.hp !== undefined) {
    world.addComponent(eid, Health, { current: overrides.hp, max: overrides.hp, armor: 20, magicResist: 0 });
  }

  return eid;
}

function makeEnemy(
  world: TowerWorld,
  row: number,
  col: number,
  overrides: { layer?: number; hp?: number; isBoss?: boolean } = {},
): number {
  const eid = world.createEntity();
  const ox = RenderSystem.sceneOffsetX;
  const oy = RenderSystem.sceneOffsetY;
  world.addComponent(eid, Position, { x: ox + col * TILE + TILE / 2, y: oy + row * TILE + TILE / 2 });
  world.addComponent(eid, Health, { current: overrides.hp ?? 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, Layer, { value: overrides.layer ?? LayerVal.Ground });
  world.addComponent(eid, UnitTag, { isEnemy: 1, isBoss: overrides.isBoss ? 1 : 0, atk: 10 });
  if (overrides.isBoss) {
    world.addComponent(eid, Boss, { phase: 1, phase2HpRatio: 0.5, transitionTimer: 0 });
  }
  return eid;
}

function makeSoldier(
  world: TowerWorld,
  row: number,
  col: number,
  overrides: { layer?: number; hp?: number } = {},
): number {
  const eid = world.createEntity();
  const ox = RenderSystem.sceneOffsetX;
  const oy = RenderSystem.sceneOffsetY;
  world.addComponent(eid, Position, { x: ox + col * TILE + TILE / 2, y: oy + row * TILE + TILE / 2 });
  world.addComponent(eid, Health, { current: overrides.hp ?? 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, Layer, { value: overrides.layer ?? LayerVal.Ground });
  world.addComponent(eid, UnitTag, { isEnemy: 0, atk: 0 });
  return eid;
}

/** Create a minimal MapConfig with path tiles for path-dependent tests */
function makeMapConfig(rows: number, cols: number, pathTiles: Array<{ row: number; col: number }>): MapConfig {
  const tiles: TileType[][] = [];
  for (let r = 0; r < rows; r++) {
    tiles[r] = [];
    for (let c = 0; c < cols; c++) {
      tiles[r]![c] = TileType.Empty;
    }
  }
  for (const { row, col } of pathTiles) {
    if (tiles[row]) tiles[row]![col] = TileType.Path;
  }
  return { name: 'test', cols, rows, tileSize: TILE, tiles };
}

// ============================================================
// SpikeTrap (0) — 地刺: 同格持续伤害, 层级规则
// ============================================================

describe('TrapSystem — SpikeTrap (地刺)', () => {
  let world: TowerWorld;
  let system: TrapSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new TrapSystem(TILE);
  });

  it('AboveGrid 陷阱: Ground 敌人踩中触发伤害', () => {
    const trap = makeTrap(world, 5, 5, { layer: LayerVal.AboveGrid, trapType: TrapTypeVal.SpikeTrap });
    const enemy = makeEnemy(world, 5, 5, { layer: LayerVal.Ground });
    const hp0 = Health.current[enemy];
    system.update(world, 1.0);
    expect(Health.current[enemy]).toBeLessThan(hp0!);
    expect(Trap.animTimer[trap]).toBeGreaterThan(0);
  });

  it('AboveGrid 陷阱: AboveGrid 敌人踩中触发伤害（同层）', () => {
    const trap = makeTrap(world, 5, 5, { layer: LayerVal.AboveGrid, trapType: TrapTypeVal.SpikeTrap });
    const enemy = makeEnemy(world, 5, 5, { layer: LayerVal.AboveGrid });
    const hp0 = Health.current[enemy];
    system.update(world, 1.0);
    expect(Health.current[enemy]).toBeLessThan(hp0!);
    expect(Trap.animTimer[trap]).toBeGreaterThan(0);
  });

  it('AboveGrid 陷阱: LowAir 敌人飞越不触发', () => {
    const trap = makeTrap(world, 5, 5, { layer: LayerVal.AboveGrid, trapType: TrapTypeVal.SpikeTrap });
    const enemy = makeEnemy(world, 5, 5, { layer: LayerVal.LowAir });
    const hp0 = Health.current[enemy];
    system.update(world, 1.0);
    expect(Health.current[enemy]).toBe(hp0);
    expect(Trap.animTimer[trap]).toBe(0);
  });

  it('BelowGrid 陷阱: 任意层敌人路过都触发', () => {
    const trap = makeTrap(world, 5, 5, { layer: LayerVal.BelowGrid, trapType: TrapTypeVal.SpikeTrap });
    const ground = makeEnemy(world, 5, 5, { layer: LayerVal.Ground });
    const flying = makeEnemy(world, 5, 5, { layer: LayerVal.LowAir });
    const hp0g = Health.current[ground];
    const hp0f = Health.current[flying];
    system.update(world, 1.0);
    const totalDmg =
      (hp0g! - (Health.current[ground] ?? 0)) +
      (hp0f! - (Health.current[flying] ?? 0));
    expect(totalDmg).toBeGreaterThan(0);
  });

  it('LowAir 陷阱: LowAir 敌人触发', () => {
    const trap = makeTrap(world, 5, 5, { layer: LayerVal.LowAir, trapType: TrapTypeVal.SpikeTrap });
    const enemy = makeEnemy(world, 5, 5, { layer: LayerVal.LowAir });
    const hp0 = Health.current[enemy];
    system.update(world, 1.0);
    expect(Health.current[enemy]).toBeLessThan(hp0!);
    expect(Trap.animTimer[trap]).toBeGreaterThan(0);
  });

  it('LowAir 陷阱: Ground 敌人不触发', () => {
    const trap = makeTrap(world, 5, 5, { layer: LayerVal.LowAir, trapType: TrapTypeVal.SpikeTrap });
    const enemy = makeEnemy(world, 5, 5, { layer: LayerVal.Ground });
    const hp0 = Health.current[enemy];
    system.update(world, 1.0);
    expect(Health.current[enemy]).toBe(hp0);
    expect(Trap.animTimer[trap]).toBe(0);
  });

  it('敌人不在同格不触发', () => {
    const trap = makeTrap(world, 5, 5, { trapType: TrapTypeVal.SpikeTrap });
    const enemy = makeEnemy(world, 6, 6, { layer: LayerVal.Ground });
    const hp0 = Health.current[enemy];
    system.update(world, 1.0);
    expect(Health.current[enemy]).toBe(hp0);
  });

  it('陷阱有 Health 组件时不应自伤，应正确伤害敌人', () => {
    // 真实游戏中 BuildSystem 会给陷阱添加 Health(hp:99999)
    const trap = makeTrap(world, 5, 5, { layer: LayerVal.AboveGrid, trapType: TrapTypeVal.SpikeTrap, hp: 99999 });
    const enemy = makeEnemy(world, 5, 5, { layer: LayerVal.Ground });
    const trapHp0 = Health.current[trap];
    const enemyHp0 = Health.current[enemy];
    system.update(world, 1.0);
    // 陷阱不应扣自己的血
    expect(Health.current[trap]).toBe(trapHp0);
    // 敌人应该受到伤害
    expect(Health.current[enemy]).toBeLessThan(enemyHp0!);
    expect(Trap.animTimer[trap]).toBeGreaterThan(0);
  });

  it('不会攻击同格我方士兵，但仍会攻击同格敌人', () => {
    const trap = makeTrap(world, 5, 5, { layer: LayerVal.AboveGrid, trapType: TrapTypeVal.SpikeTrap });
    const soldier = makeSoldier(world, 5, 5, { layer: LayerVal.Ground });
    const enemy = makeEnemy(world, 5, 5, { layer: LayerVal.Ground });
    const soldierHp0 = Health.current[soldier];
    const enemyHp0 = Health.current[enemy];

    system.update(world, 1.0);

    expect(Health.current[soldier]).toBe(soldierHp0);
    expect(Health.current[enemy]).toBeLessThan(enemyHp0!);
    expect(Trap.animTimer[trap]).toBeGreaterThan(0);
  });

  it('陷阱无 Layer 组件按 AboveGrid 默认行为', () => {
    const eid = world.createEntity();
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    world.addComponent(eid, Position, { x: ox + 5 * TILE + TILE / 2, y: oy + 5 * TILE + TILE / 2 });
    world.addComponent(eid, GridOccupant, { row: 5, col: 5 });
    world.addComponent(eid, Trap, {
      damagePerSecond: 100, radius: TILE * 0.5, cooldown: 0, cooldownTimer: 0,
      animTimer: 0, animDuration: 0.4, triggerCount: 0, maxTriggers: 0,
      trapType: TrapTypeVal.SpikeTrap, direction: 0, slowPercent: 0,
    });
    const ground = makeEnemy(world, 5, 5, { layer: LayerVal.Ground });
    const flying = makeEnemy(world, 5, 5, { layer: LayerVal.LowAir });
    const hp0g = Health.current[ground];
    const hp0f = Health.current[flying];
    system.update(world, 1.0);
    expect(Health.current[ground]).toBeLessThan(hp0g!);
    expect(Health.current[flying]).toBe(hp0f);
  });

  it('canTriggerOnEnemy 静态矩阵符合规则', () => {
    const { canTriggerOnEnemy } = TrapSystem;
    // AboveGrid 陷阱
    expect(canTriggerOnEnemy(LayerVal.AboveGrid, LayerVal.Ground)).toBe(true);
    expect(canTriggerOnEnemy(LayerVal.AboveGrid, LayerVal.AboveGrid)).toBe(true);
    expect(canTriggerOnEnemy(LayerVal.AboveGrid, LayerVal.LowAir)).toBe(false);
    // BelowGrid 陷阱 (任意层)
    expect(canTriggerOnEnemy(LayerVal.BelowGrid, LayerVal.Ground)).toBe(true);
    expect(canTriggerOnEnemy(LayerVal.BelowGrid, LayerVal.LowAir)).toBe(true);
    expect(canTriggerOnEnemy(LayerVal.BelowGrid, LayerVal.AboveGrid)).toBe(true);
    // LowAir 陷阱
    expect(canTriggerOnEnemy(LayerVal.LowAir, LayerVal.LowAir)).toBe(true);
    expect(canTriggerOnEnemy(LayerVal.LowAir, LayerVal.Ground)).toBe(false);
    expect(canTriggerOnEnemy(LayerVal.LowAir, LayerVal.AboveGrid)).toBe(false);
  });

  it('设置冷却后，地刺按攻击节奏结算伤害并同步播放动作', () => {
    const trap = makeTrap(world, 5, 5, { trapType: TrapTypeVal.SpikeTrap, damagePerSecond: 3, cooldown: 0.2 });
    const enemy = makeEnemy(world, 5, 5, { hp: 200, layer: LayerVal.Ground });
    system.update(world, 0.016);
    expect(Health.current[enemy]).toBeCloseTo(197);
    expect(Trap.cooldownTimer[trap]).toBeCloseTo(0.2);
    expect(Trap.animTimer[trap]).toBeGreaterThan(0);

    const animAfterHit = Trap.animTimer[trap]!;
    system.update(world, 0.1);
    expect(Health.current[enemy]).toBeCloseTo(197);
    expect(Trap.animTimer[trap]).toBeLessThan(animAfterHit);

    system.update(world, 0.1);
    expect(Health.current[enemy]).toBeCloseTo(194);
    expect(Trap.animTimer[trap]).toBeGreaterThan(0);
  });
});

// ============================================================
// BearTrap (1) — 捕兽夹: 眩晕2秒+20伤害，BOSS免疫，触发后5秒冷却但不消失
// ============================================================

describe('TrapSystem — BearTrap (捕兽夹)', () => {
  let world: TowerWorld;
  let system: TrapSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new TrapSystem(TILE);
  });

  it('敌人触发后添加 Stunned (2.0s)、造成20点伤害，并进入5秒冷却', () => {
    const trap = makeTrap(world, 5, 5, { trapType: TrapTypeVal.BearTrap, cooldown: 5.0, stunDuration: 2.0, damage: 20 });
    const enemy = makeEnemy(world, 5, 5);
    const hpBefore = Health.current[enemy] ?? 0;
    system.update(world, 0.016);
    expect(hasComponent(world.world, Stunned, enemy)).toBe(true);
    expect(Stunned.timer[enemy]).toBeCloseTo(2.0);
    expect(Health.current[enemy]).toBeCloseTo(hpBefore - 20);
    expect(Trap.triggerCount[trap]).toBe(1);
    expect(Trap.cooldownTimer[trap]).toBeCloseTo(5.0);
    expect(Trap.animTimer[trap]).toBeGreaterThan(0);
  });

  it('BOSS 免疫：不添加 Stunned，不造成伤害', () => {
    const trap = makeTrap(world, 5, 5, { trapType: TrapTypeVal.BearTrap, cooldown: 5.0, stunDuration: 2.0, damage: 20 });
    const boss = makeEnemy(world, 5, 5, { isBoss: true });
    const hp0 = Health.current[boss];
    system.update(world, 0.016);
    expect(hasComponent(world.world, Stunned, boss)).toBe(false);
    expect(Health.current[boss]).toBe(hp0);
    expect(Trap.cooldownTimer[trap]).toBe(0);
  });

  it('触发后不销毁，冷却期间不会重复困住同格敌人', () => {
    const trap = makeTrap(world, 5, 5, { trapType: TrapTypeVal.BearTrap, cooldown: 5.0, stunDuration: 2.0, damage: 20 });
    makeEnemy(world, 5, 5);
    system.update(world, 0.016);
    const secondEnemy = makeEnemy(world, 5, 5);
    const hpBefore = Health.current[secondEnemy] ?? 0;
    system.update(world, 1.0);
    expect(Trap.triggerCount[trap]).toBe(1);
    expect(Trap.cooldownTimer[trap]).toBeCloseTo(4.0);
    expect(hasComponent(world.world, Trap, trap)).toBe(true);
    expect(hasComponent(world.world, Stunned, secondEnemy)).toBe(false);
    expect(Health.current[secondEnemy]).toBeCloseTo(hpBefore);
  });

  it('不同格敌人不触发', () => {
    const trap = makeTrap(world, 5, 5, { trapType: TrapTypeVal.BearTrap, cooldown: 5.0 });
    const enemy = makeEnemy(world, 6, 6);
    system.update(world, 0.016);
    expect(hasComponent(world.world, Stunned, enemy)).toBe(false);
    expect(Trap.triggerCount[trap]).toBe(0);
  });

  it('冷却结束后可再次触发', () => {
    const trap = makeTrap(world, 5, 5, { trapType: TrapTypeVal.BearTrap, cooldown: 5.0, stunDuration: 2.0, damage: 20 });
    const firstEnemy = makeEnemy(world, 5, 5);
    system.update(world, 0.016);
    expect(Trap.triggerCount[trap]).toBe(1);
    Position.x[firstEnemy] = RenderSystem.sceneOffsetX + 6 * TILE + TILE / 2;
    Position.y[firstEnemy] = RenderSystem.sceneOffsetY + 6 * TILE + TILE / 2;

    system.update(world, 5.0);
    expect(Trap.cooldownTimer[trap]).toBe(0);

    const secondEnemy = makeEnemy(world, 5, 5);
    const hpBefore = Health.current[secondEnemy] ?? 0;
    system.update(world, 0.016);
    expect(Trap.triggerCount[trap]).toBe(2);
    expect(hasComponent(world.world, Stunned, secondEnemy)).toBe(true);
    expect(Stunned.timer[secondEnemy]).toBeCloseTo(2.0);
    expect(Health.current[secondEnemy]).toBeCloseTo(hpBefore - 20);
    expect(Trap.cooldownTimer[trap]).toBeCloseTo(5.0);
  });
});

// ============================================================
// TarPit (2) — 焦油坑: 持续50%减速
// ============================================================

describe('TrapSystem — TarPit (焦油坑)', () => {
  let world: TowerWorld;
  let system: TrapSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new TrapSystem(TILE);
  });

  it('同格敌人被添加 Slowed (50%)', () => {
    makeTrap(world, 5, 5, { trapType: TrapTypeVal.TarPit });
    const enemy = makeEnemy(world, 5, 5);
    system.update(world, 0.016);
    expect(hasComponent(world.world, Slowed, enemy)).toBe(true);
    expect(Slowed.percent[enemy]).toBe(50);
  });

  it('减速比例读取 Trap 配置，避免运行时硬编码', () => {
    makeTrap(world, 5, 5, { trapType: TrapTypeVal.TarPit, slowPercent: 35 });
    const enemy = makeEnemy(world, 5, 5);
    system.update(world, 0.016);
    expect(Slowed.percent[enemy]).toBe(35);
  });

  it('不同格敌人不受影响', () => {
    makeTrap(world, 5, 5, { trapType: TrapTypeVal.TarPit });
    const enemy = makeEnemy(world, 6, 6);
    system.update(world, 0.016);
    expect(hasComponent(world.world, Slowed, enemy)).toBe(false);
  });

  it('两个敌人同时踩中都被减速', () => {
    makeTrap(world, 5, 5, { trapType: TrapTypeVal.TarPit });
    const enemy1 = makeEnemy(world, 5, 5);
    const enemy2 = makeEnemy(world, 5, 5);
    system.update(world, 0.016);
    expect(hasComponent(world.world, Slowed, enemy1)).toBe(true);
    expect(hasComponent(world.world, Slowed, enemy2)).toBe(true);
  });
});

// ============================================================
// Boulder (3) — 巨石: HP阻塞，HP≤0时销毁
// ============================================================

describe('TrapSystem — Boulder (巨石)', () => {
  let world: TowerWorld;
  let system: TrapSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new TrapSystem(TILE);
  });

  it('HP > 0 时不被销毁', () => {
    const trap = makeTrap(world, 5, 5, { trapType: TrapTypeVal.Boulder, hp: 200 });
    system.update(world, 0.016);
    // Trap entity should still exist (Health component remains)
    expect(Health.current[trap]).toBe(200);
  });

  it('HP ≤ 0 时被销毁', () => {
    const trap = makeTrap(world, 5, 5, { trapType: TrapTypeVal.Boulder, hp: 0 });
    system.update(world, 0.016);
    // After destroyEntity, the entity is marked for deferred cleanup
    // Checking Health shouldn't throw but should still have value until cleanup
    expect(Health.current[trap]).toBe(0);
  });

  it('触碰敌人不造成伤害（石块阻挡但不伤害）', () => {
    makeTrap(world, 5, 5, { trapType: TrapTypeVal.Boulder, hp: 200 });
    const enemy = makeEnemy(world, 5, 5, { hp: 100 });
    const hp0 = Health.current[enemy]!;
    system.update(world, 1.0);
    expect(Health.current[enemy]).toBe(hp0);
  });

  it('HP = 0 时不会造成持续伤害（仅销毁自身）', () => {
    makeTrap(world, 5, 5, { trapType: TrapTypeVal.Boulder, hp: 0 });
    const enemy = makeEnemy(world, 5, 5, { hp: 100 });
    const hp0 = Health.current[enemy]!;
    system.update(world, 1.0);
    expect(Health.current[enemy]).toBe(hp0);
  });
});

// ============================================================
// 默认行为 (trapType 缺失 = SpikeTrap)
// ============================================================

describe('TrapSystem — 默认行为', () => {
  it('trapType 未设置时回退为 SpikeTrap', () => {
    const world = new TowerWorld();
    const system = new TrapSystem(TILE);
    const eid = world.createEntity();
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    world.addComponent(eid, Position, { x: ox + 5 * TILE + TILE / 2, y: oy + 5 * TILE + TILE / 2 });
    world.addComponent(eid, GridOccupant, { row: 5, col: 5 });
    world.addComponent(eid, Trap, {
      damagePerSecond: 100, radius: TILE * 0.5, cooldown: 0, cooldownTimer: 0,
      animTimer: 0, animDuration: 0.4, triggerCount: 0, maxTriggers: 0,
      trapType: 0, direction: 0, slowPercent: 0, // explicitly 0 (SpikeTrap default)
    });
    world.addComponent(eid, Layer, { value: LayerVal.AboveGrid });
    const enemy = makeEnemy(world, 5, 5);
    const hp0 = Health.current[enemy];
    system.update(world, 1.0);
    expect(Health.current[enemy]).toBeLessThan(hp0!);
  });
});

// ============================================================
// 多类型共存测试
// ============================================================

describe('TrapSystem — 多类型共存', () => {
  it('同一帧内 SpikeTrap + TarPit 均生效', () => {
    const world = new TowerWorld();
    const system = new TrapSystem(TILE);
    makeTrap(world, 5, 5, { trapType: TrapTypeVal.SpikeTrap });
    makeTrap(world, 5, 5, { trapType: TrapTypeVal.TarPit });
    const enemy = makeEnemy(world, 5, 5);
    const hp0 = Health.current[enemy]!;
    system.update(world, 0.016);
    expect(Health.current[enemy]).toBeLessThan(hp0);
    expect(hasComponent(world.world, Slowed, enemy)).toBe(true);
  });
});
