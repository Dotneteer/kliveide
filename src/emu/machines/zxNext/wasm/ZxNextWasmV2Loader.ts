export const ZXNEXT_WASM_V2_ARTIFACT_NAME = "zx-spectrum-next.wasm";
export const ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE = 0x10000;
export const ZXNEXT_WASM_V2_SRAM_CAPACITY = 4 * 1024 * 1024;
export const ZXNEXT_WASM_V2_ROM_SIZE = 0x20000;
export const ZXNEXT_WASM_V2_KEYBOARD_ROW_COUNT = 8;
export const ZXNEXT_WASM_V2_NEXTREG_COUNT = 256;

export type ZxNextWasmV2ExportFunction = (...args: number[]) => number;

export type ZxNextWasmV2Exports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  zxnextMemoryPtr: ZxNextWasmV2ExportFunction;
  zxnextSramPtr: ZxNextWasmV2ExportFunction;
  zxnextRomPtr: ZxNextWasmV2ExportFunction;
  zxnextKeyboardRowsPtr: ZxNextWasmV2ExportFunction;
  zxnextNextRegsPtr: ZxNextWasmV2ExportFunction;
  zxnextPixelBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextAudioSamplesPtr: ZxNextWasmV2ExportFunction;
  zxnextSdCommandBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextSdResponseBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextDiagnosticBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextHardReset: ZxNextWasmV2ExportFunction;
  zxnextReset: ZxNextWasmV2ExportFunction;
  zxnextExecuteInstruction: ZxNextWasmV2ExportFunction;
  zxnextExecuteFrame: ZxNextWasmV2ExportFunction;
  zxnextUploadRomByte: ZxNextWasmV2ExportFunction;
  zxnextReadRomByte: ZxNextWasmV2ExportFunction;
  zxnextReadMemory: ZxNextWasmV2ExportFunction;
  zxnextWriteMemory: ZxNextWasmV2ExportFunction;
  zxnextReadScreenMemoryOffset: ZxNextWasmV2ExportFunction;
  zxnextReadPort: ZxNextWasmV2ExportFunction;
  zxnextWritePort: ZxNextWasmV2ExportFunction;
  zxnextSetPortReadValue: ZxNextWasmV2ExportFunction;
  zxnextSetKeyboardRow: ZxNextWasmV2ExportFunction;
  zxnextGetKeyboardRow: ZxNextWasmV2ExportFunction;
  zxnextGetKeyboardRowWrites: ZxNextWasmV2ExportFunction;
  zxnextSetJoystickState: ZxNextWasmV2ExportFunction;
  zxnextSetMouseState: ZxNextWasmV2ExportFunction;
  zxnextAddMouseDelta: ZxNextWasmV2ExportFunction;
  zxnextAddMouseWheelDelta: ZxNextWasmV2ExportFunction;
  zxnextSetMouseButtons: ZxNextWasmV2ExportFunction;
  zxnextGetJoystick1Mode: ZxNextWasmV2ExportFunction;
  zxnextGetJoystick2Mode: ZxNextWasmV2ExportFunction;
  zxnextGetJoystickIoModeEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetJoystickIoMode: ZxNextWasmV2ExportFunction;
  zxnextGetJoystickIoModeParam: ZxNextWasmV2ExportFunction;
  zxnextGetJoystickLeftState: ZxNextWasmV2ExportFunction;
  zxnextGetJoystickRightState: ZxNextWasmV2ExportFunction;
  zxnextGetJoystickStateWriteCount: ZxNextWasmV2ExportFunction;
  zxnextGetMouseX: ZxNextWasmV2ExportFunction;
  zxnextGetMouseY: ZxNextWasmV2ExportFunction;
  zxnextGetMouseWheel: ZxNextWasmV2ExportFunction;
  zxnextGetMouseButtonLeft: ZxNextWasmV2ExportFunction;
  zxnextGetMouseButtonRight: ZxNextWasmV2ExportFunction;
  zxnextGetMouseButtonMiddle: ZxNextWasmV2ExportFunction;
  zxnextGetMouseSwapButtons: ZxNextWasmV2ExportFunction;
  zxnextGetMouseDpi: ZxNextWasmV2ExportFunction;
  zxnextGetMouseStateWriteCount: ZxNextWasmV2ExportFunction;
  zxnextPushUartRxByte: ZxNextWasmV2ExportFunction;
  zxnextPopUartTxByte: ZxNextWasmV2ExportFunction;
  zxnextUartOnNewFrame: ZxNextWasmV2ExportFunction;
  zxnextSetUartBreakCondition: ZxNextWasmV2ExportFunction;
  zxnextSetUartFramingError: ZxNextWasmV2ExportFunction;
  zxnextGetUartSelected: ZxNextWasmV2ExportFunction;
  zxnextGetUartPrescaler: ZxNextWasmV2ExportFunction;
  zxnextGetUartPrescalerLsb: ZxNextWasmV2ExportFunction;
  zxnextGetUartPrescalerMsb: ZxNextWasmV2ExportFunction;
  zxnextGetUartFrameRegister: ZxNextWasmV2ExportFunction;
  zxnextGetUartRxCount: ZxNextWasmV2ExportFunction;
  zxnextGetUartTxCount: ZxNextWasmV2ExportFunction;
  zxnextGetUartBreakCondition: ZxNextWasmV2ExportFunction;
  zxnextGetUartFramingError: ZxNextWasmV2ExportFunction;
  zxnextGetUartRxOverflow: ZxNextWasmV2ExportFunction;
  zxnextGetUartTxWriteCount: ZxNextWasmV2ExportFunction;
  zxnextGetUartRxInjectCount: ZxNextWasmV2ExportFunction;
  zxnextSetI2cCmosByte: ZxNextWasmV2ExportFunction;
  zxnextGetI2cCmosByte: ZxNextWasmV2ExportFunction;
  zxnextSetI2cFrameRate: ZxNextWasmV2ExportFunction;
  zxnextAdvanceI2cClock: ZxNextWasmV2ExportFunction;
  zxnextI2cOnNewFrame: ZxNextWasmV2ExportFunction;
  zxnextGetI2cSclOut: ZxNextWasmV2ExportFunction;
  zxnextGetI2cSdaOut: ZxNextWasmV2ExportFunction;
  zxnextGetI2cSdaLine: ZxNextWasmV2ExportFunction;
  zxnextGetI2cState: ZxNextWasmV2ExportFunction;
  zxnextGetI2cRegPointer: ZxNextWasmV2ExportFunction;
  zxnextGetI2cFrameCounter: ZxNextWasmV2ExportFunction;
  zxnextGetI2cFramesPerSecond: ZxNextWasmV2ExportFunction;
  zxnextGetI2cClockAdvanceCount: ZxNextWasmV2ExportFunction;
  zxnextSetExtendedKeyReg: ZxNextWasmV2ExportFunction;
  zxnextGetExtendedKeyReg: ZxNextWasmV2ExportFunction;
  zxnextReadUlaPort: ZxNextWasmV2ExportFunction;
  zxnextWriteUlaPort: ZxNextWasmV2ExportFunction;
  zxnextGetUlaBorderColor: ZxNextWasmV2ExportFunction;
  zxnextGetUlaEarBit: ZxNextWasmV2ExportFunction;
  zxnextGetUlaMicBit: ZxNextWasmV2ExportFunction;
  zxnextGetUlaBeeperEar: ZxNextWasmV2ExportFunction;
  zxnextGetUlaBeeperMic: ZxNextWasmV2ExportFunction;
  zxnextGetUlaBit4ChangedFrom0Tacts: ZxNextWasmV2ExportFunction;
  zxnextGetUlaBit4ChangedFrom1Tacts: ZxNextWasmV2ExportFunction;
  zxnextGenerateAudioSamples: ZxNextWasmV2ExportFunction;
  zxnextGenerateAudioFrameSamples: ZxNextWasmV2ExportFunction;
  zxnextGetAudioSampleCount: ZxNextWasmV2ExportFunction;
  zxnextGetDacChannel: ZxNextWasmV2ExportFunction;
  zxnextGetDacLeftLevel: ZxNextWasmV2ExportFunction;
  zxnextGetDacRightLevel: ZxNextWasmV2ExportFunction;
  zxnextGetAudioBeepOnlyToInternalSpeaker: ZxNextWasmV2ExportFunction;
  zxnextGetAudioPsgMode: ZxNextWasmV2ExportFunction;
  zxnextGetAudioAyStereoMode: ZxNextWasmV2ExportFunction;
  zxnextGetAudioEnableInternalSpeaker: ZxNextWasmV2ExportFunction;
  zxnextGetAudioEnable8BitDacs: ZxNextWasmV2ExportFunction;
  zxnextGetAudioSilenceHdmiAudio: ZxNextWasmV2ExportFunction;
  zxnextGetAudioEnableTurbosound: ZxNextWasmV2ExportFunction;
  zxnextGetAudioAyMonoEnable: ZxNextWasmV2ExportFunction;
  zxnextGetPsgSelectedChip: ZxNextWasmV2ExportFunction;
  zxnextGetPsgSelectedRegister: ZxNextWasmV2ExportFunction;
  zxnextGetPsgRegister: ZxNextWasmV2ExportFunction;
  zxnextGetPsgPanning: ZxNextWasmV2ExportFunction;
  zxnextGetPsgMixerLeft: ZxNextWasmV2ExportFunction;
  zxnextGetPsgMixerRight: ZxNextWasmV2ExportFunction;
  zxnextReadDmaPort: ZxNextWasmV2ExportFunction;
  zxnextWriteDmaPort: ZxNextWasmV2ExportFunction;
  zxnextStepDma: ZxNextWasmV2ExportFunction;
  zxnextRunDma: ZxNextWasmV2ExportFunction;
  zxnextAcknowledgeDmaBus: ZxNextWasmV2ExportFunction;
  zxnextGetDmaMode: ZxNextWasmV2ExportFunction;
  zxnextGetDmaSeq: ZxNextWasmV2ExportFunction;
  zxnextGetDmaState: ZxNextWasmV2ExportFunction;
  zxnextGetDmaBusState: ZxNextWasmV2ExportFunction;
  zxnextGetDmaBusRequested: ZxNextWasmV2ExportFunction;
  zxnextGetDmaBusAcknowledged: ZxNextWasmV2ExportFunction;
  zxnextGetDmaEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetDmaRawReg: ZxNextWasmV2ExportFunction;
  zxnextGetDmaNumFollow: ZxNextWasmV2ExportFunction;
  zxnextGetDmaReadSeq: ZxNextWasmV2ExportFunction;
  zxnextGetDmaStatus: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortAStart: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortBStart: ZxNextWasmV2ExportFunction;
  zxnextGetDmaBlockLength: ZxNextWasmV2ExportFunction;
  zxnextGetDmaAddressA: ZxNextWasmV2ExportFunction;
  zxnextGetDmaAddressB: ZxNextWasmV2ExportFunction;
  zxnextGetDmaByteCounter: ZxNextWasmV2ExportFunction;
  zxnextGetDmaTransferCount: ZxNextWasmV2ExportFunction;
  zxnextGetDmaBlockCompletionCount: ZxNextWasmV2ExportFunction;
  zxnextGetDmaLastStepTicks: ZxNextWasmV2ExportFunction;
  zxnextGetDmaTransferDataByte: ZxNextWasmV2ExportFunction;
  zxnextGetDmaDirectionAtoB: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortAIsIo: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortBIsIo: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortAAddressMode: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortBAddressMode: ZxNextWasmV2ExportFunction;
  zxnextGetDmaTransferMode: ZxNextWasmV2ExportFunction;
  zxnextGetDmaAutoRestart: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortBPrescaler: ZxNextWasmV2ExportFunction;
  zxnextGetDmaForceReady: ZxNextWasmV2ExportFunction;
  zxnextGetDmaInterruptPending: ZxNextWasmV2ExportFunction;
  zxnextGetDmaVector: ZxNextWasmV2ExportFunction;
  zxnextCopperExecuteTick: ZxNextWasmV2ExportFunction;
  zxnextReadCopperMemory: ZxNextWasmV2ExportFunction;
  zxnextGetCopperStartMode: ZxNextWasmV2ExportFunction;
  zxnextGetCopperInstructionAddress: ZxNextWasmV2ExportFunction;
  zxnextGetCopperStoredByte: ZxNextWasmV2ExportFunction;
  zxnextGetCopperListAddr: ZxNextWasmV2ExportFunction;
  zxnextGetCopperListData: ZxNextWasmV2ExportFunction;
  zxnextGetCopperDout: ZxNextWasmV2ExportFunction;
  zxnextGetCopperVerticalLineOffset: ZxNextWasmV2ExportFunction;
  zxnextGetCopperTickCount: ZxNextWasmV2ExportFunction;
  zxnextGetCopperWriteCount: ZxNextWasmV2ExportFunction;
  zxnextReadCtcPort: ZxNextWasmV2ExportFunction;
  zxnextWriteCtcPort: ZxNextWasmV2ExportFunction;
  zxnextCtcClockTick: ZxNextWasmV2ExportFunction;
  zxnextCtcAdvanceToSysClock: ZxNextWasmV2ExportFunction;
  zxnextCtcOnNewFrame: ZxNextWasmV2ExportFunction;
  zxnextGetCtcChannelState: ZxNextWasmV2ExportFunction;
  zxnextGetCtcControlReg: ZxNextWasmV2ExportFunction;
  zxnextGetCtcTimeConstant: ZxNextWasmV2ExportFunction;
  zxnextGetCtcPrescalerCount: ZxNextWasmV2ExportFunction;
  zxnextGetCtcCount: ZxNextWasmV2ExportFunction;
  zxnextGetCtcCountZeroD: ZxNextWasmV2ExportFunction;
  zxnextGetCtcIowrD: ZxNextWasmV2ExportFunction;
  zxnextGetCtcClkTrgD: ZxNextWasmV2ExportFunction;
  zxnextGetCtcZcTo: ZxNextWasmV2ExportFunction;
  zxnextGetCtcExpectingTimeConstant: ZxNextWasmV2ExportFunction;
  zxnextGetCtcIm2VectorWrite: ZxNextWasmV2ExportFunction;
  zxnextGetCtcLastSyncClock: ZxNextWasmV2ExportFunction;
  zxnextRenderInstantScreen: ZxNextWasmV2ExportFunction;
  zxnextGetPixelBufferStartOffset: ZxNextWasmV2ExportFunction;
  zxnextGetScreenRenderingTacts: ZxNextWasmV2ExportFunction;
  zxnextGetScreenIntStartTact: ZxNextWasmV2ExportFunction;
  zxnextGetScreenIntEndTact: ZxNextWasmV2ExportFunction;
  zxnextGetScreenIs60Hz: ZxNextWasmV2ExportFunction;
  zxnextGetScreenRenderCount: ZxNextWasmV2ExportFunction;
  zxnextGetScreenNonBlankPixelCount: ZxNextWasmV2ExportFunction;
  zxnextGetScreenBank: ZxNextWasmV2ExportFunction;
  zxnextGetUlaRenderingFlags: ZxNextWasmV2ExportFunction;
  zxnextGetRenderingHc: ZxNextWasmV2ExportFunction;
  zxnextGetRenderingVc: ZxNextWasmV2ExportFunction;
  zxnextGetRenderingPixelIndex: ZxNextWasmV2ExportFunction;
  zxnextReadNextReg: ZxNextWasmV2ExportFunction;
  zxnextWriteNextReg: ZxNextWasmV2ExportFunction;
  zxnextGetFlatMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetSramSize: ZxNextWasmV2ExportFunction;
  zxnextGetSramCapacity: ZxNextWasmV2ExportFunction;
  zxnextGetRomSize: ZxNextWasmV2ExportFunction;
  zxnextGetNextRomOffset: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcRomOffset: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceMemOffset: ZxNextWasmV2ExportFunction;
  zxnextGetAltRomOffset: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcRamOffset: ZxNextWasmV2ExportFunction;
  zxnextGetNextRamOffset: ZxNextWasmV2ExportFunction;
  zxnextGetConfiguredMemorySizeKb: ZxNextWasmV2ExportFunction;
  zxnextGetMainRamPageCount: ZxNextWasmV2ExportFunction;
  zxnextGetMaxMainRamPageCount: ZxNextWasmV2ExportFunction;
  zxnextGetActiveMainRamSize: ZxNextWasmV2ExportFunction;
  zxnextGetActiveMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetSentinelOffset: ZxNextWasmV2ExportFunction;
  zxnextGetSentinelSize: ZxNextWasmV2ExportFunction;
  zxnextConfigureMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetMmuReg: ZxNextWasmV2ExportFunction;
  zxnextSetMmuReg: ZxNextWasmV2ExportFunction;
  zxnextGetPageReadOffset: ZxNextWasmV2ExportFunction;
  zxnextGetPageWriteOffset: ZxNextWasmV2ExportFunction;
  zxnextGetPageBank16k: ZxNextWasmV2ExportFunction;
  zxnextGetPageBank8k: ZxNextWasmV2ExportFunction;
  zxnextGetCurrentPartition: ZxNextWasmV2ExportFunction;
  zxnextGetPort7ffdValue: ZxNextWasmV2ExportFunction;
  zxnextGetPortDffdValue: ZxNextWasmV2ExportFunction;
  zxnextGetPort1ffdValue: ZxNextWasmV2ExportFunction;
  zxnextGetPortEff7Value: ZxNextWasmV2ExportFunction;
  zxnextGetSelectedRomPage: ZxNextWasmV2ExportFunction;
  zxnextGetSelectedRamBank: ZxNextWasmV2ExportFunction;
  zxnextGetSelectedBankLsb: ZxNextWasmV2ExportFunction;
  zxnextGetSelectedBankMsb: ZxNextWasmV2ExportFunction;
  zxnextGetPagingEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetAllRamMode: ZxNextWasmV2ExportFunction;
  zxnextGetSpecialConfig: ZxNextWasmV2ExportFunction;
  zxnextGetUseShadowScreen: ZxNextWasmV2ExportFunction;
  zxnextReadDivMmcPortE3: ZxNextWasmV2ExportFunction;
  zxnextWriteDivMmcPortE3: ZxNextWasmV2ExportFunction;
  zxnextReadSpiDataPort: ZxNextWasmV2ExportFunction;
  zxnextWriteSpiDataPort: ZxNextWasmV2ExportFunction;
  zxnextWriteSpiCsPort: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcConmem: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcMapram: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcBank: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcPortE3Value: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcEnableAutomap: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcAutoMapActive: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcRstTrapEnabledMask: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcRstTrapOnlyWithRom3Mask: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcRstTrapInstantMask: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcEntry1: ZxNextWasmV2ExportFunction;
  zxnextShouldPropagateIo: ZxNextWasmV2ExportFunction;
  zxnextSetExpansionRomcsSignal: ZxNextWasmV2ExportFunction;
  zxnextSetExpansionExternalBusData: ZxNextWasmV2ExportFunction;
  zxnextSetExpansionNmiPending: ZxNextWasmV2ExportFunction;
  zxnextSetExpansionIntPending: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionRomcsReplacement: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionDisableIoCycles: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionDisableMemCycles: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionSoftResetPersistence: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionRomcsSignal: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionRomcsClaimed: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionExternalBusData: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionNmiPending: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionNmiAsserted: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionIntPending: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionIntActive: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionUlaOverrideEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionNmiDebounceDisabled: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionClockAlwaysOn: ZxNextWasmV2ExportFunction;
  zxnextGetExpansionIoPropagate: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceType: ZxNextWasmV2ExportFunction;
  zxnextSetMultifaceType: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceNmiActive: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceMfEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceInvisible: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceIsActive: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceNmiHold: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceEnablePortAddress: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceDisablePortAddress: ZxNextWasmV2ExportFunction;
  zxnextGetMultifaceMfPortEn: ZxNextWasmV2ExportFunction;
  zxnextPressMultifaceNmiButton: ZxNextWasmV2ExportFunction;
  zxnextMultifaceOnFetch0066: ZxNextWasmV2ExportFunction;
  zxnextMultifaceHandleRetn: ZxNextWasmV2ExportFunction;
  zxnextRequestMfNmi: ZxNextWasmV2ExportFunction;
  zxnextRequestDivMmcNmi: ZxNextWasmV2ExportFunction;
  zxnextNmiBeforeOpcodeFetch: ZxNextWasmV2ExportFunction;
  zxnextGetNmiState: ZxNextWasmV2ExportFunction;
  zxnextGetNmiSourceMf: ZxNextWasmV2ExportFunction;
  zxnextGetNmiSourceDivMmc: ZxNextWasmV2ExportFunction;
  zxnextGetNmiSourceExpBus: ZxNextWasmV2ExportFunction;
  zxnextGetPendingMfNmi: ZxNextWasmV2ExportFunction;
  zxnextGetPendingDivMmcNmi: ZxNextWasmV2ExportFunction;
  zxnextGetSigNmi: ZxNextWasmV2ExportFunction;
  zxnextSetSdCardInfo: ZxNextWasmV2ExportFunction;
  zxnextSetSdReadResponseByte: ZxNextWasmV2ExportFunction;
  zxnextCommitSdReadResponse: ZxNextWasmV2ExportFunction;
  zxnextSetSdWriteResponse: ZxNextWasmV2ExportFunction;
  zxnextClearSdPendingCommand: ZxNextWasmV2ExportFunction;
  zxnextGetSdSelectedCard: ZxNextWasmV2ExportFunction;
  zxnextGetSdPendingCommand: ZxNextWasmV2ExportFunction;
  zxnextGetSdPendingSector: ZxNextWasmV2ExportFunction;
  zxnextGetSdPendingCard: ZxNextWasmV2ExportFunction;
  zxnextGetSdCommandCount: ZxNextWasmV2ExportFunction;
  zxnextGetSdReadRequestCount: ZxNextWasmV2ExportFunction;
  zxnextGetSdWriteRequestCount: ZxNextWasmV2ExportFunction;
  zxnextGetSdResponseReady: ZxNextWasmV2ExportFunction;
  zxnextGetSdResponseLength: ZxNextWasmV2ExportFunction;
  zxnextGetSdResponseIndex: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegIndex: ZxNextWasmV2ExportFunction;
  zxnextSetNextRegIndex: ZxNextWasmV2ExportFunction;
  zxnextReadNextRegData: ZxNextWasmV2ExportFunction;
  zxnextWriteNextRegData: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegLastReadValue: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegLastWrite: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegHasLastWrite: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegConfigMode: ZxNextWasmV2ExportFunction;
  zxnextIsPortGroupEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetInternalPortEnable: ZxNextWasmV2ExportFunction;
  zxnextGetBusPortEnable: ZxNextWasmV2ExportFunction;
  zxnextNextRegHardReset: ZxNextWasmV2ExportFunction;
  zxnextNextRegReset: ZxNextWasmV2ExportFunction;
  zxnextReadPhysical: ZxNextWasmV2ExportFunction;
  zxnextWritePhysical: ZxNextWasmV2ExportFunction;
  zxnextReadSramPage: ZxNextWasmV2ExportFunction;
  zxnextWriteSramPage: ZxNextWasmV2ExportFunction;
  zxnextGetKeyboardRowCount: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegCount: ZxNextWasmV2ExportFunction;
  zxnextGetScreenWidth: ZxNextWasmV2ExportFunction;
  zxnextGetScreenHeight: ZxNextWasmV2ExportFunction;
  zxnextGetAudioSampleCapacity: ZxNextWasmV2ExportFunction;
  zxnextGetSdCommandBufferSize: ZxNextWasmV2ExportFunction;
  zxnextGetSdResponseBufferSize: ZxNextWasmV2ExportFunction;
  zxnextGetDiagnosticBufferSize: ZxNextWasmV2ExportFunction;
  zxnextGetFrames: ZxNextWasmV2ExportFunction;
  zxnextGetTacts: ZxNextWasmV2ExportFunction;
  zxnextGetFrameTacts: ZxNextWasmV2ExportFunction;
  zxnextGetCurrentFrameTact: ZxNextWasmV2ExportFunction;
  zxnextGetCpuTactsPerFrame: ZxNextWasmV2ExportFunction;
  zxnextGetFrameCallCount: ZxNextWasmV2ExportFunction;
  zxnextGetLastFrameInstructionsExecuted: ZxNextWasmV2ExportFunction;
  zxnextGetCpuProgrammedSpeed: ZxNextWasmV2ExportFunction;
  zxnextGetCpuEffectiveSpeed: ZxNextWasmV2ExportFunction;
  zxnextGetCpuEffectiveClockMultiplier: ZxNextWasmV2ExportFunction;
  zxnextGetCpuTactScale: ZxNextWasmV2ExportFunction;
  zxnextGetCpuContentionDelaySinceStart: ZxNextWasmV2ExportFunction;
  zxnextCaptureUlaInterruptPulse: ZxNextWasmV2ExportFunction;
  zxnextCaptureLineInterruptPulse: ZxNextWasmV2ExportFunction;
  zxnextSetCtcInterruptStatus: ZxNextWasmV2ExportFunction;
  zxnextSetUartInterruptStatus: ZxNextWasmV2ExportFunction;
  zxnextSetDaisyInService: ZxNextWasmV2ExportFunction;
  zxnextDaisyUpdateIrqState: ZxNextWasmV2ExportFunction;
  zxnextDaisyPeekInterruptVector: ZxNextWasmV2ExportFunction;
  zxnextDaisyAcknowledge: ZxNextWasmV2ExportFunction;
  zxnextDaisyReti: ZxNextWasmV2ExportFunction;
  zxnextGetDmaInterruptRequestActive: ZxNextWasmV2ExportFunction;
  zxnextGetInterruptLineValue: ZxNextWasmV2ExportFunction;
  zxnextGetInterruptIm2TopBits: ZxNextWasmV2ExportFunction;
  zxnextGetInterruptStacklessNmiEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetInterruptHwIm2Mode: ZxNextWasmV2ExportFunction;
  zxnextGetInterruptNmiReturnAddress: ZxNextWasmV2ExportFunction;
  zxnextGetInterruptCtcEnabledMask: ZxNextWasmV2ExportFunction;
  zxnextGetInterruptCtcStatusMask: ZxNextWasmV2ExportFunction;
  zxnextGetInterruptCtcDmaEnableMask: ZxNextWasmV2ExportFunction;
  zxnextGetDaisyInServiceMask: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteIndex: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteControl: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteSelected: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteSecondUla: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteSecondSprite: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteEnableUlaNextMode: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteSecondWrite: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteStoredValue: ZxNextWasmV2ExportFunction;
  zxnextReadPaletteEntry: ZxNextWasmV2ExportFunction;
  zxnextReadUlaPlusData: ZxNextWasmV2ExportFunction;
  zxnextWriteUlaPlusData: ZxNextWasmV2ExportFunction;
  zxnextGetTimexPortValue: ZxNextWasmV2ExportFunction;
  zxnextGetTimexPortBits: ZxNextWasmV2ExportFunction;
  zxnextGetUlaPlusMode: ZxNextWasmV2ExportFunction;
  zxnextGetUlaPlusPaletteIndex: ZxNextWasmV2ExportFunction;
  zxnextGetUlaPlusEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2Enabled: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2Resolution: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2PaletteOffset: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ScrollX: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ScrollY: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ClipWindowX1: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ClipWindowX2: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ClipWindowY1: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ClipWindowY2: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ClipIndex: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ActiveRamBank: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ShadowRamBank: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2UseShadowBank: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2Bank: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2BankOffset: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2MappingReadsEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2MappingWritesEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetGlobalTransparencyColor: ZxNextWasmV2ExportFunction;
  zxnextGetLayerPriority: ZxNextWasmV2ExportFunction;
  zxnextGetFallbackColor: ZxNextWasmV2ExportFunction;
  zxnextGetLoResEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetLoResRadastanMode: ZxNextWasmV2ExportFunction;
  zxnextGetLoResRadastanTimexXor: ZxNextWasmV2ExportFunction;
  zxnextGetLoResPaletteOffset: ZxNextWasmV2ExportFunction;
  zxnextGetLoResScrollX: ZxNextWasmV2ExportFunction;
  zxnextGetLoResScrollY: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2MappedOffset: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetTilemap80x32Resolution: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapEliminateAttributes: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapTextMode: ZxNextWasmV2ExportFunction;
  zxnextGetTilemap512TileMode: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapForceOnTopOfUla: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapTransparencyIndex: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapClipIndex: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapClipWindowX1: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapClipWindowX2: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapClipWindowY1: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapClipWindowY2: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapScrollX: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapScrollY: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapUseBank7: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapBank5Msb: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapTileDefUseBank7: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapTileDefBank5Msb: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapPaletteOffset: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapXMirror: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapYMirror: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapRotate: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapUlaOver: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapDefaultAttr: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteSecondTilemap: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapVramOffset: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteMirrorTie: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteMirrorQ: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteMirrorIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteMirrorInc: ZxNextWasmV2ExportFunction;
  zxnextGetSprite0OnTop: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteClippingEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetSpritesEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetSpritesOverBorderEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteClipIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteClipWindowX1: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteClipWindowX2: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteClipWindowY1: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteClipWindowY2: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteTransparencyIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpritePatternIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpritePatternSubIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteSubIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteLastVisibleSpriteIndex: ZxNextWasmV2ExportFunction;
  zxnextReadSpritePattern8: ZxNextWasmV2ExportFunction;
  zxnextReadSpritePattern4: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteAttribute: ZxNextWasmV2ExportFunction;
  zxnextSetTacts: ZxNextWasmV2ExportFunction;
  zxnextGetHardResetCount: ZxNextWasmV2ExportFunction;
  zxnextGetResetCount: ZxNextWasmV2ExportFunction;
  zxnextGetRomUploadCount: ZxNextWasmV2ExportFunction;
  zxnextGetUploadedRomMask: ZxNextWasmV2ExportFunction;
  zxnextGetCpuInstructionsExecuted: ZxNextWasmV2ExportFunction;
  zxnextGetCpuAf: ZxNextWasmV2ExportFunction;
  zxnextSetCpuAf: ZxNextWasmV2ExportFunction;
  zxnextGetCpuAfAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuAfAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuBc: ZxNextWasmV2ExportFunction;
  zxnextSetCpuBc: ZxNextWasmV2ExportFunction;
  zxnextGetCpuBcAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuBcAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuDe: ZxNextWasmV2ExportFunction;
  zxnextSetCpuDe: ZxNextWasmV2ExportFunction;
  zxnextGetCpuDeAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuDeAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuHl: ZxNextWasmV2ExportFunction;
  zxnextSetCpuHl: ZxNextWasmV2ExportFunction;
  zxnextGetCpuHlAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuHlAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuIx: ZxNextWasmV2ExportFunction;
  zxnextSetCpuIx: ZxNextWasmV2ExportFunction;
  zxnextGetCpuIy: ZxNextWasmV2ExportFunction;
  zxnextSetCpuIy: ZxNextWasmV2ExportFunction;
  zxnextGetCpuIr: ZxNextWasmV2ExportFunction;
  zxnextSetCpuIr: ZxNextWasmV2ExportFunction;
  zxnextGetCpuWz: ZxNextWasmV2ExportFunction;
  zxnextSetCpuWz: ZxNextWasmV2ExportFunction;
  zxnextGetCpuPc: ZxNextWasmV2ExportFunction;
  zxnextSetCpuPc: ZxNextWasmV2ExportFunction;
  zxnextGetCpuSp: ZxNextWasmV2ExportFunction;
  zxnextSetCpuSp: ZxNextWasmV2ExportFunction;
  zxnextGetCpuHalted: ZxNextWasmV2ExportFunction;
  zxnextGetCpuPrefix: ZxNextWasmV2ExportFunction;
  zxnextGetCpuIff1: ZxNextWasmV2ExportFunction;
  zxnextSetCpuIff1: ZxNextWasmV2ExportFunction;
  zxnextGetCpuIff2: ZxNextWasmV2ExportFunction;
  zxnextSetCpuIff2: ZxNextWasmV2ExportFunction;
  zxnextGetCpuInterruptMode: ZxNextWasmV2ExportFunction;
  zxnextSetCpuInterruptMode: ZxNextWasmV2ExportFunction;
  zxnextGetCpuTacts: ZxNextWasmV2ExportFunction;
  zxnextGetZ80NMode: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryValue: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryIsWrite: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortValue: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortIsWrite: ZxNextWasmV2ExportFunction;
  zxnextGetUnsupportedPortReadCount: ZxNextWasmV2ExportFunction;
  zxnextGetUnsupportedPortWriteCount: ZxNextWasmV2ExportFunction;
  zxnextGetFirstUnsupportedPortAddress: ZxNextWasmV2ExportFunction;
  zxnextGetFirstUnsupportedPortValue: ZxNextWasmV2ExportFunction;
  zxnextGetFirstUnsupportedPortIsWrite: ZxNextWasmV2ExportFunction;
  zxnextGetFirstUnsupportedPortOwnerStep: ZxNextWasmV2ExportFunction;
  zxnextGetLastTbBlueAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLastTbBlueValue: ZxNextWasmV2ExportFunction;
  zxnextGetLastTbBlueIsWrite: ZxNextWasmV2ExportFunction;
  zxnextClearBusEvents: ZxNextWasmV2ExportFunction;
  zxnextGetDiagnosticFlags: ZxNextWasmV2ExportFunction;
};

