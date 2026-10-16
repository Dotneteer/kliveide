import { useMemo } from "react";
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
  analyzePFile,
  describeZx81Variable,
  regionText,
  zx81DisplayRows,
  type PFileAnalysis,
  type PFileRegion,
  type PFileRegionKind,
  type PFileView
} from "./pFileView";
import { pFileRegionDumpId, pFileRegionTitle, pFileRegionViewDocumentId } from "./pFileDocument";
import { Zx81ScreenView } from "./Zx81ScreenView";
import styles from "../Tape/TapeViewerPanel.module.scss";

/*
 * The ZX81 `.P` viewer, built as the `.tap`/`.tzx` viewer is (`../Tape/TapeViewerPanel.tsx`): a
 * summary strip, then the file's parts in the shared bank browser - system variables, the BASIC
 * program, the display file, the variables - each poppable as memory, disassembly (at its address),
 * a BASIC listing or the screen. The model is `pFileView.ts`.
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

const FILTERS = [{ value: "all", text: "All" }];

/** How many variables the details list before "and n more" */
const VARIABLES_SHOWN = 40;

/** Parses a `.P` file for the viewer */
export function loadPFileContents(contents: Uint8Array): {
  fileInfo?: PFileAnalysis;
  error?: string;
} {
  const { analysis, error } = analyzePFile(contents);
  return analysis ? { fileInfo: analysis } : { error };
}

const PFileViewerPanel = ({ document, contents, viewState }: DocumentProps<PFileViewState>) => (
  <GenericFilePanel<PFileAnalysis, PFileViewState>
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
    fileLoader={loadPFileContents}
    validRenderer={(ctx) => (
      <PFileView ctx={ctx} fullPath={document.node?.fullPath ?? document.path ?? document.id} />
    )}
  />
);

export const createPFileViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <PFileViewerPanel
    key={document.id}
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);

const fmt = (value: number) => value.toLocaleString("en-US");
const hex = (value: number) => `$${toHexa4(value)}`;

/** A module-level component, so it may hold hooks (see `GenericFilePanel`'s renderer note) */
const PFileView = ({ ctx, fullPath }: { ctx: ViewContext; fullPath: string }) => {
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
        format: "zx81",
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
          This file&apos;s system variables do not describe its parts (1K programs often keep code in
          them), so everything after them is shown as one part.
        </div>
      )}
      <BankBrowser<RegionItem, PFileView>
        visibleItems={items}
        selectedKey={selectedKey}
        heading="Parts"
        summary={`${fmt(summary.size)} bytes from ${hex(0x4009)}`}
        filters={FILTERS}
        filter={vs.regionFilter ?? "all"}
        views={["memory", "disassembly", "basic", "screen"]}
        viewNames={P_FILE_VIEW_NAMES}
        itemNoun="Part"
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
        hint="Pop out a part from its row's icon, by double-clicking the row, or with Enter."
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
  const { summary } = analysis;
  return (
    <div className={styles.summary} aria-label="Program summary">
      <Fact label="Format" value="ZX81 program (.P)" />
      <Fact label="Size" value={`${fmt(summary.size)} bytes`} />
      <Fact
        label="Needs"
        value={`${summary.ramKb}K RAM`}
        title={`The file ends at ${hex(0x4009 + summary.size)}; a 1K ZX81's RAM ends at $4400`}
      />
      {summary.layoutValid && (
        <Fact label="Lines" value={`${fmt(summary.lineCount)}${summary.programCorrupted ? " (damaged)" : ""}`} />
      )}
      <Fact
        label="Runs from"
        value={summary.autorunLine !== undefined ? `LINE ${summary.autorunLine}` : "Needs RUN"}
        title="A program saved by a program line carries on from the line after its SAVE"
      />
      <Fact label="Mode" value={summary.slowMode ? "SLOW" : "FAST"} title="The mode the program loads in (CDFLAG)" />
    </div>
  );
};

