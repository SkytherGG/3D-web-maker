# 🌍 3D World

An agent skill — for **Arena AI Agent Mode**, Claude Code, Codex, and any
`SKILL.md`-compatible agent — that builds an immersive, **scroll-scrubbed
"3D scrolling video" landing page** for any brand or industry: as the visitor
scrolls, a camera flies through scene after scene with **no cuts** — one
continuous, connected flight through a little generated world, and the page
**scrubs real `.mp4` video frames** (Apple-style scroll-through pages).

Built as a sibling of the popular *scroll-world* skill, with the upgrades that
make it genuinely good:

1. **Real scrubbable video in Arena Agent Mode (no AI video model needed).**
   Arena has an image tool + ffmpeg but **no** AI video-generation model. This
   skill turns cohesive AI stills into real H.264 camera-move clips with
   `scripts/motion_render.py` (smoothstep-eased, jitter-free, scrub-encoded),
   then wires the engine's **video mode** so the page scroll genuinely scrubs
   video. That is the default path and produces a real video-scroll site — not a
   slideshow.
2. **Provider-agnostic render modes.** **Mode A** motion-render video (default:
   images + ffmpeg), **Mode B** true AI video (Veo, Kling, Seedance, Runway…,
   only when such an API exists), **Mode C** image-only (last resort, no ffmpeg),
   and optional **sprite mode** (canvas frame-scrubbing).
3. **Self-contained.** No external API keys required; the demo ships with its
   own generated world.

## What you get

```
3d-world/
├── SKILL.md                    the skill — intake interview, procedure, seam rule
├── README.md                   this file
├── references/
│   ├── prompts.md              intake checklist + every prompt template
│   ├── pipeline.md             copy-paste batch scripts (stills → clips → encode)
│   ├── techniques.md           the no-hard-cut grammar, camera rules, QA checklists
│   ├── scrub-engine.js         portable vanilla-JS scroll engine (no dependencies)
│   ├── index-template.html     minimal standalone page that mounts the engine
│   └── scene-manifest.example.json   manifest schema
├── scripts/
│   ├── motion_render.py        ★ turn a still into a real scrubbable camera-move
│   │                             .mp4 (smoothstep ease, jitter-free, scrub-encoded;
│   │                             optional 3D parallax) — the Mode A workhorse
│   ├── extract_frames.py       ffmpeg boundary frames / frame sequences
│   ├── build_timeline.py       stitch the clip chain into one world.mp4
│   ├── make_sprite_sheet.py    pack frames into a sprite sheet (+ descriptor)
│   ├── knockout.py             optional background knockout (rembg / parallax layers)
│   └── smoke-test.js           engine regression test (jsdom)
└── demo/                       a fully working image-mode world — open index.html
```

## Install

**Arena AI Agent Mode** — upload the `3d-world` folder (or `3d-world.zip`) to
the session. When you then ask for a "3D world" / scroll-world landing page,
the skill interviews you (brand, pitch, visual style, scene sequence) and
builds the page.

**Claude Code / Codex / any SKILL.md agent** — copy the folder into your
agent's skills directory:

```bash
cp -R 3d-world ~/.claude/skills/    # Claude Code
cp -R 3d-world ~/.codex/skills/     # Codex
# or via the Vercel skills CLI:  npx skills add <repo>/3d-world -a codex
```

## Quick start

1. **Invoke it**: "Turn my bubble-tea company into a 3D world landing page."
2. The skill **asks a few questions** — subject + pitch, brand kit (4–6 hex
   colors), art direction, the ordered scene sequence, camera feel, render
   mode/budget, CTA.
3. It **generates** the scene stills (and camera clips + connectors in video
   mode), **wires** the manifest + `scrub-engine.js` + `index.html`, and
   serves the page for review.

### Try the demo now (no agent needed)

```bash
cd 3d-world/demo
python3 -m http.server 8000     # then open http://localhost:8000
```

Scroll to fly through the demo world (NORTHLIGHT — 5 scenes + 4 connector
frames, **real scrubbable video**: each still was turned into a camera-move
`.mp4` with `scripts/motion_render.py` and the engine scrubs them in video
mode). Press the ▶ button for cinematic autoplay, scroll backward to rewind.

### Render modes at a glance

| Mode | Assets | Needs | Feel |
|---|---|---|---|
| `motion-render video` (Mode A, **default in Arena**) | stills → real `.mp4` camera-move clips | image tool + ffmpeg (script ships) | scroll **scrubs real video frames**; Apple-style |
| `ai video` (Mode B) | camera clips + frame-locked connectors | a video API/CLI + ffmpeg | true AI camera flights |
| `image` (Mode C, last resort) | stills + connector frames | any image tool | engine-driven camera moves + crossfades |
| `sprite` | pre-extracted frames | ffmpeg (frames) | pixel-perfect canvas scrubbing |

Set it in the manifest (`"mode"`) or the engine options (`mode: 'video'`).

## Using in Arena AI Agent Mode

1. **Connect this repo** to an Arena AI Agent Mode session.
2. Say something like: *"Turn my bubble-tea company into a 3D scrolling video
   landing page."*
3. The agent reads `3d-world/SKILL.md`, interviews you (brand, palette, style,
   scene sequence, camera feel, CTA), then runs **Mode A**: generates cohesive
   stills + abstract connectors with the image tool, renders each into a real
   scrubbable `.mp4` with `scripts/motion_render.py`, and wires the engine's
   **video mode** — so the page scroll genuinely scrubs video.

The only requirement beyond the built-in image tool is **ffmpeg**, which
`scripts/motion_render.py` finds automatically (it uses the static binary bundled
with `pip install imageio-ffmpeg` if ffmpeg isn't on PATH).

## How the "no hard cuts" trick works

- **Video mode:** every connector is generated *from the actual rendered
  boundary frames* of its neighbours (`clip_i`'s last frame →
  `--start-image`, `clip_{i+1}`'s first frame → `--end-image`), so each seam
  is frame-identical. See `references/techniques.md` → "The one rule".
- **Image mode:** the engine fades a full-bleed connector frame (cloud bank,
  light tunnel, aurora warp…) up to 100 % screen cover and back down; the
  scene swap happens while the screen is entirely connector — invisible.

## Requirements

- Nothing for image mode; any modern browser.
- Video mode: a video generation backend (CLI/API) + `ffmpeg`/`ffprobe`.(Not needed for Arena AI)
- Optional: Python 3 + Pillow (sprite sheets, knockout), `rembg` (neural
  knockout), `cwebp` (webp optimization), jsdom (smoke test).

## License

MIT — see [LICENSE](LICENSE). The demo images are AI-generated for the demo
brand "Northlight" and are free to replace with your own generated world .
