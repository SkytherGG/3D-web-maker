---
name: 3d-world
description: >
  Builds an immersive scroll-scrubbed "3D scrolling video" landing page for any
  brand or industry — as the visitor scrolls, a camera flies through scene after
  scene in ONE continuous, connected world, and the page actually SCRUBS REAL
  VIDEO frames (Apple-style scroll-through pages). Use when the user asks for a
  "3D world", "scroll world", "scroll video", "scrolling video website", an
  immersive scroll cinematic, a diorama landing page, or wants to turn any
  business/industry into a scrollable cinematic. The skill interviews the user
  (brand, pitch, visual style, ordered scene sequence), generates cohesive scene
  images + abstract connector frames with an image tool, then turns each still
  into a real H.264 camera-move clip with ffmpeg (scripts/motion_render.py) so
  the page scroll genuinely scrubs video. Works in Arena Agent Mode with NO AI
  video-generation model (images + ffmpeg are enough); uses true AI video APIs
  (Veo, Kling, Seedance, Runway, Pika, Higgsfield) only when one is available.
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion, Skill
---

# 3D World — scroll-scrubbed video landing pages

Produces a landing page where **scroll drives a camera**: it flies into a scene,
flows through a connector, and arrives in the next scene — continuously, with no
visible cuts. The visuals start as AI-generated stills, but the page **scrubs
real `.mp4` video frames** by scroll position — the same technique behind
Apple-style scroll-through product pages. **Scroll only drives time.**

> **Read [Step 0](#step-0--read-the-references) and the seam rule first.** The
> single most common failure is a visible "pop" at a scene change; the seam rule
> in `references/techniques.md` and Step 5 exists to prevent it.

---

## Which render mode should I use? (READ THIS FIRST)

There are **three** ways to build the same page. In **Arena Agent Mode you have
an image tool and (via `pip install imageio-ffmpeg`) ffmpeg, but NO AI
video-generation model.** So the default that produces the *good* result is:

### ✅ Mode A — MOTION-RENDER VIDEO *(Arena Agent Mode DEFAULT)*
Real scrubbable video, built from images + ffmpeg. **This is the mode that makes
the page feel like a "3D scrolling video website."** It is free, fast, and needs
no video API.

```
N scene stills ──┐   scripts/motion_render.py   ┌──> N real camera-move .mp4
N-1 connector    ─┼─────────────────────────────┼──> N-1 real "fly-through" .mp4
frames (abstract)┘   (each still → smooth H.264  └──> engine VIDEO mode scrubs them
                      clip with a designed move)      → one continuous video flight
```

- Scenes get **expressive camera moves** (push-in, pan, dolly to a focal point,
  orbit, rise, drift).
- Connectors get a **"fly into the abstract zone"** zoom so the scene swap is
  hidden under a full-bleed moving frame (the image-mode seam strategy, but now
  everything is real video).
- The engine plays the whole chain in **video mode**, crossfading 0.15 s through
  each connector — seamless, genuine video scrubbing.

### Mode B — TRUE AI VIDEO *(only if a video API/CLI is available: Veo, Kling,
Seedance, Runway, Pika, Higgsfield, Monid…)*
Frame-locked connectors give the most seamless result. If a video CLI is present
and authenticated, follow `references/pipeline.md` Mode B. Do NOT pretend Mode B
is available in Arena Agent Mode — it is not.

### Mode C — IMAGE-ONLY *(last resort: image tool but NO ffmpeg)*
Plain stills animated by the engine (Ken-Burns + crossfade). Works everywhere,
zero video cost, but it is **not** video scrubbing — it looks less premium.
Only use if you cannot get ffmpeg at all.

> **Default for Arena Agent Mode: Mode A.** If ffmpeg is missing, install it
> (`pip install --user --break-system-packages imageio-ffmpeg`, or your package
> manager) — it is a one-time, ~30 MB step that unlocks real video. Try to get
> ffmpeg before settling for Mode C.

---

## Step 0 — Read the references

Load the bundled files you need (progressive disclosure). If only this file was
uploaded, the essential templates are inlined at the bottom and you can proceed.

- `references/prompts.md` — intake checklist + every prompt template (stills,
  connectors, style preambles, mid-leg moves).
- `references/pipeline.md` — copy-paste pipelines for all three modes
  (Mode A motion-render is the recommended, primary path).
- `references/techniques.md` — the seam rule, camera grammar, pacing, connector
  motif library, encoding-for-scrub, QA checklists.
- `scripts/motion_render.py` — **the tool for Mode A**: turns a still into a
  smooth, jitter-free, scrub-encoded camera-move clip (with optional 3D parallax).
