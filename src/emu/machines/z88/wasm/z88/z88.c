/*
 * Cambridge Z88 - the full-machine WASM core.
 *
 * One translation unit: the machine state below, the Z88 parts it includes, and the shared Z80 core
 * (`src/emu/z80/wasm/z80.c`) wired to them through the `Z80_*` hook macros. No heap; every buffer
 * is a static array exposed through a pointer export. See
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md` for the architecture and the step this file is at.
 *
 * Status (Step 10, 2026-09-19): the memory map and the RAM/ROM cards (Step 4), the CPU and the frame
 * loop (Step 5), the Blink - ports, RTC, interrupts, flap, battery (Step 6) - the keyboard and sleep
 * detection (Step 7), the LCD (Step 8), the beeper (Step 9) and the EPROM and flash cards (Step 10)
 * are emulated.
 *
 * Every name is prefixed `z88`: `z80.c` defines register macros (`A`, `F`, `HL`, `IX`, ...) and
 * fixed `z80*` names, so bare Blink register names (`COM`, `INT`, `STA`) must never be used.
 */
#include <stdint.h>

// -----------------------------------------------------------------------------
// Machine constants
// -----------------------------------------------------------------------------

/* 4 MB of physical memory: slot N (0-3) starts at N * 1 MB; internal RAM at $080000 */
#define Z88_MEMORY_SIZE 0x400000u
#define Z88_INTERNAL_RAM_START 0x080000u
#define Z88_INTERNAL_RAM_END 0x100000u

/*
 * The LCD: 640 pixels wide, 8, 32, 40 or 60 text rows of 8 pixel lines (64, 256, 320 or 480 lines).
 * SCW reads $FF on the Z88's own 640x64 LCD (the register is not implemented there) and 80 (640 / 8)
 * on the larger ones, as OZvm reports them; OZ takes both as 640 pixels.
 */
#define Z88_LCD_WIDTH_MAX 640u
#define Z88_LCD_LINES_MAX 480u
#define Z88_PIXEL_BUFFER_WORDS (Z88_LCD_WIDTH_MAX * Z88_LCD_LINES_MAX)
#define Z88_SCW_640 0xffu
#define Z88_SCW_640_COLUMNS 80u
#define Z88_SCH_DEFAULT 8u

/* 3.2768 MHz; a frame is 5 ms (one RTC tick) */
#define Z88_BASE_CLOCK_FREQUENCY 3276800u
#define Z88_TACTS_IN_FRAME 16384u

/* Stereo samples (doubles) of one frame; 5 ms at 192 kHz is 960 samples */
#define Z88_AUDIO_SAMPLE_CAPACITY 2048u

#define Z88_KEYBOARD_LINES 8u

/* The linear memory the build script reserves (Z88_WASM_MEMORY_BYTES in build-z88-wasm.cjs) */
#define Z88_WASM_LINEAR_MEMORY (28u * 1024u * 1024u)
/* The execution-history ring: 65,536 records of 64 bytes (EXECUTION_HISTORY_ALL_CORES_PLAN D2) */
#define Z88_WASM_HISTORY_RING (65536u * 64u)
/*
 * The access profile (CODE_COVERAGE_AND_HEAT_MAP_PLAN D2, D5): a flag byte per physical byte (4 MB),
 * its page map (a uint16 per 8K page) and the counter pool - Z88_PROFILE_POOL_PAGES 8K pages of
 * 24-byte entries (12 MB). Defined at the end of this file with the module.
 */
#define Z88_PROFILE_POOL_PAGES 64u
#define Z88_WASM_PROFILE (Z88_MEMORY_SIZE + (Z88_MEMORY_SIZE / 0x2000u) * 2u + Z88_PROFILE_POOL_PAGES * 0x2000u * 24u)
/* Headroom for the stack, the CPU state and the machine's small variables */
#define Z88_WASM_RESERVED (512u * 1024u)

