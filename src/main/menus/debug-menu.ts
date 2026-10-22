import { DETECT_CODE_DATA_DIALOG } from "@messaging/dialog-ids";
/*
 * The Debug menu (`.plans/MENU_REDESIGN_PLAN.md` §3): starting with the debugger, stepping, the
 * Execution History, the machine's own debugging commands (Step Copper on the Next), and the source
 * sync. The debugger's
 * preferences are in Settings › Debugging.
 */
import type { MenuItemConstructorOptions } from "electron";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { SETTING_IDE_SYNC_BREAKPOINTS } from "@common/settings/setting-const";
import { MF_EXEC_HISTORY, MF_PROFILE, MF_REVERSE_DEBUG } from "@common/machines/constants";
import { hasMachineFeature } from "@common/features/advancedDebugging";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { canExportHistory, exportExecutionHistoryAs } from "@main/history-export";
import { canExportDisassembly, exportDisassemblyAsSource } from "@main/source-export-menu";
import { canSaveDebugRecording, pickAndOpenDebugRecording, saveDebugRecordingAs } from "@main/debug-recording-menus";
import { type MenuContext, windowInfoOf } from "./menu-context";
import { createBooleanSettingsMenu, submenuContent, tidySeparators } from "./menu-utils";
import { t } from "@common/i18n/i18n";

