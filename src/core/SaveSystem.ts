import type { SerializedSkillTreeState } from '../unit-system/SkillTreeState.js';

export interface RunSnapshot {
  readonly version: 2;
  readonly savedAt: number;
  readonly phase: 'LevelMap';
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly skillPoints: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
  readonly skillTree: SerializedSkillTreeState;
  readonly deck: {
    readonly drawPile: string[];
    readonly discardPile: string[];
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

const STORAGE_KEY = 'td_run_v2';
const LEGACY_KEY_V1 = 'td_run_v1';
const LEGACY_KEY = 'td_ongoing_run';

function migrateV1ToV2(v1: RunSnapshotV1): RunSnapshot {
  return {
    version: 2,
    savedAt: v1.savedAt,
    phase: v1.phase,
    currentLevelIdx: v1.currentLevelIdx,
    gold: v1.gold,
    skillPoints: v1.skillPoints,
    crystalHp: v1.crystalHp,
    crystalHpMax: v1.crystalHpMax,
    skillTree: {
      instances: v1.skillTreeUnlocked.map((nodeId, i) => ({
        instanceId: `legacy_inst_${i}`,
        state: {
          unitCardId: 'unknown',
          activeNodes: [nodeId],
          equippedPath: null,
        },
      })),
    },
    deck: v1.deck,
  };
}

export const SaveSystem = {
  hasSavedRun(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null || localStorage.getItem(LEGACY_KEY_V1) !== null;
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
        if (parsed.version !== 2) return null;
        return parsed;
      } catch {
        return null;
      }
    }
    const rawV1 = localStorage.getItem(LEGACY_KEY_V1);
    if (rawV1) {
      try {
        const parsed = JSON.parse(rawV1) as RunSnapshotV1;
        if (parsed.version !== 1) return null;
        return migrateV1ToV2(parsed);
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
      skillPoints: snap.skillPoints,
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
      version: 2,
      savedAt: run.savedAt,
      phase: 'LevelMap',
      currentLevelIdx: run.currentLevelIdx,
      gold: run.gold,
      skillPoints: run.skillPoints,
      crystalHp: run.crystalHp,
      crystalHpMax: run.crystalHp,
      skillTree: { instances: [] },
      deck: { drawPile: [], discardPile: [] },
    });
  },

  clearRun(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY_V1);
    localStorage.removeItem(LEGACY_KEY);
  },

  /** @deprecated 用 clearRun() */
  clearOngoingRun(): void {
    SaveSystem.clearRun();
  },
};