_Static_assert(
  Z88_MEMORY_SIZE + Z88_PIXEL_BUFFER_WORDS * 4u + Z88_AUDIO_SAMPLE_CAPACITY * 16u + 0x20000u + Z88_WASM_HISTORY_RING +
      Z88_WASM_PROFILE + Z88_WASM_RESERVED <=
    Z88_WASM_LINEAR_MEMORY,
  "The Z88 buffers no longer fit the WASM linear memory; raise Z88_WASM_MEMORY_BYTES with a reason");

// -----------------------------------------------------------------------------
// Machine state
// -----------------------------------------------------------------------------

static uint8_t z88Memory[Z88_MEMORY_SIZE];
static uint32_t z88PixelBuffer[Z88_PIXEL_BUFFER_WORDS];
static uint8_t z88KeyboardLines[Z88_KEYBOARD_LINES];

/* The keyboard's flags (`Z88KeyboardDevice`: isKeyPressed, the shifts) and the sleep detection */
static uint8_t z88KeyPressed;
static uint8_t z88ShiftLeftDown;
static uint8_t z88ShiftRightDown;
static uint8_t z88ShiftsReleased;
static uint8_t z88SleepMode;

/* Frame accounting, as `Z80Cpu.tactPlusN` keeps it */
static uint32_t z88Frames;
static uint32_t z88FrameTacts;
static uint32_t z88TactsInCurrentFrame = Z88_TACTS_IN_FRAME;
static uint32_t z88ClockMultiplier = 1u;
static uint32_t z88TargetClockMultiplier = 1u;
static uint8_t z88FrameCompleted = 1u;

/* LCD size registers (SCW, SCH), as the Z88ScreenDevice sets them from MC_SCREEN_SIZE */
static uint32_t z88Scw = Z88_SCW_640;
static uint32_t z88Sch = Z88_SCH_DEFAULT;
uint32_t z88GetScreenWidth(void);
uint32_t z88GetScreenHeight(void);

// -----------------------------------------------------------------------------
// The shared Z80 core, wired to the Z88
// -----------------------------------------------------------------------------

static uint32_t z88CpuReadMemory(uint32_t address);
static void z88CpuWriteMemory(uint32_t address, uint32_t value);
#if defined(__clang__) || defined(__GNUC__)
#define Z88_CPU_NOINLINE __attribute__((noinline))
#else
#define Z88_CPU_NOINLINE
#endif

/* Not inlined: the hook runs the audio sampler, and inlining it into every opcode triples the code */
static void Z88_CPU_NOINLINE z88CpuTactPlusN(uint32_t value);
static uint8_t *z88CpuMemoryPtr(void);
static uint32_t z88CpuReadPort(uint32_t address);
static void z88CpuWritePort(uint32_t address, uint32_t value);
static void z88PokeMemory(uint32_t address, uint32_t value);
static uint8_t z88FetchCodeByte(uint16_t address);
static inline void z88BusNewInstruction(void);

#define Z80_EXTERNAL_BUS 1
/* The Z88's Z80 is a CMOS part: no LD A,I / LD A,R interrupt glitch (see `Z80_CMOS` in z80.c) */
#define Z80_CMOS 1
#define Z80_MEMORY_PTR() z88CpuMemoryPtr()
#define Z80_READ_MEMORY(address) z88CpuReadMemory((uint32_t)(address))
#define Z80_WRITE_MEMORY(address, value) z88CpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_POKE_MEMORY(address, value) z88PokeMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_READ_PORT(address) z88CpuReadPort((uint32_t)(address))
#define Z80_WRITE_PORT(address, value) z88CpuWritePort((uint32_t)(address), (uint32_t)(value))
/* The Z88 records the bus itself (z88-memory.c); the shared core's single port event is not used */
#define Z80_CAPTURE_BUS_EVENTS() 0
#define Z80_BEFORE_OPCODE_FETCH() z88BusNewInstruction()
/* Operand bytes are read as `Z80Cpu.fetchCodeByte` reads them: timed, but not recorded */
#define Z80_FETCH_CODE_BYTE(address) z88FetchCodeByte((uint16_t)(address))
#define Z80_TACT_PLUS_N(value) z88CpuTactPlusN((uint32_t)(value))
/* The execution-history recorder's hooks; the recorder and this machine's macros for it are at the
   end of this file (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` Phase 4) */
