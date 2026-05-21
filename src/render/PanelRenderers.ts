import { Container, Graphics, Text } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';

import {
  hitTestMainMenu,
  layoutMainMenu,
  type MainMenu,
  type MainMenuState,
} from '../ui/MainMenu.js';
import {
  hitTestInterLevel,
  layoutInterLevel,
  type InterLevelPanel,
  type InterLevelState,
} from '../ui/InterLevelPanel.js';
import {
  hitTestRunResultButton,
  projectRunResult,
  type RunResultPanel,
  type RunResultState,
} from '../ui/RunResultPanel.js';
import type { ShopPanel, ShopState } from '../ui/ShopPanel.js';
import type { MysticEventConfig } from '../config/loader.js';
import type { MysticPanel } from '../ui/MysticPanel.js';

import {
  hitTestLevelMap,
  layoutLevelMap,
  formatLevelDescription,
  type LevelMapPanel,
  type LevelMapState,
} from '../ui/LevelMapPanel.js';
import type { DeckViewPanel, DeckViewState } from '../ui/DeckViewPanel.js';

export interface PanelRendererConfig {
  readonly container: Container;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

const DIM_BG = 0x0a0e16;
const BUTTON_ENABLED = 0x37474f;
const BUTTON_DISABLED = 0x263238;
const BUTTON_BORDER = 0x80cbc4;
const BUTTON_BORDER_DISABLED = 0x455a64;
const TEXT_PRIMARY = 0xffffff;
const TEXT_DIM = 0x90a4ae;
const TITLE_COLOR = 0xffd54f;

export class MainMenuRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly buttonsGraphics: Graphics;
  private readonly titleText: Text;
  private readonly buttonLabels: Text[] = [];
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly menu: MainMenu;
  private state: MainMenuState = { hasSavedRun: false };

  constructor(config: PanelRendererConfig, menu: MainMenu, initial: MainMenuState = { hasSavedRun: false }) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.menu = menu;
    this.state = initial;

    this.bg = new Graphics();
    this.buttonsGraphics = new Graphics();
    this.titleText = new Text({
      text: '',
      style: { fill: TITLE_COLOR, fontSize: 36, fontWeight: 'bold', align: 'center' },
    });
    this.titleText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.titleText, this.buttonsGraphics);

    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));

    this.render();
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
    this.render();
  }

  refresh(state: MainMenuState): void {
    this.state = state;
    this.menu.refresh(state);
    this.render();
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    const layout = layoutMainMenu(this.state, this.viewportWidth, this.viewportHeight);
    const local = this.container.toLocal(e.global);
    const action = hitTestMainMenu(layout, local.x, local.y);
    if (action) this.menu.trigger(action);
  }

  private render(): void {
    const layout = layoutMainMenu(this.state, this.viewportWidth, this.viewportHeight);
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.92 });

    this.titleText.text = layout.titleLabel;
    this.titleText.position.set(layout.titleX, layout.titleY);

    this.buttonsGraphics.clear();
    while (this.buttonLabels.length < layout.buttons.length) {
      const t = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
      t.anchor.set(0.5, 0.5);
      this.container.addChild(t);
      this.buttonLabels.push(t);
    }
    for (let i = layout.buttons.length; i < this.buttonLabels.length; i += 1) {
      this.buttonLabels[i]!.text = '';
    }
    for (let i = 0; i < layout.buttons.length; i += 1) {
      const b = layout.buttons[i]!;
      const fill = b.enabled ? BUTTON_ENABLED : BUTTON_DISABLED;
      const border = b.enabled ? BUTTON_BORDER : BUTTON_BORDER_DISABLED;
      this.buttonsGraphics.rect(b.x, b.y, b.width, b.height).fill({ color: fill, alpha: 0.95 });
      this.buttonsGraphics.rect(b.x, b.y, b.width, b.height).stroke({ width: 2, color: border });
      const label = this.buttonLabels[i]!;
      label.text = b.icon ? `${b.icon} ${b.label}` : b.label;
      label.style.fill = b.enabled ? TEXT_PRIMARY : TEXT_DIM;
      label.position.set(b.x + b.width / 2, b.y + b.height / 2);
    }
  }
}

export class InterLevelRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly cardsGraphics: Graphics;
  private readonly headerText: Text;
  private readonly cardTitleTexts: Text[] = [];
  private readonly cardDescTexts: Text[] = [];
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly panel: InterLevelPanel;
  private state: InterLevelState | null = null;

  constructor(config: PanelRendererConfig, panel: InterLevelPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.cardsGraphics = new Graphics();
    this.headerText = new Text({
      text: '',
      style: { fill: TEXT_PRIMARY, fontSize: 28, fontWeight: 'bold', align: 'center' },
    });
    this.headerText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.headerText, this.cardsGraphics);

    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
    if (this.state) this.render();
  }

  refresh(state: InterLevelState): void {
    this.state = state;
    this.panel.refresh(state);
    this.render();
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const layout = layoutInterLevel(this.state, this.viewportWidth, this.viewportHeight);
    const local = this.container.toLocal(e.global);
    const offerId = hitTestInterLevel(layout, local.x, local.y);
    if (offerId) this.panel.trigger(offerId);
  }

  private render(): void {
    if (!this.state) return;
    const layout = layoutInterLevel(this.state, this.viewportWidth, this.viewportHeight);
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.92 });

    this.headerText.text = layout.headerLabel;
    this.headerText.position.set(this.viewportWidth / 2, 60);

    this.cardsGraphics.clear();
    while (this.cardTitleTexts.length < layout.items.length) {
      const title = new Text({ text: '', style: { fill: TITLE_COLOR, fontSize: 22, fontWeight: 'bold' } });
      const desc = new Text({ text: '', style: { fill: TEXT_DIM, fontSize: 16, wordWrap: true, wordWrapWidth: 280 } });
      this.container.addChild(title, desc);
      this.cardTitleTexts.push(title);
      this.cardDescTexts.push(desc);
    }
    for (let i = layout.items.length; i < this.cardTitleTexts.length; i += 1) {
      this.cardTitleTexts[i]!.text = '';
      this.cardDescTexts[i]!.text = '';
    }
    for (let i = 0; i < layout.items.length; i += 1) {
      const item = layout.items[i]!;
      this.cardsGraphics.roundRect(item.x, item.y, item.width, item.height, 12).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
      this.cardsGraphics.roundRect(item.x, item.y, item.width, item.height, 12).stroke({ width: 2, color: BUTTON_BORDER });
      const title = this.cardTitleTexts[i]!;
      let titleText = item.title;
      if (item.kind === 'shop' && !titleText.includes('🏪')) titleText = '🏪 ' + titleText;
      if (item.kind === 'mystic' && !titleText.includes('🌀')) titleText = '🌀 ' + titleText;
      if (item.kind === 'skip' && !titleText.includes('⏭')) titleText = '⏭ ' + titleText;
      title.text = titleText;
      title.position.set(item.x + 20, item.y + 20);
      const desc = this.cardDescTexts[i]!;
      desc.text = item.description;
      desc.position.set(item.x + 20, item.y + 60);
    }
  }
}

