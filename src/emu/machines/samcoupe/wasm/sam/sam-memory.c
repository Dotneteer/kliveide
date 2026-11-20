/*
 * The SAM Coupé memory map (plan §5; ASIC_VIDEO_MEMORY_TIMING.md §2).
 *
 * The CPU sees four 16K sections A-D:
 *   A (0000h)  ROM0, or with LMPR bit 5 (RAM0) internal page LMPR[4:0]; LMPR bit 7 write-protects it
 *   B (4000h)  internal page LMPR + 1
 *   C (8000h)  internal page HMPR[4:0], or with HMPR bit 7 (MCNTRL) the external page LEPR (80h)
 *   D (C000h)  internal page HMPR + 1, or ROM1 with LMPR bit 6; with MCNTRL the external page HEPR (81h),
 *              which wins over ROM1 (both emulators test external memory first; Q-constant below)
 * Page numbers wrap at 32 (page 31 + 1 = page 0).
 *
 * Missing pages (16-31 on the 256K model, plan Q1): read FFh, writes dropped, never contended (the
 * emulators' scratch pages). External memory: one 1 MB pack (64 pages) when fitted (`MC_SAM_EXTMEM`);
 * LEPR/HEPR bits 0-5 select the page, bits 6-7 the pack, and only pack 0 is fitted. External RAM and the
 * ROM are never contended.
 *
 * The map is a base offset in `samMemory` and a flag byte per section, rebuilt on every LMPR, HMPR,
 * LEPR and HEPR write, so the hot path is one table look-up and one flag test.
 */

#define SAM_SEC_INTERNAL 0x01u
#define SAM_SEC_WRITABLE 0x02u

/* External RAM wins over ROM1 in section D (ASIC §2.2 inference; one constant) */
#define SAM_EXTMEM_OVER_ROM1 1

/* LMPR, HMPR, VMPR and the external page registers as last written */
static uint8_t samLmpr;
static uint8_t samHmpr;
static uint8_t samVmpr;
static uint8_t samLepr;
static uint8_t samHepr;

/* The fitted memory (`samConfigure`): internal pages (16 or 32), external pages (0 or 64) */
static uint8_t samRamPages = 32u;
static uint8_t samExtPages;

static uint32_t samSectionBase[4];
static uint8_t samSectionFlags[4];
/* Bit n: section n is internal RAM (contended) */
static uint8_t samSectionContended;
/* Bit n: section n is writable */
static uint8_t samSectionWritable;

/* An internal page's physical base, or the unmapped block for a missing page */
static inline uint32_t samInternalPageBase(uint32_t page) {
  page &= 31u;
  return page < samRamPages ? SAM_PHYS_RAM + page * SAM_PAGE_SIZE : SAM_PHYS_UNMAPPED;
}

static inline uint8_t samInternalPageFlags(uint32_t page) {
  return (page & 31u) < samRamPages ? (uint8_t)(SAM_SEC_INTERNAL | SAM_SEC_WRITABLE) : 0u;
}

/* An external page register's physical base (only pack 0 is fitted), or the unmapped block */
static inline uint32_t samExternalPageBase(uint8_t reg) {
  return reg < samExtPages ? SAM_PHYS_EXT + (uint32_t)reg * SAM_PAGE_SIZE : SAM_PHYS_UNMAPPED;
}

