# Machine Selection Dialog And Favourite Machines — Plan

Status: **implemented** (decisions in §7, implementation notes in §8) · Mockup: [`mockups/machine-select-dialog.html`](mockups/machine-select-dialog.html)

## 1. Problem

`Machine › Machine type` lists every model of every registered machine
(`src/main/machine-types-menu.ts`, fed by `machineRegistry`). Today that is **28 checkbox items in
8 separator-delimited groups** (Z88 alone contributes 10). Every new machine or model makes the menu
longer, and the models most people use are buried among ones they never touch.

## 2. Goal

- The submenu shows only the user's **favourite models**, in the user's order, with optional
  separators, followed by a fixed **"Select machine…"** item.
- "Select machine…" opens a dialog that lists **every** model, lets the user **switch** to any of
  them, and lets the user **edit the favourites**: add/remove, reorder, separator after an item.
- Nothing about switching machines changes: the dialog ends in the same main-process code path the
  menu uses today (`setMachineType` + scanline reset + `saveKliveProject`).

Non-goals: per-project favourites, editing machine configuration (RAM, slots, ROMs) from this dialog,
renaming models, user-defined groups/submenus.

## 3. The menu after the change

```
Machine type ▸  ✓ ZX Spectrum 48K
                  ZX Spectrum 128K
                  ZX Spectrum +3E (1 FDD)
                  ───────────────
                  ZX Spectrum Next
                  ───────────────
                  Cambridge Z88 (OZ v5.0B Int.)
                  Sinclair ZX81 (16K)
                  ───────────────
                  Select machine…            ⇧⌘M
```

Rules (all in a pure function, unit-tested):

1. Favourites in stored order; a separator after an entry whose `separatorAfter` is set — except the
   last favourite (no doubled separator before the fixed tail).
2. **The running model is always visible.** If it is not a favourite, it is appended as a checked
   item in its own group after the favourites. Otherwise nothing in the menu would say what runs.
3. A separator, then "Select machine…", always — even with zero favourites.
4. Unknown entries (a machine removed from the registry, an old model id) are skipped; model-id
   aliases go through `resolveModelId` (`-wasm`/`-ts` Z88 ids), duplicates collapse to the first.
5. Accelerator `CmdOrCtrl+Shift+M` for "Select machine…" (no current accelerator uses it — to confirm).

### Default favourites (used when the setting is absent)

| Order | Model | Separator after |
| --- | --- | --- |
| 1 | ZX Spectrum 48K (`sp48`/`pal`) | |
| 2 | ZX Spectrum 128K (`sp128`) | |
| 3 | ZX Spectrum +3E (1 FDD) (`spp3e`/`fdd1`) | ✓ |
| 4 | ZX Spectrum Next (`zxnext`/`standard`) | ✓ |
| 5 | Cambridge Z88 (OZ v5.0B Int.) (`z88`/`OZ50`) | |
| 6 | Sinclair ZX81 (16K) (`zx81`/`zx81-16k`) | |

(Machine ids above are the `MI_*` constants; exact strings come from `@common/machines/constants`.)

## 4. The dialog

See the mockup (v2) — it is interactive and shows the resulting menu next to the dialog.

**Title:** "Select Machine". A navigation pane on the left, the selected model's **hardware sheet**
on the right, the standard Klive dialog footer below.

### 4.1 Left — accordion of machine types and models

- A filter box on top. It matches the model name, the machine type, RAM size, media, CPU, ROM and
  PAL/NTSC, so `128K`, `NTSC`, `disk` or `OZ v4` all narrow the list. While a filter is active every
  matching section is expanded and the Favourites section is hidden.
- **Favourites · menu order** is the first section, open by default. It *is* the Machine type menu:
  rows in menu order, a dashed rule wherever a separator follows. Hovering or selecting a row shows
  ↑, ↓, "separator after" and ×; rows can also be dragged by the grip. Selecting a favourite shows
  its hardware sheet like any other row.
- Then one section per machine type, in registry order, each with a model count. Expanding one
  shows its models; the running model carries a "Running" pill, and a collapsed section that holds
  it shows a dot.
- **A machine type with a single model is a leaf** (ZX Spectrum 128K, ZX Spectrum Next): it selects
  directly, with no one-item accordion to open.
- A star at the right of every model toggles it as a favourite (shown on hover or when set).
- The dialog opens with the running model's section expanded and the running model selected.

