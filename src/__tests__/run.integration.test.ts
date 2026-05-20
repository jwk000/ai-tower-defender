import { describe, expect, it, vi } from 'vitest';
import { ShopPanel } from '../ui/ShopPanel.js';
import { MysticPanel } from '../ui/MysticPanel.js';
import { ARROW_TOWER_SKILL_TREE } from '../ui/ArrowTowerConfig.js';
import { addComponent } from 'bitecs';

import { Game } from '../core/Game.js';
import { LevelState } from '../core/LevelState.js';
import { RunController } from '../core/RunController.js';
import {
  Attack,
  Crystal,
  Faction,
  FactionTeam,
  Health,
  Position,
  Projectile,
  UnitCategory,
  UnitTag,
} from '../core/components.js';
import type { UnitConfig } from '../factories/UnitFactory.js';
import { spawnUnit } from '../factories/UnitFactory.js';
import { CardRegistry, type CardConfig } from '../unit-system/CardRegistry.js';
import { CardSpawnSystem } from '../unit-system/CardSpawnSystem.js';
import { DeckSystem } from '../unit-system/DeckSystem.js';
import { EnergySystem } from '../unit-system/EnergySystem.js';
import { HandSystem } from '../unit-system/HandSystem.js';
import { RunManager, RunPhase } from '../unit-system/RunManager.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { createAttackSystem } from '../systems/AttackSystem.js';
import { createCrystalSystem } from '../systems/CrystalSystem.js';
import { createHealthSystem } from '../systems/HealthSystem.js';
import { createLifecycleSystem } from '../systems/LifecycleSystem.js';
import { createMovementSystem } from '../systems/MovementSystem.js';
import { createProjectileSystem } from '../systems/ProjectileSystem.js';
import {
  createWaveSystem,
  type WaveConfig,
  type SpawnConfig,
} from '../systems/WaveSystem.js';
import { defineQuery } from 'bitecs';
import type { TowerWorld } from '../core/World.js';

const GRUNT: UnitConfig = {
  id: 'grunt',
  category: 'Enemy',
  faction: 'Enemy',
  stats: { hp: 30, atk: 0, attackSpeed: 0, range: 0, speed: 100 },
  visual: { shape: 'circle', color: 0xef5350, size: 24 },
  lifecycle: {
    onDeath: [{ handler: 'drop_gold', params: { amount: 5 } }],
  },
};

const SPIKE_TRAP: UnitConfig = {
  id: 'spike_trap',
  category: 'Trap',
  faction: 'Player',
  stats: { hp: 1, atk: 0, attackSpeed: 0, range: 0, speed: 0 },
  visual: { shape: 'rect', color: 0x9e9e9e, size: 16 },
};

const SPIKE_CARD: CardConfig = {
  id: 'card_spike',
  type: 'trap',
  energyCost: 2,
  unitConfigId: 'spike_trap',
};

function spawnCrystalAt(world: TowerWorld, x: number, y: number, hp: number, radius: number): number {
  const eid = world.addEntity();
  addComponent(world, Position, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  addComponent(world, Health, eid);
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  addComponent(world, Faction, eid);
  Faction.team[eid] = FactionTeam.Player;
  addComponent(world, UnitTag, eid);
  UnitTag.category[eid] = UnitCategory.Objective;
  addComponent(world, Crystal, eid);
  Crystal.radius[eid] = radius;
  return eid;
}

function makeRng(seed = 0): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe('Run integration: RunManager + Deck/Hand/Energy + CardSpawn + Economy + W2 systems', () => {
  it('runs the L1 MVP loop end to end: start Run -> spawn enemies -> crystal kills -> level clear -> Result', () => {
    const game = new Game();
    const econ = new EconomySystem();
    game.world.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
      const amount = typeof params['amount'] === 'number' ? params['amount'] : 0;
      econ.addGold(amount);
    });

    const path = [
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ];
    game.pipeline.register(createMovementSystem({ path }));
    game.pipeline.register(createCrystalSystem());
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const run = new RunManager({ totalLevels: 1 });
    const deck = new DeckSystem({ pool: ['card_spike'], deckSize: 4, rng: makeRng(42) });
    const hand = new HandSystem({ maxSize: 4 });
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 0 });

    run.startRun();
    run.enterBattle();
    hand.drawTo(deck);
    expect(hand.size).toBe(4);
    expect(run.phase).toBe(RunPhase.Battle);

    spawnCrystalAt(game.world, 400, 100, 5, 50);
    spawnUnit(game.world, GRUNT, { x: 0, y: 100 });
    spawnUnit(game.world, GRUNT, { x: -50, y: 100 });
    spawnUnit(game.world, GRUNT, { x: -100, y: 100 });

    const totalEnemies = 3;
    let killsSeen = 0;
    for (let i = 0; i < 600 && econ.gold < totalEnemies * 5; i += 1) {
      game.tick(0.1);
      energy.tick(0.1);
      killsSeen = econ.gold / 5;
    }

    expect(killsSeen).toBe(totalEnemies);
    expect(econ.gold).toBe(15);

    run.completeLevel();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('victory');

    econ.grantLevelClearReward(run.currentLevel);
    expect(econ.sp).toBe(2);
  });

  it('hand.playCard -> CardSpawnSystem.play places a trap on the map and consumes energy', () => {
    const game = new Game();
    const registry = new CardRegistry();
    registry.registerCard(SPIKE_CARD);
    registry.registerUnit(SPIKE_TRAP);
    const cardSpawn = new CardSpawnSystem(registry);
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 5 });
    const hand = new HandSystem({ maxSize: 4 });

    const deck = new DeckSystem({ pool: ['card_spike'], deckSize: 2, rng: makeRng(7) });
    hand.drawTo(deck);
    expect(hand.size).toBe(2);

    const playedCard = hand.playCard(0)!;
    expect(playedCard).toBe('card_spike');

    const card = registry.getCard(playedCard)!;
    expect(energy.canAfford(card.energyCost)).toBe(true);
    expect(energy.spend(card.energyCost)).toBe(true);
    expect(energy.current).toBe(3);

    const eid = cardSpawn.play(game.world, playedCard, { x: 200, y: 150 });
    expect(eid).not.toBeNull();
    expect(Position.x[eid!]).toBe(200);
    expect(Position.y[eid!]).toBe(150);
    expect(UnitTag.category[eid!]).toBe(UnitCategory.Trap);
  });

  it('Run can be replayed by resetting RunManager, deck, hand, energy, and economy', () => {
    const econ = new EconomySystem();
    const run = new RunManager({ totalLevels: 1 });
    const deck = new DeckSystem({ pool: ['card_spike'], deckSize: 4, rng: makeRng(99) });
    const hand = new HandSystem({ maxSize: 4 });
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 5 });

    run.startRun();
    run.enterBattle();
    hand.drawTo(deck);
    energy.spend(3);
    econ.addGold(50);
    econ.addSp(4);
    run.failRun();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('defeat');

    run.resetToIdle();
    deck.reset();
    hand.clear();
    energy.reset();
    econ.reset();

    expect(run.phase).toBe(RunPhase.Idle);
    expect(run.currentLevel).toBe(0);
    expect(deck.drawPileSize).toBe(4);
    expect(deck.discardPileSize).toBe(0);
    expect(hand.size).toBe(0);
    expect(energy.current).toBe(5);
    expect(econ.gold).toBe(0);
    expect(econ.sp).toBe(0);

    run.startRun();
    run.enterBattle();
    expect(run.phase).toBe(RunPhase.Battle);
    expect(run.currentLevel).toBe(1);
  });
});

