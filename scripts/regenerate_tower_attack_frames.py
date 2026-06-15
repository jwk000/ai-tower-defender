#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
UNIT_DIR = ROOT / "public" / "art" / "units"
SIZE = 256
CENTER = SIZE // 2

TOWERS = (
    "arrow",
    "ballista",
    "bat",
    "cannon",
    "fire",
    "ice",
    "laser",
    "lightning",
    "missile",
    "poison",
)


def load_idle(tower_id: str, frame: int) -> Image.Image:
    return Image.open(UNIT_DIR / f"unit_tower_{tower_id}_idle_{frame}.png").convert("RGBA")


def save_attack(tower_id: str, frame: int, image: Image.Image) -> None:
    image.save(UNIT_DIR / f"unit_tower_{tower_id}_attack_{frame}.png")


def glow_layer() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    return layer, ImageDraw.Draw(layer, "RGBA")


def composite_glow(base: Image.Image, layer: Image.Image, blur: float = 3.0) -> Image.Image:
    out = base.copy()
    out.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    out.alpha_composite(layer)
    return out


def draw_arrow_release(base: Image.Image, frame: int) -> Image.Image:
    layer, draw = glow_layer()
    y = 111 if frame == 0 else 100
    tip_x = 142 if frame == 0 else 182
    tail_x = 86 if frame == 0 else 117
    draw.line((tail_x, y, tip_x, y - 8), fill=(115, 245, 255, 230), width=5)
    draw.polygon(
        [(tip_x + 13, y - 10), (tip_x - 3, y - 20), (tip_x + 2, y + 1)],
        fill=(205, 255, 255, 245),
    )
    draw.line((tail_x - 10, y + 4, tail_x + 8, y + 1), fill=(63, 190, 255, 120), width=2)
    return composite_glow(base, layer)


def draw_ballista_release(base: Image.Image, frame: int) -> Image.Image:
    layer, draw = glow_layer()
    y = 112 if frame == 0 else 96
    tip_x = 150 if frame == 0 else 198
    tail_x = 68 if frame == 0 else 104
    draw.line((tail_x, y + 8, tip_x, y - 13), fill=(105, 170, 255, 235), width=9)
    draw.line((tail_x - 12, y + 13, tip_x - 12, y - 7), fill=(40, 100, 210, 140), width=4)
    draw.polygon(
        [(tip_x + 18, y - 17), (tip_x - 7, y - 31), (tip_x - 2, y + 2)],
        fill=(215, 235, 255, 250),
    )
    return composite_glow(base, layer)


def draw_cannon_flash(base: Image.Image, frame: int) -> Image.Image:
    layer, draw = glow_layer()
    cx, cy = (178, 101) if frame == 0 else (193, 91)
    r = 18 if frame == 0 else 28
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 129, 31, 185))
    draw.polygon(
        [(cx + 4, cy - r - 14), (cx + r + 28, cy - 8), (cx + r + 6, cy + 7)],
        fill=(255, 210, 80, 225),
    )
    draw.ellipse((cx - 7, cy - 7, cx + 8, cy + 8), fill=(255, 245, 185, 240))
    draw.arc((cx - 45, cy - 30, cx + 48, cy + 28), 310, 40, fill=(80, 75, 72, 130), width=5)
    return composite_glow(base, layer, 4.5)


def draw_fire_burst(base: Image.Image, frame: int) -> Image.Image:
    layer, draw = glow_layer()
    cx, cy = CENTER, 83
    scale = 1 if frame == 0 else 1.35
    draw.polygon(
        [
            (cx - 22, cy + 21),
            (cx - 9, cy - int(39 * scale)),
            (cx + 4, cy - 11),
            (cx + 16, cy - int(51 * scale)),
            (cx + 27, cy + 22),
        ],
        fill=(255, 91, 19, 210),
    )
    draw.polygon(
        [(cx - 11, cy + 13), (cx + 1, cy - int(26 * scale)), (cx + 13, cy + 14)],
        fill=(255, 224, 89, 230),
    )
    for dx, dy in [(-36, -3), (34, -12), (-24, -34), (25, -38)]:
        rr = 4 if frame == 0 else 6
        draw.ellipse((cx + dx - rr, cy + dy - rr, cx + dx + rr, cy + dy + rr), fill=(255, 126, 26, 180))
    return composite_glow(base, layer, 4.0)


