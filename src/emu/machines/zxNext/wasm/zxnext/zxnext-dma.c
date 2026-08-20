#include "zxnext-dma.h"

static uint8_t zxnextDmaMode;
static uint8_t zxnextDmaStatus;
static uint8_t zxnextDmaReadMask;
static uint8_t zxnextDmaReadSeq;
static uint8_t zxnextDmaFollowRegs[8];
static uint8_t zxnextDmaNumFollow;
static uint8_t zxnextDmaCurFollow;
static uint16_t zxnextDmaPortAStartAddress;
static uint16_t zxnextDmaPortBStartAddress;
static uint16_t zxnextDmaBlockLength;
static uint16_t zxnextDmaByteCounter;
static uint8_t zxnextDmaEnabled;
static uint8_t zxnextDmaDirectionAtoB;

void zxnextDmaReset(void) {
  zxnextDmaMode = 0;
  zxnextDmaStatus = 0;
  zxnextDmaReadMask = 0;
  zxnextDmaReadSeq = 0;
  zxnextDmaNumFollow = 0;
  zxnextDmaCurFollow = 0;
  zxnextDmaPortAStartAddress = 0;
  zxnextDmaPortBStartAddress = 0;
  zxnextDmaBlockLength = 0;
  zxnextDmaByteCounter = 0;
  zxnextDmaEnabled = 0;
  zxnextDmaDirectionAtoB = 0;
}

void zxnextDmaSetMode(uint32_t mode) { zxnextDmaMode = mode & 1u; }

static void zxnextDmaSetupFollow(uint32_t group, uint8_t base) {
  zxnextDmaNumFollow = 0;
  zxnextDmaCurFollow = 0;
  if (group == 0) {
    if (base & 0x08u) zxnextDmaFollowRegs[zxnextDmaNumFollow++] = 1;
    if (base & 0x10u) zxnextDmaFollowRegs[zxnextDmaNumFollow++] = 2;
    if (base & 0x20u) zxnextDmaFollowRegs[zxnextDmaNumFollow++] = 3;
    if (base & 0x40u) zxnextDmaFollowRegs[zxnextDmaNumFollow++] = 4;
  } else if (group == 4) {
    if (base & 0x04u) zxnextDmaFollowRegs[zxnextDmaNumFollow++] = 5;
    if (base & 0x08u) zxnextDmaFollowRegs[zxnextDmaNumFollow++] = 6;
  } else if (group == 6 && base == 0xbbu) {
    zxnextDmaFollowRegs[zxnextDmaNumFollow++] = 7;
  }
}

static void zxnextDmaHandleFollow(uint8_t reg, uint8_t value) {
  switch (reg) {
    case 1: zxnextDmaPortAStartAddress = (zxnextDmaPortAStartAddress & 0xff00u) | value; break;
    case 2: zxnextDmaPortAStartAddress = (zxnextDmaPortAStartAddress & 0x00ffu) | ((uint16_t)value << 8); break;
    case 3: zxnextDmaBlockLength = (zxnextDmaBlockLength & 0xff00u) | value; break;
    case 4: zxnextDmaBlockLength = (zxnextDmaBlockLength & 0x00ffu) | ((uint16_t)value << 8); break;
    case 5: zxnextDmaPortBStartAddress = (zxnextDmaPortBStartAddress & 0xff00u) | value; break;
    case 6: zxnextDmaPortBStartAddress = (zxnextDmaPortBStartAddress & 0x00ffu) | ((uint16_t)value << 8); break;
    case 7: zxnextDmaReadMask = value & 0x7fu; break;
  }
}

static void zxnextDmaSetupNextRead(uint8_t start) {
  if (zxnextDmaReadMask == 0) return;
  uint8_t rr = start & 7u;
  while ((zxnextDmaReadMask & (1u << rr)) == 0) rr = (rr + 1) & 7u;
  zxnextDmaReadSeq = rr;
}

