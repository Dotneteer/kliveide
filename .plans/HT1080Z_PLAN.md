# HT-1080Z on the WASM Core — Implementation Plan

**Status:** decisions accepted 2026-10-22 (§15; D10 revised the same day after Phase 2); Phases 0-3
done 2026-10-22 (§17); Phase 4 done 2026-10-22. Next: Phase 5.
**Input:** the research pack `_input/ht1080z/`. Read its `README.md` first, then `HARDWARE.md`,
`VIDEO_TIMING.md`, `SOUND_AY.md`, `STORAGE_FIRMWARE_SOFTWARE.md` and `EXISTING_EMULATORS.md`.
Every hardware fact in this plan comes from there, with its source.
**Shape of the result:** one new C translation unit that configures and `#include`s the shared Z80
core `src/emu/z80/wasm/z80.c`, as the 48K, 128K, +3E, Next, Z88 and ZX80/81 do. It comes with a
TypeScript host in the ZX80/81 shape. There is no second CPU, no copy of `z80.c`, and no TypeScript
emulator.

### About "following the ZX Spectrum pattern"

The *pattern* the Spectrum cores set is followed exactly:
- a C core on the shared `z80.c`;
- a `*WasmV2Loader`, `*WasmHost` and `*WasmV2Machine`;
- a frame loop, a pixel buffer and an audio sample ABI;
- a ROM trap for fast tape loading;
- a harness in `test/harness/<machine>/`.

The *base class* is not reused. `ZxSpectrumBase` carries Spectrum-only concerns (ULA screen,
TAP/TZX, sysvars, contention). The ZX80/81 plan already settled this (`ZX8081_WASM_PLAN.md` §4.2),
so the HT host follows `Zx8081WasmHost extends Z80MachineBase`. Two Spectrum C files are reused
directly:
- the AY, `zxSpectrum/wasm/common/zx-spectrum-psg.c`, through aliases (§10);
- possibly parts of the tape-pulse player.

---

## 0. Ground rules

### 0.1 Licence and provenance

| Source | Licence | Use in Klive |
|---|---|---|
| `lkesteloot/trs80` (`_input/ht1080z/lkesteloot-trs80/`, commit `11ed9327`) | MIT | May be **ported** with its notice: the CAS/CMD/BAS parsers, the 500-baud encoder/decoder, the keyboard matrix layout, and later the WD1771. Each derived file keeps the copyright and permission notice in a header naming the upstream file. Add it to `THIRD_PARTY_NOTICES.md`. |
| MAME `src/mame/trs/trs80*` | BSD-3-Clause (per-file headers) | Facts, and small logic with the notice. Its HT emulation is flagged "not working"; its AY read port (1Eh) and AY clock (1.5 MHz) are **wrong** for the HT (`SOUND_AY.md` §2–3). |
| MiST `ht1080z` (Jozsef Laszlo): `ht1080z.vhd`, `videoctrl.vhd`, `ps2kbd.vhd` | BSD-3-style headers | Facts and small logic with the notice. `HT1080Z_MiST.sv` is GPL-2+: facts only. Its embedded character ROM and patched ROM are ROM data: never copied. |
| SDLTRS | BSD-2 + xtrs licence | Facts and small logic with the notice. |
| MiSTer TRS-80 (`fdc1771.sv` GPL-3, some "non-commercial" files), xtrs/sdltrs GPL parts, any GPL emulator | GPL / non-commercial | **Facts only.** No code, no translation. |
| trs80gp, Grósz's HT1080Z, Kollár's Real-80 | closed | Run as **behavioural oracles**, by hand, never in CI. Only the observed results of Klive's own test programs are recorded, as the Klive BASIC rule D12 does with `zxbc`. |
| HT schematics, the Genie manual, HT manuals, Rádiótechnika articles (`_input/ht1080z/docs/`) | documents | The primary hardware reference. Facts are written in Klive's own words with citations. |

**The ROMs are shipped (D2, accepted).** The nine ht.homeserver.hu images are copied unmodified
into `src/public/roms/`. Their hashes match MAME's sets (`STORAGE_FIRMWARE_SOFTWARE.md` §1.4b). They
ship with a notice file, `src/public/roms/ht1080z-roms-readme.txt`, and a `THIRD_PARTY_NOTICES.md`
section. Both state:
- the origin: ht.homeserver.hu, dumps by Majzik István;
- the holders: Microsoft (Level II BASIC), EACA and Hiradástechnika Szövetkezet;
- that no explicit permission is known, and that they are included because they are openly
  published by the HT preservation group;
- that they will be removed on request from a rights holder.

The project author accepted that risk on 2026-10-22.

### 0.2 Reuse rules for the CPU
The rules from `ZX8081_WASM_PLAN.md` §0.2 and `src/emu/z80/wasm/README.md` ("Adding a core") apply
unchanged:
- `z80.c` is configured through `#define Z80_*` hooks and never forked;
- anything missing becomes a default-no-op hook, mirrored in `Z80Cpu.ts` and added to
  `scripts/check-wasm-cpu-contract.cjs`, and then **every artifact is rebuilt and retested**.

**Expected core changes: none.** The HT needs the external-bus memory and port hooks, the
`Z80_DELAY_MEMORY_*` hooks (to see video-RAM accesses), `Z80_TACT_PLUS_N` and NMI. All of these
exist. There is no contention, no WAIT and no interrupt source.

### 0.3 Documents to read before working on this
- `_input/ht1080z/README.md` and the five topic files listed above.
- `src/emu/z80/wasm/README.md`: the "Adding a core" checklist and the debug-loop contract.
- `src/emu/machines/zx8081/wasm/README.md` and `ZX8081_WASM_PLAN.md` §17: the newest non-Spectrum
  core, and the traps it hit.
- `.ai/wasm-v2-machine-migration-guide.md`: the frame lifecycle, build pattern and "PSG/AY Audio
  Lessons".
- `.ai/wasm-migration-intent-and-lessons.md`: the ZX80/81 section, and why `reset()` must call
  `setTactsInFrame`.
- `test/machines/p3-rom-images.test.ts` and `src/public/roms/spp3-roms-readme.txt`: how shipped
  ROMs are checked and documented. Read `TIMEX_SCORPION_PLAN.md` decision P5 (user-supplied ROMs)
  only if the §14 replacement-ROM follow-up is taken up.

---

## 1. Goals and non-goals

### Goals
1. **HT-1080Z Series I, Series II and HT-1080Z/64** as one machine with three models. Each has its
   own ROM set, character set, clock and RAM size (§4.3).
2. **Hardware-accurate timing:**
   - one T-state = one character slot;
   - 112 T per line, 312 lines, 34,944 T per frame;
   - no interrupts, NMI from the RESET key;
   - the CPU-access "black dash" on the picture (`VIDEO_TIMING.md`).
3. **Video:** 64×16 text and 128×48 semigraphics from the real character ROMs, the Hungarian
   characters per model, and the hardware VIDEO CUT/PAGE (32 columns) as machine controls.
4. **Sound:** the port-FF beeper and the AY-3-8910 at ports 1Eh/1Fh, clocked at Φ, mixed mono into
   one speaker. The PSG panel works.
5. **Tape:** `.cas` real-time playback from a synthesized 500-baud signal, a ROM-trap fast load,
   `SAVE` capture to `.cas`, motor control, and quick-loading of `.cmd`/`.bas`.
6. **Keyboard:** host mapping, auto-typing, and a virtual HT keyboard with Hungarian legends.
7. **Debugger and IDE:**
   - every existing debugger feature (breakpoints, history, profile, reverse debugging, state files);
   - a Level II disassembler with the ROM's conventions;
   - the HT character map and a BASIC listing view.

