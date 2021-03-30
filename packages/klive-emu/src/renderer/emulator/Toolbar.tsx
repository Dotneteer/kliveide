import * as React from "react";
import { ToolbarIconButton } from "../common/ToolbarIconButton";
import { ToolbarSeparator } from "../common/ToolbarSeparator";

/**
 * Represents the toolbar of the emulator
 */
export class Toolbar extends React.Component {
  render() {
    return (
      <div className="toolbar">
        <ToolbarIconButton iconName="play" fill="lightgreen" title="Start" />
        <ToolbarIconButton iconName="pause" fill="lightblue" title="Pause" />
        <ToolbarIconButton iconName="stop" fill="orangered" title="Stop" />
        <ToolbarIconButton
          iconName="restart"
          fill="lightgreen"
          title="Restart"
          size={22}
          highlightSize={26}
        />
        <ToolbarSeparator />
        <ToolbarIconButton
          iconName="debug"
          fill="lightgreen"
          title="Debug"
          size={20}
          highlightSize={24}
        />
        <ToolbarIconButton
          iconName="step-into"
          fill="lightblue"
          title="Step into"
        />
        <ToolbarIconButton
          iconName="step-over"
          fill="lightblue"
          title="Step over"
        />
        <ToolbarIconButton
          iconName="step-out"
          fill="lightblue"
          title="Step out"
        />
        <ToolbarSeparator />
        <ToolbarIconButton
          iconName="keyboard"
          title="Toggle keyboard"
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
}
