#include "zxnext-nextreg.h"
#include "zxnext-memory.h"
#include "zxnext-interrupts.h"
#include "zxnext-divmmc.h"
#include "zxnext-input.h"
#include "zxnext-expansion.h"

/*
 * zxnext.vhd `nr_03_config_mode`: entered by writing 111 to NextReg $03's low bits, left by any other
 * non-zero value. Klive starts after the firmware, so it is off after every reset (as in the TypeScript
 * NextRegDevice.configMode). `nr_02_reset_type`: "100" at power-on, shifted on every soft reset
 * (~1692: '0' & rt(2) & (rt(1) or rt(0))). Both gate the FPGA flash chip select (port $E7 = $7F).
 */
static uint8_t zxnextConfigMode;
/* NextReg $03 (zxnext.vhd ~5100-5130): display timing, user lock, machine type. No reset branch: a
   soft reset keeps them; the hard reset sets the post-firmware values (+3 timing and type). */
static uint8_t zxnextMachineTiming;
static uint8_t zxnextMachineType;
static uint8_t zxnextUserDtLock;
static uint8_t zxnextResetType;
/* NextReg $F0, Issue 4 (zxnext.vhd ~7386-7427): select mode, and the DNA / XADC device selected */
static uint8_t zxnextXdevSelect;
static uint8_t zxnextXdevDna;
static uint8_t zxnextXdevAdc;

static uint32_t zxnextNextRegGetMachineTiming(void) {
  return zxnextMachineTiming;
}

static uint32_t zxnextNextRegGetMachineType(void) {
  return zxnextMachineType;
}

static uint32_t zxnextNextRegConfigModeOrFlashReset(void) {
  return zxnextConfigMode || (zxnextResetType & 0x04u) != 0u;
}

static void zxnextNextRegHardReset(void) {
  zxnextConfigMode = 0u;
  zxnextResetType = 0x04u;
  zxnextLastResetWasHard = 1u;
  zxnextMachineTiming = 3u;
  zxnextMachineType = 3u;
  zxnextUserDtLock = 0u;
  zxnextTimingSelect();
  zxnextResetRequest = 0u;
  for (uint32_t i = 0; i < ZXNEXT_NEXT_REG_COUNT; i++) zxnextNextRegs[i] = 0;
  cpuProgrammedSpeed = 0;
  cpuEffectiveSpeed = 0;
  cpuTactScale = 8;
  zxnextNextRegs[0x00] = 0x08;
  zxnextNextRegs[0x01] = 0x32;
  zxnextNextRegs[0x03] = 0x33; /* +3 display timing and machine type (post-firmware) */
  zxnextNextRegs[0x05] = 0x41;
  zxnextNextRegs[0x06] = 0x80;
  zxnextNextRegs[0x08] = 0x1a;
  zxnextNextRegs[0x0e] = 0x00;
  zxnextNextRegs[0x0f] = 0x02; /* g_board_issue: an Issue 4 board, as the $11 and $F0 rules assume */
  zxnextNextRegs[0x10] = 0x01; /* ~1127: nr_10_coreid := "00001", no reset branch */
  zxnextNextRegs[0x0a] = 0x01;
  zxnextNextRegs[0x12] = 0x08;
  zxnextNextRegs[0x13] = 0x0b;
  zxnextNextRegs[0x14] = 0xe3;
  zxnextNextRegs[0x15] = 0x00;
  zxnextNextRegs[0x16] = 0x00;
  zxnextNextRegs[0x17] = 0x00;
  zxnextNextRegs[0x7f] = 0xff; /* zxnext.vhd:1210 nr_7f_user_register_0 := X"FF" (no reset branch) */
  zxnextNextRegs[0x1c] = 0x00;
  zxnextNextRegs[0x1e] = 0x00;
  zxnextNextRegs[0x1f] = 0x00;
  zxnextNextRegs[0x22] = 0x00;
  zxnextNextRegs[0x23] = 0x00;
  zxnextNextRegs[0x32] = 0x00;
  zxnextNextRegs[0x33] = 0x00;
  zxnextNextRegs[0x42] = 0x07;
  zxnextNextRegs[0x43] = 0x00;
  zxnextNextRegs[0x4a] = 0xe3; /* zxnext.vhd reset: nr_4a_fallback_rgb <= X"E3" */
  zxnextNextRegs[0x4b] = 0xe3;
  zxnextNextRegs[0x4c] = 0x0f;
  zxnextNextRegs[0x61] = 0x00;
  zxnextNextRegs[0x62] = 0x00;
  zxnextNextRegs[0x6b] = 0x00;
  zxnextNextRegs[0x70] = 0x00;
  zxnextNextRegs[0x82] = 0xff;
  zxnextNextRegs[0x83] = 0xff;
  zxnextNextRegs[0x84] = 0xff;
  zxnextNextRegs[0x85] = 0x8f; /* ~1222-1223: enables $F, reset type 1 */
  zxnextNextRegs[0x8c] = 0x00;
  zxnextNextRegs[0xb8] = 0x83;
  zxnextNextRegs[0xb9] = 0x01;
  zxnextNextRegs[0xba] = 0x00;
  zxnextNextRegs[0xbb] = 0xcd;
  zxnextDivMmcSetNextReg09(zxnextNextRegs[0x09]);
  zxnextDivMmcSetNextReg0A(zxnextNextRegs[0x0a]);
  zxnextDivMmcSetNextReg83(zxnextNextRegs[0x83]);
  zxnextDivMmcSetNextRegB8(zxnextNextRegs[0xb8]);
  zxnextDivMmcSetNextRegB9(zxnextNextRegs[0xb9]);
  zxnextDivMmcSetNextRegBA(zxnextNextRegs[0xba]);
  zxnextDivMmcSetNextRegBB(zxnextNextRegs[0xbb]);
  zxnextPsgSetAyStereoMode(zxnextNextRegs[0x08] & 0x20u);
  zxnextDacSetEnabled(zxnextNextRegs[0x08] & 0x08u);
  zxnextExpansionHardReset();
  zxnextNextRegApplyResetBranch();
}

