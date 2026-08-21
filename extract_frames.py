#!/usr/bin/env python3
"""extract_frames.py — 3D World helper: extract frames from a video clip.

Used for:
  * Boundary frames for frame-locked connectors (last frame of clip_i,
    first frame of clip_{i+1}) — the seam handoff.
  * Full frame sequences for sprite-mode scrubbing.

Requires ffmpeg on PATH.

Examples:
  # Boundary frames (default): first + last frame of a clip
  python3 extract_frames.py dive_trailhead.mp4 seam_trailhead.png

  # Full sequence at 12 fps, 960 px wide, for sprite mode
  python3 extract_frames.py dive_trailhead.mp4 sprites/trailhead --fps 12 --width 960

  # Every 2nd frame only (thinner sprite set)
  python3 extract_frames.py dive_valley.mp4 sprites/valley --fps 12 --step 2
"""
import argparse
import os
import shutil
import subprocess
import sys


def check_ffmpeg():
    if shutil.which("ffmpeg") is None:
        sys.exit("error: ffmpeg not found on PATH (install it first)")


def run(cmd):
    subprocess.run(cmd, check=True)


def extract_boundary(video, first_out, last_out):
    """Extract the very first and very last frames (seam handoff)."""
    run(["ffmpeg", "-v", "error", "-y", "-ss", "0", "-i", video,
         "-frames:v", "1", "-q:v", "2", first_out])
    # -sseof seeks from the end; -0.15 keeps clear of a possible tail freeze
    run(["ffmpeg", "-v", "error", "-y", "-sseof", "-0.15", "-i", video,
         "-frames:v", "1", "-q:v", "2", last_out])
    print(f"boundary frames: {first_out}  {last_out}")


def extract_sequence(video, out_dir, fps, width, step):
    os.makedirs(out_dir, exist_ok=True)
    # Normalize to a constant, non-round fps so frame indices are stable.
    vf = "fps=%s,scale='min(%d,iw)':-2" % (fps, width)
    vf += f",select='not(mod(n\\,{step}))'"
    vf += ",setpts=N/FRAME_RATE/TB"
    run(["ffmpeg", "-v", "error", "-y", "-i", video,
         "-vf", vf, "-q:v", "2",
         os.path.join(out_dir, "frame_%05d.png")])
    n = len([f for f in os.listdir(out_dir) if f.startswith("frame_")])
    print(f"extracted {n} frames ({fps} fps, step {step}) -> {out_dir}")


def main():
    ap = argparse.ArgumentParser(
        description="Extract boundary frames or a full frame sequence from a video.")
    ap.add_argument("video", help="input video (mp4/webm/...).")
    ap.add_argument("output", help="single PNG (boundary mode) or a directory (sequence mode).")
    ap.add_argument("--fps", type=float, default=12,
                    help="frame rate for sequence mode (default 12).")
    ap.add_argument("--width", type=int, default=1280,
                    help="max width for sequence mode (default 1280, keeps aspect).")
    ap.add_argument("--step", type=int, default=1,
                    help="keep every Nth frame (default 1).")
    ap.add_argument("--sequence", action="store_true",
                    help="extract a full sequence instead of boundary frames.")
    args = ap.parse_args()

    check_ffmpeg()
    if not os.path.isfile(args.video):
        sys.exit(f"error: no such file: {args.video}")

    if args.sequence:
        extract_sequence(args.video, args.output, args.fps, args.width, args.step)
    else:
        if args.output.lower().endswith(".png"):
            first = args.output
            last = os.path.splitext(args.output)[0] + "_last.png"
        else:
            first = os.path.join(args.output, "first.png")
            last = os.path.join(args.output, "last.png")
        os.makedirs(os.path.dirname(first) or ".", exist_ok=True)
        extract_boundary(args.video, first, last)


if __name__ == "__main__":
    main()
