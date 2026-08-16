#include "zxnext.h"

static void rebuildMemoryAfterDivMmcChange(void) {
  rebuildFlatMemory();
}

static void resetDivMmcState(void) {
  divMmcEnabled = 1u;
  divMmcConmem = 0u;
  divMmcMapram = 0u;
  divMmcBank = 0u;
  divMmcMultifaceType = 0u;
  divMmcLastE3Value = 0u;
  divMmcEnableAutomap = 0u;
  divMmcRequestAutomapOn = 0u;
  divMmcRequestAutomapOff = 0u;
  divMmcAutoMapActive = 0u;
  divMmcNmiButtonPressed = 0u;
  divMmcResetMapramFlag = 0u;
  divMmcRstTrapEnabled = 0u;
  divMmcRstTrapOnlyWithRom3 = 0xffu;
  divMmcRstTrapInstant = 0u;
  divMmcEntry1 = 0u;
}

static void syncDivMmcStateFromNextRegs(void) {
  divMmcEnabled = (nextRegs[0x83u] & 0x01u) != 0u;
  divMmcEnableAutomap = (nextRegs[0x0au] & 0x10u) != 0u;
  if (divMmcEnableAutomap == 0u || divMmcEnabled == 0u) {
    divMmcAutoMapActive = 0u;
    divMmcRequestAutomapOn = 0u;
    divMmcRequestAutomapOff = 0u;
    divMmcNmiButtonPressed = 0u;
  }
  divMmcResetMapramFlag = (nextRegs[0x09u] & 0x08u) != 0u;
  divMmcRstTrapEnabled = nextRegs[0xb8u];
  divMmcRstTrapOnlyWithRom3 = (uint8_t)(~nextRegs[0xb9u]);
  divMmcRstTrapInstant = nextRegs[0xbau];
  divMmcEntry1 = nextRegs[0xbbu];
  rebuildMemoryAfterDivMmcChange();
}

static uint32_t divMmcIsActive(void) {
  return divMmcEnabled != 0u && (divMmcConmem != 0u || divMmcAutoMapActive != 0u);
}

static uint32_t divMmcReadOffset(uint32_t address) {
  if (divMmcIsActive() == 0u || address >= 0x4000u) return ZXNEXT_INVALID_PAGE_OFFSET;
  const uint32_t page = address >> 13u;
  if (page != 0u) return ZXNEXT_DIVMMC_RAM_OFFSET + ((uint32_t)divMmcBank << 13u);
  if (divMmcMapram != 0u) return ZXNEXT_DIVMMC_RAM_OFFSET + (3u << 13u);
  return ZXNEXT_DIVMMC_ROM_OFFSET;
}

static uint32_t divMmcHandleWrite(uint32_t address, uint32_t value) {
  if (divMmcIsActive() == 0u || address >= 0x4000u) return 0u;
  const uint32_t page = address >> 13u;
  if (page == 0u || (divMmcMapram != 0u && divMmcBank == 3u)) return 1u;
  const uint32_t physicalOffset = ZXNEXT_DIVMMC_RAM_OFFSET + ((uint32_t)divMmcBank << 13u) + (address & 0x1fffu);
  zxnextWritePhysical(physicalOffset, value);
  flatMemory[address & 0xffffu] = (uint8_t)(value & 0xffu);
  return 1u;
}

uint32_t zxnextReadDivMmcPortE3(void) {
  if (divMmcEnabled == 0u) return 0xffu;
  return (divMmcConmem ? 0x80u : 0x00u) | (divMmcMapram ? 0x40u : 0x00u) | (divMmcBank & 0x0fu);
}

void zxnextWriteDivMmcPortE3(uint32_t value) {
  if (divMmcEnabled == 0u) return;
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  divMmcLastE3Value = byteValue;
  divMmcConmem = (byteValue & 0x80u) != 0u;
  const uint8_t mapramBit = (byteValue & 0x40u) != 0u;
  if (divMmcMapram == 0u) {
    divMmcMapram = mapramBit;
  } else if (mapramBit == 0u && divMmcResetMapramFlag != 0u) {
    divMmcMapram = 0u;
  }
  divMmcBank = byteValue & 0x0fu;
  rebuildMemoryAfterDivMmcChange();
}

void zxnextSetDivMmcEnabled(uint32_t enabled) {
  const uint8_t newEnabled = enabled != 0u;
  if (divMmcEnabled == newEnabled) return;
  divMmcEnabled = newEnabled;
  if (divMmcEnabled != 0u) {
    zxnextWriteDivMmcPortE3(divMmcLastE3Value);
  } else {
    divMmcAutoMapActive = 0u;
    divMmcRequestAutomapOn = 0u;
    divMmcRequestAutomapOff = 0u;
    rebuildMemoryAfterDivMmcChange();
  }
}

