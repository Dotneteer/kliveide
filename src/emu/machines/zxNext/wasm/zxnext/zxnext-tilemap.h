#ifndef ZXNEXT_TILEMAP_H
#define ZXNEXT_TILEMAP_H

#include <stdint.h>

static void zxnextTilemapReset(void);
static void zxnextTilemapSetNextReg(uint32_t reg, uint32_t value);
static uint32_t zxnextTilemapGetNextReg(uint32_t reg);
static void zxnextTilemapResetClipIndex(void);
static uint32_t zxnextTilemapGetClipIndex(void);
static uint32_t zxnextTilemapGetClip(uint32_t index);
static uint32_t zxnextTilemapGetEnabled(void);
static uint32_t zxnextTilemapGet80x32Resolution(void);
static uint32_t zxnextTilemapGetEliminateAttributes(void);
static uint32_t zxnextTilemapGetTextMode(void);
static uint32_t zxnextTilemapGet512TileMode(void);
static uint32_t zxnextTilemapGetForceOnTopOfUla(void);
static uint32_t zxnextTilemapGetDefaultAttr(void);
static uint32_t zxnextTilemapGetTransparencyIndex(void);
static uint32_t zxnextTilemapGetPaletteOffset(void);
static uint32_t zxnextTilemapGetScrollX(void);
static uint32_t zxnextTilemapGetScrollY(void);
static uint32_t zxnextTilemapGetBaseAddressUseBank7(void);
static uint32_t zxnextTilemapGetBaseAddressMsb(void);
static uint32_t zxnextTilemapGetDefinitionAddressUseBank7(void);
static uint32_t zxnextTilemapGetDefinitionAddressMsb(void);

#endif
