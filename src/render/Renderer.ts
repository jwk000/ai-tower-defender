import type { RenderCommand, ShapeType } from '../types/index.js';
import { getFont } from '../config/fonts.js';
import { Container } from 'pixi.js';
import { LayoutManager } from '../ui/LayoutManager.js';

/** Canvas 2D renderer — draws geometric shapes with a command buffer */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private commands: RenderCommand[] = [];
  private tintCanvas: HTMLCanvasElement | null = null;
  private tintCtx: CanvasRenderingContext2D | null = null;

  /** PixiJS container bridge — for systems migrated to Graphics API */
  readonly container: Container = new Container();

  /** Design resolution (logical coordinate space, always 1920×1080) */
  static readonly DESIGN_W = 1920;
  static readonly DESIGN_H = 1080;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  /**
   * Recalculate canvas dimensions and design-space mapping.
   *
   * Canvas internal resolution = viewport dimensions (no letterboxing).
   * A 2D transform maps the 1920×1080 design space into the viewport,
   * height-based uniform scaling, horizontally centered.
   */
  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Canvas CSS fills the window
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    // Canvas internal resolution = viewport dimensions
    this.canvas.width = w;
    this.canvas.height = h;

    // Update layout manager (scale factor, offsets)
    LayoutManager.update(w, h);
  }

  /** Apply the design-space → viewport transform to the canvas context */
  applyDesignTransform(): void {
    this.ctx.setTransform(
      LayoutManager.scale, 0,
      0, LayoutManager.scale,
      LayoutManager.designOffsetX, LayoutManager.designOffsetY,
    );
  }

  /** Reset canvas transform to identity (viewport-space drawing) */
  resetTransform(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  beginFrame(): void {
    this.commands = [];

    // Fill full viewport background (viewport-space, no design transform)
    this.resetTransform();
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Set design-space transform for subsequent render command drawing
    this.applyDesignTransform();
  }

  /** Add a render command to the buffer */
  push(cmd: RenderCommand): void {
    this.commands.push(cmd);
  }

  endFrame(): void {
    // Sort by z-index (ascending = back-to-front). Default z=5 (Ground).
    // Stable sort: same z preserves push order (= Y-sort within layer).
    const sorted = [...this.commands].sort((a, b) => (a.z ?? 5) - (b.z ?? 5));
    for (const cmd of sorted) {
      this.drawCommand(cmd);
    }
  }

  redrawCommands(predicate: (cmd: RenderCommand) => boolean): void {
    const sorted = this.commands
      .filter(predicate)
      .sort((a, b) => (a.z ?? 5) - (b.z ?? 5));
    for (const cmd of sorted) {
      this.drawCommand(cmd);
    }
  }

  private getTintContext(w: number, h: number): CanvasRenderingContext2D | null {
    const width = Math.max(1, Math.ceil(w));
    const height = Math.max(1, Math.ceil(h));
    if (!this.tintCanvas) {
      this.tintCanvas = document.createElement('canvas');
      this.tintCtx = this.tintCanvas.getContext('2d');
    }
    if (!this.tintCanvas || !this.tintCtx) return null;
    if (this.tintCanvas.width !== width) this.tintCanvas.width = width;
    if (this.tintCanvas.height !== height) this.tintCanvas.height = height;
    return this.tintCtx;
  }

  private drawImageTintMask(
    image: CanvasImageSource,
    imageSource: RenderCommand['imageSource'],
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    tint: { color: string; alpha: number },
  ): void {
    const alpha = Math.max(0, Math.min(1, tint.alpha));
    if (alpha <= 0) return;

    const tintCtx = this.getTintContext(dw, dh);
    if (!tintCtx || !this.tintCanvas) return;

    tintCtx.save();
    tintCtx.setTransform(1, 0, 0, 1, 0, 0);
    tintCtx.globalAlpha = 1;
    tintCtx.globalCompositeOperation = 'source-over';
    tintCtx.clearRect(0, 0, this.tintCanvas.width, this.tintCanvas.height);
    if (imageSource) {
      tintCtx.drawImage(
        image,
        imageSource.x,
        imageSource.y,
        imageSource.w,
        imageSource.h,
        0,
        0,
        dw,
        dh,
      );
    } else {
      tintCtx.drawImage(image, 0, 0, dw, dh);
    }
    tintCtx.globalCompositeOperation = 'source-in';
    tintCtx.fillStyle = tint.color;
    tintCtx.fillRect(0, 0, dw, dh);
    tintCtx.restore();

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this.tintCanvas, dx, dy, dw, dh);
    this.ctx.restore();
  }

  private drawCommand(cmd: RenderCommand): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = cmd.alpha ?? 1;

    const cx = cmd.x;
    const cy = cmd.y;
    const s = cmd.size;
    const hs = s / 2;

    switch (cmd.shape) {
      case 'rect': {
        const rw = s;           // width = size
        const rh = cmd.h ?? s;  // height = h if set, else size (square)
        const rot = cmd.rotation ?? 0;
        const drawImage = (dx: number, dy: number, dw: number, dh: number): void => {
          if (!cmd.image) return;
          if (cmd.imageSource) {
            ctx.drawImage(
              cmd.image,
              cmd.imageSource.x,
              cmd.imageSource.y,
              cmd.imageSource.w,
              cmd.imageSource.h,
              dx,
              dy,
              dw,
              dh,
            );
          } else {
            ctx.drawImage(cmd.image, dx, dy, dw, dh);
          }
          if (cmd.imageTint && cmd.imageTint.alpha > 0) {
            this.drawImageTintMask(cmd.image, cmd.imageSource, dx, dy, dw, dh, cmd.imageTint);
          }
        };

        if (cmd.clipRadius) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, cmd.clipRadius, 0, Math.PI * 2);
          ctx.clip();
        }

        if (rot !== 0) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot);
          if (cmd.scaleX !== undefined && cmd.scaleX !== 1) ctx.scale(cmd.scaleX, 1);
          if (cmd.image) {
            drawImage(-rw / 2, -rh / 2, rw, rh);
          } else {
            ctx.fillStyle = cmd.color;
            ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
          }
          if (cmd.stroke) {
            ctx.strokeStyle = cmd.stroke;
            ctx.lineWidth = cmd.strokeWidth ?? 1;
            ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);
          }
          ctx.restore();
        } else {
          const x = cx - rw / 2;
          const y = cy - rh / 2;
          if (cmd.image) {
            if (cmd.scaleX !== undefined && cmd.scaleX !== 1) {
              ctx.save();
              ctx.translate(cx, cy);
              ctx.scale(cmd.scaleX, 1);
              drawImage(-rw / 2, -rh / 2, rw, rh);
              ctx.restore();
            } else {
              drawImage(x, y, rw, rh);
            }
          } else {
            ctx.fillStyle = cmd.color;
            ctx.fillRect(x, y, rw, rh);
          }
          if (cmd.stroke) {
            ctx.strokeStyle = cmd.stroke;
            ctx.lineWidth = cmd.strokeWidth ?? 1;
            ctx.strokeRect(x, y, rw, rh);
          }
        }

        if (cmd.clipRadius) {
          ctx.restore();
        }
        break;
      }
      case 'circle':
        ctx.fillStyle = cmd.color;
        ctx.beginPath();
        ctx.arc(cx, cy, hs, 0, Math.PI * 2);
        ctx.fill();
        if (cmd.stroke) {
          ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth ?? 2;
          ctx.stroke();
        }
        break;
      case 'triangle':
        ctx.fillStyle = cmd.color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - hs);
        ctx.lineTo(cx - hs * 0.866, cy + hs * 0.5);
        ctx.lineTo(cx + hs * 0.866, cy + hs * 0.5);
        ctx.closePath();
        ctx.fill();
        break;
      case 'diamond':
        ctx.fillStyle = cmd.color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - hs);
        ctx.lineTo(cx + hs, cy);
        ctx.lineTo(cx, cy + hs);
        ctx.lineTo(cx - hs, cy);
        ctx.closePath();
        ctx.fill();
        if (cmd.stroke) {
          ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth ?? 1;
          ctx.stroke();
        }
        break;
      case 'hexagon':
        ctx.fillStyle = cmd.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = cx + hs * Math.cos(angle);
          const py = cy + hs * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'arrow': {
        // Arrow: triangle head + rectangular shaft, rotated toward (targetX,targetY)
        const tx = cmd.targetX ?? cx + s;
        const ty = cmd.targetY ?? cy;
        const angle = Math.atan2(ty - cy, tx - cx);
        const lengthScale = cmd.arrowLengthScale ?? 1;
        const headLen = s * 0.55 * lengthScale;
        const headWidth = headLen * (cmd.arrowHeadWidthRatio ?? 0.4);
        const shaftW = s * (cmd.arrowShaftWidthRatio ?? 0.18);
        const tipX = s * 0.7 * lengthScale;          // head tip — extends forward
        const shaftStart = -s * 0.4 * lengthScale;   // shaft tail — extends backward

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        if (cmd.arrowGlowColor) {
          ctx.save();
          ctx.globalAlpha = cmd.arrowGlowAlpha ?? 0.28;
          ctx.shadowColor = cmd.arrowGlowColor;
          ctx.shadowBlur = Math.max(10, s * 0.35);
          ctx.strokeStyle = cmd.arrowGlowColor;
          ctx.lineWidth = Math.max(8, shaftW * 2.6);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(shaftStart, 0);
          ctx.lineTo(tipX, 0);
          ctx.stroke();
          ctx.restore();
        }

        if (cmd.arrowAirStreaks) {
          ctx.save();
          ctx.globalAlpha = 0.36;
          ctx.strokeStyle = '#d7f5ff';
          ctx.lineWidth = Math.max(1, shaftW * 0.32);
          ctx.lineCap = 'round';
          for (const offset of [-1, 1]) {
            const y = offset * Math.max(8, shaftW * 2.5);
            ctx.beginPath();
            ctx.moveTo(shaftStart - s * 0.22, y);
            ctx.lineTo(shaftStart + s * 0.42, y * 0.72);
            ctx.stroke();
          }
          ctx.restore();
        }

        if (cmd.image) {
          const imageW = s;
          const imageH = cmd.h ?? s;
          if (cmd.imageSource) {
            ctx.drawImage(
              cmd.image,
              cmd.imageSource.x,
              cmd.imageSource.y,
              cmd.imageSource.w,
              cmd.imageSource.h,
              -imageW / 2,
              -imageH / 2,
              imageW,
              imageH,
            );
          } else {
            ctx.drawImage(cmd.image, -imageW / 2, -imageH / 2, imageW, imageH);
          }
          ctx.restore();
          break;
        }

        // Arrow shaft — gradient when arrowGradientTail is set
        if (cmd.arrowGradientTail) {
          const grad = ctx.createLinearGradient(shaftStart, 0, tipX, 0);
          grad.addColorStop(0, cmd.arrowGradientTail);
          grad.addColorStop(1, cmd.color);
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = cmd.color;
        }
        ctx.fillRect(shaftStart, -shaftW / 2, tipX - shaftStart, shaftW);

        // Arrow head (triangle) — always solid head color
        ctx.fillStyle = cmd.color;
        ctx.beginPath();
        ctx.moveTo(tipX, 0);
        ctx.lineTo(tipX - headLen, -headWidth);
        ctx.lineTo(tipX - headLen, headWidth);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
    }

    // Text label on top of shape
    if (cmd.label) {
      ctx.fillStyle = cmd.labelColor ?? '#ffffff';
      ctx.font = getFont(cmd.labelSize ?? 16);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cmd.label, cx, cy);
    }

    ctx.restore();
  }

  /** Measure rendered width of a label (design-space pixels) at the given font size */
  measureLabel(text: string, size: number = 16): number {
    if (!text) return 0;
    const prevFont = this.ctx.font;
    this.ctx.font = getFont(size);
    const w = this.ctx.measureText(text).width;
    this.ctx.font = prevFont;
    return w;
  }

  /**
   * Apply gaussian blur effect to the current canvas content.
   * This captures the current frame, applies blur, and redraws it.
   * Use for modal overlays (draft, pause, etc.) to blur the background.
   *
   * @param blurRadius Blur strength in pixels (default: 12)
   */
  applyBlur(blurRadius: number = 12): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Save current transform
    ctx.save();

    // Reset to viewport space for capture
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Create temporary canvas to capture current frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Copy current canvas to temp
    tempCtx.drawImage(this.canvas, 0, 0);

    // Apply blur multiple times for stronger effect
    ctx.clearRect(0, 0, w, h);
    ctx.filter = `blur(${blurRadius}px)`;
    ctx.drawImage(tempCanvas, 0, 0);

    // Second pass for even stronger blur
    ctx.drawImage(this.canvas, 0, 0);

    // Reset filter
    ctx.filter = 'none';

    // Restore transform
    ctx.restore();
  }

  /**
   * Apply a green poison tint shader effect to a circular region.
   * Uses globalCompositeOperation 'source-atop' so the green overlay
   * only affects existing pixels (the entity shape), like a fragment shader.
   *
   * @param x        Center X (design-space)
   * @param y        Center Y (design-space)
   * @param radius   Radius of the effect region
   * @param intensity 0~1 poison intensity (affects green alpha)
   * @param timer    Animation timer for pulse effect
   */
  applyPoisonTint(x: number, y: number, radius: number, intensity: number, timer: number): void {
    const ctx = this.ctx;

    // Pulse factor: oscillates between 0.6 and 1.0
    const pulse = 0.6 + 0.4 * Math.sin(timer * 4);

    ctx.save();

    // Clip to entity region (circle)
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();

    // Use 'source-atop' compositing: green overlay only on existing pixels
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = intensity * pulse * 0.5;
    ctx.fillStyle = '#4caf50'; // Material green
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

    // Second pass: lighter green highlight for depth
    ctx.globalAlpha = intensity * pulse * 0.25;
    ctx.fillStyle = '#81c784'; // Light green
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.15, radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw a pulsing DOT glow aura beneath an entity.
   */
  drawPoisonGlow(
    x: number,
    y: number,
    baseSize: number,
    timer: number,
    colors = { outer: '#2e7d32', inner: '#66bb6a' },
  ): void {
    const pulse = 0.7 + 0.3 * Math.sin(timer * 3);
    const glowSize = baseSize * 1.8 * pulse;

    this.push({
      shape: 'circle',
      x, y,
      size: glowSize,
      color: colors.outer,
      alpha: 0.2 * pulse,
      z: 2, // Below entity (Ground=5)
    });

    // Inner glow
    this.push({
      shape: 'circle',
      x, y,
      size: glowSize * 0.6,
      color: colors.inner,
      alpha: 0.15 * pulse,
      z: 2,
    });
  }

  /**
   * Draw floating DOT particles around an entity.
   */
  drawPoisonBubbles(
    x: number,
    y: number,
    baseSize: number,
    timer: number,
    color = '#a5d6a7',
  ): void {
    const bubbleCount = 4;
    const spread = baseSize * 0.8;

    for (let i = 0; i < bubbleCount; i++) {
      // Each bubble has its own phase offset
      const phase = (i / bubbleCount) * Math.PI * 2;
      const cycle = (timer * 1.5 + phase) % (Math.PI * 2);
      const progress = cycle / (Math.PI * 2); // 0→1 over one cycle

      // Float upward
      const bubbleY = y + baseSize * 0.5 - progress * baseSize * 1.5;
      // Slight horizontal wobble
      const bubbleX = x + Math.sin(timer * 2 + phase) * spread * 0.5;

      // Fade in then out
      const alpha = Math.sin(progress * Math.PI) * 0.6;
      // Size varies
      const bubbleSize = 3 + Math.sin(phase) * 1.5;

      if (alpha > 0.05) {
        this.push({
          shape: 'circle',
          x: bubbleX,
          y: bubbleY,
          size: bubbleSize,
          color,
          alpha,
          z: 8, // Above entity
        });
      }
    }
  }

  get context(): CanvasRenderingContext2D {
    return this.ctx;
  }

  get view(): HTMLCanvasElement {
    return this.canvas;
  }

  get designWidth(): number {
    return Renderer.DESIGN_W;
  }

  get designHeight(): number {
    return Renderer.DESIGN_H;
  }
}