- `scripts/scaffold.py` — **fast start**: read a filled `brand-brief.json` →
  folder + filled `manifest.json` + `index.html` + engine + ready-to-run still
  prompts. Run it after the interview, then generate stills + render clips.
- `references/scrub-engine.js` — the portable scroll engine (copy into project).
- `references/index-template.html` — a minimal standalone page that mounts it.
- `scripts/` — `knockout.py` (make parallax foreground layers), `extract_frames.py`,
  `build_timeline.py`, `make_sprite_sheet.py`.

> **Fast path:** after Step 1 (interview → `brand-brief.json`), run
> `python3 scripts/scaffold.py brand-brief.json -o site`. It writes the manifest,
> page, engine, and every still prompt (style preamble embedded). Then generate the
> stills with the image tool and render them with `motion_render.py` (the scaffold
> prints the exact commands).

---

## Step 1 — Interview the user (REQUIRED — before generating anything)

Use the agent's question UI where available; otherwise ask in plain text. The
subject is the user's to state — ask it as an open question, never a fabricated
multiple-choice. Keep structured options for enumerable choices; always offer
"Other / my own".

1. **Subject** (open question) — "What should this world be about? Your business,
   a client's, or any idea — a word or a sentence is fine." Capture the
   industry/product + a one-line pitch (e.g. "a bubble-tea company, from leaf to
   last sip") and a brand name if they have one; otherwise propose one below and
   let them approve.
2. **Brand kit** — palette (4–6 named hexes), a display name, and a tone word or
   two (cozy/premium, playful, industrial…). Pick one hex as the page **background**
   and one as the primary **accent**.
3. **Visual style / art direction** — default: soft matte low-poly **clay
   diorama**, isometric, tilt-shift miniature, warm light. Offer alternatives:
   flat papercraft, glossy toy, claymation, neon night, photoreal architectural,
   isometric sci-fi, watercolor storybook, "Other". Whatever is chosen becomes the
   shared **style preamble** reused verbatim in every still prompt — identical
   text is what makes the world feel like one place.
4. **The journey (scene sequence)** — the ordered scenes the camera flies through.
   Propose a set derived from the subject's own value chain (3–6 scenes; the last
   = hero/product + CTA) and let the user edit it. Per scene capture: `id`,
   `label`, `subject`, `eyebrow`, `title`, `body` (≤ 1 sentence), `tags[]` (0–3).
5. **Camera feel** — present by feel with a one-line trade-off each:
   - **"Fly through the world"** — dives into each scene, pulls up and out, hops
     across the world to the next. Best for diorama/miniature art directions.
   - **"One continuous walkthrough"** — a single forward flight that glides
     through each scene into the next, never pulling back. Best for photoreal.
   - **"Locked isometric glide"** — one fixed high angle the whole way; the world
     slides past. Calmest, cheapest.
6. **Render mode + budget** — in Arena Agent Mode, tell the user you'll use the
   **motion-render video** approach (images + ffmpeg → real scrubbable video) at
   no extra cost. If a real video API exists, state estimated credits per clip and
   get approval before rendering anything.
7. **CTA** — button text + destination URL, or "agent proposes".

Write the answers into a brief file (`brand-brief.json` — see
`references/scene-manifest.example.json`) and show the user for approval **before
any generation**. No surprises.

---

## Step 2 — Architecture (from CAMERA)

- **A — Continuous forward take** (walkthrough / locked-iso): no connectors. Each
  leg starts from the *previous leg's actual last frame*. **Default for photoreal.**
- **B — Dive-in + connector** (fly-through / diorama): one clip per scene +
  N−1 connector clips that fly into/out of an abstract zone. Only for
  map-like miniature worlds — the reversals read as intentional map-hopping
  there, and as a stutter everywhere else.

In Mode A both architectures render every still with `motion_render.py`; the
difference is only in the moves you assign (see Step 4).

---

## Step 3 — Style preamble + generate stills

1. Write the **style preamble** from the chosen art direction + palette (templates
   in `references/prompts.md`; the default clay-diorama one is inlined at the bottom).
2. Generate **one still per scene** (16:9, ≥1440 px wide) *plus* **one abstract
   connector still per seam** (N−1 total). Reuse the preamble byte-for-byte in
   every prompt. **Compose for the centre** (the page renders every clip
   `object-fit: cover`): keep the focal subject horizontally centred with a little
   headroom; never park essentials at the far edges. Absolutely no text/letters/
   numbers/logos in any image.
3. **Review for cohesion before rendering any video.** Same palette? same light?
   same scale of objects? same art direction? Re-roll any off-style still now — a
   bad still poisons its video. If you have a good still, you can pass it as a
   style reference to re-roll the others in the same direction.
