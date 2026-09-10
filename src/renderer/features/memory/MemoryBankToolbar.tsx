import { PartitionPicker } from "@renderer/controls/PartitionPicker";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Text } from "@renderer/controls/layout/Text";
import { MemoryMachineSetupState } from "./useMemoryMachineSetup";

type MemoryBankToolbarProps = {
  currentSegment: number;
  decimalView: boolean;
  isFullView: boolean;
  machineSetup: MemoryMachineSetupState;
  onFullViewChanged: (value: boolean) => void;
  onSegmentChanged: (segment: number) => void;
};

export const MemoryBankToolbar = ({
  currentSegment,
  decimalView,
  isFullView,
  machineSetup,
  onFullViewChanged,
  onSegmentChanged
}: MemoryBankToolbarProps) => {
  if (!machineSetup.banksView) {
    return null;
  }

  return (
    <>
      <LabeledSwitch
        value={isFullView}
        label="64K View"
        title="Show the full 64K memory"
        clicked={onFullViewChanged}
      />
      {!isFullView && (
        <>
          <LabelSeparator />
          <Text text="Selected bank" />
          <LabelSeparator />
          {/*
            * The three-way branch this used to spell out inline now lives in `PartitionPicker`,
            * which the breakpoint dialog uses too — one machine, one chooser, wherever it appears.
            */}
          <PartitionPicker
            value={currentSegment}
            onChange={onSegmentChanged}
            displayBankMatrix={machineSetup.displayBankMatrix}
            segmentOptions={machineSetup.segmentOptions}
            partitionOptions={machineSetup.partitionOptions}
            decimalView={decimalView}
          />
        </>
      )}
    </>
  );
};
