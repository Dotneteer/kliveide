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

#define BETA128_DRIVE_COUNT 2u
#define BETA128_MAX_CYLINDERS 86u
#define BETA128_SECTORS 16u
#define BETA128_SECTOR_SIZE 256u
#define BETA128_TRACK_SIZE (BETA128_SECTORS * BETA128_SECTOR_SIZE)
#define BETA128_DRIVE_CAPACITY (BETA128_MAX_CYLINDERS * 2u * BETA128_TRACK_SIZE)
#define BETA128_SECTOR_COUNT (BETA128_MAX_CYLINDERS * 2u * BETA128_SECTORS)
#define BETA128_DIRTY_WORDS ((BETA128_SECTOR_COUNT + 31u) / 32u)

/*
 * One revolution in byte times: MFM at 250 kbit/s ([DS]: a 1 MHz clock for 5.25" drives halves the
 * 2 MHz rates) and 300 rpm give 31 250 bytes a second, 6 250 a revolution.
 *
 * The layout of a track (an image holds no physical layout, so this one is Klive's choice, with
 * the standard MFM field sizes): a 100-byte gap after the index, then sixteen sector slots of 384
 * bytes in ID order 1-16. Within a slot: 12 bytes of 00, A1 A1 A1 FE, C H R N, CRC (ID field,
 * bytes 0-21), 22 bytes of 4E, 12 of 00, A1 A1 A1 FB, 256 data bytes and the data CRC (bytes 44-317),
 * then 4E to the next slot.
 */
#define BETA128_TRACK_BYTES 6250u
#define BETA128_FIRST_SLOT 100u
#define BETA128_SLOT_PITCH 384u
#define BETA128_SLOT_ID_C 16u
#define BETA128_SLOT_ID_END 22u
#define BETA128_SLOT_DATA 60u
#define BETA128_SLOT_DATA_END 318u
/* The index hole passes the sensor for 4 ms: 125 byte times (a drive convention, not in [DS]) */
#define BETA128_INDEX_BYTES 125u

/* System register (port $FF on write; [BK]) */
#define BETA128_SYS_DRIVE 0x03u
#define BETA128_SYS_RESET 0x04u
#define BETA128_SYS_HLT 0x08u
#define BETA128_SYS_SIDE 0x10u
#define BETA128_SYS_MFM 0x40u
/*
 * Which value of the side bit selects side 1 ([BK] reads as "0 = the first head"). Kept in this one
 * place; plan §9 lists it as open until TR-DOS reading a file on side 1 decides it.
 */
#define BETA128_SIDE1_WHEN_BIT_CLEAR 1u

/* Controller phases */
#define BETA128_PHASE_IDLE 0u
#define BETA128_PHASE_STEP 1u
#define BETA128_PHASE_VERIFY 2u
#define BETA128_PHASE_DONE 3u
#define BETA128_PHASE_SEARCH 4u
#define BETA128_PHASE_READ_BYTE 5u
#define BETA128_PHASE_SECTOR_END 6u
#define BETA128_PHASE_WRITE_FIRST 7u
#define BETA128_PHASE_WRITE_BYTE 8u
#define BETA128_PHASE_ADDRESS_BYTE 9u
#define BETA128_PHASE_TRACK_BYTE 10u
#define BETA128_PHASE_WRITE_TRACK_START 11u
#define BETA128_PHASE_WRITE_TRACK_BYTE 12u
#define BETA128_PHASE_WRITE_ID 13u

/* Status register bits ([DS] Table 6) */
#define BETA128_ST_BUSY 0x01u
#define BETA128_ST_INDEX_DRQ 0x02u
#define BETA128_ST_TRACK0_LOST 0x04u
#define BETA128_ST_CRC 0x08u
#define BETA128_ST_SEEK_RNF 0x10u
#define BETA128_ST_HEAD_RECTYPE 0x20u
#define BETA128_ST_PROTECTED 0x40u
#define BETA128_ST_NOT_READY 0x80u

typedef struct Beta128Drive {
  uint8_t present;
  uint8_t writeProtected;
  uint8_t cylinders;
  uint8_t sides;
  /* Where the head is (the physical cylinder) */
  uint8_t cylinder;
} Beta128Drive;

static uint8_t beta128Data[BETA128_DRIVE_COUNT][BETA128_DRIVE_CAPACITY];
static uint32_t beta128Dirty[BETA128_DRIVE_COUNT][BETA128_DIRTY_WORDS];
static uint32_t beta128DirtyRevision;
static Beta128Drive beta128Drives[BETA128_DRIVE_COUNT];

/* The interface */
static uint8_t beta128Enabled;
static uint8_t beta128Paged;
static uint8_t beta128SysReg;

