# 01 · Product

## Name

Desktop PC Builder. The name lives once, as `constants.productName` in the catalog. Everything that shows the name reads it from there.

## What it is

A static web app where you build a gaming PC in 3D. You choose a case, pick up parts, place them, and watch them seat. The app knows what fits and says why when something does not. You light the build, power it on, look at it from any angle and any distance, then save it, share it as a link or export a poster.

There is no AI in it. No language model, no API key, no account, no server, no database. Everything runs in the browser from static files.

## Who it is for

1. **People who like PC hardware.** They know what a 360 radiator is. They will test whether the rules are right and zoom in to see if the parts hold up.
2. **People planning a first build.** They want to see how the pieces go together and what can go wrong, without buying anything.
3. **People judging Brandon's work.** Recruiters and design leads will give it about a minute. The first ten seconds must show craft. They will try it on a phone.

## Principles

1. **The rig is the hero.** The interface frames it and never covers the center of the screen.
2. **Everything you see is true to the build.** Light comes from the parts that are installed. Sockets appear where parts really go. Warnings come from real numbers.
3. **You build with your hands.** Dragging a part into place is the main gesture. Tapping is equal to it, never a lesser path.
4. **The app explains itself.** When a part does not fit, it says the physical reason in one plain sentence with the numbers.
5. **Calm at rest, cinematic in motion.** Nothing wobbles or pulses for attention. Motion happens when the user acts, and it has weight.
6. **Touch, mouse and keyboard are all first class.**
7. **Complete, not a demo.** Every category, every part, every case and every screen is finished to the same level.

## The experience, start to finish

1. **Arrive.** A dark room. The name fades in. The Night Rig preset powers on: fans spin up, light sweeps through the parts, the camera pushes in slowly. This takes about six seconds and any input skips it. With reduced motion it is a still frame.
2. **Choose a start.** An overlay offers "Start with this build" and "Start from an empty bench", with the six preset builds below as cards. A returning visitor skips steps 1 and 2 and gets their last build back.
3. **Build.** The tray shows ten categories. Picking a category shows its parts as cards with a real render of each part, its key numbers, and whether it fits the current build.
4. **Inspect.** Tapping a part's picture opens the Inspector: the part alone on a turntable, lit like a product shot. You spin it, zoom into the detail, read its specs, and install it from there.
5. **Install.** Drag a card into the scene and a full 3D copy of the part follows your finger. Every place it can go lights up as a socket. Near a socket the part snaps to a preview pose. Let go and it seats with a short, specific motion: memory clicks in and the latches close, the graphics card slides into its slot and the bracket screws turn, a fan drops onto its mount. Or tap a card, then tap a socket. Or press Enter on a card to install it in the first free place.
6. **Get told no.** A part that cannot go in shows why before you let go: the socket turns to the blocked color and a short line appears, such as "Too long. This card is 322 mm and the case has 310 mm free." Nothing is ever silently refused.
7. **Swap and remove.** Tap an installed part to select it. A small menu offers Inspect, Remove, Swap and Lighting. Dragging a part out of the case removes it. Removing or swapping a part that others depend on removes those too, and a notice lists exactly what left and why. Undo brings it all back.
8. **Read the spec sheet.** A panel always shows the headline numbers: memory, storage, power draw against the supply, and graphics clearance. The full sheet lists every part by slot, every slot and bay used out of available, airflow balance, the recommended supply size, and any warnings.
9. **Light it.** The lighting panel sets one profile for the whole build: an effect, colors, speed, brightness, direction. Any lit part can be unlinked and given its own profile or turned off. Nine presets ship with the app. Custom profiles can be saved.
10. **Power on.** When the build has what it needs, the Power control lights up. Power on spins the fans up, brings the lighting up in sequence and lets the cables carry the eye. If something is missing the control says what.
11. **Showcase.** The interface recedes. The camera takes slow cinematic moves, or you orbit freely. The load control, which is there whenever the power is on, takes the build from idle to full load: fans speed up, simulated temperatures rise, and the Thermal effect shifts color. An airflow view shows air moving from intake to exhaust.
12. **Explode.** One control separates the build into its parts along clean axes, with labels, and puts it back.
13. **Keep it.** Name the build. Save it in the browser. Copy a link that rebuilds it exactly on any device. Export a poster image: the rig rendered large with its name and spec sheet.

