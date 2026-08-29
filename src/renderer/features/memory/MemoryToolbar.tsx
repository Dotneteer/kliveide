import { AddressInput } from "@renderer/controls/AddressInput";
import Dropdown from "@renderer/controls/Dropdown";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Text } from "@renderer/controls/layout/Text";
import { DumpViewMode, viewModeOptions } from "./memoryViewModel";

type MemoryToolbarProps = {
  bankLabel: boolean;
  banksView: boolean;
  charDump: boolean;
  decimalView: boolean;
  viewMode: DumpViewMode;
  onBankLabelChanged: (value: boolean) => void;
  onCharDumpChanged: (value: boolean) => void;
  onDecimalViewChanged: (value: boolean) => void;
  onGoToAddress: (address: number) => void;
  onRefreshPauseChanged: (paused: boolean) => void;
  onViewModeChanged: (viewMode: DumpViewMode) => void;
};

export const MemoryToolbar = ({
  bankLabel,
  banksView,
  charDump,
  decimalView,
  viewMode,
  onBankLabelChanged,
  onCharDumpChanged,
  onDecimalViewChanged,
  onGoToAddress,
  onRefreshPauseChanged,
  onViewModeChanged
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
    </>
  );
};
