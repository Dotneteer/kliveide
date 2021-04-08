import * as React from "react";
import { connect } from "react-redux";
import { getVersion } from "../../version";
import { AppState, ProgramCounterInfo } from "../../shared/state/AppState";
import { SvgIcon } from "../common/SvgIcon";
import { vmEngineService } from "../machines/vm-engine-service";
import { themeService } from "../themes/theme-service";

interface Props {
  showFrames?: boolean;
  cpuFreq?: number;
  displayName: string;
  machineContext?: string;
  lastFrameTime?: string;
  lastEngineTime?: string;
  avgEngineTime?: string;
  avgFrameTime?: string;
  renderedFrames?: number;
  pcInfo?: ProgramCounterInfo;
}

/**
 * Represents the statusbar of the emulator
 */
class Statusbar extends React.Component<Props> {
  private _fillValue: string;

  constructor(props: Props) {
    super(props);
    this._fillValue = themeService.getProperty("--statusbar-foreground-color");
  }

  render() {
    const frameInformation = [
      <div key="1" className="section">
        <SvgIcon
          iconName="vm-running"
          width={16}
          height={16}
          fill={this._fillValue}
        />
        <span className="label">
          {this.props.avgEngineTime} / {this.props.lastEngineTime}
        </span>
      </div>,
      <div
        key="2"
        className="section"
        title="Total time per frame (average/last)"
      >
        <SvgIcon iconName="vm" width={16} height={16} fill={this._fillValue} />
        <span className="label">
          {this.props.avgFrameTime} / {this.props.lastFrameTime}
        </span>
      </div>,
      <div key="3" className="section" title="# of frames rendered since start">
        <SvgIcon
          iconName="window"
          width={16}
          height={16}
          fill={this._fillValue}
        />
        <span className="label">{this.props.renderedFrames}</span>
      </div>,
      <div key="4" className="section" title="The value of Program Counter">
        <span className="label">
          {this.props.pcInfo?.label ?? ""}: $
          {(this.props.pcInfo?.value ?? 0).toString(16).toUpperCase().padStart(4, "0")}
        </span>
      </div>,
    ];
    const cpuInformation = [
      <div key="14" className="section">
        <span className="label">{this.props.displayName}</span>
      </div>,
      <div key="15" className="section">
        <span className="label">{this.props.machineContext}</span>
      </div>,
      <div key="16" className="section">
        <span className="label">
          CPU: {(this.props.cpuFreq / 1000000).toFixed(4)}Mhz
        </span>
      </div>,
    ];
    return (
      <div className="statusbar">
        {this.props.showFrames && frameInformation}
        <div key="placeholder" className="placeholder" />
        {vmEngineService.hasEngine && cpuInformation}
        <div className="section">
          <span className="label">Klive {getVersion()}</span>
        </div>
      </div>
    );
  }
}

export default connect((state: AppState) => {
  return {
    showFrames: state.emuViewOptions.showFrameInfo,
    cpuFreq:
      state.emulatorPanel.clockMultiplier *
      state.emulatorPanel.baseClockFrequency,
    displayName: vmEngineService.hasEngine
      ? vmEngineService.getEngine()?.displayName ?? ""
      : "",
    machineContext: state.emulatorPanel.machineContext,
    lastFrameTime: state.emulatorPanel.frameDiagData.lastFrameTime.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }
    ),
    lastEngineTime: state.emulatorPanel.frameDiagData.lastEngineTime.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }
    ),
    avgEngineTime: state.emulatorPanel.frameDiagData.avgEngineTime.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }
    ),
    avgFrameTime: state.emulatorPanel.frameDiagData.avgFrameTime.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }
    ),
    renderedFrames: state.emulatorPanel.frameDiagData.renderedFrames,
    pcInfo: state.emulatorPanel.frameDiagData.pcInfo,
  };
}, null)(Statusbar);
