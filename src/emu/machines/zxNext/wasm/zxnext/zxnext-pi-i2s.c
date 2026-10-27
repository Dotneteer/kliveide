#include "zxnext-pi-i2s.h"

/*
 * The Next's side of the Raspberry Pi I2S link (.plans/PI_I2S_AUDIO_PLAN.md).
 *
 * zxnext.vhd ~2239-2330 and ~6410 wire the `i2s` entity (audio/i2s.vhd, i2s/i2s_slave.vhd,
 * i2s/i2s_receive.vhd). The Pi is always the clock master (the FPGA's master mode and NR $A3 are
 * commented out), so the Next only sees *when* each word lands, and this module models exactly that:
 * one latch event per channel per sample, no SCK/WS/SD toggling (plan D2).
 *
 * - i2s_receive keeps the top 13 bits of each word, whatever the slot width, and latches it at the WS
 *   edge that ends the word: WS rising latches the left word, WS falling the right one. For a sample
 *   period T starting at t0, the left value lands at t0 + T/2 and the right one at t0 + T.
 * - i2s.vhd keeps the top 10 of the 13 bits with the sign inverted: offset binary, so a signed 16-bit
 *   sample s becomes ((s >> 6) & $3FF) ^ $200. The receiver's reset value 0 therefore reads $200.
 * - The entity is held in reset while NR $A2 bits 7-6 are both 0 (`reset or not pi_i2s_en`).
 *
 * The Pi itself is a *sample source* the host feeds (plan §2): samples arrive in a ring through a
 * journaled memory write plus `zxnextPiI2sAppend`, so a reverse-debugging replay re-applies them
 * where they were delivered. Everything here lives in the state image; nothing is volatile (D4).
 *
 * Time is the 28 MHz clock of zxnext-clock28.c. Devices read the receiver lazily: `Sync` brings it to
 * now on the paths that may change state (the mixer, a $253B read, an $A2 write, a port $FE write);
 * the `Peek` helpers compute the same values on a copy, so pure exports leave the image unchanged.
 */

/* More than three frames at the highest rate (3 x 1/50 s x 192 kHz = 11520): what `Want` asks for at most */
#define ZXNEXT_PI_I2S_RING 16384u
#define ZXNEXT_PI_I2S_REST 0x200u
#define ZXNEXT_PI_I2S_MAX_RATE 192000u

typedef struct {
  /* i2s.vhd o_audio_pi_L / R: the receiver's latched words, 10-bit offset binary */
  uint16_t latchL;
  uint16_t latchR;
  /* zxnext.vhd ~2319 pi_fe_ear: the hysteresis bit EAR routing feeds to port $FE */
  uint8_t feEar;
  /* The next latch event: even = the left word of sample j / 2, odd = its right word */
  uint64_t nextEvent;
} ZxNextPiI2sReceiver;

static ZxNextPiI2sReceiver zxnextPiI2sRx;
static ZxNextClock28 zxnextPiI2sClock;
/* zxnext.vhd ~5954/5961 nr_2d_i2s_sample: bits 1-0 of the sample a $2C / $2E read returned */
static uint8_t zxnextPiI2sNr2d;

/* The stream: host state the Next cannot see, kept in the image so a restore resumes it (D4) */
static uint8_t zxnextPiI2sConnected;
static uint8_t zxnextPiI2sEnded;
static uint32_t zxnextPiI2sRate;
static uint64_t zxnextPiI2sStart;  /* the 28 MHz clock at sample 0's start */
static uint64_t zxnextPiI2sFilled; /* samples [0, filled) were delivered */
static int16_t zxnextPiI2sRing[ZXNEXT_PI_I2S_RING * 2u]; /* interleaved L, R */

static inline void zxnextPiI2sResetReceiver(ZxNextPiI2sReceiver *rx) {
  rx->latchL = ZXNEXT_PI_I2S_REST;
  rx->latchR = ZXNEXT_PI_I2S_REST;
  rx->feEar = 0u;
}