### Non-goals for this plan (follow-ups, §14)
- The EU7 expansion unit: the FD1771 floppy, the 40 Hz RTC interrupt, the printer and the HRG card.
- Assembler support (`.model HT1080Z`, `.cmd`/`.cas` export, code injection) and project templates.
  This becomes its own plan, as the ZX80/81 did with `ZX8081_CODE_INJECTION_PLAN.md`.
- A generic TRS-80 Model I or Video Genie machine. The architecture should not prevent it (§14).
- User-port peripherals on AY ports A/B.

---

## 2. What is reused, and from where

| Need | Source | Note |
|---|---|---|
| CPU, debugger, history, profile | `src/emu/z80/wasm/*` | Unchanged |
| AY-3-8910 | `zxSpectrum/wasm/common/zx-spectrum-psg.c` | Via aliases; one small shared change (§5) |
| PSG side panel | `WasmSpectrumPsgDevice` + `MF_PSG` | Needs `<prefix>GetPsg*` exports, as `timex.c` aliases them |
| Host, loader, adapter shape | `zx8081/*` | Copy the shape, not the content |
| Debug loop | `src/emu/machines/wasmDebugLoop.ts` | Unchanged |
| Bundled ROM loading | `Z80MachineBase.loadRomFromResource` (`src/public/roms`) | As for sp48, Z88 and ZX81 |
| ROM identification | `src/common/roms/romIdentity.ts` | Add the HT CRCs (`STORAGE_FIRMWARE_SOFTWARE.md` §1.2, §1.4b) for the ROM disassembly gate and the panels |
| ROM image test | `test/machines/p3-rom-images.test.ts` | Copy its shape: every shipped HT image has the expected size and CRC |
| CAS/CMD parsing, 500-baud encoding | `lkesteloot-trs80` (MIT) | Ported to TS (file parsing) and C (pulse synthesis), with the notice |
| Keyboard matrix code | none suitable | The Sinclair `zx-spectrum-keyboard.c` is a 5-bit half-row matrix. The HT's is an 8×8 memory-mapped matrix with ORed rows, so it gets its own small C file. |

---

## 3. The machine in one page (for the implementer)

From `_input/ht1080z/` (section references are to those files):

- **Clock:** Φ = crystal ÷ 6.
  - Series I/II: 10.644 MHz ÷ 6 = **1,774,000 Hz**.
  - /64: 10.6645 MHz ÷ 6 = **1,777,417 Hz**, traced on the schematic (HARDWARE §2).
  - No wait states.
- **Frame:** 112 T × 312 lines = **34,944 T** (50.77 Hz or 50.86 Hz). The visible window is
  T 2–65 of lines 0–191 (VIDEO_TIMING §3–4). `MachineController` paces frames from
  `tactsInFrame / baseClockFrequency`, so non-50 Hz rates need no special handling.
- **Memory:**
  - ROM 0000–2FFF (12 KB BASIC) and 3000–37FF (extension, 2 KB window);
  - keyboard 3800–3BFF (address bits A0–A7 select rows, selected rows ORed);
  - video RAM 3C00–3FFF;
  - RAM 4000–7FFF (16K) or 4000–FFFF (48K on the /64);
  - unmapped reads return FFh (HARDWARE §3).
- **Ports:**
  - FF write: bits 0–1 cassette out (three levels), bit 2 relay/motor.
  - FF read: bit 7 = cassette-in latch, which a write to FF clears.
  - FE: bit 4 selects the recorder.
  - FD: printer.
  - 1Fh write: AY register select; 1Eh write: AY data; **1Fh read: AY data**; 1Eh read: open bus
    (SOUND_AY §2).
  - The decode uses the low byte only.
- **Interrupts:** none. INT is unconnected on a bare machine. The RESET key drives **NMI** (0066h,
  memory kept); HALT does not cause an NMI (HARDWARE §2).
- **Video:**
  - 6×12 cells. The character ROM is 2 KB: 128 glyphs × 16 bytes, dots in bits 7–3.
  - D7 = 1 selects 2×3 semigraphics; scan lines 0–3, 4–7 and 8–11 select bit pairs D0/D1, D2/D3
    and D4/D5.
  - The pipeline delay from the video-RAM read to the dots is 2 character slots.
  - A CPU access to 3C00–3FFF blanks about 2 character cells at the beam position.
- **Sound:**
  - the beeper is port-FF bits 0–1 into the speaker, muted while bit 2 (the relay) is set;
  - the AY runs at Φ (one input clock per T-state; the prescaler steps every 8 T) and is mixed
    mono into the same speaker.

---

## 4. Architecture and file layout

### 4.1 C (one artifact, the model chosen at run time)

```
src/emu/machines/ht1080z/wasm/
  README.md                  build, ABI, exports, timing model (model it on zx8081's README)
  Ht1080zWasmV2Loader.ts
  dist/ht1080z.wasm
  ht1080z/
    ht1080z.c                TU: state, Z80_* hook #defines, #include z80.c, frame loop, exports
    ht1080z-memory.c         ROM/RAM map per model, ROM upload, peek/poke, unmapped = FFh
    ht1080z-keyboard.c       8×8 matrix, row-select OR read at 3800–3BFF
    ht1080z-video.c          catch-up raster renderer per character slot → RGBA (§6)
    ht1080z-audio.c          beeper levels, AY via zx-spectrum-psg.c aliases, mono mix, DC filter
    ht1080z-tape.c           500-baud pulse player, cassette-in latch, motor, fast-load and SAVE traps
scripts/build-ht1080z-wasm.cjs (+ .d.cts)
scripts/check-ht1080z-wasm-size.cjs
scripts/benchmark-ht1080z-wasm.cjs
```

The hook block (names illustrative):

```c
#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR()               htMemory
#define Z80_READ_MEMORY(a)             htReadMemory(a)      /* keyboard OR-read at 3800–3BFF */
#define Z80_WRITE_MEMORY(a, v)         htWriteMemory(a, v)  /* ROM ignores writes */
#define Z80_READ_PORT(a)               htReadPort(a)
#define Z80_WRITE_PORT(a, v)           htWritePort(a, v)
#define Z80_DELAY_MEMORY_READ(a)       htNoteBusAccess(a)   /* VID: catch up video, mark dash */
#define Z80_DELAY_MEMORY_WRITE(a)      htNoteBusAccess(a)
#define Z80_TACT_PLUS_N(n)             htAdvanceTacts(n)    /* tape edges, AY step, frame end */
#include "../../../../z80/wasm/z80.c"
```

The default `Z80_DELAY_*` behaviour (3 T memory, 4 T port) is kept. The HT hooks only *observe*
the access; they never stall.

### 4.2 TypeScript (the ZX80/81 shape)

```
src/emu/machines/ht1080z/
  Ht1080zWasmHost.ts          abstract host: registers (override every accessor), memory, ports,
                              debug loop, frame execution, pixel/audio plumbing, ROM problem report
  Ht1080zWasmV2Machine.ts     concrete adapter (IExecutionHistorySource, IAccessProfileSource)
  Ht1080zMachineFactory.ts
  ht1080zMachineInfo.ts       models (§4.3), clock per model, hardware resolver
  Ht1080zKeyCode.ts           matrix keys and legends
  Ht1080zKeyMappings.ts       host key → matrix (BREAK, CLEAR, arrows, SHIFT; the accent combos)
  Ht1080zTyper.ts             auto-type with the ROM's debounce timing (found in Phase 4)
  Ht1080zRoms.ts              the model → bundled image names table (and their CRCs)
  TrsCasFile.ts               .cas/.cmd/.bas recognition and parsing (port of lkesteloot, MIT)
  Ht1080zCharSet.ts           character map for the memory panel and BASIC listing, per model
```

