#include "zxnext-expansion.h"

static uint8_t zxnextExpansionEnabled;
static uint8_t zxnextExpansionRomcsReplacement;
static uint8_t zxnextExpansionDisableIoCycles;
static uint8_t zxnextExpansionDisableMemCycles;
static uint8_t zxnextExpansionSoftResetPersistence;
static uint8_t zxnextExpansionRomcsAsserted;
static uint8_t zxnextExpansionUlaOverrideEnabled;
static uint8_t zxnextExpansionNmiDebounceDisabled;
static uint8_t zxnextExpansionClockAlwaysOn;
static uint8_t zxnextExpansionBusPortEnables[4];
static uint8_t zxnextExpansionIoPropagate;
static uint8_t zxnextExpansionNmiPending;
static uint8_t zxnextExpansionIntPending;
static uint8_t zxnextExpansionRomcsSignal;
static uint8_t zxnextExpansionIorqulaSignal;

static inline void zxnextExpansionRequestSpeedUpdate(void) {
  cpuEffectiveSpeed = zxnextExpansionEnabled ? 0u : cpuProgrammedSpeed;
  zxnextNextRegs[0x07u] = (uint8_t)((cpuProgrammedSpeed & 0x03u) | ((cpuEffectiveSpeed & 0x03u) << 4u));
}

void zxnextExpansionHardReset(void) {
  zxnextExpansionEnabled = 0;
  zxnextExpansionRomcsReplacement = 0;
  zxnextExpansionDisableIoCycles = 0;
  zxnextExpansionDisableMemCycles = 0;
  zxnextExpansionSoftResetPersistence = 0;
  zxnextExpansionRomcsAsserted = 0;
  zxnextExpansionUlaOverrideEnabled = 0;
  zxnextExpansionNmiDebounceDisabled = 0;
  zxnextExpansionClockAlwaysOn = 0;
  for (uint32_t i = 0; i < 4; i++) zxnextExpansionBusPortEnables[i] = 0xffu;
  zxnextExpansionIoPropagate = 0;
  zxnextExpansionNmiPending = 0;
  zxnextExpansionIntPending = 0;
  zxnextExpansionRomcsSignal = 0;
  zxnextExpansionIorqulaSignal = 0;
  zxnextExpansionRequestSpeedUpdate();
}

void zxnextExpansionReset(void) {
  uint8_t persistence = zxnextExpansionSoftResetPersistence & 0x0fu;
  zxnextExpansionEnabled = (persistence & 0x08u) != 0;
  zxnextExpansionRomcsReplacement = (persistence & 0x04u) != 0;
  zxnextExpansionDisableIoCycles = (persistence & 0x02u) != 0;
  zxnextExpansionDisableMemCycles = (persistence & 0x01u) != 0;
  zxnextExpansionSoftResetPersistence = persistence;
  zxnextExpansionRequestSpeedUpdate();
}

uint32_t zxnextExpansionHandlesNextReg(uint32_t reg) {
  uint32_t normalized = reg & 0xffu;
  return normalized == 0x80u || normalized == 0x81u || (normalized >= 0x86u && normalized <= 0x8au);
}

void zxnextExpansionSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = value & 0xffu;
  switch (reg & 0xffu) {
    case 0x80u:
      zxnextExpansionEnabled = (byteValue & 0x80u) != 0;
      zxnextExpansionRomcsReplacement = (byteValue & 0x40u) != 0;
      zxnextExpansionDisableIoCycles = (byteValue & 0x20u) != 0;
      zxnextExpansionDisableMemCycles = (byteValue & 0x10u) != 0;
      zxnextExpansionSoftResetPersistence = byteValue & 0x0fu;
      zxnextExpansionRequestSpeedUpdate();
      break;
    case 0x81u:
      zxnextExpansionUlaOverrideEnabled = (byteValue & 0x40u) != 0;
      zxnextExpansionNmiDebounceDisabled = (byteValue & 0x20u) != 0;
      zxnextExpansionClockAlwaysOn = (byteValue & 0x10u) != 0;
      zxnextExpansionRequestSpeedUpdate();
      break;
    case 0x86u:
    case 0x87u:
    case 0x88u:
    case 0x89u:
      zxnextExpansionBusPortEnables[(reg - 0x86u) & 3u] = byteValue;
      break;
    case 0x8au:
      zxnextExpansionIoPropagate = byteValue & 0x3fu;
      break;
  }
}

uint32_t zxnextExpansionGetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x80u:
      return (zxnextExpansionEnabled ? 0x80u : 0u) |
        (zxnextExpansionRomcsReplacement ? 0x40u : 0u) |
        (zxnextExpansionDisableIoCycles ? 0x20u : 0u) |
        (zxnextExpansionDisableMemCycles ? 0x10u : 0u) |
        (zxnextExpansionSoftResetPersistence & 0x0fu);
    case 0x81u:
      return (zxnextExpansionRomcsAsserted ? 0x80u : 0u) |
        (zxnextExpansionUlaOverrideEnabled ? 0x40u : 0u) |
        (zxnextExpansionNmiDebounceDisabled ? 0x20u : 0u) |
        (zxnextExpansionClockAlwaysOn ? 0x10u : 0u);
    case 0x86u:
    case 0x87u:
    case 0x88u:
    case 0x89u:
      return zxnextExpansionBusPortEnables[(reg - 0x86u) & 3u];
    case 0x8au:
      return zxnextExpansionIoPropagate;
    default:
      return 0xffu;
  }
}

uint32_t zxnextExpansionEffectivePortEnable(uint32_t internalValue, uint32_t busRegIndex) {
  if (!zxnextExpansionEnabled) return internalValue & 0xffu;
  return (internalValue & zxnextExpansionBusPortEnables[busRegIndex & 3u]) & 0xffu;
}

uint32_t zxnextExpansionShouldPropagateIo(uint32_t portBit) {
  return zxnextExpansionEnabled && ((zxnextExpansionIoPropagate & (1u << (portBit & 7u))) != 0);
}

void zxnextExpansionSetSignals(uint32_t romcs, uint32_t iorqula, uint32_t nmi, uint32_t intr) {
  zxnextExpansionRomcsSignal = romcs != 0;
  zxnextExpansionIorqulaSignal = iorqula != 0;
  zxnextExpansionNmiPending = nmi != 0;
  zxnextExpansionIntPending = intr != 0;
}

uint32_t zxnextExpansionIsRomcsClaimed(void) { return zxnextExpansionEnabled && !zxnextExpansionDisableMemCycles && zxnextExpansionRomcsSignal; }
uint32_t zxnextExpansionIsNmiAsserted(void) { return zxnextExpansionEnabled && !zxnextExpansionDisableMemCycles && zxnextExpansionNmiPending; }
uint32_t zxnextExpansionIsIntActive(uint32_t expBusInterruptEnabled) {
  return zxnextExpansionEnabled && !zxnextExpansionDisableIoCycles && expBusInterruptEnabled && zxnextExpansionIntPending;
}
uint32_t zxnextExpansionIsUlaOverride(uint32_t address) {
  return zxnextExpansionEnabled && zxnextExpansionUlaOverrideEnabled && (((address >> 12) & 0x0fu) == 0);
}
