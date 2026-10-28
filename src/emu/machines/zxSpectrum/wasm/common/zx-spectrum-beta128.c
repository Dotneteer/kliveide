// ----------------------------------------------------------------------------
// Beta 128 disk interface: a WD1793 floppy disk controller, the interface's system register and two
// drives (`.plans/BETA128_TRDOS_PLAN.md`; every fact used here is listed with its source in §9 of
// that plan: the FD179X data sheet [DS] and the Beta 128 documentation [BK]).
//
// The includer defines, before including this file:
//   BETA128_NOW()          the CPU's tact counter now
//   BETA128_TACTS_PER_MS   T-states per millisecond of real time (clock x multiplier / 1000)
//
// The controller is lazy. The Beta 128 does not wire INTRQ to the Z80, so nothing outside the
// interface's ports can observe the controller between two accesses. Every port access first plays
// the events that fell due since the last one, in order (`beta128Advance`), so DRQ, Lost Data, the
// index pulse and INTRQ read exactly as a running controller would have left them.
//
// The disks are held in a canonical layout: cylinder-major, two sides, sixteen 256-byte sectors
// (IDs 1-16) a track: byte ((cylinder * 2 + side) * 16 + sector - 1) * 256. The TypeScript side
// converts `.trd` / `.scl` files to and from it.
// ----------------------------------------------------------------------------


/* The geometry of a TR-DOS disk: two drives, up to 86 cylinders, sixteen 256-byte sectors a track */
#define WD1793_PREFIX beta128
#define WD1793_DRIVE_COUNT 2u
#define WD1793_MAX_CYLINDERS 86u
#define WD1793_SECTORS 16u
#define WD1793_SECTOR_SIZE 256u
#define WD1793_SECTOR_N 0x01u
#define WD1793_SLOT_PITCH 384u
#define WD1793_NOW() BETA128_NOW()
#define WD1793_TACTS_PER_MS BETA128_TACTS_PER_MS

/* System register (port $FF on write; [BK]) */
#define BETA128_SYS_DRIVE 0x03u
#define BETA128_SYS_RESET 0x04u
#define BETA128_SYS_HLT 0x08u
#define BETA128_SYS_SIDE 0x10u
#define BETA128_SYS_MFM 0x40u
/*
 * Which value of the side bit selects side 1 ([BK] reads as "0 = the first head"). Confirmed with
 * TR-DOS 5.03 (`test/sp128-hw/beta128/trdos.test.ts`, KLIVE_TRDOS_ROM): it selects side 0 with the bit
 * set ($3C) and loads a file from logical track 1 - cylinder 0, side 1 - with it clear ($2C).
 */
#define BETA128_SIDE1_WHEN_BIT_CLEAR 1u

/* The interface */
static uint8_t beta128Enabled;
static uint8_t beta128Paged;
static uint8_t beta128SysReg;

/* What the controller reads of the system register */
#define WD1793_DRIVE_INDEX() (beta128SysReg & BETA128_SYS_DRIVE)
#define WD1793_SIDE() \
  (BETA128_SIDE1_WHEN_BIT_CLEAR != 0u ? (((beta128SysReg & BETA128_SYS_SIDE) != 0u ? 1u : 0u) ^ 1u) \
                                      : ((beta128SysReg & BETA128_SYS_SIDE) != 0u ? 1u : 0u))
#define WD1793_MR_INACTIVE() (beta128SysReg & BETA128_SYS_RESET)
#define WD1793_HLT() (beta128SysReg & BETA128_SYS_HLT)

#include "../../../common/wasm/wd1793.c"

/* The names the 128K core (`sp128.c`) reads the disks by */
#define BETA128_DRIVE_COUNT WD1793_DRIVE_COUNT
#define BETA128_MAX_CYLINDERS WD1793_MAX_CYLINDERS
#define BETA128_SECTORS WD1793_SECTORS
#define BETA128_SECTOR_SIZE WD1793_SECTOR_SIZE
#define BETA128_TRACK_SIZE WD1793_TRACK_SIZE
#define BETA128_DRIVE_CAPACITY WD1793_DRIVE_CAPACITY
#define BETA128_SECTOR_COUNT WD1793_SECTOR_COUNT
#define BETA128_DIRTY_WORDS WD1793_DIRTY_WORDS

/* ------------------------------------------------------------------------------------------- */
/* The interface */

/* A machine reset: the interface, the controller and the head positions; the disks stay */
static void beta128Reset(void) {
  beta128Paged = 0u;
  beta128SysReg = 0u;
  beta128Track = 0u;
  beta128DataReg = 0u;
  beta128StepIn = 0u;
  beta128ResetController();
  beta128RotationOrigin = BETA128_NOW();
  beta128IdleSince = beta128RotationOrigin;
  beta128IndexMark = 0u;
}

/* Is this one of the interface's ports? Decoded on A0-A4 high: A7 picks the system register */
static inline uint8_t beta128IsPort(uint32_t address) {
  return (address & 0x1fu) == 0x1fu;
}

static uint32_t beta128ReadPort(uint32_t address) {
  if ((address & 0x80u) != 0u) {
    beta128Advance();
    /* System register on read: INTRQ (bit 7) and DRQ (bit 6) ([BK]) */
    return (beta128Intrq != 0u ? 0x80u : 0u) | (beta128Drq != 0u ? 0x40u : 0u) | 0x3fu;
  }
  switch ((address >> 5u) & 0x03u) {
    case 0u: {
      const uint8_t status = beta128ReadStatus();
      /* Reading the status resets INTRQ ([DS]) */
      beta128Intrq = 0u;
      return status;
    }
    case 1u:
      return beta128Track;
    case 2u:
      return beta128Sector;
    default:
      beta128Advance();
      /* Reading the data register resets DRQ ([DS]) */
      beta128Drq = 0u;
      return beta128DataReg;
  }
}

static void beta128WritePort(uint32_t address, uint32_t value) {
  const uint8_t byteValue = (uint8_t)value;
  if ((address & 0x80u) != 0u) {
    beta128Advance();
    const uint8_t old = beta128SysReg;
    beta128SysReg = byteValue;
    if ((byteValue & BETA128_SYS_RESET) == 0u) {
      /* Master reset held low */
      beta128ResetController();
    } else if ((old & BETA128_SYS_RESET) == 0u) {
      /* Leaving reset runs a Restore ([DS] "the Restore command is executed when MR goes from an
         active to an inactive state") */
      beta128StartCommand(0x03u);
    }
    return;
  }
  switch ((address >> 5u) & 0x03u) {
    case 0u:
      beta128Advance();
      beta128StartCommand(byteValue);
      return;
    case 1u:
      beta128Advance();
      if (beta128Busy == 0u) beta128Track = byteValue;
      return;
    case 2u:
      beta128Advance();
      if (beta128Busy == 0u) beta128Sector = byteValue;
      return;
    default:
      beta128Advance();
      beta128DataReg = byteValue;
      /* Writing the data register resets DRQ ([DS]) */
      beta128Drq = 0u;
      return;
  }
}