/*
 * The NextReg values every reset restores: the zxnext.vhd `if reset = '1'` branches (~4591-4598 MMU,
 * ~4907-5083 NextReg process, ~3871 $D9). Both a soft and a hard reset run it. The devices behind these
 * registers reset their own state in zxnextReset; this restores the stored values they are read and
 * composed from. Mirrors NextRegDevice.commonReset/reset in the TypeScript core.
 */
static void zxnextNextRegApplyResetBranch(void) {
  nextRegIndex = 0x24; /* ~4575: protection against legacy programs hitting $243B/$253B */
  zxnextNextRegs[0x0b] = 0x01; /* joystick I/O mode off, iomode_0 = 1 */
  zxnextNextRegs[0x12] = 0x08;
  zxnextNextRegs[0x13] = 0x0b;
  zxnextNextRegs[0x14] = 0xe3;
  zxnextNextRegs[0x15] = 0x00;
  zxnextNextRegs[0x16] = 0x00;
  zxnextNextRegs[0x17] = 0x00;
  zxnextNextRegs[0x1c] = 0x00;
  zxnextNextRegs[0x22] = 0x00;
  zxnextNextRegs[0x23] = 0x00;
  zxnextNextRegs[0x32] = 0x00;
  zxnextNextRegs[0x33] = 0x00;
  zxnextNextRegs[0x42] = 0x07;
  zxnextNextRegs[0x43] = 0x00;
  zxnextNextRegs[0x4a] = 0xe3;
  zxnextNextRegs[0x4b] = 0xe3;
  zxnextNextRegs[0x4c] = 0x0f;
  zxnextNextRegs[0x61] = 0x00;
  zxnextNextRegs[0x62] = 0x00;
  zxnextNextRegs[0x69] = 0x00; /* port_ff_reg and the $7FFD shadow bit reset to 0 */
  zxnextNextRegs[0x6b] = 0x00;
  zxnextNextRegs[0x70] = 0x00;
  /* Pi GPIO output enables, Pi peripherals, Pi I2S, ESP GPIO0 enable */
  zxnextNextRegs[0x90] = 0x00;
  zxnextNextRegs[0x91] = 0x00;
  zxnextNextRegs[0x92] = 0x00;
  zxnextNextRegs[0x93] = 0x00;
  zxnextNextRegs[0xa0] = 0x00;
  zxnextNextRegs[0xa2] = 0x00;
  zxnextNextRegs[0xa8] = 0x00;
  /* ~5048-5051, ~5063: the Pi GPIO and ESP GPIO0 output latches */
  zxnextNextRegs[0x98] = 0xff;
  zxnextNextRegs[0x99] = 0x01;
  zxnextNextRegs[0x9a] = 0x00;
  zxnextNextRegs[0x9b] = 0x00;
  zxnextNextRegs[0xa9] = 0x01;
  /* ~7394, ~7405: $F0 back in select mode with no device */
  zxnextXdevSelect = 1u;
  zxnextXdevDna = 0u;
  zxnextXdevAdc = 0u;
  /* UART and DMA interrupt enables, FDC I/O trap enable, I/O trap write value */
  zxnextNextRegs[0xc6] = 0x00;
  zxnextNextRegs[0xcc] = 0x00;
  zxnextNextRegs[0xcd] = 0x00;
  zxnextNextRegs[0xce] = 0x00;
  zxnextNextRegs[0xd8] = 0x00;
  zxnextNextRegs[0xd9] = 0x00;
  zxnextNextRegs[0xda] = 0x00; /* I/O trap cause */
  /* DivMMC automap entry points */
  zxnextNextRegs[0xb8] = 0x83;
  zxnextNextRegs[0xb9] = 0x01;
  zxnextNextRegs[0xba] = 0x00;
  zxnextNextRegs[0xbb] = 0xcd;
  zxnextDivMmcSetNextRegB8(zxnextNextRegs[0xb8]);
  zxnextDivMmcSetNextRegB9(zxnextNextRegs[0xb9]);
  zxnextDivMmcSetNextRegBA(zxnextNextRegs[0xba]);
  zxnextDivMmcSetNextRegBB(zxnextNextRegs[0xbb]);
  cpuProgrammedSpeed = 0; /* ~5733: nr_07_cpu_speed <= "00" */
  cpuEffectiveSpeed = 0;
  cpuTactScale = 8;
  zxnextNextRegs[0x07] = 0x00;
  zxnextMemoryResetMapping();
  /* the raster and the effective $05 bits from the power-on register values (the call above ran on the
     old ones) */
  zxnextTimingSelect();
}

