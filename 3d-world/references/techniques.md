# Techniques: making the flight seamless (3D World)

Everything that makes a scroll world feel like ONE continuous camera flight
instead of a slideshow of clips. Read this before generating connectors.

---

## The one rule: seams must be frame-identical (video) or screen-covered (image)

- **Video mode:** a connector's endpoints must be the ACTUAL rendered frames of
  its neighbours — `clip_i`'s last frame and `clip_{i+1}`'s first frame, fed to
  the model as `--start-image` / `--end-image`. Never a fresh render of the same
  scene: every generation differs, and two different renders of "the kitchen"
  will pop where they meet. When the connector hands the exact pixels over, both
  seams are identical by construction:
  `clip_i.end == conn.start` and `conn.end == clip_{i+1}.start`.
- **Image mode:** no video exists, so the engine *covers* the seam instead. A
  connector frame (abstract neutral zone) fades in over the outgoing scene until
  it fills 100 % of the screen, then fades out onto the incoming scene. The
  underlying scene swap happens while the screen is entirely connector — there is
  no visible cut. For this to work the connector frame must be **screen-filling
  at its peak** and share palette + light with both neighbours.

---

## Architecture A vs B — when do connectors even exist?

| | A — Continuous forward take | B — Dive-in + aerial connector |
|---|---|---|
| Shape | N legs, each starting from the previous leg's last rendered frame | N dives + N−1 connectors that hop between scenes |
| Seams | Frame-identical by construction (leg.start == prev.end) | Frame-locked via start/end images |
| Camera across seams | Never reverses (forward only) | Reverses at every seam (dive in → pull out) |
| Feels like | A walkthrough; one unbroken glide | Map-hopping a miniature world (Emons-style) |
| Use for | Photoreal, grounded, hospitality, product | Diorama / miniature / god's-eye worlds only |
| Re-roll risk | Low (plain glide); +1 per expressive leg | Moderate (expressive moves) |

Rule of thumb: if the art direction is miniature/toy-like, B's reversals read as
intentional "zoom out to the map, fly to the next island". If it's grounded or
photoreal, B reads as a **rewind stutter** — use A. If the user picked B against
a grounded direction, say why and confirm before rendering.

---

## Camera grammar — the move should fit the concept

"Forward only" is the *seam* rule, not the *leg* rule:

