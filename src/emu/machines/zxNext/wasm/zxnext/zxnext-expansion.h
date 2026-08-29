#ifndef ZXNEXT_EXPANSION_H
#define ZXNEXT_EXPANSION_H

#include <stdint.h>

void zxnextExpansionReset(void);
void zxnextExpansionHardReset(void);
void zxnextExpansionSetNextReg(uint32_t reg, uint32_t value);
uint32_t zxnextExpansionGetNextReg(uint32_t reg);
uint32_t zxnextExpansionHandlesNextReg(uint32_t reg);
uint32_t zxnextExpansionEffectivePortEnable(uint32_t internalValue, uint32_t busRegIndex);
uint32_t zxnextExpansionShouldPropagateIo(uint32_t portBit);
void zxnextExpansionSetSignals(uint32_t romcs, uint32_t iorqula, uint32_t nmi, uint32_t intr);
uint32_t zxnextExpansionIsRomcsClaimed(void);
uint32_t zxnextExpansionIsNmiAsserted(void);
uint32_t zxnextExpansionIsIntActive(uint32_t expBusInterruptEnabled);
uint32_t zxnextExpansionIsUlaOverride(uint32_t address);

#endif
