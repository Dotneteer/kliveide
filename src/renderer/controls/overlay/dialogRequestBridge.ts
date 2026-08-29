import { MessageSource } from "@common/messaging/messages-core";

export type RendererDialogOpener = (
  dialogId: number,
  dialogData?: any
) => Promise<unknown | undefined>;

const dialogOpeners: Partial<Record<MessageSource, RendererDialogOpener>> = {};

export function registerRendererDialogOpener(
  source: MessageSource,
  opener: RendererDialogOpener
): () => void {
  dialogOpeners[source] = opener;
  return () => {
    if (dialogOpeners[source] === opener) {
      delete dialogOpeners[source];
    }
  };
}

export async function openRendererDialog(
  source: MessageSource,
  dialogId: number,
  dialogData?: any
): Promise<unknown | undefined> {
  const opener = dialogOpeners[source];
  if (!opener) {
    throw new Error(`No renderer dialog opener registered for '${source}'.`);
  }
  return await opener(dialogId, dialogData);
}