/*
 * Soft reset (reset button, NextReg $02 bit 0). `keptNr06` is the $06 readback captured before the
 * device resets: zxnext.vhd has no reset branch for $05, $06 bits 6-0 except 5, $08 bits 5-0, $09 bits
 * 7-5, $0A, $7F, $85 bit 7 and $8F, so they survive - and the modules behind them (DivMMC NMI buttons,
 * PSG, mouse, joystick) get them replayed. `$80` and `$8C` copy bits 3-0 into 7-4 (~2142, ~2211).
 */
static void zxnextNextRegSoftReset(uint32_t keptNr06) {
  zxnextConfigMode = 0u;
  zxnextLastResetWasHard = 0u;
  zxnextResetRequest = 0u;
  zxnextResetType = (uint8_t)(((zxnextResetType >> 1u) & 0x02u) | ((zxnextResetType & 0x03u) != 0u ? 0x01u : 0u));
  zxnextNextRegApplyResetBranch();

  /* $06: hotkey enables (bits 7, 5) reset to 1, the rest survive */
  zxnextNextRegSetDirect(0x06u, 0xa0u | (keptNr06 & 0x5fu));
  /* $08: contention disable (bit 6) resets; bit 7 is the $7FFD lock readback */
  zxnextNextRegSetDirect(0x08u, zxnextNextRegs[0x08] & 0x3fu);
  /* $09: sprite tie (bit 4) resets; bit 3 is a write-only MAPRAM reset strobe */
  zxnextNextRegSetDirect(0x09u, zxnextNextRegs[0x09] & 0xe7u);
  zxnextNextRegSetDirect(0x05u, zxnextNextRegs[0x05]);
  zxnextNextRegSetDirect(0x0au, zxnextNextRegs[0x0a]);

  /* ~5029: the internal port enables reset only with $85 bit 7 (reset type) = 1 */
  if ((zxnextNextRegs[0x85] & 0x80u) != 0u) {
    zxnextNextRegSetDirect(0x82u, 0xffu);
    zxnextNextRegSetDirect(0x83u, 0xffu);
    zxnextNextRegSetDirect(0x84u, 0xffu);
    zxnextNextRegSetDirect(0x85u, 0x8fu);
  }

  uint32_t altRomLow = zxnextNextRegs[0x8c] & 0x0fu;
  zxnextNextRegSetDirect(0x8cu, (altRomLow << 4u) | altRomLow);
}

/* The 50/60 Hz and scandoubler bits in effect for the current frame (zxnext.vhd ~6644-6649); $05 reads them */
static uint8_t zxnextEffective5060;
static uint8_t zxnextEffectiveScandoubler = 1u;

/*
 * Picks the raster for the next frame (zxula_timing.vhd `i_timing`: 1XX Pentagon, 010 128K, 011 +3,
 * else 48K; `i_50_60`), mirroring TimingConfig.selectTimingConfig. The configs map a VHDL hc to
 * HC = hc + 8: displayXStart = c_min_hactive + 8, the interrupt at c_int_h + 8. 60 Hz frames are 264
 * lines with the display from line 40, so the paper sits at buffer row 24 as in the TypeScript core.
 */
static void zxnextTimingSelect(void) {
  uint32_t t = zxnextMachineTiming;
  /* ~5781: Pentagon timing holds the 50/60 Hz bit at 0 */
  if ((t & 0x04u) != 0u) zxnextNextRegs[0x05u] &= (uint8_t)~0x04u;
  uint32_t is60 = (zxnextNextRegs[0x05u] & 0x04u) != 0u;
  zxnextEffective5060 = (uint8_t)is60;
  zxnextEffectiveScandoubler = (uint8_t)(zxnextNextRegs[0x05u] & 0x01u);
  if ((t & 0x04u) != 0u) {
    /* Pentagon: 448 x 320; interrupt at VC 319, HC 439 + 8 = 447, the last HC of the frame */
    zxnextTimingTotalHc = 448u; zxnextTimingTotalVc = 320u;
    zxnextTimingFirstVc = 32u; zxnextTimingFirstHc = 88u;
    zxnextTimingDisplayXStart = 136u; zxnextTimingDisplayYStart = 80u;
    zxnextTimingIntStart = 319u * 448u + 447u;
  } else if (t == 2u || t == 3u) {
    /* 128K / +3: 456 x 311 (60 Hz: 264); interrupt at VC 1 (60 Hz: VC 0), HC 128 + 8 (128K) or 126 + 8 (+3) */
    zxnextTimingTotalHc = 456u; zxnextTimingTotalVc = is60 ? 264u : 311u;
    zxnextTimingFirstVc = 16u; zxnextTimingFirstHc = 96u;
    zxnextTimingDisplayXStart = 144u; zxnextTimingDisplayYStart = is60 ? 40u : 64u;
    zxnextTimingIntStart = (is60 ? 0u : 456u) + (t == 2u ? 136u : 134u);
  } else {
    /* 48K: 448 x 312 (60 Hz: 264); interrupt at VC 0, HC 116 + 8 */
    zxnextTimingTotalHc = 448u; zxnextTimingTotalVc = is60 ? 264u : 312u;
    zxnextTimingFirstVc = 16u; zxnextTimingFirstHc = 88u;
    zxnextTimingDisplayXStart = 136u; zxnextTimingDisplayYStart = is60 ? 40u : 64u;
    zxnextTimingIntStart = 124u;
  }
  /* ~4461-4473: the contention pattern follows the latched timing - 0 none (Pentagon), 1 48K, 2 128K, 3 +3 */
  zxnextTimingContention = (t & 0x04u) != 0u ? 0u : (t == 2u ? 2u : (t == 3u ? 3u : 1u));
  /* ~1989: pulse_count_end - 36 CPU cycles for 128K and Pentagon, 32 for 48K and +3 */
  zxnextTimingIntPulseCycles = (t == 2u || (t & 0x04u) != 0u) ? 36u : 32u;
}

