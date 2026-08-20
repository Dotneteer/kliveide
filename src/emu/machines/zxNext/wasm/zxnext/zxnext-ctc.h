#ifndef ZXNEXT_CTC_H
#define ZXNEXT_CTC_H

#include <stdint.h>

void zxnextCtcReset(void);
void zxnextCtcClock(uint32_t channel, uint32_t iowr, uint32_t cpuData, uint32_t clkTrg, uint32_t intEnWr, uint32_t intEn);
uint32_t zxnextGetCtcState(uint32_t channel);
uint32_t zxnextGetCtcControlReg(uint32_t channel);
uint32_t zxnextGetCtcTimeConstant(uint32_t channel);
uint32_t zxnextGetCtcCount(uint32_t channel);
uint32_t zxnextGetCtcZcTo(uint32_t channel);
uint32_t zxnextGetCtcIntEnabled(uint32_t channel);
uint32_t zxnextGetCtcExpectingTimeConstant(uint32_t channel);

#endif
