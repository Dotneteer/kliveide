#include "zxnext.h"

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
static uint8_t nextRegLastWrite[ZXNEXT_NEXTREG_COUNT];
static uint8_t nextRegHasLastWrite[ZXNEXT_NEXTREG_COUNT];
static uint32_t pageReadOffset[ZXNEXT_PAGE_COUNT];
static uint32_t pageWriteOffset[ZXNEXT_PAGE_COUNT];
static uint32_t pageBank16k[ZXNEXT_PAGE_COUNT];
static uint32_t pageBank8k[ZXNEXT_PAGE_COUNT];
static uint32_t keyboardRowWrites = 0;
static uint8_t ulaBorderColor = 7u;
static uint8_t ulaEarBit = 0;
static uint8_t ulaMicBit = 0;
static uint8_t ulaBeeperEar = 0;
static uint8_t ulaBeeperMic = 0;
static uint32_t ulaBit4ChangedFrom0Tacts = 0;
static uint32_t ulaBit4ChangedFrom1Tacts = 0;

static uint32_t frames = 0;
static uint32_t tacts = 0;
static uint32_t frameTacts = 0;
static uint32_t currentFrameTact = 0;
static uint32_t hardResetCount = 0;
static uint32_t resetCount = 0;
static uint32_t romUploadCount = 0;
static uint32_t uploadedRomMask = 0;
static uint32_t cpuInstructionsExecuted = 0;
static uint32_t frameCallCount = 0;
static uint32_t lastFrameInstructionsExecuted = 0;
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
static uint32_t unsupportedPortReadCount = 0;
static uint32_t unsupportedPortWriteCount = 0;
static uint16_t firstUnsupportedPortAddress = 0;
static uint8_t firstUnsupportedPortValue = 0xffu;
static uint8_t firstUnsupportedPortIsWrite = 0;
static uint8_t firstUnsupportedPortOwnerStep = 0;
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
static uint8_t nextRegIndex = 0;
static uint8_t nextRegLastReadValue = 0xffu;
static uint8_t nextRegConfigMode = 0;
static uint8_t nr02ResetType = 0x04u;
static uint8_t internalPortEnables[4] = { 0xffu, 0xffu, 0xffu, 0x0fu };
static uint8_t busPortEnables[4] = { 0xffu, 0xffu, 0xffu, 0x8fu };
static uint32_t configuredMemorySizeKb = ZXNEXT_DEFAULT_MEMORY_SIZE_KB;
static uint32_t activeMainRamPages = ZXNEXT_DEFAULT_MAIN_RAM_PAGES;
static uint8_t divMmcEnabled = 1u;
static uint8_t divMmcConmem = 0u;
static uint8_t divMmcMapram = 0u;
static uint8_t divMmcBank = 0u;
static uint8_t divMmcLastE3Value = 0u;
static uint8_t divMmcEnableAutomap = 0u;
static uint8_t divMmcRequestAutomapOn = 0u;
static uint8_t divMmcRequestAutomapOff = 0u;
static uint8_t divMmcAutoMapActive = 0u;
static uint8_t divMmcNmiButtonPressed = 0u;
static uint8_t divMmcResetMapramFlag = 0u;
static uint8_t divMmcRstTrapEnabled = 0u;
static uint8_t divMmcRstTrapOnlyWithRom3 = 0xffu;
static uint8_t divMmcRstTrapInstant = 0u;
static uint8_t divMmcEntry1 = 0u;
static uint8_t sdSelectedCard = 0u;
static uint8_t sdCommandIndex[2] = { 0u, 0u };
static uint8_t sdLastCommand[2] = { 0u, 0u };
static uint8_t sdCommandParams[2][4];
static uint8_t sdAcmd[2] = { 0u, 0u };
static uint32_t sdTotalSectors[2] = { 0u, 0u };
static uint8_t sdResponse[2][ZXNEXT_SD_RESPONSE_BUFFER_SIZE];
static uint32_t sdResponseLength[2] = { 0u, 0u };
static uint32_t sdResponseIndex[2] = { 0u, 0u };
static uint8_t sdResponseReady[2] = { 0u, 0u };
static uint8_t sdState[2] = { 0u, 0u };
static uint8_t sdBlockToWrite[ZXNEXT_SD_COMMAND_BUFFER_SIZE];
static uint32_t sdDataIndex[2] = { 0u, 0u };
static uint32_t sdPendingCommand = 0u;
static uint32_t sdPendingSector = 0u;
static uint32_t sdPendingCard = 0u;
static uint32_t sdCommandCount = 0u;
static uint32_t sdReadRequestCount = 0u;
static uint32_t sdWriteRequestCount = 0u;

