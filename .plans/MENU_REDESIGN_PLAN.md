# Menu Redesign And Settings Dialog — Plan

Status: **implemented** (deviations from the design below are in §10) · Mockup: [`mockups/menu-redesign.html`](mockups/menu-redesign.html) (interactive:
switch the focused window, the machine and the platform; compare today's menu with the proposal)

## 1. Problem

The native menu (`src/main/app-menu.ts`, plus the per-machine renderers in
`src/main/machine-menus/`) grew one feature at a time. Every feature added its own items, and almost
every preference was added as a checkbox. Measured in the mockup, which models the real menu:

| Scenario | First-level items, all menus | Commands reachable | Machine menu, first level | View menu, first level |
| --- | --- | --- | --- | --- |
| ZX Spectrum 48K, emulator focused | 83 | 182 | 28 | 19 |
| ZX Spectrum Next, emulator focused | 87 | 232 | 30 | 19 |
| ZX Spectrum Next, IDE focused | 81 | 224 | 30 | 15 |
| **Proposed**, ZX Spectrum Next | **61** | **125** | **11** | **12** |

What makes it hard to use, not just long:

1. **Duplicates.** File has Load/Save ZX Spectrum Snapshot, Play RZX Recording, Load/Save Machine
   State; Machine has Load/Save Snapshot, RZX › Play Recording, Load/Save State, and on the Z88 Open
   Z88 Snapshot. Six entry points for “open a file the emulator understands”, while drag-and-drop
   already does it with one handler (`droppedFileAction`, see `useEmuFileDrop.ts`).
2. **Two jobs in one menu.** Machine mixes running, debugging, device media, input, hardware
   hotkeys, ROM configuration, display preferences and three kinds of recording.
3. **Preferences posing as commands.** Editor Options (~35 leaves), Panel Options, Theme (12 items),
   Screen Zoom Steps, Scanline Effect, ROM files, Z88 keyboard layout/LCD, Recording format, quality
   and fps, IDE + Emulator recording options, IDE Settings — set once, read through every time.
4. **The same control in three places.** Instant screen, beam position, keep-on-top and sync
   breakpoints are menu checkboxes *and* toolbar buttons; the Next Layers submenu (16 items)
   duplicates the Layers strip, which has every one of those controls.
5. **Loose device items.** A Pentagon gets Rewind Tape, Select Tape File, Eject Tape, Create Disk
   File, Boot Disk, Floppy Disks ▸ and TR-DOS ROM ▸ as seven siblings at the first level.
6. **The IDE menu is a grab bag**: two view toggles, the Go submenu, BASIC listing, Integrations and
   three IDE settings.

## 2. Principles

- **P1 — A menu holds commands; a dialog holds preferences.** If a user sets it once and forgets
  it, it goes to Settings. If it acts now, or is toggled during a session, it stays.
- **P2 — One home per command.** No item appears in two menus. A command may *also* have a toolbar
  button or a status-bar affordance; the menu stays the keyboard and discoverability path.
- **P3 — Toggle a part of the window where that part is.** Status-bar extras from the status bar,
  layout from the layout, layers from the Layers strip.
- **P4 — One submenu per device.** The running machine contributes `Tape ▸`, `Disks ▸`,
  `SD Card ▸`, `Cartridge ▸`, `Input ▸` and a `<machine name> ▸` for its own hardware actions —
  never loose items.
- **P5 — No behaviour change.** Every command keeps its handler, its id where tests use it, and its
  accelerator. This is a reorganisation, not a rewrite.

## 3. The proposed menu

Accelerators shown are today's; nothing is re-bound. `[emu]`/`[ide]`: shown only while that window
has focus (today's `boundTo` rule). Machine-specific entries in *italics*.

```
Klive (macOS)   About Klive · Settings… ⌘, · Hide · Hide Others · Show All · Quit Klive

File            New Project… · Open Folder… · Open Recent ▸
                ─ Open File… ⌘O                         ← snapshot/state/RZX/tape/disk/cartridge/program
                  Save Snapshot… · Save Machine State…
                ─ Quick Save State ⌘⌥S · Quick Restore State ⌘⌥L
                ─ Close Folder
                ─ Settings… Ctrl+,  · Exit              (Windows/Linux)

Edit            (macOS roles, unchanged)

View            Machine Views ▸  Memory · Disassembly · *BASIC Listing* · *Copper List* ·
                                 *Sprite / Tilemap / Layer 2 Inspector* · *Layers*
                ─ [emu] Toolbar · Status Bar · Virtual Keyboard
                  [emu] Fit Window to Screen · Fit Window to Screen at 1x · Show IDE
                  [ide] Toolbar · Status Bar · Sidebar · Command and Output
                ─ Go Back ⌃- · Go Forward ⌃⇧-          (both windows: the accelerators matter)
                ─ Actual Size · Zoom In · Zoom Out · Toggle Full Screen
                ─ Switch to Light/Dark Theme
                  Toggle Developer Tools              (when devTools.allow)

Machine         Machine Type ▸  favourites… · Select machine… ⇧⌘M
                ─ Start F5 · Pause ⇧F5 · Stop F4 · Restart ⇧F4
                ─ Speed ▸ · Sound ▸
                ─ *Tape ▸*  Insert Tape… · Rewind · Eject · Fast Load
                  *Disks ▸* Insert A… · Insert B… · Create Disk File… · Boot A · Save A as .trd… ·
                            Eject A/B · Write Protect A/B
                  *SD Card ▸* Select Image… · Use the Default Image · Reset the Default Image…
                  *Cartridge ▸* Insert/Change Cartridge… · Eject
                  *Program ▸* (ZX80/81) Select Program File… · Load and Run · Rewind · Eject
                  Input ▸   *Joystick ▸* · *Capture the Mouse* · Input Settings…
                  *ZX Spectrum Next ▸* F1 Hard Reset … F10 DivMMC NMI
                  *Cambridge Z88 ▸*    Soft Reset · Hard Reset · Both SHIFT Keys · Battery Low
                ─ Record ▸  Start/Stop Video Recording · Pause/Continue
                            Start IDE + Emulator Recording ⌘⇧R
                            *RZX: Record · Stop and Save… · Insert Rollback Point · Roll Back ·
                            Render to Video…*
                            Recording Settings…

Debug (new)     Start Debugging Ctrl+F5
                ─ Step Into · Step Over · Step Out · Step Over Line
                ─ *Step Copper*
                ─ Sync Source with Breakpoint · Debugger Settings…

Build           (project build tasks, unchanged)

Help            About Klive (Win/Linux) · Klive IDE Home Page · Welcome Screen
                *Cambridge Z88 Resources ▸*  (today's seven loose help links)
```

The **IDE menu is removed**: every item found a better home (§6). The menu count stays at eight
(IDE out, Debug in), but no menu exceeds 12 first-level items.

## 4. The Settings dialog

One dialog, `Ctrl+,` / `⌘,`, opened from Klive › Settings… (macOS), File › Settings… (Windows,
Linux), the “… Settings…” items in Input, Record and Debug (which open on their page), and a new
`settings [page]` IDE command.

### 4.1 Pages

| Page | Contents | Replaces |
| --- | --- | --- |
| General | Open last project · Close emulator with IDE · Record tab switches · Excluded items (Manage…) | IDE › IDE Settings, File › Manage Excluded Items |
| Appearance | Tone · Accent swatches · Panel font family/size · Sidebar position · Command & Output position · Maximize | View › Theme, Panel Options, sidebar/tool-area layout items |
| Editor | Font family/size · whitespace · tab size · insert spaces · detect indentation · autocomplete · suggestion delay · highlights · background compile | View › Editor Options |
| Emulator | Zoom steps · scanline effect · instant screen · beam position · keep on top · status-bar extras · fast load | View screen/window items, Machine › Scanline Effect |
| Debugging | Interrupt stepping · Just My Code · stop at runtime errors · sync source · group breakpoints | View › Sync…; settings only reachable by command today |
| Machine | ROM files (48K, TR-DOS, Scorpion, Timex ×3) · Next SD card · Z88 keyboard layout, LCD | Machine ROM submenus, Z88 submenus, SD-card default items |
| Input | Key mapping file · joystick bindings (Configure…) · mouse capture/pointer/sensitivity | Machine › Select/Reset Key Mapping, Joystick › Configure, Mouse ▸ |
| Recording | Video format/quality/half fps · IDE + Emulator position/pointer/clicks/HiDPI | Machine › Recording preferences |
| Integrations | SjasmPlus (Configure… opens the existing dialog) · Allow developer tools | IDE › Integrations |

The Machine page lists every machine's options, the running machine's group first. A search box
filters across all pages (title, description and the “was:” menu path, so muscle memory finds the
new place).

### 4.2 Behaviour

- **Live apply**, exactly like the menu checkboxes today: each control writes through
  `setGlobalSettingsValue` / the existing action. Footer: “Reset Page to Defaults” and Close.
  No OK/Cancel — there is no draft state to discard, which keeps the controller trivial.
- Opens in **the focused window** (IDE or emulator), like the Select Machine dialog does today
  (`ideFocus ? getIdeApi() : getEmuApi()).displayDialog(...)`), so it works with the IDE hidden.
- Options that restart the machine (Z88 LCD, a ROM change) say so in their description and go
  through the same code path as the menu item they replace.

### 4.3 Generated from the settings registry

`src/common/settings/setting-definitions.ts` already holds a title, type, default and `boundTo` for
every setting. Extend `Setting` (`@abstractions/Setting`) with optional presentation metadata:

```ts
ui?: {
  page: SettingsPageId;            // "general" | "appearance" | ... | "integrations"
  group: string;                   // "Theme", "Indentation", ...
  order?: number;
  description?: string;
  editor?: "switch" | "select" | "file" | "segmented" | "custom";
  options?: { label: string; value: unknown }[];   // reuse ZOOM_STEPS, EDITOR_FONT_SIZES, ...
  machines?: string[];             // Machine page: which machines the option applies to
  replaces?: string;               // the old menu path, for search
}
```

Entries whose title is in parentheses (internal state such as sidebar width) get no `ui` and never
appear. The option ladders already shared with the menu (`font-sizes.ts`, `monospace-fonts.ts`,
`zoom-steps.ts`, `accents.ts`, `mouse-capture.ts`) feed the selects, so the dialog and any remaining
menu cannot drift.

Values that live in **app state rather than settings** — recording format/quality/fps, the
IDE + Emulator recording options, key mappings, theme/accent — get small adapters
(`{ read(state), write(dispatch, value) }`) registered next to the page model. Converting them to
real settings is a possible follow-up, not part of this plan.

### 4.4 Structure

Model/Controller/View, per `.ai/ui-mvc-guide.md` and `.docs/dialog-mvc-pattern.md`, reference
`src/renderer/appIde/dialogs/sjasmplus/`:

- `src/common/settings/settings-pages.ts` — page ids, titles, order; `buildSettingsPageModel()`
  (pure: registry + adapters → pages/groups/rows; search filter). Unit-tested.
- `src/renderer/appIde/dialogs/settings/` — `SettingsDialogController.ts`, `SettingsDialog.tsx`,
  row editors built on the existing `Checkbox`, `Dropdown`, `TextInput` and `DialogRow` controls.
- Registered in both `ideDialogRegistry.tsx` and `emuDialogRegistry.tsx`; new `SETTINGS_DIALOG` id
  in `@messaging/dialog-ids`.
- Styling from the token layers only (no literals); record the durable rule in
  `.ai/ui-theming-intent-and-lessons.md` per the standing instruction.

## 5. Controls that move into the window

| Control | Where | Notes |
| --- | --- | --- |
| Sound level | Emulator toolbar: the mute button gains a caret and a five-step slider | `ViewControls.tsx`; reuse the `StartModeSelector` dropdown pattern |
| Recording kinds | Emulator toolbar: the record button's dropdown — Video, IDE + Emulator, RZX, Recording Settings… | Start/stop behaviour of the plain click unchanged |
| Machine type | Status bar machine name → favourites + Select machine… | `EmuStatusBar.tsx` |
| Speed | Status bar MHz → clock multiplier list | |
| Status-bar extras | Status bar context menu: performance info, media strip, Layers strip, hide status bar | `ContextMenu` control exists |
| Sidebar side | Activity bar context menu: Move Sidebar to the Right/Left | |
| Tool area | Header buttons: Move to Top/Bottom, Maximize/Restore | Only where not already present |
| Next layers | The Layers strip (already complete) | Menu submenu removed |
| Clear navigation history | The navigation dropdown on the IDE toolbar | `NavigationControls` |

## 6. Where every item goes

The mockup's last table is the authoritative per-item mapping. Summary:

- File gains **Open File…** (one dialog, all emulator file types, routed by `droppedFileAction`),
  Quick Save/Restore State (from Machine). Loses the load duplicates and Manage Excluded Items.
- Machine loses debugging (→ Debug), loose device items (→ device submenus), ROMs and Z88 setup
  (→ Settings › Machine), Layers (→ strip), inspectors (→ View › Machine Views), recording
  preferences (→ Settings › Recording), Scanline Effect (→ Settings › Emulator), key mapping
  (→ Settings › Input), save/load state and snapshot duplicates.
- View loses Editor/Panel Options, Theme, Zoom Steps, status-bar extras, layout options and the
  items already on the toolbar; gains Machine Views, Go Back/Forward and one theme toggle.
- IDE menu dissolves into View (views, Go), Settings (Integrations, IDE Settings).

## 7. Implementation phases

Each phase ships on its own and leaves the app consistent.

### Phase 1 — Regroup the native menu (no new UI)

1. Split `setupMenu` into one builder per top-level menu (`src/main/menus/file-menu.ts`,
   `view-menu.ts`, `machine-menu.ts`, `debug-menu.ts`, `help-menu.ts`), each a function of a
   `MenuContext` (state, windows, focus, settings reader). `app-menu.ts` keeps assembly, the
   signature cache, `dimMenu` and the per-window install. This alone makes each menu unit-testable,
   like `machine-types-menu.ts` already is.
2. New **Debug** menu; move run-with-debugging, steps, Step Copper, Sync Source.
3. **File › Open File…**: an open dialog with the union of filters, then the existing
   `droppedFileAction` route. Remove the duplicates from File and Machine.
4. Extend `MachineMenuInfo` with `deviceMenus` (`tape`, `disks`, `sdCard`, `cartridge`, `program`,
   `input`, `hardware`) so renderers return grouped submenus instead of flat items; convert each
   renderer in `machine-menus/`. `machineItems` stays for anything not yet converted, then goes.
5. Merge Machine › Recording and RZX into Machine › Record (actions only for now; preferences stay
   in it until Phase 2).
6. Move the IDE menu's views into View › Machine Views, Go into View; delete the Layers submenu.
7. Update `test/main/*-menu.test.ts` (window recording, machine types, Next joystick/mouse, +3
   disk) for the new paths; add a test per new builder asserting the first-level shape for 48K,
   Pentagon, Next and Z88, and that **every accelerator present today is still present**.

### Phase 2 — Settings dialog

1. `ui` metadata on the setting definitions; `settings-pages.ts` page model + adapters + search,
   unit-tested (every setting with a `ui` lands on exactly one page; no internal setting appears).
2. MVC dialog, registered in both windows; `SETTINGS_DIALOG`; `settings [page]` command;
   `Ctrl+,`/`⌘,` accelerator; Settings… in the app/File menu.
3. Remove from the menu everything §4.1 lists. Keep View › Switch Theme, Input ›/Record ›/Debug ›
   “Settings…” items that open their page.

### Phase 3 — In-window controls

The §5 table, one PR per surface (emulator toolbar, emulator status bar, IDE activity bar / tool
area). Each control calls the same action or command the menu item calls.

### Phase 4 — Documentation

21 pages in `docs/content/` cite menu paths (`Machine | Select Tape File`, `Machine › Recording`,
`IDE | Show BASIC Listing`, `View | Editor Options`, …). Update them in the phase that moves the
item; add a “Settings” page and a short “Where did it go?” table to the docs. Regenerate affected
screenshots with `scripts/doc-shots/` (`.ai/doc-screenshots-guide.md`). Verify with
`npm run doc:build && npm run doc:check`.

## 8. Risks

- **Accelerators live in the menu.** On macOS an accelerator only fires for an item that exists,
  is visible and is enabled. Go Back/Forward therefore stay in View for *both* windows (they make
  navigation work from the emulator window today), and the Phase 1 accelerator test guards every
  other one. Quick Save/Restore move with their accelerators.
- **`setupMenu` runs on every state change.** The builders must stay cheap and deterministic so the
  signature cache (`menuChanged`) keeps suppressing redundant `setApplicationMenu` calls (the macOS
  menu-bar flash).
- **Muscle memory.** Mitigated by P5 (no re-binding), the “was:” search in Settings, and the docs
  table. Release notes list the moves.
- **Machine-specific renderers** are touched in Phase 1 for every machine; the existing harness
  tests do not cover menus, so the per-machine shape tests in step 7 are required, not optional.

## 9. Open questions

1. Should **Speed** and **Sound** leave the Machine menu once the toolbar/status-bar controls
   exist? Recommendation: keep them — they are live, and keyboard users need a path.
2. **Open File…**: one dialog with all filters, or keep a separate “Play RZX Recording…” because
   playing is not loading? Recommendation: one dialog; RZX replay starts as dropping does today.
3. Should the IDE get its own **Edit** menu on Windows/Linux (for Go Back/Forward, find)? Not
   needed for this plan; noted.
4. Do recording preferences become real settings (persisted with the others) instead of app state?
   Cleaner, but a separate change.

## 10. Implementation notes

What was built, and where it differs from §3–§9. The differences are decisions made while
building, each for the reason given.

### Where the code is

| Piece | Location |
| --- | --- |
| Menu assembly, change detection, install | `src/main/app-menu.ts` (`createMenuContext`, `createMenuTemplate`, `setupMenu`) |
| One builder per menu | `src/main/menus/` — `file-menu.ts`, `view-menu.ts`, `machine-menu.ts`, `debug-menu.ts`, `help-menu.ts`, shared `menu-utils.ts`, `menu-context.ts` |
| Per-machine items | `MachineMenuInfo` (`devices`, `hardwareItems`, `viewItems`, `debugItems`, `recordItems`) in `src/common/machines/info-types.ts`; filled in `src/main/machine-menus/machine-menu-registry.ts` |
| File › Open File… and drops | `src/main/open-file.ts`, routed by `droppedFileAction` (which gained a `state` kind so a `.kls` gets the "load anyway?" prompt, dropped or opened) |
| Actions the renderers ask for | `src/main/ui-actions.ts`, reached through `MainApi.runUiAction`; ids in `src/common/settings/ui-action-ids.ts` |
| Settings content (pure) | `src/common/settings/settings-pages.ts` |
| Settings dialog (MVC) | `src/renderer/appIde/dialogs/settings/`, registered in both dialog registries as `SETTINGS_DIALOG`; `settings [page]` IDE command |
| Speed and sound values | `src/common/machines/emulator-levels.ts`, `src/main/emulator-preferences.ts` |
| In-window controls | `controls/ViewControls.tsx` (sound and recording dropdowns), `appEmu/StatusBar/EmuStatusBar.tsx` (machine name, MHz, right-click menu), `appIde/ActivityBar/ActivityBar.tsx` (right-click menu) |

Tests: `test/main/app-menu-structure.test.ts` (menus per machine and window, the ≤12 rule, every
shortcut), `test/settings/settings-pages.test.ts`, `test/dialogs/settings/` (controller journeys
and a StrictMode wiring test), plus the updated menu tests in `test/main/`.

### Deviations

- **Settings rows are one table, not `ui` metadata on each setting (§4.3).** A row's value is not
  always a registered setting: the theme, the recording preferences, the Z88's LCD and the 48K ROM
  live in the app state, and file rows run actions. One table in `settings-pages.ts` holds all
  three kinds and shows each page's order at a glance; registered settings still supply their
  defaults.
- **Settings › Machine shows only the running machine's options.** Choosing a ROM rebuilds the
  *running* machine, so offering another machine's ROM would restart the wrong one.
- **The SD card stays in Machine › SD Card** and is not in Settings: its items act on the card now
  (and need a stopped machine), so they are commands.
- **The mouse keeps its submenu in Machine › Input** (capture, pointer, sensitivity) and is also on
  Settings › Input: capture is toggled during a session.
- **⌘O and ⌘, are macOS-only.** Elsewhere they would be Ctrl+O and Ctrl+, — and the emulator reads
  Ctrl as a machine key (the Z88's Diamond), so a menu accelerator would swallow key combinations
  the guest needs. Windows/Linux reach both from the File menu.
- **View › Zoom is a submenu** (Actual Size, Zoom In, Zoom Out; shortcuts unchanged), which keeps
  View at twelve first-level items with every part of the window listed.
- **The Next shows no Speed** submenu: it sets its own CPU speed (`MF_ALLOW_CLOCK_MULTIPLIER`), as
  before.
- **Developer tools stay a settings-file option** (`devTools.allow`); a switch in the dialog would
  advertise a developer aid to every user.
- **The toolbar's recording dropdown** offers IDE + Emulator recording and Recording Settings…; RZX
  stays in Machine › Record, where its enablement rules are.
- **Settings closes itself before opening another dialog** (SjasmPlus, Excluded Items, joystick
  bindings): one dialog is shown at a time.

### The open questions (§9), answered

1. Speed and Sound stay in Machine — live values with a keyboard path.
2. One Open File… dialog; `.rzx` plays as a dropped file does.
3. No Edit menu off macOS.
4. Recording preferences stay in the app state; the Settings rows write them through `set:` actions.

### Scripts and docs

`scripts/z88-app-pass.cjs` sets the Z88's LCD and keyboard layout through Settings › Machine;
`.ai/doc-screenshots-guide.md` says so. 35 pages under `docs/content/` were updated, and
`docs/content/working-with-ide/settings.mdx` is new (with a "Where Did It Go?" table). Screenshots
showing the old menus have not been regenerated.
