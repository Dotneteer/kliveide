import { AppServices } from "@renderer/abstractions/AppServices";
import type { IAnyMachine } from "@renderer/abstractions/IAnyMachine";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { RenderingPhase } from "@renderer/abstractions/RenderingPhase";
import { DISK_A_WP, DISK_B_WP, REWIND_REQUESTED } from "@emu/machines/machine-props";
import { TapReader } from "@emu/machines/tape/TapReader";
import { TzxReader } from "@emu/machines/tape/TzxReader";
import { ZxSpectrumBase } from "@emu/machines/ZxSpectrumBase";
import {
  RequestMessage,
  ResponseMessage,
  defaultResponse,
  errorResponse
} from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { BinaryReader } from "@common/utils/BinaryReader";
import type { ISpectrumPsgDevice } from "@emu/machines/zxSpectrum/ISpectrumPsgDevice";
import { isZ88IdeMachine } from "@emu/machines/z88/IZ88IdeMachine";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_DOCK, MEDIA_SD_CARD, MEDIA_TAPE } from "@common/structs/project-const";
import { dockBankOf, parseDckFile } from "@common/timex/dckFile";
import { isZx8081ProgramFileName, parseZxProgramFile } from "@emu/machines/zx8081/ZxPFile";
import { mediaStore } from "@emu/machines/media/media-info";
import { EmuScriptRunner } from "./ksx/EmuScriptRunner";
import { getCachedMessenger, getCachedStore } from "@renderer/CachedServices";
import { isZxNextIdeMachine, type IZxNextIdeMachine } from "@emu/machines/zxNext/IZxNextIdeMachine";
import { isExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";
import { isAccessProfileSource } from "@emu/abstractions/IAccessProfileSource";
import { profileLayoutOf } from "@common/profile/layouts";
import { buildProfileView, resolveProfileOffsets, sampleProfile } from "@emu/machines/profile/profileViews";
import type { ProfileTouchedByte } from "@common/profile/profileTypes";
import type { CallStackInfo } from "@emu/abstractions/CallStack";
import { historyContextDecoder } from "@common/history/contexts";
import { HistoryKind } from "@common/history/historyRecord";
import type {
  HistoryNavigationOp,
  HistoryNavigationOptions,
  HistoryNavigationResult
} from "@common/history/historyNavigation";
import type { HistoricalState } from "@emu/machines/history/HistoryCursor";
import { createMainApi } from "@common/messaging/MainApi";
import { IMachineService } from "@renderer/abstractions/IMachineService";
import { CodeToInject } from "@abstractions/CodeToInject";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { BreakpointInfo, type BreakpointScope } from "@abstractions/BreakpointInfo";
import { MachineCommand } from "@abstractions/MachineCommand";
import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { SourceStepKind } from "@emu/machines/SourceStepDecision";
import {
  CpuState,
  CpuStateChunk,
  type Z80CpuState,
  isMachineNotAvailableError,
  MACHINE_NOT_AVAILABLE_MESSAGE,
  ULA_BORDER_COLOR_NAMES,
  VicState
} from "@common/messaging/EmuApi";
import { IMemorySection } from "@abstractions/MemorySection";
import type { RecordingManager } from "./recording/RecordingManager";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { openRendererDialog } from "@renderer/controls/overlay/dialogRequestBridge";
import { setMachineConfigAction, setQuickStateAvailableAction } from "@state/actions";
import { loadZ88Snapshot } from "./machines/z88SnapshotLoad";
import { loadSpectrumSnapshot } from "./machines/spectrumSnapshotLoad";
import { saveSpectrumSnapshot } from "./machines/spectrumSnapshotSave";
import { playRzxRecording, renderRzxToVideo, type RzxPlaybackPorts } from "./machines/rzxPlayback";
import {
  discardRzxRecording,
  insertRzxRollbackPoint,
  rollbackRzxRecording,
  startRzxRecording,
  stopRzxRecording
} from "./machines/rzxRecording";
import type {
  RzxPlayMode,
  RzxPlayOptions,
  RzxPlayResult,
  RzxRecordResult,
  RzxRollbackResult,
  RzxStopRecordingResult,
  RzxVideoOptions
} from "@common/spectrum/rzx/rzxCommandTypes";
import {
  coreIdOfMachine,
  loadMachineStateFile,
  quickRestoreMachineState,
  quickSaveMachineState,
  saveMachineStateFile,
  type MachineStatePorts
} from "./machines/machineStateFile";
import { coreIdentity, loadDebugRecording, recordingMismatch, saveDebugRecording } from "./machines/debugRecordingFile";
import type {
  DebugRecordingCompatibility,
  DebugRecordingLoadOptions,
  DebugRecordingLoadResult,
  DebugRecordingSaveOptions,
  DebugRecordingSaveResult
} from "@common/debugRecording/debugRecordingTypes";
import type {
  MachineStateLoadMode,
  MachineStateLoadResult,
  MachineStateSaveResult,
  SdCardFingerprint
} from "@common/machineState/machineStateTypes";
import type { SpectrumSnapshotSaveResult } from "@common/spectrum/snapshot/spectrumSnapshotSaveTypes";
import type { SpectrumSnapshotFormat } from "@common/spectrum/snapshot/spectrumSnapshot";
import type { SzxCreator } from "@common/spectrum/snapshot/szxWriter";
import type {
  SpectrumSnapshotLoadMode,
  SpectrumSnapshotLoadOptions,
  SpectrumSnapshotLoadResult
} from "@common/spectrum/snapshot/spectrumSnapshotLoadTypes";
import type { Z88SnapshotLoadMode, Z88SnapshotLoadResult } from "@common/z88/z88SnapshotLoadTypes";

const borderColors = ULA_BORDER_COLOR_NAMES;

// Module-level ref so menu commands can reach the renderer RecordingManager.
let _emuRecordingManager: RecordingManager | null = null;

/** Called from EmuApp after the RecordingManager is created. */
export function setEmuRecordingManager(mgr: RecordingManager | null): void {
  _emuRecordingManager = mgr;
}

/**
 * The CPU state at the history cursor (`.plans/LITE_STEP_BACK_PLAN.md` D2, T9): the record's
 * registers, interrupt state and partition over the live state's shape. What a record does not hold
 * - the T-state counter, the last memory and I/O accesses, the stop events - must not pass for
 * historical, so `history` tells the views to show it as unknown and the stop events are dropped.
 */
export function historicalCpuState(live: Z80CpuState, historical: HistoricalState): Z80CpuState {
  const { record, info, pcPartition } = historical;
  const { lastNextRegWrite: _w, lastCopperHit: _c, lastSpriteWrite: _s, ...rest } = live;
  return {
    ...rest,
    ...record.regs,
    halted: record.kind === HistoryKind.Halt,
    snoozed: false,
    sigINT: record.intPending,
    opStartAddress: record.regs.pc,
    ...(pcPartition === undefined ? { pcPartition: undefined } : { pcPartition }),
    history: info
  };
}

// --- There is no machine controller: a machine is being rebuilt (see MACHINE_NOT_AVAILABLE_MESSAGE)
function noController(): never {
  throw new Error(MACHINE_NOT_AVAILABLE_MESSAGE);
}

class EmuMessageProcessor {
  /**
   * Constructs the EmuMessageProcessor.
   * @param mainMessenger Messenger for main process communication.
   * @param machineService Service for machine operations.
   */
  constructor(
    private readonly mainMessenger: MessengerBase,
    private readonly machineService: IMachineService
  ) {}

  /**
   * Sets the machine type and optional model/configuration.
   * @param machineId The machine type ID.
   * @param modelId Optional model ID.
   * @param config Optional configuration object.
   */
  async setMachineType(machineId: string, modelId?: string, config?: Record<string, any>) {
    // --- Report whether this call's machine actually became the live one, so the caller can tell
    // --- a real success from being superseded by a later, concurrent machine change.
    return this.machineService.setMachineType(machineId, modelId, config);
  }

  /**
   * Issues a machine command, optionally with a custom command string.
   * @param command The machine command to issue.
   * @param customCommand Optional custom command string.
   */
  issueMachineCommand(command: MachineCommand, customCommand?: string): Promise<any> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    switch (command) {
      case "start":
        return controller.start();
      case "pause":
        return controller.pause();
      case "stop":
        return this.unlessKeepingRecording("Stop", () => controller.stop());
      case "reset":
        return this.unlessKeepingRecording("Reset", () => controller.cpuReset());
      case "restart":
        return this.unlessKeepingRecording("Restart", () => controller.restart());
      case "debug":
        return controller.startDebug();
      case "stepInto":
        return controller.stepInto();
      case "stepOver":
        return controller.stepOver();
      case "stepOut":
        return controller.stepOut();
      case "rewind":
        controller.machine.setMachineProperty(REWIND_REQUESTED, true);
        return Promise.resolve();
      case "custom":
        return controller.customCommand(customCommand);
    }
  }

  /**
   * Displays a registered EMU dialog.
   */
  async displayDialog(dialogId: number, dialogData?: any): Promise<unknown | undefined> {
    if (typeof dialogId !== "number") return undefined;
    return await openRendererDialog("emu", dialogId, dialogData);
  }

  /**
   * Sets the tape file for the emulator.
   * @param file The tape file name.
   * @param contents The tape file contents as Uint8Array.
   * @param confirm Optional flag to show confirmation.
   * @param suppressError Optional flag to suppress errors.
   */
  /**
   * Inserts a `.dck` cartridge (the Timex 2068s): the media store keeps it for the next machine, and a
   * live machine gets it and restarts, so its ROM finds the cartridge
   */
  async setDockFile(file: string, contents: Uint8Array): Promise<string | undefined> {
    let image;
    try {
      image = parseDckFile(contents);
    } catch (err) {
      return `${(err as Error).message}`;
    }
    if (!dockBankOf(image)) return "The file holds no DOCK bank";
    mediaStore.addMedia({ id: MEDIA_DOCK, mediaFile: file, mediaContents: image });
    await this.restartWithDock(image);
    return undefined;
  }

  /** Removes the cartridge, from the media store and from a live machine, which restarts */
  async ejectDock(): Promise<void> {
    mediaStore.addMedia({ id: MEDIA_DOCK, mediaFile: undefined, mediaContents: undefined });
    await this.restartWithDock(undefined);
  }

  private async restartWithDock(image: unknown): Promise<void> {
    const controller = this.machineService.getMachineController();
    if (!controller?.machine) return;
    controller.machine.setMachineProperty(MEDIA_DOCK, image);
    const state = controller.state;
    if (state === MachineControllerState.Running || state === MachineControllerState.Paused) {
      await controller.restart();
    }
  }

  async setTapeFile(
    file: string,
    contents: Uint8Array,
    confirm?: boolean,
    suppressError?: boolean
  ) {
    // --- New media act on the present: a muted journal in the past would drop them (REVERSE_DEBUGGING_PLAN D12)
    this.machineService.getMachineController()?.clearHistoryCursor?.();
    await this.machineService.getMachineController()?.interruptRzx?.("the tape was changed");
    // --- A ZX80/ZX81 program file (.p, .81, .o, .80) is its own tape: the machine plays its bytes
    if (file && isZx8081ProgramFileName(file)) {
      const program = parseZxProgramFile(contents, file);
      if (!program) {
        if (!suppressError) {
          await createMainApi(this.mainMessenger).displayMessageBox(
            "error",
            "Tape file error",
            `${file} is not a ZX80/ZX81 program file`
          );
        }
        return;
      }
      mediaStore.addMedia({ id: MEDIA_TAPE, mediaFile: file, mediaContents: program });
      this.machineService.getMachineController()?.machine?.setMachineProperty(MEDIA_TAPE, program);
      if (confirm) {
        await createMainApi(this.mainMessenger).displayMessageBox("info", "Tape file set", `Tape file ${file} successfully set.`);
      }
      return;
    }

    let dataBlocks: TapeDataBlock[] = [];
    const reader = new BinaryReader(contents);
    const tzxReader = new TzxReader(reader);
    let result = tzxReader.readContent();
    if (result) {
      reader.seek(0);
      const tapReader = new TapReader(reader);
      result = tapReader.readContent();
      if (result) {
        if (!suppressError) {
          await createMainApi(this.mainMessenger).displayMessageBox(
            "error",
            "Tape file error",
            `Error while processing tape file ${file} (${result})`
          );
        }
        return;
      } else {
        dataBlocks = tapReader.dataBlocks;
      }
    } else {
      dataBlocks = tzxReader.dataBlocks.map((b) => b.getDataBlock()).filter((b) => b);
    }

    // --- Store the tape file in the media store. This is the durable record: whenever a machine
    // --- starts, the controller re-attaches every stored medium to it, so the tape survives a
    // --- machine change and does not depend on a machine being live right now.
    mediaStore.addMedia({
      id: MEDIA_TAPE,
      mediaFile: file,
      mediaContents: dataBlocks
    });

    // --- Pass the tape file data blocks to the machine, if one is already live. There may be none
    // --- yet during startup, while a machine is still being set up - the stored medium above is
    // --- attached when that machine starts, so this is not an error.
    const controller = this.machineService.getMachineController();
    controller?.machine?.setMachineProperty(MEDIA_TAPE, dataBlocks);

    // --- Done.
    if (confirm) {
      await createMainApi(this.mainMessenger).displayMessageBox(
        "info",
        "Tape file set",
        `Tape file ${file} successfully set.`
      );
    }
  }

  /**
   * Loads a `.z88` snapshot (see `EmuApi.loadZ88Snapshot`).
   * @param contents The `.z88` file
   * @param mode What to do once the state is restored
   */
  loadZ88Snapshot(contents: Uint8Array, mode: Z88SnapshotLoadMode): Promise<Z88SnapshotLoadResult> {
    const store = getCachedStore();
    return loadZ88Snapshot(
      {
        getMachineController: () => this.machineService.getMachineController(),
        getEmulatorState: () => store.getState()?.emulatorState ?? {},
        setMachineType: (machineId, modelId, config) =>
          this.machineService.setMachineType(machineId, modelId, config),
        setMachineConfig: (config) => store.dispatch(setMachineConfigAction(config), "emu")
      },
      contents,
      mode,
      Date.now()
    );
  }

  /**
   * Loads a ZX Spectrum snapshot (see `EmuApi.loadSpectrumSnapshot`).
   * @param fileName The snapshot's file name
   * @param contents The snapshot file
   * @param mode What to do once the state is restored
   * @param options Keep the model; disks the IDE read
   */
  loadSpectrumSnapshot(
    fileName: string,
    contents: Uint8Array,
    mode: SpectrumSnapshotLoadMode,
    options: SpectrumSnapshotLoadOptions & {
      disks?: { drive: number; fileName: string; contents: Uint8Array }[];
    } = {}
  ): Promise<SpectrumSnapshotLoadResult> {
    const store = getCachedStore();
    return loadSpectrumSnapshot(
      {
        getMachineController: () => this.machineService.getMachineController(),
        getEmulatorState: () => store.getState()?.emulatorState ?? {},
        setMachineType: (machineId, modelId, config) =>
          this.machineService.setMachineType(machineId, modelId, config),
        setTape: (file, bytes) => this.setTapeFile(file, bytes, false, true),
        setDisk: (drive, file, bytes) => this.setDiskFile(drive, file, bytes, false, true)
      },
      fileName,
      contents,
      mode,
      options
    );
  }

  // --- RZX (`.plans/RZX_PLAN.md` §4.5-4.7)

  /** The services the RZX calls use */
  private rzxPorts(): RzxPlaybackPorts {
    const store = getCachedStore();
    return {
      getMachineController: () => this.machineService.getMachineController(),
      getEmulatorState: () => store.getState()?.emulatorState ?? {},
      setMachineType: (machineId, modelId, config) =>
        this.machineService.setMachineType(machineId, modelId, config)
    };
  }

  /** Plays an RZX recording (see `EmuApi.playRzx`) */
  playRzx(
    fileName: string,
    contents: Uint8Array,
    mode: RzxPlayMode,
    options: RzxPlayOptions = {}
  ): Promise<RzxPlayResult> {
    return playRzxRecording(this.rzxPorts(), fileName, contents, mode, options);
  }

  /** Renders an RZX recording to video (see `EmuApi.renderRzxToVideo`) */
  renderRzxToVideo(
    fileName: string,
    contents: Uint8Array,
    options: RzxVideoOptions = {}
  ): Promise<RzxPlayResult> {
    const store = getCachedStore();
    return renderRzxToVideo(
      {
        ...this.rzxPorts(),
        getRecorder: () => _emuRecordingManager ?? undefined,
        getVideoFile: () => store.getState()?.emulatorState?.screenRecordingFile
      },
      fileName,
      contents,
      options,
      (stop, videoFile) => {
        const controller = this.machineService.getMachineController();
        const how = stop?.kind === "desync" ? "stopped at the desync" : stop?.kind === "ended" ? "finished" : "stopped";
        void controller?.sendOutput(
          `RZX video ${how}${videoFile ? `: ${videoFile}` : ""}`,
          stop?.kind === "ended" ? "green" : "yellow"
        );
      }
    );
  }

  /** Starts an RZX recording (see `EmuApi.startRzxRecording`) */
  startRzxRecording(creator: { name: string; major: number; minor: number }): Promise<RzxRecordResult> {
    return startRzxRecording(this.rzxPorts(), creator);
  }

  /** Stops the RZX recording (see `EmuApi.stopRzxRecording`) */
  stopRzxRecording(): Promise<RzxStopRecordingResult> {
    return stopRzxRecording(this.rzxPorts());
  }

  /** Throws the RZX recording away (see `EmuApi.discardRzxRecording`) */
  discardRzxRecording(): Promise<void> {
    return discardRzxRecording(this.rzxPorts());
  }

  /** Rolls the RZX recording back (see `EmuApi.rollbackRzxRecording`) */
  rollbackRzxRecording(back = 1): Promise<RzxRollbackResult> {
    return rollbackRzxRecording(this.rzxPorts(), back);
  }

  /** Inserts a rollback point (see `EmuApi.insertRzxRollbackPoint`) */
  insertRzxRollbackPoint(): Promise<{ frame: number }> {
    return insertRzxRollbackPoint(this.rzxPorts());
  }

  /**
   * Saves the ZX Spectrum as a snapshot (see `EmuApi.saveSpectrumSnapshot`).
   * @param format The file format
   * @param creator The program a `.szx` file names as its creator
   */
  saveSpectrumSnapshot(
    format: SpectrumSnapshotFormat,
    creator?: SzxCreator
  ): Promise<SpectrumSnapshotSaveResult> {
    const store = getCachedStore();
    return saveSpectrumSnapshot(
      {
        getMachineController: () => this.machineService.getMachineController(),
        getMediaFiles: () => ({
          tapeFile: mediaStore.getMedia(MEDIA_TAPE)?.mediaFile,
          diskFiles: [
            mediaStore.getMedia(MEDIA_DISK_A)?.mediaFile,
            mediaStore.getMedia(MEDIA_DISK_B)?.mediaFile
          ]
        }),
        getEmulatorState: () => store.getState()?.emulatorState ?? {}
      },
      format,
      creator
    );
  }

  /** The services the Klive state calls use */
  private machineStatePorts(): MachineStatePorts {
    const store = getCachedStore();
    return {
      getMachineController: () => this.machineService.getMachineController(),
      getEmulatorState: () => store.getState()?.emulatorState ?? {},
      setMachineType: (machineId, modelId, config) =>
        this.machineService.setMachineType(machineId, modelId, config),
      setTape: (file, bytes) => this.setTapeFile(file, bytes, false, true),
      setDisk: (drive, file, bytes) => this.setDiskFile(drive, file, bytes, false, true),
      getMediaFiles: () => ({
        [MEDIA_TAPE]: mediaStore.getMedia(MEDIA_TAPE)?.mediaFile,
        [MEDIA_DISK_A]: mediaStore.getMedia(MEDIA_DISK_A)?.mediaFile,
        [MEDIA_DISK_B]: mediaStore.getMedia(MEDIA_DISK_B)?.mediaFile
      })
    };
  }

  /**
   * Saves a Klive state file (see `EmuApi.saveMachineStateFile`).
   */
  saveMachineStateFile(options: {
    kliveVersion: string;
    sdCard?: SdCardFingerprint;
  }): Promise<MachineStateSaveResult> {
    return saveMachineStateFile(this.machineStatePorts(), {
      kliveVersion: options.kliveVersion,
      sdCard: options.sdCard ? { ...options.sdCard, id: MEDIA_SD_CARD } : undefined
    });
  }

  /**
   * Loads a Klive state file (see `EmuApi.loadMachineStateFile`).
   */
  loadMachineStateFile(
    fileName: string,
    contents: Uint8Array,
    mode: MachineStateLoadMode,
    options: { currentSdCard?: SdCardFingerprint; acceptChangedSdCard?: boolean } = {}
  ): Promise<MachineStateLoadResult> {
    return loadMachineStateFile(this.machineStatePorts(), fileName, contents, mode, {
      currentSdCard: options.currentSdCard
        ? { ...options.currentSdCard, id: MEDIA_SD_CARD }
        : undefined,
      acceptChangedSdCard: options.acceptChangedSdCard
    });
  }

  /**
   * Runs a command that ends the timeline - unless the timeline came from a debug recording, was run
   * on past its end, and the user keeps it (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` Q7, T12)
   */
  private async unlessKeepingRecording(what: string, command: () => Promise<unknown>): Promise<unknown> {
    const timeline = this.machineService.getMachineController()?.timeline;
    if (timeline?.hasUnsavedExtension) {
      const discard = await createMainApi(this.mainMessenger).confirmAction(
        "Debug Recording",
        `${what} discards what ran after the end of ${timeline.recording!.name}.`,
        "The recording was continued past its end, and that part is not in the file. Cancel, then use Debug › Save Debug Recording... to keep it.",
        what
      );
      if (!discard) return undefined;
    }
    return command();
  }

  /**
   * Saves a debug recording (see `EmuApi.saveDebugRecording`).
   */
  saveDebugRecording(options: DebugRecordingSaveOptions): Promise<DebugRecordingSaveResult> {
    return saveDebugRecording(this.machineStatePorts(), options);
  }

  /**
   * Opens a debug recording (see `EmuApi.loadDebugRecording`).
   */
  loadDebugRecording(
    fileName: string,
    contents: Uint8Array,
    kliveVersion: string,
    options: DebugRecordingLoadOptions = {}
  ): Promise<DebugRecordingLoadResult> {
    return loadDebugRecording(this.machineStatePorts(), fileName, contents, kliveVersion, options);
  }

  /**
   * Whether this build can replay a debug recording (see `EmuApi.checkDebugRecording`).
   */
  async checkDebugRecording(
    header: { kliveVersion: string; coreId: string; fingerprint: string; codeHash: string; contractHash: string; memorySize: number },
    kliveVersion: string
  ): Promise<DebugRecordingCompatibility> {
    const machine = this.machineService.getMachineController()?.machine as
      | { machineId: string; wasmV2Runtime?: { module?: WebAssembly.Module } }
      | undefined;
    const liveCoreId = machine ? coreIdOfMachine(machine.machineId) : undefined;
    if (!machine || liveCoreId !== header.coreId) return { known: false, liveCoreId };
    try {
      const live = await coreIdentity(header.coreId, machine.wasmV2Runtime?.module);
      return { known: true, refusal: recordingMismatch(header, header.coreId, live, kliveVersion) };
    } catch (err) {
      return { known: true, refusal: (err as Error).message };
    }
  }

  /**
   * Quick-saves the machine (see `EmuApi.quickSaveMachineState`).
   */
  async quickSaveMachineState(): Promise<{ machineName: string; pc: number }> {
    const result = await quickSaveMachineState(this.machineStatePorts());
    getCachedStore().dispatch(setQuickStateAvailableAction(true), "emu");
    return result;
  }

  /**
   * Restores the quick-saved state (see `EmuApi.quickRestoreMachineState`).
   */
  quickRestoreMachineState(): Promise<{ pc: number }> {
    return quickRestoreMachineState(this.machineStatePorts());
  }

  /**
   * Sets the disk file for the specified drive.
   * @param diskIndex The disk drive index.
   * @param file Optional disk file name.
   * @param contents Optional disk file contents.
   * @param confirm Optional flag to show confirmation.
   * @param suppressError Optional flag to suppress errors.
   */
  async setDiskFile(
    diskIndex: number,
    file?: string,
    contents?: Uint8Array,
    confirm?: boolean,
    suppressError?: boolean
  ) {
    // --- Get disk information
    const controller = this.machineService.getMachineController();
    // --- New media act on the present (REVERSE_DEBUGGING_PLAN D12)
    controller?.clearHistoryCursor?.();
    await controller?.interruptRzx?.("a disk was changed");
    const mediaId = diskIndex ? MEDIA_DISK_B : MEDIA_DISK_A;
    // --- `diskIndex` is a number, so indexing it always yielded `undefined` and every message
    // --- claimed drive A regardless of which drive was actually used.
    const drive = diskIndex ? "B" : "A";
    // --- Try to parse the disk file
    try {
      // --- Store the disk file in the media store. This is the durable record: whenever a machine
      // --- starts, the controller re-attaches every stored medium to it.
      mediaStore.addMedia({
        id: mediaId,
        mediaFile: file,
        mediaContents: contents
      });

      // --- Pass the disk contents to the machine, if one is already live. There may be none yet
      // --- during startup, while a machine is still being set up - the stored medium above is
      // --- attached when that machine starts, so this is not an error.
      controller?.machine?.setMachineProperty(mediaId, contents ?? null);

      // --- Done.
      if (confirm) {
        await createMainApi(this.mainMessenger).displayMessageBox(
          "info",
          contents ? "Disk inserted" : "Disk ejected",
          contents
            ? `Disk file ${file} successfully inserted into drive ${drive}.`
            : `Disk successfully ejected from drive ${drive}`
        );
      }
    } catch (err) {
      if (!suppressError) {
        await createMainApi(this.mainMessenger).displayMessageBox(
          "error",
          "Disk file error",
          `Error while processing disk file ${file} (${err})`
        );
      }
    }
  }

  /**
   * Sets write protection for a disk drive.
   * @param index The disk drive index.
   * @param protect True to enable write protection.
   */
  getTrdosDiskImage(index: number): Uint8Array | undefined {
    const machine = this.machineService.getMachineController()?.machine as
      | { exportBetaDiskAsTrd?: (drive: number) => Uint8Array | undefined }
      | undefined;
    return machine?.exportBetaDiskAsTrd?.(index);
  }

  setDiskWriteProtection(index: number, protect: boolean) {
    const controller = this.machineService.getMachineController();
    const propName = index ? DISK_B_WP : DISK_A_WP;

    // --- Record it alongside the medium. Machine properties are lost whenever the machine is
    // --- replaced, so without this a machine change would quietly remount a write-protected disk
    // --- as writable; the controller re-applies this flag every time it re-attaches the medium.
    mediaStore.addMedia({
      id: index ? MEDIA_DISK_B : MEDIA_DISK_A,
      writeProtected: protect
    });

    // --- There may be no live machine yet during startup, while one is still being set up.
    // --- Crashing here would abort the whole disk restore and eject the disk.
    controller?.machine?.setMachineProperty(propName, protect);
  }

  /**
   * Gets the current CPU state: the state at the history cursor while it is in the past
   * (`.plans/LITE_STEP_BACK_PLAN.md` D2), unless `present` asks for the live one.
   */
  getCpuState(options?: { present?: boolean }): CpuState {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    const state = machine.getCpuState();
    const historical = options?.present ? undefined : controller.historyCursor?.state();
    if (historical) return historicalCpuState(state as Z80CpuState, historical);
    const pcPartition = machine.getPartition?.(state.pc);
    return pcPartition === undefined ? state : { ...state, pcPartition };
  }

  /**
   * Gets the current ULA state.
   */
  getUlaState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    // --- The Next answers from its own state on either core (see IZxNextIdeMachine)
    if (isZxNextIdeMachine(machine)) {
      return machine.getNextUlaState();
    }
    const screenDevice = (machine as ZxSpectrumBase).screenDevice;
    const kbDevice = (machine as ZxSpectrumBase).keyboardDevice;
    let romP = 0;
    let ramB = 0;
    if (machine.machineId === "sp128" || machine.machineId === "spp3e") {
      const pagingMachine = machine as Partial<{
        getSelectedRomPage(): number;
        getSelectedRamBank(): number;
        selectedRom: number;
        selectedBank: number;
      }>;
      romP = pagingMachine.getSelectedRomPage?.() ?? pagingMachine.selectedRom ?? 0;
      ramB = pagingMachine.getSelectedRamBank?.() ?? pagingMachine.selectedBank ?? 0;
    }
    // --- RAS/POS: the raster line and the tact in it, from the machine's own raster timing
    // --- (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` T6). Neither `screenWidthInPixels` nor
    // --- `tactsInDisplayLine` is the length of a raster line: dividing by them was wrong everywhere.
    const { ras, pos } = ulaRasterPosition(machine);
    return {
      fcl: machine.currentFrameTact ?? 0,
      frm: machine.frames,
      ras,
      pos,
      pix: RenderingPhase[screenDevice.renderingTactTable[machine.currentFrameTact]?.phase],
      bor: borderColors[screenDevice.borderColor & 0x07],
      flo: (machine as ZxSpectrumBase).floatingBusDevice?.readFloatingBus(),
      con: machine.totalContentionDelaySinceStart,
      lco: machine.contentionDelaySincePause,
      ear: (machine as ZxSpectrumBase).beeperDevice.earBit,
      mic: (machine as ZxSpectrumBase).tapeDevice?.micBit,
      keyLines: [
        kbDevice.getKeyLineValue(0),
        kbDevice.getKeyLineValue(1),
        kbDevice.getKeyLineValue(2),
        kbDevice.getKeyLineValue(3),
        kbDevice.getKeyLineValue(4),
        kbDevice.getKeyLineValue(5),
        kbDevice.getKeyLineValue(6),
        kbDevice.getKeyLineValue(7)
      ],
      romP,
      ramB
    };
  }

  /**
   * Gets the current PSG chip state.
   */
  getPsgState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine as Partial<{ psgDevice: ISpectrumPsgDevice }>;
    const psgDevice = machine.psgDevice;
    if (!psgDevice) {
      throw new Error("PSG device is not available");
    }
    return psgDevice.getPsgState();
  }

  /**
   * Gets the current Blink device state.
   */
  getBlinkState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    // --- Either Z88 core answers from its own state (see IZ88IdeMachine)
    const machine = controller.machine;
    if (!isZ88IdeMachine(machine)) {
      throw new Error("BLINK device is not available");
    }
    return machine.getBlinkState();
  }

  /**
   * Erases all breakpoints in the emulator.
   */
  eraseAllBreakpoints() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.eraseAllBreakpoints();
  }

  /**
   * Sets a breakpoint in the emulator.
   * @param breakpoint The breakpoint information.
   */
  setBreakpoint(breakpoint: BreakpointInfo) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.debugSupport.addBreakpoint(breakpoint);
  }

  /**
   * Removes a breakpoint from the emulator.
   * @param breakpoint The breakpoint information.
   */
  removeBreakpoint(breakpoint: BreakpointInfo) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.debugSupport.removeBreakpoint(breakpoint);
  }

  /**
   * Lists all breakpoints in the emulator.
   */
  listBreakpoints() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }

    const lastOpStart = controller.machine.opStartAddress;
    // --- With the runtime state (live hit count, condition error/inactive); copies already
    const execBreakpoints = controller.debugSupport
      .listBreakpointsWithState()
      .sort((a, b) => {
        if (a.address !== undefined) {
          if (b.address != undefined) {
            return a.address - b.address;
          } else {
            return -1;
          }
        }
        if (b.address != undefined) {
          if (a.address != undefined) {
            return a.address - b.address;
          } else {
            return 1;
          }
        }
        if (a.resource > b.resource) {
          return -1;
        } else if (a.resource < b.resource) {
          return 1;
        }
        return (a.line ?? 0) - (b.line ?? 0);
      });
    const segments: number[][] = [];
    for (let i = 0; i < execBreakpoints.length; i++) {
      const bp = execBreakpoints[i];
      const addr = bp.exec ? bp.address : lastOpStart;
      segments[i] = [];
      if (!addr) continue;
      for (let j = 0; j < 8; j++) {
        segments[i][j] = controller.machine.doReadMemory((addr + j) & 0xffff);
      }
    }

    return {
      breakpoints: execBreakpoints,
      memorySegments: segments
    };
  }

  /**
   * Enables or disables a breakpoint.
   * @param breakpoint The breakpoint information.
   * @param enable True to enable, false to disable.
   */
  enableBreakpoint(breakpoint: BreakpointInfo, enable: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.debugSupport.enableBreakpoint(breakpoint, enable);
  }

  /**
   * Gets the memory contents for the specified partition.
   * @param partition Optional memory partition index.
   */
  getMemoryContents(partition?: number) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const m = controller.machine as any;
    let memory: Uint8Array;
    if (partition === undefined) {
      memory = (controller.machine as IZxSpectrumMachine).get64KFlatMemory();
    } else {
      memory = (controller.machine as IZxSpectrumMachine).getMemoryPartition(partition);
    }
    return {
      memory,
      pc: m.pc,
      af: m.af,
      bc: m.bc,
      de: m.de,
      hl: m.hl,
      af_: m.af_,
      bc_: m.bc_,
      de_: m.de_,
      hl_: m.hl_,
      sp: m.sp,
      ix: m.ix,
      iy: m.iy,
      ir: m.ir,
      wz: m.wz,
      partitionLabels: controller.machine.getCurrentPartitionLabels(),
      selectedRom: controller.machine.getSelectedRomPage?.(),
      selectedBank: controller.machine.getSelectedRamBank?.(),
      memBreakpoints: controller.debugSupport.breakpoints,
      osInitialized: controller.machine?.isOsInitialized ?? false,
      ...this.historyOfMemoryView(controller)
    };
  }

  /** The history cursor's PC, registers and decoded bytes, for the disassembly (T2) */
  private historyOfMemoryView(controller: { historyCursor?: { state(): HistoricalState | undefined } }) {
    const state = controller.historyCursor?.state();
    if (!state) return {};
    const { record, info, pcPartition } = state;
    return {
      history: {
        position: info.position,
        pc: record.regs.pc,
        regs: record.regs,
        bytes: record.bytes,
        ...(pcPartition === undefined ? {} : { partition: pcPartition })
      }
    };
  }

  /**
   * Gets the system variables.
   */
  getSysVars() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const m = controller.machine;
    return (m as ZxSpectrumBase).sysVars;
  }

  /**
   * Injects code into the emulator.
   * @param codeToInject The code to inject.
   */
  injectCodeCommand(codeToInject: CodeToInject) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    void controller.interruptRzx?.("code was injected");
    // --- Injection waits on wall time, so where it continues is not reproducible (T10)
    controller.endTimeline?.();
    controller.machine.injectCodeToRun(codeToInject);
  }

  /**
   * Runs code in the emulator, optionally in debug mode.
   * @param codeToInject The code to run.
   * @param additionalInfo: any,
   * @param debug True to run in debug mode.
   * @param projectDebug True to use project debug mode.
   */
  runCodeCommand(
    codeToInject: CodeToInject,
    additionalInfo: any,
    debug: boolean,
    projectDebug: boolean
  ) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.runCode(codeToInject, additionalInfo, debug, projectDebug);
  }

  /**
   * Resets the machine and starts the inserted tape loading (`MachineController.runTapeLoad`).
   * @param debug True to arm the breakpoints once the keystrokes are typed.
   */
  startTapeLoad(debug: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.runTapeLoad(debug);
  }

  /**
   * Resets the machine and boots the disk in drive A (`MachineController.runDiskBoot`).
   * @param debug True to arm the breakpoints once the keystrokes are typed.
   */
  startDiskBoot(debug: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.runDiskBoot(debug);
  }

  /**
   * Resolves breakpoints in the emulator.
   * @param breakpoints The breakpoints to resolve.
   */
  resolveBreakpoints(breakpoints: ResolvedBreakpoint[]) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.resolveBreakpoints(breakpoints);
  }

  /**
   * Scrolls breakpoints by a shift value within bounds.
   * @param addr The breakpoint address info.
   * @param shift The shift value.
   * @param lowerBound Optional lower bound.
   * @param upperBound Optional upper bound.
   */
  scrollBreakpoints(addr: BreakpointInfo, shift: number, lowerBound?: number, upperBound?: number) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.scrollBreakpoints(addr, shift, lowerBound, upperBound);
  }

  /**
   * Zeroes one breakpoint's hit counter, or all of them.
   * @param breakpoint The breakpoint; all counters when absent
   */
  resetBreakpointHits(breakpoint?: BreakpointInfo) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.debugSupport.resetHitCounts(breakpoint);
  }

  /**
   * Replaces the symbols breakpoint conditions bind to.
   * @param symbols Integer symbols, keyed lower-case
   */
  setConditionSymbols(symbols: Record<string, number>) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.setConditionSymbols(symbols ?? {});
  }

  /**
   * Resets breakpoints to the provided set.
   * @param bps The new set of breakpoints.
   */
  resetBreakpointsTo(bps: BreakpointInfo[], scope: BreakpointScope) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.resetBreakpointsTo(bps, scope);
  }

  /**
   * Replaces the whole breakpoint set in a single, atomic step, preserving each breakpoint's
   * enabled/disabled state.
   *
   * Restoring breakpoints as "erase all, then add them back one at a time" spans many separate
   * IPC round trips, and any breakpoint edit made from the IDE in between (a gutter toggle, a
   * script) is either wiped by the erase or overwritten by the replay. Doing the whole swap inside
   * one synchronous handler closes that window completely.
   * @param bps The breakpoints to install
   */
  restoreBreakpoints(bps: BreakpointInfo[], scope: BreakpointScope) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const debugSupport = controller.debugSupport;
    // --- `resetBreakpointsTo` re-applies `disabled` itself now, so this is a single call.
    debugSupport.resetBreakpointsTo(bps ?? [], scope);
  }

  /**
   * Normalizes breakpoints for a resource and line count.
   * @param resource The resource (file) name.
   * @param lineCount The number of lines in the resource.
   */
  normalizeBreakpoints(resource: string, lineCount: number) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.normalizeBreakpoints(resource, lineCount);
  }

  /**
   * Gets the state of the NEC UPD765 floppy controller.
   */
  getNecUpd765State() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    if (machine.machineId.startsWith("spp3e")) {
      return (machine as Partial<{ floppyDevice: { getLogEntries(): unknown[] } }>).floppyDevice?.getLogEntries() ?? [];
    }
    return [];
  }

  /**
   * Starts a script in the emulator.
   * @param id The script ID.
   * @param scriptFile The script file name.
   * @param contents The script contents.
   */
  startScript(id: number, scriptFile: string, contents: string) {
    const runner = getEmuScriptRunner();
    return runner.runScript(id, scriptFile, contents);
  }

  /**
   * Stops a running script in the emulator.
   * @param id The script ID.
   */
  stopScript(id: number) {
    const runner = getEmuScriptRunner();
    return runner.stopScript(id);
  }

  /**
   * Gets the Next register descriptors.
   */
  getNextRegDescriptors() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    return {
      descriptors: isZxNextIdeMachine(machine) ? machine.getNextRegDescriptors() : undefined
    };
  }

  /**
   * Gets the Next register state.
   */
  getNextRegState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    const devState = isZxNextIdeMachine(machine) ? machine.getNextRegState() : undefined;
    return {
      lastRegisterIndex: devState?.lastRegisterIndex,
      regs: devState?.regs
    };
  }

  /**
   * What the execution-history ring holds; undefined on a machine that does not record history. The
   * guard is the capability, not the Next, so every core that records needs no handler of its own.
   */
  getHistoryInfo() {
    const machine = this.machineService.getMachineController()?.machine;
    return isExecutionHistorySource(machine) ? machine.getHistoryInfo() : undefined;
  }

  /**
   * Consecutive raw history records from a sequence number on.
   */
  getHistoryRecords(fromSequence: number, count: number) {
    const machine = this.machineService.getMachineController()?.machine;
    return isExecutionHistorySource(machine) ? machine.readHistory(fromSequence, count) : undefined;
  }

  /**
   * The outermost interrupt service spans of the held history records (the viewer folds them).
   */
  getHistoryServiceSpans() {
    const machine = this.machineService.getMachineController()?.machine;
    return isExecutionHistorySource(machine) ? machine.getHistoryServiceSpans() : undefined;
  }

  /**
   * Empties the execution-history ring; a history cursor goes with it (T6).
   */
  clearHistory() {
    const controller = this.machineService.getMachineController();
    controller?.clearHistoryCursor?.();
    const machine = controller?.machine;
    if (isExecutionHistorySource(machine)) machine.clearHistory();
  }

  // --- The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.2): the controller owns
  // --- the switch and the status, the machine's profile source the data

  /** The controller and its machine's profile source, when the machine profiles */
  private profileTarget() {
    const controller = this.machineService.getMachineController();
    const status = controller?.getProfileStatus?.();
    const machine = controller?.machine;
    if (!controller || !status || !isAccessProfileSource(machine)) return undefined;
    return { controller, status, source: machine };
  }

  getProfileStatus() {
    return this.machineService.getMachineController()?.getProfileStatus?.();
  }

  setProfiling(enabled: boolean, counters?: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller?.setProfiling?.(enabled, counters)) return undefined;
    return controller.getProfileStatus?.();
  }

  resetProfile() {
    this.machineService.getMachineController()?.resetProfile?.();
  }

  getProfileView(partition?: number, withCounts = true) {
    const target = this.profileTarget();
    if (!target) return undefined;
    const layout = profileLayoutOf(target.source.profileMachineId);
    if (!layout) return undefined;
    const machine = target.controller.machine;
    return buildProfileView(
      target.source,
      layout,
      target.status,
      (address) => machine.getPartition?.(address),
      partition,
      withCounts
    );
  }

  getProfileSample(addresses: number[], partitions?: (number | null)[], withCounts = false) {
    const target = this.profileTarget();
    if (!target) return undefined;
    const layout = profileLayoutOf(target.source.profileMachineId);
    if (!layout) return undefined;
    const machine = target.controller.machine;
    const source = target.source;
    const offsets = resolveProfileOffsets(
      layout,
      (address) => machine.getPartition?.(address),
      addresses,
      partitions,
      source.currentProfileOffset ? (address) => source.currentProfileOffset!(address) : undefined
    );
    return sampleProfile(target.source, target.status, offsets, withCounts);
  }

  getProfileTouched(mask?: number) {
    const target = this.profileTarget();
    if (!target) return undefined;
    return { info: target.status, bytes: target.source.readProfileTouched(mask) ?? [] };
  }

  mergeProfile(bytes: ProfileTouchedByte[], totals: { instructions: number; timeTotal: number }) {
    const target = this.profileTarget();
    if (!target) return undefined;
    target.source.mergeProfile(bytes, totals);
    return target.controller.getProfileStatus?.();
  }

  /**
   * Moves the history cursor (`.plans/LITE_STEP_BACK_PLAN.md` D4).
   */
  navigateHistory(op: HistoryNavigationOp, options?: HistoryNavigationOptions): HistoryNavigationResult {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.navigateHistory?.(op, options) ?? { position: 0, moved: false, reason: "noHistory" };
  }

  /**
   * Take over here (`.plans/REVERSE_DEBUGGING_PLAN.md` D12).
   */
  async takeOverHere(): Promise<boolean> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return (await controller.takeOverHere?.()) ?? false;
  }

  /** What Take over here would leave behind (T4) */
  getForkPreview(): { sdWrites: number; hostFiles: string[] } | undefined {
    return this.machineService.getMachineController()?.forkPreview?.();
  }

  /** Reverse Continue with progress and cancel (D15, §4.4) */
  async reverseContinue(): Promise<HistoryNavigationResult> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    if (controller.reverseContinue) return await controller.reverseContinue();
    return controller.navigateHistory?.("reverseContinue") ?? { position: 0, moved: false, reason: "noHistory" };
  }

  /** Stops a running Reverse Continue search */
  cancelReverseContinue(): boolean {
    return this.machineService.getMachineController()?.cancelReverseContinue?.() ?? false;
  }

  /**
   * Gets the ZX Spectrum Next Copper's state.
   */
  getCopperState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return requireZxNextIdeMachine(controller.machine).getCopperState();
  }

  /**
   * Gets the ZX Spectrum Next sprite state (the Sprite Inspector's snapshot).
   */
  getNextSpriteState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return requireZxNextIdeMachine(controller.machine).getNextSpriteState();
  }

  /**
   * Gets the ZX Spectrum Next tilemap state (the Tilemap Inspector's snapshot).
   */
  getNextTilemapState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return requireZxNextIdeMachine(controller.machine).getNextTilemapState();
  }

  /**
   * Gets the ZX Spectrum Next Layer 2 state (the Layer 2 Inspector's snapshot).
   */
  getNextLayer2State(options?: { shadow?: boolean }) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return requireZxNextIdeMachine(controller.machine).getNextLayer2State(options);
  }

  /**
   * Gets the ZX Spectrum Next layer state (the Layers document's snapshot, LAYER_COMPOSITION_PLAN D9).
   */
  getNextLayerState(options?: { thumbnails?: boolean }) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return requireZxNextIdeMachine(controller.machine).getNextLayerState(options);
  }

  /**
   * The pixel probe (LAYER_COMPOSITION_PLAN D7) at screen pixel (x, y).
   */
  probeNextPixel(x: number, y: number) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return requireZxNextIdeMachine(controller.machine).probePixel(x, y);
  }

  /**
   * Arms a Copper step and runs the machine in debug mode until it fires.
   */
  async stepCopper() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    requireZxNextIdeMachine(controller.machine).requestCopperStep(true);
    if (controller.state !== MachineControllerState.Running) {
      await controller.startDebug();
    }
  }

  /**
   * Gets the Next memory mapping state.
   */
  getNextMemoryMapping() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return requireZxNextIdeMachine(controller.machine).getNextMemoryMapping();
  }

  /**
   * Parses a partition label.
   * @param label The partition label to parse.
   */
  parsePartitionLabel(label: string) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.parsePartitionLabel(label);
  }

  /**
   * Gets all partition labels.
   */
  getPartitionLabels() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getPartitionLabels();
  }

  /**
   * Gets a human-readable name for each partition. Presentation only; the label is the identity.
   */
  getPartitionDescriptions() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getPartitionDescriptions();
  }

  /**
   * Gets the caption each partition sits under in a chooser.
   */
  getPartitionGroups() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getPartitionGroups();
  }

  /**
   * Gets the current call stack information.
   */
  getCallStack(): CallStackInfo {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    // --- In the past the memory above SP is the present's: reconstruct from history (D6, D10)
    const cursor = controller.historyCursor;
    const historical = cursor?.callStack();
    if (cursor && historical) {
      const machine = controller.machine;
      const decoder = historyContextDecoder(isExecutionHistorySource(machine) ? machine.historyMachineId : undefined);
      return {
        sp: cursor.state()?.record.regs.sp ?? machine.sp,
        frames: [],
        historical: {
          incomplete: historical.incomplete,
          frames: historical.frames.map((f) => ({
            callSite: f.callSite,
            returnAddress: f.returnAddress,
            kind: f.kind,
            sp: f.sp,
            sequence: f.sequence,
            partition: decoder?.partitionFor(f.context, f.callSite)
          }))
        }
      };
    }
    return controller.machine.getCallStack();
  }

  setSourceDebugInfo(info?: SourceLevelDebugInfo) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.setSourceDebugInfo(info);
  }

  setSourceStepping(source: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.sourceStepping = source;
  }

  getSourceStepping() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.sourceStepping;
  }

  sourceStep(kind: SourceStepKind, options?: { targetFrame?: number; targetCallable?: number }) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.sourceStep(kind, options ?? {});
  }

  getSourceStopInfo() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.getSourceStopInfo();
  }

  getSourceCallStack() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.getSourceCallStack();
  }

  /**
   * Sets the key status (pressed/released) for a key.
   * @param key The key code.
   * @param isDown True if the key is pressed.
   */
  setKeyStatus(key: number, isDown: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.machine.setKeyStatus(key, isDown);
  }

  /**
   * Gets palette device information.
   */
  getPalettedDeviceInfo() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return requireZxNextIdeMachine(controller.machine).getPaletteDeviceInfo();
  }

  /**
   * Sets a register value in the emulator.
   * @param register The register name.
   * @param value The value to set.
   */
  async setRegisterValue(register: string, value: number): Promise<void> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    // --- An edit acts on the present: no register edits in the past (LITE_STEP_BACK_PLAN D5)
    controller.clearHistoryCursor?.();
    await controller.interruptRzx?.(`register ${register.toUpperCase()} was edited`);
    const machine = controller.machine as any;
    switch (register.toUpperCase()) {
      case "A":
        machine.a = value;
        break;
      case "F":
        machine.f = value;
        break;
      case "B":
        machine.b = value;
        break;
      case "C":
        machine.c = value;
        break;
      case "D":
        machine.d = value;
        break;
      case "E":
        machine.e = value;
        break;
      case "H":
        machine.h = value;
        break;
      case "L":
        machine.l = value;
        break;
      case "AF":
        machine.af = value;
        break;
      case "BC":
        machine.bc = value;
        break;
      case "DE":
        machine.de = value;
        break;
      case "HL":
        machine.hl = value;
        break;
      case "AF'":
        machine.af_ = value;
        break;
      case "BC'":
        machine.bc_ = value;
        break;
      case "DE'":
        machine.de_ = value;
        break;
      case "HL'":
        machine.hl_ = value;
        break;
      case "IX":
        machine.ix = value;
        break;
      case "IY":
        machine.iy = value;
        break;
      case "SP":
        machine.sp = value;
        break;
      case "PC":
        machine.pc = value;
        break;
      case "I":
        machine.i = value;
        break;
      case "R":
        machine.r = value;
        break;
      case "XL":
        machine.xl = value;
        break;
      case "XH":
        machine.xh = value;
        break;
      case "YL":
        machine.yl = value;
        break;
      case "YH":
        machine.yh = value;
        break;
      case "WZ":
        machine.wz = value;
        break;
    }
  }

  /**
   * Sets memory content at a specific address.
   * @param address The memory address.
   * @param value The value to set.
   * @param size The size in bytes.
   * @param bigEndian True for big-endian byte order.
   */
  async setMemoryContent(
    address: number,
    value: number,
    size: number,
    bigEndian: boolean
  ): Promise<void> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.clearHistoryCursor?.();
    await controller.interruptRzx?.("memory was edited");
    const machine = controller.machine;
    switch (size) {
      case 8:
        machine.doWriteMemory(address, value);
        break;
      case 16:
        if (bigEndian) {
          machine.doWriteMemory((address + 1) & 0xffff, value & 0xff);
          machine.doWriteMemory(address, (value >> 8) & 0xff);
        } else {
          machine.doWriteMemory(address, value & 0xff);
          machine.doWriteMemory((address + 1) & 0xffff, (value >> 8) & 0xff);
        }
        break;
      case 24:
        if (bigEndian) {
          machine.doWriteMemory((address + 2) & 0xffff, value & 0xff);
          machine.doWriteMemory((address + 1) & 0xffff, (value >> 8) & 0xff);
          machine.doWriteMemory(address, (value >> 16) & 0xff);
        } else {
          machine.doWriteMemory(address, value & 0xff);
          machine.doWriteMemory((address + 1) & 0xffff, (value >> 8) & 0xff);
          machine.doWriteMemory((address + 2) & 0xffff, (value >> 16) & 0xff);
        }
        break;
      case 32:
        if (bigEndian) {
          machine.doWriteMemory((address + 3) & 0xffff, value & 0xff);
          machine.doWriteMemory((address + 2) & 0xffff, (value >> 8) & 0xff);
          machine.doWriteMemory((address + 1) & 0xffff, (value >> 16) & 0xff);
          machine.doWriteMemory(address, (value >> 24) & 0xff);
        } else {
          machine.doWriteMemory(address, value & 0xff);
          machine.doWriteMemory((address + 1) & 0xffff, (value >> 8) & 0xff);
          machine.doWriteMemory((address + 2) & 0xffff, (value >> 16) & 0xff);
          machine.doWriteMemory((address + 3) & 0xffff, (value >> 24) & 0xff);
        }
        break;
    }
  }

  /**
   * Gets the ROM flags array.
   */
  async getRomFlags(): Promise<boolean[]> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getRomFlags();
  }

  /**
   * Gets a chunk of the CPU state.
   */
  async getCpuStateChunk(): Promise<CpuStateChunk> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    // --- The cursor's PC and position, so the state listener refreshes on a cursor move (D3)
    const cursor = controller.historyCursor;
    const position = cursor?.position ?? 0;
    return {
      state: controller.state,
      pcValue: position ? (cursor!.state()?.record.regs.pc ?? machine.pc) : machine.pc,
      tacts: machine.tacts,
      ...(position ? { historyPosition: position } : {})
    };
  }

  /**
   * Renames breakpoints for a resource.
   * @param oldResource The old resource name.
   * @param newResource The new resource name.
   */
  async renameBreakpoints(oldResource: string, newResource: string): Promise<void> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.renameBreakpoints(oldResource, newResource);
  }

  /**
   * Gets the current ULA state.
   */
  async getVicState(): Promise<VicState> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }

    // TODO: Implement VIC state retrieval for C64
    const vicState: VicState = {
      vicBaseAddress: 0x0000,
      spriteInfo: [
        {
          x: 0,
          y: 0,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 1,
          y: 1,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 2,
          y: 2,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 3,
          y: 3,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 4,
          y: 4,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 5,
          y: 5,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 6,
          y: 6,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 7,
          y: 7,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        }
      ],
      rst8: false,
      ecm: false,
      bmm: false,
      den: false,
      rsel: false,
      yScroll: 0,
      raster: 0,
      lpx: 0,
      lpy: 0,
      res: false,
      mcm: false,
      csel: false,
      xScroll: 0,
      scrMemOffset: 0x0000,
      colMemOffset: 0x0000,
      irqStatus: false,
      ilpStatus: false,
      immcStatus: false,
      imbcStatus: false,
      irstStatus: false,
      ilpEnabled: false,
      immcEnabled: false,
      imbcEnabled: false,
      irstEnabled: false,
      spriteSpriteCollision: 0,
      spriteDataCollision: 0,
      borderColor: 0,
      bgColor0: 0,
      bgColor1: 0,
      bgColor2: 0,
      bgColor3: 0,
      spriteMcolor0: 0,
      spriteMcolor1: 0
    };
    return vicState;
  }

  /**
   * Gets a disassembly section of the machine with the specified options.
   * @param _options The options for the disassembly section.
   * @returns The disassembly section.
   */
  async getDisassemblySections(_options: Record<string, any>): Promise<IMemorySection[]> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getDisassemblySections(_options);
  }

  /**
   * Routes a recording command issued from the main-process menu to the
   * RecordingManager that lives in this renderer process.
   */
  async issueRecordingCommand(
    command:
      | "set-fps-native"
      | "set-fps-half"
      | "set-quality-lossless"
      | "set-quality-high"
      | "set-quality-good"
      | "set-format-mp4"
      | "set-format-webm"
      | "set-format-mkv"
      | "start-recording"
      | "disarm"
      | "pause-recording"
      | "resume-recording"
  ): Promise<void> {
    if (!_emuRecordingManager) return;
    const machineState = getCachedStore()?.getState()?.emulatorState?.machineState;
    const isRunning = machineState === MachineControllerState.Running;
    switch (command) {
      case "set-fps-native":
        _emuRecordingManager.setFpsPreference("native");
        break;
      case "set-fps-half":
        _emuRecordingManager.setFpsPreference("half");
        break;
      case "set-quality-lossless":
        _emuRecordingManager.setQualityPreference("lossless");
        break;
      case "set-quality-high":
        _emuRecordingManager.setQualityPreference("high");
        break;
      case "set-quality-good":
        _emuRecordingManager.setQualityPreference("good");
        break;
      case "set-format-mp4":
        _emuRecordingManager.setFormatPreference("mp4");
        break;
      case "set-format-webm":
        _emuRecordingManager.setFormatPreference("webm");
        break;
      case "set-format-mkv":
        _emuRecordingManager.setFormatPreference("mkv");
        break;
      case "start-recording":
        _emuRecordingManager.arm(undefined, isRunning);
        break;
      case "disarm":
        await _emuRecordingManager.disarm();
        break;
      case "pause-recording":
        _emuRecordingManager.pauseRecording();
        break;
      case "resume-recording":
        _emuRecordingManager.resumeRecording();
        break;
    }
  }
}

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processMainToEmuMessages(
  message: RequestMessage,
  store: Store<AppState>,
  emuToMain: MessengerBase,
  appServices: AppServices
): Promise<ResponseMessage> {
  switch (message.type) {
    case "ForwardAction":
      // --- The emu sent a state change action. Replay it in the main store without formarding it.
      // --- This deliberately needs nothing but the store, so state broadcast from the main
      // --- process still lands while this window is still starting up and its app services do
      // --- not exist yet.
      store.dispatch(message.action, message.sourceId);
      break;

    case "ApiMethodRequest":
      const emuMessageProcessor = new EmuMessageProcessor(emuToMain, appServices.machineService);

      // --- We accept only methods defined in the MainMessageProcessor
      const processingMethod = emuMessageProcessor[message.method];
      if (typeof processingMethod === "function") {
        try {
          // --- Call the method with the given arguments. We do not call the
          // --- function through the mainMessageProcessor instance, so we need
          // --- to pass it as the "this" parameter.
          return {
            type: "ApiMethodResponse",
            result: await (processingMethod as Function).call(emuMessageProcessor, ...message.args)
          };
        } catch (err) {
          // --- Report the error. "No machine" while one is being rebuilt is expected - the IDE's
          // --- pollers ask again - so it is answered, not logged as a fault.
          if (!isMachineNotAvailableError(err)) {
            console.error(`Error processing message: ${err}`, err);
          }
          return errorResponse(err.toString());
        }
      }
      return errorResponse(`Unknown method ${message.method}`);
  }
  return defaultResponse();
}

let emuScriptRunner: EmuScriptRunner | undefined;

/**
 * Get the EmuScriptRunner instance
 */
function getEmuScriptRunner(): EmuScriptRunner {
  if (!emuScriptRunner) {
    emuScriptRunner = new EmuScriptRunner(getCachedStore(), getCachedMessenger());
  }
  return emuScriptRunner;
}

/**
 * The running machine as a ZX Spectrum Next, for a request only the Next panels make.
 * @param machine The running machine
 */
function requireZxNextIdeMachine(machine: unknown): IZxNextIdeMachine {
  if (!isZxNextIdeMachine(machine)) {
    throw new Error("This request needs a ZX Spectrum Next machine.");
  }
  return machine;
}

/**
 * The ULA panel's RAS and POS (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` T6): the beam's raster line and
 * its tact within the line, as the machine reports them; 0 and 0 for a machine without a beam.
 */
export function ulaRasterPosition(machine: Pick<IAnyMachine, "getBeamPosition">): { ras: number; pos: number } {
  const beam = machine.getBeamPosition?.();
  return beam ? { ras: beam.line, pos: beam.lineTact } : { ras: 0, pos: 0 };
}
