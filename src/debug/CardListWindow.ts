// ============================================================
// CardListWindow — 调试用卡牌列表窗口
//
// 显示所有可用卡牌，点击可将卡牌添加到手牌中。
// ============================================================

import type { CardInstance } from '../systems/HandSystem.js';

/** 卡牌类型配置 */
const CARD_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  unit: { label: '单位', color: '#4fc3f7' },
  spell: { label: '技能', color: '#ff7043' },
  trap: { label: '机关', color: '#66bb6a' },
  arcane: { label: '奥术', color: '#ab47bc' },
  production: { label: '生产', color: '#ffa726' },
};

export class CardListWindow {
  private overlay: HTMLElement | null = null;
  private isOpen = false;
  private onCardSelected: ((card: CardInstance) => void) | null = null;

  /** 设置卡牌选中回调 */
  setOnCardSelected(cb: (card: CardInstance) => void): void {
    this.onCardSelected = cb;
  }

  /** 显示卡牌列表窗口 */
  show(cards: CardInstance[]): void {
    if (this.overlay) {
      this.overlay.remove();
    }

    this.isOpen = true;

    // 遮罩层
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // 主窗口
    const modal = document.createElement('div');
    modal.style.cssText = `
      width: 700px;
      max-height: 80vh;
      background: #1e1e2e;
      border: 1px solid #3a3a4a;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    // 标题栏
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #1a1a2e;
      border-bottom: 1px solid #3a3a4a;
      border-radius: 12px 12px 0 0;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'color: #e0e0e0; font-size: 15px; font-weight: bold;';
    title.textContent = `🃏 全部卡牌 (${cards.length})`;
    titleBar.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.title = '关闭 (Esc)';
    closeButton.style.cssText = `
      background: none;
      border: none;
      color: #a0a0b0;
      font-size: 16px;
      cursor: pointer;
      padding: 5px 10px;
      border-radius: 4px;
    `;
    closeButton.addEventListener('click', () => this.hide());
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#3a3a4a';
      closeButton.style.color = '#e0e0e0';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'none';
      closeButton.style.color = '#a0a0b0';
    });
    titleBar.appendChild(closeButton);
    modal.appendChild(titleBar);

    // 提示文字
    const hint = document.createElement('div');
    hint.style.cssText = `
      padding: 8px 16px;
      color: #a0a0b0;
      font-size: 12px;
      border-bottom: 1px solid #2a2a3a;
    `;
    hint.textContent = '点击卡牌即可添加到手牌（手牌上限 4 张）';
    modal.appendChild(hint);

    // 卡牌网格容器
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    `;

    // 按类型分组
    const groups = new Map<string, CardInstance[]>();
    for (const card of cards) {
      const type = card.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(card);
    }

    // 渲染每个分组
    for (const [type, typeCards] of groups) {
      const config = CARD_TYPE_CONFIG[type] ?? { label: type, color: '#888' };

      const groupLabel = document.createElement('div');
      groupLabel.style.cssText = `
        color: ${config.color};
        font-size: 13px;
        font-weight: bold;
        padding: 8px 4px 4px;
        margin-top: 8px;
      `;
      groupLabel.textContent = `${config.label}（${typeCards.length}）`;
      gridContainer.appendChild(groupLabel);

      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 8px;
        padding: 4px 0;
      `;

      for (const card of typeCards) {
        const cardEl = this.createCardElement(card, config.color);
        grid.appendChild(cardEl);
      }

      gridContainer.appendChild(grid);
    }

    modal.appendChild(gridContainer);
    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);
  }

  /** 创建单个卡牌元素 */
  private createCardElement(card: CardInstance, typeColor: string): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      background: #2a2a3a;
      border: 1px solid #3a3a4a;
      border-left: 3px solid ${typeColor};
      border-radius: 6px;
      padding: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
    `;

    const nameEl = document.createElement('div');
    nameEl.style.cssText = `
      color: #e0e0e0;
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 4px;
    `;
    nameEl.textContent = card.name;
    el.appendChild(nameEl);

    const descEl = document.createElement('div');
    descEl.style.cssText = `
      color: #a0a0b0;
      font-size: 11px;
      line-height: 1.3;
    `;
    descEl.textContent = card.description;
    el.appendChild(descEl);

    // 悬停效果
    el.addEventListener('mouseenter', () => {
      el.style.background = '#3a3a4a';
      el.style.borderColor = typeColor;
    });
    el.addEventListener('mouseleave', () => {
      el.style.background = '#2a2a3a';
      el.style.borderColor = '#3a3a4a';
      el.style.borderLeftColor = typeColor;
    });

    // 点击添加卡牌
    el.addEventListener('click', () => {
      console.log('[CardListWindow] card clicked:', card.id, card.name, 'hasCallback:', !!this.onCardSelected);
      this.onCardSelected?.(card);
      // 添加成功反馈
      el.style.background = '#2e7d32';
      const origName = nameEl.textContent;
      nameEl.textContent = '✅ 已添加';
      setTimeout(() => {
        el.style.background = '#2a2a3a';
        nameEl.textContent = origName;
      }, 800);
    });

    return el;
  }

  /** 隐藏窗口 */
  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.isOpen = false;
  }

  /** 是否打开中 */
  getIsOpen(): boolean {
    return this.isOpen;
  }

  /** 销毁 */
  destroy(): void {
    this.hide();
  }
}
