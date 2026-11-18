import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import {
  getDefaultDisassemblyOffsetForBank,
  getDefaultDisassemblyOffsetIndexForBank,
  getProgramCounterBank,
  getStackPointerBank
} from "./nexEntryState";
import { toHexa2, toHexa4 } from "../../services/ide-commands";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { MemoryDumpViewer } from "@renderer/controls/memory/MemoryDumpViewer";
import { Layer2Screen } from "@renderer/controls/Next/Layer2Screen";
import { getAbrgForPaletteCode } from "@emu/machines/zxNext/palette";
import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { Fact, FactCells, FactFlag, Facts, FactSection } from "@renderer/controls/data/FileFacts";
import { createElement, useEffect, useMemo, useState } from "react";
import styles from "./NexFileViewerPanel.module.scss";
import { loadNexFileContents, ScreenBlockFlags } from "./nexFileLoader";
import {
  nexBankDumpId,
  nexBankDumpTitle,
  nexLayer2ScreenDumpId,
  nexLayer2ScreenDumpTitle
} from "./nexBankDocument";
import {
  summarizeNexIssues,
  validateNexHeader,
  type NexIssue
} from "./nexValidation";
import { coreVersionOf, nextProfileOf } from "@emu/machines/zxNext/nextProfiles";
import { MF_BANK, MI_ZXNEXT } from "@common/machines/constants";
import { useNexBankBreakpointCounts } from "./useNexBankBreakpoints";
import type { NexFileContents, NexHeader } from "./nexFileLoader";
import { AppServices } from "@renderer/abstractions/AppServices";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { incExploreViewVersionAction } from "@common/state/actions";
import { Icon } from "@renderer/controls/Icon";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import {
  AnnotationSidecarPaths,
  AnnotationSidecarState,
  createAnnotationSidecar,
  getAnnotatedDecimalViewForBank,
  getAnnotatedDisassemblyOffsetForBank,
  getAnnotatedPopOutViewForBank,
  getAnnotationSidecarPaths,
  loadAnnotationSidecar
} from "@renderer/appIde/annotations/annotationSidecar";
import { getBankAnnotation, ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import { withBankComment } from "@renderer/appIde/annotations/annotationEdits";
import {
  NexBankBrowser,
  type NexBankBrowserItem,
  type NexBankFilter,
  type NexBankView
} from "./NexBankBrowser";
import { bankContentMix, bankLabels, isAnnotatedBank, isEmptyBank } from "./nexBankSummary";
import {
  peekAnnotationSession,
  seedAnnotationSession,
  subscribeAnnotationSession,
  updateAnnotationSession
} from "@renderer/appIde/annotations/annotationSession";
import { BANK_COMMENT_DIALOG_WIDTH, NexBankCommentDialog } from "./NexBankCommentDialog";
import { useT } from "@common/i18n/useT";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";

/*
 * M2: `ch`, not px.
 *
 * These were bare numbers until Phase 15, which `Label`/`Value` rendered as px while documenting
 * themselves as `ch`; that phase made the unit explicit without changing what they drew, and this
 * one converts them. Capacity is preserved from the px each reserved at the 12.8px size this panel
 * used to render at (px / 6.4, rounded up), so no column narrows — but they now follow the user's
 * font size, which is the whole point.
 */
const HEADER_LABEL_WIDTH = "22ch";
const SCREEN_FLAG_LABEL_WIDTH = "13ch";
const SCREEN_FLAG_CELL_WIDTH = "18ch";
const BANK_FLAG_LABEL_WIDTH = "4ch";
const BANK_FLAG_CELL_WIDTH = "8ch";

type NexAnnotationViewerState =
  | AnnotationSidecarState
  | {
      status: "loading" | "creating" | "unavailable";
      paths?: AnnotationSidecarPaths;
      annotations?: ProgramAnnotations;
      diagnostics: [];
      message?: string;
    };

type NexFileViewState = {
  headerAttrExpanded?: boolean;
  bankFlagsExpanded?: boolean;
  paletteExpanded?: boolean;
  layer2LoadingScreenExpanded?: boolean;
  ulaLoadingScreenExpanded?: boolean;
  loResLoadingScreenExpanded?: boolean;
  timexHiResLoadingScreenExpanded?: boolean;
  timexHiColLoadingScreenExpanded?: boolean;
  /** The bank the bank browser has selected. */
  selectedBank?: number;
  /** Which banks the bank browser lists. */
  bankFilter?: NexBankFilter;
  scrollPosition?: number;
};

const NexFileViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps<NexFileViewState>) => {
  return createElement(
    GenericFilePanel<NexFileContents, NexFileViewState>,
    {
      document,
      contents,
      viewState,
      fileLoader: loadNexFileContents,
      validRenderer: context => {
        return (
          <NexFileViewerContents
            document={document}
            fileInfo={context.fileInfo}
            // --- The live view state, not the one the document opened with: the bank browser's
            // --- selection and filter change it and must see the change.
            viewState={context.viewState}
            appServices={context.appServices}
            changeViewState={context.changeViewState}
          />
        );
      }
    }
  );
};

