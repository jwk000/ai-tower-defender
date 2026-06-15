import { TowerType, UnitType, type LevelConfig } from '../types/index.js';
import { ENEMY_CONFIGS, TOWER_CONFIGS, UNIT_CONFIGS, UNIT_TYPE_BY_ID } from '../data/gameData.js';
import { LEVELS } from '../data/levels/index.js';
import { assetUrl, unitArtPath } from '../utils/artAssets.js';

type PreviewAction = 'idle' | 'move' | 'attack' | 'death';
type PreviewCategory = 'tower' | 'soldier' | 'enemy';

interface PreviewUnit {
  id: string;
  name: string;
  category: PreviewCategory;
  moveOptional?: boolean;
}

interface PreviewTab {
  id: string;
  label: string;
  units: PreviewUnit[];
}

interface RenderedPreviewCard {
  unit: PreviewUnit;
  image: HTMLImageElement;
  status: HTMLElement;
}

const PREVIEW_ACTIONS: Array<{ id: PreviewAction; label: string }> = [
  { id: 'idle', label: '待机' },
  { id: 'move', label: '移动' },
  { id: 'attack', label: '攻击' },
  { id: 'death', label: '死亡' },
];

const FRAME_INTERVAL_MS = 360;

export class UnitAnimationPreviewWindow {
  private overlay: HTMLElement | null = null;
  private isOpen = false;
  private activeAction: PreviewAction = 'attack';
  private activeTabId = 'tower';
  private frame: 0 | 1 = 0;
  private timerId: number | null = null;
  private tabs: PreviewTab[] = [];
  private tabBar: HTMLElement | null = null;
  private actionBar: HTMLElement | null = null;
  private gridContainer: HTMLElement | null = null;
  private cards: RenderedPreviewCard[] = [];

  show(): void {
    this.hide();
    this.tabs = buildPreviewTabs(LEVELS);
    if (!this.tabs.some((tab) => tab.id === this.activeTabId)) {
      this.activeTabId = this.tabs[0]?.id ?? 'tower';
    }
    this.frame = 0;
    this.isOpen = true;

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 10001;
      background: rgba(8, 10, 16, 0.72);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    `;
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    const modal = document.createElement('div');
    modal.style.cssText = `
      width: min(1040px, 96vw);
      height: min(760px, 90vh);
      background: #1e1e2e;
      border: 1px solid #3a3a4a;
      border-radius: 8px;
      box-shadow: 0 14px 42px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    modal.appendChild(this.createTitleBar());
    this.actionBar = this.createActionBar();
    modal.appendChild(this.actionBar);
    this.tabBar = this.createTabBar();
    modal.appendChild(this.tabBar);

    this.gridContainer = document.createElement('div');
    this.gridContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      background: #171724;
    `;
    modal.appendChild(this.gridContainer);

    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);
    this.renderTabs();
    this.renderActions();
    this.renderGrid();
    this.startTimer();
  }

  hide(): void {
    this.stopTimer();
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.cards = [];
    this.isOpen = false;
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  destroy(): void {
    this.hide();
  }

  private createTitleBar(): HTMLElement {
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #1a1a2e;
      border-bottom: 1px solid #3a3a4a;
      min-height: 44px;
      box-sizing: border-box;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'color: #f0f0f4; font-size: 15px; font-weight: 700;';
    title.textContent = '单位动作预览';
    titleBar.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.title = '关闭 (Esc)';
    closeButton.style.cssText = `
      min-width: 44px;
      min-height: 44px;
      background: transparent;
      border: 0;
      color: #a0a0b0;
      font-size: 20px;
      cursor: pointer;
      border-radius: 6px;
    `;
    closeButton.addEventListener('click', () => this.hide());
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#3a3a4a';
      closeButton.style.color = '#f0f0f4';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'transparent';
      closeButton.style.color = '#a0a0b0';
    });
    titleBar.appendChild(closeButton);

    return titleBar;
  }

  private createActionBar(): HTMLElement {
    const actionBar = document.createElement('div');
    actionBar.style.cssText = `
      display: flex;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid #2a2a3a;
      background: #202033;
      flex-wrap: wrap;
    `;
    return actionBar;
  }

  private createTabBar(): HTMLElement {
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `
      display: flex;
      gap: 6px;
      padding: 10px 14px;
      border-bottom: 1px solid #2a2a3a;
      background: #1b1b2a;
      overflow-x: auto;
      min-height: 54px;
      box-sizing: border-box;
    `;
    return tabBar;
  }

  private renderActions(): void {
    if (!this.actionBar) return;
    this.actionBar.innerHTML = '';

    for (const action of PREVIEW_ACTIONS) {
      const button = document.createElement('button');
      button.textContent = action.label;
      button.style.cssText = this.segmentButtonStyle(action.id === this.activeAction);
      button.addEventListener('click', () => {
        this.activeAction = action.id;
        this.frame = 0;
        this.renderActions();
        this.updateCardFrames();
      });
      this.actionBar.appendChild(button);
    }
  }

  private renderTabs(): void {
    if (!this.tabBar) return;
    this.tabBar.innerHTML = '';

    for (const tab of this.tabs) {
      const button = document.createElement('button');
      button.textContent = `${tab.label} ${tab.units.length}`;
      button.style.cssText = this.tabButtonStyle(tab.id === this.activeTabId);
      button.addEventListener('click', () => {
        this.activeTabId = tab.id;
        this.renderTabs();
        this.renderGrid();
      });
      this.tabBar.appendChild(button);
    }
  }

  private renderGrid(): void {
    if (!this.gridContainer) return;
    this.gridContainer.innerHTML = '';
    this.cards = [];

    const tab = this.tabs.find((item) => item.id === this.activeTabId);
    if (!tab || tab.units.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: #a0a0b0; font-size: 14px; padding: 24px;';
      empty.textContent = '当前分页没有单位';
      this.gridContainer.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
      gap: 12px;
    `;

    for (const unit of tab.units) {
      const card = this.createUnitCard(unit);
      grid.appendChild(card);
    }

    this.gridContainer.appendChild(grid);
    this.updateCardFrames();
  }

