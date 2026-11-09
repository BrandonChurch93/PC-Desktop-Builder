# 03 · Rules

The rules engine decides what fits, what leaves when something changes, what the spec sheet says and how a build becomes a link. It lives in `src/engine/`, is pure TypeScript with no Three.js and no DOM, and is covered by unit tests against `kit/data/fixtures.json`.

`kit/data/reference/rules.mjs` is the planning-time implementation that produced the fixtures. This file describes the same behavior in words. If they ever differ, this file wins, you log it, and the fixtures still have to pass.

All part numbers come from the catalog. This file names fields, never values.

## The build

```ts
type Build = {
  v: number;                       // constants.shareVersion
  name: string;                    // up to constants.maxBuildNameLength characters, may be empty
  case: { id: string; finish: string } | null;
  board: string | null;
  cpu: string | null;
  cooler: { id: string; mount: string | null } | null;   // mount is a radMount id for liquid coolers, null for air
  ram: string[];                   // kit ids in install order
  gpu: string | null;
  storage: { nvme: number; ssd: number; hdd: number };   // counts, one model per type
  psu: string | null;
  fans: Record<string, string>;    // case fan mount id -> fan style id
  cables: string;                  // colorway id, never null
  glass: boolean;
  lighting: Lighting;
};
type Profile = { effect: string; speed: number; brightness: number; direction: 1 | -1; stops: string[] };
type Lighting = Profile & { overrides: Partial<Record<LightTarget, Profile | 'off'>> };
type LightTarget = 'case' | 'board' | 'cooler' | 'ram' | 'gpu' | 'fans';
```

An empty build has every part null or empty, `cables` set to `onyx`, `glass` true, and the lighting of the `aurora` preset with no overrides.

`glass` is the user's choice for the glass panel and the only place that choice is stored. It is saved and shared with the build. `kit/04-WORLD.md` says when the scene lifts the glass away by itself.

**Ids.** A part id is known only when it is one of the catalog's own ids. Keep lookups in a `Map` or an object with no prototype, so that a string such as `toString` or `__proto__` is simply an unknown part. A fixture tests this.

Storage has one model per type, so the build stores counts. The three types are `nvme`, `ssd` and `hdd`, matching `storage[].type` in the catalog.

## Derived values

- **Radiator mount in use.** If the cooler is liquid (`type` is `aio`) and has a `mount`, it is the case `radMounts` entry with that id.
- **Fan mounts taken by the radiator.** The case `fanMounts` whose `group` equals the radiator mount's `group`, in catalog order, first `radSize / 120` of them. A 240 radiator takes two, a 360 takes three.
- **Graphics clearance.** `case.gpuMaxLength` minus the `gpuPenalty` of the radiator mount in use, or minus nothing when there is none.
- **Memory sticks in use.** Sum of `sticks` over installed kits.

## Check: may this part be installed

`check(build, category, id, opts)` returns `{ ok: true }` or `{ ok: false, code, data }`. Conditions are tested in the order listed. The first failure is returned. An id that is not in the catalog returns `UNKNOWN_PART`, and a category that is not one of the ten returns `UNKNOWN_CATEGORY`. For `storage` the `id` is the type: `nvme`, `ssd` or `hdd`. `data` holds the numbers the message needs. The Messages section lists it per code.

