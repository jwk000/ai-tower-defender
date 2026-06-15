#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const generatedScriptPath = join(root, 'node_modules', '.cache', 'tower-defender-build-atlases.py');

mkdirSync(dirname(generatedScriptPath), { recursive: true });

const pythonSource = String.raw`
from __future__ import annotations

import json
import math
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image

ROOT = Path(sys.argv[1]).resolve()
ART_ROOT = ROOT / "public" / "art"
ATLAS_ROOT = ART_ROOT / "atlases"
MAX_SIZE = 2048
PADDING = 2


@dataclass(frozen=True)
class AtlasPlan:
    atlas_id: str
    image_path: str
    files: list[Path]
    resize_to: tuple[int, int] | None = None
    max_width: int = MAX_SIZE


@dataclass(frozen=True)
class PackedFrame:
    file: Path
    image: Image.Image
    w: int
    h: int
    x: int
    y: int


def art_key(path: Path) -> str:
    return "/" + path.relative_to(ART_ROOT.parent).as_posix()


def image_files(folder: str, pattern: str = "*.png") -> list[Path]:
    return sorted((ART_ROOT / folder).glob(pattern))


def chunked(items: list[Path], size: int) -> Iterable[list[Path]]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


def tower_id_from_path(path: Path) -> str | None:
    name = path.stem
    prefix = "unit_tower_"
    if not name.startswith(prefix):
        return None
    rest = name[len(prefix):]
    for suffix in ["_idle_0", "_idle_1", "_move_0", "_move_1", "_attack_0", "_attack_1", "_death_0", "_death_1"]:
        if rest.endswith(suffix):
            return rest[:-len(suffix)]
    return None


def build_plans() -> list[AtlasPlan]:
    plans: list[AtlasPlan] = []

    unit_files = image_files("units")
    tower_groups: dict[str, list[Path]] = {}
    non_tower_unit_files: list[Path] = []
    for file in unit_files:
        tower_id = tower_id_from_path(file)
        if tower_id is None:
            non_tower_unit_files.append(file)
        else:
            tower_groups.setdefault(tower_id, []).append(file)

    for tower_id, files in sorted(tower_groups.items()):
        plans.append(AtlasPlan(
            atlas_id=f"tower_{tower_id}",
            image_path=f"/art/atlases/towers/tower_{tower_id}.png",
            files=sorted(files),
            max_width=1024,
        ))

    for index, files in enumerate(chunked(non_tower_unit_files, 49), start=1):
        plans.append(AtlasPlan(
            atlas_id=f"units_{index:02d}",
            image_path=f"/art/atlases/units/units_{index:02d}.png",
            files=files,
        ))

    for theme in ["meadow", "desert", "castle", "wasteland", "abyss"]:
        files = sorted((ART_ROOT / "tiles").glob(f"tile_{theme}_*.png"))
        if files:
            plans.append(AtlasPlan(
                atlas_id=f"theme_{theme}_tiles",
                image_path=f"/art/atlases/themes/theme_{theme}_tiles.png",
                files=files,
                resize_to=(256, 256),
            ))

    combat_files = image_files("fx") + image_files("objectives")
    plans.append(AtlasPlan(
        atlas_id="fx_objectives",
        image_path="/art/atlases/global/fx_objectives.png",
        files=combat_files,
        resize_to=(256, 256),
    ))

    icon_files = image_files("buffs") + image_files("card-icon")
    plans.append(AtlasPlan(
        atlas_id="icons_common",
        image_path="/art/atlases/ui/icons_common.png",
        files=icon_files,
        resize_to=(256, 256),
    ))

    ui_files = image_files("ui")
    for index, files in enumerate(chunked(ui_files, 2), start=1):
        plans.append(AtlasPlan(
            atlas_id=f"ui_common_{index:02d}",
            image_path=f"/art/atlases/ui/ui_common_{index:02d}.png",
            files=files,
        ))

    return [plan for plan in plans if plan.files]


def load_frame(path: Path, resize_to: tuple[int, int] | None) -> tuple[Image.Image, int, int]:
    image = Image.open(path).convert("RGBA")
    if resize_to is not None and image.size != resize_to:
        image = image.resize(resize_to, Image.Resampling.LANCZOS)
    return image, image.width, image.height


def pack_rows(plan: AtlasPlan) -> tuple[int, int, list[PackedFrame]]:
    frames: list[PackedFrame] = []
    x = PADDING
    y = PADDING
    row_h = 0
    atlas_w = 0
    atlas_h = 0

    for file in plan.files:
        image, w, h = load_frame(file, plan.resize_to)
        if w + PADDING * 2 > MAX_SIZE or h + PADDING * 2 > MAX_SIZE:
            raise ValueError(f"{file} is too large for {MAX_SIZE}px atlas after resize: {w}x{h}")

        if x + w + PADDING > plan.max_width:
            x = PADDING
            y += row_h + PADDING
            row_h = 0

        if y + h + PADDING > MAX_SIZE:
            raise ValueError(f"{plan.atlas_id} exceeds {MAX_SIZE}px; split plan into smaller chunks")

        frames.append(PackedFrame(file=file, image=image, w=w, h=h, x=x, y=y))
        atlas_w = max(atlas_w, x + w + PADDING)
        atlas_h = max(atlas_h, y + h + PADDING)
        row_h = max(row_h, h)
        x += w + PADDING

    atlas_w = max(1, min(MAX_SIZE, atlas_w))
    atlas_h = max(1, min(MAX_SIZE, atlas_h))
    return atlas_w, atlas_h, frames


def write_atlas(plan: AtlasPlan) -> dict:
    width, height, frames = pack_rows(plan)
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    manifest_frames = {}

    for frame in frames:
        atlas.alpha_composite(frame.image, (frame.x, frame.y))
        manifest_frames[art_key(frame.file)] = {
            "x": frame.x,
            "y": frame.y,
            "w": frame.w,
            "h": frame.h,
        }

    output_path = ROOT / "public" / plan.image_path.lstrip("/")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output_path, optimize=True)

    sidecar = {
        "id": plan.atlas_id,
        "image": plan.image_path,
        "frames": manifest_frames,
    }
    output_path.with_suffix(".json").write_text(json.dumps(sidecar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return sidecar


def main() -> None:
    if ATLAS_ROOT.exists():
        shutil.rmtree(ATLAS_ROOT)
    ATLAS_ROOT.mkdir(parents=True, exist_ok=True)

    manifests = [write_atlas(plan) for plan in build_plans()]
    index = {"atlases": manifests}
    (ATLAS_ROOT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    frame_count = sum(len(manifest["frames"]) for manifest in manifests)
    print(f"Generated {len(manifests)} atlases with {frame_count} frames at {ATLAS_ROOT}")


if __name__ == "__main__":
    main()
`;

writeFileSync(generatedScriptPath, pythonSource);

const result = spawnSync('python3', [generatedScriptPath, root], {
  cwd: root,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
