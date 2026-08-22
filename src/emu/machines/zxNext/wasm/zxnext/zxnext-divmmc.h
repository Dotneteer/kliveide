#ifndef ZXNEXT_DIVMMC_H
#define ZXNEXT_DIVMMC_H

#include <stdint.h>

static void zxnextDivMmcReset(void);
static void zxnextDivMmcSetPortE3(uint32_t value);
static uint32_t zxnextDivMmcGetPortE3(void);
static void zxnextDivMmcSetNextReg83(uint32_t value);
static void zxnextDivMmcSetNextReg0A(uint32_t value);
static void zxnextDivMmcSetNextReg09(uint32_t value);
static void zxnextDivMmcSetNextRegB8(uint32_t value);
static void zxnextDivMmcSetNextRegB9(uint32_t value);
static void zxnextDivMmcSetNextRegBA(uint32_t value);
static void zxnextDivMmcSetNextRegBB(uint32_t value);
static void zxnextDivMmcSetEnableNmiByDriveButton(uint32_t enabled);
static void zxnextDivMmcSetEnableMultifaceNmiByM1Button(uint32_t enabled);
static uint32_t zxnextDivMmcGetEnableNmiByDriveButton(void);
static uint32_t zxnextDivMmcGetEnableMultifaceNmiByM1Button(void);
static uint32_t zxnextDivMmcGetNextRegB8(void);
static uint32_t zxnextDivMmcGetNextRegB9(void);
static uint32_t zxnextDivMmcGetNextRegBA(void);
static uint32_t zxnextDivMmcGetNextRegBB(void);
static void zxnextDivMmcBeforeOpcodeFetch(uint32_t pc);
static void zxnextDivMmcAfterOpcodeFetch(uint32_t retnSeen, uint32_t suppressRetn);
static void zxnextDivMmcArmNmiButton(void);
static void zxnextDivMmcUpdateMemoryMapping(void);
static uint32_t zxnextDivMmcGetEnabled(void);
static uint32_t zxnextDivMmcGetEnableAutomap(void);
static uint32_t zxnextDivMmcGetConmem(void);
static uint32_t zxnextDivMmcGetMapram(void);
static uint32_t zxnextDivMmcGetBank(void);
static uint32_t zxnextDivMmcGetAutoMapActive(void);
static uint32_t zxnextDivMmcGetRequestAutomapOn(void);
static uint32_t zxnextDivMmcGetRequestAutomapOff(void);
static uint32_t zxnextDivMmcGetNmiHold(void);
static uint32_t zxnextDivMmcIsMappingActive(void);
static uint32_t zxnextDivMmcGetReadOffset(uint32_t page);
static uint32_t zxnextDivMmcGetWriteOffset(uint32_t page);

#endif
