/*
 * The ZX Interface 1 and its Microdrives (`.plans/MICRODRIVE_PLAN.md`, Phase 1; the facts and their
 * sources are in `_input/microdrive/`). The 48K and the 128K cores include this once, before z80.c.
 * It holds the interface's 8K ROM, pages it over $0000-$3FFF (mirrored) on the M1 fetches the
 * hardware traps, decodes the interface's three ports, and runs up to eight drives.
 *
 * The including core defines:
 * - ZXIF1_PREFIX: its export prefix (`sp48`, `sp128`)
 * - ZXIF1_NOW(): the CPU's T-state counter
 * - ZXIF1_TACTS_PER_MS(): T-states per millisecond (the clock and its multiplier), as a double
 * - ZXIF1_FRAME_END(): the absolute tact the current frame ends at
 * - ZXIF1_REMAPPED(): the paging changed - bring the core's view of $0000-$3FFF up to date
 * - ZXIF1_RZX_PLAYING(): an RZX recording is playing (port reads come from it, so the drives rest)
 *
 * and calls:
 * - ZXIF1_BEFORE_OPCODE_FETCH(pc) and ZXIF1_AFTER_OPCODE_FETCH(pc) from its Z80 hooks;
 * - zxIf1IsPort / zxIf1ReadPort / zxIf1WritePort from its port decoding;
 * - zxIf1PortWait(address, write) from its port delay hooks: the T-states WAIT holds the CPU for;
 * - zxIf1Frozen() before each instruction, and zxIf1RunFrozen(limit) instead of it while frozen (a
 *   WAIT longer than the frame, or one that never ends - the "IN 0 crash");
 * - zxIf1Reset() from its reset, zxIf1ShiftTactOrigin(by) from its tact rebase.
 *
 * Absent (the default), it decodes no port, pages nothing and costs a fast frame one predictable
 * branch per M1.
 *
 * The drive model (plan §3 M4): a cartridge is a ring of sector slots, each laid out in time as
 * [gap A][header: preamble, 15 bytes][gap B][record: preamble, up to ZXIF1_RECORD_MAX bytes][gap C].
 * The head moves lazily: its position is worked out from the tact counter at each port access, as
 * the tape's EAR bit and the Beta 128's controller are. Reads are paced by the CPU: byte i of a
 * block is never handed out before its time and never skipped. A write lands on the block the ROM
 * means (`zxIf1EndWrite`), and the head is aligned with it - the ROM never measures where the tape
 * is, only the order of what passes.
 */

#ifndef ZXIF1_PREFIX
#error "Define ZXIF1_PREFIX before including zx-spectrum-if1.c"
#endif

#define ZXIF1_PASTE2(a, b) a##b
#define ZXIF1_PASTE(a, b) ZXIF1_PASTE2(a, b)
#define ZXIF1(name) ZXIF1_PASTE(ZXIF1_PREFIX, name)

#define ZXIF1_ROM_SIZE 0x2000u
#define ZXIF1_DRIVES 8u
#define ZXIF1_MAX_SLOTS 254u
/* A sector as an .mdr file holds it: the 15-byte header, then the 528-byte record */
#define ZXIF1_SLOT_SIZE 543u
#define ZXIF1_HEADER_SIZE 15u
#define ZXIF1_RECORD_SIZE 528u
/*
 * The longest record the ROM writes: ROM 2's FORMAT test record, 641 bytes with its 12-byte
 * preamble, which READ-BLK verifies as 15 + 612 bytes (plan §9). The bytes past 528 live in the
 * slot's tail; an .mdr keeps the first 528.
 */
#define ZXIF1_RECORD_MAX 640u
#define ZXIF1_TAIL_SIZE (ZXIF1_RECORD_MAX - ZXIF1_RECORD_SIZE)
#define ZXIF1_PREAMBLE 12u
#define ZXIF1_IMAGE_SIZE (ZXIF1_MAX_SLOTS * ZXIF1_SLOT_SIZE)

/* The segments of a slot, in tape order */
#define ZXIF1_SEG_GAP_A 0u
#define ZXIF1_SEG_H_PRE 1u
#define ZXIF1_SEG_H_DATA 2u
#define ZXIF1_SEG_GAP_B 3u
#define ZXIF1_SEG_R_PRE 4u
#define ZXIF1_SEG_R_DATA 5u
#define ZXIF1_SEG_GAP_C 6u
#define ZXIF1_SEGMENTS 7u

/* Port $EF, written: the control bits (interface1-hardware.md §2.3) */
#define ZXIF1_CTL_COMMS_DATA 0x01u
#define ZXIF1_CTL_COMMS_CLK 0x02u
#define ZXIF1_CTL_READ 0x04u
#define ZXIF1_CTL_ERASE_OFF 0x08u

/* A wait that never ends */
#define ZXIF1_NEVER 0xffffffffu

typedef struct ZxIf1Drive {
  uint8_t inserted;
  uint8_t writeProtected;
  uint8_t motorOn;
  uint8_t segment;
  uint16_t slots;
  uint16_t slot;
  /* Where the head's segment started (absolute tact), or, while the motor is off, how far into it */
  uint32_t segmentStart;
  uint32_t stoppedOffset;
  /* The bytes of the current data segment handed to the CPU */
  uint16_t dataIndex;
  /* The last tact the head was brought up to; a peek from the past moves nothing */
  uint32_t advancedTo;
} ZxIf1Drive;

