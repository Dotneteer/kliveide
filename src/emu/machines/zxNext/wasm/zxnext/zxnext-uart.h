#ifndef ZXNEXT_UART_H
#define ZXNEXT_UART_H

#include <stdint.h>

void zxnextUartReset(void);
void zxnextUartHardReset(void);
uint32_t zxnextUartReadPort(uint32_t address);
void zxnextUartWritePort(uint32_t address, uint32_t value);
void zxnextUartPeerSend(uint32_t channel, uint32_t value, uint32_t kind);
void zxnextUartPeerBreak(uint32_t channel, uint32_t on);
void zxnextUartPeerSetCts(uint32_t channel, uint32_t clear);
void zxnextUartPeerSetLoopback(uint32_t channel, uint32_t on);
uint32_t zxnextUartPeerReadyToReceive(uint32_t channel);
uint32_t zxnextUartPeerOutputCount(uint32_t channel);
uint32_t zxnextUartPeerOutputByte(uint32_t channel, uint32_t index);

#endif
