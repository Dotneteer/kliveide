#include "zxnext-ports.h"
#include "zxnext-nextreg.h"
#include "zxnext-memory.h"
#include "zxnext-ula.h"

static uint8_t zxnextPortsGroupEnabled(uint32_t regIndex, uint32_t bit) {
  uint32_t reg = 0x82u + (regIndex & 0x03u);
  return (zxnextNextRegs[reg] & (1u << (bit & 0x07u))) != 0;
}

static void zxnextPortsReset(void) {
  lastPortAddress = 0;
  lastPortValue = 0;
  lastPortIsWrite = 0;
  nextRegIndex = 0;
  zxnextUlaReset();
}

static uint32_t zxnextPortsRead(uint32_t address) {
  uint16_t normalized = (uint16_t)address;
  lastPortAddress = normalized;
  lastPortIsWrite = 0;

  if ((normalized & 0xffffu) == 0x243bu) {
    lastPortValue = zxnextNextRegGetIndex();
  } else if ((normalized & 0xffffu) == 0x253bu) {
    lastPortValue = zxnextNextRegGetValue();
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
  lastPortIsWrite = 1;

  if ((normalized & 0xffffu) == 0x243bu) {
    zxnextNextRegSetIndex(byteValue);
  } else if ((normalized & 0xffffu) == 0x253bu) {
    zxnextNextRegSetValue(byteValue);
  } else if ((normalized & 0xc003u) == 0x4001u) {
    if (zxnextPortsGroupEnabled(0, 1)) zxnextMemorySetPort7ffd(byteValue);
  } else if ((normalized & 0xf003u) == 0xd001u) {
    if (zxnextPortsGroupEnabled(0, 2)) zxnextMemorySetPortDffd(byteValue);
  } else if ((normalized & 0xf003u) == 0x1001u) {
    if (zxnextPortsGroupEnabled(0, 3)) zxnextMemorySetPort1ffd(byteValue);
  } else if ((normalized & 0x00ffu) == 0x00ffu) {
    if (zxnextPortsGroupEnabled(0, 0)) portTimexValue = byteValue;
  } else if ((normalized & 0x0001u) == 0) {
    zxnextUlaWritePortFe(byteValue);
  }
}
