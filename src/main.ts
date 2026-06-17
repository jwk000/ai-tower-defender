import { Game } from './core/Game.js';
import { ALL_BUFFS } from './data/buffs.js';
import { ALL_CARDS, LEVEL_1_CARD_POOL, LEVEL_2_CARD_POOL, LEVEL_3_CARD_POOL, LEVEL_4_CARD_POOL, LEVEL_5_CARD_POOL } from './data/cards.js';
import { ENEMY_CONFIGS, SKILL_CONFIGS, TOWER_CONFIGS, UNIT_CONFIGS, UNIT_ID_BY_TYPE, UNIT_TYPE_BY_ID } from './data/gameData.js';
import { LEVELS } from './data/levels/index.js';
import { resolveGraphFromMap } from './level/graph/loaderAdapter.js';
import { AttackSystem } from './systems/AttackSystem.js';
import { BatSwarmSystem } from './systems/BatSwarmSystem.js';
import { BloodParticleSystem } from './systems/BloodParticleSystem.js';
import { BossSystem } from './systems/BossSystem.js';
import { EnemySkillSystem } from './systems/EnemySkillSystem.js';
import { BuffSystem } from './systems/BuffSystem.js';
import { BuildSystem } from './systems/BuildSystem.js';
import { CardDraftSystem } from './systems/CardDraftSystem.js';
import { DeathEffectSystem } from './systems/DeathEffectSystem.js';
import { BoardGlowSystem } from './systems/BoardGlowSystem.js';
import { DecorationSystem } from './systems/DecorationSystem.js';
import { EconomySystem } from './systems/EconomySystem.js';
import { ExplosionEffectSystem } from './systems/ExplosionEffectSystem.js';
import { FadingMarkSystem } from './systems/FadingMarkSystem.js';
import { HandSystem } from './systems/HandSystem.js';
import { HealthSystem } from './systems/HealthSystem.js';
import { EnemySkillParticleSystem } from './systems/EnemySkillParticleSystem.js';
import { InterLevelBuffSystem } from './systems/InterLevelBuffSystem.js';
import { LaserBeamSystem } from './systems/LaserBeamSystem.js';
import { LifecycleSystem } from './systems/LifecycleSystem.js';
import { LightningBoltSystem } from './systems/LightningBoltSystem.js';
import { LightningStormSystem } from './systems/LightningStormSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { ProductionSystem } from './systems/ProductionSystem.js';
import { ProjectileSystem } from './systems/ProjectileSystem.js';
import { RenderSystem, computeSceneLayout } from './systems/RenderSystem.js';
import { ScreenFXSystem } from './systems/ScreenFXSystem.js';
import { ScreenShakeSystem } from './systems/ScreenShakeSystem.js';
import { SkillSystem } from './systems/SkillSystem.js';
import { SlashEffectSystem } from './systems/SlashEffectSystem.js';
import { SoldierAISystem } from './systems/SoldierAISystem.js';
import { SpellProjectileSystem } from './systems/SpellProjectileSystem.js';
import { TileDamageSystem } from './systems/TileDamageSystem.js';
import { TrapSystem } from './systems/TrapSystem.js';
import { UISystem } from './systems/UISystem.js';
import type { LifecycleEvent } from './core/RuleEngine.js';
import type { LifecycleRule } from './config/registry.js';
import { VictoryScreenSystem, type BattleSettlementStats } from './systems/VictoryScreenSystem.js';
import { UnitAnimationSystem } from './systems/UnitAnimationSystem.js';
import { UnitFactory } from './systems/UnitFactory.js';
import { UnitSystem } from './systems/UnitSystem.js';
import { WaveSystem } from './systems/WaveSystem.js';
import { WeatherSystem } from './systems/WeatherSystem.js';
import { LevelIntroSystem } from './systems/LevelIntroSystem.js';
import { GamePhase, GameScreen, TileType, TowerType, UnitType, WeatherType, type InputEvent, type LevelConfig, type MapConfig, type VictoryConfig } from './types/index.js';
import { hitTestHandCard, resolveCardToEntityType, type ResolvedCardEntity } from './ui/LayoutConstants.js';
import { LayoutManager } from './ui/LayoutManager.js';
import { LevelSelectUI } from './ui/LevelSelectUI.js';
import { CardEncyclopediaUI } from './ui/CardEncyclopediaUI.js';
import { EnemyCodexUI } from './ui/EnemyCodexUI.js';
import type { EnemyCodexEntry } from './ui/EnemyCodexUI.js';
import { clearDamageObservers, registerDamageObserver } from './utils/damageUtils.js';
import { ComboKillSystem } from './systems/ComboKillSystem.js';
import { DamageNumberSystem } from './systems/DamageNumberSystem.js';
import { FloatingTextSystem } from './systems/FloatingTextSystem.js';
import { BossSkillAnnouncementSystem } from './systems/BossSkillAnnouncementSystem.js';
import { Music } from './utils/Music.js';
import type { BgmKey } from './utils/Music.js';
import {
  generateSeed,
  getGlobalRandom,
  initGlobalRandom,
} from './utils/Random.js';
import { SaveManager } from './utils/SaveManager.js';
import { Sound } from './utils/Sound.js';
import { normalizeSfxKey } from './utils/Sound.js';
import { areArtResourcesEnabled } from './utils/artResourceSwitch.js';
import { preloadArtAtlasIndex, preloadArtAtlases } from './utils/imageCache.js';
import { hexToRgb } from './utils/visualHelpers.js';
import { DEFAULT_VICTORY_CONFIG } from './config/defaults.js';

// ---- bitecs component stores ----
import {
  Attack,
  BatSwarmMember,
  BatTower,
  BuildingTower,
  Category, CategoryVal,
  DeathEffect,
  Faction, FactionVal,
  Health,
  Movement,
  PlayerControllable, PlayerOwned,
  Position,
  Production,
  ShapeVal,
  Soldier,
  SpellProjectile,
  Tower,
  Trap,
  UnitTag,
  Visual,
  DamageNumberStyle,
  LightningStormSkill,
} from './core/components.js';

import { hasComponent } from './core/World.js';

// ---- Debug system imports ----
import { DebugManager } from './debug/DebugManager.js';

// ---- TowerType numeric ID → enum mapping (matches UnitFactory.TOWER_TYPE_ID) ----
const TOWER_TYPE_BY_ID: TowerType[] = [
  TowerType.Arrow,     // 0
  TowerType.Cannon,    // 1
  TowerType.Ice,       // 2
  TowerType.Lightning, // 3
  TowerType.Laser,     // 4
  TowerType.Bat,       // 5
  TowerType.Missile,   // 6
  TowerType.Fire,      // 7
  TowerType.Poison,    // 8
  TowerType.Ballista,  // 9
];

const CARD_BY_ID = new Map(ALL_CARDS.map((card) => [card.id, card]));
const CARD_DRAG_START_DISTANCE = 12;

interface PendingCardDrag {
  startX: number;
  startY: number;
  cardIndex: number;
  resolved: ResolvedCardEntity;
}

function resolveCardPool(cardIds: readonly string[] | undefined, fallback: typeof LEVEL_1_CARD_POOL): typeof LEVEL_1_CARD_POOL {
  if (!cardIds || cardIds.length === 0) return fallback;
  const resolved = cardIds
    .map((id) => CARD_BY_ID.get(id))
    .filter((card): card is (typeof LEVEL_1_CARD_POOL)[number] => card !== undefined);
  return resolved.length > 0 ? resolved : fallback;
}

function normalizeBgmKey(value: string): BgmKey {
  const fileMatch = value.match(/(?:^|\/)([a-z0-9_]+)\.(?:ogg|mp3)$/);
  return (fileMatch?.[1] ?? value) as BgmKey;
}

// TOWER_TYPE_ID: 从 UnitFactory 导入共享映射

class TowerDefenderGame extends Game {
  private currentScreen: GameScreen = GameScreen.LevelSelect;
  private phase: GamePhase = GamePhase.Deployment;
  private levelSelectUI: any = null;

  private currentLevelId: number = 1;
  private currentMap: MapConfig | null = null;

  private economy!: EconomySystem;
  private waveSystem!: WaveSystem;
  private unitFactory!: UnitFactory;
  private buildSystem!: BuildSystem;
  private uiSystem!: UISystem;
  private skillSystem!: SkillSystem;
  private buffSystem!: BuffSystem;
  private weatherSystem!: WeatherSystem;
  private healthSystem!: HealthSystem;
  /** Entity ID of the base (for checking HP ratio on victory) */
  private baseEntityId: number | null = null;
  private batSwarmSystem!: BatSwarmSystem;
  private laserBeamSystem!: LaserBeamSystem;
  private handSystem!: HandSystem;
  private cardDraftSystem!: CardDraftSystem;
  private interLevelBuffSystem!: InterLevelBuffSystem;
  private victoryScreenSystem!: VictoryScreenSystem;
  private soldierAISystem!: SoldierAISystem;
  private bossSystem!: BossSystem;
  private damageNumberSystem!: DamageNumberSystem;
  private floatingTextSystem!: FloatingTextSystem;
  private comboKillSystem!: ComboKillSystem;
  private bossSkillAnnouncementSystem!: BossSkillAnnouncementSystem;

  // ---- Scene decoration ----
  private decorationSystem!: DecorationSystem;
  private levelIntroSystem!: LevelIntroSystem;
  private boardGlowSystem!: BoardGlowSystem;
  private screenFXSystem!: ScreenFXSystem;
  private screenShakeSystem!: ScreenShakeSystem;
  private tileDamageSystem!: TileDamageSystem;
  private spellProjectileSystem!: SpellProjectileSystem;

