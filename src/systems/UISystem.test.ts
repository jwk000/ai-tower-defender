import { describe, expect, it, beforeEach } from 'vitest';
import type { RenderCommand } from '../types/index.js';
import { GamePhase } from '../types/index.js';
import { TowerWorld } from '../core/World.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { UISystem } from './UISystem.js';

class RendererStub {
  commands: RenderCommand[] = [];

  push(cmd: RenderCommand): void {
    this.commands.push(cmd);
  }
}

function makeUISystem(renderer: RendererStub, countdown: number): UISystem {
  return new UISystem(
    renderer as any,
    () => GamePhase.Battle,
    () => 100,
    () => 1,
    () => 3,
    () => false,
    () => null,
    () => {},
    () => {},
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
    () => countdown,
    () => 1,
    () => false,
  );
}

function buttonsOf(ui: UISystem): Array<{ x: number; y: number; w: number; h: number; label: string }> {
  return (ui as unknown as { buttons: Array<{ x: number; y: number; w: number; h: number; label: string }> }).buttons;
}

describe('UISystem 顶部 HUD 布局', () => {
  beforeEach(() => {
    LayoutManager.update(1920, 1080);
  });

  it('右侧暂停按钮距离屏幕右边缘 20px，与左侧 HUD 内边距对称', () => {
    const ui = makeUISystem(new RendererStub(), 0);

    ui.update(new TowerWorld(), 1 / 60);

    const pauseButton = buttonsOf(ui).find((button) => button.label === '⏸');
    expect(pauseButton).toBeDefined();
    expect(pauseButton!.x + pauseButton!.w).toBe(
      LayoutManager.toDesignX(LayoutManager.viewportW) - UISystem.TOP_HUD_SIDE_MARGIN,
    );
  });

  it('倒计时状态下右侧按钮组整体保留相同右边距', () => {
    const ui = makeUISystem(new RendererStub(), 5);

    ui.update(new TowerWorld(), 1 / 60);

    const buttons = buttonsOf(ui).filter((button) => ['▶', '1x', '⏸'].includes(button.label));
    const rightMostEdge = Math.max(...buttons.map((button) => button.x + button.w));
    expect(rightMostEdge).toBe(
      LayoutManager.toDesignX(LayoutManager.viewportW) - UISystem.TOP_HUD_SIDE_MARGIN,
    );
  });
});
