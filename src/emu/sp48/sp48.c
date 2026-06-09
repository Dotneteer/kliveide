#include <stdint.h>

#define SP48_MEMORY_SIZE 0x10000u
#define SP48_SCREEN_WIDTH 256u
#define SP48_SCREEN_HEIGHT 192u
#define SP48_PIXEL_COUNT (SP48_SCREEN_WIDTH * SP48_SCREEN_HEIGHT)
#define SP48_TACTS_PER_FRAME_PAL 69888u
#define SP48_TACTS_PER_FRAME_MAX SP48_TACTS_PER_FRAME_PAL
#define SP48_BASE_CLOCK_FREQUENCY_PAL 3500000u
#define SP48_DEFAULT_SAMPLE_RATE 44100u
#define SP48_AUDIO_SAMPLE_CAPACITY 2048u

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

// ----------------------------------------------------------------------------
// Static machine state

static uint8_t sp48Memory[SP48_MEMORY_SIZE];
static uint8_t sp48KeyboardLines[8];
static uint8_t sp48Contention[SP48_TACTS_PER_FRAME_MAX];
static uint8_t sp48RenderingPhase[SP48_TACTS_PER_FRAME_MAX];
static uint16_t sp48RenderingPixelAddress[SP48_TACTS_PER_FRAME_MAX];
static uint16_t sp48RenderingAttributeAddress[SP48_TACTS_PER_FRAME_MAX];
static uint32_t sp48RenderingPixelIndex[SP48_TACTS_PER_FRAME_MAX];
static uint32_t sp48PixelBuffer[SP48_PIXEL_COUNT];
static Sp48AudioSample sp48AudioSamples[SP48_AUDIO_SAMPLE_CAPACITY];

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
static uint32_t sp48BaseClockFrequency = SP48_BASE_CLOCK_FREQUENCY_PAL;
static uint32_t sp48AudioSampleRate = SP48_DEFAULT_SAMPLE_RATE;
static uint32_t sp48AudioSampleCount;
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
static uint8_t sp48EarBit;
static uint8_t sp48MicBit;
static uint8_t sp48BeeperLevel;
static uint32_t sp48EarBitChangedFrom0Tacts;
static uint32_t sp48EarBitChangedFrom1Tacts;

static const uint32_t sp48SpectrumColors[8] = {
  0xff000000u,
  0xffcd0000u,
  0xff0000cdu,
  0xffcd00cdu,
  0xff00cd00u,
  0xffcdcd00u,
  0xff00cdcdu,
  0xffcdcdcdu
};

static const Sp48ScreenConfig sp48PalConfig = {
  8u, 7u, 49u, 48u, 8u, 192u, 24u, 24u, 128u, 40u, 8u, 2u, 1u, {6u, 5u, 4u, 3u, 2u, 1u, 0u, 0u}
};

static const Sp48ScreenConfig sp48NtscConfig = {
  8u, 15u, 25u, 24u, 0u, 192u, 24u, 24u, 128u, 40u, 8u, 2u, 1u, {6u, 5u, 4u, 3u, 2u, 1u, 0u, 0u}
};

// ----------------------------------------------------------------------------
// Helpers

static inline uint32_t clampAudioSampleCount(uint32_t sampleRate) {
  uint32_t count = sampleRate / 50u;
  if (count == 0u) {
    count = 1u;
  }
  if (count > SP48_AUDIO_SAMPLE_CAPACITY) {
    sp48DiagnosticFlags |= 0x00000001u;
    count = SP48_AUDIO_SAMPLE_CAPACITY;
  }
  return count;
}

static inline uint32_t rgbaWord(uint8_t r, uint8_t g, uint8_t b) {
  return 0xff000000u | ((uint32_t)b << 16u) | ((uint32_t)g << 8u) | (uint32_t)r;
}

static inline uint8_t keyboardSignature(void) {
  uint8_t value = 0u;
  for (uint32_t i = 0u; i < 8u; i++) {
    value ^= (uint8_t)(sp48KeyboardLines[i] << (i & 0x03u));
  }
  return value;
}

static inline uint32_t getBorderPixel(void) {
  return sp48SpectrumColors[sp48BorderColor & 0x07u];
}

static inline uint32_t currentFrameTact(void) {
  return sp48TactsInFrame == 0u ? 0u : sp48Tacts % sp48TactsInFrame;
}

