import { Game } from './core/Game.js';
import { ALL_BUFFS } from './data/buffs.js';
import { LEVEL_1_CARD_POOL, LEVEL_2_CARD_POOL, LEVEL_3_CARD_POOL, LEVEL_4_CARD_POOL, LEVEL_5_CARD_POOL } from './data/cards.js';
import { SKILL_CONFIGS, TOWER_CONFIGS, UNIT_CONFIGS, UNIT_ID_BY_TYPE, UNIT_TYPE_BY_ID } from './data/gameData.js';
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
import { InterLevelBuffSystem } from './systems/InterLevelBuffSystem.js';
import { LaserBeamSystem } from './systems/LaserBeamSystem.js';
import { LifecycleSystem } from './systems/LifecycleSystem.js';
import { LightningBoltSystem } from './systems/LightningBoltSystem.js';
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
import { UnitAnimationSystem } from './systems/UnitAnimationSystem.js';
import { UnitFactory } from './systems/UnitFactory.js';
import { UnitSystem } from './systems/UnitSystem.js';
import { WaveSystem } from './systems/WaveSystem.js';
import { WeatherSystem } from './systems/WeatherSystem.js';
import { GamePhase, GameScreen, TileType, TowerType, UnitType, WeatherType, type InputEvent, type LevelConfig, type MapConfig } from './types/index.js';
import { hitTestHandCard, isSelfTargetSpell, resolveCardToEntityType } from './ui/LayoutConstants.js';
import { LayoutManager } from './ui/LayoutManager.js';
import { LevelSelectUI } from './ui/LevelSelectUI.js';
import { CardEncyclopediaUI } from './ui/CardEncyclopediaUI.js';
import { clearDamageObservers, registerDamageObserver } from './utils/damageUtils.js';
import { Music } from './utils/Music.js';
import {
  captureStreamState,
  generateSeed,
  getGlobalRandom,
  initGlobalRandom,
  restoreStreamState,
} from './utils/Random.js';
import { SaveManager } from './utils/SaveManager.js';
import { Sound } from './utils/Sound.js';
import { hexToRgb } from './utils/visualHelpers.js';

