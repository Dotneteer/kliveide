#include <stdint.h>

#define ZXNEXT_MEMORY_SIZE (2048 * 1024 + 0x2000)
#define ZXNEXT_FLAT_MEMORY_SIZE 0x10000
#define ZXNEXT_SCREEN_WIDTH 720
#define ZXNEXT_SCREEN_HEIGHT 288
#define ZXNEXT_PIXEL_COUNT (ZXNEXT_SCREEN_WIDTH * ZXNEXT_SCREEN_HEIGHT)
#define ZXNEXT_KEYBOARD_LINE_COUNT 8
#define ZXNEXT_NEXT_REG_COUNT 256
#define ZXNEXT_RENDERING_TACTS_IN_FRAME (456 * 311)
#define ZXNEXT_TACTS_IN_FRAME (ZXNEXT_RENDERING_TACTS_IN_FRAME * 4)

#define ZXNEXT_DIAGNOSTIC_IMPLEMENTATION_INCOMPLETE 1

static uint8_t zxnextMemory[ZXNEXT_MEMORY_SIZE];
static uint32_t zxnextPixelBuffer[ZXNEXT_PIXEL_COUNT];
static uint8_t zxnextKeyboardLines[ZXNEXT_KEYBOARD_LINE_COUNT];
static uint8_t zxnextNextRegs[ZXNEXT_NEXT_REG_COUNT];

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
static uint32_t currentFrameTact;
static uint8_t frameCompleted;
static uint16_t lastMemoryAddress;
static uint8_t lastMemoryValue;
static uint8_t lastMemoryIsWrite;
static uint16_t lastPortAddress;
static uint8_t lastPortValue;
static uint8_t lastPortIsWrite;
static uint8_t nextRegIndex;
static uint8_t portFeValue;
static uint8_t portTimexValue;
static uint8_t borderColor;
static uint8_t earBit;
static uint8_t micBit;

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
#include "zxnext-uart.c"
#include "zxnext-i2c.c"
#include "zxnext-input.c"
#include "zxnext-expansion.c"
#include "zxnext-dma.c"
#include "zxnext-floppy.c"
#include "zxnext-nextreg.c"
#include "zxnext-ports.c"
#include "zxnext-cpu.c"

uint32_t zxnextMemoryPtr(void) { return (uint32_t)(uintptr_t)zxnextMemory; }
uint32_t zxnextPixelBufferPtr(void) { return (uint32_t)(uintptr_t)zxnextPixelBuffer; }
uint32_t zxnextKeyboardLinesPtr(void) { return (uint32_t)(uintptr_t)zxnextKeyboardLines; }
uint32_t zxnextNextRegsPtr(void) { return (uint32_t)(uintptr_t)zxnextNextRegs; }

static void clearScaffoldBuffers(void) {
  for (uint32_t i = 0; i < ZXNEXT_MEMORY_SIZE; i++) zxnextMemory[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_PIXEL_COUNT; i++) zxnextPixelBuffer[i] = 0x00000000u;
  zxnextKeyboardReset();
  zxnextDivMmcReset();
  zxnextSdReset();
  zxnextPaletteReset();
  zxnextLayer2Reset();
  zxnextTilemapReset();
  zxnextSpritesReset();
  zxnextCopperReset();
  zxnextBeeperReset();
  zxnextDacReset();
  zxnextPsgReset();
  zxnextAudioMixerReset();
  zxnextCtcReset();
  zxnextUartReset();
  zxnextI2cReset();
  zxnextInputReset();
  zxnextExpansionHardReset();
  zxnextDmaReset();
  zxnextFloppyReset();
  zxnextNextRegHardReset();
}

void zxnextReset(void) {
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
  zxnextDebugResetScaffold();
  zxnextCpuReset();
  zxnextNmiReset();
  zxnextInterruptsReset();
  zxnextTapeReset();
  zxnextDivMmcReset();
  zxnextSdReset();
  zxnextPaletteReset();
  zxnextLayer2Reset();
  zxnextTilemapReset();
  zxnextSpritesReset();
  zxnextCopperReset();
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
  zxnextFloppyReset();
  lastMemoryAddress = 0;
  lastMemoryValue = 0;
  lastMemoryIsWrite = 0;
  zxnextPortsReset();
}

void zxnextHardReset(void) {
  zxnextReset();
  clearScaffoldBuffers();
}

uint32_t zxnextExecuteFrame(void) {
  return zxnextFrameExecute();
}

uint32_t zxnextExecuteInstruction(void) {
  return zxnextCpuExecuteInstruction();
}

