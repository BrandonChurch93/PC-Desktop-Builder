# 05 · Design

The interface direction is called Night Rig. Brandon picked it from three options. Its idea: the scene comes first. A dark room lit by the PC's own light, with the interface floating over the edges as glass panels and the center left clear. `kit/reference/night-rig/shots/ui-desktop.jpg` shows the direction as built in the reference prototype. Match its character and finish every part of it properly.

## Tokens

Define these once in `src/styles/tokens.css` as CSS custom properties. Components use the properties and never a raw value.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0d0b1a` | Page background behind the canvas |
| `--ink` | `#efeafc` | Primary text |
| `--ink-dim` | `#c9c3e2` | Secondary text, inactive controls |
| `--ink-muted` | `#a59fc0` | Labels, meta, eyebrows |
| `--line` | `rgba(190, 170, 255, 0.18)` | Panel and card borders |
| `--line-strong` | `rgba(190, 170, 255, 0.32)` | Ghost button borders, dividers that must read |
| `--panel` | `rgba(18, 15, 36, 0.66)` | Glass panel fill, over a backdrop blur |
| `--panel-solid` | `#14112a` | Dialogs, sheets, and panels where backdrop blur is unsupported |
| `--raise` | `rgba(255, 255, 255, 0.05)` | Card fill, hover fills |
| `--accent` | `#18e0ff` | The one interactive accent: focus, selection, valid sockets, primary action |
| `--accent-ink` | `#06202a` | Text on an accent fill |
| `--magenta` | `#ff2bd1` | First stop of the signature gradient |
| `--violet` | `#7b3dff` | Second stop of the signature gradient |
| `--ok` | `#8ff0c0` | Fits, no warnings |
| `--warn` | `#ffc46b` | Warnings, low headroom |
| `--danger` | `#ff8fa3` | Blocked, not enough power |
| `--radius-panel` | `16px` | |
| `--radius-card` | `12px` | |
| `--radius-control` | `10px` | |
| `--blur` | `blur(18px) saturate(1.3)` | Backdrop filter on glass panels |
| `--font-display` | `'Unbounded Variable', 'DM Sans Variable', system-ui, sans-serif` | Brand, stat numerals, dialog titles |
| `--font-body` | `'DM Sans Variable', system-ui, sans-serif` | Everything else |

- The signature gradient, magenta to violet, marks one thing at a time: the active lighting effect. Do not spread it around.
- There is no pure black and no pure white in the interface. Semantic colors are separate from the accent.
- `--rig-glow` is one more property, set from the scene: the build's average LED color, updated at most ten times a second. Use it only for a one pixel highlight along the top edge of panels and a soft halo on the Power control when the build is on. It ties the interface to the rig without recoloring it.
- Every text and background pair meets 4.5 to 1 contrast, including 11 px labels.

## Type

| Role | Family | Size | Weight | Notes |
| --- | --- | --- | --- | --- |
| Eyebrow | Body | 11 | 500 | Uppercase, letter spacing 0.16em, `--ink-muted` |
| Meta | Body | 12 | 400 | |
| Control | Body | 13 | 500, 700 when active | |
| Body, card title | Body | 14 | 400, 700 for titles | |
| Brand | Display | 16 | 600 | |
| Dialog title | Display | 20 | 600 | |
| Stat numeral | Display | 26 | 600 | Tabular figures |
| Intro title | Display | 44 | 600 | Letter spacing −0.01em |

Sizes are in CSS pixels and do not shrink on phones. Numbers that change use tabular figures so they do not jitter.

## Layout

The rig owns the center. Panels sit at the edges. At 1440 × 900 the area with no interface over it is at least 880 × 520.

Pick the layout from the viewport in this order:

1. **Phone** when the shorter side is under 500 px. So 390 × 844 is a phone in portrait and 844 × 390 is a phone in landscape.
2. **Desktop** when the width is 1200 px or more.
3. **Tablet** otherwise.

**Desktop**

- Top left: the brand block. The product name, and under it the build name with the current mode as an eyebrow. The build name is editable in place.
- Top center: undo and redo, then the quick toggles Glass, Power and Airflow. The Glass toggle sets `build.glass`. The load readout appears under them while the power is on.
- Top right: the mode switch (Build, Showcase, Exploded), the Share button, and a menu with Saved builds, Export poster, Settings and About.
- Left: the Lighting panel.
- Right: the Spec panel.
- Bottom: the tray as a dock. Category tabs in a row, a one line hint at the right, and the part cards in a horizontally scrolling row.
- Panels are inset 40 px from the window edges.

**Tablet**

- Insets are 20 px.
- The Lighting and Spec panels collapse to two round buttons at the left and right edges. Each opens its panel as a side sheet. Only one is open at a time.
- The dock stays. Cards are narrower.

**Phone**

