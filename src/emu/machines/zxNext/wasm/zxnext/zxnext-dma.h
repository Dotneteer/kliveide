#ifndef ZXNEXT_DMA_H
#define ZXNEXT_DMA_H

#include <stdint.h>

void zxnextDmaReset(void);
void zxnextDmaSetMode(uint32_t mode);
void zxnextDmaWritePort(uint32_t value);
uint32_t zxnextDmaExecuteTransfer(uint32_t maxBytes);
uint32_t zxnextDmaReadStatusByte(void);
uint32_t zxnextGetDmaMode(void);
uint32_t zxnextGetDmaStatus(void);
uint32_t zxnextGetDmaReadMask(void);
uint32_t zxnextGetDmaPortAStartAddress(void);
uint32_t zxnextGetDmaPortBStartAddress(void);
uint32_t zxnextGetDmaBlockLength(void);
uint32_t zxnextGetDmaEnabled(void);
uint32_t zxnextGetDmaByteCounter(void);
uint32_t zxnextGetDmaDirectionAtoB(void);
uint32_t zxnextGetDmaPortAConfig(void);
uint32_t zxnextGetDmaPortBConfig(void);
uint32_t zxnextGetDmaTransferMode(void);
uint32_t zxnextGetDmaTransferredBytes(void);

#endif
