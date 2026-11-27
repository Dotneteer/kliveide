/*
 * SAM Coupé - the full-machine WASM core (`dev/plans/SAM_COUPE_PLAN.md`).
 *
 * One translation unit: the machine state below, the SAM's parts it includes, and the shared Z80 core
 * (`src/emu/z80/wasm/z80.c`) wired to them through the `Z80_*` hook macros. No heap; every buffer is a
 * static array exposed through a pointer export. The hardware facts come from the research pack
 * `dev/research/sam-coupe/`; the code is Klive's own (plan D1).
 *
 * One artifact runs both models (plan §4.3, D2): `samConfigure` picks 512K or 256K of internal RAM, the
 * external memory, the drives and the mouse; the host uploads the ROM.
 *
 * Time (plan §3.1, D4): one clock. The CPU (24 MHz / 4) and the ASIC's 8-T cells come from the same
 * crystal, so `cpu.tacts` (whole T-states) is the time base and the raster position is a function of the
 * frame tact. The machine frame (119 808 T, 50.08 Hz) starts at the frame interrupt. The ASIC steps
 * eagerly, one cell at a time, inside `Z80_TACT_PLUS_N`; an instruction that ends past the frame carries
 * its overshoot into the next frame.
 *
 * Every name is prefixed `sam`: `z80.c` defines register macros (`A`, `F`, `HL`, ...).
 */
#include <stdint.h>

// -----------------------------------------------------------------------------
// Machine constants
// -----------------------------------------------------------------------------

/* The CPU clock: the 24 MHz crystal divided by 4 */
#define SAM_CLOCK 6000000u

/* The frame: 312 lines of 384 T; the frame interrupt at vc 244, so screen line 0 is frame line 68 */
#define SAM_LINE_TACTS 384u
#define SAM_LINES_PER_FRAME 312u
#define SAM_FRAME_TACTS (SAM_LINE_TACTS * SAM_LINES_PER_FRAME)
#define SAM_INT_LINE 244u
#define SAM_SCREEN_FIRST_LINE (SAM_LINES_PER_FRAME - SAM_INT_LINE)

/*
 * The physical memory, one array (plan §5):
 *   00000h  the ROM (32K: ROM0, then ROM1)
 *   08000h  internal RAM, 32 pages of 16K (512K)
 *   88000h  external RAM, one 1 MB pack (64 pages), when fitted
 *   188000h one page of FFh for every missing page
 */
#define SAM_PAGE_SIZE 0x4000u
#define SAM_PHYS_ROM 0x000000u
#define SAM_PHYS_RAM 0x008000u
#define SAM_PHYS_EXT 0x088000u
#define SAM_PHYS_UNMAPPED 0x188000u
#define SAM_PHYS_SIZE 0x18c000u

/* The TV picture (plan §3.3, D6): 12 MHz pixels, 40 cells of 16 by 288 lines */
#define SAM_SCREEN_WIDTH 640u
#define SAM_SCREEN_HEIGHT 288u

// -----------------------------------------------------------------------------
// Machine state
// -----------------------------------------------------------------------------

static uint8_t samMemory[SAM_PHYS_SIZE];
static uint32_t samPixelBuffer[SAM_SCREEN_WIDTH * SAM_SCREEN_HEIGHT];

/* Time: the current frame's start (absolute tacts), the frames, a 64-bit total for the tape */
static uint32_t samFrameStart;
static uint32_t samFrames;
static uint8_t samFrameCompleted = 1u;
static uint64_t samTotalTacts;

/* The instruction the debugger shows (`Z80Cpu.opStartAddress`) */
static uint16_t samOpStartAddress;

/*
 * Whether an instruction records its bus activity for the IDE: always in the debugger's paths, and for
 * the last `SAM_CAPTURE_WINDOW` T-states of a fast frame (the TVC's and Enterprise's scheme).
 */
static uint8_t samCaptureBusEvents = 1u;
#define SAM_CAPTURE_WINDOW 1024u

#if defined(__clang__) || defined(__GNUC__)
#define SAM_NOINLINE __attribute__((noinline))
#else
#define SAM_NOINLINE
#endif

// -----------------------------------------------------------------------------
// The shared Z80 core, wired to the SAM
// -----------------------------------------------------------------------------

