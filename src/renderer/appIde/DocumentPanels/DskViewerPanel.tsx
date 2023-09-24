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
import { DskDiskReader, Sector } from "@emu/machines/disk/DskDiskReader";
import {
  DiskDensity,
  DiskError,
  FloppyDisk,
  FloppyDiskFormat
} from "@emu/machines/disk/FloppyDisk";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { DataSection } from "@renderer/controls/DataSection";
import { StaticMemoryView } from "./StaticMemoryView";
import { LabeledGroup } from "@renderer/controls/LabeledGroup";
import { toHexa2 } from "../services/ide-commands";
import { useUncommittedState } from "@renderer/core/useUncommittedState";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";

const DskViewerPanel = ({ document, contents: data }: DocumentProps) => {
  const documentHubService = useDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion();
  const [docState, setDocState] = useState({});
  const [showPhysical, refPhysical, setShowPhysical] = useUncommittedState(
    (docState as any)?.showPhysical ?? false
  );

  const contents = data as Uint8Array;
  let fileInfo: DskDiskReader | undefined;
  let floppyInfo: FloppyDisk | undefined;
  try {
    fileInfo = new DskDiskReader(contents);
    floppyInfo = new FloppyDisk(contents);
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
          <LabeledSwitch
            value={showPhysical}
            setterFn={setShowPhysical}
            label='Surface view'
            title='Floppy physical surface view'
            clicked={() => {
              documentHubService.setDocumentViewState(document.id, {
                ...docState,
                ["showPhysical"]: refPhysical.current
              });
              documentHubService.signHubStateChanged();
            }}
          />
          <ToolbarSeparator small={true} />
          <LabeledValue label='Sides:' value={fileInfo.header.numSides} />
          <ToolbarSeparator small={true} />
          <LabeledValue label='Tracks:' value={fileInfo.header.numTracks} />
          <ToolbarSeparator small={true} />
          <LabeledValue
            label='Disk format:'
            value={
              fileInfo.diskFormat === FloppyDiskFormat.Cpc
                ? "CPC"
                : "Extended CPC"
            }
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
                    label='Status:'
                    value={DiskError[floppyInfo.status]}
                  />
                  <ToolbarSeparator small={true} />
                  <LabeledFlag
                    label='Write protected'
                    value={floppyInfo.isWriteProtected ?? false}
                  />
                  <ToolbarSeparator small={true} />
                  <LabeledValue
                    label='Density:'
                    value={DiskDensity[floppyInfo.density]}
                  />
                </div>
                <div className={styles.header}>
                  <LabeledValue
                    label='Total:'
                    title='Total physical size in bytes'
                    value={floppyInfo.data?.length}
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
                    value={floppyInfo.tlen}
                  />
                </div>
              </div>
            </DataSection>
            {floppyInfo.trackInfo.map((ti, idx) => {
              const stateId = `TI${idx}`;
              const startIndex = idx * floppyInfo.tlen;
              const tdataStart = startIndex + ti.headerLen;
              const selectedSectorIdx = docState?.[`TIS${idx}`] ?? 1;
              const sectorOffset =
                tdataStart +
                (selectedSectorIdx - 1) *
                  ti.sectorLengths[selectedSectorIdx - 1];
              const clockData = tdataStart + floppyInfo.bytesPerTrack;
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
                        text={`Track header (GAP0 + Sync + Index + GAP1, ${ti.headerLen} bytes)`}
                      />
                    </div>
                    <StaticMemoryView
                      key={stateId}
                      memory={floppyInfo.data.slice(
                        startIndex,
                        startIndex + ti.headerLen
                      )}
                    />
                  </div>

                  <div className={styles.sectorSection}>
                    <LabeledGroup
                      label='Sectors:'
                      title=''
                      values={ti.sectorLengths.map((_, sIdx) => sIdx + 1)}
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
                          ti.sectorLengths[selectedSectorIdx - 1]
                        } bytes) `}
                      />
                    </div>
                    <StaticMemoryView
                      key={stateId}
                      initialShowAll={true}
                      memory={floppyInfo.data.slice(
                        sectorOffset,
                        sectorOffset + ti.sectorLengths[selectedSectorIdx - 1]
                      )}
                    />
                  </div>

                  <div className={styles.dataSection}>
                    <div className={styles.blockHeader}>
                      <Secondary text={`Clock data (${ti.gap4Len} bytes)`} />
                    </div>
                    <StaticMemoryView
                      key={stateId}
                      memory={floppyInfo.data.slice(
                        clockData,
                        clockData + 1000
                      )}
                    />
                  </div>
                </DataSection>
              );
            })}
          </>
        )}
        {!showPhysical && (
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
                <Secondary text={`Creator: ${fileInfo.header.creator}`} />
              </div>
              <StaticMemoryView memory={fileInfo.contents.slice(0, 0x100)} />
            </div>
          </DataSection>
        )}
        {!showPhysical &&
          fileInfo.tracks.map((t, idx) => {
            const selectedSectorIdx = docState?.[`TS${idx}`] ?? 0;
            if (!t.sectors.length) {
              return null;
            } else {
              return (
                <DataSection
                  key={`T${idx}`}
                  title={`Track #${t.trackNo} | Side #${t.sideNo} | ${
                    t.sectors.length
                  } sector${t.sectors.length > 1 ? "s" : ""} | GAP3: ${toHexa2(
                    t.gap3Length
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
                          [`TS${idx}`]: v - 1
                        });
                        documentHubService.signHubStateChanged();
                      }}
                    />
                  </div>
                  <SectorPanel sector={t.sectors[selectedSectorIdx]} />
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
  sector: Sector;
};

const SectorPanel = ({ sector }: SectorProps) => {
  return (
    <>
      <div className={styles.sectorHeader}>
        <LabeledValue
          label='C:'
          title='Cylinder (Track)'
          value={sector.trackNo}
        />
        <ToolbarSeparator small={true} />
        <LabeledValue label='H:' title='Head (Side)' value={sector.sideNo} />
        <ToolbarSeparator small={true} />
        <LabeledValue label='R:' title='Sector ID' value={sector.sectorId} />
        <ToolbarSeparator small={true} />
        <LabeledValue label='N:' title='Sector size' value={sector.dataLen} />
        <ToolbarSeparator small={true} />
        <LabeledValue
          label='SR1:'
          title='FDD SR1 value'
          value={`${toHexa2(sector.fdcStatus1)}`}
        />
        <ToolbarSeparator small={true} />
        <LabeledValue
          label='SR2:'
          title='FDD SR2 value'
          value={`${toHexa2(sector.fdcStatus2)}`}
        />
      </div>
      <div className={styles.dataSection}>
        <StaticMemoryView memory={sector.actualData} />
      </div>
    </>
  );
};

export const createDskViewerPanel = ({ document, contents }: DocumentProps) => (
  <DskViewerPanel
    key={document.id}
    document={document}
    contents={contents}
    apiLoaded={() => {}}
  />
);
