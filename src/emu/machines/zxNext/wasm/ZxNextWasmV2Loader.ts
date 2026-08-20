import { OFFS_ERR_PAGE } from "../MemoryDevice";

export const ZXNEXT_WASM_V2_ARTIFACT_NAME = "zx-spectrum-next.wasm";
export const ZXNEXT_WASM_V2_MEMORY_SIZE = OFFS_ERR_PAGE + 0x2000;
export const ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE = 0x10000;
export const ZXNEXT_WASM_V2_KEYBOARD_LINE_COUNT = 8;
export const ZXNEXT_WASM_V2_NEXT_REG_COUNT = 0x100;
export const ZXNEXT_WASM_V2_SCREEN_WIDTH = 720;
export const ZXNEXT_WASM_V2_SCREEN_HEIGHT = 288;

export type ZxNextWasmV2ExportFunction = (...args: number[]) => number;

export type ZxNextWasmV2Exports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  zxnextMemoryPtr: ZxNextWasmV2ExportFunction;
  zxnextPixelBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextKeyboardLinesPtr: ZxNextWasmV2ExportFunction;
  zxnextNextRegsPtr: ZxNextWasmV2ExportFunction;
  zxnextReset: ZxNextWasmV2ExportFunction;
  zxnextHardReset: ZxNextWasmV2ExportFunction;
  zxnextExecuteFrame: ZxNextWasmV2ExportFunction;
  zxnextExecuteInstruction: ZxNextWasmV2ExportFunction;
  zxnextRenderInstantScreen: ZxNextWasmV2ExportFunction;
  zxnextReadMemory: ZxNextWasmV2ExportFunction;
  zxnextWriteMemory: ZxNextWasmV2ExportFunction;
  zxnextReadScreenMemoryOffset: ZxNextWasmV2ExportFunction;
  zxnextGetMemoryPageReadOffset: ZxNextWasmV2ExportFunction;
  zxnextGetMemoryPageWriteOffset: ZxNextWasmV2ExportFunction;
  zxnextGetMemoryPageBank16: ZxNextWasmV2ExportFunction;
  zxnextGetMemoryPageBank8: ZxNextWasmV2ExportFunction;
  zxnextGetMemorySelectedRomPage: ZxNextWasmV2ExportFunction;
  zxnextGetMemorySelectedRamBank: ZxNextWasmV2ExportFunction;
  zxnextSetKeyStatus: ZxNextWasmV2ExportFunction;
  zxnextGetKeyboardLine: ZxNextWasmV2ExportFunction;
  zxnextReadPort: ZxNextWasmV2ExportFunction;
  zxnextWritePort: ZxNextWasmV2ExportFunction;
  zxnextGetMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetFlatMemorySize: ZxNextWasmV2ExportFunction;
  zxnextGetKeyboardLineCount: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegCount: ZxNextWasmV2ExportFunction;
  zxnextGetScreenWidth: ZxNextWasmV2ExportFunction;
  zxnextGetScreenHeight: ZxNextWasmV2ExportFunction;
  zxnextGetPixelBufferStartOffset: ZxNextWasmV2ExportFunction;
  zxnextGetFrames: ZxNextWasmV2ExportFunction;
  zxnextGetTacts: ZxNextWasmV2ExportFunction;
  zxnextGetCurrentFrameTact: ZxNextWasmV2ExportFunction;
  zxnextGetTactsInFrame: ZxNextWasmV2ExportFunction;
  zxnextGetFrameCompleted: ZxNextWasmV2ExportFunction;
  zxnextSetSignalNmi: ZxNextWasmV2ExportFunction;
  zxnextGetSignalNmi: ZxNextWasmV2ExportFunction;
  zxnextSetNmiCause: ZxNextWasmV2ExportFunction;
  zxnextGetNmiCause: ZxNextWasmV2ExportFunction;
  zxnextGetNmiReturnAddress: ZxNextWasmV2ExportFunction;
  zxnextGetStacklessNmiProcessed: ZxNextWasmV2ExportFunction;
  zxnextSetSignalInt: ZxNextWasmV2ExportFunction;
  zxnextGetSignalInt: ZxNextWasmV2ExportFunction;
  zxnextGetLastInterruptVector: ZxNextWasmV2ExportFunction;
  zxnextSetDaisyStatus: ZxNextWasmV2ExportFunction;
  zxnextSetDaisyEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetDaisyInService: ZxNextWasmV2ExportFunction;
  zxnextSetTacts: ZxNextWasmV2ExportFunction;
  zxnextGetCpuAf: ZxNextWasmV2ExportFunction;
  zxnextSetCpuAf: ZxNextWasmV2ExportFunction;
  zxnextGetCpuBc: ZxNextWasmV2ExportFunction;
  zxnextSetCpuBc: ZxNextWasmV2ExportFunction;
  zxnextGetCpuDe: ZxNextWasmV2ExportFunction;
  zxnextSetCpuDe: ZxNextWasmV2ExportFunction;
  zxnextGetCpuHl: ZxNextWasmV2ExportFunction;
  zxnextSetCpuHl: ZxNextWasmV2ExportFunction;
  zxnextGetCpuAfAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuAfAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuBcAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuBcAlt: ZxNextWasmV2ExportFunction;
  zxnextGetCpuDeAlt: ZxNextWasmV2ExportFunction;
  zxnextSetCpuDeAlt: ZxNextWasmV2ExportFunction;
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
  zxnextGetSharedZ80NMode: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryValue: ZxNextWasmV2ExportFunction;
  zxnextGetLastMemoryIsWrite: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortValue: ZxNextWasmV2ExportFunction;
  zxnextGetLastPortIsWrite: ZxNextWasmV2ExportFunction;
  zxnextSetNextRegisterIndex: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegisterIndex: ZxNextWasmV2ExportFunction;
  zxnextSetNextRegisterValue: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegisterValue: ZxNextWasmV2ExportFunction;
  zxnextGetNextRegisterDirect: ZxNextWasmV2ExportFunction;
  zxnextSetNextRegisterDirect: ZxNextWasmV2ExportFunction;
  zxnextGetPortFeValue: ZxNextWasmV2ExportFunction;
  zxnextGetBorderColor: ZxNextWasmV2ExportFunction;
  zxnextGetEarBit: ZxNextWasmV2ExportFunction;
  zxnextGetMicBit: ZxNextWasmV2ExportFunction;
  zxnextGetBeeperLevel: ZxNextWasmV2ExportFunction;
  zxnextGetDiagnosticFlags: ZxNextWasmV2ExportFunction;
  zxnextReadPhysicalMemory: ZxNextWasmV2ExportFunction;
  zxnextChecksumPhysicalMemory: ZxNextWasmV2ExportFunction;
  zxnextSetTapeMode: ZxNextWasmV2ExportFunction;
  zxnextGetTapeMode: ZxNextWasmV2ExportFunction;
  zxnextGetTapeEarBit: ZxNextWasmV2ExportFunction;
  zxnextProcessTapeMicBit: ZxNextWasmV2ExportFunction;
  zxnextGetUlaFlashCounter: ZxNextWasmV2ExportFunction;
  zxnextGetUlaFlashFlag: ZxNextWasmV2ExportFunction;
  zxnextAdvanceUlaFrameState: ZxNextWasmV2ExportFunction;
  zxnextGetUlaScanlineForTact: ZxNextWasmV2ExportFunction;
  zxnextGetUlaColumnForTact: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteNextReg: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteEntry: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteCurrentEntry: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteIndex: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteControl: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteSecondWrite: ZxNextWasmV2ExportFunction;
  zxnextGetPaletteStoredValue: ZxNextWasmV2ExportFunction;
  zxnextSetLayer2Enabled: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2Enabled: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2Resolution: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2PaletteOffset: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ScrollX: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2ScrollY: ZxNextWasmV2ExportFunction;
  zxnextGetLayer2Clip: ZxNextWasmV2ExportFunction;
  zxnextGetLoResEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetLoResRadastanMode: ZxNextWasmV2ExportFunction;
  zxnextGetLoResPaletteOffset: ZxNextWasmV2ExportFunction;
  zxnextGetLoResScrollX: ZxNextWasmV2ExportFunction;
  zxnextGetLoResScrollY: ZxNextWasmV2ExportFunction;
  zxnextGetLoResStandardAddress: ZxNextWasmV2ExportFunction;
  zxnextGetLoResRadastanAddress: ZxNextWasmV2ExportFunction;
  zxnextComposeLayer2Sample: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapNextReg: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapClip: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapPaletteOffset: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapScrollX: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapScrollY: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapBaseAddressUseBank7: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapBaseAddressMsb: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapDefinitionAddressUseBank7: ZxNextWasmV2ExportFunction;
  zxnextGetTilemapDefinitionAddressMsb: ZxNextWasmV2ExportFunction;
  zxnextSpriteWritePort303b: ZxNextWasmV2ExportFunction;
  zxnextSpriteWritePort57: ZxNextWasmV2ExportFunction;
  zxnextSpriteWritePort5b: ZxNextWasmV2ExportFunction;
  zxnextSpriteReadPort303b: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteClip: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteTransparencyIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpritePatternIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpritePatternSubIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteSubIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSpriteAttribute: ZxNextWasmV2ExportFunction;
  zxnextGetSpritePatternByte8: ZxNextWasmV2ExportFunction;
  zxnextGetSpritePatternByte4: ZxNextWasmV2ExportFunction;
  zxnextGetLastVisibleSpriteIndex: ZxNextWasmV2ExportFunction;
  zxnextCopperTick: ZxNextWasmV2ExportFunction;
  zxnextCopperRead: ZxNextWasmV2ExportFunction;
  zxnextGetCopperNextReg: ZxNextWasmV2ExportFunction;
  zxnextGetCopperStartMode: ZxNextWasmV2ExportFunction;
  zxnextGetCopperInstructionAddress: ZxNextWasmV2ExportFunction;
  zxnextGetCopperListAddress: ZxNextWasmV2ExportFunction;
  zxnextGetCopperListData: ZxNextWasmV2ExportFunction;
  zxnextGetCopperDout: ZxNextWasmV2ExportFunction;
  zxnextGetCopperVerticalLineOffset: ZxNextWasmV2ExportFunction;
  zxnextSetBeeperOutput: ZxNextWasmV2ExportFunction;
  zxnextGetBeeperEar: ZxNextWasmV2ExportFunction;
  zxnextGetBeeperMic: ZxNextWasmV2ExportFunction;
  zxnextGetBeeperOutputLevelMilli: ZxNextWasmV2ExportFunction;
  zxnextGetBeeperSampleLeftMilli: ZxNextWasmV2ExportFunction;
  zxnextGetBeeperSampleRightMilli: ZxNextWasmV2ExportFunction;
  zxnextSetPsgTurbosoundEnabled: ZxNextWasmV2ExportFunction;
  zxnextSetPsgAyStereoMode: ZxNextWasmV2ExportFunction;
  zxnextSetPsgChipMonoMode: ZxNextWasmV2ExportFunction;
  zxnextSetPsgRegisterIndex: ZxNextWasmV2ExportFunction;
  zxnextWritePsgRegisterValue: ZxNextWasmV2ExportFunction;
  zxnextReadPsgRegisterValue: ZxNextWasmV2ExportFunction;
  zxnextGeneratePsgOutput: ZxNextWasmV2ExportFunction;
  zxnextGetPsgSelectedChip: ZxNextWasmV2ExportFunction;
  zxnextGetPsgSelectedRegister: ZxNextWasmV2ExportFunction;
  zxnextGetPsgChipPanning: ZxNextWasmV2ExportFunction;
  zxnextGetPsgChipMonoMode: ZxNextWasmV2ExportFunction;
  zxnextGetPsgRegister: ZxNextWasmV2ExportFunction;
  zxnextGetPsgOutputA: ZxNextWasmV2ExportFunction;
  zxnextGetPsgOutputB: ZxNextWasmV2ExportFunction;
  zxnextGetPsgOutputC: ZxNextWasmV2ExportFunction;
  zxnextGetPsgStereoLeft: ZxNextWasmV2ExportFunction;
  zxnextGetPsgStereoRight: ZxNextWasmV2ExportFunction;
  zxnextGetPsgNoiseRng: ZxNextWasmV2ExportFunction;
  zxnextGetPsgEnvelopeStep: ZxNextWasmV2ExportFunction;
  zxnextGetDacChannel: ZxNextWasmV2ExportFunction;
  zxnextGetDacStereoLeft: ZxNextWasmV2ExportFunction;
  zxnextGetDacStereoRight: ZxNextWasmV2ExportFunction;
  zxnextSetAudioMixerEarLevelMilli: ZxNextWasmV2ExportFunction;
  zxnextSetAudioMixerMicLevelMilli: ZxNextWasmV2ExportFunction;
  zxnextSetAudioMixerPsgOutput: ZxNextWasmV2ExportFunction;
  zxnextSetAudioMixerVolumeScaleMilli: ZxNextWasmV2ExportFunction;
  zxnextGetAudioMixerMixedLeftWord: ZxNextWasmV2ExportFunction;
  zxnextGetAudioMixerMixedRightWord: ZxNextWasmV2ExportFunction;
  zxnextAppendAudioMixerCurrentSample: ZxNextWasmV2ExportFunction;
  zxnextGetAudioMixerSampleCount: ZxNextWasmV2ExportFunction;
  zxnextGetAudioMixerSampleLeft: ZxNextWasmV2ExportFunction;
  zxnextGetAudioMixerSampleRight: ZxNextWasmV2ExportFunction;
  zxnextDivMmcBeforeFetch: ZxNextWasmV2ExportFunction;
  zxnextDivMmcAfterFetch: ZxNextWasmV2ExportFunction;
  zxnextDivMmcArmNmi: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcPortE3Value: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcEnableAutomap: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcConmem: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcMapram: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcBank: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcAutoMapActive: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcRequestAutomapOn: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcRequestAutomapOff: ZxNextWasmV2ExportFunction;
  zxnextGetDivMmcNmiHold: ZxNextWasmV2ExportFunction;
  zxnextSetSdCardInfo: ZxNextWasmV2ExportFunction;
  zxnextGetSdSelectedCard: ZxNextWasmV2ExportFunction;
  zxnextGetSdPortE7Value: ZxNextWasmV2ExportFunction;
  zxnextGetSdState: ZxNextWasmV2ExportFunction;
  zxnextGetSdCommandIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSdLastCommand: ZxNextWasmV2ExportFunction;
  zxnextGetSdResponseReady: ZxNextWasmV2ExportFunction;
  zxnextGetSdResponseIndex: ZxNextWasmV2ExportFunction;
  zxnextGetSdHostCommand: ZxNextWasmV2ExportFunction;
  zxnextGetSdHostSector: ZxNextWasmV2ExportFunction;
  zxnextGetSdHostCard: ZxNextWasmV2ExportFunction;
  zxnextGetSdWriteBufferPtr: ZxNextWasmV2ExportFunction;
  zxnextGetSdWriteBufferLength: ZxNextWasmV2ExportFunction;
  zxnextClearSdHostCommand: ZxNextWasmV2ExportFunction;
  zxnextSetSdReadResponse: ZxNextWasmV2ExportFunction;
  zxnextSetSdWriteResponse: ZxNextWasmV2ExportFunction;
  zxnextCtcClock: ZxNextWasmV2ExportFunction;
  zxnextGetCtcState: ZxNextWasmV2ExportFunction;
  zxnextGetCtcControlReg: ZxNextWasmV2ExportFunction;
  zxnextGetCtcTimeConstant: ZxNextWasmV2ExportFunction;
  zxnextGetCtcCount: ZxNextWasmV2ExportFunction;
  zxnextGetCtcZcTo: ZxNextWasmV2ExportFunction;
  zxnextGetCtcIntEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetCtcExpectingTimeConstant: ZxNextWasmV2ExportFunction;
  zxnextUartPushRxByte: ZxNextWasmV2ExportFunction;
  zxnextUartPopTxByte: ZxNextWasmV2ExportFunction;
  zxnextUartHasTxData: ZxNextWasmV2ExportFunction;
  zxnextUartDrainTxFifo: ZxNextWasmV2ExportFunction;
  zxnextUartSetBreakCondition: ZxNextWasmV2ExportFunction;
  zxnextUartSetFramingError: ZxNextWasmV2ExportFunction;
  zxnextGetUartSelected: ZxNextWasmV2ExportFunction;
  zxnextGetUartPrescaler: ZxNextWasmV2ExportFunction;
  zxnextGetUartFrameRegister: ZxNextWasmV2ExportFunction;
  zxnextGetUartRxCount: ZxNextWasmV2ExportFunction;
  zxnextGetUartTxCount: ZxNextWasmV2ExportFunction;
  zxnextI2cReadSclPort: ZxNextWasmV2ExportFunction;
  zxnextI2cReadSdaPort: ZxNextWasmV2ExportFunction;
  zxnextI2cWriteSclPort: ZxNextWasmV2ExportFunction;
  zxnextI2cWriteSdaPort: ZxNextWasmV2ExportFunction;
  zxnextGetI2cScl: ZxNextWasmV2ExportFunction;
  zxnextGetI2cSda: ZxNextWasmV2ExportFunction;
  zxnextSetJoystickModes: ZxNextWasmV2ExportFunction;
  zxnextSetJoystickLeftState: ZxNextWasmV2ExportFunction;
  zxnextSetJoystickRightState: ZxNextWasmV2ExportFunction;
  zxnextJoystickReadPort1f: ZxNextWasmV2ExportFunction;
  zxnextJoystickReadPort37: ZxNextWasmV2ExportFunction;
  zxnextMouseSetNextReg0A: ZxNextWasmV2ExportFunction;
  zxnextMouseAddDelta: ZxNextWasmV2ExportFunction;
  zxnextMouseAddWheelDelta: ZxNextWasmV2ExportFunction;
  zxnextMouseSetButtons: ZxNextWasmV2ExportFunction;
  zxnextMouseReadPortFbdf: ZxNextWasmV2ExportFunction;
  zxnextMouseReadPortFfdf: ZxNextWasmV2ExportFunction;
  zxnextMouseReadPortFadf: ZxNextWasmV2ExportFunction;
  zxnextGetMouseDpi: ZxNextWasmV2ExportFunction;
  zxnextGetMouseSwapButtons: ZxNextWasmV2ExportFunction;
  zxnextExpansionSetNextReg: ZxNextWasmV2ExportFunction;
  zxnextExpansionGetNextReg: ZxNextWasmV2ExportFunction;
  zxnextExpansionEffectivePortEnable: ZxNextWasmV2ExportFunction;
  zxnextExpansionShouldPropagateIo: ZxNextWasmV2ExportFunction;
  zxnextExpansionSetSignals: ZxNextWasmV2ExportFunction;
  zxnextExpansionIsRomcsClaimed: ZxNextWasmV2ExportFunction;
  zxnextExpansionIsNmiAsserted: ZxNextWasmV2ExportFunction;
  zxnextExpansionIsIntActive: ZxNextWasmV2ExportFunction;
  zxnextExpansionIsUlaOverride: ZxNextWasmV2ExportFunction;
  zxnextDmaSetMode: ZxNextWasmV2ExportFunction;
  zxnextDmaWritePort: ZxNextWasmV2ExportFunction;
  zxnextDmaExecuteTransfer: ZxNextWasmV2ExportFunction;
  zxnextDmaReadStatusByte: ZxNextWasmV2ExportFunction;
  zxnextGetDmaMode: ZxNextWasmV2ExportFunction;
  zxnextGetDmaStatus: ZxNextWasmV2ExportFunction;
  zxnextGetDmaReadMask: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortAStartAddress: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortBStartAddress: ZxNextWasmV2ExportFunction;
  zxnextGetDmaBlockLength: ZxNextWasmV2ExportFunction;
  zxnextGetDmaEnabled: ZxNextWasmV2ExportFunction;
  zxnextGetDmaByteCounter: ZxNextWasmV2ExportFunction;
  zxnextGetDmaDirectionAtoB: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortAConfig: ZxNextWasmV2ExportFunction;
  zxnextGetDmaPortBConfig: ZxNextWasmV2ExportFunction;
  zxnextGetDmaTransferMode: ZxNextWasmV2ExportFunction;
  zxnextGetDmaTransferredBytes: ZxNextWasmV2ExportFunction;
  zxnextFloppyReadMainStatusRegister: ZxNextWasmV2ExportFunction;
  zxnextFloppyReadDataRegister: ZxNextWasmV2ExportFunction;
  zxnextFloppyWriteDataRegister: ZxNextWasmV2ExportFunction;
  zxnextGetFloppyOperationPhase: ZxNextWasmV2ExportFunction;
  zxnextGetFloppyCommandRegister: ZxNextWasmV2ExportFunction;
  zxnextGetFloppyCommandBytesReceived: ZxNextWasmV2ExportFunction;
  zxnextGetFloppySr0: ZxNextWasmV2ExportFunction;
  zxnextGetFloppySr1: ZxNextWasmV2ExportFunction;
  zxnextGetFloppySr2: ZxNextWasmV2ExportFunction;
  zxnextGetFloppySr3: ZxNextWasmV2ExportFunction;
  zxnextGetFloppyStepRate: ZxNextWasmV2ExportFunction;
  zxnextGetFloppyHeadUnloadTime: ZxNextWasmV2ExportFunction;
  zxnextGetFloppyHeadLoadTime: ZxNextWasmV2ExportFunction;
  zxnextGetFloppyNonDmaMode: ZxNextWasmV2ExportFunction;
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
  readonly flatMemory: Uint8Array;
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  readonly keyboardLines: Uint8Array;
  readonly nextRegs: Uint8Array;
};