// ---- bitecs component stores ----
import {
  Attack,
  BatSwarmMember,
  BatTower,
  BuildingTower,
  Category, CategoryVal,
  DeathEffect,
  Faction, FactionVal,
  GridOccupant,
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
  Visual
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
  private soldierAISystem!: SoldierAISystem;
  private bossSystem!: BossSystem;

  // ---- Scene decoration ----
  private decorationSystem!: DecorationSystem;
  private boardGlowSystem!: BoardGlowSystem;
  private screenFXSystem!: ScreenFXSystem;
  private screenShakeSystem!: ScreenShakeSystem;
  private tileDamageSystem!: TileDamageSystem;

  // ---- Debug system ----
  public debugManager: DebugManager;

  // ---- Encyclopedia ----
  private encyclopedia!: CardEncyclopediaUI;

  private unitDragId: number | null = null;
  private defeatSfxPlayed = false;
  private previousPhase: GamePhase = GamePhase.Deployment;

  /** Accumulated in-battle seconds (for BattleSnapshot.gameTime). */
  private battleGameTime: number = 0;
  /** Seconds since last auto-snapshot (throttle to 60s). */
  private snapshotTimer: number = 0;
  /** Tracks last wave we persisted at — re-snapshot when wave index advances. */
  private lastSnapshotWave: number = 0;
  /** Wired beforeunload handler — saved here so we can remove on screen exit. */
  private beforeUnloadHandler: ((ev: BeforeUnloadEvent) => void) | null = null;
  private editorOnExit: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    Sound.preload();
    Sound.initUnlock(canvas);

    // Card encyclopedia — shared across all screens
    this.encyclopedia = new CardEncyclopediaUI(this.renderer);
    this.encyclopedia.onOpen = () => { this.paused = true; };
    this.encyclopedia.onClose = () => { this.paused = false; };

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
    });

    // Wheel event for encyclopedia scroll
    canvas.addEventListener('wheel', (e) => {
      if (this.encyclopedia.isOpen) {
        e.preventDefault();
        this.encyclopedia.handleWheel(e.deltaY);
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
    if (this.currentScreen === GameScreen.Battle) {
      SaveManager.clearBattleSnapshot();
    }
    this.currentScreen = GameScreen.LevelSelect;
    this.uninstallBeforeUnloadGuard();
    this.world.reset();
    Music.play('main_menu');
    this.onUpdate = (dt) => {
      this.levelSelectUI?.update?.(dt);
    };
    this.onPostRender = () => {
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.render();
      }
    };
    this.onAfterUpdate = null;
    this.input.onPointerDown = (e: InputEvent) => {
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.handleClick(e.x, e.y);
        return;
      }
      this.levelSelectUI?.handleClick?.(e.x, e.y);
    };
    this.input.onPointerMove = (e: InputEvent) => {
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.handleMouseMove(e.x, e.y);
        return;
      }
      this.levelSelectUI?.handleMouseMove?.(e.x, e.y);
    };
    this.input.onPointerUp = (e: InputEvent) => {
      this.encyclopedia.handleMouseUp(e.x, e.y);
    };
  }

  startLevel(levelId: number): void {
    const config = LEVELS[levelId - 1];
    if (!config) return;

    this.currentLevelId = levelId;
    this.currentScreen = GameScreen.Battle;
    this.phase = GamePhase.Deployment;

    this.world.reset();
    this.initBattle(config);
  }

  startEndless(): void {
    const config = LEVELS[0];
    if (!config) return;

    this.currentLevelId = 1;
    this.currentScreen = GameScreen.Battle;
    this.phase = GamePhase.Deployment;

    this.world.reset();
    this.initBattle(config);
  }

  override startBattleWithConfig(config: LevelConfig, options?: import('./core/Game.js').StartBattleOptions): void {
    this.editorOnExit = options?.onExit ?? null;
    this.currentLevelId = 0;
    this.currentScreen = GameScreen.Battle;
    this.phase = GamePhase.Deployment;
    this.world.reset();
    this.initBattle(config);
  }

  // ================================================================
  // Battle Snapshot — design/13 §1 (auto-save throttle 60s)
  // ================================================================

  /** Auto-snapshot throttle interval in seconds — design/13 §1 recovery checkpoint. */
  private static readonly SNAPSHOT_INTERVAL_S = 60;

  private saveCurrentBattle(_reason: string): void {
    if (this.currentScreen !== GameScreen.Battle) return;
    if (this.phase === GamePhase.Victory || this.phase === GamePhase.Defeat) return;
    try {
      const streams = getGlobalRandom();
      const snapshot = {
        levelId: this.currentLevelId,
        currentWave: this.waveSystem.currentWave,
        gameTime: this.battleGameTime,
        prngStates: captureStreamState(streams),
        economy: {
          gold: this.economy.gold,
          refundMeta: this.economy.serializeRefundMeta(),
        },
      };
      SaveManager.saveBattleSnapshot(snapshot);
      this.lastSnapshotWave = snapshot.currentWave;
    } catch (e) {
      console.warn('[BattleSnapshot] save failed:', e);
    }
  }

  /**
   * Attempt to restore a saved battle (PRNG streams + economy scalars + refund meta)
   * if the snapshot matches the level we are about to start.
   * Returns true if restoration succeeded; caller should skip default initial values.
   */
  private tryRestoreBattleSnapshot(config: LevelConfig): boolean {
    const snapshot = SaveManager.loadBattleSnapshot();
    if (!snapshot) return false;
    if (snapshot.levelId !== this.currentLevelId) return false;
    try {
      const streams = initGlobalRandom(snapshot.prngStates.seed);
      restoreStreamState(streams, snapshot.prngStates);
      this.battleGameTime = snapshot.gameTime;
      this.economy.gold = snapshot.economy.gold;
      this.economy.deserializeRefundMeta(snapshot.economy.refundMeta);
      this.lastSnapshotWave = snapshot.currentWave;
      void config;
      return true;
    } catch (e) {
      console.warn('[BattleSnapshot] restore failed, starting fresh:', e);
      return false;
    }
  }

  private installBeforeUnloadGuard(): void {
    this.uninstallBeforeUnloadGuard();
    const handler = () => { this.saveCurrentBattle('beforeunload'); };
    window.addEventListener('beforeunload', handler);
    this.beforeUnloadHandler = handler;
  }

  private uninstallBeforeUnloadGuard(): void {
    if (this.beforeUnloadHandler !== null) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }

  // ================================================================
  // Battle Init
  // ================================================================

  private initBattle(config: LevelConfig): void {
    this.boardGlowSystem?.dispose();
    const runSeed = generateSeed();
    initGlobalRandom(runSeed);
    this.battleGameTime = 0;
    this.snapshotTimer = 0;
    this.lastSnapshotWave = 0;

    const map = config.map;
    this.currentMap = map;
    this.defeatSfxPlayed = false;
    this.previousPhase = GamePhase.Deployment;
    Music.play(Music.getLevelBgm(this.currentLevelId));

    // Select card pool based on level (defined early for use in callbacks)
    const cardPoolByLevel: Record<number, typeof LEVEL_1_CARD_POOL> = {
      1: LEVEL_1_CARD_POOL,
      2: LEVEL_2_CARD_POOL,
      3: LEVEL_3_CARD_POOL,
      4: LEVEL_4_CARD_POOL,
      5: LEVEL_5_CARD_POOL,
    };
    const initialPool = cardPoolByLevel[this.currentLevelId] ?? LEVEL_1_CARD_POOL;

    // ---- Create base entity ----
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
    this.world.addComponent(this.baseEntityId, Health, { current: 100, max: 100 });
    const baseRgb = hexToRgb('#42a5f5');
    this.world.addComponent(this.baseEntityId, Visual, {
      shape: ShapeVal.Hexagon,
      colorR: baseRgb.r,
      colorG: baseRgb.g,
      colorB: baseRgb.b,
      size: ts * 0.6,
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
    this.economy.gold = config.startingGold;

    // P1-#11: hook damage events to refund combat-guard tracker
    clearDamageObservers();
    registerDamageObserver((targetId, sourceId, _actual) => {
      this.economy.notifyDamaged(targetId);
      if (sourceId !== undefined) this.economy.notifyAttacked(sourceId);
    });

    // ---- Wave system ----
    this.waveSystem = new WaveSystem(
      this.world, map, config.waves,
      () => this.phase,
      (p) => { this.phase = p; },
      () => {
        this.weatherSystem.onWaveEnd();
        this.saveCurrentBattle('wave-end');
        Music.play('wave_break', 0.5);
      },
      () => {
        // wave start — restore level BGM
        Music.play(Music.getLevelBgm(this.currentLevelId));
      },
      undefined, // onWaveReward (unused)
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

    if (config.availableTowers.length > 0 && config.availableTowers[0]) {
      this.buildSystem.selectTower(config.availableTowers[0]);
    }

    // ---- Upgrade tower callback (bitecs component access) ----
    const upgradeTower = (entityId: number) => {
      const towerTypeNum = Tower.towerType[entityId];
      if (towerTypeNum === undefined) return;
      const towerLevel = Tower.level[entityId]!;
      if (towerLevel >= 5) return;

      const tt = TOWER_TYPE_BY_ID[towerTypeNum];
      if (tt === undefined) return;
      const towerCfg = TOWER_CONFIGS[tt];
      if (!towerCfg) return;

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
      // 嘲讽容量增量：优先 upgradeTauntCapacityBonus[costIdx]，否则用 tauntCapacityPerLevel
      const tauntBonus = cfg.upgradeTauntCapacityBonus?.[costIdx] ?? cfg.tauntCapacityPerLevel ?? 0;
      if (tauntBonus > 0 && Attack.tauntCapacity[entityId] !== undefined) {
        const next = Attack.tauntCapacity[entityId]! + tauntBonus;
        Attack.tauntCapacity[entityId] = next > 255 ? 255 : next;
      }

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
    );

    // ---- Hand System (card management) ----
    this.handSystem = new HandSystem();
    this.handSystem.initialize(initialPool);

    // ---- Create RunContext for UISystem ----
    // UISystem expects runContext with hand, energy, registry, deck
    const cardRegistry = new Map<string, { type: string; rarity: string; energyCost: number; name: string; description: string }>();
    for (const card of initialPool) {
      cardRegistry.set(card.id, {
        type: card.type,
        rarity: 'common',
        energyCost: 0,
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
          name: card.name,
          description: card.description,
        });
      }
    };

    // ---- Card Draft System ----
    this.cardDraftSystem = new CardDraftSystem();
    this.cardDraftSystem.onDraftStart = () => {
      this.paused = true;
    };
    this.cardDraftSystem.onDraftComplete = (_addedCardIds) => {
      this.paused = false;
    };

    // ---- Inter-Level Buff System ----
    this.interLevelBuffSystem = new InterLevelBuffSystem();
    this.interLevelBuffSystem.initialize(ALL_BUFFS);
    this.interLevelBuffSystem.onSelectionStart = () => {
      this.paused = true;
    };
    this.interLevelBuffSystem.onSelectionComplete = (_selected) => {
      this.paused = false;
    };

    // Inject systems into UISystem for overlay rendering
    this.uiSystem.setCardDraftSystem(this.cardDraftSystem);
    this.uiSystem.setInterLevelBuffSystem(this.interLevelBuffSystem);
    this.uiSystem.setEncyclopediaCallback(() => {
      this.encyclopedia.open();
    });

    // ---- Soldier AI System ----
    this.soldierAISystem = new SoldierAISystem();

    // ---- Boss System ----
    this.bossSystem = new BossSystem();

    // ---- Health system ----
    this.healthSystem = new HealthSystem(
      () => this.phase,
      (p) => { this.phase = p; },
      (enemyId) => {
        Sound.play('enemy_death');
        this.economy.rewardForEnemy(enemyId);
        Sound.play('gold_earn');
        // v4.0: 精英敌人死亡 → 触发 3选1 抽卡
        // 在 HealthSystem 回调中检测，覆盖所有死因（塔伤/陷阱/DOT等），
        // 不受系统执行顺序影响（原先在 WaveSystem 轮询可能导致漏检）。
        if (UnitTag.isElite[enemyId] === 1 && !this.cardDraftSystem.isActive()) {
          this.cardDraftSystem.startDraft(initialPool, this.handSystem);
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
          this.world.addComponent(effectId, DeathEffect, { duration: 0.3 });
        }
      },
      (batId) => {
        this.batSwarmSystem.onBatDied(batId);
      },
    );

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
    );
    this.boardGlowSystem = new BoardGlowSystem(map);
    this.screenFXSystem = new ScreenFXSystem();
    this.screenShakeSystem = new ScreenShakeSystem();
    this.tileDamageSystem = new TileDamageSystem(map);

    const movementSystem = new MovementSystem(map, (phase) => { this.phase = phase; });
    const attackSystem = new AttackSystem(this.weatherSystem, map);
    this.batSwarmSystem = new BatSwarmSystem(this.weatherSystem, this.renderer);
    const unitSystem = new UnitSystem(map);
    const unitAnimationSystem = new UnitAnimationSystem();
    const projectileSystem = new ProjectileSystem(map);

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
    const lightningBoltSystem = new LightningBoltSystem(this.renderer);
    this.laserBeamSystem = new LaserBeamSystem(this.renderer);
    const spellProjectileSystem = new SpellProjectileSystem(this.renderer);
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
        this.screenFXSystem.render(ctx, 1 / 60, this.weatherSystem.currentWeather);
      }
      this.uiSystem.renderUI();
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.render();
      }
    };

    // ---- Input dispatch for battle ----
    this.input.onPointerDown = (e: InputEvent) => {
      // Encyclopedia overlay consumes all clicks when open
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.handleClick(e.x, e.y);
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
              if (resolved.entityType === 'spell') {
                // 技能卡/奥术卡
                if (isSelfTargetSpell(resolved.spellCardId)) {
                  // 自施法奥术卡：点击即生效，无需拖拽
                  this.executeSpellAt(resolved.spellCardId, 0, 0);
                  this.handSystem.playCard(cardIdx);
                  return;
                }
                // 区域目标技能卡：开始拖拽
                this.buildSystem.startDrag('spell', {
                  spellCardId: resolved.spellCardId,
                  cardIndex: cardIdx,
                });
              } else {
                this.buildSystem.startDrag(resolved.entityType, {
                  towerType: 'towerType' in resolved ? resolved.towerType : undefined,
                  unitType: 'unitType' in resolved ? resolved.unitType : undefined,
                  trapTypeId: 'trapTypeId' in resolved ? resolved.trapTypeId : undefined,
                  cardIndex: cardIdx,
                });
              }
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

    this.input.onPointerUp = (e: InputEvent) => {
      if (this.encyclopedia.isOpen) {
        this.encyclopedia.handleMouseUp(e.x, e.y);
        return;
      }
      console.log('[CardDrag] onPointerUp called - unitDragId:', this.unitDragId, 'dragState:', this.buildSystem.dragState);
      if (this.unitDragId !== null) {
        this.unitDragId = null;
        return;
      }

      const ds = this.buildSystem.dragState;
      console.log('[CardDrag] ds:', ds, 'ds?.active:', ds?.active);
      if (ds?.active) {
        const sceneBottom = RenderSystem.sceneOffsetY + RenderSystem.sceneH;
        if (e.y >= sceneBottom + 8) {
          this.buildSystem.cancelDrag();
          return;
        }
        console.log('[CardDrag] entityType:', ds.entityType, 'cardIndex:', ds.cardIndex);
        if (ds.entityType === 'unit') {
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
            this.executeSpellAt(spellId, e.x, e.y);
            if (ds.cardIndex !== undefined) {
              this.handSystem.playCard(ds.cardIndex);
            }
            Sound.play('build_place');
          }
          this.buildSystem.cancelDrag();
        } else {
          console.log('[CardDrag] Calling tryDrop...');
          const result = this.buildSystem.tryDrop(e.x, e.y);
          console.log('[CardDrag] tryDrop result:', result, 'cardIndex:', ds.cardIndex);
          if (result !== false && result !== null) {
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
    this.onUpdate = null;
    this.onAfterUpdate = (dt: number) => {
      if (this.currentScreen !== GameScreen.Battle) return;

      // Update debug manager
      this.debugManager.update();

      // Accumulate gameTime + auto-snapshot throttle (only during active battle phases)
      if (this.phase === GamePhase.Battle || this.phase === GamePhase.WaveBreak || this.phase === GamePhase.Deployment) {
        this.battleGameTime += dt;
        this.snapshotTimer += dt;
        if (this.snapshotTimer >= TowerDefenderGame.SNAPSHOT_INTERVAL_S) {
          this.snapshotTimer = 0;
          this.saveCurrentBattle('auto-60s');
        }
      }

      // BGM: switch on phase change
      if (this.phase !== this.previousPhase) {
        this.previousPhase = this.phase;
        if (this.phase === GamePhase.WaveBreak) {
          Music.play('wave_break');
        } else if (this.phase === GamePhase.Deployment) {
          Music.play('battle_default');
        }
      }

      if (this.phase === GamePhase.Victory) {
        this.handleVictory();
      } else if (this.phase === GamePhase.Defeat) {
        if (!this.defeatSfxPlayed) {
          Sound.play('defeat');
          this.defeatSfxPlayed = true;
        }
        this.handleDefeat();
      }
    };

    // ---- Register systems ----
    const lifecycleSystem = new LifecycleSystem();
    this.world.registerSystem(lifecycleSystem);
    this.world.registerSystem(this.weatherSystem);
    this.world.registerSystem(this.handSystem);
    this.world.registerSystem(this.cardDraftSystem);
    this.world.registerSystem(this.interLevelBuffSystem);
    this.world.registerSystem(movementSystem);
    this.world.registerSystem(attackSystem);
    this.world.registerSystem(this.bossSystem);
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
    this.world.registerSystem(this.economy);
    this.world.registerSystem(this.buildSystem);
    this.world.registerSystem(this.soldierAISystem);
    this.world.registerSystem(spellProjectileSystem);
    this.world.registerSystem(slashEffectSystem);
    this.world.registerSystem(this.decorationSystem);
    this.world.registerSystem(this.boardGlowSystem);
    this.world.registerSystem(this.screenShakeSystem);
    this.world.registerSystem(unitAnimationSystem);
    this.world.registerSystem(renderSystem);
    this.world.registerSystem(lightningBoltSystem);
    this.world.registerSystem(this.uiSystem);

    // Start auto-countdown for first wave
    this.waveSystem.startAutoCountdown(5);

    // Attempt restore (PRNG/economy only — entity state is not snapshotted in v1.1).
    // Wave progression keeps fresh; on success we just preserve random determinism
    // and economy invariants so refund-guard/RNG sequences match prior session.
    const restored = this.tryRestoreBattleSnapshot(config);
    if (restored) {
      console.info('[BattleSnapshot] restored PRNG + economy from previous session');
    }

    this.installBeforeUnloadGuard();
  }

  // ================================================================
  // Victory / Defeat
  // ================================================================

  private handleVictory(): void {
    Sound.play('victory');
    Music.play('victory', 0.5);   // BGM: victory fanfare via cross-fade
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

    SaveManager.setStars(this.currentLevelId, stars);
    if (this.currentLevelId < 5) {
      SaveManager.unlockLevel(this.currentLevelId + 1);
    }
    SaveManager.clearBattleSnapshot();

    this.levelSelectUI?.refresh?.();
    setTimeout(() => this.enterLevelSelect(), 1500);
  }

  private handleDefeat(): void {
    Music.play('defeat', 0.5);    // BGM: defeat melody via cross-fade
    this.phase = GamePhase.Defeat;
    SaveManager.clearBattleSnapshot();
    this.levelSelectUI?.refresh?.();
    setTimeout(() => this.enterLevelSelect(), 1500);
  }

  // ================================================================
  // Neutral Units (stub)
  // ================================================================

  private spawnNeutralUnits(_map: MapConfig): void {
    // Phase 3 neutral units — stub for now
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

    if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return false;

    const tile = map.tiles[row]![col]!;

    if (tile !== TileType.Path) return false;

    // Check grid occupancy via GridOccupant SoA
    for (let eid = 1; eid < GridOccupant.row.length; eid++) {
      if (GridOccupant.row[eid] === undefined) continue;
      if (GridOccupant.row[eid] === row && GridOccupant.col[eid] === col) return false;
    }

    // v4.0: population system removed — no canDeployUnit/deployUnit
    if (!this.economy.spendGold(config.cost)) return false;

    Sound.play('build_place');

    const skillCfg = SKILL_CONFIGS[config.skillId];
    const energyCost = skillCfg ? skillCfg.energyCost : 0;
    const cooldown = skillCfg ? skillCfg.cooldown : 0;

    const x = col * ts + ts / 2 + ox;
    const y = row * ts + ts / 2 + oy;

    const skillId = config.skillId === 'taunt' ? 0 : config.skillId === 'whirlwind' ? 1 : 0;

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
  // executeSpellAt — 技能卡/奥术卡效果执行
  // ================================================================

  /**
   * 在指定坐标执行法术效果。
   * 对于自施法奥术卡（targetType: self），x/y 参数被忽略。
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
        // 暴风雪：创建冰雪投射物螺旋飞向目标
        const pid = this.world.createEntity();
        this.world.addComponent(pid, Position, { x: x, y: y - 200 });
        this.world.addComponent(pid, SpellProjectile, {
          spellType: 2, // SPELL_BLIZZARD
          targetX: x,
          targetY: y,
          startX: x,
          startY: y - 200,
          duration: 0.8,
          elapsed: 0,
          damage: 15,
          radius: 128,
          phase: 0,
        });
        this.world.addComponent(pid, Visual, {
          shape: ShapeVal.Diamond,
          colorR: 227, colorG: 242, colorB: 253,
          size: 10,
          alpha: 1,
          outline: 0,
          hitFlashTimer: 0,
          idlePhase: 0,
        });
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

      // ---- 自施法奥术卡 ----
      case 'emergency_shield': {
        // 紧急防护：水晶 10 秒内无敌
        if (this.baseEntityId !== null) {
          const bid = this.baseEntityId;
          const origArmor = Health.armor[bid] ?? 0;
          const origMr = Health.magicResist[bid] ?? 0;
          Health.armor[bid] = 99999;
          Health.magicResist[bid] = 99999;
          setTimeout(() => {
            Health.armor[bid] = origArmor;
            Health.magicResist[bid] = origMr;
          }, 10000);
        }
        Sound.play('build_place');
        break;
      }

      case 'arrow_boost': {
        // 箭术精通：本关内所有箭塔和弩塔攻击力 +20%
        for (let eid = 1; eid < Tower.towerType.length; eid++) {
          const tt = Tower.towerType[eid];
          if (tt === undefined) continue;
          // Arrow=0, Ballista=1
          if (tt === 0 || tt === 1) {
            const curAtk = Attack.damage[eid];
            if (curAtk !== undefined) {
              Attack.damage[eid] = curAtk * 1.2;
            }
          }
        }
        Sound.play('upgrade');
        break;
      }

      case 'shield_boost': {
        // 坚韧守护：本关内所有盾卫 HP +30%
        for (let eid = 1; eid < UnitTag.unitTypeNum.length; eid++) {
          if (UnitTag.isEnemy[eid] === 1) continue;
          const unitTypeNum = UnitTag.unitTypeNum[eid];
          if (unitTypeNum === undefined) continue;
          // shield_guard 的 unitTypeNum 需要查表
          const unitType = UNIT_TYPE_BY_ID[unitTypeNum];
          if (unitType === UnitType.ShieldGuard) {
            const curMaxHp = Health.max[eid];
            if (curMaxHp !== undefined) {
              const bonus = Math.floor(curMaxHp * 0.3);
              Health.max[eid] = curMaxHp + bonus;
              Health.current[eid] = (Health.current[eid] ?? curMaxHp) + bonus;
            }
          }
        }
        Sound.play('upgrade');
        break;
      }

      case 'gold_rush': {
        // 淘金热：立即获得 80 金币
        this.economy.addGold(80);
        Sound.play('gold_earn');
        break;
      }

      case 'speed_boost': {
        // 疾风步：本关内所有士兵移动速度 +25%
        for (let eid = 1; eid < Movement.speed.length; eid++) {
          if (UnitTag.isEnemy[eid] === 1) continue;
          if (!hasComponent(w, Soldier, eid)) continue;
          const curSpeed = Movement.speed[eid];
          if (curSpeed !== undefined) {
            Movement.speed[eid] = curSpeed * 1.25;
          }
        }
        Sound.play('upgrade');
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
  const { loadAllUnitConfigs } = await import('./config/loader.js');
  await loadAllUnitConfigs();

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
  console.log(`[Config] Injected from YAML: ${enemyCount} enemies, ${towerCount} towers, ${soldierCount} soldiers, ${skillCount} skills, ${trapCount} traps`);

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