describe('MVP run flow smoke: RunController orchestrates phase + scene + tick', () => {
  function makeScenes() {
    return {
      mainMenu: { visible: false },
      levelMap: { visible: false },
      battle: { visible: false },
      interLevel: { visible: false },
      shop: { visible: false },
      mystic: { visible: false },
      runResult: { visible: false },
    };
  }

  it('completes a full Idle -> Battle -> Result cycle and resets to Idle', () => {
    const game = new Game();
    game.world.ruleEngine.registerHandler('drop_gold', () => {});
    const runManager = new RunManager({ totalLevels: 1 });
    const scenes = makeScenes();

    const waves: WaveConfig[] = [
      {
        waveNumber: 1,
        spawnDelayMs: 100,
        groups: [{ enemyId: 'grunt', count: 1, intervalMs: 0 }],
      },
    ];
    const spawns: SpawnConfig[] = [{ id: 's1', x: 0, y: 100 }];
    const unitConfigs = new Map([['grunt', GRUNT]]);
    const waveSystem = createWaveSystem({ waves, spawns, unitConfigs });
    game.pipeline.register(waveSystem);

    const levelState = new LevelState();
    levelState.reset(waves.length);
    expect(levelState.waveTotal).toBe(1);
    expect(levelState.phase).toBe('deployment');

    const controller = new RunController({ game, runManager, scenes, waveSystem, levelState });

    expect(controller.phase).toBe(RunPhase.Idle);
    expect(scenes.mainMenu.visible).toBe(true);
    expect(scenes.battle.visible).toBe(false);
    expect(scenes.interLevel.visible).toBe(false);
    expect(scenes.runResult.visible).toBe(false);

    controller.startRun();
    expect(controller.phase).toBe(RunPhase.LevelMap);
    expect(scenes.mainMenu.visible).toBe(false);
    expect(scenes.levelMap.visible).toBe(true);
    expect(scenes.battle.visible).toBe(false);

    controller.enterBattle();
    expect(controller.phase).toBe(RunPhase.Battle);
    expect(scenes.levelMap.visible).toBe(false);
    expect(scenes.battle.visible).toBe(true);

    waveSystem.start();

    const tickSpy = vi.spyOn(game, 'tick');
    controller.tick(0.016);
    controller.tick(0.016);
    expect(tickSpy).toHaveBeenCalledTimes(2);
    expect(tickSpy).toHaveBeenLastCalledWith(0.016);
    expect(levelState.waveIndex).toBe(0);
    expect(levelState.phase).toBe('deployment');

    controller.tick(0.1);
    expect(levelState.phase).toBe('battle');

    controller.completeCurrentLevel();
    expect(controller.phase).toBe(RunPhase.Result);
    expect(runManager.outcome).toBe('victory');
    expect(scenes.battle.visible).toBe(false);
    expect(scenes.runResult.visible).toBe(true);
    expect(levelState.phase).toBe('victory');

    tickSpy.mockClear();
    controller.tick(0.016);
    expect(tickSpy).not.toHaveBeenCalled();

    controller.returnToMainMenu();
    expect(controller.phase).toBe(RunPhase.Idle);
    expect(scenes.mainMenu.visible).toBe(true);
    expect(scenes.runResult.visible).toBe(false);
    expect(runManager.gold).toBe(0);
    expect(runManager.crystalHp).toBe(0);
  });

  it('handles defeat path and clears Run-level resources on reset', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 1, initialGold: 200, initialCrystalHp: 20 });
    const scenes = makeScenes();
    const levelState = new LevelState();
    levelState.reset(1);
    const controller = new RunController({ game, runManager, scenes, levelState });

    controller.startRun();
    expect(runManager.gold).toBe(200);
    expect(runManager.crystalHp).toBe(20);

    controller.enterBattle();
    controller.failCurrentRun();
    expect(controller.phase).toBe(RunPhase.Result);
    expect(runManager.outcome).toBe('defeat');
    expect(scenes.runResult.visible).toBe(true);
    expect(scenes.battle.visible).toBe(false);
    expect(levelState.phase).toBe('defeat');

    controller.returnToMainMenu();
    expect(controller.phase).toBe(RunPhase.Idle);
    expect(runManager.gold).toBe(0);
    expect(runManager.sp).toBe(0);
    expect(runManager.crystalHp).toBe(0);
    expect(runManager.crystalHpMax).toBe(0);
    expect(scenes.mainMenu.visible).toBe(true);
  });

  it('starts the next battle after inter-level close and preserves crystal HP across levels', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 8, initialGold: 200, initialCrystalHp: 20 });
    const scenes = makeScenes();
    const levelState = new LevelState();
    levelState.reset(2);
    const onLevelStart = vi.fn();
    const controller = new RunController({ game, runManager, scenes, levelState, onLevelStart });

    controller.startRun();
    controller.enterBattle();
    runManager.damageCrystal(6);
    expect(runManager.crystalHp).toBe(14);

    controller.completeCurrentLevel();
    expect(runManager.phase).toBe(RunPhase.InterLevel);
    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.pickInterLevel('shop');
    expect(runManager.phase).toBe(RunPhase.Shop);

    controller.closeShop();

    expect(runManager.phase).toBe(RunPhase.LevelMap);
    expect(runManager.currentLevel).toBe(2);
    expect(runManager.crystalHp).toBe(14);
    expect(onLevelStart).toHaveBeenCalledTimes(0);
    expect(scenes.levelMap.visible).toBe(true);
    expect(scenes.shop.visible).toBe(false);

    controller.enterBattle();
    expect(runManager.phase).toBe(RunPhase.Battle);
    expect(onLevelStart).toHaveBeenCalledTimes(1);
    expect(onLevelStart).toHaveBeenCalledWith(2);
    expect(scenes.battle.visible).toBe(true);
  });

  it('non-final battle completion can grant a three-card reward before normal inter-level branching', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 3, initialGold: 200, initialCrystalHp: 20 });
    const scenes = makeScenes();
    const deckSystem = new DeckSystem({ pool: ['card_spike'], deckSize: 2, rng: makeRng(11) });
    const controller = new RunController({ game, runManager, scenes, deckSystem });

    controller.startRun();
    controller.enterBattle();
    controller.completeCurrentLevel();
    expect(runManager.phase).toBe(RunPhase.InterLevel);

    expect(runManager.pendingCardReward?.options.map((option) => option.cardId)).toEqual([
      'arrow_tower_card',
      'cannon_tower_card',
      'elemental_tower_card',
    ]);
    expect(() => controller.pickInterLevel('shop')).toThrow(/card reward is pending/i);

    const rewarded = controller.claimCardReward(runManager.pendingCardReward!.options[1]!.id);

    expect(rewarded.cardId).toBe('cannon_tower_card');
    expect(runManager.pendingCardReward).toBeNull();
    expect(deckSystem.getCardInstances()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardId: 'cannon_tower_card', pile: 'discard' }),
      ]),
    );

    const goldBefore = runManager.gold;
    expect(runManager.pendingGoldReward?.options.map((option) => option.amount)).toEqual([30, 50, 80]);
    expect(() => controller.pickInterLevel('shop')).toThrow(/gold reward is pending/i);

    const goldReward = controller.claimGoldReward(runManager.pendingGoldReward!.options[2]!.id);
    expect(goldReward.amount).toBe(80);
    expect(runManager.gold).toBe(goldBefore + 80);
    expect(runManager.pendingGoldReward).toBeNull();

    controller.setPendingUpgradeReward([
      { id: 'u1', instanceId: 'cannon_tower_card_inst_1', cardId: 'cannon_tower_card', title: '炮塔 Lv.2', description: '升级到 Lv.2' },
      { id: 'u2', instanceId: 'elemental_tower_card_inst_2', cardId: 'elemental_tower_card', title: '元素塔 Lv.2', description: '升级到 Lv.2' },
      { id: 'u3', instanceId: 'arrow_tower_card_inst_3', cardId: 'arrow_tower_card', title: '箭塔 Lv.2', description: '升级到 Lv.2' },
    ]);
    expect(() => controller.pickInterLevel('shop')).toThrow(/upgrade reward is pending/i);

    expect(() => controller.claimUpgradeReward('u1')).toThrow(/INSTANCE_NOT_FOUND/i);
  });

  it('non-final battle completion can grant card -> gold -> upgrade -> branch in sequence', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 3, initialGold: 200, initialCrystalHp: 20 });
    const scenes = makeScenes();
    const deckSystem = new DeckSystem({
      pool: ['arrow_tower_card', 'cannon_tower_card', 'elemental_tower_card'],
      deckSize: 3,
      rng: makeRng(31),
    });
    deckSystem.initWithCards(['arrow_tower_card', 'cannon_tower_card', 'elemental_tower_card']);
    runManager.registerCardInstance('arrow_tower_card_inst_1', { unitCardId: 'arrow_tower', nodes: [
      { id: 'arrow_lv1', name: '箭塔 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
      { id: 'arrow_lv2', name: '箭塔 Lv.2', level: 2, goldCost: 0, prerequisites: ['arrow_lv1'], effects: [] },
    ] });
    runManager.registerCardInstance('cannon_tower_card_inst_2', { unitCardId: 'cannon_tower', nodes: [
      { id: 'cannon_lv1', name: '炮塔 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
      { id: 'cannon_lv2', name: '炮塔 Lv.2', level: 2, goldCost: 0, prerequisites: ['cannon_lv1'], effects: [] },
    ] });
    runManager.registerCardInstance('elemental_tower_card_inst_3', { unitCardId: 'elemental_tower', nodes: [
      { id: 'elemental_lv1', name: '元素塔 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
      { id: 'elemental_lv2', name: '元素塔 Lv.2', level: 2, goldCost: 0, prerequisites: ['elemental_lv1'], effects: [] },
    ] });
    const controller = new RunController({ game, runManager, scenes, deckSystem });

    controller.startRun();
    controller.enterBattle();
    controller.completeCurrentLevel();
    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.setPendingUpgradeReward([
      { id: 'u1', instanceId: 'arrow_tower_card_inst_1', cardId: 'arrow_tower_card', title: '箭塔 Lv.2', description: '升级到 Lv.2' },
      { id: 'u2', instanceId: 'cannon_tower_card_inst_2', cardId: 'cannon_tower_card', title: '炮塔 Lv.2', description: '升级到 Lv.2' },
      { id: 'u3', instanceId: 'elemental_tower_card_inst_3', cardId: 'elemental_tower_card', title: '元素塔 Lv.2', description: '升级到 Lv.2' },
    ]);

    expect(runManager.phase).toBe(RunPhase.InterLevel);
    expect(runManager.getCardLevel('cannon_tower_card_inst_2')).toBe(1);
    expect(() => controller.pickInterLevel('shop')).toThrow(/upgrade reward is pending/i);

    const upgraded = controller.claimUpgradeReward('u2');
    expect(upgraded.instanceId).toBe('cannon_tower_card_inst_2');
    expect(runManager.pendingUpgradeReward).toBeNull();
    expect(runManager.getCardLevel('cannon_tower_card_inst_2')).toBe(2);

    controller.pickInterLevel('shop');
    expect(runManager.phase).toBe(RunPhase.Shop);
  });

  it('inter-level now stops after card and gold rewards without auto-generating upgrade rewards', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 3, initialGold: 200, initialCrystalHp: 20 });
    const scenes = makeScenes();
    const deckSystem = new DeckSystem({
      pool: ['arrow_tower_card', 'cannon_tower_card', 'elemental_tower_card'],
      deckSize: 3,
      rng: makeRng(41),
    });
    const controller = new RunController({ game, runManager, scenes, deckSystem });

    controller.startRun();
    controller.enterBattle();
    controller.completeCurrentLevel();

    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);

    expect(runManager.pendingUpgradeReward).toBeNull();
    controller.returnToLevelMap();
    expect(runManager.phase).toBe(RunPhase.LevelMap);
  });

  it('deck management APIs upgrade and delete card instances in-place', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 3, initialGold: 200, initialCrystalHp: 20 });
    const scenes = makeScenes();
    const deckSystem = new DeckSystem({
      pool: ['arrow_tower_card', 'cannon_tower_card', 'elemental_tower_card'],
      deckSize: 3,
      rng: makeRng(51),
    });
    deckSystem.initWithCards(['arrow_tower_card', 'cannon_tower_card', 'elemental_tower_card']);
    runManager.startRun();

    const [arrowInst, cannonInst, elementalInst] = deckSystem.getCardInstances();
    runManager.registerCardInstance(arrowInst!.instanceId, { unitCardId: 'arrow_tower', nodes: [
      { id: 'arrow_lv1', name: '箭塔 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
      { id: 'arrow_lv2', name: '箭塔 Lv.2', level: 2, goldCost: 40, prerequisites: ['arrow_lv1'], effects: [] },
    ] });
    runManager.registerCardInstance(cannonInst!.instanceId, { unitCardId: 'cannon_tower', nodes: [
      { id: 'cannon_lv1', name: '炮塔 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
      { id: 'cannon_lv2', name: '炮塔 Lv.2', level: 2, goldCost: 60, prerequisites: ['cannon_lv1'], effects: [] },
    ] });
    runManager.registerCardInstance(elementalInst!.instanceId, { unitCardId: 'elemental_tower', nodes: [
      { id: 'elemental_lv1', name: '元素塔 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
      { id: 'elemental_lv2', name: '元素塔 Lv.2', level: 2, goldCost: 80, prerequisites: ['elemental_lv1'], effects: [] },
    ] });

    const controller = new RunController({ game, runManager, scenes, deckSystem });

    expect(controller.upgradeDeckCard(arrowInst!.instanceId)).toBe(true);
    expect(runManager.getCardLevel(arrowInst!.instanceId)).toBe(2);
    expect(runManager.gold).toBe(160);

    expect(controller.removeDeckCard(cannonInst!.instanceId)).toBe(true);
    expect(deckSystem.getCardInstances()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: cannonInst!.instanceId }),
      ]),
    );
    expect(runManager.getCardSkillTreeState(cannonInst!.instanceId)).toBeNull();
  });

  it('debug victory on level 1 → InterLevel → skip → LevelMap → enterBattle triggers onLevelStart(2)', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 8, initialGold: 200, initialCrystalHp: 20 });
    const scenes = makeScenes();
    const levelState = new LevelState();
    levelState.reset(3);
    const onLevelStart = vi.fn();
    const controller = new RunController({ game, runManager, scenes, levelState, onLevelStart });

    controller.startRun();
    controller.enterBattle();
    expect(controller.phase).toBe(RunPhase.Battle);
    expect(runManager.currentLevel).toBe(1);

    controller.completeCurrentLevel();
    expect(controller.phase).toBe(RunPhase.InterLevel);
    expect(runManager.currentLevel).toBe(1);
    expect(scenes.interLevel.visible).toBe(true);
    expect(scenes.battle.visible).toBe(false);

    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);

    controller.returnToLevelMap();
    expect(controller.phase).toBe(RunPhase.LevelMap);
    expect(runManager.currentLevel).toBe(2);
    expect(scenes.levelMap.visible).toBe(true);

    controller.enterBattle();
    expect(controller.phase).toBe(RunPhase.Battle);
    expect(scenes.battle.visible).toBe(true);
    expect(scenes.levelMap.visible).toBe(false);
    expect(onLevelStart).toHaveBeenCalledTimes(1);
    expect(onLevelStart).toHaveBeenCalledWith(2);
  });
});

