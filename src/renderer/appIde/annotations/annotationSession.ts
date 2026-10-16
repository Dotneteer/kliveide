import type { IProjectService } from "@renderer/abstractions/IProjectService";
import {
  formatAnnotations,
  loadAnnotationSidecar,
  saveAnnotationSubtree
} from "./annotationSidecar";
import type { ProgramAnnotations } from "./programAnnotations";

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

export type AnnotationSessionSnapshot = {
  annotations?: ProgramAnnotations;
  dirty: boolean;
  loading: boolean;
  /**
   * The sidecar does not exist yet. Not an error for an active annotation set: a snapshot's `.dis`
   * is created by its first edit, which publishes a model through `updateAnnotationSession`.
   */
  missing?: boolean;
  loadError?: string;
  saveError?: string;
  /**
   * This snapshot is the file as another program changed it (`reloadAnnotationSessionFromDisk`),
   * not an edit made here. Set on that one snapshot only. Nothing needs writing: the file has it.
   */
  reloaded?: boolean;
};

type AnnotationSessionListener = (snapshot: AnnotationSessionSnapshot) => void;

type AnnotationSession = AnnotationSessionSnapshot & {
  /** Read-only: a shipped ROM sidecar. Updates are refused, never written. */
  readOnly?: boolean;
  loadStarted: boolean;
  listeners: Set<AnnotationSessionListener>;
  /** The write in flight, so a second edit chains onto it rather than racing it. */
  writing?: Promise<void>;
  /** An edit that arrived while a write was in flight, and must be written after it. */
  writeQueued: boolean;
  /** How to write. Captured from the first subscriber, since the session outlives any one panel. */
  writer?: Pick<IProjectService, "readFileContent" | "saveFileContent">;
  /** The banks the first load validated against, so a reload reads the file the same way */
  loadBanks?: number[];
  /** A re-read in flight, so a burst of outside changes is read one after the other */
  reloading?: Promise<void>;
  /** The main process follows this file for outside changes */
  watched?: boolean;
  /**
   * The file's text as this session last read or wrote it. A change report whose file still holds
   * exactly this is the session's own write (or a touch), not news.
   */
  diskText?: string;
  /**
   * Counts the models published here. A re-read that started under one revision and finished under
   * another overlapped an edit: what it read may be older than that edit, so it is dropped.
   */
  revision: number;
};

/**
 * How a session asks for its file to be followed for changes made outside the IDE. Installed by
 * `AnnotationFileWatchHost` with the main process's watcher; absent in tests and before start-up.
 */
export type AnnotationFileWatch = {
  watch(annotationPath: string): void;
  unwatch(annotationPath: string): void;
};

let fileWatch: AnnotationFileWatch | undefined;

const sessions = new Map<string, AnnotationSession>();

