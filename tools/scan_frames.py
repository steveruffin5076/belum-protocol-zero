import sys
from PIL import Image

def is_ink(p):
    r, g, b, a = p
    return a > 20 and 0.299 * r + 0.587 * g + 0.114 * b < 120

problems = 0
for prefix in sys.argv[1:]:
    sizes, bottoms, heights = set(), [], []
    for i in range(8):
        im = Image.open(f'assets/sprites/frames/{prefix}_{i}.png').convert('RGBA')
        w, h = im.size
        px = im.load()
        sizes.add((w, h))
        lines = [x for x in range(w) if sum(is_ink(px[x, y]) for y in range(h)) > 0.8 * h]
        lines += [y for y in range(h) if sum(is_ink(px[x, y]) for x in range(w)) > 0.8 * w]
        if lines:
            print(f'[FAIL] {prefix}_{i}: grid line at {lines}')
            problems += 1
        ys = [y for y in range(h) for x in range(w) if is_ink(px[x, y])]
        bottoms.append(max(ys))
        heights.append(max(ys) - min(ys))
    print(f'{prefix}: frame sizes {sizes}, baseline spread {max(bottoms) - min(bottoms)} px, '
          f'ink height min/median/max {min(heights)}/{sorted(heights)[4]}/{max(heights)}')
    if len(sizes) != 1:
        print(f'[FAIL] {prefix}: frames have different sizes')
        problems += 1
    if max(bottoms) - min(bottoms) > 3:
        print(f'[FAIL] {prefix}: baseline varies by more than 3 px')
        problems += 1
sys.exit(1 if problems else 0)
