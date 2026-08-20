#include <stdint.h>

#define SP128_RAM_SIZE 0x20000u
#define SP128_ROM_SIZE 0x8000u
#define SP128_MEMORY_SIZE 0x10000u
#define SP128_KEYBOARD_LINE_COUNT 8u
#define SP128_SCREEN_WIDTH 352u
#define SP128_SCREEN_HEIGHT 296u
#define SP128_DISPLAY_WIDTH 256u
#define SP128_DISPLAY_HEIGHT 192u
#define SP128_DISPLAY_LEFT 48u
#define SP128_DISPLAY_TOP 48u
#define SP128_PIXEL_BUFFER_WORDS (SP128_SCREEN_WIDTH * SP128_SCREEN_HEIGHT)
#define SP128_AUDIO_SAMPLE_CAPACITY 2048u
#define SP128_AUDIO_SAMPLE_SCALE 24576.0
#define SP128_BASE_CLOCK_FREQUENCY 3546900.0
#define SP128_TACTS_PER_FRAME 70908u
#define SP128_SCREEN_LINE_TIME 228u
#define SP128_DEFAULT_SAMPLE_RATE 44100u
#define SP128_TAPE_MAX_BLOCKS 512u
#define SP128_TAPE_DATA_CAPACITY 0x400000u
#define SP128_TAPE_SAVE_MAX_BLOCKS 64u
#define SP128_TAPE_SAVE_DATA_CAPACITY 0x100000u
#define SP128_TAPE_FILENAME_CAPACITY 260u
#define SP128_TAPE_HEADER_PILOT_COUNT 8063u
#define SP128_TAPE_DATA_PILOT_COUNT 3223u
#define SP128_TAPE_MIN_SAVE_PILOT_PULSE_COUNT 3000u
#define SP128_TAPE_SAVE_PULSE_TOLERANCE 24u
#define SP128_TAPE_TOO_LONG_SAVE_PAUSE 3500000u
#define SP128_TAPE_PILOT_PULSE_LENGTH 2168u
#define SP128_TAPE_SYNC1_PULSE_LENGTH 667u
#define SP128_TAPE_SYNC2_PULSE_LENGTH 735u
#define SP128_TAPE_BIT0_PULSE_LENGTH 855u
#define SP128_TAPE_BIT1_PULSE_LENGTH 1710u
#define SP128_TAPE_TERM_SYNC_PULSE_LENGTH 947u
#define SP128_TAPE_LOAD_BYTES_ROUTINE 0x056cu
#define SP128_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE 0x05b6u
#define SP128_TAPE_LOAD_BYTES_RESUME_ROUTINE 0x05e2u
#define SP128_TAPE_SAVE_BYTES_ROUTINE 0x04c2u
#define SP128_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW 0x00000004u
#define SP128_DIAGNOSTIC_TAPE_DATA_OVERFLOW 0x00000008u
#define SP128_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE 0x00000010u
#define SP128_DIAGNOSTIC_TAPE_SAVE_DATA_OVERFLOW 0x00000040u
#define SP128_DIAGNOSTIC_TAPE_SAVE_BLOCK_OVERFLOW 0x00000080u
#define SP128_DIAGNOSTIC_TAPE_SAVE_MALFORMED_PULSE 0x00000100u
#define SP128_TAPE_MODE_PASSIVE 0u
#define SP128_TAPE_MODE_LOAD 1u
#define SP128_TAPE_MODE_SAVE 2u
#define SP128_ALWAYS_INLINE static inline __attribute__((always_inline))

#define SP48_SCREEN_BUFFER_WIDTH_MAX SP128_SCREEN_WIDTH
#define SP48_SCREEN_BUFFER_LINES_MAX SP128_SCREEN_HEIGHT
#define SP48_PIXEL_BUFFER_GUARD_LINES 0u
#define SP48_TACTS_PER_FRAME_MAX SP128_TACTS_PER_FRAME
#define SP48_RENDER_PHASE_NONE 0u
#define SP48_RENDER_PHASE_BORDER 1u
#define SP48_RENDER_PHASE_BORDER_FETCH_PIXEL 2u
#define SP48_RENDER_PHASE_BORDER_FETCH_ATTR 3u
#define SP48_RENDER_PHASE_DISPLAY_B1 4u
#define SP48_RENDER_PHASE_DISPLAY_B2 5u
#define SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2 6u
#define SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2 7u
#define SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1 8u
#define SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1 9u

#define SP128_TAPE_PHASE_NONE 0u
#define SP128_TAPE_PHASE_PILOT 1u
#define SP128_TAPE_PHASE_SYNC 2u
#define SP128_TAPE_PHASE_DATA 3u
#define SP128_TAPE_PHASE_TERM_SYNC 4u
#define SP128_TAPE_PHASE_PAUSE 5u
#define SP128_TAPE_PHASE_COMPLETED 6u

#define SP128_TAPE_SAVE_PHASE_NONE 0u
#define SP128_TAPE_SAVE_PHASE_PILOT 1u
#define SP128_TAPE_SAVE_PHASE_SYNC1 2u
#define SP128_TAPE_SAVE_PHASE_SYNC2 3u
#define SP128_TAPE_SAVE_PHASE_DATA 4u
#define SP128_TAPE_SAVE_PHASE_ERROR 5u

#define SP128_TAPE_MIC_PULSE_NONE 0u
#define SP128_TAPE_MIC_PULSE_TOO_SHORT 1u
#define SP128_TAPE_MIC_PULSE_TOO_LONG 2u
#define SP128_TAPE_MIC_PULSE_PILOT 3u
#define SP128_TAPE_MIC_PULSE_SYNC1 4u
#define SP128_TAPE_MIC_PULSE_SYNC2 5u
#define SP128_TAPE_MIC_PULSE_BIT0 6u
#define SP128_TAPE_MIC_PULSE_BIT1 7u
#define SP128_TAPE_MIC_PULSE_TERM_SYNC 8u

typedef struct Sp128AudioSample {
  int16_t left;
  int16_t right;
} Sp128AudioSample;

typedef struct Sp128TapeBlock {
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
} Sp128TapeBlock;

typedef struct Sp128ScreenConfig {
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
} Sp128ScreenConfig;

static uint8_t sp128Ram[SP128_RAM_SIZE];
static uint8_t sp128Rom[SP128_ROM_SIZE];
static uint8_t sp128Memory[SP128_MEMORY_SIZE];
static uint8_t sp128KeyboardLines[SP128_KEYBOARD_LINE_COUNT];
static uint8_t sp128KeyboardSelectedLineValue[256];
static uint8_t *sp128MemorySlotBase[4];
static uint8_t sp128MemorySlotWritable[4];
static uint8_t sp128MemorySlotMapInitialized;
static uint8_t sp128Contention[SP128_TACTS_PER_FRAME];
static uint8_t sp128RenderingPhase[SP128_TACTS_PER_FRAME];
static uint16_t sp128RenderingPixelAddress[SP128_TACTS_PER_FRAME];
static uint16_t sp128RenderingAttributeAddress[SP128_TACTS_PER_FRAME];
static uint32_t sp128RenderingPixelIndex[SP128_TACTS_PER_FRAME];
static uint32_t sp128PixelBuffer[SP128_PIXEL_BUFFER_WORDS];
static uint32_t sp128AttrColors[2][256][2];
static uint8_t sp128AttrColorsInitialized;
static Sp128AudioSample sp128AudioSamples[SP128_AUDIO_SAMPLE_CAPACITY];
static Sp128TapeBlock sp128TapeBlocks[SP128_TAPE_MAX_BLOCKS];
static Sp128TapeBlock sp128SavedTapeBlocks[SP128_TAPE_SAVE_MAX_BLOCKS];
static uint8_t sp128TapeData[SP128_TAPE_DATA_CAPACITY];
static uint8_t sp128TapeFileName[SP128_TAPE_FILENAME_CAPACITY];
static uint8_t sp128TapeSaveData[SP128_TAPE_SAVE_DATA_CAPACITY];

static uint32_t sp128Frames;
static uint32_t sp128Tacts;
static uint32_t sp128TactsInFrame = SP128_TACTS_PER_FRAME;
static uint32_t sp128ClockMultiplier = 1u;
static uint32_t sp128TargetClockMultiplier = 1u;
static uint32_t sp128TactsInCurrentFrame = SP128_TACTS_PER_FRAME;
static uint32_t sp128NextFrameStartTact;
static uint32_t sp128RasterLines;
static uint32_t sp128ScreenLineTime;
static uint32_t sp128TimingScreenWidth;
static uint32_t sp128TimingScreenLines;
static uint32_t sp128FirstDisplayLine;
static uint32_t sp128FirstVisibleLine;
static uint32_t sp128FirstVisibleBorderTact;
static uint32_t sp128DisplayLeftPixel;
static uint32_t sp128DisplayTopLine;
static uint32_t sp128AudioSampleRate = SP128_DEFAULT_SAMPLE_RATE;
static uint32_t sp128AudioSampleCount;
static double sp128AudioSampleLength;
static double sp128AudioNextSampleTact;
static uint32_t sp128AudioNextSampleTactFloor;
static uint32_t sp128AudioLastLevelChangeTact;
static double sp128AudioAccumulatedEar;
static double sp128AudioAccumulatedMic;
static double sp128AudioAccumulatedTacts;
static double sp128DcFilterPrevInputLeft;
static double sp128DcFilterPrevInputRight;
static double sp128DcFilterPrevOutputLeft;
static double sp128DcFilterPrevOutputRight;
static uint8_t sp128SelectedRom;
static uint8_t sp128SelectedBank;
static uint8_t sp128PagingEnabled;
static uint8_t sp128UseShadowScreen;
static uint8_t sp128PortFeValue;
static uint8_t sp128BorderColor;
static uint32_t sp128BorderFrameStartTact;
static uint32_t sp128LastRenderedFrameTact;
static uint8_t sp128PixelByte1;
static uint8_t sp128PixelByte2;
static uint8_t sp128AttrByte1;
static uint8_t sp128AttrByte2;
static uint8_t sp128EarBit;
static uint8_t sp128MicBit;
static uint8_t sp128BeeperLevel;
static uint32_t sp128EarBitChangedFrom0Tacts;
static uint32_t sp128EarBitChangedFrom1Tacts;
static uint32_t sp128DiagnosticFlags;
static uint32_t sp128RomUploadCount;
static uint32_t sp128RomChecksum;
static uint32_t sp128TapeBlockCount;
static uint32_t sp128TapeDataLength;
static uint32_t sp128TapeCurrentBlockIndex;
static uint32_t sp128TapeUploadBlockCount;
static uint32_t sp128TapeUploadDataLength;
static uint8_t sp128TapeUploadActive;
static uint8_t sp128TapeLoaded;
static uint8_t sp128TapeEof;
static uint8_t sp128TapeMode;
static uint8_t sp128TapeEarBit;
static uint8_t sp128TapeFastLoad = 1u;
static uint8_t sp128TapePlayPhase;
static uint32_t sp128TapeStartTact;
static uint32_t sp128TapePilotEndPos;
static uint32_t sp128TapeSync1EndPos;
static uint32_t sp128TapeSync2EndPos;
static uint32_t sp128TapeBitStartPos;
static uint32_t sp128TapeBitPulseLength;
static uint32_t sp128TapeDataIndex;
static uint8_t sp128TapeBitMask;
static uint32_t sp128TapeTermEndPos;
static uint32_t sp128TapePauseEndPos;
static uint32_t sp128TapeSavedBlockCount;
static uint32_t sp128TapeSavedDataLength;
static uint32_t sp128TapeSavedRevision;
static uint32_t sp128TapeModeChangeCount;
static uint32_t sp128TapeLastModeChangeTact;
static uint32_t sp128TapeLastModeChangePc;
static uint32_t sp128TapeLoadStartCount;
static uint32_t sp128TapeSaveStartCount;
static uint8_t sp128TapeSaveMicBit;
static uint8_t sp128TapeSavePhase;
static uint8_t sp128TapeSavePreviousDataPulse;
static uint8_t sp128TapeSaveLastPulse;
static uint8_t sp128TapeSaveBitOffset;
static uint8_t sp128TapeSaveDataByte;
static uint32_t sp128TapeSaveLastMicBitTact;
static uint32_t sp128TapeSavePilotPulseCount;
static uint32_t sp128TapeSaveCurrentBlockOffset;
static uint32_t sp128TapeSaveCurrentBlockLength;
static uint32_t sp128TotalContentionDelaySinceStart;
static uint32_t sp128ContentionDelaySincePause;
static uint32_t sp128CpuInstructionsExecuted;
static uint32_t sp128CpuFrameSliceInstructions;
static uint32_t sp128FrameCompleted;
static uint32_t sp128InterruptsRaised;
static uint8_t sp128InterruptLineActive;
static uint16_t sp128LastMemoryAddress;
static uint8_t sp128LastMemoryValue;
static uint8_t sp128LastMemoryIsWrite;
static uint8_t sp128HasMemoryEvent;
static uint8_t sp128CaptureBusEvents = 1u;

