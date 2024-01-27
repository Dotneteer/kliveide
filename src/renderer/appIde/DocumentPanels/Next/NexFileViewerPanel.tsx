import { DocumentProps } from "../../DocumentArea/DocumentsContainer";
import { BinaryReader } from "@common/utils/BinaryReader";
import { toHexa2, toHexa4 } from "../../services/ide-commands";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { NextBankViewer } from "@renderer/controls/NextBankViewer";
import { Layer2Screen } from "@renderer/controls/Next/Layer2Screen";
import { getAbrgForPaletteCode } from "@emu/machines/zxNext/palette";
import { GenericFileViewerPanel } from "../helpers/GenericFileViewerPanel";
import { Row } from "@renderer/controls/generic/Row";
import { Label } from "@renderer/controls/generic/Label";
import { LabeledText } from "@renderer/controls/generic/LabeledText";
import { LabeledFlag } from "@renderer/controls/generic/LabeledFlag";
import { ExpandableRow } from "@renderer/controls/generic/ExpandableRow";

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
  return GenericFileViewerPanel<NexFileContents, NexFileViewState>({
    document,
    contents,
    viewState,
    fileLoader: loadNexFile,
    validRenderer: context => {
      const fi = context.fileInfo;
      const cvs = context.currentViewState;
      const change = context.changeViewState;
      const h = context.fileInfo?.header;
      return (
        <>
          <ExpandableRow
            heading='Header attributes'
            expanded={cvs?.headerAttrExpanded ?? true}
            onExpanded={exp => change(vs => (vs.headerAttrExpanded = exp))}
          >
            <Row>
              <LabeledText
                label='Version:'
                value={`V${h.versionMajor}.${h.versionMinor}`}
                tooltip='.NEX file version'
              />
              <LabeledText
                label='RAM Required:'
                value={h.fullRamRequired ? "1792K" : "768K"}
              />
              <LabeledText
                label='#of 16K Banks to Load:'
                value={h.numOf16KBanks.toString(10)}
              />
              <LabeledText
                label='Border Color:'
                value={h.borderColor.toString(10)}
              />
            </Row>
            <Row>
              <Label text='Loading screen flags:' />
              <LabeledFlag
                label='No Palette:'
                value={!!(h.screenBlockFlags & ScreenBlockFlags.NoPalette)}
              />
              <LabeledFlag
                label='HiColor:'
                value={!!(h.screenBlockFlags & ScreenBlockFlags.HiColor)}
              />
              <LabeledFlag
                label='HiRes:'
                value={!!(h.screenBlockFlags & ScreenBlockFlags.HiRes)}
              />
              <LabeledFlag
                label='LoRes:'
                value={!!(h.screenBlockFlags & ScreenBlockFlags.LoRes)}
              />
              <LabeledFlag
                label='ULA:'
                value={!!(h.screenBlockFlags & ScreenBlockFlags.Ula)}
              />
              <LabeledFlag
                label='Layer2:'
                value={!!(h.screenBlockFlags & ScreenBlockFlags.Layer2)}
              />
            </Row>
            <Row>
              <LabeledText
                label='SP:'
                value={`$${toHexa4(h.stackPointer)} (${h.stackPointer.toString(
                  10
                )})`}
              />
              <LabeledText
                label='PC:'
                value={`$${toHexa4(
                  h.programCounter
                )} (${h.programCounter.toString(10)})`}
              />
              <LabeledText
                label='#of Extra Files:'
                value={h.numOfExtraBytes.toString(10)}
              />
            </Row>
            <Row>
              <LabeledFlag
                label='Layer2 Loading Bar:'
                value={!!h.layer2LoadingBar}
              />
              <LabeledText
                label='Bar Color:'
                value={`$${toHexa2(
                  h.loadingBarColorFor
                )} (${h.loadingBarColorFor.toString(10)})`}
              />
              <LabeledText
                label='Loading Delay/Bank:'
                value={h.loadingDelayPerBank.toString(10)}
              />
              <LabeledText
                label='Start Delay:'
                value={h.startDelay.toString(10)}
              />
            </Row>
            <Row>
              <LabeledFlag
                label='Preserve Next Register Values:'
                value={!!h.preserveNextRegisters}
              />
              <LabeledText
                label='Required Core Version:'
                value={`V${h.requiredCoreVersionMajor}.${h.requiredCoreVersionMinor}.${h.requiredCoreVersionSubMinor}`}
              />
              <LabeledText
                label='Timex HiRes Color:'
                value={`$${toHexa2(
                  h.timexHiresModeColor
                )} (${h.timexHiresModeColor.toString(10)})`}
              />
            </Row>
            <Row>
              <LabeledText
                label='Entry Bank:'
                value={`$${toHexa2(h.entryBank)} (${h.entryBank.toString(10)})`}
              />
              <LabeledText
                label='File Handle Address:'
                value={`$${toHexa4(
                  h.fileHandleAddress
                )} (${h.fileHandleAddress.toString(10)})`}
              />
            </Row>
          </ExpandableRow>
          <ExpandableRow
            heading='Bank flags'
            expanded={cvs?.bankFlagsExpanded ?? false}
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
              expanded={context.currentViewState?.paletteExpanded ?? false}
              onExpanded={exp =>
                context.changeViewState(vs => (vs.paletteExpanded = exp))
              }
            >
              <NextPaletteViewer palette={context.fileInfo?.palette} />
            </ExpandableRow>
          )}
          {fi.layer2LoadingScreen?.length > 0 && (
            <ExpandableRow
              heading='Layer 2 Loading Screen'
              expanded={cvs?.layer2LoadingScreenExpanded ?? false}
              onExpanded={exp =>
                change(vs => (vs.layer2LoadingScreenExpanded = exp))
              }
            >
              <Layer2Screen
                documentSource={document.id}
                data={fi?.layer2LoadingScreen}
                palette={fi.palette.map(v => getAbrgForPaletteCode(v))}
              />
            </ExpandableRow>
          )}
          {fi.ulaLoadingScreen?.length > 0 && (
            <ExpandableRow
              heading='ULA Loading Screen'
              expanded={cvs?.ulaLoadingScreenExpanded ?? false}
              onExpanded={exp =>
                change(vs => (vs.ulaLoadingScreenExpanded = exp))
              }
            >
              <NextBankViewer contents={fi?.ulaLoadingScreen} />
            </ExpandableRow>
          )}
          {fi.loResLoadingScreen?.length > 0 && (
            <ExpandableRow
              heading='LoRes Loading Screen'
              expanded={cvs?.loResLoadingScreenExpanded ?? false}
              onExpanded={exp =>
                change(vs => (vs.loResLoadingScreenExpanded = exp))
              }
            >
              <NextBankViewer contents={fi?.loResLoadingScreen} />
            </ExpandableRow>
          )}
          {fi.timexHiResLoadingScreen?.length > 0 && (
            <ExpandableRow
              heading='Timex HiRes Loading Screen'
              expanded={cvs?.timexHiResLoadingScreenExpanded ?? false}
              onExpanded={exp =>
                change(vs => (vs.timexHiResLoadingScreenExpanded = exp))
              }
            >
              <NextBankViewer contents={fi?.timexHiResLoadingScreen} />
            </ExpandableRow>
          )}
          {fi.timexHiColLoadingScreen?.length > 0 && (
            <ExpandableRow
              heading='Timex HiCol Loading Screen'
              expanded={cvs?.timexHiColLoadingScreenExpanded ?? false}
              onExpanded={exp =>
                change(vs => (vs.timexHiColLoadingScreenExpanded = exp))
              }
            >
              <NextBankViewer contents={fi?.timexHiColLoadingScreen} />
            </ExpandableRow>
          )}
          {fi.bankData.map((entry, idx) => {
            return (
              <ExpandableRow
                key={idx}
                heading={`Bank $${toHexa2(entry[0])} (${entry[0].toString(
                  10
                )})`}
                expanded={cvs?.bankExpanded?.[idx] ?? false}
                onExpanded={exp =>
                  change(vs => {
                    vs.bankExpanded ??= {};
                    vs.bankExpanded![idx] = exp;
                  })
                }
              >
                <NextBankViewer contents={entry[1]} bank={entry[0]} />
              </ExpandableRow>
            );
          })}
        </>
      );
    }
  });
};