4. For photoreal directions the scenes are full-bleed (no floating-island framing);
   cohesion comes entirely from the identical preamble — do NOT pass an image
   reference between scenes (it clones the same room).

---

## Step 4 — Render the clips (MODE A: the core step)

Turn every still into a real, smooth camera-move clip with `scripts/motion_render.py`.
This is where the page becomes a *video* site. Run one invocation per still,
backgrounded/polled, then encode (the script encodes for scrubbing already).

```bash
python3 scripts/motion_render.py still_hero.png     video/hero.mp4      --move push --dur 6
python3 scripts/motion_render.py still_build.png    video/build.mp4     --move panup --dur 6
python3 scripts/motion_render.py still_commerce.png video/commerce.mp4  --move drift --dur 6
python3 scripts/motion_render.py still_3d.png       video/3d.mp4        --move dolly --fx 0.5 --fy 0.5 --dur 6
python3 scripts/motion_render.py still_launch.png   video/launch.mp4    --move rise --dur 7

# connectors = "fly into" an abstract zone
python3 scripts/motion_render.py conn_1.png video/conn1.mp4 --move push --z1 1.5 --dur 2.4
```

**Choose the move to fit the concept** (full table in `references/prompts.md`):

| Concept / scene | Suggested move |
|---|---|
| Hero / opening | `push` (slow zoom-in to centre) |
| Product / luxury | `dolly --fx 0.5 --fy 0.5` or `orbit` (fake 3D turn) |
| Scale / atriums / campuses | `rise` (zoom-out reveal) or `panup` |
| Production lines / shelves / counters | `pan` (lateral track, parallax) |
| Travel / outdoors / process | `drift` (diagonal glide) |
| Finale / CTA | `push` then `pull`-style drama, or `rise` for a big reveal |

**3D parallax (the "real 3D" feel):** for a hero scene, cut the subject out with
`scripts/knockout.py` and render it as a foreground layer that drifts faster than
the background:

```bash
python3 scripts/knockout.py still_hero.png hero-float.png --trim        # needs rembg
python3 scripts/motion_render.py still_hero.png video/hero.mp4 \
    --fg hero-float.png --fg-speed 1.6 --move dolly --fx 0.5 --fy 0.5
```

**Quality rules for Mode A (make it good, not "cheap"):**
- Keep `--dur` ≥ 6 s per scene (3–5 s gets frantic); connectors 2–2.5 s.
- **Smoothstep easing is already the default** — do NOT force `linear`; sudden
  start/stop is the #1 sign of a cheap effect.
- The script upscales before zoompan, so moves are sub-pixel smooth (no jitter).
- Don't over-zoom a scene: within ~1.0–1.4× so the upscaled still stays sharp.
- Vary the moves across scenes so the flight has rhythm — don't push every scene.
- For the CTA/finale scene, slow it down (`--dur 7`) and let the engine's `linger`
  hold the camera while the headline peaks.

---

## Step 5 — The seamless chain

### 5a. Mode A (motion-render) — connectors cover the seam
You cannot frame-lock with ffmpeg (no AI video gen to bridge exact pixels), so you
**cover** the seam the same way image mode does, but with *moving* frames: the
engine crossfades (0.15 s) out of the scene, into the full-bleed abstract
connector clip at its peak, then into the next scene. For this to hide the swap:
- The connector clip must be **screen-filling at its peak** (`--z1 1.5`, abstract
  full-bleed still — no ground/horizon, no identifiable place).
- The connector still must share **palette + light direction** with BOTH neighbours.
- Alternate 2–3 connector motifs (light tunnel, aurora, embers…) so it doesn't feel
  repetitive. Motif library in `references/techniques.md`.

### 5b. Mode B (true AI video) — frame-locked connectors
Both connector endpoints must be the **actual rendered frames** of the neighbours
(`clip_i`'s last frame → `--start-image`, `clip_{i+1}`'s first frame →
`--end-image`), extracted from the rendered videos with `scripts/extract_frames.py`.
Never the stills. Architecture A has no connectors (legs chain frame-identically).

---

## Step 6 — Encode for scrubbing

**Scrubbing sets `video.currentTime` every rendered frame — seek cost is the enemy.**
The engine decodes from the nearest keyframe, so:
- H.264 (`libx264`), `yuv420p`, `-movflags +faststart`, **no audio**, light sharpen.
- **GOP 8** desktop / **GOP 4** mobile (twice the keyframes ≈ half the seek-decode
  work); `-g 2`/all-intra if phones stutter.
