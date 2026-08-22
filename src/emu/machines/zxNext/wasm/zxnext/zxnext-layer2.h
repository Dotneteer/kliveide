#ifndef ZXNEXT_LAYER2_H
#define ZXNEXT_LAYER2_H

#include <stdint.h>

static void zxnextLayer2Reset(void);
static void zxnextLayer2SetNextReg(uint32_t reg, uint32_t value);
static uint32_t zxnextLayer2GetNextReg(uint32_t reg);
static void zxnextLayer2ResetClipIndex(void);
static uint32_t zxnextLayer2GetClipIndex(void);
static void zxnextLayer2SetEnabled(uint32_t enabled);
static uint32_t zxnextLayer2GetEnabled(void);
static uint32_t zxnextLayer2GetResolution(void);
static uint32_t zxnextLayer2GetPaletteOffset(void);
static uint32_t zxnextLayer2GetScrollX(void);
static uint32_t zxnextLayer2GetScrollY(void);
static uint32_t zxnextLayer2GetClip(uint32_t index);
static uint32_t zxnextLoResGetEnabled(void);
static uint32_t zxnextLoResGetRadastanMode(void);
static uint32_t zxnextLoResGetPaletteOffset(void);
static uint32_t zxnextLoResGetScrollX(void);
static uint32_t zxnextLoResGetScrollY(void);
static uint32_t zxnextLoResStandardAddress(uint32_t x, uint32_t y);
static uint32_t zxnextLoResRadastanAddress(uint32_t x, uint32_t y, uint32_t dfile);
static uint32_t zxnextLayer2ComposeSample(uint32_t layer2Rgb, uint32_t layer2Transparent, uint32_t ulaRgb);

#endif
