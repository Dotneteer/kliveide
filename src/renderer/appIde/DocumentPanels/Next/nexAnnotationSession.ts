import type { IProjectService } from "@renderer/abstractions/IProjectService";
import {
  formatNexAnnotations,
  loadNexAnnotationSidecar
} from "./nexAnnotationSidecar";
import type { NexFileAnnotations } from "./nexAnnotations";

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
};

const sessions = new Map<string, NexAnnotationSession>();

export function subscribeNexAnnotationSession(
  projectService: Pick<IProjectService, "readFileContent">,
  annotationPath: string,
  bank: number,
  listener: NexAnnotationSessionListener
): () => void {
  const session = getOrCreateSession(annotationPath);
  session.listeners.add(listener);
  ensureSessionLoaded(projectService, annotationPath, bank, session);
  listener(createSnapshot(session));
  return () => {
    session.listeners.delete(listener);
  };
}

export function updateNexAnnotationSession(
  annotationPath: string,
  annotations: NexFileAnnotations
): void {
  const session = getOrCreateSession(annotationPath);
  session.annotations = annotations;
  session.dirty = true;
  session.saveError = undefined;
  session.loadError = undefined;
  session.loading = false;
  emitSession(session);
}

export async function saveNexAnnotationSession(
  projectService: Pick<IProjectService, "saveFileContent">,
  annotationPath: string
): Promise<void> {
  const session = getOrCreateSession(annotationPath);
  if (!session.annotations) {
    return;
  }

  try {
    await projectService.saveFileContent(
      annotationPath,
      formatNexAnnotations(session.annotations)
    );
    session.saveError = undefined;
    session.dirty = false;
  } catch (err) {
    session.saveError = err instanceof Error ? err.message : String(err);
    session.dirty = true;
  }
  emitSession(session);
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
