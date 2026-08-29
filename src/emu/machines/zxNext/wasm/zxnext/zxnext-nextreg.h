#ifndef ZXNEXT_NEXTREG_H
#define ZXNEXT_NEXTREG_H

#include <stdint.h>

static void zxnextNextRegHardReset(void);
static void zxnextNextRegSetIndex(uint32_t reg);
static uint32_t zxnextNextRegGetIndex(void);
static void zxnextNextRegSetValue(uint32_t value);
static uint32_t zxnextNextRegGetValue(void);
static void zxnextNextRegSetDirect(uint32_t reg, uint32_t value);
static uint32_t zxnextNextRegGetDirect(uint32_t reg);

#endif
