/**
 * A lightweight cancellation token that can be used in a view.
 */
export interface CancellationToken {
  /**
   * Indicates that cancellation was requested
   */
  readonly cancelled: boolean;
}