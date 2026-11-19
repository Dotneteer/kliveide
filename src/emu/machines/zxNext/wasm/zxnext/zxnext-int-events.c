/*
 * The interrupt event ring and the interrupt-stop watch (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md`
 * §4.1, §5). Debugging state only: every static here is volatile (build-zxnext-wasm.cjs), so a state
 * file or a reverse-debugging keyframe never carries it.
 *
 * Nothing here changes the machine. The recorders are called from the interrupt controller, the CPU
 * step and the NMI path, always behind `zxnextIntEventsActive` (one byte, set while the ring records
 * or a stop is armed), so a fast frame without either pays one predictable branch per call site.
 *
 * A record is 16 bytes:
 *   +0  u32 frame       the frame counter (`frames`)
 *   +4  u32 pos28       the position in the frame in 28 MHz clocks (`frameTacts28`)
 *   +8  u8  kind        ZXNEXT_IEV_*
 *   +9  u8  source      the daisy-chain index 0-13, ZXNEXT_IEV_SRC_NMI_* for an NMI, $FF unknown
 *   +10 u8  vector      the vector an IM 2 acknowledge read, $FF otherwise
 *   +11 u8  flags       ZXNEXT_IEVF_*
 *   +12 u16 pc          the PC: the interrupted address for ACK, the instruction's for the others
 *   +14 u16 sp          SP before the event
 * The ring is counted in records, not frames (plan D8): `zxnextIntEventCount` only ever grows, the
 * record `n` lives at `n % ZXNEXT_IEV_CAPACITY`.
 */

#define ZXNEXT_IEV_CAPACITY 65536u
#define ZXNEXT_IEV_RECORD_SIZE 16u

#define ZXNEXT_IEV_REQ 1u          /* a source's request edge (status latched; flags say whether enabled) */
#define ZXNEXT_IEV_ACK 2u          /* the CPU took the interrupt */
#define ZXNEXT_IEV_END 3u          /* the handler returned to the interrupted address */
#define ZXNEXT_IEV_RETI 4u         /* a RETI released the source in service */
#define ZXNEXT_IEV_RETI_IGNORED 5u /* a RETI outside IM 2 while a source was in service: nothing released */
#define ZXNEXT_IEV_RETN_ISR 6u     /* a RETN while a maskable source was in service: nothing released */
#define ZXNEXT_IEV_LOST 7u         /* a pulse ended without the CPU taking it */
#define ZXNEXT_IEV_WAIT 8u         /* a request has waited longer than the stop's limit */
#define ZXNEXT_IEV_NMI 9u          /* the CPU took an NMI */
#define ZXNEXT_IEV_NMI_END 10u     /* the NMI handler's RETN */

#define ZXNEXT_IEV_SRC_NMI_MF 0x20u
#define ZXNEXT_IEV_SRC_NMI_DIVMMC 0x21u
#define ZXNEXT_IEV_SRC_NMI_OTHER 0x22u
#define ZXNEXT_IEV_SRC_UNKNOWN 0xffu

#define ZXNEXT_IEVF_ENABLED 0x01u  /* REQ: the source's enable was on (or the request is unqualified) */
#define ZXNEXT_IEVF_SOFTWARE 0x02u /* REQ: raised by a NextReg $20 write */
#define ZXNEXT_IEVF_PULSE 0x04u    /* the pulse /INT, not the daisy chain */
#define ZXNEXT_IEVF_STACKLESS 0x08u /* NMI: the stackless NMI was on */
/* Bits 5-4: the CPU's effective speed when the event happened (0 3.5 MHz .. 3 28 MHz), so the IDE
   can turn 28 MHz positions into the CPU's own T-states (a T-state is 8 >> speed clocks) */
#define ZXNEXT_IEVF_SPEED_SHIFT 4u

uint32_t z80GetTacts(void);
uint32_t z80GetPc(void);
uint32_t z80GetSp(void);

static uint8_t zxnextIntEvents[ZXNEXT_IEV_CAPACITY * ZXNEXT_IEV_RECORD_SIZE];
static uint32_t zxnextIntEventCount;
static uint8_t zxnextIntEventsEnabled;
/* Recording on, or a stop armed: the one flag the hot paths test */
static uint8_t zxnextIntEventsActive;