| Category | Tests, in order |
| --- | --- |
| `case` | Always ok. |
| `board` | No case: `NEED_CASE`. Board `size` not in `case.boardSizes`: `BOARD_SIZE`. |
| `cpu` | No board: `NEED_BOARD`. `cpu.platform` differs from `board.platform`: `CPU_PLATFORM`. |
| `cooler` (air: `tower` or `lowprofile`) | No processor: `NEED_CPU`. `height` over `case.coolerMaxHeight`: `COOLER_HEIGHT`. `ramClearance` is set and any installed kit has `height` above it: `RAM_CLEARANCE`. |
| `cooler` (liquid: `aio`) | No processor: `NEED_CPU`. Then choose a mount. A mount is valid when its `sizes` include the cooler's `radSize` and, if a graphics card is installed, the card's `length` is at most `case.gpuMaxLength` minus the mount's `gpuPenalty`. With `opts.mount` given: that mount must be valid, otherwise `NO_RAD_MOUNT` when the size is wrong or the mount does not exist, `RAD_GPU_CLEARANCE` when the card is the problem. Without `opts.mount`: take the first valid mount in catalog order. If none is valid: `RAD_GPU_CLEARANCE` when some mount has the right size, otherwise `NO_RAD_MOUNT`. On success the result carries the chosen `mount`. |
| `ram` | No board: `NEED_BOARD`. A cooler with `ramClearance` set and the kit's `height` above it: `RAM_CLEARANCE`. Sticks in use plus the kit's `sticks` over `board.ramSlots`: `RAM_SLOTS`. |
| `gpu` | No board: `NEED_BOARD`. `thickness` over `case.gpuMaxThickness`: `GPU_THICKNESS`. `length` over the graphics clearance: `GPU_LENGTH`. |
| `storage`, type `nvme` | No board: `NEED_BOARD`. Count plus one over `board.m2Slots`: `M2_SLOTS`. |
| `storage`, type `ssd` | No case: `NEED_CASE`. Count plus one over `case.bays25`: `BAYS_25`. A board is installed and `ssd + hdd + 1` is over `board.sataPorts`: `SATA_PORTS`. |
| `storage`, type `hdd` | No case: `NEED_CASE`. Count plus one over `case.bays35`: `BAYS_35`. Then the same `SATA_PORTS` test. |
| `psu` | No case: `NEED_CASE`. `form` differs from `case.psuForm`: `PSU_FORM`. `length` over `case.psuMaxLength`: `PSU_LENGTH`. |
| `fan` | No case: `NEED_CASE`. `opts.mount` is not a mount of this case: `FAN_MOUNT_UNKNOWN`. The mount is taken by the radiator: `FAN_MOUNT_TAKEN`. |
| `cables` | Always ok for a known colorway. |

Drives mount in the case, so `ssd` and `hdd` need only a case. Their SATA limit applies once a board is present.

## Install

`install(build, category, id, opts)` returns `{ ok: true, build, removed }`, or on failure `{ ok: false, code, data, build, removed: [] }` with the build unchanged.

- **Single place categories** (`case`, `board`, `cpu`, `cooler`, `gpu`, `psu`, `cables`): installing over an existing part is a swap. Run `check` against the build with that place emptied. If it passes, put the new part in, then revalidate. For a case, `opts.finish` picks the finish and defaults to the first in `finishes`.
- **`ram`**: `check`, then append the kit.
- **`storage`**: `check`, then add one to that type's count.
- **`fan`**: `check`, then set `fans[opts.mount]`. A fan already on that mount is replaced.
- After every successful install, run **revalidate**. Its `removed` list is the cascade.

A swap is never blocked because of what it will remove. Swapping the case for a smaller one is allowed and the parts that cannot follow are removed and reported. A swap is blocked only when the new part itself fails `check`.

## Remove

`remove(build, category, opts)`: clear the place (`ram` takes `opts.index`, default the last kit; `storage` takes `opts.type` and subtracts one; `fan` takes `opts.mount`), then revalidate.

## Revalidate: the cascade

`revalidate(build)` returns a canonical build and the list of what it removed. It runs after every install and remove and on every decoded link. It walks the build in this fixed order and removes whatever no longer holds. Each removal is recorded as `{ category, id, code }`, with `count` for storage and `mount` for fans.

