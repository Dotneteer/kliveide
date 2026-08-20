#include "zxnext-uart.h"

#define ZXNEXT_UART_RX_CAPACITY 512
#define ZXNEXT_UART_TX_CAPACITY 64

typedef struct {
  uint16_t rx[ZXNEXT_UART_RX_CAPACITY];
  uint8_t tx[ZXNEXT_UART_TX_CAPACITY];
  uint16_t rxHead;
  uint16_t rxTail;
  uint16_t rxCount;
  uint8_t txHead;
  uint8_t txTail;
  uint8_t txCount;
  uint16_t prescalerLsb;
  uint8_t prescalerMsb;
  uint8_t frameRegister;
  uint8_t breakCondition;
  uint8_t framingError;
  uint8_t rxOverflow;
} ZxNextUartChannel;

static ZxNextUartChannel zxnextUartChannels[2];
static uint8_t zxnextUartSelected;

static ZxNextUartChannel *zxnextUartChannel(uint32_t channel) {
  return &zxnextUartChannels[channel & 1u];
}

static void zxnextUartResetChannel(ZxNextUartChannel *ch) {
  ch->rxHead = 0;
  ch->rxTail = 0;
  ch->rxCount = 0;
  ch->txHead = 0;
  ch->txTail = 0;
  ch->txCount = 0;
  ch->prescalerLsb = 243;
  ch->prescalerMsb = 0;
  ch->frameRegister = 0x18;
  ch->breakCondition = 0;
  ch->framingError = 0;
  ch->rxOverflow = 0;
}

void zxnextUartReset(void) {
  zxnextUartSelected = 0;
  zxnextUartResetChannel(&zxnextUartChannels[0]);
  zxnextUartResetChannel(&zxnextUartChannels[1]);
}

static uint32_t zxnextUartReadTxStatus(void) {
  ZxNextUartChannel *ch = zxnextUartChannel(zxnextUartSelected);
  uint32_t status = 0;
  if (ch->breakCondition) status |= 0x80u;
  if (ch->framingError) status |= 0x40u;
  if (ch->rxCount != 0 && (ch->rx[ch->rxTail] & 0x100u)) status |= 0x20u;
  if (ch->txCount == 0) status |= 0x10u;
  if (ch->rxCount >= (ZXNEXT_UART_RX_CAPACITY * 3 / 4)) status |= 0x08u;
  if (ch->rxOverflow) status |= 0x04u;
  if (ch->txCount >= ZXNEXT_UART_TX_CAPACITY) status |= 0x02u;
  if (ch->rxCount != 0) status |= 0x01u;
  ch->framingError = 0;
  ch->rxOverflow = 0;
  return status;
}

uint32_t zxnextUartReadPort(uint32_t address) {
  ZxNextUartChannel *ch = zxnextUartChannel(zxnextUartSelected);
  switch (address & 0xffffu) {
    case 0x133bu:
      return zxnextUartReadTxStatus();
    case 0x143bu:
      if (ch->rxCount == 0) return 0;
      {
        uint16_t value = ch->rx[ch->rxTail];
        ch->rxTail = (ch->rxTail + 1) % ZXNEXT_UART_RX_CAPACITY;
        ch->rxCount--;
        return value & 0xffu;
      }
    case 0x153bu:
      return ((uint32_t)zxnextUartSelected << 6) | (ch->prescalerMsb & 0x07u);
    case 0x163bu:
      return ch->frameRegister;
    default:
      return 0xffu;
  }
}

void zxnextUartWritePort(uint32_t address, uint32_t value) {
  ZxNextUartChannel *ch = zxnextUartChannel(zxnextUartSelected);
  uint8_t byteValue = (uint8_t)value;
  switch (address & 0xffffu) {
    case 0x133bu:
      if (ch->txCount < ZXNEXT_UART_TX_CAPACITY) {
        ch->tx[ch->txHead] = byteValue;
        ch->txHead = (ch->txHead + 1) % ZXNEXT_UART_TX_CAPACITY;
        ch->txCount++;
      }
      break;
    case 0x143bu:
      if (byteValue & 0x80u) ch->prescalerLsb = (ch->prescalerLsb & 0x007fu) | ((uint16_t)(byteValue & 0x7fu) << 7);
      else ch->prescalerLsb = (ch->prescalerLsb & 0x3f80u) | (byteValue & 0x7fu);
      break;
    case 0x153bu:
      if (byteValue & 0x10u) ch->prescalerMsb = byteValue & 0x07u;
      zxnextUartSelected = (byteValue >> 6) & 0x01u;
      break;
    case 0x163bu:
      if (byteValue & 0x80u) {
        ch->rxHead = ch->rxTail = ch->rxCount = 0;
        ch->txHead = ch->txTail = ch->txCount = 0;
        ch->breakCondition = 0;
        ch->framingError = 0;
        ch->rxOverflow = 0;
      }
      ch->frameRegister = byteValue & 0x7fu;
      break;
  }
}

void zxnextUartPushRxByte(uint32_t channel, uint32_t value, uint32_t error) {
  ZxNextUartChannel *ch = zxnextUartChannel(channel);
  if (ch->rxCount >= ZXNEXT_UART_RX_CAPACITY) {
    ch->rxOverflow = 1;
    return;
  }
  ch->rx[ch->rxHead] = (uint16_t)((error ? 0x100u : 0u) | (value & 0xffu));
  ch->rxHead = (ch->rxHead + 1) % ZXNEXT_UART_RX_CAPACITY;
  ch->rxCount++;
}

uint32_t zxnextUartPopTxByte(uint32_t channel) {
  ZxNextUartChannel *ch = zxnextUartChannel(channel);
  if (ch->txCount == 0) return 0xffffffffu;
  uint8_t value = ch->tx[ch->txTail];
  ch->txTail = (ch->txTail + 1) % ZXNEXT_UART_TX_CAPACITY;
  ch->txCount--;
  return value;
}

uint32_t zxnextUartHasTxData(uint32_t channel) { return zxnextUartChannel(channel)->txCount != 0; }
void zxnextUartDrainTxFifo(uint32_t channel) { zxnextUartChannel(channel)->txHead = zxnextUartChannel(channel)->txTail = zxnextUartChannel(channel)->txCount = 0; }
void zxnextUartSetBreakCondition(uint32_t channel, uint32_t value) { zxnextUartChannel(channel)->breakCondition = value != 0; }
void zxnextUartSetFramingError(uint32_t channel, uint32_t value) { zxnextUartChannel(channel)->framingError = value != 0; }
uint32_t zxnextGetUartSelected(void) { return zxnextUartSelected; }
uint32_t zxnextGetUartPrescaler(uint32_t channel) {
  ZxNextUartChannel *ch = zxnextUartChannel(channel);
  return ((uint32_t)(ch->prescalerMsb & 0x07u) << 14) | (ch->prescalerLsb & 0x3fffu);
}
uint32_t zxnextGetUartFrameRegister(uint32_t channel) { return zxnextUartChannel(channel)->frameRegister; }
uint32_t zxnextGetUartRxCount(uint32_t channel) { return zxnextUartChannel(channel)->rxCount; }
uint32_t zxnextGetUartTxCount(uint32_t channel) { return zxnextUartChannel(channel)->txCount; }
