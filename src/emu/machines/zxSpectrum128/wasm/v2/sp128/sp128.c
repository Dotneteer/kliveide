#include <stdint.h>

#define SP128_RAM_SIZE 0x20000u
#define SP128_ROM_SIZE 0x8000u
#define SP128_MEMORY_SIZE 0x10000u
#define SP128_KEYBOARD_LINE_COUNT 8u
#define SP128_SCREEN_WIDTH 352u
#define SP128_SCREEN_HEIGHT 296u
#define SP128_DISPLAY_WIDTH 256u
#define SP128_DISPLAY_HEIGHT 192u
#define SP128_DISPLAY_LEFT 48u
#define SP128_DISPLAY_TOP 48u
#define SP128_PIXEL_BUFFER_WORDS (SP128_SCREEN_WIDTH * SP128_SCREEN_HEIGHT)
#define SP128_AUDIO_SAMPLE_CAPACITY 2048u
#define SP128_TACTS_PER_FRAME 70908u
#define SP128_SCREEN_LINE_TIME 228u

typedef struct Sp128AudioSample {
  int16_t left;
  int16_t right;
} Sp128AudioSample;

static uint8_t sp128Ram[SP128_RAM_SIZE];
static uint8_t sp128Rom[SP128_ROM_SIZE];
static uint8_t sp128Memory[SP128_MEMORY_SIZE];
static uint8_t sp128KeyboardLines[SP128_KEYBOARD_LINE_COUNT];
static uint8_t sp128Contention[SP128_TACTS_PER_FRAME];
static uint32_t sp128PixelBuffer[SP128_PIXEL_BUFFER_WORDS];
static Sp128AudioSample sp128AudioSamples[SP128_AUDIO_SAMPLE_CAPACITY];

static uint32_t sp128Frames;
static uint32_t sp128Tacts;
static uint32_t sp128AudioSampleCount;
static uint8_t sp128SelectedRom;
static uint8_t sp128SelectedBank;
static uint8_t sp128PagingEnabled;
static uint8_t sp128UseShadowScreen;
static uint8_t sp128PortFeValue;
static uint8_t sp128BorderColor;
static uint8_t sp128EarBit;
static uint8_t sp128MicBit;
static uint8_t sp128BeeperLevel;
static uint32_t sp128DiagnosticFlags;
static uint32_t sp128TotalContentionDelaySinceStart;
static uint32_t sp128ContentionDelaySincePause;
static uint32_t sp128CpuInstructionsExecuted;
static uint32_t sp128CpuFrameSliceInstructions;
static uint16_t sp128LastMemoryAddress;
static uint8_t sp128LastMemoryValue;
static uint8_t sp128LastMemoryIsWrite;
static uint8_t sp128HasMemoryEvent;

uint32_t sp128ReadPort(uint32_t address);
void sp128WritePort(uint32_t address, uint32_t value);
static uint8_t sp128CpuReadMemory(uint32_t address);
static void sp128CpuWriteMemory(uint32_t address, uint32_t value);
static void sp128CpuPokeMemory(uint32_t address, uint32_t value);
static void tactPlusN128(uint32_t value);
static void applyContentionDelay(void);
static void sp128DelayMemoryAccess(uint32_t address);
static void sp128DelayPortAccess(uint32_t address);

static uint32_t ramBankOffset(uint32_t bank) {
  return (bank & 0x07u) * 0x4000u;
}

static uint32_t romBankOffset(uint32_t bank) {
  return (bank & 0x01u) * 0x4000u;
}

static const uint32_t sp128SpectrumColors[16] = {
  0xff000000u,
  0xffaa0000u,
  0xff0000aau,
  0xffaa00aau,
  0xff00aa00u,
  0xffaaaa00u,
  0xff00aaaau,
  0xffaaaaaau,
  0xff000000u,
  0xffff0000u,
  0xff0000ffu,
  0xffff00ffu,
  0xff00ff00u,
  0xffffff00u,
  0xff00ffffu,
  0xffffffffu
};

static uint32_t getUlaPixelColor(uint32_t pixelSet, uint8_t attr) {
  const uint8_t bright = (uint8_t)((attr & 0x40u) >> 3u);
  const uint8_t ink = (uint8_t)((attr & 0x07u) | bright);
  const uint8_t paper = (uint8_t)(((attr >> 3u) & 0x07u) | bright);
  return sp128SpectrumColors[pixelSet != 0u ? ink : paper];
}

static uint32_t screenMemoryOffset(uint32_t y, uint32_t byteX) {
  return ((y & 0xc0u) << 5u) + ((y & 0x07u) << 8u) + ((y & 0x38u) << 2u) + byteX;
}

