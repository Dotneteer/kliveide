/*
 * Videoton TV Computer (TVC) - the full-machine WASM core.
 *
 * One translation unit: the machine state below, the TVC parts it includes, and the shared Z80 core
 * (`src/emu/z80/wasm/z80.c`) wired to them through the `Z80_*` hook macros. No heap; every buffer is
 * a static array exposed through a pointer export. The plan is `.plans/VIDEOTON_TVC_PLAN.md`; the
 * hardware facts come from `_input/videoton-tvc/` (TVC_HARDWARE_OVERVIEW.md, TVC_VIDEO_GENERATION.md,
 * TVC_CLOCK_STRETCH_FIGURES.md). The code is Klive's own.
 *
 * One artifact runs both models (plan §4.3, D2): `tvcConfigure` picks the 64K or the 64K+ at run
 * time, and the host uploads the model's ROMs.
 *
 * Time (plan §3.1, D5): `cpu.tacts` counts whole CPU T-states (320 ns). The CPU clock can be stopped
 * for half a T-state at a time on a video RAM access, so the machine also keeps `tvcHalfClock`, the
 * time in 160 ns units: always 2 * tacts plus the half-T phase (its lowest bit). The CRTC, the pixel
 * clocks and the sound divider run from the fixed clock tree, so they follow `tvcHalfClock`.
 *
 * The frame (plan §3.3): a machine frame ends where the CRTC starts a new frame, so it is 62,800 T
 * with the ROM's CRTC values (49.76 Hz). A frame shorter than half a nominal one is not a frame (the
 * CRTC is not programmed yet), and two nominal frames end one whatever the CRTC does.
 *
 * Every name is prefixed `tvc`: `z80.c` defines register macros (`A`, `F`, `HL`, ...).
 */
#include <stdint.h>

// -----------------------------------------------------------------------------
// Machine constants
// -----------------------------------------------------------------------------

/* The CPU clock: the 25 MHz crystal divided by 8 (HW p.48-49) */
#define TVC_CLOCK 3125000u

/* The ROM's CRTC values give 100 characters x 314 lines; a character is 2 T (plan §7) */
#define TVC_NOMINAL_FRAME_TACTS 62800u
/* In half-T units: a frame shorter than half a nominal frame is not a frame; two end one */
#define TVC_MIN_FRAME_HALVES TVC_NOMINAL_FRAME_TACTS
#define TVC_MAX_FRAME_HALVES (4u * TVC_NOMINAL_FRAME_TACTS)
/* A CRTC character clock is 640 ns: four half-T units */
#define TVC_CHAR_HALVES 4u

/*
 * The physical memory, one array: every bank the mapper can show (plan §2; rtvc/info/tvc.md
 * "Memory Map"). The CPU sees it through eight 8K slots (`tvc-memory.c`). It is eleven 16K
 * partitions in the IDE's numbering (`TvcWasmV2Machine.ts`): U0-U3 and VID0-VID3 are partitions
 * 0-7 at 16K times their number, then SYS, CART, and EXT - the card window and EXTH in the order the
 * EXT page shows them (C000-DFFF, E000-FFFF), so the page is one partition.
 */
#define TVC_U0 0x00000u
#define TVC_VID0 0x10000u
#define TVC_SYS 0x20000u
#define TVC_CART 0x24000u
#define TVC_EXT_CARD 0x28000u
#define TVC_EXTH 0x2a000u
#define TVC_PHYS_SIZE 0x2c000u
#define TVC_BANK_SIZE 0x4000u

/* The TV picture (plan §7, D4): 76 characters of 8 dots, 288 lines */
#define TVC_SCREEN_WIDTH 608u
#define TVC_SCREEN_HEIGHT 288u

#define TVC_KEYBOARD_ROWS 16u

// -----------------------------------------------------------------------------
// Machine state
// -----------------------------------------------------------------------------

static uint8_t tvcMemory[TVC_PHYS_SIZE];
static uint32_t tvcPixelBuffer[TVC_SCREEN_WIDTH * TVC_SCREEN_HEIGHT];
/* The keyboard matrix: one byte per row, a set bit is a pressed key (rows 0-10, columns 0-7) */
static uint8_t tvcKeyboardLines[TVC_KEYBOARD_ROWS];

