import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import classnames from "classnames";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { HardDiskView } from "@common/diskfs/hardDisk";
import type { DiskEdit } from "@common/diskfs/edit";
import type { DiskFileEntry } from "@common/diskfs/types";
import type { MessageKey } from "@common/i18n/keys.generated";
import { useT } from "@common/i18n/useT";
import { SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import { EmptyState, PanelHeader, PanelHeaderActions } from "@renderer/controls/data";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import Dropdown from "@renderer/controls/Dropdown";
import { Icon } from "@renderer/controls/Icon";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useDocumentHubService, useDocumentHubServiceVersion } from "@renderer/appIde/services/DocumentServiceProvider";
import { RenameDialog, type RenameDialogResult } from "@renderer/appIde/dialogs/RenameDialog";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { carriesFiles, droppedFilePaths } from "@renderer/features/explorer/projectFileDrag";
import { StaticMemoryView } from "../StaticMemoryView";
import { createScrPixelData } from "../Next/ScrFileViewerPanel";
import { failureText } from "./diskErrorText";
import { failureOf, type DiskActionFailure } from "./diskExplorerActions";
import styles from "./DiskExplorerPanel.module.scss";

/*
 * The Disk Explorer for hard-disk images - `.img`, `.hdf`, `.cim` SD cards
 * (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C2). The image can be gigabytes, so nothing of it is
 * loaded here: the main process reads the folder shown, the file previewed and the volume's map, and
 * makes the edits (on the machine's own SD card, under its lock).
 */

type HardDiskViewState = {
  view?: "files" | "layout";
  dir?: string;
  partition?: number;
  selected?: string;
  showDeleted?: boolean;
};

/** Files previewed whole up to this size; bigger ones show only their facts */
const PREVIEW_LIMIT = 256 * 1024;

export const createHardDiskExplorerPanel = ({ document }: DocumentProps) => (
  <HardDiskExplorer key={document.id} document={document} />
);

