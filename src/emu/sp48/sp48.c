#include <stdint.h>

#define SP48_MEMORY_SIZE 0x10000u
#define SP48_DISPLAY_WIDTH 256u
#define SP48_DISPLAY_HEIGHT 192u
#define SP48_SCREEN_BUFFER_WIDTH_MAX 352u
#define SP48_SCREEN_BUFFER_LINES_MAX 288u
#define SP48_PIXEL_BUFFER_GUARD_LINES 4u
#define SP48_PIXEL_BUFFER_WORDS_MAX \
  (SP48_SCREEN_BUFFER_WIDTH_MAX * (SP48_SCREEN_BUFFER_LINES_MAX + SP48_PIXEL_BUFFER_GUARD_LINES))
#define SP48_TACTS_PER_FRAME_PAL 69888u
#define SP48_TACTS_PER_FRAME_MAX SP48_TACTS_PER_FRAME_PAL
#define SP48_BASE_CLOCK_FREQUENCY_PAL 3500000u
#define SP48_BASE_CLOCK_FREQUENCY_NTSC 3527500u
#define SP48_DEFAULT_SAMPLE_RATE 44100u
#define SP48_AUDIO_SAMPLE_CAPACITY 2048u
#define SP48_AUDIO_TRANSITION_CAPACITY 4096u
#define SP48_BORDER_TRANSITION_CAPACITY 4096u
#define SP48_AUDIO_SAMPLE_SCALE 12000.0
#define SP48_TAPE_MAX_BLOCKS 512u
#define SP48_TAPE_DATA_CAPACITY 0x400000u
#define SP48_TAPE_FILENAME_CAPACITY 260u
#define SP48_TAPE_HEADER_PILOT_COUNT 8063u
#define SP48_TAPE_DATA_PILOT_COUNT 3223u
#define SP48_TAPE_LOAD_BYTES_ROUTINE 0x056cu
#define SP48_TAPE_SAVE_BYTES_ROUTINE 0x04c2u
#define SP48_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW 0x00000004u
#define SP48_DIAGNOSTIC_TAPE_DATA_OVERFLOW 0x00000008u
#define SP48_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE 0x00000010u
#define SP48_DIAGNOSTIC_BORDER_TRANSITION_OVERFLOW 0x00000020u

#define SP48_TAPE_MODE_PASSIVE 0u
#define SP48_TAPE_MODE_LOAD 1u
#define SP48_TAPE_MODE_SAVE 2u

#define SP48_TAPE_PHASE_NONE 0u
#define SP48_TAPE_PHASE_PILOT 1u
#define SP48_TAPE_PHASE_SYNC 2u
#define SP48_TAPE_PHASE_DATA 3u
#define SP48_TAPE_PHASE_TERM_SYNC 4u
#define SP48_TAPE_PHASE_PAUSE 5u
#define SP48_TAPE_PHASE_COMPLETED 6u

#define SP48_RENDER_PHASE_NONE 0u
#define SP48_RENDER_PHASE_BORDER 1u
#define SP48_RENDER_PHASE_BORDER_FETCH_PIXEL 2u
#define SP48_RENDER_PHASE_BORDER_FETCH_ATTR 3u
#define SP48_RENDER_PHASE_DISPLAY_B1 4u
#define SP48_RENDER_PHASE_DISPLAY_B2 5u
#define SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2 6u
#define SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2 7u
#define SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1 8u
#define SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1 9u

typedef struct Sp48ScreenConfig {
  uint16_t verticalSyncLines;
  uint16_t nonVisibleBorderTopLines;
  uint16_t borderTopLines;
  uint16_t borderBottomLines;
  uint16_t nonVisibleBorderBottomLines;
  uint16_t displayLines;
  uint16_t borderLeftTime;
  uint16_t borderRightTime;
  uint16_t displayLineTime;
  uint16_t horizontalBlankingTime;
  uint16_t nonVisibleBorderRightTime;
  uint16_t pixelDataPrefetchTime;
  uint16_t attributeDataPrefetchTime;
  uint8_t contentionValues[8];
} Sp48ScreenConfig;

