/*
 * The SAM Coupé's disk drives (plan §10; STORAGE_FIRMWARE_SOFTWARE.md §4.1): one VL1772-02 (a WD1772)
 * per drive, each the shared controller (`../../../common/wasm/wd1793.c`) with `WD1793_VARIANT 1772`,
 * included twice with the prefixes `samFdc1` and `samFdc2`.
 *
 *   E0h-E7h  drive 1, F0h-F7h  drive 2 (only the low byte decodes): A1-A0 the register (status/command,
 *            track, sector, data), A2 the side line (0 side 1, 1 side 2), set on every access
 *
 * No drive-select or motor latch: the port range chooses the controller, and the 1772 drives the motor.
 * INTRQ and DRQ are polled (no interrupt line). The controllers run from the board's 8 MHz, MFM at
 * 250 kbit/s; their time is the CPU's T-states (6 MHz). The ASIC does not pass reset to them
 * (ASIC §7 item 7): the reset button leaves them alone.
 *
 * Disks: 80 (up to 82) cylinders, two sides, ten 512-byte sectors a track (the 800K MGT format), in the
 * controller's canonical layout, which is the MGT image's own (cylinder-major, the heads interleaved).
 * `MC_SAM_DRIVES` fits 0, 1 or 2 drives; ports of a missing drive read FFh.
 */

/* The fitted drives (`samConfigure`) and each controller's side line */
static uint8_t samDrives = 1u;
static uint8_t samFdcSide[2];

#define WD1793_VARIANT 1772
#define WD1793_NOW() cpu.tacts
#define WD1793_TACTS_PER_MS (SAM_CLOCK / 1000u)
#define WD1793_DRIVE_COUNT 1u
#define WD1793_MAX_CYLINDERS 82u
#define WD1793_SECTORS 10u
#define WD1793_SECTOR_SIZE 512u
#define WD1793_SECTOR_N 0x02u
/* 100 + 10 x 610 = 6200 bytes of the 6250 a revolution holds */
#define WD1793_SLOT_PITCH 610u
#define WD1793_MR_INACTIVE() 1u

#define WD1793_PREFIX samFdc1
#define WD1793_DRIVE_INDEX() (samDrives >= 1u ? 0u : 1u)
#define WD1793_SIDE() samFdcSide[0]
#include "../../../common/wasm/wd1793.c"
#undef WD1793_PREFIX
#undef WD1793_DRIVE_INDEX
#undef WD1793_SIDE

#define WD1793_PREFIX samFdc2
#define WD1793_DRIVE_INDEX() (samDrives >= 2u ? 0u : 1u)
#define WD1793_SIDE() samFdcSide[1]
#include "../../../common/wasm/wd1793.c"

static inline uint8_t samFdcPresent(uint32_t drive) { return samDrives > drive ? 1u : 0u; }

/* One controller's port access: the same code for both through these macros */
#define SAM_FDC_READ(P)                                         \
  switch (port & 3u) {                                          \
    case 0u: {                                                  \
      const uint8_t status = P##ReadStatus();                   \
      P##Intrq = 0u;                                            \
      return status;                                            \
    }                                                           \
    case 1u:                                                    \
      return P##Track;                                          \
    case 2u:                                                    \
      return P##Sector;                                         \
    default:                                                    \
      P##Advance();                                             \
      P##Drq = 0u;                                              \
      return P##DataReg;                                        \
  }

