#include <stdint.h>

#define SPP3E_MEMORY_SIZE 0x10000u
#define SPP3E_RAM_SIZE 0x20000u
#define SPP3E_ROM_SIZE 0x10000u
#define SPP3E_KEYBOARD_LINE_COUNT 8u
#define SPP3E_SCREEN_WIDTH 352u
#define SPP3E_SCREEN_HEIGHT 287u
#define SPP3E_PIXEL_BUFFER_WORDS (SPP3E_SCREEN_WIDTH * SPP3E_SCREEN_HEIGHT)
#define SPP3E_AUDIO_SAMPLE_CAPACITY 2048u
#define SPP3E_AUDIO_SAMPLE_SCALE 12000
#define SPP3E_DEFAULT_SAMPLE_RATE 44100u
#define SPP3E_BASE_CLOCK_FREQUENCY 3546900u
#define SPP3E_DISK_DRIVE_COUNT 2u
#define SPP3E_DISK_DATA_CAPACITY 0x80000u
#define SPP3E_DISK_CHANGE_CAPACITY 0x1000u
#define SPP3E_DISK_DEFAULT_MAX_CYLINDERS 42u
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
#define SPP3E_FDC_INT_NONE 0u
#define SPP3E_FDC_INT_SEEK 4u
#define SPP3E_FDC_SR0_SE 0x20u
#define SPP3E_FDC_SR0_AT 0x40u
#define SPP3E_FDC_SR0_IC 0x80u
#define SPP3E_FDC_SR1_NW 0x02u
#define SPP3E_FDC_SR1_ND 0x04u
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
  uint8_t sectorsPerTrack;
  uint8_t firstSectorId;
  uint16_t sectorLength;
  uint32_t diskLength;
  uint32_t revision;
} Spp3eDiskDrive;

static uint8_t spp3eMemory[SPP3E_MEMORY_SIZE];
static uint8_t spp3eRam[SPP3E_RAM_SIZE];
static uint8_t spp3eRom[SPP3E_ROM_SIZE];
static uint32_t spp3ePixelBuffer[SPP3E_PIXEL_BUFFER_WORDS];
static Spp3eAudioSample spp3eAudioSamples[SPP3E_AUDIO_SAMPLE_CAPACITY];
static uint8_t spp3eKeyboardLines[SPP3E_KEYBOARD_LINE_COUNT];
static uint8_t spp3eKeyboardSelectedLineValue[256];
static uint8_t spp3eDiskData[SPP3E_DISK_DRIVE_COUNT][SPP3E_DISK_DATA_CAPACITY];
static uint8_t spp3eDiskChanges[SPP3E_DISK_DRIVE_COUNT][SPP3E_DISK_CHANGE_CAPACITY];
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
static uint32_t spp3eNextFrameStartTact;
static uint32_t spp3eTotalContentionDelaySinceStart;
static uint32_t spp3eContentionDelaySincePause;
static uint32_t spp3eCpuInstructionsExecuted;
static uint32_t spp3eCpuFrameSliceInstructions;
static uint8_t spp3eFrameCompleted;
static uint32_t spp3eInterruptsRaised;
static uint8_t spp3eInterruptLineActive;
static uint16_t spp3eLastMemoryAddress;
static uint8_t spp3eLastMemoryValue;
static uint8_t spp3eLastMemoryIsWrite;
static uint8_t spp3eHasMemoryEvent;
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

uint32_t spp3eExecuteInstruction(void);
void spp3eRenderInstantScreen(void);
static uint8_t spp3eDiskUploadDrive;
static uint32_t spp3eDiskUploadLength;
static uint8_t spp3eDiskUploadActive;
static uint8_t spp3eDiskUploadWriteProtected;
static uint8_t spp3eDiskUploadTracks;
static uint8_t spp3eDiskUploadSides;
static uint8_t spp3eDiskUploadSectorsPerTrack;
static uint8_t spp3eDiskUploadFirstSectorId;
static uint16_t spp3eDiskUploadSectorLength;
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

static const Spp3eScreenConfig spp3eUlaConfig = {
  8u, 7u, 48u, 48u, 8u, 192u, 24u, 24u, 128u, 40u, 12u, 2u, 1u,
  {0u, 7u, 6u, 5u, 4u, 3u, 2u, 1u}
};

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

static void spp3eRebuildMemorySlotMap(void) {
  if (spp3eInSpecialPagingMode != 0u) {
    spp3eApplySpecialMemoryConfig();
  } else {
    spp3eApplyNormalMemoryConfig();
  }
}

