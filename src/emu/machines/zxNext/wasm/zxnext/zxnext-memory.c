#include "zxnext-memory.h"

#define ZXNEXT_OFFS_NEXT_ROM 0x000000u
#define ZXNEXT_OFFS_ALT_ROM_0 0x018000u
#define ZXNEXT_OFFS_ALT_ROM_1 0x01c000u
#define ZXNEXT_OFFS_NEXT_RAM 0x040000u
#define ZXNEXT_NO_WRITE_OFFSET 0xffffffffu
#define ZXNEXT_MAX_RAM_8K_PAGES 224u

static uint32_t pageReadOffset[8];
static uint32_t pageWriteOffset[8];
static uint16_t pageBank16[8];
static uint16_t pageBank8[8];
static uint8_t selectedRomLsb;
static uint8_t selectedRomMsb;
static uint8_t selectedBankLsb;
static uint8_t selectedBankMsb;
static uint8_t pagingEnabled;
static uint8_t allRamMode;
static uint8_t specialConfig;
static uint8_t enableAltRom;
static uint8_t altRomVisibleOnlyForWrites;
static uint8_t lockRom1;
static uint8_t lockRom0;

static void zxnextMemorySetPageInfo(
  uint32_t pageIndex,
  uint32_t readOffset,
  uint32_t writeOffset,
  uint16_t bank16,
  uint16_t bank8
) {
  uint32_t page = pageIndex & 0x07u;
  pageReadOffset[page] = readOffset;
  pageWriteOffset[page] = writeOffset;
  pageBank16[page] = bank16;
  pageBank8[page] = bank8;
}

static uint32_t zxnextMemoryAltRomOffset(void) {
  if (lockRom1) return ZXNEXT_OFFS_ALT_ROM_1;
  if (lockRom0) return ZXNEXT_OFFS_ALT_ROM_0;
  return selectedRomLsb ? ZXNEXT_OFFS_ALT_ROM_1 : ZXNEXT_OFFS_ALT_ROM_0;
}

static void zxnextMemorySetRamPageByMmu(uint32_t pageNo) {
  uint32_t bank8 = zxnextNextRegs[0x50u + (pageNo & 0x07u)];
  if (bank8 < ZXNEXT_MAX_RAM_8K_PAGES) {
    uint32_t offset = ZXNEXT_OFFS_NEXT_RAM + bank8 * 0x2000u;
    zxnextMemorySetPageInfo(pageNo, offset, offset, (uint16_t)(bank8 >> 1), (uint16_t)bank8);
    return;
  }

  uint32_t slotNo = pageNo & 0x01u;
  uint32_t romPage = selectedRomMsb | selectedRomLsb;
  uint32_t slotIndex = romPage * 2u + slotNo;
  uint32_t romOffset = ZXNEXT_OFFS_NEXT_ROM + slotIndex * 0x2000u;
  uint32_t altOffset = zxnextMemoryAltRomOffset() + slotNo * 0x2000u;
  if (enableAltRom) {
    if (altRomVisibleOnlyForWrites) {
      uint32_t page =
        !lockRom0 && !lockRom1
          ? selectedRomMsb + selectedRomLsb
          : (lockRom1 ? 2u : 0u) + (lockRom0 ? 1u : 0u);
      zxnextMemorySetPageInfo(
        pageNo,
        ZXNEXT_OFFS_NEXT_ROM + page * 0x4000u + slotNo * 0x2000u,
        altOffset,
        0xffu,
        0xffu
      );
    } else {
      zxnextMemorySetPageInfo(pageNo, altOffset, ZXNEXT_NO_WRITE_OFFSET, 0xffu, 0xffu);
    }
  } else {
    zxnextMemorySetPageInfo(pageNo, romOffset, ZXNEXT_NO_WRITE_OFFSET, 0xffu, 0xffu);
  }
}

static void zxnextMemorySetRamSlotAndMmu(uint32_t slotNo, uint32_t bank16) {
  uint32_t page = (slotNo & 0x03u) * 2u;
  zxnextNextRegs[0x50u + page] = (uint8_t)(bank16 * 2u);
  zxnextNextRegs[0x50u + page + 1u] = (uint8_t)(bank16 * 2u + 1u);
  zxnextMemorySetRamPageByMmu(page);
  zxnextMemorySetRamPageByMmu(page + 1u);
}

