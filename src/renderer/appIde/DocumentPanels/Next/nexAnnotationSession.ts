import type { IProjectService } from "@renderer/abstractions/IProjectService";
import {
  loadNexAnnotationSidecar,
  saveNexAnnotationSubtree
} from "./nexAnnotationSidecar";
import type { NexFileAnnotations } from "./nexAnnotations";

/*
 * Annotations are written the moment they change.
 *
 * There is no Save. An annotation is a note about a program — a name for a routine, a comment, a
 * region marked as data — and the reason to make one is always to keep it. An explicit save added a
 * step to every one of those, a dirty dot to the tab, and a question on close, in exchange for an
 * undo affordance the editor never offered anyway: there was no way to revert to the file, only to
 * discard by closing. The `debug` subtree beside these (bank breakpoints) has been written on change
 * since it existed, for the same reason, so this makes one policy out of two.
 *
 * `dirty` therefore no longer means "the user has not saved". It means "this copy is not on disk
 * *yet*", which is true for as long as a write takes and after a write that failed. What the UI
 * reacts to is `saveError`.
 */

export type NexAnnotationSessionSnapshot = {
  annotations?: NexFileAnnotations;
  dirty: boolean;
  loading: boolean;
  loadError?: string;
  saveError?: string;
};

type NexAnnotationSessionListener = (snapshot: NexAnnotationSessionSnapshot) => void;

type NexAnnotationSession = NexAnnotationSessionSnapshot & {
  loadStarted: boolean;
  listeners: Set<NexAnnotationSessionListener>;
  /** The write in flight, so a second edit chains onto it rather than racing it. */
  writing?: Promise<void>;
  /** An edit that arrived while a write was in flight, and must be written after it. */
  writeQueued: boolean;
  /** How to write. Captured from the first subscriber, since the session outlives any one panel. */
  writer?: Pick<IProjectService, "readFileContent" | "saveFileContent">;
};

const sessions = new Map<string, NexAnnotationSession>();

export function subscribeNexAnnotationSession(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">,
  annotationPath: string,
  bank: number,
  listener: NexAnnotationSessionListener
): () => void {
  const session = getOrCreateSession(annotationPath);
  session.listeners.add(listener);
  // --- Subscribing is also how the session learns to write: it outlives every panel that edits it,
  // --- so it holds its own writer rather than being handed one per edit.
  session.writer = projectService;
  ensureSessionLoaded(projectService, annotationPath, bank, session);
  listener(createSnapshot(session));
  return () => {
    session.listeners.delete(listener);
  };
}

/**
 * Hand the session a model that was already read, so subscribing does not read the file again.
 *
 * The NEX viewer reads the sidecar itself — it has to, to tell a missing file from a broken one —
 * and then follows the session so an edit made in a popped-out bank reaches its headings. Without
 * this, that subscription would read the same file a second time.
 *
 * **Only an empty session is seeded.** A session that already holds a model, or is loading one, is
 * at least as current as a read the viewer just made — a pop-out may have published an edit whose
 * write has not landed yet — so it is left alone. Nothing is written: the model came from the file.
 */
export function seedNexAnnotationSession(
  annotationPath: string,
  annotations: NexFileAnnotations
): void {
  const session = getOrCreateSession(annotationPath);
  if (session.annotations || session.loadStarted || session.loadError) return;
  session.annotations = annotations;
  session.loadStarted = true;
  session.loading = false;
  session.dirty = false;
  emitSession(session);
}

/**
 * Publish an edited model, and write it.
 *
 * Subscribers see the edit immediately; the file catches up. Callers do not await the write — an
 * annotation dialog that stayed open until the disk answered would make every edit feel like a save,
 * which is the thing being removed. A failure surfaces through the snapshot's `saveError`.
 *
 * `projectService` is optional because one caller — an IDE command editing a sidecar that happens to
 * have a viewer open — has its own. Without one, an edit still publishes and stays `dirty`; the
 * session writes it as soon as any subscriber has supplied a writer.
 */
export function updateNexAnnotationSession(
  annotationPath: string,
  annotations: NexFileAnnotations,
  projectService?: Pick<IProjectService, "readFileContent" | "saveFileContent">
): void {
  const session = getOrCreateSession(annotationPath);
  session.annotations = annotations;
  session.dirty = true;
  session.loadError = undefined;
  session.loading = false;
  if (projectService) session.writer = projectService;
  emitSession(session);
  void writeSession(annotationPath, session);
}