describe('WaveSystem integration: schedule, spawn cadence, phase transitions', () => {
  it('Wave 7.A: schedules count=3 grunts at intervalMs cadence and transitions deployment -> battle -> wave-break', () => {
    const game = new Game();
    game.world.ruleEngine.registerHandler('drop_gold', () => {});
    const spawn = vi.fn(spawnUnit);

    const waves: WaveConfig[] = [
      {
        waveNumber: 1,
        spawnDelayMs: 200,
        groups: [{ enemyId: 'grunt', count: 3, intervalMs: 100 }],
      },
    ];
    const spawns: SpawnConfig[] = [{ id: 's1', x: 0, y: 100 }];
    const unitConfigs = new Map([['grunt', GRUNT]]);

    const onWaveComplete = vi.fn();
    const onAllWavesComplete = vi.fn();

    const waveSystem = createWaveSystem({
      waves,
      spawns,
      unitConfigs,
      waveBreakMs: 500,
      onWaveComplete,
      onAllWavesComplete,
      spawn,
    });

    game.pipeline.register(waveSystem);
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    waveSystem.start();
    expect(waveSystem.currentPhase).toBe('deployment');
    expect(spawn).toHaveBeenCalledTimes(0);

    game.tick(0.1);
    expect(waveSystem.currentPhase).toBe('deployment');
    expect(spawn).toHaveBeenCalledTimes(0);

    game.tick(0.15);
    expect(waveSystem.currentPhase).toBe('battle');
    expect(spawn).toHaveBeenCalledTimes(1);

    game.tick(0.1);
    expect(spawn).toHaveBeenCalledTimes(2);

    game.tick(0.1);
    expect(spawn).toHaveBeenCalledTimes(3);

    game.tick(0.05);
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(waveSystem.aliveEnemyCount(game.world)).toBe(3);
    expect(waveSystem.currentPhase).toBe('battle');

    const enemies = spawn.mock.results.map((r) => r.value as number);
    for (const eid of enemies) {
      Health.current[eid] = 0;
    }

    game.tick(0.016);
    expect(waveSystem.aliveEnemyCount(game.world)).toBe(0);
    expect(waveSystem.currentPhase).toBe('wave-break');
    expect(onWaveComplete).toHaveBeenCalledTimes(1);
    expect(onWaveComplete).toHaveBeenCalledWith(0);

    // Game.tick clamps dt to MAX_DT_SECONDS (0.25s), so a single tick(0.6)
    // only advances 250ms — not enough to cross waveBreakMs=500. Split the
    // wait across two ticks to accumulate >=500ms in wave-break phase.
    game.tick(0.25);
    game.tick(0.3);
    expect(waveSystem.currentPhase).toBe('completed');
    expect(onAllWavesComplete).toHaveBeenCalledTimes(1);
  });

  it('Wave 7.A.2: spawns at the spawnId coordinate and uses the configured UnitConfig', () => {
    const game = new Game();
    game.world.ruleEngine.registerHandler('drop_gold', () => {});
    const spawn = vi.fn(spawnUnit);

    const waves: WaveConfig[] = [
      {
        waveNumber: 1,
        spawnDelayMs: 0,
        groups: [{ enemyId: 'grunt', count: 1, spawnId: 's2', intervalMs: 0 }],
      },
    ];
    const spawns: SpawnConfig[] = [
      { id: 's1', x: 0, y: 0 },
      { id: 's2', x: 320, y: 288 },
    ];
    const unitConfigs = new Map([['grunt', GRUNT]]);

    const waveSystem = createWaveSystem({ waves, spawns, unitConfigs, spawn });
    game.pipeline.register(waveSystem);

    waveSystem.start();
    game.tick(0.016);

    expect(spawn).toHaveBeenCalledTimes(1);
    const lastCall = spawn.mock.calls[0]!;
    expect(lastCall[1]).toBe(GRUNT);
    expect(lastCall[2]).toEqual({ x: 320, y: 288 });
  });

  it('Wave 7.A.3: rejects unknown enemyId and unknown spawnId loudly', () => {
    const game = new Game();
    game.world.ruleEngine.registerHandler('drop_gold', () => {});
    const unitConfigs = new Map([['grunt', GRUNT]]);

    const bad = createWaveSystem({
      waves: [
        {
          waveNumber: 1,
          spawnDelayMs: 0,
          groups: [{ enemyId: 'phantom', count: 1, intervalMs: 0 }],
        },
      ],
      spawns: [{ id: 's1', x: 0, y: 0 }],
      unitConfigs,
    });
    game.pipeline.register(bad);
    bad.start();
    expect(() => game.tick(0.016)).toThrow(/unknown enemyId/);

    const game2 = new Game();
    game2.world.ruleEngine.registerHandler('drop_gold', () => {});
    const badSpawn = createWaveSystem({
      waves: [
        {
          waveNumber: 1,
          spawnDelayMs: 0,
          groups: [{ enemyId: 'grunt', count: 1, spawnId: 'ghost', intervalMs: 0 }],
        },
      ],
      spawns: [{ id: 's1', x: 0, y: 0 }],
      unitConfigs,
    });
    game2.pipeline.register(badSpawn);
    badSpawn.start();
    expect(() => game2.tick(0.016)).toThrow(/unknown spawnId/);
  });
});

