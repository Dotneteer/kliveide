// ====================================================================================================================
// This file defines the MessengerBase class, which is responsible for providing correlated async message sending 
// between two processes. Each message contains a correlation identifier, and the message response contains the same 
// identifier. Thus the messenger class can match the returned answers with the corresponding request.
// ====================================================================================================================

import { Channel, RequestMessage, ResponseMessage } from "./messages-core";

/**
 * Base class for messengers that provide renderer-to-main and * main-to-renderer communication
 */
export abstract class MessengerBase {
  // Sequential number of the next request
  private _requestSeqNo = 0;

  /**
   * Stores resolvers to correlate incoming messages with outcoming ones
   */
  private _messageResolvers = new Map<
    number,
    (msg?: ResponseMessage | PromiseLike<ResponseMessage>) => void
  >();

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
   * @returns Response for the message
   */
  async sendMessage<TResp extends ResponseMessage> (
    message: RequestMessage
  ): Promise<TResp> {
    if (message.correlationId === undefined) {
      message.correlationId = this._requestSeqNo++;
    }

    // --- Create a promise and store the resolver function with the message ID.
    const promise = new Promise<TResp>(resolve => {
      this._messageResolvers.set(
        message.correlationId ?? 0,
        resolve as (
          value: ResponseMessage | PromiseLike<ResponseMessage>
        ) => void
      );
    });

    // --- Send out the message and return the promise.
    this.postMessage(message);
    return promise;
  }

  /**
   * Processes the response that arrives back on the response channel.
   * @param response Response to process
   * 
   * Do not forget ti call this method in a listener method to process the responses
   */
  protected processResponse (response: ResponseMessage): void {
    // --- Find the resolver according to the correlation ID.
    const resolver = this._messageResolvers.get(response.correlationId);
    if (resolver) {
      // --- Sign the response arrived
      resolver(response);

      // --- Remove the resolver
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
