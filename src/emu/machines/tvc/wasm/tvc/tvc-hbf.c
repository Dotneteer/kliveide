/*
 * The HBF floppy interface card (`.plans/VIDEOTON_TVC_PLAN.md` §9.4), in expansion slot 0. The
 * interface facts are MAME's `bus/tvc/hbf.cpp` (BSD-3-Clause, read for facts only) and rtvc's
 * `hbf.rs` / `info/vt-dos.md` (MIT); the code is Klive's own, on the shared WD1793 (`wd1793.c`).
 *
 * Memory, in the EXT page's card window while port 03h bits 7-6 select slot 0:
 *   C000-CFFF  one 4K page of the card's 16K ROM (VT-DOS), chosen by port 18h bits 5-4
 *   D000-DFFF  the card's 4K RAM
 *
 * I/O, slot 0's ports 10h-1Fh; A3-A2 pick a group, A1-A0 a register within it:
 *   10-13      the WD1793: status/command, track, sector, data
 *   14-17      read: bit 7 DRQ, bit 0 INTRQ; write: the drive register - bits 0-1 select drive 0 or 1
 *              (bit 1 wins), bit 5 the density (Klive models MFM only), bit 6 the motor (active low),
 *              bit 7 the side
 *   18-1B      write: bits 5-4 the ROM page
 * The card's type code in port 5Ah is 2 (slot 0's two bits). The controller runs on a 1 MHz clock (a
 * 16 MHz crystal / 16): MFM at 250 kbit/s, the Beta 128's rate, so the shared controller's timing holds.
 *
 * Disks: two drives of 80 cylinders, two sides, nine 512-byte sectors a track (720K, the VT-DOS
 * format); a raw `.dsk` is the canonical layout as it is.
 */

/* The card's state (tvcHbfPresent, tvcHbfRomPage, tvcHbfDriveReg) is in tvc.c: the mapper reads it */

/* The drive the drive register selects: bit 1 is drive 1, bit 0 drive 0, neither none (2) */
static inline uint32_t tvcHbfDriveIndex(void) {
  return (tvcHbfDriveReg & 0x02u) != 0u ? 1u : (tvcHbfDriveReg & 0x01u) != 0u ? 0u : 2u;
}

#define WD1793_PREFIX tvcFdc
#define WD1793_NOW() cpu.tacts
#define WD1793_TACTS_PER_MS (TVC_CLOCK / 1000u)
#define WD1793_DRIVE_COUNT 2u
#define WD1793_MAX_CYLINDERS 82u
#define WD1793_SECTORS 9u
#define WD1793_SECTOR_SIZE 512u
#define WD1793_SECTOR_N 0x02u
/* 100 + 9 x 680 = 6220 bytes of the 6250 a revolution holds */
#define WD1793_SLOT_PITCH 680u
#define WD1793_DRIVE_INDEX() tvcHbfDriveIndex()
#define WD1793_SIDE() ((tvcHbfDriveReg & 0x80u) != 0u ? 1u : 0u)
/* The card wires neither the master reset nor the head-load timing input to anything that changes */
#define WD1793_MR_INACTIVE() 1u
#define WD1793_HLT() 1u
#include "../../../common/wasm/wd1793.c"

/* A machine reset: the card's page and drive register, the controller and the head positions */
static void tvcHbfReset(void) {
  tvcHbfRomPage = 0u;
  tvcHbfDriveReg = 0u;
  tvcFdcTrack = 0u;
  tvcFdcDataReg = 0u;
  tvcFdcStepIn = 0u;
  tvcFdcResetController();
  tvcFdcRotationOrigin = cpu.tacts;
  tvcFdcIdleSince = tvcFdcRotationOrigin;
  tvcFdcIndexMark = 0u;
}

static uint8_t tvcHbfReadPort(uint8_t port) {
  switch ((port >> 2) & 0x03u) {
    case 0u:
      switch (port & 0x03u) {
        case 0u: {
          const uint8_t status = tvcFdcReadStatus();
          /* Reading the status resets INTRQ ([DS]) */
          tvcFdcIntrq = 0u;
          return status;
        }
        case 1u:
          return tvcFdcTrack;
        case 2u:
          return tvcFdcSector;
        default:
          tvcFdcAdvance();
          /* Reading the data register resets DRQ ([DS]) */
          tvcFdcDrq = 0u;
          return tvcFdcDataReg;
      }
    case 1u:
      tvcFdcAdvance();
      return (uint8_t)((tvcFdcDrq != 0u ? 0x80u : 0u) | (tvcFdcIntrq != 0u ? 0x01u : 0u));
    default:
      return 0x00u;
  }
}