static uint8_t zxIf1Present;
static uint8_t zxIf1Paged;
static uint8_t zxIf1Rom[ZXIF1_ROM_SIZE];
/* What the CPU reads at $0000-$3FFF while paged: the 8K ROM twice (plan §9: mirrored, as MAME does) */
static uint8_t zxIf1View[0x4000u];
/* The last value written to $EF and $F7 */
static uint8_t zxIf1Control = 0xffu;
static uint8_t zxIf1NetOut = 1u;
/* The drives' select flip-flops: bit n is drive n + 1 (drive 1 is nearest the interface) */
static uint8_t zxIf1Select;

static ZxIf1Drive zxIf1Drives[ZXIF1_DRIVES];
/* Per drive: the slots as an .mdr holds them, then the long records' tails */
static uint8_t zxIf1Image[ZXIF1_DRIVES][ZXIF1_IMAGE_SIZE];
static uint8_t zxIf1Tail[ZXIF1_DRIVES][ZXIF1_MAX_SLOTS][ZXIF1_TAIL_SIZE];
/* Per slot: bit 0 the header has signal, bit 1 the record has; the record's length */
static uint8_t zxIf1Signal[ZXIF1_DRIVES][ZXIF1_MAX_SLOTS];
static uint16_t zxIf1RecordLength[ZXIF1_DRIVES][ZXIF1_MAX_SLOTS];
/* Per slot: written since the host last collected the changes */
static uint8_t zxIf1Dirty[ZXIF1_DRIVES][ZXIF1_MAX_SLOTS];
static uint32_t zxIf1DirtyRevision;

/* A write in progress: the bytes after the preamble go to the buffer, then to their block */
static uint8_t zxIf1Writing;
static uint8_t zxIf1WriteDrive;
static uint32_t zxIf1WriteStart;
static uint32_t zxIf1WriteCount;
static uint8_t zxIf1WriteBuffer[ZXIF1_RECORD_MAX];
/*
 * The ERASE line has stayed on since the last write ended (FORMAT): the next write is the block
 * after it - a header's record, a record's next header - wherever the head has got to
 */
static uint8_t zxIf1EraseChain;
static uint8_t zxIf1LastWriteKind;
static uint16_t zxIf1LastWriteSlot;

/* WAIT longer than the frame: the CPU stays frozen until this tact (or for good) */
static uint8_t zxIf1Freeze;
static uint32_t zxIf1FreezeUntil;

static void zxIf1Remap(void);

// -----------------------------------------------------------------------------
// Paging (plan §3 M2): an M1 fetch from $0008 or $1708 pages the ROM in before the fetch reads it
// (the 48K ROM holds the same instructions there); one from $0700 pages it out after its fetch,
// whose RET came from the IF1 ROM. The address alone decides, whichever 128K ROM is selected.

#if defined(__clang__) || defined(__GNUC__)
#define ZXIF1_NOINLINE __attribute__((noinline))
#define ZXIF1_UNLIKELY(x) __builtin_expect(!!(x), 0)
#else
#define ZXIF1_NOINLINE
#define ZXIF1_UNLIKELY(x) (x)
#endif

static void zxIf1Remap(void) {
  ZXIF1_REMAPPED();
}

/* Out of line: a fast frame without the interface pays one load and one predictable branch an M1 */
static ZXIF1_NOINLINE void zxIf1BeforeFetch(uint32_t pc) {
  if (zxIf1Paged == 0u && (pc == 0x0008u || pc == 0x1708u)) {
    zxIf1Paged = 1u;
    zxIf1Remap();
  }
}

static ZXIF1_NOINLINE void zxIf1AfterFetch(uint32_t pc) {
  if (pc == 0x0700u) {
    zxIf1Paged = 0u;
    zxIf1Remap();
  }
}

#define ZXIF1_BEFORE_OPCODE_FETCH(pc) \
  do { if (ZXIF1_UNLIKELY(zxIf1Present != 0u)) zxIf1BeforeFetch((uint32_t)(pc)); } while (0)
#define ZXIF1_AFTER_OPCODE_FETCH(pc) \
  do { if (ZXIF1_UNLIKELY(zxIf1Paged != 0u)) zxIf1AfterFetch((uint32_t)(pc)); } while (0)

static void zxIf1BuildView(void) {
  for (uint32_t i = 0u; i < 0x4000u; i++) zxIf1View[i] = zxIf1Rom[i & (ZXIF1_ROM_SIZE - 1u)];
}

// -----------------------------------------------------------------------------
// Timing (plan §3 M4, §9): durations in T-states at the machine's clock. There is no fast tape: the
// ROM's own delays (motor start, FORMAT's pauses) are CPU time, and a shorter tape moves under them
// further than the ROM expects - FORMAT's verify pass then starts mid-tape and runs out of its visit
// budget. A fast Microdrive runs the whole machine faster instead (plan §3 M6).

typedef struct ZxIf1Timing {
  uint32_t byteTime;
  uint32_t preamble;
  uint32_t gapA;
  uint32_t gapB;
  uint32_t gapC;
} ZxIf1Timing;

