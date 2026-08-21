#!/usr/bin/env python3
"""motion_render.py — 3D World helper: render a STILL into a real scrubbable .mp4.

This is the tool that makes the "video-scroll" landing page work in Arena
Agent Mode (and anywhere else there is NO AI video-generation model). An image
model produces a cohesive still; this script turns that still into a genuine
H.264 clip with a smooth, designed camera move — and encodes it specifically
for scrubbing (the scroll engine sets video.currentTime every rendered frame).

The result is real video, not a Ken-Burns CSS animation: as the visitor scrolls,
the browser scrubs actual video frames, exactly like an Apple product page.

Requires ffmpeg on PATH (or --ffmpeg /PATH/TO/ffmpeg). Works with the static
ffmpeg binary shipped by `pip install imageio-ffmpeg`.

Examples
--------
  # Classic slow push-in toward the centre
  python3 motion_render.py still_hero.png assets/vid/hero.mp4 --move push

  # Lateral pan with a gentle zoom
  python3 motion_render.py still_shop.png  assets/vid/shop.mp4  --move pan

  # 3D parallax: a foreground cutout (PNG w/ alpha) drifts faster than the back
  python3 motion_render.py still_shop.png assets/vid/shop.mp4 --fg hero-float.png \
      --fg-speed 1.6 --move dolly --fx 0.5 --fy 0.5

Move library (--move)
---------------------
  push     slow zoom-in to a focal point         (default fx=fy=0.5 = centre)
  pull     slow zoom-out revealing the whole world
  pan      lateral slide (--dx controls direction/speed)
  panup    tilt up: zoom + rise (reveal verticals)
  drift    diagonal glide + gentle zoom
  dolly    zoom toward an arbitrary focal point  (--fx, --fy as 0..1 fractions)
  orbit    subtle in-plane rotation + zoom (fake 3D turn)
  rise     zoom-out + rise (scale reveal, hero moments)
  swoop    ease out then in (dolly-in-then-out; dramatic)

Quality defaults baked in (do not override casually)
---------------------------------------------------
  - smoothstep ease (no sudden start/stop — the #1 cause of "cheap" motion)
  - input is upscaled before zoompan, so moves are sub-pixel smooth (no jitter)
  - H.264 yuv420p, GOP 8 (low seek cost while scrubbing), +faststart, no audio
"""
import argparse
import os
import shutil
import subprocess
import sys


def check_ffmpeg(exe):
    if exe:
        return exe
    if shutil.which("ffmpeg"):
        return "ffmpeg"
    # Fall back to the static binary bundled with imageio-ffmpeg, if present.
    try:
        import imageio_ffmpeg
        p = imageio_ffmpeg.get_ffmpeg_exe()
        if os.path.isfile(p):
            return p
    except Exception:
        pass
    sys.exit("error: ffmpeg not found (install it, or pass --ffmpeg /path/to/ffmpeg)")


def smoothstep_expr(var="p"):
    # var in 0..1 -> smoothstep in 0..1
    return f"({var}*{var}*(3-2*{var}))"


def build_zoompan(args, frames):
    """Return (pre_filter, zoompan_filter, overlay_filter) strings."""
    dur = frames  # zoompan d = number of output frames per input frame
    last = frames - 1 if frames > 1 else 1
    p = f"(on/{last})"
    e = smoothstep_expr(p)
    w, h = args.size

    # Per-move default zoom ranges (only used when the user didn't pass --z0/--z1).
    _def = {
        "push":  (1.00, 1.35), "pull":  (1.35, 1.00),
        "pan":   (1.10, 1.16), "panup": (1.12, 1.26),
        "drift": (1.05, 1.18), "dolly": (1.00, 1.40),
        "orbit": (1.05, 1.15), "rise":  (1.30, 1.00),
        "swoop": (1.35, 1.00),
    }
    if args.move not in _def:
        sys.exit(f"error: unknown --move {args.move}")
    dz0, dz1 = _def[args.move]
    z0 = args.z0 if args.z0 is not None else dz0
    z1 = args.z1 if args.z1 is not None else dz1
    dx, dy, fx, fy = 0.0, 0.0, 0.5, 0.5
    if args.move == "push":
        fx, fy = args.fx, args.fy
    elif args.move == "pull":
        fx, fy = args.fx, args.fy
    elif args.move == "pan":
        dx, dy = args.dx, 0.0
    elif args.move == "panup":
        dx, dy = 0.0, args.dy
    elif args.move == "drift":
        dx, dy = args.dx, args.dy
    elif args.move == "dolly":
        fx, fy = args.fx, args.fy
    elif args.move == "rise":
        dx, dy = 0.0, args.dy
        fx, fy = 0.5, args.fy
    elif args.move == "orbit":
        fx, fy = 0.5, 0.5

    # zoom expression (smoothstep)
    z_expr = f"{z0}+({z1}-{z0})*{e}"
    # focal-point pan: x moves toward (fx, fy) of the frame while zooming
    # x = iw/2 - (iw/zoom/2)  is the centered anchor
    x_expr = f"iw/2-(iw/zoom/2)+(({fx}*iw)-(iw/zoom/2))*{e}"
    y_expr = f"ih/2-(ih/zoom/2)+(({fy}*ih)-(ih/zoom/2))*{e}"
    # add lateral drift offsets
    if dx:
        x_expr = f"iw/2-(iw/zoom/2)+{dx}*iw*{e}"
    if dy:
        y_expr = f"ih/2-(ih/zoom/2)+{dy}*ih*{e}"

    # pre-filter: upscale to keep zoompan sub-pixel smooth
    pre = f"scale={args.upscale}:-2,setsar=1"
    if args.move == "orbit":
        t = f"t"
        rot = f"{args.rot_amp}*sin(2*PI*{t}/{args.dur})"
        pre += f",rotate=a='{rot}':ow=iw:oh=ih:c=black"

    zp = (f"zoompan=z='{z_expr}':x='{x_expr}':y='{y_expr}'"
          f":d={dur}:s={w}x{h}:fps={args.fps},format=yuv420p")
    return pre, zp


