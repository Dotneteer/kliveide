/*
 * The Timex core (`.plans/TIMEX_SCORPION_PLAN.md`): the Timex Computer 2048 (G9.4a), the Timex
 * Computer 2068 and the Timex Sinclair 2068 (G9.4b).
 *
 * The TC2048 is a 48K Spectrum whose ULA is Timex's SCLD, so this core is the 48K machine
 * (`sp48.c`, with every shared Spectrum piece it includes) built with `SP48_SCLD` switched on:
 *
 * - `zx-spectrum-scld.c` draws the picture in the SCLD's four screen modes, at two buffer pixels per
 *   Spectrum pixel (704 wide, plan P4), and decodes port $FF, the TC2048's Kempston port and the
 *   2068s' ports $F4-$F6;
 * - port $FF bit 6 holds off the frame interrupt;
 * - the CPU clock is the SCLD's 3.528 MHz (14.112 MHz / 4; TS2068 Technical Manual 2.1.8.2, and the
 *   WoS Timex FAQ for the European models).
 *
 * `timexHardReset(model)` switches the 2068s' hardware on: the 8K chunk map over HOME, DOCK and
 * EXROM (`sp48-memory.c`), the AY on $F5/$F6 (`zx-spectrum-psg.c`, as the 128K's) with the
 * joysticks on its port A, the full decoding of port $FE, and the TS2068's 60 Hz frame.
 *
 * The 48K's exports keep their `sp48` names, so the host reuses the 48K's loader and machine; the
 * SCLD adds the `timex*` exports below.
 */

#include <stdint.h>

/*
 * The tape routines the tape device traps, per ROM (`timexSetTapeTraps`): the 48K ROM's in HOME
 * (also the TC2048 ROM's), or the TS2068 ROM's, which live in the EXROM (plan §8)
 */
static uint32_t timexTapeLoad = 0x056cu;
static uint32_t timexTapeInvalidHeader = 0x05b6u;
static uint32_t timexTapeResume = 0x05e2u;
static uint32_t timexTapeSave = 0x04c2u;
static uint8_t timexTapeInExrom;
static uint8_t timexTapeEnabled = 1u;
static uint8_t timexTapeTrapActive(void);
#define SP48_TAPE_LOAD_BYTES_ROUTINE timexTapeLoad
#define SP48_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE timexTapeInvalidHeader
#define SP48_TAPE_LOAD_BYTES_RESUME_ROUTINE timexTapeResume
#define SP48_TAPE_SAVE_BYTES_ROUTINE timexTapeSave
#define SP48_TAPE_TRAP_ACTIVE() timexTapeTrapActive()

#define SP48_SCLD 1
#define SP48_PIXEL_SCALE 2u
#define SP48_SCREEN_BUFFER_WIDTH_MAX 704u
#define SP48_BASE_CLOCK_FREQUENCY_PAL 3528000u
#define SP48_BASE_CLOCK_FREQUENCY_NTSC 3528000u

#include "../../../zxSpectrum48/wasm/sp48/sp48.c"

/* The models `timexHardReset` takes; `timexModels.ts` is the TypeScript side */
#define TIMEX_MODEL_TC2048 0u
#define TIMEX_MODEL_TC2068 1u
#define TIMEX_MODEL_TS2068 2u

/*
 * The TS2068's 60 Hz frame: 262 lines of 224 T (TS2068 Technical Manual 2.1.8.3: the line is
 * 896 periods of 14.112 MHz, the frame counter counts to 106H). Where the 262 lines fall around the
 * paper is not documented: Klive keeps the 48K NTSC raster's borders and takes the two lines off
 * the top non-visible border.
 */
static const Sp48ScreenConfig timexTs2068Config = {
  8u, 13u, 25u, 24u, 0u, 192u, 24u, 24u, 128u, 40u, 8u, 2u, 1u, {6u, 5u, 4u, 3u, 2u, 1u, 0u, 0u}
};

static uint32_t timexModel = TIMEX_MODEL_TC2048;

