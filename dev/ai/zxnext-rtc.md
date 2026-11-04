# The ZX Spectrum Next's real-time clock options

The Next's DS1307 (bit-banged I2C on `$103B`/`$113B`, address `$68`, `zxnext-i2c.c`) has two user
options on Settings › Machine (Next only, group *Real-time clock*): what the clock follows, and whether
it keeps its time and its 56 RAM bytes between sessions, like the battery on a real board. A third row
resets a kept clock. Built 2026-11-03 from a plan closed on 2026-11-04 (git history:
`.plans/ZXNEXT_RTC_OPTIONS_PLAN.md`). User guide: `docs/content/en/guides/next/real-time-clock.mdx`.

## Decisions (cited as D1-D8)

| # | Decision |
|---|---|
| D1 | **Two app settings**, registered like the sound output (`saveWithIde`, `boundTo: "emu"`): `emuOptions.nextRtcClock` (`"host"` or `"emulated"`) and `emuOptions.nextRtcKeep` (boolean). They belong to the user's setup, not a project, as the battery belongs to the board. |
| D2 | **Defaults: host clock and keep on for the user; off for the machine.** A machine property that was never set means emulated time and keep off, so the test harness stays deterministic and writes no file. |
| D3 | **The core stays cycle-driven:** nothing in `zxnext-i2c.c` reads the host clock. Host-clock mode is TypeScript writing the time registers between frames, an input from outside the machine; the core decides nothing new. |
| D4 | **Host-clock mode is an offset:** the time is `host now + offset` in whole seconds. The offset is recomputed when the program writes registers 0-6 (`.time`/`.date`), so the clock follows the host from there. At most once per host second, after a frame, registers 0-6 are rewritten when they differ from the target by a second or more (so the clock jumps forward after a debugger pause and back after the emulator ran ahead). The 12/24-hour bit and the program's day-of-week numbering are kept (`dayOffset`). With CH set (the oscillator stopped) there is no sync; clearing CH recomputes the offset. |
| D5 | **Kept state lives in the Klive home, per model:** `~/Klive/zxnext-rtc.json`, one entry per Next profile id. An entry is `{ time?: { offsetSeconds, dayOffset, hours12 }, regs, control, ram, savedAt }` (`src/common/zxnext/nextRtcKept.ts`; RAM base64 on disk). `time` is absent for a stopped clock or an invalid date, and `regs` then loads as it was. The offset is stored against the host clock in both modes, so a kept clock runs on while the app is closed. A broken file, another version or an invalid entry holds nothing for that model. The main process owns the file (`src/main/zxnext-rtc-store.ts`, `MainApi.getNextRtcState`/`saveNextRtcState`). |
| D6 | **When it saves:** the core counts bus writes to the chip (`zxnextRtcWriteCount`); a changed count saves about a second later. **No save on dispose** (no machine is ever disposed, and a quit cannot wait for a message): a kept emulated clock is instead compared with its kept offset every 30 s while frames run and saved when it moved two seconds or more, so at most 30 s of emulated lag is lost at a quit. Keep off reads and writes nothing. |
| D7 | **Changes apply live; nothing restarts.** The emulator panel pushes both settings with `setMachineProperty`. Switching modes never changes the shown time (to host: the offset is taken from the current registers; to emulated: the sync stops). Turning keep on saves at once; turning it off stops loading and saving and leaves the entry until *Forget*. At setup, keep on and an entry for the model loads it; otherwise the clock is seeded from the host. |
| D8 | **The Kept clock row**: *Set to host time* (offset 0, saved at once when keep is on; also the way back to real time in emulated mode) and *Forget* (deletes the model's entry and zeroes the running clock's RAM; enabled only while an entry exists). The row shows when the running model's entry was last saved, from the app-state record `nextRtcKept`, which main publishes at startup and after every save and forget; a row gets `describeValue(value, appState)` for this. The buttons are UI actions (`rtc:next:host`, `rtc:next:forget`) that reach the running machine through the emulator API. |

## How it is built

- **`NextRtcHost`** (`src/emu/machines/zxNext/nextRtcHost.ts`) is the host side; the machine delegates
  to it. Pure arithmetic is `nextRtc.ts` (BCD, registers to and from seconds for 2000-2099, offsets,
  targets).
- **Machine properties:** `NEXT_RTC_CLOCK`, `NEXT_RTC_KEEP`, `NEXT_RTC_STORE` (the load/save port, wired
  by `MachineService` to `MainApi`) and `NEXT_RTC_HOST_CLOCK` (a fake clock for tests). `MachineService`
  sets the options and the store **before `setup()`**, because the clock is seeded there and the
  emulator panel's effect runs only after the machine is published. Nothing is read, followed or saved
  before the clock is seeded (turning keep on earlier would save an empty chip).
- **Replays need no flag.** Every host-side write goes through a journaled export (`zxnextRtcSetTime`,
  `zxnextRtcSetRegister`: the `Rtc` noun in `reverse/exportContract.ts`) and reads are pure. A
  reverse-debugging replay calls the raw frame export with the journal muted, so
  `NextRtcHost.beforeFrame` (from `executeMachineFrame`) never runs during one. After the core changed
  under the machine (`restoreHostState`, `loadMachineState`) and when live input resumes
  (`invalidateHostSync`), the host side only re-takes the write counts (`rebase`). `customCommand` clears
  the history cursor before the Kept clock buttons act.
- **Forget** leaves nothing to save until the program writes the chip again (otherwise the drift check
  would recreate the entry at once).

## Tests

`test/zxnext-hw/i2c/rtc-host.test.ts` (the real core, a fake host clock and store),
`test/zxnext-shared/nextRtc.test.ts`, `test/main/zxnext-rtc-store.test.ts`,
`test/settings/settings-pages.test.ts`, `test/dialogs/settings/settings-rtc-rows.test.ts`. The I2C
driver is `test/zxnext-hw/i2c/_i2c-helpers.ts`; the harness has `rtcRegister`, `rtcWriteCounts`,
`setRtcOptions`, `rtcCommand` and the `rtc` session option. The panel's effect (a changed setting
reaching `setMachineProperty`) has no unit test; it was checked in the running IDE, as were the page,
the NextZXOS menu showing the host's time, a kept clock loaded at start, and both buttons. Covered by
the core tests rather than the IDE: the catch-up after a debugger pause and switching modes live.

## Open

- The RTC chapter (`under-the-hood/emulator-internals/next-rtc.mdx`) has no "In Klive" note; it is
  left to the author (author's voice, `dev/ai/hardware-articles-guide.md`).
