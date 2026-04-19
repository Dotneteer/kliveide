import type { ILiteEvent } from "@abstractions/ILiteEvent";

/**
 * This class implements a simple multi-subscriber event
 */
export class LiteEvent<T> implements ILiteEvent<T> {
  private _handlers: { (data?: T): void }[] = [];

  /**
   * Adds a new event handler
   * @param handler Handler method
   */
  on (handler: { (data?: T): void }): void {
    this._handlers.push(handler);
  }

  /**
   * Removes the specified event handler
   * @param handler Handler method
   */
  off (handler: { (data?: T): void }): void {
    const idx = this._handlers.indexOf(handler);
    if (idx >= 0) this._handlers.splice(idx, 1);
  }

  /**
   * Raises the event
   * @param data Event data
   */
  fire (data?: T) {
    // Iterate in reverse so that handlers removed during iteration don't shift indices
    for (let i = this._handlers.length - 1; i >= 0; i--) {
      this._handlers[i](data);
    }
  }

  /**
   * Number of handlers attached
   */
  get handlers (): number {
    return this._handlers.length;
  }

  /**
   * Removes all attached event handlers
   */
  release (): void {
    this._handlers = [];
  }

  /**
   * Exposes the methods to subscribe to the event
   */
  public expose (): ILiteEvent<T> {
    return this;
  }
}
