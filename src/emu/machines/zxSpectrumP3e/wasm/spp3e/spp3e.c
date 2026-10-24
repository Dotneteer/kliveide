#include <stdint.h>

#define SPP3E_MEMORY_SIZE 0x10000u
#define SPP3E_RAM_SIZE 0x20000u
#define SPP3E_ROM_SIZE 0x10000u
#define SPP3E_KEYBOARD_LINE_COUNT 8u
#define SPP3E_SCREEN_WIDTH 352u
#define SPP3E_SCREEN_HEIGHT 287u
#define SPP3E_PIXEL_BUFFER_WORDS (SPP3E_SCREEN_WIDTH * SPP3E_SCREEN_HEIGHT)
#define SPP3E_AUDIO_SAMPLE_CAPACITY 2048u
#define SPP3E_AUDIO_TRANSITION_CAPACITY 8192u
#define SPP3E_AUDIO_SAMPLE_SCALE 12000
#define SPP3E_DEFAULT_SAMPLE_RATE 44100u
#define SPP3E_BASE_CLOCK_FREQUENCY 3546900u
#define SPP3E_DISK_DRIVE_COUNT 2u
/*
 * The floppy drives (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, A3). A disk lives in the core as
 * a per-track sector table over a data area, uploaded by the host from the DSK file: every sector
 * keeps its own ID (C, H, R, N), the status bytes the dump recorded (ST1, ST2), its stored length
 * and, for a weak sector, the number of stored copies. The data area holds 1 MB per drive (an
 * 80-track, double-sided 720K disk with room to reformat it); the change area is a bitmap with one
 * bit per sector-table entry that the host turns into write-back changes.
 */
#define SPP3E_DISK_DATA_CAPACITY 0x100000u
#define SPP3E_DISK_CHANGE_CAPACITY 0x1000u
#define SPP3E_DISK_DEFAULT_MAX_CYLINDERS 42u
#define SPP3E_DISK_LONG_DRIVE_CYLINDERS 84u
#define SPP3E_DISK_MAX_CYLINDERS 102u
#define SPP3E_DISK_TRACK_ENTRIES (SPP3E_DISK_MAX_CYLINDERS * 2u)
#define SPP3E_DISK_SECTOR_CAPACITY 8192u
#define SPP3E_DISK_MAX_SECTORS_PER_TRACK 255u
#define SPP3E_FDC_PHASE_COMMAND 0u
#define SPP3E_FDC_PHASE_EXECUTION 1u
#define SPP3E_FDC_PHASE_RESULT 2u
#define SPP3E_FDC_MSR_CB 0x10u
#define SPP3E_FDC_MSR_EXM 0x20u
#define SPP3E_FDC_MSR_DIO 0x40u
#define SPP3E_FDC_MSR_RQM 0x80u
#define SPP3E_FDC_SR3_US0 0x01u
#define SPP3E_FDC_SR3_HD 0x04u
#define SPP3E_FDC_SR3_TS 0x08u
#define SPP3E_FDC_SR3_T0 0x10u
#define SPP3E_FDC_SR3_RD 0x20u
#define SPP3E_FDC_SR3_WP 0x40u
#define SPP3E_FDC_CMD_READ_DATA 0u
#define SPP3E_FDC_CMD_WRITE_DATA 1u
#define SPP3E_FDC_CMD_WRITE_ID 2u
#define SPP3E_FDC_CMD_SCAN 3u
#define SPP3E_FDC_CMD_READ_ID 4u
#define SPP3E_FDC_CMD_RECALIBRATE 5u
#define SPP3E_FDC_CMD_SENSE_INT 6u
#define SPP3E_FDC_CMD_SPECIFY 7u
#define SPP3E_FDC_CMD_SENSE_DRIVE 8u
#define SPP3E_FDC_CMD_SEEK 9u
#define SPP3E_FDC_CMD_INVALID 10u
#define SPP3E_FDC_CMD_READ_TRACK 11u
#define SPP3E_FDC_INT_NONE 0u
#define SPP3E_FDC_INT_SEEK 4u
#define SPP3E_FDC_SR0_SE 0x20u
#define SPP3E_FDC_SR0_AT 0x40u
#define SPP3E_FDC_SR0_IC 0x80u
#define SPP3E_FDC_SR0_NR 0x08u
#define SPP3E_FDC_SR1_MA 0x01u
#define SPP3E_FDC_SR1_NW 0x02u
#define SPP3E_FDC_SR1_ND 0x04u
#define SPP3E_FDC_SR1_DE 0x20u
#define SPP3E_FDC_SR1_EN 0x80u
#define SPP3E_FDC_SR2_MD 0x01u
#define SPP3E_FDC_SR2_BC 0x02u
#define SPP3E_FDC_SR2_SN 0x04u
#define SPP3E_FDC_SR2_SH 0x08u
#define SPP3E_FDC_SR2_WC 0x10u
#define SPP3E_FDC_SR2_DD 0x20u
#define SPP3E_FDC_SR2_CM 0x40u
#define SPP3E_TAPE_MAX_BLOCKS 512u
#define SPP3E_TAPE_DATA_CAPACITY 0x400000u
#define SPP3E_TAPE_FILENAME_CAPACITY 260u
#define SPP3E_TAPE_SAVE_MAX_BLOCKS 64u
#define SPP3E_TAPE_SAVE_DATA_CAPACITY 0x100000u
#define SPP3E_TAPE_HEADER_PILOT_COUNT 8063u
#define SPP3E_TAPE_DATA_PILOT_COUNT 3223u
#define SPP3E_TAPE_MIN_SAVE_PILOT_PULSE_COUNT 3000u
#define SPP3E_TAPE_SAVE_PULSE_TOLERANCE 24u
#define SPP3E_TAPE_TOO_LONG_SAVE_PAUSE 3500000u
#define SPP3E_TAPE_PILOT_PULSE_LENGTH 2168u
#define SPP3E_TAPE_SYNC1_PULSE_LENGTH 667u
#define SPP3E_TAPE_SYNC2_PULSE_LENGTH 735u
#define SPP3E_TAPE_BIT0_PULSE_LENGTH 855u
#define SPP3E_TAPE_BIT1_PULSE_LENGTH 1710u
#define SPP3E_TAPE_TERM_SYNC_PULSE_LENGTH 947u
#define SPP3E_TAPE_LOAD_BYTES_ROUTINE 0x056cu
#define SPP3E_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE 0x05b6u
#define SPP3E_TAPE_LOAD_BYTES_RESUME_ROUTINE 0x05e2u
#define SPP3E_TAPE_SAVE_BYTES_ROUTINE 0x04c2u
#define SPP3E_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW 0x00000004u
#define SPP3E_DIAGNOSTIC_TAPE_DATA_OVERFLOW 0x00000008u
#define SPP3E_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE 0x00000010u
#define SPP3E_DIAGNOSTIC_TAPE_SAVE_DATA_OVERFLOW 0x00000040u
#define SPP3E_DIAGNOSTIC_TAPE_SAVE_BLOCK_OVERFLOW 0x00000080u
#define SPP3E_DIAGNOSTIC_TAPE_SAVE_MALFORMED_PULSE 0x00000100u
#define SPP3E_TAPE_MODE_PASSIVE 0u
#define SPP3E_TAPE_MODE_LOAD 1u
#define SPP3E_TAPE_MODE_SAVE 2u
#define SPP3E_TAPE_PHASE_NONE 0u
#define SPP3E_TAPE_PHASE_PILOT 1u
#define SPP3E_TAPE_PHASE_SYNC 2u
#define SPP3E_TAPE_PHASE_DATA 3u
#define SPP3E_TAPE_PHASE_TERM_SYNC 4u
#define SPP3E_TAPE_PHASE_PAUSE 5u
#define SPP3E_TAPE_PHASE_COMPLETED 6u
#define SPP3E_TAPE_SAVE_PHASE_NONE 0u
#define SPP3E_TAPE_SAVE_PHASE_PILOT 1u
#define SPP3E_TAPE_SAVE_PHASE_SYNC1 2u
#define SPP3E_TAPE_SAVE_PHASE_SYNC2 3u
#define SPP3E_TAPE_SAVE_PHASE_DATA 4u
#define SPP3E_TAPE_SAVE_PHASE_ERROR 5u
#define SPP3E_TAPE_MIC_PULSE_NONE 0u
#define SPP3E_TAPE_MIC_PULSE_TOO_SHORT 1u
#define SPP3E_TAPE_MIC_PULSE_TOO_LONG 2u
#define SPP3E_TAPE_MIC_PULSE_PILOT 3u
#define SPP3E_TAPE_MIC_PULSE_SYNC1 4u
#define SPP3E_TAPE_MIC_PULSE_SYNC2 5u
#define SPP3E_TAPE_MIC_PULSE_BIT0 6u
#define SPP3E_TAPE_MIC_PULSE_BIT1 7u
#define SPP3E_TAPE_MIC_PULSE_TERM_SYNC 8u
#define SPP3E_TACTS_PER_FRAME 70908u
#define SPP3E_SCREEN_LINE_TIME 228u
#define SPP3E_RENDER_PHASE_NONE 0u
#define SPP3E_RENDER_PHASE_BORDER 1u
#define SPP3E_RENDER_PHASE_BORDER_FETCH_PIXEL 2u
#define SPP3E_RENDER_PHASE_BORDER_FETCH_ATTR 3u
#define SPP3E_RENDER_PHASE_DISPLAY_B1 4u
#define SPP3E_RENDER_PHASE_DISPLAY_B2 5u
#define SPP3E_RENDER_PHASE_DISPLAY_B1_FETCH_B2 6u
#define SPP3E_RENDER_PHASE_DISPLAY_B1_FETCH_A2 7u
#define SPP3E_RENDER_PHASE_DISPLAY_B2_FETCH_B1 8u
#define SPP3E_RENDER_PHASE_DISPLAY_B2_FETCH_A1 9u

typedef struct Spp3eScreenConfig {
  uint16_t verticalSyncLines;
  uint16_t nonVisibleBorderTopLines;
  uint16_t borderTopLines;
  uint16_t borderBottomLines;
  uint16_t nonVisibleBorderBottomLines;
  uint16_t displayLines;
  uint16_t borderLeftTime;
  uint16_t borderRightTime;
  uint16_t displayLineTime;
  uint16_t horizontalBlankingTime;
  uint16_t nonVisibleBorderRightTime;
  uint16_t pixelDataPrefetchTime;
  uint16_t attributeDataPrefetchTime;
  uint8_t contentionValues[8];
  /*
   * How many T-states the ULA's real memory reads come after the T-states this table fetches at
   * (`.plans/SPECTRUM_ULA_ACCURACY_PLAN.md` §1.2): 4 on the 48K, 2 on the 128K/+2 - the offset the
   * floating bus already used (its byte is the table's fetch of `delay + 1` T-states before the
   * port read). A CPU write and an `OUT` to the border take effect against the real reads; 0 keeps
   * the old behaviour on the machines no measurement covers yet (+2A/+3, Timex, Pentagon, Scorpion).
   */
  uint8_t ulaFetchDelay;
} Spp3eScreenConfig;

typedef struct Spp3eAudioSample {
  int16_t left;
  int16_t right;
} Spp3eAudioSample;

typedef struct Spp3eTapeBlock {
  uint32_t offset;
  uint32_t length;
  uint32_t pauseAfter;
  uint32_t pilotPulseLength;
  uint32_t sync1PulseLength;
  uint32_t sync2PulseLength;
  uint32_t zeroBitPulseLength;
  uint32_t oneBitPulseLength;
  uint32_t endSyncPulseLength;
  uint8_t lastByteUsedBits;
  uint32_t pilotPulseCount;
} Spp3eTapeBlock;

typedef struct Spp3eDiskDrive {
  uint8_t hasDiskLoaded;
  uint8_t writeProtected;
  uint8_t selected;
  uint8_t hasTwoHeads;
  uint8_t currentHead;
  uint8_t track0Mark;
  uint8_t ready;
  uint8_t motorOn;
  int8_t motorAcceleration;
  uint8_t motorSpeed;
  uint8_t currentCylinder;
  uint8_t maxCylinders;
  uint8_t headLoaded;
  uint8_t imageCylinders;
  uint8_t imageSides;
  uint16_t rotation;
  uint16_t sectorsUsed;
  uint8_t weakCounter;
  uint32_t diskLength;
  uint32_t revision;
  uint32_t structureRevision;
} Spp3eDiskDrive;

/* One track of a disk: its sectors are table entries `firstSector` .. `firstSector + sectorCount - 1`,
 * in physical order, their data back to back in the data area */
typedef struct Spp3eDiskTrack {
  uint16_t firstSector;
  uint8_t sectorCount;
  uint8_t formatted;
  uint8_t gap3;
  uint8_t filler;
  uint8_t sizeCode;
  uint8_t reserved;
} Spp3eDiskTrack;

/* One sector: its ID, the dump's status bytes, and `copies` stored copies of `length` bytes each */
typedef struct Spp3eDiskSector {
  uint8_t c;
  uint8_t h;
  uint8_t r;
  uint8_t n;
  uint8_t st1;
  uint8_t st2;
  uint8_t copies;
  uint8_t reserved;
  uint32_t offset;
  uint16_t length;
  uint16_t reserved2;
} Spp3eDiskSector;

static uint8_t spp3eMemory[SPP3E_MEMORY_SIZE];
static uint8_t spp3eRam[SPP3E_RAM_SIZE];
static uint8_t spp3eRom[SPP3E_ROM_SIZE];
static uint32_t spp3ePixelBuffer[SPP3E_PIXEL_BUFFER_WORDS];
static Spp3eAudioSample spp3eAudioSamples[SPP3E_AUDIO_SAMPLE_CAPACITY];
static uint8_t spp3eKeyboardLines[SPP3E_KEYBOARD_LINE_COUNT];
static uint8_t spp3eKeyboardSelectedLineValue[256];
static uint8_t spp3eDiskData[SPP3E_DISK_DRIVE_COUNT][SPP3E_DISK_DATA_CAPACITY];
static uint8_t spp3eDiskChanges[SPP3E_DISK_DRIVE_COUNT][SPP3E_DISK_CHANGE_CAPACITY];
static Spp3eDiskTrack spp3eDiskTracks[SPP3E_DISK_DRIVE_COUNT][SPP3E_DISK_TRACK_ENTRIES];
static Spp3eDiskSector spp3eDiskSectors[SPP3E_DISK_DRIVE_COUNT][SPP3E_DISK_SECTOR_CAPACITY];
static uint8_t spp3eTapeData[SPP3E_TAPE_DATA_CAPACITY];
static uint8_t spp3eTapeFileName[SPP3E_TAPE_FILENAME_CAPACITY];
static uint8_t spp3eTapeSaveData[SPP3E_TAPE_SAVE_DATA_CAPACITY];
static Spp3eTapeBlock spp3eTapeBlocks[SPP3E_TAPE_MAX_BLOCKS];
static Spp3eTapeBlock spp3eTapeSaveBlocks[SPP3E_TAPE_SAVE_MAX_BLOCKS];
static Spp3eDiskDrive spp3eDiskDrives[SPP3E_DISK_DRIVE_COUNT];

static uint8_t *spp3eMemorySlotBase[4];
static uint8_t spp3eMemorySlotWritable[4];
static int32_t spp3eMemorySlotPartition[4];
static uint8_t spp3eContention[SPP3E_TACTS_PER_FRAME];
static uint8_t spp3eRenderingPhase[SPP3E_TACTS_PER_FRAME];
static uint16_t spp3eRenderingPixelAddress[SPP3E_TACTS_PER_FRAME];
static uint16_t spp3eRenderingAttributeAddress[SPP3E_TACTS_PER_FRAME];
static uint32_t spp3eRenderingPixelIndex[SPP3E_TACTS_PER_FRAME];
static uint32_t spp3eFrames;
static uint32_t spp3eTacts;
/* What the host's tact counter is ahead of the internal one (see `spp3eShiftTactOrigin`) */
static uint32_t spp3eTactEpoch;
static uint32_t spp3eNextFrameStartTact;
static uint32_t spp3eTotalContentionDelaySinceStart;
static uint32_t spp3eContentionDelaySincePause;
static uint32_t spp3eCpuInstructionsExecuted;
static uint32_t spp3eCpuFrameSliceInstructions;
static uint8_t spp3eFrameCompleted;
/*
 * A frame has begun (`spp3eBeginMachineFrame`) since the reset. With `spp3eFrameCompleted` clear,
 * that frame is still in progress - a history stop target or the debug loop left it mid-way - and
 * the next fast frame continues it instead of beginning another (REVERSE_DEBUGGING_PLAN D4, T17).
 */
static uint32_t spp3eFrameBegun;
static uint32_t spp3eInterruptsRaised;
static uint8_t spp3eInterruptLineActive;
static uint8_t spp3eCaptureBusEvents = 1u;
static uint32_t spp3eTactsInFrame = SPP3E_TACTS_PER_FRAME;
static uint32_t spp3eClockMultiplier = 1u;
static uint32_t spp3eRasterLines;
static uint32_t spp3eScreenLineTime;
static uint32_t spp3eTimingScreenWidth;
static uint32_t spp3eTimingScreenLines;
static uint32_t spp3eFirstDisplayLine;
static uint32_t spp3eFirstVisibleLine;
static uint32_t spp3eFirstVisibleBorderTact;
static uint32_t spp3eDisplayLeftPixel;
static uint32_t spp3eDisplayTopLine;
static uint8_t spp3eSelectedRom;
static uint8_t spp3eSelectedBank;
static uint8_t spp3ePagingEnabled = 1u;
/* The last bytes written to $7FFD (while unlocked) and $1FFD (snapshot saving) */
static uint8_t spp3ePort7ffd;
static uint8_t spp3ePort1ffd;
static uint8_t spp3eUseShadowScreen;
static uint8_t spp3eInSpecialPagingMode;
static uint8_t spp3eSpecialConfigMode;
static uint8_t spp3eDiskMotorOn;
static uint8_t spp3ePortFeValue;
static uint8_t spp3eBorderColor = 7u;
static uint8_t spp3eEarBit;
static uint8_t spp3eMicBit;
static uint8_t spp3eBeeperLevel;
static uint32_t spp3eEarBitChangedFrom0Tacts;
static uint32_t spp3eEarBitChangedFrom1Tacts;
static uint32_t spp3eAudioSampleRate = SPP3E_DEFAULT_SAMPLE_RATE;
static uint32_t spp3eAudioSampleCount;
static double spp3eAudioSampleLength;
static double spp3eAudioNextSampleTact;
static uint32_t spp3eAudioNextSampleTactFloor;
static uint32_t spp3eAudioLastLevelChangeTact;
static double spp3eAudioAccumulatedEar;
static double spp3eAudioAccumulatedMic;
static double spp3eAudioAccumulatedTacts;
static double spp3eAudioSampleWindowStartTact;
static uint8_t spp3eAudioSampleWindowStartEar;
static uint8_t spp3eAudioSampleWindowStartMic;
static uint32_t spp3eAudioTransitionCount;
static uint32_t spp3eAudioTransitionTacts[SPP3E_AUDIO_TRANSITION_CAPACITY];
static uint8_t spp3eAudioTransitionEar[SPP3E_AUDIO_TRANSITION_CAPACITY];
static uint8_t spp3eAudioTransitionMic[SPP3E_AUDIO_TRANSITION_CAPACITY];
static double spp3eDcFilterPrevInputLeft;
static double spp3eDcFilterPrevInputRight;
static double spp3eDcFilterPrevOutputLeft;
static double spp3eDcFilterPrevOutputRight;
static uint32_t spp3eDiagnosticFlags;
static uint32_t spp3eTapeBlockCount;
static uint32_t spp3eTapeDataLength;
static uint32_t spp3eTapeCurrentBlockIndex;
static uint32_t spp3eTapeUploadBlockCount;
static uint32_t spp3eTapeUploadDataLength;
static uint8_t spp3eTapeUploadActive;
static uint8_t spp3eTapeLoaded;
static uint8_t spp3eTapeEof;
static uint8_t spp3eTapeMode;
static uint8_t spp3eTapePlayPhase;
static uint32_t spp3eTapeStartTact;
static uint32_t spp3eTapePilotEndPos;
static uint32_t spp3eTapeSync1EndPos;
static uint32_t spp3eTapeSync2EndPos;
static uint32_t spp3eTapeBitStartPos;
static uint32_t spp3eTapeBitPulseLength;
static uint32_t spp3eTapeDataIndex;
static uint8_t spp3eTapeBitMask;
static uint32_t spp3eTapeTermEndPos;
static uint32_t spp3eTapePauseEndPos;
static uint8_t spp3eTapeEarBit;
static uint8_t spp3eTapeFastLoad = 1u;
static uint32_t spp3eTapeModeChangeCount;
static uint32_t spp3eTapeLastModeChangeTact;
static uint32_t spp3eTapeLastModeChangePc;
static uint32_t spp3eTapeLoadStartCount;
static uint32_t spp3eTapeSaveStartCount;
static uint8_t spp3eTapeSaveMicBit;
static uint8_t spp3eTapeSavePhase;
static uint8_t spp3eTapeSavePreviousDataPulse;
static uint8_t spp3eTapeSaveLastPulse;
static uint8_t spp3eTapeSaveBitOffset;
static uint8_t spp3eTapeSaveDataByte;
static uint32_t spp3eTapeSaveLastMicBitTact;
static uint32_t spp3eTapeSavePilotPulseCount;
static uint32_t spp3eTapeSavedBlockCount;
static uint32_t spp3eTapeSavedDataLength;
static uint32_t spp3eTapeSavedRevision;
static uint32_t spp3eTapeSaveCurrentBlockOffset;
static uint32_t spp3eTapeSaveCurrentBlockLength;
static uint8_t spp3eFdcEnabledDriveCount = 1u;
static uint8_t spp3eFdcCurrentDrive;
static uint8_t spp3eFdcMsr = SPP3E_FDC_MSR_RQM;
static uint8_t spp3eFdcSr0;
static uint8_t spp3eFdcSr1;
static uint8_t spp3eFdcSr2;
static uint8_t spp3eFdcSr3;
static uint8_t spp3eFdcOperationPhase = SPP3E_FDC_PHASE_COMMAND;
static uint8_t spp3eFdcDataRegister[9];
static uint8_t spp3eFdcResultRegister[9];
static uint8_t spp3eFdcResultBytesLeft;
static uint8_t spp3eFdcResultIndex;
static uint8_t spp3eFdcCommandId = SPP3E_FDC_CMD_INVALID;
static uint8_t spp3eFdcCommandRegister;
static uint8_t spp3eFdcCommandLength;
static uint8_t spp3eFdcCommandBytesReceived;
static uint8_t spp3eFdcCommandResultLength;
static uint8_t spp3eFdcIntReq;
static uint8_t spp3eFdcPresentCylinder[4];
static uint8_t spp3eFdcSenseIntResult[2];
static uint32_t spp3eFdcSectorOffset;
static uint8_t spp3eFdcStepRate = 16u;
static uint8_t spp3eFdcHeadUnloadTime = 240u;
static uint8_t spp3eFdcHeadLoadTime = 254u;
static uint8_t spp3eFdcNonDmaMode = 1u;
static uint8_t spp3eFdcDirtyDrive = 0xffu;
static uint32_t spp3eFdcTransferOffset;
static uint32_t spp3eFdcTransferLength;
static uint32_t spp3eFdcDirtyOffset;
static uint32_t spp3eFdcDirtyLength;
static uint32_t spp3eFdcDirtyRevision;
/* The running read/write: the sector being transferred, and what the command asked for */
static int32_t spp3eFdcSector = -1;
static uint32_t spp3eFdcSectorStored;
static uint8_t spp3eFdcEndSector;
static uint8_t spp3eFdcMultiTrack;
static uint8_t spp3eFdcSkip;
static uint8_t spp3eFdcDeletedMark;
static uint8_t spp3eFdcScanType;
static uint8_t spp3eFdcScanEqual;
static uint8_t spp3eFdcScanNotMet;
static uint8_t spp3eFdcPendingSr1;
static uint8_t spp3eFdcPendingSr2;
static uint8_t spp3eFdcStopAfterSector;
static uint8_t spp3eFdcFormatIds[SPP3E_DISK_MAX_SECTORS_PER_TRACK * 4u];

