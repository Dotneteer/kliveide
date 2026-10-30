/*
 * Enterprise 64/128 - the full-machine WASM core.
 *
 * One translation unit: the machine state below, the Enterprise parts it includes, and the shared Z80
 * core (`src/emu/z80/wasm/z80.c`) wired to them through the `Z80_*` hook macros. No heap; every buffer
 * is a static array exposed through a pointer export. The plan is `.plans/ENTERPRISE_PLAN.md`; the
 * hardware facts come from the research pack `_input/enterprise128/`. The code is Klive's own.
 *
 * One artifact runs both models (plan §4.3, D2): `epConfigure` picks the RAM size, and the host
 * uploads the model's ROMs.
 *
 * Time (plan §3.1, D4): `cpu.tacts` counts whole CPU T-states (250 ns at 4 MHz). NICK makes the CPU
 * clock from the 8 MHz crystal and stretches it by whole 8 MHz periods, so the machine also keeps
 * `epHalfClock`, the time in 125 ns units: 2 * tacts plus the half-T phase. DAVE runs from the same
 * crystal (one tick every 32 half-T units). NICK runs from its own oscillator at 14 237 536.27 Hz,
 * exactly 40 434 603 / 22 720 000 NICK clocks per half-T unit; its position is an integer accumulator,
 * so it never drifts. NICK is stepped eagerly, one 16-clock slot at a time, as the clock passes it.
 *
 * The frame (plan §3.2): a machine frame ends where NICK's vertical sync starts. A "frame" shorter than
 * half a nominal one does not count, and two nominal frames end one whatever the LPT does (before EXOS
 * programs NICK, the LPT pointer is random).
 *
 * Every name is prefixed `ep`: `z80.c` defines register macros (`A`, `F`, `HL`, ...).
 */
#include <stdint.h>

// -----------------------------------------------------------------------------
// Machine constants
// -----------------------------------------------------------------------------

/* The CPU clock: the 8 MHz crystal divided by 2 */
#define EP_CLOCK 4000000u

/*
 * NICK's clock against the 8 MHz crystal (plan §3.1): NICK clocks per half-T unit =
 * EP_NICK_NUM / EP_NICK_DEN exactly (14 237 536.27 Hz = 4 433 618.75 * 912 / 284). A slot is 16 NICK
 * clocks, so one slot passes for every EP_NICK_SLOT units of the accumulator.
 */
#define EP_NICK_NUM 40434603ull
#define EP_NICK_DEN 22720000ull
#define EP_NICK_SLOT (16ull * EP_NICK_DEN)

/* A NICK line is 57 slots; EXOS's frame is 312 lines: 79 941.9 T (50.04 Hz) */
#define EP_SLOTS_PER_LINE 57u
#define EP_NOMINAL_FRAME_TACTS 79942u
#define EP_MIN_FRAME_HALVES EP_NOMINAL_FRAME_TACTS
#define EP_MAX_FRAME_HALVES (4u * EP_NOMINAL_FRAME_TACTS)

/* DAVE's tick: 250 kHz from the 8 MHz input (BFh bit 1 = 0), 166.7 kHz with BFh bit 1 = 1 */
#define EP_DAVE_TICK_HALVES 32u
#define EP_DAVE_TICK_HALVES_12M 48u

/*
 * The physical memory, one array (plan §5). The CPU sees 256 segments of 16K through four page
 * registers; only the segments that hold something have room here, the rest read FFh. The IDE's
 * partition numbers are the segment numbers.
 *
 *   00h-01h  EXOS (32K)             04h  the cartridge (IS-BASIC, 16K)
 *   10h      Klive's FILE: ROM      20h-21h  EXDOS (32K)
 *   F8h-FBh  RAM (the 128K model)   FCh-FFh  RAM, the video RAM NICK sees
 */
#define EP_SEG_SIZE 0x4000u
#define EP_PHYS_EXOS 0x00000u
#define EP_PHYS_CART 0x08000u
#define EP_PHYS_FILEIO 0x0c000u
#define EP_PHYS_EXDOS 0x10000u
#define EP_PHYS_RAM 0x18000u
#define EP_PHYS_VRAM 0x28000u
/* A segment of FFh for every unmapped segment */
#define EP_PHYS_UNMAPPED 0x38000u
#define EP_PHYS_SIZE 0x3c000u

