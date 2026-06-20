import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { RenderCommand } from '../types/index.js';
import { GamePhase } from '../types/index.js';
import { TowerWorld } from '../core/World.js';
import { Health, Position, Tower, Attack, UnitTag, Trap, TrapTypeVal } from '../core/components.js';
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
import { UISystem, UI_HAND_PANEL_SLICE } from './UISystem.js';
import { RenderSystem } from './RenderSystem.js';
import { CardDraftSystem } from './CardDraftSystem.js';
import { HandSystem } from './HandSystem.js';
import { LEVEL_1_CARD_POOL } from '../data/cards.js';
import { setArtResourcesEnabled } from '../utils/artResourceSwitch.js';
import { cardConfigRegistry } from '../config/cardRegistry.js';
import { clearArtAtlasRegistryForTests, registerArtAtlasManifest } from '../utils/imageCache.js';

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
  events: string[] = [];
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
    drawImage: vi.fn((source?: unknown) => {
      if (source && typeof source === 'object' && '__cardFrameMask' in source) {
        this.events.push('drawCardFrameMask');
        return;
      }
      this.events.push('drawImage');
    }),
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
    this.events.push('redrawCommands');
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

function infosOf(ui: UISystem): Array<{ x: number; y: number; text: string; color?: string; align?: CanvasTextAlign }> {
  return (ui as unknown as { infos: Array<{ x: number; y: number; text: string; color?: string; align?: CanvasTextAlign }> }).infos;
}

function imageDrawsOf(ui: UISystem): Array<{ path: string; layer: string; alpha?: number; z?: number; phase?: string; mode?: string; slice?: unknown }> {
  return (ui as unknown as { imageDraws: Array<{ path: string; layer: string; alpha?: number; z?: number; phase?: string; mode?: string; slice?: unknown }> }).imageDraws;
}

function cardIconDrawsOf(ui: UISystem): Array<{ cardId: string; layer: string; alpha?: number }> {
  return (ui as unknown as { cardIconDraws: Array<{ cardId: string; layer: string; alpha?: number }> }).cardIconDraws;
}

function towerPanelBgOf(ui: UISystem): { w: number; h: number } | null {
  return (ui as unknown as { towerPanelBg: { w: number; h: number } | null }).towerPanelBg;
}

