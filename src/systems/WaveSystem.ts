import { TowerWorld, type System, defineQuery } from '../core/World.js';
import {
  Position,
  Health,
  Movement,
  UnitTag,
  Visual,
  Boss,
  Elite,
  Attack,
  Category,
  CategoryVal,
  Layer,
  LayerVal,
  Faction,
  FactionVal,
  MoveModeVal,
  DamageTypeVal,
} from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import { GamePhase, EnemyType, type WaveConfig, type MapConfig } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';
import { Sound } from '../utils/Sound.js';
import { shapeTypeToVal } from '../utils/visualHelpers.js';
import { resolveGraphFromMap } from '../level/graph/loaderAdapter.js';
import type { SpawnPoint } from '../level/graph/types.js';

// ---- bitecs query for alive enemy check ----

const aliveEnemyQuery = defineQuery([Health, UnitTag]);

// ---- hex color → RGB helper ----

function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// ---- gold color constant for elite outline ----
const GOLD_RGB = hexToRGB('#FFD700');

// ---- spawn options ----

export interface SpawnEnemyOptions {
  hpMultiplier?: number;
  atkMultiplier?: number;
  visualScale?: number;
  isElite?: boolean;
  cardOptions?: number;
  spawnPointIndex?: number;
  spawnId?: string;
}

/** Manages wave progression and enemy spawning */
export class WaveSystem implements System {
  readonly name = 'WaveSystem';

  private world: TowerWorld;
  private waves: WaveConfig[];
  private currentWaveIndex: number = 0;
  private spawnQueue: { enemyType: EnemyType; count: number; interval: number; spawnId?: string }[] = [];
  private spawnTimer: number = 0;
  private spawnIntervalTimer: number = 0;
  private spawnedInWave: number = 0;
  private totalInWave: number = 0;
  private waveActive: boolean = false;
  private isBossWave: boolean = false;
  private isEndless: boolean = false;

  // v4.0: elite spawning
  private eliteSpawned: boolean = false;
  private eliteEid: number = 0;
  private eliteEnemyType: EnemyType | null = null;

  // v4.0: difficulty scaling multiplier for current wave
  private currentDifficulty: { hpMult: number; atkMult: number } = { hpMult: 1.0, atkMult: 1.0 };

  // v4.0: spawn point distribution
  private waveSpawnPointIndex: number | undefined = undefined;
  private spawnDistributionCounter: number = 0;

  /** Auto-countdown timer — ticks down to 0 then starts next wave */
  countdown: number = 0;
  private countdownDuration: number = 5;

  /** Tracks last integer-second value of countdown for tick sound */
  private lastCountdownInt: number = 0;

  /** Throttle counter for enemy spawn sounds */
  private spawnSoundCounter: number = 0;

  private readonly resolvedSpawns: readonly SpawnPoint[];

  constructor(
    world: TowerWorld,
    private map: MapConfig,
    waves: WaveConfig[],
    private getPhase: () => GamePhase,
    private setPhase: (phase: GamePhase) => void,
    private onWaveComplete?: () => void,
    /** v3.0 Roguelike: 每波正式开始时触发（设置 Battle phase 之后）。用于 RunContext.startWaveEffect。 */
    private onWaveStart?: () => void,
    /** v4.0: 波次通关奖励金币回调 */
    private onWaveReward?: (gold: number) => void,
    /** v4.0: 精英敌人击杀回调 → 触发 3选1 抽卡 */
    private onEliteKilled?: () => void,
  ) {
    this.world = world;
    this.waves = waves;
    this.resolvedSpawns = resolveGraphFromMap(map).spawns;
  }

  get currentWave(): number {
    return this.currentWaveIndex + 1;
  }

  get totalWaves(): number {
    return this.isEndless ? -1 : this.waves.length;
  }

  get isActive(): boolean {
    return this.waveActive;
  }

  get totalSpawned(): number {
    return this.totalInWave;
  }

  get currentIsBossWave(): boolean {
    return this.isBossWave;
  }

  get isEndlessMode(): boolean {
    return this.isEndless;
  }

  /** v4.0: 4-stage difficulty multiplier based on wave progression ratio */
  static getDifficultyMultiplier(waveIndex: number, totalWaves: number): { hpMult: number; atkMult: number } {
    if (totalWaves <= 0) return { hpMult: 1.0, atkMult: 1.0 };
    const ratio = waveIndex / totalWaves;
    if (ratio < 0.2) return { hpMult: 0.8, atkMult: 0.8 };  // 开局
    if (ratio < 0.5) return { hpMult: 1.0, atkMult: 1.0 };  // 建设
    if (ratio < 0.8) return { hpMult: 1.3, atkMult: 1.3 };  // 压力
    return { hpMult: 1.5, atkMult: 1.5 };                    // 高潮
  }

