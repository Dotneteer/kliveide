import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import { uiLocale } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import {
  analyzeTape,
  blockLoadAddress,
  blockPayload,
  formatPlayTime,
  tapeRoleCount,
  type TapeAnalysis,
  type TapeBlockRole,
  type TapeBlockView
} from "./tapeView";
import { TapeBlockBrowser, basicSourceOf } from "./TapeBlockBrowser";
import { tapeBlockDumpId, tapeBlockTitle, tapeBlockViewDocumentId } from "./tapeBlockDocument";
import { openTapeBlockView } from "./TapeBlockViewerPanel";
import styles from "./TapeViewerPanel.module.scss";

/*
 * The `.tap`/`.tzx` viewer (`.plans/TAPE_VIEWER_PLAN.md`): a summary strip, then every block in the
 * shared bank browser - grouped by file, with the timeline strip above it - and each block poppable
 * as memory, disassembly, a BASIC listing or a screen.
 *
 * It replaced `TapViewerPanel`, a single scroll of one expandable hex dump per block.
 */

type TapeViewState = {
  scrollPosition?: number;
  selectedBlock?: number;
  blockFilter?: string;
  /** The view each block last popped out in */
  blockView?: Record<number, TapeBlockView>;
  /** Headerless blocks the user asked to read as BASIC */
  basicOverride?: Record<number, boolean>;
  /** Where the user asked a headerless block to be listed */
  listAt?: Record<number, number>;
};

type ViewContext = GenericFileContext<TapeAnalysis, TapeViewState>;

/** Parses a tape for the viewer */
export function loadTapeFileContents(contents: Uint8Array): {
  fileInfo?: TapeAnalysis;
  error?: string;
} {
  const { analysis, error } = analyzeTape(contents);
  return analysis ? { fileInfo: analysis } : { error };
}

const TapeViewerPanel = ({ document, contents, viewState }: DocumentProps<TapeViewState>) => (
  <GenericFilePanel<TapeAnalysis, TapeViewState>
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
    fileLoader={loadTapeFileContents}
    validRenderer={(ctx) => (
      <TapeView ctx={ctx} fullPath={document.node?.fullPath ?? document.path ?? document.id} />
    )}
  />
);

export const createTapeViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <TapeViewerPanel
    key={document.id}
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);

/** A module-level component, so it may hold hooks (see `GenericFilePanel`'s renderer note) */
const TapeView = ({ ctx, fullPath }: { ctx: ViewContext; fullPath: string }) => {
  const t = useT();
  const documentHubService = useDocumentHubService();
  const { navigationHistoryService } = useAppServices();
  const projectFolder = useSelector((s) => s.project?.folderPath);
  const analysis = ctx.fileInfo;
  if (!analysis) return null;
  const vs = ctx.viewState ?? {};

  /** Pop a block out in the view asked for. Recorded, so Go Back returns here. */
  const popOut = async (index: number, view: TapeBlockView) => {
    const block = analysis.blocks[index];
    const payload = block ? blockPayload(block) : undefined;
    if (!block || !payload) return;
    ctx.changeViewState((state) => {
      state.blockView = { ...state.blockView, [index]: view };
    });
    const fileHeader =
      block.headerIndex !== undefined ? analysis.blocks[block.headerIndex].header : undefined;

    if (view === "memory" || view === "disassembly") {
      await navigationHistoryService.recordJump("tapeBlock", () =>
        openStaticMemoryDump(
          documentHubService,
          tapeBlockDumpId(fullPath, index),
          tapeBlockTitle(fullPath, index, projectFolder),
          payload,
          {
            disassemblyEnabled: true,
            disassOffset: blockLoadAddress(block, fileHeader, vs.listAt?.[index] ?? 0),
            viewMode: view
          }
        )
      );
      return;
    }

    const basic = view === "basic" ? basicSourceOf(analysis, block, true) : undefined;
    await navigationHistoryService.recordJump("tapeBlock", () =>
      openTapeBlockView(documentHubService, {
        id: tapeBlockViewDocumentId(fullPath, index, view),
        title: tapeBlockTitle(fullPath, index, projectFolder, view),
        bytes: payload,
        view,
        basicEnd: basic?.end,
        autostart: basic?.autostart
      })
    );
  };

  return (
    <div className={styles.viewer}>
      <Summary analysis={analysis} />
      {analysis.summary.unplayableCount > 0 && (
        <div className={styles.banner} role="note">
          {t("panels.tape.unplayableBanner", { count: analysis.summary.unplayableCount })}
        </div>
      )}
      <TapeBlockBrowser
        analysis={analysis}
        selectedIndex={vs.selectedBlock}
        filter={vs.blockFilter ?? "all"}
        blockView={vs.blockView}
        basicOverride={vs.basicOverride}
        listAt={vs.listAt}
        onSelect={(index) => ctx.changeViewState((state) => (state.selectedBlock = index))}
        onFilterChange={(filter) => ctx.changeViewState((state) => (state.blockFilter = filter))}
        onPopOut={(index, view) => void popOut(index, view)}
        onInterpretAsBasic={(index, on) =>
          ctx.changeViewState((state) => {
            state.basicOverride = { ...state.basicOverride, [index]: on };
          })
        }
        onListAt={(index, address) =>
          ctx.changeViewState((state) => {
            state.listAt = { ...state.listAt, [index]: address };
          })
        }
      />
    </div>
  );
};

const ROLE_ORDER: TapeBlockRole[] = ["basic", "code", "screen", "numArray", "charArray"];

const Fact = ({ label, value, title }: { label: string; value: string; title?: string }) => (
  <span className={styles.fact} title={title}>
    <span className={styles.factLabel}>{label}</span>
    <span className={styles.factValue}>{value}</span>
  </span>
);

const Summary = ({ analysis }: { analysis: TapeAnalysis }) => {
  const t = useT();
  const { summary } = analysis;
  const roles = ROLE_ORDER.filter((role) => summary.roleCounts[role])
    .map((role) => tapeRoleCount(role, summary.roleCounts[role] ?? 0))
    .join(t("panels.tape.fact.listSeparator"));
  const count = (n: number) => n.toLocaleString(uiLocale());
  return (
    <div className={styles.summary} aria-label={t("panels.tape.summaryLabel")}>
      <Fact label={t("panels.tape.fact.format")} value={summary.version ? `TZX ${summary.version}` : summary.format} />
      <Fact label={t("panels.tape.fact.size")} value={t("panels.helpers.bytes", { count: summary.size })} />
      <Fact label={t("panels.tape.fact.blocks")} value={count(summary.blockCount)} />
      <Fact
        label={t("panels.tape.fact.files")}
        value={
          roles
            ? t("panels.tape.fact.filesValue", { count: summary.fileCount, roles })
            : count(summary.fileCount)
        }
      />
      <Fact
        label={t("panels.tape.fact.playTime")}
        value={`${summary.durationApprox ? "~" : ""}${formatPlayTime(summary.durationMs)}`}
        title={summary.durationApprox ? t("panels.tape.fact.playTimeApprox") : undefined}
      />
      {summary.title && <Fact label={t("panels.tape.archive.title")} value={summary.title} />}
      {summary.publisher && <Fact label={t("panels.tape.archive.publisher")} value={summary.publisher} />}
      {summary.year && <Fact label={t("panels.tape.archive.year")} value={summary.year} />}
      {summary.authors && <Fact label={t("panels.tape.archive.authors")} value={summary.authors} />}
    </div>
  );
};
