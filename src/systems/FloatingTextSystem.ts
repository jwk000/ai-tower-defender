// ============================================================
// Tower Defender — FloatingTextSystem
//
// 放置提示飘字系统：在指定位置显示浮动文字提示（如 "金币不足"、"地格已被占用"）
// 通过 ECS 实体管理生命周期，在 post-render 中直接绘制 Canvas 2D 文字
//
// bitecs 不支持字符串类型的 SoA 字段，因此文字内容存储在系统内部的 Map 中
// ============================================================

import { TowerWorld, type System } from '../core/World.js';
import { Position, FloatingText, floatingTextQuery } from '../core/components.js';
import { getGlobalRandom } from '../utils/Random.js';

// ============================================================
// Const
// ============================================================

const FLOAT_DURATION = 1.5;       // 飘字存活时间 (s)
const FLOAT_SPEED_BASE = 40;      // 基础浮起速度 (px/s)
const FLOAT_SPEED_VARIANCE = 15;  // 浮起速度随机范围
const HORIZONTAL_JITTER = 10;     // 水平随机偏移范围 (px)
const FONT_SIZE = 16;             // 字号

/** 默认提示文字颜色（暖橙红） */
const DEFAULT_COLOR = { r: 255, g: 140, b: 80 };

// ============================================================
// System
// ============================================================

export class FloatingTextSystem implements System {
  readonly name = 'FloatingTextSystem';

  /** 实体 ID → 文字内容（bitecs 不支持字符串 SoA 字段） */
  private _texts: Map<number, string> = new Map();

  // ============================================================
  // System interface
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    const entities = floatingTextQuery(world.world);
    for (const eid of entities) {
      const lifetime = FloatingText.lifetime[eid]! + dt;

      if (lifetime >= FloatingText.maxLifetime[eid]!) {
        this._texts.delete(eid);
        world.destroyEntity(eid);
        continue;
      }

      FloatingText.lifetime[eid] = lifetime;
      // 向上浮动
      Position.y[eid] = (Position.y[eid] ?? 0) - FloatingText.velocityY[eid]! * dt;
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * 在指定坐标生成放置提示飘字
   * @param world   ECS World
   * @param x       世界坐标 X
   * @param y       世界坐标 Y
   * @param text    提示文字
   * @param color   可选颜色 { r, g, b }，默认暖橙红
   */
  show(
    world: TowerWorld,
    x: number,
    y: number,
    text: string,
    color: { r: number; g: number; b: number } = DEFAULT_COLOR,
  ): void {
    const rng = getGlobalRandom().decor;
    const jx = x + (rng.next() - 0.5) * HORIZONTAL_JITTER * 2;
    const jy = y - 8;
    const vy = FLOAT_SPEED_BASE + rng.next() * FLOAT_SPEED_VARIANCE;

    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: jx, y: jy });
    world.addComponent(eid, FloatingText, {
      lifetime: 0,
      maxLifetime: FLOAT_DURATION,
      velocityY: vy,
      colorR: color.r,
      colorG: color.g,
      colorB: color.b,
    });
    this._texts.set(eid, text);
  }

  // ============================================================
  // Render（在 post-render 中调用）
  // ============================================================

  /**
   * 通过 world 遍历所有飘字实体并渲染
   * 在 main.ts 的 onPostRender 中调用此方法
   */
  renderAll(world: TowerWorld, ctx: CanvasRenderingContext2D): void {
    const entities = floatingTextQuery(world.world);
    if (entities.length === 0) return;

    ctx.save();

    for (const eid of entities) {
      const px = Position.x[eid];
      const py = Position.y[eid];
      if (px === undefined || py === undefined) continue;

      const text = this._texts.get(eid);
      if (!text) continue;

      const lifetime = FloatingText.lifetime[eid]!;
      const maxLifetime = FloatingText.maxLifetime[eid]!;
      const r = FloatingText.colorR[eid]!;
      const g = FloatingText.colorG[eid]!;
      const b = FloatingText.colorB[eid]!;

      // 透明度：前 1/3 淡入，中间 1/3 保持，后 1/3 淡出
      const progress = lifetime / maxLifetime;
      let alpha: number;
      if (progress < 0.2) {
        alpha = progress / 0.2;
      } else if (progress > 0.7) {
        alpha = 1 - (progress - 0.7) / 0.3;
      } else {
        alpha = 1;
      }

      // 缩放：初始 0.7 → 0.2s 到达 1.0
      const scale = progress < 0.15
        ? 0.7 + (progress / 0.15) * 0.3
        : 1.0;

      const fontSize = Math.round(FONT_SIZE * scale);

      // 阴影描边
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
      ctx.lineWidth = 2.5;
      ctx.strokeText(text, px, py);

      // 主体文字
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillText(text, px, py);
    }

    ctx.restore();
  }
}
