/*
 * The identity of a NEX bank's pop-out document.
 *
 * Three places open a bank of a NEX as its own `StaticMemoryDump` document: the NEX viewer's bank
 * pop-out, the debugger following the program counter (`IdeEventsHandler.revealNexBankForPc`), and
 * "go to definition" leaving the bank on screen (`StaticMemoryDump.revealAddressInBank`). They must
 * agree on the id, or one bank opens as two documents — a reveal then scrolls a copy the user is not
 * looking at, and anything keyed by document id (navigation history, see
 * `.plans/NAVIGATION_HISTORY_PLAN.md` §2) sees two unrelated documents.
 *
 * They did not: the viewer built the id from the node's *project-relative* path, the two reveals from
 * the host path `nex-run` recorded, which is the node's *full* path. The key is the full path because
 * it is the only one all three have: a reveal works from the launch session, which knows nothing about
 * the project, and a NEX launched from outside the project folder has no project path at all.
 *
 * `openStaticMemoryDump` adds its own `memoryDump-` prefix; this is the part the callers pass it.
 */

/** The dump id of bank `bank` of the NEX at `nexFullPath` (host path, as `nex-run` records it). */
export function nexBankDumpId(nexFullPath: string, bank: number): string {
  return `bankDump${nexFullPath}:${bank}`;
}

/**
 * How a NEX path reads in a bank document's tab: relative to the project folder when the file is in
 * it, the full path otherwise.
 *
 * Every opener names the tab the same way, for the same reason they share the id — whichever opens
 * the bank first names its tab. The viewer used the project path and the reveals the full path, so
 * the same bank showed up under two different titles.
 */
export function nexDocumentSourceName(nexFullPath: string, projectFolder?: string): string {
  if (projectFolder) {
    const folder = projectFolder.replace(/\\/g, "/").replace(/\/+$/, "");
    const path = nexFullPath.replace(/\\/g, "/");
    if (path.startsWith(`${folder}/`)) return path.substring(folder.length + 1);
  }
  return nexFullPath;
}

/** The tab title of a NEX bank's document. */
export function nexBankDumpTitle(nexFullPath: string, bank: number, projectFolder?: string): string {
  return `${nexDocumentSourceName(nexFullPath, projectFolder)} - Bank: ${bank}`;
}

/** The tab title of a NEX's Layer 2 loading screen document. */
export function nexLayer2ScreenDumpTitle(nexFullPath: string, projectFolder?: string): string {
  return `${nexDocumentSourceName(nexFullPath, projectFolder)} - Layer2`;
}

/** The dump id of the Layer 2 loading screen of the NEX at `nexFullPath`. */
export function nexLayer2ScreenDumpId(nexFullPath: string): string {
  return `layer2ScreenDump${nexFullPath}`;
}
