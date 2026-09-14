import { useEffect, useMemo, useRef, useState } from "react";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

import type { NexFileAnnotations, NexSidecarBreakpoint } from "./nexAnnotations";
import { saveNexDebugSubtree } from "./nexAnnotationSidecar";
import {
  fromSidecarBreakpoints,
  sameSidecarBreakpoints,
  toSidecarBreakpoints
} from "./nexBreakpointSync";
import { resolveLabelBreakpointsFor } from "./nexLabelBreakpoints";
import {
  groupBankBreakpointsByOffset,
  selectBankRowBreakpoint,
  summarizeBankBreakpoints,
  type BankBreakpointSummary
} from "./nexBankGutter";

/**
 * Every breakpoint the emulator currently holds, refreshed on `breakpointsVersion`.
 *
 * One place does the listing, so the gutter and the viewer's per-bank badges cannot disagree about
 * what is armed and do not each pay for their own IPC call. `breakpointsVersion` is the counter
 * every breakpoint mutation bumps, which is how a breakpoint set from the gutter, from a command, or
 * from another document all reach here the same way.
 *
 * An empty list is the right answer when there is no machine: an empty gutter and no badge.
 */
function useBreakpointList(enabled: boolean): BreakpointInfo[] {
  const emuApi = useEmuApi();
  const breakpointsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);
  const [breakpoints, setBreakpoints] = useState<BreakpointInfo[]>([]);

  // --- Read through a ref rather than depending on the API's identity. `useEmuApi` memoizes, so in
  // --- the app the object is stable — but an effect that re-runs whenever its *identity* changes is
  // --- one render-loop away from a caller that does not memoize, and that is not a dependency worth
  // --- having.
  const emuApiRef = useRef(emuApi);
  emuApiRef.current = emuApi;

  useEffect(() => {
    if (!enabled) {
      setBreakpoints([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await emuApiRef.current.listBreakpoints();
        if (!cancelled) setBreakpoints(response?.breakpoints ?? []);
      } catch {
        // --- No machine, or none that has breakpoints.
        if (!cancelled) setBreakpoints([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, breakpointsVersion]);

  return breakpoints;
}

/**
 * The bank-relative breakpoints armed in one NEX bank, keyed by their offset within it.
 *
 * A popped-out bank shows an offset inside a 16K bank, not a Z80 address, so its gutter cannot be
 * keyed the way the machine disassembly's is. These breakpoints are matched by
 * `bank` + `bankOffset` — exactly what `bp-set 05:+$0100` creates.
 *
 * One offset can carry several breakpoints — an execution breakpoint and a write watchpoint on the
 * same instruction is a perfectly reasonable thing to want — so the row's single glyph is chosen by
 * `selectBankRowBreakpoint` rather than by whichever the list happened to end with.
 */
export function useNexBankBreakpoints(bank: number | undefined): Map<number, BreakpointInfo> {
  const breakpoints = useBreakpointList(bank !== undefined);

  return useMemo(() => {
    const byOffset = new Map<number, BreakpointInfo>();
    if (bank === undefined) return byOffset;
    for (const [offset, candidates] of groupBankBreakpointsByOffset(breakpoints, bank)) {
      byOffset.set(offset, selectBankRowBreakpoint(candidates));
    }
    return byOffset;
  }, [bank, breakpoints]);
}

/**
 * How many breakpoints each bank carries, for the viewer's bank headings.
 *
 * Counts the same set the popped-out gutter shows — every bank-relative breakpoint in that bank,
 * whoever owns it. Two NEX files can both hold breakpoints in bank 5 (§4.4), and while only one of
 * them is *this* file's, the machine will stop at either; a badge that hid the other would be
 * telling the user something untrue about what is armed.
 */
export function useNexBankBreakpointCounts(): Map<number, BankBreakpointSummary> {
  const breakpoints = useBreakpointList(true);
  return useMemo(() => summarizeBankBreakpoints(breakpoints), [breakpoints]);
}

/*
 * Keeping a sidecar's breakpoints and the emulator's in step.
 *
 * The emulator is the runtime authority; the sidecar is the only place these breakpoints are stored
 * (`.plans/NEX_DEBUGGING_PLAN.md` §9.4a, which is also why the project file excludes them). So the
 * sidecar is read once per file and installed, and every later change is written back.
 */

// --- Per sidecar, so two popped-out banks of one NEX install it once between them rather than
// --- racing to install the same set twice.
const installedSidecars = new Set<string>();
const lastWritten = new Map<string, NexSidecarBreakpoint[]>();

/** Forget what has been installed. For tests, which must not leak state between cases. */
export function resetNexBreakpointSyncForTests(): void {
  installedSidecars.clear();
  lastWritten.clear();
}

/**
 * Install a sidecar's stored breakpoints once, then write back every change.
 *
 * Scoped to `{ kind: "nex", sidecar }` throughout, so installing cannot disturb the project's
 * breakpoints and a project open cannot disturb these.
 */
export function useNexSidecarBreakpointSync(
  sidecar: string | undefined,
  annotations: NexFileAnnotations | undefined
): void {
  const emuApi = useEmuApi();
  const { projectService } = useAppServices();
  const breakpointsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);

  const emuApiRef = useRef(emuApi);
  emuApiRef.current = emuApi;
  const projectServiceRef = useRef(projectService);
  projectServiceRef.current = projectService;

  // --- Install, once per sidecar.
  useEffect(() => {
    if (!sidecar || !annotations || installedSidecars.has(sidecar)) return undefined;
    installedSidecars.add(sidecar);
    const stored = annotations.debug?.breakpoints ?? [];
    lastWritten.set(sidecar, stored);
    if (stored.length === 0) return undefined;
    void emuApiRef.current
      .restoreBreakpoints(fromSidecarBreakpoints(stored, sidecar), { kind: "nex", sidecar })
      .catch(() => {
        // --- No machine yet. The sidecar still holds them, and the next open will try again.
        installedSidecars.delete(sidecar);
      });
    return undefined;
  }, [annotations, sidecar]);

  /*
   * Resolve this sidecar's label-anchored breakpoints whenever its annotations change.
   *
   * The counterpart of `refreshSourceCodeBreakpoints` for a NEX: a label breakpoint is armed
   * nowhere until the label table says where its label is, and re-resolved when that answer moves.
   * Keyed on the annotations, so renaming or moving a label re-runs it.
   *
   * `{ kind: "all" }` because this is a read-modify-write of the *whole* set — it was just read
   * through `listBreakpoints` — and that scope keeps each breakpoint's own owner rather than
   * stamping one.
   */
  useEffect(() => {
    if (!sidecar || !annotations) return undefined;
    let cancelled = false;
    (async () => {
      let current: BreakpointInfo[];
      try {
        const response = await emuApiRef.current.listBreakpoints();
        current = response?.breakpoints ?? [];
      } catch {
        return;
      }
      if (cancelled) return;

      const resolved = resolveLabelBreakpointsFor(current, sidecar, annotations);
      /*
       * Only write when something actually moved.
       *
       * Without this the write bumps `breakpointsVersion`, which is what the effect below watches,
       * and a resolution that always writes would drive an endless round trip. The comparison is
       * on the resolved fields alone, since those are all this effect can change.
       */
      if (!someResolutionChanged(current, resolved)) return;
      try {
        await emuApiRef.current.restoreBreakpoints(resolved, { kind: "all" });
      } catch {
        // --- No machine. The next annotation change tries again.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [annotations, sidecar]);

  // --- Write back, whenever the emulator's set for this sidecar actually differs.
  useEffect(() => {
    if (!sidecar || !installedSidecars.has(sidecar)) return undefined;
    let cancelled = false;
    (async () => {
      let current: NexSidecarBreakpoint[];
      try {
        const response = await emuApiRef.current.listBreakpoints();
        current = toSidecarBreakpoints(response?.breakpoints ?? [], sidecar);
      } catch {
        return;
      }
      if (cancelled || sameSidecarBreakpoints(current, lastWritten.get(sidecar))) return;
      lastWritten.set(sidecar, current);
      try {
        await saveNexDebugSubtree(projectServiceRef.current, sidecar, { breakpoints: current });
      } catch {
        // --- A failed write must not be remembered as written, or the next change would compare
        // --- equal and never retry.
        lastWritten.delete(sidecar);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [breakpointsVersion, sidecar]);
}

/**
 * Did resolution move anything?
 *
 * Compared field by field over the `resolved*` trio rather than by identity, because
 * `resolveLabelBreakpointsFor` returns fresh objects for the breakpoints it touched — so a
 * reference comparison would report a change every time and the write-back would never settle.
 */
function someResolutionChanged(before: BreakpointInfo[], after: BreakpointInfo[]): boolean {
  if (before.length !== after.length) return true;
  return before.some((bp, index) => {
    const next = after[index];
    return (
      bp.resolvedAddress !== next.resolvedAddress ||
      bp.resolvedBank !== next.resolvedBank ||
      bp.resolvedBankOffset !== next.resolvedBankOffset
    );
  });
}
