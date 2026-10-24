import { useMemo, useState, type ComponentProps } from "react";
import classnames from "classnames";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { DiskFileEntry, DiskSectorRole } from "@common/diskfs/types";
import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
import { ZxSpectrumChars } from "@common/machines/char-codes";
import { MEDIA_DISK_A, MEDIA_DISK_B } from "@common/structs/project-const";
import { SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import { EmptyState, PanelHeader, PanelHeaderActions } from "@renderer/controls/data";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { Checkbox } from "@renderer/controls/Checkbox";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { RenameDialog, type RenameDialogResult } from "@renderer/appIde/dialogs/RenameDialog";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { carriesFiles, droppedFilePaths } from "@renderer/features/explorer/projectFileDrag";
import { GenericFilePanel, type GenericFileContext } from "../helpers/GenericFilePanel";
import { StaticMemoryView } from "../StaticMemoryView";
import { decodeBasicProgram } from "../basicListing";
import { BasicLineDisplay } from "../BasicPanel";
import basicStyles from "../BasicPanel.module.scss";
import { createScrPixelData } from "../Next/ScrFileViewerPanel";
import { CodeStartDialog } from "./CodeStartDialog";
import { openTapeBlockView } from "../Tape/TapeBlockViewerPanel";
import { DskSurfaceView } from "./DskSurfaceView";
import { failureText, readErrorText } from "./diskErrorText";
import {
  addHostFiles,
  compactDisk,
  deleteFiles,
  extractFile,
  renameFile,
  runDiskEdit,
  type DiskActionFailure,
  type DiskExplorerPorts
} from "./diskExplorerActions";
import { readDiskFile } from "@common/diskfs/edit";
import {
  analyzeDiskImage,
  previewKindOf,
  sectorFlags,
  type DiskExplorerModel,
  type ExplorerSector
} from "./diskExplorerModel";
import styles from "./DiskExplorerPanel.module.scss";

/*
 * The Disk Explorer (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B4/B5): a `.dsk`, `.trd` or `.scl`
 * as its files - listed, previewed, added, extracted, deleted, renamed, their attributes set - and,
 * in the Layout view, as its tracks and sectors, each sector named by what it holds. It replaced
 * `DskViewerPanel`, whose track-by-track view is the Layout view's "Surface" switch.
 */

type DiskExplorerViewState = {
  scrollPosition?: number;
  view?: "files" | "layout";
  selected?: string;
  showDeleted?: boolean;
  /** The selected sector, `trackIndex * 256 + sectorIndex` */
  sector?: number;
  surface?: boolean;
};

type Loaded = { model: DiskExplorerModel; bytes: Uint8Array };
type ViewContext = GenericFileContext<Loaded, DiskExplorerViewState>;

const DiskExplorerPanel = ({ document, contents, viewState }: DocumentProps<DiskExplorerViewState>) => {
  const fileName = document.node?.fullPath ?? document.path ?? document.id;
  return (
    <GenericFilePanel<Loaded, DiskExplorerViewState>
      document={document}
      contents={contents}
      viewState={viewState}
      apiLoaded={() => {}}
      fileLoader={(bytes) => {
        try {
          return { fileInfo: { model: analyzeDiskImage(bytes, fileName), bytes } };
        } catch (err) {
          return { error: readErrorText(err, translate) };
        }
      }}
      validRenderer={(ctx) => <DiskExplorerView ctx={ctx} document={document} />}
    />
  );
};

export const createDiskExplorerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <DiskExplorerPanel key={document.id} document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);