/* The stop watch: a bit per kind, a bit per source for ACK, the WAIT limit in CPU tacts */
static uint32_t zxnextIntWatchKinds;
static uint32_t zxnextIntWatchAckSources;
static uint32_t zxnextIntWatchNmiSources;
static uint32_t zxnextIntWatchWaitLimit;
/* The first watched event since the host last took one (the NextReg/Copper latches' rule) */
static uint8_t zxnextIntHitPresent;
static uint8_t zxnextIntHitRecord[ZXNEXT_IEV_RECORD_SIZE];

/* When each source's request became pending, for WAIT, and whether its WAIT was reported */
static uint32_t zxnextIntReqTacts[14];
static uint8_t zxnextIntWaitReported[14];

/* The pulse /INT a source started and nobody has taken yet (LOST) */
static uint8_t zxnextIntPulseOpen;
static uint8_t zxnextIntPulseSource;
static uint8_t zxnextIntPulseSoftware;
static uint32_t zxnextIntPulseStart;

/* The handlers running: where each returns to and the SP its return address sits at (END) */
#define ZXNEXT_IEV_FRAMES 16u
static uint8_t zxnextIntFrameCount;
static uint8_t zxnextIntFrameSource[ZXNEXT_IEV_FRAMES];
static uint16_t zxnextIntFramePc[ZXNEXT_IEV_FRAMES];
static uint16_t zxnextIntFrameSp[ZXNEXT_IEV_FRAMES];
static uint8_t zxnextIntNmiOpen;

static void zxnextIntEventsUpdateActive(void) {
  zxnextIntEventsActive = zxnextIntEventsEnabled || zxnextIntWatchKinds != 0u;
}

static uint32_t zxnextIntWatchMatches(uint32_t kind, uint32_t source) {
  if (!(zxnextIntWatchKinds & (1u << kind))) return 0u;
  if (kind == ZXNEXT_IEV_ACK) return source < 14u && (zxnextIntWatchAckSources & (1u << source));
  if (kind == ZXNEXT_IEV_NMI) return source >= ZXNEXT_IEV_SRC_NMI_MF && source <= ZXNEXT_IEV_SRC_NMI_OTHER &&
    (zxnextIntWatchNmiSources & (1u << (source - ZXNEXT_IEV_SRC_NMI_MF)));
  return 1u;
}

static void zxnextIntEvent(uint32_t kind, uint32_t source, uint32_t vector, uint32_t flags, uint32_t pc, uint32_t sp) {
  uint8_t rec[ZXNEXT_IEV_RECORD_SIZE];
  uint32_t f = frames;
  uint32_t p = frameTacts28;
  rec[0] = (uint8_t)f; rec[1] = (uint8_t)(f >> 8); rec[2] = (uint8_t)(f >> 16); rec[3] = (uint8_t)(f >> 24);
  rec[4] = (uint8_t)p; rec[5] = (uint8_t)(p >> 8); rec[6] = (uint8_t)(p >> 16); rec[7] = (uint8_t)(p >> 24);
  flags |= (uint32_t)(cpuEffectiveSpeed & 0x03u) << ZXNEXT_IEVF_SPEED_SHIFT;
  rec[8] = (uint8_t)kind; rec[9] = (uint8_t)source; rec[10] = (uint8_t)vector; rec[11] = (uint8_t)flags;
  rec[12] = (uint8_t)pc; rec[13] = (uint8_t)(pc >> 8); rec[14] = (uint8_t)sp; rec[15] = (uint8_t)(sp >> 8);
  if (zxnextIntEventsEnabled) {
    uint8_t *dst = &zxnextIntEvents[(zxnextIntEventCount % ZXNEXT_IEV_CAPACITY) * ZXNEXT_IEV_RECORD_SIZE];
    for (uint32_t i = 0; i < ZXNEXT_IEV_RECORD_SIZE; i++) dst[i] = rec[i];
    zxnextIntEventCount++;
  }
  if (!zxnextIntHitPresent && zxnextIntWatchMatches(kind, source)) {
    for (uint32_t i = 0; i < ZXNEXT_IEV_RECORD_SIZE; i++) zxnextIntHitRecord[i] = rec[i];
    zxnextIntHitPresent = 1u;
  }
}