static void zxnextPiI2sHardReset(void) {
  /* The Pi keeps streaming through a Next reset: only the receiver resets (NR $A2 = 0 does that) */
  zxnextPiI2sResetReceiver(&zxnextPiI2sRx);
  zxnextPiI2sNr2d = 0u;
}

static inline uint32_t zxnextPiI2sEnabled(void) {
  return (zxnextNextRegs[0xa2u] & 0xc0u) != 0u;
}

/* The 28 MHz clock at the latch event `j` (integer arithmetic: no drift) */
static inline uint64_t zxnextPiI2sEventTime(uint64_t j) {
  return zxnextPiI2sStart + ((j + 1u) * ZXNEXT_CLOCK28_PER_SECOND) / (2u * (uint64_t)zxnextPiI2sRate);
}

/* i2s.vhd: (not r(12)) & r(11 downto 3) of the top 13 bits of the word */
static inline uint16_t zxnextPiI2sConvert(int16_t sample) {
  return (uint16_t)((((uint16_t)sample >> 6u) & 0x3ffu) ^ 0x200u);
}

/* The time `t` (28 MHz) in the beeper's CPU tacts, counted back from `now` */
static inline double zxnextPiI2sBeeperTact(uint64_t t, uint64_t now) {
  const double tactScale = cpuTactScale == 0u ? 1.0 : (double)cpuTactScale;
  return (double)zxnextBeeperTacts - (double)(now - t) / tactScale;
}

/* zxnext.vhd ~2317-2330: rises at threshold "11", falls at "00", held otherwise; 0 when off or not
   routed to EAR. `commit`: tell the beeper, whose MIC line it XORs into (~6449). */
static void zxnextPiI2sUpdateFeEar(ZxNextPiI2sReceiver *rx, uint64_t t, uint64_t now, uint32_t commit) {
  uint8_t ear = rx->feEar;
  if (!zxnextPiI2sEnabled() || (zxnextNextRegs[0xa2u] & 0x01u) == 0u) {
    ear = 0u;
  } else {
    const uint32_t threshold = ((uint32_t)rx->latchL >> 8u | (uint32_t)rx->latchR >> 8u) & 0x03u;
    if (ear && threshold == 0u) ear = 0u;
    else if (!ear && threshold == 3u) ear = 1u;
  }
  if (ear == rx->feEar) return;
  rx->feEar = ear;
  if (commit) zxnextBeeperSetPiEarAt(ear, zxnextPiI2sBeeperTact(t, now));
}

/* Runs the receiver's latch events up to `now` */
static void zxnextPiI2sScan(ZxNextPiI2sReceiver *rx, uint64_t now, uint32_t commit) {
  if (!zxnextPiI2sConnected) return;
  const uint32_t enabled = zxnextPiI2sEnabled();
  for (;;) {
    const uint64_t j = rx->nextEvent;
    const uint64_t k = j >> 1u;
    /* Past the delivered samples: an ended stream stops clocking (the latches hold), a stream the
       host has not fed yet waits for it */
    if (k >= zxnextPiI2sFilled) break;
    const uint64_t t = zxnextPiI2sEventTime(j);
    if (t > now) break;
    if (enabled) {
      const uint32_t slot = (uint32_t)(k % ZXNEXT_PI_I2S_RING) * 2u + (uint32_t)(j & 1u);
      const uint16_t value = zxnextPiI2sConvert(zxnextPiI2sRing[slot]);
      if (j & 1u) rx->latchR = value;
      else rx->latchL = value;
      zxnextPiI2sUpdateFeEar(rx, t, now, commit);
    }
    rx->nextEvent = j + 1u;
  }
}

static inline uint64_t zxnextPiI2sPeekNow(void) {
  ZxNextClock28 copy = zxnextPiI2sClock;
  return zxnextClock28Now(&copy);
}

/* The receiver as it stands now, without changing the image */
static inline ZxNextPiI2sReceiver zxnextPiI2sPeek(void) {
  ZxNextPiI2sReceiver rx = zxnextPiI2sRx;
  if (zxnextPiI2sConnected) zxnextPiI2sScan(&rx, zxnextPiI2sPeekNow(), 0u);
  return rx;
}

