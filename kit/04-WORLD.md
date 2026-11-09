# 04 · World

The 3D scene: how it is set up, lit, built, placed, animated and kept fast. The reference prototype in `kit/reference/night-rig/` shows one case and one build made this way. Its `README.md` lists what it proves and where it is weak. Read both before starting Phase 2.

## Conventions

- **Units.** The catalog is in millimeters. The world is in meters. One constant, `MM = 0.001`, converts. Part generators author in millimeters inside a root group scaled by `MM`, as the reference does.
- **Axes.** +X is the front of the case, −X the rear. +Y is up. +Z is the left side of the case: the side the board faces and the main glass. The desk top is y = 0. The case stands on the desk, centered on x and z.
- **One owner.** A single `World` class under `src/world/` owns the renderer, scene, camera, post chain and animation loop. React never touches Three.js objects. The world reads the store and reacts to changes.
- **No downloaded assets.** No model files, no image textures, no HDRIs. All geometry is generated in code. All textures are drawn on a canvas at startup and cached. The only binary assets are the two font packages and the part thumbnails you render yourself.
- **Same build, same pixels.** Nothing in the world uses `Math.random()` or the wall clock to decide how something looks. Grain, brushing, weave, starlight and every other variation come from a seeded generator or a hash of a stable id, as the reference does. With the clock frozen, loading the same build twice draws the same frame. The verdict ledger depends on this: a shot that changes by itself loses its verdicts.

## The room

A dark studio desk: a wide matte desk under the rig with a faint mirror reflection of it, and a wall about 0.6 m behind that catches a soft pool of cool light and the rig's own glow. Beyond that, darkness and fog. No furniture and no props. Nothing competes with the rig.

- The wall is single sided and faces the front. When the camera orbits behind the rig the wall is not drawn, and the rig sits against darkness.
- **Night, not blackout.** From every angle the case silhouette separates from the background, black parts read as dark grey with visible edges and highlights, and the desk surface is visible. A frame where the rig melts into black fails.

## Renderer and post chain

This chain was built and debugged in the reference. Keep its structure.

- `WebGLRenderer`. Not `WebGPURenderer`: the post chain below does not run on it in the pinned version.
- Render into a half float target with 4x MSAA through `EffectComposer`. Renderer `antialias` off.
- Tone mapping: ACES filmic, applied by `OutputPass`. Starting exposure 1.15.
- Environment: `RoomEnvironment` through `PMREMGenerator` at low intensity (start at 0.5). You may replace it with your own softbox environment scene if reflections on glass and metal look better. Log what you chose.
- Shadows: `PCFShadowMap`, which is the soft one in this version. `PCFSoftShadowMap` is deprecated.
- Time: `Timer`. `Clock` is deprecated.

Pass order:

1. `RenderPass`
2. `GTAOPass` with `output = GTAOPass.OUTPUT.Off` and `needsSwap = false`. It only computes the ambient occlusion texture.
3. Your own `ShaderPass` that multiplies the frame by that texture. It clamps occlusion to 0..1, replaces non finite values with safe ones, and caps the frame's brightness at 6 before bloom.
4. `UnrealBloomPass` with a threshold well above 1 (start at 1.6, strength 0.33, radius 0.42), so only LEDs bloom.
5. `OutputPass`

Traps found at planning time. Each one cost a debugging round. Do not rediscover them.

- **GTAO plus bloom haze.** `GTAOPass` in its default output mode, followed or preceded by bloom, washed a white haze over a third of the frame from non finite values. The fix is steps 2 and 3 above. See `aoMix` in the reference `main.js`.
- **Lost texture uniform.** `ShaderPass` clones its uniforms and the clone drops render target textures. Assign the occlusion texture to the uniform after constructing the pass, or the frame goes black.
- **Glass in the occlusion pass.** Hide the glass and the desk mirror while `GTAOPass` renders its depth and normals, or the glass occludes everything behind it.
- **Point lights make flares.** Point lights standing in for LED glow put pinpoint speculars on every glossy part, and bloom turned them into flares. Use `RectAreaLight` for LED glow and for softboxes. Call `RectAreaLightUniformsLib.init()` once.
- **Area lights on the desk and wall.** Their broad specular reflection on the desk and wall read as haze. The desk and wall use `MeshPhysicalMaterial` with `specularIntensity: 0` and `roughness: 1`. The desk gets its gloss from the mirror under it.
- **Mirror hot pixels.** The planar mirror renders in HDR. Clamp its output in its shader and hide the glass specular layer during its render, or bloom picks up sparkles in the reflection.
- **Hard wall shadow.** A strong shadow casting key light throws a hard rectangle of the case onto the wall. Keep the shadow caster weak with a wide blur and let softboxes do the lighting.

