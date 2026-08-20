#ifndef ZXNEXT_INTERRUPTS_H
#define ZXNEXT_INTERRUPTS_H

#include <stdint.h>

static void zxnextInterruptsReset(void);
static uint32_t zxnextInterruptsGetNextRegister(uint32_t reg);
static uint32_t zxnextInterruptsHandlesNextRegister(uint32_t reg);
static void zxnextInterruptsSetNextRegister(uint32_t reg, uint32_t value);
static void zxnextInterruptsSetSignalInt(uint32_t active);
static uint32_t zxnextInterruptsGetSignalInt(void);
static uint32_t zxnextInterruptsGetLastVector(void);
static uint32_t zxnextInterruptsGetDaisyInService(uint32_t index);
static void zxnextInterruptsSetDaisyStatus(uint32_t index, uint32_t active);
static void zxnextInterruptsSetDaisyEnabled(uint32_t index, uint32_t active);
static uint32_t zxnextInterruptsShouldAcceptInt(void);
static uint32_t zxnextInterruptsAcknowledge(void);
static void zxnextInterruptsReti(void);

#endif
