#include "zx-spectrum-divmmc.h"

/*
 * The DivMMC, shared by the Next and the classic cores (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C3).
 * Written from the Next FPGA's divmmc.vhd and zxnext.vhd (the core's reference); moved here from the
 * Next's zxnext-divmmc.c unchanged, the machine-specific parts left to the including core:
 *
 * - ZX_DIVMMC_NOTIFY_MAPPING_CHANGE(): the paging changed; rebuild the memory map
 * - ZX_DIVMMC_ROM3_PRESENT(pc): the 48K BASIC ROM is what the CPU fetches at pc (the Next's
 *   sram_divmmc_automap_rom3_en; on a classic machine: the 48K ROM is paged in)
 * - ZX_DIVMMC_OFFS_ROM / ZX_DIVMMC_OFFS_RAM: where the 8K ROM and the 16 8K RAM banks are in memory
 * - ZX_DIVMMC_NO_WRITE_OFFSET: the write offset of a read-only page
 *
 * The automap configuration (NextRegs $B8-$BB) is set through zxDivMmcSetNextRegB8..BB; a classic
 * machine sets the VHDL's reset defaults once (zxDivMmcSetClassicDefaults).
 */

static uint8_t divMmcEnabled;
static uint8_t divMmcConmem;
static uint8_t divMmcMapram;
static uint8_t divMmcBank;
static uint8_t divMmcPortLastE3Value;
static uint8_t divMmcEnableAutomap;
static uint8_t divMmcRequestAutomapOn;
static uint8_t divMmcRequestAutomapOff;
static uint8_t divMmcAutoMapActive;
static uint8_t divMmcConmemActivated;
static uint8_t divMmcNmiButtonPressed;
static uint8_t divMmcEnableNmiByDriveButton;
static uint8_t divMmcEnableMultifaceNmiByM1Button;
static uint8_t divMmcRstEnabled[8];
static uint8_t divMmcRstOnlyWithRom3[8];
static uint8_t divMmcRstInstant[8];
static uint8_t divMmcAutomapOn3dxx;
static uint8_t divMmcAutomapOff1ff8;
static uint8_t divMmcAutomapOn056a;
static uint8_t divMmcAutomapOn04d7;
static uint8_t divMmcAutomapOn0562;
static uint8_t divMmcAutomapOn04c6;
static uint8_t divMmcAutomapOn0066;
static uint8_t divMmcAutomapOn0066Delayed;


static void zxDivMmcSetAutomapRequest(uint32_t instant) {
  if (instant) {
    if (!divMmcAutoMapActive) {
      divMmcAutoMapActive = 1;
      divMmcNmiButtonPressed = 0;
      ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
    }
    divMmcRequestAutomapOn = 0;
  } else {
    divMmcRequestAutomapOn = 1;
  }
}

static void zxDivMmcCheckManualConmem(void) {
  if (divMmcConmem && !divMmcConmemActivated) {
    divMmcConmemActivated = 1;
    ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
  } else if (!divMmcConmem && divMmcConmemActivated) {
    divMmcConmemActivated = 0;
    ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
  }
}

static void zxDivMmcCheckRstTraps(uint32_t pc, uint32_t rom3Present) {
  if (pc > 0x38u || (pc & 0x07u) != 0) return;
  uint32_t index = pc >> 3;
  if (!divMmcRstEnabled[index]) return;
  if (divMmcRstOnlyWithRom3[index] && !rom3Present) return;
  zxDivMmcSetAutomapRequest(divMmcRstInstant[index]);
}

static void zxDivMmcCheckCustomEntry(uint32_t pc, uint32_t rom3Present) {
  if (!rom3Present) return;
  if ((pc == 0x04c6u && divMmcAutomapOn04c6) ||
      (pc == 0x0562u && divMmcAutomapOn0562) ||
      (pc == 0x04d7u && divMmcAutomapOn04d7) ||
      (pc == 0x056au && divMmcAutomapOn056a)) {
    zxDivMmcSetAutomapRequest(0);
  }
}

static void zxDivMmcCheckNmiEntry(uint32_t pc) {
  if (pc != 0x0066u) return;
  if (!divMmcEnableNmiByDriveButton || !divMmcNmiButtonPressed) return;
  if (!divMmcAutomapOn0066 && !divMmcAutomapOn0066Delayed) return;
  zxDivMmcSetAutomapRequest(divMmcAutomapOn0066);
}