  // ---- Debug system ----
  public debugManager: DebugManager;

  // ---- Encyclopedia ----
  private encyclopedia!: CardEncyclopediaUI;

  // ---- Enemy Codex ----
  private enemyCodex!: EnemyCodexUI;

  private unitDragId: number | null = null;
  private pendingCardDrag: PendingCardDrag | null = null;
  private defeatSfxPlayed = false;
  private defeatHandled = false;
  private victoryHandled = false;
  private previousPhase: GamePhase = GamePhase.Deployment;
  private battleTotalDamage = 0;
  private battleEnemiesDefeated = 0;

  private editorOnExit: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    Sound.preload();
    Sound.initUnlock(canvas);
    void preloadArtAtlasIndex();

    // Card encyclopedia — shared across all screens
    this.encyclopedia = new CardEncyclopediaUI(this.renderer);
    this.encyclopedia.onOpen = () => { this.paused = true; };
    this.encyclopedia.onClose = () => { this.paused = false; };

    // Enemy codex — shared across all screens
    this.enemyCodex = new EnemyCodexUI(this.renderer);
    this.enemyCodex.onOpen = () => { this.paused = true; };
    this.enemyCodex.onClose = () => { this.paused = false; };

    // LevelSelectUI — renders level selection menu
    this.levelSelectUI = new LevelSelectUI(
      this.renderer,
      (levelId) => this.startLevel(levelId),
      () => { this.encyclopedia.open(); },
    );

    // Debug manager — global lifetime (design/27): button visible across all screens.
    this.debugManager = new DebugManager(this.world, {
      getEconomy: () => (this.currentScreen === GameScreen.Battle ? this.economy : null),
      getHandSystem: () => (this.currentScreen === GameScreen.Battle ? this.handSystem : null),
      onLevelProgressChanged: () => this.levelSelectUI?.refresh?.(),
      onSkipToVictory: () => this.skipToVictory(),
      onSkipToDefeat: () => this.skipToDefeat(),
      onSkipToFinalWave: () => this.skipToFinalWave(),
    });

    // Wheel event for encyclopedia scroll
    canvas.addEventListener('wheel', (e) => {
      if (this.encyclopedia.isOpen) {
        e.preventDefault();
        this.encyclopedia.handleWheel(e.deltaY);
      } else if (this.enemyCodex.isOpen) {
        e.preventDefault();
        this.enemyCodex.handleWheel(e.deltaY);
      }
    }, { passive: false });