typedef struct Sp48AudioSample {
  int16_t left;
  int16_t right;
} Sp48AudioSample;

typedef struct Sp48AudioTransition {
  uint32_t tact;
  uint8_t earBit;
  uint8_t micBit;
} Sp48AudioTransition;

typedef struct Sp48BorderTransition {
  uint32_t tact;
  uint8_t color;
} Sp48BorderTransition;

typedef struct Sp48TapeBlock {
  uint32_t offset;
  uint32_t length;
  uint32_t pauseAfter;
  uint32_t pilotPulseLength;
  uint32_t sync1PulseLength;
  uint32_t sync2PulseLength;
  uint32_t zeroBitPulseLength;
  uint32_t oneBitPulseLength;
  uint32_t endSyncPulseLength;
  uint8_t lastByteUsedBits;
  uint32_t pilotPulseCount;
} Sp48TapeBlock;

// ----------------------------------------------------------------------------
// Static machine state

static uint8_t sp48Memory[SP48_MEMORY_SIZE];
static uint8_t sp48KeyboardLines[8];
static uint8_t sp48Contention[SP48_TACTS_PER_FRAME_MAX];
static uint8_t sp48RenderingPhase[SP48_TACTS_PER_FRAME_MAX];
static uint16_t sp48RenderingPixelAddress[SP48_TACTS_PER_FRAME_MAX];
static uint16_t sp48RenderingAttributeAddress[SP48_TACTS_PER_FRAME_MAX];
static uint32_t sp48RenderingPixelIndex[SP48_TACTS_PER_FRAME_MAX];
static uint32_t sp48PixelBuffer[SP48_PIXEL_BUFFER_WORDS_MAX];
static Sp48AudioSample sp48AudioSamples[SP48_AUDIO_SAMPLE_CAPACITY];
static Sp48AudioTransition sp48AudioTransitions[SP48_AUDIO_TRANSITION_CAPACITY];
static Sp48BorderTransition sp48BorderTransitions[SP48_BORDER_TRANSITION_CAPACITY];
static Sp48TapeBlock sp48TapeBlocks[SP48_TAPE_MAX_BLOCKS];
static uint8_t sp48TapeData[SP48_TAPE_DATA_CAPACITY];
static uint8_t sp48TapeFileName[SP48_TAPE_FILENAME_CAPACITY];

