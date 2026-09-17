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
  /** One entry per write the session started — an edit publishes and writes in one step. */
  writeCalls: string[] = [];
  /** Set to make every write from now on fail with this reason. */
  writeError?: string;
  private writes: Promise<void>[] = [];

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
      /*
       * An edit publishes and is written, the way the real session does it.
       *
       * Two snapshots, not one: the edit arrives immediately and `dirty`, then the write settles it
       * a microtask later. Modelling that gap is the point — the controller must report the *write*
       * outward, not the moment in between, or the document tab blinks on every annotation.
       */
      update: (path, annotations) => {
        this.broadcast(path, { ...this.snapshotFor(path), annotations, dirty: true });
        this.writeCalls.push(path);
        const writeError = this.writeError;
        this.writes.push(
          Promise.resolve().then(() => {
            this.broadcast(path, {
              ...this.snapshotFor(path),
              dirty: !!writeError,
              saveError: writeError
            });
          })
        );
      }
    };
  }

  /** Wait for every write started so far, including any started by those. */
  async writesSettled(): Promise<void> {
    while (this.writes.length) {
      const pending = this.writes;
      this.writes = [];
      await Promise.all(pending);
    }
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
    bankComment: record("bankComment"),
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
  revealAddressInBank: ReturnType<typeof vi.fn>;
  unwrittenChanged: ReturnType<typeof vi.fn>;
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
  const revealAddressInBank = vi.fn().mockResolvedValue(undefined);
  const unwrittenChanged = vi.fn();

  return {
    session,
    dialogs,
    confirm,
    nativeConfirm,
    navigateToAddress,
    revealAddressInBank,
    unwrittenChanged,
    ports: {
      session: session.port,
      dialogs: dialogs.port,
      confirm: { confirm: confirm as any },
      nativeConfirm: nativeConfirm as any,
      bankBytes: () => options.bankBytes ?? [0, 1, 2, 3],
      navigateToAddress: navigateToAddress as any,
      revealAddressInBank: revealAddressInBank as any,
      unwrittenChanged: unwrittenChanged as any
    }
  };
}

/** The bank annotation the editor's model holds, for asserting what an edit published. */
export function publishedBank(session: FakeSession, path: string, bank: number) {
  const annotations = session.snapshotFor(path).annotations as NexFileAnnotations;
  return annotations?.banks?.[String(bank)];
}
