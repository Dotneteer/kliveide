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
  nextRegIndex = 0;
  zxnextUlaReset();
}

static uint32_t zxnextPortsRead(uint32_t address) {
  uint16_t normalized = (uint16_t)address;
  lastPortAddress = normalized;
  lastPortAccessed = 1;
  lastPortIsWrite = 0;

  if ((normalized & 0xffffu) == 0x243bu) {
    lastPortValue = zxnextNextRegGetIndex();
  } else if ((normalized & 0xffffu) == 0x253bu) {
    lastPortValue = zxnextNextRegGetValue();
  } else if ((normalized & 0xffffu) == 0x133bu ||
             (normalized & 0xffffu) == 0x143bu ||
             (normalized & 0xffffu) == 0x153bu ||
             (normalized & 0xffffu) == 0x163bu) {
    lastPortValue = zxnextUartReadPort(normalized);
  } else if ((normalized & 0xffffu) == 0x103bu) {
    lastPortValue = zxnextI2cReadSclPort();
  } else if ((normalized & 0xffffu) == 0x113bu) {
    lastPortValue = zxnextI2cReadSdaPort();
  } else if ((normalized & 0xffffu) == 0x123bu) {
    lastPortValue = zxnextPortsGroupEnabled(1, 7) ? zxnextLayer2GetPort123B() : 0xffu;
  } else if ((normalized & 0xffffu) == 0x303bu) {
    lastPortValue = zxnextPortsGroupEnabled(1, 6) ? zxnextSpritesReadPort303b() : 0xffu;
  } else if ((normalized & 0xf8ffu) == 0x183bu) {
    lastPortValue = zxnextCtcReadPort(normalized);
  } else if ((normalized & 0x00ffu) == 0x006bu) {
    zxnextDmaSetMode(0);
    lastPortValue = zxnextDmaReadStatusByte();
  } else if ((normalized & 0x00ffu) == 0x000bu) {
    zxnextDmaSetMode(1);
    lastPortValue = zxnextDmaReadStatusByte();
  } else if ((normalized & 0xffffu) == 0xfbdfu ||
             (normalized & 0xffffu) == 0xffdfu ||
             (normalized & 0xffffu) == 0xfadfu ||
             (normalized & 0x00ffu) == 0x001fu ||
             (normalized & 0x00ffu) == 0x0037u) {
    lastPortValue = zxnextInputReadPort(normalized);
  } else if ((normalized & 0x00ffu) == 0x00e3u) {
    lastPortValue = zxnextPortsGroupEnabled(1, 0) ? zxnextDivMmcGetPortE3() : 0xffu;
  } else if ((normalized & 0x00ffu) == 0x00ebu) {
    lastPortValue = zxnextPortsGroupEnabled(1, 3) ? zxnextSdReadMmcData() : 0xffu;
  } else if ((normalized & 0xc00fu) == 0x8005u) {
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
    lastPortValue = zxnextPortsGroupEnabled(2, 0) ? zxnextPsgReadRegisterValue() : 0xffu;
  } else if ((normalized & 0x00ffu) == 0x00ffu) {
    lastPortValue = zxnextPortsGroupEnabled(0, 0) ? portTimexValue : 0xffu;
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
  zxnextDacWritePort(normalized, byteValue);

  if ((normalized & 0xffffu) == 0x243bu) {
    zxnextNextRegSetIndex(byteValue);
  } else if ((normalized & 0xffffu) == 0x253bu) {
    zxnextNextRegSetValue(byteValue);
  } else if ((normalized & 0xffffu) == 0x133bu ||
             (normalized & 0xffffu) == 0x143bu ||
             (normalized & 0xffffu) == 0x153bu ||
             (normalized & 0xffffu) == 0x163bu) {
    zxnextUartWritePort(normalized, byteValue);
  } else if ((normalized & 0xffffu) == 0x103bu) {
    zxnextI2cWriteSclPort(byteValue);
  } else if ((normalized & 0xffffu) == 0x113bu) {
    zxnextI2cWriteSdaPort(byteValue);
  } else if ((normalized & 0xffffu) == 0x123bu) {
    if (zxnextPortsGroupEnabled(1, 7)) zxnextLayer2SetPort123B(byteValue);
  } else if ((normalized & 0xffffu) == 0x303bu) {
    if (zxnextPortsGroupEnabled(1, 6)) zxnextSpritesWritePort303b(byteValue);
  } else if ((normalized & 0x00ffu) == 0x0057u) {
    if (zxnextPortsGroupEnabled(1, 6)) zxnextSpritesWritePort57(byteValue);
  } else if ((normalized & 0x00ffu) == 0x005bu) {
    if (zxnextPortsGroupEnabled(1, 6)) zxnextSpritesWritePort5b(byteValue);
  } else if ((normalized & 0xf8ffu) == 0x183bu) {
    zxnextCtcWritePort(normalized, byteValue);
  } else if ((normalized & 0x00ffu) == 0x006bu) {
    zxnextDmaSetMode(0);
    zxnextDmaWritePort(byteValue);
  } else if ((normalized & 0x00ffu) == 0x000bu) {
    zxnextDmaSetMode(1);
    zxnextDmaWritePort(byteValue);
  } else if ((normalized & 0xc003u) == 0x4001u) {
    if (zxnextPortsGroupEnabled(0, 1)) zxnextMemorySetPort7ffd(byteValue);
  } else if ((normalized & 0xf003u) == 0xd001u) {
    if (zxnextPortsGroupEnabled(0, 2)) zxnextMemorySetPortDffd(byteValue);
  } else if ((normalized & 0xf003u) == 0x1001u) {
    if (zxnextPortsGroupEnabled(0, 3)) zxnextMemorySetPort1ffd(byteValue);
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
