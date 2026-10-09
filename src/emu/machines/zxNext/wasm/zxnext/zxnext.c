#include <stdint.h>

#define ZXNEXT_MEMORY_SIZE (2048 * 1024 + 0x2000)
#define ZXNEXT_FLAT_MEMORY_SIZE 0x10000
#define ZXNEXT_SCREEN_WIDTH 720
#define ZXNEXT_SCREEN_HEIGHT 288
#define ZXNEXT_PIXEL_COUNT (ZXNEXT_SCREEN_WIDTH * ZXNEXT_SCREEN_HEIGHT)
#define ZXNEXT_KEYBOARD_LINE_COUNT 8
#define ZXNEXT_NEXT_REG_COUNT 256
/*
 * The raster of the current frame (zxula_timing.vhd, NextComposedScreenDevice's TimingConfig):
 * line and frame length, the beam position of buffer pixel (0, 0), the display origin and the ULA
 * interrupt window, in HC units. zxnextTimingSelect (zxnext-nextreg.c) sets them at every frame start
 * from NextReg $03 display timing; the defaults are the +3 raster.
 */
static uint32_t zxnextTimingTotalHc = 456u;
static uint32_t zxnextTimingTotalVc = 311u;
static uint32_t zxnextTimingFirstVc = 16u;
static uint32_t zxnextTimingFirstHc = 96u;
static uint32_t zxnextTimingDisplayXStart = 144u;
static uint32_t zxnextTimingDisplayYStart = 64u;
static uint32_t zxnextTimingIntStart = 0x252u;
/* INT pulse length in CPU cycles (zxnext.vhd ~1968-1990): 32 for 48K and +3, 36 for 128K and Pentagon */
static uint32_t zxnextTimingIntPulseCycles = 32u;
/* The memory contention pattern of the raster (NextComposedScreenDevice.contentionTiming): 0 none, 1 48K, 2 128K, 3 +3 */
static uint32_t zxnextTimingContention = 3u;
#define ZXNEXT_RENDERING_TACTS_IN_FRAME (zxnextTimingTotalHc * zxnextTimingTotalVc)
#define ZXNEXT_TACTS_IN_FRAME (ZXNEXT_RENDERING_TACTS_IN_FRAME * 4)

#define ZXNEXT_DIAGNOSTIC_IMPLEMENTATION_INCOMPLETE 1

static uint8_t zxnextMemory[ZXNEXT_MEMORY_SIZE];
static uint32_t zxnextPixelBuffer[ZXNEXT_PIXEL_COUNT];
static uint8_t zxnextKeyboardLines[ZXNEXT_KEYBOARD_LINE_COUNT];
static uint8_t zxnextNextRegs[ZXNEXT_NEXT_REG_COUNT];
/* The last value the CPU wrote to each NextReg ($253B or NEXTREG), for the IDE; never cleared, like the TypeScript core's */
static uint8_t zxnextNextRegLastWrite[ZXNEXT_NEXT_REG_COUNT];
static uint8_t zxnextNextRegWritten[ZXNEXT_NEXT_REG_COUNT];

/*
 * The NextReg write-breakpoint watch table, pushed whole from the host, and the latch a watched
 * write leaves behind. See `.plans/NEXTREG_WRITE_BREAKPOINTS_PLAN.md` §4.2.
 *
 * The core does the matching rather than mirroring every write out for the host to test, because a
 * single instruction can write NextRegs many times - `OTIR` to `$253B` is the palette-upload idiom -
 * and the host's bus mirror holds only one access per instruction. Modelled on the Z88 core's
 * `z88BreakpointFlags`, the one other in-core breakpoint table.
 *
 * One two-dimensional array rather than three separate ones: the host pushes the whole thing in a
 * single `.set()`, and separate statics have no guaranteed relative layout. Row 0 is the per-register
 * flag byte, row 1 the value to match, row 2 the mask.
 *
 * A zero mask matches any value. That is also how the host collapses two breakpoints watching one
 * register with different filters: the core over-approximates and `DebugSupport.hasNextRegWrite`
 * makes the exact decision, exactly as `PART_BP` defers a partitioned execution breakpoint.
 */
#define ZXNEXT_NEXTREG_WATCH_FLAGS 0
#define ZXNEXT_NEXTREG_WATCH_VALUE 1
#define ZXNEXT_NEXTREG_WATCH_MASK 2
#define ZXNEXT_NEXTREG_WATCH_CPU 0x01u
#define ZXNEXT_NEXTREG_WATCH_COPPER 0x02u
static uint8_t zxnextNextRegWatch[3][ZXNEXT_NEXT_REG_COUNT];

/*
 * Who is performing the write in progress, so the one hook in `zxnextNextRegSetDirect` can tell a
 * CPU write from a Copper one without a second hook site.
 *
 * `NONE` covers the reset branches and the IDE's own hotkeys (`zxnextSetNextRegisterDirect`), which
 * are deliberately never reported: a soft reset writes a dozen registers, and a register changing
 * because the user pressed a key is not a program event worth stopping for.
 */
#define ZXNEXT_NEXTREG_ORIGIN_NONE 0u
#define ZXNEXT_NEXTREG_ORIGIN_CPU 1u
#define ZXNEXT_NEXTREG_ORIGIN_COPPER 2u
static uint8_t zxnextNextRegWriteOrigin;

/*
 * The first watched write since the host last took one, with the register's previous value.
 *
 * "First", not "last": a block write that hits two watched registers reports the earlier one, the
 * host stops after that instruction, and the second is reported on the next run. Latching the last
 * instead would lose the write the user was actually waiting for.
 */
static uint8_t zxnextNextRegHit;
static uint8_t zxnextNextRegHitReg;
static uint8_t zxnextNextRegHitOld;
static uint8_t zxnextNextRegHitNew;
static uint8_t zxnextNextRegHitOrigin;

/*
 * The Copper-instruction breakpoint watch and its hit latch. See `.plans/COPPER_DEBUGGING_PLAN.md`
 * §4.6.
 *
 * One bit per Copper list index, pushed whole by the host. `zxnextCopperWatchArmed` guards the hot
 * path (trap T3): the Copper tests the table only at instruction boundaries, and only when armed.
 * `zxnextCopperWatchAny` makes every index match; the IDE's "Step Copper" arms it as a one-shot.
 *
 * The latch keeps the *first* hit since the host last took one (trap T2) together with the beam
 * position it happened at, because the Copper keeps running to the end of the Z80 instruction and
 * may be well past the hit when the machine stops (trap T1).
 */
static uint8_t zxnextCopperWatch[128];
static uint8_t zxnextCopperWatchArmed;
static uint8_t zxnextCopperWatchAny;
static uint32_t zxnextCopperHit;

/*
 * The sprite-attribute breakpoint watch and its hit latch (G3.8, sprite half; see
 * `.plans/SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md`).
 *
 * One byte per sprite, pushed whole by the host: bits 0-4 select which of the five attribute bytes
 * are watched, and 0 means the sprite is not watched. `zxnextSpriteWatchArmed` keeps the attribute
 * write paths free when no `sp:` breakpoint exists. The latch keeps the *first* hit since the host
 * last took one, like the NextReg and Copper latches: a DMA burst or an OTIR that writes many
 * watched bytes reports the earliest, and the next is reported on the next run.
 *
 * `zxnextSpriteWriteFromDma` labels a port $57 write the DMA performs, so the hit can say who wrote.
 */
#define ZXNEXT_SPRITE_ORIGIN_PORT_CPU 1u
#define ZXNEXT_SPRITE_ORIGIN_PORT_DMA 2u
#define ZXNEXT_SPRITE_ORIGIN_NEXTREG_CPU 3u
#define ZXNEXT_SPRITE_ORIGIN_NEXTREG_COPPER 4u
static uint8_t zxnextSpriteWatch[128];
static uint8_t zxnextSpriteWatchArmed;
static uint32_t zxnextSpriteHit;
static uint8_t zxnextSpriteWriteFromDma;

static uint16_t cpuAf;
static uint16_t cpuBc;
static uint16_t cpuDe;
static uint16_t cpuHl;
static uint16_t cpuAfAlt;
static uint16_t cpuBcAlt;
static uint16_t cpuDeAlt;
static uint16_t cpuHlAlt;
static uint16_t cpuIx;
static uint16_t cpuIy;
static uint16_t cpuIr;
static uint16_t cpuWz;
static uint16_t cpuPc;
static uint16_t cpuSp;
static uint8_t cpuIff1;
static uint8_t cpuIff2;
static uint8_t cpuInterruptMode;
static uint8_t cpuHalted;
static uint8_t cpuPrefix;

static uint32_t frames;
static uint32_t tacts;
static uint32_t frameTacts28;
/*
 * The access profile's clock (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D8): 28 MHz ticks, like
 * `frameTacts28`, but never wrapped at a frame end, so a 32-bit difference is a duration even across
 * a frame boundary or a speed change. Advanced wherever `frameTacts28` is advanced by time passing
 * (CPU cycles and DMA holds), never by the frame-position setters. Volatile, like the profile itself.
 */
static uint32_t zxnextProfileTicks28;
static uint32_t currentFrameTact;
static uint8_t frameCompleted;
static uint32_t totalContentionDelaySinceStart;
static uint32_t contentionDelaySincePause;
static uint8_t cpuProgrammedSpeed;
static uint8_t cpuEffectiveSpeed;
static uint32_t cpuTactScale;

/*
 * The INT pulse length in HC ticks. zxnext.vhd ~1968-2000 counts the pulse on the CPU clock, so it lasts
 * 2 ticks per cycle at 3.5 MHz and halves with every speed step (8 ticks for 32 cycles at 28 MHz).
 */
