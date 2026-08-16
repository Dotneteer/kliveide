#include "zxnext.h"

static uint32_t interruptMaskFromArray(const uint8_t *values, uint32_t count) {
  uint32_t mask = 0u;
  for (uint32_t i = 0; i < count; i++) {
    if (values[i] != 0u) mask |= 1u << i;
  }
  return mask;
}

static void resetInterruptState(void) {
  interruptIntSignalActive = 0u;
  interruptUlaDisabled = 0u;
  interruptLineEnabled = 0u;
  interruptExpBusEnabled = 0u;
  interruptLine = 0u;
  interruptIm2TopBits = 0u;
  interruptStacklessNmiEnabled = 0u;
  interruptHwIm2Mode = 0u;
  interruptNmiReturnAddress = 0u;
  interruptUart0TxEmpty = 0u;
  interruptUart0RxNearFull = 0u;
  interruptUart0RxAvailable = 0u;
  interruptUart1TxEmpty = 0u;
  interruptUart1RxNearFull = 0u;
  interruptUart1RxAvailable = 0u;
  interruptLineStatus = 0u;
  interruptUlaStatus = 0u;
  interruptUart0TxEmptyStatus = 0u;
  interruptUart0RxNearFullStatus = 0u;
  interruptUart0RxAvailableStatus = 0u;
  interruptUart1TxEmptyStatus = 0u;
  interruptUart1RxNearFullStatus = 0u;
  interruptUart1RxAvailableStatus = 0u;
  interruptEnableNmiToDma = 0u;
  interruptEnableLineToDma = 0u;
  interruptEnableUlaToDma = 0u;
  interruptEnableUart0TxEmptyToDma = 0u;
  interruptEnableUart0RxNearFullToDma = 0u;
  interruptEnableUart0RxAvailableToDma = 0u;
  interruptEnableUart1TxEmptyToDma = 0u;
  interruptEnableUart1RxNearFullToDma = 0u;
  interruptEnableUart1RxAvailableToDma = 0u;
  for (uint32_t i = 0; i < 8u; i++) {
    interruptCtcEnabled[i] = 0u;
    interruptCtcStatus[i] = 0u;
    interruptEnableCtcToDma[i] = 0u;
  }
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    interruptDaisyInService[i] = 0u;
  }
  interruptBusResetRequested = 0u;
  interruptMfNmiByIoTrap = 0u;
  interruptMfNmiByNextReg = 0u;
  interruptDivMmcNmiByNextReg = 0u;
  interruptLastWasHardReset = 0u;
  interruptLastWasSoftReset = 0u;
}

static uint32_t interruptNextReg02Value(void) {
  return
    (interruptBusResetRequested != 0u ? 0x80u : 0x00u) |
    (interruptMfNmiByIoTrap != 0u ? 0x10u : 0x00u) |
    (interruptMfNmiByNextReg != 0u ? 0x08u : 0x00u) |
    (interruptDivMmcNmiByNextReg != 0u ? 0x04u : 0x00u) |
    (interruptLastWasHardReset != 0u ? 0x02u : 0x00u) |
    (interruptLastWasSoftReset != 0u ? 0x01u : 0x00u);
}

static uint32_t interruptNextReg20Value(void) {
  return
    (interruptLineStatus != 0u ? 0x80u : 0x00u) |
    (interruptUlaStatus != 0u ? 0x40u : 0x00u) |
    (interruptCtcStatus[3] != 0u ? 0x08u : 0x00u) |
    (interruptCtcStatus[2] != 0u ? 0x04u : 0x00u) |
    (interruptCtcStatus[1] != 0u ? 0x02u : 0x00u) |
    (interruptCtcStatus[0] != 0u ? 0x01u : 0x00u);
}

static uint32_t interruptNextReg22Value(void) {
  return
    (interruptIntSignalActive != 0u ? 0x80u : 0x00u) |
    (interruptUlaDisabled != 0u ? 0x04u : 0x00u) |
    (interruptLineEnabled != 0u ? 0x02u : 0x00u) |
    ((interruptLine & 0x100u) != 0u ? 0x01u : 0x00u);
}

static uint32_t interruptNextRegC0Value(void) {
  return interruptIm2TopBits |
    (interruptStacklessNmiEnabled != 0u ? 0x08u : 0x00u) |
    ((z80GetInterruptMode() & 0x03u) << 1u) |
    (interruptHwIm2Mode != 0u ? 0x01u : 0x00u);
}

