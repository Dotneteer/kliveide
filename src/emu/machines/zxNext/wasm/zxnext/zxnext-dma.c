#include "zxnext-dma.h"
#include "zxnext-memory.h"

/*
 * zxnDMA / Z80 DMA for the WASM Next backend: a line-by-line port of DmaDevice.ts, which follows
 * `_input/next-fpga/src/device/dma.vhd` - see its header for the hardware notes. In short: clocked by
 * the CPU clock (6 CPU clocks a byte by default), the counter counts from 0 (zxnDMA, $6B) or $FFFF
 * (Z80 DMA, $0B) and the transfer goes on while counter < length, the prescaler counts 28 MHz time
 * (32 x prescaler clocks of 28 MHz per byte), burst mode frees the bus while it waits, byte mode is
 * continuous, and there is no search, no interrupt and no mask/match.
 *
 * The CPU loop drives it through zxnextCpuRunDma() (zxnext-cpu.c), the equivalent of
 * ZxNextMachine.runDmaUntilCpuCanRun(): before every instruction it steps the DMA while the DMA holds
 * or requests the bus, and charges each step's 28 MHz clocks to the frame.
 */

static uint32_t zxnextPortsRead(uint32_t address);
static void zxnextPortsWrite(uint32_t address, uint32_t value);

// --- Transfer state machine (DmaSeq).
#define DMA_SEQ_IDLE 0
#define DMA_SEQ_START 1
#define DMA_SEQ_TRANSFER 2
#define DMA_SEQ_BURST_WAIT 3

// --- reg_wr_seq_s.
#define DMA_WR_IDLE 0
#define DMA_WR_R0_BYTE_0 1
#define DMA_WR_R0_BYTE_1 2
#define DMA_WR_R0_BYTE_2 3
#define DMA_WR_R0_BYTE_3 4
#define DMA_WR_R1_BYTE_0 5
#define DMA_WR_R1_BYTE_1 6
#define DMA_WR_R2_BYTE_0 7
#define DMA_WR_R2_BYTE_1 8
#define DMA_WR_R3_BYTE_0 9
#define DMA_WR_R3_BYTE_1 10
#define DMA_WR_R4_BYTE_0 11
#define DMA_WR_R4_BYTE_1 12
#define DMA_WR_R4_BYTE_2 13 /* no handler in dma.vhd: deaf until reset */
#define DMA_WR_R6_BYTE_0 14

// --- reg_rd_seq_s, numbered as the read mask bits.
#define DMA_RD_STATUS 0
#define DMA_RD_COUNTER_LO 1
#define DMA_RD_COUNTER_HI 2
#define DMA_RD_PORT_A_LO 3
#define DMA_RD_PORT_A_HI 4
#define DMA_RD_PORT_B_LO 5
#define DMA_RD_PORT_B_HI 6

#define DMA_ADDR_DECREMENT 0
#define DMA_ADDR_INCREMENT 1
#define DMA_MODE_BURST 2
#define DMA_SPI_DATA_PORT 0xebu
#define DMA_SPI_WAIT_CLOCKS 16u

// --- dma_mode: 0 = zxnDMA ($6B), 1 = Z80 DMA ($0B).
static uint8_t dmaMode;

// --- WR0 - WR6.
static uint8_t dmaDirAtoB = 1;
static uint16_t dmaPortAStart;
static uint16_t dmaBlockLength;
static uint8_t dmaPortAIsIo;
static uint8_t dmaPortAAddrMode = DMA_ADDR_INCREMENT;
static uint8_t dmaPortATiming = 1;
static uint8_t dmaPortBIsIo;
static uint8_t dmaPortBAddrMode = DMA_ADDR_INCREMENT;
static uint8_t dmaPortBTiming = 1;
static uint8_t dmaPrescaler;
static uint8_t dmaTransferMode = 1;
static uint16_t dmaPortBStart;
static uint8_t dmaAutoRestart;
static uint8_t dmaReadMask = 0x7f;