static inline uint32_t zxnextTimingIntPulseLength(void) {
  return (zxnextTimingIntPulseCycles * 2u) >> (cpuEffectiveSpeed & 0x03u);
}
/* 1 while the CPU's data accesses go to the access log (z80.c): off in a fast frame unless tracing */
static uint8_t zxnextCaptureBusEvents = 1u;
static uint32_t zxnextTraceEnabled; /* defined in zxnext-trace.c */
static uint16_t lastPortAddress;
static uint8_t lastPortValue;
static uint8_t lastPortAccessed;
static uint8_t lastPortIsWrite;
static uint8_t nextRegIndex;
static uint8_t portFeValue;
static uint8_t portTimexValue;
/* NextReg $02 bit 0 / bit 1 (zxnext.vhd ~6316-6317): 1 = soft, 2 = hard reset requested. The frame
   loop stops, and the TypeScript wrapper performs the reset (a hard reset reloads the ROMs there). */
static uint8_t zxnextResetRequest;
/* $02 bits 1-0: 1 after a hard reset (the firmware's soft reset after a core load), else soft. */
static uint8_t zxnextLastResetWasHard;
static uint8_t borderColor;
static uint8_t earBit;
static uint8_t micBit;

#include "zxnext-beeper.h"
#include "zxnext-frame.c"
#include "zxnext-debug.c"
#include "zxnext-memory.c"
#include "zxnext-divmmc.c"
#include "zxnext-sd.c"
#include "zxnext-diagnostics.c"
#include "zxnext-nmi.c"
#include "zxnext-interrupts.c"
#include "zxnext-keyboard.c"
#include "zxnext-tape.c"
#include "zxnext-ula.c"
#include "zxnext-palette.c"
#include "zxnext-layer2.c"
#include "zxnext-tilemap.c"
#include "zxnext-sprites.c"
#include "zxnext-copper.c"
#include "zxnext-beeper.c"
#include "zxnext-dac.c"
#include "zxnext-psg.c"
#include "zxnext-audio-mixer.c"
#include "zxnext-ctc.c"
#include "zxnext-clock28.c"
#include "zxnext-uart.c"
#include "zxnext-i2c.c"
#include "zxnext-input.c"
#include "zxnext-expansion.c"
#include "zxnext-dma.c"
#include "zxnext-nextreg.c"
#include "zxnext-ports.c"
#include "zxnext-multiface.c"
#include "zxnext-cpu.c"
#include "zxnext-trace.c"

uint32_t zxnextMemoryPtr(void) { return (uint32_t)(uintptr_t)zxnextMemory; }
uint32_t zxnextPixelBufferPtr(void) { return (uint32_t)(uintptr_t)zxnextPixelBuffer; }
uint32_t zxnextKeyboardLinesPtr(void) { return (uint32_t)(uintptr_t)zxnextKeyboardLines; }
uint32_t zxnextNextRegsPtr(void) { return (uint32_t)(uintptr_t)zxnextNextRegs; }

static void clearMachineBuffers(void) {
  for (uint32_t i = 0; i < ZXNEXT_MEMORY_SIZE; i++) zxnextMemory[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_PIXEL_COUNT; i++) zxnextPixelBuffer[i] = 0x00000000u;
  zxnextKeyboardReset();
  zxnextDivMmcReset();
  zxnextSdReset();
  zxnextPaletteHardReset();
  zxnextLayer2Reset();
  zxnextTilemapReset();
  zxnextSpritesReset();
  zxnextCopperHardReset();
  zxnextRasterReset();
  zxnextBeeperReset();
  zxnextDacReset();
  zxnextPsgReset();
  zxnextAudioMixerReset();
  zxnextCtcReset();
  zxnextUartHardReset(); /* a hard reset reloads the FPGA core */
  zxnextI2cReset();
  zxnextInputReset();
  zxnextJoystickHardReset(); /* a core load initialises the key-joystick map */
  zxnextMouseHardReset(); /* the power-on m_reset */
  zxnextExpansionHardReset();
  zxnextDmaReset();
  zxnextNextRegHardReset();
}

void zxnextReset(void) {
  /* NextReg $06 bits 4-3 live in the DivMMC module, which zxnextDivMmcReset clears */
  uint32_t keptNr06 = zxnextNextRegGetDirect(0x06u);
  cpuAf = 0;
  cpuBc = 0;
  cpuDe = 0;
  cpuHl = 0;
  cpuAfAlt = 0;
  cpuBcAlt = 0;
  cpuDeAlt = 0;
  cpuHlAlt = 0;
  cpuIx = 0;
  cpuIy = 0;
  cpuIr = 0;
  cpuWz = 0;
  cpuPc = 0;
  cpuSp = 0xffff;
  cpuIff1 = 0;
  cpuIff2 = 0;
  cpuInterruptMode = 0;
  cpuHalted = 0;
  cpuPrefix = 0;
  zxnextFrameReset();
  zxnextDebugReset();
  zxnextTraceReset();
  zxnextCpuReset();
  zxnextNmiReset();
  zxnextMultifaceReset();
  zxnextInterruptsReset();
  zxnextTapeReset();
  zxnextDivMmcReset();
  zxnextSdReset();
  zxnextPaletteReset();
  zxnextLayer2Reset();
  zxnextTilemapReset();
  zxnextSpritesReset();
  zxnextCopperReset();
  zxnextRasterReset();
  zxnextBeeperReset();
  zxnextDacReset();
  zxnextPsgReset();
  zxnextAudioMixerReset();
  zxnextCtcReset();
  zxnextUartReset();
  zxnextI2cReset();
  zxnextInputReset();
  zxnextExpansionReset();
  zxnextDmaReset();
  zxnextNextRegSoftReset(keptNr06);
  zxnextPsgMode = (uint8_t)(keptNr06 & 0x03u); /* $06 is not in the reset branch */
  lastPortAddress = 0;
  lastPortValue = 0;
  lastPortAccessed = 0;
  lastPortIsWrite = 0;
  zxnextPortsReset();
}

void zxnextHardReset(void) {
  zxnextReset();
  clearMachineBuffers();
  zxnextDivMmcSetEnableMultifaceNmiByM1Button(1);
  zxnextDivMmcSetEnableNmiByDriveButton(1);
}

uint32_t zxnextExecuteFrame(void) {
  return zxnextFrameExecute();
}

uint32_t zxnextExecuteInstruction(void) {
  return zxnextCpuExecuteInstruction();
}

/*
 * The debugger's breakpoint flags and in-core loop, `zxnextExecuteUntilStop` (z80-debug-loop.c). It
 * returns where the fast frame loop does too: an SD command waiting for the host, a reset request.
 */
/* The Next's own port record (zxnext-ports.c, which the DMA's port writes also reach) is what its I/O
   breakpoints read; memory accesses are the shared Z80's log */
static uint32_t zxnextDebugAccessHit(uint32_t accessMask);
#define Z80_DEBUG_LOOP_ACCESS_HIT(accessMask) zxnextDebugAccessHit(accessMask)
#define Z80_DEBUG_LOOP_PREFIX zxnext
#define Z80_DEBUG_LOOP_FRAME_COMPLETED frameCompleted
#define Z80_DEBUG_LOOP_STOP() \
  (zxnextSdGetHostCommand() != ZXNEXT_SD_HOST_COMMAND_NONE || zxnextResetRequest != 0u)
#include "../../../../z80/wasm/z80-debug-loop.c"

/* The access-breakpoint test of the last instruction: the shared log's memory accesses, the Next's port record */
static uint32_t zxnextDebugAccessHit(uint32_t accessMask) {
  const uint16_t *flags = zxnextBreakpointFlags;
  const uint32_t count = z80AccessLogCount < Z80_ACCESS_LOG_CAPACITY ? z80AccessLogCount : Z80_ACCESS_LOG_CAPACITY;
  for (uint32_t i = 0u; i < count; i++) {
    const uint32_t entry = z80AccessLog[i];
    const uint32_t bit = (entry & Z80_ACCESS_LOG_WRITE) != 0u ? Z80_DEBUG_FLAG_MEM_WRITE : Z80_DEBUG_FLAG_MEM_READ;
    if ((flags[entry & 0xffffu] & bit & accessMask) != 0u) return 1u;
  }
  if (lastPortAccessed) {
    const uint32_t bit = lastPortIsWrite ? Z80_DEBUG_FLAG_IO_WRITE : Z80_DEBUG_FLAG_IO_READ;
    if ((flags[lastPortAddress] & bit & accessMask) != 0u) return 1u;
  }
  return 0u;
}

uint32_t zxnextRenderInstantScreen(void) {
  /* The paused view shows the current state: pending ULA latches included, without applying them */
  uint8_t shown[ZXNEXT_ULA_LATCH_COUNT];
  for (uint32_t i = 0; i < ZXNEXT_ULA_LATCH_COUNT; i++) {
    shown[i] = ulaShown[i];
    if (ulaLatchPending[i]) ulaShown[i] = ulaLatchValue[i];
  }
  uint32_t result = zxnextUlaRenderInstantScreen();
  for (uint32_t i = 0; i < ZXNEXT_ULA_LATCH_COUNT; i++) ulaShown[i] = shown[i];
  return result;
}

uint32_t zxnextReadMemory(uint32_t address) {
  return zxnextMemoryReadMapped(address);
}

void zxnextWriteMemory(uint32_t address, uint32_t value) {
  zxnextMemoryWriteMapped(address, value);
}

uint32_t zxnextReadScreenMemoryOffset(uint32_t offset) {
  return zxnextMemoryReadScreenOffset(offset);
}

uint32_t zxnextGetMemoryPageReadOffset(uint32_t page) {
  return zxnextMemoryGetPageReadOffset(page);
}

/* The paging ports as stored (the Next Memory Mapping panel) */
uint32_t zxnextGetMemoryPort7ffd(void) { return memPort7ffd; }
uint32_t zxnextGetMemoryPortDffd(void) { return memPortDffd; }
uint32_t zxnextGetMemoryPort1ffd(void) { return memPort1ffd; }
uint32_t zxnextGetMemoryPortEff7(void) { return memPortEff7; }

uint32_t zxnextGetMemoryPageWriteOffset(uint32_t page) {
  return zxnextMemoryGetPageWriteOffset(page);
}

uint32_t zxnextGetMemoryPageBank16(uint32_t page) {
  return zxnextMemoryGetPageBank16(page);
}

uint32_t zxnextGetMemoryPageBank8(uint32_t page) {
  return zxnextMemoryGetPageBank8(page);
}