function loadNexFile (contents: Uint8Array): {
  fileInfo?: NexFileContents;
  error?: string;
} {
  const reader = new BinaryReader(contents);
  const header: NexHeader = {} as NexHeader;

  // --- Read the header
  // --- Check for the 'Next' token
  const startToken = reader.readUint32();
  if (startToken !== 0x7478654e) {
    // 'Next'
    return { error: "Missing 'Next' token in file header" };
  }

  // --- Read the version number
  if (reader.readByte() !== 0x56) {
    // 'V'
    return { error: "Missing 'V' in version number" };
  }
  header.versionMajor = reader.readByte() - 0x30;
  if (reader.readByte() !== 0x2e) {
    // '.'
    return { error: "Missing '.' in version number" };
  }
  header.versionMinor = reader.readByte() - 0x30;

  // --- RAM, bank, and screen flag information
  header.fullRamRequired = reader.readByte() !== 0;
  header.numOf16KBanks = reader.readByte();
  header.screenBlockFlags = reader.readByte();
  header.borderColor = reader.readByte();

  // --- Stack and program counter
  header.stackPointer = reader.readUint16();
  header.programCounter = reader.readUint16();

  // --- Extra bytes
  header.numOfExtraBytes = reader.readUint16();

  // --- Bank flags
  header.bankFlags = [];
  for (let i = 0; i < 112; i++) {
    header.bankFlags.push(reader.readByte() !== 0);
  }

  // --- Miscellanous header props
  header.layer2LoadingBar = reader.readByte() !== 0;
  header.loadingBarColorFor = reader.readByte();
  header.loadingDelayPerBank = reader.readByte();
  header.startDelay = reader.readByte();
  header.preserveNextRegisters = reader.readByte() !== 0;
  header.requiredCoreVersionMajor = reader.readByte();
  header.requiredCoreVersionMinor = reader.readByte();
  header.requiredCoreVersionSubMinor = reader.readByte();
  header.timexHiresModeColor = reader.readByte();
  header.entryBank = reader.readByte();
  header.fileHandleAddress = reader.readUint16();

  // --- Skip 370 unused bytes
  reader.readBytes(370);

  // --- Read the palette
  const palette: number[] = [];
  const sbFlags = header.screenBlockFlags;
  const hasPalette =
    !(sbFlags & ScreenBlockFlags.NoPalette) &&
    (sbFlags & ScreenBlockFlags.Layer2 || sbFlags & ScreenBlockFlags.LoRes);

  if (hasPalette) {
    for (let i = 0; i < 256; i++) {
      palette.push(reader.readUint16());
    }
  }

  // --- Read the loading screens
  let layer2LoadingScreen: Uint8Array | undefined;
  if (sbFlags & ScreenBlockFlags.Layer2) {
    layer2LoadingScreen = new Uint8Array(reader.readBytes(0xc000));
  }
  let ulaLoadingScreen: Uint8Array | undefined;
  if (sbFlags & ScreenBlockFlags.Ula) {
    ulaLoadingScreen = new Uint8Array(reader.readBytes(0x1b00));
  }
  let loResLoadingScreen: Uint8Array | undefined;
  if (sbFlags & ScreenBlockFlags.LoRes) {
    loResLoadingScreen = new Uint8Array(reader.readBytes(0x3000));
  }
  let timexHiresLoadingScreen: Uint8Array | undefined;
  if (sbFlags & ScreenBlockFlags.HiRes) {
    timexHiresLoadingScreen = new Uint8Array(reader.readBytes(0x3000));
  }
  let timexHiColLoadingScreen: Uint8Array | undefined;
  if (sbFlags & ScreenBlockFlags.HiColor) {
    timexHiColLoadingScreen = new Uint8Array(reader.readBytes(0x3000));
  }

  // --- Read banks
  const bankData: [number, Uint8Array][] = [];
  for (let i = 0; i < header.bankFlags.length; i++) {
    if (!header.bankFlags[i]) {
      continue;
    }
    const bankContents = new Uint8Array(reader.readBytes(0x4000));
    bankData.push([getBankIndex(i), bankContents]);
  }

  return {
    fileInfo: {
      header,
      palette,
      layer2LoadingScreen,
      ulaLoadingScreen,
      loResLoadingScreen,
      timexHiResLoadingScreen: timexHiresLoadingScreen,
      timexHiColLoadingScreen,
      bankData
    }
  };
}

