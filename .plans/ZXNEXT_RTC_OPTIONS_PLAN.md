# ZX Spectrum Next: Real-Time Clock Options — Implementation Plan

**Status:** proposed 2026-11-03, revised the same day: the options moved from a Machine-menu submenu to
the Settings dialog's Machine page (mockup: `.plans/ZXNEXT_RTC_OPTIONS_MOCKUP.html`). **D1-D8 confirmed
by the project author, 2026-11-03.** **Implemented 2026-11-03 (P0-P6)**, uncommitted at the time of
writing; see "As built" at the top of P1 for where it differs from the text below.
**Goal:** two options for the Next's DS1307: what its clock follows (the host's clock, or emulated
time), and whether it keeps its time and its 56 bytes of RAM from one session to the next, like the
battery on a real board. Plus a way to reset a kept clock.

---

## 0. Where things are today (survey, 2026-11-03)

The DS1307 is emulated and works: the NextZXOS menu shows the date and time on both models (checked
headless and in the running IDE, 2026-11-03).

| Concern | Where | Today |
|---|---|---|
| Bus and chip | `zxNext/wasm/zxnext/zxnext-i2c.c` | Bit-banged I2C on `$103B`/`$113B`, DS1307 at `$68`: time registers 0-6, control, 56 RAM bytes, pointer wrap, CH stops the clock, 12/24-hour, time copied at START. No reset touches it. |
| Time base | `zxnext-i2c.c` `zxnextRtcSync`, `zxnext-clock28.c` | The machine's 28 MHz clock: one second per 28M clocks, caught up on each START or write. **Emulated time.** |
| Seeding | `ZxNextWasmV2Machine.setup()` (`zxnextRtcSetTime(...rtcRegistersFromDate(new Date()))`) | The host's time at every machine setup. The RAM starts at zero. |
| Shared arithmetic | `zxNext/nextRtc.ts` | BCD, `rtcRegistersFromDate`, `rtcAdvanceOneSecond` (mirrors the C counter chain). |
| Tests | `test/zxnext-hw/i2c/i2c-rtc.test.ts` (I2C-001-006), `test/zxnext-hw/sd/nextzxos-boot.test.ts` | Harness `setRtcTime`; deterministic, emulated time. |
| Where options go | `src/main/menus/machine-menu.ts` header; `src/common/settings/settings-pages.ts` | The Machine menu is for actions; set-once options of the running machine are rows on the **Settings dialog's Machine page** (`page: "machine"`, `when: { kind: "machine", machineIds: [MI_ZXNEXT] }`), opened by Machine › Configure ZX Spectrum Next... The Next has one row there today, `nextAudioOutput` (group Sound). |
| Live option pattern | `SETTING_EMU_NEXT_AUDIO_OUTPUT` (`setting-const.ts`, `setting-definitions.ts`: `saveWithIde`, `boundTo: "emu"`); `EmulatorPanel.tsx` ~504 | An app setting, saved with the user's IDE settings; the emulator panel watches it (`useGlobalSetting`) and pushes it into the running machine with `setMachineProperty`. No restart. |
| Row sources and buttons | `SettingsRowSource` (`setting` or `state`), `SettingsStateKey`; `ui-action-ids.ts` + `main/ui-actions.ts` (e.g. `rom:esxdos:forget`) | A row reads an app setting or an app-state key; **nothing reads machine config (`MC_*`)**. Buttons run UI actions in main; `needsValue` enables a button only while the row has a value (it stays visible, disabled). A row's `describe(env)` sees only the platform and the UI language, not app state; a `file` row shows its value as text (`displayValue`). Search matches the title, description, group and page. |
| Emu → main | `src/common/messaging/MainApi.ts` (`getSdCardInfo`, `writeSdCardSector`) | The pattern for the emulator asking the main process to read or write a file. The emulator's `FileProvider` cannot write. |
| Klive home | `getKliveHomeBase()` / `KLIVE_HOME_FOLDER` (`zx-next-menus.ts` builds the SD working copies there) | Where per-user machine state lives. |

**What differs from a real Next:**

1. **The clock runs on emulated time.** A real DS1307 counts on its own 32.768 kHz crystal whatever the
   Next does. Here it stops while the debugger pauses the machine, runs fast when the emulator runs
   faster than real time, and falls behind when it cannot keep up.
2. **Nothing survives the session.** A time set with `.time`/`.date` (or any program) and the 56 RAM
   bytes are gone after a restart: setup reseeds from the host and the RAM is zero.

