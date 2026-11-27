/*
 * The SAASound differential test's runner (dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md, Phase 6): one timed
 * register script fed to SAASound's CSAADevice (the pinned sources in dev/research/sam-coupe/saasound/) and
 * to Klive's port (klive-saa.c), both at an 8 MHz chip clock. Writes happen at sample boundaries, the only
 * points where SAASound can take them (Klive's a hair later, see below).
 *
 * Debugging: SAA_DEBUG_AT=<sample> [SAA_DEBUG_COUNT=<n>] dumps both sides' generators at those samples;
 * SAA_FIND_NOISE=1 lists the runs (over 8 samples) where the tone levels or the noise shift registers differ.
 * SAA_AVOID_TIES=<clocks> holds back a write that falls within that many chip clocks of a tone or noise edge
 * (Klive's) until a sample that is clear: both sides get the same, later write, and the ties SAASound's
 * stepping decides differently are gone.
 *
 *   harness <script> <out.f32> <sample rate> <oversample>
 *
 * The script: one event a line, "<sample> A <register>" or "<sample> D <value>" (hex), in time order, and a
 * last line "<samples> END". The output: per sample four float32 values, Klive's left and right, then
 * SAASound's, each the side's mean level over the sample in SAASound's units (0-2880).
 */
#include <cstdio>
#include <cstdlib>
#include <cstring>

#include "SAASound.h"
#include "types.h"
// --- The debug dump (SAA_DEBUG_AT) reads SAASound's generators, which it keeps private
#define private public
#include "SAADevice.h"
#undef private

extern "C" {
void klPowerOn(void);
void klWrite(double until, int isAddress, unsigned char value);
void klSample(double start, double end, float *left, float *right);
void klDump(void);
unsigned klLfsr(int gen);
unsigned klTones(void);
double klNearestEdge(double t);
}

/* SAASound's generators, in the order klDump prints Klive's */
static void saaDump(CSAADevice &d) {
  CSAAFreq *osc[6] = {&d.m_Osc0, &d.m_Osc1, &d.m_Osc2, &d.m_Osc3, &d.m_Osc4, &d.m_Osc5};
  CSAAAmp *amp[6] = {&d.m_Amp0, &d.m_Amp1, &d.m_Amp2, &d.m_Amp3, &d.m_Amp4, &d.m_Amp5};
  fprintf(stderr, "  SAASound tone");
  for (int i = 0; i < 6; i++) fprintf(stderr, " %d:%d/o%d/f%d", i, osc[i]->m_nLevel, osc[i]->m_nCurrentOctave, osc[i]->m_nCurrentOffset);
  fprintf(stderr, "\n  SAASound mix ");
  for (int i = 0; i < 6; i++) fprintf(stderr, " %d:m%d/i%u", i, amp[i]->m_nMixMode, amp[i]->m_nOutputIntermediate);
  fprintf(stderr, "\n  SAASound noise %05lx/%d %05lx/%d\n", d.m_Noise0.m_nRand & 0x3ffff, d.m_Noise0.m_nSourceMode,
          d.m_Noise1.m_nRand & 0x3ffff, d.m_Noise1.m_nSourceMode);
}

struct Event {
  unsigned long sample;
  bool address;
  unsigned value;
};

