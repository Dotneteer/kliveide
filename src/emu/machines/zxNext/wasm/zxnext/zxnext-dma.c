#include "zxnext-dma.h"
#include "zxnext-memory.h"

/*
 * zxnDMA / Z80 DMA for the WASM Next backend: a line-by-line port of DmaDevice.ts, which follows
 * `dev/vendor/next-fpga/3.02.01/src/device/dma.vhd` - see its header for the hardware notes. In short: clocked by
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
#define DMA_WR_DDMA 15 /* the follow bytes of a zxnDDMA command (3.03.00) */

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
/* A bus request the T80 sees only during the next instruction's first M-cycle: an enable from a CPU write
   (BUSRQ comes in the I/O cycle's T3, too late for that M-cycle) or the end of a DMA delay (the NMI's
   RETN). The grant comes at the end of that M1 (F3, INT-026 on the simulated core); Klive grants between
   instructions, so an instruction that is all M1 runs first, and a longer one after the transfer. An
   enable from outside the CPU (the host, a test harness) starts at once. */
static uint8_t dmaGrantAfterNextM1;
static uint8_t dmaWasDelayed;

// --- Register sequencers.
static uint8_t dmaWrSeq;
static uint8_t dmaRegTemp;
static uint8_t dmaRdSeq;

#if ZXNEXT_CORE_VERSION >= 30300
/*
 * The zxnDDMA of core 3.03.00: the DMA's extra commands on port $6B (`dev/plans/ZXNEXT_3_03_PLAN.md`
 * D-A). Its VHDL (new_dma.vhd) is not published: everything here is from the distribution's guide,
 * docs/zxnDDMA/zxnddma.gde@26.11 (2.5-2.9), and is marked VHDL-PENDING(3.03.03). Where the guide is
 * silent, the choice is written next to the code.
 */
#define DDMA_PHYSICAL 0x01u
#define DDMA_2D 0x02u
#define DDMA_TRANSPARENT 0x04u
#define DDMA_FILL 0x08u
#define DDMA_LAYER2_XY 0x10u
#define DDMA_HIDDEN 0x20u

/* $D7, $DB: address bits 23:16 of Port A and B (the start addresses' extension) */
static uint8_t dmaExtA;
static uint8_t dmaExtB;
/* $DF: the mode flags, all set by each $DF (2.5) */
static uint8_t dmaFlags;
/* $E3, $E7, $EB, $EF: row length, number of rows, Port A and Port B stride (2.5, "Rectangles") */
static uint16_t dmaRowLength;
static uint16_t dmaRowCount;
static uint16_t dmaStrideA;
static uint16_t dmaStrideB;
/* $F3, $F7 */
static uint8_t dmaTransparent;
static uint8_t dmaFill;
/* The working addresses' bits 23:16 (physical mode carries into them, 2.9 note 7) */
static uint8_t dmaSrcHi;
static uint8_t dmaDestHi;
/* The rectangle: the current row's start (24 bits) and the position in it */
static uint32_t dmaRowSrc;
static uint32_t dmaRowDest;
static uint16_t dmaRowByte;
static uint16_t dmaRow;
/* The command whose follow bytes are coming, and those bytes */
static uint8_t dmaXCmd;
static uint8_t dmaXCount;
static uint8_t dmaXIndex;
static uint8_t dmaXBytes[4]; /* $DF with X,Y: the flags, X_lo, X_hi, Y */
/*
 * The SRAM behind bank 5 (pages $0A-$0B) and page $0E, the first half of bank 7. Those pages are block RAM
 * inside the FPGA, which the MMU reaches (zxnext.vhd@3.02.04: mem_active_bank5, mem_active_bank7 = page
 * $0E only); the SRAM at their physical addresses is a separate store, which physical mode reaches ("a
 * physical transfer to their SRAM addresses does not reach the ULA screen", the guide's 2.5, which says
 * "banks 5 and 7" loosely: page $0F is ordinary SRAM). Klive keeps one copy of those pages elsewhere (the
 * core's README, "Banks 5 and 7 are one memory"), so this store is seen by physical mode only.
 */