/* The controller's registers and lines */
static uint8_t beta128Command;
static uint8_t beta128Track;
static uint8_t beta128Sector;
static uint8_t beta128DataReg;
static uint8_t beta128Busy;
static uint8_t beta128Intrq;
static uint8_t beta128Drq;
/* 1: the status register shows Type I bits; 0: Type II/III bits */
static uint8_t beta128TypeOneStatus;
static uint8_t beta128SeekError;
static uint8_t beta128CrcError;
static uint8_t beta128RecordNotFound;
static uint8_t beta128LostData;
static uint8_t beta128WriteProtectFault;
/* The head-load output (HLD) and the step direction (1 = in, towards higher cylinders) */
static uint8_t beta128HeadLoad;
static uint8_t beta128StepIn;
static uint8_t beta128IntOnIndex;

/* The running command */
static uint8_t beta128Phase;
static uint32_t beta128EventTact;
static uint32_t beta128StepsLeft;
static int32_t beta128SeekTarget;
static uint32_t beta128ByteIndex;
static uint8_t beta128AddressBytes[6];
static uint8_t beta128CurrentSector;
/* Write Track: the address-mark parser */
static uint8_t beta128WtState;
static uint32_t beta128WtCount;
static uint8_t beta128WtId[4];
static uint8_t beta128WtHaveId;

/* Time */
static uint32_t beta128RotationOrigin;
static uint32_t beta128IdleSince;
static uint32_t beta128IndexMark;

static inline uint32_t beta128ByteTacts(void) {
  const uint32_t tacts = (uint32_t)((BETA128_TACTS_PER_MS * 32u) / 1000u);
  return tacts == 0u ? 1u : tacts;
}

static inline uint32_t beta128RevolutionTacts(void) {
  return beta128ByteTacts() * BETA128_TRACK_BYTES;
}

static inline uint32_t beta128MsTacts(uint32_t ms) {
  return (uint32_t)(BETA128_TACTS_PER_MS * ms);
}

/* The byte of the track under the head at a tact */
static inline uint32_t beta128TrackPosition(uint32_t tact) {
  return ((tact - beta128RotationOrigin) / beta128ByteTacts()) % BETA128_TRACK_BYTES;
}

/* The first tact at or after `from` at which track byte `position` has passed the head */
static uint32_t beta128NextPass(uint32_t from, uint32_t position) {
  const uint32_t rev = beta128RevolutionTacts();
  const uint32_t offset = position * beta128ByteTacts();
  const uint32_t sinceOrigin = from - beta128RotationOrigin;
  uint32_t turns = sinceOrigin / rev;
  uint32_t candidate = beta128RotationOrigin + turns * rev + offset;
  if ((int32_t)(candidate - from) < 0) {
    candidate += rev;
  }
  return candidate;
}

static inline uint32_t beta128IndexCount(uint32_t tact) {
  return (tact - beta128RotationOrigin) / beta128RevolutionTacts();
}

static inline uint8_t beta128DriveIndex(void) {
  return beta128SysReg & BETA128_SYS_DRIVE;
}

static inline Beta128Drive *beta128CurrentDrive(void) {
  const uint8_t index = beta128DriveIndex();
  return index < BETA128_DRIVE_COUNT ? &beta128Drives[index] : (Beta128Drive *)0;
}

static inline uint8_t beta128Side(void) {
  const uint8_t bitSet = (beta128SysReg & BETA128_SYS_SIDE) != 0u ? 1u : 0u;
  return BETA128_SIDE1_WHEN_BIT_CLEAR != 0u ? (uint8_t)(bitSet ^ 1u) : bitSet;
}

static inline uint8_t beta128Ready(void) {
  const Beta128Drive *drive = beta128CurrentDrive();
  return drive != (Beta128Drive *)0 && drive->present != 0u && (beta128SysReg & BETA128_SYS_RESET) != 0u;
}

/*
 * Can the controller read the current cylinder and side of the current drive at all? The density
 * bit (`BETA128_SYS_MFM`) is kept but not enforced: Klive models MFM only, and which value TR-DOS
 * writes is not confirmed (plan §9).
 */
static inline uint8_t beta128TrackReadable(void) {
  const Beta128Drive *drive = beta128CurrentDrive();
  return beta128Ready() && drive->cylinder < drive->cylinders && beta128Side() < drive->sides;
}

static inline uint32_t beta128SectorIndex(uint32_t cylinder, uint32_t side, uint32_t sector) {
  return (cylinder * 2u + side) * BETA128_SECTORS + (sector - 1u);
}

