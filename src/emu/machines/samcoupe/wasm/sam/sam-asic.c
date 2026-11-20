/*
 * The ASIC's interrupts and STATUS (plan §7.4; ASIC_VIDEO_MEMORY_TIMING.md §5).
 *
 * STATUS (F9h read) is active low and shows live pulses, not latches: an interrupt missed while
 * interrupts are disabled for the whole pulse is lost. The core computes the pulses from the frame tact:
 *
 *   - frame: from the frame's start (vc 244, hc 0, where the machine frame begins, D4) for
 *     SAM_INT_PULSE_T T (plan Q5: 128 T, SimCoupé's and ZX-Uno's; the manual says "about 20 us");
 *   - line: LINE 0-191 pulses at vc = LINE, hc 0 (the start of the right border after line LINE - 1),
 *     for the same length; 192-255 never. A LINE write while the pulse is active ends it (SimCoupé;
 *     one constant);
 *   - MIDI OUT: a write to FDh starts a 320 us byte (1920 T); TXFMST (LPEN bit 1) is high meanwhile, and
 *     the MIDIOUT pulse (SAM_MIDI_INT_T) comes at its end (plan Q7: the manual's wording). MIDI IN and
 *     the mouse interrupt never fire.
 *
 * /INT is the AND of the active-low bits, level-triggered. IM 2 reads FFh from the idle bus (Q12).
 */

#define SAM_INT_PULSE_T 128u
#define SAM_LINE_WRITE_ENDS_PULSE 1
#define SAM_MIDI_BYTE_T 1920u
#define SAM_MIDI_INT_T 96u

#define SAM_STATUS_LINE 0x01u
#define SAM_STATUS_MOUSE 0x02u
#define SAM_STATUS_MIDIIN 0x04u
#define SAM_STATUS_FRAME 0x08u
#define SAM_STATUS_MIDIOUT 0x10u

/* The line-interrupt register (F9h write) */
static uint8_t samLineReg = 0xffu;
/* A LINE write ended the pulse that started at this absolute tact (with `samLineKilled` set) */
static uint32_t samLineKilledAt;
static uint8_t samLineKilled;
/* MIDI OUT: transmitting, and when the byte ends (absolute tacts) */
static uint8_t samMidiBusy;
static uint32_t samMidiEndsAt;
static uint8_t samMidiData;

/* The frame tact now (0 to SAM_FRAME_TACTS - 1) */
static inline uint32_t samFrameTact(void) {
  const uint32_t t = cpu.tacts - samFrameStart;
  return t < SAM_FRAME_TACTS ? t : t - SAM_FRAME_TACTS;
}

/* The tact (frame-relative) the line pulse starts at, or a value past the frame for none */
static inline uint32_t samLinePulseStart(void) {
  return samLineReg < 192u ? ((uint32_t)samLineReg + SAM_SCREEN_FIRST_LINE) * SAM_LINE_TACTS : 0xffffffffu;
}

static inline uint8_t samLinePulseActive(uint32_t ft) {
  const uint32_t start = samLinePulseStart();
  if (start == 0xffffffffu || ft < start || ft - start >= SAM_INT_PULSE_T) return 0u;
  if (samLineKilled && samLineKilledAt == samFrameStart + start) return 0u;
  return 1u;
}

static inline uint8_t samMidiPulseActive(void) {
  if (!samMidiBusy) return 0u;
  const int32_t since = (int32_t)(cpu.tacts - samMidiEndsAt);
  return since >= 0 && since < (int32_t)SAM_MIDI_INT_T ? 1u : 0u;
}

/* STATUS bits 0-4 (active low) */
static uint8_t samStatusBits(void) {
  const uint32_t ft = samFrameTact();
  uint8_t status = 0x1fu;
  if (ft < SAM_INT_PULSE_T) status &= (uint8_t)~SAM_STATUS_FRAME;
  if (samLinePulseActive(ft)) status &= (uint8_t)~SAM_STATUS_LINE;
  if (samMidiPulseActive()) status &= (uint8_t)~SAM_STATUS_MIDIOUT;
  return status;
}

/* The INT line (1 = active) */
static inline uint8_t samIntLine(void) { return samStatusBits() != 0x1fu ? 1u : 0u; }

/* TXFMST: the MIDI OUT byte is being sent */
static inline uint8_t samMidiTransmitting(void) {
  if (!samMidiBusy) return 0u;
  if ((int32_t)(cpu.tacts - samMidiEndsAt) >= (int32_t)SAM_MIDI_INT_T) samMidiBusy = 0u;
  return samMidiBusy && (int32_t)(cpu.tacts - samMidiEndsAt) < 0 ? 1u : 0u;
}

static void samWriteLine(uint8_t value) {
  if (SAM_LINE_WRITE_ENDS_PULSE) {
    const uint32_t ft = samFrameTact();
    if (samLinePulseActive(ft)) {
      samLineKilled = 1u;
      samLineKilledAt = samFrameStart + samLinePulseStart();
    }
  }
  samLineReg = value;
}

static void samWriteMidi(uint8_t value) {
  samMidiData = value;
  samMidiBusy = 1u;
  samMidiEndsAt = cpu.tacts + SAM_MIDI_BYTE_T;
}

static void samAsicReset(void) {
  samLineReg = 0xffu;
  samLineKilled = 0u;
  samLineKilledAt = 0u;
  samMidiBusy = 0u;
  samMidiEndsAt = 0u;
}

uint32_t samGetLineRegister(void) { return samLineReg; }
uint32_t samGetStatus(void) { return samStatusBits(); }
uint32_t samGetMidiData(void) { return samMidiData; }
