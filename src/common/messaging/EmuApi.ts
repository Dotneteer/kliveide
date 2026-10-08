import { PsgChipState } from "@emu/abstractions/PsgChipState";
import { MachineCommand } from "@abstractions/MachineCommand";
import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";
import { BreakpointInfo, BreakpointScope } from "@abstractions/BreakpointInfo";
import { SysVar } from "@abstractions/SysVar";
import { CodeToInject } from "@abstractions/CodeToInject";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { FloppyLogEntry } from "@abstractions/FloppyLogEntry";
import { MemoryPageInfo } from "@emu/machines/zxNext/nextMemoryLayout";
import { CallStackInfo } from "@emu/abstractions/CallStack";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { IMemorySection } from "@abstractions/MemorySection";
import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { SourceActivationInfo, SourceStopInfo } from "@abstractions/SourceDebugInfo";
import type { SourceStepKind } from "@emu/machines/SourceStepDecision";
import type { ExecutionHistoryInfo, ExecutionHistoryPage } from "@common/history/historyTypes";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";
import type { HistoryRegisters } from "@common/history/historyRecord";
import type {
  HistoricalCpuInfo,
  HistoryNavigationOp,
  HistoryNavigationOptions,
  HistoryNavigationResult
} from "@common/history/historyNavigation";
import type { Z88SnapshotLoadMode, Z88SnapshotLoadResult } from "@common/z88/z88SnapshotLoadTypes";
import type { TilemapRegs } from "@common/zxnext/tilemap/tilemapDecode";
import type { Layer2Regs } from "@common/zxnext/layer2/layer2Decode";
import type { NextLayerDebug, NextPixelProbe } from "@common/zxnext/layers/layerMix";
import type {
  SpectrumSnapshotLoadMode,
  SpectrumSnapshotLoadOptions,
  SpectrumSnapshotLoadResult
} from "@common/spectrum/snapshot/spectrumSnapshotLoadTypes";
import type { SpectrumSnapshotSaveResult } from "@common/spectrum/snapshot/spectrumSnapshotSaveTypes";
import type { SpectrumSnapshotFormat } from "@common/spectrum/snapshot/spectrumSnapshot";
import type { SzxCreator } from "@common/spectrum/snapshot/szxWriter";
import type {
  MachineStateLoadMode,
  MachineStateLoadResult,
  MachineStateSaveResult,
  SdCardFingerprint
} from "@common/machineState/machineStateTypes";

import type {
  RzxPlayMode,
  RzxPlayOptions,
  RzxPlayResult,
  RzxRecordResult,
  RzxRollbackResult,
  RzxStopRecordingResult,
  RzxVideoOptions
} from "@common/spectrum/rzx/rzxCommandTypes";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

/**
 * This class defines the shape of the Emu process API that can be called from
 * the main and Ide processes. The methods are called through a JavaScript proxy.
 */
