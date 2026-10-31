/*
 * The EXDOS floppy interface card (`.plans/ENTERPRISE_PLAN.md` §10): a WD1770 on the shared
 * controller (`wd1793.c` with `WD1793_VARIANT 1770`), the card's control register, and the EXDOS 1.3
 * ROM in segments 20h-21h (`epConfigure`'s EP_ROM_EXDOS; ep-memory.c maps it). The interface facts are
 * the research pack's (DAVE_MEMORY_IO.md §9.2, STORAGE_FIRMWARE_SOFTWARE.md §5.1); the code is Klive's
 * own.
 *
 * I/O, with the card fitted (8-bit decode, like every Enterprise port):
 *   10-13  the WD1770: status/command, track, sector, data; mirrored at 14-17 (A2 is not decoded)
 *   18-1F  the control register, one register (A2-A0 not decoded: the pack's OQ4, CLK's decode)
 *          write: bits 0-3 select drive 0-3 (the lowest set bit wins; none: no drive), bit 4 the side,
 *                 bit 5 /DDEN (Klive models MFM only), bit 6 1 clears the selected drive's disk-change
 *                 flag, bit 7 the "in use" LED
 *          read:  bit 7 the controller's DRQ, bit 6 the disk-change line, inverted: 1 = no change since
 *                 the last clear (MAME's and ep128emu's polarity; CLK reads it the other way), bit 1
 *                 the controller's INTRQ; the others 0 (ep128emu's "not ready" in bit 0 is not given:
 *                 MAME leaves it out and EXDOS runs there)
 * Without the card, these ports read FFh like every other undecoded port.
 *
 * The controller runs from the card's 8 MHz clock: MFM at 250 kbit/s for a 3.5" double-density
 * drive at 300 rpm, the shared controller's rate. Its time is the machine's 8 MHz half-T clock
 * (`epHalfClock`), not the CPU's T-states, which NICK stretches.
 *
 * Disks: two drives (A, B) of 82 cylinders, two sides, nine 512-byte sectors a track (the 720K
 * format, and its 40-cylinder and single-sided relatives); the host converts a raw image to the
 * canonical layout (`EpDiskImage.ts`).
 */

static uint8_t epExdosControl;
/* Per drive: 1 when a disk went in or out since the guest last cleared the flag */
static uint8_t epExdosChanged[4];

/* The drive the control register selects: the lowest of bits 0-3 set, 4 for none */
static inline uint32_t epExdosDriveIndex(void) {
  const uint8_t select = epExdosControl & 0x0fu;
  if (select & 0x01u) return 0u;
  if (select & 0x02u) return 1u;
  if (select & 0x04u) return 2u;
  if (select & 0x08u) return 3u;
  return 4u;
}

#define WD1793_VARIANT 1770
#define WD1793_PREFIX epFdc
#define WD1793_NOW() epHalfClock
/* The half-T clock runs at 8 MHz */
#define WD1793_TACTS_PER_MS (2u * EP_CLOCK / 1000u)
#define WD1793_DRIVE_COUNT 2u
#define WD1793_MAX_CYLINDERS 82u
#define WD1793_SECTORS 9u
#define WD1793_SECTOR_SIZE 512u
#define WD1793_SECTOR_N 0x02u
/* 100 + 9 x 680 = 6220 bytes of the 6250 a revolution holds */
#define WD1793_SLOT_PITCH 680u
#define WD1793_DRIVE_INDEX() epExdosDriveIndex()
#define WD1793_SIDE() ((epExdosControl & 0x10u) != 0u ? 1u : 0u)
/* The card does not drive the controller's master reset; the machine's reset resets it (below) */
#define WD1793_MR_INACTIVE() 1u
#include "../../../common/wasm/wd1793.c"

/* Whether the card is fitted: its ROM is in the map */
static inline uint8_t epExdosPresent(void) { return (epRomMask & EP_ROM_EXDOS) != 0u ? 1u : 0u; }

/* A machine reset (the bus's RESET line): the control register, the controller and the head positions */
static void epExdosReset(void) {
  epExdosControl = 0u;
  epFdcTrack = 0u;
  epFdcDataReg = 0u;
  epFdcStepIn = 0u;
  epFdcResetController();
  epFdcRotationOrigin = epHalfClock;
  epFdcIdleSince = epFdcRotationOrigin;
  epFdcSpinUpAt = epFdcRotationOrigin;
  epFdcIndexMark = 0u;
}

static uint8_t epExdosReadPort(uint8_t port) {
  if ((port & 0x08u) != 0u) {
    epFdcAdvance();
    const uint32_t drive = epExdosDriveIndex();
    const uint8_t changed = drive < 4u ? epExdosChanged[drive] : 0u;
    return (uint8_t)((epFdcDrq != 0u ? 0x80u : 0u) | (changed != 0u ? 0u : 0x40u) | (epFdcIntrq != 0u ? 0x02u : 0u));
  }
  switch (port & 0x03u) {
    case 0u: {
      const uint8_t status = epFdcReadStatus();
      /* Reading the status resets INTRQ ([DS]) */
      epFdcIntrq = 0u;
      return status;
    }
    case 1u:
      return epFdcTrack;
    case 2u:
      return epFdcSector;
    default:
      epFdcAdvance();
      /* Reading the data register resets DRQ ([DS]) */
      epFdcDrq = 0u;
      return epFdcDataReg;
  }
}

