/*
 * The CPU's bus-cycle timing: the ASIC's contention (plan §3.2, §6, D5; ASIC_VIDEO_MEMORY_TIMING.md §4).
 *
 * The rules (Simon Owen's measurements on a real SAM): memory accesses to internal RAM are held to one
 * access in every 4 T in the border and one in every 8 T in the screen area (lines 0-191, from
 * SAM_SCREEN_CONTENTION_LEAD T before the screen fetch); mode 1 adds 64-T stripes every 128 T across the
 * whole line, border included; SOFF (modes 3/4) makes the whole frame border; ROM and external RAM are
 * never held. I/O to the ASIC's ports (low byte F8h-FFh) is one in every 8 T, always; other ports are
 * never held (plan Q13).
 *
 * The model: a closed-form wait, `(free - sample) & mask`, where `sample` is the frame tact at which the
 * ASIC samples the cycle (T2 of a memory cycle, TW of an I/O cycle: kosarev/z80 issue #10) and `free`
 * the grid's phase. The phases are the table below; their values reproduce Owen's published instruction
 * timings (`test/sam-hw/timing.test.ts`), so a real-hardware measurement changes data, not code.
 *
 * Refresh cycles and the interrupt acknowledge are not held (plan Q20). The region (the mode and SOFF)
 * changes at a cell boundary (`samContentionMode`, set by the cell stepper in sam-video.c).
 */

/* Where the ASIC samples a cycle, in T from the cycle's start (T1 = 0) */
#define SAM_MEM_SAMPLE_T 1u
#define SAM_IO_SAMPLE_T 2u
/* The free slot of the memory and I/O grids, as a frame-tact phase (mod 4 or 8) */
#define SAM_MEM_FREE_PHASE 1u
#define SAM_IO_FREE_PHASE 3u
/* The screen's contention starts this many T before its fetch window (SimCoupé's measured offset) */
#define SAM_SCREEN_CONTENTION_LEAD 4u
/* The mode-1 stripes: a 64-T stripe is contended where bit 6 of (hc + this) is 0 (plan Q2) */
#define SAM_MODE1_STRIPE_PHASE 4u

#define SAM_CONT_MODE1 0u
#define SAM_CONT_MODE234 1u
#define SAM_CONT_BORDER 2u

/* The contention region's mode, latched at each cell boundary */
static uint8_t samContentionMode;

/* The frame tact `t` (0 to SAM_FRAME_TACTS - 1, or a little past it) as the contention grid sees it */
static inline uint32_t samMemMask(uint32_t t) {
  if (samContentionMode == SAM_CONT_BORDER) return 3u;
  if (t >= SAM_FRAME_TACTS) t -= SAM_FRAME_TACTS;
  const uint32_t line = t / SAM_LINE_TACTS;
  const uint32_t cycle = (t + SAM_SCREEN_CONTENTION_LEAD) % SAM_LINE_TACTS;
  if (line >= SAM_SCREEN_FIRST_LINE && line < SAM_SCREEN_FIRST_LINE + 192u && cycle >= 128u) return 7u;
  if (samContentionMode == SAM_CONT_MODE1 && (((t + SAM_MODE1_STRIPE_PHASE) % SAM_LINE_TACTS) & 0x40u) == 0u) {
    return 7u;
  }
  return 3u;
}

/* The wait a memory cycle starting now on internal RAM gets */
static inline uint32_t samMemWait(void) {
  const uint32_t sample = cpu.tacts - samFrameStart + SAM_MEM_SAMPLE_T;
  const uint32_t mask = samMemMask(sample);
  return (SAM_MEM_FREE_PHASE - sample) & mask;
}

static void SAM_NOINLINE samDelayMemory(uint16_t address, uint32_t kind) {
  (void)kind;
  if (samSectionContended & (1u << (address >> 14))) {
    tactPlusN(3u + samMemWait());
    return;
  }
  tactPlusN(3u);
}

/* The wait an I/O cycle starting now on an ASIC port gets */
static inline uint32_t samIoWait(void) {
  const uint32_t sample = cpu.tacts - samFrameStart + SAM_IO_SAMPLE_T;
  return (SAM_IO_FREE_PHASE - sample) & 7u;
}

static void SAM_NOINLINE samDelayPort(uint16_t address) {
  if ((uint8_t)address >= 0xf8u) {
    tactPlusN(4u + samIoWait());
    return;
  }
  tactPlusN(4u);
}

/* The tests' view of the grid: the wait a memory (kind 0) or ASIC I/O (kind 1) cycle starting at frame tact `t` gets */
uint32_t samGetContentionWait(uint32_t kind, uint32_t t) {
  if (kind == 1u) return (SAM_IO_FREE_PHASE - (t + SAM_IO_SAMPLE_T)) & 7u;
  const uint32_t sample = t + SAM_MEM_SAMPLE_T;
  return (SAM_MEM_FREE_PHASE - sample) & samMemMask(sample);
}
uint32_t samGetContentionMode(void) { return samContentionMode; }
