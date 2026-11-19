#include "zxnext-interrupts.h"
#include "zxnext-nmi.h"

#define ZXNEXT_DAISY_DEVICE_COUNT 14u
#define ZXNEXT_INT_LINE 0u
#define ZXNEXT_INT_CTC0 3u
#define ZXNEXT_INT_ULA 11u

/* Defined later in the unity build (z80.c through zxnext-cpu.c, zxnext-ctc.c). */
uint32_t z80GetTacts(void);
uint32_t z80GetInterruptMode(void);
uint32_t z80GetIff1(void);
uint32_t z80GetIff2(void);
uint32_t z80GetIr(void);
uint32_t zxnextGetCtcIntEnabled(uint32_t channel);
void zxnextCtcSetIntEnabled(uint32_t channel, uint32_t enabled);
static uint64_t zxnextUartSync(void);

static uint8_t intSignalActive;
static uint8_t ulaInterruptDisabled;
static uint8_t lineInterruptEnabled;
static uint16_t lineInterrupt;
static uint8_t im2TopBits;
static uint8_t hwIm2Mode;
static uint8_t expBusInterruptEnabled;
static uint8_t lineInterruptStatus;
static uint8_t ulaInterruptStatus;
/* im2_device S_ACK / S_ISR */
static uint8_t daisyInService[ZXNEXT_DAISY_DEVICE_COUNT];
/* im2_peripheral int_status latches (line and ULA also mirrored in lineInterruptStatus / ulaInterruptStatus) */
static uint8_t daisyStatus[ZXNEXT_DAISY_DEVICE_COUNT];
/* im2_peripheral im2_int_req: set by an enabled or unqualified request in hardware IM2 mode, cleared by
   the RETI that ends the device's service or by leaving hardware IM2 mode */
static uint8_t daisyPending[ZXNEXT_DAISY_DEVICE_COUNT];
/* A pulse started by a CTC, $20 or ULA-exception request (pulse_int_n), in CPU tacts */
static uint8_t intPulseOn;
static uint32_t intPulseEnd;
static uint8_t daisyEnabled[ZXNEXT_DAISY_DEVICE_COUNT];
static uint8_t lastInterruptVector;

/* Set around a NextReg $20 write, so the event ring can tell a software request from the hardware's */
static uint8_t zxnextInterruptsSoftwareRequest;

static void zxnextInterruptsReset(void) {
  zxnextIntEventsReset();
  intSignalActive = 0;
  ulaInterruptDisabled = 0;
  lineInterruptEnabled = 0;
  lineInterrupt = 0;
  im2TopBits = 0;
  hwIm2Mode = 0;
  expBusInterruptEnabled = 1; /* zxnext.vhd reset branch: nr_c4_int_en_0_expbus <= '1' */
  lineInterruptStatus = 0;
  ulaInterruptStatus = 0;
  lastInterruptVector = 0xff;
  intPulseOn = 0;
  intPulseEnd = 0;
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    daisyInService[i] = 0;
    daisyStatus[i] = 0;
    daisyPending[i] = 0;
    daisyEnabled[i] = 0;
  }
}

static uint32_t zxnextInterruptsPulseActive(void) {
  return intPulseOn && (int32_t)(z80GetTacts() - intPulseEnd) < 0;
}

/* zxnext.vhd ~1968-1995: pulse_int_n low for 32 (48K, +3) or 36 CPU cycles; a request while low is ignored */
static void zxnextInterruptsStartPulse(void) {
  if (zxnextInterruptsPulseActive()) return;
  intPulseOn = 1;
  intPulseEnd = z80GetTacts() + zxnextTimingIntPulseCycles;
}

static uint8_t zxnextInterruptsStatusLatch(uint32_t index) {
  if (index == ZXNEXT_INT_LINE) return lineInterruptStatus;
  if (index == ZXNEXT_INT_ULA) return ulaInterruptStatus;
  return daisyStatus[index];
}

/* im2_peripheral o_int_status: the latch or a pending request */
static uint8_t zxnextInterruptsStatus(uint32_t index) {
  return daisyPending[index] || zxnextInterruptsStatusLatch(index);
}

