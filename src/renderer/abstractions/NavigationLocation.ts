/*
 * Locations the navigation history (Go Back / Go Forward) records.
 *
 * See `.plans/NAVIGATION_HISTORY_PLAN.md` §3.1.
 */

/**
 * Where inside a document a location points. The document type's navigation adapter decides which
 * kind it produces and how two of them compare.
 */
export type NavigationLocator =
  /** A position in a text document; both 1-based, as Monaco reports them. */
  | { kind: "text"; line: number; column: number }
  /** An address in a memory-like view (Memory, Disassembly, NEX bank dumps). */
  | {
      kind: "address";
      address: number;
      /** The bank/partition shown, in views that page one in; null or absent for the default. */
      segment?: number | null;
      /** Whether the view showed the whole 64K address space rather than one segment. */
      fullView?: boolean;
      /** Which listing a view that has both was showing. */
      viewMode?: "memory" | "disassembly";
      /** Where byte 0 of a bank dump is seen (its disassembly offset), for reopening it. */
      base?: number;
    }
  /** The document takes part, but has no finer position than "this document". */
  | { kind: "document" };

/**
 * Why a location was recorded. Shown in the history list; `tabSwitch` and `explorer` are also the
 * reasons the "record tab switches" setting can silence.
 */
export type NavigationReason =
  | "definition"
  | "outputLink"
  | "breakpoint"
  | "memoryGoTo"
  | "disassemblyGoTo"
  | "nexLabel"
  | "nexBank"
  | "tabSwitch"
  | "explorer"
  | "command";

/** Every reason, for validating the `nav -r <reason>` option. */
export const NAVIGATION_REASONS: readonly NavigationReason[] = [
  "definition",
  "outputLink",
  "breakpoint",
  "memoryGoTo",
  "disassemblyGoTo",
  "nexLabel",
  "nexBank",
  "tabSwitch",
  "explorer",
  "command"
];

/** A recorded location. */
export type NavigationEntry = {
  /** The document id: a file's full path, or a special id such as `$memory`. */
  documentId: string;
  /** `ProjectDocumentState.type` — selects the navigation adapter on restore. */
  documentType: string;
  /** The tab title when the location was captured, for the history list. */
  title: string;
  iconName?: string;
  /**
   * The document area the location was seen in. Only a hint for where to restore it: the area may
   * be gone, and hub ids are reused.
   */
  hubId?: number;
  locator: NavigationLocator;
  reason: NavigationReason;
  /** `Date.now()` at capture. */
  time: number;
};