There is also a separation test, `test/ht1080z/ht1080z-separation.test.ts`, as for the ZX80/81:
the host must not import TypeScript device code.

### 4.3 Machine ID and models (D1)

One machine ID, `MI_HT1080Z = "ht1080z"`, with three models:

| Model | ROM set (HS name = MAME set) | RAM | Clock | Character set | VRAM |
|---|---|---|---|---|---|
| `ht1080z-s1` Series I (1983) | `ht_s1_*` = `ht1080z` | 16K | 1,774,000 Hz | no accents | 8-bit; 00h–1Fh drawn as 40h–5Fh (D10) |
| `ht1080z-s2` Series II (1984) | `ht_s2_*` = `ht1080z2` | 16K | 1,774,000 Hz | É Ö Á Ü é ö á ü on `@ \ ] ^ \` \| } ~` | 8-bit; 00h–1Fh drawn as 40h–5Fh (D10) |
| `ht1080z-64` HT-1080Z/64 (1985) | `ht_s3_*` = `ht108064` | 48K | 1,777,417 Hz | full Hungarian set + maths symbols on codes 0–31 | 8-bit |

An optional `MC_HT_RAM` config key could give Series I/II 48K, standing in for an expansion RAM
board (`HARDWARE.md` §9.2). It is cheap, and plenty of software assumes 48K.

---

## 5. Shared-code change (Phase 1, before any HT code)

