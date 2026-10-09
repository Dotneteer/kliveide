/*
 * Sinclair ZX80 / ZX81 - the full-machine WASM core.
 *
 * One translation unit: the machine state below, the ZX80/ZX81 parts it includes, and the shared Z80
 * core (`src/emu/z80/wasm/z80.c`) wired to them through the `Z80_*` hook macros. No heap; every buffer
 * is a static array exposed through a pointer export. The plan is `.plans/ZX8081_WASM_PLAN.md`.
 *
 * The ULA logic and its constants are ported from Clock Signal (CLK) by Thomas Harte,
 * `Machines/Sinclair/ZX8081/ZX8081.cpp`; the video raster builder replaces CLK's `Video.cpp` and the
 * tape pulse synthesizer ports `Storage/Tape/Formats/ZX80O81P.cpp`. CLK's licence:
 *
 *   Copyright (c) 2015 Thomas Harte
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 *   associated documentation files (the "Software"), to deal in the Software without restriction,
 *   including without limitation the rights to use, copy, modify, merge, publish, distribute,
 *   sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all copies or
 *   substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 *   BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 *   NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 *   DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * One artifact runs both machines (decision D6): `zx8081Configure` picks the ZX80 or ZX81 ULA, the
 * ROM, the RAM size and the TV standard at run time.
 *
 * Every name is prefixed `zx8081`: `z80.c` defines register macros (`A`, `F`, `HL`, ...).
 */
#include <stdint.h>

// -----------------------------------------------------------------------------
// Machine constants
// -----------------------------------------------------------------------------

#define ZX8081_CLOCK_FREQUENCY 3250000u
/* An emulation frame: 1/50 s (PAL) or 1/60 s (NTSC) of CPU time. The TV frame is independent. */
#define ZX8081_TACTS_IN_FRAME_PAL 65000u
#define ZX8081_TACTS_IN_FRAME_NTSC 54167u

#define ZX8081_ROM_CAPACITY 0x2000u
#define ZX8081_RAM_CAPACITY 0x10000u

/* The ULA's line timing, in T-states (CLK counts half-cycles: ZX81 32-64, ZX80 26-66) */
#define ZX81_LINE_TACTS 207u
#define ZX81_HSYNC_START 16u
#define ZX81_HSYNC_END 32u
#define ZX80_HSYNC_START 13u
#define ZX80_HSYNC_END 33u

/* The raw raster: one pixel per half T-state, 207 T a line; enough lines for the TV flywheel */
#define ZX8081_RAW_WIDTH 416u
#define ZX8081_RAW_LINES 400u

/* The visible window cut from the raw raster (decision D4) */
#define ZX8081_SCREEN_WIDTH 352u
#define ZX8081_SCREEN_HEIGHT_PAL 288u
#define ZX8081_SCREEN_HEIGHT_NTSC 240u

#define ZX8081_KEYBOARD_LINES 8u

/* The tape: the file bytes the pulse synthesizer and the fast-load traps read */
#define ZX8081_TAPE_CAPACITY 0x10001u

/* Colours (0xAABBGGRR): sync and ink are black, idle and paper are white */
#define ZX8081_BLACK 0xff000000u
#define ZX8081_WHITE 0xffffffffu

// -----------------------------------------------------------------------------
// Machine state
// -----------------------------------------------------------------------------

static uint8_t zx8081Rom[ZX8081_ROM_CAPACITY];
static uint8_t zx8081Ram[ZX8081_RAM_CAPACITY];
static uint32_t zx8081RawRaster[ZX8081_RAW_LINES * ZX8081_RAW_WIDTH];
static uint32_t zx8081PixelBuffer[ZX8081_SCREEN_WIDTH * ZX8081_SCREEN_HEIGHT_PAL];
static uint8_t zx8081TapeData[ZX8081_TAPE_CAPACITY];

/* The keyboard matrix (the shared Sinclair keyboard source, through aliases - decision D3) */
static uint8_t zx8081KeyboardLines[ZX8081_KEYBOARD_LINES];
static uint8_t zx8081KeyboardSelectedLineValue[256];

/* The model */
static uint8_t zx8081IsZx81 = 1u;     /* the ULA: ZX81 (NMI generator, 207-T lines) or ZX80 */
static uint8_t zx8081RomIsZx81 = 1u;  /* the ROM: the 8K ZX81 ROM (also the ZX80's upgrade) or 4K */
static uint8_t zx8081Ntsc = 0u;
static uint32_t zx8081RamSizeKb = 16u;
static uint16_t zx8081RomMask = 0x1fffu;
static uint16_t zx8081RamBase = 0x4000u;
static uint16_t zx8081RamMask = 0x3fffu;