/* The TV picture (plan §7.4, D7): the unblanked slots 10-55 (46 x 16 pixels), 288 lines */
#define EP_SCREEN_WIDTH 736u
#define EP_SCREEN_HEIGHT 288u

#define EP_KEYBOARD_ROWS 16u

// -----------------------------------------------------------------------------
// Machine state
// -----------------------------------------------------------------------------

static uint8_t epMemory[EP_PHYS_SIZE];
static uint32_t epPixelBuffer[EP_SCREEN_WIDTH * EP_SCREEN_HEIGHT];
/* The keyboard matrix: one byte per row, a set bit is a pressed key (rows 0-9, columns 0-7) */
static uint8_t epKeyboardLines[EP_KEYBOARD_ROWS];

/* The model: 1 the Enterprise 128 (RAM in F8h-FFh), 0 the Enterprise 64 (FCh-FFh) */
static uint8_t epIs128 = 1u;

/* Time: the half-T clock, NICK's accumulator (slot fractions), the next DAVE tick, the frame's start */
static uint32_t epHalfClock;
static uint64_t epNickAcc;
static uint32_t epDaveNextTick;
static uint32_t epFrameStartHalf;
static uint32_t epFrames;
static uint8_t epFrameCompleted = 1u;

/* The instruction the debugger shows (`Z80Cpu.opStartAddress`) */
static uint16_t epOpStartAddress;

/*
 * Whether an instruction records its bus activity for the IDE, as on the TVC core: always in the
 * debugger's paths, and for the last `EP_CAPTURE_WINDOW` T-states of a fast frame.
 */
static uint8_t epCaptureBusEvents = 1u;
#define EP_CAPTURE_WINDOW 1024u

#if defined(__clang__) || defined(__GNUC__)
#define EP_NOINLINE __attribute__((noinline))
#else
#define EP_NOINLINE
#endif

// -----------------------------------------------------------------------------
// The shared Z80 core, wired to the Enterprise
// -----------------------------------------------------------------------------

static uint8_t epCpuReadMemory(uint16_t address);
static void epCpuWriteMemory(uint16_t address, uint8_t value);
static void epPokeMemory(uint16_t address, uint8_t value);
static uint8_t epCpuReadPort(uint16_t address);
static void epCpuWritePort(uint16_t address, uint8_t value);
/* Not inlined: inlined into every opcode, per-tact work multiplies the code */
static void EP_NOINLINE epAdvanceTacts(uint32_t value);
/* A memory cycle's timing: 3 T, plus DAVE's wait state or NICK's clock stretch (ep-timing.c) */
static void EP_NOINLINE epDelayMemory(uint16_t address, uint32_t kind);
/* An I/O cycle's timing: 4 T, plus NICK's clock stretch on its ports 80h-8Fh (ep-timing.c) */
static void EP_NOINLINE epDelayPort(uint16_t address);
/* The rest of an I/O cycle after its access point (a NICK port is written or read there) */
static void epDelayPortTail(void);

#define EP_CYCLE_DATA 0u
#define EP_CYCLE_M1 1u

#define Z80_EXTERNAL_BUS 1
#define Z80_CAPTURE_BUS_EVENTS() epCaptureBusEvents
#define Z80_ACCESS_LOG_NOINLINE 1
#define Z80_MEMORY_PTR() epMemory
#define Z80_READ_MEMORY(address) epCpuReadMemory((uint16_t)(address))
#define Z80_WRITE_MEMORY(address, value) epCpuWriteMemory((uint16_t)(address), (uint8_t)(value))
#define Z80_POKE_MEMORY(address, value) epPokeMemory((uint16_t)(address), (uint8_t)(value))
#define Z80_READ_PORT(address) epCpuReadPort((uint16_t)(address))
#define Z80_WRITE_PORT(address, value) epCpuWritePort((uint16_t)(address), (uint8_t)(value))
#define Z80_DELAY_MEMORY_READ(address) epDelayMemory((uint16_t)(address), EP_CYCLE_DATA)
#define Z80_DELAY_MEMORY_WRITE(address) epDelayMemory((uint16_t)(address), EP_CYCLE_DATA)
/* Hook H1: DAVE's M1-only wait mode, and an M1's own access point for NICK's stretch */
#define Z80_DELAY_OPCODE_FETCH(address) epDelayMemory((uint16_t)(address), EP_CYCLE_M1)
#define Z80_DELAY_PORT_READ(address) epDelayPort((uint16_t)(address))
#define Z80_DELAY_PORT_WRITE(address) epDelayPort((uint16_t)(address))
#define Z80_DELAY_PORT_READ_TAIL(address) epDelayPortTail()
#define Z80_DELAY_PORT_WRITE_TAIL(address) epDelayPortTail()
#define Z80_TACT_PLUS_N(value) epAdvanceTacts((uint32_t)(value))
#include "../../../../z80/wasm/z80-history.h"
#include "../../../../z80/wasm/z80-profile.h"
#include "../../../../z80/wasm/z80.c"
/* The CPU's registers and debugger state, exported as `epGetCpuAf` ... */
#define Z80_EXPORT_PREFIX ep
#include "../../../../z80/wasm/z80-cpu-exports.c"

