#include "zxnext-copper.h"
#include "zxnext-nextreg.h"

static uint8_t zxnextCopperMemory[0x800];
static uint8_t zxnextCopperStartMode;
static uint16_t zxnextCopperInstructionAddress;
static uint8_t zxnextCopperStoredByte;
static uint16_t zxnextCopperListAddress;
static uint16_t zxnextCopperListData;
static uint8_t zxnextCopperDout;
static uint8_t zxnextCopperVerticalLineOffset;

static void zxnextCopperReset(void) {
  zxnextCopperStartMode = 0u;
  zxnextCopperInstructionAddress = 0u;
  zxnextCopperStoredByte = 0u;
  zxnextCopperListAddress = 0u;
  zxnextCopperListData = 0u;
  zxnextCopperDout = 0u;
  zxnextCopperVerticalLineOffset = 0u;
  for (uint32_t i = 0u; i < 0x800u; i++) zxnextCopperMemory[i] = 0u;
}

static void zxnextCopperSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (reg & 0xffu) {
    case 0x60u:
      zxnextCopperMemory[zxnextCopperInstructionAddress] = byteValue;
      zxnextCopperInstructionAddress = (zxnextCopperInstructionAddress + 1u) & 0x7ffu;
      break;
    case 0x61u:
      zxnextCopperInstructionAddress = (zxnextCopperInstructionAddress & 0x700u) | byteValue;
      break;
    case 0x62u: {
      uint8_t newMode = (byteValue >> 6u) & 0x03u;
      zxnextCopperInstructionAddress = ((uint16_t)(byteValue & 0x07u) << 8u) |
        (zxnextCopperInstructionAddress & 0x0ffu);
      if (newMode != zxnextCopperStartMode) {
        zxnextCopperStartMode = newMode;
        if (newMode == 1u || newMode == 3u) zxnextCopperListAddress = 0u;
        zxnextCopperDout = 0u;
      }
      break;
    }
    case 0x63u:
      if (zxnextCopperInstructionAddress & 0x0001u) {
        zxnextCopperMemory[zxnextCopperInstructionAddress & 0x7feu] = zxnextCopperStoredByte;
        zxnextCopperMemory[zxnextCopperInstructionAddress] = byteValue;
      }
      zxnextCopperStoredByte = byteValue;
      zxnextCopperInstructionAddress = (zxnextCopperInstructionAddress + 1u) & 0x7ffu;
      break;
    case 0x64u:
      zxnextCopperVerticalLineOffset = byteValue;
      break;
    default:
      break;
  }
}

static uint32_t zxnextCopperGetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x61u: return zxnextCopperInstructionAddress & 0xffu;
    case 0x62u: return ((uint32_t)zxnextCopperStartMode << 6u) | ((zxnextCopperInstructionAddress & 0x700u) >> 8u);
    case 0x64u: return zxnextCopperVerticalLineOffset;
    default: return 0u;
  }
}

static void zxnextCopperExecuteTick(uint32_t vc, uint32_t hc, uint32_t totalVc) {
  if (zxnextCopperStartMode == 0u) return;
  uint32_t adjustedVc = (vc + zxnextCopperVerticalLineOffset) % totalVc;
  if (zxnextCopperStartMode == 3u && adjustedVc == 0u && hc == 0u) {
    zxnextCopperListAddress = 0u;
    zxnextCopperDout = 0u;
    return;
  }
  if (zxnextCopperDout) {
    uint32_t reg = (zxnextCopperListData >> 8u) & 0x7fu;
    uint32_t val = zxnextCopperListData & 0xffu;
    zxnextNextRegSetDirect(reg, val);
    zxnextCopperDout = 0u;
    return;
  }
  zxnextCopperListData =
    ((uint16_t)zxnextCopperMemory[zxnextCopperListAddress * 2u] << 8u) |
    zxnextCopperMemory[zxnextCopperListAddress * 2u + 1u];
  if (zxnextCopperListData & 0x8000u) {
    uint32_t waitLine = zxnextCopperListData & 0x1ffu;
    uint32_t waitHc = ((zxnextCopperListData >> 9u) & 0x3fu) * 8u + 12u;
    if (adjustedVc == waitLine && hc >= waitHc) {
      zxnextCopperListAddress = (zxnextCopperListAddress + 1u) & 0x3ffu;
    }
    return;
  }
  uint32_t reg = (zxnextCopperListData >> 8u) & 0x7fu;
  zxnextCopperListAddress = (zxnextCopperListAddress + 1u) & 0x3ffu;
  if (reg != 0u) zxnextCopperDout = 1u;
}

static uint32_t zxnextCopperReadMemory(uint32_t address) { return zxnextCopperMemory[address & 0x7ffu]; }
static uint32_t zxnextCopperGetStartMode(void) { return zxnextCopperStartMode; }
static uint32_t zxnextCopperGetInstructionAddress(void) { return zxnextCopperInstructionAddress; }
static uint32_t zxnextCopperGetListAddress(void) { return zxnextCopperListAddress; }
static uint32_t zxnextCopperGetListData(void) { return zxnextCopperListData; }
static uint32_t zxnextCopperGetDout(void) { return zxnextCopperDout; }
static uint32_t zxnextCopperGetVerticalLineOffset(void) { return zxnextCopperVerticalLineOffset; }