uint32_t zxnextRenderInstantScreen(void) {
  return zxnextUlaRenderInstantScreen();
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
  currentFrameTact = value % zxnextGetTactsInFrame();
  zxnextBeeperSetTacts(value);
}

uint32_t zxnextGetCpuAf(void) { return cpuAf; }
void zxnextSetCpuAf(uint32_t value) { cpuAf = (uint16_t)value; }
uint32_t zxnextGetCpuBc(void) { return cpuBc; }
void zxnextSetCpuBc(uint32_t value) { cpuBc = (uint16_t)value; }
uint32_t zxnextGetCpuDe(void) { return cpuDe; }
void zxnextSetCpuDe(uint32_t value) { cpuDe = (uint16_t)value; }
uint32_t zxnextGetCpuHl(void) { return cpuHl; }
void zxnextSetCpuHl(uint32_t value) { cpuHl = (uint16_t)value; }
uint32_t zxnextGetCpuAfAlt(void) { return cpuAfAlt; }
void zxnextSetCpuAfAlt(uint32_t value) { cpuAfAlt = (uint16_t)value; }
uint32_t zxnextGetCpuBcAlt(void) { return cpuBcAlt; }
void zxnextSetCpuBcAlt(uint32_t value) { cpuBcAlt = (uint16_t)value; }
uint32_t zxnextGetCpuDeAlt(void) { return cpuDeAlt; }
void zxnextSetCpuDeAlt(uint32_t value) { cpuDeAlt = (uint16_t)value; }
uint32_t zxnextGetCpuHlAlt(void) { return cpuHlAlt; }
void zxnextSetCpuHlAlt(uint32_t value) { cpuHlAlt = (uint16_t)value; }
uint32_t zxnextGetCpuIx(void) { return cpuIx; }
void zxnextSetCpuIx(uint32_t value) { cpuIx = (uint16_t)value; }
uint32_t zxnextGetCpuIy(void) { return cpuIy; }
void zxnextSetCpuIy(uint32_t value) { cpuIy = (uint16_t)value; }
uint32_t zxnextGetCpuIr(void) { return cpuIr; }
void zxnextSetCpuIr(uint32_t value) { cpuIr = (uint16_t)value; }
uint32_t zxnextGetCpuWz(void) { return cpuWz; }
void zxnextSetCpuWz(uint32_t value) { cpuWz = (uint16_t)value; }
uint32_t zxnextGetCpuPc(void) { return cpuPc; }
void zxnextSetCpuPc(uint32_t value) { cpuPc = (uint16_t)value; }
uint32_t zxnextGetCpuSp(void) { return cpuSp; }
void zxnextSetCpuSp(uint32_t value) { cpuSp = (uint16_t)value; }
uint32_t zxnextGetCpuHalted(void) { return cpuHalted; }
uint32_t zxnextGetCpuPrefix(void) { return cpuPrefix; }
uint32_t zxnextGetCpuIff1(void) { return cpuIff1; }
void zxnextSetCpuIff1(uint32_t value) { cpuIff1 = value != 0; }
uint32_t zxnextGetCpuIff2(void) { return cpuIff2; }
void zxnextSetCpuIff2(uint32_t value) { cpuIff2 = value != 0; }
uint32_t zxnextGetCpuInterruptMode(void) { return cpuInterruptMode; }
void zxnextSetCpuInterruptMode(uint32_t value) { cpuInterruptMode = (uint8_t)(value & 0x03u); }

uint32_t zxnextGetLastMemoryAddress(void) { return lastMemoryAddress; }
uint32_t zxnextGetLastMemoryValue(void) { return lastMemoryValue; }
uint32_t zxnextGetLastMemoryIsWrite(void) { return lastMemoryIsWrite; }
uint32_t zxnextGetLastPortAddress(void) { return lastPortAddress; }
uint32_t zxnextGetLastPortValue(void) { return lastPortValue; }
uint32_t zxnextGetLastPortIsWrite(void) { return lastPortIsWrite; }

