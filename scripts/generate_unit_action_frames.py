#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
UNIT_DIR = ROOT / "public" / "art" / "units"
SHEET_DIR = ROOT / "tmp" / "ai-action-sheets"
STATES = ("idle", "move", "attack", "death")
ACTION_STATES = ("move", "attack", "death")
CELL_COLS = 4
CELL_ROWS = 2
OUT_SIZE = 256
CHROMA = (0, 255, 0)


def unit_ids() -> list[str]:
    return sorted(p.name[len("unit_") : -len("_idle_0.png")] for p in UNIT_DIR.glob("unit_*_idle_0.png"))


def prompt_for(uid: str) -> str:
    return (
        "Create a clean 4 columns x 2 rows sprite sheet for this exact existing tower defense unit asset. "
        "Preserve the reference sprite identity, palette, proportions, simplified dark fantasy casual game art, "
        "3/4 top-down camera, compact readable game-unit silhouette. "
        "Do not upgrade into a realistic character illustration, do not add face detail, do not change costume, "
        "do not change weapon design. Use a perfectly flat solid #00ff00 chroma-key background in every cell, "
        "no checkerboard, no shadows, no text, no labels, no grid lines. "
        "Columns left to right: idle, move, attack, death. Row 1 frame 0, row 2 frame 1. "
        "Idle frames: close to reference with tiny breathing pose. "
        "Move frames: newly drawn step/run/flying-motion poses with changed limbs/body/weapon positions, "
        "not scaling or stretching. "
        "Attack frames: newly drawn wind-up and release poses with weapon/action changed, not scaling or stretching. "
        "Death frames: newly drawn collapse and dissolve/broken poses, not scaling or stretching. "
        f"Center one complete unit per cell with padding. Unit id: {uid}."
    )


def run_generation(uid: str, model: str, force: bool) -> Path:
    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    sheet_path = SHEET_DIR / f"{uid}_sheet.png"
    if sheet_path.exists() and not force:
        return sheet_path

    ref0 = UNIT_DIR / f"unit_{uid}_idle_0.png"
    ref1 = UNIT_DIR / f"unit_{uid}_idle_1.png"
    cmd = [
        "animal-mediakit",
        "generate",
        "edit",
        "--model",
        model,
        "--size",
        "1024x1024",
        "--ref-image",
        str(ref0),
        "--ref-image",
        str(ref1),
        "--prompt",
        prompt_for(uid),
        "-o",
        str(sheet_path),
    ]
    subprocess.run(cmd, cwd=ROOT, check=True)
    return sheet_path


def remove_chroma(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            # Hard key pure green and softly remove near-green antialiasing.
            green_dist = abs(r - CHROMA[0]) + abs(g - CHROMA[1]) + abs(b - CHROMA[2])
            if green_dist < 72 or (g > 190 and r < 90 and b < 90):
                pixels[x, y] = (r, g, b, 0)
            elif g > 150 and g > r * 1.55 and g > b * 1.55:
                new_a = max(0, min(a, int((255 - g) * 2.2)))
                pixels[x, y] = (r, g, b, new_a)
    return rgba


def crop_to_square(cell: Image.Image) -> Image.Image:
    rgba = remove_chroma(cell)
    bbox = rgba.getchannel("A").getbbox()
    out = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    if bbox is None:
        return out
    subject = rgba.crop(bbox)
    # Preserve the generated drawing; resizing here only normalizes cell output to runtime asset size.
    margin = 18
    subject.thumbnail((OUT_SIZE - margin * 2, OUT_SIZE - margin * 2), Image.Resampling.LANCZOS)
    x = (OUT_SIZE - subject.width) // 2
    y = (OUT_SIZE - subject.height) // 2
    out.alpha_composite(subject, (x, y))
    return out


def slice_sheet(uid: str, sheet_path: Path, preserve_idle: bool) -> None:
    sheet = Image.open(sheet_path).convert("RGBA")
    cell_w = sheet.width // CELL_COLS
    cell_h = sheet.height // CELL_ROWS
    for row in range(CELL_ROWS):
        for col, state in enumerate(STATES):
            if preserve_idle and state == "idle":
                continue
            if state not in ACTION_STATES and preserve_idle:
                continue
            cell = sheet.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
            frame = row
            out = UNIT_DIR / f"unit_{uid}_{state}_{frame}.png"
            crop_to_square(cell).save(out)


def validate_assets(ids: list[str]) -> None:
    missing: list[Path] = []
    for uid in ids:
        for state in STATES:
            for frame in range(2):
                path = UNIT_DIR / f"unit_{uid}_{state}_{frame}.png"
                if not path.exists():
                    missing.append(path)
    if missing:
        for path in missing[:50]:
            print(f"missing: {path}", file=sys.stderr)
        raise SystemExit(f"{len(missing)} required unit action frames are missing")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate unit move/attack/death frames from current idle references.")
    parser.add_argument("--model", default="azure/gpt-image-2")
    parser.add_argument("--force", action="store_true", help="Regenerate sheets even when tmp sheets exist.")
    parser.add_argument("--only", nargs="*", help="Optional unit ids to process.")
    parser.add_argument("--preserve-idle", action="store_true", help="Keep existing idle frames instead of replacing them from generated sheet cells.")
    args = parser.parse_args()

    ids = args.only if args.only else unit_ids()
    for index, uid in enumerate(ids, start=1):
        print(f"[{index}/{len(ids)}] generating actions for {uid}", flush=True)
        sheet = run_generation(uid, args.model, args.force)
        slice_sheet(uid, sheet, preserve_idle=args.preserve_idle)
    validate_assets(ids)
    print(f"validated {len(ids)} units x {len(STATES)} states x 2 frames")


if __name__ == "__main__":
    main()
