#include "zxnext-dma.h"
#include "zxnext-memory.h"

/*
 * zxnDMA / Z80 DMA for the WASM Next backend.
 *
 * A port of DmaDevice.ts, which is the reference for behaviour (and itself follows MAME's
 * z80dma.cpp plus the specnext_dma overrides). Only what a program can observe is ported: register
 * writes and follow bytes, WR6 commands, the read sequence, and the transfer state machine with its
 * timing. The TypeScript device's legacy test-only API (decoded "DmaState", register write
 * sequences, validation helpers) has no counterpart here.
 *
 * The CPU loop drives the state machine through zxnextCpuRunDma() (zxnext-cpu.c), the equivalent of
 * ZxNextMachine.runDmaUntilCpuCanRun(): before every instruction it steps the DMA while the DMA
 * holds or requests the bus, and charges each byte's 28 MHz clocks to the frame.
 */

static uint32_t zxnextPortsRead(uint32_t address);
static void zxnextPortsWrite(uint32_t address, uint32_t value);

// --- Raw register numbers: (group << 3) + slot, as in DmaDevice.ts / MAME m_regs.
#define DMA_RNUM_WR0_BASE 0
#define DMA_RNUM_PORT_A_ADDR_L 1
#define DMA_RNUM_PORT_A_ADDR_H 2
#define DMA_RNUM_BLOCKLEN_L 3
#define DMA_RNUM_BLOCKLEN_H 4
#define DMA_RNUM_WR1_BASE 8
#define DMA_RNUM_PORT_A_TIMING 9
#define DMA_RNUM_WR2_BASE 16
#define DMA_RNUM_PORT_B_TIMING 17
#define DMA_RNUM_ZXN_PRESCALER 18
#define DMA_RNUM_WR3_BASE 24
#define DMA_RNUM_MASK_BYTE 25
#define DMA_RNUM_MATCH_BYTE 26
#define DMA_RNUM_WR4_BASE 32
#define DMA_RNUM_PORT_B_ADDR_L 33
#define DMA_RNUM_PORT_B_ADDR_H 34
#define DMA_RNUM_INTERRUPT_CTRL 35
#define DMA_RNUM_INTERRUPT_VECTOR 36
#define DMA_RNUM_PULSE_CTRL 37
#define DMA_RNUM_WR5_BASE 40
#define DMA_RNUM_WR6_BASE 48
#define DMA_RNUM_READ_MASK 49
#define DMA_RNUM_COUNT 50

// --- Transfer state machine (DmaSeq).
#define DMA_SEQ_IDLE 0
#define DMA_SEQ_WAIT_READY 1
#define DMA_SEQ_REQUEST_BUS 2
#define DMA_SEQ_WAITING_ACK 3
#define DMA_SEQ_TRANS1_INC_DEC_SOURCE 4
#define DMA_SEQ_TRANS1_READ_SOURCE 5
#define DMA_SEQ_TRANS1_INC_DEC_DEST 6
#define DMA_SEQ_TRANS1_WRITE_DEST 7
#define DMA_SEQ_FINISH 8

// --- WR4 operating mode (TransferMode).
#define DMA_MODE_BYTE 0
#define DMA_MODE_CONTINUOUS 1
#define DMA_MODE_BURST 2

// --- Bus arbitration (BusState).
#define DMA_BUS_IDLE 0
#define DMA_BUS_REQUESTED 1
#define DMA_BUS_AVAILABLE 2
#define DMA_BUS_DELAYED 3

// --- Address modes (WR1/WR2 D5-D4); 3 behaves as fixed.
#define DMA_ADDR_DECREMENT 0
#define DMA_ADDR_INCREMENT 1

#define DMA_TSTATES_IO_PORT 4
#define DMA_TSTATES_MEMORY_READ 3
#define DMA_TSTATES_MEMORY_WRITE 3
#define DMA_SPI_DATA_PORT 0xebu
#define DMA_SPI_TRANSFER_WAIT_CYCLES 16