// -----------------------------------------------------------------------------
// Enterprise parts
// -----------------------------------------------------------------------------

/* Defined below, after the parts that call them */
static void epVsyncStarted(void);
static void epFrameEnds(uint32_t newStart);
static inline void epClockAdvance(uint32_t halves);
static inline void epCheckFrameCap(void);

#include "ep-memory.c"
#include "ep-keyboard.c"
#include "ep-dave.c"
#include "ep-audio.c"
#include "ep-nick.c"
#include "ep-ports.c"
#include "ep-timing.c"

/*
 * Lets `halves` half-T units pass on the clock tree: NICK's slots and DAVE's ticks that start by now.
 * The CPU's T-state counter is the caller's.
 */
static inline void epClockAdvance(uint32_t halves) {
  epHalfClock += halves;
  epNickAcc += (uint64_t)halves * EP_NICK_NUM;
  while (epNickAcc >= EP_NICK_SLOT) {
    epNickAcc -= EP_NICK_SLOT;
    epNickSlot();
  }
  while ((int32_t)(epHalfClock - epDaveNextTick) >= 0) {
    epDaveTick();
    epDaveNextTick += epDaveTickHalves;
  }
  epAudioAdvance();
}

/* An LPT that never starts vertical sync (or starts it too rarely): two nominal frames end one */
static inline void epCheckFrameCap(void) {
  if (!epFrameCompleted && (int32_t)(epHalfClock - epFrameStartHalf) >= (int32_t)EP_MAX_FRAME_HALVES) {
    epNickNoSyncFrames++;
    epFrameEnds(epHalfClock);
    epFrameStartHalf = epHalfClock;
    epFrames++;
    epFrameCompleted = 1u;
  }
}

/* Every CPU clock step: the tact counter and the clock tree */
static void EP_NOINLINE epAdvanceTacts(uint32_t value) {
  cpu.tacts += value;
  epClockAdvance(value << 1);
  epCheckFrameCap();
}

/* A frame ends at `newStart` (half-T units) */
static void epFrameEnds(uint32_t newStart) { epAudioEndFrame(newStart); }

/* NICK's report that vertical sync started (ep-nick.c): the frame ends here */
static void epVsyncStarted(void) {
  if ((int32_t)(epHalfClock - epFrameStartHalf) < (int32_t)EP_MIN_FRAME_HALVES) return;
  epFrameEnds(epHalfClock);
  epFrameStartHalf = epHalfClock;
  epFrames++;
  epFrameCompleted = 1u;
}

/* T-states since the current frame started */
static inline uint32_t epFrameTacts(void) {
  const int32_t halves = (int32_t)(epHalfClock - epFrameStartHalf);
  return halves > 0 ? (uint32_t)halves >> 1 : 0u;
}

// -----------------------------------------------------------------------------
// The frame loop
// -----------------------------------------------------------------------------

static void epBeginFrame(void) {
  epFrameCompleted = 0u;
  epAudioNewFrame();
}

/*
 * One instruction: a new frame first if the last one completed, then the CPU cycles until the
 * instruction is complete. The INT line follows DAVE's interrupt latches.
 * Returns whether the frame completed.
 */
uint32_t epExecuteInstruction(void) {
  if (epFrameCompleted) {
    epBeginFrame();
  }
  if (epCaptureBusEvents) {
    z80ClearBusEvents();
    epOpStartAddress = cpu.pc;
  }
  do {
    cpu.sigInt = epDaveIntLine();
    z80ExecuteCpuCycle();
  } while (cpu.prefix != PREFIX_NONE);
  return epFrameCompleted;
}

/* The debugger's breakpoint flags and in-core loop, `epExecuteUntilStop` (z80-debug-loop.c) */
#define Z80_DEBUG_LOOP_PREFIX ep
#define Z80_DEBUG_LOOP_FRAME_COMPLETED epFrameCompleted
#include "../../../../z80/wasm/z80-debug-loop.c"