void zxnextSetNextRegisterIndex(uint32_t reg) { zxnextNextRegSetIndex(reg); }
uint32_t zxnextGetNextRegisterIndex(void) { return zxnextNextRegGetIndex(); }
void zxnextSetNextRegisterValue(uint32_t value) { zxnextNextRegSetValue(value); }
uint32_t zxnextGetNextRegisterValue(void) { return zxnextNextRegGetValue(); }
uint32_t zxnextGetNextRegisterDirect(uint32_t reg) { return zxnextNextRegGetDirect(reg); }
void zxnextSetNextRegisterDirect(uint32_t reg, uint32_t value) { zxnextNextRegSetDirect(reg, value); }

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
void zxnextProcessTapeMicBit(uint32_t value) { zxnextTapeProcessMicBit(value); }
uint32_t zxnextGetUlaFlashCounter(void) { return zxnextUlaGetFlashCounter(); }
uint32_t zxnextGetUlaFlashFlag(void) { return zxnextUlaGetFlashFlag(); }
void zxnextAdvanceUlaFrameState(void) { zxnextUlaOnFrameCompleted(); }
uint32_t zxnextGetUlaScanlineForTact(uint32_t tact) { return zxnextUlaGetScanlineForTact(tact); }
uint32_t zxnextGetUlaColumnForTact(uint32_t tact) { return zxnextUlaGetColumnForTact(tact); }

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
void zxnextCopperTick(uint32_t vc, uint32_t hc, uint32_t totalVc) { zxnextCopperExecuteTick(vc, hc, totalVc); }
uint32_t zxnextCopperRead(uint32_t address) { return zxnextCopperReadMemory(address); }
uint32_t zxnextGetCopperNextReg(uint32_t reg) { return zxnextCopperGetNextReg(reg); }
uint32_t zxnextGetCopperStartMode(void) { return zxnextCopperGetStartMode(); }
uint32_t zxnextGetCopperInstructionAddress(void) { return zxnextCopperGetInstructionAddress(); }
uint32_t zxnextGetCopperListAddress(void) { return zxnextCopperGetListAddress(); }
uint32_t zxnextGetCopperListData(void) { return zxnextCopperGetListData(); }
uint32_t zxnextGetCopperDout(void) { return zxnextCopperGetDout(); }
uint32_t zxnextGetCopperVerticalLineOffset(void) { return zxnextCopperGetVerticalLineOffset(); }
void zxnextSetBeeperOutput(uint32_t ear, uint32_t mic) { zxnextBeeperSetOutput(ear, mic); }
uint32_t zxnextGetBeeperEar(void) { return zxnextBeeperGetEar(); }
uint32_t zxnextGetBeeperMic(void) { return zxnextBeeperGetMic(); }
uint32_t zxnextGetBeeperOutputLevelMilli(void) { return zxnextBeeperGetOutputLevelMilli(); }
uint32_t zxnextGetBeeperSampleLeftMilli(void) { return zxnextBeeperGetSampleLeftMilli(); }
uint32_t zxnextGetBeeperSampleRightMilli(void) { return zxnextBeeperGetSampleRightMilli(); }
void zxnextSetPsgTurbosoundEnabled(uint32_t enabled) { zxnextPsgSetTurbosoundEnabled(enabled); }
void zxnextSetPsgAyStereoMode(uint32_t enabled) { zxnextPsgSetAyStereoMode(enabled); }
void zxnextSetPsgChipMonoMode(uint32_t chip, uint32_t enabled) { zxnextPsgSetChipMonoMode(chip, enabled); }
void zxnextSetPsgRegisterIndex(uint32_t value) { zxnextPsgSetRegisterIndex(value); }
void zxnextWritePsgRegisterValue(uint32_t value) { zxnextPsgWriteRegisterValue(value); }
uint32_t zxnextReadPsgRegisterValue(void) { return zxnextPsgReadRegisterValue(); }
void zxnextGeneratePsgOutput(uint32_t chip) { zxnextPsgGenerateOutput(chip); }
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
void zxnextSetAudioMixerEarLevelMilli(int32_t level) { zxnextAudioMixerSetEarLevelMilli(level); }
void zxnextSetAudioMixerMicLevelMilli(int32_t level) { zxnextAudioMixerSetMicLevelMilli(level); }
void zxnextSetAudioMixerPsgOutput(uint32_t left, uint32_t right) { zxnextAudioMixerSetPsgOutput(left, right); }
void zxnextSetAudioMixerVolumeScaleMilli(uint32_t scale) { zxnextAudioMixerSetVolumeScaleMilli(scale); }
int32_t zxnextGetAudioMixerMixedLeftWord(void) { return zxnextAudioMixerGetMixedLeftWord(); }
int32_t zxnextGetAudioMixerMixedRightWord(void) { return zxnextAudioMixerGetMixedRightWord(); }
uint32_t zxnextAppendAudioMixerCurrentSample(void) { return zxnextAudioMixerAppendCurrentSample(); }
uint32_t zxnextGetAudioMixerSampleCount(void) { return zxnextAudioMixerGetSampleCount(); }
int32_t zxnextGetAudioMixerSampleLeft(uint32_t index) { return zxnextAudioMixerGetSampleLeft(index); }
int32_t zxnextGetAudioMixerSampleRight(uint32_t index) { return zxnextAudioMixerGetSampleRight(index); }
