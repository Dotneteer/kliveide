import { useMemo } from "react";
import classnames from "classnames";
import {
  BankBrowser,
  BankChip,
  BankDetailsSection,
  BankFacts,
  BankGroupLabel,
  BankRowText,
  type BankBrowserItem
} from "@renderer/controls/bankBrowser/BankBrowser";
import { ByteAnatomy, type ByteAnatomyField } from "@renderer/controls/bankBrowser/ByteAnatomy";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import { MC_TVC_MODEL, MI_TVC } from "@common/machines/constants";
import { TvcChars } from "@common/machines/char-codes";
import { TVC_PROGRAM_START } from "@common/tvc/codePlacement";
import { labelRecord } from "@common/i18n/labels";
import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import { BasicLineDisplay } from "../BasicPanel";
import { decodeTvcProgram } from "../tvcBasicListing";
import { documentSourceName } from "../helpers/documentSourceName";
import { formatPlayTime } from "../Tape/tapeView";
import { openTapeBlockView } from "../Tape/TapeBlockViewerPanel";
import { MemoryMapStrip, type MemoryMapBlock } from "../Ht1080zTape/MemoryMapStrip";
import styles from "../Ht1080zTape/Ht1080zTapeViewer.module.scss";
import { TVC_PROGRAM_FILE_TYPE, type TvcCasAnalysis, type TvcCasPart } from "./tvcCasModel";
import { tvcCasPartAnatomy } from "./tvcCasFields";

/*
 * The Videoton TVC `.cas` view: the same shape as the HT-1080Z tape's (`Ht1080zTapeViewerPanel`), which
 * shows it when the `.cas` it opened turns out to be a TVC tape (`detectCasFormat`). A summary strip,
 * the memory map of what loads at 19EFh, and the parts - the two headers, the BASIC program, the code
 * after it - in the shared bank browser.
 */

export type TvcPartView = "basic" | "memory" | "disassembly";

export type TvcCasViewState = {
  selectedPart?: number;
  partFilter?: string;
  partView?: Record<number, TvcPartView>;
};

type PartItem = BankBrowserItem<TvcPartView> & { part: TvcCasPart };

const VIEW_NAMES: Readonly<Record<TvcPartView, string>> = labelRecord({
  basic: "panels.helpers.view.basic",
  memory: "panels.helpers.view.memory",
  disassembly: "panels.helpers.view.disassembly"
});