/**
 * Write the annotations, one write at a time, always writing the newest model.
 *
 * Serialized because `saveNexAnnotationSubtree` is a read-modify-write of a file whose `debug`
 * subtree belongs to another writer: two overlapping saves would each read the file before the other
 * wrote it, and the second would land on a stale read. Two banks of one NEX share this session and
 * edit it independently, so overlapping writes are ordinary, not exotic.
 *
 * Coalescing rather than queueing: an edit arriving mid-write only has to mark that another write is
 * owed, because the next one writes `session.annotations` as it is *then* — which already includes
 * every edit since. A burst of edits costs two writes, not one per edit.
 */
async function writeSession(
  annotationPath: string,
  session: NexAnnotationSession
): Promise<void> {
  if (!session.annotations || !session.writer) return;
  if (session.writing) {
    session.writeQueued = true;
    return;
  }

  session.writing = (async () => {
    do {
      session.writeQueued = false;
      const annotations = session.annotations;
      if (!annotations) break;
      try {
        // --- Only the annotation keys: the `debug` subtree beside them is written by the breakpoint
        // --- path and must survive this write untouched. See `nexAnnotationSidecar.ts`.
        await saveNexAnnotationSubtree(session.writer, annotationPath, annotations);
        // --- Only clean if nothing arrived while that write was in the air.
        session.dirty = session.writeQueued;
        session.saveError = undefined;
      } catch (err) {
        session.saveError = err instanceof Error ? err.message : String(err);
        session.dirty = true;
        // --- Retrying here would spin on a locked or read-only file. The next edit retries, and
        // --- until then the error is on show and the document refuses to close silently.
        session.writeQueued = false;
      }
      emitSession(session);
    } while (session.writeQueued);
  })().finally(() => {
    session.writing = undefined;
  });

  await session.writing;
}

/**
 * Wait for any write in flight, and for anything queued behind it.
 *
 * For tests and for callers that need the file to exist before they read it. Nothing in the UI
 * awaits a write: the session outlives the panels that edit it, so a write started by a panel being
 * closed still completes.
 */
export async function flushNexAnnotationSession(annotationPath: string): Promise<void> {
  const session = sessions.get(annotationPath);
  while (session?.writing) {
    await session.writing;
  }
}

/**
 * The annotations a live session holds for this sidecar, or `undefined` when none is open.
 *
 * The distinction matters to anything editing annotations from *outside* a viewer (§13.3): with a
 * session open, its copy is the current one and the file on disk may be a write behind it, so an
 * edit must go through `updateNexAnnotationSession` — which publishes it to the open viewers and
 * writes it. With no session there is nothing in memory to conflict with, and the file can be read,
 * changed and written directly.
 *
 * Deliberately a *peek*, not a subscription: the caller is a command that runs once.
 */
export function peekNexAnnotationSession(
  annotationPath: string
): NexFileAnnotations | undefined {
  return sessions.get(annotationPath)?.annotations;
}

export function clearNexAnnotationSessions(): void {
  sessions.clear();
}

function getOrCreateSession(annotationPath: string): NexAnnotationSession {
  const existing = sessions.get(annotationPath);
  if (existing) {
    return existing;
  }

  const session: NexAnnotationSession = {
    dirty: false,
    loading: false,
    loadStarted: false,
    writeQueued: false,
    listeners: new Set()
  };
  sessions.set(annotationPath, session);
  return session;
}

function ensureSessionLoaded(
  projectService: Pick<IProjectService, "readFileContent">,
  annotationPath: string,
  bank: number,
  session: NexAnnotationSession
): void {
  if (session.loadStarted || session.annotations || session.loadError) {
    return;
  }

  session.loadStarted = true;
  session.loading = true;
  emitSession(session);
  loadNexAnnotationSidecar(
    projectService,
    { fullPath: annotationPath },
    [bank]
  ).then((state) => {
    if (state.status === "loaded") {
      session.annotations = state.annotations;
      session.loadError = undefined;
    } else {
      session.annotations = undefined;
      session.loadError = state.message;
    }
    session.loading = false;
    session.saveError = undefined;
    session.dirty = false;
    emitSession(session);
  });
}

function emitSession(session: NexAnnotationSession): void {
  const snapshot = createSnapshot(session);
  session.listeners.forEach((listener) => listener(snapshot));
}

function createSnapshot(session: NexAnnotationSession): NexAnnotationSessionSnapshot {
  return {
    annotations: session.annotations,
    dirty: session.dirty,
    loading: session.loading,
    loadError: session.loadError,
    saveError: session.saveError
  };
}