describe('Wave 7.D — HUD.phase real-switching via LevelState', () => {
  it('syncs levelState.phase through deployment -> battle -> wave-break for each wave, RunManager ends at Result+victory', () => {
    const game = new Game();
    game.world.ruleEngine.registerHandler('drop_gold', () => {});
    const spawn = vi.fn(spawnUnit);

    const waves: WaveConfig[] = [
      {
        waveNumber: 1,
        spawnDelayMs: 100,
        groups: [{ enemyId: 'grunt', count: 1, intervalMs: 0 }],
      },
      {
        waveNumber: 2,
        spawnDelayMs: 100,
        groups: [{ enemyId: 'grunt', count: 1, intervalMs: 0 }],
      },
    ];
    const spawns: SpawnConfig[] = [{ id: 's1', x: 0, y: 100 }];
    const unitConfigs = new Map([['grunt', GRUNT]]);

    const runManager = new RunManager({ totalLevels: 1 });
    const levelState = new LevelState();
    levelState.reset(waves.length);
    const scenes = {
      mainMenu: { visible: false },
      levelMap: { visible: false },
      battle: { visible: false },
      interLevel: { visible: false },
      shop: { visible: false },
      mystic: { visible: false },
      skillTree: { visible: false },
      runResult: { visible: false },
    };

    let runController!: RunController;
    const waveSystem = createWaveSystem({
      waves,
      spawns,
      unitConfigs,
      waveBreakMs: 200,
      onWaveComplete: () => {},
      onAllWavesComplete: () => { runController.completeCurrentLevel(); },
      spawn,
    });

    game.pipeline.register(waveSystem);
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    runController = new RunController({ game, runManager, scenes, waveSystem, levelState });
    runController.startRun();
    runController.enterBattle();
    waveSystem.start();

    const phaseLog: string[] = [];
    let lastPhase = levelState.phase;
    phaseLog.push(lastPhase);

    function tickAndRecord(dt: number): void {
      runController.tick(dt);
      if (levelState.phase !== lastPhase) {
        lastPhase = levelState.phase;
        phaseLog.push(lastPhase);
      }
    }

    tickAndRecord(0.11);
    expect(levelState.phase).toBe('battle');

    const wave1Eid = spawn.mock.results[0]!.value as number;
    Health.current[wave1Eid] = 0;
    tickAndRecord(0.016);
    expect(levelState.phase).toBe('wave-break');

    tickAndRecord(0.25);
    expect(levelState.phase).toBe('deployment');

    tickAndRecord(0.11);
    expect(levelState.phase).toBe('battle');

    const wave2Eid = spawn.mock.results[1]!.value as number;
    Health.current[wave2Eid] = 0;
    tickAndRecord(0.016);
    expect(levelState.phase).toBe('wave-break');

    tickAndRecord(0.25);

    expect(runManager.phase).toBe(RunPhase.Result);
    expect(runManager.outcome).toBe('victory');

    expect(phaseLog).toEqual([
      'deployment',
      'battle',
      'wave-break',
      'deployment',
      'battle',
      'wave-break',
      'victory',
    ]);
  });
});

