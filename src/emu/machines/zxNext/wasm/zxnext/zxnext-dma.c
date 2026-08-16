#include "zxnext.h"

#define DMA_REG_COUNT 50u
#define DMA_RNUM_WR0 0u
#define DMA_RNUM_PORT_A_ADDR_L 1u
#define DMA_RNUM_PORT_A_ADDR_H 2u
#define DMA_RNUM_BLOCKLEN_L 3u
#define DMA_RNUM_BLOCKLEN_H 4u
#define DMA_RNUM_WR1 8u
#define DMA_RNUM_PORT_A_TIMING 9u
#define DMA_RNUM_WR2 16u
#define DMA_RNUM_PORT_B_TIMING 17u
#define DMA_RNUM_ZXN_PRESCALER 18u
#define DMA_RNUM_WR3 24u
#define DMA_RNUM_MASK_BYTE 25u
#define DMA_RNUM_MATCH_BYTE 26u
#define DMA_RNUM_WR4 32u
#define DMA_RNUM_PORT_B_ADDR_L 33u
#define DMA_RNUM_PORT_B_ADDR_H 34u
#define DMA_RNUM_INTERRUPT_CTRL 35u
#define DMA_RNUM_INTERRUPT_VECTOR 36u
#define DMA_RNUM_PULSE_CTRL 37u
#define DMA_RNUM_WR5 40u
#define DMA_RNUM_WR6 48u
#define DMA_RNUM_READ_MASK 49u

#define DMA_MODE_ZXN 0u
#define DMA_MODE_LEGACY 1u
#define DMA_SEQ_IDLE 0u
#define DMA_SEQ_WAIT_READY 1u
#define DMA_SEQ_WAITING_ACK 3u
#define DMA_SEQ_TRANSFER 4u
#define DMA_BUS_IDLE 0u
#define DMA_BUS_REQUESTED 1u
#define DMA_BUS_AVAILABLE 2u

static void resetDmaDecodedState(void) {
  dmaDirectionAtoB = 1u;
  dmaPortAIsIo = 0u;
  dmaPortBIsIo = 0u;
  dmaPortAAddressMode = 1u;
  dmaPortBAddressMode = 1u;
  dmaPortATiming = 0u;
  dmaPortBTiming = 0u;
  dmaPortBPrescaler = 0u;
  dmaTransferMode = 1u;
  dmaAutoRestart = 0u;
  dmaEnabled = 0u;
  dmaPortAStart = 0u;
  dmaPortBStart = 0u;
  dmaBlockLength = 0u;
  dmaAddressA = 0u;
  dmaAddressB = 0u;
  dmaCount = 0u;
  dmaByteCounter = 0u;
  dmaTransferData = 0u;
}

static void resetDmaState(void) {
  for (uint32_t i = 0; i < DMA_REG_COUNT; i++) dmaRegs[i] = 0u;
  for (uint32_t i = 0; i < 5u; i++) dmaFollow[i] = 0u;
  dmaNumFollow = 0u;
  dmaCurFollow = 0u;
  dmaReadSeq = 0u;
  dmaStatus = 0u;
  dmaMode = DMA_MODE_ZXN;
  dmaSeq = DMA_SEQ_IDLE;
  dmaBusState = DMA_BUS_IDLE;
  dmaForceReady = 0u;
  dmaInterruptPending = 0u;
  dmaInterruptUnderService = 0u;
  dmaVector = 0u;
  dmaResetPointer = 0u;
  dmaTransferCount = 0u;
  dmaBlockCompletionCount = 0u;
  dmaLastStepTicks = 0u;
  resetDmaDecodedState();
}

static uint32_t dmaReadRawReg(uint32_t group, uint32_t slot) {
  const uint32_t index = (group << 3u) + slot;
  return index < DMA_REG_COUNT ? dmaRegs[index] : 0xffu;
}

static uint32_t dmaAddressDelta(uint8_t mode) {
  return mode == 0u ? 0xffffu : mode == 1u ? 1u : 0u;
}

static uint32_t dmaGetTransferLength(void) {
  return dmaMode == DMA_MODE_LEGACY ? ((uint32_t)dmaBlockLength + 1u) : dmaBlockLength;
}

static void dmaSetupNextRead(uint32_t rr) {
  const uint8_t mask = dmaRegs[DMA_RNUM_READ_MASK];
  if (mask == 0u) return;
  while ((mask & (1u << (rr & 0x07u))) == 0u) rr = (rr + 1u) & 0x07u;
  dmaReadSeq = (uint8_t)(rr & 0x07u);
}

