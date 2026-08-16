#include "zxnext.h"

static uint8_t flatMemory[ZXNEXT_FLAT_MEMORY_SIZE];
static uint8_t sram[ZXNEXT_SRAM_CAPACITY];
static uint8_t rom[ZXNEXT_ROM_SIZE];
static uint8_t keyboardRows[ZXNEXT_KEYBOARD_ROW_COUNT];
static uint8_t nextRegs[ZXNEXT_NEXTREG_COUNT];
static uint32_t pixelBuffer[ZXNEXT_SCREEN_WIDTH * ZXNEXT_SCREEN_HEIGHT];
static int16_t audioSamples[ZXNEXT_AUDIO_SAMPLE_CAPACITY * 2u];
static uint8_t sdCommandBuffer[ZXNEXT_SD_COMMAND_BUFFER_SIZE];
static uint8_t sdResponseBuffer[ZXNEXT_SD_RESPONSE_BUFFER_SIZE];
static uint32_t diagnosticBuffer[ZXNEXT_DIAGNOSTIC_BUFFER_SIZE];
static uint8_t mmuRegs[ZXNEXT_PAGE_COUNT];
static uint8_t nextRegLastWrite[ZXNEXT_NEXTREG_COUNT];
static uint8_t nextRegHasLastWrite[ZXNEXT_NEXTREG_COUNT];
static uint32_t pageReadOffset[ZXNEXT_PAGE_COUNT];
static uint32_t pageWriteOffset[ZXNEXT_PAGE_COUNT];
static uint32_t pageBank16k[ZXNEXT_PAGE_COUNT];
static uint32_t pageBank8k[ZXNEXT_PAGE_COUNT];
static uint32_t keyboardRowWrites = 0;
static uint8_t ulaBorderColor = 7u;
static uint8_t ulaEarBit = 0;
static uint8_t ulaMicBit = 0;
static uint8_t ulaBeeperEar = 0;
static uint8_t ulaBeeperMic = 0;
static uint32_t ulaBit4ChangedFrom0Tacts = 0;
static uint32_t ulaBit4ChangedFrom1Tacts = 0;
static uint8_t dacChannels[4] = { 0x80u, 0x80u, 0x80u, 0x80u };
static uint32_t audioSampleCount = 0u;
static uint8_t audioBeepOnlyToInternalSpeaker = 0u;
static uint8_t audioPsgMode = 0u;
static uint8_t audioAyStereoMode = 0u;
static uint8_t audioEnableInternalSpeaker = 1u;
static uint8_t audioEnable8BitDacs = 1u;
static uint8_t audioSilenceHdmiAudio = 0u;
static uint8_t audioEnableTurbosound = 1u;
static uint8_t audioAyMonoEnable[3] = { 0u, 0u, 0u };
static uint8_t psgRegisters[3][16];
static uint8_t psgRegisterIndex[3] = { 0u, 0u, 0u };
static uint8_t psgSelectedChip = 0u;
static uint8_t psgPanning[3] = { 0x03u, 0x03u, 0x03u };
static uint8_t dmaRegs[50];
static uint8_t dmaFollow[5];
static uint8_t dmaNumFollow = 0u;
static uint8_t dmaCurFollow = 0u;
static uint8_t dmaReadSeq = 0u;
static uint8_t dmaStatus = 0u;
static uint8_t dmaMode = 0u;
static uint8_t dmaSeq = 0u;
static uint8_t dmaBusState = 0u;
static uint8_t dmaEnabled = 0u;
static uint8_t dmaDirectionAtoB = 1u;
static uint8_t dmaPortAIsIo = 0u;
static uint8_t dmaPortBIsIo = 0u;
static uint8_t dmaPortAAddressMode = 1u;
static uint8_t dmaPortBAddressMode = 1u;
static uint8_t dmaPortATiming = 0u;
static uint8_t dmaPortBTiming = 0u;
static uint8_t dmaPortBPrescaler = 0u;
static uint8_t dmaTransferMode = 1u;
static uint8_t dmaAutoRestart = 0u;
static uint8_t dmaTransferData = 0u;
static uint8_t dmaForceReady = 0u;
static uint8_t dmaInterruptPending = 0u;
static uint8_t dmaInterruptUnderService = 0u;
static uint8_t dmaVector = 0u;
static uint8_t dmaResetPointer = 0u;
static uint8_t copperMemory[ZXNEXT_COPPER_MEMORY_SIZE];
static uint8_t copperStartMode = 0u;
static uint16_t copperInstructionAddress = 0u;
static uint8_t copperStoredByte = 0u;
static uint16_t copperListAddr = 0u;
static uint16_t copperListData = 0u;
static uint8_t copperDout = 0u;
static uint8_t copperVerticalLineOffset = 0u;
static uint32_t copperTickCount = 0u;
static uint32_t copperWriteCount = 0u;
static uint8_t ctcState[ZXNEXT_CTC_CHANNEL_COUNT];
static uint8_t ctcControlReg[ZXNEXT_CTC_CHANNEL_COUNT];
static uint8_t ctcTimeConstantReg[ZXNEXT_CTC_CHANNEL_COUNT];
static uint8_t ctcPrescalerCount[ZXNEXT_CTC_CHANNEL_COUNT];
static uint8_t ctcCount[ZXNEXT_CTC_CHANNEL_COUNT];
static uint8_t ctcCountZeroD[ZXNEXT_CTC_CHANNEL_COUNT];
static uint8_t ctcIowrD[ZXNEXT_CTC_CHANNEL_COUNT];
static uint8_t ctcClkTrgD[ZXNEXT_CTC_CHANNEL_COUNT];
static uint8_t ctcZcTo[ZXNEXT_CTC_CHANNEL_COUNT];
static uint8_t ctcIm2VectorWrite = 0u;
static uint32_t ctcLastSyncClock = 0u;
static uint16_t dmaPortAStart = 0u;
static uint16_t dmaPortBStart = 0u;
static uint16_t dmaBlockLength = 0u;
static uint16_t dmaAddressA = 0u;
static uint16_t dmaAddressB = 0u;
static uint16_t dmaCount = 0u;
static uint16_t dmaByteCounter = 0u;
static uint32_t dmaTransferCount = 0u;
static uint32_t dmaBlockCompletionCount = 0u;
static uint32_t dmaLastStepTicks = 0u;

