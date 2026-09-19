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
import { Row } from "@renderer/controls/layout/Row";
import { LabeledText } from "@renderer/controls/layout/LabeledText";
import { LabeledFlag } from "@renderer/controls/layout/LabeledFlag";
import { ExpandableRow } from "@renderer/controls/layout/ExpandableRow";
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
import { EMULATED_CORE_VERSION } from "@emu/machines/zxNext/nextCoreVersion";
import { MF_BANK } from "@common/machines/constants";
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
  NexAnnotationSidecarPaths,
  NexAnnotationSidecarState,
  createNexAnnotationSidecar,
  getAnnotatedDecimalViewForBank,
  getAnnotatedDisassemblyOffsetForBank,
  getAnnotatedPopOutViewForBank,
  getNexAnnotationSidecarPaths,
  loadNexAnnotationSidecar
} from "./nexAnnotationSidecar";
import { getBankAnnotation, NexFileAnnotations } from "./nexAnnotations";
import { withBankComment } from "./nexAnnotationEdits";
import {
  NexBankBrowser,
  type NexBankBrowserItem,
  type NexBankFilter,
  type NexBankView
} from "./NexBankBrowser";
import { bankContentMix, bankLabels, isAnnotatedBank, isEmptyBank } from "./nexBankSummary";
import {
  peekNexAnnotationSession,
  seedNexAnnotationSession,
  subscribeNexAnnotationSession,
  updateNexAnnotationSession
} from "./nexAnnotationSession";
import {
  BANK_COMMENT_DIALOG_TITLE,
  BANK_COMMENT_DIALOG_WIDTH,
  NexBankCommentDialog
} from "./NexBankCommentDialog";
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
const HEADER_LABEL_WIDTH = "25ch"; // 160px / 6.4
const HEADER_VALUE_WIDTH = "21ch"; // 132px / 6.4
const HEADER_WIDE_VALUE_WIDTH = "30ch"; // 188px / 6.4
const HEADER_FLAG_LABEL_WIDTH = "25ch"; // 156px / 6.4
const HEADER_FLAG_NARROW_LABEL_WIDTH = "15ch"; // 92px / 6.4
const HEADER_FLAG_VALUE_WIDTH = "4ch"; // 22px / 6.4