static uint8_t samCpuReadMemory(uint16_t address);
static void samCpuWriteMemory(uint16_t address, uint8_t value);
static void samPokeMemory(uint16_t address, uint8_t value);
static uint8_t samCpuReadPort(uint16_t address);
static void samCpuWritePort(uint16_t address, uint8_t value);
/* Not inlined: inlined into every opcode, per-tact work multiplies the code */
static void SAM_NOINLINE samAdvanceTacts(uint32_t value);
/* A memory cycle's timing: 3 T plus the ASIC's wait (sam-timing.c) */
static void SAM_NOINLINE samDelayMemory(uint16_t address, uint32_t kind);
/* An I/O cycle's timing: 4 T plus the ASIC's wait on its ports (sam-timing.c) */
static void SAM_NOINLINE samDelayPort(uint16_t address);

#define SAM_CYCLE_DATA 0u
#define SAM_CYCLE_M1 1u

#define Z80_EXTERNAL_BUS 1
#define Z80_CAPTURE_BUS_EVENTS() samCaptureBusEvents
#define Z80_ACCESS_LOG_NOINLINE 1
#define Z80_MEMORY_PTR() samMemory
#define Z80_READ_MEMORY(address) samCpuReadMemory((uint16_t)(address))
#define Z80_WRITE_MEMORY(address, value) samCpuWriteMemory((uint16_t)(address), (uint8_t)(value))
#define Z80_POKE_MEMORY(address, value) samPokeMemory((uint16_t)(address), (uint8_t)(value))
#define Z80_READ_PORT(address) samCpuReadPort((uint16_t)(address))
#define Z80_WRITE_PORT(address, value) samCpuWritePort((uint16_t)(address), (uint8_t)(value))
#define Z80_DELAY_MEMORY_READ(address) samDelayMemory((uint16_t)(address), SAM_CYCLE_DATA)
#define Z80_DELAY_MEMORY_WRITE(address) samDelayMemory((uint16_t)(address), SAM_CYCLE_DATA)
#define Z80_DELAY_OPCODE_FETCH(address) samDelayMemory((uint16_t)(address), SAM_CYCLE_M1)
#define Z80_DELAY_PORT_READ(address) samDelayPort((uint16_t)(address))
#define Z80_DELAY_PORT_WRITE(address) samDelayPort((uint16_t)(address))
#define Z80_TACT_PLUS_N(value) samAdvanceTacts((uint32_t)(value))
#include "../../../../z80/wasm/z80-history.h"
#include "../../../../z80/wasm/z80-profile.h"
#include "../../../../z80/wasm/z80.c"
/* The CPU's registers and debugger state, exported as `samGetCpuAf` ... */
#define Z80_EXPORT_PREFIX sam
#include "../../../../z80/wasm/z80-cpu-exports.c"

// -----------------------------------------------------------------------------
// SAM parts
// -----------------------------------------------------------------------------

#include "sam-memory.c"
#include "sam-timing.c"
#include "sam-asic.c"
#include "sam-keyboard.c"
#include "sam-mouse.c"
/* The audio mixer: SAA left, SAA right, beeper, tape (`common/wasm/audio-channels.c`) */
#define KLIVE_AUDIO_CHANNELS 4u
#include "../../../common/wasm/audio-channels.c"
#include "sam-saa.c"
#include "sam-audio.c"
#include "sam-video.c"
#include "sam-fdc.c"
#include "sam-tape.c"
#include "sam-ports.c"

static uint64_t samTapeClock7(void) { return samTotalTacts * 7u; }

/* Every CPU clock step: the tact counter and the ASIC's cells that start by now */
static void SAM_NOINLINE samAdvanceTacts(uint32_t value) {
  cpu.tacts += value;
  samTotalTacts += value;
  while ((int32_t)(cpu.tacts - samNextCellTact) >= 0) {
    samCellStep();
    samNextCellTact += 8u;
  }
}

/* A frame ends (the cell stepper reached its end): the next one starts exactly a frame later */
static void samFrameEnds(void) {
  samAudioEndFrame();
  samFrameStart += SAM_FRAME_TACTS;
  samFrames++;
  samFlashCounter = (uint8_t)((samFlashCounter + 1u) & 0x1fu);
  samFrameCompleted = 1u;
  (void)samMidiTransmitting();
  samTapeFrameEnds();
}

// -----------------------------------------------------------------------------
// The frame loop
// -----------------------------------------------------------------------------

static void samBeginFrame(void) {
  samFrameCompleted = 0u;
  samAudioNewFrame();
}

/*
 * One instruction: a new frame first if the last one completed, then the CPU cycles until the
 * instruction is complete. The INT line follows STATUS's pulses. Returns whether the frame completed.
 */
