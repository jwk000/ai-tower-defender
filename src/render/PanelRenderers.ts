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
import { layoutSkillTree, type SkillTreePanel, type SkillTreeState } from '../ui/SkillTreePanel.js';
import {
  hitTestLevelMap,
  layoutLevelMap,
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
      label.text = b.label;
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
      this.cardsGraphics.rect(item.x, item.y, item.width, item.height).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
      this.cardsGraphics.rect(item.x, item.y, item.width, item.height).stroke({ width: 2, color: BUTTON_BORDER });
      const title = this.cardTitleTexts[i]!;
      title.text = item.title;
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
const NODE_PURCHASED = 0x1b5e20;
const NODE_AFFORDABLE = 0x1565c0;
const NODE_LOCKED = 0x37474f;

export class ShopRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly itemsGraphics: Graphics;
  private readonly headerText: Text;
  private readonly goldText: Text;
  private readonly closeText: Text;
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
    this.itemsGraphics = new Graphics();
    this.headerText = new Text({ text: 'Shop', style: { fill: TITLE_COLOR, fontSize: 32, fontWeight: 'bold', align: 'center' } });
    this.headerText.anchor.set(0.5, 0.5);
    this.goldText = new Text({ text: '', style: { fill: GOLD_COLOR, fontSize: 22 } });
    this.goldText.anchor.set(0.5, 0.5);
    this.closeText = new Text({ text: 'Leave Shop', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
    this.closeText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.headerText, this.goldText, this.itemsGraphics, this.closeText);
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
    const h = 56;
    return { x: (this.viewportWidth - w) / 2, y: this.viewportHeight - 100, w, h };
  }

  private itemRect(index: number) {
    const itemW = 240;
    const itemH = 120;
    const colGap = 16;
    const rowGap = 20;
    const cols = 4;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const totalW = cols * itemW + (cols - 1) * colGap;
    const startX = (this.viewportWidth - totalW) / 2;
    const startY = 150;
    return { x: startX + col * (itemW + colGap), y: startY + row * (itemH + rowGap), w: itemW, h: itemH };
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const local = this.container.toLocal(e.global);
    const cb = this.closeBtn;
    if (local.x >= cb.x && local.x <= cb.x + cb.w && local.y >= cb.y && local.y <= cb.y + cb.h) {
      this.panel.triggerClose();
      return;
    }
    for (let i = 0; i < this.state.items.length; i += 1) {
      const r = this.itemRect(i);
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

    this.headerText.position.set(this.viewportWidth / 2, 60);
    this.goldText.text = `Gold: ${this.state.gold}  SP: ${this.state.sp}`;
    this.goldText.position.set(this.viewportWidth / 2, 110);

    this.itemsGraphics.clear();
    while (this.itemLabelTexts.length < this.state.items.length) {
      const lbl = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 18, fontWeight: 'bold' } });
      const cost = new Text({ text: '', style: { fill: GOLD_COLOR, fontSize: 16 } });
      this.container.addChild(lbl, cost);
      this.itemLabelTexts.push(lbl);
      this.itemCostTexts.push(cost);
    }
    for (let i = 0; i < this.state.items.length; i += 1) {
      const item = this.state.items[i]!;
      const r = this.itemRect(i);
      const canBuy = this.state.gold >= item.costGold && item.stock > 0;
      const fillColor = canBuy ? BUTTON_ENABLED : BUTTON_DISABLED;
      const borderColor = canBuy ? BUTTON_BORDER : BUTTON_BORDER_DISABLED;
      this.itemsGraphics.rect(r.x, r.y, r.w, r.h).fill({ color: fillColor, alpha: 0.95 });
      this.itemsGraphics.rect(r.x, r.y, r.w, r.h).stroke({ width: 2, color: borderColor });
      this.itemLabelTexts[i]!.text = item.label;
      this.itemLabelTexts[i]!.position.set(r.x + 16, r.y + 16);
      this.itemCostTexts[i]!.text = `${item.costGold}G  (stock: ${item.stock})`;
      this.itemCostTexts[i]!.position.set(r.x + 16, r.y + 52);
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

export class SkillTreeRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly nodesGraphics: Graphics;
  private readonly headerText: Text;
  private readonly spText: Text;
  private readonly closeText: Text;
  private readonly nodeLabelTexts: Text[] = [];
  private readonly nodeDescTexts: Text[] = [];
  private readonly nodeCostTexts: Text[] = [];
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly panel: SkillTreePanel;
  private state: SkillTreeState | null = null;

  constructor(config: PanelRendererConfig, panel: SkillTreePanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.nodesGraphics = new Graphics();
    this.headerText = new Text({ text: '', style: { fill: TITLE_COLOR, fontSize: 28, fontWeight: 'bold', align: 'center' } });
    this.headerText.anchor.set(0.5, 0.5);
    this.spText = new Text({ text: '', style: { fill: SP_COLOR, fontSize: 22 } });
    this.spText.anchor.set(0.5, 0.5);
    this.closeText = new Text({ text: 'Exit Skill Tree', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
    this.closeText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.headerText, this.spText, this.nodesGraphics, this.closeText);
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
    if (this.state) this.render();
  }

  refresh(state: SkillTreeState): void {
    this.state = state;
    this.panel.refresh(state);
    this.render();
  }

  private get closeBtn() {
    const w = 260;
    const h = 56;
    return { x: (this.viewportWidth - w) / 2, y: this.viewportHeight - 100, w, h };
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.state) return;
    const local = this.container.toLocal(e.global);
    const cb = this.closeBtn;
    if (local.x >= cb.x && local.x <= cb.x + cb.w && local.y >= cb.y && local.y <= cb.y + cb.h) {
      this.panel.triggerExit();
      return;
    }
    const layout = layoutSkillTree(this.state, this.viewportWidth, this.viewportHeight);
    for (const node of layout.nodes) {
      if (local.x >= node.x && local.x <= node.x + node.width && local.y >= node.y && local.y <= node.y + node.height) {
        this.panel.triggerUnlock(node.id);
        return;
      }
    }
  }

  private render(): void {
    if (!this.state) return;
    const layout = layoutSkillTree(this.state, this.viewportWidth, this.viewportHeight);
    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: DIM_BG, alpha: 0.95 });

    this.headerText.text = layout.headerLabel;
    this.headerText.position.set(this.viewportWidth / 2, 60);
    this.spText.text = layout.spLabel;
    this.spText.position.set(this.viewportWidth / 2, 110);

    this.nodesGraphics.clear();
    while (this.nodeLabelTexts.length < layout.nodes.length) {
      const lbl = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 18, fontWeight: 'bold' } });
      const desc = new Text({ text: '', style: { fill: TEXT_DIM, fontSize: 14, wordWrap: true, wordWrapWidth: 240 } });
      const cost = new Text({ text: '', style: { fill: SP_COLOR, fontSize: 15 } });
      this.container.addChild(lbl, desc, cost);
      this.nodeLabelTexts.push(lbl);
      this.nodeDescTexts.push(desc);
      this.nodeCostTexts.push(cost);
    }
    for (let i = 0; i < layout.nodes.length; i += 1) {
      const node = layout.nodes[i]!;
      const fillColor = node.purchased ? NODE_PURCHASED : node.affordable ? NODE_AFFORDABLE : NODE_LOCKED;
      const borderColor = node.purchased ? 0x69f0ae : node.affordable ? BUTTON_BORDER : BUTTON_BORDER_DISABLED;
      this.nodesGraphics.rect(node.x, node.y, node.width, node.height).fill({ color: fillColor, alpha: 0.95 });
      this.nodesGraphics.rect(node.x, node.y, node.width, node.height).stroke({ width: 2, color: borderColor });
      this.nodeLabelTexts[i]!.text = node.purchased ? `✓ ${node.label}` : node.label;
      this.nodeLabelTexts[i]!.position.set(node.x + 16, node.y + 16);
      this.nodeDescTexts[i]!.text = node.description;
      this.nodeDescTexts[i]!.position.set(node.x + 16, node.y + 52);
      this.nodeCostTexts[i]!.text = node.purchased ? 'Purchased' : `${node.costSP} SP`;
      this.nodeCostTexts[i]!.position.set(node.x + 16, node.y + 140);
    }

    const cb = this.closeBtn;
    this.nodesGraphics.rect(cb.x, cb.y, cb.w, cb.h).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
    this.nodesGraphics.rect(cb.x, cb.y, cb.w, cb.h).stroke({ width: 2, color: BUTTON_BORDER });
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
  private readonly nodeLabelTexts: Text[] = [];
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
    this.challengeText = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 20, align: 'center' } });
    this.challengeText.anchor.set(0.5, 0.5);
    this.viewDeckText = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 16, align: 'center' } });
    this.viewDeckText.anchor.set(0.5, 0.5);
    this.backBtnText = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 16, align: 'center' } });
    this.backBtnText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.pathGraphics, this.nodesGraphics, this.challengeGraphics, this.viewDeckGraphics, this.backBtnGraphics, this.hudText, this.goldText, this.crystalText, this.challengeText, this.viewDeckText, this.backBtnText);
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

    this.bg.clear();
    this.bg.rect(0, 0, this.viewportWidth, this.viewportHeight).fill({ color: 0x0d1b2a, alpha: 1 });

    this.hudText.text = layout.hudLabel;
    this.hudText.position.set(30, 18);
    this.crystalText.text = layout.crystalLabel;
    this.crystalText.position.set(this.viewportWidth / 2 - 120, 18);
    this.goldText.text = layout.goldLabel;
    this.goldText.position.set(this.viewportWidth / 2 + 40, 18);

    this.pathGraphics.clear();
    for (let i = 0; i < layout.nodes.length - 1; i += 1) {
      const a = layout.nodes[i]!;
      const b = layout.nodes[i + 1]!;
      const ax = a.x + a.width;
      const ay = a.y + a.height / 2;
      const bx = b.x;
      const by = b.y + b.height / 2;
      const isDone = a.status === 'completed';
      this.pathGraphics.moveTo(ax, ay).lineTo(bx, by).stroke({ width: 4, color: isDone ? PATH_DONE : PATH_FUTURE });
    }

    this.nodesGraphics.clear();
    while (this.nodeLabelTexts.length < layout.nodes.length) {
      const lbl = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 14, fontWeight: 'bold', align: 'center' } });
      lbl.anchor.set(0.5, 0.5);
      this.container.addChild(lbl);
      this.nodeLabelTexts.push(lbl);
    }
    for (let i = layout.nodes.length; i < this.nodeLabelTexts.length; i += 1) {
      this.nodeLabelTexts[i]!.text = '';
    }
    for (let i = 0; i < layout.nodes.length; i += 1) {
      const n = layout.nodes[i]!;
      const fill = n.status === 'completed' ? NODE_COMPLETED : n.status === 'current' ? NODE_CURRENT : NODE_LOCKED_COLOR;
      const border = n.status === 'completed' ? 0x69f0ae : n.status === 'current' ? 0x90caf9 : PATH_FUTURE;
      const radius = n.isBoss ? 0 : 8;
      this.nodesGraphics.roundRect(n.x, n.y, n.width, n.height, radius).fill({ color: fill, alpha: 0.95 });
      this.nodesGraphics.roundRect(n.x, n.y, n.width, n.height, radius).stroke({ width: n.status === 'current' ? 3 : 2, color: border });
      const lbl = this.nodeLabelTexts[i]!;
      lbl.text = n.status === 'completed' ? `✓ ${n.label}` : n.label;
      lbl.style.fill = n.status === 'locked' ? TEXT_DIM : TEXT_PRIMARY;
      lbl.position.set(n.x + n.width / 2, n.y + n.height / 2);
    }

    this.challengeGraphics.clear();
    const btn = layout.challengeBtn;
    this.challengeGraphics.rect(btn.x, btn.y, btn.width, btn.height).fill({ color: BUTTON_ENABLED, alpha: 0.95 });
    this.challengeGraphics.rect(btn.x, btn.y, btn.width, btn.height).stroke({ width: 2, color: BUTTON_BORDER });
    this.challengeText.text = btn.label;
    this.challengeText.position.set(btn.x + btn.width / 2, btn.y + btn.height / 2);

    this.viewDeckGraphics.clear();
    const vdb = layout.viewDeckBtn;
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

