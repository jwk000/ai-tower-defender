#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const generatedScriptPath = join(root, 'node_modules', '.cache', 'tower-defender-remove-white-bg.py');

mkdirSync(dirname(generatedScriptPath), { recursive: true });

const pythonSource = String.raw`
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remove edge-connected white backgrounds from generated art.")
    parser.add_argument("paths", nargs="+", help="Files or folders to process")
    parser.add_argument("--threshold", type=int, default=238, help="RGB channel threshold for near-white pixels")
    parser.add_argument("--soft", type=int, default=18, help="Soft edge range below threshold")
    return parser.parse_args()


def iter_pngs(paths: list[str]) -> list[Path]:
    files: list[Path] = []
    for raw in paths:
        path = Path(raw)
        if path.is_dir():
            files.extend(sorted(path.glob("*.png")))
        elif path.is_file() and path.suffix.lower() == ".png":
            files.append(path)
    return files


def is_white_edge_pixel(pixel: tuple[int, int, int, int], threshold: int) -> bool:
    r, g, b, a = pixel
    return a > 0 and r >= threshold and g >= threshold and b >= threshold


def remove_white_background(path: Path, threshold: int, soft: int) -> bool:
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(1, height - 1):
        queue.append((0, y))
        queue.append((width - 1, y))

    changed = False
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        pixel = pixels[x, y]
        if not is_white_edge_pixel(pixel, threshold):
            continue

        pixels[x, y] = (pixel[0], pixel[1], pixel[2], 0)
        changed = True
        if x > 0:
            queue.append((x - 1, y))
        if x < width - 1:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y < height - 1:
            queue.append((x, y + 1))

    if soft > 0:
        lower = max(0, threshold - soft)
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                if a == 0:
                    continue
                whiteness = min(r, g, b)
                if whiteness <= lower:
                    continue
                if any(
                    0 <= nx < width and 0 <= ny < height and pixels[nx, ny][3] == 0
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
                ):
                    factor = (threshold - whiteness) / max(1, threshold - lower)
                    new_alpha = max(0, min(a, int(a * max(0.0, min(1.0, factor)))))
                    if new_alpha != a:
                        pixels[x, y] = (r, g, b, new_alpha)
                        changed = True

    if changed:
        image.save(path, optimize=True)
    return changed


def main() -> None:
    args = parse_args()
    files = iter_pngs(args.paths)
    changed = 0
    for file in files:
        if remove_white_background(file, args.threshold, args.soft):
            changed += 1
    print(f"Processed {len(files)} png file(s); removed white background from {changed}.")


if __name__ == "__main__":
    main()
`;

writeFileSync(generatedScriptPath, pythonSource);

function hasArg(name) {
  return process.argv.includes(name);
}

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const arg = process.argv.find((candidate) => candidate.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!hasArg('--skip-generate')) {
  const generateArgs = ['scripts/generate-ai-art-assets.mjs'];
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--priority=') || arg.startsWith('--type=') || arg.startsWith('--limit=')) {
      generateArgs.push(arg);
    }
  }
  run('node', generateArgs);
}

const target = argValue('--target', 'public/art/decor');
run('python3', [
  generatedScriptPath,
  target,
  '--threshold',
  argValue('--threshold', '238'),
  '--soft',
  argValue('--soft', '18'),
]);

if (!hasArg('--skip-atlas')) {
  run('npm', ['run', 'build:atlases']);
}
