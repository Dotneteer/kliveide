#include "zxnext.h"

#define ZXNEXT_UART_DEFAULT_PRESCALER 243u
#define ZXNEXT_UART_DEFAULT_FRAME 0x18u
#define ZXNEXT_UART_INVALID_PORT 0xffffffffu

static uint32_t uartValidChannel(uint32_t channel) {
  return channel < 2u;
}

static void uartClearRx(uint32_t channel) {
  if (!uartValidChannel(channel)) return;
  uartRxReadPtr[channel] = 0u;
  uartRxWritePtr[channel] = 0u;
  uartRxCount[channel] = 0u;
}

static void uartClearTx(uint32_t channel) {
  if (!uartValidChannel(channel)) return;
  uartTxReadPtr[channel] = 0u;
  uartTxWritePtr[channel] = 0u;
  uartTxCount[channel] = 0u;
}

static uint32_t uartRxIsNearFull(uint32_t channel) {
  return uartRxCount[channel] >= ((ZXNEXT_UART_RX_FIFO_SIZE * 3u) >> 2u);
}

static void uartUpdateInterruptStatus(uint32_t channel) {
  if (!uartValidChannel(channel)) return;
  const uint32_t base = channel == 0u ? 0u : 3u;
  zxnextSetUartInterruptStatus(base + 0u, uartRxCount[channel] != 0u);
  zxnextSetUartInterruptStatus(base + 1u, uartRxIsNearFull(channel));
  zxnextSetUartInterruptStatus(base + 2u, uartTxCount[channel] == 0u);
}

static void resetUartChannel(uint32_t channel) {
  uartClearRx(channel);
  uartClearTx(channel);
  uartPrescalerLsb[channel] = ZXNEXT_UART_DEFAULT_PRESCALER & 0x3fffu;
  uartPrescalerMsb[channel] = (ZXNEXT_UART_DEFAULT_PRESCALER >> 14u) & 0x07u;
  uartFrameRegister[channel] = ZXNEXT_UART_DEFAULT_FRAME;
  uartBreakCondition[channel] = 0u;
  uartFramingError[channel] = 0u;
  uartRxOverflow[channel] = 0u;
}

static void resetUartState(void) {
  uartSelected = 0u;
  resetUartChannel(0u);
  resetUartChannel(1u);
  uartTxWriteCount = 0u;
  uartRxInjectCount = 0u;
}

static uint32_t uartPushRx(uint32_t channel, uint32_t value, uint32_t error) {
  if (!uartValidChannel(channel)) return 0u;
  if (uartRxCount[channel] >= ZXNEXT_UART_RX_FIFO_SIZE) {
    uartRxOverflow[channel] = 1u;
    uartUpdateInterruptStatus(channel);
    return 0u;
  }
  uartRxFifo[channel][uartRxWritePtr[channel]] = (uint16_t)((error != 0u ? 0x100u : 0u) | (value & 0xffu));
  uartRxWritePtr[channel] = (uint16_t)((uartRxWritePtr[channel] + 1u) & (ZXNEXT_UART_RX_FIFO_SIZE - 1u));
  uartRxCount[channel]++;
  uartUpdateInterruptStatus(channel);
  return 1u;
}

static uint32_t uartPopRx(uint32_t channel) {
  if (!uartValidChannel(channel) || uartRxCount[channel] == 0u) return 0u;
  const uint32_t value = uartRxFifo[channel][uartRxReadPtr[channel]];
  uartRxReadPtr[channel] = (uint16_t)((uartRxReadPtr[channel] + 1u) & (ZXNEXT_UART_RX_FIFO_SIZE - 1u));
  uartRxCount[channel]--;
  uartUpdateInterruptStatus(channel);
  return value;
}

static uint32_t uartPushTx(uint32_t channel, uint32_t value) {
  if (!uartValidChannel(channel)) return 0u;
  if (uartTxCount[channel] >= ZXNEXT_UART_TX_FIFO_SIZE) return 0u;
  uartTxFifo[channel][uartTxWritePtr[channel]] = (uint8_t)(value & 0xffu);
  uartTxWritePtr[channel] = (uint8_t)((uartTxWritePtr[channel] + 1u) & (ZXNEXT_UART_TX_FIFO_SIZE - 1u));
  uartTxCount[channel]++;
  uartTxWriteCount++;
  uartUpdateInterruptStatus(channel);
  return 1u;
}

static uint32_t uartPopTx(uint32_t channel) {
  if (!uartValidChannel(channel) || uartTxCount[channel] == 0u) return 0xffffffffu;
  const uint32_t value = uartTxFifo[channel][uartTxReadPtr[channel]];
  uartTxReadPtr[channel] = (uint8_t)((uartTxReadPtr[channel] + 1u) & (ZXNEXT_UART_TX_FIFO_SIZE - 1u));
  uartTxCount[channel]--;
  uartUpdateInterruptStatus(channel);
  return value;
}

