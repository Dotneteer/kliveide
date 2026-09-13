import { IIdeCommandService } from "../abstractions/IIdeCommandService";
import {
  EraseAllBreakpointsCommand,
  ListBreakpointsCommand,
  SetBreakpointCommand,
  RemoveBreakpointCommand,
  EnableBreakpointCommand
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
  StepOutMachineCommand
} from "./commands/MachineCommands";
import { NewProjectCommand } from "./commands/NewProjectCommand";
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
import {
  ProjectExcludeItemsCommand,
  ProjectListExcludedItemsCommand
} from "./commands/ProjectExcludedItemsCommand";
import {
  ListSettingsCommand,
  MoveSettingsCommand,
  SettingCommand
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

  cmdSrv.registerCommand(new NavigateToDocumentCommand());
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

  cmdSrv.registerCommand(new EraseAllBreakpointsCommand());
  cmdSrv.registerCommand(new ListBreakpointsCommand());
  cmdSrv.registerCommand(new SetBreakpointCommand());
  cmdSrv.registerCommand(new RemoveBreakpointCommand());
  cmdSrv.registerCommand(new EnableBreakpointCommand());

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
}

export function resetIdeCommandRegistrationForTests(): void {
  commandsRegistered = false;
}