/* The last frame's length in T-states, or the nominal one while the LPT gives nothing sensible */
static uint32_t epLastFrameTacts = EP_NOMINAL_FRAME_TACTS;

/* Runs until the current frame completes (a frame stopped midway is finished) */
uint32_t epExecuteFrame(void) {
  const uint32_t frameLength = epLastFrameTacts;
  const uint32_t start = epFrameStartHalf;
  do {
    const uint32_t done = epFrameTacts();
    epCaptureBusEvents = done + EP_CAPTURE_WINDOW >= frameLength ? 1u : 0u;
    epExecuteInstruction();
    if (z80HistoryStopNow() != 0u) break;
  } while (!epFrameCompleted);
  epCaptureBusEvents = 1u;
  if (epFrameCompleted) {
    const uint32_t tacts = (epFrameStartHalf - start) >> 1;
    if (tacts * 2u >= EP_MIN_FRAME_HALVES && tacts * 2u <= EP_MAX_FRAME_HALVES) epLastFrameTacts = tacts;
  }
  return 0u;
}

// -----------------------------------------------------------------------------
// Buffers
// -----------------------------------------------------------------------------

uint32_t epMemoryPtr(void) { return (uint32_t)(uintptr_t)epMemory; }
uint32_t epGetMemoryCapacity(void) { return EP_PHYS_SIZE; }
/* The ROM upload areas: EXOS (32K), the cartridge (16K), the FILE: ROM (16K), EXDOS (32K) */
uint32_t epExosRomPtr(void) { return (uint32_t)(uintptr_t)&epMemory[EP_PHYS_EXOS]; }
uint32_t epCartRomPtr(void) { return (uint32_t)(uintptr_t)&epMemory[EP_PHYS_CART]; }
uint32_t epFileIoRomPtr(void) { return (uint32_t)(uintptr_t)&epMemory[EP_PHYS_FILEIO]; }
uint32_t epExdosRomPtr(void) { return (uint32_t)(uintptr_t)&epMemory[EP_PHYS_EXDOS]; }
uint32_t epPixelBufferPtr(void) { return (uint32_t)(uintptr_t)epPixelBuffer; }
uint32_t epGetPixelBufferCapacity(void) { return EP_SCREEN_WIDTH * EP_SCREEN_HEIGHT; }
uint32_t epGetScreenWidth(void) { return EP_SCREEN_WIDTH; }
uint32_t epGetScreenHeight(void) { return EP_SCREEN_HEIGHT; }
uint32_t epKeyboardLinesPtr(void) { return (uint32_t)(uintptr_t)epKeyboardLines; }

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

/*
 * Selects the model and the ROMs present: `is128` nonzero for 128K of RAM; `romMask` bit 0 the
 * cartridge, bit 1 the FILE: ROM, bit 2 EXDOS. Takes effect now.
 */
void epConfigure(uint32_t is128, uint32_t romMask) {
  epIs128 = is128 != 0u;
  epRomMask = (uint8_t)romMask;
  epBuildSegmentMap();
  epRemap();
}

static void epResetMachine(void) {
  epHalfClock = 0u;
  epNickAcc = 0u;
  epFrameStartHalf = 0u;
  epFrames = 0u;
  epFrameCompleted = 1u;
  epLastFrameTacts = EP_NOMINAL_FRAME_TACTS;
  cpu.tacts = 0u;
  epResetKeyboard();
  epResetMemoryMap();
  epResetPorts();
  epDaveReset();
  epDaveNextTick = epDaveTickHalves;
  epNickReset();
  epAudioReset();
}

/* The reset button: the CPU and DAVE reset, the RAM kept (EXOS decides warm or cold from RST_ADDR) */
void epReset(void) {
  z80SoftReset();
  epResetMachine();
}

/*
 * Power on: every CPU register and the RAM cleared, NICK's port registers set from a fixed seed (on
 * the real machine they are random, plan Q13). The ROMs stay.
 */
void epHardReset(void) {
  for (uint32_t i = EP_PHYS_RAM; i < EP_PHYS_UNMAPPED; i++) epMemory[i] = 0u;
  for (uint32_t i = EP_PHYS_UNMAPPED; i < EP_PHYS_SIZE; i++) epMemory[i] = 0xffu;
  z80Reset();
  epNickPowerOn();
  epResetMachine();
}

