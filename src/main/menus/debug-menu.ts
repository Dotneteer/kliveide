/*
 * The Debug menu (`.plans/MENU_REDESIGN_PLAN.md` §3): starting with the debugger, stepping, the
 * machine's own debugging commands (Step Copper on the Next), and the source sync. The debugger's
 * preferences are in Settings › Debugging.
 */
import type { MenuItemConstructorOptions } from "electron";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { SETTING_IDE_SYNC_BREAKPOINTS } from "@common/settings/setting-const";
import { getEmuApi } from "@messaging/MainToEmuMessenger";
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
    { type: "separator" },
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
