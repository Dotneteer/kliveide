#include "zxnext.h"

#define MULTIFACE_NOT_HANDLED 0x1ffu

static uint32_t multifaceEnabled(void) {
  return isPortGroupEnabled(1u, 1u);
}

static uint32_t multifaceMode48(void) {
  return divMmcMultifaceType == 3u;
}

static uint32_t multifaceModeP3(void) {
  return divMmcMultifaceType == 0u;
}

static uint32_t multifaceMode128(void) {
  return multifaceMode48() == 0u && multifaceModeP3() == 0u;
}

static uint32_t multifaceInvisibleEff(void) {
  return multifaceInvisible != 0u && multifaceMode48() == 0u;
}

static uint32_t multifaceEnablePortAddress(void) {
  if (divMmcMultifaceType == 2u || divMmcMultifaceType == 3u) return 0x9fu;
  return divMmcMultifaceType == 1u ? 0xbfu : 0x3fu;
}

static uint32_t multifaceDisablePortAddress(void) {
  if (divMmcMultifaceType == 2u || divMmcMultifaceType == 3u) return 0x1fu;
  return divMmcMultifaceType == 1u ? 0x3fu : 0xbfu;
}

static uint32_t multifaceIsActive(void) {
  return multifaceEnabled() != 0u && (multifaceMfEnabled != 0u || multifaceNmiActive != 0u);
}

static uint32_t multifaceNmiHold(void) {
  return multifaceEnabled() != 0u && multifaceNmiActive != 0u;
}

static uint32_t multifaceMfPortEn(void) {
  return multifaceEnabled() != 0u &&
    multifaceInvisibleEff() == 0u &&
    (multifaceMode128() != 0u || multifaceModeP3() != 0u);
}

static void resetMultifaceState(void) {
  multifaceNmiActive = 0u;
  multifaceMfEnabled = 0u;
  multifaceInvisible = 1u;
  rebuildFlatMemory();
}

static uint32_t multifaceReadOffset(uint32_t address) {
  if (multifaceMfEnabled == 0u || (address & 0xffffu) >= 0x4000u) return ZXNEXT_INVALID_PAGE_OFFSET;
  const uint32_t page = (address >> 13u) & 0x01u;
  return ZXNEXT_MULTIFACE_ROM_OFFSET + page * ZXNEXT_PAGE_SIZE + (address & 0x1fffu);
}

static uint32_t multifaceHandleWrite(uint32_t address, uint32_t value) {
  if (multifaceMfEnabled == 0u || (address & 0xffffu) >= 0x4000u) return 0u;
  const uint32_t page = (address >> 13u) & 0x01u;
  if (page == 0u) return 1u;
  zxnextWritePhysical(ZXNEXT_MULTIFACE_ROM_OFFSET + ZXNEXT_PAGE_SIZE + (address & 0x1fffu), value);
  flatMemory[address & 0xffffu] = (uint8_t)(value & 0xffu);
  return 1u;
}

static uint32_t multifaceGetPortData(uint32_t portAddress) {
  if (multifaceModeP3() != 0u) {
    switch ((portAddress >> 12u) & 0x0fu) {
      case 0x01u: return zxnextGetPort1ffdValue() & 0xffu;
      case 0x07u: return zxnextGetPort7ffdValue() & 0xffu;
      case 0x0du: return zxnextGetPortDffdValue() & 0xffu;
      case 0x0eu: return zxnextGetPortEff7Value() & 0x0cu;
      default: return ulaBorderColor & 0x07u;
    }
  }
  return (((zxnextGetPort7ffdValue() >> 3u) & 0x01u) << 7u) | 0x7fu;
}

static uint32_t multifaceReadEnablePort(uint32_t portAddress) {
  const uint32_t mfPortEn = multifaceMfPortEn();
  multifaceMfEnabled = multifaceInvisibleEff() == 0u;
  rebuildFlatMemory();
  return mfPortEn != 0u ? multifaceGetPortData(portAddress) : MULTIFACE_NOT_HANDLED;
}

