#include "zxnext-sd.h"
#include "zxnext-nextreg.h"

/* The Next's side of the shared SD cards (zxSpectrum/wasm/common/zx-spectrum-sd.c) */
#define ZX_SD_TACTS tacts
#define ZX_SD_CONFIG_MODE_OR_FLASH_RESET() zxnextNextRegConfigModeOrFlashReset()

#include "../../../zxSpectrum/wasm/common/zx-spectrum-sd.c"

#if ZXNEXT_CORE_VERSION >= 30204
/*
 * Port $E7 with NextReg $0A bit 5 (swap SD0/SD1): zxnext.vhd@3.02.04 ~3606-3609, `xxxxxx10` ->
 * "111111" & not swap & swap, `xxxxxx01` -> "111111" & swap & not swap. Only those two selections move;
 * the swap acts on later writes, not on the card already selected. 3.02.01 has no swap
 * (zxnext.vhd@3.02.01 ~3308-3311: $FE / $FD).
 */
static void zxnextSdSpiCsWrite(uint32_t value) {
  const uint32_t low = value & 0x03u;
  if ((zxnextNextRegs[0x0au] & 0x20u) != 0u && (low == 0x01u || low == 0x02u)) value ^= 0x03u;
  zxSdSpiCsWrite(value);
}
#endif
