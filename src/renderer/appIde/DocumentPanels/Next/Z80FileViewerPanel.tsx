import { Row } from "@renderer/controls/generic/Row";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";
import { GenericFileViewerPanel } from "../helpers/GenericFileViewerPanel";
import { BinaryReader } from "@common/utils/BinaryReader";
import { ExpandableRow } from "@renderer/controls/generic/ExpandableRow";
import { LabeledText } from "@renderer/controls/generic/LabeledText";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { LabeledFlag } from "@renderer/controls/generic/LabeledFlag";
import { decompressZ80DataBlock } from "@renderer/appIde/utils/compression/z80-file-compression";
import { MemoryDumpViewer } from "@renderer/controls/memory/MemoryDumpViewer";

const REG_LABEL_WIDTH = 32;
const REG_PAIR_VALUE_WIDTH = 108;
const SOUND_REG_LABEL_WIDTH = 48;
const SOUND_REG_VALUE_WIDTH = 48;

const VIDEO_SYNC_MODES = ["Normal", "High", "Normal", "Low"];
const JOYSTICKS = [
  "Cursor/Protek/AGF",
  "Kempston",
  "Sinclair 2 Left",
  "Sinclair 2 Right"
];

const HW_MODE_V2: Record<number, string> = {
  0: "ZX Spectrum 48K",
  1: "ZX Spectrum 48K + If.1",
  2: "SamRam",
  3: "ZX Spectrum 128K",
  4: "ZX Spectrum 128K + If.1",
  5: "unknown",
  6: "unknown",
  7: "ZX Spectrum +3",
  8: "ZX Spectrum +3",
  9: "Pentagon (128K)",
  10: "Scorpion (256K)",
  11: "Didaktik-Kompakt",
  12: "ZX Spectrum +2",
  13: "ZX Spectrum +2A",
  14: "TC2048",
  15: "TC2068",
  128: "TS2068"
};

const HW_MODE_V2_MODIFIED: Record<number, string> = {
  0: "ZX Spectrum 16K",
  1: "ZX Spectrum 16K + If.1",
  3: "ZX Spectrum +2",
  4: "ZX Spectrum +2 + If.1",
  7: "ZX Spectrum +2A",
  8: "ZX Spectrum +2A",
  12: "ZX Spectrum +2A"
};

const HW_MODE_V3: Record<number, string> = {
  0: "ZX Spectrum 48K",
  1: "ZX Spectrum 48K + If.1",
  2: "SamRam",
  3: "ZX Spectrum 48K + M.G.T.",
  4: "ZX Spectrum 128K",
  5: "ZX Spectrum 128K + If.1",
  6: "ZX Spectrum 128K + M.G.T.",
  7: "ZX Spectrum +3",
  8: "ZX Spectrum +3",
  9: "Pentagon (128K)",
  10: "Scorpion (256K)",
  11: "Didaktik-Kompakt",
  12: "ZX Spectrum +2",
  13: "ZX Spectrum +2A",
  14: "TC2048",
  15: "TC2068",
  128: "TS2068"
};

const HW_MODE_V3_MODIFIED: Record<number, string> = {
  0: "ZX Spectrum 16K",
  1: "ZX Spectrum 16K + If.1",
  3: "ZX Spectrum 16K + M.G.T.",
  4: "ZX Spectrum +2",
  5: "ZX Spectrum +2 + If.1",
  6: "ZX Spectrum +2 + M.G.T.",
  7: "ZX Spectrum +2A",
  8: "ZX Spectrum +2A",
  12: "ZX Spectrum +2A"
};

type Z80FileViewState = {
  scrollPosition?: number;
  registersExpanded?: boolean;
  flags1Expanded?: boolean;
  soundRegsExpanded?: boolean;
  keyMappingsExpanded?: boolean;
  datablocksExpanded?: Record<number, boolean>;
};