const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (value: number) => `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
/* --- Byte counts sit beside hex as data: invariant */
const fmt = (value: number) => value.toLocaleString("en-US");
const span = (from: number, to: number) => `${hex4(from)}–${hex4(to - 1)}`;

function viewsOf(part: TvcCasPart): TvcPartView[] {
  switch (part.role) {
    case "basicProgram":
      return ["basic", "memory"];
    case "afterProgram":
    case "payload":
      return part.problem || part.bytes.length === 0 ? ["memory"] : ["disassembly", "memory"];
    default:
      return part.bytes.length ? ["memory"] : [];
  }
}

function chipOf(part: TvcCasPart): string {
  switch (part.role) {
    case "fileHeader":
      return translate("panels.tvcTape.chip.fileHeader");
    case "appHeader":
      return translate("panels.htTape.chip.header");
    case "basicProgram":
      return translate("panels.helpers.view.basic");
    case "afterProgram":
      return translate("panels.htTape.chip.code");
    case "payload":
      return translate("panels.tvcTape.chip.payload");
    default:
      return translate("panels.htTape.chip.trailing");
  }
}

function rowTextOf(part: TvcCasPart, analysis: TvcCasAnalysis): string {
  const lines = analysis.lines ?? [];
  switch (part.role) {
    case "fileHeader":
      return translate("panels.tvcTape.row.fileHeader", { count: analysis.size });
    case "appHeader":
      // --- LOAD is the command that loads the file: not translated
      return `LOAD "${analysis.name}"`;
    case "basicProgram":
      return lines.length
        ? translate("panels.htTape.row.lines", { count: lines.length, first: lines[0].lineNo, last: lines[lines.length - 1].lineNo })
        : "";
    case "afterProgram":
    case "payload":
      return part.loadFrom !== undefined && part.loadTo !== undefined && part.loadTo > part.loadFrom
        ? span(part.loadFrom, part.loadTo)
        : translate("panels.helpers.bytes", { count: part.bytes.length });
    default:
      return translate("panels.helpers.bytes", { count: part.bytes.length });
  }
}

/** The part selected when the document opens: what the file is for */
function initialPart(analysis: TvcCasAnalysis): number {
  const main = analysis.parts.find((p) => p.role === "basicProgram" || p.role === "payload");
  return main?.index ?? 0;
}

/** BASIC 2.2 (the 64K+) has more keywords than 1.2: listed as the running TVC's, else as 1.2 */
function useBasic22(): boolean {
  return useSelector((s) => s.emulatorState?.machineId === MI_TVC && s.emulatorState?.config?.[MC_TVC_MODEL] === "64p");
}

/** The program's lines, listed as BASIC lists them at 19EFh */
function useListing(analysis: TvcCasAnalysis, basic22: boolean) {
  return useMemo(() => {
    if (!analysis.programBytes) return undefined;
    const memory = new Uint8Array(0x10000);
    memory.set(analysis.payload.subarray(0, analysis.programBytes), TVC_PROGRAM_START);
    return decodeTvcProgram(memory, { charSet: TvcChars, basic22 }).lines.filter((l) => l.spans.length > 0);
  }, [analysis, basic22]);
}

type Props = {
  analysis: TvcCasAnalysis;
  bytes: Uint8Array;
  fullPath: string;
  viewState: TvcCasViewState;
  changeViewState: (change: (state: TvcCasViewState) => void) => void;
};

/** A module-level component, so it may hold hooks (see `GenericFilePanel`'s renderer note) */
export const TvcCasView = ({ analysis, bytes, fullPath, viewState: vs, changeViewState }: Props) => {
  const t = useT();
  const documentHubService = useDocumentHubService();
  const { navigationHistoryService } = useAppServices();
  const projectFolder = useSelector((s) => s.project?.folderPath);
  const basic22 = useBasic22();
  const listing = useListing(analysis, basic22);

  const items = useMemo<PartItem[]>(
    () =>
      analysis.parts.map((part) => {
        const views = viewsOf(part);
        const remembered = vs.partView?.[part.index];
        return {
          key: `${part.index}`,
          bank: part.index,
          lastView: remembered && views.includes(remembered) ? remembered : (views[0] ?? "memory"),
          part
        };
      }),
    [analysis, vs.partView]
  );

  const selected = vs.selectedPart ?? initialPart(analysis);
  const select = (index: number) => changeViewState((state) => (state.selectedPart = index));
  const source = documentSourceName(fullPath, projectFolder);

  const popOut = async (index: number, view: TvcPartView) => {
    const part = analysis.parts[index];
    if (!part) return;
    changeViewState((state) => {
      state.partView = { ...state.partView, [index]: view };
    });
    if (view === "basic" && analysis.programBytes) {
      await navigationHistoryService.recordJump("tapeBlock", () =>
        openTapeBlockView(documentHubService, {
          id: `tvcTapeBasic${fullPath}`,
          title: t("panels.htTape.title.basic", { source }),
          bytes: analysis.payload.subarray(0, analysis.programBytes),
          view: "basic",
          basicEnd: analysis.programBytes,
          format: basic22 ? "tvc22" : "tvc"
        })
      );
      return;
    }
    await navigationHistoryService.recordJump("tapeBlock", () =>
      openStaticMemoryDump(documentHubService, `tvcTapePart${fullPath}:${index}`, t("panels.htTape.title.part", { source, index }), part.bytes, {
        disassemblyEnabled: part.loadFrom !== undefined,
        disassOffset: part.loadFrom ?? 0,
        viewMode: view === "disassembly" ? "disassembly" : "memory"
      })
    );
  };

  const popOutFile = () =>
    navigationHistoryService.recordJump("tapeBlock", () =>
      openStaticMemoryDump(documentHubService, `tvcTapeFile${fullPath}`, t("panels.htTape.title.file", { source }), bytes, {
        disassemblyEnabled: false,
        viewMode: "memory"
      })
    );

  const filter = vs.partFilter ?? "all";
  const visible = filter === "loads" ? items.filter((i) => i.part.loadFrom !== undefined) : filter === "problems" ? items.filter((i) => !!i.part.problem) : items;

  return (
    <div className={styles.viewer}>
      <Summary analysis={analysis} onPopOutFile={() => void popOutFile()} />
      {analysis.hasProblems && (
        <div className={styles.banner} role="note">
          {t("panels.tvcTape.problemBanner")}
        </div>
      )}
      {analysis.recordCountsWrong && (
        <div className={styles.banner} role="note">
          {t("panels.tvcTape.recordCountsBanner", { records: analysis.recordLength, header: analysis.headerLength })}
        </div>
      )}
      <BankBrowser<PartItem, TvcPartView>
        visibleItems={visible}
        selectedKey={`${selected}`}
        heading={t("panels.htTape.heading.parts")}
        summary={t("panels.htTape.listSummary", { kind: "parts", count: analysis.parts.length })}
        filters={[
          { value: "all", text: t("panels.helpers.filter.all") },
          { value: "loads", text: t("panels.htTape.filter.loads") },
          { value: "problems", text: t("panels.htTape.filter.problems") }
        ]}
        filter={filter}
        views={["basic", "disassembly", "memory"]}
        viewNames={VIEW_NAMES}
        itemKind="part"
        layout="sideBySide"
        fill
        formatNumber={(item) => `#${item.bank}`}
        viewsFor={(item) => viewsOf(item.part)}
        onSelect={(item) => select(item.part.index)}
        onFilterChange={(value) => changeViewState((state) => (state.partFilter = value))}
        onPopOut={(item, view) => void popOut(item.part.index, view)}
        beforeBody={<Graphics analysis={analysis} selected={selected} onSelect={select} />}
        groupOf={() => ({
          key: "file",
          label: <BankGroupLabel title={t("panels.tvcTape.group", { name: analysis.name })} />
        })}
        renderRow={(item) => (
          <>
            <BankChip tone={item.part.problem ? "error" : undefined} alt={item.part.role === "fileHeader" || item.part.role === "appHeader"}>
              {chipOf(item.part)}
            </BankChip>
            <BankRowText title={rowTextOf(item.part, analysis)}>{rowTextOf(item.part, analysis)}</BankRowText>
            <span className={styles.rowLength}>{fmt(item.part.bytes.length)}</span>
          </>
        )}
        renderDetailsMarks={(item) => (
          <>
            <BankChip alt={item.part.role === "fileHeader" || item.part.role === "appHeader"}>{chipOf(item.part)}</BankChip>
            {item.part.problem && <BankChip tone="error">{t("panels.htTape.chip.problem")}</BankChip>}
          </>
        )}
        renderDetails={(item) => (
          <Details
            key={item.part.index}
            analysis={analysis}
            part={item.part}
            listing={listing}
            onShowAll={() => void popOut(item.part.index, "basic")}
          />
        )}
        hint={t("panels.helpers.popOutHint.part")}
      />
    </div>
  );
};