class EmuApiImpl {
  /**
   * Sets the machine type and optional model/configuration.
   * @param _machineId The machine type ID.
   * @param _modelId Optional model ID.
   * @param _config Optional configuration object.
   */
  /**
   * @returns True if the requested machine became the live one; false if a later, concurrent
   * machine change superseded this call while it was still setting up.
   */
  async setMachineType(
    _machineId: string,
    _modelId?: string,
    _config?: Record<string, any>
  ): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Issues a machine command, optionally with a custom command string.
   * @param _command The machine command to issue.
   * @param _customCommand Optional custom command string.
   */
  async issueMachineCommand(_command: MachineCommand, _customCommand?: string): Promise<any> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Displays a registered EMU dialog.
   * @param _dialogId Numeric dialog ID.
   * @param _dialogData Optional dialog payload.
   */
  async displayDialog(_dialogId: number, _dialogData?: any): Promise<unknown | undefined> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets the tape file for the emulator.
   * @param _file The tape file name.
   * @param _contents The tape file contents as Uint8Array.
   * @param _confirm Optional flag to show confirmation.
   * @param _suppressError Optional flag to suppress errors.
   */
  async setTapeFile(
    _file: string,
    _contents: Uint8Array,
    _confirm?: boolean,
    _suppressError?: boolean
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Inserts a `.dck` cartridge into a Timex 2068's DOCK (`.plans/TIMEX_SCORPION_PLAN.md` G9.4b); a
   * running machine restarts, since the ROM looks for a cartridge when it starts
   * @param _file The cartridge file
   * @param _contents Its bytes
   * @returns Why it cannot be inserted, or undefined
   */
  async setDockFile(_file: string, _contents: Uint8Array): Promise<string | undefined> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /** Removes the cartridge from the DOCK; a running machine restarts */
  async ejectDock(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Loads a `.z88` (OZvm) snapshot into the emulator, rebuilding the machine as a Z88 that fits it
   * when needed (`.plans/Z88_SNAPSHOT_PLAN.md` §4.5).
   * @param _contents The `.z88` file
   * @param _mode "run": start; "debug": start debugging, stopping at the snapshot's PC before that
   * instruction runs
   * @returns What was loaded; rejects with the reason when the snapshot cannot be loaded
   */
  async loadZ88Snapshot(
    _contents: Uint8Array,
    _mode: Z88SnapshotLoadMode
  ): Promise<Z88SnapshotLoadResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Loads a ZX Spectrum `.sna` / `.z80` / `.szx` snapshot into the emulator, switching to the
   * machine it needs (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.5).
   * @param _fileName The snapshot's file name (its extension picks the format)
   * @param _contents The snapshot file
   * @param _mode "run": start; "debug": start debugging, stopping at the snapshot's PC before that
   * instruction runs
   * @param _options `keepModel` (a project is open) and the disks the IDE read for a `.szx` file
   * @returns What was loaded; rejects with the reason when the snapshot cannot be loaded
   */
  async loadSpectrumSnapshot(
    _fileName: string,
    _contents: Uint8Array,
    _mode: SpectrumSnapshotLoadMode,
    _options?: SpectrumSnapshotLoadOptions & {
      disks?: { drive: number; fileName: string; contents: Uint8Array }[];
    }
  ): Promise<SpectrumSnapshotLoadResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Plays an RZX input recording, switching to the machine it needs (`.plans/RZX_PLAN.md` §4.5)
   * @param _fileName The file's name, for messages
   * @param _contents The `.rzx` file
   * @param _mode "run", or "debug" (stop at the snapshot's PC before that instruction runs)
   * @param _options Keep the project's model; the segment to start at
   */
  async playRzx(
    _fileName: string,
    _contents: Uint8Array,
    _mode: RzxPlayMode,
    _options?: RzxPlayOptions
  ): Promise<RzxPlayResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Renders an RZX recording to video with the screen recorder (`.plans/RZX_PLAN.md` §4.7). Returns
   * once rendering has started; the video stops by itself at the recording's end or a desync.
   */
  async renderRzxToVideo(
    _fileName: string,
    _contents: Uint8Array,
    _options?: RzxVideoOptions
  ): Promise<RzxPlayResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Starts recording an RZX file from the machine's current state (D16)
   * @param _creator The program and version written into the file
   */
  async startRzxRecording(_creator: { name: string; major: number; minor: number }): Promise<RzxRecordResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /** Stops the RZX recording and returns the finalised file; the machine stays paused */
  async stopRzxRecording(): Promise<RzxStopRecordingResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /** Throws the RZX recording away */
  async discardRzxRecording(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Rolls the RZX recording back
   * @param _back 1: the latest rollback point, 2: the one before it, ...
   */
  async rollbackRzxRecording(_back?: number): Promise<RzxRollbackResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /** Inserts a rollback point at the next frame end */
  async insertRzxRollbackPoint(): Promise<{ frame: number }> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Saves the running ZX Spectrum 48K, 128K or +2E/+3E as a `.sna`, `.z80` or `.szx` snapshot
   * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.3). A running machine is paused for the
   * capture and runs on afterwards; a paused one stays paused.
   * @param _format The file format
   * @param _creator The program a `.szx` file names as its creator
   * @returns The file's bytes and what the format could not hold; rejects with the reason when the
   * machine cannot be saved in that format
   */
  async saveSpectrumSnapshot(
    _format: SpectrumSnapshotFormat,
    _creator?: SzxCreator
  ): Promise<SpectrumSnapshotSaveResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Saves the machine's complete state as a Klive state file (`.kls`;
   * `.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.8). A running machine runs on afterwards.
   * @param _options The Klive version for the header; the Next SD card's fingerprint
   * @returns The file; rejects when the machine has no state or cannot save one
   */
  async saveMachineStateFile(_options: {
    kliveVersion: string;
    sdCard?: SdCardFingerprint;
  }): Promise<MachineStateSaveResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Loads a Klive state file, switching to the machine it was saved on, then runs or debugs it.
   * @param _fileName The file's name, for messages
   * @param _contents The file
   * @param _mode "run", or "debug" (stop at PC before that instruction runs)
   * @param _options The live SD card's fingerprint; load even when it has changed
   */
  async loadMachineStateFile(
    _fileName: string,
    _contents: Uint8Array,
    _mode: MachineStateLoadMode,
    _options?: { currentSdCard?: SdCardFingerprint; acceptChangedSdCard?: boolean }
  ): Promise<MachineStateLoadResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Saves the machine's state into its in-memory quick slot (D19 of
   * `.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md`); a running machine runs on.
   */
  async quickSaveMachineState(): Promise<{ machineName: string; pc: number }> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Restores the machine's quick-saved state and leaves it Paused; rejects when there is none.
   */
  async quickRestoreMachineState(): Promise<{ pc: number }> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets the disk file for the specified drive.
   * @param _diskIndex The disk drive index.
   * @param _file Optional disk file name.
   * @param _contents Optional disk file contents.
   * @param _confirm Optional flag to show confirmation.
   * @param _suppressError Optional flag to suppress errors.
   */
  async setDiskFile(
    _diskIndex: number,
    _file?: string,
    _contents?: Uint8Array,
    _confirm?: boolean,
    _suppressError?: boolean
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets write protection for a disk drive.
   * @param _index The disk drive index.
   * @param _protect True to enable write protection.
   */
  async setDiskWriteProtection(_index: number, _protect: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * The Pentagon's TR-DOS disk in a drive as a `.trd` image, with the guest's writes (to save an
   * `.scl` disk, which is never written back); undefined without a Beta 128 or a disk
   */
  async getTrdosDiskImage(_index: number): Promise<Uint8Array | undefined> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current CPU state. While the history cursor is in the past it is the state at the
   * cursor (`.plans/LITE_STEP_BACK_PLAN.md` D2), with `history` set; `present` asks for the live one.
   */
  async getCpuState(_options?: { present?: boolean }): Promise<CpuState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current ULA state.
   */
  async getUlaState(): Promise<UlaState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current PSG chip state.
   */
  async getPsgState(): Promise<PsgChipState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current Blink device state.
   */
  async getBlinkState(): Promise<BlinkState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Erases all breakpoints in the emulator.
   */
  async eraseAllBreakpoints(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets a breakpoint in the emulator.
   * @param _breakpoint The breakpoint information.
   */
  async setBreakpoint(_breakpoint: BreakpointInfo): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Removes a breakpoint from the emulator.
   * @param _breakpoint The breakpoint information.
   */
  async removeBreakpoint(_breakpoint: BreakpointInfo): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Lists all breakpoints in the emulator.
   */
  async listBreakpoints(): Promise<BreakpointsInfo> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Enables or disables a breakpoint.
   * @param _breakpoint The breakpoint information.
   * @param _enable True to enable, false to disable.
   */
  async enableBreakpoint(_breakpoint: BreakpointInfo, _enable: boolean): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the memory contents for the specified partition.
   * @param _partition Optional memory partition index.
   */
  async getMemoryContents(_partition?: number): Promise<MemoryInfo> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the system variables.
   */
  async getSysVars(): Promise<SysVar[]> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Injects code into the emulator.
   * @param _codeToInject The code to inject.
   */
  async injectCodeCommand(_codeToInject: CodeToInject): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Runs code in the emulator, optionally in debug mode.
   * @param _codeToInject The code to run.
   * @package _additionalInfo Additional information for code execution.
   * @param _debug True to run in debug mode.
   * @param _projectDebug True to use project debug mode.
   */
  async runCodeCommand(
    _codeToInject: CodeToInject,
    _additionalInfo: any,
    _debug: boolean,
    _projectDebug: boolean
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Resets the machine and starts the tape in its deck loading: types `LOAD ""` on a 48K, chooses
   * the Tape Loader on a 128K or +2/+3. The tape must already be inserted (`MainApi.setTapeFile`).
   * @param _debug Arm the breakpoints once the keystrokes are typed
   */
  async startDiskBoot(_debug: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  async startTapeLoad(_debug: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Resolves breakpoints in the emulator.
   * @param _breakpoints The breakpoints to resolve.
   */
  async resolveBreakpoints(_breakpoints: ResolvedBreakpoint[]): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Scrolls breakpoints by a shift value within bounds.
   * @param _addr The breakpoint address info.
   * @param _shift The shift value.
   * @param _lowerBound Optional lower bound.
   * @param _upperBound Optional upper bound.
   */
  async scrollBreakpoints(
    _addr: BreakpointInfo,
    _shift: number,
    _lowerBound?: number,
    _upperBound?: number
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Zeroes one breakpoint's hit counter, or every counter when no breakpoint is given.
   * @param _breakpoint The breakpoint whose counter to reset
   * @returns False when the breakpoint does not exist
   */
  async resetBreakpointHits(_breakpoint?: BreakpointInfo): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Replaces the program symbols breakpoint conditions bind their labels to (integer symbols of the
   * last successful build, keyed lower-case; NEX bank-local labels keyed `<bank>:<name>`).
   * @param _symbols The symbol table
   */
  async setConditionSymbols(_symbols: Record<string, number>): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Replaces the breakpoints owned by `_scope`, leaving every other owner's alone.
   * @param _bps The breakpoints to install for this scope.
   * @param _scope Which existing breakpoints this call may remove.
   */
  async resetBreakpointsTo(_bps: BreakpointInfo[], _scope: BreakpointScope): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Replaces the breakpoints owned by `_scope` atomically, preserving each breakpoint's disabled
   * state. Prefer this over erasing and re-adding breakpoints one by one, which lets concurrent
   * breakpoint edits be lost between the individual calls.
   * @param _bps The breakpoints to install for this scope.
   * @param _scope Which existing breakpoints this call may remove.
   */
  async restoreBreakpoints(_bps: BreakpointInfo[], _scope: BreakpointScope): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Normalizes breakpoints for a resource and line count.
   * @param _resource The resource (file) name.
   * @param _lineCount The number of lines in the resource.
   */
  async normalizeBreakpoints(_resource: string, _lineCount: number): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the state of the NEC UPD765 floppy controller.
   */
  async getNecUpd765State(): Promise<FloppyLogEntry[]> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Starts a script in the emulator.
   * @param _id The script ID.
   * @param _scriptFile The script file name.
   * @param _contents The script contents.
   */
  async startScript(_id: number, _scriptFile: string, _contents: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Stops a running script in the emulator.
   * @param _id The script ID.
   */
  async stopScript(_id: number): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the Next register descriptors.
   */
  async getNextRegDescriptors(): Promise<NextRegDescriptors> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the Next register state.
   */
  async getNextRegState(): Promise<NextRegState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * What the execution-history ring holds (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.4), or
   * undefined when the machine does not record history.
   */
  async getHistoryInfo(): Promise<ExecutionHistoryInfo | undefined> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Up to `count` consecutive history records from `fromSequence` on, raw (`decodeHistoryPage`
   * reads them), or undefined when the machine does not record history.
   */
  async getHistoryRecords(_fromSequence: number, _count: number): Promise<ExecutionHistoryPage | undefined> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * The outermost interrupt service spans of the held history records, for the viewer to fold
   * (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` D10), or undefined when the machine does not
   * record history.
   */
  async getHistoryServiceSpans(): Promise<HistoryServiceSpan[] | undefined> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Empties the execution-history ring.
   */
  async clearHistory(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Moves the history cursor (`.plans/LITE_STEP_BACK_PLAN.md` D4): Step Back, Step Forward, Reverse
   * Step Over/Out, Reverse Continue, Return to Present, or to a record. Never changes the machine.
   */
  async navigateHistory(
    _op: HistoryNavigationOp,
    _options?: HistoryNavigationOptions
  ): Promise<HistoryNavigationResult> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Take over here (`.plans/REVERSE_DEBUGGING_PLAN.md` D12): the point in the past the machine
   * stands at becomes the present. False when the machine is not in the past.
   */
  async takeOverHere(): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the ZX Spectrum Next Copper's state: its list RAM, mode, pointers and beam.
   */
  async getCopperState(): Promise<CopperState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the ZX Spectrum Next sprite state the Sprite Inspector shows: the raw attribute and pattern
   * memories, the core-resolved table and the global sprite registers. Reading it never changes the
   * machine.
   */
  async getNextSpriteState(): Promise<NextSpriteState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the ZX Spectrum Next tilemap state the Tilemap Inspector shows: the registers and copies of
   * banks 5 and 7. Reading it never changes the machine.
   */
  async getNextTilemapState(): Promise<NextTilemapState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the ZX Spectrum Next Layer 2 state the Layer 2 Inspector shows: the registers and a copy of
   * the five 16K banks from `$12`, and from `$13` when `shadow` is set. Reading it never changes the
   * machine.
   */
  async getNextLayer2State(_options?: { shadow?: boolean }): Promise<NextLayer2State> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the ZX Spectrum Next layer state the Layers document shows
   * (`.plans/LAYER_COMPOSITION_PLAN.md` D9): the mixer registers, the clip windows, the debug view
   * and, with `thumbnails`, one picture per layer from the capture, in the screen's shape. Reading it never
   * changes the machine.
   */
  async getNextLayerState(_options?: { thumbnails?: boolean }): Promise<NextLayerState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * The pixel probe (D7): which layer produced buffer pixel (x, y) of the paused picture, and why.
   */
  async probeNextPixel(_x: number, _y: number): Promise<NextPixelProbe> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * "Step Copper": runs the ZX Spectrum Next in debug mode until the Copper completes its next
   * instruction, then stops at the end of that Z80 instruction.
   */
  async stepCopper(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the Next memory mapping state.
   */
  async getNextMemoryMapping(): Promise<NextMemoryMapping> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Parses a partition label.
   * @param _label The partition label to parse.
   */
  async parsePartitionLabel(_label: string): Promise<any> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets all partition labels.
   */
  async getPartitionLabels(): Promise<Record<number, string>> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets a human-readable name for each partition, keyed like `getPartitionLabels()`.
   *
   * Presentation only: the label identifies a partition, the description spells it out. May be
   * empty for a machine that supplies none.
   */
  async getPartitionDescriptions(): Promise<Record<number, string>> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the caption each partition sits under in a chooser, keyed like `getPartitionLabels()`.
   */
  async getPartitionGroups(): Promise<Record<number, string>> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current call stack information.
   */
  async getCallStack(): Promise<CallStackInfo> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Hands the emulator the injected program's source-level debug info (plan §10.2): with it, Step
   * Into/Over/Out step statements. Undefined for a program without it.
   */
  async setSourceDebugInfo(_info?: SourceLevelDebugInfo): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Selects source stepping (true) or Z80 instruction stepping (false) for a program with
   * source-level debug info.
   */
  async setSourceStepping(_source: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * A source-level step: into, over, out, over the line, to a call-stack frame (`targetFrame`), or
   * into a chosen call of the statement (`targetCallable`). Returns once the step has started.
   */
  async sourceStep(_kind: SourceStepKind, _options?: { targetFrame?: number; targetCallable?: number }): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /** Whether Step Into/Over/Out step source statements (true) or Z80 instructions (false). */
  async getSourceStepping(): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /** Where the paused program stands at source level (undefined without source-level info). */
  async getSourceStopInfo(): Promise<SourceStopInfo | undefined> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /** The symbolic call stack, innermost first (undefined without source-level info). */
  async getSourceCallStack(): Promise<SourceActivationInfo[] | undefined> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets the key status (pressed/released) for a key.
   * @param _key The key code.
   * @param _isDown True if the key is pressed.
   */
  async setKeyStatus(_key: number, _isDown: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets palette device information.
   */
  async getPalettedDeviceInfo(): Promise<PaletteDeviceInfo> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets a register value in the emulator.
   * @param _register The register name.
   * @param _value The value to set.
   */
  async setRegisterValue(_register: string, _value: number): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets memory content at a specific address.
   * @param _address The memory address.
   * @param _value The value to set.
   * @param _size The size in bytes.
   * @param _bigEndian True for big-endian byte order.
   */
  async setMemoryContent(
    _address: number,
    _value: number,
    _size: number,
    _bigEndian: boolean
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the ROM flags array.
   */
  async getRomFlags(): Promise<boolean[]> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets a chunk of the CPU state.
   */
  async getCpuStateChunk(): Promise<CpuStateChunk> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Renames breakpoints for a resource.
   * @param _oldResource The old resource name.
   * @param _newResource The new resource name.
   */
  async renameBreakpoints(_oldResource: string, _newResource: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current VIC state.
   */
  async getVicState(): Promise<VicState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets a disassembly section of the machine with the specified options.
   * @param _options The options for the disassembly section.
   * @returns The disassembly section.
   */
  async getDisassemblySections(_options: Record<string, any>): Promise<IMemorySection[]> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Issues a recording command to the emu renderer's RecordingManager.
   * @param _command The recording command to execute.
   */
  async issueRecordingCommand(
    _command:
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
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }
}

// --- The response with the CPU state chunk
export type CpuStateChunk = {
  state: MachineControllerState;
  /** The PC at the history cursor while it is in the past (D3) */
  pcValue: number;
  tacts: number;
  /** The history cursor's steps back from the present; 0 or absent at the present */
  historyPosition?: number;
};

// --- The response with the CPU state information
export type Z80CpuState = {
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  pc: number;
  sp: number;
  ix: number;
  iy: number;
  ir: number;
  wz: number;
  tacts: number;
  tactsAtLastStart: number;
  interruptMode: number;
  iff1: boolean;
  iff2: boolean;
  sigINT: boolean;
  halted: boolean;
  snoozed: boolean;
  opStartAddress: number;
  lastMemoryReads: Uint16Array;
  lastMemoryReadValue: number;
  lastMemoryWrites: Uint16Array;
  lastMemoryWriteValue: number;
  lastIoReadPort: number;
  lastIoReadValue: number;
  lastIoWritePort: number;
  lastIoWriteValue: number;
  /**
   * The memory partition PC is in (a paged bank or ROM), or `undefined` on a machine without
   * partitions: which of several sources sharing an address is executing (plan §10.4).
   */
  pcPartition?: number;
  /**
   * The NextReg write the machine last stopped on. ZX Spectrum Next only, and absent until a
   * NextReg write breakpoint fires.
   *
   * Carries the value the register held *before* the write as well as the one written: the machine
   * stops at the end of the instruction that performed it, so showing both is what makes a NextReg
   * breakpoint read as "before" without the core having to withhold the write.
   */
  lastNextRegWrite?: NextRegWriteEvent;
  /**
   * The Copper instruction the machine last stopped on. ZX Spectrum Next only, and absent until a
   * Copper breakpoint (`cu:`) or a Copper step fires.
   */
  lastCopperHit?: CopperHitEvent;
  /**
   * Set while the history cursor is in the past (`.plans/LITE_STEP_BACK_PLAN.md` D2, T9): the
   * registers, flags, interrupt state and PC partition are the record's; `tacts`, the last memory
   * and I/O accesses and `opStartAddress` are not in a record and must be shown as unknown.
   */
  history?: HistoricalCpuInfo;
};

/**
 * A Copper instruction a breakpoint stopped on; see `Z80CpuState.lastCopperHit`.
 *
 * The Copper keeps running to the end of the Z80 instruction during which the hit happened, so the
 * Copper's PC at the stop may be well past `index` (COPPER_DEBUGGING_PLAN trap T1). The event
 * therefore carries the beam position of the hit itself.
 */
export type CopperHitEvent = {
  /** The list index of the instruction that completed (0..$3FF) */
  index: number;
  kind: "wait" | "move" | "nop";
  /** The instruction word at the time of the hit */
  word: number;
  /** `cvc` at the hit */
  line: number;
  /** `hc_ula` at the hit */
  hc: number;
  /** The first byte of the Z80 instruction during which the hit happened */
  pc: number;
  /** The memory partition `pc` was in, if the machine has partitions */
  partition?: number;
};

/**
 * The ZX Spectrum Next sprites, as the Sprite Inspector reads them in one call
 * (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.3, D2). Not `SpriteInfo`: that name is the C64 VIC type.
 */
export type NextSpriteState = {
  /** 128 slots x 5 attribute bytes, a copy */
  attributes: Uint8Array;
  /** The 16K pattern RAM in its raw layout: 8-bit pattern N at N * 256 (trap T2) */
  patterns: Uint8Array;
  /** 128 x 8 bytes: the core's effective values, relatives composed (D4); `decodeResolvedSprites` */
  resolved: Uint8Array;
  /** The highest slot with its visible bit set, -1 when none */
  lastVisible: number;
  /** `$15` */
  control: number;
  /** `$19`: x1, x2, y1, y2 */
  clip: [number, number, number, number];
  /** The `$1C` sprite clip index: which `$19` value the next write sets */
  clipIndex: number;
  /** `$4B` */
  transparencyIndex: number;
  /** `$303B`, peeked without clearing it (trap T1) */
  status: { tooMany: boolean; collision: boolean };
  /** Where the next port write goes (trap T12) */
  upload: {
    /** Port `$57`'s sprite and attribute byte */
    spriteIndex: number;
    spriteSub: number;
    /** Port `$5B`'s 256-byte slot and byte within it */
    patternIndex: number;
    patternSub: number;
    /** `$34`, the NextReg attribute mirror's sprite (bit 7 included) */
    mirrorIndex: number;
    /** `$09` bit 4: the mirror and the upload index are tied */
    tied: boolean;
  };
  /** `$43` bit 3: the sprite palette in use (0: first, 1: second) */
  spritePaletteBank: 0 | 1;
};

/**
 * The ZX Spectrum Next tilemap, as the Tilemap Inspector reads it in one call
 * (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.3, D2).
 */
export type NextTilemapState = {
  regs: TilemapRegs;
  /** A 16K copy of bank 5 (physical $054000) */
  bank5: Uint8Array;
  /** A 16K copy of bank 7 (physical $05C000); the tilemap reads only its first 8K (T1) */
  bank7: Uint8Array;
  /**
   * The physical read offset of each 8K Z80 slot, so the inspector can show an entry's Z80 address
   * only when its page is mapped (T1), whatever pages it (ROM, DivMMC, MMU)
   */
  slotOffsets: number[];
  /** `$62` bits 7-6 are non-zero: register values may change per line (T10) */
  copperRunning: boolean;
};

/**
 * The ZX Spectrum Next's Layer 2, as the Layer 2 Inspector reads it in one call
 * (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.3, D2).
 */
/**
 * The ZX Spectrum Next's layer mixer as the Layers document and strip read it
 * (`.plans/LAYER_COMPOSITION_PLAN.md` §4.4, D9).
 */
export type NextLayerState = {
  regs: NextLayerRegs;
  /** The debug view in force in the core */
  debug: NextLayerDebug;
  /** Capture is on (§4.3) */
  capture: boolean;
  /** The buffer row of the ULA paper's top line (48 at 50 Hz, 24 at 60 Hz) */
  paperBufferY: number;
  /**
   * One picture per layer and the composite, when asked: 360 x 288 RGBA, every other buffer column and
   * every row, so square pixels give the screen's shape (a buffer pixel is 0.5:1)
   */
  thumbnails?: NextLayerThumbnails;
};

/** The registers the mixer and the four clip windows read */
export type NextLayerRegs = {
  /** `$15` bits 4-2 */
  priorities: number;
  /** `$68` bits 6-5 */
  blendMode: number;
  /** `$68` bit 0 */
  stencil: boolean;
  /** Not `$68` bit 7 */
  ulaEnabled: boolean;
  /** `$15` bit 7 */
  loRes: boolean;
  /** `$6B` bit 7 */
  tilemapEnabled: boolean;
  /** `$6B` bit 0: the tilemap on top of the ULA everywhere */
  tilemapOnTop: boolean;
  layer2Enabled: boolean;
  /** `$70` bits 5-4 */
  layer2Resolution: number;
  /** `$15` bit 0 */
  spritesEnabled: boolean;
  /** `$15` bit 1 */
  spritesOverBorder: boolean;
  /** `$15` bit 5 */
  spritesClipping: boolean;
  /** `$14` */
  globalTransparency: number;
  /** `$4A` */
  fallback: number;
  /** `$1A`, `$18`, `$19`, `$1B`: x1, x2, y1, y2 */
  ulaClip: [number, number, number, number];
  layer2Clip: [number, number, number, number];
  spriteClip: [number, number, number, number];
  tilemapClip: [number, number, number, number];
  /** `$62` bits 7-6 are non-zero: registers may change per line */
  copperRunning: boolean;
};

export type NextLayerThumbnails = {
  width: number;
  height: number;
  ula: Uint8ClampedArray;
  tm: Uint8ClampedArray;
  l2: Uint8ClampedArray;
  spr: Uint8ClampedArray;
  /** The machine's own picture, composed with no debug view in force */
  composite: Uint8ClampedArray;
};

export type NextLayer2State = {
  regs: Layer2Regs;
  /**
   * 128K from `$12` (`LAYER2_READ_BYTES`): the widest layer's 80K, so a resolution switch needs no
   * re-read, and the three banks after it, which a scroll can make the display read (T4); zero past 2 MB
   */
  displayed: Uint8Array;
  /** 128K from `$13`, only when requested (T9); zero past 2 MB */
  shadow?: Uint8Array;
  /** The physical read offset of each 8K Z80 slot, for a pixel's Z80 address (D6) */
  slotOffsets: number[];
  /** `$62` bits 7-6 are non-zero: register values may change per line (T10) */
  copperRunning: boolean;
};

/** The ZX Spectrum Next Copper, as the IDE's Copper views read it (COPPER_DEBUGGING_PLAN §4.3). */
export type CopperState = {
  /** The 2K list RAM, a copy: 1024 big-endian words */
  ram: Uint8Array;
  /** `$62` bits 7-6 */
  startMode: number;
  /** The list address (the Copper's PC), 0..$3FF */
  pc: number;
  /** The CPU's `$60`/`$63` write pointer, in bytes, 0..$7FF */
  writeAddress: number;
  /** `$64`, the vertical line offset */
  lineOffset: number;
  /** The Copper beam at the CPU's current tact, and whether the Copper is in a WAIT */
  beam: { line: number; hc: number; waiting: boolean };
  /**
   * The live timing: `cvc` lines in a frame, `hc_ula` positions in a line, and how many of the
   * frame's last `cvc` lines are the visible upper border (the paper is `cvc` 0-191)
   */
  timing: { lines: number; hcs: number; upperBorder?: number };
  /** The stop's hit, when the last stop was a Copper breakpoint */
  lastHit?: CopperHitEvent;
};

/** A NextReg write a breakpoint stopped on; see `Z80CpuState.lastNextRegWrite`. */
export type NextRegWriteEvent = {
  reg: number;
  oldValue: number;
  newValue: number;
  origin: "cpu" | "copper";
  /**
   * The first byte of the instruction that performed the write.
   *
   * Carried on the event rather than left to be read off the paused machine, because for the one
   * register where it matters most it cannot be: writing `$02` asks the machine to reset, and the
   * reset discards both the program counter and the paging. The breakpoint stops before the reset
   * is applied and records this then.
   *
   * For a copper write there is no writing instruction; this is where the CPU happened to be.
   */
  pc: number;
  /**
   * The memory partition `pc` was in when the write happened, or `undefined` on a machine with no
   * partitions.
   *
   * The other half of "who wrote this": on a Next, the same address means different code depending
   * on what is paged there, so an address alone does not identify the instruction.
   */
  partition?: number;
};

// --- The response with the CPU state information
export type M6510CpuState = {
  a: number;
  x: number;
  y: number;
  p: number;
  pc: number;
  sp: number;
  tacts: number;
  tactsAtLastStart: number;
  stalled: boolean;
  jammed: boolean;
  nmiRequested: boolean;
  irqRequested: boolean;
  opStartAddress: number;
  lastMemoryReads: number[];
  lastMemoryReadValue: number;
  lastMemoryWrites: number[];
  lastMemoryWriteValue: number;
  lastIoReadPort: number;
  lastIoReadValue: number;
  lastIoWritePort: number;
  lastIoWriteValue: number;
};

// --- The response with the CPU state information
export type CpuState = Z80CpuState | M6510CpuState;

/**
 * Border colour names, indexed by the 3-bit ULA border value.
 *
 * Beside `UlaState` because `bor` is declared a *name*, not an index, and two different producers
 * fill this type — `MainToEmuProcessor` for the interpreted machines and `ZxNextWasmV2Machine` for
 * the WASM core. The WASM one was putting the raw index in, so the ULA panel showed a bare digit
 * where the other showed "Cyan". A table each is how that happened; one table is how it stops.
 */
/**
 * The error the emulator answers a machine request with while it has no machine controller: the
 * moment between tearing a machine down and finishing the setup of the next one, when the machine
 * type, model or a configuration that rebuilds the machine (a Z88 LCD size) changes. It is expected,
 * not a fault: the IDE's pollers skip that round and ask again (`isMachineNotAvailableError`).
 */
export const MACHINE_NOT_AVAILABLE_MESSAGE = "Machine controller not available";

/**
 * Whether an error is the emulator's "no machine yet" answer. The message crosses the process
 * boundary as text (`MessageProxy` rethrows an error response as `new Error(message)`), so it is
 * recognised by its message.
 * @param error A caught error
 */
export function isMachineNotAvailableError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(MACHINE_NOT_AVAILABLE_MESSAGE);
}

export const ULA_BORDER_COLOR_NAMES = [
  "Black",
  "Blue",
  "Red",
  "Magenta",
  "Green",
  "Cyan",
  "Yellow",
  "White"
] as const;

export type UlaState = {
  fcl: number;
  frm: number;
  ras: number;
  pos: number;
  pix: string;
  bor: string;
  flo: number;
  con: number;
  lco: number;
  ear: boolean;
  mic: boolean;
  keyLines: number[];
  romP: number;
  ramB: number;
};

export type BlinkState = {
  SR0: number;
  SR1: number;
  SR2: number;
  SR3: number;
  TIM0: number;
  TIM1: number;
  TIM2: number;
  TIM3: number;
  TIM4: number;
  TSTA: number;
  TMK: number;
  INT: number;
  STA: number;
  COM: number;
  EPR: number;
  keyLines: number[];
  oscBit: boolean;
  earBit: boolean;
  PB0: number;
  PB1: number;
  PB2: number;
  PB3: number;
  /** Screen Base File: the 16-bit register value */
  SBF: number;
  SCW: number;
  SCH: number;
};

export type SpriteInfo = {
  x: number;
  y: number;
  enabled: boolean;
  multicolor: boolean;
  color: number;
  xExpansion: boolean;
  yExpansion: boolean;
  foregroundPriority: boolean;
};

export type VicState = {
  vicBaseAddress: number;
  spriteInfo: SpriteInfo[];
  rst8: boolean;
  ecm: boolean;
  bmm: boolean;
  den: boolean;
  rsel: boolean;
  xScroll: number;
  yScroll: number;
  raster: number;
  lpx: number;
  lpy: number;
  res: boolean;
  mcm: boolean;
  csel: boolean;
  scrMemOffset: number;
  colMemOffset: number;
  irqStatus: boolean;
  ilpStatus: boolean;
  ilpEnabled: boolean;
  immcStatus: boolean;
  immcEnabled: boolean;
  imbcStatus: boolean;
  imbcEnabled: boolean;
  irstStatus: boolean;
  irstEnabled: boolean;
  borderColor: number;
  bgColor0: number;
  bgColor1: number;
  bgColor2: number;
  bgColor3: number;
  spriteMcolor0: number;
  spriteMcolor1: number;
  spriteSpriteCollision: number;
  spriteDataCollision: number;
};

// --- The response with the breakpoints set in the emulator
export type BreakpointsInfo = {
  breakpoints: BreakpointInfo[];
  memorySegments?: number[][];
};

// --- The response with the memory contents
export type MemoryInfo = {
  memory: Uint8Array;
  pc: number;
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  sp: number;
  ix: number;
  iy: number;
  ir: number;
  wz: number;
  partitionLabels: string[];
  selectedRom?: number;
  selectedBank?: number;
  osInitialized: boolean;
  memBreakpoints: BreakpointInfo[];
  /**
   * Set while the history cursor is in the past (`.plans/LITE_STEP_BACK_PLAN.md` T2): the
   * registers above are the present's, these are the cursor's, and `bytes` are the bytes the CPU
   * decoded at `pc` then - the disassembly marks the row when memory there has changed since.
   */
  history?: { position: number; pc: number; regs: HistoryRegisters; bytes: number[]; partition?: number };
};

// --- The response with the Next register descriptors
export type NextRegDescriptors = {
  descriptors: {
    id: number;
    description: string;
    isReadOnly?: boolean;
    isWriteOnly?: boolean;
    slices?: {
      mask?: number;
      shift?: number;
      description?: string;
      valueSet?: Record<number, string>;
      view?: "flag" | "number";
    }[];
  }[];
};

// --- The response with the Next register device state
export type NextRegState = {
  lastRegisterIndex: number;
  regs: {
    id: number;
    lastWrite?: number;
    value?: number;
  }[];
};

// --- The response with the Next register device state
export type NextMemoryMapping = {
  /**
   * The four 16K banks visible in all-RAM mode, or absent when the machine is not in it.
   *
   * Spelled `allRamsBanks` until now, while both producers wrote `allRamBanks` — so the Memory
   * Mapping panel's "All RAM" row read `Off` unconditionally. A silent mismatch rather than a type
   * error because the producers build this object as a literal for a structurally-typed target,
   * where an unknown extra property is only rejected on a *direct* literal assignment.
   */
  allRamBanks?: number[];
  selectedRom: number;
  selectedBank: number;
  port7ffd: number;
  port1ffd: number;
  portDffd: number;
  portEff7: number;
  portLayer2: number;
  portTimex: number;
  divMmc: number;
  divMmcIn: boolean;
  pageInfo: MemoryPageInfo[];
};

// --- The response with the Next palette device state
export type PaletteDeviceInfo = {
  ulaFirst: number[];
  ulaSecond: number[];
  layer2First: number[];
  layer2Second: number[];
  spriteFirst: number[];
  spriteSecond: number[];
  tilemapFirst: number[];
  tilemapSecond: number[];
  storedPaletteValue: number;
  /**
   * The sprite palette index the sprite engine treats as transparent (Next Reg $4B).
   *
   * An *index*, unlike the ULA/Layer 2 case: Next Reg $14 is a global transparency **colour**,
   * matched against a pixel's 8-bit value rather than naming a palette slot, so there is no single
   * entry to mark for those two devices and none is reported here.
   */
  spriteTransparencyIndex: number;
  /** The tilemap palette index treated as transparent (Next Reg $4C). */
  tilemapTransparencyIndex: number;
  reg43Value: number;
  reg6bValue: number;
  ulaNextFormat: number;
};

export type EmuApi = EmuApiImpl;

/**
 * Emulator-process methods whose duration is genuinely unbounded, and which therefore opt out of
 * the default request timeout. Everything else - including `setMachineType`, whose WASM setup is
 * slow but bounded - stays covered, so a lost response surfaces as an error instead of hanging.
 */
const UNBOUNDED_EMU_METHODS = [
  // --- Blocks until the user responds
  "displayDialog",
  // --- Project startup can wait on emulated ROM/OS execution; a later stop command cancels it
  "runCodeCommand",
  // --- Reaches the editor or the start-up menu by running the ROM, like `runCodeCommand`
  "startTapeLoad",
  "startDiskBoot",
  // --- Script lifetime is controlled by the script/user, not by this call
  "startScript",
  "stopScript"
] as const;

export function createEmuApi(messenger: MessengerBase): EmuApiImpl {
  return buildMessagingProxy(new EmuApiImpl(), messenger, "emu", {
    unboundedMethods: UNBOUNDED_EMU_METHODS
  });
}