1. **Case.** Unknown id: remove. A finish not offered by the case becomes the first finish.
2. **Board.** Unknown, no case (`NEED_CASE`), or size not supported (`BOARD_SIZE`): remove.
3. **Processor.** Unknown, no board (`NEED_BOARD`), or platform mismatch (`CPU_PLATFORM`): remove.
4. **Cooler.** Unknown or no processor (`NEED_CPU`): remove. Air: `mount` becomes null, and a height over the case limit removes it (`COOLER_HEIGHT`). Liquid: if its mount does not exist in this case or does not take its size, move it to another mount of the right size. Prefer the first such mount that keeps the installed graphics card within clearance. A card that is about to be removed anyway (it has no board under it, or it is longer than `case.gpuMaxLength`) does not affect the choice: take the first mount of the right size. If no mount takes the size: remove (`NO_RAD_MOUNT`).
5. **Memory.** In install order. Unknown, no board (`NEED_BOARD`), taller than the cooler's `ramClearance` (`RAM_CLEARANCE`), or more sticks than slots remain (`RAM_SLOTS`): remove that kit and continue with the next.
6. **Graphics.** Unknown, no board (`NEED_BOARD`), too thick (`GPU_THICKNESS`), or longer than the graphics clearance as it stands after step 4 (`GPU_LENGTH`): remove.
7. **Storage.** Counts that are not whole positive numbers become zero. `nvme`: zero without a board (`NEED_BOARD`), otherwise cut to `m2Slots` (`M2_SLOTS`). `ssd` and `hdd`: zero without a case (`NEED_CASE`), otherwise cut to `bays25` (`BAYS_25`) and `bays35` (`BAYS_35`). Then, with a board, if `ssd + hdd` is over `sataPorts`, cut `ssd` first and then `hdd` until it fits (`SATA_PORTS`). Each cut records the number removed in `count`.
8. **Supply.** Unknown, no case (`NEED_CASE`), wrong form (`PSU_FORM`), or too long (`PSU_LENGTH`): remove.
9. **Fans.** Visit mounts in the case's catalog order, then any others by name. Unknown fan, no case (`NEED_CASE`), mount not in this case (`FAN_MOUNT_UNKNOWN`), or mount taken by the radiator (`FAN_MOUNT_TAKEN`): remove that fan.
10. **The rest.** Unknown colorway becomes `onyx`. Lighting is sanitized (below). `glass` is false only when it is exactly `false`, and true otherwise. `name` becomes a string (empty when missing) and is cut to the maximum length. `v` is set to the share version.

A revalidated build that is revalidated again does not change. The six preset builds revalidate with nothing removed.

## Lighting sanitation

The main profile first:

- A main profile that is missing or is not an object becomes a copy of the fallback.
- `effect` not in `lighting.effects`: take the fallback's effect.
- `speed` and `brightness`: round, then clamp to the catalog ranges. Not a finite number: take the fallback.
- `direction`: `-1` stays, anything else becomes `1`.
- `stops`: lowercase, keep only six digit hex colors with a leading `#`, keep at most `constants.maxGradientStops`. Fewer than `constants.minGradientStops` left: take the fallback's stops.
- The fallback for the main profile is the `aurora` preset.

Then the overrides:

- Only the targets in `constants.lightTargets` can have an override. A target with no override gets none. Sanitation never adds one.
- A value of `'off'` stays `'off'`. A value that is an object is sanitized by the four field rules above, with the sanitized main profile as its fallback. Any other value is dropped, which leaves that target with no override.

## Spec sheet

`sheet(build)` returns these fields. A valid build is assumed.

| Field | Meaning |
| --- | --- |
| `memoryGb` | Sum of `sticks × gbPerStick` |
| `ramSlotsUsed`, `ramSlots` | Sticks in use, and the board's slots (0 with no board) |
| `storageTb` | Sum of count × `capacityTb` per type |
| `m2Used`, `m2Slots` | NVMe count, board slots |
| `bays25Used`, `bays25`, `bays35Used`, `bays35` | Drive counts and case bays |
| `sataUsed`, `sataPorts` | `ssd + hdd`, board ports |
| `drawW` | Estimated draw, below |
| `psuCapacityW` | Supply `capacity`, 0 with none |
| `loadPercent` | `round(drawW / capacity × 100)`, null with no supply |
| `recommendedPsuW` | `ceil(drawW × recommendedPsuFactor / recommendedPsuStep) × recommendedPsuStep` |
| `gpuLength`, `gpuMaxLength` | Card length (0 with none) and the graphics clearance |
| `coolerCapacityW`, `cpuDrawW` | Cooler `capacity` and processor `draw` |
| `intakeFans`, `exhaustFans` | Fan counts by mount role, below |
| `pressure` | `none` with no fans, `positive` when intake is higher, `negative` when exhaust is higher, `balanced` when equal |
| `missing` | Which of `case`, `board`, `cpu`, `cooler`, `ram`, `psu` are absent, in that order |
| `warnings` | List of `{ code, level }`, below |
| `canPowerOn` | `missing` is empty and `drawW` is at most the supply capacity |