static void zxnextNextRegSetIndex(uint32_t reg) {
  nextRegIndex = (uint8_t)reg;
}

static uint32_t zxnextNextRegGetIndex(void) {
  return nextRegIndex;
}

static void zxnextNextRegCpuWrite(uint32_t reg, uint32_t value);

static void zxnextNextRegSetValue(uint32_t value) {
  zxnextNextRegCpuWrite(nextRegIndex, value);
}

/*
 * The FPGA read mux (zxnext.vhd ~5830-6233): the bits of a `$253B` read that are hard-wired to 0.
 * Registers the mux does not list read $00 (`when others`), so their mask is $FF.
 * test/zxnext-hw/nextreg/read-mux.test.ts checks it.
 */
static uint32_t zxnextNextRegReadZeroMask(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x00u: return 0x00u;
    case 0x01u: return 0x00u;
    case 0x02u: return 0x60u;
    case 0x03u: return 0x00u;
    case 0x05u: return 0x00u;
    case 0x06u: return 0x00u;
    case 0x07u: return 0xccu;
    case 0x08u: return 0x00u;
    case 0x09u: return 0x08u;
    case 0x0au: return 0x24u;
    case 0x0bu: return 0x4eu;
    case 0x0eu: return 0x00u;
    case 0x0fu: return 0xf0u;
    case 0x10u: return 0x80u;
    case 0x11u: return 0xf8u;
    case 0x12u: return 0x80u;
    case 0x13u: return 0x80u;
    case 0x14u: return 0x00u;
    case 0x15u: return 0x00u;
    case 0x16u: return 0x00u;
    case 0x17u: return 0x00u;
    case 0x18u: return 0x00u;
    case 0x19u: return 0x00u;
    case 0x1au: return 0x00u;
    case 0x1bu: return 0x00u;
    case 0x1cu: return 0x00u;
    case 0x1eu: return 0xfeu;
    case 0x1fu: return 0x00u;
    case 0x20u: return 0x30u;
    case 0x22u: return 0x78u;
    case 0x23u: return 0x00u;
    case 0x26u: return 0x00u;
    case 0x27u: return 0x00u;
    case 0x28u: return 0x00u;
    case 0x2cu: return 0x00u;
    case 0x2du: return 0x3fu;
    case 0x2eu: return 0x00u;
    case 0x2fu: return 0xfcu;
    case 0x30u: return 0x00u;
    case 0x31u: return 0x00u;
    case 0x32u: return 0x00u;
    case 0x33u: return 0x00u;
    case 0x34u: return 0x80u;
    case 0x40u: return 0x00u;
    case 0x41u: return 0x00u;
    case 0x42u: return 0x00u;
    case 0x43u: return 0x00u;
    case 0x44u: return 0x3eu;  /* palette_dat(10:9) & "00000" & palette_dat(0) */
    case 0x4au: return 0x00u;
    case 0x4bu: return 0x00u;
    case 0x4cu: return 0xf0u;
    case 0x50u: return 0x00u;
    case 0x51u: return 0x00u;
    case 0x52u: return 0x00u;
    case 0x53u: return 0x00u;
    case 0x54u: return 0x00u;
    case 0x55u: return 0x00u;
    case 0x56u: return 0x00u;
    case 0x57u: return 0x00u;
    case 0x61u: return 0x00u;
    case 0x62u: return 0x38u;
    case 0x64u: return 0x00u;
    case 0x68u: return 0x02u;
    case 0x69u: return 0x00u;
    case 0x6au: return 0xc0u;
    case 0x6bu: return 0x00u;
    case 0x6cu: return 0x00u;
    case 0x6eu: return 0x40u;
    case 0x6fu: return 0x40u;
    case 0x70u: return 0xc0u;
    case 0x71u: return 0xfeu;
    case 0x7fu: return 0x00u;
    case 0x80u: return 0x00u;
    case 0x81u: return 0x0fu;
    case 0x82u: return 0x00u;
    case 0x83u: return 0x00u;
    case 0x84u: return 0x00u;
    case 0x85u: return 0x70u;
    case 0x86u: return 0x00u;
    case 0x87u: return 0x00u;
    case 0x88u: return 0x00u;
    case 0x89u: return 0x70u;
    case 0x8au: return 0xc0u;
    case 0x8cu: return 0x00u;
    case 0x8eu: return 0x00u;
    case 0x8fu: return 0xfcu;
    case 0x90u: return 0x03u;
    case 0x91u: return 0x00u;
    case 0x92u: return 0x00u;
    case 0x93u: return 0xf0u;
    case 0x98u: return 0x00u;
    case 0x99u: return 0x00u;
    case 0x9au: return 0x00u;
    case 0x9bu: return 0xf0u;
    case 0xa0u: return 0xc6u;
    case 0xa2u: return 0x20u;
    case 0xa8u: return 0xfeu;
    case 0xa9u: return 0xfau;
    case 0xb0u: return 0x00u;
    case 0xb1u: return 0x00u;
    case 0xb2u: return 0x00u;
    case 0xb8u: return 0x00u;
    case 0xb9u: return 0x00u;
    case 0xbau: return 0x00u;
    case 0xbbu: return 0x00u;
    case 0xc0u: return 0x10u;
    case 0xc2u: return 0x00u;
    case 0xc3u: return 0x00u;
    case 0xc4u: return 0x7cu;
    case 0xc5u: return 0x00u;
    case 0xc6u: return 0x88u;
    case 0xc8u: return 0xfcu;
    case 0xc9u: return 0x00u;
    case 0xcau: return 0x88u;
    case 0xccu: return 0x7cu;
    case 0xcdu: return 0x00u;
    case 0xceu: return 0x88u;
    case 0xd8u: return 0xfeu;
    case 0xd9u: return 0x00u;
    case 0xdau: return 0xfcu;
    case 0xf0u: return 0x00u;
    case 0xf8u: return 0x80u;
    case 0xf9u: return 0x00u;
    case 0xfau: return 0x00u;
    default: return 0xffu;
  }
}

