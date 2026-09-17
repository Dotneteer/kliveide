import type { ConfirmPort } from "@mvc/dialogs/DialogPorts";
import type {
  DisassemblyOperandInfo
} from "@renderer/appIde/disassemblers/common-types";

import type {
  NexAnnotationBankView,
  NexAnnotationRegion,
  NexAnnotationRegionType,
  NexFileAnnotations,
  NexOperandReference
} from "../nexAnnotations";
import type { NexSynopsisCommentDialogResult } from "../NexSynopsisCommentDialog";
import type { NexBankCommentDialogResult } from "../NexBankCommentDialog";
import type { NexEndOfLineCommentDialogResult } from "../NexEndOfLineCommentDialog";
import type { NexLabelDialogLabel, NexLabelDialogResult } from "../NexLabelDialog";
import type { NexLabelsDialogResult } from "../NexLabelsDialog";
import type { NexOperandLabelDialogResult } from "../NexOperandLabelDialog";
import type { NexRegionDialogResult } from "../NexRegionDialog";
import type { NexRegionsDialogResult } from "../NexRegionsDialog";

/**
 * Everything outside the annotation editor that its controller may touch.
 *
 * This is the seam the tests fake, and the reason the editor's whole behaviour can be driven with no
 * React, no DOM and no module mocking. Three groups:
 *
 * - **`session`** — the process-wide annotation session keyed by sidecar path. It is shared, because
 *   two popped-out banks of the same NEX must not keep divergent copies of one file.
 * - **`dialogs`** — one method per NEX annotation dialog. Each resolves `undefined` when dismissed,
 *   which is a decision ("nothing to apply"), not a missing answer to retry.
 * - **`listing`** — generating the annotated disassembly, which is asynchronous and therefore a port
 *   rather than a pure selector.
 */

/** A snapshot of the shared session, as the editor observes it. */
export type NexAnnotationSessionSnapshot = {
  annotations?: NexFileAnnotations;
  dirty: boolean;
  loading: boolean;
  loadError?: string;
  saveError?: string;
};

export type NexAnnotationSessionPort = {
  /**
   * Watch the session for one sidecar. The returned function stops watching.
   *
   * The listener fires with the current snapshot on subscribe, so the editor never has to model an
   * "unknown yet" state that the session can answer immediately.
   */
  subscribe(
    annotationPath: string,
    bank: number,
    listener: (snapshot: NexAnnotationSessionSnapshot) => void
  ): () => void;

  /**
   * Publish an edited model. Every subscriber of that sidecar sees it, and the session writes it.
   *
   * Not awaited, and returns nothing: there is no Save, so an edit is finished the moment it is
   * published. A write that fails comes back through the next snapshot's `saveError`.
   */
  update(annotationPath: string, annotations: NexFileAnnotations): void;
};

/** The row a dialog is being opened for, resolved from an index before the port is called. */
export type NexAnnotationRowContext = {
  bankOffset: number;
  byteLength: number;
};