#include "../../../../z80/wasm/z80-history.h"
/* The access profile's hooks; the module and this machine's mapping for it are at the end of this
   file (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D1, D4) */
#include "../../../../z80/wasm/z80-profile.h"
#include "../../../../z80/wasm/z80.c"

// -----------------------------------------------------------------------------
// Z88 parts
// -----------------------------------------------------------------------------

#include "z88-memory.c"
#include "z88-blink.c"
#include "z88-cards.c"
#include "z88-keyboard.c"
#include "z88-screen.c"
#include "z88-beeper.c"

/*
 * Every CPU clock step: the tact counter and the frame accounting of `Z80Cpu.tactPlusN` - a frame
 * completes the moment its last tact passes, in the middle of an instruction if so - then the beeper's
 * sample (`onTactIncremented`).
 */
static void Z88_CPU_NOINLINE z88CpuTactPlusN(uint32_t value) {
  cpu.tacts += value;
  z88FrameTacts += value;
  if (z88FrameTacts >= z88TactsInCurrentFrame) {
    z88Frames++;
    z88FrameTacts -= z88TactsInCurrentFrame;
    z88FrameCompleted = 1u;
  }
  z88SetNextAudioSample();
}

static uint8_t *z88CpuMemoryPtr(void) {
  return z88Memory;
}

// -----------------------------------------------------------------------------
// The frame loop (`MachineFrameRunner` with `Z88Machine`'s hooks)
// -----------------------------------------------------------------------------

/*
 * A new frame: the clock multiplier takes effect, then `Z88Machine.onInitNewFrame` in its order - the
 * RTC tick, the KWAIT wake-up, the LCD, the sleep check, and the beeper's new frame (which the
 * TypeScript machine skips when the sleep check ends sleep mode).
 */
static void z88BeginFrame(void) {
  if (z88ClockMultiplier != z88TargetClockMultiplier) {
    z88ClockMultiplier = z88TargetClockMultiplier;
    z88TactsInCurrentFrame = Z88_TACTS_IN_FRAME * z88ClockMultiplier;
  }
  z88BlinkIncrementRtc();
  if (z88KeyPressed && (z88Int & Z88_INT_KWAIT)) {
    z80AwakeCpu();
  }
  z88RenderScreen();
  if (!z88CheckSleepMode()) {
    z88BeeperNewFrame();
  }
  z88FrameCompleted = 0u;
}

/*
 * One instruction, as the frame runner executes one: a new frame first if the last one completed;
 * the Blink's interrupt line to the CPU; the CPU cycles until the instruction is complete (or one
 * 16-tact pause while snoozed); then `afterInstructionExecuted` - a key down wakes the CPU, and the
 * beeper's oscillator bit is computed.
 * Returns whether the frame completed.
 */
uint32_t z88ExecuteInstruction(void) {
  if (z88FrameCompleted) {
    z88BeginFrame();
  }
  z80SetSigInt(z88InterruptSignal);
  do {
    if (z80IsCpuSnoozed()) {
      /* The snooze is no instruction's time: the profile keeps it in its own bucket (D7). The pause
         falls between instructions (only a completed IN from $B2 snoozes), so nothing is open. */
      const uint32_t before = cpu.tacts;
      z80SnoozeCycle();
      if (z80ProfileHeader.enabled) z80ProfileChargeBucket(Z80_PROFILE_BUCKET_SNOOZE, cpu.tacts - before);
    } else {
      z80ExecuteCpuCycle();
    }
  } while (z80GetPrefix() != PREFIX_NONE);
  if (z88KeyPressed) {
    z80AwakeCpu();
  }
  z88CalculateOscillatorBit();
  return z88FrameCompleted;
}

/*
 * The debugger's per-address breakpoint flags (`DebugSupport.breakpointFlags`), copied in by the host
 * when a debug run starts. The core does not interpret them beyond the mask it is given.
 */
static uint16_t z88BreakpointFlags[0x10000];

uint32_t z88BreakpointFlagsPtr(void) { return (uint32_t)(uintptr_t)z88BreakpointFlags; }

