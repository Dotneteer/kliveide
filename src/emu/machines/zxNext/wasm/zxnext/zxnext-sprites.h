#ifndef ZXNEXT_SPRITES_H
#define ZXNEXT_SPRITES_H

#include <stdint.h>

static void zxnextSpritesReset(void);
static void zxnextSpritesSetNextReg(uint32_t reg, uint32_t value);
static uint32_t zxnextSpritesGetNextReg(uint32_t reg);
static void zxnextSpritesResetClipIndex(void);
static uint32_t zxnextSpritesGetClipIndex(void);
static void zxnextSpritesWritePort303b(uint32_t value);
static void zxnextSpritesWritePort57(uint32_t value);
static void zxnextSpritesWritePort5b(uint32_t value);
static uint32_t zxnextSpritesReadPort303b(void);
static uint32_t zxnextSpritesGetClip(uint32_t index);
static uint32_t zxnextSpritesGetTransparencyIndex(void);
static uint32_t zxnextSpritesGetSpriteIndex(void);
static uint32_t zxnextSpritesGetPatternIndex(void);
static uint32_t zxnextSpritesGetPatternSubIndex(void);
static uint32_t zxnextSpritesGetSpriteSubIndex(void);
static uint32_t zxnextSpritesGetAttribute(uint32_t sprite, uint32_t attr);
static uint32_t zxnextSpritesGetPatternByte8(uint32_t variant, uint32_t offset);
static uint32_t zxnextSpritesGetPatternByte4(uint32_t variant, uint32_t offset);
static uint32_t zxnextSpritesGetLastVisibleSpriteIndex(void);
static uint32_t zxnextSpritesGetSprite0OnTop(void);
static uint32_t zxnextSpritesGetClippingEnabled(void);
static uint32_t zxnextSpritesGetOverBorderEnabled(void);
static uint32_t zxnextSpritesGetEnabled(void);

#endif