uint32_t sp128ReadPort(uint32_t address);
void sp128WritePort(uint32_t address, uint32_t value);
void sp128RenderInstantScreen(void);
uint32_t sp128ExecuteInstruction(void);
uint32_t sp128ReadScreenMemoryOffset(uint32_t offset);
static void sp128CommonSetNextAudioSample(void);
static void sp128UlaRenderUntilCurrentTact(void);
static void renderBorderUntilCurrentTact(void);
static uint8_t sp128CpuReadMemory(uint32_t address);
static void sp128CpuWriteMemory(uint32_t address, uint32_t value);
static void sp128CpuPokeMemory(uint32_t address, uint32_t value);
static void updateTapeMode(void);
static uint32_t sp128ReadNonFePort(uint32_t address);
static void sp128WriteNonFePort(uint32_t address, uint32_t value);
static uint32_t sp128CommonTapeGetEarBit(void);
static void sp128CommonTapeProcessMicBit(uint32_t micBit);
static void tactPlusN128(uint32_t value);
static void applyContentionDelay(void);
static void sp128DelayMemoryAccess(uint32_t address);
static void sp128DelayPortAccess(uint32_t address);

static uint32_t ramBankOffset(uint32_t bank) {
  return (bank & 0x07u) * 0x4000u;
}

static uint32_t romBankOffset(uint32_t bank) {
  return (bank & 0x01u) * 0x4000u;
}

static const uint32_t sp128SpectrumColors[16] = {
  0xff000000u,
  0xffaa0000u,
  0xff0000aau,
  0xffaa00aau,
  0xff00aa00u,
  0xffaaaa00u,
  0xff00aaaau,
  0xffaaaaaau,
  0xff000000u,
  0xffff0000u,
  0xff0000ffu,
  0xffff00ffu,
  0xff00ff00u,
  0xffffff00u,
  0xff00ffffu,
  0xffffffffu
};

static const Sp128ScreenConfig sp128UlaConfig = {
  8u, 7u, 48u, 48u, 8u, 192u, 24u, 24u, 128u, 40u, 12u, 2u, 1u,
  {4u, 3u, 2u, 1u, 0u, 0u, 6u, 5u}
};

#define Sp48ScreenConfig Sp128ScreenConfig
#define sp48PalConfig sp128UlaPalConfig
#define sp48NtscConfig sp128UlaNtscConfig
#define sp48SpectrumColors sp128UlaSpectrumColors
#define sp48TimingScreenWidth sp128TimingScreenWidth
#define sp48TimingScreenLines sp128TimingScreenLines
#define sp48TactsInFrame sp128TactsInFrame
#define sp48RasterLines sp128RasterLines
#define sp48ScreenLineTime sp128ScreenLineTime
#define sp48FirstDisplayLine sp128FirstDisplayLine
#define sp48FirstVisibleLine sp128FirstVisibleLine
#define sp48FirstVisibleBorderTact sp128FirstVisibleBorderTact
#define sp48DisplayLeftPixel sp128DisplayLeftPixel
#define sp48DisplayTopLine sp128DisplayTopLine
#define sp48Tacts sp128Tacts
#define sp48Frames sp128Frames
#define sp48NextFrameStartTact sp128NextFrameStartTact
#define sp48ClockMultiplier sp128ClockMultiplier
#define sp48Contention sp128Contention
#define sp48RenderingPhase sp128RenderingPhase
#define sp48RenderingPixelAddress sp128RenderingPixelAddress
#define sp48RenderingAttributeAddress sp128RenderingAttributeAddress
#define sp48RenderingPixelIndex sp128RenderingPixelIndex
#define sp48AttrColors sp128AttrColors
#define sp48AttrColorsInitialized sp128AttrColorsInitialized
#define sp48TotalContentionDelaySinceStart sp128TotalContentionDelaySinceStart
#define sp48ContentionDelaySincePause sp128ContentionDelaySincePause
#define sp48BorderFrameStartTact sp128BorderFrameStartTact
#define sp48LastRenderedFrameTact sp128LastRenderedFrameTact
#define sp48PixelByte1 sp128PixelByte1
#define sp48PixelByte2 sp128PixelByte2
#define sp48AttrByte1 sp128AttrByte1
#define sp48AttrByte2 sp128AttrByte2
#define sp48BorderColor sp128BorderColor
#define sp48PixelBuffer sp128PixelBuffer
#define currentScreenWidth sp128UlaCurrentScreenWidth
#define currentScreenHeight sp128UlaCurrentScreenHeight
#define pixelBufferWordCount sp128UlaPixelBufferWordCount
#define pixelBufferStartOffset sp128UlaPixelBufferStartOffset
#define getBorderPixel sp128UlaGetBorderPixel
#define flashFlag sp128UlaFlashFlag
#define initializeAttrColorTables sp128UlaInitializeAttrColorTables
#define getUlaPixelColor sp128UlaGetPixelColor
#define currentFrameTact sp128UlaCurrentFrameTact
#define calcPixelAddress sp128UlaCalcPixelAddress
#define calcAttrAddress sp128UlaCalcAttrAddress
#define calculateTimingBufferIndex sp128UlaCalculateTimingBufferIndex
#define clearTimingTables sp128UlaClearTimingTables
#define setRenderingTact sp128UlaSetRenderingTact
#define initializeTimingTables sp128UlaInitializeTimingTables
#define applyContentionDelay sp128UlaApplyContentionDelay
#define isContendedIoAddress sp128UlaIsContendedIoAddress
#define shouldRaiseInterrupt sp128UlaShouldRaiseInterrupt
#define beginBorderFrame sp128UlaBeginBorderFrame
#define renderBorderPixelsAt sp128UlaRenderBorderPixelsAt
#define renderByte1PixelsAt sp128UlaRenderByte1PixelsAt
#define renderByte2PixelsAt sp128UlaRenderByte2PixelsAt
#define renderUlaTact sp128UlaRenderTact
#define renderUlaUntilCurrentTact sp128UlaRenderUntilCurrentTact
#define renderUlaDisplay sp128UlaRenderDisplay
#define sp48ReadFloatingBus sp128UlaReadFloatingBus
#define readScreenMemoryOffset sp128ReadScreenMemoryOffset
#define setNextAudioSample sp128CommonSetNextAudioSample
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
#undef sp48RenderingPixelIndex
#undef sp48AttrColorsInitialized
#undef sp48AttrColors
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

#define sp48KeyboardLines sp128KeyboardLines
#define sp48KeyboardSelectedLineValue sp128KeyboardSelectedLineValue
#define resetKeyboard sp128CommonResetKeyboard
#define sp48SetKeyStatus sp128CommonSetKeyStatus
#define sp48GetKeyboardLine sp128CommonGetKeyboardLine
#include "../../../zxSpectrum/wasm/common/zx-spectrum-keyboard.c"
#undef sp48GetKeyboardLine
#undef sp48SetKeyStatus
#undef resetKeyboard
#undef sp48KeyboardSelectedLineValue
#undef sp48KeyboardLines

static uint32_t screenMemoryOffset(uint32_t y, uint32_t byteX) {
  return ((y & 0xc0u) << 5u) + ((y & 0x07u) << 8u) + ((y & 0x38u) << 2u) + byteX;
}

static uint32_t screenBankOffset(void) {
  return ramBankOffset(sp128UseShadowScreen != 0u ? 7u : 5u);
}

#include "../../../zxSpectrum/wasm/common/zx-spectrum-psg.c"