/*
 * The debugger's fast path: runs instructions until the frame completes or the PC reaches a place the
 * stop policy may stop at - an address whose flags meet `mask`, or `extraStop` (a run-to point, a
 * step-over or step-out target; any value above $FFFF means none). Returns how many instructions ran.
 * The host then applies the whole stop policy at that PC, exactly as after a single instruction, so a
 * candidate that is not a stop (a disabled breakpoint, another partition) only costs a boundary call.
 */
uint32_t z88ExecuteUntilStop(uint32_t extraStop, uint32_t mask) {
  uint32_t executed = 0u;
  do {
    z88ExecuteInstruction();
    executed++;
    /* A reverse-debugging stop target (REVERSE_DEBUGGING_PLAN D4): the host asks the recorder after the call */
    if (z80HistoryStopNow() != 0u) break;
    const uint16_t pc = (uint16_t)z80GetPc();
    if ((z88BreakpointFlags[pc] & mask) || pc == extraStop) break;
  } while (!z88FrameCompleted);
  return executed;
}

/*
 * Runs until the current frame completes (a frame stopped midway is finished; a completed one
 * starts the next). The bus is recorded here too, so the CPU panel of a paused machine shows what
 * the TypeScript one does.
 */
uint32_t z88ExecuteFrame(void) {
  do {
    z88ExecuteInstruction();
    /*
     * A reverse-debugging stop target (REVERSE_DEBUGGING_PLAN D4), checked on the frame's last
     * instruction too. A frame left mid-way goes on at the next call: an instruction begins a new
     * frame only after the last one completed, which is the frame-in-progress rule (T17).
     */
    if (z80HistoryStopNow() != 0u) break;
  } while (!z88FrameCompleted);
  return 0u;
}

// -----------------------------------------------------------------------------
// Buffers
// -----------------------------------------------------------------------------

uint32_t z88MemoryPtr(void) { return (uint32_t)(uintptr_t)z88Memory; }
uint32_t z88GetMemorySize(void) { return Z88_MEMORY_SIZE; }
uint32_t z88PixelBufferPtr(void) { return (uint32_t)(uintptr_t)z88PixelBuffer; }
uint32_t z88GetPixelBufferCapacity(void) { return Z88_PIXEL_BUFFER_WORDS; }
uint32_t z88KeyboardLinesPtr(void) { return (uint32_t)(uintptr_t)z88KeyboardLines; }

// -----------------------------------------------------------------------------
// LCD shape
// -----------------------------------------------------------------------------

/*
 * Sets the LCD size registers from `MC_SCREEN_SIZE`: SCW is $FF or 80 (640 pixels); SCH is 8, 32, 40
 * or 60 text rows - the sizes OZvm's `BlinkLcd` accepts. Anything else selects the 640x64 default.
 */
void z88SetLcdSize(uint32_t scw, uint32_t sch) {
  const uint8_t widthOk = scw == Z88_SCW_640 || scw == Z88_SCW_640_COLUMNS;
  const uint8_t heightOk = sch == 8u || sch == 32u || sch == 40u || sch == 60u;
  z88Scw = widthOk && heightOk ? scw : Z88_SCW_640;
  z88Sch = widthOk && heightOk ? sch : Z88_SCH_DEFAULT;
}

uint32_t z88GetScw(void) { return z88Scw; }
uint32_t z88GetSch(void) { return z88Sch; }
uint32_t z88GetScreenWidth(void) { return 640u; }
uint32_t z88GetScreenHeight(void) { return z88Sch * 8u; }

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

/*
 * What both resets restart: the frame counters, the key lines, the sleep state, the LCD's flash state
 * and pixels, and the beeper. Memory is kept, and so are the speaker's ear bit and oscillator bit and
 * the keyboard's pressed/shift flags (the TypeScript devices kept them too). The host sets the audio
 * sample rate again. The next instruction starts a new frame.
 */
