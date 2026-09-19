#include "zxnext-interrupts.h"
#include "zxnext-nmi.h"

#define ZXNEXT_DAISY_DEVICE_COUNT 14u
#define ZXNEXT_INT_LINE 0u
#define ZXNEXT_INT_CTC0 3u
#define ZXNEXT_INT_ULA 11u

/* Defined later in the unity build (z80.c through zxnext-cpu.c, zxnext-ctc.c). */
uint32_t z80GetTacts(void);
uint32_t z80GetInterruptMode(void);
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

static void zxnextInterruptsReset(void) {
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
      if (byteValue & 0x80u) zxnextInterruptsRequest(ZXNEXT_INT_LINE, 1, 1);
      if (byteValue & 0x40u) zxnextInterruptsRequest(ZXNEXT_INT_ULA, 1, 1);
      for (uint32_t i = 0; i < 4u; i++) if (byteValue & (1u << i)) zxnextInterruptsRequest(ZXNEXT_INT_CTC0 + i, 1, 1);
      break;
    case 0x22:
      intSignalActive = (byteValue & 0x80u) != 0;
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
 * Whether an interrupt the program routed to the DMA (nextreg $CC) is pending.
 *
 * FPGA peripherals.vhd o_dma_int; DmaDevice.ts reads it through InterruptDevice
 * dmaInterruptRequestActive. Only the line and ULA sources exist in this backend's interrupt model;
 * the CTC ($CD) and UART ($CE) sources are not modelled here yet.
 */
static uint32_t zxnextInterruptsDmaRequestActive(void) {
  /* im2_device o_dma_int: a device out of S_0 (pending or in service) with its $CC bit */
  uint8_t enables = zxnextNextRegs[0xccu];
  if ((enables & 0x02u) && (daisyPending[ZXNEXT_INT_LINE] || daisyInService[ZXNEXT_INT_LINE])) return 1;
  if ((enables & 0x01u) && (daisyPending[ZXNEXT_INT_ULA] || daisyInService[ZXNEXT_INT_ULA])) return 1;
  return 0;
}

static void zxnextInterruptsReti(void) {
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    if (daisyInService[i]) {
      /* S_ISR -> S_0: im2_isr_serviced clears the pending request */
      daisyInService[i] = 0;
      daisyPending[i] = 0;
      return;
    }
  }
}
