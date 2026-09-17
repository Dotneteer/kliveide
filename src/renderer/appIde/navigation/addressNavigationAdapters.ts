import type { DocumentNavigationAdapter } from "@renderer/abstractions/DocumentNavigationAdapter";
import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import type { NavigationEntry, NavigationLocator } from "@renderer/abstractions/NavigationLocation";
import { getBytesPerRow, resolveViewMode } from "@renderer/features/memory/memoryViewModel";
import { DISASSEMBLY_PANEL_ID, MEMORY_PANEL_ID } from "@common/state/common-ids";
import { nexBankDumpId, nexBankDumpTitle } from "../DocumentPanels/Next/nexBankDocument";
import { getNexAnnotationPath } from "../DocumentPanels/Next/nexAnnotations";

/*
 * Navigation for the address-based views: the live Memory and Disassembly panels, and static memory
 * dumps (a NEX bank popped out into its own document).
 *
 * A location is an address, plus what the view needs to show it again — the segment and 64K switch
 * of the live panels, the listing a dump was showing. Capture asks the mounted view
 * (`DocumentApi.getNavigationLocator`) and falls back to the document's saved view state; restore
 * activates (or reopens) the document and asks its view to `revealLocator`.
 *
 * See `.plans/NAVIGATION_HISTORY_PLAN.md` §3.2 and §4.2-4.3.
 */

/** Within a screenful of rows: one entry, not two. */
export const MEMORY_NEAR_BYTES = 0x100;
export const DISASSEMBLY_NEAR_BYTES = 0x80;
export const DUMP_NEAR_BYTES = 0x40;

/** The document id `openStaticMemoryDump` gives a NEX bank: `memoryDump-` + `nexBankDumpId`. */
const NEX_BANK_DOCUMENT_ID = /^memoryDump-bankDump(.+):(\d+)$/;

export function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

function addressOf(locator: NavigationLocator): number | undefined {
  return locator.kind === "address" ? locator.address : undefined;
}

function sameSegmentView(a: NavigationLocator, b: NavigationLocator): boolean {
  if (a.kind !== "address" || b.kind !== "address") return false;
  return (a.segment ?? null) === (b.segment ?? null) && (a.fullView ?? true) === (b.fullView ?? true);
}

/** How long a restore waits for a document's view to mount and register its API. */
export const REVEAL_API_TIMEOUT_MS = 5000;

/**
 * Waits for the document's view to mount and register its API, then reveals the locator.
 *
 * Polls the API itself rather than `IDocumentHubService.waitOpen`: that resolves to the document from
 * the project's file cache, which never holds these views — the live panels and memory dumps are not
 * project files — so it answered "not open" for a document that was open and ready.
 */
export async function revealWhenMounted(
  hub: IDocumentHubService,
  documentId: string,
  locator: NavigationLocator,
  timeoutMs = REVEAL_API_TIMEOUT_MS
): Promise<boolean> {
  const step = 50;
  for (let waited = 0; ; waited += step) {
    const api = hub.isOpen(documentId) ? hub.getDocumentApi(documentId) : undefined;
    if (api?.revealLocator) {
      api.revealLocator(locator);
      return true;
    }
    if (waited >= timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, step));
  }
}

type LivePanelOptions = {
  documentId: string;
  /** The IDE command that opens (or activates) the panel in the active document area. */
  showCommand: string;
  nearBytes: number;
  /** The location a panel that is not mounted was left at, from its saved view state. */
  fromViewState: (viewState: any) => NavigationLocator;
};

function createLivePanelAdapter(options: LivePanelOptions): DocumentNavigationAdapter {
  return {
    capture(document, hub) {
      return options.fromViewState(hub.getDocumentViewState(document.id) ?? {});
    },

    isNear(a, b) {
      const x = addressOf(a);
      const y = addressOf(b);
      if (x === undefined || y === undefined || !sameSegmentView(a, b)) return false;
      return Math.abs(x - y) < options.nearBytes;
    },

    async restore(entry, hub, services) {
      if (entry.locator.kind !== "address") return false;
      const { projectService, ideCommandsService } = services;
      if (projectService.getActiveDocumentHubService() !== hub) {
        projectService.setActiveDocumentHubService(hub);
      }
      const result = await ideCommandsService.executeCommand(options.showCommand);
      if (!result?.success) return false;
      return await revealWhenMounted(hub, options.documentId, entry.locator);
    },

    describe(entry) {
      const locator = entry.locator;
      if (locator.kind !== "address") return "";
      const segment =
        locator.fullView === false && locator.segment !== undefined && locator.segment !== null
          ? ` · segment ${locator.segment}`
          : "";
      return `${hex4(locator.address)}${segment}`;
    }
  };
}