## Lighting

- **Softboxes.** Two or three large `RectAreaLight`s: a warm key from front, right and above, a cool top fill, and whatever else the case needs to read. They give broad, soft highlights on metal and glass.
- **Shadow key.** One weak `SpotLight` that casts shadows, aligned with the key softbox. Shadow map size by quality tier. Update the shadow only when something moved.
- **Backdrop.** A cool spot or area light that puts a soft pool on the wall behind the rig, so the dark case has something to stand against.
- **LED lamps.** See the RGB engine below.
- Start from the positions and intensities in the reference `main.js` and tune per case with screenshots.

## Materials

One module defines every material by name. Parts ask for materials by name and never construct their own. Use physically plausible values: metals have `metalness` 1, plastics 0, nothing in between except deliberately layered finishes.

The library must cover at least: powder coated steel (black, white, gunmetal), bare steel, anodized aluminum (black, silver, white), bead blasted raw aluminum, brushed aluminum with anisotropy, nickel plating, copper, gold contacts, matte plastic, soft touch plastic, gloss plastic with clearcoat, rubber, circuit board (black and white) with a trace texture and clearcoat, tempered glass, frosted LED diffuser, smoked translucent fan blade, white frosted fan blade, braided sleeve in any color, heatsink fin metal, radiator core, printed label, sticker.

Rules:

- **No uniform surfaces.** Every material has variation you can see up close: a roughness map, a fine bump, brushing, orange peel in powder coat, weave in sleeving. A perfectly even surface reads as computer graphics.
- **Glass is two meshes.** A tint layer with normal blending and low opacity, and a specular layer that is black, very smooth and additively blended, so reflections add light as they do in life. Glass has a painted border and real thickness at its edges.
- **Textures** are canvas drawn, cached, mipmapped, with anisotropic filtering at the renderer's maximum. Resolution follows the quality tier.
- **Printed text and labels** are canvas textures on decal planes or baked into a part's texture. Wait for fonts with `document.fonts.load` before drawing any. Text must stay sharp at the closest zoom the camera allows.
- **Finishes** (onyx, frost, gunmetal, raw, graphite) are sets of material assignments, defined once.

## Geometry toolkit

One module of helpers that every generator uses: rounded boxes; profiles extruded with bevels and holes, in any of the three planes; lathed shapes; tubes along curves; instanced arrays for fins, screws, vents and LEDs; fan blade surfaces; perforated panels; decals. The reference `parts.js` has working versions of most.

Rules:

- **No razor edges.** Every visible edge has a bevel or radius of at least 0.3 mm so it catches a highlight.
- **Real thickness.** Sheet metal, glass, circuit boards and plastic shells have thickness that shows at their edges and cutouts.
- **Fine perforation** uses an alpha tested texture with alpha to coverage. Coarse openings (hex mesh, vent slots, fan grilles) are real holes in the geometry.
- **Fasteners are modeled**, with a head shape and a drive recess, and instanced.
- Segment counts and instance density follow the quality tier.
- Merge static meshes that share a material within a part to keep draw calls down.

## Part generators

Each category has a generator that takes a catalog id and returns a `PartObject`. Generators are parametric: one fan generator makes five styles in two sizes, one graphics generator per brand makes that brand's cards from parameters. Where a family shares a design, do not copy a file per part.