export class RunResultRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly btnsGraphics: Graphics;
  private readonly headerText: Text;
  private readonly lineTexts: Text[] = [];
  private readonly btnLabelTexts: Text[] = [];
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly panel: RunResultPanel;
  private state: RunResultState | null = null;

  constructor(config: PanelRendererConfig, panel: RunResultPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.btnsGraphics = new Graphics();
    this.headerText = new Text({
      text: '',
      style: { fill: TEXT_PRIMARY, fontSize: 48, fontWeight: 'bold', align: 'center' },
    });
    this.headerText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.headerText, this.btnsGraphics);

    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
    if (this.state) this.render();
  }

  refresh(state: RunResultState): void {
    this.state = state;
    this.panel.refresh(state);
    this.render();
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const layout = projectRunResult(this.state, this.viewportWidth, this.viewportHeight);
    const local = this.container.toLocal(e.global);
    const btnId = hitTestRunResultButton(layout, local.x, local.y);
    if (btnId) this.panel.trigger(btnId);
  }

  private render(): void {
    if (!this.state) return;
    const layout = projectRunResult(this.state, this.viewportWidth, this.viewportHeight);
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.92 });

    this.headerText.text = layout.headerLabel;
    this.headerText.style.fill = layout.headerColor;
    this.headerText.position.set(this.viewportWidth / 2, 80);

    while (this.lineTexts.length < layout.lines.length) {
      const t = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 22 } });
      this.container.addChild(t);
      this.lineTexts.push(t);
    }
    for (let i = layout.lines.length; i < this.lineTexts.length; i += 1) {
      this.lineTexts[i]!.text = '';
    }
    const lineStartY = 180;
    const lineGap = 36;
    const lineX = this.viewportWidth / 2 - 200;
    for (let i = 0; i < layout.lines.length; i += 1) {
      const l = layout.lines[i]!;
      const t = this.lineTexts[i]!;
      t.text = `${l.label}: ${l.value}`;
      t.position.set(lineX, lineStartY + i * lineGap);
    }

    this.btnsGraphics.clear();
    while (this.btnLabelTexts.length < layout.buttons.length) {
      const t = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
      t.anchor.set(0.5, 0.5);
      this.container.addChild(t);
      this.btnLabelTexts.push(t);
    }
    for (let i = 0; i < layout.buttons.length; i += 1) {
      const b = layout.buttons[i]!;
      this.btnsGraphics.rect(b.x, b.y, b.width, b.height).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
      this.btnsGraphics.rect(b.x, b.y, b.width, b.height).stroke({ width: 2, color: BUTTON_BORDER });
      const lbl = this.btnLabelTexts[i]!;
      lbl.text = b.label;
      lbl.position.set(b.x + b.width / 2, b.y + b.height / 2);
    }
  }
}

