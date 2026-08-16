#include <stdint.h>

#define ZXNEXT_FLAT_MEMORY_SIZE 0x10000u
#define ZXNEXT_SRAM_CAPACITY (4u * 1024u * 1024u)
#define ZXNEXT_ROM_SIZE 0x20000u
#define ZXNEXT_PAGE_SIZE 0x2000u
#define ZXNEXT_PAGE_COUNT 8u
#define ZXNEXT_INVALID_PAGE_OFFSET 0xffffffffu
#define ZXNEXT_NEXT_ROM_OFFSET 0x00000u
#define ZXNEXT_DIVMMC_ROM_OFFSET 0x10000u
#define ZXNEXT_MULTIFACE_ROM_OFFSET 0x14000u
#define ZXNEXT_ALT_ROM_OFFSET 0x18000u
#define ZXNEXT_DIVMMC_RAM_OFFSET 0x20000u
#define ZXNEXT_NEXT_RAM_OFFSET 0x40000u
#define ZXNEXT_NEXT_ROM_SIZE 0x10000u
#define ZXNEXT_SMALL_ROM_SIZE 0x4000u
#define ZXNEXT_ALT_ROM_SIZE 0x8000u
#define ZXNEXT_DIVMMC_RAM_SIZE 0x20000u
#define ZXNEXT_SENTINEL_SIZE ZXNEXT_PAGE_SIZE
#define ZXNEXT_DEFAULT_MEMORY_SIZE_KB 2048u
#define ZXNEXT_DEFAULT_MAIN_RAM_PAGES 224u
#define ZXNEXT_MAX_MAIN_RAM_PAGES 480u
#define ZXNEXT_KEYBOARD_ROW_COUNT 8u
#define ZXNEXT_NEXTREG_COUNT 256u
#define ZXNEXT_SCREEN_WIDTH 720u
#define ZXNEXT_SCREEN_HEIGHT 288u
#define ZXNEXT_AUDIO_SAMPLE_CAPACITY 4096u
#define ZXNEXT_SD_COMMAND_BUFFER_SIZE 32u
#define ZXNEXT_SD_RESPONSE_BUFFER_SIZE 512u
#define ZXNEXT_DIAGNOSTIC_BUFFER_SIZE 64u

static uint8_t flatMemory[ZXNEXT_FLAT_MEMORY_SIZE];
static uint8_t sram[ZXNEXT_SRAM_CAPACITY];
static uint8_t rom[ZXNEXT_ROM_SIZE];
static uint8_t keyboardRows[ZXNEXT_KEYBOARD_ROW_COUNT];
static uint8_t nextRegs[ZXNEXT_NEXTREG_COUNT];
static uint32_t pixelBuffer[ZXNEXT_SCREEN_WIDTH * ZXNEXT_SCREEN_HEIGHT];
static int16_t audioSamples[ZXNEXT_AUDIO_SAMPLE_CAPACITY * 2u];
static uint8_t sdCommandBuffer[ZXNEXT_SD_COMMAND_BUFFER_SIZE];
static uint8_t sdResponseBuffer[ZXNEXT_SD_RESPONSE_BUFFER_SIZE];
static uint32_t diagnosticBuffer[ZXNEXT_DIAGNOSTIC_BUFFER_SIZE];
static uint8_t mmuRegs[ZXNEXT_PAGE_COUNT];
static uint32_t pageReadOffset[ZXNEXT_PAGE_COUNT];
static uint32_t pageWriteOffset[ZXNEXT_PAGE_COUNT];
static uint32_t pageBank16k[ZXNEXT_PAGE_COUNT];
static uint32_t pageBank8k[ZXNEXT_PAGE_COUNT];

static uint32_t frames = 0;
static uint32_t tacts = 0;
static uint32_t hardResetCount = 0;
static uint32_t resetCount = 0;
static uint32_t romUploadCount = 0;
static uint32_t uploadedRomMask = 0;
static uint32_t cpuInstructionsExecuted = 0;
static uint16_t cpuPc = 0;
static uint16_t cpuSp = 0xffffu;
static uint16_t lastMemoryAddress = 0;
static uint8_t lastMemoryValue = 0;
static uint8_t lastMemoryIsWrite = 0;
static uint8_t hasMemoryEvent = 0;
static uint16_t lastPortAddress = 0;
static uint8_t lastPortValue = 0xffu;
static uint8_t lastPortIsWrite = 0;
static uint8_t hasPortEvent = 0;
static uint8_t portReadValue = 0xffu;
static uint8_t lastTbBlueAddress = 0;
static uint8_t lastTbBlueValue = 0;
static uint8_t hasTbBlueEvent = 0;
static uint8_t captureBusEvents = 1;
static uint8_t pagingEnabled = 1;
static uint8_t useShadowScreen = 0;
static uint8_t allRamMode = 0;
static uint8_t wasInAllRamMode = 0;
static uint8_t specialConfig = 0;
static uint8_t selectedRomLsb = 0;
static uint8_t selectedRomMsb = 0;
static uint8_t selectedBankLsb = 0;
static uint8_t selectedBankMsb = 0;
static uint8_t portEff7Value = 0;
static uint32_t configuredMemorySizeKb = ZXNEXT_DEFAULT_MEMORY_SIZE_KB;
static uint32_t activeMainRamPages = ZXNEXT_DEFAULT_MAIN_RAM_PAGES;

