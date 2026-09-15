import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";

import {
  countLabelReferences,
  getAlternativeRegionType,
  getRegionTypeForSpan,
  listLabelsForBank,
  withBankSettings,
  withClearedRowAnnotations,
  withEndOfLineComment,
  withLabelChange,
  withOperandLabel,
  withRegion,
  withSynopsisComment,
  type NexLabelListEntry
} from "../nexAnnotationEdits";
import {
  getBankAnnotation,
  NEX_BANK_LAST_OFFSET,
  type NexAnnotationLabelScope,
  type NexAnnotationRegionType,
  type NexFileAnnotations
} from "../nexAnnotations";
import type { NexLabelDialogLabel } from "../NexLabelDialog";

import type { NexAnnotationEditorIntent } from "./NexAnnotationEditorIntents";
import {
  actionRange,
  initialState,
  selectedRange,
  offsetIndexOf,
  reduce,
  type NexAnnotationEditorEnvironment,
  type NexAnnotationEditorEvent,
  type NexAnnotationEditorState
} from "./NexAnnotationEditorModel";
import type { NexAnnotationEditorPorts } from "./NexAnnotationEditorPorts";
import {
  actionOffsetSpan,
  deleteLabelConfirmRequest,
  discardConfirmMessage,
  selectViewModel,
  WHOLE_BANK_CONFIRM_MESSAGE,
  type NexAnnotationEditorViewModel
} from "./NexAnnotationEditorViewModel";

/**
 * Orchestrates NEX annotation editing: user intents in, port calls out, events into the pure
 * reducer.
 *
 * It has no React and no DOM, so a test drives every flow — including the dialogs and their
 * confirmations — by dispatching intents against fakes.
 *
 * Two things shape almost every handler here:
 *
 * - **Annotations live in a shared session, not in this controller.** An edit is computed as a pure
 *   transform (`nexAnnotationEdits.ts`) and *published*; the session then broadcasts it back, and
 *   the resulting snapshot is what updates state. So a handler ends at `session.update`, never by
 *   emitting the new model itself. That is what keeps two popped-out banks of one NEX in agreement.
 * - **A transform returning `undefined` means "nothing changed".** Publishing anyway would mark the
 *   sidecar dirty for an edit that did nothing, so every handler checks.
 */
export class NexAnnotationEditorController extends UiController<
  NexAnnotationEditorState,
  NexAnnotationEditorIntent,
  NexAnnotationEditorEvent,
  NexAnnotationEditorViewModel
