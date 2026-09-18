#include "zxnext-memory.h"
#include "zxnext-divmmc.h"
#include "zxnext-multiface.h"
#include "zxnext-layer2.h"
#include "zxnext-ula.h"

#define ZXNEXT_OFFS_NEXT_ROM 0x000000u
#define ZXNEXT_OFFS_ALT_ROM_0 0x018000u
#define ZXNEXT_OFFS_ALT_ROM_1 0x01c000u
#define ZXNEXT_OFFS_NEXT_RAM 0x040000u
#define ZXNEXT_OFFS_BANK_05 0x054000u
#define ZXNEXT_OFFS_BANK_07 0x05c000u
#define ZXNEXT_NO_WRITE_OFFSET 0xffffffffu
#define ZXNEXT_MAX_RAM_8K_PAGES 224u

static uint32_t pageReadOffset[8];
static uint32_t pageWriteOffset[8];
static uint16_t pageBank16[8];
static uint16_t pageBank8[8];
/*
 * The paging registers exactly as zxnext.vhd stores them (~3638-3781). The ports never map memory
 * directly: an accepted write reloads the MMU registers ($50-$57, `zxnextMemoryReloadMmu`), and the
 * mapping is always derived from those - as in MemoryDevice.ts.
 */
static uint8_t memPort7ffd;  /* port_7ffd_reg */
static uint8_t memPortDffd;  /* port_dffd_reg, bits 4-0 */
static uint8_t memPortDffd6; /* port_dffd_reg_6, read back only by the MF+3 port */
static uint8_t memPort1ffd;  /* port_1ffd_reg */
static uint8_t memPortEff7;  /* port_eff7_reg_2 / _3, bits 2 and 3 */
/* nr_03_config_mode: defined in zxnext-nextreg.c, later in the unity build */
static uint8_t zxnextConfigMode;
/* ROM selection (~2938-2962 `sram_rom`, `sram_alt_128_n`), derived at every mapping update */
static uint8_t selectedRom;
static uint8_t memAlt128n;

static uint32_t zxnextNextRegGetMachineType(void);

/* $8F = 11 and $EFF7 bit 2 clear (~3781) */
static inline uint32_t zxnextMemoryPentagon1024(void) {
  return (zxnextNextRegs[0x8fu] & 0x03u) == 0x03u && (memPortEff7 & 0x04u) == 0u;
}

/* port_7ffd_locked (~3749); the Profi mode is disabled in this core */
static inline uint32_t zxnextMemoryPagingEnabled(void) {
  return zxnextMemoryPentagon1024() || (memPort7ffd & 0x20u) == 0u;
}

/* $08 bit 7 = 1 clears port_7ffd_reg(5) (~3650) */
static void zxnextMemoryUnlockPaging(void) {
  memPort7ffd &= (uint8_t)~0x20u;
}

/* port_7ffd_shadow: $7FFD bit 3, also written by NextReg $69 bit 6 (~3656) */
static inline uint32_t zxnextMemoryShadowScreen(void) {
  return (memPort7ffd & 0x08u) != 0u;
}

/* port_7ffd_bank (~3743-3746) */
static uint32_t zxnextMemoryBank16k(void) {
  uint32_t p = memPort7ffd;
  uint32_t pentagon1024 = zxnextMemoryPentagon1024();
  if ((zxnextNextRegs[0x8fu] & 0x03u) == 0x02u || pentagon1024) {
    return (p & 0x07u) | (((p >> 6u) & 0x03u) << 3u) | ((pentagon1024 && (p & 0x20u)) ? 0x20u : 0u);
  }
  return (p & 0x07u) | ((memPortDffd & 0x0fu) << 3u);
}

