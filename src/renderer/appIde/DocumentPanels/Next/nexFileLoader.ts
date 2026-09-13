import { BinaryReader } from "@common/utils/BinaryReader";

export const NEX_BANK_FILE_ORDER = [
  5,
  2,
  0,
  1,
  3,
  4,
  ...Array.from({ length: 106 }, (_, idx) => idx + 6)
];

export function loadNexFileContents (contents: Uint8Array): {
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
  for (const bank of NEX_BANK_FILE_ORDER) {
    if (!header.bankFlags[bank]) {
      continue;
    }
    const bankContents = new Uint8Array(reader.readBytes(0x4000));
    bankData.push([bank, bankContents]);
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
