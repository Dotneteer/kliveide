#ifndef ZXNEXT_DMA_H
#define ZXNEXT_DMA_H

#include <stdint.h>

void zxnextDmaReset(void);
void zxnextDmaSetMode(uint32_t mode);
void zxnextDmaWritePort(uint32_t value);
uint32_t zxnextDmaReadStatusByte(void);
uint32_t zxnextGetDmaMode(void);
uint32_t zxnextGetDmaSeq(void);
uint32_t zxnextGetDmaByteCounter(void);
uint32_t zxnextGetDmaAddressA(void);
uint32_t zxnextGetDmaAddressB(void);

#endif
