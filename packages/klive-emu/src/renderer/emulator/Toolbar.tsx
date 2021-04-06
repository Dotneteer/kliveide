import * as React from "react";
import { connect } from "react-redux";
import { emuToggleKeyboardAction } from "../../shared/state/emu-view-options-reducer";
import { AppState } from "../../shared/state/AppState";
import { ToolbarIconButton } from "../common/ToolbarIconButton";
import { ToolbarSeparator } from "../common/ToolbarSeparator";
import { vmEngineService } from "../machines/vm-engine-service";
import { emuStore } from "./emuStore";

interface Props {
  executionState?: number;
  showKeyboard?: boolean;
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
    return (
      <div className="toolbar">
        <ToolbarIconButton
          iconName="play"
          fill="lightgreen"
          title="Start"
          enable={
            this.state.hasEngine &&
            (executionState === 0 ||
              executionState === 3 ||
              executionState === 5)
          }
          clicked={async () => await engine.start()}
        />
        <ToolbarIconButton
          iconName="pause"
          fill="lightblue"
          title="Pause"
          enable={this.state.hasEngine && executionState === 1}
          clicked={async () => await engine.pause()}
        />
        <ToolbarIconButton
          iconName="stop"
          fill="orangered"
          title="Stop"
          enable={
            this.state.hasEngine &&
            (executionState === 1 || executionState === 3)
          }
          clicked={async () => await engine.stop()}
        />
        <ToolbarIconButton
          iconName="restart"
          fill="lightgreen"
          title="Restart"
          size={22}
          highlightSize={26}
          enable={
            this.state.hasEngine &&
            (executionState === 1 || executionState === 3)
          }
          clicked={async () => await engine.restart()}
        />
        <ToolbarSeparator />
        <ToolbarIconButton
          iconName="debug"
          fill="lightgreen"
          title="Debug"
          size={20}
          highlightSize={24}
          enable={
            this.state.hasEngine &&
            (executionState === 0 ||
              executionState === 3 ||
              executionState === 5)
          }
          clicked={async () => await engine.startDebug()}
        />
        <ToolbarIconButton
          iconName="step-into"
          fill="lightblue"
          title="Step into"
          enable={this.state.hasEngine && executionState === 3}
          clicked={async () => await engine.stepInto()}
        />
        <ToolbarIconButton
          iconName="step-over"
          fill="lightblue"
          title="Step over"
          enable={this.state.hasEngine && executionState === 3}
          clicked={async () => await engine.stepOver()}
        />
        <ToolbarIconButton
          iconName="step-out"
          fill="lightblue"
          title="Step out"
          enable={this.state.hasEngine && executionState === 3}
          clicked={async () => await engine.stepOut()}
        />
        <ToolbarSeparator />
        <ToolbarIconButton
          iconName="keyboard"
          title="Toggle keyboard"
          selected={this.props.showKeyboard}
          clicked={() => emuStore.dispatch(emuToggleKeyboardAction())}
          highlightSize={32}
        />
        <ToolbarSeparator />
        <ToolbarIconButton iconName="unmute" title="Unmute sound" />
        <ToolbarIconButton iconName="mute" title="Mute sound" />
        <ToolbarSeparator />
        <ToolbarIconButton iconName="rocket" title="Fast LOAD mode" />
        <ToolbarIconButton iconName="reverse-tape" title="Rewind the tape" />
        <ToolbarSeparator />
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
  };
}, null)(Toolbar);
