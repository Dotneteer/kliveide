import { Writable } from "svelte/store";
import { LiteEvent, ILiteEvent } from "../utils";

/**
 * Represents the state of the virtual list
 */
export interface VirtualListState<TItem = any> {
  /**
   * The total hight of the virtual list (in pixels)
   */
  totalListHeight: number;

  /**
   * The top scroll position
   */
  topPosition: number;

  /**
   * The shift at the top to provide non-integral item scrolling
   */
  topShift: number;

  /**
   * The current list of items to display
   */
  displayedItems: IListItem<TItem>[];

  /**
   * Indexes of selected items
   */
  selectedItems: number[];

  /**
   * Index of the last selected item
   */
  lastSelected: number;
}

/**
 * This class implements the management logic of a virtualized list component.
 */
export class VirtualizedListManager<TItem = any> implements ISelectHost<TItem> {
  private _itemsSource: IListable<TItem> | undefined;
  private _totalListHeight = 0;
  private _scrollPosition = 0;

  private _itemHeights: IListItemPosition[] = [];
  private _previousStart = -1;
  private _previousEnd = -1;
  private _previousTopShift = 0;
  private _selectedItem: IListItem<TItem> | undefined;
  private _rootVisible = true;

  // --- Store the state representation
  private _state: VirtualListState<TItem> = {
    topPosition: 0,
    displayedItems: [],
    totalListHeight: 0,
    topShift: 0,
    selectedItems: [],
    lastSelected: -1,
  };

  // ========================================================================
  // Lifecycle methods

  /**
   * Instantiates a new list component.
   * @param element The element that hosts the list.
   * @param contentElement The element that holds the list items.
   */
  constructor(
    protected element: HTMLElement,
    protected contentElement: HTMLElement,
    protected store: Writable<VirtualListState<TItem>>
  ) {
    this.rootVisible = true;
  }

  /**
   * Indicates if the root node (index with 0) of the list/tree should be visible.
   */
  get rootVisible(): boolean {
    return this._rootVisible;
  }
  set rootVisible(value: boolean) {
    this._rootVisible = value;
    this.topHidden = value ? 0 : 1;
  }

  /**
   * The list of source items
   */
  get itemsSource(): IListable<TItem> | undefined {
    return this._itemsSource;
  }
  set itemsSource(value: IListable<TItem> | undefined) {
    if (this._itemsSource !== value) {
      this._itemsSource = value;
      this.refreshItemsSource();
    }
  }

  /**
   * Number of top items that are not displayed.
   */
  topHidden = 0;

  /**
   * The child item height to calculate item heights. If not specified, 8 pixels
   * is used for calculation.
   */
  childHeight = 8;

  /**
   * Indicates if scroll unit is the heights of items
   */
  itemScroll = false;

  /**
   * This event is raised when the item is selected. The argument of the
   * event is the selected item.
   */
  itemSelected = new LiteEvent<IListItem<TItem> | undefined>();

  /**
   * This event is raised when the selection changes in the list. The argument of the
   * event is the newly selected item.
   */
  selectionChanged = new LiteEvent<IListItem<TItem> | undefined>();

  // ========================================================================
  // Public operations

  /**
   * Forces refreshing the items source. Use this method when the contents
   * (the number of items) in the items source has changed.
   */
  refreshItemsSource(): void {
    this.fixItemHeights();
    this.refreshView();
  }

  /**
   * Ask refreshing the list view.
   */
  requestRefresh(): void {
    setTimeout(() => {
      this.refreshView();
    }, 10);
  }

  /**
   * Refreshes the current view of the list. Use this method if the source items
   * behind the current view might have changed.
   */
  refreshView(): void {
    requestAnimationFrame(() => this.renderItems());
  }

  /**
   * Scrolls the list to the specified position
   * @param position Pixel position to scroll the top of the list to
   */
  scrollTo(position: number): void {
    this._scrollPosition = position;
    this.refreshView();
  }

  /**
   * Select an item in the list. Each invocation raises the {@link itemSelected} event.
   * If the selected item is different from the current selection, the method raises the
   * {@link selectionChanged} event, too.
   * @param item Selected item
   */
  selectItem(item: IListItem<TItem> | undefined): void {
    this.itemSelected.fire(item);
    if (this._selectedItem !== item) {
      this._selectedItem = item;
      this.selectionChanged.fire(item);
    }
  }

  /**
   * Gets the index of the selected item. Retrieves undefined, if there
   * is no selected item.
   */
  get selectedIndex(): number | undefined {
    return this._selectedItem ? this._selectedItem.itemIndex : undefined;
  }

  /**
   * Gets the payload of the selected item. Retrieves undefined, if there
   * is no selected item.
   */
  get selectedItem(): TItem | undefined {
    return this._selectedItem ? this._selectedItem.data : undefined;
  }

  /**
   * Gets the top position of the specified item.
   * @param index Item index.
   * @returns Item top position and height, if found; otherwise, undefined.
   */
  getItemLocation(index: number): IListItemPosition | undefined {
    return index < 0 || index >= this.itemsCount
      ? undefined
      : this._itemHeights[index];
  }

  // ========================================================================
  // Helpers

  /**
   * The counf of list items to display
   */
  private get itemsCount(): number {
    return Math.max(
      this._itemsSource
        ? (this.itemsSource?.itemsCount ?? 0) - this.topHidden
        : 0,
      0
    );
  }

