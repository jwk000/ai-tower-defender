import { TowerWorld, type System } from '../core/World.js';
import { Sound } from '../utils/Sound.js';
import { getGlobalRandom } from '../utils/Random.js';
import {
  WeatherType,
} from '../types/index.js';
import { WEATHER_CONFIGS } from '../data/weatherConfigs.js';

// ============================================================
// WeatherSystem (v4.0 — 仅视觉，不影响数值)
//
// 设计文档: design/06-technical.md §4.2
// 天气仅影响屏幕色调、粒子特效等视觉效果，
// 不再修改塔的攻击力/射程/攻速或敌人移速。
// ============================================================

export class WeatherSystem implements System {
  readonly name = 'WeatherSystem';

  currentWeather: WeatherType = WeatherType.Sunny;
  private weatherPool: WeatherType[] = [WeatherType.Sunny];
  private weatherFixed: WeatherType | null = null;
  private changeInterval: number = 3;
  private wavesElapsed: number = 0;
  transitionTimer: number = 0;
  previousWeather: WeatherType = WeatherType.Sunny;

  get weatherName(): string {
    return WEATHER_CONFIGS[this.currentWeather]?.name ?? '晴天';
  }

  get screenTint(): string {
    return WEATHER_CONFIGS[this.currentWeather]?.screenTint ?? 'rgba(0,0,0,0)';
  }

  get screenAlpha(): number {
    return WEATHER_CONFIGS[this.currentWeather]?.screenAlpha ?? 0;
  }

  // ---- Public API ----

  init(pool: WeatherType[], fixed?: WeatherType, interval?: number): void {
    this.weatherPool = pool.length > 0 ? pool : [WeatherType.Sunny];
    this.weatherFixed = fixed ?? null;
    this.changeInterval = interval ?? 3;
    if (fixed) {
      this.setWeather(fixed);
    } else {
      this.setWeather(this.weatherPool[0]!);
    }
  }

  onWaveEnd(): void {
    if (this.weatherFixed) return;
    this.wavesElapsed++;
    if (this.wavesElapsed >= this.changeInterval) {
      this.wavesElapsed = 0;
      this.switchWeather();
    }
  }

  switchWeather(): void {
    const idx = getGlobalRandom().wave.nextInt(0, this.weatherPool.length);
    const next = this.weatherPool[idx];
    if (next) this.setWeather(next);
  }

  setWeather(type: WeatherType): void {
    if (type === this.currentWeather) return;
    this.previousWeather = this.currentWeather;
    this.currentWeather = type;
    this.transitionTimer = 1.5;
    Sound.play('weather_change');
  }

  /** 蝙蝠塔在夜晚/雾天可以攻击 */
  canAttackBat(): boolean {
    return (
      this.currentWeather === WeatherType.Night ||
      this.currentWeather === WeatherType.Fog
    );
  }

  // ---- System.update ----

  update(_world: TowerWorld, dt: number): void {
    if (this.transitionTimer > 0) {
      this.transitionTimer -= dt;
    }
  }
}
