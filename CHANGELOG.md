# Klive IDE Changelog

## Unreleased

### New features

- **Copper and DMA regions in `.NEX` annotations:** mark a range of a popped-out bank as a Copper
  list or a zxnDMA program, and the listing shows it as `.copper` / `.dma` pragmas, with each
  instruction's meaning in the comment column. Every row reassembles to the bytes it shows, and the
  annotation file stays readable by older Klive versions.
- A pure zxnDMA program decoder (`src/common/zxnext/dma/dmaDecoder.ts`) that reads the byte stream
  the way the DMA does.

### Fixes

- Assembler: a bare `.dma wr3` followed by another line failed with "An expression expected".

## 0.63.0

### Highlights

- **New machines: the Sinclair ZX81 and ZX80**, on a cycle-accurate WebAssembly core, with `.p`/`.o`
  program loading, a virtual keyboard and the full debugger.
- **Klive BASIC: a built-in ZX BASIC compiler** with source-level debugging &mdash; compatible with
  Boriel ZX BASIC 1.19, needing no installation, and now the default (#1400).
- **BASIC editor intelligence:** hover, Go to Definition, references, completion, signature help,
  rename, outline and folding, across included files (#1415).
- **More powerful breakpoints:** conditions and hit counts, logpoints, one-shot breakpoints, memory
  range watchpoints, and DeZog `LOGPOINT` / `ASSERTION` / `WPMEM` comments (#1413, #1414).
- **Snapshots and machine states:** open, view, run, debug and save ZX Spectrum `.sna`, `.z80` and
  `.szx` snapshots; save and load `.kls` machine state files on every machine, with a quick
  save/restore slot; open and debug Cambridge Z88 `.z88` snapshots (#1409, #1418).
- **A new tape viewer** for `.tap`/`.tzx` files, and loading tapes straight from the IDE (#1410).
- **IDE + Emulator screen recording** of both windows into one video (#1409).
- **Cambridge Z88 brought closer to OZvm:** no more screen noise on the larger LCDs under OZ 5, card
  contents that survive card changes and resets, and SBF / 24-bit screen pointers in the Blink panel
  (#1417).
- **A no-installer Windows build** (#1382), and a searchable **Select machine…** dialog with
  favourites (#1418).

### Key fixes

- Cambridge Z88: the screen showed garbage below row 8 on the 640x256/320/480 LCDs under OZ 5, and
  inserting or removing a card (or a hard reset) erased what OZ had written to flash and EPROM cards.
- Tape files: several TZX block types, header names and turbo-block playback are fixed.
- `run-to` no longer deletes a user breakpoint at the same address.
- Clicking a toolbar button no longer takes keyboard focus away from the emulator.
- No more "Machine controller not available" errors while a machine is being rebuilt.

### Features

- **New machines: the Sinclair ZX81 and ZX80.** One WebAssembly core runs both: the ZX81 with 1K, 16K
  or 64K, in PAL or NTSC (Timex Sinclair 1000), and the ZX80 with 1K or 16K, or with the 8K ROM
  upgrade. The ULA is emulated cycle by cycle: SLOW and FAST modes, a jitter-free picture, and the
  hi-res (WRX) graphics programs build on it. Open a `.p`/`.81` (ZX81) or `.o`/`.80` (ZX80) program
  from *Machine → Select Program File...* or the Explorer, and *Load and Run* types `LOAD ""`, loads
  it (instantly with fast load, or in real time from its tape signal) and types `RUN`. The ZX81 has a
  virtual keyboard that follows the original's layout. The debugger works as on the other machines,
  and the disassembler decodes the ZX81 ROM's error codes and calculator literals. The ZX80 and ZX81
  ROMs ship with Klive; they are free for non-commercial use (see `zx8081-roms-readme.txt`).

- **Klive BASIC, a built-in ZX BASIC compiler** (#1400). It needs no installation and is now the
  default compiler. It is compatible with Boriel ZX BASIC 1.19: the same options and `#pragma`s, the
  standard libraries, the `zxbasm` inline-assembly dialect, and NextBuild's `CODEBANK` for the Next.
  Build options go in `'@name value` header lines. `.zxbas` files are recognised, and a new
  **zx-basic** project template is available for the 48K, 128K and Next. `set zxbasic.compiler zxbc`
  switches back to Boriel's `zxbc`.

- **Source-level BASIC debugging** (#1400). Step Into (with a **Step Into Target** drop-down), Step
  Over, Step Out and Step Over Line step BASIC statements, and a **Source / Z80** toolbar toggle
  switches the stepping mode. Breakpoints can be set on individual statements of a line. The Call
  Stack panel shows SUB/FUNCTION/GOSUB frames, with **Run to this frame**, and the Variables panel
  shows parameters, locals, globals and BASIC watch expressions. A run stops on a BASIC error. New
  commands: `em-src`, `em-err` and `em-jmc` (Just My Code). A NEX export writes
  `<name>.nex.kbasic-debug.json`, so `nex-run -d` debugs it at source level.

- **New assembler features** (#1400): `#LINE` remaps reported source locations, and the
  `.page <page>[, addr[, count]]` pragma places code in an 8K Next page.

- **BASIC editor intelligence** (#1415). Background checking drives hover (types, scope, signatures,
  keyword help), Go to Definition (F12, which also opens `#include` files), Find All References
  (Shift+F12), context-aware completion (choosing a library routine adds its `#include`), signature
  help, Rename (F2), the Outline (Cmd/Ctrl+Shift+O), folding and block highlights &mdash; all across
  included files. With `zxbc` selected, only the keyword-level features work.

- **Conditional breakpoints and hit counts** (#1413), on every breakpoint kind.
  `bp-set ... -hit <spec>` takes `10`, `>10`, `>=10`, `<10`, `<=10` or `*10`; `-if <condition>` (it
  must come last) takes an expression over registers, flags, `VAL`/`ADDR`, memory reads (`w[HL]`,
  `b[05:$C010]`), `page()`, `nr()` and build labels. The new `bp-reset-hits` command resets the
  counts, and `bp-list` prints lines you can paste back into `bp-set`. Conditions can also be edited
  in the breakpoint dialog and the editor margin's menu.

- **Logpoints** (#1414). `bp-set ... -log "x={A} at {PC:hex16}"` writes to a new **Log** output pane
  and keeps running; formats include `hex8`, `hex16`, `int8`, `uint16`, `bits` and `string`. A
  `[GROUP]` prefix puts a logpoint into a group; switch groups with `lp-en` and list them with
  `lp-groups`. The breakpoint dialog has an **Action** row, the margin menu has **Add Logpoint…**,
  and logpoints are drawn as diamonds. DeZog `; LOGPOINT` comments are read from the Klive assembler
  and from sjasmplus (which needs `SLDOPT COMMENT WPMEM, LOGPOINT, ASSERTION`).

- **DeZog `ASSERTION` and `WPMEM` comments** (#1414). A failing assertion stops the machine and
  reports the values it read; `WPMEM` becomes a memory watchpoint over a range. Both are on by
  default; switch them off per project with `as-en -d` and `wp-en -d`.

- **One-shot breakpoints** (#1414): Shift+click the margin or the disassembly gutter, choose **Stop
  Here Once**, or use `bp-set -once`. They are never saved with the project.

- **Memory range breakpoints and watchpoints** (#1414). `bp-set <addr> -r|-w -len <bytes>` watches a
  range. Watch view rows gain **Break on write/read/access**, which follows the symbol across
  rebuilds (shown as `WS:<symbol>`). `show-disass <address>` moves the Disassembly view to an address.

- **ZX Spectrum snapshots** (#1418). A new viewer for `.sna`, `.z80` (v1–3) and `.szx` files shows the
  screen, registers, ULA, paging, AY and RAM banks, and banks can be popped out. Run or debug a
  snapshot from its tab, the Explorer, **File → Load ZX Spectrum Snapshot...**, by dropping it on the
  Emulator window, or with `zx-snapshot <file> [-r|-d]`. Klive switches to the 48K, 128K or +2E/+3E
  the snapshot needs, and inserts the disks and tapes an `.szx` file links.

- **Saving ZX Spectrum snapshots** (#1418): **File → Save ZX Spectrum Snapshot...**, the Emulator's
  **Machine → Save Snapshot...**, or `zx-snapshot-save <file> [-f]`. The extension picks the format.
  Klive reports what `.z80`/`.sna` cannot store, and refuses a state those formats would load back
  differently.

- **Machine state files** (#1418). `.kls` files capture the whole machine on every machine &mdash; 48K,
  128K, +2E/+3E, Next, Z88, ZX80 and ZX81. Use **File → Save/Load Machine State...**, `state-save`, or
  `state-load [-r|-d] [-y]`; **Quick Save/Restore State** is Ctrl/Cmd+Alt+S and Ctrl/Cmd+Alt+L.
  `.kls` files have a viewer and can be dropped on the Emulator window. A ZX Spectrum state saved by
  another Klive version falls back to the `.szx` it embeds.

- **Select machine…** (Cmd/Ctrl+Shift+M, #1418): a searchable list of every model with its hardware
  details. A star marks a favourite, and favourites can be reordered.

- **Cambridge Z88 snapshots** (#1397, #1409). The `.z88` viewer shows the registers, the Blink, the
  address space at PC, and a **Slots** browser that pops banks out as Z88 disassembly. Run or debug a
  snapshot with `z88-snapshot <file> [-r|-d|-a]`, from the Explorer, or with the Emulator's **Open Z88
  Snapshot...** (which follows the file's Autorun flag). The machine is rebuilt to match the
  snapshot's RAM and LCD size, and the real-time clock catches up with the time the file spent on
  disk. Hybrid RAM+Flash cards are not supported.

- **IDE + Emulator recording** (#1409): **Machine → Recording → Start IDE + Emulator recording**, or
  Ctrl+Shift+F7 (`shortcuts.recordIdeEmu` changes it), records both windows into one video at 30 fps,
  also while the machine is paused. Options: the IDE's position (left, right, top or bottom), pointer
  and click rings, and HiDPI.

- **Tape viewer** (#1410). For `.tap`/`.tzx` files (any case of extension) it shows a summary, a
  timeline strip, and the blocks grouped by file, with filters. It explains header bytes and pops
  blocks out as memory, disassembly, a BASIC listing or a screen. `tape-load <file> [-r|-d]` and the
  matching tab and Explorer buttons insert a tape, or load and run or debug it on the 48K, 128K and
  +2/+3.

- **Cambridge Z88: the Blink panel and the snapshot viewer show the 24-bit address** each screen
  pointer register (SBF, PB0–PB3) points at, in OZvm's form &mdash; `$0127 (243800h)` &mdash; so a
  memory view can be opened right there (#1417).

- **Cambridge Z88: the serial port's output** (bytes written to TXD) appears in the Emulator output
  as `[Z88 serial]` lines, as OZvm shows them (#1417).

- **New Cambridge Z88 LCD resolution: 640x256** (#1385), as in OZvm. It matches the ZX Spectrum Next
  in tile mode. The Z88 now offers 640x64 (the default), 640x256, 640x320 and 640x480.

- **The Z88 disassembler knows the OZ v5.0 API**: the new FP\_, OS\_ and GN\_ calls of the
  September 2026 V5.0B ROM (#1386). The OZ 4.7 model is now named "Cambridge Z88 (OZ v4.7 Int.)"
  (#1399).

- **No-installer Windows build** (#1382). Each release now also ships
  `KliveIde-Portable-{version}-x64.zip`, which you unpack and run without setup or admin rights.
  It is fully portable: settings, the SD card image, default project and export folders and the
  browser cache all live in a `KliveData` folder beside `Klive IDE.exe`, never in
  `%USERPROFILE%\Klive` or `%APPDATA%\Klive IDE`. Unblock the zip (*Properties → Unblock*) before
  extracting it.

### Fixes

- **Cambridge Z88: no more screen noise on the larger LCDs under OZ 5** (#1417). The Blink now reads
  the Screen Base File and the fonts as a bank and an offset that wraps inside the bank, through the
  bank map, as OZvm does. OZ 5 places a large Screen Base File from the top of a bank downwards; Klive
  read on into the next bank and painted it from row 8 down. Until OZ has set the screen up, the LCD
  stays blank instead of showing whatever its registers pointed at.

- **Cambridge Z88: card contents survive card changes and hard resets** (#1417). Changing one slot,
  or a hard reset, re-inserted every card, which erased what OZ had programmed into flash and EPROM
  cards. A new card no longer shows the bytes of the card that was in the slot before.

- **Cambridge Z88 parity fixes** (#1417): COM.RESTIM keeps the latched TSTA events; releasing a key
  while another is held raises no key interrupt; battery low wakes a snoozing CPU; a flash sector
  erase and the Intel chip-ID read work through a mirrored bank; a blank ROM card reads $FF; looking
  at memory in the IDE no longer changes what the CPU reads next.

- **Cambridge Z88 disassembly** (#1409): pausing the Z88 no longer shows an empty Disassembly view,
  and code in mirrored card banks no longer shows as NOPs.

- **Custom disassembler items** (OZ calls, Spectrum RST data) honour the listing's address offset and
  no longer add their bytes to the previous instruction (#1409).

- **Tape fixes** (#1410): TZX $19 blocks open, and $13/$18 block lengths are read correctly; header
  names are no longer read one byte off; turbo ($11) block playback works; BASIC `TAB` listings are
  right; SCR images keep bright ink.

- **The first visible row's left border is drawn on every ZX Spectrum** (#1410); a grey segment
  showed at the top left on the +2A/+3.

- **`run-to` no longer deletes a user breakpoint at the same address** (#1414).

- **Explorer** (#1409): double-clicking a file no longer fails with "Duplicated document", and
  context menus close after a file-type action.

- **Clicking a toolbar button no longer takes keyboard focus**, so Space and Enter keep reaching the
  emulator &mdash; for example after starting a recording (#1383, #1384).

- **No more "Machine controller not available" errors** while a machine is being rebuilt (a machine
  or model change, or a Z88 LCD size, RAM size or keyboard layout change).

- **The Z80's R register counts both opcode fetches of a prefixed instruction** (`CB`, `ED`, `DD`,
  `FD`), as the real CPU does: `LD A,R` after such an instruction reads one more than before. This
  affects every machine. Timing is unchanged.

- Dependency updates, including Electron 44.4.5.

### Breaking changes

- **ZX BASIC builds use Klive BASIC by default** (#1400). Use `set zxbasic.compiler zxbc` to keep
  Boriel's `zxbc`. The generated code's addresses and sizes differ from `zxbc`'s.

- **The Machine → Machine type menu lists only favourite models** (#1418). Every model is in **Select
  machine…**; the default favourites are the 48K, 128K, +3E, Next, Z88 (OZ 5.0) and ZX81 16K.

- **Cambridge Z88: the reset button resets only the CPU** (#1417). The Blink &mdash; COM, the segment
  registers, the interrupt registers, the clock and the screen pointers &mdash; keeps its state, as in
  OZvm, so OZ's time of day survives a soft reset. Only a hard reset (power-on) resets the Blink, and
  it now clears RAM cards too, while ROM, EPROM and flash cards keep their contents.

- **Cambridge Z88: a 512K slot-0 ROM image is an AMD 29F040B flash chip**, as OZvm loads it, so OZ can
  update it; a slot-0 image larger than 512K is refused (#1417).

- **Cambridge Z88: the SCW register reads 80 on the 640x256, 640x320 and 640x480 LCDs** (640x64 still
  reads $FF), as OZvm reports it (#1417).

- **Cambridge Z88: the Blink register `SBR` is now `SBF`** (Screen Base File) in the Blink panel and
  the snapshot viewer (#1417). `.z88` snapshot files still store it under `SBR`, as OZvm writes it.

- **The 800x320 and 800x480 Cambridge Z88 LCD sizes are gone** (#1385). The OZ screen driver is
  designed for 640-pixel-wide screens, so an LCD driver for them is not practical. A project that
  still names one of them opens with the default 640x64 LCD.

- **Documentation site:** "/" is now a landing page, and the Introduction moved to `/introduction`
  (#1411). Every other address is unchanged.

### Known issues

- **Cambridge Z88:** the bundled OZ V5.0B ROM keeps a 2K Screen Base File on every LCD size, so on
  640x256, 640x320 and 640x480 it uses only the top 8 text rows, and the rest of the screen shows
  unrelated memory (OZvm shows the same). A newer OZ 5 build that allocates a larger Screen Base File
  uses the whole screen.

## 0.61.0

### Highlights

- **All emulated machines run on a WebAssembly core** &mdash; the ZX Spectrum 48K, 128K, +2/+3, the
  ZX Spectrum Next and the Cambridge Z88. The older TypeScript emulators are gone; projects saved with
  the "ZX Spectrum Next Compatibility" or "Cambridge Z88 (TypeScript)" models open on the matching
  standard model (see *Breaking changes*).
- **A modernized IDE.** A new look and fonts; restyled context menus, dialogs and sidebar panels; a
  reworked sprite and palette editor; and clearer memory, disassembly and register panels. Documents
  can be split into multiple hubs through *Split Right* / *Split Down* on a document tab.
- **Debug `.nex` files directly.** Run or debug any NEX file without a project, break at its entry
  point, and pop out banks with their own breakpoint gutter and live, PC-aligned disassembly. Also
  new: bank-relative breakpoints and watchpoints (`05:+$0100`), `nex-label` for naming code while
  debugging, NEX labels in the live disassembly, *Go to Definition*, a sprite view, and header checks
  before a file runs.
- **More debugging tools:** *Run to a line* (`run-to`, or Ctrl/Cmd-click the margin), Next register
  write breakpoints, conditional branch prediction in the disassembly, and *Go Back* / *Go Forward*
  navigation history across editors, views and breakpoints.
- **ZX Spectrum Next:** initial mouse and joystick emulation, and many hardware accuracy fixes
  checked against the FPGA source (DMA, CTC, DivMMC, sprites, tilemap, scroll register), backed by a
  new hardware test harness.
- **Cambridge Z88:** a new OZ v5.0 beta ROM, working cursor keys, smooth sound, a reliable keyboard
  under OZ 4.7, a working auto power-off, and corrected Help menu links.
- **Better sound:** improved beeper and PSG (AY) generation, no audio echo or silence while debugging
  the Next, and no lost audio in half-fps recordings.
- **Emulator window:** a finer zoom menu, *Fit Window to Screen* commands, a window size remembered
  per machine, and an option to hide the performance info in the status bar.
- **SjasmPlus integration dialog**, and an updated +2/+3 SjasmPlus project template.
- **Editor:** pasting a large source file is now instant (one edit instead of one per character), and
  Monaco refactoring is improved.

### Key fixes

- Long-running sessions no longer freeze: the ZX Spectrum froze after about 20 minutes, and queued
  keys could stick after about 10 minutes.
- Breakpoints are reliable again: no more breakpoints firing in the wrong bank, phantom breakpoints
  after a rebuild, breakpoints on the same address disarming each other, or *Step Out* running away
  after tail calls.
- Screen recording produces a file in the installed app.
- Reopening a project restores every document, not just source files.
- Stability fixes on Windows.

### Changes

- **New Cambridge Z88 OZ v5.0 beta ROM** (#1376). The `OZ50` model now runs the V5.0B international
  ROM built in September 2026, replacing the 2023 build, and the Machine menu lists it as
  "Cambridge Z88 (OZ v5.0B Int.)". Existing projects that use this model load the new ROM.

### Changes

- **New Cambridge Z88 OZ v5.0 beta ROM** (#1376). The `OZ50` model now runs the V5.0B international
  ROM built in September 2026, replacing the 2023 build, and the Machine menu lists it as
  "Cambridge Z88 (OZ v5.0B Int.)". Existing projects that use this model load the new ROM.

### Fixes

- **Host cursor keys did nothing on the Cambridge Z88** (#1374). The joystick key bindings took the
  arrow keys, right Shift, right Ctrl, `\` and NumpadEnter on every machine, not just the ZX Spectrum
  Next. They now belong to the emulated keyboard on any machine without joystick connectors, which
  also restores the ZX Spectrum's arrow keys and the Z88's two-Shift sleep/wake from the keyboard.
- **Choppy Cambridge Z88 sound** (#1374). The Z88 delivers its sound in 40 ms bursts of eight short
  frames, and the audio buffer, sized for a single frame, dropped over half of every burst. The
  beeper and the 3200 Hz tone now play smoothly again. The Z88 also no longer goes silent after
  about 22 minutes of running.
- **Queued keys could stick after about 10 minutes of running** (#1374), on the Cambridge Z88, the
  ZX Spectrum 48/128/+3E and the ZX Spectrum Next. These are the keys the on-screen keyboard and
  code injection type. A key queued as the machine's cycle counter passed 2^31 stayed pressed for
  good, or never started and blocked every key after it. That point comes after about 10 minutes
  at 3.5 MHz (11 on the Z88), and after 80 seconds on a Next running at 28 MHz.
- **The ZX Spectrum 48, 128 and +3E froze after about 20 minutes of running** (#1374). When the
  machine's 32-bit cycle counter wrapped, the frame loop stopped running instructions and the
  machine hung for good. The cores now keep their internal counter well away from the wrap, and
  the counter the IDE shows carries on as before.
- **The Cambridge Z88 keyboard could go dead under OZ 4.7** (#1374). With Keyclick on, a key press in
  the Index moved the highlight once, then no key worked while the machine kept running. The
  emulated Z80 had an NMOS chip quirk the Z88's CMOS Z80 does not have, and OZ 4.7 read it as
  "interrupts off". The Z88 now emulates the CMOS behaviour; the ZX Spectrum machines are unchanged.
- **The Cambridge Z88 screen lost its corner pixels** to the emulator display's rounded corners
  (#1374). The LCD now sits in a narrow surround in its own colour: unlit green, or grey while the
  LCD is off. The display's 1px frame also no longer hides one pixel on each edge of every machine's
  picture. Z88 screen recordings carry the same surround (4 pixels), so a player that rounds its
  window's corners no longer clips the LCD either.
- **The Cambridge Z88 never switched itself off** after the Panel's idle timeout (#1374). Two faults
  in the emulated real-time clock hid the passing minutes from OZ 4.7 and OZ 5.0. Both now go into
  coma on time, as OZ 4.0 already did.
- **Screen recording never produced a file in the installed app** (#1374), on any machine. The app
  looked for its bundled FFmpeg inside the app archive, where it cannot run, and only an empty
  `KliveExports/video` folder was left. A recording that fails now says why, instead of ending as
  if it had worked.
- **Cambridge Z88 recordings had the wrong sound** (#1374): a beep recorded as a dull thump. The
  recorder took each frame's sound only after the next frames had already overwritten it, so
  every 40 ms of recorded audio repeated the same 5 ms slice. Recordings now carry exactly what
  the speaker plays.
- **Half-fps recordings lost half their sound**, on every machine. The audio of each skipped video
  frame was thrown away, so 2 seconds of video carried about 1 second of squeezed-together audio.
  All of the audio is now kept.
- **ZX Spectrum Next panels showed stale data.** On the standard (WASM) Next the Palettes panel and
  the sprite editor's palette showed power-on colours whatever a program had written, the ULA & I/O
  panel read values the emulator never updated, and the Memory Mapping panel showed logical instead of
  physical page offsets and zero for the paging and DivMMC ports. (On the now-removed Next
  Compatibility model the ULA & I/O panel failed outright, and the memory editor treated the ROM
  pages as RAM.)
- **No sound while debugging the ZX Spectrum Next.** With the debugger attached, the standard model
  played nothing after its first frame; it now sounds as it does without the debugger.
- The ZX Spectrum Next's **F2 (scandoubler), F3 (50/60 Hz) and F7 (scanline weight)** menu items had no
  effect on the standard model.
- On the standard ZX Next the status bar always showed 3.5 MHz, however fast the CPU ran, and a memory
  or I/O breakpoint hit was reported against address `$0000` in the Breakpoints panel.
- ZX Spectrum Next: a mid-line write to NextReg `$68` bit 2 (half-pixel ULA scroll) now takes effect at
  the next 8-pixel cell, as on the hardware; and the frame interrupt is raised in the first frame after
  a reset.
- **ZX Spectrum Next sprites could vanish.** On the standard model, sprites numbered above the one a
  program made visible last were not drawn at all. Both models also forgot a sprite's fifth attribute
  byte after a four-byte write, instead of keeping it for when the sprite becomes five-byte again.
- ZX Spectrum Next hardware fixes found by the new cross-checks (each against the FPGA source): CTC and
  UART interrupts, and an NMI with NextReg `$CC` bit 7, now break into a DMA transfer; a CTC control word
  that counts the channel down to zero raises its zero count; a Layer 2 read mapping (any segment)
  disables the DivMMC's ROM 3 entry points; a RETN at `$0066` is recognised from the code the DivMMC
  pages in; a tilemap in bank 7 wraps at 8K; and a soft reset now resets the sprite upload positions and
  keeps NextReg `$02` bit 7.
- **A popped-out NEX bank could be open twice.** Opening a bank from the NEX viewer and then
  stopping in it while debugging (or following a label into it) gave two documents for the one
  bank, and the debugger scrolled the one you were not looking at. The two also carried different
  tab titles.
- *Go to Definition* landed at the start of the line instead of on the symbol.
- Opening a file whose viewer is not a code editor through the `nav` command (the NEX viewer, for
  example) took about five seconds.
- In a disassembly listing, a label on the target of a `jr` or `djnz` appeared in the label column but
  never in the jump itself, which kept the generated `L…` name.
- **Only source files came back when you reopened a project.** Every other document backed by a
  project file &mdash; the NEX, DSK and Z80 viewers, plain text files &mdash; was saved into the
  workspace correctly and then discarded while restoring it, because restoring matched on the code
  editor alone. Losing such a document also lost the selected tab, since the active one fell back to
  the first document that happened to survive.
- A breakpoint in partition 0 (bank `B0` on the 128K, bank `00` on the ZX Next) could never fire.
- **A source-code breakpoint fired in the wrong memory bank.** For a line inside a `.bank` section,
  the breakpoint was placed by address alone &mdash; and `.bank` sections share addresses, so it also
  stopped the machine in every *other* bank's code at the same address. It now carries the bank its
  line was assembled into.
- **A rebuild left phantom breakpoints behind.** When recompiling moved a line's code, the machine
  kept stopping at the address the line used to be at, as well as at its new one, with nothing in the
  Breakpoints panel to explain it.
- Several breakpoints could disturb each other when they landed on the same address &mdash; and a
  bank-relative breakpoint occupies eight addresses, so this was easier to hit than it sounds. Adding
  or removing one breakpoint could silently disarm another, permanently; a disabled breakpoint could
  mask an enabled one.
- A breakpoint created *as* disabled was armed anyway, if it was scoped to a partition or a bank.
- Replacing a set of breakpoints (opening a project, saving one, refreshing after a build) did not
  remove the ones it was replacing &mdash; it added to them. Invisible in the Breakpoints panel,
  because the replacements took the same names, but the old ones stayed armed where they were.
- The breakpoint dialog never showed a breakpoint's hit count: the emulator was not reporting it.
- **Step Out could run away instead of stopping**, on every Z80 machine. The debugger's shadow stack
  of return addresses was only ever pushed to, never popped, so once a routine had returned its entry
  stayed on top &mdash; and Step Out aimed at an address the program would not reach again, running on
  to the next breakpoint instead. It went wrong whenever the routine you were in did not own the
  newest entry: after a tail call (`jp SomeRoutine`, which pushes nothing, so the routine returns past
  its caller), and after stepping into and back out of a nested call before stepping out of the
  routine containing it. The stack is now balanced on every RET actually taken, so a conditional RET
  that falls through still costs nothing.
- A `.nex.dis` file whose only debug state was a label-anchored breakpoint lost it on the next save.
- The buttons a document adds to the tab bar (Run, Debug, and the script and NEX actions) sat hard
  against the right-hand end of the header, with no space after the last one.
- The NEX viewer's **Header attributes** rows were taller than they needed to be, spreading the
  header over more vertical space than its content asks for.
- Opening a project no longer discards breakpoints the project does not own.
- Removing a partition-scoped breakpoint through the editor gutter silently did nothing.
- The Disassembly view's breakpoint gutter no longer shows a breakpoint from one bank while you are
  looking at another.
- The Memory Mapping panel's **All RAM** row always read `Off`. Two separate causes: the field was
  read under a different name than it was written, and the ZX Spectrum Next reported nothing for it
  at all.
- The Memory Mapping panel's page rows showed the same number twice on the ZX Spectrum Next, one of
  them labelled "16K bank" in the tooltip. It now shows the real 16K bank beside the 8K one.
- A memory-read, memory-write or I/O breakpoint shown in the disassembly margin could not be removed
  or disabled by clicking it. The margin did not know the breakpoint's type, so it asked to remove an
  *execution* breakpoint at that address &mdash; which is a different breakpoint, and matched
  nothing. On the ZX Spectrum Next a bank watchpoint failed a second way: the address it named
  carried a type suffix the commands do not accept as part of an address.
- A disassembly line carrying more than one breakpoint showed whichever the emulator happened to
  list last, which also decided what right-clicking it would remove. It now shows the execution
  breakpoint, preferring an enabled one.

### Breaking changes

- **The "ZX Spectrum Next Compatibility" machine model is gone.** It ran a second, TypeScript
  implementation of the Next, which existed to check the current emulator against while that one was
  being written. The two now agree everywhere they were measured &mdash; the whole hardware test
  suite, every pixel test, and a 1500-frame instruction-by-instruction comparison of the NextZXOS
  boot &mdash; so the old one has been removed, and with it the last places where the Next quietly
  ran two emulators at once. A project or a session saved with the Compatibility model opens on
  **ZX Spectrum Next**; nothing else about it changes.

- **The "Cambridge Z88 (TypeScript)" machine models are gone.** The Cambridge Z88 runs on its
  WebAssembly emulator, and the older TypeScript one stayed in the Machine menu, in its own submenu,
  only to compare the two. They agreed on every OZ version booting and typing, every LCD size, the
  beeper, every card type being programmed, the IDE's panels and the debugger, so the TypeScript Z88
  has been removed and the submenu with it. A project or a session saved with one of those models
  (or with an earlier "WASM preview" model) opens on the same Z88 model in the main list.

- **On the ZX Spectrum Next, a positive memory partition index now means an 8K page rather than a
  16K bank.** Everything else already described these as 8K pages &mdash; the 224-entry partition
  list, the Memory view's bank chooser and the documentation &mdash; but the breakpoint and
  disassembly layer halved the number, so `bp-set 0A:$C000` and the Memory view's bank `0A` named
  different memory.

  Two visible consequences: the Disassembly view's bank column shows different numbers on the Next
  (an address in 16K bank 5's low half now reads `0A`, not `05`), and a partition in `bp-set`, in a
  saved script, or in an existing `.kliveproject` now names an 8K page. Saved Next partition
  breakpoints are **not** migrated &mdash; a stored index is genuinely ambiguous, since a user
  following the documented behaviour already meant the new reading. 16K bank *B* is the partition
  pair `2B`/`2B+1`.

### Features

- Multiple document hubs are available through the *Split Right* and *Split Down* document tab
  context menus.
- Context menus and modal dialogs are restyled.
- **Fixed-size data rows in NEX annotations.** A `bytes` region in a `.nex.dis` file can set
  `rowBytes` (1&ndash;4), so a table of records lists one record per `.defb` line &mdash; each two-byte
  copper instruction on its own line, for example &mdash; with its own comment.
- **Go Back and Go Forward.** Klive remembers the places you jump to &mdash; *Go to Definition*, an
  output-pane link, a breakpoint, a document tab, *Go To* in the Memory and Disassembly views, a NEX
  bank or label &mdash; and takes you back through them with `Ctrl+-` / `Ctrl+Shift+-` on
  macOS and `Alt+Left` / `Alt+Right` elsewhere, the mouse's back and forward buttons, the new toolbar
  buttons, or **IDE &rsaquo; Go**. The arrow between the toolbar buttons lists the whole history.
  Debugger stops are not remembered, so after debugging, *Go Back* returns to where you were before.
  A remembered line follows its code as you edit, and a place in a closed document &mdash; including
  a popped-out NEX bank &mdash; opens it again. New commands: `nav-back`, `nav-forward`,
  `nav-history` and `nav-clear`; `nav` gained `-r` to record its jump.
- `bp-set`, `bp-del` and `bp-en` accept a bank-relative address on the ZX Spectrum Next:
  `bp-set 05:+$0100` breaks at offset `$0100` inside 16K bank 5, wherever that bank is paged in.
- Any `.nex` file can be run or debugged on its own, without a project: from the Project Explorer's
  context menu, from the buttons in a NEX file's document tab, or with the new `nex-run` command.
- A popped-out NEX bank has a breakpoint gutter: click it to break at that offset in that bank,
  wherever the bank is paged in. Those breakpoints are remembered in the `.nex.dis` sidecar, so they
  survive a restart even when no project is open.
- **Debug a NEX file from its first instruction.** `nex-run <file> -e`, or the new *Debug NEX file
  (break at entry point)* item in the Explorer menu and the NEX document's tab bar, stops the machine
  the moment NextZXOS hands control to the program &mdash; with the entry bank paged in. Klive reads
  the entry point from the NEX header, so you do not have to know where the program's code lives.
- **Bank watchpoints on the ZX Spectrum Next.** The **Memory read** and **Memory write** breakpoint
  types now work with a bank-relative address (`bp-set 05:+$0100 -w`), so you can break when a byte
  of a particular 16K bank is read or written, wherever that bank is paged. The breakpoint dialog's
  **Address** field accepts the bank-relative form too, which means you can click a popped-out NEX
  bank's margin to set an execution breakpoint and then double-click it to change its type.
- **The NEX viewer checks the file before you run it.** A banner reports problems decidable from the
  header: an entry bank the file does not contain, an entry point or stack pointer in ROM, a bank the
  entry point needs but the file lacks, a core version newer than the emulator's, and a bank count
  that disagrees with the file's own flags. Each of these otherwise fails silently &mdash; NextZXOS
  reports a successful load and the program runs into memory it never loaded.
- Breakpoints anchored to a NEX label are remembered in the `.nex.dis` file, so they come back with
  the file &mdash; still anchored to the label, not to wherever it happened to be last time.
- **Name what you just worked out, without leaving the debugger.** Paused inside a NEX's code, the
  new `nex-label <name>` command (alias `nl`) adds a label to that file's annotations at the offset
  you are stopped at &mdash; and the live disassembly starts using it. It writes a bank-local label,
  because the address is only meaningful as an offset in its bank. With the NEX's viewer open the
  label joins your unsaved annotation edits and is kept when you save them; with the viewer closed
  it is written straight to the `.nex.dis` file.
- **Your NEX labels appear in the live disassembly.** With a NEX launched, the Disassembly view names
  operands from the labels you wrote in the NEX viewer &mdash; `call DrawSprite` rather than
  `call $C100`. A bank's own labels apply only while that bank is paged in, so the names follow the
  program as it pages; labels you made global apply everywhere.
- **A bank listed at `$4000` no longer disassembles the screen.** That range is the ULA screen
  &mdash; bitmap and attributes, `$4000`&ndash;`$5AFF` &mdash; and it used to fill the listing with
  thousands of rows of decoded pixels ahead of the code. It now collapses to a single line, and a
  **Screen** switch in the toolbar brings the disassembly back when you want it. The switch appears
  only for a NEX bank listed at `$4000`, and it changes the listing only: regions and annotations you
  made inside the range are kept.
- **Follow a label to where it is defined.** A NEX bank's disassembly context menu opens with **Go to
  Definition** whenever the line names a label &mdash; `ld hl,InitPalettes` &mdash; and it takes you
  there. A definition inside the bank on screen is a scroll, and works with no machine running. One
  outside it needs a machine, because which bank holds an address depends on how the program has
  paged memory: with one running, that bank is brought forward and scrolled to the label; without
  one, the command is greyed rather than guessing. `Ctrl+F12` reaches it from the listing &mdash;
  plain `F12` is the macOS Step Into accelerator, so it was not free to take.
- **A popped-out NEX bank shows the machine, not the file &mdash; without being asked.** Whenever a
  machine is running, both the bank's memory *and* its disassembly are built from the bank's current
  contents, with every byte that differs from the file marked and counted in the toolbar. This is how
  self-modifying code, a decompressed payload, or a bank corrupted by a stray write become visible
  &mdash; none of it can be told from a clean load otherwise. It works for every bank of the file,
  including ones the program has paged out, and falls back to the file's bytes when no machine is
  running. There is no switch to find: a `Live` marker in the toolbar says which of the two you are
  looking at.
- **A paused NEX bank's disassembly is aligned to the program counter.** Decoding a bank from its
  first byte is a guess about where instructions start, and self-modifying code or a jump table can
  make it wrong for everything below. While the machine is paused with the PC inside the bank, the
  listing is cut and re-decoded at the PC &mdash; the one offset where the alignment is known rather
  than guessed &mdash; so the rows from there on are the instructions that will actually run. A
  listing that was already aligned is left exactly as it was.
- **The Memory Mapping panel says which slots hold banks of the NEX you launched.** Hovering a page
  row names the file when that bank is one the NEX declares &mdash; so you can tell at a glance which
  bank to pop out. It names the file rather than claiming what the slot currently holds: the program
  is free to have overwritten the bank, and popping the bank out is what answers that &mdash; its
  view is the machine's bytes, with the differences from the file marked.
- **A popped-out bank highlights the line the program counter is on.** While the machine is paused
  and the PC is inside that bank, its disassembly marks the current instruction the way the
  Disassembly view does, and the toolbar adds a `PC` marker so you can tell without hunting for it.
- **A popped-out ZX Spectrum Next bank says where it is paged in.** Its toolbar shows `Bank at
  $8000`, or `Bank not paged in`, updated as the machine runs — with the 8K slot numbers in the
  tooltip, and a note that a paged-out bank's breakpoints stay armed and will fire once it comes
  back. A bank whose two 8K halves are not paged in as one block is reported as exactly that.
- **The NEX viewer counts the breakpoints in each bank.** A bank's heading shows how many it carries,
  with the breakdown by type in the tooltip, so a collapsed bank still tells you it is armed.
- **Run to a line.** The new `run-to` command (alias `rtc`) runs the machine until it reaches an
  address and then stops, leaving no breakpoint behind. It accepts everything `bp-set` does,
  including the Next's bank-relative `05:+$0100` form, so you can run to an offset inside a bank that
  is not paged in yet. Hold <kbd>Ctrl</kbd> (<kbd>Cmd</kbd> on macOS) and click the breakpoint margin
  in the Disassembly view or a popped-out NEX bank to do the same thing without typing a command.

## 0.57.1

### Fix

- Klive Z80 Assembler handles the first operand of BIT, SET, and RES properly

## 0.57.0

### Features

- Experimental integration with PASTA/80

## 0.56.0

### Features

- Extending the Z80 Assembly editor:
  - Semantic syntax highlighting
  - Macro expansion preview
  - Code folding for assembler blocks
  - Block pair highlighting
  - Rename symbol
  - Address and byte count on hover
  - Go to included file
  - Color decorators for attribute 
- Extending the table of ZX Spectrum Next system variables

## 0.55.0

### Features

- Add new view options to the memory panel, highlight the selected character too
- Add experimental screen recording feature to the emulator

### Fixes

- Fix the "Select ROM File" issue on Windows
- Fix the Edit Memory Content function

## 0.54.0

### Features

- You can change the ZX Spectrum 48 ROM
- New text editor for text file types
- New binary editor for viewing binary file content
- New image viewer to display bitmap images

## 0.53.2

### Fixes

- Introduce "cursorl" with the same functionality as "cursork" (deprecated)

## 0.53.1

### Fixes

- Fix .tzx and .tap export functionality (issue #1151)

## 0.53.0

### Fixes

- Use token colors with more contrast in the light theme
- Experimenting with turning off the AppImage sandbox

### Features

- Allow token color customization

## 0.52.0

### Features

### Fixes

- Fix the ZX Spectrum 128 banked code injection issue

## 0.51.1

### Fixes

- Remove screen flickering

## 0.51.0

### Features

- Add scanline effect to machines supporting it
- Preload screen changed

### Fixes

- Monaco editor loading issue fixed
- Flash rate fixed

## 0.50.4

### Features

- Removed .MSI installer for Windows
- Added compression: "store" to NSIS config (disables compression for faster antimalware scanning)
- Removed ASAR unpacking of compilerWorker files (reduces loose files that trigger scanning)

## 0.50.3

### Features

- Add .MSI installer for Windows

## 0.50.2

### Fixes

- Resolve the Windows 11 "installer hang" issue by updating to the newest electron-builder version

## 0.50.1

### Fixes

- The SjasmPlus compiler DISPLAY output is now shown

## 0.50.0

### Features

- Watch panel prototype

## 0.49.4

### Fixes

- Fix the freeze of paused (restarted) emulator

## 0.49.3

### Fixes

- Fix ZXBASIC compilation issue (TypeError)

## 0.49.2

### Fixes

- Fix annoying startup issues after a fresh install

## 0.49.1

### Features

- SjasmPlus Z80 Assembler integration
- New IDE options
- New Editor options

### Fixes

- Dozens of helpful fixes

## 0.34.0 - 0.49.0: Private builds

## 0.33.0

### Features

- Shadow Screen feature (https://dotneteer.github.io/kliveide/howto/shadow-screen)
- ZX Spectrum Next implementation now handles startup from SD Card

## 0.32.3

### Fixes

- The Create new Klive Project dialog correctly handles the project folder path on Windows.

## 0.32.2

Updated to Electron Shell v33.0.2

## 0.32.1

### Features

- ZX Spectrum Next implementation started

### Fixes

- The faulty install kit with the empty emulator and IDE windows is fixed.
- Creating a new Klive IDE now also sets the build root file on Windows.

## 0.32.0

### Features

- Klive now has a scripting system that uses JavaScript-like language.
- The IDE has a new customizable build system (rudimentary) that uses scripts in the `build.ksx` file. *Note*, if you use an old project format, you may need to update it. See instructions [here](https://dotneteer.github.io/kliveide/getting-started/creating-project#updating-old-projects).
- You can [change the default file extensions](https://dotneteer.github.io/kliveide/howto/file-extensions) and associate them with compilers.

## 0.31.1

### Fixes

- Fix the segment loading issue in the ZX Spectrum 128 exported file loader

## 0.31.0

### Features

This build represents a preview of new features being built into the IDE. The release also adds new machine types:
- ZX Spectrum 16K
- ZX Spectrum 48K (NTSC)
- Greatly improved (still in progress) Cambridge Z88

Though the ZX Spectrum Next emulator is in a very initial state, some rudimentary tooling started regarding the ZX Spectrum Next app development:
- `.z80` file viewer
- `.scr` file viewer
- `.nex` file viewer
- `.spr` sprite editor
- `.pal` and `.npl` palette editors

This release contains numerous minor updates to improve user experience.

## 0.30.5

### Fixes

- `.includebin` pragma length issue fixed

## 0.30.4

### Fixes

- The IDE saves the zoom factor at exit and reloads it with a new start
- A few IDE startup bugs fixed
- Toolbar, status bar, primary and tool panel states are saved
- Status bar PC refresh fixed

### Features

- New install kits for ARM64 (MacOS and Linux)

## 0.30.3

### Fixes

- Remove log message preventing Klive from starting

## 0.30.2

### Fixes

- ZX Basic integration (now Python path can be set)
- The Create New Klive project now works in the packaged product.
- Installer fixes
- Fixing IDE closing issues

### Documentation

- Many new articles have been added to help get started with Klive

## 0.30.1

Failed on internal tests, not released publicly.

## 0.30.0

This version of Klive is a significant update with an entirely new architecture. It is not just about new features and bug fixes but a rethought, brand-new Klive IDE. These are the essential changes:

- It is entirely written in TypeScript, with no WebAssembly anymore.
- The build is based on Vite.
- The documentation engine has been changed from Jekyll to Nextra.

## 0.12.4

### IDE

#### Fixes

- Uppercase conditions in Z80 instructions (like `call Z,nnnn`) now work correctly

## 0.12.3

### IDE

#### Fixes

- Find/Replace dialog now shows icons on MacOS
- (ZXBASIC) path resolution works correctly on Linux

## 0.12.2

### IDE

#### Fixes

- Copy/paste is available on Mac
- You can add new builder roots (https://dotneteer.github.io/kliveide/getting-started/building-and-running-code#specify-additional-build-root-file-extensions)
- Source code debugging now navigates to the current execution point/breakpoint

## 0.12.1

### IDE

#### Fixes

- ZXBC command line execution now works on Mac

## 0.12.0

### Emulator

#### Features

- ZX Spectrum now passes these tests: FloatSpy, MemPtr, 48K_Timings, ZexAll
- ZX Spectrum +2E/+3E implementation in progress

#### Fixes

- Refactor the Z80/ZX Spectrum core
- Fix asynchronous React components

### IDE

#### Features

- Diagnostics mode can be turned on and off (https://dotneteer.github.io/kliveide/documents/detecting-klive-issues)
- The project file now opens in read-only mode
- File types have new icons
- Code injection support for ZX Spectrum 128K
- ZXBASM integration (https://dotneteer.github.io/kliveide/getting-started/try-run-zxbasm-code)

#### Fixes

- Several code parsing bugs fixed in the Klive Z80 compiler
- Eliminate worker thread when running the Klive Z80 compiler
- Update build roots and breakpoints in the project file when renaming or deleting project files
- First time start issue with the New Klive project
- Various small issues fixed in the Project Explorer

### Known Issues

- ZXBC command line execution does not work properly on Mac
- Create New Klive Project may raise permission issues on Mac and Linux

## 0.11.0

The brand newA new approach of Klive with its IDE -- no Visual Studio Code integration needed.

## 0.9.0-alpha.9

### Klive Emulator

#### Features

- Cambridge Z88 Emulation handles
    - Hard & soft reset
    - Extra screen resolutions
    - Selecting custom ROM
    - Keyboard layouts for UK, DK/NO, SE/FI, DE, FR, and ES
    - Sound emulation
    - New Real-Time Clock implementation
- Statusbar can be turned on and off
- Frame information on statusbar can be turned on and off
- Developer Tools is displayed only when connected to the IDE
- Machine-specific Help menu items
- Saving emulator settings (machine-specific) to a file when exiting the emulator

#### Refactorings

- Emulator updated to Electron 11.1; uses context isolation

#### Fixes

- ZX Spectrum 48/128 interrupt signal is no longer (256 microsecond), as in the real hardware.

### Klive IDE

#### Fixes

- Report an error when ZXBC utility cannot be found

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

## 0.8.0-alpha.8

### Klive Emulator

#### Known Issues

- ZX Spectrum 128 memory view and disassembly view has some discrepancies

#### Features

- Cambridge Z88 Emulation is now handles interrupts, keyboard, and screen rendering (the implementations is still in progress)

#### Fixes
- Timing issues with LDIR/LDDR operating on ROM fixed.
- ZX Spectrum 48/128 interrupt signal is no longer (256 microsecond), as in the real hardware.

### Klive IDE

#### Features

- Z80 & Other Registers view contains machine-specific diagnostics information for each machine type
- The IDE contains Execute Klive command that you can use to set up absolute breakpoints, among the others

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

## 0.7.0-alpha.7

### Klive Emulator

#### Known Issues

- ZX Spectrum 128 memory view and disassembly view has some discrepancies

#### Features

- Cambridge Z88 Emulation is supported (the emulator is still in progress)
- You can select sound level in the Emulator (from the Machine menu)

#### Fixes
- You can set the ZX BASIC optimization level between 0 and 4 (instead of 0 and 3)
- Emulator screen refresh fixed
- Sound lag fixed
- Stuck key issue (when using Windows/Command key) fixed

#### Others

- The Emulator's internal architecture has been significantly refactored. Now, it's much easier to add new virtual machine types with their pecuiliarities. 
    - The standard Z80 and the Z80 Next CPUs are separated
    - Each virtual machine has its separate WebAssembly files
    - Now, virtual machines are based on a generic Z80 machine model
- The development of the ZX Spectrum Next model started

### Klive IDE

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

## 0.6.0-alpha.6

### Klive Emulator

#### Known Issues

- There still might be sound lag issues on Mac. It's likely some strange issue (or bug) in Electron.

#### Features

- Now, ZX Spectrum 48/128 floating port is implemented.
- You can inject machine code from the IDE and run it within the Emulator.

### Klive IDE

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

#### Features

- `.z80asm` files with syntax highlighting and immediate syntax check
- `.bor`, `.zxbas`, `.zxb` files with Boriel's Basic syntax highlighting (with embedded Z80 Assembly)
- The IDE has its integrated Z80 Assembler
- The IDE runs Boriel's Basic compiler, provided you install and configure this feature
- New command available form Z80 assembly and Boriel's Basic files: **Compile**, **Inject Code**, **Run Program in the Emulator**

#### Fixes

- A few annoying issues have been fixed in the disassembly view; disassembly generation is now about five times faster.

#### Others

- You can find new Getting Started articles here: [https://dotneteer.github.io/kliveide/getting-started/install-kliveide.html](https://dotneteer.github.io/kliveide/getting-started/install-kliveide.html)


## 0.5.0-alpha.5

### Klive Emulator

#### Known Issues

- The ZX Spectrum 48 and 128 models do not implement the floating port feature yet.

#### Features

- You can toggle Fast Load mode while the ZX Spectrum machine runs
- The toolbar contains a Rewind button to reset the tape to its initial position

#### Fixes

- Sound generation now uses `AudioWorkletProcessor` to fix sound issues on Mac.
- Windows restore works normally on Mac.
- The Emulator displays an error message when loading a tape file fails.
- Keys do not struck when left-Alt or Command key is used.

### Klive IDE

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

#### Features

- The IDE looks for the Emulator within the user's home folder, too.
- The IDE can send tape files to Emulator without restarting the virtual machine.
- You can select the machine type with the Update Klive Project command.
- The Memory view supports Spectrum 128 ROM and Bank pages.

#### Fixes

- The IDE does not display the "Cannot communicate with the executable" message when successfully strating the Emulator.
- The Update Klive Project now adds a code file (`code.z80asm`) to the project.
- The extension supports in initial model of Z80 Assembly language service (work in progress) that uses Z80 Assembly syntax highlighting.

#### Others

- Z80 Assembler building is in progress.

## 0.4.0-alpha.4

### Klive Emulator

#### Known Issues

- The ZX Spectrum 48 and 128 models do not implement the floating port feature yet.

#### Features

- The Emulator supports the ZX Spectrum 128 machine type, including PSG sound emulation.
- You can select a machine type in the Emulator.
- You can specify the type of machine used for startup.
- The SAVE command saves the ZX Spectrum code into a `.tzx` file to the folder configured in Klive IDE.
- You can configure the port the Emulator uses to listen to IDE commands.
- You can select a tape file to load directly from the Emulator.
- The Emulator displays when the IDE is connected, it disables a few features (such as machine type change and tape selection)

#### Fixes

- The flag setting bug with the `DEC (IX+d)` Z80 instruction is fixed.

### Klive IDE

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

#### Features

- The IDE looks for the Emulator within the user's home folder, too.
- The IDE can send tape files to Emulator without restarting the virtual machine.
- You can select the machine type with the Update Klive Project command.
- The Memory view supports Spectrum 128 ROM and Bank pages.

#### Fixes

- Step-over debug mode works properly with both ZX Spectrum machine types

#### Refactorings

- The virtual list used in the Memory and Disassembly views has been refactored to a more stable and faster one.
- The Memory view now uses the `innerHTML` technique instead of component-rendering to enhance performance.

## 0.3.0-alpha.3

### Klive Emulator

#### Features

- Now, it supports the step-over and step-out debug functions.
- The Emulator acceps tape files sent from the Klive IDE.
- The virtual machine screen displays an overlay with the execution state.
- The virtual machine allows CPU clock frequency multiplication. It support 3.5MHz, 7MHz, 10.5HMz, 14MHz, 17.5MHz, 21MHz, 24.5MHz, and 28MHz modes, too.
- The statusbar displays the number of screen frames since starting the virtual machine.
- The emulator supports displaying the screen rendering beam position

#### Fixes

- The virtual keyboard keys provide a larger surface to click symbol keys.
- Sound works properly with CPU clock frequency multiplication.

### Klive IDE

#### Features

- The project now has Github Pages documentation: https://dotneteer.github.io/kliveide/
- The disassembly view now displays ROM annotations.
- The disassembly view displays the breakpoints with different colors when not in debug mode.
- Now you can use the memory view.
- Both the disassembly and the memory view support the **Go To Address** and **Refresh** commands.
- You can send tape files to the Emulator.

#### Fixes

- The `chokidar` package has been removed from the build, as it was unreliable on Mac and Linux
- The **Create Klive Project** command signs when no project folder is open in VS Code

## 0.2.0-alpha.2

### Klive Emulator

#### Features

- Tape sound is enabled when loading program from tape
- Toolbar button to mute/unmute sound
- Displays engine and rendering frame time information in the status bar
- Displays Klive version information in the status bar
- Emulator pauses at breakpoins set in the Klive IDE
- Emulator supports the **step-into** debugger command

#### Fixes

- Mac and Linux build supported

### Klive IDE

#### Features:

- Z80 register view enhanced with flags and 8-bit registers
- Displays Klive status (disconnected/connected/running/paused/stopped) in VS Code status bar
- You can click to the disconnected Klive status in the VS Code statusbar to re-start Klive Emulator
- **Create Klive Project** command to generate a boilerplate ZX Spectrum project
- **Z80 Disassembly view** when selecting the `view.disassembly` file
- You can add and remove breakpoints in the Z80 Disassembly view
- The disassembly view displays the current execution point as you run the emulator
- The disassembly view navigates to the current execution point when the emulator is paused


## 0.1.0-alpha.1

Initial release:
- Klive Emulator, VS Code, and Klive VS Code Extension integration
- Z80 Registers view within the Debug activity tab