static uint8_t dmaRegs[DMA_RNUM_COUNT];
static uint8_t dmaFollow[5];
static uint8_t dmaNumFollow;
static uint8_t dmaCurFollow;
static uint8_t dmaResetPointer;

// --- Decoded register state.
static uint8_t dmaMode;
static uint8_t dmaDirectionAtoB;
static uint16_t dmaPortAStartAddress;
static uint16_t dmaBlockLength;
static uint8_t dmaTransferModeWr0;
static uint8_t dmaPortAIsIo;
static uint8_t dmaPortAAddressMode;
static uint8_t dmaPortBIsIo;
static uint8_t dmaPortBAddressMode;
static uint8_t dmaPortBPrescaler;
static uint8_t dmaEnabled;
static uint8_t dmaTransferMode;
static uint16_t dmaPortBStartAddress;
static uint8_t dmaAutoRestart;
static uint8_t dmaPortAConfig;
static uint8_t dmaPortBConfig;

// --- Running transfer state.
static uint8_t dmaSeq;
static uint8_t dmaDelay;
static uint8_t dmaBusState;
static uint8_t dmaTransferDataByte;
static uint16_t dmaAddressA;
static uint16_t dmaAddressB;
static uint16_t dmaCount;
static uint16_t dmaByteCounter;
static uint64_t dmaBurstReadyAtSysTact;
static uint32_t dmaTransferredBytes;

// --- Status and interrupts.
static uint8_t dmaStatus;
static uint8_t dmaVector;
static uint8_t dmaForceReady;
static uint8_t dmaIp;
static uint8_t dmaIus;
static uint8_t dmaReadSeq;

void zxnextDmaReset(void) {
  for (uint32_t i = 0; i < DMA_RNUM_COUNT; i++) dmaRegs[i] = 0;
  for (uint32_t i = 0; i < 5; i++) dmaFollow[i] = 0;
  dmaNumFollow = 0;
  dmaCurFollow = 0;
  dmaResetPointer = 0;

  dmaMode = 0;
  dmaDirectionAtoB = 1;
  dmaPortAStartAddress = 0;
  dmaBlockLength = 0;
  dmaTransferModeWr0 = 0;
  dmaPortAIsIo = 0;
  dmaPortAAddressMode = DMA_ADDR_INCREMENT;
  dmaPortBIsIo = 0;
  dmaPortBAddressMode = DMA_ADDR_INCREMENT;
  dmaPortBPrescaler = 0;
  dmaEnabled = 0;
  dmaTransferMode = DMA_MODE_CONTINUOUS;
  dmaPortBStartAddress = 0;
  dmaAutoRestart = 0;
  dmaPortAConfig = 0;
  dmaPortBConfig = 0;

  dmaSeq = DMA_SEQ_IDLE;
  dmaDelay = 0;
  dmaBusState = DMA_BUS_IDLE;
  dmaTransferDataByte = 0;
  dmaAddressA = 0;
  dmaAddressB = 0;
  dmaCount = 0;
  dmaByteCounter = 0;
  dmaBurstReadyAtSysTact = 0;
  dmaTransferredBytes = 0;

  dmaStatus = 0;
  dmaVector = 0;
  dmaForceReady = 0;
  dmaIp = 0;
  dmaIus = 0;
  dmaReadSeq = 0;
}

void zxnextDmaSetMode(uint32_t mode) { dmaMode = mode & 1u; }

// --- The 28 MHz system clock, the time base of burst pacing.
static inline uint64_t zxnextDmaSysTact(void) {
  return (uint64_t)frames * ZXNEXT_TACTS_IN_FRAME + frameTacts28;
}

static inline void zxnextDmaReleaseBus(void) { dmaBusState = DMA_BUS_IDLE; }

static inline void zxnextDmaRequestBus(void) {
  if (dmaBusState == DMA_BUS_IDLE) dmaBusState = DMA_BUS_REQUESTED;
}

static void zxnextDmaEnable(void) { dmaSeq = DMA_SEQ_WAIT_READY; }

static void zxnextDmaDisable(void) {
  dmaSeq = DMA_SEQ_IDLE;
  dmaBurstReadyAtSysTact = 0;
  zxnextDmaReleaseBus();
}

