#include "zxnext.h"

uint32_t zxnextReadPort(uint32_t address) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  uint8_t value = portReadValue;
  if ((maskedAddress & 0x0001u) == 0u) {
    value = (uint8_t)zxnextReadUlaPort(maskedAddress);
  } else if (maskedAddress == 0x243bu) {
    value = nextRegIndex;
  } else if (maskedAddress == 0x253bu) {
    value = (uint8_t)zxnextReadNextReg(nextRegIndex);
  }
  if (captureBusEvents != 0u) {
    lastPortAddress = maskedAddress;
    lastPortValue = value;
    lastPortIsWrite = 0u;
    hasPortEvent = 1u;
  }
  return value;
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
  if ((maskedAddress & 0x0001u) == 0u) {
    zxnextWriteUlaPort(byteValue);
    return;
  }
  if (maskedAddress == 0x243bu) {
    nextRegIndex = byteValue;
    return;
  }
  if (maskedAddress == 0x253bu) {
    writeNextRegInternal(nextRegIndex, byteValue);
    return;
  }
  if ((maskedAddress & 0xc003u) == 0x4001u) {
    if (isPortGroupEnabled(0, 1) == 0u) return;
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
    if (isPortGroupEnabled(0, 2) == 0u) return;
    if (pagingEnabled == 0u) return;
    selectedBankMsb = byteValue & 0x0fu;
    const uint32_t bank6 = selectedBankMsb * 16u + selectedBankLsb * 2u;
    mmuRegs[6] = (uint8_t)(bank6 & 0xffu);
    mmuRegs[7] = (uint8_t)((bank6 + 1u) & 0xffu);
    updateMemoryConfig(1);
    return;
  }
  if ((maskedAddress & 0xf003u) == 0x1001u) {
    if (isPortGroupEnabled(0, 3) == 0u) return;
    if (pagingEnabled == 0u) return;
    allRamMode = (byteValue & 0x01u) != 0u;
    specialConfig = (byteValue >> 1u) & 0x03u;
    selectedRomMsb = specialConfig & 0x02u;
    updateMemoryConfig(1);
    return;
  }
  if ((maskedAddress & 0xf0ffu) == 0xe0f7u) {
    if (isPortGroupEnabled(3, 2) == 0u) return;
    portEff7Value = byteValue & 0x0cu;
    updateMemoryConfig(1);
    return;
  }
}

void zxnextSetPortReadValue(uint32_t value) {
  portReadValue = (uint8_t)(value & 0xffu);
}
