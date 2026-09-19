/*
 * Cambridge Z88 - the full-machine WASM core.
 *
 * One translation unit: the machine state below, the Z88 parts it includes, and the shared Z80 core
 * (`src/emu/z80/wasm/z80.c`) wired to them through the `Z80_*` hook macros. No heap; every buffer
 * is a static array exposed through a pointer export. See
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md` for the architecture and the step this file is at.
 *
 * Status (Step 9, 2026-09-19): the memory map and the RAM/ROM cards (Step 4), the CPU and the frame
 * loop (Step 5), the Blink - ports, RTC, interrupts, flap, battery (Step 6) - the keyboard and sleep
 * detection (Step 7), the LCD (Step 8) and the beeper (Step 9) are emulated. EPROM/flash programming
 * (Step 10) is not.
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

/* The LCD: 640 or 800 pixels wide, up to 60 text rows of 8 pixel lines */
#define Z88_LCD_WIDTH_MAX 800u
#define Z88_LCD_LINES_MAX 480u
#define Z88_PIXEL_BUFFER_WORDS (Z88_LCD_WIDTH_MAX * Z88_LCD_LINES_MAX)
#define Z88_SCW_640 0xffu
#define Z88_SCW_MAX 100u
#define Z88_SCH_DEFAULT 8u
#define Z88_SCH_MAX 60u

/* 3.2768 MHz; a frame is 5 ms (one RTC tick) */
#define Z88_BASE_CLOCK_FREQUENCY 3276800u
#define Z88_TACTS_IN_FRAME 16384u

/* Stereo samples (doubles) of one frame; 5 ms at 192 kHz is 960 samples */
#define Z88_AUDIO_SAMPLE_CAPACITY 2048u

#define Z88_KEYBOARD_LINES 8u

/* The linear memory the build script reserves (Z88_WASM_MEMORY_BYTES in build-z88-wasm.cjs) */
#define Z88_WASM_LINEAR_MEMORY (8u * 1024u * 1024u)
/* Headroom for the stack, the CPU state and the machine's small variables */
#define Z88_WASM_RESERVED (512u * 1024u)