static uint32_t multifaceReadDisablePort(void) {
  multifaceMfEnabled = 0u;
  if (multifaceModeP3() != 0u) multifaceNmiActive = 0u;
  rebuildFlatMemory();
  return MULTIFACE_NOT_HANDLED;
}

uint32_t zxnextReadMultifacePort(uint32_t address) {
  if (multifaceEnabled() == 0u) return MULTIFACE_NOT_HANDLED;
  const uint32_t lowByte = address & 0xffu;
  if (lowByte == multifaceEnablePortAddress()) return multifaceReadEnablePort(address);
  if (lowByte == multifaceDisablePortAddress()) return multifaceReadDisablePort();
  return MULTIFACE_NOT_HANDLED;
}

static void multifaceWriteEnablePort(void) {
  multifaceNmiActive = 0u;
  if (multifaceModeP3() != 0u) multifaceInvisible = 1u;
  rebuildFlatMemory();
}

static void multifaceWriteDisablePort(void) {
  multifaceNmiActive = 0u;
  if (multifaceModeP3() == 0u) multifaceInvisible = 1u;
  rebuildFlatMemory();
}

void zxnextWriteMultifacePort(uint32_t address, uint32_t value) {
  (void)value;
  if (multifaceEnabled() == 0u) return;
  const uint32_t lowByte = address & 0xffu;
  if (lowByte == multifaceEnablePortAddress()) multifaceWriteEnablePort();
  else if (lowByte == multifaceDisablePortAddress()) multifaceWriteDisablePort();
}

static void multifacePressNmiButton(void) {
  if (multifaceEnabled() == 0u) return;
  if (multifaceNmiActive == 0u) {
    multifaceNmiActive = 1u;
    multifaceInvisible = 0u;
  }
}

static void multifaceOnFetch0066(void) {
  if (multifaceEnabled() == 0u) return;
  if (multifaceNmiActive != 0u) {
    multifaceMfEnabled = 1u;
    rebuildFlatMemory();
  }
}

static void multifaceHandleRetn(void) {
  multifaceNmiActive = 0u;
  multifaceMfEnabled = 0u;
  rebuildFlatMemory();
}

static void syncPeripheral5FromNextReg(uint32_t value) {
  if (nextRegConfigMode != 0u) divMmcMultifaceType = (uint8_t)((value >> 6u) & 0x03u);
  zxnextSetDivMmcEnableAutomap(value & 0x10u);
}

static void resetNmiState(void) {
  nmiState = ZXNEXT_NMI_STATE_IDLE;
  nmiSourceMf = 0u;
  nmiSourceDivMmc = 0u;
  nmiSourceExpBus = 0u;
  pendingMfNmi = 0u;
  pendingDivMmcNmi = 0u;
  sigNmi = 0u;
}

void zxnextRequestMfNmi(void) {
  if (nmiState == ZXNEXT_NMI_STATE_IDLE || nmiState == ZXNEXT_NMI_STATE_FETCH) pendingMfNmi = 1u;
}

void zxnextRequestDivMmcNmi(void) {
  if (nmiState == ZXNEXT_NMI_STATE_IDLE || nmiState == ZXNEXT_NMI_STATE_FETCH) pendingDivMmcNmi = 1u;
}

static uint32_t nmiActivated(void) {
  return nmiSourceMf != 0u || nmiSourceDivMmc != 0u || nmiSourceExpBus != 0u;
}

static uint32_t nmiHoldActive(void) {
  if (nmiSourceMf != 0u) return multifaceNmiHold();
  if (nmiSourceDivMmc != 0u) return divMmcNmiButtonPressed != 0u || divMmcAutoMapActive != 0u;
  return 0u;
}