static void zxDivMmcCheckRangeEntry(uint32_t pc, uint32_t rom3Present) {
  if (pc >= 0x3d00u && pc <= 0x3dffu) {
    if (rom3Present && divMmcAutomapOn3dxx) zxDivMmcSetAutomapRequest(1);
    return;
  }
  if (pc >= 0x1ff8u && pc <= 0x1fffu && divMmcAutomapOff1ff8) {
    divMmcRequestAutomapOff = 1;
  }
}

static void zxDivMmcReset(void) {
  divMmcEnabled = 1;
  divMmcConmem = 0;
  divMmcMapram = 0;
  divMmcBank = 0;
  divMmcPortLastE3Value = 0;
  divMmcEnableAutomap = 0;
  divMmcRequestAutomapOn = 0;
  divMmcRequestAutomapOff = 0;
  divMmcAutoMapActive = 0;
  divMmcConmemActivated = 0;
  divMmcNmiButtonPressed = 0;
  divMmcEnableNmiByDriveButton = 0;
  divMmcEnableMultifaceNmiByM1Button = 0;
  for (uint32_t i = 0; i < 8u; i++) {
    divMmcRstEnabled[i] = 0;
    divMmcRstOnlyWithRom3[i] = 0;
    divMmcRstInstant[i] = 0;
  }
  divMmcAutomapOn3dxx = 0;
  divMmcAutomapOff1ff8 = 0;
  divMmcAutomapOn056a = 0;
  divMmcAutomapOn04d7 = 0;
  divMmcAutomapOn0562 = 0;
  divMmcAutomapOn04c6 = 0;
  divMmcAutomapOn0066 = 0;
  divMmcAutomapOn0066Delayed = 0;
}

static void zxDivMmcSetPortE3(uint32_t value) {
  if (!divMmcEnabled) return;
  uint8_t byteValue = (uint8_t)value;
  divMmcPortLastE3Value = byteValue;
  uint8_t oldMapping = (uint8_t)zxDivMmcIsMappingActive();
  divMmcConmem = (byteValue & 0x80u) != 0;
  /* zxnext.vhd ~4162: mapram is sticky - a write ORs it in; only a $09 bit 3 write clears it */
  divMmcMapram = divMmcMapram || (byteValue & 0x40u) != 0;
  divMmcBank = byteValue & 0x0fu;
  if (oldMapping || zxDivMmcIsMappingActive()) ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
}

static uint32_t zxDivMmcGetPortE3(void) {
  if (!divMmcEnabled) return 0xffu;
  return (divMmcConmem ? 0x80u : 0x00u) |
    (divMmcMapram ? 0x40u : 0x00u) |
    (divMmcBank & 0x0fu);
}

static void zxDivMmcSetNextReg83(uint32_t value) {
  uint8_t oldEnabled = divMmcEnabled;
  divMmcEnabled = ((uint8_t)value & 0x01u) != 0;
  if (oldEnabled == divMmcEnabled) return;
  if (divMmcEnabled) {
    zxDivMmcSetPortE3(divMmcPortLastE3Value);
  } else {
    divMmcAutoMapActive = 0;
    divMmcConmemActivated = 0;
    ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
  }
}

static void zxDivMmcSetNextReg0A(uint32_t value) {
  uint8_t newEnable = ((uint8_t)value & 0x10u) != 0;
  if (divMmcEnableAutomap == newEnable) return;
  divMmcEnableAutomap = newEnable;
  if (!newEnable) {
    divMmcAutoMapActive = 0;
    divMmcConmemActivated = 0;
    divMmcNmiButtonPressed = 0;
    divMmcRequestAutomapOn = 0;
    divMmcRequestAutomapOff = 0;
    ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
  }
}

static void zxDivMmcSetNextReg09(uint32_t value) {
  if (((uint8_t)value & 0x08u) == 0 || !divMmcMapram) return;
  divMmcMapram = 0;
  ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
}

static void zxDivMmcSetNextRegB8(uint32_t value) {
  for (uint32_t i = 0; i < 8u; i++) divMmcRstEnabled[i] = (((uint8_t)value >> i) & 0x01u) != 0;
}