const GOLD_COLOR = 0xffd740;
const SP_COLOR = 0xb2ebf2;
export class ShopRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly leftGraphics: Graphics;
  private readonly itemsGraphics: Graphics;
  private readonly headerText: Text;
  private readonly goldText: Text;
  private readonly closeText: Text;
  private readonly leftTitleText: Text;
  private readonly leftPlaceholderText: Text;
  private readonly itemLabelTexts: Text[] = [];
  private readonly itemCostTexts: Text[] = [];
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly panel: ShopPanel;
  private state: ShopState | null = null;

  constructor(config: PanelRendererConfig, panel: ShopPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.leftGraphics = new Graphics();
    this.itemsGraphics = new Graphics();
    this.headerText = new Text({ text: '🏪 商店', style: { fill: TITLE_COLOR, fontSize: 24, fontWeight: 'bold' } });
    this.goldText = new Text({ text: '', style: { fill: GOLD_COLOR, fontSize: 18 } });
    this.closeText = new Text({ text: '离开商店', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
    this.closeText.anchor.set(0.5, 0.5);

    this.leftTitleText = new Text({ text: '当前卡组', style: { fill: TEXT_PRIMARY, fontSize: 20, fontWeight: 'bold' } });
    this.leftPlaceholderText = new Text({ text: '（卡组数据将在此显示）', style: { fill: TEXT_DIM, fontSize: 16 } });

    this.container.addChild(this.bg, this.leftGraphics, this.itemsGraphics, this.headerText, this.goldText, this.closeText, this.leftTitleText, this.leftPlaceholderText);
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
    if (this.state) this.render();
  }

  refresh(state: ShopState): void {
    this.state = state;
    this.panel.refresh(state);
    this.render();
  }

  private get closeBtn() {
    const w = 260;
    const h = 50;
    return { x: (this.viewportWidth - w) / 2, y: this.viewportHeight - h - 20, w, h };
  }

  private itemRect(index: number, rightColX: number, rightColW: number) {
    const cols = 4;
    const colGap = 16;
    const rowGap = 20;
    const itemW = (rightColW - (cols - 1) * colGap) / cols;
    const itemH = 140;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const startY = 80;
    return { x: rightColX + col * (itemW + colGap), y: startY + row * (itemH + rowGap), w: itemW, h: itemH };
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const local = this.container.toLocal(e.global);
    const cb = this.closeBtn;
    if (local.x >= cb.x && local.x <= cb.x + cb.w && local.y >= cb.y && local.y <= cb.y + cb.h) {
      this.panel.triggerClose();
      return;
    }
    const rightColX = this.viewportWidth * 0.35 + 20;
    const rightColW = this.viewportWidth * 0.65 - 40;
    for (let i = 0; i < this.state.items.length; i += 1) {
      const r = this.itemRect(i, rightColX, rightColW);
      if (local.x >= r.x && local.x <= r.x + r.w && local.y >= r.y && local.y <= r.y + r.h) {
        this.panel.triggerPurchase(this.state.items[i]!.id);
        return;
      }
    }
  }

  private render(): void {
    if (!this.state) return;
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.95 });

    // Topbar
    this.headerText.position.set(20, 15);
    this.goldText.text = `💰 ${this.state.gold}G`;
    this.goldText.anchor.set(1, 0);
    this.goldText.position.set(this.viewportWidth - 20, 15);

    // Left column (35%)
    const leftColW = this.viewportWidth * 0.35;
    this.leftGraphics.clear();
    this.leftGraphics.rect(20, 80, leftColW - 40, this.viewportHeight - 160).stroke({ width: 2, color: 0x263238 });
    this.leftTitleText.position.set(40, 100);
    this.leftPlaceholderText.position.set(40, 140);

    // Right column (65%)
    const rightColX = leftColW + 20;
    const rightColW = this.viewportWidth * 0.65 - 40;

    this.itemsGraphics.clear();
    while (this.itemLabelTexts.length < 8) { // Up to 8 items as requested
      const lbl = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 18, fontWeight: 'bold', wordWrap: true, wordWrapWidth: 150 } });
      const cost = new Text({ text: '', style: { fill: GOLD_COLOR, fontSize: 16 } });
      this.container.addChild(lbl, cost);
      this.itemLabelTexts.push(lbl);
      this.itemCostTexts.push(cost);
    }
    for (let i = 0; i < 8; i += 1) {
      this.itemLabelTexts[i]!.text = '';
      this.itemCostTexts[i]!.text = '';
    }

    for (let i = 0; i < this.state.items.length && i < 8; i += 1) {
      const item = this.state.items[i]!;
      const r = this.itemRect(i, rightColX, rightColW);
      const isAffordable = this.state.gold >= item.costGold;
      const canBuy = isAffordable && item.stock > 0;
      const fillColor = canBuy ? BUTTON_ENABLED : BUTTON_DISABLED;
      const borderColor = canBuy ? 0x4caf50 : (isAffordable ? 0x80cbc4 : BUTTON_BORDER_DISABLED);

      this.itemsGraphics.rect(r.x, r.y, r.w, r.h).fill({ color: fillColor, alpha: 0.95 });
      this.itemsGraphics.rect(r.x, r.y, r.w, r.h).stroke({ width: 2, color: borderColor });
      this.itemLabelTexts[i]!.text = item.label;
      this.itemLabelTexts[i]!.position.set(r.x + 16, r.y + 16);
      this.itemCostTexts[i]!.text = `${item.costGold}G  (stock: ${item.stock})`;
      this.itemCostTexts[i]!.style.fill = canBuy ? GOLD_COLOR : TEXT_DIM;
      this.itemCostTexts[i]!.position.set(r.x + 16, r.y + r.h - 30);
    }

    const cb = this.closeBtn;
    this.itemsGraphics.rect(cb.x, cb.y, cb.w, cb.h).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
    this.itemsGraphics.rect(cb.x, cb.y, cb.w, cb.h).stroke({ width: 2, color: BUTTON_BORDER });
    this.closeText.position.set(cb.x + cb.w / 2, cb.y + cb.h / 2);
  }
}

export class MysticRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly choicesGraphics: Graphics;
  private readonly headerText: Text;
  private readonly descText: Text;
  private readonly closeText: Text;
  private readonly choiceLabelTexts: Text[] = [];
  private readonly choiceEffectTexts: Text[] = [];
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly panel: MysticPanel;
  private event: MysticEventConfig | null = null;

  constructor(config: PanelRendererConfig, panel: MysticPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.choicesGraphics = new Graphics();
    this.headerText = new Text({ text: '', style: { fill: TITLE_COLOR, fontSize: 28, fontWeight: 'bold', align: 'center' } });
    this.headerText.anchor.set(0.5, 0.5);
    this.descText = new Text({ text: '', style: { fill: TEXT_DIM, fontSize: 18, align: 'center', wordWrap: true, wordWrapWidth: 600 } });
    this.descText.anchor.set(0.5, 0);
    this.closeText = new Text({ text: 'Exit Mystic', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
    this.closeText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.headerText, this.descText, this.choicesGraphics, this.closeText);
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
    if (this.event) this.render();
  }

  refresh(event: MysticEventConfig): void {
    this.event = event;
    this.panel.refresh(event);
    this.render();
  }

  private get closeBtn() {
    const w = 260;
    const h = 56;
    return { x: (this.viewportWidth - w) / 2, y: this.viewportHeight - 100, w, h };
  }

  private choiceRect(index: number) {
    const choiceW = 360;
    const choiceH = 80;
    const gap = 16;
    const count = this.event?.choices.length ?? 0;
    const totalH = count * choiceH + Math.max(0, count - 1) * gap;
    const startY = (this.viewportHeight - totalH) / 2 + 60;
    return { x: (this.viewportWidth - choiceW) / 2, y: startY + index * (choiceH + gap), w: choiceW, h: choiceH };
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.event) return;
    const local = this.container.toLocal(e.global);
    const cb = this.closeBtn;
    if (local.x >= cb.x && local.x <= cb.x + cb.w && local.y >= cb.y && local.y <= cb.y + cb.h) {
      this.panel.triggerExit();
      return;
    }
    for (let i = 0; i < this.event.choices.length; i += 1) {
      const r = this.choiceRect(i);
      if (local.x >= r.x && local.x <= r.x + r.w && local.y >= r.y && local.y <= r.y + r.h) {
        this.panel.triggerChoice(this.event.choices[i]!.id);
        return;
      }
    }
  }

  private render(): void {
    if (!this.event) return;
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.95 });

    this.headerText.text = this.event.title;
    this.headerText.position.set(this.viewportWidth / 2, 60);
    this.descText.text = this.event.description;
    this.descText.position.set(this.viewportWidth / 2, 100);

    this.choicesGraphics.clear();
    while (this.choiceLabelTexts.length < this.event.choices.length) {
      const lbl = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 18, fontWeight: 'bold' } });
      const eff = new Text({ text: '', style: { fill: SP_COLOR, fontSize: 14 } });
      this.container.addChild(lbl, eff);
      this.choiceLabelTexts.push(lbl);
      this.choiceEffectTexts.push(eff);
    }
    for (let i = 0; i < this.event.choices.length; i += 1) {
      const choice = this.event.choices[i]!;
      const r = this.choiceRect(i);
      this.choicesGraphics.rect(r.x, r.y, r.w, r.h).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
      this.choicesGraphics.rect(r.x, r.y, r.w, r.h).stroke({ width: 2, color: BUTTON_BORDER });
      this.choiceLabelTexts[i]!.text = choice.label;
      this.choiceLabelTexts[i]!.position.set(r.x + 16, r.y + 12);
      const effectStr = choice.effects.map((ef) => ef.type).join(', ') || 'no effect';
      this.choiceEffectTexts[i]!.text = effectStr;
      this.choiceEffectTexts[i]!.position.set(r.x + 16, r.y + 44);
    }

    const cb = this.closeBtn;
    this.choicesGraphics.rect(cb.x, cb.y, cb.w, cb.h).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
    this.choicesGraphics.rect(cb.x, cb.y, cb.w, cb.h).stroke({ width: 2, color: BUTTON_BORDER });
    this.closeText.position.set(cb.x + cb.w / 2, cb.y + cb.h / 2);
  }
}

