import type { Channel, RequestMessage, ResponseMessage } from "./messages-core";

/**
 * The time to wait for a response before rejecting a request.
 *
 * This is deliberately generous: it is not a latency budget, it is a last-resort guard that
 * converts an otherwise permanent, silent hang (a response that is never sent, e.g. because the
 * target window was destroyed mid-flight, or its IPC listener was not registered yet when the
 * request arrived) into a visible, diagnosable error. Any healthy operation - even a slow one
 * such as compiling a large project or scanning a big project folder on a virus-scanned Windows
 * volume - completes far inside this window.
 *
 * Requests that legitimately have no upper bound (dialogs that block on user input, or
 * long-running/indefinite operations) must opt out explicitly by passing `timeoutMs: null`
 * rather than by inflating this default. See `UNBOUNDED_*_METHODS` in the API definitions.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Options controlling how a single request is sent.
 */
export type SendMessageOptions = {
  /**
   * Milliseconds to wait for a response. Pass `null` (or 0) to wait indefinitely, for requests
   * whose duration is genuinely unbounded. Omit to use `DEFAULT_REQUEST_TIMEOUT_MS`.
   */
  timeoutMs?: number | null;
};

/**
 * A request that has been sent and is still awaiting its correlated response.
 */
type PendingRequest = {
  resolve: (msg?: ResponseMessage | PromiseLike<ResponseMessage>) => void;
  reject: (reason: Error) => void;
  timer?: any;
};

// Base class for messengers that provide renderer-to-main and main-to-renderer communication
export abstract class MessengerBase {
  // --- Sequential number of the next request
  protected _requestSeqNo = 1;

  // Stores pending requests to correlate incoming messages with outcoming ones
  private _pendingRequests = new Map<number, PendingRequest>();

  /**
   * Sends out a message in a fire-and-forget fashion
   * @param message Message to send out
   */
  postMessage (message: RequestMessage): void {
    this.send(message);
  }

  /**
   * Sends out a message and waits asynchronously for the response
   * @param message Message to send out
   * @param options Optional per-request settings (e.g. a custom or disabled timeout)
   * @returns Response for the message
   */
  async sendMessage (
    message: RequestMessage,
    options?: SendMessageOptions
  ): Promise<any> {
    if (message.correlationId === undefined) {
      message.correlationId = this._requestSeqNo++;
    }
    const correlationId = message.correlationId!;
    const timeoutMs =
      options?.timeoutMs === undefined ? DEFAULT_REQUEST_TIMEOUT_MS : options.timeoutMs;

    // --- Create a promise and store the resolver function with the message ID.
    const promise = new Promise<any>((resolve, reject) => {
      let timer: any;
      if (timeoutMs != null && timeoutMs > 0) {
        timer = setTimeout(() => {
          // --- Drop the pending entry first, so a late response is simply ignored rather than
          // --- resolving an already-rejected promise, and so the entry cannot leak.
          this._pendingRequests.delete(correlationId);
          reject(
            new Error(
              `IPC request timed out after ${timeoutMs} ms on channel '${this.requestChannel}' ` +
                `(${describeRequest(message)}). The target process never sent a response - it may ` +
                `not have been ready to receive the request, or the response was lost.`
            )
          );
        }, timeoutMs);
      }
      this._pendingRequests.set(correlationId, {
        resolve: resolve as PendingRequest["resolve"],
        reject,
        timer
      });
    });

    // --- Send out the message and return the promise.
    try {
      this.postMessage(message);
    } catch (err) {
      // --- The send failed synchronously (e.g. a non-serializable payload). Discard the pending
      // --- entry so it does not linger forever, then surface the original failure.
      this.discardPendingRequest(correlationId);
      throw err;
    }
    return promise;
  }

  /**
   * Processes the response that arrives back on the response channel.
   * @param response Response to process
   *
   * Do not forget ti call this method in a listener method to process the responses
   */
  protected processResponse (response: ResponseMessage): void {
    // --- Find the pending request according to the correlation ID.
    const pending = this._pendingRequests.get(response.correlationId!);
    if (pending) {
      // --- Remove the entry (and cancel its timeout) before resolving.
      this._pendingRequests.delete(response.correlationId!);
      if (pending.timer !== undefined) {
        clearTimeout(pending.timer);
      }

      // --- Sign the response arrived
      pending.resolve(response);
    }
  }

  /**
   * Removes a pending request without resolving or rejecting it, cancelling its timeout.
   * @param correlationId The correlation ID of the request to discard
   */
  protected discardPendingRequest (correlationId: number): void {
    const pending = this._pendingRequests.get(correlationId);
    if (!pending) return;
    this._pendingRequests.delete(correlationId);
    if (pending.timer !== undefined) {
      clearTimeout(pending.timer);
    }
  }

  // ==========================================================================
  // Methods to override

  /**
   * Sends out the message
   * @param message Message to send
   */
  protected abstract send(message: RequestMessage): void;

  /**
   * The channel to send the request out
   */
  abstract get requestChannel(): Channel;

  /**
   * The channel to listen for responses
   */
  abstract get responseChannel(): Channel;
}

/**
 * Builds a short human-readable description of a request, for diagnostics.
 */
function describeRequest (message: RequestMessage): string {
  if (message.type === "ApiMethodRequest") {
    return `method '${message.method}'`;
  }
  if (message.type === "ForwardAction") {
    return `forwarded action '${message.action?.type}'`;
  }
  return `message type '${(message as RequestMessage).type}'`;
}
