// ----------------------------------------------------------------------------
// The WD1793 floppy disk controller (the FD179X data sheet [DS]), shared by the disk interfaces built
// on it: the Beta 128 (`zx-spectrum-beta128.c`, `.plans/BETA128_TRDOS_PLAN.md`) and the Videoton
// TVC's HBF card (`tvc-hbf.c`, `.plans/VIDEOTON_TVC_PLAN.md` §9.4). Extracted from the Beta 128
// unchanged; its symbols take the prefix the includer chooses, so the Beta 128 keeps its names.
//
// The includer defines, before including this file:
//   WD1793_PREFIX          the name prefix of every symbol here (`beta128`: beta128Track, ...)
//   WD1793_NOW()           the CPU's tact counter now
//   WD1793_TACTS_PER_MS    T-states per millisecond of real time (clock x multiplier / 1000)
//   WD1793_DRIVE_COUNT, WD1793_MAX_CYLINDERS
//   WD1793_SECTORS, WD1793_SECTOR_SIZE, WD1793_SECTOR_N   sectors a track (IDs from 1), their size,
//                          and the size code in their ID fields (1 = 256, 2 = 512)
//   WD1793_SLOT_PITCH      the bytes of one sector's slot on the raw track (see below)
//   WD1793_DRIVE_INDEX()   the drive the interface selects (WD1793_DRIVE_COUNT or more: none)
//   WD1793_SIDE()          the side the interface selects, 0 or 1
//   WD1793_MR_INACTIVE()   nonzero while the master reset line is not held
//   WD1793_HLT()           nonzero while the head-load timing input is high
//
// The controller is lazy. Every port access first plays the events that fell due since the last one,
// in order (`Advance`), so DRQ, Lost Data, the index pulse and INTRQ read exactly as a running
// controller would have left them.
//
// The disks are held in a canonical layout: cylinder-major, two sides, WD1793_SECTORS sectors (IDs
// from 1) a track: byte ((cylinder * 2 + side) * SECTORS + sector - 1) * SECTOR_SIZE. The TypeScript
// side converts the image files to and from it.
// ----------------------------------------------------------------------------

#define WD1793_CAT2(a, b) a##b
#define WD1793_CAT(a, b) WD1793_CAT2(a, b)
#define WD(name) WD1793_CAT(WD1793_PREFIX, name)

#define WD1793_TRACK_SIZE (WD1793_SECTORS * WD1793_SECTOR_SIZE)
#define WD1793_DRIVE_CAPACITY (WD1793_MAX_CYLINDERS * 2u * WD1793_TRACK_SIZE)
#define WD1793_SECTOR_COUNT (WD1793_MAX_CYLINDERS * 2u * WD1793_SECTORS)
#define WD1793_DIRTY_WORDS ((WD1793_SECTOR_COUNT + 31u) / 32u)

/*
 * One revolution in byte times: MFM at 250 kbit/s ([DS]: a 1 MHz clock for 5.25" drives halves the
 * 2 MHz rates) and 300 rpm give 31 250 bytes a second, 6 250 a revolution.
 *
 * The layout of a track (an image holds no physical layout, so this one is Klive's choice, with
 * the standard MFM field sizes): a 100-byte gap after the index, then WD1793_SECTORS sector slots
 * of WD1793_SLOT_PITCH bytes in ID order. Within a slot: 12 bytes of 00, A1 A1 A1 FE, C H R N, CRC
 * (ID field, bytes 0-21), 22 bytes of 4E, 12 of 00, A1 A1 A1 FB, the data and the data CRC (from
 * byte 44 to WD1793_SLOT_DATA_END), then 4E to the next slot.
 */
#define WD1793_TRACK_BYTES 6250u
#define WD1793_FIRST_SLOT 100u
#define WD1793_SLOT_ID_C 16u
#define WD1793_SLOT_ID_END 22u
#define WD1793_SLOT_DATA 60u
#define WD1793_SLOT_DATA_END (WD1793_SLOT_DATA + WD1793_SECTOR_SIZE + 2u)
/* The index hole passes the sensor for 4 ms: 125 byte times (a drive convention, not in [DS]) */
#define WD1793_INDEX_BYTES 125u


/* Controller phases */
#define WD1793_PHASE_IDLE 0u
#define WD1793_PHASE_STEP 1u
#define WD1793_PHASE_VERIFY 2u
#define WD1793_PHASE_DONE 3u
#define WD1793_PHASE_SEARCH 4u
#define WD1793_PHASE_READ_BYTE 5u
#define WD1793_PHASE_SECTOR_END 6u
#define WD1793_PHASE_WRITE_FIRST 7u
#define WD1793_PHASE_WRITE_BYTE 8u
#define WD1793_PHASE_ADDRESS_BYTE 9u
#define WD1793_PHASE_TRACK_BYTE 10u
#define WD1793_PHASE_WRITE_TRACK_START 11u
#define WD1793_PHASE_WRITE_TRACK_BYTE 12u
#define WD1793_PHASE_WRITE_ID 13u