static inline uint8_t *beta128SectorData(uint32_t drive, uint32_t cylinder, uint32_t side, uint32_t sector) {
  return &beta128Data[drive][beta128SectorIndex(cylinder, side, sector) * BETA128_SECTOR_SIZE];
}

static void beta128MarkDirty(uint32_t drive, uint32_t index) {
  beta128Dirty[drive][index >> 5u] |= 1u << (index & 31u);
  beta128DirtyRevision++;
}

/* CRC-CCITT as the controller computes it: polynomial $1021, preset to $FFFF */
static uint16_t beta128Crc(uint16_t crc, uint8_t value) {
  crc ^= (uint16_t)value << 8u;
  for (uint32_t i = 0u; i < 8u; i++) {
    crc = (crc & 0x8000u) != 0u ? (uint16_t)((crc << 1u) ^ 0x1021u) : (uint16_t)(crc << 1u);
  }
  return crc;
}

static uint16_t beta128IdCrc(uint8_t c, uint8_t h, uint8_t r, uint8_t n) {
  uint16_t crc = 0xffffu;
  crc = beta128Crc(crc, 0xa1u);
  crc = beta128Crc(crc, 0xa1u);
  crc = beta128Crc(crc, 0xa1u);
  crc = beta128Crc(crc, 0xfeu);
  crc = beta128Crc(crc, c);
  crc = beta128Crc(crc, h);
  crc = beta128Crc(crc, r);
  return beta128Crc(crc, n);
}

static uint16_t beta128DataCrc(const uint8_t *data) {
  uint16_t crc = 0xffffu;
  crc = beta128Crc(crc, 0xa1u);
  crc = beta128Crc(crc, 0xa1u);
  crc = beta128Crc(crc, 0xa1u);
  crc = beta128Crc(crc, 0xfbu);
  for (uint32_t i = 0u; i < BETA128_SECTOR_SIZE; i++) crc = beta128Crc(crc, data[i]);
  return crc;
}

/* The byte Read Track sees at a track position (the layout above) */
static uint8_t beta128RawTrackByte(uint32_t position) {
  const Beta128Drive *drive = beta128CurrentDrive();
  const uint32_t cylinder = drive->cylinder;
  const uint32_t side = beta128Side();
  if (position < BETA128_FIRST_SLOT) {
    if (position < 40u) return 0x4eu;
    if (position < 52u) return 0x00u;
    if (position < 55u) return 0xc2u;
    if (position == 55u) return 0xfcu;
    return 0x4eu;
  }
  const uint32_t slot = (position - BETA128_FIRST_SLOT) / BETA128_SLOT_PITCH;
  if (slot >= BETA128_SECTORS) return 0x4eu;
  const uint32_t at = (position - BETA128_FIRST_SLOT) % BETA128_SLOT_PITCH;
  const uint8_t sector = (uint8_t)(slot + 1u);
  if (at < 12u) return 0x00u;
  if (at < 15u) return 0xa1u;
  if (at == 15u) return 0xfeu;
  if (at == 16u) return (uint8_t)cylinder;
  if (at == 17u) return (uint8_t)side;
  if (at == 18u) return sector;
  if (at == 19u) return 0x01u;
  if (at == 20u || at == 21u) {
    const uint16_t crc = beta128IdCrc((uint8_t)cylinder, (uint8_t)side, sector, 0x01u);
    return at == 20u ? (uint8_t)(crc >> 8u) : (uint8_t)crc;
  }
  if (at < 44u) return 0x4eu;
  if (at < 56u) return 0x00u;
  if (at < 59u) return 0xa1u;
  if (at == 59u) return 0xfbu;
  const uint8_t *data = beta128SectorData(beta128DriveIndex(), cylinder, side, sector);
  if (at < BETA128_SLOT_DATA_END - 2u) return data[at - BETA128_SLOT_DATA];
  if (at < BETA128_SLOT_DATA_END) {
    const uint16_t crc = beta128DataCrc(data);
    return at == BETA128_SLOT_DATA_END - 2u ? (uint8_t)(crc >> 8u) : (uint8_t)crc;
  }
  return 0x4eu;
}

/* ------------------------------------------------------------------------------------------- */
/* Command flow */

static void beta128Finish(uint32_t tact) {
  beta128Busy = 0u;
  beta128Intrq = 1u;
  beta128Phase = BETA128_PHASE_IDLE;
  beta128IdleSince = tact;
}

static void beta128Schedule(uint8_t phase, uint32_t tact) {
  beta128Phase = phase;
  beta128EventTact = tact;
}

