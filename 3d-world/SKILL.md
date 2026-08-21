---
name: 3d-world
description: >
  Builds an immersive scroll-scrubbed "fly through the world" 3D landing page
  for any brand or industry — as the visitor scrolls, a camera flies through
  scene after scene with NO cuts, one continuous connected world. Use when the
  user asks for a "3D world", "scroll world", an immersive scroll cinematic, a
  diorama landing page, or wants to turn any business/industry into a
  scrollable 3D world. The skill interviews the user (brand, pitch, visual
  style, ordered scene sequence), then generates cohesive scene images and
  camera-move clips, creates frame-matched connector clips between scenes so
  transitions feel seamless, and wires a portable, framework-agnostic vanilla
  JS scroll engine into a minimal page. Works with any image tool; uses a video
  tool or CLI backend (Veo, Kling, Seedance, Runway, Pika, Higgsfield, Monid)
  when available, otherwise falls back to an image-only mode where the engine
  animates stills and connector frames itself.
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion, Skill
---

# 3D World

Produces a landing page where **scroll drives a camera**: it flies into a
scene, flows through a connector, and arrives in the next scene — continuously,
with no visible cuts. The visuals are AI-generated, and the page merely scrubs
pre-rendered clips (or animated stills) by scroll position — the same technique
behind Apple-style scroll-through product pages. The camera genuinely moves;
**scroll only drives time.**

**What you generate:** N scene stills → (optional) N camera-move clips →
N−1 connector clips/frames that join consecutive scenes seamlessly → a portable
scroll engine that plays the whole chain as one flight.