#define SP48_DEFAULT_SAMPLE_RATE SP128_DEFAULT_SAMPLE_RATE
#define SP48_AUDIO_SAMPLE_CAPACITY SP128_AUDIO_SAMPLE_CAPACITY
#define SP48_AUDIO_SAMPLE_SCALE SP128_AUDIO_SAMPLE_SCALE
#define SP48_TAPE_MODE_LOAD SP128_TAPE_MODE_LOAD
#define SP48_AUDIO_BEFORE_SAMPLE() sp128PsgPrepareAudioSample()
#define SP48_AUDIO_EXTRA_LEFT() sp128PsgAudioLevel()
#define SP48_AUDIO_EXTRA_RIGHT() sp128PsgAudioLevel()
#define sp48TapeMode sp128TapeMode
#define sp48TapeEarBit sp128TapeEarBit
#define sp48EarBit sp128EarBit
#define sp48MicBit sp128MicBit
#define sp48AudioAccumulatedEar sp128AudioAccumulatedEar
#define sp48AudioAccumulatedMic sp128AudioAccumulatedMic
#define sp48AudioAccumulatedTacts sp128AudioAccumulatedTacts
#define sp48AudioLastLevelChangeTact sp128AudioLastLevelChangeTact
#define sp48Tacts sp128Tacts
#define sp48AudioSampleCount sp128AudioSampleCount
#define sp48AudioSampleLength sp128AudioSampleLength
#define sp48AudioSampleRate sp128AudioSampleRate
#define sp48BaseClockFrequency SP128_BASE_CLOCK_FREQUENCY
#define sp48AudioNextSampleTact sp128AudioNextSampleTact
#define sp48AudioNextSampleTactFloor sp128AudioNextSampleTactFloor
#define sp48ClockMultiplier sp128ClockMultiplier
#define sp48DcFilterPrevInputLeft sp128DcFilterPrevInputLeft
#define sp48DcFilterPrevInputRight sp128DcFilterPrevInputRight
#define sp48DcFilterPrevOutputLeft sp128DcFilterPrevOutputLeft
#define sp48DcFilterPrevOutputRight sp128DcFilterPrevOutputRight
#define sp48AudioSamples sp128AudioSamples
#define sp48DiagnosticFlags sp128DiagnosticFlags
#define clampAudioWord sp128CommonClampAudioWord
#define effectiveAudioEarBit sp128CommonEffectiveAudioEarBit
#define resetAudioAccumulator sp128CommonResetAudioAccumulator
#define resetAudio sp128CommonResetAudio
#define beginAudioFrame sp128CommonBeginAudioFrame
#define recordAudioTransition sp128CommonRecordAudioTransition
#define setNextAudioSample sp128CommonSetNextAudioSample
#define sp48SetAudioSampleRate sp128CommonSetAudioSampleRate
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

#define SP48_TAPE_MODE_LOAD SP128_TAPE_MODE_LOAD
#define SP48_PORT_READ_NON_FE(address) sp128ReadNonFePort((uint32_t)(address))
#define SP48_PORT_WRITE_NON_FE(address, value) sp128WriteNonFePort((uint32_t)(address), (uint32_t)(value))
#define sp48PortFeValue sp128PortFeValue
#define sp48BorderColor sp128BorderColor
#define sp48EarBit sp128EarBit
#define sp48MicBit sp128MicBit
#define sp48BeeperLevel sp128BeeperLevel
#define sp48EarBitChangedFrom0Tacts sp128EarBitChangedFrom0Tacts
#define sp48EarBitChangedFrom1Tacts sp128EarBitChangedFrom1Tacts
#define sp48KeyboardSelectedLineValue sp128KeyboardSelectedLineValue
#define sp48TapeMode sp128TapeMode
#define sp48Tacts sp128Tacts
#define resetPortFe sp128CommonResetPortFe
#define sp48ReadPort sp128ReadPort
#define sp48WritePort sp128WritePort
#define sp48TapeGetEarBit sp128CommonTapeGetEarBit
#define sp48TapeProcessMicBit sp128CommonTapeProcessMicBit
#define renderUlaUntilCurrentTact sp128UlaRenderUntilCurrentTact
#define recordAudioTransition sp128CommonRecordAudioTransition
#include "../../../zxSpectrum/wasm/common/zx-spectrum-ports.c"
#undef recordAudioTransition
#undef renderUlaUntilCurrentTact
#undef sp48TapeProcessMicBit
#undef sp48TapeGetEarBit
#undef sp48WritePort
#undef sp48ReadPort
#undef resetPortFe
#undef sp48Tacts
#undef sp48TapeMode
#undef sp48KeyboardSelectedLineValue
#undef sp48EarBitChangedFrom1Tacts
#undef sp48EarBitChangedFrom0Tacts
#undef sp48BeeperLevel
#undef sp48MicBit
#undef sp48EarBit
#undef sp48BorderColor
#undef sp48PortFeValue
#undef SP48_PORT_WRITE_NON_FE
#undef SP48_PORT_READ_NON_FE
#undef SP48_TAPE_MODE_LOAD

static void clearTapeBlocks(void) {
  for (uint32_t i = 0u; i < SP128_TAPE_MAX_BLOCKS; i++) {
    sp128TapeBlocks[i].offset = 0u;
    sp128TapeBlocks[i].length = 0u;
    sp128TapeBlocks[i].pauseAfter = 0u;
    sp128TapeBlocks[i].pilotPulseLength = 0u;
    sp128TapeBlocks[i].sync1PulseLength = 0u;
    sp128TapeBlocks[i].sync2PulseLength = 0u;
    sp128TapeBlocks[i].zeroBitPulseLength = 0u;
    sp128TapeBlocks[i].oneBitPulseLength = 0u;
    sp128TapeBlocks[i].endSyncPulseLength = 0u;
    sp128TapeBlocks[i].lastByteUsedBits = 0u;
    sp128TapeBlocks[i].pilotPulseCount = 0u;
  }
}

void sp128TapeClearSavedBlocks(void) {
  sp128TapeSavedBlockCount = 0u;
  sp128TapeSavedDataLength = 0u;
  for (uint32_t i = 0u; i < SP128_TAPE_SAVE_MAX_BLOCKS; i++) {
    sp128SavedTapeBlocks[i].offset = 0u;
    sp128SavedTapeBlocks[i].length = 0u;
    sp128SavedTapeBlocks[i].pauseAfter = 0u;
  }
}

void sp128TapeClear(void) {
  sp128TapeBlockCount = 0u;
  sp128TapeDataLength = 0u;
  sp128TapeCurrentBlockIndex = 0u;
  sp128TapeUploadBlockCount = 0u;
  sp128TapeUploadDataLength = 0u;
  sp128TapeUploadActive = 0u;
  sp128TapeLoaded = 0u;
  sp128TapeEof = 1u;
  sp128TapeMode = SP128_TAPE_MODE_PASSIVE;
  sp128TapePlayPhase = SP128_TAPE_PHASE_NONE;
  sp128TapeEarBit = 1u;
  clearTapeBlocks();
  sp128TapeClearSavedBlocks();
}

static void resetTapePlayback(void) {
  sp128TapeCurrentBlockIndex = 0u;
  sp128TapeEof = sp128TapeLoaded == 0u || sp128TapeBlockCount == 0u ? 1u : 0u;
  sp128TapeMode = SP128_TAPE_MODE_PASSIVE;
  sp128TapePlayPhase = SP128_TAPE_PHASE_NONE;
  sp128TapeStartTact = sp128Tacts;
  sp128TapePilotEndPos = 0u;
  sp128TapeSync1EndPos = 0u;
  sp128TapeSync2EndPos = 0u;
  sp128TapeBitStartPos = 0u;
  sp128TapeBitPulseLength = 0u;
  sp128TapeDataIndex = 0u;
  sp128TapeBitMask = 0x80u;
  sp128TapeTermEndPos = 0u;
  sp128TapePauseEndPos = 0u;
  sp128TapeEarBit = 1u;
}

static void rebuildMemorySlotMap(void) {
  sp128MemorySlotBase[0] = &sp128Rom[romBankOffset(sp128SelectedRom)];
  sp128MemorySlotBase[1] = &sp128Ram[ramBankOffset(5u)];
  sp128MemorySlotBase[2] = &sp128Ram[ramBankOffset(2u)];
  sp128MemorySlotBase[3] = &sp128Ram[ramBankOffset(sp128SelectedBank)];
  sp128MemorySlotWritable[0] = 0u;
  sp128MemorySlotWritable[1] = 1u;
  sp128MemorySlotWritable[2] = 1u;
  sp128MemorySlotWritable[3] = 1u;
  sp128MemorySlotMapInitialized = 1u;
}

static void rebuildFlatRomSlot(void) {
  for (uint32_t i = 0u; i < 0x4000u; i++) {
    sp128Memory[i] = sp128MemorySlotBase[0][i];
  }
}

static void rebuildFlatTopRamSlot(void) {
  for (uint32_t i = 0u; i < 0x4000u; i++) {
    sp128Memory[0xc000u + i] = sp128MemorySlotBase[3][i];
  }
}

static void rebuildFlatMemory(void) {
  rebuildMemorySlotMap();
  for (uint32_t i = 0u; i < 0x4000u; i++) {
    sp128Memory[i] = sp128MemorySlotBase[0][i];
    sp128Memory[0x4000u + i] = sp128MemorySlotBase[1][i];
    sp128Memory[0x8000u + i] = sp128MemorySlotBase[2][i];
    sp128Memory[0xc000u + i] = sp128MemorySlotBase[3][i];
  }
}

SP128_ALWAYS_INLINE uint8_t isVisibleScreenBankOffset(uint32_t bank, uint32_t offset) {
  const uint32_t visibleBank = sp128UseShadowScreen != 0u ? 7u : 5u;
  return bank == visibleBank && offset < 0x1b00u;
}

SP128_ALWAYS_INLINE uint8_t isVisibleScreenSlotOffset(uint32_t slot, uint32_t offset) {
  const uint32_t visibleBank = sp128UseShadowScreen != 0u ? 7u : 5u;
  return offset < 0x1b00u && sp128MemorySlotBase[slot] == &sp128Ram[ramBankOffset(visibleBank)];
}

SP128_ALWAYS_INLINE uint8_t readMappedMemory(uint32_t address) {
  if (sp128MemorySlotMapInitialized == 0u) {
    rebuildMemorySlotMap();
  }
  const uint32_t maskedAddress = address & 0xffffu;
  return sp128MemorySlotBase[maskedAddress >> 14u][maskedAddress & 0x3fffu];
}

SP128_ALWAYS_INLINE void writeMappedMemory(uint32_t address, uint32_t value, uint32_t recordEvent) {
  if (sp128MemorySlotMapInitialized == 0u) {
    rebuildMemorySlotMap();
  }
  const uint32_t maskedAddress = address & 0xffffu;
  const uint8_t byteValue = (uint8_t)value;
  if (recordEvent != 0u && sp128CaptureBusEvents != 0u) {
    sp128LastMemoryAddress = (uint16_t)maskedAddress;
    sp128LastMemoryValue = byteValue;
    sp128LastMemoryIsWrite = 1u;
    sp128HasMemoryEvent = 1u;
  }
  const uint32_t slot = maskedAddress >> 14u;
  if (sp128MemorySlotWritable[slot] == 0u) {
    return;
  }
  const uint32_t offset = maskedAddress & 0x3fffu;
  if (isVisibleScreenSlotOffset(slot, offset) != 0u) {
    sp128UlaRenderUntilCurrentTact();
  }
  sp128MemorySlotBase[slot][offset] = byteValue;
  sp128Memory[maskedAddress] = byteValue;
}

