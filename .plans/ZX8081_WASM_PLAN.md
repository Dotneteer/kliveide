# Sinclair ZX80 / ZX81 on the WASM Core — Implementation Plan

**Status:** not started. Written 2026-09-27. **Start at §13 Phase 0.** The ZX81 virtual keyboard
design is approved and fully specified in §8.1; its mockup is `.plans/zx8081/zx81-keyboard-mockup.html`.
**Input:** Clock Signal (CLK) by Thomas Harte, MIT. The ZX80/81 sources are extracted to
`_input/clk-zx8081/` from commit `096de574…`, 2026-07-28; read its `README.md` first.
**Shape of the result:** one new C translation unit that `#include`s the shared Z80 core
`src/emu/z80/wasm/z80.c`, the same way the 48K, 128K, +3E, Next and Z88 do. There is no second CPU,
no copy of `z80.c`, and no TypeScript ZX81 machine.

---

## 0. Ground rules

### 0.1 Licence and provenance
- CLK is **MIT**. Porting and translating it is allowed, but every Klive file derived from a CLK file
  keeps the copyright and permission notice, as a header comment that names the upstream file.
  Add the CLK notice to Klive's third-party notices as well (create the file if none exists).
- The ROMs in `_input/clk-zx8081/roms/` are **not MIT**. They are free for non-commercial use, and
  their `readme.txt` notice must ship with them. See decision D5.
- Other GPL emulators (EightyOne, sz81, MAME `zx.cpp`, ZEsarUX) may be **run** as behavioural
  oracles. Their source is **not** read for design and **no** code is taken from them. This is the
  same rule the Klive BASIC plan applies to `zxbc`.
- CLK is a *design input*, not a drop-in. Its machine is written against a per-half-cycle bus model
  (`PartialMachineCycle`) and a CRT waveform, and Klive has neither (see §3). The port keeps CLK's
  **ULA logic and constants**. The plumbing is rewritten to Klive's hooks.

### 0.2 Reuse rules for the CPU (from `.ai/wasm-migration-intent-and-lessons.md`, "Shared CPU Intent")
- The machine configures `z80.c` through `#define Z80_*` hooks before `#include`. It never forks it.
- Anything the ZX81 needs that `z80.c` lacks goes into `z80.c` as a **default-no-op macro hook**, or
  as a behaviour fix mirrored in `src/emu/z80/Z80Cpu.ts`. It is tested on both CPUs, added to
  `scripts/check-wasm-cpu-contract.cjs`, and then **all five existing artifacts are rebuilt and
  retested**.
- A hook that no machine defines must leave every existing core **tact-identical**. The Z88 and Next
  goldens and the Spectrum contention tests are the proof.

### 0.3 Documents to read before working on this
- `.ai/wasm-v2-machine-migration-guide.md`: the full-machine recipe (frame lifecycle, loader
  validation, thin adapter, build pattern). Some paths in it are stale: `wasm/v2/common` is now
  `wasm/common`.
- `.ai/wasm-migration-intent-and-lessons.md`: shared-CPU intent, register mirroring, and why an
  interrupt acknowledge is an M1 but not an opcode fetch.
- `src/emu/machines/z88/wasm/README.md`: the non-Spectrum template this plan follows.
- `_input/Assembly Listing of the Operating System of the Sinclair ZX81..html`: the commented ROM.
  Every ROM address in this plan was checked against it.
- `_input/zx_go/001-machine-frame-and-device-weaving.md` §"M1 fetch", lines 85 and 175: an
  independent description of the same ZX80/81 display technique (an M1 hook that substitutes the
  opcode, lines advanced by HALT, a frame presented on VSYNC).

---

## 1. Goals and non-goals

### Goals
1. **ZX81** with 1K, 16K and 64K RAM, in PAL (UK) and NTSC (US) variants: SLOW and FAST modes,
   a stable display, and the keyboard.
2. **ZX80** with 1K and 16K RAM, and the "ZX80 with the 8K ROM" upgrade.
3. Load `.P` / `.81` (ZX81) and `.O` / `.80` (ZX80) files **instantly**, through a ROM trap, and
   **in real time** from a synthesized pulse train. Auto-type `LOAD ""` / `W` and auto-RUN.
4. Debugger parity with the other WASM machines: breakpoints (PC, memory, I/O), step into, over and
   out, CPU and memory panels, and a disassembler that understands ZX81 `RST $08` and `RST $28`.
5. The standard ZX81 hi-res techniques that ride on the same ULA mechanism (pseudo-hi-res with I
   pointing into RAM, and WRX) are **correct by construction**, because the ULA is emulated
   mechanically and not pattern-matched.

### Non-goals for this plan (possible follow-ups, listed in §14)
Chroma 81 colour, the ZonX and Quicksilva AY sound boards, the "VSYNC-as-sound" buzz, SAVE to `.P`,
TZX ZX81 blocks, the Timex TS1000/TS1500, the Lambda and other clones, CHR$128 and UDG boards,
printers, and the assembler's `.P` export and code injection.

---

## 2. Inventory: CLK files and where each one goes in Klive

| CLK file (`_input/clk-zx8081/core/…`) | Klive destination | Treatment |
|---|---|---|
| `Machines/Sinclair/ZX8081/ZX8081.cpp` | `src/emu/machines/zx8081/wasm/zx8081/zx8081-ula.c`, `zx8081-memory.c` and `zx8081.c` | **Port.** Keep the memory map, the ULA rules and the constants. Rewrite the bus plumbing to Klive's hooks (§5, §6). |
| `Machines/Sinclair/ZX8081/Video.cpp/.hpp` | `…/zx8081-video.c` | **Rewrite.** CLK feeds a CRT waveform. Klive needs a raster builder that writes an RGBA framebuffer (§7). Keep the semantics: sync is black, idle is white, 8 pixels per byte over 4 T. |
| `Machines/Sinclair/Keyboard/Keyboard.cpp/.hpp` | C: reuse `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-keyboard.c` through `#define` aliases (D3). TS: `Zx8081KeyCode.ts`, key mappings, and the auto-type character table. | **Port** the ZX80 and ZX81 character→key sequences to TS. The 8×5 matrix is the same as the Spectrum's. |
| `Storage/Data/ZX8081.cpp/.hpp` | `src/emu/machines/zx8081/ZxPFile.ts` | **Port** `.O`/`.P` recognition and the character-set→Unicode tables. The ZX81 table carries an upstream TODO: its block-graphics order is wrong, so correct it from the ROM character set. |
| `Storage/Tape/Formats/ZX80O81P.cpp/.hpp` | `src/emu/machines/zx8081/ZxPulseSynth.ts` | **Port**: file bytes → pulse lengths (150 µs pulses, 4 waves = 0, 9 waves = 1, 1300 µs gap, 1 s leader). Upload to WASM as a pulse list. |
| `Storage/Tape/Parsers/ZX8081.cpp/.hpp` | Not needed for Phase 4. | The fast load reads file bytes directly (§9.2). Port it only if TZX/WAV fast-loading is added. |
| `Analyser/Static/ZX8081/*` | The media-open path in `MainToEmuProcessor.ts` | **Port** the heuristics: file type picks the machine, size picks the memory model, and the auto-load command is `J""` + Enter (ZX81) or `W` + Enter (ZX80). |
| `reference/Processors/Z80/*` | Nothing | Read only, to understand WAIT and retroactive INT semantics (§3). |

---

## 3. The one real design problem: CLK's bus model versus Klive's Z80 core