/* A request edge from the controller; `pending` says the chain took it as a new pending request */
static void zxnextIntEventRequest(uint32_t index, uint32_t enabled, uint32_t software, uint32_t pulseStarted, uint32_t pending) {
  if (pending && index < 14u) {
    zxnextIntReqTacts[index] = z80GetTacts();
    zxnextIntWaitReported[index] = 0u;
  }
  if (pulseStarted) {
    zxnextIntPulseOpen = 1u;
    zxnextIntPulseSource = (uint8_t)index;
    zxnextIntPulseSoftware = (uint8_t)(software != 0u);
    zxnextIntPulseStart = z80GetTacts();
  }
  zxnextIntEvent(ZXNEXT_IEV_REQ, index, 0xffu,
    (enabled ? ZXNEXT_IEVF_ENABLED : 0u) | (software ? ZXNEXT_IEVF_SOFTWARE : 0u) | (pulseStarted ? ZXNEXT_IEVF_PULSE : 0u),
    z80GetPc(), z80GetSp());
}

/* The CPU takes a maskable interrupt; `source` is the chain's device, or $FF for the pulse */
static void zxnextIntEventAcknowledge(uint32_t source, uint32_t vector, uint32_t pc, uint32_t sp) {
  uint32_t pulse = source >= 14u;
  if (pulse) {
    source = zxnextIntPulseOpen ? zxnextIntPulseSource : ZXNEXT_IEV_SRC_UNKNOWN;
  }
  zxnextIntPulseOpen = 0u;
  if (zxnextIntFrameCount < ZXNEXT_IEV_FRAMES) {
    zxnextIntFrameSource[zxnextIntFrameCount] = (uint8_t)source;
    zxnextIntFramePc[zxnextIntFrameCount] = (uint16_t)pc;
    zxnextIntFrameSp[zxnextIntFrameCount] = (uint16_t)(sp - 2u);
    zxnextIntFrameCount++;
  }
  zxnextIntEvent(ZXNEXT_IEV_ACK, source, vector, pulse ? ZXNEXT_IEVF_PULSE : 0u, pc, sp);
}

static void zxnextIntEventNmi(uint32_t source, uint32_t stackless, uint32_t pc, uint32_t sp) {
  zxnextIntNmiOpen = 1u;
  zxnextIntEvent(ZXNEXT_IEV_NMI, source, 0xffu, stackless ? ZXNEXT_IEVF_STACKLESS : 0u, pc, sp);
}

/*
 * After every instruction while active: a handler that returned to its interrupted address (END), a
 * pulse nobody took before it ended (LOST), a request that waited too long (WAIT).
 */
static void zxnextIntEventsAfterInstruction(uint32_t pcBefore, uint32_t spBefore, uint32_t retn, uint32_t pulseCycles) {
  uint32_t pc = z80GetPc();
  uint32_t sp = z80GetSp();
  while (zxnextIntFrameCount > 0u) {
    uint32_t top = zxnextIntFrameCount - 1u;
    if (pc == zxnextIntFramePc[top] && sp == (uint16_t)(zxnextIntFrameSp[top] + 2u)) {
      zxnextIntFrameCount--;
      zxnextIntEvent(ZXNEXT_IEV_END, zxnextIntFrameSource[top], 0xffu, 0u, pcBefore, spBefore);
      continue;
    }
    break;
  }
  if (retn && zxnextIntNmiOpen) {
    zxnextIntNmiOpen = 0u;
    zxnextIntEvent(ZXNEXT_IEV_NMI_END, ZXNEXT_IEV_SRC_NMI_OTHER, 0xffu, 0u, pcBefore, spBefore);
  }
  if (zxnextIntPulseOpen && (uint32_t)(z80GetTacts() - zxnextIntPulseStart) >= pulseCycles) {
    zxnextIntPulseOpen = 0u;
    zxnextIntEvent(ZXNEXT_IEV_LOST, zxnextIntPulseSource, 0xffu,
      ZXNEXT_IEVF_PULSE | (zxnextIntPulseSoftware ? ZXNEXT_IEVF_SOFTWARE : 0u), pcBefore, spBefore);
  }
}

static void zxnextIntEventsReset(void) {
  zxnextIntPulseOpen = 0u;
  zxnextIntFrameCount = 0u;
  zxnextIntNmiOpen = 0u;
  for (uint32_t i = 0; i < 14u; i++) {
    zxnextIntReqTacts[i] = 0u;
    zxnextIntWaitReported[i] = 0u;
  }
}