## Feature list

Every item is in v1. `kit/09-QA-GAUNTLET.md` checks each one by its id.

| Id | Feature |
| --- | --- |
| F01 | Intro sequence, skippable, with a reduced motion still |
| F02 | Start overlay: start with the house build, start empty, or pick one of six preset builds |
| F03 | Autosave of the current build and restore on return |
| F04 | Tray with ten categories, part cards with rendered thumbnails, key numbers and live fit status |
| F05 | Inspector: single part on a turntable with orbit, zoom, specs, install and remove |
| F06 | Drag to install with a 3D ghost, sockets, snapping and a blocked state with the reason |
| F07 | Tap to install: tap a card, then a socket. One tap installs when only one place exists |
| F08 | Keyboard path for every build action, with visible focus and screen reader announcements |
| F09 | Install, remove and swap choreography for every category |
| F10 | Selection menu on installed parts: Inspect, Remove, Swap, Lighting |
| F11 | Cascade removal with a notice listing each removed part and the reason |
| F12 | Undo and redo for build actions |
| F13 | Spec sheet panel and full spec sheet dialog |
| F14 | Warnings: supply over capacity, low headroom, cooler under capacity, no fans, no storage |
| F15 | Case finishes: two per case |
| F16 | Fans per mount, with "Fill empty mounts" and "Clear fans" |
| F17 | Radiator mount choice when a case offers more than one |
| F18 | Storage counts limited by the case bays, the board slots and the board ports |
| F19 | Cable colorways applied to all visible cables |
| F20 | Lighting: eight effects, speed, brightness, direction, gradient editor with two to six stops |
| F21 | Lighting sync with per target overrides and off, for case, board, cooler, memory, graphics and fans |
| F22 | Nine lighting presets and saved custom profiles |
| F23 | Power on and power off sequences, with a clear reason when power on is not possible |
| F24 | Showcase mode with cinematic camera moves and free orbit |
| F25 | Load control with simulated temperatures and fan speed, shown whenever the power is on |
| F26 | Airflow view |
| F27 | Exploded view with labels |
| F28 | Glass panel on and off, saved with the build. It lifts away by itself while a part is being placed |
| F29 | Camera: orbit, zoom to fine detail, pan, focus on a part, reset |
| F30 | Saved builds in the browser: save, rename, load, delete |
| F31 | Share link that encodes the whole build, and a clean landing for someone opening one |
| F32 | Poster export as a PNG |
| F33 | Quality settings: automatic tier with a manual override |
| F34 | Layouts for desktop, tablet and phone, in both orientations |
| F35 | Reduced motion support |
| F36 | About dialog: what this is, that all brands are invented, credit to Brandon Church |
| F37 | Empty bench state that invites the first step |
| F38 | No network requests at runtime other than the app's own static files |

## Out of scope

Do not build these, even if they seem like natural additions.

- Sound of any kind
- AI features of any kind
- Accounts, sign in, cloud saves, any server or database
- Prices, stores, affiliate links, availability
- Real hardware brands, logos, product names or recognizable real product designs
- Custom liquid cooling loops, vertical graphics card mounts, more than one graphics card
- Performance estimates such as frame rates or benchmark scores
- Overclocking, BIOS screens, operating system boot screens
- Analytics, tracking, cookies banners
- Languages other than English
- A light interface theme
- Augmented or virtual reality modes

## Copy voice

The product speaks like a knowledgeable friend at the bench: short, plain, specific, calm.

- Present tense. Plain words. No exclamation points. No em dashes.
- Say the real reason with the real numbers: "Too tall. This cooler is 166 mm and the case fits 165 mm." Every number in a message is read from the catalog and the build at the moment it is shown.
- Buttons say exactly what happens: "Install", "Remove", "Copy link", "Export poster".
- Units are written with a space: "32 GB", "850 W", "322 mm". Use the multiplication sign for kits: "2 × 16 GB".
- Never blame the user. Never joke about a mistake.
- Use "percent" in sentences and the % sign only in compact numeric readouts.
- Part names are always brand then name, both from the catalog: "Veltrin Apex 3X", "Thessic 850", "Calyra Facet 32 GB".

`kit/05-DESIGN.md` holds the fixed strings for the main surfaces and the wording pattern for every rule message.
