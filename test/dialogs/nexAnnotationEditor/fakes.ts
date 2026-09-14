import { vi } from "vitest";

import type { NexFileAnnotations } from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";
import type {
  NexAnnotationEditorPorts,
  NexAnnotationSessionSnapshot
} from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorPorts";

import { anAnnotationModel } from "./fixtures";

/*
 * Fakes for every port the annotation editor touches, so its whole behaviour runs headless — no
 * React, no DOM, and no `vi.mock` below the container, per `.ai/ui-mvc-guide.md`.
 */

/**
 * A stand-in for the process-wide annotation session.
 *
 * It behaves like the real one in the way that matters: `update` broadcasts to every subscriber of
 * that sidecar and marks it dirty, so an edit published by the editor comes *back* to it as a
 * snapshot rather than being applied locally.
 */
export class FakeSession {
  private listeners = new Map<string, Set<(snapshot: NexAnnotationSessionSnapshot) => void>>();
  private snapshots = new Map<string, NexAnnotationSessionSnapshot>();

  subscribeCalls: { path: string; bank: number }[] = [];
  unsubscribeCount = 0;
  saveCalls: string[] = [];
  /** Set to make the next save reject. */
  saveError?: unknown;

  constructor(initial?: Partial<NexAnnotationSessionSnapshot>) {
    this.seed({ annotations: anAnnotationModel(), dirty: false, loading: false, ...initial });
  }

  /** Put a snapshot in place without notifying: the state a subscriber will be told on subscribe. */
  seed(snapshot: NexAnnotationSessionSnapshot, path = "*"): void {
    this.snapshots.set(path, snapshot);
  }

  snapshotFor(path: string): NexAnnotationSessionSnapshot {
    return (
      this.snapshots.get(path) ??
      this.snapshots.get("*") ?? { annotations: undefined, dirty: false, loading: false }
    );
  }

  /** Push a snapshot to every subscriber, as the real session does on any change. */
  broadcast(path: string, snapshot: NexAnnotationSessionSnapshot): void {
    this.snapshots.set(path, snapshot);
    for (const listener of [...(this.listeners.get(path) ?? [])]) {
      listener(snapshot);
    }
  }

  get port(): NexAnnotationEditorPorts["session"] {
    return {
      subscribe: (path, bank, listener) => {
        this.subscribeCalls.push({ path, bank });
        const set = this.listeners.get(path) ?? new Set();
        set.add(listener);
        this.listeners.set(path, set);
        // --- The real session reports its current state immediately.
        listener(this.snapshotFor(path));
        return () => {
          this.unsubscribeCount++;
          set.delete(listener);
        };
      },
      update: (path, annotations) => {
        // --- An update is a dirty edit that comes back as a snapshot, never applied locally.
        this.broadcast(path, { ...this.snapshotFor(path), annotations, dirty: true });
      },
      save: async (path) => {
        this.saveCalls.push(path);
        if (this.saveError !== undefined) throw this.saveError;
        this.broadcast(path, { ...this.snapshotFor(path), dirty: false, saveError: undefined });
      }
    };
  }
}

/** Every annotation dialog, each answering with whatever the test queued. */
export function createFakeDialogs() {
  const answers: Record<string, any> = {};
  const calls: Record<string, any[]> = {};

  const record = (name: string) => (args: any) => {
    (calls[name] ??= []).push(args);
    const answer = answers[name];
    return Promise.resolve(typeof answer === "function" ? answer(args) : answer);
  };

  const port: NexAnnotationEditorPorts["dialogs"] = {
    synopsisComment: record("synopsisComment"),
    endOfLineComment: record("endOfLineComment"),
    label: record("label"),
    manageLabels: record("manageLabels"),
    operandLabel: record("operandLabel"),
    region: record("region"),
    manageRegions: record("manageRegions")
  };

  return {
    port,
    calls,
    /** Queue what a dialog resolves with; a function receives the dialog's own arguments. */
    answerWith(name: keyof NexAnnotationEditorPorts["dialogs"], answer: any) {
      answers[name as string] = answer;
    },
    callsTo(name: keyof NexAnnotationEditorPorts["dialogs"]): any[] {
      return calls[name as string] ?? [];
    }
  };
}

export type FakePorts = {
  ports: NexAnnotationEditorPorts;
  session: FakeSession;
  dialogs: ReturnType<typeof createFakeDialogs>;
  confirm: ReturnType<typeof vi.fn>;
  nativeConfirm: ReturnType<typeof vi.fn>;
  navigateToAddress: ReturnType<typeof vi.fn>;
  dirtyChanged: ReturnType<typeof vi.fn>;
};

export function createFakePorts(
  options: {
    session?: FakeSession;
    bankBytes?: number[];
  } = {}
): FakePorts {
  const session = options.session ?? new FakeSession();
  const dialogs = createFakeDialogs();
  const confirm = vi.fn().mockResolvedValue(true);
  const nativeConfirm = vi.fn().mockReturnValue(true);
  const navigateToAddress = vi.fn();
  const dirtyChanged = vi.fn();

  return {
    session,
    dialogs,
    confirm,
    nativeConfirm,
    navigateToAddress,
    dirtyChanged,
    ports: {
      session: session.port,
      dialogs: dialogs.port,
      confirm: { confirm: confirm as any },
      nativeConfirm: nativeConfirm as any,
      bankBytes: () => options.bankBytes ?? [0, 1, 2, 3],
      navigateToAddress: navigateToAddress as any,
      dirtyChanged: dirtyChanged as any
    }
  };
}

/** The bank annotation the editor's model holds, for asserting what an edit published. */
export function publishedBank(session: FakeSession, path: string, bank: number) {
  const annotations = session.snapshotFor(path).annotations as NexFileAnnotations;
  return annotations?.banks?.[String(bank)];
}
