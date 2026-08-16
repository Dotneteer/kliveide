#include "zxnext.h"

static uint32_t activeMemorySize(void) {
  return ZXNEXT_NEXT_RAM_OFFSET + activeMainRamPages * ZXNEXT_PAGE_SIZE;
}

static void clearMutablePhysicalMemory(void) {
  const uint32_t end = activeMemorySize();
  for (uint32_t i = ZXNEXT_DIVMMC_RAM_OFFSET; i < end && i < ZXNEXT_SRAM_CAPACITY; i++) {
    sram[i] = 0;
  }
}

static uint32_t readPhysical(uint32_t offset) {
  if (offset < ZXNEXT_ROM_SIZE) return rom[offset];
  if (offset < activeMemorySize() && offset < ZXNEXT_SRAM_CAPACITY) return sram[offset];
  if (offset >= activeMemorySize() && offset < activeMemorySize() + ZXNEXT_SENTINEL_SIZE) return 0x7eu;
  return 0xffu;
}

void zxnextWritePhysical(uint32_t offset, uint32_t value) {
  if (offset >= ZXNEXT_DIVMMC_RAM_OFFSET && offset < activeMemorySize() && offset < ZXNEXT_SRAM_CAPACITY) {
    sram[offset] = (uint8_t)(value & 0xffu);
    updateFlatMemoryForPhysicalOffset(offset);
  }
}

static void setRomSlot(uint32_t slot, uint32_t romPage, uint32_t pageOffset) {
  if (slot >= ZXNEXT_PAGE_COUNT) return;
  const uint32_t base = ZXNEXT_NEXT_ROM_OFFSET + (romPage & 0x03u) * 0x4000u + pageOffset;
  pageReadOffset[slot] = base;
  pageWriteOffset[slot] = ZXNEXT_INVALID_PAGE_OFFSET;
  pageBank8k[slot] = 0xffu;
  pageBank16k[slot] = 0xffu;
}

static void setRamSlotByMmu(uint32_t slot, uint32_t bank8k) {
  if (slot >= ZXNEXT_PAGE_COUNT) return;
  mmuRegs[slot] = (uint8_t)(bank8k & 0xffu);
  pageBank8k[slot] = bank8k & 0xffu;
  pageBank16k[slot] = (bank8k & 0xffu) >> 1u;
  if (bank8k >= activeMainRamPages) {
    pageReadOffset[slot] = activeMemorySize();
    pageWriteOffset[slot] = ZXNEXT_INVALID_PAGE_OFFSET;
    return;
  }
  pageReadOffset[slot] = ZXNEXT_NEXT_RAM_OFFSET + bank8k * ZXNEXT_PAGE_SIZE;
  pageWriteOffset[slot] = pageReadOffset[slot];
}

static void setNormalSlotByMmu(uint32_t slot) {
  if (slot >= ZXNEXT_PAGE_COUNT) return;
  const uint32_t bank8k = mmuRegs[slot];
  if (bank8k >= 224u) {
    setRomSlot(slot, selectedRomMsb | selectedRomLsb, (slot & 0x01u) * ZXNEXT_PAGE_SIZE);
    return;
  }
  setRamSlotByMmu(slot, bank8k);
}

static void setAllRam16kSlot(uint32_t slot16k, uint32_t bank16k) {
  const uint32_t firstPage = slot16k * 2u;
  uint32_t bank8k = bank16k * 2u;
  if (firstPage >= ZXNEXT_PAGE_COUNT) return;

  pageBank8k[firstPage] = bank8k;
  pageBank16k[firstPage] = bank16k;
  if (bank8k >= activeMainRamPages) {
    pageReadOffset[firstPage] = activeMemorySize();
    pageWriteOffset[firstPage] = ZXNEXT_INVALID_PAGE_OFFSET;
  } else {
    pageReadOffset[firstPage] = ZXNEXT_NEXT_RAM_OFFSET + bank8k * ZXNEXT_PAGE_SIZE;
    pageWriteOffset[firstPage] = pageReadOffset[firstPage];
  }

  bank8k++;
  pageBank8k[firstPage + 1u] = bank8k;
  pageBank16k[firstPage + 1u] = bank16k;
  if (bank8k >= activeMainRamPages) {
    pageReadOffset[firstPage + 1u] = activeMemorySize();
    pageWriteOffset[firstPage + 1u] = ZXNEXT_INVALID_PAGE_OFFSET;
  } else {
    pageReadOffset[firstPage + 1u] = ZXNEXT_NEXT_RAM_OFFSET + bank8k * ZXNEXT_PAGE_SIZE;
    pageWriteOffset[firstPage + 1u] = pageReadOffset[firstPage + 1u];
  }
}