  startEndlessMode(): void {
    this.isEndless = true;
    this.waves = [];
    this.currentWaveIndex = 0;
    this.spawnQueue = [];
    this.waveActive = false;
    this.isBossWave = false;
  }

  /** Start auto-countdown before next wave. Call on phase transitions. */
  startAutoCountdown(seconds?: number): void {
    this.countdown = seconds ?? this.countdownDuration;
    this.countdownDuration = seconds ?? 5;
  }

  /** Skip countdown and start the wave immediately */
  skipCountdown(): void {
    this.countdown = 0;
    this.startWave();
  }

  /** Stub endless wave generator — Phase 3 will rewrite */
  private generateEndlessWaveStub(waveNum: number): WaveConfig {
    return {
      waveNumber: waveNum,
      spawnDelay: 2,
      enemies: [{ enemyType: EnemyType.Goblin, count: 5 + waveNum * 2, spawnInterval: 1.0 }],
    };
  }

  /** Player clicks "start wave" — begin spawning */
  startWave(): void {
    // v4.0: calculate difficulty multiplier for this wave
    const totalWaves = this.isEndless ? 10 : this.waves.length;
    this.currentDifficulty = WaveSystem.getDifficultyMultiplier(this.currentWaveIndex, totalWaves);

    if (this.isEndless) {
      Sound.play('wave_start');
      const wave = this.generateEndlessWaveStub(this.currentWaveIndex + 1);
      this.isBossWave = wave.isBossWave ?? false;
      if (this.isBossWave) Sound.play('wave_boss');
      this.spawnQueue = wave.enemies.map((g) => ({
        enemyType: g.enemyType,
        count: g.count,
        interval: g.spawnInterval,
        spawnId: g.spawnId,
      }));
      this.spawnTimer = wave.spawnDelay;
      this.spawnIntervalTimer = 0;
      this.spawnedInWave = 0;
      this.totalInWave = wave.enemies.reduce((sum, g) => sum + g.count, 0);
      this.waveActive = true;

      // v4.0: reset elite tracking & spawn point
      this.resetEliteTracking(wave.enemies.map((g) => g.enemyType));
      this.waveSpawnPointIndex = wave.spawnPointIndex;
      this.spawnDistributionCounter = 0;

      this.setPhase(GamePhase.Battle);
      this.onWaveStart?.();
      return;
    }

    if (this.currentWaveIndex >= this.waves.length) return;

    Sound.play('wave_start');
    const wave = this.waves[this.currentWaveIndex]!;
    this.isBossWave = wave.isBossWave ?? false;
    if (this.isBossWave) Sound.play('wave_boss');
    this.spawnQueue = wave.enemies.map((g) => ({
      enemyType: g.enemyType,
      count: g.count,
      interval: g.spawnInterval,
      spawnId: g.spawnId,
    }));
    this.spawnTimer = wave.spawnDelay;
    this.spawnIntervalTimer = 0;
    this.spawnedInWave = 0;
    this.totalInWave = wave.enemies.reduce((sum, g) => sum + g.count, 0);
    this.waveActive = true;

    // v4.0: reset elite tracking & spawn point
    this.resetEliteTracking(wave.enemies.map((g) => g.enemyType));
    this.waveSpawnPointIndex = wave.spawnPointIndex;
    this.spawnDistributionCounter = 0;

    this.setPhase(GamePhase.Battle);
    this.onWaveStart?.();
  }