uint32_t zxnextReadPort(uint32_t address);
void zxnextWritePort(uint32_t address, uint32_t value);
uint32_t zxnextReadMemory(uint32_t address);
void zxnextWriteMemory(uint32_t address, uint32_t value);
void zxnextWritePhysical(uint32_t offset, uint32_t value);
static uint8_t zxnextCpuReadMemory(uint32_t address);
static void zxnextCpuWriteMemory(uint32_t address, uint32_t value);
static void zxnextCpuPokeMemory(uint32_t address, uint32_t value);
static void tactPlusNNext(uint32_t value);
static void importZ80BusEvents(void);
static uint32_t activeMemorySize(void);
static void clearRuntimeState(void);
static void clearMutablePhysicalMemory(void);
static void resetMmuLayout(void);
static void updateMemoryConfig(uint32_t fromPort);
static void rebuildFlatMemory(void);
static void updateFlatMemoryForPhysicalOffset(uint32_t physicalOffset);
static void setRomSlot(uint32_t slot, uint32_t romPage, uint32_t pageOffset);
static void setRamSlotByMmu(uint32_t slot, uint32_t bank8k);
static void setAllRam16kSlot(uint32_t slot16k, uint32_t bank16k);
static void setNormalSlotByMmu(uint32_t slot);
static void writeNextRegInternal(uint32_t reg, uint32_t value);
static uint32_t readPhysical(uint32_t offset);

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() flatMemory
#define Z80_READ_MEMORY(address) zxnextCpuReadMemory((uint32_t)(address))
#define Z80_WRITE_MEMORY(address, value) zxnextCpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_POKE_MEMORY(address, value) zxnextCpuPokeMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_READ_PORT(address) ((uint8_t)zxnextReadPort((uint32_t)(address)))
#define Z80_WRITE_PORT(address, value) zxnextWritePort((uint32_t)(address), (uint32_t)(value))
#define Z80_CAPTURE_BUS_EVENTS() captureBusEvents
#define Z80_TACT_PLUS_N(value) tactPlusNNext((uint32_t)(value))
#include "../../../../z80/wasm/z80.c"
#undef Z80_EXTERNAL_BUS
#undef Z80_MEMORY_PTR
#undef Z80_READ_MEMORY
#undef Z80_WRITE_MEMORY
#undef Z80_POKE_MEMORY
#undef Z80_READ_PORT
#undef Z80_WRITE_PORT
#undef Z80_CAPTURE_BUS_EVENTS
#undef Z80_TACT_PLUS_N

static uint32_t activeMemorySize(void) {
  return ZXNEXT_NEXT_RAM_OFFSET + activeMainRamPages * ZXNEXT_PAGE_SIZE;
}

static void clearRuntimeState(void) {
  for (uint32_t i = 0; i < ZXNEXT_KEYBOARD_ROW_COUNT; i++) keyboardRows[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_NEXTREG_COUNT; i++) nextRegs[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_SCREEN_WIDTH * ZXNEXT_SCREEN_HEIGHT; i++) pixelBuffer[i] = 0xff000000u;
  for (uint32_t i = 0; i < ZXNEXT_AUDIO_SAMPLE_CAPACITY * 2u; i++) audioSamples[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_SD_COMMAND_BUFFER_SIZE; i++) sdCommandBuffer[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_SD_RESPONSE_BUFFER_SIZE; i++) sdResponseBuffer[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_DIAGNOSTIC_BUFFER_SIZE; i++) diagnosticBuffer[i] = 0;
  frames = 0;
  tacts = 0;
  cpuInstructionsExecuted = 0;
  cpuPc = 0;
  cpuSp = 0xffffu;
  hasMemoryEvent = 0;
  lastMemoryAddress = 0;
  lastMemoryValue = 0;
  lastMemoryIsWrite = 0;
  hasPortEvent = 0;
  lastPortAddress = 0;
  lastPortValue = 0xffu;
  lastPortIsWrite = 0;
  hasTbBlueEvent = 0;
  lastTbBlueAddress = 0;
  lastTbBlueValue = 0;
  captureBusEvents = 1;
}

static void clearMutablePhysicalMemory(void) {
  const uint32_t end = activeMemorySize();
  for (uint32_t i = ZXNEXT_DIVMMC_RAM_OFFSET; i < end && i < ZXNEXT_SRAM_CAPACITY; i++) {
    sram[i] = 0;
  }
}

static uint32_t romBaseForKind(uint32_t kind) {
  switch (kind) {
    case 0: return ZXNEXT_NEXT_ROM_OFFSET;
    case 1: return ZXNEXT_DIVMMC_ROM_OFFSET;
    case 2: return ZXNEXT_MULTIFACE_ROM_OFFSET;
    case 3: return ZXNEXT_ALT_ROM_OFFSET;
    default: return ZXNEXT_ROM_SIZE;
  }
}

