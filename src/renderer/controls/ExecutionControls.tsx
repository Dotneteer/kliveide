import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useSelector } from "@renderer/core/RendererProvider";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { useMainApi } from "@renderer/core/MainApi";
import { useIdeApi } from "@renderer/core/IdeApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import { StartModeSelector } from "./StartModeSelector";

type Props = {
  ide: boolean;
  kliveProjectLoaded: boolean;
};

const emuStartOptions = [
  {
    value: "debug",
    label: "Debug Machine (Ctrl+F5)",
    labelCont: "Continue Debugging (Ctrl+F5)",
    iconName: "debug",
    cmd: null
  },
  {
    value: "start",
    label: "Run Machine (F5)",
    labelCont: "Continue (F5)",
    iconName: "play",
    cmd: null
  }
];

const ideStartOptions = [
  {
    value: "debug",
    label: "Debug Project (Ctrl+F5)",
    labelCont: "Continue Debugging (Ctrl+F5)",
    iconName: "debug",
    cmd: "debug"
  },
  {
    value: "start",
    label: "Run Project (F5)",
    labelCont: "Continue (F5)",
    iconName: "play",
    cmd: "run"
  }
];

export const ExecutionControls = ({ ide, kliveProjectLoaded }: Props) => {
  const emuApi = useEmuApi();
  const ideApi = useIdeApi();
  const mainApi = useMainApi();
  const isWindows = useSelector((s) => s.isWindows);
  const state = useSelector((s) => s.emulatorState?.machineState);
  const isDebugging = useSelector((s) => s.emulatorState?.isDebugging ?? false);
  const isCompiling = useSelector((s) => s.compilation?.inProgress ?? false);
  const isStopped =
    state === MachineControllerState.None || state === MachineControllerState.Stopped;
  const isRunning =
    state !== MachineControllerState.None &&
    state !== MachineControllerState.Stopped &&
    state !== MachineControllerState.Paused;
  const canStart = (!ide || kliveProjectLoaded) && !isCompiling && isStopped;
  const canPickStartOption = (!ide || kliveProjectLoaded) && !isRunning;
  const mayInjectCode = ide && kliveProjectLoaded;

  const startOptions = ide ? ideStartOptions : emuStartOptions;
  const [startMode, setStartMode] = useState("start");
  const currentStartOption = useMemo(
    () => startOptions.find((v) => v.value === startMode),
    [startOptions, startMode]
  );

  const [stepIntoKey, setStepIntoKey] = useState<string>(null);
  const [stepOverKey, setStepOverKey] = useState<string>(null);
  const [stepOutKey, setStepOutKey] = useState<string>(null);

  const { outputPaneService, ideCommandsService } = useAppServices();

  const handleStart = useCallback(async () => {
    if (mayInjectCode && !!currentStartOption.cmd) {
      const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
      buildPane.clear();
      await ideCommandsService.executeCommand(currentStartOption.cmd, buildPane);
      await ideCommandsService.executeCommand("outp build");
    } else {
      await emuApi.issueMachineCommand(currentStartOption.value as any);
    }
  }, [mayInjectCode, currentStartOption, outputPaneService, ideCommandsService, emuApi]);

  const handlePauseResume = useCallback(async () => {
    const cmd = state !== MachineControllerState.Running ? currentStartOption.value : "pause";
    await emuApi.issueMachineCommand(cmd as any);
  }, [state, currentStartOption, emuApi]);

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
    const mode = isDebugging ? "debug" : "start";
    setStartMode(mode);
  }, [isDebugging]);

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
        iconName={currentStartOption.iconName}
        fill="--color-toolbarbutton-green"
        title={currentStartOption.label}
        enable={canStart}
        clicked={handleStart}
      />
      <StartModeSelector
        startOptions={startOptions}
        startMode={startMode}
        canPickStartOption={canPickStartOption}
        onChanged={setStartMode}
      />
      <IconButton
        iconName={state === MachineControllerState.Paused ? "debug-continue" : "pause"}
        fill="--color-toolbarbutton-blue"
        title={
          state === MachineControllerState.Running
            ? "Pause (Shift+F5)"
            : currentStartOption.labelCont
        }
        enable={
          !isCompiling &&
          (state === MachineControllerState.Running ||
            state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={handlePauseResume}
      />
      <IconButton
        iconName="stop"
        fill="--color-toolbarbutton-red"
        title="Stop (F4)"
        enable={
          !isCompiling &&
          (state === MachineControllerState.Running ||
            state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={handleStop}
      />
      <IconButton
        iconName="restart"
        fill="--color-toolbarbutton-green"
        title="Restart (Shift+F4)"
        enable={
          !isCompiling &&
          (state === MachineControllerState.Running ||
            state === MachineControllerState.Pausing ||
            state === MachineControllerState.Paused)
        }
        clicked={handleRestart}
      />
      <ToolbarSeparator />
      <IconButton
        iconName="step-into"
        fill="--color-toolbarbutton-blue"
        title={`Step Into (${stepIntoKey})`}
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing || state === MachineControllerState.Paused)
        }
        clicked={handleStepInto}
      />
      <IconButton
        iconName="step-over"
        fill="--color-toolbarbutton-blue"
        title={`Step Over (${stepOverKey})`}
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing || state === MachineControllerState.Paused)
        }
        clicked={handleStepOver}
      />
      <IconButton
        iconName="step-out"
        fill="--color-toolbarbutton-blue"
        title={`Step Out (${stepOutKey})`}
        enable={
          !isCompiling &&
          (state === MachineControllerState.Pausing || state === MachineControllerState.Paused)
        }
        clicked={handleStepOut}
      />
    </>
  );
};