**Estimated draw** is the sum of: case `draw`, board `draw`, processor `draw`, cooler `draw`, graphics `draw`, `sticks × drawPerStick` for each kit, count × `draw` for each storage type, and the `draw` of every case fan. A liquid cooler's own fans and pump are already inside the cooler's `draw`.

**Fan counts.** Each case fan counts toward the `role` of its mount. A liquid cooler adds its `fans` to the role of the mount group its radiator sits on. Air cooler fans do not count.

**Warnings**, in this order:

| Code | Level | When |
| --- | --- | --- |
| `PSU_OVER` | `error` | A supply is installed and `drawW` is over its capacity |
| `PSU_HEADROOM` | `warn` | A supply is installed, `PSU_OVER` did not fire, and `drawW` is over `capacity × headroomWarnRatio` |
| `COOLER_CAPACITY` | `warn` | Cooler and processor are installed and the cooler `capacity` is below the processor `draw` |
| `NO_FANS` | `info` | A case is installed and intake plus exhaust is zero |
| `NO_STORAGE` | `info` | `missing` is empty and `storageTb` is zero |

Warnings never block an install. Only `PSU_OVER` blocks power on, through `canPowerOn`.

## Simulated temperatures

`temps(build, load)` with `load` from 0 to 1 returns `cpuC` and `gpuC`. They are a simple model for the Thermal lighting effect and the load readout. Label them "Simulated" wherever they show. Constants are in `constants.thermal`.

- `air = clamp(airflowBase − airflowPerFan × (intakeFans + exhaustFans), airflowMin, airflowMax)`
- `cpuC = round(cpuBase + load × cpuSpan × min(cpuRatioCap, cpu.draw / cooler.capacity) × air)`, null without both a processor and a cooler
- `gpuC = round(gpuBase + load × gpuSpan × clamp(gpu.draw / (gpu.fans × gpuWattsPerFan), gpuFactorMin, gpuFactorMax) × air)`, null without a card

The Thermal effect maps a temperature from `tempMin` to `tempMax` onto hue `hueCold` down to 0 at full saturation. Zones on the cooler and board use `cpuC`, zones on the card use `gpuC`, and other zones use the average of the two. Where a zone's temperature is null it uses the other one, and with neither it uses `tempMin`. The effect reads the temperatures at the current Load.

## Share links

A build becomes a link as `<origin><path>#b=<code>`.

`code` is the base64url form (`+` to `-`, `/` to `_`, no `=` padding) of the UTF-8 bytes of `JSON.stringify(payload)`, with no added whitespace. The payload is this array, in this order:

| Index | Value |
| --- | --- |
| 0 | `constants.shareVersion` |
| 1 | case id, or `0` |
| 2 | case finish, or `0` |
| 3 | board id, or `0` |
| 4 | processor id, or `0` |
| 5 | cooler id, or `0` |
| 6 | cooler mount id, or `0` |
| 7 | array of memory kit ids |
| 8 | graphics id, or `0` |
| 9 | `[nvme, ssd, hdd]` |
| 10 | supply id, or `0` |
| 11 | array of `[mountId, fanId]`, sorted by the case's catalog order of mounts |
| 12 | colorway id |
| 13 | `1` for glass on, `0` for off. When decoding, only `0` means off |
| 14 | lighting: `[effect, speed, brightness, direction, stops, overrides]` |
| 15 | name |

