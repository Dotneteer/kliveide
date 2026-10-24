#include "zxnext-sd.h"
#include "zxnext-nextreg.h"

/* The Next's side of the shared SD cards (zxSpectrum/wasm/common/zx-spectrum-sd.c) */
#define ZX_SD_TACTS tacts
#define ZX_SD_CONFIG_MODE_OR_FLASH_RESET() zxnextNextRegConfigModeOrFlashReset()

#include "../../../zxSpectrum/wasm/common/zx-spectrum-sd.c"