static uint32_t sp48Frames;
static uint32_t sp48Tacts;
static uint32_t sp48TactsInFrame = SP48_TACTS_PER_FRAME_PAL;
static uint32_t sp48RasterLines;
static uint32_t sp48ScreenLineTime;
static uint32_t sp48TimingScreenWidth;
static uint32_t sp48TimingScreenLines;
static uint32_t sp48FirstDisplayLine;
static uint32_t sp48FirstVisibleLine;
static uint32_t sp48FirstVisibleBorderTact;
static uint32_t sp48DisplayLeftPixel;
static uint32_t sp48DisplayTopLine;
static uint32_t sp48BaseClockFrequency = SP48_BASE_CLOCK_FREQUENCY_PAL;
static uint32_t sp48AudioSampleRate = SP48_DEFAULT_SAMPLE_RATE;
static uint32_t sp48AudioSampleCount;
static uint32_t sp48AudioTransitionCount;
static uint32_t sp48AudioFrameStartTact;
static uint8_t sp48AudioFrameStartEarBit;
static uint8_t sp48AudioFrameStartMicBit;
static double sp48AudioSampleLength;
static double sp48AudioNextSampleTact;
static double sp48DcFilterPrevInputLeft;
static double sp48DcFilterPrevInputRight;
static double sp48DcFilterPrevOutputLeft;
static double sp48DcFilterPrevOutputRight;
static uint32_t sp48DiagnosticFlags;
static uint32_t sp48TotalContentionDelaySinceStart;
static uint32_t sp48ContentionDelaySincePause;
static uint32_t sp48CpuInstructionsExecuted;
static uint32_t sp48CpuFrameSliceInstructions;
static uint32_t sp48NextFrameStartTact;
static uint32_t sp48FrameCompleted;
static uint32_t sp48InterruptsRaised;
static uint8_t sp48InterruptLineActive;
static uint32_t sp48RomUploadCount;
static uint32_t sp48RomChecksum;
static uint8_t sp48PortFeValue;
static uint8_t sp48BorderColor;
static uint8_t sp48BorderFrameStartColor;
static uint32_t sp48BorderFrameStartTact;
static uint32_t sp48BorderTransitionCount;
static uint8_t sp48EarBit;
static uint8_t sp48MicBit;
static uint8_t sp48BeeperLevel;
static uint32_t sp48EarBitChangedFrom0Tacts;
static uint32_t sp48EarBitChangedFrom1Tacts;
static uint16_t sp48LastMemoryAddress;
static uint8_t sp48LastMemoryValue;
static uint8_t sp48LastMemoryIsWrite;
static uint8_t sp48HasMemoryEvent;
static uint32_t sp48TapeBlockCount;
static uint32_t sp48TapeDataLength;
static uint32_t sp48TapeCurrentBlockIndex;
static uint32_t sp48TapeUploadBlockCount;
static uint32_t sp48TapeUploadDataLength;
static uint8_t sp48TapeUploadActive;
static uint8_t sp48TapeLoaded;
static uint8_t sp48TapeEof;
static uint8_t sp48TapeMode;
static uint8_t sp48TapePlayPhase;
static uint32_t sp48TapeStartTact;
static uint32_t sp48TapePilotEndPos;
static uint32_t sp48TapeSync1EndPos;
static uint32_t sp48TapeSync2EndPos;
static uint32_t sp48TapeBitStartPos;
static uint32_t sp48TapeBitPulseLength;
static uint32_t sp48TapeDataIndex;
static uint8_t sp48TapeBitMask;
static uint32_t sp48TapeTermEndPos;
static uint32_t sp48TapePauseEndPos;
static uint8_t sp48TapeEarBit;
static uint32_t sp48TapeModeChangeCount;
static uint32_t sp48TapeLastModeChangeTact;
static uint32_t sp48TapeLastModeChangePc;
static uint32_t sp48TapeLoadStartCount;
static uint32_t sp48TapeSaveStartCount;
static uint8_t sp48TapeFastLoad = 1u;

#include "sp48-memory.c"
#include "sp48-ula.c"

uint32_t sp48ReadPort(uint32_t address);
uint32_t sp48ReadFloatingBus(void);
void sp48WritePort(uint32_t address, uint32_t value);
uint32_t sp48TapeGetEarBit(void);
uint32_t sp48ExecuteInstruction(void);

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() sp48Memory
#define Z80_READ_MEMORY(address) sp48CpuReadMemory((uint32_t)(address))
#define Z80_WRITE_MEMORY(address, value) sp48CpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_POKE_MEMORY(address, value) sp48Memory[((uint32_t)(address)) & 0xffffu] = (uint8_t)(value)
#define Z80_READ_PORT(address) ((uint8_t)sp48ReadPort((uint32_t)(address)))
#define Z80_WRITE_PORT(address, value) sp48WritePort((uint32_t)(address), (uint32_t)(value))
#define Z80_TACT_PLUS_N(value) \
  do { \
    const uint32_t z80Sp48Tacts = (uint32_t)(value); \
    cpu.tacts += z80Sp48Tacts; \
    sp48Tacts += z80Sp48Tacts; \
  } while (0)
#define SP48_CPU_APPLY_CONTENTION() \
  do { \
    const uint32_t z80Sp48Delay = sp48Contention[currentFrameTact()]; \
    cpu.tacts += z80Sp48Delay; \
    sp48Tacts += z80Sp48Delay; \
    sp48TotalContentionDelaySinceStart += z80Sp48Delay; \
    sp48ContentionDelaySincePause += z80Sp48Delay; \
  } while (0)
