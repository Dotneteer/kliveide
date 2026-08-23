#ifndef ZXNEXT_DAC_H
#define ZXNEXT_DAC_H

#include <stdint.h>

static void zxnextDacReset(void);
static uint32_t zxnextDacHandlesNextReg(uint32_t reg);
static void zxnextDacSetNextReg(uint32_t reg, uint32_t value);
static uint32_t zxnextDacGetNextReg(uint32_t reg);
static void zxnextDacWritePort(uint32_t port, uint32_t value);
static uint32_t zxnextDacGetChannel(uint32_t channel);
static uint32_t zxnextDacGetStereoLeft(void);
static uint32_t zxnextDacGetStereoRight(void);

#endif