static void zxnextInterruptsClearStatus(uint32_t index) {
  daisyStatus[index] = 0;
  if (index == ZXNEXT_INT_LINE) lineInterruptStatus = 0;
  if (index == ZXNEXT_INT_ULA) ulaInterruptStatus = 0;
}

/*
 * An interrupt request edge from device `index` (im2_peripheral int_req / int_unq). The status latches
 * always; an enabled or unqualified request becomes the pending request in hardware IM2 mode or an INT
 * pulse in pulse mode (`pulse` = 0 for the ULA and line interrupts, whose pulses the raster times). The
 * ULA is the EXCEPTION: in hardware IM2 mode with the CPU not in IM 2 it pulses too.
 */
static void zxnextInterruptsRequest(uint32_t index, uint32_t enabled, uint32_t pulse) {
  daisyStatus[index] = 1;
  if (index == ZXNEXT_INT_LINE) lineInterruptStatus = 1;
  if (index == ZXNEXT_INT_ULA) ulaInterruptStatus = 1;
  if (zxnextIntEventsActive) {
    /* Debugging only: what this edge does, worked out before it does it. The ULA and the line interrupt
       start their raster-timed pulse whenever they request in pulse mode (`pulse` = 0 only means the
       raster, not this call, drives /INT), and the ULA's EXCEPTION pulses in hardware IM2 mode outside IM 2. */
    uint32_t pending = enabled && hwIm2Mode && !daisyPending[index];
    uint32_t raster = index == ZXNEXT_INT_LINE || index == ZXNEXT_INT_ULA;
    uint32_t pulseStarted = enabled && (hwIm2Mode
      ? (index == ZXNEXT_INT_ULA && z80GetInterruptMode() != 2u)
      : (pulse || raster));
    zxnextIntEventRequest(index, enabled, zxnextInterruptsSoftwareRequest, pulseStarted, pending);
  }
  if (!enabled) return;
  if (hwIm2Mode) {
    daisyPending[index] = 1;
    if (pulse && index == ZXNEXT_INT_ULA && z80GetInterruptMode() != 2u) zxnextInterruptsStartPulse();
  } else if (pulse) {
    zxnextInterruptsStartPulse();
  }
}

/* im2_device S_REQ: pending, not yet acknowledged */
static uint8_t zxnextInterruptsDeviceRequesting(uint32_t index) {
  uint32_t slot = index % ZXNEXT_DAISY_DEVICE_COUNT;
  return daisyPending[slot] && !daisyInService[slot];
}

static uint32_t zxnextUlaGetPulseIntActive(uint32_t frameTact);
static uint32_t zxnextVideoLineIntActive(uint32_t frameTact);

