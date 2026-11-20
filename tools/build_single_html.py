#!/usr/bin/env python3
"""Bundle Belum: Protocol Zero (Act 1) into a single self-contained index.html + downloadable .zip."""

import base64
import io
import json
import os
import re
import zipfile
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(ROOT, "dist")


def key_exterior_parchment(img: Image.Image) -> Image.Image:
    """Flood-fill exterior cream parchment background to transparent alpha, keeping interior silhouette opaque."""
    im = img.convert("RGBA")
    w, h = im.size
    px = im.load()

    def is_paper(r, g, b, a):
        if a < 20:
            return True
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        sat = max_c - min_c
        luma = 0.299 * r + 0.587 * g + 0.114 * b
        return luma > 188 and sat < 62 and r > 175 and g > 165 and b > 135

    visited = bytearray(w * h)
    q = deque()

    def push(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        pos = y * w + x
        if visited[pos]:
            return
        r, g, b, a = px[x, y]
        if is_paper(r, g, b, a):
            visited[pos] = 1
            q.append((x, y))

    for x in range(w):
        for y in (0, 1, 3, h - 1, h - 2, h - 4):
            push(x, y)
    for y in range(h):
        for x in (0, 1, 3, w - 1, w - 2, w - 4):
            push(x, y)

    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        if x > 0:
            push(x - 1, y)
        if x + 1 < w:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y + 1 < h:
            push(x, y + 1)

    # Trim outer 3px border ring
    for x in range(w):
        for y in range(3):
            px[x, y] = (0, 0, 0, 0)
            px[x, h - 1 - y] = (0, 0, 0, 0)
    for y in range(h):
        for x in range(3):
            px[x, y] = (0, 0, 0, 0)
            px[w - 1 - x, y] = (0, 0, 0, 0)

    return im


def encode_webp_data_uri(path: str, max_side: int, prekey: bool) -> str:
    im = Image.open(path).convert("RGBA")
    if prekey:
        im = key_exterior_parchment(im)
    w, h = im.size
    if max(w, h) > max_side:
        scale = max_side / float(max(w, h))
        im = im.resize((max(1, int(round(w * scale))), max(1, int(round(h * scale)))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="WEBP", quality=88, method=6)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/webp;base64,{b64}"


def build():
    os.makedirs(DIST_DIR, exist_ok=True)

    # 1. Collect and inline all used visual assets (56 sliced sprite frames + 5 environment PNGs)
    inline_assets = {}
    frames_dir = os.path.join(ROOT, "assets", "sprites", "frames")
    for fname in sorted(os.listdir(frames_dir)):
        if fname.endswith(".png"):
            rel = f"assets/sprites/frames/{fname}"
            inline_assets[rel] = encode_webp_data_uri(os.path.join(frames_dir, fname), max_side=192, prekey=True)

    env_specs = [
        ("assets/environment/paper_bg.png", 256, False),
        ("assets/environment/hollow_log.png", 340, True),
        ("assets/environment/fern_clump.png", 300, True),
        ("assets/environment/bamboo_cluster.png", 320, True),
        ("assets/environment/gate_blast_door.png", 360, True),
        ("assets/environment/ancient_canopy_tree.png", 340, False),
        ("assets/environment/riverbank_mud_rocks.png", 240, False),
        ("assets/environment/mutated_rafflesia.png", 240, False),
        ("assets/buildings/logging_barracks.png", 360, False),
        ("assets/buildings/generator_shed.png", 300, False),
        ("assets/buildings/blast_bunker_door.png", 360, False),
        ("assets/buildings/keycard_pedestal.png", 240, False),
        ("assets/buildings/culvert_grate.png", 300, False),
        ("assets/ui/items/parang.png", 64, False),
        ("assets/ui/items/crossbow.png", 64, False),
        ("assets/ui/items/pistol_9mm.png", 64, False),
        ("assets/ui/items/decoy_rocks.png", 64, False),
        ("assets/ui/items/canteen.png", 64, False),
        ("assets/ui/items/bamboo_shoots.png", 64, False),
        ("assets/ui/items/keycard.png", 64, False),
        ("assets/ui/items/usb_drive.png", 64, False),
    ]
    for rel, max_side, prekey in env_specs:
        full = os.path.join(ROOT, rel)
        if os.path.exists(full):
            inline_assets[rel] = encode_webp_data_uri(full, max_side=max_side, prekey=prekey)

    # 2. Read HTML, CSS, and ordered JS scripts from index.html
    with open(os.path.join(ROOT, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(ROOT, "style.css"), "r", encoding="utf-8") as f:
        css = f.read()

    # Inline stylesheet
    html = re.sub(
        r'<link\s+rel="stylesheet"\s+href="style\.css"\s*/?>',
        f"<style>\n{css}\n</style>",
        html,
    )

    # Inline HTML <img src="assets/ui/items/..."> icons for 100% offline playback
    for rel, uri in inline_assets.items():
        if rel.startswith("assets/ui/items/"):
            html = html.replace(f'src="{rel}"', f'src="{uri}"')

    # Extract script list in exact order
    script_paths = re.findall(r'<script\s+src="(src/[^"]+\.js)"></script>', html)

    bundled_js_parts = []
    # Asset resolver shim + pre-keyed flag (so browser skips redundant flood-fill CPU pass)
    resolver_js = (
        "window.BELUM_INLINE_ASSETS = "
        + json.dumps(inline_assets, separators=(",", ":"))
        + ";\n"
        "window.BELUM_ASSETS_PREKEYED = true;\n"
        "window.__resolveBelumAsset = function(p) {\n"
        "  return (window.BELUM_INLINE_ASSETS && window.BELUM_INLINE_ASSETS[p]) || p;\n"
        "};\n"
    )
    bundled_js_parts.append(resolver_js)

    for rel_js in script_paths:
        with open(os.path.join(ROOT, rel_js), "r", encoding="utf-8") as f:
            code = f.read()
        # Route asset loads through inline data URI map
        code = code.replace(
            "img.src = 'assets/environment/paper_bg.png';",
            "img.src = window.__resolveBelumAsset('assets/environment/paper_bg.png');",
        )
        code = code.replace(
            "img.src = `${base}/${prefix}_${idx}.png`;",
            "img.src = window.__resolveBelumAsset(`${base}/${prefix}_${idx}.png`);",
        )
        code = code.replace(
            "img.src = src;",
            "img.src = window.__resolveBelumAsset(src);",
        )
        # Skip flood-fill pass when pre-keyed alpha is baked into WebP frames
        code = code.replace(
            "function keyExteriorParchment(img) {",
            "function keyExteriorParchment(img) {\n    if (typeof window !== 'undefined' && window.BELUM_ASSETS_PREKEYED) return img;",
        )
        # Prevent accidental script tag termination
        code = code.replace("</script>", "<\\/script>")
        bundled_js_parts.append(f"\n/* === {rel_js} === */\n{code}")

    # Remove external script tags and replace with single inline bundle
    first_script_match = re.search(r'<script\s+src="src/[^"]+\.js"></script>', html)
    html_no_scripts = re.sub(r'\s*<script\s+src="src/[^"]+\.js"></script>', "", html)
    bundle_tag = "\n  <script>\n" + "\n".join(bundled_js_parts) + "\n  </script>\n</body>"
    single_html = html_no_scripts.replace("</body>", bundle_tag)

    out_html = os.path.join(DIST_DIR, "index.html")
    with open(out_html, "w", encoding="utf-8") as f:
        f.write(single_html)

    # 3. Zip single self-contained index.html into dist/belum-protocol-zero-act1.zip
    out_zip = os.path.join(DIST_DIR, "belum-protocol-zero-act1.zip")
    with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zf.write(out_html, arcname="index.html")

    html_kb = os.path.getsize(out_html) / 1024.0
    zip_kb = os.path.getsize(out_zip) / 1024.0
    print(f"[BUILD PASS] Single-file HTML: {out_html} ({html_kb:.1f} KB, {len(inline_assets)} inlined assets)")
    print(f"[BUILD PASS] Downloadable ZIP: {out_zip} ({zip_kb:.1f} KB)")


if __name__ == "__main__":
    build()
