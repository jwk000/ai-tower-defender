import type { PendingCardReward, PendingGoldReward, PendingRelicReward, PendingUpgradeReward } from '../unit-system/RunManager.js';
import type { ActivePassiveSource } from './passives.js';

export interface RelicSnapshot {
  readonly id: string;
  readonly relicId: string;
  readonly title: string;
  readonly description: string;
  readonly category: 'economy' | 'energy' | 'summon' | 'spell' | 'defense';
}

export interface CardLevelConfig {
  readonly cardId: string;
  readonly level: number;
}

export interface RunSnapshot {
  readonly version: 6;
  readonly savedAt: number;
  readonly phase: 'LevelMap' | 'InterLevel';
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
  readonly pendingCardReward: PendingCardReward | null;
  readonly pendingGoldReward: PendingGoldReward | null;
  readonly pendingRelicReward: PendingRelicReward | null;
  readonly pendingUpgradeReward: PendingUpgradeReward | null;
  readonly relics: readonly RelicSnapshot[];
  readonly passiveSources: readonly ActivePassiveSource[];
  readonly cardLevels: readonly CardLevelConfig[];
  readonly deck: {
    readonly drawPile: string[];
    readonly discardPile: string[];
    readonly drawPileInstances?: string[];
    readonly discardPileInstances?: string[];
  };
}

const STORAGE_KEY = 'td_run_v6';

export const SaveSystem = {
  hasSavedRun(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  },

  loadRun(): RunSnapshot | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as RunSnapshot;
        if (parsed.version !== 6) return null;
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  },

  saveRun(snapshot: RunSnapshot): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  },

  clearRun(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
