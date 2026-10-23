/*
 * HT-1080Z - the full-machine WASM core.
 *
 * One translation unit: the machine state below, the HT parts it includes, and the shared Z80 core
 * (`src/emu/z80/wasm/z80.c`) wired to them through the `Z80_*` hook macros. No heap; every buffer is
 * a static array exposed through a pointer export. The plan is `.plans/HT1080Z_PLAN.md`; the
 * hardware facts come from `_input/ht1080z/` (HARDWARE.md, VIDEO_TIMING.md), with the values the
 * plan's §17 records.
 *
 * One artifact runs every model (decision D1): `ht1080zConfigure` picks the clock and the RAM size at
 * run time, and the host uploads the model's BASIC, extension and character ROMs.
 *
 * The machine has no interrupt source and no wait states: the RESET key drives NMI (0066h, memory
 * kept), and the video RAM is shared with the CPU without stalling it.
 *
 * Every name is prefixed `ht`/`ht1080z`: `z80.c` defines register macros (`A`, `F`, `HL`, ...).
 */
#include <stdint.h>

// -----------------------------------------------------------------------------
// Machine constants
// -----------------------------------------------------------------------------

/* Series I/II: 10.644 MHz / 6; the /64: 10.6645 MHz / 6 (plan D5) */
#define HT_CLOCK_S12 1774000u
#define HT_CLOCK_64 1777417u

/* One T-state per character slot: 112 T a line, 312 lines a frame */
#define HT_TACTS_PER_LINE 112u
#define HT_LINES_PER_FRAME 312u
#define HT_TACTS_IN_FRAME (HT_TACTS_PER_LINE * HT_LINES_PER_FRAME)

/* The memory map (HARDWARE.md §3) */
#define HT_ROM_SIZE 0x3800u          /* BASIC 0000-2FFF and the extension EPROM 3000-37FF */
#define HT_KEYBOARD_START 0x3800u     /* 3800-3BFF: the keyboard matrix */
#define HT_VIDEO_RAM_START 0x3c00u    /* 3C00-3FFF: 1K x 8 video RAM */
#define HT_RAM_START 0x4000u
#define HT_MEMORY_SIZE 0x10000u
#define HT_CHARGEN_SIZE 0x0800u

/* The picture (decision D6): 64 x 6 dots and 16 x 12 lines, with a 72-dot and 48-line border */
#define HT_SCREEN_WIDTH 528u
#define HT_SCREEN_HEIGHT 288u

#define HT_KEYBOARD_LINES 8u

/* Colours (0xAABBGGRR) */
#define HT_BLACK 0xff000000u

// -----------------------------------------------------------------------------
// Machine state
// -----------------------------------------------------------------------------

/*
 * The 64K the CPU addresses, as one array: the ROMs at 0000-37FF (uploaded by the host), the video
 * RAM at 3C00 and the RAM from 4000. 3800-3BFF holds nothing: the keyboard is read there. The
 * condition store and a state file read it as the machine's linear memory.
 */
static uint8_t htMemory[HT_MEMORY_SIZE];
/* The character generator: 128 glyphs of 16 rows; the video renderer reads it (Phase 3) */
static uint8_t htChargen[HT_CHARGEN_SIZE];
static uint32_t htPixelBuffer[HT_SCREEN_WIDTH * HT_SCREEN_HEIGHT];

/* The keyboard matrix: one byte per row, a set bit is a pressed key (row 0-7, column D0-D7) */
static uint8_t htKeyboardLines[HT_KEYBOARD_LINES];

/* The model */
static uint32_t htClockFrequency = HT_CLOCK_S12;
static uint32_t htRamSizeKb = 16u;
/* The first address above the RAM (8000h with 16K; 10000h with 48K) */
static uint32_t htRamEnd = 0x8000u;
/* 0 Series I, 1 Series II, 2 the /64 (for the history context) */
static uint8_t htModel = 1u;

/* Frame accounting */
static uint32_t htFrames;
static uint32_t htFrameTacts;
static uint32_t htTactsInCurrentFrame = HT_TACTS_IN_FRAME;
static uint32_t htClockMultiplier = 1u;
static uint32_t htTargetClockMultiplier = 1u;
static uint8_t htFrameCompleted = 1u;

/* The RESET key's NMI, waiting for the next instruction boundary (the Z80's NMI is edge-triggered) */
static uint8_t htNmiPending;

/* The instruction the debugger shows (`Z80Cpu.opStartAddress`) */
static uint16_t htOpStartAddress;

