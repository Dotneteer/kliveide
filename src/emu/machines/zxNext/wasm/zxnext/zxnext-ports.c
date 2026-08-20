#include "zxnext-ports.h"
#include "zxnext-nextreg.h"
#include "zxnext-memory.h"

static uint8_t zxnextPortsGroupEnabled(uint32_t regIndex, uint32_t bit) {
  uint32_t reg = 0x82u + (regIndex & 0x03u);
  return (zxnextNextRegs[reg] & (1u << (bit & 0x07u))) != 0;
}

static void zxnextPortsReset(void) {
  lastPortAddress = 0;
  lastPortValue = 0;
  lastPortIsWrite = 0;
  nextRegIndex = 0;
  portFeValue = 0xff;
  portTimexValue = 0;
  borderColor = 0;
  earBit = 0;
  micBit = 0;
}

static uint8_t zxnextPortsReadFe(uint16_t address) {
  uint8_t portValue = 0xff;
  uint8_t selector = (uint8_t)(address >> 8);
  for (uint32_t line = 0; line < ZXNEXT_KEYBOARD_LINE_COUNT; line++) {
    if ((selector & (1u << line)) == 0) {
      portValue &= (uint8_t)~zxnextKeyboardLines[line];
    }
  }
  if (earBit || (micBit && (zxnextNextRegs[0x08] & 0x01u) != 0)) {
    portValue |= 0x40u;
  } else {
    portValue &= (uint8_t)~0x40u;
  }
  return portValue;
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
    lastPortValue = zxnextPortsReadFe(normalized);
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
    portFeValue = byteValue;
    borderColor = byteValue & 0x07u;
    micBit = (byteValue & 0x08u) != 0;
    earBit = (byteValue & 0x10u) != 0;
  }
}
