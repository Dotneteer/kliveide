#ifndef ZXNEXT_DMA_H
#define ZXNEXT_DMA_H

#include <stdint.h>

void zxnextDmaReset(void);
void zxnextDmaSetMode(uint32_t mode);
void zxnextDmaWritePort(uint32_t value);
uint32_t zxnextDmaReadStatusByte(void);
uint32_t zxnextGetDmaMode(void);
uint32_t zxnextGetDmaStatus(void);
uint32_t zxnextGetDmaReadMask(void);
uint32_t zxnextGetDmaPortAStartAddress(void);
uint32_t zxnextGetDmaPortBStartAddress(void);
uint32_t zxnextGetDmaBlockLength(void);
uint32_t zxnextGetDmaEnabled(void);
uint32_t zxnextGetDmaByteCounter(void);

#endif