static uint32_t frames = 0;
static uint32_t tacts = 0;
static uint32_t frameTacts = 0;
static uint32_t currentFrameTact = 0;
static uint32_t hardResetCount = 0;
static uint32_t resetCount = 0;
static uint32_t romUploadCount = 0;
static uint32_t uploadedRomMask = 0;
static uint32_t cpuInstructionsExecuted = 0;
static uint32_t frameCallCount = 0;
static uint32_t lastFrameInstructionsExecuted = 0;
static uint16_t cpuPc = 0;
static uint16_t cpuSp = 0xffffu;
static uint16_t lastMemoryAddress = 0;
static uint8_t lastMemoryValue = 0;
static uint8_t lastMemoryIsWrite = 0;
static uint8_t hasMemoryEvent = 0;
static uint16_t lastPortAddress = 0;
static uint8_t lastPortValue = 0xffu;
static uint8_t lastPortIsWrite = 0;
static uint8_t hasPortEvent = 0;
static uint8_t portReadValue = 0xffu;
static uint32_t unsupportedPortReadCount = 0;
static uint32_t unsupportedPortWriteCount = 0;
static uint16_t firstUnsupportedPortAddress = 0;
static uint8_t firstUnsupportedPortValue = 0xffu;
static uint8_t firstUnsupportedPortIsWrite = 0;
static uint8_t firstUnsupportedPortOwnerStep = 0;
static uint8_t lastTbBlueAddress = 0;
static uint8_t lastTbBlueValue = 0;
static uint8_t hasTbBlueEvent = 0;
static uint8_t captureBusEvents = 1;
static uint8_t pagingEnabled = 1;
static uint8_t useShadowScreen = 0;
static uint8_t allRamMode = 0;
static uint8_t wasInAllRamMode = 0;
static uint8_t specialConfig = 0;
static uint8_t selectedRomLsb = 0;
static uint8_t selectedRomMsb = 0;
static uint8_t selectedBankLsb = 0;
static uint8_t selectedBankMsb = 0;
static uint8_t portEff7Value = 0;
static uint8_t nextRegIndex = 0;
static uint8_t nextRegLastReadValue = 0xffu;
static uint8_t nextRegConfigMode = 0;
static uint8_t nr02ResetType = 0x04u;
static uint8_t cpuProgrammedSpeed = 0u;
static uint8_t cpuEffectiveSpeed = 0u;
static uint32_t cpuContentionDelaySinceStart = 0u;
static uint8_t interruptIntSignalActive = 0u;
static uint8_t interruptUlaDisabled = 0u;
static uint8_t interruptLineEnabled = 0u;
static uint8_t interruptExpBusEnabled = 0u;
static uint16_t interruptLine = 0u;
static uint8_t interruptIm2TopBits = 0u;
static uint8_t interruptStacklessNmiEnabled = 0u;
static uint8_t interruptHwIm2Mode = 0u;
static uint16_t interruptNmiReturnAddress = 0u;
static uint8_t interruptUart0TxEmpty = 0u;
static uint8_t interruptUart0RxNearFull = 0u;
static uint8_t interruptUart0RxAvailable = 0u;
static uint8_t interruptUart1TxEmpty = 0u;
static uint8_t interruptUart1RxNearFull = 0u;
static uint8_t interruptUart1RxAvailable = 0u;
static uint8_t interruptLineStatus = 0u;
static uint8_t interruptUlaStatus = 0u;
static uint8_t interruptUart0TxEmptyStatus = 0u;
static uint8_t interruptUart0RxNearFullStatus = 0u;
static uint8_t interruptUart0RxAvailableStatus = 0u;
static uint8_t interruptUart1TxEmptyStatus = 0u;
static uint8_t interruptUart1RxNearFullStatus = 0u;
static uint8_t interruptUart1RxAvailableStatus = 0u;
static uint8_t interruptEnableNmiToDma = 0u;
static uint8_t interruptEnableLineToDma = 0u;
static uint8_t interruptEnableUlaToDma = 0u;
static uint8_t interruptEnableUart0TxEmptyToDma = 0u;
static uint8_t interruptEnableUart0RxNearFullToDma = 0u;
static uint8_t interruptEnableUart0RxAvailableToDma = 0u;
static uint8_t interruptEnableUart1TxEmptyToDma = 0u;
static uint8_t interruptEnableUart1RxNearFullToDma = 0u;
static uint8_t interruptEnableUart1RxAvailableToDma = 0u;
static uint8_t interruptCtcEnabled[8];
static uint8_t interruptCtcStatus[8];
static uint8_t interruptEnableCtcToDma[8];
static uint8_t interruptDaisyInService[ZXNEXT_DAISY_DEVICE_COUNT];
static uint8_t interruptBusResetRequested = 0u;
static uint8_t interruptMfNmiByIoTrap = 0u;
static uint8_t interruptMfNmiByNextReg = 0u;
static uint8_t interruptDivMmcNmiByNextReg = 0u;
static uint8_t interruptLastWasHardReset = 0u;
static uint8_t interruptLastWasSoftReset = 0u;
static uint8_t paletteIndex = 0u;
static uint8_t paletteDisableAutoInc = 0u;
static uint8_t paletteSelected = 0u;
static uint8_t paletteSecondSprite = 0u;
static uint8_t paletteSecondLayer2 = 0u;
static uint8_t paletteSecondUla = 0u;
static uint8_t paletteSecondTilemap = 0u;
static uint8_t paletteEnableUlaNextMode = 0u;
static uint8_t paletteSecondWrite = 0u;
static uint8_t paletteStoredValue = 0u;
static uint16_t paletteEntries[8][256];
static uint8_t timexPortValue = 0u;
static uint8_t timexPortBits = 0u;
static uint8_t ulaPlusMode = 0u;
static uint8_t ulaPlusPaletteIndex = 0u;
static uint8_t ulaPlusEnabled = 0u;
static uint8_t layer2Enabled = 0u;
static uint8_t layer2Resolution = 0u;
static uint8_t layer2PaletteOffset = 0u;
static uint16_t layer2ScrollX = 0u;
static uint8_t layer2ScrollY = 0u;
static uint8_t layer2ClipWindowX1 = 0u;
static uint8_t layer2ClipWindowX2 = 255u;
static uint8_t layer2ClipWindowY1 = 0u;
static uint8_t layer2ClipWindowY2 = 191u;
static uint8_t layer2ClipIndex = 0u;
static uint8_t layer2ActiveRamBank = 8u;
static uint8_t layer2ShadowRamBank = 11u;
static uint8_t layer2UseShadowBank = 0u;
static uint8_t layer2Bank = 0u;
static uint8_t layer2BankOffset = 0u;
static uint8_t layer2EnableMappingForReads = 0u;
static uint8_t layer2EnableMappingForWrites = 0u;
static uint8_t layerPriority = 0u;
static uint8_t fallbackColor = 0u;
static uint8_t globalTransparencyColor = 0xe3u;
static uint8_t loResEnabled = 0u;
static uint8_t loResRadastanMode = 0u;
static uint8_t loResRadastanTimexXor = 0u;
static uint8_t loResPaletteOffset = 0u;
static uint8_t loResScrollX = 0u;
static uint8_t loResScrollY = 0u;
static uint8_t tilemapEnabled = 0u;
static uint8_t tilemap80x32Resolution = 0u;
static uint8_t tilemapEliminateAttributes = 0u;
static uint8_t tilemapTextMode = 0u;
static uint8_t tilemap512TileMode = 0u;
static uint8_t tilemapForceOnTopOfUla = 0u;
static uint8_t tilemapTransparencyIndex = 0x0fu;
static uint8_t tilemapClipIndex = 0u;
static uint8_t tilemapClipWindowX1 = 0u;
static uint8_t tilemapClipWindowX2 = 159u;
static uint8_t tilemapClipWindowY1 = 0u;
static uint8_t tilemapClipWindowY2 = 255u;
static uint16_t tilemapScrollX = 0u;
static uint8_t tilemapScrollY = 0u;
static uint8_t tilemapUseBank7 = 0u;
static uint8_t tilemapBank5Msb = 0u;
static uint8_t tilemapTileDefUseBank7 = 0u;
static uint8_t tilemapTileDefBank5Msb = 0u;
static uint8_t tilemapPaletteOffset = 0u;
static uint8_t tilemapXMirror = 0u;
static uint8_t tilemapYMirror = 0u;
static uint8_t tilemapRotate = 0u;
static uint8_t tilemapUlaOver = 0u;
static uint8_t tilemapDefaultAttr = 0u;
static uint8_t internalPortEnables[4] = { 0xffu, 0xffu, 0xffu, 0x0fu };
static uint8_t busPortEnables[4] = { 0xffu, 0xffu, 0xffu, 0x8fu };
static uint32_t configuredMemorySizeKb = ZXNEXT_DEFAULT_MEMORY_SIZE_KB;
static uint32_t activeMainRamPages = ZXNEXT_DEFAULT_MAIN_RAM_PAGES;
static uint8_t divMmcEnabled = 1u;
static uint8_t divMmcConmem = 0u;
static uint8_t divMmcMapram = 0u;
static uint8_t divMmcBank = 0u;
static uint8_t divMmcMultifaceType = 0u;
static uint8_t divMmcLastE3Value = 0u;
static uint8_t divMmcEnableAutomap = 0u;
static uint8_t divMmcRequestAutomapOn = 0u;
static uint8_t divMmcRequestAutomapOff = 0u;
static uint8_t divMmcAutoMapActive = 0u;
static uint8_t divMmcNmiButtonPressed = 0u;
static uint8_t divMmcResetMapramFlag = 0u;
static uint8_t divMmcRstTrapEnabled = 0u;
static uint8_t divMmcRstTrapOnlyWithRom3 = 0xffu;
static uint8_t divMmcRstTrapInstant = 0u;
static uint8_t divMmcEntry1 = 0u;
static uint8_t sdSelectedCard = 0u;
static uint8_t sdCommandIndex[2] = { 0u, 0u };
static uint8_t sdLastCommand[2] = { 0u, 0u };
static uint8_t sdCommandParams[2][4];
static uint8_t sdAcmd[2] = { 0u, 0u };
static uint32_t sdTotalSectors[2] = { 0u, 0u };
static uint8_t sdResponse[2][ZXNEXT_SD_RESPONSE_BUFFER_SIZE];
static uint32_t sdResponseLength[2] = { 0u, 0u };
static uint32_t sdResponseIndex[2] = { 0u, 0u };
static uint8_t sdResponseReady[2] = { 0u, 0u };
static uint8_t sdState[2] = { 0u, 0u };
static uint8_t sdBlockToWrite[ZXNEXT_SD_COMMAND_BUFFER_SIZE];
static uint32_t sdDataIndex[2] = { 0u, 0u };
static uint32_t sdPendingCommand = 0u;
static uint32_t sdPendingSector = 0u;
static uint32_t sdPendingCard = 0u;
static uint32_t sdCommandCount = 0u;
static uint32_t sdReadRequestCount = 0u;
static uint32_t sdWriteRequestCount = 0u;
static uint8_t expansionRomcsSignal = 0u;
static uint8_t expansionExternalBusData = 0xffu;
static uint8_t expansionNmiPending = 0u;
static uint8_t expansionIntPending = 0u;
static uint8_t multifaceNmiActive = 0u;
static uint8_t multifaceMfEnabled = 0u;
static uint8_t multifaceInvisible = 1u;
static uint8_t nmiState = ZXNEXT_NMI_STATE_IDLE;
static uint8_t nmiSourceMf = 0u;
static uint8_t nmiSourceDivMmc = 0u;
static uint8_t nmiSourceExpBus = 0u;
static uint8_t pendingMfNmi = 0u;
static uint8_t pendingDivMmcNmi = 0u;
static uint8_t sigNmi = 0u;
static uint8_t joystick1Mode = 0u;
static uint8_t joystick2Mode = 0u;
static uint8_t joystickIoModeEnabled = 0u;
static uint8_t joystickIoMode = 0u;
static uint8_t joystickIoModeParam = 1u;
static uint8_t joystickLeftState = 0u;
static uint8_t joystickRightState = 0u;
static uint32_t joystickStateWriteCount = 0u;
static uint8_t mouseXPos = 0u;
static uint8_t mouseYPos = 0u;
static uint8_t mouseWheelZ = 0u;
static uint8_t mouseButtonLeft = 0u;
static uint8_t mouseButtonRight = 0u;
static uint8_t mouseButtonMiddle = 0u;
static uint8_t mouseSwapButtons = 0u;
static uint8_t mouseDpi = 1u;
static uint32_t mouseStateWriteCount = 0u;
static uint8_t uartSelected = 0u;
static uint16_t uartPrescalerLsb[2];
static uint8_t uartPrescalerMsb[2];
static uint8_t uartFrameRegister[2];
static uint8_t uartBreakCondition[2];
static uint8_t uartFramingError[2];
static uint8_t uartRxOverflow[2];
static uint16_t uartRxFifo[2][ZXNEXT_UART_RX_FIFO_SIZE];
static uint8_t uartTxFifo[2][ZXNEXT_UART_TX_FIFO_SIZE];
static uint16_t uartRxReadPtr[2];
static uint16_t uartRxWritePtr[2];
static uint16_t uartRxCount[2];
static uint8_t uartTxReadPtr[2];
static uint8_t uartTxWritePtr[2];
static uint8_t uartTxCount[2];
static uint32_t uartTxWriteCount = 0u;
static uint32_t uartRxInjectCount = 0u;
static uint8_t i2cSclOut = 1u;
static uint8_t i2cSdaOut = 1u;
static uint8_t i2cSdaSlave = 1u;
static uint8_t i2cPrevScl = 1u;
static uint8_t i2cPrevSda = 1u;
static uint8_t i2cState = 0u;
static uint8_t i2cShiftReg = 0u;
static uint8_t i2cBitCount = 0u;
static uint8_t i2cIsRead = 0u;
static uint8_t i2cAddressed = 0u;
static uint8_t i2cCmos[64];
static uint8_t i2cRegPointer = 0u;
static uint8_t i2cFirstWrite = 1u;
static uint32_t i2cFrameCounter = 0u;
static uint32_t i2cFramesPerSecond = 50u;
static uint32_t i2cClockAdvanceCount = 0u;