/* The model: 0 the 64K (HBA-1 board), 1 the 64K+ (HBA-2 board) */
static uint8_t tvcIsPlus;

/* Time: the half-T clock (see the header), the next CRTC character to run, the current frame's start */
static uint32_t tvcHalfClock;
static uint32_t tvcNextCharHalf;
static uint32_t tvcFrameStartHalf;
static uint32_t tvcFrames;
static uint8_t tvcFrameCompleted = 1u;
/* Set by the CRTC when the character it runs starts a new CRTC frame */
static uint8_t tvcCrtcFrameBegan;

/* Ports 03h-06h as last written (tvc-ports.c); the sound (04h-06h) and the tape (05h) read them */
static uint8_t tvcPort03;
static uint8_t tvcPort04;
static uint8_t tvcPort05;
static uint8_t tvcPort06;

/* The shared interrupt flip-flop: cursor and sound timer (HW p.47; plan §7 "Interrupt") */
static uint8_t tvcItPending;

/* The instruction the debugger shows (`Z80Cpu.opStartAddress`) */
static uint16_t tvcOpStartAddress;

/*
 * Whether an instruction records its bus activity for the IDE, as on the HT-1080Z core: always in
 * the debugger's paths, and for the last `TVC_CAPTURE_WINDOW` T-states of a fast frame.
 */
static uint8_t tvcCaptureBusEvents = 1u;
#define TVC_CAPTURE_WINDOW 1024u

#if defined(__clang__) || defined(__GNUC__)
#define TVC_NOINLINE __attribute__((noinline))
#else
#define TVC_NOINLINE
#endif

// -----------------------------------------------------------------------------
// The shared Z80 core, wired to the TVC
// -----------------------------------------------------------------------------

static uint8_t tvcCpuReadMemory(uint16_t address);
static void tvcCpuWriteMemory(uint16_t address, uint8_t value);
static void tvcPokeMemory(uint16_t address, uint8_t value);
static uint8_t tvcCpuReadPort(uint16_t address);
static void tvcCpuWritePort(uint16_t address, uint8_t value);
/* Not inlined: inlined into every opcode, per-tact work multiplies the code */
static void TVC_NOINLINE tvcAdvanceTacts(uint32_t value);
/* A memory cycle's timing: 3 T, plus the clock stretch on video RAM and the M1 WAIT (tvc-timing.c) */
static void TVC_NOINLINE tvcDelayMemory(uint16_t address, uint32_t m1);

#define Z80_EXTERNAL_BUS 1
#define Z80_CAPTURE_BUS_EVENTS() tvcCaptureBusEvents
#define Z80_ACCESS_LOG_NOINLINE 1
#define Z80_MEMORY_PTR() tvcMemory
#define Z80_READ_MEMORY(address) tvcCpuReadMemory((uint16_t)(address))
#define Z80_WRITE_MEMORY(address, value) tvcCpuWriteMemory((uint16_t)(address), (uint8_t)(value))
#define Z80_POKE_MEMORY(address, value) tvcPokeMemory((uint16_t)(address), (uint8_t)(value))
#define Z80_READ_PORT(address) tvcCpuReadPort((uint16_t)(address))
#define Z80_WRITE_PORT(address, value) tvcCpuWritePort((uint16_t)(address), (uint8_t)(value))
#define Z80_DELAY_MEMORY_READ(address) tvcDelayMemory((uint16_t)(address), 0u)
#define Z80_DELAY_MEMORY_WRITE(address) tvcDelayMemory((uint16_t)(address), 0u)
/* Hook H1 (plan §5): an M1 stretches differently and takes the WAIT circuit's wait state */
#define Z80_DELAY_OPCODE_FETCH(address) tvcDelayMemory((uint16_t)(address), 1u)
#define Z80_TACT_PLUS_N(value) tvcAdvanceTacts((uint32_t)(value))
#include "../../../../z80/wasm/z80-history.h"
#include "../../../../z80/wasm/z80-profile.h"
#include "../../../../z80/wasm/z80.c"
/* The CPU's registers and debugger state, exported as `tvcGetCpuAf` ... */
#define Z80_EXPORT_PREFIX tvc
#include "../../../../z80/wasm/z80-cpu-exports.c"