void zxnextSetDivMmcEnableAutomap(uint32_t enabled) {
  const uint8_t newEnabled = enabled != 0u;
  if (divMmcEnableAutomap == newEnabled) return;
  divMmcEnableAutomap = newEnabled;
  if (divMmcEnableAutomap == 0u) {
    divMmcAutoMapActive = 0u;
    divMmcRequestAutomapOn = 0u;
    divMmcRequestAutomapOff = 0u;
    divMmcNmiButtonPressed = 0u;
    rebuildMemoryAfterDivMmcChange();
  }
}

static void setAutomapRequest(uint32_t instant) {
  if (instant != 0u) {
    if (divMmcAutoMapActive == 0u) {
      divMmcAutoMapActive = 1u;
      divMmcNmiButtonPressed = 0u;
      rebuildMemoryAfterDivMmcChange();
    }
    divMmcRequestAutomapOn = 0u;
  } else {
    divMmcRequestAutomapOn = 1u;
  }
}

static uint32_t rom3AutomapActive(void) {
  return (selectedRomMsb | selectedRomLsb) == 0x03u;
}

static void checkRstTraps(uint32_t pc, uint32_t rom3Present) {
  if (pc > 0x38u || (pc & 0x07u) != 0u) return;
  const uint32_t index = pc >> 3u;
  const uint32_t mask = 1u << index;
  if ((divMmcRstTrapEnabled & mask) == 0u) return;
  if ((divMmcRstTrapOnlyWithRom3 & mask) != 0u && rom3Present == 0u) return;
  setAutomapRequest(divMmcRstTrapInstant & mask);
}

static void checkEntry1(uint32_t pc, uint32_t rom3Present) {
  if (pc >= 0x3d00u && pc <= 0x3dffu) {
    if ((divMmcEntry1 & 0x80u) != 0u && rom3Present != 0u) setAutomapRequest(1u);
    return;
  }
  if (pc >= 0x1ff8u && pc <= 0x1fffu) {
    if ((divMmcEntry1 & 0x40u) != 0u) divMmcRequestAutomapOff = 1u;
    return;
  }
  if (rom3Present == 0u) return;
  if (pc == 0x056au && (divMmcEntry1 & 0x20u) != 0u) setAutomapRequest(0u);
  if (pc == 0x04d7u && (divMmcEntry1 & 0x10u) != 0u) setAutomapRequest(0u);
  if (pc == 0x0562u && (divMmcEntry1 & 0x08u) != 0u) setAutomapRequest(0u);
  if (pc == 0x04c6u && (divMmcEntry1 & 0x04u) != 0u) setAutomapRequest(0u);
  if (pc == 0x0066u && divMmcNmiButtonPressed != 0u) {
    if ((divMmcEntry1 & 0x02u) != 0u) setAutomapRequest(1u);
    else if ((divMmcEntry1 & 0x01u) != 0u) setAutomapRequest(0u);
  }
}

static void zxnextDivMmcBeforeOpcodeFetch(uint32_t pc) {
  if (divMmcEnabled == 0u || divMmcEnableAutomap == 0u) return;
  const uint32_t rom3Present = rom3AutomapActive();
  checkRstTraps(pc & 0xffffu, rom3Present);
  checkEntry1(pc & 0xffffu, rom3Present);
}

static void zxnextDivMmcAfterOpcodeFetch(uint32_t retnExecuted) {
  if (retnExecuted != 0u) {
    divMmcNmiButtonPressed = 0u;
    divMmcAutoMapActive = 0u;
    divMmcRequestAutomapOn = 0u;
    divMmcRequestAutomapOff = 0u;
    rebuildMemoryAfterDivMmcChange();
    return;
  }
  if (divMmcRequestAutomapOn != 0u) {
    divMmcAutoMapActive = 1u;
    divMmcRequestAutomapOn = 0u;
    divMmcNmiButtonPressed = 0u;
    rebuildMemoryAfterDivMmcChange();
  } else if (divMmcRequestAutomapOff != 0u) {
    divMmcAutoMapActive = 0u;
    divMmcRequestAutomapOff = 0u;
    rebuildMemoryAfterDivMmcChange();
  }
}

uint32_t zxnextGetDivMmcEnabled(void) { return divMmcEnabled; }
uint32_t zxnextGetDivMmcConmem(void) { return divMmcConmem; }
uint32_t zxnextGetDivMmcMapram(void) { return divMmcMapram; }
uint32_t zxnextGetDivMmcBank(void) { return divMmcBank; }
uint32_t zxnextGetDivMmcPortE3Value(void) { return zxnextReadDivMmcPortE3(); }
uint32_t zxnextGetDivMmcEnableAutomap(void) { return divMmcEnableAutomap; }
uint32_t zxnextGetDivMmcAutoMapActive(void) { return divMmcAutoMapActive; }
uint32_t zxnextGetDivMmcRstTrapEnabledMask(void) { return divMmcRstTrapEnabled; }
uint32_t zxnextGetDivMmcRstTrapOnlyWithRom3Mask(void) { return divMmcRstTrapOnlyWithRom3; }
uint32_t zxnextGetDivMmcRstTrapInstantMask(void) { return divMmcRstTrapInstant; }
uint32_t zxnextGetDivMmcEntry1(void) { return divMmcEntry1; }
