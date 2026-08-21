#!/usr/bin/env python3
"""knockout.py — 3D World helper: background knockout for floating scenes.

Removes the background from a scene still so a subject can float above the
world as a parallax layer (hero product, a building, a character).

Primary path uses `rembg` (U2Net) for accurate cutouts:
    pip install rembg onnxruntime

Fallback path (no rembg) does a simple solid-background flood trim from the
edges — only useful for stills on a plain solid background (the default clay
diorama floating-island look). It also applies an automatic "drop shadow"
optionally.

Examples:
  python3 knockout.py assets/still_shop.png assets/shop-float.png --trim
  python3 knockout.py assets/still_shop.png assets/shop-float.png --bg "#F5EDE0" --shadow
"""
import argparse
import os
import sys


def main():
    ap = argparse.ArgumentParser(description="Cut a subject out of a scene still.")
    ap.add_argument("input", help="input image (png/jpg/webp).")
    ap.add_argument("output", help="output PNG with transparency.")
    ap.add_argument("--trim", action="store_true",
                    help="crop transparent borders after knockout (recommended).")
    ap.add_argument("--bg", help="solid background hex to target in fallback mode "
                                 "(e.g. #F5EDE0). If omitted, corners are sampled.")
    ap.add_argument("--shadow", action="store_true",
                    help="add a soft drop shadow under the subject.")
    ap.add_argument("--bg-remove", action="store_true",
                    help="use the rembg neural model if installed (default: auto).")
    args = ap.parse_args()

    if not os.path.isfile(args.input):
        sys.exit(f"error: no such file: {args.input}")

    try:
        from PIL import Image
    except ImportError:
        sys.exit("error: Pillow is required (pip install Pillow)")

    im = Image.open(args.input).convert("RGBA")

    # ---- try the neural path first ----
    try:
        import rembg  # noqa: F401
        from rembg import remove
        print("using rembg (U2Net)…")
        im = remove(im, post_process_mask=True)
        used_neural = True
    except Exception:
        used_neural = False

    if not used_neural:
        print("rembg not installed — using solid-background fallback "
              "(works for solid-bg stills; pip install rembg for real cutouts)")
        bg = None
        if args.bg:
            bg = tuple(int(args.bg.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
        im = _solid_fallback(im, bg)

    if args.shadow:
        im = _drop_shadow(im)

    if args.trim:
        im = _trim(im)

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    im.save(args.output)
    print(f"wrote {args.output} ({im.size[0]}x{im.size[1]})")


# --------------------------------------------------------------------- helpers

def _solid_fallback(im, bg):
    """Remove near-solid background starting from the image edges (flood fill)."""
    from PIL import ImageChops

    if bg is None:
        w, h = im.size
        corners = [im.getpixel(p) for p in
                   [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
        bg = tuple(int(sum(c[i] for c in corners) / len(corners)) for i in range(3)) + (255,)

    mask = Image.new("L", im.size, 0)
    # Simple distance-from-edge approach: pixels close to bg become transparent.
    px = im.load()
    mpx = mask.load()
    w, h = im.size
    thresh = 28
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            d = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            mpx[x, y] = 255 if d < thresh * 3 else 0
    mask = ImageChops.invert(mask)

    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def _drop_shadow(im):
    from PIL import ImageFilter
    alpha = im.split()[3]
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 90), (0, 0), alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    shadow.paste(im, (0, 0), im.split()[3])
    return shadow


def _trim(im):
    bbox = im.split()[3].getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


if __name__ == "__main__":
    main()
