import { defineQuery, hasComponent } from 'bitecs';
import { Container } from 'pixi.js';
import { Game } from './core/Game.js';
import { LevelState } from './core/LevelState.js';
import { RunController } from './core/RunController.js';
import { Crystal, Projectile, UnitTag } from './core/components.js';
import type { System } from './core/pipeline.js';
import { Renderer } from './render/Renderer.js';
import {
  InterLevelRenderer,
  MainMenuRenderer,
  RunResultRenderer,
  ShopRenderer,
  MysticRenderer,
  SkillTreeRenderer,
} from './render/PanelRenderers.js';
import { UIPresenter } from './ui/UIPresenter.js';
import { MainMenu, type MainMenuAction } from './ui/MainMenu.js';
import { HandPanel, type PlayCardIntent } from './ui/HandPanel.js';
import {
  InterLevelPanel,
  type InterLevelIntent,
  type InterLevelOffer,
} from './ui/InterLevelPanel.js';
import { ShopPanel, type ShopIntent, type ShopState } from './ui/ShopPanel.js';
import { MysticPanel, type MysticIntent } from './ui/MysticPanel.js';
import { SkillTreePanel, type SkillTreeIntent, ARROW_TOWER_SKILL_TREE } from './ui/SkillTreePanel.js';
import { RunResultPanel, type RunResultState } from './ui/RunResultPanel.js';
import { createAttackSystem } from './systems/AttackSystem.js';
import { createCrystalSystem } from './systems/CrystalSystem.js';
import { createHealthSystem } from './systems/HealthSystem.js';
import { createLifecycleSystem } from './systems/LifecycleSystem.js';
import { createMovementSystem } from './systems/MovementSystem.js';
import { createProjectileSystem } from './systems/ProjectileSystem.js';
import {
  createWaveSystem,
  type SpawnConfig,
  type WaveConfig,
  type WaveSystem,
} from './systems/WaveSystem.js';
import { EntityRenderer } from './render/EntityRenderer.js';
import { RenderSystem } from './render/RenderSystem.js';
import { CardRegistry } from './unit-system/CardRegistry.js';
import { CardSpawnSystem } from './unit-system/CardSpawnSystem.js';
import { DeckSystem } from './unit-system/DeckSystem.js';
import { EnergySystem } from './unit-system/EnergySystem.js';
import { HandSystem } from './unit-system/HandSystem.js';
import { RunManager } from './unit-system/RunManager.js';
import {
  loadCardConfigsForLevel,
  type LevelConfig,
  loadUnitConfigsForLevel,
  parseLevelConfig,
  parseMysticEventConfig,
  type MysticEventConfig,
  parseSkillTreeFromUnitYaml,
} from './config/loader.js';
import type { HandCard, HandState } from './ui/HandPanel.js';
import type { RunState } from './ui/HUD.js';

import level01Yaml from './config/levels/level-01.yaml?raw';
import level02Yaml from './config/levels/level-02.yaml?raw';
import level03Yaml from './config/levels/level-03.yaml?raw';
import level04Yaml from './config/levels/level-04.yaml?raw';
import level05Yaml from './config/levels/level-05.yaml?raw';
import level06Yaml from './config/levels/level-06.yaml?raw';
import level07Yaml from './config/levels/level-07.yaml?raw';
import level08Yaml from './config/levels/level-08.yaml?raw';
import enemiesYaml from './config/units/enemies.yaml?raw';
import towerUnitsYaml from './config/units/towers.yaml?raw';
import towerCardsYaml from './config/cards/towers.yaml?raw';
import mysticAncientAltarYaml from './config/mystic-events/ancient_altar.yaml?raw';
import mysticHealingSpringYaml from './config/mystic-events/healing_spring.yaml?raw';
import mysticWanderingMerchantYaml from './config/mystic-events/wandering_merchant.yaml?raw';
import mysticMysteriousChestYaml from './config/mystic-events/mysterious_chest.yaml?raw';
import mysticForgeYaml from './config/mystic-events/forge.yaml?raw';
import mysticPactOfBloodYaml from './config/mystic-events/pact_of_blood.yaml?raw';
import mysticArcaneLibraryYaml from './config/mystic-events/arcane_library.yaml?raw';
import mysticWolvesNestYaml from './config/mystic-events/wolves_nest.yaml?raw';
import mysticDivineBlessingYaml from './config/mystic-events/divine_blessing.yaml?raw';
import mysticCursedIdolYaml from './config/mystic-events/cursed_idol.yaml?raw';
import mysticShadowDealerYaml from './config/mystic-events/shadow_dealer.yaml?raw';
import mysticManaWellYaml from './config/mystic-events/mana_well.yaml?raw';
import mysticTravelerCampYaml from './config/mystic-events/traveler_camp.yaml?raw';
import mysticForgottenShrineYaml from './config/mystic-events/forgotten_shrine.yaml?raw';