export type ZxNextWasmV2Instance = {
  readonly exports: ZxNextWasmV2Exports;
};

export type ZxNextWasmV2ArtifactReader = () => Promise<BufferSource>;
export type ZxNextWasmV2Compiler = (bytes: BufferSource) => Promise<WebAssembly.Module>;
export type ZxNextWasmV2Instantiator = (module: WebAssembly.Module) => Promise<ZxNextWasmV2Instance>;

export type ZxNextWasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: ZxNextWasmV2ArtifactReader;
  readonly compile?: ZxNextWasmV2Compiler;
  readonly instantiate?: ZxNextWasmV2Instantiator;
};

export type ZxNextWasmV2Runtime = {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: ZxNextWasmV2Instance;
  readonly exports: ZxNextWasmV2Exports;
  readonly memoryBuffer: ArrayBuffer;
  readonly memory: Uint8Array;
  readonly sram: Uint8Array;
  readonly rom: Uint8Array;
  readonly keyboardRows: Uint8Array;
  readonly nextRegs: Uint8Array;
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  readonly audioSamples: Int16Array;
  readonly sdCommandBuffer: Uint8Array;
  readonly sdResponseBuffer: Uint8Array;
  readonly diagnosticBuffer: Uint32Array;
};

const requiredV2Exports = [
  "memory",
  "zxnextMemoryPtr",
  "zxnextSramPtr",
  "zxnextRomPtr",
  "zxnextKeyboardRowsPtr",
  "zxnextNextRegsPtr",
  "zxnextPixelBufferPtr",
  "zxnextAudioSamplesPtr",
  "zxnextSdCommandBufferPtr",
  "zxnextSdResponseBufferPtr",
  "zxnextDiagnosticBufferPtr",
  "zxnextHardReset",
  "zxnextReset",
  "zxnextExecuteInstruction",
  "zxnextExecuteFrame",
  "zxnextUploadRomByte",
  "zxnextReadRomByte",
  "zxnextReadMemory",
  "zxnextWriteMemory",
  "zxnextReadScreenMemoryOffset",
  "zxnextReadPort",
  "zxnextWritePort",
  "zxnextSetPortReadValue",
  "zxnextSetKeyboardRow",
  "zxnextGetKeyboardRow",
  "zxnextGetKeyboardRowWrites",
  "zxnextSetJoystickState",
  "zxnextSetMouseState",
  "zxnextAddMouseDelta",
  "zxnextAddMouseWheelDelta",
  "zxnextSetMouseButtons",
  "zxnextGetJoystick1Mode",
  "zxnextGetJoystick2Mode",
  "zxnextGetJoystickIoModeEnabled",
  "zxnextGetJoystickIoMode",
  "zxnextGetJoystickIoModeParam",
  "zxnextGetJoystickLeftState",
  "zxnextGetJoystickRightState",
  "zxnextGetJoystickStateWriteCount",
  "zxnextGetMouseX",
  "zxnextGetMouseY",
  "zxnextGetMouseWheel",
  "zxnextGetMouseButtonLeft",
  "zxnextGetMouseButtonRight",
  "zxnextGetMouseButtonMiddle",
  "zxnextGetMouseSwapButtons",
  "zxnextGetMouseDpi",
  "zxnextGetMouseStateWriteCount",
  "zxnextPushUartRxByte",
  "zxnextPopUartTxByte",
  "zxnextUartOnNewFrame",
  "zxnextSetUartBreakCondition",
  "zxnextSetUartFramingError",
  "zxnextGetUartSelected",
  "zxnextGetUartPrescaler",
  "zxnextGetUartPrescalerLsb",
  "zxnextGetUartPrescalerMsb",
  "zxnextGetUartFrameRegister",
  "zxnextGetUartRxCount",
  "zxnextGetUartTxCount",
  "zxnextGetUartBreakCondition",
  "zxnextGetUartFramingError",
  "zxnextGetUartRxOverflow",
  "zxnextGetUartTxWriteCount",
  "zxnextGetUartRxInjectCount",
  "zxnextSetI2cCmosByte",
  "zxnextGetI2cCmosByte",
  "zxnextSetI2cFrameRate",
  "zxnextAdvanceI2cClock",
  "zxnextI2cOnNewFrame",
  "zxnextGetI2cSclOut",
  "zxnextGetI2cSdaOut",
  "zxnextGetI2cSdaLine",
  "zxnextGetI2cState",
  "zxnextGetI2cRegPointer",
  "zxnextGetI2cFrameCounter",
  "zxnextGetI2cFramesPerSecond",
  "zxnextGetI2cClockAdvanceCount",
  "zxnextSetExtendedKeyReg",
  "zxnextGetExtendedKeyReg",
  "zxnextReadUlaPort",
  "zxnextWriteUlaPort",
  "zxnextGetUlaBorderColor",
  "zxnextGetUlaEarBit",
  "zxnextGetUlaMicBit",
  "zxnextGetUlaBeeperEar",
  "zxnextGetUlaBeeperMic",
  "zxnextGetUlaBit4ChangedFrom0Tacts",
  "zxnextGetUlaBit4ChangedFrom1Tacts",
  "zxnextGenerateAudioSamples",
  "zxnextGenerateAudioFrameSamples",
  "zxnextGetAudioSampleCount",
  "zxnextGetDacChannel",
  "zxnextGetDacLeftLevel",
  "zxnextGetDacRightLevel",
  "zxnextGetAudioBeepOnlyToInternalSpeaker",
  "zxnextGetAudioPsgMode",
  "zxnextGetAudioAyStereoMode",
  "zxnextGetAudioEnableInternalSpeaker",
  "zxnextGetAudioEnable8BitDacs",
  "zxnextGetAudioSilenceHdmiAudio",
  "zxnextGetAudioEnableTurbosound",
  "zxnextGetAudioAyMonoEnable",
  "zxnextGetPsgSelectedChip",
  "zxnextGetPsgSelectedRegister",
  "zxnextGetPsgRegister",
  "zxnextGetPsgPanning",
  "zxnextGetPsgMixerLeft",
  "zxnextGetPsgMixerRight",
  "zxnextReadDmaPort",
  "zxnextWriteDmaPort",
  "zxnextStepDma",
  "zxnextRunDma",
  "zxnextAcknowledgeDmaBus",
  "zxnextGetDmaMode",
  "zxnextGetDmaSeq",
  "zxnextGetDmaState",
  "zxnextGetDmaBusState",
  "zxnextGetDmaBusRequested",
  "zxnextGetDmaBusAcknowledged",
  "zxnextGetDmaEnabled",
  "zxnextGetDmaRawReg",
  "zxnextGetDmaNumFollow",
  "zxnextGetDmaReadSeq",
  "zxnextGetDmaStatus",
  "zxnextGetDmaPortAStart",
  "zxnextGetDmaPortBStart",
  "zxnextGetDmaBlockLength",
  "zxnextGetDmaAddressA",
  "zxnextGetDmaAddressB",
  "zxnextGetDmaByteCounter",
  "zxnextGetDmaTransferCount",
  "zxnextGetDmaBlockCompletionCount",
  "zxnextGetDmaLastStepTicks",
  "zxnextGetDmaTransferDataByte",
  "zxnextGetDmaDirectionAtoB",
  "zxnextGetDmaPortAIsIo",
  "zxnextGetDmaPortBIsIo",
  "zxnextGetDmaPortAAddressMode",
  "zxnextGetDmaPortBAddressMode",
  "zxnextGetDmaTransferMode",
  "zxnextGetDmaAutoRestart",
  "zxnextGetDmaPortBPrescaler",
  "zxnextGetDmaForceReady",
  "zxnextGetDmaInterruptPending",
  "zxnextGetDmaVector",
  "zxnextCopperExecuteTick",
  "zxnextReadCopperMemory",
  "zxnextGetCopperStartMode",
  "zxnextGetCopperInstructionAddress",
  "zxnextGetCopperStoredByte",
  "zxnextGetCopperListAddr",
  "zxnextGetCopperListData",
  "zxnextGetCopperDout",
  "zxnextGetCopperVerticalLineOffset",
  "zxnextGetCopperTickCount",
  "zxnextGetCopperWriteCount",
  "zxnextReadCtcPort",
  "zxnextWriteCtcPort",
  "zxnextCtcClockTick",
  "zxnextCtcAdvanceToSysClock",
  "zxnextCtcOnNewFrame",
  "zxnextGetCtcChannelState",
  "zxnextGetCtcControlReg",
  "zxnextGetCtcTimeConstant",
  "zxnextGetCtcPrescalerCount",
  "zxnextGetCtcCount",
  "zxnextGetCtcCountZeroD",
  "zxnextGetCtcIowrD",
  "zxnextGetCtcClkTrgD",
  "zxnextGetCtcZcTo",
  "zxnextGetCtcExpectingTimeConstant",
  "zxnextGetCtcIm2VectorWrite",
  "zxnextGetCtcLastSyncClock",
  "zxnextRenderInstantScreen",
  "zxnextGetPixelBufferStartOffset",
  "zxnextGetScreenRenderingTacts",
  "zxnextGetScreenIntStartTact",
  "zxnextGetScreenIntEndTact",
  "zxnextGetScreenIs60Hz",
  "zxnextGetScreenRenderCount",
  "zxnextGetScreenNonBlankPixelCount",
  "zxnextGetScreenBank",
  "zxnextGetUlaRenderingFlags",
  "zxnextGetRenderingHc",
  "zxnextGetRenderingVc",
  "zxnextGetRenderingPixelIndex",
  "zxnextReadNextReg",
  "zxnextWriteNextReg",
  "zxnextGetFlatMemorySize",
  "zxnextGetSramSize",
  "zxnextGetSramCapacity",
  "zxnextGetRomSize",
  "zxnextGetNextRomOffset",
  "zxnextGetDivMmcRomOffset",
  "zxnextGetMultifaceMemOffset",
  "zxnextGetAltRomOffset",
  "zxnextGetDivMmcRamOffset",
  "zxnextGetNextRamOffset",
  "zxnextGetConfiguredMemorySizeKb",
  "zxnextGetMainRamPageCount",
  "zxnextGetMaxMainRamPageCount",
  "zxnextGetActiveMainRamSize",
  "zxnextGetActiveMemorySize",
  "zxnextGetSentinelOffset",
  "zxnextGetSentinelSize",
  "zxnextConfigureMemorySize",
  "zxnextGetMmuReg",
  "zxnextSetMmuReg",
  "zxnextGetPageReadOffset",
  "zxnextGetPageWriteOffset",
  "zxnextGetPageBank16k",
  "zxnextGetPageBank8k",
  "zxnextGetCurrentPartition",
  "zxnextGetPort7ffdValue",
  "zxnextGetPortDffdValue",
  "zxnextGetPort1ffdValue",
  "zxnextGetPortEff7Value",
  "zxnextGetSelectedRomPage",
  "zxnextGetSelectedRamBank",
  "zxnextGetSelectedBankLsb",
  "zxnextGetSelectedBankMsb",
  "zxnextGetPagingEnabled",
  "zxnextGetAllRamMode",
  "zxnextGetSpecialConfig",
  "zxnextGetUseShadowScreen",
  "zxnextReadDivMmcPortE3",
  "zxnextWriteDivMmcPortE3",
  "zxnextReadSpiDataPort",
  "zxnextWriteSpiDataPort",
  "zxnextWriteSpiCsPort",
  "zxnextGetDivMmcEnabled",
  "zxnextGetDivMmcConmem",
  "zxnextGetDivMmcMapram",
  "zxnextGetDivMmcBank",
  "zxnextGetDivMmcPortE3Value",
  "zxnextGetDivMmcEnableAutomap",
  "zxnextGetDivMmcAutoMapActive",
  "zxnextGetDivMmcRstTrapEnabledMask",
  "zxnextGetDivMmcRstTrapOnlyWithRom3Mask",
  "zxnextGetDivMmcRstTrapInstantMask",
  "zxnextGetDivMmcEntry1",
  "zxnextShouldPropagateIo",
  "zxnextSetExpansionRomcsSignal",
  "zxnextSetExpansionExternalBusData",
  "zxnextSetExpansionNmiPending",
  "zxnextSetExpansionIntPending",
  "zxnextGetExpansionEnabled",
  "zxnextGetExpansionRomcsReplacement",
  "zxnextGetExpansionDisableIoCycles",
  "zxnextGetExpansionDisableMemCycles",
  "zxnextGetExpansionSoftResetPersistence",
  "zxnextGetExpansionRomcsSignal",
  "zxnextGetExpansionRomcsClaimed",
  "zxnextGetExpansionExternalBusData",
  "zxnextGetExpansionNmiPending",
  "zxnextGetExpansionNmiAsserted",
  "zxnextGetExpansionIntPending",
  "zxnextGetExpansionIntActive",
  "zxnextGetExpansionUlaOverrideEnabled",
  "zxnextGetExpansionNmiDebounceDisabled",
  "zxnextGetExpansionClockAlwaysOn",
  "zxnextGetExpansionIoPropagate",
  "zxnextGetMultifaceType",
  "zxnextSetMultifaceType",
  "zxnextGetMultifaceEnabled",
  "zxnextGetMultifaceNmiActive",
  "zxnextGetMultifaceMfEnabled",
  "zxnextGetMultifaceInvisible",
  "zxnextGetMultifaceIsActive",
  "zxnextGetMultifaceNmiHold",
  "zxnextGetMultifaceEnablePortAddress",
  "zxnextGetMultifaceDisablePortAddress",
  "zxnextGetMultifaceMfPortEn",
  "zxnextPressMultifaceNmiButton",
  "zxnextMultifaceOnFetch0066",
  "zxnextMultifaceHandleRetn",
  "zxnextRequestMfNmi",
  "zxnextRequestDivMmcNmi",
  "zxnextNmiBeforeOpcodeFetch",
  "zxnextGetNmiState",
  "zxnextGetNmiSourceMf",
  "zxnextGetNmiSourceDivMmc",
  "zxnextGetNmiSourceExpBus",
  "zxnextGetPendingMfNmi",
  "zxnextGetPendingDivMmcNmi",
  "zxnextGetSigNmi",
  "zxnextSetSdCardInfo",
  "zxnextSetSdReadResponseByte",
  "zxnextCommitSdReadResponse",
  "zxnextSetSdWriteResponse",
  "zxnextClearSdPendingCommand",
  "zxnextGetSdSelectedCard",
  "zxnextGetSdPendingCommand",
  "zxnextGetSdPendingSector",
  "zxnextGetSdPendingCard",
  "zxnextGetSdCommandCount",
  "zxnextGetSdReadRequestCount",
  "zxnextGetSdWriteRequestCount",
  "zxnextGetSdResponseReady",
  "zxnextGetSdResponseLength",
  "zxnextGetSdResponseIndex",
  "zxnextGetNextRegIndex",
  "zxnextSetNextRegIndex",
  "zxnextReadNextRegData",
  "zxnextWriteNextRegData",
  "zxnextGetNextRegLastReadValue",
  "zxnextGetNextRegLastWrite",
  "zxnextGetNextRegHasLastWrite",
  "zxnextGetNextRegConfigMode",
  "zxnextIsPortGroupEnabled",
  "zxnextGetInternalPortEnable",
  "zxnextGetBusPortEnable",
  "zxnextNextRegHardReset",
  "zxnextNextRegReset",
  "zxnextReadPhysical",
  "zxnextWritePhysical",
  "zxnextReadSramPage",
  "zxnextWriteSramPage",
  "zxnextGetKeyboardRowCount",
  "zxnextGetNextRegCount",
  "zxnextGetScreenWidth",
  "zxnextGetScreenHeight",
  "zxnextGetAudioSampleCapacity",
  "zxnextGetSdCommandBufferSize",
  "zxnextGetSdResponseBufferSize",
  "zxnextGetDiagnosticBufferSize",
  "zxnextGetFrames",
  "zxnextGetTacts",
  "zxnextGetFrameTacts",
  "zxnextGetCurrentFrameTact",
  "zxnextGetCpuTactsPerFrame",
  "zxnextGetFrameCallCount",
  "zxnextGetLastFrameInstructionsExecuted",
  "zxnextGetCpuProgrammedSpeed",
  "zxnextGetCpuEffectiveSpeed",
  "zxnextGetCpuEffectiveClockMultiplier",
  "zxnextGetCpuTactScale",
  "zxnextGetCpuContentionDelaySinceStart",
  "zxnextCaptureUlaInterruptPulse",
  "zxnextCaptureLineInterruptPulse",
  "zxnextSetCtcInterruptStatus",
  "zxnextSetUartInterruptStatus",
  "zxnextSetDaisyInService",
  "zxnextDaisyUpdateIrqState",
  "zxnextDaisyPeekInterruptVector",
  "zxnextDaisyAcknowledge",
  "zxnextDaisyReti",
  "zxnextGetDmaInterruptRequestActive",
  "zxnextGetInterruptLineValue",
  "zxnextGetInterruptIm2TopBits",
  "zxnextGetInterruptStacklessNmiEnabled",
  "zxnextGetInterruptHwIm2Mode",
  "zxnextGetInterruptNmiReturnAddress",
  "zxnextGetInterruptCtcEnabledMask",
  "zxnextGetInterruptCtcStatusMask",
  "zxnextGetInterruptCtcDmaEnableMask",
  "zxnextGetDaisyInServiceMask",
  "zxnextGetPaletteIndex",
  "zxnextGetPaletteControl",
  "zxnextGetPaletteSelected",
  "zxnextGetPaletteSecondUla",
  "zxnextGetPaletteSecondSprite",
  "zxnextGetPaletteEnableUlaNextMode",
  "zxnextGetPaletteSecondWrite",
  "zxnextGetPaletteStoredValue",
  "zxnextReadPaletteEntry",
  "zxnextReadUlaPlusData",
  "zxnextWriteUlaPlusData",
  "zxnextGetTimexPortValue",
  "zxnextGetTimexPortBits",
  "zxnextGetUlaPlusMode",
  "zxnextGetUlaPlusPaletteIndex",
  "zxnextGetUlaPlusEnabled",
  "zxnextGetLayer2Enabled",
  "zxnextGetLayer2Resolution",
  "zxnextGetLayer2PaletteOffset",
  "zxnextGetLayer2ScrollX",
  "zxnextGetLayer2ScrollY",
  "zxnextGetLayer2ClipWindowX1",
  "zxnextGetLayer2ClipWindowX2",
  "zxnextGetLayer2ClipWindowY1",
  "zxnextGetLayer2ClipWindowY2",
  "zxnextGetLayer2ClipIndex",
  "zxnextGetLayer2ActiveRamBank",
  "zxnextGetLayer2ShadowRamBank",
  "zxnextGetLayer2UseShadowBank",
  "zxnextGetLayer2Bank",
  "zxnextGetLayer2BankOffset",
  "zxnextGetLayer2MappingReadsEnabled",
  "zxnextGetLayer2MappingWritesEnabled",
  "zxnextGetGlobalTransparencyColor",
  "zxnextGetLayerPriority",
  "zxnextGetFallbackColor",
  "zxnextGetLoResEnabled",
  "zxnextGetLoResRadastanMode",
  "zxnextGetLoResRadastanTimexXor",
  "zxnextGetLoResPaletteOffset",
  "zxnextGetLoResScrollX",
  "zxnextGetLoResScrollY",
  "zxnextGetLayer2MappedOffset",
  "zxnextGetTilemapEnabled",
  "zxnextGetTilemap80x32Resolution",
  "zxnextGetTilemapEliminateAttributes",
  "zxnextGetTilemapTextMode",
  "zxnextGetTilemap512TileMode",
  "zxnextGetTilemapForceOnTopOfUla",
  "zxnextGetTilemapTransparencyIndex",
  "zxnextGetTilemapClipIndex",
  "zxnextGetTilemapClipWindowX1",
  "zxnextGetTilemapClipWindowX2",
  "zxnextGetTilemapClipWindowY1",
  "zxnextGetTilemapClipWindowY2",
  "zxnextGetTilemapScrollX",
  "zxnextGetTilemapScrollY",
  "zxnextGetTilemapUseBank7",
  "zxnextGetTilemapBank5Msb",
  "zxnextGetTilemapTileDefUseBank7",
  "zxnextGetTilemapTileDefBank5Msb",
  "zxnextGetTilemapPaletteOffset",
  "zxnextGetTilemapXMirror",
  "zxnextGetTilemapYMirror",
  "zxnextGetTilemapRotate",
  "zxnextGetTilemapUlaOver",
  "zxnextGetTilemapDefaultAttr",
  "zxnextGetPaletteSecondTilemap",
  "zxnextGetTilemapVramOffset",
  "zxnextGetSpriteMirrorTie",
  "zxnextGetSpriteMirrorQ",
  "zxnextGetSpriteMirrorIndex",
  "zxnextGetSpriteMirrorInc",
  "zxnextGetSprite0OnTop",
  "zxnextGetSpriteClippingEnabled",
  "zxnextGetSpritesEnabled",
  "zxnextGetSpritesOverBorderEnabled",
  "zxnextGetSpriteClipIndex",
  "zxnextGetSpriteClipWindowX1",
  "zxnextGetSpriteClipWindowX2",
  "zxnextGetSpriteClipWindowY1",
  "zxnextGetSpriteClipWindowY2",
  "zxnextGetSpriteTransparencyIndex",
  "zxnextGetSpritePatternIndex",
  "zxnextGetSpritePatternSubIndex",
  "zxnextGetSpriteIndex",
  "zxnextGetSpriteSubIndex",
  "zxnextGetSpriteLastVisibleSpriteIndex",
  "zxnextReadSpritePattern8",
  "zxnextReadSpritePattern4",
  "zxnextGetSpriteAttribute",
  "zxnextSetTacts",
  "zxnextGetHardResetCount",
  "zxnextGetResetCount",
  "zxnextGetRomUploadCount",
  "zxnextGetUploadedRomMask",
  "zxnextGetCpuInstructionsExecuted",
  "zxnextGetCpuAf",
  "zxnextSetCpuAf",
  "zxnextGetCpuAfAlt",
  "zxnextSetCpuAfAlt",
  "zxnextGetCpuBc",
  "zxnextSetCpuBc",
  "zxnextGetCpuBcAlt",
  "zxnextSetCpuBcAlt",
  "zxnextGetCpuDe",
  "zxnextSetCpuDe",
  "zxnextGetCpuDeAlt",
  "zxnextSetCpuDeAlt",
  "zxnextGetCpuHl",
  "zxnextSetCpuHl",
  "zxnextGetCpuHlAlt",
  "zxnextSetCpuHlAlt",
  "zxnextGetCpuIx",
  "zxnextSetCpuIx",
  "zxnextGetCpuIy",
  "zxnextSetCpuIy",
  "zxnextGetCpuIr",
  "zxnextSetCpuIr",
  "zxnextGetCpuWz",
  "zxnextSetCpuWz",
  "zxnextGetCpuPc",
  "zxnextSetCpuPc",
  "zxnextGetCpuSp",
  "zxnextSetCpuSp",
  "zxnextGetCpuHalted",
  "zxnextGetCpuPrefix",
  "zxnextGetCpuIff1",
  "zxnextSetCpuIff1",
  "zxnextGetCpuIff2",
  "zxnextSetCpuIff2",
  "zxnextGetCpuInterruptMode",
  "zxnextSetCpuInterruptMode",
  "zxnextGetCpuTacts",
  "zxnextGetZ80NMode",
  "zxnextGetLastMemoryAddress",
  "zxnextGetLastMemoryValue",
  "zxnextGetLastMemoryIsWrite",
  "zxnextGetLastPortAddress",
  "zxnextGetLastPortValue",
  "zxnextGetLastPortIsWrite",
  "zxnextGetUnsupportedPortReadCount",
  "zxnextGetUnsupportedPortWriteCount",
  "zxnextGetFirstUnsupportedPortAddress",
  "zxnextGetFirstUnsupportedPortValue",
  "zxnextGetFirstUnsupportedPortIsWrite",
  "zxnextGetFirstUnsupportedPortOwnerStep",
  "zxnextGetLastTbBlueAddress",
  "zxnextGetLastTbBlueValue",
  "zxnextGetLastTbBlueIsWrite",
  "zxnextClearBusEvents",
  "zxnextGetDiagnosticFlags"
] as const;