static uint32_t interruptNextRegC4Value(void) {
  return
    (interruptExpBusEnabled != 0u ? 0x80u : 0x00u) |
    (interruptLineEnabled != 0u ? 0x02u : 0x00u) |
    (interruptUlaDisabled == 0u ? 0x01u : 0x00u);
}

static uint32_t interruptNextRegC6Value(void) {
  return
    (interruptUart1TxEmpty != 0u ? 0x40u : 0x00u) |
    (interruptUart1RxNearFull != 0u ? 0x20u : 0x00u) |
    (interruptUart1RxAvailable != 0u ? 0x10u : 0x00u) |
    (interruptUart0TxEmpty != 0u ? 0x04u : 0x00u) |
    (interruptUart0RxNearFull != 0u ? 0x02u : 0x00u) |
    (interruptUart0RxAvailable != 0u ? 0x01u : 0x00u);
}

static uint32_t interruptNextRegC8Value(void) {
  if (interruptHwIm2Mode != 0u) {
    return
      (interruptDaisyInService[ZXNEXT_DAISY_PRIORITY_LINE] != 0u ? 0x02u : 0x00u) |
      (interruptDaisyInService[ZXNEXT_DAISY_PRIORITY_ULA] != 0u ? 0x01u : 0x00u);
  }
  return (interruptLineStatus != 0u ? 0x02u : 0x00u) | (interruptUlaStatus != 0u ? 0x01u : 0x00u);
}

static uint32_t interruptNextRegC9Value(void) {
  if (interruptHwIm2Mode != 0u) {
    uint32_t value = 0u;
    for (uint32_t i = 0; i < 8u; i++) {
      if (interruptDaisyInService[ZXNEXT_DAISY_PRIORITY_CTC_BASE + i] != 0u) value |= 1u << i;
    }
    return value;
  }
  return interruptMaskFromArray(interruptCtcStatus, 8u);
}

static uint32_t interruptNextRegCAValue(void) {
  if (interruptHwIm2Mode != 0u) {
    return
      (interruptDaisyInService[ZXNEXT_DAISY_PRIORITY_UART1_TX] != 0u ? 0x40u : 0x00u) |
      (interruptDaisyInService[ZXNEXT_DAISY_PRIORITY_UART1_RX] != 0u ? 0x30u : 0x00u) |
      (interruptDaisyInService[ZXNEXT_DAISY_PRIORITY_UART0_TX] != 0u ? 0x04u : 0x00u) |
      (interruptDaisyInService[ZXNEXT_DAISY_PRIORITY_UART0_RX] != 0u ? 0x03u : 0x00u);
  }
  return
    (interruptUart1TxEmptyStatus != 0u ? 0x40u : 0x00u) |
    (interruptUart1RxNearFullStatus != 0u ? 0x20u : 0x00u) |
    (interruptUart1RxAvailableStatus != 0u ? 0x10u : 0x00u) |
    (interruptUart0TxEmptyStatus != 0u ? 0x04u : 0x00u) |
    (interruptUart0RxNearFullStatus != 0u ? 0x02u : 0x00u) |
    (interruptUart0RxAvailableStatus != 0u ? 0x01u : 0x00u);
}

static uint32_t interruptNextRegCCValue(void) {
  return
    (interruptEnableNmiToDma != 0u ? 0x80u : 0x00u) |
    (interruptEnableLineToDma != 0u ? 0x02u : 0x00u) |
    (interruptEnableUlaToDma != 0u ? 0x01u : 0x00u);
}

static uint32_t interruptNextRegCEValue(void) {
  return
    (interruptEnableUart1TxEmptyToDma != 0u ? 0x40u : 0x00u) |
    (interruptEnableUart1RxNearFullToDma != 0u ? 0x20u : 0x00u) |
    (interruptEnableUart1RxAvailableToDma != 0u ? 0x10u : 0x00u) |
    (interruptEnableUart0TxEmptyToDma != 0u ? 0x04u : 0x00u) |
    (interruptEnableUart0RxNearFullToDma != 0u ? 0x02u : 0x00u) |
    (interruptEnableUart0RxAvailableToDma != 0u ? 0x01u : 0x00u);
}

