import { MenuItem } from "../shared/command/commands";
import { ILiteEvent } from "@core/LiteEvent";

/**
 * Declares the target of a context menu
 */
export type ContextMenuOpenTarget = {
  top: number;
  left: number;
  target: HTMLElement;
};

/**
 * IContextMenuService provides methods to display context menus
 */
export interface IContextMenuService {
  /**
   * Sets the menu items for the context menu
   * @param items Nem context menu items
   */
  setContextMenu(items: MenuItem[]): void;

  /**
   * Gets the current context menu
   */
  getContextMenu(): MenuItem[];

  /**
   * Opens the current context menu
   * @param top Top client position
   * @param left Left client position
   * @param target Target element
   */
  open(top: number, left: number, target: HTMLElement): void;

  /**
   * Closes the context menu
   */
  close(): void;

  /**
   * Is the context menu open requested programmatically?
   */
  readonly isOpen: boolean;

  /**
   * Opens the specified context menu
   * @param items New context menu items
   * @param top Top client position
   * @param left Left client position
   * @param target Target element
   */
  openMenu(
    items: MenuItem[],
    top: number,
    left: number,
    target: HTMLElement
  ): Promise<void>;

  /**
   * This event is fired when the context menu items has been changed
   * @returns
   */
  readonly menuChanged: ILiteEvent<void>;

  /**
   * This event is fired when open is requested
   */
  readonly openRequested: ILiteEvent<ContextMenuOpenTarget>;
}
