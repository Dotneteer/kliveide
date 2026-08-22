#include "zxnext-nextreg.h"
#include "zxnext-memory.h"
#include "zxnext-interrupts.h"
#include "zxnext-divmmc.h"
#include "zxnext-input.h"
#include "zxnext-expansion.h"

static void zxnextNextRegHardReset(void) {
  for (uint32_t i = 0; i < ZXNEXT_NEXT_REG_COUNT; i++) zxnextNextRegs[i] = 0;
  cpuProgrammedSpeed = 0;
  cpuEffectiveSpeed = 0;
  cpuTactScale = 8;
  zxnextNextRegs[0x00] = 0x08;
  zxnextNextRegs[0x01] = 0x32;
  zxnextNextRegs[0x03] = 0x03;
  zxnextNextRegs[0x05] = 0x41;
  zxnextNextRegs[0x06] = 0x80;
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
  zxnextMouseSetNextReg0A(zxnextNextRegs[0x0a]);
  zxnextExpansionHardReset();
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
  } else if (normalized == 0x06u) {
    zxnextDivMmcSetEnableNmiByDriveButton(value & 0x10u);
    zxnextDivMmcSetEnableMultifaceNmiByM1Button(value & 0x08u);
  } else if (normalized == 0x0au) {
    zxnextDivMmcSetNextReg0A(value);
    zxnextMouseSetNextReg0A(value);
  } else if (normalized == 0x1cu) {
    if ((value & 0x01u) != 0u) zxnextLayer2ResetClipIndex();
    if ((value & 0x02u) != 0u) zxnextSpritesResetClipIndex();
    if ((value & 0x04u) != 0u) zxnextUlaResetClipIndex();
    if ((value & 0x08u) != 0u) zxnextTilemapResetClipIndex();
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
  if (normalized == 0x07u) {
    cpuProgrammedSpeed = (uint8_t)(value & 0x03u);
    cpuEffectiveSpeed = cpuProgrammedSpeed;
    zxnextNextRegs[0x07u] = (uint8_t)((cpuProgrammedSpeed & 0x03u) | ((cpuEffectiveSpeed & 0x03u) << 4u));
    return;
  }
  if (normalized == 0x08u) {
    zxnextPsgSetAyStereoMode(value & 0x10u);
    if ((value & 0x20u) == 0u) zxnextDacReset();
  } else if (normalized == 0x09u) {
    zxnextPsgSetChipMonoMode(0u, value & 0x20u);
    zxnextPsgSetChipMonoMode(1u, value & 0x40u);
    zxnextPsgSetChipMonoMode(2u, value & 0x80u);
  }
  if (zxnextDacHandlesNextReg(normalized)) zxnextDacSetNextReg(normalized, value);
  zxnextPaletteSetNextReg(normalized, value);
  if (normalized == 0x6bu) zxnextPaletteSetSecondTilemap(value & 0x10u);
  zxnextUlaSetNextReg(normalized, value);
  zxnextLayer2SetNextReg(normalized, value);
  zxnextTilemapSetNextReg(normalized, value);
  zxnextSpritesSetNextReg(normalized, value);
  zxnextCopperSetNextReg(normalized, value);
  if (zxnextExpansionHandlesNextReg(normalized)) zxnextExpansionSetNextReg(normalized, value);
  zxnextMemorySetNextRegister(reg, value);
}

static uint32_t zxnextNextRegGetDirect(uint32_t reg) {
  if (zxnextInterruptsHandlesNextRegister(reg)) return zxnextInterruptsGetNextRegister(reg);
  switch (reg & 0xffu) {
    case 0x06u:
      return (zxnextNextRegs[0x06u] & 0xe7u) |
        (zxnextDivMmcGetEnableNmiByDriveButton() ? 0x10u : 0x00u) |
        (zxnextDivMmcGetEnableMultifaceNmiByM1Button() ? 0x08u : 0x00u);
    case 0x07u:
      return (cpuProgrammedSpeed & 0x03u) | ((cpuEffectiveSpeed & 0x03u) << 4u);
    case 0xb8u: return zxnextDivMmcGetNextRegB8();
    case 0xb9u: return zxnextDivMmcGetNextRegB9();
    case 0xbau: return zxnextDivMmcGetNextRegBA();
    case 0xbbu: return zxnextDivMmcGetNextRegBB();
    case 0x80u:
    case 0x81u:
    case 0x86u:
    case 0x87u:
    case 0x88u:
    case 0x89u:
    case 0x8au:
      return zxnextExpansionGetNextReg(reg);
    case 0x2cu:
    case 0x2du:
    case 0x2eu:
      return zxnextDacGetNextReg(reg);
    case 0x40u:
    case 0x41u:
    case 0x43u:
    case 0x44u:
      return zxnextPaletteGetNextReg(reg);
    case 0x15u:
    case 0x16u:
    case 0x17u:
    case 0x18u:
    case 0x32u:
    case 0x33u:
    case 0x6au:
    case 0x70u:
    case 0x71u:
      return zxnextLayer2GetNextReg(reg);
    case 0x1au:
    case 0x26u:
    case 0x27u:
      return zxnextUlaGetNextReg(reg);
    case 0x19u:
      return zxnextSpritesGetNextReg(reg);
    case 0x1bu:
    case 0x2fu:
    case 0x30u:
    case 0x31u:
    case 0x4cu:
    case 0x6bu:
      return zxnextTilemapGetNextReg(reg) | (zxnextPaletteGetSecondTilemap() ? 0x10u : 0u);
    case 0x1cu:
      return (zxnextTilemapGetClipIndex() << 6u) |
        (zxnextUlaGetClipIndex() << 4u) |
        (zxnextSpritesGetClipIndex() << 2u) |
        zxnextLayer2GetClipIndex();
    case 0x6cu:
    case 0x6eu:
    case 0x6fu:
      return zxnextTilemapGetNextReg(reg);
    case 0x4bu:
      return zxnextSpritesGetNextReg(reg);
    case 0x61u:
    case 0x62u:
    case 0x64u:
      return zxnextCopperGetNextReg(reg);
    default: break;
  }
  return zxnextNextRegs[reg & 0xffu];
}