/* Status register bits ([DS] Table 6) */
#define WD1793_ST_BUSY 0x01u
#define WD1793_ST_INDEX_DRQ 0x02u
#define WD1793_ST_TRACK0_LOST 0x04u
#define WD1793_ST_CRC 0x08u
#define WD1793_ST_SEEK_RNF 0x10u
#define WD1793_ST_HEAD_RECTYPE 0x20u
#define WD1793_ST_PROTECTED 0x40u
#define WD1793_ST_NOT_READY 0x80u

typedef struct WD(Drive) {
  uint8_t present;
  uint8_t writeProtected;
  uint8_t cylinders;
  uint8_t sides;
  /* Where the head is (the physical cylinder) */
  uint8_t cylinder;
} WD(Drive);

static uint8_t WD(Data)[WD1793_DRIVE_COUNT][WD1793_DRIVE_CAPACITY];
static uint32_t WD(Dirty)[WD1793_DRIVE_COUNT][WD1793_DIRTY_WORDS];
static uint32_t WD(DirtyRevision);
static WD(Drive) WD(Drives)[WD1793_DRIVE_COUNT];

/* The controller's registers and lines */
static uint8_t WD(Command);
static uint8_t WD(Track);
static uint8_t WD(Sector);
static uint8_t WD(DataReg);
static uint8_t WD(Busy);
static uint8_t WD(Intrq);
static uint8_t WD(Drq);
/* 1: the status register shows Type I bits; 0: Type II/III bits */
static uint8_t WD(TypeOneStatus);
static uint8_t WD(SeekError);
static uint8_t WD(CrcError);
static uint8_t WD(RecordNotFound);
static uint8_t WD(LostData);
static uint8_t WD(WriteProtectFault);
/* The head-load output (HLD) and the step direction (1 = in, towards higher cylinders) */
static uint8_t WD(HeadLoad);
static uint8_t WD(StepIn);
static uint8_t WD(IntOnIndex);

/* The running command */
static uint8_t WD(Phase);
static uint32_t WD(EventTact);
static uint32_t WD(StepsLeft);
static int32_t WD(SeekTarget);
static uint32_t WD(ByteIndex);
static uint8_t WD(AddressBytes)[6];
static uint8_t WD(CurrentSector);
/* Write Track: the address-mark parser */
static uint8_t WD(WtState);
static uint32_t WD(WtCount);
static uint8_t WD(WtId)[4];
static uint8_t WD(WtHaveId);

/* Time */
static uint32_t WD(RotationOrigin);
static uint32_t WD(IdleSince);
static uint32_t WD(IndexMark);

static inline uint32_t WD(ByteTacts)(void) {
  const uint32_t tacts = (uint32_t)((WD1793_TACTS_PER_MS * 32u) / 1000u);
  return tacts == 0u ? 1u : tacts;
}

static inline uint32_t WD(RevolutionTacts)(void) {
  return WD(ByteTacts)() * WD1793_TRACK_BYTES;
}

static inline uint32_t WD(MsTacts)(uint32_t ms) {
  return (uint32_t)(WD1793_TACTS_PER_MS * ms);
}

/* The byte of the track under the head at a tact */
static inline uint32_t WD(TrackPosition)(uint32_t tact) {
  return ((tact - WD(RotationOrigin)) / WD(ByteTacts)()) % WD1793_TRACK_BYTES;
}

/* The first tact at or after `from` at which track byte `position` has passed the head */
static uint32_t WD(NextPass)(uint32_t from, uint32_t position) {
  const uint32_t rev = WD(RevolutionTacts)();
  const uint32_t offset = position * WD(ByteTacts)();
  const uint32_t sinceOrigin = from - WD(RotationOrigin);
  uint32_t turns = sinceOrigin / rev;
  uint32_t candidate = WD(RotationOrigin) + turns * rev + offset;
  if ((int32_t)(candidate - from) < 0) {
    candidate += rev;
  }
  return candidate;
}

static inline uint32_t WD(IndexCount)(uint32_t tact) {
  return (tact - WD(RotationOrigin)) / WD(RevolutionTacts)();
}

static inline uint8_t WD(DriveIndex)(void) {
  return (uint8_t)(WD1793_DRIVE_INDEX());
}

static inline WD(Drive) *WD(CurrentDrive)(void) {
  const uint8_t index = WD(DriveIndex)();
  return index < WD1793_DRIVE_COUNT ? &WD(Drives)[index] : (WD(Drive) *)0;
}

static inline uint8_t WD(Side)(void) {
  return (uint8_t)(WD1793_SIDE());
}

static inline uint8_t WD(Ready)(void) {
  const WD(Drive) *drive = WD(CurrentDrive)();
  return drive != (WD(Drive) *)0 && drive->present != 0u && (WD1793_MR_INACTIVE()) != 0u;
}

