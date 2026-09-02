export const SPP3E_WASM_V2_ARTIFACT_NAME = "zx-spectrum-p3e.wasm";
export const SPP3E_WASM_V2_MEMORY_SIZE = 0x10000;
export const SPP3E_WASM_V2_RAM_SIZE = 0x20000;
export const SPP3E_WASM_V2_ROM_SIZE = 0x10000;
export const SPP3E_WASM_V2_KEYBOARD_LINE_COUNT = 8;

export type SpP3eWasmV2ExportFunction = (...args: number[]) => number;

export type SpP3eWasmV2Exports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  spp3eMemoryPtr: SpP3eWasmV2ExportFunction;
  spp3eRamPtr: SpP3eWasmV2ExportFunction;
  spp3eRomPtr: SpP3eWasmV2ExportFunction;
  spp3ePixelBufferPtr: SpP3eWasmV2ExportFunction;
  spp3eAudioSamplesPtr: SpP3eWasmV2ExportFunction;
  spp3eKeyboardLinesPtr: SpP3eWasmV2ExportFunction;
  spp3eDiskDataPtr: SpP3eWasmV2ExportFunction;
  spp3eDiskBDataPtr: SpP3eWasmV2ExportFunction;
  spp3eDiskChangesPtr: SpP3eWasmV2ExportFunction;
  spp3eDiskBChangesPtr: SpP3eWasmV2ExportFunction;
  spp3eTapeDataPtr: SpP3eWasmV2ExportFunction;
  spp3eTapeSaveDataPtr: SpP3eWasmV2ExportFunction;
  spp3eReset: SpP3eWasmV2ExportFunction;
  spp3eHardReset: SpP3eWasmV2ExportFunction;
  spp3eExecuteFrame: SpP3eWasmV2ExportFunction;
  spp3eExecuteInstruction: SpP3eWasmV2ExportFunction;
  spp3eRenderInstantScreen: SpP3eWasmV2ExportFunction;
  spp3eUploadRomByte: SpP3eWasmV2ExportFunction;
  spp3eReadMemory: SpP3eWasmV2ExportFunction;
  spp3eWriteMemory: SpP3eWasmV2ExportFunction;
  spp3eReadRamBank: SpP3eWasmV2ExportFunction;
  spp3eWriteRamBank: SpP3eWasmV2ExportFunction;
  spp3eReadRomBank: SpP3eWasmV2ExportFunction;
  spp3eReadScreenMemoryOffset: SpP3eWasmV2ExportFunction;
  spp3eReadFloatingBus: SpP3eWasmV2ExportFunction;
  spp3eSetKeyStatus: SpP3eWasmV2ExportFunction;
  spp3eReadPort: SpP3eWasmV2ExportFunction;
  spp3eWritePort: SpP3eWasmV2ExportFunction;
  spp3eGetMemorySize: SpP3eWasmV2ExportFunction;
  spp3eGetRamSize: SpP3eWasmV2ExportFunction;
  spp3eGetRomSize: SpP3eWasmV2ExportFunction;
  spp3eGetScreenWidth: SpP3eWasmV2ExportFunction;
  spp3eGetScreenHeight: SpP3eWasmV2ExportFunction;
  spp3eGetPixelBufferStartOffset: SpP3eWasmV2ExportFunction;
  spp3eGetAudioSampleCapacity: SpP3eWasmV2ExportFunction;
  spp3eGetAudioSampleCount: SpP3eWasmV2ExportFunction;
  spp3eGetAudioSampleRate: SpP3eWasmV2ExportFunction;
  spp3eSetAudioSampleRate: SpP3eWasmV2ExportFunction;
  spp3eGetDiskDataCapacity: SpP3eWasmV2ExportFunction;
  spp3eGetDiskChangeCapacity: SpP3eWasmV2ExportFunction;
  spp3eGetDiskDriveCount: SpP3eWasmV2ExportFunction;
  spp3eGetFdcEnabledDriveCount: SpP3eWasmV2ExportFunction;
  spp3eSetFdcEnabledDriveCount: SpP3eWasmV2ExportFunction;
  spp3eFdcResetController: SpP3eWasmV2ExportFunction;
  spp3eFdcGetMainStatusRegister: SpP3eWasmV2ExportFunction;
  spp3eFdcGetStatusRegister0: SpP3eWasmV2ExportFunction;
  spp3eFdcGetStatusRegister1: SpP3eWasmV2ExportFunction;
  spp3eFdcGetStatusRegister2: SpP3eWasmV2ExportFunction;
  spp3eFdcGetStatusRegister3: SpP3eWasmV2ExportFunction;
  spp3eFdcGetOperationPhase: SpP3eWasmV2ExportFunction;
  spp3eFdcGetCurrentDrive: SpP3eWasmV2ExportFunction;
  spp3eFdcGetResultBytesLeft: SpP3eWasmV2ExportFunction;
  spp3eFdcGetDataRegister: SpP3eWasmV2ExportFunction;
  spp3eFdcGetResultRegister: SpP3eWasmV2ExportFunction;
  spp3eFdcGetCommandId: SpP3eWasmV2ExportFunction;
  spp3eFdcGetCommandRegister: SpP3eWasmV2ExportFunction;
  spp3eFdcGetCommandBytesReceived: SpP3eWasmV2ExportFunction;
  spp3eFdcGetStepRate: SpP3eWasmV2ExportFunction;
  spp3eFdcGetHeadUnloadTime: SpP3eWasmV2ExportFunction;
  spp3eFdcGetHeadLoadTime: SpP3eWasmV2ExportFunction;
  spp3eFdcGetNonDmaMode: SpP3eWasmV2ExportFunction;
  spp3eFdcGetDirtyDrive: SpP3eWasmV2ExportFunction;
  spp3eFdcGetDirtyOffset: SpP3eWasmV2ExportFunction;
  spp3eFdcGetDirtyLength: SpP3eWasmV2ExportFunction;
  spp3eFdcGetDirtyRevision: SpP3eWasmV2ExportFunction;
  spp3eFdcSetResultPhase: SpP3eWasmV2ExportFunction;
  spp3eFdcSelectDrive: SpP3eWasmV2ExportFunction;
  spp3eDiskBeginUpload: SpP3eWasmV2ExportFunction;
  spp3eDiskWriteData: SpP3eWasmV2ExportFunction;
  spp3eDiskFinishUpload: SpP3eWasmV2ExportFunction;
  spp3eDiskEject: SpP3eWasmV2ExportFunction;
  spp3eDiskSetWriteProtected: SpP3eWasmV2ExportFunction;
  spp3eDiskReadData: SpP3eWasmV2ExportFunction;
  spp3eDiskGetLoaded: SpP3eWasmV2ExportFunction;
  spp3eDiskGetWriteProtected: SpP3eWasmV2ExportFunction;
  spp3eDiskGetSelected: SpP3eWasmV2ExportFunction;
  spp3eDiskGetHasTwoHeads: SpP3eWasmV2ExportFunction;
  spp3eDiskGetCurrentHead: SpP3eWasmV2ExportFunction;
  spp3eDiskGetTrack0: SpP3eWasmV2ExportFunction;
  spp3eDiskGetReady: SpP3eWasmV2ExportFunction;
  spp3eDiskGetMotorOn: SpP3eWasmV2ExportFunction;
  spp3eDiskGetMotorSpeed: SpP3eWasmV2ExportFunction;
  spp3eDiskGetCurrentCylinder: SpP3eWasmV2ExportFunction;
  spp3eDiskGetMaxCylinders: SpP3eWasmV2ExportFunction;
  spp3eDiskGetHeadLoaded: SpP3eWasmV2ExportFunction;
  spp3eDiskGetLength: SpP3eWasmV2ExportFunction;
  spp3eDiskGetRevision: SpP3eWasmV2ExportFunction;
  spp3eGetTapeMaxBlocks: SpP3eWasmV2ExportFunction;
  spp3eGetTapeDataCapacity: SpP3eWasmV2ExportFunction;
  spp3eGetTapeSaveMaxBlocks: SpP3eWasmV2ExportFunction;
  spp3eGetTapeSaveDataCapacity: SpP3eWasmV2ExportFunction;
  spp3eTapeClear: SpP3eWasmV2ExportFunction;
  spp3eTapeBeginUpload: SpP3eWasmV2ExportFunction;
  spp3eTapeSetBlock: SpP3eWasmV2ExportFunction;
  spp3eTapeWriteData: SpP3eWasmV2ExportFunction;
  spp3eTapeFinishUpload: SpP3eWasmV2ExportFunction;
  spp3eTapeRewind: SpP3eWasmV2ExportFunction;
  spp3eTapeSetMode: SpP3eWasmV2ExportFunction;
  spp3eTapeSetFastLoad: SpP3eWasmV2ExportFunction;
  spp3eTapeGetFastLoad: SpP3eWasmV2ExportFunction;
  spp3eTapeGetBlockCount: SpP3eWasmV2ExportFunction;
  spp3eTapeGetDataLength: SpP3eWasmV2ExportFunction;
  spp3eTapeGetLoaded: SpP3eWasmV2ExportFunction;
  spp3eTapeGetEof: SpP3eWasmV2ExportFunction;
  spp3eTapeGetUploadActive: SpP3eWasmV2ExportFunction;
  spp3eTapeGetMode: SpP3eWasmV2ExportFunction;
  spp3eTapeGetCurrentBlockIndex: SpP3eWasmV2ExportFunction;
  spp3eTapeGetCurrentEarBit: SpP3eWasmV2ExportFunction;
  spp3eTapeGetBlockOffset: SpP3eWasmV2ExportFunction;
  spp3eTapeGetBlockLength: SpP3eWasmV2ExportFunction;
  spp3eTapeGetBlockPauseAfter: SpP3eWasmV2ExportFunction;
  spp3eTapeClearSavedBlocks: SpP3eWasmV2ExportFunction;
  spp3eTapeAppendSavedByte: SpP3eWasmV2ExportFunction;
  spp3eTapeGetSavedBlockCount: SpP3eWasmV2ExportFunction;
  spp3eTapeGetSavedDataLength: SpP3eWasmV2ExportFunction;
  spp3eTapeGetSavedRevision: SpP3eWasmV2ExportFunction;
  spp3eTapeGetSavedBlockOffset: SpP3eWasmV2ExportFunction;
  spp3eTapeGetSavedBlockLength: SpP3eWasmV2ExportFunction;
  spp3eGetPsgRegisterIndex: SpP3eWasmV2ExportFunction;
  spp3eSetPsgRegisterIndex: SpP3eWasmV2ExportFunction;
  spp3eGetPsgRegisterValue: SpP3eWasmV2ExportFunction;
  spp3eWritePsgRegisterValue: SpP3eWasmV2ExportFunction;
  spp3eReadPsgRegisterValue: SpP3eWasmV2ExportFunction;
  spp3eGetPsgToneA: SpP3eWasmV2ExportFunction;
  spp3eGetPsgToneB: SpP3eWasmV2ExportFunction;
  spp3eGetPsgToneC: SpP3eWasmV2ExportFunction;
  spp3eGetPsgVolumeA: SpP3eWasmV2ExportFunction;
  spp3eGetPsgVolumeB: SpP3eWasmV2ExportFunction;
  spp3eGetPsgVolumeC: SpP3eWasmV2ExportFunction;
  spp3eGetPsgCurrentOutput: SpP3eWasmV2ExportFunction;
  spp3eGetTactsInFrame: SpP3eWasmV2ExportFunction;
  spp3eGetFrames: SpP3eWasmV2ExportFunction;
  spp3eGetTacts: SpP3eWasmV2ExportFunction;
  spp3eGetCurrentFrameTact: SpP3eWasmV2ExportFunction;
  spp3eGetFrameCompleted: SpP3eWasmV2ExportFunction;
  spp3eSetTacts: SpP3eWasmV2ExportFunction;
  spp3eGetSelectedRom: SpP3eWasmV2ExportFunction;
  spp3eGetSelectedBank: SpP3eWasmV2ExportFunction;
  spp3eGetPagingEnabled: SpP3eWasmV2ExportFunction;
  spp3eGetUseShadowScreen: SpP3eWasmV2ExportFunction;
  spp3eGetScreenBank: SpP3eWasmV2ExportFunction;
  spp3eGetInSpecialPagingMode: SpP3eWasmV2ExportFunction;
  spp3eGetSpecialConfigMode: SpP3eWasmV2ExportFunction;
  spp3eGetDiskMotorOn: SpP3eWasmV2ExportFunction;
  spp3eGetCurrentPartition: SpP3eWasmV2ExportFunction;
  spp3eGetRomFlag: SpP3eWasmV2ExportFunction;
  spp3eGetContentionValue: SpP3eWasmV2ExportFunction;
  spp3eSetContentionValue: SpP3eWasmV2ExportFunction;
  spp3eGetRenderingPhase: SpP3eWasmV2ExportFunction;
  spp3eGetRenderingPixelAddress: SpP3eWasmV2ExportFunction;
  spp3eGetRenderingAttributeAddress: SpP3eWasmV2ExportFunction;
  spp3eGetRenderingPixelIndex: SpP3eWasmV2ExportFunction;
  spp3eDelayAddressBusAccess: SpP3eWasmV2ExportFunction;
  spp3eDelayPortRead: SpP3eWasmV2ExportFunction;
  spp3eDelayPortWrite: SpP3eWasmV2ExportFunction;
  spp3eResetContentionCounters: SpP3eWasmV2ExportFunction;
  spp3eGetTotalContentionDelaySinceStart: SpP3eWasmV2ExportFunction;
  spp3eGetContentionDelaySincePause: SpP3eWasmV2ExportFunction;
  spp3eGetCpuInstructionsExecuted: SpP3eWasmV2ExportFunction;
  spp3eGetCpuFrameSliceInstructions: SpP3eWasmV2ExportFunction;
  spp3eGetInterruptsRaised: SpP3eWasmV2ExportFunction;
  spp3eGetInterruptLineActive: SpP3eWasmV2ExportFunction;
  spp3eGetCpuTacts: SpP3eWasmV2ExportFunction;
  spp3eGetCpuAf: SpP3eWasmV2ExportFunction;
  spp3eSetCpuAf: SpP3eWasmV2ExportFunction;
  spp3eGetCpuAfAlt: SpP3eWasmV2ExportFunction;
  spp3eSetCpuAfAlt: SpP3eWasmV2ExportFunction;
  spp3eGetCpuBcAlt: SpP3eWasmV2ExportFunction;
  spp3eSetCpuBcAlt: SpP3eWasmV2ExportFunction;
  spp3eGetCpuDeAlt: SpP3eWasmV2ExportFunction;
  spp3eSetCpuDeAlt: SpP3eWasmV2ExportFunction;
  spp3eGetCpuHlAlt: SpP3eWasmV2ExportFunction;
  spp3eSetCpuHlAlt: SpP3eWasmV2ExportFunction;
  spp3eGetCpuBc: SpP3eWasmV2ExportFunction;
  spp3eSetCpuBc: SpP3eWasmV2ExportFunction;
  spp3eGetCpuDe: SpP3eWasmV2ExportFunction;
  spp3eSetCpuDe: SpP3eWasmV2ExportFunction;
  spp3eGetCpuHl: SpP3eWasmV2ExportFunction;
  spp3eSetCpuHl: SpP3eWasmV2ExportFunction;
  spp3eGetCpuIx: SpP3eWasmV2ExportFunction;
  spp3eSetCpuIx: SpP3eWasmV2ExportFunction;
  spp3eGetCpuIy: SpP3eWasmV2ExportFunction;
  spp3eSetCpuIy: SpP3eWasmV2ExportFunction;
  spp3eGetCpuIr: SpP3eWasmV2ExportFunction;
  spp3eSetCpuIr: SpP3eWasmV2ExportFunction;
  spp3eGetCpuWz: SpP3eWasmV2ExportFunction;
  spp3eSetCpuWz: SpP3eWasmV2ExportFunction;
  spp3eGetCpuPc: SpP3eWasmV2ExportFunction;
  spp3eSetCpuPc: SpP3eWasmV2ExportFunction;
  spp3eGetCpuSp: SpP3eWasmV2ExportFunction;
  spp3eSetCpuSp: SpP3eWasmV2ExportFunction;
  spp3eGetCpuHalted: SpP3eWasmV2ExportFunction;
  spp3eGetCpuPrefix: SpP3eWasmV2ExportFunction;
  spp3eGetCpuIff1: SpP3eWasmV2ExportFunction;
  spp3eSetCpuIff1: SpP3eWasmV2ExportFunction;
  spp3eGetCpuIff2: SpP3eWasmV2ExportFunction;
  spp3eSetCpuIff2: SpP3eWasmV2ExportFunction;
  spp3eGetCpuInterruptMode: SpP3eWasmV2ExportFunction;
  spp3eSetCpuInterruptMode: SpP3eWasmV2ExportFunction;
  spp3eGetLastMemoryAddress: SpP3eWasmV2ExportFunction;
  spp3eGetLastMemoryValue: SpP3eWasmV2ExportFunction;
  spp3eGetLastMemoryIsWrite: SpP3eWasmV2ExportFunction;
  spp3eGetLastPortAddress: SpP3eWasmV2ExportFunction;
  spp3eGetLastPortValue: SpP3eWasmV2ExportFunction;
  spp3eGetLastPortIsWrite: SpP3eWasmV2ExportFunction;
  spp3eGetKeyboardLine: SpP3eWasmV2ExportFunction;
  spp3eGetPortFeValue: SpP3eWasmV2ExportFunction;
  spp3eGetBorderColor: SpP3eWasmV2ExportFunction;
  spp3eGetEarBit: SpP3eWasmV2ExportFunction;
  spp3eGetMicBit: SpP3eWasmV2ExportFunction;
  spp3eGetBeeperLevel: SpP3eWasmV2ExportFunction;
  spp3eGetLastContendedValue: SpP3eWasmV2ExportFunction;
  spp3eGetLastUlaReadValue: SpP3eWasmV2ExportFunction;
  spp3eSetLastContendedValue: SpP3eWasmV2ExportFunction;
  spp3eSetLastUlaReadValue: SpP3eWasmV2ExportFunction;
};