static uint32_t interruptReadNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x02u: return interruptNextReg02Value();
    case 0x20u: return interruptNextReg20Value();
    case 0x22u: return interruptNextReg22Value();
    case 0x23u: return interruptLine & 0xffu;
    case 0xc0u: return interruptNextRegC0Value();
    case 0xc2u: return interruptNmiReturnAddress & 0xffu;
    case 0xc3u: return interruptNmiReturnAddress >> 8u;
    case 0xc4u: return interruptNextRegC4Value();
    case 0xc5u: return interruptMaskFromArray(interruptCtcEnabled, 8u);
    case 0xc6u: return interruptNextRegC6Value();
    case 0xc8u: return interruptNextRegC8Value();
    case 0xc9u: return interruptNextRegC9Value();
    case 0xcau: return interruptNextRegCAValue();
    case 0xccu: return interruptNextRegCCValue();
    case 0xcdu: return interruptMaskFromArray(interruptEnableCtcToDma, 8u);
    case 0xceu: return interruptNextRegCEValue();
    default: return 0xffffffffu;
  }
}

static uint32_t interruptWriteNextReg(uint32_t reg, uint32_t value) {
  const uint32_t maskedReg = reg & 0xffu;
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  switch (maskedReg) {
    case 0x02u:
      interruptBusResetRequested = (byteValue & 0x80u) != 0u;
      interruptMfNmiByNextReg = (byteValue & 0x08u) != 0u;
      interruptDivMmcNmiByNextReg = (byteValue & 0x04u) != 0u;
      if (interruptMfNmiByNextReg != 0u) zxnextRequestMfNmi();
      if (interruptDivMmcNmiByNextReg != 0u) zxnextRequestDivMmcNmi();
      if ((byteValue & 0x10u) == 0u) interruptMfNmiByIoTrap = 0u;
      return 1u;
    case 0x22u:
      interruptIntSignalActive = (byteValue & 0x80u) != 0u;
      interruptUlaDisabled = (byteValue & 0x04u) != 0u;
      interruptLineEnabled = (byteValue & 0x02u) != 0u;
      interruptLine = ((uint16_t)(byteValue & 0x01u) << 8u) | (interruptLine & 0xffu);
      return 1u;
    case 0x23u:
      interruptLine = (interruptLine & 0x100u) | byteValue;
      return 1u;
    case 0xc0u:
      interruptIm2TopBits = byteValue & 0xe0u;
      interruptStacklessNmiEnabled = (byteValue & 0x08u) != 0u;
      interruptHwIm2Mode = (byteValue & 0x01u) != 0u;
      return 1u;
    case 0xc2u:
      interruptNmiReturnAddress = (interruptNmiReturnAddress & 0xff00u) | byteValue;
      return 1u;
    case 0xc3u:
      interruptNmiReturnAddress = ((uint16_t)byteValue << 8u) | (interruptNmiReturnAddress & 0x00ffu);
      return 1u;
    case 0xc4u:
      interruptExpBusEnabled = (byteValue & 0x80u) != 0u;
      interruptLineEnabled = (byteValue & 0x02u) != 0u;
      interruptUlaDisabled = (byteValue & 0x01u) == 0u;
      return 1u;
    case 0xc5u:
      for (uint32_t i = 0; i < 8u; i++) interruptCtcEnabled[i] = (byteValue & (1u << i)) != 0u;
      ctcWriteIntEnable(byteValue);
      return 1u;
    case 0xc6u:
      interruptUart1TxEmpty = (byteValue & 0x40u) != 0u;
      interruptUart1RxNearFull = (byteValue & 0x20u) != 0u;
      interruptUart1RxAvailable = (byteValue & 0x10u) != 0u;
      interruptUart0TxEmpty = (byteValue & 0x04u) != 0u;
      interruptUart0RxNearFull = (byteValue & 0x02u) != 0u;
      interruptUart0RxAvailable = (byteValue & 0x01u) != 0u;
      return 1u;
    case 0xc8u:
      if (interruptHwIm2Mode == 0u) {
        if ((byteValue & 0x02u) != 0u) interruptLineStatus = 0u;
        if ((byteValue & 0x01u) != 0u) interruptUlaStatus = 0u;
      }
      return 1u;
    case 0xc9u:
      if (interruptHwIm2Mode == 0u) {
        for (uint32_t i = 0; i < 8u; i++) {
          if ((byteValue & (1u << i)) != 0u) interruptCtcStatus[i] = 0u;
        }
      }
      return 1u;
    case 0xcau:
      if (interruptHwIm2Mode == 0u) {
        if ((byteValue & 0x40u) != 0u) interruptUart1TxEmptyStatus = 0u;
        if ((byteValue & 0x20u) != 0u) interruptUart1RxNearFullStatus = 0u;
        if ((byteValue & 0x10u) != 0u) interruptUart1RxAvailableStatus = 0u;
        if ((byteValue & 0x04u) != 0u) interruptUart0TxEmptyStatus = 0u;
        if ((byteValue & 0x02u) != 0u) interruptUart0RxNearFullStatus = 0u;
        if ((byteValue & 0x01u) != 0u) interruptUart0RxAvailableStatus = 0u;
      }
      return 1u;
    case 0xccu:
      interruptEnableNmiToDma = (byteValue & 0x80u) != 0u;
      interruptEnableLineToDma = (byteValue & 0x02u) != 0u;
      interruptEnableUlaToDma = (byteValue & 0x01u) != 0u;
      return 1u;
    case 0xcdu:
      for (uint32_t i = 0; i < 8u; i++) interruptEnableCtcToDma[i] = (byteValue & (1u << i)) != 0u;
      return 1u;
    case 0xceu:
      interruptEnableUart1TxEmptyToDma = (byteValue & 0x40u) != 0u;
      interruptEnableUart1RxNearFullToDma = (byteValue & 0x20u) != 0u;
      interruptEnableUart1RxAvailableToDma = (byteValue & 0x10u) != 0u;
      interruptEnableUart0TxEmptyToDma = (byteValue & 0x04u) != 0u;
      interruptEnableUart0RxNearFullToDma = (byteValue & 0x02u) != 0u;
      interruptEnableUart0RxAvailableToDma = (byteValue & 0x01u) != 0u;
      return 1u;
    default:
      return 0u;
  }
}