uint32_t spp3eExecuteInstruction(void);
void spp3eRenderInstantScreen(void);
static uint8_t spp3eDiskUploadDrive;
static uint32_t spp3eDiskUploadLength;
static uint8_t spp3eDiskUploadActive;
static uint8_t spp3eDiskUploadWriteProtected;
static uint8_t spp3eDiskUploadTracks;
static uint8_t spp3eDiskUploadSides;
static int32_t spp3eDiskUploadTrackEntry = -1;
static uint16_t spp3eDiskUploadSectors;
static uint8_t spp3eLastContendedValue = 0xffu;
static uint8_t spp3eLastUlaReadValue = 0xffu;
static uint32_t spp3eAttrColors[2][256][2];
static uint8_t spp3eAttrColorsInitialized;
static uint32_t spp3eBorderFrameStartTact;
static uint32_t spp3eLastRenderedFrameTact;
static uint8_t spp3ePixelByte1;
static uint8_t spp3ePixelByte2;
static uint8_t spp3eAttrByte1;
static uint8_t spp3eAttrByte2;

/*
 * The gate array reads $4000's bitmap at 14,367 (the ZXE wiki's +2A/+3 Floating Bus Test table, from
 * real machines), five T-states after this table fetches it: the fetch delay the border and the CPU's
 * screen writes are taken against (`zx-spectrum-ula.c`). The contention the shared builder writes from
 * the values below is replaced by the gate array's own table (`spp3eBuildGateArrayContention`).
 */
static const Spp3eScreenConfig spp3eUlaConfig = {
  8u, 7u, 48u, 48u, 8u, 192u, 24u, 24u, 128u, 40u, 12u, 2u, 1u,
  {0u, 7u, 6u, 5u, 4u, 3u, 2u, 1u}, 5u
};

/*
 * The DivMMC (`zx-spectrum-divmmc-classic.c`; .plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md C4): the host
 * connects it (`spp3eDivMmcSetPresent`). Its ROM-3 entry points need the 48K BASIC ROM (ROM 3) paged in.
 */
static void spp3eDivMmcRemapped(void);
#define ZXDC_PREFIX spp3e
#define ZXDC_ROM3_PRESENT() (spp3eInSpecialPagingMode == 0u && spp3eSelectedRom == 3u)
#define ZXDC_TACTS spp3eTacts
#define ZXDC_REMAPPED() spp3eDivMmcRemapped()
#include "../../../zxSpectrum/wasm/common/zx-spectrum-divmmc-classic.c"

static uint32_t spp3eRamBankOffset(uint32_t bank) {
  return (bank & 0x07u) * 0x4000u;
}

static uint32_t spp3eRomBankOffset(uint32_t bank) {
  return (bank & 0x03u) * 0x4000u;
}

static void spp3eClearBytes(uint8_t *target, uint32_t length) {
  for (uint32_t i = 0; i < length; i++) {
    target[i] = 0;
  }
}

static void spp3eClearSamples(Spp3eAudioSample *target, uint32_t length) {
  for (uint32_t i = 0; i < length; i++) {
    target[i].left = 0;
    target[i].right = 0;
  }
}

static void spp3eSetRamSlot(uint32_t slot, uint32_t bank) {
  const uint32_t maskedSlot = slot & 0x03u;
  const uint32_t maskedBank = bank & 0x07u;
  spp3eMemorySlotBase[maskedSlot] = &spp3eRam[spp3eRamBankOffset(maskedBank)];
  spp3eMemorySlotWritable[maskedSlot] = 1u;
  spp3eMemorySlotPartition[maskedSlot] = (int32_t)maskedBank;
}

static void spp3eSetRomSlot(uint32_t slot, uint32_t rom) {
  const uint32_t maskedSlot = slot & 0x03u;
  const uint32_t maskedRom = rom & 0x03u;
  spp3eMemorySlotBase[maskedSlot] = &spp3eRom[spp3eRomBankOffset(maskedRom)];
  spp3eMemorySlotWritable[maskedSlot] = 0u;
  spp3eMemorySlotPartition[maskedSlot] = -((int32_t)maskedRom + 1);
}

static void spp3eApplySpecialMemoryConfig(void) {
  const uint8_t mode = spp3eSpecialConfigMode & 0x03u;
  if (mode == 0u) {
    spp3eSetRamSlot(0u, 0u);
    spp3eSetRamSlot(1u, 1u);
    spp3eSetRamSlot(2u, 2u);
    spp3eSetRamSlot(3u, 3u);
  } else if (mode == 1u) {
    spp3eSetRamSlot(0u, 4u);
    spp3eSetRamSlot(1u, 5u);
    spp3eSetRamSlot(2u, 6u);
    spp3eSetRamSlot(3u, 7u);
  } else if (mode == 2u) {
    spp3eSetRamSlot(0u, 4u);
    spp3eSetRamSlot(1u, 5u);
    spp3eSetRamSlot(2u, 6u);
    spp3eSetRamSlot(3u, 3u);
  } else {
    spp3eSetRamSlot(0u, 4u);
    spp3eSetRamSlot(1u, 7u);
    spp3eSetRamSlot(2u, 6u);
    spp3eSetRamSlot(3u, 3u);
  }
}

static void spp3eApplyNormalMemoryConfig(void) {
  spp3eSetRomSlot(0u, spp3eSelectedRom);
  spp3eSetRamSlot(1u, 5u);
  spp3eSetRamSlot(2u, 2u);
  spp3eSetRamSlot(3u, spp3eSelectedBank);
}

/* The DivMMC's ROM-area view while it is mapped (`zxdcView` in zx-spectrum-divmmc-classic.c) */
#define SPP3E_PARTITION_DIVMMC (-5)

static void spp3eRebuildMemorySlotMap(void) {
  if (spp3eInSpecialPagingMode != 0u) {
    spp3eApplySpecialMemoryConfig();
  } else {
    spp3eApplyNormalMemoryConfig();
  }
  if (zxdcMapped != 0u) {
    spp3eMemorySlotBase[0] = zxdcView;
    spp3eMemorySlotWritable[0] = 0u;
    spp3eMemorySlotPartition[0] = SPP3E_PARTITION_DIVMMC;
  }
}

/* The DivMMC mapped in or out, or its banks changed */
static void spp3eDivMmcRemapped(void) {
  spp3eRebuildMemorySlotMap();
  for (uint32_t offset = 0u; offset < 0x4000u; offset++) spp3eMemory[offset] = spp3eMemorySlotBase[0][offset];
}

static void spp3eRebuildFlatMemory(void) {
  spp3eRebuildMemorySlotMap();
  for (uint32_t slot = 0u; slot < 4u; slot++) {
    for (uint32_t offset = 0u; offset < 0x4000u; offset++) {
      spp3eMemory[slot * 0x4000u + offset] = spp3eMemorySlotBase[slot][offset];
    }
  }
}

static inline uint8_t spp3eIsVisibleScreenBankOffset(uint32_t bank, uint32_t offset) {
  const uint32_t visibleBank = spp3eUseShadowScreen != 0u ? 7u : 5u;
  return bank == visibleBank && offset < 0x1b00u;
}

static inline uint8_t spp3eIsVisibleScreenSlotOffset(uint32_t slot, uint32_t offset) {
  if (spp3eMemorySlotWritable[slot] == 0u) {
    return 0u;
  }
  return spp3eIsVisibleScreenBankOffset((uint32_t)spp3eMemorySlotPartition[slot], offset);
}

static void spp3eUpdateVisibleRamBankMirrorByte(uint32_t bank, uint32_t offset, uint8_t value) {
  for (uint32_t slot = 0u; slot < 4u; slot++) {
    if (spp3eMemorySlotWritable[slot] != 0u && spp3eMemorySlotPartition[slot] == (int32_t)bank) {
      spp3eMemory[slot * 0x4000u + offset] = value;
    }
  }
}

static uint8_t spp3eIsContendedMemoryAddress(uint32_t address) {
  const uint32_t page = address & 0xc000u;
  if (spp3eInSpecialPagingMode != 0u) {
    if (page == 0xc000u) {
      return spp3eSpecialConfigMode == 1u ? 1u : 0u;
    }
    return spp3eSpecialConfigMode != 0u ? 1u : 0u;
  }
  return page == 0x4000u || (page == 0xc000u && spp3eSelectedBank >= 4u) ? 1u : 0u;
}

uint32_t spp3eReadMemory(uint32_t address);
void spp3eWriteMemory(uint32_t address, uint32_t value);
uint32_t spp3eReadScreenMemoryOffset(uint32_t offset);
static uint8_t spp3eCpuReadMemory(uint32_t address);
static void spp3eCpuWriteMemory(uint32_t address, uint32_t value);
static void spp3eCpuPokeMemory(uint32_t address, uint32_t value);

#if defined(__clang__) || defined(__GNUC__)
#define SPP3E_CPU_NOINLINE __attribute__((noinline))
#else
#define SPP3E_CPU_NOINLINE
#endif

static void SPP3E_CPU_NOINLINE spp3eApplyContentionDelay(void);
static void SPP3E_CPU_NOINLINE spp3eTactPlusN(uint32_t value);
static void SPP3E_CPU_NOINLINE spp3eDelayMemoryAccess(uint32_t address);
static void SPP3E_CPU_NOINLINE spp3eCpuDelayAddressBusAccess(uint32_t address);
static void SPP3E_CPU_NOINLINE spp3eDelayPortAccess(uint32_t address);
static void spp3eResetAudio(void);
static void spp3eBeginAudioFrame(void);
static void spp3eSetNextAudioSample(void);
static void spp3eResetPsg(void);
static void spp3ePsgAddressWrite(uint32_t value);
static uint32_t spp3ePsgDataRead(void);
static void spp3ePsgDataWrite(uint32_t value);
static void spp3eCommonUpdateTapeMode(void);
uint32_t spp3eCommonTapeGetEarBit(void);
void spp3eCommonTapeClear(void);
static void spp3eFdcReset(void);
static void spp3eFdcSetMotor(uint8_t on);
static void spp3eFdcOnFrameCompleted(void);
static void spp3eBeginMachineFrame(void);
static void spp3eCompleteMachineFrame(void);
static uint32_t spp3eFdcReadMainStatusRegister(void);
static uint32_t spp3eFdcReadDataRegister(void);
static void spp3eFdcWriteDataRegister(uint32_t value);
uint32_t spp3eReadPort(uint32_t address);
void spp3eWritePort(uint32_t address, uint32_t value);

#define SP48_SCREEN_BUFFER_WIDTH_MAX SPP3E_SCREEN_WIDTH
#define SP48_SCREEN_BUFFER_LINES_MAX SPP3E_SCREEN_HEIGHT
#define SP48_PIXEL_BUFFER_GUARD_LINES 0u
#define SP48_TACTS_PER_FRAME_MAX SPP3E_TACTS_PER_FRAME
#define SP48_RENDER_PHASE_NONE SPP3E_RENDER_PHASE_NONE
#define SP48_RENDER_PHASE_BORDER SPP3E_RENDER_PHASE_BORDER
#define SP48_RENDER_PHASE_BORDER_FETCH_PIXEL SPP3E_RENDER_PHASE_BORDER_FETCH_PIXEL
#define SP48_RENDER_PHASE_BORDER_FETCH_ATTR SPP3E_RENDER_PHASE_BORDER_FETCH_ATTR
#define SP48_RENDER_PHASE_DISPLAY_B1 SPP3E_RENDER_PHASE_DISPLAY_B1
#define SP48_RENDER_PHASE_DISPLAY_B2 SPP3E_RENDER_PHASE_DISPLAY_B2
#define SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2 SPP3E_RENDER_PHASE_DISPLAY_B1_FETCH_B2
#define SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2 SPP3E_RENDER_PHASE_DISPLAY_B1_FETCH_A2
#define SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1 SPP3E_RENDER_PHASE_DISPLAY_B2_FETCH_B1
#define SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1 SPP3E_RENDER_PHASE_DISPLAY_B2_FETCH_A1
#define Sp48ScreenConfig Spp3eScreenConfig
#define sp48PalConfig spp3eUlaPalConfig
#define sp48NtscConfig spp3eUlaNtscConfig
#define sp48SpectrumColors spp3eUlaSpectrumColors
#define sp48TimingScreenWidth spp3eTimingScreenWidth
#define sp48TimingScreenLines spp3eTimingScreenLines
#define sp48TactsInFrame spp3eTactsInFrame
#define sp48RasterLines spp3eRasterLines
#define sp48ScreenLineTime spp3eScreenLineTime
#define sp48FirstDisplayLine spp3eFirstDisplayLine
#define sp48FirstVisibleLine spp3eFirstVisibleLine
#define sp48FirstVisibleBorderTact spp3eFirstVisibleBorderTact
#define sp48DisplayLeftPixel spp3eDisplayLeftPixel
#define sp48DisplayTopLine spp3eDisplayTopLine
#define sp48Tacts spp3eTacts
#define sp48Frames spp3eFrames
#define sp48NextFrameStartTact spp3eNextFrameStartTact
#define sp48ClockMultiplier spp3eClockMultiplier
#define sp48Contention spp3eContention
#define sp48RenderingPhase spp3eRenderingPhase
#define sp48RenderingPixelAddress spp3eRenderingPixelAddress
#define sp48RenderingAttributeAddress spp3eRenderingAttributeAddress
#define sp48RenderingPixelIndex spp3eRenderingPixelIndex
#define sp48AttrColors spp3eAttrColors
#define sp48AttrColorsInitialized spp3eAttrColorsInitialized
#define sp48TotalContentionDelaySinceStart spp3eTotalContentionDelaySinceStart
#define sp48ContentionDelaySincePause spp3eContentionDelaySincePause
#define sp48BorderFrameStartTact spp3eBorderFrameStartTact
#define sp48LastRenderedFrameTact spp3eLastRenderedFrameTact
#define sp48PixelByte1 spp3ePixelByte1
#define sp48PixelByte2 spp3ePixelByte2
#define sp48AttrByte1 spp3eAttrByte1
#define sp48AttrByte2 spp3eAttrByte2
#define sp48BorderColor spp3eBorderColor
#define sp48PixelBuffer spp3ePixelBuffer
#define currentScreenWidth spp3eUlaCurrentScreenWidth
#define currentScreenHeight spp3eUlaCurrentScreenHeight
#define pixelBufferWordCount spp3eUlaPixelBufferWordCount
#define pixelBufferStartOffset spp3eUlaPixelBufferStartOffset
#define getBorderPixel spp3eUlaGetBorderPixel
#define flashFlag spp3eUlaFlashFlag
#define initializeAttrColorTables spp3eUlaInitializeAttrColorTables
#define getUlaPixelColor spp3eUlaGetPixelColor
#define currentFrameTact spp3eUlaCurrentFrameTact
#define calcPixelAddress spp3eUlaCalcPixelAddress
#define calcAttrAddress spp3eUlaCalcAttrAddress
#define calculateTimingBufferIndex spp3eUlaCalculateTimingBufferIndex
#define clearTimingTables spp3eUlaClearTimingTables
#define setRenderingTact spp3eUlaSetRenderingTact
#define initializeTimingTables spp3eUlaInitializeTimingTables
#define applyContentionDelay spp3eUlaApplyContentionDelay
#define isContendedIoAddress spp3eUlaIsContendedIoAddress
#define shouldRaiseInterrupt spp3eUlaShouldRaiseInterrupt
#define beginBorderFrame spp3eUlaBeginBorderFrame
#define renderBorderPixelsAt spp3eUlaRenderBorderPixelsAt
#define renderByte1PixelsAt spp3eUlaRenderByte1PixelsAt
#define renderByte2PixelsAt spp3eUlaRenderByte2PixelsAt
#define renderUlaTact spp3eUlaRenderTact
#define renderUlaUntilCurrentTact spp3eUlaRenderUntilCurrentTact
#define renderUlaDisplay spp3eUlaRenderDisplay
#define sp48ReadFloatingBus spp3eUlaReadFloatingBus
#define readScreenMemoryOffset spp3eReadScreenMemoryOffset
#define setNextAudioSample spp3eSetNextAudioSample
#include "../../../zxSpectrum/wasm/common/zx-spectrum-ula.c"
#undef setNextAudioSample
#undef readScreenMemoryOffset
#undef sp48ReadFloatingBus
#undef renderUlaDisplay
#undef renderUlaUntilCurrentTact
#undef renderUlaTact
#undef renderByte2PixelsAt
#undef renderByte1PixelsAt
#undef renderBorderPixelsAt
#undef beginBorderFrame
#undef shouldRaiseInterrupt
#undef isContendedIoAddress
#undef applyContentionDelay
#undef initializeTimingTables
#undef setRenderingTact
#undef clearTimingTables
#undef calculateTimingBufferIndex
#undef calcAttrAddress
#undef calcPixelAddress
#undef currentFrameTact
#undef getUlaPixelColor
#undef initializeAttrColorTables
#undef flashFlag
#undef getBorderPixel
#undef pixelBufferStartOffset
#undef pixelBufferWordCount
#undef currentScreenHeight
#undef currentScreenWidth
#undef sp48PixelBuffer
#undef sp48BorderColor
#undef sp48AttrByte2
#undef sp48AttrByte1
#undef sp48PixelByte2
#undef sp48PixelByte1
#undef sp48LastRenderedFrameTact
#undef sp48BorderFrameStartTact
#undef sp48ContentionDelaySincePause
#undef sp48TotalContentionDelaySinceStart
#undef sp48AttrColorsInitialized
#undef sp48AttrColors
#undef sp48RenderingPixelIndex
#undef sp48RenderingAttributeAddress
#undef sp48RenderingPixelAddress
#undef sp48RenderingPhase
#undef sp48Contention
#undef sp48ClockMultiplier
#undef sp48NextFrameStartTact
#undef sp48Frames
#undef sp48Tacts
#undef sp48DisplayTopLine
#undef sp48DisplayLeftPixel
#undef sp48FirstVisibleBorderTact
#undef sp48FirstVisibleLine
#undef sp48FirstDisplayLine
#undef sp48ScreenLineTime
#undef sp48RasterLines
#undef sp48TactsInFrame
#undef sp48TimingScreenLines
#undef sp48TimingScreenWidth
#undef sp48SpectrumColors
#undef sp48NtscConfig
#undef sp48PalConfig
#undef Sp48ScreenConfig
#undef SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1
#undef SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1
#undef SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2
#undef SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2
#undef SP48_RENDER_PHASE_DISPLAY_B2
#undef SP48_RENDER_PHASE_DISPLAY_B1
#undef SP48_RENDER_PHASE_BORDER_FETCH_ATTR
#undef SP48_RENDER_PHASE_BORDER_FETCH_PIXEL
#undef SP48_RENDER_PHASE_BORDER
#undef SP48_RENDER_PHASE_NONE
#undef SP48_TACTS_PER_FRAME_MAX
#undef SP48_PIXEL_BUFFER_GUARD_LINES
#undef SP48_SCREEN_BUFFER_LINES_MAX
#undef SP48_SCREEN_BUFFER_WIDTH_MAX

#define sp48KeyboardLines spp3eKeyboardLines
#define sp48KeyboardSelectedLineValue spp3eKeyboardSelectedLineValue
#define resetKeyboard spp3eResetKeyboard
#define sp48SetKeyStatus spp3eSetKeyStatus
#define sp48GetKeyboardLine spp3eGetKeyboardLine
#include "../../../zxSpectrum/wasm/common/zx-spectrum-keyboard.c"
#undef sp48GetKeyboardLine
#undef sp48SetKeyStatus
#undef resetKeyboard
#undef sp48KeyboardSelectedLineValue
#undef sp48KeyboardLines

#define sp128Tacts spp3eTacts
#include "../../../zxSpectrum/wasm/common/zx-spectrum-psg.c"
#undef sp128Tacts