uint32_t zxnextGetMemorySelectedRomPage(void) {
  return zxnextMemoryGetSelectedRomPage();
}

uint32_t zxnextGetMemorySelectedRamBank(void) {
  return zxnextMemoryGetSelectedRamBank();
}

void zxnextSetKeyStatus(uint32_t key, uint32_t isDown) { zxnextKeyboardSetKeyStatus(key, isDown); }

uint32_t zxnextGetKeyboardLine(uint32_t line) { return zxnextKeyboardGetLine(line); }

uint32_t zxnextReadPort(uint32_t address) {
  return zxnextPortsRead(address);
}

void zxnextWritePort(uint32_t address, uint32_t value) {
  zxnextPortsWrite(address, value);
}

uint32_t zxnextGetMemorySize(void) { return ZXNEXT_MEMORY_SIZE; }
uint32_t zxnextGetFlatMemorySize(void) { return ZXNEXT_FLAT_MEMORY_SIZE; }
uint32_t zxnextGetKeyboardLineCount(void) { return ZXNEXT_KEYBOARD_LINE_COUNT; }
uint32_t zxnextGetNextRegCount(void) { return ZXNEXT_NEXT_REG_COUNT; }
uint32_t zxnextGetScreenWidth(void) { return ZXNEXT_SCREEN_WIDTH; }
uint32_t zxnextGetScreenHeight(void) { return ZXNEXT_SCREEN_HEIGHT; }
uint32_t zxnextGetPixelBufferStartOffset(void) { return 0; }
uint32_t zxnextGetFrames(void) { return frames; }
uint32_t zxnextGetTacts(void) { return tacts; }
uint32_t zxnextGetCurrentFrameTact(void) { return currentFrameTact; }
uint32_t zxnextGetTactsInFrame(void) { return ZXNEXT_TACTS_IN_FRAME; }
/* The raster of the frame in progress: HCs per line (7 MHz) and lines (zxula_timing.vhd c_max_hc/vc + 1) */
uint32_t zxnextGetTimingTotalHc(void) { return zxnextTimingTotalHc; }
/* The INT line the CPU sampled before its last instruction (the CPU panel's INT) */
uint32_t zxnextGetCpuSigInt(void) { return z80GetSigInt(); }
uint32_t zxnextGetCpuHeldByDma(void) { return zxnextCpuHeldAtFrameEnd; }
uint32_t zxnextGetTimingTotalVc(void) { return zxnextTimingTotalVc; }
/* The contention the CPU has been held for, in CPU tacts: since the machine started / since the counter's last restart */
uint32_t zxnextGetTotalContentionDelaySinceStart(void) { return totalContentionDelaySinceStart; }
uint32_t zxnextGetContentionDelaySincePause(void) { return contentionDelaySincePause; }
uint32_t zxnextGetFrameCompleted(void) { return frameCompleted; }

void zxnextSetSignalNmi(uint32_t active) { zxnextNmiSetSignal(active); }
uint32_t zxnextGetSignalNmi(void) { return zxnextNmiGetSignal(); }
void zxnextSetNmiCause(uint32_t cause) { zxnextNmiSetCause(cause); }
uint32_t zxnextGetNmiCause(void) { return zxnextNmiGetCause(); }
uint32_t zxnextGetNmiReturnAddress(void) { return zxnextNmiGetReturnAddress(); }
uint32_t zxnextGetStacklessNmiProcessed(void) { return zxnextNmiGetStacklessProcessed(); }
void zxnextSetSignalInt(uint32_t active) { zxnextInterruptsSetSignalInt(active); }
uint32_t zxnextGetSignalInt(void) { return zxnextInterruptsGetSignalInt(); }
uint32_t zxnextGetLastInterruptVector(void) { return zxnextInterruptsGetLastVector(); }
void zxnextSetDaisyStatus(uint32_t index, uint32_t active) { zxnextInterruptsSetDaisyStatus(index, active); }
void zxnextSetDaisyEnabled(uint32_t index, uint32_t active) { zxnextInterruptsSetDaisyEnabled(index, active); }
uint32_t zxnextGetDaisyInService(uint32_t index) { return zxnextInterruptsGetDaisyInService(index); }

void zxnextSetTacts(uint32_t value) {
  tacts = value;
  frameTacts28 = (value * (8u >> cpuEffectiveSpeed)) % zxnextGetTactsInFrame();
  currentFrameTact = frameTacts28 >> 2;
  z80SetTacts(value);
  zxnextBeeperResyncWindow(value);
}

uint32_t zxnextGetSharedZ80NMode(void) { return z80GetZ80NMode(); }

/* The last port access: the Next's own record (zxnext-ports.c), not the shared core's */
uint32_t zxnextGetLastPortAddress(void) { return lastPortAddress; }
uint32_t zxnextGetLastPortValue(void) { return lastPortValue; }
uint32_t zxnextGetLastPortAccessed(void) { return lastPortAccessed; }
uint32_t zxnextGetLastPortIsWrite(void) { return lastPortIsWrite; }

uint32_t zxnextTraceGetStartOffset(void) { return zxnextTraceGetStartOffsetImpl(); }
uint32_t zxnextTraceGetHeaderSize(void) { return zxnextTraceGetHeaderSizeImpl(); }
uint32_t zxnextTraceGetRecordSize(void) { return zxnextTraceGetRecordSizeImpl(); }
uint32_t zxnextTraceGetCapacity(void) { return zxnextTraceGetCapacityImpl(); }
uint32_t zxnextTraceGetCount(void) { return zxnextTraceGetCountImpl(); }
uint32_t zxnextTraceGetOverflow(void) { return zxnextTraceGetOverflowImpl(); }
void zxnextTraceClear(uint32_t frameIndex) { zxnextTraceClearImpl(frameIndex); }
void zxnextTraceSetEnabled(uint32_t enabled) { zxnextTraceSetEnabledImpl(enabled); }
void zxnextTraceFinishFrame(void) { zxnextTraceFinishFrameImpl(); }

void zxnextSetNextRegisterIndex(uint32_t reg) { zxnextNextRegSetIndex(reg); }
uint32_t zxnextGetNextRegisterIndex(void) { return zxnextNextRegGetIndex(); }
void zxnextSetNextRegisterValue(uint32_t value) { zxnextNextRegSetValue(value); }
void zxnextWriteNextRegister(uint32_t reg, uint32_t value) { zxnextNextRegCpuWrite(reg & 0xffu, value & 0xffu); }
/* The IDE's Next Registers panel: the value the CPU last wrote, or 0x100 when it never wrote one */
uint32_t zxnextGetNextRegisterLastWrite(uint32_t reg) {
  return zxnextNextRegWritten[reg & 0xffu] ? zxnextNextRegLastWrite[reg & 0xffu] : 0x100u;
}
/* The M1 (Multiface) and DRIVE (DivMMC) NMI buttons - the F9/F10 menu commands. */
void zxnextPressMultifaceNmiButton(void) { zxnextNmiRequestMultiface(); }
void zxnextPressDivMmcNmiButton(void) { zxnextNmiRequestDivMmc(); }
/* Whether a NextReg $02 reset is pending, without taking it: the debug loop asks after every
   instruction, and only a pending request is worth a journaled take (REVERSE_DEBUGGING_PLAN D7) */
uint32_t zxnextGetResetRequest(void) { return zxnextResetRequest; }
uint32_t zxnextTakeResetRequest(void) {
  uint32_t request = zxnextResetRequest;
  zxnextResetRequest = 0u;
  return request;
}
uint32_t zxnextGetNextRegisterValue(void) { return zxnextNextRegGetValue(); }
uint32_t zxnextGetNextRegisterDirect(uint32_t reg) { return zxnextNextRegGetDirect(reg); }
/* The IDE's Next Registers panel: a `$253B` read of `reg`, leaving the `$243B` selection alone */
uint32_t zxnextPeekNextRegister(uint32_t reg) { return zxnextNextRegPeek(reg & 0xffu); }
void zxnextSetNextRegisterDirect(uint32_t reg, uint32_t value) { zxnextNextRegSetDirect(reg, value); }

/*
 * The NextReg write-breakpoint watch table and its latch. See §4.2 of the plan.
 *
 * The host owns the table: it pushes all three rows in one `.set()` when it enters the debug loop
 * with a NextReg breakpoint armed, and calls `zxnextClearNextRegWatch` when it enters with none -
 * without that second call a table left over from a deleted breakpoint would keep stopping the
 * machine.
 */
uint32_t zxnextNextRegWatchPtr(void) { return (uint32_t)(uintptr_t)zxnextNextRegWatch; }

void zxnextClearNextRegWatch(void) {
  for (uint32_t row = 0; row < 3u; row++) {
    for (uint32_t i = 0; i < ZXNEXT_NEXT_REG_COUNT; i++) zxnextNextRegWatch[row][i] = 0u;
  }
  zxnextNextRegHit = 0u;
}

/*
 * Take the latched hit, if there is one, and clear it.
 *
 * Packed into one word so the debug loop pays a single boundary crossing per instruction rather
 * than five: bit 31 says a hit is present, bits 24-25 the origin (1 CPU, 2 Copper), bits 16-23 the
 * value written, bits 8-15 the value the register held before, bits 0-7 the register.
 *
 * Returning 0 for "nothing" is unambiguous because the presence bit is what is tested - a genuine
 * hit on register $00 writing $00 from the CPU still has bit 31 set.
 */
uint32_t zxnextTakeNextRegHit(void) {
  if (!zxnextNextRegHit) return 0u;
  uint32_t packed = 0x80000000u
    | ((uint32_t)zxnextNextRegHitOrigin << 24)
    | ((uint32_t)zxnextNextRegHitNew << 16)
    | ((uint32_t)zxnextNextRegHitOld << 8)
    | (uint32_t)zxnextNextRegHitReg;
  zxnextNextRegHit = 0u;
  return packed;
}

/*
 * The Copper watch table: 128 bytes, one bit per list index (bit `index & 7` of byte `index >> 3`).
 * The host pushes it whole, then arms it with `zxnextSetCopperWatchMode`.
 */
