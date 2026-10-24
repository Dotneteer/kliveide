#include "zxnext-divmmc.h"
#include "zxnext-memory.h"

/*
 * The Next's side of the shared DivMMC (zxSpectrum/wasm/common/zx-spectrum-divmmc.c): where its
 * memory lives in the Next's 2M, and the ROM-3 test of the automap entry points.
 */

#define ZX_DIVMMC_OFFS_ROM 0x010000u
#define ZX_DIVMMC_OFFS_RAM 0x020000u
#define ZX_DIVMMC_NO_WRITE_OFFSET ZXNEXT_NO_WRITE_OFFSET
#define ZX_DIVMMC_NOTIFY_MAPPING_CHANGE() zxnextMemoryUpdateMapping()
#define ZX_DIVMMC_ROM3_PRESENT(pc) zxnextDivMmcRom3Present(pc)

static uint32_t zxnextLayer2GetEnableMappingForReads(void);

/*
 * sram_divmmc_automap_rom3_en (zxnext.vhd ~3093): the ROM is paged in at the fetch address, ROM 3 is
 * selected, and Layer 2 is not read-mapped over it. In the ROM area sram_pre_override is "111" for every
 * Layer 2 segment (~3009-3012), so any read mapping ($123B bit 2) covers a fetch at $0000-$3FFF.
 */
static uint32_t zxnextDivMmcRom3Present(uint32_t pc) {
  if (zxnextNextRegs[0x50u + ((pc >> 13) & 0x07u)] != 0xffu) return 0;
  if (zxnextLayer2GetEnableMappingForReads()) return 0;
  return zxnextMemoryGetSelectedRomPage() == 3u;
}

#include "../../../zxSpectrum/wasm/common/zx-spectrum-divmmc.c"
