/*
 * The DivMMC on a classic Spectrum (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C4): the 48K, the
 * 128K and the +2A/+3 cores include this once, before z80.c. It holds the interface's 8K ROM (the
 * user's esxDOS) and its 128K of RAM, pages them over $0000-$3FFF while the DivMMC is mapped, and
 * puts the shared DivMMC (zx-spectrum-divmmc.c) and SD card (zx-spectrum-sd.c) on the machine.
 *
 * The including core defines:
 * - ZXDC_PREFIX: its export prefix (`sp48`, `sp128`, `spp3e`)
 * - ZXDC_ROM3_PRESENT(): the 48K BASIC ROM is paged in at $0000 (what the automap's ROM-3 entry
 *   points test; the Next's sram_divmmc_automap_rom3_en)
 * - ZXDC_TACTS: the CPU's T-state counter
 * - ZXDC_REMAPPED(): the paging changed - bring the core's flat view of $0000-$3FFF up to date
 *
 * and calls, besides its port decoding (zxdcIsPort / zxdcReadPort / zxdcWritePort):
 * - for reads: while zxdcMapped, `zxdcView` is its $0000-$3FFF (ZXDC_REMAPPED() pages it in);
 * - zxdcWrite for a CPU write to $0000-$3FFF (only while mapped does it write anything);
 * - ZXDC_BEFORE_OPCODE_FETCH(pc), ZXDC_AFTER_OPCODE_FETCH() and ZXDC_AFTER_RETN(opCode) from its
 *   Z80 hooks;
 * - zxdcNmiBeforeCycle() / zxdcNmiAfterCycle(raised) around each CPU cycle (the NMI button);
 * - zxdcReset(hard) from its reset.
 *
 * Absent (the machine configured without it, the default), it decodes no port, maps nothing and
 * costs the fast frame nothing: reads never test for it, and only writes to the ROM area reach it.
 */

#ifndef ZXDC_PREFIX
#error "Define ZXDC_PREFIX before including zx-spectrum-divmmc-classic.c"
#endif

#define ZXDC_PASTE2(a, b) a##b
#define ZXDC_PASTE(a, b) ZXDC_PASTE2(a, b)
#define ZXDC(name) ZXDC_PASTE(ZXDC_PREFIX, name)

/* The 8K ROM, then sixteen 8K RAM banks (the original DivMMC's 128K) */
#define ZXDC_ROM_SIZE 0x2000u
#define ZXDC_RAM_BANKS 16u
#define ZXDC_MEMORY_SIZE (ZXDC_ROM_SIZE + ZXDC_RAM_BANKS * 0x2000u)
#define ZXDC_NO_WRITE 0xffffffffu

static uint8_t zxdcMemory[ZXDC_MEMORY_SIZE];
static uint8_t zxdcPresent;
static uint8_t zxdcMapped;
static uint8_t zxdcNmiPending;
static uint8_t *zxdcPage[2] = { zxdcMemory, zxdcMemory };
static uint8_t zxdcPageWritable[2];
/*
 * What the CPU reads at $0000-$3FFF while the DivMMC is mapped: its two 8K pages side by side, copied
 * at each change of the paging. The core pages this in as its ROM slot, so a read costs nothing
 * extra; a write to page 1 goes to the bank and here (zxdcWrite).
 */
static uint8_t zxdcView[0x4000u];

static void zxdcRemap(void);
/* z80.c comes after this file */
uint32_t z80GetPrefix(void);
void z80SetSigNmi(uint32_t value);

#define ZX_DIVMMC_OFFS_ROM 0u
#define ZX_DIVMMC_OFFS_RAM ZXDC_ROM_SIZE
#define ZX_DIVMMC_NO_WRITE_OFFSET ZXDC_NO_WRITE
#define ZX_DIVMMC_NOTIFY_MAPPING_CHANGE() zxdcRemap()
/* Every entry point is in the ROM area, so the CPU's fetch there is the ROM's (or the DivMMC's own) */
#define ZX_DIVMMC_ROM3_PRESENT(pc) ((pc) < 0x4000u && (ZXDC_ROM3_PRESENT()))
#include "zx-spectrum-divmmc.c"

