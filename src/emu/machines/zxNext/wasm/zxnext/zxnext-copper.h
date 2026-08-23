#ifndef ZXNEXT_COPPER_H
#define ZXNEXT_COPPER_H

#include <stdint.h>

static void zxnextCopperReset(void);
static void zxnextCopperSetNextReg(uint32_t reg, uint32_t value);
static uint32_t zxnextCopperGetNextReg(uint32_t reg);
static void zxnextCopperExecuteTick(uint32_t vc, uint32_t hc, uint32_t totalVc);
static uint32_t zxnextCopperReadMemory(uint32_t address);
static uint32_t zxnextCopperGetStartMode(void);
static uint32_t zxnextCopperGetInstructionAddress(void);
static uint32_t zxnextCopperGetListAddress(void);
static uint32_t zxnextCopperGetListData(void);
static uint32_t zxnextCopperGetDout(void);
static uint32_t zxnextCopperGetVerticalLineOffset(void);

#endif
