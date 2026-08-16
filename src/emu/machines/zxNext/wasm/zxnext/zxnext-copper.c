#include "zxnext.h"

#define COPPER_STOPPED 0u
#define COPPER_START_FROM_ZERO_AND_LOOP 1u
#define COPPER_START_FROM_LAST_AND_LOOP 2u
#define COPPER_START_FROM_ZERO_RESTART_ON_ZERO 3u

static uint32_t copperTotalVc(void) {
  return screenIs60Hz != 0u ? ZXNEXT_60HZ_TOTAL_VC : ZXNEXT_50HZ_TOTAL_VC;
}

static void resetCopperState(void) {
  copperStartMode = COPPER_STOPPED;
  copperInstructionAddress = 0u;
  copperStoredByte = 0u;
  copperListAddr = 0u;
  copperListData = 0u;
  copperDout = 0u;
  copperVerticalLineOffset = 0u;
  copperTickCount = 0u;
  copperWriteCount = 0u;
  for (uint32_t i = 0; i < ZXNEXT_COPPER_MEMORY_SIZE; i++) copperMemory[i] = 0u;
}

static uint32_t copperReadNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x61u:
      return copperInstructionAddress & 0xffu;
    case 0x62u:
      return ((uint32_t)copperStartMode << 6u) | ((copperInstructionAddress >> 8u) & 0x07u);
    default:
      return 0xffffffffu;
  }
}

static uint32_t copperWriteNextReg(uint32_t reg, uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  switch (reg & 0xffu) {
    case 0x60u:
      copperMemory[copperInstructionAddress] = byteValue;
      copperInstructionAddress = (uint16_t)((copperInstructionAddress + 1u) & 0x07ffu);
      return 1u;
    case 0x61u:
      copperInstructionAddress = (uint16_t)((copperInstructionAddress & 0x0700u) | byteValue);
      return 1u;
    case 0x62u: {
      const uint8_t newMode = (uint8_t)((byteValue >> 6u) & 0x03u);
      copperInstructionAddress = (uint16_t)(((byteValue & 0x07u) << 8u) | (copperInstructionAddress & 0x00ffu));
      if (newMode != copperStartMode) {
        copperStartMode = newMode;
        if (newMode == COPPER_START_FROM_ZERO_AND_LOOP || newMode == COPPER_START_FROM_ZERO_RESTART_ON_ZERO) {
          copperListAddr = 0u;
          copperDout = 0u;
        }
      }
      return 1u;
    }
    case 0x63u:
      if ((copperInstructionAddress & 0x0001u) != 0u) {
        copperMemory[copperInstructionAddress & 0x07feu] = copperStoredByte;
        copperMemory[copperInstructionAddress] = byteValue;
      }
      copperStoredByte = byteValue;
      copperInstructionAddress = (uint16_t)((copperInstructionAddress + 1u) & 0x07ffu);
      return 1u;
    case 0x64u:
      copperVerticalLineOffset = byteValue;
      return 1u;
    default:
      return 0u;
  }
}

void zxnextCopperExecuteTick(uint32_t vc, uint32_t hc) {
  if (copperStartMode == COPPER_STOPPED) return;
  copperTickCount++;

  const uint32_t totalVc = copperTotalVc();
  const uint32_t adjustedVc = totalVc == 0u ? vc : (vc + copperVerticalLineOffset) % totalVc;
  if (
    copperStartMode == COPPER_START_FROM_ZERO_RESTART_ON_ZERO &&
    adjustedVc == 0u &&
    (hc & 0xffffu) == 0u
  ) {
    copperListAddr = 0u;
    copperDout = 0u;
    return;
  }

  if (copperDout != 0u) {
    const uint32_t reg = (copperListData >> 8u) & 0x7fu;
    const uint32_t data = copperListData & 0xffu;
    copperDout = 0u;
    copperWriteCount++;
    writeNextRegInternal(reg, data);
    return;
  }

  copperListData =
    ((uint16_t)copperMemory[(copperListAddr * 2u) & 0x07ffu] << 8u) |
    (uint16_t)copperMemory[(copperListAddr * 2u + 1u) & 0x07ffu];

  if ((copperListData & 0x8000u) != 0u) {
    const uint32_t waitLine = copperListData & 0x01ffu;
    const uint32_t waitHc = ((copperListData >> 9u) & 0x3fu) * 8u + 12u;
    if (adjustedVc == waitLine && (hc & 0xffffu) >= waitHc) {
      copperListAddr = (uint16_t)((copperListAddr + 1u) & 0x03ffu);
    }
    return;
  }

  copperListAddr = (uint16_t)((copperListAddr + 1u) & 0x03ffu);
  if (((copperListData >> 8u) & 0x7fu) != 0u) {
    copperDout = 1u;
  }
}

uint32_t zxnextReadCopperMemory(uint32_t offset) {
  return copperMemory[offset & 0x07ffu];
}

uint32_t zxnextGetCopperStartMode(void) { return copperStartMode; }
uint32_t zxnextGetCopperInstructionAddress(void) { return copperInstructionAddress; }
uint32_t zxnextGetCopperStoredByte(void) { return copperStoredByte; }
uint32_t zxnextGetCopperListAddr(void) { return copperListAddr; }
uint32_t zxnextGetCopperListData(void) { return copperListData; }
uint32_t zxnextGetCopperDout(void) { return copperDout; }
uint32_t zxnextGetCopperVerticalLineOffset(void) { return copperVerticalLineOffset; }
uint32_t zxnextGetCopperTickCount(void) { return copperTickCount; }
uint32_t zxnextGetCopperWriteCount(void) { return copperWriteCount; }
