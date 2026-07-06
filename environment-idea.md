# B3 Tree — Environment Build Instructions

## Context
The 3D tree model itself is done (imported as a GLB, replacing the earlier basic
Three.js tree). The scene currently has no real environment — flat background, no
ground detail, no dedicated lighting design. This file describes what environment
work should be done next, in priority order. Stack: Vite + React + React Three
Fiber (R3F), with `@react-three/drei` available for helper components.

Existing data-driven signals already wired into the tree (reuse these for
environment elements — do not invent new signals):
- **Weather state**: Sunny / Cloudy / Rainy / Storm (derived from weekly % change)
- **Wind intensity**: tied to weather state (soft breeze on sunny → heavy gusts on storm)
- **Leaf color**: daily % change (unrelated to environment, tree-only)
- **Leaf density**: 52-week range position (unrelated to environment, tree-only)

Goal: build atmosphere around the tree without turning this into a full scene/forest
project. Prioritize lighting and sky first — they give the most visual improvement
for the least effort. Treat later tiers as optional polish, not requirements.

---

## Tier 1 — Do these first (highest impact, lowest effort)

**1. Ground plane with real material**
- Replace flat-color ground with a tileable grass/soil texture (CC0 sources like
  Poly Haven work well)
- Add subtle roughness/normal map variation so it's not perfectly flat-looking
- Ensure the ground receives shadows from the tree

**2. Lighting overhaul, tied to weather state**
- Set up one ambient light (soft fill) + one directional light (acts as the "sun")
- Enable shadows: tree casts shadow, ground receives shadow
- Vary the directional light's color/intensity per weather state:
  - Sunny: warm, bright, strong shadow contrast
  - Cloudy: flat, cool-grey, soft/minimal shadow
  - Rainy: dim, blue-grey tint, soft shadow
  - Storm: near-dark ambient, with occasional bright white flash (lightning) for
    a single frame/short duration

**3. Sky**
- Replace flat/plain background with a proper sky
- Check if `@react-three/drei`'s built-in `<Sky>` component covers this before
  building anything custom — it handles sun position and atmosphere automatically
- Sky tone should shift with weather state (bright blue sunny → grey overcast →
  darker stormy)

---

## Tier 2 — Do these after Tier 1 (moderate effort, strong atmosphere boost)

**4. Instanced grass around the tree base**
- Scatter a moderate number (a few hundred) of simple grass blade shapes around
  the base of the tree using instanced rendering (cheap on performance)
- Check if `@react-three/drei` has a helper for instancing before hand-rolling it

**5. Wind-reactive grass**
- Apply the same wind-intensity value that already drives the tree's sway to the
  grass instances too, so grass moves in sync with the tree
- Reuse the existing wind value — do not create a second/independent wind
  calculation for grass

---

## Known issue to fix first — grass rendering as solid squares
Grass instances are currently rendering as flat opaque squares instead of blade
shapes, and some are appearing at incorrect heights (floating in the sky area,
not just near the ground). Before continuing further environment work, check:
- Whether the grass blade texture is actually loading (no failed path/404)
- Whether the material has `transparent: true` and an `alphaTest` cutoff set —
  without this, the transparent parts of a blade texture render as solid
- Whether instance Y-positions are being clamped/snapped to the ground plane's
  height — instances should not be placed at arbitrary Y values
- Whether this is actually a mixup between the grass instancing system and a
  separate rain/storm particle system (they may be sharing logic incorrectly)

---

## Fog — add next, tied to weather state
Add scene fog (Three.js's built-in fog, not a custom shader) with color and
density tied to the existing weather state:
- Sunny: no fog, or a very faint warm-toned haze at far distance only
- Cloudy: thin grey fog
- Rainy: moderate blue-grey fog, closer near-distance falloff
- Storm: dense dark fog — this should also help visually mask/soften the sky
  horizon line if that still looks like a hard edge

Fog should transition smoothly between states along with the other weather
changes, not snap instantly.

---

## Post-processing — cinematic pass
Use a post-processing library (not custom shaders written from scratch) to add
a small stack of effects on top of the rendered scene:
- **Bloom** — makes bright highlights (lightning flashes, direct sunlight glints)
  glow instead of just clipping to bright pixels
- **Vignette** — subtly darkens frame edges, pulls focus toward the tree
- **Tone mapping** — use a filmic tone mapping curve for richer, less flat color
  response than the default renderer output
- **Film grain / subtle noise** — very light, sells a "shot on camera" feel
  rather than a raw render look

Do not add depth-of-field or chromatic aberration — not needed for a single-
focal-object scene and easy to overdo. Keep the post-processing stack minimal:
these four effects only, at subtle default-leaning strengths, not stylized/heavy
settings.

---

## Tier 3 — Optional, weather-specific polish (nice-to-have, not required)

**6. Rain/storm particles**
- Add a simple particle effect (falling rain lines/drops) that only appears
  during Rainy and Storm weather states
- Check if drei's `<Sparkles>` component (or similar) can be repurposed before
  building a custom particle shader

**7. Clouds**
- Add a small number of soft cloud shapes drifting slowly in the sky, mainly
  visible during Cloudy/Rainy/Storm states
- Check if `@react-three/drei` has a `<Cloud>` component before building custom
  geometry/shaders for this

---

## Explicitly out of scope — do not build these
- No rocks, flowers, or background forest of extra trees — this is a single
  focal-tree scene, not an explorable environment
- No custom noise-based procedural ground shader — a good tileable texture is
  sufficient and far less effort
- No new data signals invented for environment elements — every environment
  behavior (lighting, wind, particles) must map back to the existing weather/wind
  values already computed for the tree, not a separate calculation

---

## Suggested build order
1. Lighting + shadows (biggest single visual jump)
2. Sky component
3. Ground texture
4. Instanced grass (static first)
5. Wind applied to grass (reuse existing wind value)
6. Rain/storm particles (weather-gated)
7. Clouds (weather-gated)

Stop after Tier 2 unless Tier 3 additions are specifically wanted — the goal is an
atmospheric backdrop for the tree, not a fully built-out scene.