// -----------------------------------------------------------------------------
// Timing
// -----------------------------------------------------------------------------

uint32_t epGetBaseClockFrequency(void) { return EP_CLOCK; }
uint32_t epGetTactsInFrame(void) { return EP_NOMINAL_FRAME_TACTS; }
uint32_t epGetTactsInCurrentFrame(void) { return epLastFrameTacts; }
uint32_t epGetFrames(void) { return epFrames; }
uint32_t epGetFrameTacts(void) { return epFrameTacts(); }
uint32_t epGetFrameCompleted(void) { return epFrameCompleted; }
uint32_t epGetTacts(void) { return cpu.tacts; }
/* Sets the T-state counter; the half-T phase is kept */
void epSetTacts(uint32_t value) { cpu.tacts = value; }
uint32_t epGetHalfClock(void) { return epHalfClock; }
/* NICK's position inside its slot, in 1/EP_NICK_DEN NICK clocks (0 to 16 * EP_NICK_DEN - 1) */
uint32_t epGetNickSlotPhase(void) { return (uint32_t)(epNickAcc / 1000ull); }
/*
 * Places NICK's slot phase (the tests' hook): `clocks16` is the position in sixteenths of a NICK clock
 * from the start of the current slot (0-255). Nothing else moves; this is for putting an access at a
 * chosen phase, not for normal running.
 */
void epSetNickSlotPhase(uint32_t clocks16) {
  epNickAcc = ((uint64_t)(clocks16 & 0xffu) * EP_NICK_DEN) / 16ull;
}
uint32_t epGetClockMultiplier(void) { return 1u; }
/* The Enterprise runs at its own clock only: NICK makes the CPU clock */
void epSetTargetClockMultiplier(uint32_t value) { (void)value; }

// -----------------------------------------------------------------------------
// CPU
// -----------------------------------------------------------------------------

uint32_t epGetCpuOpCode(void) { return cpu.opCode; }
uint32_t epGetOpStartAddress(void) { return epOpStartAddress; }

// -----------------------------------------------------------------------------
// Breakpoint conditions: the shared evaluator, reading memory through the map without side effects
// -----------------------------------------------------------------------------

#define COND_PEEK(address) ((uint32_t)epPeekMemory((uint16_t)((address) & 0xffffu)))
#include "../../../../z80/wasm/z80-condition.c"

// -----------------------------------------------------------------------------
// Execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3): the shared recorder. The
// context:
//   0-3  the page registers B0h-B3h (the segment each 16K page shows)
//   4    bit 0 the Enterprise 128
//   5    BFh as last written
// -----------------------------------------------------------------------------

static inline void epHistoryContext(uint32_t kind, uint8_t *out) {
  (void)kind;
  for (uint32_t i = 0u; i < 4u; i++) out[i] = epPageReg[i];
  out[4] = epIs128;
  out[5] = epDaveBf;
  for (uint32_t i = 6u; i < 16u; i++) out[i] = 0u;
}

#define Z80_HISTORY_CAPACITY 65536u
#define Z80_HISTORY_PEEK(address) epPeekMemory((uint16_t)((address) & 0xffffu))
#define Z80_HISTORY_CONTEXT(kind, out16) epHistoryContext(kind, out16)
#define Z80_HISTORY_FRAME() epFrames
#define Z80_HISTORY_FRAME_TACT() epFrameTacts()
#include "../../../../z80/wasm/z80-history.c"

// -----------------------------------------------------------------------------
// The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2): a byte's profile offset is
// its physical address in `epMemory`. ROM and unmapped segments take no writes.
// -----------------------------------------------------------------------------

static inline int32_t epProfilePhys(uint32_t address, uint32_t write) {
  const uint32_t page = (address >> 14) & 3u;
  if (write != 0u && !(epPageWritable & (1u << page))) return -1;
  return (int32_t)epPhysicalAddress((uint16_t)address);
}

#define Z80_PROFILE_FLAG_BYTES EP_PHYS_SIZE
#define Z80_PROFILE_POOL_PAGES 8u
#define Z80_PROFILE_PHYS_READ(address) epProfilePhys((uint32_t)(address), 0u)
#define Z80_PROFILE_PHYS_WRITE(address) epProfilePhys((uint32_t)(address), 1u)
#define Z80_PROFILE_FRAME_TICKS() cpu.tacts
#include "../../../../z80/wasm/z80-profile.c"