static uint32_t romLimitForKind(uint32_t kind) {
  switch (kind) {
    case 0: return ZXNEXT_NEXT_ROM_SIZE;
    case 1: return ZXNEXT_SMALL_ROM_SIZE;
    case 2: return ZXNEXT_SMALL_ROM_SIZE;
    case 3: return ZXNEXT_ALT_ROM_SIZE;
    default: return 0;
  }
}

static uint32_t readPhysical(uint32_t offset) {
  if (offset < ZXNEXT_ROM_SIZE) return rom[offset];
  if (offset < activeMemorySize() && offset < ZXNEXT_SRAM_CAPACITY) return sram[offset];
  if (offset >= activeMemorySize() && offset < activeMemorySize() + ZXNEXT_SENTINEL_SIZE) return 0x7eu;
  return 0xffu;
}

void zxnextWritePhysical(uint32_t offset, uint32_t value) {
  if (offset >= ZXNEXT_DIVMMC_RAM_OFFSET && offset < activeMemorySize() && offset < ZXNEXT_SRAM_CAPACITY) {
    sram[offset] = (uint8_t)(value & 0xffu);
    updateFlatMemoryForPhysicalOffset(offset);
  }
}

static void setRomSlot(uint32_t slot, uint32_t romPage, uint32_t pageOffset) {
  if (slot >= ZXNEXT_PAGE_COUNT) return;
  const uint32_t base = ZXNEXT_NEXT_ROM_OFFSET + (romPage & 0x03u) * 0x4000u + pageOffset;
  pageReadOffset[slot] = base;
  pageWriteOffset[slot] = ZXNEXT_INVALID_PAGE_OFFSET;
  pageBank8k[slot] = 0xffu;
  pageBank16k[slot] = 0xffu;
}

static void setRamSlotByMmu(uint32_t slot, uint32_t bank8k) {
  if (slot >= ZXNEXT_PAGE_COUNT) return;
  mmuRegs[slot] = (uint8_t)(bank8k & 0xffu);
  pageBank8k[slot] = bank8k & 0xffu;
  pageBank16k[slot] = (bank8k & 0xffu) >> 1u;
  if (bank8k >= activeMainRamPages) {
    pageReadOffset[slot] = activeMemorySize();
    pageWriteOffset[slot] = ZXNEXT_INVALID_PAGE_OFFSET;
    return;
  }
  pageReadOffset[slot] = ZXNEXT_NEXT_RAM_OFFSET + bank8k * ZXNEXT_PAGE_SIZE;
  pageWriteOffset[slot] = pageReadOffset[slot];
}

static void setNormalSlotByMmu(uint32_t slot) {
  if (slot >= ZXNEXT_PAGE_COUNT) return;
  const uint32_t bank8k = mmuRegs[slot];
  if (bank8k >= 224u) {
    setRomSlot(slot, selectedRomMsb | selectedRomLsb, (slot & 0x01u) * ZXNEXT_PAGE_SIZE);
    return;
  }
  setRamSlotByMmu(slot, bank8k);
}

static void setAllRam16kSlot(uint32_t slot16k, uint32_t bank16k) {
  const uint32_t firstPage = slot16k * 2u;
  uint32_t bank8k = bank16k * 2u;
  if (firstPage >= ZXNEXT_PAGE_COUNT) return;

  pageBank8k[firstPage] = bank8k;
  pageBank16k[firstPage] = bank16k;
  if (bank8k >= activeMainRamPages) {
    pageReadOffset[firstPage] = activeMemorySize();
    pageWriteOffset[firstPage] = ZXNEXT_INVALID_PAGE_OFFSET;
  } else {
    pageReadOffset[firstPage] = ZXNEXT_NEXT_RAM_OFFSET + bank8k * ZXNEXT_PAGE_SIZE;
    pageWriteOffset[firstPage] = pageReadOffset[firstPage];
  }

  bank8k++;
  pageBank8k[firstPage + 1u] = bank8k;
  pageBank16k[firstPage + 1u] = bank16k;
  if (bank8k >= activeMainRamPages) {
    pageReadOffset[firstPage + 1u] = activeMemorySize();
    pageWriteOffset[firstPage + 1u] = ZXNEXT_INVALID_PAGE_OFFSET;
  } else {
    pageReadOffset[firstPage + 1u] = ZXNEXT_NEXT_RAM_OFFSET + bank8k * ZXNEXT_PAGE_SIZE;
    pageWriteOffset[firstPage + 1u] = pageReadOffset[firstPage + 1u];
  }
}

