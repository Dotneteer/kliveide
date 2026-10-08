import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { ToolbarSplitButton, type ToolbarSplitButtonOption } from "./ToolbarSplitButton";
import { useCallback, useEffect, useState } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { useMainApi } from "@renderer/core/MainApi";
import { useIdeApi } from "@renderer/core/IdeApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import type { MachineCommand } from "@common/abstractions/MachineCommand";
import { SECONDARY_ICON_SIZE } from "./toolbar-constants";
import { hasSourceLevelDebug } from "@renderer/appIde/utils/compiler-utils";
import { canSourceStepOut, STEP_OUT_IN_MAIN, stepIntoTargets } from "@renderer/appIde/debugger/source/step-targets";
import { SETTING_EMU_JUST_MY_CODE } from "@common/settings/setting-const";
import { MF_EXEC_HISTORY } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { defaultReverseShortcuts, type ReverseShortcuts } from "@common/settings/reverse-shortcuts";

type Props = {
  ide: boolean;
  kliveProjectLoaded: boolean;
};


type StartAction = "run" | "debug";
type ResumeAction = "continue" | "debug";

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
  // --- Lite step back (`.plans/LITE_STEP_BACK_PLAN.md` §4.4): on every machine that records history
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const historyPosition = useSelector((s) => s.emulatorState?.historyPosition);
  // --- Off with the advanced-debugging switch (`@common/features/advancedDebugging`)
  const advancedDebugging = useSelector((s) => s.emulatorState?.advancedDebugging);
  const recordsHistory =
    advancedDebugging === true &&
    !!machineRegistry.find((m) => m.machineId === machineId)?.features?.[MF_EXEC_HISTORY];
  // --- In the past, every forward command acts on the live machine (D5): the tooltips say so
  const fromPresent = historyPosition ? " - resumes from the present" : "";
  const mayInjectCode = ide && kliveProjectLoaded;

  const startOptions = ide ? ideStartOptions : emuStartOptions;
  const runOption = startOptions.run;
  const debugOption = startOptions.debug;
  const [startAction, setStartAction] = useState<StartAction>("run");
  const [resumeAction, setResumeAction] = useState<ResumeAction>("continue");

  /*
   * Follow the machine's own debug flag, not only the toolbar's clicks.
   *
   * The resume mode used to change only when this toolbar started the machine or stepped it. A run
   * started anywhere else — `nex-run -e` from a NEX document, a script, the menu — left it on
   * "Continue", so a machine paused at a breakpoint in a debug session offered to continue in normal
   * mode until the first step switched it over. The controller publishes `isDebugging` for every
   * start, pause and step, so it is the one source that is right however the run began.
   */
  useEffect(() => {
    setResumeAction(isDebugging ? "debug" : "continue");
  }, [isDebugging]);

  /*
   * Source-level stepping (plan §10.2.8), offered for a program built with source-level debug info
   * (Klive BASIC): Step Over Line, and the Source / Z80 toggle that decides what Step Into, Over
   * and Out step. The emulator's controller owns the mode; this follows it.
   */
  const compilationResult = useSelector((s) => s.compilation?.result);
  const hasSourceDebug = hasSourceLevelDebug(compilationResult);
  const [sourceMode, setSourceMode] = useState(true);
  useEffect(() => {
    if (!ide || !hasSourceDebug) return;
    emuApi
      .getSourceStepping()
      .then(setSourceMode)
      .catch(() => undefined);
  }, [ide, hasSourceDebug, state, emuApi]);

  /*
   * Where a paused source-level program stands decides two things: Step Into's drop-down lists the
   * routines the statement calls (Step Into Target, §10.2.4), and Step Out is disabled in the main
   * program, which has nothing to return to (§10.2.5).
   */
  const justMyCode = useGlobalSetting(SETTING_EMU_JUST_MY_CODE);
  const [stepTargets, setStepTargets] = useState<{ callableIndex: number; name: string }[]>([]);
  const [stepOutPossible, setStepOutPossible] = useState(true);
  useEffect(() => {
    if (!ide || !hasSourceLevelDebug(compilationResult) || state !== MachineControllerState.Paused) {
      // --- Keep the same (empty) array: a new one would render again, and an effect whose
      // --- dependencies change on every render (a test's emuApi, say) would then never stop
      setStepTargets((targets) => (targets.length ? [] : targets));
      setStepOutPossible(true);
      return undefined;
    }
    let live = true;
    Promise.all([emuApi.getSourceStopInfo(), emuApi.getSourceCallStack()])
      .then(([stop, chain]) => {
        if (!live) return;
        setStepTargets(stepIntoTargets(compilationResult.sourceLevelDebug, stop, justMyCode !== false));
        setStepOutPossible(canSourceStepOut(chain));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [ide, compilationResult, state, emuApi, justMyCode]);
  const sourceStepping = ide && hasSourceDebug && sourceMode;

  const [stepIntoKey, setStepIntoKey] = useState<string>(null);
  const [stepOverKey, setStepOverKey] = useState<string>(null);
  const [stepOutKey, setStepOutKey] = useState<string>(null);
  const [reverseKeys, setReverseKeys] = useState<ReverseShortcuts>();

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

  const handleStartAction = useCallback(async (action: StartAction) => {
    setStartAction(action);
    setResumeAction(action === "run" ? "continue" : "debug");
    await handleStart(startOptions[action]);
  }, [handleStart, startOptions]);

  const handlePause = useCallback(async () => {
    await emuApi.issueMachineCommand("pause");
  }, [emuApi]);

  const handleResumeAction = useCallback(async (action: ResumeAction) => {
    setResumeAction(action);
    await emuApi.issueMachineCommand(action === "continue" ? "start" : "debug");
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
    setResumeAction("debug");
    await emuApi.issueMachineCommand("stepInto");
  }, [emuApi]);

  const handleStepOver = useCallback(async () => {
    setResumeAction("debug");
    await emuApi.issueMachineCommand("stepOver");
  }, [emuApi]);

  const handleStepOut = useCallback(async () => {
    setResumeAction("debug");
    await emuApi.issueMachineCommand("stepOut");
  }, [emuApi]);

  const handleStepIntoAction = useCallback(
    async (value: string) => {
      setResumeAction("debug");
      if (value === "into") await emuApi.issueMachineCommand("stepInto");
      else await emuApi.sourceStep("intoTarget", { targetCallable: Number(value) });
    },
    [emuApi]
  );

  const handleStepOverLine = useCallback(async () => {
    setResumeAction("debug");
    await emuApi.sourceStep("overLine");
  }, [emuApi]);

  // --- History navigation runs the IDE commands, so the output pane says where each one went
  const runHistoryCommand = useCallback(
    async (command: string) => {
      if (ide) await ideCommandsService.executeCommand(command);
      else await ideApi.executeCommand(command);
    },
    [ide, ideCommandsService, ideApi]
  );

  const handleToggleStepMode = useCallback(async () => {
    const next = !sourceMode;
    await emuApi.setSourceStepping(next);
    setSourceMode(next);
  }, [emuApi, sourceMode]);

  useEffect(() => {
    if (!mainApi) return;
    (async () => {
      const settings = await mainApi.getUserSettings();
      setStepIntoKey(settings?.shortcuts?.stepInto ?? (isWindows ? "F11" : "F12"));
      setStepOverKey(settings?.shortcuts?.stepOver ?? "F10");
      setStepOutKey(settings?.shortcuts?.stepOut ?? (isWindows ? "Shift+F11" : "Shift+F12"));
      const platform = isWindows ? "win32" : /mac/i.test(navigator.platform) ? "darwin" : "linux";
      const defaults = defaultReverseShortcuts(platform);
      const keys: ReverseShortcuts = {
        stepBack: settings?.shortcuts?.stepBack ?? defaults.stepBack,
        stepBackOver: settings?.shortcuts?.stepBackOver ?? defaults.stepBackOver,
        stepBackOut: settings?.shortcuts?.stepBackOut ?? defaults.stepBackOut,
        reverseContinue: settings?.shortcuts?.reverseContinue ?? defaults.reverseContinue,
        stepForward: settings?.shortcuts?.stepForward ?? defaults.stepForward
      };
      // --- Only a real change re-renders: a fresh object every time would loop with this effect
      setReverseKeys((old) => (old && JSON.stringify(old) === JSON.stringify(keys) ? old : keys));
    })();
  }, [mainApi, isWindows]);

  const startSplitOptions: ToolbarSplitButtonOption<StartAction>[] = [
    {
      value: "run",
      label: runOption.label,
      iconName: runOption.iconName,
      fill: "--color-toolbarbutton-green"
    },
    {
      value: "debug",
      label: debugOption.label,
      iconName: debugOption.iconName,
      fill: "--color-toolbarbutton-blue"
    }
  ];

  const resumeSplitOptions: ToolbarSplitButtonOption<ResumeAction>[] = [
    {
      value: "continue",
      label: runOption.labelCont,
      iconName: "debug-continue",
      fill: "--color-toolbarbutton-green"
    },
    {
      value: "debug",
      label: debugOption.labelCont,
      iconName: "debug-continue-with-bug",
      fill: "--color-toolbarbutton-blue"
    }
  ];

  return (
    <>
      <ToolbarSplitButton
        options={startSplitOptions}
        selectedValue={startAction}
        enable={canStart}
        dropdownTitle="Choose start mode"
        onAction={handleStartAction}
      />
      <IconButton
        iconName="pause"
        fill="--color-toolbarbutton-blue"
        title="Pause (Shift+F5)"
        enable={canPause}
        clicked={handlePause}
      />
      <ToolbarSplitButton
        options={resumeSplitOptions}
        selectedValue={resumeAction}
        enable={canContinue}
        dropdownTitle={`Choose resume mode${fromPresent}`}
        onAction={handleResumeAction}
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
      {sourceStepping && stepTargets.length > 0 ? (
        <ToolbarSplitButton
          options={[
            { value: "into", label: `Step Into (${stepIntoKey})`, iconName: "step-into", fill: "--color-toolbarbutton-blue" },
            ...stepTargets.map((t) => ({
              value: String(t.callableIndex),
              label: `Step Into ${t.name}`,
              iconName: "step-into",
              fill: "--color-toolbarbutton-blue"
            }))
          ]}
          selectedValue="into"
          enable={canStep}
          dropdownTitle="Step Into Target"
          onAction={handleStepIntoAction}
        />
      ) : (
        <IconButton
          iconName="step-into"
          iconSize={SECONDARY_ICON_SIZE}
          fill="--color-toolbarbutton-blue"
          title={`Step Into (${stepIntoKey})${fromPresent}`}
          enable={canStep}
          clicked={handleStepInto}
        />
      )}
      <IconButton
        iconName="step-over"
        iconSize={SECONDARY_ICON_SIZE}
        fill="--color-toolbarbutton-blue"
        title={`Step Over (${stepOverKey})${fromPresent}`}
        enable={canStep}
        clicked={handleStepOver}
      />
      <IconButton
        iconName="step-out"
        iconSize={SECONDARY_ICON_SIZE}
        fill="--color-toolbarbutton-blue"
        title={sourceStepping && !stepOutPossible ? STEP_OUT_IN_MAIN : `Step Out (${stepOutKey})${fromPresent}`}
        enable={canStep && (!sourceStepping || stepOutPossible)}
        clicked={handleStepOut}
      />
      {ide && hasSourceDebug && (
        <>
          <IconButton
            iconName="step-over-line"
            iconSize={SECONDARY_ICON_SIZE}
            fill="--color-toolbarbutton-blue"
            title="Step Over Line (Shift+F10)"
            enable={canStep && sourceMode}
            clicked={handleStepOverLine}
          />
          <IconButton
            iconName={sourceMode ? "step-mode-source" : "step-mode-z80"}
            iconSize={SECONDARY_ICON_SIZE}
            fill="--color-toolbarbutton-blue"
            title={
              sourceMode
                ? "Stepping source statements (click to step Z80 instructions)"
                : "Stepping Z80 instructions (click to step source statements)"
            }
            clicked={handleToggleStepMode}
          />
        </>
      )}
      {recordsHistory && (
        <>
          <ToolbarSeparator />
          <IconButton
            iconName="step-back"
            iconSize={SECONDARY_ICON_SIZE}
            fill="--color-toolbarbutton-blue"
            title={`Step Back through the history (${reverseKeys?.stepBack ?? ""})`}
            enable={canStep}
            clicked={() => runHistoryCommand("step-back")}
          />
          <IconButton
            iconName="step-forward-history"
            iconSize={SECONDARY_ICON_SIZE}
            fill="--color-toolbarbutton-blue"
            title={`Step Forward through the history (${reverseKeys?.stepForward ?? ""})`}
            enable={canStep && !!historyPosition}
            clicked={() => runHistoryCommand("step-forward")}
          />
          <IconButton
            iconName="history-present"
            iconSize={SECONDARY_ICON_SIZE}
            fill="--color-toolbarbutton-blue"
            title="Return to the present"
            enable={canStep && !!historyPosition}
            clicked={() => runHistoryCommand("history-present")}
          />
        </>
      )}
    </>
  );
};
