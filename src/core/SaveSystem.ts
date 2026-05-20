import type { PendingCardReward, PendingGoldReward, PendingUpgradeReward } from '../unit-system/RunManager.js';

export interface RunSnapshot {
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

/** @deprecated 旧格式，迁移期保留 */
export interface OngoingRun {
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly skillPoints: number;
  readonly crystalHp: number;
  readonly savedAt: number;
}

const STORAGE_KEY = 'td_run_v3';
const LEGACY_KEY_V2 = 'td_run_v2';
const LEGACY_KEY_V1 = 'td_run_v1';
const LEGACY_KEY = 'td_ongoing_run';

function migrateV2ToV3(v2: RunSnapshotV2): RunSnapshot {
  return {
    version: 3,
    savedAt: v2.savedAt,
    phase: v2.phase,
    currentLevelIdx: v2.currentLevelIdx,
    gold: v2.gold,
    crystalHp: v2.crystalHp,
    crystalHpMax: v2.crystalHpMax,
    pendingCardReward: v2.pendingCardReward,
    pendingGoldReward: v2.pendingGoldReward,
    pendingUpgradeReward: v2.pendingUpgradeReward,
    deck: v2.deck,
  };
}

function migrateV1ToV3(v1: RunSnapshotV1): RunSnapshot {
  return {
    version: 3,
    savedAt: v1.savedAt,
    phase: v1.phase,
    currentLevelIdx: v1.currentLevelIdx,
    gold: v1.gold,
    crystalHp: v1.crystalHp,
    crystalHpMax: v1.crystalHpMax,
    pendingCardReward: null,
    pendingGoldReward: null,
    pendingUpgradeReward: null,
    deck: v1.deck,
  };
}

export const SaveSystem = {
  hasSavedRun(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null
      || localStorage.getItem(LEGACY_KEY_V2) !== null
      || localStorage.getItem(LEGACY_KEY_V1) !== null;
  },

  /** @deprecated 用 hasSavedRun() */
  hasOngoingRun(): boolean {
    return SaveSystem.hasSavedRun();
  },

  loadRun(): RunSnapshot | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as RunSnapshot;
        if (parsed.version !== 3) return null;
        return parsed;
      } catch {
        return null;
      }
    }
    const rawV2 = localStorage.getItem(LEGACY_KEY_V2);
    if (rawV2) {
      try {
        const parsed = JSON.parse(rawV2) as RunSnapshotV2;
        if (parsed.version !== 2) return null;
        return migrateV2ToV3(parsed);
      } catch {
        return null;
      }
    }
    const rawV1 = localStorage.getItem(LEGACY_KEY_V1);
    if (rawV1) {
      try {
        const parsed = JSON.parse(rawV1) as RunSnapshotV1;
        if (parsed.version !== 1) return null;
        return migrateV1ToV3(parsed);
      } catch {
        return null;
      }
    }
    return null;
  },

  /** @deprecated 用 loadRun() */
  loadOngoingRun(): OngoingRun | null {
    const snap = SaveSystem.loadRun();
    if (!snap) return null;
    return {
      currentLevelIdx: snap.currentLevelIdx,
      gold: snap.gold,
      skillPoints: 0,
      crystalHp: snap.crystalHp,
      savedAt: snap.savedAt,
    };
  },

  saveRun(snapshot: RunSnapshot): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  },

  /** @deprecated 用 saveRun() */
  saveOngoingRun(run: OngoingRun): void {
    SaveSystem.saveRun({
      version: 3,
      savedAt: run.savedAt,
      phase: 'LevelMap',
      currentLevelIdx: run.currentLevelIdx,
      gold: run.gold,
      crystalHp: run.crystalHp,
      crystalHpMax: run.crystalHp,
      pendingCardReward: null,
      pendingGoldReward: null,
      pendingUpgradeReward: null,
      deck: { drawPile: [], discardPile: [] },
    });
  },

  clearRun(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY_V2);
    localStorage.removeItem(LEGACY_KEY_V1);
    localStorage.removeItem(LEGACY_KEY);
  },

  /** @deprecated 用 clearRun() */
  clearOngoingRun(): void {
    SaveSystem.clearRun();
  },
};
