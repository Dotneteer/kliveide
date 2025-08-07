import { Separator } from "@controls/Labels";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { M6510CpuState } from "@common/messaging/EmuApi";
import {
  Bit16Value,
  Bit8Value,
  FlagLetter,
  FlagValue,
  SimpleValue,
  VerticalFlagValue
} from "@renderer/controls/valuedisplay/Values";
import { CenteredRow, Col, SidePanel } from "@renderer/controls/valuedisplay/Layout";

const REG16_ONLY_TOOLTIP = "{r16N}: {r16v}";
const REG8_TOOLTIP = "{r8N}: {r8v}";

const CpuPanel = () => {
  const emuApi = useEmuApi();
  const [cpuState, setCpuState] = useState<M6510CpuState>(null);

  const toFlag = (value: number | undefined, bitNo: number) =>
    value !== undefined ? !!(value & (1 << bitNo)) : undefined;

  useEmuStateListener(emuApi, async () => {
    setCpuState((await emuApi.getCpuState()) as M6510CpuState);
  });

  return (
    <SidePanel>
      <CenteredRow>
        <FlagLetter label="P" />
        <VerticalFlagValue label="N" value={toFlag(cpuState?.p, 7)} tooltip="Negative" />
        <VerticalFlagValue label="V" value={toFlag(cpuState?.p, 6)} tooltip="Overflow" />
        <VerticalFlagValue label="-" value={toFlag(cpuState?.p, 5)} tooltip="Unused (always set)" />
        <VerticalFlagValue label="B" value={toFlag(cpuState?.p, 4)} tooltip="Break" />
        <VerticalFlagValue label="D" value={toFlag(cpuState?.p, 3)} tooltip="Decimal mode" />
        <VerticalFlagValue label="I" value={toFlag(cpuState?.p, 2)} tooltip="Interrupt mask" />
        <VerticalFlagValue label="Z" value={toFlag(cpuState?.p, 1)} tooltip="Zero" />
        <VerticalFlagValue label="C" value={toFlag(cpuState?.p, 0)} tooltip="Carry" />
      </CenteredRow>
      <Separator />
      <Col>
        <Bit8Value label="A" value={cpuState?.a} tooltip={REG8_TOOLTIP} />
        <Bit8Value label="SP" value={cpuState?.sp} tooltip={REG8_TOOLTIP} />
      </Col>
      <Col>
        <Bit8Value label="X" value={cpuState?.x} tooltip={REG8_TOOLTIP} />
        <Bit8Value label="Y" value={cpuState?.y} tooltip={REG8_TOOLTIP} />
      </Col>
      <Col>
        <Bit16Value label="PC" reg16Label="PC" value={cpuState?.pc} tooltip={REG16_ONLY_TOOLTIP} />
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
      <Separator />
      <Col>
        <FlagValue label="IRQ" value={cpuState?.irqRequested} tooltip="IRQ requested" />
        <FlagValue label="NMI" value={cpuState?.nmiRequested} tooltip="NMI requested" />
      </Col>
      <Col>
        <FlagValue label="STL" value={cpuState?.stalled} tooltip="CPU stalled" />
        <FlagValue label="JAM" value={cpuState?.jammed} tooltip="CPU jammed" />
      </Col>
      <Separator />
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

export const m6510CpuPanelRenderer = () => <CpuPanel />;