    this.enterLevelSelect();
  }

  // ================================================================
  // Screen Management
  // ================================================================

  private enterLevelSelect(): void {
    this.boardGlowSystem?.dispose();
    if (this.editorOnExit) {
      const cb = this.editorOnExit;
      this.editorOnExit = null;
      cb();
      return;
    }
    this.currentScreen = GameScreen.LevelSelect;
    this.world.reset();
    Music.play('main_menu');
    this.onUpdate = (dt) => {
      this.levelSelectUI?.update?.(dt);
    };
    this.onPostRender = () => {
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.render();
      }
      if (this.enemyCodex.isOpen) {
        this.enemyCodex.render();
      }
    };
    this.onAfterUpdate = null;
    this.input.onPointerDown = (e: InputEvent) => {
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.handleClick(e.x, e.y);
        return;
      }
      if (this.enemyCodex.isOpen) {
        this.enemyCodex.handleClick(e.x, e.y);
        return;
      }
      this.levelSelectUI?.handleClick?.(e.x, e.y);
    };
    this.input.onPointerMove = (e: InputEvent) => {
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.handleMouseMove(e.x, e.y);
        return;
      }
      if (this.enemyCodex.isOpen) {
        this.enemyCodex.handleMouseMove(e.x, e.y);
        return;
      }
      this.levelSelectUI?.handleMouseMove?.(e.x, e.y);
    };
    this.input.onPointerUp = (e: InputEvent) => {
      this.encyclopedia.handleMouseUp(e.x, e.y);
      this.enemyCodex.handleMouseUp(e.x, e.y);
    };
  }

  startLevel(levelId: number): void {
    const config = LEVELS[levelId - 1];
    if (!config) return;

    this.currentLevelId = levelId;
    this.currentScreen = GameScreen.Battle;
    this.phase = GamePhase.Deployment;
    void preloadArtAtlases();

    this.world.reset();
    this.initBattle(config);
  }

  startEndless(): void {
    const config = LEVELS[0];
    if (!config) return;

    this.currentLevelId = 1;
    this.currentScreen = GameScreen.Battle;
    this.phase = GamePhase.Deployment;
    void preloadArtAtlases();

    this.world.reset();
    this.initBattle(config);
  }

  override startBattleWithConfig(config: LevelConfig, options?: import('./core/Game.js').StartBattleOptions): void {
    this.editorOnExit = options?.onExit ?? null;
    this.currentLevelId = 0;
    this.currentScreen = GameScreen.Battle;
    this.phase = GamePhase.Deployment;
    void preloadArtAtlases();
    this.world.reset();
    this.initBattle(config);
  }



  // ================================================================
  // Battle Init
  // ================================================================

  private initBattle(config: LevelConfig): void {
    this.boardGlowSystem?.dispose();
    const runSeed = generateSeed();
    initGlobalRandom(runSeed);

    const map = config.map;
    this.currentMap = map;
    this.defeatSfxPlayed = false;
    this.defeatHandled = false;
    this.victoryHandled = false;
    this.previousPhase = GamePhase.Deployment;
    this.battleTotalDamage = 0;
    this.battleEnemiesDefeated = 0;
    Music.play(Music.getLevelBgm(this.currentLevelId));

    // Select card pool based on level (defined early for use in callbacks)
    const cardPoolByLevel: Record<number, typeof LEVEL_1_CARD_POOL> = {
      1: LEVEL_1_CARD_POOL,
      2: LEVEL_2_CARD_POOL,
      3: LEVEL_3_CARD_POOL,
      4: LEVEL_4_CARD_POOL,
      5: LEVEL_5_CARD_POOL,
    };
    const fallbackPool = cardPoolByLevel[this.currentLevelId] ?? LEVEL_1_CARD_POOL;
    const initialPool = resolveCardPool(config.cardPool, fallbackPool);
    const draftPool = resolveCardPool(config.draftPool, fallbackPool);

    // ---- Create base entity ----
    // 水晶视觉: design/05-presentation.md §5 — 红色菱形复合几何体
    const resolvedGraph = resolveGraphFromMap(map);
    const crystalAnchor = resolvedGraph.pathGraph.nodes.find((n) => n.role === 'crystal_anchor')
      ?? resolvedGraph.pathGraph.nodes[resolvedGraph.pathGraph.nodes.length - 1]!;
    const ts = map.tileSize;
    const layout = computeSceneLayout(map, LayoutManager.DESIGN_W, LayoutManager.DESIGN_H);
    const ox = layout.offsetX;
    const oy = layout.offsetY;
    const baseX = crystalAnchor.col * ts + ts / 2 + ox;
    const baseY = crystalAnchor.row * ts + ts / 2 + oy;
    this.baseEntityId = this.world.createEntity();
    this.world.addComponent(this.baseEntityId, Position, { x: baseX, y: baseY });
    // 使用关卡配置中的水晶 HP，默认为 500（兜底值）
    const crystalHp = config.crystal?.hp ?? 500;
    this.world.addComponent(this.baseEntityId, Health, { current: crystalHp, max: crystalHp });
    const baseRgb = hexToRgb('#7c3aed');  // 紫水晶色（高贵/优雅/神秘主题）
    this.world.addComponent(this.baseEntityId, Visual, {
      shape: ShapeVal.Hexagon,  // 六边形（紫水晶主体）
      colorR: baseRgb.r,
      colorG: baseRgb.g,
      colorB: baseRgb.b,
      size: 32,  // 主体 32px（设计文档 §5）
      alpha: 1,
      facing: 1,
      bobPhase: 0,
      breathPhase: 0,
    });
    this.world.addComponent(this.baseEntityId, Faction, { value: FactionVal.Justice });
    this.world.addComponent(this.baseEntityId, Category, { value: CategoryVal.Objective });
    this.world.addComponent(this.baseEntityId, PlayerOwned);

    // Spawn neutral units from map config (stub)
    this.spawnNeutralUnits(map);

    // ---- Economy ----
    this.economy = new EconomySystem();
    const permaUpgrades = SaveManager.load().permanentUpgrades;
    const startGoldBonus = permaUpgrades?.startingGold ?? 0;
    this.economy.gold = config.startingGold + startGoldBonus;

    // P1-#11: hook damage events to refund combat-guard tracker
    clearDamageObservers();
    registerDamageObserver((targetId, sourceId, _actual) => {
      this.economy.notifyDamaged(targetId);
      if (sourceId !== undefined) this.economy.notifyAttacked(sourceId);
    });

    // P0-1: 伤害数字飘字 — 注册 DamageNumberSystem 的观察者
    this.damageNumberSystem = new DamageNumberSystem();
    registerDamageObserver((targetId, _sourceId, actualDamage) => {
      if (UnitTag.isEnemy[targetId] === 1) {
        this.battleTotalDamage += actualDamage;
      }
      this.damageNumberSystem.enqueueDamage(targetId, actualDamage);
    });

    // 放置提示飘字
    this.floatingTextSystem = new FloatingTextSystem();

    // ---- Wave system ----
    this.waveSystem = new WaveSystem(
      this.world, map, config.waves,
      () => this.phase,
      (p) => { this.phase = p; },
      () => {
        this.weatherSystem.onWaveEnd();
        Music.play('wave_break', 0.5);
      },
      () => {
        // wave start — restore level BGM
        Music.play(Music.getLevelBgm(this.currentLevelId));
      },
      (gold: number) => { this.economy.addGold(gold); },
      (boss) => {
        this.floatingTextSystem.show(this.world, boss.x, boss.y, `${boss.name}出现！`, { r: 255, g: 23, b: 68 });
      },
    );

    // ---- Weather system — init with level config ----
    this.weatherSystem = new WeatherSystem();
    if (config.weatherPool && config.weatherPool.length > 0) {
      const randomIdx = getGlobalRandom().wave.nextInt(0, config.weatherPool.length);
      const initialWeather = config.weatherPool[randomIdx]!;
      this.weatherSystem.init(
        config.weatherPool,
        config.weatherFixed,
        config.weatherChangeInterval,
      );
      this.weatherSystem.setWeather(initialWeather);
    } else {
      this.weatherSystem.init([WeatherType.Sunny]);
    }

    // ---- UnitFactory (统一实体创建) ----
    this.unitFactory = new UnitFactory(this.world);

    // ---- Build system ----
    // v3.0 卡牌流：BuildSystem 不再扣金币（关内部署由 RunContext.energy 在 tryPlayHandCard 扣）。
    // registerBuild 仍以 cost meta 触发，供回收退款机制溯源。
    this.buildSystem = new BuildSystem(
      map,
      () => this.phase,
      (eid, cost) => this.economy.registerBuild(eid, cost),
      this.unitFactory,
    );

    // 放置失败飘字提示
    this.buildSystem.onPlacementDenied = (reason, x, y) => {
      this.floatingTextSystem.show(this.world, x, y, reason);
    };

    if (config.availableTowers.length > 0 && config.availableTowers[0]) {
      this.buildSystem.selectTower(config.availableTowers[0]);
    }

    // ---- Upgrade tower callback (bitecs component access) ----
    const upgradeTower = (entityId: number) => {
      const towerTypeNum = Tower.towerType[entityId];
      if (towerTypeNum === undefined) return;
      const towerLevel = Tower.level[entityId]!;

      const tt = TOWER_TYPE_BY_ID[towerTypeNum];
      if (tt === undefined) return;
      const towerCfg = TOWER_CONFIGS[tt];
      if (!towerCfg) return;
      const maxLevel = towerCfg.upgradeCosts.length + 1;
      if (towerLevel >= maxLevel) return;

      const costIdx = towerLevel - 1;
      const cost = towerCfg.upgradeCosts[costIdx];
      if (cost === undefined) return;

      if (!this.economy.spendGold(cost)) return;

      Tower.level[entityId] = towerLevel + 1;
      Tower.totalInvested[entityId]! += cost;

      // Upgrade visual flash
      Visual.hitFlashTimer[entityId] = 0.2;

      // Bat towers have BatTower component instead of Attack
      if (tt === TowerType.Bat) {
        this.batSwarmSystem.upgradeBatTowerStats(entityId, Tower.level[entityId]!);
      } else {
        const atkDamage = Attack.damage[entityId];
        if (atkDamage !== undefined) {
          Attack.damage[entityId]! += towerCfg.upgradeAtkBonus[costIdx] ?? 0;
          Attack.range[entityId]! += towerCfg.upgradeRangeBonus[costIdx] ?? 0;
        }
        if (tt === TowerType.Lightning && Tower.level[entityId] === 5) {
          LightningStormSkill.timer[entityId] = LightningStormSkill.cooldown[entityId] ?? 10;
        }
        Sound.play('upgrade');
      }
    };

    // ---- Upgrade soldier callback (player-owned units) ----
    const upgradeUnit = (entityId: number) => {
      if (UnitTag.isEnemy[entityId] !== 0) return;
      const curLevel = UnitTag.level[entityId];
      const maxLevel = UnitTag.maxLevel[entityId];
      if (curLevel === undefined || maxLevel === undefined) return;
      if (curLevel >= maxLevel) return;

      const cfg = this.resolveUnitConfig(entityId);
      if (!cfg) return;
      const costIdx = curLevel - 1;
      const cost = cfg.upgradeCosts?.[costIdx];
      if (cost === undefined) return;
      if (!this.economy.spendGold(cost)) return;

      UnitTag.level[entityId] = curLevel + 1;
      UnitTag.totalInvested[entityId]! += cost;

      const hpBonus = cfg.upgradeHpBonus?.[costIdx] ?? 0;
      if (hpBonus > 0) {
        Health.max[entityId]! += hpBonus;
        Health.current[entityId]! += hpBonus;
      }
      const atkBonus = cfg.upgradeAtkBonus?.[costIdx] ?? 0;
      if (atkBonus > 0 && Attack.damage[entityId] !== undefined) {
        Attack.damage[entityId]! += atkBonus;
      }
      // 嘲讽改为无数量上限的自动光环，旧容量成长字段仅保留配置兼容。

      Visual.hitFlashTimer[entityId] = 0.2;
      Sound.play('upgrade');
    };

    // ---- UI system ----
    this.uiSystem = new UISystem(
      this.renderer,
      () => this.phase,
      () => this.economy.gold,
      () => this.waveSystem.currentWave,
      () => this.waveSystem.totalWaves,
      () => this.waveSystem.isActive,
      () => this.buildSystem.selectedTower,
      (type) => {
        this.buildSystem.selectTower(type);
        this.uiSystem.selectedTowerEntityId = null;
      },
      () => this.waveSystem.startWave(),
      upgradeTower,
      (entityType, towerType, unitType, productionType, trapTypeId) => {
        this.buildSystem.startDrag(entityType as 'tower' | 'unit' | 'trap', {
          towerType: towerType ?? undefined,
          unitType: unitType ?? undefined,
          trapTypeId: trapTypeId ?? undefined,
        });
      },
      () => this.buildSystem.dragState,
      () => this.input.pointerPosition,
      null,  // endlessScore removed in v4.0
      null,  // isEndless removed in v4.0
      () => this.waveSystem.skipCountdown(),
      () => { this.gameSpeed = this.gameSpeed === 1.0 ? 2.0 : 1.0; },
      () => { this.paused = true; },
      () => { this.paused = false; },
      () => { location.reload(); },
      () => { this.paused = false; this.enterLevelSelect(); },
      () => this.waveSystem.countdown,
      () => this.gameSpeed,
      () => this.paused,
      () => this.waveSystem.totalSpawned,
      (entityId) => this.recycleEntity(entityId),
      () => this.weatherSystem.weatherName,
      (entityId) => {
        const curHp = Health.current[entityId] ?? 0;
        const maxHp = Health.max[entityId] ?? 1;
        return this.economy.computeRefund(entityId, curHp, maxHp);
      },
      upgradeUnit,
      () => {
        if (this.baseEntityId === null) return null;
        const current = Health.current[this.baseEntityId];
        const max = Health.max[this.baseEntityId];
        if (current === undefined || max === undefined) return null;
        return { current, max };
      },
      () => this.triggerGoldCheat(),
    );

    // ---- Hand System (card management) ----
    this.handSystem = new HandSystem();
    this.handSystem.initialize(initialPool);

    // ---- Create RunContext for UISystem ----
    // UISystem expects runContext with hand, energy, registry, deck
    const cardRegistry = new Map<string, { type: string; rarity: string; energyCost: number; goldCost: number; name: string; description: string }>();
    for (const card of initialPool) {
      cardRegistry.set(card.id, {
        type: card.type,
        rarity: 'common',
        energyCost: 0,
        goldCost: card.goldCost,
        name: card.name,
        description: card.description,
      });
    }
    const handSystemRef = this.handSystem;
    this.world.attachRunContext({
      hand: {
        get state() {
          return {
            hand: handSystemRef.getHand().map(c => c ? {
              cardId: c.id,
              instanceId: c.id,
            } : null),
          };
        },
      },
      energy: { current: 999, max: 999 },
      registry: { get: (id: string) => cardRegistry.get(id) },
      deck: {
        state: {
          drawPile: [],
          discardPile: [],
        },
      },
    });

    // 同步 runContext.registry：当 HandSystem 卡牌库新增卡牌时，更新 runContext 的 registry
    this.handSystem.onCardAddedToLibrary = (cards) => {
      for (const card of cards) {
        cardRegistry.set(card.id, {
          type: card.type,
          rarity: 'common',
          energyCost: 0,
          goldCost: card.goldCost,
          name: card.name,
          description: card.description,
        });
      }
    };

    // ---- Card Draft System (v5.0: 保留但暂不接入精英击杀，后续可能复用) ----
    this.cardDraftSystem = new CardDraftSystem();
    this.cardDraftSystem.onDraftStart = () => {
      this.paused = true;
    };
    this.cardDraftSystem.onDraftComplete = (_addedCardIds) => {
      this.paused = false;
    };
    this.handSystem.addCardsToLibrary(draftPool);

    // ---- Inter-Level Buff System ----
    this.interLevelBuffSystem = new InterLevelBuffSystem();
    this.interLevelBuffSystem.initialize(ALL_BUFFS);
    this.interLevelBuffSystem.onSelectionStart = () => {
      this.paused = true;
    };
    this.interLevelBuffSystem.onSelectionComplete = (_selected) => {
      this.paused = false;
    };

    // ---- Victory Screen System ----
    this.victoryScreenSystem = new VictoryScreenSystem(this.renderer);
    this.victoryScreenSystem.onComplete = () => {
      this.enterLevelSelect();
    };

    // Inject systems into UISystem for overlay rendering
    this.uiSystem.setCardDraftSystem(this.cardDraftSystem);
    this.uiSystem.setInterLevelBuffSystem(this.interLevelBuffSystem);
    this.uiSystem.setEncyclopediaCallback(() => {
      this.encyclopedia.open();
    });
    this.uiSystem.setEnemyCodexCallback(() => {
      this.enemyCodex.open();
    });

    // ---- Enemy Codex: collect unique enemy types from level waves ----
    this.setupEnemyCodex(config);

    // ---- Soldier AI System ----
    this.soldierAISystem = new SoldierAISystem(config.map);

    // ---- Boss System ----
    this.bossSkillAnnouncementSystem = new BossSkillAnnouncementSystem();
    this.bossSystem = new BossSystem(this.bossSkillAnnouncementSystem);

    // ---- Combo Kill System ----
    // 必须在 HealthSystem 之前创建，因为 onEnemyKilled 回调会引用它
    this.comboKillSystem = new ComboKillSystem();

    // ---- Health system ----
    this.healthSystem = new HealthSystem(
      () => this.phase,
      (p) => { this.phase = p; },
      (enemyId) => {
        this.battleEnemiesDefeated += 1;
        Sound.play('enemy_death');
        // v5.1: 随机掉落金币 + 连杀加成 + 飘字
        const baseGold = this.economy.rewardForEnemy(enemyId);
        if (baseGold > 0) {
          const comboMultiplier = this.comboKillSystem.notifyEnemyKilled(enemyId, this.world);
          const totalGold = Math.floor(baseGold * comboMultiplier);
          // 若连杀有加成，补差额
          if (comboMultiplier > 1) {
            this.economy.addGold(totalGold - baseGold);
          }
          Sound.play('gold_earn');

          // v5.1: 金币飘字
          const px = Position.x[enemyId];
          const py = Position.y[enemyId];
          if (px !== undefined && py !== undefined) {
            this.damageNumberSystem.spawnAtPos(
              this.world,
              px, py - 10,
              totalGold,
              DamageNumberStyle.Gold,
            );
          }
        }
        // v5.0: 精英击杀不再触发3选1抽卡（抽卡相关代码保留，后续可能复用）。
        // 最终波次全部敌人死亡 → 胜利
        const isFinalWave = this.waveSystem.currentWave >= this.waveSystem.totalWaves;
        if (isFinalWave && !this.waveSystem.hasAliveEnemies()) {
          this.phase = GamePhase.Victory;
        }
      },
      (unitId) => {
        // v4.0: population system removed — no releaseUnit
        // Death effect for player units
        const posX = Position.x[unitId];
        const posY = Position.y[unitId];
        if (posX !== undefined && posY !== undefined) {
          const effectId = this.world.createEntity();
          this.world.addComponent(effectId, Position, { x: posX, y: posY });
          this.world.addComponent(effectId, Visual, {
            shape: ShapeVal.Circle,
            colorR: 0xf4, colorG: 0x43, colorB: 0x36,
            size: 24,
          });
          this.world.addComponent(effectId, DeathEffect, { duration: 0.3, elapsed: 0, renderedFrames: 0 });
        }
      },
      (batId) => {
        this.batSwarmSystem.onBatDied(batId);
      },
    );

    this.screenShakeSystem = new ScreenShakeSystem();

    // ---- Core systems ----
    const renderSystem = new RenderSystem(
      this.renderer, map,
      () => this.uiSystem.selectedTowerEntityId,
      () => this.uiSystem.selectedUnitEntityId,
      () => this.uiSystem.selectedTrapEntityId,
      () => this.uiSystem.selectedProductionEntityId,
      this.screenShakeSystem,
    );

    // ---- Scene decoration ----
    this.decorationSystem = new DecorationSystem(
      this.renderer, map,
      () => this.weatherSystem.currentWeather,
      () => this.debugManager.isBackgroundImageEnabled(),
      this.currentLevelId,
    );
    this.levelIntroSystem = new LevelIntroSystem(this.renderer, map);
    this.levelIntroSystem.setBaseEntityId(this.baseEntityId!);
    this.boardGlowSystem = new BoardGlowSystem(map);
    this.screenFXSystem = new ScreenFXSystem();
    this.tileDamageSystem = new TileDamageSystem(map);

    const movementSystem = new MovementSystem(map, (phase) => { this.phase = phase; });
    const attackSystem = new AttackSystem(this.weatherSystem, map);
    this.batSwarmSystem = new BatSwarmSystem(this.weatherSystem, this.renderer);
    const unitSystem = new UnitSystem(map);
    const unitAnimationSystem = new UnitAnimationSystem();
    const projectileSystem = new ProjectileSystem(map);
    projectileSystem.damageNumbers = this.damageNumberSystem; // P0-1: DOT 飘字

    this.skillSystem = new SkillSystem(
      () => true,
    );

    this.buffSystem = new BuffSystem();

    const productionSystem = new ProductionSystem(this.economy);
    const trapSystem = new TrapSystem(map.tileSize);
    const deathEffectSystem = new DeathEffectSystem();
    const explosionEffectSystem = new ExplosionEffectSystem();
    const bloodParticleSystem = new BloodParticleSystem();
    const fadingMarkSystem = new FadingMarkSystem();
    const enemySkillParticleSystem = new EnemySkillParticleSystem(this.renderer);
    const lightningBoltSystem = new LightningBoltSystem(this.renderer);
    const lightningStormSystem = new LightningStormSystem(this.renderer);
    this.laserBeamSystem = new LaserBeamSystem(this.renderer);
    this.spellProjectileSystem = new SpellProjectileSystem(this.renderer);
    const slashEffectSystem = new SlashEffectSystem(this.renderer);

    // ---- UI overlay (onPostRender) ----
    this.onPostRender = () => {
      lightningBoltSystem.renderBolts(this.world);
      this.laserBeamSystem.renderBeams(this.world);
      this.tileDamageSystem.render(this.renderer, this.world);
      // Board glow — flowing light band across the map (design-space)
      if (this.currentScreen === GameScreen.Battle) {
        this.boardGlowSystem.renderMoonlightShader(this.renderer.view);
        this.boardGlowSystem.render(this.renderer.context);
      }
      // Weather screen tint (viewport-space — covers entire window)
      if (this.currentScreen === GameScreen.Battle) {
        const tint = this.weatherSystem.screenTint;
        const ctx = this.renderer.context;
        if (ctx && tint !== 'rgba(0,0,0,0)') {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to viewport space
          ctx.fillStyle = tint;
          ctx.fillRect(0, 0, LayoutManager.viewportW, LayoutManager.viewportH);
          ctx.restore();
        }
        // Screen FX overlay (design-space — transform maps to design area)
        this.screenFXSystem.render(ctx, 1 / 60, this.weatherSystem.currentWeather, {
          fogOverlay: map.lighting?.fogOverlay,
          backgroundImageActive: this.debugManager.isBackgroundImageEnabled() && areArtResourcesEnabled(),
        });
        lightningStormSystem.render(this.world);
      }
      // P0-1: 伤害飘字渲染（在场景之上、UI 之下）
      if (this.currentScreen === GameScreen.Battle) {
        const ctx = this.renderer.context;
        if (ctx) {
          this.damageNumberSystem.renderAll(this.world, ctx);
        }
      }
      // 连杀飘字渲染（在伤害飘字之上）
      if (this.currentScreen === GameScreen.Battle) {
        const ctx = this.renderer.context;
        if (ctx) {
          this.comboKillSystem.renderAll(this.world, ctx);
        }
      }
      // 放置提示飘字渲染（在连杀飘字之上）
      if (this.currentScreen === GameScreen.Battle) {
        const ctx = this.renderer.context;
        if (ctx) {
          this.floatingTextSystem.renderAll(this.world, ctx);
          this.bossSkillAnnouncementSystem.renderAll(this.world, ctx);
        }
      }
      this.uiSystem.renderUI();
      this.victoryScreenSystem.render();
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.render();
      }
      if (this.enemyCodex.isOpen) {
        this.enemyCodex.render();
      }
    };

    // ---- Input dispatch for battle ----
    this.input.onPointerDown = (e: InputEvent) => {
      // Encyclopedia overlay consumes all clicks when open
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.handleClick(e.x, e.y);
        return;
      }
      // Enemy codex overlay consumes all clicks when open
      if (this.enemyCodex.isOpen) {
        this.enemyCodex.handleClick(e.x, e.y);
        return;
      }
      // Victory screen overlay consumes all clicks when active
      if (this.victoryScreenSystem.isActive()) {
        this.victoryScreenSystem.handleClick(e.x, e.y);
        return;
      }
      if (this.buildSystem.dragState?.active) return;
      if (this.unitDragId !== null) return;
      const handledByUI = this.uiSystem.handleClick(e.x, e.y);
      if (handledByUI) return;
      if (this.paused) return;

      // Check if clicking on a hand card
      const runContext = this.world.runContext;
      if (runContext) {
        const cards = runContext.hand.state.hand;
        const cardIdx = hitTestHandCard(e.x, e.y, cards.length);
        if (cardIdx >= 0 && cardIdx < cards.length) {
          const card = cards[cardIdx];
          if (card) {
            // Derive unitConfigId from cardId: card_arrow_tower -> arrow_tower
            const unitConfigId = card.cardId.startsWith('card_')
              ? card.cardId.substring(5)
              : card.cardId;
            const resolved = resolveCardToEntityType(unitConfigId);
            console.log('[CardDrag] onPointerDown - cardId:', card.cardId, 'unitConfigId:', unitConfigId, 'resolved:', resolved, 'cardIdx:', cardIdx);
            if (resolved) {
              this.pendingCardDrag = {
                startX: e.x,
                startY: e.y,
                cardIndex: cardIdx,
                resolved,
              };
              return;
            }
          }
        }
      }

      const sceneBottom = RenderSystem.sceneOffsetY + RenderSystem.sceneH;
      if (e.y >= sceneBottom + 8) return;

      const unitId = this.findUnitAt(e.x, e.y);
      if (unitId !== null) {
        this.unitDragId = unitId;
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = unitId;
        this.uiSystem.selectedEntityType = 'unit';
        const posX = Position.x[unitId];
        const posY = Position.y[unitId];
        if (posX !== undefined && posY !== undefined) {
          const ctrlTargetX = PlayerControllable.targetX[unitId];
          const ctrlTargetY = PlayerControllable.targetY[unitId];
          if (ctrlTargetX !== undefined && ctrlTargetY !== undefined) {
            PlayerControllable.targetX[unitId] = posX;
            PlayerControllable.targetY[unitId] = posY;
          }
        }
        return;
      }

      this.handleMapClick(e);
    };

    this.input.onPointerMove = (e: InputEvent) => {
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.handleMouseMove(e.x, e.y);
        return;
      }
      if (this.unitDragId !== null) {
        const ctrlTargetX = PlayerControllable.targetX[this.unitDragId];
        if (ctrlTargetX !== undefined) {
          PlayerControllable.targetX[this.unitDragId] = e.x;
          PlayerControllable.targetY[this.unitDragId] = e.y;
        }
      }
    };

    this.input.onPointerMove = (e: InputEvent) => {
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.handleMouseMove(e.x, e.y);
        return;
      }
      if (this.enemyCodex.isOpen) {
        this.enemyCodex.handleMouseMove(e.x, e.y);
        return;
      }
      if (this.pendingCardDrag && !this.buildSystem.dragState?.active) {
        const dx = e.x - this.pendingCardDrag.startX;
        const dy = e.y - this.pendingCardDrag.startY;
        if (Math.hypot(dx, dy) >= CARD_DRAG_START_DISTANCE) {
          this.startPendingCardDrag();
        }
      }
      if (this.unitDragId !== null) {
        const ctrlTargetX = PlayerControllable.targetX[this.unitDragId];
        if (ctrlTargetX !== undefined) {
          PlayerControllable.targetX[this.unitDragId] = e.x;
          PlayerControllable.targetY[this.unitDragId] = e.y;
        }
      }
    };

    this.input.onPointerUp = (e: InputEvent) => {
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.handleMouseUp(e.x, e.y);
        return;
      }
      if (this.enemyCodex.isOpen) {
        this.enemyCodex.handleMouseUp(e.x, e.y);
        return;
      }
      if (this.unitDragId !== null) {
        this.unitDragId = null;
        return;
      }
      if (this.pendingCardDrag && !this.buildSystem.dragState?.active) {
        this.pendingCardDrag = null;
        return;
      }

      const ds = this.buildSystem.dragState;
      console.log('[CardDrag] onPointerUp called - unitDragId:', this.unitDragId, 'dragState:', this.buildSystem.dragState);
      console.log('[CardDrag] ds:', ds, 'ds?.active:', ds?.active);
      if (ds?.active) {
        const sceneBottom = RenderSystem.sceneOffsetY + RenderSystem.sceneH;
        if (e.y >= sceneBottom + 8) {
          this.buildSystem.cancelDrag();
          return;
        }
        console.log('[CardDrag] entityType:', ds.entityType, 'cardIndex:', ds.cardIndex);
        if (ds.entityType === 'unit') {
          // v5.0: 金币由 spawnUnitAt 在校验通过后扣除，此处仅做检查
          const handCards = this.handSystem.getHand();
          const handCard = ds.cardIndex !== undefined ? handCards[ds.cardIndex] : null;
          if (handCard && this.economy.gold < handCard.goldCost) {
            this.floatingTextSystem.show(this.world, e.x, e.y, '金币不足');
            Sound.play('build_deny');
            this.buildSystem.cancelDrag();
            return;
          }
          const spawnResult = this.spawnUnitAt(e.x, e.y);
          console.log('[CardDrag] spawnUnitAt result:', spawnResult);
          if (spawnResult && ds.cardIndex !== undefined) {
            console.log('[CardDrag] Calling playCard with index:', ds.cardIndex);
            this.handSystem.playCard(ds.cardIndex);
          }
          this.buildSystem.cancelDrag();
        } else if (ds.entityType === 'spell') {
          // 技能卡：在释放位置执行法术效果
          const spellId = ds.spellCardId;
          if (spellId) {
            const insideBoard =
              e.x >= RenderSystem.sceneOffsetX &&
              e.x < RenderSystem.sceneOffsetX + RenderSystem.sceneW &&
              e.y >= RenderSystem.sceneOffsetY &&
              e.y < RenderSystem.sceneOffsetY + RenderSystem.sceneH;
            if (!insideBoard) {
              this.floatingTextSystem.show(this.world, e.x, e.y, '超出地图范围');
              Sound.play('build_deny');
              this.buildSystem.cancelDrag();
              return;
            }
            // v5.0: 校验通过后再扣金币
            const handCards = this.handSystem.getHand();
            const handCard = ds.cardIndex !== undefined ? handCards[ds.cardIndex] : null;
            if (handCard && this.economy.gold < handCard.goldCost) {
              this.floatingTextSystem.show(this.world, e.x, e.y, '金币不足');
              Sound.play('build_deny');
              this.buildSystem.cancelDrag();
              return;
            }
            this.executeSpellAt(spellId, e.x, e.y);
            if (handCard) this.economy.spendGold(handCard.goldCost);
            if (ds.cardIndex !== undefined) {
              this.handSystem.playCard(ds.cardIndex);
            }
            Sound.play('build_place');
          }
          this.buildSystem.cancelDrag();
        } else {
          console.log('[CardDrag] Calling tryDrop...');
          // v5.0: 金币在校验通过后扣除，此处仅做检查
          const handCards = this.handSystem.getHand();
          const handCard = ds.cardIndex !== undefined ? handCards[ds.cardIndex] : null;
          if (handCard && this.economy.gold < handCard.goldCost) {
            this.floatingTextSystem.show(this.world, e.x, e.y, '金币不足');
            Sound.play('build_deny');
            this.buildSystem.cancelDrag();
            return;
          }
          const result = this.buildSystem.tryDrop(e.x, e.y);
          console.log('[CardDrag] tryDrop result:', result, 'cardIndex:', ds.cardIndex);
          if (result !== false && result !== null) {
            // 校验通过后再扣金币
            if (handCard) this.economy.spendGold(handCard.goldCost);
            Sound.play('build_place');
            this.uiSystem.selectedEntityId = result;
            this.uiSystem.selectedEntityType = ds.entityType === 'tower' ? 'tower' :
              ds.entityType === 'trap' ? 'trap' :
                ds.entityType === 'production' ? 'production' : null;
            // 从手牌中移除已使用的卡牌
            if (ds.cardIndex !== undefined) {
              console.log('[CardDrag] Calling playCard with index:', ds.cardIndex);
              this.handSystem.playCard(ds.cardIndex);
            }
          } else if (result === false) {
            Sound.play('build_deny');
          }
        }
      } else {
        console.log('[CardDrag] ds?.active is false or ds is null');
      }
    };

    // ---- Phase transition watcher ----
    this.onUpdate = (dt: number) => {
      if (
        this.currentScreen === GameScreen.Battle &&
        (this.phase === GamePhase.Victory || this.phase === GamePhase.Defeat)
      ) {
        this.debugManager.update();
        this.victoryScreenSystem.update(this.world, dt);
        return;
      }
      this.debugManager.update();
      for (const sys of this.world.systems) {
        sys.update(this.world, dt);
      }
      this.world.cleanupDeadEntities();
    };
    this.onAfterUpdate = (dt: number) => {
      if (this.currentScreen !== GameScreen.Battle) return;

      // BGM: switch on phase change
      if (this.phase !== this.previousPhase) {
        this.previousPhase = this.phase;
        if (this.phase === GamePhase.WaveBreak) {
          Music.play('wave_break');
        } else if (this.phase === GamePhase.Deployment) {
          Music.play(Music.getLevelBgm(this.currentLevelId));
        }
      }

      if (this.phase === GamePhase.Victory) {
        if (!this.victoryHandled) {
          this.victoryHandled = true;
          this.handleVictory();
        }
      } else if (this.phase === GamePhase.Defeat) {
        if (!this.defeatSfxPlayed) {
          Sound.play('defeat');
          this.defeatSfxPlayed = true;
        }
        if (!this.defeatHandled) {
          this.defeatHandled = true;
          this.handleDefeat();
        }
      }
    };

    // ---- Register systems ----
    const lifecycleSystem = new LifecycleSystem();
    this.world.registerSystem(this.weatherSystem);
    this.world.registerSystem(this.handSystem);
    this.world.registerSystem(this.cardDraftSystem);
    this.world.registerSystem(this.interLevelBuffSystem);
    this.world.registerSystem(movementSystem);
    this.world.registerSystem(attackSystem);
    this.world.registerSystem(this.bossSystem);
    this.world.registerSystem(this.bossSkillAnnouncementSystem);
    this.world.registerSystem(lifecycleSystem);
    this.world.registerSystem(new EnemySkillSystem());
    this.world.registerSystem(this.batSwarmSystem);
    this.world.registerSystem(unitSystem);
    this.world.registerSystem(projectileSystem);
    this.world.registerSystem(this.laserBeamSystem);
    this.world.registerSystem(this.skillSystem);
    this.world.registerSystem(this.buffSystem);
    this.world.registerSystem(productionSystem);
    this.world.registerSystem(this.waveSystem);
    this.world.registerSystem(trapSystem);
    this.world.registerSystem(deathEffectSystem);
    this.world.registerSystem(explosionEffectSystem);
    this.world.registerSystem(bloodParticleSystem);
    this.world.registerSystem(fadingMarkSystem);
    this.world.registerSystem(this.tileDamageSystem);
    this.world.registerSystem(this.healthSystem);
    this.world.registerSystem(this.comboKillSystem);     // 连杀系统（在 healthSystem 之后，处理连杀飘字生命周期）
    this.world.registerSystem(this.damageNumberSystem); // P0-1: 伤害飘字（必须在伤害系统之后）
    this.world.registerSystem(this.floatingTextSystem); // 放置提示飘字
    this.world.registerSystem(this.economy);
    this.world.registerSystem(this.buildSystem);
    this.world.registerSystem(this.soldierAISystem);
    this.world.registerSystem(this.spellProjectileSystem);
    this.world.registerSystem(enemySkillParticleSystem);
    this.world.registerSystem(slashEffectSystem);
    this.world.registerSystem(this.decorationSystem);
    this.world.registerSystem(this.levelIntroSystem);   // v4.1: 入场动画（装饰物之后、棋盘之前）
    this.world.registerSystem(this.boardGlowSystem);
    this.world.registerSystem(this.screenShakeSystem);
    this.world.registerSystem(unitAnimationSystem);
    this.world.registerSystem(renderSystem);
    this.world.registerSystem(lightningBoltSystem);
    this.world.registerSystem(lightningStormSystem);
    this.world.registerSystem(this.uiSystem);
    this.world.registerSystem(this.victoryScreenSystem);

    // v4.1: 入场动画完成后启动第一波倒计时
    this.levelIntroSystem.onComplete = () => {
      this.waveSystem.startAutoCountdown(5);
    };
    this.levelIntroSystem.start();
  }

  /** 从关卡波次配置中收集所有唯一敌人类型，生成敌人图鉴数据 */
  private setupEnemyCodex(config: LevelConfig): void {
    const seen = new Set<string>();
    const entries: EnemyCodexEntry[] = [];

    for (const wave of config.waves) {
      for (const group of wave.enemies) {
        if (seen.has(group.enemyType)) continue;
        seen.add(group.enemyType);

        const enemy = ENEMY_CONFIGS[group.enemyType];
        if (!enemy) continue;

        // 类型: Boss > 精英（boss波中的敌人） > 普通
        let type: EnemyCodexEntry['type'] = 'normal';
        if (enemy.isBoss) {
          type = 'boss';
        } else if (wave.isBossWave) {
          // 非 boss 波中出现的敌人通常是精英/强化单位
          type = 'elite';
        }

        // v5.1: 掉落金币范围计算（使用敌人配置的 goldVariance）
        const baseGold = enemy.rewardGold;
        const variance = enemy.goldVariance ?? 0.2;
        let goldMin: number;
        let goldMax: number;
        if (enemy.isBoss) {
          goldMin = Math.floor(baseGold * (1 - variance * 0.5));
          goldMax = Math.ceil(baseGold * (1 + variance * 0.5));
        } else if (type === 'elite') {
          const eliteGold = baseGold * 1.5;
          goldMin = Math.floor(eliteGold * (1 - variance));
          goldMax = Math.ceil(eliteGold * (1 + variance));
        } else {
          goldMin = Math.floor(baseGold * (1 - variance));
          goldMax = Math.ceil(baseGold * (1 + variance));
        }

        entries.push({
          id: group.enemyType,
          name: enemy.name,
          description: enemy.description ?? `${enemy.name} — HP:${enemy.hp} ATK:${enemy.atk} 护甲:${enemy.defense}`,
          type,
          color: enemy.color,
          hp: enemy.hp,
          atk: enemy.atk,
          speed: enemy.speed,
          defense: enemy.defense,
          magicResist: enemy.magicResist ?? 0,
          radius: enemy.radius ?? 16,
          shape: enemy.shape,
          isBoss: enemy.isBoss,
          goldMin,
          goldMax,
        });
      }
    }

    this.enemyCodex.setEntries(entries);
  }

  // ================================================================
  // Victory / Defeat
  // ================================================================

  /** 合并关卡配置的 victory 节与默认值 */
  private resolveVictoryConfig(config: LevelConfig): VictoryConfig {
    const raw = config.victory;
    if (!raw) {
      return {
        ...DEFAULT_VICTORY_CONFIG,
        story: {
          title: config.name,
          paragraphs: [config.description ?? ''],
          summary: config.name,
          showFullStoryOnlyFirst: false,
        },
        audio: { bgm: 'victory', sfx: 'victory' },
      };
    }
    return {
      background: { ...DEFAULT_VICTORY_CONFIG.background, ...raw.background },
      confetti: { ...DEFAULT_VICTORY_CONFIG.confetti, ...raw.confetti },
      typography: { ...DEFAULT_VICTORY_CONFIG.typography, ...raw.typography },
      story: raw.story,
      audio: raw.audio,
    };
  }

  private handleVictory(): void {
    this.phase = GamePhase.Victory;
    let baseHpRatio = 0;
    if (this.baseEntityId !== null) {
      const cur = Health.current[this.baseEntityId];
      const max = Health.max[this.baseEntityId];
      if (cur !== undefined && max !== undefined && max > 0) {
        baseHpRatio = cur / max;
      }
    }
    let stars = 1;
    if (baseHpRatio > 0.6) stars = 2;
    if (baseHpRatio >= 1.0) stars = 3;

    const levelConfig = LEVELS[this.currentLevelId - 1];
    if (!levelConfig) return;

    const victoryConfig = this.resolveVictoryConfig(levelConfig);
    const settlementStats = this.collectSettlementStats(stars);
    const prevCompletion = SaveManager.getLevelCompletion(this.currentLevelId);
    const timesCleared = (prevCompletion?.timesCleared ?? 0) + 1;

    // 保存通关状态
    SaveManager.recordLevelCompletion(this.currentLevelId, stars, victoryConfig.story.summary);
    SaveManager.setStars(this.currentLevelId, stars);
    if (this.currentLevelId < 5) {
      SaveManager.unlockLevel(this.currentLevelId + 1);
    }

    this.levelSelectUI?.refresh?.(this.currentLevelId);
    this.stopBattleLogic();

    // 播放胜利音频
    const victorySfx = normalizeSfxKey(victoryConfig.audio.sfx);
    if (victorySfx) Sound.play(victorySfx);
    Music.play(normalizeBgmKey(victoryConfig.audio.bgm), 0.5);

    // P0-2: 胜利屏幕震动
    ScreenShakeSystem.triggerShake(this.world, 6, 0.5, 25);

    // 启动胜利覆盖层（3阶段动画序列：通关标题 → 彩带星星 → 剧情文字）
    this.victoryScreenSystem.activate(
      victoryConfig,
      stars,
      timesCleared,
      levelConfig.name,
      settlementStats,
      levelConfig.map.artTheme ?? levelConfig.theme,
    );
  }

  private handleDefeat(): void {
    Music.play('defeat', 0.5);
    // Sound.play('defeat') 已在调用点（line 1089）通过 defeatSfxPlayed 守卫保证只播放一次，
    // 此处删除重复调用，避免每帧触发刺耳连播。
    this.phase = GamePhase.Defeat;
    this.levelSelectUI?.refresh?.();
    const settlementStats = this.collectSettlementStats(0);
    this.stopBattleLogic();

    // 显示失败故事覆盖层
    const levelConfig = LEVELS[this.currentLevelId - 1];
    const defeatStory = levelConfig?.victory?.defeatStory ?? {
      title: '防线崩溃',
      paragraphs: ['水晶被攻破，敌人暂时占据了这片战场。', '调整卡组和部署节奏，再次挑战。'],
      summary: '挑战失败，请重新部署。',
      showFullStoryOnlyFirst: false,
    };
    const typography = levelConfig?.victory?.typography ?? DEFAULT_VICTORY_CONFIG.typography;
    this.victoryScreenSystem.activateDefeat(
      defeatStory,
      typography,
      settlementStats,
      levelConfig?.map.artTheme ?? levelConfig?.theme,
    );
  }

  private triggerGoldCheat(): void {
    if (!this.economy || !this.uiSystem) return;

    const amount = Math.random() < 0.5 ? 1 : 2;
    this.economy.addGold(amount);
    Sound.play('gold_earn');
    this.uiSystem.showGoldCheatFeedback(`+${amount}💰`);
  }

  private collectSettlementStats(stars: number): BattleSettlementStats {
    const crystal = this.getCrystalHpSnapshot();
    const { towersUsed, soldiersUsed } = this.countPlayerForces();
    const totalWaves = this.waveSystem?.totalWaves ?? 0;
    const currentWave = Math.min(Math.max(this.waveSystem?.currentWave ?? 0, 0), totalWaves > 0 ? totalWaves : Number.MAX_SAFE_INTEGER);
    const spawned = this.waveSystem?.totalSpawned ?? 0;
    const enemiesDefeated = Math.min(this.battleEnemiesDefeated, spawned);
    const crystalRatio = crystal.max > 0 ? Math.max(0, crystal.current) / crystal.max : 0;
    const score = Math.round(
      stars * 1000
      + enemiesDefeated * 120
      + Math.max(0, crystalRatio) * 1500
      + this.battleTotalDamage * 0.25
      + (this.economy?.gold ?? 0) * 2,
    );

    return {
      waves: { current: currentWave, total: totalWaves },
      enemies: { spawned, defeated: enemiesDefeated },
      towersUsed,
      soldiersUsed,
      crystalHp: crystal,
      score,
      totalDamage: this.battleTotalDamage,
    };
  }

  private getCrystalHpSnapshot(): { current: number; max: number } {
    if (this.baseEntityId === null) return { current: 0, max: 0 };
    return {
      current: Health.current[this.baseEntityId] ?? 0,
      max: Health.max[this.baseEntityId] ?? 0,
    };
  }

  private countPlayerForces(): { towersUsed: number; soldiersUsed: number } {
    const w = this.world.world;
    let towersUsed = 0;
    let soldiersUsed = 0;
    for (let eid = 1; eid < Position.x.length; eid++) {
      if (!hasComponent(w, PlayerOwned, eid)) continue;
      if (hasComponent(w, Tower, eid) && !hasComponent(w, BuildingTower, eid)) {
        towersUsed++;
      } else if (hasComponent(w, Soldier, eid) || (hasComponent(w, UnitTag, eid) && UnitTag.isEnemy[eid] === 0 && !hasComponent(w, Tower, eid))) {
        soldiersUsed++;
      }
    }
    return { towersUsed, soldiersUsed };
  }

  private stopBattleLogic(): void {
    this.world.clearEntities();
    this.baseEntityId = null;
    this.unitDragId = null;
    this.pendingCardDrag = null;
    this.buildSystem?.cancelDrag();
    if (this.uiSystem) {
      this.uiSystem.selectedEntityId = null;
      this.uiSystem.selectedEntityType = null;
      this.uiSystem.selectedTowerEntityId = null;
      this.uiSystem.selectedUnitEntityId = null;
      this.uiSystem.selectedTrapEntityId = null;
      this.uiSystem.selectedProductionEntityId = null;
      this.uiSystem.enemyEntityId = null;
    }
  }

  /** 🏁 调试：直接通关当前关卡（跳过所有波次） */
  private skipToVictory(): void {
    if (this.currentScreen !== GameScreen.Battle) return;
    if (this.phase === GamePhase.Victory || this.phase === GamePhase.Defeat) return;

    // 秒杀所有存活的敌人
    const w = this.world.world;
    for (let eid = 1; eid < Health.current.length; eid++) {
      const hp = Health.current[eid];
      if (hp !== undefined && hp > 0 && UnitTag.isEnemy[eid] === 1) {
        Health.current[eid] = 0;
      }
    }

    // 直接触发胜利阶段
    this.phase = GamePhase.Victory;
  }

  /** 💀 调试：直接失败当前关卡（测试失败界面） */
  private skipToDefeat(): void {
    if (this.currentScreen !== GameScreen.Battle) return;
    if (this.phase === GamePhase.Victory || this.phase === GamePhase.Defeat) return;

    if (this.baseEntityId !== null) {
      Health.current[this.baseEntityId] = 0;
    }
    this.phase = GamePhase.Defeat;
  }

  /** 👑 调试：直接进入最后一波（测试 Boss 技能） */
  private skipToFinalWave(): boolean {
    if (this.currentScreen !== GameScreen.Battle) return false;
    if (this.phase === GamePhase.Victory || this.phase === GamePhase.Defeat) return false;
    return this.waveSystem.skipToFinalWave();
  }

  // ================================================================
  // Neutral Units (stub)
  // ================================================================

  private spawnNeutralUnits(_map: MapConfig): void {
    // Phase 3 neutral units — stub for now
  }

  private startPendingCardDrag(): void {
    const pending = this.pendingCardDrag;
    if (!pending) return;
    this.pendingCardDrag = null;

    const resolved = pending.resolved;
    if (resolved.entityType === 'spell') {
      this.buildSystem.startDrag('spell', {
        spellCardId: resolved.spellCardId,
        cardIndex: pending.cardIndex,
      });
      return;
    }

    this.buildSystem.startDrag(resolved.entityType, {
      towerType: 'towerType' in resolved ? resolved.towerType : undefined,
      unitType: 'unitType' in resolved ? resolved.unitType : undefined,
      trapTypeId: 'trapTypeId' in resolved ? resolved.trapTypeId : undefined,
      cardIndex: pending.cardIndex,
    });
  }

  // ================================================================
  // Map Click (bitecs query-based)
  // ================================================================

  private findUnitAt(x: number, y: number): number | null {
    // Use bitecs: entities with Position + UnitTag (player units) + Visual + PlayerOwned
    const w = this.world.world;
    for (let eid = 1; eid < Position.x.length; eid++) {
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      // Check if it's a player unit (UnitTag exists, isEnemy === 0, PlayerOwned, and has Visual)
      if (!hasComponent(w, UnitTag, eid)) continue;
      if (UnitTag.isEnemy[eid] !== 0) continue;
      if (!hasComponent(w, PlayerOwned, eid)) continue;
      // Exclude towers — they have their own click handling in handleMapClick
      if (hasComponent(w, Tower, eid)) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(x - px) < r && Math.abs(y - py) < r) return eid;
    }
    return null;
  }

  private handleMapClick(e: InputEvent): void {
    const w = this.world.world;

    // Try clicking on an enemy first
    for (let eid = 1; eid < Position.x.length; eid++) {
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      if (UnitTag.isEnemy[eid] !== 1) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(e.x - px) < r && Math.abs(e.y - py) < r) {
        this.uiSystem.selectEnemy(eid);
        this.debugManager.selectEntity(eid);
        return;
      }
    }

    // Try clicking on a tower
    for (let eid = 1; eid < Tower.towerType.length; eid++) {
      if (!hasComponent(w, Tower, eid)) continue;
      if (hasComponent(w, BuildingTower, eid)) continue;
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(e.x - px) < r && Math.abs(e.y - py) < r) {
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = eid;
        this.uiSystem.selectedEntityType = 'tower';
        this.debugManager.selectEntity(eid);
        return;
      }
    }

    // Try clicking on a trap
    for (let eid = 1; eid < Trap.damagePerSecond.length; eid++) {
      if (!hasComponent(w, Trap, eid)) continue;
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(e.x - px) < r && Math.abs(e.y - py) < r) {
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = eid;
        this.uiSystem.selectedEntityType = 'trap';
        this.debugManager.selectEntity(eid);
        return;
      }
    }

    // Try clicking on a production building
    for (let eid = 1; eid < Production.rate.length; eid++) {
      if (!hasComponent(w, Production, eid)) continue;
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(e.x - px) < r && Math.abs(e.y - py) < r) {
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = eid;
        this.uiSystem.selectedEntityType = 'production';
        this.debugManager.selectEntity(eid);
        return;
      }
    }

    // Try clicking on a placed unit
    for (let eid = 1; eid < Position.x.length; eid++) {
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;
      if (UnitTag.isEnemy[eid] !== 0) continue;
      if (!hasComponent(w, PlayerOwned, eid)) continue;
      const size = Visual.size[eid];
      if (size === undefined) continue;
      const r = size * 0.65;
      if (Math.abs(e.x - px) < r && Math.abs(e.y - py) < r) {
        this.uiSystem.enemyEntityId = null;
        this.uiSystem.selectedEntityId = eid;
        this.uiSystem.selectedEntityType = 'unit';
        this.debugManager.selectEntity(eid);
        return;
      }
    }

    // Deselect everything
    this.uiSystem.selectedEntityId = null;
    this.uiSystem.selectedEntityType = null;
    this.uiSystem.enemyEntityId = null;
    this.debugManager.selectEntity(null);
  }

  private resolveUnitConfig(entityId: number) {
    const typeIdx = UnitTag.unitTypeNum[entityId];
    if (typeIdx === undefined) return undefined;
    const unitType = UNIT_TYPE_BY_ID[typeIdx];
    if (!unitType) return undefined;
    return UNIT_CONFIGS[unitType];
  }

  // ================================================================
  // spawnUnitAt — bitecs version
  // ================================================================

  private spawnUnitAt(px: number, py: number): boolean {
    const dragUnitType = this.buildSystem.dragState?.unitType;
    if (!dragUnitType) return false;

    const config = UNIT_CONFIGS[dragUnitType];
    if (!config) return false;

    const map = this.currentMap;
    if (!map) return false;

    const ts = map.tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const col = Math.floor((px - ox) / ts);
    const row = Math.floor((py - oy) / ts);

    // 网格中心坐标（用于飘字定位）
    const centerX = col * ts + ts / 2 + ox;
    const centerY = row * ts + ts / 2 + oy;

    if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) {
      this.floatingTextSystem.show(this.world, px, py, '超出地图范围');
      return false;
    }

    const tile = map.tiles[row]![col]!;

    if (tile !== TileType.Path) {
      this.floatingTextSystem.show(this.world, centerX, centerY, '只能放在路径上');
      return false;
    }

    // v4.0: population system removed — no canDeployUnit/deployUnit
    if (!this.economy.spendGold(config.cost)) {
      this.floatingTextSystem.show(this.world, centerX, centerY, '金币不足');
      return false;
    }

    Sound.play('build_place');

    const skillCfg = SKILL_CONFIGS[config.skillId];
    const energyCost = skillCfg ? skillCfg.energyCost : 0;
    const cooldown = skillCfg ? skillCfg.cooldown : 0;

    const x = col * ts + ts / 2 + ox;
    const y = row * ts + ts / 2 + oy;

    const SKILL_ID_TO_NUM: Record<string, number> = { taunt: 1, whirlwind: 2, assassinate: 3 };
    const skillId = SKILL_ID_TO_NUM[config.skillId] ?? 0;

    const id = this.unitFactory.createSoldier(dragUnitType, x, y, { row, col }, {
      unitTypeNum: UNIT_ID_BY_TYPE[dragUnitType],
      skillId,
      skillCooldown: cooldown,
      skillEnergyCost: energyCost,
      registerVisualParts: (parts) => this.world.registerUnitVisualParts(parts),
      visualParts: config.visualParts,
    });

    if (id == null) return false;

    // P1-#11: register for refund tracking
    this.economy.registerBuild(id, config.cost);

    return true;
  }

  // ================================================================
  // recycleEntity — bitecs component access
  // ================================================================

  private recycleEntity(entityId: number): void {
    const meta = this.economy.getRefundMeta(entityId);
    const currentHp = Health.current[entityId] ?? 1;
    const maxHp = Health.max[entityId] ?? 1;

    let refund = 0;
    if (meta) {
      const result = this.economy.computeRefund(entityId, currentHp, maxHp);
      if (result.amount <= 0) {
        // P1-#11: refund blocked (cooldown / combat guard) — no action, no destruction
        Sound.play('ui_error');
        return;
      }
      refund = result.amount;
    } else {
      // Legacy fallback for entities not yet registered (traps, etc.) — keep 50%
      const towerTypeNum = Tower.towerType[entityId];
      if (towerTypeNum !== undefined) {
        const invested = Tower.totalInvested[entityId] ?? 0;
        refund = Math.floor(invested * 0.5);
      } else if (UnitTag.isEnemy[entityId] === 0 && UnitTag.popCost[entityId] !== undefined) {
        refund = Math.floor((UnitTag.cost[entityId] ?? 0) * 0.5);
      } else if (Trap.damagePerSecond[entityId] !== undefined) {
        refund = Math.floor(40 * 0.5);
      }
    }

    // Tower-specific cleanup: destroy bats first
    if (BatTower.maxBats[entityId] !== undefined) {
      for (let eid = 1; eid < Position.x.length; eid++) {
        if (BatSwarmMember.parentId[eid] === entityId) {
          this.world.destroyEntity(eid);
        }
      }
    }

    this.economy.addGold(refund);
    this.economy.clearRefundMeta(entityId);

    // v4.0: population system removed — no releaseUnit

    Sound.play('sell');
    this.world.destroyEntity(entityId);
    this.uiSystem.selectedEntityId = null;
    this.uiSystem.selectedEntityType = null;
  }

  // ================================================================
  // executeSpellAt — 技能卡效果执行
  // ================================================================

  /**
   * 在指定坐标执行法术效果。
   * 对于全屏法术，x/y 仅用于拖拽释放校验，实际效果覆盖整块棋盘。
   * 对于区域技能卡，创建投射物动画，由 SpellProjectileSystem 处理。
   */
  private executeSpellAt(spellCardId: string, x: number, y: number): void {
    const w = this.world.world;

    // 手牌位置（屏幕底部中间）作为投射物起点
    const startX = 960;
    const startY = 900;

    switch (spellCardId) {
      // ---- 区域伤害技能卡（带投射物动画）----
      case 'fireball': {
        // 火球术：创建火球投射物飞向目标位置
        const pid = this.world.createEntity();
        this.world.addComponent(pid, Position, { x: startX, y: startY });
        this.world.addComponent(pid, SpellProjectile, {
          spellType: 0, // SPELL_FIREBALL
          targetX: x,
          targetY: y,
          startX,
          startY,
          duration: 0.6,
          elapsed: 0,
          damage: 80,
          radius: 80,
          phase: 0,
        });
        this.world.addComponent(pid, Visual, {
          shape: ShapeVal.Circle,
          colorR: 255, colorG: 87, colorB: 34,
          size: 20,
          alpha: 1,
          outline: 0,
          hitFlashTimer: 0,
          idlePhase: 0,
        });
        break;
      }

      case 'arrow_rain': {
        // 剑雨：创建箭矢投射物从天而降
        const pid = this.world.createEntity();
        this.world.addComponent(pid, Position, { x: x, y: y - 300 });
        this.world.addComponent(pid, SpellProjectile, {
          spellType: 1, // SPELL_ARROW_RAIN
          targetX: x,
          targetY: y,
          startX: x,
          startY: y - 300,
          duration: 0.5,
          elapsed: 0,
          damage: 25,
          radius: 128,
          phase: 0,
        });
        this.world.addComponent(pid, Visual, {
          shape: ShapeVal.Triangle,
          colorR: 141, colorG: 110, colorB: 99,
          size: 8,
          alpha: 1,
          outline: 0,
          hitFlashTimer: 0,
          idlePhase: 0,
        });
        break;
      }

      case 'blizzard': {
        // 暴风雪：全屏持续寒风，每秒造成伤害并停止所有单位移动
        this.spellProjectileSystem.spawnGlobalEffect(this.world, 2, 45, 5.0);
        break;
      }

      case 'bomb': {
        // 炸弹：创建炸弹投射物抛向目标位置
        const pid = this.world.createEntity();
        this.world.addComponent(pid, Position, { x: startX, y: startY });
        this.world.addComponent(pid, SpellProjectile, {
          spellType: 3, // SPELL_BOMB
          targetX: x,
          targetY: y,
          startX,
          startY,
          duration: 0.7,
          elapsed: 0,
          damage: 80,
          radius: 96,
          phase: 0,
        });
        this.world.addComponent(pid, Visual, {
          shape: ShapeVal.Circle,
          colorR: 66, colorG: 66, colorB: 66,
          size: 16,
          alpha: 1,
          outline: 0,
          hitFlashTimer: 0,
          idlePhase: 0,
        });
        break;
      }

      // ---- 自施法技能卡 ----
      case 'gold_rush': {
        // 淘金热：立即获得 80 金币
        this.economy.addGold(80);
        Sound.play('gold_earn');
        break;
      }

      case 'earthquake': {
        // 大地裂变：全棋盘持续震动，每秒对全部有生命单位造成物理伤害
        this.spellProjectileSystem.spawnGlobalEffect(this.world, 4, 100, 3.0);
        break;
      }

      default:
        console.warn(`[SpellSystem] Unknown spell card: ${spellCardId}`);
        break;
    }
  }
}