static void updateMemoryConfig(uint32_t fromPort) {
  if (allRamMode != 0u) {
    wasInAllRamMode = 1u;
    switch (specialConfig & 0x03u) {
      case 0:
        setAllRam16kSlot(0, 0);
        setAllRam16kSlot(1, 1);
        setAllRam16kSlot(2, 2);
        setAllRam16kSlot(3, 3);
        break;
      case 1:
        setAllRam16kSlot(0, 4);
        setAllRam16kSlot(1, 5);
        setAllRam16kSlot(2, 6);
        setAllRam16kSlot(3, 7);
        break;
      case 2:
        setAllRam16kSlot(0, 4);
        setAllRam16kSlot(1, 5);
        setAllRam16kSlot(2, 6);
        setAllRam16kSlot(3, 3);
        break;
      case 3:
        setAllRam16kSlot(0, 4);
        setAllRam16kSlot(1, 7);
        setAllRam16kSlot(2, 6);
        setAllRam16kSlot(3, 3);
        break;
    }
    rebuildFlatMemory();
    return;
  }

  if (wasInAllRamMode != 0u) {
    const uint32_t eff7Bank0 = (portEff7Value & 0x08u) != 0u;
    mmuRegs[0] = eff7Bank0 ? 0x00u : 0xffu;
    mmuRegs[1] = eff7Bank0 ? 0x01u : 0xffu;
    mmuRegs[2] = 0x0au;
    mmuRegs[3] = 0x0bu;
    mmuRegs[4] = 0x04u;
    mmuRegs[5] = 0x05u;
    const uint32_t bank6 = selectedBankMsb * 16u + selectedBankLsb * 2u;
    mmuRegs[6] = (uint8_t)(bank6 & 0xffu);
    mmuRegs[7] = (uint8_t)((bank6 + 1u) & 0xffu);
    wasInAllRamMode = 0u;
  }

  if (fromPort != 0u) {
    const uint32_t eff7Bank0 = (portEff7Value & 0x08u) != 0u;
    mmuRegs[0] = eff7Bank0 ? 0x00u : 0xffu;
    mmuRegs[1] = eff7Bank0 ? 0x01u : 0xffu;
  }

  for (uint32_t slot = 0; slot < ZXNEXT_PAGE_COUNT; slot++) {
    setNormalSlotByMmu(slot);
  }
  rebuildFlatMemory();
}

static void rebuildFlatMemory(void) {
  for (uint32_t page = 0; page < ZXNEXT_PAGE_COUNT; page++) {
    const uint32_t base = page * ZXNEXT_PAGE_SIZE;
    for (uint32_t offset = 0; offset < ZXNEXT_PAGE_SIZE; offset++) {
      flatMemory[base + offset] = (uint8_t)readPhysical(pageReadOffset[page] + offset);
    }
  }
}

static void updateFlatMemoryForPhysicalOffset(uint32_t physicalOffset) {
  for (uint32_t page = 0; page < ZXNEXT_PAGE_COUNT; page++) {
    const uint32_t readOffset = pageReadOffset[page];
    if (physicalOffset >= readOffset && physicalOffset < readOffset + ZXNEXT_PAGE_SIZE) {
      const uint32_t flatOffset = page * ZXNEXT_PAGE_SIZE + physicalOffset - readOffset;
      flatMemory[flatOffset] = (uint8_t)readPhysical(physicalOffset);
    }
  }
}

static void resetMmuLayout(void) {
  pagingEnabled = 1u;
  useShadowScreen = 0u;
  allRamMode = 0u;
  wasInAllRamMode = 1u;
  specialConfig = 0u;
  selectedRomLsb = 0u;
  selectedRomMsb = 0u;
  selectedBankLsb = 0u;
  selectedBankMsb = 0u;
  portEff7Value = 0u;
  mmuRegs[0] = 0xffu;
  mmuRegs[1] = 0xffu;
  mmuRegs[2] = 0x0au;
  mmuRegs[3] = 0x0bu;
  mmuRegs[4] = 0x04u;
  mmuRegs[5] = 0x05u;
  mmuRegs[6] = 0x00u;
  mmuRegs[7] = 0x01u;
  updateMemoryConfig(0);
}

uint32_t zxnextMemoryPtr(void) { return (uint32_t)(uintptr_t)flatMemory; }
uint32_t zxnextSramPtr(void) { return (uint32_t)(uintptr_t)sram; }
uint32_t zxnextRomPtr(void) { return (uint32_t)(uintptr_t)rom; }
uint32_t zxnextKeyboardRowsPtr(void) { return (uint32_t)(uintptr_t)keyboardRows; }
uint32_t zxnextNextRegsPtr(void) { return (uint32_t)(uintptr_t)nextRegs; }
uint32_t zxnextPixelBufferPtr(void) { return (uint32_t)(uintptr_t)pixelBuffer; }
uint32_t zxnextAudioSamplesPtr(void) { return (uint32_t)(uintptr_t)audioSamples; }
uint32_t zxnextSdCommandBufferPtr(void) { return (uint32_t)(uintptr_t)sdCommandBuffer; }
uint32_t zxnextSdResponseBufferPtr(void) { return (uint32_t)(uintptr_t)sdResponseBuffer; }
uint32_t zxnextDiagnosticBufferPtr(void) { return (uint32_t)(uintptr_t)diagnosticBuffer; }

void zxnextHardReset(void) {
  hardResetCount++;
  resetCount++;
  clearRuntimeState();
  clearMutablePhysicalMemory();
  resetMmuLayout();
  z80Reset();
  z80SetZ80NMode(1);
  z80SetSp(cpuSp);
}