/* Bits the read mux hard-wires to 1: $8E bit 3, $A2 bit 1. */
static uint32_t zxnextNextRegReadOneMask(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x8eu: return 0x08u;
    case 0xa2u: return 0x02u;
    default: return 0x00u;
  }
}

/* What a `$253B` read of `reg` returns, through the read mux - without selecting the register */
static uint32_t zxnextNextRegPeek(uint32_t reg) {
  return ((zxnextNextRegGetDirect(reg) & ~zxnextNextRegReadZeroMask(reg)) | zxnextNextRegReadOneMask(reg)) & 0xffu;
}

static uint32_t zxnextNextRegGetValue(void) {
  return zxnextNextRegPeek(nextRegIndex);
}

static void zxnextNextRegSetDirect(uint32_t reg, uint32_t value);

/*
 * A CPU write - `$253B`, or NEXTREG - recorded as the last write for the IDE (as the TypeScript
 * core's `NextRegDevice.writeRegister` does). Copper writes, reset branches and the app's hotkeys go
 * straight to `zxnextNextRegSetDirect` and are not recorded.
 */
static void zxnextNextRegCpuWrite(uint32_t reg, uint32_t value) {
  zxnextNextRegLastWrite[reg & 0xffu] = (uint8_t)value;
  zxnextNextRegWritten[reg & 0xffu] = 1u;
  zxnextNextRegSetDirect(reg, value);
}