// ================================================================
// Entry
// ================================================================

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

async function bootstrapGame(): Promise<void> {
  // 加载所有 YAML 单位配置到 unitConfigRegistry（UnitFactory 依赖此注册表）
  const { loadAllCardConfigsSync, loadAllUnitConfigs } = await import('./config/loader.js');
  const unitConfigs = await loadAllUnitConfigs();
  const cardConfigs = loadAllCardConfigsSync();

  const { ruleEngine } = await import('./core/RuleEngine.js');
  const { BUILTIN_HANDLERS } = await import('./core/RuleHandlers.js');
  ruleEngine.registerHandlers(BUILTIN_HANDLERS);
  const lifecycleEvents = [
    'onCreate',
    'onDeath',
    'onHit',
    'onAttack',
    'onKill',
    'onUpgrade',
    'onDestroy',
  ] as const;
  for (const config of unitConfigs) {
    const rules = new Map<LifecycleEvent, LifecycleRule[]>();
    for (const event of lifecycleEvents) {
      const eventRules = config.lifecycle?.[event];
      if (eventRules && eventRules.length > 0) {
        rules.set(event, eventRules);
      }
    }
    if (rules.size > 0) {
      ruleEngine.registerLifecycleRules(config.id, rules);
    }
  }

  // 从 YAML 配置注入到硬编码配置对象
  const { injectEnemyConfigsFromRegistry } = await import('./data/levels/enemyBridge.js');
  const { injectTowerConfigsFromRegistry } = await import('./data/levels/towerBridge.js');
  const { injectSoldierConfigsFromRegistry } = await import('./data/levels/soldierBridge.js');
  const { injectSkillConfigsFromRegistry } = await import('./data/levels/skillBridge.js');
  const { injectTrapConfigsFromRegistry } = await import('./data/levels/trapBridge.js');
  const enemyCount = injectEnemyConfigsFromRegistry();
  const towerCount = injectTowerConfigsFromRegistry();
  const soldierCount = injectSoldierConfigsFromRegistry();
  const skillCount = injectSkillConfigsFromRegistry();
  const trapCount = injectTrapConfigsFromRegistry();
  console.log(`[Config] Injected from YAML: ${enemyCount} enemies, ${towerCount} towers, ${soldierCount} soldiers, ${skillCount} skills, ${trapCount} traps, ${cardConfigs.length} cards`);

  const game = new TowerDefenderGame(canvas);
  game.start();

  if (import.meta.env.DEV) {
    const { bootstrapEditor, attachF2Hotkey } = await import('./editor/index.js');
    const { LevelEditor } = await import('./editor/LevelEditor.js');
    const { mountEditorRoot } = await import('./editor/mount.js');
    const host = document.createElement('div');
    host.id = 'level-editor-host';
    document.body.appendChild(host);
    const levelEditor = new LevelEditor({ fetch: window.fetch.bind(window), baseUrl: '/__editor' });
    const handle = bootstrapEditor({ game, hostElement: host, levelEditor, mountUi: mountEditorRoot });
    attachF2Hotkey(handle, window);
    game.debugManager.setOpenLevelEditorCallback(() => handle.open());
    (window as unknown as Record<string, unknown>).levelEditor = levelEditor;
    (window as unknown as Record<string, unknown>).editorHandle = handle;
  }

  window.addEventListener('resize', () => game.resize());
  (window as unknown as Record<string, unknown>).game = game;
  (window as unknown as Record<string, unknown>).Sound = Sound;
}

void bootstrapGame();