// --- Transfer state.
static uint16_t dmaSrc;
static uint16_t dmaDest;
static uint16_t dmaCounter;
static uint8_t dmaEndOfBlockN = 1;
static uint8_t dmaAtLeastOne;
static uint8_t dmaSeq;
static uint64_t dmaReadyAt;

// --- Bus.
static uint8_t dmaBusRequested;
static uint8_t dmaBusAcknowledged;

// --- Register sequencers.
static uint8_t dmaWrSeq;
static uint8_t dmaRegTemp;
static uint8_t dmaRdSeq;

/* reset_i: what the VHDL resets; start addresses, length, direction and address modes stay */
void zxnextDmaReset(void) {
  dmaMode = 0;
  dmaSeq = DMA_SEQ_IDLE;
  dmaCounter = 0;
  dmaBusRequested = 0;
  dmaBusAcknowledged = 0;
  dmaWrSeq = DMA_WR_IDLE;
  dmaPortATiming = 1;
  dmaPortBTiming = 1;
  dmaPrescaler = 0;
  dmaTransferMode = 1;
  dmaAutoRestart = 0;
  dmaReadMask = 0x7f;
  dmaAtLeastOne = 0;
  dmaEndOfBlockN = 1;
  dmaRdSeq = DMA_RD_STATUS;
  dmaReadyAt = 0;
}

void zxnextDmaSetMode(uint32_t mode) { dmaMode = mode & 1u; }

// --- The 28 MHz system clock.
static inline uint64_t zxnextDmaSysTact(void) {
  return (uint64_t)frames * ZXNEXT_TACTS_IN_FRAME + frameTacts28;
}

/* 28 MHz clocks per CPU clock, and the prescaler timer's increment: 8 / 4 / 2 / 1 */
static inline uint32_t zxnextDmaClockScale(void) { return 8u >> (cpuEffectiveSpeed & 0x03u); }

/* im2_dma_delay: an interrupt enabled for the DMA is pending or in service */
static inline uint32_t zxnextDmaDelayed(void) { return zxnextInterruptsDmaRequestActive(); }

/* IDLE: the bus goes back and status_atleastone is cleared */
static void zxnextDmaGoIdle(void) {
  dmaSeq = DMA_SEQ_IDLE;
  dmaAtLeastOne = 0;
  dmaBusRequested = 0;
  dmaBusAcknowledged = 0;
}

static void zxnextDmaLoadAddresses(void) {
  dmaSrc = dmaDirAtoB ? dmaPortAStart : dmaPortBStart;
  dmaDest = dmaDirAtoB ? dmaPortBStart : dmaPortAStart;
}

static inline uint16_t zxnextDmaCounterStart(void) { return dmaMode ? 0xffffu : 0u; }

/* The first entry enabled in the read mask, or the status */
static uint8_t zxnextDmaFirstReadEntry(void) {
  for (uint32_t i = 0; i < 7u; i++) {
    if (dmaReadMask & (1u << i)) return (uint8_t)i;
  }
  return DMA_RD_STATUS;
}

/* The next enabled entry after `from`, cyclically; the status when none is */
static uint8_t zxnextDmaNextReadEntry(uint8_t from) {
  for (uint32_t k = 1; k <= 7u; k++) {
    uint32_t i = (from + k) % 7u;
    if (dmaReadMask & (1u << i)) return (uint8_t)i;
  }
  return DMA_RD_STATUS;
}

// ============================================================================
// Register writes (dma.vhd reg_wr_seq_s)
// ============================================================================

