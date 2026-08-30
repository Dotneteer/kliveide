import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { toHexa2, toHexa4 } from "../../services/ide-commands";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { MemoryDumpViewer } from "@renderer/controls/memory/MemoryDumpViewer";
import { Layer2Screen } from "@renderer/controls/Next/Layer2Screen";
import { getAbrgForPaletteCode } from "@emu/machines/zxNext/palette";
import { GenericFileViewerPanel } from "../helpers/GenericFileViewerPanel";
import { Row } from "@renderer/controls/layout/Row";
import { LabeledText } from "@renderer/controls/layout/LabeledText";
import { LabeledFlag } from "@renderer/controls/layout/LabeledFlag";
import { ExpandableRow } from "@renderer/controls/layout/ExpandableRow";
import { createElement } from "react";
import styles from "./NexFileViewerPanel.module.scss";
import { loadNexFileContents, ScreenBlockFlags } from "./nexFileLoader";
import type { NexFileContents, NexHeader } from "./nexFileLoader";

const HEADER_LABEL_WIDTH = 160;
const HEADER_VALUE_WIDTH = 132;
const HEADER_WIDE_VALUE_WIDTH = 188;
const HEADER_FLAG_LABEL_WIDTH = 156;
const HEADER_FLAG_NARROW_LABEL_WIDTH = 92;
const HEADER_FLAG_VALUE_WIDTH = 22;
const NEX_SLOT_1_BANK = 5;
const NEX_SLOT_2_BANK = 2;
const NEX_SLOT_1_START = 0x4000;
const NEX_SLOT_2_START = 0x8000;
const NEX_SLOT_3_START = 0xc000;

type NexFileViewState = {
  headerAttrExpanded?: boolean;
  bankFlagsExpanded?: boolean;
  paletteExpanded?: boolean;
  layer2LoadingScreenExpanded?: boolean;
  ulaLoadingScreenExpanded?: boolean;
  loResLoadingScreenExpanded?: boolean;
  timexHiResLoadingScreenExpanded?: boolean;
  timexHiColLoadingScreenExpanded?: boolean;
  bankExpanded?: Record<number, boolean>;
  scrollPosition?: number;
};

const NexFileViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps<NexFileViewState>) => {
  return createElement(
    GenericFileViewerPanel<NexFileContents, NexFileViewState>,
    {
      document,
      contents,
      viewState,
      fileLoader: loadNexFileContents,
      validRenderer: context => {
        const fi = context.fileInfo;
        const cvs = viewState;
        const change = context.changeViewState;
        const h = context.fileInfo.header;
        return (
          <>
            <ExpandableRow
              heading='Header attributes'
              initialExpanded={cvs?.headerAttrExpanded ?? true}
              onExpanded={exp => change(vs => (vs.headerAttrExpanded = exp))}
            >
              <HeaderAttributes header={h} />
            </ExpandableRow>
            <ExpandableRow
              heading='Bank flags'
              initialExpanded={cvs?.bankFlagsExpanded ?? false}
              onExpanded={exp => change(vs => (vs.bankFlagsExpanded = exp))}
            >
              <BankFlags startIndex={0} flags={h.bankFlags.slice(0, 8)} />
              <BankFlags startIndex={8} flags={h.bankFlags.slice(8, 16)} />
              <BankFlags startIndex={16} flags={h.bankFlags.slice(16, 24)} />
              <BankFlags startIndex={24} flags={h.bankFlags.slice(24, 32)} />
              <BankFlags startIndex={32} flags={h.bankFlags.slice(32, 40)} />
              <BankFlags startIndex={40} flags={h.bankFlags.slice(40, 48)} />
              <BankFlags startIndex={48} flags={h.bankFlags.slice(48, 56)} />
              <BankFlags startIndex={56} flags={h.bankFlags.slice(56, 64)} />
              <BankFlags startIndex={64} flags={h.bankFlags.slice(64, 72)} />
              <BankFlags startIndex={72} flags={h.bankFlags.slice(72, 80)} />
              <BankFlags startIndex={80} flags={h.bankFlags.slice(80, 88)} />
              <BankFlags startIndex={88} flags={h.bankFlags.slice(88, 96)} />
              <BankFlags startIndex={96} flags={h.bankFlags.slice(96, 104)} />
              <BankFlags startIndex={104} flags={h.bankFlags.slice(104, 112)} />
            </ExpandableRow>
            {fi.palette?.length > 0 && (
              <ExpandableRow
                heading='Palette (Layer2, LoRes or Tilemap screen)'
                initialExpanded={cvs?.paletteExpanded ?? false}
                onExpanded={exp =>
                  context.changeViewState(vs => (vs.paletteExpanded = exp))
                }
              >
                <NextPaletteViewer
                  palette={context.fileInfo?.palette}
                  allowSelection={true}
                />
              </ExpandableRow>
            )}
            {fi.layer2LoadingScreen?.length > 0 && (
              <ExpandableRow
                heading='Layer 2 Loading Screen'
                initialExpanded={cvs?.layer2LoadingScreenExpanded ?? false}
                onExpanded={exp =>
                  change(vs => (vs.layer2LoadingScreenExpanded = exp))
                }
              >
                <Layer2Screen
                  documentSource={document.node.projectPath}
                  data={fi?.layer2LoadingScreen}
                  palette={fi.palette.map(v => getAbrgForPaletteCode(v))}
                />
              </ExpandableRow>
            )}
            {fi.ulaLoadingScreen?.length > 0 && (
              <ExpandableRow
                heading='ULA Loading Screen'
                initialExpanded={cvs?.ulaLoadingScreenExpanded ?? false}
                onExpanded={exp =>
                  change(vs => (vs.ulaLoadingScreenExpanded = exp))
                }
              >
                <MemoryDumpViewer
                  documentSource={document.node.projectPath}
                  contents={fi?.ulaLoadingScreen}
                  iconTitle='Display ULA dump'
                  idFactory={(documentSource: string) =>
                    `ulaDump${documentSource}`
                  }
                  titleFactory={(documentSource: string) =>
                    `${documentSource} - ULA`
                  }
                />
              </ExpandableRow>
            )}
            {fi.loResLoadingScreen?.length > 0 && (
              <ExpandableRow
                heading='LoRes Loading Screen'
                initialExpanded={cvs?.loResLoadingScreenExpanded ?? false}
                onExpanded={exp =>
                  change(vs => (vs.loResLoadingScreenExpanded = exp))
                }
              >
                <MemoryDumpViewer
                  documentSource={document.node.projectPath}
                  contents={fi?.loResLoadingScreen}
                  iconTitle='Display LoRes dump'
                  idFactory={(documentSource: string) =>
                    `loResDump${documentSource}`
                  }
                  titleFactory={(documentSource: string) =>
                    `${documentSource} - LoRes`
                  }
                />
              </ExpandableRow>
            )}
            {fi.timexHiResLoadingScreen?.length > 0 && (
              <ExpandableRow
                heading='Timex HiRes Loading Screen'
                initialExpanded={cvs?.timexHiResLoadingScreenExpanded ?? false}
                onExpanded={exp =>
                  change(vs => (vs.timexHiResLoadingScreenExpanded = exp))
                }
              >
                <MemoryDumpViewer
                  documentSource={document.node.projectPath}
                  contents={fi?.timexHiResLoadingScreen}
                  iconTitle='Display Timex HiRes dump'
                  idFactory={(documentSource: string) =>
                    `timexHiResDump${documentSource}`
                  }
                  titleFactory={(documentSource: string) =>
                    `${documentSource} - Timex HiRes`
                  }
                />
              </ExpandableRow>
            )}
            {fi.timexHiColLoadingScreen?.length > 0 && (
              <ExpandableRow
                heading='Timex HiCol Loading Screen'
                initialExpanded={cvs?.timexHiColLoadingScreenExpanded ?? false}
                onExpanded={exp =>
                  change(vs => (vs.timexHiColLoadingScreenExpanded = exp))
                }
              >
                <MemoryDumpViewer
                  documentSource={document.node.projectPath}
                  contents={fi?.timexHiColLoadingScreen}
                  iconTitle='Display Timex HiCol dump'
                  idFactory={(documentSource: string) =>
                    `timexHiColDump${documentSource}`
                  }
                  titleFactory={(documentSource: string) =>
                    `${documentSource} - Timex Hicol`
                  }
                />
              </ExpandableRow>
            )}
            {fi.bankData.map((entry, idx) => {
              return (
                <ExpandableRow
                  key={idx}
                  heading={getBankHeading(entry[0], h)}
                  initialExpanded={cvs?.bankExpanded?.[idx] ?? false}
                  onExpanded={exp =>
                    change(vs => {
                      vs.bankExpanded ??= {};
                      vs.bankExpanded![idx] = exp;
                    })
                  }
                >
                  <MemoryDumpViewer
                    documentSource={document.node.projectPath}
                    contents={entry[1]}
                    bank={entry[0]}
                    allowDisassembly={true}
                    disassOffset={getDefaultDisassemblyOffsetForBank(entry[0], h)}
                    iconTitle='Display bank data dump'
                    idFactory={(documentSource: string, bank: number) =>
                      `bankDump${documentSource}:${bank}`
                    }
                    titleFactory={(documentSource: string, bank: number) =>
                      `${documentSource} - Bank: ${bank}`
                    }
                  />
                </ExpandableRow>
              );
            })}
          </>
        );
      }
    }
  );
};