static void epExdosWritePort(uint8_t port, uint8_t value) {
  epFdcAdvance();
  if ((port & 0x08u) != 0u) {
    epExdosControl = value;
    const uint32_t drive = epExdosDriveIndex();
    if ((value & 0x40u) != 0u && drive < 4u) epExdosChanged[drive] = 0u;
    return;
  }
  switch (port & 0x03u) {
    case 0u:
      epFdcStartCommand(value);
      return;
    case 1u:
      if (epFdcBusy == 0u) epFdcTrack = value;
      return;
    case 2u:
      if (epFdcBusy == 0u) epFdcSector = value;
      return;
    default:
      epFdcDataReg = value;
      /* Writing the data register resets DRQ ([DS]) */
      epFdcDrq = 0u;
      return;
  }
}

/* ------------------------------------------------------------------------------------------- */
/* Exports, for the host, the debugger and the tests */

uint32_t epExdosGetPresent(void) { return epExdosPresent(); }
uint32_t epExdosGetControl(void) { return epExdosControl; }
/* The controller's registers and lines as they are (the pending events are not played) */
uint32_t epExdosGetFdcCommand(void) { return epFdcCommand; }
uint32_t epExdosGetFdcTrack(void) { return epFdcTrack; }
uint32_t epExdosGetFdcSector(void) { return epFdcSector; }
uint32_t epExdosGetFdcData(void) { return epFdcDataReg; }
uint32_t epExdosGetFdcBusy(void) { return epFdcBusy; }
uint32_t epExdosGetMotorOn(void) { return epFdcMotorOn; }
uint32_t epExdosGetDriveCylinder(uint32_t drive) {
  return drive < WD1793_DRIVE_COUNT ? epFdcDrives[drive].cylinder : 0u;
}
uint32_t epExdosGetDiskChanged(uint32_t drive) { return drive < 4u ? epExdosChanged[drive] : 0u; }

/* Disks: the host writes the canonical image through the pointer, then inserts it */
uint32_t epExdosDiskDataPtr(uint32_t drive) {
  return (uint32_t)(uintptr_t)epFdcData[drive < WD1793_DRIVE_COUNT ? drive : 0u];
}
uint32_t epExdosDiskGetCapacity(void) { return WD1793_DRIVE_CAPACITY; }
void epExdosDiskInsert(uint32_t drive, uint32_t cylinders, uint32_t sides, uint32_t writeProtected) {
  if (drive >= WD1793_DRIVE_COUNT) return;
  epFdcInsertDisk(drive, cylinders, sides, writeProtected);
  epExdosChanged[drive] = 1u;
}
void epExdosDiskEject(uint32_t drive) {
  if (drive >= WD1793_DRIVE_COUNT) return;
  if (epFdcDrives[drive].present != 0u) epExdosChanged[drive] = 1u;
  epFdcEjectDisk(drive);
}
void epExdosDiskSetWriteProtected(uint32_t drive, uint32_t value) {
  if (drive < WD1793_DRIVE_COUNT) epFdcDrives[drive].writeProtected = value != 0u ? 1u : 0u;
}
uint32_t epExdosGetDiskPresent(uint32_t drive) {
  return drive < WD1793_DRIVE_COUNT ? epFdcDrives[drive].present : 0u;
}
uint32_t epExdosGetDiskCylinders(uint32_t drive) {
  return drive < WD1793_DRIVE_COUNT ? epFdcDrives[drive].cylinders : 0u;
}
uint32_t epExdosGetDiskSides(uint32_t drive) {
  return drive < WD1793_DRIVE_COUNT ? epFdcDrives[drive].sides : 0u;
}

/* Written sectors: a revision that changes on every write, and a bit per canonical sector */
uint32_t epExdosGetDirtyRevision(void) { return epFdcDirtyRevision; }
uint32_t epExdosGetSectorCount(void) { return WD1793_SECTOR_COUNT; }
uint32_t epExdosGetSectorDirty(uint32_t drive, uint32_t index) {
  if (drive >= WD1793_DRIVE_COUNT || index >= WD1793_SECTOR_COUNT) return 0u;
  return (epFdcDirty[drive][index >> 5u] >> (index & 31u)) & 1u;
}
void epExdosClearDirty(uint32_t drive) {
  if (drive >= WD1793_DRIVE_COUNT) return;
  for (uint32_t i = 0u; i < WD1793_DIRTY_WORDS; i++) epFdcDirty[drive][i] = 0u;
}
