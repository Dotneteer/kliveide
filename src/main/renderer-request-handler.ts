// ====================================================================================================================
// The one handler behind `EmuToMain`, `IdeToMain` and `FloatToMain`
// (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.2).
//
// The response goes back to the `WebContents` that asked (`event.sender`), not to a fixed window: with
// up to eight floating windows on one channel there is no "the" window to answer.
// ====================================================================================================================

import {
  errorResponse,
  type Channel,
  type RequestMessage,
  type ResponseMessage
} from "@messaging/messages-core";

/**
 * The part of a `WebContents` the handler needs (a fake one in tests)
 */
export type RequestSender = {
  isDestroyed(): boolean;
  send(channel: string, message: unknown): void;
};

export type RendererRequestHandlerArgs = {
  /** The request */
  msg: RequestMessage;
  /** The renderer that sent it */
  sender: RequestSender | undefined;
  /** The channel to answer on */
  responseChannel: Channel;
  /** Dispatches a forwarded action; null when the request is not one */
  forwardActions: (msg: RequestMessage) => Promise<ResponseMessage | null>;
  /** Processes any other request */
  processRequest: (msg: RequestMessage) => Promise<ResponseMessage | null>;
};

/**
 * Processes a renderer's request and answers the renderer that sent it. The sender always gets a
 * response for its correlation ID: a throwing dispatch or processor is turned into an error response,
 * because a sender left without one waits until its timeout.
 */
export async function handleRendererRequest({
  msg,
  sender,
  responseChannel,
  forwardActions,
  processRequest
}: RendererRequestHandlerArgs): Promise<ResponseMessage> {
  let response: ResponseMessage | null;
  try {
    response = await forwardActions(msg);
    if (response === null) {
      response = await processRequest(msg);
    }
  } catch (err) {
    response = errorResponse(String(err));
  }
  if (!response) {
    response = errorResponse(`No response was produced for the request '${msg.type}'.`);
  }
  response.correlationId = msg.correlationId;
  response.sourceId = "main";
  if (sender && !sender.isDestroyed()) {
    sender.send(responseChannel, response);
  } else {
    console.warn(
      `[ipc] Dropping ${responseChannel} (correlationId ${msg.correlationId}): the window that ` +
        `sent the request is gone. The caller in that window will not receive a reply.`
    );
  }
  return response;
}
