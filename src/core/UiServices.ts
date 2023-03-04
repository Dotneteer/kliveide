import { ILiteEvent, LiteEvent } from "@/emu/utils/lite-event";

/**
 * This type represents UI services available from any part of the UI
 */
export type IUiService = {
  readonly dragging: boolean;
  setDragging(flag: boolean): void;
  draggingChanged: ILiteEvent;
};

class UiService implements IUiService {
  private _draggingChanged = new LiteEvent<void>();
  private _dragging: boolean = false;

  get dragging (): boolean {
    return this._dragging;
  }

  setDragging (flag: boolean): void {
    if (this._dragging !== flag) {
      this._dragging = flag;
      this._draggingChanged.fire();
    }
  }

  get draggingChanged (): ILiteEvent<void> {
    return this._draggingChanged;
  }
}

export function createUiService () {
  return new UiService();
}