uint32_t zxnextCopperWatchPtr(void) { return (uint32_t)(uintptr_t)zxnextCopperWatch; }

/* Arm (or disarm) the table, and the "any index" mode Step Copper uses. Clears a stale hit. */
void zxnextSetCopperWatchMode(uint32_t armed, uint32_t any) {
  zxnextCopperWatchAny = any ? 1u : 0u;
  zxnextCopperWatchArmed = (armed || any) ? 1u : 0u;
  zxnextCopperHit = 0u;
}

/*
 * Take the latched Copper hit, if there is one, and clear it. Bit 31: present; bits 28-29: kind
 * (1 WAIT, 2 MOVE, 3 NOP); bits 19-27: `hc_ula`; bits 10-18: `cvc`; bits 0-9: the list index.
 */
uint32_t zxnextTakeCopperHit(void) {
  uint32_t hit = zxnextCopperHit;
  zxnextCopperHit = 0u;
  return hit;
}

/*
 * The sprite-attribute watch table: 128 bytes, one per sprite, bits 0-4 the watched attribute bytes.
 * The host pushes it whole, then arms it with `zxnextSetSpriteWatchArmed`.
 */
uint32_t zxnextSpriteWatchPtr(void) { return (uint32_t)(uintptr_t)zxnextSpriteWatch; }

/* Arm (or disarm) the sprite-attribute watch. Clears a stale hit. */
void zxnextSetSpriteWatchArmed(uint32_t armed) {
  zxnextSpriteWatchArmed = armed ? 1u : 0u;
  zxnextSpriteHit = 0u;
}

/*
 * Take the latched sprite-attribute hit, if there is one, and clear it. Bit 31: present; bits 26-28:
 * origin (1 port $57 by the CPU, 2 the DMA - port $57 or a NextReg mirror, 3 a NextReg mirror by the
 * CPU, 4 a NextReg mirror by the Copper); bits 18-25: the value written; bits 10-17: the value the
 * byte held before; bits 7-9: the attribute byte (0-4); bits 0-6: the sprite.
 */
uint32_t zxnextTakeSpriteHit(void) {
  uint32_t hit = zxnextSpriteHit;
  zxnextSpriteHit = 0u;
  return hit;
}

void zxnextDivMmcBeforeFetch(uint32_t pc) { zxnextDivMmcBeforeOpcodeFetch(pc); }
void zxnextDivMmcAfterFetch(uint32_t retnSeen, uint32_t suppressRetn) { zxnextDivMmcAfterOpcodeFetch(retnSeen, suppressRetn); }
void zxnextDivMmcArmNmi(void) { zxnextDivMmcArmNmiButton(); }
uint32_t zxnextGetDivMmcPortE3Value(void) { return zxnextDivMmcGetPortE3(); }
uint32_t zxnextGetDivMmcEnabled(void) { return zxnextDivMmcGetEnabled(); }
uint32_t zxnextGetDivMmcEnableAutomap(void) { return zxnextDivMmcGetEnableAutomap(); }
uint32_t zxnextGetDivMmcConmem(void) { return zxnextDivMmcGetConmem(); }
uint32_t zxnextGetDivMmcMapram(void) { return zxnextDivMmcGetMapram(); }
uint32_t zxnextGetDivMmcBank(void) { return zxnextDivMmcGetBank(); }
uint32_t zxnextGetDivMmcAutoMapActive(void) { return zxnextDivMmcGetAutoMapActive(); }
uint32_t zxnextGetDivMmcRequestAutomapOn(void) { return zxnextDivMmcGetRequestAutomapOn(); }
uint32_t zxnextGetDivMmcRequestAutomapOff(void) { return zxnextDivMmcGetRequestAutomapOff(); }
uint32_t zxnextGetDivMmcNmiHold(void) { return zxnextDivMmcGetNmiHold(); }

void zxnextSetSdCardInfo(uint32_t card, uint32_t totalSectors) { zxnextSdSetCardInfo(card, totalSectors); }
uint32_t zxnextGetSdSelectedCard(void) { return zxnextSdGetSelectedCard(); }
uint32_t zxnextGetSdPortE7Value(void) { return zxnextSdGetPortE7Value(); }
uint32_t zxnextGetSdState(uint32_t card) { return zxnextSdGetState(card); }
uint32_t zxnextGetSdCommandIndex(uint32_t card) { return zxnextSdGetCommandIndex(card); }
uint32_t zxnextGetSdLastCommand(uint32_t card) { return zxnextSdGetLastCommand(card); }
uint32_t zxnextGetSdResponseReady(uint32_t card) { return zxnextSdGetResponseReady(card); }
uint32_t zxnextGetSdResponseIndex(uint32_t card) { return zxnextSdGetResponseIndex(card); }
uint32_t zxnextGetSdHostCommand(void) { return zxnextSdGetHostCommand(); }
uint32_t zxnextGetSdHostSector(void) { return zxnextSdGetHostSector(); }
uint32_t zxnextGetSdHostCard(void) { return zxnextSdGetHostCard(); }
uint32_t zxnextGetSdWriteBufferPtr(void) { return zxnextSdWriteBufferPtr(); }
uint32_t zxnextGetSdWriteBufferLength(void) { return zxnextSdGetWriteBufferLength(); }
void zxnextClearSdHostCommand(void) { zxnextSdClearHostCommand(); }
void zxnextSetSdReadResponse(uint32_t card, uint32_t dataPtr, uint32_t length) { zxnextSdSetReadResponse(card, dataPtr, length); }
void zxnextSetSdWriteResponse(uint32_t card, uint32_t success) { zxnextSdSetWriteResponse(card, success); }

uint32_t zxnextGetPortFeValue(void) { return portFeValue; }
uint32_t zxnextGetBorderColor(void) { return borderColor; }
uint32_t zxnextGetEarBit(void) { return earBit; }
uint32_t zxnextGetMicBit(void) { return micBit; }
uint32_t zxnextGetBeeperLevel(void) { return earBit; }
uint32_t zxnextGetDiagnosticFlags(void) { return zxnextDiagnosticsGetFlags(); }
uint32_t zxnextReadPhysicalMemory(uint32_t offset) { return zxnextDiagnosticsReadPhysical(offset); }
uint32_t zxnextChecksumPhysicalMemory(uint32_t offset, uint32_t length) {
  return zxnextDiagnosticsChecksumPhysical(offset, length);
}
void zxnextSetTapeMode(uint32_t mode) { zxnextTapeSetMode(mode); }
uint32_t zxnextGetTapeMode(void) { return zxnextTapeGetMode(); }
uint32_t zxnextGetTapeEarBit(void) { return zxnextTapeGetEarBit(); }
uint32_t zxnextGetTapeMicBit(void) { return zxnextTapeGetMicBit(); }
void zxnextProcessTapeMicBit(uint32_t value) { zxnextTapeProcessMicBit(value); }
uint32_t zxnextGetUlaFlashCounter(void) { return zxnextUlaGetFlashCounter(); }
uint32_t zxnextGetUlaFlashFlag(void) { return zxnextUlaGetFlashFlag(); }
void zxnextAdvanceUlaFrameState(void) { zxnextUlaOnFrameCompleted(); }
uint32_t zxnextGetUlaScanlineForTact(uint32_t tact) { return zxnextUlaGetScanlineForTact(tact); }
uint32_t zxnextGetUlaColumnForTact(uint32_t tact) { return zxnextUlaGetColumnForTact(tact); }
uint32_t zxnextGetUlaScrollX(void) { return zxnextUlaGetScrollX(); }
uint32_t zxnextGetUlaScrollY(void) { return zxnextUlaGetScrollY(); }
uint32_t zxnextGetUlaClip(uint32_t index) { return zxnextUlaGetClip(index); }

/*
 * Layer debugging (`.plans/LAYER_COMPOSITION_PLAN.md` §4.1-§4.3). None of these changes the machine:
 * the mask acts in the mixer only (D1), and all of the state they touch is volatile (D2, T8).
 */
/* mask: ZXNEXT_LAYER_BIT_* hidden; solo: 0 or one layer bit; flags: bit 0 show transparency */
void zxnextSetLayerDebug(uint32_t mask, uint32_t solo, uint32_t flags) {
  zxnextLayerDebugMask = (uint8_t)(mask & ZXNEXT_LAYER_BITS);
  solo &= ZXNEXT_LAYER_BITS;
  /* solo is one layer: keep the lowest bit */
  zxnextLayerDebugSolo = (uint8_t)(solo & (0u - solo));
  zxnextLayerDebugFlags = (uint8_t)(flags & ZXNEXT_LAYER_DEBUG_SHOW_TRANSPARENT);
}
/* Bits 0-3 mask, 4-7 solo, 8 flags, 9 capture on */
uint32_t zxnextGetLayerDebug(void) {
  return (uint32_t)zxnextLayerDebugMask | ((uint32_t)zxnextLayerDebugSolo << 4u) |
    ((uint32_t)zxnextLayerDebugFlags << 8u) | ((uint32_t)zxnextLayerCaptureOn << 9u);
}
void zxnextSetLayerCapture(uint32_t on) { zxnextLayerSetCapture(on); }
/* Recomposes the paused picture into the preview buffer; ZXNEXT_RECOMPOSE_* status */
uint32_t zxnextRecomposeForDebug(void) { return zxnextLayerRecomposeForDebug(); }
uint32_t zxnextLayerPreviewPtr(void) { return (uint32_t)(uintptr_t)zxnextLayerPreview; }
/* Probes buffer pixel `index`; returns a pointer to the 12-word result (see zxnextLayerProbe) */
uint32_t zxnextProbePixel(uint32_t index) { return zxnextLayerProbePixel(index); }
/* The machine's picture, half width (360 x 288 RGBA, the screen's shape), from the capture with no debug view */
uint32_t zxnextRenderLayerComposite(void) { return zxnextLayerRenderComposite(); }
/*
 * One layer's 16-bit values (0 ULA, 1 tilemap, 2 Layer 2, 3 sprites): the capture while it is on,
 * else the live buffer. ZXNEXT_PIXEL_COUNT words.
 */
