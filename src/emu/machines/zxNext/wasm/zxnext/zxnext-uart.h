#ifndef ZXNEXT_UART_H
#define ZXNEXT_UART_H

#include <stdint.h>

void zxnextUartReset(void);
uint32_t zxnextUartReadPort(uint32_t address);
void zxnextUartWritePort(uint32_t address, uint32_t value);
void zxnextUartPushRxByte(uint32_t channel, uint32_t value, uint32_t error);
uint32_t zxnextUartPopTxByte(uint32_t channel);
uint32_t zxnextUartHasTxData(uint32_t channel);
void zxnextUartDrainTxFifo(uint32_t channel);
void zxnextUartSetBreakCondition(uint32_t channel, uint32_t value);
void zxnextUartSetFramingError(uint32_t channel, uint32_t value);
uint32_t zxnextGetUartSelected(void);
uint32_t zxnextGetUartPrescaler(uint32_t channel);
uint32_t zxnextGetUartFrameRegister(uint32_t channel);
uint32_t zxnextGetUartRxCount(uint32_t channel);
uint32_t zxnextGetUartTxCount(uint32_t channel);

#endif
