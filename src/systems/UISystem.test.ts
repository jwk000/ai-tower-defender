import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { RenderCommand } from '../types/index.js';
import { GamePhase } from '../types/index.js';
import { TowerWorld } from '../core/World.js';
import { Position, Tower, Attack } from '../core/components.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import {
  computeHandZoneSlotRects,
  getHandZoneBounds,
  handZoneOverlapsBoard,
  HAND_ZONE_CARD_WIDTH,
  HAND_ZONE_CARD_HEIGHT,
  CARD_TOOLTIP_WIDTH,
  CARD_TOOLTIP_HEIGHT,
} from '../ui/LayoutConstants.js';
import { UISystem } from './UISystem.js';
import { RenderSystem } from './RenderSystem.js';
import { CardDraftSystem } from './CardDraftSystem.js';
import { HandSystem } from './HandSystem.js';
import { LEVEL_1_CARD_POOL } from '../data/cards.js';
import { setArtResourcesEnabled } from '../utils/artResourceSwitch.js';
import { cardConfigRegistry } from '../config/cardRegistry.js';

class LoadedImage {
  complete = true;
  naturalWidth = 256;
  naturalHeight = 256;
  width = 256;
  height = 256;
  src = '';
  onerror: (() => void) | null = null;
}

class RendererStub {
  commands: RenderCommand[] = [];
  redrawPredicates: Array<(cmd: RenderCommand) => boolean> = [];
  fillRects: Array<{ x: number; y: number; w: number; h: number; color: string }> = [];
  textDraws: Array<{ type: 'fill' | 'stroke'; text: string; x: number; y: number }> = [];
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
    fillRect: (x: number, y: number, w: number, h: number) => {
      this.fillRects.push({ x, y, w, h, color: this.context.fillStyle });
    },
    strokeRect: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: (text: string, x: number, y: number) => {
      this.textDraws.push({ type: 'fill', text, x, y });
    },
    strokeText: (text: string, x: number, y: number) => {
      this.textDraws.push({ type: 'stroke', text, x, y });
    },
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    drawImage: vi.fn(),
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

function makeUISystem(
  renderer: RendererStub,
  countdown: number,
  options: {
    isPaused?: boolean;
    phase?: GamePhase;
    pointer?: { x: number; y: number };
    dragState?: { active: boolean } & Record<string, unknown>;
    onGoldCheat?: () => void;
  } = {},
): UISystem {
  return new UISystem(
    renderer as any,
    () => options.phase ?? GamePhase.Battle,
    () => 100,
    () => 1,
    () => 3,
    () => false,
    () => null,
    () => {},
    () => {},
    null,
    null,
    () => (options.dragState as any) ?? null,
    options.pointer ? () => options.pointer! : null,
    null,
    null,
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
    () => countdown,
    () => 1,
    () => options.isPaused ?? false,
    null,
    null,
    null,
    null,
    null,
    () => ({ current: 85, max: 100 }),
    options.onGoldCheat ?? null,
  );
}

function buttonsOf(ui: UISystem): Array<{ x: number; y: number; w: number; h: number; label: string; color: string }> {
  return (ui as unknown as { buttons: Array<{ x: number; y: number; w: number; h: number; label: string; color: string }> }).buttons;
}

function infosOf(ui: UISystem): Array<{ x: number; y: number; text: string; align?: CanvasTextAlign }> {
  return (ui as unknown as { infos: Array<{ x: number; y: number; text: string; align?: CanvasTextAlign }> }).infos;
}

function imageDrawsOf(ui: UISystem): Array<{ path: string; layer: string; alpha?: number; z?: number }> {
  return (ui as unknown as { imageDraws: Array<{ path: string; layer: string; alpha?: number; z?: number }> }).imageDraws;
}

function cardIconDrawsOf(ui: UISystem): Array<{ cardId: string; layer: string; alpha?: number }> {
  return (ui as unknown as { cardIconDraws: Array<{ cardId: string; layer: string; alpha?: number }> }).cardIconDraws;
}

describe('UISystem 顶部 HUD 布局', () => {
  beforeEach(() => {
    LayoutManager.update(1920, 1080);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setArtResourcesEnabled(true);
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

  it('金手指按钮位于金币图标右侧，点击触发金币回调', () => {
    const onGoldCheat = vi.fn();
    const ui = makeUISystem(new RendererStub(), 0, { onGoldCheat });

    ui.update(new TowerWorld(), 1 / 60);

    const cheatButton = buttonsOf(ui).find((button) => button.label === '☝');
    const expectedRect = UISystem.goldCheatButtonRect();
    expect(cheatButton).toBeDefined();
    expect(cheatButton!.x).toBe(expectedRect.x);
    expect(cheatButton!.y).toBe(expectedRect.y);

    expect(ui.handleClick(cheatButton!.x + 1, cheatButton!.y + 1)).toBe(true);
    expect(onGoldCheat).toHaveBeenCalledTimes(1);
  });

  it('非战斗阶段不显示金手指按钮', () => {
    const ui = makeUISystem(new RendererStub(), 0, {
      phase: GamePhase.Deployment,
      onGoldCheat: vi.fn(),
    });

    ui.update(new TowerWorld(), 1 / 60);

    expect(buttonsOf(ui).some((button) => button.label === '☝')).toBe(false);
  });

  it('金手指飘字在按钮文本之后绘制，避免被按钮挡住', () => {
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0, { onGoldCheat: vi.fn() });

    ui.update(new TowerWorld(), 1 / 60);
    ui.showGoldCheatFeedback('+2💰');
    ui.renderUI();

    const buttonTextIndex = renderer.textDraws.findIndex((draw) => draw.type === 'fill' && draw.text === '☝');
    const feedbackTextIndex = renderer.textDraws.findIndex((draw) => draw.type === 'fill' && draw.text === '+2💰');
    expect(buttonTextIndex).toBeGreaterThanOrEqual(0);
    expect(feedbackTextIndex).toBeGreaterThan(buttonTextIndex);
  });

  it('倒计时状态下右侧按钮组整体保留相同右边距', () => {
    const ui = makeUISystem(new RendererStub(), 5);

    ui.update(new TowerWorld(), 1 / 60);

    const buttons = buttonsOf(ui).filter((button) => ['立即开始', '1x', '⏸'].includes(button.label));
    const rightMostEdge = Math.max(...buttons.map((button) => button.x + button.w));
    expect(rightMostEdge).toBe(
      LayoutManager.toDesignX(LayoutManager.viewportW) - UISystem.TOP_HUD_SIDE_MARGIN,
    );
  });

  it('倒计时文字位于波次开始按钮左侧并保持间距', () => {
    const ui = makeUISystem(new RendererStub(), 5);

    ui.update(new TowerWorld(), 1 / 60);

    const startWaveButton = buttonsOf(ui).find((button) => button.label === '立即开始');
    const countdownInfo = infosOf(ui).find((info) => info.text.startsWith('⏱'));
    expect(startWaveButton).toBeDefined();
    expect(countdownInfo).toBeDefined();
    expect(countdownInfo!.align).toBe('right');
    expect(countdownInfo!.x).toBe(startWaveButton!.x - 12);
  });

  it('卡牌图鉴位于敌人图鉴左侧，并推动暂停与倍速按钮左移', () => {
    const ui = makeUISystem(new RendererStub(), 0);
    ui.setEncyclopediaCallback(() => {});
    ui.setEnemyCodexCallback(() => {});

    ui.update(new TowerWorld(), 1 / 60);

    const buttons = buttonsOf(ui);
    const enemyCodexButton = buttons.find((button) => button.label === '📖');
    const cardCodexButton = buttons.find((button) => button.label === '🃏');
    const pauseButton = buttons.find((button) => button.label === '⏸');
    const speedButton = buttons.find((button) => button.label === '1x');
    expect(enemyCodexButton).toBeDefined();
    expect(cardCodexButton).toBeDefined();
    expect(pauseButton).toBeDefined();
    expect(speedButton).toBeDefined();
    expect(enemyCodexButton!.x + enemyCodexButton!.w).toBe(
      LayoutManager.toDesignX(LayoutManager.viewportW) - UISystem.TOP_HUD_SIDE_MARGIN,
    );
    expect(cardCodexButton!.x + cardCodexButton!.w + 12).toBe(enemyCodexButton!.x);
    expect(pauseButton!.x + pauseButton!.w + 12).toBe(cardCodexButton!.x);
    expect(speedButton!.x + speedButton!.w + 12).toBe(pauseButton!.x);
  });

  it('暂停弹窗不再显示卡牌图鉴入口', () => {
    const ui = makeUISystem(new RendererStub(), 0, { isPaused: true });
    ui.setEncyclopediaCallback(() => {});

    ui.update(new TowerWorld(), 1 / 60);

    expect(buttonsOf(ui).some((button) => button.label === '📖 卡牌图鉴')).toBe(false);
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
    expect(upgradeButton!.color).toBe('#4caf50');

    const recycleButton = buttonsOf(ui).find((button) => button.label.startsWith('回收'));
    expect(recycleButton).toBeDefined();
    expect(recycleButton!.color).toBe('#e53935');

    ui.renderUI();
    expect(renderer.fillRects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: upgradeButton!.x, y: upgradeButton!.y, w: upgradeButton!.w, h: upgradeButton!.h, color: '#4caf50' }),
        expect.objectContaining({ x: recycleButton!.x, y: recycleButton!.y, w: recycleButton!.w, h: recycleButton!.h, color: '#e53935' }),
      ]),
    );

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

  it('空槽背景始终按 5 槽绘制，与已有卡牌坐标对齐', () => {
    const slots = computeHandZoneSlotRects();

    expect(slots).toHaveLength(5);
    expect(slots.map((slot) => slot.left)).toEqual([628, 764, 900, 1036, 1172]);
    expect(slots.every((slot) => slot.top === 866)).toBe(true);
    expect(slots.every((slot) => slot.width === 120 && slot.height === 168)).toBe(true);
  });

  it('鼠标悬停手牌时卡牌上移放大，描述直接显示在卡面且不再绘制 tooltip', () => {
    const slot = computeHandZoneSlotRects(1)[0]!;
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0, {
      pointer: { x: slot.centerX, y: slot.centerY },
    });
    const world = new TowerWorld();
    world.attachRunContext({
      registry: {
        get: () => ({
          id: 'card_arrow_tower',
          name: '箭塔',
          type: 'unit',
          energyCost: 0,
          goldCost: 35,
          rarity: 'common',
          placement: { targetType: 'tile' },
          description: '基础单体物理输出',
        }),
      },
      hand: { state: { hand: [{ cardId: 'card_arrow_tower' }] } },
    });

    ui.update(world, 1);

    const cardRect = renderer.commands.find((cmd) => (
      cmd.shape === 'rect' &&
      cmd.stroke === '#ffffff' &&
      cmd.size > HAND_ZONE_CARD_WIDTH &&
      (cmd.h ?? 0) > HAND_ZONE_CARD_HEIGHT
    ));
    expect(cardRect).toBeDefined();
    expect(cardRect!.y).toBeLessThan(slot.centerY);
    expect(infosOf(ui).some((info) => info.text === '基础单体物理输出')).toBe(true);
    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'rect' &&
      cmd.size === CARD_TOOLTIP_WIDTH &&
      cmd.h === CARD_TOOLTIP_HEIGHT
    ))).toBe(false);
  });

  it('所有卡牌统一绘制普通美术卡框', () => {
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0);
    const world = new TowerWorld();
    world.attachRunContext({
      registry: {
        get: () => ({
          id: 'card_ice_tower',
          name: '冰塔',
          type: 'unit',
          energyCost: 0,
          goldCost: 70,
          rarity: 'rare',
          placement: { targetType: 'tile' },
          description: '控制塔，攻击附带减速效果',
        }),
      },
      hand: { state: { hand: [{ cardId: 'card_ice_tower' }] } },
    });

    ui.update(world, 1 / 60);

    expect(imageDrawsOf(ui).some((draw) => (
      draw.layer === 'normal' &&
      draw.path === '/art/ui/ui_card_frame_common.png'
    ))).toBe(true);
    expect(imageDrawsOf(ui).some((draw) => (
      draw.layer === 'normal' &&
      draw.path === '/art/ui/ui_card_frame_rare.png'
    ))).toBe(false);

    const frameDraw = imageDrawsOf(ui).find((draw) => draw.path === '/art/ui/ui_card_frame_common.png');
    const contentRect = renderer.commands.find((cmd) => (
      cmd.shape === 'rect' &&
      cmd.color === '#0d1b2a' &&
      cmd.size === 96 &&
      cmd.h === 80
    ));
    expect(frameDraw?.alpha).toBe(1);
    expect(frameDraw?.z).toBeGreaterThan(contentRect?.z ?? 0);
  });

  it('单位卡拖动 ghost 在美术资源可用时使用场景单位图片而不是卡牌外观', () => {
    vi.stubGlobal('Image', LoadedImage);
    vi.stubGlobal('fetch', undefined);
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0, {
      pointer: { x: 960, y: 540 },
      dragState: {
        active: true,
        entityType: 'tower',
        towerType: 'arrow',
        cardIndex: 0,
      },
    });
    const world = new TowerWorld();
    world.attachRunContext({
      registry: {
        get: () => ({
          id: 'card_arrow_tower',
          name: '箭塔',
          type: 'unit',
          energyCost: 0,
          goldCost: 35,
          rarity: 'common',
          placement: { targetType: 'tile' },
          description: '基础单体物理输出',
        }),
      },
      hand: { state: { hand: [{ cardId: 'card_arrow_tower' }] } },
    });

    ui.update(world, 1 / 60);
    renderer.commands = [];
    ui.update(world, 1 / 60);

    expect(imageDrawsOf(ui).some((draw) => (
      draw.layer === 'board' &&
      draw.path === '/art/ui/ui_card_frame_common.png' &&
      draw.alpha === 0.68
    ))).toBe(false);
    expect(cardIconDrawsOf(ui).some((draw) => (
      draw.layer === 'board' &&
      draw.cardId === 'card_arrow_tower' &&
      draw.alpha === 0.68
    ))).toBe(false);
    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'rect' &&
      cmd.x === 960 &&
      cmd.y === 540 - (32 * 1.35) * 0.08 &&
      cmd.size === 32 * 1.35 &&
      cmd.h === 32 * 1.35 &&
      cmd.image instanceof LoadedImage &&
      cmd.alpha === 0.5
    ))).toBe(true);
    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'circle' &&
      cmd.x === 960 &&
      cmd.y === 540 &&
      cmd.size === 32 &&
      cmd.color === '#4fc3f7' &&
      cmd.alpha === 0.5
    ))).toBe(false);
  });

  it('单位卡拖动 ghost 缺少场景单位图片时不回退程序绘制外观', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', undefined);
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0, {
      pointer: { x: 960, y: 540 },
      dragState: {
        active: true,
        entityType: 'tower',
        towerType: 'arrow',
        cardIndex: 0,
      },
    });
    const world = new TowerWorld();
    world.attachRunContext({
      registry: {
        get: () => ({
          id: 'card_arrow_tower',
          name: '箭塔',
          type: 'unit',
          energyCost: 0,
          goldCost: 35,
          rarity: 'common',
          placement: { targetType: 'tile' },
          description: '基础单体物理输出',
        }),
      },
      hand: { state: { hand: [{ cardId: 'card_arrow_tower' }] } },
    });

    ui.update(world, 1 / 60);

    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'rect' &&
      cmd.image instanceof LoadedImage
    ))).toBe(false);
    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'circle' &&
      cmd.x === 960 &&
      cmd.y === 540 &&
      cmd.size === 32 &&
      cmd.color === '#4fc3f7'
    ))).toBe(false);
  });

  it('法术卡拖动 ghost 同时显示释放点和释放半径', () => {
    cardConfigRegistry.register({
      id: 'fireball_card',
      name: '火球术',
      type: 'spell',
      energyCost: 3,
      goldCost: 40,
      rarity: 'common',
      spellSubtype: 'damage',
      placement: { targetType: 'area', range: 'cursor' },
      spellEffect: { handler: 'aoe_damage', damage: 80, radius: 80 },
    });
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0, {
      pointer: { x: 960, y: 540 },
      dragState: {
        active: true,
        entityType: 'spell',
        spellCardId: 'fireball',
        cardIndex: 0,
      },
    });

    ui.update(new TowerWorld(), 1 / 60);

    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'circle' &&
      cmd.x === 960 &&
      cmd.y === 540 &&
      cmd.size === 160 &&
      cmd.color === '#ff5722'
    ))).toBe(true);
    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'circle' &&
      cmd.x === 960 &&
      cmd.y === 540 &&
      cmd.size === 28 &&
      cmd.color === '#ff5722' &&
      cmd.label === '火球术'
    ))).toBe(true);
  });

  it('真实手牌法术 ID 没有预加载卡牌注册表时也显示 ghost 和范围', () => {
    cardConfigRegistry.clear();
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0, {
      pointer: { x: 960, y: 540 },
      dragState: {
        active: true,
        entityType: 'spell',
        spellCardId: 'card_fireball',
        cardIndex: 0,
      },
    });

    ui.update(new TowerWorld(), 1 / 60);

    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'circle' &&
      cmd.x === 960 &&
      cmd.y === 540 &&
      cmd.size === 160 &&
      cmd.color === '#ff5722' &&
      cmd.alpha === 0.35
    ))).toBe(true);
    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'circle' &&
      cmd.x === 960 &&
      cmd.y === 540 &&
      cmd.size === 28 &&
      cmd.color === '#ff5722' &&
      cmd.label === '火球术'
    ))).toBe(true);
  });

  it('暴风雪拖动 ghost 预览全棋盘攻击范围', () => {
    cardConfigRegistry.register({
      id: 'blizzard_card',
      name: '暴风雪',
      type: 'spell',
      energyCost: 4,
      goldCost: 90,
      rarity: 'rare',
      spellSubtype: 'control',
      placement: { targetType: 'global' },
      spellEffect: { handler: 'aoe_damage_slow', damage: 45, radius: 9999, slowDuration: 5.0 },
    });
    RenderSystem.sceneOffsetX = 120;
    RenderSystem.sceneOffsetY = 80;
    RenderSystem.sceneW = 640;
    RenderSystem.sceneH = 384;
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0, {
      pointer: { x: 960, y: 540 },
      dragState: {
        active: true,
        entityType: 'spell',
        spellCardId: 'blizzard',
        cardIndex: 0,
      },
    });

    ui.update(new TowerWorld(), 1 / 60);

    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'rect' &&
      cmd.x === 440 &&
      cmd.y === 272 &&
      cmd.size === 640 &&
      cmd.h === 384 &&
      cmd.color === '#7c4dff' &&
      cmd.stroke === '#7c4dff'
    ))).toBe(true);
    expect(renderer.commands.some((cmd) => cmd.shape === 'circle' && cmd.size === 19998)).toBe(false);
    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'circle' &&
      cmd.x === 960 &&
      cmd.y === 540 &&
      cmd.size === 28 &&
      cmd.color === '#7c4dff' &&
      cmd.label === '暴风雪'
    ))).toBe(true);
  });
});
