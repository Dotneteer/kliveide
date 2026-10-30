#ifndef ZXNEXT_AUDIO_MIXER_H
#define ZXNEXT_AUDIO_MIXER_H

#include <stdint.h>

/* The output the stream plays (zxnextAudioMixerSetOutput) */
#define ZXNEXT_AUDIO_OUT_JACK 0u
#define ZXNEXT_AUDIO_OUT_SPEAKER 1u
#define ZXNEXT_AUDIO_OUT_HDMI 2u

static void zxnextAudioMixerReset(void);
static void zxnextAudioMixerBeginFrame(void);
static void zxnextAudioMixerOnFrameWrap(void);
static void zxnextAudioMixerSetNextSample(uint32_t frameTacts28);
static void zxnextAudioMixerSetSampleRate(uint32_t rate);
static uint32_t zxnextAudioMixerGetSampleRate(void);
static void zxnextAudioMixerSetEarLevelMilli(int32_t level);
static void zxnextAudioMixerSetMicLevelMilli(int32_t level);
static void zxnextAudioMixerSetPsgOutput(uint32_t left, uint32_t right);
static void zxnextAudioMixerSetVolumeScaleMilli(uint32_t scale);
static void zxnextAudioMixerSetOutput(uint32_t output);
static uint32_t zxnextAudioMixerGetOutput(void);
static int32_t zxnextAudioMixerGetMixedLeftWord(void);
static int32_t zxnextAudioMixerGetMixedRightWord(void);
static uint32_t zxnextAudioMixerAppendCurrentSample(void);
static uint32_t zxnextAudioMixerGetSampleCount(void);
static int32_t zxnextAudioMixerGetSampleLeft(uint32_t index);
static int32_t zxnextAudioMixerGetSampleRight(uint32_t index);

#endif