/* Type II/III: wait for the sector's ID, or fail after four revolutions ([DS] Type II) */
static void beta128StartSearch(uint32_t tact) {
  const uint8_t isWrite = (beta128Command & 0xe0u) == 0xa0u;
  uint8_t found = beta128TrackReadable() && beta128Sector >= 1u && beta128Sector <= BETA128_SECTORS &&
    beta128Track == beta128CurrentDrive()->cylinder;
  /* The side compare (C flag): the S flag against the side recorded in the ID field */
  if (found && (beta128Command & 0x02u) != 0u) {
    found = ((beta128Command >> 3u) & 0x01u) == beta128Side();
  }
  if (!found) {
    beta128RecordNotFound = 1u;
    beta128Schedule(BETA128_PHASE_DONE, tact + 4u * beta128RevolutionTacts());
    return;
  }
  beta128CurrentSector = beta128Sector;
  const uint32_t slotStart = BETA128_FIRST_SLOT + (uint32_t)(beta128Sector - 1u) * BETA128_SLOT_PITCH;
  const uint32_t idEnd = beta128NextPass(tact, slotStart + BETA128_SLOT_ID_END);
  const uint32_t byteTacts = beta128ByteTacts();
  if (isWrite) {
    /* DRQ for the first byte when the ID field has passed ([DS] Write Sector) */
    beta128Schedule(BETA128_PHASE_WRITE_ID, idEnd);
  } else {
    beta128ByteIndex = 0u;
    beta128Schedule(BETA128_PHASE_READ_BYTE, idEnd + (BETA128_SLOT_DATA - BETA128_SLOT_ID_END + 1u) * byteTacts);
  }
}

static void beta128StartTypeOneEnd(uint32_t tact) {
  /* Verify (V): head settling, then the first ID field's track against the track register */
  if ((beta128Command & 0x04u) != 0u) {
    beta128HeadLoad = 1u;
    beta128Schedule(BETA128_PHASE_VERIFY, tact + beta128MsTacts(30u));
    return;
  }
  beta128Finish(tact);
}

static void beta128StepOnce(void) {
  Beta128Drive *drive = beta128CurrentDrive();
  if (drive != (Beta128Drive *)0) {
    if (beta128StepIn != 0u) {
      if (drive->cylinder < BETA128_MAX_CYLINDERS - 1u) drive->cylinder++;
    } else if (drive->cylinder > 0u) {
      drive->cylinder--;
    }
  }
}

static uint32_t beta128StepTacts(void) {
  static const uint8_t rates[4] = {6u, 12u, 20u, 30u};
  return beta128MsTacts(rates[beta128Command & 0x03u]);
}