const NODE_COMPLETED = 0x1b5e20;
const NODE_CURRENT = 0x1565c0;
const NODE_LOCKED_COLOR = 0x37474f;
const PATH_DONE = 0x4caf50;
const PATH_FUTURE = 0x455a64;

export class LevelMapRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly pathGraphics: Graphics;
  private readonly nodesGraphics: Graphics;
  private readonly challengeGraphics: Graphics;
  private readonly viewDeckGraphics: Graphics;
  private readonly backBtnGraphics: Graphics;
  private readonly hudText: Text;
  private readonly goldText: Text;
  private readonly crystalText: Text;
  private readonly challengeText: Text;
  private readonly viewDeckText: Text;
  private readonly backBtnText: Text;
  private readonly currentTitleText: Text;
  private readonly currentNameText: Text;
  private readonly currentSummaryText: Text;
  private readonly currentDescText: Text;
  private readonly enemyTitleText: Text;
  private readonly enemyEmptyText: Text;
  private readonly enemyTexts: Text[] = [];
  private readonly nodeLabelTexts: Text[] = [];
  private readonly nodeNameTexts: Text[] = [];
  private readonly nodeWaveTexts: Text[] = [];
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly panel: LevelMapPanel;
  private state: LevelMapState | null = null;

  constructor(config: PanelRendererConfig, panel: LevelMapPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.pathGraphics = new Graphics();
    this.nodesGraphics = new Graphics();
    this.challengeGraphics = new Graphics();
    this.viewDeckGraphics = new Graphics();
    this.backBtnGraphics = new Graphics();
    this.hudText = new Text({ text: '', style: { fill: TITLE_COLOR, fontSize: 22, fontWeight: 'bold' } });
    this.goldText = new Text({ text: '', style: { fill: GOLD_COLOR, fontSize: 20 } });
    this.crystalText = new Text({ text: '', style: { fill: 0x80cbc4, fontSize: 20 } });
    this.challengeText = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 22, align: 'center', fontWeight: 'bold' } });
    this.challengeText.anchor.set(0.5, 0.5);
    this.viewDeckText = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 16, align: 'center' } });
    this.viewDeckText.anchor.set(0.5, 0.5);
    this.backBtnText = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 16, align: 'center' } });
    this.backBtnText.anchor.set(0.5, 0.5);
    this.currentTitleText = new Text({ text: '', style: { fill: 0x90caf9, fontSize: 22, fontWeight: 'bold' } });
    this.currentNameText = new Text({ text: '', style: { fill: TITLE_COLOR, fontSize: 34, fontWeight: 'bold' } });
    this.currentSummaryText = new Text({ text: '', style: { fill: 0xb3e5fc, fontSize: 20, fontWeight: 'bold' } });
    this.currentDescText = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 18, wordWrap: true, wordWrapWidth: 620, lineHeight: 28 } });
    this.enemyTitleText = new Text({ text: '敌情情报', style: { fill: TITLE_COLOR, fontSize: 24, fontWeight: 'bold' } });
    this.enemyEmptyText = new Text({ text: '', style: { fill: TEXT_DIM, fontSize: 16, wordWrap: true, wordWrapWidth: 220, lineHeight: 24 } });

    this.container.addChild(
      this.bg,
      this.pathGraphics,
      this.nodesGraphics,
      this.challengeGraphics,
      this.viewDeckGraphics,
      this.backBtnGraphics,
      this.hudText,
      this.goldText,
      this.crystalText,
      this.currentTitleText,
      this.currentNameText,
      this.currentSummaryText,
      this.currentDescText,
      this.enemyTitleText,
      this.enemyEmptyText,
      this.challengeText,
      this.viewDeckText,
      this.backBtnText,
    );
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
    if (this.state) this.render();
  }

  refresh(state: LevelMapState): void {
    this.state = state;
    this.panel.refresh(state);
    this.render();
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const layout = layoutLevelMap(this.state, this.viewportWidth, this.viewportHeight);
    const local = this.container.toLocal(e.global);
    const action = hitTestLevelMap(layout, local.x, local.y);
    if (action) this.panel.trigger(action);
  }

  private render(): void {
    if (!this.state) return;
    const layout = layoutLevelMap(this.state, this.viewportWidth, this.viewportHeight);
    const scale = Math.min(this.viewportWidth / 1920, this.viewportHeight / 1080);

    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: 0x0d1b2a, alpha: 1 });
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: 0x12324a, alpha: 0.35 });
    this.bg.circle(this.viewportWidth * 0.22, this.viewportHeight * 0.28, 220 * scale).fill({ color: 0x2e7d32, alpha: 0.14 });
    this.bg.circle(this.viewportWidth * 0.7, this.viewportHeight * 0.2, 260 * scale).fill({ color: 0xffd54f, alpha: 0.08 });
    this.bg.roundRect(layout.mainCard.x - 26 * scale, layout.mainCard.y + 24 * scale, layout.mainCard.width + 52 * scale, layout.mainCard.height - 40 * scale, 28 * scale).fill({ color: 0xffffff, alpha: 0.03 });

    this.hudText.text = layout.titleLabel;
    this.hudText.position.set(36 * scale, 24 * scale);
    this.crystalText.text = layout.crystalLabel;
    this.crystalText.position.set(this.viewportWidth * 0.46, 24 * scale);
    this.goldText.text = layout.goldLabel;
    this.goldText.position.set(this.viewportWidth * 0.63, 24 * scale);

    this.pathGraphics.clear();
    this.pathGraphics.roundRect(layout.mainCard.x, layout.mainCard.y, layout.mainCard.width, layout.mainCard.height, 28 * scale)
      .fill({ color: 0x10263b, alpha: 0.96 })
      .stroke({ width: 3, color: 0x4fc3f7 });
    this.pathGraphics.roundRect(layout.enemyCard.x, layout.enemyCard.y, layout.enemyCard.width, layout.enemyCard.height, 24 * scale)
      .fill({ color: 0x132238, alpha: 0.94 })
      .stroke({ width: 2, color: 0x607d8b });
    this.pathGraphics.roundRect(layout.timeline.x, layout.timeline.y, layout.timeline.width, layout.timeline.height, 26 * scale)
      .fill({ color: 0x0f2233, alpha: 0.94 })
      .stroke({ width: 2, color: 0x29434e });

    this.pathGraphics.moveTo(layout.mainCard.x + layout.mainCard.width * 0.5, layout.mainCard.y + layout.mainCard.height)
      .lineTo(layout.timeline.x + layout.timeline.width * 0.5, layout.timeline.y)
      .stroke({ width: 4, color: 0x355c7d, alpha: 0.6 });

    this.currentTitleText.text = layout.currentNodeTitle;
    this.currentTitleText.position.set(layout.mainCard.x + 34 * scale, layout.mainCard.y + 28 * scale);
    this.currentNameText.text = layout.currentNode.name;
    this.currentNameText.position.set(layout.mainCard.x + 34 * scale, layout.mainCard.y + 70 * scale);
    this.currentSummaryText.text = layout.currentNodeSummary;
    this.currentSummaryText.position.set(layout.mainCard.x + 34 * scale, layout.mainCard.y + 128 * scale);
    this.currentDescText.text = formatLevelDescription(layout.currentNode.description);
    this.currentDescText.style.wordWrapWidth = layout.mainCard.width - 70 * scale;
    this.currentDescText.position.set(layout.mainCard.x + 34 * scale, layout.mainCard.y + 174 * scale);

    this.enemyTitleText.position.set(layout.enemyCard.x + 24 * scale, layout.enemyCard.y + 24 * scale);
    this.enemyEmptyText.position.set(layout.enemyCard.x + 24 * scale, layout.enemyCard.y + 74 * scale);

    while (this.enemyTexts.length < 5) {
      const t = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 17, wordWrap: true, wordWrapWidth: 230, lineHeight: 24 } });
      this.container.addChild(t);
      this.enemyTexts.push(t);
    }
    for (let i = 0; i < this.enemyTexts.length; i += 1) {
      const text = this.enemyTexts[i]!;
      const enemy = layout.enemyPreview[i];
      if (!enemy) {
        text.text = '';
        continue;
      }
      const tag = enemy.isBoss ? 'Boss' : enemy.isElite ? '精英' : '敌军';
      text.text = `• ${enemy.name} ×${enemy.count}  · ${tag}`;
      text.position.set(layout.enemyCard.x + 24 * scale, layout.enemyCard.y + (78 + i * 48) * scale);
    }
    this.enemyEmptyText.text = layout.enemyPreview.length === 0 ? '敌情待侦察\n进入后根据波次逐步揭示' : '';

    this.nodesGraphics.clear();
    while (this.nodeLabelTexts.length < layout.nodes.length) {
      const lbl = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 13, fontWeight: 'bold', align: 'center' } });
      lbl.anchor.set(0.5, 0);
      this.container.addChild(lbl);
      this.nodeLabelTexts.push(lbl);
    }
    while (this.nodeNameTexts.length < layout.nodes.length) {
      const t = new Text({ text: '', style: { fill: TITLE_COLOR, fontSize: 14, fontWeight: 'bold', align: 'center', wordWrap: true, wordWrapWidth: 150 } });
      t.anchor.set(0.5, 0);
      this.container.addChild(t);
      this.nodeNameTexts.push(t);
    }
    while (this.nodeWaveTexts.length < layout.nodes.length) {
      const t = new Text({ text: '', style: { fill: 0x80cbc4, fontSize: 12, align: 'center' } });
      t.anchor.set(0.5, 1);
      this.container.addChild(t);
      this.nodeWaveTexts.push(t);
    }
    for (let i = layout.nodes.length; i < this.nodeLabelTexts.length; i += 1) {
      this.nodeLabelTexts[i]!.text = '';
      this.nodeNameTexts[i]!.text = '';
      this.nodeWaveTexts[i]!.text = '';
    }
    for (let i = 0; i < layout.nodes.length; i += 1) {
      const n = layout.nodes[i]!;
      const fill = n.status === 'completed' ? 0x2e7d32 : n.status === 'current' ? 0x1565c0 : 0x37474f;
      const border = n.status === 'completed' ? 0xa5d6a7 : n.status === 'current' ? 0x4fc3f7 : 0x607d8b;
      const borderWidth = n.status === 'current' ? 5 : n.isBoss ? 4 : 2;
      const alpha = n.status === 'locked' ? 0.5 : 0.96;
      const cx = n.x + n.width / 2;

      this.nodesGraphics.roundRect(n.x, n.y, n.width, n.height, 18 * scale).fill({ color: fill, alpha });
      this.nodesGraphics.roundRect(n.x, n.y, n.width, n.height, 18 * scale).stroke({ width: borderWidth, color: border });

      const lbl = this.nodeLabelTexts[i]!;
      lbl.text = n.status === 'completed' ? `✓ ${n.label}` : n.status === 'current' ? `★ ${n.label}` : n.label;
      lbl.style.fill = n.status === 'locked' ? TEXT_DIM : TEXT_PRIMARY;
      lbl.position.set(cx, n.y + 18 * scale);

      const nameText = this.nodeNameTexts[i]!;
      nameText.text = n.status === 'locked' ? '未解锁' : n.name;
      nameText.style.fill = n.status === 'locked' ? TEXT_DIM : TITLE_COLOR;
      nameText.style.wordWrapWidth = n.width - 22 * scale;
      nameText.position.set(cx, n.y + 46 * scale);

      const waveText = this.nodeWaveTexts[i]!;
      waveText.text = n.waveCount > 0 ? `${n.waveCount} 波` : '';
      waveText.style.fill = n.status === 'locked' ? TEXT_DIM : 0x80cbc4;
      waveText.position.set(cx, n.y + n.height - 14 * scale);
    }

    this.challengeGraphics.clear();
    const btn = layout.challengeBtn;
    this.challengeGraphics.roundRect(btn.x, btn.y, btn.width, btn.height, 16 * scale).fill({ color: 0x1565c0, alpha: 0.98 });
    this.challengeGraphics.roundRect(btn.x, btn.y, btn.width, btn.height, 16 * scale).stroke({ width: 3, color: 0x90caf9 });
    this.challengeText.text = btn.label;
    this.challengeText.position.set(btn.x + btn.width / 2, btn.y + btn.height / 2);

    this.viewDeckGraphics.clear();
    const vdb = layout.deckBtn;
    this.viewDeckGraphics.roundRect(vdb.x, vdb.y, vdb.width, vdb.height, 8).fill({ color: 0x1a237e, alpha: 0.92 });
    this.viewDeckGraphics.roundRect(vdb.x, vdb.y, vdb.width, vdb.height, 8).stroke({ width: 2, color: 0x7986cb });
    this.viewDeckText.text = vdb.label;
    this.viewDeckText.position.set(vdb.x + vdb.width / 2, vdb.y + vdb.height / 2);

    this.backBtnGraphics.clear();
    const bb = layout.backBtn;
    this.backBtnGraphics.roundRect(bb.x, bb.y, bb.width, bb.height, 8).fill({ color: 0x37474f, alpha: 0.92 });
    this.backBtnGraphics.roundRect(bb.x, bb.y, bb.width, bb.height, 8).stroke({ width: 2, color: 0x78909c });
    this.backBtnText.text = bb.label;
    this.backBtnText.position.set(bb.x + bb.width / 2, bb.y + bb.height / 2);
  }
}

