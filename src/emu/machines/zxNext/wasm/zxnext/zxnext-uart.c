#include "zxnext-uart.h"

/*
 * The two UARTs (serial/uart.vhd, uart_tx.vhd, uart_rx.vhd, fifop.vhd), with the serial lines modelled
 * a frame at a time on the 28 MHz clock. The same model as UartDevice.ts: UART 0 goes to the ESP,
 * UART 1 to the Pi; neither exists here, so a *peer* drives the RX line (zxnextUartPeer*) and collects
 * what the Next transmits. Time is advanced lazily (zxnextUartSync) before every port access, interrupt
 * check and interrupt status read.
 */

#define ZXNEXT_UART_RX_CAPACITY 512u
#define ZXNEXT_UART_TX_CAPACITY 64u
#define ZXNEXT_UART_RX_NEAR_FULL 384u
#define ZXNEXT_UART_RX_ALMOST_FULL 510u
#define ZXNEXT_UART_PEER_QUEUE 4096u
#define ZXNEXT_UART_PEER_OUTPUT 4096u
#define ZXNEXT_UART_NEVER 0xffffffffffffffffull

#define ZXNEXT_UART_FRAME_RESET 0x80u
#define ZXNEXT_UART_FRAME_BREAK 0x40u
#define ZXNEXT_UART_FRAME_FLOW 0x20u

/* Peer segment kinds: 0 byte, 1 parity error, 2 stop-bit error, 3 break */
#define ZXNEXT_UART_KIND_BYTE 0u
#define ZXNEXT_UART_KIND_PARITY 1u
#define ZXNEXT_UART_KIND_FRAMING 2u
#define ZXNEXT_UART_KIND_BREAK 3u

/* Defined later in the unity build (zxnext-interrupts.c) */
static void zxnextInterruptsRequest(uint32_t index, uint32_t enabled, uint32_t pulse);

typedef struct {
  uint8_t active;
  uint8_t kind;
  uint8_t value;
  uint8_t availDone;
  uint8_t isVoid;
  uint64_t availAt;
  uint64_t endAt;
  uint64_t breakAt;
} ZxNextUartSegment;

typedef struct {
  uint16_t prescalerLsb;
  uint8_t prescalerMsb;
  uint8_t frame;

  uint16_t rx[ZXNEXT_UART_RX_CAPACITY];
  uint16_t rxHead;
  uint16_t rxCount;
  int32_t rxHeld; /* uart0_rx_avail_d: a byte waiting for room (-1: none) */
  uint8_t errOverflow;
  uint8_t errFraming;

  uint8_t tx[ZXNEXT_UART_TX_CAPACITY];
  uint8_t txHead;
  uint8_t txCount;
  uint8_t txState; /* 0 S_IDLE, 1 S_RTR (byte taken, waiting for CTS), 2 sending */
  uint8_t txByte;
  uint64_t txEnd;

  uint16_t peerQueue[ZXNEXT_UART_PEER_QUEUE]; /* kind << 8 | value */
  uint16_t peerQueueHead;
  uint16_t peerQueueCount;
  ZxNextUartSegment peerCurrent;
  uint64_t peerLineFreeAt;
  uint8_t peerCtsClear;
  uint8_t peerLoopback;
  uint8_t peerOutput[ZXNEXT_UART_PEER_OUTPUT];
  uint32_t peerOutputTotal;

  /* im2_peripheral int_req_d */
  uint8_t prevRxReq;
  uint8_t prevTxReq;
} ZxNextUartChannel;

static ZxNextUartChannel zxnextUartChannels[2];
static uint8_t zxnextUartSelected;
static ZxNextClock28 zxnextUartClock;
static uint64_t zxnextUartNextEvent = ZXNEXT_UART_NEVER;
/* Set while resetting: the reset branch clears $C6, which the NextReg soft reset stores only later */
static uint8_t zxnextUartInReset;

static ZxNextUartChannel *zxnextUartChannel(uint32_t channel) {
  return &zxnextUartChannels[channel & 1u];
}

/* start + 5-8 data (frame bits 4-3) + parity (bit 2) + 1 or 2 stop (bit 0) */
static uint32_t zxnextUartFrameBits(uint8_t frame) {
  return 1u + 5u + ((frame >> 3) & 0x03u) + ((frame >> 2) & 0x01u) + 1u + (frame & 0x01u);
}