def main():
    ap = argparse.ArgumentParser(description="Render a still into a scrubbable camera-move clip.")
    ap.add_argument("input", help="input still image (png/jpg/webp).")
    ap.add_argument("output", help="output .mp4 path.")
    ap.add_argument("--move", default="push",
                    choices=["push", "pull", "pan", "panup", "drift", "dolly", "orbit", "rise", "swoop"])
    ap.add_argument("--dur", type=float, default=6.0, help="clip length in seconds (default 6).")
    ap.add_argument("--size", default="1280x720", help="output resolution WxH (default 1280x720).")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--z0", type=float, default=None, help="override starting zoom.")
    ap.add_argument("--z1", type=float, default=None, help="override ending zoom.")
    ap.add_argument("--dx", type=float, default=0.12, help="lateral drift (fraction of width).")
    ap.add_argument("--dy", type=float, default=0.08, help="vertical drift (fraction of height).")
    ap.add_argument("--fx", type=float, default=0.5, help="focal x (0..1).")
    ap.add_argument("--fy", type=float, default=0.5, help="focal y (0..1).")
    ap.add_argument("--rot-amp", type=float, default=0.05, help="orbit rotation amplitude (rad).")
    ap.add_argument("--fg", default=None, help="optional foreground PNG (alpha) for 3D parallax.")
    ap.add_argument("--fg-speed", type=float, default=1.6, help="foreground moves Nx faster than bg.")
    ap.add_argument("--gop", type=int, default=8, help="keyframe interval for scrubbing (default 8).")
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--upscale", type=int, default=2560, help="pre-upscale width for smooth zoompan.")
    ap.add_argument("--ffmpeg", default=None, help="path to ffmpeg binary.")
    args = ap.parse_args()

    if not os.path.isfile(args.input):
        sys.exit(f"error: no such input: {args.input}")
    w, h = args.size.lower().split("x")
    args.size = (int(w), int(h))

    ff = check_ffmpeg(args.ffmpeg)
    frames = max(2, int(round(args.dur * args.fps)))
    pre, zp = build_zoompan(args, frames)

    if args.fg:
        if not os.path.isfile(args.fg):
            sys.exit(f"error: no such foreground: {args.fg}")
        # Background renders the base move; foreground pans/zooms faster,
        # then is overlaid with the main bg scaled to fill the frame.
        fg_zoom = f"1+({args.z1}-1)*{args.fg_speed}" if args.z1 else "1.3"
        fg_zp = (f"zoompan=z='{args.z0 or 1.0}+({fg_zoom}-{args.z0 or 1.0})*{smoothstep_expr('(on/' + str(frames-1) + ')')}'"
                 f":x='iw/2-(iw/zoom/2)+{args.fg_speed}*{args.dx or 0}*iw*{smoothstep_expr('(on/' + str(frames-1) + ')')}'"
                 f":y='ih/2-(ih/zoom/2)+{args.fg_speed}*{args.dy or 0}*ih*{smoothstep_expr('(on/' + str(frames-1) + ')')}'"
                 f":d={frames}:s={args.size[0]}x{args.size[1]}:fps={args.fps}")
        fc = (f"[0:v]{pre},{zp}[bg];"
              f"[1:v]scale={args.upscale}:-1,setsar=1,{fg_zp},format=rgba[fg];"
              f"[bg][fg]overlay=0:0:format=auto[v]")
        cmd = ["-i", args.input, "-i", args.fg, "-filter_complex", fc, "-map", "[v]"]
    else:
        fc = f"[0:v]{pre},{zp}[v]"
        cmd = ["-i", args.input, "-filter_complex", fc, "-map", "[v]"]

    out = [
        ff, "-y", *cmd,
        "-frames:v", str(frames),
        "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf),
        "-pix_fmt", "yuv420p",
        "-g", str(args.gop), "-keyint_min", str(args.gop), "-sc_threshold", "0",
        "-movflags", "+faststart", "-an",
        args.output,
    ]
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    print("ffmpeg", " ".join(out))
    subprocess.run(out, check=True)
    kb = os.path.getsize(args.output) // 1024
    print(f"wrote {args.output} ({frames} frames @ {args.fps}fps, {args.dur}s, {kb} KB)")


if __name__ == "__main__":
    main()