---

## 1. Decisions (confirmed 2026-11-03)

**D1 — Two app settings, shown on Settings › Machine for the Next only.**
- `SETTING_EMU_NEXT_RTC_CLOCK = "emuOptions.nextRtcClock"`: `"host"` (follows the host's clock) or
  `"emulated"` (counts emulated time, today's behaviour).
- `SETTING_EMU_NEXT_RTC_KEEP = "emuOptions.nextRtcKeep"`: boolean, keep the time and RAM between
  sessions.

Both are registered like `SETTING_EMU_NEXT_AUDIO_OUTPUT` (`saveWithIde: true`, `boundTo: "emu"`): they
belong to the user's setup, not to a project, as the battery belongs to the board. (The first draft made
them machine config keys, `MC_*`, saved with the project; a Settings row cannot read those, and the
clock is not a property of a project.)

**D2 — Defaults: host clock, keep on, for the user; off for the machine.** The settings default to
`"host"` and `true`: that is what a real Next does. The *machine* treats a property that was never set
as `"emulated"` and keep off, so the test harness, which has no emulator panel to push settings, stays
deterministic and writes no file without any change to `createCore`.

**D3 — The core stays cycle-driven.** Nothing in `zxnext-i2c.c` reads the host clock. Host-clock mode
is TypeScript writing the time registers between frames, as an input from outside the machine. The
debug loop, checkpoints and replays stay deterministic: the core decides nothing new (README rule:
"the core decides whether to stop, TypeScript decides what a stop means"; no new stop candidate).

**D4 — Host-clock mode is an offset.** The clock's time is `host now + offset`, in whole seconds.
- The offset is 0 when seeded from the host, the stored one when kept (D5), and it is recomputed when
  the program writes any of registers 0-6 (a `.time`/`.date` sets the offset, and the clock then
  follows the host from there).
- At the end of a frame, at most once per host second, TypeScript compares registers 0-6 with
  `host now + offset` and rewrites them when they differ by a second or more. So the clock jumps
  forward after a debugger pause, and back after the emulator ran ahead of real time.
- Registers keep their modes: the 12/24-hour bit (and AM/PM), and the program's day-of-week numbering
  (the DS1307 only counts day of week, so the difference between the program's value and the computed
  one is kept as part of the offset).
- CH set (the program stopped the oscillator): no sync, the registers stay as the program left them;
  clearing CH recomputes the offset.
- No sync while the machine replays (step back, execution-history replay, RZX playback, checkpoint
  restore before its first frame); P0 finds the flags for these.

**D5 — Kept state lives in the Klive home, per model.** `~/Klive/zxnext-rtc.json`, one entry per Next
profile id (each model is its own board, as each has its own SD working copy):
`{ version: 1, profiles: { "<profileId>": { offsetSeconds, dayOffset, hours12, stopped, stoppedRegs?,
control, ram /* 56 bytes, base64 */, savedAt } } }`.
- The offset is stored against the host clock in both modes, so the clock keeps running while the app
  is closed, as the battery keeps a real one running. In emulated mode the lag accumulated during the
  session is kept too; that is what emulated mode means.
- A stopped clock (CH) stores its registers, not an offset.
- The main process owns the file. The emulator loads through a new `MainApi` call in `setup()` and saves
  through another (the `getSdCardInfo` / `writeSdCardSector` pattern).

**D6 — When it saves.** The core counts writes to the DS1307 (a new export). At the end of a frame
TypeScript compares the count, and saves (debounced, about one second) when it changed. It also saves
when the machine is disposed (machine switch, app quit), which catches the emulated-mode lag. With
keep off, nothing is read or written: setup seeds from the host, the RAM starts at zero (today).

**D7 — Changes apply live; nothing restarts the machine.** The emulator panel pushes both settings
with `setMachineProperty`, as it does the sound output (`EmulatorPanel.tsx` ~504). A Settings change
that silently restarted the machine would surprise; the first draft's restart came from the
machine-config route (`setEpConfig`, `setTvcHbf`), which D1 drops.
- **Clock mode, live.** Switching never changes the time the clock shows: to host, the offset is
  recomputed from the current registers and the clock follows the host from there; to emulated, the
  sync stops and the counters run on. Getting the real time back is the Kept clock row's job (D8).
- **Keep, live.** Turning it on saves at once (the current clock becomes the kept one). Turning it
  off stops loading and saving; the stored entry stays until *Forget*, and is overwritten if keep is
  turned on again.
- **At setup**, keep on and an entry for the model: load it; otherwise seed from the host (today).

**D8 — A "Kept clock" row with two buttons.** New in this revision (mockup row 3):
- *Set to host time*: the clock shows the host's time now (offset 0, day-of-week offset 0) and, with
  keep on, saves. It works in both modes, so it is also the way back to the real time in emulated mode.
- *Forget*: deletes the model's entry and zeroes the 56 RAM bytes of the running clock; the time is
  then seeded from the host. Enabled only while an entry exists (`needsValue`).
- The row shows when the entry was last saved and for which model ("Last saved 3 Nov 2026, 10:42 ·
  ZX Spectrum Next (KS2, core 3.02.01)"), from a new app-state key `nextRtcKept` (the active model's
  entry, or undefined) that the main process sets whenever it loads, saves or forgets an entry. A
  `describe` cannot read app state, so P0 picks the way to show it: the row's value as text (as the
  `file` rows do, which needs an editor that shows a value without the file formatting), or a
  `describe` that also receives app state.