void zxnextReset(void) {
  resetCount++;
  clearRuntimeState();
  resetMmuLayout();
  z80Reset();
  z80SetZ80NMode(1);
  z80SetSp(cpuSp);
}

uint32_t zxnextExecuteInstruction(void) {
  hasMemoryEvent = 0;
  z80ClearBusEvents();
  z80SetTacts(tacts);
  do {
    z80ExecuteCpuCycle();
  } while (z80GetPrefix() != 0u);
  tacts = z80GetTacts();
  cpuPc = (uint16_t)z80GetPc();
  cpuSp = (uint16_t)z80GetSp();
  cpuInstructionsExecuted++;
  importZ80BusEvents();
  return 0;
}

uint32_t zxnextUploadRomByte(uint32_t kind, uint32_t offset, uint32_t value) {
  const uint32_t limit = romLimitForKind(kind);
  if (offset >= limit) return 0;
  const uint32_t base = romBaseForKind(kind);
  if (base >= ZXNEXT_ROM_SIZE || base + offset >= ZXNEXT_ROM_SIZE) return 0;
  rom[base + offset] = (uint8_t)(value & 0xffu);
  updateFlatMemoryForPhysicalOffset(base + offset);
  romUploadCount++;
  uploadedRomMask |= 1u << kind;
  return 1;
}

uint32_t zxnextReadRomByte(uint32_t kind, uint32_t offset) {
  const uint32_t limit = romLimitForKind(kind);
  if (offset >= limit) return 0xffu;
  const uint32_t base = romBaseForKind(kind);
  if (base >= ZXNEXT_ROM_SIZE || base + offset >= ZXNEXT_ROM_SIZE) return 0xffu;
  return rom[base + offset];
}

uint32_t zxnextReadMemory(uint32_t address) {
  const uint32_t maskedAddress = address & 0xffffu;
  const uint32_t page = maskedAddress >> 13u;
  const uint32_t offset = maskedAddress & 0x1fffu;
  return readPhysical(pageReadOffset[page] + offset);
}

void zxnextWriteMemory(uint32_t address, uint32_t value) {
  const uint32_t maskedAddress = address & 0xffffu;
  const uint32_t page = maskedAddress >> 13u;
  const uint32_t offset = maskedAddress & 0x1fffu;
  const uint32_t physicalOffset = pageWriteOffset[page];
  if (physicalOffset == ZXNEXT_INVALID_PAGE_OFFSET) return;
  zxnextWritePhysical(physicalOffset + offset, value);
  flatMemory[maskedAddress] = (uint8_t)(value & 0xffu);
}

uint32_t zxnextReadPort(uint32_t address) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  if (captureBusEvents != 0u) {
    lastPortAddress = maskedAddress;
    lastPortValue = portReadValue;
    lastPortIsWrite = 0u;
    hasPortEvent = 1u;
  }
  return portReadValue;
}

void zxnextWritePort(uint32_t address, uint32_t value) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  if (captureBusEvents != 0u) {
    lastPortAddress = maskedAddress;
    lastPortValue = byteValue;
    lastPortIsWrite = 1u;
    hasPortEvent = 1u;
  }
  if ((maskedAddress & 0xc003u) == 0x4001u) {
    if (pagingEnabled == 0u) return;
    selectedBankLsb = byteValue & 0x07u;
    const uint32_t bank6 = selectedBankMsb * 16u + selectedBankLsb * 2u;
    mmuRegs[6] = (uint8_t)(bank6 & 0xffu);
    mmuRegs[7] = (uint8_t)((bank6 + 1u) & 0xffu);
    useShadowScreen = (byteValue & 0x08u) != 0u;
    selectedRomLsb = (byteValue >> 4u) & 0x01u;
    pagingEnabled = (byteValue & 0x20u) == 0u;
    updateMemoryConfig(1);
    return;
  }
  if ((maskedAddress & 0xf003u) == 0xd001u) {
    if (pagingEnabled == 0u) return;
    selectedBankMsb = byteValue & 0x0fu;
    const uint32_t bank6 = selectedBankMsb * 16u + selectedBankLsb * 2u;
    mmuRegs[6] = (uint8_t)(bank6 & 0xffu);
    mmuRegs[7] = (uint8_t)((bank6 + 1u) & 0xffu);
    updateMemoryConfig(1);
    return;
  }
  if ((maskedAddress & 0xf003u) == 0x1001u) {
    if (pagingEnabled == 0u) return;
    allRamMode = (byteValue & 0x01u) != 0u;
    specialConfig = (byteValue >> 1u) & 0x03u;
    selectedRomMsb = specialConfig & 0x02u;
    updateMemoryConfig(1);
    return;
  }
  if ((maskedAddress & 0xf0ffu) == 0xe0f7u) {
    portEff7Value = byteValue & 0x0cu;
    updateMemoryConfig(1);
    return;
  }
}

void zxnextSetPortReadValue(uint32_t value) {
  portReadValue = (uint8_t)(value & 0xffu);
}

