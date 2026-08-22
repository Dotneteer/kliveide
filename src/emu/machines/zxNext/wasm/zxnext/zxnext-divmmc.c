#include "zxnext-divmmc.h"
#include "zxnext-memory.h"

#define ZXNEXT_OFFS_DIVMMC_ROM 0x010000u
#define ZXNEXT_OFFS_DIVMMC_RAM 0x020000u
#define ZXNEXT_OFFS_DIVMMC_RAM_BANK_3 (ZXNEXT_OFFS_DIVMMC_RAM + 3u * 0x2000u)

static uint8_t divMmcEnabled;
static uint8_t divMmcConmem;
static uint8_t divMmcMapram;
static uint8_t divMmcBank;
static uint8_t divMmcPortLastE3Value;
static uint8_t divMmcEnableAutomap;
static uint8_t divMmcRequestAutomapOn;
static uint8_t divMmcRequestAutomapOff;
static uint8_t divMmcAutoMapActive;
static uint8_t divMmcConmemActivated;
static uint8_t divMmcNmiButtonPressed;
static uint8_t divMmcResetMapramFlag;
static uint8_t divMmcEnableNmiByDriveButton;
static uint8_t divMmcEnableMultifaceNmiByM1Button;
static uint8_t divMmcRstEnabled[8];
static uint8_t divMmcRstOnlyWithRom3[8];
static uint8_t divMmcRstInstant[8];
static uint8_t divMmcAutomapOn3dxx;
static uint8_t divMmcAutomapOff1ff8;
static uint8_t divMmcAutomapOn056a;
static uint8_t divMmcAutomapOn04d7;
static uint8_t divMmcAutomapOn0562;
static uint8_t divMmcAutomapOn04c6;
static uint8_t divMmcAutomapOn0066;
static uint8_t divMmcAutomapOn0066Delayed;

static void zxnextDivMmcNotifyMappingChange(void) {
  zxnextMemoryUpdateMapping();
}

static uint32_t zxnextDivMmcRom3Present(void) {
  return zxnextMemoryGetSelectedRomPage() == 3u;
}

static void zxnextDivMmcSetAutomapRequest(uint32_t instant) {
  if (instant) {
    if (!divMmcAutoMapActive) {
      divMmcAutoMapActive = 1;
      divMmcNmiButtonPressed = 0;
      zxnextDivMmcNotifyMappingChange();
    }
    divMmcRequestAutomapOn = 0;
  } else {
    divMmcRequestAutomapOn = 1;
  }
}

static void zxnextDivMmcCheckManualConmem(void) {
  if (divMmcConmem && !divMmcConmemActivated) {
    divMmcConmemActivated = 1;
    zxnextDivMmcNotifyMappingChange();
  } else if (!divMmcConmem && divMmcConmemActivated) {
    divMmcConmemActivated = 0;
    zxnextDivMmcNotifyMappingChange();
  }
}

static void zxnextDivMmcCheckRstTraps(uint32_t pc, uint32_t rom3Present) {
  if (pc > 0x38u || (pc & 0x07u) != 0) return;
  uint32_t index = pc >> 3;
  if (!divMmcRstEnabled[index]) return;
  if (divMmcRstOnlyWithRom3[index] && !rom3Present) return;
  zxnextDivMmcSetAutomapRequest(divMmcRstInstant[index]);
}

static void zxnextDivMmcCheckCustomEntry(uint32_t pc, uint32_t rom3Present) {
  if (!rom3Present) return;
  if ((pc == 0x04c6u && divMmcAutomapOn04c6) ||
      (pc == 0x0562u && divMmcAutomapOn0562) ||
      (pc == 0x04d7u && divMmcAutomapOn04d7) ||
      (pc == 0x056au && divMmcAutomapOn056a)) {
    zxnextDivMmcSetAutomapRequest(0);
  }
}