static void zxnextDmaCommand(uint8_t d) {
  switch (d) {
    case 0xc3u: // reset
      zxnextDmaGoIdle();
      dmaEndOfBlockN = 1;
      dmaPortATiming = 1;
      dmaPortBTiming = 1;
      dmaPrescaler = 0;
      dmaAutoRestart = 0;
      break;
    case 0xc7u:
      dmaPortATiming = 1;
      break;
    case 0xcbu:
      dmaPortBTiming = 1;
      break;
    case 0xcfu: // load
      dmaEndOfBlockN = 1;
      zxnextDmaLoadAddresses();
      dmaCounter = zxnextDmaCounterStart();
      break;
    case 0xd3u: // continue
      dmaEndOfBlockN = 1;
      dmaCounter = zxnextDmaCounterStart();
      break;
    case 0xbfu:
      dmaRdSeq = DMA_RD_STATUS;
      break;
    case 0x8bu:
      dmaEndOfBlockN = 1;
      dmaAtLeastOne = 0;
      break;
    case 0xa7u:
      dmaRdSeq = zxnextDmaFirstReadEntry();
      break;
    case 0x87u:
      dmaSeq = DMA_SEQ_START;
      break;
    case 0x83u:
      zxnextDmaGoIdle();
      break;
    case 0xbbu:
      dmaWrSeq = DMA_WR_R6_BYTE_0;
      break;
    default: // $AF, $AB, $A3, $B7, $B3 and the rest: nothing
      break;
  }
}

/* A base byte: WR0 - WR6 decoded as in the IDLE branch of dma.vhd */
static void zxnextDmaWriteBase(uint8_t d) {
  if ((d & 0x80u) == 0) {
    if (d & 0x03u) {
      // --- WR0
      dmaRegTemp = d;
      dmaDirAtoB = (d & 0x04u) != 0;
      dmaWrSeq = (d & 0x08u) ? DMA_WR_R0_BYTE_0 : (d & 0x10u) ? DMA_WR_R0_BYTE_1 : (d & 0x20u) ? DMA_WR_R0_BYTE_2 :
        (d & 0x40u) ? DMA_WR_R0_BYTE_3 : DMA_WR_IDLE;
    } else if ((d & 0x07u) == 0x04u) {
      // --- WR1
      dmaRegTemp = d;
      dmaPortAIsIo = (d & 0x08u) != 0;
      dmaPortAAddrMode = (d >> 4) & 0x03u;
      dmaWrSeq = (d & 0x40u) ? DMA_WR_R1_BYTE_0 : DMA_WR_IDLE;
    } else if ((d & 0x07u) == 0x00u) {
      // --- WR2
      dmaRegTemp = d;
      dmaPortBIsIo = (d & 0x08u) != 0;
      dmaPortBAddrMode = (d >> 4) & 0x03u;
      dmaWrSeq = (d & 0x40u) ? DMA_WR_R2_BYTE_0 : DMA_WR_IDLE;
    }
    return;
  }
  switch (d & 0x03u) {
    case 0x00u: // WR3
      dmaRegTemp = d;
      if (d & 0x40u) dmaSeq = DMA_SEQ_START;
      dmaWrSeq = (d & 0x08u) ? DMA_WR_R3_BYTE_0 : (d & 0x10u) ? DMA_WR_R3_BYTE_1 : DMA_WR_IDLE;
      return;
    case 0x01u: // WR4
      dmaRegTemp = d;
      dmaTransferMode = (d >> 5) & 0x03u;
      dmaWrSeq = (d & 0x04u) ? DMA_WR_R4_BYTE_0 : (d & 0x08u) ? DMA_WR_R4_BYTE_1 : (d & 0x10u) ? DMA_WR_R4_BYTE_2 : DMA_WR_IDLE;
      return;
    case 0x02u: // WR5 (D7-D6 = 10, D2-D0 = 010)
      if ((d & 0xc7u) == 0x82u) {
        dmaRegTemp = d;
        dmaAutoRestart = (d & 0x20u) != 0;
        dmaWrSeq = DMA_WR_IDLE;
      }
      return;
    default: // WR6
      dmaRegTemp = d;
      dmaWrSeq = DMA_WR_IDLE;
      zxnextDmaCommand(d);
      return;
  }
}

