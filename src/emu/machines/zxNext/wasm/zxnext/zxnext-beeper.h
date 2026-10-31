#ifndef ZXNEXT_BEEPER_H
#define ZXNEXT_BEEPER_H

#include <stdint.h>

static void zxnextBeeperReset(void);
static void zxnextBeeperBeginFrame(void);
static void zxnextBeeperSetTacts(uint32_t value);
static void zxnextBeeperSetOutput(uint32_t ear, uint32_t mic);
static void zxnextBeeperSetPiEarAt(uint32_t on, double tact);
#if ZXNEXT_CORE_VERSION >= 30204
static void zxnextBeeperSetTapeEarAt(uint32_t on, uint32_t relaxed, double tact);
#else
static void zxnextBeeperSetTapeEarAt(uint32_t on, double tact);
#endif
static uint32_t zxnextBeeperGetEar(void);
static uint32_t zxnextBeeperGetMic(void);
static uint32_t zxnextBeeperGetOutputLevelMilli(void);
static uint32_t zxnextBeeperGetSampleLeftMilli(double sampleEndTact);
static uint32_t zxnextBeeperGetSampleRightMilli(double sampleEndTact);

#endif
