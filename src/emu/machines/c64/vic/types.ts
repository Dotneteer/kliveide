export type VicChipConfiguration = {
  name: string;
  cyclesPerLine: number;
  numRasterLines: number;
  borderLeft: number;
  borderRight: number;
  borderTop: number;
  borderBottom: number;
  cycleTable: VicCycle[];
  colorLatency: boolean;
  lightpenOldIrqMode: boolean;
  newLuminances: boolean;
};

export type VicCycle = {
  cycle: number;
  xpos: number;
  visible: number;
  fetch: number;
  ba: number;
  flags: number;
};

export type VicLightPen = {
  state: number;
  triggered: number;
  x: number;
  y: number;
  x_extra_bits: number;
};

export type Idle3fff = {
  cycle: number;
  value: number;
};