/* Hard reset into a model: RAM cleared, the SCLD reset, the model's hardware switched on */
void timexHardReset(uint32_t model) {
  timexModel = model <= TIMEX_MODEL_TS2068 ? model : TIMEX_MODEL_TC2048;
  const uint8_t is2068 = timexModel != TIMEX_MODEL_TC2048 ? 1u : 0u;
  sp48TimexKempston = is2068 ? 0u : 1u;
  sp48TimexChunked = is2068;
  sp48TimexHasAy = is2068;
  sp48TimexFullDecode = is2068;
  /* 64-column BRIGHT: the TC models (WoS FAQ), not the TS2068 (its manual, 5.2.3) */
  sp48ScldHiresBright = timexModel == TIMEX_MODEL_TS2068 ? 0u : 1u;
  sp48HardReset(0u, timexModel == TIMEX_MODEL_TS2068 ? 1u : 0u);
  if (timexModel == TIMEX_MODEL_TS2068) {
    initializeTimingTables(&timexTs2068Config);
    sp48Reset();
  }
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

/* Port $F4, the 2068s' chunk map */
uint32_t timexGetPortF4(void) {
  return sp48TimexPortF4;
}

void timexSetPortF4(uint32_t value) {
  timexWritePortF4(value);
}

/* The TC2048's Kempston port bits (0-4: right, left, down, up, fire; active high) */
void timexSetKempston(uint32_t value) {
  sp48KempstonState = (uint8_t)(value & 0x1fu);
}

uint32_t timexGetKempston(void) {
  return sp48KempstonState;
}

/* A 2068 joystick's pins (0 player 1, 1 player 2), in the Kempston order, active high */
void timexSetJoystick(uint32_t side, uint32_t bits) {
  sp48TimexJoystick[side & 0x01u] = (uint8_t)(bits & 0x1fu);
}

/* Whether the 64-column mode's colours are BRIGHT on this model */
uint32_t timexGetHiresBright(void) {
  return sp48ScldHiresBright;
}

/* --- The Extension ROM (8K) */
void timexUploadExromByte(uint32_t offset, uint32_t value) {
  if (offset < 0x2000u) {
    sp48TimexExrom[offset] = (uint8_t)value;
    if (sp48TimexExromLoaded == 0u) {
      sp48TimexExromLoaded = 1u;
      timexRebuildChunkMap();
    }
  }
}

uint8_t *timexExromPtr(void) {
  return sp48TimexExrom;
}

uint32_t timexGetExromLoaded(void) {
  return sp48TimexExromLoaded;
}

/* --- The DOCK bank: the host writes the 64K image, then each chunk's type (a .dck header byte) */
uint8_t *timexDockPtr(void) {
  return sp48TimexDock;
}

void timexDockSetChunkType(uint32_t chunk, uint32_t type) {
  sp48TimexDockChunkType[chunk & 0x07u] = (uint8_t)(type & 0x03u);
  timexRebuildChunkMap();
}

uint32_t timexDockGetChunkType(uint32_t chunk) {
  return sp48TimexDockChunkType[chunk & 0x07u];
}

/* Removes the cartridge: every DOCK chunk unpopulated, its memory cleared */
void timexDockEject(void) {
  for (uint32_t i = 0u; i < 0x10000u; i++) sp48TimexDock[i] = 0u;
  for (uint32_t chunk = 0u; chunk < 8u; chunk++) sp48TimexDockChunkType[chunk] = 0u;
  timexRebuildChunkMap();
}

/* Where chunk 0-7 comes from now: 0 HOME, 1 DOCK, 2 EXROM, 3 nothing */
uint32_t timexGetChunkSource(uint32_t chunk) {
  if (sp48TimexChunkMapValid == 0u) timexRebuildChunkMap();
  return sp48TimexChunkSource[chunk & 0x07u];
}

/* --- The tape traps: where the ROM's LD-BYTES and SA-BYTES are, and in which ROM */
static uint8_t timexTapeTrapActive(void) {
  if (timexTapeEnabled == 0u) return 0u;
  const uint32_t source = timexGetChunkSource(0u);
  return timexTapeInExrom != 0u ? source == TIMEX_CHUNK_EXROM : source == TIMEX_CHUNK_HOME;
}

void timexSetTapeTraps(uint32_t load, uint32_t invalidHeader, uint32_t resume, uint32_t save, uint32_t flags) {
  timexTapeLoad = load & 0xffffu;
  timexTapeInvalidHeader = invalidHeader & 0xffffu;
  timexTapeResume = resume & 0xffffu;
  timexTapeSave = save & 0xffffu;
  /* bit 0: the routines are in the EXROM; bit 1: no known routines, so no trap */
  timexTapeInExrom = (flags & 0x01u) != 0u ? 1u : 0u;
  timexTapeEnabled = (flags & 0x02u) != 0u ? 0u : 1u;
}

uint32_t timexGetTapeLoadTrap(void) {
  return timexTapeLoad;
}

/* --- The AY (the 2068s), under the names the 128K's PSG panel adapter reads */
uint32_t timexGetPsgRegisterIndex(void) {
  return sp128PsgRegisterIndex;
}

uint32_t timexGetPsgRegisterValue(uint32_t index) {
  return sp128PsgGetRegisterValue(index);
}

uint32_t timexReadPsgRegisterValue(void) {
  return sp128PsgDataRead();
}

uint32_t timexGetPsgToneA(void) {
  return sp128PsgGetToneA();
}

uint32_t timexGetPsgToneB(void) {
  return sp128PsgTone[1].period;
}

uint32_t timexGetPsgToneC(void) {
  return sp128PsgTone[2].period;
}

uint32_t timexGetPsgVolumeA(void) {
  return sp128PsgGetVolumeA();
}

uint32_t timexGetPsgVolumeB(void) {
  return sp128PsgTone[1].volume & 0x0fu;
}

uint32_t timexGetPsgVolumeC(void) {
  return sp128PsgTone[2].volume & 0x0fu;
}

uint32_t timexGetPsgCurrentOutput(void) {
  return (uint32_t)sp128PsgCurrentOutput;
}

uint32_t timexGetHasAy(void) {
  return sp48TimexHasAy;
}
