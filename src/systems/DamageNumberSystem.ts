// ============================================================
// Tower Defender — DamageNumberSystem
//
// 飘字系统：在受击位置显示浮动伤害/治疗数字
// 通过 damageUtils 的 DamageObserver 监听所有伤害事件
// 渲染：在 post-render 中直接绘制 Canvas 2D 文字
//
// P0-1: 伤害飘字
// ============================================================

import { TowerWorld, type System, defineQuery, entityExists, hasComponent } from '../core/World.js';
import { Position, Health, DamageNumber, DamageNumberStyle } from '../core/components.js';
import { getGlobalRandom } from '../utils/Random.js';

// ============================================================
// Const
// ============================================================

const FLOAT_DURATION = 1.2;     // 飘字存活时间 (s)
const FLOAT_SPEED_BASE = 50;    // 基础浮起速度 (px/s)
const FLOAT_SPEED_VARIANCE = 20; // 浮起速度随机范围
const HORIZONTAL_JITTER = 15;   // 水平随机偏移范围 (px)

/** 颜色样式映射 */
const STYLE_COLORS: Record<number, { r: number; g: number; b: number }> = {
  [DamageNumberStyle.Physical]: { r: 255, g: 180, b: 50 },   // 橙色
  [DamageNumberStyle.Magic]: { r: 160, g: 120, b: 255 },     // 紫色
  [DamageNumberStyle.True]: { r: 255, g: 220, b: 60 },       // 金色
  [DamageNumberStyle.Heal]: { r: 80, g: 255, b: 80 },        // 绿色
  [DamageNumberStyle.Critical]: { r: 255, g: 60, b: 60 },    // 红色
  [DamageNumberStyle.Gold]: { r: 255, g: 215, b: 0 },        // 金币
};

// ============================================================
// Query
// ============================================================

const damageNumberQuery = defineQuery([Position, DamageNumber]);

// ============================================================
// System
// ============================================================

export class DamageNumberSystem implements System {
  readonly name = 'DamageNumberSystem';

  private _pendingSpawns: Array<{ targetId: number; actualDamage: number }> = [];
  private _pendingCustomSpawns: Array<{ x: number; y: number; value: number; style: number }> = [];

  /** 
   * 由伤害观察者回调调用（无 world 上下文）
   * 将伤害事件入队，在 update() 中消费
   */
  enqueueDamage(targetId: number, actualDamage: number): void {
    if (actualDamage > 0) {
      this._pendingSpawns.push({ targetId, actualDamage });
    }
  }

  /** 在系统 update 中消费积压的 spawn 请求 */
  private flushPending(world: TowerWorld): void {
    for (const s of this._pendingSpawns) {
      this.spawnAtTarget(world, s.targetId, s.actualDamage, DamageNumberStyle.Physical);
    }
    this._pendingSpawns = [];

    for (const c of this._pendingCustomSpawns) {
      this.spawnAtPos(world, c.x, c.y, c.value, c.style);
    }
    this._pendingCustomSpawns = [];
  }

  // ============================================================
  // System interface
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    this.flushPending(world);

    const entities = damageNumberQuery(world.world);
    for (const eid of entities) {
      const lifetime = DamageNumber.lifetime[eid]! + dt;

      if (lifetime >= DamageNumber.maxLifetime[eid]!) {
        world.destroyEntity(eid);
        continue;
      }

      DamageNumber.lifetime[eid] = lifetime;
      // 向上浮动
      Position.y[eid] = (Position.y[eid] ?? 0) - DamageNumber.velocityY[eid]! * dt;
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * 在目标实体位置附近生成飘字
   */
  spawnAtTarget(
    world: TowerWorld,
    targetId: number,
    value: number,
    style: number = DamageNumberStyle.Physical,
  ): void {
    if (!entityExists(world.world, targetId)) return;
    if (!hasComponent(world.world, Position, targetId)) return;
    if (!hasComponent(world.world, Health, targetId)) return;
    if ((Health.current[targetId] ?? 0) <= 0) return;

    const px = Position.x[targetId];
    const py = Position.y[targetId];
    if (px === undefined || py === undefined) return;

    const rng = getGlobalRandom().decor;
    const x = px + (rng.next() - 0.5) * HORIZONTAL_JITTER * 2;
    const y = py - 10; // 从目标上方开始
    const vy = FLOAT_SPEED_BASE + rng.next() * FLOAT_SPEED_VARIANCE;

    this.createNumber(world, x, y, Math.round(value), style, vy);
  }

  /**
   * 在指定坐标生成飘字（不关联实体，用于 DOT 等场景）
   */
  spawnAtPos(
    world: TowerWorld,
    x: number,
    y: number,
    value: number,
    style: number = DamageNumberStyle.Magic,
  ): void {
    const rng = getGlobalRandom().decor;
    const jx = x + (rng.next() - 0.5) * HORIZONTAL_JITTER * 2;
    const jy = y - 5;
    const vy = FLOAT_SPEED_BASE + rng.next() * FLOAT_SPEED_VARIANCE;

    this.createNumber(world, jx, jy, Math.round(value), style, vy);
  }

  private createNumber(
    world: TowerWorld,
    x: number,
    y: number,
    value: number,
    style: number,
    vy: number,
  ): void {
    const colors = STYLE_COLORS[style] ?? STYLE_COLORS[DamageNumberStyle.Physical]!;

    const eid = world.createEntity();
    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, DamageNumber, {
      style,
      value,
      lifetime: 0,
      maxLifetime: FLOAT_DURATION,
      velocityY: vy,
      colorR: colors.r,
      colorG: colors.g,
      colorB: colors.b,
    });
  }

  // ============================================================
  // Render（在 post-render 中调用）
  // ============================================================

  /**
   * 通过 world 遍历所有飘字实体并渲染
   * 在 main.ts 的 onPostRender 中调用此方法
   */
  renderAll(world: TowerWorld, ctx: CanvasRenderingContext2D): void {
    const entities = damageNumberQuery(world.world);
    if (entities.length === 0) return;

    ctx.save();

    for (const eid of entities) {
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;

      const lifetime = DamageNumber.lifetime[eid]!;
      const maxLifetime = DamageNumber.maxLifetime[eid]!;
      const value = DamageNumber.value[eid]!;
      const r = DamageNumber.colorR[eid]!;
      const g = DamageNumber.colorG[eid]!;
      const b = DamageNumber.colorB[eid]!;
      const style = DamageNumber.style[eid] as number;

      // 透明度：前半段保持 1，后半段线性淡出
      const progress = lifetime / maxLifetime;
      const alpha = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2;

      // 缩放：初始 0.6 → 0.3s 到达 1.0 → 保持 → 淡出
      const scale = progress < 0.25
        ? 0.6 + (progress / 0.25) * 0.4
        : 1.0;

      const text = value >= 1 ? String(Math.round(value)) : '';

      ctx.font = `bold ${Math.round(18 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 阴影描边（深色轮廓，提升可读性）
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
      ctx.lineWidth = 3;
      ctx.strokeText(text, px, py);

      // 主体文字
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillText(text, px, py);

      // 暴击样式额外光晕
      if (style === DamageNumberStyle.Critical) {
        ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.3})`;
        ctx.font = `bold ${Math.round(24 * scale)}px sans-serif`;
        ctx.fillText(text, px, py);
      }
    }

    ctx.restore();
  }
}
