#include "zxnext-ports.h"
#include "zxnext-nextreg.h"
#include "zxnext-memory.h"
#include "zxnext-ula.h"
#include "zxnext-divmmc.h"
#include "zxnext-sd.h"
#include "zxnext-dac.h"
#include "zxnext-psg.h"
#include "zxnext-beeper.h"
#include "zxnext-uart.h"
#include "zxnext-i2c.h"
#include "zxnext-input.h"
#include "zxnext-dma.h"
#include "zxnext-ctc.h"

static inline uint8_t zxnextPortsGroupEnabled(uint32_t regIndex, uint32_t bit) {
  uint32_t reg = 0x82u + (regIndex & 0x03u);
  return (zxnextNextRegs[reg] & (1u << (bit & 0x07u))) != 0;
}

static void zxnextPortsReset(void) {
  lastPortAddress = 0;
  lastPortValue = 0;
  lastPortAccessed = 0;
  lastPortIsWrite = 0;
  nextRegIndex = 0x24; /* zxnext.vhd ~4575: a reset selects register $24 */
  zxnextUlaReset();
}

static uint32_t zxnextPortsRead(uint32_t address) {
  uint16_t normalized = (uint16_t)address;
  lastPortAddress = normalized;
  lastPortAccessed = 1;
  lastPortIsWrite = 0;

  /* +3 FDC I/O trap (NextReg $D8 bit 0): $2FFD / $3FFD reads raise a Multiface NMI */
  if ((zxnextNextRegs[0xd8u] & 0x01u) != 0u &&
      ((normalized & 0xf003u) == 0x2001u || (normalized & 0xf003u) == 0x3001u)) {
    zxnextNmiIoTrap((normalized & 0xf003u) == 0x2001u ? 1u : 2u, 0u, 0u);
    return lastPortValue = 0xffu;
  }
  /* Multiface enable/disable ports ($1F, $3F, $9F, $BF): the MF answers or lets other devices do so */
  {
    uint32_t low = normalized & 0x00ffu;
    if (low == 0x1fu || low == 0x3fu || low == 0x9fu || low == 0xbfu) {
      uint32_t handled = 0u;
      uint32_t mfValue = zxnextMultifaceReadPort(normalized, &handled);
      if (handled) return lastPortValue = (uint8_t)mfValue;
    }
  }

  if ((normalized & 0xffffu) == 0x243bu) {
    lastPortValue = zxnextNextRegGetIndex();
  } else if ((normalized & 0xffffu) == 0x253bu) {
    lastPortValue = zxnextNextRegGetValue();
  } else if ((normalized & 0xffffu) == 0x133bu ||
             (normalized & 0xffffu) == 0x143bu ||
             (normalized & 0xffffu) == 0x153bu ||
             (normalized & 0xffffu) == 0x163bu) {
    lastPortValue = zxnextPortsGroupEnabled(1, 4) ? zxnextUartReadPort(normalized) : 0xffu;
  } else if ((normalized & 0xffffu) == 0x103bu) {
    lastPortValue = zxnextPortsGroupEnabled(1, 2) ? zxnextI2cReadSclPort() : 0xffu;
  } else if ((normalized & 0xffffu) == 0x113bu) {
    lastPortValue = zxnextPortsGroupEnabled(1, 2) ? zxnextI2cReadSdaPort() : 0xffu;
  } else if ((normalized & 0xffffu) == 0x123bu) {
    lastPortValue = zxnextPortsGroupEnabled(1, 7) ? zxnextLayer2GetPort123B() : 0xffu;
  } else if ((normalized & 0xffffu) == 0x303bu) {
    lastPortValue = zxnextPortsGroupEnabled(1, 6) ? zxnextSpritesReadPort303b() : 0xffu;
  } else if ((normalized & 0xffffu) == 0xff3bu) {
    lastPortValue = zxnextPortsGroupEnabled(3, 0) ? zxnextUlaPlusReadDataPort() : 0xffu;
  } else if ((normalized & 0xf8ffu) == 0x183bu) {
    lastPortValue = zxnextCtcReadPort(normalized);
  } else if ((normalized & 0x00ffu) == 0x006bu && zxnextPortsGroupEnabled(0, 5)) {
    zxnextDmaSetMode(0);
    lastPortValue = zxnextDmaReadStatusByte();
  } else if ((normalized & 0x00ffu) == 0x000bu && zxnextPortsGroupEnabled(3, 1)) {
    zxnextDmaSetMode(1);
    lastPortValue = zxnextDmaReadStatusByte();
  } else if ((normalized & 0x00ffu) == 0x00dfu && (normalized & 0x0f00u) >= 0x0a00u && (normalized & 0x0f00u) != 0x0c00u &&
             (normalized & 0x0f00u) != 0x0d00u && (normalized & 0x0f00u) != 0x0e00u) {
    /* ~2615-2617: $xADF / $xBDF / $xFDF (A11-8), with the mouse port enable */
    lastPortValue = zxnextPortsGroupEnabled(1, 5) ? zxnextInputReadPort(0xf0dfu | (normalized & 0x0f00u)) : 0xffu;
  } else if ((normalized & 0x00ffu) == 0x001fu ||
             ((normalized & 0x00ffu) == 0x00dfu && zxnextPortsGroupEnabled(2, 7) && !zxnextPortsGroupEnabled(1, 5))) {
    /* ~2622: $1F, or $DF with the Specdrum port on and the mouse off */
    lastPortValue = zxnextPortsGroupEnabled(0, 6) ? zxnextInputReadPort(0x001fu) : 0xffu;
  } else if ((normalized & 0x00ffu) == 0x0037u) {
    lastPortValue = zxnextPortsGroupEnabled(0, 7) ? zxnextInputReadPort(0x0037u) : 0xffu;
  } else if ((normalized & 0x00ffu) == 0x00e3u) {
    lastPortValue = zxnextPortsGroupEnabled(1, 0) ? zxnextDivMmcGetPortE3() : 0xffu;
  } else if ((normalized & 0x00ffu) == 0x00ebu) {
    lastPortValue = zxnextPortsGroupEnabled(1, 3) ? zxnextSdReadMmcData() : 0xffu;
  } else if ((normalized & 0xc00fu) == 0x8005u) {
    /* $BFF5 (A3 = 0): ym2149.vhd ~221 AY_ID & '0' & the 5-bit register number */
    if (zxnextPortsGroupEnabled(2, 0)) {
      uint32_t chip = zxnextPsgGetSelectedChip();
      uint32_t ayId = chip == 0u ? 3u : (chip == 1u ? 2u : 1u);
      lastPortValue = (uint8_t)((ayId << 6u) | (zxnextPsgGetSelectedRegister() & 0x1fu));
    } else {
      lastPortValue = 0xffu;
    }
  } else if ((normalized & 0xc007u) == 0xc005u) {
    lastPortValue = zxnextPortsGroupEnabled(2, 0) ? zxnextPsgReadRegisterValue() : 0xffu;
  } else if ((normalized & 0xc007u) == 0x8005u) {
    /* ~2747: $BFFD reads like $FFFD in +3 timing only */
    lastPortValue = zxnextPortsGroupEnabled(2, 0) && zxnextNextRegGetMachineTiming() == 3u ? zxnextPsgReadRegisterValue() : 0xffu;
  } else if ((normalized & 0xf003u) == 0x0001u && zxnextNextRegGetMachineTiming() == 3u && zxnextPortsGroupEnabled(0, 4)) {
    /* ~2545, 4497: the +3 floating bus; $FF while $7FFD is locked */
    lastPortValue = zxnextMemoryPagingEnabled() ? zxnextUlaFloatingBus(currentFrameTact) : 0xffu;
  } else if ((normalized & 0x00ffu) == 0x00ffu) {
    /* ~2769: the Timex register with $08 bit 2 and the port enabled; else the ULA floating bus in 48K
       and 128K timing (~4493), $FF otherwise */
    if (zxnextPortsGroupEnabled(0, 0) && (zxnextNextRegs[0x08u] & 0x04u) != 0u) {
      lastPortValue = portTimexValue;
    } else {
      uint32_t t = zxnextNextRegGetMachineTiming();
      lastPortValue = (t == 1u || t == 2u) ? zxnextUlaFloatingBus(currentFrameTact) : 0xffu;
    }
  } else if ((normalized & 0x0001u) == 0) {
    lastPortValue = zxnextUlaReadPortFe(normalized);
  } else {
    lastPortValue = 0xff;
  }
  return lastPortValue;
}

