#include <stdint.h>

#define SP48_MEMORY_SIZE 0x10000u
#define SP48_SCREEN_WIDTH 256u
#define SP48_SCREEN_HEIGHT 192u
#define SP48_PIXEL_COUNT (SP48_SCREEN_WIDTH * SP48_SCREEN_HEIGHT)
#define SP48_TACTS_PER_FRAME_PAL 69888u
#define SP48_BASE_CLOCK_FREQUENCY_PAL 3500000u
#define SP48_DEFAULT_SAMPLE_RATE 44100u
#define SP48_AUDIO_SAMPLE_CAPACITY 2048u

typedef struct Sp48AudioSample {
  int16_t left;
  int16_t right;
} Sp48AudioSample;

// ----------------------------------------------------------------------------
// Static machine state

static uint8_t sp48Memory[SP48_MEMORY_SIZE];
static uint8_t sp48KeyboardLines[8];
static uint32_t sp48PixelBuffer[SP48_PIXEL_COUNT];
static Sp48AudioSample sp48AudioSamples[SP48_AUDIO_SAMPLE_CAPACITY];

static uint32_t sp48Frames;
static uint32_t sp48Tacts;
static uint32_t sp48TactsInFrame = SP48_TACTS_PER_FRAME_PAL;
static uint32_t sp48BaseClockFrequency = SP48_BASE_CLOCK_FREQUENCY_PAL;
static uint32_t sp48AudioSampleRate = SP48_DEFAULT_SAMPLE_RATE;
static uint32_t sp48AudioSampleCount;
static uint32_t sp48DiagnosticFlags;
static uint32_t sp48RomUploadCount;
static uint32_t sp48RomChecksum;

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

static void clearRam(uint32_t is16k) {
  for (uint32_t i = 0x4000u; i < SP48_MEMORY_SIZE; i++) {
    sp48Memory[i] = is16k != 0u && i >= 0x8000u ? 0xffu : 0u;
  }
}

static void resetKeyboard(void) {
  for (uint32_t i = 0u; i < 8u; i++) {
    sp48KeyboardLines[i] = 0xffu;
  }
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
      if (sp48RomUploadCount >= 0x4000u && y < 8u) {
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

  for (uint32_t i = 0u; i < sp48AudioSampleCount; i++) {
    const uint32_t phase = (i + sp48Frames * 19u + keyMix) & 0x3fu;
    const int16_t level = phase < 32u ? 1200 : -1200;
    sp48AudioSamples[i].left = level;
    sp48AudioSamples[i].right = level;
  }
}

// ----------------------------------------------------------------------------
// Lifecycle and execution

void sp48Reset(void) {
  resetKeyboard();
  sp48Frames = 0u;
  sp48Tacts = 0u;
  sp48DiagnosticFlags = 0u;
  sp48AudioSampleCount = clampAudioSampleCount(sp48AudioSampleRate);
  renderFakeDisplay();
  renderFakeAudio();
}

void sp48HardReset(uint32_t is16k, uint32_t isNtsc) {
  (void)is16k;
  (void)isNtsc;
  sp48TactsInFrame = SP48_TACTS_PER_FRAME_PAL;
  sp48BaseClockFrequency = SP48_BASE_CLOCK_FREQUENCY_PAL;
  clearRam(is16k);
  sp48Reset();
}

uint32_t sp48ExecuteFrame(void) {
  sp48Frames++;
  sp48Tacts += sp48TactsInFrame;
  renderFakeDisplay();
  renderFakeAudio();
  return 0u;
}

uint32_t sp48ExecuteInstruction(void) {
  sp48Tacts += 4u;
  return 0u;
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
  const uint32_t line = (key >> 3u) & 0x07u;
  const uint8_t mask = (uint8_t)(1u << (key & 0x07u));
  if (down != 0u) {
    sp48KeyboardLines[line] = (uint8_t)(sp48KeyboardLines[line] & (uint8_t)~mask);
  } else {
    sp48KeyboardLines[line] = (uint8_t)(sp48KeyboardLines[line] | mask);
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

uint32_t sp48GetKeyboardLine(uint32_t line) {
  return sp48KeyboardLines[line & 0x07u];
}

uint32_t sp48GetDiagnosticFlags(void) {
  return sp48DiagnosticFlags;
}
