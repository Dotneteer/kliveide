#ifndef ZXNEXT_PSG_H
#define ZXNEXT_PSG_H

#include <stdint.h>

static void zxnextPsgReset(void);
static void zxnextPsgBeginFrame(void);
static void zxnextPsgSetTurbosoundEnabled(uint32_t enabled);
static void zxnextPsgSetAyStereoMode(uint32_t enabled);
static void zxnextPsgSetChipMonoMode(uint32_t chip, uint32_t enabled);
static void zxnextPsgSetRegisterIndex(uint32_t value);
static void zxnextPsgWriteRegisterValue(uint32_t value);
static uint32_t zxnextPsgReadRegisterValue(void);
static void zxnextPsgGenerateOutput(uint32_t chip);
static void zxnextPsgAdvanceToFrameTact(double frameTact28);
static void zxnextPsgCalculateCurrentAudioValue(uint32_t frameTact28);
static void zxnextPsgPrepareAudioSample(double sampleEndFrameTact28);
static uint32_t zxnextPsgGetSampleLeft(void);
static uint32_t zxnextPsgGetSampleRight(void);
static uint32_t zxnextPsgGetSelectedChip(void);
static uint32_t zxnextPsgGetTurbosoundEnabled(void);
static uint32_t zxnextPsgGetSelectedRegister(void);
static uint32_t zxnextPsgGetChipPanning(uint32_t chip);
static uint32_t zxnextPsgGetChipMonoMode(uint32_t chip);
static uint32_t zxnextPsgGetRegister(uint32_t chip, uint32_t reg);
static uint32_t zxnextPsgGetOutputA(uint32_t chip);
static uint32_t zxnextPsgGetOutputB(uint32_t chip);
static uint32_t zxnextPsgGetOutputC(uint32_t chip);
static uint32_t zxnextPsgGetStereoLeft(uint32_t chip);
static uint32_t zxnextPsgGetStereoRight(uint32_t chip);
static uint32_t zxnextPsgGetNoiseRng(uint32_t chip);
static uint32_t zxnextPsgGetEnvelopeStep(uint32_t chip);

#endif