const GRID_COLS = 21;
const GRID_ROWS = 9;
const CELL_SIZE = 64;
const VIEWPORT_WIDTH = GRID_COLS * CELL_SIZE;
const VIEWPORT_HEIGHT = GRID_ROWS * CELL_SIZE;
const WAVE_COMPLETE_GOLD = 20;
const TOTAL_RUN_LEVELS = 8;
const DEFAULT_DECK_SIZE = 12; // S2 替换：卡组 12 张（per 10-roguelike-loop §2.3）
const DEFAULT_STARTING_ENERGY = 3;
const ENERGY_REGEN_PER_SECOND = 1;
const ENERGY_MAX = 10;

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found in index.html');
  }

  const levelYamlByNumber = new Map<number, string>([
    [1, level01Yaml],
    [2, level02Yaml],
    [3, level03Yaml],
    [4, level04Yaml],
    [5, level05Yaml],
    [6, level06Yaml],
    [7, level07Yaml],
    [8, level08Yaml],
  ]);
  const level = parseLevelConfig(level01Yaml);
  const unitYamlFiles = new Map<string, string>([
    ['units/enemies.yaml', enemiesYaml],
    ['units/towers.yaml', towerUnitsYaml],
  ]);
  const cardYamlFiles = new Map<string, string>([
    ['cards/towers.yaml', towerCardsYaml],
  ]);
  const unitConfigs = loadUnitConfigsForLevel(level, unitYamlFiles);
  const cardConfigs = loadCardConfigsForLevel(level, cardYamlFiles);
  const arrowTowerSkillTree = parseSkillTreeFromUnitYaml('arrow_tower', towerUnitsYaml) ?? ARROW_TOWER_SKILL_TREE;

  const renderer = new Renderer({
    canvas,
    worldWidth: VIEWPORT_WIDTH,
    worldHeight: VIEWPORT_HEIGHT,
    cellSize: CELL_SIZE,
  });
  await renderer.init();

  const mainMenuContainer = new Container();
  const battleContainer = new Container();
  const interLevelContainer = new Container();
  const shopContainer = new Container();
  const mysticContainer = new Container();
  const skillTreeContainer = new Container();
  const runResultContainer = new Container();
  renderer.uiLayer.addChild(
    mainMenuContainer,
    battleContainer,
    interLevelContainer,
    shopContainer,
    mysticContainer,
    skillTreeContainer,
    runResultContainer,
  );

  const cardRegistry = new CardRegistry();
  for (const unit of unitConfigs.values()) {
    cardRegistry.registerUnit(unit);
  }
  for (const card of cardConfigs) {
    cardRegistry.registerCard(card);
  }

  // D2: 14 事件池（S9 替换）
  const MYSTIC_EVENT_POOL: MysticEventConfig[] = [
    mysticAncientAltarYaml,
    mysticHealingSpringYaml,
    mysticWanderingMerchantYaml,
    mysticMysteriousChestYaml,
    mysticForgeYaml,
    mysticPactOfBloodYaml,
    mysticArcaneLibraryYaml,
    mysticWolvesNestYaml,
    mysticDivineBlessingYaml,
    mysticCursedIdolYaml,
    mysticShadowDealerYaml,
    mysticManaWellYaml,
    mysticTravelerCampYaml,
    mysticForgottenShrineYaml,
  ].map(parseMysticEventConfig);

  function pickMysticEvent(): MysticEventConfig {
    const idx = Math.floor(Math.random() * MYSTIC_EVENT_POOL.length);
    return MYSTIC_EVENT_POOL[idx]!;
  }

  let deckSystem = new DeckSystem({ pool: cardConfigs.map((c) => c.id), deckSize: DEFAULT_DECK_SIZE, rng: Math.random });
  const handSystem = new HandSystem({ maxSize: 4 });
  let energySystem = new EnergySystem({
    regenPerSecond: ENERGY_REGEN_PER_SECOND,
    max: ENERGY_MAX,
    startWith: level.startingEnergy ?? DEFAULT_STARTING_ENERGY,
  });
  const cardSpawnSystem = new CardSpawnSystem(cardRegistry);

  const levelState = new LevelState();
  levelState.reset(level.waves.length);

  const game = new Game();

  const runManager = new RunManager({
    totalLevels: TOTAL_RUN_LEVELS,
    initialGold: level.startingGold ?? 200,
  });

  // Run 级统计（仅用于 RunResult 展示，不参与玩法逻辑）
  const runStats = {
    enemiesKilled: 0,
    goldEarned: 0,
    runStartMs: 0,
    runEndMs: 0,
  };

  game.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
    const amount = typeof params?.amount === 'number' ? params.amount : 0;
    if (amount > 0) {
      runManager.addGold(amount);
      runStats.goldEarned += amount;
    }
    runStats.enemiesKilled += 1;
  });

  const noopHandlers = [
    'play_sound', 'play_effect', 'flash_color', 'change_color', 'visual_flash_loop',
    'stat_change', 'apply_buff', 'hp_bar_boss', 'enter_phase2', 'enter_phase3',
    'spawn_unit', 'split_into', 'release_spore_cloud', 'create_poison_pool',
    'spawn_portal', 'cancel_marks', 'boss_death', 'final_victory', 'deal_aoe_damage',
    'spawn_projectile', 'spawn_lightning_bolt', 'spawn_laser_beam', 'spawn_bat_swarm',
    'pause_world', 'start_timer', 'leave_ruins',
  ];
  for (const name of noopHandlers) {
    game.ruleEngine.registerHandler(name, () => {});
  }

  let runController!: RunController;
  const unitQuery = defineQuery([UnitTag]);
  const projectileQuery = defineQuery([Projectile]);

  function buildWaveConfigs(levelConfig: LevelConfig): WaveConfig[] {
    return levelConfig.waves.map((w) => ({
      waveNumber: w.waveNumber,
      spawnDelayMs: w.startDelay * 1000,
      groups: w.groups.map((g) => ({
        enemyId: g.enemyId,
        count: g.count,
        intervalMs: g.interval * 1000,
      })),
    }));
  }

  function buildSpawnConfigs(levelConfig: LevelConfig): SpawnConfig[] {
    return levelConfig.spawns.map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
    }));
  }

  function loadLevelAssets(levelNumber: number) {
    const levelYaml = levelYamlByNumber.get(levelNumber);
    if (!levelYaml) {
      throw new Error(`[bootstrap] missing level YAML for level ${levelNumber}`);
    }
    const levelConfig = parseLevelConfig(levelYaml);
    const nextUnitConfigs = loadUnitConfigsForLevel(levelConfig, unitYamlFiles);
    const nextCardConfigs = loadCardConfigsForLevel(levelConfig, cardYamlFiles);
    for (const unit of nextUnitConfigs.values()) {
      cardRegistry.registerUnit(unit);
    }
    for (const card of nextCardConfigs) {
      if (!cardRegistry.getCard(card.id)) {
        cardRegistry.registerCard(card);
      }
    }
    return {
      levelConfig,
      nextUnitConfigs,
      nextCardConfigs,
    };
  }

  function createWaveRuntime(levelConfig: LevelConfig, nextUnitConfigs: typeof unitConfigs): WaveSystem {
    return createWaveSystem({
      waves: buildWaveConfigs(levelConfig),
      spawns: buildSpawnConfigs(levelConfig),
      unitConfigs: nextUnitConfigs,
      onWaveComplete: () => {
        runManager.addGold(WAVE_COMPLETE_GOLD);
      },
      onAllWavesComplete: () => {
        runController.completeCurrentLevel();
      },
    });
  }

  function createMovementRuntime(levelConfig: LevelConfig): System {
    return createMovementSystem({
      path: levelConfig.path,
      onEnemyReachedEnd: () => {
        runManager.damageCrystal(1);
        if (runManager.crystalHp <= 0) {
          runController.failCurrentRun();
        }
      },
    });
  }

  function clearBattleEntities(): void {
    const toDestroy = new Set<number>();
    for (const eid of unitQuery(game.world)) {
      if (hasComponent(game.world, Crystal, eid)) continue;
      toDestroy.add(eid);
    }
    for (const eid of projectileQuery(game.world)) {
      toDestroy.add(eid);
    }
    for (const eid of toDestroy) {
      game.world.ruleEngine.clearRules(eid);
      game.world.destroyEntity(eid);
    }
    game.world.flushDeferred();
  }

  let activeWaveSystem: WaveSystem = createWaveRuntime(level, unitConfigs);
  let activeMovementSystem: System = createMovementRuntime(level);
  const waveSystem: WaveSystem = {
    name: 'WaveSystemHost',
    phase: 'gameplay',
    get currentWaveIndex(): number {
      return activeWaveSystem.currentWaveIndex;
    },
    get currentPhase() {
      return activeWaveSystem.currentPhase;
    },
    aliveEnemyCount(world) {
      return activeWaveSystem.aliveEnemyCount(world);
    },
    start(): void {
      activeWaveSystem.start();
    },
    update(world, dt): void {
      activeWaveSystem.update(world, dt);
    },
  };
  const movementSystem: System = {
    name: 'MovementSystemHost',
    phase: 'gameplay',
    update(world, dt): void {
      activeMovementSystem.update(world, dt);
    },
  };

  function loadLevel(levelNumber: number): void {
    const { levelConfig, nextUnitConfigs, nextCardConfigs } = loadLevelAssets(levelNumber);
    clearBattleEntities();
    activeWaveSystem = createWaveRuntime(levelConfig, nextUnitConfigs);
    activeMovementSystem = createMovementRuntime(levelConfig);
    levelState.reset(levelConfig.waves.length);
    deckSystem = new DeckSystem({
      pool: nextCardConfigs.map((card) => card.id),
      deckSize: DEFAULT_DECK_SIZE,
      rng: Math.random,
    });
    handSystem.clear();
    handSystem.drawTo(deckSystem);
    energySystem = new EnergySystem({
      regenPerSecond: ENERGY_REGEN_PER_SECOND,
      max: ENERGY_MAX,
      startWith: levelConfig.startingEnergy ?? DEFAULT_STARTING_ENERGY,
    });
    devHooks['__td'] = {
      ...(devHooks['__td'] as Record<string, unknown> | undefined),
      deckSystem,
      energySystem,
    };
  }

  const entityRenderer = new EntityRenderer(renderer.entityLayer);

  game.pipeline.register(waveSystem);
  game.pipeline.register(movementSystem);
  game.pipeline.register(createAttackSystem());
  game.pipeline.register(createProjectileSystem());
  game.pipeline.register(createCrystalSystem());
  game.pipeline.register(createHealthSystem());
  game.pipeline.register(createLifecycleSystem());
  game.pipeline.register(new RenderSystem(entityRenderer));

  runController = new RunController({
    game,
    runManager,
    scenes: {
      mainMenu: mainMenuContainer,
      battle: battleContainer,
      interLevel: interLevelContainer,
      shop: shopContainer,
      mystic: mysticContainer,
      skillTree: skillTreeContainer,
      runResult: runResultContainer,
    },
    waveSystem,
    levelState,
    onLevelStart: (levelNumber: number) => {
      loadLevel(levelNumber);
      waveSystem.start();
    },
  });

  const handPanel = new HandPanel({
    viewportWidth: VIEWPORT_WIDTH,
    viewportHeight: VIEWPORT_HEIGHT,
  });

  const presenter = new UIPresenter({
    battleContainer,
    viewportWidth: VIEWPORT_WIDTH,
    viewportHeight: VIEWPORT_HEIGHT,
    cellSize: CELL_SIZE,
    handPanel,
    cardRegistry,
    onExitBattle: () => {
      runController.failCurrentRun();
    },
  });

  const mainMenu = new MainMenu({ hasSavedRun: false });
  mainMenu.setHandler((action: MainMenuAction) => {
    if (action === 'start-run') {
      runController.startRun();
      loadLevel(1);
      waveSystem.start();
      runStats.enemiesKilled = 0;
      runStats.goldEarned = 0;
      runStats.runStartMs = performance.now();
      runStats.runEndMs = 0;
    }
  });

  handPanel.setHandler((intent: PlayCardIntent) => {
    if (intent.kind !== 'play') return;
    const card = cardRegistry.getCard(intent.cardId);
    if (!card) return;
    if (!energySystem.spend(card.energyCost)) return;
    const col = Math.floor(intent.targetX / CELL_SIZE);
    const row = Math.floor(intent.targetY / CELL_SIZE);
    const snapX = col * CELL_SIZE + CELL_SIZE / 2;
    const snapY = row * CELL_SIZE + CELL_SIZE / 2;
    cardSpawnSystem.play(game.world, intent.cardId, { x: snapX, y: snapY });
    handSystem.playCard(intent.slot);
    deckSystem.discard(intent.cardId);
    handSystem.drawTo(deckSystem);
  });

  let shopRenderer!: ShopRenderer;
  let mysticRenderer!: MysticRenderer;
  let skillTreeRenderer!: SkillTreeRenderer;

  const interLevelPanel = new InterLevelPanel();
  interLevelPanel.setHandler((intent: InterLevelIntent) => {
    if (intent.kind !== 'enter-node') return;
    runController.pickInterLevel(intent.node);
    if (intent.node === 'shop') {
      shopRenderer.refresh(buildShopState());
    } else if (intent.node === 'mystic') {
      mysticRenderer.refresh(pickMysticEvent());
    } else if (intent.node === 'skilltree') {
      skillTreeRenderer.refresh({ config: arrowTowerSkillTree, sp: runManager.sp, purchased: runManager.skillTreeState });
    }
  });

  const SHOP_UNIT_CARDS = [
    { id: 'arrow_tower_card', label: '箭塔卡', costGold: 30 },
    { id: 'cannon_tower_card', label: '炮塔卡', costGold: 60 },
    { id: 'ice_tower_card', label: '冰塔卡', costGold: 60 },
    { id: 'lightning_tower_card', label: '电塔卡', costGold: 120 },
    { id: 'laser_tower_card', label: '激光塔卡', costGold: 120 },
    { id: 'bat_tower_card', label: '蝙蝠塔卡', costGold: 240 },
  ];

  function buildShopState(): ShopState {
    const shuffled = [...SHOP_UNIT_CARDS].sort(() => Math.random() - 0.5);
    const unitSlots = shuffled.slice(0, 4).map((c) => ({
      id: c.id,
      kind: 'unit-card' as const,
      label: c.label,
      costGold: c.costGold,
      grantsCardId: c.id,
      stock: 1,
    }));
    const funcSlots = [
      { id: 'restore_crystal', kind: 'restore-crystal-hp' as const, label: '水晶恢复 (50%)', costGold: 100, stock: 1 },
      { id: 'recycle_card', kind: 'recycle-card' as const, label: '卡牌回收', costGold: 50, stock: 1 },
      { id: 'buy_sp', kind: 'buy-skill-point' as const, label: '技能点 ×1', costGold: 80, grantsSP: 1, stock: 3 },
      { id: 'sp_exchange', kind: 'sp-exchange' as const, label: 'SP 兑换 (50G→1SP)', costGold: 50, grantsSP: 1, stock: 3 },
    ];
    return {
      gold: runManager.gold,
      sp: runManager.sp,
      items: [...unitSlots, ...funcSlots],
    };
  }

  const shopPanel = new ShopPanel();
  shopPanel.setHandler((intent: ShopIntent) => {
    if (intent.kind === 'purchase') {
      if (intent.result.kind === 'success') {
        const goldCost = runManager.gold - intent.result.newGold;
        if (goldCost > 0) runManager.spendGold(goldCost);
        const spGain = intent.result.newSp - runManager.sp;
        if (spGain > 0) runManager.grantSp(spGain);
        if (intent.result.itemKind === 'restore-crystal-hp') {
          const toRecover = Math.floor((runManager.crystalHpMax - runManager.crystalHp) * 0.5);
          if (toRecover > 0) runManager.healCrystal(toRecover);
        }
        shopRenderer.refresh(buildShopState());
      }
    } else if (intent.kind === 'close') {
      runController.closeShop();
    }
  });

  const mysticPanel = new MysticPanel();
  mysticPanel.setHandler((intent: MysticIntent) => {
    if (intent.kind === 'resolve') {
      for (const effect of intent.effects) {
        const e = effect as unknown as { type: string; amount?: number; percent?: number; successChance?: number; goldAmount?: number; spAmount?: number; damageAmount?: number };
        switch (e.type) {
          case 'grant_gold': runManager.addGold(e.amount ?? 0); break;
          case 'grant_sp': runManager.grantSp(e.amount ?? 0); break;
          case 'spend_gold': runManager.spendGold(Math.min(e.amount ?? 0, runManager.gold)); break;
          case 'heal_crystal': runManager.healCrystal(e.amount ?? 0); break;
          case 'deal_crystal_damage': runManager.damageCrystal(e.amount ?? 0); break;
          case 'spend_gold_percent': runManager.spendGold(Math.floor(runManager.gold * ((e.percent ?? 0) / 100))); break;
          case 'grant_gold_or_damage':
            if (Math.random() < (e.successChance ?? 0.7)) {
              runManager.addGold(e.goldAmount ?? 0);
              runManager.grantSp(e.spAmount ?? 0);
            } else {
              runManager.damageCrystal(e.damageAmount ?? 0);
            }
            break;
          case 'grant_sp_tiered': {
            const tiers = (effect as unknown as { tiers: Array<{ minLevel: number; maxLevel: number; amount: number }> }).tiers ?? [];
            const lvl = runManager.currentLevel;
            const tier = tiers.find((t) => lvl >= t.minLevel && lvl <= t.maxLevel);
            if (tier) runManager.grantSp(tier.amount);
            break;
          }
          default:
            break;
        }
      }
      runController.closeMystic();
    } else if (intent.kind === 'exit') {
      runController.closeMystic();
    }
  });

  const skillTreePanel = new SkillTreePanel();
  skillTreePanel.setHandler((intent: SkillTreeIntent) => {
    if (intent.kind === 'unlock') {
      if (intent.result.kind === 'success') {
        const spCost = runManager.sp - intent.result.newSp;
        if (spCost > 0) runManager.spendSp(spCost);
        runManager.unlockSkillNode(intent.result.nodeId);
        skillTreeRenderer.refresh({ config: arrowTowerSkillTree, sp: runManager.sp, purchased: runManager.skillTreeState });
      }
    } else if (intent.kind === 'exit') {
      runController.closeSkillTree();
    }
  });

  const runResultPanel = new RunResultPanel({
    viewportWidth: VIEWPORT_WIDTH,
    viewportHeight: VIEWPORT_HEIGHT,
  });
  runResultPanel.setHandler(() => {
    runController.returnToMainMenu();
  });

  const mainMenuRenderer = new MainMenuRenderer(
    { container: mainMenuContainer, viewportWidth: VIEWPORT_WIDTH, viewportHeight: VIEWPORT_HEIGHT },
    mainMenu,
    { hasSavedRun: false },
  );
  const interLevelRenderer = new InterLevelRenderer(
    { container: interLevelContainer, viewportWidth: VIEWPORT_WIDTH, viewportHeight: VIEWPORT_HEIGHT },
    interLevelPanel,
  );
  const runResultRenderer = new RunResultRenderer(
    { container: runResultContainer, viewportWidth: VIEWPORT_WIDTH, viewportHeight: VIEWPORT_HEIGHT },
    runResultPanel,
  );

  shopRenderer = new ShopRenderer(
    { container: shopContainer, viewportWidth: VIEWPORT_WIDTH, viewportHeight: VIEWPORT_HEIGHT },
    shopPanel,
  );
  mysticRenderer = new MysticRenderer(
    { container: mysticContainer, viewportWidth: VIEWPORT_WIDTH, viewportHeight: VIEWPORT_HEIGHT },
    mysticPanel,
  );
  skillTreeRenderer = new SkillTreeRenderer(
    { container: skillTreeContainer, viewportWidth: VIEWPORT_WIDTH, viewportHeight: VIEWPORT_HEIGHT },
    skillTreePanel,
  );

  const devHooks = (globalThis as Record<string, unknown>);
  devHooks['__td'] = {
    mainMenu,
    handPanel,
    interLevelPanel,
    runResultPanel,
    shopPanel,
    mysticPanel,
    skillTreePanel,
    runController,
    waveSystem,
    mainMenuRenderer,
    interLevelRenderer,
    runResultRenderer,
    shopRenderer,
    mysticRenderer,
    skillTreeRenderer,
    handSystem,
    deckSystem,
    energySystem,
    cardRegistry,
    game,
    presenter,
    renderer,
  };

  const SHOP_DESCS = [
    '花费金币在流动商人处购买新卡牌',
    '淘宝：限时折扣，今日特供',
    '补给站：金币换实力，不留遗憾',
  ];
  const MYSTIC_DESCS = [
    '命运之轮：随机奖励，也可能伴随代价',
    '神秘商人轻声低语，赌不赌？',
    '古老遗迹中的选择：风险与机遇并存',
  ];
  const SKILLTREE_DESCS = [
    '略过此处，直接奔赴下一关',
    '无需驻足，前路更需精力',
    '跳过——保留资源，直面挑战',
  ];

  function buildInterLevelOffers(): readonly [InterLevelOffer, InterLevelOffer, InterLevelOffer] {
    const seed = runManager.currentLevel * 7 + runStats.enemiesKilled;
    const pick = (arr: string[]) => arr[seed % arr.length]!;
    return [
      { id: 'shop-offer', kind: 'shop', title: '商店', description: pick(SHOP_DESCS) },
      { id: 'mystic-offer', kind: 'mystic', title: '神秘事件', description: pick(MYSTIC_DESCS) },
      { id: 'skilltree-offer', kind: 'skilltree', title: '跳过', description: pick(SKILLTREE_DESCS) },
    ];
  }

  function buildRunResultState(): RunResultState {
    const outcome = runManager.outcome ?? 'defeat';
    const elapsedSeconds = Math.max(
      0,
      Math.floor(((runStats.runEndMs || performance.now()) - runStats.runStartMs) / 1000),
    );
    const levelsCleared = outcome === 'victory' ? runManager.currentLevel : Math.max(0, runManager.currentLevel - 1);
    const hpBonus = runManager.crystalHp * 3;
    const killBonus = Math.floor(runStats.enemiesKilled / 5);
    const sparkAwarded = outcome === 'victory' ? Math.min(30, 10 + hpBonus + killBonus) : 0;
    return {
      outcome,
      sparkAwarded,
      stats: {
        levelsCleared,
        totalLevels: TOTAL_RUN_LEVELS,
        enemiesKilled: runStats.enemiesKilled,
        goldEarned: runStats.goldEarned,
        crystalHpRemaining: runManager.crystalHp,
        elapsedSeconds,
      },
    };
  }

  let lastTime = performance.now();
  let prevPhase: typeof runController.phase = runController.phase;
  renderer.app.ticker.add(() => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt <= 0) return;

    runController.tick(dt);

    const phase = runController.phase;
    if (phase !== prevPhase) {
      if (phase === 'InterLevel') {
        interLevelRenderer.refresh({
          nextLevel: runManager.currentLevel + 1,
          offers: buildInterLevelOffers(),
        });
      } else if (phase === 'Result') {
        if (runStats.runEndMs === 0) runStats.runEndMs = now;
        runResultRenderer.refresh(buildRunResultState());
      } else if (phase === 'Idle') {
        mainMenuRenderer.refresh({ hasSavedRun: false });
      }
      prevPhase = phase;
    }

    if (phase === 'Battle') {
      if (levelState.phase === 'battle' || levelState.phase === 'wave-break') {
        energySystem.tick(dt);
      }
      const uiFrame = projectUIFrame(runManager, levelState, handSystem, energySystem, cardRegistry);
      handPanel.refresh(uiFrame.hand);
      presenter.present(uiFrame);
    }
  });
}

function projectUIFrame(
  run: RunManager,
  level: LevelState,
  hand: HandSystem,
  energy: EnergySystem,
  registry: CardRegistry,
): { run: RunState; hand: HandState } {
  const handCards: HandCard[] = hand.cards.map((cardId, i) => {
    const cfg = registry.getCard(cardId);
    const cost = cfg?.energyCost ?? 0;
    return {
      slot: i,
      cardId,
      cost,
      playable: energy.canAfford(cost),
    };
  });
  return {
    run: {
      gold: run.gold,
      crystalHp: run.crystalHp,
      crystalHpMax: run.crystalHpMax,
      waveIndex: level.waveIndex + 1,
      waveTotal: level.waveTotal,
      phase: level.phase,
    },
    hand: {
      cards: handCards,
      energy: energy.current,
    },
  };
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed', err);
});