_Static_assert(
  Z88_MEMORY_SIZE + Z88_PIXEL_BUFFER_WORDS * 4u + Z88_AUDIO_SAMPLE_CAPACITY * 16u + Z88_WASM_RESERVED <=
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
static uint32_t z88BlinkReadPort(uint32_t address);
static void z88BlinkWritePort(uint32_t address, uint32_t value);
static uint8_t z88CaptureBusEvents;

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() z88CpuMemoryPtr()
#define Z80_READ_MEMORY(address) z88CpuReadMemory((uint32_t)(address))
#define Z80_WRITE_MEMORY(address, value) z88CpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_POKE_MEMORY(address, value) z88CpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_READ_PORT(address) z88BlinkReadPort((uint32_t)(address))
#define Z80_WRITE_PORT(address, value) z88BlinkWritePort((uint32_t)(address), (uint32_t)(value))
#define Z80_CAPTURE_BUS_EVENTS() z88CaptureBusEvents
#define Z80_TACT_PLUS_N(value) z88CpuTactPlusN((uint32_t)(value))
#include "../../../../z80/wasm/z80.c"

// -----------------------------------------------------------------------------
// Z88 parts
// -----------------------------------------------------------------------------

#include "z88-memory.c"
#include "z88-blink.c"
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
  if (z88CaptureBusEvents) {
    z88HasMemoryEvent = 0u;
    z80ClearBusEvents();
  }
  z80SetSigInt(z88InterruptSignal);
  do {
    if (z80IsCpuSnoozed()) {
      z80SnoozeCycle();
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
 * Runs until the current frame completes (a frame stopped midway is finished; a completed one
 * starts the next). Bus events are not recorded: only the debugger's instruction loop reads them.
 */
uint32_t z88ExecuteFrame(void) {
  z88CaptureBusEvents = 0u;
  z88HasMemoryEvent = 0u;
  z80ClearBusEvents();
  do {
    z88ExecuteInstruction();
  } while (!z88FrameCompleted);
  z88CaptureBusEvents = 1u;
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
 * Sets the LCD size registers, as `Z88ScreenDevice.reset()` does from `MC_SCREEN_SIZE`: SCW is $FF
 * for 640 pixels or the width in 8-pixel columns (up to 100: 800 pixels); SCH is the number of text
 * rows (8 to 60). Out-of-range values select the 640x64 default.
 */
void z88SetLcdSize(uint32_t scw, uint32_t sch) {
  const uint8_t widthOk = scw == Z88_SCW_640 || (scw > 0u && scw <= Z88_SCW_MAX);
  const uint8_t heightOk = sch > 0u && sch <= Z88_SCH_MAX;
  z88Scw = widthOk && heightOk ? scw : Z88_SCW_640;
  z88Sch = widthOk && heightOk ? sch : Z88_SCH_DEFAULT;
}

uint32_t z88GetScw(void) { return z88Scw; }
uint32_t z88GetSch(void) { return z88Sch; }
uint32_t z88GetScreenWidth(void) { return z88Scw == Z88_SCW_640 ? 640u : z88Scw * 8u; }
uint32_t z88GetScreenHeight(void) { return z88Sch * 8u; }

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

/*
 * The machine reset, in `Z88Machine.reset()`'s order: the frame counters, the Blink (which pages
 * SR0-SR3 to bank 0), the key lines, the LCD, the beeper, the sleep state. Memory is kept, and so are
 * the speaker's ear bit and oscillator bit and the keyboard's pressed/shift flags (the TypeScript
 * devices keep them too). The host sets the audio sample rate again. The next instruction starts a
 * new frame.
 */
static void z88ResetMachine(void) {
  z88Frames = 0u;
  z88FrameTacts = 0u;
  z88FrameCompleted = 1u;
  z88ClockMultiplier = z88TargetClockMultiplier;
  z88TactsInCurrentFrame = Z88_TACTS_IN_FRAME * z88ClockMultiplier;
  z88BlinkReset();
  for (uint32_t i = 0u; i < Z88_KEYBOARD_LINES; i++) z88KeyboardLines[i] = 0u;
  z88ShiftsReleased = 0u;
  z88SleepMode = 0u;
  for (uint32_t i = 0u; i < 4u; i++) z88Pb[i] = 0u;
  z88Sbr = 0u;
  z88ScreenReset();
  for (uint32_t i = 0u; i < Z88_PIXEL_BUFFER_WORDS; i++) z88PixelBuffer[i] = 0u;
  z88BeeperReset();
  for (uint32_t i = 0u; i < Z88_AUDIO_SAMPLE_CAPACITY * 2u; i++) z88AudioSamples[i] = 0.0;
}

/*
 * The reset button. The CPU gets the reset-button reset (`Z80Cpu.reset`, `z80SoftReset`): BC, DE, HL,
 * their alternates, IX and IY keep their values.
 */
void z88Reset(void) {
  z80SoftReset();
  z88ResetMachine();
}

/*
 * Power on: every CPU register (`Z80Cpu.hardReset`, `z80Reset`), the machine reset, and the internal
 * RAM ($080000-$0FFFFF) cleared - exactly what `Z88BankedMemory.resetInternalRam()` clears. The cards
 * keep their contents (a flash card's data survives a power cycle); the host re-inserts them after a
 * hard reset, as `Z88Machine.setup()` does.
 */
void z88HardReset(void) {
  for (uint32_t i = Z88_INTERNAL_RAM_START; i < Z88_INTERNAL_RAM_END; i++) z88Memory[i] = 0u;
  z80Reset();
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
uint32_t z88GetLastPortAddress(void) { return z80GetLastPortAddress(); }
uint32_t z88GetLastPortValue(void) { return z80GetLastPortValue(); }
uint32_t z88GetLastPortIsWrite(void) { return z80GetLastPortIsWrite(); }