- The buttons act on the running machine, so they reach it from main through the emulator API
  (`getEmuApi()`), the way the menu's machine commands do.

---

## 2. Phases

### P0 — Survey (no code)

- Find how `ZxNextWasmV2Machine` knows it is replaying: step back (`lite-step-back`), execution-history
  replay, RZX playback, checkpoint restore. D4's sync must skip all of them.
- Find the dispose / app-quit path the machine sees (for D6's final save) and confirm it can still send
  a `MainApi` message then.
- Confirm how a Settings button's UI action can reach the running machine (D8): an existing
  main → emulator call that fits, or a new `EmuApi` method.
- Choose how the Kept clock row shows its last-saved text (D8): a value editor, or app state for
  `describe`.
- Record the findings as an "As built" note at the top of P1.

### As built (2026-11-03): P0's findings and the differences from this plan

- **Replays need no flag of their own.** Every write the host side makes goes through a journaled export
  (`zxnextRtcSetTime`, `zxnextRtcSetRegister`: the `Rtc` noun in `reverse/exportContract.ts`), and the
  reads are pure (`Peek`/`Get`). A reverse-debugging replay calls the raw frame export with the journal
  muted, so `NextRtcHost.beforeFrame` (called from `executeMachineFrame`) never runs during one; the
  journal applies the recorded writes where they happened. After the core changed under the machine
  (`restoreHostState`, `loadMachineState`) and when live input resumes (`invalidateHostSync`), the host
  side only takes the write counts again (`rebase`): what the bus wrote there was saved when it happened.
  `customCommand` clears the history cursor before the Kept clock buttons act (D12 of the reverse
  debugging plan).
- **D6's save on dispose is replaced by a drift check.** No machine is ever disposed (`dispose()` has no
  caller), and an app quit cannot wait for an emulator-to-main message. A host-following clock changes
  its kept state only through bus writes, which are saved a second after the last one; an emulated
  clock that is kept is compared with its kept offset every 30 s while frames run and saved when it moved
  two seconds or more. At most 30 s of emulated-time lag can be lost at a quit.
- **D5's entry shape:** `{ time?: { offsetSeconds, dayOffset, hours12 }, regs, control, ram, savedAt }`
  (`src/common/zxnext/nextRtcKept.ts`): `time` is absent for a stopped clock or a time that is no valid
  date, and `regs` (always saved) then loads as it was. On disk the RAM is base64; a file of another
  version, a broken file or an invalid entry holds nothing for that model.
- **The host side is one class**, `NextRtcHost` (`zxNext/nextRtcHost.ts`); the machine delegates to it.
  Two more machine properties beside D1's: `NEXT_RTC_STORE` (the load/save port, wired by
  `MachineService` to `MainApi.getNextRtcState`/`saveNextRtcState`) and `NEXT_RTC_HOST_CLOCK` (a fake
  clock for tests). `MachineService` sets the clock's options and the store *before* `setup()`, because
  the clock is seeded there and the emulator panel's effect runs only after the machine is published.
  Nothing is read, followed or saved before the clock is seeded (turning keep on before setup would
  otherwise save an empty chip).
- **Forget** leaves nothing to save until the program writes the chip again (otherwise the drift check
  would recreate the entry at once); **Set to host time** saves at once when keep is on.
- **D8's text:** a row gets `describeValue(value, appState)`, which wins over its description; the
  Kept clock row's value is the running model's entry from `nextRtcKept`, an app-state record of every
  kept entry's save time by model (so a model switch needs no new dispatch). Main publishes it at startup
  and after every save and forget.
