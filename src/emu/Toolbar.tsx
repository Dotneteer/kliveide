import * as React from "react";
import { connect } from "react-redux";

import { dispatch } from "@core/service-registry";
import { AppState } from "@state/AppState";
import { ToolbarIconButton } from "@components/ToolbarIconButton";
import { ToolbarSeparator } from "@components/ToolbarSeparator";
import { ExtraMachineFeatures } from "@abstractions/machine-specfic";
import { emuMuteSoundAction } from "@state/emulator-panel-reducer";
import {
  spectrumBeamPositionAction,
  spectrumFastLoadAction,
} from "@state/spectrum-specific-reducer";
import { executeKliveCommand } from "@abstractions/common-commands";
import { getVmEngineService } from "@modules-core/vm-engine-service";
import { ZxSpectrumCoreBase } from "@modules/vm-zx-spectrum/ZxSpectrumCoreBase";
import { emuToMainMessenger } from "../common-ui/services/EmuToMainMessenger";
import { CSSProperties } from "react";

interface Props {
  executionState?: number;
  showKeyboard?: boolean;
  showBeam?: boolean;
  extraFeatures?: ExtraMachineFeatures[];
  muted?: boolean;
  fastLoad?: boolean;
  loadMode?: boolean;
}

interface State {
  hasEngine: boolean;
}

/**
 * Represents the toolbar of the emulator
 */
export class Toolbar extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasEngine: getVmEngineService()?.hasEngine,
    };
  }

  componentDidMount(): void {
    getVmEngineService().vmEngineChanged.on(this.vmChange);
  }

  componentWillUnmount(): void {
    getVmEngineService().vmEngineChanged.off(this.vmChange);
  }

  render() {
    const engine = getVmEngineService();
    const executionState = this.props.executionState ?? 0;
    const machineControlButtons = [
      <ToolbarIconButton
        key="play"
        iconName="play"
        fill="lightgreen"
        title="Start"
        enable={
          this.state.hasEngine &&
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
        enable={this.state.hasEngine && executionState === 1}
        clicked={async () => await engine.pause()}
      />,
      <ToolbarIconButton
        key="stop"
        iconName="stop"
        fill="orangered"
        title="Stop"
        enable={
          this.state.hasEngine && (executionState === 1 || executionState === 3)
        }
        clicked={async () => await engine.stop()}
      />,
      <ToolbarIconButton
        key="restart"
        iconName="restart"
        fill="lightgreen"
        title="Restart"
        size={22}
        highlightSize={26}
        enable={
          this.state.hasEngine && (executionState === 1 || executionState === 3)
        }
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
          this.state.hasEngine &&
          (executionState === 0 || executionState === 3 || executionState === 5)
        }
        clicked={async () => await engine.startDebug()}
      />,
      <ToolbarIconButton
        key="step-into"
        iconName="step-into"
        fill="lightblue"
        title="Step into"
        enable={this.state.hasEngine && executionState === 3}
        clicked={async () => await engine.stepInto()}
      />,
      <ToolbarIconButton
        key="step-over"
        iconName="step-over"
        fill="lightblue"
        title="Step over"
        enable={this.state.hasEngine && executionState === 3}
        clicked={async () => await engine.stepOver()}
      />,
      <ToolbarIconButton
        key="step-out"
        iconName="step-out"
        fill="lightblue"
        title="Step out"
        enable={this.state.hasEngine && executionState === 3}
        clicked={async () => await engine.stepOut()}
      />,
      <ToolbarSeparator key="sep-1" />,
      <ToolbarIconButton
        key="keyboard"
        iconName="keyboard"
        title="Toggle keyboard"
        selected={this.props.showKeyboard}
        clicked={() =>
          executeKliveCommand(
            this.props.showKeyboard ? "hideKeyboard" : "showKeyboard"
          )
        }
        highlightSize={32}
      />,
      <ToolbarSeparator key="sep-2" />,
    ];
    const soundButtons = this.props.extraFeatures.includes("Sound")
      ? [
          <ToolbarIconButton
            key="mute"
            iconName={this.props.muted ? "unmute" : "mute"}
            title={this.props.muted ? "Unmute sound" : "Mute sound"}
            clicked={() => dispatch(emuMuteSoundAction(!this.props.muted))}
          />,
          <ToolbarSeparator key="sep3" />,
        ]
      : null;
    const beamButtons = this.props.extraFeatures.includes("UlaDebug")
      ? [
          <ToolbarIconButton
            key="beam-position"
            iconName="beam-position"
            fill="#ff80ff"
            title="Show ULA position"
            selected={this.props.showBeam}
            clicked={() =>
              dispatch(spectrumBeamPositionAction(!this.props.showBeam))
            }
          />,
          <ToolbarSeparator key="sep-4" />,
        ]
      : null;
    const tapeButtons = this.props.extraFeatures.includes("Tape")
      ? [
          <ToolbarIconButton
            key="fastLoad"
            iconName="rocket"
            title="Fast LOAD mode"
            selected={this.props.fastLoad}
            clicked={() =>
              dispatch(spectrumFastLoadAction(!this.props.fastLoad))
            }
          />,
          <ToolbarIconButton
            key="reverse-tape"
            iconName="reverse-tape"
            title="Rewind the tape"
            enable={!this.props.loadMode}
            clicked={async () =>
              await (
                engine.getEngine() as ZxSpectrumCoreBase
              ).initTapeContents()
            }
          />,
          <ToolbarSeparator key="sep-5" />,
        ]
      : null;
    const z88Buttons = this.props.extraFeatures.includes("Z88Cards")
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
    return (
      <div style={rootStyle}>
        {machineControlButtons}
        {soundButtons}
        {beamButtons}
        {tapeButtons}
        {z88Buttons}
      </div>
    );
  }

  vmChange = () => {
    this.setState({
      hasEngine: true,
    });
  };
}

export default connect((state: AppState) => {
  return {
    executionState: state.emulatorPanel.executionState,
    showKeyboard: state.emuViewOptions.showKeyboard,
    showBeam: state?.spectrumSpecific?.showBeamPosition,
    extraFeatures: state.emulatorPanel.extraFeatures ?? [],
    muted: state.emulatorPanel.muted,
    fastLoad: state.spectrumSpecific?.fastLoad,
    loadMode: state.spectrumSpecific?.loadMode,
  };
}, null)(Toolbar);

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