export function subscribeAnnotationSession(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">,
  annotationPath: string,
  bank: number | undefined,
  listener: AnnotationSessionListener
): () => void {
  const session = getOrCreateSession(annotationPath);
  session.listeners.add(listener);
  // --- Subscribing is also how the session learns to write: it outlives every panel that edits it,
  // --- so it holds its own writer rather than being handed one per edit.
  session.writer = projectService;
  // --- A session someone follows is one whose file another program may change under it
  watchSession(annotationPath, session);
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
export function seedAnnotationSession(
  annotationPath: string,
  annotations: ProgramAnnotations
): void {
  const session = getOrCreateSession(annotationPath);
  if (session.annotations || session.loadStarted || session.loadError) return;
  session.annotations = annotations;
  session.revision++;
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
export function updateAnnotationSession(
  annotationPath: string,
  annotations: ProgramAnnotations,
  projectService?: Pick<IProjectService, "readFileContent" | "saveFileContent">
): void {
  const session = getOrCreateSession(annotationPath);
  if (session.readOnly) {
    throw new Error(`${annotationPath} is read-only.`);
  }
  session.annotations = annotations;
  session.revision++;
  session.dirty = true;
  session.missing = false;
  session.loadError = undefined;
  session.loading = false;
  if (projectService) session.writer = projectService;
  emitSession(session);
  void writeSession(annotationPath, session);
}

/**
 * Write the annotations, one write at a time, always writing the newest model.
 *
 * Serialized because `saveAnnotationSubtree` is a read-modify-write of a file whose `debug`
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
  session: AnnotationSession
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
        // --- path and must survive this write untouched. See `annotationSidecar.ts`.
        const written = await saveAnnotationSubtree(session.writer, annotationPath, annotations);
        // --- What the file holds now, unless an edit has gone out behind it (the next pass writes it)
        session.diskText = written;
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
export async function flushAnnotationSession(annotationPath: string): Promise<void> {
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
 * edit must go through `updateAnnotationSession` — which publishes it to the open viewers and
 * writes it. With no session there is nothing in memory to conflict with, and the file can be read,
 * changed and written directly.
 *
 * Deliberately a *peek*, not a subscription: the caller is a command that runs once.
 */
export function peekAnnotationSession(
  annotationPath: string
): ProgramAnnotations | undefined {
  return sessions.get(annotationPath)?.annotations;
}

export function clearAnnotationSessions(): void {
  for (const [annotationPath, session] of sessions) unwatchSession(annotationPath, session);
  sessions.clear();
}

/**
 * Install (or, with `undefined`, remove) how sessions have their files followed for outside changes.
 * Every session that exists already is followed at once; each new one from its creation.
 */
export function setAnnotationFileWatch(watch: AnnotationFileWatch | undefined): void {
  for (const [annotationPath, session] of sessions) unwatchSession(annotationPath, session);
  fileWatch = watch;
  for (const [annotationPath, session] of sessions) watchSession(annotationPath, session);
}

/**
 * Read a session's file again because another program changed it, and publish what it now holds.
 *
 * The IDE's own writes are reported by the watcher too, and so are ignored by what they write: a
 * file holding the model the session already has changes nothing. Nor is the file read while this
 * session owes a write (`dirty`, or one in flight): the file is then a write behind the model, and
 * the write that follows puts the newest model there anyway.
 *
 * A file that does not parse — another program caught half-way through a save, or a typo in a hand
 * edit — is not published: the session keeps the last good model, and the next change is read
 * again. A file that was deleted publishes as missing.
 */
export function reloadAnnotationSessionFromDisk(
  annotationPath: string,
  projectService?: Pick<IProjectService, "readFileContent">
): Promise<void> {
  const session = sessions.get(annotationPath);
  if (!session || session.readOnly) return Promise.resolve();
  const reader = projectService ?? session.writer;
  if (!reader) return Promise.resolve();
  const reload = (session.reloading ?? Promise.resolve())
    .then(() => rereadSession(annotationPath, session, reader))
    .catch(() => {
      // --- A read that failed changes nothing; the next change is read again
    });
  session.reloading = reload;
  void reload.then(() => {
    if (session.reloading === reload) session.reloading = undefined;
  });
  return reload;
}

async function rereadSession(
  annotationPath: string,
  session: AnnotationSession,
  reader: Pick<IProjectService, "readFileContent">
): Promise<void> {
  if (owesWrite(session)) return;
  const revision = session.revision;
  const state = await loadAnnotationSidecar(reader, { fullPath: annotationPath }, session.loadBanks);
  // --- Gone, or edited here while the file was being read — even an edit whose write has already
  // --- finished: what was read may predate it, and publishing it would undo the edit
  if (sessions.get(annotationPath) !== session || owesWrite(session) || session.revision !== revision) {
    return;
  }
  if (state.status === "loaded") {
    // --- The session's own write, reported like any other change
    if (state.text !== undefined && state.text === session.diskText) return;
    session.diskText = state.text;
    const next = withViewSettingsOf(session.annotations, state.annotations!);
    if (session.annotations && sameModel(session.annotations, next)) return;
    session.annotations = next;
    session.missing = false;
  } else if (state.status === "missing") {
    session.diskText = undefined;
    if (session.missing && !session.annotations) return;
    session.annotations = undefined;
    session.missing = true;
  } else {
    return;
  }
  session.revision++;
  session.loadError = undefined;
  session.saveError = undefined;
  session.loadStarted = true;
  session.loading = false;
  session.dirty = false;
  emitSession(session, true);
}

function owesWrite(session: AnnotationSession): boolean {
  return session.dirty || !!session.writing;
}

/**
 * A ROM sidecar does not store how its page was last shown (`romSidecarWriter.ts` drops `lastView`
 * and `decimalView`), so a model read back from one has none. Those the session holds are kept: they
 * belong to the open documents, not to the file, and losing them would switch a page's view.
 */
function withViewSettingsOf(
  current: ProgramAnnotations | undefined,
  read: ProgramAnnotations
): ProgramAnnotations {
  if (!current || read.machine !== "rom") return read;
  let banks: ProgramAnnotations["banks"] | undefined;
  for (const [key, bank] of Object.entries(read.banks)) {
    const held = current.banks[key];
    if (!held || (held.lastView === undefined && held.decimalView === undefined)) continue;
    if (bank.lastView !== undefined || bank.decimalView !== undefined) continue;
    banks ??= { ...read.banks };
    banks[key] = {
      ...bank,
      ...(held.lastView !== undefined ? { lastView: held.lastView } : {}),
      ...(held.decimalView !== undefined ? { decimalView: held.decimalView } : {})
    };
  }
  return banks ? { ...read, banks } : read;
}

/** Two models are the same when they would be written as the same file */
function sameModel(left: ProgramAnnotations, right: ProgramAnnotations | undefined): boolean {
  return !!right && formatAnnotations(left) === formatAnnotations(right);
}

function watchSession(annotationPath: string, session: AnnotationSession): void {
  if (!fileWatch || session.watched || session.readOnly) return;
  session.watched = true;
  fileWatch.watch(annotationPath);
}

function unwatchSession(annotationPath: string, session: AnnotationSession): void {
  if (!fileWatch || !session.watched) return;
  session.watched = false;
  fileWatch.unwatch(annotationPath);
}

/**
 * Seed a read-only session: a shipped ROM sidecar (§5.2 of the reverse-engineering annotations
 * plan), which the IDE reads but never writes. `updateAnnotationSession` throws for it.
 */
export function seedReadOnlyAnnotationSession(
  annotationPath: string,
  annotations: ProgramAnnotations | undefined,
  loadError?: string
): void {
  const session = getOrCreateSession(annotationPath);
  session.readOnly = true;
  // --- Shipped files are not edited while the IDE runs
  unwatchSession(annotationPath, session);
  session.annotations = annotations;
  session.revision++;
  session.loadStarted = true;
  session.loading = false;
  session.dirty = false;
  session.loadError = loadError;
  emitSession(session);
}

/**
 * Forget a session whose file was missing, so the next subscriber reads it again. A session that
 * holds a model, or is writing one, is left alone.
 */
export function forgetMissingAnnotationSession(annotationPath: string): void {
  const session = sessions.get(annotationPath);
  if (!session || session.annotations || session.writing || session.listeners.size > 0) return;
  unwatchSession(annotationPath, session);
  sessions.delete(annotationPath);
}

function getOrCreateSession(annotationPath: string): AnnotationSession {
  const existing = sessions.get(annotationPath);
  if (existing) {
    return existing;
  }

  const session: AnnotationSession = {
    dirty: false,
    loading: false,
    loadStarted: false,
    writeQueued: false,
    revision: 0,
    listeners: new Set()
  };
  sessions.set(annotationPath, session);
  return session;
}

function ensureSessionLoaded(
  projectService: Pick<IProjectService, "readFileContent">,
  annotationPath: string,
  bank: number | undefined,
  session: AnnotationSession
): void {
  if (session.loadStarted || session.annotations || session.loadError) {
    return;
  }

  session.loadStarted = true;
  session.loading = true;
  session.loadBanks = bank === undefined ? undefined : [bank];
  emitSession(session);
  loadAnnotationSidecar(
    projectService,
    { fullPath: annotationPath },
    bank === undefined ? undefined : [bank]
  ).then((state) => {
    // --- An edit published while the read was in flight is newer than the file: keep it.
    if (session.annotations && session.dirty) {
      session.loading = false;
      emitSession(session);
      return;
    }
    if (state.status === "loaded") {
      session.annotations = state.annotations;
      session.diskText = state.text;
      session.revision++;
      session.loadError = undefined;
      session.missing = false;
    } else {
      session.annotations = undefined;
      session.loadError = state.message;
      session.missing = state.status === "missing";
    }
    session.loading = false;
    session.saveError = undefined;
    session.dirty = false;
    emitSession(session);
  });
}

function emitSession(session: AnnotationSession, reloaded = false): void {
  const snapshot = createSnapshot(session);
  if (reloaded) snapshot.reloaded = true;
  session.listeners.forEach((listener) => listener(snapshot));
}

function createSnapshot(session: AnnotationSession): AnnotationSessionSnapshot {
  return {
    annotations: session.annotations,
    dirty: session.dirty,
    loading: session.loading,
    ...(session.missing ? { missing: true } : {}),
    loadError: session.loadError,
    saveError: session.saveError
  };
}