/*
 * Whether an instruction records its bus activity for the IDE, as on the ZX80/81 core
 * (`zx8081.c`, `.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` Phase 1): always in the debugger's paths, and
 * for the last `HT_CAPTURE_WINDOW` T-states of a fast frame - a window that depends only on the
 * position in the frame, so a replay records what the straight run did.
 */
static uint8_t htCaptureBusEvents = 1u;
#define HT_CAPTURE_WINDOW 1024u

#if defined(__clang__) || defined(__GNUC__)
#define HT_NOINLINE __attribute__((noinline))
#else
#define HT_NOINLINE
#endif

// -----------------------------------------------------------------------------
// The shared Z80 core, wired to the HT-1080Z
// -----------------------------------------------------------------------------

static uint8_t htCpuReadMemory(uint16_t address);
static void htCpuWriteMemory(uint16_t address, uint8_t value);
static void htPokeMemory(uint16_t address, uint8_t value);
static uint8_t htCpuReadPort(uint16_t address);
static void htCpuWritePort(uint16_t address, uint8_t value);
/* Not inlined: inlined into every opcode, per-tact work multiplies the code */
static void HT_NOINLINE htAdvanceTacts(uint32_t value);
/* The memory cycle's timing: the default 3 T, after the video sees a video-RAM access (video.c) */
static inline void htDelayMemory(uint16_t address);

#define Z80_EXTERNAL_BUS 1
#define Z80_CAPTURE_BUS_EVENTS() htCaptureBusEvents
/* The log is written only while capturing: out of line, so it does not grow every opcode (z80.c) */
#define Z80_ACCESS_LOG_NOINLINE 1
#define Z80_MEMORY_PTR() htMemory
#define Z80_READ_MEMORY(address) htCpuReadMemory((uint16_t)(address))
#define Z80_WRITE_MEMORY(address, value) htCpuWriteMemory((uint16_t)(address), (uint8_t)(value))
#define Z80_POKE_MEMORY(address, value) htPokeMemory((uint16_t)(address), (uint8_t)(value))
#define Z80_READ_PORT(address) htCpuReadPort((uint16_t)(address))
#define Z80_WRITE_PORT(address, value) htCpuWritePort((uint16_t)(address), (uint8_t)(value))
/* No wait states: 3 T memory and 4 T port cycles; a video-RAM access only disturbs the picture */
#define Z80_DELAY_MEMORY_READ(address) htDelayMemory((uint16_t)(address))
#define Z80_DELAY_MEMORY_WRITE(address) htDelayMemory((uint16_t)(address))
#define Z80_TACT_PLUS_N(value) htAdvanceTacts((uint32_t)(value))
/* The execution-history recorder's hooks; the recorder and this machine's macros are at the end */
#include "../../../../z80/wasm/z80-history.h"
/* The access profile's hooks; the module and this machine's mapping are at the end */
#include "../../../../z80/wasm/z80-profile.h"
#include "../../../../z80/wasm/z80.c"
/* The CPU's registers and debugger state, exported as `ht1080zGetCpuAf` ... */
#define Z80_EXPORT_PREFIX ht1080z
#include "../../../../z80/wasm/z80-cpu-exports.c"

// -----------------------------------------------------------------------------
// HT-1080Z parts
// -----------------------------------------------------------------------------

#include "ht1080z-keyboard.c"
#include "ht1080z-memory.c"
#include "ht1080z-audio.c"
#include "ht1080z-ports.c"
#include "ht1080z-video.c"

/*
 * Every CPU clock step: the tact counter, the audio samples due, and the frame accounting. The
 * samples of a step that passes the frame's end belong to the frame ending (at most one): the
 * buffer is the host's until the next frame begins.
 */
static void HT_NOINLINE htAdvanceTacts(uint32_t value) {
  cpu.tacts += value;
  htFrameTacts += value;
  htAudioAdvance();
  if (htFrameTacts >= htTactsInCurrentFrame) {
    htVideoEndFrame();
    htAudioEndFrame(htTactsInCurrentFrame);
    htFrames++;
    htFrameTacts -= htTactsInCurrentFrame;
    htFrameCompleted = 1u;
  }
}

// -----------------------------------------------------------------------------
// The frame loop
// -----------------------------------------------------------------------------

static void htBeginFrame(void) {
  if (htClockMultiplier != htTargetClockMultiplier) {
    htClockMultiplier = htTargetClockMultiplier;
  }
  htTactsInCurrentFrame = HT_TACTS_IN_FRAME * htClockMultiplier;
  htFrameCompleted = 0u;
  htAudioNewFrame();
}

/*
 * One instruction: a new frame first if the last one completed; the RESET key's NMI; the CPU cycles
 * until the instruction is complete. There is no INT source on a bare machine (HARDWARE.md §2).
 * Returns whether the frame completed.
 */