static inline uint16_t calcPixelAddress(uint32_t line, uint32_t tactInLine) {
  const uint32_t row = line - sp48FirstDisplayLine;
  return (uint16_t)(((row & 0xc0u) << 5u) + ((row & 0x07u) << 8u) + ((row & 0x38u) << 2u) + (tactInLine >> 2u));
}

static inline uint16_t calcAttrAddress(uint32_t line, uint32_t tactInLine) {
  return (uint16_t)((tactInLine >> 2u) + (((line - sp48FirstDisplayLine) >> 3u) << 5u) + 0x1800u);
}

static inline uint32_t calculateTimingBufferIndex(uint32_t line, uint32_t tactInLine) {
  if (tactInLine >= sp48FirstVisibleBorderTact) {
    line++;
    tactInLine -= sp48FirstVisibleBorderTact;
  } else {
    tactInLine += 24u;
  }

  return line >= sp48FirstVisibleLine
    ? 2u * ((((line - sp48FirstVisibleLine) * sp48TimingScreenWidth) / 2u) + tactInLine)
    : 0u;
}

static void clearTimingTables(void) {
  for (uint32_t i = 0u; i < SP48_TACTS_PER_FRAME_MAX; i++) {
    sp48Contention[i] = 0u;
    sp48RenderingPhase[i] = SP48_RENDER_PHASE_NONE;
    sp48RenderingPixelAddress[i] = 0u;
    sp48RenderingAttributeAddress[i] = 0u;
    sp48RenderingPixelIndex[i] = 0u;
  }
}

static void setRenderingTact(
  uint32_t tact,
  uint8_t phase,
  uint16_t pixelAddress,
  uint16_t attributeAddress,
  uint8_t contention
) {
  sp48RenderingPhase[tact] = phase;
  sp48RenderingPixelAddress[tact] = pixelAddress;
  sp48RenderingAttributeAddress[tact] = attributeAddress;
  sp48Contention[tact] = contention;
}