export function createDebugMenu(context: MenuContext): MenuItemConstructorOptions {
  const execState = context.appState?.emulatorState?.machineState;
  const machineWaits =
    execState === MachineControllerState.None ||
    execState === MachineControllerState.Paused ||
    execState === MachineControllerState.Stopped;
  const machinePaused = execState === MachineControllerState.Paused;
  const machineItems = submenuContent(
    context.machineMenus?.debugItems?.(windowInfoOf(context), context.currentMachine, context.currentModel) ?? []
  );

  const items: MenuItemConstructorOptions[] = [
    {
      id: "debug",
      label: t("menu.debug.startDebugging"),
      enabled: machineWaits,
      accelerator: "Ctrl+F5",
      click: async () => {
        await getEmuApi().issueMachineCommand("debug");
      }
    },
    { type: "separator" },
    {
      id: "step_into",
      label: t("menu.debug.stepInto"),
      enabled: machinePaused,
      accelerator: context.shortcuts.stepInto,
      click: async () => {
        await getEmuApi().issueMachineCommand("stepInto");
      }
    },
    {
      id: "step_over",
      label: t("menu.debug.stepOver"),
      enabled: machinePaused,
      accelerator: context.shortcuts.stepOver,
      click: async () => {
        await getEmuApi().issueMachineCommand("stepOver");
      }
    },
    {
      id: "step_out",
      label: t("menu.debug.stepOut"),
      enabled: machinePaused,
      accelerator: context.shortcuts.stepOut,
      click: async () => {
        await getEmuApi().issueMachineCommand("stepOut");
      }
    },
    {
      id: "step_over_line",
      label: t("menu.debug.stepOverLine"),
      enabled: machinePaused,
      accelerator: context.shortcuts.stepOverLine,
      click: async () => {
        // --- A source-level step: the emulator ignores it for a program without source-level info
        await getEmuApi().sourceStep("overLine");
      }
    },
    // --- Reverse stepping through the recorded history (`.plans/LITE_STEP_BACK_PLAN.md` §4.5): IDE
    // --- commands, so the output pane says where each one went; never a machine command (D4)
    ...(hasMachineFeature(context.currentMachine, MF_EXEC_HISTORY, context.appState)
      ? [
          { type: "separator" as const },
          reverseItem("step_back", t("menu.debug.stepBack"), context.shortcuts.stepBack, "step-back", machinePaused),
          reverseItem("step_forward", t("menu.debug.stepForward"), context.shortcuts.stepForward, "step-forward", machinePaused),
          reverseItem("step_back_over", t("menu.debug.reverseStepOver"), context.shortcuts.stepBackOver, "step-back-over", machinePaused),
          reverseItem("step_back_out", t("menu.debug.reverseStepOut"), context.shortcuts.stepBackOut, "step-back-out", machinePaused),
          reverseItem(
            "reverse_continue",
            t("menu.debug.reverseContinue"),
            context.shortcuts.reverseContinue,
            "reverse-continue",
            machinePaused
          ),
          reverseItem(
            "history_present",
            t("menu.debug.returnToPresent"),
            undefined,
            "history-present",
            machinePaused && !!context.appState?.emulatorState?.historyPosition
          )
        ]
      : []),
    { type: "separator" },
    // --- Every machine that records history, so G4.2 lights it up without moving it
    // --- (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.5, D12)
    ...(hasMachineFeature(context.currentMachine, MF_EXEC_HISTORY, context.appState)
      ? [
          {
            id: "show_execution_history",
            label: t("menu.debug.executionHistory"),
            click: async () => {
              await getIdeApi().executeCommand("show-history");
            }
          },
          // --- A trace for a diff tool (`.plans/TRACE_EXPORT_PLAN.md` D13): not while running (D10)
          {
            id: "export_execution_history",
            label: t("menu.debug.exportHistory"),
            enabled: canExportHistory(context.appState),
            click: async () => {
              await exportExecutionHistoryAs(context.focusedWindow());
            }
          }
        ]
      : []),
    // --- Code coverage and the heat map (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D15): the
    // --- user's switch for the session, not tied to debugging (D6); its state is in the store
    ...(hasMachineFeature(context.currentMachine, MF_PROFILE, context.appState)
      ? [
          { type: "separator" as const },
          {
            id: "code_coverage",
            label: t("menu.debug.codeCoverage"),
            type: "checkbox" as const,
            checked: !!context.appState?.emulatorState?.profiling?.enabled,
            click: async () => {
              const on = !context.appState?.emulatorState?.profiling?.enabled;
              await getIdeApi().executeCommand(on ? "coverage on" : "coverage off");
            }
          },
          {
            id: "reset_coverage",
            label: t("menu.debug.resetCoverage"),
            click: async () => {
              await getIdeApi().executeCommand("coverage reset");
            }
          },
          // --- Code/data detection from the coverage (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §4.6)
          {
            id: "detect_code_data",
            label: t("menu.debug.detectCodeData"),
            click: async () => {
              await getIdeApi().displayDialog(DETECT_CODE_DATA_DIALOG);
            }
          },
          // --- The profiler (`.plans/PROFILER_PLAN.md` D1): Start turns the flat profile and the
          // --- call graph on and resets them; Stop freezes the data and opens the Profiler
          { type: "separator" as const },
          {
            id: "start_profiling",
            label: t("menu.debug.startProfiling"),
            enabled: !context.appState?.emulatorState?.profiling?.enabled,
            click: async () => {
              await getIdeApi().executeCommand("profile start -calls");
            }
          },
          {
            id: "stop_profiling",
            label: t("menu.debug.stopProfiling"),
            enabled: !!context.appState?.emulatorState?.profiling?.enabled,
            click: async () => {
              await getIdeApi().executeCommand("profile stop");
              await getIdeApi().executeCommand("show-profiler");
            }
          },
          {
            id: "show_profiler",
            label: t("menu.debug.profiler"),
            click: async () => {
              await getIdeApi().executeCommand("show-profiler");
            }
          }
        ]
      : []),
    // --- Export as source, always verified by reassembly: every machine whose memory can be annotated
    ...(canExportDisassembly(context.appState)
      ? [
          { type: "separator" as const },
          {
            id: "export_disassembly_source",
            label: t("menu.debug.exportDisassemblySource"),
            click: async () => {
              // --- The command opens the file in the IDE, so the IDE is where it is read
              context.ensureIdeWindow();
              await exportDisassemblyAsSource(context.focusedWindow());
            }
          }
        ]
      : []),
    // --- Debug recordings (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D2): a reverse-debugging session
    // --- to a file and back; saving needs a timeline, opening switches to the recording's machine
    ...(hasMachineFeature(context.currentMachine, MF_REVERSE_DEBUG, context.appState)
      ? [
          { type: "separator" as const },
          {
            id: "save_debug_recording",
            label: t("menu.debug.saveDebugRecording"),
            enabled: canSaveDebugRecording(context.appState),
            click: async () => {
              await saveDebugRecordingAs(context.focusedWindow());
            }
          },
          {
            id: "open_debug_recording",
            label: t("menu.debug.openDebugRecording"),
            click: async () => {
              await pickAndOpenDebugRecording(context.focusedWindow());
            }
          }
        ]
      : []),
    ...machineItems,
    { type: "separator" },
    // --- Shown in both windows: it is a debugger behaviour, not a part of one window
    createBooleanSettingsMenu(SETTING_IDE_SYNC_BREAKPOINTS, {
      label: t("menu.debug.syncSource"),
      visibleFn: () => true
    }),
    {
      id: "debugger_settings",
      label: t("menu.debug.debuggerSettings"),
      click: async () => await context.openSettings("debugging")
    }
  ];
  return { label: t("menu.debug.title"), submenu: tidySeparators(items) };
}

/** A reverse-stepping item: runs its IDE command */
function reverseItem(
  id: string,
  label: string,
  accelerator: string | undefined,
  command: string,
  enabled: boolean
): MenuItemConstructorOptions {
  return {
    id,
    label,
    enabled,
    ...(accelerator ? { accelerator } : {}),
    click: async () => {
      await getIdeApi().executeCommand(command);
    }
  };
}