def draw_ice_shot(base: Image.Image, frame: int) -> Image.Image:
    layer, draw = glow_layer()
    cx, cy = CENTER, 76
    length = 43 if frame == 0 else 74
    draw.line((cx - 8, cy + 26, cx + length, cy - 28), fill=(174, 241, 255, 220), width=5)
    draw.polygon(
        [(cx + length + 13, cy - 34), (cx + length - 9, cy - 42), (cx + length - 2, cy - 18)],
        fill=(226, 255, 255, 235),
    )
    for offset in (-20, 0, 20):
        draw.line((cx + offset, cy - 6, cx + offset + 9, cy - 24), fill=(134, 215, 255, 145), width=2)
    return composite_glow(base, layer)


def draw_laser_beam(base: Image.Image, frame: int) -> Image.Image:
    layer, draw = glow_layer()
    y = 93
    end_x = 181 if frame == 0 else 244
    draw.line((128, y, end_x, y - 8), fill=(125, 255, 255, 225), width=7)
    draw.line((128, y, end_x, y - 8), fill=(226, 120, 255, 165), width=14)
    draw.ellipse((113, y - 17, 143, y + 13), fill=(175, 255, 255, 180))
    return composite_glow(base, layer, 5.0)


def draw_lightning_arc(base: Image.Image, frame: int) -> Image.Image:
    layer, draw = glow_layer()
    points = [(128, 73), (148, 51), (138, 87), (168, 60), (158, 101), (194, 72)]
    if frame == 1:
        points = [(125, 70), (154, 39), (144, 80), (183, 48), (170, 96), (222, 57)]
    draw.line(points, fill=(255, 242, 90, 240), width=5, joint="curve")
    draw.line(points, fill=(255, 255, 220, 245), width=2, joint="curve")
    draw.ellipse((116, 58, 140, 82), fill=(255, 229, 63, 115))
    return composite_glow(base, layer, 4.0)


def draw_bat_signal(base: Image.Image, frame: int) -> Image.Image:
    layer, draw = glow_layer()
    cx, cy = CENTER, 82
    r = 17 if frame == 0 else 25
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(176, 49, 255, 130))
    draw.polygon(
        [(cx + 12, cy - 4), (cx + 34, cy - 20), (cx + 28, cy + 2), (cx + 42, cy + 15), (cx + 16, cy + 11)],
        fill=(198, 82, 255, 185),
    )
    draw.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=(255, 52, 75, 230))
    return composite_glow(base, layer, 4.5)


def draw_missile_launch(base: Image.Image, frame: int) -> Image.Image:
    layer, draw = glow_layer()
    x, y = (154, 80) if frame == 0 else (183, 48)
    draw.polygon([(x - 8, y + 24), (x + 9, y + 17), (x + 16, y - 15), (x, y - 27), (x - 14, y - 10)], fill=(82, 92, 108, 245))
    draw.polygon([(x, y - 29), (x + 16, y - 15), (x + 3, y - 8)], fill=(224, 65, 56, 245))
    draw.polygon([(x - 9, y + 25), (x - 21, y + 52), (x + 4, y + 32)], fill=(255, 126, 28, 220))
    draw.polygon([(x - 5, y + 26), (x - 12, y + 43), (x + 2, y + 32)], fill=(255, 234, 95, 235))
    return composite_glow(base, layer, 4.0)


def draw_poison_spurt(base: Image.Image, frame: int) -> Image.Image:
    layer, draw = glow_layer()
    cx, cy = CENTER, 91
    reach = 45 if frame == 0 else 77
    draw.arc((cx - 10, cy - 42, cx + reach, cy + 20), 202, 326, fill=(105, 244, 76, 210), width=7)
    for i, (dx, dy) in enumerate([(35, -26), (52, -35), (70, -23), (45, -8)]):
        rr = (5 + i % 2) if frame == 0 else (7 + i % 2)
        draw.ellipse((cx + dx - rr, cy + dy - rr, cx + dx + rr, cy + dy + rr), fill=(123, 255, 69, 180))
    return composite_glow(base, layer, 4.0)


DRAWERS = {
    "arrow": draw_arrow_release,
    "ballista": draw_ballista_release,
    "bat": draw_bat_signal,
    "cannon": draw_cannon_flash,
    "fire": draw_fire_burst,
    "ice": draw_ice_shot,
    "laser": draw_laser_beam,
    "lightning": draw_lightning_arc,
    "missile": draw_missile_launch,
    "poison": draw_poison_spurt,
}


def main() -> None:
    for tower_id in TOWERS:
        draw_attack = DRAWERS[tower_id]
        for frame in (0, 1):
            base = load_idle(tower_id, frame)
            save_attack(tower_id, frame, draw_attack(base, frame))
        print(f"regenerated tower attack frames: {tower_id}")


if __name__ == "__main__":
    main()