/*
 * Can the controller read the current cylinder and side of the current drive at all? Klive models
 * MFM only: an interface's density line is kept by the interface, not enforced here.
 */
static inline uint8_t WD(TrackReadable)(void) {
  const WD(Drive) *drive = WD(CurrentDrive)();
  return WD(Ready)() && drive->cylinder < drive->cylinders && WD(Side)() < drive->sides;
}

static inline uint32_t WD(SectorIndex)(uint32_t cylinder, uint32_t side, uint32_t sector) {
  return (cylinder * 2u + side) * WD1793_SECTORS + (sector - 1u);
}

static inline uint8_t *WD(SectorData)(uint32_t drive, uint32_t cylinder, uint32_t side, uint32_t sector) {
  return &WD(Data)[drive][WD(SectorIndex)(cylinder, side, sector) * WD1793_SECTOR_SIZE];
}

static void WD(MarkDirty)(uint32_t drive, uint32_t index) {
  WD(Dirty)[drive][index >> 5u] |= 1u << (index & 31u);
  WD(DirtyRevision)++;
}

/* CRC-CCITT as the controller computes it: polynomial $1021, preset to $FFFF */
static uint16_t WD(Crc)(uint16_t crc, uint8_t value) {
  crc ^= (uint16_t)value << 8u;
  for (uint32_t i = 0u; i < 8u; i++) {
    crc = (crc & 0x8000u) != 0u ? (uint16_t)((crc << 1u) ^ 0x1021u) : (uint16_t)(crc << 1u);
  }
  return crc;
}

static uint16_t WD(IdCrc)(uint8_t c, uint8_t h, uint8_t r, uint8_t n) {
  uint16_t crc = 0xffffu;
  crc = WD(Crc)(crc, 0xa1u);
  crc = WD(Crc)(crc, 0xa1u);
  crc = WD(Crc)(crc, 0xa1u);
  crc = WD(Crc)(crc, 0xfeu);
  crc = WD(Crc)(crc, c);
  crc = WD(Crc)(crc, h);
  crc = WD(Crc)(crc, r);
  return WD(Crc)(crc, n);
}

static uint16_t WD(DataCrc)(const uint8_t *data) {
  uint16_t crc = 0xffffu;
  crc = WD(Crc)(crc, 0xa1u);
  crc = WD(Crc)(crc, 0xa1u);
  crc = WD(Crc)(crc, 0xa1u);
  crc = WD(Crc)(crc, 0xfbu);
  for (uint32_t i = 0u; i < WD1793_SECTOR_SIZE; i++) crc = WD(Crc)(crc, data[i]);
  return crc;
}

/* The byte Read Track sees at a track position (the layout above) */
static uint8_t WD(RawTrackByte)(uint32_t position) {
  const WD(Drive) *drive = WD(CurrentDrive)();
  const uint32_t cylinder = drive->cylinder;
  const uint32_t side = WD(Side)();
  if (position < WD1793_FIRST_SLOT) {
    if (position < 40u) return 0x4eu;
    if (position < 52u) return 0x00u;
    if (position < 55u) return 0xc2u;
    if (position == 55u) return 0xfcu;
    return 0x4eu;
  }
  const uint32_t slot = (position - WD1793_FIRST_SLOT) / WD1793_SLOT_PITCH;
  if (slot >= WD1793_SECTORS) return 0x4eu;
  const uint32_t at = (position - WD1793_FIRST_SLOT) % WD1793_SLOT_PITCH;
  const uint8_t sector = (uint8_t)(slot + 1u);
  if (at < 12u) return 0x00u;
  if (at < 15u) return 0xa1u;
  if (at == 15u) return 0xfeu;
  if (at == 16u) return (uint8_t)cylinder;
  if (at == 17u) return (uint8_t)side;
  if (at == 18u) return sector;
  if (at == 19u) return WD1793_SECTOR_N;
  if (at == 20u || at == 21u) {
    const uint16_t crc = WD(IdCrc)((uint8_t)cylinder, (uint8_t)side, sector, WD1793_SECTOR_N);
    return at == 20u ? (uint8_t)(crc >> 8u) : (uint8_t)crc;
  }
  if (at < 44u) return 0x4eu;
  if (at < 56u) return 0x00u;
  if (at < 59u) return 0xa1u;
  if (at == 59u) return 0xfbu;
  const uint8_t *data = WD(SectorData)(WD(DriveIndex)(), cylinder, side, sector);
  if (at < WD1793_SLOT_DATA_END - 2u) return data[at - WD1793_SLOT_DATA];
  if (at < WD1793_SLOT_DATA_END) {
    const uint16_t crc = WD(DataCrc)(data);
    return at == WD1793_SLOT_DATA_END - 2u ? (uint8_t)(crc >> 8u) : (uint8_t)crc;
  }
  return 0x4eu;
}

/* ------------------------------------------------------------------------------------------- */
/* Command flow */