export class DeckViewRenderer {
  private readonly container: Container;
  private readonly bg: Graphics;
  private readonly cardGraphics: Graphics;
  private readonly titleText: Text;
  private readonly closeText: Text;
  private readonly cardLabels: Text[] = [];
  private viewportWidth: number;
  private viewportHeight: number;
  private readonly panel: DeckViewPanel;
  private state: DeckViewState | null = null;

  private readonly CLOSE_BTN = { x: 0, y: 0, w: 100, h: 38 };

  constructor(config: PanelRendererConfig, panel: DeckViewPanel) {
    this.container = config.container;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.panel = panel;

    this.bg = new Graphics();
    this.cardGraphics = new Graphics();
    this.titleText = new Text({ text: '📚 本局卡组', style: { fill: TITLE_COLOR, fontSize: 22, fontWeight: 'bold' } });
    this.closeText = new Text({ text: '✕ 关闭', style: { fill: TEXT_PRIMARY, fontSize: 15 } });
    this.closeText.anchor.set(0.5, 0.5);

    this.container.addChild(this.bg, this.cardGraphics, this.titleText, this.closeText);
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));

    this.updateCloseBtnPos();
  }

  private updateCloseBtnPos(): void {
    this.CLOSE_BTN.x = this.viewportWidth - 120;
    this.CLOSE_BTN.y = 16;
  }

  private isCloseBtnHit(px: number, py: number): boolean {
    const b = this.CLOSE_BTN;
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    const local = this.container.toLocal(e.global);
    if (this.isCloseBtnHit(local.x, local.y)) {
      this.panel.trigger('close');
    }
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
    this.updateCloseBtnPos();
    if (this.state) this.render();
  }

  refresh(state: DeckViewState): void {
    this.state = state;
    this.panel.refresh(state);
    this.render();
  }

  private render(): void {
    if (!this.state) return;
    const vw = this.viewportWidth;
    const vh = this.viewportHeight;

    this.bg.clear();
    this.bg.rect(0, 0, vw, vh).fill({ color: 0x0d1b2a, alpha: 0.96 });

    this.titleText.position.set(30, 20);

    const b = this.CLOSE_BTN;
    this.cardGraphics.clear();
    this.cardGraphics.roundRect(b.x, b.y, b.w, b.h, 6).fill({ color: 0x5d1a1a, alpha: 0.92 });
    this.cardGraphics.roundRect(b.x, b.y, b.w, b.h, 6).stroke({ width: 2, color: 0xff5252 });
    this.closeText.position.set(b.x + b.w / 2, b.y + b.h / 2);

    const cards = this.state.cardIds;
    const CARD_W = 140;
    const CARD_H = 56;
    const COLS = Math.max(1, Math.floor((vw - 60) / (CARD_W + 12)));
    const startX = 30;
    const startY = 80;

    while (this.cardLabels.length < cards.length) {
      const lbl = new Text({ text: '', style: { fill: TEXT_PRIMARY, fontSize: 13 } });
      this.container.addChild(lbl);
      this.cardLabels.push(lbl);
    }
    for (let i = cards.length; i < this.cardLabels.length; i++) {
      this.cardLabels[i]!.text = '';
    }

    const counts = new Map<string, number>();
    for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
    const unique = [...counts.entries()];

    for (let i = unique.length; i < this.cardLabels.length; i++) {
      this.cardLabels[i]!.text = '';
    }

    for (let i = 0; i < unique.length; i++) {
      const [cardId, count] = unique[i]!;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = startX + col * (CARD_W + 12);
      const cy = startY + row * (CARD_H + 10);
      this.cardGraphics.roundRect(cx, cy, CARD_W, CARD_H, 6).fill({ color: BUTTON_ENABLED, alpha: 0.92 });
      this.cardGraphics.roundRect(cx, cy, CARD_W, CARD_H, 6).stroke({ width: 2, color: BUTTON_BORDER });
      const lbl = this.cardLabels[i]!;
      lbl.text = count > 1 ? `${cardId}\n×${count}` : cardId;
      lbl.position.set(cx + 8, cy + 8);
    }
  }
}
