import * as React from "react";
import { SpectrumMachineStateBase } from "../../machines/spectrum/ZxSpectrumCoreBase";
import { engineProxy } from "../engine-proxy";
import { SideBarPanelDescriptorBase } from "../side-bar/SideBarService";
import { SideBarPanelBase, SideBarProps } from "../SideBarPanelBase";
import { labelStyle, valueItemStyle, valueStyle } from "../utils/content-utils";

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
      <div style={labelStyle(92)}>{name}</div>
      <div style={valueStyle(16)}>{value}</div>
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
  title = TITLE;

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
        {stateRow(
          "KB: (CS ... V)",
          state
            ? ((0xff ^ state.keyboardLines[0]) & 0x1f)
                .toString(2)
                .padStart(5, "0")
            : "n/a"
        )}
        {stateRow(
          "KB: (B ... Spc)",
          state
            ? ((0xff ^ state.keyboardLines[1]) & 0x1f)
                .toString(2)
                .padStart(5, "0")
            : "n/a"
        )}
        {stateRow(
          "KB: (A ... G)",
          state
            ? ((0xff ^ state.keyboardLines[2]) & 0x1f)
                .toString(2)
                .padStart(5, "0")
            : "n/a"
        )}
        {stateRow(
          "KB: (H ... Ent)",
          state
            ? ((0xff ^ state.keyboardLines[3]) & 0x1f).toString(2).padStart(5, "0")
            : "n/a"
        )}
        {stateRow(
          "KB: (Q ... T)",
          state
            ? ((0xff ^ state.keyboardLines[4]) & 0x1f).toString(2).padStart(5, "0")
            : "n/a"
        )}
        {stateRow(
          "KB: (Y ... P)",
          state
            ? ((0xff ^ state.keyboardLines[5]) & 0x1f).toString(2).padStart(5, "0")
            : "n/a"
        )}
        {stateRow(
          "KB: (1 ... 5)",
          state
            ? ((0xff ^ state.keyboardLines[6]) & 0x1f).toString(2).padStart(5, "0")
            : "n/a"
        )}
        {stateRow(
          "KB: (6 ... 0)",
          state
            ? ((0xff ^ state.keyboardLines[7]) & 0x1f).toString(2).padStart(5, "0")
            : "n/a"
        )}
      </>
    );
  }

  protected async onRunEvent(): Promise<void> {
    const state = await engineProxy.getMachineState();
    this.setState({ machineState: state as SpectrumMachineStateBase });
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class UlaInformationPanelDescriptor extends SideBarPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <UlaInformationPanel descriptor={this} />;
  }
}
