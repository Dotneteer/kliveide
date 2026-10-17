import { Separator } from "@renderer/controls/layout/Separator";
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
} from "@renderer/controls/data/registers";
import { DataPanel, DataRow } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { HistoryCpuBanner } from "../debugger/history/HistoryBanner";
import { useT } from "@common/i18n/useT";

const hex4 = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");
const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

const REG16_TOOLTIP = "{r16N}: {r16v}\n{r8HN}: {r8Hv}\n{r8LN}: {r8Lv}";
const REG16_ONLY_TOOLTIP = "{r16N}: {r16v}";
const REG8_TOOLTIP = "{r8N}: {r8v}";

export const Z80CpuPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [cpuState, setCpuState] = useState<Z80CpuState>(null);
  // --- The live state, while the history cursor shows the past (for the "Now:" tooltips)
  const [present, setPresent] = useState<Z80CpuState>();

  const toFlag = (value: number | undefined, bitNo: number) =>
    value !== undefined ? !!(value & (1 << bitNo)) : undefined;

  useEmuStateListener(emuApi, async () => {
    const state = (await emuApi.getCpuState()) as Z80CpuState;
    setCpuState(state);
    setPresent(state?.history ? ((await emuApi.getCpuState({ present: true })) as Z80CpuState) : undefined);
  });

  // --- In the past (`.plans/LITE_STEP_BACK_PLAN.md` D7, Q2, T9): what the instruction just before
  // --- this point changed is marked, the present value is in the tooltip, and what a record does
  // --- not hold (the T-state counter, the last accesses) is unknown rather than the present's
  const history = cpuState?.history;
  const previous = history?.previousRegs;
  type Word = "af" | "bc" | "de" | "hl" | "af_" | "bc_" | "de_" | "hl_" | "ix" | "iy" | "pc" | "sp" | "wz";
  const changed = (key: Word) => !!previous && !!cpuState && previous[key] !== cpuState[key];
  const irChanged = (shift: 8 | 0) =>
    !!previous && !!cpuState && ((previous.ir >> shift) & 0xff) !== ((cpuState.ir >> shift) & 0xff);
  const now = (key: Word) =>
    present ? t("panels.side.cpu.nowValue", { value: `$${hex4(present[key])}` }) : undefined;
  const nowByte = (value: number | undefined) =>
    present && value !== undefined ? t("panels.side.cpu.nowValue", { value: `$${hex2(value)}` }) : undefined;
  const unknown = <T,>(value: T): T | undefined => (history ? undefined : value);

  return (
    <DataPanel autoHeight>
      {history && <HistoryCpuBanner info={history} />}
      <DataRow dense>
        <FlagLetter label="F" />
        <VerticalFlagValue
          label="S"
          value={toFlag(cpuState?.af, 7)}
          tooltip={t("panels.side.cpu.flag.sign")}
          iconFill="--color-state-value"
        />
        <VerticalFlagValue
          label="Z"
          value={toFlag(cpuState?.af, 6)}
          tooltip={t("panels.side.cpu.flag.zero")}
          iconFill="--color-state-value"
        />
        <VerticalFlagValue
          label="5"
          value={toFlag(cpuState?.af, 5)}
          tooltip={t("panels.side.cpu.flag.bit5")}
          iconFill="--color-state-value"
        />
        <VerticalFlagValue
          label="H"
          value={toFlag(cpuState?.af, 4)}
          tooltip={t("panels.side.cpu.flag.halfCarry")}
          iconFill="--color-state-value"
        />
        <VerticalFlagValue
          label="3"
          value={toFlag(cpuState?.af, 3)}
          tooltip={t("panels.side.cpu.flag.bit3")}
          iconFill="--color-state-value"
        />
        <VerticalFlagValue
          label="P"
          value={toFlag(cpuState?.af, 2)}
          tooltip={t("panels.side.cpu.flag.parityOverflow")}
          iconFill="--color-state-value"
        />
        <VerticalFlagValue
          label="N"
          value={toFlag(cpuState?.af, 1)}
          tooltip={t("panels.side.cpu.flag.subtract")}
          iconFill="--color-state-value"
        />
        <VerticalFlagValue
          label="C"
          value={toFlag(cpuState?.af, 0)}
          tooltip={t("panels.side.cpu.flag.carry")}
          iconFill="--color-state-value"
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <Bit16Value
          label="AF"
          reg16Label="AF"
          reg8HLabel="A"
          reg8LLabel="F"
          value={cpuState?.af}
          tooltip={REG16_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("af")}
          tooltipSuffix={now("af")}
        />
        <Bit16Value
          label="AF'"
          reg16Label="AF'"
          value={cpuState?.af_}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("af_")}
          tooltipSuffix={now("af_")}
        />
      </DataRow>
      <DataRow dense>
        <Bit16Value
          label="BC"
          reg16Label="BC"
          reg8HLabel="B"
          reg8LLabel="C"
          value={cpuState?.bc}
          tooltip={REG16_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("bc")}
          tooltipSuffix={now("bc")}
        />
        <Bit16Value
          label="BC'"
          reg16Label="BC'"
          value={cpuState?.bc_}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("bc_")}
          tooltipSuffix={now("bc_")}
        />
      </DataRow>
      <DataRow dense>
        <Bit16Value
          label="DE"
          reg16Label="DE"
          reg8HLabel="D"
          reg8LLabel="E"
          value={cpuState?.de}
          tooltip={REG16_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("de")}
          tooltipSuffix={now("de")}
        />
        <Bit16Value
          label="DE'"
          reg16Label="DE'"
          value={cpuState?.de_}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("de_")}
          tooltipSuffix={now("de_")}
        />
      </DataRow>
      <DataRow dense>
        <Bit16Value
          label="HL"
          reg16Label="HL"
          reg8HLabel="H"
          reg8LLabel="L"
          value={cpuState?.hl}
          tooltip={REG16_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("hl")}
          tooltipSuffix={now("hl")}
        />
        <Bit16Value
          label="HL'"
          reg16Label="HL'"
          value={cpuState?.hl_}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("hl_")}
          tooltipSuffix={now("hl_")}
        />
      </DataRow>
      <DataRow dense>
        <Bit16Value
          label="IX"
          reg16Label="IX"
          reg8HLabel="XH"
          reg8LLabel="XL"
          value={cpuState?.ix}
          tooltip={REG16_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("ix")}
          tooltipSuffix={now("ix")}
        />
      </DataRow>
      <DataRow dense>
        <Bit16Value
          label="IY"
          reg16Label="IY"
          reg8HLabel="YH"
          reg8LLabel="YL"
          value={cpuState?.iy}
          tooltip={REG16_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("iy")}
          tooltipSuffix={now("iy")}
        />
      </DataRow>
      <DataRow dense>
        <Bit16Value
          label="PC"
          reg16Label="PC"
          value={cpuState?.pc}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("pc")}
          tooltipSuffix={now("pc")}
        />
      </DataRow>
      <DataRow dense>
        <Bit16Value
          label="SP"
          reg16Label="SP"
          value={cpuState?.sp}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("sp")}
          tooltipSuffix={now("sp")}
        />
      </DataRow>
      <DataRow dense>
        <Bit8Value
          label="I"
          value={cpuState?.ir ? cpuState.ir >>> 8 : 0}
          tooltip={REG8_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={irChanged(8)}
          tooltipSuffix={nowByte(present ? present.ir >>> 8 : undefined)}
        />
        <Bit8Value
          label="R"
          value={cpuState?.ir ? cpuState.ir & 0xff : 0}
          tooltip={REG8_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={irChanged(0)}
          tooltipSuffix={nowByte(present ? present.ir & 0xff : undefined)}
        />
      </DataRow>
      <DataRow dense>
        <Bit16Value
          label="WZ"
          reg16Label="WZ"
          reg8HLabel="WH"
          reg8LLabel="WL"
          value={cpuState?.wz}
          tooltip={REG16_TOOLTIP}
          valueXclass={regStyles.stateValue}
          changed={changed("wz")}
          tooltipSuffix={now("wz")}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <Bit8Value
          label="LMR"
          value={unknown(cpuState?.lastMemoryReadValue ?? 0)}
          tooltip={t("panels.side.cpu.lastMemoryRead", { value: "{r8v}" })}
          valueXclass={regStyles.stateValue}
        />
        <Bit8Value
          label="LMW"
          value={unknown(cpuState?.lastMemoryWriteValue ?? 0)}
          tooltip={t("panels.side.cpu.lastMemoryWrite", { value: "{r8v}" })}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <Bit8Value
          label="IRV"
          value={unknown(cpuState?.lastIoReadValue ?? 0)}
          tooltip={t("panels.side.cpu.lastIoRead", { value: "{r8v}" })}
          valueXclass={regStyles.stateValue}
        />
        <Bit8Value
          label="IWV"
          value={unknown(cpuState?.lastIoWriteValue ?? 0)}
          tooltip={t("panels.side.cpu.lastIoWrite", { value: "{r8v}" })}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="IM"
          value={cpuState?.interruptMode ?? 0}
          tooltip={t("panels.side.cpu.interruptMode")}
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SNZ"
          value={unknown(cpuState?.snoozed)}
          tooltip={t("panels.side.cpu.snoozed")}
          iconFill="--color-state-value"
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="IF1"
          value={cpuState?.iff1}
          tooltip={t("panels.side.cpu.iff1")}
          iconFill="--color-state-value"
        />
        <FlagValue
          label="IF2"
          value={cpuState?.iff2}
          tooltip={t("panels.side.cpu.iff2")}
          iconFill="--color-state-value"
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="INT"
          value={cpuState?.sigINT}
          tooltip={t("panels.side.cpu.interruptSignal")}
          iconFill="--color-state-value"
        />
        <FlagValue
          label="HLT"
          value={cpuState?.halted}
          tooltip={t("panels.side.cpu.halted")}
          iconFill="--color-state-value"
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="CLK"
          value={unknown(cpuState?.tacts ?? 0)}
          tooltip={t("panels.side.cpu.clock")}
          fullWidth
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="TSP"
          value={unknown((cpuState?.tacts ?? 0) - (cpuState?.tactsAtLastStart ?? 0))}
          tooltip={t("panels.side.cpu.tStatesSinceStart")}
          fullWidth
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
    </DataPanel>
  );
};