static void initializeTimingTables(const Sp48ScreenConfig *config) {
  clearTimingTables();

  sp48FirstDisplayLine =
    config->verticalSyncLines + config->nonVisibleBorderTopLines + config->borderTopLines;
  const uint32_t lastDisplayLine = sp48FirstDisplayLine + config->displayLines - 1u;
  sp48RasterLines =
    sp48FirstDisplayLine + config->displayLines + config->borderBottomLines + config->nonVisibleBorderBottomLines;
  sp48TimingScreenLines = config->borderTopLines + config->displayLines + config->borderBottomLines - 1u;
  sp48TimingScreenWidth = 2u * (config->borderLeftTime + config->displayLineTime + config->borderRightTime);
  sp48ScreenLineTime =
    config->borderLeftTime + config->displayLineTime + config->borderRightTime +
    config->nonVisibleBorderRightTime + config->horizontalBlankingTime;
  sp48TactsInFrame = sp48RasterLines * sp48ScreenLineTime;
  sp48FirstVisibleLine = config->verticalSyncLines + config->nonVisibleBorderTopLines;
  const uint32_t lastVisibleLine = sp48RasterLines - config->nonVisibleBorderBottomLines;
  sp48FirstVisibleBorderTact = sp48ScreenLineTime - config->borderLeftTime;
  const uint32_t lastVisibleLineTact = config->displayLineTime + config->borderRightTime;
  const uint32_t borderPixelFetchTact = sp48ScreenLineTime - config->pixelDataPrefetchTime;
  const uint32_t borderAttrFetchTact = sp48ScreenLineTime - config->attributeDataPrefetchTime;

  for (uint32_t tact = 0u; tact < sp48TactsInFrame; tact++) {
    const uint32_t line = tact / sp48ScreenLineTime;
    const uint32_t tactInLine = tact % sp48ScreenLineTime;
    uint8_t phase = SP48_RENDER_PHASE_NONE;
    uint16_t pixelAddress = 0u;
    uint16_t attributeAddress = 0u;
    uint8_t contention = 0u;

    if (
      line >= sp48FirstVisibleLine &&
      line <= lastVisibleLine &&
      (tactInLine < lastVisibleLineTact || tactInLine >= sp48FirstVisibleBorderTact)
    ) {
      uint8_t calculated = 0u;
      if (line == sp48FirstDisplayLine - 1u) {
        if (tactInLine == borderPixelFetchTact - 1u) {
          phase = SP48_RENDER_PHASE_BORDER;
          contention = config->contentionValues[6];
          calculated = 1u;
        } else if (tactInLine == borderPixelFetchTact) {
          phase = SP48_RENDER_PHASE_BORDER_FETCH_PIXEL;
          pixelAddress = calcPixelAddress(line + 1u, 0u);
          contention = config->contentionValues[7];
          calculated = 1u;
        } else if (tactInLine == borderAttrFetchTact) {
          phase = SP48_RENDER_PHASE_BORDER_FETCH_ATTR;
          attributeAddress = calcAttrAddress(line + 1u, 0u);
          contention = config->contentionValues[0];
          calculated = 1u;
        }
      }

      if (calculated == 0u) {
        if (
          line >= sp48FirstDisplayLine &&
          line <= lastDisplayLine &&
          tactInLine < config->displayLineTime
        ) {
          const uint32_t pixelTact = tactInLine & 0x07u;
          switch (pixelTact) {
            case 0u:
              phase = SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2;
              pixelAddress = calcPixelAddress(line, tactInLine + 4u);
              contention = config->contentionValues[1];
              break;
            case 1u:
              phase = SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2;
              attributeAddress = calcAttrAddress(line, tactInLine + 3u);
              contention = config->contentionValues[2];
              break;
            case 2u:
              phase = SP48_RENDER_PHASE_DISPLAY_B1;
              contention = config->contentionValues[3];
              break;
            case 3u:
              phase = SP48_RENDER_PHASE_DISPLAY_B1;
              contention = config->contentionValues[4];
              break;
            case 4u:
              phase = SP48_RENDER_PHASE_DISPLAY_B2;
              contention = config->contentionValues[5];
              break;
            case 5u:
              phase = SP48_RENDER_PHASE_DISPLAY_B2;
              contention = config->contentionValues[6];
              break;
            case 6u:
              phase = SP48_RENDER_PHASE_DISPLAY_B2;
              if (tactInLine < config->displayLineTime - config->pixelDataPrefetchTime) {
                phase = SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1;
                pixelAddress = calcPixelAddress(line, tactInLine + config->pixelDataPrefetchTime);
                contention = config->contentionValues[7];
              }
              break;
            case 7u:
              phase = SP48_RENDER_PHASE_DISPLAY_B2;
              if (tactInLine < config->displayLineTime - config->attributeDataPrefetchTime) {
                phase = SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1;
                attributeAddress = calcAttrAddress(line, tactInLine + config->attributeDataPrefetchTime);
                contention = config->contentionValues[0];
              }
              break;
          }
        } else {
          phase = SP48_RENDER_PHASE_BORDER;
          if (line >= sp48FirstDisplayLine && line < lastDisplayLine) {
            if (tactInLine == borderPixelFetchTact) {
              phase = SP48_RENDER_PHASE_BORDER_FETCH_PIXEL;
              pixelAddress = calcPixelAddress(line + 1u, 0u);
              contention = config->contentionValues[7];
            } else if (tactInLine == borderAttrFetchTact) {
              phase = SP48_RENDER_PHASE_BORDER_FETCH_ATTR;
              attributeAddress = calcAttrAddress(line + 1u, 0u);
              contention = config->contentionValues[0];
            }
          }
        }
      }
    }

    if (phase != SP48_RENDER_PHASE_NONE) {
      sp48RenderingPixelIndex[tact] = calculateTimingBufferIndex(line, tactInLine);
      setRenderingTact(tact, phase, pixelAddress, attributeAddress, contention);
    }
  }
}

static inline void applyContentionDelay(void) {
  const uint32_t delay = sp48Contention[currentFrameTact()];
  sp48Tacts += delay;
  sp48TotalContentionDelaySinceStart += delay;
  sp48ContentionDelaySincePause += delay;
}

static inline uint8_t isContendedIoAddress(uint32_t address) {
  return (address & 0xc000u) == 0x4000u;
}

static inline uint8_t shouldRaiseInterrupt(void) {
  return currentFrameTact() < 32u ? 1u : 0u;
}

uint32_t sp48ReadPort(uint32_t address);
void sp48WritePort(uint32_t address, uint32_t value);
uint32_t sp48ExecuteInstruction(void);

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() sp48Memory
#define Z80_READ_MEMORY(address) sp48Memory[((uint32_t)(address)) & 0xffffu]
#define Z80_WRITE_MEMORY(address, value) \
  do { \
    const uint32_t z80Sp48Address = ((uint32_t)(address)) & 0xffffu; \
    if (z80Sp48Address >= 0x4000u) { \
      sp48Memory[z80Sp48Address] = (uint8_t)(value); \
    } \
  } while (0)
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

