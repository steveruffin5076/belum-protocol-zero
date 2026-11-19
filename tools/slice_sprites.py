from PIL import Image
import os
import sys


def slice_8frame_grid(sheet_path, output_dir, prefix="frame", margin=3):
    img = Image.open(sheet_path).convert("RGBA")
    total_w, total_h = img.size
    cols, rows = 4, 2
    cell_w = total_w // cols
    cell_h = total_h // rows

    os.makedirs(output_dir, exist_ok=True)
    frames = []

    frame_idx = 0
    for r in range(rows):
        for c in range(cols):
            x1 = c * cell_w + margin
            y1 = r * cell_h + margin
            x2 = (c + 1) * cell_w - margin
            y2 = (r + 1) * cell_h - margin

            box = (x1, y1, x2, y2)
            frame = img.crop(box)
            frame_filename = f"{prefix}_{frame_idx}.png"
            frame_path = os.path.join(output_dir, frame_filename)
            frame.save(frame_path)
            frames.append(frame_path)
            frame_idx += 1

    print(f"[QC PASS] Sliced {frame_idx} frames to {output_dir}")
    return frames


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        pfx = sys.argv[3] if len(sys.argv) > 3 else "frame"
        m = int(sys.argv[4]) if len(sys.argv) > 4 else 3
        slice_8frame_grid(sys.argv[1], sys.argv[2], pfx, margin=m)
