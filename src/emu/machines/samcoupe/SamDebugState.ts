/*
 * The ASIC's and the SAA 1099's state for the IDE's panels and the tests (`dev/plans/SAM_COUPE_PLAN.md`
 * §11), read from the core's exports.
 */

type Exports = Record<string, (...args: number[]) => number>;

/** The ASIC: the paging, the video registers, the CLUT, the interrupts and the beam */
export type SamAsicDebugState = {
  lmpr: number;
  hmpr: number;
  vmpr: number;
  lepr: number;
  hepr: number;
  border: number;
  lineRegister: number;
  /** STATUS bits 0-4, active low */
  status: number;
  /** The 16 CLUT entries (7-bit colours) and their RGBA */
  clut: number[];
  clutRgb: number[];
  /** The mode, 1-4 */
  mode: number;
  /** The screen page (modes 3/4: the even page) */
  screenPage: number;
  screenOff: boolean;
  flashCounter: number;
  attr: number;
  hc: number;
  vc: number;
  /** The contention region's mode: 0 mode 1, 1 modes 2-4, 2 screen off */
  contentionMode: number;
  ramPages: number;
  extPages: number;
  frames: number;
  frameTact: number;
};

export function readSamAsicDebugState(w: Exports): SamAsicDebugState {
  const vmpr = w.samGetVmpr();
  const clut = Array.from({ length: 16 }, (_, i) => w.samGetClut(i));
  const beam = w.samGetBeam();
  const mode = ((vmpr >> 5) & 3) + 1;
  return {
    lmpr: w.samGetLmpr(),
    hmpr: w.samGetHmpr(),
    vmpr,
    lepr: w.samGetLepr(),
    hepr: w.samGetHepr(),
    border: w.samGetBorder(),
    lineRegister: w.samGetLineRegister(),
    status: w.samGetStatus(),
    clut,
    clutRgb: clut.map((c) => w.samGetPaletteRgb(c) >>> 0),
    mode,
    screenPage: mode >= 3 ? vmpr & 0x1e : vmpr & 0x1f,
    screenOff: w.samGetScreenOff() !== 0,
    flashCounter: w.samGetFlashCounter(),
    attr: w.samGetAttrLatch(),
    hc: beam & 0xffff,
    vc: beam >>> 16,
    contentionMode: w.samGetContentionMode(),
    ramPages: w.samGetRamPages(),
    extPages: w.samGetExtPages(),
    frames: w.samGetFrames(),
    frameTact: w.samGetFrameTacts()
  };
}

/** One SAA channel, decoded */
export type SamSaaChannel = {
  amplitudeLeft: number;
  amplitudeRight: number;
  offset: number;
  octave: number;
  /** Its frequency in Hz: 15 625 * 2^octave / (511 - offset) */
  frequency: number;
  toneEnabled: boolean;
  noiseEnabled: boolean;
};

export type SamSaaEnvelope = {
  control: number;
  enabled: boolean;
  shape: number;
  threeBit: boolean;
  externalClock: boolean;
  mirrored: boolean;
  position: number;
  level: number;
};

export type SamSaaDebugState = {
  registers: number[];
  address: number;
  channels: SamSaaChannel[];
  /** The noise generators' clock sources (0-2: 31.25/15.6/7.8 kHz, 3: tone 0 / tone 3) */
  noiseSources: number[];
  envelopes: SamSaaEnvelope[];
  soundEnabled: boolean;
  sync: boolean;
};

export function samSaaFrequency(offset: number, octave: number): number {
  return (15625 * 2 ** octave) / (511 - offset);
}

export function readSamSaaDebugState(w: Exports): SamSaaDebugState {
  const registers = Array.from({ length: 32 }, (_, i) => w.samSaaGetRegister(i));
  const channels: SamSaaChannel[] = [];
  for (let ch = 0; ch < 6; ch++) {
    const offset = w.samSaaGetOffset(ch);
    const octave = w.samSaaGetOctave(ch);
    channels.push({
      amplitudeLeft: registers[ch] & 0x0f,
      amplitudeRight: registers[ch] >> 4,
      offset,
      octave,
      frequency: samSaaFrequency(offset, octave),
      toneEnabled: ((registers[0x14] >> ch) & 1) !== 0,
      noiseEnabled: ((registers[0x15] >> ch) & 1) !== 0
    });
  }
  const envelopes = [0, 1].map((g) => {
    const v = w.samSaaGetEnvelope(g) >>> 0;
    const control = v & 0xff;
    return {
      control,
      enabled: (control & 0x80) !== 0,
      shape: (control >> 1) & 7,
      threeBit: (control & 0x10) !== 0,
      externalClock: (control & 0x20) !== 0,
      mirrored: (control & 0x01) !== 0,
      position: (v >> 8) & 0xff,
      level: (v >>> 24) & 0x0f
    };
  });
  return {
    registers,
    address: w.samSaaGetAddress(),
    channels,
    noiseSources: [registers[0x16] & 3, (registers[0x16] >> 4) & 3],
    envelopes,
    soundEnabled: (registers[0x1c] & 1) !== 0,
    sync: (registers[0x1c] & 2) !== 0
  };
}
