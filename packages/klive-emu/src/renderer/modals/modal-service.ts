import { revertHighlightSearch } from "@syncfusion/ej2-react-dropdowns";
import { ILiteEvent, LiteEvent } from "../../shared/utils/LiteEvent";

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
class ModalDialogService {
  private _modalDescriptor: IModalDialogDescriptor | null = null;
  private _modalChanged = new LiteEvent<IModalDialogDescriptor | null>();
  private _visible = false;
  private _visibilityChanged = new LiteEvent<boolean>();
  private _dialogResolver: (result?: unknown | PromiseLike<unknown>) => void;
  private _args: unknown;
  private _result: unknown;

  /**
   * Gets the current modal descriptor
   */
  get modalDescriptor(): IModalDialogDescriptor {
    return this._modalDescriptor;
  }

  /**
   * Gets the arguments of the modal dialog
   */
  get args(): unknown {
    return this._args;
  }

  /**
   * Gets the results of the modal dialog
   */
  get result(): unknown {
    return this._result;
  }

  /**
   * Sets the current modal dialog descriptor
   * @param descriptor
   */
  setModalDialog(descriptor: IModalDialogDescriptor | null): void {
    if (this._modalDescriptor !== descriptor) {
      this._modalDescriptor = descriptor;
      this._modalChanged.fire(descriptor);
    }
  }

  /**
   * Displays the current modal dialog
   */
  show(): void {
    if (this._visible) {
      return;
    }
    this._visible = true;
    this._visibilityChanged.fire(true);
  }

  /**
   * Displays the current modal dialog
   */
  hide(result?: unknown): void {
    if (!this._visible) {
      return;
    }
    this._result = result;
    this._visible = false;
    this._visibilityChanged.fire(false);
    this._dialogResolver(result);
  }

  async showModalDialog(descriptor: IModalDialogDescriptor, args?: unknown): Promise<unknown> {
    if (this._visible) {
      return;
    }
    this._modalDescriptor = descriptor;
    this._args = args;
    this._modalChanged.fire(descriptor);
    this._visible = true;
    this._visibilityChanged.fire(true);
    return new Promise<unknown>((resolve) => {
      this._dialogResolver = resolve;
    });
  }

  /**
   * This event signs that the modal dialog has changed
   */
  get modalChanged(): ILiteEvent<IModalDialogDescriptor | null> {
    return this._modalChanged;
  }

  /**
   * This event signs that the visibility of the modal dialog has changed
   */
  get visibilityChanged(): ILiteEvent<boolean> {
    return this._visibilityChanged;
  }
}

/**
 * The singleton instance of the modal dialog service
 */
export const modalDialogService = new ModalDialogService();