  private createUnitCard(unit: PreviewUnit): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = `
      min-height: 166px;
      background: #242438;
      border: 1px solid #38384d;
      border-radius: 8px;
      padding: 10px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    const stage = document.createElement('div');
    stage.style.cssText = `
      height: 92px;
      border-radius: 6px;
      background: #151520;
      border: 1px solid #303044;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    `;

    const image = document.createElement('img');
    image.alt = unit.name;
    image.style.cssText = `
      width: 76px;
      height: 76px;
      object-fit: contain;
      image-rendering: auto;
      transition: transform 0.12s ease;
    `;
    stage.appendChild(image);
    card.appendChild(stage);

    const name = document.createElement('div');
    name.style.cssText = `
      color: #f0f0f4;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    name.textContent = unit.name;
    card.appendChild(name);

    const id = document.createElement('div');
    id.style.cssText = `
      color: #8f90a6;
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    id.textContent = unit.id;
    card.appendChild(id);

    const status = document.createElement('div');
    status.style.cssText = `
      min-height: 16px;
      color: #66bb6a;
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    card.appendChild(status);

    this.cards.push({ unit, image, status });
    return card;
  }

  private updateCardFrames(): void {
    for (const card of this.cards) {
      const action = this.activeAction;
      const wanted = unitArtPath(card.unit.id, action, this.frame);
      const fallback = unitArtPath(card.unit.id, 'idle', this.frame);
      card.image.src = assetUrl(wanted);
      card.image.style.transform = action === 'attack' && this.frame === 1 ? 'scale(1.08)' : 'scale(1)';
      card.status.textContent = `${action}_${this.frame}`;
      card.status.style.color = '#66bb6a';

      card.image.onerror = () => {
        card.image.onerror = null;
        card.image.src = assetUrl(fallback);
        const expectedMissing = card.unit.moveOptional && action === 'move';
        card.status.textContent = expectedMissing ? '建筑无移动帧' : `缺 ${action}_${this.frame}`;
        card.status.style.color = expectedMissing ? '#8f90a6' : '#ffb74d';
      };
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerId = window.setInterval(() => {
      this.frame = this.frame === 0 ? 1 : 0;
      this.updateCardFrames();
    }, FRAME_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private segmentButtonStyle(active: boolean): string {
    return `
      min-width: 72px;
      min-height: 44px;
      padding: 8px 14px;
      border: 1px solid ${active ? '#64b5f6' : '#3a3a4a'};
      border-radius: 6px;
      background: ${active ? '#1565c0' : '#2a2a3a'};
      color: #f0f0f4;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    `;
  }

  private tabButtonStyle(active: boolean): string {
    return `
      min-width: 88px;
      min-height: 36px;
      padding: 7px 12px;
      border: 1px solid ${active ? '#7e57c2' : '#3a3a4a'};
      border-radius: 6px;
      background: ${active ? '#4527a0' : '#2a2a3a'};
      color: #f0f0f4;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
    `;
  }
}

export function buildPreviewTabs(levels: readonly LevelConfig[] = LEVELS): PreviewTab[] {
  const towerUnits: PreviewUnit[] = Object.values(TowerType).map((type) => ({
    id: `tower_${type}`,
    name: TOWER_CONFIGS[type]?.name ?? type,
    category: 'tower',
    moveOptional: true,
  }));

  const soldierUnits: PreviewUnit[] = UNIT_TYPE_BY_ID.map((type) => ({
    id: type,
    name: UNIT_CONFIGS[type]?.name ?? type,
    category: 'soldier',
  }));

  const tabs: PreviewTab[] = [
    { id: 'tower', label: '塔', units: towerUnits },
    { id: 'soldier', label: '士兵', units: soldierUnits },
  ];

  levels.forEach((level, index) => {
    const seen = new Set<string>();
    const units: PreviewUnit[] = [];
    for (const wave of level.waves) {
      for (const group of wave.enemies) {
        if (seen.has(group.enemyType)) continue;
        seen.add(group.enemyType);
        const config = ENEMY_CONFIGS[group.enemyType];
        units.push({
          id: `enemy_${group.enemyType}`,
          name: config?.name ?? group.enemyType,
          category: 'enemy',
        });
      }
    }
    tabs.push({ id: `level-${level.id}`, label: `第 ${index + 1} 关敌人`, units });
  });

  return tabs;
}
