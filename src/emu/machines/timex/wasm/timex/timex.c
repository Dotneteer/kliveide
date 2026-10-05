/*
 * The Timex core (`.plans/TIMEX_SCORPION_PLAN.md`, G9.4a): the Timex Computer 2048.
 *
 * The TC2048 is a 48K Spectrum whose ULA is Timex's SCLD, so this core is the 48K machine
 * (`sp48.c`, with every shared Spectrum piece it includes) built with `SP48_SCLD` switched on:
 *
 * - `zx-spectrum-scld.c` draws the picture in the SCLD's four screen modes, at two buffer pixels per
 *   Spectrum pixel (704 wide, plan P4), and decodes port $FF and the built-in Kempston port;
 * - port $FF bit 6 holds off the frame interrupt;
 * - the CPU clock is the SCLD's 3.528 MHz (14.112 MHz / 4; TS2068 Technical Manual 2.1.8.2, and the
 *   WoS Timex FAQ for the European models); the frame keeps the 48K's 224 T x 312 lines, which no
 *   source contradicts (plan §8).
 *
 * The 48K's exports keep their `sp48` names, so the host reuses the 48K's loader and machine; the
 * SCLD adds the `timex*` exports below. G9.4b's TC2068/TS2068 (the 24K ROM, the 8K chunk map, the AY)
 * join this core as models of `timexHardReset`.
 */

#define SP48_SCLD 1
#define SP48_PIXEL_SCALE 2u
#define SP48_SCREEN_BUFFER_WIDTH_MAX 704u
#define SP48_BASE_CLOCK_FREQUENCY_PAL 3528000u

#include "../../../zxSpectrum48/wasm/sp48/sp48.c"

/* The models `timexHardReset` takes; `timexModels.ts` is the TypeScript side */
#define TIMEX_MODEL_TC2048 0u

static uint32_t timexModel = TIMEX_MODEL_TC2048;

/* Hard reset into a model: RAM cleared, the SCLD reset, the model's facts applied */
void timexHardReset(uint32_t model) {
  timexModel = TIMEX_MODEL_TC2048;
  (void)model;
  sp48ScldHiresBright = 1u;
  sp48HardReset(0u, 0u);
}

uint32_t timexGetModel(void) {
  return timexModel;
}

/* The SCLD control register (port $FF), as a read returns it */
uint32_t timexGetPortFf(void) {
  return sp48ScldPortFf;
}

/* Sets the control register as an OUT would (snapshots and state restore) */
void timexSetPortFf(uint32_t value) {
  scldWritePortFf(value);
}

/* The Kempston port's bits (0-4: right, left, down, up, fire; active high) */
void timexSetKempston(uint32_t value) {
  sp48KempstonState = (uint8_t)(value & 0x1fu);
}

uint32_t timexGetKempston(void) {
  return sp48KempstonState;
}

/* Whether the 64-column mode's colours are BRIGHT on this model */
uint32_t timexGetHiresBright(void) {
  return sp48ScldHiresBright;
}
