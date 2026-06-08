// ============================================================
// Tower Defender — ComboKillSystem
//
// 连杀系统：追踪连续击杀（5秒窗口），连杀≥2时：
//  - 显示 "N连杀!" 飘字
//  - 击杀金币掉落 1.2x 加成
//
// 设计: 用户需求（combo连杀设计）
// ============================================================

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Position, ComboFloatingText } from '../core/components.js';

// ============================================================
// Constants
// ============================================================

/** 连杀判定窗口（秒） */
const COMBO_WINDOW = 5.0;
/** 连杀金币加成倍率 */
const GOLD_MULTIPLIER = 1.2;
/** 飘字存活时间（秒） */
const FLOAT_DURATION = 2.0;
/** 飘字浮起速度（px/s） */
const FLOAT_SPEED = 50;

// ============================================================
// Query
// ============================================================

const comboTextQuery = defineQuery([Position, ComboFloatingText]);

// ============================================================
// System
// ============================================================

export class ComboKillSystem implements System {
  readonly name = 'ComboKillSystem';

  /** 当前连杀计数 */
  private comboCount = 0;
  /** 上次击杀时的游戏时间 */
  private lastKillGameTime = -Infinity;
  /** 累计游戏时间（秒） */
  private gameTime = 0;

  // ============================================================
  // Public API
  // ============================================================

  /**
   * 敌人被击杀时调用。
   * @returns 金币加成倍率（连杀 ≥ 2 时返回 1.2，否则 1.0）
   */
  notifyEnemyKilled(enemyId: number, world: TowerWorld): number {
    const timeSinceLastKill = this.gameTime - this.lastKillGameTime;

    if (timeSinceLastKill <= COMBO_WINDOW) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }

    this.lastKillGameTime = this.gameTime;

    // 连杀 ≥ 2 时生成飘字
    if (this.comboCount >= 2) {
      this.spawnComboText(world, enemyId);
    }

    return this.comboCount >= 2 ? GOLD_MULTIPLIER : 1.0;
  }

  /** 获取当前连杀数（供外部查询，如 UI 显示） */
  getComboCount(): number {
    return this.comboCount;
  }

  // ============================================================
  // Private
  // ============================================================

  /** 在敌人死亡位置生成连杀飘字实体 */
  private spawnComboText(world: TowerWorld, enemyId: number): void {
    const px = Position.x[enemyId];
    const py = Position.y[enemyId];
    if (px === undefined || py === undefined) return;

    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: px, y: py - 10 });
    world.addComponent(eid, ComboFloatingText, {
      comboCount: this.comboCount,
      lifetime: 0,
      maxLifetime: FLOAT_DURATION,
      velocityY: FLOAT_SPEED,
      scale: 0.4,
      alpha: 1,
    });
  }

  // ============================================================
  // System interface
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    this.gameTime += dt;

    // 连杀窗口超时 → 重置
    const timeSinceLastKill = this.gameTime - this.lastKillGameTime;
    if (timeSinceLastKill > COMBO_WINDOW && this.comboCount > 0) {
      this.comboCount = 0;
    }

    // 更新飘字实体生命周期
    const entities = comboTextQuery(world.world);
    for (const eid of entities) {
      const lifetime = ComboFloatingText.lifetime[eid]! + dt;
      const maxLifetime = ComboFloatingText.maxLifetime[eid]!;

      if (lifetime >= maxLifetime) {
        world.destroyEntity(eid);
        continue;
      }

      ComboFloatingText.lifetime[eid] = lifetime;

      // 向上浮动
      Position.y[eid] = (Position.y[eid] ?? 0) - ComboFloatingText.velocityY[eid]! * dt;

      // 缩放动画：0 → 30% 快速放大到 1.0，之后保持
      const progress = lifetime / maxLifetime;
      const scale = progress < 0.3
        ? 0.4 + (progress / 0.3) * 0.6
        : 1.0;
      ComboFloatingText.scale[eid] = scale;

      // 透明度：最后 40% 线性淡出
      const alpha = progress < 0.6
        ? 1.0
        : 1.0 - (progress - 0.6) / 0.4;
      ComboFloatingText.alpha[eid] = alpha;
    }
  }

  // ============================================================
  // Render（在 onPostRender 中调用）
  // ============================================================

  /**
   * 渲染所有连杀飘字实体。
   * 在 main.ts 的 onPostRender 中调用。
   */
  renderAll(world: TowerWorld, ctx: CanvasRenderingContext2D): void {
    const entities = comboTextQuery(world.world);
    if (entities.length === 0) return;

    ctx.save();

    for (const eid of entities) {
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;

      const count = ComboFloatingText.comboCount[eid]!;
      const scale = ComboFloatingText.scale[eid]!;
      const alpha = ComboFloatingText.alpha[eid]!;

      const text = `${count}连杀!`;
      const fontSize = Math.round(24 * scale);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 高连杀（≥5）使用更热烈的颜色
      const isHighCombo = count >= 5;

      // 深色描边（提升可读性）
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.85})`;
      ctx.lineWidth = 4;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.strokeText(text, px, py);

      // 主体文字
      if (isHighCombo) {
        // 高连杀：炽热橙红色
        ctx.fillStyle = `rgba(255, ${Math.round(60 + scale * 20)}, 20, ${alpha})`;
      } else {
        // 普通连杀：金色
        ctx.fillStyle = `rgba(255, 200, 30, ${alpha})`;
      }
      ctx.fillText(text, px, py);

      // 高连杀额外光晕
      if (isHighCombo) {
        ctx.font = `bold ${Math.round(30 * scale)}px sans-serif`;
        ctx.fillStyle = `rgba(255, 255, 120, ${alpha * 0.25})`;
        ctx.fillText(text, px, py);
      }
    }

    ctx.restore();
  }

  /** 重置连杀状态（进入新关卡时调用） */
  reset(): void {
    this.comboCount = 0;
    this.lastKillGameTime = -Infinity;
    this.gameTime = 0;
  }
}
