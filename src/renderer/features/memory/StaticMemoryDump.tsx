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
import { PanelHeader } from "@renderer/appIde/DocumentPanels/helpers/PanelHeader";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { Text } from "@renderer/controls/layout/Text";
import { Icon } from "@renderer/controls/Icon";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { MemorySection, type DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import { DisassemblyRow } from "@renderer/appIde/DocumentPanels/DisassemblyRow";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSplitButton, type ToolbarSplitButtonOption } from "@renderer/controls/ToolbarSplitButton";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { createAnnotatedNexDisassemblyItems } from "@renderer/appIde/DocumentPanels/Next/nexAnnotatedDisassembly";
import {
  saveNexAnnotationSession,
  subscribeNexAnnotationSession,
  updateNexAnnotationSession
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotationSession";
import {
  NexSynopsisCommentDialog,
  type NexSynopsisCommentDialogResult
} from "@renderer/appIde/DocumentPanels/Next/NexSynopsisCommentDialog";
import {
  NexEndOfLineCommentDialog,
  type NexEndOfLineCommentDialogResult
} from "@renderer/appIde/DocumentPanels/Next/NexEndOfLineCommentDialog";
import {
  NexLabelDialog,
  type NexLabelDialogLabel,
  type NexLabelDialogResult
} from "@renderer/appIde/DocumentPanels/Next/NexLabelDialog";
import {
  NexLabelsDialog,
  type NexLabelsDialogResult
} from "@renderer/appIde/DocumentPanels/Next/NexLabelsDialog";
import {
  NexOperandLabelDialog,
  type NexOperandLabelDialogResult
} from "@renderer/appIde/DocumentPanels/Next/NexOperandLabelDialog";
import {
  NexRegionDialog,
  type NexRegionDialogResult
} from "@renderer/appIde/DocumentPanels/Next/NexRegionDialog";
import {
  NexRegionsDialog,
  type NexRegionsDialogResult
} from "@renderer/appIde/DocumentPanels/Next/NexRegionsDialog";
import {
  getBankAnnotation,
  NEX_BANK_LAST_OFFSET,
  getNexBankAddressOffset,
  getNexBankOffsetIndex,
  type NexAnnotationOffsetIndex,
  type NexAnnotationLabel,
  type NexAnnotationLabelScope,
  type NexAnnotationRegion,
  type NexAnnotationRegionType,
  type NexBankAnnotation,
  type NexLineAnnotation,
  type NexOperandReference,
  type NexFileAnnotations
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
type NexAnnotateAction = "synopsis" | "comment" | "operand-label" | "clear";
type NexContextMenuAction =
  | NexAnnotateAction
  | "global-label"
  | "local-label"
  | "mark-disassembly"
  | "mark-bytes"
  | "mark-words"
  | "mark-skip";
type StaticDisassemblySelection = {
  anchorIndex: number;
  activeIndex: number;
};
type StaticDisassemblyContextTarget = {
  rowIndex: number;
  rangeStartIndex: number;
  rangeEndIndex: number;
  bankOffsetStart: number;
  bankOffsetEnd: number;
  canAssignOperandLabel: boolean;
  canClearRowAnnotations: boolean;
};

type StaticMemoryDumpOptions = {
  disassemblyEnabled?: boolean;
  disassOffset?: number;
  decimalView?: boolean;
  viewMode?: StaticDumpViewMode;
  nexAnnotationPath?: string;
  nexAnnotationBank?: number;
};

const STATIC_DUMP_ROW_ITEM_SIZE = 22;
const STATIC_DISASSEMBLY_ROW_ITEM_SIZE = 18;
const STATIC_DISASSEMBLY_FALLBACK_PAGE_ROWS = 16;

const staticDumpViewModeOptions: DropdownOption[] = [
  { value: "memory", label: "Memory" },
  { value: "disassembly", label: "Disassembly" }
];

const annotateOptions: ToolbarSplitButtonOption<NexAnnotateAction>[] = [
  {
    value: "synopsis",
    label: "Synopsis Comment...",
    iconName: "note",
    fill: "--color-command-icon"
  },
  {
    value: "comment",
    label: "End-of-Line Comment...",
    iconName: "pencil",
    fill: "--color-command-icon"
  },
  {
    value: "operand-label",
    label: "Assign Operand Label...",
    iconName: "symbol-event",
    fill: "--color-command-icon"
  },
  {
    value: "clear",
    label: "Clear Row Annotations",
    iconName: "circle-slash",
    fill: "--console-ansi-bright-red"
  }
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
  const appServices = useAppServices();
  const dialogs = useDialogs();
  const [currentViewState, setCurrentViewState] = useState<MemoryDumpViewState>(
    viewState ?? {}
  );
  const disassemblyEnabled = currentViewState.disassemblyEnabled ?? false;
  const viewMode: StaticDumpViewMode = disassemblyEnabled
    ? (currentViewState.viewMode ?? "memory")
    : "memory";
  const decimalView = currentViewState.decimalView ?? false;
  const disassOffset = currentViewState.disassOffset ?? 0;
  const [memoryJumpAddress, setMemoryJumpAddress] = useState<number>();
  const [disassemblyJumpAddress, setDisassemblyJumpAddress] = useState<number>();
  const [nexAnnotations, setNexAnnotations] = useState<NexFileAnnotations>();
  const [annotationLoading, setAnnotationLoading] = useState(false);
  const [annotationLoadError, setAnnotationLoadError] = useState<string>();
  const [annotationDirty, setAnnotationDirty] = useState(false);
  const [annotationSaveError, setAnnotationSaveError] = useState<string>();
  const [disassemblyItems, setDisassemblyItems] = useState<DisassemblyItem[]>([]);
  const [disassemblySelection, setDisassemblySelection] =
    useState<StaticDisassemblySelection>();
  const [disassemblyContextTarget, setDisassemblyContextTarget] =
    useState<StaticDisassemblyContextTarget>();
  const [contextMenuState, contextMenuApi] = useContextMenuState();
  const memoryVlApi = useRef<VListHandle>();
  const disassemblyVlApi = useRef<VListHandle>();
  const disassemblyListRef = useRef<HTMLDivElement>(null);
  const disassemblySelectionRef = useRef<StaticDisassemblySelection>();
  const nexAnnotationsRef = useRef<NexFileAnnotations>();
  const annotationDirtyRef = useRef(false);
  const annotationPathRef = useRef<string>();
  const pendingScrollPosition = useRef(viewState?.scrollPosition ?? 0);
  const pendingDisassemblyScrollPosition = useRef(viewState?.disassemblyScrollPosition ?? 0);
  const restoredInitialScroll = useRef(false);
  const restoredInitialDisassemblyScroll = useRef(false);
  const items = useMemo(() => createRowAddresses(contents.length, 16), [contents.length]);
  const selectedDisassemblyRange = useMemo(() => {
    if (!disassemblySelection) {
      return undefined;
    }
    return {
      start: Math.min(disassemblySelection.anchorIndex, disassemblySelection.activeIndex),
      end: Math.max(disassemblySelection.anchorIndex, disassemblySelection.activeIndex)
    };
  }, [disassemblySelection]);
  const annotationEnabled =
    !!currentViewState.nexAnnotationPath &&
    currentViewState.nexAnnotationBank !== undefined &&
    !!nexAnnotations;

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

  const setAnnotationDirtyState = useCallback((dirty: boolean) => {
    annotationDirtyRef.current = dirty;
    setAnnotationDirty(dirty);
    markDocumentAnnotationDirty(dirty);
  }, [markDocumentAnnotationDirty]);

  const changeViewState = useCallback((setter: (vs: MemoryDumpViewState) => void) => {
    setCurrentViewState((current) => {
      const newViewState = { ...current };
      setter(newViewState);
      return newViewState;
    });
  }, []);

  const publishNexAnnotations = useCallback((annotations: NexFileAnnotations) => {
    const annotationPath = currentViewState.nexAnnotationPath;
    if (annotationPath) {
      updateNexAnnotationSession(annotationPath, annotations);
    } else {
      nexAnnotationsRef.current = annotations;
      setNexAnnotations(annotations);
      setAnnotationSaveError(undefined);
      setAnnotationDirtyState(true);
    }
  }, [
    currentViewState.nexAnnotationPath,
    setAnnotationDirtyState
  ]);

  useEffect(() => {
    if (document?.id) {
      documentHubService.setDocumentViewState(document.id, currentViewState);
    }
  }, [currentViewState, document?.id, documentHubService]);

  useEffect(() => {
    annotationPathRef.current = currentViewState.nexAnnotationPath;
  }, [currentViewState.nexAnnotationPath]);

  useEffect(() => {
    nexAnnotationsRef.current = nexAnnotations;
  }, [nexAnnotations]);

  useEffect(() => {
    disassemblySelectionRef.current = disassemblySelection;
  }, [disassemblySelection]);

  useEffect(() => {
    if (!document?.id) return;
    documentHubService.setDocumentApi(document.id, {
      beforeDocumentDisposal: async () => {
        if (!annotationDirtyRef.current) {
          return true;
        }
        const annotationPath = annotationPathRef.current ?? "the annotation file";
        return window.confirm(
          `Discard unsaved annotation changes in ${annotationPath}?`
        );
      }
    });
    return () => {
      documentHubService.setDocumentApi(document.id, undefined);
    };
  }, [document?.id, documentHubService]);

  useEffect(() => {
    if (!memoryVlApi.current || memoryJumpAddress === undefined) return;
    memoryVlApi.current.scrollToIndex(Math.floor(memoryJumpAddress / 16), {
      align: "start"
    });
  }, [memoryJumpAddress]);

  useEffect(() => {
    const annotationPath = currentViewState.nexAnnotationPath;
    const bank = currentViewState.nexAnnotationBank;
    if (!annotationPath || bank === undefined) {
      nexAnnotationsRef.current = undefined;
      setNexAnnotations(undefined);
      setAnnotationLoading(false);
      setAnnotationLoadError(undefined);
      setAnnotationSaveError(undefined);
      setAnnotationDirtyState(false);
      return;
    }

    return subscribeNexAnnotationSession(
      appServices.projectService,
      annotationPath,
      bank,
      (snapshot) => {
        nexAnnotationsRef.current = snapshot.annotations;
        setNexAnnotations(snapshot.annotations);
        setAnnotationLoading(snapshot.loading);
        setAnnotationLoadError(snapshot.loadError);
        setAnnotationSaveError(snapshot.saveError);
        setAnnotationDirtyState(snapshot.dirty);
        const bankAnnotation = snapshot.annotations
          ? getBankAnnotation(snapshot.annotations, bank)
          : undefined;
        if (bankAnnotation) {
          setCurrentViewState((current) => {
            const nextViewState = { ...current };
            let changed = false;
            const nextDisassOffset = getNexBankAddressOffset(bankAnnotation.offsetIndex);
            if (nextViewState.disassOffset !== nextDisassOffset) {
              nextViewState.disassOffset = nextDisassOffset;
              changed = true;
            }
            if (
              bankAnnotation.decimalView !== undefined &&
              nextViewState.decimalView !== bankAnnotation.decimalView
            ) {
              nextViewState.decimalView = bankAnnotation.decimalView;
              changed = true;
            }
            if (bankAnnotation.lastView && nextViewState.viewMode !== bankAnnotation.lastView) {
              nextViewState.viewMode = bankAnnotation.lastView;
              changed = true;
            }
            return changed ? nextViewState : current;
          });
        }
      }
    );
  }, [
    appServices.projectService,
    currentViewState.nexAnnotationBank,
    currentViewState.nexAnnotationPath,
    setAnnotationDirtyState
  ]);

  const saveAnnotations = useCallback(async () => {
    const annotationsToSave = nexAnnotationsRef.current;
    if (!annotationsToSave || !currentViewState.nexAnnotationPath) return;
    await saveNexAnnotationSession(
      appServices.projectService,
      currentViewState.nexAnnotationPath
    );
  }, [
    appServices.projectService,
    currentViewState.nexAnnotationPath
  ]);

  const updateAnnotatedBankSettings = useCallback((
    patch: {
      lastView?: StaticDumpViewMode;
      decimalView?: boolean;
      offsetIndex?: NexAnnotationOffsetIndex;
    }
  ) => {
    const annotationBank = currentViewState.nexAnnotationBank;
    if (annotationBank === undefined) {
      return;
    }
    const currentAnnotations = nexAnnotationsRef.current;
    if (!currentAnnotations) {
      return;
    }
    const bankKey = String(annotationBank);
    const bankAnnotation = getBankAnnotation(currentAnnotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }

    const nextBankAnnotation = { ...bankAnnotation };
    let changed = false;
    if (patch.lastView !== undefined && nextBankAnnotation.lastView !== patch.lastView) {
      nextBankAnnotation.lastView = patch.lastView;
      changed = true;
    }
    if (
      patch.decimalView !== undefined &&
      nextBankAnnotation.decimalView !== patch.decimalView
    ) {
      nextBankAnnotation.decimalView = patch.decimalView;
      changed = true;
    }
    if (
      patch.offsetIndex !== undefined &&
      nextBankAnnotation.offsetIndex !== patch.offsetIndex
    ) {
      nextBankAnnotation.offsetIndex = patch.offsetIndex;
      changed = true;
    }
    if (!changed) {
      return;
    }

    const updatedAnnotations: NexFileAnnotations = {
      ...currentAnnotations,
      banks: {
        ...currentAnnotations.banks,
        [bankKey]: nextBankAnnotation
      }
    };
    publishNexAnnotations(updatedAnnotations);
  }, [
    currentViewState.nexAnnotationBank,
    publishNexAnnotations
  ]);

  const changeViewMode = useCallback((nextView: StaticDumpViewMode) => {
    changeViewState((vs) => (vs.viewMode = nextView));
    updateAnnotatedBankSettings({ lastView: nextView });
  }, [changeViewState, updateAnnotatedBankSettings]);

  const changeDecimalView = useCallback((nextDecimalView: boolean) => {
    changeViewState((vs) => (vs.decimalView = nextDecimalView));
    updateAnnotatedBankSettings({ decimalView: nextDecimalView });
  }, [changeViewState, updateAnnotatedBankSettings]);

  const changeDisassemblyOffset = useCallback((nextOffset: number) => {
    changeViewState((vs) => (vs.disassOffset = nextOffset));
    const offsetIndex = getNexBankOffsetIndex(nextOffset);
    if (offsetIndex !== undefined) {
      updateAnnotatedBankSettings({ offsetIndex });
    }
  }, [changeViewState, updateAnnotatedBankSettings]);

  const selectDisassemblyRow = useCallback((index: number, extendSelection: boolean) => {
    setDisassemblySelection((current) => {
      const anchorIndex = extendSelection && current ? current.anchorIndex : index;
      const nextSelection = {
        anchorIndex,
        activeIndex: index
      };
      disassemblySelectionRef.current = nextSelection;
      return nextSelection;
    });
  }, []);

  const clearDisassemblySelection = useCallback(() => {
    disassemblySelectionRef.current = undefined;
    setDisassemblySelection(undefined);
  }, []);

  const moveDisassemblySelection = useCallback((
    delta: number,
    extendSelection: boolean
  ) => {
    if (disassemblyItems.length === 0) {
      return;
    }
    const fromIndex = disassemblySelectionRef.current?.activeIndex ?? 0;
    const nextIndex = Math.max(0, Math.min(disassemblyItems.length - 1, fromIndex + delta));
    selectDisassemblyRow(nextIndex, extendSelection);
    disassemblyVlApi.current?.scrollToIndex(nextIndex, {
      align: "nearest"
    });
    disassemblyListRef.current?.focus();
  }, [disassemblyItems.length, selectDisassemblyRow]);

  const handleDisassemblyListKeyDown = useCallback((
    event: KeyboardEvent<HTMLDivElement>
  ) => {
    const pageRows = Math.max(
      1,
      Math.floor(
        (disassemblyListRef.current?.clientHeight ?? 0) / STATIC_DISASSEMBLY_ROW_ITEM_SIZE
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
        moveDisassemblySelection(-(disassemblySelectionRef.current?.activeIndex ?? 0), event.shiftKey);
        break;
      case "End":
        event.preventDefault();
        event.stopPropagation();
        moveDisassemblySelection(
          disassemblyItems.length - 1 - (disassemblySelectionRef.current?.activeIndex ?? 0),
          event.shiftKey
        );
        break;
    }
  }, [disassemblyItems.length, moveDisassemblySelection]);

  const getDisassemblyContextTarget = useCallback((
    index: number
  ): StaticDisassemblyContextTarget | undefined => {
    const clickedItem = disassemblyItems[index];
    if (!clickedItem?.annotation) {
      return undefined;
    }

    const useSelectedRange =
      !!selectedDisassemblyRange &&
      index >= selectedDisassemblyRange.start &&
      index <= selectedDisassemblyRange.end;
    const rangeStartIndex = useSelectedRange ? selectedDisassemblyRange.start : index;
    const rangeEndIndex = useSelectedRange ? selectedDisassemblyRange.end : index;
    const sourceRows = disassemblyItems
      .slice(rangeStartIndex, rangeEndIndex + 1)
      .filter((item) => !!item.annotation);

    const bankOffsetStart = Math.min(
      ...sourceRows.map((item) => item.annotation!.bankOffset)
    );
    const bankOffsetEnd = Math.max(
      ...sourceRows.map(
        (item) => item.annotation!.bankOffset + item.annotation!.byteLength - 1
      )
    );

    return {
      rowIndex: index,
      rangeStartIndex,
      rangeEndIndex,
      bankOffsetStart,
      bankOffsetEnd,
      canAssignOperandLabel: !clickedItem.isPrefixItem && !!clickedItem.operandCandidates?.length,
      canClearRowAnnotations: sourceRows.some((item) => !!item.annotation?.hasLineAnnotation)
    };
  }, [disassemblyItems, selectedDisassemblyRange]);

  const updateLineAnnotation = useCallback((
    bankOffset: number,
    update: (annotation: NexLineAnnotation) => NexLineAnnotation
  ) => {
    const annotationBank = currentViewState.nexAnnotationBank;
    const currentAnnotations = nexAnnotationsRef.current;
    if (!currentAnnotations || annotationBank === undefined) {
      return;
    }
    const bankAnnotation = getBankAnnotation(currentAnnotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }

    const offsetKey = String(bankOffset);
    const currentLineAnnotations = bankAnnotation.lineAnnotations ?? {};
    const currentLineAnnotation = currentLineAnnotations[offsetKey] ?? {};
    const nextLineAnnotation = update({ ...currentLineAnnotation });

    const nextLineAnnotations = {
      ...currentLineAnnotations
    };
    if (nextLineAnnotation.synopsis || nextLineAnnotation.comment) {
      nextLineAnnotations[offsetKey] = nextLineAnnotation;
    } else {
      delete nextLineAnnotations[offsetKey];
    }

    const nextBankAnnotation = {
      ...bankAnnotation
    };
    if (Object.keys(nextLineAnnotations).length > 0) {
      nextBankAnnotation.lineAnnotations = nextLineAnnotations;
    } else {
      delete nextBankAnnotation.lineAnnotations;
    }

    const updatedAnnotations: NexFileAnnotations = {
      ...currentAnnotations,
      banks: {
        ...currentAnnotations.banks,
        [String(annotationBank)]: nextBankAnnotation
      }
    };
    publishNexAnnotations(updatedAnnotations);
  }, [
    currentViewState.nexAnnotationBank,
    publishNexAnnotations
  ]);

  const setSynopsisComment = useCallback((bankOffset: number, synopsis?: string) => {
    updateLineAnnotation(bankOffset, (currentLineAnnotation) => {
      const nextLineAnnotation: NexLineAnnotation = {
        ...currentLineAnnotation
      };
      if (synopsis) {
        nextLineAnnotation.synopsis = synopsis;
      } else {
        delete nextLineAnnotation.synopsis;
      }
      return nextLineAnnotation;
    });
  }, [updateLineAnnotation]);

  const setEndOfLineComment = useCallback((bankOffset: number, comment?: string) => {
    updateLineAnnotation(bankOffset, (currentLineAnnotation) => {
      const nextLineAnnotation: NexLineAnnotation = {
        ...currentLineAnnotation
      };
      if (comment) {
        nextLineAnnotation.comment = comment;
      } else {
        delete nextLineAnnotation.comment;
      }
      return nextLineAnnotation;
    });
  }, [updateLineAnnotation]);

  const getGeneratedDisassemblyItemForRow = useCallback((rowIndex: number) => {
    const item = disassemblyItems[rowIndex];
    if (!item?.annotation) {
      return undefined;
    }
    if (!item.isPrefixItem) {
      return item;
    }

    const bankOffset = item.annotation.bankOffset;
    return disassemblyItems
      .slice(rowIndex + 1)
      .find((candidate) =>
        !candidate.isPrefixItem &&
        candidate.annotation?.bankOffset === bankOffset
      );
  }, [disassemblyItems]);

  const createLabelDialogLabels = useCallback((
    annotations: NexFileAnnotations,
    annotationBank: number
  ): NexLabelDialogLabel[] => {
    const bankAnnotation = getBankAnnotation(annotations, annotationBank);
    return [
      ...(annotations.globalLabels ?? []).map((label) => {
        const referenceCount = countLabelReferences(
          annotations,
          annotationBank,
          "global",
          label.name
        );
        return {
          ...label,
          scope: "global" as const,
          referenced: referenceCount > 0,
          referenceCount
        };
      }),
      ...(bankAnnotation?.localLabels ?? []).map((label) => {
        const referenceCount = countLabelReferences(
          annotations,
          annotationBank,
          "local",
          label.name
        );
        return {
          ...label,
          scope: "local" as const,
          bank: annotationBank,
          referenced: referenceCount > 0,
          referenceCount
        };
      })
    ];
  }, []);

  const applyLabelDialogResult = useCallback((result: NexLabelDialogResult) => {
    const annotationBank = currentViewState.nexAnnotationBank;
    const currentAnnotations = nexAnnotationsRef.current;
    if (!currentAnnotations || annotationBank === undefined) {
      return;
    }
    const bankAnnotation = getBankAnnotation(currentAnnotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }

    if (result.action === "delete" && !result.originalLabel) {
      return;
    }

    const referenceCount = result.action === "delete"
      ? countLabelReferences(currentAnnotations, annotationBank, result.scope, result.name)
      : 0;
    if (referenceCount > 0) {
      const confirmed = window.confirm(
        `Delete ${result.name} and clear ${referenceCount} operand reference${
          referenceCount === 1 ? "" : "s"
        }?`
      );
      if (!confirmed) {
        return;
      }
    }

    let nextGlobalLabels = [...(currentAnnotations.globalLabels ?? [])];
    let nextBankAnnotation = {
      ...bankAnnotation,
      localLabels: [...(bankAnnotation.localLabels ?? [])]
    };

    if (result.originalLabel) {
      if (result.originalLabel.scope === "global") {
        nextGlobalLabels = removeLabel(nextGlobalLabels, result.originalLabel);
      } else {
        nextBankAnnotation.localLabels = removeLabel(
          nextBankAnnotation.localLabels,
          result.originalLabel
        );
      }
    }

    if (result.action === "save") {
      const nextLabel: NexAnnotationLabel = {
        name: result.name,
        value: result.value
      };
      if (result.scope === "global") {
        nextGlobalLabels.push(nextLabel);
      } else {
        nextBankAnnotation.localLabels.push(nextLabel);
      }
    }

    if (nextBankAnnotation.localLabels.length === 0) {
      delete nextBankAnnotation.localLabels;
    }

    let nextBanks: Record<string, NexBankAnnotation> = {
      ...currentAnnotations.banks,
      [String(annotationBank)]: nextBankAnnotation
    };
    if (result.action === "delete") {
      nextBanks = removeLabelOperandReferencesFromBanks(
        nextBanks,
        annotationBank,
        result.scope,
        result.name
      );
    }

    const updatedAnnotations: NexFileAnnotations = {
      ...currentAnnotations,
      banks: nextBanks
    };
    if (nextGlobalLabels.length > 0 || currentAnnotations.globalLabels) {
      updatedAnnotations.globalLabels = nextGlobalLabels;
    } else {
      delete updatedAnnotations.globalLabels;
    }

    publishNexAnnotations(updatedAnnotations);
  }, [
    currentViewState.nexAnnotationBank,
    publishNexAnnotations
  ]);

  const applyOperandLabelDialogResult = useCallback((
    bankOffset: number,
    result: NexOperandLabelDialogResult
  ) => {
    const annotationBank = currentViewState.nexAnnotationBank;
    const currentAnnotations = nexAnnotationsRef.current;
    if (!currentAnnotations || annotationBank === undefined) {
      return;
    }
    const bankAnnotation = getBankAnnotation(currentAnnotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }

    let nextGlobalLabels = [...(currentAnnotations.globalLabels ?? [])];
    let nextBankAnnotation: NexBankAnnotation = {
      ...bankAnnotation,
      localLabels: bankAnnotation.localLabels ? [...bankAnnotation.localLabels] : undefined
    };
    if (result.action === "create-label") {
      const nextLabel: NexAnnotationLabel = {
        name: result.name,
        value: result.value
      };
      if (result.scope === "global") {
        nextGlobalLabels = addLabelIfMissing(nextGlobalLabels, nextLabel);
      } else {
        nextBankAnnotation.localLabels = addLabelIfMissing(
          nextBankAnnotation.localLabels ?? [],
          nextLabel
        );
      }
    }

    const nextOperandReferences = {
      ...(bankAnnotation.operandReferences ?? {})
    };
    const offsetKey = String(bankOffset);
    const remainingReferences = (nextOperandReferences[offsetKey] ?? [])
      .filter((reference) => reference.operandIndex !== result.operandIndex);

    if (result.action === "apply" || result.action === "create-label") {
      const nextReference: NexOperandReference = {
        operandIndex: result.operandIndex,
        scope: result.scope,
        name: result.name
      };
      nextOperandReferences[offsetKey] = [...remainingReferences, nextReference]
        .sort((left, right) => left.operandIndex - right.operandIndex);
    } else if (remainingReferences.length > 0) {
      nextOperandReferences[offsetKey] = remainingReferences;
    } else {
      delete nextOperandReferences[offsetKey];
    }

    if (Object.keys(nextOperandReferences).length > 0) {
      nextBankAnnotation.operandReferences = nextOperandReferences;
    } else {
      delete nextBankAnnotation.operandReferences;
    }

    if (nextBankAnnotation.localLabels?.length === 0) {
      delete nextBankAnnotation.localLabels;
    }

    const updatedAnnotations: NexFileAnnotations = {
      ...currentAnnotations,
      banks: {
        ...currentAnnotations.banks,
        [String(annotationBank)]: nextBankAnnotation
      }
    };
    if (nextGlobalLabels.length > 0 || currentAnnotations.globalLabels) {
      updatedAnnotations.globalLabels = nextGlobalLabels;
    } else {
      delete updatedAnnotations.globalLabels;
    }

    publishNexAnnotations(updatedAnnotations);
  }, [
    currentViewState.nexAnnotationBank,
    publishNexAnnotations
  ]);

  const applyRegionDialogResult = useCallback((result: NexRegionDialogResult) => {
    const annotationBank = currentViewState.nexAnnotationBank;
    const currentAnnotations = nexAnnotationsRef.current;
    if (!currentAnnotations || annotationBank === undefined) {
      return;
    }
    const bankAnnotation = getBankAnnotation(currentAnnotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }
    if (
      result.start === 0 &&
      result.end === NEX_BANK_LAST_OFFSET &&
      !window.confirm("This changes the entire 16K bank. Continue?")
    ) {
      return;
    }

    const nextBankAnnotation: NexBankAnnotation = {
      ...bankAnnotation,
      regions: replaceAnnotationRegion(
        bankAnnotation.regions,
        result.start,
        result.end,
        result.type
      )
    };
    const updatedAnnotations: NexFileAnnotations = {
      ...currentAnnotations,
      banks: {
        ...currentAnnotations.banks,
        [String(annotationBank)]: nextBankAnnotation
      }
    };

    publishNexAnnotations(updatedAnnotations);
    clearDisassemblySelection();
  }, [
    clearDisassemblySelection,
    currentViewState.nexAnnotationBank,
    publishNexAnnotations
  ]);

  const openSynopsisCommentDialog = useCallback(async (rowIndex: number | undefined) => {
    if (rowIndex === undefined) {
      return;
    }
    const item = disassemblyItems[rowIndex];
    const annotationBank = currentViewState.nexAnnotationBank;
    const annotations = nexAnnotationsRef.current;
    if (!item?.annotation || annotationBank === undefined || !annotations) {
      return;
    }
    const bankAnnotation = getBankAnnotation(annotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }

    const bankOffset = item.annotation.bankOffset;
    const result = await dialogs.open<NexSynopsisCommentDialogResult, {
      bank: number;
      bankOffset: number;
      effectiveAddress: number;
      initialSynopsis?: string;
    }>(
      NexSynopsisCommentDialog,
      {
        bank: annotationBank,
        bankOffset,
        effectiveAddress: (disassOffset + bankOffset) & 0xffff,
        initialSynopsis: bankAnnotation.lineAnnotations?.[String(bankOffset)]?.synopsis
      },
      {
        title: "Synopsis Comment",
        width: 520
      }
    );
    if (result) {
      setSynopsisComment(bankOffset, result.synopsis);
    }
  }, [
    currentViewState.nexAnnotationBank,
    dialogs,
    disassOffset,
    disassemblyItems,
    setSynopsisComment
  ]);

  const openEndOfLineCommentDialog = useCallback(async (rowIndex: number | undefined) => {
    if (rowIndex === undefined) {
      return;
    }
    const item = getGeneratedDisassemblyItemForRow(rowIndex);
    const annotationBank = currentViewState.nexAnnotationBank;
    const annotations = nexAnnotationsRef.current;
    if (!item?.annotation || annotationBank === undefined || !annotations) {
      return;
    }
    const bankAnnotation = getBankAnnotation(annotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }

    const bankOffset = item.annotation.bankOffset;
    const result = await dialogs.open<NexEndOfLineCommentDialogResult, {
      bank: number;
      bankOffset: number;
      effectiveAddress: number;
      instruction: string;
      generatedHardComment?: string;
      initialComment?: string;
    }>(
      NexEndOfLineCommentDialog,
      {
        bank: annotationBank,
        bankOffset,
        effectiveAddress: (disassOffset + bankOffset) & 0xffff,
        instruction: item.instruction ?? "",
        generatedHardComment: item.annotation.generatedHardComment,
        initialComment: bankAnnotation.lineAnnotations?.[String(bankOffset)]?.comment
      },
      {
        title: "End-of-Line Comment",
        width: 520
      }
    );
    if (result) {
      setEndOfLineComment(bankOffset, result.comment);
    }
  }, [
    currentViewState.nexAnnotationBank,
    dialogs,
    disassOffset,
    getGeneratedDisassemblyItemForRow,
    setEndOfLineComment
  ]);

  const openLabelDialogForValues = useCallback(async (
    initialScope: NexAnnotationLabelScope,
    initialGlobalValue: number,
    initialLocalValue: number
  ) => {
    const annotationBank = currentViewState.nexAnnotationBank;
    const annotations = nexAnnotationsRef.current;
    if (annotationBank === undefined || !annotations) {
      return;
    }

    const result = await dialogs.open<NexLabelDialogResult, {
      bank: number;
      initialScope: NexAnnotationLabelScope;
      initialGlobalValue: number;
      initialLocalValue: number;
      labels: NexLabelDialogLabel[];
    }>(
      NexLabelDialog,
      {
        bank: annotationBank,
        initialScope,
        initialGlobalValue,
        initialLocalValue,
        labels: createLabelDialogLabels(annotations, annotationBank)
      },
      {
        title: "Label",
        width: 620
      }
    );
    if (result) {
      applyLabelDialogResult(result);
    }
  }, [
    applyLabelDialogResult,
    createLabelDialogLabels,
    currentViewState.nexAnnotationBank,
    dialogs
  ]);

  const openLabelDialog = useCallback(async (
    rowIndex: number | undefined,
    initialScope: NexAnnotationLabelScope
  ) => {
    if (rowIndex === undefined) {
      return;
    }
    const item = disassemblyItems[rowIndex];
    if (!item?.annotation) {
      return;
    }

    const bankOffset = item.annotation.bankOffset;
    await openLabelDialogForValues(
      initialScope,
      (disassOffset + bankOffset) & 0xffff,
      bankOffset
    );
  }, [
    disassOffset,
    disassemblyItems,
    openLabelDialogForValues
  ]);

  const openOperandLabelDialog = useCallback(async (rowIndex: number | undefined) => {
    if (rowIndex === undefined) {
      return;
    }
    const item = getGeneratedDisassemblyItemForRow(rowIndex);
    const annotationBank = currentViewState.nexAnnotationBank;
    const annotations = nexAnnotationsRef.current;
    if (
      !item?.annotation ||
      !item.operandCandidates?.length ||
      annotationBank === undefined ||
      !annotations
    ) {
      return;
    }
    const bankAnnotation = getBankAnnotation(annotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }

    const bankOffset = item.annotation.bankOffset;
    const result = await dialogs.open<NexOperandLabelDialogResult, {
      bank: number;
      bankAddressOffset: number;
      instruction: string;
      operands: typeof item.operandCandidates;
      explicitReferences?: NexOperandReference[];
      labels: NexLabelDialogLabel[];
    }>(
      NexOperandLabelDialog,
      {
        bank: annotationBank,
        bankAddressOffset: disassOffset,
        instruction: item.instruction ?? "",
        operands: item.operandCandidates,
        explicitReferences: bankAnnotation.operandReferences?.[String(bankOffset)],
        labels: createLabelDialogLabels(annotations, annotationBank)
      },
      {
        title: "Operand Label Reference",
        width: 640
      }
    );
    if (result) {
      applyOperandLabelDialogResult(bankOffset, result);
    }
  }, [
    applyOperandLabelDialogResult,
    createLabelDialogLabels,
    currentViewState.nexAnnotationBank,
    dialogs,
    disassOffset,
    getGeneratedDisassemblyItemForRow
  ]);

  const openRegionDialogForValues = useCallback(async (
    initialType: NexAnnotationRegionType,
    initialStart: number,
    initialEnd: number
  ) => {
    const annotationBank = currentViewState.nexAnnotationBank;
    const annotations = nexAnnotationsRef.current;
    if (annotationBank === undefined || !annotations) {
      return;
    }
    const bankAnnotation = getBankAnnotation(annotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }

    const result = await dialogs.open<NexRegionDialogResult, {
      initialType: NexAnnotationRegionType;
      initialStart: number;
      initialEnd: number;
      regions: NexAnnotationRegion[];
      bytes: number[];
    }>(
      NexRegionDialog,
      {
        initialType,
        initialStart,
        initialEnd,
        regions: bankAnnotation.regions,
        bytes: Array.from(contents)
      },
      {
        title: "Memory Region",
        width: 620
      }
    );
    if (result) {
      applyRegionDialogResult(result);
    }
  }, [
    applyRegionDialogResult,
    contents,
    currentViewState.nexAnnotationBank,
    dialogs
  ]);

  const openRegionDialog = useCallback(async (
    target: StaticDisassemblyContextTarget | undefined,
    initialType?: NexAnnotationRegionType
  ) => {
    const annotationBank = currentViewState.nexAnnotationBank;
    const annotations = nexAnnotationsRef.current;
    if (!target || annotationBank === undefined || !annotations) {
      return;
    }
    const bankAnnotation = getBankAnnotation(annotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }
    await openRegionDialogForValues(
      initialType ?? getRegionTypeForSpan(
        bankAnnotation.regions,
        target.bankOffsetStart,
        target.bankOffsetEnd
      ),
      target.bankOffsetStart,
      target.bankOffsetEnd
    );
  }, [
    currentViewState.nexAnnotationBank,
    openRegionDialogForValues
  ]);

  const openManageRegionDialog = useCallback(async () => {
    const annotationBank = currentViewState.nexAnnotationBank;
    const annotations = nexAnnotationsRef.current;
    const activeIndex = disassemblySelectionRef.current?.activeIndex;
    const activeItem = activeIndex !== undefined ? disassemblyItems[activeIndex] : undefined;
    const activeOffset = activeItem?.annotation?.bankOffset;
    if (annotationBank === undefined || !annotations || activeOffset === undefined) {
      return;
    }
    const bankAnnotation = getBankAnnotation(annotations, annotationBank);
    if (!bankAnnotation) {
      return;
    }

    const result = await dialogs.open<NexRegionsDialogResult, {
      activeOffset?: number;
      bytes: number[];
      regions: NexAnnotationRegion[];
    }>(
      NexRegionsDialog,
      {
        activeOffset,
        bytes: Array.from(contents),
        regions: bankAnnotation.regions
      },
      {
        title: "Regions",
        width: 840
      }
    );
    if (!result) {
      return;
    }

    if (result.action === "go-to") {
      const address = (disassOffset + result.region.start) & 0xffff;
      changeViewState((vs) => (vs.topAddress = address));
      setDisassemblyJumpAddress(address);
    } else if (result.action === "edit") {
      await openRegionDialogForValues(
        result.region.type,
        result.region.start,
        result.region.end
      );
    } else if (result.action === "split") {
      const splitStart = activeOffset >= result.region.start && activeOffset <= result.region.end
        ? activeOffset
        : result.region.start;
      const splitEnd = Math.min(
        result.region.end,
        splitStart + Math.max(1, activeItem?.annotation?.byteLength ?? 1) - 1
      );
      await openRegionDialogForValues(
        getAlternativeRegionType(result.region.type),
        splitStart,
        splitEnd
      );
    } else if (result.action === "add") {
      await openRegionDialogForValues(
        getAlternativeRegionType(
          getRegionTypeForSpan(bankAnnotation.regions, activeOffset, activeOffset)
        ),
        activeOffset,
        Math.min(
          NEX_BANK_LAST_OFFSET,
          activeOffset + Math.max(1, activeItem?.annotation?.byteLength ?? 1) - 1
        )
      );
    } else {
      applyRegionDialogResult({
        type: "disassemble",
        start: result.region.start,
        end: result.region.end
      });
    }
  }, [
    applyRegionDialogResult,
    changeViewState,
    contents,
    currentViewState.nexAnnotationBank,
    dialogs,
    disassOffset,
    disassemblyItems,
    openRegionDialogForValues
  ]);

  const openManageLabelsDialog = useCallback(async () => {
    const annotationBank = currentViewState.nexAnnotationBank;
    const annotations = nexAnnotationsRef.current;
    if (annotationBank === undefined || !annotations) {
      return;
    }

    const labels = createLabelDialogLabels(annotations, annotationBank);
    const result = await dialogs.open<NexLabelsDialogResult, {
      bank: number;
      bankAddressOffset: number;
      labels: NexLabelDialogLabel[];
    }>(
      NexLabelsDialog,
      {
        bank: annotationBank,
        bankAddressOffset: disassOffset,
        labels
      },
      {
        title: "Labels",
        width: 780
      }
    );
    if (!result) {
      return;
    }

    if (result.action === "go-to") {
      const address = result.label.scope === "local"
        ? (disassOffset + result.label.value) & 0xffff
        : result.label.value;
      changeViewState((vs) => (vs.topAddress = address));
      setDisassemblyJumpAddress(address);
    } else if (result.action === "add") {
      const activeIndex = disassemblySelectionRef.current?.activeIndex;
      const bankOffset = activeIndex !== undefined
        ? disassemblyItems[activeIndex]?.annotation?.bankOffset ?? 0
        : 0;
      await openLabelDialogForValues(
        result.scope,
        (disassOffset + bankOffset) & 0xffff,
        bankOffset
      );
    } else if (result.action === "edit") {
      await openLabelDialogForValues(
        result.label.scope,
        result.label.scope === "global"
          ? result.label.value
          : (disassOffset + result.label.value) & 0xffff,
        result.label.scope === "local"
          ? result.label.value
          : result.label.value & NEX_BANK_LAST_OFFSET
      );
    } else {
      applyLabelDialogResult({
        action: "delete",
        scope: result.label.scope,
        name: result.label.name,
        value: result.label.value,
        originalLabel: result.label
      });
    }
  }, [
    applyLabelDialogResult,
    changeViewState,
    createLabelDialogLabels,
    currentViewState.nexAnnotationBank,
    dialogs,
    disassOffset,
    disassemblyItems,
    openLabelDialogForValues
  ]);

  const openDisassemblyContextMenu = useCallback((
    index: number,
    event: MouseEvent<HTMLDivElement>
  ) => {
    if (!annotationEnabled) {
      return;
    }
    const target = getDisassemblyContextTarget(index);
    if (!target) {
      return;
    }
    event.preventDefault();
    setDisassemblyContextTarget(target);
    if (target.rangeStartIndex === index && target.rangeEndIndex === index) {
      selectDisassemblyRow(index, false);
    }
    contextMenuApi.show(event);
  }, [
    annotationEnabled,
    contextMenuApi,
    getDisassemblyContextTarget,
    selectDisassemblyRow
  ]);

  const runDisassemblyContextAction = useCallback(async (action: NexContextMenuAction) => {
    const target = disassemblyContextTarget;
    contextMenuApi.conceal();
    if (action === "synopsis") {
      await openSynopsisCommentDialog(target?.rowIndex);
    } else if (action === "comment") {
      await openEndOfLineCommentDialog(target?.rowIndex);
    } else if (action === "global-label") {
      await openLabelDialog(target?.rowIndex, "global");
    } else if (action === "local-label") {
      await openLabelDialog(target?.rowIndex, "local");
    } else if (action === "operand-label") {
      await openOperandLabelDialog(target?.rowIndex);
    } else if (action === "mark-disassembly") {
      await openRegionDialog(target, "disassemble");
    } else if (action === "mark-bytes") {
      await openRegionDialog(target, "bytes");
    } else if (action === "mark-words") {
      await openRegionDialog(target, "words");
    } else if (action === "mark-skip") {
      await openRegionDialog(target, "skip");
    }
  }, [
    contextMenuApi,
    disassemblyContextTarget,
    openEndOfLineCommentDialog,
    openLabelDialog,
    openOperandLabelDialog,
    openRegionDialog,
    openSynopsisCommentDialog
  ]);

  const runAnnotateToolbarAction = useCallback(async (action: NexAnnotateAction) => {
    if (action === "synopsis") {
      await openSynopsisCommentDialog(disassemblySelectionRef.current?.activeIndex);
    } else if (action === "comment") {
      await openEndOfLineCommentDialog(disassemblySelectionRef.current?.activeIndex);
    } else if (action === "operand-label") {
      await openOperandLabelDialog(disassemblySelectionRef.current?.activeIndex);
    }
  }, [
    openEndOfLineCommentDialog,
    openOperandLabelDialog,
    openSynopsisCommentDialog
  ]);

  useEffect(() => {
    if (!disassemblyEnabled || viewMode !== "disassembly") return;
    let cancelled = false;

    (async () => {
      const annotationItems = nexAnnotations && currentViewState.nexAnnotationBank !== undefined
        ? await createAnnotatedNexDisassemblyItems({
            annotations: nexAnnotations,
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
    nexAnnotations,
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
    <FullPanel fontFamily="--monospace-font" fontSize="0.8em">
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
        {currentViewState.nexAnnotationPath && (
          <>
            <LabelSeparator width={8} />
            {(annotationSaveError || annotationLoadError || (!annotationLoading && !annotationEnabled)) && (
              <span title={annotationSaveError ?? annotationLoadError ?? "Annotation file could not be loaded."}>
                <Icon
                  iconName="warning"
                  fill="--console-ansi-bright-red"
                  width={16}
                  height={16}
                />
              </span>
            )}
            <SmallIconButton
              iconName="save"
              title="Save annotations"
              enable={annotationDirty && !!nexAnnotations}
              fill={annotationDirty ? "--console-ansi-yellow" : undefined}
              clicked={saveAnnotations}
            />
            <SmallIconButton
              iconName="symbol-event"
              title="Manage Labels"
              enable={annotationEnabled}
              clicked={openManageLabelsDialog}
            />
            <SmallIconButton
              iconName="dump"
              title="Manage Regions"
              enable={annotationEnabled && disassemblySelection?.activeIndex !== undefined}
              clicked={openManageRegionDialog}
            />
            <ToolbarSplitButton
              options={annotateOptions}
              selectedValue="synopsis"
              enable={annotationEnabled}
              dropdownTitle="Annotate"
              onAction={runAnnotateToolbarAction}
            />
          </>
        )}
      </PanelHeader>
      <FullPanel>
        {contents && viewMode === "memory" ? (
          <VirtualizedList
            items={items}
            itemSize={STATIC_DUMP_ROW_ITEM_SIZE}
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
              if (!restoredInitialScroll.current && viewState?.scrollPosition) {
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
                      bytes={contents.subarray(item, item + 8)}
                      decimalView={false}
                      charDump={true}
                      lastJumpAddress={-1}
                    />
                    <MemoryDumpSection
                      address={item + 8}
                      bytes={contents.subarray(item + 8, item + 16)}
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
              itemSize={STATIC_DISASSEMBLY_ROW_ITEM_SIZE}
              overscan={25}
              revealUnmeasuredItems
              onScroll={(offset) => {
                pendingDisassemblyScrollPosition.current = offset;
              }}
              onScrollEnd={() => {
                const topPos = pendingDisassemblyScrollPosition.current;
                changeViewState((vs) => (vs.disassemblyScrollPosition = topPos));
              }}
              apiLoaded={(api) => {
                disassemblyVlApi.current = api;
                if (
                  !restoredInitialDisassemblyScroll.current &&
                  viewState?.disassemblyScrollPosition
                ) {
                  restoredInitialDisassemblyScroll.current = true;
                  requestAnimationFrame(() => {
                    api.scrollTo(viewState.disassemblyScrollPosition);
                  });
                }
              }}
              renderItem={(idx) => {
                const item = disassemblyItems[idx];
                if (!item) return <div></div>;
                const selected = disassemblySelection?.activeIndex === idx;
                const selectedRange =
                  !!selectedDisassemblyRange &&
                  idx >= selectedDisassemblyRange.start &&
                  idx <= selectedDisassemblyRange.end;

                return (
                  <DisassemblyRow
                    bankLabel={false}
                    currentSegment={0}
                    decimalView={decimalView}
                    index={idx}
                    isFullView={true}
                    item={item}
                    mem64kLabels={[]}
                    onClick={(event) => {
                      selectDisassemblyRow(idx, event.shiftKey);
                      disassemblyListRef.current?.focus();
                    }}
                    onContextMenu={(event) => openDisassemblyContextMenu(idx, event)}
                    partitionLabels={{}}
                    pausedPc={-1}
                    rowHeight={STATIC_DISASSEMBLY_ROW_ITEM_SIZE}
                    selected={selected}
                    selectedRange={selectedRange}
                    showBanks={false}
                  />
                );
              }}
            />
          </div>
        ) : null}
      </FullPanel>
      <ContextMenu state={contextMenuState} onClickOutside={contextMenuApi.conceal}>
        <ContextMenuItem
          text="Synopsis Comment..."
          clicked={() => runDisassemblyContextAction("synopsis")}
        />
        <ContextMenuItem
          text="End-of-Line Comment..."
          clicked={() => runDisassemblyContextAction("comment")}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          text="Add/Edit Global Label..."
          clicked={() => runDisassemblyContextAction("global-label")}
        />
        <ContextMenuItem
          text="Add/Edit Local Label..."
          clicked={() => runDisassemblyContextAction("local-label")}
        />
        <ContextMenuItem
          text="Assign Operand Label..."
          disabled={!disassemblyContextTarget?.canAssignOperandLabel}
          clicked={() => runDisassemblyContextAction("operand-label")}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          text="Mark As Disassembly"
          clicked={() => runDisassemblyContextAction("mark-disassembly")}
        />
        <ContextMenuItem
          text="Mark As Bytes"
          clicked={() => runDisassemblyContextAction("mark-bytes")}
        />
        <ContextMenuItem
          text="Mark As Words"
          clicked={() => runDisassemblyContextAction("mark-words")}
        />
        <ContextMenuItem
          text="Mark As Skip"
          clicked={() => runDisassemblyContextAction("mark-skip")}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          text="Clear Row Annotations"
          disabled={!disassemblyContextTarget?.canClearRowAnnotations}
          clicked={() => runDisassemblyContextAction("clear")}
        />
      </ContextMenu>
    </FullPanel>
  );
};

export const createStaticMemoryDump = ({ document, contents, viewState }: DocumentProps) => (
  <StaticMemoryDump document={document} contents={contents} viewState={viewState} />
);

function countLabelReferences(
  annotations: NexFileAnnotations,
  bank: number,
  scope: NexAnnotationLabelScope,
  name: string
): number {
  const banks = scope === "global"
    ? Object.values(annotations.banks)
    : [getBankAnnotation(annotations, bank)].filter(
        (bankAnnotation): bankAnnotation is NexBankAnnotation => !!bankAnnotation
      );

  return banks.reduce((count, bankAnnotation) => {
    const references = Object.values(bankAnnotation.operandReferences ?? {}).flat();
    return count + references.filter((reference) =>
      reference.scope === scope && reference.name === name
    ).length;
  }, 0);
}

function removeLabel(
  labels: NexAnnotationLabel[],
  labelToRemove: NexLabelDialogLabel
): NexAnnotationLabel[] {
  return labels.filter((label) =>
    label.name !== labelToRemove.name || label.value !== labelToRemove.value
  );
}

function addLabelIfMissing(
  labels: NexAnnotationLabel[],
  labelToAdd: NexAnnotationLabel
): NexAnnotationLabel[] {
  return labels.some((label) => label.name === labelToAdd.name)
    ? labels
    : [...labels, labelToAdd];
}

function replaceAnnotationRegion(
  regions: NexAnnotationRegion[],
  start: number,
  end: number,
  type: NexAnnotationRegionType
): NexAnnotationRegion[] {
  const nextRegions: NexAnnotationRegion[] = [];
  for (const region of regions) {
    if (region.end < start || region.start > end) {
      nextRegions.push({ ...region });
      continue;
    }
    if (region.start < start) {
      nextRegions.push({
        start: region.start,
        end: start - 1,
        type: region.type
      });
    }
    if (region.end > end) {
      nextRegions.push({
        start: end + 1,
        end: region.end,
        type: region.type
      });
    }
  }
  nextRegions.push({ start, end, type });
  return mergeAnnotationRegions(nextRegions);
}

function getRegionTypeForSpan(
  regions: NexAnnotationRegion[],
  start: number,
  end: number
): NexAnnotationRegionType {
  const intersectingRegions = regions.filter((region) => region.start <= end && region.end >= start);
  const firstRegion = intersectingRegions[0];
  return intersectingRegions.length > 0 &&
    intersectingRegions.every((region) => region.type === firstRegion.type)
    ? firstRegion.type
    : "disassemble";
}

function getAlternativeRegionType(type: NexAnnotationRegionType): NexAnnotationRegionType {
  return type === "disassemble" ? "bytes" : "disassemble";
}

function mergeAnnotationRegions(regions: NexAnnotationRegion[]): NexAnnotationRegion[] {
  const sortedRegions = [...regions].sort((left, right) =>
    left.start - right.start || left.end - right.end
  );
  const mergedRegions: NexAnnotationRegion[] = [];
  for (const region of sortedRegions) {
    const previousRegion = mergedRegions[mergedRegions.length - 1];
    if (
      previousRegion &&
      previousRegion.type === region.type &&
      previousRegion.end + 1 >= region.start
    ) {
      previousRegion.end = Math.max(previousRegion.end, region.end);
    } else {
      mergedRegions.push({ ...region });
    }
  }
  return mergedRegions;
}

function removeLabelOperandReferencesFromBanks(
  banks: Record<string, NexBankAnnotation>,
  bank: number,
  scope: NexAnnotationLabelScope,
  name: string
): Record<string, NexBankAnnotation> {
  const nextBanks: Record<string, NexBankAnnotation> = {};
  for (const [bankKey, bankAnnotation] of Object.entries(banks)) {
    if (scope === "local" && bankKey !== String(bank)) {
      nextBanks[bankKey] = bankAnnotation;
      continue;
    }
    nextBanks[bankKey] = removeLabelOperandReferences(bankAnnotation, scope, name);
  }
  return nextBanks;
}

function removeLabelOperandReferences(
  bankAnnotation: NexBankAnnotation,
  scope: NexAnnotationLabelScope,
  name: string
): NexBankAnnotation {
  if (!bankAnnotation.operandReferences) {
    return bankAnnotation;
  }

  const nextOperandReferences: NexBankAnnotation["operandReferences"] = {};
  for (const [offset, references] of Object.entries(bankAnnotation.operandReferences)) {
    const remainingReferences = references.filter((reference) =>
      reference.scope !== scope || reference.name !== name
    );
    if (remainingReferences.length > 0) {
      nextOperandReferences[offset] = remainingReferences;
    }
  }

  const nextBankAnnotation = {
    ...bankAnnotation
  };
  if (Object.keys(nextOperandReferences).length > 0) {
    nextBankAnnotation.operandReferences = nextOperandReferences;
  } else {
    delete nextBankAnnotation.operandReferences;
  }
  return nextBankAnnotation;
}

export async function openStaticMemoryDump(
  documentHubService: IDocumentHubService,
  dumpId: string,
  title: string,
  contents: Uint8Array,
  options: StaticMemoryDumpOptions = {}
): Promise<void> {
  const id = `memoryDump-${dumpId}`;
  if (documentHubService.isOpen(id)) {
    documentHubService.setActiveDocument(id);
  } else {
    await documentHubService.openDocument(
      {
        id,
        name: title,
        type: STATIC_MEMORY_DUMP_VIEWER,
        iconName: "memory-icon",
        iconFill: "--console-ansi-bright-magenta",
        contents
      },
      {
        disassemblyEnabled: options.disassemblyEnabled ?? false,
        disassOffset: options.disassOffset ?? 0,
        decimalView: options.decimalView,
        viewMode: options.viewMode,
        nexAnnotationPath: options.nexAnnotationPath,
        nexAnnotationBank: options.nexAnnotationBank
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
  const items = useMemo(
    () => createRowAddresses(displayLength, 16),
    [displayLength]
  );

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
