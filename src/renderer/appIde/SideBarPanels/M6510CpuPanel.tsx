import { Separator } from "@renderer/controls/layout/Separator";
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
} from "@renderer/controls/data/registers";
import { DataPanel, DataRow } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { useT } from "@common/i18n/useT";

/*
 * The C64 CPU panel takes the same colouring as the Z80 one (Phase 18).
 *
 * It was structurally converted in Phase 6 and chromatically not, so a C64 user saw a grey debug
 * sidebar where a Spectrum user saw an accented one, for no reason either could perceive. The
 * split follows §10.3: the payload takes `--color-state-value`, labels stay on `--data-label`.
 */
const VALUE_FILL = "--color-state-value";

const REG16_ONLY_TOOLTIP = "{r16N}: {r16v}";
const REG8_TOOLTIP = "{r8N}: {r8v}";

export const M6510CpuPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [cpuState, setCpuState] = useState<M6510CpuState>(null);

  const toFlag = (value: number | undefined, bitNo: number) =>
    value !== undefined ? !!(value & (1 << bitNo)) : undefined;

  useEmuStateListener(emuApi, async () => {
    setCpuState((await emuApi.getCpuState()) as M6510CpuState);
  });

  return (
    <DataPanel autoHeight>
      <DataRow dense>
        <FlagLetter label="P" />
        <VerticalFlagValue
          label="N"
          value={toFlag(cpuState?.p, 7)}
          tooltip={t("panels.side.cpu.flag.negative")}
          iconFill={VALUE_FILL}
        />
        <VerticalFlagValue
          label="V"
          value={toFlag(cpuState?.p, 6)}
          tooltip={t("panels.side.cpu.flag.overflow")}
          iconFill={VALUE_FILL}
        />
        <VerticalFlagValue
          label="-"
          value={toFlag(cpuState?.p, 5)}
          tooltip={t("panels.side.cpu.flag.unusedSet")}
          iconFill={VALUE_FILL}
        />
        <VerticalFlagValue
          label="B"
          value={toFlag(cpuState?.p, 4)}
          tooltip={t("panels.side.cpu.flag.break")}
          iconFill={VALUE_FILL}
        />
        <VerticalFlagValue
          label="D"
          value={toFlag(cpuState?.p, 3)}
          tooltip={t("panels.side.cpu.flag.decimal")}
          iconFill={VALUE_FILL}
        />
        <VerticalFlagValue
          label="I"
          value={toFlag(cpuState?.p, 2)}
          tooltip={t("panels.side.cpu.flag.interruptMask")}
          iconFill={VALUE_FILL}
        />
        <VerticalFlagValue
          label="Z"
          value={toFlag(cpuState?.p, 1)}
          tooltip={t("panels.side.cpu.flag.zero")}
          iconFill={VALUE_FILL}
        />
        <VerticalFlagValue
          label="C"
          value={toFlag(cpuState?.p, 0)}
          tooltip={t("panels.side.cpu.flag.carry")}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <Bit8Value
          label="A"
          value={cpuState?.a}
          tooltip={REG8_TOOLTIP}
          valueXclass={regStyles.stateValue}
        />
        <Bit8Value
          label="SP"
          value={cpuState?.sp}
          tooltip={REG8_TOOLTIP}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <Bit8Value
          label="X"
          value={cpuState?.x}
          tooltip={REG8_TOOLTIP}
          valueXclass={regStyles.stateValue}
        />
        <Bit8Value
          label="Y"
          value={cpuState?.y}
          tooltip={REG8_TOOLTIP}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <Bit16Value
          label="PC"
          reg16Label="PC"
          value={cpuState?.pc}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <Bit8Value
          label="LMR"
          value={cpuState?.lastMemoryReadValue ?? 0}
          tooltip={t("panels.side.cpu.lastMemoryRead", { value: "{r8v}" })}
          valueXclass={regStyles.stateValue}
        />
        <Bit8Value
          label="LMW"
          value={cpuState?.lastMemoryWriteValue ?? 0}
          tooltip={t("panels.side.cpu.lastMemoryWrite", { value: "{r8v}" })}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <FlagValue
          label="IRQ"
          value={cpuState?.irqRequested}
          tooltip={t("panels.side.cpu.irqRequested")}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="NMI"
          value={cpuState?.nmiRequested}
          tooltip={t("panels.side.cpu.nmiRequested")}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="STL"
          value={cpuState?.stalled}
          tooltip={t("panels.side.cpu.stalled")}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="JAM"
          value={cpuState?.jammed}
          tooltip={t("panels.side.cpu.jammed")}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="CLK"
          value={cpuState?.tacts ?? 0}
          tooltip={t("panels.side.cpu.clock")}
          fullWidth
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="TSP"
          value={(cpuState?.tacts ?? 0) - (cpuState?.tactsAtLastStart ?? 0)}
          tooltip={t("panels.side.cpu.tStatesSinceStart")}
          fullWidth
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
    </DataPanel>
  );
};
