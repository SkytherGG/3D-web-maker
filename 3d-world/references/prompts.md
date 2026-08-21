# Prompt templates & intake (3D World)

Everything here is fill-in-the-slots. **Keep the style preamble byte-for-byte
identical across all scene stills** — that identical text is what makes the
world feel like one place.

---

## Intake checklist (SKILL Step 1)

Collect and write down:

- `SUBJECT` — the business + one-line pitch.
- `BRAND_NAME` — display name.
- `PALETTE` — 4–6 named hexes, e.g.
  `taro #9B7EBD, cream #F5EDE0, caramel #C88A5A, matcha #8FB98A, plum #3A2E48`.
  Pick ONE as the page **background** colour and one as the primary **accent**.
- `TONE` — a word or two (cozy/premium, playful, industrial…).
- `STYLE` — the art direction (default: clay diorama; variants below).
- `SECTIONS[]` — ordered list; for each: `id`, `label`, `subject` (what's in
  the scene), `eyebrow`, `title`, `body` (≤ 1 sentence), `tags[]` (0–3).
  Last section = hero product + CTA.
- `CAMERA` — `fly-through` (arch B: dives + aerial hops) |
  `walkthrough` (arch A: one continuous forward flight) |
  `locked-iso` (arch A + fixed high angle). **Always asked.**
- `RENDER_MODE` — in Arena Agent Mode, default to **Motion-render video** (Mode A:
  image tool + ffmpeg → real scrubbable clips). Only `ai-video` if a real video
  API exists (state credits, get approval). `image` only if ffmpeg is unavailable.
- `MOBILE` — yes/no (native portrait chain costs ~2× for AI video; in Mode A it's
  a free re-render at 720p/GOP 4).
- `CTA` — button text + destination URL.

---

## Style preamble — default: clay diorama

Reuse verbatim in every scene prompt. Swap the bracketed bits for the brand's
palette/bg.

```
Isometric low-poly 3D diorama floating as a small rounded island on a plain
solid [BG_HEX] background with a soft contact shadow beneath it. Soft matte clay
3D render, rounded toy-model shapes, gentle warm studio lighting, soft long
shadows, tilt-shift miniature look. Cohesive color palette of [PALETTE].
Highly detailed, centered composition, absolutely no text, no letters, no
numbers, no logos, no watermark.
```

### Alternate art directions

Swap the first two sentences; keep the palette/no-text tail unchanged.

- **Flat papercraft:** "Isometric layered paper-craft diorama, matte cardstock,
  clean die-cut edges, subtle drop shadows between layers."
- **Glossy toy:** "Isometric glossy vinyl-toy diorama, smooth plastic shading,
  soft rim light, collectible figurine look."
- **Claymation:** "Isometric stop-motion clay set, visible thumbprints, handmade
  plasticine texture, soft studio softbox light."
- **Neon night:** "Isometric miniature at night, warm interior glow and neon
  signage, moody rim light, wet reflective ground."
- **Isometric sci-fi:** "Isometric hard-surface sci-fi diorama, matte
  gunmetal-and-accent panels, soft rim light, tiny glowing status lights,
  spacecraft and machinery."
- **Watercolor storybook:** "Hand-painted watercolor storybook illustration,
  soft granulated paper texture, gentle ink outlines, airy pastel light."
- **Photoreal architectural** (real estate, hospitality, premium/luxury):
  "Ultra-photorealistic architectural photography of a single cohesive
  [subject], cinematic wide-angle, warm golden-hour light, natural materials,
  restrained designer furnishings, a breathtaking view, editorial magazine
  quality, shallow depth of field, no people." For photoreal, drop the
  floating-island framing — scenes are **full-bleed** (a dark page background
  reads premium), the camera glides through doorways/glass rather than opening
  a roof, and cohesion comes entirely from the identical preamble (do NOT pass
  an image reference between scenes — it clones the same room).

---

## Mode A motion-render — map a move to each scene

When rendering clips with `scripts/motion_render.py` (the default Arena Agent
Mode path), pick each scene's `--move` from the concept (not randomly):

| Concept / scene | `--move` | Why |
|---|---|---|
| Opening / hero | `push` | slow, confident zoom-in to the centre |
| Product / luxury | `dolly --fx .5 --fy .5` or `orbit` | dolly to a focal point; orbit = fake 3D turn |
| Scale / atrium / campus | `rise` or `panup` | zoom-out / tilt-up reveal |
| Production line / shelf / counter | `pan` | lateral track, foreground parallax |
| Travel / outdoors / process | `drift` | diagonal glide feels airborne |
| Finale / CTA | `rise --dur 7` | big slow reveal; engine `linger` holds it |

Optional real-3D parallax: knock the subject out (`scripts/knockout.py`) and pass
`--fg hero-float.png --fg-speed 1.6` so it drifts faster than the background.

---

## Scene still prompt

```
[STYLE PREAMBLE]
Subject: [SECTION.subject — describe the miniature scene: the building/space, a
few characters doing the work, the props that signal this stage of the business].
```

Tips:

- Name concrete props (they anchor the scene): tanks, cauldrons, conveyor,
  crates, awning, string lights, benches, scooters, map pins, tent, canoe…
- For the final "hero product" section, drop the diorama-island framing and
  prompt a single oversized product centrepiece floating on the same background
  with a few small orbiting props.
- **Compose for the centre.** The page renders every clip `object-fit: cover`.
  Keep the focal subject horizontally centred with a little headroom; don't
  park anything essential at the far edges.
- Aspect 3:2 or 16:9, high resolution (≥ 1440 px wide).

---

## Camera clip prompt — dive-in (video mode, architecture B)

`--start-image = the scene still` (solid-bg version).

