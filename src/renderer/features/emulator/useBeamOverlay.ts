import { useEffect, useState } from "react";

import { isZxNextIdeMachine } from "@emu/machines/zxNext/IZxNextIdeMachine";
import type { IAnyMachine } from "@renderer/abstractions/IAnyMachine";
import { copperHitTact, type BeamOverlayState, type CopperMarker } from "./beamOverlayModel";
import type { BeamPosition } from "@common/utils/beamGeometry";

type Options = {
  /** The machine is paused (the overlay is hidden while it runs: D1) */
  paused: boolean;
  /** The view setting (D8) */
  enabled: boolean;
  /** Instant Screen shows a whole-frame render: no render to the beam, no hatch (T8) */
  instant: boolean;
  /** Changes at every stop, so stepping redraws the overlay (Q3, T9) */
  stopCount: number;
  /** The paused picture was redrawn by someone else (`emuViewVersion`, T9) */
  viewVersion?: number;
};

/** The Copper's hit, when the last stop was a Copper breakpoint and it is not where the CPU is (D7, T7) */
export function copperMarkerOf(machine: IAnyMachine, beam: BeamPosition): CopperMarker | undefined {
  if (!isZxNextIdeMachine(machine)) return undefined;
  const copper = machine.getCopperState();
  const hit = copper.lastHit;
  if (!copper.startMode || !hit) return undefined;
  const tact = copperHitTact(beam, hit, copper.lineOffset);
  const index = hit.index.toString(16).toUpperCase().padStart(3, "0");
  return { tact, label: `Copper hit $${index}` };
}

/**
 * Drives the beam position overlay (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.4): at every stop - and
 * when the paused picture is redrawn or the setting changes - brings the picture up to the beam
 * (D3, unless Instant Screen is on), redraws it, and reads where the beam is. Hooks into the same
 * points as the paused redraw, never a timer (T9). Returns nothing while running or switched off.
 */
export function useBeamOverlay(
  machine: IAnyMachine | undefined,
  displayScreenData: () => void,
  { paused, enabled, instant, stopCount, viewVersion }: Options
): BeamOverlayState | undefined {
  const [state, setState] = useState<BeamOverlayState>();
  useEffect(() => {
    if (!paused || !enabled || !machine?.getBeamPosition) {
      setState(undefined);
      return;
    }
    try {
      if (!instant && machine.renderToBeamPreview) {
        machine.renderToBeamPreview();
        displayScreenData();
      }
      const beam = machine.getBeamPosition();
      setState({ beam, instant, copper: copperMarkerOf(machine, beam) });
    } catch {
      // --- The core is not loaded yet, or is being replaced
      setState(undefined);
    }
  }, [machine, displayScreenData, paused, enabled, instant, stopCount, viewVersion]);
  return state;
}