static void updateMemoryConfig(uint32_t fromPort) {
  if (allRamMode != 0u) {
    wasInAllRamMode = 1u;
    switch (specialConfig & 0x03u) {
      case 0:
        setAllRam16kSlot(0, 0);
        setAllRam16kSlot(1, 1);
        setAllRam16kSlot(2, 2);
        setAllRam16kSlot(3, 3);
        break;
      case 1:
        setAllRam16kSlot(0, 4);
        setAllRam16kSlot(1, 5);
        setAllRam16kSlot(2, 6);
        setAllRam16kSlot(3, 7);
        break;
      case 2:
        setAllRam16kSlot(0, 4);
        setAllRam16kSlot(1, 5);
        setAllRam16kSlot(2, 6);
        setAllRam16kSlot(3, 3);
        break;
      case 3:
        setAllRam16kSlot(0, 4);
        setAllRam16kSlot(1, 7);
        setAllRam16kSlot(2, 6);
        setAllRam16kSlot(3, 3);
        break;
    }
    rebuildFlatMemory();
    return;
  }

  if (wasInAllRamMode != 0u) {
    const uint32_t eff7Bank0 = (portEff7Value & 0x08u) != 0u;
    mmuRegs[0] = eff7Bank0 ? 0x00u : 0xffu;
    mmuRegs[1] = eff7Bank0 ? 0x01u : 0xffu;
    mmuRegs[2] = 0x0au;
    mmuRegs[3] = 0x0bu;
    mmuRegs[4] = 0x04u;
    mmuRegs[5] = 0x05u;
    const uint32_t bank6 = selectedBankMsb * 16u + selectedBankLsb * 2u;
    mmuRegs[6] = (uint8_t)(bank6 & 0xffu);
    mmuRegs[7] = (uint8_t)((bank6 + 1u) & 0xffu);
    wasInAllRamMode = 0u;
  }

  if (fromPort != 0u) {
    const uint32_t eff7Bank0 = (portEff7Value & 0x08u) != 0u;
    mmuRegs[0] = eff7Bank0 ? 0x00u : 0xffu;
    mmuRegs[1] = eff7Bank0 ? 0x01u : 0xffu;
  }

  for (uint32_t slot = 0; slot < ZXNEXT_PAGE_COUNT; slot++) {
    setNormalSlotByMmu(slot);
  }
  rebuildFlatMemory();
}

static void rebuildFlatMemory(void) {
  for (uint32_t page = 0; page < ZXNEXT_PAGE_COUNT; page++) {
    const uint32_t base = page * ZXNEXT_PAGE_SIZE;
    for (uint32_t offset = 0; offset < ZXNEXT_PAGE_SIZE; offset++) {
      const uint32_t address = base + offset;
      const uint32_t divMmcOffset = divMmcReadOffset(address);
      const uint32_t readOffset = divMmcOffset != ZXNEXT_INVALID_PAGE_OFFSET
        ? divMmcOffset + (address & 0x1fffu)
        : pageReadOffset[page] + offset;
      flatMemory[address] = (uint8_t)readPhysical(readOffset);
    }
  }
}