static void zxDivMmcSetNextRegB9(uint32_t value) {
  for (uint32_t i = 0; i < 8u; i++) divMmcRstOnlyWithRom3[i] = ((((uint8_t)value >> i) & 0x01u) == 0);
}

static void zxDivMmcSetNextRegBA(uint32_t value) {
  for (uint32_t i = 0; i < 8u; i++) divMmcRstInstant[i] = (((uint8_t)value >> i) & 0x01u) != 0;
}

static void zxDivMmcSetNextRegBB(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  divMmcAutomapOn3dxx = (byteValue & 0x80u) != 0;
  divMmcAutomapOff1ff8 = (byteValue & 0x40u) != 0;
  divMmcAutomapOn056a = (byteValue & 0x20u) != 0;
  divMmcAutomapOn04d7 = (byteValue & 0x10u) != 0;
  divMmcAutomapOn0562 = (byteValue & 0x08u) != 0;
  divMmcAutomapOn04c6 = (byteValue & 0x04u) != 0;
  divMmcAutomapOn0066 = (byteValue & 0x02u) != 0;
  divMmcAutomapOn0066Delayed = (byteValue & 0x01u) != 0;
}

static void zxDivMmcSetEnableNmiByDriveButton(uint32_t enabled) {
  divMmcEnableNmiByDriveButton = enabled != 0u;
}

static void zxDivMmcSetEnableMultifaceNmiByM1Button(uint32_t enabled) {
  divMmcEnableMultifaceNmiByM1Button = enabled != 0u;
}

static uint32_t zxDivMmcGetEnableNmiByDriveButton(void) {
  return divMmcEnableNmiByDriveButton;
}

static uint32_t zxDivMmcGetEnableMultifaceNmiByM1Button(void) {
  return divMmcEnableMultifaceNmiByM1Button;
}

static uint32_t zxDivMmcGetNextRegB8(void) {
  uint32_t value = 0;
  for (uint32_t i = 0; i < 8u; i++) value |= divMmcRstEnabled[i] ? (1u << i) : 0u;
  return value;
}

static uint32_t zxDivMmcGetNextRegB9(void) {
  uint32_t value = 0;
  for (uint32_t i = 0; i < 8u; i++) value |= divMmcRstOnlyWithRom3[i] ? 0u : (1u << i);
  return value;
}

static uint32_t zxDivMmcGetNextRegBA(void) {
  uint32_t value = 0;
  for (uint32_t i = 0; i < 8u; i++) value |= divMmcRstInstant[i] ? (1u << i) : 0u;
  return value;
}

static uint32_t zxDivMmcGetNextRegBB(void) {
  return (divMmcAutomapOn3dxx ? 0x80u : 0x00u) |
    (divMmcAutomapOff1ff8 ? 0x40u : 0x00u) |
    (divMmcAutomapOn056a ? 0x20u : 0x00u) |
    (divMmcAutomapOn04d7 ? 0x10u : 0x00u) |
    (divMmcAutomapOn0562 ? 0x08u : 0x00u) |
    (divMmcAutomapOn04c6 ? 0x04u : 0x00u) |
    (divMmcAutomapOn0066 ? 0x02u : 0x00u) |
    (divMmcAutomapOn0066Delayed ? 0x01u : 0x00u);
}

static void zxDivMmcBeforeOpcodeFetch(uint32_t pc) {
  zxDivMmcCheckManualConmem();
  if (!divMmcEnableAutomap) return;
  uint32_t rom3Present = ZX_DIVMMC_ROM3_PRESENT(pc & 0xffffu);
  zxDivMmcCheckRstTraps(pc & 0xffffu, rom3Present);
  zxDivMmcCheckNmiEntry(pc & 0xffffu);
  zxDivMmcCheckCustomEntry(pc & 0xffffu, rom3Present);
  zxDivMmcCheckRangeEntry(pc & 0xffffu, rom3Present);
}

/* RETN (ED 45, Multiface not active): hold, held and the button latch go (divmmc.vhd i_retn_seen) */
static void zxDivMmcRetn(void) {
  divMmcNmiButtonPressed = 0;
  divMmcAutoMapActive = 0;
  divMmcConmemActivated = 0;
  divMmcRequestAutomapOn = 0;
  divMmcRequestAutomapOff = 0;
  ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
}