static void zxnextPiI2sSync(void) {
  if (!zxnextPiI2sConnected) return;
  const uint64_t now = zxnextClock28Now(&zxnextPiI2sClock);
  zxnextPiI2sScan(&zxnextPiI2sRx, now, 1u);
}

/* The events before an $A2 write happened under the old settings */
static void zxnextPiI2sBeforeNextRegA2Write(void) {
  zxnextPiI2sSync();
}

static void zxnextPiI2sAfterNextRegA2Write(void) {
  /* ~6415: the entity is in reset while both enables are 0 */
  if (!zxnextPiI2sEnabled()) zxnextPiI2sResetReceiver(&zxnextPiI2sRx);
  const uint64_t now = zxnextClock28Now(&zxnextPiI2sClock);
  zxnextPiI2sUpdateFeEar(&zxnextPiI2sRx, now, now, 1u);
}

/* zxnext.vhd ~2314-2315 pi_audio_L / R: rest when off, muted or routed to EAR; a side whose enable
   is clear takes the other side's word */
static inline uint32_t zxnextPiI2sSelect(const ZxNextPiI2sReceiver *rx, uint32_t right) {
  const uint32_t a2 = zxnextNextRegs[0xa2u];
  if ((a2 & 0xc0u) == 0u || (a2 & 0x01u) != 0u) return ZXNEXT_PI_I2S_REST;
  if (right) {
    if ((a2 & 0x04u) != 0u) return ZXNEXT_PI_I2S_REST;
    return (a2 & 0x40u) != 0u ? rx->latchR : rx->latchL;
  }
  if ((a2 & 0x08u) != 0u) return ZXNEXT_PI_I2S_REST;
  return (a2 & 0x80u) != 0u ? rx->latchL : rx->latchR;
}

/* A $253B read of $2C / $2E latches bits 1-0 of the sample it returns into nr_2d_i2s_sample */
static void zxnextPiI2sOnNextRegRead(uint32_t reg) {
  const uint32_t r = reg & 0xffu;
  if (r != 0x2cu && r != 0x2eu) return;
  zxnextPiI2sSync();
  zxnextPiI2sNr2d = (uint8_t)(zxnextPiI2sSelect(&zxnextPiI2sRx, r == 0x2eu) & 0x03u);
}

/* zxnext.vhd ~5952-5961: $2C and $2E read bits 9-2 of the sample, $2D the latched bits 1-0 */
static uint32_t zxnextPiI2sGetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x2cu: {
      const ZxNextPiI2sReceiver rx = zxnextPiI2sPeek();
      return zxnextPiI2sSelect(&rx, 0u) >> 2u;
    }
    case 0x2du:
      return (uint32_t)zxnextPiI2sNr2d << 6u;
    case 0x2eu: {
      const ZxNextPiI2sReceiver rx = zxnextPiI2sPeek();
      return zxnextPiI2sSelect(&rx, 1u) >> 2u;
    }
    default:
      return 0xffu;
  }
}

static uint32_t zxnextPiI2sGetFeEar(void) {
  if (!zxnextPiI2sConnected) return zxnextPiI2sRx.feEar;
  return zxnextPiI2sPeek().feEar;
}

/* audio_mixer.vhd:89-90 adds "000" & pi_i2s_X (0-1023); the signed mixer takes it about its $200 rest */
static int32_t zxnextPiI2sGetMixLeft(void) {
  return (int32_t)zxnextPiI2sSelect(&zxnextPiI2sRx, 0u) - (int32_t)ZXNEXT_PI_I2S_REST;
}

static int32_t zxnextPiI2sGetMixRight(void) {
  return (int32_t)zxnextPiI2sSelect(&zxnextPiI2sRx, 1u) - (int32_t)ZXNEXT_PI_I2S_REST;
}

// ==========================================================================
// Exports: the host's sample source (plan §2, §3)