// -----------------------------------------------------------------------------
// TVC parts
// -----------------------------------------------------------------------------

/* Defined below, after the parts that call them */
static inline void tvcRunVideoToNow(void);
static void tvcCrtcFrameStarted(uint32_t charStart);
static void tvcFrameEnds(uint32_t newStart);

#include "tvc-memory.c"
#include "tvc-keyboard.c"
#include "tvc-crtc.c"
#include "tvc-audio.c"
#include "tvc-tape.c"
#include "tvc-video.c"
#include "tvc-ports.c"
#include "tvc-timing.c"

/* Runs every CRTC character that has started by now */
static inline void tvcRunVideoToNow(void) {
  while ((int32_t)(tvcHalfClock - tvcNextCharHalf) >= 0) {
    tvcVideoCharacter(tvcNextCharHalf);
    tvcNextCharHalf += TVC_CHAR_HALVES;
  }
}

/* Every CPU clock step: the tact counter, the half-T clock, and the video characters that start */
static void TVC_NOINLINE tvcAdvanceTacts(uint32_t value) {
  cpu.tacts += value;
  tvcHalfClock += value << 1;
  tvcRunVideoToNow();
  tvcAudioAdvance();
  /* A CRTC that never starts a new frame (or starts them too often): two nominal frames end one */
  if (!tvcFrameCompleted && (int32_t)(tvcHalfClock - tvcFrameStartHalf) >= (int32_t)TVC_MAX_FRAME_HALVES) {
    tvcFrameEnds(tvcHalfClock);
    tvcFrameStartHalf = tvcHalfClock;
    tvcFrames++;
    tvcFrameCompleted = 1u;
  }
}

/* A frame ends at `newStart` (half-T units): the sound's points move back, the tape catches up */
static void tvcFrameEnds(uint32_t newStart) {
  tvcAudioEndFrame(newStart);
  tvcTapeUpdate();
}

/* The video's report that the CRTC started a new frame at `charStart` (tvc-video.c) */
static void tvcCrtcFrameStarted(uint32_t charStart) {
  if ((int32_t)(charStart - tvcFrameStartHalf) < (int32_t)TVC_MIN_FRAME_HALVES) return;
  tvcFrameEnds(charStart);
  tvcFrameStartHalf = charStart;
  tvcFrames++;
  tvcFrameCompleted = 1u;
}

/*
 * T-states since the current frame started. The frame can start a character after the CRTC ran its
 * predecessor's last character, so for up to 4 half-T units the start may lie just ahead: 0 then.
 */
static inline uint32_t tvcFrameTacts(void) {
  const int32_t halves = (int32_t)(tvcHalfClock - tvcFrameStartHalf);
  return halves > 0 ? (uint32_t)halves >> 1 : 0u;
}

// -----------------------------------------------------------------------------
// The frame loop
// -----------------------------------------------------------------------------

static void tvcBeginFrame(void) {
  tvcFrameCompleted = 0u;
  tvcAudioNewFrame();
}

/*
 * One instruction: a new frame first if the last one completed, then the CPU cycles until the
 * instruction is complete. The INT line follows the interrupt flip-flop, which the video sets.
 * Returns whether the frame completed.
 */
uint32_t tvcExecuteInstruction(void) {
  if (tvcFrameCompleted) {
    tvcBeginFrame();
  }
  if (tvcCaptureBusEvents) {
    z80ClearBusEvents();
    tvcOpStartAddress = cpu.pc;
  }
  do {
    cpu.sigInt = tvcItPending;
    z80ExecuteCpuCycle();
  } while (cpu.prefix != PREFIX_NONE);
  return tvcFrameCompleted;
}

/* The debugger's breakpoint flags and in-core loop, `tvcExecuteUntilStop` (z80-debug-loop.c) */
#define Z80_DEBUG_LOOP_PREFIX tvc
#define Z80_DEBUG_LOOP_FRAME_COMPLETED tvcFrameCompleted
#include "../../../../z80/wasm/z80-debug-loop.c"