static uint32_t uartReadStatus(void) {
  const uint32_t channel = uartSelected & 1u;
  const uint32_t errBit8 = uartRxCount[channel] != 0u &&
    (uartRxFifo[channel][uartRxReadPtr[channel]] & 0x100u) != 0u;
  const uint32_t status =
    (uartBreakCondition[channel] != 0u ? 0x80u : 0x00u) |
    (uartFramingError[channel] != 0u ? 0x40u : 0x00u) |
    (errBit8 != 0u ? 0x20u : 0x00u) |
    (uartTxCount[channel] == 0u ? 0x10u : 0x00u) |
    (uartRxIsNearFull(channel) != 0u ? 0x08u : 0x00u) |
    (uartRxOverflow[channel] != 0u ? 0x04u : 0x00u) |
    (uartTxCount[channel] >= ZXNEXT_UART_TX_FIFO_SIZE ? 0x02u : 0x00u) |
    (uartRxCount[channel] != 0u ? 0x01u : 0x00u);
  uartFramingError[channel] = 0u;
  uartRxOverflow[channel] = 0u;
  uartUpdateInterruptStatus(channel);
  return status;
}

static uint32_t zxnextReadUartPort(uint32_t address) {
  const uint16_t port = (uint16_t)(address & 0xffffu);
  if (port != 0x133bu && port != 0x143bu && port != 0x153bu && port != 0x163bu) {
    return ZXNEXT_UART_INVALID_PORT;
  }
  if (isPortGroupEnabled(1u, 4u) == 0u) return 0xffu;
  const uint32_t channel = uartSelected & 1u;
  if (port == 0x133bu) return uartReadStatus();
  if (port == 0x143bu) return uartPopRx(channel) & 0xffu;
  if (port == 0x153bu) return ((uartSelected & 1u) << 6u) | (uartPrescalerMsb[channel] & 0x07u);
  return uartFrameRegister[channel] & 0x7fu;
}

static uint32_t zxnextWriteUartPort(uint32_t address, uint32_t value) {
  const uint16_t port = (uint16_t)(address & 0xffffu);
  if (port != 0x133bu && port != 0x143bu && port != 0x153bu && port != 0x163bu) {
    return 0u;
  }
  if (isPortGroupEnabled(1u, 4u) == 0u) return 1u;
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  const uint32_t channel = uartSelected & 1u;
  if (port == 0x133bu) {
    uartPushTx(channel, byteValue);
    return 1u;
  }
  if (port == 0x143bu) {
    if ((byteValue & 0x80u) != 0u) {
      uartPrescalerLsb[channel] = (uint16_t)((uartPrescalerLsb[channel] & 0x007fu) | ((byteValue & 0x7fu) << 7u));
    } else {
      uartPrescalerLsb[channel] = (uint16_t)((uartPrescalerLsb[channel] & 0x3f80u) | (byteValue & 0x7fu));
    }
    return 1u;
  }
  if (port == 0x153bu) {
    if ((byteValue & 0x10u) != 0u) uartPrescalerMsb[channel] = byteValue & 0x07u;
    uartSelected = (byteValue >> 6u) & 0x01u;
    return 1u;
  }
  if ((byteValue & 0x80u) != 0u) {
    uartClearRx(channel);
    uartClearTx(channel);
    uartBreakCondition[channel] = 0u;
    uartFramingError[channel] = 0u;
    uartRxOverflow[channel] = 0u;
    uartUpdateInterruptStatus(channel);
  }
  uartFrameRegister[channel] = byteValue & 0x7fu;
  return 1u;
}

void zxnextUartOnNewFrame(void) {
  uartClearTx(0u);
  uartClearTx(1u);
  uartUpdateInterruptStatus(0u);
  uartUpdateInterruptStatus(1u);
}

void zxnextPushUartRxByte(uint32_t channel, uint32_t value, uint32_t error) {
  if (uartPushRx(channel & 1u, value, error) != 0u) uartRxInjectCount++;
}

uint32_t zxnextPopUartTxByte(uint32_t channel) { return uartPopTx(channel & 1u); }
void zxnextSetUartBreakCondition(uint32_t channel, uint32_t value) {
  uartBreakCondition[channel & 1u] = value != 0u;
}
void zxnextSetUartFramingError(uint32_t channel, uint32_t value) {
  uartFramingError[channel & 1u] = value != 0u;
}
uint32_t zxnextGetUartSelected(void) { return uartSelected; }
uint32_t zxnextGetUartPrescaler(uint32_t channel) {
  const uint32_t ch = channel & 1u;
  return ((uint32_t)(uartPrescalerMsb[ch] & 0x07u) << 14u) | (uartPrescalerLsb[ch] & 0x3fffu);
}
uint32_t zxnextGetUartPrescalerLsb(uint32_t channel) { return uartPrescalerLsb[channel & 1u]; }
uint32_t zxnextGetUartPrescalerMsb(uint32_t channel) { return uartPrescalerMsb[channel & 1u]; }
uint32_t zxnextGetUartFrameRegister(uint32_t channel) { return uartFrameRegister[channel & 1u]; }
uint32_t zxnextGetUartRxCount(uint32_t channel) { return uartRxCount[channel & 1u]; }
uint32_t zxnextGetUartTxCount(uint32_t channel) { return uartTxCount[channel & 1u]; }
uint32_t zxnextGetUartBreakCondition(uint32_t channel) { return uartBreakCondition[channel & 1u]; }
uint32_t zxnextGetUartFramingError(uint32_t channel) { return uartFramingError[channel & 1u]; }
uint32_t zxnextGetUartRxOverflow(uint32_t channel) { return uartRxOverflow[channel & 1u]; }
uint32_t zxnextGetUartTxWriteCount(void) { return uartTxWriteCount; }
uint32_t zxnextGetUartRxInjectCount(void) { return uartRxInjectCount; }
