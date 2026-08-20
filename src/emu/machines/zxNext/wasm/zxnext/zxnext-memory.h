#ifndef ZXNEXT_MEMORY_H
#define ZXNEXT_MEMORY_H

#include <stdint.h>

static void zxnextMemoryResetMapping(void);
static uint32_t zxnextMemoryReadMapped(uint32_t address);
static void zxnextMemoryWriteMapped(uint32_t address, uint32_t value);
static uint32_t zxnextMemoryPeekMapped(uint32_t address);
static uint32_t zxnextMemoryReadScreenOffset(uint32_t offset);
static uint32_t zxnextMemoryGetPageReadOffset(uint32_t page);
static uint32_t zxnextMemoryGetPageWriteOffset(uint32_t page);
static uint32_t zxnextMemoryGetPageBank16(uint32_t page);
static uint32_t zxnextMemoryGetPageBank8(uint32_t page);
static uint32_t zxnextMemoryGetSelectedRomPage(void);
static uint32_t zxnextMemoryGetSelectedRamBank(void);
static uint32_t zxnextMemoryReadPhysical(uint32_t offset);
static void zxnextMemoryWritePhysical(uint32_t offset, uint32_t value);
static void zxnextMemorySetNextRegister(uint32_t reg, uint32_t value);
static void zxnextMemorySetPort7ffd(uint32_t value);
static uint32_t zxnextMemoryGetPort7ffd(void);
static void zxnextMemorySetPortDffd(uint32_t value);
static uint32_t zxnextMemoryGetPortDffd(void);
static void zxnextMemorySetPort1ffd(uint32_t value);
static uint32_t zxnextMemoryGetPort1ffd(void);

#endif