#define SP48_DEFAULT_SAMPLE_RATE SPP3E_DEFAULT_SAMPLE_RATE
#define SP48_AUDIO_SAMPLE_CAPACITY SPP3E_AUDIO_SAMPLE_CAPACITY
#define SP48_AUDIO_TRANSITION_CAPACITY SPP3E_AUDIO_TRANSITION_CAPACITY
#define SP48_AUDIO_SAMPLE_SCALE 32767.0
#define SP48_TAPE_MODE_LOAD SPP3E_TAPE_MODE_LOAD
#define SP48_AUDIO_BEFORE_SAMPLE(sampleEndTact) sp128PsgPrepareAudioSample(sampleEndTact)
#define SP48_AUDIO_EXTRA_LEFT() sp128PsgAudioLevel()
#define SP48_AUDIO_EXTRA_RIGHT() sp128PsgAudioLevel()
#define sp48TapeMode spp3eTapeMode
#define sp48TapeEarBit spp3eTapeEarBit
#define sp48EarBit spp3eEarBit
#define sp48MicBit spp3eMicBit
#define sp48AudioAccumulatedEar spp3eAudioAccumulatedEar
#define sp48AudioAccumulatedMic spp3eAudioAccumulatedMic
#define sp48AudioAccumulatedTacts spp3eAudioAccumulatedTacts
#define sp48AudioLastLevelChangeTact spp3eAudioLastLevelChangeTact
#define sp48AudioSampleWindowStartTact spp3eAudioSampleWindowStartTact
#define sp48AudioSampleWindowStartEar spp3eAudioSampleWindowStartEar
#define sp48AudioSampleWindowStartMic spp3eAudioSampleWindowStartMic
#define sp48AudioTransitionCount spp3eAudioTransitionCount
#define sp48AudioTransitionTacts spp3eAudioTransitionTacts
#define sp48AudioTransitionEar spp3eAudioTransitionEar
#define sp48AudioTransitionMic spp3eAudioTransitionMic
#define sp48Tacts spp3eTacts
#define sp48AudioSampleCount spp3eAudioSampleCount
#define sp48AudioSampleLength spp3eAudioSampleLength
#define sp48AudioSampleRate spp3eAudioSampleRate
#define sp48BaseClockFrequency SPP3E_BASE_CLOCK_FREQUENCY
#define sp48AudioNextSampleTact spp3eAudioNextSampleTact
#define sp48AudioNextSampleTactFloor spp3eAudioNextSampleTactFloor
#define sp48ClockMultiplier spp3eClockMultiplier
#define sp48DcFilterPrevInputLeft spp3eDcFilterPrevInputLeft
#define sp48DcFilterPrevInputRight spp3eDcFilterPrevInputRight
#define sp48DcFilterPrevOutputLeft spp3eDcFilterPrevOutputLeft
#define sp48DcFilterPrevOutputRight spp3eDcFilterPrevOutputRight
#define sp48AudioSamples spp3eAudioSamples
#define sp48DiagnosticFlags spp3eDiagnosticFlags
#define clampAudioWord spp3eCommonClampAudioWord
#define effectiveAudioEarBit spp3eCommonEffectiveAudioEarBit
#define resetAudioAccumulator spp3eCommonResetAudioAccumulator
#define resetAudio spp3eCommonResetAudio
#define beginAudioFrame spp3eCommonBeginAudioFrame
#define recordAudioTransition spp3eCommonRecordAudioTransition
#define setNextAudioSample spp3eCommonSetNextAudioSample
#define sp48SetAudioSampleRate spp3eCommonSetAudioSampleRate
#include "../../../zxSpectrum/wasm/common/zx-spectrum-beeper.c"
#undef sp48SetAudioSampleRate
#undef setNextAudioSample
#undef recordAudioTransition
#undef beginAudioFrame
#undef resetAudio
#undef resetAudioAccumulator
#undef effectiveAudioEarBit
#undef clampAudioWord
#undef sp48DiagnosticFlags
#undef sp48AudioSamples
#undef sp48DcFilterPrevOutputRight
#undef sp48DcFilterPrevOutputLeft
#undef sp48DcFilterPrevInputRight
#undef sp48DcFilterPrevInputLeft
#undef sp48ClockMultiplier
#undef sp48AudioNextSampleTactFloor
#undef sp48AudioNextSampleTact
#undef sp48BaseClockFrequency
#undef sp48AudioSampleRate
#undef sp48AudioSampleLength
#undef sp48AudioSampleCount
#undef sp48Tacts
#undef sp48AudioTransitionMic
#undef sp48AudioTransitionEar
#undef sp48AudioTransitionTacts
#undef sp48AudioTransitionCount
#undef sp48AudioSampleWindowStartMic
#undef sp48AudioSampleWindowStartEar
#undef sp48AudioSampleWindowStartTact
#undef sp48AudioLastLevelChangeTact
#undef sp48AudioAccumulatedTacts
#undef sp48AudioAccumulatedMic
#undef sp48AudioAccumulatedEar
#undef sp48MicBit
#undef sp48EarBit
#undef sp48TapeEarBit
#undef sp48TapeMode
#undef SP48_AUDIO_EXTRA_RIGHT
#undef SP48_AUDIO_EXTRA_LEFT
#undef SP48_AUDIO_BEFORE_SAMPLE
#undef SP48_TAPE_MODE_LOAD
#undef SP48_AUDIO_SAMPLE_SCALE
#undef SP48_AUDIO_SAMPLE_CAPACITY
#undef SP48_AUDIO_TRANSITION_CAPACITY
#undef SP48_DEFAULT_SAMPLE_RATE

/* The DivMMC's entry points, its delayed mapping and RETN */
#define Z80_BEFORE_OPCODE_FETCH() ZXDC_BEFORE_OPCODE_FETCH(cpu.pc)
#define Z80_AFTER_OPCODE_FETCH() ZXDC_AFTER_OPCODE_FETCH()
#define Z80_AFTER_RETN() ZXDC_AFTER_RETN(cpu.opCode)
#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() spp3eMemory
#define Z80_READ_MEMORY(address) spp3eCpuReadMemory((uint32_t)(address))
#define Z80_WRITE_MEMORY(address, value) spp3eCpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_POKE_MEMORY(address, value) spp3eCpuPokeMemory((uint32_t)(address), (uint32_t)(value))
/* Every port read the CPU makes; the RZX tap sits in this wrapper, not in the export (D7) */
static uint32_t spp3eCpuReadPort(uint32_t address);
#define Z80_READ_PORT(address) ((uint8_t)spp3eCpuReadPort((uint32_t)(address)))
#define Z80_WRITE_PORT(address, value) spp3eWritePort((uint32_t)(address), (uint32_t)(value))
#define Z80_CAPTURE_BUS_EVENTS() spp3eCaptureBusEvents
/* The log is written only while capturing (debug runs): out of line, so it does not grow every opcode (z80.c) */
#define Z80_ACCESS_LOG_NOINLINE 1
#define Z80_TACT_PLUS_N(value) spp3eTactPlusN((uint32_t)(value))
#define Z80_DELAY_MEMORY_READ(address) spp3eDelayMemoryAccess((uint32_t)(address))
#define Z80_DELAY_MEMORY_WRITE(address) spp3eDelayMemoryAccess((uint32_t)(address))
#define Z80_DELAY_ADDRESS_BUS_ACCESS(address) spp3eCpuDelayAddressBusAccess((uint32_t)(address))
#define Z80_DELAY_PORT_READ(address) spp3eDelayPortAccess((uint32_t)(address))
#define Z80_DELAY_PORT_WRITE(address) spp3eDelayPortAccess((uint32_t)(address))
/* RZX (`zx-spectrum-rzx.c`): the fetch counter counts every refresh but the INT acknowledge's */
static inline void rzxCountFetch(void);
static inline void rzxIntAck(void);
/* Not under the benchmark-only strip (`z80.c`): no RZX recording, so no fetch count */
#ifndef Z80_BENCH_STRIP_DEBUG
#define Z80_REFRESH(address) rzxCountFetch()
#define Z80_INT_ACK() rzxIntAck()
#endif
/* The execution-history recorder's hooks; the recorder and this machine's macros for it are at the
   end of this file (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` Phase 3) */
#include "../../../../z80/wasm/z80-history.h"
/* The access profile's hooks; the module and this machine's mapping for it are at the end of this
   file (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` Phase 2) */
#include "../../../../z80/wasm/z80-profile.h"
#include "../../../../z80/wasm/z80.c"
/* The CPU's registers and debugger state, exported as `spp3eGetCpuAf` ... (WASM_CORE_LEAN_AND_DEBUG_PLAN D8) */
#define Z80_EXPORT_PREFIX spp3e
#include "../../../../z80/wasm/z80-cpu-exports.c"
#undef Z80_REFRESH
#undef Z80_INT_ACK
#define RZX_CORE_PREFIX spp3e
#include "../../../zxSpectrum/wasm/common/zx-spectrum-rzx.c"

static uint32_t spp3eCpuReadPort(uint32_t address) {
#ifdef Z80_BENCH_STRIP_DEBUG
  return spp3eReadPort(address);
#endif
  if (rzxMode == RZX_MODE_OFF) return spp3eReadPort(address);
  uint32_t value;
  if (rzxMode == RZX_MODE_PLAY && rzxPlayNextIn(&value) != 0u) return value;
  value = spp3eReadPort(address);
  if (rzxMode == RZX_MODE_RECORD) rzxRecordIn(value);
  return value;
}
#undef Z80_EXTERNAL_BUS
#undef Z80_MEMORY_PTR
#undef Z80_READ_MEMORY
#undef Z80_WRITE_MEMORY
#undef Z80_POKE_MEMORY
#undef Z80_READ_PORT
#undef Z80_WRITE_PORT
#undef Z80_CAPTURE_BUS_EVENTS
#undef Z80_TACT_PLUS_N
#undef Z80_DELAY_MEMORY_READ
#undef Z80_DELAY_MEMORY_WRITE
#undef Z80_DELAY_ADDRESS_BUS_ACCESS
#undef Z80_DELAY_PORT_READ
#undef Z80_DELAY_PORT_WRITE

#define SP48_TAPE_MAX_BLOCKS SPP3E_TAPE_MAX_BLOCKS
#define SP48_TAPE_DATA_CAPACITY SPP3E_TAPE_DATA_CAPACITY
#define SP48_TAPE_FILENAME_CAPACITY SPP3E_TAPE_FILENAME_CAPACITY
#define SP48_TAPE_SAVE_MAX_BLOCKS SPP3E_TAPE_SAVE_MAX_BLOCKS
#define SP48_TAPE_SAVE_DATA_CAPACITY SPP3E_TAPE_SAVE_DATA_CAPACITY
#define SP48_TAPE_HEADER_PILOT_COUNT SPP3E_TAPE_HEADER_PILOT_COUNT
#define SP48_TAPE_DATA_PILOT_COUNT SPP3E_TAPE_DATA_PILOT_COUNT
#define SP48_TAPE_MIN_SAVE_PILOT_PULSE_COUNT SPP3E_TAPE_MIN_SAVE_PILOT_PULSE_COUNT
#define SP48_TAPE_SAVE_PULSE_TOLERANCE SPP3E_TAPE_SAVE_PULSE_TOLERANCE
#define SP48_TAPE_TOO_LONG_SAVE_PAUSE SPP3E_TAPE_TOO_LONG_SAVE_PAUSE
#define SP48_TAPE_PILOT_PULSE_LENGTH SPP3E_TAPE_PILOT_PULSE_LENGTH
#define SP48_TAPE_SYNC1_PULSE_LENGTH SPP3E_TAPE_SYNC1_PULSE_LENGTH
#define SP48_TAPE_SYNC2_PULSE_LENGTH SPP3E_TAPE_SYNC2_PULSE_LENGTH
#define SP48_TAPE_BIT0_PULSE_LENGTH SPP3E_TAPE_BIT0_PULSE_LENGTH
#define SP48_TAPE_BIT1_PULSE_LENGTH SPP3E_TAPE_BIT1_PULSE_LENGTH
#define SP48_TAPE_TERM_SYNC_PULSE_LENGTH SPP3E_TAPE_TERM_SYNC_PULSE_LENGTH
#define SP48_TAPE_LOAD_BYTES_ROUTINE SPP3E_TAPE_LOAD_BYTES_ROUTINE
#define SP48_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE SPP3E_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE
#define SP48_TAPE_LOAD_BYTES_RESUME_ROUTINE SPP3E_TAPE_LOAD_BYTES_RESUME_ROUTINE
#define SP48_TAPE_SAVE_BYTES_ROUTINE SPP3E_TAPE_SAVE_BYTES_ROUTINE
#define SP48_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW SPP3E_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW
#define SP48_DIAGNOSTIC_TAPE_DATA_OVERFLOW SPP3E_DIAGNOSTIC_TAPE_DATA_OVERFLOW
#define SP48_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE SPP3E_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE
#define SP48_DIAGNOSTIC_TAPE_SAVE_DATA_OVERFLOW SPP3E_DIAGNOSTIC_TAPE_SAVE_DATA_OVERFLOW
#define SP48_DIAGNOSTIC_TAPE_SAVE_BLOCK_OVERFLOW SPP3E_DIAGNOSTIC_TAPE_SAVE_BLOCK_OVERFLOW
#define SP48_DIAGNOSTIC_TAPE_SAVE_MALFORMED_PULSE SPP3E_DIAGNOSTIC_TAPE_SAVE_MALFORMED_PULSE
#define SP48_TAPE_MODE_PASSIVE SPP3E_TAPE_MODE_PASSIVE
#define SP48_TAPE_MODE_LOAD SPP3E_TAPE_MODE_LOAD
#define SP48_TAPE_MODE_SAVE SPP3E_TAPE_MODE_SAVE
#define SP48_TAPE_PHASE_NONE SPP3E_TAPE_PHASE_NONE
#define SP48_TAPE_PHASE_PILOT SPP3E_TAPE_PHASE_PILOT
#define SP48_TAPE_PHASE_SYNC SPP3E_TAPE_PHASE_SYNC
#define SP48_TAPE_PHASE_DATA SPP3E_TAPE_PHASE_DATA
#define SP48_TAPE_PHASE_TERM_SYNC SPP3E_TAPE_PHASE_TERM_SYNC
#define SP48_TAPE_PHASE_PAUSE SPP3E_TAPE_PHASE_PAUSE
#define SP48_TAPE_PHASE_COMPLETED SPP3E_TAPE_PHASE_COMPLETED
#define SP48_TAPE_SAVE_PHASE_NONE SPP3E_TAPE_SAVE_PHASE_NONE
#define SP48_TAPE_SAVE_PHASE_PILOT SPP3E_TAPE_SAVE_PHASE_PILOT
#define SP48_TAPE_SAVE_PHASE_SYNC1 SPP3E_TAPE_SAVE_PHASE_SYNC1
#define SP48_TAPE_SAVE_PHASE_SYNC2 SPP3E_TAPE_SAVE_PHASE_SYNC2
#define SP48_TAPE_SAVE_PHASE_DATA SPP3E_TAPE_SAVE_PHASE_DATA
#define SP48_TAPE_SAVE_PHASE_ERROR SPP3E_TAPE_SAVE_PHASE_ERROR
#define SP48_TAPE_MIC_PULSE_NONE SPP3E_TAPE_MIC_PULSE_NONE
#define SP48_TAPE_MIC_PULSE_TOO_SHORT SPP3E_TAPE_MIC_PULSE_TOO_SHORT
#define SP48_TAPE_MIC_PULSE_TOO_LONG SPP3E_TAPE_MIC_PULSE_TOO_LONG
#define SP48_TAPE_MIC_PULSE_PILOT SPP3E_TAPE_MIC_PULSE_PILOT
#define SP48_TAPE_MIC_PULSE_SYNC1 SPP3E_TAPE_MIC_PULSE_SYNC1
#define SP48_TAPE_MIC_PULSE_SYNC2 SPP3E_TAPE_MIC_PULSE_SYNC2
#define SP48_TAPE_MIC_PULSE_BIT0 SPP3E_TAPE_MIC_PULSE_BIT0
#define SP48_TAPE_MIC_PULSE_BIT1 SPP3E_TAPE_MIC_PULSE_BIT1
#define SP48_TAPE_MIC_PULSE_TERM_SYNC SPP3E_TAPE_MIC_PULSE_TERM_SYNC
#define Sp48TapeBlock Spp3eTapeBlock
#define Sp48SavedTapeBlock Spp3eTapeBlock
#define sp48TapeBlocks spp3eTapeBlocks
#define sp48SavedTapeBlocks spp3eTapeSaveBlocks
#define sp48TapeData spp3eTapeData
#define sp48TapeFileName spp3eTapeFileName
#define sp48TapeSaveData spp3eTapeSaveData
#define sp48DiagnosticFlags spp3eDiagnosticFlags
#define sp48BeeperLevel spp3eBeeperLevel
#define sp48MicBit spp3eMicBit
#define sp48Tacts spp3eTacts
#define sp48BaseClockFrequency SPP3E_BASE_CLOCK_FREQUENCY
#define sp48TapeBlockCount spp3eTapeBlockCount
#define sp48TapeDataLength spp3eTapeDataLength
#define sp48TapeCurrentBlockIndex spp3eTapeCurrentBlockIndex
#define sp48TapeUploadBlockCount spp3eTapeUploadBlockCount
#define sp48TapeUploadDataLength spp3eTapeUploadDataLength
#define sp48TapeUploadActive spp3eTapeUploadActive
#define sp48TapeLoaded spp3eTapeLoaded
#define sp48TapeEof spp3eTapeEof
#define sp48TapeMode spp3eTapeMode
#define sp48TapePlayPhase spp3eTapePlayPhase
#define sp48TapeStartTact spp3eTapeStartTact
#define sp48TapePilotEndPos spp3eTapePilotEndPos
#define sp48TapeSync1EndPos spp3eTapeSync1EndPos
#define sp48TapeSync2EndPos spp3eTapeSync2EndPos
#define sp48TapeBitStartPos spp3eTapeBitStartPos
#define sp48TapeBitPulseLength spp3eTapeBitPulseLength
#define sp48TapeDataIndex spp3eTapeDataIndex
#define sp48TapeBitMask spp3eTapeBitMask
#define sp48TapeTermEndPos spp3eTapeTermEndPos
#define sp48TapePauseEndPos spp3eTapePauseEndPos
#define sp48TapeEarBit spp3eTapeEarBit
#define sp48TapeFastLoad spp3eTapeFastLoad
#define sp48TapeModeChangeCount spp3eTapeModeChangeCount
#define sp48TapeLastModeChangeTact spp3eTapeLastModeChangeTact
#define sp48TapeLastModeChangePc spp3eTapeLastModeChangePc
#define sp48TapeLoadStartCount spp3eTapeLoadStartCount
#define sp48TapeSaveStartCount spp3eTapeSaveStartCount
#define sp48TapeSaveMicBit spp3eTapeSaveMicBit
#define sp48TapeSavePhase spp3eTapeSavePhase
#define sp48TapeSavePreviousDataPulse spp3eTapeSavePreviousDataPulse
#define sp48TapeSaveLastPulse spp3eTapeSaveLastPulse
#define sp48TapeSaveBitOffset spp3eTapeSaveBitOffset
#define sp48TapeSaveDataByte spp3eTapeSaveDataByte
#define sp48TapeSaveLastMicBitTact spp3eTapeSaveLastMicBitTact
#define sp48TapeSavePilotPulseCount spp3eTapeSavePilotPulseCount
#define sp48TapeSavedBlockCount spp3eTapeSavedBlockCount
#define sp48TapeSavedDataLength spp3eTapeSavedDataLength
#define sp48TapeSavedRevision spp3eTapeSavedRevision
#define sp48TapeSaveCurrentBlockOffset spp3eTapeSaveCurrentBlockOffset
#define sp48TapeSaveCurrentBlockLength spp3eTapeSaveCurrentBlockLength
#define sp48CpuReadMemory spp3eCpuReadMemory
#define sp48CpuWriteMemory spp3eCpuWriteMemory
#define recordAudioTransition spp3eCommonRecordAudioTransition
#define clearTapeFileName spp3eCommonClearTapeFileName
#define clearTapeBlocks spp3eCommonClearTapeBlocks
#define sp48TapeGetEarBitInternal spp3eCommonTapeGetEarBitInternal
#define setTapeEarBit spp3eCommonSetTapeEarBit
#define sp48TapeProcessMicBit spp3eCommonTapeProcessMicBit
#define sp48TapeClearSavedBlocks spp3eCommonTapeClearSavedBlocks
#define resetTapeSaveCapture spp3eCommonResetTapeSaveCapture
#define beginTapeSaveCapture spp3eCommonBeginTapeSaveCapture
#define resetTapePlayback spp3eCommonResetTapePlayback
#define sp48TapeClear spp3eCommonTapeClear
#define sp48TapeClassifySavePulse spp3eCommonTapeClassifySavePulse
#define sp48TapeSetFileNameByte spp3eCommonTapeSetFileNameByte
#define sp48TapeBeginUpload spp3eCommonTapeBeginUpload
#define sp48TapeSetBlock spp3eCommonTapeSetBlock
#define sp48TapeWriteData spp3eCommonTapeWriteData
#define sp48TapeFinishUpload spp3eCommonTapeFinishUpload
#define sp48TapeRewind spp3eCommonTapeRewind
#define tapeBlockPilotPulseCount spp3eCommonTapeBlockPilotPulseCount
#define tapeBlockPauseTacts spp3eCommonTapeBlockPauseTacts
#define currentTapeBlockAvailable spp3eCommonCurrentTapeBlockAvailable
#define currentTapeBlock spp3eCommonCurrentTapeBlock
#define setTapeModeInternal spp3eCommonSetTapeModeInternal
#define nextTapeBlock spp3eCommonNextTapeBlock
#define completeFastLoadBlock spp3eCommonCompleteFastLoadBlock
#define fastLoadCurrentTapeBlock spp3eCommonFastLoadCurrentTapeBlock
#define sp48TapeSetMode spp3eCommonTapeSetMode
#define sp48TapeSetFastLoad spp3eCommonTapeSetFastLoad
#define sp48TapeGetFastLoad spp3eCommonTapeGetFastLoad
#define updateTapeMode spp3eCommonUpdateTapeMode
#define sp48TapeGetEarBit spp3eCommonTapeGetEarBit
#define sp48TapeGetMaxBlocks spp3eCommonTapeGetMaxBlocks
#define sp48TapeGetDataCapacity spp3eCommonTapeGetDataCapacity
#define sp48TapeDataPtr spp3eCommonTapeDataPtr
/* The fast-load trap writes RAM without an IN, so it is off while RZX plays or records (trap 3) */
#define SP48_TAPE_FAST_LOAD_BLOCKED() (rzxMode != RZX_MODE_OFF)
#include "../../../zxSpectrum/wasm/common/zx-spectrum-tape.c"
#undef SP48_TAPE_FAST_LOAD_BLOCKED
#undef sp48TapeDataPtr
#undef sp48TapeGetDataCapacity
#undef sp48TapeGetMaxBlocks
#undef sp48TapeGetEarBit
#undef updateTapeMode
#undef sp48TapeGetFastLoad
#undef sp48TapeSetFastLoad
#undef sp48TapeSetMode
#undef fastLoadCurrentTapeBlock
#undef completeFastLoadBlock
#undef nextTapeBlock
#undef setTapeModeInternal
#undef currentTapeBlock
#undef currentTapeBlockAvailable
#undef tapeBlockPauseTacts
#undef tapeBlockPilotPulseCount
#undef sp48TapeRewind
#undef sp48TapeFinishUpload
#undef sp48TapeWriteData
#undef sp48TapeSetBlock
#undef sp48TapeBeginUpload
#undef sp48TapeSetFileNameByte
#undef sp48TapeClassifySavePulse
#undef sp48TapeClear
#undef resetTapePlayback
#undef beginTapeSaveCapture
#undef resetTapeSaveCapture
#undef sp48TapeClearSavedBlocks
#undef sp48TapeProcessMicBit
#undef setTapeEarBit
#undef sp48TapeGetEarBitInternal
#undef clearTapeBlocks
#undef clearTapeFileName
#undef recordAudioTransition
#undef sp48CpuWriteMemory
#undef sp48CpuReadMemory
#undef sp48TapeSaveCurrentBlockLength
#undef sp48TapeSaveCurrentBlockOffset
#undef sp48TapeSavedRevision
#undef sp48TapeSavedDataLength
#undef sp48TapeSavedBlockCount
#undef sp48TapeSavePilotPulseCount
#undef sp48TapeSaveLastMicBitTact
#undef sp48TapeSaveDataByte
#undef sp48TapeSaveBitOffset
#undef sp48TapeSaveLastPulse
#undef sp48TapeSavePreviousDataPulse
#undef sp48TapeSavePhase
#undef sp48TapeSaveMicBit
#undef sp48TapeSaveStartCount
#undef sp48TapeLoadStartCount
#undef sp48TapeLastModeChangePc
#undef sp48TapeLastModeChangeTact
#undef sp48TapeModeChangeCount
#undef sp48TapeFastLoad
#undef sp48TapeEarBit
#undef sp48TapePauseEndPos
#undef sp48TapeTermEndPos
#undef sp48TapeBitMask
#undef sp48TapeDataIndex
#undef sp48TapeBitPulseLength
#undef sp48TapeBitStartPos
#undef sp48TapeSync2EndPos
#undef sp48TapeSync1EndPos
#undef sp48TapePilotEndPos
#undef sp48TapeStartTact
#undef sp48TapePlayPhase
#undef sp48TapeMode
#undef sp48TapeEof
#undef sp48TapeLoaded
#undef sp48TapeUploadActive
#undef sp48TapeUploadDataLength
#undef sp48TapeUploadBlockCount
#undef sp48TapeCurrentBlockIndex
#undef sp48TapeDataLength
#undef sp48TapeBlockCount
#undef sp48BaseClockFrequency
#undef sp48Tacts
#undef sp48MicBit
#undef sp48BeeperLevel
#undef sp48DiagnosticFlags
#undef sp48TapeSaveData
#undef sp48TapeFileName
#undef sp48TapeData
#undef sp48SavedTapeBlocks
#undef sp48TapeBlocks
#undef Sp48SavedTapeBlock
#undef Sp48TapeBlock
#undef SP48_TAPE_MIC_PULSE_TERM_SYNC
#undef SP48_TAPE_MIC_PULSE_BIT1
#undef SP48_TAPE_MIC_PULSE_BIT0
#undef SP48_TAPE_MIC_PULSE_SYNC2
#undef SP48_TAPE_MIC_PULSE_SYNC1
#undef SP48_TAPE_MIC_PULSE_PILOT
#undef SP48_TAPE_MIC_PULSE_TOO_LONG
#undef SP48_TAPE_MIC_PULSE_TOO_SHORT
#undef SP48_TAPE_MIC_PULSE_NONE
#undef SP48_TAPE_SAVE_PHASE_ERROR
#undef SP48_TAPE_SAVE_PHASE_DATA
#undef SP48_TAPE_SAVE_PHASE_SYNC2
#undef SP48_TAPE_SAVE_PHASE_SYNC1
#undef SP48_TAPE_SAVE_PHASE_PILOT
#undef SP48_TAPE_SAVE_PHASE_NONE
#undef SP48_TAPE_PHASE_COMPLETED
#undef SP48_TAPE_PHASE_PAUSE
#undef SP48_TAPE_PHASE_TERM_SYNC
#undef SP48_TAPE_PHASE_DATA
#undef SP48_TAPE_PHASE_SYNC
#undef SP48_TAPE_PHASE_PILOT
#undef SP48_TAPE_PHASE_NONE
#undef SP48_TAPE_MODE_SAVE
#undef SP48_TAPE_MODE_LOAD
#undef SP48_TAPE_MODE_PASSIVE
#undef SP48_DIAGNOSTIC_TAPE_SAVE_MALFORMED_PULSE
#undef SP48_DIAGNOSTIC_TAPE_SAVE_BLOCK_OVERFLOW
#undef SP48_DIAGNOSTIC_TAPE_SAVE_DATA_OVERFLOW
#undef SP48_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE
#undef SP48_DIAGNOSTIC_TAPE_DATA_OVERFLOW
#undef SP48_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW
#undef SP48_TAPE_SAVE_BYTES_ROUTINE
#undef SP48_TAPE_LOAD_BYTES_RESUME_ROUTINE
#undef SP48_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE
#undef SP48_TAPE_LOAD_BYTES_ROUTINE
#undef SP48_TAPE_TERM_SYNC_PULSE_LENGTH
#undef SP48_TAPE_BIT1_PULSE_LENGTH
#undef SP48_TAPE_BIT0_PULSE_LENGTH
#undef SP48_TAPE_SYNC2_PULSE_LENGTH
#undef SP48_TAPE_SYNC1_PULSE_LENGTH
#undef SP48_TAPE_PILOT_PULSE_LENGTH
#undef SP48_TAPE_TOO_LONG_SAVE_PAUSE
#undef SP48_TAPE_SAVE_PULSE_TOLERANCE
#undef SP48_TAPE_MIN_SAVE_PILOT_PULSE_COUNT
#undef SP48_TAPE_DATA_PILOT_COUNT
#undef SP48_TAPE_HEADER_PILOT_COUNT
#undef SP48_TAPE_SAVE_DATA_CAPACITY
#undef SP48_TAPE_SAVE_MAX_BLOCKS
#undef SP48_TAPE_FILENAME_CAPACITY
#undef SP48_TAPE_DATA_CAPACITY
#undef SP48_TAPE_MAX_BLOCKS

