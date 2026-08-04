import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useSelector } from "@renderer/core/RendererProvider";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { useCallback, useEffect, useState } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { useMainApi } from "@renderer/core/MainApi";
import { useIdeApi } from "@renderer/core/IdeApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import type { MachineCommand } from "@common/abstractions/MachineCommand";

type Props = {
  ide: boolean;
  kliveProjectLoaded: boolean;
};

const SECONDARY_ICON_SIZE = 20;

type StartAction = "run" | "debug";

type StartOption = {
  value: Extract<MachineCommand, "start" | "debug">;
  label: string;
  labelCont: string;
  iconName: string;
  cmd: string | null;
};

const emuStartOptions = {
  debug: {
    value: "debug",
    label: "Debug Machine (Ctrl+F5)",
    labelCont: "Continue Debugging (Ctrl+F5)",
    iconName: "debug",
    cmd: null
  },
  run: {
    value: "start",
    label: "Run Machine (F5)",
    labelCont: "Continue (F5)",
    iconName: "play",
    cmd: null
  }
} satisfies Record<StartAction, StartOption>;

const ideStartOptions = {
  debug: {
    value: "debug",
    label: "Debug Project (Ctrl+F5)",
    labelCont: "Continue Debugging (Ctrl+F5)",
    iconName: "debug",
    cmd: "debug"
  },
  run: {
    value: "start",
    label: "Run Project (F5)",
    labelCont: "Continue (F5)",
    iconName: "play",
    cmd: "run"
  }
} satisfies Record<StartAction, StartOption>;