```ts
type PartObject = {
  root: THREE.Group;                     // origin at the part's anchor point, authored in mm
  boxes: Box[];                          // collision boxes in mm in root space, for the layout tests
  anchors: Record<string, Anchor>;       // where other parts attach: position and orientation in root space
  zones: Zone[];                         // LED zones this part owns
  rotors: Rotor[];                       // spinning sub-objects with their axis
  movers: Record<string, THREE.Object3D>;// sub-objects that move in choreography: latches, plates, frames, clips
  dispose(): void;
};
```

Anchor points, by category:

| Category | Root origin |
| --- | --- |
| Case | Center of its footprint on the desk |
| Board | Its top rear corner on the back face. All three sizes share this corner, which is what keeps the rear connector block and the expansion slots aligned across sizes |
| Processor | Center of the package, on its underside |
| Cooler | Center of the contact plate. A liquid cooler's radiator assembly is a second object with its origin at the center of its mount face |
| Memory stick | Center of the bottom edge |
| Graphics card | The bracket end of its edge connector |
| NVMe drive | The connector end |
| 2.5 and 3.5 inch drives | Center of the underside |
| Supply | Center of the underside |
| Fan | Center of the fan. Local +Z is the side air leaves from, the side with the struts |

A generator must be callable for the Inspector with nothing else in the scene, and the result must look complete from every side.

## Layout

Where things go is data, separate from how they look.

- Each case module exports a **layout**: plain data with no Three.js. It gives the board anchor, the supply bay, every 2.5 and 3.5 inch bay, every fan mount (position, facing, size), every radiator mount, the glass panels, the interior volume, and the cable waypoints (grommets and channels with a direction).
- Each board, by size, has a layout for its socket, memory slots, expansion slots, M.2 slots and power connectors.
- A pure function, `place(build)`, returns every installed part's position, orientation and collision boxes in case space. It lives under `src/engine/` or `src/world/layout/` and imports no Three.js, so unit tests can run it.
- The world renders exactly what `place` returns. Nothing is positioned by hand in a generator.

**The catalog's limits must be true in the model.** `kit/09-QA-GAUNTLET.md` tests these on the pure layout:

1. No two collision boxes of different parts intersect by more than 0.5 mm in any valid build that the test generates, except pairs you declare as contact pairs (a card in its slot, a stick in its slot, a fan on its mount).
2. In every case, a graphics card as long as the graphics clearance fits, with fans on every free mount and with a radiator on each mount in turn.
3. The modeled free length for a graphics card, from the bracket to the nearest obstacle with a fan on every mount, is between `gpuMaxLength + 2` and `gpuMaxLength + 30`. With a radiator on a mount that has a `gpuPenalty`, the free length is between `gpuMaxLength − gpuPenalty + 2` and `gpuMaxLength − gpuPenalty + 30`. With a radiator on a mount whose `gpuPenalty` is 0, the first range still holds.
4. The modeled free height over the processor, from its top to the inside of the glass or panel, is between `coolerMaxHeight + 1` and `coolerMaxHeight + 15`.
5. The supply bay's modeled length is between `psuMaxLength + 2` and `psuMaxLength + 40`.
6. A cooler with a `ramClearance` leaves that much height over the memory slots within 3 mm, so a taller kit really would touch it.
7. In every case the inside of the glass, or of the side panel, stands at least 34 mm beyond the outer edge of the tallest graphics card that passes `check` in that case. That is the room its power cables need to leave straight and bend. Item 4 leaves a range for the glass. Use the part of the range that satisfies this too. It was checked on paper for all six cases.

So a blocked part is one that truly would not fit, by a visible margin or a near miss. Case outer sizes in the catalog (`size`) are targets. You may adjust a case's interior arrangement freely to satisfy these, and its outer size by up to 15 mm. Log any change. Do not change the limits themselves.

The Vitrine in the reference satisfies items 3 and 4 with the catalog values. Check the others when you build its layout.

## The RGB engine

Light in this app is simulated per LED. That is what makes it look real.

