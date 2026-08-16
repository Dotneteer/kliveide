#include "zxnext.h"

static uint32_t ownerStepForUnsupportedPort(uint16_t port) {
  if (port == 0x00e3u) return 16u;
  if (port == 0x123bu) return 22u;
  if (port == 0x00ffu || port == 0xbf3bu || port == 0xff3bu) return 21u;
  if (port == 0x303bu || port == 0x0057u || port == 0x005bu || port == 0x005du) return 24u;
  if (port == 0x006bu || port == 0x006fu) return 27u;
  if ((port & 0xfffbu) == 0x183bu) return 29u;
  if (port == 0x001fu || port == 0x0037u) return 31u;
  if (port == 0xfbdfu || port == 0xffdfu || port == 0xfadfu) return 32u;
  return 34u;
}

static uint8_t fallbackReadValueForUnsupportedPort(uint16_t port) {
  if (port == 0x123bu) return 0x00u;
  return portReadValue;
}

static void recordUnsupportedPort(uint16_t port, uint8_t value, uint8_t isWrite) {
  if (isWrite != 0u) {
    unsupportedPortWriteCount++;
  } else {
    unsupportedPortReadCount++;
  }
  if (firstUnsupportedPortOwnerStep == 0u) {
    firstUnsupportedPortAddress = port;
    firstUnsupportedPortValue = value;
    firstUnsupportedPortIsWrite = isWrite;
    firstUnsupportedPortOwnerStep = (uint8_t)ownerStepForUnsupportedPort(port);
  }
  diagnosticBuffer[0] = zxnextGetDiagnosticFlags();
  diagnosticBuffer[1] = unsupportedPortReadCount;
  diagnosticBuffer[2] = unsupportedPortWriteCount;
  diagnosticBuffer[3] = firstUnsupportedPortAddress;
  diagnosticBuffer[4] = firstUnsupportedPortValue;
  diagnosticBuffer[5] = firstUnsupportedPortIsWrite;
  diagnosticBuffer[6] = firstUnsupportedPortOwnerStep;
}

uint32_t zxnextReadPort(uint32_t address) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  uint8_t value = portReadValue;
  if ((maskedAddress & 0x0001u) == 0u) {
    value = (uint8_t)zxnextReadUlaPort(maskedAddress);
  } else if (maskedAddress == 0x243bu) {
    value = nextRegIndex;
  } else if (maskedAddress == 0x253bu) {
    value = (uint8_t)zxnextReadNextReg(nextRegIndex);
  } else if (maskedAddress == 0x00e3u) {
    value = isPortGroupEnabled(1, 0) != 0u ? (uint8_t)zxnextReadDivMmcPortE3() : 0xffu;
  } else {
    value = fallbackReadValueForUnsupportedPort(maskedAddress);
    recordUnsupportedPort(maskedAddress, value, 0u);
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
  if (maskedAddress == 0x00e3u) {
    if (isPortGroupEnabled(1, 0) != 0u) zxnextWriteDivMmcPortE3(byteValue);
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
  recordUnsupportedPort(maskedAddress, byteValue, 1u);
}

void zxnextSetPortReadValue(uint32_t value) {
  portReadValue = (uint8_t)(value & 0xffu);
}
