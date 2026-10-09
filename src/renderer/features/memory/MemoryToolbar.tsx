import { SmallIconButton } from "@renderer/controls/IconButton";
import { AddressInput } from "@renderer/controls/AddressInput";
import Dropdown from "@renderer/controls/Dropdown";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Text } from "@renderer/controls/layout/Text";
import { DumpViewMode, viewModeOptions } from "./memoryViewModel";
import type { HeatMode } from "@renderer/features/coverage/heatModel";

/** The Heat selector's choices (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D14) */
export const heatModeOptions = [
  { value: "off", label: "Off" },
  { value: "exec", label: "Executed" },
  { value: "read", label: "Read" },
  { value: "write", label: "Written" },
  { value: "all", label: "All" }
];

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
  return (
    <>
      <LabeledSwitch
        value={decimalView}
        label="Decimal"
        title="Use decimal numbers?"
        clicked={onDecimalViewChanged}
      />
      <LabelSeparator width={8} />
      <Text text="View" />
      <LabelSeparator />
      <Dropdown
        options={viewModeOptions}
        initialValue={viewMode}
        width={90}
        onOpenChange={(open) => onRefreshPauseChanged(open)}
        onChanged={(val) => onViewModeChanged(val as DumpViewMode)}
      />
      <LabelSeparator width={8} />
      <LabeledSwitch
        value={charDump}
        label="Chars"
        title="Show characters dump?"
        clicked={onCharDumpChanged}
      />
      {banksView && (
        <>
          <LabelSeparator width={8} />
          <LabeledSwitch
            value={bankLabel}
            label="Bank"
            title="Display bank label information?"
            clicked={onBankLabelChanged}
          />
        </>
      )}
      {heatMode !== undefined && (
        <>
          <LabelSeparator width={8} />
          <Text text="Heat" />
          <LabelSeparator />
          <Dropdown
            ariaLabel="Heat map"
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
        label="Go To"
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
          <SmallIconButton iconName="sprite" title="Show as graphics" clicked={onShowAsGraphics} />
        </>
      )}
    </>
  );
};