const HardDiskExplorer = ({ document }: Pick<DocumentProps, "document">) => {
  const t = useT();
  const mainApi = useMainApi();
  const dialogs = useDialogs();
  const hub = useDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion();
  const filePath = document.node?.fullPath ?? document.path ?? document.id;
  const [vs, setVs] = useState<HardDiskViewState>(() => hub.getDocumentViewState(document.id) ?? {});
  const [data, setData] = useState<HardDiskView | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();
  const [failure, setFailure] = useState<DiskActionFailure | undefined>();
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [preview, setPreview] = useState<Uint8Array | undefined>();
  const [highlight, setHighlight] = useState<number[]>([]);

  const change = (update: (state: HardDiskViewState) => void) => {
    setVs((previous) => {
      const next = { ...previous };
      update(next);
      hub.setDocumentViewState(document.id, next);
      return next;
    });
  };

  const refresh = useCallback(async () => {
    try {
      const view = await mainApi.queryHardDisk(filePath, { partition: vs.partition, dir: vs.dir, deleted: vs.showDeleted });
      setData(view);
      setLoadError(undefined);
    } catch (err) {
      // --- A folder that is gone (deleted elsewhere): back to the root
      if (vs.dir) change((s) => (s.dir = ""));
      else setLoadError(String((err as Error)?.message ?? err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainApi, filePath, vs.partition, vs.dir, vs.showDeleted]);

  useEffect(() => {
    void refresh();
  }, [refresh, hubVersion]);

  const selected = data?.files.find((f) => f.name === vs.selected);
  // --- A file to preview: its name and size (a folder or a deleted entry has none)
  const previewName = selected && !selected.isDirectory && !selected.deleted ? selected.name : undefined;
  const previewSize = selected?.size ?? 0;
  useEffect(() => {
    setPreview(undefined);
    setHighlight([]);
    if (!previewName) return undefined;
    let live = true;
    if (previewSize <= PREVIEW_LIMIT) {
      void mainApi.readHardDiskFile(filePath, previewName, vs.partition).then((bytes) => live && setPreview(bytes)).catch(() => {});
    }
    void mainApi.hardDiskFileClusters(filePath, previewName, vs.partition).then((c) => live && setHighlight(c)).catch(() => {});
    return () => {
      live = false;
    };
  }, [mainApi, filePath, previewName, previewSize, vs.partition, hubVersion]);

  /** One edit at a time; the view reads the disk again after it */
  const act = (action: () => Promise<unknown>) => async () => {
    if (busy) return;
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
    } catch (err) {
      setFailure(failureOf(err));
    } finally {
      setBusy(false);
      await refresh();
    }
  };
  const edit = (e: DiskEdit) => mainApi.editHardDisk(filePath, e, vs.partition);
  const inDir = (name: string) => (vs.dir ? `${vs.dir}/${name}` : name);

  const addFiles = async (paths?: string[]) => {
    const picked = paths ?? [await mainApi.showOpenFileDialog(undefined, "diskExplorer.addFolder")].filter((p) => !!p);
    for (const host of picked) {
      const name = host.replace(/^.*[\\/]/, "");
      const bytes = await mainApi.readBinaryFile(host).catch(() => undefined);
      if (bytes === undefined) {
        // --- Not a file: a folder, copied with what it holds
        await mainApi.copyFolderToHardDisk(filePath, host, inDir(name), vs.partition);
        continue;
      }
      const existing = data?.files.some((f) => f.name.toUpperCase() === inDir(name).toUpperCase());
      await edit({ kind: "add", files: [{ name: inDir(name), kind: "raw", data: bytes }], replace: existing });
    }
  };

  const askName = async (oldName: string) =>
    (
      await dialogs.open<RenameDialogResult, Omit<ComponentProps<typeof RenameDialog>, "controls">>(
        RenameDialog,
        { oldPath: oldName },
        { title: t("panels.diskExplorer.renameTitle"), width: 420, iconName: "pencil" }
      )
    )?.name;

  if (loadError) return <EmptyState tone="error" motif={false} message={loadError} />;
  if (!data) return null;

  const view = vs.view ?? "files";
  const editable = !busy && !!data.info;
  const leafName = (f: DiskFileEntry) => f.name.slice(f.name.lastIndexOf("/") + 1);

  return (
    <div
      className={classnames(styles.explorer, styles.wholeDocument, { [styles.dropTarget]: dropping })}
      onDragOver={(e) => {
        if (!editable || !carriesFiles(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        const paths = droppedFilePaths(e.dataTransfer);
        if (!editable || paths.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        void act(() => addFiles(paths))();
      }}
    >
      <PanelHeader
        title={
          data.info
            ? data.info.label
              ? t("panels.diskExplorer.titleLabelled", { system: data.info.system, format: kindLabel(data.kind), label: data.info.label })
              : t("panels.diskExplorer.title", { system: data.info.system, format: kindLabel(data.kind) })
            : t("panels.diskExplorer.hardDiskNoFs", { size: formatSize(data.sizeBytes) })
        }
      >
        {data.info && (
          <span className={styles.facts}>
            {t("panels.diskExplorer.space", {
              free: formatSize(data.info.freeBytes),
              total: formatSize(data.info.totalBytes),
              files: data.files.filter((f) => !f.deleted).length
            })}
          </span>
        )}
        {data.partitions.length > 1 && (
          <Dropdown
            ariaLabel={t("panels.diskExplorer.partition")}
            options={data.partitions.map((p) => ({
              value: String(p.index),
              label: t("panels.diskExplorer.partitionItem", { index: p.index + 1, size: formatSize(p.sectorCount * 512) })
            }))}
            initialValue={String(data.partition ?? 0)}
            onChanged={(v) => change((s) => ((s.partition = Number(v)), (s.dir = ""), (s.selected = undefined)))}
          />
        )}
        <PanelHeaderActions>
          <SmallIconButton iconName="files" title={t("panels.diskExplorer.viewFiles")} selected={view === "files"} clicked={() => change((s) => (s.view = "files"))} />
          <SmallIconButton iconName="spr-grid" title={t("panels.diskExplorer.viewLayout")} selected={view === "layout"} clicked={() => change((s) => (s.view = "layout"))} />
          <ToolbarSeparator small={true} />
          <SmallIconButton iconName="arrow-up" title={t("panels.diskExplorer.folderUp")} enable={!!vs.dir} clicked={() => change((s) => ((s.dir = (s.dir ?? "").split("/").slice(0, -1).join("/")), (s.selected = undefined)))} />
          <SmallIconButton
            iconName="folder"
            title={t("panels.diskExplorer.newFolder")}
            enable={editable}
            clicked={act(async () => {
              const name = await askName(t("panels.diskExplorer.newFolderName"));
              if (name) await edit({ kind: "mkdir", path: inDir(name) });
            })}
          />
          <SmallIconButton iconName="plus" title={t("panels.diskExplorer.add")} enable={editable} clicked={act(() => addFiles())} />
          <SmallIconButton
            iconName="save"
            title={t("panels.diskExplorer.extract")}
            enable={!!selected && !selected.isDirectory && !selected.deleted}
            clicked={act(async () => {
              const target = await mainApi.showSaveFileDialog({ title: t("panels.diskExplorer.extractTitle"), defaultPath: leafName(selected!), settingsId: "diskExplorer.extractFolder" });
              if (target) await mainApi.saveBinaryFile(target, await mainApi.readHardDiskFile(filePath, selected!.name, vs.partition));
            })}
          />
          <SmallIconButton
            iconName="pencil"
            title={t("panels.diskExplorer.rename")}
            enable={editable && !!selected && !selected.deleted}
            clicked={act(async () => {
              const name = await askName(leafName(selected!));
              if (name && name !== leafName(selected!)) await edit({ kind: "rename", name: selected!.name, newName: name });
            })}
          />
          <SmallIconButton
            iconName="trash"
            title={t("panels.diskExplorer.delete")}
            enable={editable && !!selected && !selected.deleted}
            clicked={act(async () => {
              const ok = await mainApi.confirmAction(
                t("panels.diskExplorer.confirm.deleteTitle"),
                t("panels.diskExplorer.confirm.delete", { count: 1, name: leafName(selected!) }),
                undefined,
                t("panels.diskExplorer.confirm.deleteButton")
              );
              if (ok) await edit({ kind: "delete", names: [selected!.name] });
            })}
          />
          <SmallIconButton
            iconName={vs.showDeleted ? "eye" : "eye-off"}
            title={t("panels.diskExplorer.showDeleted")}
            selected={!!vs.showDeleted}
            clicked={() => change((s) => (s.showDeleted = !s.showDeleted))}
          />
          <SmallIconButton iconName="refresh" title={t("panels.diskExplorer.reload")} clicked={act(() => refresh())} />
        </PanelHeaderActions>
      </PanelHeader>
      {failure && (
        <div className={styles.banner} role="alert">
          {failureText(failure, t)}
        </div>
      )}
      {data.fsError ? (
        <EmptyState tone="error" motif={false} message={failureText(data.fsError, t)} />
      ) : view === "files" ? (
        <div className={styles.body}>
          <ScrollViewer className={styles.listPane} thinScrollBar={true}>
            {vs.dir && <div className={styles.path}>{`/${vs.dir}`}</div>}
            <div className={classnames(styles.table, styles.fat)} role="grid">
              <div className={styles.headerRow} role="row">
                <span role="columnheader">{t("panels.diskExplorer.col.name")}</span>
                <span role="columnheader" className={styles.number}>{t("panels.diskExplorer.col.size")}</span>
                <span role="columnheader">{t("panels.diskExplorer.col.attributes")}</span>
              </div>
              {data.files.map((f) => (
                <div
                  key={`${f.name}:${f.deleted}`}
                  role="row"
                  aria-selected={f.name === vs.selected}
                  className={classnames(styles.row, { [styles.rowSelected]: f.name === vs.selected, [styles.deleted]: f.deleted })}
                  onClick={() => change((s) => (s.selected = f.name))}
                  onDoubleClick={() => f.isDirectory && !f.deleted && change((s) => ((s.dir = f.name), (s.selected = undefined)))}
                >
                  <span className={styles.name}>
                    {f.isDirectory && <Icon iconName="folder" width={14} height={14} />} {leafName(f)}
                  </span>
                  <span className={styles.number}>{f.isDirectory ? "" : f.size}</span>
                  <span>{`${f.attributes.readOnly ? "R" : "-"}${f.attributes.system ? "S" : "-"}${f.hidden ? "H" : "-"}${f.attributes.archive ? "A" : "-"}`}</span>
                </div>
              ))}
            </div>
            {data.files.length === 0 && <EmptyState message={t("panels.diskExplorer.noFiles")} />}
          </ScrollViewer>
          <ScrollViewer className={styles.inspector} thinScrollBar={true}>
            {selected ? (
              <div className={styles.preview}>
                <dl className={styles.facts}>
                  <dt>{t("panels.diskExplorer.col.name")}</dt>
                  <dd>{leafName(selected)}</dd>
                  {!selected.isDirectory && (
                    <>
                      <dt>{t("panels.diskExplorer.col.size")}</dt>
                      <dd>{t("panels.diskExplorer.sizeOnDisk", { size: selected.size, allocated: selected.allocated })}</dd>
                    </>
                  )}
                </dl>
                {preview && (
                  <div className={styles.previewActions}>
                    <SmallIconButton
                      iconName="binary"
                      title={t("panels.diskExplorer.openMemory")}
                      clicked={() => void openStaticMemoryDump(hub, `hardDisk:${filePath}:${selected.name}`, `${leafName(selected)} (${filePath.replace(/^.*[\\/]/, "")})`, preview, { disassemblyEnabled: true, viewMode: "memory" })}
                    />
                  </div>
                )}
                {preview && preview.length === 6912 && /\.scr$/i.test(selected.name) && (
                  <ScreenCanvas data={preview} palette={SPECTRUM_48_COLORS} zoomFactor={1} screenWidth={256} screenHeight={192} createPixelData={createScrPixelData} />
                )}
                {preview && preview.length > 0 && <StaticMemoryView memory={preview} />}
                {!selected.isDirectory && !selected.deleted && selected.size > PREVIEW_LIMIT && (
                  <div className={styles.facts}>{t("panels.diskExplorer.tooBigToPreview")}</div>
                )}
              </div>
            ) : (
              <EmptyState message={t("panels.diskExplorer.selectFile")} />
            )}
          </ScrollViewer>
        </div>
      ) : (
        <VolumeMap data={data} highlight={highlight} fileName={selected ? leafName(selected) : undefined} />
      )}
    </div>
  );
};

/** The volume's areas as a proportional bar, then its clusters in use, bucketed */
const VolumeMap = ({ data, highlight, fileName }: { data: HardDiskView; highlight: number[]; fileName?: string }) => {
  const t = useT();
  const regions = data.regions!;
  const total = regions.data[0] + regions.data[1];
  const use = data.clusterUse ?? [];
  const clusterCount = data.info ? Math.round(data.info.totalBytes / data.info.blockSize) : 0;
  const marked = useMemo(() => {
    const set = new Set<number>();
    const per = Math.max(1, Math.ceil(clusterCount / Math.max(1, use.length)));
    highlight.forEach((c) => set.add(Math.floor((c - 2) / per)));
    return set;
  }, [highlight, clusterCount, use.length]);
  const parts: [keyof typeof regions, MessageKey][] = [
    ["reserved", "panels.diskExplorer.region.reserved"],
    ["fats", "panels.diskExplorer.region.fats"],
    ["root", "panels.diskExplorer.region.root"],
    ["data", "panels.diskExplorer.region.data"]
  ];
  return (
    <ScrollViewer className={styles.listPane} thinScrollBar={true}>
      <div className={styles.volume}>
        <div className={styles.regionBar} role="img" aria-label={t("panels.diskExplorer.regionsLabel")}>
          {parts
            .filter(([key]) => regions[key][1] > 0)
            .map(([key, label]) => (
              <span
                key={key}
                className={classnames(styles.region, styles[`region-${key}`])}
                style={{ flexGrow: Math.max(regions[key][1] / total, 0.02) }}
                title={t("panels.diskExplorer.regionTitle", { name: t(label), first: regions[key][0], count: regions[key][1] })}
              >
                {t(label)}
              </span>
            ))}
        </div>
        <div className={styles.legend}>
          {t("panels.diskExplorer.clusterMap", { count: clusterCount, buckets: use.length })}
          {fileName && <span className={styles.legendItem}>{t("panels.diskExplorer.clusterMapFile", { name: fileName, count: highlight.length })}</span>}
        </div>
        <div className={styles.clusterMap}>
          {use.map((u, i) => (
            <span
              key={i}
              className={classnames(styles.chip, u === 0 ? styles["role-free"] : styles["role-file"], { [styles.chipHighlighted]: marked.has(i) })}
              style={u > 0 ? { opacity: 0.35 + 0.65 * u } : undefined}
              title={t("panels.diskExplorer.clusterBucket", { percent: Math.round(u * 100) })}
            />
          ))}
        </div>
      </div>
    </ScrollViewer>
  );
};

function kindLabel (kind: HardDiskView["kind"]): string {
  return kind === "cim" ? "CIM" : kind === "hdf" ? "HDF" : "IMG";
}

function formatSize (bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}G`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)}M`;
  return `${Math.round(bytes / 1024)}K`;
}
