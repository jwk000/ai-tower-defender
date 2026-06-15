#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
UNIT_DIR = ROOT / "public" / "art" / "units"
SHEET_DIR = ROOT / "tmp" / "ai-tower-attack-sheets"
OUT_SIZE = 256
CHROMA = (0, 255, 0)

TOWERS = {
    "arrow": "arrow tower with twin bow arms; attack detail is bowstring tension, glowing arrow socket, and cyan energy gathering on the bow arms",
    "ballista": "heavy ballista tower; attack detail is tense crossbow arms, glowing bolt socket, and blue charge light on the launcher",
    "bat": "gothic bat tower with red eye core; attack detail is a brighter red eye, purple core glow, and wing-edge energy",
    "cannon": "black iron cannon tower; attack detail is orange heat glow inside the cannon mouth and a compact muzzle flash attached to the barrel",
    "fire": "flame tower brazier; attack detail is a brighter contained flame column and ember glow around the brazier",
    "ice": "jagged ice crystal tower; attack detail is brighter crystal glow, frost aura, and small snow sparkle close to the crown",
    "laser": "arcane laser tower with cyan crystal core; attack detail is only a brighter crystal core, lens glow, and compact top sparkle within the existing tower silhouette",
    "lightning": "tesla coil lightning tower; attack detail is compact yellow electric arcs wrapped around the coil crown",
    "missile": "missile launch tower; attack detail is launch tube heat glow, hatch vibration, and small smoke/flare contained at the tube openings",
    "poison": "toxic alchemy tower; attack detail is brighter green toxic liquid, bubbling tank, and close vapor around the top",
}


def prompt_for(tower_id: str) -> str:
    subject = TOWERS[tower_id]
    laser_extra = ""
    if tower_id == "laser":
        laser_extra = (
            " Special laser tower constraint: both attack frames must have exactly the same tower body size as each other. "
            "Do not draw a tall vertical beam, long horizontal beam, spotlight column, projectile streak, or any effect extending far outside the tower. "
            "The release frame should read as firing only through brighter crystal glow and a compact lens flare near the top."
        )
    return (
        "Create a clean 2 columns x 1 row sprite sheet for the tower attack animation. "
        "Use the provided idle tower images only as identity and scale references, then redraw two new attack frames. "
        "Keep the tower as a building: the base, footprint, center point, silhouette mass, and camera angle must stay fixed between frames. "
        "Do not translate, hop, walk, lean, squash, stretch, rotate, or shift the whole tower. "
        "Only change small weapon and firing-state details attached to the tower body. "
        "Do not draw bullets, arrows, bolts, missiles, fireballs, poison projectiles, lightning shots, laser beams, beam columns, or any outgoing projectile. "
        "Projectile and bullet visuals are rendered by a separate runtime projectile system, so the sprite must not contain them. "
        "Frame 1 is attack anticipation: subtle charge and small glow, no displacement. "
        "Frame 2 is attack release: compact muzzle/core/weapon flash integrated into the tower art, no displacement and no projectile leaving the tower. "
        f"Tower subject: {subject}.{laser_extra} "
        "Style: dark fantasy casual tower defense sprite, stylized 2D hand-painted game art, clean readable silhouette, 3/4 top-down view. "
        "Each cell contains exactly one complete centered tower with generous padding. "
        "Background in every cell must be a perfectly flat solid #00ff00 chroma-key color. "
        "No shadows, no floor, no text, no labels, no grid lines, no separators, no watermark. "
        "Avoid crude vector overlays, ruler-straight construction lines, isolated triangle shapes, simple geometric stickers, UI arrows, or detached projectile shapes. "
        f"Unit id: tower_{tower_id}."
    )


def run_generation(tower_id: str, model: str, force: bool) -> Path:
    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    sheet_path = SHEET_DIR / f"tower_{tower_id}_attack_sheet.png"
    if sheet_path.exists() and not force:
        return sheet_path

    ref0 = UNIT_DIR / f"unit_tower_{tower_id}_idle_0.png"
    ref1 = UNIT_DIR / f"unit_tower_{tower_id}_idle_1.png"
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
        prompt_for(tower_id),
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
            green_dist = abs(r - CHROMA[0]) + abs(g - CHROMA[1]) + abs(b - CHROMA[2])
            if green_dist < 72 or (g > 190 and r < 90 and b < 90):
                pixels[x, y] = (r, g, b, 0)
            elif g > 150 and g > r * 1.55 and g > b * 1.55:
                pixels[x, y] = (r, g, b, max(0, min(a, int((255 - g) * 2.2))))
    return rgba


def transparent_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def crop_to_square(cell: Image.Image, bbox: tuple[int, int, int, int], scale: float) -> Image.Image:
    rgba = remove_chroma(cell)
    out = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    subject = rgba.crop(bbox)
    target_w = max(1, round(subject.width * scale))
    target_h = max(1, round(subject.height * scale))
    subject = subject.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = (OUT_SIZE - subject.width) // 2
    y = (OUT_SIZE - subject.height) // 2
    out.alpha_composite(subject, (x, y))
    return out


def slice_sheet(tower_id: str, sheet_path: Path) -> None:
    sheet = Image.open(sheet_path).convert("RGBA")
    cell_w = sheet.width // 2
    cell_h = sheet.height
    cells = [
        remove_chroma(sheet.crop((frame * cell_w, 0, (frame + 1) * cell_w, cell_h)))
        for frame in range(2)
    ]
    boxes = [transparent_bbox(cell) for cell in cells]
    valid_boxes = [box for box in boxes if box is not None]
    if not valid_boxes:
        for frame in range(2):
            Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0)).save(UNIT_DIR / f"unit_tower_{tower_id}_attack_{frame}.png")
        return

    left = min(box[0] for box in valid_boxes)
    top = min(box[1] for box in valid_boxes)
    right = max(box[2] for box in valid_boxes)
    bottom = max(box[3] for box in valid_boxes)
    union = (left, top, right, bottom)
    scale = min((OUT_SIZE - 36) / max(1, right - left), (OUT_SIZE - 36) / max(1, bottom - top), 1.0)

    for frame, cell in enumerate(cells):
        crop_to_square(cell, union, scale).save(UNIT_DIR / f"unit_tower_{tower_id}_attack_{frame}.png")


def validate_assets(tower_ids: list[str]) -> None:
    missing: list[Path] = []
    for tower_id in tower_ids:
        for frame in range(2):
            path = UNIT_DIR / f"unit_tower_{tower_id}_attack_{frame}.png"
            if not path.exists():
                missing.append(path)
    if missing:
        for path in missing:
            print(f"missing: {path}", file=sys.stderr)
        raise SystemExit(f"{len(missing)} tower attack frames are missing")


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenerate tower attack frames with AI, preserving building anchors.")
    parser.add_argument("--model", default="azure/gpt-image-2")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--only", nargs="*", choices=sorted(TOWERS), help="Optional tower ids to process.")
    args = parser.parse_args()

    tower_ids = args.only if args.only else sorted(TOWERS)
    for index, tower_id in enumerate(tower_ids, start=1):
        print(f"[{index}/{len(tower_ids)}] generating tower attack frames for {tower_id}", flush=True)
        sheet = run_generation(tower_id, args.model, args.force)
        slice_sheet(tower_id, sheet)
    validate_assets(tower_ids)
    print(f"validated {len(tower_ids)} tower attack animations")


if __name__ == "__main__":
    main()