static ZxIf1Timing zxIf1GetTiming(void) {
  const double perMs = ZXIF1_TACTS_PER_MS();
  ZxIf1Timing t;
  /* 12 us a bit on each of two tracks: a byte every 48 us; v1 FORMAT's gaps */
  t.byteTime = (uint32_t)(0.048 * perMs + 0.5);
  t.preamble = ZXIF1_PREAMBLE * t.byteTime;
  t.gapA = (uint32_t)(0.57 * perMs + 0.5);
  t.gapB = (uint32_t)(3.23 * perMs + 0.5);
  t.gapC = (uint32_t)(6.2 * perMs + 0.5);
  if (t.byteTime == 0u) t.byteTime = 1u;
  return t;
}

static inline uint8_t zxIf1HasSignal(uint32_t d, uint32_t slot, uint32_t segment) {
  const uint8_t mask = segment <= ZXIF1_SEG_H_DATA ? 0x01u : 0x02u;
  return (zxIf1Signal[d][slot] & mask) != 0u ? 1u : 0u;
}

static uint32_t zxIf1DataLength(uint32_t d, uint32_t slot, uint32_t segment) {
  if (segment == ZXIF1_SEG_H_DATA) return ZXIF1_HEADER_SIZE;
  const uint32_t length = zxIf1RecordLength[d][slot];
  return length != 0u ? length : ZXIF1_RECORD_SIZE;
}

static uint32_t zxIf1SegmentDuration(uint32_t d, uint32_t slot, uint32_t segment, const ZxIf1Timing *t) {
  switch (segment) {
    case ZXIF1_SEG_GAP_A: return t->gapA;
    case ZXIF1_SEG_H_PRE:
    case ZXIF1_SEG_R_PRE: return t->preamble;
    case ZXIF1_SEG_GAP_B: return t->gapB;
    case ZXIF1_SEG_GAP_C: return t->gapC;
    /* Byte i arrives (i + 1) byte times after the sync mark: the last one ends the segment */
    default: return (zxIf1DataLength(d, slot, segment) + 1u) * t->byteTime;
  }
}

static uint8_t zxIf1ByteAt(uint32_t d, uint32_t slot, uint32_t segment, uint32_t index) {
  const uint32_t base = slot * ZXIF1_SLOT_SIZE;
  if (segment == ZXIF1_SEG_H_DATA) return zxIf1Image[d][base + (index < ZXIF1_HEADER_SIZE ? index : 0u)];
  if (index < ZXIF1_RECORD_SIZE) return zxIf1Image[d][base + ZXIF1_HEADER_SIZE + index];
  if (index < ZXIF1_RECORD_MAX) return zxIf1Tail[d][slot][index - ZXIF1_RECORD_SIZE];
  return 0xffu;
}

static void zxIf1MarkDirty(uint32_t d, uint32_t slot) {
  zxIf1Dirty[d][slot] = 1u;
  zxIf1DirtyRevision++;
}

/* The erase head passed over a block: its signal and its bytes are gone */
static void zxIf1EraseBlock(uint32_t d, uint32_t slot, uint32_t segment) {
  const uint8_t mask = segment <= ZXIF1_SEG_H_DATA ? 0x01u : 0x02u;
  if ((zxIf1Signal[d][slot] & mask) == 0u) return;
  zxIf1Signal[d][slot] &= (uint8_t)~mask;
  const uint32_t base = slot * ZXIF1_SLOT_SIZE;
  if (mask == 0x01u) {
    for (uint32_t i = 0u; i < ZXIF1_HEADER_SIZE; i++) zxIf1Image[d][base + i] = 0xffu;
  } else {
    for (uint32_t i = 0u; i < ZXIF1_RECORD_SIZE; i++) zxIf1Image[d][base + ZXIF1_HEADER_SIZE + i] = 0xffu;
    for (uint32_t i = 0u; i < ZXIF1_TAIL_SIZE; i++) zxIf1Tail[d][slot][i] = 0xffu;
    zxIf1RecordLength[d][slot] = ZXIF1_RECORD_SIZE;
  }
  zxIf1MarkDirty(d, slot);
}

static inline uint8_t zxIf1Erasing(uint32_t d) {
  return (zxIf1Control & ZXIF1_CTL_ERASE_OFF) == 0u && zxIf1Drives[d].writeProtected == 0u && zxIf1Writing == 0u
    ? 1u
    : 0u;
}

static void zxIf1EnterSegment(uint32_t d, uint32_t segment) {
  ZxIf1Drive *drive = &zxIf1Drives[d];
  drive->segment = (uint8_t)segment;
  drive->dataIndex = 0u;
  if ((segment == ZXIF1_SEG_H_PRE || segment == ZXIF1_SEG_R_PRE) && zxIf1Erasing(d) != 0u) {
    zxIf1EraseBlock(d, drive->slot, segment);
  }
}