#define SP48_CPU_DELAY_PORT_ACCESS(address) \
  do { \
    const uint32_t z80Sp48PortAddress = (uint32_t)(address); \
    const uint8_t z80Sp48LowBit = (z80Sp48PortAddress & 0x0001u) != 0u ? 1u : 0u; \
    if (isContendedIoAddress(z80Sp48PortAddress) != 0u) { \
      if (z80Sp48LowBit != 0u) { \
        SP48_CPU_APPLY_CONTENTION(); \
        tactPlusN(1u); \
        SP48_CPU_APPLY_CONTENTION(); \
        tactPlusN(1u); \
        SP48_CPU_APPLY_CONTENTION(); \
        tactPlusN(1u); \
        SP48_CPU_APPLY_CONTENTION(); \
        tactPlusN(1u); \
      } else { \
        SP48_CPU_APPLY_CONTENTION(); \
        tactPlusN(1u); \
        SP48_CPU_APPLY_CONTENTION(); \
        tactPlusN(3u); \
      } \
    } else if (z80Sp48LowBit != 0u) { \
      tactPlusN(4u); \
    } else { \
      tactPlusN(1u); \
      SP48_CPU_APPLY_CONTENTION(); \
      tactPlusN(3u); \
    } \
  } while (0)
#define Z80_DELAY_MEMORY_READ(address) \
  do { \
    if ((((uint32_t)(address)) & 0xc000u) == 0x4000u) { \
      SP48_CPU_APPLY_CONTENTION(); \
    } \
    tactPlusN(3u); \
  } while (0)
#define Z80_DELAY_MEMORY_WRITE(address) Z80_DELAY_MEMORY_READ(address)
#define Z80_DELAY_PORT_READ(address) SP48_CPU_DELAY_PORT_ACCESS(address)
#define Z80_DELAY_PORT_WRITE(address) SP48_CPU_DELAY_PORT_ACCESS(address)
#include "../z80/z80.c"

#undef Z80_EXTERNAL_BUS
#undef Z80_MEMORY_PTR
#undef Z80_READ_MEMORY
#undef Z80_WRITE_MEMORY
#undef Z80_POKE_MEMORY
#undef Z80_READ_PORT
#undef Z80_WRITE_PORT
#undef Z80_TACT_PLUS_N
#undef SP48_CPU_APPLY_CONTENTION
#undef SP48_CPU_DELAY_PORT_ACCESS
#undef Z80_DELAY_MEMORY_READ
#undef Z80_DELAY_MEMORY_WRITE
#undef Z80_DELAY_PORT_READ
#undef Z80_DELAY_PORT_WRITE

#include "sp48-keyboard.c"
#include "sp48-beeper.c"
#include "sp48-ports.c"
#include "sp48-tape.c"

// ----------------------------------------------------------------------------
// Lifecycle and execution

void sp48Reset(void) {
  if (sp48ScreenLineTime == 0u) {
    initializeTimingTables(&sp48PalConfig);
  }
  z80Reset();
  resetKeyboard();
  resetPortFe();
  sp48Frames = 0u;
  sp48Tacts = 0u;
  sp48DiagnosticFlags = 0u;
  sp48TotalContentionDelaySinceStart = 0u;
  sp48ContentionDelaySincePause = 0u;
  sp48CpuInstructionsExecuted = 0u;
  sp48CpuFrameSliceInstructions = 0u;
  sp48NextFrameStartTact = 0u;
  sp48FrameCompleted = 0u;
  sp48InterruptsRaised = 0u;
  sp48InterruptLineActive = 0u;
  resetTapePlayback();
  resetAudio();
  renderUlaDisplay();
}