static void z88ResetMachine(void) {
  z88Frames = 0u;
  z88FrameTacts = 0u;
  z88FrameCompleted = 1u;
  z88ClockMultiplier = z88TargetClockMultiplier;
  z88TactsInCurrentFrame = Z88_TACTS_IN_FRAME * z88ClockMultiplier;
  for (uint32_t i = 0u; i < Z88_KEYBOARD_LINES; i++) z88KeyboardLines[i] = 0u;
  z88ShiftsReleased = 0u;
  z88SleepMode = 0u;
  z88ScreenReset();
  for (uint32_t i = 0u; i < Z88_PIXEL_BUFFER_WORDS; i++) z88PixelBuffer[i] = 0u;
  z88BeeperReset();
  for (uint32_t i = 0u; i < Z88_AUDIO_SAMPLE_CAPACITY * 2u; i++) z88AudioSamples[i] = 0.0;
}

/*
 * The reset button (OZvm's `pressResetButton`): the CPU only - with the reset-button reset
 * (`z80SoftReset`: BC, DE, HL, their alternates, IX and IY keep their values). The Blink keeps COM,
 * SR0-SR3, the interrupt registers, the clock and the LCD pointers, so OZ's time of day survives it.
 */
void z88Reset(void) {
  z80SoftReset();
  z88BusReset();
  z88ResetMachine();
}

/*
 * Power on (OZvm's `hardReset`): every RAM cleared - the internal RAM ($080000-$0FFFFF) and every RAM
 * card in slots 1-3 - the Blink in its power-on state, and every CPU register (`z80Reset`). ROM,
 * EPROM and flash keep their bytes: the host leaves a card that stays in its slot alone.
 */
void z88HardReset(void) {
  for (uint32_t i = Z88_INTERNAL_RAM_START; i < Z88_INTERNAL_RAM_END; i++) z88Memory[i] = 0u;
  for (uint32_t slot = 1u; slot < 4u; slot++) {
    if (z88Cards[slot].kind == Z88_CARD_RAM) z88CardFill(slot, 0x00u);
  }
  z80Reset();
  z88BusReset();
  z88BlinkPowerOn();
  z88ResetMachine();
}

// -----------------------------------------------------------------------------
// Timing
// -----------------------------------------------------------------------------

uint32_t z88GetBaseClockFrequency(void) { return Z88_BASE_CLOCK_FREQUENCY; }
uint32_t z88GetTactsInFrame(void) { return Z88_TACTS_IN_FRAME; }
uint32_t z88GetTactsInCurrentFrame(void) { return z88TactsInCurrentFrame; }
uint32_t z88GetFrames(void) { return z88Frames; }
uint32_t z88GetFrameTacts(void) { return z88FrameTacts; }
uint32_t z88GetFrameCompleted(void) { return z88FrameCompleted; }
uint32_t z88GetTacts(void) { return cpu.tacts; }
/* Sets the absolute tact counter only (`Z80Cpu.setTacts`): the frame accounting is not touched */
void z88SetTacts(uint32_t value) { cpu.tacts = value; }
uint32_t z88GetClockMultiplier(void) { return z88ClockMultiplier; }
void z88SetTargetClockMultiplier(uint32_t value) { z88TargetClockMultiplier = value > 0u ? value : 1u; }

// -----------------------------------------------------------------------------
// CPU
// -----------------------------------------------------------------------------

