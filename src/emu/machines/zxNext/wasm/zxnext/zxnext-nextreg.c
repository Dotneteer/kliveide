#include "zxnext-nextreg.h"
#include "zxnext-memory.h"
#include "zxnext-interrupts.h"

static void zxnextNextRegHardReset(void) {
  for (uint32_t i = 0; i < ZXNEXT_NEXT_REG_COUNT; i++) zxnextNextRegs[i] = 0;
  zxnextNextRegs[0x00] = 0x08;
  zxnextNextRegs[0x01] = 0x32;
  zxnextNextRegs[0x0e] = 0x00;
  zxnextNextRegs[0x12] = 0x08;
  zxnextNextRegs[0x13] = 0x0b;
  zxnextNextRegs[0x14] = 0xe3;
  zxnextNextRegs[0x15] = 0x00;
  zxnextNextRegs[0x16] = 0x00;
  zxnextNextRegs[0x17] = 0x00;
  zxnextNextRegs[0x1c] = 0x00;
  zxnextNextRegs[0x1e] = 0x00;
  zxnextNextRegs[0x1f] = 0x00;
  zxnextNextRegs[0x22] = 0x00;
  zxnextNextRegs[0x23] = 0x00;
  zxnextNextRegs[0x32] = 0x00;
  zxnextNextRegs[0x33] = 0x00;
  zxnextNextRegs[0x42] = 0x07;
  zxnextNextRegs[0x43] = 0x00;
  zxnextNextRegs[0x4a] = 0x00;
  zxnextNextRegs[0x4b] = 0xe3;
  zxnextNextRegs[0x4c] = 0x0f;
  zxnextNextRegs[0x61] = 0x00;
  zxnextNextRegs[0x62] = 0x00;
  zxnextNextRegs[0x6b] = 0x00;
  zxnextNextRegs[0x70] = 0x00;
  zxnextNextRegs[0x82] = 0xff;
  zxnextNextRegs[0x83] = 0xff;
  zxnextNextRegs[0x84] = 0xff;
  zxnextNextRegs[0x85] = 0x0f;
  zxnextNextRegs[0x8c] = 0x00;
  zxnextMemoryResetMapping();
}

static void zxnextNextRegSetIndex(uint32_t reg) {
  nextRegIndex = (uint8_t)reg;
}

static uint32_t zxnextNextRegGetIndex(void) {
  return nextRegIndex;
}

static void zxnextNextRegSetValue(uint32_t value) {
  zxnextNextRegSetDirect(nextRegIndex, value);
}

static uint32_t zxnextNextRegGetValue(void) {
  return zxnextNextRegGetDirect(nextRegIndex);
}

static void zxnextNextRegSetDirect(uint32_t reg, uint32_t value) {
  if (zxnextInterruptsHandlesNextRegister(reg)) {
    zxnextInterruptsSetNextRegister(reg, value);
    zxnextNextRegs[reg & 0xffu] = (uint8_t)zxnextInterruptsGetNextRegister(reg);
    return;
  }
  zxnextMemorySetNextRegister(reg, value);
}

static uint32_t zxnextNextRegGetDirect(uint32_t reg) {
  if (zxnextInterruptsHandlesNextRegister(reg)) return zxnextInterruptsGetNextRegister(reg);
  return zxnextNextRegs[reg & 0xffu];
}
