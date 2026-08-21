# Pipeline: copy-paste scripts (POSIX bash, Python 3)

Set these once. `NAMES` is the ordered section ids; the last is the hero/finale.

```bash
WORK=/tmp/3d-world            # scratch dir for prompts, sources, frames
ASSETS=./assets               # where the site reads stills + clips
mkdir -p "$WORK" "$ASSETS/vid"
NAMES="trailhead valley fjord camp"      # <-- your section ids, in order
FF=$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())" 2>/dev/null || echo ffmpeg)
```

> If ffmpeg is missing in Arena Agent Mode:
> `pip install --user --break-system-packages imageio-ffmpeg`  (ships a static binary)

---

## Mode A — MOTION-RENDER VIDEO *(Arena Agent Mode DEFAULT: images + ffmpeg → real scrubbable video)*

This is the mode that makes a *"3D scrolling video website."* An image tool makes
cohesive stills + abstract connectors; `scripts/motion_render.py` turns each into a
real H.264 camera-move clip; the engine scrubs them in video mode.

### A1. Scene stills (image tool)

Write one prompt file per section (see `prompts.md`) and generate each still with
the agent's image tool (Arena: parallel calls; save as `$WORK/still_<name>.png`).
Reuse the style preamble byte-for-byte. Also generate N−1 abstract connector
stills (`$WORK/conn_<i>.png`). Review for cohesion before rendering any video.

### A2. Render scene clips (ffmpeg camera moves)

One call per still, backgrounded/polled. `motion_render.py` already: upscales for
jitter-free moves, applies smoothstep ease, encodes for scrubbing (GOP 8, crf 20,
yuv420p, faststart, no audio).

```bash
render_scene() { # name move [extra...]
  python3 scripts/motion_render.py "$WORK/still_$1.png" "$ASSETS/vid/$1.mp4" \
      --move "$2" --dur 6 "${@:3}" &
}
render_scene hero      push
render_scene build     panup
render_scene commerce  drift
render_scene product   dolly --fx 0.5 --fy 0.5
render_scene launch    rise --dur 7
wait
```

### A3. Render connector clips ("fly into" the abstract zone)

```bash
i=0
for f in "$WORK"/conn_*.png; do
  i=$((i+1))
  python3 scripts/motion_render.py "$f" "$ASSETS/vid/conn$i.mp4" \
      --move push --z1 1.5 --dur 2.4 &
done
wait
```

### A4. Optional 3D parallax (hero)

Cut the subject out, then render it as a foreground layer that drifts faster than
the background:

```bash
python3 scripts/knockout.py "$WORK/still_hero.png" "$WORK/hero-float.png" --trim
python3 scripts/motion_render.py "$WORK/still_hero.png" "$ASSETS/vid/hero.mp4" \
    --fg "$WORK/hero-float.png" --fg-speed 1.6 --move dolly --fx 0.5 --fy 0.5 --dur 6
```

### A5. Manifest + page

Write `manifest.json` with `"mode":"video"`, each section `clip` + `poster`
(= its still) + copy + `duration`, each connector `clip` + `poster`, `crossfade:0.15`,
`runway`, `background`, `cta` (shape in `scene-manifest.example.json`). Copy
`references/scrub-engine.js` + `references/index-template.html`, drop in, serve.

**Mobile (optional):** re-render a portrait chain at 720p with GOP 4, wire
`clipMobile` / `connectors[].clipMobile`. Or rely on centred stills + `object-fit`.

---

## Mode B — TRUE AI VIDEO (only if a video API/CLI is available)

Chain model: ONE for every chained clip. Must accept `--start-image` AND
`--end-image` to hold a seam (check the tool's schema; if `--end-image` is
unsupported, use architecture A and skip §B4). Examples use the Higgsfield CLI
shape; adapt flags to your tool (`veo`, `kling`, `runway`, `pika`…).

```bash
VMODEL=seedance_2_0
case "$VMODEL" in
  kling3_0)          VOPTS="--mode std --sound off";          DIVE_DUR=10; CONN_DUR=5 ;;
  seedance_2_0_mini) VOPTS="--mode std --resolution 720p";    DIVE_DUR=8;  CONN_DUR=5 ;;
  *)                 VOPTS="--mode std --resolution 1080p";   DIVE_DUR=8;  CONN_DUR=5 ;;
esac
```

### B1. Scene stills — same as A1.
### B2. Camera clips

**Architecture B (fly-through):** one dive per scene, `--start-image = still`.

```bash
gen_dive() { # name
  higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/dive_$1.txt")" \
    --start-image "$WORK/still_$1.png" $VOPTS --aspect_ratio 16:9 \
    --duration "$DIVE_DUR" --wait --wait-timeout 20m --json \
    > "$WORK/dive_$1.json" 2> "$WORK/dive_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/dive_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/dive_$1.mp4" && echo "dive $1 ok" || echo "dive $1 FAIL"
}
for n in $NAMES; do gen_dive "$n" & done ; wait
```

