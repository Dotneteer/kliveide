import { AnyMessage } from "../../../../common/messaging/messages-core";

export async function reportMessagingError(message: string): Promise<void> {
  console.trace();
  console.error(message);
}

export async function reportUnexpectedMessageType(type: AnyMessage["type"]): Promise<void> {
  await reportMessagingError(`Unexpected message response type: '${type}'`);
}
