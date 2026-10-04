import { isMachineNotAvailableError } from "@common/messaging/EmuApi";

/*
 * While the emulator rebuilds its machine (a machine, model or LCD-size change) every request to it
 * is answered with "Machine controller not available" for a moment. The shared state poller
 * (`useStateRefresh`) handles that, but many panels also refresh from their own effects when the
 * machine state changes - which it does exactly then - and an un-awaited async effect turns the
 * answer into an unhandled rejection: an error in the console for something that is not a fault.
 *
 * This filter marks only that rejection as handled. Every other unhandled rejection is reported as
 * before.
 */

/**
 * Whether an unhandled rejection is the expected "no machine during a rebuild" answer; if so, it is
 * marked as handled
 * @param event The window's `unhandledrejection` event
 */
export function filterMachineRebuildRejection(event: Pick<PromiseRejectionEvent, "reason" | "preventDefault">): boolean {
  if (!isMachineNotAvailableError(event.reason)) return false;
  event.preventDefault();
  return true;
}

/** Installs the filter on a window (the IDE's or the emulator's) */
export function installMachineRebuildRejectionFilter(target: Pick<Window, "addEventListener">): void {
  target.addEventListener("unhandledrejection", (event) => {
    filterMachineRebuildRejection(event);
  });
}

/**
 * Reports a failed refresh of an IDE panel: silently for the expected "no machine during a rebuild",
 * as a console error for anything else - never as an unhandled rejection
 * @param error The caught error
 */
export function reportRefreshError(error: unknown): void {
  if (isMachineNotAvailableError(error)) return;
  console.error("Refreshing the machine state failed:", error);
}