uint32_t z88GetCpuAf(void) { return z80GetAf(); }
void z88SetCpuAf(uint32_t v) { z80SetAf(v); }
uint32_t z88GetCpuBc(void) { return z80GetBc(); }
void z88SetCpuBc(uint32_t v) { z80SetBc(v); }
uint32_t z88GetCpuDe(void) { return z80GetDe(); }
void z88SetCpuDe(uint32_t v) { z80SetDe(v); }
uint32_t z88GetCpuHl(void) { return z80GetHl(); }
void z88SetCpuHl(uint32_t v) { z80SetHl(v); }
uint32_t z88GetCpuAfAlt(void) { return z80GetAfAlt(); }
void z88SetCpuAfAlt(uint32_t v) { z80SetAfAlt(v); }
uint32_t z88GetCpuBcAlt(void) { return z80GetBcAlt(); }
void z88SetCpuBcAlt(uint32_t v) { z80SetBcAlt(v); }
uint32_t z88GetCpuDeAlt(void) { return z80GetDeAlt(); }
void z88SetCpuDeAlt(uint32_t v) { z80SetDeAlt(v); }
uint32_t z88GetCpuHlAlt(void) { return z80GetHlAlt(); }
void z88SetCpuHlAlt(uint32_t v) { z80SetHlAlt(v); }
uint32_t z88GetCpuIx(void) { return z80GetIx(); }
void z88SetCpuIx(uint32_t v) { z80SetIx(v); }
uint32_t z88GetCpuIy(void) { return z80GetIy(); }
void z88SetCpuIy(uint32_t v) { z80SetIy(v); }
uint32_t z88GetCpuIr(void) { return z80GetIr(); }
void z88SetCpuIr(uint32_t v) { z80SetIr(v); }
uint32_t z88GetCpuWz(void) { return z80GetWz(); }
void z88SetCpuWz(uint32_t v) { z80SetWz(v); }
uint32_t z88GetCpuPc(void) { return z80GetPc(); }
void z88SetCpuPc(uint32_t v) { z80SetPc(v); }
uint32_t z88GetCpuSp(void) { return z80GetSp(); }
void z88SetCpuSp(uint32_t v) { z80SetSp(v); }
uint32_t z88GetCpuIff1(void) { return z80GetIff1(); }
void z88SetCpuIff1(uint32_t v) { z80SetIff1(v); }
uint32_t z88GetCpuIff2(void) { return z80GetIff2(); }
void z88SetCpuIff2(uint32_t v) { z80SetIff2(v); }
uint32_t z88GetCpuInterruptMode(void) { return z80GetInterruptMode(); }
void z88SetCpuInterruptMode(uint32_t v) { z80SetInterruptMode(v); }
uint32_t z88GetCpuHalted(void) { return z80GetHalted(); }
uint32_t z88GetCpuPrefix(void) { return z80GetPrefix(); }
uint32_t z88GetCpuSnoozed(void) { return z80IsCpuSnoozed(); }
void z88SetCpuSnoozed(uint32_t v) {
  if (v) {
    z80SnoozeCpu();
  } else {
    z80AwakeCpu();
  }
}
uint32_t z88GetStepOutAddress(void) { return z80GetStepOutAddress(); }
/* --- Running interrupt handlers (z80.c): source stepping runs them outside the step */
uint32_t z88GetInterruptDepth(void) { return z80GetInterruptDepth(); }
/* The INT line the CPU saw at the start of the last instruction (`Z80Cpu.sigINT`) */
uint32_t z88GetCpuSigInt(void) { return z80GetSigInt(); }

// -----------------------------------------------------------------------------
// Breakpoint conditions (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`): the shared evaluator, with
// this machine's side-effect-free reads. `z88MemoryPeek` reads through the paging with no timing, no
// bus event, no flash command abort and no empty-slot generator step. A partition is a 16K bank as `getMemoryPartition` in `Z88WasmV2Machine.ts` reads it
// (`z88BankStorageOffset`: a small card is mirrored across its slot). `page()` stays "no value", as
// the machine's `getPartition` does not report the Z88's paging yet.
// -----------------------------------------------------------------------------

static uint32_t condZ88PeekPartition(int32_t partition, uint32_t address) {
  const uint32_t b = (uint32_t)partition & 0xffu;
  const uint32_t mask = b >= 0x20u && b <= 0x3fu ? z88GetSlotChipMask(4u) : z88GetSlotChipMask(b >> 6);
  const uint32_t base = b < 0x40u ? (b & 0xe0u) : (b & 0xc0u);
  const uint32_t offset = (base | (b & mask & 0x3fu)) * 0x4000u;
  return z88Memory[(offset + address % 0x4000u) % Z88_MEMORY_SIZE];
}

#define COND_PEEK(address) ((uint32_t)z88MemoryPeek((uint16_t)((address) & 0xffffu)))
#define COND_PEEK_PARTITION(partition, address) condZ88PeekPartition(partition, address)
#include "../../../../z80/wasm/z80-condition.c"