```
Single continuous cinematic camera move, no cuts. Begin high and far, looking
down at the whole [SECTION.subject] from outside like a tiny model. The camera
slowly glides forward and descends toward it, sweeping in toward [FOCAL POINT —
the counter / the cauldrons / the people], as if flying inside. As the camera
pushes in, the roof and upper structure gently lift and open away to reveal the
warm interior. [STYLE tail]. Smooth, graceful, slow motion, subtle parallax.
No text, no captions, no watermark.
```

---

## Leg prompt — architecture A, continuous forward take (video mode)

`--start-image = previous leg's ACTUAL last frame` (leg 0: the first scene's
still). **No `--end-image`.** The bolded clauses are the motion-handoff
contract — keep them verbatim; the mid-leg move is where the expression goes.

```
Single continuous cinematic camera move, no cuts. Continue the same slow,
steady forward glide. [MID-LEG MOVE — optional, from the library below.] The
camera moves into [SCENE i] toward [FOCAL POINT]. In the final second, settle
back into a slow, steady forward glide toward [the doorway / opening / direction
of the next scene]. [STYLE tail + PALETTE]. Smooth, graceful, slow motion,
subtle parallax. No text, no captions.
```

### Mid-leg move library (pick by concept; omit for a plain glide)

Reversals are safe *inside* a leg (it's one continuous render) — only a seam may
never reverse. That's why "ease back out" is fine mid-leg.

**Locked-iso clause** (`CAMERA` = locked isometric glide): skip this library and
put this clause, verbatim, in the mid-leg slot of EVERY leg:

```
The camera keeps exactly the same high isometric angle throughout — no rotation,
no orbit, no tilt. It only travels straight and level, the world sliding past
beneath the same view.
```

- **Half-orbit** (product, luxury): "sweeping in a slow half-orbit around [the
  hero object], keeping it centered, then continuing past it"
- **Crane-up reveal** (scale, atriums, campuses): "rising smoothly as the full
  scale of [the space] reveals below"
- **Low lateral track** (production lines, counters, shelves): "tracking low and
  level alongside [the line], foreground objects sliding past in parallax"
- **Push-in + ease back** (craft, detail): "pushing in close to [the craft
  moment] until it nearly fills the frame, then easing gently back out"
- **Rise-and-swoop** (travel, outdoors): "climbing in a gentle arc over [the
  terrain], then swooping down toward [the next focal point]"

After rendering each leg, **check its last frame** before generating the next:
it should read as a frame from a calm forward glide (no sideways motion blur, no
half-finished orbit). If not, re-roll this leg — a bad handoff frame poisons
every leg after it.

---

## Connector clip prompt — video mode, architecture B (frame-locked)

`--start-image = LAST frame of clip_i` · `--end-image = FIRST frame of
clip_{i+1}` (both extracted from the rendered videos — never the stills).

```
Single continuous camera move, no cuts. Pull up and back out of [SCENE i],
rise into the sky, glide across the connected miniature world, and arrive at the
opening of [SCENE i+1]. Keep the exact colours, lighting, and world of the start
and end frames. Smooth, graceful, slow motion, subtle parallax. No text, no
captions, no watermark.
```

Duration ~5 s is plenty. If the model has no `--end-image` support, switch to
architecture A (no connectors) rather than faking it.

---

## Connector frame prompt — image mode (the engine blends these)

One **abstract full-bleed neutral zone** per seam, drawn in the same palette.
No ground, no horizon, no identifiable place — it must be able to read as the
continuation of BOTH neighbours.

```
Abstract seamless transition frame: [MOTIF] filling the entire frame edge to
edge, like flying into it, no ground, no horizon. [STYLE PREAMBLE]
```

### Connector motif library (pick by what the journey needs)

| Seam mood | Motif |
|---|---|
| Day→day, warm | Dense rounded **cloud bank**, soft white/cream puffs, warm glow within |
| Dawn/dusk, spiritual | Radiant **light tunnel**, volumetric god rays streaming toward centre |
| Night, cosmic | Swirling **aurora ribbons** or **star warp**, glowing ribbons toward centre |
| Night, cozy | **Ember-and-snow storm**, warm sparks against deep navy, soft bokeh |
| Indoor→outdoor | **Doorway of light**, a glowing arch with haze spilling through |
| Any→brand moment | **Portal / iris**, a soft-edged glowing ring that widens to fill the frame |
| Industrial | **Steam / mist pass**, fog rolling across, machinery silhouettes dissolving |
| Underwater / fluid | **Bubble veil / current of light**, refracted caustics filling the frame |

Rules: pick motifs that share the palette and light direction of both neighbours;
avoid text and hard shapes (a hard-edged rectangle reads as a cut). For the
engine blend to hide the swap, the motif must be **screen-filling at its peak**.

---

## Voiceover prompt (optional)

Keep it one scene, one breath (≈ 12–18 s total for 4–6 scenes, or skip it):

```
[2–3 words] scene hook. [One sentence of the pitch, present tense, concrete].
[N-1 sentence connecting to the next scene.] — then, for the final section, a
CTA line: "[BRAND_NAME]. [ONE-LINE PITCH]."
```

Example (expedition brand):
"Before the trail, there's only a map. Then the valley opens, the ice turns
blue, and the sky starts to glow. Northlight. The world, one flight at a time."

Read it as a calm narrator, warm and unhurried — a travel documentary, not an ad.

---

## End-card / CTA (built by the engine from the manifest)

The engine renders the final card from manifest `cta`: `headline`, `button`,
`href`, `showAt`. No image needed — but if the brand wants a hero product shot
as the finale backdrop, use the last section's still with the hero-product
prompt variant above.