type BankFlagsProps = {
  startIndex: number;
  flags: boolean[];
};

const BankFlags = ({ flags, startIndex }: BankFlagsProps) => {
  return (
    <Row>
      {flags.map((f, idx) => (
        <LabeledFlag
          key={idx}
          label={`#${toHexa2(idx + startIndex)}:`}
          labelWidth={36}
          valueWidth={20}
          value={f}
        />
      ))}
    </Row>
  );
};

function getBankHeading (bank: number, header: NexHeader): string {
  const marks: string[] = [];

  if (getProgramCounterBank(header) === bank) {
    marks.push(`PC: $${toHexa4(header.programCounter)}`);
  }
  if (getStackPointerBank(header) === bank) {
    marks.push(`SP: $${toHexa4(header.stackPointer)}`);
  }

  const markSuffix = marks.length ? ` | ${marks.join(" | ")}` : "";
  return `Bank $${toHexa2(bank)} (${bank.toString(10)})${markSuffix}`;
}

function getProgramCounterBank (header: NexHeader): number | undefined {
  return header.programCounter === 0
    ? undefined
    : getMappedBankForAddress(header, header.programCounter);
}

function getStackPointerBank (header: NexHeader): number | undefined {
  return getMappedBankForAddress(header, header.stackPointer);
}

function getMappedBankForAddress (
  header: NexHeader,
  address: number
): number | undefined {
  const normalizedAddress = address & 0xffff;
  if (normalizedAddress < NEX_SLOT_1_START) {
    return undefined;
  }
  if (normalizedAddress < NEX_SLOT_2_START) {
    return NEX_SLOT_1_BANK;
  }
  if (normalizedAddress < NEX_SLOT_3_START) {
    return NEX_SLOT_2_BANK;
  }
  return header.entryBank;
}

function getDefaultDisassemblyOffsetForBank (
  bank: number,
  header: NexHeader
): number {
  if (bank === header.entryBank) {
    return NEX_SLOT_3_START;
  }
  if (bank === NEX_SLOT_1_BANK) {
    return NEX_SLOT_1_START;
  }
  if (bank === NEX_SLOT_2_BANK) {
    return NEX_SLOT_2_START;
  }
  return 0x0000;
}

type HeaderAttributesProps = {
  header: NexHeader;
};

type HeaderAttributeGroupProps = {
  title: string;
  children: React.ReactNode;
};

const HeaderAttributeGroup = ({
  title,
  children
}: HeaderAttributeGroupProps) => (
  <section className={styles.headerAttributeGroup}>
    <div className={styles.headerAttributeGroupTitle}>{title}</div>
    {children}
  </section>
);

type HeaderTextProps = {
  label: string;
  value: string;
  tooltip?: string;
  valueWidth?: number;
};

const HeaderText = ({
  label,
  value,
  tooltip,
  valueWidth = HEADER_VALUE_WIDTH
}: HeaderTextProps) => (
  <Row xclass={styles.headerAttributeRow}>
    <LabeledText
      label={label}
      labelWidth={HEADER_LABEL_WIDTH}
      value={value}
      valueWidth={valueWidth}
      tooltip={tooltip}
    />
  </Row>
);

type HeaderFlagProps = {
  label: string;
  value: boolean;
};

const HeaderFlag = ({ label, value }: HeaderFlagProps) => (
  <Row xclass={styles.headerAttributeRow}>
    <LabeledFlag
      label={label}
      labelWidth={HEADER_FLAG_LABEL_WIDTH}
      value={value}
      valueWidth={HEADER_FLAG_VALUE_WIDTH}
      center={false}
    />
  </Row>
);