export type NexAnnotationDialogsPort = {
  bankComment(args: {
    bank: number;
    initialComment?: string;
  }): Promise<NexBankCommentDialogResult | undefined>;

  synopsisComment(args: {
    bank: number;
    bankOffset: number;
    effectiveAddress: number;
    initialSynopsis?: string;
  }): Promise<NexSynopsisCommentDialogResult | undefined>;

  endOfLineComment(args: {
    bank: number;
    bankOffset: number;
    effectiveAddress: number;
    instruction: string;
    generatedHardComment?: string;
    initialComment?: string;
  }): Promise<NexEndOfLineCommentDialogResult | undefined>;

  label(args: {
    bank: number;
    initialScope: "global" | "local";
    initialGlobalValue: number;
    initialLocalValue: number;
    labels: NexLabelDialogLabel[];
  }): Promise<NexLabelDialogResult | undefined>;

  /**
   * The Labels list, which **stays open while you work in it**.
   *
   * Adding, editing and deleting run as callbacks while the list is still mounted, each returning
   * the refreshed list — so the row being changed stays visible behind the dialog asking about it,
   * and the list is still there afterwards. That is why this port takes callbacks rather than
   * resolving once: the interaction is a session, not a question. Only "Go To" resolves, because it
   * scrolls the listing underneath and a list left open would cover the row it moved to.
   */
  manageLabels(args: {
    bank: number;
    bankAddressOffset: number;
    labels: NexLabelDialogLabel[];
    onAddLabel: (scope: "global" | "local") => Promise<NexLabelDialogLabel[]>;
    onEditLabel: (label: NexLabelDialogLabel) => Promise<NexLabelDialogLabel[]>;
    onDeleteLabel: (label: NexLabelDialogLabel) => Promise<NexLabelDialogLabel[]>;
  }): Promise<NexLabelsDialogResult | undefined>;

  operandLabel(args: {
    bank: number;
    bankAddressOffset: number;
    instruction: string;
    operands: DisassemblyOperandInfo[];
    explicitReferences?: NexOperandReference[];
    labels: NexLabelDialogLabel[];
  }): Promise<NexOperandLabelDialogResult | undefined>;

  region(args: {
    initialType: NexAnnotationRegionType;
    initialStart: number;
    initialEnd: number;
    regions: NexAnnotationRegion[];
    bytes: number[];
  }): Promise<NexRegionDialogResult | undefined>;

  manageRegions(args: {
    activeOffset: number;
    /** The bank's bytes, which the list renders a preview of. */
    bytes: number[];
    regions: NexAnnotationRegion[];
  }): Promise<NexRegionsDialogResult | undefined>;
};

export type NexAnnotationEditorPorts = {
  session: NexAnnotationSessionPort;
  dialogs: NexAnnotationDialogsPort;
  confirm: ConfirmPort;
  /**
   * The browser's `window.confirm`, behind a port so the controller stays DOM-free.
   *
   * Two questions still use it — discarding unsaved annotations on close, and rewriting a whole 16K
   * bank — and both are asserted with their exact wording by the existing DOM suite. Routing them
   * through the app's `ConfirmPort` instead would be a *behaviour* change, which a refactor must not
   * smuggle in. Worth doing as its own change: `.docs/dialog-pattern.md` says the app's dialog is the
   * one to use, and the label-delete flow beside them already does.
   */
  nativeConfirm: (message: string) => boolean;
  /** The bank's bytes, read when a dialog needs to preview them. A getter, so state stays small. */
  bankBytes: () => number[];
  /**
   * Scroll the listing to an address.
   *
   * "Go To" in either manage dialog moves the *view*, which the editor does not own — the document's
   * scroll position belongs to the component around it.
   */
  navigateToAddress: (address: number) => void;
  /**
   * Bring the bank holding an address forward, scrolled to it.
   *
   * Only ever called for a definition **outside** the bank on screen — a jump within it is a scroll,
   * which `navigateToAddress` already is. Which bank that address is in depends on how the running
   * program has paged memory, so resolving it needs the live MMU; that lookup, the file read and the
   * document hub all live behind this port so the controller stays free of them.
   *
   * Resolves whether or not it found anything. A definition the machine cannot currently reach —
   * the address is in ROM, or in a bank this NEX does not carry — is a legitimate outcome of
   * following a label, not an error worth interrupting for.
   */
  revealAddressInBank: (address: number) => Promise<void>;
  /**
   * Reports outward that the sidecar could not be written, so the document tab can mark itself
   * unsaved and closing can be refused. A port because "the document" is a renderer service the
   * editor must not know about.
   *
   * **Not** the dirty flag. Annotations are written as they are made, so a document is unsaved only
   * when a write actually failed; reporting the moments between an edit and its write would flicker
   * the tab's mark on every annotation.
   */
  unwrittenChanged: (unwritten: boolean) => void;
};

/** What the view mode control offers, kept here so the view and the model agree on the set. */
export const NEX_BANK_VIEWS: NexAnnotationBankView[] = ["memory", "disassembly"];