describe('Wave 7.C — drop_gold rule handler end-to-end', () => {
  it('killing an enemy with onDeath drop_gold adds gold to EconomySystem via ruleEngine', () => {
    const game = new Game();
    const economy = new EconomySystem({ waveCompleteGold: 0 });
    game.world.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
      const amount = typeof params['amount'] === 'number' ? params['amount'] : 0;
      if (amount > 0) economy.addGold(amount);
    });

    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const eid = spawnUnit(game.world, GRUNT, { x: 0, y: 0 });
    expect(economy.gold).toBe(0);

    game.world.ruleEngine.attachRules(eid, 'onDeath', [
      { handler: 'drop_gold', params: { amount: 5 } },
    ]);

    Health.current[eid] = 0;

    game.tick(0.016);

    expect(economy.gold).toBe(5);
  });
});

describe('Wave 8.A — Gold 单账本回归：drop_gold → RunManager.gold (HUD 真实显示路径)', () => {
  it('drop_gold handler bound to runManager.addGold reflects kill rewards in RunManager.gold', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 1, initialGold: 200 });
    runManager.startRun();

    game.world.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
      const amount = typeof params['amount'] === 'number' ? params['amount'] : 0;
      if (amount > 0) runManager.addGold(amount);
    });

    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const eid = spawnUnit(game.world, GRUNT, { x: 0, y: 0 });
    expect(runManager.gold).toBe(200);

    game.world.ruleEngine.attachRules(eid, 'onDeath', [
      { handler: 'drop_gold', params: { amount: 5 } },
    ]);
    Health.current[eid] = 0;
    game.tick(0.016);

    expect(runManager.gold).toBe(205);
  });

  it('multiple kills accumulate into RunManager.gold (single ledger, no economy drift)', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 1, initialGold: 100 });
    runManager.startRun();

    game.world.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
      const amount = typeof params['amount'] === 'number' ? params['amount'] : 0;
      if (amount > 0) runManager.addGold(amount);
    });

    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    for (let i = 0; i < 3; i += 1) {
      const eid = spawnUnit(game.world, GRUNT, { x: i, y: 0 });
      game.world.ruleEngine.attachRules(eid, 'onDeath', [
        { handler: 'drop_gold', params: { amount: 5 } },
      ]);
      Health.current[eid] = 0;
      game.tick(0.016);
    }

    expect(runManager.gold).toBe(115);
  });

  it('wave-complete bonus added via runManager.addGold appears in RunManager.gold (HUD displays it)', () => {
    const runManager = new RunManager({ totalLevels: 1, initialGold: 200 });
    runManager.startRun();
    const WAVE_COMPLETE_GOLD = 20;

    runManager.addGold(WAVE_COMPLETE_GOLD);

    expect(runManager.gold).toBe(220);
  });
});