#define ZX_SD_TACTS ZXDC_TACTS
#define ZX_SD_CONFIG_MODE_OR_FLASH_RESET() 0u
#include "zx-spectrum-sd.c"

static void zxdcRemap(void) {
  zxdcMapped = zxdcPresent != 0u && zxDivMmcIsMappingActive() != 0u ? 1u : 0u;
  for (uint32_t page = 0u; page < 2u; page++) {
    const uint32_t read = zxDivMmcGetReadOffset(page);
    const uint32_t write = zxDivMmcGetWriteOffset(page);
    zxdcPage[page] = &zxdcMemory[read < ZXDC_MEMORY_SIZE ? read : 0u];
    zxdcPageWritable[page] = write != ZXDC_NO_WRITE ? 1u : 0u;
    if (zxdcMapped != 0u) {
      for (uint32_t i = 0u; i < 0x2000u; i++) zxdcView[(page << 13u) | i] = zxdcPage[page][i];
    }
  }
  ZXDC_REMAPPED();
}

/* Out of line: the core calls it only for a write to $0000-$3FFF, which the ROM ignores */
#if defined(__clang__) || defined(__GNUC__)
#define ZXDC_NOINLINE __attribute__((noinline))
#else
#define ZXDC_NOINLINE
#endif

/* @returns 1 when the byte was written (page 1 in a writable bank): to the bank and to the view */
static ZXDC_NOINLINE uint8_t zxdcWrite(uint32_t address, uint8_t value) {
  if (zxdcMapped == 0u) return 0u;
  const uint32_t page = (address >> 13u) & 0x01u;
  if (zxdcPageWritable[page] == 0u) return 0u;
  zxdcPage[page][address & 0x1fffu] = value;
  zxdcView[address & 0x3fffu] = value;
  return 1u;
}

/* The CPU hooks: the automap's entry points, its delayed mapping, RETN */
#define ZXDC_BEFORE_OPCODE_FETCH(pc) \
  do { if (zxdcPresent != 0u) zxDivMmcBeforeOpcodeFetch((uint32_t)(pc)); } while (0)
#define ZXDC_AFTER_OPCODE_FETCH() \
  do { if (zxdcPresent != 0u) zxDivMmcAfterM1(); } while (0)
/* im2_control o_retn_seen: exactly ED 45 */
#define ZXDC_AFTER_RETN(opCode) \
  do { if (zxdcPresent != 0u && (opCode) == 0x45u) zxDivMmcRetn(); } while (0)

/* The DivMMC's ports decode A7-A0 only: $E3 (control), $E7 (card select), $EB (SPI data) */
static inline uint8_t zxdcIsPort(uint32_t address) {
  if (zxdcPresent == 0u) return 0u;
  const uint32_t low = address & 0xffu;
  return low == 0xe3u || low == 0xe7u || low == 0xebu ? 1u : 0u;
}

static uint32_t zxdcReadPort(uint32_t address) {
  switch (address & 0xffu) {
    case 0xe3u:
      return zxDivMmcGetPortE3();
    case 0xebu:
      return zxSdReadMmcData();
    default:
      return 0xffu;
  }
}

static void zxdcWritePort(uint32_t address, uint32_t value) {
  switch (address & 0xffu) {
    case 0xe3u:
      zxDivMmcSetPortE3(value);
      break;
    case 0xe7u:
      zxSdSpiCsWrite(value);
      break;
    case 0xebu:
      zxSdWriteMmcData(value);
      break;
  }
}

/* The NMI button: raised at the next instruction boundary (not inside a prefixed opcode) */
static inline uint8_t zxdcNmiBeforeCycle(void) {
  if (zxdcNmiPending == 0u || z80GetPrefix() != 0u) return 0u;
  z80SetSigNmi(1u);
  return 1u;
}