/* The CRTC's frame length in T-states, or the nominal one while the CRTC gives nothing sensible */
static uint32_t tvcTactsInCurrentFrame(void) {
  const uint32_t tacts = tvcCrtcFrameTacts();
  return tacts * 2u >= TVC_MIN_FRAME_HALVES && tacts * 2u <= TVC_MAX_FRAME_HALVES ? tacts : TVC_NOMINAL_FRAME_TACTS;
}

/* Runs until the current frame completes (a frame stopped midway is finished) */
uint32_t tvcExecuteFrame(void) {
  const uint32_t frameLength = tvcTactsInCurrentFrame();
  do {
    const uint32_t done = tvcFrameTacts();
    tvcCaptureBusEvents = done + TVC_CAPTURE_WINDOW >= frameLength ? 1u : 0u;
    tvcExecuteInstruction();
    if (z80HistoryStopNow() != 0u) break;
  } while (!tvcFrameCompleted);
  tvcCaptureBusEvents = 1u;
  return 0u;
}

// -----------------------------------------------------------------------------
// Buffers
// -----------------------------------------------------------------------------

uint32_t tvcMemoryPtr(void) { return (uint32_t)(uintptr_t)tvcMemory; }
uint32_t tvcGetMemoryCapacity(void) { return TVC_PHYS_SIZE; }
/* The ROM upload areas: SYS (16K), EXTH (8K) and the cartridge (16K) */
uint32_t tvcSysRomPtr(void) { return (uint32_t)(uintptr_t)&tvcMemory[TVC_SYS]; }
uint32_t tvcExthRomPtr(void) { return (uint32_t)(uintptr_t)&tvcMemory[TVC_EXTH]; }
uint32_t tvcCartRomPtr(void) { return (uint32_t)(uintptr_t)&tvcMemory[TVC_CART]; }
uint32_t tvcPixelBufferPtr(void) { return (uint32_t)(uintptr_t)tvcPixelBuffer; }
uint32_t tvcGetPixelBufferCapacity(void) { return TVC_SCREEN_WIDTH * TVC_SCREEN_HEIGHT; }
uint32_t tvcGetScreenWidth(void) { return TVC_SCREEN_WIDTH; }
uint32_t tvcGetScreenHeight(void) { return TVC_SCREEN_HEIGHT; }
uint32_t tvcKeyboardLinesPtr(void) { return (uint32_t)(uintptr_t)tvcKeyboardLines; }

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

/* Selects the model: `plus` nonzero for the 64K+ (four video banks, no WAIT circuit). Takes effect now. */
void tvcConfigure(uint32_t plus) {
  tvcIsPlus = plus != 0u;
  tvcRemap();
}

static void tvcResetMachine(void) {
  tvcHalfClock = 0u;
  tvcNextCharHalf = 0u;
  tvcFrameStartHalf = 0u;
  tvcFrames = 0u;
  tvcFrameCompleted = 1u;
  tvcCrtcFrameBegan = 0u;
  tvcItPending = 0u;
  cpu.tacts = 0u;
  tvcResetKeyboard();
  tvcResetMemoryMap();
  tvcResetPorts();
  tvcCrtcReset();
  tvcVideoReset();
  tvcAudioReset();
  tvcTapeReset();
}

/* The IDE's soft reset: the CPU's registers kept as on a Z80 /RESET, the memory kept */
void tvcReset(void) {
  z80SoftReset();
  tvcResetMachine();
}

/*
 * Power on: every CPU register, the RAM, the video RAM, the palette and the CRTC registers cleared
 * (the real contents are random; the ROM sets them). The ROMs stay.
 */
void tvcHardReset(void) {
  for (uint32_t i = TVC_U0; i < TVC_SYS; i++) tvcMemory[i] = 0u;
  for (uint32_t i = TVC_EXT_CARD; i < TVC_EXTH; i++) tvcMemory[i] = 0xffu;
  z80Reset();
  tvcCrtcPowerOn();
  tvcVideoPowerOn();
  tvcResetMachine();
}

// -----------------------------------------------------------------------------
// Timing
// -----------------------------------------------------------------------------