- **Tests:** `test/zxnext-hw/i2c/rtc-host.test.ts` (P1, P3, P4 on the real core, fake host clock and
  store), `test/zxnext-shared/nextRtc.test.ts` (P2), `test/main/zxnext-rtc-store.test.ts`,
  `test/settings/settings-pages.test.ts` and `test/dialogs/settings/settings-rtc-rows.test.ts` (P5). The
  I2C driver moved to `test/zxnext-hw/i2c/_i2c-helpers.ts`, shared with `i2c-rtc.test.ts`. The harness
  gained `rtcRegister`, `rtcWriteCounts`, `setRtcOptions`, `rtcCommand` and the `rtc` session option.
  The panel's effect (a changed setting reaching `setMachineProperty`) has no unit test: it was checked in
  the running IDE.
- **Checked in the running IDE** (doc-shots driver, scratch home): the page in both themes; the NextZXOS
  menu showing the host's time; a kept clock 25 hours ahead loaded at start (the menu showed the next
  day, an hour on); *Set to host time* writing `zxnext-rtc.json` and the row's "Last saved"; *Forget*
  emptying it and disabling itself. Not checked there, covered by the core tests: the catch-up after a
  debugger pause, and switching modes live.
- **P6:** the guide is a page of its own, `guides/next/real-time-clock.mdx`, plus three rows in the
  Settings page's Machine table; the `guides-next` recipe captures `next-models/rtc-settings.webp`. The
  RTC chapter's "In Klive" note is left to the author.

### P1 — Core: read the chip, count writes

`zxnext-i2c.c`, `ZxNextWasmV2Loader.ts`:
- `zxnextRtcGetRegisters(ptr)`: copies the 64 bytes (time, control, RAM) after a `zxnextRtcSync()`.
- `zxnextRtcSetRegisters(ptr)`: sets them all (load); the second restarts now.
- `zxnextRtcWriteCount()`: incremented on every register write from the bus.
- Rebuild both artifacts (`npm run build:zxnext-wasm`), `npm run check:zxnext-wasm-size`.
- Tests in `test/zxnext-hw/i2c/i2c-rtc.test.ts`: get/set round-trip; the count moves on a bus write and
  not on a read; a set keeps CH. `test/wasm/debug-loop-equivalence.test.ts` stays green (no core
  decision changed; the counter is written the same way on both paths).

### P2 — The clock model in TypeScript

`zxNext/nextRtc.ts` (pure, unit-tested in the `node` project):
- `rtcRegistersToSeconds` / `rtcRegistersFromSeconds` (2000-2099), keeping 12/24-hour and the
  day-of-week offset (D4).
- `rtcOffsetOf(regs, hostNow)`, `rtcTargetRegisters(offset, dayOffset, hours12, hostNow)`.
- Tests: round trips across month ends, leap years, 2099 → 2000, 12-hour noon/midnight, day-of-week
  numbering kept.

### P3 — Host-clock mode in the machine

`ZxNextWasmV2Machine.ts`:
- Two machine properties, `NEXT_RTC_CLOCK` and `NEXT_RTC_KEEP` (beside `NEXT_AUDIO_OUTPUT`), handled in
  `setMachineProperty` with D7's live switches; unset means emulated and keep off (D2).
- A machine property for the host clock (`() => number`, `Date.now` by default), so tests inject a fake.
- After `executeMachineFrame`, in host mode, at most once per host second and never while replaying:
  read registers 0-6, compare with the target, rewrite if a second or more apart (D4). On a changed
  write count with registers 0-6 touched, recompute the offset first.
- `setRtcToHost()` for D8's first button.
- Emulated mode: exactly today's path.
- Harness: a session option to set the two properties and a fake host clock.
- Tests (`test/zxnext-hw/i2c/`, e2e-cores tier, listed in `build/e2e-tests.ts`): after the fake clock
  moves an hour while no frames run, the next frame reads an hour later over I2C; a program-written
  time is kept as an offset and follows the host; the emulated clock run ahead is pulled back; CH stops
  syncing; 12-hour mode survives a sync; switching modes mid-run keeps the shown time (D7);
  `setRtcToHost` in emulated mode; unset properties behave as today (the existing tests).

### P4 — Keeping the clock between sessions