static void spp3eRebuildFlatMemory(void) {
  spp3eRebuildMemorySlotMap();
  for (uint32_t slot = 0u; slot < 4u; slot++) {
    for (uint32_t offset = 0u; offset < 0x4000u; offset++) {
      spp3eMemory[slot * 0x4000u + offset] = spp3eMemorySlotBase[slot][offset];
    }
  }
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
static void spp3eTactPlusN(uint32_t value);
static void spp3eDelayMemoryAccess(uint32_t address);
static void spp3eDelayPortAccess(uint32_t address);
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
#define SP48_AUDIO_SAMPLE_SCALE 32767.0
#define SP48_TAPE_MODE_LOAD SPP3E_TAPE_MODE_LOAD
#define SP48_AUDIO_BEFORE_SAMPLE() sp128PsgPrepareAudioSample()
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
#undef SP48_DEFAULT_SAMPLE_RATE

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() spp3eMemory
#define Z80_READ_MEMORY(address) spp3eCpuReadMemory((uint32_t)(address))
#define Z80_WRITE_MEMORY(address, value) spp3eCpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_POKE_MEMORY(address, value) spp3eCpuPokeMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_READ_PORT(address) ((uint8_t)spp3eReadPort((uint32_t)(address)))
#define Z80_WRITE_PORT(address, value) spp3eWritePort((uint32_t)(address), (uint32_t)(value))
#define Z80_CAPTURE_BUS_EVENTS() spp3eCaptureBusEvents
#define SPP3E_CPU_TACT_PLUS_N(value) \
  do { \
    const uint32_t z80Spp3eTacts = (uint32_t)(value); \
    cpu.tacts += z80Spp3eTacts; \
    spp3eTacts += z80Spp3eTacts; \
    spp3eCommonSetNextAudioSample(); \
  } while (0)
#define SPP3E_CPU_APPLY_CONTENTION() \
  do { \
    const uint32_t z80Spp3eDelay = spp3eContention[spp3eUlaCurrentFrameTact()]; \
    cpu.tacts += z80Spp3eDelay; \
    spp3eTacts += z80Spp3eDelay; \
    spp3eCommonSetNextAudioSample(); \
    spp3eTotalContentionDelaySinceStart += z80Spp3eDelay; \
    spp3eContentionDelaySincePause += z80Spp3eDelay; \
  } while (0)
#define SPP3E_CPU_DELAY_MEMORY_ACCESS(address) \
  do { \
    if (spp3eIsContendedMemoryAddress((uint32_t)(address)) != 0u) { \
      SPP3E_CPU_APPLY_CONTENTION(); \
    } \
    SPP3E_CPU_TACT_PLUS_N(3u); \
  } while (0)
#define SPP3E_CPU_DELAY_ADDRESS_BUS_ACCESS(address) \
  do { \
    if (spp3eIsContendedMemoryAddress((uint32_t)(address)) != 0u) { \
      SPP3E_CPU_APPLY_CONTENTION(); \
    } \
  } while (0)
#define SPP3E_CPU_DELAY_PORT_ACCESS(address) \
  do { \
    const uint32_t z80Spp3ePortAddress = (uint32_t)(address); \
    const uint8_t z80Spp3eLowBit = (z80Spp3ePortAddress & 0x0001u) != 0u ? 1u : 0u; \
    if (spp3eIsContendedMemoryAddress(z80Spp3ePortAddress) != 0u) { \
      if (z80Spp3eLowBit != 0u) { \
        SPP3E_CPU_APPLY_CONTENTION(); \
        SPP3E_CPU_TACT_PLUS_N(1u); \
        SPP3E_CPU_APPLY_CONTENTION(); \
        SPP3E_CPU_TACT_PLUS_N(1u); \
        SPP3E_CPU_APPLY_CONTENTION(); \
        SPP3E_CPU_TACT_PLUS_N(1u); \
        SPP3E_CPU_APPLY_CONTENTION(); \
        SPP3E_CPU_TACT_PLUS_N(1u); \
      } else { \
        SPP3E_CPU_APPLY_CONTENTION(); \
        SPP3E_CPU_TACT_PLUS_N(1u); \
        SPP3E_CPU_APPLY_CONTENTION(); \
        SPP3E_CPU_TACT_PLUS_N(3u); \
      } \
    } else if (z80Spp3eLowBit != 0u) { \
      SPP3E_CPU_TACT_PLUS_N(4u); \
    } else { \
      SPP3E_CPU_TACT_PLUS_N(1u); \
      SPP3E_CPU_APPLY_CONTENTION(); \
      SPP3E_CPU_TACT_PLUS_N(3u); \
    } \
  } while (0)
#define Z80_TACT_PLUS_N(value) SPP3E_CPU_TACT_PLUS_N(value)
#define Z80_DELAY_MEMORY_READ(address) SPP3E_CPU_DELAY_MEMORY_ACCESS(address)
#define Z80_DELAY_MEMORY_WRITE(address) SPP3E_CPU_DELAY_MEMORY_ACCESS(address)
#define Z80_DELAY_ADDRESS_BUS_ACCESS(address) SPP3E_CPU_DELAY_ADDRESS_BUS_ACCESS(address)
#define Z80_DELAY_PORT_READ(address) SPP3E_CPU_DELAY_PORT_ACCESS(address)
#define Z80_DELAY_PORT_WRITE(address) SPP3E_CPU_DELAY_PORT_ACCESS(address)
#include "../../../../z80/wasm/z80.c"
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
#undef SPP3E_CPU_TACT_PLUS_N
#undef SPP3E_CPU_APPLY_CONTENTION
#undef SPP3E_CPU_DELAY_MEMORY_ACCESS
#undef SPP3E_CPU_DELAY_ADDRESS_BUS_ACCESS
#undef SPP3E_CPU_DELAY_PORT_ACCESS

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
#include "../../../zxSpectrum/wasm/common/zx-spectrum-tape.c"
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
  const uint8_t value = (uint8_t)spp3eReadMemory(address);
  if (spp3eCaptureBusEvents != 0u) {
    spp3eLastMemoryAddress = (uint16_t)(address & 0xffffu);
    spp3eLastMemoryValue = value;
    spp3eLastMemoryIsWrite = 0u;
    spp3eHasMemoryEvent = 1u;
  }
  return value;
}