static void zxnextDmaSetupNextRead(uint8_t rr) {
  uint8_t mask = dmaRegs[DMA_RNUM_READ_MASK];
  if (mask == 0) return;
  rr &= 7u;
  while ((mask & (1u << rr)) == 0) rr = (rr + 1u) & 7u;
  dmaReadSeq = rr;
}

static void zxnextDmaTriggerInterrupt(uint8_t level) {
  if (dmaIus) return;
  if ((dmaRegs[DMA_RNUM_WR3_BASE] & 0x20u) == 0) return;
  dmaIp = 1;
  if (dmaRegs[DMA_RNUM_INTERRUPT_CTRL] & 0x20u) {
    dmaVector = (uint8_t)((dmaRegs[DMA_RNUM_INTERRUPT_VECTOR] & 0xf9u) | ((level & 0x03u) << 1));
  } else {
    dmaVector = dmaRegs[DMA_RNUM_INTERRUPT_VECTOR];
  }
  dmaStatus &= (uint8_t)~0x08u;
}

// ============================================================================
// Register writes
// ============================================================================

static void zxnextDmaHandleFollow(uint8_t nreg, uint8_t value) {
  dmaRegs[nreg] = value;
  switch (nreg) {
    case DMA_RNUM_PORT_A_ADDR_L: dmaPortAStartAddress = (dmaPortAStartAddress & 0xff00u) | value; break;
    case DMA_RNUM_PORT_A_ADDR_H: dmaPortAStartAddress = (dmaPortAStartAddress & 0x00ffu) | ((uint16_t)value << 8); break;
    case DMA_RNUM_BLOCKLEN_L: dmaBlockLength = (dmaBlockLength & 0xff00u) | value; break;
    case DMA_RNUM_BLOCKLEN_H: dmaBlockLength = (dmaBlockLength & 0x00ffu) | ((uint16_t)value << 8); break;
    case DMA_RNUM_PORT_B_TIMING:
      // --- zxnDMA: D5 of port B's timing byte announces a prescaler byte. The queue is already
      // --- empty (the timing byte is always WR2's last follow byte), so start it afresh.
      if (value & 0x20u) {
        dmaFollow[0] = DMA_RNUM_ZXN_PRESCALER;
        dmaNumFollow = 1;
        dmaCurFollow = 0;
      }
      break;
    case DMA_RNUM_ZXN_PRESCALER: dmaPortBPrescaler = value; break;
    case DMA_RNUM_PORT_B_ADDR_L: dmaPortBStartAddress = (dmaPortBStartAddress & 0xff00u) | value; break;
    case DMA_RNUM_PORT_B_ADDR_H: dmaPortBStartAddress = (dmaPortBStartAddress & 0x00ffu) | ((uint16_t)value << 8); break;
    case DMA_RNUM_INTERRUPT_CTRL:
      // --- The interrupt control byte announces pulse control (D3) and the vector (D4).
      dmaNumFollow = 0;
      dmaCurFollow = 0;
      if (value & 0x08u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PULSE_CTRL;
      if (value & 0x10u) dmaFollow[dmaNumFollow++] = DMA_RNUM_INTERRUPT_VECTOR;
      break;
    case DMA_RNUM_READ_MASK:
      zxnextDmaSetupNextRead(0);
      break;
    default:
      // --- Timing, mask/match, pulse and vector bytes are only stored.
      break;
  }
}

static void zxnextDmaSetupFollow(uint32_t group, uint8_t base) {
  dmaNumFollow = 0;
  dmaCurFollow = 0;
  switch (group) {
    case 0:
      if (base & 0x08u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_A_ADDR_L;
      if (base & 0x10u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_A_ADDR_H;
      if (base & 0x20u) dmaFollow[dmaNumFollow++] = DMA_RNUM_BLOCKLEN_L;
      if (base & 0x40u) dmaFollow[dmaNumFollow++] = DMA_RNUM_BLOCKLEN_H;
      break;
    case 1:
      if (base & 0x40u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_A_TIMING;
      break;
    case 2:
      if (base & 0x40u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_B_TIMING;
      break;
    case 3:
      if (base & 0x08u) dmaFollow[dmaNumFollow++] = DMA_RNUM_MASK_BYTE;
      if (base & 0x10u) dmaFollow[dmaNumFollow++] = DMA_RNUM_MATCH_BYTE;
      if (base & 0x40u) zxnextDmaEnable();
      break;
    case 4:
      if (base & 0x04u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_B_ADDR_L;
      if (base & 0x08u) dmaFollow[dmaNumFollow++] = DMA_RNUM_PORT_B_ADDR_H;
      if (base & 0x10u) dmaFollow[dmaNumFollow++] = DMA_RNUM_INTERRUPT_CTRL;
      break;
    case 6:
      if (base == 0xbbu) dmaFollow[dmaNumFollow++] = DMA_RNUM_READ_MASK;
      break;
    default:
      break;
  }
}

static void zxnextDmaCommand(uint8_t value) {
  dmaRegs[DMA_RNUM_WR6_BASE] = value;
  switch (value) {
    case 0xc3u: // RESET
      zxnextDmaDisable();
      dmaEnabled = 0;
      dmaForceReady = 0;
      dmaIp = 0;
      dmaIus = 0;
      // --- Progressive column reset (MAME m_reset_pointer).
      for (uint32_t wr = 0; wr < 7; wr++) dmaRegs[wr * 8u + dmaResetPointer] = 0;
      dmaResetPointer = (uint8_t)((dmaResetPointer + 1u) % 6u);
      dmaPortBPrescaler = 0;
      dmaAutoRestart = 0;
      dmaStatus = 0x38u;
      break;
    case 0xc7u: // RESET_PORT_A_TIMING
      dmaRegs[DMA_RNUM_PORT_A_TIMING] = 0;
      break;
    case 0xcbu: // RESET_PORT_B_TIMING
      dmaRegs[DMA_RNUM_PORT_B_TIMING] = 0;
      dmaPortBPrescaler = 0;
      break;
    case 0x83u: // DISABLE_DMA
      dmaEnabled = 0;
      zxnextDmaDisable();
      break;
    case 0xcfu: // LOAD
      dmaForceReady = 0;
      dmaByteCounter = dmaMode == 0 ? 0u : 0xffffu;
      dmaAddressA = dmaPortAStartAddress;
      dmaAddressB = dmaPortBStartAddress;
      dmaCount = dmaBlockLength;
      dmaTransferredBytes = 0;
      dmaStatus |= 0x30u;
      break;
    case 0xd3u: // CONTINUE
      dmaCount = dmaBlockLength;
      dmaByteCounter = 0;
      dmaTransferredBytes = 0;
      dmaStatus |= 0x30u;
      break;
    case 0x87u: // ENABLE_DMA
      dmaByteCounter = dmaMode == 0 ? 0u : 0xffffu;
      dmaTransferredBytes = 0;
      dmaEnabled = 1;
      zxnextDmaEnable();
      break;
    case 0xbfu: // READ_STATUS_BYTE
      dmaRegs[DMA_RNUM_READ_MASK] = 1;
      dmaReadSeq = 0;
      break;
    case 0xa7u: // INITIALIZE_READ_SEQUENCE
      zxnextDmaSetupNextRead(0);
      break;
    case 0x8bu: // REINITIALIZE_STATUS_BYTE
      dmaStatus |= 0x30u;
      dmaIp = 0;
      break;
    case 0xafu: // DISABLE_INTERRUPTS
      dmaRegs[DMA_RNUM_WR3_BASE] &= (uint8_t)~0x20u;
      break;
    case 0xabu: // ENABLE_INTERRUPTS
      dmaRegs[DMA_RNUM_WR3_BASE] |= 0x20u;
      break;
    case 0xa3u: // RESET_AND_DISABLE_INTERRUPTS
      dmaRegs[DMA_RNUM_WR3_BASE] &= (uint8_t)~0x20u;
      dmaIp = 0;
      dmaIus = 0;
      dmaForceReady = 0;
      dmaStatus |= 0x08u;
      break;
    case 0xb3u: // FORCE_READY
      dmaForceReady = 1;
      break;
    default: // 0xb7 ENABLE_AFTER_RETI and unknown commands: no effect
      break;
  }
}

void zxnextDmaWritePort(uint32_t value) {
  uint8_t byteValue = value & 0xffu;

  if (dmaNumFollow != 0) {
    uint8_t nreg = dmaFollow[dmaCurFollow++];
    if (dmaCurFollow >= dmaNumFollow) {
      dmaNumFollow = 0;
      dmaCurFollow = 0;
    }
    zxnextDmaHandleFollow(nreg, byteValue);
    dmaResetPointer = (uint8_t)((dmaResetPointer + 1u) % 6u);
    return;
  }

  // --- Base byte: MAME z80dma.cpp write() order and masks.
  dmaResetPointer = 0;
  uint32_t group;
  if ((byteValue & 0x87u) == 0x00u) {
    group = 2;
    dmaRegs[DMA_RNUM_WR2_BASE] = byteValue;
    dmaPortBConfig = byteValue;
    dmaPortBIsIo = (byteValue & 0x08u) != 0;
    dmaPortBAddressMode = (byteValue >> 4) & 0x03u;
  } else if ((byteValue & 0x87u) == 0x04u) {
    group = 1;
    dmaRegs[DMA_RNUM_WR1_BASE] = byteValue;
    dmaPortAConfig = byteValue;
    dmaPortAIsIo = (byteValue & 0x08u) != 0;
    dmaPortAAddressMode = (byteValue >> 4) & 0x03u;
  } else if ((byteValue & 0x80u) == 0x00u) {
    group = 0;
    dmaRegs[DMA_RNUM_WR0_BASE] = byteValue;
    dmaDirectionAtoB = (byteValue & 0x04u) != 0;
    dmaTransferModeWr0 = byteValue & 0x03u;
  } else if ((byteValue & 0x83u) == 0x80u) {
    group = 3;
    dmaRegs[DMA_RNUM_WR3_BASE] = byteValue;
    dmaEnabled = byteValue & 0x01u;
  } else if ((byteValue & 0x83u) == 0x81u) {
    group = 4;
    dmaRegs[DMA_RNUM_WR4_BASE] = byteValue;
    switch ((byteValue >> 5) & 0x03u) {
      case 0: dmaTransferMode = DMA_MODE_BYTE; break;
      case 1: dmaTransferMode = DMA_MODE_CONTINUOUS; break;
      case 2: dmaTransferMode = DMA_MODE_BURST; break;
      default: break;
    }
  } else if ((byteValue & 0xc7u) == 0x82u) {
    group = 5;
    dmaRegs[DMA_RNUM_WR5_BASE] = byteValue;
    dmaAutoRestart = (byteValue & 0x20u) != 0;
  } else {
    group = 6;
    zxnextDmaCommand(byteValue);
  }
  zxnextDmaSetupFollow(group, byteValue);
}

// ============================================================================
// Read sequence
// ============================================================================

uint32_t zxnextDmaReadStatusByte(void) {
  uint8_t pos = dmaReadSeq;
  uint32_t value;
  switch (pos) {
    case 0: value = dmaStatus; break;
    case 1: value = dmaByteCounter & 0xffu; break;
    case 2: value = (dmaByteCounter >> 8) & 0xffu; break;
    case 3: value = dmaAddressA & 0xffu; break;
    case 4: value = (dmaAddressA >> 8) & 0xffu; break;
    case 5: value = dmaAddressB & 0xffu; break;
    default: value = (dmaAddressB >> 8) & 0xffu; break;
  }
  uint8_t mask = dmaRegs[DMA_RNUM_READ_MASK];
  if ((mask & (uint8_t)(mask - 1u)) != 0) zxnextDmaSetupNextRead((pos + 1u) & 7u);
  return value;
}

// ============================================================================
// Transfer
// ============================================================================

static uint32_t zxnextDmaIsReady(void) {
  if (dmaTransferMode == DMA_MODE_BURST && dmaPortBPrescaler != 0 &&
      zxnextDmaSysTact() < dmaBurstReadyAtSysTact) {
    return 0;
  }
  return 1;
}

// --- WR2 prescaler delay in 28 MHz clocks: one unit is 32 / (8 >> speed) clocks.
static inline uint32_t zxnextDmaPrescalerDelay(void) {
  return (uint32_t)dmaPortBPrescaler * 4u * (1u << (cpuEffectiveSpeed & 0x03u));
}

static inline int32_t zxnextDmaAddressDelta(uint8_t mode) {
  if (mode >= 2u) return 0;
  return mode == DMA_ADDR_INCREMENT ? 1 : -1;
}

// --- Clocks for one byte: read timing from port A's type, write timing from port B's.
static uint32_t zxnextDmaTransferTiming(void) {
  uint32_t readTicks;
  uint32_t writeTicks;
  if (dmaPortAIsIo) {
    readTicks = DMA_TSTATES_IO_PORT;
    if ((dmaAddressA & 0xffu) == DMA_SPI_DATA_PORT) readTicks += DMA_SPI_TRANSFER_WAIT_CYCLES;
  } else {
    readTicks = DMA_TSTATES_MEMORY_READ;
  }
  if (dmaPortBIsIo) {
    writeTicks = DMA_TSTATES_IO_PORT;
    if ((dmaAddressB & 0xffu) == DMA_SPI_DATA_PORT) writeTicks += DMA_SPI_TRANSFER_WAIT_CYCLES;
  } else {
    writeTicks = DMA_TSTATES_MEMORY_WRITE;
  }
  return readTicks + writeTicks;
}

static void zxnextDmaTransferFinish(void) {
  zxnextDmaDisable();
  dmaStatus = (uint8_t)(0x09u | (dmaStatus & 0x04u));
  if ((dmaRegs[DMA_RNUM_WR0_BASE] & 0x03u) == 1u) dmaStatus |= 0x10u;
  if (dmaRegs[DMA_RNUM_INTERRUPT_CTRL] & 0x02u) zxnextDmaTriggerInterrupt(0);
  if (dmaAutoRestart) {
    dmaAddressA = dmaPortAStartAddress;
    dmaAddressB = dmaPortBStartAddress;
    dmaCount = dmaBlockLength;
    dmaByteCounter = 0;
    dmaStatus |= 0x30u;
    zxnextDmaEnable();
  }
}

static uint32_t zxnextDmaTransferByte(void) {
  // --- Read from the source port.
  dmaSeq = DMA_SEQ_TRANS1_INC_DEC_SOURCE;
  uint16_t sourceAddress = dmaDirectionAtoB ? dmaAddressA : dmaAddressB;
  uint8_t sourceIsIo = dmaDirectionAtoB ? dmaPortAIsIo : dmaPortBIsIo;
  dmaTransferDataByte = (uint8_t)(sourceIsIo ? zxnextPortsRead(sourceAddress) : zxnextMemoryReadMapped(sourceAddress));

  // --- Search mode (WR0 D1).
  uint8_t searchActive = (dmaTransferModeWr0 & 0x02u) != 0;
  uint8_t matchFound = 0;
  if (searchActive) {
    uint8_t mask = dmaRegs[DMA_RNUM_MASK_BYTE];
    matchFound = (uint8_t)(dmaTransferDataByte | mask) == (uint8_t)(dmaRegs[DMA_RNUM_MATCH_BYTE] | mask);
    if (matchFound) {
      dmaStatus |= 0x04u;
      if (dmaRegs[DMA_RNUM_INTERRUPT_CTRL] & 0x01u) zxnextDmaTriggerInterrupt(1);
    }
  }

  uint8_t stopOnMatch = (dmaRegs[DMA_RNUM_WR5_BASE] & 0x04u) != 0;
  uint8_t isFinal = (dmaCount != 0 && (uint32_t)dmaByteCounter + 1u == dmaCount) ||
    (searchActive && matchFound && stopOnMatch);

  // --- Write to the destination port (skipped in pure search mode), then step both addresses.
  dmaSeq = DMA_SEQ_TRANS1_WRITE_DEST;
  uint8_t doWrite = (dmaTransferModeWr0 & 0x01u) != 0 || dmaTransferModeWr0 == 0;
  if (doWrite) {
    uint16_t destAddress = dmaDirectionAtoB ? dmaAddressB : dmaAddressA;
    uint8_t destIsIo = dmaDirectionAtoB ? dmaPortBIsIo : dmaPortAIsIo;
    if (destIsIo) zxnextPortsWrite(destAddress, dmaTransferDataByte);
    else zxnextMemoryWriteMapped(destAddress, dmaTransferDataByte);
  }
  dmaAddressA = (uint16_t)(dmaAddressA + zxnextDmaAddressDelta(dmaPortAAddressMode));
  dmaAddressB = (uint16_t)(dmaAddressB + zxnextDmaAddressDelta(dmaPortBAddressMode));
  dmaByteCounter = (uint16_t)(dmaByteCounter + 1u);
  dmaTransferredBytes++;
  // --- MAME leaves the counter one past the block length.
  if (isFinal) dmaByteCounter = (uint16_t)(dmaByteCounter + 1u);

  uint32_t opMode = isFinal ? 3u : dmaTransferMode;
  switch (opMode) {
    case DMA_MODE_BYTE:
      zxnextDmaReleaseBus();
      dmaSeq = DMA_SEQ_WAIT_READY;
      break;
    case DMA_MODE_CONTINUOUS:
      dmaSeq = zxnextDmaIsReady() ? DMA_SEQ_TRANS1_INC_DEC_SOURCE : DMA_SEQ_WAIT_READY;
      break;
    case DMA_MODE_BURST:
      if (zxnextDmaIsReady()) {
        dmaSeq = DMA_SEQ_TRANS1_INC_DEC_SOURCE;
      } else {
        zxnextDmaReleaseBus();
        dmaSeq = DMA_SEQ_WAIT_READY;
      }
      break;
    default:
      dmaSeq = DMA_SEQ_FINISH;
      zxnextDmaTransferFinish();
      break;
  }

  // --- Paced burst mode hands the bus back to the CPU between prescaled bytes.
  if (dmaTransferMode == DMA_MODE_BURST && dmaPortBPrescaler != 0 &&
      dmaSeq == DMA_SEQ_TRANS1_INC_DEC_SOURCE) {
    dmaBurstReadyAtSysTact = zxnextDmaSysTact() + zxnextDmaPrescalerDelay();
    zxnextDmaReleaseBus();
    dmaSeq = DMA_SEQ_WAIT_READY;
  }

  // --- specnext dma_delay: stop after this byte and wait for the delay to clear.
  if (dmaDelay && dmaSeq == DMA_SEQ_TRANS1_INC_DEC_SOURCE) {
    zxnextDmaReleaseBus();
    dmaSeq = DMA_SEQ_WAIT_READY;
  }

  return zxnextDmaTransferTiming();
}

/*
 * Advance the state machine by one step (DmaDevice.stepDma). Returns the 28 MHz clocks a moved
 * byte took, or 0 when the DMA is waiting, finishing, or idle.
 */
static uint32_t zxnextDmaStep(void) {
  switch (dmaSeq) {
    case DMA_SEQ_WAIT_READY:
      if (!zxnextDmaIsReady()) return 0;
      if (dmaDelay) return 0;
      if (dmaCount == 0) {
        zxnextDmaTransferFinish();
        return 0;
      }
      if (dmaTransferMode == DMA_MODE_CONTINUOUS && dmaByteCounter != 0) {
        dmaSeq = DMA_SEQ_TRANS1_INC_DEC_SOURCE;
        return zxnextDmaTransferByte();
      }
      zxnextDmaRequestBus();
      dmaSeq = DMA_SEQ_WAITING_ACK;
      return 0;
    case DMA_SEQ_WAITING_ACK:
      if (dmaBusState != DMA_BUS_AVAILABLE) return 0;
      dmaSeq = DMA_SEQ_TRANS1_INC_DEC_SOURCE;
      return zxnextDmaTransferByte();
    case DMA_SEQ_TRANS1_INC_DEC_SOURCE:
    case DMA_SEQ_TRANS1_READ_SOURCE:
    case DMA_SEQ_TRANS1_INC_DEC_DEST:
    case DMA_SEQ_TRANS1_WRITE_DEST:
      return zxnextDmaTransferByte();
    case DMA_SEQ_FINISH:
      zxnextDmaTransferFinish();
      return 0;
    default: // IDLE, REQUEST_BUS
      return 0;
  }
}

static inline uint32_t zxnextDmaBusRequested(void) { return dmaBusState != DMA_BUS_IDLE; }

static inline void zxnextDmaAcknowledgeBusIfRequested(void) {
  if (dmaBusState == DMA_BUS_REQUESTED) dmaBusState = DMA_BUS_AVAILABLE;
}

static inline uint32_t zxnextDmaIsActive(void) {
  return dmaSeq != DMA_SEQ_IDLE || dmaBusState != DMA_BUS_IDLE;
}

static inline uint32_t zxnextDmaGetIpSignal(void) { return dmaIp; }

static inline void zxnextDmaSetDelay(uint32_t value) { dmaDelay = value != 0; }

/*
 * Test and diagnostics hook: step the DMA as the machine does, granting the bus, until `maxBytes`
 * bytes have moved or it goes idle. No time passes, so a paced burst waiting for its prescaler
 * stops here; the running machine uses zxnextCpuRunDma instead.
 */
uint32_t zxnextDmaExecuteTransfer(uint32_t maxBytes) {
  uint32_t executed = 0;
  uint32_t guard = maxBytes * 4u + 16u;
  while (executed < maxBytes && dmaSeq != DMA_SEQ_IDLE && guard-- > 0u) {
    zxnextDmaAcknowledgeBusIfRequested();
    if (zxnextDmaStep() > 0u) executed++;
  }
  return executed;
}

uint32_t zxnextGetDmaMode(void) { return dmaMode; }
uint32_t zxnextGetDmaStatus(void) { return dmaStatus; }
uint32_t zxnextGetDmaReadMask(void) { return dmaRegs[DMA_RNUM_READ_MASK]; }
uint32_t zxnextGetDmaPortAStartAddress(void) { return dmaPortAStartAddress; }
uint32_t zxnextGetDmaPortBStartAddress(void) { return dmaPortBStartAddress; }
uint32_t zxnextGetDmaBlockLength(void) { return dmaBlockLength; }
uint32_t zxnextGetDmaEnabled(void) { return dmaEnabled; }
uint32_t zxnextGetDmaByteCounter(void) { return dmaByteCounter; }
uint32_t zxnextGetDmaDirectionAtoB(void) { return dmaDirectionAtoB; }
uint32_t zxnextGetDmaPortAConfig(void) { return dmaPortAConfig; }
uint32_t zxnextGetDmaPortBConfig(void) { return dmaPortBConfig; }
uint32_t zxnextGetDmaTransferMode(void) { return dmaTransferMode; }
uint32_t zxnextGetDmaTransferredBytes(void) { return dmaTransferredBytes; }
uint32_t zxnextGetDmaAddressA(void) { return dmaAddressA; }
uint32_t zxnextGetDmaAddressB(void) { return dmaAddressB; }
uint32_t zxnextGetDmaCount(void) { return dmaCount; }
uint32_t zxnextGetDmaSeq(void) { return dmaSeq; }
uint32_t zxnextGetDmaBusState(void) { return dmaBusState; }
uint32_t zxnextGetDmaDelay(void) { return dmaDelay; }
uint32_t zxnextGetDmaPrescaler(void) { return dmaPortBPrescaler; }
uint32_t zxnextGetDmaIp(void) { return dmaIp; }
uint32_t zxnextGetDmaVector(void) { return dmaVector; }
uint32_t zxnextGetDmaAutoRestart(void) { return dmaAutoRestart; }
uint32_t zxnextGetDmaRawRegister(uint32_t index) { return index < DMA_RNUM_COUNT ? dmaRegs[index] : 0u; }