static void WD(Finish)(uint32_t tact) {
  WD(Busy) = 0u;
  WD(Intrq) = 1u;
  WD(Phase) = WD1793_PHASE_IDLE;
  WD(IdleSince) = tact;
}

static void WD(Schedule)(uint8_t phase, uint32_t tact) {
  WD(Phase) = phase;
  WD(EventTact) = tact;
}

/* Type II/III: wait for the sector's ID, or fail after four revolutions ([DS] Type II) */
static void WD(StartSearch)(uint32_t tact) {
  const uint8_t isWrite = (WD(Command) & 0xe0u) == 0xa0u;
  uint8_t found = WD(TrackReadable)() && WD(Sector) >= 1u && WD(Sector) <= WD1793_SECTORS &&
    WD(Track) == WD(CurrentDrive)()->cylinder;
  /* The side compare (C flag): the S flag against the side recorded in the ID field */
  if (found && (WD(Command) & 0x02u) != 0u) {
    found = ((WD(Command) >> 3u) & 0x01u) == WD(Side)();
  }
  if (!found) {
    WD(RecordNotFound) = 1u;
    WD(Schedule)(WD1793_PHASE_DONE, tact + 4u * WD(RevolutionTacts)());
    return;
  }
  WD(CurrentSector) = WD(Sector);
  const uint32_t slotStart = WD1793_FIRST_SLOT + (uint32_t)(WD(Sector) - 1u) * WD1793_SLOT_PITCH;
  const uint32_t idEnd = WD(NextPass)(tact, slotStart + WD1793_SLOT_ID_END);
  const uint32_t byteTacts = WD(ByteTacts)();
  if (isWrite) {
    /* DRQ for the first byte when the ID field has passed ([DS] Write Sector) */
    WD(Schedule)(WD1793_PHASE_WRITE_ID, idEnd);
  } else {
    WD(ByteIndex) = 0u;
    WD(Schedule)(WD1793_PHASE_READ_BYTE, idEnd + (WD1793_SLOT_DATA - WD1793_SLOT_ID_END + 1u) * byteTacts);
  }
}

static void WD(StartTypeOneEnd)(uint32_t tact) {
  /* Verify (V): head settling, then the first ID field's track against the track register */
  if ((WD(Command) & 0x04u) != 0u) {
    WD(HeadLoad) = 1u;
    WD(Schedule)(WD1793_PHASE_VERIFY, tact + WD(MsTacts)(30u));
    return;
  }
  WD(Finish)(tact);
}

static void WD(StepOnce)(void) {
  WD(Drive) *drive = WD(CurrentDrive)();
  if (drive != (WD(Drive) *)0) {
    if (WD(StepIn) != 0u) {
      if (drive->cylinder < WD1793_MAX_CYLINDERS - 1u) drive->cylinder++;
    } else if (drive->cylinder > 0u) {
      drive->cylinder--;
    }
  }
}

static uint32_t WD(StepTacts)(void) {
  static const uint8_t rates[4] = {6u, 12u, 20u, 30u};
  return WD(MsTacts)(rates[WD(Command) & 0x03u]);
}