static void zxnextDivMmcCheckNmiEntry(uint32_t pc) {
  if (pc != 0x0066u) return;
  if (!divMmcEnableNmiByDriveButton || !divMmcNmiButtonPressed) return;
  if (!divMmcAutomapOn0066 && !divMmcAutomapOn0066Delayed) return;
  zxnextDivMmcSetAutomapRequest(divMmcAutomapOn0066);
}

static void zxnextDivMmcCheckRangeEntry(uint32_t pc, uint32_t rom3Present) {
  if (pc >= 0x3d00u && pc <= 0x3dffu) {
    if (rom3Present && divMmcAutomapOn3dxx) zxnextDivMmcSetAutomapRequest(1);
    return;
  }
  if (pc >= 0x1ff8u && pc <= 0x1fffu && divMmcAutomapOff1ff8) {
    divMmcRequestAutomapOff = 1;
  }
}

static void zxnextDivMmcReset(void) {
  divMmcEnabled = 1;
  divMmcConmem = 0;
  divMmcMapram = 0;
  divMmcBank = 0;
  divMmcPortLastE3Value = 0;
  divMmcEnableAutomap = 0;
  divMmcRequestAutomapOn = 0;
  divMmcRequestAutomapOff = 0;
  divMmcAutoMapActive = 0;
  divMmcConmemActivated = 0;
  divMmcNmiButtonPressed = 0;
  divMmcResetMapramFlag = 0;
  divMmcEnableNmiByDriveButton = 0;
  divMmcEnableMultifaceNmiByM1Button = 0;
  for (uint32_t i = 0; i < 8u; i++) {
    divMmcRstEnabled[i] = 0;
    divMmcRstOnlyWithRom3[i] = 0;
    divMmcRstInstant[i] = 0;
  }
  divMmcAutomapOn3dxx = 0;
  divMmcAutomapOff1ff8 = 0;
  divMmcAutomapOn056a = 0;
  divMmcAutomapOn04d7 = 0;
  divMmcAutomapOn0562 = 0;
  divMmcAutomapOn04c6 = 0;
  divMmcAutomapOn0066 = 0;
  divMmcAutomapOn0066Delayed = 0;
}

static void zxnextDivMmcSetPortE3(uint32_t value) {
  if (!divMmcEnabled) return;
  uint8_t byteValue = (uint8_t)value;
  divMmcPortLastE3Value = byteValue;
  uint8_t oldMapping = (uint8_t)zxnextDivMmcIsMappingActive();
  divMmcConmem = (byteValue & 0x80u) != 0;
  uint8_t mapramBit = (byteValue & 0x40u) != 0;
  if (!divMmcMapram) {
    divMmcMapram = mapramBit;
  } else if (!mapramBit && divMmcResetMapramFlag) {
    divMmcMapram = 0;
  }
  divMmcBank = byteValue & 0x0fu;
  if (oldMapping || zxnextDivMmcIsMappingActive()) zxnextDivMmcNotifyMappingChange();
}

static uint32_t zxnextDivMmcGetPortE3(void) {
  if (!divMmcEnabled) return 0xffu;
  return (divMmcConmem ? 0x80u : 0x00u) |
    (divMmcMapram ? 0x40u : 0x00u) |
    (divMmcBank & 0x0fu);
}

static void zxnextDivMmcSetNextReg83(uint32_t value) {
  uint8_t oldEnabled = divMmcEnabled;
  divMmcEnabled = ((uint8_t)value & 0x01u) != 0;
  if (oldEnabled == divMmcEnabled) return;
  if (divMmcEnabled) {
    zxnextDivMmcSetPortE3(divMmcPortLastE3Value);
  } else {
    divMmcAutoMapActive = 0;
    divMmcConmemActivated = 0;
    zxnextDivMmcNotifyMappingChange();
  }
}