const Z80FileViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps<Z80FileViewState>) => {
  return GenericFileViewerPanel<Z80FileContents, Z80FileViewState>({
    document,
    contents,
    viewState,
    fileLoader: loadZ80FileContents,
    validRenderer: context => {
      const fi = context.fileInfo;
      const cvs = context.currentViewState;
      const change = context.changeViewState;

      return (
        <>
          <Row>
            <LabeledText
              label='Z80 file version:'
              value={fi.version.toString(10)}
            />
            <LabeledText
              label='File length:'
              value={contents.length.toString(10)}
            />
          </Row>
          <ExpandableRow
            heading='Registers'
            expanded={cvs?.registersExpanded ?? true}
            onExpanded={exp => change(vs => (vs.registersExpanded = exp))}
          >
            <Row>
              <LabeledText
                label='AF:'
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regA * 256 + fi.regF)} (${(
                  fi.regA * 256 +
                  fi.regF
                ).toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
              <LabeledText
                label='BC:'
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regBC)} (${fi.regBC.toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
              <LabeledText
                label='DE:'
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regDE)} (${fi.regDE.toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
              <LabeledText
                label='HL:'
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regHL)} (${fi.regHL.toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
              <LabeledText
                label='PC:'
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regPC)} (${fi.regPC.toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
            </Row>
            <Row>
              <LabeledText
                label="AF':"
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regASec * 256 + fi.regFSec)} (${(
                  fi.regASec * 256 +
                  fi.regFSec
                ).toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
              <LabeledText
                label="BC':"
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regBCSec)} (${fi.regBCSec.toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
              <LabeledText
                label="DE':"
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regDESec)} (${fi.regDESec.toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
              <LabeledText
                label="HL':"
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regHLSec)} (${fi.regHLSec.toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
              <LabeledText
                label='SP:'
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regSP)} (${fi.regSP.toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
            </Row>
            <Row>
              <LabeledText
                label='IR:'
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regI * 256 + fi.regR)} (${(
                  fi.regI * 256 +
                  fi.regR
                ).toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
              <LabeledText
                label='IX:'
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regIX)} (${fi.regIX.toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
              <LabeledText
                label='IY:'
                labelWidth={REG_LABEL_WIDTH}
                value={`$${toHexa4(fi.regIY)} (${fi.regIY.toString(10)})`}
                valueWidth={REG_PAIR_VALUE_WIDTH}
              />
            </Row>
          </ExpandableRow>
          <ExpandableRow
            heading='Various Flags & Values'
            expanded={cvs?.flags1Expanded ?? true}
            onExpanded={exp => change(vs => (vs.flags1Expanded = exp))}
          >
            <Row>
              <LabeledFlag label='Bit 7 of R:' value={fi.bit7R} />
              <LabeledFlag
                label='SamRom Switched In:'
                value={fi.samRomSwitchedIn}
              />
              <LabeledFlag
                label='Datablock compressed:'
                value={fi.dataCompressed}
              />
              <LabeledText
                label='Border color:'
                value={fi.borderColor.toString(10)}
              />
            </Row>
            <Row>
              <LabeledFlag label='IFF1:' value={fi.iff1} />
              <LabeledFlag label='IFF2:' value={fi.iff2} />
              <LabeledFlag
                label='Issue 2 Emulation:'
                value={fi.issue2Emulation}
              />
              <LabeledFlag
                label='Double INT Frequency:'
                value={fi.doubleIntFreq}
              />
              <LabeledText label='IM:' value={fi.interruptMode.toString(10)} />
            </Row>
            <Row>
              <LabeledText
                label='Video Sync Mode:'
                value={VIDEO_SYNC_MODES[fi.videoSyncMode]}
              />
              <LabeledText
                label='Cursor/Joystick:'
                value={JOYSTICKS[fi.videoSyncMode]}
              />
            </Row>
            {fi.version > 1 && (
              <>
                <Row>
                  <LabeledText label='Hardware type:' value={fi.hwType} />
                  {fi.modeSamRam && (
                    <LabeledText
                      label='74LS259 State:'
                      value={fi.lastOutValue1.toString()}
                    />
                  )}
                  {fi.mode128K && (
                    <LabeledText
                      label='Last OUT to $7FFD:'
                      value={`$${toHexa2(
                        fi.lastOutValue1
                      )} (${fi.lastOutValue1.toString(10)})`}
                    />
                  )}
                  {fi.modeTimex && (
                    <LabeledText
                      label='Last OUT to $F4:'
                      value={`$${toHexa2(
                        fi.lastOutValue1
                      )} (${fi.lastOutValue1.toString(10)})`}
                    />
                  )}
                  {!fi.modeTimex && (
                    <LabeledFlag
                      label='Interface 1 ROM Paged:'
                      value={fi.lastOutValue2 === 0xff}
                    />
                  )}
                  {fi.modeTimex && (
                    <LabeledText
                      label='Last OUT to $FF:'
                      value={`$${toHexa2(
                        fi.lastOutValue2
                      )} (${fi.lastOutValue2.toString(10)})`}
                    />
                  )}
                </Row>
                <Row>
                  <LabeledFlag
                    label='R emulation on:'
                    value={fi.regREmulationIsOn}
                  />
                  <LabeledFlag
                    label='LDIR emulation on:'
                    value={fi.ldirEmulationIsOn}
                  />
                  <LabeledFlag
                    label='AY Sound in use:'
                    value={fi.aySoundInUse}
                  />
                  {fi.aySoundInUse && (
                    <LabeledFlag
                      label='Fuller Audio:'
                      value={fi.fullerAudioEmulationIsOn}
                    />
                  )}
                </Row>
                {fi.version === 3 && (
                  <>
                    <Row>
                      <LabeledText
                        label='Low TState Counter:'
                        value={`$${toHexa2(
                          fi.lowTStateCounter
                        )} (${fi.lowTStateCounter.toString(10)})`}
                      />
                      <LabeledText
                        label='High TState Counter:'
                        value={`$${toHexa2(
                          fi.highTStateCounter
                        )} (${fi.highTStateCounter.toString(10)})`}
                      />
                      <LabeledText
                        label='Spectator Flag Byte:'
                        value={`$${toHexa2(
                          fi.spectatorFlagByte
                        )} (${fi.spectatorFlagByte.toString(10)})`}
                      />
                    </Row>
                    <Row>
                      <LabeledFlag
                        label='MGT ROM Paged In:'
                        value={fi.mgtRomPagedIn}
                      />
                      <LabeledFlag
                        label='Multiface ROM Paged In:'
                        value={fi.multifaceRomPagedIn}
                      />
                      <LabeledFlag
                        label='Lower 8K Is RAM:'
                        value={fi.lower8KIsRam}
                      />
                      <LabeledFlag
                        label='Upper 8K Is RAM:'
                        value={fi.upper8KIsRam}
                      />
                    </Row>
                    <Row>
                      <LabeledText
                        label='Disciple inhibit button:'
                        value={fi.discipleInhibitButtonsStatus ? "In" : "Out"}
                      />
                      <LabeledText
                        label='Disciple inhibit flag:'
                        value={
                          fi.discipleInhibitButtonsStatus
                            ? "Pageable"
                            : "Not pageable"
                        }
                      />
                      {(true || fi.useLastOut1ffd) && (
                        <LabeledText
                          label='Last OUT $1FFD:'
                          value={`$${
                            fi.lastOut1ffdValue
                          } (${fi.lastOut1ffdValue.toString(10)})`}
                        />
                      )}
                    </Row>
                  </>
                )}
              </>
            )}
          </ExpandableRow>
          {fi.version > 1 && (
            <>
              <ExpandableRow
                heading='Sound Registers'
                expanded={cvs?.soundRegsExpanded ?? false}
                onExpanded={exp => change(vs => (vs.soundRegsExpanded = exp))}
              >
                <Row>
                  <LabeledText
                    label='Last OUT to $FFFD:'
                    value={`$${toHexa2(
                      fi.lastSoundRegister
                    )} (${fi.lastSoundRegister.toString(10)})`}
                  />
                </Row>
                <Row>
                  <LabeledText
                    label='Tone A (Low):'
                    value={`$${toHexa2(fi.soundRegisters[0])}`}
                  />
                  <LabeledText
                    label='Tone A (High):'
                    value={`$${toHexa2(fi.soundRegisters[1])}`}
                  />
                  <LabeledText
                    label='Tone B (Low):'
                    value={`$${toHexa2(fi.soundRegisters[2])}`}
                  />
                  <LabeledText
                    label='Tone B (High):'
                    value={`$${toHexa2(fi.soundRegisters[3])}`}
                  />
                </Row>
                <Row>
                  <LabeledText
                    label='Tone C (Low):'
                    value={`$${toHexa2(fi.soundRegisters[4])}`}
                  />
                  <LabeledText
                    label='Tone C (High):'
                    value={`$${toHexa2(fi.soundRegisters[5])}`}
                  />
                  <LabeledText
                    label='Noise:'
                    value={`$${toHexa2(fi.soundRegisters[6])}`}
                  />
                  <LabeledText
                    label='Mixer:'
                    value={`$${toHexa2(fi.soundRegisters[7])}`}
                  />
                </Row>
                <Row>
                  <LabeledText
                    label='Volume A:'
                    value={`$${toHexa2(fi.soundRegisters[8])}`}
                  />
                  <LabeledText
                    label='Volume B:'
                    value={`$${toHexa2(fi.soundRegisters[9])}`}
                  />
                  <LabeledText
                    label='Volume C:'
                    value={`$${toHexa2(fi.soundRegisters[10])}`}
                  />
                  <LabeledText
                    label='Env Freq (Low):'
                    value={`$${toHexa2(fi.soundRegisters[11])}`}
                  />
                </Row>
                <Row>
                  <LabeledText
                    label='Env Freq (High):'
                    value={`$${toHexa2(fi.soundRegisters[12])}`}
                  />
                  <LabeledText
                    label='Env Shape:'
                    value={`$${toHexa2(fi.soundRegisters[13])}`}
                  />
                  <LabeledText
                    label='I/O Port A:'
                    value={`$${toHexa2(fi.soundRegisters[14])}`}
                  />
                  <LabeledText
                    label='I/O Port B:'
                    value={`$${toHexa2(fi.soundRegisters[15])}`}
                  />
                </Row>
              </ExpandableRow>
              {fi.version === 3 && (
                <>
                  <ExpandableRow
                    heading='Key Mappings'
                    expanded={cvs?.keyMappingsExpanded ?? false}
                    onExpanded={exp =>
                      change(vs => (vs.keyMappingsExpanded = exp))
                    }
                  >
                    <Row>
                      <LabeledText
                        label='Key #1 Row:'
                        value={`$${toHexa2(fi.userJoystickMappings[1])}`}
                      />
                      <LabeledText
                        label='Key #1 Mask:'
                        value={`$${toHexa2(fi.userJoystickMappings[0])}`}
                      />
                      <LabeledText
                        label='Key #1 Value:'
                        value={`$${toHexa2(fi.keysMappings[0])}`}
                      />
                    </Row>
                    <Row>
                      <LabeledText
                        label='Key #2 Row:'
                        value={`$${toHexa2(fi.userJoystickMappings[3])}`}
                      />
                      <LabeledText
                        label='Key #2 Mask:'
                        value={`$${toHexa2(fi.userJoystickMappings[2])}`}
                      />
                      <LabeledText
                        label='Key #2 Value:'
                        value={`$${toHexa2(fi.keysMappings[2])}`}
                      />
                    </Row>
                    <Row>
                      <LabeledText
                        label='Key #3 Row:'
                        value={`$${toHexa2(fi.userJoystickMappings[5])}`}
                      />
                      <LabeledText
                        label='Key #3 Mask:'
                        value={`$${toHexa2(fi.userJoystickMappings[4])}`}
                      />
                      <LabeledText
                        label='Key #3 Value:'
                        value={`$${toHexa2(fi.keysMappings[4])}`}
                      />
                    </Row>
                    <Row>
                      <LabeledText
                        label='Key #4 Row:'
                        value={`$${toHexa2(fi.userJoystickMappings[7])}`}
                      />
                      <LabeledText
                        label='Key #4 Mask:'
                        value={`$${toHexa2(fi.userJoystickMappings[6])}`}
                      />
                      <LabeledText
                        label='Key #4 Value:'
                        value={`$${toHexa2(fi.keysMappings[6])}`}
                      />
                    </Row>
                    <Row>
                      <LabeledText
                        label='Key #5 Row:'
                        value={`$${toHexa2(fi.userJoystickMappings[9])}`}
                      />
                      <LabeledText
                        label='Key #5 Mask:'
                        value={`$${toHexa2(fi.userJoystickMappings[8])}`}
                      />
                      <LabeledText
                        label='Key #5 Value:'
                        value={`$${toHexa2(fi.keysMappings[8])}`}
                      />
                    </Row>
                  </ExpandableRow>
                </>
              )}
            </>
          )}

          {fi.dataBlocks.length > 0 &&
            fi.dataBlocks.map((db, index) => (
              <ExpandableRow
                key={index}
                heading={`Data Block Page #${db.pageNumber}: ${
                  db.dataLength
                } bytes ${db.compressed ? "(compressed)" : ""}`}
                expanded={cvs?.datablocksExpanded?.[index] ?? false}
                onExpanded={exp =>
                  change(vs => {
                    vs.datablocksExpanded ??= {};
                    vs.datablocksExpanded[index] = exp;
                  })
                }
              >
                <MemoryDumpViewer
                  documentSource={document.node.projectPath}
                  contents={db.data}
                  bank={db.pageNumber}
                  iconTitle='Display Data Block Dump'
                  idFactory={(documentSource: string) =>
                    `z80DataBlockDump${documentSource}`
                  }
                  titleFactory={(documentSource: string, bank: number) =>
                    `${documentSource} - Data Block #${bank}`
                  }
                />
              </ExpandableRow>
            ))}
        </>
      );
    }
  });
};