static uint8_t spp3eCpuReadMemory(uint32_t address) {
  return (uint8_t)spp3eReadMemory(address);
}

static void spp3eCpuWriteMemory(uint32_t address, uint32_t value) {
  spp3eWriteMemory(address, value);
}

static void spp3eCpuPokeMemory(uint32_t address, uint32_t value) {
  spp3eWriteMemory(address, value);
}

static void SPP3E_CPU_NOINLINE spp3eApplyContentionDelay(void) {
  const uint32_t delay = spp3eContention[spp3eUlaCurrentFrameTact()];
  cpu.tacts += delay;
  spp3eTacts += delay;
  spp3eCommonSetNextAudioSample();
  spp3eTotalContentionDelaySinceStart += delay;
  spp3eContentionDelaySincePause += delay;
}

static void SPP3E_CPU_NOINLINE spp3eTactPlusN(uint32_t value) {
  cpu.tacts += value;
  spp3eTacts += value;
  spp3eCommonSetNextAudioSample();
}

static void SPP3E_CPU_NOINLINE spp3eDelayMemoryAccess(uint32_t address) {
  if (spp3eIsContendedMemoryAddress(address) != 0u) {
    spp3eApplyContentionDelay();
  }
  spp3eTactPlusN(3u);
}

/*
 * The gate array contends only cycles with MREQ active (Sinclair Wiki, "Contended memory" and
 * "Contended I/O"; the WoS 128K reference: on the +2A/+3 an instruction's repeated `pc+1`/`hl`
 * entries are combined into one, and port $FE is not contended). An internal or refresh cycle with a
 * contended address on the bus, and every I/O cycle, run at full speed.
 */
static void SPP3E_CPU_NOINLINE spp3eCpuDelayAddressBusAccess(uint32_t address) {
  (void)address;
}

static void SPP3E_CPU_NOINLINE spp3eDelayPortAccess(uint32_t address) {
  (void)address;
  spp3eTactPlusN(4u);
}

#undef SPP3E_CPU_NOINLINE

uint8_t *spp3eMemoryPtr(void) { return spp3eMemory; }
uint8_t *spp3eRamPtr(void) { return spp3eRam; }
uint8_t *spp3eRomPtr(void) { return spp3eRom; }
uint32_t *spp3ePixelBufferPtr(void) { return spp3ePixelBuffer; }
Spp3eAudioSample *spp3eAudioSamplesPtr(void) { return spp3eAudioSamples; }
uint8_t *spp3eKeyboardLinesPtr(void) { return spp3eKeyboardLines; }
uint8_t *spp3eDiskDataPtr(void) { return spp3eDiskData[0]; }
uint8_t *spp3eDiskBDataPtr(void) { return spp3eDiskData[1]; }
uint8_t *spp3eDiskChangesPtr(void) { return spp3eDiskChanges[0]; }
uint8_t *spp3eDiskBChangesPtr(void) { return spp3eDiskChanges[1]; }
uint8_t *spp3eTapeDataPtr(void) { return spp3eTapeData; }
uint8_t *spp3eTapeSaveDataPtr(void) { return spp3eTapeSaveData; }

static uint32_t spp3eAudioTactsPerSample(void) {
  const uint32_t sampleRate = spp3eAudioSampleRate == 0u ? SPP3E_DEFAULT_SAMPLE_RATE : spp3eAudioSampleRate;
  return SPP3E_BASE_CLOCK_FREQUENCY / sampleRate;
}

static void spp3eResetAudio(void) {
  spp3eCommonResetAudio();
}

static void spp3eBeginAudioFrame(void) {
  spp3eCommonBeginAudioFrame();
}

static void spp3eSetNextAudioSample(void) {
  spp3eCommonSetNextAudioSample();
}

static void spp3eResetPsg(void) {
  resetPsg();
}

static void spp3ePsgAddressWrite(uint32_t value) {
  sp128PsgAdvanceToTact((double)spp3eTacts);
  sp128PsgActive = 1u;
  sp128PsgRegisterIndex = (uint8_t)(value & 0x0fu);
}

static uint32_t spp3ePsgDataRead(void) {
  return sp128PsgDataRead();
}

static void spp3ePsgDataWrite(uint32_t value) {
  sp128PsgDataWrite(value);
}

static void spp3eUpdateTapeMode(void) {
  if (spp3eSelectedRom == 3u) {
    spp3eCommonUpdateTapeMode();
  }
}

static Spp3eDiskDrive *spp3eGetDiskDrive(uint32_t drive) {
  return &spp3eDiskDrives[drive < SPP3E_DISK_DRIVE_COUNT ? drive : 0u];
}

static void spp3eDiskRefreshReady(Spp3eDiskDrive *drive) {
  drive->ready = drive->motorSpeed == 100u && drive->hasDiskLoaded != 0u ? 1u : 0u;
}

static void spp3eDiskResetDrive(uint32_t driveIndex) {
  Spp3eDiskDrive *drive = spp3eGetDiskDrive(driveIndex);
  drive->hasDiskLoaded = 0u;
  drive->writeProtected = 0u;
  drive->selected = 0u;
  drive->hasTwoHeads = 1u;
  drive->currentHead = 0u;
  drive->track0Mark = 1u;
  drive->ready = 0u;
  drive->motorOn = 0u;
  drive->motorAcceleration = 0;
  drive->motorSpeed = 0u;
  drive->currentCylinder = 0u;
  drive->maxCylinders = SPP3E_DISK_DEFAULT_MAX_CYLINDERS;
  drive->headLoaded = 0u;
  drive->imageCylinders = 0u;
  drive->imageSides = 1u;
  drive->rotation = 0u;
  drive->sectorsUsed = 0u;
  drive->weakCounter = 0u;
  drive->diskLength = 0u;
  drive->revision = 0u;
  drive->structureRevision = 0u;
  spp3eClearBytes(spp3eDiskData[driveIndex], SPP3E_DISK_DATA_CAPACITY);
  spp3eClearBytes(spp3eDiskChanges[driveIndex], SPP3E_DISK_CHANGE_CAPACITY);
  spp3eClearBytes((uint8_t *)spp3eDiskTracks[driveIndex], (uint32_t)sizeof(spp3eDiskTracks[driveIndex]));
  spp3eClearBytes((uint8_t *)spp3eDiskSectors[driveIndex], (uint32_t)sizeof(spp3eDiskSectors[driveIndex]));
}

static uint8_t spp3eNormalizeEnabledDriveCount(uint32_t count) {
  if (count > SPP3E_DISK_DRIVE_COUNT) {
    return SPP3E_DISK_DRIVE_COUNT;
  }
  return (uint8_t)count;
}

static void spp3eFdcSelectDriveInternal(uint32_t driveIndex, uint32_t head) {
  const uint8_t selectedDrive =
    driveIndex < spp3eFdcEnabledDriveCount && driveIndex < SPP3E_DISK_DRIVE_COUNT ? (uint8_t)driveIndex : 0u;
  spp3eFdcCurrentDrive = selectedDrive;
  for (uint32_t i = 0u; i < SPP3E_DISK_DRIVE_COUNT; i++) {
    Spp3eDiskDrive *drive = &spp3eDiskDrives[i];
    drive->selected = i == selectedDrive && i < spp3eFdcEnabledDriveCount ? 1u : 0u;
    if (drive->selected != 0u) {
      drive->headLoaded = drive->hasDiskLoaded != 0u ? 1u : 0u;
      drive->currentHead = drive->hasTwoHeads != 0u ? (uint8_t)(head & 0x01u) : 0u;
    } else {
      drive->headLoaded = 0u;
    }
  }
}

static void spp3eFdcUpdateSr3(void) {
  const Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
  spp3eFdcSr3 = 0u;
  if (spp3eFdcCurrentDrive != 0u) spp3eFdcSr3 |= SPP3E_FDC_SR3_US0;
  if (drive->currentHead != 0u) spp3eFdcSr3 |= SPP3E_FDC_SR3_HD;
  if (drive->hasTwoHeads != 0u) spp3eFdcSr3 |= SPP3E_FDC_SR3_TS;
  if (drive->track0Mark != 0u) spp3eFdcSr3 |= SPP3E_FDC_SR3_T0;
  if (drive->ready != 0u) spp3eFdcSr3 |= SPP3E_FDC_SR3_RD;
  if (drive->hasDiskLoaded == 0u || drive->writeProtected != 0u) spp3eFdcSr3 |= SPP3E_FDC_SR3_WP;
}

static void spp3eFdcIdentifyCommand(uint32_t value) {
  const uint8_t command = (uint8_t)(value & 0xffu);
  spp3eFdcCommandRegister = command;
  spp3eFdcCommandId = SPP3E_FDC_CMD_INVALID;
  spp3eFdcCommandLength = 0u;
  spp3eFdcCommandResultLength = 1u;
  if ((command & 0x1fu) == 0x06u || (command & 0x1fu) == 0x0cu) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_READ_DATA;
    spp3eFdcCommandLength = 8u;
    spp3eFdcCommandResultLength = 7u;
  } else if ((command & 0x9fu) == 0x02u) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_READ_TRACK;
    spp3eFdcCommandLength = 8u;
    spp3eFdcCommandResultLength = 7u;
  } else if (command == 0x07u) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_RECALIBRATE;
    spp3eFdcCommandLength = 1u;
    spp3eFdcCommandResultLength = 0u;
  } else if (command == 0x0fu) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_SEEK;
    spp3eFdcCommandLength = 2u;
    spp3eFdcCommandResultLength = 0u;
  } else if ((command & 0x3fu) == 0x05u || (command & 0x3fu) == 0x09u) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_WRITE_DATA;
    spp3eFdcCommandLength = 8u;
    spp3eFdcCommandResultLength = 7u;
  } else if ((command & 0x1fu) == 0x11u || (command & 0x1fu) == 0x19u || (command & 0x1fu) == 0x1du) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_SCAN;
    spp3eFdcCommandLength = 8u;
    spp3eFdcCommandResultLength = 7u;
  } else if ((command & 0xbfu) == 0x0au) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_READ_ID;
    spp3eFdcCommandLength = 1u;
    spp3eFdcCommandResultLength = 7u;
  } else if ((command & 0xbfu) == 0x0du) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_WRITE_ID;
    spp3eFdcCommandLength = 5u;
    spp3eFdcCommandResultLength = 7u;
  } else if (command == 0x08u) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_SENSE_INT;
    spp3eFdcCommandLength = 0u;
    spp3eFdcCommandResultLength = 2u;
  } else if (command == 0x03u) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_SPECIFY;
    spp3eFdcCommandLength = 2u;
    spp3eFdcCommandResultLength = 0u;
  } else if (command == 0x04u) {
    spp3eFdcCommandId = SPP3E_FDC_CMD_SENSE_DRIVE;
    spp3eFdcCommandLength = 1u;
    spp3eFdcCommandResultLength = 1u;
  }
}

static void spp3eFdcLoadResult(uint32_t length) {
  spp3eFdcCommandResultLength = (uint8_t)length;
  spp3eFdcResultBytesLeft = (uint8_t)length;
  spp3eFdcResultIndex = 0u;
  if (length > 0u) {
    spp3eFdcOperationPhase = SPP3E_FDC_PHASE_RESULT;
    spp3eFdcMsr = SPP3E_FDC_MSR_RQM | SPP3E_FDC_MSR_DIO | SPP3E_FDC_MSR_CB;
  } else {
    spp3eFdcOperationPhase = SPP3E_FDC_PHASE_COMMAND;
    spp3eFdcMsr = SPP3E_FDC_MSR_RQM;
  }
}

static void spp3eFdcCompleteCommand(void) {
  spp3eFdcCommandBytesReceived = 0u;
  if (spp3eFdcCommandResultLength > 0u) {
    spp3eFdcLoadResult(spp3eFdcCommandResultLength);
  } else {
    spp3eFdcLoadResult(0u);
  }
}

static void spp3eFdcSelectFromHdUs(uint32_t value) {
  const uint32_t requestedDrive = value & 0x03u;
  const uint32_t selectedDrive = (requestedDrive & 0x01u) != 0u && spp3eFdcEnabledDriveCount > 1u ? 1u : 0u;
  const uint32_t head = (value & 0x04u) != 0u ? 1u : 0u;
  spp3eFdcSelectDriveInternal(selectedDrive, head);
  spp3eFdcUpdateSr3();
}

/* ---------------------------------------------------------------------------------------------
 * The uPD765A's read, write, format and scan commands, over the per-track sector table
 * (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, A3). Written from the NEC uPD765 data sheet
 * (`_input/765.pdf`):
 *
 * - A sector is found by comparing its ID field with the command's C, H, R and N, on the track
 *   under the selected head, starting where the disk has rotated to. No match in a revolution:
 *   No Data (ST1 ND), with Wrong Cylinder (ST2 WC) - and Bad Cylinder (BC) for C = FF - when a
 *   sector with that R had another C. A track without IDs: Missing Address Mark (ST1 MA).
 * - Read/write run from R to the end-of-track sector (EOT), one sector after another; with MT the
 *   run continues on side 1. The +3 does not wire the controller's TC input, so a run always ends
 *   past EOT, with an abnormal termination and End of Cylinder (ST0 IC = 01, ST1 EN), which +3DOS
 *   expects.
 * - A sector whose data mark is not the one the command reads (a deleted mark for READ DATA, a
 *   normal one for READ DELETED DATA) sets Control Mark (ST2 CM): with SK it is skipped, without SK
 *   it is read and the command ends after it.
 * - A sector the dump read with a data CRC error (ST1 DE + ST2 DD) is transferred and ends the
 *   command with those bits; one without a data field (ST2 MD) ends it with MA + MD.
 * - N = 0 transfers DTL bytes; otherwise 128 << N.
 * --------------------------------------------------------------------------------------------- */

static Spp3eDiskTrack *spp3eDiskTrackAt(uint32_t driveIndex, uint32_t cylinder, uint32_t head) {
  if (driveIndex >= SPP3E_DISK_DRIVE_COUNT || cylinder >= SPP3E_DISK_MAX_CYLINDERS || head > 1u) {
    return 0;
  }
  return &spp3eDiskTracks[driveIndex][cylinder * 2u + head];
}

/* The formatted track under the current drive's head, or 0 */
static Spp3eDiskTrack *spp3eFdcCurrentTrack(void) {
  const Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
  if (drive->hasDiskLoaded == 0u) {
    return 0;
  }
  Spp3eDiskTrack *track = spp3eDiskTrackAt(spp3eFdcCurrentDrive, drive->currentCylinder, drive->currentHead);
  return track != 0 && track->formatted != 0u && track->sectorCount > 0u ? track : 0;
}

static Spp3eDiskSector *spp3eDiskSectorAt(uint32_t driveIndex, int32_t index) {
  if (driveIndex >= SPP3E_DISK_DRIVE_COUNT || index < 0 || (uint32_t)index >= SPP3E_DISK_SECTOR_CAPACITY) {
    return 0;
  }
  return &spp3eDiskSectors[driveIndex][index];
}

static uint32_t spp3eFdcHeadAddress(void) {
  const Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
  return (uint32_t)((drive->currentHead & 0x01u) << 2u) | (spp3eFdcCurrentDrive & 0x03u);
}

/* The bytes one sector transfer moves: 128 << N, or DTL when N = 0 */
static uint32_t spp3eFdcTransferSize(void) {
  const uint32_t n = spp3eFdcDataRegister[4];
  if (n == 0u) {
    const uint32_t dtl = spp3eFdcDataRegister[7];
    return dtl == 0u || dtl > 128u ? 128u : dtl;
  }
  return 128u << (n > 7u ? 7u : n);
}

static void spp3eFdcBuildRwResult(uint8_t sr0, uint8_t sr1, uint8_t sr2) {
  spp3eFdcResultRegister[0] = sr0;
  spp3eFdcResultRegister[1] = sr1;
  spp3eFdcResultRegister[2] = sr2;
  spp3eFdcResultRegister[3] = spp3eFdcDataRegister[1];
  spp3eFdcResultRegister[4] = spp3eFdcDataRegister[2];
  spp3eFdcResultRegister[5] = spp3eFdcDataRegister[3];
  spp3eFdcResultRegister[6] = spp3eFdcDataRegister[4];
  spp3eFdcSr0 = sr0;
  spp3eFdcSr1 = sr1;
  spp3eFdcSr2 = sr2;
}

/* Ends a read/write/scan/format command with its result phase */
static void spp3eFdcFinishRw(uint8_t ic, uint8_t sr1, uint8_t sr2) {
  spp3eFdcSector = -1;
  spp3eFdcBuildRwResult((uint8_t)(ic | spp3eFdcHeadAddress()), sr1, sr2);
  spp3eFdcCompleteCommand();
}

/* Notes a sector the guest wrote, for the host's write-back (one bit per table entry) */
static void spp3eDiskMarkDirty(uint32_t driveIndex, int32_t index) {
  if (driveIndex >= SPP3E_DISK_DRIVE_COUNT || index < 0 || (uint32_t)index >= SPP3E_DISK_CHANGE_CAPACITY * 8u) {
    return;
  }
  spp3eDiskChanges[driveIndex][(uint32_t)index >> 3u] |= (uint8_t)(1u << ((uint32_t)index & 7u));
  spp3eFdcDirtyDrive = (uint8_t)driveIndex;
  spp3eFdcDirtyRevision++;
  spp3eGetDiskDrive(driveIndex)->revision++;
}

/* The disk's layout changed (a format, a data mark rewritten): the host republishes the image */
static void spp3eDiskMarkStructureChanged(uint32_t driveIndex) {
  Spp3eDiskDrive *drive = spp3eGetDiskDrive(driveIndex);
  drive->structureRevision++;
  drive->revision++;
  spp3eFdcDirtyDrive = (uint8_t)driveIndex;
  spp3eFdcDirtyRevision++;
}

/*
 * Finds the sector the command's C, H, R, N name on the current track.
 * @returns its table index, or -1 with the error bits set
 */
