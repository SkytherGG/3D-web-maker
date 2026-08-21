#!/usr/bin/env python3
"""build_timeline.py — 3D World helper: stitch the clip chain into one video.

Takes a manifest.json (or explicit file lists) and produces a single
`world.mp4` that the scroll engine can scrub as ONE file — the simplest,
most robust path (no per-seam crossfades needed at the engine level because
the seams are baked in).

All inputs are re-encoded to a uniform 16:9, H.264, GOP 8, faststart, no
audio — the scrub-friendly profile (see references/techniques.md). Each clip
is trimmed to its manifest duration so the total length matches the engine's
timeline.

Requires ffmpeg on PATH.

Examples:
  python3 build_timeline.py --manifest manifest.json --out assets/world.mp4
  python3 build_timeline.py --clips a.mp4 b.mp4 c.mp4 --out world.mp4 --gop 4
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

ENCODE = [
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
    "-g", "{gop}", "-keyint_min", "{gop}", "-sc_threshold", "0",
    "-movflags", "+faststart", "-an",
]


def check_ffmpeg():
    if shutil.which("ffmpeg") is None:
        sys.exit("error: ffmpeg not found on PATH (install it first)")


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def encode_clip(src, dst, duration, gop, width):
    vf = [f"scale=trunc(iw/2)*2:trunc(ih/2)*2"]
    if width:
        vf.append(f"scale='min({width},iw)':-2")
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", src,
           "-t", f"{duration:.3f}",
           "-vf", ",".join(vf), "-unsharp=5:5:0.6:5:5:0.0",
           *[p.format(gop=gop) for p in ENCODE],
           dst]
    subprocess.run(cmd, check=True)


def manifest_clip_list(manifest):
    """Ordered [(clip_path, duration_s)] from a manifest."""
    clips = []
    sections = manifest.get("sections", [])
    connectors = manifest.get("connectors", [])
    for i, s in enumerate(sections):
        if s.get("clip"):
            clips.append((s["clip"], s.get("duration") or 5.0))
        if i < len(connectors) and connectors[i].get("clip"):
            clips.append((connectors[i]["clip"], connectors[i].get("duration") or 2.5))
    return clips


def main():
    ap = argparse.ArgumentParser(
        description="Stitch a chain of clips into one scrub-ready world.mp4.")
    ap.add_argument("--manifest", help="manifest.json to read the chain from.")
    ap.add_argument("--clips", nargs="*", help="explicit ordered clip list (no manifest).")
    ap.add_argument("--out", default="assets/world.mp4", help="output file.")
    ap.add_argument("--gop", type=int, default=8, help="GOP/keyframe interval (4 = mobile-friendly).")
    ap.add_argument("--width", type=int, default=0, help="max width (0 = native).")
    ap.add_argument("--keep-temp", action="store_true", help="keep intermediate encodes.")
    args = ap.parse_args()

    check_ffmpeg()

    if args.manifest:
        with open(args.manifest) as f:
            m = json.load(f)
        clips = manifest_clip_list(m)
        if not clips:
            sys.exit("error: manifest has no clip paths (image-mode worlds don't need stitching)")
        total = sum(d for _, d in clips)
        print(f"chain: {len(clips)} clips, {total:.1f}s total")
    elif args.clips:
        clips = [(c, probe_duration(c)) for c in args.clips]
    else:
        sys.exit("error: provide --manifest or --clips")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="3dworld_")
    encoded = []
    try:
        for i, (src, dur) in enumerate(clips):
            if not os.path.isfile(src):
                sys.exit(f"error: no such clip: {src}")
            enc = os.path.join(tmp, f"seg_{i:03d}.mp4")
            encode_clip(src, enc, dur, args.gop, args.width)
            encoded.append(enc)

        # concat demuxer — identical codecs/params required (we just made them so)
        concat_list = os.path.join(tmp, "list.txt")
        with open(concat_list, "w") as f:
            for enc in encoded:
                f.write(f"file '{enc}'\n")

        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
             "-i", concat_list, "-c", "copy", args.out],
            check=True)
        print(f"wrote {args.out} ({(os.path.getsize(args.out) / 1e6):.1f} MB)")
    finally:
        if not args.keep_temp:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