static void zxnextDivMmcSetNextReg0A(uint32_t value) {
  uint8_t newEnable = ((uint8_t)value & 0x10u) != 0;
  if (divMmcEnableAutomap == newEnable) return;
  divMmcEnableAutomap = newEnable;
  if (!newEnable) {
    divMmcAutoMapActive = 0;
    divMmcConmemActivated = 0;
    divMmcNmiButtonPressed = 0;
    divMmcRequestAutomapOn = 0;
    divMmcRequestAutomapOff = 0;
    zxnextDivMmcNotifyMappingChange();
  }
}

static void zxnextDivMmcSetNextReg09(uint32_t value) {
  divMmcResetMapramFlag = ((uint8_t)value & 0x08u) != 0;
}

static void zxnextDivMmcSetNextRegB8(uint32_t value) {
  for (uint32_t i = 0; i < 8u; i++) divMmcRstEnabled[i] = (((uint8_t)value >> i) & 0x01u) != 0;
}

static void zxnextDivMmcSetNextRegB9(uint32_t value) {
  for (uint32_t i = 0; i < 8u; i++) divMmcRstOnlyWithRom3[i] = ((((uint8_t)value >> i) & 0x01u) == 0);
}

static void zxnextDivMmcSetNextRegBA(uint32_t value) {
  for (uint32_t i = 0; i < 8u; i++) divMmcRstInstant[i] = (((uint8_t)value >> i) & 0x01u) != 0;
}

static void zxnextDivMmcSetNextRegBB(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  divMmcAutomapOn3dxx = (byteValue & 0x80u) != 0;
  divMmcAutomapOff1ff8 = (byteValue & 0x40u) != 0;
  divMmcAutomapOn056a = (byteValue & 0x20u) != 0;
  divMmcAutomapOn04d7 = (byteValue & 0x10u) != 0;
  divMmcAutomapOn0562 = (byteValue & 0x08u) != 0;
  divMmcAutomapOn04c6 = (byteValue & 0x04u) != 0;
  divMmcAutomapOn0066 = (byteValue & 0x02u) != 0;
  divMmcAutomapOn0066Delayed = (byteValue & 0x01u) != 0;
}

static void zxnextDivMmcSetEnableNmiByDriveButton(uint32_t enabled) {
  divMmcEnableNmiByDriveButton = enabled != 0u;
}

static void zxnextDivMmcSetEnableMultifaceNmiByM1Button(uint32_t enabled) {
  divMmcEnableMultifaceNmiByM1Button = enabled != 0u;
}

static uint32_t zxnextDivMmcGetEnableNmiByDriveButton(void) {
  return divMmcEnableNmiByDriveButton;
}

static uint32_t zxnextDivMmcGetEnableMultifaceNmiByM1Button(void) {
  return divMmcEnableMultifaceNmiByM1Button;
}

static uint32_t zxnextDivMmcGetNextRegB8(void) {
  uint32_t value = 0;
  for (uint32_t i = 0; i < 8u; i++) value |= divMmcRstEnabled[i] ? (1u << i) : 0u;
  return value;
}

static uint32_t zxnextDivMmcGetNextRegB9(void) {
  uint32_t value = 0;
  for (uint32_t i = 0; i < 8u; i++) value |= divMmcRstOnlyWithRom3[i] ? 0u : (1u << i);
  return value;
}

static uint32_t zxnextDivMmcGetNextRegBA(void) {
  uint32_t value = 0;
  for (uint32_t i = 0; i < 8u; i++) value |= divMmcRstInstant[i] ? (1u << i) : 0u;
  return value;
}

static uint32_t zxnextDivMmcGetNextRegBB(void) {
  return (divMmcAutomapOn3dxx ? 0x80u : 0x00u) |
    (divMmcAutomapOff1ff8 ? 0x40u : 0x00u) |
    (divMmcAutomapOn056a ? 0x20u : 0x00u) |
    (divMmcAutomapOn04d7 ? 0x10u : 0x00u) |
    (divMmcAutomapOn0562 ? 0x08u : 0x00u) |
    (divMmcAutomapOn04c6 ? 0x04u : 0x00u) |
    (divMmcAutomapOn0066 ? 0x02u : 0x00u) |
    (divMmcAutomapOn0066Delayed ? 0x01u : 0x00u);
}