> {
  private unsubscribeSession?: () => void;
  private lastReportedDirty = false;

  constructor(
    private readonly ports: NexAnnotationEditorPorts,
    env: NexAnnotationEditorEnvironment
  ) {
    super(initialState(env), reduce, selectViewModel);
  }

  protected async handle(intent: NexAnnotationEditorIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        this.watchSession();
        return;

      case "listingChanged":
        this.emit({ type: "listingSettled", items: intent.items });
        return;

      case "environmentChanged": {
        const before = this.state.env;
        this.emit({ type: "envReplaced", env: intent.env });
        const after = this.state.env;
        if (after === before) return;

        // --- A different sidecar or bank is a different subject: re-subscribe before anything else
        // --- so the snapshot that arrives belongs to the new one.
        if (
          before.annotationPath !== after.annotationPath ||
          before.bank !== after.bank
        ) {
          this.watchSession();
          return;
        }

        // --- The display settings the sidecar remembers. Persisting them here rather than from
        // --- their own intents means it cannot be forgotten when a new control is added, and
        // --- costs nothing on the way in: settings that came *from* the sidecar compare equal, so
        // --- `withBankSettings` reports no change and nothing is published.
        this.persistBankSettings();
        return;
      }

      case "rowSelected": {
        const anchorIndex =
          intent.extend && this.state.selection
            ? this.state.selection.anchorIndex
            : intent.index;
        this.emit({
          type: "selectionChanged",
          selection: { anchorIndex, activeIndex: intent.index }
        });
        return;
      }

      case "selectionMoved": {
        const rowCount = this.state.items.length;
        if (rowCount === 0) return;
        const from = this.state.selection?.activeIndex ?? 0;
        const to = Math.max(0, Math.min(rowCount - 1, from + intent.delta));
        const anchorIndex =
          intent.extend && this.state.selection ? this.state.selection.anchorIndex : to;
        this.emit({ type: "selectionChanged", selection: { anchorIndex, activeIndex: to } });
        return;
      }

      case "selectionCleared":
        this.emit({ type: "selectionCleared" });
        return;

      case "contextMenuRequested": {
        const range = selectedRange(this.state);
        const inSelection =
          !!range && intent.rowIndex >= range.start && intent.rowIndex <= range.end;
        this.emit({
          type: "contextTargetChanged",
          target: { rowIndex: intent.rowIndex, isRange: inSelection }
        });
        if (!inSelection) {
          // --- Re-anchor, so the highlight names what the action will change.
          this.emit({
            type: "selectionChanged",
            selection: { anchorIndex: intent.rowIndex, activeIndex: intent.rowIndex }
          });
        }
        return;
      }

      case "toolbarMenuRequested": {
        const activeIndex = this.state.selection?.activeIndex;
        if (activeIndex === undefined) return;
        const range = selectedRange(this.state);
        this.emit({
          type: "contextTargetChanged",
          target: { rowIndex: activeIndex, isRange: !!range && range.start !== range.end }
        });
        return;
      }

      case "saveRequested":
        await this.save();
        return;

      case "synopsisCommentRequested":
        await this.editComment(intent.rowIndex, "synopsis");
        return;

      case "endOfLineCommentRequested":
        await this.editComment(intent.rowIndex, "comment");
        return;

      case "labelRequested":
        await this.openLabelForRow(intent.scope, intent.rowIndex);
        return;

      case "manageLabelsRequested":
        await this.manageLabels();
        return;

      case "operandLabelRequested":
        await this.assignOperandLabel(intent.rowIndex);
        return;

      case "regionRequested":
        await this.editRegionForAction(intent.rowIndex);
        return;

      case "manageRegionsRequested":
        await this.manageRegions();
        return;

      case "regionTypeMarked":
        await this.markRegion(intent.regionType, intent.rowIndex);
        return;

      case "rowAnnotationsCleared":
        this.clearRowAnnotations(intent.rowIndex);
        return;
    }
  }

  // ─── The shared session ────────────────────────────────────────────────────

  /**
   * Subscribe to the session for the current sidecar, replacing any earlier subscription.
   *
   * The session reports its current snapshot on subscribe, so there is no "unknown yet" state to
   * model. Every snapshot regenerates the listing, because an edit published by *this* editor and
   * one published by a sibling bank arrive the same way.
   */
  private watchSession(): void {
    this.unsubscribeSession?.();
    this.unsubscribeSession = undefined;

    const { annotationPath, bank } = this.state.env;
    if (!annotationPath || bank === undefined) return;

    this.unsubscribeSession = this.ports.session.subscribe(annotationPath, bank, (snapshot) => {
      const before = this.state;
      this.emit({ type: "sessionSnapshotReceived", snapshot });
      if (this.state === before) return;

      this.reportDirty();
    });
  }

  /** Tell the outside world about a change in the dirty flag, and only about a change. */
  private reportDirty(): void {
    if (this.state.dirty === this.lastReportedDirty) return;
    this.lastReportedDirty = this.state.dirty;
    this.ports.dirtyChanged(this.state.dirty);
  }

  private async save(): Promise<void> {
    const { annotationPath } = this.state.env;
    if (!annotationPath || !this.state.annotations) return;

    this.emit({ type: "saveStarted" });
    try {
      await this.ports.session.save(annotationPath);
      this.emit({ type: "saveSettled" });
    } catch (error) {
      // --- Nothing was written, so the edits stay dirty with the reason on show.
      this.emit({ type: "saveSettled", error: messageOf(error) });
    }
  }

  /** Publish an edited model, or do nothing when the transform reported no change. */
  private publish(next: NexFileAnnotations | undefined): boolean {
    const { annotationPath } = this.state.env;
    if (!next || !annotationPath) return false;
    this.ports.session.update(annotationPath, next);
    return true;
  }

  // ─── Per-bank settings ─────────────────────────────────────────────────────

  private persistBankSettings(): void {
    const { annotations, env } = this.state;
    if (!annotations || env.bank === undefined) return;
    const offsetIndex = offsetIndexOf(this.state);
    this.publish(
      withBankSettings(annotations, env.bank, {
        lastView: env.viewMode,
        decimalView: env.decimalView,
        ...(offsetIndex !== undefined ? { offsetIndex } : {})
      })
    );
  }

  // ─── Comments ──────────────────────────────────────────────────────────────

  private async editComment(
    rowIndex: number | undefined,
    kind: "synopsis" | "comment"
  ): Promise<void> {
    const site = this.editSite(rowIndex);
    if (!site) return;
    const { annotations, bank, offsetStart } = site;

    const existing = getBankAnnotation(annotations, bank)?.lineAnnotations?.[String(offsetStart)];

    const row = this.rowAt(rowIndex);
    if (kind === "synopsis") {
      const result = await this.ports.dialogs.synopsisComment({
        bank,
        bankOffset: offsetStart,
        effectiveAddress: (site.env.disassOffset + offsetStart) & 0xffff,
        initialSynopsis: existing?.synopsis
      });
      // --- Dismissed: a question nobody answered changes nothing.
      if (!result) return;
      const current = this.state.annotations;
      if (current) {
        this.publish(withSynopsisComment(current, bank, offsetStart, result.synopsis));
      }
      return;
    }

    const result = await this.ports.dialogs.endOfLineComment({
      bank,
      bankOffset: offsetStart,
      effectiveAddress: (site.env.disassOffset + offsetStart) & 0xffff,
      instruction: row?.instruction ?? "",
      generatedHardComment: row?.annotation?.generatedHardComment,
      initialComment: existing?.comment
    });
    if (!result) return;
    const current = this.state.annotations;
    if (current) {
      this.publish(withEndOfLineComment(current, bank, offsetStart, result.comment));
    }
  }

  // ─── Labels ────────────────────────────────────────────────────────────────

  private async openLabelForRow(
    scope: NexAnnotationLabelScope,
    rowIndex: number | undefined
  ): Promise<void> {
    const site = this.editSite(rowIndex);
    if (!site) return;
    await this.openLabelDialog(
      scope,
      (site.env.disassOffset + site.offsetStart) & 0xffff,
      site.offsetStart
    );
  }

  /**
   * The label dialog, opened on a scope and the two values that scope could mean.
   *
   * A global label names a 16-bit address and a local one a bank-relative offset, so the dialog is
   * handed both and shows whichever its scope switch is on.
   */
  private async openLabelDialog(
    initialScope: NexAnnotationLabelScope,
    initialGlobalValue: number,
    initialLocalValue: number
  ): Promise<void> {
    const { annotations, env } = this.state;
    if (!annotations || env.bank === undefined) return;

    const result = await this.ports.dialogs.label({
      bank: env.bank,
      initialScope,
      initialGlobalValue,
      initialLocalValue,
      labels: this.labelList()
    });
    if (!result) return;
    await this.applyLabelResult(result);
  }

  private async applyLabelResult(result: {
    action: "save" | "delete";
    scope: NexAnnotationLabelScope;
    name: string;
    value: number;
    originalLabel?: NexLabelDialogLabel;
  }): Promise<void> {
    const { annotations, env } = this.state;
    if (!annotations || env.bank === undefined) return;
    if (result.action === "delete" && !result.originalLabel) return;

    if (result.action === "delete") {
      const referenceCount = countLabelReferences(
        annotations,
        env.bank,
        result.scope,
        result.name
      );
      const confirmed = await this.ports.confirm.confirm(
        deleteLabelConfirmRequest({
          scope: result.scope,
          name: result.name,
          referenceCount
        })
      );
      if (!confirmed) return;
    }

    // --- Re-read: the confirmation is asynchronous, and a sibling bank may have published while it
    // --- was open.
    const current = this.state.annotations;
    if (!current) return;
    this.publish(
      withLabelChange(current, env.bank, {
        action: result.action,
        scope: result.scope,
        name: result.name,
        value: result.value,
        originalLabel: result.originalLabel as NexLabelListEntry | undefined
      })
    );
  }

  private labelList(): NexLabelDialogLabel[] {
    const { annotations, env } = this.state;
    if (!annotations || env.bank === undefined) return [];
    return listLabelsForBank(annotations, env.bank) as NexLabelDialogLabel[];
  }

  private async manageLabels(): Promise<void> {
    const { annotations, env } = this.state;
    if (!annotations || env.bank === undefined) return;
    const bank = env.bank;

    // --- Derived on every call, not captured: each action publishes new annotations, and the list
    // --- the dialog shows next has to come from those.
    const labels = () => this.labelList();

    const result = await this.ports.dialogs.manageLabels({
      bank,
      bankAddressOffset: env.disassOffset,
      labels: labels(),
      onAddLabel: async (scope) => {
        const activeIndex = this.state.selection?.activeIndex;
        const bankOffset =
          activeIndex !== undefined
            ? this.state.items[activeIndex]?.annotation?.bankOffset ?? 0
            : 0;
        await this.openLabelDialog(
          scope,
          (this.state.env.disassOffset + bankOffset) & 0xffff,
          bankOffset
        );
        return labels();
      },
      onEditLabel: async (label) => {
        await this.openLabelDialog(
          label.scope,
          label.scope === "global"
            ? label.value
            : (this.state.env.disassOffset + label.value) & 0xffff,
          label.scope === "local" ? label.value : label.value & NEX_BANK_LAST_OFFSET
        );
        return labels();
      },
      onDeleteLabel: async (label) => {
        await this.applyLabelResult({
          action: "delete",
          scope: label.scope,
          name: label.name,
          value: label.value,
          originalLabel: label
        });
        return labels();
      }
    });

    // --- Go To is the one action that closes the list: it scrolls the listing underneath, and a
    // --- list left open would cover the row it moved to.
    if (result?.action === "go-to") {
      const address =
        result.label.scope === "local"
          ? (this.state.env.disassOffset + result.label.value) & 0xffff
          : result.label.value;
      this.ports.navigateToAddress(address);
    }
  }

  // ─── Operand labels ────────────────────────────────────────────────────────

  private async assignOperandLabel(rowIndex: number | undefined): Promise<void> {
    const site = this.editSite(rowIndex);
    if (!site) return;

    const row = this.rowAt(rowIndex);
    const result = await this.ports.dialogs.operandLabel({
      bank: site.bank,
      bankAddressOffset: site.env.disassOffset,
      instruction: row?.instruction ?? "",
      operands: row?.operandCandidates ?? [],
      explicitReferences:
        getBankAnnotation(site.annotations, site.bank)?.operandReferences?.[
          String(site.offsetStart)
        ],
      labels: this.labelList()
    });
    if (!result) return;

    const current = this.state.annotations;
    if (!current) return;
    // --- `clear` names no label, so the scope and name are only read for the other two actions.
    const change =
      result.action === "clear"
        ? { action: "clear" as const, operandIndex: result.operandIndex, scope: "local" as const, name: "", value: 0 }
        : {
            action: result.action,
            operandIndex: result.operandIndex,
            scope: result.scope,
            name: result.name,
            value: result.action === "create-label" ? result.value : 0
          };
    this.publish(withOperandLabel(current, site.bank, site.offsetStart, change));
  }

  // ─── Regions ───────────────────────────────────────────────────────────────

  private async editRegionForAction(rowIndex: number | undefined): Promise<void> {
    const span = actionOffsetSpan(this.state, rowIndex);
    if (!span) return;
    const result = await this.openRegionDialog(
      span.start,
      span.end,
      this.regionTypeAt(span.start, span.end)
    );
    if (!result) return;
    this.applyRegionResult(result.start, result.end, result.type);
  }

  /** The one-gesture "Mark As ..." actions, which skip the region dialog. */
  private async markRegion(
    regionType: NexAnnotationRegionType,
    rowIndex: number | undefined
  ): Promise<void> {
    const span = actionOffsetSpan(this.state, rowIndex);
    if (!span) return;
    const result = await this.openRegionDialog(span.start, span.end, regionType);
    if (!result) return;
    // --- The dialog may widen or narrow the span the gesture proposed; its answer wins, but the
    // --- type the gesture asked for is the one applied when the dialog does not change it.
    this.applyRegionResult(result.start, result.end, result.type ?? regionType);
  }

  private applyRegionResult(start: number, end: number, type: NexAnnotationRegionType): void {
    const { annotations, env } = this.state;
    if (!annotations || env.bank === undefined) return;

    // --- Rewriting the entire bank is easy to do by accident from a range selection, and there is
    // --- no undo.
    if (start === 0 && end === NEX_BANK_LAST_OFFSET) {
      if (!this.ports.nativeConfirm(WHOLE_BANK_CONFIRM_MESSAGE)) return;
    }

    if (this.publish(withRegion(annotations, env.bank, start, end, type))) {
      // --- The listing is about to change shape, so the selection it was made against is stale.
      this.emit({ type: "selectionCleared" });
    }
  }

  private async manageRegions(): Promise<void> {
    const { annotations, env } = this.state;
    if (!annotations || env.bank === undefined) return;
    const bankAnnotation = getBankAnnotation(annotations, env.bank);
    if (!bankAnnotation) return;

    const activeIndex = this.state.contextTarget?.rowIndex ?? this.state.selection?.activeIndex;
    const activeItem = activeIndex !== undefined ? this.state.items[activeIndex] : undefined;
    const activeOffset = activeItem?.annotation?.bankOffset;
    if (activeOffset === undefined) return;
    const activeLength = Math.max(1, activeItem?.annotation?.byteLength ?? 1);

    const result = await this.ports.dialogs.manageRegions({
      activeOffset,
      bytes: this.ports.bankBytes(),
      regions: bankAnnotation.regions
    });
    if (!result) return;

    switch (result.action) {
      case "go-to":
        this.ports.navigateToAddress((this.state.env.disassOffset + result.region.start) & 0xffff);
        return;

      case "edit":
        await this.openRegionDialogFor(result.region.start, result.region.end, result.region.type);
        return;

      case "split": {
        // --- Split at the active row when it falls inside the region, otherwise at its start.
        const splitStart =
          activeOffset >= result.region.start && activeOffset <= result.region.end
            ? activeOffset
            : result.region.start;
        const splitEnd = Math.min(result.region.end, splitStart + activeLength - 1);
        await this.openRegionDialogFor(
          splitStart,
          splitEnd,
          getAlternativeRegionType(result.region.type)
        );
        return;
      }

      case "add":
        await this.openRegionDialogFor(
          activeOffset,
          Math.min(NEX_BANK_LAST_OFFSET, activeOffset + activeLength - 1),
          getAlternativeRegionType(
            getRegionTypeForSpan(bankAnnotation.regions, activeOffset, activeOffset)
          )
        );
        return;

      default:
        // --- "revert": put the region back to plain disassembly.
        this.applyRegionResult(result.region.start, result.region.end, "disassemble");
        return;
    }
  }

  private async openRegionDialogFor(
    start: number,
    end: number,
    type: NexAnnotationRegionType
  ): Promise<void> {
    const result = await this.openRegionDialog(start, end, type);
    if (!result) return;
    this.applyRegionResult(result.start, result.end, result.type ?? type);
  }

  /** The region dialog, with the bank's own regions and bytes it renders a preview from. */
  private async openRegionDialog(
    initialStart: number,
    initialEnd: number,
    initialType: NexAnnotationRegionType
  ) {
    const { annotations, env } = this.state;
    const regions =
      annotations && env.bank !== undefined
        ? getBankAnnotation(annotations, env.bank)?.regions ?? []
        : [];
    return this.ports.dialogs.region({
      initialType,
      initialStart,
      initialEnd,
      regions,
      bytes: this.ports.bankBytes()
    });
  }

  /** The type a span already has, which is what the region dialog should open on. */
  private regionTypeAt(start: number, end: number): NexAnnotationRegionType {
    const { annotations, env } = this.state;
    if (!annotations || env.bank === undefined) return "disassemble";
    const regions = getBankAnnotation(annotations, env.bank)?.regions ?? [];
    return getRegionTypeForSpan(regions, start, end);
  }

  /** The listing row a gesture named, or the selection's active row. */
  private rowAt(rowIndex: number | undefined) {
    const index = rowIndex ?? this.state.contextTarget?.rowIndex ?? this.state.selection?.activeIndex;
    return index === undefined ? undefined : this.state.items[index];
  }

  // ─── Clearing ──────────────────────────────────────────────────────────────

  private clearRowAnnotations(rowIndex: number | undefined): void {
    const span = actionOffsetSpan(this.state, rowIndex);
    const { annotations, env } = this.state;
    if (!span || !annotations || env.bank === undefined) return;

    this.publish(withClearedRowAnnotations(annotations, env.bank, span.start, span.end));
    // --- Cleared or not, the gesture is finished with the selection.
    this.emit({ type: "selectionCleared" });
  }

  // ─── Closing ───────────────────────────────────────────────────────────────

  /**
   * May the document be closed?
   *
   * A method rather than an intent because the caller needs the answer: the document hub refuses the
   * close when this returns false.
   */
  async confirmDisposal(): Promise<boolean> {
    if (!this.state.dirty) return true;
    return this.ports.nativeConfirm(discardConfirmMessage(this.state));
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * The rows an action applies to, resolved once so every handler agrees.
   *
   * `undefined` when there is nothing to act on — no annotations, no bank, or no row.
   */
  private editSite(rowIndex: number | undefined):
    | {
        annotations: NexFileAnnotations;
        bank: number;
        env: NexAnnotationEditorEnvironment;
        offsetStart: number;
        offsetEnd: number;
      }
    | undefined {
    const { annotations, env } = this.state;
    if (!annotations || env.bank === undefined) return undefined;
    if (!actionRange(this.state, rowIndex)) return undefined;
    const span = actionOffsetSpan(this.state, rowIndex);
    if (!span) return undefined;
    return {
      annotations,
      bank: env.bank,
      env,
      offsetStart: span.start,
      offsetEnd: span.end
    };
  }

  activate(): void {
    super.activate();
    // --- `activate` is the other half of `dispose`: React tears an effect down and re-runs it,
    // --- always under StrictMode. Without re-subscribing here the editor would come back alive but
    // --- deaf to the session. See trap 1 in `.ai/ui-mvc-guide.md`.
    this.watchSession();
  }

  dispose(): void {
    this.unsubscribeSession?.();
    this.unsubscribeSession = undefined;
    super.dispose();
  }
}