In lighting, `stops` are hex strings without the `#`. `overrides` is an array of `[target, value]` in the order of `constants.lightTargets`, where `value` is `0` for off or `[effect, speed, brightness, direction, stops]`.

**Decoding.** Anything that is not base64url of a JSON array whose first item is a whole number of at least 1 is `BAD_LINK`. A first item above `constants.shareVersion` is `NEWER_LINK`. Otherwise rebuild the Build from the array, treating missing pieces as empty, and run revalidate. The result is the canonical build plus the list of what was dropped. Decoding never throws: if rebuilding fails for any reason the result is `BAD_LINK`.

In the browser, make the code from the UTF-8 bytes of the JSON (`TextEncoder`, then base64), and decode the same way back (`TextDecoder`). `btoa` on the raw text breaks on a build name with a character outside Latin 1. A fixture has an interpunct in the name to catch this.

The fixtures hold the exact code for each preset, and decode cases for bad input, unknown ids and conflicts. `encode(decode(code).build)` returns the same code for every preset.

## The fixtures file

`kit/data/fixtures.json` has a `version`, a `note`, and three lists.

- `presets[]`: `id`, the full `build`, its share code as `encoded`, its `sheet`, `temps` at `idle` (load 0), `half` (0.5) and `full` (1), `occupiedFanMounts` (the fan mounts taken by the radiator) and `gpuMaxLength` (the graphics clearance).
- `checks[]`: `name`, a starting `build`, an `action` and the `expect`ed result. An action is `{ type: 'install', category, id, opts? }` or `{ type: 'remove', category, opts? }`. For storage the `id` of an install is the type (`nvme`, `ssd`, `hdd`). `expect` has `ok`, `code` (null on success), `removed`, and on success the resulting `sheet` and `cooler`.
- `decodes[]`: `name`, an `encoded` string, and `expect`, which is either `{ error }` or `{ build, removed }`.

Each `removed` entry is `{ category, id, code }`, with `count` for storage and `mount` for fans. The category of a removed fan is `fan` and of a removed drive is `storage`, with the storage type as its `id`.

To regenerate the fixtures after a catalog change: edit `kit/data/reference/catalog.mjs`, then run `node kit/data/reference/fixtures.mjs kit/data`. It rewrites both `catalog.json` and `fixtures.json` and fails loudly if a preset stops being valid. Then copy `kit/data/catalog.json` over `src/data/catalog.json`. The Builder does this only when an addendum says to.

## What the interface asks the engine

- **Fit status for a tray card.** For a part in a single place category: `installed` when it is the installed one, otherwise the result of `check` against the build with that place emptied. For `ram` and `storage`: the result of `check` for adding one more. For fans: fits when a case is installed and at least one of its mounts is not taken by the radiator. Show `fits`, or the reason from the code.
- **Fans in bulk.** "Fill empty mounts" puts the chosen style on every mount that has no fan and is not taken by the radiator. "Clear fans" removes every case fan. Each is one build action and one history entry.
- **Warning preview for a tray card.** When a part fits, also compute the spec sheet of the build as it would be after installing it. If that sheet has a `warn` or `error` warning that the current sheet does not have, the card shows it after "Fits": `PSU_HEADROOM` as "low power headroom", `PSU_OVER` as "over the supply", `COOLER_CAPACITY` as "cooler runs hot". The part still installs.
- **Sockets for a held part.** Every place the part could go, each marked valid or blocked with its code. Liquid coolers get one socket per radiator mount. Fans get one per mount. Memory gets the next free slots in fill order.
- **The first free place.** Enter on a card, and a tap on a card whose part has only one possible place, install without asking where. For a fan that means the first mount in catalog order that has no fan and is not taken by the radiator. When every mount already has a fan, Enter starts placing instead, so the user picks the fan to replace. For a liquid cooler it is the mount `check` picks with no mount named. Memory and storage only ever have one next place.
- **Power.** `canPowerOn`, and when false the `missing` list or `PSU_OVER`.

## Fill order

