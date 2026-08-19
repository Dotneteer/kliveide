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
static uint8_t borderColor;
static uint8_t earBit;
static uint8_t micBit;

#include "zxnext-frame.c"
#include "zxnext-debug.c"

uint32_t zxnextMemoryPtr(void) { return (uint32_t)(uintptr_t)zxnextMemory; }
uint32_t zxnextPixelBufferPtr(void) { return (uint32_t)(uintptr_t)zxnextPixelBuffer; }
uint32_t zxnextKeyboardLinesPtr(void) { return (uint32_t)(uintptr_t)zxnextKeyboardLines; }
uint32_t zxnextNextRegsPtr(void) { return (uint32_t)(uintptr_t)zxnextNextRegs; }

static void clearScaffoldBuffers(void) {
  for (uint32_t i = 0; i < ZXNEXT_MEMORY_SIZE; i++) zxnextMemory[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_PIXEL_COUNT; i++) zxnextPixelBuffer[i] = 0xff000000u;
  for (uint32_t i = 0; i < ZXNEXT_KEYBOARD_LINE_COUNT; i++) zxnextKeyboardLines[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_NEXT_REG_COUNT; i++) zxnextNextRegs[i] = 0;
  zxnextNextRegs[0x00] = 0x32;
  zxnextNextRegs[0x01] = 0x20;
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
  zxnextFrameResetScaffold();
  zxnextDebugResetScaffold();
  lastMemoryAddress = 0;
  lastMemoryValue = 0;
  lastMemoryIsWrite = 0;
  lastPortAddress = 0;
  lastPortValue = 0;
  lastPortIsWrite = 0;
  nextRegIndex = 0;
  portFeValue = 0xff;
  borderColor = 0;
  earBit = 0;
  micBit = 0;
}

void zxnextHardReset(void) {
  clearScaffoldBuffers();
  zxnextReset();
}

uint32_t zxnextExecuteFrame(void) {
  return zxnextFrameExecuteScaffold();
}

uint32_t zxnextExecuteInstruction(void) {
  return zxnextDebugExecuteScaffoldStep();
}

uint32_t zxnextRenderInstantScreen(void) {
  return zxnextFrameRenderScaffold();
}

uint32_t zxnextReadMemory(uint32_t address) {
  uint32_t normalized = address & 0xffffu;
  lastMemoryAddress = (uint16_t)normalized;
  lastMemoryValue = zxnextMemory[normalized];
  lastMemoryIsWrite = 0;
  return lastMemoryValue;
}

void zxnextWriteMemory(uint32_t address, uint32_t value) {
  uint32_t normalized = address & 0xffffu;
  zxnextMemory[normalized] = (uint8_t)value;
  lastMemoryAddress = (uint16_t)normalized;
  lastMemoryValue = (uint8_t)value;
  lastMemoryIsWrite = 1;
}

uint32_t zxnextReadScreenMemoryOffset(uint32_t offset) {
  return zxnextMemory[0x4000u + (offset & 0x3fffu)];
}

void zxnextSetKeyStatus(uint32_t key, uint32_t isDown) {
  uint32_t line = key / 5u;
  uint32_t bit = key % 5u;
  if (line >= ZXNEXT_KEYBOARD_LINE_COUNT) return;
  if (isDown != 0) {
    zxnextKeyboardLines[line] |= (uint8_t)(1u << bit);
  } else {
    zxnextKeyboardLines[line] &= (uint8_t)~(1u << bit);
  }
}

uint32_t zxnextGetKeyboardLine(uint32_t line) {
  return line < ZXNEXT_KEYBOARD_LINE_COUNT ? zxnextKeyboardLines[line] : 0;
}

uint32_t zxnextReadPort(uint32_t address) {
  uint16_t normalized = (uint16_t)address;
  lastPortAddress = normalized;
  lastPortIsWrite = 0;
  if ((normalized & 0xffffu) == 0x253bu) {
    lastPortValue = zxnextNextRegs[nextRegIndex];
  } else if ((normalized & 0x0001u) == 0) {
    lastPortValue = portFeValue;
  } else {
    lastPortValue = 0xff;
  }
  return lastPortValue;
}

void zxnextWritePort(uint32_t address, uint32_t value) {
  uint16_t normalized = (uint16_t)address;
  uint8_t byteValue = (uint8_t)value;
  lastPortAddress = normalized;
  lastPortValue = byteValue;
  lastPortIsWrite = 1;
  if ((normalized & 0xffffu) == 0x243bu) {
    nextRegIndex = byteValue;
  } else if ((normalized & 0xffffu) == 0x253bu) {
    zxnextNextRegs[nextRegIndex] = byteValue;
  } else if ((normalized & 0x0001u) == 0) {
    portFeValue = byteValue;
    borderColor = byteValue & 0x07u;
    micBit = (byteValue & 0x08u) != 0;
    earBit = (byteValue & 0x10u) != 0;
  }
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

void zxnextSetNextRegisterIndex(uint32_t reg) { nextRegIndex = (uint8_t)reg; }
uint32_t zxnextGetNextRegisterIndex(void) { return nextRegIndex; }
void zxnextSetNextRegisterValue(uint32_t value) { zxnextNextRegs[nextRegIndex] = (uint8_t)value; }
uint32_t zxnextGetNextRegisterValue(void) { return zxnextNextRegs[nextRegIndex]; }
uint32_t zxnextGetNextRegisterDirect(uint32_t reg) { return zxnextNextRegs[reg & 0xffu]; }
void zxnextSetNextRegisterDirect(uint32_t reg, uint32_t value) { zxnextNextRegs[reg & 0xffu] = (uint8_t)value; }

uint32_t zxnextGetPortFeValue(void) { return portFeValue; }
uint32_t zxnextGetBorderColor(void) { return borderColor; }
uint32_t zxnextGetEarBit(void) { return earBit; }
uint32_t zxnextGetMicBit(void) { return micBit; }
uint32_t zxnextGetBeeperLevel(void) { return earBit; }
uint32_t zxnextGetDiagnosticFlags(void) { return ZXNEXT_DIAGNOSTIC_IMPLEMENTATION_INCOMPLETE; }
