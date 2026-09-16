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
import type { VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import { VListHandle } from "virtua";
import { createRowAddresses } from "./memoryViewModel";
import { MemoryDumpSection } from "./MemoryDumpSection";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { PanelHeader, PanelHeaderGroup } from "@renderer/controls/data";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { useBreakpointDialog } from "@renderer/appIde/dialogs/useBreakpointDialog";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useMainApi } from "@renderer/core/MainApi";
import { revealNexBankAtAddress } from "@renderer/appIde/DocumentPanels/Next/nexBankReveal";
import { evaluateBranch, type BranchVerdict } from "@renderer/appIde/DocumentPanels/branchVerdict";
import { useRowSizes } from "@renderer/theming/useRowSizes";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { Text } from "@renderer/controls/layout/Text";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { MemorySection, type DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import { deriveLabelWidthCh, DisassemblyRow } from "@renderer/appIde/DocumentPanels/DisassemblyRow";
import {
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import {
  createAnnotatedNexDisassemblyItems,
  createScreenSkipItem,
  pcAnchoredRuns,
  SCREEN_AREA_RANGE,
  screenAreaApplies
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotatedDisassembly";
import { useSysVarOperandLabelResolver } from "@renderer/appIde/DocumentPanels/useSysVarOperandLabels";
// --- The same wording as the live Disassembly view's switch: one control in two places.
import { SYS_VAR_NAMES_TITLE } from "@renderer/appIde/DocumentPanels/DisassemblyToolbars";
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
  formatBankDiff,
  machineHasRun
} from "@renderer/appIde/DocumentPanels/Next/nexLiveBank";
import {
  useNexBankBreakpoints,
  useNexSidecarBreakpointSync
} from "@renderer/appIde/DocumentPanels/Next/useNexBankBreakpoints";
import type { NexAnnotationEditorEnvironment } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorModel";
import {
  intentForAction,
  NexAnnotationMenu,
  NexAnnotationToolbar
} from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorView";
import {
  annotationActionForKey,
  menuEntryFor
} from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorViewModel";
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
  /** Name 16-bit data operands after the machine's system variables. Defaults to on. */
  sysVarNames?: boolean;
  /**
   * Disassemble `$4000-$5AFF` in a NEX bank listed at `$4000`. Defaults to **off**.
   *
   * Off by default because that range is the ULA screen whenever a bank is listed there, and 6,912
   * bytes of bitmap disassemble into some 3,000 rows of plausible-looking nonsense in front of the
   * code the reader opened the bank for. Kept in the document's view state beside `sysVarNames`
   * rather than in the sidecar: it is how this listing is shown, not a fact about the program.
   */
  disassembleScreen?: boolean;
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

/**
 * The "go to PC" button's tooltip.
 *
 * Says where, not just what: unlike the live Disassembly view — which always shows wherever the PC
 * is — a popped-out bank is one 16K slice, so "nothing happens" here usually means the program
 * counter is somewhere else entirely rather than that the button is broken.
 */
const GO_TO_PC_TITLE = "Go to the PC address in this bank";

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
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const machineState = useSelector((st) => st.emulatorState?.machineState);
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
  // --- On unless the reader turned it off: a named address is the more informative default, and a
  // --- listing that has never been configured should be the readable one.
  const sysVarNames = currentViewState.sysVarNames ?? true;
  const disassembleScreen = currentViewState.disassembleScreen ?? false;
  const disassOffset = currentViewState.disassOffset ?? 0;
  /*
   * Whether this listing offers the screen switch at all, and whether the screen is being hidden.
   *
   * Only a NEX bank listed at `$4000`: that is the one listing whose first 6,912 rows *are* screen
   * memory. Every other bank has no switch, because the same offsets there are ordinary code or data.
   */
  const screenSwitchOffered = screenAreaApplies({ isNexBank: isNexBankDocument, disassOffset });
  const hideScreenArea = screenSwitchOffered && !disassembleScreen;
  const [memoryJumpAddress, setMemoryJumpAddress] = useState<number>();
  /*
   * Where to scroll the listing, and a counter beside it.
   *
   * The counter is what makes "Go to PC" work a second time. The jump is applied by an effect keyed
   * on this address, so asking for the same address twice — press the button, scroll away, press it
   * again — set the same state, re-rendered nothing and scrolled nowhere. Bumping a version on every
   * request makes each one a distinct event, which is what a button press is.
   */
  const [disassemblyJumpAddress, setDisassemblyJumpAddress] = useState<number>();
  const [disassemblyJumpVersion, setDisassemblyJumpVersion] = useState(0);
  const [disassemblyTopAddress, setDisassemblyTopAddress] = useState<number | undefined>(undefined);
  const jumpDisassemblyTo = useCallback((address: number) => {
    setDisassemblyJumpAddress(address & 0xffff);
    setDisassemblyJumpVersion((version) => version + 1);
  }, []);
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
  const disassemblyVlApi = useRef<VirtualizedListApi>();
  const disassemblyListRef = useRef<HTMLDivElement>(null);
  const pendingScrollPosition = useRef(viewState?.scrollPosition ?? 0);
  const pendingDisassemblyScrollPosition = useRef(viewState?.disassemblyScrollPosition ?? 0);
  /*
   * The address of the row at the top of the listing, for the "go to PC" button's arrow.
   *
   * Recorded on every scroll frame but committed only when scrolling stops, the way the live
   * Disassembly panel does it: the arrow only has to be right once the view has settled, and
   * re-rendering the whole toolbar on every frame of a flick would cost far more than it says.
   */
  const pendingDisassemblyTopAddress = useRef<number | undefined>(undefined);
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
   * File bytes or the machine's — and the machine's whenever there is a machine to ask.
   *
   * There is no switch any more. A popped-out bank is opened to debug a program, and the bytes that
   * matter for that are the ones the Z80 will actually execute: a bank that decompressed itself, a
   * buffer written over its own loader, a routine patched at run time. Asking the user to turn that
   * on made the debugger's most useful view the one you had to know to ask for, and made every
   * listing ambiguous until you checked the switch.
   *
   * The file's bytes still answer a question, and the diff readout is what answers it now — it says
   * how far the machine has drifted from the file without making the reader choose which of the two
   * they are being shown.
   *
   * Reads are gated on `bankPlacements` rather than run unconditionally: it is non-undefined exactly
   * when this is a ZX Spectrum Next with this bank in it, **started**, and answering. Without the
   * gate this would be 16K of IPC per tick for every open bank document whether a machine exists or
   * not.
   *
   * The "started" half is not redundant. A machine that has been created but never run still answers
   * every query — a default memory mapping, and partitions full of zeros — so a gate that only asks
   * "can it answer?" passes, and the document silently swaps the file's bytes for 16K of `nop`. See
   * `machineHasRun`.
   *
   * `liveBank` is undefined whenever the machine cannot answer, and everything below falls back to
   * the file on its own. That is the whole of the "no machine" story: a NEX opened for reading, with
   * nothing running, shows exactly what it always did.
   */
  const liveBankWanted = bankPlacements !== undefined;
  const liveBank = useNexLiveBankBytes(currentViewState.nexAnnotationBank, liveBankWanted);
  const bankDiff = useMemo(() => diffBankBytes(contents, liveBank), [contents, liveBank]);
  const liveBankShown = liveBank !== undefined;
  /*
   * **Both** views read this now — the disassembly view used to be pinned to the file.
   *
   * The reason it was pinned no longer holds. The worry was that the annotation editor addresses its
   * actions by row index while live bytes disassemble to different instruction lengths, so the
   * listing and the editor would drift apart by a row. But the editor resolves a row *through the
   * item it rendered* — `item.annotation?.bankOffset`, falling back to
   * `listedBankOffset(item.address, ...)` — so it acts on the offset of the row that was clicked,
   * whichever byte array produced the listing. The two cannot drift, because there is only one
   * listing.
   *
   * What the sidecar stores is bank *offsets*, and a bank is 16K whether it was read from the file
   * or out of RAM, so its regions go on meaning the same thing. Only the instructions decoded inside
   * a region change — which is the point.
   */
  const bankBytes = liveBank ?? contents;
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
   * "Go to PC", and the one condition it is offered under.
   *
   * `pcBankOffset` already *is* the question the button asks: `useNexBankPcOffset` yields a value
   * only while the machine is paused, and only when the program counter falls inside one of this
   * bank's current placements. A running machine's PC has moved on by the time it is read, and a
   * bank the PC is not in has no row to jump to — so both cases come back `undefined` and the
   * button is simply not offered. There is no second check to keep in step with the first.
   *
   * The target is `pausedPcRowAddress`, which is the PC in the *listing's* numbering rather than
   * the machine's: the offset dropdown decides whether this bank's byte 0 reads $0000 or $C000, and
   * a bank can be listed at an address it is not paged at. That is the same address the row's
   * execution-point marker uses, so the button lands on the row that is marked.
   */
  const canGoToPc = pcBankOffset !== undefined;
  const goToPcIcon =
    disassemblyTopAddress !== undefined && pausedPcRowAddress < disassemblyTopAddress
      ? "arrow-circle-up"
      : "arrow-circle-down";

  /*
   * The machine's system variables, as names for 16-bit data operands.
   *
   * The same source the live Disassembly view uses, so a routine reads `ld (LAST_K),a` in the
   * popped-out bank exactly as it does while running. Memoized inside the hook, which is what lets
   * it sit in the disassembly effect's dependency list without re-decoding the bank every render.
   */
  const machineSysVarLabelResolver = useSysVarOperandLabelResolver();
  // --- Withheld rather than filtered when the switch is off: an absent resolver is exactly the
  // --- listing as it was before the feature, with no naming path to go wrong.
  const sysVarLabelResolver = sysVarNames ? machineSysVarLabelResolver : undefined;

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
  /*
   * Mark the tab unsaved only when the sidecar could not be written.
   *
   * Annotations are written as they are made, so in normal use this document is never unsaved and
   * the tab never carries the mark. What it now reports is a genuine failure — a bank holding edits
   * that exist only in memory — which is also what the Explorer's reload guard reads.
   */
  const markDocumentAnnotationUnwritten = useCallback((unwritten: boolean) => {
    const editVersion = document.editVersionCount ?? 0;
    const savedVersion = document.savedVersionCount ?? editVersion;
    if (unwritten) {
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
    jumpDisassemblyTo(address);
  }, [jumpDisassemblyTo]);

  /*
   * Follow a definition out of this bank and into whichever one currently holds it.
   *
   * The same reveal the debugger uses to follow the program counter, pointed at a label's address
   * instead — so a jump lands in the document the pop-out and the PC reveal already share, rather
   * than opening a third view of the same bank.
   *
   * Silent when the address is not in a bank of this NEX (ROM, or memory the program paged in from
   * somewhere else). That is an ordinary answer to "where is this label", not a failure worth a
   * dialog: the menu could only have known by asking, which is what this is.
   */
  const revealAddressInBank = useCallback(
    async (address: number) => {
      try {
        await revealNexBankAtAddress(address, {
          getPageInfo: async () => (await emuApi.getNextMemoryMapping())?.pageInfo,
          readFile: (path) => mainApi.readBinaryFile(path),
          openBank: async ({ path, bank, contents: bankBytes, disassOffset: base, topAddress, annotationPath }) => {
            await openStaticMemoryDump(
              documentHubService,
              `bankDump${path}:${bank}`,
              `${path} - Bank: ${bank}`,
              bankBytes,
              {
                disassemblyEnabled: true,
                disassOffset: base,
                nexAnnotationPath: annotationPath,
                nexAnnotationBank: bank,
                topAddress,
                // --- The definition is code being read, so open on the listing rather than the dump.
                viewMode: "disassembly" as const
              }
            );
          }
        });
      } catch {
        // --- See above: a jump that cannot be made is not worth interrupting the user for.
      }
    },
    [documentHubService, emuApi, mainApi]
  );

  const annotationEnv = useMemo<NexAnnotationEditorEnvironment>(
    () => ({
      annotationPath: currentViewState.nexAnnotationPath,
      bank: currentViewState.nexAnnotationBank,
      viewMode,
      decimalView,
      disassOffset,
      /*
       * Whether a cross-bank "Go to definition" can find its destination.
       *
       * `machineHasRun` rather than "a machine exists": a created-but-unstarted machine answers the
       * MMU query with a default mapping, which would offer a jump that lands somewhere the program
       * never put anything.
       */
      machineRunning: machineHasRun(machineState)
    }),
    [
      currentViewState.nexAnnotationBank,
      currentViewState.nexAnnotationPath,
      decimalView,
      disassOffset,
      machineState,
      viewMode
    ]
  );

  /*
   * Take the listing's keyboard surface back once an annotation dialog is done with it.
   *
   * The annotation shortcuts are bare letters, which are only heard while the listing itself is
   * focused. Returning focus to whatever opened a dialog is the modal's job and it does it — this
   * is the panel's backstop for the case where focus ends up on nothing at all, which is how the
   * shortcuts came to look dead after the first dialog: every later keystroke went to `<body>`
   * until the user clicked a row again.
   *
   * **Only from `<body>`**, deliberately. That is the browser's way of saying nothing holds focus,
   * so claiming it takes nothing from anyone. If the user has moved to another panel, a field, or
   * a second dialog stacked over this one, that is a real choice and the listing leaves it alone.
   */
  const reclaimDisassemblyFocus = useCallback(() => {
    // --- `window.document`, because this component's own `document` prop is the open editor, not
    // --- the DOM. Spelling it out is the point: the bare name here means the wrong thing.
    const active = window.document.activeElement;
    if (active && active !== window.document.body) return;
    disassemblyListRef.current?.focus();
  }, []);

  const {
    vm: annotationVm,
    dispatch: dispatchAnnotation,
    confirmDisposal
  } = useNexAnnotationEditor({
    env: annotationEnv,
    contents,
    onNavigateToAddress: navigateDisassemblyTo,
    onRevealAddressInBank: revealAddressInBank,
    onUnwrittenChanged: markDocumentAnnotationUnwritten,
    onDialogClosed: reclaimDisassemblyFocus
  });

  // --- Read through refs by the two callbacks that outlive a render: the document API effect runs
  // --- once, and the keyboard handler needs the selection as of *now*, not as of its own render.
  const confirmDisposalRef = useRef(confirmDisposal);
  confirmDisposalRef.current = confirmDisposal;
  // --- Read through a ref for the same reason the selection is: the keyboard handler needs the
  // --- menu's enablement as of *now*, and re-creating the handler on every menu change would
  // --- rebuild it on every selection move.
  const annotationVmRef = useRef(annotationVm);
  annotationVmRef.current = annotationVm;
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
        jumpDisassemblyTo(address);
      }
    });
    return () => {
      documentHubService.setDocumentApi(document.id, undefined);
    };
    // --- `jumpDisassemblyTo` is stable (a `useCallback` over no changing value), so naming it here
    // --- costs nothing and keeps this effect honest about what it closes over.
  }, [document?.id, documentHubService, jumpDisassemblyTo]);

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

  const changeSysVarNames = useCallback((nextSysVarNames: boolean) => {
    changeViewState((vs) => (vs.sysVarNames = nextSysVarNames));
  }, [changeViewState]);

  const changeDisassembleScreen = useCallback((next: boolean) => {
    changeViewState((vs) => (vs.disassembleScreen = next));
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
    /*
     * An annotation shortcut, before the navigation keys.
     *
     * **Availability is not decided here.** The action's own menu entry already carries it — the
     * same `disabled` the context menu draws — so a shortcut and its menu item cannot drift apart
     * as the rules change. A disabled action simply falls through to the navigation switch, which
     * ignores a letter anyway.
     *
     * **The row is named explicitly**, as the current selection's active end rather than left to
     * the controller's `rowIndex ?? contextTarget ?? selection` fallback. Nothing ever emits
     * `contextTargetCleared`, so a right-click leaves `contextTarget` pointing at that row for as
     * long as the selection lives — and a shortcut pressed after arrowing away would have edited
     * the row the user right-clicked minutes ago. Naming the row also keeps range edits intact:
     * `actionRange` widens any index inside the selection back to the whole range.
     *
     * A handled key must stop propagating: the emulated machine's keyboard is a `window` listener
     * that runs whenever a machine is *Running*, whatever has focus (`useEmulatorKeyboard`), so a
     * bare letter that merely called `preventDefault` would open the dialog *and* type into the
     * Spectrum.
     */
    /*
     * `Alt` and `Meta` are never ours; `Ctrl` is, for the one shortcut that asks for it.
     *
     * The modifier is passed through rather than screened out here, so the table decides. Matching
     * is exact at that end, which is what keeps `Ctrl+C` as copy while `Ctrl+F12` reaches Go to
     * Definition.
     */
    if (!event.metaKey && !event.altKey) {
      const action = annotationActionForKey(event.key, event.shiftKey, event.ctrlKey);
      const entry = action ? menuEntryFor(annotationVmRef.current.menu, action) : undefined;
      if (action && entry && !entry.disabled) {
        event.preventDefault();
        event.stopPropagation();
        dispatchAnnotation(intentForAction(action, selectedRangeRef.current?.activeIndex));
        return;
      }
    }

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
  }, [
    disassemblyItems.length,
    disassemblyRowItemSize,
    dispatchAnnotation,
    moveDisassemblySelection
  ]);

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
            contents: bankBytes,
            decimalView,
            disassOffset,
            pcBankOffset,
            fallbackOperandLabelResolver: sysVarLabelResolver,
            hideScreenArea
          })
        : undefined;
      let outputItems = annotationItems;
      if (!outputItems) {
        /*
         * One run, or two with the cut at the program counter.
         *
         * A fresh disassembler per run rather than one reused across both: each is given the section
         * it is actually decoding, which is what `createInstructionItems` does on the annotated path
         * and avoids depending on whether a second `disassemble` on the same instance starts clean.
         */
        const lastOffset = Math.max(0, bankBytes.length - 1);
        const collected: DisassemblyItem[] = [];
        // --- A bank with no sidecar still gets the screen collapsed: the noise is the same either way.
        const firstOffset = hideScreenArea ? SCREEN_AREA_RANGE.end + 1 : 0x0000;
        if (hideScreenArea) {
          collected.push(createScreenSkipItem(decimalView, disassOffset));
        }
        for (const [runStart, runEnd] of pcAnchoredRuns(firstOffset, lastOffset, pcBankOffset)) {
          const disassembler = new Z80Disassembler(
            [new MemorySection(runStart, runEnd)],
            bankBytes,
            undefined,
            {
              allowExtendedSet: true,
              decimalMode: decimalView,
              // --- An un-annotated bank has no labels of its own, so the machine's system variables
              // --- are the only names available here — and the only ones this path ever needs.
              operandLabelResolver: sysVarLabelResolver
            }
          );
          disassembler.setAddressOffset(disassOffset);
          const output = await disassembler.disassemble(runStart, runEnd);
          collected.push(...(output?.outputItems ?? []));
        }
        outputItems = collected;
      }
      if (!cancelled) {
        setDisassemblyItems(outputItems);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    /*
     * `bankBytes`, not `contents`: the listing follows the machine.
     *
     * Safe as a dependency only because `useNexLiveBankBytes` keeps the array identity when the
     * bytes have not moved. Were it to hand back a fresh 16K array on every tick, this effect would
     * re-disassemble an idle bank several times a second.
     *
     * `pcBankOffset` is here so that a step re-anchors the listing. It only ever has a value while
     * the machine is paused, so this does not re-run while the program is running.
     */
    bankBytes,
    pcBankOffset,
    currentViewState.nexAnnotationBank,
    decimalView,
    disassOffset,
    disassemblyEnabled,
    annotationVm.annotations,
    hideScreenArea,
    sysVarLabelResolver,
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
  }, [disassemblyItems, disassemblyJumpAddress, disassemblyJumpVersion]);

  return (
    /* --- M1: was `0.8em`, the literal pattern `MemoryPanel.tsx` and `DisassemblyPanel.tsx`
       --- were changed away from. 12.8px off the 16px root rather than the panel size the
       --- rows below it are drawn at. */
    <FullPanel fontFamily="--monospace-font" fontSize="--panel-font-size">
      <PanelHeader>
        {disassemblyEnabled && (
          <PanelHeaderGroup>
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
          </PanelHeaderGroup>
        )}
        {viewMode === "disassembly" && (
          <>
            <PanelHeaderGroup>
              <LabeledSwitch
                value={decimalView}
                label="Decimal"
                title="Use decimal numbers?"
                clicked={changeDecimalView}
              />
            </PanelHeaderGroup>
            <PanelHeaderGroup>
              <LabeledSwitch
                value={sysVarNames}
                label="Sys vars"
                title={SYS_VAR_NAMES_TITLE}
                clicked={changeSysVarNames}
              />
            </PanelHeaderGroup>
            {screenSwitchOffered && (
              <PanelHeaderGroup>
                <LabeledSwitch
                  value={disassembleScreen}
                  label="Screen"
                  title="Disassemble the screen memory at $4000-$5AFF?"
                  clicked={changeDisassembleScreen}
                />
              </PanelHeaderGroup>
            )}
            <PanelHeaderGroup>
              <Text text="Offset" />
              <LabelSeparator />
              <Dropdown
                options={createStaticDisassemblyOffsetOptions(decimalView)}
                initialValue={disassOffset.toString(10)}
                width={68}
                onChanged={(value) => changeDisassemblyOffset(parseInt(value, 10))}
              />
            </PanelHeaderGroup>
          </>
        )}
        {liveBankShown && (
          <PanelHeaderGroup>
            {/*
              * A readout, not a control.
              *
              * The switch is gone, but the thing it used to announce still has to be announced: a
              * listing built from RAM and one built from the file look identical until they differ,
              * and the reader has to know which of the two is in front of them. In both views now,
              * because the disassembly is built from the machine's bytes too.
              */}
            <span
              className={styles.liveBank}
              title={
                "This bank is shown as it is in the machine now, not as the file holds it. " +
                "The file's bytes are shown when no machine is running."
              }
            >
              Live
            </span>
            {diffBadge && (
              <span className={styles.bankDiff} title={diffBadge.title}>
                {diffBadge.text}
              </span>
            )}
          </PanelHeaderGroup>
        )}
        {viewMode === "memory" && (
          <PanelHeaderGroup>
            <AddressInput
              label="Go to address:"
              decimalView={false}
              onAddressSent={async (address) => {
                changeViewState((vs) => (vs.topAddress = address));
                setMemoryJumpAddress(address);
              }}
            />
          </PanelHeaderGroup>
        )}
        {viewMode === "disassembly" && (
          <PanelHeaderGroup>
            <SmallIconButton
              iconName={goToPcIcon}
              title={GO_TO_PC_TITLE}
              enable={canGoToPc}
              clicked={() => jumpDisassemblyTo(pausedPcRowAddress)}
            />
            <AddressInput
              label="Go To"
              clearOnEnter={true}
              decimalView={decimalView}
              onAddressSent={async (address) => {
                changeViewState((vs) => (vs.topAddress = address));
                jumpDisassemblyTo(address);
              }}
            />
          </PanelHeaderGroup>
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
          <PanelHeaderGroup>
            <span
              className={classnames(styles.bankLocation, {
                [styles.bankLocationAbsent]: bankLocation.placements.length === 0
              })}
              title={bankLocation.title}
            >
              <span className={styles.bankLocationLabel}>Bank</span>
              {bankLocation.text}
            </span>
          </PanelHeaderGroup>
        )}
        {/* --- Guarded rather than always rendered: `NexAnnotationToolbar` returns null when it has
            --- nothing to show, and an empty group would still claim the header's gap and margin. */}
        {annotationVm.toolbar.visible && (
          <PanelHeaderGroup>
            <NexAnnotationToolbar
              vm={annotationVm}
              onMenuRequested={openToolbarAnnotationContextMenu}
            />
          </PanelHeaderGroup>
        )}
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
                const startIndex = disassemblyVlApi.current?.findStartIndex();
                pendingDisassemblyTopAddress.current =
                  startIndex === undefined ? undefined : disassemblyItems[startIndex]?.address;
              }}
              onScrollEnd={() => {
                const topPos = pendingDisassemblyScrollPosition.current;
                changeViewState((vs) => (vs.disassemblyScrollPosition = topPos));
                const nextTop = pendingDisassemblyTopAddress.current;
                setDisassemblyTopAddress((current) =>
                  nextTop === current ? current : nextTop
                );
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
                  jumpDisassemblyTo(openAt);
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