These are conventions for where counted parts appear. The engine stores counts and the world places them.

- **Memory slots** are named A1, A2, B1, B2 outward from the processor. A two stick kit takes A2 and B2 first, then a second kit takes A1 and B1. A four stick kit takes all four. On a two slot board the slots are A1 and B1.
- **M.2 slots**: slot 1 is nearest the processor. Fill in number order.
- **Drive bays**: fill lowest index first.
- **Fan mount numbering**: `front`, `side` and `spine` count from the bottom up. `top` and `bottom` count from the rear forward. A 240 radiator on a three mount group takes mounts 1 and 2.

## Messages

Codes map to copy in one module, `src/engine/messages.ts`. These are the strings. Words in braces are filled from the `data` that `check` returns with the code. The second column lists that data. Display words for ids come from the catalog: `labels` for categories, board sizes, supply forms, storage types, finishes and mount groups, and `platforms[].name` for a platform.

| Code | `data` | Message when an install is blocked |
| --- | --- | --- |
| `NEED_CASE` | none | Pick a case first. |
| `NEED_BOARD` | none | Install a board first. |
| `NEED_CPU` | none | Install a processor first. |
| `BOARD_SIZE` | `sizes`: the case's board size ids | Too large. This case takes {sizes} boards. The sizes use `labels.boardSize`, joined with commas and "and". |
| `CPU_PLATFORM` | `platform`: the board's platform id | Wrong socket. This board takes {platform} processors. |
| `COOLER_HEIGHT` | `height`, `max` | Too tall. This cooler is {height} mm and the case fits {max} mm. |
| `NO_RAD_MOUNT` | `size` | Checked against one mount: This mount does not take a {size} mm radiator. Checked with no mount named: This case has no mount for a {size} mm radiator. |
| `RAD_GPU_CLEARANCE` | `length`: the installed card, `max`: the clearance the radiator would leave | Checked against one mount: No room. A radiator here leaves {max} mm for the graphics card and it is {length} mm long. Checked with no mount named: No room. A radiator in this case leaves {max} mm for the graphics card and it is {length} mm long. |
| `RAM_CLEARANCE` | `blocked`: `ram` or `cooler`, `clearance`, `height` | When `blocked` is `ram`, memory is going in under a cooler: Too tall. The cooler leaves {clearance} mm over the memory and this kit is {height} mm. When `blocked` is `cooler`, a cooler is going in over memory: No room. This cooler leaves {clearance} mm over the memory and the installed kit is {height} mm. |
| `RAM_SLOTS` | `sticks`, `free` | Not enough slots. This kit needs {sticks} and {free} are free. With none free: No free slots. This kit needs {sticks}. |
| `GPU_LENGTH` | `length`, `max` | Too long. This card is {length} mm and the case has {max} mm free. |
| `GPU_THICKNESS` | `thickness`, `max` | Too thick. This card is {thickness} mm and the case fits {max} mm. |
| `M2_SLOTS` | `slots` | All {slots} M.2 slots on this board are in use. With one: The only M.2 slot on this board is in use. |
| `BAYS_25` | `bays` | All {bays} 2.5 inch mounts in this case are in use. With one: The only 2.5 inch mount in this case is in use. With zero: This case has no 2.5 inch mounts. |
| `BAYS_35` | `bays` | All {bays} 3.5 inch bays in this case are in use. With one: The only 3.5 inch bay in this case is in use. With zero: This case has no 3.5 inch bays. |
| `SATA_PORTS` | `ports` | All {ports} SATA ports on this board are in use. |
| `PSU_FORM` | `form`: the case's supply form id | Wrong size. This case takes {form} supplies. |
| `PSU_LENGTH` | `length`, `max` | Too long. This supply is {length} mm and the case fits {max} mm. |
| `FAN_MOUNT_TAKEN` | none | The radiator uses this mount. |

`UNKNOWN_PART`, `UNKNOWN_CATEGORY` and `FAN_MOUNT_UNKNOWN` come only from bad links or bugs and are never shown as install messages.