uint32_t zxnextLayerBufferPtr(uint32_t layer) {
  uint32_t cap = zxnextLayerCaptureOn;
  switch (layer & 3u) {
    case 0u: return (uint32_t)(uintptr_t)(cap ? zxnextCapUla : zxnextLayerUla);
    case 1u: return (uint32_t)(uintptr_t)(cap ? zxnextCapTm : zxnextLayerTm);
    case 2u: return (uint32_t)(uintptr_t)(cap ? zxnextCapL2 : zxnextLayerL2);
    default: return (uint32_t)(uintptr_t)(cap ? zxnextCapSpr : zxnextLayerSpr);
  }
}
/*
 * The span tables (T7): bits 0-12 this frame's span count, 13 its overflow, 14 complete;
 * bits 16-28 last frame's count, 29 its overflow, 30 complete.
 */
uint32_t zxnextGetLayerCaptureStatus(void) {
  uint32_t c = zxnextCapCurrent, p = c ^ 1u;
  return (zxnextCapSpanCount[c] & 0x1fffu) | ((uint32_t)zxnextCapSpanOverflow[c] << 13u) |
    ((uint32_t)zxnextCapSpanComplete[c] << 14u) | ((zxnextCapSpanCount[p] & 0x1fffu) << 16u) |
    ((uint32_t)zxnextCapSpanOverflow[p] << 29u) | ((uint32_t)zxnextCapSpanComplete[p] << 30u);
}
/* The first buffer pixel of this frame the beam has not drawn yet */
uint32_t zxnextGetRasterPixel(void) { return zxnextRasterPixel; }
/*
 * The beam position overlay (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.2). Neither changes the machine:
 * the info is read from the raster's own counters, and the preview renders into the volatile preview
 * buffer with every rewritten static restored (T2).
 */
/* A pointer to 12 words: vc, hc, totalVc, totalHc, firstVc, firstHc, displayXStart, displayYStart,
   rasterPixel, beamPixel, frameTact, buffer width (zxnextBeamInfo) */
uint32_t zxnextGetBeamInfo(void) { return zxnextBeamGetInfo(); }
/* Renders the paused picture up to the beam into the preview buffer; `keep` 1 draws over the preview
   already there. Returns the beam's buffer pixel. */
uint32_t zxnextRenderPreviewToBeam(uint32_t keep) { return zxnextBeamRenderPreview(keep); }
/* The RGBA the picture uses for a 9-bit colour */
uint32_t zxnextGetRgbaForRgb333(uint32_t rgb333) { return zxnextUlaRgb333Color(rgb333 & 0x1ffu); }

uint32_t zxnextGetPaletteNextReg(uint32_t reg) { return zxnextPaletteGetNextReg(reg); }
uint32_t zxnextGetPaletteEntry(uint32_t palette, uint32_t index) { return zxnextPaletteGetEntry(palette, index); }
uint32_t zxnextGetPaletteCurrentEntry(uint32_t index) { return zxnextPaletteGetCurrentEntry(index); }
uint32_t zxnextGetPaletteIndex(void) { return zxnextPaletteGetPaletteIndex(); }
uint32_t zxnextGetPaletteControl(void) { return zxnextPaletteGetControl(); }
uint32_t zxnextGetPaletteSecondWrite(void) { return zxnextPaletteGetSecondWrite(); }
uint32_t zxnextGetPaletteStoredValue(void) { return zxnextPaletteGetStoredValue(); }
void zxnextSetLayer2Enabled(uint32_t enabled) { zxnextLayer2SetEnabled(enabled); }
uint32_t zxnextGetLayer2Enabled(void) { return zxnextLayer2GetEnabled(); }
uint32_t zxnextGetLayer2Resolution(void) { return zxnextLayer2GetResolution(); }
uint32_t zxnextGetLayer2PaletteOffset(void) { return zxnextLayer2GetPaletteOffset(); }
uint32_t zxnextGetLayer2ScrollX(void) { return zxnextLayer2GetScrollX(); }
uint32_t zxnextGetLayer2ScrollY(void) { return zxnextLayer2GetScrollY(); }
uint32_t zxnextGetLayer2Clip(uint32_t index) { return zxnextLayer2GetClip(index); }
/*
 * The Layer 2 Inspector's reads (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.2). Side-effect free: the port
 * value comes from the module state, never through a port access (D8).
 */
/* $12 */
uint32_t zxnextGetLayer2ActiveBank(void) { return zxnextLayer2GetActiveRamBank(); }
/* $13 */
uint32_t zxnextGetLayer2ShadowBank(void) { return zxnextLayer2GetShadowRamBank(); }
/* What a `$123B` read returns */
uint32_t zxnextGetLayer2Port123BPeek(void) { return zxnextLayer2GetPort123B(); }
/* The bank offset a `$123B` write with bit 4 set stores */
uint32_t zxnextGetLayer2BankOffset(void) { return zxnextLayer2GetBankOffset(); }
/* Which `$18` value the next write sets */
uint32_t zxnextGetLayer2ClipIndex(void) { return zxnextLayer2GetClipIndex(); }
uint32_t zxnextGetLoResEnabled(void) { return zxnextLoResGetEnabled(); }
uint32_t zxnextGetLoResRadastanMode(void) { return zxnextLoResGetRadastanMode(); }
uint32_t zxnextGetLoResPaletteOffset(void) { return zxnextLoResGetPaletteOffset(); }
uint32_t zxnextGetLoResScrollX(void) { return zxnextLoResGetScrollX(); }
uint32_t zxnextGetLoResScrollY(void) { return zxnextLoResGetScrollY(); }
uint32_t zxnextGetLoResStandardAddress(uint32_t x, uint32_t y) { return zxnextLoResStandardAddress(x, y); }
uint32_t zxnextGetLoResRadastanAddress(uint32_t x, uint32_t y, uint32_t dfile) {
  return zxnextLoResRadastanAddress(x, y, dfile);
}
uint32_t zxnextComposeLayer2Sample(uint32_t layer2Rgb, uint32_t layer2Transparent, uint32_t ulaRgb) {
  return zxnextLayer2ComposeSample(layer2Rgb, layer2Transparent, ulaRgb);
}
uint32_t zxnextGetTilemapNextReg(uint32_t reg) {
  uint32_t value = zxnextTilemapGetNextReg(reg);
  return (reg & 0xffu) == 0x6bu ? value | (zxnextPaletteGetSecondTilemap() ? 0x10u : 0u) : value;
}
uint32_t zxnextGetTilemapClip(uint32_t index) { return zxnextTilemapGetClip(index); }
uint32_t zxnextGetTilemapEnabled(void) { return zxnextTilemapGetEnabled(); }
uint32_t zxnextGetTilemapPaletteOffset(void) { return zxnextTilemapGetPaletteOffset(); }
uint32_t zxnextGetTilemapScrollX(void) { return zxnextTilemapGetScrollX(); }
uint32_t zxnextGetTilemapScrollY(void) { return zxnextTilemapGetScrollY(); }
uint32_t zxnextGetTilemapBaseAddressUseBank7(void) { return zxnextTilemapGetBaseAddressUseBank7(); }
uint32_t zxnextGetTilemapBaseAddressMsb(void) { return zxnextTilemapGetBaseAddressMsb(); }
uint32_t zxnextGetTilemapDefinitionAddressUseBank7(void) {
  return zxnextTilemapGetDefinitionAddressUseBank7();
}
uint32_t zxnextGetTilemapDefinitionAddressMsb(void) { return zxnextTilemapGetDefinitionAddressMsb(); }
/*
 * The Tilemap Inspector's reads (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.2). Side-effect free.
 */
/* $6B: bit 7 (enable) and bit 4 (second tilemap palette, kept by the palette module) re-ORed */
uint32_t zxnextGetTilemapControl(void) { return zxnextGetTilemapNextReg(0x6bu); }
/* $6C */
uint32_t zxnextGetTilemapDefaultAttr(void) { return zxnextTilemapGetDefaultAttr(); }
/* $4C, low nibble */
uint32_t zxnextGetTilemapTransparencyIndex(void) { return zxnextTilemapGetTransparencyIndex() & 0x0fu; }
/* Which `$1B` value the next write sets (`$1C` bits 5-4 reset it) */
uint32_t zxnextGetTilemapClipIndex(void) { return zxnextTilemapGetClipIndex(); }
void zxnextSpriteWritePort303b(uint32_t value) { zxnextSpritesWritePort303b(value); }
void zxnextSpriteWritePort57(uint32_t value) { zxnextSpritesWritePort57(value); }
void zxnextSpriteWritePort5b(uint32_t value) { zxnextSpritesWritePort5b(value); }
uint32_t zxnextSpriteReadPort303b(void) { return zxnextSpritesReadPort303b(); }
uint32_t zxnextGetSpriteClip(uint32_t index) { return zxnextSpritesGetClip(index); }
uint32_t zxnextGetSpriteTransparencyIndex(void) { return zxnextSpritesGetTransparencyIndex(); }
uint32_t zxnextGetSpriteIndex(void) { return zxnextSpritesGetSpriteIndex(); }
uint32_t zxnextGetSpritePatternIndex(void) { return zxnextSpritesGetPatternIndex(); }
uint32_t zxnextGetSpritePatternSubIndex(void) { return zxnextSpritesGetPatternSubIndex(); }
uint32_t zxnextGetSpriteSubIndex(void) { return zxnextSpritesGetSpriteSubIndex(); }
uint32_t zxnextGetSpriteAttribute(uint32_t sprite, uint32_t attr) {
  return zxnextSpritesGetAttribute(sprite, attr);
}
uint32_t zxnextGetSpritePatternByte8(uint32_t variant, uint32_t offset) {
  return zxnextSpritesGetPatternByte8(variant, offset);
}
uint32_t zxnextGetSpritePatternByte4(uint32_t variant, uint32_t offset) {
  return zxnextSpritesGetPatternByte4(variant, offset);
}
uint32_t zxnextGetLastVisibleSpriteIndex(void) { return zxnextSpritesGetLastVisibleSpriteIndex(); }

