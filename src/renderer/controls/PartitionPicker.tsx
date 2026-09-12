import type { DropdownOption } from "./Dropdown";
import type { PartitionOption } from "@renderer/features/memory/memoryViewModel";

import BankDropdown from "./new/BankDropdown";
import Dropdown from "./Dropdown";

export type PartitionPickerProps = {
  /** The selected partition index. ZX Next indexes ROM and DivMMC pages negatively. */
  value?: number;
  onChange: (value: number) => void;
  /** True when the machine has more banks than a list can sensibly hold. */
  displayBankMatrix: boolean;
  /** The list form's options. Empty whenever `displayBankMatrix` is set. */
  segmentOptions: DropdownOption[];
  /** Every partition, for the matrix form. */
  partitionOptions?: PartitionOption[];
  decimalView?: boolean;
  width?: string | number;
};

/**
 * Choose a memory partition.
 *
 * Which control this is depends on the machine, because the shape of the answer does. A 128K
 * Spectrum has a handful of ROMs and banks, and a list names them. A ZX Next has 247 partitions —
 * seven ROM pages, sixteen DivMMC pages and 224 RAM banks — and a list of 247 rows is not a
 * chooser, it is a haystack. There `BankDropdown` opens a grid with the special pages above it.
 *
 * Both forms are driven by the machine's own partition maps, so neither can name a partition
 * something the rest of the IDE would not recognise. It no longer branches on the machine id: what
 * used to be a Z88 case and a ZX Next case were the same control differing only in the data they
 * were handed, which is now passed in.
 */
export const PartitionPicker = ({
  value,
  onChange,
  displayBankMatrix,
  segmentOptions,
  partitionOptions,
  decimalView,
  width
}: PartitionPickerProps) => {
  if (displayBankMatrix && partitionOptions?.length) {
    return (
      <BankDropdown
        options={partitionOptions}
        value={value}
        width={width ?? 80}
        decimalView={decimalView}
        onChanged={onChange}
      />
    );
  }

  // --- The list form, and the fallback for a machine that wants the matrix but whose partitions
  // --- have not loaded yet: some picker beats none.
  return (
    <Dropdown
      options={segmentOptions}
      initialValue={value?.toString()}
      width={width ?? 80}
      onChanged={(opt) => onChange(parseInt(opt))}
    />
  );
};