/* Starts a stream of `rate` samples per second now; 0 disconnects. Sample 0 starts at the current
   28 MHz clock; nothing is delivered yet. */
void zxnextPiI2sConnect(uint32_t rate) {
  zxnextPiI2sSync();
  if (rate == 0u) {
    zxnextPiI2sConnected = 0u;
    return;
  }
  zxnextPiI2sRate = rate > ZXNEXT_PI_I2S_MAX_RATE ? ZXNEXT_PI_I2S_MAX_RATE : rate;
  zxnextPiI2sStart = zxnextClock28Now(&zxnextPiI2sClock);
  zxnextPiI2sFilled = 0u;
  zxnextPiI2sEnded = 0u;
  zxnextPiI2sRx.nextEvent = 0u;
  zxnextPiI2sConnected = 1u;
}

/* The source stops: SCK stops after the last delivered sample, and the latches hold (D2) */
void zxnextPiI2sDisconnect(void) {
  zxnextPiI2sSync();
  zxnextPiI2sConnected = 0u;
}

/* `count` more samples were written into the ring after the delivered ones (journaled writes) */
void zxnextPiI2sAppend(uint32_t count) {
  if (!zxnextPiI2sConnected || zxnextPiI2sEnded) return;
  zxnextPiI2sFilled += count;
}

/* The source has no more samples than those delivered */
void zxnextPiI2sEnd(void) {
  if (zxnextPiI2sConnected) zxnextPiI2sEnded = 1u;
}

uint32_t zxnextPiI2sRingPtr(void) { return (uint32_t)(uintptr_t)zxnextPiI2sRing; }
uint32_t zxnextPiI2sRingCapacity(void) { return ZXNEXT_PI_I2S_RING; }
uint32_t zxnextGetPiI2sConnected(void) { return zxnextPiI2sConnected; }
uint32_t zxnextGetPiI2sEnded(void) { return zxnextPiI2sEnded; }
uint32_t zxnextGetPiI2sRate(void) { return zxnextPiI2sRate; }
/* Sample indexes as doubles: exact to 2^53, and a JavaScript number without BigInt */
double zxnextGetPiI2sFilled(void) { return (double)zxnextPiI2sFilled; }
/* The sample whose words the receiver latches next */
double zxnextGetPiI2sPosition(void) { return (double)(zxnextPiI2sPeek().nextEvent >> 1u); }

/*
 * How many samples the host should deliver now: everything up to two frames past the end of the
 * current one (its overrun, a debug run that resumes in the next). The target is counted from the
 * current frame's start, not from now, so it is the same wherever in the frame the host asks: the fast
 * path asks before the frame, the debug loop at every entry, and a replay must deliver the same
 * samples whichever ran (PI_I2S_AUDIO_PLAN D4). 0 when disconnected or ended.
 */
uint32_t zxnextGetPiI2sWant(void) {
  if (!zxnextPiI2sConnected || zxnextPiI2sEnded) return 0u;
  const uint64_t now = zxnextPiI2sPeekNow();
  const uint64_t frameStart = now >= frameTacts28 ? now - frameTacts28 : 0u;
  const uint64_t horizon = frameStart + 3u * (uint64_t)ZXNEXT_TACTS_IN_FRAME;
  const uint64_t elapsed = horizon > zxnextPiI2sStart ? horizon - zxnextPiI2sStart : 0u;
  const uint64_t target = (elapsed * (uint64_t)zxnextPiI2sRate) / ZXNEXT_CLOCK28_PER_SECOND + 2u;
  return target > zxnextPiI2sFilled ? (uint32_t)(target - zxnextPiI2sFilled) : 0u;
}

/* The receiver's raw latched words and EAR bit as they stand now (tests, the IDE) */
uint32_t zxnextGetPiI2sLatchLeft(void) { return zxnextPiI2sPeek().latchL; }
uint32_t zxnextGetPiI2sLatchRight(void) { return zxnextPiI2sPeek().latchR; }
uint32_t zxnextGetPiI2sFeEar(void) { return zxnextPiI2sGetFeEar(); }
