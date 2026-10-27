#ifndef ZXNEXT_PI_I2S_H
#define ZXNEXT_PI_I2S_H

#include <stdint.h>

/* The Next's side of the Raspberry Pi I2S link (zxnext-pi-i2s.c, .plans/PI_I2S_AUDIO_PLAN.md) */

static void zxnextPiI2sHardReset(void);
static void zxnextPiI2sSync(void);
static void zxnextPiI2sBeforeNextRegA2Write(void);
static void zxnextPiI2sAfterNextRegA2Write(void);
static void zxnextPiI2sOnNextRegRead(uint32_t reg);
static uint32_t zxnextPiI2sGetNextReg(uint32_t reg);
static uint32_t zxnextPiI2sGetFeEar(void);
static int32_t zxnextPiI2sGetMixLeft(void);
static int32_t zxnextPiI2sGetMixRight(void);

#endif