  /** v4.0: reset elite tracking state for a new wave */
  private resetEliteTracking(enemyTypes: EnemyType[]): void {
    this.eliteSpawned = false;
    this.eliteEid = 0;
    if (enemyTypes.length > 0) {
      this.eliteEnemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)] ?? null;
    } else {
      this.eliteEnemyType = null;
    }
  }

  update(world: TowerWorld, dt: number): void {
    // Store world reference for use in helper methods
    this.world = world;

    // Auto-countdown (ticks regardless of wave state)
    if (this.countdown > 0) {
      this.countdown -= dt;

      // Countdown tick sound at integer boundaries when <= 3s remain
      const currentCeil = Math.ceil(this.countdown);
      if (currentCeil !== this.lastCountdownInt && currentCeil <= 3) {
        Sound.play('countdown_tick');
      }
      this.lastCountdownInt = currentCeil;

      if (this.countdown <= 0) {
        this.countdown = 0;
        this.lastCountdownInt = 0;
        Sound.play('countdown_go');
        this.startWave();
        return;
      }
    }

    if (!this.waveActive) return;

    // Wait for initial spawn delay
    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      return;
    }

    // Spawn enemies from queue
    if (this.spawnQueue.length > 0) {
      this.spawnIntervalTimer -= dt;
      if (this.spawnIntervalTimer <= 0) {
        const group = this.spawnQueue[0]!;
        this.spawnEnemy(group.enemyType, { spawnId: group.spawnId });
        group.count--;
        this.spawnedInWave++;

        if (group.count <= 0) {
          this.spawnQueue.shift(); // move to next group
        }
        this.spawnIntervalTimer = group.interval;
      }
    }

    // Check if wave is complete (all enemies spawned AND all dead)
    if (
      this.spawnedInWave >= this.totalInWave &&
      this.spawnQueue.length === 0
    ) {
      // v4.0: spawn elite after all regular enemies are out (only once)
      if (!this.eliteSpawned && this.eliteEnemyType !== null) {
        this.spawnEliteEnemy();
      }

      const hasAliveEnemies = this.hasAliveEnemies();
      if (!hasAliveEnemies) {
        this.waveActive = false;
        Sound.play('wave_clear');
        this.isBossWave = false;

        // v4.0: fire wave reward callback
        const wave = this.isEndless
          ? null
          : (this.currentWaveIndex < this.waves.length ? this.waves[this.currentWaveIndex] : null);
        if (wave?.reward && this.onWaveReward) {
          this.onWaveReward(wave.reward);
        }

        this.currentWaveIndex++;

        if (this.isEndless) {
          this.onWaveComplete?.();
          this.setPhase(GamePhase.WaveBreak);
          this.startAutoCountdown(3); // 3s between endless waves
        } else if (this.currentWaveIndex >= this.waves.length) {
          this.setPhase(GamePhase.Victory);
        } else {
          this.onWaveComplete?.();
          this.setPhase(GamePhase.WaveBreak);
          this.startAutoCountdown(3); // 3s between waves
        }
      }
    }

    // v4.0: check if elite was killed (must check every frame while elite is alive)
    if (this.eliteEid > 0) {
      const eliteHp = Health.current[this.eliteEid];
      if (eliteHp !== undefined && eliteHp <= 0) {
        this.onEliteKilled?.();
        this.eliteEid = 0; // prevent repeated triggers
      }
    }
  }

  /** Check if any enemy entities are still alive using bitecs query */
  private hasAliveEnemies(): boolean {
    const enemies = aliveEnemyQuery(this.world.world);
    for (const eid of enemies) {
      if (UnitTag.isEnemy[eid] === 1 && Health.current[eid]! > 0) {
        return true;
      }
    }
    return false;
  }

  private spawnEnemy(type: EnemyType, options?: SpawnEnemyOptions): number {
    const config = ENEMY_CONFIGS[type];
    if (!config) return 0;

    // v4.0: resolve spawn point (options override, then wave config, then distribute)
    const [spawn, spawnIdx] = this.resolveSpawnPoint(options?.spawnPointIndex, options?.spawnId);
    const ts = this.map.tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const x = spawn.col * ts + ts / 2 + ox;
    const y = spawn.row * ts + ts / 2 + oy;

    const eid = this.world.createEntity();
    const rgb = hexToRGB(config.color);
    const isElite = options?.isElite ?? false;

    // v4.0: calculate effective multipliers
    const hpMult = (options?.hpMultiplier ?? 1.0) * this.currentDifficulty.hpMult;
    const atkMult = (options?.atkMultiplier ?? 1.0) * this.currentDifficulty.atkMult;
    const visualScale = options?.visualScale ?? 1.0;

    this.world.addComponent(eid, Position, { x, y });
    this.world.addComponent(eid, Health, {
      current: Math.round(config.hp * hpMult),
      max: Math.round(config.hp * hpMult),
      armor: config.defense,
      magicResist: config.magicResist,
    });
    this.world.addComponent(eid, Movement, {
      speed: config.speed,
      moveMode: MoveModeVal.FollowPath,
      spawnIdx: spawnIdx,
    });

    const effectiveAtk = Math.round(config.atk * atkMult);
    this.world.addComponent(eid, UnitTag, {
      isEnemy: 1,
      isElite: isElite ? 1 : 0,
      rewardGold: config.rewardGold,
      canAttackBuildings: config.canAttackBuildings ? 1 : 0,
      atk: effectiveAtk,
    });

    const shapeVal = shapeTypeToVal(config.shape ?? 'circle');
    const partsId = config.visualParts
      ? this.world.registerUnitVisualParts(config.visualParts)
      : 0;

    // v4.0: elite visual — gold outline, size × visualScale
    const goldR = GOLD_RGB.r;
    const goldG = GOLD_RGB.g;
    const goldB = GOLD_RGB.b;

    this.world.addComponent(eid, Visual, {
      shape: shapeVal,
      colorR: isElite ? goldR : rgb.r,
      colorG: isElite ? goldG : rgb.g,
      colorB: isElite ? goldB : rgb.b,
      size: config.radius * 2 * visualScale,
      alpha: 1,
      facing: 1,
      bobPhase: 0,
      breathPhase: Math.random() * Math.PI * 2,
      attackAnimTimer: 0,
      attackAnimDuration: config.attackAnimDuration ?? 0.3,
      partsId,
    });
    this.world.addComponent(eid, Category, {
      value: CategoryVal.Enemy,
    });

    // Ground enemies — all default to Ground layer
    this.world.addComponent(eid, Layer, {
      value: LayerVal.Ground,
    });
    this.world.addComponent(eid, Faction, {
      value: FactionVal.Evil,
    });

    // Attackers get an Attack component (range > 0 means can attack)
    if (config.attackRange > 0) {
      this.world.addComponent(eid, Attack, {
        damage: effectiveAtk,
        attackSpeed: config.attackSpeed,
        range: config.attackRange,
        damageType: DamageTypeVal.Physical,
        isRanged: config.attackRange > 60 ? 1 : 0, // 远程阈值 60px
      });
    }

    // Boss component
    if (config.isBoss) {
      this.world.addComponent(eid, Boss, {
        phase: 1,
        phase2HpRatio: config.bossPhase2HpRatio ?? 0.5,
      });
    }

    // v4.0: Elite component
    if (isElite) {
      this.world.addComponent(eid, Elite, {
        cardOptions: options?.cardOptions ?? 3,
        hpMultiplier: options?.hpMultiplier ?? 2.0,
        atkMultiplier: options?.atkMultiplier ?? 1.5,
        visualScale: visualScale,
      });
    }

    // Display name for overhead HUD
    this.world.setDisplayName(eid, isElite ? `精英 ${config.name}` : config.name);

    // Throttled spawn sound — roughly 1 in 3 spawns
    this.spawnSoundCounter++;
    if (this.spawnSoundCounter % 3 === 0) {
      Sound.play('enemy_spawn');
    }

    return eid;
  }

  /** v4.0: resolve which spawn point to use for an enemy.
   *  Returns [spawnPoint, spawnIndex] */
  private resolveSpawnPoint(overrideIndex?: number, spawnId?: string): [SpawnPoint, number] {
    // spawnId string takes priority — resolve to index via map.spawns
    if (spawnId !== undefined && this.map.spawns) {
      const idx = this.map.spawns.findIndex((s) => s.id === spawnId);
      if (idx >= 0 && idx < this.resolvedSpawns.length) {
        return [this.resolvedSpawns[idx]!, idx];
      }
    }
    // Options override takes priority
    if (overrideIndex !== undefined && overrideIndex >= 0 && overrideIndex < this.resolvedSpawns.length) {
      return [this.resolvedSpawns[overrideIndex]!, overrideIndex];
    }
    // Wave config spawnPointIndex
    const waveIndex = this.waveSpawnPointIndex;
    if (waveIndex !== undefined && waveIndex >= 0 && waveIndex < this.resolvedSpawns.length) {
      return [this.resolvedSpawns[waveIndex]!, waveIndex];
    }
    // -1 or undefined → distribute across all spawns (round-robin)
    if (this.resolvedSpawns.length <= 1) {
      return [this.resolvedSpawns[0]!, 0];
    }
    const idx = this.spawnDistributionCounter % this.resolvedSpawns.length;
    this.spawnDistributionCounter++;
    return [this.resolvedSpawns[idx]!, idx];
  }

  /** v4.0: spawn the elite enemy for the current wave */
  private spawnEliteEnemy(): void {
    if (this.eliteEnemyType === null || this.eliteSpawned) return;
    this.eliteSpawned = true;

    // Elite spawns at a random spawn point (if multiple)
    const randomSpawnIdx = this.resolvedSpawns.length > 1
      ? Math.floor(Math.random() * this.resolvedSpawns.length)
      : undefined;

    const options: SpawnEnemyOptions = {
      hpMultiplier: 2.0,
      atkMultiplier: 1.5,
      visualScale: 1.2,
      isElite: true,
      cardOptions: 3,
      spawnPointIndex: randomSpawnIdx,
    };

    this.eliteEid = this.spawnEnemy(this.eliteEnemyType, options);
    Sound.play('enemy_spawn');
  }
  }