static void clearRam(uint32_t is16k) {
  for (uint32_t i = 0x4000u; i < SP48_MEMORY_SIZE; i++) {
    sp48Memory[i] = is16k != 0u && i >= 0x8000u ? 0xffu : 0u;
  }
}

static void resetKeyboard(void) {
  for (uint32_t i = 0u; i < 8u; i++) {
    sp48KeyboardLines[i] = 0u;
  }
}

static void resetPortFe(void) {
  sp48PortFeValue = 0u;
  sp48BorderColor = 7u;
  sp48EarBit = 0u;
  sp48MicBit = 0u;
  sp48BeeperLevel = 0u;
  sp48EarBitChangedFrom0Tacts = 0u;
  sp48EarBitChangedFrom1Tacts = 0u;
}

static void renderFakeDisplay(void) {
  const uint8_t keyMix = keyboardSignature();
  const uint32_t framePhase = sp48Frames & 0xffu;
  const uint8_t romR = (uint8_t)(sp48RomChecksum & 0xffu);
  const uint8_t romG = (uint8_t)((sp48RomChecksum >> 8u) & 0xffu);
  const uint8_t romB = (uint8_t)((sp48RomChecksum >> 16u) & 0xffu);

  for (uint32_t y = 0u; y < SP48_SCREEN_HEIGHT; y++) {
    for (uint32_t x = 0u; x < SP48_SCREEN_WIDTH; x++) {
      const uint32_t index = y * SP48_SCREEN_WIDTH + x;
      if (x < 8u || x >= SP48_SCREEN_WIDTH - 8u || y < 8u || y >= SP48_SCREEN_HEIGHT - 8u) {
        sp48PixelBuffer[index] = getBorderPixel();
        continue;
      }
      if (sp48RomUploadCount >= 0x4000u && y >= 8u && y < 16u) {
        const uint32_t segment = x >> 5u;
        sp48PixelBuffer[index] = segment < 3u
          ? rgbaWord(
              segment == 0u ? romR : 0x20u,
              segment == 1u ? romG : 0x20u,
              segment == 2u ? romB : 0x20u)
          : rgbaWord(0x20u, 0xe0u, 0x60u);
        continue;
      }

      const uint32_t checker = ((x >> 4u) ^ (y >> 4u) ^ (sp48Frames >> 3u) ^ keyMix) & 0x01u;
      const uint8_t r = (uint8_t)(checker ? (x + framePhase + keyMix) : (framePhase + (y >> 1u)));
      const uint8_t g = (uint8_t)(checker ? (y + framePhase * 2u) : (x ^ keyMix));
      const uint8_t b = (uint8_t)(checker ? (0xe0u ^ keyMix) : (x + y + framePhase));
      sp48PixelBuffer[index] = rgbaWord(r, g, b);
    }
  }
}

static void renderFakeAudio(void) {
  sp48AudioSampleCount = clampAudioSampleCount(sp48AudioSampleRate);
  const uint8_t keyMix = keyboardSignature();
  const int16_t baseLevel = (int16_t)(sp48BeeperLevel * 700);

  for (uint32_t i = 0u; i < sp48AudioSampleCount; i++) {
    const uint32_t phase = (i + sp48Frames * 19u + keyMix) & 0x3fu;
    const int16_t level = (int16_t)((phase < 32u ? 700 : -700) + baseLevel);
    sp48AudioSamples[i].left = level;
    sp48AudioSamples[i].right = level;
  }
}

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
  sp48AudioSampleCount = clampAudioSampleCount(sp48AudioSampleRate);
  renderFakeDisplay();
  renderFakeAudio();
}

void sp48HardReset(uint32_t is16k, uint32_t isNtsc) {
  (void)is16k;
  sp48BaseClockFrequency = SP48_BASE_CLOCK_FREQUENCY_PAL;
  initializeTimingTables(isNtsc != 0u ? &sp48NtscConfig : &sp48PalConfig);
  clearRam(is16k);
  sp48Reset();
}

uint32_t sp48ExecuteFrame(void) {
  if (sp48FrameCompleted != 0u) {
    sp48FrameCompleted = 0u;
  }

  const uint32_t frameEndTact = sp48NextFrameStartTact + sp48TactsInFrame;
  sp48CpuFrameSliceInstructions = 0u;
  while (sp48Tacts < frameEndTact) {
    sp48ExecuteInstruction();
    sp48CpuFrameSliceInstructions++;
  }
  sp48FrameCompleted = 1u;
  sp48NextFrameStartTact += sp48TactsInFrame;
  sp48Frames++;
  renderFakeDisplay();
  renderFakeAudio();
  return 0u;
}