static void spp3eCpuWriteMemory(uint32_t address, uint32_t value) {
  if (spp3eCaptureBusEvents != 0u) {
    spp3eLastMemoryAddress = (uint16_t)(address & 0xffffu);
    spp3eLastMemoryValue = (uint8_t)value;
    spp3eLastMemoryIsWrite = 1u;
    spp3eHasMemoryEvent = 1u;
  }
  spp3eWriteMemory(address, value);
}

static void spp3eCpuPokeMemory(uint32_t address, uint32_t value) {
  spp3eWriteMemory(address, value);
}

static void spp3eApplyContentionDelay(void) {
  const uint32_t delay = spp3eContention[spp3eUlaCurrentFrameTact()];
  cpu.tacts += delay;
  spp3eTacts += delay;
  spp3eCommonSetNextAudioSample();
  spp3eTotalContentionDelaySinceStart += delay;
  spp3eContentionDelaySincePause += delay;
}

static void spp3eTactPlusN(uint32_t value) {
  cpu.tacts += value;
  spp3eTacts += value;
  spp3eCommonSetNextAudioSample();
}

static void spp3eDelayMemoryAccess(uint32_t address) {
  if (spp3eIsContendedMemoryAddress(address) != 0u) {
    spp3eApplyContentionDelay();
  }
  spp3eTactPlusN(3u);
}

static void spp3eDelayPortAccess(uint32_t address) {
  const uint8_t lowBit = (address & 0x0001u) != 0u ? 1u : 0u;
  if (spp3eIsContendedMemoryAddress(address) != 0u) {
    if (lowBit != 0u) {
      for (uint32_t i = 0u; i < 4u; i++) {
        spp3eApplyContentionDelay();
        spp3eTactPlusN(1u);
      }
    } else {
      spp3eApplyContentionDelay();
      spp3eTactPlusN(1u);
      spp3eApplyContentionDelay();
      spp3eTactPlusN(3u);
    }
  } else if (lowBit != 0u) {
    spp3eTactPlusN(4u);
  } else {
    spp3eTactPlusN(1u);
    spp3eApplyContentionDelay();
    spp3eTactPlusN(3u);
  }
}

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
  sp128PsgAdvanceToTact(spp3eTacts);
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
  drive->sectorsPerTrack = 32u;
  drive->firstSectorId = 1u;
  drive->sectorLength = 0u;
  drive->diskLength = 0u;
  drive->revision = 0u;
  spp3eClearBytes(spp3eDiskData[driveIndex], SPP3E_DISK_DATA_CAPACITY);
  spp3eClearBytes(spp3eDiskChanges[driveIndex], SPP3E_DISK_CHANGE_CAPACITY);
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

