#!/usr/bin/env python3
"""make_sprite_sheet.py — 3D World helper: pack extracted frames into a sheet.

Turns a folder of frame_00001.png ... (as produced by extract_frames.py) into
one sprite sheet PNG + a matching sheet descriptor the scrub engine can use:

  {"src": "sprites/trailhead.png", "cols": 4, "rows": 2, "count": 8, "fps": 12}

Engine usage: section.sheet = that object (sprite mode), or point the canvas
at the sheet with manifest fps.

Requires Pillow.

Example:
  python3 make_sprite_sheet.py sprites/trailhead sprites/trailhead.png --fps 12
"""
import argparse
import json
import math
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("error: Pillow is required (pip install Pillow)")


def main():
    ap = argparse.ArgumentParser(description="Pack numbered frames into a sprite sheet.")
    ap.add_argument("frames_dir", help="directory of frame_%05d.png images.")
    ap.add_argument("out_png", help="output sprite sheet path (e.g. sprites/valley.png).")
    ap.add_argument("--fps", type=float, default=12, help="capture fps (default 12).")
    ap.add_argument("--cols", type=int, default=0,
                    help="columns (default: square-ish grid from frame count).")
    args = ap.parse_args()

    frames = sorted(
        f for f in os.listdir(args.frames_dir)
        if f.lower().endswith((".png", ".jpg", ".webp")))
    if not frames:
        sys.exit(f"error: no frames found in {args.frames_dir}")

    imgs = [Image.open(os.path.join(args.frames_dir, f)) for f in frames]
    w, h = imgs[0].size
    if any(im.size != (w, h) for im in imgs):
        sys.exit("error: all frames must have identical dimensions")

    n = len(imgs)
    cols = args.cols or math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    sheet = Image.new("RGB", (cols * w, rows * h), (0, 0, 0))
    for i, im in enumerate(imgs):
        sheet.paste(im, ((i % cols) * w, (i // cols) * h))

    os.makedirs(os.path.dirname(args.out_png) or ".", exist_ok=True)
    sheet.save(args.out_png)
    desc = {
        "src": args.out_png,
        "cols": cols,
        "rows": rows,
        "count": n,
        "fps": args.fps,
    }
    desc_path = os.path.splitext(args.out_png)[0] + ".json"
    with open(desc_path, "w") as f:
        json.dump(desc, f, indent=2)
    print(f"packed {n} frames ({w}x{h}) -> {args.out_png} ({cols}x{rows} grid)")
    print(f"sheet descriptor: {desc_path}")


if __name__ == "__main__":
    main()
