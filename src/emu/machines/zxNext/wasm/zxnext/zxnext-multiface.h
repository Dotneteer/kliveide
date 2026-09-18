#ifndef ZXNEXT_MULTIFACE_H
#define ZXNEXT_MULTIFACE_H

#include <stdint.h>

/* Multiface ROM (page 0, $0000-$1FFF) and RAM (page 1, $2000-$3FFF) in the core's memory image. */
#define ZXNEXT_OFFS_MULTIFACE_MEM 0x014000u

static void zxnextMultifaceReset(void);
static uint32_t zxnextMultifaceIsPaged(void);
static uint32_t zxnextMultifaceIsActive(void);
static uint32_t zxnextMultifaceNmiHold(void);
static void zxnextMultifacePressNmiButton(void);
static void zxnextMultifaceOnFetch0066(void);
static void zxnextMultifaceRetn(void);
static uint32_t zxnextMultifaceReadPort(uint32_t port, uint32_t *handled);
static void zxnextMultifaceWritePort(uint32_t port, uint32_t value);

#endif
