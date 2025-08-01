import { Label, LabelSeparator, Secondary } from "@controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import styles from "./TapViewerPanel.module.scss";
import { readTapeFile } from "@renderer/utils/tape-utils";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import classnames from "classnames";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { TzxBlockBase } from "@emu/machines/tape/TzxBlockBase";
import { ReactNode, useEffect, useState } from "react";
import { StaticMemoryView } from "./StaticMemoryView";
import { TzxStandardSpeedBlock } from "@emu/machines/tape/TzxStandardSpeedBlock";
import { TzxTextDescriptionBlock } from "@emu/machines/tape/TzxTextDescriptionBlock";
import {
  useDocumentHubService,
  useDocumentHubServiceVersion
} from "../services/DocumentServiceProvider";
import { DataSection } from "@renderer/controls/DataSection";
import { toHexa2 } from "../services/ide-commands";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { TzxGroupStartBlock } from "@emu/machines/tape/TzxGroupStartBlock";
import { TzxSilenceBlock } from "@emu/machines/tape/TzxSilenceBlock";
import { TzxPureToneBlock } from "@emu/machines/tape/TzxPureToneBlock";
import { TzxTurboSpeedBlock } from "@emu/machines/tape/TzxTurboSpeedBlock";

const TapViewerPanel = ({ document, contents: data }: DocumentProps) => {
  const documentHubService = useDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion();
  const [docState, setDocState] = useState({});
  const contents = data as Uint8Array;
  const fileInfo = readTapeFile(contents);

  useEffect(() => {
    setDocState(documentHubService.getDocumentViewState(document.id));
  }, [hubVersion]);

  if (!fileInfo.data) {
    return (
      <div className={styles.tapViewerPanel}>
        <div className={classnames(styles.header, styles.error)}>Invalid tape file format</div>
      </div>
    );
  }
  return (
    <ScrollViewer allowHorizontal={false}>
      <div className={styles.tapViewerPanel}>
        <div className={styles.header}>
          <LabelSeparator width={4} />
          <Label text="Format:" />
          <ValueLabel text={fileInfo.type?.toUpperCase()} />
          <LabelSeparator width={4} />
          <ToolbarSeparator small={true} />
          <LabelSeparator width={4} />
          <Label text="Length:" />
          <ValueLabel text={contents.length.toString()} />
          <LabelSeparator width={4} />
          <ToolbarSeparator small={true} />
          <LabelSeparator width={4} />
          <Label text="#of sections:" />
          <ValueLabel text={fileInfo.data.length.toString()} />
          <LabelSeparator width={4} />
          <ToolbarSeparator small={true} />
        </div>
        <div className={styles.tapViewerWrapper}>
          {fileInfo.data.map((ds, idx) => {
            let title: string;
            if (fileInfo.type.toLowerCase() === "tap") {
              const data = (ds as TapeDataBlock).data;
              if (isHeaderBlock(data)) {
                title = "Header block";
              } else if (isDataBlock(data)) {
                title = `Data block (length: ${data.length})`;
              } else {
                title = `Unknown block`;
              }
              title = `#${idx}: ${title}`;
            } else {
              title = `#${idx}: ${
                tzxSections[(ds as TzxBlockBase).blockId] ??
                `(unknown section 0x${toHexa2((ds as TzxBlockBase).blockId)})`
              }`;
            }
            return (
              <DataSection
                key={`${document.id}${idx}`}
                title={title}
                expanded={docState?.[idx] ?? true}
                changed={(exp) => {
                  documentHubService.setDocumentViewState(document.id, {
                    ...docState,
                    [idx]: exp
                  });
                  documentHubService.signHubStateChanged();
                }}
              >
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
    </ScrollViewer>
  );
};

type TapSectionProps = {
  block: TapeDataBlock;
  index: number;
};

const TapSection = ({ block }: TapSectionProps) => {
  const data = block.data;
  return (
    <div className={styles.dataSection}>
      {isHeaderBlock(data) && <HeaderBlock data={data} />}
      <StaticMemoryView memory={data} />
    </div>
  );
};

type TzxSectionProps = {
  block: TzxBlockBase;
  index: number;
};

const TzxSection = ({ block }: TzxSectionProps) => {
  let section: ReactNode;
  switch (block.blockId) {
    case 0x10:
      section = <TzxStandarSpeedBlockUi block={block as TzxStandardSpeedBlock} />;
      break;

    case 0x11:
      section = <TzxTurboSpeedBlockUi block={block as TzxTurboSpeedBlock} />;
      break;

    case 0x12:
      section = <TzxPureToneBlockUi block={block as TzxPureToneBlock} />;
      break;

    case 0x20:
      section = <TzxSilenceBlockUi block={block as TzxSilenceBlock} />;
      break;

    case 0x21:
      section = <TzxGroupStartBlockUi block={block as TzxGroupStartBlock} />;
      break;

    case 0x22:
      section = <TzxGroupEndBlockUi />;
      break;

    case 0x30:
      section = <TzxTextDescriptionBlockUi block={block as TzxTextDescriptionBlock} />;
      break;

    default:
      section = <TzxNotImplementedBlockUi block={block} />;
      break;
  }
  return <div className={styles.dataSection}>{section}</div>;
};

type LabelProps = {
  text: string;
};

const ValueLabel = ({ text }: LabelProps) => {
  return <div className={styles.valueLabel}>{text}</div>;
};

type BlockProps = {
  data: Uint8Array;
};

const HeaderBlock = ({ data }: BlockProps) => {
  let blockType = "unknown";
  let par1Name = "Start Address";
  let par2Name = "Parameter 2";
  switch (data[1]) {
    case 0:
      blockType = "Program";
      par1Name = "Autostart";
      par2Name = "Variable offset";
      break;
    case 1:
      blockType = "Number array";
      break;
    case 2:
      blockType = "Character array";
      break;
    case 3:
      blockType = "Code";
      par1Name = "Start address";
      break;
  }
  let name = "";
  for (let i = 1; i <= 10; i++) {
    name += String.fromCharCode(data[i]);
  }
  const length = data[12] + (data[13] << 8);
  const par1Value = data[14] + (data[15] << 8);
  const par2Value = data[16] + (data[17] << 8);

  return (
    <div className={styles.blockHeader}>
      <Secondary text={`'${name}' - ${blockType.toUpperCase()} (${length} bytes) `} />
      <Secondary text={`${par1Name}: ${par1Value}, ${par2Name}: ${par2Value}`} />
    </div>
  );
};

type TzxStandarSpeedBlockProps = {
  block: TzxStandardSpeedBlock;
};

const TzxStandarSpeedBlockUi = ({ block }: TzxStandarSpeedBlockProps) => {
  const data = block.data;
  return (
    <div className={styles.dataSection}>
      {isHeaderBlock(data) && <HeaderBlock data={data} />}
      <div className={styles.blockHeader}>
        <Secondary text={`Pause after: ${block.pauseAfter}`} />
      </div>
      <StaticMemoryView memory={data} />
    </div>
  );
};

type TzxTurboSpeedBlockProps = {
  block: TzxTurboSpeedBlock;
};

const TzxTurboSpeedBlockUi = ({ block }: TzxTurboSpeedBlockProps) => {
  const data = new Uint8Array(block.data);
  return (
    <div className={styles.dataSection}>
      {isHeaderBlock(data) && <HeaderBlock data={data} />}
      <div className={styles.blockHeader}>
        <Secondary
          text={`PILOT: ${block.pilotPulseLength} | PILOT Count: ${block.pilotToneLength}`}
        />
        <Secondary
          text={`SYNC1: ${block.sync1PulseLength} | SYNC2: ${block.sync2PulseLength}`}
        />
        <Secondary
          text={`BIT0: ${block.zeroBitPulseLength} | BIT1: ${block.oneBitPulseLength}`}
        />
        <Secondary text={`Pause after: ${block.pauseAfter}`} />
      </div>
      <StaticMemoryView memory={data} />
    </div>
  );
};

type TzxTextDescriptionBlockProps = {
  block: TzxTextDescriptionBlock;
};

const TzxTextDescriptionBlockUi = ({ block }: TzxTextDescriptionBlockProps) => {
  return (
    <div className={styles.dataSection}>
      <div className={styles.blockHeader}>
        <Secondary text={block.descriptionText} />
      </div>
      <StaticMemoryView memory={block.description} />
    </div>
  );
};

type TzxGroupStartBlockProps = {
  block: TzxGroupStartBlock;
};

const TzxGroupStartBlockUi = ({ block }: TzxGroupStartBlockProps) => {
  return (
    <div className={styles.dataSection}>
      <div className={styles.blockHeader}>
        <Secondary text={block.groupName} />
      </div>
    </div>
  );
};

const TzxGroupEndBlockUi = () => {
  return (
    <div className={styles.dataSection}>
      <div className={styles.blockHeader}>
        <Secondary text="(End of the previous block)" />
      </div>
    </div>
  );
};

type TzxSilenceBlockProps = {
  block: TzxSilenceBlock;
};

const TzxSilenceBlockUi = ({ block }: TzxSilenceBlockProps) => {
  return (
    <div className={styles.dataSection}>
      <div className={styles.blockHeader}>
        <Secondary text={`Duration: ${block.duration}ms`} />
      </div>
    </div>
  );
};

type TzxPureToneBlockProps = {
  block: TzxPureToneBlock;
};

const TzxPureToneBlockUi = ({ block }: TzxPureToneBlockProps) => {
  return (
    <div className={styles.dataSection}>
      <div className={styles.blockHeader}>
        <Secondary text={`Pulse count: ${block.pulseCount}`} />
        <Secondary text={`Pulse length: ${block.pulseLength} T-states`} />
      </div>
    </div>
  );
};

type TzxNotImplementedBlockProps = {
  block: TzxBlockBase;
};

const TzxNotImplementedBlockUi = ({}: TzxNotImplementedBlockProps) => {
  return (
    <div className={styles.dataSection}>
      <div className={styles.blockHeader}>
        <Secondary text="(block display not implemented yet)" />
      </div>
    </div>
  );
};

function isHeaderBlock(data: Uint8Array): boolean {
  return data.length === 19 && data[0] === 0x00;
}

function isDataBlock(data: Uint8Array): boolean {
  return data.length > 0 && data[0] === 0xff;
}

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

export const createTapViewerPanel = ({ document, contents }: DocumentProps) => (
  <TapViewerPanel key={document.id} document={document} contents={contents} apiLoaded={() => {}} />
);
