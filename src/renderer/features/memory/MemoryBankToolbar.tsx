import { MI_Z88, MI_ZXNEXT } from "@common/machines/constants";
import BankDropdown from "@renderer/controls/new/BankDropdown";
import Dropdown from "@renderer/controls/Dropdown";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Text } from "@renderer/controls/layout/Text";
import { MemoryMachineSetupState } from "./useMemoryMachineSetup";

type MemoryBankToolbarProps = {
  currentSegment: number;
  decimalView: boolean;
  isFullView: boolean;
  machineId: string | undefined;
  machineSetup: MemoryMachineSetupState;
  onFullViewChanged: (value: boolean) => void;
  onSegmentChanged: (segment: number) => void;
};

export const MemoryBankToolbar = ({
  currentSegment,
  decimalView,
  isFullView,
  machineId,
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
          {!machineSetup.displayBankMatrix && (
            <Dropdown
              options={machineSetup.segmentOptions}
              initialValue={currentSegment?.toString()}
              width={80}
              onChanged={(opt) => onSegmentChanged(parseInt(opt))}
            />
          )}
          {machineSetup.displayBankMatrix && machineId === MI_Z88 && (
            <BankDropdown
              initialValue={currentSegment ?? 0}
              width={48}
              decimalView={decimalView}
              onChanged={onSegmentChanged}
            />
          )}
          {machineSetup.displayBankMatrix && machineId === MI_ZXNEXT && (
            <BankDropdown
              banks={224}
              showNextItems
              initialValue={currentSegment ?? 0}
              width={80}
              decimalView={decimalView}
              onChanged={onSegmentChanged}
            />
          )}
        </>
      )}
    </>
  );
};