/** The row: the part's chip, a short text, its size on the right */
const Row = ({ region, analysis }: { region: PFileRegion; analysis: PFileAnalysis }) => {
  const notVariables = region.kind === "variables" && analysis.summary.variablesCorrupted;
  const text = notVariables ? "Data, not BASIC variables" : regionText(region, analysis);
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
  const { summary } = analysis;
  return (
    <>
      <BankFacts>
        <dt>Part</dt>
        <dd>{P_FILE_REGION_NAMES[region.kind]}</dd>
        <dt>Address</dt>
        <dd>{region.end > region.start ? `${hex(region.start)}–${hex(region.end - 1)}` : hex(region.start)}</dd>
        <dt>Length</dt>
        <dd>{`${fmt(region.bytes.length)} bytes`}</dd>
      </BankFacts>
      {region.kind === "sysvars" && <SysVarsDetails analysis={analysis} />}
      {region.kind === "program" && (
        <BankDetailsSection title="BASIC">
          <BankFacts>
            <dt>Listing</dt>
            <dd data-testid="p-file-basic-summary">
              {`${fmt(summary.lineCount)} line${summary.lineCount === 1 ? "" : "s"}`}
              {summary.programCorrupted ? " (stops early: the program is damaged)" : ""}
            </dd>
            <dt>Runs from</dt>
            <dd>
              {summary.autorunLine !== undefined
                ? `LINE ${summary.autorunLine}, after LOAD`
                : "Stops after LOAD; type RUN"}
            </dd>
          </BankFacts>
          {summary.lineCount > 0 && (
            <button type="button" className={styles.more} onClick={onShowListing}>
              Pop out the listing
            </button>
          )}
        </BankDetailsSection>
      )}
      {region.kind === "display" && <DisplayDetails analysis={analysis} region={region} />}
      {region.kind === "variables" && <VariablesDetails analysis={analysis} />}
      {region.kind === "data" && (
        <BankDetailsSection title="Program and data">
          <p className={styles.wrap}>
            {`D_FILE (${hex(summary.dFile)}), VARS (${hex(summary.vars)}) and E_LINE (${hex(
              summary.eLine
            )}) do not mark out a program, a display file and variables in this file. The bytes are its own: open them in Memory or Disassembly.`}
          </p>
        </BankDetailsSection>
      )}
      {region.kind === "extra" && (
        <BankDetailsSection title="After E_LINE">
          <p className={styles.wrap}>
            The ROM&apos;s LOAD stops at E_LINE, so these bytes never reach the machine.
          </p>
        </BankDetailsSection>
      )}
    </>
  );
};

/** The system variables that say what the file is */
const SysVarsDetails = ({ analysis }: { analysis: PFileAnalysis }) => {
  const { memory, summary } = analysis;
  const word = (address: number) => memory[address] | (memory[address + 1] << 8);
  return (
    <BankDetailsSection title="Key system variables">
      <BankFacts>
        <dt>VERSN</dt>
        <dd>{`$${toHexa2(memory[0x4009])}`}</dd>
        <dt>E_PPC</dt>
        <dd>{`${word(0x400a)} (the current line)`}</dd>
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

const DisplayDetails = ({ analysis, region }: { analysis: PFileAnalysis; region: PFileRegion }) => {
  const rows = useMemo(
    () => zx81DisplayRows(analysis.memory, region.start, region.end),
    [analysis, region]
  );
  return (
    <BankDetailsSection title="Screen">
      <BankFacts>
        <dt>Lines</dt>
        <dd>
          {analysis.summary.displayCollapsed
            ? "Collapsed: lines end at their last character (saved on a 1K machine)"
            : "Full: 24 lines of 32 characters"}
        </dd>
      </BankFacts>
      <div className={styles.screen}>
        <Zx81ScreenView rows={rows} />
      </div>
    </BankDetailsSection>
  );
};

const VariablesDetails = ({ analysis }: { analysis: PFileAnalysis }) => {
  const { variables, summary } = analysis;
  if (summary.variablesCorrupted && variables.length === 0) {
    return (
      <BankDetailsSection title="Variables">
        <p className={styles.wrap}>
          This area does not hold BASIC variables: a program keeps its own data here (machine code or
          tables), ended by the $80 the ROM expects.
        </p>
      </BankDetailsSection>
    );
  }
  if (variables.length === 0) {
    return (
      <BankDetailsSection title="Variables">
        <p className={styles.wrap}>No variables: the program was saved before it set any, or after CLEAR.</p>
      </BankDetailsSection>
    );
  }
  return (
    <BankDetailsSection title="Variables">
      <BankFacts>
        {variables.slice(0, VARIABLES_SHOWN).map((variable) => (
          <VariableFact key={variable.address} name={variable.name} value={describeZx81Variable(variable)} />
        ))}
      </BankFacts>
      {variables.length > VARIABLES_SHOWN && (
        <p className={styles.wrap}>{`and ${fmt(variables.length - VARIABLES_SHOWN)} more`}</p>
      )}
      {summary.variablesCorrupted && (
        <p className={styles.wrap}>The rest of the area does not read as variables.</p>
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
