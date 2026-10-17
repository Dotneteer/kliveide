import { useCallback, useMemo } from "react";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import {
  BankBrowser,
  BankChip,
  BankDetailsSection,
  BankFacts,
  BankRowText,
  type BankBrowserItem
} from "@renderer/controls/bankBrowser/BankBrowser";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { openTapeBlockView } from "../Tape/TapeBlockViewerPanel";
import {
  P_FILE_REGION_CHIPS,
  P_FILE_REGION_NAMES,
  P_FILE_VIEW_NAMES,
  describeZx8081Variable,
  regionText,
  zx81DisplayRows,
  type PFileAnalysis,
  type PFileRegion,
  type PFileRegionKind,
  type PFileView
} from "./pFileView";
import { analyzeProgramFile } from "./oFileView";
import { pFileRegionDumpId, pFileRegionTitle, pFileRegionViewDocumentId } from "./pFileDocument";
import { Zx81ScreenView } from "./Zx81ScreenView";
import styles from "../Tape/TapeViewerPanel.module.scss";
import { uiLocale } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";

/*
 * The ZX81 `.P` and ZX80 `.O` viewer, built as the `.tap`/`.tzx` viewer is (`../Tape/TapeViewerPanel.tsx`): a
 * summary strip, then the file's parts in the shared bank browser - system variables, the BASIC
 * program, the display file, the variables - each poppable as memory, disassembly (at its address),
 * a BASIC listing or the screen. The models are `pFileView.ts` and, for a ZX80 file (no display
 * file: it is past E_LINE), `oFileView.ts`.
 */

type PFileViewState = {
  scrollPosition?: number;
  /** The selected part */
  selectedRegion?: PFileRegionKind;
  regionFilter?: string;
  /** The view each part last popped out in */
  regionView?: Partial<Record<PFileRegionKind, PFileView>>;
};

type ViewContext = GenericFileContext<PFileAnalysis, PFileViewState>;

type RegionItem = BankBrowserItem<PFileView> & { region: PFileRegion };

/** How many variables the details list before "and n more" */
const VARIABLES_SHOWN = 40;

/** Parses a `.P` file - or a `.O` one, the machine told by the file's extension - for the viewer */
export function loadPFileContents(
  contents: Uint8Array,
  fileName = ""
): {
  fileInfo?: PFileAnalysis;
  error?: string;
} {
  const { analysis, error } = analyzeProgramFile(contents, fileName);
  return analysis ? { fileInfo: analysis } : { error };
}

const PFileViewerPanel = ({ document, contents, viewState }: DocumentProps<PFileViewState>) => {
  const fullPath = document.node?.fullPath ?? document.path ?? document.id;
  const fileLoader = useCallback((bytes: Uint8Array) => loadPFileContents(bytes, fullPath), [fullPath]);
  return (
    <GenericFilePanel<PFileAnalysis, PFileViewState>
      document={document}
      contents={contents}
      viewState={viewState}
      apiLoaded={() => {}}
      fileLoader={fileLoader}
      validRenderer={(ctx) => <PFileView ctx={ctx} fullPath={fullPath} />}
    />
  );
};

export const createPFileViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <PFileViewerPanel
    key={document.id}
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);

/* --- Byte counts beside addresses stay invariant; counts in sentences go through the messages */
const fmt = (value: number) => value.toLocaleString("en-US");
const hex = (value: number) => `$${toHexa4(value)}`;

