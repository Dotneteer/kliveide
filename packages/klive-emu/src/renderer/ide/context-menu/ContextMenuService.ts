import { ILiteEvent, LiteEvent } from "@shared/utils/LiteEvent";
import { MenuItem } from "@shared/command/commands";
import { ContextMenuOpenTarget, IContextMenuService } from "@shared/services/IContextMenuService";

/**
 * Represents the context menu service
 */
export class ContextMenuService implements IContextMenuService{
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
    await new Promise((r) => setTimeout(r, 25));
    this.setContextMenu(items);
    await new Promise((r) => setTimeout(r, 25));
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
