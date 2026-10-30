/*
 * The CPU's bus-cycle timing (plan §3.3, §6, D5; NICK_VIDEO_BACKGROUND.md §2.3; DAVE_MEMORY_IO.md
 * §1.1-§1.2; DAVE_AUDIO_BACKGROUND.md §2.7).
 *
 * DAVE's wait states (BFh bits 3-2): 00 a wait on every memory access, 01 on M1 only (EXOS's setting
 * after boot), 10/11 none. A wait is one T-state, a Tw after T2 (DAVE pulls /WAIT). I/O cycles get
 * none, and video RAM never does ("would conflict with Z80 clock stretch").
 *
 * NICK's clock stretch: every 16-clock slot is NICK's first read (clocks 0-4), its second read (5-9),
 * then the Z80's window (10-15). A memory access to a page that shows video RAM, and an I/O access to
 * NICK's ports 80h-8Fh, must fall in a window: NICK makes the CPU clock from the 8 MHz crystal and holds
 * it until the access lines up, so the hold is a whole number of half-T steps. NICK's clock is not the
 * CPU's, so the hold depends on where the access falls in the slot and drifts from access to access.
 *
 * The model (plan Q3): the cycle's access point - an M1 at T2.0, a memory read or write at T2.5, an
 * I/O cycle at T3.5 (the EXOS book's access points, DAVE_MEMORY_IO.md §1.2) - is held, half a T-state
 * at a time, until it falls in clocks EP_WINDOW_FIRST to EP_WINDOW_FIRST + EP_WINDOW_CLOCKS - 1 of a
 * slot. Where inside the cycle NICK samples the request, and so the exact cost of each phase, is not in
 * any document found (NICK_VIDEO_BACKGROUND.md N11): the constants are one table, so a measurement on
 * a real machine is a one-line change.
 *
 * A port write to NICK lands at the access point (`Z80_DELAY_PORT_*_TAIL` holds back the rest of the
 * cycle), inside the window, so it takes effect from the next slot on.
 *
 * Interrupt acknowledges and refresh cycles are not stretched (NICK refreshes the video RAM itself in
 * slots 54-56).
 */

/* The access point of each cycle kind, in half-T units from the start of T1 */
#define EP_ACCESS_M1_HALVES 4u
#define EP_ACCESS_DATA_HALVES 5u
#define EP_ACCESS_IO_HALVES 7u
/* The Z80's window inside a slot, in NICK clocks */
#define EP_WINDOW_FIRST 10u
#define EP_WINDOW_CLOCKS 6u

/* The rest of an I/O cycle after its access point, in half-T units (`epDelayPortTail`) */
static uint32_t epPortTailHalves;

/*
 * Lets `halves` half-T units pass with the CPU held or running: the clock tree moves exactly that far,
 * and the T-state counter by the whole T-states the half-T clock crosses
 */
static void epStretch(uint32_t halves) {
  const uint32_t whole = (halves + (epHalfClock & 1u)) >> 1;
  epClockAdvance(halves);
  cpu.tacts += whole;
  epCheckFrameCap();
}

/* The half-T steps to hold the clock so that a point `ahead` half-T units from now falls in a window */
static uint32_t epNickHold(uint32_t ahead) {
  const uint64_t first = (uint64_t)EP_WINDOW_FIRST * EP_NICK_DEN;
  const uint64_t last = (uint64_t)(EP_WINDOW_FIRST + EP_WINDOW_CLOCKS) * EP_NICK_DEN;
  for (uint32_t k = 0u; k < 24u; k++) {
    const uint64_t at = (epNickAcc + (uint64_t)(ahead + k) * EP_NICK_NUM) % EP_NICK_SLOT;
    if (at >= first && at < last) return k;
  }
  return 0u;
}

static void EP_NOINLINE epDelayMemory(uint16_t address, uint32_t kind) {
  if (epPageVideo & (1u << (address >> 14))) {
    const uint32_t point = kind == EP_CYCLE_M1 ? EP_ACCESS_M1_HALVES : EP_ACCESS_DATA_HALVES;
    epStretch(6u + epNickHold(point));
    return;
  }
  const uint32_t mode = (epDaveBf >> 2) & 3u;
  const uint32_t wait = mode == 0u || (mode == 1u && kind == EP_CYCLE_M1) ? 1u : 0u;
  tactPlusN(3u + wait);
}

static void EP_NOINLINE epDelayPort(uint16_t address) {
  const uint8_t port = (uint8_t)address;
  if (port >= 0x80u && port <= 0x8fu) {
    epStretch(EP_ACCESS_IO_HALVES + epNickHold(EP_ACCESS_IO_HALVES));
    epPortTailHalves = 8u - EP_ACCESS_IO_HALVES;
    return;
  }
  tactPlusN(4u);
  epPortTailHalves = 0u;
}

static void epDelayPortTail(void) {
  if (epPortTailHalves != 0u) epStretch(epPortTailHalves);
  epPortTailHalves = 0u;
}