static uint32_t interruptIsDeviceRequesting(uint32_t priority) {
  switch (priority) {
    case ZXNEXT_DAISY_PRIORITY_LINE:
      return interruptLineStatus != 0u && interruptLineEnabled != 0u;
    case ZXNEXT_DAISY_PRIORITY_UART0_RX:
      return (interruptUart0RxNearFullStatus != 0u || interruptUart0RxAvailableStatus != 0u) &&
        (interruptUart0RxNearFull != 0u || interruptUart0RxAvailable != 0u);
    case ZXNEXT_DAISY_PRIORITY_UART1_RX:
      return (interruptUart1RxNearFullStatus != 0u || interruptUart1RxAvailableStatus != 0u) &&
        (interruptUart1RxNearFull != 0u || interruptUart1RxAvailable != 0u);
    case ZXNEXT_DAISY_PRIORITY_ULA:
      return interruptUlaStatus != 0u && interruptUlaDisabled == 0u;
    case ZXNEXT_DAISY_PRIORITY_UART0_TX:
      return interruptUart0TxEmptyStatus != 0u && interruptUart0TxEmpty != 0u;
    case ZXNEXT_DAISY_PRIORITY_UART1_TX:
      return interruptUart1TxEmptyStatus != 0u && interruptUart1TxEmpty != 0u;
    default:
      if (priority >= ZXNEXT_DAISY_PRIORITY_CTC_BASE && priority < ZXNEXT_DAISY_PRIORITY_ULA) {
        const uint32_t channel = priority - ZXNEXT_DAISY_PRIORITY_CTC_BASE;
        return interruptCtcStatus[channel] != 0u && interruptCtcEnabled[channel] != 0u;
      }
      return 0u;
  }
}

static void interruptClearDeviceRequest(uint32_t priority) {
  switch (priority) {
    case ZXNEXT_DAISY_PRIORITY_LINE:
      interruptLineStatus = 0u;
      break;
    case ZXNEXT_DAISY_PRIORITY_UART0_RX:
      interruptUart0RxNearFullStatus = 0u;
      interruptUart0RxAvailableStatus = 0u;
      break;
    case ZXNEXT_DAISY_PRIORITY_UART1_RX:
      interruptUart1RxNearFullStatus = 0u;
      interruptUart1RxAvailableStatus = 0u;
      break;
    case ZXNEXT_DAISY_PRIORITY_ULA:
      interruptUlaStatus = 0u;
      break;
    case ZXNEXT_DAISY_PRIORITY_UART0_TX:
      interruptUart0TxEmptyStatus = 0u;
      break;
    case ZXNEXT_DAISY_PRIORITY_UART1_TX:
      interruptUart1TxEmptyStatus = 0u;
      break;
    default:
      if (priority >= ZXNEXT_DAISY_PRIORITY_CTC_BASE && priority < ZXNEXT_DAISY_PRIORITY_ULA) {
        interruptCtcStatus[priority - ZXNEXT_DAISY_PRIORITY_CTC_BASE] = 0u;
      }
      break;
  }
}

uint32_t zxnextDaisyUpdateIrqState(void) {
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    if (interruptDaisyInService[i] != 0u) return 0u;
    if (interruptIsDeviceRequesting(i) != 0u) return 1u;
  }
  return 0u;
}

