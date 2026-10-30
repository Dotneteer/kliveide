#ifndef ZXNEXT_TAPE_H
#define ZXNEXT_TAPE_H

#include <stdint.h>

#define ZXNEXT_TAPE_MODE_PASSIVE 0u
#define ZXNEXT_TAPE_MODE_LOAD 1u
#define ZXNEXT_TAPE_MODE_SAVE 2u

static void zxnextTapeReset(void);
static void zxnextTapeSetMode(uint32_t mode);
static uint32_t zxnextTapeGetMode(void);
static uint32_t zxnextTapeGetEarBit(void);
static uint32_t zxnextTapeGetMicBit(void);
static void zxnextTapeProcessMicBit(uint32_t value);
/* The conditioned EAR input (port $FE bit 6, the MIC line) and the per-instruction step */
static uint32_t zxnextTapeGetInput(void);
static void zxnextTapeBeforeInstruction(void);

#endif