static void dmaSetFollow(uint32_t regGroup, uint32_t baseValue) {
  dmaNumFollow = 0u;
  dmaCurFollow = 0u;
  switch (regGroup) {
    case 0:
      if ((baseValue & 0x08u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_A_ADDR_L;
      if ((baseValue & 0x10u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_A_ADDR_H;
      if ((baseValue & 0x20u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_BLOCKLEN_L;
      if ((baseValue & 0x40u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_BLOCKLEN_H;
      break;
    case 1:
      if ((baseValue & 0x40u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_A_TIMING;
      break;
    case 2:
      if ((baseValue & 0x40u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_B_TIMING;
      break;
    case 3:
      if ((baseValue & 0x08u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_MASK_BYTE;
      if ((baseValue & 0x10u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_MATCH_BYTE;
      if ((baseValue & 0x40u) != 0u) dmaSeq = DMA_SEQ_WAIT_READY;
      break;
    case 4:
      if ((baseValue & 0x04u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_B_ADDR_L;
      if ((baseValue & 0x08u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_B_ADDR_H;
      if ((baseValue & 0x10u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_INTERRUPT_CTRL;
      break;
    case 6:
      if ((baseValue & 0xffu) == 0xbbu) dmaFollow[dmaNumFollow++] = DMA_RNUM_READ_MASK;
      break;
    default:
      break;
  }
}

static void dmaHandleFollowByte(uint32_t reg, uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  if (reg < DMA_REG_COUNT) dmaRegs[reg] = byteValue;
  switch (reg) {
    case DMA_RNUM_PORT_A_ADDR_L:
      dmaPortAStart = (uint16_t)((dmaPortAStart & 0xff00u) | byteValue);
      break;
    case DMA_RNUM_PORT_A_ADDR_H:
      dmaPortAStart = (uint16_t)((dmaPortAStart & 0x00ffu) | ((uint16_t)byteValue << 8u));
      break;
    case DMA_RNUM_BLOCKLEN_L:
      dmaBlockLength = (uint16_t)((dmaBlockLength & 0xff00u) | byteValue);
      break;
    case DMA_RNUM_BLOCKLEN_H:
      dmaBlockLength = (uint16_t)((dmaBlockLength & 0x00ffu) | ((uint16_t)byteValue << 8u));
      break;
    case DMA_RNUM_PORT_A_TIMING:
      dmaPortATiming = byteValue & 0x03u;
      break;
    case DMA_RNUM_PORT_B_TIMING:
      dmaPortBTiming = byteValue & 0x03u;
      if ((byteValue & 0x20u) != 0u) {
        dmaFollow[0] = DMA_RNUM_ZXN_PRESCALER;
        dmaNumFollow = 1u;
        dmaCurFollow = 0u;
      }
      break;
    case DMA_RNUM_ZXN_PRESCALER:
      dmaPortBPrescaler = byteValue;
      break;
    case DMA_RNUM_PORT_B_ADDR_L:
      dmaPortBStart = (uint16_t)((dmaPortBStart & 0xff00u) | byteValue);
      break;
    case DMA_RNUM_PORT_B_ADDR_H:
      dmaPortBStart = (uint16_t)((dmaPortBStart & 0x00ffu) | ((uint16_t)byteValue << 8u));
      break;
    case DMA_RNUM_INTERRUPT_CTRL:
      dmaNumFollow = 0u;
      dmaCurFollow = 0u;
      if ((byteValue & 0x08u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PULSE_CTRL;
      if ((byteValue & 0x10u) != 0u) dmaFollow[dmaNumFollow++] = DMA_RNUM_INTERRUPT_VECTOR;
      break;
    case DMA_RNUM_READ_MASK:
      dmaSetupNextRead(0u);
      break;
    default:
      break;
  }
}

static void dmaLoad(void) {
  dmaAddressA = dmaPortAStart;
  dmaAddressB = dmaPortBStart;
  dmaCount = dmaBlockLength;
  dmaByteCounter = dmaMode == DMA_MODE_ZXN ? 0u : 0xffffu;
  dmaForceReady = 0u;
  dmaStatus |= 0x30u;
}

static void dmaDisable(void) {
  dmaSeq = DMA_SEQ_IDLE;
  dmaBusState = DMA_BUS_IDLE;
}

static void dmaTriggerInterrupt(uint32_t level) {
  if (dmaInterruptUnderService != 0u) return;
  if ((dmaRegs[DMA_RNUM_WR3] & 0x20u) == 0u) return;
  dmaInterruptPending = 1u;
  if ((dmaRegs[DMA_RNUM_INTERRUPT_CTRL] & 0x20u) != 0u) {
    dmaVector = (dmaRegs[DMA_RNUM_INTERRUPT_VECTOR] & 0xf9u) | ((level & 0x03u) << 1u);
  } else {
    dmaVector = dmaRegs[DMA_RNUM_INTERRUPT_VECTOR];
  }
  dmaStatus &= (uint8_t)~0x08u;
}

static void dmaFinishBlock(void) {
  dmaBlockCompletionCount++;
  dmaDisable();
  const uint8_t matchBit = dmaStatus & 0x04u;
  dmaStatus = 0x09u | matchBit;
  if ((dmaRegs[DMA_RNUM_WR0] & 0x03u) == 0x01u) dmaStatus |= 0x10u;
  if ((dmaRegs[DMA_RNUM_INTERRUPT_CTRL] & 0x02u) != 0u) dmaTriggerInterrupt(0u);
  if (dmaAutoRestart != 0u) {
    dmaAddressA = dmaPortAStart;
    dmaAddressB = dmaPortBStart;
    dmaCount = dmaBlockLength;
    dmaByteCounter = 0u;
    dmaStatus |= 0x30u;
    dmaSeq = DMA_SEQ_WAIT_READY;
  }
}

static uint32_t dmaReadSourceByte(void) {
  const uint32_t address = dmaDirectionAtoB != 0u ? dmaAddressA : dmaAddressB;
  const uint32_t isIo = dmaDirectionAtoB != 0u ? dmaPortAIsIo : dmaPortBIsIo;
  return isIo != 0u ? zxnextReadPort(address) : zxnextReadMemory(address);
}

static void dmaWriteDestByte(uint32_t value) {
  const uint32_t address = dmaDirectionAtoB != 0u ? dmaAddressB : dmaAddressA;
  const uint32_t isIo = dmaDirectionAtoB != 0u ? dmaPortBIsIo : dmaPortAIsIo;
  if (isIo != 0u) {
    zxnextWritePort(address, value);
  } else {
    zxnextWriteMemory(address, value);
  }
  dmaAddressA = (uint16_t)(dmaAddressA + dmaAddressDelta(dmaPortAAddressMode));
  dmaAddressB = (uint16_t)(dmaAddressB + dmaAddressDelta(dmaPortBAddressMode));
  dmaByteCounter = (uint16_t)(dmaByteCounter + 1u);
  dmaTransferCount++;
}

uint32_t zxnextStepDma(void) {
  dmaLastStepTicks = 0u;
  if (dmaSeq == DMA_SEQ_IDLE) return 0u;
  if (dmaSeq == DMA_SEQ_WAIT_READY) {
    if (dmaCount == 0u) {
      dmaFinishBlock();
      return 0u;
    }
    dmaBusState = DMA_BUS_REQUESTED;
    dmaSeq = DMA_SEQ_WAITING_ACK;
    return 0u;
  }
  if (dmaSeq == DMA_SEQ_WAITING_ACK && dmaBusState != DMA_BUS_AVAILABLE) return 0u;

  dmaSeq = DMA_SEQ_TRANSFER;
  dmaTransferData = (uint8_t)dmaReadSourceByte();
  const uint32_t isFinal = dmaCount != 0u && ((uint32_t)dmaByteCounter + 1u) == dmaCount;
  dmaWriteDestByte(dmaTransferData);
  dmaLastStepTicks = (dmaPortAIsIo != 0u ? 4u : 3u) + (dmaPortBIsIo != 0u ? 4u : 3u);
  if (isFinal) {
    dmaByteCounter = (uint16_t)(dmaByteCounter + 1u);
    dmaFinishBlock();
  } else {
    dmaSeq = dmaTransferMode == 1u ? DMA_SEQ_TRANSFER : DMA_SEQ_WAIT_READY;
    if (dmaTransferMode != 1u) dmaBusState = DMA_BUS_IDLE;
  }
  return dmaLastStepTicks;
}

uint32_t zxnextRunDma(uint32_t maxSteps) {
  uint32_t steps = maxSteps == 0u ? 0x20000u : maxSteps;
  uint32_t moved = 0u;
  const uint32_t startTransfers = dmaTransferCount;
  while (steps-- != 0u && dmaSeq != DMA_SEQ_IDLE) {
    if (dmaBusState == DMA_BUS_REQUESTED) dmaBusState = DMA_BUS_AVAILABLE;
    const uint32_t before = dmaTransferCount;
    zxnextStepDma();
    if (dmaTransferCount != before) moved += dmaTransferCount - before;
  }
  return moved != 0u ? moved : dmaTransferCount - startTransfers;
}

uint32_t zxnextReadDmaPort(uint32_t mode) {
  dmaMode = mode == DMA_MODE_LEGACY ? DMA_MODE_LEGACY : DMA_MODE_ZXN;
  uint8_t value;
  switch (dmaReadSeq) {
    case 0u: value = dmaStatus; break;
    case 1u: value = dmaByteCounter & 0xffu; break;
    case 2u: value = (dmaByteCounter >> 8u) & 0xffu; break;
    case 3u: value = dmaAddressA & 0xffu; break;
    case 4u: value = (dmaAddressA >> 8u) & 0xffu; break;
    case 5u: value = dmaAddressB & 0xffu; break;
    default: value = (dmaAddressB >> 8u) & 0xffu; break;
  }
  const uint8_t mask = dmaRegs[DMA_RNUM_READ_MASK];
  if ((mask & (uint8_t)(mask - 1u)) != 0u) dmaSetupNextRead((dmaReadSeq + 1u) & 0x07u);
  return value;
}

void zxnextWriteDmaPort(uint32_t mode, uint32_t value) {
  dmaMode = mode == DMA_MODE_LEGACY ? DMA_MODE_LEGACY : DMA_MODE_ZXN;
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  if (dmaNumFollow != 0u) {
    const uint32_t reg = dmaFollow[dmaCurFollow++];
    if (dmaCurFollow >= dmaNumFollow) {
      dmaNumFollow = 0u;
      dmaCurFollow = 0u;
    }
    dmaHandleFollowByte(reg, byteValue);
    dmaResetPointer = (dmaResetPointer + 1u) % 6u;
    return;
  }

  dmaResetPointer = 0u;
  uint32_t regGroup;
  if ((byteValue & 0x87u) == 0x00u) {
    dmaRegs[DMA_RNUM_WR2] = byteValue;
    dmaPortBIsIo = (byteValue & 0x08u) != 0u;
    dmaPortBAddressMode = (byteValue >> 4u) & 0x03u;
    regGroup = 2u;
  } else if ((byteValue & 0x87u) == 0x04u) {
    dmaRegs[DMA_RNUM_WR1] = byteValue;
    dmaPortAIsIo = (byteValue & 0x08u) != 0u;
    dmaPortAAddressMode = (byteValue >> 4u) & 0x03u;
    regGroup = 1u;
  } else if ((byteValue & 0x80u) == 0x00u) {
    dmaRegs[DMA_RNUM_WR0] = byteValue;
    dmaDirectionAtoB = (byteValue & 0x04u) != 0u;
    regGroup = 0u;
  } else if ((byteValue & 0x83u) == 0x80u) {
    dmaRegs[DMA_RNUM_WR3] = byteValue;
    dmaEnabled = byteValue & 0x01u;
    if ((byteValue & 0x40u) != 0u) dmaSeq = DMA_SEQ_WAIT_READY;
    regGroup = 3u;
  } else if ((byteValue & 0x83u) == 0x81u) {
    dmaRegs[DMA_RNUM_WR4] = byteValue;
    const uint32_t modeValue = (byteValue >> 5u) & 0x03u;
    if (modeValue <= 2u) dmaTransferMode = (uint8_t)modeValue;
    regGroup = 4u;
  } else if ((byteValue & 0xc7u) == 0x82u) {
    dmaRegs[DMA_RNUM_WR5] = byteValue;
    dmaAutoRestart = (byteValue & 0x20u) != 0u;
    regGroup = 5u;
  } else {
    dmaRegs[DMA_RNUM_WR6] = byteValue;
    regGroup = 6u;
    switch (byteValue) {
      case 0xc3u:
        dmaDisable();
        resetDmaDecodedState();
        dmaStatus = 0x38u;
        break;
      case 0xc7u:
        dmaPortATiming = 0u;
        dmaRegs[DMA_RNUM_PORT_A_TIMING] = 0u;
        break;
      case 0xcbu:
        dmaPortBTiming = 0u;
        dmaPortBPrescaler = 0u;
        dmaRegs[DMA_RNUM_PORT_B_TIMING] = 0u;
        break;
      case 0x83u:
        dmaEnabled = 0u;
        dmaDisable();
        break;
      case 0xcfu:
        dmaLoad();
        break;
      case 0xd3u:
        dmaCount = dmaBlockLength;
        dmaByteCounter = 0u;
        dmaStatus |= 0x30u;
        break;
      case 0x87u:
        dmaByteCounter = dmaMode == DMA_MODE_ZXN ? 0u : 0xffffu;
        dmaEnabled = 1u;
        dmaSeq = DMA_SEQ_WAIT_READY;
        break;
      case 0xbfu:
        dmaRegs[DMA_RNUM_READ_MASK] = 1u;
        dmaReadSeq = 0u;
        break;
      case 0xa7u:
        dmaSetupNextRead(0u);
        break;
      case 0x8bu:
        dmaStatus |= 0x30u;
        dmaInterruptPending = 0u;
        break;
      case 0xafu:
        dmaRegs[DMA_RNUM_WR3] &= (uint8_t)~0x20u;
        break;
      case 0xabu:
        dmaRegs[DMA_RNUM_WR3] |= 0x20u;
        break;
      case 0xa3u:
        dmaRegs[DMA_RNUM_WR3] &= (uint8_t)~0x20u;
        dmaInterruptPending = 0u;
        dmaInterruptUnderService = 0u;
        dmaForceReady = 0u;
        dmaStatus |= 0x08u;
        break;
      case 0xb3u:
        dmaForceReady = 1u;
        break;
      default:
        break;
    }
  }
  dmaSetFollow(regGroup, byteValue);
}

void zxnextAcknowledgeDmaBus(void) {
  if (dmaBusState == DMA_BUS_REQUESTED) dmaBusState = DMA_BUS_AVAILABLE;
}

uint32_t zxnextGetDmaMode(void) { return dmaMode; }
uint32_t zxnextGetDmaSeq(void) { return dmaSeq; }
uint32_t zxnextGetDmaState(void) { return dmaSeq == DMA_SEQ_IDLE ? 0u : dmaSeq == DMA_SEQ_WAIT_READY ? 1u : dmaSeq == DMA_SEQ_WAITING_ACK ? 2u : 3u; }
uint32_t zxnextGetDmaBusState(void) { return dmaBusState; }
uint32_t zxnextGetDmaBusRequested(void) { return dmaBusState != DMA_BUS_IDLE; }
uint32_t zxnextGetDmaBusAcknowledged(void) { return dmaBusState == DMA_BUS_AVAILABLE; }
uint32_t zxnextGetDmaEnabled(void) { return dmaEnabled; }
uint32_t zxnextGetDmaRawReg(uint32_t group, uint32_t slot) { return dmaReadRawReg(group, slot); }
uint32_t zxnextGetDmaNumFollow(void) { return dmaNumFollow; }
uint32_t zxnextGetDmaReadSeq(void) { return dmaReadSeq; }
uint32_t zxnextGetDmaStatus(void) { return dmaStatus; }
uint32_t zxnextGetDmaPortAStart(void) { return dmaPortAStart; }
uint32_t zxnextGetDmaPortBStart(void) { return dmaPortBStart; }
uint32_t zxnextGetDmaBlockLength(void) { return dmaBlockLength; }
uint32_t zxnextGetDmaAddressA(void) { return dmaAddressA; }
uint32_t zxnextGetDmaAddressB(void) { return dmaAddressB; }
uint32_t zxnextGetDmaByteCounter(void) { return dmaByteCounter; }
uint32_t zxnextGetDmaTransferCount(void) { return dmaTransferCount; }
uint32_t zxnextGetDmaBlockCompletionCount(void) { return dmaBlockCompletionCount; }
uint32_t zxnextGetDmaLastStepTicks(void) { return dmaLastStepTicks; }
uint32_t zxnextGetDmaTransferDataByte(void) { return dmaTransferData; }
uint32_t zxnextGetDmaDirectionAtoB(void) { return dmaDirectionAtoB; }
uint32_t zxnextGetDmaPortAIsIo(void) { return dmaPortAIsIo; }
uint32_t zxnextGetDmaPortBIsIo(void) { return dmaPortBIsIo; }
uint32_t zxnextGetDmaPortAAddressMode(void) { return dmaPortAAddressMode; }
uint32_t zxnextGetDmaPortBAddressMode(void) { return dmaPortBAddressMode; }
uint32_t zxnextGetDmaTransferMode(void) { return dmaTransferMode; }
uint32_t zxnextGetDmaAutoRestart(void) { return dmaAutoRestart; }
uint32_t zxnextGetDmaPortBPrescaler(void) { return dmaPortBPrescaler; }
uint32_t zxnextGetDmaForceReady(void) { return dmaForceReady; }
uint32_t zxnextGetDmaInterruptPending(void) { return dmaInterruptPending; }
uint32_t zxnextGetDmaVector(void) { return dmaVector; }