/* Frame accounting */
static uint32_t zx8081Frames;
static uint32_t zx8081FrameTacts;
static uint32_t zx8081TactsInFrame = ZX8081_TACTS_IN_FRAME_PAL;
static uint32_t zx8081TactsInCurrentFrame = ZX8081_TACTS_IN_FRAME_PAL;
static uint32_t zx8081ClockMultiplier = 1u;
static uint32_t zx8081TargetClockMultiplier = 1u;
static uint8_t zx8081FrameCompleted = 1u;

/* The instruction the debugger shows (`Z80Cpu.opStartAddress`) and the INT line it saw */
static uint16_t zx8081OpStartAddress;
static uint8_t zx8081LastSigInt;

/*
 * Whether an instruction records its bus activity for the IDE: the shared Z80's access log and port
 * event, and `zx8081OpStartAddress` (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` Phase 1). On in the
 * debugger's paths. A fast frame turns it on only for its last `ZX8081_CAPTURE_WINDOW` T-states - longer
 * than any instruction, the ULA's WAIT included - so the CPU panel of a machine paused from a plain Run
 * still shows the frame's last instruction.
 *
 * The window depends only on the position in the frame, never on how the frame is run: the record is
 * part of the CPU state a keyframe saves (`cpu.lastPort*`), so a replay must record exactly what the
 * straight run did (`test/wasm/reverse/journal-replay-determinism.test.ts`). A reverse-debugging stop
 * outside the window therefore shows no accesses, as on the Spectrum cores, whose fast frames record
 * none.
 */
static uint8_t zx8081CaptureBusEvents = 1u;
#define ZX8081_CAPTURE_WINDOW 1024u

#if defined(__clang__) || defined(__GNUC__)
#define ZX8081_NOINLINE __attribute__((noinline))
#else
#define ZX8081_NOINLINE
#endif

// -----------------------------------------------------------------------------
// The shared Z80 core, wired to the ZX80/ZX81
// -----------------------------------------------------------------------------

static uint8_t zx8081CpuReadMemory(uint16_t address);
static void zx8081CpuWriteMemory(uint16_t address, uint8_t value);
static void zx8081PokeMemory(uint16_t address, uint8_t value);
static uint8_t *zx8081CpuMemoryPtr(void);
static uint8_t zx8081CpuReadPort(uint16_t address);
static void zx8081CpuWritePort(uint16_t address, uint8_t value);
/* Not inlined: the hooks run the ULA timer, and inlined into every opcode they would bloat it */
static void ZX8081_NOINLINE zx8081AdvanceTacts(uint32_t value);
static void ZX8081_NOINLINE zx8081DelayMemory(void);
static void ZX8081_NOINLINE zx8081DelayPort(void);
static void zx8081BeforeM1(void);
static void ZX8081_NOINLINE zx8081Refresh(uint16_t address);
static void ZX8081_NOINLINE zx8081NmiAckWait(void);
static void zx8081IntAck(void);

#define Z80_EXTERNAL_BUS 1
#define Z80_CAPTURE_BUS_EVENTS() zx8081CaptureBusEvents
/* The log is written only while capturing: out of line, so it does not grow every opcode (z80.c) */
#define Z80_ACCESS_LOG_NOINLINE 1
#define Z80_MEMORY_PTR() zx8081CpuMemoryPtr()
#define Z80_READ_MEMORY(address) zx8081CpuReadMemory((uint16_t)(address))
#define Z80_WRITE_MEMORY(address, value) zx8081CpuWriteMemory((uint16_t)(address), (uint8_t)(value))
#define Z80_POKE_MEMORY(address, value) zx8081PokeMemory((uint16_t)(address), (uint8_t)(value))
#define Z80_READ_PORT(address) zx8081CpuReadPort((uint16_t)(address))
#define Z80_WRITE_PORT(address, value) zx8081CpuWritePort((uint16_t)(address), (uint8_t)(value))
/* The base 3 T / 4 T, then the ULA's WAIT - the way Spectrum contention is added */
#define Z80_DELAY_MEMORY_READ(address) zx8081DelayMemory()
#define Z80_DELAY_MEMORY_WRITE(address) zx8081DelayMemory()
#define Z80_DELAY_PORT_READ(address) zx8081DelayPort()
#define Z80_DELAY_PORT_WRITE(address) zx8081DelayPort()
#define Z80_TACT_PLUS_N(value) zx8081AdvanceTacts((uint32_t)(value))
/* Marks the opcode read of an unprefixed M1: the ULA forces NOP on it (see zx8081-memory.c) */
#define Z80_BEFORE_OPCODE_FETCH() zx8081BeforeM1()
#define Z80_REFRESH(address) zx8081Refresh((uint16_t)(address))
#define Z80_NMI_ACK_WAIT() zx8081NmiAckWait()
#define Z80_INT_ACK() zx8081IntAck()
/* The execution-history recorder's hooks; the recorder and this machine's macros for it are at the
   end of this file (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` Phase 5) */
