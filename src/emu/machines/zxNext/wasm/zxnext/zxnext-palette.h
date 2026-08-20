#ifndef ZXNEXT_PALETTE_H
#define ZXNEXT_PALETTE_H

#include <stdint.h>

static void zxnextPaletteReset(void);
static void zxnextPaletteSetNextReg(uint32_t reg, uint32_t value);
static uint32_t zxnextPaletteGetNextReg(uint32_t reg);
static uint32_t zxnextPaletteGetEntry(uint32_t palette, uint32_t index);
static uint32_t zxnextPaletteGetCurrentEntry(uint32_t index);
static uint32_t zxnextPaletteGetPaletteIndex(void);
static uint32_t zxnextPaletteGetControl(void);
static uint32_t zxnextPaletteGetSecondWrite(void);
static uint32_t zxnextPaletteGetStoredValue(void);
static void zxnextPaletteSetSecondTilemap(uint32_t value);
static uint32_t zxnextPaletteGetSecondTilemap(void);

#endif
