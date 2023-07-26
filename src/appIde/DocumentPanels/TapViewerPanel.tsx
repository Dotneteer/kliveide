import { Label, LabelSeparator } from "@/controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import styles from "./TapViewerPanel.module.scss";
import { readTapeFile } from "@/utils/tape-utils";
import { ToolbarSeparator } from "@/controls/ToolbarSeparator";
import classnames from "@/utils/classnames";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { TzxBlockBase } from "@/emu/machines/tape/TzxBlockBase";
import { ReactNode, useState } from "react";
import { Icon } from "@/controls/Icon";

const TapViewerPanel = ({ document, data }: DocumentProps) => {
  const contents = data?.value as Uint8Array;
  const fileInfo = readTapeFile(contents);
  if (!fileInfo.data) {
    return (
      <div className={styles.tapViewerPanel}>
        <div className={classnames(styles.header, styles.error)}>
          Invalid tape file format
        </div>
      </div>
    );
  }
  return (
    <div className={styles.tapViewerPanel}>
      <div className={styles.header}>
        <LabelSeparator width={4} />
        <Label text='Format:' />
        <ValueLabel text={fileInfo.type?.toUpperCase()} />
        <LabelSeparator width={4} />
        <ToolbarSeparator small={true} />
        <LabelSeparator width={4} />
        <Label text='Length:' />
        <ValueLabel text={contents.length.toString()} />
        <LabelSeparator width={4} />
        <ToolbarSeparator small={true} />
        <LabelSeparator width={4} />
        <Label text='#of sections:' />
        <ValueLabel text={fileInfo.data.length.toString()} />
        <LabelSeparator width={4} />
        <ToolbarSeparator small={true} />
      </div>
      <div className={styles.tapViewerWrapper}>
        {fileInfo.data.map((ds, idx) => {
          return (
            <DataSection key={`${document.id}${idx}`} title={`Section #${idx}`}>
              {fileInfo.type.toLowerCase() === "tap" && (
                <TapSection key={idx} block={ds as TapeDataBlock} index={idx} />
              )}
              {fileInfo.type.toLowerCase() === "tzx" && (
                <TzxSection key={idx} block={ds as TzxBlockBase} index={idx} />
              )}
            </DataSection>
          );
        })}
      </div>
    </div>
  );
};

type DataSectionProps = {
  title: string;
  children?: ReactNode;
};

const DataSection = ({ title, children }: DataSectionProps) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <div
      className={classnames(
        styles.dataSectionPanel,
        expanded ? styles.expanded : styles.collapsed
      )}
    >
      <div
        className={styles.sectionHeader}
        onClick={() => {
          setExpanded(!expanded);
        }}
      >
        <Icon
          iconName='chevron-right'
          width={16}
          height={16}
          fill='--color-chevron'
          rotate={expanded ? 90 : 0}
        />
        <span className={styles.headerText}>{title}</span>
      </div>
      {expanded && children}
    </div>
  );
};

type TapSectionProps = {
  block: TapeDataBlock;
  index: number;
};

const TapSection = ({ block, index }: TapSectionProps) => {
  return <p>TAP Section #{index}</p>;
};

type TzxSectionProps = {
  block: TzxBlockBase;
  index: number;
};

const TzxSection = ({ block, index }: TzxSectionProps) => {
  return <p>TZX Section #{index}</p>;
};

type LabelProps = {
  text: string;
};

const ValueLabel = ({ text }: LabelProps) => {
  return <div className={styles.valueLabel}>{text}</div>;
};

export const createTapViewerPanel = ({ document, data }: DocumentProps) => (
  <TapViewerPanel document={document} data={data} />
);
