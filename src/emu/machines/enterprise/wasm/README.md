# Enterprise 64/128 WASM Core

One C core runs both Enterprise models (`.plans/ENTERPRISE_PLAN.md`, decision D2): `epConfigure` picks
128K or 64K of RAM and the ROMs present, and the host uploads the model's ROMs. It builds to
`dist/ep.wasm` (`npm run build:ep-wasm`) and is loaded by `EpWasmV2Loader.ts`. The TypeScript side is
`../EpWasmHost.ts` (plumbing) and `../EpWasmV2Machine.ts` (the adapter). There is no TypeScript
Enterprise machine and no second CPU: the core includes the shared Z80 (`src/emu/z80/wasm/z80.c`)
through its `Z80_*` hooks. It needed no new hook.

The hardware facts come from the research pack `_input/enterprise128/` (`NICK_VIDEO.md`,
`NICK_VIDEO_BACKGROUND.md`, `DAVE_MEMORY_IO.md`, `DAVE_AUDIO_BACKGROUND.md`). The code is Klive's own;
no emulator's code was ported (plan D1).

**State (Phases 1-2, 2026-10-30):** EXOS 2.1 boots to IS-BASIC 2.1. The memory map, DAVE's interrupts
and timers, NICK's LPT walker, VINT, vertical sync, DAVE's wait states and NICK's clock stretch are in.
No pixels yet (Phase 3), the sound is silent (Phase 4), and the keyboard has no host typer (Phase 5).

## Layout

- `ep/ep.c`: the translation unit. It holds the state, the time base, the `Z80_*` hook wiring, the
  frame loop and the exports, plus the shared debug loop, condition evaluator, history recorder and
  access profile.
- `ep/ep-memory.c`: the 256-segment map behind the page registers B0h-B3h.
- `ep/ep-keyboard.c`: the 10 x 8 matrix (B5h) and the external joysticks' J column (B6h).
- `ep/ep-dave.c`: DAVE's interrupt latches, the 1 kHz / 50 Hz / 1 Hz chain, the tone counters, BFh.
- `ep/ep-audio.c`: the sample stream (silent until Phase 4).
- `ep/ep-nick.c`: NICK's slot stepper, the LPT walker, LD1/LD2, VINT, vertical sync, port 83h.
- `ep/ep-ports.c`: the I/O decode.
- `ep/ep-timing.c`: DAVE's wait states and NICK's clock stretch.

## Physical memory

Only the segments that hold something have room in `epMemory`:

| Offset | Segments | What |
|---|---|---|
| 00000h | 00h-01h | EXOS (32K) |
| 08000h | 04h | the cartridge (IS-BASIC, 16K) |
| 0C000h | 10h | Klive's `FILE:` ROM (Phase 5) |
| 10000h | 20h-21h | EXDOS (Phase 9) |
| 18000h | F8h-FBh | RAM on the 128 |
| 28000h | FCh-FFh | RAM, the video RAM (NICK's 0000h-FFFFh) |
| 38000h | every other | one segment of FFh |

The IDE's partitions are the segment numbers.

## Time

`cpu.tacts` counts whole CPU T-states (250 ns). NICK makes the CPU clock from the 8 MHz crystal and
stretches it by whole 8 MHz periods, so the core keeps `epHalfClock` in 125 ns units beside it (the
TVC's scheme, plan D4). DAVE ticks every 32 half-T units (48 with BFh bit 1 set).

NICK runs from its own oscillator, 14 237 536.27 Hz: exactly 40 434 603 / 22 720 000 NICK clocks per
half-T unit. `epNickAcc` holds NICK's position inside its current slot in units of 1/22 720 000 NICK
clock; a slot (16 clocks) passes for every 363 520 000. Integer arithmetic only, so it never drifts
and a replay sees exactly the same slots. NICK steps eagerly, one slot at a time, as the clock passes
it (`epClockAdvance`).

The machine frame ends where NICK's vertical sync starts. With EXOS's LPT that is 312 lines,
79 941.9 T (50.04 Hz): frames are 79 941 or 79 942 T, ending on a slot boundary. A frame shorter than
half a nominal one does not count; two nominal frames end one whatever the LPT does.

## The bus timing (plan §3.3, §6)

**DAVE's waits** (BFh bits 3-2): 00 one T on every memory access, 01 on M1 only, 10/11 none. Never on
I/O, never on video RAM. EXOS sets BFh = 04h (M1 only) during boot (`test/ep-hw/boot.test.ts`), which
settles the research pack's question about EXOS's default.

**NICK's stretch:** an access to a page that shows FCh-FFh, or to ports 80h-8Fh, is held in half-T
steps until its access point falls in the Z80's window of a slot (NICK clocks 10-15). The access
points are the EXOS book's: M1 at T2.0, memory at T2.5, I/O at T3.5 (`EP_ACCESS_*_HALVES`). Where
NICK really samples a request is not documented (plan Q3); the constants are one table. Consequences
the tests pin (`test/ep-hw/timing.test.ts`): code that runs from video RAM takes one slot per NOP
(4.495 T), a loop of video RAM reads locks to whole slots, and a write to NICK's ports lands inside the
Z80's window.

**Not yet compared with ep128emu** (an oracle run, plan §13): its tuned latencies (≈ 356-363 ns) may
place the window differently, which would change single-access costs but not the lock to the grid.

## NICK (Phase 1: no pixels)

The LPB is fetched on every line; the first line of a block loads the line counter and LD2, and LD1
loads then and on every line while VRES is clear. The margins are compared before a slot's own fetch,
right margin first; LD1 counts in every slot inside the margins, the control slots included. VINT is
MB bit 7 for the line; port 83h follows the flag model of `NICK_VIDEO.md` §3.5. Port reads return the
last byte NICK fetched.

NICK's port registers are random at power-on on a real machine; the core seeds them
(`epNickSetSeed`), and EXOS boots from any seed (its forced reload).

## DAVE (plan §8.1)

The four latches, B4h, the 1 kHz / 50 Hz / 1 Hz chain and the tone counters for the tone-generator
interrupt. **The VINT edge (D6, Q1):** `EP_VINT_AT_BLOCK_END` = 1 latches INT1 where a VINT block
ends (ep128emu and the EXOS book's appendix), not where it starts (the NICK documents). EXOS's own LPT
puts its 14-line VINT block just before vertical sync, so its interrupt comes three lines before the
frame ends.

## Testing

`test/harness/enterprise/` scripts the real core: `bootToBasic`, frames, stepping, the LPT and the
screen's text, DAVE. `test/ep-hw/`:

- `boot.test.ts`: EXOS's RAM test, the banner, IS-BASIC with 128K; EXOS's LPT (observed); 312-line
  frames; BFh after boot; booting from several NICK seeds;
- `dave.test.ts`: the timers, tone-generator interrupts, sync hold, B4h, IM 1, BFh bit 1, VINT;
- `nick-lpt.test.ts`: the LPB read every line, LD1/LD2, margins that run on, the floating bus, port
  83h, the frame;
- `timing.test.ts`: DAVE's wait modes and M1s, NICK's stretch and the lock to the slot grid.

Most run on a bare machine (`bare.ts`): the CPU in segment F8h, the LPT written by the test.
