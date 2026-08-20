#include "zxnext-nextreg.h"
#include "zxnext-memory.h"
#include "zxnext-interrupts.h"
#include "zxnext-divmmc.h"

static void zxnextNextRegHardReset(void) {
  for (uint32_t i = 0; i < ZXNEXT_NEXT_REG_COUNT; i++) zxnextNextRegs[i] = 0;
  zxnextNextRegs[0x00] = 0x08;
  zxnextNextRegs[0x01] = 0x32;
  zxnextNextRegs[0x08] = 0x1a;
  zxnextNextRegs[0x0e] = 0x00;
  zxnextNextRegs[0x0a] = 0x01;
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
  zxnextNextRegs[0xb8] = 0x83;
  zxnextNextRegs[0xb9] = 0x01;
  zxnextNextRegs[0xba] = 0x00;
  zxnextNextRegs[0xbb] = 0xcd;
  zxnextDivMmcSetNextReg09(zxnextNextRegs[0x09]);
  zxnextDivMmcSetNextReg0A(zxnextNextRegs[0x0a]);
  zxnextDivMmcSetNextReg83(zxnextNextRegs[0x83]);
  zxnextDivMmcSetNextRegB8(zxnextNextRegs[0xb8]);
  zxnextDivMmcSetNextRegB9(zxnextNextRegs[0xb9]);
  zxnextDivMmcSetNextRegBA(zxnextNextRegs[0xba]);
  zxnextDivMmcSetNextRegBB(zxnextNextRegs[0xbb]);
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
  uint32_t normalized = reg & 0xffu;
  if (zxnextInterruptsHandlesNextRegister(reg)) {
    zxnextInterruptsSetNextRegister(reg, value);
    zxnextNextRegs[reg & 0xffu] = (uint8_t)zxnextInterruptsGetNextRegister(reg);
    return;
  }
  if (normalized == 0x09u) {
    zxnextDivMmcSetNextReg09(value);
  } else if (normalized == 0x0au) {
    zxnextDivMmcSetNextReg0A(value);
  } else if (normalized == 0x83u) {
    zxnextDivMmcSetNextReg83(value);
  } else if (normalized == 0xb8u) {
    zxnextDivMmcSetNextRegB8(value);
  } else if (normalized == 0xb9u) {
    zxnextDivMmcSetNextRegB9(value);
  } else if (normalized == 0xbau) {
    zxnextDivMmcSetNextRegBA(value);
  } else if (normalized == 0xbbu) {
    zxnextDivMmcSetNextRegBB(value);
  }
  zxnextMemorySetNextRegister(reg, value);
}

static uint32_t zxnextNextRegGetDirect(uint32_t reg) {
  if (zxnextInterruptsHandlesNextRegister(reg)) return zxnextInterruptsGetNextRegister(reg);
  switch (reg & 0xffu) {
    case 0xb8u: return zxnextDivMmcGetNextRegB8();
    case 0xb9u: return zxnextDivMmcGetNextRegB9();
    case 0xbau: return zxnextDivMmcGetNextRegBA();
    case 0xbbu: return zxnextDivMmcGetNextRegBB();
    default: break;
  }
  return zxnextNextRegs[reg & 0xffu];
}