### 4.2 Right — hardware sheet of the selected model

- Header: model name, "Running" pill, machine type and `machineId / modelId` (useful when editing
  a project file), and a **"★ Add to / In Machine type menu"** toggle — the same as the star.
- A row of summary chips: CPU, RAM, PAL/NTSC, media.
- Six groups, two columns (one on narrow windows):
  | Group | Rows |
  | --- | --- |
  | Processor | CPU, clock in Hz and MHz, turbo modes (Next), clock multiplier range or "—" |
  | Memory | ROM pages × size, ROM image ids, RAM, banks, address space (Z88) |
  | Display (full width) | a to-scale drawing of the raster with border vs. display area (an LCD for the Z88), resolution, colours, attribute scheme, layers (Next) |
  | Frame timing | PAL/NTSC, T-states (cycles for the C64) per line, lines per frame, T-states per frame, frame rate |
  | Sound | beeper, AY, TurboSound, DAC, SID, or "none" |
  | Storage & input | tape/disk/SD/card slots, keyboard, mouse, joysticks |
- Values use the data-panel value colour (`--color-state-value`) and tabular monospace; a value Klive
  cannot state for that machine shows "—" (e.g. ZX80 lines per frame: video is software-generated).

### 4.3 Footer and keyboard

`Restore default favourites` (left, link-style) · unsaved-changes hint · `Cancel` · `Save` ·
**`Switch to <model>`** (primary).
- `Save` stores the favourites and closes; disabled while nothing changed.
- `Switch to …` stores changed favourites and switches; disabled for the running model. Double-click
  or Enter on a model does the same.
- `Cancel` / Esc / × discards favourite edits.

Keyboard: ↑/↓ walk sections and models; →/← expand/collapse a section; Space toggles the star;
Enter switches; Alt+↑/↓ reorders a favourite; Delete removes it. Focus is always visible.

### 4.4 Size

The dialog may open in a small emulator window (ZX81). Side-by-side from ~760 px; below that the
accordion stacks above the sheet, and the sheet's groups go to one column. Both panes scroll
internally; the dialog never exceeds the window.

## 5. Architecture

### 5.1 Data (`src/common/machines/machine-favorites.ts`, new)

```ts
export type MachineFavorite = { machineId: string; modelId?: string; separatorAfter?: boolean };
export const DEFAULT_MACHINE_FAVORITES: readonly MachineFavorite[];
/** Drops unknown/duplicate entries, resolves aliases; undefined → defaults. */
export function normalizeMachineFavorites(raw: unknown, registry: MachineInfo[]): MachineFavorite[];
export function favoriteKey(f: { machineId: string; modelId?: string }): string;
```

`normalizeMachineFavorites` is the only place that trusts nothing about the stored value, so both
the menu builder and the dialog read through it.

### 5.1b Hardware specs (`src/common/machines/hardware-specs.ts`, new)

Most of the sheet's figures exist today only inside machine hosts or the WASM C sources (Spectrum
clocks in host constructors, frame configs in `CommonScreenDevice` / `zx-spectrum-ula.c`, Next timing
in `zxnext.c`, C64 clocks in `C64Machine`). The dialog must not instantiate a machine, so:

- A static, dependency-free table `Record<machineId, Record<modelId | "", HardwareSpec>>` and
  `getHardwareSpec(machineId, modelId)` (through `resolveModelId`). `HardwareSpec` has typed fields
  (`cpu`, `clockHz`, `turbo?`, `clockMultiplier: boolean`, `rom: {pages, pageSize, images}`,
  `ramKb`, `banks?`, `display: {width, height, rasterWidth, rasterHeight, colours, attributes?, …}`,
  `timing: {standard, tPerLine?, linesPerFrame?, tPerFrame?, frameHz}`, `sound[]`, `media[]`, `input[]`)
  — the view formats them; no pre-formatted strings in data.
- Derivable values are **derived, not stored**: ROM pages from `MF_ROM`, banks from `MF_BANK`, PSG from
  `MF_PSG`, media from `mediaIds` + `MC_DISK_SUPPORT`, RAM from `MC_MEM_SIZE` / `MC_Z88_INTRAM`,
  clock-multiplier availability from `MF_ALLOW_CLOCK_MULTIPLIER`, Z88 ROM from its slot-0 config.