#define DDMA_BANK5_PHYS 0x054000u
#define DDMA_PAGE0E_PHYS 0x05c000u
static uint8_t dmaSramBank57[0x6000];

static void zxnextDmaDdmaClear(void) {
  dmaExtA = 0;
  dmaExtB = 0;
  dmaFlags = 0;
  dmaRowLength = 0;
  dmaRowCount = 0;
  dmaStrideA = 0;
  dmaStrideB = 0;
  dmaTransparent = 0;
  dmaFill = 0;
}
#endif

/* reset_i: what the VHDL resets; start addresses, length, direction and address modes stay */
void zxnextDmaReset(void) {
  dmaMode = 0;
  dmaSeq = DMA_SEQ_IDLE;
  dmaCounter = 0;
  dmaBusRequested = 0;
  dmaBusAcknowledged = 0;
  dmaGrantAfterNextM1 = 0;
  dmaWasDelayed = 0;
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
#if ZXNEXT_CORE_VERSION >= 30300
  zxnextDmaDdmaClear();
  dmaXCmd = 0;
#endif
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
#if ZXNEXT_CORE_VERSION >= 30300
  /* $CF also loads the $D7 and $DB bytes (2.4); a rectangle starts at its first row */
  dmaSrcHi = dmaDirAtoB ? dmaExtA : dmaExtB;
  dmaDestHi = dmaDirAtoB ? dmaExtB : dmaExtA;
  dmaRowSrc = ((uint32_t)dmaSrcHi << 16) | dmaSrc;
  dmaRowDest = ((uint32_t)dmaDestHi << 16) | dmaDest;
  dmaRowByte = 0;
  dmaRow = 0;
#endif
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
#if ZXNEXT_CORE_VERSION >= 30300
      zxnextDmaDdmaClear(); /* 2.6: the flags, $D7/$DB, the rectangle, the colours */
#endif
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
      dmaGrantAfterNextM1 = zxnextCpuInInstruction;
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

#if ZXNEXT_CORE_VERSION >= 30300
/* The follow bytes of each zxnDDMA command (2.5); 0 for one the DMA takes alone */
static uint8_t zxnextDmaDdmaFollowBytes(uint8_t cmd) {
  switch (cmd) {
    case 0xd7u: case 0xdbu: case 0xdfu: case 0xf3u: case 0xf7u: return 1u;
    case 0xe3u: case 0xe7u: case 0xebu: case 0xefu: return 2u;
    default: return 0u;
  }
}

/*
 * $DF with bit 4: the Port B start address worked out from the Layer 2 screen (2.5, "Layer 2 X,Y"):
 * the bank from NextReg $12 ($13 with bit 5), the mode from NextReg $70 bits 5:4; it writes WR4's start
 * address and the $DB byte, and Port B's stride becomes 256. The bank is taken as 7 bits, as Layer 2's
 * own registers hold it (VHDL-PENDING(3.03.03)).
 */
static void zxnextDmaLayer2XY(uint8_t xLo, uint8_t xHi, uint8_t y) {
  const uint32_t bank = zxnextNextRegs[(dmaFlags & DDMA_HIDDEN) ? 0x13u : 0x12u] & 0x7fu;
  const uint32_t base = 0x40000u + bank * 0x4000u;
  const uint32_t mode = (zxnextNextRegs[0x70u] >> 4) & 0x03u;
  /* mode 00 adds X_lo only; the column modes use bit 0 of X_hi (a 9-bit column) */
  const uint32_t address = mode == 0u ? base + y * 256u + xLo : base + (((uint32_t)(xHi & 0x01u) << 8) | xLo) * 256u + y;
  dmaPortBStart = (uint16_t)(address & 0xffffu);
  dmaExtB = (uint8_t)(address >> 16);
  dmaStrideB = 256u;
}

/* A zxnDDMA command's follow byte has come; the last one applies the command */
static void zxnextDmaDdmaFollow(uint8_t d) {
  dmaXBytes[dmaXIndex++] = d;
  const uint16_t word = (uint16_t)(dmaXBytes[0] | ((uint16_t)d << 8));
  switch (dmaXCmd) {
    case 0xd7u: dmaExtA = d; break;
    case 0xdbu: dmaExtB = d; break;
    case 0xdfu:
      if (dmaXIndex == 1u) {
        dmaFlags = d & 0x3fu; /* bits 7:6: write 0 */
        if (dmaFlags & DDMA_LAYER2_XY) {
          dmaXCount = 4u; /* X_lo, X_hi, Y follow */
          return;
        }
        break;
      }
      if (dmaXIndex < dmaXCount) return;
      zxnextDmaLayer2XY(dmaXBytes[1], dmaXBytes[2], d);
      break;
    case 0xe3u: if (dmaXIndex < 2u) return; dmaRowLength = word; break;
    case 0xe7u: if (dmaXIndex < 2u) return; dmaRowCount = word; break;
    case 0xebu: if (dmaXIndex < 2u) return; dmaStrideA = word; break;
    case 0xefu: if (dmaXIndex < 2u) return; dmaStrideB = word; break;
    case 0xf3u: dmaTransparent = d; break;
    default: dmaFill = d; break; /* $F7 */
  }
  dmaWrSeq = DMA_WR_IDLE;
}

/*
 * A zxnDDMA command byte on port $6B (2.5): its follow bytes come next. On port $0B these bytes are
 * WR6 commands the DMA does not know (zxnextDmaCommand ignores them, and their follow bytes are
 * decoded as base bytes), as on every earlier core. $FB is commented out in new_dma.vhd: ignored.
 */
static uint32_t zxnextDmaDdmaCommand(uint8_t d) {
  const uint8_t follow = zxnextDmaDdmaFollowBytes(d);
  if (dmaMode != 0u || follow == 0u) return 0u;
  dmaXCmd = d;
  dmaXCount = follow;
  dmaXIndex = 0;
  dmaWrSeq = DMA_WR_DDMA;
  return 1u;
}
#endif

/* A base byte: WR0 - WR6 decoded as in the IDLE branch of dma.vhd */
static void zxnextDmaWriteBase(uint8_t d) {
#if ZXNEXT_CORE_VERSION >= 30300
  if (zxnextDmaDdmaCommand(d)) return;
#endif
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
#if ZXNEXT_CORE_VERSION >= 30300
    case DMA_WR_DDMA:
      zxnextDmaDdmaFollow(d);
      return;
#endif
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

#if ZXNEXT_CORE_VERSION >= 30300
/*
 * A physical address as the SRAM sees it (2.5, 2.9 note 5): bits 5:0 of the extended byte and the 16-bit
 * address, 22 bits; a board without address bit 21 (before issue 5, zxnext.vhd@3.02.04 ~1763-1777)
 * drops it too, so higher addresses wrap.
 */
static inline uint32_t zxnextDmaPhysicalAddress(uint8_t hi, uint16_t lo) {
  return (((uint32_t)hi << 16) | lo) & 0x3fffffu & (ZXNEXT_SRAM_SIZE - 1u);
}

static inline uint32_t zxnextDmaInBank57(uint32_t physical) {
  return (physical & ~0x3fffu) == DDMA_BANK5_PHYS || (physical & ~0x1fffu) == DDMA_PAGE0E_PHYS;
}

static inline uint32_t zxnextDmaBank57Index(uint32_t physical) {
  /* bank 5 at 0-$3FFF, page $0E at $4000-$5FFF */
  return (physical & ~0x1fffu) == DDMA_PAGE0E_PHYS ? 0x4000u | (physical & 0x1fffu) : (physical & 0x3fffu);
}

/* Physical mode reads the SRAM only, never the block RAM (2.5) */
static uint8_t zxnextDmaReadPhysical(uint8_t hi, uint16_t lo) {
  const uint32_t physical = zxnextDmaPhysicalAddress(hi, lo);
  if (zxnextDmaInBank57(physical)) return dmaSramBank57[zxnextDmaBank57Index(physical)];
  return (uint8_t)zxnextMemoryReadPhysical(zxnextSramOffset(physical));
}

static void zxnextDmaWritePhysical(uint8_t hi, uint16_t lo, uint8_t value) {
  const uint32_t physical = zxnextDmaPhysicalAddress(hi, lo);
  if (zxnextDmaInBank57(physical)) {
    dmaSramBank57[zxnextDmaBank57Index(physical)] = value;
    return;
  }
  const uint32_t offset = zxnextSramOffset(physical);
  /* Layer 2 is read from the SRAM: a mid-frame write renders what the beam has finished first */
  if (offset < ZXNEXT_ERR_PAGE_OFFSET) zxnextRasterMemoryWrite(offset, value);
  zxnextMemoryWritePhysical(offset, value);
}

/* An address step; in physical mode it carries into (or borrows from) bits 23:16 (2.9 note 7) */
static inline void zxnextDmaStepAddress24(uint16_t* lo, uint8_t* hi, uint8_t mode) {
  const uint16_t before = *lo;
  *lo = zxnextDmaStepAddress(before, mode);
  if (!(dmaFlags & DDMA_PHYSICAL)) return;
  if (mode == DMA_ADDR_INCREMENT && *lo == 0u) *hi = (uint8_t)(*hi + 1u);
  if (mode == DMA_ADDR_DECREMENT && before == 0u) *hi = (uint8_t)(*hi - 1u);
}

/*
 * After a byte in 2D mode: the next byte of the row, or the next row's start, the stride added to the
 * row's 24-bit start (2.5, "Rectangles"). A row length or number of rows of 0 still moves one byte.
 * The byte counter goes on counting bytes (the guide does not say what it reads in 2D mode).
 */
static void zxnextDmaNext2D(void) {
  const uint16_t rowLength = dmaRowLength ? dmaRowLength : 1u;
  if (++dmaRowByte < rowLength) return;
  dmaRowByte = 0;
  dmaRow++;
  const uint16_t strideSrc = dmaDirAtoB ? dmaStrideA : dmaStrideB;
  const uint16_t strideDest = dmaDirAtoB ? dmaStrideB : dmaStrideA;
  const uint32_t mask = (dmaFlags & DDMA_PHYSICAL) ? 0xffffffu : 0xffffu;
  dmaRowSrc = (dmaRowSrc & ~mask) | ((dmaRowSrc + strideSrc) & mask);
  dmaRowDest = (dmaRowDest & ~mask) | ((dmaRowDest + strideDest) & mask);
  dmaSrc = (uint16_t)dmaRowSrc;
  dmaSrcHi = (uint8_t)(dmaRowSrc >> 16);
  dmaDest = (uint16_t)dmaRowDest;
  dmaDestHi = (uint8_t)(dmaRowDest >> 16);
}
#endif

/* Whether the block has more bytes: the counter against the length, or (2D) the rows left */
static inline uint32_t zxnextDmaMore(void) {
#if ZXNEXT_CORE_VERSION >= 30300
  if (dmaFlags & DDMA_2D) return dmaRow < (dmaRowCount ? dmaRowCount : 1u);
#endif
  return dmaCounter < dmaBlockLength;
}

/*
 * FINISH_DMA: end of block; auto restart reloads and goes on - keeping the bus when it has it
 * (WAITING_ACK, one more clock) - otherwise the DMA goes idle. Returns the extra CPU clocks held.
 *
 * Going idle with the bus, the CPU waits 3 more clocks before its next T1: IDLE raises BUSRQ (dma.vhd),
 * the T80 samples it into BusReq_s, and the next clock drops BUSAK and starts T1 (t80n.vhd ~1640-1730).
 * Measured on the simulated core: 4 clocks from the last write clock to the CPU's T1 (F3-6).
 */
#define DMA_BUS_RELEASE_CLOCKS 3u
static uint32_t zxnextDmaFinish(uint32_t busHeld) {
  dmaEndOfBlockN = 0;
  if (!dmaAutoRestart) {
    zxnextDmaGoIdle();
    return busHeld ? DMA_BUS_RELEASE_CLOCKS : 0u;
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

#if ZXNEXT_CORE_VERSION >= 30300
  const uint32_t physical = (dmaFlags & DDMA_PHYSICAL) != 0u;
  uint8_t value;
  uint32_t clocks;
  if (dmaFlags & DDMA_FILL) {
    // --- fill: no read cycle, the $F7 value (2.5: twice as fast as a fixed source)
    value = dmaFill;
    clocks = 0u;
  } else {
    value = (uint8_t)(srcIo ? zxnextPortsRead(dmaSrc)
      : physical ? zxnextDmaReadPhysical(dmaSrcHi, dmaSrc) : zxnextMemoryReadMapped(dmaSrc));
    clocks = zxnextDmaCycleClocks(srcIsA ? dmaPortATiming : dmaPortBTiming);
    /* No sram_wait_n at 28 MHz: core 3.03 has zero wait states (zxnextCpuDelayMemoryRead) */
    if (srcIo && (dmaSrc & 0xffu) == DMA_SPI_DATA_PORT) clocks += DMA_SPI_WAIT_CLOCKS;
  }

  // --- write cycle; a transparent byte is not written, its cycle is still taken (the guide is silent)
  if ((dmaFlags & DDMA_TRANSPARENT) && value == dmaTransparent) {
    /* not written */
  } else if (!destIo && physical) {
    zxnextDmaWritePhysical(dmaDestHi, dmaDest, value);
  } else
#else
  // --- read cycle
  const uint8_t value = (uint8_t)(srcIo ? zxnextPortsRead(dmaSrc) : zxnextMemoryReadMapped(dmaSrc));
  uint32_t clocks = zxnextDmaCycleClocks(srcIsA ? dmaPortATiming : dmaPortBTiming);
  if (srcIo) {
    if ((dmaSrc & 0xffu) == DMA_SPI_DATA_PORT) clocks += DMA_SPI_WAIT_CLOCKS;
  } else if (scale == 1u && zxnextMemoryGetPageBank8((dmaSrc >> 13) & 0x07u) != 0x0eu) {
    clocks += 1u; // sram_wait_n at 28 MHz
  }

  // --- write cycle
#endif
  if (destIo) {
    /* Labelled so a sprite-attribute breakpoint can say the DMA wrote port $57 (or a NextReg mirror) */
    zxnextSpriteWriteFromDma = 1u;
    zxnextPortsWrite(dmaDest, value);
    zxnextSpriteWriteFromDma = 0u;
  } else {
    zxnextMemoryWriteMapped(dmaDest, value);
  }
  clocks += zxnextDmaCycleClocks(srcIsA ? dmaPortBTiming : dmaPortATiming);
  if (destIo && (dmaDest & 0xffu) == DMA_SPI_DATA_PORT) clocks += DMA_SPI_WAIT_CLOCKS;

  // --- TRANSFERING_WRITE_1: counter and addresses
  dmaCounter = (uint16_t)(dmaCounter + 1u);
#if ZXNEXT_CORE_VERSION >= 30300
  zxnextDmaStepAddress24(&dmaSrc, &dmaSrcHi, srcIsA ? dmaPortAAddrMode : dmaPortBAddrMode);
  zxnextDmaStepAddress24(&dmaDest, &dmaDestHi, srcIsA ? dmaPortBAddrMode : dmaPortAAddrMode);
  if (dmaFlags & DDMA_2D) zxnextDmaNext2D();
#else
  dmaSrc = zxnextDmaStepAddress(dmaSrc, srcIsA ? dmaPortAAddrMode : dmaPortBAddrMode);
  dmaDest = zxnextDmaStepAddress(dmaDest, srcIsA ? dmaPortBAddrMode : dmaPortAAddrMode);
#endif
  dmaAtLeastOne = 1;

  // --- TRANSFERING_WRITE_4, the byte's last clock (`clocks - 1`, READ_1 being clock 0). READ_1 zeroes
  // --- the timer and every later clock adds `scale`, so a clock j sees (j - 1) x scale (dma.vhd ~245-255)
  const uint32_t more = zxnextDmaMore();
  if (dmaPrescaler > 0u && dmaPrescaler > (((clocks - 2u) * scale) >> 5)) {
    // --- WAITING_CYCLES until timer / 32 >= prescaler: the first clock j with (j - 1) x scale >= 32 x
    // --- prescaler leaves it (measured on the simulated core: 403 clocks a byte for prescaler 100, F3)
    const uint32_t exitClock = (32u * dmaPrescaler + scale - 1u) / scale + 1u;
    if (dmaTransferMode == DMA_MODE_BURST) {
      // --- the bus goes back at the end of the first waiting clock: the T80 samples BUSRQ and drops BUSAK
      // --- two clocks later (t80n.vhd ~1640-1730), so the CPU stays held for those three. START_DMA lowers BUSRQ on
      // --- the clock after the exit; the T80 registers it on the next and grants at an M-cycle end after
      // --- that: from READ_1 + exitClock + 4 (measured on the simulated core, F3)
      dmaSeq = DMA_SEQ_BURST_WAIT;
      dmaBusRequested = 0;
      dmaBusAcknowledged = 0;
      dmaReadyAt = zxnextDmaSysTact() + (uint64_t)(exitClock + 4u) * scale;
      return (clocks + 3u) * scale;
    }
    // --- held: WAITING_CYCLES, then WAITING_ACK (more) or FINISH_DMA
    const uint32_t held = exitClock + 2u;
    if (!more) return (held + zxnextDmaFinish(1u)) * scale;
    return held * scale;
  }
  if (more) {
    if (zxnextDmaDelayed()) {
      /* START_DMA raises BUSRQ at the end of its clock; the T80 samples it and drops BUSAK two clocks
         later, so the CPU stays held for those three (as for a burst release; INT-026 on the simulated core) */
      dmaSeq = DMA_SEQ_START;
      dmaBusRequested = 0;
      dmaBusAcknowledged = 0;
      return (clocks + 3u) * scale;
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
        dmaWasDelayed = 1u;
        return 0;
      }
      if (dmaWasDelayed) {
        /* the delay ended with the instruction before: START_DMA requests now, seen in the next M1 */
        dmaWasDelayed = 0u;
        dmaGrantAfterNextM1 = 1u;
        dmaBusRequested = 1;
        return 0;
      }
      if (!dmaBusAcknowledged) {
        dmaBusRequested = 1;
        return 0;
      }
      // --- WAITING_ACK: START_DMA raised BUSRQ while the CPU still ran; the clock after the grant
      // --- sees BUSAK and starts the read (measured on the simulated core, F3-6)
      dmaSeq = DMA_SEQ_TRANSFER;
      return 1u * zxnextDmaClockScale();
    case DMA_SEQ_TRANSFER:
      return zxnextDmaTransferByte();
    case DMA_SEQ_BURST_WAIT:
      if (zxnextDmaSysTact() < dmaReadyAt) return 0;
      if (zxnextDmaMore()) {
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