export function resetZxNextWasmV2ModuleCache(): void {
  // --- Intentionally empty. During the Next WASM rollout, always load the current artifact.
}

export async function loadZxNextWasmV2(
  options: ZxNextWasmV2LoaderOptions = {}
): Promise<ZxNextWasmV2Runtime> {
  const artifactName = options.artifactName ?? ZXNEXT_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledV2Module(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiateV2;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;

  validateZxNextWasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createZxNextWasmV2Views(wasmExports, artifactName)
  };
}

export function validateZxNextWasmV2Exports(
  exports: Partial<ZxNextWasmV2Exports>,
  artifactName = ZXNEXT_WASM_V2_ARTIFACT_NAME
): void {
  for (const exportName of requiredV2Exports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`ZX Spectrum Next WASM v2 artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }

    if (typeof exports[exportName] !== "function") {
      throw new Error(`ZX Spectrum Next WASM v2 artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

export function createZxNextWasmV2Views(
  exports: ZxNextWasmV2Exports,
  artifactName = ZXNEXT_WASM_V2_ARTIFACT_NAME
): Omit<ZxNextWasmV2Runtime, "artifactName" | "module" | "instance" | "exports"> {
  const memoryBuffer = exports.memory.buffer;
  const memorySize = exports.zxnextGetFlatMemorySize();
  const sramSize = exports.zxnextGetSramCapacity();
  const romSize = exports.zxnextGetRomSize();
  const keyboardRowCount = exports.zxnextGetKeyboardRowCount();
  const nextRegCount = exports.zxnextGetNextRegCount();
  const screenWidth = exports.zxnextGetScreenWidth();
  const screenHeight = exports.zxnextGetScreenHeight();
  const audioSampleCapacity = exports.zxnextGetAudioSampleCapacity();
  const sdCommandBufferSize = exports.zxnextGetSdCommandBufferSize();
  const sdResponseBufferSize = exports.zxnextGetSdResponseBufferSize();
  const diagnosticBufferSize = exports.zxnextGetDiagnosticBufferSize();
  const pixelWords = screenWidth * screenHeight;
  const pixelBytes = pixelWords * 4;
  const audioWords = audioSampleCapacity * 2;

  assertViewRange(artifactName, "memory", exports.zxnextMemoryPtr(), memorySize, memoryBuffer);
  assertViewRange(artifactName, "sram", exports.zxnextSramPtr(), sramSize, memoryBuffer);
  assertViewRange(artifactName, "rom", exports.zxnextRomPtr(), romSize, memoryBuffer);
  assertViewRange(artifactName, "keyboardRows", exports.zxnextKeyboardRowsPtr(), keyboardRowCount, memoryBuffer);
  assertViewRange(artifactName, "nextRegs", exports.zxnextNextRegsPtr(), nextRegCount, memoryBuffer);
  assertViewRange(artifactName, "pixelBuffer", exports.zxnextPixelBufferPtr(), pixelBytes, memoryBuffer);
  assertViewRange(artifactName, "audioSamples", exports.zxnextAudioSamplesPtr(), audioWords * 2, memoryBuffer);
  assertViewRange(artifactName, "sdCommandBuffer", exports.zxnextSdCommandBufferPtr(), sdCommandBufferSize, memoryBuffer);
  assertViewRange(artifactName, "sdResponseBuffer", exports.zxnextSdResponseBufferPtr(), sdResponseBufferSize, memoryBuffer);
  assertViewRange(artifactName, "diagnosticBuffer", exports.zxnextDiagnosticBufferPtr(), diagnosticBufferSize * 4, memoryBuffer);

  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.zxnextMemoryPtr(), memorySize),
    sram: new Uint8Array(memoryBuffer, exports.zxnextSramPtr(), sramSize),
    rom: new Uint8Array(memoryBuffer, exports.zxnextRomPtr(), romSize),
    keyboardRows: new Uint8Array(memoryBuffer, exports.zxnextKeyboardRowsPtr(), keyboardRowCount),
    nextRegs: new Uint8Array(memoryBuffer, exports.zxnextNextRegsPtr(), nextRegCount),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.zxnextPixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.zxnextPixelBufferPtr(), pixelBytes),
    audioSamples: new Int16Array(memoryBuffer, exports.zxnextAudioSamplesPtr(), audioWords),
    sdCommandBuffer: new Uint8Array(memoryBuffer, exports.zxnextSdCommandBufferPtr(), sdCommandBufferSize),
    sdResponseBuffer: new Uint8Array(memoryBuffer, exports.zxnextSdResponseBufferPtr(), sdResponseBufferSize),
    diagnosticBuffer: new Uint32Array(memoryBuffer, exports.zxnextDiagnosticBufferPtr(), diagnosticBufferSize)
  };
}

async function getCompiledV2Module(
  artifactName: string,
  options: ZxNextWasmV2LoaderOptions
): Promise<WebAssembly.Module> {
  const readArtifact = options.readArtifact ?? (() => defaultReadV2Artifact(artifactName));
  const compile = options.compile ?? WebAssembly.compile;
  const bytes = await readArtifact();
  return compile(bytes);
}

async function defaultReadV2Artifact(artifactName: string): Promise<ArrayBuffer> {
  const artifactUrl = new URL(`./dist/${artifactName}`, import.meta.url);
  const response = await fetch(artifactUrl);
  if (!response.ok) {
    throw new Error(
      `Cannot load ZX Spectrum Next WASM v2 artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`
    );
  }
  return response.arrayBuffer();
}

async function defaultInstantiateV2(module: WebAssembly.Module): Promise<ZxNextWasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as ZxNextWasmV2Exports };
}

function assertViewRange(
  artifactName: string,
  name: string,
  offset: number,
  byteLength: number,
  memoryBuffer: ArrayBuffer
): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + byteLength > memoryBuffer.byteLength) {
    throw new Error(
      `ZX Spectrum Next WASM v2 artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