- A **zone** is an ordered strip or ring of LEDs on a part. LED spacing is 6 to 8 mm along strips. Rings on 120 mm fans have 16 to 20 LEDs.
- Each frame the engine computes a color for every LED and writes it into that zone's small data texture. The zone's diffuser mesh samples the texture along its length (clamped for strips, wrapped for rings) with linear filtering. Neighboring LEDs blend, which reads as a diffuser.
- Diffusers are emissive above 1 in the HDR frame so they bloom. Big diffusers (memory bars, card bars) run lower than thin rings so their color stays saturated. Start from the intensities in the reference.
- The color math is a pure function in `src/engine/lighting.ts` with unit tests. Inputs: time, the LED's position along its zone (`u`), its position in the rig normalized along the flow axis (`pn`), the zone index and phase, a per LED hash, and the profile.

Effects. `τ` is time in seconds times `speed / 100`. `direction` flips the sign of the time term in wave and comet. Constants match the reference `rgb.js`, which is the worked example for all of this.

- `gradient(x)` reads the profile's stops as a repeating smooth gradient: with n stops, take `f = fract(x) × n`, and blend stop `floor(f)` into the next stop (wrapping to the first) with a smoothstep of the remainder.
- `pn` for an LED at world position x, y in meters is `(x − xmin) / (xmax − xmin) + 0.6 × y`, where xmin and xmax are the rig's bounds along x. Light flows front to rear and climbs.
- `u` runs 0 to 1 along a strip, and 0 up to but not including 1 around a ring.
- `phase` is a fixed number per zone, set where the zone is declared, so zones do not all move in step.
- `hash` is a fixed pseudo random number from 0 to 1 per LED, computed from the zone index and the LED index.

| Effect | Color of one LED |
| --- | --- |
| `static` | `gradient(pn × 0.66)`. No motion. |
| `breathing` | The static color times `0.12 + 0.88 × (0.5 + 0.5 × sin(2.4τ))` |
| `spectrum` | Every LED the same: full saturation hue `fract(0.12τ)` |
| `wave` | `gradient(pn × 0.8 − 0.35τ)` |
| `shift` | Every LED the same: `gradient(0.1τ)`, a slow crossfade through the stops |
| `comet` | `gradient(phase + 0.05τ)` times `exp(−7d) + 0.04`, where the head is at `fract(0.6τ + phase)` along the zone and `d = fract(head − u)` is how far this LED trails it |
| `starlight` | `gradient(hash)` times `0.08 + max(0, sin(2.2τ + 2π × hash))^14` |
| `thermal` | From the simulated temperatures, as defined in `kit/03-RULES.md` |

Every result is multiplied by `brightness / 100` and by the power level.

- **Sync.** `pn` is measured across the whole rig, so a synced wave travels through the parts as one. Each zone belongs to a light target (`case`, `board`, `cooler`, `ram`, `gpu`, `fans`). Its profile is that target's override, or the main profile. An override of `off` is black.
- **Light cast.** Group nearby zones into a small number of `RectAreaLight`s (the count follows the quality tier). Each lamp sits where its zones are, faces where their light goes, takes the average color of its zones, and scales with their brightness. One lamp washes the wall behind the rig with the build's average color. Lit fan blades take a tint of their zone's average.
- **Fans at speed.** Above a threshold speed, crossfade a rotor's blades to a motion blurred disc so fast fans look like translucent discs with a soft ring of light, not strobing blades.

## Cables

Cables are the part most likely to look fake. Give them the time.

- **Runs.** The 24 pin board cable (24 wires, 2 × 12). The processor power cable (8 wires, 2 × 4). Graphics power per the card's `plugs`: `12V-2x6` is 12 wires in 2 × 6, each 8 pin plug is 8 wires in 2 × 4. Each SATA drive that is visible gets a thin black power lead and a thin data lead. Each fan gets a thin black lead to the nearest grommet.
- **Path.** Each run goes from the supply's socket panel, or from the grommet where it emerges when the supply is hidden, through the waypoints in the case layout, to the connector on the part. Build a smooth centerline that leaves each connector straight along its axis for at least 12 mm and never bends tighter than an 18 mm radius.
- **Wires.** Each wire is its own tube, offset from the centerline in a frame carried along the curve without twist. Sleeves show a braided weave up close. Combs sit every 45 to 60 mm on visible spans and where the run turns.
- **Connectors** are modeled: a housing with pin cavities and a latch clip, seated in the part's socket.
- **No intersections.** A cable never passes through a part, a panel, the glass or another cable. Each case needs its own waypoints for each board size and each graphics card length class. Graphics power plugs sit on the card's edge that faces the glass, so leave room there for the straight exit and the bend. Cable shots are required for every case.
- **Colorway.** The sleeved runs take the build's colorway. Changing it sweeps the new color along the wires.
- A run exists only when both of its ends exist.