static int32_t spp3eFdcFindSector(uint8_t *sr1, uint8_t *sr2) {
  Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
  const Spp3eDiskTrack *track = spp3eFdcCurrentTrack();
  if (track == 0) {
    *sr1 = SPP3E_FDC_SR1_MA;
    *sr2 = 0u;
    return -1;
  }
  const uint8_t c = spp3eFdcDataRegister[1];
  const uint8_t h = spp3eFdcDataRegister[2];
  const uint8_t r = spp3eFdcDataRegister[3];
  const uint8_t n = spp3eFdcDataRegister[4];
  uint8_t wrongCylinder = 0u;
  uint8_t badCylinder = 0u;
  for (uint32_t k = 0u; k < track->sectorCount; k++) {
    const uint32_t position = (drive->rotation + k) % track->sectorCount;
    const int32_t index = (int32_t)(track->firstSector + position);
    const Spp3eDiskSector *sector = &spp3eDiskSectors[spp3eFdcCurrentDrive][index];
    if (sector->c == c && sector->h == h && sector->r == r && sector->n == n) {
      drive->rotation = (uint16_t)((position + 1u) % track->sectorCount);
      return index;
    }
    if (sector->r == r && sector->c != c) {
      wrongCylinder = 1u;
      if (sector->c == 0xffu) {
        badCylinder = 1u;
      }
    }
  }
  *sr1 = SPP3E_FDC_SR1_ND;
  *sr2 = (uint8_t)((wrongCylinder != 0u ? SPP3E_FDC_SR2_WC : 0u) | (badCylinder != 0u ? SPP3E_FDC_SR2_BC : 0u));
  return -1;
}

/* Where the next transfer of a sector comes from: a weak sector gives a different copy each read */
static uint32_t spp3eFdcCopyOffset(const Spp3eDiskSector *sector, uint8_t forRead) {
  if (forRead == 0u || sector->copies <= 1u) {
    return sector->offset;
  }
  Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
  const uint32_t copy = drive->weakCounter % sector->copies;
  drive->weakCounter++;
  return sector->offset + copy * sector->length;
}

static uint8_t spp3eFdcIsReadDeleted(void) {
  return (spp3eFdcCommandRegister & 0x1fu) == 0x0cu ? 1u : 0u;
}

static uint8_t spp3eFdcIsWriteDeleted(void) {
  return (spp3eFdcCommandRegister & 0x3fu) == 0x09u ? 1u : 0u;
}

/*
 * Moves to the next sector of a run: R + 1, or past EOT the end of the run (on to side 1 with MT).
 * @returns 1 when the run goes on
 */
static uint8_t spp3eFdcAdvanceRecord(void) {
  if (spp3eFdcDataRegister[3] != spp3eFdcEndSector) {
    spp3eFdcDataRegister[3]++;
    return 1u;
  }
  Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
  if (spp3eFdcMultiTrack != 0u && drive->currentHead == 0u && drive->hasTwoHeads != 0u) {
    drive->currentHead = 1u;
    spp3eFdcDataRegister[0] |= 0x04u;
    spp3eFdcDataRegister[2] ^= 0x01u;
    spp3eFdcDataRegister[3] = 1u;
    return 1u;
  }
  /* Past EOT: the result names the next cylinder's first sector */
  if (spp3eFdcMultiTrack != 0u && drive->currentHead != 0u) {
    spp3eFdcDataRegister[2] ^= 0x01u;
  }
  spp3eFdcDataRegister[1]++;
  spp3eFdcDataRegister[3] = 1u;
  return 0u;
}

/* Starts the transfer of the next sector of a read, write or scan run (or ends the command) */
static void spp3eFdcStartSector(void) {
  const uint8_t forWrite = spp3eFdcCommandId == SPP3E_FDC_CMD_WRITE_DATA ? 1u : 0u;
  for (;;) {
    uint8_t sr1 = 0u;
    uint8_t sr2 = 0u;
    const int32_t index = spp3eFdcFindSector(&sr1, &sr2);
    if (index < 0) {
      spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, (uint8_t)(sr1 | spp3eFdcPendingSr1), (uint8_t)(sr2 | spp3eFdcPendingSr2));
      return;
    }
    const Spp3eDiskSector *sector = &spp3eDiskSectors[spp3eFdcCurrentDrive][index];
    if (forWrite == 0u) {
      /* No data field: the ID is there, the data mark is not */
      if ((sector->st2 & SPP3E_FDC_SR2_MD) != 0u) {
        spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, SPP3E_FDC_SR1_MA, SPP3E_FDC_SR2_MD);
        return;
      }
      const uint8_t deleted = (sector->st2 & SPP3E_FDC_SR2_CM) != 0u ? 1u : 0u;
      if (deleted != spp3eFdcIsReadDeleted() && spp3eFdcCommandId == SPP3E_FDC_CMD_READ_DATA) {
        spp3eFdcPendingSr2 |= SPP3E_FDC_SR2_CM;
        if (spp3eFdcSkip != 0u) {
          if (spp3eFdcAdvanceRecord() == 0u) {
            spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, (uint8_t)(SPP3E_FDC_SR1_EN | spp3eFdcPendingSr1), spp3eFdcPendingSr2);
            return;
          }
          continue;
        }
        spp3eFdcStopAfterSector = 1u;
      }
    }
    spp3eFdcSector = index;
    spp3eFdcSectorOffset = 0u;
    spp3eFdcTransferOffset = spp3eFdcCopyOffset(sector, forWrite == 0u ? 1u : 0u);
    spp3eFdcSectorStored = sector->length;
    spp3eFdcTransferLength = spp3eFdcTransferSize();
    spp3eFdcMsr = (uint8_t)(SPP3E_FDC_MSR_RQM | SPP3E_FDC_MSR_CB | SPP3E_FDC_MSR_EXM |
      (forWrite == 0u && spp3eFdcCommandId != SPP3E_FDC_CMD_SCAN ? SPP3E_FDC_MSR_DIO : 0u));
    return;
  }
}

/* A sector's last byte went across: end the command or go on with the next sector */
static void spp3eFdcSectorDone(void) {
  const Spp3eDiskSector *sector = spp3eDiskSectorAt(spp3eFdcCurrentDrive, spp3eFdcSector);
  if (spp3eFdcCommandId == SPP3E_FDC_CMD_WRITE_DATA && sector != 0) {
    Spp3eDiskSector *written = &spp3eDiskSectors[spp3eFdcCurrentDrive][spp3eFdcSector];
    /* Every stored copy gets the new data: a rewritten sector reads the same each time */
    for (uint32_t copy = 1u; copy < written->copies; copy++) {
      for (uint32_t i = 0u; i < written->length; i++) {
        spp3eDiskData[spp3eFdcCurrentDrive][written->offset + copy * written->length + i] =
          spp3eDiskData[spp3eFdcCurrentDrive][written->offset + i];
      }
    }
    /* A new data mark and a good CRC: the status bytes the dump recorded no longer apply */
    const uint8_t st2 = spp3eFdcIsWriteDeleted() != 0u ? SPP3E_FDC_SR2_CM : 0u;
    if (written->st1 != 0u || written->st2 != st2) {
      written->st1 = 0u;
      written->st2 = st2;
      spp3eDiskMarkStructureChanged(spp3eFdcCurrentDrive);
    }
    spp3eDiskMarkDirty(spp3eFdcCurrentDrive, spp3eFdcSector);
  }
  if (spp3eFdcCommandId != SPP3E_FDC_CMD_WRITE_DATA && sector != 0 &&
      (sector->st1 & SPP3E_FDC_SR1_DE) != 0u && (sector->st2 & SPP3E_FDC_SR2_DD) != 0u) {
    spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, SPP3E_FDC_SR1_DE, (uint8_t)(SPP3E_FDC_SR2_DD | spp3eFdcPendingSr2));
    return;
  }
  if (spp3eFdcCommandId == SPP3E_FDC_CMD_SCAN && spp3eFdcScanEqual != 0u) {
    /* A scan stops at the first sector that meets its condition */
    spp3eFdcFinishRw(0u, 0u, (uint8_t)(spp3eFdcScanNotMet != 0u ? SPP3E_FDC_SR2_SN : SPP3E_FDC_SR2_SH));
    return;
  }
  if (spp3eFdcStopAfterSector != 0u) {
    spp3eFdcAdvanceRecord();
    spp3eFdcFinishRw(0u, spp3eFdcPendingSr1, spp3eFdcPendingSr2);
    return;
  }
  if (spp3eFdcAdvanceRecord() == 0u) {
    spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, (uint8_t)(SPP3E_FDC_SR1_EN | spp3eFdcPendingSr1),
      (uint8_t)(spp3eFdcPendingSr2 | (spp3eFdcCommandId == SPP3E_FDC_CMD_SCAN ? SPP3E_FDC_SR2_SN : 0u)));
    return;
  }
  if (spp3eFdcCommandId == SPP3E_FDC_CMD_SCAN) {
    spp3eFdcScanEqual = 0u;
    spp3eFdcScanNotMet = 0u;
  }
  spp3eFdcStartSector();
}

/* READ TRACK: the sectors in physical order from the index hole, whatever their IDs */
static void spp3eFdcStartTrackSector(void) {
  const Spp3eDiskTrack *track = spp3eFdcCurrentTrack();
  if (track == 0) {
    spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, SPP3E_FDC_SR1_MA, 0u);
    return;
  }
  const uint32_t position = spp3eFdcSectorStored;
  if (position >= track->sectorCount || position >= spp3eFdcEndSector) {
    spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, (uint8_t)(SPP3E_FDC_SR1_EN | spp3eFdcPendingSr1), spp3eFdcPendingSr2);
    return;
  }
  const int32_t index = (int32_t)(track->firstSector + position);
  const Spp3eDiskSector *sector = &spp3eDiskSectors[spp3eFdcCurrentDrive][index];
  if (sector->c != spp3eFdcDataRegister[1] || sector->h != spp3eFdcDataRegister[2] ||
      sector->r != spp3eFdcDataRegister[3] || sector->n != spp3eFdcDataRegister[4]) {
    spp3eFdcPendingSr1 |= SPP3E_FDC_SR1_ND;
  }
  spp3eFdcSector = index;
  spp3eFdcSectorOffset = 0u;
  spp3eFdcTransferOffset = sector->offset;
  spp3eFdcTransferLength = spp3eFdcTransferSize();
  spp3eFdcMsr = SPP3E_FDC_MSR_RQM | SPP3E_FDC_MSR_DIO | SPP3E_FDC_MSR_CB | SPP3E_FDC_MSR_EXM;
}

/* The byte at a position of the running sector: past what the dump stored, the disk gives 0 */
static uint8_t spp3eFdcSectorByte(uint32_t position) {
  const Spp3eDiskSector *sector = spp3eDiskSectorAt(spp3eFdcCurrentDrive, spp3eFdcSector);
  if (sector == 0 || position >= sector->length) {
    return 0u;
  }
  return spp3eDiskData[spp3eFdcCurrentDrive][spp3eFdcTransferOffset + position];
}

/* Moves the live tracks down to the start of the data area and the sector table (a reformat
 * leaves the replaced tracks' space behind) */
static void spp3eDiskCompact(uint32_t driveIndex) {
  Spp3eDiskDrive *drive = spp3eGetDiskDrive(driveIndex);
  uint32_t dataCursor = 0u;
  uint32_t sectorCursor = 0u;
  uint32_t lastData = 0u;
  uint8_t haveLast = 0u;
  /* Tracks in the order of their data, so every move goes down */
  for (;;) {
    int32_t next = -1;
    uint32_t nextOffset = 0u;
    for (uint32_t t = 0u; t < SPP3E_DISK_TRACK_ENTRIES; t++) {
      const Spp3eDiskTrack *track = &spp3eDiskTracks[driveIndex][t];
      if (track->formatted == 0u || track->sectorCount == 0u) continue;
      const uint32_t offset = spp3eDiskSectors[driveIndex][track->firstSector].offset;
      if (haveLast != 0u && offset <= lastData) continue;
      if (next < 0 || offset < nextOffset) {
        next = (int32_t)t;
        nextOffset = offset;
      }
    }
    if (next < 0) break;
    lastData = nextOffset;
    haveLast = 1u;
    Spp3eDiskTrack *track = &spp3eDiskTracks[driveIndex][next];
    for (uint32_t i = 0u; i < track->sectorCount; i++) {
      Spp3eDiskSector *sector = &spp3eDiskSectors[driveIndex][track->firstSector + i];
      const uint32_t size = sector->length * (sector->copies == 0u ? 1u : sector->copies);
      for (uint32_t b = 0u; b < size; b++) {
        spp3eDiskData[driveIndex][dataCursor + b] = spp3eDiskData[driveIndex][sector->offset + b];
      }
      sector->offset = dataCursor;
      dataCursor += size;
    }
  }
  /* The sector table, in the order of the tracks' entries (a second pass by first entry) */
  uint32_t lastFirst = 0u;
  haveLast = 0u;
  for (;;) {
    int32_t next = -1;
    uint32_t nextFirst = 0u;
    for (uint32_t t = 0u; t < SPP3E_DISK_TRACK_ENTRIES; t++) {
      const Spp3eDiskTrack *track = &spp3eDiskTracks[driveIndex][t];
      if (track->formatted == 0u || track->sectorCount == 0u) continue;
      if (haveLast != 0u && track->firstSector <= lastFirst) continue;
      if (next < 0 || track->firstSector < nextFirst) {
        next = (int32_t)t;
        nextFirst = track->firstSector;
      }
    }
    if (next < 0) break;
    lastFirst = nextFirst;
    haveLast = 1u;
    Spp3eDiskTrack *track = &spp3eDiskTracks[driveIndex][next];
    for (uint32_t i = 0u; i < track->sectorCount; i++) {
      spp3eDiskSectors[driveIndex][sectorCursor + i] = spp3eDiskSectors[driveIndex][track->firstSector + i];
    }
    track->firstSector = (uint16_t)sectorCursor;
    sectorCursor += track->sectorCount;
  }
  drive->diskLength = dataCursor;
  drive->sectorsUsed = (uint16_t)sectorCursor;
  /* Table indexes moved: the host takes the whole image (the structure change says so) */
  spp3eClearBytes(spp3eDiskChanges[driveIndex], SPP3E_DISK_CHANGE_CAPACITY);
}

/* FORMAT A TRACK (WRITE ID): lays the received IDs down on the track under the head */
static void spp3eFdcFormatTrack(void) {
  Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
  const uint32_t count = spp3eFdcDataRegister[2];
  const uint32_t n = spp3eFdcDataRegister[1] > 7u ? 7u : spp3eFdcDataRegister[1];
  const uint32_t length = 128u << n;
  const uint32_t needed = count * length;
  Spp3eDiskTrack *track = spp3eDiskTrackAt(spp3eFdcCurrentDrive, drive->currentCylinder, drive->currentHead);
  if (track == 0) {
    spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, SPP3E_FDC_SR1_ND, 0u);
    return;
  }
  /* The replaced track's space is left behind; compact when the new one does not fit after it */
  track->formatted = 0u;
  track->sectorCount = 0u;
  if (drive->diskLength + needed > SPP3E_DISK_DATA_CAPACITY ||
      (uint32_t)drive->sectorsUsed + count > SPP3E_DISK_SECTOR_CAPACITY) {
    spp3eDiskCompact(spp3eFdcCurrentDrive);
  }
  if (drive->diskLength + needed > SPP3E_DISK_DATA_CAPACITY ||
      (uint32_t)drive->sectorsUsed + count > SPP3E_DISK_SECTOR_CAPACITY) {
    spp3eDiskMarkStructureChanged(spp3eFdcCurrentDrive);
    spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, SPP3E_FDC_SR1_ND, 0u);
    return;
  }
  track->firstSector = drive->sectorsUsed;
  track->sectorCount = (uint8_t)count;
  track->formatted = 1u;
  track->sizeCode = (uint8_t)n;
  track->gap3 = spp3eFdcDataRegister[3];
  track->filler = spp3eFdcDataRegister[4];
  for (uint32_t i = 0u; i < count; i++) {
    Spp3eDiskSector *sector = &spp3eDiskSectors[spp3eFdcCurrentDrive][drive->sectorsUsed + i];
    sector->c = spp3eFdcFormatIds[i * 4u];
    sector->h = spp3eFdcFormatIds[i * 4u + 1u];
    sector->r = spp3eFdcFormatIds[i * 4u + 2u];
    sector->n = spp3eFdcFormatIds[i * 4u + 3u];
    sector->st1 = 0u;
    sector->st2 = 0u;
    sector->copies = 1u;
    sector->offset = drive->diskLength + i * length;
    sector->length = (uint16_t)length;
    for (uint32_t b = 0u; b < length; b++) {
      spp3eDiskData[spp3eFdcCurrentDrive][sector->offset + b] = spp3eFdcDataRegister[4];
    }
  }
  drive->sectorsUsed = (uint16_t)(drive->sectorsUsed + count);
  drive->diskLength += needed;
  drive->rotation = 0u;
  if (drive->currentCylinder + 1u > drive->imageCylinders) {
    drive->imageCylinders = (uint8_t)(drive->currentCylinder + 1u);
  }
  if (drive->currentHead + 1u > drive->imageSides) {
    drive->imageSides = (uint8_t)(drive->currentHead + 1u);
  }
  spp3eDiskMarkStructureChanged(spp3eFdcCurrentDrive);
  /* The result's C, H, R, N carry the last ID laid down */
  if (count > 0u) {
    spp3eFdcDataRegister[1] = spp3eFdcFormatIds[(count - 1u) * 4u];
    spp3eFdcDataRegister[2] = spp3eFdcFormatIds[(count - 1u) * 4u + 1u];
    spp3eFdcDataRegister[3] = spp3eFdcFormatIds[(count - 1u) * 4u + 2u];
    spp3eFdcDataRegister[4] = spp3eFdcFormatIds[(count - 1u) * 4u + 3u];
  }
  spp3eFdcFinishRw(0u, 0u, 0u);
}

static void spp3eFdcExecuteCommand(void) {
  spp3eFdcOperationPhase = SPP3E_FDC_PHASE_EXECUTION;
  spp3eFdcMsr &= (uint8_t)~SPP3E_FDC_MSR_RQM;
  if (spp3eFdcNonDmaMode != 0u) {
    spp3eFdcMsr |= SPP3E_FDC_MSR_EXM;
  }

  if (
    spp3eFdcCommandId != SPP3E_FDC_CMD_SENSE_INT &&
    spp3eFdcCommandId != SPP3E_FDC_CMD_SPECIFY &&
    spp3eFdcCommandId != SPP3E_FDC_CMD_INVALID &&
    spp3eFdcCommandLength > 0u
  ) {
    spp3eFdcSelectFromHdUs(spp3eFdcDataRegister[0]);
  }

  Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
  spp3eFdcPendingSr1 = 0u;
  spp3eFdcPendingSr2 = 0u;
  spp3eFdcStopAfterSector = 0u;
  switch (spp3eFdcCommandId) {
    case SPP3E_FDC_CMD_SPECIFY:
      spp3eFdcStepRate = (uint8_t)(16u - ((spp3eFdcDataRegister[0] >> 4u) & 0x0fu));
      spp3eFdcHeadUnloadTime = (uint8_t)((spp3eFdcDataRegister[0] & 0x0fu) * 16u);
      spp3eFdcHeadLoadTime = (uint8_t)((spp3eFdcDataRegister[1] >> 1u) & 0x7fu);
      spp3eFdcNonDmaMode = (spp3eFdcDataRegister[1] & 0x01u) != 0u ? 1u : 0u;
      spp3eFdcCompleteCommand();
      break;
    case SPP3E_FDC_CMD_SENSE_DRIVE:
      spp3eFdcResultRegister[0] =
        ((spp3eFdcDataRegister[0] & 0x01u) != 0u && spp3eFdcEnabledDriveCount < 2u)
          ? 0u
          : spp3eFdcSr3;
      spp3eFdcCompleteCommand();
      break;
    case SPP3E_FDC_CMD_SENSE_INT:
      if (spp3eFdcIntReq == SPP3E_FDC_INT_NONE) {
        spp3eFdcSenseIntResult[0] = SPP3E_FDC_SR0_IC;
        spp3eFdcSenseIntResult[1] = spp3eFdcPresentCylinder[spp3eFdcCurrentDrive];
      }
      spp3eFdcResultRegister[0] = spp3eFdcSenseIntResult[0];
      spp3eFdcResultRegister[1] = spp3eFdcSenseIntResult[1];
      spp3eFdcIntReq = SPP3E_FDC_INT_NONE;
      spp3eFdcCompleteCommand();
      break;
    case SPP3E_FDC_CMD_SEEK:
      drive->currentCylinder = spp3eFdcDataRegister[1] < drive->maxCylinders
        ? spp3eFdcDataRegister[1]
        : (uint8_t)(drive->maxCylinders - 1u);
      drive->track0Mark = drive->currentCylinder == 0u ? 1u : 0u;
      drive->rotation = 0u;
      spp3eFdcPresentCylinder[spp3eFdcCurrentDrive] = drive->currentCylinder;
      spp3eFdcSr0 = SPP3E_FDC_SR0_SE | (spp3eFdcCurrentDrive & 0x01u);
      spp3eFdcSenseIntResult[0] = spp3eFdcSr0;
      spp3eFdcSenseIntResult[1] = drive->currentCylinder;
      spp3eFdcIntReq = SPP3E_FDC_INT_SEEK;
      spp3eFdcCompleteCommand();
      break;
    case SPP3E_FDC_CMD_RECALIBRATE:
      drive->currentCylinder = 0u;
      drive->track0Mark = 1u;
      drive->rotation = 0u;
      spp3eFdcPresentCylinder[spp3eFdcCurrentDrive] = 0u;
      spp3eFdcSr0 = SPP3E_FDC_SR0_SE | (spp3eFdcCurrentDrive & 0x01u);
      spp3eFdcSenseIntResult[0] = spp3eFdcSr0;
      spp3eFdcSenseIntResult[1] = 0u;
      spp3eFdcIntReq = SPP3E_FDC_INT_SEEK;
      spp3eFdcCompleteCommand();
      break;
    case SPP3E_FDC_CMD_READ_ID: {
      if (drive->ready == 0u) {
        spp3eFdcFinishRw(SPP3E_FDC_SR0_AT | SPP3E_FDC_SR0_NR, 0u, 0u);
        break;
      }
      const Spp3eDiskTrack *track = spp3eFdcCurrentTrack();
      if (track == 0) {
        spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, SPP3E_FDC_SR1_MA, 0u);
        break;
      }
      /* The next ID to pass under the head */
      const uint32_t position = drive->rotation % track->sectorCount;
      const Spp3eDiskSector *sector = &spp3eDiskSectors[spp3eFdcCurrentDrive][track->firstSector + position];
      drive->rotation = (uint16_t)((position + 1u) % track->sectorCount);
      spp3eFdcDataRegister[1] = sector->c;
      spp3eFdcDataRegister[2] = sector->h;
      spp3eFdcDataRegister[3] = sector->r;
      spp3eFdcDataRegister[4] = sector->n;
      spp3eFdcFinishRw(0u, 0u, 0u);
      break;
    }
    case SPP3E_FDC_CMD_READ_DATA:
    case SPP3E_FDC_CMD_WRITE_DATA:
    case SPP3E_FDC_CMD_SCAN:
    case SPP3E_FDC_CMD_READ_TRACK: {
      spp3eFdcMultiTrack = (spp3eFdcCommandRegister & 0x80u) != 0u && spp3eFdcCommandId != SPP3E_FDC_CMD_READ_TRACK ? 1u : 0u;
      spp3eFdcSkip = (spp3eFdcCommandRegister & 0x20u) != 0u && spp3eFdcCommandId != SPP3E_FDC_CMD_WRITE_DATA ? 1u : 0u;
      spp3eFdcEndSector = spp3eFdcDataRegister[5];
      spp3eFdcDeletedMark = spp3eFdcIsWriteDeleted();
      spp3eFdcScanType = (uint8_t)(spp3eFdcCommandRegister & 0x1fu);
      spp3eFdcScanEqual = 0u;
      spp3eFdcScanNotMet = 0u;
      if (drive->ready == 0u) {
        spp3eFdcFinishRw(SPP3E_FDC_SR0_AT | SPP3E_FDC_SR0_NR, 0u, 0u);
        break;
      }
      if (spp3eFdcCommandId == SPP3E_FDC_CMD_WRITE_DATA && drive->writeProtected != 0u) {
        spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, SPP3E_FDC_SR1_NW, 0u);
        break;
      }
      if (spp3eFdcCommandId == SPP3E_FDC_CMD_READ_TRACK) {
        spp3eFdcSectorStored = 0u;
        spp3eFdcStartTrackSector();
      } else {
        spp3eFdcStartSector();
      }
      break;
    }
    case SPP3E_FDC_CMD_WRITE_ID: {
      if (drive->ready == 0u) {
        spp3eFdcFinishRw(SPP3E_FDC_SR0_AT | SPP3E_FDC_SR0_NR, 0u, 0u);
        break;
      }
      if (drive->writeProtected != 0u) {
        spp3eFdcFinishRw(SPP3E_FDC_SR0_AT, SPP3E_FDC_SR1_NW, 0u);
        break;
      }
      /* The IDs come next, four bytes per sector */
      spp3eFdcSectorOffset = 0u;
      spp3eFdcTransferLength = (uint32_t)spp3eFdcDataRegister[2] * 4u;
      if (spp3eFdcTransferLength == 0u) {
        spp3eFdcFormatTrack();
        break;
      }
      spp3eFdcMsr = SPP3E_FDC_MSR_RQM | SPP3E_FDC_MSR_CB | SPP3E_FDC_MSR_EXM;
      break;
    }
    default:
      spp3eFdcResultRegister[0] = SPP3E_FDC_SR0_IC;
      spp3eFdcCompleteCommand();
      break;
  }
  spp3eFdcUpdateSr3();
}