static void tvcHbfWritePort(uint8_t port, uint8_t value) {
  switch ((port >> 2) & 0x03u) {
    case 0u:
      tvcFdcAdvance();
      switch (port & 0x03u) {
        case 0u:
          tvcFdcStartCommand(value);
          return;
        case 1u:
          if (tvcFdcBusy == 0u) tvcFdcTrack = value;
          return;
        case 2u:
          if (tvcFdcBusy == 0u) tvcFdcSector = value;
          return;
        default:
          tvcFdcDataReg = value;
          /* Writing the data register resets DRQ ([DS]) */
          tvcFdcDrq = 0u;
          return;
      }
    case 1u:
      tvcFdcAdvance();
      tvcHbfDriveReg = value;
      return;
    case 2u:
      tvcHbfRomPage = (uint8_t)((value >> 4) & 0x03u);
      tvcRemap();
      return;
    default:
      return;
  }
}

/* ------------------------------------------------------------------------------------------- */
/* Exports, for the host, the debugger and the tests */

/* 1 plugs the card into slot 0 (the host uploads its ROM first); takes effect at once */
void tvcHbfSetPresent(uint32_t present) {
  tvcHbfPresent = present != 0u ? 1u : 0u;
  tvcRemap();
}
uint32_t tvcHbfGetPresent(void) { return tvcHbfPresent; }
uint32_t tvcHbfRomPtr(void) { return (uint32_t)(uintptr_t)&tvcMemory[TVC_HBF_ROM]; }
uint32_t tvcHbfGetRomPage(void) { return tvcHbfRomPage; }
uint32_t tvcHbfGetDriveRegister(void) { return tvcHbfDriveReg; }

/* The controller's registers and lines, read without side effects (INTRQ stays as it was) */
uint32_t tvcHbfGetFdcStatus(void) {
  const uint8_t intrq = tvcFdcIntrq;
  const uint32_t status = tvcFdcReadStatus();
  tvcFdcIntrq = intrq;
  return status;
}
uint32_t tvcHbfGetFdcTrack(void) { return tvcFdcTrack; }
uint32_t tvcHbfGetFdcSector(void) { return tvcFdcSector; }
uint32_t tvcHbfGetFdcData(void) { return tvcFdcDataReg; }
uint32_t tvcHbfGetFdcCommand(void) { return tvcFdcCommand; }
uint32_t tvcHbfGetDriveCylinder(uint32_t drive) {
  return drive < WD1793_DRIVE_COUNT ? tvcFdcDrives[drive].cylinder : 0u;
}

/* Disks: the host writes the canonical image through the pointer, then inserts it */
uint32_t tvcHbfDiskDataPtr(uint32_t drive) {
  return (uint32_t)(uintptr_t)tvcFdcData[drive < WD1793_DRIVE_COUNT ? drive : 0u];
}
uint32_t tvcHbfDiskGetCapacity(void) { return WD1793_DRIVE_CAPACITY; }
void tvcHbfDiskInsert(uint32_t drive, uint32_t cylinders, uint32_t sides, uint32_t writeProtected) {
  tvcFdcInsertDisk(drive, cylinders, sides, writeProtected);
}
void tvcHbfDiskEject(uint32_t drive) { tvcFdcEjectDisk(drive); }
void tvcHbfDiskSetWriteProtected(uint32_t drive, uint32_t value) {
  if (drive < WD1793_DRIVE_COUNT) tvcFdcDrives[drive].writeProtected = value != 0u ? 1u : 0u;
}
uint32_t tvcHbfGetDiskPresent(uint32_t drive) {
  return drive < WD1793_DRIVE_COUNT ? tvcFdcDrives[drive].present : 0u;
}
uint32_t tvcHbfGetDiskCylinders(uint32_t drive) {
  return drive < WD1793_DRIVE_COUNT ? tvcFdcDrives[drive].cylinders : 0u;
}
uint32_t tvcHbfGetDiskSides(uint32_t drive) {
  return drive < WD1793_DRIVE_COUNT ? tvcFdcDrives[drive].sides : 0u;
}

/* Written sectors: a revision that changes on every write, and a bit per canonical sector */
uint32_t tvcHbfGetDirtyRevision(void) { return tvcFdcDirtyRevision; }
uint32_t tvcHbfGetSectorCount(void) { return WD1793_SECTOR_COUNT; }
uint32_t tvcHbfGetSectorDirty(uint32_t drive, uint32_t index) {
  if (drive >= WD1793_DRIVE_COUNT || index >= WD1793_SECTOR_COUNT) return 0u;
  return (tvcFdcDirty[drive][index >> 5u] >> (index & 31u)) & 1u;
}
void tvcHbfClearDirty(uint32_t drive) {
  if (drive >= WD1793_DRIVE_COUNT) return;
  for (uint32_t i = 0u; i < WD1793_DIRTY_WORDS; i++) tvcFdcDirty[drive][i] = 0u;
}