- Main: `src/main/` store module for `zxnext-rtc.json` (read, validate the version, write atomically,
  delete an entry); `MainApi`: `getNextRtcState(profileId)`, `saveNextRtcState(profileId, state)`. The
  store sets the `nextRtcKept` app-state key (D8) on load, save and forget.
- Emulator: `setup()` loads (keep on and an entry exists) instead of seeding from the host; saves on a
  changed write count (debounced), on dispose (D6) and when keep is turned on (D7).
- Tests: the store (temp home, `node` project): missing file, bad version, round trip, forget, other
  profiles' entries untouched, `nextRtcKept` follows. The machine with a mocked messenger: a bus write
  triggers one save; a load seeds time and RAM; keep off sends nothing; keep turned on saves once.

### P5 — The Settings rows

Layout as in the mockup: a **Real-time clock** group on Settings › Machine, right after Sound, for
`MI_ZXNEXT` only. No Machine-menu entry: the clock's mode is not switched mid-session, unlike the sound
output, which has both.
- `setting-const.ts` / `setting-definitions.ts`: `SETTING_EMU_NEXT_RTC_CLOCK` (string, `"host"`) and
  `SETTING_EMU_NEXT_RTC_KEEP` (boolean, `true`), `saveWithIde`, `boundTo: "emu"`; a small table for the
  two clock choices (`next-rtc-clock.ts`, like `next-audio-output.ts`, with `normalize...`).
- `settings-pages.ts`, three rows, `groupKey: "settings.group.realTimeClock"`:
  1. `nextRtcClock`: `editor: "select"`, *The clock follows*, options *The host's clock* / *Emulated
     time*; the description says what emulated time does under the debugger.
  2. `nextRtcKeep`: `editor: "switch"`, *Keep the time and the clock's RAM between sessions*; the
     description names `.time`/`.date`, the 56 bytes, and that each model keeps its own.
  3. `nextRtcKept`: *Kept clock*, source `state("nextRtcKept")`, showing the last-saved time and the
     model as P0 chose; buttons *Set to host time* (`rtc:next:host`) and *Forget*
     (`rtc:next:forget`, `needsValue`).
- `SettingsStateKey`: `"nextRtcKept"`; `ui-action-ids.ts` and `main/ui-actions.ts`: the two actions (D8).
- `EmulatorPanel.tsx`: watch both settings and push them, beside the sound output's effect.
- Search: the group title already makes "clock" find all three rows; put "RTC" and "date" in the
  first row's description so those find it too.
- i18n: `settings.group.realTimeClock`, `settings.machine.nextRtc*.title/description`,
  `common.nextRtcClock.*`, `settings.button.setToHostTime`, with translator context in
  `src/common/i18n/locales/en/`; `npm run i18n:keys`.
- Tests: the Settings view model shows the group for the Next and not for the 48K; *Forget* is disabled
  without an entry; searching "RTC" finds the group; a changed setting reaches `setMachineProperty` (the panel's effect).
- Check in the running IDE (the doc-shots driver, scratch `HOME` with a copied card): the page looks
  like the mockup in both themes; the NextZXOS menu shows the date and time; after `.time` and a restart
  the set time is still there; a 30 s debugger pause moves the clock 30 s on resume; switching to
  emulated and back keeps the shown time; *Set to host time* and *Forget* work.

### P6 — Docs and release

- The Next's guide page in `docs/content/en/guides/` describes the three rows (prose check rules
  apply); a `guides-*` doc-shots recipe captures the Settings page.
- The RTC chapter (`under-the-hood/emulator-internals/next-rtc.mdx`) gets a short "In Klive" note if
  the author wants one (author's voice, `.ai/hardware-articles-guide.md`).
- `src/emu/machines/zxNext/wasm/README.md`: the new exports and D3; its "Known differences" entry on
  the clock's time base is updated.
- `.ai/ui-theming-intent-and-lessons.md` only if P5 needs a visual change beyond existing row editors
  (it should not).
- One `feature` changeset with the commit that completes the plan; `npm run test:slow` before it.

---

## 3. Verification

Focused tests per phase, then `npm run test:fast`, `npm run build:check`, `npm run lint:renderer`
(P5 touches `EmulatorPanel.tsx`), `npx electron-vite build --config build/electron.vite.config.ts`, and
P5's check in the running IDE.

## 4. Settled questions

Confirmed with D1-D8 (2026-11-03):

1. D2: the settings default to the host's clock with keep on; an unset machine property means
   emulated time with keep off.
2. D5: each Next model keeps its own clock.
3. D8: the Kept clock row has both buttons, *Set to host time* and *Forget*.