static void spp3eFdcReset(void) {
  spp3eFdcCurrentDrive = 0u;
  spp3eFdcMsr = SPP3E_FDC_MSR_RQM;
  spp3eFdcSr0 = 0u;
  spp3eFdcSr1 = 0u;
  spp3eFdcSr2 = 0u;
  spp3eFdcOperationPhase = SPP3E_FDC_PHASE_COMMAND;
  spp3eFdcResultBytesLeft = 0u;
  spp3eFdcResultIndex = 0u;
  spp3eFdcCommandId = SPP3E_FDC_CMD_INVALID;
  spp3eFdcCommandRegister = 0u;
  spp3eFdcCommandLength = 0u;
  spp3eFdcCommandBytesReceived = 0u;
  spp3eFdcCommandResultLength = 0u;
  spp3eFdcIntReq = SPP3E_FDC_INT_NONE;
  spp3eFdcSectorOffset = 0u;
  spp3eFdcStepRate = 16u;
  spp3eFdcHeadUnloadTime = 240u;
  spp3eFdcHeadLoadTime = 254u;
  spp3eFdcNonDmaMode = 1u;
  spp3eFdcDirtyDrive = 0xffu;
  spp3eFdcTransferOffset = 0u;
  spp3eFdcTransferLength = 0u;
  spp3eFdcDirtyOffset = 0u;
  spp3eFdcDirtyLength = 0u;
  spp3eFdcDirtyRevision = 0u;
  spp3eFdcSector = -1;
  spp3eFdcSectorStored = 0u;
  spp3eFdcEndSector = 0u;
  spp3eFdcMultiTrack = 0u;
  spp3eFdcSkip = 0u;
  spp3eFdcDeletedMark = 0u;
  spp3eFdcScanType = 0u;
  spp3eFdcScanEqual = 0u;
  spp3eFdcScanNotMet = 0u;
  spp3eFdcPendingSr1 = 0u;
  spp3eFdcPendingSr2 = 0u;
  spp3eFdcStopAfterSector = 0u;
  for (uint32_t i = 0; i < 9u; i++) {
    spp3eFdcDataRegister[i] = 0u;
    spp3eFdcResultRegister[i] = 0u;
  }
  for (uint32_t i = 0u; i < 4u; i++) {
    spp3eFdcPresentCylinder[i] = 0u;
  }
  for (uint32_t i = 0u; i < SPP3E_DISK_DRIVE_COUNT; i++) {
    spp3eDiskResetDrive(i);
  }
  spp3eFdcSelectDriveInternal(0u, 0u);
  spp3eFdcUpdateSr3();
  spp3eDiskUploadActive = 0u;
}

static uint32_t spp3eFdcReadMainStatusRegister(void) {
  return spp3eFdcEnabledDriveCount == 0u ? 0xffu : spp3eFdcMsr;
}

static uint32_t spp3eFdcReadDataRegister(void) {
  if (spp3eFdcEnabledDriveCount == 0u) {
    return 0xffu;
  }
  if ((spp3eFdcMsr & SPP3E_FDC_MSR_RQM) == 0u || (spp3eFdcMsr & SPP3E_FDC_MSR_DIO) == 0u) {
    return 0xffu;
  }
  if (spp3eFdcOperationPhase == SPP3E_FDC_PHASE_EXECUTION &&
      (spp3eFdcCommandId == SPP3E_FDC_CMD_READ_DATA || spp3eFdcCommandId == SPP3E_FDC_CMD_READ_TRACK) &&
      spp3eFdcSector >= 0) {
    const uint8_t data = spp3eFdcSectorByte(spp3eFdcSectorOffset);
    spp3eFdcSectorOffset++;
    if (spp3eFdcSectorOffset >= spp3eFdcTransferLength) {
      if (spp3eFdcCommandId == SPP3E_FDC_CMD_READ_TRACK) {
        spp3eFdcSectorStored++;
        spp3eFdcDataRegister[3]++;
        spp3eFdcStartTrackSector();
      } else {
        spp3eFdcSectorDone();
      }
    }
    return data;
  }
  const uint8_t result = spp3eFdcResultRegister[spp3eFdcResultIndex % 9u];
  if (spp3eFdcOperationPhase == SPP3E_FDC_PHASE_RESULT && spp3eFdcResultBytesLeft > 0u) {
    spp3eFdcResultBytesLeft--;
    spp3eFdcResultIndex++;
    if (spp3eFdcResultBytesLeft == 0u) {
      spp3eFdcOperationPhase = SPP3E_FDC_PHASE_COMMAND;
      spp3eFdcMsr = SPP3E_FDC_MSR_RQM;
    }
  }
  return result;
}

static void spp3eFdcWriteDataRegister(uint32_t value) {
  if (spp3eFdcEnabledDriveCount == 0u) {
    return;
  }
  if ((spp3eFdcMsr & SPP3E_FDC_MSR_RQM) == 0u || (spp3eFdcMsr & SPP3E_FDC_MSR_DIO) != 0u) {
    return;
  }
  if (spp3eFdcOperationPhase == SPP3E_FDC_PHASE_EXECUTION) {
    if (spp3eFdcCommandId == SPP3E_FDC_CMD_WRITE_DATA && spp3eFdcSector >= 0) {
      /* Bytes past what the dump stored for the sector have no place in the image */
      if (spp3eFdcSectorOffset < spp3eFdcSectorStored) {
        spp3eDiskData[spp3eFdcCurrentDrive][spp3eFdcTransferOffset + spp3eFdcSectorOffset] = (uint8_t)value;
      }
      spp3eFdcSectorOffset++;
      if (spp3eFdcSectorOffset >= spp3eFdcTransferLength) {
        spp3eFdcSectorDone();
      }
      return;
    }
    if (spp3eFdcCommandId == SPP3E_FDC_CMD_SCAN && spp3eFdcSector >= 0) {
      /* SCAN: the host's byte against the disk's; FF from either side always matches */
      const uint8_t disk = spp3eFdcSectorByte(spp3eFdcSectorOffset);
      const uint8_t host = (uint8_t)value;
      if (disk != 0xffu && host != 0xffu && spp3eFdcScanNotMet == 0u && spp3eFdcScanEqual == 0u) {
        if (spp3eFdcScanType == 0x11u ? disk != host :
            spp3eFdcScanType == 0x19u ? disk > host :
            disk < host) {
          spp3eFdcScanNotMet = 1u;
        }
      }
      spp3eFdcSectorOffset++;
      if (spp3eFdcSectorOffset >= spp3eFdcTransferLength) {
        /* The sector met the condition unless a byte said otherwise */
        spp3eFdcScanEqual = spp3eFdcScanNotMet == 0u ? 1u : 0u;
        if (spp3eFdcScanEqual == 0u) {
          spp3eFdcScanNotMet = 0u;
        }
        spp3eFdcSectorDone();
      }
      return;
    }
    if (spp3eFdcCommandId == SPP3E_FDC_CMD_WRITE_ID) {
      if (spp3eFdcSectorOffset < sizeof(spp3eFdcFormatIds)) {
        spp3eFdcFormatIds[spp3eFdcSectorOffset] = (uint8_t)value;
      }
      spp3eFdcSectorOffset++;
      if (spp3eFdcSectorOffset >= spp3eFdcTransferLength) {
        spp3eFdcFormatTrack();
      }
      return;
    }
  }
  if (spp3eFdcCommandBytesReceived == 0u) {
    spp3eFdcIdentifyCommand(value);
    spp3eFdcMsr = SPP3E_FDC_MSR_RQM | SPP3E_FDC_MSR_CB;
    if (spp3eFdcCommandLength == 0u) {
      spp3eFdcExecuteCommand();
      return;
    }
    spp3eFdcCommandBytesReceived = 1u;
  } else {
    spp3eFdcDataRegister[spp3eFdcCommandBytesReceived - 1u] = (uint8_t)value;
    if (spp3eFdcCommandBytesReceived >= spp3eFdcCommandLength) {
      spp3eFdcExecuteCommand();
      return;
    }
    spp3eFdcCommandBytesReceived++;
  }
}

static void spp3eFdcSetMotor(uint8_t on) {
  if (spp3eFdcEnabledDriveCount == 0u) {
    return;
  }
  Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
  if (on != 0u) {
    if (drive->motorOn == 0u) {
      drive->motorOn = 1u;
      drive->motorAcceleration = 1;
    }
  } else if (drive->motorOn != 0u) {
    drive->motorOn = 0u;
    drive->motorAcceleration = -1;
  }
  spp3eDiskRefreshReady(drive);
  spp3eFdcUpdateSr3();
}

static void spp3eDiskOnFrameCompleted(Spp3eDiskDrive *drive) {
  spp3eDiskRefreshReady(drive);
  if (drive->motorAcceleration > 0) {
    if (drive->motorSpeed < 100u) {
      const uint32_t speed = (uint32_t)drive->motorSpeed + 2u;
      drive->motorSpeed = speed > 100u ? 100u : (uint8_t)speed;
    } else {
      drive->motorAcceleration = 0;
    }
  } else if (drive->motorAcceleration < 0) {
    if (drive->motorSpeed > 0u) {
      drive->motorSpeed = drive->motorSpeed < 2u ? 0u : (uint8_t)(drive->motorSpeed - 2u);
    } else {
      drive->motorAcceleration = 0;
    }
  }
  spp3eDiskRefreshReady(drive);
}

static void spp3eFdcOnFrameCompleted(void) {
  for (uint32_t i = 0u; i < SPP3E_DISK_DRIVE_COUNT; i++) {
    spp3eDiskOnFrameCompleted(&spp3eDiskDrives[i]);
  }
  spp3eFdcUpdateSr3();
}

static void spp3eBeginMachineFrame(void) {
  spp3eFrameCompleted = 0u;
  spp3eFrameBegun = 1u;
  spp3eBeginAudioFrame();
  spp3eUlaBeginBorderFrame(spp3eNextFrameStartTact);
  spp3eCpuFrameSliceInstructions = 0u;
}

/*
 * The tact counter's origin: see `sp48ShiftTactOrigin` in the ZX Spectrum 48 core, which this
 * mirrors (issue #1374). At 2^32 T-states the frame loop's `frameEndTact` wrapped while the counter
 * did not, and the machine stopped for good. Once a frame starts past SPP3E_TACT_REBASE_THRESHOLD,
 * every absolute tact point - the PSG's clock included - moves back by that frame's start, and the
 * epoch the exports add back keeps the host's counter continuous.
 */
#define SPP3E_TACT_REBASE_THRESHOLD 0x40000000u

/* Moves every absolute tact point back by `amount` (forward when negative) */
static void spp3eShiftTactOrigin(int64_t amount) {
  const uint32_t by = (uint32_t)amount;
  const double byDouble = (double)amount;
  spp3eTacts -= by;
  cpu.tacts -= by;
  spp3eNextFrameStartTact -= by;
  spp3eBorderFrameStartTact -= by;
  spp3eAudioNextSampleTact -= byDouble;
  spp3eAudioNextSampleTactFloor = spp3eAudioNextSampleTact >= 4294967295.0
    ? 0xffffffffu
    : (uint32_t)spp3eAudioNextSampleTact;
  spp3eAudioLastLevelChangeTact -= by;
  spp3eAudioSampleWindowStartTact -= byDouble;
  for (uint32_t i = 0u; i < spp3eAudioTransitionCount; i++) spp3eAudioTransitionTacts[i] -= by;
  spp3eEarBitChangedFrom0Tacts -= by;
  spp3eEarBitChangedFrom1Tacts -= by;
  spp3eTapeStartTact -= by;
  spp3eTapeLastModeChangeTact -= by;
  spp3eTapeSaveLastMicBitTact -= by;
  sp128PsgNextClockTact -= by;
  sp128PsgLastAccumulationTact -= byDouble;
}

/* Test hook: as if `amount` tacts passed with nothing happening (see `sp48TestAdvanceTacts`) */
void spp3eTestAdvanceTacts(uint32_t amount) {
  spp3eShiftTactOrigin(-(int64_t)amount);
}

/* Test hook: what the host counter is ahead of the internal one */
uint32_t spp3eTestGetTactEpoch(void) {
  return spp3eTactEpoch;
}

static void spp3eCompleteMachineFrame(void) {
  if (spp3eFrameCompleted == 0u) {
    return;
  }

  spp3eUlaRenderUntilCurrentTact();
  spp3eNextFrameStartTact += spp3eTactsInFrame;
  spp3eFrames++;
  spp3eCpuFrameSliceInstructions = 0u;
  spp3eFdcOnFrameCompleted();
  if (spp3eNextFrameStartTact >= SPP3E_TACT_REBASE_THRESHOLD) {
    const uint32_t rebase = spp3eNextFrameStartTact;
    spp3eShiftTactOrigin(rebase);
    spp3eTactEpoch += rebase;
  }
}

/*
 * Where on a display line the gate array's first 7 is, in T-states after the line's first cell (frame
 * tact 14,364 on the top line). The published sources disagree: the WoS 128K reference puts it at
 * 14,367 (+3), the Sinclair Wiki at 14,363 (-1). ULA 128E +3 Test draws the same picture with either,
 * and so does Klive with 0, where its table always had it; no real-machine result in the kit decides
 * it (`.plans/SPECTRUM_ACCURACY_DOCS_PLAN.md`, "Not yet proven").
 */
static const uint32_t spp3eContentionPeakOffset = 0u;

/*
 * The gate array's contention: per display line 1, 0, then 7, 6, 5, 4, 3, 2, 1, 0 sixteen times, the
 * last 0 130 T-states after the first 1 (WoS 128K reference, "+2A/+3": 1 at 14,365, 7 at 14,367 and
 * so on until 14,494). It contends only MREQ cycles (Sinclair Wiki, "Contended memory"), so the table
 * is applied to memory reads and writes only: never to I/O, internal or refresh cycles.
 */
static void spp3eBuildGateArrayContention(void) {
  for (uint32_t tact = 0u; tact < spp3eTactsInFrame; tact++) spp3eContention[tact] = 0u;
  for (uint32_t line = 0u; line < 192u; line++) {
    const uint32_t cell = (spp3eFirstDisplayLine + line) * spp3eScreenLineTime;
    const uint32_t peak = cell + spp3eContentionPeakOffset;
    for (uint32_t tact = peak - 2u; tact <= peak + 127u; tact++) {
      spp3eContention[tact] = (uint8_t)(7u - ((tact + 8u - peak) & 0x07u));
    }
  }
}

void spp3eReset(void) {
  spp3eUlaInitializeTimingTables(&spp3eUlaConfig);
  spp3eBuildGateArrayContention();
  z80Reset();
  spp3eFrames = 0;
  spp3eTacts = 0;
  spp3eTactEpoch = 0u;
  spp3eNextFrameStartTact = 0u;
  spp3eTotalContentionDelaySinceStart = 0u;
  spp3eContentionDelaySincePause = 0u;
  spp3eCpuInstructionsExecuted = 0u;
  spp3eCpuFrameSliceInstructions = 0u;
  spp3eFrameCompleted = 0u;
  spp3eFrameBegun = 0u;
  spp3eInterruptsRaised = 0u;
  spp3eInterruptLineActive = 0u;
  z80ClearBusEvents();
  spp3eSelectedRom = 0u;
  spp3eSelectedBank = 0u;
  spp3ePagingEnabled = 1u;
  spp3ePort7ffd = 0u;
  spp3ePort1ffd = 0u;
  spp3eUseShadowScreen = 0u;
  spp3eInSpecialPagingMode = 0u;
  spp3eSpecialConfigMode = 0u;
  spp3eDiskMotorOn = 0u;
  spp3ePortFeValue = 0u;
  spp3eBorderColor = 7u;
  spp3eEarBit = 0u;
  spp3eMicBit = 0u;
  spp3eBeeperLevel = 0u;
  spp3eEarBitChangedFrom0Tacts = 0u;
  spp3eEarBitChangedFrom1Tacts = 0u;
  spp3eLastContendedValue = 0xffu;
  spp3eLastUlaReadValue = 0xffu;
  zxdcReset(0u);
  spp3eRebuildFlatMemory();
  spp3eResetPsg();
  spp3eResetAudio();
  spp3eCommonTapeClear();
  spp3eFdcReset();
  spp3eResetKeyboard();
  spp3eUlaRenderDisplay();
}

void spp3eHardReset(void) {
  spp3eRzxSetMode(RZX_MODE_OFF);
  spp3eReset();
  spp3eClearBytes(spp3eRam, SPP3E_RAM_SIZE);
  zxdcReset(1u);
  spp3eRebuildFlatMemory();
  for (uint32_t i = 0u; i < SPP3E_DISK_DRIVE_COUNT; i++) {
    spp3eClearBytes(spp3eDiskData[i], SPP3E_DISK_DATA_CAPACITY);
    spp3eClearBytes(spp3eDiskChanges[i], SPP3E_DISK_CHANGE_CAPACITY);
  }
}

/* The frame loop and the RZX playback steps (zx-spectrum-frame.c) */
#define ZXS_FRAME_PREFIX spp3e
#define ZXS_BEGIN_FRAME() spp3eBeginMachineFrame()
#define ZXS_FRAME_LENGTH spp3eTactsInFrame
#define ZXS_RENDER_UNTIL_CURRENT_TACT() spp3eUlaRenderUntilCurrentTact()
#define ZXS_TACT_REBASE_THRESHOLD SPP3E_TACT_REBASE_THRESHOLD
/* The +2E/+3E: a playback picture also ends the FDC's frame, and every cycle adds an audio sample */
#define ZXS_ON_PLAY_PICTURE() \
  do { \
    spp3eCpuFrameSliceInstructions = 0u; \
    spp3eFdcOnFrameCompleted(); \
  } while (0)
#define ZXS_AFTER_PLAY_CYCLE() spp3eSetNextAudioSample()
/* The DivMMC's SD card waiting for a sector returns to the host */
#define ZXS_STOP() ZXDC_HOST_WAITING()
#include "../../../zxSpectrum/wasm/common/zx-spectrum-frame.c"
/* The debugger's breakpoint flags and in-core loop, `spp3eExecuteUntilStop` (z80-debug-loop.c) */
#define Z80_DEBUG_LOOP_PREFIX spp3e
#define Z80_DEBUG_LOOP_STOP() ZXDC_HOST_WAITING()
#include "../../../../z80/wasm/z80-debug-loop.c"

uint32_t spp3eExecuteInstruction(void) {
#ifndef Z80_BENCH_STRIP_DEBUG
  if (rzxMode == RZX_MODE_PLAY) {
    return spp3eExecutePlayInstruction();
  }
#endif
  if (spp3eFrameCompleted != 0u) {
    spp3eBeginMachineFrame();
  }

#ifndef Z80_BENCH_STRIP_DEBUG
  if (spp3eCaptureBusEvents != 0u) {
    z80ClearBusEvents();
  }
#endif
  spp3eUpdateTapeMode();
  const uint8_t intActive = spp3eUlaShouldRaiseInterrupt();
  if (intActive != 0u && spp3eInterruptLineActive == 0u) {
    spp3eInterruptsRaised++;
  }
  spp3eInterruptLineActive = intActive;
  z80SetSigInt(intActive);
  z80SetTacts(spp3eTacts);
  const uint8_t divMmcNmi = zxdcNmiBeforeCycle();
  z80ExecuteCpuCycle();
  zxdcNmiAfterCycle(divMmcNmi);
  spp3eTacts = z80GetTacts();
  spp3eSetNextAudioSample();
  spp3eUpdateTapeMode();
#ifndef Z80_BENCH_STRIP_DEBUG
  spp3eCpuInstructionsExecuted++;
  spp3eCpuFrameSliceInstructions++;
#endif
  spp3eFrameCompleted =
    spp3eTacts >= spp3eNextFrameStartTact + spp3eTactsInFrame ? 1u : 0u;
#ifndef Z80_BENCH_STRIP_DEBUG
  if (rzxMode == RZX_MODE_RECORD) {
    rzxRecAfterStep(spp3eFrameCompleted);
  }
#endif
  spp3eCompleteMachineFrame();
  return 0u;
}

void spp3eUploadRomByte(uint32_t bank, uint32_t offset, uint32_t value) {
  if (bank < 4u && offset < 0x4000u) {
    const uint8_t byteValue = (uint8_t)value;
    spp3eRom[spp3eRomBankOffset(bank) + offset] = byteValue;
    if (spp3eInSpecialPagingMode == 0u && spp3eSelectedRom == (uint8_t)bank && zxdcMapped == 0u) {
      spp3eMemory[offset] = byteValue;
    }
  }
}

uint32_t spp3eReadMemory(uint32_t address) {
  const uint32_t maskedAddress = address & 0xffffu;
  const uint8_t value = spp3eMemorySlotBase[maskedAddress >> 14u][maskedAddress & 0x3fffu];
  if (spp3eIsContendedMemoryAddress(maskedAddress) != 0u) {
    spp3eLastContendedValue = value;
  }
  return value;
}

