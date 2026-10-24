/*
 * The DivMMC (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C3): port $E3, the automap traps and the
 * paging of its 8K ROM and RAM banks - one implementation for the Next and the classic machines.
 * Written from the Next FPGA's divmmc.vhd / zxnext.vhd (see zx-spectrum-divmmc.c).
 */
#ifndef ZX_SPECTRUM_DIVMMC_H
#define ZX_SPECTRUM_DIVMMC_H

#include <stdint.h>

static void zxDivMmcReset(void);
static void zxDivMmcSetClassicDefaults(void);
static void zxDivMmcSetPortE3(uint32_t value);
static uint32_t zxDivMmcGetPortE3(void);
static void zxDivMmcSetNextReg83(uint32_t value);
static void zxDivMmcSetNextReg0A(uint32_t value);
static void zxDivMmcSetNextReg09(uint32_t value);
static void zxDivMmcSetNextRegB8(uint32_t value);
static void zxDivMmcSetNextRegB9(uint32_t value);
static void zxDivMmcSetNextRegBA(uint32_t value);
static void zxDivMmcSetNextRegBB(uint32_t value);
static void zxDivMmcSetEnableNmiByDriveButton(uint32_t enabled);
static void zxDivMmcSetEnableMultifaceNmiByM1Button(uint32_t enabled);
static uint32_t zxDivMmcGetEnableNmiByDriveButton(void);
static uint32_t zxDivMmcGetEnableMultifaceNmiByM1Button(void);
static uint32_t zxDivMmcGetNextRegB8(void);
static uint32_t zxDivMmcGetNextRegB9(void);
static uint32_t zxDivMmcGetNextRegBA(void);
static uint32_t zxDivMmcGetNextRegBB(void);
static void zxDivMmcBeforeOpcodeFetch(uint32_t pc);
static void zxDivMmcAfterOpcodeFetch(uint32_t retnSeen, uint32_t suppressRetn);
static void zxDivMmcArmNmiButton(void);
static void zxDivMmcUpdateMemoryMapping(void);
static uint32_t zxDivMmcGetEnabled(void);
static uint32_t zxDivMmcGetEnableAutomap(void);
static uint32_t zxDivMmcGetConmem(void);
static uint32_t zxDivMmcGetMapram(void);
static uint32_t zxDivMmcGetBank(void);
static uint32_t zxDivMmcGetAutoMapActive(void);
static uint32_t zxDivMmcGetRequestAutomapOn(void);
static uint32_t zxDivMmcGetRequestAutomapOff(void);
static uint32_t zxDivMmcGetNmiHold(void);
static uint32_t zxDivMmcIsMappingActive(void);
static uint32_t zxDivMmcGetReadOffset(uint32_t page);
static uint32_t zxDivMmcGetWriteOffset(uint32_t page);

#endif