static uint8_t zxnextCpuReadMemory(uint32_t address);
static void zxnextCpuWriteMemory(uint32_t address, uint32_t value);
static void zxnextCpuPokeMemory(uint32_t address, uint32_t value);
static void tactPlusNNext(uint32_t value);
static void importZ80BusEvents(void);
static void clearRuntimeState(void);
static uint32_t executeWholeInstruction(void);
static uint32_t cpuTactsPerFrame(void);
static uint32_t frameTactsInFrame(void);
static void advanceFrameTacts(uint32_t delta);
static void advanceDmaFrameTacts(uint32_t ticks);
static uint32_t finishCompletedFrames(void);
static void runDmaUntilCpuCanRun(void);
static void setCpuProgrammedSpeed(uint32_t value);
static uint32_t cpuTactScale(void);

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() flatMemory
#define Z80_READ_MEMORY(address) zxnextCpuReadMemory((uint32_t)(address))
#define Z80_WRITE_MEMORY(address, value) zxnextCpuWriteMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_POKE_MEMORY(address, value) zxnextCpuPokeMemory((uint32_t)(address), (uint32_t)(value))
#define Z80_READ_PORT(address) ((uint8_t)zxnextReadPort((uint32_t)(address)))
#define Z80_WRITE_PORT(address, value) zxnextWritePort((uint32_t)(address), (uint32_t)(value))
#define Z80_CAPTURE_BUS_EVENTS() captureBusEvents
#define Z80_TACT_PLUS_N(value) tactPlusNNext((uint32_t)(value))
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

