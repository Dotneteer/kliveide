import * as React from "react";
import { connect } from "react-redux";
import { getVersion } from "../../version";
import { AppState, ProgramCounterInfo } from "../../shared/state/AppState";
import { SvgIcon } from "../common/SvgIcon";
import { vmEngineService } from "../machines/vm-engine-service";
import { themeService } from "../themes/theme-service";
import { Root, Gap, Section, Label} from "../common/StatusbarStyles";

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
      <Section key="1">
        <SvgIcon
          iconName="vm-running"
          width={16}
          height={16}
          fill={this._fillValue}
        />
        <Label>
          {this.props.avgEngineTime} / {this.props.lastEngineTime}
        </Label>
      </Section>,
      <Section
        key="2"
        title="Total time per frame (average/last)"
      >
        <SvgIcon iconName="vm" width={16} height={16} fill={this._fillValue} />
        <Label>
          {this.props.avgFrameTime} / {this.props.lastFrameTime}
        </Label>
      </Section>,
      <Section key="3" title="# of frames rendered since start">
        <SvgIcon
          iconName="window"
          width={16}
          height={16}
          fill={this._fillValue}
        />
        <Label>{this.props.renderedFrames}</Label>
      </Section>,
      <Section key="4" title="The value of Program Counter">
        <Label>
          {this.props.pcInfo?.label ?? ""}: $
          {(this.props.pcInfo?.value ?? 0)
            .toString(16)
            .toUpperCase()
            .padStart(4, "0")}
        </Label>
      </Section>,
    ];
    const cpuInformation = [
      <Section key="14" >
        <Label>{this.props.displayName}</Label>
      </Section>,
      <Section key="15">
        <Label>{this.props.machineContext}</Label>
      </Section>,
      <Section key="16">
        <Label>
          CPU: {(this.props.cpuFreq / 1000000).toFixed(4)}Mhz
        </Label>
      </Section>,
    ];
    return (
      <Root>
        {this.props.showFrames && frameInformation}
        <Gap />
        {vmEngineService.hasEngine && cpuInformation}
        <Section>
          <Label>Klive {getVersion()}</Label>
        </Section>
      </Root>
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