export const createZ80FileViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => (
  <Z80FileViewerPanel
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);

function loadZ80FileContents (contents: Uint8Array): {
  fileInfo?: Z80FileContents;
  error?: string;
} {
  const reader = new BinaryReader(contents);

  // --- Read the Version 1 header
  let version = 1;
  const regA = reader.readByte();
  const regF = reader.readByte();
  const regBC = reader.readUint16();
  const regHL = reader.readUint16();
  const regPC = reader.readUint16();
  const regSP = reader.readUint16();
  const regI = reader.readByte();
  const regR = reader.readByte();
  const flags = reader.readByte();
  const bit7R = !!(flags & 0x01);
  const borderColor = (flags >> 1) & 0x07;
  const samRomSwitchedIn = !!(flags & 0x10);
  const dataCompressed = !!(flags & 0x20);
  const regDE = reader.readUint16();
  const regBCSec = reader.readUint16();
  const regDESec = reader.readUint16();
  const regHLSec = reader.readUint16();
  const regASec = reader.readByte();
  const regFSec = reader.readByte();
  const regIY = reader.readUint16();
  const regIX = reader.readUint16();
  const iff1 = !!reader.readByte();
  const iff2 = !!reader.readByte();
  const flag2 = reader.readByte();
  const interruptMode = flag2 & 0x03;
  const issue2Emulation = !!(flag2 & 0x04);
  const doubleIntFreq = !!(flag2 & 0x08);
  const videoSyncMode = (flag2 >> 4) & 0x03;
  const joystickType = (flag2 >> 6) & 0x03;

  let spectrumMemoryData: Uint8Array | undefined;

  // --- Check the version
  let useLastOut1ffd = false;
  if (regPC) {
    // --- This is version 1
    spectrumMemoryData = new Uint8Array(
      reader.readBytes(reader.length - reader.position)
    );
  } else {
    // --- This is version 2 or 3
    const additionalLength = reader.readUint16();
    if (additionalLength === 23) {
      version = 2;
    } else if (additionalLength === 54 || additionalLength === 55) {
      version = 3;
      useLastOut1ffd = additionalLength === 55;
    } else {
      return {
        error: `Invalid .Z80 file. Additional header length should be 23, 54, or 55 (not ${additionalLength})`
      };
    }
  }

  // --- Add Version 1 information
  let fileInfo: Z80FileContents = {
    version,
    regA,
    regF,
    regBC,
    regHL,
    regPC,
    regSP,
    regI,
    regR,
    bit7R,
    borderColor,
    samRomSwitchedIn,
    dataCompressed,
    regDE,
    regBCSec,
    regDESec,
    regHLSec,
    regASec,
    regFSec,
    regIY,
    regIX,
    iff1,
    iff2,
    interruptMode,
    issue2Emulation,
    doubleIntFreq,
    videoSyncMode,
    joystickType,
    spectrumMemoryData,
    useLastOut1ffd
  };

  if (version === 1) {
    return { fileInfo };
  }

  // --- Read the Version 2 header
  fileInfo.regPC = reader.readUint16();
  const hwMode = reader.readByte();
  const lastOutValue1 = reader.readByte();
  const lastOutValue2 = reader.readByte();
  const flags3 = reader.readByte();
  const regREmulationIsOn = !!(flags3 & 0x01);
  const ldirEmulationIsOn = !!(flags3 & 0x02);
  const aySoundInUse = !!(flags3 & 0x04);
  const fullerAudioEmulationIsOn = !!(flags3 & 0x40);
  const modifyHwFlag = !!(flags3 & 0x80);
  const lastSoundRegister = reader.readByte();
  const soundRegisters = reader.readBytes(16);

  fileInfo = {
    ...fileInfo,
    hwMode,
    lastOutValue1,
    lastOutValue2,
    regREmulationIsOn,
    ldirEmulationIsOn,
    aySoundInUse,
    fullerAudioEmulationIsOn,
    modifyHwFlag,
    lastSoundRegister,
    soundRegisters,

    // --- Set these values for testability

    lowTStateCounter: 0,
    highTStateCounter: 0,
    spectatorFlagByte: 0,
    mgtRomPagedIn: false,
    multifaceRomPagedIn: false,
    lower8KIsRam: false,
    upper8KIsRam: false,
    userJoystickMappings: [
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09
    ],
    keysMappings: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09],
    mgtType: 0,
    discipleInhibitButtonsStatus: false,
    discipleInhibitFlag: false,
    lastOut1ffdValue: 0
  };

  if (version === 3) {
    const lowTStateCounter = reader.readUint16();
    const highTStateCounter = reader.readByte();
    const spectatorFlagByte = reader.readByte();
    const mgtRomPagedIn = reader.readByte() === 0xff;
    const multifaceRomPagedIn = reader.readByte() === 0xff;
    const lower8KIsRam = reader.readByte() !== 0xff;
    const upper8KIsRam = reader.readByte() !== 0xff;
    const userJoystickMappings = reader.readBytes(10);
    const keysMappings = reader.readBytes(10);
    const mgtType = reader.readByte();
    const discipleInhibitButtonsStatus = !!(reader.readByte() === 0xff);
    const discipleInhibitFlag = !!(reader.readByte() === 0xff);

    fileInfo = {
      ...fileInfo,
      lowTStateCounter,
      highTStateCounter,
      spectatorFlagByte,
      mgtRomPagedIn,
      multifaceRomPagedIn,
      lower8KIsRam,
      upper8KIsRam,
      userJoystickMappings,
      keysMappings,
      mgtType,
      discipleInhibitButtonsStatus,
      discipleInhibitFlag
    };

    if (useLastOut1ffd) {
      fileInfo.lastOut1ffdValue = reader.readByte();
    }
  }

  // --- Calculate the hardware type
  let hwTypes = version === 2 ? HW_MODE_V2 : HW_MODE_V3;
  if (modifyHwFlag) {
    hwTypes = {
      ...hwTypes,
      ...(version === 2 ? HW_MODE_V2_MODIFIED : HW_MODE_V3_MODIFIED)
    };
  }
  fileInfo.hwType = hwTypes[hwMode] ?? "unknown";
  fileInfo.modeSamRam = fileInfo.hwType.includes("SamRam");
  fileInfo.mode128K = fileInfo.hwType.includes("128K");
  fileInfo.modeTimex =
    fileInfo.hwType.includes("TC") || fileInfo.hwType.includes("TS");

  // --- Read the data blocks
  const dataBlocks: Z80DataBlock[] = [];
  while (!reader.eof) {
    let dataLength = reader.readUint16();
    let compressed = true;
    if (dataLength === 0xffff) {
      dataLength = 0x4000;
      compressed = false;
    }
    const pageNumber = reader.readByte();
    let data = new Uint8Array(reader.readBytes(dataLength));
    if (compressed) {
      data = decompressZ80DataBlock(data);
    }
    dataBlocks.push({ dataLength, pageNumber, compressed, data });
  }

  fileInfo.dataBlocks = dataBlocks;

  return {
    fileInfo
  };
}

