import { Renderer } from '../render/Renderer.js';
import { LayoutManager } from './LayoutManager.js';
import { FONTS, getFont } from '../config/fonts.js';
import { SaveManager } from '../utils/SaveManager.js';
import { LEVELS } from '../data/levels/index.js';
import { Sound } from '../utils/Sound.js';

/** Level select button layout */
interface LevelButton {
  x: number;
  y: number;
  w: number;
  h: number;
  levelId: number;
  name: string;
  theme: string;
  waves: number;
  locked: boolean;
  stars: number;
}

/** LevelSelectUI — renders level selection menu and handles clicks */
export class LevelSelectUI {
  private buttons: LevelButton[] = [];

  constructor(
    private renderer: Renderer,
    private onStartLevel: (levelId: number) => void,
  ) {
    this.buildButtons();
  }

  /** Rebuild button layout (call after save data changes) */
  refresh(): void {
    this.buildButtons();
  }

  /** Build level buttons with unlock/star status */
  private buildButtons(): void {
    const save = SaveManager.load();
    const unlockedLevels = save.unlockedLevels;
    const levelStars = save.levelStars;

    this.buttons = [];

    const BTN_W = 280;
    const BTN_H = 120;
    const BTN_GAP = 20;
    const TOTAL_W = LEVELS.length * BTN_W + (LEVELS.length - 1) * BTN_GAP;
    const START_X = (LayoutManager.DESIGN_W - TOTAL_W) / 2;
    const START_Y = LayoutManager.DESIGN_H / 2 - BTN_H / 2;

    for (let i = 0; i < LEVELS.length; i++) {
      const level = LEVELS[i]!;
      const levelId = i + 1;
      const isLocked = levelId > unlockedLevels;

      this.buttons.push({
        x: START_X + i * (BTN_W + BTN_GAP),
        y: START_Y,
        w: BTN_W,
        h: BTN_H,
        levelId,
        name: level.name,
        theme: level.theme,
        waves: level.waves.length,
        locked: isLocked,
        stars: levelStars[levelId] ?? 0,
      });
    }
  }

  /** Render the level select UI */
  update(_dt: number): void {
    const ctx = this.renderer.context;

    // Title
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = FONTS.title;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tower Defender', LayoutManager.DESIGN_W / 2, 150);
    ctx.restore();

    // Subtitle
    ctx.save();
    ctx.fillStyle = '#aaaacc';
    ctx.font = FONTS.subtitle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Select Level', LayoutManager.DESIGN_W / 2, 220);
    ctx.restore();

    // Level buttons
    for (const btn of this.buttons) {
      this.drawLevelButton(btn);
    }
  }

  /** Draw a single level button */
  private drawLevelButton(btn: LevelButton): void {
    const ctx = this.renderer.context;

    // Button background
    ctx.save();
    ctx.fillStyle = btn.locked ? '#2a2a3e' : '#3a3a5e';
    ctx.strokeStyle = btn.locked ? '#444466' : '#6666aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Level name
    ctx.save();
    ctx.fillStyle = btn.locked ? '#666688' : '#ffffff';
    ctx.font = getFont(20, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.name, btn.x + btn.w / 2, btn.y + 35);
    ctx.restore();

    // Theme + waves info
    ctx.save();
    ctx.fillStyle = btn.locked ? '#555577' : '#aaaacc';
    ctx.font = FONTS.body;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${btn.theme} · ${btn.waves} waves`, btn.x + btn.w / 2, btn.y + 65);
    ctx.restore();

    // Stars or lock icon
    if (btn.locked) {
      ctx.save();
      ctx.fillStyle = '#ff6666';
      ctx.font = getFont(24, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', btn.x + btn.w / 2, btn.y + 95);
      ctx.restore();
    } else if (btn.stars > 0) {
      ctx.save();
      ctx.fillStyle = '#ffcc00';
      ctx.font = getFont(20, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const starsText = '⭐'.repeat(btn.stars);
      ctx.fillText(starsText, btn.x + btn.w / 2, btn.y + 95);
      ctx.restore();
    }
  }

  /** Handle click at (x, y) in design space */
  handleClick(x: number, y: number): void {
    for (const btn of this.buttons) {
      if (btn.locked) continue;
      if (
        x >= btn.x &&
        x <= btn.x + btn.w &&
        y >= btn.y &&
        y <= btn.y + btn.h
      ) {
        Sound.play('ui_click');
        this.onStartLevel(btn.levelId);
        return;
      }
    }
  }
}