#include "../../../../z80/wasm/z80-history.h"
/* The access profile's hooks; the module and this machine's mapping for it are at the end of this
   file (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2) */
#include "../../../../z80/wasm/z80-profile.h"
#include "../../../../z80/wasm/z80.c"
/* The CPU's registers and debugger state, exported as `zx8081GetCpuAf` ... (WASM_CORE_LEAN_AND_DEBUG_PLAN D8) */
#define Z80_EXPORT_PREFIX zx8081
#include "../../../../z80/wasm/z80-cpu-exports.c"

// -----------------------------------------------------------------------------
// The keyboard: the Sinclair 8x5 matrix, shared with the Spectrum cores (decision D3)
// -----------------------------------------------------------------------------

#define sp48KeyboardLines zx8081KeyboardLines
#define sp48KeyboardSelectedLineValue zx8081KeyboardSelectedLineValue
#define sp48SetKeyStatus zx8081SetKeyStatus
#define sp48GetKeyboardLine zx8081GetKeyboardLine
#include "../../../zxSpectrum/wasm/common/zx-spectrum-keyboard.c"
#undef sp48KeyboardLines
#undef sp48KeyboardSelectedLineValue
#undef sp48SetKeyStatus
#undef sp48GetKeyboardLine

// -----------------------------------------------------------------------------
// ZX80/ZX81 parts
// -----------------------------------------------------------------------------

#include "zx8081-memory.c"
#include "zx8081-video.c"
#include "zx8081-tape.c"
#include "zx8081-ula.c"

static uint8_t *zx8081CpuMemoryPtr(void) { return zx8081Ram; }

/*
 * Every CPU clock step: the tact counter, the frame accounting (a frame completes the moment its
 * last tact passes), the ULA's line timer and the tape.
 */
static void ZX8081_NOINLINE zx8081AdvanceTacts(uint32_t value) {
  cpu.tacts += value;
  zx8081FrameTacts += value;
  if (zx8081FrameTacts >= zx8081TactsInCurrentFrame) {
    zx8081Frames++;
    zx8081FrameTacts -= zx8081TactsInCurrentFrame;
    zx8081FrameCompleted = 1u;
  }
  const uint32_t hcounter = zx8081Hcounter + value;
  if (hcounter < zx8081NextUlaEvent) {
    zx8081Hcounter = hcounter;
  } else {
    zx8081UlaStep(value);
  }
  if (zx8081TapeMotor) {
    zx8081TapeAdvance(value);
  }
}

// -----------------------------------------------------------------------------
// The frame loop
// -----------------------------------------------------------------------------

static void zx8081BeginFrame(void) {
  if (zx8081ClockMultiplier != zx8081TargetClockMultiplier) {
    zx8081ClockMultiplier = zx8081TargetClockMultiplier;
  }
  zx8081TactsInCurrentFrame = zx8081TactsInFrame * zx8081ClockMultiplier;
  zx8081FrameCompleted = 0u;
}

/*
 * One instruction: a new frame first if the last one completed; the fast-load traps; the INT the
 * ULA raised at the end of the previous instruction and the latched NMI edge; the CPU cycles until
 * the instruction is complete; then whether this instruction's last T-state was a refresh with A6
 * low (the ULA's INT, see zx8081-ula.c); the TV's horizontal flywheel and the tape motor.
 * Returns whether the frame completed.
 */