SP128_ALWAYS_INLINE void updateVisibleRamBankMirrorByte(uint32_t bank, uint32_t offset, uint8_t value) {
  if (bank == 5u) {
    sp128Memory[0x4000u + offset] = value;
  }
  if (bank == 2u) {
    sp128Memory[0x8000u + offset] = value;
  }
  if (bank == sp128SelectedBank) {
    sp128Memory[0xc000u + offset] = value;
  }
}

SP128_ALWAYS_INLINE uint32_t currentFrameTact(void) {
  if (sp128TactsInFrame == 0u) {
    return 0u;
  }

  const uint32_t elapsedTacts =
    sp128Tacts >= sp128NextFrameStartTact ? sp128Tacts - sp128NextFrameStartTact : 0u;
  const uint32_t multiplier = sp128ClockMultiplier == 0u ? 1u : sp128ClockMultiplier;
  uint32_t tact = multiplier == 1u ? elapsedTacts : elapsedTacts / multiplier;
  if (tact >= sp128TactsInFrame) {
    tact = sp128TactsInFrame - 1u;
  }
  return tact;
}

SP128_ALWAYS_INLINE uint8_t isContendedMemoryAddress(uint32_t address) {
  const uint32_t page = address & 0xc000u;
  return page == 0x4000u || (page == 0xc000u && (sp128SelectedBank & 0x01u) != 0u);
}

SP128_ALWAYS_INLINE uint8_t isContendedIoAddress(uint32_t address) {
  return isContendedMemoryAddress(address);
}

SP128_ALWAYS_INLINE uint8_t shouldRaiseInterrupt(void) {
  return currentFrameTact() < 32u ? 1u : 0u;
}

SP128_ALWAYS_INLINE uint8_t sp128CpuReadMemory(uint32_t address) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  const uint8_t value = readMappedMemory(maskedAddress);
  if (sp128CaptureBusEvents != 0u) {
    sp128LastMemoryAddress = maskedAddress;
    sp128LastMemoryValue = value;
    sp128LastMemoryIsWrite = 0u;
    sp128HasMemoryEvent = 1u;
  }
  return value;
}

SP128_ALWAYS_INLINE void sp128CpuWriteMemory(uint32_t address, uint32_t value) {
  writeMappedMemory(address, value, 1u);
}

SP128_ALWAYS_INLINE void sp128CpuPokeMemory(uint32_t address, uint32_t value) {
  writeMappedMemory(address, value, 0u);
}

#define SP128_CPU_TACT_PLUS_N(value) \
  do { \
    const uint32_t z80Sp128Tacts = (uint32_t)(value); \
    cpu.tacts += z80Sp128Tacts; \
    sp128Tacts += z80Sp128Tacts; \
    sp128CommonSetNextAudioSample(); \
  } while (0)
#define SP128_CPU_APPLY_CONTENTION() \
  do { \
    const uint32_t z80Sp128Delay = sp128Contention[currentFrameTact()]; \
    cpu.tacts += z80Sp128Delay; \
    sp128Tacts += z80Sp128Delay; \
    sp128TotalContentionDelaySinceStart += z80Sp128Delay; \
    sp128ContentionDelaySincePause += z80Sp128Delay; \
    sp128CommonSetNextAudioSample(); \
  } while (0)
#define SP128_CPU_DELAY_MEMORY_ACCESS(address) \
  do { \
    if (isContendedMemoryAddress((uint32_t)(address)) != 0u) { \
      SP128_CPU_APPLY_CONTENTION(); \
    } \
    SP128_CPU_TACT_PLUS_N(3u); \
  } while (0)
#define SP128_CPU_DELAY_ADDRESS_BUS_ACCESS(address) \
  do { \
    if (isContendedMemoryAddress((uint32_t)(address)) != 0u) { \
      SP128_CPU_APPLY_CONTENTION(); \
    } \
  } while (0)
#define SP128_CPU_DELAY_PORT_ACCESS(address) \
  do { \
    const uint32_t z80Sp128PortAddress = (uint32_t)(address); \
    const uint8_t z80Sp128LowBit = (z80Sp128PortAddress & 0x0001u) != 0u ? 1u : 0u; \
    if (isContendedIoAddress(z80Sp128PortAddress) != 0u) { \
      if (z80Sp128LowBit != 0u) { \
        SP128_CPU_APPLY_CONTENTION(); \
        SP128_CPU_TACT_PLUS_N(1u); \
        SP128_CPU_APPLY_CONTENTION(); \
        SP128_CPU_TACT_PLUS_N(1u); \
        SP128_CPU_APPLY_CONTENTION(); \
        SP128_CPU_TACT_PLUS_N(1u); \
        SP128_CPU_APPLY_CONTENTION(); \
        SP128_CPU_TACT_PLUS_N(1u); \
      } else { \
        SP128_CPU_APPLY_CONTENTION(); \
        SP128_CPU_TACT_PLUS_N(1u); \
        SP128_CPU_APPLY_CONTENTION(); \
        SP128_CPU_TACT_PLUS_N(3u); \
      } \
    } else if (z80Sp128LowBit != 0u) { \
      SP128_CPU_TACT_PLUS_N(4u); \
    } else { \
      SP128_CPU_TACT_PLUS_N(1u); \
      SP128_CPU_APPLY_CONTENTION(); \
      SP128_CPU_TACT_PLUS_N(3u); \
    } \
  } while (0)

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() sp128Memory
#define Z80_READ_MEMORY(address) sp128CpuReadMemory((uint32_t)(address))
#define Z80_WRITE_MEMORY(address, value) sp128CpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_POKE_MEMORY(address, value) sp128CpuPokeMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_READ_PORT(address) ((uint8_t)sp128ReadPort((uint32_t)(address)))
#define Z80_WRITE_PORT(address, value) sp128WritePort((uint32_t)(address), (uint32_t)(value))
#define Z80_CAPTURE_BUS_EVENTS() sp128CaptureBusEvents
#define Z80_TACT_PLUS_N(value) SP128_CPU_TACT_PLUS_N(value)
#define Z80_DELAY_MEMORY_READ(address) SP128_CPU_DELAY_MEMORY_ACCESS(address)
#define Z80_DELAY_MEMORY_WRITE(address) SP128_CPU_DELAY_MEMORY_ACCESS(address)
#define Z80_DELAY_ADDRESS_BUS_ACCESS(address) SP128_CPU_DELAY_ADDRESS_BUS_ACCESS(address)
#define Z80_DELAY_PORT_READ(address) SP128_CPU_DELAY_PORT_ACCESS(address)
#define Z80_DELAY_PORT_WRITE(address) SP128_CPU_DELAY_PORT_ACCESS(address)
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
#undef SP128_CPU_TACT_PLUS_N
#undef SP128_CPU_APPLY_CONTENTION
#undef SP128_CPU_DELAY_MEMORY_ACCESS
#undef SP128_CPU_DELAY_ADDRESS_BUS_ACCESS
#undef SP128_CPU_DELAY_PORT_ACCESS

