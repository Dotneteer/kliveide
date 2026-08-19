#ifndef ZXNEXT_MEMORY_H
#define ZXNEXT_MEMORY_H

#include <stdint.h>

static void zxnextMemoryResetMapping(void);
static uint32_t zxnextMemoryReadMapped(uint32_t address);
static void zxnextMemoryWriteMapped(uint32_t address, uint32_t value);
static uint32_t zxnextMemoryPeekMapped(uint32_t address);
static uint32_t zxnextMemoryReadScreenOffset(uint32_t offset);
static uint32_t zxnextMemoryReadPhysical(uint32_t offset);
static void zxnextMemoryWritePhysical(uint32_t offset, uint32_t value);
static void zxnextMemorySetNextRegister(uint32_t reg, uint32_t value);

#endif