static void nmiUpdateSources(void) {
  if (nmiActivated() != 0u) return;
  const uint32_t mfEnabled = (nextRegs[0x06u] & 0x08u) != 0u;
  const uint32_t divEnabled = (nextRegs[0x06u] & 0x10u) != 0u;
  const uint32_t assertMf = pendingMfNmi != 0u && mfEnabled != 0u;
  const uint32_t assertDivMmc = pendingDivMmcNmi != 0u && divEnabled != 0u;

  if (assertMf != 0u && divMmcConmem == 0u && (divMmcNmiButtonPressed == 0u && divMmcAutoMapActive == 0u)) {
    nmiSourceMf = 1u;
    pendingMfNmi = 0u;
  } else if (assertDivMmc != 0u && multifaceIsActive() == 0u) {
    nmiSourceDivMmc = 1u;
    pendingDivMmcNmi = 0u;
  } else if (expansionIsNmiAsserted() != 0u) {
    nmiSourceExpBus = 1u;
    expansionNmiPending = 0u;
  }
}

void zxnextNmiBeforeOpcodeFetch(uint32_t pc) {
  if (nmiState == ZXNEXT_NMI_STATE_IDLE || nmiState == ZXNEXT_NMI_STATE_FETCH) nmiUpdateSources();

  switch (nmiState) {
    case ZXNEXT_NMI_STATE_IDLE:
      if (nmiActivated() != 0u) {
        nmiState = ZXNEXT_NMI_STATE_FETCH;
        sigNmi = 1u;
        if (nmiSourceMf != 0u) multifacePressNmiButton();
        if (nmiSourceDivMmc != 0u) divMmcNmiButtonPressed = 1u;
      }
      break;
    case ZXNEXT_NMI_STATE_FETCH:
      if ((pc & 0xffffu) == 0x0066u) {
        if (nmiSourceMf != 0u) multifaceOnFetch0066();
        nmiState = ZXNEXT_NMI_STATE_HOLD;
        sigNmi = 0u;
      }
      break;
    case ZXNEXT_NMI_STATE_HOLD:
      if (nmiHoldActive() == 0u) nmiState = ZXNEXT_NMI_STATE_END;
      break;
    case ZXNEXT_NMI_STATE_END:
      nmiSourceMf = 0u;
      nmiSourceDivMmc = 0u;
      nmiSourceExpBus = 0u;
      nmiState = ZXNEXT_NMI_STATE_IDLE;
      break;
    default:
      resetNmiState();
      break;
  }
}

uint32_t zxnextGetMultifaceType(void) { return divMmcMultifaceType; }
void zxnextSetMultifaceType(uint32_t value) { divMmcMultifaceType = (uint8_t)(value & 0x03u); }
uint32_t zxnextGetMultifaceEnabled(void) { return multifaceEnabled(); }
uint32_t zxnextGetMultifaceNmiActive(void) { return multifaceNmiActive; }
uint32_t zxnextGetMultifaceMfEnabled(void) { return multifaceMfEnabled; }
uint32_t zxnextGetMultifaceInvisible(void) { return multifaceInvisible; }
uint32_t zxnextGetMultifaceIsActive(void) { return multifaceIsActive(); }
uint32_t zxnextGetMultifaceNmiHold(void) { return multifaceNmiHold(); }
uint32_t zxnextGetMultifaceEnablePortAddress(void) { return multifaceEnablePortAddress(); }
uint32_t zxnextGetMultifaceDisablePortAddress(void) { return multifaceDisablePortAddress(); }
uint32_t zxnextGetMultifaceMfPortEn(void) { return multifaceMfPortEn(); }
void zxnextPressMultifaceNmiButton(void) { multifacePressNmiButton(); }
void zxnextMultifaceOnFetch0066(void) { multifaceOnFetch0066(); }
void zxnextMultifaceHandleRetn(void) { multifaceHandleRetn(); }
uint32_t zxnextGetNmiState(void) { return nmiState; }
uint32_t zxnextGetNmiSourceMf(void) { return nmiSourceMf; }
uint32_t zxnextGetNmiSourceDivMmc(void) { return nmiSourceDivMmc; }
uint32_t zxnextGetNmiSourceExpBus(void) { return nmiSourceExpBus; }
uint32_t zxnextGetPendingMfNmi(void) { return pendingMfNmi; }
uint32_t zxnextGetPendingDivMmcNmi(void) { return pendingDivMmcNmi; }
uint32_t zxnextGetSigNmi(void) { return sigNmi; }
