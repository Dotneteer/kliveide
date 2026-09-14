import styles from "./StaticMemoryDump.module.scss";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { STATIC_MEMORY_DUMP_VIEWER } from "@common/state/common-ids";
import { Row } from "@renderer/controls/layout/Row";
import { AddressInput } from "@renderer/controls/AddressInput";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import classnames from "classnames";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { createRowAddresses } from "./memoryViewModel";
import { MemoryDumpSection } from "./MemoryDumpSection";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { PanelHeader } from "@renderer/controls/data";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { useBreakpointDialog } from "@renderer/appIde/dialogs/useBreakpointDialog";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { evaluateBranch, type BranchVerdict } from "@renderer/appIde/DocumentPanels/branchVerdict";
import { useRowSizes } from "@renderer/theming/useRowSizes";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { Text } from "@renderer/controls/layout/Text";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { MemorySection, type DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import { deriveLabelWidthCh, DisassemblyRow } from "@renderer/appIde/DocumentPanels/DisassemblyRow";
import {
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { createAnnotatedNexDisassemblyItems } from "@renderer/appIde/DocumentPanels/Next/nexAnnotatedDisassembly";
import { useNexAnnotationEditor } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/useNexAnnotationEditor";
import {
  formatBankLocation,
  isListedWhereItIsPaged,
  listedBankOffset,
  pcSpotlightAddress
} from "@renderer/appIde/DocumentPanels/Next/nextBankLocation";
import {
  useNexBankLocation,
  useNexBankPcOffset,
  useNexBranchCpuSnapshot,
  useNexLiveBankBytes
} from "@renderer/appIde/DocumentPanels/Next/useNexLiveBank";
import {
  changedFlagsIn,
  diffBankBytes,
  formatBankDiff
} from "@renderer/appIde/DocumentPanels/Next/nexLiveBank";
import {
  useNexBankBreakpoints,
  useNexSidecarBreakpointSync
} from "@renderer/appIde/DocumentPanels/Next/useNexBankBreakpoints";
import type { NexAnnotationEditorEnvironment } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorModel";
import {
  NexAnnotationMenu,
  NexAnnotationToolbar
} from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorView";
import {
  getBankAnnotation,
  getNexBankAddressOffset,
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";

type MemoryDumpViewState = {
  disassemblyEnabled?: boolean;
  viewMode?: StaticDumpViewMode;
  decimalView?: boolean;
  disassOffset?: number;
  twoColumns?: boolean;
  charDump?: boolean;
  scrollPosition?: number;
  disassemblyScrollPosition?: number;
  version?: number;
  topAddress?: number;
  nexAnnotationPath?: string;
  nexAnnotationBank?: number;
};

type StaticDumpViewMode = "memory" | "disassembly";

type StaticMemoryDumpOptions = {
  disassemblyEnabled?: boolean;
  disassOffset?: number;
  decimalView?: boolean;
  viewMode?: StaticDumpViewMode;
  nexAnnotationPath?: string;
  nexAnnotationBank?: number;

  /**
   * Address to bring into view when the document opens, in the listing's own numbering — that is,
   * `disassOffset + <offset into the dump>`, the same numbering the rows and the "Go to address"
   * box use.
   */
  topAddress?: number;
};

const STATIC_DISASSEMBLY_FALLBACK_PAGE_ROWS = 16;

const staticDumpViewModeOptions: DropdownOption[] = [
  { value: "memory", label: "Memory" },
  { value: "disassembly", label: "Disassembly" }
];

function createStaticDisassemblyOffsetOptions(decimalView: boolean): DropdownOption[] {
  return [0x0000, 0x4000, 0x8000, 0xc000].map((offset) => ({
    value: offset.toString(10),
    label: decimalView ? offset.toString(10) : `$${toHexa4(offset)}`
  }));
}

const StaticMemoryDump = ({
  document,
  contents,
  viewState
}: DocumentProps<MemoryDumpViewState>) => {
  const documentHubService = useDocumentHubService();
  // --- M3: the row heights the virtualizer places by, matching `--row-size-*` in the CSS.
  const { memory: dumpRowItemSize, disassembly: disassemblyRowItemSize } = useRowSizes();
  const [currentViewState, setCurrentViewState] = useState<MemoryDumpViewState>(
    viewState ?? {}
  );
  const disassemblyEnabled = currentViewState.disassemblyEnabled ?? false;
  /*
   * A NEX bank opens as a disassembly; anything else opens as a hex dump.
   *
   * A bank of a NEX is a 16K slice of a *program* — the reason to open one is almost always to read
   * the code in it, and for the bank the entry point runs from that is the only reason. A plain dump
   * of some other binary has no such expectation, so the default stays "memory" there.
   *
   * Only the default: a remembered choice in the annotation sidecar still wins (it is applied to the
   * view state further down), so a bank the user last read as hex opens as hex.
   *
   * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.16.
   */
  const isNexBankDocument = currentViewState.nexAnnotationBank !== undefined;
  const viewMode: StaticDumpViewMode = disassemblyEnabled
    ? (currentViewState.viewMode ?? (isNexBankDocument ? "disassembly" : "memory"))
    : "memory";
  const decimalView = currentViewState.decimalView ?? false;
  const disassOffset = currentViewState.disassOffset ?? 0;
  const [memoryJumpAddress, setMemoryJumpAddress] = useState<number>();
  const [disassemblyJumpAddress, setDisassemblyJumpAddress] = useState<number>();
  const [disassemblyItems, setDisassemblyItems] = useState<DisassemblyItem[]>([]);
  const [contextMenuState, contextMenuApi] = useContextMenuState();
  // --- `DisassemblyRow` is memoized, so this is a stable callback rather than a fresh arrow that
  // --- would re-render every row in the listing on every render of this one.
  const openBreakpointDialog = useBreakpointDialog();
  const editBreakpoint = useCallback(
    (bp: BreakpointInfo) => void openBreakpointDialog(bp),
    [openBreakpointDialog]
  );
  const memoryVlApi = useRef<VListHandle>();
  const disassemblyVlApi = useRef<VListHandle>();
  const disassemblyListRef = useRef<HTMLDivElement>(null);
  const pendingScrollPosition = useRef(viewState?.scrollPosition ?? 0);
  const pendingDisassemblyScrollPosition = useRef(viewState?.disassemblyScrollPosition ?? 0);
  const restoredInitialScroll = useRef(false);
  const restoredInitialDisassemblyScroll = useRef(false);
  const items = useMemo(() => createRowAddresses(contents.length, 16), [contents.length]);
  const bankBreakpoints = useNexBankBreakpoints(currentViewState.nexAnnotationBank);
  /*
   * `undefined` — not an empty list — when there is nothing to say: no bank, or a machine that is
   * not a ZX Spectrum Next. "Not paged in" is a claim about a machine's current paging, and making
   * it about a machine that is not running would be worse than saying nothing.
   */
  const bankPlacements = useNexBankLocation(currentViewState.nexAnnotationBank);

  /*
   * File bytes or the machine's, and what differs between them.
   *
   * Deliberately **not** in the document's view state or the annotation sidecar: it is a statement
   * about the machine currently running, not a property of the file. Restoring "Live" into a
   * session with no machine would show a document that silently means something else than it says.
   *
   * `liveBank` is undefined whenever the machine cannot answer, which is what disables the switch —
   * so the control cannot be turned on into a view that has nothing to show.
   */
  const [showLiveBank, setShowLiveBank] = useState(false);
  const liveBank = useNexLiveBankBytes(currentViewState.nexAnnotationBank, showLiveBank);
  const bankDiff = useMemo(() => diffBankBytes(contents, liveBank), [contents, liveBank]);
  /*
   * Whether the switch can be *offered* is answered by the location readout, not by having already
   * fetched the bytes: `bankPlacements` is non-undefined exactly when this is a ZX Spectrum Next
   * with a bank and the machine answered. Waiting for the bytes would mean reading 16K over IPC on
   * every tick of every open bank document just to decide whether to draw a switch.
   */
  const liveBankOffered = bankPlacements !== undefined;
  const liveBankShown = showLiveBank && liveBank !== undefined;
  /*
   * The **memory view** reads this; the disassembly view deliberately does not.
   *
   * Live disassembly would be useful — a bank that decompressed itself is the case this feature
   * exists for — but it cannot be had by swapping the array. The annotation editor owns a listing
   * derived from the file's bytes and addresses its actions by *row index*, and live bytes
   * disassemble to different instruction lengths, so the two listings would drift apart by a row
   * and the row menu would act on a line the user did not click. Annotations describe the file, so
   * the fix is not to feed the editor live bytes either.
   *
   * The live switch therefore shows only in the memory view (see the header), rather than being
   * offered in a view where it would quietly mean something else. See
   * `.plans/NEX_DEBUGGING_PLAN.md` §11.3.
   */
  const bankBytes = liveBankShown ? liveBank : contents;
  /*
   * The program counter's spotlight, when it is in this bank.
   *
   * `disassOffset` is added because the rows are addressed by it — the offset dropdown decides
   * whether this bank's byte 0 reads `$0000` or `$C000`, and `DisassemblyRow` compares its own
   * displayed address against `pausedPc`. So the mark follows the listing's own numbering rather
   * than the machine's, which is also what makes it land correctly when the user has chosen an
   * offset that does not match where the bank actually is.
   *
   * `-1` for "nowhere", matching the prop's existing convention.
   */
  const pcBankOffset = useNexBankPcOffset(bankPlacements);
  const pausedPcRowAddress = pcSpotlightAddress(disassOffset, pcBankOffset);

  /*
   * The branch gutter, for a popped-out NEX bank.
   *
   * Gated on the listing's numbering being *real*, which the Disassembly panel never has to check:
   * this document's offset is a dropdown, so a bank can be listed at an address it is not paged at.
   * The flags would still be genuine, but every destination the gutter resolved would be an address
   * this code is not at — a confident wrong answer, which is the one thing the branch feature is
   * careful never to give (see `BranchUnobtainableReason`). So verdicts appear only while the bank
   * is paged in as one contiguous 16K block at exactly the offset the listing is numbered by, which
   * is what the debugger's own reveal always opens it at.
   *
   * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.19.
   */
  const branchGutterApplies =
    isNexBankDocument &&
    viewMode === "disassembly" &&
    isListedWhereItIsPaged(bankPlacements, disassOffset);
  const branchCpu = useNexBranchCpuSnapshot(branchGutterApplies);
  const showBranchGutter = branchGutterApplies && !!branchCpu;

  // --- `undefined` while the file is showing, which is what makes every row's marks disappear.
  const activeDiff = liveBankShown ? bankDiff : undefined;
  const diffBadge = useMemo(
    () => (liveBankShown ? formatBankDiff(bankDiff) : undefined),
    [liveBankShown, bankDiff]
  );
  const bankLocation = useMemo(
    () =>
      bankPlacements === undefined
        ? undefined
        : {
            placements: bankPlacements,
            ...formatBankLocation(bankPlacements, pcBankOffset)
          },
    [bankPlacements, pcBankOffset]
  );

  /*
   * The NEX annotation editor.
   *
   * Everything about annotations — the shared session, the seven dialogs, the label and region
   * rules, the dirty lifecycle — lives behind this one call, and runs without React. What stays
   * here is the *document*: its view state, its scrolling, and generating the listing (which has a
   * path the editor knows nothing about — a dump with no sidecar still disassembles).
   *
   * See `.plans/NEX_DEBUGGING_PLAN.md` §9 and `.ai/ui-mvc-guide.md`.
   */
  const markDocumentAnnotationDirty = useCallback((dirty: boolean) => {
    const editVersion = document.editVersionCount ?? 0;
    const savedVersion = document.savedVersionCount ?? editVersion;
    if (dirty) {
      document.savedVersionCount = savedVersion;
      document.editVersionCount = editVersion === savedVersion ? editVersion + 1 : editVersion;
    } else {
      document.editVersionCount = editVersion;
      document.savedVersionCount = editVersion;
    }
    documentHubService.signHubStateChanged();
  }, [document, documentHubService]);

  const navigateDisassemblyTo = useCallback((address: number) => {
    setCurrentViewState((current) => ({ ...current, topAddress: address }));
    setDisassemblyJumpAddress(address & 0xffff);
  }, []);

  const annotationEnv = useMemo<NexAnnotationEditorEnvironment>(
    () => ({
      annotationPath: currentViewState.nexAnnotationPath,
      bank: currentViewState.nexAnnotationBank,
      viewMode,
      decimalView,
      disassOffset
    }),
    [
      currentViewState.nexAnnotationBank,
      currentViewState.nexAnnotationPath,
      decimalView,
      disassOffset,
      viewMode
    ]
  );

  const {
    vm: annotationVm,
    dispatch: dispatchAnnotation,
    confirmDisposal
  } = useNexAnnotationEditor({
    env: annotationEnv,
    contents,
    onNavigateToAddress: navigateDisassemblyTo,
    onDirtyChanged: markDocumentAnnotationDirty
  });

  // --- Read through refs by the two callbacks that outlive a render: the document API effect runs
  // --- once, and the keyboard handler needs the selection as of *now*, not as of its own render.
  const confirmDisposalRef = useRef(confirmDisposal);
  confirmDisposalRef.current = confirmDisposal;
  const selectedRangeRef = useRef<{ activeIndex: number }>();
  selectedRangeRef.current = annotationVm.listing.selectedRange
    ? { activeIndex: annotationVm.listing.selectedRange.end }
    : undefined;

  const selectedDisassemblyRange = annotationVm.listing.selectedRange;

  // --- The sidecar is where these breakpoints live between sessions: read once per file, written
  // --- back on every change.
  useNexSidecarBreakpointSync(currentViewState.nexAnnotationPath, annotationVm.annotations);

  useEffect(() => {
    void dispatchAnnotation({ type: "opened" });
  }, [dispatchAnnotation]);

  useEffect(() => {
    void dispatchAnnotation({ type: "environmentChanged", env: annotationEnv });
  }, [annotationEnv, dispatchAnnotation]);

  useEffect(() => {
    void dispatchAnnotation({ type: "listingChanged", items: disassemblyItems });
  }, [disassemblyItems, dispatchAnnotation]);

  /*
   * Adopt the display settings the sidecar remembers for this bank.
   *
   * The feedback runs the other way too — a control change is persisted by the editor — but it
   * settles: the settings that come back compare equal to the ones in view state, so nothing is
   * published and nothing re-renders.
   */
  useEffect(() => {
    const bank = currentViewState.nexAnnotationBank;
    const annotations = annotationVm.annotations;
    if (bank === undefined || !annotations) return;
    const bankAnnotation = getBankAnnotation(annotations, bank);
    if (!bankAnnotation) return;
    setCurrentViewState((current) => {
      const next = { ...current };
      let changed = false;
      const nextDisassOffset = getNexBankAddressOffset(bankAnnotation.offsetIndex);
      if (next.disassOffset !== nextDisassOffset) {
        next.disassOffset = nextDisassOffset;
        changed = true;
      }
      if (
        bankAnnotation.decimalView !== undefined &&
        next.decimalView !== bankAnnotation.decimalView
      ) {
        next.decimalView = bankAnnotation.decimalView;
        changed = true;
      }
      if (bankAnnotation.lastView && next.viewMode !== bankAnnotation.lastView) {
        next.viewMode = bankAnnotation.lastView;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [annotationVm.annotations, currentViewState.nexAnnotationBank]);
  /*
   * The width every row reserves for its label.
   *
   * Unlike a machine disassembly, this listing's labels are whatever the user named them in the
   * annotation sidecar, so the default column is not wide enough for them; see `deriveLabelWidthCh`.
   */
  const disassemblyLabelWidthCh = useMemo(
    () => deriveLabelWidthCh(disassemblyItems, decimalView),
    [decimalView, disassemblyItems]
  );
  /*
   * The width every row reserves for its hard comment, so the zebra stripes all end at the same x.
   * Same derivation as `DisassemblyPanel`; 0 means no row has a comment and the cell is omitted.
   */
  /*
   * Every row's verdict, built once per refresh rather than once per row: `DisassemblyRow` is
   * memoized, and a fresh object per render would defeat that for the whole listing.
   */
  const branchVerdicts = useMemo(() => {
    if (!showBranchGutter || !branchCpu) return undefined;
    const verdicts = new Map<number, BranchVerdict>();
    for (const item of disassemblyItems) {
      if (!item.branch) continue;
      verdicts.set(
        item.address,
        evaluateBranch(
          item.branch,
          item.address,
          item.opCodes?.length ?? 0,
          branchCpu,
          item.address === pausedPcRowAddress
        )
      );
    }
    return verdicts;
  }, [showBranchGutter, branchCpu, disassemblyItems, pausedPcRowAddress]);

  const disassemblyCommentWidthCh = useMemo(
    () =>
      disassemblyItems.reduce(
        (widest, item) =>
          item.hardComment ? Math.max(widest, item.hardComment.length + 2) : widest,
        0
      ),
    [disassemblyItems]
  );
  const changeViewState = useCallback((setter: (vs: MemoryDumpViewState) => void) => {
    setCurrentViewState((current) => {
      const newViewState = { ...current };
      setter(newViewState);
      return newViewState;
    });
  }, []);

  useEffect(() => {
    if (document?.id) {
      documentHubService.setDocumentViewState(document.id, currentViewState);
    }
  }, [currentViewState, document?.id, documentHubService]);

  useEffect(() => {
    if (!document?.id) return undefined;
    documentHubService.setDocumentApi(document.id, {
      // --- Read through a ref: the editor is rebuilt on no render, but this effect runs once and
      // --- the closure would otherwise capture the first render's editor.
      beforeDocumentDisposal: () => confirmDisposalRef.current(),
      // --- Re-point a document that is already open. Both lists are asked: which one is showing is
      // --- the view mode's business, and the one that is not simply keeps the address for later.
      revealAddress: (address: number) => {
        setCurrentViewState((current) => ({ ...current, topAddress: address }));
        setMemoryJumpAddress(address);
        setDisassemblyJumpAddress(address & 0xffff);
      }
    });
    return () => {
      documentHubService.setDocumentApi(document.id, undefined);
    };
  }, [document?.id, documentHubService]);

  /*
   * The row holding an address, in the listing's own numbering.
   *
   * `disassOffset` has to come off first: the rows are addressed by it (§ the `pausedPcRowAddress`
   * note above), but the virtual list is indexed from the start of the dump. Without the
   * subtraction, "go to address" in a bank shown at `$4000` asked for row `$5C50 / 16` = 1477 of a
   * 1024-row list and simply hit the bottom. Clamped for the same reason: an address outside the
   * dump should land at an end, not throw the list off.
   */
  const rowIndexForAddress = useCallback(
    (address: number) => {
      const index = Math.floor((address - disassOffset) / 16);
      return Math.max(0, Math.min(index, Math.max(0, items.length - 1)));
    },
    [disassOffset, items.length]
  );

  useEffect(() => {
    if (!memoryVlApi.current || memoryJumpAddress === undefined) return;
    memoryVlApi.current.scrollToIndex(rowIndexForAddress(memoryJumpAddress), {
      align: "start"
    });
  }, [memoryJumpAddress, rowIndexForAddress]);

  /*
   * The three display controls only change *view* state now.
   *
   * Remembering them in the sidecar used to happen here, by hand, once per control. The annotation
   * editor does it from the environment instead, so it cannot be forgotten when a control is added.
   */
  const changeViewMode = useCallback((nextView: StaticDumpViewMode) => {
    changeViewState((vs) => (vs.viewMode = nextView));
  }, [changeViewState]);

  const changeDecimalView = useCallback((nextDecimalView: boolean) => {
    changeViewState((vs) => (vs.decimalView = nextDecimalView));
  }, [changeViewState]);

  const changeDisassemblyOffset = useCallback((nextOffset: number) => {
    changeViewState((vs) => (vs.disassOffset = nextOffset));
  }, [changeViewState]);

  const selectDisassemblyRow = useCallback((index: number, extendSelection: boolean) => {
    dispatchAnnotation({ type: "rowSelected", index, extend: extendSelection });
  }, [dispatchAnnotation]);

  /*
   * Moving the selection is the editor's decision; scrolling to it and taking focus are not.
   *
   * The editor clamps the index, so the row it lands on is recomputed here from the same rule
   * rather than guessed — `vm.listing.selectedRange` is a render behind at this point.
   */
  const moveDisassemblySelection = useCallback((
    delta: number,
    extendSelection: boolean
  ) => {
    if (disassemblyItems.length === 0) return;
    const fromIndex = selectedRangeRef.current?.activeIndex ?? 0;
    const nextIndex = Math.max(0, Math.min(disassemblyItems.length - 1, fromIndex + delta));
    dispatchAnnotation({ type: "selectionMoved", delta, extend: extendSelection });
    disassemblyVlApi.current?.scrollToIndex(nextIndex, { align: "nearest" });
    disassemblyListRef.current?.focus();
  }, [disassemblyItems.length, dispatchAnnotation]);

  const handleDisassemblyListKeyDown = useCallback((
    event: KeyboardEvent<HTMLDivElement>
  ) => {
    const pageRows = Math.max(
      1,
      Math.floor(
        (disassemblyListRef.current?.clientHeight ?? 0) / disassemblyRowItemSize
      ) || STATIC_DISASSEMBLY_FALLBACK_PAGE_ROWS
    );
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        event.stopPropagation();
        moveDisassemblySelection(1, event.shiftKey);
        break;
      case "ArrowUp":
        event.preventDefault();
        event.stopPropagation();
        moveDisassemblySelection(-1, event.shiftKey);
        break;
      case "PageDown":
        event.preventDefault();
        event.stopPropagation();
        moveDisassemblySelection(pageRows, event.shiftKey);
        break;
      case "PageUp":
        event.preventDefault();
        event.stopPropagation();
        moveDisassemblySelection(-pageRows, event.shiftKey);
        break;
      case "Home":
        event.preventDefault();
        event.stopPropagation();
        moveDisassemblySelection(-(selectedRangeRef.current?.activeIndex ?? 0), event.shiftKey);
        break;
      case "End":
        event.preventDefault();
        event.stopPropagation();
        moveDisassemblySelection(
          disassemblyItems.length - 1 - (selectedRangeRef.current?.activeIndex ?? 0),
          event.shiftKey
        );
        break;
    }
  }, [disassemblyItems.length, disassemblyRowItemSize, moveDisassemblySelection]);

  const openDisassemblyContextMenu = useCallback((
    index: number,
    event: MouseEvent<HTMLDivElement>
  ) => {
    if (!annotationVm.annotationsAvailable) return;
    // --- Only a row that carries annotation metadata can be acted on.
    if (!disassemblyItems[index]?.annotation) return;
    event.preventDefault();
    dispatchAnnotation({ type: "contextMenuRequested", rowIndex: index });
    contextMenuApi.show(event);
  }, [annotationVm.annotationsAvailable, contextMenuApi, disassemblyItems, dispatchAnnotation]);

  const openToolbarAnnotationContextMenu = useCallback((
    event: MouseEvent<HTMLElement>
  ) => {
    if (!annotationVm.toolbar.menuEnabled) return;
    dispatchAnnotation({ type: "toolbarMenuRequested" });
    contextMenuApi.show(event);
  }, [annotationVm.toolbar.menuEnabled, contextMenuApi, dispatchAnnotation]);

  useEffect(() => {
    if (!disassemblyEnabled || viewMode !== "disassembly") return undefined;
    let cancelled = false;

    (async () => {
      const annotations = annotationVm.annotations;
      const annotationItems = annotations && currentViewState.nexAnnotationBank !== undefined
        ? await createAnnotatedNexDisassemblyItems({
            annotations,
            bank: currentViewState.nexAnnotationBank,
            contents,
            decimalView,
            disassOffset
          })
        : undefined;
      let outputItems = annotationItems;
      if (!outputItems) {
        const memorySections = [
          new MemorySection(0x0000, Math.max(0, contents.length - 1))
        ];
        const disassembler = new Z80Disassembler(memorySections, contents, undefined, {
          allowExtendedSet: true,
          decimalMode: decimalView
        });
        disassembler.setAddressOffset(disassOffset);
        const output = await disassembler.disassemble(0x0000, contents.length - 1);
        outputItems = output?.outputItems ?? [];
      }
      if (!cancelled) {
        setDisassemblyItems(outputItems);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    contents,
    currentViewState.nexAnnotationBank,
    decimalView,
    disassOffset,
    disassemblyEnabled,
    annotationVm.annotations,
    viewMode
  ]);

  useEffect(() => {
    if (!disassemblyVlApi.current || disassemblyJumpAddress === undefined) return;

    const idx = disassemblyItems.findIndex((item) => item.address >= disassemblyJumpAddress);
    if (idx >= 0) {
      disassemblyVlApi.current.scrollToIndex(idx, {
        align: "start"
      });
    }
  }, [disassemblyItems, disassemblyJumpAddress]);

  return (
    /* --- M1: was `0.8em`, the literal pattern `MemoryPanel.tsx` and `DisassemblyPanel.tsx`
       --- were changed away from. 12.8px off the 16px root rather than the panel size the
       --- rows below it are drawn at. */
    <FullPanel fontFamily="--monospace-font" fontSize="--panel-font-size">
      <PanelHeader>
        {disassemblyEnabled && (
          <>
            <Text text="View" />
            <LabelSeparator />
            <Dropdown
              options={staticDumpViewModeOptions}
              initialValue={viewMode}
              width={104}
              onChanged={(value) =>
                changeViewMode(value as StaticDumpViewMode)
              }
            />
            <LabelSeparator width={8} />
          </>
        )}
        {viewMode === "disassembly" && (
          <>
            <LabeledSwitch
              value={decimalView}
              label="Decimal"
              title="Use decimal numbers?"
              clicked={changeDecimalView}
            />
            <LabelSeparator width={8} />
            <Text text="Offset" />
            <LabelSeparator />
            <Dropdown
              options={createStaticDisassemblyOffsetOptions(decimalView)}
              initialValue={disassOffset.toString(10)}
              width={68}
              onChanged={(value) => changeDisassemblyOffset(parseInt(value, 10))}
            />
            <LabelSeparator width={8} />
          </>
        )}
        {viewMode === "memory" && liveBankOffered && (
          <>
            {/*
              * File bytes, or the machine's.
              *
              * Only in the memory view, and only when the machine can actually answer — a switch
              * that can be turned on into an empty view is worse than no switch. See `bankBytes`
              * for why the disassembly view does not offer it.
              */}
            <LabeledSwitch
              value={showLiveBank}
              label="Live"
              title="Show this bank as it is in the machine now, instead of as the file holds it"
              clicked={setShowLiveBank}
            />
            {diffBadge && (
              <>
                <LabelSeparator width={8} />
                <span className={styles.bankDiff} title={diffBadge.title}>
                  {diffBadge.text}
                </span>
              </>
            )}
            <LabelSeparator width={8} />
          </>
        )}
        {viewMode === "memory" && (
          <AddressInput
            label="Go to address:"
            decimalView={false}
            onAddressSent={async (address) => {
              changeViewState((vs) => (vs.topAddress = address));
              setMemoryJumpAddress(address);
            }}
          />
        )}
        {viewMode === "disassembly" && (
          <AddressInput
            label="Go To"
            clearOnEnter={true}
            decimalView={decimalView}
            onAddressSent={async (address) => {
              changeViewState((vs) => (vs.topAddress = address));
              setDisassemblyJumpAddress(address & 0xffff);
            }}
          />
        )}
        {/*
          * Where this bank actually is in the Z80 address space, right now.
          *
          * The one thing the pop-out could not say before, and the reason a breakpoint set here
          * could look like it did nothing: a bank-relative breakpoint is armed at all eight
          * addresses its bank could be paged to, and fires only at the one where it actually is —
          * so a bank that is paged out has a live breakpoint that correctly never fires. See
          * `nextBankLocation.ts`.
          */}
        {bankLocation && (
          <>
            <LabelSeparator width={8} />
            <span
              className={classnames(styles.bankLocation, {
                [styles.bankLocationAbsent]: bankLocation.placements.length === 0
              })}
              title={bankLocation.title}
            >
              <span className={styles.bankLocationLabel}>Bank</span>
              {bankLocation.text}
            </span>
          </>
        )}
        <NexAnnotationToolbar
          vm={annotationVm}
          dispatch={dispatchAnnotation}
          onMenuRequested={openToolbarAnnotationContextMenu}
        />
      </PanelHeader>
      <FullPanel>
        {contents && viewMode === "memory" ? (
          <VirtualizedList
            items={items}
            itemSize={dumpRowItemSize}
            revealUnmeasuredItems
            onScroll={(offset) => {
              pendingScrollPosition.current = offset;
            }}
            onScrollEnd={() => {
              const topPos = pendingScrollPosition.current;
              changeViewState((vs) => (vs.scrollPosition = topPos));
            }}
            apiLoaded={(api) => {
              memoryVlApi.current = api;
              if (restoredInitialScroll.current) return;
              /*
               * An explicit `topAddress` wins over a remembered scroll position: it is only set when
               * something opened this document *at* an address — the entry-point stop revealing the
               * bank it broke in — and restoring the previous position instead would silently ignore
               * the reason the document was opened.
               */
              const openAt = viewState?.topAddress;
              if (openAt !== undefined) {
                restoredInitialScroll.current = true;
                requestAnimationFrame(() => {
                  api.scrollToIndex(rowIndexForAddress(openAt), { align: "start" });
                });
              } else if (viewState?.scrollPosition) {
                restoredInitialScroll.current = true;
                requestAnimationFrame(() => {
                  api.scrollTo(viewState.scrollPosition);
                });
              }
            }}
            renderItem={(idx, item) => {
              return (
                <div
                  className={classnames(styles.item, {
                    [styles.even]: idx % 2 == 0
                  })}
                >
                  <Row>
                    <MemoryDumpSection
                      address={item}
                      bytes={bankBytes.subarray(item, item + 8)}
                      changedBytes={changedFlagsIn(activeDiff, item, 8)}
                      decimalView={false}
                      charDump={true}
                      lastJumpAddress={-1}
                    />
                    <MemoryDumpSection
                      address={item + 8}
                      bytes={bankBytes.subarray(item + 8, item + 16)}
                      changedBytes={changedFlagsIn(activeDiff, item + 8, 8)}
                      decimalView={false}
                      charDump={true}
                      lastJumpAddress={-1}
                    />
                  </Row>
                </div>
              );
            }}
          />
        ) : null}
        {contents && viewMode === "disassembly" ? (
          <div
            ref={disassemblyListRef}
            className={styles.disassemblyList}
            data-testid="static-disassembly-list"
            tabIndex={0}
            onKeyDown={handleDisassemblyListKeyDown}
          >
            <VirtualizedList
              items={disassemblyItems}
              itemSize={disassemblyRowItemSize}
              overscan={25}
              revealUnmeasuredItems
              /*
               * A named label, a long instruction and an end-of-line comment together run well past
               * a narrow panel. Without this, virtua's absolutely positioned row wrapper stays
               * pinned to the viewport width, the scroll container reports
               * `scrollWidth === clientWidth`, and there is no horizontal bar to drag — the row's
               * own `min-width: max-content` is not enough on its own. See the prop's own comment.
               */
              scrollRowsHorizontally
              onScroll={(offset) => {
                pendingDisassemblyScrollPosition.current = offset;
              }}
              onScrollEnd={() => {
                const topPos = pendingDisassemblyScrollPosition.current;
                changeViewState((vs) => (vs.disassemblyScrollPosition = topPos));
              }}
              apiLoaded={(api) => {
                disassemblyVlApi.current = api;
                if (restoredInitialDisassemblyScroll.current) return;
                /*
                 * As in the memory list: an explicit `topAddress` is why the document was opened, so
                 * it beats a remembered scroll position. Seeding the jump address rather than
                 * scrolling here on purpose — the listing is disassembled asynchronously, so the row
                 * for an address may not exist yet, and the jump effect re-runs when it does.
                 */
                const openAt = viewState?.topAddress;
                if (openAt !== undefined) {
                  restoredInitialDisassemblyScroll.current = true;
                  setDisassemblyJumpAddress(openAt & 0xffff);
                } else if (viewState?.disassemblyScrollPosition) {
                  restoredInitialDisassemblyScroll.current = true;
                  requestAnimationFrame(() => {
                    api.scrollTo(viewState.disassemblyScrollPosition);
                  });
                }
              }}
              renderItem={(idx) => {
                const item = disassemblyItems[idx];
                if (!item) return <div></div>;
                // --- The active end of the selection: the row the keyboard moves from.
                const selected = selectedDisassemblyRange?.end === idx;
                const selectedRange =
                  !!selectedDisassemblyRange &&
                  idx >= selectedDisassemblyRange.start &&
                  idx <= selectedDisassemblyRange.end;
                const rowBankOffset =
                  item.annotation?.bankOffset ??
                  listedBankOffset(item.address, disassOffset, contents.length);

                return (
                  <DisassemblyRow
                    annotated={annotationVm.annotationsAvailable}
                    bankLabel={false}
                    /*
                     * The gutter, for the bank this document shows.
                     *
                     * Matched by the row's own bank offset rather than by a Z80 address: the bank
                     * may be paged anywhere, so "a breakpoint here" means an offset in the bank,
                     * not a place in the 64K map. `undefined` leaves the gutter as it was — an
                     * unarmed circle the click arms.
                     *
                     * The offset falls back to the row's position in the listing when there is no
                     * annotation to carry one. Without that, a bank with no sidecar had no offsets
                     * at all, and its gutter could neither show a bank breakpoint nor create one —
                     * it armed a plain address breakpoint instead, which then showed in the sidebar
                     * and nowhere on the row that made it. See §15.20 of the CSpect plan.
                     */
                    bankScope={
                      currentViewState.nexAnnotationBank !== undefined && rowBankOffset !== undefined
                        ? {
                            bank: currentViewState.nexAnnotationBank,
                            bankOffset: rowBankOffset
                          }
                        : undefined
                    }
                    breakpoint={
                      rowBankOffset !== undefined
                        ? bankBreakpoints.get(rowBankOffset)
                        : undefined
                    }
                    commentWidthCh={disassemblyCommentWidthCh}
                    currentSegment={0}
                    decimalView={decimalView}
                    index={idx}
                    isFullView={true}
                    item={item}
                    labelWidthCh={disassemblyLabelWidthCh}
                    mem64kLabels={[]}
                    onClick={(event) => {
                      selectDisassemblyRow(idx, event.shiftKey);
                      disassemblyListRef.current?.focus();
                    }}
                    onContextMenu={(event) => openDisassemblyContextMenu(idx, event)}
                    /*
                     * Double-click the gutter to edit the breakpoint there.
                     *
                     * This is also how a bank **watchpoint** gets made: the gutter click can only
                     * create an execution breakpoint, and the dialog's type selector is what turns
                     * it into a memory read or write. See `.plans/NEX_DEBUGGING_PLAN.md` §10.2.
                     */
                    onEditBreakpoint={editBreakpoint}
                    partitionLabels={{}}
                    partitionWidthCh={0}
                    pausedPc={pausedPcRowAddress}
                    rowHeight={disassemblyRowItemSize}
                    selected={selected}
                    selectedRange={selectedRange}
                    showBanks={false}
                    showBranchGutter={showBranchGutter}
                    verdict={branchVerdicts?.get(item.address)}
                  />
                );
              }}
            />
          </div>
        ) : null}
      </FullPanel>
      <NexAnnotationMenu
        vm={annotationVm}
        dispatch={dispatchAnnotation}
        state={contextMenuState}
        api={contextMenuApi}
      />
    </FullPanel>
  );
};

export const createStaticMemoryDump = ({ document, contents, viewState }: DocumentProps) => (
  <StaticMemoryDump document={document} contents={contents} viewState={viewState} />
);

export async function openStaticMemoryDump(
  documentHubService: IDocumentHubService,
  dumpId: string,
  title: string,
  contents: Uint8Array,
  options: StaticMemoryDumpOptions = {}
): Promise<void> {
  const id = `memoryDump-${dumpId}`;
  if (documentHubService.isOpen(id)) {
    // --- Focusing is not enough when the caller asked for an address: a document already open is
    // --- sitting wherever it was left, so push the target into its view state too.
    if (options.topAddress !== undefined || options.viewMode !== undefined) {
      const current = documentHubService.getDocumentViewState(id) ?? {};
      documentHubService.setDocumentViewState(id, {
        ...current,
        ...(options.topAddress !== undefined ? { topAddress: options.topAddress } : {}),
        // --- An explicit view mode is a caller saying *how* to show this, not a preference to
        // --- remember around: the entry-point reveal wants code, whatever the document was left as.
        ...(options.viewMode !== undefined ? { viewMode: options.viewMode } : {})
      });
    }
    // --- Writing the view state is not enough: a mounted document read it once, on mount. Ask the
    // --- document itself to move, which is what makes the listing follow the program counter as it
    // --- steps within a bank that is already on screen.
    if (options.topAddress !== undefined) {
      documentHubService.getDocumentApi(id)?.revealAddress?.(options.topAddress);
    }
    documentHubService.setActiveDocument(id);
  } else {
    await documentHubService.openDocument(
      {
        id,
        name: title,
        type: STATIC_MEMORY_DUMP_VIEWER,
        iconName: "memory-icon",
        contents
      },
      {
        disassemblyEnabled: options.disassemblyEnabled ?? false,
        disassOffset: options.disassOffset ?? 0,
        decimalView: options.decimalView,
        viewMode: options.viewMode,
        nexAnnotationPath: options.nexAnnotationPath,
        nexAnnotationBank: options.nexAnnotationBank,
        topAddress: options.topAddress
      } satisfies MemoryDumpViewState,
      false
    );
  }
}

type MiniDumpProps = {
  contents: Uint8Array;
  length?: number;
};

export const MiniMemoryDump = ({ contents, length = 64 }: MiniDumpProps) => {
  const displayLength = Math.min(length, contents.length);
  const items = useMemo(() => createRowAddresses(displayLength, 16), [displayLength]);

  return items?.length ? (
    <>
      <div style={{ height: 4 }} />
      {items.map((item, idx) => {
        return (
          <div
            key={idx}
            className={classnames(styles.item, {
              [styles.even]: idx % 2 == 0
            })}
          >
            <Row>
              <MemoryDumpSection
                address={item}
                bytes={Array.from(contents.slice(item, item + 8))}
                decimalView={false}
                charDump={true}
                lastJumpAddress={-1}
              />
              {item + 8 < displayLength && (
                <MemoryDumpSection
                  address={item + 8}
                  bytes={Array.from(contents.slice(item + 8, item + 16))}
                  decimalView={false}
                  charDump={true}
                  lastJumpAddress={-1}
                />
              )}
            </Row>
          </div>
        );
      })}
    </>
  ) : null;
};