## Camera

- Perspective, 30 degree vertical field of view.
- Orbit with damping, zoom toward the cursor or pinch center, pan limited to the rig's bounds. One finger orbits, two fingers pinch and pan. The polar angle stops just above the desk.
- **Zoom range.** In Build and Showcase the camera comes as close as 0.2 m to its target. Focused on a part or in the Inspector it comes as close as 0.12 m. These caps are where detail still holds. If a part looks soft at its cap, improve the part, do not move the cap out.
- **Focus.** Double tap or double click a part to glide to a close view of it. Escape or the reset control returns.
- **Named views** per case: hero three quarter, side, front, top, rear, and a macro view for each installed category. They are computed from the case bounds and the part positions. The reference has a working set for the Vitrine.
- **Framing.** The rig is centered in the area the interface leaves clear, not in the window. Shift the projection with a view offset, as the reference does, and update it when panels open or the layout changes.
- Camera moves between views are GSAP tweens of position and target, 1.2 to 1.8 seconds, `power3.inOut`.
- **Showcase tour.** A loop of slow moves: a wide arc, a push toward the card, a rise past the cooler, a pass along the fans. Six to eight seconds each. Any input takes control. The tour resumes after eight seconds without input.

## Modes in the scene

- **Glass.** The glass panels are drawn when `build.glass` is true, in every mode. That value is the user's choice, set by the Glass toggle and saved with the build. No mode changes it. The scene overrides it in one situation only: while a part is held, or while a part is traveling in or out of the case, the glass lifts away so the path is clear, and it returns when the motion ends. In the Exploded view the glass is one of the parts that moves out.
- **Build.** Bench lighting, slightly brighter. Sockets appear for a held part.
- **Showcase.** The interface recedes, softboxes drop, the rig's own light carries the frame. Entering Showcase turns the power on when `canPowerOn` is true. Leaving it keeps the power as it is.
- **Exploded.** Each part moves out along its insertion axis by a distance that leaves clear gaps in the current view. Cables and tubes fade out. Each part gets a label with a thin leader line. The same control puts it back.
- **Inspector.** The chosen part alone on a slow turntable over a dark gradient, lit by neutral softboxes, with its lighting running if it has any. This view also produces the tray thumbnails.
- **Airflow.** Streams of short dashes flow from each intake fan through the chamber and out through each exhaust, along paths from the case layout. Color runs from cool to warm using the simulated temperatures. Density follows the quality tier.

## Sockets, picking and dragging

- **Picking.** Raycast against simple proxies of the installed parts. Hover and selection show as a clean outline, not a color change of the part.
- **Holding a part.** While dragging from the tray, a real model of the part follows the pointer on a plane in front of the case, slightly lifted in exposure. On touch, a long press of 250 ms on a card starts the drag so the card row can still scroll. With a mouse the drag starts after 6 px of movement.
- **Sockets.** For the held or tapped part, every candidate place shows a socket: the outline of the part's bounds at that place with animated dashes and a faint fill. Valid sockets use the accent color (`--accent`). Socket colors come from the design tokens in `kit/05-DESIGN.md`, read once into the world. The nearest valid socket brightens and the held part snaps to a preview pose there. Blocked sockets use the blocked color (`--danger`) and show the reason next to the pointer.
- **Drop.** On a valid socket the install choreography runs from the preview pose. Anywhere else the part returns to the tray. On a blocked socket the part gives a small shake first.
- **Removing by drag.** Dragging an installed part out past the case bounds removes it.