static uint32_t screenBankOffset(void) {
  return ramBankOffset(sp128UseShadowScreen != 0u ? 7u : 5u);
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

static void writeMappedMemory(uint32_t address, uint32_t value, uint32_t recordEvent) {
  const uint32_t maskedAddress = address & 0xffffu;
  const uint8_t byteValue = (uint8_t)value;
  if (recordEvent != 0u) {
    sp128LastMemoryAddress = (uint16_t)maskedAddress;
    sp128LastMemoryValue = byteValue;
    sp128LastMemoryIsWrite = 1u;
    sp128HasMemoryEvent = 1u;
  }
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

static uint32_t currentFrameTact(void) {
  return sp128Tacts % SP128_TACTS_PER_FRAME;
}

static uint8_t isContendedMemoryAddress(uint32_t address) {
  const uint32_t page = address & 0xc000u;
  return page == 0x4000u || (page == 0xc000u && (sp128SelectedBank & 0x01u) != 0u);
}

static uint8_t isContendedIoAddress(uint32_t address) {
  return isContendedMemoryAddress(address);
}

static uint8_t sp128CpuReadMemory(uint32_t address) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  const uint8_t value = readMappedMemory(maskedAddress);
  sp128LastMemoryAddress = maskedAddress;
  sp128LastMemoryValue = value;
  sp128LastMemoryIsWrite = 0u;
  sp128HasMemoryEvent = 1u;
  return value;
}

static void sp128CpuWriteMemory(uint32_t address, uint32_t value) {
  writeMappedMemory(address, value, 1u);
}

static void sp128CpuPokeMemory(uint32_t address, uint32_t value) {
  writeMappedMemory(address, value, 0u);
}

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() sp128Memory
#define Z80_READ_MEMORY(address) sp128CpuReadMemory((uint32_t)(address))
#define Z80_WRITE_MEMORY(address, value) sp128CpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_POKE_MEMORY(address, value) sp128CpuPokeMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_READ_PORT(address) ((uint8_t)sp128ReadPort((uint32_t)(address)))
#define Z80_WRITE_PORT(address, value) sp128WritePort((uint32_t)(address), (uint32_t)(value))
#define Z80_TACT_PLUS_N(value) tactPlusN128((uint32_t)(value))
#define Z80_DELAY_MEMORY_READ(address) sp128DelayMemoryAccess((uint32_t)(address))
#define Z80_DELAY_MEMORY_WRITE(address) sp128DelayMemoryAccess((uint32_t)(address))
#define Z80_DELAY_PORT_READ(address) sp128DelayPortAccess((uint32_t)(address))
#define Z80_DELAY_PORT_WRITE(address) sp128DelayPortAccess((uint32_t)(address))
#include "../../../../zxSpectrum48/wasm/v2/z80/z80.c"
#undef Z80_EXTERNAL_BUS
#undef Z80_MEMORY_PTR
#undef Z80_READ_MEMORY
#undef Z80_WRITE_MEMORY
#undef Z80_POKE_MEMORY
#undef Z80_READ_PORT
#undef Z80_WRITE_PORT
#undef Z80_TACT_PLUS_N
#undef Z80_DELAY_MEMORY_READ
#undef Z80_DELAY_MEMORY_WRITE
#undef Z80_DELAY_PORT_READ
#undef Z80_DELAY_PORT_WRITE

static void tactPlusN128(uint32_t value) {
  cpu.tacts += value;
  sp128Tacts += value;
}

static void applyContentionDelay(void) {
  const uint32_t delay = sp128Contention[currentFrameTact()];
  cpu.tacts += delay;
  sp128Tacts += delay;
  sp128TotalContentionDelaySinceStart += delay;
  sp128ContentionDelaySincePause += delay;
}

static void sp128DelayMemoryAccess(uint32_t address) {
  if (isContendedMemoryAddress(address) != 0u) {
    applyContentionDelay();
  }
  tactPlusN128(3u);
}

static void sp128DelayPortAccess(uint32_t address) {
  const uint8_t lowBit = (address & 0x0001u) != 0u ? 1u : 0u;

  if (isContendedIoAddress(address) != 0u) {
    if (lowBit != 0u) {
      applyContentionDelay();
      tactPlusN128(1u);
      applyContentionDelay();
      tactPlusN128(1u);
      applyContentionDelay();
      tactPlusN128(1u);
      applyContentionDelay();
      tactPlusN128(1u);
    } else {
      applyContentionDelay();
      tactPlusN128(1u);
      applyContentionDelay();
      tactPlusN128(3u);
    }
  } else if (lowBit != 0u) {
    tactPlusN128(4u);
  } else {
    tactPlusN128(1u);
    applyContentionDelay();
    tactPlusN128(3u);
  }
}

void sp128Reset(void) {
  z80Reset();
  sp128Frames = 0u;
  sp128Tacts = 0u;
  sp128AudioSampleCount = 0u;
  sp128SelectedRom = 0u;
  sp128SelectedBank = 0u;
  sp128PagingEnabled = 1u;
  sp128UseShadowScreen = 0u;
  sp128PortFeValue = 0u;
  sp128BorderColor = 7u;
  sp128EarBit = 0u;
  sp128MicBit = 0u;
  sp128BeeperLevel = 0u;
  sp128DiagnosticFlags = 0u;
  sp128TotalContentionDelaySinceStart = 0u;
  sp128ContentionDelaySincePause = 0u;
  sp128CpuInstructionsExecuted = 0u;
  sp128CpuFrameSliceInstructions = 0u;
  sp128HasMemoryEvent = 0u;
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
  z80SetTacts(sp128Tacts);
  sp128Frames++;
  sp128AudioSampleCount = 0u;
  sp128CpuFrameSliceInstructions = 0u;
  return 0u;
}

uint32_t sp128ExecuteInstruction(void) {
  sp128HasMemoryEvent = 0u;
  z80ClearBusEvents();
  z80SetTacts(sp128Tacts);
  z80ExecuteCpuCycle();
  sp128Tacts = z80GetTacts();
  sp128CpuInstructionsExecuted++;
  sp128CpuFrameSliceInstructions++;
  return 0u;
}

void sp128RenderInstantScreen(void) {
  const uint32_t borderPixel = sp128SpectrumColors[sp128BorderColor & 0x07u];
  for (uint32_t i = 0u; i < SP128_PIXEL_BUFFER_WORDS; i++) {
    sp128PixelBuffer[i] = borderPixel;
  }

  const uint32_t bankOffset = screenBankOffset();
  for (uint32_t y = 0u; y < SP128_DISPLAY_HEIGHT; y++) {
    for (uint32_t byteX = 0u; byteX < 32u; byteX++) {
      const uint8_t pixelByte = sp128Ram[bankOffset + screenMemoryOffset(y, byteX)];
      const uint8_t attr = sp128Ram[bankOffset + 0x1800u + ((y >> 3u) * 32u) + byteX];
      for (uint32_t bit = 0u; bit < 8u; bit++) {
        const uint32_t pixelSet = pixelByte & (0x80u >> bit);
        const uint32_t screenX = SP128_DISPLAY_LEFT + (byteX * 8u) + bit;
        const uint32_t screenY = SP128_DISPLAY_TOP + y;
        sp128PixelBuffer[(screenY * SP128_SCREEN_WIDTH) + screenX] = getUlaPixelColor(pixelSet, attr);
      }
    }
  }
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
  writeMappedMemory(address, value, 1u);
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

void sp128SetKeyStatus(uint32_t key, uint32_t down) {
  if (key >= 40u) {
    return;
  }

  const uint32_t line = key / 5u;
  const uint8_t mask = (uint8_t)(1u << (key % 5u));
  if (down != 0u) {
    sp128KeyboardLines[line] = (uint8_t)((sp128KeyboardLines[line] | mask) & 0x1fu);
  } else {
    sp128KeyboardLines[line] = (uint8_t)(sp128KeyboardLines[line] & (uint8_t)~mask & 0x1fu);
  }
}

uint32_t sp128ReadPort(uint32_t address) {
  if ((address & 0x0001u) == 0u) {
    uint8_t status = 0u;
    const uint32_t selectedLines = (~(address >> 8u)) & 0xffu;
    for (uint32_t line = 0u; line < SP128_KEYBOARD_LINE_COUNT; line++) {
      if ((selectedLines & (1u << line)) != 0u) {
        status |= sp128KeyboardLines[line];
      }
    }
    const uint32_t keyboardValue = ((uint32_t)~status) & 0xffu;
    const uint32_t earValue = sp128EarBit != 0u ? 0x40u : 0x00u;
    return (keyboardValue & 0xbfu) | earValue;
  }
  return 0xffu;
}

void sp128WritePort(uint32_t address, uint32_t value) {
  if ((address & 0x0001u) == 0u) {
    sp128PortFeValue = (uint8_t)value;
    sp128BorderColor = (uint8_t)(value & 0x07u);
    sp128MicBit = (value & 0x08u) != 0u ? 1u : 0u;
    sp128EarBit = (value & 0x10u) != 0u ? 1u : 0u;
    sp128BeeperLevel = (uint8_t)((sp128MicBit != 0u ? 1u : 0u) | (sp128EarBit != 0u ? 2u : 0u));
    return;
  }

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

void sp128DelayAddressBusAccess(uint32_t address) {
  if (isContendedMemoryAddress(address) != 0u) {
    applyContentionDelay();
  }
}

void sp128DelayPortRead(uint32_t address) {
  sp128DelayPortAccess(address);
}

void sp128DelayPortWrite(uint32_t address) {
  sp128DelayPortAccess(address);
}

void sp128ResetContentionCounters(void) {
  sp128TotalContentionDelaySinceStart = 0u;
  sp128ContentionDelaySincePause = 0u;
}

void sp128SetContentionValue(uint32_t tact, uint32_t value) {
  if (tact < SP128_TACTS_PER_FRAME) {
    sp128Contention[tact] = (uint8_t)value;
  }
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

void sp128SetTacts(uint32_t value) {
  sp128Tacts = value;
  z80SetTacts(value);
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

uint32_t sp128GetContentionValue(uint32_t tact) {
  return tact < SP128_TACTS_PER_FRAME ? sp128Contention[tact] : 0u;
}

uint32_t sp128GetTotalContentionDelaySinceStart(void) {
  return sp128TotalContentionDelaySinceStart;
}

uint32_t sp128GetContentionDelaySincePause(void) {
  return sp128ContentionDelaySincePause;
}

uint32_t sp128GetCpuInstructionsExecuted(void) {
  return sp128CpuInstructionsExecuted;
}

uint32_t sp128GetCpuFrameSliceInstructions(void) {
  return sp128CpuFrameSliceInstructions;
}

uint32_t sp128GetCpuTacts(void) {
  return z80GetTacts();
}

uint32_t sp128GetCpuAf(void) {
  return z80GetAf();
}

void sp128SetCpuAf(uint32_t value) {
  z80SetAf(value);
}

uint32_t sp128GetCpuBc(void) {
  return z80GetBc();
}

void sp128SetCpuBc(uint32_t value) {
  z80SetBc(value);
}

uint32_t sp128GetCpuDe(void) {
  return z80GetDe();
}

void sp128SetCpuDe(uint32_t value) {
  z80SetDe(value);
}

uint32_t sp128GetCpuHl(void) {
  return z80GetHl();
}

void sp128SetCpuHl(uint32_t value) {
  z80SetHl(value);
}

uint32_t sp128GetCpuIx(void) {
  return z80GetIx();
}

void sp128SetCpuIx(uint32_t value) {
  z80SetIx(value);
}

uint32_t sp128GetCpuIy(void) {
  return z80GetIy();
}

void sp128SetCpuIy(uint32_t value) {
  z80SetIy(value);
}

uint32_t sp128GetCpuPc(void) {
  return z80GetPc();
}

void sp128SetCpuPc(uint32_t value) {
  z80SetPc(value);
}

uint32_t sp128GetCpuSp(void) {
  return z80GetSp();
}

void sp128SetCpuSp(uint32_t value) {
  z80SetSp(value);
}

uint32_t sp128GetCpuHalted(void) {
  return z80GetHalted();
}

uint32_t sp128GetCpuPrefix(void) {
  return z80GetPrefix();
}

uint32_t sp128GetLastMemoryAddress(void) {
  return sp128HasMemoryEvent != 0u ? sp128LastMemoryAddress : 0u;
}

uint32_t sp128GetLastMemoryValue(void) {
  return sp128HasMemoryEvent != 0u ? sp128LastMemoryValue : 0u;
}

uint32_t sp128GetLastMemoryIsWrite(void) {
  return sp128HasMemoryEvent != 0u ? sp128LastMemoryIsWrite : 0u;
}

uint32_t sp128GetLastPortAddress(void) {
  return z80GetLastPortAddress();
}

uint32_t sp128GetLastPortValue(void) {
  return z80GetLastPortValue();
}

uint32_t sp128GetLastPortIsWrite(void) {
  return z80GetLastPortIsWrite();
}

uint32_t sp128GetKeyboardLine(uint32_t line) {
  return sp128KeyboardLines[line & 0x07u];
}

uint32_t sp128GetPortFeValue(void) {
  return sp128PortFeValue;
}

uint32_t sp128GetBorderColor(void) {
  return sp128BorderColor;
}

uint32_t sp128GetEarBit(void) {
  return sp128EarBit;
}

uint32_t sp128GetMicBit(void) {
  return sp128MicBit;
}

uint32_t sp128GetBeeperLevel(void) {
  return sp128BeeperLevel;
}

uint32_t sp128GetDiagnosticFlags(void) {
  return sp128DiagnosticFlags;
}