/*
 * The Sprite Inspector's reads (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.2). None of them changes the
 * machine: the status is peeked, not read through $303B (T1), and the IDE resolves into its own
 * buffer, never the render's cache (T3).
 */
/* `zxnextSpriteAttributes[128][5]`: 640 contiguous bytes */
uint32_t zxnextSpriteAttributesPtr(void) { return zxnextSpritesGetAttributesPtr(); }
/*
 * `zxnextSpritePatternMemory8[512][256]`: 8 transformed variants per 8-bit pattern. Variant 0 is the
 * identity layout, so raw pattern byte `N*256+i` is at row `N*8`, offset `i` - a stride of 2048 (T2).
 */
uint32_t zxnextSpritePatternMemory8Ptr(void) { return zxnextSpritesGetPatternMemory8Ptr(); }
/* $15 as written (sprite 0 on top, clipping, layer priority, over border, enabled) */
uint32_t zxnextGetSpriteControl(void) { return zxnextSpritesGetNextReg(0x15u); }
/* $303B bit 1 (too many) and bit 0 (collision), without clearing them (T1) */
uint32_t zxnextGetSpriteStatusPeek(void) { return zxnextSpritesPeekStatus(); }
/* The $34 attribute mirror index, bit 7 included */
uint32_t zxnextGetSpriteMirrorIndex(void) { return zxnextSpritesGetMirrorIndex(); }
/* Which `$19` value the next write sets (`$1C` bits 3-2) */
uint32_t zxnextGetSpriteClipIndex(void) { return zxnextSpritesGetClipIndex(); }

/*
 * All 128 sprites resolved for the IDE, 8 bytes each (volatile, T3):
 *   0    flags: bit 0 visible, 1 xmirror, 2 ymirror, 3 rotate, 4 four-bit
 *   1-2  X, little-endian, 9 bits
 *   3-4  Y, little-endian, 9 bits
 *   5    palette offset
 *   6    scale: scaleX << 2 | scaleY
 *   7    pattern7 (the 7-bit pattern number, `N5..N0 & N6`)
 * Decoded on the host by `decodeResolvedSprites` (`src/common/zxnext/sprites/spriteAttributes.ts`).
 */
static uint8_t zxnextIdeResolvedSprites[128u * 8u];
/*
 * The resolve's working table. A static, not a local: a 1.8K local lives on the shadow stack, which is
 * in linear memory and so in the state image - reading the sprites would have changed it.
 */
static ZxnextResolvedSprite zxnextIdeResolveScratch[128];

uint32_t zxnextResolveSpritesForIde(void) {
  zxnextUlaResolveSpritesInto(zxnextIdeResolveScratch, 128u);
  for (uint32_t i = 0u; i < 128u; i++) {
    const ZxnextResolvedSprite* r = &zxnextIdeResolveScratch[i];
    uint8_t* o = &zxnextIdeResolvedSprites[i * 8u];
    o[0] = (uint8_t)((r->visible ? 0x01u : 0u) | (r->xmirror ? 0x02u : 0u) | (r->ymirror ? 0x04u : 0u) |
      (r->rotate ? 0x08u : 0u) | (r->is4Bit ? 0x10u : 0u));
    o[1] = (uint8_t)(r->x & 0xffu);
    o[2] = (uint8_t)((r->x >> 8u) & 0x01u);
    o[3] = (uint8_t)(r->y & 0xffu);
    o[4] = (uint8_t)((r->y >> 8u) & 0x01u);
    o[5] = (uint8_t)(r->paletteOffset & 0x0fu);
    o[6] = (uint8_t)(((r->scaleX & 3u) << 2u) | (r->scaleY & 3u));
    o[7] = (uint8_t)(r->pattern7 & 0x7fu);
  }
  return (uint32_t)(uintptr_t)zxnextIdeResolvedSprites;
}
void zxnextCopperTick(uint32_t cvc, uint32_t hc) { zxnextCopperExecuteTick(cvc, hc); }
uint32_t zxnextCopperRead(uint32_t address) { return zxnextCopperReadMemory(address); }
uint32_t zxnextGetCopperNextReg(uint32_t reg) { return zxnextCopperGetNextReg(reg); }
uint32_t zxnextGetCopperStartMode(void) { return zxnextCopperGetStartMode(); }
uint32_t zxnextGetCopperInstructionAddress(void) { return zxnextCopperGetInstructionAddress(); }
uint32_t zxnextGetCopperListAddress(void) { return zxnextCopperGetListAddress(); }
uint32_t zxnextGetCopperListData(void) { return zxnextCopperGetListData(); }
uint32_t zxnextGetCopperDout(void) { return zxnextCopperGetDout(); }
uint32_t zxnextGetCopperVerticalLineOffset(void) { return zxnextCopperGetVerticalLineOffset(); }
/* The Copper list RAM, for the IDE to copy in one go (trap T8) */
uint32_t zxnextCopperMemoryPtr(void) { return zxnextCopperGetMemoryPtr(); }
/* The Copper beam at the CPU's current tact: bits 0-8 `cvc`, bits 9-17 `hc_ula`, bit 18 waiting */
uint32_t zxnextGetCopperBeam(void) { return zxnextCopperGetBeam(); }
/* The live timing: bits 0-15 the `cvc` lines in a frame, bits 16-31 the `hc_ula` positions in a line */
uint32_t zxnextGetCopperTiming(void) { return zxnextCopperGetTiming(); }
/* The visible lines above the paper: the last this-many `cvc` lines of a frame are the upper border */
uint32_t zxnextGetCopperUpperBorder(void) { return zxnextTimingDisplayYStart - zxnextTimingFirstVc; }
void zxnextSetBeeperOutput(uint32_t ear, uint32_t mic) { zxnextBeeperSetOutput(ear, mic); }
uint32_t zxnextGetBeeperEar(void) { return zxnextBeeperGetEar(); }
uint32_t zxnextGetBeeperMic(void) { return zxnextBeeperGetMic(); }
uint32_t zxnextGetBeeperOutputLevelMilli(void) { return zxnextBeeperGetOutputLevelMilli(); }
uint32_t zxnextGetBeeperSampleLeftMilli(void) { return zxnextBeeperGetSampleLeftMilli((double)zxnextBeeperTacts); }
uint32_t zxnextGetBeeperSampleRightMilli(void) { return zxnextBeeperGetSampleRightMilli((double)zxnextBeeperTacts); }
void zxnextSetPsgTurbosoundEnabled(uint32_t enabled) { zxnextPsgSetTurbosoundEnabled(enabled); }
void zxnextSetPsgAyStereoMode(uint32_t enabled) { zxnextPsgSetAyStereoMode(enabled); }
void zxnextSetPsgChipMonoMode(uint32_t chip, uint32_t enabled) { zxnextPsgSetChipMonoMode(chip, enabled); }
void zxnextSetPsgRegisterIndex(uint32_t value) { zxnextPsgSetRegisterIndex(value); }
void zxnextWritePsgRegisterValue(uint32_t value) { zxnextPsgWriteRegisterValue(value); }
uint32_t zxnextReadPsgRegisterValue(void) { return zxnextPsgReadRegisterValue(); }
void zxnextGeneratePsgOutput(uint32_t chip) { zxnextPsgGenerateOutput(chip); }
void zxnextAdvancePsgToFrameTact(uint32_t frameTact28) { zxnextPsgAdvanceToFrameTact((double)frameTact28); }
void zxnextPreparePsgAudioSample(double sampleEndFrameTact28) { zxnextPsgPrepareAudioSample(sampleEndFrameTact28); }
uint32_t zxnextGetPsgSampleLeft(void) { return zxnextPsgGetSampleLeft(); }
uint32_t zxnextGetPsgSampleRight(void) { return zxnextPsgGetSampleRight(); }
uint32_t zxnextGetPsgSelectedChip(void) { return zxnextPsgGetSelectedChip(); }
uint32_t zxnextGetPsgSelectedRegister(void) { return zxnextPsgGetSelectedRegister(); }
uint32_t zxnextGetPsgChipPanning(uint32_t chip) { return zxnextPsgGetChipPanning(chip); }
uint32_t zxnextGetPsgChipMonoMode(uint32_t chip) { return zxnextPsgGetChipMonoMode(chip); }
uint32_t zxnextGetPsgRegister(uint32_t chip, uint32_t reg) { return zxnextPsgGetRegister(chip, reg); }
uint32_t zxnextGetPsgOutputA(uint32_t chip) { return zxnextPsgGetOutputA(chip); }
uint32_t zxnextGetPsgOutputB(uint32_t chip) { return zxnextPsgGetOutputB(chip); }
uint32_t zxnextGetPsgOutputC(uint32_t chip) { return zxnextPsgGetOutputC(chip); }
uint32_t zxnextGetPsgStereoLeft(uint32_t chip) { return zxnextPsgGetStereoLeft(chip); }
uint32_t zxnextGetPsgStereoRight(uint32_t chip) { return zxnextPsgGetStereoRight(chip); }
uint32_t zxnextGetPsgNoiseRng(uint32_t chip) { return zxnextPsgGetNoiseRng(chip); }
uint32_t zxnextGetPsgEnvelopeStep(uint32_t chip) { return zxnextPsgGetEnvelopeStep(chip); }
uint32_t zxnextGetDacChannel(uint32_t channel) { return zxnextDacGetChannel(channel); }
uint32_t zxnextGetDacStereoLeft(void) { return zxnextDacGetStereoLeft(); }
uint32_t zxnextGetDacStereoRight(void) { return zxnextDacGetStereoRight(); }
void zxnextSetAudioSampleRate(uint32_t rate) { zxnextAudioMixerSetSampleRate(rate); }
uint32_t zxnextGetAudioSampleRate(void) { return zxnextAudioMixerGetSampleRate(); }
void zxnextSetAudioMixerEarLevelMilli(int32_t level) { zxnextAudioMixerSetEarLevelMilli(level); }
void zxnextSetAudioMixerMicLevelMilli(int32_t level) { zxnextAudioMixerSetMicLevelMilli(level); }
void zxnextSetAudioMixerPsgOutput(uint32_t left, uint32_t right) { zxnextAudioMixerSetPsgOutput(left, right); }
void zxnextSetAudioMixerVolumeScaleMilli(uint32_t scale) { zxnextAudioMixerSetVolumeScaleMilli(scale); }
int32_t zxnextGetAudioMixerMixedLeftWord(void) { return zxnextAudioMixerGetMixedLeftWord(); }
int32_t zxnextGetAudioMixerMixedRightWord(void) { return zxnextAudioMixerGetMixedRightWord(); }
uint32_t zxnextAppendAudioMixerCurrentSample(void) { return zxnextAudioMixerAppendCurrentSample(); }
void zxnextBeginAudioMixerFrame(void) { zxnextAudioMixerBeginFrame(); }
/* A new frame's audio, as zxnextFrameExecute begins it: the host's per-instruction (debug) loop starts
   frames itself, and without this the sample buffers filled in its first frame and stayed full */
