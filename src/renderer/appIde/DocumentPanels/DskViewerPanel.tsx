import { Flag } from "@renderer/controls/layout/Flag";
import { EmptyState } from "@renderer/controls/data";
import { Label } from "@renderer/controls/layout/Label";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import styles from "./DskViewerPanel.module.scss";
import { ValueLabel } from "./helpers/ValueLabel";
import { useEffect, useMemo, useState } from "react";
import {
  useDocumentHubService,
  useDocumentHubServiceVersion
} from "@renderer/appIde/services/DocumentServiceProvider";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { DataSection } from "@renderer/controls/DataSection";
import { StaticMemoryView } from "./StaticMemoryView";
import { LabeledGroup } from "@renderer/controls/LabeledGroup";
import { toHexa2 } from "../services/ide-commands";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { SectorInformation } from "@emu/machines/disk/DiskInformation";
import { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";
import { DiskDensity } from "@emu/abstractions/DiskDensity";
import { createDiskSurface } from "@emu/machines/disk/DiskSurface";
import ScrollViewer from "@renderer/controls/ScrollViewer";

const DskViewerPanel = ({ document, contents: data }: DocumentProps) => {
  const documentHubService = useDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion();
  const [docState, setDocState] = useState({});
  /*
   * `false`, plainly.
   *
   * This was `useState((docState as any)?.showPhysical ?? false)` — reading state declared on the
   * line above, which is `{}` at that instant, so the initializer could only ever evaluate to
   * `false`. The effect below is what actually restores the persisted value; the initializer was
   * decoration that read like logic.
   */
  const [showPhysical, setShowPhysical] = useState(false);

  const contents = data as Uint8Array;
  /*
   * Parsed once per file, not once per render — and the failure is kept.
   *
   * `readDiskData` and `createDiskSurface` ran in the render body inside a
   * `catch { /* Intentionally ignored *\/ }`, so the entire disk surface was re-materialised on
   * every render and any parse error was discarded. The user then got "Invalid disk file format"
   * with no indication of what was wrong with their file.
   */
  const parsed = useMemo(() => {
    try {
      const fileInfo = readDiskData(contents);
      return { fileInfo, floppyInfo: createDiskSurface(fileInfo), error: undefined as string | undefined };
    } catch (err) {
      return { fileInfo: undefined, floppyInfo: undefined, error: (err as Error)?.message };
    }
  }, [contents]);
  const { fileInfo, floppyInfo } = parsed;

  /*
   * Two facts the Generic Disk Info section used to hardcode.
   *
   * `useMemo` keyed on the surface, not on nothing: both walk every track, and this panel
   * re-renders on each `DataSection` expand.
   */
  const totalSurfaceBytes = useMemo(
    () => floppyInfo?.tracks.reduce((sum, track) => sum + track.trackLength, 0) ?? 0,
    [floppyInfo]
  );
  const hasWeakSectors = useMemo(
    () => !!floppyInfo?.tracks.some((track) => track.weakSectorData.length > 0),
    [floppyInfo]
  );

  useEffect(() => {
    const state = documentHubService.getDocumentViewState(document.id);
    setDocState(state);
    setShowPhysical((state as any)?.showPhysical ?? false);
  }, [hubVersion]);

  if (!fileInfo) {
    return (
      <EmptyState
        tone="error"
        motif={false}
        message={parsed.error ?? "This file could not be read as a .dsk disk image."}
      />
    );
  }
  return (
    <ScrollViewer allowHorizontal={false}>
      <div className={styles.dskViewerPanel}>
        <div className={styles.header}>
          <LabeledValue label='Sides:' value={fileInfo.numSides} />
          <ToolbarSeparator small={true} />
          <LabeledValue label='Tracks:' value={fileInfo.numTracks} />
          <ToolbarSeparator small={true} />
          <LabeledValue
            label='Disk format:'
            value={
              fileInfo.diskFormat === FloppyDiskFormat.Cpc
                ? "CPC"
                : "Extended CPC"
            }
          />
          <ToolbarSeparator small={true} />
          <LabeledSwitch
            value={showPhysical}
            label='Show surface view'
            title='Floppy physical surface view'
            clicked={v => {
              setShowPhysical(v);
              documentHubService.setDocumentViewState(document.id, {
                ...docState,
                ["showPhysical"]: v
              });
              documentHubService.signHubStateChanged();
            }}
          />
        </div>
        {showPhysical && (
          <>
            <DataSection
              key='GDI'
              title='Generic Disk Info'
              expanded={docState?.["GDI"] ?? true}
              changed={exp => {
                documentHubService.setDocumentViewState(document.id, {
                  ...docState,
                  ["GDI"]: exp
                });
                documentHubService.signHubStateChanged();
              }}
            >
              <div className={styles.dataSection}>
                <div className={styles.header}>
                  <LabeledValue
                    label='Density:'
                    value={DiskDensity[floppyInfo.density]}
                  />
                  <ToolbarSeparator small={true} />
                  {/*
                    * "Write protected" was hardwired to `true` and is gone: nothing in
                    * `DiskSurface` or `DiskInformation` carries it, so the row stated a fact the
                    * app does not know. A field that is always the same value is not a field.
                    */}
                  <LabeledFlag
                    label='Has weak sectors'
                    // --- Was hardwired to `false`. The surface does know: a track with weak-sector
                    // --- data has a non-empty span for it.
                    value={hasWeakSectors}
                  />
                </div>
                <div className={styles.header}>
                  <LabeledValue
                    label='Total:'
                    title='Total physical size in bytes'
                    // --- Was hardwired to `0`, i.e. a label with no value behind it.
                    value={totalSurfaceBytes}
                  />
                  <ToolbarSeparator small={true} />
                  <LabeledValue
                    label='B/T:'
                    title='Bytes per track'
                    value={floppyInfo.bytesPerTrack}
                  />
                  <ToolbarSeparator small={true} />
                  <LabeledValue
                    label='TLen:'
                    title='Track length in bytes'
                    // --- Was a second copy of `bytesPerTrack`, so `B/T` and `TLen` were two
                    // --- differently-labelled columns showing the same number. A track's own
                    // --- length is what `TLen` names.
                    value={floppyInfo.tracks[0]?.trackLength ?? 0}
                  />
                </div>
              </div>
            </DataSection>
            {floppyInfo.tracks.map((ti, idx) => {
              const stateId = `TI${idx}`;
              const selectedSectorIdx = docState?.[`TIS${idx}`] ?? 1;
              return (
                <DataSection
                  key={stateId}
                  title={`Track #${idx}`}
                  expanded={docState?.[stateId] ?? false}
                  changed={exp => {
                    documentHubService.setDocumentViewState(document.id, {
                      ...docState,
                      [stateId]: exp
                    });
                    documentHubService.signHubStateChanged();
                  }}
                >
                  <div className={styles.dataSection}>
                    <div className={styles.blockHeader}>
                      <Secondary
                        text={`Track header (GAP0 + Sync + Index + GAP1, ${ti.header.length} bytes)`}
                      />
                    </div>
                    <StaticMemoryView key={stateId} memory={ti.header.view()} />
                  </div>

                  <div className={styles.sectorSection}>
                    <LabeledGroup
                      label='Sectors:'
                      title=''
                      values={ti.sectors.map((_, sIdx) => sIdx + 1)}
                      marked={-1}
                      selected={selectedSectorIdx}
                      clicked={v => {
                        documentHubService.setDocumentViewState(document.id, {
                          ...docState,
                          [`TIS${idx}`]: v
                        });
                        documentHubService.signHubStateChanged();
                      }}
                    />
                  </div>

                  {/*
                    * A track with no sectors used to throw here — twice, on two consecutive lines,
                    * with no guard on either. The logical view further down has always had one
                    * (`if (!t.sectors.length) return null`); the physical view did not, so a disk
                    * image with an empty track took the renderer down rather than showing an empty
                    * track. Guarded once, around the block that needs the sector.
                    */}
                  {ti.sectors[selectedSectorIdx - 1] ? (
                    <div className={styles.dataSection}>
                      <div className={styles.blockHeader}>
                        <Secondary
                          text={`Sector #${selectedSectorIdx} (Header + GAP2 + Sync + DM + Data + CRC + GAP3, ${
                            ti.sectors[selectedSectorIdx - 1].sectordata.length
                          } bytes) `}
                        />
                      </div>
                      <StaticMemoryView
                        key={stateId}
                        initialShowAll={true}
                        memory={ti.sectors[selectedSectorIdx - 1].sectordata.view()}
                      />
                    </div>
                  ) : (
                    <div className={styles.dataSection}>
                      <div className={styles.blockHeader}>
                        <Secondary text='This track holds no sectors.' />
                      </div>
                    </div>
                  )}
                </DataSection>
              );
            })}
          </>
        )}
        {!showPhysical &&
          fileInfo.tracks.map((t, idx) => {
            const selectedSectorIdx = docState?.[`TS${idx}`] ?? 1;
            if (!t.sectors.length) {
              return null;
            } else {
              return (
                <DataSection
                  key={`T${idx}`}
                  title={`Track #${t.trackNumber} | Side #${t.sideNumber} | ${
                    t.sectors.length
                  } sector${t.sectors.length > 1 ? "s" : ""} | GAP3: ${toHexa2(
                    t.gap3
                  )} | Filler: ${toHexa2(t.filler)}`}
                  expanded={docState?.[`T${idx}`] ?? false}
                  changed={exp => {
                    documentHubService.setDocumentViewState(document.id, {
                      ...docState,
                      [`T${idx}`]: exp
                    });
                    documentHubService.signHubStateChanged();
                  }}
                >
                  <div className={styles.sectorSection}>
                    <LabeledGroup
                      label='Sectors:'
                      title=''
                      values={t.sectors.map((_, sIdx) => sIdx + 1)}
                      marked={-1}
                      selected={selectedSectorIdx}
                      clicked={v => {
                        documentHubService.setDocumentViewState(document.id, {
                          ...docState,
                          [`TS${idx}`]: v
                        });
                        documentHubService.signHubStateChanged();
                      }}
                    />
                  </div>
                  <SectorPanel sector={t.sectors[selectedSectorIdx - 1]} />
                </DataSection>
              );
            }
          })}
      </div>
    </ScrollViewer>
  );
};


type LabeledValueProps = {
  label: string;
  title?: string;
  value: number | string;
};

const LabeledValue = ({ label, title, value }: LabeledValueProps) => (
  <>
    <LabelSeparator width={6} />
    <Label text={label} tooltip={title} />
    <ValueLabel text={value.toString()} />
    <LabelSeparator />
  </>
);

type LabeledFlagProps = {
  label: string;
  title?: string;
  value: boolean;
};

const LabeledFlag = ({ label, title, value }: LabeledFlagProps) => (
  <>
    <LabelSeparator width={6} />
    <Label text={label} tooltip={title} />
    <LabelSeparator width={8} />
    <Flag value={value} />
    <LabelSeparator />
  </>
);

type SectorProps = {
  sector: SectorInformation;
};

const SectorPanel = ({ sector }: SectorProps) => {
  return (
    <>
      <div className={styles.sectorHeader}>
        <LabeledValue label='C:' title='Cylinder (Track)' value={sector.C} />
        <ToolbarSeparator small={true} />
        <LabeledValue label='H:' title='Head (Side)' value={sector.H} />
        <ToolbarSeparator small={true} />
        <LabeledValue label='R:' title='Sector ID' value={sector.R} />
        <ToolbarSeparator small={true} />
        <LabeledValue
          label='N:'
          title='Sector size'
          value={sector.actualLength}
        />
        <ToolbarSeparator small={true} />
        <LabeledValue
          label='SR1:'
          title='FDD SR1 value'
          value={`${toHexa2(sector.SR1)}`}
        />
        <ToolbarSeparator small={true} />
        <LabeledValue
          label='SR2:'
          title='FDD SR2 value'
          value={`${toHexa2(sector.SR2)}`}
        />
      </div>
      <div className={styles.dataSection}>
        <StaticMemoryView memory={sector.sectorData} />
      </div>
    </>
  );
};

export const createDskViewerPanel = ({
  document,
  viewState,
  contents
}: DocumentProps) => (
  <DskViewerPanel
    key={document.id}
    document={document}
    viewState={viewState}
    contents={contents}
    apiLoaded={() => {}}
  />
);