void zxnextDmaWritePort(uint32_t value) {
  uint8_t d = value & 0xffu;
  switch (dmaWrSeq) {
    case DMA_WR_IDLE:
      zxnextDmaWriteBase(d);
      return;
    case DMA_WR_R0_BYTE_0:
      dmaPortAStart = (uint16_t)((dmaPortAStart & 0xff00u) | d);
      dmaWrSeq = (dmaRegTemp & 0x10u) ? DMA_WR_R0_BYTE_1 : (dmaRegTemp & 0x20u) ? DMA_WR_R0_BYTE_2 :
        (dmaRegTemp & 0x40u) ? DMA_WR_R0_BYTE_3 : DMA_WR_IDLE;
      return;
    case DMA_WR_R0_BYTE_1:
      dmaPortAStart = (uint16_t)((dmaPortAStart & 0x00ffu) | ((uint16_t)d << 8));
      dmaWrSeq = (dmaRegTemp & 0x20u) ? DMA_WR_R0_BYTE_2 : (dmaRegTemp & 0x40u) ? DMA_WR_R0_BYTE_3 : DMA_WR_IDLE;
      return;
    case DMA_WR_R0_BYTE_2:
      dmaBlockLength = (uint16_t)((dmaBlockLength & 0xff00u) | d);
      dmaWrSeq = (dmaRegTemp & 0x40u) ? DMA_WR_R0_BYTE_3 : DMA_WR_IDLE;
      return;
    case DMA_WR_R0_BYTE_3:
      dmaBlockLength = (uint16_t)((dmaBlockLength & 0x00ffu) | ((uint16_t)d << 8));
      dmaWrSeq = DMA_WR_IDLE;
      return;
    case DMA_WR_R1_BYTE_0:
      dmaPortATiming = d & 0x03u;
      dmaWrSeq = (d & 0x20u) ? DMA_WR_R1_BYTE_1 : DMA_WR_IDLE;
      return;
    case DMA_WR_R1_BYTE_1: // port A has no prescaler: swallowed
      dmaWrSeq = DMA_WR_IDLE;
      return;
    case DMA_WR_R2_BYTE_0:
      dmaPortBTiming = d & 0x03u;
      dmaWrSeq = (d & 0x20u) ? DMA_WR_R2_BYTE_1 : DMA_WR_IDLE;
      return;
    case DMA_WR_R2_BYTE_1:
      dmaPrescaler = d;
      dmaWrSeq = DMA_WR_IDLE;
      return;
    case DMA_WR_R3_BYTE_0: // mask: not implemented
      dmaWrSeq = (dmaRegTemp & 0x10u) ? DMA_WR_R3_BYTE_1 : DMA_WR_IDLE;
      return;
    case DMA_WR_R3_BYTE_1: // match: not implemented
      dmaWrSeq = DMA_WR_IDLE;
      return;
    case DMA_WR_R4_BYTE_0:
      dmaPortBStart = (uint16_t)((dmaPortBStart & 0xff00u) | d);
      dmaWrSeq = (dmaRegTemp & 0x08u) ? DMA_WR_R4_BYTE_1 : DMA_WR_IDLE;
      return;
    case DMA_WR_R4_BYTE_1:
      dmaPortBStart = (uint16_t)((dmaPortBStart & 0x00ffu) | ((uint16_t)d << 8));
      dmaWrSeq = DMA_WR_IDLE;
      return;
    case DMA_WR_R6_BYTE_0:
      dmaReadMask = d;
      dmaRdSeq = zxnextDmaFirstReadEntry();
      dmaWrSeq = DMA_WR_IDLE;
      return;
    default: // R4_BYTE_2 (`when others => null`): deaf until reset
      return;
  }
}

// ============================================================================
// Read sequence
// ============================================================================