#include "zxnext-memory.c"
#include "zxnext-interrupt.c"
#include "zxnext-expansion.c"
#include "zxnext-multiface.c"
#include "zxnext-input.c"
#include "zxnext-uart.c"
#include "zxnext-i2c.c"
#include "zxnext-palette.c"
#include "zxnext-layer2.c"
#include "zxnext-tilemap.c"
#include "zxnext-sprites.c"
#include "zxnext-nextreg.c"
#include "zxnext-divmmc.c"
#include "zxnext-sdcard.c"
#include "zxnext-keyboard.c"
#include "zxnext-ula.c"
#include "zxnext-screen.c"
#include "zxnext-copper.c"
#include "zxnext-ctc.c"
#include "zxnext-psg.c"
#include "zxnext-audio.c"
#include "zxnext-dac.c"
#include "zxnext-dma.c"
#include "zxnext-ports.c"

static void clearRuntimeState(void) {
  resetDivMmcState();
  resetExpansionState();
  resetMultifaceState();
  resetInputState();
  resetUartState();
  resetI2cState();
  resetNmiState();
  resetSdCardState();
  resetKeyboardState();
  resetUlaState();
  resetInterruptState();
  resetPaletteState();
  resetLayer2State();
  resetTilemapState();
  resetSpriteState();
  resetPsgState();
  resetAudioState();
  resetDmaState();
  resetScreenState();
  resetCopperState();
  resetCtcState();
  for (uint32_t i = 0; i < ZXNEXT_SD_COMMAND_BUFFER_SIZE; i++) sdCommandBuffer[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_SD_RESPONSE_BUFFER_SIZE; i++) sdResponseBuffer[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_DIAGNOSTIC_BUFFER_SIZE; i++) diagnosticBuffer[i] = 0;
  frames = 0;
  tacts = 0;
  frameTacts = 0;
  currentFrameTact = 0;
  cpuInstructionsExecuted = 0;
  frameCallCount = 0;
  lastFrameInstructionsExecuted = 0;
  cpuContentionDelaySinceStart = 0;
  cpuPc = 0;
  cpuSp = 0xffffu;
  hasMemoryEvent = 0;
  lastMemoryAddress = 0;
  lastMemoryValue = 0;
  lastMemoryIsWrite = 0;
  hasPortEvent = 0;
  lastPortAddress = 0;
  lastPortValue = 0xffu;
  lastPortIsWrite = 0;
  unsupportedPortReadCount = 0;
  unsupportedPortWriteCount = 0;
  firstUnsupportedPortAddress = 0;
  firstUnsupportedPortValue = 0xffu;
  firstUnsupportedPortIsWrite = 0;
  firstUnsupportedPortOwnerStep = 0;
  hasTbBlueEvent = 0;
  lastTbBlueAddress = 0;
  lastTbBlueValue = 0;
  captureBusEvents = 1;
}