static void updateFlatMemoryForPhysicalOffset(uint32_t physicalOffset) {
  for (uint32_t page = 0; page < ZXNEXT_PAGE_COUNT; page++) {
    const uint32_t readOffset = pageReadOffset[page];
    if (physicalOffset >= readOffset && physicalOffset < readOffset + ZXNEXT_PAGE_SIZE) {
      const uint32_t flatOffset = page * ZXNEXT_PAGE_SIZE + physicalOffset - readOffset;
      flatMemory[flatOffset] = (uint8_t)readPhysical(physicalOffset);
    }
  }
}

static void resetMmuLayout(void) {
  pagingEnabled = 1u;
  useShadowScreen = 0u;
  allRamMode = 0u;
  wasInAllRamMode = 1u;
  specialConfig = 0u;
  selectedRomLsb = 0u;
  selectedRomMsb = 0u;
  selectedBankLsb = 0u;
  selectedBankMsb = 0u;
  portEff7Value = 0u;
  mmuRegs[0] = 0xffu;
  mmuRegs[1] = 0xffu;
  mmuRegs[2] = 0x0au;
  mmuRegs[3] = 0x0bu;
  mmuRegs[4] = 0x04u;
  mmuRegs[5] = 0x05u;
  mmuRegs[6] = 0x00u;
  mmuRegs[7] = 0x01u;
  updateMemoryConfig(0);
}

uint32_t zxnextReadMemory(uint32_t address) {
  const uint32_t maskedAddress = address & 0xffffu;
  const uint32_t divMmcOffset = divMmcReadOffset(maskedAddress);
  if (divMmcOffset != ZXNEXT_INVALID_PAGE_OFFSET) {
    return readPhysical(divMmcOffset + (maskedAddress & 0x1fffu));
  }
  const uint32_t page = maskedAddress >> 13u;
  const uint32_t offset = maskedAddress & 0x1fffu;
  return readPhysical(pageReadOffset[page] + offset);
}

void zxnextWriteMemory(uint32_t address, uint32_t value) {
  const uint32_t maskedAddress = address & 0xffffu;
  if (divMmcHandleWrite(maskedAddress, value) != 0u) return;
  const uint32_t page = maskedAddress >> 13u;
  const uint32_t offset = maskedAddress & 0x1fffu;
  const uint32_t physicalOffset = pageWriteOffset[page];
  if (physicalOffset == ZXNEXT_INVALID_PAGE_OFFSET) return;
  zxnextWritePhysical(physicalOffset + offset, value);
  flatMemory[maskedAddress] = (uint8_t)(value & 0xffu);
}