static void beta128RunEvent(void) {
  const uint32_t tact = beta128EventTact;
  const uint32_t byteTacts = beta128ByteTacts();
  switch (beta128Phase) {
    case BETA128_PHASE_STEP: {
      const uint8_t command = beta128Command;
      if ((command & 0xf0u) == 0x00u) {
        /* Restore: step out until track 0, at most 255 steps ([DS]) */
        const Beta128Drive *drive = beta128CurrentDrive();
        if (drive != (Beta128Drive *)0 && drive->cylinder == 0u) {
          beta128Track = 0u;
          beta128StartTypeOneEnd(tact);
          return;
        }
        if (beta128StepsLeft == 0u) {
          beta128SeekError = 1u;
          beta128Finish(tact);
          return;
        }
        beta128StepsLeft--;
        beta128StepIn = 0u;
        beta128StepOnce();
        beta128Schedule(BETA128_PHASE_STEP, tact + beta128StepTacts());
        return;
      }
      if ((command & 0xf0u) == 0x10u) {
        /* Seek: step until the track register equals the data register */
        if ((int32_t)beta128Track == beta128SeekTarget) {
          beta128StartTypeOneEnd(tact);
          return;
        }
        beta128StepIn = (int32_t)beta128Track < beta128SeekTarget ? 1u : 0u;
        beta128Track = (uint8_t)(beta128StepIn != 0u ? beta128Track + 1u : beta128Track - 1u);
        beta128StepOnce();
        beta128Schedule(BETA128_PHASE_STEP, tact + beta128StepTacts());
        return;
      }
      /* Step, Step In, Step Out: one step, then the step delay */
      if (beta128StepsLeft != 0u) {
        beta128StepsLeft = 0u;
        if ((command & 0x10u) != 0u) {
          beta128Track = (uint8_t)(beta128StepIn != 0u ? beta128Track + 1u : beta128Track - 1u);
        }
        beta128StepOnce();
        beta128Schedule(BETA128_PHASE_STEP, tact + beta128StepTacts());
        return;
      }
      beta128StartTypeOneEnd(tact);
      return;
    }

    case BETA128_PHASE_VERIFY: {
      /* The first ID field to pass: its track must equal the track register; else 5 revolutions */
      if (beta128TrackReadable() && beta128Track == beta128CurrentDrive()->cylinder) {
        const uint32_t position = beta128TrackPosition(tact);
        uint32_t slot = position < BETA128_FIRST_SLOT ? 0u : (position - BETA128_FIRST_SLOT) / BETA128_SLOT_PITCH + 1u;
        if (slot >= BETA128_SECTORS) slot = 0u;
        const uint32_t when = beta128NextPass(tact, BETA128_FIRST_SLOT + slot * BETA128_SLOT_PITCH + BETA128_SLOT_ID_END);
        beta128Schedule(BETA128_PHASE_DONE, when);
      } else {
        beta128SeekError = 1u;
        beta128Schedule(BETA128_PHASE_DONE, tact + 5u * beta128RevolutionTacts());
      }
      return;
    }

    case BETA128_PHASE_DONE:
      beta128Finish(tact);
      return;

    case BETA128_PHASE_SEARCH:
      beta128StartSearch(tact);
      return;

    case BETA128_PHASE_READ_BYTE: {
      const uint8_t *data = beta128SectorData(beta128DriveIndex(), beta128CurrentDrive()->cylinder, beta128Side(),
        beta128CurrentSector);
      /* A byte arriving before the CPU took the last one replaces it ([DS] Lost Data) */
      if (beta128Drq != 0u) beta128LostData = 1u;
      beta128DataReg = data[beta128ByteIndex];
      beta128Drq = 1u;
      beta128ByteIndex++;
      if (beta128ByteIndex < BETA128_SECTOR_SIZE) {
        beta128Schedule(BETA128_PHASE_READ_BYTE, tact + byteTacts);
      } else {
        beta128Schedule(BETA128_PHASE_SECTOR_END, tact + 2u * byteTacts);
      }
      return;
    }

    case BETA128_PHASE_SECTOR_END:
      /* Multiple records (m): the next sector, until the sector register passes the last one */
      if ((beta128Command & 0x10u) != 0u) {
        beta128Sector++;
        if (beta128Sector > BETA128_SECTORS) {
          beta128RecordNotFound = 1u;
          beta128Finish(tact);
          return;
        }
        beta128StartSearch(tact);
        return;
      }
      beta128Finish(tact);
      return;

    case BETA128_PHASE_WRITE_ID:
      /* The ID field has passed: DRQ, served within the 22-byte count after the ID CRC */
      beta128Drq = 1u;
      beta128Schedule(BETA128_PHASE_WRITE_FIRST, tact + 22u * byteTacts);
      return;

    case BETA128_PHASE_WRITE_FIRST: {
      /* Write Gate opens only if the first DRQ was served; else Lost Data ends the command */
      if (beta128Drq != 0u) {
        beta128LostData = 1u;
        beta128Finish(tact);
        return;
      }
      beta128ByteIndex = 0u;
      beta128Schedule(BETA128_PHASE_WRITE_BYTE, tact + (BETA128_SLOT_DATA - BETA128_SLOT_ID_END - 22u) * byteTacts);
      return;
    }

    case BETA128_PHASE_WRITE_BYTE: {
      const uint32_t drive = beta128DriveIndex();
      const uint32_t cylinder = beta128CurrentDrive()->cylinder;
      const uint32_t side = beta128Side();
      uint8_t value = beta128DataReg;
      /* A byte the CPU did not supply in time is written as zero ([DS]) */
      if (beta128Drq != 0u) {
        beta128LostData = 1u;
        value = 0u;
      }
      uint8_t *data = beta128SectorData(drive, cylinder, side, beta128CurrentSector);
      if (data[beta128ByteIndex] != value) {
        data[beta128ByteIndex] = value;
      }
      beta128ByteIndex++;
      if (beta128ByteIndex < BETA128_SECTOR_SIZE) {
        beta128Drq = 1u;
        beta128Schedule(BETA128_PHASE_WRITE_BYTE, tact + byteTacts);
      } else {
        beta128MarkDirty(drive, beta128SectorIndex(cylinder, side, beta128CurrentSector));
        beta128Schedule(BETA128_PHASE_SECTOR_END, tact + 3u * byteTacts);
      }
      return;
    }

    case BETA128_PHASE_ADDRESS_BYTE:
      if (beta128Drq != 0u) beta128LostData = 1u;
      beta128DataReg = beta128AddressBytes[beta128ByteIndex];
      beta128Drq = 1u;
      beta128ByteIndex++;
      if (beta128ByteIndex < 6u) {
        beta128Schedule(BETA128_PHASE_ADDRESS_BYTE, tact + byteTacts);
      } else {
        /* The ID field's track goes to the sector register ([DS] Read Address) */
        beta128Sector = beta128AddressBytes[0];
        beta128Finish(tact);
      }
      return;

    case BETA128_PHASE_TRACK_BYTE:
      if (beta128Drq != 0u) beta128LostData = 1u;
      beta128DataReg = beta128RawTrackByte(beta128ByteIndex);
      beta128Drq = 1u;
      beta128ByteIndex++;
      if (beta128ByteIndex < BETA128_TRACK_BYTES) {
        beta128Schedule(BETA128_PHASE_TRACK_BYTE, tact + byteTacts);
      } else {
        beta128Finish(tact);
      }
      return;

    case BETA128_PHASE_WRITE_TRACK_START:
      /* Writing starts at the index; with the first byte not loaded by then, Lost Data ends it */
      if (beta128Drq != 0u) {
        beta128LostData = 1u;
        beta128Finish(tact);
        return;
      }
      beta128ByteIndex = 0u;
      beta128WtState = 0u;
      beta128WtCount = 0u;
      beta128WtHaveId = 0u;
      beta128Schedule(BETA128_PHASE_WRITE_TRACK_BYTE, tact);
      return;

    case BETA128_PHASE_WRITE_TRACK_BYTE: {
      uint8_t value = beta128DataReg;
      if (beta128Drq != 0u) {
        beta128LostData = 1u;
        value = 0u;
      }
      Beta128Drive *drive = beta128CurrentDrive();
      const uint32_t driveIndex = beta128DriveIndex();
      const uint32_t cylinder = drive->cylinder;
      const uint32_t side = beta128Side();
      /*
       * The address-mark parser: F5 writes A1 ([DS] Write Track, MFM); an FE after it opens an ID
       * field (C H R N), an FB a data field whose 256 bytes land in sector R of the cylinder and
       * side the head is on. F7 writes the CRC.
       */
      if (beta128WtState == 1u) {
        beta128WtId[beta128WtCount++] = value;
        if (beta128WtCount == 4u) {
          beta128WtState = 0u;
          beta128WtHaveId = 1u;
        }
      } else if (beta128WtState == 2u) {
        const uint8_t sector = beta128WtId[2];
        if (beta128WtHaveId != 0u && beta128WtId[3] == 0x01u && sector >= 1u && sector <= BETA128_SECTORS &&
          cylinder < BETA128_MAX_CYLINDERS) {
          uint8_t *data = beta128SectorData(driveIndex, cylinder, side, sector);
          data[beta128WtCount] = value;
        }
        beta128WtCount++;
        if (beta128WtCount == BETA128_SECTOR_SIZE) {
          beta128WtState = 0u;
          if (beta128WtHaveId != 0u && beta128WtId[3] == 0x01u && sector >= 1u && sector <= BETA128_SECTORS &&
            cylinder < BETA128_MAX_CYLINDERS) {
            /* A formatted track extends the disk */
            if (cylinder >= drive->cylinders) drive->cylinders = (uint8_t)(cylinder + 1u);
            if (side >= drive->sides) drive->sides = (uint8_t)(side + 1u);
            beta128MarkDirty(driveIndex, beta128SectorIndex(cylinder, side, sector));
          }
          beta128WtHaveId = 0u;
        }
      } else if (value == 0xfeu && beta128WtCount == 0xf5u) {
        beta128WtState = 1u;
        beta128WtCount = 0u;
      } else if (value == 0xfbu && beta128WtCount == 0xf5u) {
        beta128WtState = 2u;
        beta128WtCount = 0u;
      } else {
        /* Remember whether the byte before this one was an F5 (A1) mark */
        beta128WtCount = value == 0xf5u ? 0xf5u : 0u;
      }
      beta128ByteIndex++;
      if (beta128ByteIndex < BETA128_TRACK_BYTES) {
        beta128Drq = 1u;
        beta128Schedule(BETA128_PHASE_WRITE_TRACK_BYTE, tact + byteTacts);
      } else {
        beta128Finish(tact);
      }
      return;
    }

    default:
      beta128Phase = BETA128_PHASE_IDLE;
      return;
  }
}