static uint8_t zxnextUartDataMask(uint8_t frame) {
  return (uint8_t)((1u << (5u + ((frame >> 3) & 0x03u))) - 1u);
}

/* One bit in 28 MHz clocks: the timers reload with the prescaler; 0 and 1 act as 1 */
static uint64_t zxnextUartBitTicks(ZxNextUartChannel *ch) {
  uint32_t p = ((uint32_t)(ch->prescalerMsb & 0x07u) << 14) | (ch->prescalerLsb & 0x3fffu);
  return p < 1u ? 1u : p;
}

static uint8_t zxnextUartTxBusy(ZxNextUartChannel *ch) {
  return ch->txState != 0u || (ch->frame & (ZXNEXT_UART_FRAME_RESET | ZXNEXT_UART_FRAME_BREAK)) != 0u;
}

/* o_Rx_rtr_n = 0 */
static uint8_t zxnextUartReadyToReceive(ZxNextUartChannel *ch) {
  if ((ch->frame & ZXNEXT_UART_FRAME_FLOW) == 0u) return 1;
  return (ch->frame & ZXNEXT_UART_FRAME_RESET) == 0u && ch->rxCount < ZXNEXT_UART_RX_ALMOST_FULL;
}

static void zxnextUartRxPush(ZxNextUartChannel *ch, uint16_t value) {
  ch->rx[(ch->rxHead + ch->rxCount) % ZXNEXT_UART_RX_CAPACITY] = value;
  ch->rxCount++;
}

static uint16_t zxnextUartRxPop(ZxNextUartChannel *ch) {
  uint16_t value = ch->rx[ch->rxHead];
  ch->rxHead = (uint16_t)((ch->rxHead + 1u) % ZXNEXT_UART_RX_CAPACITY);
  ch->rxCount--;
  return value;
}

static uint8_t zxnextUartTxPop(ZxNextUartChannel *ch) {
  uint8_t value = ch->tx[ch->txHead];
  ch->txHead = (uint8_t)((ch->txHead + 1u) % ZXNEXT_UART_TX_CAPACITY);
  ch->txCount--;
  return value;
}

/* uart0_fifo_reset: FIFOs empty, errors clear, the transmitter idle, a frame on the RX line garbled */
static void zxnextUartResetFifos(ZxNextUartChannel *ch) {
  ch->rxHead = ch->rxCount = 0;
  ch->rxHeld = -1;
  ch->errOverflow = ch->errFraming = 0;
  ch->txHead = ch->txCount = 0;
  ch->txState = 0;
  if (ch->peerCurrent.active) ch->peerCurrent.isVoid = 1;
}

// ==========================================================================
// Time

static uint64_t zxnextUartNow(void) {
  return zxnextClock28Now(&zxnextUartClock);
}

static void zxnextUartUpdateNextEvent(void) {
  uint64_t next = ZXNEXT_UART_NEVER;
  for (uint32_t i = 0; i < 2u; i++) {
    ZxNextUartChannel *ch = &zxnextUartChannels[i];
    if (ch->txState == 2u && ch->txEnd < next) next = ch->txEnd;
    if (ch->peerCurrent.active) {
      uint64_t at = ch->peerCurrent.availDone ? ch->peerCurrent.endAt : ch->peerCurrent.availAt;
      if (at < next) next = at;
    }
  }
  zxnextUartNextEvent = next;
}

// ==========================================================================
// Interrupts (zxnext.vhd ~1897)

/*
 * RX: near full, or available unless $C6 asks for near full only; TX: the TX FIFO empty. A rising level
 * is an im2_peripheral request edge: the status latches and, when enabled, it interrupts.
 */
static void zxnextUartUpdateInterrupts(void) {
  uint8_t c6 = zxnextUartInReset ? 0u : zxnextNextRegs[0xc6u];
  for (uint32_t i = 0; i < 2u; i++) {
    ZxNextUartChannel *ch = &zxnextUartChannels[i];
    uint8_t en = (uint8_t)(i == 0u ? c6 & 0x07u : (c6 >> 4) & 0x07u);
    uint8_t rxReq = ch->rxCount >= ZXNEXT_UART_RX_NEAR_FULL || (ch->rxCount != 0u && (en & 0x02u) == 0u);
    uint8_t txReq = ch->txCount == 0u;
    if (rxReq && !ch->prevRxReq) zxnextInterruptsRequest(i == 0u ? 1u : 2u, (en & 0x03u) != 0u, 1);
    if (txReq && !ch->prevTxReq) zxnextInterruptsRequest(i == 0u ? 12u : 13u, (en & 0x04u) != 0u, 1);
    ch->prevRxReq = rxReq;
    ch->prevTxReq = txReq;
  }
}

