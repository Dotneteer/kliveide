import { IListable, IListItem } from "../controls/VirtualizedList";
import { LiteEvent } from "../utils";
import { intToX4, intToX2 } from "../../disassembler/disassembly-helper";

export interface DisassemblyItem {
  caption: string;
}

export class DisassemblyItemList implements IListable<DisassemblyItem> {
  private _items: DisassemblyItem[];
  private _itemsChanged = new LiteEvent<void>();

  /**
   * Creates a list of demo items
   */
  constructor(items?: DisassemblyItem[]) {
    if (items) {
      this._items = items;
    } else {
      this._items = [];
      for (let i = 0; i < 100; i++) {
        this._items[i] = {
          caption: `Item #${i}`,
        };
      }
    }
  }

  /**
   * Adds extra items
   * @param count Number of items to add
   */
  addItems(count: number) {
    const length = this._items.length;
    for (let i = length; i < length + count; i++) {
      this._items[i] = {
        caption: `Additional item #${i}`,
      };
    }
  }

  /**
   * Retrieves the items slice of the specified range.
   */
  getListItemRange(
    start: number,
    end: number,
    topHidden?: number
  ): IListItem<DisassemblyItem>[] {
    const offset = topHidden || 0;
    return this._items
      .slice(start + offset, end + offset + 1)
      .map((item, index) => {
        return {
          itemIndex: index + start + offset,
          data: item,
        };
      });
  }

  /**
   * Retrieves the items sizes for the specified range.
   */
  getListItemSizes(start: number, end: number): number[] {
    const result: number[] = [];
    for (let i = start; i <= end; i++) {
      result[i - start] = 30;
    }
    return result;
  }

  /**
   * This event is raised when the items (or their count) has changed.
   */
  readonly itemsChanged = this._itemsChanged.expose();

  /**
   * Gets the items of this list
   */
  get items(): DisassemblyItem[] {
    return this._items;
  }

  /**
   * Gets the number of items in the list
   */
  get itemsCount(): number {
    return this._items.length;
  }
}