type NexAnnotationViewerState =
  | NexAnnotationSidecarState
  | {
      status: "loading" | "creating" | "unavailable";
      paths?: NexAnnotationSidecarPaths;
      annotations?: NexFileAnnotations;
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
  const loadedBanks = useMemo(() => fi.bankData.map(([bank]) => bank), [fi.bankData]);
  // --- One listing for every bank row: a NEX can carry a hundred banks, and each asking the
  // --- emulator for itself would be a hundred IPC calls per breakpoint change.
  const bankBreakpointCounts = useNexBankBreakpointCounts();
  const layer2Palette = useMemo(
    () => fi.palette.map(v => getAbrgForPaletteCode(v)),
    [fi.palette]
  );
  const sidecarPaths = useMemo(() => getNexAnnotationSidecarPaths(document), [document]);
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
    loadNexAnnotationSidecar(appServices.projectService, sidecarPaths, loadedBanks).then((state) => {
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
      const state = await createNexAnnotationSidecar(appServices.projectService, sidecarPaths, {
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
  const [sessionAnnotations, setSessionAnnotations] = useState<NexFileAnnotations>();
  useEffect(() => {
    if (annotationState.status !== "loaded" || !loadedSidecarPath) return undefined;
    seedNexAnnotationSession(loadedSidecarPath, annotationState.annotations);
    const unsubscribe = subscribeNexAnnotationSession(
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
    const current = peekNexAnnotationSession(loadedSidecarPath) ?? loadedAnnotations;
    if (!current) return;
    const next = withBankComment(current, bank, comment);
    if (next) {
      updateNexAnnotationSession(loadedSidecarPath, next, appServices.projectService);
    }
  };

  const editBankComment = async (bank: number) => {
    if (!loadedSidecarPath || !loadedAnnotations) return;
    const bankAnnotation = getBankAnnotation(loadedAnnotations, bank);
    if (!bankAnnotation) return;
    const result = await dialogs.open(
      NexBankCommentDialog,
      { bank, initialComment: bankAnnotation.comment },
      { title: BANK_COMMENT_DIALOG_TITLE, width: BANK_COMMENT_DIALOG_WIDTH }
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
          nexAnnotationPath: annotated ? sidecarPaths?.fullPath : undefined,
          nexAnnotationBank: annotated ? bank : undefined
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
  const validationIssues = useMemo(
    () =>
      validateNexHeader(h, {
        coreVersion: EMULATED_CORE_VERSION,
        bankCount: (machineFeatures?.[MF_BANK] ?? 0) / 2 || undefined
      }),
    [h, machineFeatures]
  );

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
      <ExpandableRow
        heading='Header attributes'
        initialExpanded={cvs?.headerAttrExpanded ?? true}
        onExpanded={exp => change(vs => (vs.headerAttrExpanded = exp))}
      >
        <HeaderAttributes header={h} />
      </ExpandableRow>
      {/*
        * The count rides in the heading as a chip, the way PC and SP do on a bank: it is a fact
        * about the section rather than part of its name. Only the count carries information — the
        * denominator is always 112 — so the chip shows that alone and the tooltip spells it out.
        */}
      <ExpandableRow
        heading={
          <>
            Bank flags
            <span
              className={styles.headingChip}
              title={`${setBankFlagCount} of ${h.bankFlags.length} bank flags set`}
            >
              {setBankFlagCount}
            </span>
          </>
        }
        initialExpanded={cvs?.bankFlagsExpanded ?? false}
        onExpanded={exp => change(vs => (vs.bankFlagsExpanded = exp))}
      >
        <BankFlags startIndex={0} flags={h.bankFlags.slice(0, 8)} />
        <BankFlags startIndex={8} flags={h.bankFlags.slice(8, 16)} />
        <BankFlags startIndex={16} flags={h.bankFlags.slice(16, 24)} />
        <BankFlags startIndex={24} flags={h.bankFlags.slice(24, 32)} />
        <BankFlags startIndex={32} flags={h.bankFlags.slice(32, 40)} />
        <BankFlags startIndex={40} flags={h.bankFlags.slice(40, 48)} />
        <BankFlags startIndex={48} flags={h.bankFlags.slice(48, 56)} />
        <BankFlags startIndex={56} flags={h.bankFlags.slice(56, 64)} />
        <BankFlags startIndex={64} flags={h.bankFlags.slice(64, 72)} />
        <BankFlags startIndex={72} flags={h.bankFlags.slice(72, 80)} />
        <BankFlags startIndex={80} flags={h.bankFlags.slice(80, 88)} />
        <BankFlags startIndex={88} flags={h.bankFlags.slice(88, 96)} />
        <BankFlags startIndex={96} flags={h.bankFlags.slice(96, 104)} />
        <BankFlags startIndex={104} flags={h.bankFlags.slice(104, 112)} />
      </ExpandableRow>
      {fi.palette?.length > 0 && (
        <ExpandableRow
          heading='Palette (Layer2, LoRes or Tilemap screen)'
          initialExpanded={cvs?.paletteExpanded ?? false}
          onExpanded={exp =>
            change(vs => (vs.paletteExpanded = exp))
          }
        >
          <NextPaletteViewer
            palette={fi?.palette}
            cellSize={29}
            allowSelection={true}
          />
        </ExpandableRow>
      )}
      {fi.layer2LoadingScreen?.length > 0 && (
        <ExpandableRow
          heading='Layer 2 Loading Screen'
          headingAction={
            <SmallIconButton
              iconName='square-arrow-out-up-right'
              fill='--color-command-icon'
              title='Open the loading screen as its own document'
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
          initialExpanded={cvs?.layer2LoadingScreenExpanded ?? false}
          onExpanded={exp =>
            change(vs => (vs.layer2LoadingScreenExpanded = exp))
          }
        >
          <Layer2Screen
            documentSource={document.node.projectPath}
            data={fi?.layer2LoadingScreen}
            palette={layer2Palette}
          />
        </ExpandableRow>
      )}
      {fi.ulaLoadingScreen?.length > 0 && (
        <ExpandableRow
          heading='ULA Loading Screen'
          initialExpanded={cvs?.ulaLoadingScreenExpanded ?? false}
          onExpanded={exp =>
            change(vs => (vs.ulaLoadingScreenExpanded = exp))
          }
        >
          <MemoryDumpViewer
            documentSource={document.node.projectPath}
            contents={fi?.ulaLoadingScreen}
            iconTitle='Display ULA dump'
            idFactory={(documentSource: string) =>
              `ulaDump${documentSource}`
            }
            titleFactory={(documentSource: string) =>
              `${documentSource} - ULA`
            }
          />
        </ExpandableRow>
      )}
      {fi.loResLoadingScreen?.length > 0 && (
        <ExpandableRow
          heading='LoRes Loading Screen'
          initialExpanded={cvs?.loResLoadingScreenExpanded ?? false}
          onExpanded={exp =>
            change(vs => (vs.loResLoadingScreenExpanded = exp))
          }
        >
          <MemoryDumpViewer
            documentSource={document.node.projectPath}
            contents={fi?.loResLoadingScreen}
            iconTitle='Display LoRes dump'
            idFactory={(documentSource: string) =>
              `loResDump${documentSource}`
            }
            titleFactory={(documentSource: string) =>
              `${documentSource} - LoRes`
            }
          />
        </ExpandableRow>
      )}
      {fi.timexHiResLoadingScreen?.length > 0 && (
        <ExpandableRow
          heading='Timex HiRes Loading Screen'
          initialExpanded={cvs?.timexHiResLoadingScreenExpanded ?? false}
          onExpanded={exp =>
            change(vs => (vs.timexHiResLoadingScreenExpanded = exp))
          }
        >
          <MemoryDumpViewer
            documentSource={document.node.projectPath}
            contents={fi?.timexHiResLoadingScreen}
            iconTitle='Display Timex HiRes dump'
            idFactory={(documentSource: string) =>
              `timexHiResDump${documentSource}`
            }
            titleFactory={(documentSource: string) =>
              `${documentSource} - Timex HiRes`
            }
          />
        </ExpandableRow>
      )}
      {fi.timexHiColLoadingScreen?.length > 0 && (
        <ExpandableRow
          heading='Timex HiCol Loading Screen'
          initialExpanded={cvs?.timexHiColLoadingScreenExpanded ?? false}
          onExpanded={exp =>
            change(vs => (vs.timexHiColLoadingScreenExpanded = exp))
          }
        >
          <MemoryDumpViewer
            documentSource={document.node.projectPath}
            contents={fi?.timexHiColLoadingScreen}
            iconTitle='Display Timex HiCol dump'
            idFactory={(documentSource: string) =>
              `timexHiColDump${documentSource}`
            }
            titleFactory={(documentSource: string) =>
              `${documentSource} - Timex Hicol`
            }
          />
        </ExpandableRow>
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
  if (state.status === "missing") {
    return (
      <div className={styles.annotationPanel}>
        <span>No annotation file attached.</span>
        <button
          type='button'
          className={styles.annotationLink}
          onClick={onCreate}
        >
          Click to create one!
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
        <span className={styles.annotationError}>Annotation file could not be loaded.</span>
      </div>
    );
  }

  return null;
};

type BankFlagsProps = {
  startIndex: number;
  flags: boolean[];
};

const BankFlags = ({ flags, startIndex }: BankFlagsProps) => {
  return (
    <Row>
      {flags.map((f, idx) => (
        <LabeledFlag
          key={idx}
          label={`#${toHexa2(idx + startIndex)}:`}
          labelWidth="6ch" // 36px / 6.4
          valueWidth="4ch" // 20px / 6.4
          value={f}
          iconFill="--color-state-value"
        />
      ))}
    </Row>
  );
};

type HeaderAttributesProps = {
  header: NexHeader;
};

type HeaderAttributeGroupProps = {
  title: string;
  children: React.ReactNode;
};

const HeaderAttributeGroup = ({
  title,
  children
}: HeaderAttributeGroupProps) => (
  <section className={styles.headerAttributeGroup}>
    <div className={styles.headerAttributeGroupTitle}>{title}</div>
    {children}
  </section>
);

type HeaderTextProps = {
  label: string;
  value: string;
  tooltip?: string;
  valueWidth?: string;
};

const HeaderText = ({
  label,
  value,
  tooltip,
  valueWidth = HEADER_VALUE_WIDTH
}: HeaderTextProps) => (
  <Row xclass={styles.headerAttributeRow}>
    <LabeledText
      label={label}
      labelWidth={HEADER_LABEL_WIDTH}
      value={value}
      valueWidth={valueWidth}
      tooltip={tooltip}
      valueClassName={styles.headerValue}
    />
  </Row>
);

/**
 * A loading-screen block flag.
 *
 * Two of these share a row, so unlike `HeaderFlag` it brings no row of its own — which is why the
 * six of them were written out longhand, and why they were the ones that missed the panel's value
 * colour when `HeaderFlag` gained it.
 */
const ScreenBlockFlag = ({ label, value }: { label: string; value: boolean }) => (
  <LabeledFlag
    label={label}
    labelWidth={HEADER_FLAG_NARROW_LABEL_WIDTH}
    valueWidth={HEADER_FLAG_VALUE_WIDTH}
    value={value}
    center={true}
    iconFill="--color-state-value"
  />
);

type HeaderFlagProps = {
  label: string;
  value: boolean;
};

const HeaderFlag = ({ label, value }: HeaderFlagProps) => (
  <Row xclass={styles.headerAttributeRow}>
    <LabeledFlag
      label={label}
      labelWidth={HEADER_FLAG_LABEL_WIDTH}
      value={value}
      valueWidth={HEADER_FLAG_VALUE_WIDTH}
      iconFill="--color-state-value"
      center={false}
    />
  </Row>
);

const HeaderAttributes = ({ header: h }: HeaderAttributesProps) => (
  <div className={styles.headerAttributes}>
    <HeaderAttributeGroup title='File'>
      <HeaderText
        label='Version:'
        value={`V${h.versionMajor}.${h.versionMinor}`}
        tooltip='.NEX file version'
      />
      <HeaderText
        label='Required RAM:'
        value={h.fullRamRequired ? "1792K" : "768K"}
      />
      <HeaderText
        label='16K banks to load:'
        value={h.numOf16KBanks.toString(10)}
      />
      <HeaderText label='Extra files:' value={h.numOfExtraBytes.toString(10)} />
      <HeaderText
        label='Required core:'
        value={`V${h.requiredCoreVersionMajor}.${h.requiredCoreVersionMinor}.${h.requiredCoreVersionSubMinor}`}
      />
    </HeaderAttributeGroup>

    <HeaderAttributeGroup title='Entry'>
      <HeaderText
        label='PC:'
        value={`$${toHexa4(h.programCounter)} (${h.programCounter.toString(10)})`}
        valueWidth={HEADER_WIDE_VALUE_WIDTH}
      />
      <HeaderText
        label='SP:'
        value={`$${toHexa4(h.stackPointer)} (${h.stackPointer.toString(10)})`}
        valueWidth={HEADER_WIDE_VALUE_WIDTH}
      />
      <HeaderText
        label='Entry bank:'
        value={`$${toHexa2(h.entryBank)} (${h.entryBank.toString(10)})`}
      />
      <HeaderText
        label='File handle addr:'
        value={`$${toHexa4(h.fileHandleAddress)} (${h.fileHandleAddress.toString(10)})`}
        valueWidth={HEADER_WIDE_VALUE_WIDTH}
      />
      <HeaderFlag label='Preserve Next regs:' value={!!h.preserveNextRegisters} />
    </HeaderAttributeGroup>

    <HeaderAttributeGroup title='Loading'>
      <HeaderText label='Border color:' value={h.borderColor.toString(10)} />
      <HeaderFlag label='Layer2 loading bar:' value={!!h.layer2LoadingBar} />
      <HeaderText
        label='Bar color:'
        value={`$${toHexa2(h.loadingBarColorFor)} (${h.loadingBarColorFor.toString(10)})`}
      />
      <HeaderText
        label='Delay per bank:'
        value={h.loadingDelayPerBank.toString(10)}
      />
      <HeaderText label='Start delay:' value={h.startDelay.toString(10)} />
      <HeaderText
        label='Timex HiRes color:'
        value={`$${toHexa2(h.timexHiresModeColor)} (${h.timexHiresModeColor.toString(10)})`}
      />
    </HeaderAttributeGroup>

    <HeaderAttributeGroup title='Loading Screen Blocks'>
      <Row xclass={`${styles.headerAttributeRow} ${styles.headerFlagRow}`}>
        <ScreenBlockFlag label='Layer2:' value={!!(h.screenBlockFlags & ScreenBlockFlags.Layer2)} />
        <ScreenBlockFlag label='ULA:' value={!!(h.screenBlockFlags & ScreenBlockFlags.Ula)} />
      </Row>
      <Row xclass={`${styles.headerAttributeRow} ${styles.headerFlagRow}`}>
        <ScreenBlockFlag label='LoRes:' value={!!(h.screenBlockFlags & ScreenBlockFlags.LoRes)} />
        <ScreenBlockFlag label='HiRes:' value={!!(h.screenBlockFlags & ScreenBlockFlags.HiRes)} />
      </Row>
      <Row xclass={`${styles.headerAttributeRow} ${styles.headerFlagRow}`}>
        <ScreenBlockFlag label='HiColor:' value={!!(h.screenBlockFlags & ScreenBlockFlags.HiColor)} />
        <ScreenBlockFlag label='No palette:' value={!!(h.screenBlockFlags & ScreenBlockFlags.NoPalette)} />
      </Row>
    </HeaderAttributeGroup>
  </div>
);

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
