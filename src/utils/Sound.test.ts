// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sound } from './Sound.js';

class MockAudio {
  static instances: MockAudio[] = [];

  src: string;
  preload = '';
  volume = 1;
  readyState = 1;
  play = vi.fn(() => Promise.resolve());
  addEventListener = vi.fn();
  remove = vi.fn();

  constructor(src = '') {
    this.src = src;
    MockAudio.instances.push(this);
  }

  canPlayType(): string {
    return 'probably';
  }
}

describe('Sound unlock queue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    MockAudio.instances.length = 0;
    vi.stubGlobal('Audio', MockAudio);
  });

  it('replays sounds requested before browser audio unlock', () => {
    const canvas = document.createElement('canvas');

    Sound.initUnlock(canvas);
    Sound.play('intro_tile_drop');

    expect(MockAudio.instances.some(audio => audio.src.endsWith('/sfx/intro_tile_drop.ogg'))).toBe(false);

    canvas.dispatchEvent(new PointerEvent('pointerdown'));

    const dropAudio = MockAudio.instances.find(audio => audio.src.endsWith('/sfx/intro_tile_drop.ogg'));
    expect(dropAudio).toBeDefined();
    expect(dropAudio!.play).toHaveBeenCalled();
  });
});