uint32_t zxnextDmaReadStatusByte(void) {
  uint32_t value;
  const uint16_t portA = dmaDirAtoB ? dmaSrc : dmaDest;
  const uint16_t portB = dmaDirAtoB ? dmaDest : dmaSrc;
  switch (dmaRdSeq) {
    case DMA_RD_STATUS: value = 0x1au | (dmaEndOfBlockN ? 0x20u : 0u) | (dmaAtLeastOne ? 0x01u : 0u); break;
    case DMA_RD_COUNTER_LO: value = dmaCounter & 0xffu; break;
    case DMA_RD_COUNTER_HI: value = dmaCounter >> 8; break;
    case DMA_RD_PORT_A_LO: value = portA & 0xffu; break;
    case DMA_RD_PORT_A_HI: value = portA >> 8; break;
    case DMA_RD_PORT_B_LO: value = portB & 0xffu; break;
    default: value = portB >> 8; break;
  }
  dmaRdSeq = zxnextDmaNextReadEntry(dmaRdSeq);
  return value;
}

// ============================================================================
// Transfer
// ============================================================================

/* Timing byte D1-D0: 00 and 11 = 4 clocks, 01 = 3, 10 = 2 */
static inline uint32_t zxnextDmaCycleClocks(uint8_t timing) {
  return timing == 1u ? 3u : timing == 2u ? 2u : 4u;
}

static inline uint16_t zxnextDmaStepAddress(uint16_t address, uint8_t mode) {
  if (mode == DMA_ADDR_INCREMENT) return (uint16_t)(address + 1u);
  if (mode == DMA_ADDR_DECREMENT) return (uint16_t)(address - 1u);
  return address;
}

/*
 * FINISH_DMA: end of block; auto restart reloads and goes on - keeping the bus when it has it
 * (WAITING_ACK, one more clock) - otherwise the DMA goes idle. Returns the extra CPU clocks held.
 */
static uint32_t zxnextDmaFinish(uint32_t busHeld) {
  dmaEndOfBlockN = 0;
  if (!dmaAutoRestart) {
    zxnextDmaGoIdle();
    return 0;
  }
  zxnextDmaLoadAddresses();
  dmaCounter = zxnextDmaCounterStart();
  if (busHeld) {
    dmaSeq = DMA_SEQ_TRANSFER;
    return 1u;
  }
  dmaSeq = DMA_SEQ_START;
  dmaBusRequested = 1;
  dmaBusAcknowledged = 0;
  return 0;
}

/* One byte from TRANSFERING_READ_1 to the state after TRANSFERING_WRITE_4; returns 28 MHz clocks held */
static uint32_t zxnextDmaTransferByte(void) {
  const uint8_t srcIsA = dmaDirAtoB;
  const uint8_t srcIo = srcIsA ? dmaPortAIsIo : dmaPortBIsIo;
  const uint8_t destIo = srcIsA ? dmaPortBIsIo : dmaPortAIsIo;
  const uint32_t scale = zxnextDmaClockScale();

  // --- read cycle
  const uint8_t value = (uint8_t)(srcIo ? zxnextPortsRead(dmaSrc) : zxnextMemoryReadMapped(dmaSrc));
  uint32_t clocks = zxnextDmaCycleClocks(srcIsA ? dmaPortATiming : dmaPortBTiming);
  if (srcIo) {
    if ((dmaSrc & 0xffu) == DMA_SPI_DATA_PORT) clocks += DMA_SPI_WAIT_CLOCKS;
  } else if (scale == 1u && zxnextMemoryGetPageBank8((dmaSrc >> 13) & 0x07u) != 0x0eu) {
    clocks += 1u; // sram_wait_n at 28 MHz
  }

  // --- write cycle
  if (destIo) zxnextPortsWrite(dmaDest, value);
  else zxnextMemoryWriteMapped(dmaDest, value);
  clocks += zxnextDmaCycleClocks(srcIsA ? dmaPortBTiming : dmaPortATiming);
  if (destIo && (dmaDest & 0xffu) == DMA_SPI_DATA_PORT) clocks += DMA_SPI_WAIT_CLOCKS;

  // --- TRANSFERING_WRITE_1: counter and addresses
  dmaCounter = (uint16_t)(dmaCounter + 1u);
  dmaSrc = zxnextDmaStepAddress(dmaSrc, srcIsA ? dmaPortAAddrMode : dmaPortBAddrMode);
  dmaDest = zxnextDmaStepAddress(dmaDest, srcIsA ? dmaPortBAddrMode : dmaPortAAddrMode);
  dmaAtLeastOne = 1;

  // --- TRANSFERING_WRITE_4: the timer has counted `clocks - 1` CPU clocks in 28 MHz units
  const uint32_t more = dmaCounter < dmaBlockLength;
  if (dmaPrescaler > 0u && dmaPrescaler > (((clocks - 1u) * scale) >> 5)) {
    // --- WAITING_CYCLES until timer / 32 >= prescaler
    const uint32_t exitClock = (32u * dmaPrescaler + scale - 1u) / scale;
    if (dmaTransferMode == DMA_MODE_BURST) {
      // --- the bus is free while it waits; the byte's clocks are charged after this step
      dmaSeq = DMA_SEQ_BURST_WAIT;
      dmaBusRequested = 0;
      dmaBusAcknowledged = 0;
      dmaReadyAt = zxnextDmaSysTact() + (uint64_t)(exitClock + 1u) * scale;
      return clocks * scale;
    }
    // --- held: WAITING_CYCLES, then WAITING_ACK (more) or FINISH_DMA
    const uint32_t held = exitClock + 2u;
    if (!more) return (held + zxnextDmaFinish(1u)) * scale;
    return held * scale;
  }
  if (more) {
    if (zxnextDmaDelayed()) {
      dmaSeq = DMA_SEQ_START;
      dmaBusRequested = 0;
      dmaBusAcknowledged = 0;
    }
    return clocks * scale;
  }
  // --- FINISH_DMA
  return (clocks + 1u + zxnextDmaFinish(1u)) * scale;
}

