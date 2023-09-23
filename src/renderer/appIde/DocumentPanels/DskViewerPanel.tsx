import { Label, LabelSeparator, Secondary } from "@controls/Labels";
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
import { FloppyDiskFormat } from "@emu/machines/disk/FloppyDisk";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { DataSection } from "@renderer/controls/DataSection";
import { StaticMemoryView } from "./StaticMemoryView";
import { LabeledGroup } from "@renderer/controls/LabeledGroup";
import { toHexa2 } from "../services/ide-commands";

const DskViewerPanel = ({ document, contents: data }: DocumentProps) => {
  const documentHubService = useDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion();
  const [docState, setDocState] = useState({});
  const contents = data as Uint8Array;
  let fileInfo: DskDiskReader | undefined;
  try {
    fileInfo = new DskDiskReader(contents);
  } catch {
    // --- Intentionally ignored
  }

  useEffect(() => {
    setDocState(documentHubService.getDocumentViewState(document.id));
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
          <HeaderLabel
            label='Sides:'
            value={fileInfo.header.numSides.toString()}
          />
          <ToolbarSeparator small={true} />
          <HeaderLabel
            label='Tracks:'
            value={fileInfo.header.numTracks.toString()}
          />
          <ToolbarSeparator small={true} />
          <LabelSeparator width={4} />
          <HeaderLabel
            label='Disk format:'
            value={
              fileInfo.diskFormat === FloppyDiskFormat.Cpc
                ? "CPC"
                : "Extended CPC"
            }
          />
        </div>
        <div className={styles.dskViewerWrapper}></div>
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
        {fileInfo.tracks.map((t, idx) => {
          const selectedSectorIdx = docState?.[`TS${idx}`] ?? 0;
          if (!t.sectors.length) {
            return (
              <DataSection
                key={`T${idx}`}
                title={`Empty track (Side #${t.sideNo}, Index: ${idx})`}
                expandable={false}
                expanded={false}
              ></DataSection>
            );
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

type SectorProps = {
  sector: Sector;
};

type HeaderLabelProps = {
  label: string;
  title?: string;
  value: string;
};

const HeaderLabel = ({ label, title, value }: HeaderLabelProps) => (
  <>
    <LabelSeparator width={6} />
    <Label text={label} tooltip={title} />
    <ValueLabel text={value} />
    <LabelSeparator width={4} />
  </>
);

const SectorPanel = ({ sector }: SectorProps) => {
  return (
    <>
      <div className={styles.sectorHeader}>
        <HeaderLabel
          label='C:'
          title='Cylinder (Track)'
          value={sector.trackNo.toString()}
        />
        <ToolbarSeparator small={true} />
        <HeaderLabel
          label='H:'
          title='Head (Side)'
          value={sector.sideNo.toString()}
        />
        <ToolbarSeparator small={true} />
        <HeaderLabel
          label='R:'
          title='Sector ID'
          value={sector.sectorId.toString()}
        />
        <ToolbarSeparator small={true} />
        <HeaderLabel
          label='N:'
          title='Sector size'
          value={sector.dataLen.toString()}
        />
        <ToolbarSeparator small={true} />
        <HeaderLabel
          label='SR1:'
          title='FDD SR1 value'
          value={`${toHexa2(sector.fdcStatus1)}`}
        />
        <ToolbarSeparator small={true} />
        <HeaderLabel
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