// ==========================================================================
// Transmitter (uart_tx.vhd)

/* S_RTR -> S_START once CTS is clear or flow control is off; frame and prescaler sampled now */
static void zxnextUartTxTrySend(ZxNextUartChannel *ch, uint64_t at) {
  if (ch->txState != 1u) return;
  if ((ch->frame & ZXNEXT_UART_FRAME_FLOW) != 0u && !ch->peerCtsClear) return;
  ch->txState = 2;
  ch->txEnd = at + zxnextUartFrameBits(ch->frame) * zxnextUartBitTicks(ch);
}

/* S_IDLE takes a byte when the FIFO has one and neither reset (bit 7) nor break (bit 6) holds it */
static void zxnextUartTxTryStart(ZxNextUartChannel *ch, uint64_t at) {
  if (ch->txState != 0u || ch->txCount == 0u || (ch->frame & (ZXNEXT_UART_FRAME_RESET | ZXNEXT_UART_FRAME_BREAK)) != 0u) return;
  ch->txByte = zxnextUartTxPop(ch) & zxnextUartDataMask(ch->frame);
  ch->txState = 1;
  zxnextUartTxTrySend(ch, at);
}

// ==========================================================================
// Receiver (uart_rx.vhd) and the RX FIFO

/* o_Rx_avail: into the FIFO, or held while it is full; a byte arriving while one is held overflows */
static void zxnextUartRxReceive(ZxNextUartChannel *ch, uint8_t value) {
  if ((ch->frame & ZXNEXT_UART_FRAME_RESET) != 0u) return;
  if (ch->rxHeld >= 0) {
    ch->errOverflow = 1;
    return;
  }
  uint16_t entry = (uint16_t)(value | ((ch->errOverflow || ch->errFraming) ? 0x100u : 0u));
  if (ch->rxCount == ZXNEXT_UART_RX_CAPACITY) ch->rxHeld = entry;
  else zxnextUartRxPush(ch, entry);
}

/* The peer starts its next frame when the line is free and the Next is ready to receive */
static void zxnextUartPeerTryStart(ZxNextUartChannel *ch, uint64_t at) {
  if (ch->peerCurrent.active || ch->peerQueueCount == 0u || ch->peerLoopback || !zxnextUartReadyToReceive(ch)) return;
  uint16_t next = ch->peerQueue[ch->peerQueueHead];
  ch->peerQueueHead = (uint16_t)((ch->peerQueueHead + 1u) % ZXNEXT_UART_PEER_QUEUE);
  ch->peerQueueCount--;
  uint64_t start = at > ch->peerLineFreeAt ? at : ch->peerLineFreeAt;
  uint64_t p = zxnextUartBitTicks(ch);
  uint64_t bits = zxnextUartFrameBits(ch->frame);
  ZxNextUartSegment *cur = &ch->peerCurrent;
  cur->active = 1;
  cur->kind = (uint8_t)(next >> 8);
  cur->value = (uint8_t)next;
  cur->availDone = 0;
  /* uart_rx samples mid-bit: the stop bit (or the error) is known half a bit before the frame ends */
  cur->availAt = start + bits * p - (p >> 1);
  cur->endAt = cur->kind == ZXNEXT_UART_KIND_BREAK ? ZXNEXT_UART_NEVER : start + bits * p;
  cur->breakAt = cur->availAt + 8u * p;
  cur->isVoid = (ch->frame & ZXNEXT_UART_FRAME_RESET) != 0u;
}

static void zxnextUartPeerFrameReceived(ZxNextUartChannel *ch) {
  ZxNextUartSegment *cur = &ch->peerCurrent;
  cur->availDone = 1;
  if (cur->isVoid || (ch->frame & ZXNEXT_UART_FRAME_RESET) != 0u) return;
  uint8_t parityEnabled = (ch->frame & 0x04u) != 0u;
  if (cur->kind == ZXNEXT_UART_KIND_BYTE || (cur->kind == ZXNEXT_UART_KIND_PARITY && !parityEnabled)) {
    zxnextUartRxReceive(ch, cur->value & zxnextUartDataMask(ch->frame));
  } else {
    /* A parity or stop-bit error throws the byte away and latches the framing error */
    ch->errFraming = 1;
  }
}