uint32_t zx8081ExecuteInstruction(void) {
  if (zx8081FrameCompleted) {
    zx8081BeginFrame();
  }
  if (zx8081CaptureBusEvents) {
    z80ClearBusEvents();
    zx8081OpStartAddress = cpu.pc;
  }
  if (zx8081TapeTryTrap()) {
    zx8081AfterInstruction();
    return zx8081FrameCompleted;
  }
  zx8081LastSigInt = zx8081IntPending;
  z80SetSigInt(zx8081IntPending);
  zx8081IntPending = 0u;
  zx8081IntCandidateValid = 0u;
  do {
    z80SetSigNmi(zx8081NmiLatched);
    z80ExecuteCpuCycle();
    z80SetSigInt(0u);
  } while (cpu.prefix != PREFIX_NONE);
  z80SetSigNmi(0u);
  if (zx8081IntCandidateValid && zx8081IntCandidateEndTact == cpu.tacts) {
    zx8081IntPending = 1u;
  }
  zx8081AfterInstruction();
  return zx8081FrameCompleted;
}

/* The debugger's breakpoint flags and in-core loop, `zx8081ExecuteUntilStop` (z80-debug-loop.c) */
#define Z80_DEBUG_LOOP_PREFIX zx8081
#include "../../../../z80/wasm/z80-debug-loop.c"

/* Runs until the current frame completes (a frame stopped midway is finished) */
uint32_t zx8081ExecuteFrame(void) {
  do {
    zx8081CaptureBusEvents = zx8081TactsInCurrentFrame - zx8081FrameTacts <= ZX8081_CAPTURE_WINDOW ? 1u : 0u;
    zx8081ExecuteInstruction();
    /*
     * A reverse-debugging stop target (REVERSE_DEBUGGING_PLAN D4), checked on the frame's last
     * instruction too. A frame left mid-way goes on at the next call: an instruction begins a new
     * frame only after the last one completed, which is the frame-in-progress rule (T17).
     */
    if (z80HistoryStopNow() != 0u) break;
  } while (!zx8081FrameCompleted);
  zx8081CaptureBusEvents = 1u;
  return 0u;
}

// -----------------------------------------------------------------------------
// Buffers
// -----------------------------------------------------------------------------

uint32_t zx8081RomPtr(void) { return (uint32_t)(uintptr_t)zx8081Rom; }
uint32_t zx8081GetRomCapacity(void) { return ZX8081_ROM_CAPACITY; }
uint32_t zx8081RamPtr(void) { return (uint32_t)(uintptr_t)zx8081Ram; }
uint32_t zx8081GetRamCapacity(void) { return ZX8081_RAM_CAPACITY; }
uint32_t zx8081PixelBufferPtr(void) { return (uint32_t)(uintptr_t)zx8081PixelBuffer; }
uint32_t zx8081GetPixelBufferCapacity(void) { return ZX8081_SCREEN_WIDTH * ZX8081_SCREEN_HEIGHT_PAL; }
uint32_t zx8081KeyboardLinesPtr(void) { return (uint32_t)(uintptr_t)zx8081KeyboardLines; }
uint32_t zx8081TapeDataPtr(void) { return (uint32_t)(uintptr_t)zx8081TapeData; }
uint32_t zx8081GetTapeCapacity(void) { return ZX8081_TAPE_CAPACITY; }

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

/*
 * Selects the model. `hardwareZx81`: the ZX81 ULA (else the ZX80's); `romZx81`: the 8K ZX81 ROM
 * (else the 4K ZX80 ROM) - a ZX80 with the 8K ROM upgrade has 0 and 1; `ramKb`: 1, 16 or 64;
 * `ntsc`: the US machine (60 Hz, bit 6 of port $FE reads 0). Takes effect now; the host uploads the
 * ROM and hard-resets afterwards. The memory map follows CLK: RAM from $4000 masked to its size
 * (mirrored up to $FFFF), except the 64K model, whose RAM starts at $2000.
 */
void zx8081Configure(uint32_t hardwareZx81, uint32_t romZx81, uint32_t ramKb, uint32_t ntsc) {
  zx8081IsZx81 = hardwareZx81 != 0u;
  zx8081RomIsZx81 = romZx81 != 0u;
  zx8081Ntsc = ntsc != 0u;
  zx8081RomMask = zx8081RomIsZx81 ? 0x1fffu : 0x0fffu;
  if (ramKb >= 64u) {
    zx8081RamSizeKb = 64u;
    zx8081RamBase = 0x2000u;
    zx8081RamMask = 0xffffu;
  } else if (ramKb >= 16u) {
    zx8081RamSizeKb = 16u;
    zx8081RamBase = 0x4000u;
    zx8081RamMask = 0x3fffu;
  } else {
    zx8081RamSizeKb = 1u;
    zx8081RamBase = 0x4000u;
    zx8081RamMask = 0x03ffu;
  }
  zx8081TactsInFrame = zx8081Ntsc ? ZX8081_TACTS_IN_FRAME_NTSC : ZX8081_TACTS_IN_FRAME_PAL;
  zx8081VideoConfigure();
}

