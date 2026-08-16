#ifndef ZXNEXT_WASM_ZXNEXT_H
#define ZXNEXT_WASM_ZXNEXT_H

#include <stdint.h>

#define ZXNEXT_FLAT_MEMORY_SIZE 0x10000u
#define ZXNEXT_SRAM_CAPACITY (4u * 1024u * 1024u)
#define ZXNEXT_ROM_SIZE 0x20000u
#define ZXNEXT_PAGE_SIZE 0x2000u
#define ZXNEXT_PAGE_COUNT 8u
#define ZXNEXT_INVALID_PAGE_OFFSET 0xffffffffu
#define ZXNEXT_NEXT_ROM_OFFSET 0x00000u
#define ZXNEXT_DIVMMC_ROM_OFFSET 0x10000u
#define ZXNEXT_MULTIFACE_ROM_OFFSET 0x14000u
#define ZXNEXT_ALT_ROM_OFFSET 0x18000u
#define ZXNEXT_DIVMMC_RAM_OFFSET 0x20000u
#define ZXNEXT_NEXT_RAM_OFFSET 0x40000u
#define ZXNEXT_NEXT_ROM_SIZE 0x10000u
#define ZXNEXT_SMALL_ROM_SIZE 0x4000u
#define ZXNEXT_ALT_ROM_SIZE 0x8000u
#define ZXNEXT_DIVMMC_RAM_SIZE 0x20000u
#define ZXNEXT_SENTINEL_SIZE ZXNEXT_PAGE_SIZE
#define ZXNEXT_DEFAULT_MEMORY_SIZE_KB 2048u
#define ZXNEXT_DEFAULT_MAIN_RAM_PAGES 224u
#define ZXNEXT_MAX_MAIN_RAM_PAGES 480u
#define ZXNEXT_KEYBOARD_ROW_COUNT 8u
#define ZXNEXT_NEXTREG_COUNT 256u
#define ZXNEXT_SCREEN_WIDTH 720u
#define ZXNEXT_SCREEN_HEIGHT 288u
#define ZXNEXT_SCREEN_DISPLAY_WIDTH 512u
#define ZXNEXT_SCREEN_DISPLAY_HEIGHT 192u
#define ZXNEXT_ULA_LOGICAL_WIDTH 256u
#define ZXNEXT_ULA_LOGICAL_HEIGHT 192u
#define ZXNEXT_AUDIO_SAMPLE_CAPACITY 4096u
#define ZXNEXT_SD_COMMAND_BUFFER_SIZE 520u
#define ZXNEXT_SD_RESPONSE_BUFFER_SIZE 520u
#define ZXNEXT_DIAGNOSTIC_BUFFER_SIZE 64u
#define ZXNEXT_UART_RX_FIFO_SIZE 512u
#define ZXNEXT_UART_TX_FIFO_SIZE 64u
#define ZXNEXT_COPPER_MEMORY_SIZE 0x800u
#define ZXNEXT_CTC_CHANNEL_COUNT 8u
#define ZXNEXT_NMI_STATE_IDLE 0u
#define ZXNEXT_NMI_STATE_FETCH 1u
#define ZXNEXT_NMI_STATE_HOLD 2u
#define ZXNEXT_NMI_STATE_END 3u
#define ZXNEXT_DAISY_DEVICE_COUNT 14u
#define ZXNEXT_DAISY_PRIORITY_LINE 0u
#define ZXNEXT_DAISY_PRIORITY_UART0_RX 1u
#define ZXNEXT_DAISY_PRIORITY_UART1_RX 2u
#define ZXNEXT_DAISY_PRIORITY_CTC_BASE 3u
#define ZXNEXT_DAISY_PRIORITY_ULA 11u
#define ZXNEXT_DAISY_PRIORITY_UART0_TX 12u
#define ZXNEXT_DAISY_PRIORITY_UART1_TX 13u
#define ZXNEXT_LAYER_PIXEL_VALID 0x80000000u
#define ZXNEXT_LAYER_PIXEL_PRIORITY 0x40000000u
#define ZXNEXT_LAYER_PIXEL_RGB_MASK 0x000001ffu

