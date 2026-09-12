import { Fragment, useMemo, useState } from "react";
import * as Select from "@radix-ui/react-select";
import classnames from "classnames";

import styles from "./BankDropdown.module.scss";
import { Icon } from "../Icon";
import { useOverlayRoot } from "@renderer/controls/overlay/useOverlayRoot";
import { toDecimal3 } from "@renderer/appIde/services/ide-commands";
import {
  toCaptionedBlocks,
  type PartitionOption
} from "@renderer/features/memory/memoryViewModel";

/** Bank cells per row, matching the 16-wide hex grid this control has always drawn. */
const BANKS_PER_ROW = 16;

type Props = {
  /** Every partition the machine has, from `derivePartitionOptions`. */
  options: PartitionOption[];
  value?: number;
  width?: string | number;
  maxHeight?: string | number;
  decimalView?: boolean;
  onChanged?: (value: number) => void;
};

/** Chunk a list into rows of at most `size`, so arrow keys have a grid to move over. */
function toRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/**
 * A partition chooser for a machine with more banks than a list can hold.
 *
 * Everything it shows comes from the machine's own partition maps. It used to hardcode its chips —
 * `NROM0`, `ALTR0`, `DivMR` and the literal indices they stood for — which meant it named ZX Next
 * partitions in a vocabulary no other view and no command shared. Now the *label* is the identity
 * (`R0`, `X0`, `DM`, `M3`, `7A`) and the description explains it, so what you pick here is what the
 * breakpoints panel, the bank column and `bp-set` all call the same thing.
 *
 * Arrow-key movement is derived from the rows below. It replaces a 60-entry hand-written table of
 * literal indices that only described one machine's layout.
 */
export default function BankDropdown({
  options,
  value,
  width,
  maxHeight,
  decimalView,
  onChanged
}: Props) {
  const rootElement = useOverlayRoot();

  const { specialBlocks, bankOptions, bankRows, ordered } = useMemo(() => {
    const special = options.filter((o) => o.group === "special");
    const banks = options.filter((o) => o.group === "bank");
    return {
      // --- One row per captioned block, so "DivMMC RAM" is printed once above `M0`..`MF` rather
      // --- than spelled out on each of the sixteen chips.
      specialBlocks: toCaptionedBlocks(special),
      bankOptions: banks,
      // --- The same banks chunked the way the grid wraps them, which is the model arrow keys move
      // --- over. Layout and navigation have to agree on where the rows are.
      bankRows: toRows(banks, BANKS_PER_ROW),
      ordered: [...special, ...banks]
    };
  }, [options]);

  const rows = useMemo(
    () => [...specialBlocks.map((block) => block.options), ...bankRows],
    [specialBlocks, bankRows]
  );

  // --- The chip the keyboard is on, which is not necessarily the committed value.
  const [pointedIndex, setPointedIndex] = useState<number | undefined>(value);

  const selected = ordered.find((o) => o.index === value);

  const cellText = (option: PartitionOption) =>
    decimalView && option.group === "bank" ? toDecimal3(option.index) : option.label;

  const commit = (index: number) => {
    setPointedIndex(index);
    onChanged?.(index);
  };

  /** Where the pointed option sits in the grid, or the first cell when nothing is pointed. */
  const locate = (): [number, number] => {
    for (let row = 0; row < rows.length; row++) {
      const column = rows[row].findIndex((o) => o.index === pointedIndex);
      if (column >= 0) return [row, column];
    }
    return [0, 0];
  };

  const moveTo = (row: number, column: number) => {
    const target = rows[(row + rows.length) % rows.length];
    if (!target?.length) return;
    // --- Clamp rather than wrap across rows of different widths: a 4-wide chip row above a
    // --- 16-wide bank grid would otherwise send the cursor somewhere unrelated.
    setPointedIndex(target[Math.min(column, target.length - 1)].index);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!rows.length) return;
    const [row, column] = locate();

    switch (event.key) {
      case "ArrowRight": {
        event.preventDefault();
        const flat = ordered.findIndex((o) => o.index === pointedIndex);
        setPointedIndex(ordered[(flat + 1) % ordered.length].index);
        break;
      }
      case "ArrowLeft": {
        event.preventDefault();
        const flat = ordered.findIndex((o) => o.index === pointedIndex);
        setPointedIndex(ordered[(flat - 1 + ordered.length) % ordered.length].index);
        break;
      }
      case "ArrowDown":
        event.preventDefault();
        moveTo(row + 1, column);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveTo(row - 1, column);
        break;
      case "Enter":
        event.preventDefault();
        if (pointedIndex !== undefined) commit(pointedIndex);
        break;
    }
  };

  /**
   * One chip. It shows the label only — the block's caption carries the noun, and the full
   * description is on hover, so `M11` does not have to read "DivMMC RAM 11" to be identifiable.
   */
  const renderCell = (option: PartitionOption, extraClass?: string) => (
    <Select.Item
      key={option.index}
      value={option.index.toString()}
      title={option.description}
      className={classnames(styles.SelectItem, extraClass, {
        [styles.selected]: option.index === pointedIndex
      })}
      onMouseEnter={() => setPointedIndex(option.index)}
    >
      <Select.ItemText>{cellText(option)}</Select.ItemText>
    </Select.Item>
  );

  return (
    <Select.Root
      value={selected ? selected.index.toString() : undefined}
      onValueChange={(v) => commit(parseInt(v, 10))}
    >
      <Select.Trigger className={styles.SelectTrigger} style={{ width }}>
        <Select.Value placeholder="..." />
        <div style={{ width: "100%" }} />
        <Select.Icon>
          <Icon iconName="chevron-down" fill="--color-command-icon" width={16} height={16} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal container={rootElement}>
        <Select.Content
          className={styles.SelectContent}
          position="popper"
          sideOffset={4}
          style={{ maxHeight }}
        >
          {/*
            * One grid for everything, rather than a flex row per block.
            *
            * A caption column of `max-content` sizes itself to the longest caption, so "DivMMC RAM"
            * cannot run into the chips beside it; the sixteen cell columns are shared by every row,
            * so `M3` sits exactly above bank `03`. Nothing here is a hand-tuned pixel width, which
            * is what the previous flex layout depended on and got wrong.
            */}
          <Select.Viewport className={styles.grid} onKeyDown={handleKeyDown}>
            {specialBlocks.map((block, blockIndex) => (
              <Fragment key={`special-${blockIndex}`}>
                {/* --- Explicitly in column 1, which is what starts each block on a fresh row. */}
                <span className={styles.caption}>{block.caption}</span>
                {block.options.map((option) => renderCell(option))}
              </Fragment>
            ))}
            {specialBlocks.length > 0 && bankOptions.length > 0 && (
              <Select.Separator className={styles.SelectSeparator} />
            )}
            {/*
              * The bank grid's caption goes beside its first row rather than above it, so naming
              * 224 banks costs no extra height. Rows below leave column 1 empty on their own,
              * because each is placed into column 2 explicitly.
              */}
            {bankOptions[0]?.caption && (
              <span className={styles.caption}>{bankOptions[0].caption}</span>
            )}
            {bankOptions.map((option, index) =>
              /*
               * Every row's first cell is placed into column 2, not just the first row's.
               *
               * The grid is 17 columns wide — caption plus sixteen cells — so auto-flow would put
               * each row's seventeenth item back in the *caption* column, and every bank row after
               * the first would slide one cell left. Placing each row's opener explicitly is what
               * keeps `M3` above bank `03` all the way down.
               */
              renderCell(option, index % BANKS_PER_ROW === 0 ? styles.bankRowStart : undefined)
            )}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