uint32_t ht1080zExecuteInstruction(void) {
  if (htFrameCompleted) {
    htBeginFrame();
  }
  if (htCaptureBusEvents) {
    z80ClearBusEvents();
    htOpStartAddress = cpu.pc;
  }
  /*
   * The RESET key's NMI is taken at this instruction boundary: the line is up for the first cycle
   * only. The shared core does not lower it when it takes the NMI - the machine owns the line, as on
   * the ZX81 - so left up, every instruction would start with another NMI to 0066h.
   */
  z80SetSigNmi(htNmiPending);
  htNmiPending = 0u;
  do {
    z80ExecuteCpuCycle();
    z80SetSigNmi(0u);
  } while (cpu.prefix != PREFIX_NONE);
  return htFrameCompleted;
}

/* The debugger's breakpoint flags and in-core loop, `ht1080zExecuteUntilStop` (z80-debug-loop.c) */
#define Z80_DEBUG_LOOP_PREFIX ht1080z
#define Z80_DEBUG_LOOP_FRAME_COMPLETED htFrameCompleted
#include "../../../../z80/wasm/z80-debug-loop.c"

/* Runs until the current frame completes (a frame stopped midway is finished) */
uint32_t ht1080zExecuteFrame(void) {
  do {
    htCaptureBusEvents = htTactsInCurrentFrame - htFrameTacts <= HT_CAPTURE_WINDOW ? 1u : 0u;
    ht1080zExecuteInstruction();
    /* A reverse-debugging stop target, checked on the frame's last instruction too */
    if (z80HistoryStopNow() != 0u) break;
  } while (!htFrameCompleted);
  htCaptureBusEvents = 1u;
  return 0u;
}

// -----------------------------------------------------------------------------
// Buffers
// -----------------------------------------------------------------------------

/* The ROM upload area is the start of the CPU's memory: 0000-37FF */
uint32_t ht1080zRomPtr(void) { return (uint32_t)(uintptr_t)htMemory; }
uint32_t ht1080zGetRomCapacity(void) { return HT_ROM_SIZE; }
uint32_t ht1080zMemoryPtr(void) { return (uint32_t)(uintptr_t)htMemory; }
uint32_t ht1080zGetMemoryCapacity(void) { return HT_MEMORY_SIZE; }
uint32_t ht1080zChargenPtr(void) { return (uint32_t)(uintptr_t)htChargen; }
uint32_t ht1080zGetChargenCapacity(void) { return HT_CHARGEN_SIZE; }
uint32_t ht1080zPixelBufferPtr(void) { return (uint32_t)(uintptr_t)htPixelBuffer; }
uint32_t ht1080zGetPixelBufferCapacity(void) { return HT_SCREEN_WIDTH * HT_SCREEN_HEIGHT; }
uint32_t ht1080zGetScreenWidth(void) { return HT_SCREEN_WIDTH; }
uint32_t ht1080zGetScreenHeight(void) { return HT_SCREEN_HEIGHT; }
uint32_t ht1080zKeyboardLinesPtr(void) { return (uint32_t)(uintptr_t)htKeyboardLines; }

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

/*
 * Selects the model. `model`: 0 Series I, 1 Series II, 2 the /64 (the clock follows: 1,774,000 Hz or
 * 1,777,417 Hz); `ramKb`: 16 (RAM at 4000-7FFF) or 48 (4000-FFFF). Takes effect now; the host uploads
 * the ROMs and hard-resets afterwards.
 */
void ht1080zConfigure(uint32_t model, uint32_t ramKb) {
  htModel = (uint8_t)(model > 2u ? 1u : model);
  htClockFrequency = htModel == 2u ? HT_CLOCK_64 : HT_CLOCK_S12;
  htRamSizeKb = ramKb >= 48u ? 48u : 16u;
  htRamEnd = htRamSizeKb == 48u ? 0x10000u : 0x8000u;
  htVideoFoldsLowCodes = htModel == 2u ? 0u : 1u;
}

static void htResetMachine(void) {
  htFrames = 0u;
  htFrameTacts = 0u;
  htFrameCompleted = 1u;
  htClockMultiplier = htTargetClockMultiplier;
  htTactsInCurrentFrame = HT_TACTS_IN_FRAME * htClockMultiplier;
  htNmiPending = 0u;
  htResetKeyboard();
  htResetPorts();
  htVideoReset();
  htAudioReset();
}

/* The IDE's soft reset: the CPU's registers kept as on a Z80 /RESET, the memory kept */
void ht1080zReset(void) {
  z80SoftReset();
  htResetMachine();
}

