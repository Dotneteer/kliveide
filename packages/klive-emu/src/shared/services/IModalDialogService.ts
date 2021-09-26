import * as React from "react";
import { Store } from "redux";
import { ILiteEvent } from "../utils/LiteEvent";

/**
 * Describes a modal dialog
 */
export interface IModalDialogDescriptor {
  /**
   * Dialog title in the header
   */
  title: string;

  /**
   * Dialog width
   */
  width?: number | string;

  /**
   * Dialog height;
   */
  height?: number | string;

  /**
   * Text of the leftmost button (hidden, if not defined)
   */
  button1Text?: string;

  /**
   * Responds to clicking the leftmost button
   */
  button1Clicked?: () => void | boolean;

  /**
   * Text of the middle button (hidden, if not defined)
   */
  button2Text?: string;

  /**
   * Responds to clicking the middle button
   */
  button2Clicked?: () => void | boolean;

  /**
   * Text of the rightmost button (hidden, if not defined)
   */
  button3Text?: string;

  /**
   * Responds to clicking the rightmost button
   */
  button3Clicked?: () => void | boolean;

  /**
   * Index of the button to mars as primary
   */
  primaryButtonIndex?: number;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(args?: unknown): React.ReactNode;
}

/**
 * Implements the logic that controls modal dialogs
 */
export interface IModalDialogService {
  /**
   * Gets the current modal descriptor
   */
  readonly modalDescriptor: IModalDialogDescriptor;

  /**
   * Gets the arguments of the modal dialog
   */
  readonly args: unknown;

  /**
   * Gets the results of the modal dialog
   */
  readonly result: unknown;

  /**
   * Registers a modal descriptor
   * @param id Descriptor identifier
   * @param descriptor Modial dialog descriptor
   */
  registerModalDescriptor(id: string, descriptor: IModalDialogDescriptor): void;

  /**
   * Disposes the modal dialog
   */
  disposeModalDialog(): void;

  /**
   * Displays the current modal dialog
   */
  hide(store: Store, result?: unknown): void;

  showModalDialog(store: Store, id: string, args?: unknown): Promise<unknown>;

  /**
   * This event signs that the modal dialog has changed
   */
  readonly modalChanged: ILiteEvent<IModalDialogDescriptor | null>;

  /**
   * This event signs that the visibility of the modal dialog has changed
   */
  readonly visibilityChanged: ILiteEvent<boolean>;
}
