#ifndef ZXNEXT_FLOPPY_H
#define ZXNEXT_FLOPPY_H

#include <stdint.h>

void zxnextFloppyReset(void);
uint32_t zxnextFloppyReadMainStatusRegister(void);
uint32_t zxnextFloppyReadDataRegister(void);
void zxnextFloppyWriteDataRegister(uint32_t value);
uint32_t zxnextGetFloppyOperationPhase(void);
uint32_t zxnextGetFloppyCommandRegister(void);
uint32_t zxnextGetFloppyCommandBytesReceived(void);
uint32_t zxnextGetFloppySr0(void);
uint32_t zxnextGetFloppySr1(void);
uint32_t zxnextGetFloppySr2(void);
uint32_t zxnextGetFloppySr3(void);
uint32_t zxnextGetFloppyStepRate(void);
uint32_t zxnextGetFloppyHeadUnloadTime(void);
uint32_t zxnextGetFloppyHeadLoadTime(void);
uint32_t zxnextGetFloppyNonDmaMode(void);

#endif
