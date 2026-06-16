import { UnitTag } from '../core/components.js';
import type { SfxKey } from './Sound.js';

export const BossAudioType = {
  GiantSlime: 0,
  QueenWorm: 1,
  Lucifer: 2,
  SuperRobot: 3,
  AbyssLord: 4,
} as const;

export function getBossEnterSfx(bossType: number | undefined): SfxKey {
  switch (bossType) {
    case BossAudioType.GiantSlime: return 'boss_enter_slime';
    case BossAudioType.QueenWorm: return 'boss_enter_beetle';
    case BossAudioType.Lucifer: return 'boss_enter_lucifer';
    case BossAudioType.SuperRobot: return 'boss_enter_robot';
    case BossAudioType.AbyssLord: return 'boss_enter_abyss';
    default: return 'wave_boss';
  }
}

export function getBossDeathSfx(bossType: number | undefined): SfxKey {
  switch (bossType) {
    case BossAudioType.AbyssLord: return 'boss_death_void';
    case BossAudioType.GiantSlime:
    case BossAudioType.QueenWorm:
    case BossAudioType.Lucifer:
    case BossAudioType.SuperRobot:
      return 'boss_death_heavy';
    default:
      return 'victory';
  }
}

export function getSummonSfx(skillId: string): SfxKey {
  switch (skillId) {
    case 'summon_desert_beetles':
    case 'summon_burrow_worm':
    case 'summon_kraken':
      return 'boss_summon_insect';
    case 'summon_skeletons':
      return 'boss_summon_undead';
    case 'summon_drones':
      return 'boss_summon_machine';
    case 'summon_brood_mother':
    case 'mass_summon':
      return 'boss_summon_void';
    default:
      return 'boss_summon';
  }
}

export function getPhaseSfx(skillId: string): SfxKey {
  switch (skillId) {
    case 'frost_slam':
    case 'polymorph_mushroom':
      return 'boss_phase_ice';
    case 'void_eruption':
    case 'reality_warp':
      return 'boss_phase_void';
    default:
      return 'boss_phase_enrage';
  }
}

export function getEnemySpawnSfx(entityId: number): SfxKey {
  const type = UnitTag.unitTypeNum[entityId];
  if (type === 9 || type === 13 || type === 18) return 'enemy_spawn_flying';
  if (type === 14 || type === 16 || type === 17) return 'enemy_spawn_machine';
  if (type === 21) return 'enemy_spawn_undead';
  return 'enemy_spawn';
}

export function getEnemyDeathSfx(entityId: number): SfxKey {
  const type = UnitTag.unitTypeNum[entityId];
  if (type === 2 || type === 3 || type === 12 || type === 14 || type === 17) return 'enemy_death_heavy';
  if (type === 10 || type === 11 || type === 21 || type === 23) return 'enemy_death_magic';
  if (type === 13 || type === 18) return 'enemy_death_flying';
  if (type === 16) return 'enemy_death_machine';
  return 'enemy_death';
}
