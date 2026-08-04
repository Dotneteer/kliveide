#include <stdint.h>

#define SP128_RAM_SIZE 0x20000u
#define SP128_ROM_SIZE 0x8000u
#define SP128_MEMORY_SIZE 0x10000u
#define SP128_KEYBOARD_LINE_COUNT 8u
#define SP128_SCREEN_WIDTH 352u
#define SP128_SCREEN_HEIGHT 296u
#define SP128_PIXEL_BUFFER_WORDS (SP128_SCREEN_WIDTH * SP128_SCREEN_HEIGHT)
#define SP128_AUDIO_SAMPLE_CAPACITY 2048u
#define SP128_TACTS_PER_FRAME 70908u

typedef struct Sp128AudioSample {
  int16_t left;
  int16_t right;
} Sp128AudioSample;

static uint8_t sp128Ram[SP128_RAM_SIZE];
static uint8_t sp128Rom[SP128_ROM_SIZE];
static uint8_t sp128Memory[SP128_MEMORY_SIZE];
static uint8_t sp128KeyboardLines[SP128_KEYBOARD_LINE_COUNT];
static uint32_t sp128PixelBuffer[SP128_PIXEL_BUFFER_WORDS];
static Sp128AudioSample sp128AudioSamples[SP128_AUDIO_SAMPLE_CAPACITY];

static uint32_t sp128Frames;
static uint32_t sp128Tacts;
static uint32_t sp128AudioSampleCount;
static uint8_t sp128SelectedRom;
static uint8_t sp128SelectedBank;
static uint8_t sp128PagingEnabled;
static uint8_t sp128UseShadowScreen;
static uint32_t sp128DiagnosticFlags;

static uint32_t ramBankOffset(uint32_t bank) {
  return (bank & 0x07u) * 0x4000u;
}

static uint32_t romBankOffset(uint32_t bank) {
  return (bank & 0x01u) * 0x4000u;
}

static void rebuildFlatMemory(void) {
  for (uint32_t i = 0u; i < 0x4000u; i++) {
    sp128Memory[i] = sp128Rom[romBankOffset(sp128SelectedRom) + i];
    sp128Memory[0x4000u + i] = sp128Ram[ramBankOffset(5u) + i];
    sp128Memory[0x8000u + i] = sp128Ram[ramBankOffset(2u) + i];
    sp128Memory[0xc000u + i] = sp128Ram[ramBankOffset(sp128SelectedBank) + i];
  }
}

static uint8_t readMappedMemory(uint32_t address) {
  const uint32_t maskedAddress = address & 0xffffu;
  if (maskedAddress < 0x4000u) {
    return sp128Rom[romBankOffset(sp128SelectedRom) + maskedAddress];
  }
  if (maskedAddress < 0x8000u) {
    return sp128Ram[ramBankOffset(5u) + (maskedAddress - 0x4000u)];
  }
  if (maskedAddress < 0xc000u) {
    return sp128Ram[ramBankOffset(2u) + (maskedAddress - 0x8000u)];
  }
  return sp128Ram[ramBankOffset(sp128SelectedBank) + (maskedAddress - 0xc000u)];
}

static void writeMappedMemory(uint32_t address, uint32_t value) {
  const uint32_t maskedAddress = address & 0xffffu;
  const uint8_t byteValue = (uint8_t)value;
  if (maskedAddress < 0x4000u) {
    return;
  }
  if (maskedAddress < 0x8000u) {
    sp128Ram[ramBankOffset(5u) + (maskedAddress - 0x4000u)] = byteValue;
  } else if (maskedAddress < 0xc000u) {
    sp128Ram[ramBankOffset(2u) + (maskedAddress - 0x8000u)] = byteValue;
  } else {
    sp128Ram[ramBankOffset(sp128SelectedBank) + (maskedAddress - 0xc000u)] = byteValue;
  }
  sp128Memory[maskedAddress] = byteValue;
}

void sp128Reset(void) {
  sp128Frames = 0u;
  sp128Tacts = 0u;
  sp128AudioSampleCount = 0u;
  sp128SelectedRom = 0u;
  sp128SelectedBank = 0u;
  sp128PagingEnabled = 1u;
  sp128UseShadowScreen = 0u;
  sp128DiagnosticFlags = 0u;
  for (uint32_t i = 0u; i < SP128_KEYBOARD_LINE_COUNT; i++) {
    sp128KeyboardLines[i] = 0u;
  }
  rebuildFlatMemory();
}

void sp128HardReset(void) {
  for (uint32_t i = 0u; i < SP128_RAM_SIZE; i++) {
    sp128Ram[i] = 0u;
  }
  sp128Reset();
}

uint32_t sp128ExecuteFrame(void) {
  sp128Tacts += SP128_TACTS_PER_FRAME;
  sp128Frames++;
  sp128AudioSampleCount = 0u;
  return 0u;
}

uint32_t sp128ExecuteInstruction(void) {
  sp128Tacts += 4u;
  return 0u;
}