/* Brings drive d's head up to `now` (a drive at rest, or one being written, does not move) */
static void zxIf1Advance(uint32_t d, uint32_t now) {
  ZxIf1Drive *drive = &zxIf1Drives[d];
  if (drive->inserted == 0u || drive->slots == 0u || drive->motorOn == 0u) return;
  if (zxIf1Writing != 0u && zxIf1WriteDrive == d) return;
  if ((int32_t)(now - drive->advancedTo) < 0) return;
  drive->advancedTo = now;
  const ZxIf1Timing t = zxIf1GetTiming();
  /* A long rest: skip whole revolutions first */
  uint32_t guard = 0u;
  for (;;) {
    const uint32_t duration = zxIf1SegmentDuration(d, drive->slot, drive->segment, &t);
    if (now - drive->segmentStart < duration) break;
    drive->segmentStart += duration;
    uint32_t next = drive->segment + 1u;
    if (next == ZXIF1_SEGMENTS) {
      next = ZXIF1_SEG_GAP_A;
      drive->slot = (uint16_t)((drive->slot + 1u) % drive->slots);
    }
    zxIf1EnterSegment(d, next);
    if (++guard >= ZXIF1_SEGMENTS * ZXIF1_MAX_SLOTS * 2u) {
      /* More than two revolutions behind: nothing the ROM saw depends on the lost ones */
      drive->segmentStart = now;
      guard = 0u;
    }
  }
}

/* The drive the interface talks to: the lowest one selected, or -1 */
static int32_t zxIf1SelectedDrive(void) {
  if (zxIf1Select == 0u) return -1;
  for (uint32_t d = 0u; d < ZXIF1_DRIVES; d++) {
    if ((zxIf1Select & (1u << d)) != 0u) return (int32_t)d;
  }
  return -1;
}

static void zxIf1SetMotor(uint32_t d, uint8_t on, uint32_t now) {
  ZxIf1Drive *drive = &zxIf1Drives[d];
  if (drive->motorOn == on) return;
  if (on != 0u) {
    drive->motorOn = 1u;
    drive->segmentStart = now - drive->stoppedOffset;
    drive->advancedTo = now;
  } else {
    zxIf1Advance(d, now);
    drive->stoppedOffset = now - drive->segmentStart;
    drive->motorOn = 0u;
  }
}

// -----------------------------------------------------------------------------
// Writing (plan §3 M4): the first byte written to $E7 with R/W low starts a write; R/W going high,
// the ERASE line going off or the drive's deselection ends it. The bytes after the 12-byte preamble
// are kept; at the end their count says whether the block was a header or a record.

#define ZXIF1_KIND_HEADER 1u
#define ZXIF1_KIND_RECORD 2u

static void zxIf1BeginWrite(uint32_t d, uint32_t now) {
  zxIf1Advance(d, now);
  zxIf1Writing = 1u;
  zxIf1WriteDrive = (uint8_t)d;
  zxIf1WriteStart = now;
  zxIf1WriteCount = 0u;
}

static void zxIf1EndWrite(uint32_t now) {
  if (zxIf1Writing == 0u) return;
  const uint32_t d = zxIf1WriteDrive;
  ZxIf1Drive *drive = &zxIf1Drives[d];
  zxIf1Writing = 0u;
  if (zxIf1WriteCount <= ZXIF1_PREAMBLE) return;
  const uint32_t length = zxIf1WriteCount - ZXIF1_PREAMBLE;
  /* A header is 15 bytes (FORMAT sends 18), a record 528 or more (531, or ROM 2's 629) */
  const uint8_t kind = length < 64u ? ZXIF1_KIND_HEADER : ZXIF1_KIND_RECORD;
  const uint32_t segment = drive->segment;
  uint32_t slot;
  const uint8_t chained = zxIf1EraseChain != 0u
    && ((zxIf1LastWriteKind == ZXIF1_KIND_HEADER && kind == ZXIF1_KIND_RECORD)
      || (zxIf1LastWriteKind == ZXIF1_KIND_RECORD && kind == ZXIF1_KIND_HEADER));
  if (chained != 0u) {
    /* FORMAT: a header's record follows it; a record's next header is the next slot's */
    slot = kind == ZXIF1_KIND_RECORD ? zxIf1LastWriteSlot : (zxIf1LastWriteSlot + 1u) % drive->slots;
  } else if (kind == ZXIF1_KIND_HEADER) {
    /* The next header to pass: this slot's, unless it has passed already */
    slot = segment <= ZXIF1_SEG_H_DATA ? drive->slot : (drive->slot + 1u) % drive->slots;
  } else {
    /* The record of the last header that passed (SEND-BLK writes ~2.7 ms after reading it) */
    slot = segment >= ZXIF1_SEG_GAP_B ? drive->slot : (drive->slot + drive->slots - 1u) % drive->slots;
  }
  const uint32_t base = slot * ZXIF1_SLOT_SIZE;
  if (kind == ZXIF1_KIND_HEADER) {
    for (uint32_t i = 0u; i < ZXIF1_HEADER_SIZE; i++) {
      zxIf1Image[d][base + i] = i < length ? zxIf1WriteBuffer[i] : 0xffu;
    }
    zxIf1Signal[d][slot] |= 0x01u;
  } else {
    const uint32_t kept = length < ZXIF1_RECORD_MAX ? length : ZXIF1_RECORD_MAX;
    for (uint32_t i = 0u; i < ZXIF1_RECORD_MAX; i++) {
      const uint8_t value = i < kept ? zxIf1WriteBuffer[i] : 0xffu;
      if (i < ZXIF1_RECORD_SIZE) zxIf1Image[d][base + ZXIF1_HEADER_SIZE + i] = value;
      else zxIf1Tail[d][slot][i - ZXIF1_RECORD_SIZE] = value;
    }
    zxIf1RecordLength[d][slot] = (uint16_t)(kept < ZXIF1_RECORD_SIZE ? ZXIF1_RECORD_SIZE : kept);
    zxIf1Signal[d][slot] |= 0x02u;
  }
  zxIf1MarkDirty(d, slot);
  /* The head is where the block ends */
  drive->slot = (uint16_t)slot;
  drive->segment = kind == ZXIF1_KIND_HEADER ? (uint8_t)ZXIF1_SEG_GAP_B : (uint8_t)ZXIF1_SEG_GAP_C;
  drive->dataIndex = 0u;
  drive->segmentStart = now;
  drive->advancedTo = now;
  zxIf1LastWriteKind = kind;
  zxIf1LastWriteSlot = (uint16_t)slot;
  zxIf1EraseChain = (zxIf1Control & ZXIF1_CTL_ERASE_OFF) == 0u ? 1u : 0u;
}