static void WD(RunEvent)(void) {
  const uint32_t tact = WD(EventTact);
  const uint32_t byteTacts = WD(ByteTacts)();
  switch (WD(Phase)) {
    case WD1793_PHASE_STEP: {
      const uint8_t command = WD(Command);
      if ((command & 0xf0u) == 0x00u) {
        /* Restore: step out until track 0, at most 255 steps ([DS]) */
        const WD(Drive) *drive = WD(CurrentDrive)();
        if (drive != (WD(Drive) *)0 && drive->cylinder == 0u) {
          WD(Track) = 0u;
          WD(StartTypeOneEnd)(tact);
          return;
        }
        if (WD(StepsLeft) == 0u) {
          WD(SeekError) = 1u;
          WD(Finish)(tact);
          return;
        }
        WD(StepsLeft)--;
        WD(StepIn) = 0u;
        WD(StepOnce)();
        WD(Schedule)(WD1793_PHASE_STEP, tact + WD(StepTacts)());
        return;
      }
      if ((command & 0xf0u) == 0x10u) {
        /* Seek: step until the track register equals the data register */
        if ((int32_t)WD(Track) == WD(SeekTarget)) {
          WD(StartTypeOneEnd)(tact);
          return;
        }
        WD(StepIn) = (int32_t)WD(Track) < WD(SeekTarget) ? 1u : 0u;
        WD(Track) = (uint8_t)(WD(StepIn) != 0u ? WD(Track) + 1u : WD(Track) - 1u);
        WD(StepOnce)();
        WD(Schedule)(WD1793_PHASE_STEP, tact + WD(StepTacts)());
        return;
      }
      /* Step, Step In, Step Out: one step, then the step delay */
      if (WD(StepsLeft) != 0u) {
        WD(StepsLeft) = 0u;
        if ((command & 0x10u) != 0u) {
          WD(Track) = (uint8_t)(WD(StepIn) != 0u ? WD(Track) + 1u : WD(Track) - 1u);
        }
        WD(StepOnce)();
        WD(Schedule)(WD1793_PHASE_STEP, tact + WD(StepTacts)());
        return;
      }
      WD(StartTypeOneEnd)(tact);
      return;
    }

    case WD1793_PHASE_VERIFY: {
      /* The first ID field to pass: its track must equal the track register; else 5 revolutions */
      if (WD(TrackReadable)() && WD(Track) == WD(CurrentDrive)()->cylinder) {
        const uint32_t position = WD(TrackPosition)(tact);
        uint32_t slot = position < WD1793_FIRST_SLOT ? 0u : (position - WD1793_FIRST_SLOT) / WD1793_SLOT_PITCH + 1u;
        if (slot >= WD1793_SECTORS) slot = 0u;
        const uint32_t when = WD(NextPass)(tact, WD1793_FIRST_SLOT + slot * WD1793_SLOT_PITCH + WD1793_SLOT_ID_END);
        WD(Schedule)(WD1793_PHASE_DONE, when);
      } else {
        WD(SeekError) = 1u;
        WD(Schedule)(WD1793_PHASE_DONE, tact + 5u * WD(RevolutionTacts)());
      }
      return;
    }

    case WD1793_PHASE_DONE:
      WD(Finish)(tact);
      return;

    case WD1793_PHASE_SEARCH:
      WD(StartSearch)(tact);
      return;

    case WD1793_PHASE_READ_BYTE: {
      const uint8_t *data = WD(SectorData)(WD(DriveIndex)(), WD(CurrentDrive)()->cylinder, WD(Side)(),
        WD(CurrentSector));
      /* A byte arriving before the CPU took the last one replaces it ([DS] Lost Data) */
      if (WD(Drq) != 0u) WD(LostData) = 1u;
      WD(DataReg) = data[WD(ByteIndex)];
      WD(Drq) = 1u;
      WD(ByteIndex)++;
      if (WD(ByteIndex) < WD1793_SECTOR_SIZE) {
        WD(Schedule)(WD1793_PHASE_READ_BYTE, tact + byteTacts);
      } else {
        WD(Schedule)(WD1793_PHASE_SECTOR_END, tact + 2u * byteTacts);
      }
      return;
    }

    case WD1793_PHASE_SECTOR_END:
      /* Multiple records (m): the next sector, until the sector register passes the last one */
      if ((WD(Command) & 0x10u) != 0u) {
        WD(Sector)++;
        if (WD(Sector) > WD1793_SECTORS) {
          WD(RecordNotFound) = 1u;
          WD(Finish)(tact);
          return;
        }
        WD(StartSearch)(tact);
        return;
      }
      WD(Finish)(tact);
      return;

    case WD1793_PHASE_WRITE_ID:
      /* The ID field has passed: DRQ, served within the 22-byte count after the ID CRC */
      WD(Drq) = 1u;
      WD(Schedule)(WD1793_PHASE_WRITE_FIRST, tact + 22u * byteTacts);
      return;

    case WD1793_PHASE_WRITE_FIRST: {
      /* Write Gate opens only if the first DRQ was served; else Lost Data ends the command */
      if (WD(Drq) != 0u) {
        WD(LostData) = 1u;
        WD(Finish)(tact);
        return;
      }
      WD(ByteIndex) = 0u;
      WD(Schedule)(WD1793_PHASE_WRITE_BYTE, tact + (WD1793_SLOT_DATA - WD1793_SLOT_ID_END - 22u) * byteTacts);
      return;
    }

    case WD1793_PHASE_WRITE_BYTE: {
      const uint32_t drive = WD(DriveIndex)();
      const uint32_t cylinder = WD(CurrentDrive)()->cylinder;
      const uint32_t side = WD(Side)();
      uint8_t value = WD(DataReg);
      /* A byte the CPU did not supply in time is written as zero ([DS]) */
      if (WD(Drq) != 0u) {
        WD(LostData) = 1u;
        value = 0u;
      }
      uint8_t *data = WD(SectorData)(drive, cylinder, side, WD(CurrentSector));
      if (data[WD(ByteIndex)] != value) {
        data[WD(ByteIndex)] = value;
      }
      WD(ByteIndex)++;
      if (WD(ByteIndex) < WD1793_SECTOR_SIZE) {
        WD(Drq) = 1u;
        WD(Schedule)(WD1793_PHASE_WRITE_BYTE, tact + byteTacts);
      } else {
        WD(MarkDirty)(drive, WD(SectorIndex)(cylinder, side, WD(CurrentSector)));
        WD(Schedule)(WD1793_PHASE_SECTOR_END, tact + 3u * byteTacts);
      }
      return;
    }

    case WD1793_PHASE_ADDRESS_BYTE:
      if (WD(Drq) != 0u) WD(LostData) = 1u;
      WD(DataReg) = WD(AddressBytes)[WD(ByteIndex)];
      WD(Drq) = 1u;
      WD(ByteIndex)++;
      if (WD(ByteIndex) < 6u) {
        WD(Schedule)(WD1793_PHASE_ADDRESS_BYTE, tact + byteTacts);
      } else {
        /* The ID field's track goes to the sector register ([DS] Read Address) */
        WD(Sector) = WD(AddressBytes)[0];
        WD(Finish)(tact);
      }
      return;

    case WD1793_PHASE_TRACK_BYTE:
      if (WD(Drq) != 0u) WD(LostData) = 1u;
      WD(DataReg) = WD(RawTrackByte)(WD(ByteIndex));
      WD(Drq) = 1u;
      WD(ByteIndex)++;
      if (WD(ByteIndex) < WD1793_TRACK_BYTES) {
        WD(Schedule)(WD1793_PHASE_TRACK_BYTE, tact + byteTacts);
      } else {
        WD(Finish)(tact);
      }
      return;

    case WD1793_PHASE_WRITE_TRACK_START:
      /* Writing starts at the index; with the first byte not loaded by then, Lost Data ends it */
      if (WD(Drq) != 0u) {
        WD(LostData) = 1u;
        WD(Finish)(tact);
        return;
      }
      WD(ByteIndex) = 0u;
      WD(WtState) = 0u;
      WD(WtCount) = 0u;
      WD(WtHaveId) = 0u;
      WD(Schedule)(WD1793_PHASE_WRITE_TRACK_BYTE, tact);
      return;

    case WD1793_PHASE_WRITE_TRACK_BYTE: {
      uint8_t value = WD(DataReg);
      if (WD(Drq) != 0u) {
        WD(LostData) = 1u;
        value = 0u;
      }
      WD(Drive) *drive = WD(CurrentDrive)();
      const uint32_t driveIndex = WD(DriveIndex)();
      const uint32_t cylinder = drive->cylinder;
      const uint32_t side = WD(Side)();
      /*
       * The address-mark parser: F5 writes A1 ([DS] Write Track, MFM); an FE after it opens an ID
       * field (C H R N), an FB a data field whose 256 bytes land in sector R of the cylinder and
       * side the head is on. F7 writes the CRC.
       */
      if (WD(WtState) == 1u) {
        WD(WtId)[WD(WtCount)++] = value;
        if (WD(WtCount) == 4u) {
          WD(WtState) = 0u;
          WD(WtHaveId) = 1u;
        }
      } else if (WD(WtState) == 2u) {
        const uint8_t sector = WD(WtId)[2];
        if (WD(WtHaveId) != 0u && WD(WtId)[3] == WD1793_SECTOR_N && sector >= 1u && sector <= WD1793_SECTORS &&
          cylinder < WD1793_MAX_CYLINDERS) {
          uint8_t *data = WD(SectorData)(driveIndex, cylinder, side, sector);
          data[WD(WtCount)] = value;
        }
        WD(WtCount)++;
        if (WD(WtCount) == WD1793_SECTOR_SIZE) {
          WD(WtState) = 0u;
          if (WD(WtHaveId) != 0u && WD(WtId)[3] == WD1793_SECTOR_N && sector >= 1u && sector <= WD1793_SECTORS &&
            cylinder < WD1793_MAX_CYLINDERS) {
            /* A formatted track extends the disk */
            if (cylinder >= drive->cylinders) drive->cylinders = (uint8_t)(cylinder + 1u);
            if (side >= drive->sides) drive->sides = (uint8_t)(side + 1u);
            WD(MarkDirty)(driveIndex, WD(SectorIndex)(cylinder, side, sector));
          }
          WD(WtHaveId) = 0u;
        }
      } else if (value == 0xfeu && WD(WtCount) == 0xf5u) {
        WD(WtState) = 1u;
        WD(WtCount) = 0u;
      } else if (value == 0xfbu && WD(WtCount) == 0xf5u) {
        WD(WtState) = 2u;
        WD(WtCount) = 0u;
      } else {
        /* Remember whether the byte before this one was an F5 (A1) mark */
        WD(WtCount) = value == 0xf5u ? 0xf5u : 0u;
      }
      WD(ByteIndex)++;
      if (WD(ByteIndex) < WD1793_TRACK_BYTES) {
        WD(Drq) = 1u;
        WD(Schedule)(WD1793_PHASE_WRITE_TRACK_BYTE, tact + byteTacts);
      } else {
        WD(Finish)(tact);
      }
      return;
    }

    default:
      WD(Phase) = WD1793_PHASE_IDLE;
      return;
  }
}

