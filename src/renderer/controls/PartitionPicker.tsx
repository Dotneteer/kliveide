import type { DropdownOption } from "./Dropdown";

import { MI_Z88, MI_ZXNEXT } from "@common/machines/constants";
import BankDropdown from "./new/BankDropdown";
import Dropdown from "./Dropdown";

export type PartitionPickerProps = {
  /** The selected partition index. ZX Next indexes ROM and DivMMC pages negatively. */
  value?: number;
  onChange: (value: number) => void;
  /** Which machine is running — the matrix layouts differ between Z88 and ZX Next. */
  machineId?: string;
  /** True when the machine has more banks than a list can sensibly hold. */
  displayBankMatrix: boolean;
  /** The list form's options. Empty whenever `displayBankMatrix` is set. */
  segmentOptions: DropdownOption[];
  decimalView?: boolean;
  width?: string | number;
};

/**
 * Choose a memory partition.
 *
 * Which control this is depends on the machine, because the shape of the answer does. A 128K
 * Spectrum has a handful of ROMs and banks, and a list names them. A ZX Next has 247 partitions —
 * seven ROM pages, sixteen DivMMC pages and 224 RAM banks — and a list of 247 rows is not a
 * chooser, it is a haystack. There `BankDropdown` opens a 16-wide grid with the special pages
 * grouped above it, so any bank is one or two glances away.
 *
 * Extracted from `MemoryBankToolbar`, which had this three-way branch inline, so the memory view
 * and the breakpoint dialog cannot end up offering different pickers for the same machine.
 */
export const PartitionPicker = ({
  value,
  onChange,
  machineId,
  displayBankMatrix,
  segmentOptions,
  decimalView,
  width
}: PartitionPickerProps) => {
  if (!displayBankMatrix) {
    return (
      <Dropdown
        options={segmentOptions}
        initialValue={value?.toString()}
        width={width ?? 80}
        onChanged={(opt) => onChange(parseInt(opt))}
      />
    );
  }

  if (machineId === MI_Z88) {
    return (
      <BankDropdown
        initialValue={value ?? 0}
        width={width ?? 48}
        decimalView={decimalView}
        onChanged={onChange}
      />
    );
  }

  if (machineId === MI_ZXNEXT) {
    return (
      <BankDropdown
        banks={224}
        showNextItems
        initialValue={value ?? 0}
        width={width ?? 80}
        decimalView={decimalView}
        onChanged={onChange}
      />
    );
  }

  // --- A machine that wants the matrix but is neither of the two that have one. Falling back to
  // --- the list keeps *some* picker on screen rather than none.
  return (
    <Dropdown
      options={segmentOptions}
      initialValue={value?.toString()}
      width={width ?? 80}
      onChanged={(opt) => onChange(parseInt(opt))}
    />
  );
};