#define SP48_TAPE_MAX_BLOCKS SP128_TAPE_MAX_BLOCKS
#define SP48_TAPE_DATA_CAPACITY SP128_TAPE_DATA_CAPACITY
#define SP48_TAPE_FILENAME_CAPACITY SP128_TAPE_FILENAME_CAPACITY
#define SP48_TAPE_SAVE_MAX_BLOCKS SP128_TAPE_SAVE_MAX_BLOCKS
#define SP48_TAPE_SAVE_DATA_CAPACITY SP128_TAPE_SAVE_DATA_CAPACITY
#define SP48_TAPE_HEADER_PILOT_COUNT SP128_TAPE_HEADER_PILOT_COUNT
#define SP48_TAPE_DATA_PILOT_COUNT SP128_TAPE_DATA_PILOT_COUNT
#define SP48_TAPE_MIN_SAVE_PILOT_PULSE_COUNT SP128_TAPE_MIN_SAVE_PILOT_PULSE_COUNT
#define SP48_TAPE_SAVE_PULSE_TOLERANCE SP128_TAPE_SAVE_PULSE_TOLERANCE
#define SP48_TAPE_TOO_LONG_SAVE_PAUSE SP128_TAPE_TOO_LONG_SAVE_PAUSE
#define SP48_TAPE_PILOT_PULSE_LENGTH SP128_TAPE_PILOT_PULSE_LENGTH
#define SP48_TAPE_SYNC1_PULSE_LENGTH SP128_TAPE_SYNC1_PULSE_LENGTH
#define SP48_TAPE_SYNC2_PULSE_LENGTH SP128_TAPE_SYNC2_PULSE_LENGTH
#define SP48_TAPE_BIT0_PULSE_LENGTH SP128_TAPE_BIT0_PULSE_LENGTH
#define SP48_TAPE_BIT1_PULSE_LENGTH SP128_TAPE_BIT1_PULSE_LENGTH
#define SP48_TAPE_TERM_SYNC_PULSE_LENGTH SP128_TAPE_TERM_SYNC_PULSE_LENGTH
#define SP48_TAPE_LOAD_BYTES_ROUTINE SP128_TAPE_LOAD_BYTES_ROUTINE
#define SP48_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE SP128_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE
#define SP48_TAPE_LOAD_BYTES_RESUME_ROUTINE SP128_TAPE_LOAD_BYTES_RESUME_ROUTINE
#define SP48_TAPE_SAVE_BYTES_ROUTINE SP128_TAPE_SAVE_BYTES_ROUTINE
#define SP48_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW SP128_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW
#define SP48_DIAGNOSTIC_TAPE_DATA_OVERFLOW SP128_DIAGNOSTIC_TAPE_DATA_OVERFLOW
#define SP48_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE SP128_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE
#define SP48_DIAGNOSTIC_TAPE_SAVE_DATA_OVERFLOW SP128_DIAGNOSTIC_TAPE_SAVE_DATA_OVERFLOW
#define SP48_DIAGNOSTIC_TAPE_SAVE_BLOCK_OVERFLOW SP128_DIAGNOSTIC_TAPE_SAVE_BLOCK_OVERFLOW
#define SP48_DIAGNOSTIC_TAPE_SAVE_MALFORMED_PULSE SP128_DIAGNOSTIC_TAPE_SAVE_MALFORMED_PULSE
#define SP48_TAPE_MODE_PASSIVE SP128_TAPE_MODE_PASSIVE
#define SP48_TAPE_MODE_LOAD SP128_TAPE_MODE_LOAD
#define SP48_TAPE_MODE_SAVE SP128_TAPE_MODE_SAVE
#define SP48_TAPE_PHASE_NONE SP128_TAPE_PHASE_NONE
#define SP48_TAPE_PHASE_PILOT SP128_TAPE_PHASE_PILOT
#define SP48_TAPE_PHASE_SYNC SP128_TAPE_PHASE_SYNC
#define SP48_TAPE_PHASE_DATA SP128_TAPE_PHASE_DATA
#define SP48_TAPE_PHASE_TERM_SYNC SP128_TAPE_PHASE_TERM_SYNC
#define SP48_TAPE_PHASE_PAUSE SP128_TAPE_PHASE_PAUSE
#define SP48_TAPE_PHASE_COMPLETED SP128_TAPE_PHASE_COMPLETED
#define SP48_TAPE_SAVE_PHASE_NONE SP128_TAPE_SAVE_PHASE_NONE
#define SP48_TAPE_SAVE_PHASE_PILOT SP128_TAPE_SAVE_PHASE_PILOT
#define SP48_TAPE_SAVE_PHASE_SYNC1 SP128_TAPE_SAVE_PHASE_SYNC1
#define SP48_TAPE_SAVE_PHASE_SYNC2 SP128_TAPE_SAVE_PHASE_SYNC2
#define SP48_TAPE_SAVE_PHASE_DATA SP128_TAPE_SAVE_PHASE_DATA
#define SP48_TAPE_SAVE_PHASE_ERROR SP128_TAPE_SAVE_PHASE_ERROR
#define SP48_TAPE_MIC_PULSE_NONE SP128_TAPE_MIC_PULSE_NONE
#define SP48_TAPE_MIC_PULSE_TOO_SHORT SP128_TAPE_MIC_PULSE_TOO_SHORT
#define SP48_TAPE_MIC_PULSE_TOO_LONG SP128_TAPE_MIC_PULSE_TOO_LONG
#define SP48_TAPE_MIC_PULSE_PILOT SP128_TAPE_MIC_PULSE_PILOT
#define SP48_TAPE_MIC_PULSE_SYNC1 SP128_TAPE_MIC_PULSE_SYNC1
#define SP48_TAPE_MIC_PULSE_SYNC2 SP128_TAPE_MIC_PULSE_SYNC2
#define SP48_TAPE_MIC_PULSE_BIT0 SP128_TAPE_MIC_PULSE_BIT0
#define SP48_TAPE_MIC_PULSE_BIT1 SP128_TAPE_MIC_PULSE_BIT1
#define SP48_TAPE_MIC_PULSE_TERM_SYNC SP128_TAPE_MIC_PULSE_TERM_SYNC
#define Sp48TapeBlock Sp128TapeBlock
#define Sp48SavedTapeBlock Sp128TapeBlock
#define sp48TapeBlocks sp128TapeBlocks
#define sp48SavedTapeBlocks sp128SavedTapeBlocks
#define sp48TapeData sp128TapeData
#define sp48TapeFileName sp128TapeFileName
#define sp48TapeSaveData sp128TapeSaveData
#define sp48DiagnosticFlags sp128DiagnosticFlags
#define sp48BeeperLevel sp128BeeperLevel
#define sp48MicBit sp128MicBit
#define sp48Tacts sp128Tacts
#define sp48BaseClockFrequency SP128_BASE_CLOCK_FREQUENCY
#define sp48TapeBlockCount sp128TapeBlockCount
#define sp48TapeDataLength sp128TapeDataLength
#define sp48TapeCurrentBlockIndex sp128TapeCurrentBlockIndex
#define sp48TapeUploadBlockCount sp128TapeUploadBlockCount
#define sp48TapeUploadDataLength sp128TapeUploadDataLength
#define sp48TapeUploadActive sp128TapeUploadActive
#define sp48TapeLoaded sp128TapeLoaded
#define sp48TapeEof sp128TapeEof
#define sp48TapeMode sp128TapeMode
#define sp48TapePlayPhase sp128TapePlayPhase
#define sp48TapeStartTact sp128TapeStartTact
#define sp48TapePilotEndPos sp128TapePilotEndPos
#define sp48TapeSync1EndPos sp128TapeSync1EndPos
#define sp48TapeSync2EndPos sp128TapeSync2EndPos
#define sp48TapeBitStartPos sp128TapeBitStartPos
#define sp48TapeBitPulseLength sp128TapeBitPulseLength
#define sp48TapeDataIndex sp128TapeDataIndex
#define sp48TapeBitMask sp128TapeBitMask
#define sp48TapeTermEndPos sp128TapeTermEndPos
#define sp48TapePauseEndPos sp128TapePauseEndPos
#define sp48TapeEarBit sp128TapeEarBit
#define sp48TapeFastLoad sp128TapeFastLoad
#define sp48TapeModeChangeCount sp128TapeModeChangeCount
#define sp48TapeLastModeChangeTact sp128TapeLastModeChangeTact
#define sp48TapeLastModeChangePc sp128TapeLastModeChangePc
#define sp48TapeLoadStartCount sp128TapeLoadStartCount
#define sp48TapeSaveStartCount sp128TapeSaveStartCount
#define sp48TapeSaveMicBit sp128TapeSaveMicBit
#define sp48TapeSavePhase sp128TapeSavePhase
#define sp48TapeSavePreviousDataPulse sp128TapeSavePreviousDataPulse
#define sp48TapeSaveLastPulse sp128TapeSaveLastPulse
#define sp48TapeSaveBitOffset sp128TapeSaveBitOffset
#define sp48TapeSaveDataByte sp128TapeSaveDataByte
#define sp48TapeSaveLastMicBitTact sp128TapeSaveLastMicBitTact
#define sp48TapeSavePilotPulseCount sp128TapeSavePilotPulseCount
#define sp48TapeSavedBlockCount sp128TapeSavedBlockCount
#define sp48TapeSavedDataLength sp128TapeSavedDataLength
#define sp48TapeSavedRevision sp128TapeSavedRevision
#define sp48TapeSaveCurrentBlockOffset sp128TapeSaveCurrentBlockOffset
#define sp48TapeSaveCurrentBlockLength sp128TapeSaveCurrentBlockLength
#define sp48CpuReadMemory sp128CpuReadMemory
#define sp48CpuWriteMemory sp128CpuWriteMemory
#define recordAudioTransition sp128CommonRecordAudioTransition
#define clearTapeFileName sp128CommonClearTapeFileName
#define clearTapeBlocks sp128CommonClearTapeBlocks
#define sp48TapeGetEarBitInternal sp128CommonTapeGetEarBitInternal
#define setTapeEarBit sp128CommonSetTapeEarBit
#define sp48TapeProcessMicBit sp128CommonTapeProcessMicBit
#define sp48TapeClearSavedBlocks sp128CommonTapeClearSavedBlocks
#define resetTapeSaveCapture sp128CommonResetTapeSaveCapture
#define beginTapeSaveCapture sp128CommonBeginTapeSaveCapture
#define resetTapePlayback sp128CommonResetTapePlayback
#define sp48TapeClear sp128CommonTapeClear
#define sp48TapeClassifySavePulse sp128CommonTapeClassifySavePulse
#define sp48TapeSetFileNameByte sp128CommonTapeSetFileNameByte
#define sp48TapeBeginUpload sp128CommonTapeBeginUpload
#define sp48TapeSetBlock sp128CommonTapeSetBlock
#define sp48TapeWriteData sp128CommonTapeWriteData
#define sp48TapeFinishUpload sp128CommonTapeFinishUpload
#define sp48TapeRewind sp128CommonTapeRewind
#define tapeBlockPilotPulseCount sp128CommonTapeBlockPilotPulseCount
#define tapeBlockPauseTacts sp128CommonTapeBlockPauseTacts
#define currentTapeBlockAvailable sp128CommonCurrentTapeBlockAvailable
#define currentTapeBlock sp128CommonCurrentTapeBlock
#define setTapeModeInternal sp128CommonSetTapeModeInternal
#define nextTapeBlock sp128CommonNextTapeBlock
#define completeFastLoadBlock sp128CommonCompleteFastLoadBlock
#define fastLoadCurrentTapeBlock sp128CommonFastLoadCurrentTapeBlock
#define sp48TapeSetMode sp128CommonTapeSetMode
#define sp48TapeSetFastLoad sp128CommonTapeSetFastLoad
#define sp48TapeGetFastLoad sp128CommonTapeGetFastLoad
#define updateTapeMode sp128CommonUpdateTapeMode
#define sp48TapeGetEarBit sp128CommonTapeGetEarBit
#define sp48TapeGetMaxBlocks sp128CommonTapeGetMaxBlocks
#define sp48TapeGetDataCapacity sp128CommonTapeGetDataCapacity
#define sp48TapeDataPtr sp128CommonTapeDataPtr
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

static void updateTapeMode(void) {
  if (sp128SelectedRom != 1u) {
    return;
  }
  sp128CommonUpdateTapeMode();
}

static void tactPlusN128(uint32_t value) {
  cpu.tacts += value;
  sp128Tacts += value;
  sp128CommonSetNextAudioSample();
}

static void applyContentionDelay(void) {
  const uint32_t delay = sp128Contention[currentFrameTact()];
  cpu.tacts += delay;
  sp128Tacts += delay;
  sp128TotalContentionDelaySinceStart += delay;
  sp128ContentionDelaySincePause += delay;
  sp128CommonSetNextAudioSample();
}

static void sp128DelayMemoryAccess(uint32_t address) {
  if (isContendedMemoryAddress(address) != 0u) {
    applyContentionDelay();
  }
  tactPlusN128(3u);
}

static void sp128DelayPortAccess(uint32_t address) {
  const uint8_t lowBit = (address & 0x0001u) != 0u ? 1u : 0u;

  if (isContendedIoAddress(address) != 0u) {
    if (lowBit != 0u) {
      applyContentionDelay();
      tactPlusN128(1u);
      applyContentionDelay();
      tactPlusN128(1u);
      applyContentionDelay();
      tactPlusN128(1u);
      applyContentionDelay();
      tactPlusN128(1u);
    } else {
      applyContentionDelay();
      tactPlusN128(1u);
      applyContentionDelay();
      tactPlusN128(3u);
    }
  } else if (lowBit != 0u) {
    tactPlusN128(4u);
  } else {
    tactPlusN128(1u);
    applyContentionDelay();
    tactPlusN128(3u);
  }
}

static uint32_t normalizeClockMultiplier(uint32_t value) {
  switch (value) {
    case 1u:
    case 2u:
    case 4u:
    case 6u:
    case 8u:
    case 10u:
    case 12u:
    case 16u:
    case 20u:
    case 24u:
    case 32u:
    case 40u:
    case 48u:
    case 56u:
    case 64u:
      return value;
    default:
      return 1u;
  }
}

