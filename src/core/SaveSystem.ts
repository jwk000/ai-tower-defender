import type { PendingCardReward, PendingGoldReward, PendingRelicReward, PendingUpgradeReward } from '../unit-system/RunManager.js';

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
  readonly version: 5;
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
  readonly cardLevels: readonly CardLevelConfig[];
  readonly deck: {
    readonly drawPile: string[];
    readonly discardPile: string[];
    readonly drawPileInstances?: string[];
    readonly discardPileInstances?: string[];
  };
}

export interface RunSnapshotV4 {
  readonly version: 4;
  readonly savedAt: number;
  readonly phase: 'LevelMap' | 'InterLevel';
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
  readonly pendingCardReward: PendingCardReward | null;
  readonly pendingGoldReward: PendingGoldReward | null;
  readonly pendingUpgradeReward: PendingUpgradeReward | null;
  readonly cardLevels: readonly CardLevelConfig[];
  readonly deck: {
    readonly drawPile: string[];
    readonly discardPile: string[];
    readonly drawPileInstances?: string[];
    readonly discardPileInstances?: string[];
  };
}

export interface RunSnapshotV3 {
  readonly version: 3;
  readonly savedAt: number;
  readonly phase: 'LevelMap' | 'InterLevel';
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
  readonly pendingCardReward: PendingCardReward | null;
  readonly pendingGoldReward: PendingGoldReward | null;
  readonly pendingUpgradeReward: PendingUpgradeReward | null;
  readonly deck: {
    readonly drawPile: string[];
    readonly discardPile: string[];
    readonly drawPileInstances?: string[];
    readonly discardPileInstances?: string[];
  };
}

export interface RunSnapshotV2 {
  readonly version: 2;
  readonly savedAt: number;
  readonly phase: 'LevelMap' | 'InterLevel';
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly skillPoints: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
  readonly skillTree: unknown;
  readonly pendingCardReward: PendingCardReward | null;
  readonly pendingGoldReward: PendingGoldReward | null;
  readonly pendingUpgradeReward: PendingUpgradeReward | null;
  readonly deck: {
    readonly drawPile: string[];
    readonly discardPile: string[];
    readonly drawPileInstances?: string[];
    readonly discardPileInstances?: string[];
  };
}

export interface RunSnapshotV1 {
  readonly version: 1;
  readonly savedAt: number;
  readonly phase: 'LevelMap';
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly skillPoints: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
  readonly skillTreeUnlocked: string[];
  readonly deck: {
    readonly drawPile: string[];
    readonly discardPile: string[];
  };
}

const STORAGE_KEY = 'td_run_v5';
const LEGACY_KEY_V4 = 'td_run_v4';
const LEGACY_KEY_V3 = 'td_run_v3';
const LEGACY_KEY_V2 = 'td_run_v2';
const LEGACY_KEY_V1 = 'td_run_v1';
const LEGACY_KEY = 'td_ongoing_run';

function migrateV4ToV5(v4: RunSnapshotV4): RunSnapshot {
  return {
    version: 5,
    savedAt: v4.savedAt,
    phase: v4.phase,
    currentLevelIdx: v4.currentLevelIdx,
    gold: v4.gold,
    crystalHp: v4.crystalHp,
    crystalHpMax: v4.crystalHpMax,
    pendingCardReward: v4.pendingCardReward,
    pendingGoldReward: v4.pendingGoldReward,
    pendingRelicReward: null,
    pendingUpgradeReward: v4.pendingUpgradeReward,
    relics: [],
    cardLevels: v4.cardLevels,
    deck: v4.deck,
  };
}

function migrateV3ToV5(v3: RunSnapshotV3): RunSnapshot {
  return {
    version: 5,
    savedAt: v3.savedAt,
    phase: v3.phase,
    currentLevelIdx: v3.currentLevelIdx,
    gold: v3.gold,
    crystalHp: v3.crystalHp,
    crystalHpMax: v3.crystalHpMax,
    pendingCardReward: v3.pendingCardReward,
    pendingGoldReward: v3.pendingGoldReward,
    pendingRelicReward: null,
    pendingUpgradeReward: v3.pendingUpgradeReward,
    relics: [],
    cardLevels: [],
    deck: v3.deck,
  };
}

function migrateV2ToV5(v2: RunSnapshotV2): RunSnapshot {
  return {
    version: 5,
    savedAt: v2.savedAt,
    phase: v2.phase,
    currentLevelIdx: v2.currentLevelIdx,
    gold: v2.gold,
    crystalHp: v2.crystalHp,
    crystalHpMax: v2.crystalHpMax,
    pendingCardReward: v2.pendingCardReward,
    pendingGoldReward: v2.pendingGoldReward,
    pendingRelicReward: null,
    pendingUpgradeReward: v2.pendingUpgradeReward,
    relics: [],
    cardLevels: [],
    deck: v2.deck,
  };
}

function migrateV1ToV5(v1: RunSnapshotV1): RunSnapshot {
  return {
    version: 5,
    savedAt: v1.savedAt,
    phase: v1.phase,
    currentLevelIdx: v1.currentLevelIdx,
    gold: v1.gold,
    crystalHp: v1.crystalHp,
    crystalHpMax: v1.crystalHpMax,
    pendingCardReward: null,
    pendingGoldReward: null,
    pendingRelicReward: null,
    pendingUpgradeReward: null,
    relics: [],
    cardLevels: [],
    deck: v1.deck,
  };
}

export const SaveSystem = {
  hasSavedRun(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null
      || localStorage.getItem(LEGACY_KEY_V4) !== null
      || localStorage.getItem(LEGACY_KEY_V3) !== null
      || localStorage.getItem(LEGACY_KEY_V2) !== null
      || localStorage.getItem(LEGACY_KEY_V1) !== null;
  },

  loadRun(): RunSnapshot | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as RunSnapshot;
        if (parsed.version !== 5) return null;
        return parsed;
      } catch {
        return null;
      }
    }
    const rawV4 = localStorage.getItem(LEGACY_KEY_V4);
    if (rawV4) {
      try {
        const parsed = JSON.parse(rawV4) as RunSnapshotV4;
        if (parsed.version !== 4) return null;
        return migrateV4ToV5(parsed);
      } catch {
        return null;
      }
    }
    const rawV3 = localStorage.getItem(LEGACY_KEY_V3);
    if (rawV3) {
      try {
        const parsed = JSON.parse(rawV3) as RunSnapshotV3;
        if (parsed.version !== 3) return null;
        return migrateV3ToV5(parsed);
      } catch {
        return null;
      }
    }
    const rawV2 = localStorage.getItem(LEGACY_KEY_V2);
    if (rawV2) {
      try {
        const parsed = JSON.parse(rawV2) as RunSnapshotV2;
        if (parsed.version !== 2) return null;
        return migrateV2ToV5(parsed);
      } catch {
        return null;
      }
    }
    const rawV1 = localStorage.getItem(LEGACY_KEY_V1);
    if (rawV1) {
      try {
        const parsed = JSON.parse(rawV1) as RunSnapshotV1;
        if (parsed.version !== 1) return null;
        return migrateV1ToV5(parsed);
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
    localStorage.removeItem(LEGACY_KEY_V4);
    localStorage.removeItem(LEGACY_KEY_V3);
    localStorage.removeItem(LEGACY_KEY_V2);
    localStorage.removeItem(LEGACY_KEY_V1);
    localStorage.removeItem(LEGACY_KEY);
  },
};