/*
 * After the M1 cycle of an opcode fetch (Z80_AFTER_OPCODE_FETCH): automap_held follows automap_hold,
 * so a delayed entry point maps from the opcode's operands on and $1FF8 unmaps before them.
 */
static void zxDivMmcAfterM1(void) {
  if (divMmcRequestAutomapOn) {
    divMmcAutoMapActive = 1;
    divMmcRequestAutomapOn = 0;
    divMmcNmiButtonPressed = 0;
    ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
  } else if (divMmcRequestAutomapOff) {
    divMmcAutoMapActive = 0;
    divMmcRequestAutomapOff = 0;
    ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
  }
}

/* The two steps together, for a core's after-fetch export (the Next's zxnextDivMmcAfterFetch) */
static void zxDivMmcAfterOpcodeFetch(uint32_t retnSeen, uint32_t suppressRetn) {
  if (retnSeen && !suppressRetn) {
    zxDivMmcRetn();
    return;
  }
  zxDivMmcAfterM1();
}

static void zxDivMmcArmNmiButton(void) {
  divMmcNmiButtonPressed = 1;
}

static void zxDivMmcUpdateMemoryMapping(void) {
  ZX_DIVMMC_NOTIFY_MAPPING_CHANGE();
}

static uint32_t zxDivMmcGetEnabled(void) { return divMmcEnabled; }
static uint32_t zxDivMmcGetEnableAutomap(void) { return divMmcEnableAutomap; }
static uint32_t zxDivMmcGetConmem(void) { return divMmcConmem; }
static uint32_t zxDivMmcGetMapram(void) { return divMmcMapram; }
static uint32_t zxDivMmcGetBank(void) { return divMmcBank; }
static uint32_t zxDivMmcGetAutoMapActive(void) { return divMmcAutoMapActive; }
static uint32_t zxDivMmcGetRequestAutomapOn(void) { return divMmcRequestAutomapOn; }
static uint32_t zxDivMmcGetRequestAutomapOff(void) { return divMmcRequestAutomapOff; }
static uint32_t zxDivMmcGetNmiHold(void) { return divMmcAutoMapActive || divMmcNmiButtonPressed; }

static uint32_t zxDivMmcIsMappingActive(void) {
  return divMmcEnabled && (divMmcConmem || divMmcAutoMapActive);
}

static uint32_t zxDivMmcGetReadOffset(uint32_t page) {
  if ((page & 0x01u) == 0) {
    return divMmcMapram ? (ZX_DIVMMC_OFFS_RAM + 3u * 0x2000u) : ZX_DIVMMC_OFFS_ROM;
  }
  return ZX_DIVMMC_OFFS_RAM + ((uint32_t)(divMmcBank & 0x0fu) << 13);
}

static uint32_t zxDivMmcGetWriteOffset(uint32_t page) {
  if ((page & 0x01u) == 0) return ZX_DIVMMC_NO_WRITE_OFFSET;
  if (divMmcMapram && divMmcBank == 3u) return ZX_DIVMMC_NO_WRITE_OFFSET;
  return ZX_DIVMMC_OFFS_RAM + ((uint32_t)(divMmcBank & 0x0fu) << 13);
}

/*
 * A classic machine's DivMMC: what the Next sets through NextRegs, fixed at the VHDL's reset values
 * (zxnext.vhd: nr_b8 $83, nr_b9 $01, nr_ba $00, nr_bb $CD) - RST $00, $08 and $38 trap (RST $00 also
 * without ROM 3), all delayed; $3Dxx instantly with ROM 3; $1FF8-$1FFF unmap; $0562 and $04C6 with
 * ROM 3; the NMI at $0066, delayed - and automap and the drive button's NMI on, as the original
 * DivMMC has them.
 */
static void zxDivMmcSetClassicDefaults(void) {
  zxDivMmcReset();
  zxDivMmcSetNextRegB8(0x83u);
  zxDivMmcSetNextRegB9(0x01u);
  zxDivMmcSetNextRegBA(0x00u);
  zxDivMmcSetNextRegBB(0xcdu);
  zxDivMmcSetNextReg0A(0x10u);
  zxDivMmcSetEnableNmiByDriveButton(1u);
}