static void beginMachineFrame(void) {
  sp128FrameCompleted = 0u;

  if (sp128ClockMultiplier != sp128TargetClockMultiplier) {
    sp128ClockMultiplier = sp128TargetClockMultiplier;
    sp128TactsInCurrentFrame = sp128TactsInFrame * sp128ClockMultiplier;
  }

  sp128CommonBeginAudioFrame();
  sp128UlaBeginBorderFrame(sp128NextFrameStartTact);
  sp128CpuFrameSliceInstructions = 0u;
}

static void completeMachineFrame(void) {
  if (sp128FrameCompleted == 0u) {
    return;
  }

  sp128UlaRenderUntilCurrentTact();
  sp128NextFrameStartTact += sp128TactsInCurrentFrame;
  sp128Frames++;
}

void sp128Reset(void) {
  if (sp128ScreenLineTime == 0u) {
    sp128UlaInitializeTimingTables(&sp128UlaConfig);
  }
  z80Reset();
  sp128Frames = 0u;
  sp128Tacts = 0u;
  sp128ClockMultiplier = 1u;
  sp128TargetClockMultiplier = 1u;
  sp128TactsInCurrentFrame = sp128TactsInFrame;
  sp128NextFrameStartTact = 0u;
  sp128FrameCompleted = 0u;
  sp128SelectedRom = 0u;
  sp128SelectedBank = 0u;
  sp128PagingEnabled = 1u;
  sp128UseShadowScreen = 0u;
  sp128CommonResetPortFe();
  sp128BorderFrameStartTact = 0u;
  sp128LastRenderedFrameTact = 0u;
  sp128DiagnosticFlags = 0u;
  resetPsg();
  sp128TapeClear();
  sp128TotalContentionDelaySinceStart = 0u;
  sp128ContentionDelaySincePause = 0u;
  sp128CpuInstructionsExecuted = 0u;
  sp128CpuFrameSliceInstructions = 0u;
  sp128InterruptsRaised = 0u;
  sp128InterruptLineActive = 0u;
  sp128HasMemoryEvent = 0u;
  sp128CommonResetKeyboard();
  sp128CommonResetAudio();
  rebuildFlatMemory();
  sp128UlaRenderDisplay();
}

void sp128HardReset(void) {
  for (uint32_t i = 0u; i < SP128_RAM_SIZE; i++) {
    sp128Ram[i] = 0u;
  }
  sp128Reset();
}

uint32_t sp128ExecuteFrame(void) {
  beginMachineFrame();
  sp128CaptureBusEvents = 0u;
  sp128HasMemoryEvent = 0u;
  z80ClearBusEvents();

  const uint32_t frameEndTact = sp128NextFrameStartTact + sp128TactsInCurrentFrame;
  while (sp128Tacts < frameEndTact) {
    sp128ExecuteInstruction();
  }
  sp128CaptureBusEvents = 1u;
  return 0u;
}

uint32_t sp128ExecuteInstruction(void) {
  if (sp128FrameCompleted != 0u) {
    beginMachineFrame();
  }

  if (sp128CaptureBusEvents != 0u) {
    sp128HasMemoryEvent = 0u;
    z80ClearBusEvents();
  }
  updateTapeMode();
  const uint8_t intActive = shouldRaiseInterrupt();
  if (intActive != 0u && sp128InterruptLineActive == 0u) {
    sp128InterruptsRaised++;
  }
  sp128InterruptLineActive = intActive;
  z80SetSigInt(intActive);
  z80SetTacts(sp128Tacts);
  z80ExecuteCpuCycle();
  sp128Tacts = z80GetTacts();
  updateTapeMode();
  sp128CpuInstructionsExecuted++;
  sp128CpuFrameSliceInstructions++;
  sp128FrameCompleted =
    sp128Tacts >= sp128NextFrameStartTact + sp128TactsInCurrentFrame ? 1u : 0u;
  completeMachineFrame();
  return 0u;
}

void sp128RenderInstantScreen(void) {
  sp128UlaRenderDisplay();
}

void sp128UploadRomByte(uint32_t rom, uint32_t offset, uint32_t value) {
  if (rom < 2u && offset < 0x4000u) {
    if (rom == 0u && offset == 0u) {
      sp128RomUploadCount = 0u;
      sp128RomChecksum = 0u;
    }
    sp128RomUploadCount++;
    sp128RomChecksum =
      ((sp128RomChecksum << 5u) | (sp128RomChecksum >> 27u)) ^ ((uint8_t)value + offset + (rom << 14u));
    sp128Rom[romBankOffset(rom) + offset] = (uint8_t)value;
    if (rom == sp128SelectedRom) {
      sp128Memory[offset] = (uint8_t)value;
    }
  }
}

uint32_t sp128ReadMemory(uint32_t address) {
  return readMappedMemory(address);
}

void sp128WriteMemory(uint32_t address, uint32_t value) {
  writeMappedMemory(address, value, 1u);
}

uint32_t sp128ReadRamBank(uint32_t bank, uint32_t offset) {
  if (bank >= 8u || offset >= 0x4000u) {
    return 0xffu;
  }
  return sp128Ram[ramBankOffset(bank) + offset];
}

void sp128WriteRamBank(uint32_t bank, uint32_t offset, uint32_t value) {
  if (bank >= 8u || offset >= 0x4000u) {
    return;
  }
  const uint8_t byteValue = (uint8_t)value;
  if (isVisibleScreenBankOffset(bank, offset) != 0u) {
    sp128UlaRenderUntilCurrentTact();
  }
  sp128Ram[ramBankOffset(bank) + offset] = byteValue;
  updateVisibleRamBankMirrorByte(bank, offset, byteValue);
}

uint32_t sp128ReadRomBank(uint32_t bank, uint32_t offset) {
  if (bank >= 2u || offset >= 0x4000u) {
    return 0xffu;
  }
  return sp128Rom[romBankOffset(bank) + offset];
}

uint32_t sp128ReadScreenMemoryOffset(uint32_t offset) {
  const uint32_t bank = sp128UseShadowScreen != 0u ? 7u : 5u;
  return sp128Ram[ramBankOffset(bank) + (offset & 0x3fffu)];
}

uint32_t sp128ReadFloatingBus(void) {
  const uint32_t currentTactIndex =
    (sp128UlaCurrentFrameTact() + sp128TactsInFrame - 3u) % sp128TactsInFrame;
  const uint8_t phase = sp128RenderingPhase[currentTactIndex];

  switch (phase) {
    case SP48_RENDER_PHASE_BORDER_FETCH_PIXEL:
    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2:
    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1:
      return sp128ReadScreenMemoryOffset(sp128RenderingPixelAddress[currentTactIndex]);
    case SP48_RENDER_PHASE_BORDER_FETCH_ATTR:
    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2:
    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1:
      return sp128ReadScreenMemoryOffset(sp128RenderingAttributeAddress[currentTactIndex]);
    default:
      return 0xffu;
  }
}

void sp128SetKeyStatus(uint32_t key, uint32_t down) {
  sp128CommonSetKeyStatus(key, down);
}

static uint32_t sp128ReadNonFePort(uint32_t address) {
  if ((address & 0xc002u) == 0xc000u) {
    return sp128PsgDataRead();
  }
  if ((address & 0x00e0u) == 0u) {
    return 0xffu;
  }
  return sp128ReadFloatingBus();
}

static void sp128WriteNonFePort(uint32_t address, uint32_t value) {
  if ((address & 0xc002u) != 0x4000u) {
    if ((address & 0xc002u) == 0xc000u) {
      sp128PsgAddressWrite(value & 0x0fu);
      return;
    }
    if ((address & 0xc002u) == 0x8000u) {
      sp128PsgDataWrite(value);
      return;
    }
    return;
  }
  if (sp128PagingEnabled == 0u) {
    return;
  }
  const uint8_t oldSelectedBank = sp128SelectedBank;
  const uint8_t oldSelectedRom = sp128SelectedRom;
  const uint8_t nextUseShadowScreen = (value & 0x08u) != 0u ? 1u : 0u;
  if (nextUseShadowScreen != sp128UseShadowScreen) {
    sp128UlaRenderUntilCurrentTact();
  }
  sp128SelectedBank = (uint8_t)(value & 0x07u);
  sp128UseShadowScreen = nextUseShadowScreen;
  sp128SelectedRom = (value & 0x10u) != 0u ? 1u : 0u;
  sp128PagingEnabled = (value & 0x20u) != 0u ? 0u : 1u;
  rebuildMemorySlotMap();
  if (sp128SelectedRom != oldSelectedRom) {
    rebuildFlatRomSlot();
  }
  if (sp128SelectedBank != oldSelectedBank) {
    rebuildFlatTopRamSlot();
  }
}

void sp128DelayAddressBusAccess(uint32_t address) {
  if (isContendedMemoryAddress(address) != 0u) {
    applyContentionDelay();
  }
}

void sp128DelayPortRead(uint32_t address) {
  sp128DelayPortAccess(address);
}

void sp128DelayPortWrite(uint32_t address) {
  sp128DelayPortAccess(address);
}

void sp128ResetContentionCounters(void) {
  sp128TotalContentionDelaySinceStart = 0u;
  sp128ContentionDelaySincePause = 0u;
}

void sp128SetContentionValue(uint32_t tact, uint32_t value) {
  if (tact < SP128_TACTS_PER_FRAME) {
    sp128Contention[tact] = (uint8_t)value;
  }
}

void sp128SetAudioSampleRate(uint32_t rate) {
  sp128CommonSetAudioSampleRate(rate);
}

uint32_t sp128TapeBeginUpload(uint32_t blockCount, uint32_t totalDataLength) {
  sp128TapeClear();
  if (blockCount > SP128_TAPE_MAX_BLOCKS) {
    sp128DiagnosticFlags |= SP128_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW;
    return 0u;
  }
  if (totalDataLength > SP128_TAPE_DATA_CAPACITY) {
    sp128DiagnosticFlags |= SP128_DIAGNOSTIC_TAPE_DATA_OVERFLOW;
    return 0u;
  }
  sp128TapeUploadBlockCount = blockCount;
  sp128TapeUploadDataLength = totalDataLength;
  sp128TapeUploadActive = 1u;
  return 1u;
}