- Top: a compact brand line and the menu button. Under it the mode switch at full width, then the quick toggles as icons.
- Bottom: a sheet with three stops. Peek shows the category tabs and one row of cards. Half adds a second tab row: Parts, Specs, Lighting. Full is 90 percent of the height for long lists.
- The scene is framed in the space above the sheet at its current stop.
- In landscape the sheet becomes a panel on the right, 320 px wide.

In every layout the camera's view offset follows the open panels so the rig stays centered in the clear area.

## Components

Build each as a React component with a CSS Module. Each has default, hover, focus visible, active, disabled and, where it applies, selected states. Minimum touch target is 44 px.

| Component | Notes |
| --- | --- |
| Button | Primary (accent fill), ghost (border), quiet (text only), icon. |
| Chip toggle | Pill with on and off states. Used for Glass, Power, Airflow, Synced. |
| Segmented control | The mode switch. |
| Tabs | The categories. The active tab has an accent underline. Each tab shows a small count or dot when its category has something installed. |
| Part card | Thumbnail, brand and name, one line of key numbers, one status line. States: fits, installed, blocked with the reason, fits with a warning preview, being dragged. The thumbnail is its own button and opens the Inspector. Activating the card of the installed case, board, processor, cooler, card or supply removes that part. Memory, storage and fan cards always add one more, and their parts are removed with the stepper, the selection menu or the spec sheet. |
| Stat | Eyebrow, large numeral, one line of detail. The numeral counts to a new value when it changes. |
| Meter | Thin bar for power load. Its fill turns `--warn` past the headroom ratio and `--danger` past capacity. |
| Slider | For speed, brightness and load. Shows its value. |
| Effect list | The eight effects. The active one carries the signature gradient. |
| Gradient editor | A bar showing the stops with draggable handles, add and remove, between the minimum and maximum stop counts. Selecting a stop opens the color picker. |
| Color picker | Built in the app, not the browser's native picker: a hue strip, a saturation and value square, a hex field and a row of recent colors. |
| Target list | Case, Board, Cooler, Memory, Graphics, Fans. Each shows whether it follows the main profile, has its own, or is off. Targets with no lit part in the build are disabled. |
| Selection menu | Small popover anchored to the selected part: Inspect, Remove, Swap, Lighting. |
| Notice | Bottom center. Used for cascade removals (with Undo), link problems and confirmations. Stays until dismissed when it has an action, 5 seconds otherwise. |
| Reason label | Follows the pointer during a drag over a blocked socket. One sentence. |
| Dialog | Centered, focus trapped, closes on Escape and on the backdrop. Used for the full spec sheet, Share, Export poster, Saved builds, Settings, About. |
| Bottom sheet | Phone only. Drag handle, three stops, momentum. |
| Start overlay | After the intro. Two buttons and the six preset cards. |
| Scene labels | DOM labels positioned from the scene: socket labels and exploded view labels. |
| Load readout | A compact strip shown whenever the power is on, in any mode: the Load slider, then the simulated temperatures. In Build mode it sits under the quick toggles. In Showcase it sits at the bottom center. |
| Tooltip | For icon buttons and for the disabled Power control's reason. |

Icons are simple inline stroke SVGs drawn for this app, one weight, 20 px. No emoji. No icon font.

## The panels

**Lighting panel.** Eyebrow "Lighting" and the Synced chip. The effect list. The gradient editor. Speed, Brightness and a Direction toggle. A Presets row (the nine catalog presets, then saved profiles, then "Save profile"). The target list. Controls an effect does not use are hidden for that effect, using `usesStops` and `usesSpeed` from the catalog.

**Spec panel.** Eyebrow "Spec sheet" and a status at the right: "No warnings" in `--ok`, or the count of warnings in `--warn` or `--danger`. Four stats: Memory (total, slots used of available), Storage (total, slots and bays used), Power (draw, "of {capacity} W · {percent} percent", the meter), Graphics (card length, "of {max} mm clearance"). With nothing installed a stat shows a dash and what it is waiting for. Then "Open full sheet".

**Full spec sheet.** Sections in this order: Parts by slot, including the cooler's mount, each memory kit's slots, each drive's slot or bay and each fan by mount. Capacity: memory slots, M.2 slots, 2.5 inch mounts, 3.5 inch bays, SATA ports, each as used of available. Power: draw, supply, load, recommended supply. Cooling: cooler rating against processor draw, intake and exhaust counts, the pressure word, simulated temperatures at full load. Clearances: card length against the free length, cooler height against the limit, memory height against the cooler's clearance when it has one. Warnings. Every installed part has a Remove button here, which makes this the complete non visual path. Actions: "Copy as text" and "Export poster".

**Tray.** Categories in this order with these labels: Case, Board, Processor, Cooler, Memory, Graphics, Storage, Power, Fans, Cables. Cases show a finish switch on the installed case's card. Storage cards show a count stepper. Fans show the style cards plus "Fill empty mounts" and "Clear fans". Cables show six swatch cards. The hint line reads "Drag into the case, or tap a card and then the slot".

