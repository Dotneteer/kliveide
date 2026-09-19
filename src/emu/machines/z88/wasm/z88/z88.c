/*
 * Cambridge Z88 - the full-machine WASM core.
 *
 * One translation unit: the machine state below, the Z88 parts it includes, and the shared Z80 core
 * (`src/emu/z80/wasm/z80.c`) wired to them through the `Z80_*` hook macros. No heap; every buffer
 * is a static array exposed through a pointer export. See
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md` for the architecture and the step this file is at.
 *
 * Status (Step 1, 2026-09-19): scaffolding. The buffers, the reset, the LCD shape and the CPU
 * register getters exist. The memory map (Step 4), the frame loop (Step 5), the Blink (Step 6),
 * the keyboard (Step 7), the LCD renderer (Step 8), the beeper (Step 9) and the cards (Step 10) do
 * not. Nothing here emulates a Z88 yet.
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

/* Stereo int16 samples of one frame; 5 ms at 192 kHz is 960 samples */
#define Z88_AUDIO_SAMPLE_CAPACITY 2048u

#define Z88_KEYBOARD_LINES 8u

/* The linear memory the build script reserves (Z88_WASM_MEMORY_BYTES in build-z88-wasm.cjs) */
#define Z88_WASM_LINEAR_MEMORY (8u * 1024u * 1024u)
/* Headroom for the stack, the CPU state and the machine's small variables */
#define Z88_WASM_RESERVED (512u * 1024u)

_Static_assert(
  Z88_MEMORY_SIZE + Z88_PIXEL_BUFFER_WORDS * 4u + Z88_AUDIO_SAMPLE_CAPACITY * 4u + Z88_WASM_RESERVED <=
    Z88_WASM_LINEAR_MEMORY,
  "The Z88 buffers no longer fit the WASM linear memory; raise Z88_WASM_MEMORY_BYTES with a reason");

// -----------------------------------------------------------------------------
// Machine state
// -----------------------------------------------------------------------------

static uint8_t z88Memory[Z88_MEMORY_SIZE];
static uint32_t z88PixelBuffer[Z88_PIXEL_BUFFER_WORDS];
static int16_t z88AudioSamples[Z88_AUDIO_SAMPLE_CAPACITY * 2u];
static uint8_t z88KeyboardLines[Z88_KEYBOARD_LINES];

static uint32_t z88Tacts;
static uint32_t z88Frames;

/* LCD size registers (SCW, SCH), as the Z88ScreenDevice sets them from MC_SCREEN_SIZE */
static uint32_t z88Scw = Z88_SCW_640;
static uint32_t z88Sch = Z88_SCH_DEFAULT;

// -----------------------------------------------------------------------------
// Z88 parts
// -----------------------------------------------------------------------------

#include "z88-memory.c"

// -----------------------------------------------------------------------------
// The shared Z80 core, wired to the Z88
// -----------------------------------------------------------------------------

static void z88CpuTactPlusN(uint32_t value);
static uint8_t *z88CpuMemoryPtr(void);
static uint32_t z88CpuReadPort(uint32_t address);
static void z88CpuWritePort(uint32_t address, uint32_t value);

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() z88CpuMemoryPtr()
#define Z80_READ_MEMORY(address) z88CpuReadMemory((uint32_t)(address))
#define Z80_WRITE_MEMORY(address, value) z88CpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_POKE_MEMORY(address, value) z88CpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_READ_PORT(address) z88CpuReadPort((uint32_t)(address))
#define Z80_WRITE_PORT(address, value) z88CpuWritePort((uint32_t)(address), (uint32_t)(value))
#define Z80_TACT_PLUS_N(value) z88CpuTactPlusN((uint32_t)(value))
#include "../../../../z80/wasm/z80.c"

static void z88CpuTactPlusN(uint32_t value) {
  cpu.tacts += value;
  z88Tacts += value;
}

static uint8_t *z88CpuMemoryPtr(void) {
  return z88Memory;
}

/* Step 6 replaces these with the Blink's port decoding */
static uint32_t z88CpuReadPort(uint32_t address) {
  (void)address;
  return 0xffu;
}

static void z88CpuWritePort(uint32_t address, uint32_t value) {
  (void)address;
  (void)value;
}

// -----------------------------------------------------------------------------
// Buffers
// -----------------------------------------------------------------------------

uint32_t z88MemoryPtr(void) { return (uint32_t)(uintptr_t)z88Memory; }
uint32_t z88GetMemorySize(void) { return Z88_MEMORY_SIZE; }
uint32_t z88PixelBufferPtr(void) { return (uint32_t)(uintptr_t)z88PixelBuffer; }
uint32_t z88GetPixelBufferCapacity(void) { return Z88_PIXEL_BUFFER_WORDS; }
uint32_t z88AudioSamplesPtr(void) { return (uint32_t)(uintptr_t)z88AudioSamples; }
uint32_t z88GetAudioSampleCapacity(void) { return Z88_AUDIO_SAMPLE_CAPACITY; }
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

/* The reset button: the CPU and the machine counters; memory is kept */
void z88Reset(void) {
  z80Reset();
  z88Tacts = 0u;
  z88Frames = 0u;
  for (uint32_t i = 0u; i < Z88_KEYBOARD_LINES; i++) z88KeyboardLines[i] = 0u;
  for (uint32_t i = 0u; i < Z88_PIXEL_BUFFER_WORDS; i++) z88PixelBuffer[i] = 0u;
  for (uint32_t i = 0u; i < Z88_AUDIO_SAMPLE_CAPACITY * 2u; i++) z88AudioSamples[i] = 0;
}

/* Power on: everything, including the 4 MB of memory */
void z88HardReset(void) {
  for (uint32_t i = 0u; i < Z88_MEMORY_SIZE; i++) z88Memory[i] = 0u;
  z88Reset();
}

// -----------------------------------------------------------------------------
// Timing
// -----------------------------------------------------------------------------

uint32_t z88GetBaseClockFrequency(void) { return Z88_BASE_CLOCK_FREQUENCY; }
uint32_t z88GetTactsInFrame(void) { return Z88_TACTS_IN_FRAME; }
uint32_t z88GetFrames(void) { return z88Frames; }
uint32_t z88GetTacts(void) { return z88Tacts; }

// -----------------------------------------------------------------------------
// CPU registers
// -----------------------------------------------------------------------------

uint32_t z88GetCpuAf(void) { return z80GetAf(); }
uint32_t z88GetCpuBc(void) { return z80GetBc(); }
uint32_t z88GetCpuDe(void) { return z80GetDe(); }
uint32_t z88GetCpuHl(void) { return z80GetHl(); }
uint32_t z88GetCpuPc(void) { return z80GetPc(); }
uint32_t z88GetCpuSp(void) { return z80GetSp(); }