uint32_t zxnextDaisyPeekInterruptVector(void) {
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    if (interruptDaisyInService[i] != 0u) break;
    if (interruptIsDeviceRequesting(i) != 0u) return interruptIm2TopBits | (i << 1u);
  }
  return 0xffu;
}

uint32_t zxnextDaisyAcknowledge(void) {
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    if (interruptDaisyInService[i] != 0u) break;
    if (interruptIsDeviceRequesting(i) != 0u) {
      interruptDaisyInService[i] = 1u;
      interruptClearDeviceRequest(i);
      return interruptIm2TopBits | (i << 1u);
    }
  }
  return 0xffu;
}

void zxnextDaisyReti(void) {
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    if (interruptDaisyInService[i] != 0u) {
      interruptDaisyInService[i] = 0u;
      return;
    }
  }
}

void zxnextCaptureUlaInterruptPulse(void) {
  if (interruptUlaDisabled == 0u) interruptUlaStatus = 1u;
}

void zxnextCaptureLineInterruptPulse(void) {
  if (interruptLineEnabled != 0u) interruptLineStatus = 1u;
}

void zxnextSetCtcInterruptStatus(uint32_t channel, uint32_t value) {
  if (channel < 8u) interruptCtcStatus[channel] = value != 0u;
}

void zxnextSetUartInterruptStatus(uint32_t source, uint32_t value) {
  const uint8_t enabled = value != 0u;
  switch (source) {
    case 0u: interruptUart0RxAvailableStatus = enabled; break;
    case 1u: interruptUart0RxNearFullStatus = enabled; break;
    case 2u: interruptUart0TxEmptyStatus = enabled; break;
    case 3u: interruptUart1RxAvailableStatus = enabled; break;
    case 4u: interruptUart1RxNearFullStatus = enabled; break;
    case 5u: interruptUart1TxEmptyStatus = enabled; break;
    default: break;
  }
}

void zxnextSetDaisyInService(uint32_t priority, uint32_t value) {
  if (priority < ZXNEXT_DAISY_DEVICE_COUNT) interruptDaisyInService[priority] = value != 0u;
}

uint32_t zxnextGetDmaInterruptRequestActive(void) {
  if (interruptEnableLineToDma != 0u && interruptLineStatus != 0u) return 1u;
  if (interruptEnableUlaToDma != 0u && interruptUlaStatus != 0u) return 1u;
  for (uint32_t i = 0; i < 8u; i++) {
    if (interruptEnableCtcToDma[i] != 0u && interruptCtcStatus[i] != 0u) return 1u;
  }
  if (interruptEnableUart0RxNearFullToDma != 0u && interruptUart0RxNearFullStatus != 0u) return 1u;
  if (interruptEnableUart0RxAvailableToDma != 0u && interruptUart0RxAvailableStatus != 0u) return 1u;
  if (interruptEnableUart0TxEmptyToDma != 0u && interruptUart0TxEmptyStatus != 0u) return 1u;
  if (interruptEnableUart1RxNearFullToDma != 0u && interruptUart1RxNearFullStatus != 0u) return 1u;
  if (interruptEnableUart1RxAvailableToDma != 0u && interruptUart1RxAvailableStatus != 0u) return 1u;
  if (interruptEnableUart1TxEmptyToDma != 0u && interruptUart1TxEmptyStatus != 0u) return 1u;
  return 0u;
}

uint32_t zxnextGetInterruptLineValue(void) { return interruptLine; }
uint32_t zxnextGetInterruptIm2TopBits(void) { return interruptIm2TopBits; }
uint32_t zxnextGetInterruptStacklessNmiEnabled(void) { return interruptStacklessNmiEnabled; }
uint32_t zxnextGetInterruptHwIm2Mode(void) { return interruptHwIm2Mode; }
uint32_t zxnextGetInterruptNmiReturnAddress(void) { return interruptNmiReturnAddress; }
uint32_t zxnextGetInterruptCtcEnabledMask(void) { return interruptMaskFromArray(interruptCtcEnabled, 8u); }
uint32_t zxnextGetInterruptCtcStatusMask(void) { return interruptMaskFromArray(interruptCtcStatus, 8u); }
uint32_t zxnextGetInterruptCtcDmaEnableMask(void) { return interruptMaskFromArray(interruptEnableCtcToDma, 8u); }
uint32_t zxnextGetDaisyInServiceMask(void) { return interruptMaskFromArray(interruptDaisyInService, ZXNEXT_DAISY_DEVICE_COUNT); }
