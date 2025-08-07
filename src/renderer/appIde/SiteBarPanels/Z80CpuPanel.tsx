import { Separator } from "@controls/Labels";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { Z80CpuState } from "@common/messaging/EmuApi";
import {
  Bit16Value,
  Bit8Value,
  FlagLetter,
  FlagValue,
  SimpleValue,
  VerticalFlagValue
} from "@renderer/controls/valuedisplay/Values";
import { CenteredRow, Col, SidePanel } from "@renderer/controls/valuedisplay/Layout";

const REG16_TOOLTIP = "{r16N}: {r16v}\n{r8HN}: {r8Hv}\n{r8LN}: {r8Lv}";
const REG16_ONLY_TOOLTIP = "{r16N}: {r16v}";
const REG8_TOOLTIP = "{r8N}: {r8v}";

const CpuPanel = () => {
  const emuApi = useEmuApi();
  const [cpuState, setCpuState] = useState<Z80CpuState>(null);

  const toFlag = (value: number | undefined, bitNo: number) =>
    value !== undefined ? !!(value & (1 << bitNo)) : undefined;

  useEmuStateListener(emuApi, async () => {
    setCpuState((await emuApi.getCpuState()) as Z80CpuState);
  });

  return (
    <SidePanel>
      <CenteredRow>
        <FlagLetter label="F" />
        <VerticalFlagValue label="S" value={toFlag(cpuState?.af, 7)} tooltip="Sign" />
        <VerticalFlagValue label="Z" value={toFlag(cpuState?.af, 6)} tooltip="Zero" />
        <VerticalFlagValue label="5" value={toFlag(cpuState?.af, 5)} tooltip="Bit 5" />
        <VerticalFlagValue label="H" value={toFlag(cpuState?.af, 4)} tooltip="Half Carry" />
        <VerticalFlagValue label="3" value={toFlag(cpuState?.af, 3)} tooltip="Bit 3" />
        <VerticalFlagValue label="P" value={toFlag(cpuState?.af, 2)} tooltip="Parity/Overflow" />
        <VerticalFlagValue label="N" value={toFlag(cpuState?.af, 1)} tooltip="Subtract" />
        <VerticalFlagValue label="C" value={toFlag(cpuState?.af, 0)} tooltip="Carry" />
      </CenteredRow>
      <Separator />
      <Col>
        <Bit16Value
          label="AF"
          reg16Label="AF"
          reg8HLabel="A"
          reg8LLabel="F"
          value={cpuState?.af}
          tooltip={REG16_TOOLTIP}
        />
        <Bit16Value
          label="AF'"
          reg16Label="AF'"
          value={cpuState?.af_}
          tooltip={REG16_ONLY_TOOLTIP}
        />
      </Col>
      <Col>
        <Bit16Value
          label="BC"
          reg16Label="BC"
          reg8HLabel="B"
          reg8LLabel="C"
          value={cpuState?.bc}
          tooltip={REG16_TOOLTIP}
        />
        <Bit16Value
          label="BC'"
          reg16Label="BC'"
          value={cpuState?.bc_}
          tooltip={REG16_ONLY_TOOLTIP}
        />
      </Col>
      <Col>
        <Bit16Value
          label="DE"
          reg16Label="DE"
          reg8HLabel="D"
          reg8LLabel="E"
          value={cpuState?.de}
          tooltip={REG16_TOOLTIP}
        />
        <Bit16Value
          label="DE'"
          reg16Label="DE'"
          value={cpuState?.de_}
          tooltip={REG16_ONLY_TOOLTIP}
        />
      </Col>
      <Col>
        <Bit16Value
          label="HL"
          reg16Label="HL"
          reg8HLabel="H"
          reg8LLabel="L"
          value={cpuState?.hl}
          tooltip={REG16_TOOLTIP}
        />
        <Bit16Value
          label="HL'"
          reg16Label="HL'"
          value={cpuState?.hl_}
          tooltip={REG16_ONLY_TOOLTIP}
        />
      </Col>
      <Col>
        <Bit16Value
          label="IX"
          reg16Label="IX"
          reg8HLabel="XH"
          reg8LLabel="XL"
          value={cpuState?.ix}
          tooltip={REG16_TOOLTIP}
        />
      </Col>
      <Col>
        <Bit16Value
          label="IY"
          reg16Label="IY"
          reg8HLabel="YH"
          reg8LLabel="YL"
          value={cpuState?.iy}
          tooltip={REG16_TOOLTIP}
        />
      </Col>
      <Col>
        <Bit16Value label="PC" reg16Label="PC" value={cpuState?.pc} tooltip={REG16_ONLY_TOOLTIP} />
      </Col>
      <Col>
        <Bit16Value label="SP" reg16Label="SP" value={cpuState?.sp} tooltip={REG16_ONLY_TOOLTIP} />
      </Col>
      <Col>
        <Bit8Value label="I" value={cpuState?.ir ? cpuState.ir >>> 8 : 0} tooltip={REG8_TOOLTIP} />
        <Bit8Value label="R" value={cpuState?.ir ? cpuState.ir & 0xff : 0} tooltip={REG8_TOOLTIP} />
      </Col>
      <Col>
        <Bit16Value
          label="WZ"
          reg16Label="WZ"
          reg8HLabel="WH"
          reg8LLabel="WL"
          value={cpuState?.wz}
          tooltip={REG16_TOOLTIP}
        />
      </Col>
      <Separator />
      <Col>
        <Bit8Value
          label="LMR"
          value={cpuState?.lastMemoryReadValue ?? 0}
          tooltip={"Last value read from memory:\n{r8v}"}
        />
        <Bit8Value
          label="LMW"
          value={cpuState?.lastMemoryWriteValue ?? 0}
          tooltip={"Last value written to memory:\n{r8v}"}
        />
      </Col>
      <Col>
        <Bit8Value
          label="IRV"
          value={cpuState?.lastIoReadValue ?? 0}
          tooltip={"Last value read from the I/O port:\n{r8v}"}
        />
        <Bit8Value
          label="IWV"
          value={cpuState?.lastIoWriteValue ?? 0}
          tooltip={"Last value written to the I/O port:\n{r8v}"}
        />
      </Col>
      <Separator />
      <Col>
        <SimpleValue label="IM" value={cpuState?.interruptMode ?? 0} tooltip="Interrupt Mode" />
        <FlagValue label="SNZ" value={cpuState?.snoozed} tooltip="Is the CPU snoozed?" />
      </Col>
      <Col>
        <FlagValue label="IF1" value={cpuState?.iff1} tooltip="Interrupt flip-flop #1" />
        <FlagValue label="IF2" value={cpuState?.iff2} tooltip="Interrupt flip-flop #2" />
      </Col>
      <Col>
        <FlagValue label="INT" value={cpuState?.sigINT} tooltip="Interrupt signal" />
        <FlagValue label="HLT" value={cpuState?.halted} tooltip="Halted" />
      </Col>
      <Col>
        <SimpleValue
          label="CLK"
          value={cpuState?.tacts ?? 0}
          tooltip="Current CPU clock"
          fullWidth
        />
      </Col>
      <Col>
        <SimpleValue
          label="TSP"
          value={(cpuState?.tacts ?? 0) - (cpuState?.tactsAtLastStart ?? 0)}
          tooltip="T-States since last start after pause"
          fullWidth
        />
      </Col>
    </SidePanel>
  );
};

export const z80CpuPanelRenderer = () => <CpuPanel />;