static uint8_t zxnextCpuReadMemory(uint32_t address);
static void zxnextCpuWriteMemory(uint32_t address, uint32_t value);
static void zxnextCpuPokeMemory(uint32_t address, uint32_t value);
static void tactPlusNNext(uint32_t value);
static void importZ80BusEvents(void);
static void clearRuntimeState(void);
static uint32_t executeWholeInstruction(void);
static uint32_t cpuTactsPerFrame(void);
static void advanceFrameTacts(uint32_t delta);

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

#include "zxnext-memory.c"
#include "zxnext-nextreg.c"
#include "zxnext-divmmc.c"
#include "zxnext-sdcard.c"
#include "zxnext-keyboard.c"
#include "zxnext-ula.c"
#include "zxnext-screen.c"
#include "zxnext-ports.c"

static void clearRuntimeState(void) {
  resetDivMmcState();
  resetSdCardState();
  resetKeyboardState();
  resetUlaState();
  resetScreenState();
  for (uint32_t i = 0; i < ZXNEXT_AUDIO_SAMPLE_CAPACITY * 2u; i++) audioSamples[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_SD_COMMAND_BUFFER_SIZE; i++) sdCommandBuffer[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_SD_RESPONSE_BUFFER_SIZE; i++) sdResponseBuffer[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_DIAGNOSTIC_BUFFER_SIZE; i++) diagnosticBuffer[i] = 0;
  frames = 0;
  tacts = 0;
  frameTacts = 0;
  currentFrameTact = 0;
  cpuInstructionsExecuted = 0;
  frameCallCount = 0;
  lastFrameInstructionsExecuted = 0;
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
  unsupportedPortReadCount = 0;
  unsupportedPortWriteCount = 0;
  firstUnsupportedPortAddress = 0;
  firstUnsupportedPortValue = 0xffu;
  firstUnsupportedPortIsWrite = 0;
  firstUnsupportedPortOwnerStep = 0;
  hasTbBlueEvent = 0;
  lastTbBlueAddress = 0;
  lastTbBlueValue = 0;
  captureBusEvents = 1;
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
  resetNextRegs(1);
  updateScreenTimingFromNextRegs();
  z80Reset();
  z80SetZ80NMode(1);
  z80SetSp(cpuSp);
}

void zxnextReset(void) {
  resetCount++;
  clearRuntimeState();
  resetMmuLayout();
  resetNextRegs(0);
  updateScreenTimingFromNextRegs();
  z80Reset();
  z80SetZ80NMode(1);
  z80SetSp(cpuSp);
}

uint32_t zxnextExecuteInstruction(void) {
  hasMemoryEvent = 0;
  z80ClearBusEvents();
  const uint32_t delta = executeWholeInstruction();
  advanceFrameTacts(delta);
  if (frameTacts >= cpuTactsPerFrame()) {
    while (frameTacts >= cpuTactsPerFrame()) {
      frameTacts -= cpuTactsPerFrame();
      frames++;
    }
    currentFrameTact = frameTacts * 2u;
    zxnextRenderInstantScreen();
  }
  return 0;
}