// -----------------------------------------------------------------------------
// Ports (plan §3 M3): A4/A3 decode them - 00 data, 01 control/status, 10 RS232/network

static inline uint8_t zxIf1IsPort(uint32_t address) {
  return zxIf1Present != 0u && (address & 0x18u) != 0x18u ? 1u : 0u;
}

static uint8_t zxIf1StatusBits(uint32_t now) {
  /* b3 DTR (the stubbed RS232: the far end is always ready), b4 BUSY and b5-b7 read 1 (§9) */
  uint8_t value = 0xf8u;
  const int32_t d = zxIf1SelectedDrive();
  if (d < 0 || zxIf1Drives[d].inserted == 0u) return (uint8_t)(value | 0x06u);
  ZxIf1Drive *drive = &zxIf1Drives[d];
  if (drive->writeProtected == 0u) value |= 0x01u;
  if (zxIf1Writing != 0u) return (uint8_t)(value | 0x02u);
  zxIf1Advance((uint32_t)d, now);
  const uint32_t segment = drive->segment;
  const uint8_t signal = (segment == ZXIF1_SEG_H_PRE || segment == ZXIF1_SEG_H_DATA
      || segment == ZXIF1_SEG_R_PRE || segment == ZXIF1_SEG_R_DATA)
    && zxIf1HasSignal((uint32_t)d, drive->slot, segment) != 0u;
  /* GAP (b2): 1 over a gap or erased tape; SYNC (b1): 0 once the preamble's sync mark has passed */
  if (signal == 0u) value |= 0x06u;
  else if (segment == ZXIF1_SEG_H_PRE || segment == ZXIF1_SEG_R_PRE) value |= 0x02u;
  return value;
}

/*
 * Where the next byte comes from for a read of $E7, and when: the current data segment's next
 * byte, else the first byte of the next block with signal. Returns the tact it arrives at, or
 * ZXIF1_NEVER, and leaves the head there.
 */
static uint32_t zxIf1NextReadByte(uint32_t d, uint32_t now) {
  ZxIf1Drive *drive = &zxIf1Drives[d];
  zxIf1Advance(d, now);
  const ZxIf1Timing t = zxIf1GetTiming();
  for (uint32_t steps = 0u; steps <= ZXIF1_SEGMENTS * ZXIF1_MAX_SLOTS; steps++) {
    const uint32_t segment = drive->segment;
    if ((segment == ZXIF1_SEG_H_DATA || segment == ZXIF1_SEG_R_DATA)
      && zxIf1HasSignal(d, drive->slot, segment) != 0u
      && drive->dataIndex < zxIf1DataLength(d, drive->slot, segment)) {
      return drive->segmentStart + (drive->dataIndex + 1u) * t.byteTime;
    }
    /* Skip to the next segment, as the tape would carry the head there */
    drive->segmentStart += zxIf1SegmentDuration(d, drive->slot, segment, &t);
    uint32_t next = segment + 1u;
    if (next == ZXIF1_SEGMENTS) {
      next = ZXIF1_SEG_GAP_A;
      drive->slot = (uint16_t)((drive->slot + 1u) % drive->slots);
    }
    zxIf1EnterSegment(d, next);
  }
  return ZXIF1_NEVER;
}

/*
 * WAIT (plan §3 M5): the T-states an access to $E7 holds the CPU for, from its delay hook, before
 * the access. A wait past the frame's end freezes the CPU instead (zxIf1RunFrozen).
 */
static ZXIF1_NOINLINE uint32_t zxIf1PortWait(uint32_t address, uint8_t write) {
  if ((address & 0x18u) != 0u || ZXIF1_RZX_PLAYING()) return 0u;
  const uint32_t now = ZXIF1_NOW();
  const uint8_t readMode = (zxIf1Control & ZXIF1_CTL_READ) != 0u ? 1u : 0u;
  const int32_t d = zxIf1SelectedDrive();
  uint32_t ready;
  if (write != 0u) {
    /* The serialiser takes a byte each byte time; a write in read mode, or to nothing, waits not */
    if (readMode != 0u || d < 0 || zxIf1Drives[d].inserted == 0u || zxIf1Drives[d].writeProtected != 0u) return 0u;
    if (zxIf1Writing == 0u) return 0u;
    ready = zxIf1WriteStart + zxIf1WriteCount * zxIf1GetTiming().byteTime;
  } else {
    if (readMode == 0u) return 0u;
    ready = d < 0 || zxIf1Drives[d].inserted == 0u ? ZXIF1_NEVER : zxIf1NextReadByte((uint32_t)d, now);
  }
  if (ready == ZXIF1_NEVER) {
    zxIf1Freeze = 2u;
    return 0u;
  }
  if ((int32_t)(ready - now) <= 0) return 0u;
  const uint32_t frameEnd = ZXIF1_FRAME_END();
  if ((int32_t)(ready - frameEnd) > 0) {
    zxIf1Freeze = 1u;
    zxIf1FreezeUntil = ready;
    return 0u;
  }
  return ready - now;
}

