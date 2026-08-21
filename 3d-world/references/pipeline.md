# Pipeline: copy-paste scripts (bash 3.2 safe, POSIX)

Set these once. `NAMES` is the ordered section ids; the last is the hero/finale.

```bash
WORK=/tmp/3d-world            # scratch dir for prompts, sources, frames
ASSETS=./assets               # where the site reads stills (webp/jpg) + clips (mp4)
mkdir -p "$WORK" "$ASSETS/vid"
NAMES="trailhead valley fjord camp"      # <-- your section ids, in order
```

> Generations take minutes per asset — every `--wait` call below is meant to run
> inside a **backgrounded** script. Launch the whole script with your tool's
> background/detached mode and poll the progress log; never block the
> foreground.

---

## Render mode A — IMAGE MODE (no video tool: Arena Agent Mode, free)

Stills + connector frames only. No ffmpeg required. The engine animates
everything.

### A1. Scene stills

Write one prompt file per section to `$WORK/still_<name>.txt`
(see `prompts.md`), then generate with whatever image tool the agent has:

- **Built-in image tool** (Arena Agent Mode): generate each still directly from
  the prompt file text; save as `$WORK/still_<name>.png`. Parallelize.
- **CLI (e.g. higgsfield):**

```bash
gen_still() { # name
  higgsfield generate create gpt_image_2 --prompt "$(cat "$WORK/still_$1.txt")" \
    --aspect_ratio 3:2 --resolution 2k --quality high --wait --wait-timeout 15m --json \
    > "$WORK/still_$1.json" 2> "$WORK/still_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/still_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/still_$1.png" && echo "still $1 ok" || echo "still $1 FAIL"
}
for n in $NAMES; do gen_still "$n" & done ; wait
```

Review the stills for cohesion before continuing. Re-roll any off-style one.

### A2. Connector frames (one per seam, N−1 total)

Prompt files at `$WORK/conn_<i>.txt` (abstract neutral-zone motifs, `prompts.md`).
Same generation path as stills, save as `$WORK/conn_<i>.png`.

### A3. Optional background knockout (floating scenes / parallax layers)

If a section's subject should float above the world (e.g. a hero product), cut
it out of its background:

```bash
python3 scripts/knockout.py "$WORK/still_<name>.png" "$ASSETS/<name>.png" --trim
```

(Needs `rembg` — `pip install rembg onnxruntime`. Solid-background stills are
the easy case; see `knockout.py --help`.)

### A4. Optimize for the web

Stills get zoomed by the engine camera moves, so keep them larger than the
viewport but lean (≤ 1600 px wide):

```bash
for n in $NAMES; do cwebp -quiet -q 84 -resize 1536 0 "$WORK/still_$n.png" -o "$ASSETS/$n.webp"; done
i=0; for f in "$WORK"/conn_*.png; do i=$((i+1)); cwebp -quiet -q 84 -resize 1536 0 "$f" -o "$ASSETS/conn$i.webp"; done
```

### A5. Manifest + page

Write `manifest.json` (`mode: "image"`) mapping each section's `still` and each
connector's `still` (+ `camera` keyframes and `duration`s — see
`scene-manifest.example.json`). Copy `references/index-template.html`, drop in
`references/scrub-engine.js`, serve, done.

---

## Render mode B — VIDEO MODE (video tool/CLI available: Veo, Kling,
Seedance, Runway, Pika, Hailuo, Higgsfield, Monid…)

Chain model: ONE for every chained clip. Must accept `--start-image` AND
`--end-image` to hold a seam (check your tool's schema — reference-only models
can't hold a seam; if `--end-image` is unsupported, use architecture A below and
skip §B4).

> The examples below use the Higgsfield CLI shape; adapt flags to your tool
> (`veo`, `kling`, `runway`, `pika`… each has its own CLI — same fields:
> prompt, start-image, end-image, aspect, duration, resolution).

```bash
VMODEL=seedance_2_0
case "$VMODEL" in
  kling3_0)          VOPTS="--mode std --sound off";          DIVE_DUR=10; CONN_DUR=5 ;;
  seedance_2_0_mini) VOPTS="--mode std --resolution 720p";    DIVE_DUR=8;  CONN_DUR=5 ;;
  *)                 VOPTS="--mode std --resolution 1080p";   DIVE_DUR=8;  CONN_DUR=5 ;;
esac
```

### B1. Scene stills — same as A1.

### B2. Camera clips (dive-in / legs)

**Architecture B (fly-through):** one dive per scene, `--start-image = still`.

```bash
gen_dive() { # name
  higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/dive_$1.txt")" \
    --start-image "$WORK/still_$1.png" \
    $VOPTS --aspect_ratio 16:9 --duration "$DIVE_DUR" \
    --wait --wait-timeout 20m --json > "$WORK/dive_$1.json" 2> "$WORK/dive_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/dive_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/dive_$1.mp4" && echo "dive $1 ok" || echo "dive $1 FAIL"
}
for n in $NAMES; do gen_dive "$n" & done ; wait
```

