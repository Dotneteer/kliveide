import * as React from "react";
import { CSSProperties } from "react";
import { useSelector } from "react-redux";

import { dispatch } from "@core/service-registry";
import { AppState } from "@state/AppState";
import { ToolbarIconButton } from "@components/ToolbarIconButton";
import { ToolbarSeparator } from "@components/ToolbarSeparator";
import { emuMuteSoundAction } from "@state/emulator-panel-reducer";
import { spectrumFastLoadAction } from "@state/spectrum-specific-reducer";
import { executeKliveCommand } from "@abstractions/common-commands";
import { getVmEngineService } from "@modules-core/vm-engine-service";
import { ZxSpectrumCoreBase } from "@modules/vm-zx-spectrum/ZxSpectrumCoreBase";
import { emuToMainMessenger } from "../common-ui/services/EmuToMainMessenger";

export const Toolbar: React.FC = () => {
  // --- State
  const machineType = useSelector((s: AppState) => s.machineType);
  const executionState = useSelector(
    (s: AppState) => s.emulatorPanel.executionState
  );
  const showKeyboard = useSelector(
    (s: AppState) => s.emuViewOptions.showKeyboard
  );
  const extraFeatures = useSelector(
    (s: AppState) => s.emulatorPanel.extraFeatures ?? []
  );
  const muted = useSelector((s: AppState) => s.emulatorPanel.muted);
  const fastLoad = useSelector(
    (s: AppState) => s.spectrumSpecific?.fastLoad ?? false
  );
  const loadMode = useSelector(
    (s: AppState) => s.spectrumSpecific?.loadMode ?? false
  );

  // --- Engine state
  const engine = getVmEngineService();
  const hasEngine = !!machineType && !!engine;

  // --- Standard machine control buttons
  const machineControlButtons = [
    <ToolbarIconButton
      key="play"
      iconName="play"
      fill="lightgreen"
      title="Start"
      enable={
        hasEngine &&
        (executionState === 0 || executionState === 3 || executionState === 5)
      }
      clicked={async () => {
        await engine.start();
      }}
    />,
    <ToolbarIconButton
      key="pause"
      iconName="pause"
      fill="lightblue"
      title="Pause"
      enable={hasEngine && executionState === 1}
      clicked={async () => await engine.pause()}
    />,
    <ToolbarIconButton
      key="stop"
      iconName="stop"
      fill="orangered"
      title="Stop"
      enable={hasEngine && (executionState === 1 || executionState === 3)}
      clicked={async () => await engine.stop()}
    />,
    <ToolbarIconButton
      key="restart"
      iconName="restart"
      fill="lightgreen"
      title="Restart"
      size={22}
      highlightSize={26}
      enable={hasEngine && (executionState === 1 || executionState === 3)}
      clicked={async () => await engine.restart()}
    />,
    <ToolbarSeparator key="sep-0" />,
    <ToolbarIconButton
      key="debug"
      iconName="debug"
      fill="lightgreen"
      title="Debug"
      size={20}
      highlightSize={24}
      enable={
        hasEngine &&
        (executionState === 0 || executionState === 3 || executionState === 5)
      }
      clicked={async () => await engine.startDebug()}
    />,
    <ToolbarIconButton
      key="step-into"
      iconName="step-into"
      fill="lightblue"
      title="Step into"
      enable={hasEngine && executionState === 3}
      clicked={async () => await engine.stepInto()}
    />,
    <ToolbarIconButton
      key="step-over"
      iconName="step-over"
      fill="lightblue"
      title="Step over"
      enable={hasEngine && executionState === 3}
      clicked={async () => await engine.stepOver()}
    />,
    <ToolbarIconButton
      key="step-out"
      iconName="step-out"
      fill="lightblue"
      title="Step out"
      enable={hasEngine && executionState === 3}
      clicked={async () => await engine.stepOut()}
    />,
    <ToolbarSeparator key="sep-1" />,
    <ToolbarIconButton
      key="keyboard"
      iconName="keyboard"
      title="Toggle keyboard"
      selected={showKeyboard}
      clicked={() =>
        executeKliveCommand(showKeyboard ? "hideKeyboard" : "showKeyboard")
      }
      highlightSize={32}
    />,
    <ToolbarSeparator key="sep-2" />,
  ];

  // --- Machine feature specific buttons
  const soundButtons = extraFeatures.includes("Sound")
    ? [
        <ToolbarIconButton
          key="mute"
          iconName={muted ? "unmute" : "mute"}
          title={muted ? "Unmute sound" : "Mute sound"}
          clicked={() => dispatch(emuMuteSoundAction(!muted))}
        />,
        <ToolbarSeparator key="sep3" />,
      ]
    : null;
  const tapeButtons = extraFeatures.includes("Tape")
    ? [
        <ToolbarIconButton
          key="fastLoad"
          iconName="rocket"
          title="Fast LOAD mode"
          selected={fastLoad}
          clicked={() => dispatch(spectrumFastLoadAction(!fastLoad))}
        />,
        <ToolbarIconButton
          key="reverse-tape"
          iconName="reverse-tape"
          title="Rewind the tape"
          enable={!loadMode}
          clicked={async () =>
            await (engine.getEngine() as ZxSpectrumCoreBase).initTapeContents()
          }
        />,
        <ToolbarSeparator key="sep-5" />,
      ]
    : null;
  const z88Buttons = extraFeatures.includes("Z88Cards")
    ? [
        <ToolbarIconButton
          key="z88Card"
          iconName="repo-push"
          title="Manage Z88 cards"
          clicked={async () => {
            await emuToMainMessenger.sendMessage({
              type: "ManageZ88Cards",
            });
          }}
        />,
      ]
    : null;

  // --- Toolbar properties
  const rootStyle: CSSProperties = {
    display: "flex",
    flexShrink: 0,
    flexGrow: 0,
    height: 40,
    width: "100%",
    padding: "0px 4px",
    backgroundColor: "var(--toolbar-active-background-color)",
    boxSizing: "border-box",
    alignItems: "center",
    justifyContent: "start",
    fontSize: "0.9em",
    zIndex: 10,
  };

  return (
    <div style={rootStyle}>
      {machineControlButtons}
      {soundButtons}
      {tapeButtons}
      {z88Buttons}
    </div>
  );
};
