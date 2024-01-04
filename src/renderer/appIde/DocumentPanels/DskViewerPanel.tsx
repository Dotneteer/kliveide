import { Flag, Label, LabelSeparator, Secondary } from "@controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import styles from "./DskViewerPanel.module.scss";
import classnames from "@renderer/utils/classnames";
import { useEffect, useState } from "react";
import { ScrollViewer } from "@controls/ScrollViewer";
import {
  useDocumentHubService,
  useDocumentHubServiceVersion
} from "../services/DocumentServiceProvider";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { DataSection } from "@renderer/controls/DataSection";
import { StaticMemoryView } from "./StaticMemoryView";
import { LabeledGroup } from "@renderer/controls/LabeledGroup";
import { toHexa2 } from "../services/ide-commands";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import {
  DiskInformation,
  SectorInformation
} from "@emu/machines/disk/DiskInformation";
import { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";
import { DiskDensity } from "@emu/abstractions/DiskDensity";
import { DiskSurface, createDiskSurface } from "@emu/machines/disk/DiskSurface";

const DskViewerPanel = ({ document, contents: data }: DocumentProps) => {
  const documentHubService = useDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion();
  const [docState, setDocState] = useState({});
  const [showPhysical, setShowPhysical] = useState(
    (docState as any)?.showPhysical ?? false
  );

  const contents = data as Uint8Array;
  let fileInfo: DiskInformation | undefined;
  let floppyInfo: DiskSurface | undefined;
  try {
    fileInfo = readDiskData(contents);
    floppyInfo = createDiskSurface(fileInfo);
  } catch (err) {
    // --- Intentionally ignored
    console.log(err);
  }

  useEffect(() => {
    const state = documentHubService.getDocumentViewState(document.id);
    setDocState(state);
    setShowPhysical((state as any)?.showPhysical ?? false);
  }, [hubVersion]);

  if (!fileInfo) {
    return (
      <div className={styles.dskViewerPanel}>
        <div className={classnames(styles.header, styles.error)}>
          Invalid disk file format
        </div>
      </div>
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
        <div className={styles.dskViewerWrapper}></div>
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
                  <LabeledFlag label='Write protected' value={true} />
                  <ToolbarSeparator small={true} />
                  <LabeledFlag label='Has weak sectors' value={false} />
                </div>
                <div className={styles.header}>
                  <LabeledValue
                    label='Total:'
                    title='Total physical size in bytes'
                    value={0}
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
                    value={floppyInfo.bytesPerTrack}
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
                      memory={ti.sectors[
                        selectedSectorIdx - 1
                      ].sectordata.view()}
                    />
                  </div>
                </DataSection>
              );
            })}
          </>
        )}
        {/* {!showPhysical && (
          <DataSection
            key='DIB'
            title='Disk Information Block'
            expanded={docState?.["DIB"] ?? true}
            changed={exp => {
              documentHubService.setDocumentViewState(document.id, {
                ...docState,
                ["DIB"]: exp
              });
              documentHubService.signHubStateChanged();
            }}
          >
            <div className={styles.dataSection}>
              <div className={styles.blockHeader}>
                <Secondary text={`Creator: ${fileInfo.creator}`} />
              </div>
              <StaticMemoryView memory={contents.slice(0, 0x100)} />
            </div>
          </DataSection>
        )} */}
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

type LabelProps = {
  text: string;
};

const ValueLabel = ({ text }: LabelProps) => {
  return <div className={styles.valueLabel}>{text}</div>;
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
    <LabelSeparator width={4} />
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
    <LabelSeparator width={4} />
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
