# AGENTS.md — guide for Arena AI Agent Mode

This repo is a **skill package** for building immersive, **scroll-scrubbed "3D
scrolling video" landing pages**. When the user connects this repo and asks for a
"3D world", "scroll world", "scrolling video website", or a cinematic landing
page for any brand/industry, follow this guide.

## What to do

1. **Read `3d-world/SKILL.md`** — it is the full playbook (intake interview,
   pipeline, seam rules, quality checklist). Follow it.
2. **Default to Mode A (motion-render video).** In Arena Agent Mode you have an
   **image tool** and can get **ffmpeg** — but there is **no AI video-generation
   model**. So produce real, scrubbable video like this:
   - Interview the user (brand, 4–6 hex palette, art direction, ordered scene
     sequence, camera feel, CTA).
   - Generate **cohesive scene stills + abstract connector stills** with the
     image tool (identical style preamble every prompt; centred compositions).
   - Turn each still into a **real camera-move `.mp4`** with
     `python3 3d-world/scripts/motion_render.py` (pick a `--move` per scene;
     optional `--fg` for 3D parallax). This makes the page a *video* site.
   - Wire the engine's **video mode** (`mode:'video'`, `crossfade:0.15`) with the
     generated clips + `3d-world/references/scrub-engine.js`.
   - Serve over HTTP and verify the hero **scrubs smoothly on scroll**.
3. **Get ffmpeg** if missing: `pip install --user --break-system-packages
   imageio-ffmpeg` — `motion_render.py` finds the bundled binary automatically.
4. Only fall back to **image mode** (stills animated by the engine) if ffmpeg is
   genuinely unavailable. Only use **true AI video** (Mode B) if a real video
   API/CLI is present and authenticated — do not pretend it exists in Arena.

## Non-negotiable quality rules

- **Smoothstep-eased, jitter-free moves** (`motion_render.py` defaults) — never
  a jerky linear zoom.
- **Cohesive world**: same palette/light/scale across every still; re-roll any
  off-style still before rendering its video.
- **Seamless flight**: full-bleed abstract connector clips + 0.15 s crossfade hide
  each scene change. Connectors must be screen-filling and palette-matched to
  both neighbours.
- **Scrub-encoded video**: H.264, yuv420p, GOP 8, `+faststart`, no audio, native
  resolution. Prefer 720p clips (~200–600 KB each).
- **No text/letters/logos in any generated image.**
- Verify the live page: scroll scrubs smoothly, JS-off poster fallback, no
  console errors, mobile + `prefers-reduced-motion` handled.

Deliver the finished site as a working, HTTP-served page the user can scroll.