// -----------------------------------------------------------------------------
// Execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3, Phase 4): the shared recorder,
// with this machine's side-effect-free peek (`z88MemoryPeek`), its frame position in T-states and
// its context. `z88ExecuteUntilStop` loops the CPU in C, so the debugger's fast path records too
// (D9). A snoozed CPU runs `z80SnoozeCycle`, not a CPU cycle, and a CPU in coma runs nothing: both
// leave a gap in the history, which the frame numbers show (trap T8).
//
// The context (`z88Context.ts` decodes it):
//   0-3  SR0-SR3, the segment registers
//   4-11 the bank behind each 8K page (`z88PageBank`), which covers the split segment 0
//   12   COM.RAMS (bit 2): bank $20 rather than $00 at $0000-$1FFF
// The Z88's `getPartition` names no partition yet (the breakpoint conditions' `page()` says the same),
// so its decoder names none either (D4).
// -----------------------------------------------------------------------------

static inline void z88HistoryContext(uint32_t kind, uint8_t *out) {
  (void)kind;
  for (uint32_t i = 0u; i < 4u; i++) out[i] = z88Sr[i];
  for (uint32_t i = 0u; i < 8u; i++) out[4u + i] = z88PageBank[i];
  out[12] = (uint8_t)(z88Com & Z88_COM_RAMS);
  out[13] = 0u;
  out[14] = 0u;
  out[15] = 0u;
}

#define Z80_HISTORY_CAPACITY 65536u
#define Z80_HISTORY_PEEK(address) z88MemoryPeek((uint16_t)((address) & 0xffffu))
#define Z80_HISTORY_CONTEXT(kind, out16) z88HistoryContext(kind, out16)
#define Z80_HISTORY_FRAME() z88Frames
#define Z80_HISTORY_FRAME_TACT() z88FrameTacts
#include "../../../../z80/wasm/z80-history.c"

// -----------------------------------------------------------------------------
// The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2, D4): the shared module, with
// this machine's physical layout. Time is in CPU T-states (D8); the snooze goes to its own bucket
// (`z88ExecuteInstruction`, D7), and a CPU in coma is HALTed, so its time is the HALT's.
//
// The profile offset is the offset in `z88Memory` (slot N at N * 1 MB, internal RAM at $080000), as
// each 8K page's `z88PageOffset` names it. That offset already carries a small card's mirroring and
// the half of SR0's bank that segment 0's upper page shows, so a byte is flagged once, at its
// storage, whichever mirror the CPU reached it through (`src/common/profile/layouts/z88.ts`).
//
// Nothing backs a page with no card: its reads are the Blink's random values and its writes are
// dropped, so both map nowhere. A write reaches memory only on RAM, or on an EPROM or flash card
// whose chip is about to program this byte (`z88CardWriteProgramsByte`); a ROM ignores it, and a
// flash chip's command cycles are not stores (trap T2). A read of a flash chip in a command state
// answers its status, not the array, but it is still that card's byte the CPU addressed, so it maps.
// -----------------------------------------------------------------------------

static inline int32_t z88ProfilePhys(uint32_t address, uint32_t write) {
  const uint32_t page = (address & 0xffffu) >> 13;
  const uint8_t card = z88PageCard[page];
  if (card == Z88_PAGE_NO_CARD) return -1;
  if (write != 0u && z88Cards[card].kind != Z88_CARD_RAM && !z88CardWriteProgramsByte(card, z88PageBank[page])) {
    return -1;
  }
  return (int32_t)(z88PageOffset[page] + (address & 0x1fffu));
}

#define Z80_PROFILE_FLAG_BYTES Z88_MEMORY_SIZE
#define Z80_PROFILE_POOL_PAGES Z88_PROFILE_POOL_PAGES
#define Z80_PROFILE_PHYS_READ(address) z88ProfilePhys((uint32_t)(address), 0u)
#define Z80_PROFILE_PHYS_WRITE(address) z88ProfilePhys((uint32_t)(address), 1u)
#define Z80_PROFILE_FRAME_TICKS() cpu.tacts
#include "../../../../z80/wasm/z80-profile.c"
