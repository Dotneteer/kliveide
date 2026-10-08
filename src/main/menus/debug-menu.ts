/*
 * The Debug menu (`.plans/MENU_REDESIGN_PLAN.md` §3): starting with the debugger, stepping, the
 * Execution History, the machine's own debugging commands (Step Copper on the Next), and the source
 * sync. The debugger's
 * preferences are in Settings › Debugging.
 */
import type { MenuItemConstructorOptions } from "electron";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { SETTING_IDE_SYNC_BREAKPOINTS } from "@common/settings/setting-const";
import { MF_EXEC_HISTORY, MF_REVERSE_DEBUG } from "@common/machines/constants";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import { canExportHistory, exportExecutionHistoryAs } from "@main/history-export";
import { canSaveDebugRecording, pickAndOpenDebugRecording, saveDebugRecordingAs } from "@main/debug-recording-menus";
import { type MenuContext, windowInfoOf } from "./menu-context";
import { createBooleanSettingsMenu, submenuContent, tidySeparators } from "./menu-utils";

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
      label: "Start with Debugging",
      enabled: machineWaits,
      accelerator: "Ctrl+F5",
      click: async () => {
        await getEmuApi().issueMachineCommand("debug");
      }
    },
    { type: "separator" },
    {
      id: "step_into",
      label: "Step Into",
      enabled: machinePaused,
      accelerator: context.shortcuts.stepInto,
      click: async () => {
        await getEmuApi().issueMachineCommand("stepInto");
      }
    },
    {
      id: "step_over",
      label: "Step Over",
      enabled: machinePaused,
      accelerator: context.shortcuts.stepOver,
      click: async () => {
        await getEmuApi().issueMachineCommand("stepOver");
      }
    },
    {
      id: "step_out",
      label: "Step Out",
      enabled: machinePaused,
      accelerator: context.shortcuts.stepOut,
      click: async () => {
        await getEmuApi().issueMachineCommand("stepOut");
      }
    },
    {
      id: "step_over_line",
      label: "Step Over Line",
      enabled: machinePaused,
      accelerator: context.shortcuts.stepOverLine,
      click: async () => {
        // --- A source-level step: the emulator ignores it for a program without source-level info
        await getEmuApi().sourceStep("overLine");
      }
    },
    // --- Reverse stepping through the recorded history (`.plans/LITE_STEP_BACK_PLAN.md` §4.5): IDE
    // --- commands, so the output pane says where each one went; never a machine command (D4)
    ...(context.currentMachine?.features?.[MF_EXEC_HISTORY]
      ? [
          { type: "separator" as const },
          reverseItem("step_back", "Step Back", context.shortcuts.stepBack, "step-back", machinePaused),
          reverseItem("step_forward", "Step Forward", context.shortcuts.stepForward, "step-forward", machinePaused),
          reverseItem("step_back_over", "Reverse Step Over", context.shortcuts.stepBackOver, "step-back-over", machinePaused),
          reverseItem("step_back_out", "Reverse Step Out", context.shortcuts.stepBackOut, "step-back-out", machinePaused),
          reverseItem(
            "reverse_continue",
            "Reverse Continue",
            context.shortcuts.reverseContinue,
            "reverse-continue",
            machinePaused
          ),
          reverseItem(
            "history_present",
            "Return to Present",
            undefined,
            "history-present",
            machinePaused && !!context.appState?.emulatorState?.historyPosition
          )
        ]
      : []),
    { type: "separator" },
    // --- Every machine that records history, so G4.2 lights it up without moving it
    // --- (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.5, D12)
    ...(context.currentMachine?.features?.[MF_EXEC_HISTORY]
      ? [
          {
            id: "show_execution_history",
            label: "Execution History",
            click: async () => {
              await getIdeApi().executeCommand("show-history");
            }
          },
          // --- A trace for a diff tool (`.plans/TRACE_EXPORT_PLAN.md` D13): not while running (D10)
          {
            id: "export_execution_history",
            label: "Export Execution History...",
            enabled: canExportHistory(context.appState),
            click: async () => {
              await exportExecutionHistoryAs(context.focusedWindow());
            }
          }
        ]
      : []),
    // --- Debug recordings (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D2): a reverse-debugging session
    // --- to a file and back; saving needs a timeline, opening switches to the recording's machine
    ...(context.currentMachine?.features?.[MF_REVERSE_DEBUG]
      ? [
          { type: "separator" as const },
          {
            id: "save_debug_recording",
            label: "Save Debug Recording...",
            enabled: canSaveDebugRecording(context.appState),
            click: async () => {
              await saveDebugRecordingAs(context.focusedWindow());
            }
          },
          {
            id: "open_debug_recording",
            label: "Open Debug Recording...",
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
      label: "Sync Source with Breakpoint",
      visibleFn: () => true
    }),
    {
      id: "debugger_settings",
      label: "Debugger Settings...",
      click: async () => await context.openSettings("debugging")
    }
  ];
  return { label: "Debug", submenu: tidySeparators(items) };
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