export const memoryNavigationAdapter = createLivePanelAdapter({
  documentId: MEMORY_PANEL_ID,
  showCommand: "show-memory",
  nearBytes: MEMORY_NEAR_BYTES,
  fromViewState: (vs) => ({
    kind: "address",
    address: (vs.topIndex ?? 0) * getBytesPerRow(resolveViewMode(vs.viewMode, vs.twoColumns)),
    segment: vs.currentSegment ?? null,
    fullView: vs.isFullView ?? true,
    viewMode: "memory"
  })
});

export const disassemblyNavigationAdapter = createLivePanelAdapter({
  documentId: DISASSEMBLY_PANEL_ID,
  showCommand: "show-disass",
  nearBytes: DISASSEMBLY_NEAR_BYTES,
  fromViewState: (vs) => ({
    kind: "address",
    address: vs.topAddress ?? 0,
    segment: vs.currentSegment ?? 0,
    fullView: vs.isFullView ?? true,
    viewMode: "disassembly"
  })
});

/** What reopening a closed dump needs from the component module that owns it. */
export type StaticDumpNavigationDeps = {
  openStaticMemoryDump: (
    hub: IDocumentHubService,
    dumpId: string,
    title: string,
    contents: Uint8Array,
    options: {
      disassemblyEnabled?: boolean;
      disassOffset?: number;
      viewMode?: "memory" | "disassembly";
      nexAnnotationPath?: string;
      nexAnnotationBank?: number;
      topAddress?: number;
    }
  ) => Promise<void>;
  readNexBankBytes: (
    path: string,
    bank: number,
    readFile: (path: string) => Promise<Uint8Array>
  ) => Promise<Uint8Array | undefined>;
};

/** The NEX file and bank a bank document was opened for, from its id. */
export function parseNexBankDocumentId(
  documentId: string
): { path: string; bank: number } | undefined {
  const match = NEX_BANK_DOCUMENT_ID.exec(documentId);
  return match ? { path: match[1], bank: Number(match[2]) } : undefined;
}

/**
 * Static memory dumps. Any open dump can be returned to; a *closed* one only when it is a NEX bank,
 * because that is the one kind whose bytes can be read back — from the `.nex` file its id names.
 */
export function createStaticDumpNavigationAdapter(
  deps: StaticDumpNavigationDeps
): DocumentNavigationAdapter {
  return {
    capture(document, hub) {
      const vs = hub.getDocumentViewState(document.id) ?? {};
      return {
        kind: "address",
        address: vs.topAddress ?? vs.disassOffset ?? 0,
        viewMode: vs.viewMode,
        base: vs.disassOffset
      };
    },

    isNear(a, b) {
      const x = addressOf(a);
      const y = addressOf(b);
      return x !== undefined && y !== undefined && Math.abs(x - y) < DUMP_NEAR_BYTES;
    },

    async restore(entry, hub, services, env) {
      const locator = entry.locator;
      if (locator.kind !== "address") return false;
      const { projectService } = services;
      const target =
        hub.isOpen(entry.documentId)
          ? hub
          : (projectService.getDocumentHubServiceInstances().find((h) => h.isOpen(entry.documentId)) ??
            hub);
      if (projectService.getActiveDocumentHubService() !== target) {
        projectService.setActiveDocumentHubService(target);
      }

      if (target.isOpen(entry.documentId)) {
        // --- A view that is not mounted reads its view state when it mounts: point that at the
        // --- location first, then ask whichever view does mount to go there.
        const current = target.getDocumentViewState(entry.documentId) ?? {};
        target.setDocumentViewState(entry.documentId, {
          ...current,
          topAddress: locator.address,
          ...(locator.viewMode ? { viewMode: locator.viewMode } : {})
        });
        await target.setActiveDocument(entry.documentId);
        return await revealWhenMounted(target, entry.documentId, locator);
      }

      const nexBank = parseNexBankDocumentId(entry.documentId);
      if (!nexBank) return false;
      let contents: Uint8Array | undefined;
      try {
        contents = await deps.readNexBankBytes(nexBank.path, nexBank.bank, env.readBinaryFile);
      } catch {
        return false;
      }
      if (!contents) return false;

      await deps.openStaticMemoryDump(
        target,
        nexBankDumpId(nexBank.path, nexBank.bank),
        nexBankDumpTitle(nexBank.path, nexBank.bank, env.store.getState()?.project?.folderPath),
        contents,
        {
          disassemblyEnabled: true,
          disassOffset: locator.base ?? 0,
          nexAnnotationPath: getNexAnnotationPath(nexBank.path),
          nexAnnotationBank: nexBank.bank,
          topAddress: locator.address,
          viewMode: locator.viewMode
        }
      );
      return true;
    },

    describe(entry: NavigationEntry) {
      const locator = entry.locator;
      if (locator.kind !== "address") return "";
      return `${hex4(locator.address)}${locator.viewMode ? ` · ${locator.viewMode}` : ""}`;
    }
  };
}
