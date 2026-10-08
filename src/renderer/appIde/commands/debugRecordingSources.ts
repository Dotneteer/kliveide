import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { RecordingSources } from "@common/debugRecording/debugRecordingFile";

import { sha256Hex } from "@common/debugRecording/debugRecordingFile";

/*
 * A debug recording's sources (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D13): identified by their
 * project-relative path and SHA-256, embedded only with `-sources`. On load the project's files are
 * compared with them, so nobody steps through source lines that are not the ones that ran.
 */

/** A path relative to the project folder, with forward slashes; as it is when outside it */
export function projectRelativePath(file: string, folder: string | null | undefined): string {
  const norm = (p: string) => p.replace(/\\/g, "/");
  const f = norm(file);
  if (!folder) return f;
  const root = norm(folder).replace(/\/+$/, "");
  return f.toLowerCase().startsWith(`${root.toLowerCase()}/`) ? f.slice(root.length + 1) : f;
}

/** The compilation's source files, absolute, main file first */
function compiledFiles(context: IdeCommandContext): { main?: string; files: string[] } {
  const compilation = context.store.getState().compilation;
  const list = ((compilation?.result as { sourceFileList?: { filename: string }[] } | undefined)?.sourceFileList ?? [])
    .map((f) => f.filename)
    .filter((f): f is string => !!f);
  const main = compilation?.filename ?? list[0];
  const files = [...new Set([...(main ? [main] : []), ...list])];
  return { main, files };
}

/**
 * The current compilation's sources, as a recording keeps them; undefined when nothing is compiled
 * @param withTexts Embed the files themselves (`-sources`)
 */
export async function collectRecordingSources(
  context: IdeCommandContext,
  withTexts: boolean
): Promise<RecordingSources | undefined> {
  const { main, files } = compiledFiles(context);
  if (!files.length) return undefined;
  const folder = context.store.getState().project?.folderPath;
  const out: RecordingSources = { mainFile: main ? projectRelativePath(main, folder) : undefined, files: [] };
  for (const file of files) {
    let text: string;
    try {
      text = await context.mainApi.readTextFile(file);
    } catch {
      continue;
    }
    out.files.push({
      path: projectRelativePath(file, folder),
      sha256: await sha256Hex(new TextEncoder().encode(text)),
      ...(withTexts ? { text } : {})
    });
  }
  return out;
}

/**
 * How the open project's files differ from a recording's (D13, T11): one line per file that differs or
 * is missing; empty when they all match or no project is open
 */
export async function compareRecordingSources(
  context: IdeCommandContext,
  sources: RecordingSources | undefined
): Promise<string[]> {
  const state = context.store.getState();
  const folder = state.project?.folderPath;
  if (!sources?.files.length || !folder || !state.project?.isKliveProject) return [];
  const differs: string[] = [];
  const missing: string[] = [];
  for (const f of sources.files) {
    const path = /^([a-zA-Z]:)?\//.test(f.path) ? f.path : `${folder.replace(/[\\/]+$/, "")}/${f.path}`;
    let text: string;
    try {
      text = await context.mainApi.readTextFile(path);
    } catch {
      missing.push(f.path);
      continue;
    }
    if ((await sha256Hex(new TextEncoder().encode(text))) !== f.sha256) differs.push(f.path);
  }
  const lines: string[] = [];
  if (differs.length) {
    lines.push(`Labels and source lines may not match the recording: ${differs.map((p) => `${p} differs`).join(", ")}`);
  }
  if (missing.length) lines.push(`The project lacks ${missing.length === 1 ? "a file" : "files"} the recording was made with: ${missing.join(", ")}`);
  if (lines.length) lines.push("Stepping still works on the disassembly; address breakpoints are exact");
  return lines;
}
