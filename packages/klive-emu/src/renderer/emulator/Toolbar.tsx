import * as React from "react";
import { connect } from "react-redux";
import { emuToggleKeyboardAction } from "../../shared/state/emu-view-options-reducer";
import { AppState } from "../../shared/state/AppState";
import { ToolbarIconButton } from "../common-ui/ToolbarIconButton";
import { ToolbarSeparator } from "../common-ui/ToolbarSeparator";
import { vmEngineService } from "../machines/core/vm-engine-service";
import { emuStore } from "./emuStore";
import { ExtraMachineFeatures } from "../../shared/machines/machine-specfic";
import {
  emuMuteSoundAction,
  emuUnmuteSoundAction,
} from "../../shared/state/emulator-panel-reducer";
import {
  spectrumBeamPositionAction,
  spectrumFastLoadAction,
} from "../../shared/state/spectrum-specific-reducer";
import { ZxSpectrumCoreBase } from "../machines/zx-spectrum/ZxSpectrumCoreBase";
import styles from "styled-components";
import { emuToMainMessenger } from "./EmuToMainMessenger";

const Root = styles.div`
  display: flex;
  flex-shrink: 0;
  flex-grow: 0;
  height: 40px;
  width: 100%;
  padding: 0px 4px;
  background-color: var(--toolbar-active-background-color);
  box-sizing: border-box;
  align-items: center;
  justify-content: start;
  font-size: 0.9em;
`;

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
      hasEngine: false,
    };
  }

  componentDidMount(): void {
    vmEngineService.vmEngineChanged.on(this.vmChange);
  }

  componentWillUnmount(): void {
    vmEngineService.vmEngineChanged.off(this.vmChange);
  }

  render() {
    const engine = vmEngineService;
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
        clicked={() => emuStore.dispatch(emuToggleKeyboardAction())}
        highlightSize={32}
      />,
      <ToolbarSeparator key="sep-2" />,
    ];
    const soundButtons = this.props.extraFeatures.includes("Sound")
      ? [
          this.props.muted ? (
            <ToolbarIconButton
              key="unmute"
              iconName="unmute"
              title="Unmute sound"
              clicked={() => emuStore.dispatch(emuUnmuteSoundAction())}
            />
          ) : (
            <ToolbarIconButton
              key="mute"
              iconName="mute"
              title="Mute sound"
              clicked={() => emuStore.dispatch(emuMuteSoundAction())}
            />
          ),
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
              emuStore.dispatch(
                spectrumBeamPositionAction(!this.props.showBeam)
              )
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
              emuStore.dispatch(spectrumFastLoadAction(!this.props.fastLoad))
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
      <Root>
        {machineControlButtons}
        {soundButtons}
        {beamButtons}
        {tapeButtons}
        {z88Buttons}
      </Root>
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
