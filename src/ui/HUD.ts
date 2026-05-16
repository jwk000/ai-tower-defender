export interface RunState {
  readonly gold: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
  readonly waveIndex: number;
  readonly waveTotal: number;
  readonly phase: 'deployment' | 'battle' | 'wave-break' | 'victory' | 'defeat';
  readonly energy: number;
  readonly energyMax: number;
  readonly sp: number;
  readonly runLevel: number;
  readonly runTotalLevels: number;
  readonly enemyCount: number;
}

export interface HUDProjection {
  readonly energy: string;
  readonly gold: string;
  readonly wave: string;
  readonly enemy: string;
  readonly crystal: string;
  readonly runProgress: string;
  readonly phaseLabel: string;
  readonly crystalLowAlarm: boolean;
}

export function projectHUD(state: RunState): HUDProjection {
  const crystalRatio = state.crystalHpMax > 0 ? state.crystalHp / state.crystalHpMax : 0;
  return {
    energy: `◇ ${state.energy}/${state.energyMax}`,
    gold: `● ${state.gold}`,
    wave: `⚑ ${state.waveIndex}/${state.waveTotal}`,
    enemy: `☠ ${state.enemyCount}`,
    crystal: `💎 ${state.crystalHp}/${state.crystalHpMax}`,
    runProgress: `Run ${state.runLevel}/${state.runTotalLevels}`,
    phaseLabel: phaseLabel(state.phase),
    crystalLowAlarm: state.crystalHp > 0 && crystalRatio < 0.30,
  };
}

function phaseLabel(phase: RunState['phase']): string {
  switch (phase) {
    case 'deployment': return '部署阶段';
    case 'battle': return '战斗中';
    case 'wave-break': return '波次间歇';
    case 'victory': return '胜利';
    case 'defeat': return '失败';
  }
}