void spp3eWriteMemory(uint32_t address, uint32_t value) {
  const uint32_t maskedAddress = address & 0xffffu;
  const uint32_t slot = maskedAddress >> 14u;
  if (spp3eMemorySlotWritable[slot] == 0u) {
    /* The DivMMC's RAM page takes a write to the ROM area while it is mapped */
    if (slot == 0u && zxdcWrite(maskedAddress, (uint8_t)value) != 0u) spp3eMemory[maskedAddress] = (uint8_t)value;
    return;
  }
  const uint32_t offset = maskedAddress & 0x3fffu;
  const uint8_t byteValue = (uint8_t)value;
  if (spp3eIsVisibleScreenSlotOffset(slot, offset) != 0u) {
    /* The gate array's reads from the fetch delay on see the new byte (zx-spectrum-ula.c) */
    renderUlaBeforeWrite();
  }
  spp3eMemorySlotBase[slot][offset] = byteValue;
  spp3eMemory[maskedAddress] = byteValue;
  if (spp3eIsContendedMemoryAddress(maskedAddress) != 0u) {
    spp3eLastContendedValue = byteValue;
  }
}

uint32_t spp3eReadRamBank(uint32_t bank, uint32_t offset) {
  if (bank >= 8u || offset >= 0x4000u) {
    return 0xffu;
  }
  return spp3eRam[spp3eRamBankOffset(bank) + offset];
}

void spp3eWriteRamBank(uint32_t bank, uint32_t offset, uint32_t value) {
  if (bank >= 8u || offset >= 0x4000u) {
    return;
  }
  const uint8_t byteValue = (uint8_t)value;
  if (spp3eIsVisibleScreenBankOffset(bank, offset) != 0u) {
    spp3eUlaRenderUntilCurrentTact();
  }
  spp3eRam[spp3eRamBankOffset(bank) + offset] = byteValue;
  spp3eUpdateVisibleRamBankMirrorByte(bank, offset, byteValue);
}

uint32_t spp3eReadRomBank(uint32_t bank, uint32_t offset) {
  if (bank >= 4u || offset >= 0x4000u) {
    return 0xffu;
  }
  return spp3eRom[spp3eRomBankOffset(bank) + offset];
}

uint32_t spp3eReadScreenMemoryOffset(uint32_t offset) {
  const uint32_t bank = spp3eUseShadowScreen != 0u ? 7u : 5u;
  spp3eLastUlaReadValue = spp3eRam[spp3eRamBankOffset(bank) + (offset & 0x3fffu)];
  return spp3eLastUlaReadValue;
}

/*
 * The host's reads (memory panels, watches, the debugger): the same bytes as `spp3eReadMemory` and
 * `spp3eReadScreenMemoryOffset`, without the floating-bus latches those update for the CPU and the
 * ULA. A host read must change nothing, or looking at memory would change what the +3 does next
 * (`.plans/REVERSE_DEBUGGING_PLAN.md` Phase 1, the export contract).
 */
uint32_t spp3ePeekMemory(uint32_t address) {
  const uint32_t maskedAddress = address & 0xffffu;
  return spp3eMemorySlotBase[maskedAddress >> 14u][maskedAddress & 0x3fffu];
}

uint32_t spp3ePeekScreenMemoryOffset(uint32_t offset) {
  const uint32_t bank = spp3eUseShadowScreen != 0u ? 7u : 5u;
  return spp3eRam[spp3eRamBankOffset(bank) + (offset & 0x3fffu)];
}

void spp3eRenderInstantScreen(void) {
  spp3eUlaRenderDisplay();
}

uint32_t spp3eReadFloatingBus(void) {
  spp3eUlaRenderUntilCurrentTact();
  const uint32_t currentTactIndex =
    (spp3eUlaCurrentFrameTact() + spp3eTactsInFrame - 3u) % spp3eTactsInFrame;
  const uint8_t phase = spp3eRenderingPhase[currentTactIndex];
  switch (phase) {
    case SPP3E_RENDER_PHASE_BORDER:
    case SPP3E_RENDER_PHASE_NONE:
    case SPP3E_RENDER_PHASE_DISPLAY_B1:
    case SPP3E_RENDER_PHASE_DISPLAY_B2:
      return ((uint32_t)spp3eLastContendedValue | 0x01u) & 0xffu;
    default:
      return spp3eLastUlaReadValue;
  }
}

uint32_t spp3eReadPort(uint32_t address) {
  if (zxdcIsPort(address) != 0u) {
    return zxdcReadPort(address);
  }
  if ((address & 0x0001u) == 0u) {
    const uint32_t selectedLines = (~(address >> 8u)) & 0xffu;
    const uint8_t status = spp3eKeyboardSelectedLineValue[selectedLines];
    uint32_t portValue = ((uint32_t)~status) & 0xffu;
    if (spp3eTapeMode == SPP3E_TAPE_MODE_LOAD) {
      const uint32_t bit6Value = spp3eCommonTapeGetEarBit() != 0u ? 0x40u : 0x00u;
      return (portValue & 0xbfu) | bit6Value;
    }
    return portValue & 0xbfu;
  }

  if ((address & 0xc002u) == 0xc000u) {
    return spp3ePsgDataRead();
  }

  if ((address & 0x00e0u) == 0u) {
    return 0xffu;
  }

  if ((address & 0xf002u) == 0x2000u || (address & 0xf002u) == 0x3000u) {
    return (address & 0xf002u) == 0x2000u
      ? spp3eFdcReadMainStatusRegister()
      : spp3eFdcReadDataRegister();
  }
  return ((address & 0x0003u) == 0x0001u && spp3ePagingEnabled != 0u)
    ? spp3eReadFloatingBus()
    : 0xffu;
}

void spp3eWritePort(uint32_t address, uint32_t value) {
  if (zxdcIsPort(address) != 0u) {
    zxdcWritePort(address, value);
    return;
  }
  if ((address & 0x0001u) == 0u) {
    spp3eCommonSetNextAudioSample();
    spp3ePortFeValue = (uint8_t)value;
    const uint8_t nextBorderColor = (uint8_t)(value & 0x07u);
    if (nextBorderColor != spp3eBorderColor) {
      spp3eUlaRenderUntilCurrentTact();
      spp3eBorderColor = nextBorderColor;
      /* The 8-pixel chunk the change lands on, against the gate array's reads (zx-spectrum-ula.c) */
      ulaRepaintBorderForChange();
    }
    spp3eBorderColor = nextBorderColor;
    const uint8_t nextMicBit = (value & 0x08u) != 0u ? 1u : 0u;
    const uint8_t nextEarBit = (value & 0x10u) != 0u ? 1u : 0u;
    if (nextEarBit != spp3eEarBit || nextMicBit != spp3eMicBit) {
      spp3eCommonRecordAudioTransition(spp3eTacts, spp3eTapeMode == SPP3E_TAPE_MODE_LOAD ? spp3eTapeEarBit : nextEarBit, nextMicBit);
    }
    spp3eMicBit = nextMicBit;
    spp3eCommonTapeProcessMicBit(spp3eMicBit);
    spp3eBeeperLevel = (uint8_t)((nextMicBit != 0u ? 1u : 0u) | (nextEarBit != 0u ? 2u : 0u));
    if (spp3eEarBit != 0u) {
      if (nextEarBit == 0u) {
        spp3eEarBitChangedFrom1Tacts = spp3eTacts;
        spp3eEarBit = 0u;
      }
    } else if (nextEarBit != 0u) {
      spp3eEarBitChangedFrom0Tacts = spp3eTacts;
      spp3eEarBit = 1u;
    }
    return;
  }

  if ((address & 0xc002u) == 0xc000u) {
    spp3ePsgAddressWrite(value);
    return;
  }

  if ((address & 0xc002u) == 0x8000u) {
    spp3ePsgDataWrite(value);
    return;
  }

  if ((address & 0xc002u) == 0x4000u) {
    if (spp3ePagingEnabled == 0u) {
      return;
    }
    const uint8_t nextUseShadowScreen = (value & 0x08u) != 0u ? 1u : 0u;
    if (nextUseShadowScreen != spp3eUseShadowScreen) {
      spp3eUlaRenderUntilCurrentTact();
    }
    spp3ePort7ffd = (uint8_t)value;
    spp3eSelectedBank = (uint8_t)(value & 0x07u);
    spp3eUseShadowScreen = nextUseShadowScreen;
    spp3eSelectedRom = (uint8_t)(((value >> 4u) & 0x01u) | (spp3eSpecialConfigMode & 0x02u));
    spp3ePagingEnabled = (value & 0x20u) != 0u ? 0u : 1u;
    spp3eRebuildFlatMemory();
    return;
  }

  if ((address & 0xf002u) == 0x1000u) {
    spp3ePort1ffd = (uint8_t)value;
    spp3eInSpecialPagingMode = (value & 0x01u) != 0u ? 1u : 0u;
    spp3eSpecialConfigMode = (uint8_t)((value >> 1u) & 0x03u);
    spp3eSelectedRom = (uint8_t)((spp3eSelectedRom & 0x01u) | (spp3eSpecialConfigMode & 0x02u));
    spp3eDiskMotorOn = (value & 0x08u) != 0u ? 1u : 0u;
    spp3eFdcSetMotor(spp3eDiskMotorOn);
    spp3eRebuildFlatMemory();
    return;
  }

  if ((address & 0xf002u) == 0x3000u) {
    spp3eFdcWriteDataRegister(value);
  }
}

uint32_t spp3eGetMemorySize(void) { return SPP3E_MEMORY_SIZE; }
uint32_t spp3eGetRamSize(void) { return SPP3E_RAM_SIZE; }
uint32_t spp3eGetRomSize(void) { return SPP3E_ROM_SIZE; }
uint32_t spp3eGetScreenWidth(void) { return spp3eUlaCurrentScreenWidth(); }
uint32_t spp3eGetScreenHeight(void) { return spp3eUlaCurrentScreenHeight(); }
uint32_t spp3eGetPixelBufferStartOffset(void) { return 0u; }
uint32_t spp3eGetAudioSampleCapacity(void) { return SPP3E_AUDIO_SAMPLE_CAPACITY; }
uint32_t spp3eGetAudioSampleCount(void) { return spp3eAudioSampleCount; }
uint32_t spp3eGetAudioSampleRate(void) { return spp3eAudioSampleRate; }
void spp3eSetAudioSampleRate(uint32_t value) {
  spp3eCommonSetAudioSampleRate(value);
}
uint32_t spp3eGetDiskDataCapacity(void) { return SPP3E_DISK_DATA_CAPACITY; }
uint32_t spp3eGetDiskChangeCapacity(void) { return SPP3E_DISK_CHANGE_CAPACITY; }
uint32_t spp3eGetDiskDriveCount(void) { return SPP3E_DISK_DRIVE_COUNT; }
uint32_t spp3eGetFdcEnabledDriveCount(void) { return spp3eFdcEnabledDriveCount; }
void spp3eSetFdcEnabledDriveCount(uint32_t value) {
  spp3eFdcEnabledDriveCount = spp3eNormalizeEnabledDriveCount(value);
  if (spp3eFdcCurrentDrive >= spp3eFdcEnabledDriveCount && spp3eFdcEnabledDriveCount > 0u) {
    spp3eFdcCurrentDrive = 0u;
  }
  spp3eFdcSelectDriveInternal(spp3eFdcCurrentDrive, spp3eGetDiskDrive(spp3eFdcCurrentDrive)->currentHead);
  spp3eFdcUpdateSr3();
}
void spp3eFdcResetController(void) { spp3eFdcReset(); }
uint32_t spp3eFdcGetMainStatusRegister(void) { return spp3eFdcEnabledDriveCount == 0u ? 0xffu : spp3eFdcMsr; }
uint32_t spp3eFdcGetStatusRegister0(void) { return spp3eFdcSr0; }
uint32_t spp3eFdcGetStatusRegister1(void) { return spp3eFdcSr1; }
uint32_t spp3eFdcGetStatusRegister2(void) { return spp3eFdcSr2; }
uint32_t spp3eFdcGetStatusRegister3(void) {
  spp3eFdcUpdateSr3();
  return spp3eFdcSr3;
}
uint32_t spp3eFdcGetOperationPhase(void) { return spp3eFdcOperationPhase; }
uint32_t spp3eFdcGetCurrentDrive(void) { return spp3eFdcCurrentDrive; }
uint32_t spp3eFdcGetResultBytesLeft(void) { return spp3eFdcResultBytesLeft; }
uint32_t spp3eFdcGetDataRegister(uint32_t index) { return spp3eFdcDataRegister[index % 9u]; }
uint32_t spp3eFdcGetResultRegister(uint32_t index) { return spp3eFdcResultRegister[index % 9u]; }
uint32_t spp3eFdcGetCommandId(void) { return spp3eFdcCommandId; }
uint32_t spp3eFdcGetCommandRegister(void) { return spp3eFdcCommandRegister; }
uint32_t spp3eFdcGetCommandBytesReceived(void) { return spp3eFdcCommandBytesReceived; }
uint32_t spp3eFdcGetStepRate(void) { return spp3eFdcStepRate; }
uint32_t spp3eFdcGetHeadUnloadTime(void) { return spp3eFdcHeadUnloadTime; }
uint32_t spp3eFdcGetHeadLoadTime(void) { return spp3eFdcHeadLoadTime; }
uint32_t spp3eFdcGetNonDmaMode(void) { return spp3eFdcNonDmaMode; }
uint32_t spp3eFdcGetDirtyDrive(void) { return spp3eFdcDirtyDrive; }
uint32_t spp3eFdcGetDirtyOffset(void) { return spp3eFdcDirtyOffset; }
uint32_t spp3eFdcGetDirtyLength(void) { return spp3eFdcDirtyLength; }
uint32_t spp3eFdcGetDirtyRevision(void) { return spp3eFdcDirtyRevision; }
void spp3eFdcSetResultPhase(uint32_t resultBytes, uint32_t firstByte) {
  spp3eFdcOperationPhase = SPP3E_FDC_PHASE_RESULT;
  spp3eFdcResultBytesLeft = (uint8_t)(resultBytes & 0xffu);
  spp3eFdcResultIndex = 0u;
  spp3eFdcResultRegister[0] = (uint8_t)firstByte;
  spp3eFdcMsr = SPP3E_FDC_MSR_RQM | SPP3E_FDC_MSR_DIO | SPP3E_FDC_MSR_CB;
}
void spp3eFdcSelectDrive(uint32_t drive, uint32_t head) {
  spp3eFdcSelectDriveInternal(drive, head);
  spp3eFdcUpdateSr3();
}
/*
 * Uploading a disk (the host's `createWasmDiskPayload`): BeginUpload clears the drive, the host
 * writes the sector data into the data area (`spp3eDiskDataPtr`), declares each formatted track
 * with UploadTrack and its sectors, in physical order, with UploadSector; FinishUpload inserts it.
 * The geometry is the image's: `cylinders` x `sides`, and a drive that takes more than 42 cylinders
 * steps up to 84 (an 80-track drive B).
 */