**Architecture A (continuous walkthrough / locked-iso):** legs chain onto each
other — leg i's `--start-image` = leg i−1's ACTUAL last rendered frame. Run
strictly sequentially; eyeball each leg's last frame before generating the next:

```bash
set -- $NAMES
prev=""
for n in "$@"; do
  if [ -n "$prev" ]; then
    python3 scripts/extract_frames.py "$WORK/dive_$prev.mp4" "$WORK/first_$n.png"
  else
    cp "$WORK/still_$n.png" "$WORK/first_$n.png"
  fi
  gen_dive "$n"   # edit: --start-image "$WORK/first_$n.png", no --end-image
  prev="$n"
done
```

### B3. Extract boundary frames — the seam handoff

For each adjacent pair, the connector's start = dive_i's LAST frame, end =
dive_{i+1}'s FIRST frame — from the **rendered videos**, never the stills:

```bash
set -- $NAMES
for n in "$@"; do
  python3 scripts/extract_frames.py "$WORK/dive_$n.mp4" "$WORK/seam_$n.png"
done
```

### B4. Connector clips (architecture B only)

```bash
gen_conn() { # i startPng endPng
  higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/conn_$1.txt")" \
    --start-image "$2" --end-image "$3" $VOPTS --aspect_ratio 16:9 \
    --duration "$CONN_DUR" --wait --wait-timeout 20m --json \
    > "$WORK/conn_$1.json" 2> "$WORK/conn_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/conn_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/conn_$1.mp4" && echo "conn $1 ok" || echo "conn $1 FAIL"
}
set -- $NAMES ; i=0 ; prev=""
for n in "$@"; do
  if [ -n "$prev" ]; then i=$((i+1)); gen_conn "$i" "$WORK/seam_$prev.png" "$WORK/seam_$n.png" & fi
  prev="$n"
done ; wait
```

### B5. Encode for scrubbing

```bash
enc() { ffmpeg -v error -y -i "$1" -an -vf "unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$2"; echo "enc $2 $(du -h "$2"|cut -f1)"; }
for n in $NAMES; do enc "$WORK/dive_$n.mp4" "$ASSETS/vid/$n.mp4"; done
i=0; for f in "$WORK"/conn_*.mp4; do i=$((i+1)); enc "$f" "$ASSETS/vid/conn$i.mp4"; done
```

**Mobile (native 9:16):** 720p, GOP 4, crf 23:

```bash
encm() { ffmpeg -v error -y -i "$1" -an -vf "scale=-2:720,unsharp=5:5:0.6:5:5:0.0" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
  -g 4 -keyint_min 4 -sc_threshold 0 -movflags +faststart "$2"; }
for n in $NAMES; do encm "$WORK/dive_$n.mp4" "$ASSETS/vid/$n-m.mp4"; done
i=0; for f in "$WORK"/conn_*.mp4; do i=$((i+1)); encm "$f" "$ASSETS/vid/conn$i-m.mp4"; done
```

**Single-file option (optional):** stitch the whole chain into one `world.mp4`:

```bash
python3 scripts/build_timeline.py --manifest manifest.json --out assets/world.mp4
```

---

## Mode C — IMAGE-ONLY (last resort: image tool but NO ffmpeg)

Plain stills + abstract connector frames; the engine animates them (Ken-Burns +
crossfade). Zero video cost, but not real video scrubbing.

```bash
# Stills already generated (A1). Skip A2/A3. Optimize for the web:
for n in $NAMES; do cwebp -quiet -q 84 -resize 1536 0 "$WORK/still_$n.png" -o "$ASSETS/$n.webp"; done
i=0; for f in "$WORK"/conn_*.png; do i=$((i+1)); cwebp -quiet -q 84 -resize 1536 0 "$f" -o "$ASSETS/conn$i.webp"; done
```

Write `manifest.json` with `"mode":"image"`, each section's `still` + `camera`
keyframes + `duration`, each connector's `still`. `motion_render.py` is not used.

---

## Mode D — SPRITE MODE (upgrade: pre-rendered frames, canvas scrub)

Most robust scrubbing (no codec seek cost) at the price of heavier assets.

```bash
python3 scripts/extract_frames.py assets/vid/hero.mp4 assets/sprites/hero --fps 12 --width 960
python3 scripts/make_sprite_sheet.py assets/sprites/hero assets/sprites/hero.png --fps 12
```

Point each section's `sheet` (+ `fps`) in the manifest. See script `--help`s.

---

## QA quick checks (run before shipping)

- Stills: all share the style preamble's palette/lighting/scale. ✓
- Mode A: every scene + connector has a real `.mp4` (`ffprobe`: h264, yuv420p,
  faststart, GOP 8, no audio, correct duration). ✓
- Mode A seam: connector clips are full-bleed abstract, palette-matched to BOTH
  neighbours, crossfade 0.15 s set in the manifest. ✓
- Page: serves over HTTP, console clean, poster fallback with JS off, all relative
  paths, weight budget met. ✓