/* Plays every event that fell due, then the idle-time effects (head unload, index interrupts) */
static void WD(Advance)(void) {
  const uint32_t now = WD1793_NOW();
  uint32_t guard = 0u;
  while (WD(Phase) != WD1793_PHASE_IDLE && (int32_t)(now - WD(EventTact)) >= 0) {
    WD(RunEvent)();
    if (++guard > 100000u) break;
  }
  if (WD(Busy) == 0u && WD(HeadLoad) != 0u &&
    now - WD(IdleSince) >= 15u * WD(RevolutionTacts)()) {
    /* Idle for 15 index pulses: the head unloads ([DS]) */
    WD(HeadLoad) = 0u;
  }
  if (WD(IntOnIndex) != 0u) {
    const uint32_t count = WD(IndexCount)(now);
    if (count != WD(IndexMark)) {
      WD(IndexMark) = count;
      WD(Intrq) = 1u;
    }
  }
}

static void WD(StartCommand)(uint8_t command) {
  const uint32_t now = WD1793_NOW();
  /* Loading a command resets INTRQ ([DS]) */
  WD(Intrq) = 0u;
  if ((command & 0xf0u) == 0xd0u) {
    /* Force Interrupt: terminates a running command; with none, the status shows Type I bits */
    if (WD(Busy) != 0u) {
      WD(Busy) = 0u;
      WD(Phase) = WD1793_PHASE_IDLE;
      WD(IdleSince) = now;
    } else {
      WD(TypeOneStatus) = 1u;
      WD(SeekError) = 0u;
      WD(CrcError) = 0u;
    }
    WD(Drq) = 0u;
    WD(IntOnIndex) = (command & 0x04u) != 0u ? 1u : 0u;
    WD(IndexMark) = WD(IndexCount)(now);
    if ((command & 0x08u) != 0u) WD(Intrq) = 1u;
    return;
  }
  if (WD(Busy) != 0u) {
    /* The command register is not loaded while a command runs ([DS]) */
    return;
  }
  WD(Command) = command;
  WD(IntOnIndex) = 0u;
  WD(Busy) = 1u;
  WD(Drq) = 0u;
  WD(SeekError) = 0u;
  WD(CrcError) = 0u;
  WD(RecordNotFound) = 0u;
  WD(LostData) = 0u;
  WD(WriteProtectFault) = 0u;

  if ((command & 0x80u) == 0u) {
    /* Type I */
    WD(TypeOneStatus) = 1u;
    WD(HeadLoad) = (command & 0x08u) != 0u ? 1u : 0u;
    const uint8_t kind = (uint8_t)(command & 0xf0u);
    if (kind == 0x00u) {
      WD(StepsLeft) = 255u;
    } else if (kind == 0x10u) {
      WD(SeekTarget) = WD(DataReg);
    } else {
      if ((command & 0x60u) == 0x40u) WD(StepIn) = 1u;
      if ((command & 0x60u) == 0x60u) WD(StepIn) = 0u;
      WD(StepsLeft) = 1u;
    }
    WD(Schedule)(WD1793_PHASE_STEP, now);
    WD(Advance)();
    return;
  }

  /* Types II and III: the drive must be ready, and the head loads */
  WD(TypeOneStatus) = 0u;
  if (!WD(Ready)()) {
    WD(Finish)(now);
    return;
  }
  WD(HeadLoad) = 1u;
  const uint32_t settle = (command & 0x04u) != 0u ? WD(MsTacts)(30u) : 0u;
  const uint8_t kind = (uint8_t)(command & 0xf0u);
  const WD(Drive) *drive = WD(CurrentDrive)();
  const uint8_t isWrite = (command & 0xe0u) == 0xa0u || kind == 0xf0u;
  if (isWrite && drive->writeProtected != 0u) {
    WD(WriteProtectFault) = 1u;
    WD(Finish)(now);
    return;
  }
  if ((command & 0xc0u) == 0x80u) {
    /* Read Sector / Write Sector */
    WD(Schedule)(WD1793_PHASE_SEARCH, now + settle);
  } else if (kind == 0xc0u) {
    /* Read Address: the next ID field to pass */
    if (!WD(TrackReadable)()) {
      WD(RecordNotFound) = 1u;
      WD(Schedule)(WD1793_PHASE_DONE, now + settle + 4u * WD(RevolutionTacts)());
    } else {
      const uint32_t from = now + settle;
      const uint32_t position = WD(TrackPosition)(from);
      uint32_t slot = position < WD1793_FIRST_SLOT ? 0u : (position - WD1793_FIRST_SLOT) / WD1793_SLOT_PITCH + 1u;
      if (slot >= WD1793_SECTORS) slot = 0u;
      const uint8_t c = drive->cylinder;
      const uint8_t h = WD(Side)();
      const uint8_t r = (uint8_t)(slot + 1u);
      const uint16_t crc = WD(IdCrc)(c, h, r, WD1793_SECTOR_N);
      WD(AddressBytes)[0] = c;
      WD(AddressBytes)[1] = h;
      WD(AddressBytes)[2] = r;
      WD(AddressBytes)[3] = WD1793_SECTOR_N;
      WD(AddressBytes)[4] = (uint8_t)(crc >> 8u);
      WD(AddressBytes)[5] = (uint8_t)crc;
      WD(ByteIndex) = 0u;
      const uint32_t start = WD(NextPass)(from, WD1793_FIRST_SLOT + slot * WD1793_SLOT_PITCH + WD1793_SLOT_ID_C);
      WD(Schedule)(WD1793_PHASE_ADDRESS_BYTE, start + WD(ByteTacts)());
    }
  } else if (kind == 0xe0u) {
    /* Read Track: from the next index pulse to the one after */
    WD(ByteIndex) = 0u;
    WD(Schedule)(WD1793_PHASE_TRACK_BYTE, WD(NextPass)(now + settle, 0u) + WD(ByteTacts)());
  } else if (kind == 0xf0u) {
    /* Write Track: DRQ at once; writing starts at the next index pulse */
    WD(Drq) = 1u;
    WD(Schedule)(WD1793_PHASE_WRITE_TRACK_START, WD(NextPass)(now + settle, 0u));
  } else {
    WD(Finish)(now);
  }
  WD(Advance)();
}