export type SpP3eWasmV2Instance = {
  readonly exports: SpP3eWasmV2Exports;
};

export type SpP3eWasmV2ArtifactReader = () => Promise<BufferSource>;
export type SpP3eWasmV2Compiler = (bytes: BufferSource) => Promise<WebAssembly.Module>;
export type SpP3eWasmV2Instantiator = (module: WebAssembly.Module) => Promise<SpP3eWasmV2Instance>;

export type SpP3eWasmV2LoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: SpP3eWasmV2ArtifactReader;
  readonly compile?: SpP3eWasmV2Compiler;
  readonly instantiate?: SpP3eWasmV2Instantiator;
};

export type SpP3eWasmV2Runtime = {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: SpP3eWasmV2Instance;
  readonly exports: SpP3eWasmV2Exports;
  readonly memoryBuffer: ArrayBuffer;
  readonly memory: Uint8Array;
  readonly ram: Uint8Array;
  readonly rom: Uint8Array;
  readonly pixelBuffer: Uint32Array;
  readonly pixelBufferBytes: Uint8ClampedArray;
  readonly keyboardLines: Uint8Array;
  readonly audioSamples: Int16Array;
  readonly diskData: Uint8Array;
  readonly diskBData: Uint8Array;
  readonly diskChanges: Uint8Array;
  readonly diskBChanges: Uint8Array;
  readonly tapeData: Uint8Array;
  readonly tapeSaveData: Uint8Array;
};

