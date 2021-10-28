import { separatorLine, valueItemStyle } from "@components/content-utils";
import { SideBarPanelBase, SideBarProps } from "@components/SideBarPanelBase";
import { getEngineProxyService } from "@services/engine-proxy";
import { SideBarPanelDescriptorBase } from "@services/SideBarService";
import * as React from "react";
import { CSSProperties } from "react";

import { Icon } from "../../common-ui/components/Icon";
import { CambridgeZ88MachineState } from "./CambridgeZ88Core";

const TITLE = "BLINK Information";

const flagsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const flagRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
};

const nameStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  fontWeight: 600,
  height: 16,
  width: 20,
};

function regNameStyle(width = 32): CSSProperties {
  return {
    flexShrink: 0,
    flexGrow: 0,
    width,
  };
}

const regValueStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: 16,
  width: 20,
  marginRight: 8,
  color: "var(--hilited-color)",
};

function flagValueStyle(width = 20): CSSProperties {
  return {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: 16,
    width,
  };
}

const decStyle: CSSProperties = {
  marginRight: 8,
  color: "var(--information-color)",
};

/**
 * Displays the content of a register status value
 * @param name Status name
 * @param value Status value
 */
function stateRow2(name: string, title: string, value: number) {
  const regValue = value.toString(16).padStart(2, "0").toUpperCase();
  return (
    <div style={valueItemStyle}>
      <div style={regNameStyle()} title={title}>
        {name}
      </div>
      <div style={regValueStyle}>{regValue}</div>
      <div style={decStyle}>{`(${value})`}</div>
    </div>
  );
}

/**
 * Displays the content of a keyboard line
 * @param line Line number
 * @param value Line value
 */