uint32_t samExecuteInstruction(void) {
  if (samFrameCompleted) {
    samBeginFrame();
  }
  if (samCaptureBusEvents) {
    z80ClearBusEvents();
    samOpStartAddress = cpu.pc;
  }
  do {
    cpu.sigInt = samIntLine();
    z80ExecuteCpuCycle();
  } while (cpu.prefix != PREFIX_NONE);
  return samFrameCompleted;
}

/* The debugger's breakpoint flags and in-core loop, `samExecuteUntilStop` (z80-debug-loop.c) */
#define Z80_DEBUG_LOOP_PREFIX sam
#define Z80_DEBUG_LOOP_FRAME_COMPLETED samFrameCompleted
#include "../../../../z80/wasm/z80-debug-loop.c"

/* Runs until the current frame completes (a frame stopped midway is finished) */
uint32_t samExecuteFrame(void) {
  do {
    const uint32_t done = cpu.tacts - samFrameStart;
    samCaptureBusEvents = done + SAM_CAPTURE_WINDOW >= SAM_FRAME_TACTS ? 1u : 0u;
    samExecuteInstruction();
    if (z80HistoryStopNow() != 0u) break;
  } while (!samFrameCompleted);
  samCaptureBusEvents = 1u;
  return 0u;
}

// -----------------------------------------------------------------------------
// Buffers
// -----------------------------------------------------------------------------

uint32_t samMemoryPtr(void) { return (uint32_t)(uintptr_t)samMemory; }
uint32_t samGetMemoryCapacity(void) { return SAM_PHYS_SIZE; }
/* The ROM upload area (32K) */
uint32_t samRomPtr(void) { return (uint32_t)(uintptr_t)&samMemory[SAM_PHYS_ROM]; }
uint32_t samPixelBufferPtr(void) { return (uint32_t)(uintptr_t)samPixelBuffer; }
uint32_t samGetPixelBufferCapacity(void) { return SAM_SCREEN_WIDTH * SAM_SCREEN_HEIGHT; }
uint32_t samGetScreenWidth(void) { return SAM_SCREEN_WIDTH; }
uint32_t samGetScreenHeight(void) { return SAM_SCREEN_HEIGHT; }

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

/*
 * Selects the hardware: `ramPages` 16 (256K) or 32 (512K), `extPages` 0 or 64 (a 1 MB pack), `drives`
 * 0-2, `mouse` nonzero for the mouse interface. Takes effect now.
 */
void samConfigure(uint32_t ramPages, uint32_t extPages, uint32_t drives, uint32_t mouse) {
  samRamPages = ramPages == 16u ? 16u : 32u;
  samExtPages = extPages >= 64u ? 64u : 0u;
  samDrives = (uint8_t)(drives > 2u ? 2u : drives);
  samMouseFitted = mouse != 0u;
  samRemap();
}

static void samResetMachine(void) {
  samFrameStart = cpu.tacts;
  samNextCellTact = cpu.tacts;
  samFrames = 0u;
  samFrameCompleted = 1u;
  samResetMemoryMap();
  samAsicReset();
  samVideoReset();
  samMouseReset();
  samAudioReset();
  samTapeReset();
}

/* The reset button: the CPU, the ASIC's registers; the RAM, the CLUT, the SAA and the drives are kept */
void samReset(void) {
  z80SoftReset();
  // --- The SAA keeps running: its times move with the frame's new start
  samSaaRunUntil(samAudioPointNow());
  samSaaEndFrame((double)(cpu.tacts - samFrameStart) * SAM_SAA_UNITS_PER_T);
  samResetMachine();
}

/*
 * Power on: every CPU register cleared, the RAM filled with SimCoupé's convenience pattern (FFh with the
 * first 80h bytes of every 256 zeroed; plan §5), the CLUT from a fixed seed, the SAA and the controllers
 * cleared. The ROM stays.
 */
void samHardReset(void) {
  for (uint32_t i = SAM_PHYS_RAM; i < SAM_PHYS_UNMAPPED; i++) samMemory[i] = (i & 0x80u) ? 0xffu : 0x00u;
  for (uint32_t i = SAM_PHYS_UNMAPPED; i < SAM_PHYS_SIZE; i++) samMemory[i] = 0xffu;
  z80Reset();
  cpu.tacts = 0u;
  samTotalTacts = 0u;
  samBuildPalette();
  samVideoPowerOn();
  samSaaPowerOn();
  samFdcPowerOn();
  samResetMachine();
}

