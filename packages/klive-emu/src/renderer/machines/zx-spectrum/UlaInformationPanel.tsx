import * as React from "react";
import { SpectrumMachineStateBase } from "./ZxSpectrumCoreBase";
import { getEngineProxyService } from "@abstractions/service-helpers";
import { SideBarPanelDescriptorBase } from "../../ide/side-bar/SideBarService";
import { SideBarPanelBase, SideBarProps } from "../../ide/SideBarPanelBase";
import {
  labelStyle,
  separatorLine,
  valueItemStyle,
  valueStyle,
} from "../../ide/utils/content-utils";
import { CSSProperties } from "react";
import { Icon } from "../../common-ui/Icon";

const TITLE = "ULA Information";

const BORDER_NAMES = [
  "black",
  "blue",
  "red",
  "magenta",
  "green",
  "cyan",
  "yellow",
  "white",
];
const RENDERING_PHASES = [
  "None",
  "Border",
  "BorderFetchPixel",
  "BorderFetchAttr",
  "DisplayB1",
  "DisplayB1FetchB2",
  "DisplayB1FetchA2",
  "DisplayB2",
  "DisplayB2FetchB1",
  "DisplayB2FetchA1",
];

/**
 * Displays the content of a register status value
 * @param name Status name
 * @param value Status value
 */
function stateRow(name: string, value: string | number) {
  return (
    <div style={valueItemStyle}>
      <div style={labelStyle(128)}>{name}</div>
      <div style={valueStyle(16)}>{value}</div>
    </div>
  );
}

/**
 * Displays the content of a keyboard line
 * @param line Line number
 * @param value Line value
 */
function kbLine(line: number, title: string, value: number) {
  const flagValueStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: 16,
    width: 16,
  };

  function kbFlag(pos: number) {
    return (
      <div style={flagValueStyle} title={`line ${line}/bit ${pos}`}>
        <Icon
          iconName={
            (value >> pos) & 0x01
              ? "circle-large-outline"
              : "circle-large-filled"
          }
          width={10}
          height={10}
          fill="--hilited-color"
        />
      </div>
    );
  }
  return (
    <div style={valueItemStyle}>
      <div style={labelStyle(128)} title={`Keyboard line ${line}`}>
        {title}
      </div>
      {kbFlag(4)}
      {kbFlag(3)}
      {kbFlag(2)}
      {kbFlag(1)}
      {kbFlag(0)}
    </div>
  );
}

/**
 * ULA panel state
 */
type State = {
  machineState?: SpectrumMachineStateBase;
};

/**
 * ULA information panel
 */
export default class UlaInformationPanel extends SideBarPanelBase<
  SideBarProps<{}>,
  State
> {
  noMacineLine2 = "to see the ULA state";

  renderContent() {
    const state = this.state?.machineState;
    return (
      <>
        {stateRow(
          "Border",
          state ? BORDER_NAMES[(state.borderColor ?? 0) % 7] : "n/a"
        )}
        {stateRow(
          "Flash phase",
          state ? (state.flashPhase ? "on" : "off") : "n/a"
        )}
        {stateRow("Frame tact", state?.tacts ?? "n/a")}
        {stateRow("Pixel byte #1", state?.pixelByte1 ?? "n/a")}
        {stateRow("Attr byte #1", state?.attrByte1 ?? "n/a")}
        {stateRow("Pixel byte #2", state?.pixelByte2 ?? "n/a")}
        {stateRow("Attr byte #2", state?.attrByte2 ?? "n/a")}
        {stateRow(
          "Rendering",
          state ? RENDERING_PHASES[(state.renderingPhase ?? 0) % 10] : "n/a"
        )}
        {stateRow(
          "Pixel address",
          state ? "$" + state.pixelAddr.toString(16).padStart(4, "0") : "n/a"
        )}
        {stateRow(
          "Attr address",
          state ? "$" + state.attrAddr.toString(16).padStart(4, "0") : "n/a"
        )}
        {stateRow(
          "EAR bit",
          state ? (state.beeperLastEarBit ? "1" : "0") : "n/a"
        )}
        {separatorLine()}
        {kbLine(0, "KB: (CS ... V)", state?.keyboardLines[0] ?? 0)}
        {kbLine(1, "KB: (A ... G)", state?.keyboardLines[1] ?? 0)}
        {kbLine(2, "KB: (Q ... T)", state?.keyboardLines[2] ?? 0)}
        {kbLine(3, "KB: (1 ... 5)", state?.keyboardLines[3] ?? 0)}
        {kbLine(4, "KB: (6 ... 0)", state?.keyboardLines[4] ?? 0)}
        {kbLine(5, "KB: (Y ... P)", state?.keyboardLines[5] ?? 0)}
        {kbLine(6, "KB: (H ... Ent)", state?.keyboardLines[6] ?? 0)}
        {kbLine(7, "KB: (B ... Spc)", state?.keyboardLines[7] ?? 0)}
      </>
    );
  }

  protected async onRunEvent(): Promise<void> {
    const state = await getEngineProxyService().getCachedMachineState();
    this.setState({ machineState: state as SpectrumMachineStateBase });
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class UlaInformationPanelDescriptor extends SideBarPanelDescriptorBase {
  /**
   * Panel title
   */
  get title(): string {
    return TITLE;
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <UlaInformationPanel descriptor={this} />;
  }
}
