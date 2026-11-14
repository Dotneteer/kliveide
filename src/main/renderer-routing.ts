// ====================================================================================================================
// Delivering state and notifications to every renderer (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.2-§3.3).
//
// There used to be exactly two renderers, the emulator and the IDE, and the main store switched on
// the source of an action to pick "the other one". With floating document windows a renderer is one
// of `emu`, `ide` and `float1`..`float8`; the rule is now "every live renderer except the source".
// ====================================================================================================================

import type { ForwardActionRequest, MessageSource, RequestMessage } from "@messaging/messages-core";

/**
 * A renderer the main process can deliver messages to
 */
export type RendererTarget = {
  id: MessageSource;
  /** Sends a message; null when the renderer has no messenger (yet) */
  send: (message: RequestMessage) => Promise<unknown> | null;
};

/**
 * Delivers a forwarded action to every renderer except the one it came from. One unreachable
 * renderer (a window being torn down) must not stop the others: every send runs to completion, and
 * the first failure is rethrown afterwards.
 * @param message The forwarded action
 * @param targets The live renderers
 */
export async function deliverForwardedAction(
  message: ForwardActionRequest,
  targets: RendererTarget[]
): Promise<void> {
  const sends = targets
    .filter((target) => target.id !== message.sourceId)
    .map((target) => target.send({ ...message }));
  const results = await Promise.allSettled(sends);
  const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
  if (failure) {
    throw failure.reason;
  }
}
