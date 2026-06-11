import { describe, expect, it, afterEach } from 'vitest';
import { areArtResourcesEnabled, setArtResourcesEnabled } from './artResourceSwitch.js';

describe('artResourceSwitch', () => {
  afterEach(() => {
    setArtResourcesEnabled(true);
  });

  it('defaults to enabled and can be toggled at runtime', () => {
    expect(areArtResourcesEnabled()).toBe(true);

    setArtResourcesEnabled(false);
    expect(areArtResourcesEnabled()).toBe(false);

    setArtResourcesEnabled(true);
    expect(areArtResourcesEnabled()).toBe(true);
  });
});