void zxnextBeginAudioFrame(void) {
  zxnextFrameBegun = 1u;
  zxnextBeeperBeginFrame();
  zxnextPsgBeginFrame();
  zxnextAudioMixerBeginFrame();
}
void zxnextSetNextAudioMixerSample(uint32_t frameTacts28) { zxnextAudioMixerSetNextSample(frameTacts28); }
uint32_t zxnextGetAudioMixerSampleCount(void) { return zxnextAudioMixerGetSampleCount(); }
int32_t zxnextGetAudioMixerSampleLeft(uint32_t index) { return zxnextAudioMixerGetSampleLeft(index); }
int32_t zxnextGetAudioMixerSampleRight(uint32_t index) { return zxnextAudioMixerGetSampleRight(index); }

// -----------------------------------------------------------------------------
// Breakpoint conditions (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`): the shared evaluator, with
// this machine's side-effect-free reads. `zxnextMemoryPeekMapped` is the CPU view with no contention
// or bus-mirror update. The partition layout mirrors `getMemoryPartition` in `ZxNextWasmV2Machine.ts`;
// which partition a slot holds is decided here only (`zxnextPartitionOfPage`), and `getPartition`
// asks for it through `zxnextGetPartitionOfPage`. The offsets are `nextMemoryLayout.ts`'s.
// -----------------------------------------------------------------------------

#define COND_NEXT_OFFS_NEXT_ROM 0x000000u
#define COND_NEXT_OFFS_DIVMMC_ROM 0x010000u
#define COND_NEXT_OFFS_ALT_ROM_0 0x018000u
#define COND_NEXT_OFFS_ALT_ROM_1 0x01c000u
#define COND_NEXT_OFFS_DIVMMC_RAM 0x020000u
#define COND_NEXT_OFFS_NEXT_RAM 0x040000u

static uint32_t condNextPeekPartition(int32_t partition, uint32_t address) {
  uint32_t length = 0x2000u;
  uint32_t offset = 0u;
  if (partition >= -4 && partition <= -1) {
    length = 0x4000u;
    offset = COND_NEXT_OFFS_NEXT_ROM + 0x4000u * (uint32_t)(-partition - 1);
  } else if (partition == -5) {
    length = 0x4000u;
    offset = COND_NEXT_OFFS_ALT_ROM_0;
  } else if (partition == -6) {
    length = 0x4000u;
    offset = COND_NEXT_OFFS_ALT_ROM_1;
  } else if (partition == -7) {
    offset = COND_NEXT_OFFS_DIVMMC_ROM;
  } else if (partition >= -23 && partition <= -8) {
    offset = COND_NEXT_OFFS_DIVMMC_RAM + 0x2000u * (uint32_t)(-partition - 8);
  } else if (partition >= 0 && partition < 224) {
    offset = COND_NEXT_OFFS_NEXT_RAM + 0x2000u * (uint32_t)partition;
  }
  return zxnextMemory[(offset + address % length) % ZXNEXT_MEMORY_SIZE];
}

/* The partition a physical read offset lies in (no RAM page: the caller knows those by bank) */
static int64_t zxnextPartitionOfOffset(uint32_t readOffset) {
  if (readOffset >= COND_NEXT_OFFS_NEXT_RAM) return INT64_MIN /* COND_NO_VALUE */;
  if (readOffset >= COND_NEXT_OFFS_DIVMMC_RAM) return -8 - (int64_t)((readOffset - COND_NEXT_OFFS_DIVMMC_RAM) >> 13);
  if (readOffset >= COND_NEXT_OFFS_ALT_ROM_1 && readOffset < COND_NEXT_OFFS_ALT_ROM_1 + 0x4000u) return -6;
  if (readOffset >= COND_NEXT_OFFS_ALT_ROM_0 && readOffset < COND_NEXT_OFFS_ALT_ROM_0 + 0x4000u) return -5;
  if (readOffset >= COND_NEXT_OFFS_DIVMMC_ROM && readOffset < COND_NEXT_OFFS_DIVMMC_ROM + 0x2000u) return -7;
  if (readOffset < COND_NEXT_OFFS_NEXT_ROM + 0x10000u) return -1 - (int64_t)(readOffset >> 14);
  return INT64_MIN /* COND_NO_VALUE */;
}

/*
 * The partition the MMU pages into an 8K slot, ignoring the $0000-$3FFF overlays: only
 * `zxnextMemorySetPageInfo` changes it, which is what lets the history context cache it.
 * The `bank8 < 224` threshold is carried over from `getWasmV2PartitionForPage`.
 */
static int64_t zxnextMmuPartitionOfPage(uint32_t page) {
  const uint32_t bank8 = zxnextMemoryGetPageBank8(page & 0x07u);
  if (bank8 < 224u) return bank8;
  return zxnextPartitionOfOffset(zxnextMemoryGetPageReadOffset(page & 0x07u));
}

/*
 * The partition an 8K slot holds as the CPU reads code there (`zxnextMemoryPeekMapped`): in slots
 * 0-1 the Multiface wins over the DivMMC, and both over the MMU. Multiface memory has no partition
 * (`COND_NO_VALUE`); the DivMMC's ROM is `DM` (-7) and its RAM `M0`..`MF` (-8..-23), mapram's
 * read-only bank 3 included. A Layer 2 read mapping is not an overlay here: it maps RAM pages for
 * data reads, and its partition would differ between a read and a write of the same address.
 */
static int64_t zxnextPartitionOfPage(uint32_t page) {
  page &= 0x07u;
  if (page < 2u && zxnextMemoryLowOverlayActive()) {
    if (zxnextMultifaceIsPaged()) return INT64_MIN /* COND_NO_VALUE */;
    return zxnextPartitionOfOffset(zxnextMemoryResolveReadOffset(page));
  }
  return zxnextMmuPartitionOfPage(page);
}

static int64_t condNextPartitionOf(uint32_t address) { return zxnextPartitionOfPage((address >> 13) & 0x07u); }

/* `getPartition`'s answer for a slot; ZXNEXT_NO_PARTITION_EXPORT when nothing a partition names is there */
#define ZXNEXT_NO_PARTITION_EXPORT 0x7fffffff
int32_t zxnextGetPartitionOfPage(uint32_t page) {
  const int64_t partition = zxnextPartitionOfPage(page);
  return partition == INT64_MIN ? ZXNEXT_NO_PARTITION_EXPORT : (int32_t)partition;
}

#define COND_PEEK(address) ((uint32_t)zxnextMemoryPeekMapped(address))
#define COND_PEEK_PARTITION(partition, address) condNextPeekPartition(partition, address)
#define COND_PEEK_BANK(bank, offset) condNextPeekPartition((int32_t)((bank) * 2u + (((offset) >> 13) & 1u)), (offset) & 0x1fffu)
#define COND_PARTITION_OF(address) condNextPartitionOf(address)
#define COND_NEXTREG(reg) zxnextNextRegPeek(reg)
#include "../../../../z80/wasm/z80-condition.c"

// -----------------------------------------------------------------------------
// Execution history (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.2-§4.3): the shared recorder,
// with this machine's side-effect-free peek, its frame position in 28 MHz ticks, and its context.
//
// The instruction context (`zxnextContext.ts` decodes it):
//   0-7  the partition of each 8K slot, as `getPartition` returns it (`zxnextPartitionOfPage`),
//        Multiface and DivMMC overlays included, captured before the opcode fetch (so a delayed
//        DivMMC entry still names the ROM the CPU fetched from):
//        0-223 a Next RAM page, 233-255 the negative partitions -23..-1 (ROMs, DivMMC), 224 none.
//        The partition, not the raw MMU value, because ROM, DivMMC, Multiface and Alt ROM overlay
//        slots 0-1 whatever MMU0/MMU1 say - and the partition is what source mapping needs (T13).
//   8    port $7FFD   9 port $1FFD   10 port $DFFD   11 DivMMC port $E3
//   12   bit 0 DivMMC mapped, bit 1 Multiface paged, bit 2 Alt ROM enabled, bit 3 ROM in slot 0
//   13   CPU speed (NextReg $07 effective, 0-3)
// The DMA hold context (D15):
//   0-1  source address at the start of the hold   2-3 destination   4-5 bytes left
//   6    bit 0 port A to B, bit 1 burst mode, bit 2 source is I/O, bit 3 destination is I/O
// -----------------------------------------------------------------------------

#define ZXNEXT_HISTORY_NO_PARTITION 224u

static inline uint8_t zxnextHistoryEncodePartition(int64_t partition) {
  return partition == INT64_MIN ? (uint8_t)ZXNEXT_HISTORY_NO_PARTITION : (uint8_t)(partition & 0xff);
}

static void zxnextHistoryUpdateSlot(uint32_t page) {
  zxnextHistorySlots[page & 0x07u] = zxnextHistoryEncodePartition(zxnextMmuPartitionOfPage(page));
}