- **Position continuity** at a seam comes from the frame handoff (next leg
  starts from the previous leg's actual last frame).
- **Velocity continuity** at a seam means the camera must never reverse *across
  a seam* — that's the rewind stutter.
- **Inside a single leg the camera is free** — orbits, crane-ups, lateral
  tracks, push-ins that ease back out are all safe mid-clip. Reversals are only
  fatal *across* seams.

Motion handoff contract (keep in every clip prompt, verbatim):
every leg **ends by settling into a slow, steady forward drift** toward the next
destination (final ~1 s), and every leg **begins by continuing that same drift**.

| Concept / tone | Mid-leg move |
|---|---|
| Product / luxury retail | slow half-orbit around the hero object, then continue past it |
| Real estate / hospitality | steadicam glide through doorways; gentle crane-up in atria |
| Industrial / process / logistics | low lateral track alongside the line, foreground parallax |
| Travel / outdoors / campus | drone-style rise-and-reveal, then a descending swoop |
| Food / craft / detail-driven | push in close to the craft moment, ease back, carry on |
| Playful miniature (arch B) | dives + aerial hops — the connector IS the grammar |

Scroll is a scrubber: visitors scroll **up**, so every move also plays in
reverse. Seam velocity must be consistent in both directions.

---

## Pacing

- **Per scene:** 4–7 s of timeline. **Connector:** 2–3 s (video: ~5 s clips but
  you can trim to 3; image: 2–2.5 s feels right).
- **Total:** 18–35 s for 4–6 scenes. More scenes ≠ better; each scene needs
  enough scroll distance to be seen.
- The engine maps scroll→time with per-section `scroll` weight (more distance =
  longer dwell) and `linger` (the camera settles while the headline peaks, then
  picks up toward the seam). Prefer expressive motion in the *clip* and restraint
  in the *scrub mapping* — they compound.
- Image mode: keep camera zoom within ~1.0–1.45× so the upscaled still never
  looks soft; prefer lateral drift + gentle rotation over heavy zoom.

---

## Connector motifs (image mode) — pick by the journey's mood

A connector is a full-bleed neutral zone the camera flies INTO. It must not be
an identifiable place (a hard-edged shape reads as a cut). Library:

| Seam mood | Motif |
|---|---|
| Day→day, warm | dense cloud bank, soft white/cream puffs, warm glow within |
| Dawn/dusk, spiritual | light tunnel, volumetric god rays streaming toward centre |
| Night, cosmic | aurora ribbons / star warp, glowing ribbons toward centre |
| Night, cozy | ember-and-snow storm, warm sparks vs deep navy bokeh |
| Indoor→outdoor | doorway of light, glowing arch with haze spilling through |
| Brand moment | portal / iris, soft-edged glowing ring widening to fill the frame |
| Industrial | steam / mist pass, fog rolling across, silhouettes dissolving |
| Underwater / fluid | bubble veil / current of light, refracted caustics |

Same motif family across a world (e.g. all-light-tunnels) can feel repetitive;
alternate 2–3 motifs. Keep palette + light direction shared with both neighbours.

---

## Encoding for scrub (video mode)

Scrubbing writes `video.currentTime` every rendered frame, so **seek cost is the
enemy** — the player must decode from the nearest keyframe.

- H.264 (`libx264`), `yuv420p`, `-movflags +faststart`, **no audio**.
- Native resolution — never upscale (encode what `ffprobe` reports).
- `crf 20` desktop / `crf 23` mobile; **GOP 8** desktop / **GOP 4** mobile
  (twice the keyframes ≈ half the seek-decode work); `-g 2` or `-g 1`
  (all-intra) if phones still stutter.
- Light sharpen (`unsharp`) reads crisper when scrubbing fast.
- Budget: 720p clips ≈ 200–600 KB each; 1080p ≈ 0.5–2 MB each. 5 scenes +
  4 connectors at 720p ≈ 3–6 MB total — fine to lazy-load.

## Image mode asset budget

- ≤ 1600 px wide JPEG q85 / WebP q84 per frame ≈ 200–500 KB. The engine zooms
  to ~1.45×, so keep resolution above viewport size.
- 9 frames (5 scenes + 4 connectors) ≈ 2–4 MB total. No codecs, no seek cost,
  works everywhere including `file://`.

---

## Mobile

- **Native portrait chain (video mode, recommended):** render the whole chain
  again in 9:16 composed for phones — not a centre-crop of the landscape film
  (~2× the video credits; state it at intake).
- **Crop fallback (stopgap):** centre-crop 720p with GOP 4 — call it out to the
  user, never ship it silently (portrait phones see the landscape film's centre
  ~26 %).
- **Image mode mobile:** the engine letterboxes or crops via `object-fit`; since
  stills have no codec seek cost, phones scrub smoothly — compose stills centred
  so the crop is painless.

---

## Performance & accessibility

- Lazy-load clips on approach (engine default); keep at most 2–3 videos decoded
  at once. Posters/stills show before load.
- `prefers-reduced-motion`: engine falls back to a static poster + normal page
  content. Don't fight it.
- Progressive enhancement: without JS, the first still + the page copy still
  tell the story.
- Videos: `muted`, `playsinline`, no `autoplay` attribute (scrubbing doesn't
  need it and it fights autoplay policies).

---

## QA checklists

**Still cohesion (before chaining):** same palette? same light? same scale of
objects? same art direction? If any still is off, re-roll it before rendering
any video from it.

**Seam QA (video):** extract 3 frames each side of every seam and compare.
Judge **composition, not raw PSNR** — a verified-good seam reads ~18–25 dB from
detail shimmer alone; a real mismatch shows as different composition, lighting,
or geometry. Calibrate against a known-good seam first.

**Seam QA (image):** connector frame must sit in the same palette and light
direction as BOTH neighbours; check it reads "abstract passage" not "cut".

**Scroll feel:** 3–4 scrolls should cover the whole film at a comfortable pace;
headlines peak mid-scene (linger); back-scrolling feels as smooth as forward.

**Ship checklist:** HTTP-served, console clean, all relative paths, poster
fallback, total weight budget met, CTA link works, mobile + reduced-motion
checked.