const requiredV2Exports = [
  "memory",
  "spp3eMemoryPtr",
  "spp3eRamPtr",
  "spp3eRomPtr",
  "spp3ePixelBufferPtr",
  "spp3eAudioSamplesPtr",
  "spp3eKeyboardLinesPtr",
  "spp3eDiskDataPtr",
  "spp3eDiskBDataPtr",
  "spp3eDiskChangesPtr",
  "spp3eDiskBChangesPtr",
  "spp3eTapeDataPtr",
  "spp3eTapeSaveDataPtr",
  "spp3eReset",
  "spp3eHardReset",
  "spp3eExecuteFrame",
  "spp3eExecuteInstruction",
  "spp3eRenderInstantScreen",
  "spp3eUploadRomByte",
  "spp3eReadMemory",
  "spp3eWriteMemory",
  "spp3eReadRamBank",
  "spp3eWriteRamBank",
  "spp3eReadRomBank",
  "spp3eReadScreenMemoryOffset",
  "spp3eReadFloatingBus",
  "spp3eSetKeyStatus",
  "spp3eReadPort",
  "spp3eWritePort",
  "spp3eGetMemorySize",
  "spp3eGetRamSize",
  "spp3eGetRomSize",
  "spp3eGetScreenWidth",
  "spp3eGetScreenHeight",
  "spp3eGetPixelBufferStartOffset",
  "spp3eGetAudioSampleCapacity",
  "spp3eGetAudioSampleCount",
  "spp3eGetAudioSampleRate",
  "spp3eSetAudioSampleRate",
  "spp3eGetDiskDataCapacity",
  "spp3eGetDiskChangeCapacity",
  "spp3eGetDiskDriveCount",
  "spp3eGetFdcEnabledDriveCount",
  "spp3eSetFdcEnabledDriveCount",
  "spp3eFdcResetController",
  "spp3eFdcGetMainStatusRegister",
  "spp3eFdcGetStatusRegister0",
  "spp3eFdcGetStatusRegister1",
  "spp3eFdcGetStatusRegister2",
  "spp3eFdcGetStatusRegister3",
  "spp3eFdcGetOperationPhase",
  "spp3eFdcGetCurrentDrive",
  "spp3eFdcGetResultBytesLeft",
  "spp3eFdcGetDataRegister",
  "spp3eFdcGetResultRegister",
  "spp3eFdcGetCommandId",
  "spp3eFdcGetCommandRegister",
  "spp3eFdcGetCommandBytesReceived",
  "spp3eFdcGetStepRate",
  "spp3eFdcGetHeadUnloadTime",
  "spp3eFdcGetHeadLoadTime",
  "spp3eFdcGetNonDmaMode",
  "spp3eFdcGetDirtyDrive",
  "spp3eFdcGetDirtyOffset",
  "spp3eFdcGetDirtyLength",
  "spp3eFdcGetDirtyRevision",
  "spp3eFdcSetResultPhase",
  "spp3eFdcSelectDrive",
  "spp3eDiskBeginUpload",
  "spp3eDiskWriteData",
  "spp3eDiskFinishUpload",
  "spp3eDiskEject",
  "spp3eDiskSetWriteProtected",
  "spp3eDiskReadData",
  "spp3eDiskGetLoaded",
  "spp3eDiskGetWriteProtected",
  "spp3eDiskGetSelected",
  "spp3eDiskGetHasTwoHeads",
  "spp3eDiskGetCurrentHead",
  "spp3eDiskGetTrack0",
  "spp3eDiskGetReady",
  "spp3eDiskGetMotorOn",
  "spp3eDiskGetMotorSpeed",
  "spp3eDiskGetCurrentCylinder",
  "spp3eDiskGetMaxCylinders",
  "spp3eDiskGetHeadLoaded",
  "spp3eDiskGetLength",
  "spp3eDiskGetRevision",
  "spp3eGetTapeMaxBlocks",
  "spp3eGetTapeDataCapacity",
  "spp3eGetTapeSaveMaxBlocks",
  "spp3eGetTapeSaveDataCapacity",
  "spp3eTapeClear",
  "spp3eTapeBeginUpload",
  "spp3eTapeSetBlock",
  "spp3eTapeWriteData",
  "spp3eTapeFinishUpload",
  "spp3eTapeRewind",
  "spp3eTapeSetMode",
  "spp3eTapeSetFastLoad",
  "spp3eTapeGetFastLoad",
  "spp3eTapeGetBlockCount",
  "spp3eTapeGetDataLength",
  "spp3eTapeGetLoaded",
  "spp3eTapeGetEof",
  "spp3eTapeGetUploadActive",
  "spp3eTapeGetMode",
  "spp3eTapeGetCurrentBlockIndex",
  "spp3eTapeGetCurrentEarBit",
  "spp3eTapeGetBlockOffset",
  "spp3eTapeGetBlockLength",
  "spp3eTapeGetBlockPauseAfter",
  "spp3eTapeClearSavedBlocks",
  "spp3eTapeAppendSavedByte",
  "spp3eTapeGetSavedBlockCount",
  "spp3eTapeGetSavedDataLength",
  "spp3eTapeGetSavedRevision",
  "spp3eTapeGetSavedBlockOffset",
  "spp3eTapeGetSavedBlockLength",
  "spp3eGetPsgRegisterIndex",
  "spp3eSetPsgRegisterIndex",
  "spp3eGetPsgRegisterValue",
  "spp3eWritePsgRegisterValue",
  "spp3eReadPsgRegisterValue",
  "spp3eGetPsgToneA",
  "spp3eGetPsgToneB",
  "spp3eGetPsgToneC",
  "spp3eGetPsgVolumeA",
  "spp3eGetPsgVolumeB",
  "spp3eGetPsgVolumeC",
  "spp3eGetPsgCurrentOutput",
  "spp3eGetTactsInFrame",
  "spp3eGetFrames",
  "spp3eGetTacts",
  "spp3eGetCurrentFrameTact",
  "spp3eGetFrameCompleted",
  "spp3eSetTacts",
  "spp3eGetSelectedRom",
  "spp3eGetSelectedBank",
  "spp3eGetPagingEnabled",
  "spp3eGetUseShadowScreen",
  "spp3eGetScreenBank",
  "spp3eGetInSpecialPagingMode",
  "spp3eGetSpecialConfigMode",
  "spp3eGetDiskMotorOn",
  "spp3eGetCurrentPartition",
  "spp3eGetRomFlag",
  "spp3eGetContentionValue",
  "spp3eSetContentionValue",
  "spp3eGetRenderingPhase",
  "spp3eGetRenderingPixelAddress",
  "spp3eGetRenderingAttributeAddress",
  "spp3eGetRenderingPixelIndex",
  "spp3eDelayAddressBusAccess",
  "spp3eDelayPortRead",
  "spp3eDelayPortWrite",
  "spp3eResetContentionCounters",
  "spp3eGetTotalContentionDelaySinceStart",
  "spp3eGetContentionDelaySincePause",
  "spp3eGetCpuInstructionsExecuted",
  "spp3eGetCpuFrameSliceInstructions",
  "spp3eGetInterruptsRaised",
  "spp3eGetInterruptLineActive",
  "spp3eGetCpuTacts",
  "spp3eGetCpuAf",
  "spp3eSetCpuAf",
  "spp3eGetCpuAfAlt",
  "spp3eSetCpuAfAlt",
  "spp3eGetCpuBcAlt",
  "spp3eSetCpuBcAlt",
  "spp3eGetCpuDeAlt",
  "spp3eSetCpuDeAlt",
  "spp3eGetCpuHlAlt",
  "spp3eSetCpuHlAlt",
  "spp3eGetCpuBc",
  "spp3eSetCpuBc",
  "spp3eGetCpuDe",
  "spp3eSetCpuDe",
  "spp3eGetCpuHl",
  "spp3eSetCpuHl",
  "spp3eGetCpuIx",
  "spp3eSetCpuIx",
  "spp3eGetCpuIy",
  "spp3eSetCpuIy",
  "spp3eGetCpuIr",
  "spp3eSetCpuIr",
  "spp3eGetCpuWz",
  "spp3eSetCpuWz",
  "spp3eGetCpuPc",
  "spp3eSetCpuPc",
  "spp3eGetCpuSp",
  "spp3eSetCpuSp",
  "spp3eGetCpuHalted",
  "spp3eGetCpuPrefix",
  "spp3eGetCpuIff1",
  "spp3eSetCpuIff1",
  "spp3eGetCpuIff2",
  "spp3eSetCpuIff2",
  "spp3eGetCpuInterruptMode",
  "spp3eSetCpuInterruptMode",
  "spp3eGetLastMemoryAddress",
  "spp3eGetLastMemoryValue",
  "spp3eGetLastMemoryIsWrite",
  "spp3eGetLastPortAddress",
  "spp3eGetLastPortValue",
  "spp3eGetLastPortIsWrite",
  "spp3eGetKeyboardLine",
  "spp3eGetPortFeValue",
  "spp3eGetBorderColor",
  "spp3eGetEarBit",
  "spp3eGetMicBit",
  "spp3eGetBeeperLevel",
  "spp3eGetLastContendedValue",
  "spp3eGetLastUlaReadValue",
  "spp3eSetLastContendedValue",
  "spp3eSetLastUlaReadValue"
] as const;