  /**
   * Fixes the previous array of item heights
   */
  private fixItemHeights(): void {
    const itemCount = this.itemsCount;

    if (itemCount === this._itemHeights.length) {
      // --- Item count has not changed
      return;
    }

    if (itemCount > this._itemHeights.length) {
      // --- New items added, add default item heights
      const lastCount = this._itemHeights.length;
      let lastTop = 0;
      if (this._itemHeights.length > 0) {
        const lastItem = this._itemHeights[this._itemHeights.length - 1];
        lastTop = lastItem.top + lastItem.height;
      }
      while (itemCount > this._itemHeights.length) {
        this._itemHeights.push({
          top: lastTop,
          height: this.childHeight,
        });
        lastTop += this.childHeight;
      }
    } else if (itemCount < this._itemHeights.length) {
      // --- Items have been removed
      this._itemHeights.length = itemCount;
    }

    // --- Calculate the total heights
    this._totalListHeight = this.itemScroll ? this.childHeight / 2 : 0;
    for (const item of this._itemHeights) {
      this._totalListHeight += item.height;
    }

    // --- Recalculate the top position
  }

  /**
   * Gets the index of the first item that intersects the specified position.
   * @param position Position to get the item index for
   */
  private getItemIndexForPosition(position: number): number {
    let minIndex = 0;
    let maxIndex = this._itemHeights.length;
    while (minIndex < maxIndex) {
      const searchIndex = Math.floor((minIndex + maxIndex) / 2);
      const item = this._itemHeights[searchIndex];
      if (position >= item.top && position < item.top + item.height) {
        return searchIndex;
      } else if (position < item.top) {
        maxIndex = searchIndex - 1;
      } else {
        minIndex = searchIndex + 1;
      }
    }
    return minIndex;
  }

  /**
   * Calculates the items to display and raises the appropriate events
   * to display them.
   */
  private renderItems(): void {
    // --- Calculate the item range to display
    const itemCount = this.itemsCount;
    if (itemCount === 0) {
      return;
    }
    const scrollTop = this._scrollPosition;
    const start = this.getItemIndexForPosition(scrollTop);
    const topShift = this._itemHeights[start].top - this._scrollPosition;

    let end =
      this.getItemIndexForPosition(
        scrollTop + this.contentElement.offsetHeight
      ) + 1;
    end = Math.min(end, itemCount);

    // --- Initialize items to render
    let needsRendering = false;
    let items: Array<IListItem<TItem>> = [];

    // --- Check if the specified range has changed
    if (this._previousStart !== start || this._previousEnd !== end) {
      // --- Either the range changed or the items in the previous range
      needsRendering = true;
      items = this._itemsSource
        ? this._itemsSource.getListItemRange(start, end, this.topHidden)
        : [];
      this._previousStart = start;
      this._previousEnd = end;
    }

    if (needsRendering) {
      // --- Sign a rendering update, if needed
      this._state = Object.assign({}, this._state, {
        totalListHeight: this._totalListHeight,
        topPosition: this._scrollPosition,
        displayedItems: items,
        topShift: topShift,
      });
      this.store.set(this._state);
      this._previousTopShift = topShift;
    } else if (this._previousTopShift !== topShift) {
      // --- Align the top shift, if needed
      this._state = Object.assign({}, this._state, { topShift });
      this.store.set(this._state);
      this._previousTopShift = topShift;
    }
  }
}

/**
 * This interface defines items that can be put in a virtualized list.
 * @param TItem The payload type of a list item.
 */
export interface IListItem<TItem> {
  /**
   * The index of the list item.
   */
  itemIndex: number;

  /**
   * The payload of the list item.
   */
  data: TItem;
}

/**
 * This interface defines an object that can be displayed in virtualized lists.
 * @param TItem Type of list items
 */
export interface IListable<TItem = any> {
  /**
   * Retrieves the items slice of the specified range.
   */
  getListItemRange: ItemRangeGetterFunction<TItem>;

  /**
   * Retrieves the items sizes for the specified range.
   */
  getListItemSizes?: SizeRangeGetterFunction;

  /**
   * This event is raised when the items (or their count) has changed.
   */
  readonly itemsChanged: ILiteEvent<void>;

  /**
   * Gets the number of items in the list
   */
  readonly itemsCount: number;
}

/**
 * This type defines a function the obtains a range of list items.
 */
export type ItemRangeGetterFunction<TItem> = (
  start: number,
  end: number,
  topHidden?: number
) => Array<IListItem<TItem>>;

/**
 * This type defines a function that obtain list item size range.
 */
export type SizeRangeGetterFunction = (
  start: number,
  end: number,
  topHidden?: number
) => number[];

/**
 * This interface defines the behavior of a view that contains seleactable elements.
 * @param TItem The type of item that can be selected.
 */
export interface ISelectHost<TItem> {
  /**
   * Select an item in the list
   * @param item Selected item
   */
  selectItem(item: IListItem<TItem> | undefined): void;

  /**
   * Gets the index of the selected item. Retrieves undefined, if there
   * is no selected item.
   */
  readonly selectedIndex: number | undefined;

  /**
   * Number of top items that are not displayed.
   */
  readonly topHidden: number;
}

/**
 * Describes the position information about an item in the virtualized list.
 */
export interface IListItemPosition {
  /**
   * The item's top position within the virtual list
   */
  top: number;

  /**
   * The item's height in pixels
   */
  height: number;
}