type NexFileViewerContentsProps = {
  document: ProjectDocumentState;
  fileInfo: NexFileContents;
  viewState?: NexFileViewState;
  appServices: AppServices;
  changeViewState: (setter: (vs: NexFileViewState) => void) => void;
};

const NexFileViewerContents = ({
  document,
  fileInfo: fi,
  viewState,
  appServices,
  changeViewState: change
}: NexFileViewerContentsProps) => {
  const t = useT();
  const h = fi.header;
  const cvs = viewState;
  const setBankFlagCount = useMemo(() => h.bankFlags.filter(Boolean).length, [h.bankFlags]);
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const { navigationHistoryService } = useAppServices();
  // --- Popping a bank out is going somewhere: Go Back returns to this viewer.
  const openRecorded = (open: () => Promise<void>) =>
    navigationHistoryService.recordJump("nexBank", open);
  const projectFolder = useSelector((s) => s.project?.folderPath);
  const emulatedMachineId = useSelector((s) => s.emulatorState?.machineId);
  const emulatedModelId = useSelector((s) => s.emulatorState?.modelId);
  const loadedBanks = useMemo(() => fi.bankData.map(([bank]) => bank), [fi.bankData]);
  // --- One listing for every bank row: a NEX can carry a hundred banks, and each asking the
  // --- emulator for itself would be a hundred IPC calls per breakpoint change.
  const bankBreakpointCounts = useNexBankBreakpointCounts();
  const layer2Palette = useMemo(
    () => fi.palette.map(v => getAbrgForPaletteCode(v)),
    [fi.palette]
  );
  const sidecarPaths = useMemo(() => getAnnotationSidecarPaths(document), [document]);
  const [annotationState, setAnnotationState] = useState<NexAnnotationViewerState>({
    status: sidecarPaths ? "loading" : "unavailable",
    paths: sidecarPaths,
    diagnostics: [],
    message: sidecarPaths ? "Loading annotations..." : "This document has no file path."
  });

  useEffect(() => {
    let cancelled = false;
    if (!sidecarPaths) {
      setAnnotationState({
        status: "unavailable",
        diagnostics: [],
        message: "This document has no file path."
      });
      return () => {
        cancelled = true;
      };
    }

    setAnnotationState({
      status: "loading",
      paths: sidecarPaths,
      diagnostics: [],
      message: "Loading annotations..."
    });
    loadAnnotationSidecar(appServices.projectService, sidecarPaths, loadedBanks).then((state) => {
      if (!cancelled) {
        setAnnotationState(state);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [appServices.projectService, sidecarPaths, loadedBanks]);

  const createAnnotation = async () => {
    if (!sidecarPaths) return;
    setAnnotationState({
      status: "creating",
      paths: sidecarPaths,
      diagnostics: [],
      message: "Creating annotation file..."
    });
    try {
      const state = await createAnnotationSidecar(appServices.projectService, sidecarPaths, {
        nexPath: document.node?.fullPath ?? document.path ?? document.id,
        nexFileName: document.name,
        loadedBanks,
        getDefaultOffsetIndex: (bank) => getDefaultDisassemblyOffsetIndexForBank(bank, h)
      });
      setAnnotationState(state);
      if (state.status === "loaded") {
        dispatch(incExploreViewVersionAction());
      }
    } catch (err) {
      setAnnotationState({
        status: "error",
        paths: sidecarPaths,
        diagnostics: [],
        message: err instanceof Error ? err.message : String(err)
      });
    }
  };

  /*
   * Follow the shared annotation session once the sidecar has loaded.
   *
   * The viewer used to read the sidecar once and keep that copy, which was enough while nothing it
   * showed could change behind it. A bank comment can: it is edited here *and* in a popped-out bank,
   * and the heading has to show the pop-out's edit without the NEX being reopened. The session is
   * where every open bank of this file already publishes, so the viewer subscribes to it too.
   *
   * The model this viewer just read seeds an empty session, so subscribing does not read the file a
   * second time; a session that already exists is left alone, being at least as current.
   */
  const loadedSidecarPath =
    annotationState.status === "loaded" ? annotationState.paths?.fullPath : undefined;
  const [sessionAnnotations, setSessionAnnotations] = useState<ProgramAnnotations>();
  useEffect(() => {
    if (annotationState.status !== "loaded" || !loadedSidecarPath) return undefined;
    seedAnnotationSession(loadedSidecarPath, annotationState.annotations);
    const unsubscribe = subscribeAnnotationSession(
      appServices.projectService,
      loadedSidecarPath,
      loadedBanks[0] ?? 0,
      (snapshot) => setSessionAnnotations(snapshot.annotations)
    );
    return () => {
      unsubscribe();
      setSessionAnnotations(undefined);
    };
  }, [annotationState, appServices.projectService, loadedBanks, loadedSidecarPath]);

  const loadedAnnotations =
    annotationState.status === "loaded"
      ? (sessionAnnotations ?? annotationState.annotations)
      : undefined;

  const dialogs = useDialogs();

  /*
   * Write a bank's comment through the session, which publishes it to every open bank and writes it.
   *
   * The model is re-read after the dialog closes rather than captured before it opened: the dialog
   * is modal but not exclusive, and a popped-out bank may have published while it was up.
   */
  const writeBankComment = (bank: number, comment: string | undefined) => {
    if (!loadedSidecarPath) return;
    const current = peekAnnotationSession(loadedSidecarPath) ?? loadedAnnotations;
    if (!current) return;
    const next = withBankComment(current, bank, comment);
    if (next) {
      updateAnnotationSession(loadedSidecarPath, next, appServices.projectService);
    }
  };

  const editBankComment = async (bank: number) => {
    if (!loadedSidecarPath || !loadedAnnotations) return;
    const bankAnnotation = getBankAnnotation(loadedAnnotations, bank);
    if (!bankAnnotation) return;
    const result = await dialogs.open(
      NexBankCommentDialog,
      { bank, initialComment: bankAnnotation.comment },
      { title: t("panels.next.bankComment.title"), width: BANK_COMMENT_DIALOG_WIDTH }
    );
    if (!result) return;
    writeBankComment(bank, result.comment);
  };

  /*
   * One summary per bank for the bank browser.
   *
   * Recomputed when the annotations or breakpoints change — an edit made in a popped-out bank reaches
   * the details straight away, through the shared session.
   */
  const bankItems = useMemo<NexBankBrowserItem[]>(
    () =>
      fi.bankData.map(([bank, bytes]) => {
        const bankAnnotation = loadedAnnotations ? getBankAnnotation(loadedAnnotations, bank) : undefined;
        const listedAt = getAnnotatedDisassemblyOffsetForBank(
          loadedAnnotations,
          bank,
          getDefaultDisassemblyOffsetForBank(bank, h)
        );
        return {
          bank,
          size: bytes.length,
          empty: isEmptyBank(bytes),
          annotated: isAnnotatedBank(loadedAnnotations, bank),
          hasAnnotation: !!bankAnnotation,
          pc: getProgramCounterBank(h) === bank ? h.programCounter : undefined,
          sp: getStackPointerBank(h) === bank ? h.stackPointer : undefined,
          breakpoints: bankBreakpointCounts.get(bank),
          comment: bankAnnotation?.comment,
          listedAt,
          lastView: (loadedAnnotations
            ? getAnnotatedPopOutViewForBank(loadedAnnotations, bank)
            : undefined) ?? "disassembly",
          spriteFormat:
            bankAnnotation?.sprites?.format ?? (bankAnnotation?.sprites?.active ? "8bit" : undefined),
          mix: bankAnnotation ? bankContentMix(bankAnnotation.regions) : undefined,
          labels: bankLabels(loadedAnnotations, bank, listedAt)
        };
      }),
    [bankBreakpointCounts, fi.bankData, h, loadedAnnotations]
  );

  /** Pop a bank out into its own document, in the view asked for. Recorded, so Go Back returns here. */
  const openBankDump = async (bank: number, view: NexBankView) => {
    const entry = fi.bankData.find(([b]) => b === bank);
    if (!entry || !document.node.fullPath) return;
    const annotated = !!loadedAnnotations;
    await openRecorded(() =>
      openStaticMemoryDump(
        documentHubService,
        // --- The full path, not the project path: it is the id the debugger's reveals use.
        nexBankDumpId(document.node.fullPath, bank),
        nexBankDumpTitle(document.node.fullPath, bank, projectFolder),
        entry[1],
        {
          disassemblyEnabled: true,
          disassOffset: getAnnotatedDisassemblyOffsetForBank(
            loadedAnnotations,
            bank,
            getDefaultDisassemblyOffsetForBank(bank, h)
          ),
          decimalView: getAnnotatedDecimalViewForBank(loadedAnnotations, bank, false),
          // --- Sprites needs the annotation file; without one the pop-out offers only the listings.
          viewMode: view === "sprites" && !annotated ? "disassembly" : view,
          annotationPath: annotated ? sidecarPaths?.fullPath : undefined,
          annotationBank: annotated ? bank : undefined
        }
      )
    );
  };

  /*
   * Checked against the machine, not in a vacuum: the core version the file asks for is only a
   * problem relative to the core the emulator provides. `MF_BANK` counts 8K pages, so the 16K bank
   * count is half of it.
   *
   * The *current* machine's features, not the Next's necessarily — a NEX can be opened in the
   * viewer with any machine selected, and then there is no bank count to compare against, which
   * `validateNexHeader` treats as "skip that check" rather than as zero banks.
   */
  const machineFeatures = appServices.machineService?.getMachineInfo()?.machine?.features;
  // --- The Next model the file would run on: the selected one, or the implicit one when another
  // --- machine is selected (`dev/ai/zxnext-models.md` D2)
  const nextProfile = nextProfileOf(emulatedMachineId === MI_ZXNEXT ? emulatedModelId : undefined);
  // --- Not memoized: a handful of comparisons, and its messages are in the display language, so a
  // --- language change (which re-renders through `useT`) must rewrite them.
  const validationIssues = validateNexHeader(h, {
    coreVersion: coreVersionOf(nextProfile),
    bankCount: (machineFeatures?.[MF_BANK] ?? 0) / 2 || undefined
  });

  return (
    <>
      {/*
        * What is wrong with this file, before you try to run it.
        *
        * Above the annotation banner because it is about the NEX itself rather than about Klive's
        * notes on it, and because an entry bank the file does not contain is the reason a launch
        * will fail — which is worth reading before anything else on the page.
        */}
      <NexValidationPanel issues={validationIssues} />
      <NexAnnotationPanel
        state={annotationState}
        onCreate={createAnnotation}
      />
      <FactSection
        title={t("panels.next.nex.headerAttributes")}
        expanded={cvs?.headerAttrExpanded ?? true}
        onExpandedChange={exp => change(vs => (vs.headerAttrExpanded = exp))}
      >
        <HeaderAttributes header={h} />
      </FactSection>
      {/*
        * The count rides in the heading as a chip, the way PC and SP do on a bank: it is a fact
        * about the section rather than part of its name. Only the count carries information — the
        * denominator is always 112 — so the chip shows that alone and the tooltip spells it out.
        */}
      <FactSection
        title={t("panels.next.nex.bankFlags")}
        meta={
          <span title={t("panels.next.nex.bankFlagsSet", { count: setBankFlagCount, total: h.bankFlags.length })}>
            {setBankFlagCount}
          </span>
        }
        expanded={cvs?.bankFlagsExpanded ?? false}
        onExpandedChange={exp => change(vs => (vs.bankFlagsExpanded = exp))}
      >
        {/* --- One flag per bank, as many to a line as the width takes */}
        <FactCells cellWidth={BANK_FLAG_CELL_WIDTH} labelWidth={BANK_FLAG_LABEL_WIDTH}>
          {h.bankFlags.map((f, idx) => (
            <FactFlag tone="state" key={idx} label={`#${toHexa2(idx)}:`} value={f} />
          ))}
        </FactCells>
      </FactSection>
      {fi.palette?.length > 0 && (
        <FactSection
          title={t("panels.next.nex.palette")}
          expanded={cvs?.paletteExpanded ?? false}
          onExpandedChange={exp =>
            change(vs => (vs.paletteExpanded = exp))
          }
        >
          <NextPaletteViewer
            palette={fi?.palette}
            cellSize={29}
            allowSelection={true}
          />
        </FactSection>
      )}
      {fi.layer2LoadingScreen?.length > 0 && (
        <FactSection
          title={t("panels.next.nex.layer2Screen")}
          actions={
            <SmallIconButton
              iconName='square-arrow-out-up-right'
              fill='--color-command-icon'
              title={t("panels.next.nex.openLayer2Screen")}
              clicked={async () => {
                if (!document.node.fullPath) return;
                await openRecorded(() =>
                  openStaticMemoryDump(
                    documentHubService,
                    nexLayer2ScreenDumpId(document.node.fullPath),
                    nexLayer2ScreenDumpTitle(document.node.fullPath, projectFolder),
                    fi.layer2LoadingScreen
                  )
                );
              }}
            />
          }
          expanded={cvs?.layer2LoadingScreenExpanded ?? false}
          onExpandedChange={exp =>
            change(vs => (vs.layer2LoadingScreenExpanded = exp))
          }
        >
          <Layer2Screen
            documentSource={document.node.projectPath}
            data={fi?.layer2LoadingScreen}
            palette={layer2Palette}
          />
        </FactSection>
      )}
      {fi.ulaLoadingScreen?.length > 0 && (
        <FactSection
          title={t("panels.next.nex.ulaScreen")}
          expanded={cvs?.ulaLoadingScreenExpanded ?? false}
          onExpandedChange={exp =>
            change(vs => (vs.ulaLoadingScreenExpanded = exp))
          }
        >
          <MemoryDumpViewer
            documentSource={document.node.projectPath}
            contents={fi?.ulaLoadingScreen}
            iconTitle={t("panels.next.nex.showDump", { screen: "ULA" })}
            idFactory={(documentSource: string) =>
              `ulaDump${documentSource}`
            }
            titleFactory={(documentSource: string) =>
              t("panels.next.dumpTitle.screen", { source: documentSource, screen: "ULA" })
            }
          />
        </FactSection>
      )}
      {fi.loResLoadingScreen?.length > 0 && (
        <FactSection
          title={t("panels.next.nex.loResScreen")}
          expanded={cvs?.loResLoadingScreenExpanded ?? false}
          onExpandedChange={exp =>
            change(vs => (vs.loResLoadingScreenExpanded = exp))
          }
        >
          <MemoryDumpViewer
            documentSource={document.node.projectPath}
            contents={fi?.loResLoadingScreen}
            iconTitle={t("panels.next.nex.showDump", { screen: "LoRes" })}
            idFactory={(documentSource: string) =>
              `loResDump${documentSource}`
            }
            titleFactory={(documentSource: string) =>
              t("panels.next.dumpTitle.screen", { source: documentSource, screen: "LoRes" })
            }
          />
        </FactSection>
      )}
      {fi.timexHiResLoadingScreen?.length > 0 && (
        <FactSection
          title={t("panels.next.nex.timexHiResScreen")}
          expanded={cvs?.timexHiResLoadingScreenExpanded ?? false}
          onExpandedChange={exp =>
            change(vs => (vs.timexHiResLoadingScreenExpanded = exp))
          }
        >
          <MemoryDumpViewer
            documentSource={document.node.projectPath}
            contents={fi?.timexHiResLoadingScreen}
            iconTitle={t("panels.next.nex.showDump", { screen: "Timex HiRes" })}
            idFactory={(documentSource: string) =>
              `timexHiResDump${documentSource}`
            }
            titleFactory={(documentSource: string) =>
              t("panels.next.dumpTitle.screen", { source: documentSource, screen: "Timex HiRes" })
            }
          />
        </FactSection>
      )}
      {fi.timexHiColLoadingScreen?.length > 0 && (
        <FactSection
          title={t("panels.next.nex.timexHiColScreen")}
          expanded={cvs?.timexHiColLoadingScreenExpanded ?? false}
          onExpandedChange={exp =>
            change(vs => (vs.timexHiColLoadingScreenExpanded = exp))
          }
        >
          <MemoryDumpViewer
            documentSource={document.node.projectPath}
            contents={fi?.timexHiColLoadingScreen}
            iconTitle={t("panels.next.nex.showDump", { screen: "Timex HiCol" })}
            idFactory={(documentSource: string) =>
              `timexHiColDump${documentSource}`
            }
            titleFactory={(documentSource: string) =>
              t("panels.next.dumpTitle.screen", { source: documentSource, screen: "Timex Hicol" })
            }
          />
        </FactSection>
      )}
      <NexBankBrowser
        items={bankItems}
        selectedBank={cvs?.selectedBank}
        filter={cvs?.bankFilter ?? "all"}
        spritesAvailable={!!loadedAnnotations}
        onSelect={(bank) => change((vs) => (vs.selectedBank = bank))}
        onFilterChange={(filter) => change((vs) => (vs.bankFilter = filter))}
        onPopOut={(bank, view) => void openBankDump(bank, view)}
        onEditComment={(bank) => void editBankComment(bank)}
        onClearComment={(bank) => writeBankComment(bank, undefined)}
      />
    </>
  );
};

type NexAnnotationPanelProps = {
  state: NexAnnotationViewerState;
  onCreate: () => void;
};

/**
 * The validation banner.
 *
 * Renders nothing when the header is consistent, which is the ordinary case — a file that is fine
 * should look no different from before this existed. It uses the annotation banner's own styles
 * rather than new ones: both are a line of prose across the top of this document, and the problem
 * being about the NEX rather than about its annotations does not make it a different kind of thing
 * to look at.
 *
 * Every issue is listed rather than just the first: they have independent causes, and a file with
 * two problems fixed one at a time is two more launches than necessary.
 */
const NexValidationPanel = ({ issues }: { issues: NexIssue[] }) => {
  if (!issues.length) return null;

  return (
    <div className={styles.annotationPanel} title={issues.map((i) => i.message).join("\n")}>
      <Icon iconName="warning" fill="--status-error" width={16} height={16} />
      <span className={styles.annotationError}>{summarizeNexIssues(issues)}</span>
      <span className={styles.validationDetail}>{issues[0].message}</span>
    </div>
  );
};

const NexAnnotationPanel = ({
  state,
  onCreate
}: NexAnnotationPanelProps) => {
  const t = useT();
  if (state.status === "missing") {
    return (
      <div className={styles.annotationPanel}>
        <span>{t("panels.next.nex.noAnnotationFile")}</span>
        <button
          type='button'
          className={styles.annotationLink}
          onClick={onCreate}
        >
          {t("panels.next.nex.createAnnotationFile")}
        </button>
      </div>
    );
  }

  if (state.status === "invalid" || state.status === "error") {
    const details = [
      state.message,
      ...state.diagnostics.map((diagnostic) =>
        `${diagnostic.severity}: ${diagnostic.path} ${diagnostic.message}`
      )
    ].filter(Boolean).join("\n");

    return (
      <div className={styles.annotationPanel} title={details || undefined}>
        <span className={styles.annotationError}>{t("panels.next.nex.annotationLoadFailed")}</span>
      </div>
    );
  }

  return null;
};

type HeaderAttributesProps = {
  header: NexHeader;
};

type HeaderAttributeGroupProps = {
  title: string;
  children: React.ReactNode;
};

/** A titled group of the header's facts; the groups sit side by side while they fit */
const HeaderAttributeGroup = ({ title, children }: HeaderAttributeGroupProps) => (
  <section className={styles.headerAttributeGroup}>
    <div className={styles.headerAttributeGroupTitle}>{title}</div>
    {children}
  </section>
);

/*
 * The header's values are what the loader will set the machine to (PC, SP, the entry bank, the
 * border...), so they take the state colour, as the register panels' values do.
 */
const HeaderText = ({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) => (
  <Fact label={label} tone="state" title={tooltip}>
    {value}
  </Fact>
);

const HeaderAttributes = ({ header: h }: HeaderAttributesProps) => {
  const t = useT();
  return (
    <div className={styles.headerAttributes}>
      <HeaderAttributeGroup title={t("panels.next.nex.group.file")}>
        <Facts labelWidth={HEADER_LABEL_WIDTH}>
          <HeaderText
            label={t("panels.next.nex.attr.version")}
            value={`V${h.versionMajor}.${h.versionMinor}`}
            tooltip={t("panels.next.nex.attr.versionTooltip")}
          />
          <HeaderText label={t("panels.next.nex.attr.requiredRam")} value={h.fullRamRequired ? "1792K" : "768K"} />
          <HeaderText label={t("panels.next.nex.attr.banksToLoad")} value={h.numOf16KBanks.toString(10)} />
          <HeaderText label={t("panels.next.nex.attr.extraFiles")} value={h.numOfExtraBytes.toString(10)} />
          <HeaderText
            label={t("panels.next.nex.attr.requiredCore")}
            value={`V${h.requiredCoreVersionMajor}.${h.requiredCoreVersionMinor}.${h.requiredCoreVersionSubMinor}`}
          />
        </Facts>
      </HeaderAttributeGroup>

      <HeaderAttributeGroup title={t("panels.next.nex.group.entry")}>
        <Facts labelWidth={HEADER_LABEL_WIDTH}>
          <HeaderText label="PC:" value={`$${toHexa4(h.programCounter)} (${h.programCounter.toString(10)})`} />
          <HeaderText label="SP:" value={`$${toHexa4(h.stackPointer)} (${h.stackPointer.toString(10)})`} />
          <HeaderText
            label={t("panels.next.nex.attr.entryBank")}
            value={`$${toHexa2(h.entryBank)} (${h.entryBank.toString(10)})`}
          />
          <HeaderText
            label={t("panels.next.nex.attr.fileHandleAddress")}
            value={`$${toHexa4(h.fileHandleAddress)} (${h.fileHandleAddress.toString(10)})`}
          />
          <FactFlag tone="state" label={t("panels.next.nex.attr.preserveNextRegs")} value={!!h.preserveNextRegisters} />
        </Facts>
      </HeaderAttributeGroup>

      <HeaderAttributeGroup title={t("panels.next.nex.group.loading")}>
        <Facts labelWidth={HEADER_LABEL_WIDTH}>
          <HeaderText label={t("panels.next.nex.attr.borderColor")} value={h.borderColor.toString(10)} />
          <FactFlag tone="state" label={t("panels.next.nex.attr.layer2LoadingBar")} value={!!h.layer2LoadingBar} />
          <HeaderText
            label={t("panels.next.nex.attr.barColor")}
            value={`$${toHexa2(h.loadingBarColorFor)} (${h.loadingBarColorFor.toString(10)})`}
          />
          <HeaderText label={t("panels.next.nex.attr.delayPerBank")} value={h.loadingDelayPerBank.toString(10)} />
          <HeaderText label={t("panels.next.nex.attr.startDelay")} value={h.startDelay.toString(10)} />
          <HeaderText
            label={t("panels.next.nex.attr.timexHiResColor")}
            value={`$${toHexa2(h.timexHiresModeColor)} (${h.timexHiresModeColor.toString(10)})`}
          />
        </Facts>
      </HeaderAttributeGroup>

      <HeaderAttributeGroup title={t("panels.next.nex.group.screenBlocks")}>
        <FactCells cellWidth={SCREEN_FLAG_CELL_WIDTH} labelWidth={SCREEN_FLAG_LABEL_WIDTH}>
          <FactFlag tone="state" label="Layer2:" value={!!(h.screenBlockFlags & ScreenBlockFlags.Layer2)} />
          <FactFlag tone="state" label="ULA:" value={!!(h.screenBlockFlags & ScreenBlockFlags.Ula)} />
          <FactFlag tone="state" label="LoRes:" value={!!(h.screenBlockFlags & ScreenBlockFlags.LoRes)} />
          <FactFlag tone="state" label="HiRes:" value={!!(h.screenBlockFlags & ScreenBlockFlags.HiRes)} />
          <FactFlag tone="state" label="HiColor:" value={!!(h.screenBlockFlags & ScreenBlockFlags.HiColor)} />
          <FactFlag tone="state"
            label={t("panels.next.nex.attr.noPalette")}
            value={!!(h.screenBlockFlags & ScreenBlockFlags.NoPalette)}
          />
        </FactCells>
      </HeaderAttributeGroup>
    </div>
  );
};

export const createNexFileViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => (
  <NexFileViewerPanel
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);