/*
 * Advances the transfer (DmaDevice.stepDma). Returns the 28 MHz clocks the DMA held the bus for:
 * 0 when it is waiting, idle, or needs the bus (dmaBusRequested says which).
 */
static uint32_t zxnextDmaStep(void) {
  switch (dmaSeq) {
    case DMA_SEQ_START:
      if (zxnextDmaDelayed()) {
        dmaBusRequested = 0;
        dmaBusAcknowledged = 0;
        return 0;
      }
      if (!dmaBusAcknowledged) {
        dmaBusRequested = 1;
        return 0;
      }
      // --- START_DMA, WAITING_ACK
      dmaSeq = DMA_SEQ_TRANSFER;
      return 2u * zxnextDmaClockScale();
    case DMA_SEQ_TRANSFER:
      return zxnextDmaTransferByte();
    case DMA_SEQ_BURST_WAIT:
      if (zxnextDmaSysTact() < dmaReadyAt) return 0;
      if (dmaCounter < dmaBlockLength) {
        dmaSeq = DMA_SEQ_START;
        dmaBusRequested = 1;
        dmaBusAcknowledged = 0;
      } else {
        zxnextDmaFinish(0u);
      }
      return 0;
    default:
      return 0;
  }
}

static inline uint32_t zxnextDmaBusRequested(void) { return dmaBusRequested; }

static inline void zxnextDmaAcknowledgeBusIfRequested(void) {
  if (dmaBusRequested) dmaBusAcknowledged = 1;
}

static inline uint32_t zxnextDmaIsActive(void) { return dmaSeq != DMA_SEQ_IDLE || dmaBusRequested; }

/* The DMA raises no interrupts (dma.vhd has none) */
static inline uint32_t zxnextDmaGetIpSignal(void) { return 0; }

uint32_t zxnextGetDmaMode(void) { return dmaMode; }
uint32_t zxnextGetDmaSeq(void) { return dmaSeq; }
uint32_t zxnextGetDmaByteCounter(void) { return dmaCounter; }
uint32_t zxnextGetDmaAddressA(void) { return dmaDirAtoB ? dmaSrc : dmaDest; }
uint32_t zxnextGetDmaAddressB(void) { return dmaDirAtoB ? dmaDest : dmaSrc; }
