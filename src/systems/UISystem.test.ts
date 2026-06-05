import { describe, expect, it, beforeEach } from 'vitest';
import type { RenderCommand } from '../types/index.js';
import { GamePhase } from '../types/index.js';
import { TowerWorld } from '../core/World.js';
import { Position, Tower, Attack } from '../core/components.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { computeHandZoneSlotRects, getHandZoneBounds, handZoneOverlapsBoard } from '../ui/LayoutConstants.js';
import { UISystem } from './UISystem.js';
import { RenderSystem } from './RenderSystem.js';
import { CardDraftSystem } from './CardDraftSystem.js';
import { HandSystem } from './HandSystem.js';
import { LEVEL_1_CARD_POOL } from '../data/cards.js';

class RendererStub {
  commands: RenderCommand[] = [];
  redrawPredicates: Array<(cmd: RenderCommand) => boolean> = [];
  context = {
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    beginPath: () => {},
    closePath: () => {},
    arc: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
  };

  push(cmd: RenderCommand): void {
    this.commands.push(cmd);
  }

  redrawCommands(predicate: (cmd: RenderCommand) => boolean): void {
    this.redrawPredicates.push(predicate);
  }

  applyBlur(): void {}
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
    null,
    null,
    null,
    null,
    null,
    () => ({ current: 85, max: 100 }),
  );
}

function buttonsOf(ui: UISystem): Array<{ x: number; y: number; w: number; h: number; label: string }> {
  return (ui as unknown as { buttons: Array<{ x: number; y: number; w: number; h: number; label: string }> }).buttons;
}

function infosOf(ui: UISystem): Array<{ x: number; y: number; text: string; align?: CanvasTextAlign }> {
  return (ui as unknown as { infos: Array<{ x: number; y: number; text: string; align?: CanvasTextAlign }> }).infos;
}

describe('UISystem 顶部 HUD 布局', () => {
  beforeEach(() => {
    LayoutManager.update(1920, 1080);
  });

  it('右侧暂停按钮距离屏幕右边缘 200px，与左侧 HUD 内边距对称', () => {
    const ui = makeUISystem(new RendererStub(), 0);

    ui.update(new TowerWorld(), 1 / 60);

    const pauseButton = buttonsOf(ui).find((button) => button.label === '⏸');
    expect(pauseButton).toBeDefined();
    expect(pauseButton!.x + pauseButton!.w).toBe(
      LayoutManager.toDesignX(LayoutManager.viewportW) - UISystem.TOP_HUD_SIDE_MARGIN,
    );
  });

  it('左侧起始位显示水晶 HP，金币向右偏移显示', () => {
    const ui = makeUISystem(new RendererStub(), 0);

    ui.update(new TowerWorld(), 1 / 60);

    const infos = infosOf(ui);
    const crystalHp = infos.find((info) => info.text === '💎85/100');
    const gold = infos.find((info) => info.text === '💰100');
    expect(crystalHp).toBeDefined();
    expect(gold).toBeDefined();
    expect(crystalHp!.x).toBe(UISystem.TOP_HUD_SIDE_MARGIN);
    expect(gold!.x).toBe(UISystem.TOP_HUD_SIDE_MARGIN + 150);
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

  it('倒计时文字位于波次开始按钮左侧并保持间距', () => {
    const ui = makeUISystem(new RendererStub(), 5);

    ui.update(new TowerWorld(), 1 / 60);

    const startWaveButton = buttonsOf(ui).find((button) => button.label === '▶');
    const countdownInfo = infosOf(ui).find((info) => info.text.startsWith('⏱'));
    expect(startWaveButton).toBeDefined();
    expect(countdownInfo).toBeDefined();
    expect(countdownInfo!.align).toBe('right');
    expect(countdownInfo!.x).toBe(startWaveButton!.x - 12);
  });
});

describe('UISystem UI 层级', () => {
  beforeEach(() => {
    LayoutManager.update(1920, 1080);
  });

  it('塔升级面板归属棋盘 tips 层，不会提升到全屏 UI 层', () => {
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0);
    const world = new TowerWorld();
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 960, y: 540 });
    world.addComponent(towerId, Tower, { towerType: 0, level: 1 });
    world.addComponent(towerId, Attack, { damage: 10, range: 160, attackSpeed: 1 });

    ui.selectedTowerEntityId = towerId;
    ui.update(world, 1 / 60);

    const upgradeButton = buttonsOf(ui).find((button) => button.label.startsWith('升级'));
    expect(upgradeButton).toBeDefined();
    expect((upgradeButton as { layer?: string }).layer).toBe('board');

    const titleInfo = infosOf(ui).find((info) => info.text.includes('Lv.1'));
    expect(titleInfo).toBeDefined();
    expect((titleInfo as { layer?: string }).layer).toBe('board');
  });

  it('抽卡面板作为全屏 UI 重绘在普通 UI 与塔升级面板之上', () => {
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0);
    const world = new TowerWorld();
    world.attachRunContext({
      registry: {
        get: (id: string) => ({
          name: id,
          type: 'unit',
          rarity: 'common',
          energyCost: 0,
          description: id,
        }),
      },
      hand: { state: { hand: [] } },
    });

    const draft = new CardDraftSystem();
    const hand = new HandSystem();
    hand.initialize(LEVEL_1_CARD_POOL);
    draft.startDraft(LEVEL_1_CARD_POOL, hand);
    ui.setCardDraftSystem(draft);

    ui.update(world, 1 / 60);
    ui.renderUI();

    expect(renderer.redrawPredicates.length).toBeGreaterThanOrEqual(2);
    const fullScreenPredicate = renderer.redrawPredicates[1]!;
    expect(fullScreenPredicate({ shape: 'rect', x: 0, y: 0, size: 1, color: '#fff', z: 1000 })).toBe(true);
    expect(fullScreenPredicate({ shape: 'rect', x: 0, y: 0, size: 1, color: '#fff', z: 100 })).toBe(false);

    const draftTitle = infosOf(ui).find((info) => info.text.includes('抽卡奖励'));
    expect(draftTitle).toBeDefined();
    expect((draftTitle as { layer?: string }).layer).toBe('fullscreen');
  });
});

describe('UISystem 手牌区底板与空槽布局', () => {
  beforeEach(() => {
    LayoutManager.update(1920, 1080);
  });

  it('手牌区固定在棋盘下方，不与当前棋盘矩形重叠', () => {
    RenderSystem.sceneOffsetX = 288;
    RenderSystem.sceneOffsetY = 234;
    RenderSystem.sceneW = 1344;
    RenderSystem.sceneH = 576;

    expect(getHandZoneBounds()).toMatchObject({
      left: 560,
      top: 860,
      width: 800,
      height: 180,
    });
    expect(handZoneOverlapsBoard({
      left: RenderSystem.sceneOffsetX,
      top: RenderSystem.sceneOffsetY,
      width: RenderSystem.sceneW,
      height: RenderSystem.sceneH,
    })).toBe(false);
  });

  it('空槽背景始终按 4 槽绘制，与已有卡牌坐标对齐', () => {
    const slots = computeHandZoneSlotRects();

    expect(slots).toHaveLength(4);
    expect(slots.map((slot) => slot.left)).toEqual([696, 832, 968, 1104]);
    expect(slots.every((slot) => slot.top === 866)).toBe(true);
    expect(slots.every((slot) => slot.width === 120 && slot.height === 168)).toBe(true);
  });
});