uint32_t zxnextExecuteFrame(void) {
  frameCallCount++;
  lastFrameInstructionsExecuted = 0;
  hasMemoryEvent = 0u;
  hasPortEvent = 0u;
  hasTbBlueEvent = 0u;
  z80ClearBusEvents();
  const uint32_t target = cpuTactsPerFrame();
  uint32_t guard = 0u;
  do {
    const uint32_t delta = executeWholeInstruction();
    advanceFrameTacts(delta);
    lastFrameInstructionsExecuted++;
    guard++;
  } while (frameTacts < target && guard < 0x200000u);

  while (frameTacts >= target) {
    frameTacts -= target;
    frames++;
  }
  currentFrameTact = frameTacts * 2u;
  zxnextRenderInstantScreen();
  return 0u;
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

uint32_t zxnextGetFlatMemorySize(void) { return ZXNEXT_FLAT_MEMORY_SIZE; }
uint32_t zxnextGetSramSize(void) { return ZXNEXT_SRAM_CAPACITY; }
uint32_t zxnextGetSramCapacity(void) { return ZXNEXT_SRAM_CAPACITY; }
uint32_t zxnextGetRomSize(void) { return ZXNEXT_ROM_SIZE; }
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
uint32_t zxnextGetFrameTacts(void) { return frameTacts * 8u; }
uint32_t zxnextGetCurrentFrameTact(void) { return currentFrameTact; }
uint32_t zxnextGetCpuTactsPerFrame(void) { return cpuTactsPerFrame(); }
uint32_t zxnextGetFrameCallCount(void) { return frameCallCount; }
uint32_t zxnextGetLastFrameInstructionsExecuted(void) { return lastFrameInstructionsExecuted; }
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
uint32_t zxnextGetUnsupportedPortReadCount(void) { return unsupportedPortReadCount; }
uint32_t zxnextGetUnsupportedPortWriteCount(void) { return unsupportedPortWriteCount; }
uint32_t zxnextGetFirstUnsupportedPortAddress(void) { return firstUnsupportedPortAddress; }
uint32_t zxnextGetFirstUnsupportedPortValue(void) { return firstUnsupportedPortValue; }
uint32_t zxnextGetFirstUnsupportedPortIsWrite(void) { return firstUnsupportedPortIsWrite; }
uint32_t zxnextGetFirstUnsupportedPortOwnerStep(void) { return firstUnsupportedPortOwnerStep; }
uint32_t zxnextGetLastTbBlueAddress(void) { return hasTbBlueEvent != 0u ? lastTbBlueAddress : 0u; }
uint32_t zxnextGetLastTbBlueValue(void) { return hasTbBlueEvent != 0u ? lastTbBlueValue : 0u; }
uint32_t zxnextGetLastTbBlueIsWrite(void) { return hasTbBlueEvent; }
void zxnextClearBusEvents(void) {
  hasMemoryEvent = 0u;
  hasPortEvent = 0u;
  hasTbBlueEvent = 0u;
  z80ClearBusEvents();
}
uint32_t zxnextGetDiagnosticFlags(void) {
  return (unsupportedPortReadCount != 0u || unsupportedPortWriteCount != 0u) ? 0x01u : 0u;
}

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

static uint32_t executeWholeInstruction(void) {
  const uint32_t startTacts = tacts;
  const uint32_t startPc = z80GetPc();
  zxnextDivMmcBeforeOpcodeFetch(startPc);
  z80SetTacts(tacts);
  do {
    z80ExecuteCpuCycle();
  } while (z80GetPrefix() != 0u);
  tacts = z80GetTacts();
  cpuPc = (uint16_t)z80GetPc();
  cpuSp = (uint16_t)z80GetSp();
  cpuInstructionsExecuted++;
  importZ80BusEvents();
  zxnextDivMmcAfterOpcodeFetch(z80GetRetnExecuted());
  return tacts - startTacts;
}

static uint32_t cpuTactsPerFrame(void) {
  updateScreenTimingFromNextRegs();
  return screenRenderingTacts >> 1u;
}

static void advanceFrameTacts(uint32_t delta) {
  frameTacts += delta;
  currentFrameTact = frameTacts * 2u;
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