int main(int argc, char **argv) {
  if (argc != 5) {
    fprintf(stderr, "usage: harness <script> <out.f32> <sample rate> <oversample>\n");
    return 2;
  }
  const unsigned rate = (unsigned)atoi(argv[3]);
  const unsigned oversample = (unsigned)atoi(argv[4]);
  FILE *in = fopen(argv[1], "r");
  if (!in) return 3;
  size_t capacity = 1024, count = 0;
  Event *events = (Event *)malloc(capacity * sizeof(Event));
  unsigned long total = 0;
  char line[256];
  while (fgets(line, sizeof line, in)) {
    unsigned long sample;
    char kind[8];
    unsigned value = 0;
    const int n = sscanf(line, "%lu %7s %x", &sample, kind, &value);
    if (n < 2) continue;
    if (!strcmp(kind, "END")) {
      total = sample;
      break;
    }
    if (count == capacity) events = (Event *)realloc(events, (capacity *= 2) * sizeof(Event));
    events[count++] = {sample, kind[0] == 'A', value};
  }
  fclose(in);

  CSAADevice saa;
  saa._SetClockRate(8000000);
  saa._SetSampleRate(rate);
  saa._SetOversample(oversample);
  klPowerOn();

  FILE *out = fopen(argv[2], "wb");
  if (!out) return 4;
  const double unitsPerSample = 24000000.0 / rate;
  const char *debugAt = getenv("SAA_DEBUG_AT");
  const long debugFrom = debugAt ? atol(debugAt) : -1;
  // --- SAA_AVOID_TIES=<clocks>: a write within that many clocks of a generator edge waits for a clear sample
  const double tieGuard = getenv("SAA_AVOID_TIES") ? atof(getenv("SAA_AVOID_TIES")) * 3.0 : -1.0;
  unsigned long delayed = 0;
  const long debugCount = getenv("SAA_DEBUG_COUNT") ? atol(getenv("SAA_DEBUG_COUNT")) : 1;
  size_t next = 0;
  bool noiseReported = false;
  int transitions = 0;
  unsigned long runStart = 0;
  char runText[128] = "";
  static float buffer[4 * 4096];
  size_t used = 0;
  for (unsigned long s = 0; s < total; s++) {
    while (next < count && events[next].sample <= s) {
      if (tieGuard > 0 && klNearestEdge(s * unitsPerSample) < tieGuard) {
        delayed++;
        break;
      }
      const Event &e = events[next++];
      // --- Write i goes i x 1e-6 units after the boundary: an edge due exactly at the boundary goes first, as in
      // --- SAASound, whose tick ending there runs before the write (a tie at one clock is stepping, not the
      // --- port). The offset grows so that an edge timed from an earlier write still comes first.
      klWrite(s * unitsPerSample + (double)next * 1e-6, e.address, (unsigned char)e.value);
      if (e.address) saa._WriteAddress((BYTE)e.value);
      else saa._WriteData((BYTE)e.value);
    }
    float kl, kr;
    klSample(s * unitsPerSample, (s + 1) * unitsPerSample, &kl, &kr);
    unsigned int sl, sr;
    saa._TickAndOutputStereo(sl, sr, 0x3f);
    // --- SAA_FIND_NOISE: the first sample where a noise generator's shift register differs
    // --- SAA_FIND_NOISE: runs of more than 8 samples where a tone level or a noise shift register differs (an
    // --- event at the same clock shows in SAASound's sample one tick earlier; drift moves edges a few samples)
    if (getenv("SAA_FIND_NOISE")) {
      CSAAFreq *osc[6] = {&saa.m_Osc0, &saa.m_Osc1, &saa.m_Osc2, &saa.m_Osc3, &saa.m_Osc4, &saa.m_Osc5};
      unsigned saaTones = 0;
      for (int i = 0; i < 6; i++) saaTones |= (unsigned)(osc[i]->m_nLevel & 1) << i;
      const bool differs = klLfsr(0) != (saa.m_Noise0.m_nRand & 0x3ffff) || klLfsr(1) != (saa.m_Noise1.m_nRand & 0x3ffff) ||
                           (!saa.m_bSync && klTones() != saaTones);
      if (differs && !noiseReported) {
        runStart = s;
        sprintf(runText, "Klive %05x %05x tones %02x, SAASound %05lx %05lx tones %02x", klLfsr(0), klLfsr(1), klTones(),
                saa.m_Noise0.m_nRand & 0x3ffff, saa.m_Noise1.m_nRand & 0x3ffff, saaTones);
      }
      if (!differs && noiseReported && s - runStart > 8 && transitions++ < 20)
        fprintf(stderr, "noise differs at samples %lu-%lu (%s)\n", runStart, s - 1, runText);
      noiseReported = differs;
    }
    if (debugFrom >= 0 && (long)s >= debugFrom && (long)s < debugFrom + debugCount) {
      fprintf(stderr, "sample %lu: Klive %.1f/%.1f, SAASound %.1f/%.1f\n", s, kl, kr, sl / (float)(1u << oversample), sr / (float)(1u << oversample));
      klDump();
      saaDump(saa);
    }
    const float scale = 1.0f / (float)(1u << oversample);
    buffer[used++] = kl;
    buffer[used++] = kr;
    buffer[used++] = sl * scale;
    buffer[used++] = sr * scale;
    if (used == 4 * 4096) {
      fwrite(buffer, sizeof(float), used, out);
      used = 0;
    }
  }
  fwrite(buffer, sizeof(float), used, out);
  if (tieGuard > 0) fprintf(stderr, "writes delayed past an edge: %lu samples\n", delayed);
  if (noiseReported) fprintf(stderr, "noise differs from sample %lu to the end (%s)\n", runStart, runText);
  free(events);
  fclose(out);
  return 0;
}
