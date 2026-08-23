#ifndef ZXNEXT_ULA_H
#define ZXNEXT_ULA_H

#include <stdint.h>

static void zxnextUlaReset(void);
static uint32_t zxnextUlaReadPortFe(uint32_t address);
static void zxnextUlaWritePortFe(uint32_t value);
static uint32_t zxnextUlaRenderInstantScreen(void);
static void zxnextUlaOnFrameCompleted(void);
static uint32_t zxnextUlaGetFlashCounter(void);
static uint32_t zxnextUlaGetFlashFlag(void);
static void zxnextUlaSetNextReg(uint32_t reg, uint32_t value);
static uint32_t zxnextUlaGetNextReg(uint32_t reg);
static void zxnextUlaResetClipIndex(void);
static uint32_t zxnextUlaGetClipIndex(void);
static uint32_t zxnextUlaGetClip(uint32_t index);
static uint32_t zxnextUlaGetScrollX(void);
static uint32_t zxnextUlaGetScrollY(void);
static uint32_t zxnextUlaGetPulseIntActive(uint32_t frameTact);
static uint32_t zxnextUlaGetScanlineForTact(uint32_t tact);
static uint32_t zxnextUlaGetColumnForTact(uint32_t tact);

#endif
