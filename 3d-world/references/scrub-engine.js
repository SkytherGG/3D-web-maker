/*!
 * ScrollWorld — portable scroll-scrub engine for 3D World skill landing pages.
 * Zero dependencies, vanilla JS, framework-agnostic.
 *
 * Scroll = time. The visitor scrolls and the camera flies through a connected
 * world with no cuts. Works in three render modes (auto-detected or forced):
 *
 *   video  — scrub real video clips (sections + connectors) via currentTime.
 *   image  — animate stills (Ken-Burns style camera keyframes) and crossfade
 *            through full-bleed connector frames. No video needed.
 *   sprite — draw pre-extracted frames from a sprite sheet onto a canvas
 *            (pixel-perfect scrubbing, heaviest assets).
 *
 * Usage:
 *   <div id="world"></div>
 *   <script src="scrub-engine.js"></script>
 *   <script>
 *     const world = new ScrollWorld({
 *       container: '#world',
 *       manifest: 'manifest.json',   // URL or plain object (see schema below)
 *       mode: 'auto',                // auto | video | image | sprite
 *       runway: 700,                 // scroll length in viewport-heights
 *       progressBar: true,           // HUD toggles (all default true)
 *       timecode: true,
 *       labels: true,
 *       cinematic: true,             // show the play/pause cinematic toggle
 *       onProgress: (p, t) => {},    // p: 0..1, t: seconds
 *       onSceneChange: (section) => {}
 *     });
 *   </script>
 *
 * Manifest shape (see scene-manifest.example.json):
 *   {
 *     "version": 1,
 *     "mode": "image",                 // auto | video | image | sprite
 *     "fps": 30,                       // sprite mode
 *     "runway": 700,                   // optional, overrides constructor
 *     "background": "#0B1E3A",
 *     "brand": { "name": "NORTHLIGHT" },
 *     "sections": [{
 *       "id": "trailhead",
 *       "label": "01 — Trailhead",
 *       "eyebrow": "DAY 01",
 *       "title": "Where the journey begins",
 *       "body": "One sentence.",
 *       "tags": ["Aurora", "Glaciers"],
 *       "clip": "video/trailhead.mp4",   // video mode
 *       "clipMobile": "video/trailhead-m.mp4",
 *       "still": "img/trailhead.webp",   // image mode
 *       "sheet": { "src": "sprites/trailhead.png", "cols": 4, "rows": 2 }, // sprite
 *       "poster": "img/trailhead.webp",  // optional loading/poster frame
 *       "duration": 6,                   // timeline seconds (auto-fallback 5)
 *       "scroll": 1.2,                   // relative scroll weight
 *       "linger": 0.8,                   // seconds of camera hold at scene peak
 *       "camera": {                      // image mode keyframes
 *         "from": { "scale": 1, "x": 0, "y": 0, "rotate": 0 },
 *         "to":   { "scale": 1.24, "x": -1.5, "y": -1, "rotate": 0.3 },
 *         "ease": "inOut"                // linear | in | out | inOut
 *       },
 *       "crossfade": 0.1                 // video mode seam crossfade (s)
 *     }],
 *     "connectors": [{                   // length = sections.length - 1
 *       "id": "c1",
 *       "clip": "video/conn1.mp4",
 *       "still": "img/conn1.webp",
 *       "sheet": { ... },
 *       "duration": 2.5,
 *       "blend": 0.5,                    // image mode: fraction of screen cover
 *       "camera": { "from": {"scale":1.15}, "to": {"scale":1.5}, "ease":"in" }
 *     }],
 *     "cta": {
 *       "headline": "Ready when you are.",
 *       "button": "Book your expedition",
 *       "href": "https://example.com",
 *       "showAt": 0.92                   // fraction of timeline when revealed
 *     },
 *     "audio": { "src": "audio/ambient.mp3", "volume": 0.35 }
 *   }
 *
 * MIT License — part of the 3D World agent skill.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScrollWorld = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  Utilities
   * ------------------------------------------------------------------ */

  var DEFAULTS = {
    mode: 'auto',
    runway: 700,
    progressBar: true,
    timecode: true,
    labels: true,
    cinematic: true,
    crossfade: 0.1,
    mobile: 'auto'          // 'auto' = narrow viewports use clipMobile/stillMobile
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function smoothstep(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function ease(name, t) {
    t = clamp(t, 0, 1);
    switch (name) {
      case 'linear': return t;
      case 'in':     return t * t;
      case 'out':    return t * (2 - t);
      case 'inOut':
      default:       return smoothstep(t);
    }
  }

  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function el(tag, cls, parent, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    if (parent) parent.appendChild(node);
    return node;
  }

  function isMobile() {
    return typeof window !== 'undefined' &&
      window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  /* ------------------------------------------------------------------ *
   *  Engine
   * ------------------------------------------------------------------ */

  function ScrollWorld(opts) {
    if (!(this instanceof ScrollWorld)) return new ScrollWorld(opts);
    opts = opts || {};
    if (typeof opts.container === 'string') {
      opts.container = document.querySelector(opts.container);
    }
    if (!opts.container) throw new Error('ScrollWorld: a container element is required.');
    this.opts = opts;
    this._bind();
  }

  ScrollWorld.prototype._bind = function () {
    var self = this;
    this.destroyed = false;
    this.container = this.opts.container;
    this.stage = null;
    this.entries = [];          // timeline: {type:'section'|'connector', ...}
    this.total = 0;
    this.mode = this.opts.mode || 'auto';
    this.cinematic = false;
    this.cinematicTime = 0;
    this.reduced = (typeof window !== 'undefined') &&
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._layers = { base: null, fx: null };
    this._videos = {};          // entryId -> HTMLVideoElement
    this._videoAlpha = {};      // entryId -> alpha for crossfade
    this._cur = -1;             // current entry index
    this._lastScroll = -1;

    this._injectCSS();
    this._buildDOM();

    var manifest = this.opts.manifest;
    if (manifest && typeof manifest === 'object') {
      this._start(manifest);
    } else if (typeof manifest === 'string') {
      fetch(manifest).then(function (r) { return r.json(); }).then(function (m) {
        self._start(m);
      }).catch(function (e) {
        console.error('ScrollWorld: failed to load manifest', e);
      });
    } else {
      throw new Error('ScrollWorld: manifest (object or URL) is required.');
    }

    this._onScroll = function () { self._userInteracted(); };
    this._onKey = function (e) {
      if (e.key === ' ' && this.opts.cinematic !== false) {
        e.preventDefault();
        self.toggleCinematic();
      }
    };
    this._onTouch = function () { self._userInteracted(); };

    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('wheel', this._onScroll, { passive: true });
    window.addEventListener('touchstart', this._onTouch, { passive: true });
    document.addEventListener('keydown', this._onKey);

    this._raf = function () {
      if (self.destroyed) return;
      self._frame();
      requestAnimationFrame(self._raf);
    };
    requestAnimationFrame(this._raf);
  };

  ScrollWorld.prototype._start = function (manifest) {
    this.manifest = manifest;
    this.mode = this._resolveMode();
    this.runway = (this.opts.runway != null ? this.opts.runway : manifest.runway) || DEFAULTS.runway;
    this._buildTimeline();
    this._buildMedia();
    this._applyRunway();

    var bg = manifest.background || '#0B1E3A';
    this.stage.style.background = bg;

    if (manifest.brand && manifest.brand.name && this.opts.labels !== false) {
      this._brandEl.textContent = manifest.brand.name;
      this._brandEl.style.display = 'block';
    }
    if (manifest.brand && manifest.brand.logoSrc) {
      this._brandEl.innerHTML = '<img alt="" src="' + manifest.brand.logoSrc + '"/>';
    }

    this._buildCopy();
    this._buildCTA();

    if (this.reduced) {
      this._reducedMode();
      return;
    }

    var audio = manifest.audio;
    if (audio && audio.src) {
      this._audio = document.createElement('audio');
      this._audio.src = audio.src;
      this._audio.loop = true;
      this._audio.volume = audio.volume != null ? audio.volume : 0.35;
      this._audioStart = function () {
        if (self._audio && self._audio.paused) {
          self._audio.play().catch(function () {});
        }
        self._unbindAudioStart();
      };
      this._bindAudioStart();
    }
  };

  ScrollWorld.prototype._resolveMode = function () {
    if (this.mode !== 'auto') return this.mode;
    var sec = (this.manifest.sections || [])[0];
    if (!sec) return 'image';
    if (sec.clip) return 'video';
    if (sec.sheet) return 'sprite';
    return 'image';
  };

  /* ----- timeline --------------------------------------------------- */

  ScrollWorld.prototype._buildTimeline = function () {
    var sections = this.manifest.sections || [];
    var connectors = this.manifest.connectors || [];
    if (!sections.length) throw new Error('ScrollWorld: manifest.sections is empty.');
    var entries = [];
    var t = 0;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      var dur = s.duration || 5;
      if (s.scroll) dur = Math.max(1.5, dur * Math.max(0.4, Math.min(3, s.scroll)));
      entries.push({ type: 'section', idx: i, data: s, start: t, duration: dur });
      t += dur;
      if (i < connectors.length) {
        var c = connectors[i];
        var cd = c.duration || 2.5;
        entries.push({ type: 'connector', idx: i, data: c, start: t, duration: cd });
        t += cd;
      }
    }
    this.entries = entries;
    this.total = t;
    this.sections = sections;
    this.connectors = connectors;
  };

  ScrollWorld.prototype._entryAt = function (t) {
    var entries = this.entries;
    for (var i = 0; i < entries.length; i++) {
      if (t < entries[i].start + entries[i].duration) return entries[i];
    }
    return entries[entries.length - 1];
  };

  /* ----- DOM -------------------------------------------------------- */

  ScrollWorld.prototype._buildDOM = function () {
    var parent = this.container.parentNode;
    if (!parent) throw new Error('ScrollWorld: container must be attached to the DOM.');

    // The stage is fixed; a sibling spacer provides the scroll runway.
    var stage = el('div', 'sw sw-stage', this.container);
    this.stage = stage;

    // Layer roots. Image mode: base + fx. Video: single root + fx for crossfades.
    this._layerBase = el('div', 'sw sw-layer sw-base', stage);
    this._layerFx = el('div', 'sw sw-layer sw-fx', stage);
    this._canvas = el('canvas', 'sw sw-canvas', stage);
    this._canvas.style.display = 'none';

    el('div', 'sw sw-vignette', stage);

    // Copy layer (one block per section, shown/hidden by the engine).
    this._copyLayer = el('div', 'sw sw-copy', stage);

    // HUD
    var hud = el('div', 'sw sw-hud', stage);
    this._brandEl = el('div', 'sw sw-brand', hud, '');
    this._brandEl.style.display = 'none';

    var tr = el('div', 'sw sw-topright', hud);
    this._labelEl = el('div', 'sw sw-label', tr, '');
    this._timeEl = el('div', 'sw sw-timecode', tr, '');

    this._hintEl = el('div', 'sw sw-hint', hud,
      '<span>SCROLL</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>');

    this._cineBtn = el('button', 'sw sw-cine', hud, '\u25B6');
    this._cineBtn.setAttribute('aria-label', 'Play cinematic auto-scroll');
    var self = this;
    this._cineBtn.addEventListener('click', function () { self.toggleCinematic(); });

    this._progress = el('div', 'sw sw-progress', hud);
    this._progressFill = el('div', 'sw sw-progress-fill', this._progress);

    this._cta = el('div', 'sw sw-cta', hud);
    this._cta.style.display = 'none';

    // Spacer after the container.
    this._spacer = el('div', 'sw-spacer', parent);
  };

  ScrollWorld.prototype._applyRunway = function () {
    if (this.reduced) { this._spacer.style.height = '200vh'; return; }
    this._spacer.style.height = this.runway + 'vh';
  };

  ScrollWorld.prototype._buildCopy = function () {
    this._copyItems = [];
    this.sections.forEach(function (s) {
      var item = el('div', 'sw sw-copy-item', this._copyLayer);
      if (s.eyebrow) item.appendChild(el('p', 'sw sw-eyebrow', null, s.eyebrow));
      if (s.title) item.appendChild(el('h2', 'sw sw-title', null, s.title));
      if (s.body) item.appendChild(el('p', 'sw sw-body', null, s.body));
      if (s.tags && s.tags.length) {
        var tags = el('div', 'sw sw-tags', item);
        s.tags.forEach(function (tg) { el('span', 'sw sw-tag', tags, tg); });
      }
      item.style.opacity = '0';
      item.style.transform = 'translateY(18px)';
      this._copyItems.push(item);
    }, this);
  };

  ScrollWorld.prototype._buildCTA = function () {
    var cta = this.manifest.cta;
    if (!cta) return;
    this._cta.innerHTML = '';
    var inner = el('div', 'sw sw-cta-inner', this._cta);
    if (cta.eyebrow) inner.appendChild(el('p', 'sw sw-eyebrow sw-cta-eyebrow', null, cta.eyebrow));
    if (cta.headline) inner.appendChild(el('h2', 'sw sw-cta-title', null, cta.headline));
    if (cta.sub) inner.appendChild(el('p', 'sw sw-cta-sub', null, cta.sub));
    var a = el('a', 'sw sw-cta-btn', inner, cta.button || 'Get started');
    a.href = cta.href || '#';
    if (cta.onClick) a.addEventListener('click', cta.onClick);
    this._cta.style.display = '';
  };

  /* ----- media (image / video / sprite) ------------------------------ */

  ScrollWorld.prototype._buildMedia = function () {
    var self = this;
    if (this.mode === 'image') {
      // Preload all stills (light enough) and attach as backgrounds.
      this._stillEls = {};
      this.entries.forEach(function (e) {
        var src = e.data.still || e.data.poster;
        if (!src) return;
        var layer = el('div', 'sw sw-still', null);
        var img = new Image();
        img.onload = function () {
          layer.style.backgroundImage = 'url("' + src + '")';
          layer.style.opacity = '1';
        };
        img.src = src;
        self._stillEls[e.data.id || e.type + e.idx] = layer;
      });
    } else if (this.mode === 'video') {
      this._video = el('video', 'sw sw-video', this._layerBase);
      this._video.muted = true;
      this._video.playsInline = true;
      this._video.preload = 'auto';
      this._videoCross = el('video', 'sw sw-video', this._layerFx);
      this._videoCross.muted = true;
      this._videoCross.playsInline = true;
      this._videoCross.preload = 'auto';
    } else if (this.mode === 'sprite') {
      this._canvas.style.display = 'block';
      this._sheetImgs = {};
      this.entries.forEach(function (e) {
        var sheet = e.data.sheet;
        if (!sheet) return;
        var img = new Image();
        img.src = sheet.src;
        self._sheetImgs[e.data.id || e.type + e.idx] = { img: img, sheet: sheet };
      });
    }
  };

  ScrollWorld.prototype._videoFor = function (entry) {
    var id = entry.type + ':' + entry.idx;
    if (this._videos[id]) return this._videos[id];
    var v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    var src = entry.data.clip;
    if (isMobile() && entry.data.clipMobile) src = entry.data.clipMobile;
    v.src = src;
    this._videos[id] = v;
    return v;
  };

  ScrollWorld.prototype._trimVideos = function () {
    var keep = {};
    var cur = this.entries[this._cur];
    var prev = this.entries[this._cur - 1];
    var next = this.entries[this._cur + 1];
    [cur, prev, next].forEach(function (e) {
      if (e) keep[e.type + ':' + e.idx] = true;
    });
    for (var id in this._videos) {
      if (!keep[id]) {
        var v = this._videos[id];
        v.pause();
        v.removeAttribute('src');
        v.load();
        if (v.parentNode) v.parentNode.removeChild(v);
        delete this._videos[id];
      }
    }
  };

  /* ----- per-frame render -------------------------------------------- */

  ScrollWorld.prototype._frame = function () {
    if (!this.manifest) return;

    var t;
    if (this.cinematic) {
      // Autoplay: advance time AND keep the page scrolled in sync.
      this.cinematicTime += 1 / 60;
      if (this.cinematicTime > this.total) {
        this.cinematicTime = 0; // loop
      }
      t = this.cinematicTime;
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var sy = (t / this.total) * max;
      if (Math.abs(window.scrollY - sy) > 1) {
        this._autoScrolling = true;
        window.scrollTo(0, sy);
        this._autoScrolling = false;
      }
    } else {
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var p = clamp(window.scrollY / max, 0, 1);
      if (this._hintShown && p > 0.03) this._hideHint();
      t = p * this.total;
    }

    var entry = this._entryAt(t);
    var idx = this.entries.indexOf(entry);
    if (idx !== this._cur) {
      this._cur = idx;
      this._onEntryChange(entry, idx);
    }

    if (this.mode === 'image') this._renderImage(t, entry, idx);
    else if (this.mode === 'video') this._renderVideo(t, entry, idx);
    else if (this.mode === 'sprite') this._renderSprite(t, entry);

    this._renderHUD(t, entry, idx);

    if (this.opts.onProgress) this.opts.onProgress(clamp(t / this.total, 0, 1), t);
  };

  ScrollWorld.prototype._onEntryChange = function (entry, idx) {
    // Notify scene change (only for sections).
    if (entry.type === 'section' && this.opts.onSceneChange) {
      this.opts.onSceneChange(entry.data);
    }
    if (this.mode === 'video') this._trimVideos();
  };

  /* image mode -------------------------------------------------------- */

  ScrollWorld.prototype._renderImage = function (t, entry, idx) {
    var self = this;
    var base = this._layerBase;
    var fx = this._layerFx;
    var local = t - entry.start;
    var p = local / entry.duration;

    // Decide what the base layer shows.
    var baseEntry = entry;
    var baseProg = p;

    if (entry.type === 'connector') {
      var prev = this.entries[idx - 1];
      var next = this.entries[idx + 1];
      var mid = 0.5;
      if (p < mid) {
        baseEntry = prev;                       // outgoing scene keeps pushing in
        var push = smoothstep(p / mid);
        baseProg = 1 + 0.28 * push;             // camera continues past its section
      } else {
        baseEntry = next;                       // incoming scene, arriving
        var arrive = smoothstep((p - mid) / (1 - mid));
        baseProg = 0.25 * arrive;
      }
    }

    // Base layer image + camera transform.
    var bId = baseEntry.data.id || baseEntry.type + baseEntry.idx;
    var bLayer = this._stillEls[bId];
    if (bLayer && base.firstChild !== bLayer) {
      while (base.firstChild) base.removeChild(base.firstChild);
      base.appendChild(bLayer);
    }
    if (baseEntry.type === 'section' && baseEntry.data.camera) {
      base.style.transform = this._cameraTransform(baseEntry.data.camera, baseProg);
    } else {
      base.style.transform = 'scale(1.02)';
    }

    // FX layer: connector crossfade envelope.
    if (entry.type === 'connector') {
      var c = entry.data;
      var fId = c.id || 'connector' + entry.idx;
      var fLayer = this._stillEls[fId];
      if (fLayer && fx.firstChild !== fLayer) {
        while (fx.firstChild) fx.removeChild(fx.firstChild);
        fx.appendChild(fLayer);
      }
      var env = this._connectorEnvelope(p, c.blend);
      fx.style.opacity = String(env);
      if (c.camera) {
        fx.style.transform = this._cameraTransform(c.camera, p);
      } else {
        fx.style.transform = 'scale(1.25)';
      }
    } else {
      fx.style.opacity = '0';
    }
  };

  ScrollWorld.prototype._cameraTransform = function (cam, p) {
    var f = cam.from || {};
    var to = cam.to || {};
    var e = ease(cam.ease || 'inOut', p);
    var scale = lerp(f.scale != null ? f.scale : 1, to.scale != null ? to.scale : 1, e);
    var x = lerp(f.x || 0, to.x || 0, e);
    var y = lerp(f.y || 0, to.y || 0, e);
    var r = lerp(f.rotate || 0, to.rotate || 0, e);
    return 'translate(' + x.toFixed(3) + '%,' + y.toFixed(3) + '%) scale(' +
      scale.toFixed(4) + ') rotate(' + r.toFixed(3) + 'deg)';
  };

  ScrollWorld.prototype._connectorEnvelope = function (p, blend) {
    // 0 -> full (first quarter), hold, full -> 0 (last quarter).
    var q = 0.25;
    if (p < q) return smoothstep(p / q);
    if (p > 1 - q) return 1 - smoothstep((p - (1 - q)) / q);
    return 1;
  };

  /* video mode -------------------------------------------------------- */

  ScrollWorld.prototype._renderVideo = function (t, entry, idx) {
    var v = this._videoFor(entry);
    var target = t - entry.start;
    if (Math.abs(v.currentTime - target) > 0.025 && !v.seeking) {
      v.currentTime = clamp(target, 0, Math.max(0.01, entry.duration));
    }
    if (this._video !== v) {
      this._layerBase.appendChild(v);
      this._video = v;
    }
    this._video.style.opacity = '1';

    // Crossfade: fade the previous entry out over the first `cf` seconds.
    var cf = entry.data.crossfade != null ? entry.data.crossfade
            : this.manifest.crossfade != null ? this.manifest.crossfade : 0.1;
    var local = t - entry.start;
    var prev = this.entries[idx - 1];
    if (prev && local < cf && prev.data.clip) {
      var pv = this._videoFor(prev);
      if (Math.abs(pv.currentTime - prev.duration) > 0.025 && !pv.seeking) {
        pv.currentTime = Math.max(0, prev.duration - 0.001);
      }
      this._layerFx.appendChild(pv);
      pv.style.opacity = String(1 - local / cf);
      this._crossing = pv;
    } else if (this._crossing) {
      this._crossing.style.opacity = '0';
      this._crossing = null;
    }
  };

  /* sprite mode ------------------------------------------------------- */

  ScrollWorld.prototype._renderSprite = function (t, entry) {
    var sheet = this._sheetImgs[entry.data.id || entry.type + entry.idx];
    var canvas = this._canvas;
    if (!sheet || !sheet.img.complete || !sheet.img.naturalWidth) return;

    var fps = this.manifest.fps || entry.data.fps || 30;
    var frame = Math.max(0, Math.floor((t - entry.start) * fps));
    var count = sheet.sheet.count || (sheet.sheet.cols * sheet.sheet.rows) || 1;
    var total = Math.max(1, count - 1);
    if (frame > total) frame = total;

    var cols = sheet.sheet.cols || Math.ceil(Math.sqrt(count));
    var rows = sheet.sheet.rows || Math.ceil(count / cols);
    var fw = sheet.img.naturalWidth / cols;
    var fh = sheet.img.naturalHeight / rows;
    var cx = (frame % cols) * fw;
    var cy = Math.floor(frame / cols) * fh;

    var W = canvas.width, H = canvas.height;
    var scale = Math.max(W / fw, H / fh);
    var dw = fw * scale, dh = fh * scale;
    var dx = (W - dw) / 2, dy = (H - dh) / 2;

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(sheet.img, cx, cy, fw, fh, dx, dy, dw, dh);
  };

  /* HUD ------------------------------------------------------------------ */

  ScrollWorld.prototype._renderHUD = function (t, entry, idx) {
    // Timecode
    if (this.opts.timecode !== false) {
      this._timeEl.textContent = fmtTime(t) + ' / ' + fmtTime(this.total);
    }

    // Progress bar
    if (this.opts.progressBar !== false) {
      var pct = clamp(t / this.total, 0, 1) * 100;
      this._progressFill.style.width = pct.toFixed(2) + '%';
    }

    // Copy: the section that is "now" (during a connector, the one we are
    // arriving at after the midpoint, else the one we just left).
    var active = -1;
    if (entry.type === 'section') {
      active = entry.idx;
    } else {
      var local = t - entry.start;
      active = (local / entry.duration) >= 0.5 ? idx + 1 : idx - 1;
    }
    this._copyItems.forEach(function (item, i) {
      var on = i === active;
      var targetOpacity = on ? 1 : 0;
      var targetY = on ? 0 : 18;
      if (Math.abs(parseFloat(item.style.opacity) - targetOpacity) > 0.02) {
        item.style.opacity = String(targetOpacity);
        item.style.transform = 'translateY(' + targetY + 'px)';
      }
    });

    // Label + CTA
    var sec = entry.type === 'section' ? entry.data : null;
    if (sec && sec.label && this.opts.labels !== false) {
      this._labelEl.textContent = sec.label;
    } else if (this.opts.labels !== false) {
      this._labelEl.textContent = '';
    }
    var cta = this.manifest.cta;
    if (cta && cta.showAt) {
      var show = t >= this.total * cta.showAt;
      this._cta.style.opacity = show ? '1' : '0';
      this._cta.style.pointerEvents = show ? 'auto' : 'none';
    }
  };

  /* reduced motion ----------------------------------------------------- */

  ScrollWorld.prototype._reducedMode = function () {
    // Static poster of the first section + readable copy, no camera moves.
    var first = this.entries[0];
    if (this.mode === 'image' && first && first.data.still) {
      this._layerBase.style.backgroundImage = 'url("' + first.data.still + '")';
      this._layerBase.style.backgroundSize = 'cover';
      this._layerBase.style.backgroundPosition = 'center';
      this._layerBase.style.backgroundAttachment = 'fixed';
      this._layerBase.style.transform = 'none';
    } else if (this.mode === 'video' && first && first.data.poster) {
      this._layerBase.style.backgroundImage = 'url("' + first.data.poster + '")';
      this._layerBase.style.backgroundSize = 'cover';
      this._layerBase.style.backgroundPosition = 'center';
    }
    this._copyItems[0].style.opacity = '1';
    this._copyItems[0].style.transform = 'none';
    this._spacer.style.height = '200vh';
    this._hintEl.style.display = 'none';
  };

  /* public API ---------------------------------------------------------- */

  ScrollWorld.prototype.toggleCinematic = function () {
    this.cinematic = !this.cinematic;
    this._cineBtn.textContent = this.cinematic ? '\u23F8' : '\u25B6';
    this._cineBtn.setAttribute('aria-label',
      this.cinematic ? 'Pause cinematic auto-scroll' : 'Play cinematic auto-scroll');
  };

  ScrollWorld.prototype.play = function () { if (!this.cinematic) this.toggleCinematic(); };
  ScrollWorld.prototype.pause = function () { if (this.cinematic) this.toggleCinematic(); };

  ScrollWorld.prototype.setProgress = function (p) {
    p = clamp(p, 0, 1);
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, p * max);
  };

  ScrollWorld.prototype.scrollToSection = function (id) {
    for (var i = 0; i < this.entries.length; i++) {
      var e = this.entries[i];
      if (e.type === 'section' && e.data.id === id) {
        this.setProgress(e.start / this.total);
        return;
      }
    }
  };

  ScrollWorld.prototype._userInteracted = function () {
    if (this._autoScrolling) return;            // our own cinematic scrollTo
    if (this.cinematic) this.toggleCinematic(); // any user scroll exits autoplay
    if (this._hintShown !== false && (window.scrollY > 10)) this._hideHint();
  };

  ScrollWorld.prototype._hideHint = function () {
    this._hintShown = true;
    if (this._hintEl) this._hintEl.style.opacity = '0';
  };

  ScrollWorld.prototype._bindAudioStart = function () {
    var self = this;
    this._audioHandlers = [ 'pointerdown', 'wheel', 'touchstart', 'keydown' ];
    this._audioHandlers.forEach(function (ev) {
      window.addEventListener(ev, self._audioStart, { once: true, passive: true });
    });
  };

  ScrollWorld.prototype._unbindAudioStart = function () {
    if (!this._audioHandlers) return;
    for (var i = 0; i < this._audioHandlers.length; i++) {
      window.removeEventListener(this._audioHandlers[i], this._audioStart);
    }
  };

  ScrollWorld.prototype.destroy = function () {
    this.destroyed = true;
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('wheel', this._onScroll);
    window.removeEventListener('touchstart', this._onTouch);
    document.removeEventListener('keydown', this._onKey);
    this._unbindAudioStart();
    if (this._audio) { this._audio.pause(); this._audio = null; }
    for (var id in this._videos) {
      var v = this._videos[id];
      v.pause(); v.removeAttribute('src'); v.load();
    }
    this._videos = {};
    if (this.container) this.container.innerHTML = '';
    if (this._spacer && this._spacer.parentNode) {
      this._spacer.parentNode.removeChild(this._spacer);
    }
  };

  /* injected CSS --------------------------------------------------------- */

  ScrollWorld.prototype._injectCSS = function () {
    if (document.getElementById('sw-engine-css')) return;
    var css = [
      '.sw-stage{position:fixed;inset:0;overflow:hidden;z-index:50;',
      '  -webkit-font-smoothing:antialiased;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}',
      '.sw-stage *{box-sizing:border-box;}',
      '.sw-layer{position:absolute;inset:0;}',
      '.sw-still,.sw-video{position:absolute;inset:0;width:100%;height:100%;',
      '  background-size:cover;background-position:center;will-change:transform;opacity:0;}',
      '.sw-video{object-fit:cover;opacity:1;}',
      '.sw-canvas{position:absolute;inset:0;width:100%;height:100%;}',
      '.sw-vignette{position:absolute;inset:0;pointer-events:none;',
      '  background:radial-gradient(120% 120% at 50% 35%,transparent 55%,rgba(0,0,0,.42) 100%),',
      '  linear-gradient(to top,rgba(4,10,24,.62) 0%,transparent 26%);}',
      '.sw-copy{position:absolute;left:clamp(20px,5vw,72px);bottom:clamp(72px,10vh,110px);',
      '  max-width:min(520px,82vw);pointer-events:none;z-index:3;}',
      '.sw-copy-item{opacity:0;transition:opacity .7s ease,transform .7s ease;}',
      '.sw-eyebrow{font-size:11px;letter-spacing:.28em;text-transform:uppercase;',
      '  color:rgba(255,255,255,.78);margin:0 0 10px;font-weight:600;}',
      '.sw-title{font-size:clamp(26px,4.2vw,46px);line-height:1.08;margin:0 0 12px;color:#fff;',
      '  font-weight:800;letter-spacing:-.01em;text-shadow:0 2px 18px rgba(0,0,0,.45);}',
      '.sw-body{font-size:clamp(14px,1.6vw,17px);line-height:1.55;margin:0 0 14px;',
      '  color:rgba(255,255,255,.86);text-shadow:0 1px 10px rgba(0,0,0,.5);}',
      '.sw-tags{display:flex;gap:8px;flex-wrap:wrap;}',
      '.sw-tag{font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:5px 10px;',
      '  border:1px solid rgba(255,255,255,.28);border-radius:999px;color:rgba(255,255,255,.9);',
      '  background:rgba(8,14,32,.35);backdrop-filter:blur(4px);}',
      '.sw-hud{position:absolute;inset:0;pointer-events:none;z-index:4;}',
      '.sw-brand{position:absolute;top:clamp(18px,3vh,30px);left:clamp(20px,5vw,72px);',
      '  font-size:14px;font-weight:800;letter-spacing:.34em;color:#fff;',
      '  text-shadow:0 2px 14px rgba(0,0,0,.5);}',
      '.sw-brand img{height:34px;display:block;}',
      '.sw-topright{position:absolute;top:clamp(18px,3vh,30px);right:clamp(20px,5vw,72px);',
      '  text-align:right;color:rgba(255,255,255,.85);}',
      '.sw-label{font-size:12px;letter-spacing:.2em;text-transform:uppercase;',
      '  text-shadow:0 1px 8px rgba(0,0,0,.5);}',
      '.sw-timecode{font-size:11px;color:rgba(255,255,255,.55);margin-top:4px;',
      '  font-variant-numeric:tabular-nums;}',
      '.sw-hint{position:absolute;bottom:clamp(20px,3.5vh,34px);left:50%;transform:translateX(-50%);',
      '  display:flex;align-items:center;gap:8px;color:rgba(255,255,255,.85);',
      '  font-size:11px;letter-spacing:.3em;transition:opacity .8s ease;}',
      '.sw-hint svg{animation:sw-bob 1.6s ease-in-out infinite;}',
      '@keyframes sw-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}',
      '.sw-cine{position:absolute;bottom:clamp(20px,3.5vh,34px);right:clamp(20px,5vw,72px);',
      '  width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.35);',
      '  background:rgba(8,14,32,.45);color:#fff;font-size:15px;cursor:pointer;',
      '  pointer-events:auto;backdrop-filter:blur(6px);transition:background .2s;}',
      '.sw-cine:hover{background:rgba(255,255,255,.18);}',
      '.sw-progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.14);}',
      '.sw-progress-fill{height:100%;width:0;background:linear-gradient(90deg,#6FC7C0,#8DFCA1);',
      '  box-shadow:0 0 12px rgba(141,252,161,.6);}',
      '.sw-cta{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;',
      '  opacity:0;transition:opacity .9s ease;pointer-events:none;text-align:center;',
      '  background:radial-gradient(90% 90% at 50% 50%,rgba(4,10,24,.18),rgba(4,10,24,.72));}',
      '.sw-cta-inner{max-width:min(560px,86vw);padding:clamp(24px,5vh,48px);}',
      '.sw-cta-eyebrow{color:rgba(255,255,255,.75);}',
      '.sw-cta-title{font-size:clamp(28px,4.6vw,52px);font-weight:800;color:#fff;margin:0 0 14px;',
      '  letter-spacing:-.015em;text-shadow:0 2px 24px rgba(0,0,0,.5);}',
      '.sw-cta-sub{color:rgba(255,255,255,.8);font-size:clamp(14px,1.7vw,18px);margin:0 0 26px;}',
      '.sw-cta-btn{display:inline-block;padding:14px 34px;border-radius:999px;',
      '  background:linear-gradient(135deg,#FFB86B,#FF8F5E);color:#221303;font-weight:800;',
      '  font-size:15px;letter-spacing:.02em;text-decoration:none;pointer-events:auto;',
      '  box-shadow:0 10px 30px rgba(255,143,94,.35);transition:transform .2s,box-shadow .2s;}',
      '.sw-cta-btn:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(255,143,94,.45);}',
      '.sw-spacer{display:block;pointer-events:none;}',
      '@media (max-width:768px){',
      '  .sw-copy{bottom:clamp(84px,14vh,120px);}',
      '  .sw-hint{bottom:76px;}',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'sw-engine-css';
    style.textContent = css;
    document.head.appendChild(style);
  };

  return ScrollWorld;
});
