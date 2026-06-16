import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager } from '../utils/SaveManager.js';
import { LEVELS } from '../data/levels/index.js';

const localStorageStore: Record<string, string> = {};

function installLocalStorage(): void {
  for (const key of Object.keys(localStorageStore)) delete localStorageStore[key];
  (globalThis as any).localStorage = {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => { localStorageStore[key] = value; },
    removeItem: (key: string) => { delete localStorageStore[key]; },
    clear: () => { for (const k of Object.keys(localStorageStore)) delete localStorageStore[k]; },
    get length() { return Object.keys(localStorageStore).length; },
    key: (index: number) => Object.keys(localStorageStore)[index] ?? null,
  } as Storage;
}

function installMinimalDom(): void {
  const elementProto = {
    style: new Proxy({} as Record<string, string>, {
      get: (target, prop: string) => target[prop] ?? '',
      set: (target, prop: string, value: string) => { target[prop] = value; return true; },
    }),
    appendChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
    setAttribute: vi.fn(),
    getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600 }),
    getContext: () => null,
    contains: () => false,
  };
  const makeElement = () => ({
    ...elementProto,
    style: { ...elementProto.style },
    children: [],
    childNodes: [],
    classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
    innerHTML: '',
    textContent: '',
    title: '',
    id: '',
    disabled: false,
    width: 0,
    height: 0,
    appendChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
    setAttribute: vi.fn(),
    getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600 }),
    getContext: () => null,
    contains: () => false,
  });

  (globalThis as any).document = {
    createElement: (_tag: string) => makeElement(),
    getElementById: () => null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  };
  (globalThis as any).window = {
    devicePixelRatio: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  (globalThis as any).requestAnimationFrame = (_cb: FrameRequestCallback): number => 0;
  (globalThis as any).cancelAnimationFrame = (_id: number) => undefined;
}

