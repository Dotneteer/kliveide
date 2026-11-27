// SAASound's build configuration for the differential test (its config.h.in filled in): no config file,
// no debug logs, an 8 MHz clock that SetClockRate may change, 64x oversampling by default.
#pragma once
#define EXTERNAL_CLK_HZ 8000000
#define SAMPLE_RATE_HZ 44100
#define DEFAULT_OVERSAMPLE 6
#define DEFAULT_UNBOOSTED_MULTIPLIER 11.35
#define DEFAULT_BOOST 1
#define DEBUG_SAA_REGISTER_LOG "debugsaa.txt"
#define DEBUG_SAA_PCM_LOG "debugsaa.pcm"