uint32_t spp3eDiskBeginUpload(
  uint32_t drive,
  uint32_t length,
  uint32_t writeProtected,
  uint32_t cylinders,
  uint32_t sides
) {
  if (drive >= SPP3E_DISK_DRIVE_COUNT || drive >= spp3eFdcEnabledDriveCount || length > SPP3E_DISK_DATA_CAPACITY ||
      cylinders > SPP3E_DISK_MAX_CYLINDERS) {
    return 0u;
  }
  spp3eDiskUploadDrive = (uint8_t)drive;
  spp3eDiskUploadLength = length;
  spp3eDiskUploadWriteProtected = writeProtected != 0u ? 1u : 0u;
  spp3eDiskUploadTracks = (uint8_t)cylinders;
  spp3eDiskUploadSides = sides > 1u ? 2u : 1u;
  spp3eDiskUploadTrackEntry = -1;
  spp3eDiskUploadSectors = 0u;
  spp3eDiskUploadActive = 1u;
  spp3eClearBytes(spp3eDiskData[drive], SPP3E_DISK_DATA_CAPACITY);
  spp3eClearBytes(spp3eDiskChanges[drive], SPP3E_DISK_CHANGE_CAPACITY);
  spp3eClearBytes((uint8_t *)spp3eDiskTracks[drive], (uint32_t)sizeof(spp3eDiskTracks[drive]));
  spp3eClearBytes((uint8_t *)spp3eDiskSectors[drive], (uint32_t)sizeof(spp3eDiskSectors[drive]));
  return 1u;
}
uint32_t spp3eDiskWriteData(uint32_t drive, uint32_t offset, uint32_t value) {
  if (
    spp3eDiskUploadActive == 0u ||
    drive != spp3eDiskUploadDrive ||
    offset >= spp3eDiskUploadLength ||
    offset >= SPP3E_DISK_DATA_CAPACITY
  ) {
    return 0u;
  }
  spp3eDiskData[drive][offset] = (uint8_t)value;
  return 1u;
}
/* Declares a formatted track; the sectors uploaded next are its sectors */
uint32_t spp3eDiskUploadTrack(uint32_t drive, uint32_t cylinder, uint32_t head, uint32_t gap3, uint32_t filler, uint32_t sizeCode) {
  if (spp3eDiskUploadActive == 0u || drive != spp3eDiskUploadDrive || cylinder >= SPP3E_DISK_MAX_CYLINDERS || head > 1u) {
    return 0u;
  }
  Spp3eDiskTrack *track = &spp3eDiskTracks[drive][cylinder * 2u + head];
  track->firstSector = spp3eDiskUploadSectors;
  track->sectorCount = 0u;
  track->formatted = 1u;
  track->gap3 = (uint8_t)gap3;
  track->filler = (uint8_t)filler;
  track->sizeCode = (uint8_t)sizeCode;
  spp3eDiskUploadTrackEntry = (int32_t)(cylinder * 2u + head);
  return 1u;
}
/* Adds a sector to the last declared track: its ID, status, `copies` x `length` bytes at `offset` */
uint32_t spp3eDiskUploadSector(
  uint32_t drive,
  uint32_t id,
  uint32_t status,
  uint32_t offset,
  uint32_t length
) {
  if (spp3eDiskUploadActive == 0u || drive != spp3eDiskUploadDrive || spp3eDiskUploadTrackEntry < 0 ||
      spp3eDiskUploadSectors >= SPP3E_DISK_SECTOR_CAPACITY) {
    return 0u;
  }
  Spp3eDiskTrack *track = &spp3eDiskTracks[drive][spp3eDiskUploadTrackEntry];
  const uint32_t copies = (status >> 16u) & 0xffu;
  if (track->sectorCount >= SPP3E_DISK_MAX_SECTORS_PER_TRACK ||
      offset + length * (copies == 0u ? 1u : copies) > spp3eDiskUploadLength) {
    return 0u;
  }
  Spp3eDiskSector *sector = &spp3eDiskSectors[drive][spp3eDiskUploadSectors];
  sector->c = (uint8_t)(id & 0xffu);
  sector->h = (uint8_t)((id >> 8u) & 0xffu);
  sector->r = (uint8_t)((id >> 16u) & 0xffu);
  sector->n = (uint8_t)((id >> 24u) & 0xffu);
  sector->st1 = (uint8_t)(status & 0xffu);
  sector->st2 = (uint8_t)((status >> 8u) & 0xffu);
  sector->copies = (uint8_t)(copies == 0u ? 1u : copies);
  sector->offset = offset;
  sector->length = (uint16_t)length;
  track->sectorCount++;
  spp3eDiskUploadSectors++;
  return 1u;
}
uint32_t spp3eDiskFinishUpload(uint32_t drive) {
  if (spp3eDiskUploadActive == 0u || drive != spp3eDiskUploadDrive) {
    return 0u;
  }
  Spp3eDiskDrive *diskDrive = spp3eGetDiskDrive(drive);
  /* A disk with no formatted track (a blank, never-formatted one) is still a disk in the drive */
  diskDrive->hasDiskLoaded = spp3eDiskUploadLength > 0u || spp3eDiskUploadSectors > 0u || spp3eDiskUploadTracks > 0u ? 1u : 0u;
  diskDrive->diskLength = spp3eDiskUploadLength;
  diskDrive->writeProtected = spp3eDiskUploadWriteProtected;
  diskDrive->hasTwoHeads = spp3eDiskUploadSides > 1u ? 1u : 0u;
  diskDrive->imageCylinders = spp3eDiskUploadTracks;
  diskDrive->imageSides = spp3eDiskUploadSides;
  diskDrive->maxCylinders = spp3eDiskUploadTracks > SPP3E_DISK_DEFAULT_MAX_CYLINDERS
    ? SPP3E_DISK_LONG_DRIVE_CYLINDERS
    : SPP3E_DISK_DEFAULT_MAX_CYLINDERS;
  diskDrive->sectorsUsed = spp3eDiskUploadSectors;
  diskDrive->rotation = 0u;
  diskDrive->weakCounter = 0u;
  /* A disk put in the drive does not move the head (the IDE re-inserts an edited disk mid-session) */
  if (diskDrive->currentCylinder >= diskDrive->maxCylinders) {
    diskDrive->currentCylinder = (uint8_t)(diskDrive->maxCylinders - 1u);
  }
  diskDrive->track0Mark = diskDrive->currentCylinder == 0u ? 1u : 0u;
  diskDrive->currentHead = diskDrive->hasTwoHeads != 0u ? diskDrive->currentHead : 0u;
  diskDrive->headLoaded = diskDrive->selected != 0u && diskDrive->hasDiskLoaded != 0u ? 1u : 0u;
  diskDrive->revision++;
  spp3eDiskRefreshReady(diskDrive);
  spp3eFdcUpdateSr3();
  spp3eDiskUploadActive = 0u;
  return 1u;
}
void spp3eDiskEject(uint32_t drive) {
  if (drive >= SPP3E_DISK_DRIVE_COUNT) {
    return;
  }
  Spp3eDiskDrive *diskDrive = spp3eGetDiskDrive(drive);
  diskDrive->hasDiskLoaded = 0u;
  diskDrive->writeProtected = 0u;
  diskDrive->headLoaded = 0u;
  diskDrive->ready = 0u;
  diskDrive->diskLength = 0u;
  diskDrive->revision++;
  spp3eFdcUpdateSr3();
}
void spp3eDiskSetWriteProtected(uint32_t drive, uint32_t value) {
  Spp3eDiskDrive *diskDrive = spp3eGetDiskDrive(drive);
  diskDrive->writeProtected = value != 0u ? 1u : 0u;
  diskDrive->revision++;
  spp3eFdcUpdateSr3();
}
uint32_t spp3eDiskReadData(uint32_t drive, uint32_t offset) {
  return drive < SPP3E_DISK_DRIVE_COUNT && offset < SPP3E_DISK_DATA_CAPACITY ? spp3eDiskData[drive][offset] : 0xffu;
}
uint32_t spp3eDiskGetLoaded(uint32_t drive) { return spp3eGetDiskDrive(drive)->hasDiskLoaded; }
uint32_t spp3eDiskGetWriteProtected(uint32_t drive) { return spp3eGetDiskDrive(drive)->writeProtected; }
uint32_t spp3eDiskGetSelected(uint32_t drive) { return spp3eGetDiskDrive(drive)->selected; }
uint32_t spp3eDiskGetHasTwoHeads(uint32_t drive) { return spp3eGetDiskDrive(drive)->hasTwoHeads; }
uint32_t spp3eDiskGetCurrentHead(uint32_t drive) { return spp3eGetDiskDrive(drive)->currentHead; }
uint32_t spp3eDiskGetTrack0(uint32_t drive) { return spp3eGetDiskDrive(drive)->track0Mark; }
uint32_t spp3eDiskGetReady(uint32_t drive) { return spp3eGetDiskDrive(drive)->ready; }
uint32_t spp3eDiskGetMotorOn(uint32_t drive) { return spp3eGetDiskDrive(drive)->motorOn; }
uint32_t spp3eDiskGetMotorSpeed(uint32_t drive) { return spp3eGetDiskDrive(drive)->motorSpeed; }
uint32_t spp3eDiskGetCurrentCylinder(uint32_t drive) { return spp3eGetDiskDrive(drive)->currentCylinder; }
uint32_t spp3eDiskGetMaxCylinders(uint32_t drive) { return spp3eGetDiskDrive(drive)->maxCylinders; }
uint32_t spp3eDiskGetHeadLoaded(uint32_t drive) { return spp3eGetDiskDrive(drive)->headLoaded; }
uint32_t spp3eDiskGetLength(uint32_t drive) { return spp3eGetDiskDrive(drive)->diskLength; }
uint32_t spp3eDiskGetRevision(uint32_t drive) { return spp3eGetDiskDrive(drive)->revision; }
/* Reading the disk back (the host's write-back): the geometry, the track and sector tables */
uint32_t spp3eDiskGetImageCylinders(uint32_t drive) { return spp3eGetDiskDrive(drive)->imageCylinders; }
uint32_t spp3eDiskGetImageSides(uint32_t drive) { return spp3eGetDiskDrive(drive)->imageSides; }
uint32_t spp3eDiskGetStructureRevision(uint32_t drive) { return spp3eGetDiskDrive(drive)->structureRevision; }
uint32_t spp3eDiskGetSectorCapacity(void) { return SPP3E_DISK_SECTOR_CAPACITY; }
/* formatted << 31 | sector count << 16 | first sector entry, or 0 for an unformatted track */
uint32_t spp3eDiskGetTrackInfo(uint32_t drive, uint32_t cylinder, uint32_t head) {
  const Spp3eDiskTrack *track = spp3eDiskTrackAt(drive, cylinder, head);
  if (track == 0 || track->formatted == 0u) return 0u;
  return 0x80000000u | ((uint32_t)track->sectorCount << 16u) | track->firstSector;
}
/* gap3 | filler << 8 | size code << 16 */
uint32_t spp3eDiskGetTrackFormat(uint32_t drive, uint32_t cylinder, uint32_t head) {
  const Spp3eDiskTrack *track = spp3eDiskTrackAt(drive, cylinder, head);
  if (track == 0) return 0u;
  return (uint32_t)track->gap3 | ((uint32_t)track->filler << 8u) | ((uint32_t)track->sizeCode << 16u);
}
/* C | H << 8 | R << 16 | N << 24 */
uint32_t spp3eDiskGetSectorId(uint32_t drive, uint32_t index) {
  const Spp3eDiskSector *sector = spp3eDiskSectorAt(drive, (int32_t)index);
  if (sector == 0) return 0u;
  return (uint32_t)sector->c | ((uint32_t)sector->h << 8u) | ((uint32_t)sector->r << 16u) | ((uint32_t)sector->n << 24u);
}
/* ST1 | ST2 << 8 | copies << 16 */
uint32_t spp3eDiskGetSectorStatus(uint32_t drive, uint32_t index) {
  const Spp3eDiskSector *sector = spp3eDiskSectorAt(drive, (int32_t)index);
  if (sector == 0) return 0u;
  return (uint32_t)sector->st1 | ((uint32_t)sector->st2 << 8u) | ((uint32_t)sector->copies << 16u);
}
uint32_t spp3eDiskGetSectorOffset(uint32_t drive, uint32_t index) {
  const Spp3eDiskSector *sector = spp3eDiskSectorAt(drive, (int32_t)index);
  return sector == 0 ? 0u : sector->offset;
}
uint32_t spp3eDiskGetSectorLength(uint32_t drive, uint32_t index) {
  const Spp3eDiskSector *sector = spp3eDiskSectorAt(drive, (int32_t)index);
  return sector == 0 ? 0u : sector->length;
}
/* The host took the changes: clear the drive's dirty-sector bitmap */
void spp3eDiskClearDirty(uint32_t drive) {
  if (drive < SPP3E_DISK_DRIVE_COUNT) {
    spp3eClearBytes(spp3eDiskChanges[drive], SPP3E_DISK_CHANGE_CAPACITY);
  }
}
uint32_t spp3eGetTapeMaxBlocks(void) { return SPP3E_TAPE_MAX_BLOCKS; }
uint32_t spp3eGetTapeDataCapacity(void) { return SPP3E_TAPE_DATA_CAPACITY; }
uint32_t spp3eGetTapeSaveMaxBlocks(void) { return SPP3E_TAPE_SAVE_MAX_BLOCKS; }
uint32_t spp3eGetTapeSaveDataCapacity(void) { return SPP3E_TAPE_SAVE_DATA_CAPACITY; }
void spp3eTapeClear(void) { spp3eCommonTapeClear(); }
uint32_t spp3eTapeBeginUpload(uint32_t blockCount, uint32_t dataLength) {
  return spp3eCommonTapeBeginUpload(blockCount, dataLength);
}
uint32_t spp3eTapeSetBlock(
  uint32_t index,
  uint32_t offset,
  uint32_t length,
  uint32_t pauseAfter,
  uint32_t pilotPulseLength,
  uint32_t sync1PulseLength,
  uint32_t sync2PulseLength,
  uint32_t zeroBitPulseLength,
  uint32_t oneBitPulseLength,
  uint32_t endSyncPulseLength,
  uint32_t lastByteUsedBits,
  uint32_t pilotPulseCount
) {
  return spp3eCommonTapeSetBlock(
    index,
    offset,
    length,
    pauseAfter,
    pilotPulseLength == 0u ? SPP3E_TAPE_PILOT_PULSE_LENGTH : pilotPulseLength,
    sync1PulseLength == 0u ? SPP3E_TAPE_SYNC1_PULSE_LENGTH : sync1PulseLength,
    sync2PulseLength == 0u ? SPP3E_TAPE_SYNC2_PULSE_LENGTH : sync2PulseLength,
    zeroBitPulseLength == 0u ? SPP3E_TAPE_BIT0_PULSE_LENGTH : zeroBitPulseLength,
    oneBitPulseLength == 0u ? SPP3E_TAPE_BIT1_PULSE_LENGTH : oneBitPulseLength,
    endSyncPulseLength == 0u ? SPP3E_TAPE_TERM_SYNC_PULSE_LENGTH : endSyncPulseLength,
    lastByteUsedBits == 0u ? 8u : lastByteUsedBits,
    pilotPulseCount
  );
}
uint32_t spp3eTapeWriteData(uint32_t offset, uint32_t value) {
  return spp3eCommonTapeWriteData(offset, value);
}
uint32_t spp3eTapeFinishUpload(void) {
  return spp3eCommonTapeFinishUpload();
}
void spp3eTapeRewind(void) {
  spp3eCommonTapeRewind();
}
void spp3eTapeSetMode(uint32_t value) {
  spp3eCommonTapeSetMode(value);
}
void spp3eTapeSetFastLoad(uint32_t value) { spp3eCommonTapeSetFastLoad(value); }
uint32_t spp3eTapeGetFastLoad(void) { return spp3eCommonTapeGetFastLoad(); }
uint32_t spp3eTapeGetBlockCount(void) { return spp3eTapeBlockCount; }
uint32_t spp3eTapeGetDataLength(void) { return spp3eTapeDataLength; }
uint32_t spp3eTapeGetLoaded(void) { return spp3eTapeLoaded; }
uint32_t spp3eTapeGetEof(void) { return spp3eTapeEof; }
uint32_t spp3eTapeGetUploadActive(void) { return spp3eTapeUploadActive; }
uint32_t spp3eTapeGetMode(void) { return spp3eTapeMode; }
uint32_t spp3eTapeGetCurrentBlockIndex(void) { return spp3eTapeCurrentBlockIndex; }
uint32_t spp3eTapeGetCurrentEarBit(void) { return spp3eTapeMode == SPP3E_TAPE_MODE_LOAD ? spp3eCommonTapeGetEarBit() : spp3eTapeEarBit; }
uint32_t spp3eTapeGetBlockOffset(uint32_t index) {
  return index < spp3eTapeBlockCount ? spp3eTapeBlocks[index].offset : 0u;
}
uint32_t spp3eTapeGetBlockLength(uint32_t index) {
  return index < spp3eTapeBlockCount ? spp3eTapeBlocks[index].length : 0u;
}
uint32_t spp3eTapeGetBlockPauseAfter(uint32_t index) {
  return index < spp3eTapeBlockCount ? spp3eTapeBlocks[index].pauseAfter : 0u;
}
void spp3eTapeClearSavedBlocks(void) { spp3eCommonTapeClearSavedBlocks(); }
uint32_t spp3eTapeAppendSavedByte(uint32_t value) {
  if (spp3eTapeSavedDataLength >= SPP3E_TAPE_SAVE_DATA_CAPACITY) {
    return 0u;
  }

  if (spp3eTapeSavedBlockCount == 0u) {
    spp3eTapeSavedBlockCount = 1u;
    spp3eTapeSaveBlocks[0].offset = 0u;
    spp3eTapeSaveBlocks[0].length = 0u;
    spp3eTapeSaveBlocks[0].pauseAfter = 1000u;
  }

  spp3eTapeSaveData[spp3eTapeSavedDataLength++] = (uint8_t)value;
  spp3eTapeSaveBlocks[spp3eTapeSavedBlockCount - 1u].length++;
  spp3eTapeSavedRevision++;
  return 1u;
}
uint32_t spp3eTapeGetSavedBlockCount(void) { return spp3eTapeSavedBlockCount; }
uint32_t spp3eTapeGetSavedDataLength(void) { return spp3eTapeSavedDataLength; }
uint32_t spp3eTapeGetSavedRevision(void) { return spp3eTapeSavedRevision; }
uint32_t spp3eTapeGetSavedBlockOffset(uint32_t index) {
  return index < spp3eTapeSavedBlockCount ? spp3eTapeSaveBlocks[index].offset : 0u;
}
uint32_t spp3eTapeGetSavedBlockLength(uint32_t index) {
  return index < spp3eTapeSavedBlockCount ? spp3eTapeSaveBlocks[index].length : 0u;
}
uint32_t spp3eGetPsgRegisterIndex(void) { return sp128PsgRegisterIndex & 0x0fu; }
void spp3eSetPsgRegisterIndex(uint32_t value) { spp3ePsgAddressWrite(value); }
uint32_t spp3eGetPsgRegisterValue(uint32_t index) { return sp128PsgGetRegisterValue(index); }
void spp3eWritePsgRegisterValue(uint32_t value) { spp3ePsgDataWrite(value); }
uint32_t spp3eReadPsgRegisterValue(void) { return spp3ePsgDataRead(); }
uint32_t spp3eGetPsgToneA(void) { return sp128PsgGetToneA(); }
uint32_t spp3eGetPsgToneB(void) { return sp128PsgTone[1].period; }
uint32_t spp3eGetPsgToneC(void) { return sp128PsgTone[2].period; }
uint32_t spp3eGetPsgVolumeA(void) { return sp128PsgGetVolumeA(); }
uint32_t spp3eGetPsgVolumeB(void) { return sp128PsgTone[1].volume & 0x0fu; }
uint32_t spp3eGetPsgVolumeC(void) { return sp128PsgTone[2].volume & 0x0fu; }
int32_t spp3eGetPsgCurrentOutput(void) {
  sp128PsgPrepareAudioSample((double)spp3eTacts);
  return sp128PsgCurrentOutput;
}
uint32_t spp3eGetTactsInFrame(void) { return spp3eTactsInFrame; }
uint32_t spp3eGetFrames(void) { return spp3eFrames; }
uint32_t spp3eGetTacts(void) { return spp3eTacts + spp3eTactEpoch; }
uint32_t spp3eGetCurrentFrameTact(void) { return spp3eUlaCurrentFrameTact(); }
uint32_t spp3eGetFrameCompleted(void) { return spp3eFrameCompleted; }
void spp3eSetTacts(uint32_t value) {
  spp3eTacts = value - spp3eTactEpoch;
  z80SetTacts(spp3eTacts);
  spp3eSetNextAudioSample();
}
uint32_t spp3eGetSelectedRom(void) { return spp3eSelectedRom; }
uint32_t spp3eGetSelectedBank(void) { return spp3eSelectedBank; }
uint32_t spp3eGetPagingEnabled(void) { return spp3ePagingEnabled; }
uint32_t spp3eGetPort7ffd(void) { return spp3ePort7ffd; }
uint32_t spp3eGetPort1ffd(void) { return spp3ePort1ffd; }
uint32_t spp3eGetUseShadowScreen(void) { return spp3eUseShadowScreen; }
uint32_t spp3eGetScreenBank(void) { return spp3eUseShadowScreen != 0u ? 7u : 5u; }
uint32_t spp3eGetInSpecialPagingMode(void) { return spp3eInSpecialPagingMode; }
uint32_t spp3eGetSpecialConfigMode(void) { return spp3eSpecialConfigMode; }
uint32_t spp3eGetDiskMotorOn(void) { return spp3eDiskMotorOn; }
int32_t spp3eGetCurrentPartition(uint32_t slot) { return spp3eMemorySlotPartition[slot & 0x03u]; }
uint32_t spp3eGetRomFlag(uint32_t slot) { return spp3eMemorySlotWritable[slot & 0x03u] == 0u ? 1u : 0u; }
uint32_t spp3eGetContentionValue(uint32_t tact) {
  return tact < SPP3E_TACTS_PER_FRAME ? spp3eContention[tact] : 0u;
}
void spp3eSetContentionValue(uint32_t tact, uint32_t value) {
  if (tact < SPP3E_TACTS_PER_FRAME) {
    spp3eContention[tact] = (uint8_t)value;
  }
}
uint32_t spp3eGetRenderingPhase(uint32_t tact) { return spp3eRenderingPhase[tact % SPP3E_TACTS_PER_FRAME]; }
uint32_t spp3eGetRenderingPixelAddress(uint32_t tact) { return spp3eRenderingPixelAddress[tact % SPP3E_TACTS_PER_FRAME]; }
uint32_t spp3eGetRenderingAttributeAddress(uint32_t tact) { return spp3eRenderingAttributeAddress[tact % SPP3E_TACTS_PER_FRAME]; }
uint32_t spp3eGetRenderingPixelIndex(uint32_t tact) { return spp3eRenderingPixelIndex[tact % SPP3E_TACTS_PER_FRAME]; }

/* The beam position overlay (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.3): the beam, one field per call
   (see ulaBeamInfo), and rendering the paused picture up to it, which changes nothing later (T2) */
uint32_t spp3eGetBeamInfo(uint32_t field) { return ulaBeamInfo(field); }
void spp3eRenderToBeam(void) { spp3eUlaRenderUntilCurrentTact(); }
/*
 * A test and control export: the wait a memory access to the address would have now (paging decides
 * which slots are contended). The CPU does not call it: its internal and refresh cycles are not
 * contended on the gate array (`spp3eCpuDelayAddressBusAccess`).
 */
void spp3eDelayAddressBusAccess(uint32_t address) {
  if (spp3eIsContendedMemoryAddress(address) != 0u) {
    spp3eApplyContentionDelay();
  }
}
void spp3eDelayPortRead(uint32_t address) { spp3eDelayPortAccess(address); }
void spp3eDelayPortWrite(uint32_t address) { spp3eDelayPortAccess(address); }
void spp3eResetContentionCounters(void) {
  spp3eTotalContentionDelaySinceStart = 0u;
  spp3eContentionDelaySincePause = 0u;
}
uint32_t spp3eGetTotalContentionDelaySinceStart(void) { return spp3eTotalContentionDelaySinceStart; }
uint32_t spp3eGetContentionDelaySincePause(void) { return spp3eContentionDelaySincePause; }
uint32_t spp3eGetCpuInstructionsExecuted(void) { return spp3eCpuInstructionsExecuted; }
uint32_t spp3eGetCpuFrameSliceInstructions(void) { return spp3eCpuFrameSliceInstructions; }
uint32_t spp3eGetInterruptsRaised(void) { return spp3eInterruptsRaised; }
uint32_t spp3eGetInterruptLineActive(void) { return spp3eInterruptLineActive; }
uint32_t spp3eGetCpuTacts(void) { return z80GetTacts() + spp3eTactEpoch; }

// --- Step-out needs to know when a RET returned to its caller. The shared Z80 core has always
// --- tracked this; the +3E simply never exposed it, so its step-out could only stop on reaching
// --- the recorded return address. Mirrors sp48/sp128.

uint32_t spp3eGetPortFeValue(void) { return spp3ePortFeValue; }
uint32_t spp3eGetBorderColor(void) { return spp3eBorderColor; }
uint32_t spp3eGetEarBit(void) { return spp3eEarBit; }
uint32_t spp3eGetMicBit(void) { return spp3eMicBit; }
uint32_t spp3eGetBeeperLevel(void) { return spp3eBeeperLevel; }
uint32_t spp3eGetLastContendedValue(void) { return spp3eLastContendedValue; }
uint32_t spp3eGetLastUlaReadValue(void) { return spp3eLastUlaReadValue; }
void spp3eSetLastContendedValue(uint32_t value) { spp3eLastContendedValue = (uint8_t)value; }
void spp3eSetLastUlaReadValue(uint32_t value) { spp3eLastUlaReadValue = (uint8_t)value; }

// -----------------------------------------------------------------------------
// Breakpoint conditions (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`): the shared evaluator, with
// this machine's side-effect-free reads. The CPU view reads the slot bases directly:
// `spp3eReadMemory` latches the floating-bus value on a contended address, which a condition must
// never do. The partition reads mirror `getMemoryPartition` in `ZxSpectrumP3eWasmV2Machine.ts`.
// -----------------------------------------------------------------------------

static uint32_t condSpp3ePeekPartition(int32_t partition, uint32_t address) {
  const uint32_t offset = address % 0x4000u;
  if (partition < 0) {
    int32_t rom = -partition - 1;
    if (rom < 0) rom = 0;
    if (rom > 3) rom = 3;
    return spp3eRom[(uint32_t)rom * 0x4000u + offset];
  }
  return spp3eRam[((uint32_t)partition & 0x07u) * 0x4000u + offset];
}

#define COND_PEEK(address) ((uint32_t)spp3eMemorySlotBase[((address) & 0xffffu) >> 14][(address) & 0x3fffu])
#define COND_PEEK_PARTITION(partition, address) condSpp3ePeekPartition(partition, address)
#define COND_PARTITION_OF(address) ((int64_t)spp3eGetCurrentPartition((address) >> 14))
#include "../../../../z80/wasm/z80-condition.c"

// -----------------------------------------------------------------------------
// Execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3, Phase 3): the shared recorder,
// with this machine's side-effect-free peek (the slot map, without the floating-bus latch
// `spp3eReadMemory` keeps), its frame position in T-states (trap T4) and its context.
//
// The context (`spp3eContext.ts` decodes it):
//   0    port $7FFD   1 port $1FFD
//   2-5  the partition of each 16K slot (`spp3eMemorySlotPartition`, what `getPartition` names), a
//        signed byte: the ROMs -1..-4, the RAM banks 0-7 - the special paging modes included
//   6    bit 0 a special (all-RAM) paging mode is on
// -----------------------------------------------------------------------------

static inline void spp3eHistoryContext(uint32_t kind, uint8_t *out) {
  (void)kind;
  out[0] = spp3ePort7ffd;
  out[1] = spp3ePort1ffd;
  for (uint32_t slot = 0u; slot < 4u; slot++) out[2u + slot] = (uint8_t)spp3eMemorySlotPartition[slot];
  out[6] = spp3eInSpecialPagingMode != 0u ? 0x01u : 0u;
  for (uint32_t i = 7u; i < 16u; i++) out[i] = 0u;
}

#define Z80_HISTORY_CAPACITY 65536u
#define Z80_HISTORY_PEEK(address) spp3eMemorySlotBase[((address) & 0xffffu) >> 14u][(address) & 0x3fffu]
#define Z80_HISTORY_CONTEXT(kind, out16) spp3eHistoryContext(kind, out16)
#define Z80_HISTORY_FRAME() spp3eFrames
#define Z80_HISTORY_FRAME_TACT() spp3eUlaCurrentFrameTact()
#include "../../../../z80/wasm/z80-history.c"

// -----------------------------------------------------------------------------
// The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2, D4): the shared module, with
// this machine's physical layout. Time is in CPU T-states (D8).
//
// One linear offset space over the physical arrays: RAM banks 0-7 ($00000-$1FFFF), then ROMs 0-3
// ($20000-$2FFFF). `src/common/profile/layouts/spp3e.ts` names them in `getPartition`'s terms.
//
// The mapping goes through `spp3eMemorySlotBase`, which the special (all-RAM) paging modes set too,
// never the flat `spp3eMemory` mirror (trap T3). A write to a ROM slot does not reach memory, so it
// maps nowhere (T2); in a special paging mode every slot is RAM, so reads and writes agree.
// -----------------------------------------------------------------------------

#define SPP3E_PROFILE_ROM_BASE SPP3E_RAM_SIZE

static inline int32_t spp3eProfilePhys(uint32_t address, uint32_t write) {
  const uint32_t a = address & 0xffffu;
  const uint32_t slot = a >> 14u;
  if (write != 0u && spp3eMemorySlotWritable[slot] == 0u) return -1;
  const uintptr_t p = (uintptr_t)spp3eMemorySlotBase[slot] + (a & 0x3fffu);
  const uintptr_t ram = (uintptr_t)spp3eRam;
  const uintptr_t rom = (uintptr_t)spp3eRom;
  if (p - ram < SPP3E_RAM_SIZE) return (int32_t)(p - ram);
  if (p - rom < SPP3E_ROM_SIZE) return (int32_t)(SPP3E_PROFILE_ROM_BASE + (p - rom));
  return -1;
}

/* 192 KB of flags; the pool holds all 24 of its 8K pages, so no page ever loses its counters (T6) */
#define Z80_PROFILE_FLAG_BYTES (SPP3E_RAM_SIZE + SPP3E_ROM_SIZE)
#define Z80_PROFILE_POOL_PAGES 24u
#define Z80_PROFILE_PHYS_READ(address) spp3eProfilePhys((uint32_t)(address), 0u)
#define Z80_PROFILE_PHYS_WRITE(address) spp3eProfilePhys((uint32_t)(address), 1u)
#define Z80_PROFILE_FRAME_TICKS() cpu.tacts
#include "../../../../z80/wasm/z80-profile.c"