static void zx8081ResetMachine(void) {
  zx8081Frames = 0u;
  zx8081FrameTacts = 0u;
  zx8081FrameCompleted = 1u;
  zx8081ClockMultiplier = zx8081TargetClockMultiplier;
  zx8081TactsInCurrentFrame = zx8081TactsInFrame * zx8081ClockMultiplier;
  resetKeyboard();
  zx8081UlaReset();
  zx8081VideoReset();
  zx8081TapeResetPlayback();
}

/* The reset button (the ZX80/81 has none; the IDE's soft reset): CPU registers kept as on a Z80 */
void zx8081Reset(void) {
  z80SoftReset();
  zx8081ResetMachine();
}

/* Power on: every CPU register and the RAM (cleared) */
void zx8081HardReset(void) {
  for (uint32_t i = 0u; i < ZX8081_RAM_CAPACITY; i++) zx8081Ram[i] = 0u;
  z80Reset();
  zx8081ResetMachine();
}

// -----------------------------------------------------------------------------
// Timing
// -----------------------------------------------------------------------------

uint32_t zx8081GetBaseClockFrequency(void) { return ZX8081_CLOCK_FREQUENCY; }
uint32_t zx8081GetTactsInFrame(void) { return zx8081TactsInFrame; }
uint32_t zx8081GetTactsInCurrentFrame(void) { return zx8081TactsInCurrentFrame; }
uint32_t zx8081GetFrames(void) { return zx8081Frames; }
uint32_t zx8081GetFrameTacts(void) { return zx8081FrameTacts; }
uint32_t zx8081GetFrameCompleted(void) { return zx8081FrameCompleted; }
uint32_t zx8081GetTacts(void) { return cpu.tacts; }
void zx8081SetTacts(uint32_t value) { cpu.tacts = value; }
uint32_t zx8081GetClockMultiplier(void) { return zx8081ClockMultiplier; }
void zx8081SetTargetClockMultiplier(uint32_t value) { zx8081TargetClockMultiplier = value > 0u ? value : 1u; }

// -----------------------------------------------------------------------------
// CPU
// -----------------------------------------------------------------------------

/* The opcode the CPU executed last: $00 for a display-file byte the ULA forced to NOP */
uint32_t zx8081GetCpuOpCode(void) { return cpu.opCode; }
uint32_t zx8081GetCpuSigInt(void) { return zx8081LastSigInt; }
uint32_t zx8081GetOpStartAddress(void) { return zx8081OpStartAddress; }

// -----------------------------------------------------------------------------
// Breakpoint conditions: the shared evaluator, reading memory through the map without side effects
// -----------------------------------------------------------------------------

#define COND_PEEK(address) ((uint32_t)zx8081PeekMemory((uint16_t)((address) & 0xffffu)))
#include "../../../../z80/wasm/z80-condition.c"

// -----------------------------------------------------------------------------
// Execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3, Phase 5): the shared recorder,
// with this machine's side-effect-free peek, its frame position in T-states and its context.
// `zx8081ExecuteUntilStop` loops the CPU in C, so the debugger's fast path records too.
//
// The CPU "executes" the display file: every M1 above 32K of a byte with bit 6 clear reads a NOP the
// ULA forced onto the bus (zx8081-memory.c). Those fetches tell the recorder so
// (`Z80_HISTORY_FORCED_NOP`), and it merges each run into one record per display line (D6, T2).
//
// The context (`zx8081Context.ts` decodes it):
//   0    bits 0-1 the RAM (0 1K, 1 16K, 3 64K), bit 4 the ZX81 ULA (else the ZX80's), bit 5 the 8K
//        ZX81 ROM (else the 4K ZX80 ROM), bit 6 NTSC
//   1    bit 0 the ZX81's NMI generator is on (the ROM's SLOW mode while it shows a picture)
// There is no banking: `getPartition` names no partition, and neither does the decoder (D4).
// -----------------------------------------------------------------------------