void sp48HardReset(uint32_t is16k, uint32_t isNtsc) {
  (void)is16k;
  sp48BaseClockFrequency = isNtsc != 0u
    ? SP48_BASE_CLOCK_FREQUENCY_NTSC
    : SP48_BASE_CLOCK_FREQUENCY_PAL;
  initializeTimingTables(isNtsc != 0u ? &sp48NtscConfig : &sp48PalConfig);
  clearRam(is16k);
  sp48Reset();
}

uint32_t sp48ExecuteFrame(void) {
  if (sp48FrameCompleted != 0u) {
    sp48FrameCompleted = 0u;
  }

  const uint32_t frameStartTact = sp48Tacts;
  const uint32_t frameEndTact = sp48NextFrameStartTact + sp48TactsInFrame;
  beginAudioFrame();
  beginBorderFrame(frameStartTact);
  sp48CpuFrameSliceInstructions = 0u;
  while (sp48Tacts < frameEndTact) {
    sp48ExecuteInstruction();
    sp48CpuFrameSliceInstructions++;
  }
  sp48FrameCompleted = 1u;
  sp48NextFrameStartTact += sp48TactsInFrame;
  sp48Frames++;
  renderUlaDisplay();
  renderBeeperAudio(frameStartTact, sp48Tacts);
  return 0u;
}

void sp48RenderInstantScreen(void) {
  renderUlaDisplay();
}

uint32_t sp48ExecuteInstruction(void) {
  sp48HasMemoryEvent = 0u;
  z80ClearBusEvents();
  updateTapeMode();
  const uint8_t intActive = shouldRaiseInterrupt();
  if (intActive != 0u && sp48InterruptLineActive == 0u) {
    sp48InterruptsRaised++;
  }
  sp48InterruptLineActive = intActive;
  z80SetSigInt(intActive);
  z80SetTacts(sp48Tacts);
  z80ExecuteCpuCycle();
  sp48Tacts = z80GetTacts();
  sp48CpuInstructionsExecuted++;
  updateTapeMode();
  sp48FrameCompleted = sp48Tacts >= sp48NextFrameStartTact + sp48TactsInFrame ? 1u : 0u;
  return 0u;
}

void sp48DelayAddressBusAccess(uint32_t address) {
  if ((address & 0xc000u) == 0x4000u) {
    applyContentionDelay();
  }
}

void sp48DelayPortAccess(uint32_t address) {
  const uint8_t lowBit = (address & 0x0001u) != 0u ? 1u : 0u;

  if (isContendedIoAddress(address) != 0u) {
    if (lowBit != 0u) {
      applyContentionDelay();
      sp48Tacts += 1u;
      applyContentionDelay();
      sp48Tacts += 1u;
      applyContentionDelay();
      sp48Tacts += 1u;
      applyContentionDelay();
      sp48Tacts += 1u;
    } else {
      applyContentionDelay();
      sp48Tacts += 1u;
      applyContentionDelay();
      sp48Tacts += 3u;
    }
  } else if (lowBit != 0u) {
    sp48Tacts += 4u;
  } else {
    sp48Tacts += 1u;
    applyContentionDelay();
    sp48Tacts += 3u;
  }
}

void sp48DelayPortRead(uint32_t address) {
  sp48DelayPortAccess(address);
}

void sp48DelayPortWrite(uint32_t address) {
  sp48DelayPortAccess(address);
}

void sp48ResetContentionCounters(void) {
  sp48TotalContentionDelaySinceStart = 0u;
  sp48ContentionDelaySincePause = 0u;
}

void sp48SetTacts(uint32_t value) {
  sp48Tacts = value;
}

// ----------------------------------------------------------------------------
// Pointer exports

uint8_t *sp48MemoryPtr(void) {
  return sp48Memory;
}

uint32_t *sp48PixelBufferPtr(void) {
  return sp48PixelBuffer;
}

Sp48AudioSample *sp48AudioSamplesPtr(void) {
  return sp48AudioSamples;
}

uint8_t *sp48KeyboardLinesPtr(void) {
  return sp48KeyboardLines;
}

// ----------------------------------------------------------------------------
// Shape, counters, and diagnostics