- Where a host already exports a constant (`ZX8081_BASE_CLOCK_FREQUENCY`, `ZX8081_TACTS_IN_FRAME_*`,
  `Z88_BASE_CLOCK_FREQUENCY`, `Z88_TACTS_IN_FRAME`), the table imports it. For the others, a
  **drift test** in the e2e-cores tier boots each model on its WASM core and asserts clock, T-states
  per frame and screen size against the table, so the sheet cannot silently disagree with the
  emulator. (Optionally the hosts later read their constants *from* this table.)
- Adding a machine to the registry without a spec fails a unit test — the sheet never shows blanks
  by accident.
- Facts the code does not pin down (e.g. ZX81 lines per frame, Next bank size) are left out
  ("—") rather than written from memory.

### 5.2 Setting

`SETTING_EMU_MACHINE_FAVORITES = "emuOptions.machineFavorites"` in `setting-const.ts`, defined in
`setting-definitions.ts` like `SETTING_EMU_JOYSTICK_BINDINGS` (`type: "object"`, `saveWithIde: true`,
`boundTo: "emu"`). It is a **user preference, not project state**: favourites follow the user across
projects. Default value `undefined` → `DEFAULT_MACHINE_FAVORITES` (so changing the defaults later
reaches everyone who never customised).

### 5.3 Menu (`src/main/machine-types-menu.ts`)

`createMachineTypesMenu(registry, favorites, currentMachineId, currentModelId, select, openSelector)`
implements §3. `app-menu.ts` reads the setting, normalises it, and passes `openSelector`, which:

1. calls `displayDialog(MACHINE_SELECT_DIALOG, data)` on the **focused window** (IDE or emulator —
   the same choice the About dialog makes);
2. on a result, writes `favorites` with `setSettingValue` (the menu rebuilds from it);
3. on `switchTo`, runs the **existing** selector callback — extracted from the inline lambda in
   `app-menu.ts` into a named `selectMachineType(machineId, modelId)` so the menu items and the
   dialog share one path.

The dialog therefore has **no side effects of its own**: it returns data, main applies it.

```ts
// dialog data (main → renderer)
type MachineSelectDialogData = {
  favorites: MachineFavorite[];          // normalised
  defaults: MachineFavorite[];
  current: { machineId: string; modelId?: string };
};
// dialog result (renderer → main); undefined = cancelled
type MachineSelectDialogResult = {
  favorites?: MachineFavorite[];         // present only when changed
  switchTo?: { machineId: string; modelId?: string };
};
```

The catalogue is built in the renderer from `machineRegistry` (already importable there), so the
dialog data stays small and serialisable.

### 5.4 Dialog (renderer)

- `MACHINE_SELECT_DIALOG` id (7). It opens in either window, and like `ABOUT_DIALOG` it is a single
  id registered in both `ideDialogRegistry.tsx` and `emuDialogRegistry.tsx` — a second id per window
  (the `FIRST_STARTUP_DIALOG_*` shape) buys nothing when both render the same component.
- Location: `src/renderer/appIde/dialogs/machineSelect/` (the shared dialogs, `AboutDialog`,
  `FirstStartDialog`, already live in `appIde/dialogs` and are imported by the emu registry).
- Pattern: **Model + ViewModel, no Controller.** The dialog has rich derived rules (filtering,
  reordering, separator normalisation, dirty state, button enablement) but no async orchestration
  and no ports beyond "close with result" — per `.ai/ui-mvc-guide.md` the Controller would be
  ceremony. Files: `MachineSelectModel.ts` (state, events, pure `reduce`),
  `MachineSelectViewModel.ts` (`selectViewModel`, accordion sections, filter haystack, sheet formatting from `getHardwareSpec`), `MachineSelectView.tsx` (dumb
  view), `MachineSelectDialog.tsx` (container: `useReducer` + close).
- Built on existing primitives: `Modal`/`DialogFooter`, `Button`, `TextInput`, `Icon`,
  `ScrollViewer`, row heights from `theming/tokens/rowSizes.ts`, colours only from tokens. Icons:
  `star`/`star-off`, `chevron-up`/`-down`, `separator-horizontal`, `x`, `grip-vertical` — Lucide SVGs
  dropped into `src/renderer/assets/icons/` where missing.
- Drag-and-drop reordering uses native HTML5 DnD (as `DocumentTabs` does); the buttons and keyboard
  remain the primary, testable path.