static uint32_t romBaseForKind(uint32_t kind) {
  switch (kind) {
    case 0: return ZXNEXT_NEXT_ROM_OFFSET;
    case 1: return ZXNEXT_DIVMMC_ROM_OFFSET;
    case 2: return ZXNEXT_MULTIFACE_ROM_OFFSET;
    case 3: return ZXNEXT_ALT_ROM_OFFSET;
    default: return ZXNEXT_ROM_SIZE;
  }
}

static uint32_t romLimitForKind(uint32_t kind) {
  switch (kind) {
    case 0: return ZXNEXT_NEXT_ROM_SIZE;
    case 1: return ZXNEXT_SMALL_ROM_SIZE;
    case 2: return ZXNEXT_SMALL_ROM_SIZE;
    case 3: return ZXNEXT_ALT_ROM_SIZE;
    default: return 0;
  }
}

uint32_t zxnextMemoryPtr(void) { return (uint32_t)(uintptr_t)flatMemory; }
uint32_t zxnextSramPtr(void) { return (uint32_t)(uintptr_t)sram; }
uint32_t zxnextRomPtr(void) { return (uint32_t)(uintptr_t)rom; }
uint32_t zxnextKeyboardRowsPtr(void) { return (uint32_t)(uintptr_t)keyboardRows; }
uint32_t zxnextNextRegsPtr(void) { return (uint32_t)(uintptr_t)nextRegs; }
uint32_t zxnextPixelBufferPtr(void) { return (uint32_t)(uintptr_t)pixelBuffer; }
uint32_t zxnextAudioSamplesPtr(void) { return (uint32_t)(uintptr_t)audioSamples; }
uint32_t zxnextSdCommandBufferPtr(void) { return (uint32_t)(uintptr_t)sdCommandBuffer; }
uint32_t zxnextSdResponseBufferPtr(void) { return (uint32_t)(uintptr_t)sdResponseBuffer; }
uint32_t zxnextDiagnosticBufferPtr(void) { return (uint32_t)(uintptr_t)diagnosticBuffer; }

void zxnextHardReset(void) {
  hardResetCount++;
  resetCount++;
  clearRuntimeState();
  clearMutablePhysicalMemory();
  resetMmuLayout();
  resetNextRegs(1);
  updateScreenTimingFromNextRegs();
  z80Reset();
  z80SetZ80NMode(1);
  z80SetSp(cpuSp);
}