const requiredV2Exports = [
  "memory",
  "zxnextMemoryPtr",
  "zxnextPixelBufferPtr",
  "zxnextKeyboardLinesPtr",
  "zxnextNextRegsPtr",
  "zxnextReset",
  "zxnextHardReset",
  "zxnextExecuteFrame",
  "zxnextExecuteInstruction",
  "zxnextRenderInstantScreen",
  "zxnextReadMemory",
  "zxnextWriteMemory",
  "zxnextReadScreenMemoryOffset",
  "zxnextGetMemoryPageReadOffset",
  "zxnextGetMemoryPageWriteOffset",
  "zxnextGetMemoryPageBank16",
  "zxnextGetMemoryPageBank8",
  "zxnextGetMemorySelectedRomPage",
  "zxnextGetMemorySelectedRamBank",
  "zxnextSetKeyStatus",
  "zxnextGetKeyboardLine",
  "zxnextReadPort",
  "zxnextWritePort",
  "zxnextGetMemorySize",
  "zxnextGetFlatMemorySize",
  "zxnextGetKeyboardLineCount",
  "zxnextGetNextRegCount",
  "zxnextGetScreenWidth",
  "zxnextGetScreenHeight",
  "zxnextGetPixelBufferStartOffset",
  "zxnextGetFrames",
  "zxnextGetTacts",
  "zxnextGetCurrentFrameTact",
  "zxnextGetTactsInFrame",
  "zxnextGetFrameCompleted",
  "zxnextSetSignalNmi",
  "zxnextGetSignalNmi",
  "zxnextSetNmiCause",
  "zxnextGetNmiCause",
  "zxnextGetNmiReturnAddress",
  "zxnextGetStacklessNmiProcessed",
  "zxnextSetSignalInt",
  "zxnextGetSignalInt",
  "zxnextGetLastInterruptVector",
  "zxnextSetDaisyStatus",
  "zxnextSetDaisyEnabled",
  "zxnextGetDaisyInService",
  "zxnextSetTacts",
  "zxnextGetCpuAf",
  "zxnextSetCpuAf",
  "zxnextGetCpuBc",
  "zxnextSetCpuBc",
  "zxnextGetCpuDe",
  "zxnextSetCpuDe",
  "zxnextGetCpuHl",
  "zxnextSetCpuHl",
  "zxnextGetCpuAfAlt",
  "zxnextSetCpuAfAlt",
  "zxnextGetCpuBcAlt",
  "zxnextSetCpuBcAlt",
  "zxnextGetCpuDeAlt",
  "zxnextSetCpuDeAlt",
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
  "zxnextGetSharedZ80NMode",
  "zxnextGetLastMemoryAddress",
  "zxnextGetLastMemoryValue",
  "zxnextGetLastMemoryIsWrite",
  "zxnextGetLastPortAddress",
  "zxnextGetLastPortValue",
  "zxnextGetLastPortIsWrite",
  "zxnextSetNextRegisterIndex",
  "zxnextGetNextRegisterIndex",
  "zxnextSetNextRegisterValue",
  "zxnextGetNextRegisterValue",
  "zxnextGetNextRegisterDirect",
  "zxnextSetNextRegisterDirect",
  "zxnextGetPortFeValue",
  "zxnextGetBorderColor",
  "zxnextGetEarBit",
  "zxnextGetMicBit",
  "zxnextGetBeeperLevel",
  "zxnextGetDiagnosticFlags",
  "zxnextReadPhysicalMemory",
  "zxnextChecksumPhysicalMemory",
  "zxnextSetTapeMode",
  "zxnextGetTapeMode",
  "zxnextGetTapeEarBit",
  "zxnextProcessTapeMicBit",
  "zxnextGetUlaFlashCounter",
  "zxnextGetUlaFlashFlag",
  "zxnextAdvanceUlaFrameState",
  "zxnextGetUlaScanlineForTact",
  "zxnextGetUlaColumnForTact",
  "zxnextGetPaletteNextReg",
  "zxnextGetPaletteEntry",
  "zxnextGetPaletteCurrentEntry",
  "zxnextGetPaletteIndex",
  "zxnextGetPaletteControl",
  "zxnextGetPaletteSecondWrite",
  "zxnextGetPaletteStoredValue",
  "zxnextSetLayer2Enabled",
  "zxnextGetLayer2Enabled",
  "zxnextGetLayer2Resolution",
  "zxnextGetLayer2PaletteOffset",
  "zxnextGetLayer2ScrollX",
  "zxnextGetLayer2ScrollY",
  "zxnextGetLayer2Clip",
  "zxnextGetLoResEnabled",
  "zxnextGetLoResRadastanMode",
  "zxnextGetLoResPaletteOffset",
  "zxnextGetLoResScrollX",
  "zxnextGetLoResScrollY",
  "zxnextGetLoResStandardAddress",
  "zxnextGetLoResRadastanAddress",
  "zxnextComposeLayer2Sample",
  "zxnextGetTilemapNextReg",
  "zxnextGetTilemapClip",
  "zxnextGetTilemapEnabled",
  "zxnextGetTilemapPaletteOffset",
  "zxnextGetTilemapScrollX",
  "zxnextGetTilemapScrollY",
  "zxnextGetTilemapBaseAddressUseBank7",
  "zxnextGetTilemapBaseAddressMsb",
  "zxnextGetTilemapDefinitionAddressUseBank7",
  "zxnextGetTilemapDefinitionAddressMsb",
  "zxnextSpriteWritePort303b",
  "zxnextSpriteWritePort57",
  "zxnextSpriteWritePort5b",
  "zxnextSpriteReadPort303b",
  "zxnextGetSpriteClip",
  "zxnextGetSpriteTransparencyIndex",
  "zxnextGetSpriteIndex",
  "zxnextGetSpritePatternIndex",
  "zxnextGetSpritePatternSubIndex",
  "zxnextGetSpriteSubIndex",
  "zxnextGetSpriteAttribute",
  "zxnextGetSpritePatternByte8",
  "zxnextGetSpritePatternByte4",
  "zxnextGetLastVisibleSpriteIndex",
  "zxnextCopperTick",
  "zxnextCopperRead",
  "zxnextGetCopperNextReg",
  "zxnextGetCopperStartMode",
  "zxnextGetCopperInstructionAddress",
  "zxnextGetCopperListAddress",
  "zxnextGetCopperListData",
  "zxnextGetCopperDout",
  "zxnextGetCopperVerticalLineOffset",
  "zxnextSetBeeperOutput",
  "zxnextGetBeeperEar",
  "zxnextGetBeeperMic",
  "zxnextGetBeeperOutputLevelMilli",
  "zxnextGetBeeperSampleLeftMilli",
  "zxnextGetBeeperSampleRightMilli",
  "zxnextSetPsgTurbosoundEnabled",
  "zxnextSetPsgAyStereoMode",
  "zxnextSetPsgChipMonoMode",
  "zxnextSetPsgRegisterIndex",
  "zxnextWritePsgRegisterValue",
  "zxnextReadPsgRegisterValue",
  "zxnextGeneratePsgOutput",
  "zxnextGetPsgSelectedChip",
  "zxnextGetPsgSelectedRegister",
  "zxnextGetPsgChipPanning",
  "zxnextGetPsgChipMonoMode",
  "zxnextGetPsgRegister",
  "zxnextGetPsgOutputA",
  "zxnextGetPsgOutputB",
  "zxnextGetPsgOutputC",
  "zxnextGetPsgStereoLeft",
  "zxnextGetPsgStereoRight",
  "zxnextGetPsgNoiseRng",
  "zxnextGetPsgEnvelopeStep",
  "zxnextGetDacChannel",
  "zxnextGetDacStereoLeft",
  "zxnextGetDacStereoRight",
  "zxnextSetAudioMixerEarLevelMilli",
  "zxnextSetAudioMixerMicLevelMilli",
  "zxnextSetAudioMixerPsgOutput",
  "zxnextSetAudioMixerVolumeScaleMilli",
  "zxnextGetAudioMixerMixedLeftWord",
  "zxnextGetAudioMixerMixedRightWord",
  "zxnextAppendAudioMixerCurrentSample",
  "zxnextGetAudioMixerSampleCount",
  "zxnextGetAudioMixerSampleLeft",
  "zxnextGetAudioMixerSampleRight",
  "zxnextDivMmcBeforeFetch",
  "zxnextDivMmcAfterFetch",
  "zxnextDivMmcArmNmi",
  "zxnextGetDivMmcPortE3Value",
  "zxnextGetDivMmcEnabled",
  "zxnextGetDivMmcEnableAutomap",
  "zxnextGetDivMmcConmem",
  "zxnextGetDivMmcMapram",
  "zxnextGetDivMmcBank",
  "zxnextGetDivMmcAutoMapActive",
  "zxnextGetDivMmcRequestAutomapOn",
  "zxnextGetDivMmcRequestAutomapOff",
  "zxnextGetDivMmcNmiHold",
  "zxnextSetSdCardInfo",
  "zxnextGetSdSelectedCard",
  "zxnextGetSdPortE7Value",
  "zxnextGetSdState",
  "zxnextGetSdCommandIndex",
  "zxnextGetSdLastCommand",
  "zxnextGetSdResponseReady",
  "zxnextGetSdResponseIndex",
  "zxnextGetSdHostCommand",
  "zxnextGetSdHostSector",
  "zxnextGetSdHostCard",
  "zxnextGetSdWriteBufferPtr",
  "zxnextGetSdWriteBufferLength",
  "zxnextClearSdHostCommand",
  "zxnextSetSdReadResponse",
  "zxnextSetSdWriteResponse",
  "zxnextCtcClock",
  "zxnextGetCtcState",
  "zxnextGetCtcControlReg",
  "zxnextGetCtcTimeConstant",
  "zxnextGetCtcCount",
  "zxnextGetCtcZcTo",
  "zxnextGetCtcIntEnabled",
  "zxnextGetCtcExpectingTimeConstant",
  "zxnextUartPushRxByte",
  "zxnextUartPopTxByte",
  "zxnextUartHasTxData",
  "zxnextUartDrainTxFifo",
  "zxnextUartSetBreakCondition",
  "zxnextUartSetFramingError",
  "zxnextGetUartSelected",
  "zxnextGetUartPrescaler",
  "zxnextGetUartFrameRegister",
  "zxnextGetUartRxCount",
  "zxnextGetUartTxCount",
  "zxnextI2cReadSclPort",
  "zxnextI2cReadSdaPort",
  "zxnextI2cWriteSclPort",
  "zxnextI2cWriteSdaPort",
  "zxnextGetI2cScl",
  "zxnextGetI2cSda",
  "zxnextSetJoystickModes",
  "zxnextSetJoystickLeftState",
  "zxnextSetJoystickRightState",
  "zxnextJoystickReadPort1f",
  "zxnextJoystickReadPort37",
  "zxnextMouseSetNextReg0A",
  "zxnextMouseAddDelta",
  "zxnextMouseAddWheelDelta",
  "zxnextMouseSetButtons",
  "zxnextMouseReadPortFbdf",
  "zxnextMouseReadPortFfdf",
  "zxnextMouseReadPortFadf",
  "zxnextGetMouseDpi",
  "zxnextGetMouseSwapButtons",
  "zxnextExpansionSetNextReg",
  "zxnextExpansionGetNextReg",
  "zxnextExpansionEffectivePortEnable",
  "zxnextExpansionShouldPropagateIo",
  "zxnextExpansionSetSignals",
  "zxnextExpansionIsRomcsClaimed",
  "zxnextExpansionIsNmiAsserted",
  "zxnextExpansionIsIntActive",
  "zxnextExpansionIsUlaOverride",
  "zxnextDmaSetMode",
  "zxnextDmaWritePort",
  "zxnextDmaExecuteTransfer",
  "zxnextDmaReadStatusByte",
  "zxnextGetDmaMode",
  "zxnextGetDmaStatus",
  "zxnextGetDmaReadMask",
  "zxnextGetDmaPortAStartAddress",
  "zxnextGetDmaPortBStartAddress",
  "zxnextGetDmaBlockLength",
  "zxnextGetDmaEnabled",
  "zxnextGetDmaByteCounter",
  "zxnextGetDmaDirectionAtoB",
  "zxnextGetDmaPortAConfig",
  "zxnextGetDmaPortBConfig",
  "zxnextGetDmaTransferMode",
  "zxnextGetDmaTransferredBytes",
  "zxnextFloppyReadMainStatusRegister",
  "zxnextFloppyReadDataRegister",
  "zxnextFloppyWriteDataRegister",
  "zxnextGetFloppyOperationPhase",
  "zxnextGetFloppyCommandRegister",
  "zxnextGetFloppyCommandBytesReceived",
  "zxnextGetFloppySr0",
  "zxnextGetFloppySr1",
  "zxnextGetFloppySr2",
  "zxnextGetFloppySr3",
  "zxnextGetFloppyStepRate",
  "zxnextGetFloppyHeadUnloadTime",
  "zxnextGetFloppyHeadLoadTime",
  "zxnextGetFloppyNonDmaMode"
] as const;

