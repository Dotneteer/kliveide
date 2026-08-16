import type { MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { ZxNextWasmV2LoaderOptions, ZxNextWasmV2Runtime } from "./wasm/ZxNextWasmV2Loader";
import type { NextRegDeviceState } from "./NextRegDevice";

import { MC_MEM_SIZE } from "@common/machines/constants";
import { createMainApi } from "@common/messaging/MainApi";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { loadZxNextWasmV2 } from "./wasm/ZxNextWasmV2Loader";
import {
  OFFS_ALT_ROM_0,
  OFFS_ALT_ROM_1,
  OFFS_DIVMMC_RAM,
  OFFS_DIVMMC_ROM,
  OFFS_MULTIFACE_MEM,
  OFFS_NEXT_RAM,
  OFFS_NEXT_ROM
} from "./MemoryDevice";
import { ZxNextMachine } from "./ZxNextMachine";

const ZXNEXT_ROM_RESOURCES = [
  { kind: 0, filename: "roms/enNextZX.rom", offset: OFFS_NEXT_ROM },
  { kind: 1, filename: "roms/enNxtmmc.rom", offset: OFFS_DIVMMC_ROM },
  { kind: 2, filename: "roms/enNextMf.rom", offset: OFFS_MULTIFACE_MEM },
  { kind: 3, filename: "roms/enAltZX.rom", offset: OFFS_ALT_ROM_0 }
] as const;

const WASM_AUDIO_SAMPLE_SCALE = 32768.0;

export type ZxNextWasmV2Diagnostics = {
  backend: "wasm";
  engine: "v2";
  artifactName: string;
  frames: number;
  tacts: number;
  hardResets: number;
  resets: number;
  romUploads: number;
  uploadedRomMask: number;
  cpuInstructionsExecuted: number;
  frameCallCount: number;
  lastFrameInstructionsExecuted: number;
  frameTacts: number;
  currentFrameTact: number;
  cpuTactsPerFrame: number;
  cpuProgrammedSpeed: number;
  cpuEffectiveSpeed: number;
  cpuEffectiveClockMultiplier: number;
  cpuTactScale: number;
  cpuContentionDelaySinceStart: number;
  interruptLineValue: number;
  interruptIm2TopBits: number;
  interruptStacklessNmiEnabled: boolean;
  interruptHwIm2Mode: boolean;
  interruptNmiReturnAddress: number;
  interruptCtcEnabledMask: number;
  interruptCtcStatusMask: number;
  interruptCtcDmaEnableMask: number;
  interruptDaisyInServiceMask: number;
  interruptDmaRequestActive: boolean;
  paletteIndex: number;
  paletteControl: number;
  paletteSelected: number;
  paletteSecondUla: boolean;
  paletteSecondSprite: boolean;
  paletteEnableUlaNextMode: boolean;
  paletteSecondWrite: boolean;
  paletteStoredValue: number;
  timexPortValue: number;
  timexPortBits: number;
  ulaPlusMode: number;
  ulaPlusPaletteIndex: number;
  ulaPlusEnabled: boolean;
  layer2Enabled: boolean;
  layer2Resolution: number;
  layer2PaletteOffset: number;
  layer2ScrollX: number;
  layer2ScrollY: number;
  layer2ClipWindowX1: number;
  layer2ClipWindowX2: number;
  layer2ClipWindowY1: number;
  layer2ClipWindowY2: number;
  layer2ClipIndex: number;
  layer2ActiveRamBank: number;
  layer2ShadowRamBank: number;
  layer2UseShadowBank: boolean;
  layer2Bank: number;
  layer2BankOffset: number;
  layer2MappingReadsEnabled: boolean;
  layer2MappingWritesEnabled: boolean;
  globalTransparencyColor: number;
  layerPriority: number;
  fallbackColor: number;
  loResEnabled: boolean;
  loResRadastanMode: boolean;
  loResRadastanTimexXor: boolean;
  loResPaletteOffset: number;
  loResScrollX: number;
  loResScrollY: number;
  tilemapEnabled: boolean;
  tilemap80x32Resolution: boolean;
  tilemapEliminateAttributes: boolean;
  tilemapTextMode: boolean;
  tilemap512TileMode: boolean;
  tilemapForceOnTopOfUla: boolean;
  tilemapTransparencyIndex: number;
  tilemapClipIndex: number;
  tilemapClipWindowX1: number;
  tilemapClipWindowX2: number;
  tilemapClipWindowY1: number;
  tilemapClipWindowY2: number;
  tilemapScrollX: number;
  tilemapScrollY: number;
  tilemapUseBank7: boolean;
  tilemapBank5Msb: number;
  tilemapTileDefUseBank7: boolean;
  tilemapTileDefBank5Msb: number;
  tilemapPaletteOffset: number;
  tilemapXMirror: boolean;
  tilemapYMirror: boolean;
  tilemapRotate: boolean;
  tilemapUlaOver: boolean;
  tilemapDefaultAttr: number;
  paletteSecondTilemap: boolean;
  spriteMirrorTie: boolean;
  spriteMirrorQ: number;
  spriteMirrorIndex: number;
  spriteMirrorInc: boolean;
  sprite0OnTop: boolean;
  spriteClippingEnabled: boolean;
  spritesEnabled: boolean;
  spritesOverBorderEnabled: boolean;
  spriteClipIndex: number;
  spriteClipWindowX1: number;
  spriteClipWindowX2: number;
  spriteClipWindowY1: number;
  spriteClipWindowY2: number;
  spriteTransparencyIndex: number;
  spritePatternIndex: number;
  spritePatternSubIndex: number;
  spriteIndex: number;
  spriteSubIndex: number;
  spriteLastVisibleSpriteIndex: number;
  z80nMode: boolean;
  cpuPc: number;
  cpuSp: number;
  sramSize: number;
  romSize: number;
  configuredMemorySizeKb: number;
  mainRamPages: number;
  activeMemorySize: number;
  sentinelOffset: number;
  port7ffd: number;
  portDffd: number;
  port1ffd: number;
  portEff7: number;
  selectedRomPage: number;
  selectedRamBank: number;
  allRamMode: boolean;
  specialConfig: number;
  useShadowScreen: boolean;
  pagingEnabled: boolean;
  keyboardRowWrites: number;
  joystick1Mode: number;
  joystick2Mode: number;
  joystickIoModeEnabled: boolean;
  joystickIoMode: number;
  joystickIoModeParam: boolean;
  joystickLeftState: number;
  joystickRightState: number;
  joystickStateWriteCount: number;
  mouseX: number;
  mouseY: number;
  mouseWheel: number;
  mouseButtonLeft: boolean;
  mouseButtonRight: boolean;
  mouseButtonMiddle: boolean;
  mouseSwapButtons: boolean;
  mouseDpi: number;
  mouseStateWriteCount: number;
  uartSelected: number;
  uart0Prescaler: number;
  uart1Prescaler: number;
  uart0FrameRegister: number;
  uart1FrameRegister: number;
  uart0RxCount: number;
  uart1RxCount: number;
  uart0TxCount: number;
  uart1TxCount: number;
  uart0BreakCondition: boolean;
  uart1BreakCondition: boolean;
  uart0FramingError: boolean;
  uart1FramingError: boolean;
  uart0RxOverflow: boolean;
  uart1RxOverflow: boolean;
  uartTxWriteCount: number;
  uartRxInjectCount: number;
  i2cSclOut: boolean;
  i2cSdaOut: boolean;
  i2cSdaLine: boolean;
  i2cState: number;
  i2cRegPointer: number;
  i2cFrameCounter: number;
  i2cFramesPerSecond: number;
  i2cClockAdvanceCount: number;
  ulaBorderColor: number;
  ulaEarBit: boolean;
  ulaMicBit: boolean;
  ulaBeeperEar: boolean;
  ulaBeeperMic: boolean;
  audioSamples: number;
  dacA: number;
  dacB: number;
  dacC: number;
  dacD: number;
  dacLeftLevel: number;
  dacRightLevel: number;
  audioBeepOnlyToInternalSpeaker: boolean;
  audioPsgMode: number;
  audioAyStereoMode: boolean;
  audioEnableInternalSpeaker: boolean;
  audioEnable8BitDacs: boolean;
  audioSilenceHdmiAudio: boolean;
  audioEnableTurbosound: boolean;
  audioAy0MonoEnabled: boolean;
  audioAy1MonoEnabled: boolean;
  audioAy2MonoEnabled: boolean;
  psgSelectedChip: number;
  psgSelectedRegister: number;
  psgChip0Panning: number;
  psgChip1Panning: number;
  psgChip2Panning: number;
  psgMixerLeft: number;
  psgMixerRight: number;
  dmaMode: number;
  dmaSeq: number;
  dmaState: number;
  dmaBusState: number;
  dmaBusRequested: boolean;
  dmaBusAcknowledged: boolean;
  dmaEnabled: boolean;
  dmaStatus: number;
  dmaPortAStart: number;
  dmaPortBStart: number;
  dmaBlockLength: number;
  dmaAddressA: number;
  dmaAddressB: number;
  dmaByteCounter: number;
  dmaTransferCount: number;
  dmaBlockCompletionCount: number;
  dmaLastStepTicks: number;
  dmaTransferDataByte: number;
  dmaDirectionAtoB: boolean;
  dmaPortAIsIo: boolean;
  dmaPortBIsIo: boolean;
  dmaPortAAddressMode: number;
  dmaPortBAddressMode: number;
  dmaTransferMode: number;
  dmaAutoRestart: boolean;
  dmaPortBPrescaler: number;
  dmaForceReady: boolean;
  dmaInterruptPending: boolean;
  dmaVector: number;
  copperStartMode: number;
  copperInstructionAddress: number;
  copperStoredByte: number;
  copperListAddr: number;
  copperListData: number;
  copperDout: boolean;
  copperVerticalLineOffset: number;
  copperTickCount: number;
  copperWriteCount: number;
  ctcIm2VectorWrite: boolean;
  ctcLastSyncClock: number;
  ctcChannel0State: number;
  ctcChannel0ControlReg: number;
  ctcChannel0TimeConstant: number;
  ctcChannel0Count: number;
  ctcChannel0ZcTo: boolean;
  screenRenderingTacts: number;
  screenIntStartTact: number;
  screenIntEndTact: number;
  screenIs60Hz: boolean;
  screenRenderCount: number;
  screenNonBlankPixelCount: number;
  screenBank: number;
  divMmcEnabled: boolean;
  divMmcConmem: boolean;
  divMmcMapram: boolean;
  divMmcBank: number;
  divMmcPortE3: number;
  divMmcEnableAutomap: boolean;
  divMmcAutoMapActive: boolean;
  divMmcRstTrapEnabledMask: number;
  divMmcRstTrapOnlyWithRom3Mask: number;
  divMmcRstTrapInstantMask: number;
  divMmcEntry1: number;
  expansionEnabled: boolean;
  expansionRomcsReplacement: boolean;
  expansionDisableIoCycles: boolean;
  expansionDisableMemCycles: boolean;
  expansionSoftResetPersistence: number;
  expansionRomcsSignal: boolean;
  expansionRomcsClaimed: boolean;
  expansionExternalBusData: number;
  expansionNmiPending: boolean;
  expansionNmiAsserted: boolean;
  expansionIntPending: boolean;
  expansionIntActive: boolean;
  expansionUlaOverrideEnabled: boolean;
  expansionNmiDebounceDisabled: boolean;
  expansionClockAlwaysOn: boolean;
  expansionIoPropagate: number;
  multifaceType: number;
  multifaceEnabled: boolean;
  multifaceNmiActive: boolean;
  multifaceMfEnabled: boolean;
  multifaceInvisible: boolean;
  multifaceIsActive: boolean;
  multifaceNmiHold: boolean;
  multifaceEnablePortAddress: number;
  multifaceDisablePortAddress: number;
  multifaceMfPortEn: boolean;
  nmiState: number;
  nmiSourceMf: boolean;
  nmiSourceDivMmc: boolean;
  nmiSourceExpBus: boolean;
  pendingMfNmi: boolean;
  pendingDivMmcNmi: boolean;
  sigNmi: boolean;
  sdSelectedCard: number;
  sdPendingCommand: number;
  sdPendingSector: number;
  sdPendingCard: number;
  sdCommandCount: number;
  sdReadRequestCount: number;
  sdWriteRequestCount: number;
  sdResponseReady: boolean;
  sdResponseLength: number;
  sdResponseIndex: number;
  diagnosticFlags: number;
  unsupportedPortReadCount: number;
  unsupportedPortWriteCount: number;
  firstUnsupportedPortAddress: number;
  firstUnsupportedPortValue: number;
  firstUnsupportedPortIsWrite: boolean;
  firstUnsupportedPortOwnerStep: number;
};

/**
 * Minimal full-machine WASM v2 adapter skeleton for the ZX Spectrum Next.
 */
export class ZxNextWasmV2Machine extends ZxNextMachine {
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: ZxNextWasmV2Runtime;
  private readonly wasmV2RomBytes = new Map<number, Uint8Array>();
  private readonly wasmV2AudioSamples: AudioSample[] = [];
  private readonly wasmV2KeyboardRows = new Uint8Array(8);
  private readonly wasmV2ExtendedKeyRegs = new Uint8Array(3);
  private readonly wasmV2JoystickState = new Uint8Array(2);
  private readonly wasmV2MouseState = new Uint8Array(8);
  private wasmV2KeyboardRowsValid = false;
  private wasmV2ExtendedKeyRegsValid = false;
  private wasmV2JoystickStateValid = false;
  private wasmV2MouseStateValid = false;
  private wasmV2NextRegBridgeAttached = false;
  private wasmV2SdCardInfoLoaded = false;

  constructor(
    public readonly requestedModelInfo?: MachineModel,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: ZxNextWasmV2LoaderOptions
  ) {
    super(requestedModelInfo, messenger);
  }

  override async setup(): Promise<void> {
    this.wasmV2Runtime = await loadZxNextWasmV2(this.wasmV2LoaderOptions);
    const runtime = this.requireWasmV2Runtime();

    for (const resource of ZXNEXT_ROM_RESOURCES) {
      const bytes = await this.loadRomFromFile(resource.filename);
      this.wasmV2RomBytes.set(resource.kind, bytes);
      this.memoryDevice.upload(bytes, resource.offset);
    }

    this.configureWasmV2MemorySize(runtime);
    runtime.exports.zxnextHardReset();
    this.invalidateWasmV2InputSync();
    this.syncI2cCmosToWasmV2(runtime);
    this.replayRomBytesToWasmV2(runtime);
    this.attachWasmV2NextRegBridge(runtime);
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.zxnextHardReset();
      this.invalidateWasmV2InputSync();
      this.syncI2cCmosToWasmV2(this.wasmV2Runtime);
      this.replayRomBytesToWasmV2(this.wasmV2Runtime);
    }
  }

  override reset(): void {
    super.reset();
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.zxnextReset();
      this.invalidateWasmV2InputSync();
      this.syncI2cCmosToWasmV2(this.wasmV2Runtime);
      this.replayRomBytesToWasmV2(this.wasmV2Runtime);
    }
  }

  getWasmV2Diagnostics(): ZxNextWasmV2Diagnostics {
    const runtime = this.requireWasmV2Runtime();
    return {
      backend: "wasm",
      engine: "v2",
      artifactName: runtime.artifactName,
      frames: runtime.exports.zxnextGetFrames(),
      tacts: runtime.exports.zxnextGetTacts(),
      hardResets: runtime.exports.zxnextGetHardResetCount(),
      resets: runtime.exports.zxnextGetResetCount(),
      romUploads: runtime.exports.zxnextGetRomUploadCount(),
      uploadedRomMask: runtime.exports.zxnextGetUploadedRomMask(),
      cpuInstructionsExecuted: runtime.exports.zxnextGetCpuInstructionsExecuted(),
      frameCallCount: runtime.exports.zxnextGetFrameCallCount(),
      lastFrameInstructionsExecuted: runtime.exports.zxnextGetLastFrameInstructionsExecuted(),
      frameTacts: runtime.exports.zxnextGetFrameTacts(),
      currentFrameTact: runtime.exports.zxnextGetCurrentFrameTact(),
      cpuTactsPerFrame: runtime.exports.zxnextGetCpuTactsPerFrame(),
      cpuProgrammedSpeed: runtime.exports.zxnextGetCpuProgrammedSpeed(),
      cpuEffectiveSpeed: runtime.exports.zxnextGetCpuEffectiveSpeed(),
      cpuEffectiveClockMultiplier: runtime.exports.zxnextGetCpuEffectiveClockMultiplier(),
      cpuTactScale: runtime.exports.zxnextGetCpuTactScale(),
      cpuContentionDelaySinceStart: runtime.exports.zxnextGetCpuContentionDelaySinceStart(),
      interruptLineValue: runtime.exports.zxnextGetInterruptLineValue(),
      interruptIm2TopBits: runtime.exports.zxnextGetInterruptIm2TopBits(),
      interruptStacklessNmiEnabled: runtime.exports.zxnextGetInterruptStacklessNmiEnabled() !== 0,
      interruptHwIm2Mode: runtime.exports.zxnextGetInterruptHwIm2Mode() !== 0,
      interruptNmiReturnAddress: runtime.exports.zxnextGetInterruptNmiReturnAddress(),
      interruptCtcEnabledMask: runtime.exports.zxnextGetInterruptCtcEnabledMask(),
      interruptCtcStatusMask: runtime.exports.zxnextGetInterruptCtcStatusMask(),
      interruptCtcDmaEnableMask: runtime.exports.zxnextGetInterruptCtcDmaEnableMask(),
      interruptDaisyInServiceMask: runtime.exports.zxnextGetDaisyInServiceMask(),
      interruptDmaRequestActive: runtime.exports.zxnextGetDmaInterruptRequestActive() !== 0,
      paletteIndex: runtime.exports.zxnextGetPaletteIndex(),
      paletteControl: runtime.exports.zxnextGetPaletteControl(),
      paletteSelected: runtime.exports.zxnextGetPaletteSelected(),
      paletteSecondUla: runtime.exports.zxnextGetPaletteSecondUla() !== 0,
      paletteSecondSprite: runtime.exports.zxnextGetPaletteSecondSprite() !== 0,
      paletteEnableUlaNextMode: runtime.exports.zxnextGetPaletteEnableUlaNextMode() !== 0,
      paletteSecondWrite: runtime.exports.zxnextGetPaletteSecondWrite() !== 0,
      paletteStoredValue: runtime.exports.zxnextGetPaletteStoredValue(),
      timexPortValue: runtime.exports.zxnextGetTimexPortValue(),
      timexPortBits: runtime.exports.zxnextGetTimexPortBits(),
      ulaPlusMode: runtime.exports.zxnextGetUlaPlusMode(),
      ulaPlusPaletteIndex: runtime.exports.zxnextGetUlaPlusPaletteIndex(),
      ulaPlusEnabled: runtime.exports.zxnextGetUlaPlusEnabled() !== 0,
      layer2Enabled: runtime.exports.zxnextGetLayer2Enabled() !== 0,
      layer2Resolution: runtime.exports.zxnextGetLayer2Resolution(),
      layer2PaletteOffset: runtime.exports.zxnextGetLayer2PaletteOffset(),
      layer2ScrollX: runtime.exports.zxnextGetLayer2ScrollX(),
      layer2ScrollY: runtime.exports.zxnextGetLayer2ScrollY(),
      layer2ClipWindowX1: runtime.exports.zxnextGetLayer2ClipWindowX1(),
      layer2ClipWindowX2: runtime.exports.zxnextGetLayer2ClipWindowX2(),
      layer2ClipWindowY1: runtime.exports.zxnextGetLayer2ClipWindowY1(),
      layer2ClipWindowY2: runtime.exports.zxnextGetLayer2ClipWindowY2(),
      layer2ClipIndex: runtime.exports.zxnextGetLayer2ClipIndex(),
      layer2ActiveRamBank: runtime.exports.zxnextGetLayer2ActiveRamBank(),
      layer2ShadowRamBank: runtime.exports.zxnextGetLayer2ShadowRamBank(),
      layer2UseShadowBank: runtime.exports.zxnextGetLayer2UseShadowBank() !== 0,
      layer2Bank: runtime.exports.zxnextGetLayer2Bank(),
      layer2BankOffset: runtime.exports.zxnextGetLayer2BankOffset(),
      layer2MappingReadsEnabled: runtime.exports.zxnextGetLayer2MappingReadsEnabled() !== 0,
      layer2MappingWritesEnabled: runtime.exports.zxnextGetLayer2MappingWritesEnabled() !== 0,
      globalTransparencyColor: runtime.exports.zxnextGetGlobalTransparencyColor(),
      layerPriority: runtime.exports.zxnextGetLayerPriority(),
      fallbackColor: runtime.exports.zxnextGetFallbackColor(),
      loResEnabled: runtime.exports.zxnextGetLoResEnabled() !== 0,
      loResRadastanMode: runtime.exports.zxnextGetLoResRadastanMode() !== 0,
      loResRadastanTimexXor: runtime.exports.zxnextGetLoResRadastanTimexXor() !== 0,
      loResPaletteOffset: runtime.exports.zxnextGetLoResPaletteOffset(),
      loResScrollX: runtime.exports.zxnextGetLoResScrollX(),
      loResScrollY: runtime.exports.zxnextGetLoResScrollY(),
      tilemapEnabled: runtime.exports.zxnextGetTilemapEnabled() !== 0,
      tilemap80x32Resolution: runtime.exports.zxnextGetTilemap80x32Resolution() !== 0,
      tilemapEliminateAttributes: runtime.exports.zxnextGetTilemapEliminateAttributes() !== 0,
      tilemapTextMode: runtime.exports.zxnextGetTilemapTextMode() !== 0,
      tilemap512TileMode: runtime.exports.zxnextGetTilemap512TileMode() !== 0,
      tilemapForceOnTopOfUla: runtime.exports.zxnextGetTilemapForceOnTopOfUla() !== 0,
      tilemapTransparencyIndex: runtime.exports.zxnextGetTilemapTransparencyIndex(),
      tilemapClipIndex: runtime.exports.zxnextGetTilemapClipIndex(),
      tilemapClipWindowX1: runtime.exports.zxnextGetTilemapClipWindowX1(),
      tilemapClipWindowX2: runtime.exports.zxnextGetTilemapClipWindowX2(),
      tilemapClipWindowY1: runtime.exports.zxnextGetTilemapClipWindowY1(),
      tilemapClipWindowY2: runtime.exports.zxnextGetTilemapClipWindowY2(),
      tilemapScrollX: runtime.exports.zxnextGetTilemapScrollX(),
      tilemapScrollY: runtime.exports.zxnextGetTilemapScrollY(),
      tilemapUseBank7: runtime.exports.zxnextGetTilemapUseBank7() !== 0,
      tilemapBank5Msb: runtime.exports.zxnextGetTilemapBank5Msb(),
      tilemapTileDefUseBank7: runtime.exports.zxnextGetTilemapTileDefUseBank7() !== 0,
      tilemapTileDefBank5Msb: runtime.exports.zxnextGetTilemapTileDefBank5Msb(),
      tilemapPaletteOffset: runtime.exports.zxnextGetTilemapPaletteOffset(),
      tilemapXMirror: runtime.exports.zxnextGetTilemapXMirror() !== 0,
      tilemapYMirror: runtime.exports.zxnextGetTilemapYMirror() !== 0,
      tilemapRotate: runtime.exports.zxnextGetTilemapRotate() !== 0,
      tilemapUlaOver: runtime.exports.zxnextGetTilemapUlaOver() !== 0,
      tilemapDefaultAttr: runtime.exports.zxnextGetTilemapDefaultAttr(),
      paletteSecondTilemap: runtime.exports.zxnextGetPaletteSecondTilemap() !== 0,
      spriteMirrorTie: runtime.exports.zxnextGetSpriteMirrorTie() !== 0,
      spriteMirrorQ: runtime.exports.zxnextGetSpriteMirrorQ(),
      spriteMirrorIndex: runtime.exports.zxnextGetSpriteMirrorIndex(),
      spriteMirrorInc: runtime.exports.zxnextGetSpriteMirrorInc() !== 0,
      sprite0OnTop: runtime.exports.zxnextGetSprite0OnTop() !== 0,
      spriteClippingEnabled: runtime.exports.zxnextGetSpriteClippingEnabled() !== 0,
      spritesEnabled: runtime.exports.zxnextGetSpritesEnabled() !== 0,
      spritesOverBorderEnabled: runtime.exports.zxnextGetSpritesOverBorderEnabled() !== 0,
      spriteClipIndex: runtime.exports.zxnextGetSpriteClipIndex(),
      spriteClipWindowX1: runtime.exports.zxnextGetSpriteClipWindowX1(),
      spriteClipWindowX2: runtime.exports.zxnextGetSpriteClipWindowX2(),
      spriteClipWindowY1: runtime.exports.zxnextGetSpriteClipWindowY1(),
      spriteClipWindowY2: runtime.exports.zxnextGetSpriteClipWindowY2(),
      spriteTransparencyIndex: runtime.exports.zxnextGetSpriteTransparencyIndex(),
      spritePatternIndex: runtime.exports.zxnextGetSpritePatternIndex(),
      spritePatternSubIndex: runtime.exports.zxnextGetSpritePatternSubIndex(),
      spriteIndex: runtime.exports.zxnextGetSpriteIndex(),
      spriteSubIndex: runtime.exports.zxnextGetSpriteSubIndex(),
      spriteLastVisibleSpriteIndex: runtime.exports.zxnextGetSpriteLastVisibleSpriteIndex(),
      z80nMode: runtime.exports.zxnextGetZ80NMode() !== 0,
      cpuPc: runtime.exports.zxnextGetCpuPc(),
      cpuSp: runtime.exports.zxnextGetCpuSp(),
      sramSize: runtime.exports.zxnextGetSramSize(),
      romSize: runtime.exports.zxnextGetRomSize(),
      configuredMemorySizeKb: runtime.exports.zxnextGetConfiguredMemorySizeKb(),
      mainRamPages: runtime.exports.zxnextGetMainRamPageCount(),
      activeMemorySize: runtime.exports.zxnextGetActiveMemorySize(),
      sentinelOffset: runtime.exports.zxnextGetSentinelOffset(),
      port7ffd: runtime.exports.zxnextGetPort7ffdValue(),
      portDffd: runtime.exports.zxnextGetPortDffdValue(),
      port1ffd: runtime.exports.zxnextGetPort1ffdValue(),
      portEff7: runtime.exports.zxnextGetPortEff7Value(),
      selectedRomPage: runtime.exports.zxnextGetSelectedRomPage(),
      selectedRamBank: runtime.exports.zxnextGetSelectedRamBank(),
      allRamMode: runtime.exports.zxnextGetAllRamMode() !== 0,
      specialConfig: runtime.exports.zxnextGetSpecialConfig(),
      useShadowScreen: runtime.exports.zxnextGetUseShadowScreen() !== 0,
      pagingEnabled: runtime.exports.zxnextGetPagingEnabled() !== 0,
      keyboardRowWrites: runtime.exports.zxnextGetKeyboardRowWrites(),
      joystick1Mode: runtime.exports.zxnextGetJoystick1Mode(),
      joystick2Mode: runtime.exports.zxnextGetJoystick2Mode(),
      joystickIoModeEnabled: runtime.exports.zxnextGetJoystickIoModeEnabled() !== 0,
      joystickIoMode: runtime.exports.zxnextGetJoystickIoMode(),
      joystickIoModeParam: runtime.exports.zxnextGetJoystickIoModeParam() !== 0,
      joystickLeftState: runtime.exports.zxnextGetJoystickLeftState(),
      joystickRightState: runtime.exports.zxnextGetJoystickRightState(),
      joystickStateWriteCount: runtime.exports.zxnextGetJoystickStateWriteCount(),
      mouseX: runtime.exports.zxnextGetMouseX(),
      mouseY: runtime.exports.zxnextGetMouseY(),
      mouseWheel: runtime.exports.zxnextGetMouseWheel(),
      mouseButtonLeft: runtime.exports.zxnextGetMouseButtonLeft() !== 0,
      mouseButtonRight: runtime.exports.zxnextGetMouseButtonRight() !== 0,
      mouseButtonMiddle: runtime.exports.zxnextGetMouseButtonMiddle() !== 0,
      mouseSwapButtons: runtime.exports.zxnextGetMouseSwapButtons() !== 0,
      mouseDpi: runtime.exports.zxnextGetMouseDpi(),
      mouseStateWriteCount: runtime.exports.zxnextGetMouseStateWriteCount(),
      uartSelected: runtime.exports.zxnextGetUartSelected(),
      uart0Prescaler: runtime.exports.zxnextGetUartPrescaler(0),
      uart1Prescaler: runtime.exports.zxnextGetUartPrescaler(1),
      uart0FrameRegister: runtime.exports.zxnextGetUartFrameRegister(0),
      uart1FrameRegister: runtime.exports.zxnextGetUartFrameRegister(1),
      uart0RxCount: runtime.exports.zxnextGetUartRxCount(0),
      uart1RxCount: runtime.exports.zxnextGetUartRxCount(1),
      uart0TxCount: runtime.exports.zxnextGetUartTxCount(0),
      uart1TxCount: runtime.exports.zxnextGetUartTxCount(1),
      uart0BreakCondition: runtime.exports.zxnextGetUartBreakCondition(0) !== 0,
      uart1BreakCondition: runtime.exports.zxnextGetUartBreakCondition(1) !== 0,
      uart0FramingError: runtime.exports.zxnextGetUartFramingError(0) !== 0,
      uart1FramingError: runtime.exports.zxnextGetUartFramingError(1) !== 0,
      uart0RxOverflow: runtime.exports.zxnextGetUartRxOverflow(0) !== 0,
      uart1RxOverflow: runtime.exports.zxnextGetUartRxOverflow(1) !== 0,
      uartTxWriteCount: runtime.exports.zxnextGetUartTxWriteCount(),
      uartRxInjectCount: runtime.exports.zxnextGetUartRxInjectCount(),
      i2cSclOut: runtime.exports.zxnextGetI2cSclOut() !== 0,
      i2cSdaOut: runtime.exports.zxnextGetI2cSdaOut() !== 0,
      i2cSdaLine: runtime.exports.zxnextGetI2cSdaLine() !== 0,
      i2cState: runtime.exports.zxnextGetI2cState(),
      i2cRegPointer: runtime.exports.zxnextGetI2cRegPointer(),
      i2cFrameCounter: runtime.exports.zxnextGetI2cFrameCounter(),
      i2cFramesPerSecond: runtime.exports.zxnextGetI2cFramesPerSecond(),
      i2cClockAdvanceCount: runtime.exports.zxnextGetI2cClockAdvanceCount(),
      ulaBorderColor: runtime.exports.zxnextGetUlaBorderColor(),
      ulaEarBit: runtime.exports.zxnextGetUlaEarBit() !== 0,
      ulaMicBit: runtime.exports.zxnextGetUlaMicBit() !== 0,
      ulaBeeperEar: runtime.exports.zxnextGetUlaBeeperEar() !== 0,
      ulaBeeperMic: runtime.exports.zxnextGetUlaBeeperMic() !== 0,
      audioSamples: runtime.exports.zxnextGetAudioSampleCount(),
      dacA: runtime.exports.zxnextGetDacChannel(0),
      dacB: runtime.exports.zxnextGetDacChannel(1),
      dacC: runtime.exports.zxnextGetDacChannel(2),
      dacD: runtime.exports.zxnextGetDacChannel(3),
      dacLeftLevel: runtime.exports.zxnextGetDacLeftLevel(),
      dacRightLevel: runtime.exports.zxnextGetDacRightLevel(),
      audioBeepOnlyToInternalSpeaker: runtime.exports.zxnextGetAudioBeepOnlyToInternalSpeaker() !== 0,
      audioPsgMode: runtime.exports.zxnextGetAudioPsgMode(),
      audioAyStereoMode: runtime.exports.zxnextGetAudioAyStereoMode() !== 0,
      audioEnableInternalSpeaker: runtime.exports.zxnextGetAudioEnableInternalSpeaker() !== 0,
      audioEnable8BitDacs: runtime.exports.zxnextGetAudioEnable8BitDacs() !== 0,
      audioSilenceHdmiAudio: runtime.exports.zxnextGetAudioSilenceHdmiAudio() !== 0,
      audioEnableTurbosound: runtime.exports.zxnextGetAudioEnableTurbosound() !== 0,
      audioAy0MonoEnabled: runtime.exports.zxnextGetAudioAyMonoEnable(0) !== 0,
      audioAy1MonoEnabled: runtime.exports.zxnextGetAudioAyMonoEnable(1) !== 0,
      audioAy2MonoEnabled: runtime.exports.zxnextGetAudioAyMonoEnable(2) !== 0,
      psgSelectedChip: runtime.exports.zxnextGetPsgSelectedChip(),
      psgSelectedRegister: runtime.exports.zxnextGetPsgSelectedRegister(),
      psgChip0Panning: runtime.exports.zxnextGetPsgPanning(0),
      psgChip1Panning: runtime.exports.zxnextGetPsgPanning(1),
      psgChip2Panning: runtime.exports.zxnextGetPsgPanning(2),
      psgMixerLeft: runtime.exports.zxnextGetPsgMixerLeft(),
      psgMixerRight: runtime.exports.zxnextGetPsgMixerRight(),
      dmaMode: runtime.exports.zxnextGetDmaMode(),
      dmaSeq: runtime.exports.zxnextGetDmaSeq(),
      dmaState: runtime.exports.zxnextGetDmaState(),
      dmaBusState: runtime.exports.zxnextGetDmaBusState(),
      dmaBusRequested: runtime.exports.zxnextGetDmaBusRequested() !== 0,
      dmaBusAcknowledged: runtime.exports.zxnextGetDmaBusAcknowledged() !== 0,
      dmaEnabled: runtime.exports.zxnextGetDmaEnabled() !== 0,
      dmaStatus: runtime.exports.zxnextGetDmaStatus(),
      dmaPortAStart: runtime.exports.zxnextGetDmaPortAStart(),
      dmaPortBStart: runtime.exports.zxnextGetDmaPortBStart(),
      dmaBlockLength: runtime.exports.zxnextGetDmaBlockLength(),
      dmaAddressA: runtime.exports.zxnextGetDmaAddressA(),
      dmaAddressB: runtime.exports.zxnextGetDmaAddressB(),
      dmaByteCounter: runtime.exports.zxnextGetDmaByteCounter(),
      dmaTransferCount: runtime.exports.zxnextGetDmaTransferCount(),
      dmaBlockCompletionCount: runtime.exports.zxnextGetDmaBlockCompletionCount(),
      dmaLastStepTicks: runtime.exports.zxnextGetDmaLastStepTicks(),
      dmaTransferDataByte: runtime.exports.zxnextGetDmaTransferDataByte(),
      dmaDirectionAtoB: runtime.exports.zxnextGetDmaDirectionAtoB() !== 0,
      dmaPortAIsIo: runtime.exports.zxnextGetDmaPortAIsIo() !== 0,
      dmaPortBIsIo: runtime.exports.zxnextGetDmaPortBIsIo() !== 0,
      dmaPortAAddressMode: runtime.exports.zxnextGetDmaPortAAddressMode(),
      dmaPortBAddressMode: runtime.exports.zxnextGetDmaPortBAddressMode(),
      dmaTransferMode: runtime.exports.zxnextGetDmaTransferMode(),
      dmaAutoRestart: runtime.exports.zxnextGetDmaAutoRestart() !== 0,
      dmaPortBPrescaler: runtime.exports.zxnextGetDmaPortBPrescaler(),
      dmaForceReady: runtime.exports.zxnextGetDmaForceReady() !== 0,
      dmaInterruptPending: runtime.exports.zxnextGetDmaInterruptPending() !== 0,
      dmaVector: runtime.exports.zxnextGetDmaVector(),
      copperStartMode: runtime.exports.zxnextGetCopperStartMode(),
      copperInstructionAddress: runtime.exports.zxnextGetCopperInstructionAddress(),
      copperStoredByte: runtime.exports.zxnextGetCopperStoredByte(),
      copperListAddr: runtime.exports.zxnextGetCopperListAddr(),
      copperListData: runtime.exports.zxnextGetCopperListData(),
      copperDout: runtime.exports.zxnextGetCopperDout() !== 0,
      copperVerticalLineOffset: runtime.exports.zxnextGetCopperVerticalLineOffset(),
      copperTickCount: runtime.exports.zxnextGetCopperTickCount(),
      copperWriteCount: runtime.exports.zxnextGetCopperWriteCount(),
      ctcIm2VectorWrite: runtime.exports.zxnextGetCtcIm2VectorWrite() !== 0,
      ctcLastSyncClock: runtime.exports.zxnextGetCtcLastSyncClock(),
      ctcChannel0State: runtime.exports.zxnextGetCtcChannelState(0),
      ctcChannel0ControlReg: runtime.exports.zxnextGetCtcControlReg(0),
      ctcChannel0TimeConstant: runtime.exports.zxnextGetCtcTimeConstant(0),
      ctcChannel0Count: runtime.exports.zxnextGetCtcCount(0),
      ctcChannel0ZcTo: runtime.exports.zxnextGetCtcZcTo(0) !== 0,
      screenRenderingTacts: runtime.exports.zxnextGetScreenRenderingTacts(),
      screenIntStartTact: runtime.exports.zxnextGetScreenIntStartTact(),
      screenIntEndTact: runtime.exports.zxnextGetScreenIntEndTact(),
      screenIs60Hz: runtime.exports.zxnextGetScreenIs60Hz() !== 0,
      screenRenderCount: runtime.exports.zxnextGetScreenRenderCount(),
      screenNonBlankPixelCount: runtime.exports.zxnextGetScreenNonBlankPixelCount(),
      screenBank: runtime.exports.zxnextGetScreenBank(),
      divMmcEnabled: runtime.exports.zxnextGetDivMmcEnabled() !== 0,
      divMmcConmem: runtime.exports.zxnextGetDivMmcConmem() !== 0,
      divMmcMapram: runtime.exports.zxnextGetDivMmcMapram() !== 0,
      divMmcBank: runtime.exports.zxnextGetDivMmcBank(),
      divMmcPortE3: runtime.exports.zxnextGetDivMmcPortE3Value(),
      divMmcEnableAutomap: runtime.exports.zxnextGetDivMmcEnableAutomap() !== 0,
      divMmcAutoMapActive: runtime.exports.zxnextGetDivMmcAutoMapActive() !== 0,
      divMmcRstTrapEnabledMask: runtime.exports.zxnextGetDivMmcRstTrapEnabledMask(),
      divMmcRstTrapOnlyWithRom3Mask: runtime.exports.zxnextGetDivMmcRstTrapOnlyWithRom3Mask(),
      divMmcRstTrapInstantMask: runtime.exports.zxnextGetDivMmcRstTrapInstantMask(),
      divMmcEntry1: runtime.exports.zxnextGetDivMmcEntry1(),
      expansionEnabled: runtime.exports.zxnextGetExpansionEnabled() !== 0,
      expansionRomcsReplacement: runtime.exports.zxnextGetExpansionRomcsReplacement() !== 0,
      expansionDisableIoCycles: runtime.exports.zxnextGetExpansionDisableIoCycles() !== 0,
      expansionDisableMemCycles: runtime.exports.zxnextGetExpansionDisableMemCycles() !== 0,
      expansionSoftResetPersistence: runtime.exports.zxnextGetExpansionSoftResetPersistence(),
      expansionRomcsSignal: runtime.exports.zxnextGetExpansionRomcsSignal() !== 0,
      expansionRomcsClaimed: runtime.exports.zxnextGetExpansionRomcsClaimed() !== 0,
      expansionExternalBusData: runtime.exports.zxnextGetExpansionExternalBusData(),
      expansionNmiPending: runtime.exports.zxnextGetExpansionNmiPending() !== 0,
      expansionNmiAsserted: runtime.exports.zxnextGetExpansionNmiAsserted() !== 0,
      expansionIntPending: runtime.exports.zxnextGetExpansionIntPending() !== 0,
      expansionIntActive: runtime.exports.zxnextGetExpansionIntActive() !== 0,
      expansionUlaOverrideEnabled: runtime.exports.zxnextGetExpansionUlaOverrideEnabled() !== 0,
      expansionNmiDebounceDisabled: runtime.exports.zxnextGetExpansionNmiDebounceDisabled() !== 0,
      expansionClockAlwaysOn: runtime.exports.zxnextGetExpansionClockAlwaysOn() !== 0,
      expansionIoPropagate: runtime.exports.zxnextGetExpansionIoPropagate(),
      multifaceType: runtime.exports.zxnextGetMultifaceType(),
      multifaceEnabled: runtime.exports.zxnextGetMultifaceEnabled() !== 0,
      multifaceNmiActive: runtime.exports.zxnextGetMultifaceNmiActive() !== 0,
      multifaceMfEnabled: runtime.exports.zxnextGetMultifaceMfEnabled() !== 0,
      multifaceInvisible: runtime.exports.zxnextGetMultifaceInvisible() !== 0,
      multifaceIsActive: runtime.exports.zxnextGetMultifaceIsActive() !== 0,
      multifaceNmiHold: runtime.exports.zxnextGetMultifaceNmiHold() !== 0,
      multifaceEnablePortAddress: runtime.exports.zxnextGetMultifaceEnablePortAddress(),
      multifaceDisablePortAddress: runtime.exports.zxnextGetMultifaceDisablePortAddress(),
      multifaceMfPortEn: runtime.exports.zxnextGetMultifaceMfPortEn() !== 0,
      nmiState: runtime.exports.zxnextGetNmiState(),
      nmiSourceMf: runtime.exports.zxnextGetNmiSourceMf() !== 0,
      nmiSourceDivMmc: runtime.exports.zxnextGetNmiSourceDivMmc() !== 0,
      nmiSourceExpBus: runtime.exports.zxnextGetNmiSourceExpBus() !== 0,
      pendingMfNmi: runtime.exports.zxnextGetPendingMfNmi() !== 0,
      pendingDivMmcNmi: runtime.exports.zxnextGetPendingDivMmcNmi() !== 0,
      sigNmi: runtime.exports.zxnextGetSigNmi() !== 0,
      sdSelectedCard: runtime.exports.zxnextGetSdSelectedCard(),
      sdPendingCommand: runtime.exports.zxnextGetSdPendingCommand(),
      sdPendingSector: runtime.exports.zxnextGetSdPendingSector(),
      sdPendingCard: runtime.exports.zxnextGetSdPendingCard(),
      sdCommandCount: runtime.exports.zxnextGetSdCommandCount(),
      sdReadRequestCount: runtime.exports.zxnextGetSdReadRequestCount(),
      sdWriteRequestCount: runtime.exports.zxnextGetSdWriteRequestCount(),
      sdResponseReady: runtime.exports.zxnextGetSdResponseReady(runtime.exports.zxnextGetSdSelectedCard()) !== 0,
      sdResponseLength: runtime.exports.zxnextGetSdResponseLength(runtime.exports.zxnextGetSdSelectedCard()),
      sdResponseIndex: runtime.exports.zxnextGetSdResponseIndex(runtime.exports.zxnextGetSdSelectedCard()),
      diagnosticFlags: runtime.exports.zxnextGetDiagnosticFlags(),
      unsupportedPortReadCount: runtime.exports.zxnextGetUnsupportedPortReadCount(),
      unsupportedPortWriteCount: runtime.exports.zxnextGetUnsupportedPortWriteCount(),
      firstUnsupportedPortAddress: runtime.exports.zxnextGetFirstUnsupportedPortAddress(),
      firstUnsupportedPortValue: runtime.exports.zxnextGetFirstUnsupportedPortValue(),
      firstUnsupportedPortIsWrite: runtime.exports.zxnextGetFirstUnsupportedPortIsWrite() !== 0,
      firstUnsupportedPortOwnerStep: runtime.exports.zxnextGetFirstUnsupportedPortOwnerStep()
    };
  }

  override readScreenMemory(offset: number): number {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return super.readScreenMemory(offset);
    return runtime.exports.zxnextReadScreenMemoryOffset(offset & 0x3fff);
  }

  override get screenWidthInPixels(): number {
    return this.wasmV2Runtime?.exports.zxnextGetScreenWidth() ?? super.screenWidthInPixels;
  }

  override get screenHeightInPixels(): number {
    return this.wasmV2Runtime?.exports.zxnextGetScreenHeight() ?? super.screenHeightInPixels;
  }

  override getPixelBuffer(): Uint32Array {
    return this.wasmV2Runtime?.pixelBuffer ?? super.getPixelBuffer();
  }

  override getPixelBufferBytes(): Uint8ClampedArray {
    const runtime = this.requireWasmV2Runtime();
    return runtime.pixelBufferBytes;
  }

  override renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    const runtime = this.requireWasmV2Runtime();
    const pixels = runtime.pixelBuffer;
    const snapshot = new Uint32Array(pixels);
    if (savedPixelBuffer != null) {
      pixels.set(savedPixelBuffer.subarray(0, pixels.length));
    } else {
      runtime.exports.zxnextRenderInstantScreen();
    }
    return snapshot;
  }

  override getBufferStartOffset(): number {
    return this.wasmV2Runtime == null ? super.getBufferStartOffset() : 0;
  }

  override getAudioSamples(): AudioSample[] {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return super.getAudioSamples();
    runtime.exports.zxnextGenerateAudioFrameSamples();
    const words = runtime.audioSamples;
    const sampleCount = runtime.exports.zxnextGetAudioSampleCount();
    this.wasmV2AudioSamples.length = 0;
    for (let i = 0; i < sampleCount; i++) {
      this.wasmV2AudioSamples.push({
        left: words[i * 2] / WASM_AUDIO_SAMPLE_SCALE,
        right: words[i * 2 + 1] / WASM_AUDIO_SAMPLE_SCALE
      });
    }
    return this.wasmV2AudioSamples;
  }

  override get64KFlatMemory(): Uint8Array {
    return this.wasmV2Runtime?.memory ?? super.get64KFlatMemory();
  }

  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return super.getMemoryPartition(index);
    const wasm = runtime.exports;
    if (index >= 0 && index < wasm.zxnextGetMainRamPageCount()) {
      return this.readWasmV2PhysicalSlice(runtime, OFFS_NEXT_RAM + index * 0x2000, 0x2000);
    }
    switch (index) {
      case -1:
      case -2:
      case -3:
      case -4:
        return this.readWasmV2PhysicalSlice(runtime, OFFS_NEXT_ROM + (-index - 1) * 0x4000, 0x4000);
      case -5:
        return this.readWasmV2PhysicalSlice(runtime, OFFS_ALT_ROM_0, 0x4000);
      case -6:
        return this.readWasmV2PhysicalSlice(runtime, OFFS_ALT_ROM_1, 0x4000);
      case -7:
        return this.readWasmV2PhysicalSlice(runtime, OFFS_DIVMMC_ROM, 0x2000);
      default:
        if (index >= -23 && index <= -8) {
          return this.readWasmV2PhysicalSlice(runtime, OFFS_DIVMMC_RAM + (-index - 8) * 0x2000, 0x2000);
        }
        return this.readWasmV2PhysicalSlice(runtime, wasm.zxnextGetSentinelOffset(), 0x2000);
    }
  }

  override getCurrentPartitions(): number[] {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return super.getCurrentPartitions();
    const wasm = runtime.exports;
    return Array.from({ length: 8 }, (_, index) => wasm.zxnextGetCurrentPartition(index));
  }

  override getPartition(address: number): number | undefined {
    return this.getCurrentPartitions()[(address >>> 13) & 0x07];
  }

  override getSelectedRomPage(): number {
    return this.wasmV2Runtime?.exports.zxnextGetSelectedRomPage() ?? super.getSelectedRomPage();
  }

  override getSelectedRamBank(): number {
    return this.wasmV2Runtime?.exports.zxnextGetSelectedRamBank() ?? super.getSelectedRamBank();
  }

  override doReadMemory(address: number): number {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return super.doReadMemory(address);
    const value = runtime.exports.zxnextReadMemory(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override doWriteMemory(address: number, value: number): void {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) {
      super.doWriteMemory(address, value);
      return;
    }
    runtime.exports.zxnextWriteMemory(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override doWritePort(address: number, value: number): void {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) {
      super.doWritePort(address, value);
      return;
    }
    if (isTypeScriptOwnedFdcPort(address)) {
      super.doWritePort(address, value);
      return;
    }
    if (isWasmV2SpiPort(address)) {
      runtime.exports.zxnextWritePort(address & 0xffff, value & 0xff);
      this.syncSdFrameCommandFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
      return;
    }
    super.doWritePort(address, value);
    runtime.exports.zxnextWritePort(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override doReadPort(address: number): number {
    const runtime = this.wasmV2Runtime;
    if (runtime == null || !isWasmV2OwnedPort(address)) return super.doReadPort(address);
    if (isWasmV2UlaPort(address)) this.syncKeyboardToWasmV2(runtime);
    if (isWasmV2NextRegPort(address)) this.syncExtendedKeyboardToWasmV2(runtime);
    if (isWasmV2GameInputPort(address)) this.syncGameInputToWasmV2(runtime);
    const value = runtime.exports.zxnextReadPort(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override executeMachineFrame(): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    this.syncKeyboardToWasmV2(runtime);
    this.syncExtendedKeyboardToWasmV2(runtime);
    this.syncGameInputToWasmV2(runtime);

    if (this.executionContext.debugStepMode === DebugStepMode.StepInto) {
      runtime.exports.zxnextExecuteInstruction();
      this.syncFrameCountersFromWasmV2(runtime, false);
      this.syncCpuFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
      return (this.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent);
    }

    runtime.exports.zxnextExecuteFrame();
    this.syncSdFrameCommandFromWasmV2(runtime);
    this.syncFrameCountersFromWasmV2(runtime, true);
    this.floppyDevice.onFrameCompleted();
    this.importWasmV2BusAccess(runtime);
    return (this.executionContext.lastTerminationReason = FrameTerminationMode.Normal);
  }

  override async processFrameCommand(messenger: MessengerBase): Promise<void> {
    const runtime = this.wasmV2Runtime;
    const frameCommand = this.getFrameCommand();
    if (runtime == null || frameCommand == null || !isWasmV2SdFrameCommand(frameCommand.command)) {
      await super.processFrameCommand(messenger);
      return;
    }

    const api = createMainApi(messenger);
    await this.ensureWasmV2SdCardInfo(runtime, api);
    try {
      switch (frameCommand.command) {
        case "sd-read":
        case "sd-read-card1": {
          const sectorData = await this.withWasmV2IpcTimeout(
            api.readSdCardSector(frameCommand.sector),
            frameCommand.command
          );
          const bytes = sectorData instanceof Uint8Array
            ? sectorData
            : Array.isArray(sectorData)
              ? new Uint8Array(sectorData)
              : new Uint8Array(sectorData as any);
          for (let i = 0; i < bytes.length && i < 512; i++) {
            runtime.exports.zxnextSetSdReadResponseByte(i, bytes[i]);
          }
          runtime.exports.zxnextCommitSdReadResponse(frameCommand.command === "sd-read-card1" ? 1 : 0);
          break;
        }
        case "sd-write":
        case "sd-write-card1": {
          const result = await this.withWasmV2IpcTimeout(
            api.writeSdCardSector(frameCommand.sector, frameCommand.data),
            frameCommand.command
          );
          runtime.exports.zxnextSetSdWriteResponse(
            frameCommand.command === "sd-write-card1" ? 1 : 0,
            result?.persistenceConfirmed ? 1 : 0
          );
          break;
        }
      }
    } catch {
      if (frameCommand.command === "sd-write" || frameCommand.command === "sd-write-card1") {
        runtime.exports.zxnextSetSdWriteResponse(frameCommand.command === "sd-write-card1" ? 1 : 0, 0);
      }
    } finally {
      runtime.exports.zxnextClearSdPendingCommand();
    }
  }

  override tbblueOut(address: number, value: number): void {
    super.tbblueOut(address, value);
  }

  protected override getInterruptVector(): number {
    const runtime = this.wasmV2Runtime;
    if (runtime == null || runtime.exports.zxnextGetInterruptHwIm2Mode() === 0) return super.getInterruptVector();
    return runtime.exports.zxnextDaisyPeekInterruptVector();
  }

  override onInterruptAcknowledged(): void {
    const runtime = this.wasmV2Runtime;
    if (runtime == null || runtime.exports.zxnextGetInterruptHwIm2Mode() === 0) {
      super.onInterruptAcknowledged();
      return;
    }
    runtime.exports.zxnextDaisyAcknowledge();
  }

  override shouldRaiseInterrupt(): boolean {
    const runtime = this.wasmV2Runtime;
    if (runtime == null || runtime.exports.zxnextGetInterruptHwIm2Mode() === 0) {
      return super.shouldRaiseInterrupt();
    }
    return runtime.exports.zxnextDaisyUpdateIrqState() !== 0;
  }

  override getCpuState(): any {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncCpuFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
    }
    return super.getCpuState();
  }

  private replayRomBytesToWasmV2(runtime: ZxNextWasmV2Runtime): void {
    for (const [kind, bytes] of this.wasmV2RomBytes) {
      for (let offset = 0; offset < bytes.length; offset++) {
        if (runtime.exports.zxnextUploadRomByte(kind, offset, bytes[offset]) === 0) {
          throw new Error(`ZX Spectrum Next WASM v2 ROM upload failed for kind ${kind} at ${offset}.`);
        }
      }
    }
  }

  private configureWasmV2MemorySize(runtime: ZxNextWasmV2Runtime): void {
    const configured = this.requestedModelInfo?.config?.[MC_MEM_SIZE];
    if (typeof configured !== "number") return;
    runtime.exports.zxnextConfigureMemorySize(configured);
  }

  private syncI2cCmosToWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const cmos = this.i2cDevice.cmos;
    for (let index = 0; index < cmos.length; index++) {
      runtime.exports.zxnextSetI2cCmosByte(index, cmos[index]);
    }
  }

  private attachWasmV2NextRegBridge(runtime: ZxNextWasmV2Runtime): void {
    if (this.wasmV2NextRegBridgeAttached) return;
    this.wasmV2NextRegBridgeAttached = true;
    const device = this.nextRegDevice;
    const originalSetIndex = device.setNextRegisterIndex.bind(device);
    const originalGetIndex = device.getNextRegisterIndex.bind(device);
    const originalSetValue = device.setNextRegisterValue.bind(device);
    const originalGetValue = device.getNextRegisterValue.bind(device);
    const originalDirectGet = device.directGetRegValue.bind(device);
    const originalDirectSet = device.directSetRegValue.bind(device);
    const originalHardReset = device.hardReset.bind(device);
    const originalReset = device.reset.bind(device);
    const originalGetState = device.getNextRegDeviceState.bind(device);

    device.setNextRegisterIndex = (reg: number): void => {
      originalSetIndex(reg);
      runtime.exports.zxnextSetNextRegIndex(reg & 0xff);
    };
    device.getNextRegisterIndex = (): number => {
      return runtime.exports.zxnextGetNextRegIndex();
    };
    device.setNextRegisterValue = (value: number): void => {
      originalSetValue(value);
      runtime.exports.zxnextWriteNextRegData(value & 0xff);
    };
    device.getNextRegisterValue = (): number => {
      const index = runtime.exports.zxnextGetNextRegIndex();
      originalGetIndex();
      originalGetValue();
      if (isWasmV2ExtendedKeyboardReg(index)) this.syncExtendedKeyboardToWasmV2(runtime);
      if (isWasmV2InputNextReg(index)) this.syncGameInputToWasmV2(runtime);
      return runtime.exports.zxnextReadNextRegData();
    };
    device.directGetRegValue = (reg: number): number => {
      originalDirectGet(reg);
      if (isWasmV2ExtendedKeyboardReg(reg)) this.syncExtendedKeyboardToWasmV2(runtime);
      if (isWasmV2InputNextReg(reg)) this.syncGameInputToWasmV2(runtime);
      return runtime.exports.zxnextReadNextReg(reg & 0xff);
    };
    device.directSetRegValue = (reg: number, value: number): void => {
      originalDirectSet(reg, value);
      runtime.exports.zxnextWriteNextReg(reg & 0xff, value & 0xff);
    };
    device.hardReset = (): void => {
      originalHardReset();
      runtime.exports.zxnextNextRegHardReset();
    };
    device.reset = (): void => {
      originalReset();
      runtime.exports.zxnextNextRegReset();
    };
    device.isPortGroupEnabled = (regIndex: number, bit: number): boolean => {
      return runtime.exports.zxnextIsPortGroupEnabled(regIndex & 0x03, bit & 0x07) !== 0;
    };
    device.getNextRegDeviceState = (): NextRegDeviceState => {
      this.syncExtendedKeyboardToWasmV2(runtime);
      this.syncGameInputToWasmV2(runtime);
      const state = originalGetState();
      return {
        lastRegisterIndex: runtime.exports.zxnextGetNextRegIndex(),
        regs: state.regs.map((reg) => ({
          id: reg.id,
          lastWrite: runtime.exports.zxnextGetNextRegHasLastWrite(reg.id) !== 0
            ? runtime.exports.zxnextGetNextRegLastWrite(reg.id)
            : undefined,
          value: reg.value == null ? undefined : runtime.exports.zxnextReadNextReg(reg.id)
        }))
      };
    };
  }

  private readWasmV2PhysicalSlice(runtime: ZxNextWasmV2Runtime, offset: number, length: number): Uint8Array {
    const result = new Uint8Array(length);
    const wasm = runtime.exports;
    for (let i = 0; i < length; i++) {
      result[i] = wasm.zxnextReadPhysical(offset + i);
    }
    return result;
  }

  private invalidateWasmV2InputSync(): void {
    this.wasmV2KeyboardRowsValid = false;
    this.wasmV2ExtendedKeyRegsValid = false;
    this.wasmV2JoystickStateValid = false;
    this.wasmV2MouseStateValid = false;
    this.wasmV2KeyboardRows.fill(0);
    this.wasmV2ExtendedKeyRegs.fill(0);
    this.wasmV2JoystickState.fill(0);
    this.wasmV2MouseState.fill(0);
  }

  private syncKeyboardToWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    for (let line = 0; line < this.wasmV2KeyboardRows.length; line++) {
      const rowValue = this.keyboardDevice.getKeyLineValue(line) & 0x1f;
      if (this.wasmV2KeyboardRowsValid && this.wasmV2KeyboardRows[line] === rowValue) continue;
      this.wasmV2KeyboardRows[line] = rowValue;
      wasm.zxnextSetKeyboardRow(line, rowValue);
    }
    this.wasmV2KeyboardRowsValid = true;
  }

  private syncExtendedKeyboardToWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    const keyboard = this.keyboardDevice;
    const values = [
      keyboard.nextRegB0Value & 0xff,
      keyboard.nextRegB1Value & 0xff,
      keyboard.nextRegB2Value & 0xff
    ];
    for (let index = 0; index < values.length; index++) {
      if (this.wasmV2ExtendedKeyRegsValid && this.wasmV2ExtendedKeyRegs[index] === values[index]) continue;
      this.wasmV2ExtendedKeyRegs[index] = values[index];
      wasm.zxnextSetExtendedKeyReg(index, values[index]);
    }
    this.wasmV2ExtendedKeyRegsValid = true;
  }

  private syncGameInputToWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    const joystickLeft = this.joystickDevice.leftState & 0xff;
    const joystickRight = this.joystickDevice.rightState & 0xff;
    if (
      !this.wasmV2JoystickStateValid ||
      this.wasmV2JoystickState[0] !== joystickLeft ||
      this.wasmV2JoystickState[1] !== joystickRight
    ) {
      this.wasmV2JoystickState[0] = joystickLeft;
      this.wasmV2JoystickState[1] = joystickRight;
      wasm.zxnextSetJoystickState(joystickLeft, joystickRight);
      this.wasmV2JoystickStateValid = true;
    }

    const mouse = this.mouseDevice;
    const mouseValues = [
      mouse.xPos & 0xff,
      mouse.yPos & 0xff,
      mouse.wheelZ & 0x0f,
      mouse.buttonLeft ? 1 : 0,
      mouse.buttonRight ? 1 : 0,
      mouse.buttonMiddle ? 1 : 0,
      mouse.swapButtons ? 1 : 0,
      mouse.dpi & 0x03
    ];
    let mouseChanged = !this.wasmV2MouseStateValid;
    for (let i = 0; i < mouseValues.length; i++) {
      if (this.wasmV2MouseState[i] === mouseValues[i]) continue;
      this.wasmV2MouseState[i] = mouseValues[i];
      mouseChanged = true;
    }
    if (mouseChanged) {
      wasm.zxnextSetMouseState(
        mouseValues[0],
        mouseValues[1],
        mouseValues[2],
        mouseValues[3],
        mouseValues[4],
        mouseValues[5],
        mouseValues[6],
        mouseValues[7]
      );
      this.wasmV2MouseStateValid = true;
    }
  }

  private syncFrameCountersFromWasmV2(runtime: ZxNextWasmV2Runtime, completedFrame: boolean): void {
    const wasm = runtime.exports;
    this.frames = wasm.zxnextGetFrames();
    this.tacts = wasm.zxnextGetTacts();
    this.frameTacts = wasm.zxnextGetFrameTacts();
    this.currentFrameTact = wasm.zxnextGetCurrentFrameTact();
    this.frameCompleted = completedFrame;
  }

  private syncSdFrameCommandFromWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    const pendingCommand = wasm.zxnextGetSdPendingCommand();
    if (pendingCommand === 0 || this.getFrameCommand() != null) return;
    const card = wasm.zxnextGetSdPendingCard();
    const sector = wasm.zxnextGetSdPendingSector();
    if (pendingCommand === 1) {
      this.setFrameCommand({
        command: card === 1 ? "sd-read-card1" : "sd-read",
        sector
      });
      return;
    }
    if (pendingCommand === 2) {
      const data = runtime.sdCommandBuffer.slice(6, 6 + 512);
      this.setFrameCommand({
        command: card === 1 ? "sd-write-card1" : "sd-write",
        sector,
        data
      });
    }
  }

  private async ensureWasmV2SdCardInfo(
    runtime: ZxNextWasmV2Runtime,
    api: ReturnType<typeof createMainApi>
  ): Promise<void> {
    if (this.wasmV2SdCardInfoLoaded) return;
    try {
      const info = await this.withWasmV2IpcTimeout(api.getSdCardInfo(), "getSdCardInfo");
      runtime.exports.zxnextSetSdCardInfo(0, info.totalSectors);
      this.wasmV2SdCardInfoLoaded = true;
    } catch (err) {
      console.warn("WASM SD card info fetch failed, using default CSD", err);
    }
  }

  private withWasmV2IpcTimeout<T>(promise: Promise<T>, operationName: string): Promise<T> {
    const timeoutMs = 5000;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`IPC timeout: ${operationName} did not complete within ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  private requireWasmV2Runtime(): ZxNextWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("ZX Spectrum Next WASM v2 runtime has not been loaded.");
    }
    return this.wasmV2Runtime;
  }

  private syncCpuFromWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.af = wasm.zxnextGetCpuAf();
    this.bc = wasm.zxnextGetCpuBc();
    this.de = wasm.zxnextGetCpuDe();
    this.hl = wasm.zxnextGetCpuHl();
    this.af_ = wasm.zxnextGetCpuAfAlt();
    this.bc_ = wasm.zxnextGetCpuBcAlt();
    this.de_ = wasm.zxnextGetCpuDeAlt();
    this.hl_ = wasm.zxnextGetCpuHlAlt();
    this.ix = wasm.zxnextGetCpuIx();
    this.iy = wasm.zxnextGetCpuIy();
    this.ir = wasm.zxnextGetCpuIr();
    this.wz = wasm.zxnextGetCpuWz();
    this.pc = wasm.zxnextGetCpuPc();
    this.sp = wasm.zxnextGetCpuSp();
    this.tacts = wasm.zxnextGetTacts();
    this.halted = wasm.zxnextGetCpuHalted() !== 0;
    this.iff1 = wasm.zxnextGetCpuIff1() !== 0;
    this.iff2 = wasm.zxnextGetCpuIff2() !== 0;
    this.interruptMode = wasm.zxnextGetCpuInterruptMode();
    this.opCode = wasm.zxnextGetCpuPrefix();
  }

  private importWasmV2BusAccess(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastMemoryReadsCount = 0;
    if (wasm.zxnextGetLastMemoryIsWrite() !== 0) {
      this.lastMemoryWrites[0] = wasm.zxnextGetLastMemoryAddress();
      this.lastMemoryWriteValue = wasm.zxnextGetLastMemoryValue();
    } else {
      this.lastMemoryReads[0] = wasm.zxnextGetLastMemoryAddress();
      this.lastMemoryReadValue = wasm.zxnextGetLastMemoryValue();
      this.lastMemoryReadsCount = wasm.zxnextGetLastMemoryAddress() !== 0 || wasm.zxnextGetLastMemoryValue() !== 0 ? 1 : 0;
    }
    if (wasm.zxnextGetLastPortIsWrite() !== 0) {
      this.lastIoWritePort = wasm.zxnextGetLastPortAddress();
      this.lastIoWriteValue = wasm.zxnextGetLastPortValue();
    } else {
      this.lastIoReadPort = wasm.zxnextGetLastPortAddress();
      this.lastIoReadValue = wasm.zxnextGetLastPortValue();
    }
  }
}

function isWasmV2NextRegPort(address: number): boolean {
  const port = address & 0xffff;
  return port === 0x243b || port === 0x253b;
}

function isWasmV2ExtendedKeyboardReg(reg: number): boolean {
  const maskedReg = reg & 0xff;
  return maskedReg >= 0xb0 && maskedReg <= 0xb2;
}

function isWasmV2InputNextReg(reg: number): boolean {
  const maskedReg = reg & 0xff;
  return maskedReg === 0x0a || maskedReg === 0x0b;
}

function isWasmV2UlaPort(address: number): boolean {
  return (address & 0x0001) === 0x0000;
}

function isWasmV2SpiPort(address: number): boolean {
  const port = address & 0xffff;
  return port === 0x00e7 || port === 0x00eb;
}

function isWasmV2TimexUlaPlusPort(address: number): boolean {
  const port = address & 0xffff;
  return port === 0x00ff || port === 0xbf3b || port === 0xff3b;
}

function isWasmV2OwnedPort(address: number): boolean {
  return isWasmV2UlaPort(address) ||
    isWasmV2NextRegPort(address) ||
    isWasmV2SpiPort(address) ||
    isWasmV2TimexUlaPlusPort(address) ||
    isWasmV2Layer2Port(address) ||
    isWasmV2AyPort(address) ||
    isWasmV2DmaPort(address) ||
    isWasmV2CtcPort(address) ||
    isWasmV2MultifacePort(address) ||
    isWasmV2GameInputPort(address) ||
    isWasmV2PeripheralPort(address) ||
    isWasmV2SpritePort(address) ||
    (address & 0xffff) === 0x00e3;
}

function isWasmV2Layer2Port(address: number): boolean {
  return (address & 0xffff) === 0x123b;
}

function isWasmV2SpritePort(address: number): boolean {
  const port = address & 0xffff;
  return port === 0x303b || (port & 0x00ff) === 0x0057 || (port & 0x00ff) === 0x005b;
}

function isWasmV2AyPort(address: number): boolean {
  const port = address & 0xffff;
  return port === 0xfffd || port === 0xbffd || port === 0xbff5;
}

function isWasmV2DmaPort(address: number): boolean {
  const port = address & 0x00ff;
  return port === 0x0b || port === 0x6b;
}

function isWasmV2CtcPort(address: number): boolean {
  return (address & 0xf8ff) === 0x183b;
}

function isWasmV2MultifacePort(address: number): boolean {
  const lowByte = address & 0x00ff;
  return lowByte === 0x1f || lowByte === 0x3f || lowByte === 0x9f || lowByte === 0xbf;
}

function isWasmV2GameInputPort(address: number): boolean {
  const lowByte = address & 0x00ff;
  const lower12 = address & 0x0fff;
  return lowByte === 0x1f ||
    lowByte === 0x37 ||
    lowByte === 0xdf ||
    lower12 === 0x0bdf ||
    lower12 === 0x0fdf ||
    lower12 === 0x0adf;
}

function isWasmV2PeripheralPort(address: number): boolean {
  const port = address & 0xffff;
  return port === 0x103b ||
    port === 0x113b ||
    port === 0x133b ||
    port === 0x143b ||
    port === 0x153b ||
    port === 0x163b;
}

function isTypeScriptOwnedFdcPort(address: number): boolean {
  const port = address & 0xffff;
  return port === 0x2ffd || port === 0x3ffd;
}

function isWasmV2SdFrameCommand(command: unknown): boolean {
  return command === "sd-read" || command === "sd-write" || command === "sd-read-card1" || command === "sd-write-card1";
}