- Native resolution, `crf 20` desktop / `crf 23` mobile. **`motion_render.py`
  already applies GOP 8 + crf 20 + faststart by default** — only tweak for mobile.
- Budget: 720p clips ≈ 200–600 KB each; 5 scenes + 4 connectors ≈ 3–6 MB total —
  fine to lazy-load.

---

## Step 7 — Wire the engine

1. Copy `references/scrub-engine.js` into the project.
2. Write a `manifest.json` (shape in `references/scene-manifest.example.json`):
   sections (in order) with `clip` + `poster` + copy + `duration`, connectors (N−1)
   with `clip` + `poster`, `"mode":"video"`, `crossfade: 0.15`, `runway`,
   `background`, `cta`, optional `audio`.
3. Mount it in a page (copy `references/index-template.html` or edit the demo):

```html
<div id="world"></div>
<script src="scrub-engine.js"></script>
<script>
  const world = new ScrollWorld({
    container: '#world',
    manifest: 'manifest.json',   // or an inline object
    mode: 'video',                // MUST be 'video' for Mode A
    runway: 700                   // scroll length in viewport-heights
  });
</script>
```

The engine builds the stage, HUD (progress bar, timecode, scene labels, scroll
hint, cinematic toggle, CTA card) itself. Audio: optional ambient track, starts on
first interaction (autoplay policy).

---

## Step 8 — Serve, verify, polish

- Serve over HTTP (`python3 -m http.server` or the agent's preview mechanism);
  `file://` won't scrub video reliably.
- **Verify the video actually scrubs**: scroll slowly through the hero — the
  camera should move *smoothly and continuously*. If it jumps, check GOP and that
  `mode:"video"` is set.
- Scroll feel: each scene needs enough scroll distance (adjust per-section `scroll`
  weights); use `linger` so the headline peaks mid-scene.
- Mobile: check portrait (`object-fit: cover` crops; stills were centred so it's
  painless). If it stutters on phones, drop GOP to 4.
- `prefers-reduced-motion`: engine falls back to a static poster — don't fight it.
- Output checklist: works with JS off (poster fallback), no console errors, all
  relative paths, weight budget met, CTA link works, back-scroll is smooth.

---

## Gotchas

- **In Arena Agent Mode there is NO AI video model.** Never promise "AI video".
  Use Mode A (images + ffmpeg → real scrubbable video). It's the right tool and
  the page genuinely scrubs video frames.
- **A Mode A connector cannot be frame-locked** — rely on the engine crossfade +
  screen-filling abstract connector clips. Don't try to splice clips frame-exactly;
  the crossfade is the correct seam strategy here.
- Keep focal subjects centred with headroom (`object-fit: cover` crops edges).
- Videos are muted by the engine (autoplay policy); any audio is an ambient layer.
- macOS ships bash 3.2 — keep pipeline scripts POSIX. `motion_render.py` is Python
  3, so it avoids bash quirks entirely.
- If ffmpeg is missing, `pip install --user --break-system-packages imageio-ffmpeg`
  ships a static binary — `motion_render.py` finds it automatically.
- If the user uploads ONLY this SKILL.md (no references/), generate stills +
  connectors, render with the essential commands inlined below, and mention the
  full package is available for the richer pipeline.

---

## Essential templates (inline; full library in `references/prompts.md`)

**Default style preamble** (swap bracketed bits for the brand palette; reuse
verbatim in every prompt):

```
Isometric low-poly 3D diorama floating as a small rounded island on a plain solid
[BG_HEX] background with a soft contact shadow beneath it. Soft matte clay 3D
render, rounded toy-model shapes, gentle warm studio lighting, soft long shadows,
tilt-shift miniature look. Cohesive color palette of [PALETTE]. Highly detailed,
centered composition, absolutely no text, no letters, no numbers, no logos, no
watermark.
```

**Scene still:** `[STYLE PREAMBLE] Subject: [SECTION.subject — the miniature
scene: buildings, a few characters doing the work, the props that signal this
stage].`

**Connector still (abstract):** `Abstract seamless transition frame: [MOTIF:
dense cloud bank / radiant light tunnel / swirling aurora / particle storm /
glowing doorway] filling the entire frame edge to edge, like flying into it, no
ground, no horizon. [STYLE PREAMBLE]`

**Mode A — essential render commands:**

```bash
python3 scripts/motion_render.py still_<name>.png video/<name>.mp4 --move <push|pan|drift|dolly|orbit|rise|panup> --dur 6
python3 scripts/motion_render.py conn_<i>.png video/conn<i>.mp4 --move push --z1 1.5 --dur 2.4
```

(Optional 3D parallax: `--fg hero-float.png --fg-speed 1.6` with a knocked-out
foreground PNG.)