// -----------------------------------------------------------------------------
// Timing
// -----------------------------------------------------------------------------

uint32_t samGetBaseClockFrequency(void) { return SAM_CLOCK; }
uint32_t samGetTactsInFrame(void) { return SAM_FRAME_TACTS; }
uint32_t samGetFrames(void) { return samFrames; }
uint32_t samGetFrameTacts(void) { return samFrameTact(); }
uint32_t samGetFrameCompleted(void) { return samFrameCompleted; }
uint32_t samGetTacts(void) { return cpu.tacts; }
uint32_t samGetFrameStart(void) { return samFrameStart; }
/* Sets the T-state counter; the frame, the cells and the timers move with it, so nothing else changes */
void samSetTacts(uint32_t value) {
  const uint32_t delta = value - cpu.tacts;
  cpu.tacts = value;
  samFrameStart += delta;
  samNextCellTact += delta;
  samMidiEndsAt += delta;
  samMouseLastRead += delta;
}
uint32_t samGetClockMultiplier(void) { return 1u; }
/* The SAM runs at its own clock only: the ASIC makes the CPU clock */
void samSetTargetClockMultiplier(uint32_t value) { (void)value; }
/*
 * Places the CPU at frame tact `t` (the tests' hook, as `tvcSetHalfClock` was): the frame's start moves,
 * nothing else does. For putting an instruction at a chosen raster position, not for normal running.
 */
void samSetFrameTact(uint32_t t) {
  t %= SAM_FRAME_TACTS;
  samFrameStart = cpu.tacts - t;
  samNextCellTact = cpu.tacts + ((8u - (t & 7u)) & 7u);
}

// -----------------------------------------------------------------------------
// CPU
// -----------------------------------------------------------------------------

uint32_t samGetCpuOpCode(void) { return cpu.opCode; }
uint32_t samGetOpStartAddress(void) { return samOpStartAddress; }

// -----------------------------------------------------------------------------
// Breakpoint conditions: the shared evaluator, reading memory through the map without side effects
// -----------------------------------------------------------------------------

#define COND_PEEK(address) ((uint32_t)samPeekMemory((uint16_t)((address) & 0xffffu)))
#include "../../../../z80/wasm/z80-condition.c"

// -----------------------------------------------------------------------------
// Execution history (`dev/plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3): the shared recorder. The
// context:
//   0 LMPR, 1 HMPR, 2 VMPR, 3 LEPR, 4 HEPR, 5 the internal pages fitted (16 or 32)
// -----------------------------------------------------------------------------

static inline void samHistoryContext(uint32_t kind, uint8_t *out) {
  (void)kind;
  out[0] = samLmpr;
  out[1] = samHmpr;
  out[2] = samVmpr;
  out[3] = samLepr;
  out[4] = samHepr;
  out[5] = samRamPages;
  for (uint32_t i = 6u; i < 16u; i++) out[i] = 0u;
}

#define Z80_HISTORY_CAPACITY 65536u
#define Z80_HISTORY_PEEK(address) samPeekMemory((uint16_t)((address) & 0xffffu))
#define Z80_HISTORY_CONTEXT(kind, out16) samHistoryContext(kind, out16)
#define Z80_HISTORY_FRAME() samFrames
#define Z80_HISTORY_FRAME_TACT() samFrameTact()
#include "../../../../z80/wasm/z80-history.c"

// -----------------------------------------------------------------------------
// The access profile (`dev/plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2): a byte's profile offset is
// its physical address in `samMemory`. ROM and missing pages take no writes.
// -----------------------------------------------------------------------------

static inline int32_t samProfilePhys(uint32_t address, uint32_t write) {
  const uint32_t section = (address >> 14) & 3u;
  if (write != 0u && !(samSectionWritable & (1u << section))) return -1;
  return (int32_t)samPhysicalAddress((uint16_t)address);
}

#define Z80_PROFILE_FLAG_BYTES SAM_PHYS_SIZE
#define Z80_PROFILE_POOL_PAGES 8u
#define Z80_PROFILE_PHYS_READ(address) samProfilePhys((uint32_t)(address), 0u)
#define Z80_PROFILE_PHYS_WRITE(address) samProfilePhys((uint32_t)(address), 1u)
#define Z80_PROFILE_FRAME_TICKS() cpu.tacts
#include "../../../../z80/wasm/z80-profile.c"
