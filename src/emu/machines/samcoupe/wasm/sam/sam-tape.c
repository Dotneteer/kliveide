/*
 * The cassette (plan §9.4; SOUND_INPUT_IO.md §5): EAR on FEh bit 6, MIC on the border's bit 3.
 *
 * The host turns a tape file into a list of half-periods in 3.5 MHz Spectrum T-states (the shared tape
 * layer's unit), which the core plays at the SAM's 6 MHz with the remainder carried: an edge of n
 * Spectrum T-states lasts n * 12 / 7 SAM T-states. EAR idles at 1. While a tape plays, its level is
 * echoed into the audio.
 *
 * The SAM has no motor control, so the deck plays on its own (SimCoupé starts its tape the same way, from
 * the ROM's behaviour): a frame in which the CPU reads FEh at least SAM_TAPE_AUTOPLAY_READS times - a
 * loader polling EAR - starts a loaded tape, and SAM_TAPE_AUTOSTOP_FRAMES frames in a row with fewer stop
 * it again where it is. The host's Play and Stop override it (`samTapePlay`).
 *
 * SAVE: every MIC change while recording is kept as a half-period (in SAM T-states) in a ring the host
 * decodes.
 */

#define SAM_TAPE_CAPACITY 262144u
#define SAM_TAPE_SAVE_CAPACITY 65536u

static uint32_t samTapeEdges[SAM_TAPE_CAPACITY];
static uint32_t samTapeLength;
static uint32_t samTapePosition;
static uint8_t samTapePlaying;
static uint8_t samTapeLevel = 1u;
/* The next edge's time, in 1/7 SAM T-states (absolute tacts x 7) */
static uint64_t samTapeNextEdge7;

static uint32_t samTapeSaved[SAM_TAPE_SAVE_CAPACITY];
static uint32_t samTapeSavedLength;
static uint32_t samTapeSavedRevision;
static uint8_t samTapeRecording;
static uint8_t samTapeMicLevel;
static uint32_t samTapeMicSince;

static uint64_t samTapeClock7(void);

#define SAM_TAPE_AUTOPLAY_READS 1000u
#define SAM_TAPE_AUTOSTOP_FRAMES 50u
/* FEh reads in the current frame, and frames in a row with few */
static uint32_t samTapeEarReads;
static uint32_t samTapeQuietFrames;
static uint8_t samTapeAuto = 1u;

/* Plays the edges that are due by now */
static void samTapeAdvance(void) {
  if (!samTapePlaying) return;
  const uint64_t now7 = samTapeClock7();
  while (samTapePlaying && samTapeNextEdge7 <= now7) {
    if (samTapePosition >= samTapeLength) {
      samTapePlaying = 0u;
      samTapeLevel = 1u;
      samTapeAudioLevel = 0u;
      break;
    }
    samTapeLevel ^= 1u;
    samTapeAudioLevel = samTapeLevel;
    samTapeNextEdge7 += (uint64_t)samTapeEdges[samTapePosition++] * 12u;
  }
}

static uint8_t samTapeEarBit(void) {
  samTapeEarReads++;
  samTapeAdvance();
  return samTapeLevel ? 0x40u : 0u;
}

static void samTapeMicChanged(uint8_t border) {
  const uint8_t level = (border & 0x08u) != 0u;
  if (level == samTapeMicLevel) return;
  if (samTapeRecording && samTapeSavedLength < SAM_TAPE_SAVE_CAPACITY) {
    samTapeSaved[samTapeSavedLength++] = cpu.tacts - samTapeMicSince;
    samTapeSavedRevision++;
  }
  samTapeMicLevel = level;
  samTapeMicSince = cpu.tacts;
}

void samTapePlay(uint32_t play);

/* The frame ends: the auto-play rule */
static void samTapeFrameEnds(void) {
  if (samTapeAuto) {
    if (!samTapePlaying && samTapeEarReads >= SAM_TAPE_AUTOPLAY_READS && samTapePosition < samTapeLength) {
      samTapePlay(1u);
      samTapeQuietFrames = 0u;
    } else if (samTapePlaying) {
      samTapeQuietFrames = samTapeEarReads < SAM_TAPE_AUTOPLAY_READS ? samTapeQuietFrames + 1u : 0u;
      if (samTapeQuietFrames >= SAM_TAPE_AUTOSTOP_FRAMES) samTapePlay(0u);
    }
  }
  samTapeEarReads = 0u;
}

static void samTapeReset(void) {
  samTapePlaying = 0u;
  samTapeLevel = 1u;
}

uint32_t samTapeEdgesPtr(void) { return (uint32_t)(uintptr_t)samTapeEdges; }
uint32_t samTapeGetCapacity(void) { return SAM_TAPE_CAPACITY; }
/* The host wrote `length` edges: the tape is rewound and stopped */
void samTapeSetLength(uint32_t length) {
  samTapeLength = length < SAM_TAPE_CAPACITY ? length : SAM_TAPE_CAPACITY;
  samTapePosition = 0u;
  samTapePlaying = 0u;
  samTapeLevel = 1u;
}
void samTapePlay(uint32_t play) {
  if (play && !samTapePlaying && samTapePosition < samTapeLength) {
    samTapePlaying = 1u;
    samTapeNextEdge7 = samTapeClock7();
  } else if (!play) {
    samTapePlaying = 0u;
    samTapeAudioLevel = 0u;
  }
}
void samTapeRewind(void) {
  samTapePosition = 0u;
  samTapePlaying = 0u;
  samTapeLevel = 1u;
}
uint32_t samTapeGetPosition(void) { return samTapePosition; }
/* Whether the deck starts and stops itself (the default) */
void samTapeSetAuto(uint32_t on) { samTapeAuto = on != 0u; }
uint32_t samTapeGetPlaying(void) { return samTapePlaying; }
uint32_t samTapeGetLevel(void) { return samTapeLevel; }
void samTapeSetRecording(uint32_t on) {
  samTapeRecording = on != 0u;
  if (on) {
    samTapeSavedLength = 0u;
    samTapeMicSince = cpu.tacts;
  }
}
uint32_t samTapeSavedPtr(void) { return (uint32_t)(uintptr_t)samTapeSaved; }
uint32_t samTapeGetSavedLength(void) { return samTapeSavedLength; }
uint32_t samTapeGetSavedRevision(void) { return samTapeSavedRevision; }
