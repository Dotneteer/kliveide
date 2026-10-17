import { SmallIconButton } from "@renderer/controls/IconButton";
import { AddressInput } from "@renderer/controls/AddressInput";
import Dropdown from "@renderer/controls/Dropdown";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Text } from "@renderer/controls/layout/Text";
import { DumpViewMode, viewModeOptions } from "./memoryViewModel";
import type { HeatMode } from "@renderer/features/coverage/heatModel";
import { useT } from "@common/i18n/useT";
import { withLabels } from "@common/i18n/labels";

/** The Heat selector's choices (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D14) */
export const heatModeOptions = withLabels([
  { value: "off", labelKey: "panels.feature.memory.heat.off" },
  { value: "exec", labelKey: "panels.feature.memory.heat.executed" },
  { value: "read", labelKey: "panels.feature.memory.heat.read" },
  { value: "write", labelKey: "panels.feature.memory.heat.written" },
  { value: "all", labelKey: "panels.feature.memory.heat.all" }
] as const);

type MemoryToolbarProps = {
  bankLabel: boolean;
  banksView: boolean;
  charDump: boolean;
  decimalView: boolean;
  viewMode: DumpViewMode;
  /** The heat map's mode; the selector shows only on a machine that profiles (`MF_PROFILE`) */
  heatMode?: HeatMode;
  onHeatModeChanged?: (mode: HeatMode) => void;
  onBankLabelChanged: (value: boolean) => void;
  onCharDumpChanged: (value: boolean) => void;
  onDecimalViewChanged: (value: boolean) => void;
  onGoToAddress: (address: number) => void;
  onRefreshPauseChanged: (paused: boolean) => void;
  onViewModeChanged: (viewMode: DumpViewMode) => void;
  /** Opens the graphics finder at the top of the view (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.3). */
  onShowAsGraphics?: () => void;
};

export const MemoryToolbar = ({
  bankLabel,
  banksView,
  charDump,
  decimalView,
  viewMode,
  heatMode,
  onHeatModeChanged,
  onBankLabelChanged,
  onCharDumpChanged,
  onDecimalViewChanged,
  onGoToAddress,
  onRefreshPauseChanged,
  onViewModeChanged,
  onShowAsGraphics
}: MemoryToolbarProps) => {
  const t = useT();
  return (
    <>
      <LabeledSwitch
        value={decimalView}
        label={t("panels.feature.memory.decimal")}
        title={t("panels.feature.memory.decimalTooltip")}
        clicked={onDecimalViewChanged}
      />
      <LabelSeparator width={8} />
      <Text text={t("panels.feature.memory.view")} />
      <LabelSeparator />
      <Dropdown
        options={viewModeOptions()}
        initialValue={viewMode}
        width={90}
        onOpenChange={(open) => onRefreshPauseChanged(open)}
        onChanged={(val) => onViewModeChanged(val as DumpViewMode)}
      />
      <LabelSeparator width={8} />
      <LabeledSwitch
        value={charDump}
        label={t("panels.feature.memory.chars")}
        title={t("panels.feature.memory.charsTooltip")}
        clicked={onCharDumpChanged}
      />
      {banksView && (
        <>
          <LabelSeparator width={8} />
          <LabeledSwitch
            value={bankLabel}
            label={t("panels.feature.memory.bank")}
            title={t("panels.feature.memory.bankTooltip")}
            clicked={onBankLabelChanged}
          />
        </>
      )}
      {heatMode !== undefined && (
        <>
          <LabelSeparator width={8} />
          <Text text={t("panels.feature.memory.heat")} />
          <LabelSeparator />
          <Dropdown
            ariaLabel={t("panels.feature.memory.heatMap")}
            options={heatModeOptions}
            initialValue={heatMode}
            width={90}
            onOpenChange={(open) => onRefreshPauseChanged(open)}
            onChanged={(val) => onHeatModeChanged?.(val as HeatMode)}
          />
        </>
      )}
      <LabelSeparator width={8} />
      <AddressInput
        label={t("panels.feature.memory.goTo")}
        clearOnEnter={true}
        decimalView={decimalView}
        onGotFocus={() => onRefreshPauseChanged(true)}
        onAddressSent={async (address) => {
          onGoToAddress(address);
          onRefreshPauseChanged(false);
        }}
      />
      {onShowAsGraphics && (
        <>
          <LabelSeparator width={8} />
          <SmallIconButton iconName="sprite" title={t("panels.feature.memory.showAsGraphics")} clicked={onShowAsGraphics} />
        </>
      )}
    </>
  );
};
