#include "zxnext-interrupts.h"
#include "zxnext-nmi.h"

#define ZXNEXT_DAISY_DEVICE_COUNT 14u

static uint8_t intSignalActive;
static uint8_t ulaInterruptDisabled;
static uint8_t lineInterruptEnabled;
static uint16_t lineInterrupt;
static uint8_t im2TopBits;
static uint8_t hwIm2Mode;
static uint8_t expBusInterruptEnabled;
static uint8_t lineInterruptStatus;
static uint8_t ulaInterruptStatus;
static uint8_t daisyInService[ZXNEXT_DAISY_DEVICE_COUNT];
static uint8_t daisyStatus[ZXNEXT_DAISY_DEVICE_COUNT];
static uint8_t daisyEnabled[ZXNEXT_DAISY_DEVICE_COUNT];
static uint8_t lastInterruptVector;

static void zxnextInterruptsReset(void) {
  intSignalActive = 0;
  ulaInterruptDisabled = 0;
  lineInterruptEnabled = 0;
  lineInterrupt = 0;
  im2TopBits = 0;
  hwIm2Mode = 0;
  expBusInterruptEnabled = 0;
  lineInterruptStatus = 0;
  ulaInterruptStatus = 0;
  lastInterruptVector = 0xff;
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    daisyInService[i] = 0;
    daisyStatus[i] = 0;
    daisyEnabled[i] = 0;
  }
}

static uint8_t zxnextInterruptsDeviceRequesting(uint32_t index) {
  uint32_t slot = index % ZXNEXT_DAISY_DEVICE_COUNT;
  if (slot == 0) return lineInterruptStatus && lineInterruptEnabled;
  if (slot == 11) return ulaInterruptStatus && !ulaInterruptDisabled;
  return daisyStatus[slot] && daisyEnabled[slot];
}

static uint32_t zxnextInterruptsGetNextRegister(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x20:
      return (lineInterruptStatus ? 0x80u : 0x00u) | (ulaInterruptStatus ? 0x40u : 0x00u);
    case 0x22:
      return
        (intSignalActive ? 0x80u : 0x00u) |
        (ulaInterruptDisabled ? 0x04u : 0x00u) |
        (lineInterruptEnabled ? 0x02u : 0x00u) |
        ((lineInterrupt & 0x100u) ? 0x01u : 0x00u);
    case 0x23:
      return lineInterrupt & 0xffu;
    case 0xc0:
      return im2TopBits | (zxnextNmiGetStacklessEnabled() ? 0x08u : 0x00u) |
        ((cpuInterruptMode & 0x03u) << 1) | (hwIm2Mode ? 0x01u : 0x00u);
    case 0xc2:
      return zxnextNmiGetReturnAddress() & 0xffu;
    case 0xc3:
      return (zxnextNmiGetReturnAddress() >> 8) & 0xffu;
    case 0xc4:
      return
        (expBusInterruptEnabled ? 0x80u : 0x00u) |
        (lineInterruptEnabled ? 0x02u : 0x00u) |
        (!ulaInterruptDisabled ? 0x01u : 0x00u);
    case 0xc8:
      return hwIm2Mode
        ? ((daisyInService[0] ? 0x02u : 0x00u) | (daisyInService[11] ? 0x01u : 0x00u))
        : ((lineInterruptStatus ? 0x02u : 0x00u) | (ulaInterruptStatus ? 0x01u : 0x00u));
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
    case 0xc8:
      return 1;
    default:
      return 0;
  }
}

static void zxnextInterruptsSetNextRegister(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (reg & 0xffu) {
    case 0x20:
      zxnextNextRegs[0x20] = byteValue;
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
    case 0xc8:
      if (!hwIm2Mode) {
        if (byteValue & 0x02u) lineInterruptStatus = 0;
        if (byteValue & 0x01u) ulaInterruptStatus = 0;
      }
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

static uint32_t zxnextInterruptsShouldAcceptInt(void) {
  if (hwIm2Mode) {
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
        daisyInService[i] = 1;
        daisyStatus[i] = 0;
        if (i == 0) lineInterruptStatus = 0;
        if (i == 11) ulaInterruptStatus = 0;
        lastInterruptVector = im2TopBits | (uint8_t)(i << 1);
        return lastInterruptVector;
      }
    }
  }
  return lastInterruptVector;
}

static void zxnextInterruptsReti(void) {
  for (uint32_t i = 0; i < ZXNEXT_DAISY_DEVICE_COUNT; i++) {
    if (daisyInService[i]) {
      daisyInService[i] = 0;
      return;
    }
  }
}
