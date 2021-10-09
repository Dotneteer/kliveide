import * as React from "react";
import { CSSProperties } from "react";

import { getEngineProxyService } from "@core/service-registry";

import { Z80CpuState } from "../../cpu/Z80Cpu";
import { Icon } from "../../common-ui/Icon";
import { SideBarPanelDescriptorBase } from "../../ide/side-bar/SideBarService";
import { SideBarPanelBase, SideBarProps } from "../../ide/SideBarPanelBase";
import {
  labelStyle,
  valueItemStyle,
  valueStyle,
} from "../../ide/utils/content-utils";
import { MachineState } from "../core/vm-core-types";

const TITLE = "Z80 CPU State";

/**
 * Displays the row of flags
 * @param bits Flags value
 */
function flagRow(bits: number) {
  const FStyle: CSSProperties = {
    flexShrink: 0,
    flexGrow: 0,
    width: 32,
    fontSize: "1.4em",
  };

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
    width: 16,
  };

  function flag(value: number, set: string, clr: string) {
    const valueStyle: CSSProperties = {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: 16,
      width: 16,
    };
    return (
      <div style={valueStyle} title={value ? `${set} (1) ` : `${clr} (0)`}>
        <Icon
          iconName={value ? "circle-large-filled" : "circle-large-outline"}
          width={10}
          height={10}
          fill="--hilited-color"
        />
      </div>
    );
  }

  return (
    <div style={valueItemStyle}>
      <div style={FStyle}>F</div>
      <div style={flagsStyle}>
        <div style={flagRowStyle}>
          <div style={nameStyle} title="Sign flag">
            S
          </div>
          <div style={nameStyle} title="Zero flag">
            Z
          </div>
          <div style={nameStyle} title="Flag 5 (unused)">
            5
          </div>
          <div style={nameStyle} title="Half carry flag">
            H
          </div>
          <div style={nameStyle} title="Flag 3 (unused)">
            3
          </div>
          <div style={nameStyle} title="Parity/Overflow flag">
            P
          </div>
          <div style={nameStyle} title="Add/Subtract flag">
            N
          </div>
          <div style={nameStyle} title="Carry flag">
            C
          </div>
        </div>
        <div style={flagRowStyle}>
          {flag(bits & 0x80, "M", "P")}
          {flag(bits & 0x40, "Z", "NZ")}
          {flag(bits & 0x20, "5", "N5")}
          {flag(bits & 0x10, "", "")}
          {flag(bits & 0x08, "3", "N3")}
          {flag(bits & 0x04, "PO", "PE")}
          {flag(bits & 0x02, "", "")}
          {flag(bits & 0x01, "C", "NC")}
        </div>
      </div>
    </div>
  );
}

/**
 * Displays the contents of a 16-bit register
 * @param name Register name
 * @param bits Value
 * @param high High register part name
 * @param low Low register part name
 */
function regRow(name: string, bits: number, high?: string, low?: string) {
  const decStyle: CSSProperties = {
    marginLeft: 4,
    color: "var(--information-color)",
  };

  const hiByte = (bits & 0xff00) >> 8;
  const hiByteStr = hiByte.toString(16).padStart(2, "0").toUpperCase();
  const loByte = bits & 0xff;
  const loByteStr = loByte.toString(16).padStart(2, "0").toUpperCase();

  return (
    <div style={valueItemStyle}>
      <div style={labelStyle()}>{name}</div>
      <div
        style={valueStyle(16)}
        title={`${high ?? name[0]}: ${hiByteStr} (${hiByte.toString(
          10
        )}): ${hiByte.toString(2).padStart(8, "0")} `}
      >
        {hiByteStr}
      </div>
      <div
        style={valueStyle(16)}
        title={`${low ?? name[1]}: ${loByteStr} (${loByte.toString(
          10
        )}): ${loByte.toString(2).padStart(8, "0")} `}
      >
        {loByteStr}
      </div>
      <div
        style={decStyle}
        title={`${name}: ${hiByteStr}${loByteStr} (${bits.toString(10)}): ${bits
          .toString(2)
          .padStart(16, "0")}`}
      >
        ({bits.toString(10)})
      </div>
    </div>
  );
}