uint32_t zxnextReadPort(uint32_t address);
void zxnextWritePort(uint32_t address, uint32_t value);
uint32_t zxnextReadNextReg(uint32_t reg);
void zxnextWriteNextReg(uint32_t reg, uint32_t value);
uint32_t zxnextReadMemory(uint32_t address);
void zxnextWriteMemory(uint32_t address, uint32_t value);
void zxnextWritePhysical(uint32_t offset, uint32_t value);
uint32_t zxnextReadDivMmcPortE3(void);
void zxnextWriteDivMmcPortE3(uint32_t value);
void zxnextSetDivMmcEnabled(uint32_t enabled);
void zxnextSetDivMmcEnableAutomap(uint32_t enabled);
uint32_t zxnextReadSpiDataPort(void);
void zxnextWriteSpiDataPort(uint32_t value);
void zxnextWriteSpiCsPort(uint32_t value);
uint32_t zxnextReadUlaPort(uint32_t address);
void zxnextWriteUlaPort(uint32_t value);
uint32_t zxnextGenerateAudioSamples(uint32_t requestedCount);
uint32_t zxnextGenerateAudioFrameSamples(void);
uint32_t zxnextGetAudioSampleCount(void);
uint32_t zxnextRenderInstantScreen(void);
uint32_t zxnextReadScreenMemoryOffset(uint32_t offset);
uint32_t zxnextGetScreenNonBlankPixelCount(void);
uint32_t zxnextGetDiagnosticFlags(void);
uint32_t zxnextDaisyUpdateIrqState(void);
uint32_t zxnextDaisyPeekInterruptVector(void);
uint32_t zxnextDaisyAcknowledge(void);
void zxnextDaisyReti(void);
uint32_t zxnextUlaPaletteBgra(uint32_t index);