CLK's machine is a `BusHandler`. The Z80 calls `perform_machine_cycle` for every **partial machine
cycle**, in half-cycles, and the machine can stretch any cycle with a WAIT line. Klive's `z80.c`
runs **one byte-cycle per `z80ExecuteCpuCycle()` call** (a prefix byte is its own call). The machine
sees only these hooks: memory/port delay and access, `Z80_TACT_PLUS_N`, the 1-T address-bus hook,
and `Z80_BEFORE/AFTER_OPCODE_FETCH` (unprefixed M1 only). INT and NMI are levels sampled at call
boundaries.

What the ZX81 ULA needs, and how each need is met:

| # | ULA behaviour (CLK `ZX8081.cpp` line) | Klive today | Resolution |
|---|---|---|---|
| a | **M1 NOP forcing.** An M1 fetch above 32K (A15 = 1) of a byte with bit 6 clear, while not HALTed, latches the byte for video and puts `$00` on the bus (l.276-280). | `Z80_AFTER_OPCODE_FETCH()` runs after the fetch and **before** dispatch, while `cpu.opCode` still holds the real byte and `cpu.pc` is still the fetch address (`z80.c:3164-3174`). | **No core code change.** Write the contract down in `z80.c`: "the hook may replace `cpu.opCode`". Add a core test that pins it (C2). |
| b | **Refresh-cycle character fetch.** At refresh, the ULA reads `(I:R & $FE00) \| (char & $3F) << 3 \| line_counter` from ROM or RAM, inverts it if char bit 7 is set, and shifts out 8 pixels (l.218-229). | The refresh is `refreshMemory(); tactPlus1WithAddress(IR)`. It is not distinguishable from other IR-on-bus internal cycles, and R has already been incremented. | **New hook C1: `Z80_REFRESH(address)`**, called at every refresh with the pre-increment I:R. |
| c | **INT on A6 during refresh.** INT is wired to A6, so it pulses for the refresh when R bit 6 = 0. It only takes effect if that refresh is the last T of the instruction (a 4-T single-M1 instruction, a forced NOP, or a HALTed cycle). CLK does this with `set_interrupt_line(true, -2)` and a retroactive sample (l.214-217, `Z80Implementation.hpp:1012-1029`). | There is no mid-instruction INT, and the halted cycle has no hook at all (`z80.c:3157-3161`). | C1 also fires on halted cycles. The machine records `intCandidateEndTact = tacts + 1` when A6 = 0. After the cycle returns, **if `cpu.tacts == intCandidateEndTact`**, it raises `sigInt` for the next boundary only, then drops it. This is an exact equivalent of the retroactive sample. |
| d | **NMI + WAIT.** At HSYNC start, with NMI enabled, NMI is asserted. While NMI is asserted and the CPU is **not** HALTed, WAIT is held until HSYNC ends (l.125-154). WAIT stretches any cycle, and the NMI acknowledge M1 in particular, between T2 and T3 (`Z80Storage.cpp` NMI program). This is what makes the display jitter-free. | There is no WAIT line. `processNmi` starts with a bare `tactPlusN(4)` (`z80.c:774`). | Memory and port cycles: the ZX81's `Z80_DELAY_MEMORY_*` / `Z80_DELAY_PORT_*` add wait tacts, **exactly like Spectrum contention** (`sp48.c:313`). NMI acknowledge: **new hook C3, `Z80_NMI_ACK_WAIT()`**, between 2 T and 2 T of `processNmi`'s 4 T. The NMI is edge-latched by the machine and cleared when C3 runs. |
| e | **Line timer reset on INT acknowledge.** It is set 2 half-cycles before the end of INTACK (l.200-207). This is how the ZX80 gets HSYNC at all. | `processInt` starts with a bare `tactPlusN(6)`. | **New hook C3′: `Z80_INT_ACK()`** after the 6 acknowledge tacts. The ULA sets `hcounter = 1 T`. |
| f | **R counts every M1.** The ZX81 ROM sets R with `LD R,A` so that "the transition from $FF to $80" triggers the line-end INT (ROM listing, `WAIT-INT` `$0041`). User hi-res drivers count R across arbitrary code. | **R is incremented once per prefixed instruction, not twice.** The second byte after `CB`/`ED`/`DD`/`FD` is fetched with `m1Active = 0` (`z80.c:3164`). `test/z80/ext-ops-50.test.ts` "LD A,R #1" pins R+1, and `Z80Cpu.ts:998-1015` does the same. | **Core fix C4 (decision D1).** The second M1 of a prefixed instruction increments R and fires C1. This is correct Z80 behaviour for every machine, not a ZX81 special case. |

Everything else, including memory mapping, ports, keyboard, tape and HALT display blanking, fits the
existing hooks as-is.

---

## 4. Architecture and file layout

### 4.1 C (one artifact, ZX80/ZX81 chosen at run time)
CLK uses `template<bool is_zx81>`. Klive uses **one module with a run-time `zx8081IsZx81` flag** set
by `zx8081HardReset(model…)`. The branches are cheap next to the rest of a cycle, and one artifact
halves the build and packaging work. If the benchmark in §12 says otherwise, split it into two
builds of the same source with `-DZX8081_IS_ZX81=0/1`.

```
src/emu/machines/zx8081/wasm/
  README.md                 build, ABI, exports (model it on the z88 README)
  Zx8081WasmV2Loader.ts     fetch/compile/validate/views (copy the Z88 loader's shape)
  dist/zx8081.wasm
  zx8081/
    zx8081.c                the TU: state, Z80_* hook #defines, #include z80.c, frame loop, exports
    zx8081-memory.c         ROM/RAM map, mirrors, Z80_READ/WRITE_MEMORY, peek/poke, ROM upload
    zx8081-ula.c            hcounter, HSYNC/VSYNC, NMI generator, WAIT, M1/refresh/INT logic, ports
    zx8081-video.c          raster builder → RGBA pixel buffer (§7)
    zx8081-tape.c           pulse player (EAR), motor control, fast-load trap (§9)
    (keyboard)              #include of zxSpectrum/wasm/common/zx-spectrum-keyboard.c via aliases (D3)
scripts/build-zx8081-wasm.cjs (+ .d.cts)
scripts/check-zx8081-wasm-size.cjs
```

The hook block in `zx8081.c` looks like this (names illustrative):

```c
#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR()               zx8081Memory
#define Z80_READ_MEMORY(a)             zx8081ReadMemory(a)
#define Z80_WRITE_MEMORY(a, v)         zx8081WriteMemory(a, v)
#define Z80_READ_PORT(a)               zx8081ReadPort(a)
#define Z80_WRITE_PORT(a, v)           zx8081WritePort(a, v)
#define Z80_DELAY_MEMORY_READ(a)       zx8081DelayMemory(a)   /* 3 T + ULA WAIT */
#define Z80_DELAY_MEMORY_WRITE(a)      zx8081DelayMemory(a)
#define Z80_DELAY_PORT_READ(a)         zx8081DelayPort(a)     /* 4 T + ULA WAIT */
#define Z80_DELAY_PORT_WRITE(a)        zx8081DelayPort(a)
#define Z80_TACT_PLUS_N(n)             zx8081AdvanceTacts(n)  /* ULA timer, video, tape */
#define Z80_AFTER_OPCODE_FETCH()       zx8081AfterM1()        /* (a) NOP forcing + latch */
#define Z80_REFRESH(address)           zx8081Refresh(address) /* (b)(c)  — new hook C1 */
#define Z80_NMI_ACK_WAIT()             zx8081NmiAckWait()     /* (d)     — new hook C3 */
#define Z80_INT_ACK()                  zx8081IntAck()         /* (e)     — new hook C3′ */
#include "../../../../z80/wasm/z80.c"
```