export const ExecutionControls = ({ ide, kliveProjectLoaded }: Props) => {
  const emuApi = useEmuApi();
  const ideApi = useIdeApi();
  const mainApi = useMainApi();
  const isWindows = useSelector((s) => s.isWindows);
  const state = useSelector((s) => s.emulatorState?.machineState);
  const isDebugging = useSelector((s) => s.emulatorState?.isDebugging ?? false);
  const isCompiling = useSelector((s) => s.compilation?.inProgress ?? false);
  const isStopped =
    state == null ||
    state === MachineControllerState.None ||
    state === MachineControllerState.Stopped;
  const canStart = (!ide || kliveProjectLoaded) && !isCompiling && isStopped;
  const canPause = !isCompiling && state === MachineControllerState.Running;
  const canContinue = !isCompiling && state === MachineControllerState.Paused;
  const canStopOrRestart =
    !isCompiling &&
    (state === MachineControllerState.Running ||
      state === MachineControllerState.Pausing ||
      state === MachineControllerState.Paused);
  const canStep = !isCompiling && state === MachineControllerState.Paused;
  const mayInjectCode = ide && kliveProjectLoaded;

  const startOptions = ide ? ideStartOptions : emuStartOptions;
  const runOption = startOptions.run;
  const debugOption = startOptions.debug;

  const [stepIntoKey, setStepIntoKey] = useState<string>(null);
  const [stepOverKey, setStepOverKey] = useState<string>(null);
  const [stepOutKey, setStepOutKey] = useState<string>(null);

  const { outputPaneService, ideCommandsService } = useAppServices();

  const handleStart = useCallback(async (option: StartOption) => {
    if (mayInjectCode && !!option.cmd) {
      const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
      buildPane.clear();
      await ideCommandsService.executeCommand(option.cmd, buildPane);
      await ideCommandsService.executeCommand("outp build");
    } else {
      await emuApi.issueMachineCommand(option.value);
    }
  }, [mayInjectCode, outputPaneService, ideCommandsService, emuApi]);

  const handleRun = useCallback(async () => {
    await handleStart(runOption);
  }, [handleStart, runOption]);

  const handleDebug = useCallback(async () => {
    await handleStart(debugOption);
  }, [handleStart, debugOption]);

  const handlePause = useCallback(async () => {
    await emuApi.issueMachineCommand("pause");
  }, [emuApi]);

  const handleContinue = useCallback(async () => {
    await emuApi.issueMachineCommand("start");
  }, [emuApi]);

  const handleContinueDebugging = useCallback(async () => {
    await emuApi.issueMachineCommand("debug");
  }, [emuApi]);

  const handleStop = useCallback(async () => {
    await emuApi.issueMachineCommand("stop");
  }, [emuApi]);

  const handleRestart = useCallback(async () => {
    if (ide && kliveProjectLoaded) {
      ideApi.executeCommand("outp build");
      ideApi.executeCommand(isDebugging ? "debug" : "run");
    } else {
      await emuApi.issueMachineCommand("restart");
    }
  }, [ide, kliveProjectLoaded, ideApi, isDebugging, emuApi]);

  const handleStepInto = useCallback(async () => {
    await emuApi.issueMachineCommand("stepInto");
  }, [emuApi]);

  const handleStepOver = useCallback(async () => {
    await emuApi.issueMachineCommand("stepOver");
  }, [emuApi]);

  const handleStepOut = useCallback(async () => {
    await emuApi.issueMachineCommand("stepOut");
  }, [emuApi]);

  useEffect(() => {
    if (!mainApi) return;
    (async () => {
      const settings = await mainApi.getUserSettings();
      setStepIntoKey(settings?.shortcuts?.stepInto ?? (isWindows ? "F11" : "F12"));
      setStepOverKey(settings?.shortcuts?.stepOver ?? "F10");
      setStepOutKey(settings?.shortcuts?.stepOut ?? (isWindows ? "Shift+F11" : "Shift+F12"));
    })();
  }, [mainApi, isWindows]);

  return (
    <>
      <IconButton
        iconName={runOption.iconName}
        fill="--color-toolbarbutton-green"
        title={runOption.label}
        enable={canStart}
        clicked={handleRun}
      />
      <IconButton
        iconName={debugOption.iconName}
        fill="--color-toolbarbutton-blue"
        title={debugOption.label}
        enable={canStart}
        clicked={handleDebug}
      />
      <IconButton
        iconName="pause"
        fill="--color-toolbarbutton-blue"
        title="Pause (Shift+F5)"
        enable={canPause}
        clicked={handlePause}
      />
      <IconButton
        iconName="debug-continue"
        fill="--color-toolbarbutton-green"
        title={runOption.labelCont}
        enable={canContinue}
        clicked={handleContinue}
      />
      <IconButton
        iconName="debug-continue-with-bug"
        fill="--color-toolbarbutton-blue"
        title={debugOption.labelCont}
        enable={canContinue}
        clicked={handleContinueDebugging}
      />
      <ToolbarSeparator />
      <IconButton
        iconName="stop"
        iconSize={SECONDARY_ICON_SIZE}
        fill="--color-toolbarbutton-red"
        title="Stop (F4)"
        enable={canStopOrRestart}
        clicked={handleStop}
      />
      <IconButton
        iconName="restart"
        iconSize={SECONDARY_ICON_SIZE}
        fill="--color-toolbarbutton-green"
        title="Restart (Shift+F4)"
        enable={canStopOrRestart}
        clicked={handleRestart}
      />
      <ToolbarSeparator />
      <IconButton
        iconName="step-into"
        iconSize={SECONDARY_ICON_SIZE}
        fill="--color-toolbarbutton-blue"
        title={`Step Into (${stepIntoKey})`}
        enable={canStep}
        clicked={handleStepInto}
      />
      <IconButton
        iconName="step-over"
        iconSize={SECONDARY_ICON_SIZE}
        fill="--color-toolbarbutton-blue"
        title={`Step Over (${stepOverKey})`}
        enable={canStep}
        clicked={handleStepOver}
      />
      <IconButton
        iconName="step-out"
        iconSize={SECONDARY_ICON_SIZE}
        fill="--color-toolbarbutton-blue"
        title={`Step Out (${stepOutKey})`}
        enable={canStep}
        clicked={handleStepOut}
      />
    </>
  );
};
