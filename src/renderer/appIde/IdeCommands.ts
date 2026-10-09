import {
  RzxPlayCommand,
  RzxRecordCommand,
  RzxRollbackCommand,
  RzxRollbackPointCommand,
  RzxStopCommand,
  RzxVideoCommand
} from "./commands/RzxCommands";
import {
  TestDebugCommand,
  TestInitCommand,
  TestJUnitCommand,
  TestListCommand,
  TestRunCommand
} from "./commands/UnitTestCommands";
import { IIdeCommandService } from "../abstractions/IIdeCommandService";
import {
  EraseAllBreakpointsCommand,
  ListBreakpointsCommand,
  SetBreakpointCommand,
  RemoveBreakpointCommand,
  EnableBreakpointCommand,
  ResetBreakpointHitsCommand,
  EnableLogpointGroupsCommand,
  EnableAssertionCommentsCommand,
  EnableWpmemCommentsCommand,
  ListLogpointGroupsCommand
} from "./commands/BreakpointCommands";
import {
  AddWatchCommand,
  RemoveWatchCommand,
  ListWatchCommand,
  EraseAllWatchCommand
} from "./commands/WatchCommands";
import { ClearHistoryCommand } from "./commands/ClearHistoryCommand";
import { ClearScreenCommand } from "./commands/ClearScreenCommand";
import { CloseFolderCommand } from "./commands/CloseFolderCommand";
import { DisassemblyCommand } from "./commands/DisassemblyCommand";
import {
  StartMachineCommand,
  PauseMachineCommand,
  StopMachineCommand,
  RestartMachineCommand,
  StartDebugMachineCommand,
  StepIntoMachineCommand,
  StepOverMachineCommand,
  StepOutMachineCommand,
  StepOverLineMachineCommand,
  StepIntoTargetMachineCommand,
  RunToFrameMachineCommand,
  SourceSteppingMachineCommand,
  ErrorStopsMachineCommand,
  JustMyCodeMachineCommand
} from "./commands/MachineCommands";
import { NewProjectCommand } from "./commands/NewProjectCommand";
import {
  ClearNavigationHistoryCommand,
  NavigateBackCommand,
  NavigateForwardCommand,
  NavigationHistoryCommand
} from "./commands/NavigationCommands";
import { NumCommand } from "./commands/NumCommand";
import { OpenFolderCommand } from "./commands/OpenFolderCommand";
import {
  CompileCommand,
  DebugCodeCommand,
  InjectCodeCommand,
  RunCodeCommand
} from "./commands/CompilerCommand";
import {
  CloseEditorAreaCommand,
  CloseEditorsInOtherAreasCommand,
  MoveEditorToNextAreaCommand,
  MoveEditorToPreviousAreaCommand,
  NavigateToDocumentCommand,
  SplitEditorDownCommand,
  SplitEditorRightCommand
} from "./commands/DocumentCommands";
import {
  HideDisassemblyCommand,
  HideMemoryCommand,
  SelectOutputPaneCommand,
  ShowDisassemblyCommand,
  ShowMemoryCommand
} from "./commands/ToolCommands";
import { HideCopperCommand, ShowCopperCommand, StepCopperCommand } from "./commands/CopperCommands";
import {
  ClearExecutionHistoryCommand,
  HideHistoryCommand,
  HistoryCommand,
  HistoryExportCommand,
  HistoryGotoCommand,
  HistoryPresentCommand,
  ReverseContinueCommand,
  ShowHistoryCommand,
  StepBackCommand,
  StepBackOutCommand,
  HistoryTakeOverCommand,
  ReverseContinueCancelCommand,
  StepBackOverCommand,
  StepForwardCommand
} from "./commands/HistoryCommands";
import { CoverageCommand, CoverageResetCommand, MemoryHeatCommand } from "./commands/CoverageCommands";
import {
  HideProfilerCommand,
  ProfileCommand,
  ProfileStartCommand,
  ProfileStopCommand,
  ShowProfilerCommand
} from "./commands/ProfileCommands";
import {
  ExportPatternsCommand,
  ShowPatternsCommand,
  ShowSpritesCommand
} from "./commands/SpriteCommands";
import { ShowTilemapCommand, ShowTilesCommand } from "./commands/TilemapCommands";
import { ShowLayer2Command } from "./commands/Layer2Commands";
import { LayersCommand, ShowLayersCommand } from "./commands/LayersCommands";
import { BeamCommand } from "./commands/BeamCommands";
import {
  ProjectExcludeItemsCommand,
  ProjectListExcludedItemsCommand
} from "./commands/ProjectExcludedItemsCommand";
import {
  ListSettingsCommand,
  MoveSettingsCommand,
  SettingCommand,
  SettingsDialogCommand
} from "./commands/SettingCommands";
import { ResetZxbCommand } from "./commands/ZxbCommands";
import { CreateDiskFileCommand } from "./commands/CreateDiskFileCommand";
import {
  CancelScriptCommand,
  DisplayScriptOutputCommand,
  RunBuildScriptCommand,
  RunScriptCommand
} from "./commands/ScriptCommands";
import { ResetZ88DkCommand } from "./commands/Z88DkCommands";
import {
  ExportCodeCommand,
  KliveBuildCommand,
  KliveCompileCommand,
  KliveDebugCodeCommand,
  KliveInjectCodeCommand,
  KliveRunCodeCommand
} from "./commands/KliveCompilerCommands";
import { DisplayDialogCommand } from "./commands/DialogCommands";
import { ShellCommand } from "./commands/ShellCommand";
import { SetZ80RegisterCommand } from "./commands/SetZ80RegisterCommand";
import { SetMemoryContentCommand } from "./commands/SetMemoryContentCommand";
import { ResetSjasmPlusCommand } from "./commands/SjasmPlusCommands";
import { ResetPasta80Command } from "./commands/Pasta80Commands";
import { ZxNextStorageCopyCommand } from "./commands/ZxNextStorageCopyCommand";
import { LaunchNexCommand } from "./commands/NexLaunchCommand";
import { Z88SnapshotCommand } from "./commands/Z88SnapshotCommand";
import { SpectrumSnapshotCommand } from "./commands/SpectrumSnapshotCommand";
import { SpectrumSnapshotSaveCommand } from "./commands/SpectrumSnapshotSaveCommand";
import { StateLoadCommand, StateSaveCommand } from "./commands/MachineStateCommands";
import { DebugRecordingLoadCommand, DebugRecordingSaveCommand } from "./commands/DebugRecordingCommands";
import { TapeLoadCommand } from "./commands/TapeLoadCommand";
import { RunToCursorCommand } from "./commands/RunToCursorCommand";
import { LabelCommand } from "./commands/LabelCommand";
import { AnnDetectCommand } from "./commands/AnnDetectCommand";
import { ExportAsmCommand } from "./commands/ExportAsmCommand";
import { GraphicsCommand } from "./commands/GraphicsCommand";
import { SkoolExportCommand, SkoolImportCommand } from "./commands/SkoolCommands";
import {
  AnnotationCloseCommand,
  AnnotationInfoCommand,
  AnnotationNewCommand,
  AnnotationOpenCommand
} from "./commands/AnnotationSetCommands";

