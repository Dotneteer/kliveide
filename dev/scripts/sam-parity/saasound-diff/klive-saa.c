/*
 * Klive's SAA 1099 (src/emu/machines/samcoupe/wasm/sam/sam-saa.c) built on its own for the SAASound
 * differential test (dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md, Phase 6). The core's audio integrator is
 * replaced by one that averages each side's level over the harness's sample windows.
 */
#include <stdint.h>
#include <stdio.h>
#include <math.h>

static void samAudioIntegrateUntil(double point);

#include "../../../../src/emu/machines/samcoupe/wasm/sam/sam-saa.c"

static double klAccLeft;
static double klAccRight;
static double klLast;

static void samAudioIntegrateUntil(double point) {
  const double d = point - klLast;
  if (d > 0.0) {
    klAccLeft += samSaaLevel[0] * d;
    klAccRight += samSaaLevel[1] * d;
  }
  klLast = point;
}

void klPowerOn(void) {
  samSaaPowerOn();
  klAccLeft = klAccRight = klLast = 0.0;
}

/* The generators up to `until` (24 MHz units), then an address or data write */
void klWrite(double until, int isAddress, uint8_t value) {
  samSaaRunUntil(until);
  if (isAddress) samSaaWriteAddress(value);
  else samSaaWriteData(value);
}

/* The window [start, end): each side's mean level */
void klSample(double start, double end, float *left, float *right) {
  samSaaRunUntil(end);
  *left = (float)(klAccLeft / (end - start));
  *right = (float)(klAccRight / (end - start));
  klAccLeft = klAccRight = 0.0;
}

/* The generators, for the runner's debug dump */
void klDump(void) {
  fprintf(stderr, "  Klive    tone");
  for (int i = 0; i < 6; i++) fprintf(stderr, " %d:%d/o%d/f%d", i, samSaaToneLevel[i], samSaaOctave[i], samSaaOffset[i]);
  fprintf(stderr, "\n  Klive    mix ");
  for (int i = 0; i < 6; i++) fprintf(stderr, " %d:m%d/i%u", i, samSaaMixMode[i], samSaaIntermediate(i));
  fprintf(stderr, "\n  Klive    noise %05x/%d %05x/%d\n", samSaaLfsr[0] & 0x3ffff, samSaaNoiseSource[0], samSaaLfsr[1] & 0x3ffff,
          samSaaNoiseSource[1]);
}
unsigned klLfsr(int gen) { return samSaaLfsr[gen & 1] & 0x3ffffu; }
unsigned klTones(void) {
  unsigned v = 0;
  for (int i = 0; i < 6; i++) v |= (unsigned)samSaaToneLevel[i] << i;
  return v;
}

/* How far time `t` (24 MHz units) is from the nearest generator edge, past or next (the runner's tie guard) */
double klNearestEdge(double t) {
  double best = 1e300;
  for (int ch = 0; ch < 6; ch++) {
    if (samSaaSync) break;
    const double next = samSaaToneNext[ch];
    const double prev = next - samSaaHalfPeriod(ch);
    if (fabs(next - t) < best) best = fabs(next - t);
    if (fabs(t - prev) < best) best = fabs(t - prev);
  }
  for (int gen = 0; gen < 2; gen++) {
    if (!samSaaNoiseFreeRunning(gen)) continue;
    const double next = samSaaNoiseNext[gen];
    const double prev = next - samSaaNoisePeriod(gen);
    if (fabs(next - t) < best) best = fabs(next - t);
    if (fabs(t - prev) < best) best = fabs(t - prev);
  }
  return best;
}