static uint32_t zxnextInterruptsGetNextRegister(uint32_t reg) {
  uint32_t renderedTact = currentFrameTact == 0u ? 0u : currentFrameTact - 1u;
  switch (reg & 0xffu) {
    case 0x20: {
      /* ~5935: line, ULA, "00", CTC 3-0 */
      uint32_t v = (zxnextInterruptsStatus(ZXNEXT_INT_LINE) ? 0x80u : 0x00u) |
        (zxnextInterruptsStatus(ZXNEXT_INT_ULA) ? 0x40u : 0x00u);
      for (uint32_t i = 0; i < 4u; i++) if (zxnextInterruptsStatus(ZXNEXT_INT_CTC0 + i)) v |= 1u << i;
      return v;
    }
    case 0x22:
      return
        /* ~5938: bit 7 is the INT pulse itself (`not pulse_int_n`), started only by an enabled source */
        (((!ulaInterruptDisabled && zxnextUlaGetPulseIntActive(renderedTact)) ||
          (lineInterruptEnabled && zxnextVideoLineIntActive(renderedTact)) ||
          zxnextInterruptsPulseActive()) ? 0x80u : 0x00u) |
        (ulaInterruptDisabled ? 0x04u : 0x00u) |
        (lineInterruptEnabled ? 0x02u : 0x00u) |
        ((lineInterrupt & 0x100u) ? 0x01u : 0x00u);
    case 0x23:
      return lineInterrupt & 0xffu;
    case 0xc0:
      return im2TopBits | (zxnextNmiGetStacklessEnabled() ? 0x08u : 0x00u) |
        ((z80GetInterruptMode() & 0x03u) << 1) | (hwIm2Mode ? 0x01u : 0x00u);
    case 0xc2:
      return zxnextNmiGetReturnAddress() & 0xffu;
    case 0xc3:
      return (zxnextNmiGetReturnAddress() >> 8) & 0xffu;
    case 0xc4:
      return
        (expBusInterruptEnabled ? 0x80u : 0x00u) |
        (lineInterruptEnabled ? 0x02u : 0x00u) |
        (!ulaInterruptDisabled ? 0x01u : 0x00u);
    case 0xc5: {
      /* the CTC channels' control_reg(7); channels 4-7 do not exist */
      uint32_t v = 0;
      for (uint32_t i = 0; i < 4u; i++) if (zxnextGetCtcIntEnabled(i)) v |= 1u << i;
      return v;
    }
    case 0xc8:
      return (zxnextInterruptsStatus(ZXNEXT_INT_LINE) ? 0x02u : 0x00u) | (zxnextInterruptsStatus(ZXNEXT_INT_ULA) ? 0x01u : 0x00u);
    case 0xc9: {
      uint32_t v = 0;
      for (uint32_t i = 0; i < 8u; i++) if (zxnextInterruptsStatus(ZXNEXT_INT_CTC0 + i)) v |= 1u << i;
      return v;
    }
    case 0xca:
      zxnextUartSync(); /* the FIFO levels up to now: their edges latch these bits */
      return (zxnextInterruptsStatus(13) ? 0x40u : 0x00u) | (zxnextInterruptsStatus(2) ? 0x30u : 0x00u) |
        (zxnextInterruptsStatus(12) ? 0x04u : 0x00u) | (zxnextInterruptsStatus(1) ? 0x03u : 0x00u);
    default:
      return zxnextNextRegs[reg & 0xffu];
  }
}

static uint32_t zxnextInterruptsHandlesNextRegister(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x20:
    case 0x22:
    case 0x23:
    case 0xc0:
    case 0xc2:
    case 0xc3:
    case 0xc4:
    case 0xc5:
    case 0xc8:
    case 0xc9:
    case 0xca:
      return 1;
    default:
      return 0;
  }
}

static void zxnextInterruptsSetNextRegister(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (reg & 0xffu) {
    case 0x20:
      /* ~1902 im2_int_unq: line (7), ULA (6), CTC 3-0 (3-0), ignoring the enables */
      zxnextInterruptsSoftwareRequest = 1u;
      if (byteValue & 0x80u) zxnextInterruptsRequest(ZXNEXT_INT_LINE, 1, 1);
      if (byteValue & 0x40u) zxnextInterruptsRequest(ZXNEXT_INT_ULA, 1, 1);
      for (uint32_t i = 0; i < 4u; i++) if (byteValue & (1u << i)) zxnextInterruptsRequest(ZXNEXT_INT_CTC0 + i, 1, 1);
      zxnextInterruptsSoftwareRequest = 0u;
      break;
    case 0x22:
      /* ~5272-5275: bit 7 reads the pulse /INT (~5938) and is read-only; a write stores bits 2-0 only */
      ulaInterruptDisabled = (byteValue & 0x04u) != 0;
      lineInterruptEnabled = (byteValue & 0x02u) != 0;
      lineInterrupt = (uint16_t)(((byteValue & 0x01u) << 8) | (lineInterrupt & 0x00ffu));
      break;
    case 0x23:
      lineInterrupt = (uint16_t)((lineInterrupt & 0x0100u) | byteValue);
      break;
    case 0xc0:
      im2TopBits = byteValue & 0xe0u;
      zxnextNmiSetStacklessEnabled((byteValue & 0x08u) != 0);
      hwIm2Mode = (byteValue & 0x01u) != 0;
      /* im2_reset_n = hardware IM2 mode: pulse mode holds every device in S_0 */
      if (!hwIm2Mode) {
        for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
          daisyPending[i] = 0;
          daisyInService[i] = 0;
        }
      }
      break;
    case 0xc2:
      zxnextNmiSetReturnAddress((zxnextNmiGetReturnAddress() & 0xff00u) | byteValue);
      break;
    case 0xc3:
      zxnextNmiSetReturnAddress((uint16_t)((byteValue << 8) | (zxnextNmiGetReturnAddress() & 0x00ffu)));
      break;
    case 0xc4:
      expBusInterruptEnabled = (byteValue & 0x80u) != 0;
      lineInterruptEnabled = (byteValue & 0x02u) != 0;
      ulaInterruptDisabled = (byteValue & 0x01u) == 0;
      break;
    case 0xc5:
      for (uint32_t i = 0; i < 4u; i++) zxnextCtcSetIntEnabled(i, (byteValue >> i) & 0x01u);
      break;
    /* a written 1 clears the status latch (not a pending request), in either mode */
    case 0xc8:
      if (byteValue & 0x02u) zxnextInterruptsClearStatus(ZXNEXT_INT_LINE);
      if (byteValue & 0x01u) zxnextInterruptsClearStatus(ZXNEXT_INT_ULA);
      break;
    case 0xc9:
      for (uint32_t i = 0; i < 8u; i++) if (byteValue & (1u << i)) zxnextInterruptsClearStatus(ZXNEXT_INT_CTC0 + i);
      break;
    case 0xca:
      if (byteValue & 0x40u) zxnextInterruptsClearStatus(13);
      if (byteValue & 0x30u) zxnextInterruptsClearStatus(2);
      if (byteValue & 0x04u) zxnextInterruptsClearStatus(12);
      if (byteValue & 0x03u) zxnextInterruptsClearStatus(1);
      break;
  }
}