static void zxnextNextRegSetDirect(uint32_t reg, uint32_t value) {
  uint32_t normalized = reg & 0xffu;
  if (zxnextRasterIsVideoNextReg(normalized)) {
    uint32_t writeTact = zxnextNextRegWriteTactOverride != 0xffffffffu ? zxnextNextRegWriteTactOverride : currentFrameTact;
    /* $26 / $27 then show from the next 8-pixel cell: a pending latch (zxnextUlaSetNextReg) */
    zxnextRasterCatchUp(writeTact);
  }
  /* $00, $01, $0E, $0F are read-only: the read mux returns generics, no write branch assigns them */
  if (normalized == 0x00u || normalized == 0x01u || normalized == 0x0eu || normalized == 0x0fu ||
      normalized == 0xdau) return;
  if (zxnextInterruptsHandlesNextRegister(reg)) {
    zxnextInterruptsSetNextRegister(reg, value);
    zxnextNextRegs[reg & 0xffu] = (uint8_t)zxnextInterruptsGetNextRegister(reg);
    return;
  }
  if (normalized == 0x02u) {
    zxnextNmiNextReg02Write(value);
    if ((value & 0x02u) != 0u) zxnextResetRequest = 2u;
    else if ((value & 0x01u) != 0u && zxnextResetRequest == 0u) zxnextResetRequest = 1u;
  }
  /* ~5186-5193: $11 only in config mode; 111 stores 000 (issue 4 board: all three bits) */
  if (normalized == 0x11u) {
    if (!zxnextConfigMode) return;
    zxnextNextRegs[0x11u] = (uint8_t)((value & 0x07u) == 0x07u ? 0u : value & 0x07u);
    return;
  }
  /* ~5667-5683 (Issue 4): $10 stores a core ID only in config mode, bit 4 = 0 and not 1111; bit 7
     (boot the selected core) has nothing to boot */
  if (normalized == 0x10u) {
    if (zxnextConfigMode && (value & 0x10u) == 0u && (value & 0x0fu) != 0x0fu) zxnextNextRegs[0x10u] = (uint8_t)(value & 0x0fu);
    return;
  }
  /* ~5512-5534: GPIO 1-0 cannot be outputs; $93 and $9B hold 4 bits; $A8 / $A9 hold bit 0 */
  if (normalized == 0x90u) value &= 0xfcu;
  if (normalized == 0x93u || normalized == 0x9bu) value &= 0x0fu;
  if (normalized == 0xa8u || normalized == 0xa9u) value &= 0x01u;
  /* ~7390-7410: any $F0 write sets select mode from bit 7; bits 7-6 = 11 also choose the device */
  if (normalized == 0xf0u) {
    zxnextXdevSelect = (value & 0x80u) != 0u;
    if ((value & 0xc0u) == 0xc0u) {
      zxnextXdevDna = (value & 0x03u) == 0x01u;
      zxnextXdevAdc = (value & 0x03u) == 0x02u;
    }
    return;
  }
  /* ~5781: Pentagon timing holds the 50/60 Hz bit at 0 */
  if (normalized == 0x05u && (zxnextMachineTiming & 0x04u) != 0u) value &= ~0x04u;
  if (normalized == 0x03u) {
    uint32_t machineType = value & 0x07u;
    /* timing: only with bit 7, bit 3 clear and the lock off; 000 -> 001, 101-111 -> 011 */
    if ((value & 0x80u) != 0u && !zxnextUserDtLock && (value & 0x08u) == 0u) {
      uint32_t t = (value >> 4u) & 0x07u;
      zxnextMachineTiming = (uint8_t)(t == 0u ? 1u : t > 4u ? 3u : t);
    }
    if ((value & 0x08u) != 0u) zxnextUserDtLock ^= 1u;
    /* machine type: config mode only (the mode before this write) */
    if (zxnextConfigMode && machineType >= 1u && machineType <= 4u) {
      zxnextMachineType = (uint8_t)machineType;
      /* the ROM selection depends on the machine type (zxnext.vhd ~2938) */
      zxnextMemoryUpdateMapping();
    }
    uint8_t wasConfigMode = zxnextConfigMode;
    if (machineType == 0x07u) zxnextConfigMode = 1u;
    else if (machineType != 0u) zxnextConfigMode = 0u;
    /* config mode maps the $04 bank over the ROM slots (zxnext.vhd ~2994) */
    if (wasConfigMode != zxnextConfigMode) zxnextMemoryUpdateMapping();
  }
  /* $0A bits 7-6 (Multiface type) change only in config mode (~5170) */
  if (normalized == 0x0au && !zxnextConfigMode) value = (value & 0x3fu) | (zxnextNextRegs[0x0au] & 0xc0u);
  /* $06 bit 2 (PS/2 mode) changes only in config mode (~5145) */
  if (normalized == 0x06u && !zxnextConfigMode) value = (value & 0xfbu) | (zxnextNextRegs[0x06u] & 0x04u);
  if (normalized == 0x09u) {
    zxnextDivMmcSetNextReg09(value);
  } else if (normalized == 0x06u) {
    zxnextDivMmcSetEnableNmiByDriveButton(value & 0x10u);
    zxnextDivMmcSetEnableMultifaceNmiByM1Button(value & 0x08u);
  } else if (normalized == 0x0au) {
    zxnextDivMmcSetNextReg0A(value);
  } else if (normalized == 0x1cu) {
    if ((value & 0x01u) != 0u) zxnextLayer2ResetClipIndex();
    if ((value & 0x02u) != 0u) zxnextSpritesResetClipIndex();
    if ((value & 0x04u) != 0u) zxnextUlaResetClipIndex();
    if ((value & 0x08u) != 0u) zxnextTilemapResetClipIndex();
  } else if (normalized == 0x83u) {
    zxnextDivMmcSetNextReg83(value);
  } else if (normalized == 0xb8u) {
    zxnextDivMmcSetNextRegB8(value);
  } else if (normalized == 0xb9u) {
    zxnextDivMmcSetNextRegB9(value);
  } else if (normalized == 0xbau) {
    zxnextDivMmcSetNextRegBA(value);
  } else if (normalized == 0xbbu) {
    zxnextDivMmcSetNextRegBB(value);
  }
  if (normalized == 0x07u) {
    cpuProgrammedSpeed = (uint8_t)(value & 0x03u);
    /* ~5762-5766: with the expansion bus on, cpu_speed takes expbus_speed ("00") instead */
    zxnextExpansionRequestSpeedUpdate();
    zxnextNextRegs[0x07u] = (uint8_t)(value & 0xffu);
    return;
  }
  if (normalized == 0x06u) {
    /* ~6325-6335: bits 1-0 = PSG mode (bit 0 = aymode_i; 11 holds every PSG in reset) */
    zxnextPsgSetMode(value & 0x03u);
  } else if (normalized == 0x08u) {
    /* ~3650: writing bit 7 = 1 clears the $7FFD lock */
    if ((value & 0x80u) != 0u) zxnextMemoryUnlockPaging();
    /* ~5155-5157: bit 5 = AY stereo mode (0 ABC, 1 ACB), bit 4 = internal speaker, bit 3 = DAC enable */
    zxnextPsgSetAyStereoMode(value & 0x20u);
    zxnextDacSetEnabled(value & 0x08u);
    /* ~5159: bit 1 = TurboSound (AY#1 and AY#2 selectable through $FFFD) */
    zxnextPsgSetTurbosoundEnabled(value & 0x02u);
  } else if (normalized == 0x09u) {
    zxnextPsgSetChipMonoMode(0u, value & 0x20u);
    zxnextPsgSetChipMonoMode(1u, value & 0x40u);
    zxnextPsgSetChipMonoMode(2u, value & 0x80u);
  }
  if (zxnextDacHandlesNextReg(normalized)) zxnextDacSetNextReg(normalized, value);
  zxnextPaletteSetNextReg(normalized, value);
  if (normalized == 0x6bu) zxnextPaletteSetSecondTilemap(value & 0x10u);
  zxnextUlaSetNextReg(normalized, value);
  zxnextLayer2SetNextReg(normalized, value);
  zxnextTilemapSetNextReg(normalized, value);
  zxnextSpritesSetNextReg(normalized, value);
  zxnextCopperSetNextReg(normalized, value);
  if (zxnextExpansionHandlesNextReg(normalized)) zxnextExpansionSetNextReg(normalized, value);
  zxnextMemorySetNextRegister(reg, value);
  /* $28 / $29 / $2B: the key-joystick map (zxnext.vhd ~6244) */
  if (normalized == 0x28u || normalized == 0x29u || normalized == 0x2bu) zxnextJoystickWriteKeymapRegister(normalized, value);
  /* $C6 bits 1 / 5 (near full only) change the UART RX request level itself (zxnext.vhd ~1898) */
  if (normalized == 0xc6u) zxnextUartOnInterruptEnableChanged();
}