type Z80FileContents = {
  version: number;

  // --- Standard header values
  regA: number;
  regF: number;
  regBC: number;
  regHL: number;
  regPC: number;
  regSP: number;
  regI: number;
  regR: number;
  bit7R: boolean;
  borderColor: number;
  samRomSwitchedIn: boolean;
  dataCompressed: boolean;
  regDE: number;
  regBCSec: number;
  regDESec: number;
  regHLSec: number;
  regASec: number;
  regFSec: number;
  regIY: number;
  regIX: number;
  iff1: boolean;
  iff2: boolean;
  interruptMode: number;
  issue2Emulation: boolean;
  doubleIntFreq: boolean;
  videoSyncMode: number;
  joystickType: number;

  // --- Version 2 specific header values
  regPc2?: number;
  hwMode?: number;
  lastOutValue1?: number;
  lastOutValue2?: number;
  regREmulationIsOn?: boolean;
  ldirEmulationIsOn?: boolean;
  aySoundInUse?: boolean;
  fullerAudioEmulationIsOn?: boolean;
  modifyHwFlag?: boolean;
  lastSoundRegister?: number;
  soundRegisters?: number[];

  // --- Version 2 & 3 specific header values
  lowTStateCounter?: number;
  highTStateCounter?: number;
  spectatorFlagByte?: number;
  mgtRomPagedIn?: boolean;
  multifaceRomPagedIn?: boolean;
  lower8KIsRam?: boolean;
  upper8KIsRam?: boolean;
  userJoystickMappings?: number[];
  keysMappings?: number[];
  mgtType?: number;
  discipleInhibitButtonsStatus?: boolean;
  discipleInhibitFlag?: boolean;

  // --- Only for version 3
  lastOut1ffdValue?: number;

  // --- ZX Spectrum 48 data
  spectrumMemoryData?: Uint8Array;

  // --- Data blocks
  dataBlocks?: Z80DataBlock[];

  // --- Calculated fields
  useLastOut1ffd?: boolean;
  hwType?: string;
  modeSamRam?: boolean;
  mode128K?: boolean;
  modeTimex?: boolean;
};

type Z80DataBlock = {
  dataLength: number;
  pageNumber: number;
  compressed: boolean;
  data: Uint8Array;
};