static void zxnextInterruptsSetSignalInt(uint32_t active) {
  intSignalActive = active != 0;
}

static uint32_t zxnextInterruptsGetSignalInt(void) {
  return intSignalActive;
}

static uint32_t zxnextInterruptsGetHardwareIm2Mode(void) {
  return hwIm2Mode;
}

static uint32_t zxnextInterruptsGetLastVector(void) {
  return lastInterruptVector;
}

static uint32_t zxnextInterruptsGetDaisyInService(uint32_t index) {
  return daisyInService[index % ZXNEXT_DAISY_DEVICE_COUNT];
}

static void zxnextInterruptsSetDaisyStatus(uint32_t index, uint32_t active) {
  uint32_t slot = index % ZXNEXT_DAISY_DEVICE_COUNT;
  daisyStatus[slot] = active != 0;
  if (slot == 0) lineInterruptStatus = active != 0;
  if (slot == 11) ulaInterruptStatus = active != 0;
}

static void zxnextInterruptsSetDaisyEnabled(uint32_t index, uint32_t active) {
  uint32_t slot = index % ZXNEXT_DAISY_DEVICE_COUNT;
  daisyEnabled[slot] = active != 0;
  if (slot == 0) lineInterruptEnabled = active != 0;
  if (slot == 11) ulaInterruptDisabled = active == 0;
}

/* The daisy chain's INT: only while the CPU is in IM 2 (im2_device i_im2_mode) */
static uint32_t zxnextInterruptsShouldAcceptInt(void) {
  if (hwIm2Mode) {
    if (z80GetInterruptMode() != 2u) return 0;
    for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
      if (daisyInService[i]) return 0;
      if (zxnextInterruptsDeviceRequesting(i)) return 1;
    }
    return 0;
  }
  return intSignalActive;
}

static uint32_t zxnextInterruptsAcknowledge(void) {
  lastInterruptVector = 0xff;
  if (hwIm2Mode) {
    for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
      if (daisyInService[i]) break;
      if (zxnextInterruptsDeviceRequesting(i)) {
        /* S_REQ -> S_ACK / S_ISR; the request stays pending until the RETI */
        daisyInService[i] = 1;
        lastInterruptVector = im2TopBits | (uint8_t)(i << 1);
        return lastInterruptVector;
      }
    }
  }
  return lastInterruptVector;
}