void sp128RenderInstantScreen(void) {
}

void sp128UploadRomByte(uint32_t rom, uint32_t offset, uint32_t value) {
  if (rom < 2u && offset < 0x4000u) {
    sp128Rom[romBankOffset(rom) + offset] = (uint8_t)value;
    if (rom == sp128SelectedRom) {
      sp128Memory[offset] = (uint8_t)value;
    }
  }
}

uint32_t sp128ReadMemory(uint32_t address) {
  return readMappedMemory(address);
}

void sp128WriteMemory(uint32_t address, uint32_t value) {
  writeMappedMemory(address, value);
}

uint32_t sp128ReadRamBank(uint32_t bank, uint32_t offset) {
  if (bank >= 8u || offset >= 0x4000u) {
    return 0xffu;
  }
  return sp128Ram[ramBankOffset(bank) + offset];
}

void sp128WriteRamBank(uint32_t bank, uint32_t offset, uint32_t value) {
  if (bank >= 8u || offset >= 0x4000u) {
    return;
  }
  sp128Ram[ramBankOffset(bank) + offset] = (uint8_t)value;
  rebuildFlatMemory();
}

uint32_t sp128ReadRomBank(uint32_t bank, uint32_t offset) {
  if (bank >= 2u || offset >= 0x4000u) {
    return 0xffu;
  }
  return sp128Rom[romBankOffset(bank) + offset];
}

uint32_t sp128ReadScreenMemoryOffset(uint32_t offset) {
  const uint32_t bank = sp128UseShadowScreen != 0u ? 7u : 5u;
  return sp128Ram[ramBankOffset(bank) + (offset & 0x3fffu)];
}

uint32_t sp128ReadPort(uint32_t address) {
  (void)address;
  return 0xffu;
}

void sp128WritePort(uint32_t address, uint32_t value) {
  if ((address & 0xc002u) != 0x4000u) {
    return;
  }
  if (sp128PagingEnabled == 0u) {
    return;
  }
  sp128SelectedBank = (uint8_t)(value & 0x07u);
  sp128UseShadowScreen = (value & 0x08u) != 0u ? 1u : 0u;
  sp128SelectedRom = (value & 0x10u) != 0u ? 1u : 0u;
  sp128PagingEnabled = (value & 0x20u) != 0u ? 0u : 1u;
  rebuildFlatMemory();
}

uint8_t *sp128MemoryPtr(void) {
  return sp128Memory;
}

uint8_t *sp128RamPtr(void) {
  return sp128Ram;
}

uint8_t *sp128RomPtr(void) {
  return sp128Rom;
}

uint32_t *sp128PixelBufferPtr(void) {
  return sp128PixelBuffer;
}

Sp128AudioSample *sp128AudioSamplesPtr(void) {
  return sp128AudioSamples;
}

uint8_t *sp128KeyboardLinesPtr(void) {
  return sp128KeyboardLines;
}

uint32_t sp128GetMemorySize(void) {
  return SP128_MEMORY_SIZE;
}

uint32_t sp128GetRamSize(void) {
  return SP128_RAM_SIZE;
}

uint32_t sp128GetRomSize(void) {
  return SP128_ROM_SIZE;
}

uint32_t sp128GetScreenWidth(void) {
  return SP128_SCREEN_WIDTH;
}

uint32_t sp128GetScreenHeight(void) {
  return SP128_SCREEN_HEIGHT;
}

uint32_t sp128GetPixelBufferStartOffset(void) {
  return 0u;
}

uint32_t sp128GetAudioSampleCount(void) {
  return sp128AudioSampleCount;
}

uint32_t sp128GetAudioSampleCapacity(void) {
  return SP128_AUDIO_SAMPLE_CAPACITY;
}

uint32_t sp128GetTactsInFrame(void) {
  return SP128_TACTS_PER_FRAME;
}

uint32_t sp128GetFrames(void) {
  return sp128Frames;
}

uint32_t sp128GetTacts(void) {
  return sp128Tacts;
}

uint32_t sp128GetSelectedRom(void) {
  return sp128SelectedRom;
}

uint32_t sp128GetSelectedBank(void) {
  return sp128SelectedBank;
}

uint32_t sp128GetPagingEnabled(void) {
  return sp128PagingEnabled;
}

uint32_t sp128GetUseShadowScreen(void) {
  return sp128UseShadowScreen;
}

uint32_t sp128GetScreenBank(void) {
  return sp128UseShadowScreen != 0u ? 7u : 5u;
}

uint32_t sp128GetCurrentPartition(uint32_t slot) {
  switch (slot & 0x03u) {
    case 0u:
      return sp128SelectedRom == 0u ? 0xffffffffu : 0xfffffffeu;
    case 1u:
      return 5u;
    case 2u:
      return 2u;
    default:
      return sp128SelectedBank;
  }
}

uint32_t sp128GetDiagnosticFlags(void) {
  return sp128DiagnosticFlags;
}
