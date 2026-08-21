# 🌍 3D World

An agent skill — for **Arena AI Agent Mode**, Claude Code, Codex, and any
`SKILL.md`-compatible agent — that builds an immersive, **scroll-scrubbed
"fly through the world" landing page** for any brand or industry: as the
visitor scrolls, a camera flies through scene after scene with **no cuts** —
one continuous, connected flight through a little generated world.

Built as a sibling of the popular *scroll-world* skill, with two upgrades:

1. **Provider-agnostic render modes.** Works today in Arena Agent Mode (image
   generation only) via **image mode** — the engine itself performs every
   camera move and crossfades through full-bleed connector frames. If a video
   tool or CLI backend is available (Veo, Kling, Seedance, Runway, Pika,
   Higgsfield, Monid…), it uses the full **video mode** with frame-locked
   connectors, and can upgrade to **sprite mode** (canvas frame-scrubbing).
2. **Self-contained.** No external API keys are required for the default
   path; the demo ships with its own generated world.

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
│   ├── extract_frames.py       ffmpeg boundary frames / frame sequences
│   ├── build_timeline.py       stitch the clip chain into one world.mp4
│   ├── make_sprite_sheet.py    pack frames into a sprite sheet (+ descriptor)
│   ├── knockout.py             optional background knockout (rembg)
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
frames, all image mode). Press the ▶ button for cinematic autoplay, scroll
backward to rewind.

### Render modes at a glance

| Mode | Assets | Needs | Feel |
|---|---|---|---|
| `image` (default) | stills + connector frames | any image tool | engine-driven camera moves + crossfades |
| `video` | camera clips + frame-locked connectors | a video tool/CLI + ffmpeg | true AI camera flights |
| `sprite` | pre-extracted frames | ffmpeg (frames) | pixel-perfect canvas scrubbing |

Set it in the manifest (`"mode"`) or the engine options (`mode: 'video'`).

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
- Video mode: a video generation backend (CLI/API) + `ffmpeg`/`ffprobe`.
- Optional: Python 3 + Pillow (sprite sheets, knockout), `rembg` (neural
  knockout), `cwebp` (webp optimization), jsdom (smoke test).

## License

MIT — see [LICENSE](LICENSE). The demo images are AI-generated for the demo
brand "Northlight" and are free to replace with your own generated world .