/* Plays every event that fell due, then the idle-time effects (head unload, index interrupts) */
static void beta128Advance(void) {
  const uint32_t now = BETA128_NOW();
  uint32_t guard = 0u;
  while (beta128Phase != BETA128_PHASE_IDLE && (int32_t)(now - beta128EventTact) >= 0) {
    beta128RunEvent();
    if (++guard > 100000u) break;
  }
  if (beta128Busy == 0u && beta128HeadLoad != 0u &&
    now - beta128IdleSince >= 15u * beta128RevolutionTacts()) {
    /* Idle for 15 index pulses: the head unloads ([DS]) */
    beta128HeadLoad = 0u;
  }
  if (beta128IntOnIndex != 0u) {
    const uint32_t count = beta128IndexCount(now);
    if (count != beta128IndexMark) {
      beta128IndexMark = count;
      beta128Intrq = 1u;
    }
  }
}

static void beta128StartCommand(uint8_t command) {
  const uint32_t now = BETA128_NOW();
  /* Loading a command resets INTRQ ([DS]) */
  beta128Intrq = 0u;
  if ((command & 0xf0u) == 0xd0u) {
    /* Force Interrupt: terminates a running command; with none, the status shows Type I bits */
    if (beta128Busy != 0u) {
      beta128Busy = 0u;
      beta128Phase = BETA128_PHASE_IDLE;
      beta128IdleSince = now;
    } else {
      beta128TypeOneStatus = 1u;
      beta128SeekError = 0u;
      beta128CrcError = 0u;
    }
    beta128Drq = 0u;
    beta128IntOnIndex = (command & 0x04u) != 0u ? 1u : 0u;
    beta128IndexMark = beta128IndexCount(now);
    if ((command & 0x08u) != 0u) beta128Intrq = 1u;
    return;
  }
  if (beta128Busy != 0u) {
    /* The command register is not loaded while a command runs ([DS]) */
    return;
  }
  beta128Command = command;
  beta128IntOnIndex = 0u;
  beta128Busy = 1u;
  beta128Drq = 0u;
  beta128SeekError = 0u;
  beta128CrcError = 0u;
  beta128RecordNotFound = 0u;
  beta128LostData = 0u;
  beta128WriteProtectFault = 0u;

  if ((command & 0x80u) == 0u) {
    /* Type I */
    beta128TypeOneStatus = 1u;
    beta128HeadLoad = (command & 0x08u) != 0u ? 1u : 0u;
    const uint8_t kind = (uint8_t)(command & 0xf0u);
    if (kind == 0x00u) {
      beta128StepsLeft = 255u;
    } else if (kind == 0x10u) {
      beta128SeekTarget = beta128DataReg;
    } else {
      if ((command & 0x60u) == 0x40u) beta128StepIn = 1u;
      if ((command & 0x60u) == 0x60u) beta128StepIn = 0u;
      beta128StepsLeft = 1u;
    }
    beta128Schedule(BETA128_PHASE_STEP, now);
    beta128Advance();
    return;
  }

  /* Types II and III: the drive must be ready, and the head loads */
  beta128TypeOneStatus = 0u;
  if (!beta128Ready()) {
    beta128Finish(now);
    return;
  }
  beta128HeadLoad = 1u;
  const uint32_t settle = (command & 0x04u) != 0u ? beta128MsTacts(30u) : 0u;
  const uint8_t kind = (uint8_t)(command & 0xf0u);
  const Beta128Drive *drive = beta128CurrentDrive();
  const uint8_t isWrite = (command & 0xe0u) == 0xa0u || kind == 0xf0u;
  if (isWrite && drive->writeProtected != 0u) {
    beta128WriteProtectFault = 1u;
    beta128Finish(now);
    return;
  }
  if ((command & 0xc0u) == 0x80u) {
    /* Read Sector / Write Sector */
    beta128Schedule(BETA128_PHASE_SEARCH, now + settle);
  } else if (kind == 0xc0u) {
    /* Read Address: the next ID field to pass */
    if (!beta128TrackReadable()) {
      beta128RecordNotFound = 1u;
      beta128Schedule(BETA128_PHASE_DONE, now + settle + 4u * beta128RevolutionTacts());
    } else {
      const uint32_t from = now + settle;
      const uint32_t position = beta128TrackPosition(from);
      uint32_t slot = position < BETA128_FIRST_SLOT ? 0u : (position - BETA128_FIRST_SLOT) / BETA128_SLOT_PITCH + 1u;
      if (slot >= BETA128_SECTORS) slot = 0u;
      const uint8_t c = drive->cylinder;
      const uint8_t h = beta128Side();
      const uint8_t r = (uint8_t)(slot + 1u);
      const uint16_t crc = beta128IdCrc(c, h, r, 0x01u);
      beta128AddressBytes[0] = c;
      beta128AddressBytes[1] = h;
      beta128AddressBytes[2] = r;
      beta128AddressBytes[3] = 0x01u;
      beta128AddressBytes[4] = (uint8_t)(crc >> 8u);
      beta128AddressBytes[5] = (uint8_t)crc;
      beta128ByteIndex = 0u;
      const uint32_t start = beta128NextPass(from, BETA128_FIRST_SLOT + slot * BETA128_SLOT_PITCH + BETA128_SLOT_ID_C);
      beta128Schedule(BETA128_PHASE_ADDRESS_BYTE, start + beta128ByteTacts());
    }
  } else if (kind == 0xe0u) {
    /* Read Track: from the next index pulse to the one after */
    beta128ByteIndex = 0u;
    beta128Schedule(BETA128_PHASE_TRACK_BYTE, beta128NextPass(now + settle, 0u) + beta128ByteTacts());
  } else if (kind == 0xf0u) {
    /* Write Track: DRQ at once; writing starts at the next index pulse */
    beta128Drq = 1u;
    beta128Schedule(BETA128_PHASE_WRITE_TRACK_START, beta128NextPass(now + settle, 0u));
  } else {
    beta128Finish(now);
  }
  beta128Advance();
}