void zxnextReset(void) {
  resetCount++;
  clearRuntimeState();
  resetMmuLayout();
  resetNextRegs(0);
  updateScreenTimingFromNextRegs();
  z80Reset();
  z80SetZ80NMode(1);
  z80SetSp(cpuSp);
}

uint32_t zxnextExecuteInstruction(void) {
  hasMemoryEvent = 0;
  z80ClearBusEvents();
  executeWholeInstruction();
  if (finishCompletedFrames() != 0u) {
    zxnextRenderInstantScreen();
  }
  return 0;
}

uint32_t zxnextExecuteFrame(void) {
  frameCallCount++;
  lastFrameInstructionsExecuted = 0;
  hasMemoryEvent = 0u;
  hasPortEvent = 0u;
  hasTbBlueEvent = 0u;
  z80ClearBusEvents();
  const uint32_t target = frameTactsInFrame();
  do {
    executeWholeInstruction();
    lastFrameInstructionsExecuted++;
  } while (frameTacts < target);

  finishCompletedFrames();
  zxnextRenderInstantScreen();
  return 0u;
}

uint32_t zxnextUploadRomByte(uint32_t kind, uint32_t offset, uint32_t value) {
  const uint32_t limit = romLimitForKind(kind);
  if (offset >= limit) return 0;
  const uint32_t base = romBaseForKind(kind);
  if (base >= ZXNEXT_ROM_SIZE || base + offset >= ZXNEXT_ROM_SIZE) return 0;
  rom[base + offset] = (uint8_t)(value & 0xffu);
  updateFlatMemoryForPhysicalOffset(base + offset);
  romUploadCount++;
  uploadedRomMask |= 1u << kind;
  return 1;
}

uint32_t zxnextReadRomByte(uint32_t kind, uint32_t offset) {
  const uint32_t limit = romLimitForKind(kind);
  if (offset >= limit) return 0xffu;
  const uint32_t base = romBaseForKind(kind);
  if (base >= ZXNEXT_ROM_SIZE || base + offset >= ZXNEXT_ROM_SIZE) return 0xffu;
  return rom[base + offset];
}