const HeaderAttributes = ({ header: h }: HeaderAttributesProps) => (
  <div className={styles.headerAttributes}>
    <HeaderAttributeGroup title='File'>
      <HeaderText
        label='Version:'
        value={`V${h.versionMajor}.${h.versionMinor}`}
        tooltip='.NEX file version'
      />
      <HeaderText
        label='Required RAM:'
        value={h.fullRamRequired ? "1792K" : "768K"}
      />
      <HeaderText
        label='16K banks to load:'
        value={h.numOf16KBanks.toString(10)}
      />
      <HeaderText label='Extra files:' value={h.numOfExtraBytes.toString(10)} />
      <HeaderText
        label='Required core:'
        value={`V${h.requiredCoreVersionMajor}.${h.requiredCoreVersionMinor}.${h.requiredCoreVersionSubMinor}`}
      />
    </HeaderAttributeGroup>

    <HeaderAttributeGroup title='Entry'>
      <HeaderText
        label='PC:'
        value={`$${toHexa4(h.programCounter)} (${h.programCounter.toString(10)})`}
        valueWidth={HEADER_WIDE_VALUE_WIDTH}
      />
      <HeaderText
        label='SP:'
        value={`$${toHexa4(h.stackPointer)} (${h.stackPointer.toString(10)})`}
        valueWidth={HEADER_WIDE_VALUE_WIDTH}
      />
      <HeaderText
        label='Entry bank:'
        value={`$${toHexa2(h.entryBank)} (${h.entryBank.toString(10)})`}
      />
      <HeaderText
        label='File handle addr:'
        value={`$${toHexa4(h.fileHandleAddress)} (${h.fileHandleAddress.toString(10)})`}
        valueWidth={HEADER_WIDE_VALUE_WIDTH}
      />
      <HeaderFlag label='Preserve Next regs:' value={!!h.preserveNextRegisters} />
    </HeaderAttributeGroup>

    <HeaderAttributeGroup title='Loading'>
      <HeaderText label='Border color:' value={h.borderColor.toString(10)} />
      <HeaderFlag label='Layer2 loading bar:' value={!!h.layer2LoadingBar} />
      <HeaderText
        label='Bar color:'
        value={`$${toHexa2(h.loadingBarColorFor)} (${h.loadingBarColorFor.toString(10)})`}
      />
      <HeaderText
        label='Delay per bank:'
        value={h.loadingDelayPerBank.toString(10)}
      />
      <HeaderText label='Start delay:' value={h.startDelay.toString(10)} />
      <HeaderText
        label='Timex HiRes color:'
        value={`$${toHexa2(h.timexHiresModeColor)} (${h.timexHiresModeColor.toString(10)})`}
      />
    </HeaderAttributeGroup>

    <HeaderAttributeGroup title='Loading Screen Blocks'>
      <Row xclass={`${styles.headerAttributeRow} ${styles.headerFlagRow}`}>
        <LabeledFlag
          label='Layer2:'
          labelWidth={HEADER_FLAG_NARROW_LABEL_WIDTH}
          valueWidth={HEADER_FLAG_VALUE_WIDTH}
          value={!!(h.screenBlockFlags & ScreenBlockFlags.Layer2)}
          center={true}
        />
        <LabeledFlag
          label='ULA:'
          labelWidth={HEADER_FLAG_NARROW_LABEL_WIDTH}
          valueWidth={HEADER_FLAG_VALUE_WIDTH}
          value={!!(h.screenBlockFlags & ScreenBlockFlags.Ula)}
          center={true}
        />
      </Row>
      <Row xclass={`${styles.headerAttributeRow} ${styles.headerFlagRow}`}>
        <LabeledFlag
          label='LoRes:'
          labelWidth={HEADER_FLAG_NARROW_LABEL_WIDTH}
          valueWidth={HEADER_FLAG_VALUE_WIDTH}
          value={!!(h.screenBlockFlags & ScreenBlockFlags.LoRes)}
          center={true}
        />
        <LabeledFlag
          label='HiRes:'
          labelWidth={HEADER_FLAG_NARROW_LABEL_WIDTH}
          valueWidth={HEADER_FLAG_VALUE_WIDTH}
          value={!!(h.screenBlockFlags & ScreenBlockFlags.HiRes)}
          center={true}
        />
      </Row>
      <Row xclass={`${styles.headerAttributeRow} ${styles.headerFlagRow}`}>
        <LabeledFlag
          label='HiColor:'
          labelWidth={HEADER_FLAG_NARROW_LABEL_WIDTH}
          valueWidth={HEADER_FLAG_VALUE_WIDTH}
          value={!!(h.screenBlockFlags & ScreenBlockFlags.HiColor)}
          center={true}
        />
        <LabeledFlag
          label='No palette:'
          labelWidth={HEADER_FLAG_NARROW_LABEL_WIDTH}
          valueWidth={HEADER_FLAG_VALUE_WIDTH}
          value={!!(h.screenBlockFlags & ScreenBlockFlags.NoPalette)}
          center={true}
        />
      </Row>
    </HeaderAttributeGroup>
  </div>
);

export const createNexFileViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => (
  <NexFileViewerPanel
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);
