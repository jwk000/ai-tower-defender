import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { normalizeSfxKey } from './Sound.js';

const ROOT = process.cwd();

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractAudioPaths(source: string, folder: 'sfx' | 'bgm'): string[] {
  const pattern = folder === 'sfx'
    ? /^\s*[a-zA-Z0-9_]+:\s*['"]\/sfx\/([^'"]+)['"]/gm
    : /^\s*[a-zA-Z0-9_]+:\s*['"](bgm\/[^'"]+)['"]/gm;
  const paths: string[] = [];
  for (const match of source.matchAll(pattern)) {
    const file = match[1];
    if (!file) continue;
    paths.push(folder === 'sfx' ? `sfx/${file}` : file);
  }
  return paths;
}

function listYamlFiles(dir: string): string[] {
  const absoluteDir = path.join(ROOT, dir);
  const result: string[] = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listYamlFiles(relativePath));
    } else if (entry.isFile() && /\.(ya?ml)$/.test(entry.name)) {
      result.push(relativePath);
    }
  }
  return result;
}

function walk(value: unknown, visit: (key: string, value: unknown) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    visit(key, child);
    walk(child, visit);
  }
}

describe('audio assets', () => {
  it('provides files for every declared SFX and BGM runtime path', () => {
    const soundSource = readText('src/utils/Sound.ts');
    const musicSource = readText('src/utils/Music.ts');
    const declaredPaths = [
      ...extractAudioPaths(soundSource, 'sfx'),
      ...extractAudioPaths(musicSource, 'bgm'),
    ];

    expect(declaredPaths).not.toHaveLength(0);
    const missing = declaredPaths.filter(relativePath => !fs.existsSync(path.join(ROOT, 'public', relativePath)));
    expect(missing).toEqual([]);
  });

  it('resolves every configured sound name and audio file path', () => {
    const failures: string[] = [];
    for (const file of listYamlFiles('src/config')) {
      const docs = yaml.loadAll(readText(file));
      for (const doc of docs) {
        walk(doc, (key, value) => {
          if (key === 'sound' && typeof value === 'string' && !normalizeSfxKey(value)) {
            failures.push(`${file}: unknown sound ${value}`);
          }
          if ((key === 'bgm' || key === 'sfx') && typeof value === 'string' && /^(bgm|sfx)\//.test(value)) {
            if (!fs.existsSync(path.join(ROOT, 'public', value))) {
              failures.push(`${file}: missing audio file ${value}`);
            }
          }
        });
      }
    }

    expect(failures).toEqual([]);
  });
});