/*
 * Whether an interrupt holds the DMA off (im2_dma_delay, zxnext.vhd ~1955-1966): a daisy-chain device
 * out of S_0 - pending or in service (im2_device o_dma_int) - whose bit is set in the DMA interrupt
 * enables, or an active NMI with $CC bit 7. The enables are ordered as im2_dma_int_en (~1911): the line
 * interrupt ($CC bit 1), UART 0 / 1 RX ($CE bits 1-0 / 5-4), CTC 0-7 ($CD), the ULA ($CC bit 0), and
 * UART 0 / 1 TX ($CE bit 2 / 6) - the same device order as the chain's priority.
 */
static uint32_t zxnextInterruptsDmaRequestActive(void) {
  uint32_t cc = zxnextNextRegs[0xccu];
  uint32_t cd = zxnextNextRegs[0xcdu];
  uint32_t ce = zxnextNextRegs[0xceu];
  uint32_t mask =
    ((cc >> 1u) & 0x01u) |                                  /* 0: line */
    (((ce & 0x03u) != 0u) << 1u) |                          /* 1: UART 0 RX */
    (((ce & 0x30u) != 0u) << 2u) |                          /* 2: UART 1 RX */
    ((cd & 0xffu) << 3u) |                                  /* 3-10: CTC 0-7 */
    ((cc & 0x01u) << 11u) |                                 /* 11: ULA */
    (((ce >> 2u) & 0x01u) << 12u) |                         /* 12: UART 0 TX */
    (((ce >> 6u) & 0x01u) << 13u);                          /* 13: UART 1 TX */
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    if ((mask & (1u << i)) && (daisyPending[i] || daisyInService[i])) return 1;
  }
  return (cc & 0x80u) && zxnextNmiIsActivated();
}

/* The highest-priority source in service, or ZXNEXT_DAISY_DEVICE_COUNT when none is */
static uint32_t zxnextInterruptsFirstInService(void) {
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) if (daisyInService[i]) return i;
  return ZXNEXT_DAISY_DEVICE_COUNT;
}

static void zxnextInterruptsReti(uint32_t pc, uint32_t sp) {
  /* im2_device ~124: S_ISR -> S_0 needs i_im2_mode, so a RETI outside IM 2 releases nothing */
  if (z80GetInterruptMode() != 2u) {
    if (zxnextIntEventsActive) {
      uint32_t first = zxnextInterruptsFirstInService();
      if (first < ZXNEXT_DAISY_DEVICE_COUNT) zxnextIntEvent(ZXNEXT_IEV_RETI_IGNORED, first, 0xffu, 0u, pc, sp);
    }
    return;
  }
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    if (daisyInService[i]) {
      /* S_ISR -> S_0: im2_isr_serviced clears the pending request */
      daisyInService[i] = 0;
      daisyPending[i] = 0;
      if (zxnextIntEventsActive) zxnextIntEvent(ZXNEXT_IEV_RETI, i, 0xffu, 0u, pc, sp);
      return;
    }
  }
}

/* A RETN (ED 45) while a maskable source is in service releases nothing (only RETI does) */
static void zxnextInterruptsRetn(uint32_t pc, uint32_t sp) {
  if (!zxnextIntEventsActive || !hwIm2Mode) return;
  uint32_t first = zxnextInterruptsFirstInService();
  if (first < ZXNEXT_DAISY_DEVICE_COUNT) zxnextIntEvent(ZXNEXT_IEV_RETN_ISR, first, 0xffu, 0u, pc, sp);
}

/* WAIT: a request pending, not yet acknowledged, for longer than the stop's limit (reported once) */
static void zxnextInterruptsCheckWait(uint32_t pc, uint32_t sp) {
  if (!hwIm2Mode || !(zxnextIntWatchKinds & (1u << ZXNEXT_IEV_WAIT)) || zxnextIntWatchWaitLimit == 0u) return;
  uint32_t now = z80GetTacts();
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    if (daisyPending[i] && !daisyInService[i] && !zxnextIntWaitReported[i] &&
        (uint32_t)(now - zxnextIntReqTacts[i]) > zxnextIntWatchWaitLimit) {
      zxnextIntWaitReported[i] = 1u;
      zxnextIntEvent(ZXNEXT_IEV_WAIT, i, 0xffu, 0u, pc, sp);
    }
  }
}