let commandsRegistered = false;

export function registerIdeCommands(cmdSrv: IIdeCommandService): void {
  if (commandsRegistered) return;

  commandsRegistered = true;
  cmdSrv.registerCommand(new ClearScreenCommand());
  cmdSrv.registerCommand(new ClearHistoryCommand());
  cmdSrv.registerCommand(new StartMachineCommand());
  cmdSrv.registerCommand(new PauseMachineCommand());
  cmdSrv.registerCommand(new StopMachineCommand());
  cmdSrv.registerCommand(new RestartMachineCommand());
  cmdSrv.registerCommand(new StartDebugMachineCommand());
  cmdSrv.registerCommand(new StepIntoMachineCommand());
  cmdSrv.registerCommand(new StepOverMachineCommand());
  cmdSrv.registerCommand(new StepOutMachineCommand());
  cmdSrv.registerCommand(new StepOverLineMachineCommand());
  cmdSrv.registerCommand(new StepIntoTargetMachineCommand());
  cmdSrv.registerCommand(new RunToFrameMachineCommand());
  cmdSrv.registerCommand(new SourceSteppingMachineCommand());
  cmdSrv.registerCommand(new ErrorStopsMachineCommand());
  cmdSrv.registerCommand(new JustMyCodeMachineCommand());

  cmdSrv.registerCommand(new NavigateToDocumentCommand());
  cmdSrv.registerCommand(new NavigateBackCommand());
  cmdSrv.registerCommand(new NavigateForwardCommand());
  cmdSrv.registerCommand(new NavigationHistoryCommand());
  cmdSrv.registerCommand(new ClearNavigationHistoryCommand());
  cmdSrv.registerCommand(new SplitEditorRightCommand());
  cmdSrv.registerCommand(new SplitEditorDownCommand());
  cmdSrv.registerCommand(new MoveEditorToNextAreaCommand());
  cmdSrv.registerCommand(new MoveEditorToPreviousAreaCommand());
  cmdSrv.registerCommand(new CloseEditorAreaCommand());
  cmdSrv.registerCommand(new CloseEditorsInOtherAreasCommand());

  cmdSrv.registerCommand(new SelectOutputPaneCommand());
  cmdSrv.registerCommand(new ShowMemoryCommand());
  cmdSrv.registerCommand(new HideMemoryCommand());
  cmdSrv.registerCommand(new ShowDisassemblyCommand());
  cmdSrv.registerCommand(new HideDisassemblyCommand());
  cmdSrv.registerCommand(new ShowCopperCommand());
  cmdSrv.registerCommand(new HideCopperCommand());
  cmdSrv.registerCommand(new StepCopperCommand());
  cmdSrv.registerCommand(new ShowHistoryCommand());
  cmdSrv.registerCommand(new HideHistoryCommand());
  cmdSrv.registerCommand(new ClearExecutionHistoryCommand());
  cmdSrv.registerCommand(new HistoryCommand());
  cmdSrv.registerCommand(new HistoryExportCommand());
  // --- Code coverage and the heat map (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D15)
  cmdSrv.registerCommand(new CoverageCommand());
  cmdSrv.registerCommand(new CoverageResetCommand());
  // --- Unit tests (`.plans/Z80_UNIT_TESTS_PLAN.md` D16)
  cmdSrv.registerCommand(new TestListCommand());
  cmdSrv.registerCommand(new TestRunCommand());
  cmdSrv.registerCommand(new TestDebugCommand());
  cmdSrv.registerCommand(new TestInitCommand());
  cmdSrv.registerCommand(new TestJUnitCommand());
  // --- The profiler (`.plans/PROFILER_PLAN.md` D16)
  cmdSrv.registerCommand(new ProfileCommand());
  cmdSrv.registerCommand(new ProfileStartCommand());
  cmdSrv.registerCommand(new ProfileStopCommand());
  cmdSrv.registerCommand(new ShowProfilerCommand());
  cmdSrv.registerCommand(new HideProfilerCommand());
  cmdSrv.registerCommand(new MemoryHeatCommand());
  // --- Lite step back (`.plans/LITE_STEP_BACK_PLAN.md` §4.5)
  cmdSrv.registerCommand(new StepBackCommand());
  cmdSrv.registerCommand(new StepForwardCommand());
  cmdSrv.registerCommand(new StepBackOverCommand());
  cmdSrv.registerCommand(new StepBackOutCommand());
  cmdSrv.registerCommand(new HistoryTakeOverCommand());
  cmdSrv.registerCommand(new ReverseContinueCancelCommand());
  cmdSrv.registerCommand(new ReverseContinueCommand());
  cmdSrv.registerCommand(new HistoryPresentCommand());
  cmdSrv.registerCommand(new HistoryGotoCommand());
  cmdSrv.registerCommand(new ShowSpritesCommand());
  cmdSrv.registerCommand(new ShowPatternsCommand());
  cmdSrv.registerCommand(new ExportPatternsCommand());
  cmdSrv.registerCommand(new ShowTilemapCommand());
  cmdSrv.registerCommand(new ShowTilesCommand());
  cmdSrv.registerCommand(new ShowLayer2Command());
  cmdSrv.registerCommand(new LayersCommand());
  cmdSrv.registerCommand(new ShowLayersCommand());
  cmdSrv.registerCommand(new BeamCommand());

  cmdSrv.registerCommand(new EraseAllBreakpointsCommand());
  cmdSrv.registerCommand(new ListBreakpointsCommand());
  cmdSrv.registerCommand(new SetBreakpointCommand());
  cmdSrv.registerCommand(new RemoveBreakpointCommand());
  cmdSrv.registerCommand(new EnableBreakpointCommand());
  cmdSrv.registerCommand(new ResetBreakpointHitsCommand());
  cmdSrv.registerCommand(new EnableLogpointGroupsCommand());
  cmdSrv.registerCommand(new EnableAssertionCommentsCommand());
  cmdSrv.registerCommand(new EnableWpmemCommentsCommand());
  cmdSrv.registerCommand(new ListLogpointGroupsCommand());

  cmdSrv.registerCommand(new AddWatchCommand());
  cmdSrv.registerCommand(new RemoveWatchCommand());
  cmdSrv.registerCommand(new ListWatchCommand());
  cmdSrv.registerCommand(new EraseAllWatchCommand());

  cmdSrv.registerCommand(new NumCommand());
  cmdSrv.registerCommand(new ShellCommand());
  cmdSrv.registerCommand(new DisassemblyCommand());
  cmdSrv.registerCommand(new OpenFolderCommand());
  cmdSrv.registerCommand(new NewProjectCommand());
  cmdSrv.registerCommand(new CloseFolderCommand());

  cmdSrv.registerCommand(new KliveBuildCommand());
  cmdSrv.registerCommand(new KliveCompileCommand());
  cmdSrv.registerCommand(new KliveInjectCodeCommand());
  cmdSrv.registerCommand(new KliveRunCodeCommand());
  cmdSrv.registerCommand(new KliveDebugCodeCommand());

  cmdSrv.registerCommand(new CompileCommand());
  cmdSrv.registerCommand(new InjectCodeCommand());
  cmdSrv.registerCommand(new RunCodeCommand());
  cmdSrv.registerCommand(new DebugCodeCommand());
  cmdSrv.registerCommand(new ExportCodeCommand());

  cmdSrv.registerCommand(new ProjectListExcludedItemsCommand());
  cmdSrv.registerCommand(new ProjectExcludeItemsCommand());
  cmdSrv.registerCommand(new SettingCommand());
  cmdSrv.registerCommand(new ListSettingsCommand());
  cmdSrv.registerCommand(new SettingsDialogCommand());
  cmdSrv.registerCommand(new MoveSettingsCommand());
  cmdSrv.registerCommand(new ResetZxbCommand());

  cmdSrv.registerCommand(new CreateDiskFileCommand());

  cmdSrv.registerCommand(new RunScriptCommand());
  cmdSrv.registerCommand(new RunBuildScriptCommand());
  cmdSrv.registerCommand(new CancelScriptCommand());
  cmdSrv.registerCommand(new DisplayScriptOutputCommand());

  cmdSrv.registerCommand(new ResetZ88DkCommand());
  cmdSrv.registerCommand(new DisplayDialogCommand());

  cmdSrv.registerCommand(new SetZ80RegisterCommand());
  cmdSrv.registerCommand(new SetMemoryContentCommand());

  cmdSrv.registerCommand(new ResetSjasmPlusCommand());
  cmdSrv.registerCommand(new ResetPasta80Command());
  cmdSrv.registerCommand(new ZxNextStorageCopyCommand());
  cmdSrv.registerCommand(new LaunchNexCommand());
  cmdSrv.registerCommand(new Z88SnapshotCommand());
  cmdSrv.registerCommand(new SpectrumSnapshotCommand());
  cmdSrv.registerCommand(new SpectrumSnapshotSaveCommand());
  cmdSrv.registerCommand(new RzxPlayCommand());
  cmdSrv.registerCommand(new RzxRecordCommand());
  cmdSrv.registerCommand(new RzxStopCommand());
  cmdSrv.registerCommand(new RzxRollbackCommand());
  cmdSrv.registerCommand(new RzxRollbackPointCommand());
  cmdSrv.registerCommand(new RzxVideoCommand());
  cmdSrv.registerCommand(new StateSaveCommand());
  cmdSrv.registerCommand(new StateLoadCommand());
  cmdSrv.registerCommand(new DebugRecordingSaveCommand());
  cmdSrv.registerCommand(new DebugRecordingLoadCommand());
  cmdSrv.registerCommand(new TapeLoadCommand());
  cmdSrv.registerCommand(new RunToCursorCommand());
  cmdSrv.registerCommand(new LabelCommand());
  cmdSrv.registerCommand(new AnnDetectCommand());
  cmdSrv.registerCommand(new ExportAsmCommand());
  cmdSrv.registerCommand(new GraphicsCommand());
  cmdSrv.registerCommand(new SkoolImportCommand());
  cmdSrv.registerCommand(new SkoolExportCommand());
  cmdSrv.registerCommand(new AnnotationOpenCommand());
  cmdSrv.registerCommand(new AnnotationNewCommand());
  cmdSrv.registerCommand(new AnnotationCloseCommand());
  cmdSrv.registerCommand(new AnnotationInfoCommand());
}

export function resetIdeCommandRegistrationForTests(): void {
  commandsRegistered = false;
}