static uint32_t spp3eFdcSectorByteOffset(void) {
  const Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
  const uint32_t cylinder = spp3eFdcDataRegister[1];
  const uint32_t head = spp3eFdcDataRegister[2] & 0x01u;
  const uint32_t sectorId = spp3eFdcDataRegister[3];
  const uint32_t lengthCode = spp3eFdcDataRegister[4] & 0x07u;
  const uint32_t sectorLength = drive->sectorLength != 0u ? drive->sectorLength : 128u << lengthCode;
  const uint32_t sideCount = drive->hasTwoHeads != 0u ? 2u : 1u;
  const uint32_t firstSectorId = drive->firstSectorId;
  const uint32_t sectorsPerTrack = drive->sectorsPerTrack == 0u ? 32u : drive->sectorsPerTrack;
  if (head >= sideCount || sectorId < firstSectorId || sectorId >= firstSectorId + sectorsPerTrack) {
    return SPP3E_DISK_DATA_CAPACITY;
  }
  const uint32_t sector = sectorId - firstSectorId;
  return (((cylinder * sideCount) + head) * sectorsPerTrack + sector) * sectorLength;
}

static uint32_t spp3eFdcSectorLength(void) {
  const uint32_t lengthCode = spp3eFdcDataRegister[4] & 0x07u;
  return 128u << lengthCode;
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

static void spp3eFdcJournalDirtyRange(uint32_t drive, uint32_t offset, uint32_t length) {
  if (drive >= SPP3E_DISK_DRIVE_COUNT) {
    return;
  }
  spp3eFdcDirtyDrive = (uint8_t)drive;
  spp3eFdcDirtyOffset = offset;
  spp3eFdcDirtyLength = length;
  spp3eFdcDirtyRevision++;
  uint32_t entryOffset = SPP3E_DISK_CHANGE_CAPACITY - 8u;
  for (uint32_t candidate = 0u; candidate + 8u <= SPP3E_DISK_CHANGE_CAPACITY; candidate += 8u) {
    const uint32_t entryLength =
      (uint32_t)spp3eDiskChanges[drive][candidate + 4u] |
      ((uint32_t)spp3eDiskChanges[drive][candidate + 5u] << 8u) |
      ((uint32_t)spp3eDiskChanges[drive][candidate + 6u] << 16u) |
      ((uint32_t)spp3eDiskChanges[drive][candidate + 7u] << 24u);
    if (entryLength == 0u) {
      entryOffset = candidate;
      break;
    }
  }
  spp3eDiskChanges[drive][entryOffset] = (uint8_t)(offset & 0xffu);
  spp3eDiskChanges[drive][entryOffset + 1u] = (uint8_t)((offset >> 8u) & 0xffu);
  spp3eDiskChanges[drive][entryOffset + 2u] = (uint8_t)((offset >> 16u) & 0xffu);
  spp3eDiskChanges[drive][entryOffset + 3u] = (uint8_t)((offset >> 24u) & 0xffu);
  spp3eDiskChanges[drive][entryOffset + 4u] = (uint8_t)(length & 0xffu);
  spp3eDiskChanges[drive][entryOffset + 5u] = (uint8_t)((length >> 8u) & 0xffu);
  spp3eDiskChanges[drive][entryOffset + 6u] = (uint8_t)((length >> 16u) & 0xffu);
  spp3eDiskChanges[drive][entryOffset + 7u] = (uint8_t)((length >> 24u) & 0xffu);
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
      spp3eFdcPresentCylinder[spp3eFdcCurrentDrive] = 0u;
      spp3eFdcSr0 = SPP3E_FDC_SR0_SE | (spp3eFdcCurrentDrive & 0x01u);
      spp3eFdcSenseIntResult[0] = spp3eFdcSr0;
      spp3eFdcSenseIntResult[1] = 0u;
      spp3eFdcIntReq = SPP3E_FDC_INT_SEEK;
      spp3eFdcCompleteCommand();
      break;
    case SPP3E_FDC_CMD_READ_ID:
      spp3eFdcDataRegister[1] = drive->currentCylinder;
      spp3eFdcDataRegister[2] = drive->currentHead;
      spp3eFdcDataRegister[3] = drive->firstSectorId;
      spp3eFdcDataRegister[4] =
        drive->sectorLength >= 1024u ? 3u :
        drive->sectorLength >= 512u ? 2u :
        drive->sectorLength >= 256u ? 1u :
        0u;
      spp3eFdcBuildRwResult(0u, drive->ready != 0u ? 0u : SPP3E_FDC_SR1_ND, 0u);
      spp3eFdcCompleteCommand();
      break;
    case SPP3E_FDC_CMD_READ_DATA: {
      const uint32_t offset = spp3eFdcSectorByteOffset();
      const uint32_t length = spp3eFdcSectorLength();
      if (drive->ready == 0u || offset >= drive->diskLength || length > drive->diskLength - offset) {
        spp3eFdcBuildRwResult(SPP3E_FDC_SR0_AT | (spp3eFdcCurrentDrive & 0x01u), SPP3E_FDC_SR1_ND, 0u);
        spp3eFdcCompleteCommand();
      } else {
        spp3eFdcSectorOffset = 0u;
        spp3eFdcTransferOffset = offset;
        spp3eFdcTransferLength = length;
        spp3eFdcMsr = SPP3E_FDC_MSR_RQM | SPP3E_FDC_MSR_DIO | SPP3E_FDC_MSR_CB | SPP3E_FDC_MSR_EXM;
      }
      break;
    }
    case SPP3E_FDC_CMD_WRITE_DATA: {
      const uint32_t offset = spp3eFdcSectorByteOffset();
      const uint32_t length = spp3eFdcSectorLength();
      if (drive->writeProtected != 0u) {
        spp3eFdcBuildRwResult(SPP3E_FDC_SR0_AT | (spp3eFdcCurrentDrive & 0x01u), SPP3E_FDC_SR1_NW, 0u);
        spp3eFdcCompleteCommand();
      } else if (drive->ready == 0u || offset >= SPP3E_DISK_DATA_CAPACITY || length > SPP3E_DISK_DATA_CAPACITY - offset) {
        spp3eFdcBuildRwResult(SPP3E_FDC_SR0_AT | (spp3eFdcCurrentDrive & 0x01u), SPP3E_FDC_SR1_ND, 0u);
        spp3eFdcCompleteCommand();
      } else {
        spp3eFdcSectorOffset = 0u;
        spp3eFdcTransferOffset = offset;
        spp3eFdcTransferLength = length;
        spp3eFdcMsr = SPP3E_FDC_MSR_RQM | SPP3E_FDC_MSR_CB | SPP3E_FDC_MSR_EXM;
      }
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
  for (uint32_t i = 0u; i < 9u; i++) {
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
  if (spp3eFdcOperationPhase == SPP3E_FDC_PHASE_EXECUTION && spp3eFdcCommandId == SPP3E_FDC_CMD_READ_DATA) {
    const uint8_t data = spp3eDiskData[spp3eFdcCurrentDrive][spp3eFdcTransferOffset + spp3eFdcSectorOffset];
    spp3eFdcSectorOffset++;
    if (spp3eFdcSectorOffset >= spp3eFdcTransferLength) {
      spp3eFdcBuildRwResult(0u, 0u, 0u);
      spp3eFdcCompleteCommand();
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
  if (spp3eFdcOperationPhase == SPP3E_FDC_PHASE_EXECUTION && spp3eFdcCommandId == SPP3E_FDC_CMD_WRITE_DATA) {
    Spp3eDiskDrive *drive = spp3eGetDiskDrive(spp3eFdcCurrentDrive);
    spp3eDiskData[spp3eFdcCurrentDrive][spp3eFdcTransferOffset + spp3eFdcSectorOffset] = (uint8_t)value;
    spp3eFdcSectorOffset++;
    if (spp3eFdcSectorOffset >= spp3eFdcTransferLength) {
      if (spp3eFdcTransferOffset + spp3eFdcTransferLength > drive->diskLength) {
        drive->diskLength = spp3eFdcTransferOffset + spp3eFdcTransferLength;
      }
      spp3eFdcJournalDirtyRange(spp3eFdcCurrentDrive, spp3eFdcTransferOffset, spp3eFdcTransferLength);
      drive->revision++;
      spp3eFdcBuildRwResult(0u, 0u, 0u);
      spp3eFdcCompleteCommand();
    }
    return;
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
  spp3eBeginAudioFrame();
  spp3eUlaBeginBorderFrame(spp3eNextFrameStartTact);
  spp3eCpuFrameSliceInstructions = 0u;
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
}

void spp3eReset(void) {
  spp3eUlaInitializeTimingTables(&spp3eUlaConfig);
  z80Reset();
  spp3eFrames = 0;
  spp3eTacts = 0;
  spp3eNextFrameStartTact = 0u;
  spp3eTotalContentionDelaySinceStart = 0u;
  spp3eContentionDelaySincePause = 0u;
  spp3eCpuInstructionsExecuted = 0u;
  spp3eCpuFrameSliceInstructions = 0u;
  spp3eFrameCompleted = 0u;
  spp3eInterruptsRaised = 0u;
  spp3eInterruptLineActive = 0u;
  spp3eHasMemoryEvent = 0u;
  z80ClearBusEvents();
  spp3eSelectedRom = 0u;
  spp3eSelectedBank = 0u;
  spp3ePagingEnabled = 1u;
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
  spp3eRebuildFlatMemory();
  spp3eResetPsg();
  spp3eResetAudio();
  spp3eCommonTapeClear();
  spp3eFdcReset();
  spp3eResetKeyboard();
  spp3eUlaRenderDisplay();
}

void spp3eHardReset(void) {
  spp3eReset();
  spp3eClearBytes(spp3eRam, SPP3E_RAM_SIZE);
  for (uint32_t i = 0u; i < SPP3E_DISK_DRIVE_COUNT; i++) {
    spp3eClearBytes(spp3eDiskData[i], SPP3E_DISK_DATA_CAPACITY);
    spp3eClearBytes(spp3eDiskChanges[i], SPP3E_DISK_CHANGE_CAPACITY);
  }
}

uint32_t spp3eExecuteFrame(void) {
  spp3eBeginMachineFrame();
  spp3eCaptureBusEvents = 0u;
  spp3eHasMemoryEvent = 0u;
  z80ClearBusEvents();

  const uint32_t frameEndTact = spp3eNextFrameStartTact + spp3eTactsInFrame;
  while (spp3eTacts < frameEndTact) {
    spp3eExecuteInstruction();
  }
  spp3eCaptureBusEvents = 1u;
  return 0;
}

uint32_t spp3eExecuteInstruction(void) {
  if (spp3eFrameCompleted != 0u) {
    spp3eBeginMachineFrame();
  }

  if (spp3eCaptureBusEvents != 0u) {
    spp3eHasMemoryEvent = 0u;
    z80ClearBusEvents();
  }
  spp3eUpdateTapeMode();
  const uint8_t intActive = spp3eUlaShouldRaiseInterrupt();
  if (intActive != 0u && spp3eInterruptLineActive == 0u) {
    spp3eInterruptsRaised++;
  }
  spp3eInterruptLineActive = intActive;
  z80SetSigInt(intActive);
  z80SetTacts(spp3eTacts);
  z80ExecuteCpuCycle();
  spp3eTacts = z80GetTacts();
  spp3eSetNextAudioSample();
  spp3eUpdateTapeMode();
  spp3eCpuInstructionsExecuted++;
  spp3eCpuFrameSliceInstructions++;
  spp3eFrameCompleted =
    spp3eTacts >= spp3eNextFrameStartTact + spp3eTactsInFrame ? 1u : 0u;
  spp3eCompleteMachineFrame();
  return 0u;
}

void spp3eUploadRomByte(uint32_t bank, uint32_t offset, uint32_t value) {
  if (bank < 4u && offset < 0x4000u) {
    const uint8_t byteValue = (uint8_t)value;
    spp3eRom[spp3eRomBankOffset(bank) + offset] = byteValue;
    if (spp3eInSpecialPagingMode == 0u && spp3eSelectedRom == (uint8_t)bank) {
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
    return;
  }
  const uint32_t offset = maskedAddress & 0x3fffu;
  const uint8_t byteValue = (uint8_t)value;
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
  if ((address & 0x0001u) == 0u) {
    const uint32_t selectedLines = (~(address >> 8u)) & 0xffu;
    const uint8_t status = spp3eKeyboardSelectedLineValue[selectedLines];
    uint32_t portValue = ((uint32_t)~status) & 0xffu;
    uint8_t bit4Sensed = spp3eEarBit;
    if (bit4Sensed == 0u) {
      uint32_t chargeTime = spp3eEarBitChangedFrom1Tacts - spp3eEarBitChangedFrom0Tacts;
      if (chargeTime > 0u) {
        chargeTime = chargeTime > 700u ? 2800u : 4u * chargeTime;
        bit4Sensed = spp3eTacts - spp3eEarBitChangedFrom1Tacts < chargeTime ? 1u : 0u;
      }
    }
    const uint8_t earValue = spp3eTapeMode == SPP3E_TAPE_MODE_LOAD ? spp3eCommonTapeGetEarBit() : bit4Sensed;
    const uint32_t bit6Value = earValue != 0u ? 0x40u : 0x00u;
    return (portValue & 0xbfu) | bit6Value;
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
  if ((address & 0x0001u) == 0u) {
    spp3eCommonSetNextAudioSample();
    spp3ePortFeValue = (uint8_t)value;
    const uint8_t nextBorderColor = (uint8_t)(value & 0x07u);
    if (nextBorderColor != spp3eBorderColor) {
      spp3eUlaRenderUntilCurrentTact();
    }
    spp3eBorderColor = nextBorderColor;
    const uint8_t nextMicBit = (value & 0x08u) != 0u ? 1u : 0u;
    const uint8_t nextEarBit = (value & 0x10u) != 0u ? 1u : 0u;
    if (nextEarBit != spp3eEarBit || nextMicBit != spp3eMicBit) {
      spp3eCommonRecordAudioTransition(spp3eTacts);
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
    spp3eSelectedBank = (uint8_t)(value & 0x07u);
    spp3eUseShadowScreen = (value & 0x08u) != 0u ? 1u : 0u;
    spp3eSelectedRom = (uint8_t)(((value >> 4u) & 0x01u) | (spp3eSpecialConfigMode & 0x02u));
    spp3ePagingEnabled = (value & 0x20u) != 0u ? 0u : 1u;
    spp3eRebuildFlatMemory();
    return;
  }

  if ((address & 0xf002u) == 0x1000u) {
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
uint32_t spp3eDiskBeginUpload(
  uint32_t drive,
  uint32_t length,
  uint32_t writeProtected,
  uint32_t tracks,
  uint32_t sides,
  uint32_t sectorsPerTrack,
  uint32_t firstSectorId,
  uint32_t sectorLength
) {
  if (drive >= SPP3E_DISK_DRIVE_COUNT || drive >= spp3eFdcEnabledDriveCount || length > SPP3E_DISK_DATA_CAPACITY) {
    return 0u;
  }
  spp3eDiskUploadDrive = (uint8_t)drive;
  spp3eDiskUploadLength = length;
  spp3eDiskUploadWriteProtected = writeProtected != 0u ? 1u : 0u;
  spp3eDiskUploadTracks = tracks == 0u ? SPP3E_DISK_DEFAULT_MAX_CYLINDERS : (uint8_t)tracks;
  spp3eDiskUploadSides = sides > 1u ? 2u : 1u;
  spp3eDiskUploadSectorsPerTrack = sectorsPerTrack == 0u ? 32u : (uint8_t)sectorsPerTrack;
  spp3eDiskUploadFirstSectorId = firstSectorId == 0u ? 1u : (uint8_t)firstSectorId;
  spp3eDiskUploadSectorLength = sectorLength == 0u ? 0u : (uint16_t)sectorLength;
  spp3eDiskUploadActive = 1u;
  spp3eClearBytes(spp3eDiskData[drive], SPP3E_DISK_DATA_CAPACITY);
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
uint32_t spp3eDiskFinishUpload(uint32_t drive) {
  if (spp3eDiskUploadActive == 0u || drive != spp3eDiskUploadDrive) {
    return 0u;
  }
  Spp3eDiskDrive *diskDrive = spp3eGetDiskDrive(drive);
  diskDrive->hasDiskLoaded = spp3eDiskUploadLength > 0u ? 1u : 0u;
  diskDrive->diskLength = spp3eDiskUploadLength;
  diskDrive->writeProtected = spp3eDiskUploadWriteProtected;
  diskDrive->hasTwoHeads = spp3eDiskUploadSides > 1u ? 1u : 0u;
  diskDrive->maxCylinders = spp3eDiskUploadTracks;
  diskDrive->sectorsPerTrack = spp3eDiskUploadSectorsPerTrack;
  diskDrive->firstSectorId = spp3eDiskUploadFirstSectorId;
  diskDrive->sectorLength = spp3eDiskUploadSectorLength;
  diskDrive->currentCylinder = 0u;
  diskDrive->track0Mark = 1u;
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
  sp128PsgPrepareAudioSample();
  return sp128PsgCurrentOutput;
}
uint32_t spp3eGetTactsInFrame(void) { return spp3eTactsInFrame; }
uint32_t spp3eGetFrames(void) { return spp3eFrames; }
uint32_t spp3eGetTacts(void) { return spp3eTacts; }
uint32_t spp3eGetCurrentFrameTact(void) { return spp3eUlaCurrentFrameTact(); }
uint32_t spp3eGetFrameCompleted(void) { return spp3eFrameCompleted; }
void spp3eSetTacts(uint32_t value) {
  spp3eTacts = value;
  z80SetTacts(value);
  spp3eSetNextAudioSample();
}
uint32_t spp3eGetSelectedRom(void) { return spp3eSelectedRom; }
uint32_t spp3eGetSelectedBank(void) { return spp3eSelectedBank; }
uint32_t spp3eGetPagingEnabled(void) { return spp3ePagingEnabled; }
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
uint32_t spp3eGetCpuTacts(void) { return z80GetTacts(); }
uint32_t spp3eGetCpuAf(void) { return z80GetAf(); }
void spp3eSetCpuAf(uint32_t value) { z80SetAf(value); }
uint32_t spp3eGetCpuAfAlt(void) { return z80GetAfAlt(); }
void spp3eSetCpuAfAlt(uint32_t value) { z80SetAfAlt(value); }
uint32_t spp3eGetCpuBcAlt(void) { return z80GetBcAlt(); }
void spp3eSetCpuBcAlt(uint32_t value) { z80SetBcAlt(value); }
uint32_t spp3eGetCpuDeAlt(void) { return z80GetDeAlt(); }
void spp3eSetCpuDeAlt(uint32_t value) { z80SetDeAlt(value); }
uint32_t spp3eGetCpuHlAlt(void) { return z80GetHlAlt(); }
void spp3eSetCpuHlAlt(uint32_t value) { z80SetHlAlt(value); }
uint32_t spp3eGetCpuBc(void) { return z80GetBc(); }
void spp3eSetCpuBc(uint32_t value) { z80SetBc(value); }
uint32_t spp3eGetCpuDe(void) { return z80GetDe(); }
void spp3eSetCpuDe(uint32_t value) { z80SetDe(value); }
uint32_t spp3eGetCpuHl(void) { return z80GetHl(); }
void spp3eSetCpuHl(uint32_t value) { z80SetHl(value); }
uint32_t spp3eGetCpuIx(void) { return z80GetIx(); }
void spp3eSetCpuIx(uint32_t value) { z80SetIx(value); }
uint32_t spp3eGetCpuIy(void) { return z80GetIy(); }
void spp3eSetCpuIy(uint32_t value) { z80SetIy(value); }
uint32_t spp3eGetCpuIr(void) { return z80GetIr(); }
void spp3eSetCpuIr(uint32_t value) { z80SetIr(value); }
uint32_t spp3eGetCpuWz(void) { return z80GetWz(); }
void spp3eSetCpuWz(uint32_t value) { z80SetWz(value); }
uint32_t spp3eGetCpuPc(void) { return z80GetPc(); }
void spp3eSetCpuPc(uint32_t value) { z80SetPc(value); }
uint32_t spp3eGetCpuSp(void) { return z80GetSp(); }
void spp3eSetCpuSp(uint32_t value) { z80SetSp(value); }
uint32_t spp3eGetCpuHalted(void) { return z80GetHalted(); }
uint32_t spp3eGetCpuPrefix(void) { return z80GetPrefix(); }
uint32_t spp3eGetCpuIff1(void) { return z80GetIff1(); }
void spp3eSetCpuIff1(uint32_t value) { z80SetIff1(value); }
uint32_t spp3eGetCpuIff2(void) { return z80GetIff2(); }
void spp3eSetCpuIff2(uint32_t value) { z80SetIff2(value); }
uint32_t spp3eGetCpuInterruptMode(void) { return z80GetInterruptMode(); }
void spp3eSetCpuInterruptMode(uint32_t value) { z80SetInterruptMode(value); }
uint32_t spp3eGetLastMemoryAddress(void) { return spp3eHasMemoryEvent != 0u ? spp3eLastMemoryAddress : 0u; }
uint32_t spp3eGetLastMemoryValue(void) { return spp3eHasMemoryEvent != 0u ? spp3eLastMemoryValue : 0u; }
uint32_t spp3eGetLastMemoryIsWrite(void) { return spp3eHasMemoryEvent != 0u ? spp3eLastMemoryIsWrite : 0u; }
uint32_t spp3eGetLastPortAddress(void) { return z80GetLastPortAddress(); }
uint32_t spp3eGetLastPortValue(void) { return z80GetLastPortValue(); }
uint32_t spp3eGetLastPortIsWrite(void) { return z80GetLastPortIsWrite(); }
uint32_t spp3eGetPortFeValue(void) { return spp3ePortFeValue; }
uint32_t spp3eGetBorderColor(void) { return spp3eBorderColor; }
uint32_t spp3eGetEarBit(void) { return spp3eEarBit; }
uint32_t spp3eGetMicBit(void) { return spp3eMicBit; }
uint32_t spp3eGetBeeperLevel(void) { return spp3eBeeperLevel; }
uint32_t spp3eGetLastContendedValue(void) { return spp3eLastContendedValue; }
uint32_t spp3eGetLastUlaReadValue(void) { return spp3eLastUlaReadValue; }
void spp3eSetLastContendedValue(uint32_t value) { spp3eLastContendedValue = (uint8_t)value; }
void spp3eSetLastUlaReadValue(uint32_t value) { spp3eLastUlaReadValue = (uint8_t)value; }