describe('UISystem 顶部 HUD 布局', () => {
  beforeEach(() => {
    LayoutManager.update(1920, 1080);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearArtAtlasRegistryForTests();
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

    const titleInfo = infosOf(ui).find((info) => info.text.includes('等级1'));
    expect(titleInfo).toBeDefined();
    expect((titleInfo as { layer?: string }).layer).toBe('board');
  });

  it('塔 tips 显示当前等级和下一级攻防血', () => {
    const ui = makeUISystem(new RendererStub(), 0);
    const world = new TowerWorld();
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 960, y: 540 });
    world.addComponent(towerId, Health, { current: 900, max: 900, armor: 0, magicResist: 0 });
    world.addComponent(towerId, Tower, { towerType: 0, level: 1 });
    world.addComponent(towerId, Attack, { damage: 10, range: 200, attackSpeed: 1 });

    ui.selectedTowerEntityId = towerId;
    ui.update(world, 1 / 60);

    expect(towerPanelBgOf(ui)).toMatchObject({ w: 300, h: 260 });

    const texts = infosOf(ui).map((info) => info.text);
    expect(texts).toContain('当前等级:');
    expect(texts).toContain('攻/防/血: 10/0/900');
    expect(texts).toContain('下一级:');
    expect(texts).toContain('攻/防/血: 15/0/900');
  });

  it('满级塔 tips 显示已满级，不再显示下一级数值', () => {
    const ui = makeUISystem(new RendererStub(), 0);
    const world = new TowerWorld();
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 960, y: 540 });
    world.addComponent(towerId, Health, { current: 900, max: 900, armor: 0, magicResist: 0 });
    world.addComponent(towerId, Tower, { towerType: 0, level: 3 });
    world.addComponent(towerId, Attack, { damage: 33, range: 260, attackSpeed: 1 });

    ui.selectedTowerEntityId = towerId;
    ui.update(world, 1 / 60);

    const texts = infosOf(ui).map((info) => info.text);
    expect(texts).toContain('下一级: 已满级');
    expect(texts).not.toContain('攻/防/血: 38/0/900');
  });

  it('电塔 tips 只在当前或下一级达到战略技能等级时显示技能描述', () => {
    const ui = makeUISystem(new RendererStub(), 0);
    const world = new TowerWorld();
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 960, y: 540 });
    world.addComponent(towerId, Health, { current: 900, max: 900, armor: 0, magicResist: 0 });
    world.addComponent(towerId, Tower, { towerType: 3, level: 4 });
    world.addComponent(towerId, Attack, { damage: 47.5, range: 230, attackSpeed: 0.9 });

    ui.selectedTowerEntityId = towerId;
    ui.update(world, 1 / 60);

    const texts = infosOf(ui).map((info) => info.text);
    expect(texts).toContain('攻/防/血: 68/0/900');
    expect(texts.some((text) => text.includes('技能 天罚落雷'))).toBe(true);
  });

  it('兵类单位 tips 显示当前和下一级攻防血与技能描述，不提供升级和回收按钮', () => {
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0);
    const world = new TowerWorld();
    const unitId = world.createEntity();
    world.addComponent(unitId, Position, { x: 960, y: 540 });
    world.addComponent(unitId, Health, { current: 520, max: 520, armor: 70, magicResist: 0 });
    world.addComponent(unitId, Attack, { damage: 4, range: 50, attackSpeed: 0.55 });
    world.addComponent(unitId, UnitTag, {
      unitTypeNum: 0,
      isEnemy: 0,
      level: 2,
      maxLevel: 3,
      popCost: 2,
      cost: 35,
      totalInvested: 75,
    });

    ui.selectedUnitEntityId = unitId;
    ui.update(world, 1 / 60);

    expect(towerPanelBgOf(ui)).toMatchObject({ w: 300, h: 230 });
    const texts = infosOf(ui).map((info) => info.text);
    expect(texts).toContain('盾卫 等级2');
    expect(texts).toContain('当前等级:');
    expect(texts).toContain('攻/防/血: 4/70/520');
    expect(texts.some((text) => text.includes('技能 嘲讽'))).toBe(true);
    expect(texts).toContain('下一级:');
    expect(texts).toContain('攻/防/血: 7/70/700');

    const labels = buttonsOf(ui).map((button) => button.label);
    expect(labels.some((label) => label.startsWith('升级') || label === '满级')).toBe(false);
    expect(labels.some((label) => label.startsWith('回收'))).toBe(false);
  });

  it('机关选中后不显示 tips 面板、范围圈和升级入口', () => {
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0);
    const world = new TowerWorld();
    const trapId = world.createEntity();
    world.addComponent(trapId, Position, { x: 960, y: 540 });
    world.addComponent(trapId, Trap, {
      trapType: TrapTypeVal.SpikeTrap,
      damagePerSecond: 3,
      radius: 32,
      cooldown: 0.2,
      cooldownTimer: 0,
      animTimer: 0,
      animDuration: 0.4,
      triggerCount: 0,
      maxTriggers: 0,
      direction: 0,
      stunDuration: 0,
      damage: 0,
      slowPercent: 0,
    });

    ui.selectedTrapEntityId = trapId;
    ui.update(world, 1 / 60);

    expect(towerPanelBgOf(ui)).toBeNull();
    expect(infosOf(ui).map((info) => info.text)).not.toContain('盾卫 等级1');
    expect(buttonsOf(ui).some((button) => button.label.startsWith('升级'))).toBe(false);
    expect(renderer.commands.some((cmd) => cmd.shape === 'circle' && cmd.z === 20)).toBe(false);
  });

  it('机关即使残留士兵标签也不会显示盾卫 tips 或升级入口', () => {
    const ui = makeUISystem(new RendererStub(), 0);
    const world = new TowerWorld();
    const trapId = world.createEntity();
    world.addComponent(trapId, Position, { x: 960, y: 540 });
    world.addComponent(trapId, UnitTag, {
      unitTypeNum: 0,
      isEnemy: 0,
      level: 1,
      maxLevel: 3,
      popCost: 0,
      cost: 40,
      totalInvested: 40,
    });

    ui.selectedTrapEntityId = trapId;
    ui.update(world, 1 / 60);

    expect(towerPanelBgOf(ui)).toBeNull();
    expect(infosOf(ui).map((info) => info.text)).not.toContain('盾卫 等级1');
    expect(buttonsOf(ui).some((button) => button.label.startsWith('升级'))).toBe(false);
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

  afterEach(() => {
    vi.unstubAllGlobals();
    clearArtAtlasRegistryForTests();
  });

  it('手牌区固定在棋盘下方，不与当前棋盘矩形重叠', () => {
    RenderSystem.sceneOffsetX = 288;
    RenderSystem.sceneOffsetY = 234;
    RenderSystem.sceneW = 1344;
    RenderSystem.sceneH = 576;

    expect(getHandZoneBounds()).toMatchObject({
      left: 560,
      top: 840,
      width: 800,
      height: 220,
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

  it('手牌底板九宫格保留窄边角，整体接近矩形', () => {
    vi.stubGlobal('Image', LoadedImage);
    registerArtAtlasManifest({
      id: 'ui_test',
      image: '/art/ui/ui_hand_panel.png',
      frames: {
        '/art/ui/ui_hand_panel.png': { x: 0, y: 0, w: 1024, h: 320 },
      },
    });
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0);

    ui.update(new TowerWorld(), 1 / 60);

    const handPanel = imageDrawsOf(ui).find((draw) => draw.path === '/art/ui/ui_hand_panel.png');
    expect(handPanel).toMatchObject({
      mode: 'nine-slice',
      slice: UI_HAND_PANEL_SLICE,
      alpha: 1,
    });
    expect(UI_HAND_PANEL_SLICE.left).toBeLessThan(50);
    expect(UI_HAND_PANEL_SLICE.right).toBeLessThan(50);
    expect(renderer.commands.some((cmd) => (
      cmd.shape === 'rect' &&
      cmd.size === getHandZoneBounds().width &&
      cmd.h === getHandZoneBounds().height &&
      cmd.alpha !== undefined &&
      cmd.alpha < 1
    ))).toBe(false);

    ui.renderUI();
    ui.renderUI();
    renderer.events = [];
    ui.renderUI();
    const firstImageDraw = renderer.events.indexOf('drawImage');
    const firstRedraw = renderer.events.indexOf('redrawCommands');
    expect(firstImageDraw).toBeGreaterThanOrEqual(0);
    expect(firstRedraw).toBeGreaterThanOrEqual(0);
    expect(firstImageDraw).toBeLessThan(firstRedraw);
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
      cmd.stroke === '#42a5f5' &&
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

  it('手牌卡牌图绘制在卡牌框下方，卡牌框使用遮罩透出内容区', () => {
    vi.stubGlobal('Image', LoadedImage);
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag !== 'canvas') return {};
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            quadraticCurveTo: () => {},
            closePath: () => {},
            fill: () => {},
            globalCompositeOperation: 'source-over',
            fillStyle: '',
          }),
        };
      },
    });
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

    const frameDraw = imageDrawsOf(ui).find((draw) => (
      draw.layer === 'normal' &&
      draw.path === '/art/ui/ui_card_frame_rare.png' &&
      draw.alpha === 1
    ));
    expect(frameDraw).toMatchObject({
      phase: 'front',
      mode: 'card-frame-mask',
    });
    expect(cardIconDrawsOf(ui).some((draw) => (
      draw.layer === 'normal' &&
      draw.cardId === 'card_ice_tower'
    ))).toBe(true);

    const contentRect = renderer.commands.find((cmd) => (
      cmd.shape === 'rect' &&
      cmd.color === '#0d1b2a' &&
      cmd.size === 96 &&
      cmd.h === 80
    ));
    const translucentCardRect = renderer.commands.find((cmd) => (
      cmd.shape === 'rect' &&
      cmd.color === '#1a2332' &&
      cmd.alpha !== undefined &&
      cmd.alpha < 1
    ));
    expect(contentRect).toBeTruthy();
    expect(translucentCardRect).toBeUndefined();
    expect(infosOf(ui).some((info) => (
      info.text === '塔' &&
      info.color === '#42a5f5'
    ))).toBe(true);

    renderer.events = [];
    ui.renderUI();
    renderer.events = [];
    ui.renderUI();
    const firstCardArtDraw = renderer.events.indexOf('drawImage');
    const cardFrameMaskDraw = renderer.events.indexOf('drawCardFrameMask');
    expect(firstCardArtDraw).toBeGreaterThanOrEqual(0);
    expect(cardFrameMaskDraw).toBeGreaterThanOrEqual(0);
    expect(firstCardArtDraw).toBeLessThan(cardFrameMaskDraw);
  });

  it('手牌 registry 返回旧形态半截配置时不因缺少 id 崩溃', () => {
    const renderer = new RendererStub();
    const ui = makeUISystem(renderer, 0);
    const world = new TowerWorld();
    world.attachRunContext({
      registry: {
        get: () => ({
          name: '箭塔',
          type: 'unit',
          energyCost: 0,
          goldCost: 70,
          rarity: 'common',
          description: '基础单体物理输出',
          placement: { targetType: 'tile' },
        }),
      },
      hand: { state: { hand: [{ cardId: 'card_arrow_tower' }] } },
    });

    expect(() => ui.update(world, 1 / 60)).not.toThrow();
    expect(cardIconDrawsOf(ui).some((draw) => draw.cardId === 'card_arrow_tower')).toBe(true);
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