### 4.2 TypeScript (the Z88 pattern, not the Spectrum one)
`ZxSpectrumBase` carries Spectrum-only concerns: the ULA screen, TAP/TZX and sysvars. Follow
`Z88WasmHost extends Z80MachineBase` (`src/emu/machines/z88/Z88WasmHost.ts:62`).

```
src/emu/machines/zx8081/
  Zx8081WasmHost.ts         abstract host: registers (override every accessor, see lessons doc),
                            memory, ports, debug loop, frame execution, pixel/audio plumbing
  Zx8081WasmV2Machine.ts    concrete adapter
  Zx8081MachineFactory.ts
  zx8081MachineInfo.ts      models (§4.3)
  Zx8081KeyCode.ts          40 matrix keys; ZX80 and ZX81 legends
  Zx8081KeyMappings.ts      host key → matrix, incl. Backspace = SHIFT+0, cursor keys = SHIFT+5..8
  ZxPFile.ts                .P/.81/.O/.80 recognition + name/charset (from Storage/Data/ZX8081)
  ZxPulseSynth.ts           file → pulse list (from ZX80O81P)
  Zx8081Typer.ts            auto-type sequences (from Keyboard.cpp CharacterMapper)
```

Add a separation test in the style of the Z88 and Next ones: the host must not import TS machine
device code.

### 4.3 Machine IDs and models (decision D2)
Proposal: **two machine IDs, one host class and one artifact.**
- `MI_ZX81 = "zx81"`, with models `zx81-1k`, `zx81-16k`, `zx81-64k`, and the NTSC variants
  `zx81-16k-us` and so on.
- `MI_ZX80 = "zx80"`, with models `zx80-1k`, `zx80-16k`, `zx80-8krom-16k`.

The ZX80 and ZX81 have different keyboards, ROMs and file types, so users think of them as
different machines. Klive's registry already models memory and TV variants as models of one machine
(`sp48`: pal / ntsc / pal-16k).

---

## 5. Shared Z80 core changes (Phase 1, done before any ZX81 code)

Each change: edit `src/emu/z80/wasm/z80.c`; mirror any *behaviour* change in `src/emu/z80/Z80Cpu.ts`;
add a test to `test/z80/` and re-copy it into `test/wasm/z80/` (see that README, and remember the
stale-copy lesson); update `scripts/check-wasm-cpu-contract.cjs` and
`test/wasm/wasm-shared-z80-cpu-contract.test.ts`; then rebuild **sp48, sp128, spp3e, zxnext and
z88** and run their suites.

- **C1 — `Z80_REFRESH(address)`**, default no-op. It is called at every refresh: the unprefixed M1
  (`z80.c:3170`), the halted cycle (`z80.c:3159`), the NMI and INT acknowledges (`processNmi` and
  `processInt`, where `refreshMemory()` already runs), and the second M1 after C4.
  - `address` is `I:R` **before** the increment. That is what the real Z80 drives onto the bus. It
    matters: the ULA reads A6 and A9-A15 from it.
  - It is called immediately before the refresh tact, so "end of refresh" = `cpu.tacts + 1` at the
    moment of the call, on every path (§3 c).
- **C2 — the opcode-substitution contract.** No code change. Document at the `Z80_AFTER_OPCODE_FETCH`
  definition that the hook may overwrite `cpu.opCode` and that the dispatch uses the new value. Add a
  WASM-only corpus test using a tiny test TU in `test/wasm/z80/` that defines the hook: `$C000`
  holds `LD B,$01` and the hook forces NOP, so B is unchanged, PC advances by 1, and 4 T elapse.
- **C3 / C3′ — `Z80_NMI_ACK_WAIT()` and `Z80_INT_ACK()`**, default no-op. When
  `Z80_NMI_ACK_WAIT` is defined, `processNmi` does `tactPlusN(2); Z80_NMI_ACK_WAIT(); tactPlusN(2);`
  instead of `tactPlusN(4)`. That split only happens under `#ifdef`, so undefined machines keep the
  single `tactPlusN(4)` call and cannot change. `Z80_INT_ACK()` goes right after `processInt`'s
  `tactPlusN(6)`.
- **C4 — R increments on the second M1 of prefixed instructions (D1).** In `z80ExecuteCpuCycle`,
  the fetch that follows a `CB`/`ED`/`DD`/`FD` prefix is an M1. The `d` and opcode reads of
  `DDCB`/`FDCB` are **not** M1s. That second M1 does `refreshMemory()` and `Z80_REFRESH(IR)`.
  - **Tact placement does not move.** The existing trailing `tactPlusN(1)` stays where it is, so
    contention and every golden stay tact-identical. Only R and the hook change. The core carries
    the argument for why the ZX81's "end of refresh" rule still holds: the hook fires after the
    3-T read, and the trailing 1 T follows the operation.
  - Update the tests that pin the old R, including `ext-ops-50` "LD A,R" (A becomes R+2) and any R
    assertions in `test/z80/*`. Search for `.r)` and `cpu.r =` across the corpus.
  - Mirror the change in `Z80Cpu.ts:985-1015`. Check the Z88/Next goldens and the TS↔WASM parity
    suites. R changes in the CPU panel are expected, but no tact count may move.
- **Acceptance for Phase 1:** every existing WASM suite is green; the Spectrum contention tests are
  unchanged; the Z88/Next goldens are identical except for R-dependent values, which are reviewed
  one by one; `check:*-wasm-size` passes for all five.

---

## 6. The ULA and timing model (ported from CLK `ZX8081.cpp`)

Constants come from CLK and are re-checked against the ROM listing:

| | ZX81 | ZX80 |
|---|---|---|
| CPU clock | 3.25 MHz | 3.25 MHz |
| Line length | **207 T**; `hcounter` wraps modulo 207 | not wrapped; only reset by the INT acknowledge |
| HSYNC | T 16 – 32 (CLK: half-cycles 32 – 64) | T 13 – 33 (half-cycles 26 – 66) |
| NMI generator | yes (`OUT ($FE)` on, `OUT ($FD)` off) | none |
| RAM base / ROM size | `$4000` / 8K (the ROM is mirrored at `$2000` in the 1K/16K models) | `$4000` / 4K (mirrored) |

CLK's tables use half-cycles and Klive counts whole T-states. The ZX80 HSYNC start (26 half-cycles)
and end (66) are whole, but check every constant for off-by-one rounding.

**State:** `hcounter` (T), `lineCounter` (0-7), `nmiEnabled`, `nmiLine`, `nmiLatched`, `hsync`,
`vsync`, `latchedVideoByte`/`hasLatchedVideoByte`, `intCandidateEndTact`, `tvStandard` (bit 6),
the tape state and the memory model.

**`zx8081AdvanceTacts(n)` (`Z80_TACT_PLUS_N`)**, stepping T by T (n is small):
- `hcounter++`.
- When `hcounter` crosses HSYNC start: HSYNC on, `lineCounter = (lineCounter + 1) & 7`; if NMI is
  enabled, set `nmiLine` and latch the NMI edge (`nmiLatched = 1`).
- When it crosses HSYNC end: HSYNC off; if NMI is enabled, clear `nmiLine`.
- ZX81: wrap at 207.
- Advance the video raster (§7) and the tape (§9). Add `n` to `cpu.tacts`.

**WAIT (`zx8081DelayMemory` / `zx8081DelayPort`):** apply the base 3 T / 4 T, then, **while
`nmiEnabled && nmiLine && !cpu.halted`, keep advancing 1 T**. That drains exactly to the end of
HSYNC. CLK samples WAIT at T2, and Klive's delay hooks run before the access. The ≤2-T placement
difference is recorded here and checked in the Phase 3 timing test.