describe('DebugManager — 调试功能 (design/27-debug-system.md)', () => {
  beforeEach(() => {
    installLocalStorage();
    installMinimalDom();
  });

  it('completeAllLevels 将所有关卡设为 3 星并解锁到最后一关', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');

    const world = new TowerWorld();
    const refreshCallback = vi.fn();
    const debug = new DebugManager(world, { onLevelProgressChanged: refreshCallback });

    const result = debug.completeAllLevels();

    expect(result.unlocked).toBe(LEVELS.length);
    expect(result.stars).toBe(3);

    const save = SaveManager.load();
    expect(save.unlockedLevels).toBe(LEVELS.length);
    for (let i = 1; i <= LEVELS.length; i++) {
      expect(save.levelStars[i]).toBe(3);
    }
    expect(refreshCallback).toHaveBeenCalledTimes(1);
  });

  it('addDebugGold 在未注入 economy 时返回 false 且不抛错', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');

    const world = new TowerWorld();
    const debug = new DebugManager(world);

    expect(debug.addDebugGold()).toBe(false);
  });

  it('addDebugGold 在注入 economy 后调用 economy.addGold(99999)', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');
    const { EconomySystem } = await import('../systems/EconomySystem.js');

    const world = new TowerWorld();
    const economy = new EconomySystem();
    const debug = new DebugManager(world, { getEconomy: () => economy });

    const goldBefore = economy.gold;
    const ok = debug.addDebugGold();

    expect(ok).toBe(true);
    economy.update(world, 0);
    expect(economy.gold).toBeGreaterThanOrEqual(Math.min(goldBefore + 99999, 999_999));
  });

  it('注册 onOpenLevelEditor hook 后 buildActions 包含 open_level_editor 条目', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');

    const world = new TowerWorld();
    const openEditor = vi.fn();
    const debug = new DebugManager(world, { onOpenLevelEditor: openEditor });

    const actions = debug.getActions();
    const editorAction = actions.find((a) => a.id === 'open_level_editor');
    expect(editorAction).toBeDefined();
    expect(editorAction?.isEnabled()).toBe(true);
    editorAction?.onClick();
    expect(openEditor).toHaveBeenCalledTimes(1);
  });

  it('未注册 onOpenLevelEditor 时不出现 open_level_editor 按钮', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');

    const world = new TowerWorld();
    const debug = new DebugManager(world);
    const actions = debug.getActions();
    expect(actions.find((a) => a.id === 'open_level_editor')).toBeUndefined();
  });

  it('调试面板提供美术资源开关，并同步到全局资源开关', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');
    const { areArtResourcesEnabled, setArtResourcesEnabled } = await import('../utils/artResourceSwitch.js');

    setArtResourcesEnabled(true);
    const world = new TowerWorld();
    const debug = new DebugManager(world);
    const action = debug.getActions().find((a) => a.id === 'toggle_art_resources');

    expect(action).toBeDefined();
    expect(debug.isArtResourcesEnabled()).toBe(true);
    expect(areArtResourcesEnabled()).toBe(true);

    action?.onClick();

    expect(debug.isArtResourcesEnabled()).toBe(false);
    expect(areArtResourcesEnabled()).toBe(false);

    setArtResourcesEnabled(true);
  });

  it('调试面板提供单位动作预览入口', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');

    const world = new TowerWorld();
    const debug = new DebugManager(world);
    const action = debug.getActions().find((a) => a.id === 'show_unit_animation_preview');

    expect(action).toBeDefined();
    expect(action?.isEnabled()).toBe(true);
  });

  it('调试面板提供直接进入最后一波入口，并调用战斗 hook', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');
    const { EconomySystem } = await import('../systems/EconomySystem.js');

    const world = new TowerWorld();
    const economy = new EconomySystem();
    const skipToFinalWave = vi.fn(() => true);
    const debug = new DebugManager(world, {
      getEconomy: () => economy,
      onSkipToFinalWave: skipToFinalWave,
    });
    const action = debug.getActions().find((a) => a.id === 'skip_to_final_wave');

    expect(action).toBeDefined();
    expect(action?.isEnabled()).toBe(true);
    expect(debug.skipToFinalWave()).toBe(true);
    expect(skipToFinalWave).toHaveBeenCalledTimes(1);
  });

  it('调试卡牌试用按从左到右顺序替换手牌并循环', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');
    const { HandSystem } = await import('../systems/HandSystem.js');

    const world = new TowerWorld();
    const handSystem = new HandSystem();
    handSystem.initialize([
      { id: 'card_arrow_tower', name: '箭塔', type: 'unit', description: '基础单体物理输出', goldCost: 0 },
      { id: 'card_ice_tower', name: '冰塔', type: 'unit', description: '减速控制型魔法塔', goldCost: 0 },
      { id: 'card_shield_guard', name: '盾卫', type: 'unit', description: '近战嘲讽士兵', goldCost: 0 },
      { id: 'card_archer', name: '弓手', type: 'unit', description: '远程快速攻击', goldCost: 0 },
      { id: 'card_fireball', name: '火球术', type: 'spell', description: '2x2格范围火球伤害', goldCost: 0 },
    ]);
    handSystem.reset();
    for (const cardId of ['card_arrow_tower', 'card_ice_tower', 'card_shield_guard', 'card_archer', 'card_fireball']) {
      expect(handSystem.drawCard(cardId)).toBe(true);
    }
    const debug = new DebugManager(world, { getHandSystem: () => handSystem });

    expect(debug.replaceNextHandCardForDebug({
      id: 'card_fireball',
      name: '火球术',
      type: 'spell',
      description: '2x2格范围火球伤害',
      goldCost: 0,
    })).toBe(true);
    expect(handSystem.getHand().map((card) => card?.id)).toEqual([
      'card_fireball',
      'card_ice_tower',
      'card_shield_guard',
      'card_archer',
      'card_fireball',
    ]);

    expect(debug.replaceNextHandCardForDebug({
      id: 'card_arrow_rain',
      name: '剑雨',
      type: 'spell',
      description: '3x3格范围剑雨',
      goldCost: 0,
    })).toBe(true);
    expect(handSystem.getHand().map((card) => card?.id)).toEqual([
      'card_fireball',
      'card_arrow_rain',
      'card_shield_guard',
      'card_archer',
      'card_fireball',
    ]);

    for (const cardId of ['card_bomb', 'card_blizzard', 'card_gold_rush']) {
      debug.replaceNextHandCardForDebug({
        id: cardId,
        name: cardId,
        type: 'spell',
        description: cardId,
        goldCost: 0,
      });
    }
    expect(debug.replaceNextHandCardForDebug({
      id: 'card_fire_tower',
      name: '火塔',
      type: 'unit',
      description: '地面灼烧',
      goldCost: 0,
    })).toBe(true);
    expect(handSystem.getHand().map((card) => card?.id)).toEqual([
      'card_fire_tower',
      'card_arrow_rain',
      'card_bomb',
      'card_blizzard',
      'card_gold_rush',
    ]);
  });

  it('单位动作预览按塔、士兵、每关敌人分页并对关卡敌人去重', async () => {
    const { buildPreviewTabs } = await import('./UnitAnimationPreviewWindow.js');
    const { TowerType, UnitType, LevelTheme, TileType } = await import('../types/index.js');

    const tabs = buildPreviewTabs([
      {
        id: 'debug-level',
        name: '调试关卡',
        theme: LevelTheme.Plains,
        description: '',
        map: {
          name: 'debug-map',
          rows: 1,
          cols: 1,
          tileSize: 64,
          tiles: [[TileType.Empty]],
        },
        waves: [
          {
            waveNumber: 1,
            spawnDelay: 0,
            enemies: [
              { enemyType: 'goblin', count: 2, spawnInterval: 1 },
              { enemyType: 'goblin', count: 1, spawnInterval: 1 },
              { enemyType: 'boar', count: 1, spawnInterval: 1 },
            ],
          },
        ],
        startingGold: 0,
        availableTowers: [],
        availableUnits: [],
        unlockStarsRequired: 0,
        unlockPrevLevelId: null,
      },
    ]);

    expect(tabs[0]?.id).toBe('tower');
    expect(tabs[0]?.units.map((unit) => unit.id)).toContain(`tower_${TowerType.Arrow}`);
    expect(tabs[1]?.id).toBe('soldier');
    expect(tabs[1]?.units.map((unit) => unit.id)).toContain(UnitType.Archer);
    expect(tabs[2]?.id).toBe('level-debug-level');
    expect(tabs[2]?.units.map((unit) => unit.id)).toEqual(['enemy_goblin', 'enemy_boar']);
  });

  it('addDebugGold 在 economy provider 返回 null 时按未注入处理', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');

    const world = new TowerWorld();
    let currentEconomy: any = null;
    const debug = new DebugManager(world, { getEconomy: () => currentEconomy });

    expect(debug.addDebugGold()).toBe(false);
  });
});