uint32_t sp48ExecuteInstruction(void) {
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
// Memory, input, and configuration

void sp48UploadRomByte(uint32_t offset, uint32_t value) {
  if (offset < 0x4000u) {
    sp48Memory[offset] = (uint8_t)value;
    if (offset == 0u) {
      sp48RomUploadCount = 0u;
      sp48RomChecksum = 0u;
    }
    sp48RomUploadCount++;
    sp48RomChecksum = ((sp48RomChecksum << 5u) | (sp48RomChecksum >> 27u)) ^ ((uint8_t)value + offset);
  }
}

uint32_t sp48ReadMemory(uint32_t address) {
  return sp48Memory[address & 0xffffu];
}

void sp48WriteMemory(uint32_t address, uint32_t value) {
  const uint32_t maskedAddress = address & 0xffffu;
  if (maskedAddress >= 0x4000u) {
    sp48Memory[maskedAddress] = (uint8_t)value;
  }
}

void sp48SetKeyStatus(uint32_t key, uint32_t down) {
  if (key >= 40u) {
    return;
  }

  const uint32_t line = key / 5u;
  const uint8_t mask = (uint8_t)(1u << (key % 5u));
  if (down != 0u) {
    sp48KeyboardLines[line] = (uint8_t)((sp48KeyboardLines[line] | mask) & 0x1fu);
  } else {
    sp48KeyboardLines[line] = (uint8_t)(sp48KeyboardLines[line] & (uint8_t)~mask & 0x1fu);
  }
}

uint32_t sp48ReadPort(uint32_t address) {
  if ((address & 0x0001u) != 0u) {
    return 0xffu;
  }

  uint8_t status = 0u;
  const uint32_t selectedLines = (~(address >> 8u)) & 0xffu;
  for (uint32_t line = 0u; line < 8u; line++) {
    if ((selectedLines & (1u << line)) != 0u) {
      status |= sp48KeyboardLines[line];
    }
  }
  uint32_t portValue = ((uint32_t)~status) & 0xffu;
  uint8_t bit4Sensed = sp48EarBit;
  if (bit4Sensed == 0u) {
    uint32_t chargeTime = sp48EarBitChangedFrom1Tacts - sp48EarBitChangedFrom0Tacts;
    if (chargeTime > 0u) {
      chargeTime = chargeTime > 700u ? 2800u : 4u * chargeTime;
      bit4Sensed = sp48Tacts - sp48EarBitChangedFrom1Tacts < chargeTime ? 1u : 0u;
    }
  }

  const uint32_t bit6Value = bit4Sensed != 0u ? 0x40u : 0x00u;
  return (portValue & 0xbfu) | bit6Value;
}

void sp48WritePort(uint32_t address, uint32_t value) {
  if ((address & 0x0001u) != 0u) {
    return;
  }

  sp48PortFeValue = (uint8_t)value;
  sp48BorderColor = (uint8_t)(value & 0x07u);
  sp48MicBit = (value & 0x08u) != 0u ? 1u : 0u;

  const uint8_t nextEarBit = (value & 0x10u) != 0u ? 1u : 0u;
  sp48BeeperLevel = (uint8_t)((sp48MicBit != 0u ? 1u : 0u) | (nextEarBit != 0u ? 2u : 0u));

  if (sp48EarBit != 0u) {
    if (nextEarBit == 0u) {
      sp48EarBitChangedFrom1Tacts = sp48Tacts;
      sp48EarBit = 0u;
    }
  } else if (nextEarBit != 0u) {
    sp48EarBitChangedFrom0Tacts = sp48Tacts;
    sp48EarBit = 1u;
  }
}

void sp48SetAudioSampleRate(uint32_t rate) {
  sp48AudioSampleRate = rate == 0u ? SP48_DEFAULT_SAMPLE_RATE : rate;
  sp48AudioSampleCount = clampAudioSampleCount(sp48AudioSampleRate);
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
  return SP48_SCREEN_WIDTH;
}

uint32_t sp48GetScreenHeight(void) {
  return SP48_SCREEN_HEIGHT;
}

uint32_t sp48GetPixelBufferStartOffset(void) {
  return 0u;
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

uint32_t sp48GetKeyboardLine(uint32_t line) {
  return sp48KeyboardLines[line & 0x07u];
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