/* ------------------------------------------------------------------------------------------- */
/* The interface */

static void beta128ResetController(void) {
  beta128Busy = 0u;
  beta128Intrq = 0u;
  beta128Drq = 0u;
  beta128Phase = BETA128_PHASE_IDLE;
  beta128Command = 0x03u;
  beta128TypeOneStatus = 1u;
  beta128SeekError = 0u;
  beta128CrcError = 0u;
  beta128RecordNotFound = 0u;
  beta128LostData = 0u;
  beta128WriteProtectFault = 0u;
  beta128HeadLoad = 0u;
  beta128IntOnIndex = 0u;
  beta128Sector = 1u;
}

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

static uint8_t beta128ReadStatus(void) {
  beta128Advance();
  uint8_t status = beta128Busy != 0u ? BETA128_ST_BUSY : 0u;
  if (!beta128Ready()) status |= BETA128_ST_NOT_READY;
  const Beta128Drive *drive = beta128CurrentDrive();
  if (beta128TypeOneStatus != 0u) {
    if (drive != (Beta128Drive *)0 && drive->present != 0u && drive->writeProtected != 0u) {
      status |= BETA128_ST_PROTECTED;
    }
    if (beta128HeadLoad != 0u && (beta128SysReg & BETA128_SYS_HLT) != 0u) status |= BETA128_ST_HEAD_RECTYPE;
    if (beta128SeekError != 0u) status |= BETA128_ST_SEEK_RNF;
    if (beta128CrcError != 0u) status |= BETA128_ST_CRC;
    if (drive != (Beta128Drive *)0 && drive->cylinder == 0u) status |= BETA128_ST_TRACK0_LOST;
    if (beta128Ready() && beta128TrackPosition(BETA128_NOW()) < BETA128_INDEX_BYTES) {
      status |= BETA128_ST_INDEX_DRQ;
    }
  } else {
    if (beta128WriteProtectFault != 0u) status |= BETA128_ST_PROTECTED;
    if (beta128RecordNotFound != 0u) status |= BETA128_ST_SEEK_RNF;
    if (beta128CrcError != 0u) status |= BETA128_ST_CRC;
    if (beta128LostData != 0u) status |= BETA128_ST_TRACK0_LOST;
    if (beta128Drq != 0u) status |= BETA128_ST_INDEX_DRQ;
  }
  return status;
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

/* The tact counter moved back by `by` (`sp128ShiftTactOrigin`): every absolute tact moves with it */
static void beta128ShiftTactOrigin(uint32_t by) {
  beta128EventTact -= by;
  beta128RotationOrigin -= by;
  beta128IdleSince -= by;
}

/* ------------------------------------------------------------------------------------------- */
/* Media, for the host */

static void beta128InsertDisk(uint32_t drive, uint32_t cylinders, uint32_t sides, uint32_t writeProtected) {
  if (drive >= BETA128_DRIVE_COUNT) return;
  Beta128Drive *d = &beta128Drives[drive];
  d->present = 1u;
  d->cylinders = (uint8_t)(cylinders > BETA128_MAX_CYLINDERS ? BETA128_MAX_CYLINDERS : cylinders);
  d->sides = (uint8_t)(sides == 1u ? 1u : 2u);
  d->writeProtected = writeProtected != 0u ? 1u : 0u;
  for (uint32_t i = 0u; i < BETA128_DIRTY_WORDS; i++) beta128Dirty[drive][i] = 0u;
}

static void beta128EjectDisk(uint32_t drive) {
  if (drive >= BETA128_DRIVE_COUNT) return;
  beta128Drives[drive].present = 0u;
  for (uint32_t i = 0u; i < BETA128_DIRTY_WORDS; i++) beta128Dirty[drive][i] = 0u;
}