uint32_t zxnextGetFlatMemorySize(void) { return ZXNEXT_FLAT_MEMORY_SIZE; }
uint32_t zxnextGetSramSize(void) { return ZXNEXT_SRAM_CAPACITY; }
uint32_t zxnextGetSramCapacity(void) { return ZXNEXT_SRAM_CAPACITY; }
uint32_t zxnextGetRomSize(void) { return ZXNEXT_ROM_SIZE; }
uint32_t zxnextGetKeyboardRowCount(void) { return ZXNEXT_KEYBOARD_ROW_COUNT; }
uint32_t zxnextGetNextRegCount(void) { return ZXNEXT_NEXTREG_COUNT; }
uint32_t zxnextGetScreenWidth(void) { return ZXNEXT_SCREEN_WIDTH; }
uint32_t zxnextGetScreenHeight(void) { return ZXNEXT_SCREEN_HEIGHT; }
uint32_t zxnextGetAudioSampleCapacity(void) { return ZXNEXT_AUDIO_SAMPLE_CAPACITY; }
uint32_t zxnextGetSdCommandBufferSize(void) { return ZXNEXT_SD_COMMAND_BUFFER_SIZE; }
uint32_t zxnextGetSdResponseBufferSize(void) { return ZXNEXT_SD_RESPONSE_BUFFER_SIZE; }
uint32_t zxnextGetDiagnosticBufferSize(void) { return ZXNEXT_DIAGNOSTIC_BUFFER_SIZE; }
uint32_t zxnextGetFrames(void) { return frames; }
uint32_t zxnextGetTacts(void) { return tacts; }
uint32_t zxnextGetFrameTacts(void) { return frameTacts; }
uint32_t zxnextGetCurrentFrameTact(void) { return currentFrameTact; }
uint32_t zxnextGetCpuTactsPerFrame(void) { return cpuTactsPerFrame(); }
uint32_t zxnextGetFrameCallCount(void) { return frameCallCount; }
uint32_t zxnextGetLastFrameInstructionsExecuted(void) { return lastFrameInstructionsExecuted; }
uint32_t zxnextGetCpuProgrammedSpeed(void) { return cpuProgrammedSpeed; }
uint32_t zxnextGetCpuEffectiveSpeed(void) { return cpuEffectiveSpeed; }
uint32_t zxnextGetCpuEffectiveClockMultiplier(void) { return 1u << cpuEffectiveSpeed; }
uint32_t zxnextGetCpuTactScale(void) { return cpuTactScale(); }
uint32_t zxnextGetCpuContentionDelaySinceStart(void) { return cpuContentionDelaySinceStart; }
void zxnextSetTacts(uint32_t value) {
  tacts = value;
  z80SetTacts(value);
}
uint32_t zxnextGetHardResetCount(void) { return hardResetCount; }
uint32_t zxnextGetResetCount(void) { return resetCount; }
uint32_t zxnextGetRomUploadCount(void) { return romUploadCount; }
uint32_t zxnextGetUploadedRomMask(void) { return uploadedRomMask; }
uint32_t zxnextGetCpuInstructionsExecuted(void) { return cpuInstructionsExecuted; }
uint32_t zxnextGetCpuAf(void) { return z80GetAf(); }
void zxnextSetCpuAf(uint32_t value) { z80SetAf(value); }
uint32_t zxnextGetCpuAfAlt(void) { return z80GetAfAlt(); }
void zxnextSetCpuAfAlt(uint32_t value) { z80SetAfAlt(value); }
uint32_t zxnextGetCpuBc(void) { return z80GetBc(); }
void zxnextSetCpuBc(uint32_t value) { z80SetBc(value); }
uint32_t zxnextGetCpuBcAlt(void) { return z80GetBcAlt(); }
void zxnextSetCpuBcAlt(uint32_t value) { z80SetBcAlt(value); }
uint32_t zxnextGetCpuDe(void) { return z80GetDe(); }
void zxnextSetCpuDe(uint32_t value) { z80SetDe(value); }
uint32_t zxnextGetCpuDeAlt(void) { return z80GetDeAlt(); }
void zxnextSetCpuDeAlt(uint32_t value) { z80SetDeAlt(value); }
uint32_t zxnextGetCpuHl(void) { return z80GetHl(); }
void zxnextSetCpuHl(uint32_t value) { z80SetHl(value); }
uint32_t zxnextGetCpuHlAlt(void) { return z80GetHlAlt(); }
void zxnextSetCpuHlAlt(uint32_t value) { z80SetHlAlt(value); }
uint32_t zxnextGetCpuIx(void) { return z80GetIx(); }
void zxnextSetCpuIx(uint32_t value) { z80SetIx(value); }
uint32_t zxnextGetCpuIy(void) { return z80GetIy(); }
void zxnextSetCpuIy(uint32_t value) { z80SetIy(value); }
uint32_t zxnextGetCpuIr(void) { return z80GetIr(); }
void zxnextSetCpuIr(uint32_t value) { z80SetIr(value); }
uint32_t zxnextGetCpuWz(void) { return z80GetWz(); }
void zxnextSetCpuWz(uint32_t value) { z80SetWz(value); }
uint32_t zxnextGetCpuPc(void) { return z80GetPc(); }
void zxnextSetCpuPc(uint32_t value) {
  cpuPc = (uint16_t)(value & 0xffffu);
  z80SetPc(value);
}
uint32_t zxnextGetCpuSp(void) { return z80GetSp(); }
void zxnextSetCpuSp(uint32_t value) {
  cpuSp = (uint16_t)(value & 0xffffu);
  z80SetSp(value);
}
uint32_t zxnextGetCpuHalted(void) { return z80GetHalted(); }
uint32_t zxnextGetCpuPrefix(void) { return z80GetPrefix(); }
uint32_t zxnextGetCpuIff1(void) { return z80GetIff1(); }
void zxnextSetCpuIff1(uint32_t value) { z80SetIff1(value); }
uint32_t zxnextGetCpuIff2(void) { return z80GetIff2(); }
void zxnextSetCpuIff2(uint32_t value) { z80SetIff2(value); }
uint32_t zxnextGetCpuInterruptMode(void) { return z80GetInterruptMode(); }
void zxnextSetCpuInterruptMode(uint32_t value) { z80SetInterruptMode(value); }
uint32_t zxnextGetCpuTacts(void) { return z80GetTacts(); }
uint32_t zxnextGetCpuRetExecuted(void) { return z80GetRetExecuted(); }
uint32_t zxnextGetCpuRetnExecuted(void) { return z80GetRetnExecuted(); }
uint32_t zxnextGetZ80NMode(void) { return z80GetZ80NMode(); }
uint32_t zxnextGetLastMemoryAddress(void) { return hasMemoryEvent != 0u ? lastMemoryAddress : 0u; }
uint32_t zxnextGetLastMemoryValue(void) { return hasMemoryEvent != 0u ? lastMemoryValue : 0u; }
uint32_t zxnextGetLastMemoryIsWrite(void) { return hasMemoryEvent != 0u ? lastMemoryIsWrite : 0u; }
uint32_t zxnextGetLastPortAddress(void) { return hasPortEvent != 0u ? lastPortAddress : 0u; }
uint32_t zxnextGetLastPortValue(void) { return hasPortEvent != 0u ? lastPortValue : 0u; }
uint32_t zxnextGetLastPortIsWrite(void) { return hasPortEvent != 0u ? lastPortIsWrite : 0u; }
uint32_t zxnextGetUnsupportedPortReadCount(void) { return unsupportedPortReadCount; }
uint32_t zxnextGetUnsupportedPortWriteCount(void) { return unsupportedPortWriteCount; }
uint32_t zxnextGetFirstUnsupportedPortAddress(void) { return firstUnsupportedPortAddress; }
uint32_t zxnextGetFirstUnsupportedPortValue(void) { return firstUnsupportedPortValue; }
uint32_t zxnextGetFirstUnsupportedPortIsWrite(void) { return firstUnsupportedPortIsWrite; }
uint32_t zxnextGetFirstUnsupportedPortOwnerStep(void) { return firstUnsupportedPortOwnerStep; }
uint32_t zxnextGetLastTbBlueAddress(void) { return hasTbBlueEvent != 0u ? lastTbBlueAddress : 0u; }
uint32_t zxnextGetLastTbBlueValue(void) { return hasTbBlueEvent != 0u ? lastTbBlueValue : 0u; }
uint32_t zxnextGetLastTbBlueIsWrite(void) { return hasTbBlueEvent; }
void zxnextClearBusEvents(void) {
  hasMemoryEvent = 0u;
  hasPortEvent = 0u;
  hasTbBlueEvent = 0u;
  z80ClearBusEvents();
}
uint32_t zxnextGetDiagnosticFlags(void) {
  return (unsupportedPortReadCount != 0u || unsupportedPortWriteCount != 0u) ? 0x01u : 0u;
}