static uint32_t zxIf1ReadPort(uint32_t address) {
  const uint32_t now = ZXIF1_NOW();
  switch (address & 0x18u) {
    case 0x00u: {
      /* The data port: the byte WAIT held the CPU for (the core's delay hook ran zxIf1PortWait) */
      if ((zxIf1Control & ZXIF1_CTL_READ) == 0u) return 0xffu;
      const int32_t d = zxIf1SelectedDrive();
      if (d < 0 || zxIf1Drives[d].inserted == 0u || zxIf1Freeze == 2u) return 0xffu;
      ZxIf1Drive *drive = &zxIf1Drives[d];
      const uint32_t at = zxIf1Freeze == 1u ? zxIf1FreezeUntil : now;
      const uint32_t ready = zxIf1NextReadByte((uint32_t)d, at);
      if (ready == ZXIF1_NEVER) return 0xffu;
      const ZxIf1Timing t = zxIf1GetTiming();
      /* A CPU later than the tape takes the byte anyway: the rest of the block follows from here */
      if ((int32_t)(at - ready) > 0) drive->segmentStart = at - (drive->dataIndex + 1u) * t.byteTime;
      const uint8_t value = zxIf1ByteAt((uint32_t)d, drive->slot, drive->segment, drive->dataIndex);
      drive->dataIndex++;
      drive->advancedTo = at;
      zxIf1EraseChain = 0u;
      return value;
    }
    case 0x08u:
      return zxIf1StatusBits(now);
    default: {
      /*
       * RS232 and the network, stubbed (plan §3 M8): no start bit ever arrives (b7 = 0), and a lone
       * station on the network reads the inverse of what it sends
       */
      const uint8_t net = (zxIf1Control & ZXIF1_CTL_COMMS_DATA) == 0u ? (uint8_t)(zxIf1NetOut ^ 0x01u) : 0u;
      return (uint32_t)(0x7eu | net);
    }
  }
}

static void zxIf1UpdateSelect(uint8_t select, uint32_t now) {
  if (select == zxIf1Select) return;
  const int32_t before = zxIf1SelectedDrive();
  if (zxIf1Writing != 0u && (select & (1u << zxIf1WriteDrive)) == 0u) zxIf1EndWrite(now);
  for (uint32_t d = 0u; d < ZXIF1_DRIVES; d++) {
    zxIf1SetMotor(d, (select & (1u << d)) != 0u ? 1u : 0u, now);
  }
  zxIf1Select = select;
  if (zxIf1SelectedDrive() != before) zxIf1EraseChain = 0u;
}

static void zxIf1WritePort(uint32_t address, uint32_t value) {
  const uint32_t now = ZXIF1_NOW();
  switch (address & 0x18u) {
    case 0x00u: {
      if ((zxIf1Control & ZXIF1_CTL_READ) != 0u) return;
      const int32_t d = zxIf1SelectedDrive();
      if (d < 0 || zxIf1Drives[d].inserted == 0u || zxIf1Drives[d].writeProtected != 0u) return;
      if (zxIf1Writing == 0u) zxIf1BeginWrite((uint32_t)d, now);
      if (zxIf1WriteCount >= ZXIF1_PREAMBLE && zxIf1WriteCount - ZXIF1_PREAMBLE < ZXIF1_RECORD_MAX) {
        zxIf1WriteBuffer[zxIf1WriteCount - ZXIF1_PREAMBLE] = (uint8_t)value;
      }
      zxIf1WriteCount++;
      return;
    }
    case 0x08u: {
      const uint8_t old = zxIf1Control;
      const uint8_t next = (uint8_t)value;
      /* Advance every running drive first: the erase line's change applies from now on */
      for (uint32_t d = 0u; d < ZXIF1_DRIVES; d++) zxIf1Advance(d, now);
      zxIf1Control = next;
      /* The write ends; whether ERASE stays on decides how the next write is placed */
      if (zxIf1Writing != 0u && ((next & ZXIF1_CTL_READ) != 0u || (next & ZXIF1_CTL_ERASE_OFF) != 0u)) {
        zxIf1EndWrite(now);
      }
      if ((next & ZXIF1_CTL_ERASE_OFF) != 0u) zxIf1EraseChain = 0u;
      /* The erase head switched on over a block erases it */
      if ((old & ZXIF1_CTL_ERASE_OFF) != 0u && (next & ZXIF1_CTL_ERASE_OFF) == 0u) {
        const int32_t d = zxIf1SelectedDrive();
        if (d >= 0 && zxIf1Drives[d].inserted != 0u && zxIf1Drives[d].motorOn != 0u && zxIf1Erasing((uint32_t)d) != 0u) {
          const uint32_t segment = zxIf1Drives[d].segment;
          if (segment != ZXIF1_SEG_GAP_A && segment != ZXIF1_SEG_GAP_B && segment != ZXIF1_SEG_GAP_C) {
            zxIf1EraseBlock((uint32_t)d, zxIf1Drives[d].slot, segment);
          }
        }
      }
      /* COMMS CLK falling: the flip-flops shift, drive 1 taking NOT COMMS DATA (§3 M7) */
      if ((old & ZXIF1_CTL_COMMS_CLK) != 0u && (next & ZXIF1_CTL_COMMS_CLK) == 0u) {
        const uint8_t in = (next & ZXIF1_CTL_COMMS_DATA) == 0u ? 1u : 0u;
        zxIf1UpdateSelect((uint8_t)(((uint32_t)zxIf1Select << 1u) | in), now);
      }
      return;
    }
    default:
      zxIf1NetOut = (uint8_t)(value & 0x01u);
      return;
  }
}