static void zxnextDivMmcBeforeOpcodeFetch(uint32_t pc) {
  zxnextDivMmcCheckManualConmem();
  if (!divMmcEnableAutomap) return;
  uint32_t rom3Present = zxnextDivMmcRom3Present();
  zxnextDivMmcCheckRstTraps(pc & 0xffffu, rom3Present);
  zxnextDivMmcCheckNmiEntry(pc & 0xffffu);
  zxnextDivMmcCheckCustomEntry(pc & 0xffffu, rom3Present);
  zxnextDivMmcCheckRangeEntry(pc & 0xffffu, rom3Present);
}

static void zxnextDivMmcAfterOpcodeFetch(uint32_t retnSeen, uint32_t suppressRetn) {
  if (retnSeen && !suppressRetn) {
    divMmcNmiButtonPressed = 0;
    divMmcAutoMapActive = 0;
    divMmcConmemActivated = 0;
    divMmcRequestAutomapOn = 0;
    divMmcRequestAutomapOff = 0;
    zxnextDivMmcNotifyMappingChange();
    return;
  }
  if (divMmcRequestAutomapOn) {
    divMmcAutoMapActive = 1;
    divMmcRequestAutomapOn = 0;
    divMmcNmiButtonPressed = 0;
    zxnextDivMmcNotifyMappingChange();
  } else if (divMmcRequestAutomapOff) {
    divMmcAutoMapActive = 0;
    divMmcRequestAutomapOff = 0;
    zxnextDivMmcNotifyMappingChange();
  }
}

static void zxnextDivMmcArmNmiButton(void) {
  divMmcNmiButtonPressed = 1;
}

static void zxnextDivMmcUpdateMemoryMapping(void) {
  zxnextDivMmcNotifyMappingChange();
}

static uint32_t zxnextDivMmcGetEnabled(void) { return divMmcEnabled; }
static uint32_t zxnextDivMmcGetEnableAutomap(void) { return divMmcEnableAutomap; }
static uint32_t zxnextDivMmcGetConmem(void) { return divMmcConmem; }
static uint32_t zxnextDivMmcGetMapram(void) { return divMmcMapram; }
static uint32_t zxnextDivMmcGetBank(void) { return divMmcBank; }
static uint32_t zxnextDivMmcGetAutoMapActive(void) { return divMmcAutoMapActive; }
static uint32_t zxnextDivMmcGetRequestAutomapOn(void) { return divMmcRequestAutomapOn; }
static uint32_t zxnextDivMmcGetRequestAutomapOff(void) { return divMmcRequestAutomapOff; }
static uint32_t zxnextDivMmcGetNmiHold(void) { return divMmcAutoMapActive || divMmcNmiButtonPressed; }

static uint32_t zxnextDivMmcIsMappingActive(void) {
  return divMmcEnabled && (divMmcConmem || divMmcAutoMapActive);
}

static uint32_t zxnextDivMmcGetReadOffset(uint32_t page) {
  if ((page & 0x01u) == 0) {
    return divMmcMapram ? ZXNEXT_OFFS_DIVMMC_RAM_BANK_3 : ZXNEXT_OFFS_DIVMMC_ROM;
  }
  return ZXNEXT_OFFS_DIVMMC_RAM + ((uint32_t)(divMmcBank & 0x0fu) << 13);
}

static uint32_t zxnextDivMmcGetWriteOffset(uint32_t page) {
  if ((page & 0x01u) == 0) return ZXNEXT_NO_WRITE_OFFSET;
  if (divMmcMapram && divMmcBank == 3u) return ZXNEXT_NO_WRITE_OFFSET;
  return ZXNEXT_OFFS_DIVMMC_RAM + ((uint32_t)(divMmcBank & 0x0fu) << 13);
}
