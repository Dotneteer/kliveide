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

#endif
