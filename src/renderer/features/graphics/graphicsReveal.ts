import type { GraphicsLook } from "@common/reverse/graphicsDecode";

/*
 * `gfx <address> ...` asks the Graphics document to show an address with a look
 * (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.3). The document may not be mounted yet when the
 * command runs, so the request is held until a listener takes it — the pending-reveal pattern of
 * `spriteReveal.ts`.
 */

export type GraphicsRevealRequest = {
  address?: number;
  look?: Partial<GraphicsLook>;
  /** A bank or ROM page (partition) to show instead of the 64K view. */
  partition?: number;
};

type Listener = (request: GraphicsRevealRequest) => void;

let pending: GraphicsRevealRequest | undefined;
const listeners = new Set<Listener>();

export function requestGraphicsReveal(request: GraphicsRevealRequest): void {
  if (listeners.size === 0) {
    pending = request;
    return;
  }
  listeners.forEach((listener) => listener(request));
}

export function onGraphicsReveal(listener: Listener): () => void {
  listeners.add(listener);
  if (pending !== undefined) {
    const request = pending;
    pending = undefined;
    listener(request);
  }
  return () => {
    listeners.delete(listener);
  };
}
