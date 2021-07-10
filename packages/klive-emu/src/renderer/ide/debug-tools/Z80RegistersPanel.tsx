import * as React from "react";
import { CSSProperties } from "react";
import { Z80CpuState } from "../../cpu/Z80Cpu";
import { SvgIcon } from "../../common/SvgIcon";
import { SideBarPanelDescriptorBase } from "../side-bar/SideBarService";
import { SideBarPanelBase, SideBarProps } from "../SideBarPanelBase";
import { engineProxy } from "../engine-proxy";

const TITLE = "Z80 CPU State";

const rootStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  width: "auto",
  height: "auto",
  paddingLeft: 8,
  alignItems: "center",
};

const nameStyle: CSSProperties = {
  flexShrink: 0,
  flexGrow: 0,
  width: 30,
  fontWeight: 600,
};

const valueStyle: CSSProperties = {
  width: 16,
  color: "var(--hilited-color)",
};


/**
 * Displays the row of flags
 * @param bits Flags value
 */
function flagRow(bits: number) {
  const FStyle: CSSProperties = {
    flexShrink: 0,
    flexGrow: 0,
    width: 28,
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
        <SvgIcon
          iconName={value ? "circle-large-filled" : "circle-large-outline"}
          width={12}
          height={12}
          fill="--hilited-color"
        />
      </div>
    );
  }

  return (
    <div style={rootStyle}>
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
    <div style={rootStyle}>
      <div style={nameStyle}>{name}</div>
      <div
        style={valueStyle}
        title={`${high ?? name[0]}: ${hiByteStr} (${hiByte.toString(
          10
        )}): ${hiByte.toString(2).padStart(8, "0")} `}
      >
        {hiByteStr}
      </div>
      <div
        style={valueStyle}
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
  return <div style={rootStyle} >
    <div style={nameStyle}>{name}</div>
    <div style={valueStyle}>{value}</div>
  </div>
}

type State = {
  cpuState: Z80CpuState;
};

/**
 * Z80 registers panel
 */
export default class Z80RegistersPanel extends SideBarPanelBase<
  SideBarProps<{}>,
  State
> {
  title = TITLE;

  render() {
    return (
      <div>
        {flagRow(this.state?.cpuState?._af & 0xff ?? 0x00)}
        {regRow("PC", this.state?.cpuState?._af ?? 0, "\u{1d5e3}\u{1d5d6}:hi", "\u{1d5e3}\u{1d5d6}:lo")}
        {regRow("AF", this.state?.cpuState?._af ?? 0, "\u{1d5d4}", "\u{1d5d9}")}
        {regRow("BC", this.state?.cpuState?._bc ?? 0, "\u{1d5d5}", "\u{1d5d6}")}
        {regRow("DE", this.state?.cpuState?._de ?? 0, "\u{1d5d7}", "\u{1d5d8}")}
        {regRow("HL", this.state?.cpuState?._hl ?? 0, "\u{1d5db}", "\u{1d5dc}")}
        {regRow("SP", this.state?.cpuState?._sp ?? 0, "\u{1d5e6}\u{1d5e3}:hi", "\u{1d5e6}\u{1d5e3}:lo")}
        {regRow("IX", this.state?.cpuState?._ix ?? 0, "\u{1d5eb}\u{1d5db}", "\u{1d5eb}\u{1d5df}")}
        {regRow("IY", this.state?.cpuState?._iy ?? 0, "\u{1d5ec}\u{1d5db}", "\u{1d5ec}\u{1d5df}")}
        {regRow("IR", (this.state?.cpuState?._i ?? 0) << 8 | (this.state?.cpuState?._r), "\u{1d5dc}", "\u{1d5e5}")}
        {regRow("AF'", this.state?.cpuState?._af_sec ?? 0, "\u{1d5d4}'", "\u{1d5d9}'")}
        {regRow("BC'", this.state?.cpuState?._bc_sec ?? 0, "\u{1d5d5}'", "\u{1d5d6}'")}
        {regRow("DE'", this.state?.cpuState?._de_sec ?? 0, "\u{1d5d7}'", "\u{1d5d8}'")}
        {regRow("HL'", this.state?.cpuState?._hl_sec ?? 0, "\u{1d5db}'", "\u{1d5dc}'")}
        {regRow("WZ", this.state?.cpuState?._iy ?? 0, "\u{1d5ea}\u{1d5db}", "\u{1d5ea}\u{1d5df}")}
        {stateRow("IM", this.state?.cpuState?.interruptMode ?? 0)}
        {stateRow("IFF1", this.state?.cpuState?.iff1 ? 1 : 0)}
        {stateRow("IFF2", this.state?.cpuState?.iff2 ? 1 : 0)}
      </div>
    );
  }

  protected async onRunEvent(): Promise<void> {
    const cpuState = await engineProxy.getCpuState();
    this.setState({ cpuState: cpuState as Z80CpuState });
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class Z80RegistersPanelDescriptor extends SideBarPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <Z80RegistersPanel descriptor={this} />;
  }
}