/* o_err_break: the receiver sits in S_ERROR with 8 zero bits shifted in */
static uint8_t zxnextUartBreakActive(ZxNextUartChannel *ch, uint64_t now) {
  ZxNextUartSegment *cur = &ch->peerCurrent;
  return cur->active && cur->kind == ZXNEXT_UART_KIND_BREAK && !cur->isVoid &&
    (ch->frame & ZXNEXT_UART_FRAME_RESET) == 0u && now >= cur->breakAt && now < cur->endAt;
}

/* Processes the line events up to `target` in time order */
static void zxnextUartAdvanceTo(uint64_t target) {
  while (1) {
    uint64_t at = ZXNEXT_UART_NEVER;
    int32_t which = -1;
    uint32_t what = 0; /* 0 TX done, 1 RX frame received, 2 RX line free */
    for (uint32_t i = 0; i < 2u; i++) {
      ZxNextUartChannel *ch = &zxnextUartChannels[i];
      if (ch->txState == 2u && ch->txEnd < at) { at = ch->txEnd; which = (int32_t)i; what = 0; }
      if (ch->peerCurrent.active && !ch->peerCurrent.availDone && ch->peerCurrent.availAt < at) {
        at = ch->peerCurrent.availAt; which = (int32_t)i; what = 1;
      }
      if (ch->peerCurrent.active && ch->peerCurrent.availDone && ch->peerCurrent.endAt < at) {
        at = ch->peerCurrent.endAt; which = (int32_t)i; what = 2;
      }
    }
    if (which < 0 || at > target) break;
    ZxNextUartChannel *ch = &zxnextUartChannels[which];
    if (what == 0u) {
      /* The stop bit ends: the peer has the byte; the transmitter takes the next one */
      uint8_t value = ch->txByte;
      ch->txState = 0;
      ch->peerOutput[ch->peerOutputTotal % ZXNEXT_UART_PEER_OUTPUT] = value;
      ch->peerOutputTotal++;
      if (ch->peerLoopback) zxnextUartRxReceive(ch, value);
      zxnextUartTxTryStart(ch, at);
    } else if (what == 1u) {
      zxnextUartPeerFrameReceived(ch);
    } else {
      ch->peerCurrent.active = 0;
      ch->peerLineFreeAt = at;
      zxnextUartPeerTryStart(ch, at);
    }
    zxnextUartUpdateInterrupts();
  }
  zxnextUartUpdateNextEvent();
}

/* Brings both UARTs up to the current 28 MHz clock */
static uint64_t zxnextUartSync(void) {
  uint64_t now = zxnextUartNow();
  if (now >= zxnextUartNextEvent) zxnextUartAdvanceTo(now);
  return now;
}

/* After a state change at `now`: the peers and transmitters may continue, the levels may rise */
static void zxnextUartSettle(uint64_t now) {
  for (uint32_t i = 0; i < 2u; i++) {
    ZxNextUartChannel *ch = &zxnextUartChannels[i];
    zxnextUartTxTryStart(ch, now);
    zxnextUartTxTrySend(ch, now);
    zxnextUartPeerTryStart(ch, now);
  }
  zxnextUartUpdateInterrupts();
  zxnextUartUpdateNextEvent();
}

// ==========================================================================
// Reset

/* Soft reset (i_reset): select UART 0, empty the FIFOs; the prescalers and frame registers stay */
void zxnextUartReset(void) {
  uint64_t now = zxnextUartNow();
  zxnextUartSelected = 0;
  for (uint32_t i = 0; i < 2u; i++) {
    ZxNextUartChannel *ch = &zxnextUartChannels[i];
    zxnextUartResetFifos(ch);
    ch->prevRxReq = ch->prevTxReq = 0;
  }
  /* im2_peripheral: int_req_d is 0 in reset, so the TX empty level is an edge right after it */
  zxnextUartInReset = 1;
  zxnextUartUpdateInterrupts();
  zxnextUartInReset = 0;
  for (uint32_t i = 0; i < 2u; i++) zxnextUartPeerTryStart(&zxnextUartChannels[i], now);
  zxnextUartUpdateNextEvent();
}