function kbLine(line: number, value: number) {
  function kbFlag(pos: number) {
    return (
      <div style={flagValueStyle(16)} title={`line ${line}/bit ${pos}`}>
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
      <div style={regNameStyle(78)} title={`Keyboard line ${line}`}>
        {`KB line #${line}`}
      </div>
      {kbFlag(7)}
      {kbFlag(6)}
      {kbFlag(5)}
      {kbFlag(4)}
      {kbFlag(3)}
      {kbFlag(2)}
      {kbFlag(1)}
      {kbFlag(0)}
    </div>
  );
}

/**
 * Displays a flag
 * @param value Flag value
 * @param set Name when flag set
 * @param clr Name when flag clear
 */
function flag(value: number, set: string, clr: string) {
  return (
    <div style={flagValueStyle()} title={value ? `${set} (1) ` : `${clr} (0)`}>
      <Icon
        iconName={value ? "circle-large-filled" : "circle-large-outline"}
        width={10}
        height={10}
        fill="--hilited-color"
      />
    </div>
  );
}

/**
 * Displays the COM flags
 * @param bits Flags value
 */
function comRow(bits: number) {
  const regValue = bits.toString(16).padStart(2, "0").toUpperCase();
  return (
    <div style={valueItemStyle}>
      <div style={regNameStyle()}>COM</div>
      <div style={regValueStyle} title={`COM: ${regValue} (${bits})`}>
        {regValue}
      </div>
      <div style={flagsStyle}>
        <div style={flagRowStyle}>
          <div style={nameStyle} title="SRUN: Speaker source">
            SR
          </div>
          <div
            style={nameStyle}
            title="SBIT: SRUN=0: 0=low, 1=high; SRUN=1: 0=3200 Hz, 1=TxD"
          >
            SB
          </div>
          <div style={nameStyle} title="OVERP: Set to overprogram EPROMs">
            OV
          </div>
          <div
            style={nameStyle}
            title="RESTIM: Set to reset the RTC, clear to continue"
          >
            RE
          </div>
          <div
            style={nameStyle}
            title="PROGRAM: Set to enable EPROM programming"
          >
            PR
          </div>
          <div style={nameStyle} title="RAMS: Binding of lower 8K of segment 0">
            RA
          </div>
          <div
            style={nameStyle}
            title="VPPON: Set to turn programming voltage ON"
          >
            VP
          </div>
          <div
            style={nameStyle}
            title="LCDON: Set to turn LCD ON, clear to turn LCD OFF"
          >
            LC
          </div>
        </div>
        <div style={flagRowStyle}>
          {flag(bits & 0x80, "TxD/3200Hz", "SBIT")}
          {flag(
            bits & 0x40,
            bits & 0x80 ? "TxD" : "high",
            bits & 0x80 ? "3200Hz" : "low"
          )}
          {flag(bits & 0x20, "high", "low")}
          {flag(bits & 0x10, "Reset the RTC", "Continue")}
          {flag(bits & 0x08, "enabled", "disabled")}
          {flag(bits & 0x04, "Bank $20", "Bank $00")}
          {flag(bits & 0x02, "on", "off")}
          {flag(bits & 0x01, "on", "off")}
        </div>
      </div>
    </div>
  );
}

/**
 * Displays the INT flags
 * @param bits Flags value
 */
function intRow(bits: number) {
  const regValue = bits.toString(16).padStart(2, "0").toUpperCase();
  return (
    <div style={valueItemStyle}>
      <div style={regNameStyle()}>INT</div>
      <div style={regValueStyle} title={`INT: ${regValue} (${bits})`}>
        {regValue}
      </div>
      <div style={flagsStyle}>
        <div style={flagRowStyle}>
          <div
            style={nameStyle}
            title="KWAIT: If set, reading the keyboard will Snooze"
          >
            KW
          </div>
          <div
            style={nameStyle}
            title="A19: If set, an active high on A19 will exit Coma"
          >
            19
          </div>
          <div
            style={nameStyle}
            title="FLAP: If set, flap interrupts are enabled"
          >
            FL
          </div>
          <div
            style={nameStyle}
            title="UART: If set, UART interrupts are enabled"
          >
            UA
          </div>
          <div
            style={nameStyle}
            title="BTL: If set, battery low interrupts are enabled"
          >
            BT
          </div>
          <div
            style={nameStyle}
            title="KEY: If set, keyboard interrupts (Snooze or Coma) are enabl."
          >
            KE
          </div>
          <div
            style={nameStyle}
            title="TIME: If set, RTC interrupts are enabled"
          >
            TI
          </div>
          <div
            style={nameStyle}
            title="GINT: If clear, no interrupts get out of blink"
          >
            GI
          </div>
        </div>
        <div style={flagRowStyle}>
          {flag(bits & 0x80, "on", "off")}
          {flag(bits & 0x40, "on", "off")}
          {flag(bits & 0x20, "enabled", "disabled")}
          {flag(bits & 0x10, "enabled", "disabled")}
          {flag(bits & 0x08, "enabled", "disabled")}
          {flag(bits & 0x04, "enabled", "disabled")}
          {flag(bits & 0x02, "enabled", "disabled")}
          {flag(bits & 0x01, "enabled", "disabled")}
        </div>
      </div>
    </div>
  );
}

/**
 * Displays the STA flags
 * @param bits Flags value
 */
function staRow(bits: number) {
  const regValue = bits.toString(16).padStart(2, "0").toUpperCase();
  return (
    <div style={valueItemStyle}>
      <div style={regNameStyle()}>STA</div>
      <div style={regValueStyle} title={`STA: ${regValue} (${regValue})`}>
        {bits.toString(16).padStart(2, "0").toUpperCase()}
      </div>
      <div style={flagsStyle}>
        <div style={flagRowStyle}>
          <div
            style={nameStyle}
            title="FLAPOPEN: If set, flap open else flap closed"
          >
            FO
          </div>
          <div
            style={nameStyle}
            title="A19: If set, high level on A19 occurred during coma"
          >
            19
          </div>
          <div
            style={nameStyle}
            title="FLAP: If set, positive edge has occurred on FLAPOPEN"
          >
            FL
          </div>
          <div
            style={nameStyle}
            title="UART: If set, an enabled UART interrupt is active"
          >
            UA
          </div>
          <div
            style={nameStyle}
            title="BTL: If set, battery low interrupts are enabled"
          >
            BT
          </div>
          <div
            style={nameStyle}
            title="KEY: If set, a column has gone low in snooze (or coma)"
          >
            KE
          </div>
          <div style={nameStyle} title="Unused">
            --
          </div>
          <div
            style={nameStyle}
            title="TIME: If set, an enabled TIME interrupt is active"
          >
            TI
          </div>
        </div>
        <div style={flagRowStyle}>
          {flag(bits & 0x80, "open", "closed")}
          {flag(bits & 0x40, "high", "low")}
          {flag(bits & 0x20, "pos. edge", "none")}
          {flag(bits & 0x10, "active", "inactive")}
          {flag(bits & 0x08, "active", "inactive")}
          {flag(bits & 0x04, "gone low", "none")}
          {flag(bits & 0x02, "n/a", "n/a")}
          {flag(bits & 0x01, "active", "inactive")}
        </div>
      </div>
    </div>
  );
}

/**
 * ULA panel state
 */
type State = {
  machineState?: CambridgeZ88MachineState;
};

/**
 * ULA information panel
 */
export default class BlinkInformationPanel extends SideBarPanelBase<
  SideBarProps<{}>,
  State
> {
  renderContent() {
    const state = this.state?.machineState;
    return (
      <>
        {comRow(state?.COM ?? 0)}
        {intRow(state?.INT ?? 0)}
        {staRow(state?.STA ?? 0)}
        {separatorLine(2)}
        {stateRow2("SR0", "Switch Register 0", state?.SR0 ?? 0)}
        {stateRow2("SR1", "Switch Register 1", state?.SR1 ?? 0)}
        {stateRow2("SR2", "Switch Register 2", state?.SR2 ?? 0)}
        {stateRow2("SR3", "Switch Register 3", state?.SR3 ?? 0)}
        {separatorLine()}
        {stateRow2("PB0", "PB0 Register", state?.PB0 ?? 0)}
        {stateRow2("PB1", "PB1 Register", state?.PB1 ?? 0)}
        {stateRow2("PB2", "PB2 Register", state?.PB2 ?? 0)}
        {stateRow2("PB3", "PB3 Register", state?.PB3 ?? 0)}
        {stateRow2("SBR", "SBR Register", state?.SBF ?? 0)}
        {separatorLine()}
        {stateRow2("TIM0", "TIM0 Register (5ms )", state?.TIM0 ?? 0)}
        {stateRow2("TIM1", "TIM1 Register (1 second)", state?.TIM1 ?? 0)}
        {stateRow2("TIM2", "TIM2 Register (1 minute)", state?.TIM2 ?? 0)}
        {stateRow2("TIM3", "TIM3 Register (256 minutes)", state?.TIM3 ?? 0)}
        {stateRow2("TIM4", "TIM4 Register (64K minutes)", state?.TIM4 ?? 0)}
        {separatorLine()}
        {kbLine(0, state?.KBLine0 ?? 0)}
        {kbLine(1, state?.KBLine1 ?? 0)}
        {kbLine(2, state?.KBLine2 ?? 0)}
        {kbLine(3, state?.KBLine3 ?? 0)}
        {kbLine(4, state?.KBLine4 ?? 0)}
        {kbLine(5, state?.KBLine5 ?? 0)}
        {kbLine(6, state?.KBLine6 ?? 0)}
        {kbLine(7, state?.KBLine7 ?? 0)}
      </>
    );
  }

  protected async onRunEvent(): Promise<void> {
    const state = await getEngineProxyService().getCachedMachineState();
    this.setState({ machineState: state as CambridgeZ88MachineState });
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class BlinkInformationPanelDescriptor extends SideBarPanelDescriptorBase {
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
    return <BlinkInformationPanel descriptor={this} />;
  }
}