// -----------------------------------------------------------------------------
// Frozen CPU: WAIT held past the frame's end, or for good

#define zxIf1Frozen() ZXIF1_UNLIKELY(zxIf1Freeze != 0u)

/* The tact the frozen CPU wakes at, no later than `limit`; clears the freeze when it is reached */
static uint32_t zxIf1FrozenTarget(uint32_t limit) {
  if (zxIf1Freeze == 1u && (int32_t)(zxIf1FreezeUntil - limit) <= 0) {
    zxIf1Freeze = 0u;
    return zxIf1FreezeUntil;
  }
  return limit;
}

/*
 * The machine's reset: the interface pages out and every motor stops. The core has set its tact
 * counter already, so the drives restart from where they are, not from tacts that no longer exist.
 */
static void zxIf1Reset(void) {
  const uint32_t now = ZXIF1_NOW();
  zxIf1Writing = 0u;
  zxIf1Select = 0u;
  zxIf1Control = 0xffu;
  zxIf1NetOut = 1u;
  zxIf1EraseChain = 0u;
  zxIf1LastWriteKind = 0u;
  zxIf1Freeze = 0u;
  zxIf1FreezeUntil = 0u;
  if (zxIf1Paged != 0u) {
    zxIf1Paged = 0u;
    zxIf1Remap();
  }
  for (uint32_t d = 0u; d < ZXIF1_DRIVES; d++) {
    ZxIf1Drive *drive = &zxIf1Drives[d];
    drive->motorOn = 0u;
    drive->stoppedOffset = 0u;
    drive->dataIndex = 0u;
    drive->segmentStart = now;
    drive->advancedTo = now;
  }
}

static void zxIf1ShiftTactOrigin(uint32_t by) {
  zxIf1WriteStart -= by;
  zxIf1FreezeUntil -= by;
  for (uint32_t d = 0u; d < ZXIF1_DRIVES; d++) {
    zxIf1Drives[d].segmentStart -= by;
    zxIf1Drives[d].advancedTo -= by;
  }
}

/* Scans a slot's blocks for signal, as the ROM would see them: a valid flag and checksum */
static uint8_t zxIf1ChecksumOk(const uint8_t *bytes, uint32_t length, uint8_t expected) {
  uint32_t sum = 0u;
  for (uint32_t i = 0u; i < length; i++) sum = (sum + bytes[i]) % 255u;
  return sum == expected ? 1u : 0u;
}

static void zxIf1ScanSlot(uint32_t d, uint32_t slot) {
  const uint8_t *s = &zxIf1Image[d][slot * ZXIF1_SLOT_SIZE];
  uint8_t signal = 0u;
  if ((s[0] & 0x01u) != 0u && zxIf1ChecksumOk(s, 14u, s[14]) != 0u) signal |= 0x01u;
  const uint8_t *r = s + ZXIF1_HEADER_SIZE;
  if ((r[0] & 0x01u) == 0u && zxIf1ChecksumOk(r, 14u, r[14]) != 0u) signal |= 0x02u;
  zxIf1Signal[d][slot] = signal;
  zxIf1RecordLength[d][slot] = ZXIF1_RECORD_SIZE;
  for (uint32_t i = 0u; i < ZXIF1_TAIL_SIZE; i++) zxIf1Tail[d][slot][i] = 0xffu;
}

// -----------------------------------------------------------------------------
// Exports: the host connects the interface, uploads its ROM, inserts and ejects cartridges and
// collects what the guest wrote

/* 1 connects the Interface 1 (the host resets the machine after it) */
void ZXIF1(If1SetPresent)(uint32_t present) {
  zxIf1Present = present != 0u ? 1u : 0u;
  zxIf1Reset();
}
uint32_t ZXIF1(If1GetPresent)(void) { return zxIf1Present; }
/* The 8K ROM: the host writes it here, then calls If1RomUploaded */
uint32_t ZXIF1(If1RomPtr)(void) { return (uint32_t)(uintptr_t)zxIf1Rom; }
void ZXIF1(If1RomUploaded)(void) {
  zxIf1BuildView();
  if (zxIf1Paged != 0u) zxIf1Remap();
}
uint32_t ZXIF1(If1GetPaged)(void) { return zxIf1Paged; }
/* A snapshot's paging: 1 pages the ROM in */
void ZXIF1(If1SetPaged)(uint32_t paged) {
  const uint8_t next = paged != 0u && zxIf1Present != 0u ? 1u : 0u;
  if (next == zxIf1Paged) return;
  zxIf1Paged = next;
  zxIf1Remap();
}
uint32_t ZXIF1(If1GetControl)(void) { return zxIf1Control; }
/* The drives selected (their motors run): bit n is drive n + 1. The host runs a fast Microdrive while nonzero */
uint32_t ZXIF1(If1GetSelect)(void) { return zxIf1Select; }
uint32_t ZXIF1(If1GetFrozen)(void) { return zxIf1Freeze; }
uint32_t ZXIF1(If1GetDriveCount)(void) { return ZXIF1_DRIVES; }
uint32_t ZXIF1(If1GetMaxSlots)(void) { return ZXIF1_MAX_SLOTS; }