static inline void zxnextMemorySetPageInfo(
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

/* ~2938-2962: the $8C lock bits override the ports whether or not the Alt ROM is on */
static void zxnextMemoryUpdateRomSelection(void) {
  uint32_t altRom = zxnextNextRegs[0x8cu];
  uint32_t lock1 = (altRom >> 5u) & 0x01u;
  uint32_t lock0 = (altRom >> 4u) & 0x01u;
  uint32_t rom7ffd = (memPort7ffd >> 4u) & 0x01u;
  uint32_t machineType = zxnextNextRegGetMachineType();
  if (machineType == 1u) {
    selectedRom = 0u;
    memAlt128n = (uint8_t)(!(!lock1 && lock0));
  } else if (machineType == 3u) {
    if (lock1 || lock0) {
      selectedRom = (uint8_t)((lock1 << 1u) | lock0);
      memAlt128n = (uint8_t)lock1;
    } else {
      selectedRom = (uint8_t)((((memPort1ffd >> 2u) & 0x01u) << 1u) | rom7ffd);
      memAlt128n = (uint8_t)rom7ffd;
    }
  } else if (lock1 || lock0) {
    selectedRom = (uint8_t)lock1;
    memAlt128n = (uint8_t)lock1;
  } else {
    selectedRom = (uint8_t)rom7ffd;
    memAlt128n = (uint8_t)rom7ffd;
  }
}

/*
 * One 8K slot from its MMU register. Pages $00-$DF are RAM; above that bit 8 of `mmu_A21_A13` is set:
 * slots 0/1 show the ROM (read-only unless the Alt ROM takes writes, ~3010-3083), slots 2-7 have no
 * SRAM cycle - writes are dropped (reads are undefined on the hardware; the ROM is shown).
 */
static void zxnextMemorySetRamPageByMmu(uint32_t pageNo) {
  uint32_t bank8 = zxnextNextRegs[0x50u + (pageNo & 0x07u)];
  if (bank8 < ZXNEXT_MAX_RAM_8K_PAGES) {
    uint32_t offset = ZXNEXT_OFFS_NEXT_RAM + bank8 * 0x2000u;
    zxnextMemorySetPageInfo(pageNo, offset, offset, (uint16_t)(bank8 >> 1), (uint16_t)bank8);
    return;
  }

  uint32_t half = pageNo & 0x01u;
  /* ~2994-3000: in config mode the ROM slots show the 16K SRAM bank of $04 (bits 6-0), writable, with
     no Alt ROM (sram_pre_override "110": DivMMC, Layer 2 and the Multiface still go above it) */
  if (pageNo <= 1u && zxnextConfigMode) {
    uint32_t configOffset = (zxnextNextRegs[0x04u] & 0x7fu) * 0x4000u + half * 0x2000u;
    zxnextMemorySetPageInfo(pageNo, configOffset, configOffset, 0xffu, 0xffu);
    return;
  }
  uint32_t romOffset = ZXNEXT_OFFS_NEXT_ROM + selectedRom * 0x4000u + half * 0x2000u;
  uint32_t altOffset = (memAlt128n ? ZXNEXT_OFFS_ALT_ROM_1 : ZXNEXT_OFFS_ALT_ROM_0) + half * 0x2000u;
  uint32_t altRom = zxnextNextRegs[0x8cu];
  if (pageNo > 1u || (altRom & 0x80u) == 0u) {
    zxnextMemorySetPageInfo(pageNo, romOffset, ZXNEXT_NO_WRITE_OFFSET, 0xffu, 0xffu);
  } else if ((altRom & 0x40u) != 0u) {
    zxnextMemorySetPageInfo(pageNo, romOffset, altOffset, 0xffu, 0xffu);
  } else {
    zxnextMemorySetPageInfo(pageNo, altOffset, ZXNEXT_NO_WRITE_OFFSET, 0xffu, 0xffu);
  }
}

static void zxnextMemoryUpdateMapping(void) {
  zxnextMemoryUpdateRomSelection();
  for (uint32_t page = 0; page < 8; page++) {
    zxnextMemorySetRamPageByMmu(page);
  }
}

/* ~6104: dffd(0) & 7ffd(2:0) & 1 & 1ffd(0) & 1ffd(2) & ((7ffd(4) and not 1ffd(0)) or (1ffd(1) and 1ffd(0))) */
static void zxnextMemoryUpdateNextReg8E(void) {
  uint32_t special = memPort1ffd & 0x01u;
  zxnextNextRegs[0x8e] =
    (uint8_t)(((memPortDffd & 0x01u) << 7) |
      ((memPort7ffd & 0x07u) << 4) |
      0x08u |
      (special << 2) |
      (((memPort1ffd >> 2) & 0x01u) << 1) |
      ((((memPort7ffd >> 4) & 0x01u) & (special ^ 1u)) | (((memPort1ffd >> 1) & 0x01u) & special)));
}

/*
 * The MMU reload after a paging write (zxnext.vhd ~4599-4664). `ramChange` is
 * `port_memory_ram_change_dly` (0 only for a $8E write without bit 3); `specialOld` is
 * `port_1ffd_special_old`, the special-mode flag before a $1FFD / $8E write.
 */
static void zxnextMemoryReloadMmu(uint32_t ramChange, uint32_t specialOld) {
  uint8_t* mmu = &zxnextNextRegs[0x50u];
  uint32_t p = memPort1ffd;
  if ((p & 0x01u) != 0u) {
    uint32_t b2 = (p >> 2u) & 0x01u;
    uint32_t b1 = (p >> 1u) & 0x01u;
    uint32_t high = (b2 | b1) << 3u;
    uint32_t upper = ((b2 ^ 1u) & b1) << 3u;
    mmu[0] = (uint8_t)high;
    mmu[1] = (uint8_t)(high | 1u);
    mmu[2] = (uint8_t)(high | ((b2 & b1) << 2u) | 2u);
    mmu[3] = (uint8_t)(mmu[2] | 1u);
    mmu[4] = (uint8_t)(high | 4u);
    mmu[5] = (uint8_t)(high | 5u);
    mmu[6] = (uint8_t)(upper | 6u);
    mmu[7] = (uint8_t)(upper | 7u);
  } else {
    uint32_t bank0 = (memPortEff7 & 0x08u) != 0u;
    mmu[0] = bank0 ? 0x00u : 0xffu;
    mmu[1] = bank0 ? 0x01u : 0xffu;
    if (specialOld) {
      mmu[2] = 0x0au;
      mmu[3] = 0x0bu;
      mmu[4] = 0x04u;
      mmu[5] = 0x05u;
    }
    if (specialOld || ramChange) {
      uint32_t bank = zxnextMemoryBank16k();
      mmu[6] = (uint8_t)(bank << 1u);
      mmu[7] = (uint8_t)((bank << 1u) | 1u);
    }
  }
  zxnextMemoryUpdateNextReg8E();
  zxnextMemoryUpdateMapping();
}

static void zxnextMemoryResetMapping(void) {
  /* ~3645, 3685, 3712, 3758: every reset clears the paging ports */
  memPort7ffd = 0;
  memPortDffd = 0;
  memPortDffd6 = 0;
  memPort1ffd = 0;
  memPortEff7 = 0;
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

static inline uint32_t zxnextMemoryReadPhysical(uint32_t offset) {
  return zxnextMemory[offset % ZXNEXT_MEMORY_SIZE];
}

static inline void zxnextMemoryWritePhysical(uint32_t offset, uint32_t value) {
  zxnextMemory[offset % ZXNEXT_MEMORY_SIZE] = (uint8_t)value;
}

/* $0000-$3FFF overlays: the Multiface wins over DivMMC (MemoryDevice._readSlot0Complex), both over Layer 2. */
static inline uint32_t zxnextMemoryLowOverlayActive(void) {
  return zxnextMultifaceIsPaged() || zxnextDivMmcIsMappingActive();
}

static inline uint32_t zxnextMemoryResolveReadOffset(uint32_t page) {
  uint32_t normalizedPage = page & 0x07u;
  if (normalizedPage < 2u && zxnextMultifaceIsPaged()) {
    return ZXNEXT_OFFS_MULTIFACE_MEM + (normalizedPage << 13u);
  }
  if (normalizedPage < 2u && zxnextDivMmcIsMappingActive()) {
    return zxnextDivMmcGetReadOffset(normalizedPage);
  }
  return pageReadOffset[normalizedPage];
}

static inline uint32_t zxnextMemoryResolveWriteOffset(uint32_t page) {
  uint32_t normalizedPage = page & 0x07u;
  if (normalizedPage < 2u && zxnextMultifaceIsPaged()) {
    /* page 0 is the MF ROM; only the MF RAM (page 1) is writable */
    return normalizedPage == 0u ? ZXNEXT_NO_WRITE_OFFSET : ZXNEXT_OFFS_MULTIFACE_MEM + 0x2000u;
  }
  if (normalizedPage < 2u && zxnextDivMmcIsMappingActive()) {
    return zxnextDivMmcGetWriteOffset(normalizedPage);
  }
  return pageWriteOffset[normalizedPage];
}

static inline uint32_t zxnextMemoryResolveLayer2Offset(uint32_t address, uint32_t writeAccess) {
  if (writeAccess) {
    if (!zxnextLayer2GetEnableMappingForWrites()) return ZXNEXT_NO_WRITE_OFFSET;
  } else if (!zxnextLayer2GetEnableMappingForReads()) {
    return ZXNEXT_NO_WRITE_OFFSET;
  }

  uint32_t normalized = address & 0xffffu;
  uint32_t mapSegment = zxnextLayer2GetBank() & 0x03u;
  /* ~3001-3020: segments 00/01/10 all map $0000-$3FFF (the segment picks the third shown there);
     only segment 11 maps $0000-$BFFF */
  if (normalized >= (mapSegment == 3u ? 0xc000u : 0x4000u)) return ZXNEXT_NO_WRITE_OFFSET;

  uint32_t activeBank = zxnextLayer2GetUseShadowBank()
    ? zxnextLayer2GetShadowRamBank()
    : zxnextLayer2GetActiveRamBank();
  uint32_t offsetPre = mapSegment == 3u ? ((normalized >> 14u) & 0x03u) : mapSegment;
  uint32_t bankOffset = (offsetPre + zxnextLayer2GetBankOffset()) & 0x07u;
  uint32_t layer2Page = (((activeBank + bankOffset) & 0x7fu) << 1u) | ((normalized >> 13u) & 0x01u);
  /* layer2_A21_A13 = ("0001" + page(7:5)) & page(4:0) is the SRAM page, i.e. RAM page + 32: bit 8 (no
     SRAM cycle) is set for pages $E0-$FF. RAM page p lives at ZXNEXT_OFFS_NEXT_RAM + p x 8K. */
  if (layer2Page >= ZXNEXT_MAX_RAM_8K_PAGES) return ZXNEXT_NO_WRITE_OFFSET;
  return ZXNEXT_OFFS_NEXT_RAM + (layer2Page << 13u) + (normalized & 0x1fffu);
}

static inline uint32_t zxnextMemoryReadMapped(uint32_t address) {
  uint32_t normalized = address & 0xffffu;
  uint32_t physical = ZXNEXT_NO_WRITE_OFFSET;
  if (!((normalized >> 13u) < 2u && zxnextMemoryLowOverlayActive())) {
    physical = zxnextMemoryResolveLayer2Offset(normalized, 0u);
  }
  if (physical == ZXNEXT_NO_WRITE_OFFSET) {
    physical = zxnextMemoryResolveReadOffset(normalized >> 13) + (normalized & 0x1fffu);
  }
  lastMemoryAddress = (uint16_t)normalized;
  lastMemoryValue = zxnextMemoryReadPhysical(physical);
  lastMemoryAccessed = 1;
  lastMemoryIsWrite = 0;
  return lastMemoryValue;
}

static inline uint32_t zxnextMemoryPeekMapped(uint32_t address) {
  uint32_t normalized = address & 0xffffu;
  uint32_t physical = ZXNEXT_NO_WRITE_OFFSET;
  if (!((normalized >> 13u) < 2u && zxnextMemoryLowOverlayActive())) {
    physical = zxnextMemoryResolveLayer2Offset(normalized, 0u);
  }
  if (physical == ZXNEXT_NO_WRITE_OFFSET) {
    physical = zxnextMemoryResolveReadOffset(normalized >> 13) + (normalized & 0x1fffu);
  }
  return zxnextMemoryReadPhysical(physical);
}

static inline void zxnextMemoryWriteMapped(uint32_t address, uint32_t value) {
  uint32_t normalized = address & 0xffffu;
  uint32_t physical = ZXNEXT_NO_WRITE_OFFSET;
  if (!((normalized >> 13u) < 2u && zxnextMemoryLowOverlayActive())) {
    physical = zxnextMemoryResolveLayer2Offset(normalized, 1u);
  }
  if (physical == ZXNEXT_NO_WRITE_OFFSET) {
    physical = zxnextMemoryResolveWriteOffset(normalized >> 13);
    if (physical != ZXNEXT_NO_WRITE_OFFSET) physical += normalized & 0x1fffu;
  }
  if (physical != ZXNEXT_NO_WRITE_OFFSET) {
    // --- A mid-frame write to screen memory: render what the beam has finished with the old contents.
    zxnextRasterMemoryWrite(physical % ZXNEXT_MEMORY_SIZE, value);
    zxnextMemoryWritePhysical(physical, value);
  }
  lastMemoryAddress = (uint16_t)normalized;
  lastMemoryValue = (uint8_t)value;
  lastMemoryAccessed = 1;
  lastMemoryIsWrite = 1;
}

static uint32_t zxnextMemoryReadScreenOffset(uint32_t offset) {
  uint32_t base = zxnextMemoryShadowScreen() ? ZXNEXT_OFFS_BANK_07 : ZXNEXT_OFFS_BANK_05;
  return zxnextMemoryReadPhysical(base + (offset & 0x3fffu));
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
  return selectedRom;
}

static uint32_t zxnextMemoryGetSelectedRamBank(void) {
  return zxnextMemoryBank16k();
}

static void zxnextMemorySetNextRegister(uint32_t reg, uint32_t value) {
  uint8_t normalizedReg = (uint8_t)reg;
  uint8_t byteValue = (uint8_t)value;
  zxnextNextRegs[normalizedReg] = byteValue;
  if (normalizedReg >= 0x50 && normalizedReg <= 0x57) {
    zxnextMemoryUpdateMapping();
  } else if (normalizedReg == 0x04) {
    zxnextNextRegs[0x04u] = (uint8_t)(byteValue & 0x7fu);
    if (zxnextConfigMode) zxnextMemoryUpdateMapping();
  } else if (normalizedReg == 0x8c) {
    zxnextMemoryUpdateMapping();
  } else if (normalizedReg == 0x8e) {
    /* ~3659-3730: bit 3 sets the bank (bits 6-4, $DFFD bit 0 = bit 7, $DFFD bit 3 cleared); bit 2 = 0
       sets the ROM bit from bit 0; $1FFD bits 2-0 take bits 1, 0, 2. The lock does not apply. */
    uint32_t specialOld = memPort1ffd & 0x01u;
    if (byteValue & 0x08u) {
      memPort7ffd = (uint8_t)((memPort7ffd & ~0x07u) | ((byteValue >> 4) & 0x07u));
      memPortDffd = (uint8_t)((memPortDffd & 0x10u) | ((byteValue >> 7) & 0x01u));
    }
    if ((byteValue & 0x04u) == 0u) {
      memPort7ffd = (uint8_t)((memPort7ffd & ~0x10u) | ((byteValue & 0x01u) << 4));
    }
    memPort1ffd = (uint8_t)((memPort1ffd & ~0x07u) | (((byteValue >> 1) & 0x01u) << 2) |
      ((byteValue & 0x01u) << 1) | ((byteValue >> 2) & 0x01u));
    zxnextMemoryReloadMmu((byteValue & 0x08u) != 0u, specialOld);
  } else if (normalizedReg == 0x8f) {
    /* the mode, then (one clock later, ~3793) an MMU reload like a port write */
    zxnextMemoryReloadMmu(1u, 0u);
  } else if (normalizedReg == 0x69) {
    memPort7ffd = (uint8_t)((memPort7ffd & ~0x08u) | ((byteValue & 0x40u) ? 0x08u : 0x00u));
  }
}

/* A $7FFD write; ignored while locked (~3646) */
static void zxnextMemorySetPort7ffd(uint32_t value) {
  if (!zxnextMemoryPagingEnabled()) return;
  memPort7ffd = (uint8_t)value;
  zxnextMemoryReloadMmu(1u, 0u);
}

static uint32_t zxnextMemoryGetPort7ffd(void) {
  return memPort7ffd;
}

/* A $DFFD write; ignored while locked (~3688) */
static void zxnextMemorySetPortDffd(uint32_t value) {
  if (!zxnextMemoryPagingEnabled()) return;
  memPortDffd = (uint8_t)(value & 0x1fu);
  memPortDffd6 = (uint8_t)((value >> 6) & 0x01u);
  zxnextMemoryReloadMmu(1u, 0u);
}

static uint32_t zxnextMemoryGetPortDffd(void) {
  return memPortDffd;
}

/* The MF+3 read-back of $DFFD: '0' & dffd(6) & '0' & dffd(4-0) (zxnext.vhd ~4294) */
static uint32_t zxnextMemoryGetPortDffdReadback(void) {
  return ((uint32_t)memPortDffd6 << 6) | memPortDffd;
}

/* A $1FFD write; ignored while locked (~3715) */
static void zxnextMemorySetPort1ffd(uint32_t value) {
  if (!zxnextMemoryPagingEnabled()) return;
  uint32_t specialOld = memPort1ffd & 0x01u;
  memPort1ffd = (uint8_t)value;
  zxnextMemoryReloadMmu(1u, specialOld);
}

static uint32_t zxnextMemoryGetPort1ffd(void) {
  return memPort1ffd;
}

/* A $EFF7 write: bits 2 and 3 only (~3761); the lock does not apply */
static void zxnextMemorySetPortEff7(uint32_t value) {
  memPortEff7 = (uint8_t)(value & 0x0cu);
  zxnextMemoryReloadMmu(1u, 0u);
}

static uint32_t zxnextMemoryGetPortEff7(void) {
  return memPortEff7;
}