/* ------------------------------------------------------------------------------------------- */
/* The interface */

static void WD(ResetController)(void) {
  WD(Busy) = 0u;
  WD(Intrq) = 0u;
  WD(Drq) = 0u;
  WD(Phase) = WD1793_PHASE_IDLE;
  WD(Command) = 0x03u;
  WD(TypeOneStatus) = 1u;
  WD(SeekError) = 0u;
  WD(CrcError) = 0u;
  WD(RecordNotFound) = 0u;
  WD(LostData) = 0u;
  WD(WriteProtectFault) = 0u;
  WD(HeadLoad) = 0u;
  WD(IntOnIndex) = 0u;
  WD(Sector) = 1u;
}


static uint8_t WD(ReadStatus)(void) {
  WD(Advance)();
  uint8_t status = WD(Busy) != 0u ? WD1793_ST_BUSY : 0u;
  if (!WD(Ready)()) status |= WD1793_ST_NOT_READY;
  const WD(Drive) *drive = WD(CurrentDrive)();
  if (WD(TypeOneStatus) != 0u) {
    if (drive != (WD(Drive) *)0 && drive->present != 0u && drive->writeProtected != 0u) {
      status |= WD1793_ST_PROTECTED;
    }
    if (WD(HeadLoad) != 0u && (WD1793_HLT()) != 0u) status |= WD1793_ST_HEAD_RECTYPE;
    if (WD(SeekError) != 0u) status |= WD1793_ST_SEEK_RNF;
    if (WD(CrcError) != 0u) status |= WD1793_ST_CRC;
    if (drive != (WD(Drive) *)0 && drive->cylinder == 0u) status |= WD1793_ST_TRACK0_LOST;
    if (WD(Ready)() && WD(TrackPosition)(WD1793_NOW()) < WD1793_INDEX_BYTES) {
      status |= WD1793_ST_INDEX_DRQ;
    }
  } else {
    if (WD(WriteProtectFault) != 0u) status |= WD1793_ST_PROTECTED;
    if (WD(RecordNotFound) != 0u) status |= WD1793_ST_SEEK_RNF;
    if (WD(CrcError) != 0u) status |= WD1793_ST_CRC;
    if (WD(LostData) != 0u) status |= WD1793_ST_TRACK0_LOST;
    if (WD(Drq) != 0u) status |= WD1793_ST_INDEX_DRQ;
  }
  return status;
}