/** A module-level component, so it may hold hooks (see `GenericFilePanel`'s renderer note) */
const PFileView = ({ ctx, fullPath }: { ctx: ViewContext; fullPath: string }) => {
  const t = useT();
  const documentHubService = useDocumentHubService();
  const { navigationHistoryService } = useAppServices();
  const projectFolder = useSelector((s) => s.project?.folderPath);
  const analysis = ctx.fileInfo;
  const vs = ctx.viewState ?? {};

  const items = useMemo<RegionItem[]>(
    () =>
      (analysis?.regions ?? []).map((region) => {
        const remembered = vs.regionView?.[region.kind];
        return {
          key: region.kind,
          bank: region.index,
          lastView: remembered && region.views.includes(remembered) ? remembered : region.views[0],
          region
        };
      }),
    [analysis, vs.regionView]
  );
  if (!analysis) return null;

  /** Pop a part out in the view asked for. Recorded, so Go Back returns here. */
  const popOut = async (region: PFileRegion, view: PFileView) => {
    ctx.changeViewState((state) => {
      state.regionView = { ...state.regionView, [region.kind]: view };
    });
    if (view === "memory" || view === "disassembly") {
      await navigationHistoryService.recordJump("pFileRegion", () =>
        openStaticMemoryDump(
          documentHubService,
          pFileRegionDumpId(fullPath, region.kind),
          pFileRegionTitle(fullPath, region.kind, projectFolder),
          region.bytes,
          { disassemblyEnabled: true, disassOffset: region.start, viewMode: view }
        )
      );
      return;
    }
    await navigationHistoryService.recordJump("pFileRegion", () =>
      openTapeBlockView(documentHubService, {
        id: pFileRegionViewDocumentId(fullPath, region.kind, view),
        title: pFileRegionTitle(fullPath, region.kind, projectFolder, view),
        bytes: region.bytes,
        view,
        format: analysis.machine,
        basicEnd: region.bytes.length,
        autostart: view === "basic" ? analysis.summary.autorunLine : undefined
      })
    );
  };

  const { summary } = analysis;
  const selectedKey = vs.selectedRegion ?? items.find((i) => i.region.kind === "program")?.key;
  return (
    <div className={styles.viewer}>
      <Summary analysis={analysis} />
      {!summary.layoutValid && (
        <div className={styles.banner} role="note">
          {t("panels.pfile.layoutBanner")}
        </div>
      )}
      <BankBrowser<RegionItem, PFileView>
        visibleItems={items}
        selectedKey={selectedKey}
        heading={t("panels.pfile.heading")}
        summary={t("panels.pfile.listSummary", { count: summary.size, address: hex(summary.start) })}
        filters={[{ value: "all", text: t("panels.helpers.filter.all") }]}
        filter={vs.regionFilter ?? "all"}
        views={["memory", "disassembly", "basic", "screen"]}
        viewNames={P_FILE_VIEW_NAMES}
        itemKind="part"
        layout="sideBySide"
        formatNumber={(item) => hex(item.region.start)}
        viewsFor={(item) => item.region.views}
        onSelect={(item) => ctx.changeViewState((state) => (state.selectedRegion = item.region.kind))}
        onFilterChange={(filter) => ctx.changeViewState((state) => (state.regionFilter = filter))}
        onPopOut={(item, view) => void popOut(item.region, view)}
        renderRow={(item) => <Row region={item.region} analysis={analysis} />}
        renderDetailsMarks={(item) => <BankChip>{P_FILE_REGION_CHIPS[item.region.kind]}</BankChip>}
        renderDetails={(item) => (
          <Details
            region={item.region}
            analysis={analysis}
            onShowListing={() => void popOut(item.region, "basic")}
          />
        )}
        hint={t("panels.helpers.popOutHint.part")}
      />
    </div>
  );
};

const Fact = ({ label, value, title }: { label: string; value: string; title?: string }) => (
  <span className={styles.fact} title={title}>
    <span className={styles.factLabel}>{label}</span>
    <span className={styles.factValue}>{value}</span>
  </span>
);

const Summary = ({ analysis }: { analysis: PFileAnalysis }) => {
  const t = useT();
  const { summary } = analysis;
  const zx80 = analysis.machine === "zx80";
  const machine = zx80 ? "ZX80" : "ZX81";
  const lines = summary.lineCount.toLocaleString(uiLocale());
  return (
    <div className={styles.summary} aria-label={t("panels.pfile.summaryLabel")}>
      <Fact
        label={t("panels.tape.fact.format")}
        value={t("panels.pfile.format", { machine, extension: zx80 ? ".O" : ".P" })}
      />
      <Fact label={t("panels.tape.fact.size")} value={t("panels.helpers.bytes", { count: summary.size })} />
      <Fact
        label={t("panels.pfile.fact.needs")}
        value={t("panels.pfile.fact.ram", { kb: summary.ramKb })}
        title={t("panels.pfile.fact.needsTitle", { end: hex(summary.start + summary.size), machine })}
      />
      {summary.layoutValid && (
        <Fact
          label={t("panels.pfile.fact.lines")}
          value={summary.programCorrupted ? t("panels.pfile.fact.linesDamaged", { lines }) : lines}
        />
      )}
      {zx80 ? (
        <Fact
          label={t("panels.pfile.fact.runsFrom")}
          value={t("panels.pfile.fact.needsRun")}
          title={t("panels.pfile.fact.zx80LoadTitle")}
        />
      ) : (
        <>
          <Fact
            label={t("panels.pfile.fact.runsFrom")}
            value={summary.autorunLine !== undefined ? `LINE ${summary.autorunLine}` : t("panels.pfile.fact.needsRun")}
            title={t("panels.pfile.fact.runsFromTitle")}
          />
          {/* --- SLOW and FAST are the BASIC keywords: not translated */}
          <Fact
            label={t("panels.pfile.fact.mode")}
            value={summary.slowMode ? "SLOW" : "FAST"}
            title={t("panels.pfile.fact.modeTitle")}
          />
        </>
      )}
    </div>
  );
};

