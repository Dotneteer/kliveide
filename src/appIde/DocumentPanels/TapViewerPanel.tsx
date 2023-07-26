import { Label, LabelSeparator } from "@/controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import styles from "./TapViewerPanel.module.scss";
import { readTapeFile } from "@/utils/tape-utils";
import { ToolbarSeparator } from "@/controls/ToolbarSeparator";
import classnames from "@/utils/classnames";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { TzxBlockBase } from "@/emu/machines/tape/TzxBlockBase";
import { ReactNode, useEffect, useState } from "react";
import { Icon } from "@/controls/Icon";
import { useAppServices } from "../services/AppServicesProvider";
import { useDispatch, useSelector } from "@/core/RendererProvider";
import { changeDocumentAction } from "@common/state/actions";
import { StaticMemoryView } from "./StaticMemoryView";
import { ScrollViewer } from "@/controls/ScrollViewer";

const TapViewerPanel = ({ document, data }: DocumentProps) => {
  const dispatch = useDispatch();
  const { documentService } = useAppServices();
  const openDocs = useSelector(s => s.ideView?.openDocuments);
  const docIndex = useSelector(s => s.ideView?.activeDocumentIndex);
  const [docState, setDocState] = useState({});
  const contents = data?.value as Uint8Array;
  const fileInfo = readTapeFile(contents);

  useEffect(() => {
    setDocState(documentService.getDocumentState(document.id));
  }, [openDocs]);

  useEffect(() => {
  }, [docState]);

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
    <ScrollViewer allowHorizontal={false}>
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
            const title =
              fileInfo.type.toLowerCase() === "tap"
                ? `#${idx}: Data section (${(ds as TapeDataBlock).data.length})`
                : `#${idx}: ${
                    tzxSections[(ds as TzxBlockBase).blockId] ??
                    "(unknown section)"
                  }`;
            return (
              <DataSection
                key={`${document.id}${idx}`}
                title={title}
                expanded={docState?.[idx] ?? true}
                changed={exp => {
                  const newState = { ...docState, [idx]: exp };
                  dispatch(
                    changeDocumentAction(
                      { ...document, stateValue: newState },
                      docIndex
                    )
                  );
                }}
              >
                {fileInfo.type.toLowerCase() === "tap" && (
                  <TapSection
                    key={idx}
                    block={ds as TapeDataBlock}
                    index={idx}
                  />
                )}
                {fileInfo.type.toLowerCase() === "tzx" && (
                  <TzxSection
                    key={idx}
                    block={ds as TzxBlockBase}
                    index={idx}
                  />
                )}
              </DataSection>
            );
          })}
        </div>
      </div>
    </ScrollViewer>
  );
};

type DataSectionProps = {
  title: string;
  expanded: boolean;
  children?: ReactNode;
  changed?: (expanded: boolean) => void;
};

const DataSection = ({
  title,
  expanded,
  children,
  changed
}: DataSectionProps) => {
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
          changed?.(!expanded);
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
  return (
    <div className={styles.dataSection}>
      <StaticMemoryView memory={block.data} />
    </div>
  );
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
  <TapViewerPanel key={document.id} document={document} data={data} />
);

const tzxSections = {
  [0x10]: "Standard speed data block",
  [0x11]: "Turbo speed data block",
  [0x12]: "Pure tone",
  [0x13]: "Sequence pulses",
  [0x14]: "Pure data block",
  [0x15]: "Direct recording block",
  [0x18]: "CSW recording block",
  [0x19]: "Generalized data block",
  [0x20]: "Pause/Stop the tape command",
  [0x21]: "Group start",
  [0x22]: "Group end",
  [0x23]: "Jump to block",
  [0x24]: "Loop start",
  [0x25]: "Loop end",
  [0x26]: "Call sequence",
  [0x27]: "Return from sequence",
  [0x28]: "Select block",
  [0x2a]: "Stop the tape if in 48K mode",
  [0x2b]: "Set signal level",
  [0x30]: "Text description",
  [0x31]: "Message block",
  [0x32]: "Archive info",
  [0x33]: "Hardware type",
  [0x35]: "Custom info block",
  [0x4a]: "'Glue' block"
};