static void zxnextMemorySetAllRamSlot(uint32_t slotNo, uint32_t bank16) {
  uint32_t page = (slotNo & 0x03u) * 2u;
  uint32_t bank8 = bank16 * 2u;
  uint32_t offset = ZXNEXT_OFFS_NEXT_RAM + bank8 * 0x2000u;
  zxnextMemorySetPageInfo(page, offset, offset, (uint16_t)bank16, (uint16_t)bank8);
  bank8++;
  offset = ZXNEXT_OFFS_NEXT_RAM + bank8 * 0x2000u;
  zxnextMemorySetPageInfo(page + 1u, offset, offset, (uint16_t)bank16, (uint16_t)bank8);
}

static void zxnextMemoryUpdateMapping(void) {
  if (allRamMode) {
    switch (specialConfig & 0x03u) {
      case 0:
        zxnextMemorySetAllRamSlot(0, 0);
        zxnextMemorySetAllRamSlot(1, 1);
        zxnextMemorySetAllRamSlot(2, 2);
        zxnextMemorySetAllRamSlot(3, 3);
        break;
      case 1:
        zxnextMemorySetAllRamSlot(0, 4);
        zxnextMemorySetAllRamSlot(1, 5);
        zxnextMemorySetAllRamSlot(2, 6);
        zxnextMemorySetAllRamSlot(3, 7);
        break;
      case 2:
        zxnextMemorySetAllRamSlot(0, 4);
        zxnextMemorySetAllRamSlot(1, 5);
        zxnextMemorySetAllRamSlot(2, 6);
        zxnextMemorySetAllRamSlot(3, 3);
        break;
      default:
        zxnextMemorySetAllRamSlot(0, 4);
        zxnextMemorySetAllRamSlot(1, 7);
        zxnextMemorySetAllRamSlot(2, 6);
        zxnextMemorySetAllRamSlot(3, 3);
        break;
    }
    return;
  }

  for (uint32_t page = 0; page < 8; page++) {
    zxnextMemorySetRamPageByMmu(page);
  }
}

static void zxnextMemoryUpdateNextReg8E(void) {
  zxnextNextRegs[0x8e] =
    (uint8_t)(((selectedBankMsb & 0x01u) << 7) |
      ((selectedBankLsb & 0x07u) << 4) |
      0x08u |
      (allRamMode ? 0x04u : 0x00u) |
      (allRamMode ? (specialConfig & 0x03u) : (selectedRomMsb | selectedRomLsb)));
}

static void zxnextMemoryResetMapping(void) {
  selectedRomLsb = 0;
  selectedRomMsb = 0;
  selectedBankLsb = 0;
  selectedBankMsb = 0;
  pagingEnabled = 1;
  allRamMode = 0;
  specialConfig = 0;
  enableAltRom = 0;
  altRomVisibleOnlyForWrites = 0;
  lockRom1 = 0;
  lockRom0 = 0;
  zxnextNextRegs[0x50] = 0xff;
  zxnextNextRegs[0x51] = 0xff;
  zxnextNextRegs[0x52] = 0x0a;
  zxnextNextRegs[0x53] = 0x0b;
  zxnextNextRegs[0x54] = 0x04;
  zxnextNextRegs[0x55] = 0x05;
  zxnextNextRegs[0x56] = 0x00;
  zxnextNextRegs[0x57] = 0x01;
  zxnextMemoryUpdateNextReg8E();
  zxnextMemoryUpdateMapping();
}

static uint32_t zxnextMemoryReadPhysical(uint32_t offset) {
  return zxnextMemory[offset % ZXNEXT_MEMORY_SIZE];
}

static void zxnextMemoryWritePhysical(uint32_t offset, uint32_t value) {
  zxnextMemory[offset % ZXNEXT_MEMORY_SIZE] = (uint8_t)value;
}

static uint32_t zxnextMemoryReadMapped(uint32_t address) {
  uint32_t normalized = address & 0xffffu;
  uint32_t physical = pageReadOffset[normalized >> 13] + (normalized & 0x1fffu);
  lastMemoryAddress = (uint16_t)normalized;
  lastMemoryValue = zxnextMemoryReadPhysical(physical);
  lastMemoryIsWrite = 0;
  return lastMemoryValue;
}

static uint32_t zxnextMemoryPeekMapped(uint32_t address) {
  uint32_t normalized = address & 0xffffu;
  uint32_t physical = pageReadOffset[normalized >> 13] + (normalized & 0x1fffu);
  return zxnextMemoryReadPhysical(physical);
}

static void zxnextMemoryWriteMapped(uint32_t address, uint32_t value) {
  uint32_t normalized = address & 0xffffu;
  uint32_t physical = pageWriteOffset[normalized >> 13];
  if (physical != ZXNEXT_NO_WRITE_OFFSET) {
    zxnextMemoryWritePhysical(physical + (normalized & 0x1fffu), value);
  }
  lastMemoryAddress = (uint16_t)normalized;
  lastMemoryValue = (uint8_t)value;
  lastMemoryIsWrite = 1;
}