/* Drive d's slots, as an .mdr holds them (254 x 543 bytes): the host writes a cartridge here */
uint32_t ZXIF1(If1DriveImagePtr)(uint32_t d) { return d < ZXIF1_DRIVES ? (uint32_t)(uintptr_t)zxIf1Image[d] : 0u; }

/* Inserts the cartridge the host wrote to drive d's image: `slots` sectors (1-254) */
void ZXIF1(If1Insert)(uint32_t d, uint32_t slots, uint32_t writeProtected) {
  if (d >= ZXIF1_DRIVES) return;
  if (zxIf1Writing != 0u && zxIf1WriteDrive == d) zxIf1Writing = 0u;
  ZxIf1Drive *drive = &zxIf1Drives[d];
  const uint32_t n = slots == 0u ? 1u : slots > ZXIF1_MAX_SLOTS ? ZXIF1_MAX_SLOTS : slots;
  drive->inserted = 1u;
  drive->slots = (uint16_t)n;
  drive->writeProtected = writeProtected != 0u ? 1u : 0u;
  drive->slot = 0u;
  drive->segment = ZXIF1_SEG_GAP_A;
  drive->dataIndex = 0u;
  drive->stoppedOffset = 0u;
  drive->segmentStart = ZXIF1_NOW();
  drive->advancedTo = ZXIF1_NOW();
  for (uint32_t slot = 0u; slot < ZXIF1_MAX_SLOTS; slot++) {
    if (slot < n) zxIf1ScanSlot(d, slot);
    else zxIf1Signal[d][slot] = 0u;
    zxIf1Dirty[d][slot] = 0u;
  }
}

void ZXIF1(If1Eject)(uint32_t d) {
  if (d >= ZXIF1_DRIVES) return;
  if (zxIf1Writing != 0u && zxIf1WriteDrive == d) zxIf1Writing = 0u;
  zxIf1Drives[d].inserted = 0u;
  zxIf1Drives[d].slots = 0u;
  for (uint32_t slot = 0u; slot < ZXIF1_MAX_SLOTS; slot++) {
    zxIf1Signal[d][slot] = 0u;
    zxIf1Dirty[d][slot] = 0u;
  }
}

void ZXIF1(If1SetWriteProtected)(uint32_t d, uint32_t writeProtected) {
  if (d < ZXIF1_DRIVES) zxIf1Drives[d].writeProtected = writeProtected != 0u ? 1u : 0u;
}

/*
 * Drive d's state, one field per call: 0 inserted, 1 slots, 2 write-protected, 3 motor on,
 * 4 the head's slot, 5 its segment, 6 the data bytes handed out of the segment, 7 the segment's
 * start (internal tacts), 8 the tact the head was last brought to, 9 the head slot's record length,
 * 10 its signal bits
 */
uint32_t ZXIF1(If1GetDriveInfo)(uint32_t d, uint32_t field) {
  if (d >= ZXIF1_DRIVES) return 0u;
  const ZxIf1Drive *drive = &zxIf1Drives[d];
  switch (field) {
    case 0u: return drive->inserted;
    case 1u: return drive->slots;
    case 2u: return drive->writeProtected;
    case 3u: return drive->motorOn;
    case 4u: return drive->slot;
    case 5u: return drive->segment;
    case 6u: return drive->dataIndex;
    case 7u: return drive->segmentStart;
    case 8u: return drive->advancedTo;
    case 9u: return drive->slot < ZXIF1_MAX_SLOTS ? zxIf1RecordLength[d][drive->slot] : 0u;
    case 10u: return drive->slot < ZXIF1_MAX_SLOTS ? zxIf1Signal[d][drive->slot] : 0u;
    default: return 0u;
  }
}

/* Changes since the host last collected them: a revision, then per slot */
uint32_t ZXIF1(If1GetDirtyRevision)(void) { return zxIf1DirtyRevision; }
uint32_t ZXIF1(If1GetSlotDirty)(uint32_t d, uint32_t slot) {
  return d < ZXIF1_DRIVES && slot < ZXIF1_MAX_SLOTS ? zxIf1Dirty[d][slot] : 0u;
}
void ZXIF1(If1ClearDirty)(uint32_t d) {
  if (d >= ZXIF1_DRIVES) return;
  for (uint32_t slot = 0u; slot < ZXIF1_MAX_SLOTS; slot++) zxIf1Dirty[d][slot] = 0u;
}
/* Per slot: bit 0 the header has signal, bit 1 the record has */
uint32_t ZXIF1(If1GetSlotSignal)(uint32_t d, uint32_t slot) {
  return d < ZXIF1_DRIVES && slot < ZXIF1_MAX_SLOTS ? zxIf1Signal[d][slot] : 0u;
}

#undef ZXIF1_NOINLINE
#undef ZXIF1
#undef ZXIF1_PASTE
#undef ZXIF1_PASTE2
