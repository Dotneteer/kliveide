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
#include "zxnext-diagnostics.c"
#include "zxnext-nmi.c"
#include "zxnext-interrupts.c"
#include "zxnext-keyboard.c"
#include "zxnext-tape.c"
#include "zxnext-ula.c"
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
