import { useEffect, useState, useSyncExternalStore } from "react";

import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type { AnnotationMachine } from "@common/annotations/bankSpace";
import type { ProgramAnnotations } from "./programAnnotations";

import {
  subscribeAnnotationSession,
  type AnnotationSessionSnapshot
} from "./annotationSession";
import { getAnnotationPath } from "./programAnnotations";

/*
 * Whose annotations are live.
 *
 * Until this existed the answer was "the NEX `nex-run` launched last" (`nexLoadSession`), so a 48K
 * program, a snapshot or a project's own code had nowhere to keep a label. The **active annotation
 * set** is one `.dis` file, made active by whatever put the program in the machine:
 *
 * - `nex-run`: the NEX's sidecar (`nexLoadSession` is still recorded, for the Memory Mapping
 *   panel's provenance line);
 * - `zx-snapshot`: `<snapshot>.dis`, whether or not it exists yet — the first edit creates it;
 * - `tape-load` of a ZX80/ZX81 program file: `<file>.dis`, since such a file loads at a fixed
 *   address and is as much a memory image as a snapshot;
 * - opening a project: the `.kliveproject`'s `annotations` property, else `annotations.dis` in the
 *   project root, created on first edit (Q3);
 * - `ann-open` / `ann-new`, and `ann-close` to deactivate.
 *
 * The live Disassembly view, the condition symbols and the sidecar breakpoint sync follow it, and
 * follow its *session*, so a label added from anywhere reaches them on the next refresh — which
 * closes the stale-labels gap of §2.3 of `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`.
 *
 * A module singleton for the reasons `nexLoadSession` gives: one IDE window owns it, and it changes
 * only when a program is put in the machine.
 */

export type ActiveAnnotationSetReason = "nex-run" | "snapshot" | "tape" | "project" | "command";

export type ActiveAnnotationSet = {
  /** The `.dis` file. */
  path: string;
  /** The `.nex` / `.z80` / `.p` it annotates, if any. */
  hostPath?: string;
  /** The bank space a new sidecar is written in. An existing file says its own. */
  machine: AnnotationMachine;
  reason: ActiveAnnotationSetReason;
};

type Listener = (set: ActiveAnnotationSet | undefined) => void;

let active: ActiveAnnotationSet | undefined;
const listeners = new Set<Listener>();

/** Make a set active (or, with `undefined`, none). Listeners hear only real changes. */
export function setActiveAnnotationSet(set: ActiveAnnotationSet | undefined): void {
  if (sameSet(active, set)) return;
  active = set ? { ...set } : undefined;
  listeners.forEach((listener) => listener(active));
}

/** Make a program file's sidecar active: `<file>.dis` beside it. */
export function activateSidecarOf(
  hostPath: string,
  machine: AnnotationMachine,
  reason: ActiveAnnotationSetReason
): ActiveAnnotationSet {
  const set: ActiveAnnotationSet = { path: getAnnotationPath(hostPath), hostPath, machine, reason };
  setActiveAnnotationSet(set);
  return set;
}

/**
 * Deactivate, but only a set made active for `reason`. Closing a project must not deactivate the
 * snapshot someone loaded since.
 */
export function clearActiveAnnotationSet(reason?: ActiveAnnotationSetReason): void {
  if (!active) return;
  if (reason && active.reason !== reason) return;
  setActiveAnnotationSet(undefined);
}

export function getActiveAnnotationSet(): ActiveAnnotationSet | undefined {
  return active;
}

export function subscribeActiveAnnotationSet(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The active set, re-rendering when it changes. */
export function useActiveAnnotationSet(): ActiveAnnotationSet | undefined {
  return useSyncExternalStore(
    (onChange) => subscribeActiveAnnotationSet(() => onChange()),
    getActiveAnnotationSet,
    getActiveAnnotationSet
  );
}

export type ActiveAnnotations = {
  set?: ActiveAnnotationSet;
  annotations?: ProgramAnnotations;
  snapshot?: AnnotationSessionSnapshot;
};

/**
 * The active set and its annotations, following its session: an edit made anywhere — a bank
 * document, the live view, the `label` command — re-renders the caller with the new model.
 */
export function useActiveAnnotations(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">
): ActiveAnnotations {
  const set = useActiveAnnotationSet();
  const [snapshot, setSnapshot] = useState<AnnotationSessionSnapshot | undefined>(undefined);

  useEffect(() => {
    setSnapshot(undefined);
    if (!set) return undefined;
    return subscribeAnnotationSession(projectService, set.path, undefined, setSnapshot);
    // --- The service is stable for the life of the app; following its identity would resubscribe
    // --- on every render of a caller that does not memoize it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.path]);

  return { set, annotations: snapshot?.annotations, snapshot };
}

/** The project sidecar's name when `.kliveproject` does not give one (Q3). */
export const DEFAULT_PROJECT_ANNOTATIONS = "annotations.dis";

/** The project's sidecar path: `annotations` from `.kliveproject`, relative to the folder. */
export function projectAnnotationPath(folderPath: string, relative: string | undefined): string {
  const name = relative?.trim() || DEFAULT_PROJECT_ANNOTATIONS;
  if (/^([a-zA-Z]:)?[\\/]/.test(name)) return name;
  return `${folderPath.replace(/[\\/]+$/, "")}/${name}`;
}

/** For tests, which must not leak state between cases. */
export function resetActiveAnnotationSetForTests(): void {
  active = undefined;
  listeners.clear();
}

function sameSet(a: ActiveAnnotationSet | undefined, b: ActiveAnnotationSet | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.path === b.path && a.hostPath === b.hostPath && a.machine === b.machine && a.reason === b.reason
  );
}
