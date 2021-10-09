import { Channel, RequestMessage, ResponseMessage } from "./message-types";

/**
 * Base class for messengers that provide renderer-to-main and
 * main-to-renderer communication
 */
export abstract class MessengerBase {
  // Sequential number of the next request
  private _requestSeqNo = 0;

  /**
   * Stores resolvers for
   */
  private _messageResolvers = new Map<
    number,
    (msg?: ResponseMessage | PromiseLike<ResponseMessage>) => void
  >();

  /**
   * Sends out a message in a fire-and-forget fashion
   * @param message Message to send out
   */
  postMessage(message: RequestMessage): void {
    this.send(message);
  }

  /**
   * Sends out a message and waits asynchronously for the response
   * @param message Message to send out
   * @returns Response for the message
   */
  async sendMessage<TResp extends ResponseMessage>(
    message: RequestMessage
  ): Promise<TResp> {
    if (message.correlationId === undefined) {
      message.correlationId = this._requestSeqNo++;
    }
    const promise = new Promise<TResp>((resolve) => {
      this._messageResolvers.set(
        message.correlationId,
        resolve as (
          value: ResponseMessage | PromiseLike<ResponseMessage>
        ) => void
      );
    });
    this.postMessage(message);
    return promise;
  }

  /**
   * Processes the response that arrives back on the response channel
   * @param response Response to process
   */
  protected processResponse(response: ResponseMessage): void {
    const resolver = this._messageResolvers.get(response.correlationId);
    if (resolver) {
      resolver(response);
      this._messageResolvers.delete(response.correlationId);
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