export function resetSpP3eWasmV2ModuleCache(): void {
  // --- Intentionally empty. During the +3E WASM rollout, always load the current artifact.
}

export async function loadSpP3eWasmV2(options: SpP3eWasmV2LoaderOptions = {}): Promise<SpP3eWasmV2Runtime> {
  const artifactName = options.artifactName ?? SPP3E_WASM_V2_ARTIFACT_NAME;
  const module = await getCompiledV2Module(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiateV2;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;

  validateSpP3eWasmV2Exports(wasmExports, artifactName);
  return {
    artifactName,
    module,
    instance,
    exports: wasmExports,
    ...createSpP3eWasmV2Views(wasmExports, artifactName)
  };
}

export function validateSpP3eWasmV2Exports(
  exports: Partial<SpP3eWasmV2Exports>,
  artifactName = SPP3E_WASM_V2_ARTIFACT_NAME
): void {
  for (const exportName of requiredV2Exports) {
    if (exportName === "memory") {
      if (!(exports.memory instanceof WebAssembly.Memory)) {
        throw new Error(`ZX Spectrum +3E WASM v2 artifact '${artifactName}' is missing WebAssembly memory.`);
      }
      continue;
    }

    if (typeof exports[exportName] !== "function") {
      throw new Error(`ZX Spectrum +3E WASM v2 artifact '${artifactName}' is missing export '${exportName}'.`);
    }
  }
}

export function createSpP3eWasmV2Views(
  exports: SpP3eWasmV2Exports,
  artifactName = SPP3E_WASM_V2_ARTIFACT_NAME
): Omit<SpP3eWasmV2Runtime, "artifactName" | "module" | "instance" | "exports"> {
  const memoryBuffer = exports.memory.buffer;
  const memorySize = exports.spp3eGetMemorySize();
  const ramSize = exports.spp3eGetRamSize();
  const romSize = exports.spp3eGetRomSize();
  const screenWidth = exports.spp3eGetScreenWidth();
  const screenHeight = exports.spp3eGetScreenHeight();
  const audioSampleCapacity = exports.spp3eGetAudioSampleCapacity();
  const diskDataCapacity = exports.spp3eGetDiskDataCapacity();
  const diskChangeCapacity = exports.spp3eGetDiskChangeCapacity();
  const tapeDataCapacity = exports.spp3eGetTapeDataCapacity();
  const tapeSaveDataCapacity = exports.spp3eGetTapeSaveDataCapacity();
  const pixelWords = screenWidth * screenHeight;
  const pixelBytes = pixelWords * 4;
  const audioWords = audioSampleCapacity * 2;

  assertViewRange(artifactName, "memory", exports.spp3eMemoryPtr(), memorySize, memoryBuffer);
  assertViewRange(artifactName, "ram", exports.spp3eRamPtr(), ramSize, memoryBuffer);
  assertViewRange(artifactName, "rom", exports.spp3eRomPtr(), romSize, memoryBuffer);
  assertViewRange(artifactName, "pixelBuffer", exports.spp3ePixelBufferPtr(), pixelBytes, memoryBuffer);
  assertViewRange(artifactName, "keyboardLines", exports.spp3eKeyboardLinesPtr(), SPP3E_WASM_V2_KEYBOARD_LINE_COUNT, memoryBuffer);
  assertViewRange(artifactName, "audioSamples", exports.spp3eAudioSamplesPtr(), audioWords * 2, memoryBuffer);
  assertViewRange(artifactName, "diskData", exports.spp3eDiskDataPtr(), diskDataCapacity, memoryBuffer);
  assertViewRange(artifactName, "diskBData", exports.spp3eDiskBDataPtr(), diskDataCapacity, memoryBuffer);
  assertViewRange(artifactName, "diskChanges", exports.spp3eDiskChangesPtr(), diskChangeCapacity, memoryBuffer);
  assertViewRange(artifactName, "diskBChanges", exports.spp3eDiskBChangesPtr(), diskChangeCapacity, memoryBuffer);
  assertViewRange(artifactName, "tapeData", exports.spp3eTapeDataPtr(), tapeDataCapacity, memoryBuffer);
  assertViewRange(artifactName, "tapeSaveData", exports.spp3eTapeSaveDataPtr(), tapeSaveDataCapacity, memoryBuffer);

  return {
    memoryBuffer,
    memory: new Uint8Array(memoryBuffer, exports.spp3eMemoryPtr(), memorySize),
    ram: new Uint8Array(memoryBuffer, exports.spp3eRamPtr(), ramSize),
    rom: new Uint8Array(memoryBuffer, exports.spp3eRomPtr(), romSize),
    pixelBuffer: new Uint32Array(memoryBuffer, exports.spp3ePixelBufferPtr(), pixelWords),
    pixelBufferBytes: new Uint8ClampedArray(memoryBuffer, exports.spp3ePixelBufferPtr(), pixelBytes),
    keyboardLines: new Uint8Array(memoryBuffer, exports.spp3eKeyboardLinesPtr(), SPP3E_WASM_V2_KEYBOARD_LINE_COUNT),
    audioSamples: new Int16Array(memoryBuffer, exports.spp3eAudioSamplesPtr(), audioWords),
    diskData: new Uint8Array(memoryBuffer, exports.spp3eDiskDataPtr(), diskDataCapacity),
    diskBData: new Uint8Array(memoryBuffer, exports.spp3eDiskBDataPtr(), diskDataCapacity),
    diskChanges: new Uint8Array(memoryBuffer, exports.spp3eDiskChangesPtr(), diskChangeCapacity),
    diskBChanges: new Uint8Array(memoryBuffer, exports.spp3eDiskBChangesPtr(), diskChangeCapacity),
    tapeData: new Uint8Array(memoryBuffer, exports.spp3eTapeDataPtr(), tapeDataCapacity),
    tapeSaveData: new Uint8Array(memoryBuffer, exports.spp3eTapeSaveDataPtr(), tapeSaveDataCapacity)
  };
}

async function getCompiledV2Module(
  artifactName: string,
  options: SpP3eWasmV2LoaderOptions
): Promise<WebAssembly.Module> {
  const readArtifact = options.readArtifact ?? (() => defaultReadV2Artifact(artifactName));
  const compile = options.compile ?? WebAssembly.compile;
  const bytes = await readArtifact();
  return compile(bytes);
}

async function defaultReadV2Artifact(artifactName: string): Promise<ArrayBuffer> {
  // Built via new URL("./dist/" + artifactName, import.meta.url), which is Vite's
  // supported dynamic-asset-URL pattern (see the "New URL Import Meta URL" section of
  // the Vite static-asset-handling guide). In a production build Vite content-hashes the
  // emitted file (e.g. '...-<hash>.wasm'), so the resolved URL will NOT end with
  // the literal artifactName - that is expected and does not mean the file is missing.
  // A genuinely missing/broken artifact is reported by the fetch() checks below instead.
  const artifactUrl = new URL(`./dist/${artifactName}`, import.meta.url);

  let response: Response;
  try {
    response = await fetch(artifactUrl);
  } catch (err) {
    throw new Error(
      `Cannot load ZX Spectrum +3E WASM v2 artifact '${artifactName}' from ${artifactUrl.toString()}: ` +
      `${err instanceof Error ? err.message : String(err)}. The packaged app may be missing its compiled WASM binaries.`
    );
  }
  if (!response.ok) {
    throw new Error(
      `Cannot load ZX Spectrum +3E WASM v2 artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`
    );
  }
  return response.arrayBuffer();
}

async function defaultInstantiateV2(module: WebAssembly.Module): Promise<SpP3eWasmV2Instance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as SpP3eWasmV2Exports };
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
      `ZX Spectrum +3E WASM v2 artifact '${artifactName}' exposes ${name} outside WASM memory: offset ${offset}, length ${byteLength}, memory ${memoryBuffer.byteLength}.`
    );
  }
}
