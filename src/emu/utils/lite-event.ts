import type { ILiteEvent } from "../../common/abstractions/ILiteEvent";

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
    this._handlers = this._handlers.filter(h => h !== handler);
  }

  /**
   * Raises the event
   * @param data Event data
   */
  fire (data?: T) {
    this._handlers.slice(0).forEach(h => h(data));
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