uint32_t sp128TapeSetBlock(
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
  if (sp128TapeUploadActive == 0u || index >= sp128TapeUploadBlockCount) {
    sp128DiagnosticFlags |= SP128_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE;
    return 0u;
  }
  if (offset > sp128TapeUploadDataLength || length > sp128TapeUploadDataLength - offset) {
    sp128DiagnosticFlags |= SP128_DIAGNOSTIC_TAPE_DATA_OVERFLOW;
    return 0u;
  }
  sp128TapeBlocks[index].offset = offset;
  sp128TapeBlocks[index].length = length;
  sp128TapeBlocks[index].pauseAfter = pauseAfter;
  sp128TapeBlocks[index].pilotPulseLength = pilotPulseLength;
  sp128TapeBlocks[index].sync1PulseLength = sync1PulseLength;
  sp128TapeBlocks[index].sync2PulseLength = sync2PulseLength;
  sp128TapeBlocks[index].zeroBitPulseLength = zeroBitPulseLength;
  sp128TapeBlocks[index].oneBitPulseLength = oneBitPulseLength;
  sp128TapeBlocks[index].endSyncPulseLength = endSyncPulseLength;
  sp128TapeBlocks[index].lastByteUsedBits = (uint8_t)(lastByteUsedBits & 0xffu);
  sp128TapeBlocks[index].pilotPulseCount = pilotPulseCount;
  return 1u;
}

uint32_t sp128TapeWriteData(uint32_t offset, uint32_t value) {
  if (sp128TapeUploadActive == 0u || offset >= sp128TapeUploadDataLength) {
    sp128DiagnosticFlags |= SP128_DIAGNOSTIC_TAPE_DATA_OVERFLOW;
    return 0u;
  }
  sp128TapeData[offset] = (uint8_t)value;
  return 1u;
}

uint32_t sp128TapeFinishUpload(void) {
  if (sp128TapeUploadActive == 0u) {
    sp128DiagnosticFlags |= SP128_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE;
    return 0u;
  }
  sp128TapeBlockCount = sp128TapeUploadBlockCount;
  sp128TapeDataLength = sp128TapeUploadDataLength;
  sp128TapeUploadActive = 0u;
  sp128TapeLoaded = sp128TapeBlockCount != 0u ? 1u : 0u;
  resetTapePlayback();
  return 1u;
}

void sp128TapeRewind(void) {
  resetTapePlayback();
}

void sp128TapeSetMode(uint32_t mode) {
  sp128CommonTapeSetMode(mode);
}

void sp128TapeSetFastLoad(uint32_t value) {
  sp128CommonTapeSetFastLoad(value);
}

uint32_t sp128TapeAppendSavedByte(uint32_t value) {
  if (sp128TapeSavedDataLength >= SP128_TAPE_SAVE_DATA_CAPACITY) {
    sp128DiagnosticFlags |= SP128_DIAGNOSTIC_TAPE_SAVE_DATA_OVERFLOW;
    return 0u;
  }
  if (sp128TapeSavedBlockCount == 0u) {
    sp128SavedTapeBlocks[0].offset = 0u;
    sp128SavedTapeBlocks[0].length = 0u;
    sp128SavedTapeBlocks[0].pauseAfter = 0u;
    sp128TapeSavedBlockCount = 1u;
  }
  if (sp128TapeSavedBlockCount > SP128_TAPE_SAVE_MAX_BLOCKS) {
    sp128DiagnosticFlags |= SP128_DIAGNOSTIC_TAPE_SAVE_BLOCK_OVERFLOW;
    return 0u;
  }
  sp128TapeSaveData[sp128TapeSavedDataLength++] = (uint8_t)value;
  sp128SavedTapeBlocks[0].length++;
  sp128TapeSavedRevision++;
  return 1u;
}

uint8_t *sp128MemoryPtr(void) {
  return sp128Memory;
}

uint8_t *sp128RamPtr(void) {
  return sp128Ram;
}

uint8_t *sp128RomPtr(void) {
  return sp128Rom;
}

uint32_t *sp128PixelBufferPtr(void) {
  return sp128PixelBuffer;
}

Sp128AudioSample *sp128AudioSamplesPtr(void) {
  return sp128AudioSamples;
}

uint8_t *sp128KeyboardLinesPtr(void) {
  return sp128KeyboardLines;
}

uint8_t *sp128TapeDataPtr(void) {
  return sp128TapeData;
}

uint8_t *sp128TapeSaveDataPtr(void) {
  return sp128TapeSaveData;
}

uint8_t *sp128TapeFileNamePtr(void) {
  return sp128TapeFileName;
}

void sp128TapeSetFileNameByte(uint32_t index, uint32_t value) {
  sp128CommonTapeSetFileNameByte(index, value);
}

uint32_t sp128TapeClassifySavePulse(uint32_t length) {
  return sp128CommonTapeClassifySavePulse(length);
}

uint32_t sp128TapeGetEarBit(void) {
  return sp128CommonTapeGetEarBit();
}

uint32_t sp128TapeGetFastLoad(void) {
  return sp128CommonTapeGetFastLoad();
}

uint32_t sp128TapeGetMaxBlocks(void) {
  return SP128_TAPE_MAX_BLOCKS;
}

uint32_t sp128TapeGetDataCapacity(void) {
  return SP128_TAPE_DATA_CAPACITY;
}

uint32_t sp128TapeGetFileNameCapacity(void) {
  return SP128_TAPE_FILENAME_CAPACITY;
}

uint32_t sp128TapeGetSaveDataCapacity(void) {
  return SP128_TAPE_SAVE_DATA_CAPACITY;
}

uint32_t sp128TapeGetSaveMaxBlocks(void) {
  return SP128_TAPE_SAVE_MAX_BLOCKS;
}

uint32_t sp128TapeGetBlockCount(void) {
  return sp128TapeBlockCount;
}

uint32_t sp128TapeGetDataLength(void) {
  return sp128TapeDataLength;
}

uint32_t sp128TapeGetLoaded(void) {
  return sp128TapeLoaded;
}

uint32_t sp128TapeGetEof(void) {
  return sp128TapeEof;
}

uint32_t sp128TapeGetUploadActive(void) {
  return sp128TapeUploadActive;
}

uint32_t sp128TapeGetMode(void) {
  return sp128TapeMode;
}

uint32_t sp128TapeGetCurrentBlockIndex(void) {
  return sp128TapeCurrentBlockIndex;
}

uint32_t sp128TapeGetCurrentEarBit(void) {
  return sp128TapeEarBit;
}

uint32_t sp128TapeGetPlayPhase(void) {
  return sp128TapePlayPhase;
}

uint32_t sp128TapeGetCurrentDataIndex(void) {
  return sp128TapeDataIndex;
}

uint32_t sp128TapeGetCurrentBitMask(void) {
  return sp128TapeBitMask;
}

uint32_t sp128TapeGetStartTact(void) {
  return sp128TapeStartTact;
}

uint32_t sp128TapeGetModeChangeCount(void) {
  return sp128TapeModeChangeCount;
}

uint32_t sp128TapeGetLastModeChangeTact(void) {
  return sp128TapeLastModeChangeTact;
}

uint32_t sp128TapeGetLastModeChangePc(void) {
  return sp128TapeLastModeChangePc;
}

uint32_t sp128TapeGetLoadStartCount(void) {
  return sp128TapeLoadStartCount;
}

uint32_t sp128TapeGetSaveStartCount(void) {
  return sp128TapeSaveStartCount;
}

uint32_t sp128TapeGetSavePhase(void) {
  return sp128TapeSavePhase;
}

uint32_t sp128TapeGetSaveLastPulse(void) {
  return sp128TapeSaveLastPulse;
}

uint32_t sp128TapeGetSaveMicBit(void) {
  return sp128TapeSaveMicBit;
}

uint32_t sp128TapeGetSaveLastMicBitTact(void) {
  return sp128TapeSaveLastMicBitTact;
}

uint32_t sp128TapeGetSavePilotPulseCount(void) {
  return sp128TapeSavePilotPulseCount;
}

uint32_t sp128TapeGetBlockOffset(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].offset : 0u;
}

uint32_t sp128TapeGetBlockLength(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].length : 0u;
}

uint32_t sp128TapeGetBlockPauseAfter(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].pauseAfter : 0u;
}

uint32_t sp128TapeGetBlockPilotPulseLength(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].pilotPulseLength : 0u;
}

uint32_t sp128TapeGetBlockSync1PulseLength(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].sync1PulseLength : 0u;
}

uint32_t sp128TapeGetBlockSync2PulseLength(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].sync2PulseLength : 0u;
}

uint32_t sp128TapeGetBlockZeroBitPulseLength(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].zeroBitPulseLength : 0u;
}

uint32_t sp128TapeGetBlockOneBitPulseLength(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].oneBitPulseLength : 0u;
}

uint32_t sp128TapeGetBlockEndSyncPulseLength(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].endSyncPulseLength : 0u;
}

uint32_t sp128TapeGetBlockLastByteUsedBits(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].lastByteUsedBits : 0u;
}

uint32_t sp128TapeGetBlockPilotPulseCount(uint32_t index) {
  return index < sp128TapeBlockCount ? sp128TapeBlocks[index].pilotPulseCount : 0u;
}

uint32_t sp128TapeGetSavedBlockCount(void) {
  return sp128TapeSavedBlockCount;
}

uint32_t sp128TapeGetSavedDataLength(void) {
  return sp128TapeSavedDataLength;
}

uint32_t sp128TapeGetSavedRevision(void) {
  return sp128TapeSavedRevision;
}

uint32_t sp128TapeGetSavedBlockOffset(uint32_t index) {
  return index < sp128TapeSavedBlockCount ? sp128SavedTapeBlocks[index].offset : 0u;
}

uint32_t sp128TapeGetSavedBlockLength(uint32_t index) {
  return index < sp128TapeSavedBlockCount ? sp128SavedTapeBlocks[index].length : 0u;
}

uint32_t sp128GetMemorySize(void) {
  return SP128_MEMORY_SIZE;
}

uint32_t sp128GetRamSize(void) {
  return SP128_RAM_SIZE;
}

uint32_t sp128GetRomSize(void) {
  return SP128_ROM_SIZE;
}

uint32_t sp128GetRomUploadCount(void) {
  return sp128RomUploadCount;
}

uint32_t sp128GetRomChecksum(void) {
  return sp128RomChecksum;
}

uint32_t sp128GetScreenWidth(void) {
  if (sp128ScreenLineTime == 0u) {
    sp128UlaInitializeTimingTables(&sp128UlaConfig);
  }
  return sp128TimingScreenWidth;
}

uint32_t sp128GetScreenHeight(void) {
  if (sp128ScreenLineTime == 0u) {
    sp128UlaInitializeTimingTables(&sp128UlaConfig);
  }
  return sp128TimingScreenLines;
}

uint32_t sp128GetPixelBufferStartOffset(void) {
  return 0u;
}

uint32_t sp128GetAudioSampleCount(void) {
  return sp128AudioSampleCount;
}

uint32_t sp128GetAudioSampleCapacity(void) {
  return SP128_AUDIO_SAMPLE_CAPACITY;
}

uint32_t sp128GetAudioSampleRate(void) {
  return sp128AudioSampleRate;
}

