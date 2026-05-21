export type InterLevelNodeKind = 'shop' | 'mystic' | 'skip';

export interface InterLevelCardReward {
  readonly id: string;
  readonly cardId: string;
  readonly title: string;
  readonly description: string;
}

export interface InterLevelGoldReward {
  readonly id: string;
  readonly amount: number;
  readonly title: string;
  readonly description: string;
}

export interface InterLevelUpgradeReward {
  readonly id: string;
  readonly instanceId: string;
  readonly cardId: string;
  readonly title: string;
  readonly description: string;
  readonly targetLevel?: number;
}

export interface InterLevelOffer {
  readonly id: string;
  readonly kind: InterLevelNodeKind;
  readonly title: string;
  readonly description: string;
}

export interface InterLevelState {
  readonly mode?: 'branch' | 'card-reward' | 'gold-reward' | 'upgrade-reward';
  readonly levelIndex: number;
  readonly nextLevel: number;
  readonly gold: number;
  readonly crystalHpLost: number;
  readonly offers: readonly [InterLevelOffer, InterLevelOffer, InterLevelOffer];
  readonly cardRewards?: readonly [InterLevelCardReward, InterLevelCardReward, InterLevelCardReward];
  readonly goldRewards?: readonly [InterLevelGoldReward, InterLevelGoldReward, InterLevelGoldReward];
  readonly upgradeRewards?: readonly [InterLevelUpgradeReward, InterLevelUpgradeReward, InterLevelUpgradeReward];
}

export type InterLevelIntent =
  | { readonly kind: 'enter-node'; readonly offerId: string; readonly node: Exclude<InterLevelNodeKind, 'skip'> }
  | { readonly kind: 'skip' }
  | { readonly kind: 'claim-card-reward'; readonly rewardId: string; readonly cardId: string }
  | { readonly kind: 'claim-gold-reward'; readonly rewardId: string; readonly amount: number }
  | { readonly kind: 'claim-upgrade-reward'; readonly rewardId: string; readonly instanceId: string; readonly cardId: string }
  | { readonly kind: 'invalid'; readonly reason: 'no-such-offer' };

export function resolveInterLevelChoice(state: InterLevelState, offerId: string): InterLevelIntent {
  if ((state.mode ?? 'branch') === 'card-reward') {
    const reward = state.cardRewards?.find((entry) => entry.id === offerId);
    if (!reward) return { kind: 'invalid', reason: 'no-such-offer' };
    return { kind: 'claim-card-reward', rewardId: reward.id, cardId: reward.cardId };
  }
  if ((state.mode ?? 'branch') === 'gold-reward') {
    const reward = state.goldRewards?.find((entry) => entry.id === offerId);
    if (!reward) return { kind: 'invalid', reason: 'no-such-offer' };
    return { kind: 'claim-gold-reward', rewardId: reward.id, amount: reward.amount };
  }
  if ((state.mode ?? 'branch') === 'upgrade-reward') {
    const reward = state.upgradeRewards?.find((entry) => entry.id === offerId);
    if (!reward) return { kind: 'invalid', reason: 'no-such-offer' };
    return { kind: 'claim-upgrade-reward', rewardId: reward.id, instanceId: reward.instanceId, cardId: reward.cardId };
  }
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) return { kind: 'invalid', reason: 'no-such-offer' };
  if (offer.kind === 'skip') return { kind: 'skip' };
  return { kind: 'enter-node', offerId, node: offer.kind };
}

export interface InterLevelLayoutItem extends InterLevelOffer {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface InterLevelLayout {
  readonly headerLabel: string;
  readonly rewardGoldLabel: string;
  readonly crystalLostLabel: string;
  readonly items: readonly InterLevelLayoutItem[];
}

export function layoutInterLevel(state: InterLevelState, viewportWidth: number, viewportHeight: number): InterLevelLayout {
  const mode = state.mode ?? 'branch';
  const cardW = 280;
  const cardH = 320;
  const gap = 40;
  const totalW = cardW * 3 + gap * 2;
  const startX = (viewportWidth - totalW) / 2;
  const y = (viewportHeight - cardH) / 2 + 130;
  const baseItems = mode === 'card-reward'
    ? (state.cardRewards ?? []).map((reward) => ({
      id: reward.id,
      kind: 'skip' as const,
      title: reward.title,
      description: reward.description,
    }))
    : mode === 'gold-reward'
      ? (state.goldRewards ?? []).map((reward) => ({
        id: reward.id,
        kind: 'skip' as const,
        title: reward.title,
        description: reward.description,
      }))
      : mode === 'upgrade-reward'
        ? (state.upgradeRewards ?? []).map((reward) => ({
          id: reward.id,
          kind: 'skip' as const,
          title: reward.targetLevel ? `${reward.title} · 升到 Lv.${reward.targetLevel}` : reward.title,
          description: reward.description,
        }))
    : state.offers;
  return {
    headerLabel: mode === 'card-reward'
      ? `🃏 选择 1 张新卡牌`
      : mode === 'gold-reward'
        ? `💰 选择 1 份金币奖励`
        : mode === 'upgrade-reward'
          ? `⬆ 选择 1 张卡牌升级`
        : `🏆 关卡 ${state.levelIndex} 通过！`,
    rewardGoldLabel: `● 金币 +${state.gold}`,
    crystalLostLabel: state.crystalHpLost > 0 ? `水晶损失 -${state.crystalHpLost} HP` : '水晶无损',
    items: baseItems.map((o, i) => ({
      ...o,
      x: startX + i * (cardW + gap),
      y,
      width: cardW,
      height: cardH,
    })),
  };
}

export function hitTestInterLevel(layout: InterLevelLayout, px: number, py: number): string | null {
  for (const item of layout.items) {
    if (px >= item.x && px <= item.x + item.width && py >= item.y && py <= item.y + item.height) {
      return item.id;
    }
  }
  return null;
}

export type InterLevelHandler = (intent: InterLevelIntent) => void;

export class InterLevelPanel {
  private state: InterLevelState | null = null;
  private handler: InterLevelHandler | null = null;

  setHandler(handler: InterLevelHandler): void {
    this.handler = handler;
  }

  refresh(state: InterLevelState): void {
    this.state = state;
  }

  trigger(offerId: string): void {
    if (!this.state) return;
    const intent = resolveInterLevelChoice(this.state, offerId);
    this.handler?.(intent);
  }
}
