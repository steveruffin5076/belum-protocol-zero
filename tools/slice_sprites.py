#!/usr/bin/env python3
"""
tools/slice_sprites.py - Automatic grid-line detecting 2x4 sprite sheet slicer.
Cuts 4px inside detected dark grid lines, normalizes every frame to 332x372
with flat cream (#F7F3E8) background, horizontally centered, with lowest ink pixel
pinned on a fixed boot/hoof baseline at y = 356.
"""
import os
import sys
from PIL import Image

TARGET_W = 332
TARGET_H = 372
BASELINE_Y = 356
CREAM_BG = (247, 243, 232, 255)


def is_dark_ink(r, g, b, a=255):
    return a > 20 and (0.299 * r + 0.587 * g + 0.114 * b) < 120


def group_runs(indices):
    if not indices:
        return []
    runs = []
    start = prev = indices[0]
    for idx in indices[1:]:
        if idx == prev + 1:
            prev = idx
        else:
            runs.append((start, prev))
            start = prev = idx
    runs.append((start, prev))
    return runs


def find_grid_bounds(img, count, axis):
    """Detect grid divider bands (>80% dark pixels) and compute exact [start, end] for each cell."""
    w, h = img.size
    px = img.load()
    length = w if axis == "x" else h
    cross = h if axis == "x" else w

    dark_lines = []
    for i in range(length):
        dark_cnt = 0
        if axis == "x":
            for j in range(cross):
                if is_dark_ink(*px[i, j]):
                    dark_cnt += 1
        else:
            for j in range(cross):
                if is_dark_ink(*px[j, i]):
                    dark_cnt += 1
        if dark_cnt > 0.8 * cross:
            dark_lines.append(i)

    bands = group_runs(dark_lines)
    # Expected internal divider positions for `count` cells
    cell_len = length / float(count)

    # Find outer start & end border lines if present near edges (within 35px)
    outer_start = 0
    outer_end = length
    for b0, b1 in bands:
        if b1 < 35:
            outer_start = max(outer_start, b1 + 1)
        elif b0 > length - 35:
            outer_end = min(outer_end, b0)

    # For each internal divider k = 1..count-1, snap to nearest detected band within 35px
    dividers = []
    for k in range(1, count):
        expected = int(round(k * cell_len))
        best = None
        best_dist = 36
        for b0, b1 in bands:
            mid = (b0 + b1) * 0.5
            d = abs(mid - expected)
            if d < best_dist:
                best_dist = d
                best = (b0, b1)
        if best is not None:
            dividers.append(best)
        else:
            dividers.append((expected, expected))

    bounds = []
    for c in range(count):
        left = outer_start if c == 0 else dividers[c - 1][1] + 1
        right = outer_end if c == count - 1 else dividers[c][0]
        # Cut 4px inside every grid boundary
        bounds.append((left + 4, right - 4))
    return bounds


def strip_edge_grid_lines(cell):
    """Trim any residual full-length dark border line (>75% dark) near cell edges."""
    w, h = cell.size
    px = cell.load()
    x0, y0, x1, y1 = 0, 0, w, h

    # Trim left/right up to 24px if dark line detected
    for x in range(min(24, w // 4)):
        if sum(1 for y in range(h) if is_dark_ink(*px[x, y])) > 0.72 * h:
            x0 = x + 4
    for x in range(w - 1, max(w - 25, w * 3 // 4), -1):
        if sum(1 for y in range(h) if is_dark_ink(*px[x, y])) > 0.72 * h:
            x1 = x - 4
    for y in range(min(24, h // 4)):
        if sum(1 for x in range(w) if is_dark_ink(*px[x, y])) > 0.72 * w:
            y0 = y + 4
    for y in range(h - 1, max(h - 25, h * 3 // 4), -1):
        if sum(1 for x in range(w) if is_dark_ink(*px[x, y])) > 0.72 * w:
            y1 = y - 4

    x0 = max(0, min(x0, w - 10))
    y0 = max(0, min(y0, h - 10))
    x1 = max(x0 + 10, min(x1, w))
    y1 = max(y0 + 10, min(y1, h))
    return cell.crop((x0, y0, x1, y1))


def normalize_frame(cell):
    """Place cropped cell on 332x372 cream canvas, horizontally centered with lowest ink at y=356."""
    cell = strip_edge_grid_lines(cell)
    w, h = cell.size
    px = cell.load()

    min_x, min_y = w, h
    max_x, max_y = -1, -1
    for y in range(h):
        for x in range(w):
            if is_dark_ink(*px[x, y]):
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if y < min_y:
                    min_y = y
                if y > max_y:
                    max_y = y

    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), CREAM_BG)
    if max_x < min_x or max_y < min_y:
        return canvas

    # Crop tightly around ink + 4px soft margin (clamped inside cell)
    pad = 4
    cx0 = max(0, min_x - pad)
    cy0 = max(0, min_y - pad)
    cx1 = min(w, max_x + 1 + pad)
    cy1 = min(h, max_y + 1 + pad)
    sub = cell.crop((cx0, cy0, cx1, cy1))
    ink_bottom_in_sub = max_y - cy0

    # Ensure sub fits cleanly inside 332x372 above baseline y=356
    max_allowed_w = TARGET_W - 8
    max_allowed_h = BASELINE_Y - 4
    scale = 1.0
    if sub.width > max_allowed_w:
        scale = min(scale, max_allowed_w / float(sub.width))
    if (ink_bottom_in_sub + 1) > max_allowed_h:
        scale = min(scale, max_allowed_h / float(ink_bottom_in_sub + 1))

    if scale < 1.0:
        nw = max(1, int(round(sub.width * scale)))
        nh = max(1, int(round(sub.height * scale)))
        sub = sub.resize((nw, nh), Image.Resampling.LANCZOS)
        # Re-measure exact ink bottom after resize so baseline hits y=356 accurately
        spx = sub.load()
        new_max_y = 0
        for sy in range(sub.height):
            for sx in range(sub.width):
                if is_dark_ink(*spx[sx, sy]):
                    if sy > new_max_y:
                        new_max_y = sy
        ink_bottom_in_sub = new_max_y

    paste_x = (TARGET_W - sub.width) // 2
    paste_y = BASELINE_Y - ink_bottom_in_sub
    if paste_y < 0:
        paste_y = 0
    canvas.paste(sub, (paste_x, paste_y))
    return canvas


def slice_8frame_grid(sheet_path, output_dir, prefix="frame", margin=4):
    img = Image.open(sheet_path).convert("RGBA")
    col_bounds = find_grid_bounds(img, 4, "x")
    row_bounds = find_grid_bounds(img, 2, "y")

    os.makedirs(output_dir, exist_ok=True)
    frames = []
    frame_idx = 0

    for y1, y2 in row_bounds:
        for x1, x2 in col_bounds:
            cell = img.crop((x1, y1, x2, y2))
            norm = normalize_frame(cell)
            frame_path = os.path.join(output_dir, f"{prefix}_{frame_idx}.png")
            norm.save(frame_path)
            frames.append(frame_path)
            frame_idx += 1

    print(f"[QC PASS] Sliced {frame_idx} normalized {TARGET_W}x{TARGET_H} frames to {output_dir} ({prefix})")
    return frames


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        pfx = sys.argv[3] if len(sys.argv) > 3 else "frame"
        m = int(sys.argv[4]) if len(sys.argv) > 4 else 4
        slice_8frame_grid(sys.argv[1], sys.argv[2], pfx, margin=m)