## 6. Steps

1. **Data + setting.** `machine-favorites.ts`, setting const/definition, node tests for
   `normalizeMachineFavorites` (unknown ids, aliases, duplicates, non-array garbage, `undefined`).
2. **Menu.** New `createMachineTypesMenu` signature and rules of §3; extend
   `test/main/machine-types-menu.test.ts` (order, separators, trailing-separator suppression, running
   non-favourite appended, empty favourites, "Select machine…" always last). Extract
   `selectMachineType` in `app-menu.ts`. At this point the menu already works with defaults; the
   "Select machine…" item opens nothing yet (hidden behind the next step in the same PR).
3. **Hardware specs table** (§5.1b) with the registry-coverage unit test and the e2e drift test.
4. **Model + ViewModel** with node tests driving every user action as events: star/unstar, reorder at
   both ends, separator toggle on the last item, filter, collapse, restore defaults, dirty tracking,
   result shape for Save / Switch / Cancel.
5. **View + container**, dialog ids, both registries, `openSelector` wiring in `app-menu.ts`. One
   jsdom smoke test that mounts the dialog and checks `data-testid`s exist.
6. **Visual check in the running app** (CDP recipe in `.ai/ui-theming-intent-and-lessons.md`), both
   themes, IDE window and a small emulator window; record any durable styling rule in
   `.ai/ui-theming-intent-and-lessons.md` (standing instruction).
7. Docs: update the user docs page that describes the Machine menu (`docs/content/…`), regenerate
   its screenshot via `scripts/doc-shots/` if one exists; `npm run doc:build && npm run doc:check`.
8. `npm test`, `npm run build:check`, `npm run lint:renderer`.

## 7. Decisions (settled in review, 2026-10-04)

The author accepted every proposal of the draft:

| # | Question | Decision |
| --- | --- | --- |
| D1 | Separator model | A `separatorAfter` flag per favourite; never on the last one. No free-standing separator items. |
| D2 | Running model not a favourite | Appended to the menu, ticked, in its own group after the favourites. |
| D3 | Footer | Three buttons: `Cancel` / `Save` / `Switch to <model>` (primary). |
| D4 | Default favourites | The six models of §3. |
| D5 | Accordion | Any number of sections open at once; single-model machine types are leaves. |
| D6 | Hardware sheet | The six groups of §4.2. Contention, port maps, ROM checksums and docs links are not in scope. |
| D7 | Other entry points | None in this plan: the menu item (and its accelerator) is the only entry point. A `select-machine` IDE command or a status-bar click can follow later. |
| D8 | Accelerator | `CmdOrCtrl+Shift+M` for "Select machine…". |

## 8. Implementation notes

| Piece | Where |
| --- | --- |
| Favourites data, defaults, normalisation | `src/common/machines/machine-favorites.ts` |
| Setting | `SETTING_EMU_MACHINE_FAVORITES` (`emuOptions.machineFavorites`, type `array`) |
| Menu | `src/main/machine-types-menu.ts`; wired in `app-menu.ts` (`selectMachineType`, `applyMachineSelectResult`) |
| Dialog contract | `src/common/messaging/machine-select-dialog.ts` |
| Hardware facts | `src/common/machines/hardware-specs.ts` |
| Dialog | `src/renderer/appIde/dialogs/machineSelect/` (Model, ViewModel, View, Dialog, scss) |
| Star colour | L1 `FAVORITE` → L2 `--mark-favorite` → L4 `--color-favorite` |
| Icons | `star`, `star-filled`, `grip-vertical`, `arrow-up`, `arrow-down`, `separator-horizontal` (Lucide) |
| Tests | `test/machines/machine-favorites.test.ts`, `test/main/machine-types-menu.test.ts`, `test/machines/hardware-specs.test.ts`, `test/machines/hardware-specs-cores.test.ts` (e2e-cores), `test/dialogs/machineSelect/` |
| Docs | `docs/content/machine-types.mdx` — "Choosing a machine" |

Deviations from §5.1b: the hardware-spec drift test covers the ZX Spectrum 48K/128K (e2e, cores
loaded), the +2E/+3E and the C64 (unit tier: they report timing without a loaded core); the ZX80/81
and Z88 figures are imported from their machine-info constants. The Next's timing is mode-dependent
and has no single value to check, so its sheet shows "—" / "50 or 60 Hz" with a note.