/*
 * Power on: every CPU register, the video RAM and the RAM cleared (the real contents are random; the
 * ROM clears the screen and sizes the memory itself). The ROMs at 0000-37FF stay.
 */
void ht1080zHardReset(void) {
  for (uint32_t i = HT_KEYBOARD_START; i < HT_MEMORY_SIZE; i++) htMemory[i] = 0u;
  z80Reset();
  htResetMachine();
  /* The AY is reset by the power-on /RESET only (SOUND_AY.md §6) */
  resetPsg();
}

/* The RESET key on the back panel: an NMI to 0066h, which keeps the memory (HARDWARE.md §2, §10) */
void ht1080zPressResetKey(void) { htNmiPending = 1u; }

// -----------------------------------------------------------------------------
// Timing
// -----------------------------------------------------------------------------

uint32_t ht1080zGetBaseClockFrequency(void) { return htClockFrequency; }
uint32_t ht1080zGetTactsInFrame(void) { return HT_TACTS_IN_FRAME; }
uint32_t ht1080zGetTactsInCurrentFrame(void) { return htTactsInCurrentFrame; }
uint32_t ht1080zGetFrames(void) { return htFrames; }
uint32_t ht1080zGetFrameTacts(void) { return htFrameTacts; }
uint32_t ht1080zGetFrameCompleted(void) { return htFrameCompleted; }
uint32_t ht1080zGetTacts(void) { return cpu.tacts; }
void ht1080zSetTacts(uint32_t value) { cpu.tacts = value; }
uint32_t ht1080zGetClockMultiplier(void) { return htClockMultiplier; }
void ht1080zSetTargetClockMultiplier(uint32_t value) { htTargetClockMultiplier = value > 0u ? value : 1u; }

// -----------------------------------------------------------------------------
// CPU
// -----------------------------------------------------------------------------

uint32_t ht1080zGetCpuOpCode(void) { return cpu.opCode; }
uint32_t ht1080zGetOpStartAddress(void) { return htOpStartAddress; }

// -----------------------------------------------------------------------------
// Breakpoint conditions: the shared evaluator, reading memory through the map without side effects
// -----------------------------------------------------------------------------

#define COND_PEEK(address) ((uint32_t)htPeekMemory((uint16_t)((address) & 0xffffu)))
#include "../../../../z80/wasm/z80-condition.c"

// -----------------------------------------------------------------------------
// Execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3): the shared recorder, with this
// machine's side-effect-free peek, its frame position in T-states and its context. There is no
// banking. The context:
//   0    bits 0-1 the model (0 Series I, 1 Series II, 2 the /64), bit 4 48K of RAM (else 16K)
// -----------------------------------------------------------------------------

static inline void htHistoryContext(uint32_t kind, uint8_t *out) {
  (void)kind;
  out[0] = (uint8_t)(htModel | (htRamSizeKb == 48u ? 0x10u : 0u));
  for (uint32_t i = 1u; i < 16u; i++) out[i] = 0u;
}

#define Z80_HISTORY_CAPACITY 65536u
#define Z80_HISTORY_PEEK(address) htPeekMemory((uint16_t)((address) & 0xffffu))
#define Z80_HISTORY_CONTEXT(kind, out16) htHistoryContext(kind, out16)
#define Z80_HISTORY_FRAME() htFrames
#define Z80_HISTORY_FRAME_TACT() htFrameTacts
#include "../../../../z80/wasm/z80-history.c"

// -----------------------------------------------------------------------------
// The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2): a byte's profile offset is
// its address. The ROMs (0000-37FF) and the video RAM and RAM (3C00 up to the model's RAM end) are
// backed; the keyboard (3800-3BFF) and the empty space above a 16K machine's RAM are not, and a
// write to ROM reaches nothing.
// -----------------------------------------------------------------------------

static inline int32_t htProfilePhys(uint32_t address, uint32_t write) {
  const uint32_t a = address & 0xffffu;
  if (a < HT_KEYBOARD_START) return write != 0u ? -1 : (int32_t)a;
  if (a < HT_VIDEO_RAM_START || a >= htRamEnd) return -1;
  return (int32_t)a;
}

#define Z80_PROFILE_FLAG_BYTES 0x10000u
#define Z80_PROFILE_POOL_PAGES 8u
#define Z80_PROFILE_PHYS_READ(address) htProfilePhys((uint32_t)(address), 0u)
#define Z80_PROFILE_PHYS_WRITE(address) htProfilePhys((uint32_t)(address), 1u)
#define Z80_PROFILE_FRAME_TICKS() cpu.tacts
#include "../../../../z80/wasm/z80-profile.c"