/* Power-on (a hard reset reloads the FPGA core): every register to its initial value, the peers too */
void zxnextUartHardReset(void) {
  for (uint32_t i = 0; i < 2u; i++) {
    ZxNextUartChannel *ch = &zxnextUartChannels[i];
    ch->prescalerLsb = 243; /* 115200 baud at 28 MHz */
    ch->prescalerMsb = 0;
    ch->frame = 0x18;
    ch->peerQueueHead = ch->peerQueueCount = 0;
    ch->peerCurrent.active = 0;
    ch->peerLineFreeAt = 0;
    ch->peerCtsClear = 1;
    ch->peerLoopback = 0;
    ch->peerOutputTotal = 0;
  }
  zxnextUartReset();
}

// ==========================================================================
// Ports

uint32_t zxnextUartReadPort(uint32_t address) {
  uint64_t now = zxnextUartSync();
  ZxNextUartChannel *ch = zxnextUartChannel(zxnextUartSelected);
  switch (address & 0xffffu) {
    case 0x133bu: {
      uint16_t head = ch->rxCount ? ch->rx[ch->rxHead] : 0u;
      uint32_t status = (zxnextUartBreakActive(ch, now) ? 0x80u : 0u) |
        (ch->errFraming ? 0x40u : 0u) |
        ((head & 0x100u) ? 0x20u : 0u) |
        ((ch->txCount == 0u && !zxnextUartTxBusy(ch)) ? 0x10u : 0u) |
        (ch->rxCount >= ZXNEXT_UART_RX_NEAR_FULL ? 0x08u : 0u) |
        (ch->errOverflow ? 0x04u : 0u) |
        (ch->txCount == ZXNEXT_UART_TX_CAPACITY ? 0x02u : 0u) |
        (ch->rxCount ? 0x01u : 0u);
      /* uart0_tx_rd_fe: the end of the status read clears the overflow and framing errors */
      ch->errOverflow = ch->errFraming = 0;
      return status;
    }
    case 0x143bu: {
      if (ch->rxCount == 0u) return 0;
      uint16_t value = zxnextUartRxPop(ch);
      if (ch->rxHeld >= 0) {
        zxnextUartRxPush(ch, (uint16_t)ch->rxHeld);
        ch->rxHeld = -1;
      }
      zxnextUartSettle(now);
      return value & 0xffu;
    }
    case 0x153bu:
      /* "00000" & UART 0's prescaler MSB, or "01000" & UART 1's */
      return ((uint32_t)zxnextUartSelected << 6) | (ch->prescalerMsb & 0x07u);
    case 0x163bu:
      return ch->frame;
    default:
      return 0xffu;
  }
}

void zxnextUartWritePort(uint32_t address, uint32_t value) {
  uint64_t now = zxnextUartSync();
  ZxNextUartChannel *ch = zxnextUartChannel(zxnextUartSelected);
  uint8_t byteValue = (uint8_t)value;
  switch (address & 0xffffu) {
    case 0x133bu:
      /* The FIFO ignores writes while full or held in reset */
      if ((ch->frame & ZXNEXT_UART_FRAME_RESET) != 0u || ch->txCount == ZXNEXT_UART_TX_CAPACITY) break;
      ch->tx[(ch->txHead + ch->txCount) % ZXNEXT_UART_TX_CAPACITY] = byteValue;
      ch->txCount++;
      zxnextUartUpdateInterrupts();
      zxnextUartSettle(now);
      break;
    case 0x143bu:
      if (byteValue & 0x80u) ch->prescalerLsb = (uint16_t)((ch->prescalerLsb & 0x007fu) | ((uint16_t)(byteValue & 0x7fu) << 7));
      else ch->prescalerLsb = (uint16_t)((ch->prescalerLsb & 0x3f80u) | (byteValue & 0x7fu));
      break;
    case 0x153bu:
      /* Bit 6 selects; with bit 4, bits 2-0 go to the MSB of the UART this write selects */
      zxnextUartSelected = (byteValue >> 6) & 0x01u;
      if (byteValue & 0x10u) zxnextUartChannel(zxnextUartSelected)->prescalerMsb = byteValue & 0x07u;
      break;
    case 0x163bu:
      /* All 8 bits stored; bit 7 holds the FIFOs and state machines in reset while set */
      ch->frame = byteValue;
      if (byteValue & ZXNEXT_UART_FRAME_RESET) zxnextUartResetFifos(ch);
      zxnextUartSettle(now);
      break;
  }
}