**`zx8081NmiAckWait()` (C3):** the same WAIT drain, then `nmiLatched = 0`. The frame loop sets
`z80SetSigNmi(nmiLatched)` before each cycle. The Z80's NMI is edge-triggered, so the latch is the
edge.

**`zx8081IntAck()` (C3′):** `hcounter = 1` (CLK: "reset, then advanced twice" in half-cycles).

**Ports** (only A0 and A1 are decoded, as in CLK):
- **OUT, any port:** if NMI is disabled, `lineCounter = 0` and VSYNC off. `A1 = 0` → NMI off.
  `A0 = 0` → NMI on (ZX81 only). On the ZX81, NMI off also releases WAIT.
- **IN with A0 = 0:** if NMI is disabled, VSYNC on. The result is the keyboard rows selected by the
  high byte (bits 0-4), **bit 6 = the TV standard** (0 on a US machine: "the US machine has an extra
  diode", ROM `KEYBOARD` → `MARGIN` 31 vs 55; CLK always returns 1), and **bit 7 = the tape EAR**.
  Bit 5 is 1.
- Other IN reads return `$FF`.

**`zx8081AfterM1()`**, case (a): if `!cpu.halted && (pc & 0x8000) && !(cpu.opCode & 0x40)`, latch
`cpu.opCode` for video and set `cpu.opCode = 0x00`. The ROM runs the display file through its
upper-32K echo (`SET 7,H` at `NMI-CONT`), and `HALT` ($76, bit 6 set) ends each line.

**`zx8081Refresh(address)`**, cases (b) and (c):
- (c) If `!(address & 0x40)`, set `intCandidateEndTact = cpu.tacts + 1`.
- (b) If a video byte is latched: `charAddr = (address & 0xFE00) | ((b & 0x3F) << 3) | lineCounter`.
  Read it from ROM when `charAddr < ramBase`, otherwise from RAM **at `charAddr`**. CLK reads
  `ram_[address & ram_mask_]` here, which looks like a bug for character sets in RAM; confirm it
  with a pseudo-hi-res test before relying on either. XOR `$FF` unless bit 7 of the character is
  set, emit 8 pixels at the current beam position (§7), and clear the latch.

**Frame loop (`zx8081ExecuteInstruction`)**, following `sp48ExecuteInstruction` and
`zxnext-cpu.c:348` (`do … while (prefix)`):
1. `z80SetSigNmi(nmiLatched)`.
2. `z80SetSigInt(intPending)`, then `intPending = 0`.
3. `z80ExecuteCpuCycle()`, repeated while a prefix is pending.
4. If `intCandidateEndTact == cpu.tacts`, then `intPending = 1`. Clear the candidate.
5. Tape trap checks (§9) and the frame-end check.

An *emulation* frame is a fixed 65 000 T (3.25 MHz / 50) for host pacing and audio, or 54 167 T at
60 Hz. The *TV* frame is independent and ends on VSYNC (§7).

---

## 7. Video: turning sync and pixel bytes into a framebuffer

This replaces CLK's `Video.cpp` + `Outputs::CRT`. Klive's renderer consumes an RGBA `0xAABBGGRR`
buffer with a width, a height and a start offset (`useEmulatorScreen.ts:362-388`).

- **Beam model.** `x = (T since the end of the last HSYNC) × 2` pixels, because the ULA shifts one
  pixel per half-T and a byte covers 4 T. The raw line is 414 px (207 T × 2). `y` advances at the
  end of each HSYNC.
  - A VSYNC that lasts longer than one line (CLK treats sync as sync, whatever its length) ends the
    TV frame. When it ends, publish the back buffer and set `y = 0`.
- **Levels.** Sync (HSYNC or VSYNC) paints black. Idle paints white. A shifted byte paints ink
  black / paper white, MSB first. This reproduces the real LOAD/SAVE stripes and the FAST-mode
  flashes for free: the ROM's `IN A,($FE)` / `OUT ($FF),A` toggle VSYNC (`IN-BYTE`, `$0350`).
- **Visible window (decision D4).** Crop a fixed window from the raw 414 × ~310 raster: proposed
  **352 × 288** at an offset tuned so that the ROM's 256 × 192 picture is centred at `MARGIN` = 55
  (PAL). This matches the Spectrum's bordered look; CLK shows the centre 80 %. The window is part
  of the model timing table so NTSC (262 lines, `MARGIN` 31) gets its own offset.
- **No sync (TV flywheel).** If no VSYNC arrives within ~1.25 frames of lines (FAST mode, or a
  crashed program), end the frame anyway, as a TV's vertical oscillator free-runs. The result, a
  rolling or blank picture, is correct.
- Double-buffer, so the IDE's `renderInstantScreen` and screenshots show the last complete picture.
- Export `zx8081PixelBufferPtr`, `zx8081GetScreenWidth/Height`,
  `zx8081GetPixelBufferStartOffset` and the aspect ratio, with the same names and shape as sp48.

---

## 8. Keyboard

- **C.** The ZX80/81 matrix is the Spectrum's 8×5 on port `$FE` (high byte selects rows; ZX81 `.`
  sits where the Spectrum's Symbol Shift is). Reuse `zx-spectrum-keyboard.c` (43 lines) with
  `#define sp48KeyboardLines zx8081KeyboardLines` and similar aliases, as `sp128.c` does (D3).
  Export `zx8081SetKeyStatus(key = line * 5 + bit, down)`.
- **TS.** `Zx8081KeyCode.ts`, the host mappings (port CLK's `KeyboardMapper`: Backspace → SHIFT+0,
  arrows → SHIFT+5..8, Escape → BREAK = SHIFT+SPACE), and the auto-typer tables from CLK's
  `CharacterMapper`.
- **Virtual keyboard.** Fully specified in §8.1; the design was approved on 2026-09-27. The
  ZX80 keyboard (§8.1.9) is not designed yet.

### 8.1 The ZX81 virtual keyboard: approved design, not yet built

**Status:** mockup approved by the project author on 2026-09-27. **The React component is
deliberately not built yet.** Build it from this section and the mockup, and do not re-derive the
design.

- **Mockup (source of truth for geometry and legends):** `.plans/zx8081/zx81-keyboard-mockup.html`.
  It is standalone, so open it in a browser. It is interactive: hover zones, press state, and a
  readout of the keystrokes each click would send.
- **Reference photo:** <https://dn710202.ca.archive.org/0/items/ZX81_Keyboard_Layout/ZX81_keyboard.jpg>
  (629 × 228 px). Every measurement below comes from it. The mockup was checked side by side with
  the photo in a browser over three rounds.
- **Legend source:** the ZX81 ROM key tables `K-UNSHIFT` `$007E`, `K-SHIFT` `$00A5`, `K-FUNCT`
  `$00CC` and `K-GRAPH` `$00F3`, in `_input/Assembly Listing of the Operating System of the Sinclair ZX81..html`.
  `FETCH-1` (`$04F7`) indexes `K-GRAPH` from `$00C7`, so the graphics table starts at key **A**.
  That is why Z, X, C, V, B, N, M, `.` and the other non-graphics keys carry none. The photo
  confirms the ROM-derived glyph for every key.

#### 8.1.1 How the existing 48K keyboard works (the pattern to follow)
Files: `src/renderer/appEmu/Keyboard/Sp48Keyboard.tsx`, `Sp48Key.tsx`, `keyboard-common.tsx`,
`useKeyboard.ts` and `KeyboardPanel.tsx`.
- **One `<svg>` per key**, with `viewBox` in key units (a normal key is 100 wide).
  - Rendered size = units × `zoom`, where `zoom = calculateKeyboardZoom(width, height,
    DEFAULT_WIDTH, DEFAULT_HEIGHT)`.
  - Rows are `Row`s inside a `Column` (`keyboardRootStyle` / `keyboardRowStyle`). A row's stagger is
    a `marginLeft` of `units × zoom`. The key gap is the SVG's `marginRight`.
- **Clickable zones.** Each key has independent zones with their own hover state and
  `onMouseDown`/`onMouseUp`, raising `keyAction({ code, keyCategory, button, down })`. The categories
  are `main`, `symbol`, `above`, `below`, `topNum` and `glyph`.
  - A hovered zone's legend turns `--color-key48-highlight`, and a pressed key's background
    becomes `--bgcolor-hilited48`.
- **`handleClick`** does the following:
  - `main` → `setKeyStatus(code)`, plus CAPS SHIFT on the right button.
  - `symbol` → the key plus SYMBOL SHIFT.
  - `above`, `below` and `glyph` → `machine.queueKeystroke(startFrame, frames, primary, secondary)`
    sequences.
  - It ignores clicks while `machine.getKeyQueueLength() > 0`.
- **`useKeyboard(apiLoaded)`** supplies `isPressed(code)` for the physical-keyboard feedback.
- Colours are read with `useTheme().getThemeProperty("--token")`, because the key SVGs are
  imperative (M4). The legend colours are `--device-*` tokens and are theme-invariant (device
  surfaces have no light mode).
- **Trap:** `KeyboardPanel.tsx` renders `Sp128Keyboard` for **every unknown machine type**.
  Until `zx81` (and `zx80`) are wired in explicitly, they silently get the Spectrum 128 keyboard.

#### 8.1.2 Files to create or touch
- `src/renderer/appEmu/Keyboard/Zx81Key.tsx`: one key. Its props follow `Sp48Key`'s idea, but the
  zones are ZX81 ones (§8.1.5).
- `src/renderer/appEmu/Keyboard/Zx81Keyboard.tsx`: the layout and `handleClick`, using the key
  table in §8.1.4 (lift it verbatim from the mockup's `R` array).
- `KeyboardPanel.tsx`: add `type === "zx81"` → `<Zx81Keyboard …/>`, and exclude it from the
  Sp128 fallback.
- **Tokens (no literal colours in the component — AGENTS.md):**
  - Add to L1 `DEVICE` in `src/renderer/theming/tokens/palette.ts`: `keyZx81` (the key face,
    mockup `#f4f4f4`), `legendZx81Ink` (the black main legend, `#111`), `legendZx81Red` (the red
    shifted legend, `#d42020`), `zx81Body` (`#0a0a0a`), and `zx81GlyphFrame` (`#555`).
  - Expose them at L2 as `--device-*` (`semantic.ts:187-195`) and at L4 in `componentAliases.ts`,
    next to the keyboard block at l.253-269: for example `--bgcolor-keyzx81`, `--color-keyzx81-main`,
    `--color-keyzx81-shift`, `--color-keyzx81-legend` (the white keyword/function print, which
    can reuse `--device-legend-main`), `--color-keyzx81-highlight` → `var(--accent-solid)` and
    `--bgcolor-hilitedzx81` → `var(--accent-subtle)`.
  - The panel ground is `--bgcolor-keyboard`. Decide whether the ZX81's pure-black body is worth
    its own token or whether the shared `#181818` body is close enough; the mockup used
    `#0a0a0a`.
- Update `.ai/ui-theming-intent-and-lessons.md` in the same change (standing rule). Record the
  durable lesson: *device keyboards may use a light key face; hover on a white key must use the
  accent's dark end, not the light highlight used on grey keys* (§8.1.6).
- `emuOptions.keyboardPanelHeights` (see the theming notes, "each machine has its own keyboard
  height"): give `zx81` a default that suits the 1382 × 501 aspect ratio.
- A jsdom test in the style of the existing keyboard tests: it renders all 40 keys, each zone
  raises the right `keyCategory`, and the right button on a main key adds SHIFT.

#### 8.1.3 Geometry (units; a key is 100 wide)
Measured from the photo: a key is 45.5 × 34 px, the horizontal pitch is 58.3 px, the vertical pitch
is 56.7 px, and the row starts are x = 7, 38, 52 and 24 px (top row y = 7 px). The scale is
`U = 100 / 45.5 = 2.1978`.

| Quantity | Photo px | Units | Notes |
|---|---|---|---|
| Key face | 45.5 × 34 | **100 × 74.7** | Every key is the same size, **including SHIFT, NEW LINE and SPACE**. `rx = 8`. |
| Horizontal pitch / gap | 58.3 / 12.8 | **128.1 / 28.1** | The gap becomes the SVG's `marginRight = 28.1 × zoom`. |
| Vertical pitch | 56.7 | **124.6** | Keyword band + key + function band. The per-key SVG cell is 100 × 124.6, with the key face at y = 24. |
| Row stagger vs. row 1 | 0 / 31 / 45 / 17 | **0 / 68.1 / 98.9 / 37.4** | Rows: digits, Q…P, A…NEW LINE, SHIFT…SPACE. |
| Outer margin | 7 | 15.4 | |
| Whole keyboard | 629 × 228 | **1382 × 501** | Suggested `DEFAULT_WIDTH = 1382` and `DEFAULT_HEIGHT = 501` for `calculateKeyboardZoom`. |

**Positions inside a key**, with (0,0) at the top-left of the key face. In the per-key SVG, add 24
to every y.

| Element | Position / size | Font |
|---|---|---|
| Keyword above the key (PLOT, NEW…) | x 6, baseline −6; hit band y −24…−2 | 17, bold, white |
| Function below the key (SIN, ARCSIN, π…) | x 6, baseline 93.7 (key + 19); hit band 76.7…98.7 | 17, bold, white |
| Main character | x 10, baseline 64 | 46, bold, black |
| Red word legend (EDIT, STOP, LPRINT…) | right-aligned at x 92, baseline 21 | regular. **18** for ≤ 4 letters, **16** for 5–6, **11.5** for GRAPHICS/FUNCTION |
| Red two-character symbol (`<=`, `<>`, `>=`, `**`, `""`) | right-aligned at x 93, baseline 27 | 28. Regular with letter-spacing 1.5, except **`**` and `""` are bold, with no spacing** (bold `<=` renders cramped) |
| Red one-character symbol (`$ ( ) " − + = : ; ? / * < > ,`) | right-aligned at x 88, baseline 33 | 31. Regular, except `"` is bold |
| Cursor arrows (5–8) | a red **outlined** polygon, stroke 2.2, no fill, in a 36 × 20 box at (54, 4) | see the polygons below |
| Graphic glyph | a 2 × 2 grid of 14.5-unit squares at (60, 32), i.e. 29 × 29, with a `#555` frame of stroke 1.4 | chequer = a 3.4-unit pattern of 1.7-unit black/white checks |
| SHIFT key | "SHIFT" centred, baseline 47 | 23, regular, **red** |
| NEW LINE key | "NEW" at baseline 48 and "LINE" at 64, centred, black; red "FUNCTION" centred at baseline 19 | 15 regular; FUNCTION 12 |
| SPACE key | "SPACE" centred at baseline 64, black; red "£" centred at baseline 30; the keyword above is "BREAK" | 14 regular; £ 24 |
| `0` key | main legend is **Ø** (slashed zero, as printed) | |

Arrow polygons, in box coordinates:
- left `0,9 11,0 11,5 36,5 36,13 11,13 11,18`
- right `36,9 25,0 25,5 0,5 0,13 25,13 25,18`
- down `18,20 4,8 12,8 12,0 24,0 24,8 32,8`
- up `18,0 4,12 12,12 12,20 24,20 24,12 32,12`

Font: `Helvetica, Arial, sans-serif`. The photo's face is a condensed, heavier Helvetica; Arial is
slightly wider. That is the only known visual gap, and it was accepted.

#### 8.1.4 Key table
Codes are Klive's `line × 5 + bit`, the same numbering as `Sp48Keyboard.tsx`. The ZX81 matrix is
identical, and `.` (36) is where the Spectrum has SYMBOL SHIFT. **Shifted** is the red legend,
**Above** is the keyword, **Below** is the function, and **Glyph** is the ZX81 character code of the
block graphic.

| Row | Key (code) | Shifted | Above | Below | Glyph |
|---|---|---|---|---|---|
| 1 | 1 (15) | EDIT | – | – | $01 ▘ |
| 1 | 2 (16) | AND | – | – | $02 ▝ |
| 1 | 3 (17) | THEN | – | – | $87 ▗ |
| 1 | 4 (18) | TO | – | – | $04 ▖ |
| 1 | 5 (19) | ⇦ (outlined) | – | – | $05 ▌ |
| 1 | 6 (24) | ⇩ (outlined) | – | – | $83 ▄ |
| 1 | 7 (23) | ⇧ (outlined) | – | – | $03 ▀ |
| 1 | 8 (22) | ⇨ (outlined) | – | – | $85 ▐ |
| 1 | 9 (21) | GRAPHICS | – | – | – |
| 1 | Ø (20) | RUBOUT | – | – | – |
| 2 | Q (10) | `""` | PLOT | SIN | $81 ▟ |
| 2 | W (11) | OR | UNPLOT | COS | $82 ▙ |
| 2 | E (12) | STEP | REM | TAN | $07 ▛ |
| 2 | R (13) | `<=` | RUN | INT | $84 ▜ |
| 2 | T (14) | `<>` | RAND | RND | $06 ▞ |
| 2 | Y (29) | `>=` | RETURN | STR$ | $86 ▚ |
| 2 | U (28) | `$` | IF | CHR$ | – |
| 2 | I (27) | `(` | INPUT | CODE | – |
| 2 | O (26) | `)` | POKE | PEEK | – |
| 2 | P (25) | `"` | PRINT | TAB | – |
| 3 | A (5) | STOP | NEW | ARCSIN | $08 chequer |
| 3 | S (6) | LPRINT | SAVE | ARCCOS | $0A chequer top |
| 3 | D (7) | SLOW | DIM | ARCTAN | $09 chequer bottom |
| 3 | F (8) | FAST | FOR | SGN | $8A inv. $0A |
| 3 | G (9) | LLIST | GOTO | ABS | $89 inv. $09 |
| 3 | H (34) | `**` | GOSUB | SQR | $88 inv. chequer |
| 3 | J (33) | `−` | LOAD | VAL | – |
| 3 | K (32) | `+` | LIST | LEN | – |
| 3 | L (31) | `=` | LET | USR | – |
| 3 | NEW LINE (30) | FUNCTION | – | – | – |
| 4 | SHIFT (0) | – | – | – | – |
| 4 | Z (1) | `:` | COPY | LN | – |
| 4 | X (2) | `;` | CLEAR | EXP | – |
| 4 | C (3) | `?` | CONT | AT | – |
| 4 | V (4) | `/` | CLS | – | – |
| 4 | B (39) | `*` | SCROLL | INKEY$ | – |
| 4 | N (38) | `<` | NEXT | NOT | – |
| 4 | M (37) | `>` | PAUSE | π | – |
| 4 | . (36) | `,` | – | – | – |
| 4 | SPACE (35) | £ | BREAK | – | – |

**Glyph quadrants** (TL, TR, BL, BR; i = ink, p = paper, g = chequer):

| Code | Quadrants | Code | Quadrants |
|---|---|---|---|
| $01 | i p p p | $06 | p i i p |
| $02 | p i p p | $07 | i i i p |
| $03 | i i p p | $08 | g g g g |
| $04 | p p i p | $09 | p p g g |
| $05 | i p i p | $0A | g g p p |

Bit 7 set means inverse: ink and paper swap, and the chequer is drawn the same.

Deliberate choices:
- The photo prints "IN KEY$"; the component uses `INKEY$`.
- The screen tokens are ASN, ACS and ATN, but the keyboard prints ARCSIN, ARCCOS and ARCTAN, and
  the virtual keyboard follows the keyboard.

#### 8.1.5 Zones and what a click sends
| Zone | Hit area | Left button | Right button |
|---|---|---|---|
| `main` | the key face **and** the keyword above it | `setKeyStatus(code)` while held | the key + SHIFT (0) while held, as the 48K does with CAPS SHIFT |
| `shift` | the red legend or arrow (top of the key; x 40…97, y 2…28; on NEW LINE and SPACE x 15…85) | the key + SHIFT (0) while held | same |
| `below` (function) | the function text under the key | queue SHIFT + NEW LINE (FUNCTION mode), then the key | same |
| `glyph` | the graphic box | queue SHIFT + 9 (GRAPHICS on), SHIFT + key, SHIFT + 9 (GRAPHICS off) | same |

- The ZX81 has no separate symbol-shift or extended mode, so this is simpler than the 48K. There is
  no `topNum` zone and there are no ink colours.
- Clicking the keyword above a key is the same as the main key: the ROM shows the keyword whenever
  it is in K mode. There is no separate "keyword" keystroke.
- Keep the 48K's guard: ignore clicks while `getKeyQueueLength() > 0`. The 48K's glyph trick
  (queued GRAPHICS toggles) has a documented race on fast repeat clicks (docs,
  `getting-started/keyboard.mdx` "Known Issues"). The ZX81 version inherits it. A cursor-mode check
  equivalent to `getCursorMode()` needs the ZX81 `MODE` system variable (`$4006`, see `K-DECODE`
  `$04DF`); add it to the host once the machine exists.
- Queue timing: reuse the 48K's frame offsets (0, 3, 10 frames with a 2-frame hold) as the
  starting values. Verify them on the real ROM with the harness, because the ZX81 in SLOW mode
  scans the keyboard once per frame.

#### 8.1.6 Visual states
- **Hover:** only the hovered zone's legend changes colour. On a **white** key the highlight must be
  the accent's *dark* end: the mockup uses `#185FA5` for the main/red legends and draws the glyph
  frame at stroke 3. The keyword and function text on the black body use the *light* end
  (`#85B7EB`). The 48K's single `--color-key48-highlight` is not enough here, so the ZX81 needs
  two highlight tokens, or `--accent-solid` plus a light accent step.
- **Pressed** (mouse or physical key via `isPressed`): the key face becomes the light accent
  (`#B5D4F4` in the mockup), and legends stay readable on it.

#### 8.1.7 Verification when the component is built
- Render it in the running app, not a replica (AGENTS.md; the CDP recipe is in
  `.ai/ui-theming-intent-and-lessons.md`). Screenshot the keyboard panel, open the reference photo
  scaled to the same width, and compare them side by side. Row stagger, key ratio and legend
  positions must match the mockup.
- Check the smallest keyboard panel height. At small zoom the 11.5-unit legends (GRAPHICS,
  FUNCTION) are the first to become unreadable, the same trade-off the 48K accepts.
- The style mandates apply to anything outside the SVG: M1 (no `em` fonts), M2 (`ch` widths) and
  M3 (row-size tokens). The SVG internals use viewBox units, exactly like `Sp48Key`.

#### 8.1.8 Where the keyboard lands in the phases
The component itself is **Phase 4** (§13, "Keyboard + files"). It depends on the machine existing
(the `zx81` ID in `KeyboardPanel`, `setKeyStatus` and `queueKeystroke` on the host). The tokens and
the static component could land earlier behind the `zx81` type check, since nothing renders them
until the machine is registered.

#### 8.1.9 ZX80
Not designed. The ZX80 uses the same matrix and the same component structure, but a different
legend set: keywords printed on the keys, no function mode, and a different shifted-symbol layout.
It needs its own reference photo and its own key table, built from the **ZX80** ROM key tables.
Reuse `Zx81Key.tsx` if the legend positions allow it; otherwise add `Zx80Key.tsx`.

---

## 9. Files and tape

### 9.1 Opening files (TS)
- Register `.p`, `.81`, `.o`, `.80` in `src/renderer/registry.ts` (next to `.tzx`/`.tap`,
  l.613-630) and in the tape dialog filter (`src/main/machine-menus/zx-specrum-menus.ts:213`, or a new
  ZX81 menu module).
- `MainToEmuProcessor.setTapeFile` (l.135) currently tries TZX then TAP. Add a ZX8081 branch keyed on
  the extension, validated by `ZxPFile.ts` (CLK `FileFromData`).
  - CLK prepends `$80`, a nameless-file marker, to `.P` data so the ROM's name compare accepts
    `LOAD ""`. Keep that.
- **Auto-load (from CLK `StaticAnalyser`):** pick ZX80 or ZX81 from the file, `> 1K` → the 16K
  model, then type `J""` + Enter (ZX81) or `W` + Enter (ZX80). When PC reaches the "load finished"
  address (ZX81 `$06D1`, ZX80 `$0203`, per CLK), type `RUN`. Both addresses are behind an option,
  as in CLK's `quick_load`.

### 9.2 Fast load (ROM trap)
The ZX81 `LOAD` (`$0340`) reads the name, then loops at `IN-PROG` `$037B`:
`LD D,B` / `CALL IN-BYTE ($034C)` / `LD (HL),C` / `CALL LOAD/SAVE`.
- CLK traps the M1 at **`$037C`** (the `CALL IN-BYTE`), writes the byte to `(HL)` itself, forces a
  NOP and resumes at **`$0380`**. ZX80: trap `$0220`, return `$0248`.
- Klive does the same in the frame loop's trap check (step 5 in §6), with the byte coming straight
  from the uploaded file. No pulse parsing is needed, because the file *is* the byte stream.
- The name loop at `$0366` also calls `IN-BYTE`. Either feed it from the trap too, by trapping at
  the `IN-BYTE` entry `$034C` with the byte in C and a simulated `RET`, or rely on the `$80`
  nameless prefix as CLK does. **Verify** which the ROM accepts against the listing and a test.

### 9.3 Real-time load
- `ZxPulseSynth.ts` turns the file into pulse lengths in T-states, and they are uploaded with a
  `zx8081TapeBeginUpload / SetPulses / FinishUpload` API in the style of sp48's.
- `zx8081-tape.c` plays them into EAR (port `$FE` bit 7).
- Automatic motor control, following CLK: the tape runs only while `$0340 ≤ PC < $03C3` (ZX81) or
  `$0206 ≤ PC < $024D` (ZX80), plus the IDE's play/stop.
- Spectrum tape code (`zx-spectrum-tape.c`) is **not** reused: its traps and block model are
  Spectrum-ROM specific.

---

## 10. Audio
A stock ZX80/81 has no sound, so Phases 1-5 produce **silence** through the standard sample buffer
ABI (`zx8081AudioSamplesPtr` and so on), so the host code stays uniform. Follow-ups (§14):
- the ZonX AY at ports `$CF`/`$0F` with mask `$EF` (CLK `ZX8081.cpp:172-196`), reusing
  `zx-spectrum-psg.c` through aliases;
- the Quicksilva board (memory-mapped `$7FFE`/`$7FFF`, a TODO in CLK);
- the VSYNC buzz (the real TV sound that some programs use as a beeper).

---

## 11. IDE integration checklist
- `src/common/machines/constants.ts`: `MI_ZX80`, `MI_ZX81`, and any `MC_*` keys (memory model, TV
  standard, quick-load, auto-motor).
- `src/common/machines/machine-registry.ts`: two entries. `features` must set `MF_Z80`,
  `MF_TAPE_SUPPORT` and `MF_INJECT_SUPPORT: false` for now; `models`; `mediaIds`; `toolInfo` with a
  custom disassembler.
  - `charSet`: a **ZX81 character map**, since the memory panel otherwise shows Spectrum ASCII.
    Reuse `ZxPFile.ts`'s tables.
- `src/common/machines/machine-renderer-registry.ts`: factories.
- `src/main/machine-menus/machine-menu-registry.ts`: menus (tape open/play/rewind, memory model,
  quick-load).
- `src/renderer/appEmu/tool-registry.tsx`: only if a tool area is needed. Nothing is needed
  initially.
- **Disassembler:** `src/renderer/appIde/disassemblers/z80-disassembler/zx81-disassembler.ts`, modelled
  on `zx-spectrum-48-disassembler.ts`.
  - `RST $08` is followed by an error-code byte.
  - `RST $28` enters the ZX81 calculator, whose byte-codes run until `end-calc`. The code table
    differs from the Spectrum's, so build it from the ROM listing.
  - Also show the display file as `DEFB` when it is viewed outside execution.
- **Debugger:** `executeWasmDebugLoop` works as in sp48 (PC checks per `zx8081ExecuteInstruction`).
  - Note for users and tests: while the display file executes, the CPU runs **forced NOPs** at
    `$C000+`, so the disassembly (real memory) and the executed instruction differ. The CPU panel's
    "last opcode" should show the executed `$00`.
- **ROMs:** `src/public/roms/zx80.rom`, `src/public/roms/zx81.rom` and the notice file (D5). They
  load through `loadRomFromResource`.
- **Packaging:** `package.json` gets the `build:zx8081-wasm` / `check:zx8081-wasm-size` scripts, an
  entry in `build:all-wasm`, and an `extraResources` entry (`src/emu/machines/zx8081/wasm/dist` →
  `wasm/zx8081`). Check a packaged build.
- **Docs site:** a ZX80/81 page under `docs/content/`, with screenshots generated by
  `scripts/doc-shots/` (read `.ai/doc-screenshots-guide.md`).

---

## 12. Tests
All tests run the real WASM machine.
- **Core (Phase 1):** C1-C4 tests on both CPUs, with the ZX81-free test TU for C1/C2/C3. They check:
  the refresh address is pre-increment on every path; the halted cycle fires C1; the NMI split is
  tact-identical when the hook is undefined; R after `CB`/`ED`/`DD`/`FD`/`DDCB` rises by 2.
- **Harness `test/harness/zx81/`**, copying `test/harness/sp48/` (index, session, README,
  self-tests). API: `bootToBasic()`, which waits for the `K` cursor; `typeKeys`; `runFrames`;
  `runTo`; `step`; `peek`/`poke`; `loadP(file)`; `screenText()`, which reads the D_FILE via
  `$400C` and maps characters; `screenPixels()`.
- **ULA timing tests** (`test/zx8081-hw/`):
  - SLOW mode yields a VSYNC every ~20 ms (PAL) and ~16.7 ms (NTSC, bit 6 = 0 → `MARGIN` 31);
  - each display line is exactly 207 T;
  - the display file start is jitter-free frame to frame, which proves the WAIT/NMI synchronisation;
  - `LD R,A` / `EI` / `JP (HL)` yields the INT at the expected T. This is the ROM's own `WAIT-INT`
    path.
- **Screen goldens:** the boot screen; `PRINT` of the full character set (inverse included); `PLOT`
  graphics; FAST vs SLOW; a pseudo-hi-res program with I pointing into RAM (this settles the CLK
  RAM-address question in §6).
  - Test programs are **written for Klive** (typed via the harness or assembled), **or** taken from
    `_input/zx81-tapes/`: 26 files from their authors' own repositories, all under MIT or the
    Unlicense, each pinned to a commit, with licence texts in `licenses/`. Read its README.
    - Any other third-party `.P` file needs the same provenance before it enters the repo, which
      rules out commercial or "abandonware" titles.
    - A test fixture copied from there must bring its licence file along.
  - Suggested first uses:
    - `machine-code/dezog-sample.p`: known behaviour (press S, then the screen fills).
    - `basic/Characters.P`: a character-set golden.
    - `hi-res/*`: the §6 RAM-address question and WRX.
- **Tape:** a fast load and a real-time load of the same `.P` both end in identical RAM; auto-RUN
  works; motor control stops the tape outside the ROM range.
  - Loader robustness uses `_input/zx81-tapes/edge-cases/`: `zero.p` must be rejected cleanly and
    `minimal.p` must load.
  - Also: `basic/BASE.p` and `POKE1.p`, which have bytes after E_LINE; `1k/byteForever.p` and
    `rcar.p`, which hold garbage in the system variables; `1k/chess.p`, which exceeds 1K.
  - Once TZX block `$19` is supported (§14), `p-and-tzx/` gives the same program as `.P` and
    `.TZX`, and both must end in identical RAM.
- **Oracle runs, manual and never in CI:** run the same programs in CLK (build it from the scratch
  checkout) and in EightyOne, and compare screens. Record the observed results in Klive's words.
- **Performance:** `benchmark:zx8081-wasm` must show more than 10× real time in SLOW mode, to catch
  per-T hook cost early.
- Contract updates: `check-wasm-cpu-contract.cjs` (id `zx8081`,
  `forbiddenIncludeFragments` = everything under `zxSpectrum/wasm/common/` except
  `zx-spectrum-keyboard.c` and, later, `zx-spectrum-psg.c`), and
  `wasm-shared-z80-cpu-contract.test.ts:61`.

---

## 13. Phases and exit criteria

| Phase | Content | Exit criteria |
|---|---|---|
| **0. Decisions** | Settle D1-D6 with the project author. | Decisions recorded in §15. |
| **1. Core hooks** | C1-C4 (§5). | All five existing artifacts rebuilt; every suite green; goldens identical except reviewed R-values; size checks pass. |
| **2. Skeleton** | `zx8081.c` TU; memory map (1K/16K/64K, mirrors); ROM upload; ports without ULA timing; frame loop; loader; host; registry entry for **ZX81 16K** only; build and contract scripts. | The ROM runs; `bootToBasic()` reaches the `K` cursor, observed through D_FILE memory, not pixels. |
| **3. ULA + video** | §6 and §7: NMI/WAIT, INT-on-A6, M1 NOP forcing, refresh fetch, raster builder, sync-driven frames, FAST/SLOW. | The boot screen golden matches; ULA timing tests pass; typing `PRINT "HELLO"` renders; no jitter over 100 frames. |
| **4. Keyboard + files** | §8 and §9: host mappings, the virtual keyboard (built to the approved design in §8.1), `.P` open, fast load, real-time load, auto-type and auto-RUN, motor control. | Tape tests pass; a `.P` opened from the IDE runs by itself; the virtual keyboard matches `.plans/zx8081/zx81-keyboard-mockup.html` in the running app (§8.1.7). |
| **5. Models + ZX80** | 1K / 64K / NTSC models; the ZX80 (1K/16K, 4K ROM, no NMI, `.O` files); ZX80 with the 8K ROM. | A ZX80 boot golden; ZX80 `.O` fast load; NTSC `MARGIN` = 31. |
| **6. Debugger + IDE polish** | ZX81 disassembler (`RST $08`/`$28`), character map, menus, register editor parity, breakpoint tests. | A debug-step test in the style of `wasm-z88-debug-step.test.ts`; manual IDE check with `scripts/`-driven screenshots. |
| **7. Ship** | Packaging, docs page, CHANGELOG, `.ai/` notes (a ZX81 section in `wasm-migration-intent-and-lessons.md`: the ULA/hook mapping and the traps found). | A packaged build runs both machines; `npm run build:check`, `lint:renderer` and `doc:build`/`doc:check` are green. |

---

## 14. Follow-ups (not in this plan)
- The Chroma 81 colour interface.
- The ZonX AY and Quicksilva sound boards, and the VSYNC buzz.
- SAVE to `.P`, by trapping `OUT-BYTE` `$031E`.
- TZX ZX81 blocks (block `$19`), and TZX/WAV fast load through a port of CLK's pulse parser.
- CHR$128 and UDG boards.
- The Timex TS1000/TS1500 and the Lambda 8300.
- Assembler support: a `.model zx81`, `.P` export, and code injection via a REM line or direct PC.
- Checkpoints: copy the whole linear memory, as `ZxNextWasmV2Machine.ts:595-650` does. That is
  cheap here.

---

## 15. Decisions needed from the project author

- **D1 — fix R for prefixed instructions in the shared core (C4)?**
  - *Recommendation: yes, for all machines.* It is real Z80 behaviour and the ZX81 relies on R, and
    the fix leaves tact placement unchanged.
  - Cost: some corpus expectations change, TS `Z80Cpu` is updated, and R-derived values in the Z88
    and Next goldens need review.
  - Alternative: a `Z80_R_COUNTS_EVERY_M1` opt-in macro. That keeps a known inaccuracy in five
    machines and needs a TS flag.
- **D2 — two machine IDs (`zx80`, `zx81`) or one (`zx8081`) with models?** *Recommendation: two IDs,
  one host class and one artifact (§4.3).*
- **D3 — reuse `zx-spectrum-keyboard.c` through aliases, or give the ZX81 its own 40-line copy?**
  - *Recommendation: reuse.* It is a Sinclair matrix, not a Spectrum feature.
  - Better still: move it to a neutral `src/emu/machines/sinclair/wasm/common/` in a separate
    refactor.
- **D4 — the visible window size.** *Recommendation: 352 × 288, the Spectrum-like border (§7).*
- **D5 — ship the ZX80/ZX81 ROMs?**
  - Their notice allows free non-commercial use and must be retained. Klive is free, so shipping is
    allowed, with `src/public/roms/zx8081-roms-readme.txt`.
  - Otherwise the user supplies the ROMs through a config key, as `MC_SP48_ROM_FILE` does.
- **D6 — one artifact with a run-time ZX80/ZX81 flag, or two builds?** *Recommendation: one, unless
  the benchmark objects (§4.1).*

---

## 16. Risks
- **The per-T ULA work in `Z80_TACT_PLUS_N`** is the hot path. Keep it branch-light: precompute the
  next event tact (HSYNC start or end, tape edge) and compare against it, rather than testing every
  condition every T.
- **WAIT placement** differs by ≤ 2 T from hardware (the delay hooks run before the access; real
  WAIT is sampled at T2). The jitter test in Phase 3 is the guard. If it fails, add a
  `Z80_WAIT_SAMPLE` hook inside `readMemory`/`readPort` (another default-no-op core extension).
- **M1 modelled as 3 + 1 T** in `z80.c`, against 2 + 2 on the real Z80. Pixel output is anchored at
  refresh, so the picture may be shifted by one T (2 px) relative to the real ULA. That is invisible
  within the cropped window, but note it before anyone "fixes" an offset constant.
- **CLK's ZX80 path is less exercised** than its ZX81 path (the unwrapped counter, VSYNC handling).
  Oracle runs against EightyOne matter most there.
- **Changing the shared core (Phase 1)** can disturb five shipped machines. That is why it is its
  own phase, with full rebuilds and goldens, before any ZX81 code lands.