/**
 * Displays the content of a register status value
 * @param name Status name
 * @param value Status value
 */
function stateRow(name: string, value: number) {
  return (
    <div style={valueItemStyle}>
      <div style={labelStyle()}>{name}</div>
      <div style={valueStyle(16)}>{value}</div>
    </div>
  );
}

/**
 * Z80 register panel state
 */
type State = {
  machineState?: Z80CpuState & MachineState;
};

/**
 * Z80 registers panel
 */
export default class Z80RegistersPanel extends SideBarPanelBase<
  SideBarProps<{}>,
  State
> {
  noMacineLine2 = "to see the CPU state";

  renderContent() {
    const state = this.state?.machineState;
    return (
      <>
        {flagRow(state?._af & 0xff ?? 0x00)}
        <div style={valueItemStyle}>
          <div style={labelStyle()}>CLK</div>

          <div style={valueStyle(64)}>
            {new Intl.NumberFormat().format(
              (state?.tacts ?? 0) +
                (state?.tactsInFrame ?? 0) * (state?.frameCount ?? 0)
            )}
          </div>
        </div>

        {regRow(
          "PC",
          state?._af ?? 0,
          "\u{1d5e3}\u{1d5d6}:hi",
          "\u{1d5e3}\u{1d5d6}:lo"
        )}
        {regRow("AF", state?._af ?? 0, "\u{1d5d4}", "\u{1d5d9}")}
        {regRow("BC", state?._bc ?? 0, "\u{1d5d5}", "\u{1d5d6}")}
        {regRow("DE", state?._de ?? 0, "\u{1d5d7}", "\u{1d5d8}")}
        {regRow(
          "HL",
          this.state?.machineState?._hl ?? 0,
          "\u{1d5db}",
          "\u{1d5dc}"
        )}
        {regRow(
          "SP",
          state?._sp ?? 0,
          "\u{1d5e6}\u{1d5e3}:hi",
          "\u{1d5e6}\u{1d5e3}:lo"
        )}
        {regRow(
          "IX",
          state?._ix ?? 0,
          "\u{1d5eb}\u{1d5db}",
          "\u{1d5eb}\u{1d5df}"
        )}
        {regRow(
          "IY",
          state?._iy ?? 0,
          "\u{1d5ec}\u{1d5db}",
          "\u{1d5ec}\u{1d5df}"
        )}
        {regRow(
          "IR",
          ((state?._i ?? 0) << 8) | state?._r,
          "\u{1d5dc}",
          "\u{1d5e5}"
        )}
        {regRow("AF'", state?._af_sec ?? 0, "\u{1d5d4}'", "\u{1d5d9}'")}
        {regRow("BC'", state?._bc_sec ?? 0, "\u{1d5d5}'", "\u{1d5d6}'")}
        {regRow("DE'", state?._de_sec ?? 0, "\u{1d5d7}'", "\u{1d5d8}'")}
        {regRow("HL'", state?._hl_sec ?? 0, "\u{1d5db}'", "\u{1d5dc}'")}
        {regRow(
          "WZ",
          state?._iy ?? 0,
          "\u{1d5ea}\u{1d5db}",
          "\u{1d5ea}\u{1d5df}"
        )}
        {stateRow("IM", state?.interruptMode ?? 0)}
        {stateRow("IFF1", state?.iff1 ? 1 : 0)}
        {stateRow("IFF2", state?.iff2 ? 1 : 0)}
      </>
    );
  }

  protected async onRunEvent(): Promise<void> {
    const cpuState = await getEngineProxyService().getCachedMachineState();
    this.setState({ machineState: cpuState as Z80CpuState & MachineState });
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class Z80RegistersPanelDescriptor extends SideBarPanelDescriptorBase {
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
    return <Z80RegistersPanel descriptor={this} />;
  }
}