/* The tact counter moved back by `by` (`sp128ShiftTactOrigin`): every absolute tact moves with it */
static void WD(ShiftTactOrigin)(uint32_t by) {
  WD(EventTact) -= by;
  WD(RotationOrigin) -= by;
  WD(IdleSince) -= by;
}

/* ------------------------------------------------------------------------------------------- */
/* Media, for the host */

static void WD(InsertDisk)(uint32_t drive, uint32_t cylinders, uint32_t sides, uint32_t writeProtected) {
  if (drive >= WD1793_DRIVE_COUNT) return;
  WD(Drive) *d = &WD(Drives)[drive];
  d->present = 1u;
  d->cylinders = (uint8_t)(cylinders > WD1793_MAX_CYLINDERS ? WD1793_MAX_CYLINDERS : cylinders);
  d->sides = (uint8_t)(sides == 1u ? 1u : 2u);
  d->writeProtected = writeProtected != 0u ? 1u : 0u;
  for (uint32_t i = 0u; i < WD1793_DIRTY_WORDS; i++) WD(Dirty)[drive][i] = 0u;
}

static void WD(EjectDisk)(uint32_t drive) {
  if (drive >= WD1793_DRIVE_COUNT) return;
  WD(Drives)[drive].present = 0u;
  for (uint32_t i = 0u; i < WD1793_DIRTY_WORDS; i++) WD(Dirty)[drive][i] = 0u;
}