uint32_t zxnextGetNextRomOffset(void) { return ZXNEXT_NEXT_ROM_OFFSET; }
uint32_t zxnextGetDivMmcRomOffset(void) { return ZXNEXT_DIVMMC_ROM_OFFSET; }
uint32_t zxnextGetMultifaceMemOffset(void) { return ZXNEXT_MULTIFACE_ROM_OFFSET; }
uint32_t zxnextGetAltRomOffset(void) { return ZXNEXT_ALT_ROM_OFFSET; }
uint32_t zxnextGetDivMmcRamOffset(void) { return ZXNEXT_DIVMMC_RAM_OFFSET; }
uint32_t zxnextGetNextRamOffset(void) { return ZXNEXT_NEXT_RAM_OFFSET; }
uint32_t zxnextGetConfiguredMemorySizeKb(void) { return configuredMemorySizeKb; }
uint32_t zxnextGetMainRamPageCount(void) { return activeMainRamPages; }
uint32_t zxnextGetMaxMainRamPageCount(void) { return ZXNEXT_MAX_MAIN_RAM_PAGES; }
uint32_t zxnextGetActiveMainRamSize(void) { return activeMainRamPages * ZXNEXT_PAGE_SIZE; }
uint32_t zxnextGetActiveMemorySize(void) { return activeMemorySize(); }
uint32_t zxnextGetSentinelOffset(void) { return activeMemorySize(); }
uint32_t zxnextGetSentinelSize(void) { return ZXNEXT_SENTINEL_SIZE; }
uint32_t zxnextGetMmuReg(uint32_t index) { return index < ZXNEXT_PAGE_COUNT ? mmuRegs[index] : 0xffu; }
uint32_t zxnextGetPageReadOffset(uint32_t index) {
  return index < ZXNEXT_PAGE_COUNT ? pageReadOffset[index] : ZXNEXT_INVALID_PAGE_OFFSET;
}
uint32_t zxnextGetPageWriteOffset(uint32_t index) {
  return index < ZXNEXT_PAGE_COUNT ? pageWriteOffset[index] : ZXNEXT_INVALID_PAGE_OFFSET;
}
uint32_t zxnextGetPageBank16k(uint32_t index) { return index < ZXNEXT_PAGE_COUNT ? pageBank16k[index] : 0xffu; }
uint32_t zxnextGetPageBank8k(uint32_t index) { return index < ZXNEXT_PAGE_COUNT ? pageBank8k[index] : 0xffu; }
uint32_t zxnextGetCurrentPartition(uint32_t index) { return zxnextGetPageBank16k(index); }
uint32_t zxnextReadPhysical(uint32_t offset) { return readPhysical(offset); }
uint32_t zxnextReadSramPage(uint32_t page, uint32_t offset) {
  if (page >= activeMainRamPages || offset >= ZXNEXT_PAGE_SIZE) return 0x7eu;
  return readPhysical(ZXNEXT_NEXT_RAM_OFFSET + page * ZXNEXT_PAGE_SIZE + offset);
}
void zxnextWriteSramPage(uint32_t page, uint32_t offset, uint32_t value) {
  if (page >= activeMainRamPages || offset >= ZXNEXT_PAGE_SIZE) return;
  zxnextWritePhysical(ZXNEXT_NEXT_RAM_OFFSET + page * ZXNEXT_PAGE_SIZE + offset, value);
}
uint32_t zxnextConfigureMemorySize(uint32_t memorySizeKb) {
  uint32_t pages = 0;
  switch (memorySizeKb) {
    case 512: pages = 32u; break;
    case 1024: pages = 96u; break;
    case 1536: pages = 160u; break;
    case 2048: pages = 224u; break;
    case 4096: pages = 480u; break;
    default: return 0u;
  }
  configuredMemorySizeKb = memorySizeKb;
  activeMainRamPages = pages;
  resetMmuLayout();
  return 1u;
}
void zxnextSetMmuReg(uint32_t index, uint32_t value) {
  if (index >= ZXNEXT_PAGE_COUNT) return;
  mmuRegs[index] = (uint8_t)(value & 0xffu);
  updateMemoryConfig(0);
}
uint32_t zxnextGetPort7ffdValue(void) {
  return selectedBankLsb | (useShadowScreen ? 0x08u : 0x00u) | (selectedRomLsb << 4u) | (pagingEnabled ? 0x00u : 0x20u);
}
uint32_t zxnextGetPortDffdValue(void) { return selectedBankMsb; }
uint32_t zxnextGetPort1ffdValue(void) { return (allRamMode ? 0x01u : 0x00u) | (specialConfig << 1u); }
uint32_t zxnextGetPortEff7Value(void) { return portEff7Value; }
uint32_t zxnextGetSelectedRomPage(void) { return selectedRomMsb | selectedRomLsb; }
uint32_t zxnextGetSelectedRamBank(void) { return selectedBankMsb | selectedBankLsb; }
uint32_t zxnextGetSelectedBankLsb(void) { return selectedBankLsb; }
uint32_t zxnextGetSelectedBankMsb(void) { return selectedBankMsb; }
uint32_t zxnextGetPagingEnabled(void) { return pagingEnabled; }
uint32_t zxnextGetAllRamMode(void) { return allRamMode; }
uint32_t zxnextGetSpecialConfig(void) { return specialConfig; }
uint32_t zxnextGetUseShadowScreen(void) { return useShadowScreen; }