// =================================================================================================
// The summary

const Fact = ({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warning" }) => (
  <span className={styles.fact}>
    <span className={styles.factLabel}>{label}</span>
    <span className={classnames(styles.factValue, tone && styles[tone])}>{value}</span>
  </span>
);

const Summary = ({ analysis, onPopOutFile }: { analysis: TvcCasAnalysis; onPopOutFile: () => void }) => {
  const t = useT();
  const lines = analysis.lines ?? [];
  return (
    <div className={styles.summary} aria-label={t("panels.htTape.summaryLabel")}>
      <Fact label={t("panels.tape.fact.format")} value={t("panels.tvcTape.format")} />
      <Fact label={t("panels.tape.fact.size")} value={t("panels.helpers.bytes", { count: analysis.size })} />
      <Fact
        label={t("panels.tvcTape.fact.fileType")}
        value={
          analysis.fileType === TVC_PROGRAM_FILE_TYPE
            ? t("panels.tvcTape.fact.fileTypeProgram")
            : t("panels.tvcTape.fact.fileTypeOther", { value: hex2(analysis.fileType) })
        }
      />
      {lines.length > 0 && (
        <Fact
          label={t("panels.htTape.fact.program")}
          value={t("panels.htTape.fact.programValue", {
            count: lines.length,
            first: lines[0].lineNo,
            last: lines[lines.length - 1].lineNo,
            bytes: fmt(analysis.programBytes ?? 0)
          })}
        />
      )}
      <Fact label={t("panels.tvcTape.fact.payload")} value={t("panels.helpers.bytes", { count: analysis.payload.length })} />
      <Fact
        label={t("panels.tvcTape.fact.autostart")}
        value={analysis.autostart ? t("panels.tvcTape.fact.autostartOn") : t("panels.tvcTape.fact.autostartOff")}
      />
      {analysis.playMs > 0 && <Fact label={t("panels.tape.fact.playTime")} value={formatPlayTime(analysis.playMs)} />}
      <button type="button" className={styles.more} onClick={onPopOutFile}>
        {t("panels.htTape.popOutFile")}
      </button>
    </div>
  );
};

// =================================================================================================
// The graphics

const Graphics = ({ analysis, selected, onSelect }: { analysis: TvcCasAnalysis; selected: number; onSelect: (index: number) => void }) => {
  const blocks = useMemo<MemoryMapBlock[]>(
    () =>
      analysis.parts
        .filter((p) => p.loadFrom !== undefined && p.loadTo !== undefined && p.loadTo > p.loadFrom)
        .map((p) => ({
          index: p.index,
          from: p.loadFrom!,
          to: p.loadTo!,
          kind: p.role === "basicProgram" ? "basic" : "code",
          title: `#${p.index} · ${span(p.loadFrom!, p.loadTo!)}`
        })),
    [analysis]
  );
  if (!blocks.length) return null;
  return (
    <div className={styles.graphics}>
      <MemoryMapStrip blocks={blocks} selectedIndex={selected} onSelect={onSelect} />
    </div>
  );
};

// =================================================================================================
// The details

type DetailsProps = {
  analysis: TvcCasAnalysis;
  part: TvcCasPart;
  listing: ReturnType<typeof useListing>;
  onShowAll: () => void;
};

const Details = ({ analysis, part, listing, onShowAll }: DetailsProps) => {
  const t = useT();
  // --- `t` changes with the language, so the fields are worded again
  const anatomy = useMemo(
    () => tvcCasPartAnatomy(part),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [part, t]
  );
  const fields = useMemo<ByteAnatomyField[] | undefined>(
    () =>
      anatomy?.fields.map((field) => {
        const group = anatomy.groups[field.group];
        return { key: `${field.group}`, first: group.first, last: group.last, name: field.name, value: field.value, kind: group.kind };
      }),
    [anatomy]
  );

  return (
    <>
      <BankFacts>
        <dt>{t("panels.helpers.fact.length")}</dt>
        <dd>{t("panels.helpers.bytes", { count: part.bytes.length })}</dd>
        {part.loadFrom !== undefined && part.loadTo !== undefined && part.loadTo > part.loadFrom && (
          <>
            <dt>{t("panels.htTape.fact.loads")}</dt>
            <dd>{t("panels.htTape.detail.loads", { span: span(part.loadFrom, part.loadTo), count: part.loadTo - part.loadFrom })}</dd>
          </>
        )}
        {part.problem && (
          <>
            <dt>{t("panels.htTape.fact.problem")}</dt>
            <dd className={styles.error}>
              {t("panels.tvcTape.problem.truncated", { declared: analysis.headerLength || analysis.recordLength, count: part.bytes.length })}
            </dd>
          </>
        )}
      </BankFacts>

      {part.role === "basicProgram" && listing && listing.length > 0 && (
        <BankDetailsSection title={t("panels.helpers.view.basic")}>
          <div className={styles.listing} data-testid="tvc-tape-listing">
            {listing.map((line, i) => (
              <div key={i} className={styles.listingLine}>
                <BasicLineDisplay spans={line.spans} showSpectrumFont={false} />
              </div>
            ))}
          </div>
          <button type="button" className={styles.more} onClick={onShowAll}>
            {t("panels.helpers.popOutListing")}
          </button>
        </BankDetailsSection>
      )}

      {part.role === "afterProgram" && <p className={styles.hint}>{t("panels.tvcTape.detail.afterProgram")}</p>}

      {fields && fields.length > 0 && (
        <ByteAnatomy key={part.index} title={t("panels.htTape.section.bytes")} bytes={part.bytes} fields={fields} testId="tvc-tape-bytes" />
      )}
    </>
  );
};
