#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const generatedScriptPath = join(root, 'node_modules', '.cache', 'tower-defender-remove-generated-bg.py');

mkdirSync(dirname(generatedScriptPath), { recursive: true });

const pythonSource = String.raw`
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remove edge-connected generated backgrounds from art sprites.")
    parser.add_argument("paths", nargs="+", help="Files or folders to process")
    parser.add_argument("--glob", default="*.png", help="PNG filename glob used when processing folders")
    parser.add_argument("--threshold", type=int, default=46, help="Maximum RGB distance from sampled edge background")
    parser.add_argument("--soft", type=int, default=28, help="Soft edge distance range above threshold")
    parser.add_argument("--white-threshold", type=int, default=238, help="Always remove edge-connected near-white pixels")
    parser.add_argument("--inner-hole", type=int, default=220, help="Maximum enclosed background area to remove")
    return parser.parse_args()


def iter_pngs(paths: list[str], pattern: str) -> list[Path]:
    files: list[Path] = []
    for raw in paths:
        path = Path(raw)
        if path.is_dir():
            files.extend(sorted(path.glob(pattern)))
        elif path.is_file() and path.suffix.lower() == ".png":
            files.append(path)
    return files


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def is_white_edge_pixel(pixel: tuple[int, int, int, int], threshold: int) -> bool:
    r, g, b, a = pixel
    return a > 0 and r >= threshold and g >= threshold and b >= threshold


def sample_edge_backgrounds(image: Image.Image) -> list[tuple[int, int, int]]:
    width, height = image.size
    pixels = image.load()
    samples: list[tuple[int, int, int]] = []
    step = max(1, min(width, height) // 32)
    for x in range(0, width, step):
        for y in (0, height - 1):
            r, g, b, a = pixels[x, y]
            if a > 0:
                samples.append((r, g, b))
    for y in range(0, height, step):
        for x in (0, width - 1):
            r, g, b, a = pixels[x, y]
            if a > 0:
                samples.append((r, g, b))
    if not samples:
        return []

    clusters: list[tuple[list[float], int]] = []
    for sample in samples:
        for index, (center, count) in enumerate(clusters):
            if color_distance(sample, (round(center[0]), round(center[1]), round(center[2]))) <= 30:
                next_count = count + 1
                center[0] = (center[0] * count + sample[0]) / next_count
                center[1] = (center[1] * count + sample[1]) / next_count
                center[2] = (center[2] * count + sample[2]) / next_count
                clusters[index] = (center, next_count)
                break
        else:
            clusters.append(([float(sample[0]), float(sample[1]), float(sample[2])], 1))

    clusters.sort(key=lambda item: item[1], reverse=True)
    return [
        (round(center[0]), round(center[1]), round(center[2]))
        for center, count in clusters[:4]
        if count >= max(2, len(samples) // 64)
    ]


def is_background_pixel(
    pixel: tuple[int, int, int, int],
    backgrounds: list[tuple[int, int, int]],
    threshold: int,
    white_threshold: int,
) -> bool:
    r, g, b, a = pixel
    if a == 0:
        return True
    if is_white_edge_pixel(pixel, white_threshold):
        return True
    rgb = (r, g, b)
    return any(color_distance(rgb, bg) <= threshold for bg in backgrounds)


def is_inner_residue_candidate(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a < 180:
        return False
    high = max(r, g, b)
    low = min(r, g, b)
    saturation = high - low
    return (
        (low >= 214 and saturation <= 54)
        or (low >= 178 and high >= 198 and saturation <= 28)
    )


def region_has_intentional_detail(
    image: Image.Image,
    region: list[tuple[int, int]],
    margin: int = 2,
) -> bool:
    width, height = image.size
    pixels = image.load()
    xs = [x for x, _ in region]
    ys = [y for _, y in region]
    min_x = max(0, min(xs) - margin)
    max_x = min(width - 1, max(xs) + margin)
    min_y = max(0, min(ys) - margin)
    max_y = min(height - 1, max(ys) + margin)

    dark_pixels = 0
    saturated_pixels = 0
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            if (x, y) in region:
                continue
            r, g, b, a = pixels[x, y]
            if a < 180:
                continue
            high = max(r, g, b)
            low = min(r, g, b)
            if low < 70:
                dark_pixels += 1
            if high - low > 80 and high > 120:
                saturated_pixels += 1
    return dark_pixels >= 3 or saturated_pixels >= max(8, len(region) // 3)


def remove_inner_background_residue(
    image: Image.Image,
    backgrounds: list[tuple[int, int, int]],
    threshold: int,
    white_threshold: int,
    max_area: int,
) -> bool:
    if max_area <= 0:
        return False

    width, height = image.size
    pixels = image.load()
    visited: set[tuple[int, int]] = set()
    changed = False

    for start_y in range(1, height - 1):
        for start_x in range(1, width - 1):
            if (start_x, start_y) in visited:
                continue
            pixel = pixels[start_x, start_y]
            is_candidate = (
                is_background_pixel(pixel, backgrounds, threshold, white_threshold)
                if backgrounds
                else is_inner_residue_candidate(pixel)
            )
            if not is_candidate:
                continue

            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            region: list[tuple[int, int]] = []
            touches_edge = False

            while queue:
                x, y = queue.popleft()
                if (x, y) in visited:
                    continue
                visited.add((x, y))
                pixel = pixels[x, y]
                is_candidate = (
                    is_background_pixel(pixel, backgrounds, threshold, white_threshold)
                    if backgrounds
                    else is_inner_residue_candidate(pixel)
                )
                if not is_candidate:
                    continue

                region.append((x, y))
                if x == 0 or y == 0 or x == width - 1 or y == height - 1:
                    touches_edge = True
                if len(region) > max_area:
                    continue

                if x > 0:
                    queue.append((x - 1, y))
                if x < width - 1:
                    queue.append((x + 1, y))
                if y > 0:
                    queue.append((x, y - 1))
                if y < height - 1:
                    queue.append((x, y + 1))

            if touches_edge or len(region) > max_area or len(region) < 6:
                continue
            if not backgrounds and region_has_intentional_detail(image, region):
                continue

            for x, y in region:
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)
                changed = True

    return changed


def remove_generated_background(path: Path, threshold: int, soft: int, white_threshold: int, inner_hole: int) -> bool:
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    backgrounds = sample_edge_backgrounds(image)
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
        if not backgrounds or not is_background_pixel(pixel, backgrounds, threshold, white_threshold):
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

    if soft > 0 and backgrounds:
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                if a == 0:
                    continue
                if not any(
                    0 <= nx < width and 0 <= ny < height and pixels[nx, ny][3] == 0
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
                ):
                    continue
                distance = min(color_distance((r, g, b), bg) for bg in backgrounds)
                if distance <= threshold + soft:
                    factor = (distance - threshold) / max(1, soft)
                    new_alpha = max(0, min(a, int(a * max(0.0, min(1.0, factor)))))
                    if new_alpha != a:
                        pixels[x, y] = (r, g, b, new_alpha)
                        changed = True

    if remove_inner_background_residue(image, backgrounds, threshold, white_threshold, inner_hole):
        changed = True

    if changed:
        image.save(path, optimize=True)
    return changed


def main() -> None:
    args = parse_args()
    files = iter_pngs(args.paths, args.glob)
    changed = 0
    for file in files:
        if remove_generated_background(file, args.threshold, args.soft, args.white_threshold, args.inner_hole):
            changed += 1
    print(f"Processed {len(files)} png file(s); removed generated background from {changed}.")


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
  argValue('--threshold', '46'),
  '--soft',
  argValue('--soft', '28'),
  '--white-threshold',
  argValue('--white-threshold', '238'),
  '--inner-hole',
  argValue('--inner-hole', '220'),
  '--glob',
  argValue('--glob', '*.png'),
]);

if (!hasArg('--skip-atlas')) {
  run('npm', ['run', 'build:atlases']);
}