void zxnextDmaWritePort(uint32_t value) {
  uint8_t byteValue = value & 0xffu;
  if (zxnextDmaNumFollow != 0) {
    uint8_t reg = zxnextDmaFollowRegs[zxnextDmaCurFollow++];
    if (zxnextDmaCurFollow >= zxnextDmaNumFollow) {
      zxnextDmaCurFollow = 0;
      zxnextDmaNumFollow = 0;
    }
    zxnextDmaHandleFollow(reg, byteValue);
    return;
  }

  uint32_t group;
  if ((byteValue & 0x87u) == 0x00u) group = 2;
  else if ((byteValue & 0x87u) == 0x04u) group = 1;
  else if ((byteValue & 0x80u) == 0x00u) {
    group = 0;
    zxnextDmaDirectionAtoB = (byteValue & 0x04u) != 0;
  } else if ((byteValue & 0x83u) == 0x80u) {
    group = 3;
    zxnextDmaEnabled = (byteValue & 0x01u) != 0;
  } else if ((byteValue & 0x83u) == 0x81u) group = 4;
  else if ((byteValue & 0xc7u) == 0x82u) group = 5;
  else group = 6;

  if (group == 6) {
    switch (byteValue) {
      case 0xc3u:
        zxnextDmaEnabled = 0;
        zxnextDmaStatus = 0x38u;
        zxnextDmaReadSeq = 0;
        zxnextDmaReadMask = 0;
        break;
      case 0xcfu:
        zxnextDmaByteCounter = zxnextDmaMode == 0 ? 0 : 0xffffu;
        zxnextDmaStatus |= 0x30u;
        break;
      case 0xd3u:
        zxnextDmaByteCounter = 0;
        zxnextDmaStatus |= 0x30u;
        break;
      case 0x87u:
        zxnextDmaByteCounter = zxnextDmaMode == 0 ? 0 : 0xffffu;
        zxnextDmaEnabled = 1;
        break;
      case 0x83u:
        zxnextDmaEnabled = 0;
        break;
      case 0xbfu:
        zxnextDmaReadMask = 1;
        zxnextDmaReadSeq = 0;
        break;
      case 0xa7u:
        zxnextDmaSetupNextRead(0);
        break;
      case 0x8bu:
        zxnextDmaStatus |= 0x30u;
        break;
    }
  }
  zxnextDmaSetupFollow(group, byteValue);
}

uint32_t zxnextDmaReadStatusByte(void) {
  uint8_t pos = zxnextDmaReadSeq;
  uint32_t value;
  switch (pos) {
    case 0: value = zxnextDmaStatus; break;
    case 1: value = zxnextDmaByteCounter & 0xffu; break;
    case 2: value = (zxnextDmaByteCounter >> 8) & 0xffu; break;
    case 3: value = zxnextDmaPortAStartAddress & 0xffu; break;
    case 4: value = (zxnextDmaPortAStartAddress >> 8) & 0xffu; break;
    case 5: value = zxnextDmaPortBStartAddress & 0xffu; break;
    default: value = (zxnextDmaPortBStartAddress >> 8) & 0xffu; break;
  }
  if ((zxnextDmaReadMask & (zxnextDmaReadMask - 1u)) != 0) zxnextDmaSetupNextRead((pos + 1) & 7u);
  return value;
}

uint32_t zxnextGetDmaMode(void) { return zxnextDmaMode; }
uint32_t zxnextGetDmaStatus(void) { return zxnextDmaStatus; }
uint32_t zxnextGetDmaReadMask(void) { return zxnextDmaReadMask; }
uint32_t zxnextGetDmaPortAStartAddress(void) { return zxnextDmaPortAStartAddress; }
uint32_t zxnextGetDmaPortBStartAddress(void) { return zxnextDmaPortBStartAddress; }
uint32_t zxnextGetDmaBlockLength(void) { return zxnextDmaBlockLength; }
uint32_t zxnextGetDmaEnabled(void) { return zxnextDmaEnabled; }
uint32_t zxnextGetDmaByteCounter(void) { return zxnextDmaByteCounter; }