/** The row: the part's chip, a short text, its size on the right */
const Row = ({ region, analysis }: { region: PFileRegion; analysis: PFileAnalysis }) => {
  const t = useT();
  const notVariables = region.kind === "variables" && analysis.summary.variablesCorrupted;
  const text = notVariables ? t("panels.pfile.row.notVariables") : regionText(region, analysis);
  return (
    <>
      <BankChip alt={region.kind === "sysvars"}>{P_FILE_REGION_CHIPS[region.kind]}</BankChip>
      <BankRowText title={text}>{text}</BankRowText>
      <span className={styles.rowLength}>{fmt(region.bytes.length)}</span>
    </>
  );
};

type DetailsProps = {
  region: PFileRegion;
  analysis: PFileAnalysis;
  onShowListing: () => void;
};

const Details = ({ region, analysis, onShowListing }: DetailsProps) => {
  const t = useT();
  const { summary } = analysis;
  return (
    <>
      <BankFacts>
        <dt>{t("panels.pfile.fact.part")}</dt>
        <dd>{P_FILE_REGION_NAMES[region.kind]}</dd>
        <dt>{t("panels.pfile.fact.address")}</dt>
        <dd>{region.end > region.start ? `${hex(region.start)}–${hex(region.end - 1)}` : hex(region.start)}</dd>
        <dt>{t("panels.helpers.fact.length")}</dt>
        <dd>{t("panels.helpers.bytes", { count: region.bytes.length })}</dd>
      </BankFacts>
      {region.kind === "sysvars" &&
        (analysis.machine === "zx80" ? <Zx80SysVarsDetails analysis={analysis} /> : <SysVarsDetails analysis={analysis} />)}
      {region.kind === "program" && (
        <BankDetailsSection title={t("panels.helpers.view.basic")}>
          <BankFacts>
            <dt>{t("panels.helpers.fact.listing")}</dt>
            <dd data-testid="p-file-basic-summary">
              {summary.programCorrupted
                ? t("panels.helpers.lineCountDamaged", { count: summary.lineCount })
                : t("panels.helpers.lineCount", { count: summary.lineCount })}
            </dd>
            <dt>{t("panels.pfile.fact.runsFrom")}</dt>
            <dd>
              {summary.autorunLine !== undefined
                ? t("panels.pfile.runsFromLine", { line: summary.autorunLine })
                : t("panels.pfile.stopsAfterLoad")}
            </dd>
          </BankFacts>
          {summary.lineCount > 0 && (
            <button type="button" className={styles.more} onClick={onShowListing}>
              {t("panels.helpers.popOutListing")}
            </button>
          )}
        </BankDetailsSection>
      )}
      {region.kind === "display" && <DisplayDetails analysis={analysis} region={region} />}
      {region.kind === "variables" && <VariablesDetails analysis={analysis} />}
      {region.kind === "data" && (
        <BankDetailsSection title={P_FILE_REGION_NAMES.data}>
          <p className={styles.wrap}>
            {analysis.machine === "zx80"
              ? t("panels.pfile.dataZx80", { vars: hex(summary.vars), eLine: hex(summary.eLine) })
              : t("panels.pfile.dataZx81", {
                  dFile: hex(summary.dFile),
                  vars: hex(summary.vars),
                  eLine: hex(summary.eLine)
                })}
          </p>
        </BankDetailsSection>
      )}
      {region.kind === "extra" && (
        <BankDetailsSection title={P_FILE_REGION_NAMES.extra}>
          <p className={styles.wrap}>{t("panels.pfile.extra")}</p>
        </BankDetailsSection>
      )}
    </>
  );
};