## Choreography

Every build action has motion with weight. Use GSAP timelines. The pattern:

1. **Travel** to a pose 30 to 40 mm short of home along the insertion axis. 0.5 to 0.7 s, `power3.inOut`, on a gentle arc.
2. **Seat** along the insertion axis. 0.25 to 0.4 s, with a small overshoot or a firm stop that fits the part.
3. **Secure.** The part's own fastening plays.
4. **Consequence.** Cables grow from the supply end, lights wake if powered, the spec sheet numbers count to their new values.

| Category | Seat and secure |
| --- | --- |
| Case | Lowers onto the desk with a soft settle, its glass with it when `build.glass` is true. |
| Board | Tilts in over the standoffs and lies flat. Its screws spin down one after another. |
| Processor | The retention frame opens, the processor lowers into the socket, the frame closes and its lever latches. |
| Air cooler | Lowers over the processor. Mounting screws turn. Fan clips snap on. |
| Liquid cooler | The pump head seats and its screws turn. The radiator and fans slide onto their mount. The tubes flex into their final curve as it moves. |
| Memory | Each stick presses into its slot and both latches snap shut. Sticks follow each other 80 ms apart. |
| Graphics card | Slides into the slot, the slot latch clicks, the bracket screws turn. The `crest` brings its support: a post rises under its far end, or in the Gantry a short arm swings out from the backplate. Then the power cables grow. |
| NVMe | The board's heatsink plate lifts and waits. The stick goes in at an angle, presses flat, a screw turns, the plate returns. |
| 2.5 and 3.5 inch drives | Slide into the bay on a tray or sled. |
| Supply | Slides into its bay. Then its cables grow to every part that needs one. |
| Fan | Drops onto its mount, four screws turn, and it spins up if the build is powered. |
| Cables colorway | The new color sweeps along every sleeved wire. |

- Remove is the reverse at about 70 percent of the duration. Swap overlaps the old part leaving and the new one arriving.
- A cascade removes parts in dependency order with a short stagger.
- Starting a new action finishes the running one instantly. Motion never blocks input.
- **Power on.** The supply's switch light comes on. Fans ramp up over about 1.5 s. Lighting wakes zone by zone along the power path: supply, board, cooler, memory, card, fans. Exposure lifts slightly. **Power off.** Light falls away and fans coast down over about 3 s.
- **Reduced motion.** Every transition becomes a 150 ms crossfade with no travel, the intro is a still, the tour does not run, and fans and lighting effects still animate because they are the content.

## Quality tiers

| Setting | High | Medium | Low |
| --- | --- | --- | --- |
| Pixel ratio cap | 2 | 1.5 | 1.25 |
| MSAA samples | 4 | 2 | 0, with a cheap edge pass |
| Ambient occlusion | Full | Half resolution | Off |
| Bloom | Full | Full | Half resolution |
| Desk mirror | 1024 | 512 | Off, with a soft dark gradient under the rig |
| Shadow map | 2048 | 1024 | 1024, updated only on change |
| LED lamps | 8 | 5 | 3 |
| Texture size scale | 1 | 0.75 | 0.5 |
| Geometry detail | Full | Full | Reduced segments and fin counts |
| Airflow dashes | Many | Fewer | Few |

- `auto` picks a tier from a short frame time probe after the first build is shown, and steps down once if the median frame time stays over 24 ms. It never changes tier while the user is interacting.
- The user can force a tier in Settings.
- Low must still look good. It is the phone experience.

## Performance rules

- Render only when something changed or is animating. With the power off and nothing moving, the loop idles.
- Pause when the tab is hidden.
- Cache generated parts by id and tier. Dispose geometry, materials and textures you no longer hold.
- Update the shadow map only when geometry moved.
- Budgets for the Night Rig preset on High, as targets: under 400 draw calls and under 2 million triangles. On Low: under 220 draw calls and under 700 thousand triangles. Log the measured numbers.
- The frame rate target and how it is measured are in `kit/09-QA-GAUNTLET.md`.