## Screens and states

Design and build each of these. Each is in the shot list.

1. Intro, and the start overlay
2. Empty bench: the desk, a dashed footprint where a case goes, the Case tab open, and a line reading "Pick a case to begin"
3. Build mode with a build in progress
4. A drag in progress with sockets, one valid and near, one blocked with its reason label
5. An installed part selected, with the selection menu
6. A cascade notice with Undo
7. The Inspector
8. The full spec sheet with warnings present
9. The lighting panel with a per target override and the color picker open
10. Power on in Build mode with the load readout, and Showcase with the load readout at full load
11. Airflow view
12. Exploded view with labels
13. Share, Export poster, Saved builds, Settings and About dialogs
14. A shared link landing: Showcase, with a banner reading "Shared build · {name}" and a "Make it yours" button
15. Every one of the above that applies, on tablet and on phone

## Motion

Interface motion is quiet. The scene has the drama.

- Durations: 120 ms for presses, 220 ms for controls, 360 ms for panels and sheets, 500 ms for a mode change.
- Enter with `power2.out`, leave with `power2.in`. No bounce on interface elements.
- On a mode change the panels that do not belong fade and move 12 px toward their edge.
- Numbers count to their new value over 400 ms.
- With reduced motion, all of this becomes opacity only at 120 ms.

## Fixed copy

Use these strings as written. Rule messages are in `kit/03-RULES.md`.

| Where | Copy |
| --- | --- |
| Intro subtitle | Build it part by part. |
| Start overlay buttons | Start with this build · Start from an empty bench |
| Start overlay section | Or pick a build |
| Empty bench | Pick a case to begin |
| Tray hint | Drag into the case, or tap a card and then the slot |
| Card status | One of: "Fits", or "Installed · tap to remove", or the rule message |
| Warning preview on a card | One of: "Fits · low power headroom", or "Fits · over the supply", or "Fits · cooler runs hot" |
| Mode switch | Build · Showcase · Exploded |
| Quick toggles | Glass · Power · Airflow |
| Power disabled | Needs {list} to power on. |
| Selection menu | Inspect · Remove · Swap · Lighting |
| Cascade notice | Removed {n} parts, then one line each, then Undo |
| Spec status | No warnings · 1 warning · {n} warnings |
| Pressure words | Positive pressure · Balanced · Negative pressure · No fans |
| Load readout | Load {percent} percent · Processor {c} °C · Graphics {c} °C · Simulated. {percent} is the Load slider from 0 to 100. A temperature that is null is left out with its label. |
| Share dialog | Title: Share this build. Body: Anyone with this link gets this exact build. Button: Copy link. After copying: Link copied. |
| Poster dialog | Title: Export poster. Options: Portrait · Landscape. Button: Export poster. |
| Saved builds | Title: Saved builds. Buttons: Save this build · Load · Rename · Delete. Empty: No saved builds yet. |
| Shared link banner | Shared build · {name}. Button: Make it yours. |
| Dropped parts on a link | Some parts in this link are not in this version and were left out. |
| Settings | Quality: Auto · High · Medium · Low. Reduce motion. Reset saved data. |
| About | {productName} is a portfolio project by Brandon Church. Every brand and part here is invented. It runs entirely in your browser. No accounts, no tracking, no AI. |
| Untitled build | Untitled build |

## The poster

Two formats: portrait 2400 × 3000 and landscape 3840 × 2160. The rig is rendered at that size from the hero view with the glass as the build has it, the power on and the interface hidden, then composed on a 2D canvas with the build name in the display face, a compact spec list (case, board, processor, cooler, memory, graphics, storage, supply), the power line, and a small footer with the product name. On devices that cannot render that large, halve the size and say so in the dialog. The file downloads as a PNG named from the build name.

## Accessibility

- Every action has a keyboard path. Tab moves through the tray. Enter on a card installs it in the first free place, as defined in `kit/03-RULES.md` under "What the interface asks the engine". Shift Enter starts placing instead: the arrow keys move between the sockets, Enter confirms and Escape cancels. That is how a keyboard user picks a particular fan mount or radiator mount. Delete removes the selected part.
- Shortcuts, active only when focus is not in a text field: undo with Ctrl or Cmd Z, redo with Shift added, G for glass, P for power, A for airflow, B for Build, S for Showcase, E for Exploded, I for the Inspector on the selected part, Escape to close or deselect.
- A polite live region announces each build action in a sentence: "Veltrin Apex 3X installed. Graphics clearance 322 of 400 mm."
- The canvas has a label that describes what it shows. The full spec sheet is the complete alternative to the 3D view.
- Dialogs trap focus and return it. The visible focus ring is a 2 px accent outline with a 2 px offset.
- Reduced motion follows the system setting and can be forced in Settings.