export function resetZxNextWasmV2ModuleCache(): void {
  // Intentionally empty while this scaffold is changing rapidly during migration.
}

export async function loadZxNextWasmV2(options: ZxNextWasmV2LoaderOptions = {}): Promise<ZxNextWasmV2Runtime> {
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
  const memorySize = exports.zxnextGetMemorySize();
  const flatMemorySize = exports.zxnextGetFlatMemorySize();
  const keyboardLineCount = exports.zxnextGetKeyboardLineCount();
  const nextRegCount = exports.zxnextGetNextRegCount();
  const screenWidth = exports.zxnextGetScreenWidth();
  const screenHeight = exports.zxnextGetScreenHeight();
  const pixelWords = screenWidth * screenHeight;
  const pixelBytes = pixelWords * 4;

  assertExpectedSize(artifactName, "memory", memorySize, ZXNEXT_WASM_V2_MEMORY_SIZE);
  assertExpectedSize(artifactName, "flatMemory", flatMemorySize, ZXNEXT_WASM_V2_FLAT_MEMORY_SIZE);
  assertExpectedSize(artifactName, "keyboardLines", keyboardLineCount, ZXNEXT_WASM_V2_KEYBOARD_LINE_COUNT);
  assertExpectedSize(artifactName, "nextRegs", nextRegCount, ZXNEXT_WASM_V2_NEXT_REG_COUNT);
  assertExpectedSize(artifactName, "screenWidth", screenWidth, ZXNEXT_WASM_V2_SCREEN_WIDTH);
  assertExpectedSize(artifactName, "screenHeight", screenHeight, ZXNEXT_WASM_V2_SCREEN_HEIGHT);
  assertViewRange(artifactName, "memory", exports.zxnextMemoryPtr(), memorySize, memoryBuffer);
  assertViewRange(artifactName, "flatMemory", exports.zxnextMemoryPtr(), flatMemorySize, memoryBuffer);
  assertViewRange(artifactName, "pixelBuffer", exports.zxnextPixelBufferPtr(), pixelBytes, memoryBuffer);
  assertViewRange(artifactName, "keyboardLines", exports.zxnextKeyboardLinesPtr(), keyboardLineCount, memoryBuffer);
  assertViewRange(artifactName, "nextRegs", exports.zxnextNextRegsPtr(), nextRegCount, memoryBuffer);

  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.zxnextMemoryPtr(), memorySize),
    flatMemory: new Uint8Array(memoryBuffer, exports.zxnextMemoryPtr(), flatMemorySize),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.zxnextPixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.zxnextPixelBufferPtr(), pixelBytes),
    keyboardLines: new Uint8Array(memoryBuffer, exports.zxnextKeyboardLinesPtr(), keyboardLineCount),
    nextRegs: new Uint8Array(memoryBuffer, exports.zxnextNextRegsPtr(), nextRegCount)
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

function assertExpectedSize(
  artifactName: string,
  name: string,
  actual: number,
  expected: number
): void {
  if (actual !== expected) {
    throw new Error(
      `ZX Spectrum Next WASM v2 artifact '${artifactName}' reports ${name} size ${actual}; expected ${expected}.`
    );
  }
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
