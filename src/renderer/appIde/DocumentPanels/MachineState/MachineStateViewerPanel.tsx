import { t as translate, uiLocale } from "@common/i18n/i18n";
import { labelRecord } from "@common/i18n/labels";
import { useT } from "@common/i18n/useT";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";
import type { KliveStateReadResult } from "@common/machineState/kliveStateFile";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { Fact, FactFlag, FactNote, Facts, FactSection, FactsWithPicture } from "@renderer/controls/data/FileFacts";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { readKliveStateFile } from "@common/machineState/kliveStateFile";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_SD_CARD, MEDIA_TAPE } from "@common/structs/project-const";

/*
 * The Klive state file (`.kls`) viewer (`dev/plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.9): the
 * screen as it was saved, the machine, when and by which Klive it was saved, the media it had, and
 * whether it carries a portable .szx part. It reads the file without inflating the memory image and
 * runs no core. Built from the shared file-facts primitives (`controls/data/FileFacts`).
 */

/* --- M2: `ch`, not px */
const LABEL_WIDTH = "18ch";

type MachineStateViewState = {
  scrollPosition?: number;
  summaryExpanded?: boolean;
  mediaExpanded?: boolean;
  fileExpanded?: boolean;
};

type ViewContext = GenericFileContext<KliveStateReadResult, MachineStateViewState>;

/** Reads a state file for the viewer; a broken file is reported, not thrown */
export function loadMachineStateFileContents(contents: Uint8Array): {
  fileInfo?: KliveStateReadResult;
  error?: string;
} {
  try {
    return { fileInfo: readKliveStateFile(contents, { skipImage: true }) };
  } catch (err) {
    return {
      error: translate("panels.machineState.invalid", { reason: err instanceof Error ? err.message : String(err) })
    };
  }
}

/** Copies a thumbnail's RGBA bytes into the canvas's ABGR words (the same byte order) */
function thumbnailPixels(data: Uint8Array, _palette: number[], target: Uint32Array): void {
  target.set(new Uint32Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 4)));
}

const MEDIA_NAMES: Readonly<Record<string, string>> = labelRecord({
  [MEDIA_TAPE]: "panels.helpers.media.tape",
  [MEDIA_DISK_A]: "panels.helpers.media.diskA",
  [MEDIA_DISK_B]: "panels.helpers.media.diskB",
  [MEDIA_SD_CARD]: "panels.helpers.media.sdCard"
});

const MachineStateViewerPanel = ({ document, contents, viewState }: DocumentProps<MachineStateViewState>) => (
  <GenericFilePanel<KliveStateReadResult, MachineStateViewState>
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
    fileLoader={(bytes) => loadMachineStateFileContents(bytes)}
    validRenderer={(ctx) => <StateView ctx={ctx} />}
  />
);

export const createMachineStateViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <MachineStateViewerPanel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);

/** A module-level component, so it may hold state (see `GenericFilePanel`'s renderer note) */
const StateView = ({ ctx }: { ctx: ViewContext }) => {
  const t = useT();
  const info = ctx.fileInfo;
  if (!info) return null;
  const h = info.header;
  const savedAt = new Date(h.savedAt);
  return (
    <>
      <FactSection
        title={t("panels.machineState.heading")}
        expanded={ctx.viewState?.summaryExpanded ?? true}
        onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.summaryExpanded = exp))}
      >
        <FactsWithPicture
          picture={
            info.thumbnail && (
              <ScreenCanvas
                data={info.thumbnail.rgba}
                palette={[]}
                zoomFactor={info.thumbnail.width <= 200 ? 2 : 1}
                screenWidth={info.thumbnail.width}
                screenHeight={info.thumbnail.height}
                createPixelData={thumbnailPixels}
              />
            )
          }
        >
          <Facts labelWidth={LABEL_WIDTH}>
            <Fact label={t("panels.helpers.label.machine")}>{h.machineName ?? h.machineId}</Fact>
            <Fact label={t("panels.helpers.label.saved")}>
              {isNaN(savedAt.getTime()) ? h.savedAt : savedAt.toLocaleString(uiLocale())}
            </Fact>
            <Fact label={t("panels.helpers.label.savedBy")}>{t("panels.helpers.kliveVersion", { version: h.kliveVersion })}</Fact>
            <Fact label="PC:" tone="state">
              ${toHexa4(h.pc)}
            </Fact>
            <FactFlag label={t("panels.machineState.portableSzx")} value={!!info.szx} />
          </Facts>
          <FactNote>
            {info.szx ? t("panels.machineState.loadsWithSzx") : t("panels.machineState.loadsWithoutSzx")}
          </FactNote>
        </FactsWithPicture>
      </FactSection>
      <FactSection
        title={t("panels.helpers.heading.media")}
        meta={info.media.length || undefined}
        expanded={ctx.viewState?.mediaExpanded ?? true}
        onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.mediaExpanded = exp))}
      >
        {info.media.length === 0 ? (
          <FactNote>{t("panels.helpers.media.none")}</FactNote>
        ) : (
          <Facts labelWidth={LABEL_WIDTH}>
            {info.media.map((m) => (
              <Fact key={m.id} label={MEDIA_NAMES[m.id] ?? `${m.id}:`}>
                {m.fileName ?? "-"}
              </Fact>
            ))}
          </Facts>
        )}
        {info.media.some((m) => m.id === MEDIA_DISK_A || m.id === MEDIA_DISK_B) && (
          <FactNote>{t("panels.machineState.disksDetached")}</FactNote>
        )}
      </FactSection>
      <FactSection
        title={t("panels.helpers.heading.file")}
        expanded={ctx.viewState?.fileExpanded ?? false}
        onExpandedChange={(exp) => ctx.changeViewState((vs) => (vs.fileExpanded = exp))}
      >
        <Facts labelWidth={LABEL_WIDTH}>
          <Fact label={t("panels.helpers.label.machineId")}>{`${h.machineId}${h.modelId ? ` / ${h.modelId}` : ""}`}</Fact>
          <Fact label={t("panels.helpers.label.core")}>{h.coreId}</Fact>
          <Fact label={t("panels.helpers.label.fingerprint")}>{h.fingerprint}</Fact>
          <Fact label={t("panels.machineState.memoryImage")}>
            {t("panels.machineState.memoryImageValue", {
              mib: (h.memorySize / 1048576).toLocaleString(uiLocale(), {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
              }),
              kib: Math.round(info.compressedImageSize / 1024)
            })}
          </Fact>
          {info.unknownSections.length > 0 && (
            <Fact label={t("panels.helpers.label.unknownSections")}>{info.unknownSections.join(", ")}</Fact>
          )}
        </Facts>
      </FactSection>
    </>
  );
};
