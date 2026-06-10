/**
 * Defines the behavior of a light-weight event handler
 */
export interface ILiteEvent<T = void> {
  /**
   * Adds a new event handler
   * @param handler Handler method
   */
  on(handler: { (data?: T): void }): void;

  /**
   * Removes the specified event handler
   * @param handler Handler method
   */
  off(handler: { (data?: T): void }): void;

  /**
   * Number of handlers attached
   */
  handlers: number;

  /**
   * Removes all attached event handlers
   */
  release(): void;
}