static uint32_t zxnextMemoryReadScreenOffset(uint32_t offset) {
  return zxnextMemoryReadMapped(0x4000u + (offset & 0x3fffu));
}

static uint32_t zxnextMemoryGetPageReadOffset(uint32_t page) {
  return pageReadOffset[page & 0x07u];
}

static uint32_t zxnextMemoryGetPageWriteOffset(uint32_t page) {
  return pageWriteOffset[page & 0x07u];
}

static uint32_t zxnextMemoryGetPageBank16(uint32_t page) {
  return pageBank16[page & 0x07u];
}

static uint32_t zxnextMemoryGetPageBank8(uint32_t page) {
  return pageBank8[page & 0x07u];
}

static uint32_t zxnextMemoryGetSelectedRomPage(void) {
  return selectedRomMsb | selectedRomLsb;
}

static uint32_t zxnextMemoryGetSelectedRamBank(void) {
  return selectedBankMsb | selectedBankLsb;
}

static void zxnextMemorySetNextRegister(uint32_t reg, uint32_t value) {
  uint8_t normalizedReg = (uint8_t)reg;
  uint8_t byteValue = (uint8_t)value;
  zxnextNextRegs[normalizedReg] = byteValue;
  if (normalizedReg >= 0x50 && normalizedReg <= 0x57) {
    zxnextMemoryUpdateMapping();
  } else if (normalizedReg == 0x8c) {
    enableAltRom = (byteValue & 0x80u) != 0;
    altRomVisibleOnlyForWrites = (byteValue & 0x40u) != 0;
    lockRom1 = (byteValue & 0x20u) != 0;
    lockRom0 = (byteValue & 0x10u) != 0;
    zxnextMemoryUpdateMapping();
  } else if (normalizedReg == 0x8e) {
    if (byteValue & 0x08u) {
      selectedBankMsb = (byteValue & 0x80u) >> 7;
      selectedBankLsb = (byteValue >> 4) & 0x07u;
      zxnextNextRegs[0x56] = (selectedBankMsb << 4) | (selectedBankLsb << 1);
      zxnextNextRegs[0x57] = zxnextNextRegs[0x56] + 1u;
    }
    allRamMode = (byteValue & 0x04u) != 0;
    if (allRamMode) {
      specialConfig = byteValue & 0x03u;
    } else {
      selectedRomMsb = byteValue & 0x02u;
      selectedRomLsb = byteValue & 0x01u;
    }
    zxnextMemoryUpdateNextReg8E();
    zxnextMemoryUpdateMapping();
  }
}

static void zxnextMemorySetPort7ffd(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  if (!pagingEnabled) return;

  selectedBankLsb = byteValue & 0x07u;
  zxnextNextRegs[0x56] = (selectedBankMsb << 4) | (selectedBankLsb << 1);
  zxnextNextRegs[0x57] = zxnextNextRegs[0x56] + 1u;
  selectedRomLsb = (byteValue >> 4) & 0x01u;
  pagingEnabled = (byteValue & 0x20u) == 0;
  zxnextMemoryUpdateNextReg8E();
  zxnextMemoryUpdateMapping();
}

static uint32_t zxnextMemoryGetPort7ffd(void) {
  return
    selectedBankLsb |
    (selectedRomLsb << 4) |
    (pagingEnabled ? 0x00u : 0x20u);
}

static void zxnextMemorySetPortDffd(uint32_t value) {
  if (!pagingEnabled) return;

  selectedBankMsb = (uint8_t)value & 0x0fu;
  zxnextNextRegs[0x56] = (selectedBankMsb << 4) | (selectedBankLsb << 1);
  zxnextNextRegs[0x57] = zxnextNextRegs[0x56] + 1u;
  zxnextMemoryUpdateNextReg8E();
  zxnextMemoryUpdateMapping();
}

static uint32_t zxnextMemoryGetPortDffd(void) {
  return selectedBankMsb;
}

static void zxnextMemorySetPort1ffd(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  if (!pagingEnabled) return;

  allRamMode = (byteValue & 0x01u) != 0;
  specialConfig = (byteValue >> 1) & 0x03u;
  selectedRomMsb = specialConfig & 0x02u;
  zxnextMemoryUpdateNextReg8E();
  zxnextMemoryUpdateMapping();
}

static uint32_t zxnextMemoryGetPort1ffd(void) {
  return (allRamMode ? 0x01u : 0x00u) | (specialConfig << 1);
}