**Architecture A (continuous walkthrough / locked-iso):** legs chain onto each
other — leg i's `--start-image` = leg i−1's ACTUAL last rendered frame. Run
**strictly sequentially** (you can't parallelize a chain), and eyeball each leg's
last frame before generating the next:

```bash
set -- $NAMES
prev=""
for n in "$@"; do
  if [ -n "$prev" ]; then
    ffmpeg -v error -sseof -0.15 -i "$WORK/dive_$prev.mp4" -frames:v 1 -q:v 2 "$WORK/first_$n.png"
  else
    ffmpeg -v error -ss 0 -i "$WORK/still_$n.png" -frames:v 1 -q:v 2 "$WORK/first_$n.png" 2>/dev/null \
      || cp "$WORK/still_$n.png" "$WORK/first_$n.png"
  fi
  gen_dive "$n"   # edit: --start-image "$WORK/first_$n.png", no --end-image
  prev="$n"
done
```

### B3. Extract boundary frames — the seam handoff

For each adjacent pair, the connector's start = dive_i's LAST frame, end =
dive_{i+1}'s FIRST frame — extracted from the **rendered videos**, never the
stills:

```bash
set -- $NAMES
for n in "$@"; do
  ffmpeg -v error -ss 0      -i "$WORK/dive_$n.mp4" -frames:v 1 -q:v 2 "$WORK/first_$n.png"  # establishing
  ffmpeg -v error -sseof -0.15 -i "$WORK/dive_$n.mp4" -frames:v 1 -q:v 2 "$WORK/last_$n.png" # interior
done
```

### B4. Connector clips (architecture B only)

```bash
gen_conn() { # i startPng endPng
  higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/conn_$1.txt")" \
    --start-image "$2" --end-image "$3" \
    $VOPTS --aspect_ratio 16:9 --duration "$CONN_DUR" \
    --wait --wait-timeout 20m --json > "$WORK/conn_$1.json" 2> "$WORK/conn_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/conn_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/conn_$1.mp4" && echo "conn $1 ok" || echo "conn $1 FAIL"
}
set -- $NAMES ; i=0 ; prev=""
for n in "$@"; do
  if [ -n "$prev" ]; then i=$((i+1)); gen_conn "$i" "$WORK/last_$prev.png" "$WORK/first_$n.png" & fi
  prev="$n"
done ; wait
```

### B5. Encode for scrubbing

Scrubbing sets `currentTime` every frame; a phone decoder's **seek cost scales
with how many frames it must decode from the nearest keyframe**. Native
resolution (never upscale; encode what ffprobe reports), crf 20, **GOP 8**, no
audio, light sharpen, faststart:

```bash
enc() { ffmpeg -v error -y -i "$1" -an -vf "unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$2"; echo "enc $2 $(du -h "$2"|cut -f1)"; }

for n in $NAMES; do enc "$WORK/dive_$n.mp4" "$ASSETS/vid/$n.mp4"; done
i=0; for f in "$WORK"/conn_*.mp4; do i=$((i+1)); enc "$f" "$ASSETS/vid/conn$i.mp4"; done
```

**Mobile (native 9:16 chain):** 720p, **GOP 4** (twice the keyframes = ~half the
seek-decode work), crf 23:

```bash
encm() { ffmpeg -v error -y -i "$1" -an -vf "scale=-2:720,unsharp=5:5:0.6:5:5:0.0" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
  -g 4 -keyint_min 4 -sc_threshold 0 -movflags +faststart "$2"; }

for n in $NAMES; do encm "$WORK/dive_$n.mp4" "$ASSETS/vid/$n-m.mp4"; done
i=0; for f in "$WORK"/conn_*.mp4; do i=$((i+1)); encm "$f" "$ASSETS/vid/conn$i-m.mp4"; done
```

Wire mobile variants in the manifest: `clipMobile` / `connectors[].clipMobile`.

**Single-file option (optional):** stitch the whole chain into one
`world.mp4` so the page scrubs ONE video (simplest engine path, no seam
crossfades needed at the engine level — the seams are baked in):

```bash
python3 scripts/build_timeline.py --manifest manifest.json --out assets/world.mp4
# or, manual concat (same codec/size required):
# ffmpeg -f concat -safe 0 -i list.txt -c copy world.mp4   # identical encodes only
```

---

## Render mode C — SPRITE MODE (upgrade: pre-rendered frames, canvas scrub)

The most robust scrubbing (no video codec seek cost at all) at the price of
heavier assets. Extract frames from any clips, pack into sprite sheets, and the
engine draws them on a canvas:

```bash
python3 scripts/extract_frames.py assets/vid/trailhead.mp4 assets/sprites/trailhead --fps 12 --width 960
python3 scripts/make_sprite_sheet.py assets/sprites/trailhead assets/sprites/trailhead.png --fps 12
```

Point each section's `sheet` (+ `fps`) in the manifest. See script `--help`s.
Typical budget: 12 fps × ~1 s of scroll per scene keeps the sheets sane; the
engine's `runway` mapping controls how long each scene takes to scroll through.

---

## QA quick checks (run before shipping)

- Stills: all scenes share the style preamble's palette/lighting. ✓
- Seams: frame-identical in video mode (composition, not PSNR — see
  `techniques.md`); palette-matched neutral zones in image mode. ✓
- Camera: no reversal across any seam, forward AND backward scrub. ✓
- Encode: `ffprobe` each clip — resolution native, yuv420p, faststart,
  no audio track. ✓
- Page: serves over HTTP, console clean, poster fallback with JS off. ✓