/** A module-level component, so it may hold hooks (see `GenericFilePanel`'s renderer note) */
const DiskExplorerView = ({ ctx, document }: { ctx: ViewContext; document: DocumentProps["document"] }) => {
  const t = useT();
  const mainApi = useMainApi();
  const dialogs = useDialogs();
  const documentHubService = useDocumentHubService();
  const media = useSelector((s) => s.media);
  const [failure, setFailure] = useState<DiskActionFailure | undefined>();
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  const loaded = ctx.fileInfo;
  if (!loaded) return null;
  const { model, bytes } = loaded;
  const filePath = document.node?.fullPath ?? document.path ?? document.id;
  const vs = ctx.viewState ?? {};
  const view = vs.view ?? (model.fsError ? "layout" : "files");
  const files = vs.showDeleted ? [...model.files, ...model.deletedFiles] : model.files;
  const selected = files.find((f) => f.name === vs.selected && !f.deleted) ?? files.find((f) => f.name === vs.selected);
  const set = (change: (state: DiskExplorerViewState) => void) => ctx.changeViewState(change);

  // --- The drive the image is in, if any (D4)
  const mounted = [MEDIA_DISK_A, MEDIA_DISK_B].findIndex((id) => sameFile(media?.[id]?.diskFile, filePath));

  const ports: DiskExplorerPorts = {
    beginEdit: (path) => mainApi.beginDiskImageEdit(path),
    commitEdit: (path, data, start) => mainApi.commitDiskImageEdit(path, data, start),
    cancelEdit: (start) => mainApi.cancelDiskImageEdit(start),
    reload: () => documentHubService.reloadDocument(document.id),
    pickHostFile: async () => (await mainApi.showOpenFileDialog(undefined, "diskExplorer.addFolder")) || undefined,
    readHostFile: (path) => mainApi.readBinaryFile(path),
    pickSavePath: (name) => mainApi.showSaveFileDialog({ title: t("panels.diskExplorer.extractTitle"), defaultPath: name, settingsId: "diskExplorer.extractFolder" }),
    writeHostFile: async (path, data) => {
      await mainApi.saveBinaryFile(path, data);
    },
    confirm: (kind, names) =>
      kind === "delete"
        ? mainApi.confirmAction(
            t("panels.diskExplorer.confirm.deleteTitle"),
            t("panels.diskExplorer.confirm.delete", { count: names.length, name: names[0] ?? "" }),
            undefined,
            t("panels.diskExplorer.confirm.deleteButton")
          )
        : kind === "replace"
          ? mainApi.confirmAction(
              t("panels.diskExplorer.confirm.replaceTitle"),
              t("panels.diskExplorer.confirm.replace", { count: names.length, name: names[0] ?? "" }),
              undefined,
              t("panels.diskExplorer.confirm.replaceButton")
            )
          : mainApi.confirmAction(
              t("panels.diskExplorer.confirm.compactTitle"),
              t("panels.diskExplorer.confirm.compact"),
              undefined,
              t("panels.diskExplorer.confirm.compactButton")
            ),
    askName: async (oldName) =>
      (
        await dialogs.open<RenameDialogResult, Omit<ComponentProps<typeof RenameDialog>, "controls">>(
          RenameDialog,
          { oldPath: oldName },
          { title: t("panels.diskExplorer.renameTitle"), width: 420, iconName: "pencil" }
        )
      )?.name,
    askCodeStart: async (fileName) =>
      (
        await dialogs.open<{ start: number }, Omit<ComponentProps<typeof CodeStartDialog>, "controls">>(
          CodeStartDialog,
          { fileName: fileName.replace(/^.*[\\/]/, "") },
          { title: t("panels.diskExplorer.codeStart.title"), width: 420, iconName: "plus" }
        )
      )?.start,
    reportFailure: setFailure
  };

  /** Runs an action, one at a time, clearing the last failure */
  const act = (action: () => Promise<unknown>) => async () => {
    if (busy) return;
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const canEdit = !!model.system && !busy;
  const editable = canEdit && !!selected && !selected.deleted;
  const plus3 = model.system === "+3dos";

  return (
    <div
      className={classnames(styles.explorer, { [styles.dropTarget]: dropping })}
      onDragOver={(e) => {
        if (!canEdit || !carriesFiles(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        if (!canEdit) return;
        const paths = droppedFilePaths(e.dataTransfer);
        if (paths.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        void act(() => addHostFiles(ports, filePath, model.system!, model.files, paths))();
      }}
    >
      <PanelHeader title={headerTitle(model, t)}>
        {model.info && (
          <span className={styles.facts}>
            {t("panels.diskExplorer.space", {
              free: formatSize(model.info.freeBytes),
              total: formatSize(model.info.totalBytes),
              files: model.files.length
            })}
          </span>
        )}
        {mounted >= 0 && (
          <span className={styles.mounted} title={t("panels.diskExplorer.mountedTitle")}>
            {t("panels.diskExplorer.mounted", { drive: mounted === 0 ? "A" : "B" })}
          </span>
        )}
        <PanelHeaderActions>
          <SmallIconButton iconName="files" title={t("panels.diskExplorer.viewFiles")} selected={view === "files"} clicked={() => set((s) => { s.view = "files"; })} />
          <SmallIconButton iconName="spr-grid" title={t("panels.diskExplorer.viewLayout")} selected={view === "layout"} clicked={() => set((s) => { s.view = "layout"; })} />
          <ToolbarSeparator small={true} />
          <SmallIconButton iconName="plus" title={t("panels.diskExplorer.add")} enable={canEdit} clicked={act(() => addHostFiles(ports, filePath, model.system!, model.files))} />
          <SmallIconButton iconName="save" title={t("panels.diskExplorer.extract")} enable={!!selected && !selected.deleted} clicked={act(() => extractFile(ports, filePath, bytes, selected!))} />
          <SmallIconButton iconName="pencil" title={t("panels.diskExplorer.rename")} enable={editable} clicked={act(() => renameFile(ports, filePath, selected!.name))} />
          <SmallIconButton iconName="trash" title={t("panels.diskExplorer.delete")} enable={editable} clicked={act(() => deleteFiles(ports, filePath, [selected!.name]))} />
          {model.system === "trdos" && (
            <SmallIconButton iconName="combine" title={t("panels.diskExplorer.compact")} enable={canEdit && model.deletedFiles.length > 0} clicked={act(() => compactDisk(ports, filePath))} />
          )}
          <SmallIconButton
            iconName={vs.showDeleted ? "eye" : "eye-off"}
            title={t("panels.diskExplorer.showDeleted")}
            selected={!!vs.showDeleted}
            clicked={() => set((s) => { s.showDeleted = !s.showDeleted; })}
          />
          <SmallIconButton iconName="refresh" title={t("panels.diskExplorer.reload")} clicked={act(() => ports.reload())} />
        </PanelHeaderActions>
      </PanelHeader>
      {failure && (
        <div className={styles.banner} role="alert">
          {failureText(failure, t)}
        </div>
      )}
      {model.warnings.length > 0 && (
        <div className={styles.note} role="note">
          {model.warnings.join(" ")}
        </div>
      )}
      {view === "files" ? (
        model.fsError ? (
          <EmptyState tone="error" motif={false} message={failureText({ code: model.fsError.code, args: model.fsError.args }, t)} />
        ) : (
          <div className={styles.body}>
            <ScrollViewer className={styles.listPane} thinScrollBar={true}>
              <FileTable
                files={files}
                plus3={plus3}
                selected={selected?.name}
                onSelect={(name) => set((s) => { s.selected = name; })}
              />
              {files.length === 0 && <EmptyState message={t("panels.diskExplorer.noFiles")} />}
            </ScrollViewer>
            <ScrollViewer className={styles.inspector} thinScrollBar={true}>
              {selected ? (
                <FilePreview
                  file={selected}
                  model={model}
                  bytes={bytes}
                  filePath={filePath}
                  busy={busy}
                  onAttributes={(attributes) =>
                    act(() => runDiskEdit(ports, filePath, { kind: "attributes", name: selected.name, attributes }))()
                  }
                  onShowSectors={() =>
                    set((s) => {
                      s.view = "layout";
                      const first = selected.sectors[0];
                      if (first) s.sector = first.trackIndex * 256 + first.sectorIndex;
                    })
                  }
                  onOpenDump={(mode) => {
                    const data = readDiskFile(bytes, filePath, selected.name);
                    void openStaticMemoryDump(
                      documentHubService,
                      `diskFile:${filePath}:${selected.name}`,
                      `${selected.name} (${filePath.replace(/^.*[\\/]/, "")})`,
                      data,
                      { disassemblyEnabled: true, disassOffset: selected.start ?? 0, viewMode: mode }
                    );
                  }}
                  onOpenBasic={() => {
                    const data = readDiskFile(bytes, filePath, selected.name);
                    void openTapeBlockView(documentHubService, {
                      id: `diskFileBasic:${filePath}:${selected.name}`,
                      title: t("panels.diskExplorer.basicTitle", {
                        name: selected.name,
                        source: filePath.replace(/^.*[\\/]/, "")
                      }),
                      bytes: data,
                      view: "basic",
                      basicEnd: selected.variablesOffset ?? data.length,
                      autostart: selected.start
                    });
                  }}
                />
              ) : (
                <EmptyState message={t("panels.diskExplorer.selectFile")} />
              )}
            </ScrollViewer>
          </div>
        )
      ) : (
        <LayoutView
          model={model}
          bytes={bytes}
          document={document}
          selectedSector={vs.sector}
          highlight={selected}
          surface={!!vs.surface}
          onSurface={(on) => set((s) => { s.surface = on; })}
          onSelectSector={(key) => set((s) => { s.sector = key; })}
          onSelectFile={(name) => set((s) => { s.selected = name; s.view = "files"; })}
        />
      )}
    </div>
  );
};

// -------------------------------------------------------------------------------------------------
// Files view

const FileTable = ({
  files,
  plus3,
  selected,
  onSelect
}: {
  files: DiskFileEntry[];
  plus3: boolean;
  selected?: string;
  onSelect: (name: string) => void;
}) => {
  const t = useT();
  return (
    <div className={classnames(styles.table, { [styles.plus3]: plus3 })} role="grid">
      <div className={styles.headerRow} role="row">
        <span role="columnheader">{t("panels.diskExplorer.col.name")}</span>
        <span role="columnheader">{t("panels.diskExplorer.col.kind")}</span>
        <span role="columnheader" className={styles.number}>{t("panels.diskExplorer.col.size")}</span>
        <span role="columnheader" className={styles.number}>{t("panels.diskExplorer.col.start")}</span>
        {plus3 && <span role="columnheader">{t("panels.diskExplorer.col.attributes")}</span>}
        {plus3 && <span role="columnheader" className={styles.number}>{t("panels.diskExplorer.col.user")}</span>}
      </div>
      {files.map((file) => (
        <div
          key={`${file.name}:${file.deleted}`}
          role="row"
          aria-selected={file.name === selected}
          className={classnames(styles.row, { [styles.rowSelected]: file.name === selected, [styles.deleted]: file.deleted })}
          onClick={() => onSelect(file.name)}
        >
          <span className={styles.name}>{file.name}</span>
          <span>{kindText(file, t)}</span>
          <span className={styles.number}>{file.size}</span>
          <span className={styles.number}>{file.start ?? ""}</span>
          {plus3 && <span>{attributesText(file)}</span>}
          {plus3 && <span className={styles.number}>{file.user ?? 0}</span>}
        </div>
      ))}
    </div>
  );
};

const FilePreview = ({
  file,
  model,
  bytes,
  filePath,
  busy,
  onAttributes,
  onShowSectors,
  onOpenDump,
  onOpenBasic
}: {
  file: DiskFileEntry;
  model: DiskExplorerModel;
  bytes: Uint8Array;
  filePath: string;
  busy: boolean;
  onAttributes: (attributes: Partial<DiskFileEntry["attributes"]>) => void;
  onShowSectors: () => void;
  onOpenDump: (mode: "memory" | "disassembly") => void;
  /** Pops a BASIC program out into its own listing tab (the tape viewer's BASIC view) */
  onOpenBasic: () => void;
}) => {
  const t = useT();
  const data = useMemo(() => (file.deleted ? new Uint8Array(0) : safeRead(bytes, filePath, file.name)), [bytes, filePath, file]);
  const kind = previewKindOf(file);
  return (
    <div className={styles.preview}>
      <dl className={styles.facts}>
        <dt>{t("panels.diskExplorer.col.name")}</dt>
        <dd>{file.name}</dd>
        <dt>{t("panels.diskExplorer.col.kind")}</dt>
        <dd>{kindText(file, t)}</dd>
        <dt>{t("panels.diskExplorer.col.size")}</dt>
        <dd>{t("panels.diskExplorer.sizeOnDisk", { size: file.size, allocated: file.allocated })}</dd>
        {file.start !== undefined && (
          <>
            <dt>{file.kind === "basic" ? t("panels.diskExplorer.autorun") : t("panels.diskExplorer.col.start")}</dt>
            <dd>{file.kind === "basic" ? file.start : `${file.start} ($${file.start.toString(16).toUpperCase().padStart(4, "0")})`}</dd>
          </>
        )}
        {file.variableName && (
          <>
            <dt>{t("panels.diskExplorer.variable")}</dt>
            <dd>{file.variableName}</dd>
          </>
        )}
      </dl>
      {model.system === "+3dos" && !file.deleted && (
        <div className={styles.attributes}>
          <Checkbox right={true} label={t("panels.diskExplorer.attr.readOnly")} initialValue={file.attributes.readOnly} enabled={!busy} onChange={(v) => onAttributes({ readOnly: v })} />
          <Checkbox right={true} label={t("panels.diskExplorer.attr.system")} initialValue={file.attributes.system} enabled={!busy} onChange={(v) => onAttributes({ system: v })} />
          <Checkbox right={true} label={t("panels.diskExplorer.attr.archive")} initialValue={file.attributes.archive} enabled={!busy} onChange={(v) => onAttributes({ archive: v })} />
        </div>
      )}
      <div className={styles.previewActions}>
        <SmallIconButton iconName="spr-grid" title={t("panels.diskExplorer.showSectors")} enable={file.sectors.length > 0} clicked={onShowSectors} />
        <SmallIconButton iconName="binary" title={t("panels.diskExplorer.openMemory")} enable={data.length > 0} clicked={() => onOpenDump("memory")} />
        <SmallIconButton iconName="logs" title={t("panels.diskExplorer.openDisassembly")} enable={data.length > 0 && file.kind !== "basic"} clicked={() => onOpenDump("disassembly")} />
        {kind === "basic" && (
          <SmallIconButton iconName="code" title={t("panels.diskExplorer.openBasic")} enable={data.length > 0} clicked={onOpenBasic} />
        )}
      </div>
      {data.length > 0 && kind === "basic" && <BasicPreview data={data} end={file.variablesOffset ?? data.length} />}
      {data.length >= 6912 && kind === "screen" && (
        <ScreenCanvas data={data} palette={SPECTRUM_48_COLORS} zoomFactor={1} screenWidth={256} screenHeight={192} createPixelData={createScrPixelData} />
      )}
      {data.length > 0 && (kind === "code" || kind === "hex") && <StaticMemoryView memory={data} />}
    </div>
  );
};

const BasicPreview = ({ data, end }: { data: Uint8Array; end: number }) => {
  const lines = useMemo(() => decodeBasicProgram(data, 0, Math.min(end, data.length), { charSet: ZxSpectrumChars }).lines, [data, end]);
  return (
    <div className={styles.basic}>
      {lines.map((line, i) => (
        <div key={i} className={basicStyles.item}>
          <BasicLineDisplay spans={line.spans} showSpectrumFont={false} />
        </div>
      ))}
    </div>
  );
};

// -------------------------------------------------------------------------------------------------
// Layout view

const LayoutView = ({
  model,
  bytes,
  document,
  selectedSector,
  highlight,
  surface,
  onSurface,
  onSelectSector,
  onSelectFile
}: {
  model: DiskExplorerModel;
  bytes: Uint8Array;
  document: DocumentProps["document"];
  selectedSector?: number;
  highlight?: DiskFileEntry;
  surface: boolean;
  onSurface: (on: boolean) => void;
  onSelectSector: (key: number) => void;
  onSelectFile: (name: string) => void;
}) => {
  const t = useT();
  const highlighted = useMemo(
    () => new Set((highlight?.sectors ?? []).map((s) => s.trackIndex * 256 + s.sectorIndex)),
    [highlight]
  );
  const sector = selectedSector === undefined ? undefined : model.tracks[selectedSector >> 8]?.sectors[selectedSector & 0xff];
  return (
    <div className={styles.layout}>
      <div className={styles.legend}>
        {(["system", "directory", "file", "free", "unused"] as const).map((role) => (
          <span key={role} className={styles.legendItem}>
            <span className={classnames(styles.chip, styles[`role-${role}`])} />
            {t(ROLE_KEYS[role])}
          </span>
        ))}
        {model.kind === "dsk" && (
          <label className={styles.surfaceSwitch}>
            <input type="checkbox" checked={surface} onChange={(e) => onSurface(e.target.checked)} />
            {t("panels.diskExplorer.surface")}
          </label>
        )}
      </div>
      {surface && model.kind === "dsk" ? (
        <div className={styles.surface}>
          <DskSurfaceView document={document} contents={bytes} />
        </div>
      ) : (
        <div className={classnames(styles.body, styles.layoutBody)}>
          <ScrollViewer className={styles.listPane} thinScrollBar={true}>
            <div className={styles.tracks}>
              {model.tracks.map((track) => (
                <div key={track.trackIndex} className={styles.track}>
                  <span className={styles.trackLabel}>
                    {model.sides > 1 ? `${track.cylinder}:${track.side}` : `${track.cylinder}`}
                  </span>
                  {track.unformatted ? (
                    <span className={styles.unformatted}>{t("panels.diskExplorer.unformatted")}</span>
                  ) : (
                    track.sectors.map((s) => {
                      const key = track.trackIndex * 256 + s.sectorIndex;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={classnames(styles.chip, styles[`role-${s.role.role}`], {
                            [styles.chipSelected]: key === selectedSector,
                            [styles.chipHighlighted]: highlighted.has(key),
                            [styles.chipFlagged]: sectorFlags(s).length > 0
                          })}
                          title={sectorTitle(s, t)}
                          aria-label={sectorTitle(s, t)}
                          onClick={() => onSelectSector(key)}
                        />
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          </ScrollViewer>
          <ScrollViewer className={styles.inspector} thinScrollBar={true}>
            {sector ? (
              <SectorDetails sector={sector} trackIndex={selectedSector! >> 8} model={model} onSelectFile={onSelectFile} />
            ) : (
              <EmptyState message={t("panels.diskExplorer.selectSector")} />
            )}
          </ScrollViewer>
        </div>
      )}
    </div>
  );
};

const SectorDetails = ({
  sector,
  trackIndex,
  model,
  onSelectFile
}: {
  sector: ExplorerSector;
  trackIndex: number;
  model: DiskExplorerModel;
  onSelectFile: (name: string) => void;
}) => {
  const t = useT();
  const track = model.tracks[trackIndex];
  const hex = (v: number) => `$${v.toString(16).toUpperCase().padStart(2, "0")}`;
  const flags = sectorFlags(sector);
  return (
    <div className={styles.preview}>
      <dl className={styles.facts}>
        <dt>{t("panels.diskExplorer.sector.position")}</dt>
        <dd>{t("panels.diskExplorer.sector.positionValue", { cylinder: track.cylinder, side: track.side, index: sector.sectorIndex })}</dd>
        <dt>C H R N</dt>
        <dd>{`${sector.c} ${sector.h} ${sector.r} ${sector.n}`}</dd>
        <dt>ST1 ST2</dt>
        <dd>{`${hex(sector.st1)} ${hex(sector.st2)}`}</dd>
        <dt>{t("panels.diskExplorer.col.size")}</dt>
        <dd>{sector.copies > 1 ? t("panels.diskExplorer.sector.copies", { size: sector.length, copies: sector.copies }) : sector.length}</dd>
        <dt>{t("panels.diskExplorer.sector.holds")}</dt>
        <dd>
          {sector.role.role === "file" ? (
            <button type="button" className={styles.linkButton} onClick={() => onSelectFile((sector.role as { file: string }).file)}>
              {sector.role.file}
            </button>
          ) : (
            roleText(sector.role, t)
          )}
        </dd>
        {flags.length > 0 && (
          <>
            <dt>{t("panels.diskExplorer.sector.flags")}</dt>
            <dd>{flags.map((f) => t(FLAG_KEYS[f])).join(", ")}</dd>
          </>
        )}
      </dl>
      <StaticMemoryView memory={sector.data} />
    </div>
  );
};

// -------------------------------------------------------------------------------------------------
// Texts

type T = ReturnType<typeof useT>;

const ROLE_KEYS: Record<DiskSectorRole["role"], MessageKey> = {
  system: "panels.diskExplorer.role.system",
  directory: "panels.diskExplorer.role.directory",
  file: "panels.diskExplorer.role.file",
  free: "panels.diskExplorer.role.free",
  unused: "panels.diskExplorer.role.unused"
};

const KIND_KEYS: Record<DiskFileEntry["kind"], MessageKey> = {
  basic: "panels.diskExplorer.kind.basic",
  numberArray: "panels.diskExplorer.kind.numberArray",
  charArray: "panels.diskExplorer.kind.charArray",
  code: "panels.diskExplorer.kind.code",
  raw: "panels.diskExplorer.kind.raw"
};

const FLAG_KEYS: Record<ReturnType<typeof sectorFlags>[number], MessageKey> = {
  crc: "panels.diskExplorer.flag.crc",
  deleted: "panels.diskExplorer.flag.deleted",
  noData: "panels.diskExplorer.flag.noData",
  weak: "panels.diskExplorer.flag.weak"
};

function headerTitle (model: DiskExplorerModel, t: T): string {
  if (!model.info) return t("panels.diskExplorer.titleNoFs", { cylinders: model.cylinders, sides: model.sides });
  return model.info.label
    ? t("panels.diskExplorer.titleLabelled", { system: model.info.system, format: model.info.format, label: model.info.label })
    : t("panels.diskExplorer.title", { system: model.info.system, format: model.info.format });
}

function kindText (file: DiskFileEntry, t: T): string {
  const text = t(KIND_KEYS[file.kind]);
  return file.deleted ? t("panels.diskExplorer.deletedKind", { kind: text }) : text;
}

function roleText (role: DiskSectorRole, t: T): string {
  return role.role === "file" ? role.file : t(ROLE_KEYS[role.role]);
}

function sectorTitle (sector: ExplorerSector, t: T): string {
  return t("panels.diskExplorer.sector.chip", { r: sector.r, holds: roleText(sector.role, t) });
}

function attributesText (file: DiskFileEntry): string {
  return `${file.attributes.readOnly ? "R" : "-"}${file.attributes.system ? "S" : "-"}${file.attributes.archive ? "A" : "-"}`;
}

function formatSize (bytes: number): string {
  return bytes % 1024 === 0 ? `${bytes / 1024}K` : `${(bytes / 1024).toFixed(1)}K`;
}

function safeRead (bytes: Uint8Array, filePath: string, name: string): Uint8Array {
  try {
    return readDiskFile(bytes, filePath, name);
  } catch {
    return new Uint8Array(0);
  }
}

function sameFile (a: unknown, b: string): boolean {
  return typeof a === "string" && a.replace(/\\/g, "/") === b.replace(/\\/g, "/");
}