uint32_t zxnextReadNextReg(uint32_t reg) {
  const uint32_t maskedReg = reg & 0xffu;
  if (maskedReg >= 0x50u && maskedReg <= 0x57u) return mmuRegs[maskedReg - 0x50u];
  return nextRegs[maskedReg];
}

void zxnextWriteNextReg(uint32_t reg, uint32_t value) {
  writeNextRegInternal(reg, value);
}

static void writeNextRegInternal(uint32_t reg, uint32_t value) {
  const uint32_t maskedReg = reg & 0xffu;
  nextRegs[maskedReg] = (uint8_t)(value & 0xffu);
  if (maskedReg >= 0x50u && maskedReg <= 0x57u) {
    mmuRegs[maskedReg - 0x50u] = (uint8_t)(value & 0xffu);
    updateMemoryConfig(0);
  }
}

uint32_t zxnextGetFlatMemorySize(void) { return ZXNEXT_FLAT_MEMORY_SIZE; }
uint32_t zxnextGetSramSize(void) { return ZXNEXT_SRAM_CAPACITY; }
uint32_t zxnextGetSramCapacity(void) { return ZXNEXT_SRAM_CAPACITY; }
uint32_t zxnextGetRomSize(void) { return ZXNEXT_ROM_SIZE; }
uint32_t zxnextGetNextRomOffset(void) { return ZXNEXT_NEXT_ROM_OFFSET; }
uint32_t zxnextGetDivMmcRomOffset(void) { return ZXNEXT_DIVMMC_ROM_OFFSET; }
uint32_t zxnextGetMultifaceMemOffset(void) { return ZXNEXT_MULTIFACE_ROM_OFFSET; }
uint32_t zxnextGetAltRomOffset(void) { return ZXNEXT_ALT_ROM_OFFSET; }
uint32_t zxnextGetDivMmcRamOffset(void) { return ZXNEXT_DIVMMC_RAM_OFFSET; }
uint32_t zxnextGetNextRamOffset(void) { return ZXNEXT_NEXT_RAM_OFFSET; }
uint32_t zxnextGetConfiguredMemorySizeKb(void) { return configuredMemorySizeKb; }
uint32_t zxnextGetMainRamPageCount(void) { return activeMainRamPages; }
uint32_t zxnextGetMaxMainRamPageCount(void) { return ZXNEXT_MAX_MAIN_RAM_PAGES; }
uint32_t zxnextGetActiveMainRamSize(void) { return activeMainRamPages * ZXNEXT_PAGE_SIZE; }
uint32_t zxnextGetActiveMemorySize(void) { return activeMemorySize(); }
uint32_t zxnextGetSentinelOffset(void) { return activeMemorySize(); }
uint32_t zxnextGetSentinelSize(void) { return ZXNEXT_SENTINEL_SIZE; }
uint32_t zxnextGetMmuReg(uint32_t index) { return index < ZXNEXT_PAGE_COUNT ? mmuRegs[index] : 0xffu; }
uint32_t zxnextGetPageReadOffset(uint32_t index) {
  return index < ZXNEXT_PAGE_COUNT ? pageReadOffset[index] : ZXNEXT_INVALID_PAGE_OFFSET;
}
uint32_t zxnextGetPageWriteOffset(uint32_t index) {
  return index < ZXNEXT_PAGE_COUNT ? pageWriteOffset[index] : ZXNEXT_INVALID_PAGE_OFFSET;
}
uint32_t zxnextGetPageBank16k(uint32_t index) { return index < ZXNEXT_PAGE_COUNT ? pageBank16k[index] : 0xffu; }
uint32_t zxnextGetPageBank8k(uint32_t index) { return index < ZXNEXT_PAGE_COUNT ? pageBank8k[index] : 0xffu; }
uint32_t zxnextGetCurrentPartition(uint32_t index) { return zxnextGetPageBank16k(index); }
uint32_t zxnextReadPhysical(uint32_t offset) { return readPhysical(offset); }
uint32_t zxnextReadSramPage(uint32_t page, uint32_t offset) {
  if (page >= activeMainRamPages || offset >= ZXNEXT_PAGE_SIZE) return 0x7eu;
  return readPhysical(ZXNEXT_NEXT_RAM_OFFSET + page * ZXNEXT_PAGE_SIZE + offset);
}
void zxnextWriteSramPage(uint32_t page, uint32_t offset, uint32_t value) {
  if (page >= activeMainRamPages || offset >= ZXNEXT_PAGE_SIZE) return;
  zxnextWritePhysical(ZXNEXT_NEXT_RAM_OFFSET + page * ZXNEXT_PAGE_SIZE + offset, value);
}
uint32_t zxnextConfigureMemorySize(uint32_t memorySizeKb) {
  uint32_t pages = 0;
  switch (memorySizeKb) {
    case 512: pages = 32u; break;
    case 1024: pages = 96u; break;
    case 1536: pages = 160u; break;
    case 2048: pages = 224u; break;
    case 4096: pages = 480u; break;
    default: return 0u;
  }
  configuredMemorySizeKb = memorySizeKb;
  activeMainRamPages = pages;
  resetMmuLayout();
  return 1u;
}
void zxnextSetMmuReg(uint32_t index, uint32_t value) {
  if (index >= ZXNEXT_PAGE_COUNT) return;
  mmuRegs[index] = (uint8_t)(value & 0xffu);
  updateMemoryConfig(0);
}
uint32_t zxnextGetPort7ffdValue(void) {
  return selectedBankLsb | (useShadowScreen ? 0x08u : 0x00u) | (selectedRomLsb << 4u) | (pagingEnabled ? 0x00u : 0x20u);
}
uint32_t zxnextGetPortDffdValue(void) { return selectedBankMsb; }
uint32_t zxnextGetPort1ffdValue(void) { return (allRamMode ? 0x01u : 0x00u) | (specialConfig << 1u); }
uint32_t zxnextGetPortEff7Value(void) { return portEff7Value; }
uint32_t zxnextGetSelectedRomPage(void) { return selectedRomMsb | selectedRomLsb; }
uint32_t zxnextGetSelectedRamBank(void) { return selectedBankMsb | selectedBankLsb; }
uint32_t zxnextGetSelectedBankLsb(void) { return selectedBankLsb; }
uint32_t zxnextGetSelectedBankMsb(void) { return selectedBankMsb; }
uint32_t zxnextGetPagingEnabled(void) { return pagingEnabled; }
uint32_t zxnextGetAllRamMode(void) { return allRamMode; }
uint32_t zxnextGetSpecialConfig(void) { return specialConfig; }
uint32_t zxnextGetUseShadowScreen(void) { return useShadowScreen; }
uint32_t zxnextGetKeyboardRowCount(void) { return ZXNEXT_KEYBOARD_ROW_COUNT; }
uint32_t zxnextGetNextRegCount(void) { return ZXNEXT_NEXTREG_COUNT; }
uint32_t zxnextGetScreenWidth(void) { return ZXNEXT_SCREEN_WIDTH; }
uint32_t zxnextGetScreenHeight(void) { return ZXNEXT_SCREEN_HEIGHT; }
uint32_t zxnextGetAudioSampleCapacity(void) { return ZXNEXT_AUDIO_SAMPLE_CAPACITY; }
uint32_t zxnextGetSdCommandBufferSize(void) { return ZXNEXT_SD_COMMAND_BUFFER_SIZE; }
uint32_t zxnextGetSdResponseBufferSize(void) { return ZXNEXT_SD_RESPONSE_BUFFER_SIZE; }
uint32_t zxnextGetDiagnosticBufferSize(void) { return ZXNEXT_DIAGNOSTIC_BUFFER_SIZE; }
uint32_t zxnextGetFrames(void) { return frames; }
uint32_t zxnextGetTacts(void) { return tacts; }
void zxnextSetTacts(uint32_t value) {
  tacts = value;
  z80SetTacts(value);
}
uint32_t zxnextGetHardResetCount(void) { return hardResetCount; }
uint32_t zxnextGetResetCount(void) { return resetCount; }
uint32_t zxnextGetRomUploadCount(void) { return romUploadCount; }
uint32_t zxnextGetUploadedRomMask(void) { return uploadedRomMask; }
uint32_t zxnextGetCpuInstructionsExecuted(void) { return cpuInstructionsExecuted; }
uint32_t zxnextGetCpuAf(void) { return z80GetAf(); }
void zxnextSetCpuAf(uint32_t value) { z80SetAf(value); }
uint32_t zxnextGetCpuAfAlt(void) { return z80GetAfAlt(); }
void zxnextSetCpuAfAlt(uint32_t value) { z80SetAfAlt(value); }
uint32_t zxnextGetCpuBc(void) { return z80GetBc(); }
void zxnextSetCpuBc(uint32_t value) { z80SetBc(value); }
uint32_t zxnextGetCpuBcAlt(void) { return z80GetBcAlt(); }
void zxnextSetCpuBcAlt(uint32_t value) { z80SetBcAlt(value); }
uint32_t zxnextGetCpuDe(void) { return z80GetDe(); }
void zxnextSetCpuDe(uint32_t value) { z80SetDe(value); }
uint32_t zxnextGetCpuDeAlt(void) { return z80GetDeAlt(); }
void zxnextSetCpuDeAlt(uint32_t value) { z80SetDeAlt(value); }
uint32_t zxnextGetCpuHl(void) { return z80GetHl(); }
void zxnextSetCpuHl(uint32_t value) { z80SetHl(value); }
uint32_t zxnextGetCpuHlAlt(void) { return z80GetHlAlt(); }
void zxnextSetCpuHlAlt(uint32_t value) { z80SetHlAlt(value); }
uint32_t zxnextGetCpuIx(void) { return z80GetIx(); }
void zxnextSetCpuIx(uint32_t value) { z80SetIx(value); }
uint32_t zxnextGetCpuIy(void) { return z80GetIy(); }
void zxnextSetCpuIy(uint32_t value) { z80SetIy(value); }
uint32_t zxnextGetCpuIr(void) { return z80GetIr(); }
void zxnextSetCpuIr(uint32_t value) { z80SetIr(value); }
uint32_t zxnextGetCpuWz(void) { return z80GetWz(); }
void zxnextSetCpuWz(uint32_t value) { z80SetWz(value); }
uint32_t zxnextGetCpuPc(void) { return z80GetPc(); }
void zxnextSetCpuPc(uint32_t value) {
  cpuPc = (uint16_t)(value & 0xffffu);
  z80SetPc(value);
}
uint32_t zxnextGetCpuSp(void) { return z80GetSp(); }
void zxnextSetCpuSp(uint32_t value) {
  cpuSp = (uint16_t)(value & 0xffffu);
  z80SetSp(value);
}
uint32_t zxnextGetCpuHalted(void) { return z80GetHalted(); }
uint32_t zxnextGetCpuPrefix(void) { return z80GetPrefix(); }
uint32_t zxnextGetCpuIff1(void) { return z80GetIff1(); }
void zxnextSetCpuIff1(uint32_t value) { z80SetIff1(value); }
uint32_t zxnextGetCpuIff2(void) { return z80GetIff2(); }
void zxnextSetCpuIff2(uint32_t value) { z80SetIff2(value); }
uint32_t zxnextGetCpuInterruptMode(void) { return z80GetInterruptMode(); }
void zxnextSetCpuInterruptMode(uint32_t value) { z80SetInterruptMode(value); }
uint32_t zxnextGetCpuTacts(void) { return z80GetTacts(); }
uint32_t zxnextGetZ80NMode(void) { return z80GetZ80NMode(); }
uint32_t zxnextGetLastMemoryAddress(void) { return hasMemoryEvent != 0u ? lastMemoryAddress : 0u; }
uint32_t zxnextGetLastMemoryValue(void) { return hasMemoryEvent != 0u ? lastMemoryValue : 0u; }
uint32_t zxnextGetLastMemoryIsWrite(void) { return hasMemoryEvent != 0u ? lastMemoryIsWrite : 0u; }
uint32_t zxnextGetLastPortAddress(void) { return hasPortEvent != 0u ? lastPortAddress : 0u; }
uint32_t zxnextGetLastPortValue(void) { return hasPortEvent != 0u ? lastPortValue : 0u; }
uint32_t zxnextGetLastPortIsWrite(void) { return hasPortEvent != 0u ? lastPortIsWrite : 0u; }
uint32_t zxnextGetLastTbBlueAddress(void) { return hasTbBlueEvent != 0u ? lastTbBlueAddress : 0u; }
uint32_t zxnextGetLastTbBlueValue(void) { return hasTbBlueEvent != 0u ? lastTbBlueValue : 0u; }
uint32_t zxnextGetLastTbBlueIsWrite(void) { return hasTbBlueEvent; }
void zxnextClearBusEvents(void) {
  hasMemoryEvent = 0u;
  hasPortEvent = 0u;
  hasTbBlueEvent = 0u;
  z80ClearBusEvents();
}
uint32_t zxnextGetDiagnosticFlags(void) { return 0; }