uint32_t sp48GetScreenWidth(void) {
  return currentScreenWidth();
}

uint32_t sp48GetScreenHeight(void) {
  return currentScreenHeight();
}

uint32_t sp48GetPixelBufferStartOffset(void) {
  return pixelBufferStartOffset();
}

uint32_t sp48GetRomSize(void) {
  return 0x4000u;
}

uint32_t sp48GetRomUploadCount(void) {
  return sp48RomUploadCount;
}

uint32_t sp48GetRomChecksum(void) {
  return sp48RomChecksum;
}

uint32_t sp48GetAudioSampleCount(void) {
  return sp48AudioSampleCount;
}

uint32_t sp48GetAudioSampleCapacity(void) {
  return SP48_AUDIO_SAMPLE_CAPACITY;
}

uint32_t sp48GetTactsInFrame(void) {
  return sp48TactsInFrame;
}

uint32_t sp48GetBaseClockFrequency(void) {
  return sp48BaseClockFrequency;
}

uint32_t sp48GetFrames(void) {
  return sp48Frames;
}

uint32_t sp48GetTacts(void) {
  return sp48Tacts;
}

uint32_t sp48GetCurrentFrameTact(void) {
  return currentFrameTact();
}

uint32_t sp48GetRasterLines(void) {
  return sp48RasterLines;
}

uint32_t sp48GetScreenLineTime(void) {
  return sp48ScreenLineTime;
}

uint32_t sp48GetTimingScreenWidth(void) {
  return sp48TimingScreenWidth;
}

uint32_t sp48GetTimingScreenLines(void) {
  return sp48TimingScreenLines;
}

uint32_t sp48GetFirstDisplayLine(void) {
  return sp48FirstDisplayLine;
}

uint32_t sp48GetFirstVisibleLine(void) {
  return sp48FirstVisibleLine;
}

uint32_t sp48GetFirstVisibleBorderTact(void) {
  return sp48FirstVisibleBorderTact;
}

uint32_t sp48GetContentionValue(uint32_t tact) {
  return sp48Contention[tact % sp48TactsInFrame];
}

uint32_t sp48GetRenderingPhase(uint32_t tact) {
  return sp48RenderingPhase[tact % sp48TactsInFrame];
}

uint32_t sp48GetRenderingPixelAddress(uint32_t tact) {
  return sp48RenderingPixelAddress[tact % sp48TactsInFrame];
}

uint32_t sp48GetRenderingAttributeAddress(uint32_t tact) {
  return sp48RenderingAttributeAddress[tact % sp48TactsInFrame];
}

uint32_t sp48GetRenderingPixelIndex(uint32_t tact) {
  return sp48RenderingPixelIndex[tact % sp48TactsInFrame];
}

uint32_t sp48GetTotalContentionDelaySinceStart(void) {
  return sp48TotalContentionDelaySinceStart;
}

uint32_t sp48GetContentionDelaySincePause(void) {
  return sp48ContentionDelaySincePause;
}

uint32_t sp48GetNextFrameStartTact(void) {
  return sp48NextFrameStartTact;
}

uint32_t sp48GetFrameCompleted(void) {
  return sp48FrameCompleted;
}

uint32_t sp48GetInterruptsRaised(void) {
  return sp48InterruptsRaised;
}

uint32_t sp48GetInterruptLineActive(void) {
  return sp48InterruptLineActive;
}

uint32_t sp48GetCpuInstructionsExecuted(void) {
  return sp48CpuInstructionsExecuted;
}

uint32_t sp48GetCpuFrameSliceInstructions(void) {
  return sp48CpuFrameSliceInstructions;
}

uint32_t sp48GetCpuTacts(void) {
  return z80GetTacts();
}

uint32_t sp48GetCpuAf(void) {
  return z80GetAf();
}

void sp48SetCpuAf(uint32_t value) {
  z80SetAf(value);
}

uint32_t sp48GetCpuBc(void) {
  return z80GetBc();
}

