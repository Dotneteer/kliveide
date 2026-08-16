#include "zxnext.h"

static uint32_t expansionBusEnabled(void) {
  return (nextRegs[0x80u] & 0x80u) != 0u;
}

static uint32_t expansionRomcsReplacement(void) {
  return (nextRegs[0x80u] & 0x40u) != 0u;
}

static uint32_t expansionDisableIoCycles(void) {
  return (nextRegs[0x80u] & 0x20u) != 0u;
}

static uint32_t expansionDisableMemCycles(void) {
  return (nextRegs[0x80u] & 0x10u) != 0u;
}

static void resetExpansionState(void) {
  expansionRomcsSignal = 0u;
  expansionExternalBusData = 0xffu;
  expansionNmiPending = 0u;
  expansionIntPending = 0u;
}

static uint32_t expansionIsRomcsClaimed(void) {
  return expansionBusEnabled() != 0u && expansionDisableMemCycles() == 0u && expansionRomcsSignal != 0u;
}

static uint32_t expansionIsNmiAsserted(void) {
  return expansionBusEnabled() != 0u && expansionDisableMemCycles() == 0u && expansionNmiPending != 0u;
}

static uint32_t expansionIsIntActive(void) {
  return expansionBusEnabled() != 0u &&
    expansionDisableIoCycles() == 0u &&
    interruptExpBusEnabled != 0u &&
    expansionIntPending != 0u;
}

static uint32_t expansionReadOffset(uint32_t address) {
  if ((address & 0xffffu) >= 0x4000u || expansionIsRomcsClaimed() == 0u) return ZXNEXT_INVALID_PAGE_OFFSET;
  if (expansionRomcsReplacement() == 0u) return ZXNEXT_INVALID_PAGE_OFFSET;
  const uint32_t page = (address >> 13u) & 0x01u;
  return ZXNEXT_DIVMMC_RAM_OFFSET + (14u + page) * ZXNEXT_PAGE_SIZE + (address & 0x1fffu);
}

static uint32_t expansionReadNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x81u:
      return
        (expansionRomcsSignal != 0u ? 0x80u : 0x00u) |
        (nextRegs[0x81u] & 0x70u);
    default:
      return 0xffffffffu;
  }
}

static uint32_t expansionWriteNextReg(uint32_t reg, uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  switch (reg & 0xffu) {
    case 0x80u:
      nextRegs[0x80u] = byteValue;
      setCpuProgrammedSpeed(cpuProgrammedSpeed);
      rebuildFlatMemory();
      return 1u;
    case 0x81u:
      nextRegs[0x81u] = byteValue & 0x70u;
      setCpuProgrammedSpeed(cpuProgrammedSpeed);
      return 1u;
    case 0x8au:
      nextRegs[0x8au] = byteValue & 0x3fu;
      return 1u;
    default:
      return 0u;
  }
}

uint32_t zxnextShouldPropagateIo(uint32_t bit) {
  if (bit >= 6u) return 0u;
  return expansionBusEnabled() != 0u && (nextRegs[0x8au] & (1u << bit)) != 0u;
}

void zxnextSetExpansionRomcsSignal(uint32_t value) {
  expansionRomcsSignal = value != 0u;
  rebuildFlatMemory();
}

void zxnextSetExpansionExternalBusData(uint32_t value) {
  expansionExternalBusData = (uint8_t)(value & 0xffu);
}

void zxnextSetExpansionNmiPending(uint32_t value) {
  expansionNmiPending = value != 0u;
}

void zxnextSetExpansionIntPending(uint32_t value) {
  expansionIntPending = value != 0u;
}

uint32_t zxnextGetExpansionEnabled(void) { return expansionBusEnabled(); }
uint32_t zxnextGetExpansionRomcsReplacement(void) { return expansionRomcsReplacement(); }
uint32_t zxnextGetExpansionDisableIoCycles(void) { return expansionDisableIoCycles(); }
uint32_t zxnextGetExpansionDisableMemCycles(void) { return expansionDisableMemCycles(); }
uint32_t zxnextGetExpansionSoftResetPersistence(void) { return nextRegs[0x80u] & 0x0fu; }
uint32_t zxnextGetExpansionRomcsSignal(void) { return expansionRomcsSignal; }
uint32_t zxnextGetExpansionRomcsClaimed(void) { return expansionIsRomcsClaimed(); }
uint32_t zxnextGetExpansionExternalBusData(void) { return expansionExternalBusData; }
uint32_t zxnextGetExpansionNmiPending(void) { return expansionNmiPending; }
uint32_t zxnextGetExpansionNmiAsserted(void) { return expansionIsNmiAsserted(); }
uint32_t zxnextGetExpansionIntPending(void) { return expansionIntPending; }
uint32_t zxnextGetExpansionIntActive(void) { return expansionIsIntActive(); }
uint32_t zxnextGetExpansionUlaOverrideEnabled(void) { return (nextRegs[0x81u] & 0x40u) != 0u; }
uint32_t zxnextGetExpansionNmiDebounceDisabled(void) { return (nextRegs[0x81u] & 0x20u) != 0u; }
uint32_t zxnextGetExpansionClockAlwaysOn(void) { return (nextRegs[0x81u] & 0x10u) != 0u; }
uint32_t zxnextGetExpansionIoPropagate(void) { return nextRegs[0x8au] & 0x3fu; }
