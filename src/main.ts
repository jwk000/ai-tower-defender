import { defineQuery, hasComponent, removeComponent } from 'bitecs';

import { Container } from 'pixi.js';
import { Game } from './core/Game.js';
import { LevelState } from './core/LevelState.js';
import { RunController } from './core/RunController.js';
import { Crystal, Projectile, SelectedTag, UnitTag } from './core/components.js';

import type { System } from './core/pipeline.js';
import { Renderer } from './render/Renderer.js';
import {
  DeckViewRenderer,
  InterLevelRenderer,
  LevelMapRenderer,
  MainMenuRenderer,
  RunResultRenderer,
  ShopRenderer,
  MysticRenderer,
} from './render/PanelRenderers.js';
import { UIPresenter } from './ui/UIPresenter.js';
import { MainMenu, type MainMenuAction } from './ui/MainMenu.js';
import { HandPanel, type PlayCardIntent } from './ui/HandPanel.js';
import {
  InterLevelPanel,
  type InterLevelIntent,
  type InterLevelOffer,
  type InterLevelState,
} from './ui/InterLevelPanel.js';
import { LevelMapPanel, type LevelEnemyPreview, type LevelMeta } from './ui/LevelMapPanel.js';
import { DeckViewPanel, type CardInstanceEntry, type DeckViewConfirmationState } from './ui/DeckViewPanel.js';
import { ShopPanel, type ShopIntent, type ShopState } from './ui/ShopPanel.js';
import { MysticPanel, type MysticIntent } from './ui/MysticPanel.js';
import { RunResultPanel, type RunResultState } from './ui/RunResultPanel.js';
import { createAttackSystem } from './systems/AttackSystem.js';
import { createBurnSystem } from './systems/BurnSystem.js';
import { createPoisonSystem } from './systems/PoisonSystem.js';
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
import { CombatFeedbackRenderer } from './render/CombatFeedbackRenderer.js';
import { RenderSystem } from './render/RenderSystem.js';
import { CardRegistry } from './unit-system/CardRegistry.js';
import { CardSpawnSystem } from './unit-system/CardSpawnSystem.js';
import { DeckSystem } from './unit-system/DeckSystem.js';
import { EnergySystem } from './unit-system/EnergySystem.js';
import { HandSystem } from './unit-system/HandSystem.js';
import { RunManager, RunPhase } from './unit-system/RunManager.js';
import type { CardSkillTreeConfig } from './unit-system/SkillTreeState.js';
import type { SkillTreeError } from './unit-system/SkillTreeState.js';
import { SaveSystem } from './core/SaveSystem.js';
import {
  loadCardConfigsForLevel,
  type LevelConfig,
  loadUnitConfigsForLevel,
  parseLevelConfig,
  parseMysticEventConfig,
  parseUnitConfigsFromYaml,
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
import soldiersYaml from './config/units/soldiers.yaml?raw';
import towerCardsYaml from './config/cards/towers.yaml?raw';
import soldierCardsYaml from './config/cards/soldiers.yaml?raw';
import spellCardsYaml from './config/cards/spells.yaml?raw';
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
import mysticLuckyMerchantYaml from './config/mystic-events/lucky_merchant.yaml?raw';
import mysticAncientShrineYaml from './config/mystic-events/ancient_shrine.yaml?raw';

const GRID_COLS = 21;
const GRID_ROWS = 9;
const CELL_SIZE = 64;
const BATTLE_VIEW_SCALE = 0.5;
const WORLD_WIDTH = GRID_COLS * CELL_SIZE;
const WORLD_HEIGHT = GRID_ROWS * CELL_SIZE;
const DEFAULT_WORLD_COLS = GRID_COLS;
const DEFAULT_WORLD_ROWS = GRID_ROWS;
const DEFAULT_TILE_COLORS: Readonly<Record<string, number>> = {
  empty: 0x304b3d,
  path: 0x9c7b63,
  blocked: 0x546e7a,
  spawn: 0xff8f00,
  base: 0x1e88e5,
};
const WAVE_COMPLETE_GOLD = 20;
const TOTAL_RUN_LEVELS = 8;
const STARTER_HAND_SIZE = 3;
const BOSS_LEVEL_NUMBER = 8;
const DEFAULT_STARTING_ENERGY = 3;
const ENERGY_REGEN_PER_SECOND = 0.5;
const ENERGY_MAX = 10;
const MANUAL_DRAW_COOLDOWN_SECONDS = 5;
type EnemyMetaRecord = {
  readonly name: string;
  readonly isBoss: boolean;
  readonly isElite: boolean;
};
const STARTER_DECK = [
  'arrow_tower_card',
  'shield_guard_card',
  'spike_trap_card',
  'fireball_card',
] as const;

function starterUnitCardId(cardId: string): string {
  return cardId.endsWith('_card') ? cardId.slice(0, -'_card'.length) : cardId;
}

function buildLevelEnemyPreview(levelConfig: LevelConfig, enemyMetaById: ReadonlyMap<string, EnemyMetaRecord>): LevelEnemyPreview[] {
  const countById = new Map<string, number>();
  for (const wave of levelConfig.waves) {
    for (const group of wave.groups) {
      countById.set(group.enemyId, (countById.get(group.enemyId) ?? 0) + group.count);
    }
  }
  return Array.from(countById.entries())
    .map(([enemyId, count]) => {
      const meta = enemyMetaById.get(enemyId);
      return {
        enemyId,
        name: meta?.name ?? enemyId,
        count,
        isBoss: meta?.isBoss ?? false,
        isElite: meta?.isElite ?? false,
      };
    })
    .sort((a, b) => {
      if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
      if (a.isElite !== b.isElite) return a.isElite ? -1 : 1;
      return b.count - a.count;
    })
    .slice(0, 5);
}

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

  const allLevelConfigs: LevelConfig[] = [
    level01Yaml, level02Yaml, level03Yaml, level04Yaml,
    level05Yaml, level06Yaml, level07Yaml, level08Yaml,
  ].map((yaml) => parseLevelConfig(yaml));
  const enemyMetaById = new Map(
    parseUnitConfigsFromYaml(enemiesYaml)
      .filter((cfg) => cfg.category === 'Enemy')
      .map((cfg) => [cfg.id, {
        name: cfg.name ?? cfg.id,
        isBoss: cfg.isBoss === true,
        isElite: cfg.id.endsWith('_elite') || cfg.isBoss === true,
      } satisfies EnemyMetaRecord]),
  );

  const ALL_LEVEL_METAS: LevelMeta[] = allLevelConfigs.map((cfg, index) => ({
    name: cfg.name ?? cfg.id,
    description: cfg.description ?? '',
    waveCount: cfg.waves.length,
    kind: index === allLevelConfigs.length - 1 ? 'boss' : undefined,
    enemyPreview: buildLevelEnemyPreview(cfg, enemyMetaById),
  }));

  const level = parseLevelConfig(level01Yaml);
  const unitYamlFiles = new Map<string, string>([
    ['units/enemies.yaml', enemiesYaml],
    ['units/towers.yaml', towerUnitsYaml],
    ['units/soldiers.yaml', soldiersYaml],
  ]);
  const cardYamlFiles = new Map<string, string>([
    ['cards/towers.yaml', towerCardsYaml],
    ['cards/soldiers.yaml', soldierCardsYaml],
    ['cards/spells.yaml', spellCardsYaml],
  ]);
  const unitConfigs = loadUnitConfigsForLevel(level, unitYamlFiles);
  const cardConfigs = loadCardConfigsForLevel(level, cardYamlFiles);
  const skillTreeConfigByUnitId = new Map<string, CardSkillTreeConfig>();
  const towerUnitIds = ['arrow_tower', 'cannon_tower', 'ice_tower', 'fire_tower', 'poison_tower', 'lightning_tower', 'laser_tower', 'bat_tower'];
  const soldierUnitIds = ['shield_guard', 'swordsman', 'archer', 'priest', 'engineer', 'assassin'];
  for (const unitId of towerUnitIds) {
    const config = parseSkillTreeFromUnitYaml(unitId, towerUnitsYaml);
    if (config) skillTreeConfigByUnitId.set(unitId, config);
  }
  for (const unitId of soldierUnitIds) {
    const config = parseSkillTreeFromUnitYaml(unitId, soldiersYaml);
    if (config) skillTreeConfigByUnitId.set(unitId, config);
  }

  const renderer = new Renderer({
    canvas,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    cellSize: CELL_SIZE,
    worldScale: BATTLE_VIEW_SCALE,
  });
  await renderer.init();

  const mainMenuContainer = new Container();
  const levelMapContainer = new Container();
  const battleContainer = new Container();
  const interLevelContainer = new Container();
  const shopContainer = new Container();
  const mysticContainer = new Container();
  const runResultContainer = new Container();
  const deckViewContainer = new Container();
  renderer.uiLayer.addChild(
    mainMenuContainer,
    levelMapContainer,
    battleContainer,
    interLevelContainer,
    shopContainer,
    mysticContainer,
    runResultContainer,
    deckViewContainer,
  );

  const cardRegistry = new CardRegistry();
  for (const unit of unitConfigs.values()) {
    cardRegistry.registerUnit(unit);
  }
  for (const card of cardConfigs) {
    cardRegistry.registerCard(card);
  }

  // D2: 16 事件池（按 4.3 覆盖事件结构补齐已存在 YAML）
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
    mysticLuckyMerchantYaml,
    mysticAncientShrineYaml,
  ].map(parseMysticEventConfig);

  function pickMysticEvent(): MysticEventConfig {
    const idx = Math.floor(Math.random() * MYSTIC_EVENT_POOL.length);
    return MYSTIC_EVENT_POOL[idx]!;
  }

  let currentLevelConfig: LevelConfig = level;
  let deckSystem = new DeckSystem({ pool: STARTER_DECK, deckSize: STARTER_DECK.length, rng: Math.random });
  deckSystem.initWithCards(STARTER_DECK);
  const handSystem = new HandSystem({ maxSize: 4 });
  let energySystem!: EnergySystem;
  let cardSpawnSystem!: CardSpawnSystem;

  const levelState = new LevelState();
  levelState.reset(level.waves.length);

  const game = new Game();

  const runManager = new RunManager({
    totalLevels: TOTAL_RUN_LEVELS,
    initialGold: level.startingGold ?? 200,
  });
  energySystem = buildEnergySystem(level.startingEnergy ?? DEFAULT_STARTING_ENERGY);
  cardSpawnSystem = new CardSpawnSystem(cardRegistry, {
    playerSoldierHpBonus: runManager.getPlayerSoldierHpBonusFromRelics(),
    playerSoldierAttackBonus: runManager.getPlayerSoldierAttackBonusFromRelics(),
  });

  // Run 级统计（仅用于 RunResult 展示，不参与玩法逻辑）
  const runStats = {
    enemiesKilled: 0,
    goldSpent: 0,
    runStartMs: 0,
    runEndMs: 0,
  };

  game.ruleEngine.registerHandler('return_card_to_deck', (_eid, params) => {
    const cardId = typeof params?.cardId === 'string' ? params.cardId : null;
    if (cardId) {
      deckSystem.discard(cardId);
    }
  });

  game.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
    const amount = typeof params?.amount === 'number' ? params.amount : 0;
    if (amount > 0) {
      runManager.addGold(amount);
      runStats.goldSpent += amount;
    }
    runStats.enemiesKilled += 1;
  });

  game.ruleEngine.registerHandler('boost_attack_speed', () => {});

  game.ruleEngine.registerHandler('add_extra_target', () => {});

  game.ruleEngine.registerHandler('deal_aoe_damage', (_eid, params) => {
    const position = params?.position;
    if (!position || typeof position !== 'object') return;
    const x = typeof (position as { x?: unknown }).x === 'number' ? (position as { x: number }).x : 0;
    const y = typeof (position as { y?: unknown }).y === 'number' ? (position as { y: number }).y : 0;
    const radius = typeof params?.radius === 'number' ? params.radius : 48;
    combatFeedbackRenderer.recordSpellImpact(x, y, radius);
  });

  const noopHandlers = [
    'play_sound', 'play_effect', 'flash_color', 'change_color', 'visual_flash_loop',
    'stat_change', 'apply_buff', 'hp_bar_boss', 'enter_phase2', 'enter_phase3',
    'spawn_unit', 'split_into', 'release_spore_cloud', 'create_poison_pool',
    'spawn_portal', 'cancel_marks', 'boss_death', 'final_victory',
    'spawn_projectile', 'spawn_lightning_bolt', 'spawn_laser_beam', 'spawn_bat_swarm',
    'spawn_missile',
    'pause_world', 'start_timer', 'leave_ruins',
  ];
  for (const name of noopHandlers) {
    game.ruleEngine.registerHandler(name, () => {});
  }

  let runController!: RunController;
  let drawCooldownRemaining = 0;
  let pendingReroll = false;

  function tryManualDraw(): void {
    console.info('[draw] tryManualDraw', {
      handSize: handSystem.size,
      pendingReroll,
      drawCooldownRemaining,
      drawPileSize: deckSystem.drawPileSize,
      discardPileSize: deckSystem.discardPileSize,
    });
    if (handSystem.size >= 4) {
      console.info('[draw] blocked', { reason: 'full-hand' });
      return;
    }
    if (pendingReroll) {
      console.info('[draw] blocked', { reason: 'pending-reroll' });
      return;
    }
    if (drawCooldownRemaining > 0) {
      console.info('[draw] blocked', { reason: 'cooldown', drawCooldownRemaining });
      return;
    }
    const result = handSystem.drawOne(deckSystem);
    console.info('[draw] drawOne result', result);
    if (!result.ok) return;
    pendingReroll = true;
  }

  function tryRerollLatestDraw(): void {
    console.info('[draw] tryRerollLatestDraw', {
      handSize: handSystem.size,
      pendingReroll,
      drawCooldownRemaining,
      drawPileSize: deckSystem.drawPileSize,
      discardPileSize: deckSystem.discardPileSize,
    });
    if (!pendingReroll) {
      console.info('[draw] blocked', { reason: 'no-pending-reroll' });
      return;
    }
    const discardIndex = handSystem.size - 1;
    if (discardIndex < 0) {
      console.info('[draw] blocked', { reason: 'invalid-discard-index', discardIndex });
      return;
    }
    const discarded = handSystem.discardFromHand(discardIndex, deckSystem);
    console.info('[draw] discardFromHand result', { discarded, discardIndex });
    if (discarded === null) return;
    const redraw = handSystem.drawOne(deckSystem);
    pendingReroll = false;
    drawCooldownRemaining = MANUAL_DRAW_COOLDOWN_SECONDS;
    console.info('[draw] redraw result', redraw, { drawCooldownRemaining });
    if (!redraw.ok) return;
  }
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
      pathIndexStart: s.pathIndexStart,
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
      onWaveStart: () => {
      },
      onWaveComplete: () => {
        runManager.addGold(WAVE_COMPLETE_GOLD);
      },
      onAllWavesComplete: () => {
        runController.completeCurrentLevel();
      },
    });
  }

  function isPathTile(levelConfig: LevelConfig, row: number, col: number): boolean {
    const tile = levelConfig.tiles[row]?.[col] ?? 'empty';
    return tile === 'path' || tile === 'spawn' || tile === 'base';
  }

  function worldToGrid(levelConfig: LevelConfig, worldX: number, worldY: number): { row: number; col: number } | null {
    const col = Math.floor(worldX / levelConfig.tileSize);
    const row = Math.floor(worldY / levelConfig.tileSize);
    if (col < 0 || row < 0 || col >= levelConfig.mapCols || row >= levelConfig.mapRows) return null;
    return { row, col };
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

  function resolveLevelNumberForCurrentNode(): number {
    return runManager.currentNodeKind === 'boss' ? BOSS_LEVEL_NUMBER : runManager.currentLevel;
  }

  function loadLevel(levelNumber: number): void {
    const { levelConfig, nextUnitConfigs } = loadLevelAssets(levelNumber);
    currentLevelConfig = levelConfig;
    const currentNodeKind = runManager.currentNodeKind;
    const shouldRollLevelModifier = runManager.phase === RunPhase.LevelMap
      && (currentNodeKind === 'battle' || currentNodeKind === 'boss')
      && levelConfig.modifierPool.length > 0
      && !runManager.passiveSources.some(
        (source) => source.sourceType === 'level_modifier' && source.activeScope === 'current_level',
      );
    if (shouldRollLevelModifier) {
      runManager.rollLevelModifier(levelConfig.modifierPool, Math.random);
    }
    renderer.drawLevelBackground({
      mapCols: levelConfig.mapCols,
      mapRows: levelConfig.mapRows,
      tileSize: levelConfig.tileSize,
      tiles: levelConfig.tiles,
      tileColors: { ...DEFAULT_TILE_COLORS, ...levelConfig.tileColors },
      sceneDescription: levelConfig.sceneDescription,
      weather: levelConfig.weather,
    });
    clearBattleEntities();
    battleContainer.visible = runManager.phase === RunPhase.Battle;
    activeWaveSystem = createWaveRuntime(levelConfig, nextUnitConfigs);
    activeMovementSystem = createMovementRuntime(levelConfig);
    levelState.reset(levelConfig.waves.length);
    handSystem.clear();
    for (let i = 0; i < STARTER_HAND_SIZE; i += 1) {
      const result = handSystem.drawOne(deckSystem);
      if (!result.ok) break;
    }
    drawCooldownRemaining = 0;
    pendingReroll = false;
    energySystem = buildEnergySystem(levelConfig.startingEnergy ?? DEFAULT_STARTING_ENERGY);
    cardSpawnSystem = new CardSpawnSystem(cardRegistry, {
      playerSoldierHpBonus: runManager.getPlayerSoldierHpBonusFromRelics(),
      playerSoldierAttackBonus: runManager.getPlayerSoldierAttackBonusFromRelics(),
    });
    devHooks['__td'] = {
      ...(devHooks['__td'] as Record<string, unknown> | undefined),
      deckSystem,
      energySystem,
      cardSpawnSystem,
    };
  }

  const entityRenderer = new EntityRenderer(renderer.entityLayer, game.world);
  const combatFeedbackRenderer = new CombatFeedbackRenderer(renderer.entityLayer);

  game.pipeline.register(waveSystem);
  game.pipeline.register(movementSystem);
  game.pipeline.register(createAttackSystem());
  game.pipeline.register(createProjectileSystem());
  game.pipeline.register(createBurnSystem());
  game.pipeline.register(createPoisonSystem());
  game.pipeline.register(createCrystalSystem());
  game.pipeline.register(createHealthSystem());
  game.pipeline.register(createLifecycleSystem());
  game.pipeline.register(new RenderSystem(entityRenderer));
  game.pipeline.register(combatFeedbackRenderer);

  runController = new RunController({
    game,
    runManager,
    scenes: {
      mainMenu: mainMenuContainer,
      levelMap: levelMapContainer,
      battle: battleContainer,
      interLevel: interLevelContainer,
      shop: shopContainer,
      mystic: mysticContainer,
      runResult: runResultContainer,
    },
    waveSystem,
    levelState,
    deckSystem,
    resolveSkillTreeConfig: (unitCardId) => skillTreeConfigByUnitId.get(unitCardId) ?? null,
    onLevelStart: (levelNumber: number) => {
      loadLevel(levelNumber);
      waveSystem.start();
    },
  });

  const handPanel = new HandPanel({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });

  const presenter = new UIPresenter({
    battleContainer,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    cellSize: CELL_SIZE,
    handPanel,
    cardRegistry,
    onExitBattle: () => {
      runController.failCurrentRun();
    },
    onDebugVictory: () => {
      runController.completeCurrentLevel();
    },
    onDrawCard: () => {
      console.info('[draw] onDrawCard', {
        pendingReroll,
        drawCooldownRemaining,
        handSize: handSystem.size,
      });
      if (pendingReroll) {
        tryRerollLatestDraw();
      } else {
        tryManualDraw();
      }
    },
    screenToWorld: (sx, sy) => renderer.screenToWorld(sx, sy),
    worldToScreen: (wx, wy) => renderer.worldToScreen(wx, wy),
    getLevelConfig: () => currentLevelConfig,
  });

  function startNewRun(): void {
    SaveSystem.clearRun();
    runController.startRun();
    deckSystem = new DeckSystem({ pool: STARTER_DECK, deckSize: STARTER_DECK.length, rng: Math.random });
    deckSystem.initWithCards(STARTER_DECK);
    for (const instance of deckSystem.getCardInstances()) {
      runManager.registerCardInstance(instance.instanceId, { unitCardId: starterUnitCardId(instance.cardId), nodes: [] });
    }
    loadLevel(resolveLevelNumberForCurrentNode());
    runStats.enemiesKilled = 0;
    runStats.goldSpent = 0;
    runStats.runStartMs = 0;
    runStats.runEndMs = 0;
    levelMapRenderer.refresh({
      totalLevels: TOTAL_RUN_LEVELS,
      currentLevelIdx: runManager.currentLevel,
      gold: runManager.gold,
      crystalHp: runManager.crystalHp,
      crystalHpMax: runManager.crystalHpMax,
      runIndex: 1,
      levelMetas: ALL_LEVEL_METAS,
    });
  }

  const mainMenu = new MainMenu({ hasSavedRun: SaveSystem.hasSavedRun() });
  mainMenu.setHandler((action: MainMenuAction) => {
    if (action === 'start-run') {
      startNewRun();
    } else if (action === 'continue-run') {
      if (!runController.loadProgress()) return;
      loadLevel(resolveLevelNumberForCurrentNode());
      runStats.enemiesKilled = 0;
      runStats.goldSpent = 0;
      runStats.runStartMs = performance.now();
      runStats.runEndMs = 0;
      if (runManager.phase === RunPhase.InterLevel) {
        interLevelRenderer.refresh(buildInterLevelState());
      } else {
        levelMapRenderer.refresh({
          totalLevels: TOTAL_RUN_LEVELS,
          currentLevelIdx: runManager.currentLevel,
          gold: runManager.gold,
          crystalHp: runManager.crystalHp,
          crystalHpMax: runManager.crystalHpMax,
          runIndex: 1,
          levelMetas: ALL_LEVEL_METAS,
        });
      }
    } else if (action === 'quit') {
      window.close();
    }
  });

  handPanel.setHandler((intent: PlayCardIntent) => {
    if (intent.kind !== 'play') return;
    const card = cardRegistry.getCard(intent.cardId);
    if (!card) return;
    if (!energySystem.spend(card.energyCost)) return;
    const worldPos = renderer.screenToWorld(intent.targetX, intent.targetY);
    const cell = worldToGrid(currentLevelConfig, worldPos.x, worldPos.y);
    if (!cell) return;
    const { col, row } = cell;
    const isPath = isPathTile(currentLevelConfig, row, col);
    const unitConfigId = card.unitConfigId;
    const unit = unitConfigId ? cardRegistry.getUnit(unitConfigId) : null;
    const category = unit?.category ?? null;
    const isTowerLike = category === 'Tower' || category === 'Building';
    const isPathOnly = category === 'Soldier' || category === 'Trap';
    if ((isTowerLike && isPath) || (isPathOnly && !isPath)) return;
    const snapX = col * currentLevelConfig.tileSize + currentLevelConfig.tileSize / 2;
    const snapY = row * currentLevelConfig.tileSize + currentLevelConfig.tileSize / 2;
    const newEid = cardSpawnSystem.play(game.world, intent.cardId, { x: snapX, y: snapY });
    if (newEid !== null) {
      game.world.ruleEngine.attachRules(newEid, 'onDeath', [
        { handler: 'return_card_to_deck', params: { cardId: intent.cardId } },
      ]);
    } else {
      deckSystem.discard(intent.cardId);
    }
    handSystem.playCard(intent.slot);
    drawCooldownRemaining = MANUAL_DRAW_COOLDOWN_SECONDS;
    pendingReroll = false;
  });

  window.addEventListener('keydown', (event) => {
    if (runManager.phase !== 'Battle') return;
    if (event.key === 'd' || event.key === 'D') {
      if (pendingReroll) {
        tryRerollLatestDraw();
      } else {
        tryManualDraw();
      }
    }
  });
  let shopRenderer!: ShopRenderer;
  let mysticRenderer!: MysticRenderer;
  let levelMapRenderer!: LevelMapRenderer;
  let deckViewRenderer!: DeckViewRenderer;
  let deckViewSelectedInstanceId: string | null = null;
  let deckViewConfirmation: DeckViewConfirmationState | null = null;
  let deckViewMessage: string | null = null;

  const deckViewPanel = new DeckViewPanel();
  deckViewPanel.setHandler((action) => {
    if (action === 'close') {
      deckViewConfirmation = null;
      deckViewMessage = null;
      deckViewContainer.visible = false;
      return;
    }

    if (action.kind === 'select-instance') {
      deckViewSelectedInstanceId = action.instanceId;
      deckViewConfirmation = null;
      deckViewMessage = null;
      deckViewRenderer.refresh(buildDeckViewState());
      return;
    }

    if ('kind' in action && action.kind === 'cancel-confirmation') {
      deckViewConfirmation = null;
      deckViewMessage = null;
      deckViewRenderer.refresh(buildDeckViewState());
      return;
    }

    const currentState = buildDeckViewState();
    const selected = currentState.instances?.find((instance) => instance.instanceId === action.instanceId);
    if (!selected) {
      deckViewConfirmation = null;
      deckViewMessage = '未找到目标卡牌。';
      deckViewRenderer.refresh(buildDeckViewState());
      return;
    }

    if (action.kind === 'request-upgrade') {
      if (!selected.canUpgrade || selected.nextUpgradeCostGold == null) {
        deckViewConfirmation = null;
        deckViewMessage = '该卡牌当前无法升级。';
        deckViewRenderer.refresh(buildDeckViewState());
        return;
      }
      deckViewConfirmation = {
        kind: 'upgrade',
        instanceId: selected.instanceId,
        title: `确认将 ${selected.cardName ?? selected.cardId} 升到下一等级？`,
        description: `将消耗 ${selected.nextUpgradeCostGold} 金币，并把这张卡牌升到下一等级。`,
        confirmLabel: `确认升到下一等级（-${selected.nextUpgradeCostGold} 金币）`,
        cancelLabel: '暂不升级',
      };
      deckViewMessage = null;
      deckViewRenderer.refresh(buildDeckViewState());
      return;
    }

    if (action.kind === 'request-delete') {
      if (!selected.canDelete) {
        deckViewConfirmation = null;
        deckViewMessage = '至少要保留 1 张卡牌。';
        deckViewRenderer.refresh(buildDeckViewState());
        return;
      }
      deckViewConfirmation = {
        kind: 'delete',
        instanceId: selected.instanceId,
        title: `确认删除 ${selected.cardName ?? selected.cardId}？`,
        description: '删除后不会返还已投入的资源，并且本次 run 内无法撤销。',
        confirmLabel: '确认删除',
        cancelLabel: '保留这张卡',
      };
      deckViewMessage = null;
      deckViewRenderer.refresh(buildDeckViewState());
      return;
    }

    if (action.kind === 'confirm-upgrade') {
      const upgraded = runController.upgradeDeckCard(action.instanceId);
      deckViewConfirmation = null;
      deckViewMessage = upgraded
        ? `${selected.cardName ?? selected.cardId} 已升到 Lv.${runManager.getCardLevel(action.instanceId)}。`
        : formatUpgradeFailure(runManager.lastSkillTreeError);
      deckViewRenderer.refresh(buildDeckViewState());
      runController.saveProgress();
      return;
    }

    const removed = runController.removeDeckCard(action.instanceId);
    deckViewConfirmation = null;
    deckViewMessage = removed
      ? `${selected.cardName ?? selected.cardId} 已从卡池移除。`
      : '删除失败，目标卡牌不存在。';
    const nextState = buildDeckViewState();
    if (!nextState.instances?.some((instance) => instance.instanceId === deckViewSelectedInstanceId)) {
      deckViewSelectedInstanceId = nextState.instances?.[0]?.instanceId ?? null;
    }
    deckViewRenderer.refresh(buildDeckViewState());
    runController.saveProgress();
  });

  const interLevelPanel = new InterLevelPanel();
  interLevelPanel.setHandler((intent: InterLevelIntent) => {
    if (intent.kind === 'claim-card-reward') {
      runController.claimCardReward(intent.rewardId);
      interLevelRenderer.refresh(buildInterLevelState());
      runController.saveProgress();
      return;
    }
    if (intent.kind === 'claim-gold-reward') {
      runController.claimGoldReward(intent.rewardId);
      interLevelRenderer.refresh(buildInterLevelState());
      runController.saveProgress();
      return;
    }
    if (intent.kind === 'claim-relic-reward') {
      runController.claimRelicReward(intent.rewardId);
      interLevelRenderer.refresh(buildInterLevelState());
      runController.saveProgress();
      return;
    }
    if (intent.kind === 'claim-upgrade-reward') {
      runController.claimUpgradeReward(intent.rewardId);
      interLevelRenderer.refresh(buildInterLevelState());
      runController.saveProgress();
      return;
    }
    if (intent.kind === 'skip') {
      runController.returnToLevelMap();
      runController.saveProgress();
      return;
    }
    if (intent.kind !== 'enter-node') return;
    runController.pickInterLevel(intent.node);
    if (intent.node === 'shop') {
      shopRenderer.refresh(buildShopState());
    } else if (intent.node === 'mystic') {
      mysticRenderer.refresh(pickMysticEvent());
    }
  });

  const SHOP_UNIT_CARDS = [
    { id: 'arrow_tower_card', label: '箭塔卡', costGold: 30 },
    { id: 'swordsman_card', label: '剑士', costGold: 35 },
    { id: 'shield_guard_card', label: '盾卫', costGold: 40 },
    { id: 'archer_card', label: '弓箭手', costGold: 40 },
    { id: 'engineer_card', label: '工程师', costGold: 55 },
    { id: 'assassin_card', label: '刺客', costGold: 75 },
    { id: 'fireball_card', label: '火球术', costGold: 45 },
    { id: 'spike_trap_card', label: '地刺', costGold: 45 },
    { id: 'gold_mine_card', label: '金矿', costGold: 60 },
    { id: 'energy_crystal_card', label: '能量水晶', costGold: 60 },
    { id: 'cannon_tower_card', label: '炮塔卡', costGold: 60 },
    { id: 'ice_tower_card', label: '冰塔卡', costGold: 60 },
    { id: 'fire_tower_card', label: '火塔卡', costGold: 60 },
    { id: 'poison_tower_card', label: '毒塔卡', costGold: 60 },
    { id: 'priest_card', label: '牧师', costGold: 70 },
    { id: 'lightning_tower_card', label: '电塔卡', costGold: 120 },
    { id: 'laser_tower_card', label: '激光塔卡', costGold: 120 },
    { id: 'crossbow_tower_card', label: '弩塔卡', costGold: 120 },
    { id: 'bat_tower_card', label: '蝙蝠塔卡', costGold: 240 },
    { id: 'missile_tower_card', label: '导弹塔卡', costGold: 320 },
  ];

  function buildEnergySystem(startingEnergy: number): EnergySystem {
    return new EnergySystem({
      regenPerSecond: ENERGY_REGEN_PER_SECOND + runManager.getEnergyRegenBonusFromRelics(),
      max: ENERGY_MAX + runManager.getMaxEnergyBonusFromRelics(),
      startWith: startingEnergy + runManager.getStartEnergyBonusFromRelics(),
    });
  }

  const CARD_REWARD_POOL = [
    { id: 'arrow_tower_card', title: '箭塔卡', description: '稳定单体输出，适合作为基础防线。' },
    { id: 'swordsman_card', title: '剑士', description: '召唤流基础前排，适合低费补线与前期稳场。' },
    { id: 'shield_guard_card', title: '盾卫', description: '召唤流前排核心，帮助拦截高压波次。' },
    { id: 'archer_card', title: '弓箭手', description: '召唤流后排输出位，补足持续清线能力。' },
    { id: 'priest_card', title: '牧师', description: '召唤流续航核心，维持站场与前线血量。' },
    { id: 'engineer_card', title: '工程师', description: '召唤流修复辅助位，适合稳住建筑与前线阵地。' },
    { id: 'assassin_card', title: '刺客', description: '召唤流高爆发切后位，适合快速处理高威胁目标。' },
    { id: 'fireball_card', title: '火球术', description: '范围法术爆发，适合清理密集敌群。' },
    { id: 'spike_trap_card', title: '地刺', description: '建筑/陷阱流起手组件，压低经过路径的敌人血线。' },
    { id: 'gold_mine_card', title: '金矿', description: '建筑流经济核心，适合拉开长期资源差。' },
    { id: 'energy_crystal_card', title: '能量水晶', description: '建筑流能量核心，适合支撑高频出牌与后续爆发。' },
    { id: 'cannon_tower_card', title: '炮塔卡', description: '高伤害塔牌，擅长处理中甲目标。' },
    { id: 'ice_tower_card', title: '冰塔卡', description: '减速控场塔牌，适合拉长怪物受击时间。' },
    { id: 'fire_tower_card', title: '火塔卡', description: '灼烧法系塔牌，适合持续压低敌方血线。' },
    { id: 'poison_tower_card', title: '毒塔卡', description: '中毒消耗塔牌，适合应对长线高血波次。' },
    { id: 'lightning_tower_card', title: '电塔卡', description: '连锁打击能力，适合处理中后期群怪。' },
    { id: 'laser_tower_card', title: '激光塔卡', description: '持续穿透输出，适合后期补强。' },
    { id: 'crossbow_tower_card', title: '弩塔卡', description: '直线穿透输出，适合走廊型关卡。' },
    { id: 'bat_tower_card', title: '蝙蝠塔卡', description: '召唤蝠群牵制战场，适合补足后期站场。' },
    { id: 'missile_tower_card', title: '导弹塔卡', description: '战略级范围打击，适合作为后期终结手段。' },
  ] as const;

  function buildShopState(): ShopState {
    const shuffled = [...SHOP_UNIT_CARDS].sort(() => Math.random() - 0.5);
    const unitSlots = shuffled.slice(0, 4).map((c) => ({
      id: c.id,
      kind: 'buy-unit-card' as const,
      label: c.label,
      costGold: runManager.applyShopDiscount(c.costGold),
      grantsCardId: c.id,
      stock: 1,
    }));
    const funcSlots = [
      { id: 'restore_crystal', kind: 'restore-crystal-hp' as const, label: '水晶恢复 (50%)', costGold: runManager.applyShopDiscount(100), stock: 1 },
      { id: 'recycle_card', kind: 'recycle-card' as const, label: '卡牌回收', costGold: runManager.applyShopDiscount(50), stock: 1 },
    ];
    return {
      gold: runManager.gold,
      energy: 0,
      energyMax: 10,
      levelIndex: runManager.currentLevel,
      items: [...unitSlots, ...funcSlots],
    };
  }

  const shopPanel = new ShopPanel();
  shopPanel.setHandler((intent: ShopIntent) => {
    if (intent.kind === 'purchase') {
      if (intent.result.kind === 'success') {
        const goldCost = runManager.gold - intent.result.newGold;
        if (goldCost > 0) runManager.spendGold(goldCost);
        if (intent.result.itemKind === 'restore-crystal-hp') {
          const toRecover = Math.floor((runManager.crystalHpMax - runManager.crystalHp) * 0.5);
          if (toRecover > 0) runManager.healCrystal(toRecover);
        }
        shopRenderer.refresh(buildShopState());
      }
    } else if (intent.kind === 'close') {
      runController.closeShop();
      runController.saveProgress();
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
      runController.saveProgress();
    } else if (intent.kind === 'exit') {
      runController.closeMystic();
      runController.saveProgress();
    }
  });

  const runResultPanel = new RunResultPanel({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  runResultPanel.setHandler((action) => {
    if (action === 'return-menu') {
      runController.returnToMainMenu();
    } else if (action === 'start-new-run') {
      runController.returnToMainMenu();
      startNewRun();
    }
  });

  const mainMenuRenderer = new MainMenuRenderer(
    { container: mainMenuContainer, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight },
    mainMenu,
    { hasSavedRun: SaveSystem.hasSavedRun() },
  );

  const levelMapPanel = new LevelMapPanel();
  levelMapPanel.setHandler((action) => {
    if (action === 'challenge') {
      if (runStats.runStartMs === 0) runStats.runStartMs = performance.now();
      loadLevel(resolveLevelNumberForCurrentNode());
      runController.enterBattle();
      waveSystem.start();
    } else if (action === 'view-deck') {
      deckViewRenderer.refresh(buildDeckViewState());
      deckViewContainer.visible = true;
    } else if (action === 'back-to-menu') {
      runController.saveProgress();
      runController.returnToMainMenu();
    }
  });
  levelMapRenderer = new LevelMapRenderer(
    { container: levelMapContainer, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight },
    levelMapPanel,
  );
  deckViewContainer.visible = false;
  deckViewRenderer = new DeckViewRenderer(
    { container: deckViewContainer, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight },
    deckViewPanel,
  );

  const interLevelRenderer = new InterLevelRenderer(
    { container: interLevelContainer, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight },
    interLevelPanel,
  );
  const runResultRenderer = new RunResultRenderer(
    { container: runResultContainer, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight },
    runResultPanel,
  );

  shopRenderer = new ShopRenderer(
    { container: shopContainer, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight },
    shopPanel,
  );
  mysticRenderer = new MysticRenderer(
    { container: mysticContainer, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight },
    mysticPanel,
  );
  const devHooks = (globalThis as Record<string, unknown>);
  devHooks['__td'] = {
    mainMenu,
    handPanel,
    interLevelPanel,
    runResultPanel,
    shopPanel,
    mysticPanel,
    levelMapPanel,
    runController,
    runManager,
    levelState,
    waveSystem,
    mainMenuRenderer,
    levelMapRenderer,
    interLevelRenderer,
    runResultRenderer,
    shopRenderer,
    mysticRenderer,
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
    '略过奖励，直接奔赴下一关',
    '不再停留，带着当前构筑继续推进',
    '跳过本次奖励，保留节奏直面挑战',
  ];

  function buildInterLevelOffers(): readonly [InterLevelOffer, InterLevelOffer, InterLevelOffer] {
    const seed = runManager.currentLevel * 7 + runStats.enemiesKilled;
    const pick = (arr: string[]) => arr[seed % arr.length]!;
    return [
      { id: 'shop-offer', kind: 'shop', title: '商店', description: pick(SHOP_DESCS) },
      { id: 'mystic-offer', kind: 'mystic', title: '神秘事件', description: pick(MYSTIC_DESCS) },
      { id: 'skip-offer', kind: 'skip', title: '跳过', description: pick(SKILLTREE_DESCS) },
    ];
  }

  function cardIdToLabel(cardId: string): string {
    return CARD_REWARD_POOL.find((entry) => entry.id === cardId)?.title
      ?? SHOP_UNIT_CARDS.find((entry) => entry.id === cardId)?.label
      ?? cardId;
  }

  function cardIdToUnitCardId(cardId: string): string | null {
    return cardRegistry.getCard(cardId)?.unitConfigId ?? null;
  }

  function buildDeckViewInstances(): CardInstanceEntry[] {
    const rawInstances = deckSystem.getCardInstances();
    const handCardIds = new Set(handSystem.cards);
    for (const cardId of STARTER_DECK) {
      if (!rawInstances.some((instance) => instance.cardId === cardId) && handCardIds.has(cardId)) {
        rawInstances.push({ instanceId: `${cardId}__hand_preview`, cardId, pile: 'hand' });
      }
    }
    const canDeleteAny = rawInstances.length > 1;
    return rawInstances.map((instance) => {
      const unitCardId = cardIdToUnitCardId(instance.cardId);
      const config = unitCardId ? skillTreeConfigByUnitId.get(unitCardId) ?? null : null;
      if (config) {
        runManager.ensureCardInstanceConfig(instance.instanceId, config);
      }
      const nextNode = config ? runManager.getNextUpgradeNode(instance.instanceId) : null;
      const goldCost = nextNode?.goldCost ?? null;
      const canAffordUpgrade = goldCost != null && runManager.gold >= goldCost;
      return {
        instanceId: instance.instanceId,
        cardId: instance.cardId,
        cardName: cardIdToLabel(instance.cardId),
        level: runManager.getCardLevel(instance.instanceId),
        canUpgrade: nextNode !== null && canAffordUpgrade,
        canDelete: canDeleteAny,
        nextUpgradeCostGold: goldCost,
        upgradeLabel: nextNode
          ? canAffordUpgrade
            ? `升到 Lv.${nextNode.level}（-${goldCost} 金币）`
            : `金币不足（升到 Lv.${nextNode.level} 需 ${goldCost}）`
          : '已满级',
        deleteLabel: canDeleteAny ? '删除卡牌' : '至少保留 1 张',
      };
    });
  }

  function buildDeckViewState() {
    const instances = buildDeckViewInstances();
    const selectedInstanceId = instances.some((instance) => instance.instanceId === deckViewSelectedInstanceId)
      ? deckViewSelectedInstanceId
      : instances[0]?.instanceId ?? null;
    deckViewSelectedInstanceId = selectedInstanceId;
    if (deckViewConfirmation && deckViewConfirmation.instanceId !== selectedInstanceId) {
      deckViewConfirmation = null;
    }
    return {
      cardIds: instances.map((instance) => instance.cardId),
      instances,
      selectedInstanceId,
      gold: runManager.gold,
      message: deckViewMessage ?? undefined,
      confirmation: deckViewConfirmation,
      removedCount: 0,
      nextDeleteCostGold: 50,
    };
  }

  function formatUpgradeFailure(reason: SkillTreeError | null): string {
    switch (reason) {
      case 'INSUFFICIENT_GOLD':
        return '金币不足，无法完成升级。';
      case 'NODE_ALREADY_ACTIVE':
        return '该卡牌已经升到当前路径的最高等级。';
      case 'PREREQUISITE_NOT_MET':
        return '升级前置条件未满足。';
      case 'INSTANCE_NOT_FOUND':
        return '目标卡牌不存在。';
      case 'NODE_NOT_FOUND':
        return '升级节点不存在。';
      default:
        return '升级失败，请稍后再试。';
    }
  }

  function buildInterLevelState(): InterLevelState {
    const pendingReward = runManager.pendingCardReward;
    const pendingGoldReward = runManager.pendingGoldReward;
    const pendingRelicReward = runManager.pendingRelicReward;
    const pendingUpgradeReward = runManager.pendingUpgradeReward;
    return {
      mode: pendingReward ? 'card-reward' : pendingGoldReward ? 'gold-reward' : pendingRelicReward ? 'relic-reward' : pendingUpgradeReward ? 'upgrade-reward' : 'branch',
      levelIndex: runManager.currentLevel,
      nextLevel: runManager.currentLevel + 1,
      gold: runManager.gold,
      crystalHpLost: 0,
      offers: buildInterLevelOffers(),
      cardRewards: pendingReward ? pendingReward.options.map((option) => ({
        id: option.id,
        cardId: option.cardId,
        title: option.title,
        description: option.description,
      })) as [
        { id: string; cardId: string; title: string; description: string },
        { id: string; cardId: string; title: string; description: string },
        { id: string; cardId: string; title: string; description: string },
      ] : undefined,
      goldRewards: pendingGoldReward ? pendingGoldReward.options.map((option) => ({
        id: option.id,
        amount: option.amount,
        title: option.title,
        description: option.description,
      })) as [
        { id: string; amount: number; title: string; description: string },
        { id: string; amount: number; title: string; description: string },
        { id: string; amount: number; title: string; description: string },
      ] : undefined,
      relicRewards: pendingRelicReward ? pendingRelicReward.options.map((option) => ({
        id: option.id,
        relicId: option.relicId,
        title: option.title,
        description: option.description,
        category: option.category,
      })) as [
        { id: string; relicId: string; title: string; description: string; category: 'economy' | 'energy' | 'summon' | 'spell' | 'defense' },
        { id: string; relicId: string; title: string; description: string; category: 'economy' | 'energy' | 'summon' | 'spell' | 'defense' },
        { id: string; relicId: string; title: string; description: string; category: 'economy' | 'energy' | 'summon' | 'spell' | 'defense' },
      ] : undefined,
      upgradeRewards: pendingUpgradeReward ? pendingUpgradeReward.options.map((option) => ({
        id: option.id,
        instanceId: option.instanceId,
        cardId: option.cardId,
        title: option.title,
        description: option.description,
        targetLevel: Number(/Lv\.(\d+)/.exec(option.title)?.[1] ?? 0) || undefined,
      })) as [
        { id: string; instanceId: string; cardId: string; title: string; description: string; targetLevel?: number },
        { id: string; instanceId: string; cardId: string; title: string; description: string; targetLevel?: number },
        { id: string; instanceId: string; cardId: string; title: string; description: string; targetLevel?: number },
      ] : undefined,
    };
  }

  function buildRunResultState(): RunResultState {
    const outcome = runManager.outcome ?? 'defeat';
    const elapsedSeconds = Math.max(
      0,
      Math.floor(((runStats.runEndMs || performance.now()) - runStats.runStartMs) / 1000),
    );
    const levelsCleared = outcome === 'victory' ? runManager.currentLevel : Math.max(0, runManager.currentLevel - 1);
    return {
      outcome,
      stats: {
        levelsCleared,
        totalLevels: TOTAL_RUN_LEVELS,
        enemiesKilled: runStats.enemiesKilled,
        maxSingleWaveKills: 0,
        goldSpent: runStats.goldSpent,
        crystalHpRemaining: runManager.crystalHp,
        crystalHpMax: runManager.crystalHpMax,
        elapsedSeconds,
      },
    };
  }

  function onWindowResize(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    renderer.resize(vw, vh);
    handPanel.resize(vw, vh);
    mainMenuRenderer.resize(vw, vh);
    levelMapRenderer.resize(vw, vh);
    interLevelRenderer.resize(vw, vh);
    runResultRenderer.resize(vw, vh);
    shopRenderer.resize(vw, vh);
    mysticRenderer.resize(vw, vh);
    presenter.resize(vw, vh);
  }
  window.addEventListener('resize', onWindowResize);

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
      if (phase === 'LevelMap') {
        levelMapRenderer.refresh({
          totalLevels: TOTAL_RUN_LEVELS,
          currentLevelIdx: runManager.currentLevel,
          gold: runManager.gold,
          crystalHp: runManager.crystalHp,
          crystalHpMax: runManager.crystalHpMax,
          runIndex: 1,
          levelMetas: ALL_LEVEL_METAS,
        });
      } else if (phase === 'InterLevel') {
        interLevelRenderer.refresh(buildInterLevelState());
      } else if (phase === 'Result') {
        runController.saveProgress();
        if (runStats.runEndMs === 0) runStats.runEndMs = now;
        runResultRenderer.refresh(buildRunResultState());
      } else if (phase === 'Idle') {
        mainMenuRenderer.refresh({ hasSavedRun: SaveSystem.hasSavedRun() });
      }
      prevPhase = phase;
    }

    if (phase === 'Battle') {
      if (drawCooldownRemaining > 0) {
        drawCooldownRemaining = Math.max(0, drawCooldownRemaining - dt);
      }
      if (levelState.phase === 'battle' || levelState.phase === 'wave-break') {
        energySystem.tick(dt);
      }
      const drawState = pendingReroll
        ? 'reroll'
        : handSystem.size >= 4
          ? 'full-hand'
          : drawCooldownRemaining > 0
            ? 'cooldown'
            : 'ready';
      const uiFrame = projectUIFrame(runManager, levelState, handSystem, energySystem, cardRegistry, drawState, drawCooldownRemaining);
      handPanel.refresh(uiFrame.hand);
      presenter.present(uiFrame);
    }

    if (deckViewContainer.visible) {
      deckViewRenderer.refresh(buildDeckViewState());
    }
  });
}

function projectUIFrame(
  run: RunManager,
  level: LevelState,
  hand: HandSystem,
  energy: EnergySystem,
  registry: CardRegistry,
  drawState: 'ready' | 'cooldown' | 'full-hand' | 'reroll',
  drawCooldownSeconds: number,
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
      energy: energy.current,
      energyMax: energy.max,
      sp: run.sp,
      runLevel: run.currentLevel,
      runTotalLevels: TOTAL_RUN_LEVELS,
      enemyCount: 0,
      activePassives: run.getActivePassiveHudEntries(),
    },
    hand: {
      cards: handCards,
      energy: energy.current,
      energyMax: energy.max,
      drawState,
      drawCooldownSeconds,
    },
  };
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed', err);
});