uint32_t sp128GetTactsInFrame(void) {
  return SP128_TACTS_PER_FRAME;
}

void sp128SetTargetClockMultiplier(uint32_t value) {
  sp128TargetClockMultiplier = normalizeClockMultiplier(value);
}

uint32_t sp128GetClockMultiplier(void) {
  return sp128ClockMultiplier;
}

uint32_t sp128GetTargetClockMultiplier(void) {
  return sp128TargetClockMultiplier;
}

uint32_t sp128GetTactsInCurrentFrame(void) {
  return sp128TactsInCurrentFrame;
}

uint32_t sp128GetBaseClockFrequency(void) {
  return SP128_BASE_CLOCK_FREQUENCY;
}

uint32_t sp128GetFrames(void) {
  return sp128Frames;
}

uint32_t sp128GetTacts(void) {
  return sp128Tacts;
}

uint32_t sp128GetCurrentFrameTact(void) {
  return currentFrameTact();
}

uint32_t sp128GetRasterLines(void) {
  return sp128RasterLines;
}

uint32_t sp128GetScreenLineTime(void) {
  return sp128ScreenLineTime;
}

uint32_t sp128GetTimingScreenWidth(void) {
  return sp128TimingScreenWidth;
}

uint32_t sp128GetTimingScreenLines(void) {
  return sp128TimingScreenLines;
}

uint32_t sp128GetFirstDisplayLine(void) {
  return sp128FirstDisplayLine;
}

uint32_t sp128GetFirstVisibleLine(void) {
  return sp128FirstVisibleLine;
}

uint32_t sp128GetFirstVisibleBorderTact(void) {
  return sp128FirstVisibleBorderTact;
}

uint32_t sp128GetNextFrameStartTact(void) {
  return sp128NextFrameStartTact;
}

uint32_t sp128GetFrameCompleted(void) {
  return sp128FrameCompleted;
}

void sp128SetTacts(uint32_t value) {
  sp128Tacts = value;
  z80SetTacts(value);
}

uint32_t sp128GetSelectedRom(void) {
  return sp128SelectedRom;
}

uint32_t sp128GetSelectedBank(void) {
  return sp128SelectedBank;
}

uint32_t sp128GetPagingEnabled(void) {
  return sp128PagingEnabled;
}

uint32_t sp128GetUseShadowScreen(void) {
  return sp128UseShadowScreen;
}

uint32_t sp128GetScreenBank(void) {
  return sp128UseShadowScreen != 0u ? 7u : 5u;
}

uint32_t sp128GetCurrentPartition(uint32_t slot) {
  switch (slot & 0x03u) {
    case 0u:
      return sp128SelectedRom == 0u ? 0xffffffffu : 0xfffffffeu;
    case 1u:
      return 5u;
    case 2u:
      return 2u;
    default:
      return sp128SelectedBank;
  }
}

uint32_t sp128GetContentionValue(uint32_t tact) {
  return tact < SP128_TACTS_PER_FRAME ? sp128Contention[tact] : 0u;
}

uint32_t sp128GetRenderingPhase(uint32_t tact) {
  return sp128RenderingPhase[tact % sp128TactsInFrame];
}

uint32_t sp128GetRenderingPixelAddress(uint32_t tact) {
  return sp128RenderingPixelAddress[tact % sp128TactsInFrame];
}

uint32_t sp128GetRenderingAttributeAddress(uint32_t tact) {
  return sp128RenderingAttributeAddress[tact % sp128TactsInFrame];
}

uint32_t sp128GetRenderingPixelIndex(uint32_t tact) {
  return sp128RenderingPixelIndex[tact % sp128TactsInFrame];
}

uint32_t sp128GetTotalContentionDelaySinceStart(void) {
  return sp128TotalContentionDelaySinceStart;
}

uint32_t sp128GetContentionDelaySincePause(void) {
  return sp128ContentionDelaySincePause;
}

uint32_t sp128GetCpuInstructionsExecuted(void) {
  return sp128CpuInstructionsExecuted;
}

uint32_t sp128GetCpuFrameSliceInstructions(void) {
  return sp128CpuFrameSliceInstructions;
}

uint32_t sp128GetInterruptsRaised(void) {
  return sp128InterruptsRaised;
}

uint32_t sp128GetInterruptLineActive(void) {
  return sp128InterruptLineActive;
}

uint32_t sp128GetCpuTacts(void) {
  return z80GetTacts();
}

uint32_t sp128GetCpuAf(void) {
  return z80GetAf();
}

void sp128SetCpuAf(uint32_t value) {
  z80SetAf(value);
}

uint32_t sp128GetCpuAfAlt(void) {
  return z80GetAfAlt();
}

void sp128SetCpuAfAlt(uint32_t value) {
  z80SetAfAlt(value);
}

uint32_t sp128GetCpuBcAlt(void) {
  return z80GetBcAlt();
}

void sp128SetCpuBcAlt(uint32_t value) {
  z80SetBcAlt(value);
}

uint32_t sp128GetCpuDeAlt(void) {
  return z80GetDeAlt();
}

void sp128SetCpuDeAlt(uint32_t value) {
  z80SetDeAlt(value);
}

uint32_t sp128GetCpuHlAlt(void) {
  return z80GetHlAlt();
}

void sp128SetCpuHlAlt(uint32_t value) {
  z80SetHlAlt(value);
}

uint32_t sp128GetCpuBc(void) {
  return z80GetBc();
}

void sp128SetCpuBc(uint32_t value) {
  z80SetBc(value);
}

uint32_t sp128GetCpuDe(void) {
  return z80GetDe();
}

void sp128SetCpuDe(uint32_t value) {
  z80SetDe(value);
}

uint32_t sp128GetCpuHl(void) {
  return z80GetHl();
}

void sp128SetCpuHl(uint32_t value) {
  z80SetHl(value);
}

uint32_t sp128GetCpuIx(void) {
  return z80GetIx();
}

void sp128SetCpuIx(uint32_t value) {
  z80SetIx(value);
}

uint32_t sp128GetCpuIy(void) {
  return z80GetIy();
}

void sp128SetCpuIy(uint32_t value) {
  z80SetIy(value);
}

uint32_t sp128GetCpuIr(void) {
  return z80GetIr();
}

void sp128SetCpuIr(uint32_t value) {
  z80SetIr(value);
}

uint32_t sp128GetCpuWz(void) {
  return z80GetWz();
}

void sp128SetCpuWz(uint32_t value) {
  z80SetWz(value);
}

uint32_t sp128GetCpuPc(void) {
  return z80GetPc();
}

void sp128SetCpuPc(uint32_t value) {
  z80SetPc(value);
}

uint32_t sp128GetCpuSp(void) {
  return z80GetSp();
}

void sp128SetCpuSp(uint32_t value) {
  z80SetSp(value);
}

uint32_t sp128GetCpuHalted(void) {
  return z80GetHalted();
}

uint32_t sp128GetCpuPrefix(void) {
  return z80GetPrefix();
}

uint32_t sp128GetCpuIff1(void) {
  return z80GetIff1();
}

void sp128SetCpuIff1(uint32_t value) {
  z80SetIff1(value);
}

uint32_t sp128GetCpuIff2(void) {
  return z80GetIff2();
}

void sp128SetCpuIff2(uint32_t value) {
  z80SetIff2(value);
}

uint32_t sp128GetCpuInterruptMode(void) {
  return z80GetInterruptMode();
}

void sp128SetCpuInterruptMode(uint32_t value) {
  z80SetInterruptMode(value);
}

uint32_t sp128GetCpuRetExecuted(void) {
  return z80GetRetExecuted();
}

uint32_t sp128GetCpuRetnExecuted(void) {
  return z80GetRetnExecuted();
}

uint32_t sp128GetLastMemoryAddress(void) {
  return sp128HasMemoryEvent != 0u ? sp128LastMemoryAddress : 0u;
}

uint32_t sp128GetLastMemoryValue(void) {
  return sp128HasMemoryEvent != 0u ? sp128LastMemoryValue : 0u;
}

uint32_t sp128GetLastMemoryIsWrite(void) {
  return sp128HasMemoryEvent != 0u ? sp128LastMemoryIsWrite : 0u;
}

uint32_t sp128GetLastPortAddress(void) {
  return z80GetLastPortAddress();
}

uint32_t sp128GetLastPortValue(void) {
  return z80GetLastPortValue();
}

uint32_t sp128GetLastPortIsWrite(void) {
  return z80GetLastPortIsWrite();
}

uint32_t sp128GetKeyboardLine(uint32_t line) {
  return sp128CommonGetKeyboardLine(line);
}

uint32_t sp128GetPortFeValue(void) {
  return sp128PortFeValue;
}

uint32_t sp128GetBorderColor(void) {
  return sp128BorderColor;
}

uint32_t sp128GetEarBit(void) {
  return sp128EarBit;
}

uint32_t sp128GetMicBit(void) {
  return sp128MicBit;
}

uint32_t sp128GetBeeperLevel(void) {
  return sp128BeeperLevel;
}

uint32_t sp128GetEarBitChangedFrom0Tacts(void) {
  return sp128EarBitChangedFrom0Tacts;
}

uint32_t sp128GetEarBitChangedFrom1Tacts(void) {
  return sp128EarBitChangedFrom1Tacts;
}

uint32_t sp128GetPsgRegisterIndex(void) {
  return sp128PsgRegisterIndex;
}

void sp128SetPsgRegisterIndex(uint32_t index) {
  sp128PsgSetRegisterIndex(index);
}

uint32_t sp128GetPsgRegisterValue(uint32_t index) {
  return sp128PsgGetRegisterValue(index);
}

void sp128WritePsgRegisterValue(uint32_t value) {
  writePsgRegister(value);
}

uint32_t sp128ReadPsgRegisterValue(void) {
  return sp128PsgDataRead();
}

uint32_t sp128GetPsgToneA(void) {
  return sp128PsgGetToneA();
}

uint32_t sp128GetPsgToneB(void) {
  return sp128PsgTone[1].period;
}

uint32_t sp128GetPsgToneC(void) {
  return sp128PsgTone[2].period;
}

uint32_t sp128GetPsgVolumeA(void) {
  return sp128PsgGetVolumeA();
}

uint32_t sp128GetPsgVolumeB(void) {
  return sp128PsgTone[1].volume & 0x0fu;
}

uint32_t sp128GetPsgVolumeC(void) {
  return sp128PsgTone[2].volume & 0x0fu;
}

uint32_t sp128GetPsgCurrentOutput(void) {
  return (uint32_t)sp128PsgCurrentOutput;
}

uint32_t sp128GetDiagnosticFlags(void) {
  return sp128DiagnosticFlags;
}