`zx-spectrum-psg.c` defines `SP128_PSG_CLOCK_STEP 16u` and `SP128_PSG_ROUTE_GAIN 0.25`
unconditionally (and `#undef`s them at the end).
- Wrap both in `#ifndef`, so a machine can set the step. The HT needs **8** (AY clock = Φ, internal
  ÷8; the Spectrum's AY runs at Φ/2, hence 16). Its gain is chosen in Phase 5.
- This is a no-op for every existing core, which keeps 16 and 0.25.
- Proof: rebuild sp48, sp128, spp3e and timex and run their PSG and audio tests. The Timex/Pentagon
  AY goldens must be byte-identical.
- Allow `zx-spectrum-psg.c` in the HT entry of `check-wasm-cpu-contract.cjs`
  (`forbiddenIncludeFragments` blocks the rest of `zxSpectrum/wasm/common/`).

No `z80.c` change is planned (§0.2). If Phase 3 shows the dash needs to know *which* T-state of
the M-cycle MREQ falls in, the fallback is a new default-no-op hook, handled under the §0.2 rules.

---

## 6. Video: rendering against the CPU clock

From `VIDEO_TIMING.md` §1–7.

- **The model:** the raster is a 112 × 312 grid of character slots, and slot `t` of the frame is
  the CPU's tact `t`.
  - For a visible slot (line `y` < 192, line slot `x` in 2–65): read VRAM `[(y/12)·64 + (x−2)]`,
    take the glyph row `y mod 12` (or the semigraphics pair), and emit 6 dots.
  - Otherwise emit black.
- **Catch-up rendering:** do not render per T. Keep `renderedUpToTact`. Render up to the current
  tact:
  - when the CPU is about to touch 3C00–3FFF (`htNoteBusAccess`);
  - when the PAGE or VIDEO CUT controls change;
  - at the end of the frame.
  Then apply the access. A write after the beam has passed a cell shows from the next scan line,
  exactly as on the hardware.
- **Black dash (D7):** a CPU access marks the slots whose latch strobe it covers (the access slot
  and the next one) as blank. These are visible slots `x+1` and `x+2` relative to the access tact
  (`VIDEO_TIMING.md` §5, *inference*). Phase 3 tests pin the exact rule. A menu option turns the
  dash off.
- **VIDEO CUT / PAGE:**
  - Two machine controls (menu items and host keys), not ports.
  - With VIDEO CUT on, each column lasts 2 slots and each dot is drawn 2 wide. PAGE selects columns
    0–31 or 32–63.
  - The line and frame totals are unchanged.
- **Character ROM decode:**
  - Settled in Phase 0 (§17). The character ROM address is A0–A3 = scan line 0–11 and A4–A10 =
    code bits D0–D6, so there are 128 glyphs of 16 bytes. On the /64 codes 00h–1Fh show their own
    glyphs (the Hungarian set); on Series I/II they are drawn as 40h–5Fh (D10, revised).
  - **Dots are bits 7–3, with bit 7 leftmost.** The 6th dot is always blank (graphics excepted).
  - Only ROM outputs O3–O7 are wired to the shift register. The low bits that eleven /64 glyphs
    carry are never shown and must be ignored.
  - Rows: Series I/II glyph bodies are rows 0–6, with descenders at 7–8. The /64 draws capital
    accents at rows 0–2, bodies at 3–9 and descenders at 10–11. The renderer just uses all 12 rows.
- **Window and aspect (D6):**
  - The framebuffer covers **528 × 288 dots**: 384 + 2×72 horizontally and 192 + 2×48 vertically.
    This is the same proportion of the TV line as Klive's Spectrum border.
  - HT dots are narrower than they are tall (10.66 MHz dot clock), roughly 2:3. The machine reports
    this through `getAspectRatio`.
  - The border is black. Its position is analog (trimmers) on the real machine, so there is no
    "correct" offset to emulate.
- **Colour:** monochrome. White on black, with an optional green or amber tint as a display setting
  later; not in this plan.

---

## 7. Keyboard

- **Matrix:** the TRS-80 Model I 8×8 layout at 3800–3BFF (`HARDWARE.md` §7.2).
  - A read ORs the rows whose address bit A0–A7 is set.
  - Settled in Phase 0 (§17): the /64 keyboard schematic shows the **plain Model I matrix with no
    extra keys**. Row 3 holds only X Y Z. Row 6 is ENTER(NL) CLEAR BREAK ↑ ↓ ← → SPACE. Row 7
    bit 0 is SHIFT, with both SHIFT keys on one contact. MiST's "F2/F3" bits are its own invention.
  - Two keys are **outside the matrix**, so software cannot see them:
    - **PAGE** is a latching switch on the PS line, the 32-column page select of §6.
    - **F1** sits on the CL line, with an LED, and works a cassette-relay override. The
      *Rádiótechnika* 1984/7 tape-search program tells the user to release F1 before
      fast-forwarding.
    In the emulator, PAGE is the §6 control, and F1 is a tape-deck "motor override" toggle,
    shown but not required for loading.
- **Host mapping:**
  - Enter → ENTER, Esc → BREAK, Home → CLEAR, the arrows;
  - Shift keeps the TRS-80 shifted symbols, which needs a character-level mapping as in the
    ZX80/81 typer;
  - the Series II accents (CLEAR + A/E/U/O) and the /64 apostrophe prefix are typed by the typer
    from Hungarian characters.
- **RESET key:** a toolbar or menu action that pulses NMI. "Hard reset" stays the power-on reset.
- **Virtual keyboard:** an HT layout with Hungarian legends. It is designed first as an HTML mockup
  in `.plans/ht1080z/`, as the ZX81 one was (`ZX8081_WASM_PLAN.md` §8.1), from the user manual's
  keyboard drawing (`HARDWARE.md` §7.1). It is built to the approved mockup in Phase 4.

---

## 8. Ports, beeper and tape hardware

- **Port FF write:**
  - bits 0–1 give the cassette-out level: 01 = +, 10 = −, 00/11 = 0, the three-level output
    (`HARDWARE.md` §4.2);
  - bit 2 drives the relay/motor.
- **Port FF read:** bit 7 is the cassette-in latch, set by a rising edge of the input and cleared by
  any write to FF. The other bits read 1 for now; they are undocumented, and MAME's D6 rule is
  noted.
- **Port FE:** bit 4 selects recorder 1 or 2. One tape deck is modelled, so the bit is stored and
  shown, nothing more (D8).
- **Port FD:** printer. With nothing attached it reads "not ready" (MiST returns 30h, the status
  bits for no printer).

---

## 9. Files and tape

- **Opening files (TS):** `TrsCasFile.ts` recognises:
  - `.cas`: the 500-baud byte stream; the 1500-baud Model III variant is rejected with a message;
  - `.cmd`: TRSDOS load-module records 01/02/05;
  - `.bas`: tokenised BASIC;
  - `.wav`: Phase 6b, optional.
  Layouts are in `STORAGE_FIRMWARE_SOFTWARE.md` §3.
- **Real-time load:** the C core synthesises the 500-baud pulse train from the uploaded `.cas`
  bytes:
  - a 2 ms bit cell, a clock pulse plus an optional data pulse, about 128 µs per pulse half;
  - the leader and A5h sync come from the file;
  - pulse lengths are converted with the model's Φ.
  The ZX81 lesson applies: synthesise in C, never upload pulse lists. The motor bit gates playback.
- **Fast load (ROM trap):** trap the Level II cassette byte-read and sync entry points:
  - the HT ROM keeps Tandy's addresses (0235h/0296h; `STORAGE` §1.4, §2.1);
  - the HT ROM uses the older bit-read delays and selects the second recorder with `OUT (FE)` at
    0212h;
  - Phase 6 records the exact trap PCs by observation, as the ZX80 plan did;
  - a fast load and a real-time load of the same `.cas` must end in identical RAM.
- **SAVE:** trap the byte-write routine (0264h), or capture the port-FF output edges, and publish
  `SAVED_TO_TAPE` as the ZX81's `zx8081-tape.c` does. The result is offered as a `.cas`.
- **Quick load:**
  - `.cmd`: write the records straight into memory and jump to the entry address, after the ROM
    reaches `READY`;
  - `.bas`: write at the BASIC start and fix the pointers (`STORAGE` §2.2–2.3); offered as
    "Load and RUN".
- **Auto-type:**
  - `CLOAD` / `SYSTEM` + name + `/` for tapes;
  - the boot prompts are `MEMORY SIZE?` (/64) and `READY ?` (Series I/II), confirmed from the
    ROM text in Phase 0, and the typer answers with ENTER.

---

## 10. Audio

- **Beeper:** the three-level cassette-out value goes to the speaker, muted while the relay bit is
  set.
- **AY:** `zx-spectrum-psg.c`, included with `sp128Tacts` aliased to the HT tact counter and
  `SP128_PSG_CLOCK_STEP 8u` (§5).
  - Port routing follows the traced decode: `OUT 1Fh` = address (low 4 bits), `OUT 1Eh` = data,
    `IN 1Fh` = data read, `IN 1Eh` = FFh.
  - Ports A/B read FFh: inputs with nothing attached; after reset all bits read high
    (`SOUND_AY.md` §5).
- **Mix:** mono, A+B+C plus the beeper into one channel, duplicated to the stereo buffer, then a DC
  filter and clamping. Write it in `ht1080z-audio.c`, using the Z88's `z88-beeper.c` as the
  non-Spectrum example; do not bend `zx-spectrum-beeper.c`.
- **Tact epoch:** if the core rebases its tact counter at frame end, shift `sp128PsgNextClockTact`
  and `sp128PsgLastAccumulationTact` too (sp48 README, "tact counter epoch").
- **PSG panel:** export `htGetPsg*` aliases and set `MF_PSG`.
- **Reset:** the AY is reset on hard reset only. The RESET key (NMI) leaves it playing. This is
  unverified (`SOUND_AY.md` §6), and the behaviour is noted in the README.

---

## 11. IDE integration checklist

- `src/common/machines/constants.ts`:
  - `MI_HT1080Z`; `MC_*` keys for the model, RAM (optional 48K), the CPU-access dash on/off, and
    quick-load;
  - add the machine to `MEDIA_INFO_MACHINE_IDS`, and to `BEAM_POSITION_MACHINE_IDS` if the beam
    overlay supports a 112 × 312 grid.
- `machine-registry.ts`:
  - features: `MF_Z80`, `MF_TAPE_SUPPORT`, `MF_PSG`, `MF_ROM`, `MF_EXEC_HISTORY`,
    `MF_REVERSE_DEBUG`, `MF_PROFILE`; `MF_INJECT_SUPPORT: false` until the assembler plan;
  - `models`, `mediaIds`, `charSet`;
  - `toolInfo` with a custom disassembler.
- `machine-renderer-registry.ts`; `hardware-specs.ts` (the Machine Select sheet; the drift test
  `test/machines/hardware-specs-cores.test.ts` checks it against the core); `char-codes.ts`.
- **Menus:** `src/main/machine-menus/ht1080z-menus.ts` with:
  - tape open/play/rewind/eject;
  - quick-load;
  - VIDEO CUT, PAGE and the dash toggle;
  - the RESET key (NMI);
  - the model.
  Also `state-menus.ts`.
- **ROMs (D2, accepted):**
  - Nine files go into `src/public/roms/`, named by Klive's convention and loaded through
    `loadRomFromResource`: `ht1080z-s1.rom` (12 KB BASIC), `ht1080z-s1-ext.rom` (2 KB) and
    `ht1080z-s1-chargen.rom` (2 KB), and the same for `s2` and `s64`. The HS file each one copies
    is listed in the readme.
  - Add `src/public/roms/ht1080z-roms-readme.txt` and the `THIRD_PARTY_NOTICES.md` section (§0.1).
  - `test/machines/ht1080z-rom-images.test.ts` checks the sizes and CRC32s against §17. A
    replaced or corrupted image fails CI.
  - A user-supplied replacement ROM (as `MC_SP48_ROM_FILE` allows for the 48K) is a follow-up
    (§14), not needed for this plan.
- **Disassembler:** `z80-disassembler/ht1080z-disassembler.ts`. Level II conventions:
  - `RST 08h` (syntax check) is followed by one byte;
  - the ROM's inline data tables are shown as data.
  Taken from Kollár's hand disassembly and the TRS-80 disassembly in `docs/`, written in Klive's
  own words (the ROM-annotation D4 rule applies to names).
- **Character map:** the model's glyph names for the memory panel; the semigraphics codes as
  blocks.
- **BASIC listing view:** Level II tokens 80h–FBh (`STORAGE` §2.4), program start from 40A4h,
  following the ROM's `LIST`. The /64's two-byte Hungarian sequences are shown as their
  characters.
- **History and profile:** `src/common/history/contexts/ht1080zContext.ts`,
  `src/common/profile/layouts/ht1080z.ts`, `reverse/exportContract.ts`.
- **State files:** `wasmStateImage.ts`, `kliveStateFile.ts`, `machineStateFile.ts` (the full
  64 KB linear memory, as for the ZX81).
- **Headless/CLI:** `headlessMachines.ts`, `HeadlessMachineFactory.ts`.
- **Unit-test worker:** `src/main/unit-tests/wasmArtifacts.ts` (`CORE_FOLDERS`).
- **Packaging:** in `package.json`, add `build:ht1080z-wasm` and `check:ht1080z-wasm-size`, an
  entry in `build:all-wasm`, and `extraResources` (`src/emu/machines/ht1080z/wasm/dist` →
  `wasm/ht1080z`).
- **i18n:** every UI text through `t()`, with English entries and translator context
  (`.ai/i18n-guide.md`), then `npm run i18n:keys`.
- **Docs:**
  - `docs/content/en/guides/emulator/ht1080z.mdx`;
  - an under-the-hood page on the video timing;
  - the machine-types pages;
  - screenshots from a `scripts/doc-shots/recipes/ht1080z.cjs` recipe.

---

## 12. Tests

All tests run the real WASM machine, and new folders go into `build/e2e-tests.ts`.

### 12.1 Test layers
The ROMs ship (D2), so **every test runs in CI on the real ROMs.** All of them live in
`test/ht1080z-hw/` (an `E2E_CORE_TESTS` entry in `build/e2e-tests.ts`):

1. **ROM-driven behaviour:**
   - booting each model to its prompt, observed in video RAM;
   - typing;
   - `PRINT` of the character set (a golden per model);
   - semigraphics with `SET`/`RESET`;
   - the accented characters (Series II, /64);
   - AY sound from the manual's "sea" program;
   - CAS fast load vs real-time load ending in identical RAM;
   - `SAVE` round trips;
   - `.cmd` and `.bas` quick load;
   - the BASIC listing view against the ROM's `LIST`.
2. **Hardware-rule probes:**
   - small machine-code programs, `POKE`d or assembled into RAM and run under the real ROM, that
     pin each rule in §3, §6 and §8 at T-state precision:
     - the pipeline offset and the dash;
     - the keyboard OR-read;
     - the port FF latch, beeper and relay mute;
     - the AY write/read ports;
     - the cassette-in latch;
     - NMI;
     - unmapped reads.
   - These programs disable nothing in the ROM. They run after boot, so no separate test ROM is
     needed. A probe that must start before the ROM (for example, a power-on state) uses the
     harness's `poke` and `setPC` on a freshly reset core.

D4 is no longer needed: the earlier two-layer design (a Klive-written test ROM for CI plus
ROM-gated local tests) is dropped.

### 12.2 Harness
`test/harness/ht1080z/`, copying `test/harness/zx81/`:
- `createHtSession(model)`, `bootToPrompt()`, `typeKeys`, `runFrames`, `runTo`, `step`;
- `peek`/`poke`, `screenText()` (VRAM 3C00h mapped through the model's character map),
  `screenPixels()`;
- `loadCas`, `audioSamples()`, `psgRegisters()`;
- debug and history helpers;
- a README and self-tests.

### 12.3 Test programs
- Programs **written for Klive** (typed through the harness, or assembled) come first.
- Third-party `.cas`/`.cmd` files enter the repository only with a clear licence and pinned
  provenance, as `_input/zx81-tapes/` did. That rules out the HT archive's commercial or
  abandonware titles as committed fixtures. They may be used locally, through an environment folder
  that tests read only when it is set. The ROM decision (D2) does not extend to software.

### 12.4 Oracle runs (manual, never in CI)
- **trs80gp:** `-m1 -50` with the HT ROMs, for CPU, VRAM and tape behaviour.
- **Grósz's HT1080Z and Real-80:** for the AY and the HT ports.
- Record only observed results of Klive's own programs.

### 12.5 Performance and contracts
- `benchmark:ht1080z-wasm` must show more than 10× real time.
- `check-wasm-cpu-contract.cjs` gets an entry for id `ht1080z`, and
  `wasm-shared-z80-cpu-contract.test.ts` is updated.

---

## 13. Phases and exit criteria

| Phase | Content | Exit criteria |
|---|---|---|
| **0. Decisions and reference values** | Settle D1–D10 (§15). Confirm from the documents in `_input/ht1080z/docs/` (FIXTÁR, the /64 manual, the keyboard and E-panel schematics), each recorded in §17 with its source: (a) whether Series I/II VRAM keeps 8 bits (the s1/s2 character ROMs have real glyphs at 00–1Fh, which MAME's 7-bit mapping hides); (b) the dot-extraction rule (bits 7–2 vs 7–3, rows used); (c) the extra keyboard matrix bits; (d) the cassette pulse widths in the HT ROM; (e) the boot prompt per model; (f) which data bits the /64's port-FF latch (IC6 74LS175) actually takes: the notes list D0, D2, D3, which would make the /64's cassette output two-level. | Decisions recorded; reference values listed in a §17 table. |
| **1. Shared AY change** | §5: overridable `SP128_PSG_CLOCK_STEP`/gain. | sp48/sp128/spp3e/timex rebuilt; their PSG and audio tests green; AY goldens byte-identical. |
| **2. Skeleton** | The nine ROM images, the readme and the ROM-image test (§11); `ht1080z.c` TU and memory map per model; ROM upload; keyboard read; ports without tape; the frame loop (34,944 T); loader, host and adapter; registry entry for **Series II only**; `Ht1080zRoms.ts`; build, size and contract scripts; the harness. | Series II boots to its prompt, observed through VRAM; probes pass for the memory map, unmapped FFh, keyboard OR-read and NMI; the ROM-image test is green. |
| **3. Video** | §6: catch-up renderer, character ROM decode, semigraphics, VIDEO CUT/PAGE, the dash, window and aspect. | Probes pin the pipeline offset (column *n* drawn at slot *n*+2), the dash rule and 32-column mode. Boot-screen and character-set goldens pass. Visual check in the running app (CDP, `.ai/ui-theming-intent-and-lessons.md` recipe). |
| **4. Keyboard** | §7: host mappings, typer, RESET-key NMI, the virtual keyboard (mockup approved first). | `typeKeys("PRINT 1+1")` shows `2`; the accents type on Series II and the /64; the virtual keyboard matches its mockup in the running app. |
| **5. Sound** | §10: beeper, AY routing, mono mix, PSG panel. | A probe shows OUT 1Fh/1Eh then IN 1Fh reads back; tone TP = 100 measures 1,110.9 Hz ± 1 % at the /64 clock in the sample buffer; the relay mutes the beeper; the manual's sea program produces noise; PSG panel populated. |
| **6. Tape and files** | §8–9: pulse synthesis, latch, motor, fast-load traps, SAVE, `.cmd`/`.bas` quick load, auto-type; `.wav` optional (6b). | Fast load and real-time load give identical RAM; SAVE round trip; `.cmd` runs; a tape opened from the IDE runs by itself. |
| **7. Models** | Series I and the /64 (48K, /64 character set, clock 1,777,417); optional 48K for Series I/II. | A boot golden per model; the /64's Hungarian characters print; `hardware-specs` drift test green. |
| **8. Debugger and IDE** | Disassembler, character map, BASIC listing, menus, state files, history/profile/reverse, headless. | A debug-step test in the style of `wasm-z88-debug-step.test.ts`; state-file round trip; BASIC listing matches the ROM's `LIST`; manual IDE check. |
| **9. Ship** | Docs, screenshots, `THIRD_PARTY_NOTICES.md`, `.ai/` notes (an HT section in `wasm-migration-intent-and-lessons.md`), changeset, packaging. | `npm run build:check`, `lint:renderer`, `test:fast`, `test:slow` (the plan is completing), the electron-vite build, `doc:build`/`doc:check` green; the packaged build runs the machine. |

Phases 2 and 3 may merge, as they did for the ZX81, if booting needs the video renderer to show
anything. It does not, because the boot is observed through VRAM, but the option is noted.

---

## 14. Follow-ups (not in this plan)

- **Assembler plan:** `.model HT1080Z`, `.cmd`/`.cas` export, Run/Debug by injecting into memory
  and jumping, project templates (default, z88dk if a TRS-80 target fits). The model is
  `ZX8081_CODE_INJECTION_PLAN.md`.
- **EU7 expansion unit:**
  - the 40 Hz RTC interrupt and the 37E0h latch;
  - an **FD1771** (Klive has only a µPD765, so this is a new controller; lkesteloot's MIT WD1771
    and CLK's MIT WD177x are the inputs) with JV1/JV3/DMK images and NEWDOS/80;
  - the Centronics printer on FD;
  - the boot change (the ROM tries the disk first).
- **HRG card:** 512×512 in two pages, ports 60h–7Bh, MC6845, a second display window
  (`HARDWARE.md` §9.2).
- **Generic TRS-80 Model I / Video Genie (EG3003):** a 60 Hz / 264-line model of the same core,
  with Tandy or EACA ROMs (user-supplied). The core's model table should keep this possible.
- `.wav` tape input and recording to `.wav`.
- A user-supplied replacement ROM per model (as `MC_SP48_ROM_FILE` does), for modified or
  patched ROMs.
- User-port devices on AY ports A/B (the lamp demos from *Rádiótechnika* 1984).
- Display tint (green or amber monitor).

---

## 15. Decisions (accepted by the project author on 2026-10-22)

All recommendations were accepted as written: **D1** one machine ID, three models; **D2** ship the
ROMs (with the readme and notices); **D3** the provenance rule of §0.1; **D5** 1,774,000 Hz for
Series I/II and 1,777,417 Hz for the /64; **D6** a 528 × 288 window with about 2:3 pixel aspect;
**D7** the CPU-access dash on by default, with a toggle; **D8** one modelled deck; **D9** the base
machine only; **D10** 8-bit video RAM on every model, with codes 00h–1Fh drawn as 40h–5Fh on Series
I/II (revised after Phase 2, below). **D4** was withdrawn when D2 was accepted.
The original questions follow for the record.

- **D1 — One machine ID with three models, or three IDs?**
  - *Recommendation: one ID (`ht1080z`), three models.* They share keyboard, files and software,
    so users think of them as one machine. This matches `sp48`'s models and differs from the
    ZX80/ZX81 split, where keyboards and file types differ.
- **D2 — ROM policy. ACCEPTED 2026-10-22: ship the ROMs.**
  - No permission to redistribute the HT, EACA or Tandy/Microsoft ROMs was found
    (`STORAGE` §1.5). The project author accepted the risk because the images are openly published
    by the HT preservation group.
  - Consequence: they are bundled in `src/public/roms/` with a readme and a
    `THIRD_PARTY_NOTICES.md` section (§0.1, §11), and all tests run in CI on the real ROMs (§12.1).
  - Optional, non-blocking: ask the ht.homeserver.hu group whether they know who holds the rights,
    and record any answer in the readme.
- **D3 — Provenance rule.**
  - *Recommendation:* §0.1 as written. Port from lkesteloot (MIT) and the BSD files with notices;
    GPL and non-commercial sources for facts only; closed emulators as manual oracles.
- **D4 — Testing without ROMs in CI. WITHDRAWN 2026-10-22:** D2 ships the ROMs, so CI tests the
  real machine and no test ROM is needed (§12.1).
- **D5 — Clock per model.**
  - *Recommendation:* Series I/II 1,774,000 Hz (the Genie manual's 10.644 MHz) and /64
    1,777,417 Hz (the traced schematic). MAME's 1,746,667 Hz is not used.
  - Revisit only if a hardware measurement says otherwise.
- **D6 — Visible window and aspect.**
  - *Recommendation:* 528 × 288 dots, a Spectrum-like proportion of border, with a pixel aspect
    of about 2:3 reported through `getAspectRatio`.
  - Alternative: 480 × 264, tighter, with less border.
- **D7 — The CPU-access black dash.**
  - *Recommendation: on by default*, with a menu option to turn it off. It is real hardware
    behaviour and some software visibly shows it.
- **D8 — Two recorders.**
  - *Recommendation: one modelled deck.* Port FE bit 4 is stored and shown. A second deck is a
    follow-up if any software needs it.
- **D9 — Scope.**
  - *Recommendation:* the base machine only (§1). The EU7, HRG and assembler support go to
    follow-up plans (§14).
- **D10 — VRAM width on Series I/II.**
  - The Genie manual says all 8 bits are stored. MAME treats s1/s2 as 7-bit (codes 00–1Fh shown as
    40h–5Fh). The local s1/s2 character ROMs hold distinct glyphs at 00–1Fh.
  - *Recommendation: 8-bit*, unless Phase 0 finds a schematic or ROM reason otherwise. If the ROM
    never writes 00–1Fh to the screen, the difference is visible only to software that POKEs those
    codes.
  - **REVISED 2026-10-22, after Phase 2 (reading (a) of §17's Phase 2 question):** the video RAM
    keeps all 8 bits on every model, so a read gives back what was written. When drawing, Series
    I/II show codes 00h–1Fh as 40h–5Fh (MAME's rule): their BASIC stores every letter there (the
    fold at 0471h), and their character ROMs' glyphs at 00h–1Fh would make the screen unreadable.
    The /64, whose BASIC removes the fold, shows its own glyphs at 00h–1Fh (the Hungarian set). The
    rejected reading (b) stored bit 6 as NOR(D5, D7) on every write, as lkesteloot and MiST do.

---

## 16. Risks

- **Shipping ROMs without permission (accepted, D2).** If a rights holder objects, the images are
  removed and the machine falls back to a user-supplied ROM (the §14 follow-up becomes required).
  Keep `Ht1080zRoms.ts` as the single place that names the images, so that switch is small.
- **The dash timing is inferred** (the MREQ window ≈ 2 T, position +1). Make the rule a pair of
  constants, tested in one place, so a later hardware measurement is a one-line change.
- **The shared AY change** touches four shipped cores. It is a pure `#ifndef`, verified by
  byte-identical goldens in its own phase.
- **The frame rate is not exactly 50 Hz** (50.77 or 50.86 Hz). Pacing follows
  `tactsInFrame / baseClockFrequency`, but the audio sample-rate conversion and any 50 Hz
  assumption in tape timing or the recorder must use the model's clock. Phase 5 checks the sample
  count per frame.
- **Software archives** are mostly not redistributable. Fixtures are Klive-written, so real-world
  coverage comes from local and oracle runs only.

---

## 17. Reference values and implementation record

**Phase 0 done 2026-10-22.** The decisions are in §15 and the reference values below. Every open
hardware question from Phase 0 (a)–(f) is settled; none changed a decision. Later phases add their
values and record each deviation from this plan with its reason, as in `ZX8081_WASM_PLAN.md` §17.

| Value | Klive | Source |
|---|---|---|
| Φ Series I/II | 1,774,000 Hz | Genie manual §1.1.1 (10.644 MHz ÷ 6) |
| Φ /64 | 1,777,417 Hz | /64 E and F panel schematics (10.6645 MHz → 74LS92 ÷6 → Z80 Φ) |
| T per line / lines / T per frame | 112 / 312 / 34,944 | Genie Fig. 1.5, 1.8(b); /64 E panel counter resets |
| Visible slots | 2–65 of lines 0–191 | Genie Fig. 1.8(a)(b) |
| AY clock / prescaler step | Φ / 8 T | `SOUND_AY.md` §3 (inference by elimination; both FPGA cores agree) |
| AY ports | W 1Fh addr, W 1Eh data, R 1Fh data | Sound panel schematic decode; *Rádiótechnika* 1984/8 program 4 |
| ROM sets | HS s1/s2/s3 = MAME ht1080z/ht1080z2/ht108064 | `STORAGE_FIRMWARE_SOFTWARE.md` §1.4b (hashes verified 2026-10-22) |
| Shipped images (CRC32) | `ht1080z-s1.rom` / `-s2.rom` 2bfef8f7 (12 KB, identical); `ht1080z-s64.rom` 48985a30; `-s1-ext` 2a851e33; `-s2-ext` 07415ac6; `-s64-ext` fc12bd28; `-s1-chargen` e8c59d4f; `-s2-chargen` 6728f0ab; `-s64-chargen` e76b73a4 | §1.4b; the ROM-image test checks these |
| VRAM width | **8 bits on every model**. The character ROM sees D0–D6; Series I/II draw codes 00h–1Fh as 40h–5Fh, the /64 shows its own glyphs there (D10, revised after Phase 2) | Genie §1.4.2: two 2114 (1K × 4); /64 E panel IC13/IC14 MM2114, chargen IC20 A4–A10 from latches IC21/IC3; s1/s2 chargen holds distinct glyphs at 00h–1Fh |
| Character ROM addressing | A0–A3 = scan line (0–11; 12–15 never addressed), A4–A10 = code D0–D6 | /64 E panel IC20 TMS2716 pins 8–5 and 1–4, 23, 22, 19 |
| Dots per glyph row | bits 7–3 (bit 7 leftmost), 6th dot blank; bits 2–0 ignored | IC20 outputs O3–O7 (pins 13–17) only wired; F/R glyphs read correctly with bit 7 leftmost |
| Glyph rows used | s1/s2: 0–8 (body 0–6); s64: 0–11 (accents 0–2, body 3–9) | Row statistics of the shipped character ROMs |
| Semigraphics | left 3 dots = even bit, right 3 dots = odd bit (shift register IC4 inputs tied in groups) | /64 E panel IC4 74LS166; Genie §1.4.4.2 |
| Keyboard matrix | plain Model I 8 × 8; no extra keys; PAGE and F1 outside the matrix | /64 keyboard schematic Y04-4000-00-1IE |
| Boot prompt | Series I/II `READY` (+ `?`), /64 `MEMORY SIZE` then `BASIC  2.20` | Text at BASIC offset 0105h of each shipped ROM (/64 banner at 011Ah) |
| Cassette write pulse | +227 T, −227 T, then 0; CTPULS 01D9h lasts 1,744 T | Hand count of the Series II ROM bytes at 01D9h (`LD B,0Bh` ×2, `LD B,5Ch`) |
| Cassette bit cell | 3,557 T (bit 1), 3,570 T (bit 0); data pulse starts 1,763 T after the clock pulse | Byte writer at 0264h; = 2.00–2.01 ms, about 500 baud at either clock |
| Cassette read window | latch cleared about 906 T after the clock pulse is seen, sampled about 2,476 T after it (bit = 1 if a pulse fell in between) | CTBIT 0241h (`LD B,41h`, `LD B,76h`) |
| Leader | 255 × 00h then A5h | 0284h–0290h (`LD B,0FFh`) |
| /64 port-FF output | three-level: two latch outputs (IC6 Q3, Q̄2) summed through R30/R31 10k; relay from Q0; recorder select IC35 (FE bit 4) | /64 E panel sheet 2 (corrects the earlier "D0, D2, D3" reading, which was flip-flop pin labels) |
| Fast-load trap PCs | *Phase 6* | |

**Phase 1 done 2026-10-22.** `zx-spectrum-psg.c` now wraps `SP128_PSG_CLOCK_STEP` (default 16u)
and `SP128_PSG_ROUTE_GAIN` (default 0.25) in `#ifndef`, with a header comment saying why; both are
still `#undef`'d at the end of the file. Proof of the no-op:
- sp48, sp128, spp3e and timex were rebuilt before and after the change, and all four `.wasm`
  artifacts are **byte-identical** (SHA-1), which is stronger than identical AY goldens;
- `wasm-psg-audio`, `wasm-beeper-audio`, `PsgPanel`, the shared CPU contract test,
  `2068-ay`, `sp128-golden`, `pentagon-timing` and the slow-tier sp128/spp3e loader tests pass.

Deviation: the `check-wasm-cpu-contract.cjs` allowance for `zx-spectrum-psg.c` (§5, last bullet)
moves to Phase 2. There is no HT entry to put it in until the core exists; Phase 2 adds the entry
with `allowedIncludeFragments: ["zxSpectrum/wasm/common/zx-spectrum-psg.c"]`. (Done in Phase 2.)

**Phase 2 done 2026-10-22.** Every model boots on the real ROMs, observed through video RAM
(`test/harness/ht1080z/self-tests/session.test.ts`), and the probes in
`test/ht1080z-hw/skeleton.test.ts` pin the memory map, the unmapped FFh reads, the keyboard OR-read
(with the 3900h-3BFFh mirror), the ports without tape, the RESET-key NMI, and the absence of INT.

| Value | Klive | Source |
|---|---|---|
| Boot, Series I/II | `READY ? _` within 60 frames; NEW LINE gives `READY` and `>_`; MEMSIZ (40B1h) = 7FFFh | Observed on the core, both ROMs |
| Boot, /64 | `MEMORY SIZE? _`; NEW LINE gives `BASIC  2.20`, `READY`, `>_`; MEMSIZ = FFFFh | Observed on the core |
| RESET key | NMI at the next instruction boundary; BASIC returns to `READY`, RAM kept | Probe; HARDWARE.md §2 |
| Unmapped memory (16K models) | 8000h-FFFFh read FFh, writes lost | Probe; the ROM's memory-size test finds 7FFFh |
| Size | 241 KB (speed build) against a 300 KB ceiling | `check:ht1080z-wasm-size` |

Deviations from the plan, with their reasons:
- **A fourth C file, `ht1080z-ports.c`,** holds the port decode and the cassette-in latch. §4.1 has no
  home for them before the audio and tape files exist; Phases 5 and 6 add to it.
- **The core already carries the history recorder and the access profile.** The shared debug loop
  calls `z80HistoryStopNow`, and `wasm-shared-z80-cpu-contract.test.ts` requires every core to record
  history. Their TypeScript side (the context decoder, the profile layout, `IExecutionHistorySource`)
  and the `MF_EXEC_HISTORY`/`MF_PROFILE`/`MF_REVERSE_DEBUG` features stay in Phase 8.
- **A position key mapping and a minimal character map exist now** (`Ht1080zKeyMappings.ts`,
  `Ht1080zChars`), so the registered machine is usable. Phase 4 adds the character-level mapping and
  the typer; Phase 8 the per-model glyphs and BASIC tokens.
- `HT1080Z_ALL_MODELS` defines all three models for the core and the harness; the registry lists
  only `HT1080Z_MODELS` (Series II) until Phase 7. The model key is `MC_HT_MODEL` (`s1`/`s2`/`s64`).

**Question found in Phase 2 (against D10), answered 2026-10-22: reading (a).** The Series I/II BASIC's
display driver folds every character 40h-7Fh down to 00h-1Fh before writing it (0471h: `CP 40h` /
`JR C` / `SUB 40h` / `CP 20h` / `JR C` / `SUB 20h`), so `READY` is stored as 12h 05h 01h 04h 19h.
The /64 BASIC NOPs exactly those bytes out. The Series II character ROM has glyphs at 00h-1Fh that
differ from 40h-5Fh (none of the 32 match). So D10's "codes 00h-1Fh show their own glyphs on every
model" would put garbage on the Series I/II boot screen: on those models 00h-1Fh must *display* as
40h-5Fh. Two readings fit the evidence:
- (a) keep 8-bit video RAM and alias 00h-1Fh to 40h-5Fh when drawing on Series I/II (MAME's `m_7bit`);
- (b) store bit 6 as NOR(D5, D7) on every write on Series I/II, a 7-bit RAM with the TRS-80's
  regenerated bit (lkesteloot's `writeToScreenMemory`; MiST stores `din or 40h` below 20h).
They differ only for software that reads video RAM back or writes 00h-1Fh/60h-7Fh itself. The project
author chose (a); D10 (§15) records it.

**Phase 3 done 2026-10-22.** `ht1080z-video.c` draws the picture against the CPU clock as §6 says.
`test/ht1080z-hw/video.test.ts` pins the rules at T-state precision, and `screen.test.ts` holds a
boot-screen and a character-set golden per model, each checked by eye before it was recorded. In the
running app (Playwright, `scripts/doc-shots/harness.cjs`), Series II shows `READY ?`, NEW LINE gives
`READY`, and the host keyboard types at the `>` prompt.

| Value | Klive | Source |
|---|---|---|
| Content timing | the display reads column n at slot n and shows it at slot n + 2; a write is seen by reads after its T1 slot | VIDEO_TIMING.md §3, §5; `video.test.ts` |
| Dash | an access with T1 at slot x blanks the reads at x and x + 1, so the dash is drawn at slots x + 2 and x + 3; a constant pair in `ht1080z-video.c` | VIDEO_TIMING.md §5 (inference: VID low mid-T1 to mid-T3); `video.test.ts` |
| Window | 384 x 192 at (72, 48) in a 528 x 288 black picture | D6 |
| Dot aspect | 7 / 10.644 = 0.658 of its height (Klive shows a 7 MHz Spectrum pixel square) | D6; `HT1080Z_PIXEL_ASPECT` |
| Size | 259 KB | `check:ht1080z-wasm-size` |

Deviations from the plan, with their reasons:
- **VIDEO CUT, PAGE and the dash toggle are machine properties now** (`HT_VIDEO_CUT`, `HT_VIDEO_PAGE`,
  `HT_VIDEO_DASH` in `machine-props.ts`), with core exports to set them. Their menu items come with
  the HT menus in Phase 8 (§11), and the PAGE host key with the keyboard in Phase 4.
- **The renderer also catches up when the IDE shows a paused machine** (`renderInstantScreen` calls
  `ht1080zRenderToBeam`), so a debugger stop shows the frame down to the beam. Drawing is output only,
  so this cannot change what a run computes.
- An opcode fetch from video RAM is treated as a 3-T access like any other (the M1 cycle drives MREQ
  too); the core does not tell the hook which kind of cycle it is.

Found in the running app and fixed the same day: the panel scaled the 528-dot picture by the 0.658
aspect nearest-neighbour, so some dot columns came out a pixel wider than others and letters looked
uneven. A picture whose aspect is not a whole fraction is now drawn sharp-bilinear on a
device-resolution canvas (`features/emulator/sharpScale.ts`, the rule in
`.ai/ui-theming-intent-and-lessons.md`); every other machine's path is unchanged.

**Phase 4 done 2026-10-22.** The typer (`Ht1080zTyper.ts`, `Ht1080zWasmHost.typeText`), the RESET
key (Machine menu, `ht1080z-menus.ts`, custom command `reset_key`), PAGE as a latching key on Page
Up/Page Down, `test/ht1080z-hw/keyboard.test.ts`, and the virtual keyboard
(`src/renderer/appEmu/Keyboard/Ht1080zKeyboard.tsx`, `test/controls/Ht1080zKeyboard.test.tsx`), built
to the mockup `.plans/ht1080z/ht1080z-keyboard-mockup.html`, which the project author approved on
2026-10-22. Its geometry and printed legends are measured from the user manual's keyboard drawing
(§4.1, p. 8); its colours are sampled from a photo of a Series I/II machine
(https://frescho.hu/ht-1080z-adatlap/): cream keys with black legends in a charcoal recess, light
grey PAGE and F1. The Hungarian legends are Klive's hints, per model, in burnt orange; a click types
its character through the typer. F1 is drawn and inert until Phase 6. Checked in the running app:
the keyboard matches the mockup, and clicks on it type at the prompt.

| Value | Klive | Source |
|---|---|---|
| Typing timing | held 3 frames, released 3; the Level II keyboard routine loses a repeated key at 2 frames in all and takes every key from 3 | Measured on both BASICs |
| Typer frame edges | half a frame before each boundary: a frame starts a few T-states late by a different amount each time, and an edge on the boundary moved a key's hold between 2 and 3 frames | Measured (a run of Series II accents lost é and ü) |
| Shifted keys | the TRS-80's: SHIFT+1-9 `! " # $ % & ' ( )`, SHIFT+: `*`, SHIFT+; `+`, SHIFT+, `<`, SHIFT+- `=`, SHIFT+. `>`, SHIFT+/ `?`; SHIFT+@ stores 00h (Series I/II) or 60h (/64) | Observed in video RAM |
| Extension ROM | off at power-on; `SYSTEM` then `/12288` switches it on (Series I prints `NEW KEYBOARD ROUTINE ENABLE`, the /64 `BASIC ROM EXTENSION  2.51`, Series II nothing); it adds lowercase and a block cursor (8Fh) | Observed |
| Series II accents | with the extension on: CLEAR held, then A E U O give 5Dh 40h 5Eh 5Ch (Á É Ü Ö); with SHIFT too 7Dh 60h 7Eh 7Ch (á é ü ö). CLEAR must go down before the letter | Observed; matches the HS ROM page |
| /64 specials | with the extension on and `PRINT CHR$(21)`: `` ` `` (SHIFT+@) then A E I O U 3 4 5 6 give codes 0 1 2 3 6 4 5 7 8 (Á É Í Ó Ú Ö Ő Ü Ű), SHIFT+ them 16-24; 7 8 9 B G M S give Ω 15, ∞ 11, ■ 9, Ψ 14, π 12, λ 10, Σ 13; SHIFT+ them ω 31, α 27, √ 25, β 30, γ 28, μ 26, ∫ 29 | Observed; glyphs read off the /64 character ROM |
| RESET key | NMI to 0066h, taken once; the handler (`LD SP,0600h`, 37ECh tested for a disk, `JP 06CCh`) returns BASIC to its `>` prompt, the program kept | Observed |

Corrections and deviations:
- **The HS ROM page's code numbers for the /64's mathematical and Greek characters are wrong** (and
  so are HARDWARE.md §5.5 and STORAGE §1.3, which copy them); its *keys* are right. The /64
  character ROM has λ at 10, π at 12, √ at 25, μ at 26, α at 27, γ at 28, ∫ at 29 and β at 30 (the
  page says ∫ 10, √ 12, α 25, β 26, γ 27, λ 28, μ 29, π 30). The Phase 8 character map must use the
  ROM's.
- **A Phase 2 bug, fixed here:** the core raised NMI and never lowered it. The shared Z80 does not
  clear the line when it takes an NMI (the machine owns it, as on the ZX81), so after one RESET the
  CPU re-entered 0066h for ever. The Phase 2 probe passed because `READY` was still on the screen; it
  now blanks the screen first and checks that the NMI is taken once.
- §7's "Shift keeps the TRS-80 shifted symbols, which needs a character-level mapping" is read as:
  host keys go by position (SHIFT+2 is `"`, as on the ZX80/81), and the character-level mapping is
  the typer's. A host-character mapping would need a new mechanism in `useEmulatorKeyboard`.
- The video switches (VIDEO CUT, the dash) stay machine properties without menu items until the
  Phase 8 menus, which need settings for their check marks.
- Found in passing, not changed: the shared `Z80MachineBase.queueKeystroke` puts its edges on frame
  boundaries, the jitter fixed above for the HT. The ZX80/81 typer holds keys 4 frames and has not
  shown it.

