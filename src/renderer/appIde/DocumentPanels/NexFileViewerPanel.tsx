import styles from "./NexFileViewerPanel.module.scss";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { BinaryReader } from "@common/utils/BinaryReader";
import { useState } from "react";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import {
  ExpandableRow,
  Label,
  LabeledFlag,
  LabeledText,
  Panel,
  Row
} from "@renderer/controls/GeneralControls";
import { toHexa2, toHexa4 } from "../services/ide-commands";

const NexFileViewerPanel = ({ document, contents }: DocumentProps) => {
  const [fileInfo, setFileInfo] = useState<NexFileContents>();
  const [fileError, setFileError] = useState<string>();
  const [initialized, setInitialized] = useState<boolean>(false);
  const [valid, setValid] = useState<boolean>(true);

  // --- Initialize the panel
  useInitializeAsync(async () => {
    try {
      const fileInfo = loadNexFile();
      setFileInfo(fileInfo);
    } catch (err) {
      setFileError(err.message);
      setValid(false);
    } finally {
      setInitialized(true);
    }
  });

  const h = fileInfo?.header;
  return initialized ? (
    <Panel>
      {!valid && (
        <div className={styles.invalid}>
          File content is not a valid: {fileError}
        </div>
      )}
      {valid && (
        <>
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
          <ExpandableRow heading='Bank flags' expanded={false}>
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
        </>
      )}
    </Panel>
  ) : null;

  function loadNexFile (): NexFileContents {
    const reader = new BinaryReader(contents);
    const header: NexHeader = {} as NexHeader;
    const bankData: Uint8Array[] = [];

    // --- Read the header
    // --- Check for the 'Next' token
    const startToken = reader.readUint32();
    if (startToken !== 0x7478654e) {
      // 'Next'
      setValid(false);
      setFileError("Missing 'Next' token in file header");
    }

    // --- Read the version number
    if (reader.readByte() !== 0x56) {
      // 'V'
      setValid(false);
      setFileError("Missing 'V' in version number");
    }
    header.versionMajor = reader.readByte() - 0x30;
    if (reader.readByte() !== 0x2e) {
      // '.'
      setValid(false);
      setFileError("Missing '.' in version number");
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

    return {
      header,
      bankData
    };
  }
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
  contents
}: DocumentProps) => (
  <NexFileViewerPanel
    document={document}
    contents={contents}
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
  timexHiresLoadingScreen?: Uint8Array;
  timexHiColLoadingScreen?: Uint8Array;
  layer2ExtendedLoadingScreen?: Uint8Array;
  copperCode?: Uint8Array;
  bankData: Uint8Array[];
  optionalData?: Uint8Array;
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
