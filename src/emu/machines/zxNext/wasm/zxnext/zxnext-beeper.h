#ifndef ZXNEXT_BEEPER_H
#define ZXNEXT_BEEPER_H

#include <stdint.h>

static void zxnextBeeperReset(void);
static void zxnextBeeperSetTacts(uint32_t value);
static void zxnextBeeperSetOutput(uint32_t ear, uint32_t mic);
static uint32_t zxnextBeeperGetEar(void);
static uint32_t zxnextBeeperGetMic(void);
static uint32_t zxnextBeeperGetOutputLevelMilli(void);
static uint32_t zxnextBeeperGetSampleLeftMilli(void);
static uint32_t zxnextBeeperGetSampleRightMilli(void);

#endif