#define SAM_FDC_WRITE(P)                                        \
  P##Advance();                                                 \
  switch (port & 3u) {                                          \
    case 0u:                                                    \
      P##StartCommand(value);                                   \
      return;                                                   \
    case 1u:                                                    \
      if (P##Busy == 0u) P##Track = value;                      \
      return;                                                   \
    case 2u:                                                    \
      if (P##Busy == 0u) P##Sector = value;                     \
      return;                                                   \
    default:                                                    \
      P##DataReg = value;                                       \
      P##Drq = 0u;                                              \
      return;                                                   \
  }

static uint8_t samFdcRead(uint8_t port) {
  const uint32_t drive = (port & 0x10u) ? 1u : 0u;
  if (!samFdcPresent(drive)) return 0xffu;
  samFdcSide[drive] = (port & 0x04u) ? 1u : 0u;
  if (drive == 0u) {
    SAM_FDC_READ(samFdc1)
  } else {
    SAM_FDC_READ(samFdc2)
  }
}

static void samFdcWrite(uint8_t port, uint8_t value) {
  const uint32_t drive = (port & 0x10u) ? 1u : 0u;
  if (!samFdcPresent(drive)) return;
  samFdcSide[drive] = (port & 0x04u) ? 1u : 0u;
  if (drive == 0u) {
    SAM_FDC_WRITE(samFdc1)
  } else {
    SAM_FDC_WRITE(samFdc2)
  }
}

#define SAM_FDC_POWER_ON(P)                    \
  P##Track = 0u;                               \
  P##DataReg = 0u;                             \
  P##StepIn = 0u;                              \
  P##ResetController();                        \
  P##RotationOrigin = cpu.tacts;               \
  P##IdleSince = P##RotationOrigin;            \
  P##SpinUpAt = P##RotationOrigin;             \
  P##IndexMark = 0u;

/* Power on only: the reset button does not reach the controllers */
static void samFdcPowerOn(void) {
  samFdcSide[0] = 0u;
  samFdcSide[1] = 0u;
  SAM_FDC_POWER_ON(samFdc1)
  SAM_FDC_POWER_ON(samFdc2)
}

/* ------------------------------------------------------------------------------------------- */
/* Exports, for the host, the debugger and the tests (`drive` 0 or 1) */

#define SAM_FDC_PICK(drive, name) ((drive) == 0u ? samFdc1##name : samFdc2##name)
#define SAM_FDC_DRIVE(drive, field) ((drive) == 0u ? samFdc1Drives[0].field : samFdc2Drives[0].field)

uint32_t samFdcGetCommand(uint32_t drive) { return SAM_FDC_PICK(drive, Command); }
uint32_t samFdcGetTrack(uint32_t drive) { return SAM_FDC_PICK(drive, Track); }
uint32_t samFdcGetSector(uint32_t drive) { return SAM_FDC_PICK(drive, Sector); }
uint32_t samFdcGetData(uint32_t drive) { return SAM_FDC_PICK(drive, DataReg); }
uint32_t samFdcGetBusy(uint32_t drive) { return SAM_FDC_PICK(drive, Busy); }
uint32_t samFdcGetMotorOn(uint32_t drive) { return SAM_FDC_PICK(drive, MotorOn); }
uint32_t samFdcGetSide(uint32_t drive) { return samFdcSide[drive & 1u]; }
uint32_t samFdcGetCylinder(uint32_t drive) { return SAM_FDC_DRIVE(drive, cylinder); }
uint32_t samDiskDataPtr(uint32_t drive) {
  return (uint32_t)(uintptr_t)(drive == 0u ? samFdc1Data[0] : samFdc2Data[0]);
}
uint32_t samDiskGetCapacity(void) { return WD1793_DRIVE_CAPACITY; }
void samDiskInsert(uint32_t drive, uint32_t cylinders, uint32_t sides, uint32_t writeProtected) {
  if (drive == 0u) samFdc1InsertDisk(0u, cylinders, sides, writeProtected);
  else samFdc2InsertDisk(0u, cylinders, sides, writeProtected);
}
void samDiskEject(uint32_t drive) {
  if (drive == 0u) samFdc1EjectDisk(0u);
  else samFdc2EjectDisk(0u);
}
void samDiskSetWriteProtected(uint32_t drive, uint32_t value) {
  if (drive == 0u) samFdc1Drives[0].writeProtected = value != 0u ? 1u : 0u;
  else samFdc2Drives[0].writeProtected = value != 0u ? 1u : 0u;
}
uint32_t samDiskGetPresent(uint32_t drive) { return SAM_FDC_DRIVE(drive, present); }
uint32_t samDiskGetCylinders(uint32_t drive) { return SAM_FDC_DRIVE(drive, cylinders); }
uint32_t samDiskGetDirtyRevision(uint32_t drive) { return SAM_FDC_PICK(drive, DirtyRevision); }
uint32_t samDiskGetSectorCount(void) { return WD1793_SECTOR_COUNT; }
uint32_t samDiskGetSectorDirty(uint32_t drive, uint32_t index) {
  if (index >= WD1793_SECTOR_COUNT) return 0u;
  const uint32_t word = drive == 0u ? samFdc1Dirty[0][index >> 5u] : samFdc2Dirty[0][index >> 5u];
  return (word >> (index & 31u)) & 1u;
}
void samDiskClearDirty(uint32_t drive) {
  for (uint32_t i = 0u; i < WD1793_DIRTY_WORDS; i++) {
    if (drive == 0u) samFdc1Dirty[0][i] = 0u;
    else samFdc2Dirty[0][i] = 0u;
  }
}
