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
static uint32_t zxnextUlaGetScanlineForTact(uint32_t tact);
static uint32_t zxnextUlaGetColumnForTact(uint32_t tact);

#endif