static void samRemap(void) {
  // --- A: ROM0, or RAM page LMPR, write-protected by LMPR bit 7
  if (samLmpr & 0x20u) {
    samSectionBase[0] = samInternalPageBase(samLmpr);
    samSectionFlags[0] = samInternalPageFlags(samLmpr);
    if (samLmpr & 0x80u) samSectionFlags[0] &= (uint8_t)~SAM_SEC_WRITABLE;
  } else {
    samSectionBase[0] = SAM_PHYS_ROM;
    samSectionFlags[0] = 0u;
  }
  // --- B: RAM page LMPR + 1
  samSectionBase[1] = samInternalPageBase(samLmpr + 1u);
  samSectionFlags[1] = samInternalPageFlags(samLmpr + 1u);
  // --- C and D
  const uint8_t ext = (samHmpr & 0x80u) != 0u;
  if (ext) {
    samSectionBase[2] = samExternalPageBase(samLepr);
    samSectionFlags[2] = samSectionBase[2] != SAM_PHYS_UNMAPPED ? SAM_SEC_WRITABLE : 0u;
  } else {
    samSectionBase[2] = samInternalPageBase(samHmpr);
    samSectionFlags[2] = samInternalPageFlags(samHmpr);
  }
  if (ext && SAM_EXTMEM_OVER_ROM1) {
    samSectionBase[3] = samExternalPageBase(samHepr);
    samSectionFlags[3] = samSectionBase[3] != SAM_PHYS_UNMAPPED ? SAM_SEC_WRITABLE : 0u;
  } else if (samLmpr & 0x40u) {
    samSectionBase[3] = SAM_PHYS_ROM + SAM_PAGE_SIZE;
    samSectionFlags[3] = 0u;
  } else {
    samSectionBase[3] = samInternalPageBase(samHmpr + 1u);
    samSectionFlags[3] = samInternalPageFlags(samHmpr + 1u);
  }
  samSectionContended = 0u;
  samSectionWritable = 0u;
  for (uint32_t s = 0u; s < 4u; s++) {
    if (samSectionFlags[s] & SAM_SEC_INTERNAL) samSectionContended |= (uint8_t)(1u << s);
    if (samSectionFlags[s] & SAM_SEC_WRITABLE) samSectionWritable |= (uint8_t)(1u << s);
  }
}

static void samResetMemoryMap(void) {
  samLmpr = 0u;
  samHmpr = 0u;
  samVmpr = 0u;
  samLepr = 0u;
  samHepr = 0u;
  samRemap();
}

static inline uint32_t samPhysicalAddress(uint16_t address) {
  return samSectionBase[address >> 14] + (address & 0x3fffu);
}

static inline uint8_t samPeekMemory(uint16_t address) { return samMemory[samPhysicalAddress(address)]; }

static uint8_t samCpuReadMemory(uint16_t address) { return samPeekMemory(address); }

static void samCpuWriteMemory(uint16_t address, uint8_t value) {
  if (samSectionWritable & (1u << (address >> 14))) samMemory[samPhysicalAddress(address)] = value;
}

/* The IDE's writes: RAM as the CPU writes it, and the ROM too (the memory editor may patch it) */
static void samPokeMemory(uint16_t address, uint8_t value) {
  const uint32_t phys = samPhysicalAddress(address);
  if (phys < SAM_PHYS_UNMAPPED) samMemory[phys] = value;
}

/* Side-effect-free reads and writes for the IDE */
uint32_t samReadMemory(uint32_t address) { return samPeekMemory((uint16_t)address); }
void samWriteMemory(uint32_t address, uint32_t value) { samPokeMemory((uint16_t)address, (uint8_t)value); }
/* The physical offset of a CPU address in the core's memory */
uint32_t samGetPhysicalAddress(uint32_t address) { return samPhysicalAddress((uint16_t)address); }
uint32_t samGetSectionBase(uint32_t section) { return samSectionBase[section & 3u]; }
uint32_t samGetSectionFlags(uint32_t section) { return samSectionFlags[section & 3u]; }
uint32_t samGetLmpr(void) { return samLmpr; }
uint32_t samGetHmpr(void) { return samHmpr; }
uint32_t samGetVmpr(void) { return samVmpr; }
uint32_t samGetLepr(void) { return samLepr; }
uint32_t samGetHepr(void) { return samHepr; }
uint32_t samGetRamPages(void) { return samRamPages; }
uint32_t samGetExtPages(void) { return samExtPages; }
/* An internal page's byte (FFh for a missing page) */
uint32_t samReadPage(uint32_t page, uint32_t offset) {
  return samMemory[samInternalPageBase(page) + (offset & 0x3fffu)];
}
/* Writes a byte of an internal page that is fitted (the fast inject, the tests) */
void samWritePage(uint32_t page, uint32_t offset, uint32_t value) {
  const uint32_t base = samInternalPageBase(page);
  if (base != SAM_PHYS_UNMAPPED) samMemory[base + (offset & 0x3fffu)] = (uint8_t)value;
}