static inline void zx8081HistoryContext(uint32_t kind, uint8_t *out) {
  (void)kind;
  const uint8_t ram = zx8081RamSizeKb >= 64u ? 3u : zx8081RamSizeKb >= 16u ? 1u : 0u;
  out[0] = (uint8_t)(ram | (zx8081IsZx81 ? 0x10u : 0u) | (zx8081RomIsZx81 ? 0x20u : 0u) | (zx8081Ntsc ? 0x40u : 0u));
  out[1] = zx8081NmiEnabled ? 0x01u : 0u;
  for (uint32_t i = 2u; i < 16u; i++) out[i] = 0u;
}

#define Z80_HISTORY_CAPACITY 65536u
#define Z80_HISTORY_PEEK(address) zx8081PeekMemory((uint16_t)((address) & 0xffffu))
#define Z80_HISTORY_CONTEXT(kind, out16) zx8081HistoryContext(kind, out16)
#define Z80_HISTORY_FRAME() zx8081Frames
#define Z80_HISTORY_FRAME_TACT() zx8081FrameTacts
#define Z80_HISTORY_FORCED_NOP() zx8081HistoryForcedNop
#include "../../../../z80/wasm/z80-history.c"

// -----------------------------------------------------------------------------
// The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2, D4): the shared module, with
// this machine's physical layout. Time is in CPU T-states (D8).
//
// The profile offset of a byte is its *canonical address* - the lowest CPU address a data access
// reaches it at - so the layout (`src/common/profile/layouts/zx8081.ts`) is one fixed map for every
// model, whose RAM size and ROM are run-time configuration (`zx8081Configure`), not machine ids:
//   $00000-$01FFF  the ROM, through its mirrors (`& zx8081RomMask`: the 4K ZX80 ROM fills $0000-$0FFF)
//   $02000-$0FFFF  the RAM: 1K/16K at $4000 + (address & mask), whatever mirror was used; 64K at its
//                  address ($2000-$FFFF)
//   $10000-$11FFF  the 64K model's lowest 8K of RAM, which no data access reaches: only an opcode
//                  fetch above 32K does, through the lower-32K redirect of `zx8081CpuReadMemory`
// The decode is `zx8081CpuReadMemory`/`zx8081CpuWriteMemory`'s, mirrors included; a write below the
// RAM reaches nothing (the ROM ignores it), so it maps nowhere.
//
// The redirect applies to the M1 opcode read only. `Z80_BEFORE_OPCODE_FETCH` sets `zx8081M1Fetch`
// before the profile's BEGIN and M1 fetch hooks run, and the read clears it, so the flag tells them
// apart from the operand and data reads; a HALTed CPU re-fetches its HALT, so its cycles are charged
// where the HALT's own M1 was.
//
// The display file: while the ROM shows a picture the CPU fetches the display file above 32K and the
// ULA forces those bytes to NOPs. Those fetches are mapped like any other - they *are* M1 cycles at
// those bytes, the history records them too, and the time the picture costs in SLOW mode is charged
// where it is spent - so the display file reads as executed code (E/C), and, once the ROM writes it
// while profiling runs, as self-modified (S, D9). `zx8081-profile.test.ts` pins this down.
// -----------------------------------------------------------------------------

#define ZX8081_PROFILE_RAM_BASE 0x4000u
#define ZX8081_PROFILE_HIDDEN_BASE 0x10000u

static inline int32_t zx8081ProfilePhys(uint32_t address, uint32_t write) {
  const uint32_t a = address & 0xffffu;
  if (a < zx8081RamBase) return write != 0u ? -1 : (int32_t)(a & zx8081RomMask);
  if (zx8081RamSizeKb == 64u) {
    if (write == 0u && (a & 0x8000u) != 0u && (zx8081M1Fetch != 0u || cpu.halted != 0u)) {
      const uint32_t index = a & 0x7fffu;
      return (int32_t)(index < 0x2000u ? ZX8081_PROFILE_HIDDEN_BASE + index : index);
    }
    return (int32_t)a;
  }
  return (int32_t)(ZX8081_PROFILE_RAM_BASE + (a & zx8081RamMask));
}

#define Z80_PROFILE_FLAG_BYTES 0x12000u
#define Z80_PROFILE_POOL_PAGES 9u
#define Z80_PROFILE_PHYS_READ(address) zx8081ProfilePhys((uint32_t)(address), 0u)
#define Z80_PROFILE_PHYS_WRITE(address) zx8081ProfilePhys((uint32_t)(address), 1u)
#define Z80_PROFILE_FRAME_TICKS() cpu.tacts
#include "../../../../z80/wasm/z80-profile.c"
