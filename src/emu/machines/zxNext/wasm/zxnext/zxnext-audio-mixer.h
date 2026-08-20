#ifndef ZXNEXT_AUDIO_MIXER_H
#define ZXNEXT_AUDIO_MIXER_H

#include <stdint.h>

static void zxnextAudioMixerReset(void);
static void zxnextAudioMixerSetEarLevelMilli(int32_t level);
static void zxnextAudioMixerSetMicLevelMilli(int32_t level);
static void zxnextAudioMixerSetPsgOutput(uint32_t left, uint32_t right);
static void zxnextAudioMixerSetVolumeScaleMilli(uint32_t scale);
static int32_t zxnextAudioMixerGetMixedLeftWord(void);
static int32_t zxnextAudioMixerGetMixedRightWord(void);
static uint32_t zxnextAudioMixerAppendCurrentSample(void);
static uint32_t zxnextAudioMixerGetSampleCount(void);
static int32_t zxnextAudioMixerGetSampleLeft(uint32_t index);
static int32_t zxnextAudioMixerGetSampleRight(uint32_t index);

#endif
