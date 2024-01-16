import styles from "./NexFileViewerPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { BinaryReader } from "@common/utils/BinaryReader";
import { useState } from "react";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";

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

  return initialized ? (
    <div className={styles.panel}>
      {!valid && (
        <div className={styles.invalid}>
          File content is not a valid: {fileError}
        </div>
      )}
      {valid && (
        <div className={styles.header}>
          <Label text='.NEX Viewer' />
        </div>
      )}
    </div>
  ) : null;

  function loadNexFile (): NexFileContents {
    const reader = new BinaryReader(contents);
    const header: NexHeader = {} as NexHeader;
    const bankData: Uint8Array[] = [];

    // --- Read the header
    // --- Check for the 'Next' token
    const startToken = reader.readUint32();
    if (startToken !== 0x7478654e) { // 'Next'
      setValid(false);
      setFileError("Missing 'Next' token in file header");
    }

    // --- Read the version number
    if (reader.readByte() !== 0x56) { // 'V'
      setValid(false);
      setFileError("Missing 'V' in version number");
    }
    header.versionMajor = reader.readByte() - 0x30;
    if (reader.readByte() !== 0x2e) { // '.'
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