void sp48SetCpuBc(uint32_t value) {
  z80SetBc(value);
}

uint32_t sp48GetCpuDe(void) {
  return z80GetDe();
}

void sp48SetCpuDe(uint32_t value) {
  z80SetDe(value);
}

uint32_t sp48GetCpuHl(void) {
  return z80GetHl();
}

void sp48SetCpuHl(uint32_t value) {
  z80SetHl(value);
}

uint32_t sp48GetCpuIx(void) {
  return z80GetIx();
}

void sp48SetCpuIx(uint32_t value) {
  z80SetIx(value);
}

uint32_t sp48GetCpuIy(void) {
  return z80GetIy();
}

void sp48SetCpuIy(uint32_t value) {
  z80SetIy(value);
}

uint32_t sp48GetCpuAfAlt(void) {
  return z80GetAfAlt();
}

uint32_t sp48GetCpuBcAlt(void) {
  return z80GetBcAlt();
}

uint32_t sp48GetCpuDeAlt(void) {
  return z80GetDeAlt();
}

uint32_t sp48GetCpuHlAlt(void) {
  return z80GetHlAlt();
}

uint32_t sp48GetCpuIr(void) {
  return z80GetIr();
}

uint32_t sp48GetCpuWz(void) {
  return z80GetWz();
}

uint32_t sp48GetCpuPc(void) {
  return z80GetPc();
}

void sp48SetCpuPc(uint32_t value) {
  z80SetPc(value);
}

uint32_t sp48GetCpuSp(void) {
  return z80GetSp();
}

void sp48SetCpuSp(uint32_t value) {
  z80SetSp(value);
}

uint32_t sp48GetCpuHalted(void) {
  return z80GetHalted();
}

uint32_t sp48GetCpuPrefix(void) {
  return z80GetPrefix();
}

uint32_t sp48GetCpuIff1(void) {
  return z80GetIff1();
}

void sp48SetCpuIff1(uint32_t value) {
  z80SetIff1(value);
}

uint32_t sp48GetCpuInterruptMode(void) {
  return z80GetInterruptMode();
}

void sp48SetCpuInterruptMode(uint32_t value) {
  z80SetInterruptMode(value);
}

uint32_t sp48GetCpuRetExecuted(void) {
  return z80GetRetExecuted();
}

uint32_t sp48GetCpuRetnExecuted(void) {
  return z80GetRetnExecuted();
}

uint32_t sp48GetLastMemoryAddress(void) {
  return sp48HasMemoryEvent != 0u ? sp48LastMemoryAddress : 0u;
}

uint32_t sp48GetLastMemoryValue(void) {
  return sp48HasMemoryEvent != 0u ? sp48LastMemoryValue : 0u;
}

uint32_t sp48GetLastMemoryIsWrite(void) {
  return sp48HasMemoryEvent != 0u ? sp48LastMemoryIsWrite : 0u;
}

uint32_t sp48GetLastPortAddress(void) {
  return z80GetLastPortAddress();
}

uint32_t sp48GetLastPortValue(void) {
  return z80GetLastPortValue();
}

uint32_t sp48GetLastPortIsWrite(void) {
  return z80GetLastPortIsWrite();
}

uint32_t sp48GetPortFeValue(void) {
  return sp48PortFeValue;
}

uint32_t sp48GetBorderColor(void) {
  return sp48BorderColor;
}

uint32_t sp48GetEarBit(void) {
  return sp48EarBit;
}

uint32_t sp48GetMicBit(void) {
  return sp48MicBit;
}

uint32_t sp48GetBeeperLevel(void) {
  return sp48BeeperLevel;
}

uint32_t sp48GetEarBitChangedFrom0Tacts(void) {
  return sp48EarBitChangedFrom0Tacts;
}

uint32_t sp48GetEarBitChangedFrom1Tacts(void) {
  return sp48EarBitChangedFrom1Tacts;
}

uint32_t sp48GetDiagnosticFlags(void) {
  return sp48DiagnosticFlags;
}
