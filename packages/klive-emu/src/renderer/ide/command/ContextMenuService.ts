import { animationTick } from "../../common/utils";
import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";

/**
 * Represents the context menu service
 */
class ContextMenuService {
  private _menuItems: MenuItem[] = [];
  private _menuChanged = new LiteEvent<void>();
  private _openRequested = new LiteEvent<ContextMenuOpenTarget>();
  private _isOpen: boolean = false;

  /**
   * Sets the menu items for the context menu
   * @param items Nem context menu items
   */
  setContextMenu(items: MenuItem[]): void {
    this._menuItems = items.slice(0);
    this._menuChanged.fire();
  }

  /**
   * Gets the current context menu
   */
  getContextMenu(): MenuItem[] {
    return this._menuItems;
  }

  /**
   * Opens the current context menu
   * @param top Top client position 
   * @param left Left client position
   * @param target Target element
   */
  open(top: number, left: number, target: HTMLElement): void {
    this._isOpen = true;
    this._openRequested.fire({ top, left, target });
  }

  /**
   * Closes the context menu
   */
  close(): void {
    this._isOpen = false;
  }

  /**
   * Is the context menu open requested programmatically?
   */
  get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Opens the specified context menu
   * @param items New context menu items
   * @param top Top client position 
   * @param left Left client position
   * @param target Target element
   */
  async openMenu(
    items: MenuItem[],
    top: number,
    left: number,
    target: HTMLElement
  ): Promise<void> {
    await animationTick();
    this.setContextMenu(items);
    this.open(top, left, target);
  }

  /**
   * This event is fired when the context menu items has been changed
   * @returns
   */
  get menuChanged(): ILiteEvent<void> {
    return this._menuChanged;
  }

  /**
   * This event is fired when open is requested
   */
  get openRequested(): ILiteEvent<ContextMenuOpenTarget> {
    return this._openRequested;
  }
}

/**
 * Declares the target of a context menu
 */
export type ContextMenuOpenTarget = {
  top: number;
  left: number;
  target: HTMLElement;
};

/**
 * The singleton instance of the context menu service
 */
export const contextMenuService = new ContextMenuService();

/**
 * Represents the execution context of a command
 */
export type CommandExecutionContext = {};

/**
 * Represents a command
 */
export type Command = {
  readonly id: string;
  readonly text: string;
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly checked?: boolean;
  readonly execute?: (context?: CommandExecutionContext) => void;
};

/**
 * Represents a command group
 */
export type CommandGroup = {
  readonly id: string;
  readonly text: string;
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly items: MenuItem[];
};

/**
 * Represents an item in a menu
 */
export type MenuItem = Command | CommandGroup | "separator";

/**
 * Type guard for a CommandGroup
 * @param item Item to check
 * @returns Is a CommandGroup instance?
 */
export function isCommandGroup(item: MenuItem): item is CommandGroup {
  return (item as CommandGroup).items !== undefined;
}