uint32_t tvcGetBaseClockFrequency(void) { return TVC_CLOCK; }
uint32_t tvcGetTactsInFrame(void) { return TVC_NOMINAL_FRAME_TACTS; }
uint32_t tvcGetTactsInCurrentFrame(void) { return tvcTactsInCurrentFrame(); }
uint32_t tvcGetFrames(void) { return tvcFrames; }
uint32_t tvcGetFrameTacts(void) { return tvcFrameTacts(); }
uint32_t tvcGetFrameCompleted(void) { return tvcFrameCompleted; }
uint32_t tvcGetTacts(void) { return cpu.tacts; }
/* Sets the T-state counter; the half-T phase is kept */
void tvcSetTacts(uint32_t value) { cpu.tacts = value; }
uint32_t tvcGetHalfClock(void) { return tvcHalfClock; }
/*
 * Moves the half-T clock to `value` (the tests' and the debugger's hook): the next CRTC character
 * starts at the first character boundary (a multiple of 4) at or after it. The characters in between
 * are not run, so this is for placing an access at a chosen phase, not for normal running.
 */
void tvcSetHalfClock(uint32_t value) {
  tvcHalfClock = value;
  tvcNextCharHalf = (value + TVC_CHAR_HALVES - 1u) & ~(TVC_CHAR_HALVES - 1u);
  tvcFrameStartHalf = value;
}
uint32_t tvcGetClockMultiplier(void) { return 1u; }
/* The TVC runs at its own clock only: the CPU and the video share one clock tree */
void tvcSetTargetClockMultiplier(uint32_t value) { (void)value; }

// -----------------------------------------------------------------------------
// CPU
// -----------------------------------------------------------------------------

uint32_t tvcGetCpuOpCode(void) { return cpu.opCode; }
uint32_t tvcGetOpStartAddress(void) { return tvcOpStartAddress; }
uint32_t tvcGetItPending(void) { return tvcItPending; }

// -----------------------------------------------------------------------------
// Breakpoint conditions: the shared evaluator, reading memory through the map without side effects
// -----------------------------------------------------------------------------

#define COND_PEEK(address) ((uint32_t)tvcPeekMemory((uint16_t)((address) & 0xffffu)))
#include "../../../../z80/wasm/z80-condition.c"

// -----------------------------------------------------------------------------
// Execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3): the shared recorder. The
// context:
//   0    bit 0 the 64K+; bit 1 the video bank shown on the 64K+ is not 0
//   1    port 02h (the main paging register)
//   2    port 0Ch (the 64K+ video paging register)
// -----------------------------------------------------------------------------

static inline void tvcHistoryContext(uint32_t kind, uint8_t *out) {
  (void)kind;
  out[0] = (uint8_t)(tvcIsPlus | (tvcDisplayBank != 0u ? 0x02u : 0u));
  out[1] = tvcPort02;
  out[2] = tvcPort0c;
  for (uint32_t i = 3u; i < 16u; i++) out[i] = 0u;
}

#define Z80_HISTORY_CAPACITY 65536u
#define Z80_HISTORY_PEEK(address) tvcPeekMemory((uint16_t)((address) & 0xffffu))
#define Z80_HISTORY_CONTEXT(kind, out16) tvcHistoryContext(kind, out16)
#define Z80_HISTORY_FRAME() tvcFrames
#define Z80_HISTORY_FRAME_TACT() tvcFrameTacts()
#include "../../../../z80/wasm/z80-history.c"

// -----------------------------------------------------------------------------
// The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2): a byte's profile offset is
// its physical address in `tvcMemory`. ROM and an empty card window take no writes.
// -----------------------------------------------------------------------------

static inline int32_t tvcProfilePhys(uint32_t address, uint32_t write) {
  const uint32_t phys = tvcPhysicalAddress((uint16_t)address);
  if (write != 0u && !tvcSlotWritable[(address >> 13) & 7u]) return -1;
  return (int32_t)phys;
}

#define Z80_PROFILE_FLAG_BYTES TVC_PHYS_SIZE
#define Z80_PROFILE_POOL_PAGES 8u
#define Z80_PROFILE_PHYS_READ(address) tvcProfilePhys((uint32_t)(address), 0u)
#define Z80_PROFILE_PHYS_WRITE(address) tvcProfilePhys((uint32_t)(address), 1u)
#define Z80_PROFILE_FRAME_TICKS() cpu.tacts
#include "../../../../z80/wasm/z80-profile.c"
