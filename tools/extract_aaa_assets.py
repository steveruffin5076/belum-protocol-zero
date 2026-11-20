#!/usr/bin/env python3
"""
tools/extract_aaa_assets.py
Extracts & flood-fill keys Task A (buildings + biome extras) and Task B (64x64 survival icons)
from the generated Prussian-Blue-on-Parchment master sheets into transparent PNGs.
"""
import os
from collections import deque
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACT_DIR = "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/20496dfa-f34a-4b58-ad06-a09f0b96f51e"

BUILDINGS_SRC = os.path.join(ARTIFACT_DIR, "military_bunker_kit_1795135893123.jpg")
BIOME_SRC = os.path.join(ARTIFACT_DIR, "biome_extras_sheet_1795135896030.jpg")
ITEMS_SRC = os.path.join(ARTIFACT_DIR, "survival_items_8icons_1795135894913.jpg")


def key_exterior_parchment(img, tolerance=38, soft_band=16):
    """Flood-fill remove exterior parchment background from borders, preserving interior fills."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    # Sample border corners for parchment tone
    samples = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3]]
    bg_r = sum(s[0] for s in samples) / 4.0
    bg_g = sum(s[1] for s in samples) / 4.0
    bg_b = sum(s[2] for s in samples) / 4.0

    def color_dist(r, g, b):
        return ((r - bg_r) ** 2 + (g - bg_g) ** 2 + (b - bg_b) ** 2) ** 0.5

    def is_parchment(r, g, b):
        # Warm light cream paper, low saturation (not crimson glow or Prussian blue ink)
        if r < 185 or g < 175 or b < 155:
            return False
        if (r - b) > 48:  # protect crimson/warm red tints
            return False
        return color_dist(r, g, b) <= tolerance

    visited = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            idx = y * w + x
            if not visited[idx] and is_parchment(*px[x, y][:3]):
                visited[idx] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            idx = y * w + x
            if not visited[idx] and is_parchment(*px[x, y][:3]):
                visited[idx] = 1
                q.append((x, y))

    while q:
        cx, cy = q.popleft()
        px[cx, cy] = (0, 0, 0, 0)
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if not visited[nidx]:
                    r, g, b, a = px[nx, ny]
                    if is_parchment(r, g, b):
                        visited[nidx] = 1
                        q.append((nx, ny))

    # Soft feather 1px fringe pixels adjacent to transparent exterior
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            adj_clear = (
                px[x - 1, y][3] == 0
                or px[x + 1, y][3] == 0
                or px[x, y - 1][3] == 0
                or px[x, y + 1][3] == 0
            )
            if adj_clear:
                d = color_dist(r, g, b)
                if d < tolerance + soft_band and r > 180 and g > 170 and (r - b) < 42:
                    alpha = int(max(0, min(255, ((d - tolerance * 0.5) / (soft_band + tolerance * 0.5)) * 255)))
                    px[x, y] = (r, g, b, alpha)

    return rgba


def trim_alpha(rgba, pad=6):
    bbox = rgba.getbbox()
    if not bbox:
        return rgba
    w, h = rgba.size
    x0 = max(0, bbox[0] - pad)
    y0 = max(0, bbox[1] - pad)
    x1 = min(w, bbox[2] + pad)
    y1 = min(h, bbox[3] + pad)
    return rgba.crop((x0, y0, x1, y1))


def fit_square(rgba, size=64, pad=4):
    trimmed = trim_alpha(rgba, pad=2)
    inner = size - pad * 2
    scale = min(inner / max(1, trimmed.width), inner / max(1, trimmed.height))
    nw = max(1, int(round(trimmed.width * scale)))
    nh = max(1, int(round(trimmed.height * scale)))
    resized = trimmed.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def main():
    buildings_dir = os.path.join(REPO_ROOT, "assets", "buildings")
    env_dir = os.path.join(REPO_ROOT, "assets", "environment")
    items_dir = os.path.join(REPO_ROOT, "assets", "ui", "items")
    os.makedirs(buildings_dir, exist_ok=True)
    os.makedirs(env_dir, exist_ok=True)
    os.makedirs(items_dir, exist_ok=True)

    # 1. Military Bunker & Buildings Kit
    b_img = Image.open(BUILDINGS_SRC).convert("RGB")
    b_img.save(os.path.join(buildings_dir, "military_bunker_kit.png"))
    bw, bh = b_img.size
    building_crops = {
        "logging_barracks.png": (0.02, 0.02, 0.36, 0.56),
        "generator_shed.png": (0.37, 0.08, 0.62, 0.54),
        "blast_bunker_door.png": (0.63, 0.03, 0.98, 0.56),
        "keycard_pedestal.png": (0.22, 0.54, 0.42, 0.96),
        "culvert_grate.png": (0.50, 0.54, 0.80, 0.96),
    }
    for name, (x0, y0, x1, y1) in building_crops.items():
        crop = b_img.crop((int(bw * x0), int(bh * y0), int(bw * x1), int(bh * y1)))
        keyed = trim_alpha(key_exterior_parchment(crop, tolerance=42), pad=4)
        # Scale down reasonably for fast canvas rendering while staying crisp
        max_dim = 360
        if max(keyed.size) > max_dim:
            sc = max_dim / max(keyed.size)
            keyed = keyed.resize((int(keyed.width * sc), int(keyed.height * sc)), Image.Resampling.LANCZOS)
        out = os.path.join(buildings_dir, name)
        keyed.save(out)
        print(f"[BUILDING] {name}: {keyed.size}")

    # 2. Biome Extras (Canopy Tree, Mud Rocks, Mutated Rafflesia)
    e_img = Image.open(BIOME_SRC).convert("RGB")
    e_img.save(os.path.join(env_dir, "biome_extras_sheet.png"))
    ew, eh = e_img.size
    biome_crops = {
        "ancient_canopy_tree.png": (0.018, 0.015, 0.335, 0.97),
        "riverbank_mud_rocks.png": (0.33, 0.25, 0.66, 0.76),
        "mutated_rafflesia.png": (0.66, 0.24, 0.99, 0.78),
    }
    for name, (x0, y0, x1, y1) in biome_crops.items():
        crop = e_img.crop((int(ew * x0), int(eh * y0), int(ew * x1), int(eh * y1)))
        tol = 34 if "rafflesia" in name else 42
        keyed = trim_alpha(key_exterior_parchment(crop, tolerance=tol), pad=4)
        max_dim = 340 if "tree" in name else 240
        if max(keyed.size) > max_dim:
            sc = max_dim / max(keyed.size)
            keyed = keyed.resize((int(keyed.width * sc), int(keyed.height * sc)), Image.Resampling.LANCZOS)
        out = os.path.join(env_dir, name)
        keyed.save(out)
        print(f"[BIOME] {name}: {keyed.size}")

    # 3. 8 Survival & Weapon Icons (2x4 uniform grid -> 64x64 transparent PNGs)
    i_img = Image.open(ITEMS_SRC).convert("RGB")
    i_img.save(os.path.join(items_dir, "survival_items_sheet.png"))
    iw, ih = i_img.size
    icon_names = [
        ["parang.png", "crossbow.png", "pistol_9mm.png", "decoy_rocks.png"],
        ["canteen.png", "bamboo_shoots.png", "keycard.png", "usb_drive.png"],
    ]
    cw = iw / 4.0
    ch = ih / 2.0
    for r in range(2):
        for c in range(4):
            crop = i_img.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)))
            keyed = key_exterior_parchment(crop, tolerance=42)
            icon64 = fit_square(keyed, size=64, pad=4)
            out = os.path.join(items_dir, icon_names[r][c])
            icon64.save(out)
            print(f"[ICON 64x64] {icon_names[r][c]}: {icon64.size}")


if __name__ == "__main__":
    main()