/*
 * The IDE's snapshot of the interrupt system (plan §3.2), read without side effects: no UART or CTC
 * sync, no latching. 96 bytes:
 *   +0..13   per source: bit 0 enabled, bit 1 status, bit 2 pending (requesting or in service),
 *            bit 3 in service
 *   +16 hwIm2Mode, +17 im2TopBits, +18 last vector, +19 /INT signal, +20 pulse active,
 *   +21 ULA disabled, +22 line enabled, +23 expansion bus enabled, +24-25 line interrupt line,
 *   +26 NMI state (0 IDLE .. 3 END), +27 NMI source (bit 0 Multiface, bit 1 DivMMC),
 *   +28 NMI pending (bit 0 Multiface, bit 1 DivMMC), +29 NMI signal, +30 stackless on,
 *   +31 stackless return armed, +32-33 NMI return address, +34 CPU IM, +35 IFF1, +36 IFF2,
 *   +37 the pulse length in CPU tacts, +38 the I register,
 *   +40..67 per source, the IM 2 vector table's word at I * 256 + the source's vector (peeked: no bus
 *   activity, no DivMMC automap)
 */
#define ZXNEXT_IDE_INT_STATE_SIZE 96u
static uint8_t zxnextIdeInterruptState[ZXNEXT_IDE_INT_STATE_SIZE];

static uint32_t zxnextInterruptsSnapshot(void) {
  uint8_t *o = zxnextIdeInterruptState;
  uint8_t c6 = zxnextNextRegs[0xc6u];
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    uint32_t en;
    if (i == ZXNEXT_INT_LINE) en = lineInterruptEnabled;
    else if (i == ZXNEXT_INT_ULA) en = !ulaInterruptDisabled;
    else if (i >= ZXNEXT_INT_CTC0 && i < ZXNEXT_INT_CTC0 + 4u) en = zxnextGetCtcIntEnabled(i - ZXNEXT_INT_CTC0);
    else if (i == 1u) en = (c6 & 0x03u) != 0u;
    else if (i == 2u) en = (c6 & 0x30u) != 0u;
    else if (i == 12u) en = (c6 & 0x04u) != 0u;
    else if (i == 13u) en = (c6 & 0x40u) != 0u;
    else en = 0u;
    o[i] = (uint8_t)((en ? 0x01u : 0u) | (zxnextInterruptsStatus(i) ? 0x02u : 0u) |
      (daisyPending[i] ? 0x04u : 0u) | (daisyInService[i] ? 0x08u : 0u));
  }
  o[14] = 0u; o[15] = 0u;
  o[16] = hwIm2Mode;
  o[17] = im2TopBits;
  o[18] = lastInterruptVector;
  o[19] = intSignalActive;
  o[20] = (uint8_t)zxnextInterruptsPulseActive();
  o[21] = ulaInterruptDisabled;
  o[22] = lineInterruptEnabled;
  o[23] = expBusInterruptEnabled;
  o[24] = (uint8_t)lineInterrupt; o[25] = (uint8_t)(lineInterrupt >> 8);
  zxnextNmiSnapshot(&o[26]);
  o[34] = (uint8_t)z80GetInterruptMode();
  o[35] = (uint8_t)z80GetIff1();
  o[36] = (uint8_t)z80GetIff2();
  o[37] = (uint8_t)zxnextTimingIntPulseCycles;
  uint32_t iReg = (z80GetIr() >> 8) & 0xffu;
  o[38] = (uint8_t)iReg;
  o[39] = 0u;
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    uint32_t address = (iReg << 8) | (im2TopBits | (i << 1));
    uint32_t word = zxnextMemoryPeekMapped(address & 0xffffu) | (zxnextMemoryPeekMapped((address + 1u) & 0xffffu) << 8);
    o[40u + i * 2u] = (uint8_t)word;
    o[41u + i * 2u] = (uint8_t)(word >> 8);
  }
  for (uint32_t i = 68u; i < ZXNEXT_IDE_INT_STATE_SIZE; i++) o[i] = 0u;
  return (uint32_t)(uintptr_t)o;
}