const DECK_L1_BORDER = 0x4caf50;
const DECK_L2_BORDER = 0x1565c0;
const DECK_L3_BORDER = 0xffd54f;
const DECK_SELECTED_BG = 0x0d2a4a;
const DECK_SELECTED_BORDER = 0x1e88e5;
const DECK_GOLD_GLOW = 0xffd54f;
const DECK_ITEM_H = 56;
const DECK_ITEM_GAP = 6;
const DECK_TOPBAR_H = 50;
const DECK_BOTTOMBAR_H = 50;
const DECK_ACTION_BTN_H = 44;
const DECK_CONFIRM_BOX_H = 132;

function deckLevelBorderColor(level: number | undefined): number {
  if (level === 3) return DECK_L3_BORDER;
  if (level === 2) return DECK_L2_BORDER;
  return DECK_L1_BORDER;
}

function deckLevelDiamond(level: number | undefined): string {
  if (level === 3) return ' ✦✦';
  if (level === 2) return ' ✦';
  return '';
}

export class DeckViewRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly leftGraphics: Graphics;
  private readonly rightGraphics: Graphics;
  private readonly titleText: Text;
  private readonly goldText: Text;
  private readonly closeBtnText: Text;
  private readonly rightPlaceholderText: Text;
  private readonly cardItemTexts: Text[] = [];
  private readonly detailTexts: Text[] = [];
  private readonly actionBtnTexts: Text[] = [];
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly panel: DeckViewPanel;
  private state: DeckViewState | null = null;
  private selectedInstanceId: string | null = null;

  constructor(config: PanelRendererConfig, panel: DeckViewPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.leftGraphics = new Graphics();
    this.rightGraphics = new Graphics();
    this.titleText = new Text({ text: '📚 卡池管理', style: { fill: TITLE_COLOR, fontSize: 20, fontWeight: 'bold' } });
    this.goldText = new Text({ text: '', style: { fill: GOLD_COLOR, fontSize: 16 } });
    this.goldText.anchor.set(1, 0.5);
    this.closeBtnText = new Text({ text: '✕ 关闭', style: { fill: TEXT_PRIMARY, fontSize: 16 } });
    this.closeBtnText.anchor.set(0.5, 0.5);
    this.rightPlaceholderText = new Text({ text: '← 选择左侧卡牌', style: { fill: TEXT_DIM, fontSize: 18 } });
    this.rightPlaceholderText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.leftGraphics, this.rightGraphics,
      this.titleText, this.goldText, this.closeBtnText, this.rightPlaceholderText);
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  private get leftColWidth(): number { return Math.floor(this.viewportWidth * 0.3); }
  private get rightColX(): number { return this.leftColWidth + 1; }
  private get rightColWidth(): number { return this.viewportWidth - this.rightColX; }
  private get contentH(): number { return this.viewportHeight - DECK_TOPBAR_H - DECK_BOTTOMBAR_H; }
  private get closeBtnRect() {
    const w = 160; const h = 40;
    return { x: (this.viewportWidth - w) / 2, y: this.viewportHeight - DECK_BOTTOMBAR_H + 5, w, h };
  }

  private instances(): readonly import('../ui/DeckViewPanel.js').CardInstanceEntry[] {
    return this.state?.instances ?? [];
  }

  private selectedInstance(): import('../ui/DeckViewPanel.js').CardInstanceEntry | null {
    return this.instances().find((instance) => instance.instanceId === this.selectedInstanceId) ?? null;
  }

  private confirmationForSelected() {
    const confirmation = this.state?.confirmation;
    if (!confirmation) return null;
    if (confirmation.instanceId !== this.selectedInstanceId) return null;
    return confirmation;
  }

  private actionButtons(selected: import('../ui/DeckViewPanel.js').CardInstanceEntry) {
    const panelX = this.rightColX + 20;
    const panelW = this.rightColWidth - 40;
    const gap = 16;
    const buttonWidth = Math.floor((panelW - gap) / 2);
    const y = DECK_TOPBAR_H + 186;
    return [
      {
        kind: 'upgrade' as const,
        x: panelX,
        y,
        width: buttonWidth,
        height: DECK_ACTION_BTN_H,
        enabled: selected.canUpgrade ?? false,
        label: selected.upgradeLabel ?? (selected.nextUpgradeCostGold != null ? `升级 -${selected.nextUpgradeCostGold} 金币` : '无法升级'),
      },
      {
        kind: 'delete' as const,
        x: panelX + buttonWidth + gap,
        y,
        width: buttonWidth,
        height: DECK_ACTION_BTN_H,
        enabled: selected.canDelete ?? false,
        label: selected.deleteLabel ?? '删除卡牌',
      },
    ];
  }

  private confirmationButtons() {
    const box = this.confirmationBoxRect();
    const gap = 12;
    const buttonWidth = Math.floor((box.width - 36 - gap) / 2);
    const y = box.y + box.height - DECK_ACTION_BTN_H - 14;
    return {
      confirm: { x: box.x + 18, y, width: buttonWidth, height: DECK_ACTION_BTN_H },
      cancel: { x: box.x + 18 + buttonWidth + gap, y, width: buttonWidth, height: DECK_ACTION_BTN_H },
    };
  }

  private confirmationBoxRect() {
    return {
      x: this.rightColX + 20,
      y: DECK_TOPBAR_H + 256,
      width: this.rightColWidth - 40,
      height: DECK_CONFIRM_BOX_H,
    };
  }

  private pointInRect(local: { x: number; y: number }, rect: { x: number; y: number; width: number; height: number }): boolean {
    return local.x >= rect.x && local.x <= rect.x + rect.width && local.y >= rect.y && local.y <= rect.y + rect.height;
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const local = this.container.toLocal(e.global);
    const cb = this.closeBtnRect;
    if (local.x >= cb.x && local.x <= cb.x + cb.w && local.y >= cb.y && local.y <= cb.y + cb.h) {
      this.panel.trigger('close');
      return;
    }
    if (local.x < this.leftColWidth && local.y >= DECK_TOPBAR_H && local.y < this.viewportHeight - DECK_BOTTOMBAR_H) {
      const idx = Math.floor((local.y - DECK_TOPBAR_H) / (DECK_ITEM_H + DECK_ITEM_GAP));
      const instances = this.instances();
      if (idx >= 0 && idx < instances.length) {
        const inst = instances[idx]!;
        this.selectedInstanceId = inst.instanceId;
        this.panel.selectInstance(inst.instanceId);
        this.render();
      }
      return;
    }

    const selected = this.selectedInstance();
    if (!selected) return;
    const confirmation = this.confirmationForSelected();
    if (confirmation) {
      const buttons = this.confirmationButtons();
      if (this.pointInRect(local, buttons.confirm)) {
        if (confirmation.kind === 'upgrade') {
          this.panel.confirmUpgrade(confirmation.instanceId);
        } else {
          this.panel.confirmDelete(confirmation.instanceId);
        }
        return;
      }
      if (this.pointInRect(local, buttons.cancel)) {
        this.panel.cancelConfirmation();
        return;
      }
    }

    for (const button of this.actionButtons(selected)) {
      if (!button.enabled) continue;
      if (!this.pointInRect(local, button)) continue;
      if (button.kind === 'upgrade') {
        this.panel.requestUpgrade(selected.instanceId);
      } else {
        this.panel.requestDelete(selected.instanceId);
      }
      return;
    }
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
    if (this.state) this.render();
  }

  refresh(state: DeckViewState): void {
    this.state = state;
    const instances = state.instances;
    if (instances && instances.length > 0 && this.selectedInstanceId === null) {
      this.selectedInstanceId = instances[0]!.instanceId;
    }
    if (state.selectedInstanceId !== undefined) {
      this.selectedInstanceId = state.selectedInstanceId;
    }
    this.panel.refresh(state);
    this.render();
  }

  private render(): void {
    if (!this.state) return;
    const vw = this.viewportWidth;
    const vh = this.viewportHeight;
    const lw = this.leftColWidth;
    const rx = this.rightColX;
    const rw = this.rightColWidth;

    this.bg.clear();
    this.bg.rect(0, 0, vw, vh).fill({ color: 0x0d1b2a, alpha: 0.97 });

    this.leftGraphics.clear();
    this.leftGraphics.rect(0, DECK_TOPBAR_H, vw, 1).fill({ color: 0x263238 });
    this.leftGraphics.rect(lw, DECK_TOPBAR_H, 1, this.contentH).fill({ color: 0x263238 });
    this.leftGraphics.rect(0, vh - DECK_BOTTOMBAR_H, vw, 1).fill({ color: 0x263238 });

    this.titleText.position.set(20, DECK_TOPBAR_H / 2);
    this.titleText.anchor.set(0, 0.5);
    const gold = this.state.gold;
    this.goldText.text = gold !== undefined ? `金币: ${gold}` : '';
    this.goldText.position.set(vw - 20, DECK_TOPBAR_H / 2);

    const cb = this.closeBtnRect;
    this.rightGraphics.clear();
    this.rightGraphics.roundRect(cb.x, cb.y, cb.w, cb.h, 8).fill({ color: 0x37474f, alpha: 0.95 });
    this.rightGraphics.roundRect(cb.x, cb.y, cb.w, cb.h, 8).stroke({ width: 2, color: 0x80cbc4 });
    this.closeBtnText.position.set(cb.x + cb.w / 2, cb.y + cb.h / 2);

    this.renderCardList(lw);
    this.renderRightPanel(rx, rw);
  }

  private renderCardList(lw: number): void {
    const instances = this.instances();
    const startY = DECK_TOPBAR_H + 8;

    while (this.cardItemTexts.length < instances.length) {
      const t = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 13 } });
      this.container.addChild(t);
      this.cardItemTexts.push(t);
    }

    for (let i = 0; i < instances.length; i += 1) {
      const inst = instances[i]!;
      const iy = startY + i * (DECK_ITEM_H + DECK_ITEM_GAP);
      const ix = 8;
      const iw = lw - 16;
      const isSelected = inst.instanceId === this.selectedInstanceId;
      const level = inst.level ?? 1;
      const borderColor = isSelected ? DECK_SELECTED_BORDER : ((inst.canUpgrade ?? false) ? DECK_GOLD_GLOW : deckLevelBorderColor(level));
      const bgColor = isSelected ? DECK_SELECTED_BG : 0x1a2a3a;

      this.leftGraphics.roundRect(ix, iy, iw, DECK_ITEM_H, 6).fill({ color: bgColor, alpha: 0.95 });
      this.leftGraphics.roundRect(ix, iy, iw, DECK_ITEM_H, 6).stroke({ width: isSelected ? 2 : 1, color: borderColor });

      const lbl = this.cardItemTexts[i]!;
      lbl.text = `${inst.cardName ?? inst.cardId}${deckLevelDiamond(level)}`;
      lbl.position.set(ix + 10, iy + DECK_ITEM_H / 2 - 7);
    }

    for (let i = instances.length; i < this.cardItemTexts.length; i += 1) {
      this.cardItemTexts[i]!.text = '';
    }
  }

  private renderRightPanel(rx: number, rw: number): void {
    const selected = this.selectedInstance();

    if (!selected) {
      this.rightPlaceholderText.position.set(rx + rw / 2, DECK_TOPBAR_H + this.contentH / 2);
      this.rightPlaceholderText.visible = true;
      for (const t of this.detailTexts) t.text = '';
      for (const t of this.actionBtnTexts) t.text = '';
      return;
    }
    this.rightPlaceholderText.visible = false;

    const level = selected.level ?? 1;
    const cardTitle = `${selected.cardName ?? selected.cardId}${deckLevelDiamond(level)}`;
    const panelX = rx + 20;
    const panelY = DECK_TOPBAR_H + 68;
    const confirmation = this.confirmationForSelected();
    const message = this.state?.message;

    const MAX_SLOTS = 8;
    while (this.detailTexts.length < MAX_SLOTS) {
      const t = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 13 } });
      this.container.addChild(t);
      this.detailTexts.push(t);
    }
    while (this.actionBtnTexts.length < 4) {
      const t = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 14, align: 'center' } });
      t.anchor.set(0.5, 0.5);
      this.container.addChild(t);
      this.actionBtnTexts.push(t);
    }
    for (const t of this.detailTexts) t.text = '';
    for (const t of this.actionBtnTexts) t.text = '';

    this.rightGraphics.roundRect(rx + 12, DECK_TOPBAR_H + 8, rw - 24, 32, 6)
      .fill({ color: 0x1a2a3a, alpha: 0.8 });

    const titleLabel = this.detailTexts[MAX_SLOTS - 1]!;
    titleLabel.text = `🃏 ${cardTitle}`;
    titleLabel.style.fill = TITLE_COLOR;
    titleLabel.style.fontSize = 15;
    titleLabel.position.set(rx + 20, DECK_TOPBAR_H + 16);

    const lines = [
      `当前等级: Lv.${level}`,
      selected.nextUpgradeCostGold != null ? `下次升级消耗: ${selected.nextUpgradeCostGold} 金币` : '该卡牌已无法继续升级',
      selected.canDelete === false ? '当前不可删除此卡牌' : '可在此处删除不再需要的卡牌',
    ];
    if (message) lines.push(message);

    for (let i = 0; i < lines.length && i < MAX_SLOTS - 2; i += 1) {
      const label = this.detailTexts[i]!;
      label.text = lines[i]!;
      label.style.fill = i === lines.length - 1 && message ? DECK_GOLD_GLOW : TEXT_PRIMARY;
      label.style.fontSize = 14;
      label.position.set(panelX, panelY + i * 28);
    }

    const buttons = this.actionButtons(selected);
    for (let i = 0; i < buttons.length; i += 1) {
      const button = buttons[i]!;
      const fill = button.enabled ? (button.kind === 'delete' ? 0x5d1f1f : 0x1c4f7a) : BUTTON_DISABLED;
      const border = button.enabled ? (button.kind === 'delete' ? 0xef9a9a : BUTTON_BORDER) : BUTTON_BORDER_DISABLED;
      this.rightGraphics.roundRect(button.x, button.y, button.width, button.height, 8)
        .fill({ color: fill, alpha: 0.95 });
      this.rightGraphics.roundRect(button.x, button.y, button.width, button.height, 8)
        .stroke({ width: 2, color: border });
      const text = this.actionBtnTexts[i]!;
      text.text = button.label;
      text.style.fill = button.enabled ? TEXT_PRIMARY : TEXT_DIM;
      text.position.set(button.x + button.width / 2, button.y + button.height / 2);
    }

    if (confirmation) {
      const box = this.confirmationBoxRect();
      this.rightGraphics.roundRect(box.x, box.y, box.width, box.height, 10)
        .fill({ color: 0x121b26, alpha: 0.98 });
      this.rightGraphics.roundRect(box.x, box.y, box.width, box.height, 10)
        .stroke({ width: 2, color: confirmation.kind === 'delete' ? 0xe57373 : DECK_GOLD_GLOW });

      const confirmTitle = this.actionBtnTexts[2]!;
      confirmTitle.text = confirmation.title;
      confirmTitle.style.fill = confirmation.kind === 'delete' ? 0xffab91 : DECK_GOLD_GLOW;
      confirmTitle.position.set(box.x + box.width / 2, box.y + 24);

      const confirmBody = this.detailTexts[MAX_SLOTS - 2]!;
      confirmBody.text = confirmation.description;
      confirmBody.style.fill = TEXT_PRIMARY;
      confirmBody.style.fontSize = 13;
      confirmBody.position.set(box.x + 18, box.y + 52);

      const confirmButtons = this.confirmationButtons();
      this.rightGraphics.roundRect(confirmButtons.confirm.x, confirmButtons.confirm.y, confirmButtons.confirm.width, confirmButtons.confirm.height, 8)
        .fill({ color: confirmation.kind === 'delete' ? 0x8e2d2d : 0x7b5c13, alpha: 0.96 });
      this.rightGraphics.roundRect(confirmButtons.confirm.x, confirmButtons.confirm.y, confirmButtons.confirm.width, confirmButtons.confirm.height, 8)
        .stroke({ width: 2, color: confirmation.kind === 'delete' ? 0xffccbc : DECK_GOLD_GLOW });
      this.rightGraphics.roundRect(confirmButtons.cancel.x, confirmButtons.cancel.y, confirmButtons.cancel.width, confirmButtons.cancel.height, 8)
        .fill({ color: BUTTON_ENABLED, alpha: 0.96 });
      this.rightGraphics.roundRect(confirmButtons.cancel.x, confirmButtons.cancel.y, confirmButtons.cancel.width, confirmButtons.cancel.height, 8)
        .stroke({ width: 2, color: BUTTON_BORDER });

      const confirmLabel = this.actionBtnTexts[3]!;
      confirmLabel.text = confirmation.confirmLabel ?? (confirmation.kind === 'delete' ? '确认删除' : '确认升级');
      confirmLabel.style.fill = TEXT_PRIMARY;
      confirmLabel.position.set(confirmButtons.confirm.x + confirmButtons.confirm.width / 2, confirmButtons.confirm.y + confirmButtons.confirm.height / 2);

      const cancelLabel = this.detailTexts[MAX_SLOTS - 3]!;
      cancelLabel.text = confirmation.cancelLabel ?? '取消';
      cancelLabel.style.fill = TEXT_PRIMARY;
      cancelLabel.style.fontSize = 14;
      cancelLabel.position.set(confirmButtons.cancel.x + confirmButtons.cancel.width / 2 - 18, confirmButtons.cancel.y + 12);
    }
  }
}