**Cascade notice.** Title: "Removed {n} parts", or "Removed 1 part" when n is 1. n is the number of physical things that left: each removed entry counts once, and a storage entry counts as its `count`. Below the title, one line per distinct part and reason: the part name, an interpunct, and the short reason. When the same part left more than once for the same reason (three fans, two drives), write one line that starts with the number and a multiplication sign: "3 × Kestrane Gale · the radiator uses its mount". A removed storage entry is named by the catalog drive of that type.

| Code | Short reason |
| --- | --- |
| `NEED_CASE` | needs a case |
| `NEED_BOARD` | needs a board |
| `NEED_CPU` | needs a processor |
| `BOARD_SIZE` | too large for this case |
| `CPU_PLATFORM` | wrong socket for this board |
| `COOLER_HEIGHT` | too tall for this case |
| `NO_RAD_MOUNT` | no radiator mount that size |
| `RAM_CLEARANCE` | too tall under this cooler |
| `RAM_SLOTS` | no free slots |
| `GPU_LENGTH` | too long for this case |
| `GPU_THICKNESS` | too thick for this case |
| `M2_SLOTS`, `BAYS_25`, `BAYS_35`, `SATA_PORTS` | no place left |
| `PSU_FORM` | wrong size for this case |
| `PSU_LENGTH` | too long for this case |
| `FAN_MOUNT_TAKEN` | the radiator uses its mount |
| `FAN_MOUNT_UNKNOWN` | no such mount in this case |
| `UNKNOWN_PART` | not in this version |

The notice has an Undo button.

**Warnings.**

| Code | Message |
| --- | --- |
| `PSU_OVER` | Not enough power. The build draws {draw} W and the supply gives {capacity} W. |
| `PSU_HEADROOM` | Low headroom. The build uses {percent} percent of the supply. A supply of {recommended} W or more gives it room. |
| `COOLER_CAPACITY` | The cooler is rated for {capacity} W and this processor draws {draw} W. It runs hot under load. |
| `NO_FANS` | No case fans. Add intake and exhaust for airflow. |
| `NO_STORAGE` | No storage. It powers on with nothing to start from. |

Warning messages are filled from the spec sheet: {draw} is `drawW`, {capacity} is `psuCapacityW` for the supply warnings and `coolerCapacityW` for the cooler warning, {percent} is `loadPercent`, {recommended} is `recommendedPsuW`, and the processor's {draw} is `cpuDrawW`.

**Power.** When parts are missing: "Needs {list} to power on." The list names the sheet's `missing` items with the words in `labels.missing`, in the sheet's order, joined with commas and "and". With `PSU_OVER`: use its warning message.

**Links.** `BAD_LINK`: "This link does not hold a build." `NEWER_LINK`: "This link comes from a newer version." Both offer "Start from an empty bench".

## Browser storage

All keys start with `dpcb.v1.`. Wrap every read and write in try and catch. The app must work fully with storage unavailable, without saved builds.

| Key | Value |
| --- | --- |
| `dpcb.v1.current` | The current build as a share code. Written after every change, debounced. |
| `dpcb.v1.saved` | JSON array of `{ id, name, code, savedAt }`, newest first, at most `constants.maxSavedBuilds` |
| `dpcb.v1.profiles` | JSON array of custom lighting profiles `{ id, name, effect, speed, brightness, direction, stops }`, at most `constants.maxSavedProfiles` |
| `dpcb.v1.settings` | JSON `{ quality: 'auto' | 'high' | 'medium' | 'low', reducedMotion: 'system' | 'on', introSeen: boolean }` |

Saving when the list is full asks the user to replace the oldest or cancel. "Reset saved data" in Settings removes all four keys and returns to the empty bench.

## Undo

Build actions (install, remove, swap, finish, fans, storage, cables, glass, name, and lighting changes) push the previous build onto a history stack of at most `constants.maxHistory`. A slider drag pushes once, on release. Undo and redo move through the stack. Loading a preset, a saved build or a link is one history entry like any other action, so one undo returns to the build it replaced.