describe('Projectile integration: AttackSystem fires, ProjectileSystem travels and hits', () => {
  it('Wave 7.B: AttackSystem spawns a Projectile, ProjectileSystem flies it to the target and applies damage', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    game.pipeline.register(createProjectileSystem());
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const tower = game.world.addEntity();
    addComponent(game.world, Position, tower);
    addComponent(game.world, Faction, tower);
    addComponent(game.world, Attack, tower);
    Position.x[tower] = 0;
    Position.y[tower] = 0;
    Faction.team[tower] = FactionTeam.Player;
    Attack.damage[tower] = 10;
    Attack.range[tower] = 100;
    Attack.cooldown[tower] = 1;
    Attack.cooldownLeft[tower] = 0;
    Attack.projectileSpeed[tower] = 480;

    const enemy = game.world.addEntity();
    addComponent(game.world, Position, enemy);
    addComponent(game.world, Faction, enemy);
    addComponent(game.world, Health, enemy);
    Position.x[enemy] = 50;
    Position.y[enemy] = 0;
    Faction.team[enemy] = FactionTeam.Enemy;
    Health.current[enemy] = 100;
    Health.max[enemy] = 100;

    const projectileQuery = defineQuery([Projectile]);

    game.tick(0.05);
    expect(projectileQuery(game.world).length).toBe(1);
    expect(Health.current[enemy]).toBe(100);

    for (let i = 0; i < 12; i += 1) game.tick(0.02);

    expect(Health.current[enemy]).toBe(90);
    expect(projectileQuery(game.world).length).toBe(0);
  });

  it('Wave 7.B.2: projectile keeps flying in its last direction when the target dies mid-flight', () => {

    const game = new Game();
    game.pipeline.register(createAttackSystem());
    game.pipeline.register(createProjectileSystem());
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const tower = game.world.addEntity();
    addComponent(game.world, Position, tower);
    addComponent(game.world, Faction, tower);
    addComponent(game.world, Attack, tower);
    Position.x[tower] = 0;
    Position.y[tower] = 0;
    Faction.team[tower] = FactionTeam.Player;
    Attack.damage[tower] = 5;
    Attack.range[tower] = 500;
    Attack.cooldown[tower] = 10;
    Attack.cooldownLeft[tower] = 0;
    Attack.projectileSpeed[tower] = 200;

    const target = game.world.addEntity();
    addComponent(game.world, Position, target);
    addComponent(game.world, Faction, target);
    addComponent(game.world, Health, target);
    Position.x[target] = 300;
    Position.y[target] = 0;
    Faction.team[target] = FactionTeam.Enemy;
    Health.current[target] = 100;
    Health.max[target] = 100;

    game.tick(0.05);
    const projectileQuery = defineQuery([Projectile]);
    const inflight = projectileQuery(game.world)[0]!;
    expect(Projectile.vx[inflight]).toBeCloseTo(200, 1);

    Health.current[target] = 0;

    for (let i = 0; i < 5; i += 1) game.tick(0.05);
    expect(Projectile.vx[inflight]).toBeCloseTo(200, 1);
    expect(Position.x[inflight]).toBeGreaterThan(40);
  });
});