static void zxnextPortsWrite(uint32_t address, uint32_t value) {
  uint16_t normalized = (uint16_t)address;
  uint8_t byteValue = (uint8_t)value;
  lastPortAddress = normalized;
  lastPortValue = byteValue;
  lastPortAccessed = 1;
  lastPortIsWrite = 1;
  if ((zxnextNextRegs[0xd8u] & 0x01u) != 0u && (normalized & 0xf003u) == 0x3001u) {
    zxnextNmiIoTrap(3u, byteValue, 1u);
    return;
  }
  zxnextMultifaceWritePort(normalized, byteValue);
  zxnextDacWritePort(normalized, byteValue);

  // --- Ports that change the picture: render what the beam has drawn so far with the old state.
  // --- Even ports are the ULA's $FE; only a border colour change matters (beeper writes are frequent).
  // --- The new colour itself shows from the next 8-pixel border latch (zxnextUlaWritePortFe).
  if (((normalized & 0x0001u) == 0u && (byteValue & 0x07u) != borderColor) ||
      (normalized & 0x00ffu) == 0x00ffu ||
      (normalized & 0xffffu) == 0x123bu || (normalized & 0xffffu) == 0x303bu || (normalized & 0xffffu) == 0xff3bu ||
      (normalized & 0x00ffu) == 0x0057u || (normalized & 0x00ffu) == 0x005bu ||
      (normalized & 0xc003u) == 0x4001u || (normalized & 0xf003u) == 0xd001u || (normalized & 0xf003u) == 0x1001u) {
    zxnextRasterCatchUp(currentFrameTact);
  }

  if ((normalized & 0xffffu) == 0x243bu) {
    zxnextNextRegSetIndex(byteValue);
  } else if ((normalized & 0xffffu) == 0x253bu) {
    zxnextNextRegSetValue(byteValue);
  } else if ((normalized & 0xffffu) == 0x133bu ||
             (normalized & 0xffffu) == 0x143bu ||
             (normalized & 0xffffu) == 0x153bu ||
             (normalized & 0xffffu) == 0x163bu) {
    if (zxnextPortsGroupEnabled(1, 4)) zxnextUartWritePort(normalized, byteValue);
  } else if ((normalized & 0xffffu) == 0x103bu) {
    if (zxnextPortsGroupEnabled(1, 2)) zxnextI2cWriteSclPort(byteValue);
  } else if ((normalized & 0xffffu) == 0x113bu) {
    if (zxnextPortsGroupEnabled(1, 2)) zxnextI2cWriteSdaPort(byteValue);
  } else if ((normalized & 0xffffu) == 0x123bu) {
    if (zxnextPortsGroupEnabled(1, 7)) zxnextLayer2SetPort123B(byteValue);
  } else if ((normalized & 0xffffu) == 0x303bu) {
    if (zxnextPortsGroupEnabled(1, 6)) zxnextSpritesWritePort303b(byteValue);
  } else if ((normalized & 0xffffu) == 0xbf3bu) {
    if (zxnextPortsGroupEnabled(3, 0)) zxnextUlaPlusWriteRegisterPort(byteValue);
  } else if ((normalized & 0xffffu) == 0xff3bu) {
    if (zxnextPortsGroupEnabled(3, 0)) zxnextUlaPlusWriteDataPort(byteValue);
  } else if ((normalized & 0x00ffu) == 0x0057u) {
    if (zxnextPortsGroupEnabled(1, 6)) zxnextSpritesWritePort57(byteValue);
  } else if ((normalized & 0x00ffu) == 0x005bu) {
    if (zxnextPortsGroupEnabled(1, 6)) zxnextSpritesWritePort5b(byteValue);
  } else if ((normalized & 0xf8ffu) == 0x183bu) {
    zxnextCtcWritePort(normalized, byteValue);
  } else if ((normalized & 0x00ffu) == 0x006bu) {
    if (zxnextPortsGroupEnabled(0, 5)) {
      zxnextDmaSetMode(0);
      zxnextDmaWritePort(byteValue);
    }
  } else if ((normalized & 0x00ffu) == 0x000bu) {
    if (zxnextPortsGroupEnabled(3, 1)) {
      zxnextDmaSetMode(1);
      zxnextDmaWritePort(byteValue);
    }
  } else if ((normalized & 0x8003u) == 0x0001u && (normalized & 0xf000u) != 0x1000u &&
             ((normalized & 0x4000u) != 0u || zxnextNextRegGetMachineTiming() != 3u)) {
    /* ~2549: A15 = 0, A1-0 = 01, not $1FFD; A14 = 1 is decoded only in +3 timing */
    if (zxnextPortsGroupEnabled(0, 1)) zxnextMemorySetPort7ffd(byteValue);
  } else if ((normalized & 0xf003u) == 0xd001u) {
    if (zxnextPortsGroupEnabled(0, 2)) zxnextMemorySetPortDffd(byteValue);
  } else if ((normalized & 0xf003u) == 0x1001u) {
    if (zxnextPortsGroupEnabled(0, 3)) zxnextMemorySetPort1ffd(byteValue);
  } else if ((normalized & 0xf0ffu) == 0xe0f7u) {
    /* $EFF7 (zxnext.vhd ~2560): A15-12 = 1110, low byte $F7; internal port enable bit 26 = $85 bit 2 */
    if (zxnextPortsGroupEnabled(3, 2)) zxnextMemorySetPortEff7(byteValue);
  } else if ((normalized & 0x00ffu) == 0x00e3u) {
    if (zxnextPortsGroupEnabled(1, 0)) zxnextDivMmcSetPortE3(byteValue);
  } else if ((normalized & 0x00ffu) == 0x00e7u) {
    if (zxnextPortsGroupEnabled(1, 3)) zxnextSdSpiCsWrite(byteValue);
  } else if ((normalized & 0x00ffu) == 0x00ebu) {
    if (zxnextPortsGroupEnabled(1, 3)) zxnextSdWriteMmcData(byteValue);
  } else if ((normalized & 0x00ffu) == 0x00ffu) {
    if (zxnextPortsGroupEnabled(0, 0)) portTimexValue = byteValue;
  } else if ((normalized & 0x0001u) == 0) {
    zxnextUlaWritePortFe(byteValue);
    zxnextBeeperSetOutput((byteValue & 0x10u) != 0u, (byteValue & 0x08u) != 0u);
  } else if ((normalized & 0xc002u) == 0xc000u) {
    if (zxnextPortsGroupEnabled(2, 0)) zxnextPsgSetRegisterIndex(byteValue);
  } else if ((normalized & 0xc002u) == 0x8000u) {
    if (zxnextPortsGroupEnabled(2, 0)) zxnextPsgWriteRegisterValue(byteValue);
  }
}