/* $C6 changes the RX request level (near full only or not) */
static void zxnextUartOnInterruptEnableChanged(void) {
  zxnextUartSync();
  zxnextUartUpdateInterrupts();
}

// ==========================================================================
// The peer

/* Frames on the Next's RX line, back to back at the Next's own baud rate: kind 0 byte, 1 parity error,
   2 stop-bit error */
void zxnextUartPeerSend(uint32_t channel, uint32_t value, uint32_t kind) {
  uint64_t now = zxnextUartSync();
  ZxNextUartChannel *ch = zxnextUartChannel(channel);
  if (ch->peerQueueCount < ZXNEXT_UART_PEER_QUEUE) {
    ch->peerQueue[(ch->peerQueueHead + ch->peerQueueCount) % ZXNEXT_UART_PEER_QUEUE] = (uint16_t)(((kind & 0x03u) << 8) | (value & 0xffu));
    ch->peerQueueCount++;
  }
  zxnextUartSettle(now);
}

/* Holds the RX line low after the queued frames, or releases it (a break is at least one frame long) */
void zxnextUartPeerBreak(uint32_t channel, uint32_t on) {
  uint64_t now = zxnextUartSync();
  ZxNextUartChannel *ch = zxnextUartChannel(channel);
  if (on) {
    if (ch->peerQueueCount < ZXNEXT_UART_PEER_QUEUE) {
      ch->peerQueue[(ch->peerQueueHead + ch->peerQueueCount) % ZXNEXT_UART_PEER_QUEUE] = (uint16_t)(ZXNEXT_UART_KIND_BREAK << 8);
      ch->peerQueueCount++;
    }
  } else {
    /* Drop a break still waiting in the queue */
    for (uint32_t i = 0; i < ch->peerQueueCount; i++) {
      uint32_t slot = (ch->peerQueueHead + i) % ZXNEXT_UART_PEER_QUEUE;
      if ((ch->peerQueue[slot] >> 8) == ZXNEXT_UART_KIND_BREAK) {
        for (uint32_t j = i; j + 1u < ch->peerQueueCount; j++) {
          ch->peerQueue[(ch->peerQueueHead + j) % ZXNEXT_UART_PEER_QUEUE] = ch->peerQueue[(ch->peerQueueHead + j + 1u) % ZXNEXT_UART_PEER_QUEUE];
        }
        ch->peerQueueCount--;
        break;
      }
    }
    ZxNextUartSegment *cur = &ch->peerCurrent;
    if (cur->active && cur->kind == ZXNEXT_UART_KIND_BREAK && cur->endAt == ZXNEXT_UART_NEVER) {
      cur->endAt = now > cur->availAt ? now : cur->availAt;
    }
  }
  zxnextUartSettle(now);
}

/* The peer's RTS, the Next's CTS */
void zxnextUartPeerSetCts(uint32_t channel, uint32_t clear) {
  uint64_t now = zxnextUartSync();
  zxnextUartChannel(channel)->peerCtsClear = clear != 0u;
  zxnextUartSettle(now);
}

/* A wire from the Next's TX to its own RX */
void zxnextUartPeerSetLoopback(uint32_t channel, uint32_t on) {
  uint64_t now = zxnextUartSync();
  zxnextUartChannel(channel)->peerLoopback = on != 0u;
  zxnextUartSettle(now);
}

uint32_t zxnextUartPeerReadyToReceive(uint32_t channel) {
  zxnextUartSync();
  return zxnextUartReadyToReceive(zxnextUartChannel(channel));
}

/* The bytes the Next transmitted: the last ZXNEXT_UART_PEER_OUTPUT of them */
uint32_t zxnextUartPeerOutputCount(uint32_t channel) {
  zxnextUartSync();
  uint32_t total = zxnextUartChannel(channel)->peerOutputTotal;
  return total < ZXNEXT_UART_PEER_OUTPUT ? total : ZXNEXT_UART_PEER_OUTPUT;
}

uint32_t zxnextUartPeerOutputByte(uint32_t channel, uint32_t index) {
  ZxNextUartChannel *ch = zxnextUartChannel(channel);
  uint32_t kept = ch->peerOutputTotal < ZXNEXT_UART_PEER_OUTPUT ? ch->peerOutputTotal : ZXNEXT_UART_PEER_OUTPUT;
  if (index >= kept) return 0;
  return ch->peerOutput[(ch->peerOutputTotal - kept + index) % ZXNEXT_UART_PEER_OUTPUT];
}