static uint8_t zxnextCpuReadMemory(uint32_t address) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  const uint8_t value = (uint8_t)zxnextReadMemory(maskedAddress);
  const uint32_t page = maskedAddress >> 13u;
  if (cpuEffectiveSpeed == 3u && pageBank8k[page] != 0x0eu) {
    tactPlusNNext(1u);
    cpuContentionDelaySinceStart++;
  }
  if (captureBusEvents != 0u) {
    lastMemoryAddress = maskedAddress;
    lastMemoryValue = value;
    lastMemoryIsWrite = 0u;
    hasMemoryEvent = 1u;
  }
  return value;
}

static void zxnextCpuWriteMemory(uint32_t address, uint32_t value) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  zxnextWriteMemory(maskedAddress, byteValue);
  if (captureBusEvents != 0u) {
    lastMemoryAddress = maskedAddress;
    lastMemoryValue = byteValue;
    lastMemoryIsWrite = 1u;
    hasMemoryEvent = 1u;
  }
}

static void zxnextCpuPokeMemory(uint32_t address, uint32_t value) {
  const uint32_t maskedAddress = address & 0xffffu;
  const uint32_t page = maskedAddress >> 13u;
  const uint32_t offset = maskedAddress & 0x1fffu;
  const uint32_t readOffset = pageReadOffset[page];
  zxnextWritePhysical(readOffset + offset, value);
  flatMemory[maskedAddress] = (uint8_t)(value & 0xffu);
}

static void tactPlusNNext(uint32_t value) {
  cpu.tacts += value;
  tacts += value;
  advanceFrameTacts(value);
}

static uint32_t executeWholeInstruction(void) {
  runDmaUntilCpuCanRun();
  const uint32_t startTacts = tacts;
  const uint32_t startPc = z80GetPc();
  zxnextDivMmcBeforeOpcodeFetch(startPc);
  zxnextNmiBeforeOpcodeFetch(startPc);
  z80SetSigNmi(sigNmi);
  z80SetTacts(tacts);
  do {
    z80ExecuteCpuCycle();
  } while (z80GetPrefix() != 0u);
  tacts = z80GetTacts();
  cpuPc = (uint16_t)z80GetPc();
  cpuSp = (uint16_t)z80GetSp();
  cpuInstructionsExecuted++;
  importZ80BusEvents();
  const uint32_t retnExecuted = z80GetRetnExecuted();
  if (retnExecuted != 0u) multifaceHandleRetn();
  zxnextDivMmcAfterOpcodeFetch(retnExecuted);
  return tacts - startTacts;
}

static uint32_t cpuTactsPerFrame(void) {
  return frameTactsInFrame() / cpuTactScale();
}

static uint32_t frameTactsInFrame(void) {
  updateScreenTimingFromNextRegs();
  return screenRenderingTacts * 4u;
}

static void setCpuProgrammedSpeed(uint32_t value) {
  cpuProgrammedSpeed = (uint8_t)(value & 0x03u);
  cpuEffectiveSpeed = expansionBusEnabled() != 0u ? 0u : cpuProgrammedSpeed;
}

static uint32_t cpuTactScale(void) {
  return 8u >> cpuEffectiveSpeed;
}

static void advanceFrameTacts(uint32_t delta) {
  frameTacts += delta * cpuTactScale();
  currentFrameTact = frameTacts >> 2u;
}

static void advanceDmaFrameTacts(uint32_t ticks) {
  const uint32_t scale = cpuTactScale();
  tacts += (ticks + scale - 1u) / scale;
  frameTacts += ticks;
  currentFrameTact = frameTacts >> 2u;
}

static uint32_t finishCompletedFrames(void) {
  const uint32_t target = frameTactsInFrame();
  uint32_t completed = 0u;
  while (frameTacts >= target) {
    zxnextCtcOnNewFrame(target);
    zxnextUartOnNewFrame();
    zxnextI2cOnNewFrame();
    frameTacts -= target;
    frames++;
    completed = 1u;
  }
  currentFrameTact = frameTacts >> 2u;
  return completed;
}

static void runDmaUntilCpuCanRun(void) {
  const uint32_t maxDmaSteps = 0x20000u;
  for (uint32_t step = 0; step < maxDmaSteps; step++) {
    if (dmaBusState == DMA_BUS_REQUESTED) {
      zxnextAcknowledgeDmaBus();
    }

    const uint32_t dmaTicks = zxnextStepDma();
    if (dmaTicks != 0u) {
      advanceDmaFrameTacts(dmaTicks);
    }

    if (dmaBusState == DMA_BUS_IDLE) {
      break;
    }
  }
}

static void importZ80BusEvents(void) {
  if (z80GetLastPortIsWrite() != 0u || z80GetLastPortAddress() != 0u || z80GetLastPortValue() != 0u) {
    lastPortAddress = (uint16_t)z80GetLastPortAddress();
    lastPortValue = (uint8_t)z80GetLastPortValue();
    lastPortIsWrite = (uint8_t)z80GetLastPortIsWrite();
    hasPortEvent = 1u;
  }
  if (z80GetLastTbBlueIsWrite() != 0u) {
    lastTbBlueAddress = (uint8_t)z80GetLastTbBlueAddress();
    lastTbBlueValue = (uint8_t)z80GetLastTbBlueValue();
    hasTbBlueEvent = 1u;
    writeNextRegInternal(lastTbBlueAddress, lastTbBlueValue);
  }
}