static uint8_t zxnextCpuReadMemory(uint32_t address) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  const uint8_t value = (uint8_t)zxnextReadMemory(maskedAddress);
  if (captureBusEvents != 0u) {
    lastMemoryAddress = maskedAddress;
    lastMemoryValue = value;
    lastMemoryIsWrite = 0u;
    hasMemoryEvent = 1u;
  }
  return value;
}

static void zxnextCpuWriteMemory(uint32_t address, uint32_t value) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  zxnextWriteMemory(maskedAddress, byteValue);
  if (captureBusEvents != 0u) {
    lastMemoryAddress = maskedAddress;
    lastMemoryValue = byteValue;
    lastMemoryIsWrite = 1u;
    hasMemoryEvent = 1u;
  }
}

static void zxnextCpuPokeMemory(uint32_t address, uint32_t value) {
  const uint32_t maskedAddress = address & 0xffffu;
  const uint32_t page = maskedAddress >> 13u;
  const uint32_t offset = maskedAddress & 0x1fffu;
  const uint32_t readOffset = pageReadOffset[page];
  zxnextWritePhysical(readOffset + offset, value);
  flatMemory[maskedAddress] = (uint8_t)(value & 0xffu);
}

static void tactPlusNNext(uint32_t value) {
  cpu.tacts += value;
  tacts += value;
}

static void importZ80BusEvents(void) {
  if (z80GetLastPortIsWrite() != 0u || z80GetLastPortAddress() != 0u || z80GetLastPortValue() != 0u) {
    lastPortAddress = (uint16_t)z80GetLastPortAddress();
    lastPortValue = (uint8_t)z80GetLastPortValue();
    lastPortIsWrite = (uint8_t)z80GetLastPortIsWrite();
    hasPortEvent = 1u;
  }
  if (z80GetLastTbBlueIsWrite() != 0u) {
    lastTbBlueAddress = (uint8_t)z80GetLastTbBlueAddress();
    lastTbBlueValue = (uint8_t)z80GetLastTbBlueValue();
    hasTbBlueEvent = 1u;
    writeNextRegInternal(lastTbBlueAddress, lastTbBlueValue);
  }
}