// --- Get the bank index from the bank flag index
function getBankIndex (bank: number): number {
  switch (bank) {
    case 0x00:
      return 5;
    case 0x01:
      return 2;
    case 0x02:
      return 0;
    case 0x03:
      return 1;
    case 0x04:
      return 3;
    case 0x05:
      return 4;
    default:
      return bank;
  }
}

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
          label={`#${idx + startIndex}:`}
          labelWidth={36}
          valueWidth={20}
          value={f}
        />
      ))}
    </Row>
  );
};

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

// --- The entire contents of a .nex file
export type NexFileContents = {
  header: NexHeader;
  palette?: number[];
  layer2LoadingScreen?: Uint8Array;
  ulaLoadingScreen?: Uint8Array;
  loResLoadingScreen?: Uint8Array;
  timexHiResLoadingScreen?: Uint8Array;
  timexHiColLoadingScreen?: Uint8Array;
  bankData: [number, Uint8Array][];
};

// --- The header of a .nex file
export type NexHeader = {
  versionMajor: number;
  versionMinor: number;
  fullRamRequired: boolean;
  numOf16KBanks: number;
  screenBlockFlags: ScreenBlockFlags;
  borderColor: number;
  stackPointer: number;
  programCounter: number;
  numOfExtraBytes: number;
  bankFlags: boolean[];
  layer2LoadingBar: boolean;
  loadingBarColorFor: number;
  loadingDelayPerBank: number;
  startDelay: number;
  preserveNextRegisters: boolean;
  requiredCoreVersionMajor: number;
  requiredCoreVersionMinor: number;
  requiredCoreVersionSubMinor: number;
  timexHiresModeColor: number;
  entryBank: number;
  fileHandleAddress: number;
};

// --- The flags indicating which block is used in the .nex file
export enum ScreenBlockFlags {
  NoPalette = 0x80,
  HiColor = 0x10,
  HiRes = 0x08,
  LoRes = 0x04,
  Ula = 0x02,
  Layer2 = 0x01
}