describe('MVP-acceptance: Shop/Mystic 两面板 smoke', () => {
  function makeScenes() {
    return {
      mainMenu: { visible: false },
      levelMap: { visible: false },
      battle: { visible: false },
      interLevel: { visible: false },
      shop: { visible: false },
      mystic: { visible: false },
      runResult: { visible: false },
    };
  }

  it('shop: 选 shop → 进 Shop 相位 → 购买 grunt_card → gold 减少 → closeShop → Battle', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 2, initialGold: 200 });
    const scenes = makeScenes();
    const deckSystem = new DeckSystem({ pool: ['card_spike'], deckSize: 2, rng: makeRng(21) });
    const controller = new RunController({ game, runManager, scenes, deckSystem });

    controller.startRun();
    controller.enterBattle();
    runManager.completeLevel();
    expect(runManager.phase).toBe(RunPhase.InterLevel);

    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);

    controller.pickInterLevel('shop');
    expect(runManager.phase).toBe(RunPhase.Shop);
    expect(scenes.shop.visible).toBe(true);

    const shopPanel = new ShopPanel();
    const shopState = {
      gold: runManager.gold,
      sp: runManager.sp,
      skillPoints: runManager.sp,
      energy: 0,
      energyMax: 10,
      levelIndex: runManager.currentLevel,
      items: [
        { id: 'grunt_card', kind: 'buy-unit-card' as const, label: 'Grunt Card', costGold: 30, grantsCardId: 'grunt_card', stock: 2 },
      ],
    };
    shopPanel.refresh(shopState);

    let purchaseResult: string | null = null;
    shopPanel.setHandler((intent) => {
      if (intent.kind === 'purchase' && intent.result.kind === 'success') {
        const goldCost = runManager.gold - intent.result.newGold;
        if (goldCost > 0) runManager.spendGold(goldCost);
        purchaseResult = intent.result.itemId;
      } else if (intent.kind === 'close') {
        controller.closeShop();
      }
    });

    const goldBefore = runManager.gold;
    shopPanel.triggerPurchase('grunt_card');
    expect(purchaseResult).toBe('grunt_card');
    expect(runManager.gold).toBe(goldBefore - 30);

    shopPanel.triggerClose();
    expect(runManager.phase).toBe(RunPhase.LevelMap);
    expect(scenes.levelMap.visible).toBe(true);
    expect(runManager.currentLevel).toBe(2);

    controller.enterBattle();
    expect(runManager.phase).toBe(RunPhase.Battle);
    expect(scenes.battle.visible).toBe(true);
  });

  it('mystic: 选 mystic → 进 Mystic 相位 → 选事件 → gold 增加 → closeMystic → Battle', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 2, initialGold: 100 });
    const scenes = makeScenes();
    const deckSystem = new DeckSystem({ pool: ['card_spike'], deckSize: 2, rng: makeRng(22) });
    const controller = new RunController({ game, runManager, scenes, deckSystem });

    controller.startRun();
    controller.enterBattle();
    runManager.completeLevel();
    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.pickInterLevel('mystic');
    expect(runManager.phase).toBe(RunPhase.Mystic);

    const mysticPanel = new MysticPanel();
    const mvpEvent = {
      id: 'mvp_gold_reward',
      title: '神秘馈赠',
      description: '获得 10 金币',
      choices: [
        { id: 'take_gold', label: '拾取', effects: [{ type: 'add_gold', amount: 10 }] },
      ],
    };
    mysticPanel.refresh(mvpEvent);
    mysticPanel.setHandler((intent) => {
      if (intent.kind === 'resolve') {
        for (const effect of intent.effects) {
          const e = effect as unknown as { type: string; amount?: number };
          if (e.type === 'add_gold' && typeof e.amount === 'number') {
            runManager.addGold(e.amount);
          }
        }
        controller.closeMystic();
      } else if (intent.kind === 'exit') {
        controller.closeMystic();
      }
    });

    const goldBefore = runManager.gold;
    mysticPanel.triggerChoice('take_gold');
    expect(runManager.gold).toBe(goldBefore + 10);
    expect(runManager.phase).toBe(RunPhase.LevelMap);
    expect(runManager.currentLevel).toBe(2);

    controller.enterBattle();
    expect(runManager.phase).toBe(RunPhase.Battle);
  });

  it('skip: 选 skip → InterLevel 直接回 LevelMap → level++', () => {
    const game = new Game();
    const runManager = new RunManager({ totalLevels: 2, initialGold: 100 });
    const scenes = makeScenes();
    const deckSystem = new DeckSystem({ pool: ['card_spike'], deckSize: 2, rng: makeRng(24) });
    const controller = new RunController({ game, runManager, scenes, deckSystem });

    controller.startRun();
    controller.enterBattle();
    runManager.completeLevel();
    expect(runManager.phase).toBe(RunPhase.InterLevel);

    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);

    controller.returnToLevelMap();
    expect(runManager.phase).toBe(RunPhase.LevelMap);
    expect(runManager.currentLevel).toBe(2);
    expect(scenes.levelMap.visible).toBe(true);
    expect(scenes.interLevel.visible).toBe(false);

    controller.enterBattle();
    expect(runManager.phase).toBe(RunPhase.Battle);
    expect(scenes.battle.visible).toBe(true);
  });

  it('boss node route reaches final boss node on level map', () => {
    const route = ['battle', 'battle', 'boss'] as const;
    const runManager = new RunManager({ totalLevels: route.length, route, initialGold: 100 });

    runManager.startRun();
    runManager.enterBattle();
    runManager.completeLevel();
    runManager.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    runManager.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    runManager.returnToLevelMap();
    runManager.enterBattle();
    runManager.completeLevel();
    runManager.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    runManager.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    runManager.returnToLevelMap();

    expect(runManager.phase).toBe(RunPhase.LevelMap);
    expect(runManager.currentLevel).toBe(3);
    expect(runManager.currentNodeKind).toBe('boss');
  });

  it('boss final node completes directly into Result victory without inter-level', () => {
    const route = ['battle', 'battle', 'boss'] as const;
    const game = new Game();
    const runManager = new RunManager({ totalLevels: route.length, route, initialGold: 100 });
    const scenes = makeScenes();
    const controller = new RunController({ game, runManager, scenes });

    controller.startRun();
    controller.enterBattle();
    runManager.completeLevel();
    runManager.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    runManager.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.returnToLevelMap();

    controller.enterBattle();
    runManager.completeLevel();
    runManager.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    runManager.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.returnToLevelMap();

    controller.enterBattle();
    controller.completeCurrentLevel();

    expect(runManager.phase).toBe(RunPhase.Result);
    expect(runManager.outcome).toBe('victory');
    expect(scenes.runResult.visible).toBe(true);
    expect(scenes.interLevel.visible).toBe(false);
  });

  it('map flow: route node kinds progress correctly across skip/shop/mystic branches', () => {
    const route = ['battle', 'shop', 'mystic', 'boss'] as const;
    const game = new Game();
    const runManager = new RunManager({ totalLevels: route.length, route, initialGold: 100 });
    const scenes = makeScenes();
    const deckSystem = new DeckSystem({ pool: ['card_spike'], deckSize: 2, rng: makeRng(25) });
    const controller = new RunController({ game, runManager, scenes, deckSystem });

    controller.startRun();
    expect(runManager.phase).toBe(RunPhase.LevelMap);
    expect(runManager.currentLevel).toBe(1);
    expect(runManager.currentNodeKind).toBe('battle');

    controller.enterBattle();
    runManager.completeLevel();
    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.returnToLevelMap();
    expect(runManager.phase).toBe(RunPhase.LevelMap);
    expect(runManager.currentLevel).toBe(2);
    expect(runManager.currentNodeKind).toBe('shop');
    expect(scenes.levelMap.visible).toBe(true);

    controller.enterBattle();
    runManager.completeLevel();
    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.pickInterLevel('shop');
    expect(runManager.phase).toBe(RunPhase.Shop);
    controller.closeShop();
    expect(runManager.phase).toBe(RunPhase.LevelMap);
    expect(runManager.currentLevel).toBe(3);
    expect(runManager.currentNodeKind).toBe('mystic');

    controller.enterBattle();
    runManager.completeLevel();
    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.pickInterLevel('mystic');
    expect(runManager.phase).toBe(RunPhase.Mystic);
    controller.closeMystic();
    expect(runManager.phase).toBe(RunPhase.LevelMap);
    expect(runManager.currentLevel).toBe(4);
    expect(runManager.currentNodeKind).toBe('boss');
  });

  it('map flow: level map challenge enters battle and toggles scene visibility on each node', () => {
    const route = ['battle', 'treasure', 'rest', 'boss'] as const;
    const game = new Game();
    const runManager = new RunManager({ totalLevels: route.length, route, initialGold: 100 });
    const scenes = makeScenes();
    const deckSystem = new DeckSystem({ pool: ['card_spike'], deckSize: 2, rng: makeRng(26) });
    const controller = new RunController({ game, runManager, scenes, deckSystem });

    controller.startRun();
    expect(scenes.levelMap.visible).toBe(true);
    expect(scenes.battle.visible).toBe(false);

    controller.enterBattle();
    expect(runManager.phase).toBe(RunPhase.Battle);
    expect(scenes.levelMap.visible).toBe(false);
    expect(scenes.battle.visible).toBe(true);

    runManager.completeLevel();
    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.returnToLevelMap();
    expect(runManager.currentNodeKind).toBe('treasure');
    expect(scenes.levelMap.visible).toBe(true);

    controller.enterBattle();
    runManager.completeLevel();
    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.returnToLevelMap();
    expect(runManager.currentNodeKind).toBe('rest');
    expect(scenes.levelMap.visible).toBe(true);

    controller.enterBattle();
    runManager.completeLevel();
    controller.claimCardReward(runManager.pendingCardReward!.options[0]!.id);
    controller.claimGoldReward(runManager.pendingGoldReward!.options[0]!.id);
    controller.returnToLevelMap();
    expect(runManager.currentNodeKind).toBe('boss');
    expect(scenes.levelMap.visible).toBe(true);

    controller.enterBattle();
    controller.completeCurrentLevel();
    expect(runManager.phase).toBe(RunPhase.Result);
    expect(scenes.runResult.visible).toBe(true);
    expect(scenes.battle.visible).toBe(false);
  });
});