static inline void zxdcNmiAfterCycle(uint8_t raised) {
  if (raised == 0u) return;
  z80SetSigNmi(0u);
  zxdcNmiPending = 0u;
}

/* A reset: the interface's own reset (its ROM stays; a hard reset also clears its RAM) */
static void zxdcReset(uint32_t hard) {
  if (hard != 0u) {
    for (uint32_t i = ZXDC_ROM_SIZE; i < ZXDC_MEMORY_SIZE; i++) zxdcMemory[i] = 0u;
  }
  if (zxdcPresent != 0u) {
    zxDivMmcSetClassicDefaults();
  } else {
    zxDivMmcReset();
  }
  zxSdReset();
  zxdcNmiPending = 0u;
  zxdcRemap();
}

// -----------------------------------------------------------------------------
// Exports: the host connects the interface, uploads its ROM, presses its button and serves the SD
// card's sectors (as the Next's host does, ZxNextWasmV2Machine.processFrameCommand)

/* 1 connects the DivMMC (takes effect now; the host resets the machine after it) */
void ZXDC(DivMmcSetPresent)(uint32_t present) {
  zxdcPresent = present != 0u ? 1u : 0u;
  zxdcReset(0u);
}
uint32_t ZXDC(DivMmcGetPresent)(void) { return zxdcPresent; }
/* The ROM (8K) and RAM (128K) as one block: the host uploads the ROM, the IDE reads both */
uint32_t ZXDC(DivMmcMemoryPtr)(void) { return (uint32_t)(uintptr_t)zxdcMemory; }
uint32_t ZXDC(DivMmcMemorySize)(void) { return ZXDC_MEMORY_SIZE; }
void ZXDC(DivMmcPressNmi)(void) {
  if (zxdcPresent == 0u) return;
  zxDivMmcArmNmiButton();
  zxdcNmiPending = 1u;
}
uint32_t ZXDC(DivMmcGetPortE3)(void) { return zxDivMmcGetPortE3(); }
uint32_t ZXDC(DivMmcGetMapped)(void) { return zxdcMapped; }
uint32_t ZXDC(DivMmcGetAutoMapActive)(void) { return zxDivMmcGetAutoMapActive(); }
/*
 * What the CPU sees in 8K page 0 or 1 ($0000, $2000) while the DivMMC is mapped: 0 not mapped,
 * 1 its ROM, 2 + n its RAM bank n
 */
uint32_t ZXDC(DivMmcGetPageSource)(uint32_t page) {
  if (zxdcMapped == 0u || page > 1u) return 0u;
  const uint32_t offset = (uint32_t)(zxdcPage[page] - zxdcMemory);
  return offset < ZXDC_ROM_SIZE ? 1u : 2u + ((offset - ZXDC_ROM_SIZE) >> 13u);
}

uint32_t ZXDC(GetSdHostCommand)(void) { return zxSdGetHostCommand(); }
uint32_t ZXDC(GetSdHostSector)(void) { return zxSdGetHostSector(); }
uint32_t ZXDC(GetSdWriteBufferPtr)(void) { return zxSdWriteBufferPtr(); }
uint32_t ZXDC(GetSdWriteBufferLength)(void) { return zxSdGetWriteBufferLength(); }
void ZXDC(ClearSdHostCommand)(void) { zxSdClearHostCommand(); }
void ZXDC(SetSdReadResponse)(uint32_t dataPtr, uint32_t length) { zxSdSetReadResponse(0u, dataPtr, length); }
void ZXDC(SetSdWriteResponse)(uint32_t success) { zxSdSetWriteResponse(0u, success); }
void ZXDC(SetSdCardInfo)(uint32_t totalSectors) { zxSdSetCardInfo(0u, totalSectors); }

/* The frame loop and the debug loop return to the host while the card waits for a sector */
#define ZXDC_HOST_WAITING() (zxSdGetHostCommand() != ZX_SD_HOST_COMMAND_NONE)

#undef ZXDC
#undef ZXDC_PASTE
#undef ZXDC_PASTE2