static inline void zxnextHistoryContext(uint32_t kind, uint8_t *out) {
  (void)kind;
  for (uint32_t slot = 0u; slot < 8u; slot++) out[slot] = zxnextHistorySlots[slot];
  /* The Multiface and DivMMC overlays change without touching the page tables: never cached */
  if (zxnextMemoryLowOverlayActive()) {
    out[0] = zxnextHistoryEncodePartition(zxnextPartitionOfPage(0u));
    out[1] = zxnextHistoryEncodePartition(zxnextPartitionOfPage(1u));
  }
  out[8] = memPort7ffd;
  out[9] = memPort1ffd;
  out[10] = memPortDffd;
  out[11] = (uint8_t)zxnextDivMmcGetPortE3();
  /* -6..-1: a Next ROM or an Alt ROM */
  out[12] = (uint8_t)((zxnextDivMmcIsMappingActive() ? 0x01u : 0u) | (zxnextMultifaceIsPaged() ? 0x02u : 0u) |
                      ((zxnextNextRegs[0x8cu] & 0x80u) ? 0x04u : 0u) |
                      (out[0] >= 250u ? 0x08u : 0u));
  out[13] = (uint8_t)(cpuEffectiveSpeed & 0x03u);
  out[14] = 0u;
  out[15] = 0u;
}

/*
 * The three bytes after the opcode at `from`: one mapping resolution when they lie in the same 8K
 * page as `from + 1` (nearly always), `zxnextMemoryPeekMapped`'s side-effect-free path otherwise.
 */
static inline void zxnextHistoryPeek3(uint16_t from, uint8_t *out) {
  const uint32_t first = (uint16_t)(from + 1u);
  if ((first & 0x1fffu) <= 0x1ffdu) {
    uint32_t physical = ZXNEXT_NO_WRITE_OFFSET;
    if (!((first >> 13u) < 2u && zxnextMemoryLowOverlayActive())) {
      physical = zxnextMemoryResolveLayer2Offset(first, 0u);
    }
    if (physical == ZXNEXT_NO_WRITE_OFFSET) {
      physical = zxnextMemoryResolveReadOffset(first >> 13) + (first & 0x1fffu);
    }
    out[0] = (uint8_t)zxnextMemoryReadPhysical(physical);
    out[1] = (uint8_t)zxnextMemoryReadPhysical(physical + 1u);
    out[2] = (uint8_t)zxnextMemoryReadPhysical(physical + 2u);
    return;
  }
  out[0] = (uint8_t)zxnextMemoryPeekMapped(first);
  out[1] = (uint8_t)zxnextMemoryPeekMapped((uint16_t)(first + 1u));
  out[2] = (uint8_t)zxnextMemoryPeekMapped((uint16_t)(first + 2u));
}

#define Z80_HISTORY_CAPACITY 131072u
#define Z80_HISTORY_PEEK(address) zxnextMemoryPeekMapped(address)
#define Z80_HISTORY_PEEK3(from, out3) zxnextHistoryPeek3(from, out3)
#define Z80_HISTORY_CONTEXT(kind, out16) zxnextHistoryContext(kind, out16)
/* The DivMMC's instant entry points map before the fetch (zxnextDivMmcBeforeOpcodeFetch), its delayed
   ones after it (zxnextDivMmcAfterM1): the map at the begin phase is the one the fetch saw */
#define Z80_HISTORY_CONTEXT_BEFORE_FETCH 1
#define Z80_HISTORY_FRAME() frames
#define Z80_HISTORY_FRAME_TACT() frameTacts28
#include "../../../../z80/wasm/z80-history.c"

static inline uint16_t zxnextHistoryDmaLeft(void) {
  return dmaCounter < dmaBlockLength ? (uint16_t)(dmaBlockLength - dmaCounter) : 0u;
}

/*
 * The DMA held the bus for `cpuTacts` CPU T-states before the next instruction (plan D15).
 * Consecutive holds with no instruction between them coalesce, like HALT: the repeat count carries
 * the held T-states, saturates at 65,535, and the rest starts a new record.
 */
static void zxnextHistoryDmaHold(uint32_t cpuTacts, uint16_t src, uint16_t dest, uint32_t frame, uint32_t frameTact) {
  Z80HistoryRecord *newest = z80HistoryNewest();
  if (newest && newest->kind == Z80_HISTORY_KIND_DMA_HOLD && newest->pc == cpu.pc) {
    const uint32_t room = Z80_HISTORY_MAX_REPEAT - newest->repeat;
    const uint32_t taken = cpuTacts < room ? cpuTacts : room;
    newest->repeat = (uint16_t)(newest->repeat + taken);
    const uint16_t left = zxnextHistoryDmaLeft();
    newest->context[4] = (uint8_t)left;
    newest->context[5] = (uint8_t)(left >> 8);
    cpuTacts -= taken;
  }
  while (cpuTacts > 0u) {
    Z80HistoryRecord *r = z80HistoryAppend(Z80_HISTORY_KIND_DMA_HOLD);
    const uint32_t taken = cpuTacts < Z80_HISTORY_MAX_REPEAT ? cpuTacts : Z80_HISTORY_MAX_REPEAT;
    r->repeat = (uint16_t)taken;
    r->frame = frame;
    r->frameTact = frameTact;
    const uint16_t left = zxnextHistoryDmaLeft();
    r->context[0] = (uint8_t)src;
    r->context[1] = (uint8_t)(src >> 8);
    r->context[2] = (uint8_t)dest;
    r->context[3] = (uint8_t)(dest >> 8);
    r->context[4] = (uint8_t)left;
    r->context[5] = (uint8_t)(left >> 8);
    r->context[6] = (uint8_t)((dmaDirAtoB ? 0x01u : 0u) | (dmaTransferMode == DMA_MODE_BURST ? 0x02u : 0u) |
                              ((dmaDirAtoB ? dmaPortAIsIo : dmaPortBIsIo) ? 0x04u : 0u) |
                              ((dmaDirAtoB ? dmaPortBIsIo : dmaPortAIsIo) ? 0x08u : 0u));
    cpuTacts -= taken;
  }
}

// -----------------------------------------------------------------------------
// The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2, D4): the shared module, with
// this machine's physical layout. The profile offset is the offset into `zxnextMemory` - Next ROM,
// DivMMC ROM, Multiface, Alt ROMs, DivMMC RAM, then the 224 Next RAM pages (`nextMemoryLayout.ts`);
// `src/common/profile/layouts/zxnext.ts` names them by partition. Time is in 28 MHz ticks (D8), from
// `zxnextProfileTicks28`, which a frame end does not wrap.
//
// Reads (and code fetches) and writes resolve apart (trap T2), exactly as `zxnextMemoryPeekMapped` and
// `zxnextMemoryWriteMapped` do: the Multiface and DivMMC overlays of $0000-$3FFF first, then the
// Layer 2 mapping - which can map writes only, or reads only, over ROM - then the MMU. A write that
// reaches no memory (ROM, the DivMMC ROM, mapram's bank 3, an MMU page above $DF) maps nowhere, and
// so does anything at or above the error page (`OFFS_ERR_PAGE`), which no partition names.
// -----------------------------------------------------------------------------

#define ZXNEXT_PROFILE_ERR_PAGE (2048u * 1024u)

/*
 * Both run at every CPU memory access while profiling is on (trap T10), so the common case - no
 * Layer 2 mapping in that direction, no overlay in slots 0-1 - is one table load, and only the rare
 * mappings take the general path (the same steps as the core's own read and write paths).
 */
Z80_ALWAYS_INLINE int32_t zxnextProfilePhysRead(uint32_t address) {
  const uint32_t normalized = address & 0xffffu;
  const uint32_t slot = normalized >> 13u;
  if (zxnextLayer2EnableMappingForReads == 0u && (slot >= 2u || !zxnextMemoryLowOverlayActive())) {
    /* MMU offsets are below the error page: RAM page $DF ends at 2 MB */
    return (int32_t)(pageReadOffset[slot] + (normalized & 0x1fffu));
  }
  uint32_t physical = ZXNEXT_NO_WRITE_OFFSET;
  if (!(slot < 2u && zxnextMemoryLowOverlayActive())) {
    physical = zxnextMemoryResolveLayer2Offset(normalized, 0u);
  }
  if (physical == ZXNEXT_NO_WRITE_OFFSET) {
    physical = zxnextMemoryResolveReadOffset(slot) + (normalized & 0x1fffu);
  }
  return physical < ZXNEXT_PROFILE_ERR_PAGE ? (int32_t)physical : -1;
}

Z80_ALWAYS_INLINE int32_t zxnextProfilePhysWrite(uint32_t address) {
  const uint32_t normalized = address & 0xffffu;
  const uint32_t slot = normalized >> 13u;
  uint32_t physical = ZXNEXT_NO_WRITE_OFFSET;
  if (zxnextLayer2EnableMappingForWrites == 0u && (slot >= 2u || !zxnextMemoryLowOverlayActive())) {
    physical = pageWriteOffset[slot];
    return physical == ZXNEXT_NO_WRITE_OFFSET ? -1 : (int32_t)(physical + (normalized & 0x1fffu));
  }
  if (!(slot < 2u && zxnextMemoryLowOverlayActive())) {
    physical = zxnextMemoryResolveLayer2Offset(normalized, 1u);
  }
  if (physical == ZXNEXT_NO_WRITE_OFFSET) {
    physical = zxnextMemoryResolveWriteOffset(slot);
    if (physical == ZXNEXT_NO_WRITE_OFFSET) return -1;
    physical += normalized & 0x1fffu;
  }
  return physical < ZXNEXT_PROFILE_ERR_PAGE ? (int32_t)physical : -1;
}

/* The whole of `zxnextMemory`, error page included, so an offset is the physical offset unchanged */
#define Z80_PROFILE_FLAG_BYTES ZXNEXT_MEMORY_SIZE
/* 64 pages (12 MB): 512K of touched memory with counters; the flags cover all 2 MB regardless (D5, T6) */
#define Z80_PROFILE_POOL_PAGES 64u
#define Z80_PROFILE_PHYS_READ(address) zxnextProfilePhysRead((uint32_t)(address))
#define Z80_PROFILE_PHYS_WRITE(address) zxnextProfilePhysWrite((uint32_t)(address))
#define Z80_PROFILE_FRAME_TICKS() zxnextProfileTicks28
#include "../../../../z80/wasm/z80-profile.c"