**The one rule that makes or breaks it:** seams must be *frame-identical* (or,
in image mode, visually matched through a shared connector frame). Read
[The seamless chain](#the-one-rule-the-seamless-chain) before generating any
connector. Getting this wrong produces a visible "pop" between scenes — the
single most common failure.

**Framework-agnostic, tool-agnostic.** The engine in `references/scrub-engine.js`
is self-contained vanilla JS (it builds its own DOM and injects its own CSS into
a container you give it), so it drops into plain HTML, Next.js, Vue, Svelte, or
a Python-served page. Render mode is chosen from what the agent actually has:

- **Video mode** — a video tool/backend is available (built-in video generation,
  or CLIs such as Higgsfield, Monid, Veo, Kling, Seedance, Runway, Pika, Hailuo).
  You generate real camera-flight clips + frame-locked connectors, encode with
  ffmpeg, and the engine scrubs them.
- **Image mode** — only image generation is available (e.g. Arena Agent Mode's
  image tool). You generate scene stills + abstract connector frames; the engine
  performs the camera moves (push-ins, lateral tracks, drifts) and crossfades
  through connector frames. Still seamless, still one continuous flight, zero
  video cost.
- **Sprite mode** — optional upgrade: pre-extracted frames (from any video)
  scrubbed pixel-perfect on a canvas. Most robust scrubbing, heaviest assets.

---

## Step 0 — Read the references

Load the bundled files you need (progressive disclosure). If only this file was
uploaded, the essential templates are inlined below and you can proceed without
the rest.

- `references/prompts.md` — intake checklist + every prompt template (stills,
  camera clips, connectors, voiceover, style preamble variants).
- `references/pipeline.md` — copy-paste batch scripts (generate → frames →
  connectors → encode) for video mode; the image-mode pipeline; mobile encodes.
- `references/techniques.md` — the seam rule, architecture A vs B, camera
  grammar, connector motif library, encoding for scrub, QA checklists.
- `references/scrub-engine.js` — the portable engine (copy it into the project).
- `references/index-template.html` — a minimal standalone page that mounts the
  engine.
- `scripts/` — `extract_frames.py`, `build_timeline.py`, `make_sprite_sheet.py`,
  `knockout.py` (optional background knockout for floating scenes).

---

## Step 1 — Interview the user (REQUIRED — do this before generating anything)

Ask these questions up front, in order. Use the agent's question UI
(`AskUserQuestion`-style) where available; otherwise ask in plain text. The
subject is the user's to state — ask it as an open question, never a fabricated
multiple-choice. Keep the structured options for the enumerable choices, and
always offer "Other / my own".

1. **Subject** (open question) — "What should this world be about? Your
   business, a client's, or any idea — a word or a sentence is fine." Capture
   the industry/product + a one-line pitch (e.g. "a bubble-tea company, from
   leaf to last sip") and a brand name if they have one; otherwise propose one
   below and let them approve.
2. **Brand kit** — either the user hands you palette + name + tone, or you
   propose one. Capture **4–6 named hex values**, a display name, and a tone
   word or two (cozy/premium, playful, industrial…). Pick one hex as the page
   **background** and one as the **accent**.
3. **Visual style / art direction** — default: "soft matte low-poly **clay
   diorama**, isometric, tilt-shift miniature, warm light." Offer alternatives:
   flat papercraft, glossy toy, claymation, neon night, photoreal architectural,
   isometric sci-fi, watercolor storybook, "Other". Whatever is chosen becomes
   the shared **style preamble** reused verbatim in every scene prompt — that
   identical text is what makes the world feel like one place.
4. **The journey (scene sequence)** — the ordered scenes the camera flies
   through. Propose a set derived from the subject's own value chain (3–6
   scenes; last = hero/product + CTA) and let the user edit it. For each scene
   capture: `id`, `label`, `subject` (what's in the scene), `eyebrow`, `title`,
   `body` (≤ 1 sentence), `tags[]` (0–3).
5. **Camera feel — always ask; it's the film's personality.** Present by feel
   with a one-line trade-off each:
   - **"Fly through the world"** — dives into each scene, pulls up and out, hops
     across the miniature world to the next (architecture B). Best for
     diorama/miniature art directions; the reversals read as intentional map-hopping.
   - **"One continuous walkthrough"** — a single forward flight that glides
     through each scene into the next, never pulling back (architecture A).
     Best for grounded/photoreal art directions.
   - **"Locked isometric glide"** — one fixed high angle for the whole film
     (Emons-style); the world slides past. Calmest, cheapest to re-roll.
6. **Render mode + budget** — state what's available and let the user choose:
   - **Image mode** (default when no video tool exists): free, fast, all-stills;
     the engine animates the camera. Good enough for most landing pages.
   - **Video mode**: true AI camera flights; costs money and time per clip
     (typically 2N−1 clips; state estimated cost/credits and get approval before
     rendering anything). If a video CLI is present but unauthenticated, tell
     the user what to run (`higgsfield auth login`, `monid keys`, etc.).
   - **Mobile version?** (video mode only) — a native 9:16 portrait chain costs
     ~2× the video credits; state that before they opt in.
7. **CTA** — button text + destination URL, or "agent proposes".

Write the answers into a brief file (`brand-brief.json` — see
`references/scene-manifest.example.json` for the shape) and show it to the user
for approval **before any generation**. No surprises.

---

## Step 2 — Pick the architecture (from CAMERA)

- **A — Continuous forward take** (walkthrough / locked-iso): no connectors.
  Each leg starts from the *previous leg's actual rendered last frame*
  (leg 0 starts from the first scene still). The legs ARE the journey.
  Frame-identical seams by construction. **Always the default for photoreal.**
- **B — Dive-in + aerial connector** (fly-through / diorama): one dive clip per
  scene + N−1 connector clips that pull up and out and fly over to the next.
  Only for map-like miniature worlds — the seam reversals read as intentional
  there, and as a stutter everywhere else. If the user picked B against a
  grounded/photoreal direction, say why it will read as a rewind and confirm.

---

## Step 3 — Style preamble + generate scene stills

1. Write the **style preamble** from the chosen art direction + palette, verbatim
   (templates in `references/prompts.md`; the default clay-diorama preamble is
   also inlined at the bottom of this file).
2. Generate **one still per scene** (3:2 or 16:9, high res). Reuse the preamble
   byte-for-byte in every prompt. Compose for the centre (the page renders every
   clip `object-fit: cover`). Absolutely no text/letters/numbers/logos in any
   image.
3. For photoreal directions the scenes are full-bleed (no floating-island
   framing) and cohesion comes entirely from the identical preamble — do NOT
   pass an image reference between scenes (it clones the same room).
4. **Review for cohesion before continuing.** Re-roll any off-style still
   (optionally using a good still as a style reference). In image mode, skip
   ahead to Step 5b.

---

## Step 4 — Camera clips (video mode only)

- For each scene, generate a **camera-move clip** from the scene still
  (`--start-image = still`, full-frame solid-background version).
- **Motion handoff contract** — keep these clauses verbatim in every clip
  prompt: every clip *ends by settling into a slow, steady forward drift toward
  the next destination (final ~1 s)*, and every clip *begins by continuing that
  same drift*. Velocity may never *reverse across a seam* (that's the rewind
  stutter); inside a single clip the camera is free (orbits, crane-ups,
  push-ins are safe mid-clip).
- Pick the mid-clip move from the scene's logic (table in `references/prompts.md`):
  half-orbit for product/luxury, crane-up for scale, low lateral track for
  production lines, push-in for craft, rise-and-swoop for travel/outdoors.
- Run generations detached/backgrounded and poll — never block. Re-roll
  individual failures. Keep the raw sources: you need their frames next.
- **Eyeball each clip's last frame before chaining the next.** It should read
  as a frame from a gentle forward glide. If not, re-roll *this* leg — a bad
  handoff frame poisons every leg after it.

---

## Step 5 — The seamless chain (THE critical part)

### 5a. Video mode — frame-locked connectors (architecture B)

Both endpoints of every connector must be the **ACTUAL RENDERED FRAMES** of the
neighbouring clips — never the original stills, never a fresh render of the
same scene (every generation renders slightly differently; you get a pop).

```
For each connector between clip_i and clip_{i+1}:
  start-image = the LAST frame extracted from clip_i's rendered video
  end-image   = the FIRST frame extracted from clip_{i+1}'s rendered video
```

Extract them:

```bash
ffmpeg -sseof -0.15 -i clip_i.mp4    -frames:v 1 clip_i_last.png      # interior of i
ffmpeg -ss 0     -i clip_next.mp4    -frames:v 1 clip_next_first.png  # establishing of i+1
```

Then generate the connector (`--start-image` + `--end-image`, 16:9, ~5 s):
"Single continuous camera move, no cuts. Pull up and back out of scene i, rise,
glide across the connected world, and arrive at the opening of scene i+1. Keep
the exact colours and light of the start and end frames. Smooth, slow, no text."
(Full template in `references/prompts.md`.)

Architecture A has no connectors — its legs already chain frame-identically.
Skip this subsection for A.

### 5b. Image mode — connector frames + engine blend

Generate **one abstract connector frame per seam** — a full-bleed neutral zone
(cloud bank, light tunnel, portal, aurora warp, doorway, particle swirl) drawn
in the same palette. The engine then plays: scene i → connector fades in
(fly *into* the zone) → connector fully covers the screen at its peak → fades
out revealing scene i+1. The swap happens while the screen is 100 % connector,
so there is no visible cut. Motif library + timing rules in
`references/techniques.md`.

---

## Step 6 — Seam QA (both modes)

- **Video:** render the chain and compare each seam frame-by-frame
  (`ffmpeg` extract on both sides of the seam). Judge **composition, not raw
  PSNR** — a verified-good seam reads ~18–25 dB from detail shimmer alone; a
  real mismatch shows as different composition, lighting, or geometry.
- **Image:** connectors must share palette + lighting with BOTH neighbours.
  Re-roll a connector whose colours clash with either side.
- Check the camera does not reverse across any seam (forward AND backward
  scrubbing — visitors scroll up too).

---

## Step 7 — Encode (video mode)

Scrubbing sets `currentTime` every frame, so seek cost is the enemy. Encode
H.264, **native resolution (never upscale)**, `crf 20`, `-g 8`, `-pix_fmt
yuv420p`, light sharpen, **no audio**, `-movflags +faststart`. Mobile: 720p,
`-g 4` (half the seek-decode work). Scripts in `references/pipeline.md`.
Image mode: downscale stills to ≤1600 px wide JPEG/WebP (~200–500 KB each) —
they get zoomed by the engine, so keep them larger than the viewport.

---

## Step 8 — Wire the engine

1. Copy `references/scrub-engine.js` into the project.
2. Write a `manifest.json` (shape in `references/scene-manifest.example.json`):
   sections (in order) with clip/still/frames + copy + camera or duration,
   connectors (N−1), `mode`, `runway`, `background`, `cta`, optional `audio`.
3. Mount it in a page (copy `references/index-template.html` or edit the demo):

```html
<div id="world"></div>
<script src="scrub-engine.js"></script>
<script>
  const world = new ScrollWorld({
    container: '#world',
    manifest: 'manifest.json',          // or an inline object
    mode: 'auto',                        // auto | video | image | sprite
    runway: 700                          // scroll length in viewport-heights
  });
</script>
```

The engine builds the stage, HUD (progress bar, timecode, scene labels, scroll
hint, cinematic toggle, CTA card) and audio itself — no framework needed.
Audio: optional ambient track, starts on first interaction (autoplay policy).

---

## Step 9 — Serve, verify, polish

- Serve over HTTP (image/video scrubbing needs a server; `file://` won't cut
  it). `python3 -m http.server` or the agent's preview mechanism.
- Verify: scroll feel (each scene gets enough scroll distance; adjust per-section
  `scroll` weights), copy timing (use `linger` so the headline peaks mid-scene),
  mobile (portrait), `prefers-reduced-motion` (static poster), lazy loading
  (videos load on approach, memory stays bounded), CTA reveal, back-scroll.
- Output checklist: page works with JS on/off (poster fallback), no console
  errors, all assets relative paths, total page weight budget respected.

---

## Gotchas

- **Never let a video tool reference its own job UUID** — pass local file paths
  for start/end images.
- Generation APIs differ in flags (e.g. Kling has no `--resolution`, some models
  reject `--end-image`). Check the tool's schema before batching; if `--end-image`
  is unsupported, switch to architecture A (no connectors).
- Interiors trip NSFW filters on some video models — budget 3 attempts/leg and
  tell the user a re-roll or two is normal.
- `object-fit: cover` crops edges: keep focal subjects centred with headroom.
- Videos are muted by the engine (autoplay policy); any audio is an ambient
  layer, never the clip track.
- macOS ships bash 3.2 — keep pipeline scripts POSIX (no associative arrays).
- Mobile video decode stutter → tighten GOP (`-g 2` or `-g 1` all-intra).
- If the user uploads ONLY this SKILL.md (no references/), generate stills +
  image-mode connectors and use the inlined templates below; mention the full
  package is available for the richer pipeline.

---

## Essential templates (inline; full library in `references/prompts.md`)

**Default style preamble** (swap bracketed bits for the brand palette; reuse
verbatim in every prompt):

```
Isometric low-poly 3D diorama, soft matte clay render, rounded toy-model shapes,
tilt-shift miniature scale, gentle warm studio lighting, cohesive palette of
[PALETTE], highly detailed, centered composition, absolutely no text, no letters,
no numbers, no logos, no watermark.
```

**Scene still:** `[STYLE PREAMBLE] Subject: [SECTION.subject — the miniature
scene: buildings, a few characters doing the work, the props that signal this
stage].`

**Connector frame (image mode):** `Abstract seamless transition frame: a
[full-bleed neutral zone: dense cloud bank / radiant light tunnel / swirling
aurora / particle storm / glowing doorway] filling the entire frame edge to
edge, like flying into it, no ground, no horizon. [STYLE PREAMBLE]`

**Camera clip (video mode):** `Single continuous cinematic camera move, no cuts.
Continue the same slow, steady forward glide. [MID-LEG MOVE]. The camera moves
into [SCENE] toward [FOCAL POINT]. In the final second, settle back into a slow,
steady forward glide toward [the opening toward the next scene]. [STYLE tail].
Smooth, graceful, slow motion, subtle parallax. No text, no captions.`

**Connector clip (video mode):** `Single continuous camera move, no cuts. Pull
up and back out of [SCENE i], rise into the sky, glide across the connected
miniature world, and arrive at the opening of [SCENE i+1]. Keep the exact colours
and light of the start and end frames. Smooth, graceful, slow motion. No text.`