static uint32_t zxnextPackLayerPixel(uint32_t rgb333, uint32_t priority);
static uint32_t zxnextLayerPixelBgra(uint32_t pixelInfo);
static uint32_t zxnextUlaPaletteRgb333(uint32_t index);
static uint32_t spritePaletteRgb333(uint32_t index);
static uint32_t activeMemorySize(void);
static void clearMutablePhysicalMemory(void);
static void resetMmuLayout(void);
static void updateMemoryConfig(uint32_t fromPort);
static void rebuildFlatMemory(void);
static void updateFlatMemoryForPhysicalOffset(uint32_t physicalOffset);
static void writeNextRegInternal(uint32_t reg, uint32_t value);
static void resetNextRegs(uint32_t hard);
static uint32_t isPortGroupEnabled(uint32_t regIndex, uint32_t bit);
static uint32_t readPhysical(uint32_t offset);
static uint32_t expansionReadOffset(uint32_t address);
static uint32_t multifaceReadOffset(uint32_t address);
static uint32_t multifaceHandleWrite(uint32_t address, uint32_t value);
static uint32_t expansionReadNextReg(uint32_t reg);
static uint32_t expansionWriteNextReg(uint32_t reg, uint32_t value);
static uint32_t expansionBusEnabled(void);
static void resetExpansionState(void);
static uint32_t expansionIsNmiAsserted(void);
static uint32_t expansionIsIntActive(void);
static uint32_t expansionIsRomcsClaimed(void);
static void resetMultifaceState(void);
static uint32_t zxnextReadMultifacePort(uint32_t address);
static void zxnextWriteMultifacePort(uint32_t address, uint32_t value);
static void multifaceOnFetch0066(void);
static void multifaceHandleRetn(void);
static uint32_t multifaceIsActive(void);
static uint32_t multifaceNmiHold(void);
static uint32_t multifaceEnabled(void);
static void syncPeripheral5FromNextReg(uint32_t value);
static void resetInputState(void);
static void syncPeripheral1FromNextReg(uint32_t value);
static void syncPeripheral5InputFromNextReg(uint32_t value);
static void syncJoystickIoFromNextReg(uint32_t value);
static void syncInputStateFromNextRegs(void);
static uint32_t inputReadNextReg(uint32_t reg);
static uint32_t zxnextReadMousePort(uint32_t address);
static uint32_t zxnextReadJoystickPort(uint32_t address);
void zxnextSetJoystickState(uint32_t left, uint32_t right);
void zxnextSetMouseState(
  uint32_t x,
  uint32_t y,
  uint32_t wheel,
  uint32_t left,
  uint32_t right,
  uint32_t middle,
  uint32_t swap,
  uint32_t dpi
);
void zxnextAddMouseDelta(int32_t dx, int32_t dy);
void zxnextAddMouseWheelDelta(int32_t dz);
void zxnextSetMouseButtons(uint32_t left, uint32_t right, uint32_t middle);
uint32_t zxnextGetJoystick1Mode(void);
uint32_t zxnextGetJoystick2Mode(void);
uint32_t zxnextGetJoystickIoModeEnabled(void);
uint32_t zxnextGetJoystickIoMode(void);
uint32_t zxnextGetJoystickIoModeParam(void);
uint32_t zxnextGetJoystickLeftState(void);
uint32_t zxnextGetJoystickRightState(void);
uint32_t zxnextGetJoystickStateWriteCount(void);
uint32_t zxnextGetMouseX(void);
uint32_t zxnextGetMouseY(void);
uint32_t zxnextGetMouseWheel(void);
uint32_t zxnextGetMouseButtonLeft(void);
uint32_t zxnextGetMouseButtonRight(void);
uint32_t zxnextGetMouseButtonMiddle(void);
uint32_t zxnextGetMouseSwapButtons(void);
uint32_t zxnextGetMouseDpi(void);
uint32_t zxnextGetMouseStateWriteCount(void);
static void resetUartState(void);
static uint32_t zxnextReadUartPort(uint32_t address);
static uint32_t zxnextWriteUartPort(uint32_t address, uint32_t value);
void zxnextUartOnNewFrame(void);
void zxnextPushUartRxByte(uint32_t channel, uint32_t value, uint32_t error);
uint32_t zxnextPopUartTxByte(uint32_t channel);
void zxnextSetUartBreakCondition(uint32_t channel, uint32_t value);
void zxnextSetUartFramingError(uint32_t channel, uint32_t value);
uint32_t zxnextGetUartSelected(void);
uint32_t zxnextGetUartPrescaler(uint32_t channel);
uint32_t zxnextGetUartPrescalerLsb(uint32_t channel);
uint32_t zxnextGetUartPrescalerMsb(uint32_t channel);
uint32_t zxnextGetUartFrameRegister(uint32_t channel);
uint32_t zxnextGetUartRxCount(uint32_t channel);
uint32_t zxnextGetUartTxCount(uint32_t channel);
uint32_t zxnextGetUartBreakCondition(uint32_t channel);
uint32_t zxnextGetUartFramingError(uint32_t channel);
uint32_t zxnextGetUartRxOverflow(uint32_t channel);
uint32_t zxnextGetUartTxWriteCount(void);
uint32_t zxnextGetUartRxInjectCount(void);
static void resetI2cState(void);
static uint32_t zxnextReadI2cPort(uint32_t address);
static uint32_t zxnextWriteI2cPort(uint32_t address, uint32_t value);
void zxnextI2cOnNewFrame(void);
void zxnextSetI2cCmosByte(uint32_t index, uint32_t value);
uint32_t zxnextGetI2cCmosByte(uint32_t index);
void zxnextSetI2cFrameRate(uint32_t framesPerSecond);
void zxnextAdvanceI2cClock(void);
uint32_t zxnextGetI2cSclOut(void);
uint32_t zxnextGetI2cSdaOut(void);
uint32_t zxnextGetI2cSdaLine(void);
uint32_t zxnextGetI2cState(void);
uint32_t zxnextGetI2cRegPointer(void);
uint32_t zxnextGetI2cFrameCounter(void);
uint32_t zxnextGetI2cFramesPerSecond(void);
uint32_t zxnextGetI2cClockAdvanceCount(void);
static void resetNmiState(void);
void zxnextRequestMfNmi(void);
void zxnextRequestDivMmcNmi(void);
void zxnextNmiBeforeOpcodeFetch(uint32_t pc);
uint32_t zxnextGetNmiState(void);
uint32_t zxnextGetNmiSourceMf(void);
uint32_t zxnextGetNmiSourceDivMmc(void);
uint32_t zxnextGetNmiSourceExpBus(void);
uint32_t zxnextGetPendingMfNmi(void);
uint32_t zxnextGetPendingDivMmcNmi(void);
uint32_t zxnextGetSigNmi(void);
uint32_t zxnextShouldPropagateIo(uint32_t bit);
void zxnextSetExpansionRomcsSignal(uint32_t value);
void zxnextSetExpansionExternalBusData(uint32_t value);
void zxnextSetExpansionNmiPending(uint32_t value);
void zxnextSetExpansionIntPending(uint32_t value);
uint32_t zxnextGetExpansionEnabled(void);
uint32_t zxnextGetExpansionRomcsReplacement(void);
uint32_t zxnextGetExpansionDisableIoCycles(void);
uint32_t zxnextGetExpansionDisableMemCycles(void);
uint32_t zxnextGetExpansionSoftResetPersistence(void);
uint32_t zxnextGetExpansionRomcsSignal(void);
uint32_t zxnextGetExpansionRomcsClaimed(void);
uint32_t zxnextGetExpansionExternalBusData(void);
uint32_t zxnextGetExpansionNmiPending(void);
uint32_t zxnextGetExpansionNmiAsserted(void);
uint32_t zxnextGetExpansionIntPending(void);
uint32_t zxnextGetExpansionIntActive(void);
uint32_t zxnextGetExpansionUlaOverrideEnabled(void);
uint32_t zxnextGetExpansionNmiDebounceDisabled(void);
uint32_t zxnextGetExpansionClockAlwaysOn(void);
uint32_t zxnextGetExpansionIoPropagate(void);
uint32_t zxnextGetMultifaceType(void);
void zxnextSetMultifaceType(uint32_t value);
uint32_t zxnextGetMultifaceEnabled(void);
uint32_t zxnextGetMultifaceNmiActive(void);
uint32_t zxnextGetMultifaceMfEnabled(void);
uint32_t zxnextGetMultifaceInvisible(void);
uint32_t zxnextGetMultifaceIsActive(void);
uint32_t zxnextGetMultifaceNmiHold(void);
uint32_t zxnextGetMultifaceEnablePortAddress(void);
uint32_t zxnextGetMultifaceDisablePortAddress(void);
uint32_t zxnextGetMultifaceMfPortEn(void);
void zxnextPressMultifaceNmiButton(void);
void zxnextMultifaceOnFetch0066(void);
void zxnextMultifaceHandleRetn(void);
static void resetAudioState(void);
static uint32_t audioReadNextReg(uint32_t reg);
static uint32_t audioWriteNextReg(uint32_t reg, uint32_t value);
static void resetPsgState(void);
static uint32_t zxnextReadAyPort(uint32_t address);
static uint32_t zxnextWriteAyPort(uint32_t address, uint32_t value);
static uint32_t zxnextPsgMixerLeft(void);
static uint32_t zxnextPsgMixerRight(void);
static uint32_t zxnextWriteDacPort(uint32_t address, uint32_t value);
static void resetDmaState(void);
uint32_t zxnextReadDmaPort(uint32_t mode);
void zxnextWriteDmaPort(uint32_t mode, uint32_t value);
uint32_t zxnextStepDma(void);
uint32_t zxnextRunDma(uint32_t maxSteps);
void zxnextAcknowledgeDmaBus(void);
static void resetCopperState(void);
static uint32_t copperReadNextReg(uint32_t reg);
static uint32_t copperWriteNextReg(uint32_t reg, uint32_t value);
void zxnextCopperExecuteTick(uint32_t vc, uint32_t hc);
uint32_t zxnextReadCopperMemory(uint32_t offset);
uint32_t zxnextGetCopperStartMode(void);
uint32_t zxnextGetCopperInstructionAddress(void);
uint32_t zxnextGetCopperStoredByte(void);
uint32_t zxnextGetCopperListAddr(void);
uint32_t zxnextGetCopperListData(void);
uint32_t zxnextGetCopperDout(void);
uint32_t zxnextGetCopperVerticalLineOffset(void);
uint32_t zxnextGetCopperTickCount(void);
uint32_t zxnextGetCopperWriteCount(void);
static void resetCtcState(void);
static void ctcWriteIntEnable(uint32_t mask);
uint32_t zxnextReadCtcPort(uint32_t address);
void zxnextWriteCtcPort(uint32_t address, uint32_t value);
void zxnextCtcClockTick(void);
void zxnextCtcAdvanceToSysClock(uint32_t currentSysClock);
void zxnextCtcOnNewFrame(uint32_t tactsInFrame);
uint32_t zxnextGetCtcChannelState(uint32_t channel);
uint32_t zxnextGetCtcControlReg(uint32_t channel);
uint32_t zxnextGetCtcTimeConstant(uint32_t channel);
uint32_t zxnextGetCtcPrescalerCount(uint32_t channel);
uint32_t zxnextGetCtcCount(uint32_t channel);
uint32_t zxnextGetCtcCountZeroD(uint32_t channel);
uint32_t zxnextGetCtcIowrD(uint32_t channel);
uint32_t zxnextGetCtcClkTrgD(uint32_t channel);
uint32_t zxnextGetCtcZcTo(uint32_t channel);
uint32_t zxnextGetCtcExpectingTimeConstant(uint32_t channel);
uint32_t zxnextGetCtcIm2VectorWrite(void);
uint32_t zxnextGetCtcLastSyncClock(void);
static void resetDivMmcState(void);
static void syncDivMmcStateFromNextRegs(void);
static uint32_t divMmcIsActive(void);
static uint32_t divMmcReadOffset(uint32_t address);
static uint32_t divMmcHandleWrite(uint32_t address, uint32_t value);
static void zxnextDivMmcBeforeOpcodeFetch(uint32_t pc);
static void zxnextDivMmcAfterOpcodeFetch(uint32_t retnExecuted);
static void resetSdCardState(void);
static void resetKeyboardState(void);
static uint32_t readKeyboardRows(uint32_t address);
static void resetUlaState(void);
static void resetScreenState(void);
static void updateScreenTimingFromNextRegs(void);
static void initializeScreenRenderingTables(void);
static void resetInterruptState(void);
static void resetPaletteState(void);
static uint32_t interruptReadNextReg(uint32_t reg);
static uint32_t interruptWriteNextReg(uint32_t reg, uint32_t value);
static uint32_t paletteReadNextReg(uint32_t reg);
static uint32_t paletteWriteNextReg(uint32_t reg, uint32_t value);
static uint32_t spritePaletteBgra(uint32_t index);
static void resetLayer2State(void);
static uint32_t layer2ReadNextReg(uint32_t reg);
static uint32_t layer2WriteNextReg(uint32_t reg, uint32_t value);
static uint32_t layer2MappedOffset(uint32_t address, uint32_t isWrite);
static uint32_t zxnextReadLayer2Port123b(void);
static void zxnextWriteLayer2Port123b(uint32_t value);
static uint32_t zxnextGetLayer2PixelInfo(uint32_t displayHc, uint32_t displayVc, uint32_t phase);
static uint32_t zxnextGetLayer2PixelBgra(uint32_t displayHc, uint32_t displayVc, uint32_t phase);
static uint32_t zxnextGetLoResPixelInfo(uint32_t displayHc, uint32_t displayVc, uint32_t phase);
static uint32_t zxnextGetLoResPixelBgra(uint32_t displayHc, uint32_t displayVc, uint32_t phase);
static void resetTilemapState(void);
static uint32_t tilemapReadNextReg(uint32_t reg);
static uint32_t tilemapWriteNextReg(uint32_t reg, uint32_t value);
static uint32_t zxnextGetTilemapPixelBgra(
  uint32_t displayHc,
  uint32_t displayVc,
  uint32_t phase,
  uint32_t ulaPixel,
  uint32_t ulaOpaque
);
static uint32_t zxnextGetTilemapPixelInfo(
  uint32_t displayHc,
  uint32_t displayVc,
  uint32_t phase,
  uint32_t ulaPixelInfo
);
static void resetSpriteState(void);
static uint32_t spritesReadNextReg(uint32_t reg);
static uint32_t spritesWriteNextReg(uint32_t reg, uint32_t value);
static uint32_t zxnextReadSpritePort303b(void);
static void zxnextWriteSpritePort303b(uint32_t value);
static void zxnextWriteSpritePatternPort(uint32_t value);
static void zxnextWriteSpriteAttributePort(uint32_t value);
static uint32_t zxnextGetSpritePixelInfo(uint32_t displayHc, uint32_t displayVc, uint32_t phase);
static uint32_t zxnextGetSpritePixelBgra(uint32_t displayHc, uint32_t displayVc, uint32_t phase);

#endif
