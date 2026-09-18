#ifndef ZXNEXT_NMI_H
#define ZXNEXT_NMI_H

#include <stdint.h>

static void zxnextNmiReset(void);
static void zxnextNmiSetSignal(uint32_t active);
static uint32_t zxnextNmiGetSignal(void);
static void zxnextNmiSetCause(uint32_t cause);
static uint32_t zxnextNmiGetCause(void);
static void zxnextNmiSetStacklessEnabled(uint32_t enabled);
static uint32_t zxnextNmiGetStacklessEnabled(void);
static void zxnextNmiSetReturnAddress(uint32_t address);
static uint32_t zxnextNmiGetReturnAddress(void);
static uint32_t zxnextNmiGetStacklessProcessed(void);
static void zxnextNmiMarkAccepted(void);
static void zxnextNmiAfterRetn(void);
static uint32_t zxnextNmiAcceptCause(void);
static uint32_t zxnextNmiSourceIsMultiface(void);
static void zxnextNmiRequestMultiface(void);
static void zxnextNmiRequestDivMmc(void);
static void zxnextNmiBeforeOpcodeFetch(uint32_t pc);
static void zxnextNmiNextReg02Write(uint32_t value);
static uint32_t zxnextNmiNextReg02Flags(void);
static void zxnextNmiIoTrap(uint32_t cause, uint32_t value, uint32_t isWrite);

#endif