static uint32_t zxnextNextRegGetDirect(uint32_t reg) {
  if (zxnextInterruptsHandlesNextRegister(reg)) return zxnextInterruptsGetNextRegister(reg);
  switch (reg & 0xffu) {
    /* ~6152-6158: the membrane's extra keys */
    case 0xb0u:
      return zxnextKeyboardGetNextRegB0();
    case 0xb1u:
      return zxnextKeyboardGetNextRegB1();
    case 0xb2u:
      return zxnextJoystickGetNextRegB2();
    /* ~5869: '0' & core ID & the DRIVE / M1 buttons (pressed only as pulses: 0) */
    case 0x10u:
      return (zxnextNextRegs[0x10u] & 0x1fu) << 2u;
    /* ~6122-6132: the Pi GPIO pins. Nothing is attached: a driven pin reads its latch, others read 1 */
    case 0x98u:
    case 0x99u:
    case 0x9au:
    case 0x9bu: {
      uint32_t en = zxnextNextRegs[(reg & 0xffu) - 0x08u];
      return (zxnextNextRegs[reg & 0xffu] & en) | (~en & ((reg & 0xffu) == 0x9bu ? 0x0fu : 0xffu));
    }
    /* ~6146: "00000" & GPIO2 & '0' & GPIO0; both pulled up, GPIO0 driven by its latch with $A8 bit 0 */
    case 0xa9u:
      return 0x04u | ((zxnextNextRegs[0xa8u] & 0x01u) != 0u ? (zxnextNextRegs[0xa9u] & 0x01u) : 0x01u);
    /* ~7418-7428: select mode shows the selection; no DNA or XADC is modelled, so device mode reads 0 */
    case 0xf0u:
      return zxnextXdevSelect ? (0x80u | (zxnextXdevAdc ? 0x02u : 0x00u) | (zxnextXdevDna ? 0x01u : 0x00u)) : 0x00u;
    // --- Active video line: the copper line (hardware `cvc`, $64 offset included) the beam is on.
    // --- Computed, not stored. Mirrors NextComposedScreenDevice.activeVideoLine, which is updated
    // --- as each tact renders, i.e. it holds the line of the last tact before currentFrameTact.
    case 0x1eu:
    case 0x1fu: {
      uint32_t tact = currentFrameTact > 0u ? currentFrameTact - 1u : ZXNEXT_RENDERING_TACTS_IN_FRAME - 1u;
      uint32_t line = zxnextCopperLineAt(tact / ZXNEXT_SCREEN_TOTAL_HC, tact % ZXNEXT_SCREEN_TOTAL_HC);
      return (reg & 0xffu) == 0x1eu ? (line >> 8u) & 0x01u : line & 0xffu;
    }
    case 0x06u:
      return (zxnextNextRegs[0x06u] & 0xe7u) |
        (zxnextDivMmcGetEnableNmiByDriveButton() ? 0x10u : 0x00u) |
        (zxnextDivMmcGetEnableMultifaceNmiByM1Button() ? 0x08u : 0x00u);
    case 0x07u:
      return (cpuProgrammedSpeed & 0x03u) | ((cpuEffectiveSpeed & 0x03u) << 4u);
    /* ~5843: the joystick modes and the effective 50/60 Hz and scandoubler bits */
    case 0x05u:
      return (zxnextNextRegs[0x05u] & 0xfau) | (zxnextEffective5060 ? 0x04u : 0x00u) | (zxnextEffectiveScandoubler ? 0x01u : 0x00u);
    /* $02: bus reset (bit 7), I/O trap / Multiface / DivMMC NMI flags (4-2), the last reset type */
    case 0x02u:
      return (zxnextNextRegs[0x02u] & 0x80u) | zxnextNmiNextReg02Flags() | (zxnextLastResetWasHard ? 0x02u : 0x01u);
    /* $03: palette_sub_idx & machine_timing & user_dt_lock & machine_type */
    case 0x03u:
      return (zxnextPaletteGetSecondWrite() ? 0x80u : 0x00u) | ((uint32_t)zxnextMachineTiming << 4u) |
        (zxnextUserDtLock ? 0x08u : 0x00u) | zxnextMachineType;
    /* $28: the first byte of the last $44 pair (nr_stored_palette_value) */
    case 0x28u:
      return zxnextPaletteGetStoredValue();
    /* $34: the sprite the attribute mirrors write (sprites.vhd mirror_num_o) */
    case 0x34u:
      return zxnextSpritesGetMirrorNumber();
    /* $69: port_123b_layer2_en & port_7ffd_shadow & port_ff_reg(5:0) */
    case 0x69u:
      return (zxnextLayer2Enabled ? 0x80u : 0x00u) | (zxnextMemoryShadowScreen() ? 0x40u : 0x00u) | (portTimexValue & 0x3fu);
    /* zxnext.vhd read mux: $08 bit 7 is `not port_7ffd_locked` */
    case 0x08u:
      return (zxnextNextRegs[0x08u] & 0x7fu) | (zxnextMemoryPagingEnabled() ? 0x80u : 0x00u);
    /* $A2: nr_a2(7:6) & '0' & nr_a2(4:2) & '1' & nr_a2(0) */
    case 0xa2u:
      return (zxnextNextRegs[0xa2u] & 0xddu) | 0x02u;
    case 0xb8u: return zxnextDivMmcGetNextRegB8();
    case 0xb9u: return zxnextDivMmcGetNextRegB9();
    case 0xbau: return zxnextDivMmcGetNextRegBA();
    case 0xbbu: return zxnextDivMmcGetNextRegBB();
    case 0x80u:
    case 0x81u:
    case 0x86u:
    case 0x87u:
    case 0x88u:
    case 0x89u:
    case 0x8au:
      return zxnextExpansionGetNextReg(reg);
    case 0x2cu:
    case 0x2du:
    case 0x2eu:
      return zxnextDacGetNextReg(reg);
    case 0x40u:
    case 0x41u:
    case 0x43u:
    case 0x44u:
      return zxnextPaletteGetNextReg(reg);
    case 0x12u:
    case 0x13u:
    case 0x16u:
    case 0x17u:
    case 0x18u:
    case 0x32u:
    case 0x33u:
    case 0x6au:
    case 0x70u:
    case 0x71u:
      return zxnextLayer2GetNextReg(reg);
    case 0x15u:
      return zxnextLayer2GetNextReg(reg) | zxnextSpritesGetNextReg(reg);
    case 0x1au:
    case 0x26u:
    case 0x27u:
    case 0x68u:
      return zxnextUlaGetNextReg(reg);
    case 0x19u:
      return zxnextSpritesGetNextReg(reg);
    case 0x1bu:
    case 0x2fu:
    case 0x30u:
    case 0x31u:
    case 0x4cu:
      return zxnextTilemapGetNextReg(reg);
    /* $6B bit 4 is the second tilemap palette, which the palette module keeps */
    case 0x6bu:
      return zxnextTilemapGetNextReg(reg) | (zxnextPaletteGetSecondTilemap() ? 0x10u : 0u);
    case 0x1cu:
      return (zxnextTilemapGetClipIndex() << 6u) |
        (zxnextUlaGetClipIndex() << 4u) |
        (zxnextSpritesGetClipIndex() << 2u) |
        zxnextLayer2GetClipIndex();
    case 0x6cu:
    case 0x6eu:
    case 0x6fu:
      return zxnextTilemapGetNextReg(reg);
    case 0x4bu:
      return zxnextSpritesGetNextReg(reg);
    case 0x61u:
    case 0x62u:
    case 0x64u:
      return zxnextCopperGetNextReg(reg);
    default: break;
  }
  return zxnextNextRegs[reg & 0xffu];
}