/** The system variables that say what the file is */
const SysVarsDetails = ({ analysis }: { analysis: PFileAnalysis }) => {
  const t = useT();
  const { memory, summary } = analysis;
  const word = (address: number) => memory[address] | (memory[address + 1] << 8);
  return (
    <BankDetailsSection title={t("panels.pfile.keySysVars")}>
      <BankFacts>
        <dt>VERSN</dt>
        <dd>{`$${toHexa2(memory[0x4009])}`}</dd>
        <dt>E_PPC</dt>
        <dd>{t("panels.pfile.currentLine", { line: word(0x400a) })}</dd>
        <dt>D_FILE</dt>
        <dd>{hex(summary.dFile)}</dd>
        <dt>VARS</dt>
        <dd>{hex(summary.vars)}</dd>
        <dt>E_LINE</dt>
        <dd>{hex(summary.eLine)}</dd>
        <dt>NXTLIN</dt>
        <dd>{hex(word(0x4029))}</dd>
        <dt>CDFLAG</dt>
        <dd>{`$${toHexa2(memory[0x403b])} (${summary.slowMode ? "SLOW" : "FAST"})`}</dd>
      </BankFacts>
    </BankDetailsSection>
  );
};

/** A ZX80 file's: the display file is not in it, but D_FILE says where it went */
const Zx80SysVarsDetails = ({ analysis }: { analysis: PFileAnalysis }) => {
  const t = useT();
  const { memory, summary } = analysis;
  const word = (address: number) => memory[address] | (memory[address + 1] << 8);
  return (
    <BankDetailsSection title={t("panels.pfile.keySysVars")}>
      <BankFacts>
        <dt>E_PPC</dt>
        <dd>{t("panels.pfile.currentLine", { line: word(0x4006) })}</dd>
        <dt>VARS</dt>
        <dd>{hex(summary.vars)}</dd>
        <dt>E_LINE</dt>
        <dd>{t("panels.pfile.endOfFile", { address: hex(summary.eLine) })}</dd>
        <dt>D_FILE</dt>
        <dd>{t("panels.pfile.notSaved", { address: hex(summary.dFile) })}</dd>
      </BankFacts>
    </BankDetailsSection>
  );
};

const DisplayDetails = ({ analysis, region }: { analysis: PFileAnalysis; region: PFileRegion }) => {
  const t = useT();
  const rows = useMemo(
    () => zx81DisplayRows(analysis.memory, region.start, region.end),
    [analysis, region]
  );
  return (
    <BankDetailsSection title={t("panels.helpers.view.screen")}>
      <BankFacts>
        <dt>{t("panels.pfile.fact.lines")}</dt>
        <dd>
          {analysis.summary.displayCollapsed
            ? t("panels.pfile.displayCollapsed")
            : t("panels.pfile.displayFull")}
        </dd>
      </BankFacts>
      <div className={styles.screen}>
        <Zx81ScreenView rows={rows} />
      </div>
    </BankDetailsSection>
  );
};

const VariablesDetails = ({ analysis }: { analysis: PFileAnalysis }) => {
  const t = useT();
  const { variables, summary } = analysis;
  if (summary.variablesCorrupted && variables.length === 0) {
    return (
      <BankDetailsSection title={P_FILE_REGION_NAMES.variables}>
        <p className={styles.wrap}>{t("panels.pfile.variablesNotBasic")}</p>
      </BankDetailsSection>
    );
  }
  if (variables.length === 0) {
    return (
      <BankDetailsSection title={P_FILE_REGION_NAMES.variables}>
        <p className={styles.wrap}>{t("panels.pfile.noVariables")}</p>
      </BankDetailsSection>
    );
  }
  return (
    <BankDetailsSection title={P_FILE_REGION_NAMES.variables}>
      <BankFacts>
        {variables.slice(0, VARIABLES_SHOWN).map((variable) => (
          <VariableFact key={variable.address} name={variable.name} value={describeZx8081Variable(variable)} />
        ))}
      </BankFacts>
      {variables.length > VARIABLES_SHOWN && (
        <p className={styles.wrap}>{t("panels.pfile.andMore", { count: variables.length - VARIABLES_SHOWN })}</p>
      )}
      {summary.variablesCorrupted && (
        <p className={styles.wrap}>{t("panels.pfile.restNotVariables")}</p>
      )}
    </BankDetailsSection>
  );
};

const VariableFact = ({ name, value }: { name: string; value: string }) => (
  <>
    <dt>{name}</dt>
    <dd className={styles.wrap}>{value}</dd>
  </>
);
