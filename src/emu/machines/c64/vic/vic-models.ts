import {
  BaFetch,
  ChkBrdL0,
  ChkBrdR0,
  ChkBrdR1,
  ChkSprCrunch,
  ChkSprDisp,
  ChkSprDma,
  ChkSprExp,
  FetchC,
  FetchG,
  Idle,
  None,
  Refresh,
  UpdateMcBase,
  UpdateRc,
  UpdateVc,
  ChkBrdL1
} from "./constants";
import { VicChipConfiguration, VicCycle } from "./types";

/* PAL */
export const vicCycleTabPal: VicCycle[] = [
  { cycle: Phi1(1), xpos: 0x194, visible: None, fetch: SprPtr(3), ba: BaSpr2(3, 4), flags: None },
  { cycle: Phi2(1), xpos: 0x198, visible: None, fetch: SprDma0(3), ba: BaSpr2(3, 4), flags: None },
  {
    cycle: Phi1(2),
    xpos: 0x19c,
    visible: None,
    fetch: SprDma1(3),
    ba: BaSpr3(3, 4, 5),
    flags: None
  },
  {
    cycle: Phi2(2),
    xpos: 0x1a0,
    visible: None,
    fetch: SprDma2(3),
    ba: BaSpr3(3, 4, 5),
    flags: None
  },
  { cycle: Phi1(3), xpos: 0x1a4, visible: None, fetch: SprPtr(4), ba: BaSpr2(4, 5), flags: None },
  { cycle: Phi2(3), xpos: 0x1a8, visible: None, fetch: SprDma0(4), ba: BaSpr2(4, 5), flags: None },
  {
    cycle: Phi1(4),
    xpos: 0x1ac,
    visible: None,
    fetch: SprDma1(4),
    ba: BaSpr3(4, 5, 6),
    flags: None
  },
  {
    cycle: Phi2(4),
    xpos: 0x1b0,
    visible: None,
    fetch: SprDma2(4),
    ba: BaSpr3(4, 5, 6),
    flags: None
  },
  { cycle: Phi1(5), xpos: 0x1b4, visible: None, fetch: SprPtr(5), ba: BaSpr2(5, 6), flags: None },
  { cycle: Phi2(5), xpos: 0x1b8, visible: None, fetch: SprDma0(5), ba: BaSpr2(5, 6), flags: None },
  {
    cycle: Phi1(6),
    xpos: 0x1bc,
    visible: None,
    fetch: SprDma1(5),
    ba: BaSpr3(5, 6, 7),
    flags: None
  },
  {
    cycle: Phi2(6),
    xpos: 0x1c0,
    visible: None,
    fetch: SprDma2(5),
    ba: BaSpr3(5, 6, 7),
    flags: None
  },
  { cycle: Phi1(7), xpos: 0x1c4, visible: None, fetch: SprPtr(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi2(7), xpos: 0x1c8, visible: None, fetch: SprDma0(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi1(8), xpos: 0x1cc, visible: None, fetch: SprDma1(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi2(8), xpos: 0x1d0, visible: None, fetch: SprDma2(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi1(9), xpos: 0x1d4, visible: None, fetch: SprPtr(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi2(9), xpos: 0x1d8, visible: None, fetch: SprDma0(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi1(10), xpos: 0x1dc, visible: None, fetch: SprDma1(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi2(10), xpos: 0x1e0, visible: None, fetch: SprDma2(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi1(11), xpos: 0x1e4, visible: None, fetch: Refresh, ba: None, flags: None },
  { cycle: Phi2(11), xpos: 0x1e8, visible: None, fetch: None, ba: None, flags: None },
  { cycle: Phi1(12), xpos: 0x1ec, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(12), xpos: 0x1f0, visible: None, fetch: None, ba: BaFetch, flags: None },
  { cycle: Phi1(13), xpos: 0x1f4, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(13), xpos: 0x000, visible: None, fetch: None, ba: BaFetch, flags: None },
  { cycle: Phi1(14), xpos: 0x004, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(14), xpos: 0x008, visible: None, fetch: None, ba: BaFetch, flags: UpdateVc },
  { cycle: Phi1(15), xpos: 0x00c, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(15), xpos: 0x010, visible: None, fetch: FetchC, ba: BaFetch, flags: ChkSprCrunch },
  { cycle: Phi1(16), xpos: 0x014, visible: None, fetch: FetchG, ba: BaFetch, flags: None },
  {
    cycle: Phi2(16),
    xpos: 0x018,
    visible: Vis(0),
    fetch: FetchC,
    ba: BaFetch,
    flags: UpdateMcBase
  },
  { cycle: Phi1(17), xpos: 0x01c, visible: Vis(0), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(17), xpos: 0x020, visible: Vis(1), fetch: FetchC, ba: BaFetch, flags: ChkBrdL1 },
  { cycle: Phi1(18), xpos: 0x024, visible: Vis(1), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(18), xpos: 0x028, visible: Vis(2), fetch: FetchC, ba: BaFetch, flags: ChkBrdL0 },
  { cycle: Phi1(19), xpos: 0x02c, visible: Vis(2), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(19), xpos: 0x030, visible: Vis(3), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(20), xpos: 0x034, visible: Vis(3), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(20), xpos: 0x038, visible: Vis(4), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(21), xpos: 0x03c, visible: Vis(4), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(21), xpos: 0x040, visible: Vis(5), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(22), xpos: 0x044, visible: Vis(5), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(22), xpos: 0x048, visible: Vis(6), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(23), xpos: 0x04c, visible: Vis(6), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(23), xpos: 0x050, visible: Vis(7), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(24), xpos: 0x054, visible: Vis(7), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(24), xpos: 0x058, visible: Vis(8), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(25), xpos: 0x05c, visible: Vis(8), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(25), xpos: 0x060, visible: Vis(9), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(26), xpos: 0x064, visible: Vis(9), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(26), xpos: 0x068, visible: Vis(10), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(27), xpos: 0x06c, visible: Vis(10), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(27), xpos: 0x070, visible: Vis(11), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(28), xpos: 0x074, visible: Vis(11), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(28), xpos: 0x078, visible: Vis(12), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(29), xpos: 0x07c, visible: Vis(12), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(29), xpos: 0x080, visible: Vis(13), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(30), xpos: 0x084, visible: Vis(13), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(30), xpos: 0x088, visible: Vis(14), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(31), xpos: 0x08c, visible: Vis(14), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(31), xpos: 0x090, visible: Vis(15), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(32), xpos: 0x094, visible: Vis(15), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(32), xpos: 0x098, visible: Vis(16), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(33), xpos: 0x09c, visible: Vis(16), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(33), xpos: 0x0a0, visible: Vis(17), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(34), xpos: 0x0a4, visible: Vis(17), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(34), xpos: 0x0a8, visible: Vis(18), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(35), xpos: 0x0ac, visible: Vis(18), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(35), xpos: 0x0b0, visible: Vis(19), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(36), xpos: 0x0b4, visible: Vis(19), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(36), xpos: 0x0b8, visible: Vis(20), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(37), xpos: 0x0bc, visible: Vis(20), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(37), xpos: 0x0c0, visible: Vis(21), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(38), xpos: 0x0c4, visible: Vis(21), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(38), xpos: 0x0c8, visible: Vis(22), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(39), xpos: 0x0cc, visible: Vis(22), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(39), xpos: 0x0d0, visible: Vis(23), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(40), xpos: 0x0d4, visible: Vis(23), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(40), xpos: 0x0d8, visible: Vis(24), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(41), xpos: 0x0dc, visible: Vis(24), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(41), xpos: 0x0e0, visible: Vis(25), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(42), xpos: 0x0e4, visible: Vis(25), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(42), xpos: 0x0e8, visible: Vis(26), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(43), xpos: 0x0ec, visible: Vis(26), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(43), xpos: 0x0f0, visible: Vis(27), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(44), xpos: 0x0f4, visible: Vis(27), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(44), xpos: 0x0f8, visible: Vis(28), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(45), xpos: 0x0fc, visible: Vis(28), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(45), xpos: 0x100, visible: Vis(29), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(46), xpos: 0x104, visible: Vis(29), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(46), xpos: 0x108, visible: Vis(30), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(47), xpos: 0x10c, visible: Vis(30), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(47), xpos: 0x110, visible: Vis(31), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(48), xpos: 0x114, visible: Vis(31), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(48), xpos: 0x118, visible: Vis(32), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(49), xpos: 0x11c, visible: Vis(32), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(49), xpos: 0x120, visible: Vis(33), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(50), xpos: 0x124, visible: Vis(33), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(50), xpos: 0x128, visible: Vis(34), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(51), xpos: 0x12c, visible: Vis(34), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(51), xpos: 0x130, visible: Vis(35), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(52), xpos: 0x134, visible: Vis(35), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(52), xpos: 0x138, visible: Vis(36), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(53), xpos: 0x13c, visible: Vis(36), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(53), xpos: 0x140, visible: Vis(37), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(54), xpos: 0x144, visible: Vis(37), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(54), xpos: 0x148, visible: Vis(38), fetch: FetchC, ba: BaFetch, flags: None },
  {
    cycle: Phi1(55),
    xpos: 0x14c,
    visible: Vis(38),
    fetch: FetchG,
    ba: BaSpr1(0),
    flags: ChkSprDma
  },
  { cycle: Phi2(55), xpos: 0x150, visible: Vis(39), fetch: None, ba: BaSpr1(0), flags: None },
  { cycle: Phi1(56), xpos: 0x154, visible: Vis(39), fetch: Idle, ba: BaSpr1(0), flags: ChkSprDma },
  {
    cycle: Phi2(56),
    xpos: 0x158,
    visible: None,
    fetch: None,
    ba: BaSpr1(0),
    flags: ChkBrdR0 | ChkSprExp
  },
  { cycle: Phi1(57), xpos: 0x15c, visible: None, fetch: Idle, ba: BaSpr2(0, 1), flags: None },
  { cycle: Phi2(57), xpos: 0x160, visible: None, fetch: None, ba: BaSpr2(0, 1), flags: ChkBrdR1 },
  {
    cycle: Phi1(58),
    xpos: 0x164,
    visible: None,
    fetch: SprPtr(0),
    ba: BaSpr2(0, 1),
    flags: ChkSprDisp
  },
  {
    cycle: Phi2(58),
    xpos: 0x168,
    visible: None,
    fetch: SprDma0(0),
    ba: BaSpr2(0, 1),
    flags: UpdateRc
  },
  {
    cycle: Phi1(59),
    xpos: 0x16c,
    visible: None,
    fetch: SprDma1(0),
    ba: BaSpr3(0, 1, 2),
    flags: None
  },
  {
    cycle: Phi2(59),
    xpos: 0x170,
    visible: None,
    fetch: SprDma2(0),
    ba: BaSpr3(0, 1, 2),
    flags: None
  },
  { cycle: Phi1(60), xpos: 0x174, visible: None, fetch: SprPtr(1), ba: BaSpr2(1, 2), flags: None },
  { cycle: Phi2(60), xpos: 0x178, visible: None, fetch: SprDma0(1), ba: BaSpr2(1, 2), flags: None },
  {
    cycle: Phi1(61),
    xpos: 0x17c,
    visible: None,
    fetch: SprDma1(1),
    ba: BaSpr3(1, 2, 3),
    flags: None
  },
  {
    cycle: Phi2(61),
    xpos: 0x180,
    visible: None,
    fetch: SprDma2(1),
    ba: BaSpr3(1, 2, 3),
    flags: None
  },
  { cycle: Phi1(62), xpos: 0x184, visible: None, fetch: SprPtr(2), ba: BaSpr2(2, 3), flags: None },
  { cycle: Phi2(62), xpos: 0x188, visible: None, fetch: SprDma0(2), ba: BaSpr2(2, 3), flags: None },
  {
    cycle: Phi1(63),
    xpos: 0x18c,
    visible: None,
    fetch: SprDma1(2),
    ba: BaSpr3(2, 3, 4),
    flags: None
  },
  {
    cycle: Phi2(63),
    xpos: 0x190,
    visible: None,
    fetch: SprDma2(2),
    ba: BaSpr3(2, 3, 4),
    flags: None
  }
];

export const vicMos6569r1: VicChipConfiguration = {
  name: "MOS6569R1" /* name */,
  cyclesPerLine: 63,
  numRasterLines: 312,
  borderLeft: 48,
  borderRight: 48,
  borderTop: 48,
  borderBottom: 48,
  cycleTable: vicCycleTabPal /* cycle table */,
  colorLatency: true /* color latency */,
  lightpenOldIrqMode: true /* old light pen irq mode */,
  newLuminances: false /* new luminances */
};

export const vicMos6569r3: VicChipConfiguration = {
  name: "MOS6569R3" /* name */,
  cyclesPerLine: 63,
  numRasterLines: 312,
  borderLeft: 48,
  borderRight: 48,
  borderTop: 48,
  borderBottom: 48,
  cycleTable: vicCycleTabPal /* cycle table */,
  colorLatency: true /* color latency */,
  lightpenOldIrqMode: false /* old light pen irq mode */,
  newLuminances: true /* new luminances */
};

export const vicMmos8565: VicChipConfiguration = {
  name: "MOS8565" /* name */,
  cyclesPerLine: 63,
  numRasterLines: 312,
  borderLeft: 48,
  borderRight: 48,
  borderTop: 48,
  borderBottom: 48,
  cycleTable: vicCycleTabPal /* cycle table */,
  colorLatency: false /* color latency */,
  lightpenOldIrqMode: false /* old light pen irq mode */,
  newLuminances: true /* new luminances */
};

/* NTSC (and PAL-N) */
export const vicCycleTabNtsc: VicCycle[] = [
  {
    cycle: Phi1(1),
    xpos: 0x19c,
    visible: None,
    fetch: SprDma1(3),
    ba: BaSpr3(3, 4, 5),
    flags: None
  },
  {
    cycle: Phi2(1),
    xpos: 0x1a0,
    visible: None,
    fetch: SprDma2(3),
    ba: BaSpr3(3, 4, 5),
    flags: None
  },
  { cycle: Phi1(2), xpos: 0x1a4, visible: None, fetch: SprPtr(4), ba: BaSpr2(4, 5), flags: None },
  { cycle: Phi2(2), xpos: 0x1a8, visible: None, fetch: SprDma0(4), ba: BaSpr2(4, 5), flags: None },
  {
    cycle: Phi1(3),
    xpos: 0x1ac,
    visible: None,
    fetch: SprDma1(4),
    ba: BaSpr3(4, 5, 6),
    flags: None
  },
  {
    cycle: Phi2(3),
    xpos: 0x1b0,
    visible: None,
    fetch: SprDma2(4),
    ba: BaSpr3(4, 5, 6),
    flags: None
  },
  { cycle: Phi1(4), xpos: 0x1b4, visible: None, fetch: SprPtr(5), ba: BaSpr2(5, 6), flags: None },
  { cycle: Phi2(4), xpos: 0x1b8, visible: None, fetch: SprDma0(5), ba: BaSpr2(5, 6), flags: None },
  {
    cycle: Phi1(5),
    xpos: 0x1bc,
    visible: None,
    fetch: SprDma1(5),
    ba: BaSpr3(5, 6, 7),
    flags: None
  },
  {
    cycle: Phi2(5),
    xpos: 0x1c0,
    visible: None,
    fetch: SprDma2(5),
    ba: BaSpr3(5, 6, 7),
    flags: None
  },
  { cycle: Phi1(6), xpos: 0x1c4, visible: None, fetch: SprPtr(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi2(6), xpos: 0x1c8, visible: None, fetch: SprDma0(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi1(7), xpos: 0x1cc, visible: None, fetch: SprDma1(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi2(7), xpos: 0x1d0, visible: None, fetch: SprDma2(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi1(8), xpos: 0x1d4, visible: None, fetch: SprPtr(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi2(8), xpos: 0x1d8, visible: None, fetch: SprDma0(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi1(9), xpos: 0x1dc, visible: None, fetch: SprDma1(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi2(9), xpos: 0x1e0, visible: None, fetch: SprDma2(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi1(10), xpos: 0x1e4, visible: None, fetch: Idle, ba: None, flags: None },
  { cycle: Phi2(10), xpos: 0x1e8, visible: None, fetch: None, ba: None, flags: None },
  { cycle: Phi1(11), xpos: 0x1ec, visible: None, fetch: Refresh, ba: None, flags: None },
  { cycle: Phi2(11), xpos: 0x1f0, visible: None, fetch: None, ba: None, flags: None },
  { cycle: Phi1(12), xpos: 0x1f4, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(12), xpos: 0x1f8, visible: None, fetch: None, ba: BaFetch, flags: None },
  { cycle: Phi1(13), xpos: 0x1fc, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(13), xpos: 0x000, visible: None, fetch: None, ba: BaFetch, flags: None },
  { cycle: Phi1(14), xpos: 0x004, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(14), xpos: 0x008, visible: None, fetch: None, ba: BaFetch, flags: UpdateVc },
  { cycle: Phi1(15), xpos: 0x00c, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(15), xpos: 0x010, visible: None, fetch: FetchC, ba: BaFetch, flags: ChkSprCrunch },
  { cycle: Phi1(16), xpos: 0x014, visible: None, fetch: FetchG, ba: BaFetch, flags: None },
  {
    cycle: Phi2(16),
    xpos: 0x018,
    visible: Vis(0),
    fetch: FetchC,
    ba: BaFetch,
    flags: UpdateMcBase
  },
  { cycle: Phi1(17), xpos: 0x01c, visible: Vis(0), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(17), xpos: 0x020, visible: Vis(1), fetch: FetchC, ba: BaFetch, flags: ChkBrdL1 },
  { cycle: Phi1(18), xpos: 0x024, visible: Vis(1), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(18), xpos: 0x028, visible: Vis(2), fetch: FetchC, ba: BaFetch, flags: ChkBrdL0 },
  { cycle: Phi1(19), xpos: 0x02c, visible: Vis(2), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(19), xpos: 0x030, visible: Vis(3), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(20), xpos: 0x034, visible: Vis(3), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(20), xpos: 0x038, visible: Vis(4), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(21), xpos: 0x03c, visible: Vis(4), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(21), xpos: 0x040, visible: Vis(5), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(22), xpos: 0x044, visible: Vis(5), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(22), xpos: 0x048, visible: Vis(6), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(23), xpos: 0x04c, visible: Vis(6), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(23), xpos: 0x050, visible: Vis(7), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(24), xpos: 0x054, visible: Vis(7), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(24), xpos: 0x058, visible: Vis(8), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(25), xpos: 0x05c, visible: Vis(8), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(25), xpos: 0x060, visible: Vis(9), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(26), xpos: 0x064, visible: Vis(9), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(26), xpos: 0x068, visible: Vis(10), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(27), xpos: 0x06c, visible: Vis(10), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(27), xpos: 0x070, visible: Vis(11), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(28), xpos: 0x074, visible: Vis(11), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(28), xpos: 0x078, visible: Vis(12), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(29), xpos: 0x07c, visible: Vis(12), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(29), xpos: 0x080, visible: Vis(13), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(30), xpos: 0x084, visible: Vis(13), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(30), xpos: 0x088, visible: Vis(14), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(31), xpos: 0x08c, visible: Vis(14), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(31), xpos: 0x090, visible: Vis(15), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(32), xpos: 0x094, visible: Vis(15), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(32), xpos: 0x098, visible: Vis(16), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(33), xpos: 0x09c, visible: Vis(16), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(33), xpos: 0x0a0, visible: Vis(17), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(34), xpos: 0x0a4, visible: Vis(17), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(34), xpos: 0x0a8, visible: Vis(18), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(35), xpos: 0x0ac, visible: Vis(18), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(35), xpos: 0x0b0, visible: Vis(19), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(36), xpos: 0x0b4, visible: Vis(19), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(36), xpos: 0x0b8, visible: Vis(20), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(37), xpos: 0x0bc, visible: Vis(20), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(37), xpos: 0x0c0, visible: Vis(21), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(38), xpos: 0x0c4, visible: Vis(21), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(38), xpos: 0x0c8, visible: Vis(22), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(39), xpos: 0x0cc, visible: Vis(22), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(39), xpos: 0x0d0, visible: Vis(23), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(40), xpos: 0x0d4, visible: Vis(23), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(40), xpos: 0x0d8, visible: Vis(24), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(41), xpos: 0x0dc, visible: Vis(24), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(41), xpos: 0x0e0, visible: Vis(25), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(42), xpos: 0x0e4, visible: Vis(25), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(42), xpos: 0x0e8, visible: Vis(26), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(43), xpos: 0x0ec, visible: Vis(26), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(43), xpos: 0x0f0, visible: Vis(27), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(44), xpos: 0x0f4, visible: Vis(27), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(44), xpos: 0x0f8, visible: Vis(28), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(45), xpos: 0x0fc, visible: Vis(28), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(45), xpos: 0x100, visible: Vis(29), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(46), xpos: 0x104, visible: Vis(29), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(46), xpos: 0x108, visible: Vis(30), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(47), xpos: 0x10c, visible: Vis(30), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(47), xpos: 0x110, visible: Vis(31), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(48), xpos: 0x114, visible: Vis(31), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(48), xpos: 0x118, visible: Vis(32), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(49), xpos: 0x11c, visible: Vis(32), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(49), xpos: 0x120, visible: Vis(33), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(50), xpos: 0x124, visible: Vis(33), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(50), xpos: 0x128, visible: Vis(34), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(51), xpos: 0x12c, visible: Vis(34), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(51), xpos: 0x130, visible: Vis(35), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(52), xpos: 0x134, visible: Vis(35), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(52), xpos: 0x138, visible: Vis(36), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(53), xpos: 0x13c, visible: Vis(36), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(53), xpos: 0x140, visible: Vis(37), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(54), xpos: 0x144, visible: Vis(37), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(54), xpos: 0x148, visible: Vis(38), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(55), xpos: 0x14c, visible: Vis(38), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(55), xpos: 0x150, visible: Vis(39), fetch: None, ba: None, flags: None },
  { cycle: Phi1(56), xpos: 0x154, visible: Vis(39), fetch: Idle, ba: BaSpr1(0), flags: ChkSprDma },
  {
    cycle: Phi2(56),
    xpos: 0x158,
    visible: None,
    fetch: None,
    ba: BaSpr1(0),
    flags: ChkBrdR0 | ChkSprExp
  },
  { cycle: Phi1(57), xpos: 0x15c, visible: None, fetch: Idle, ba: BaSpr1(0), flags: ChkSprDma },
  { cycle: Phi2(57), xpos: 0x160, visible: None, fetch: None, ba: BaSpr1(0), flags: ChkBrdR1 },
  { cycle: Phi1(58), xpos: 0x164, visible: None, fetch: Idle, ba: BaSpr2(0, 1), flags: None },
  { cycle: Phi2(58), xpos: 0x168, visible: None, fetch: None, ba: BaSpr2(0, 1), flags: UpdateRc },
  {
    cycle: Phi1(59),
    xpos: 0x16c,
    visible: None,
    fetch: SprPtr(0),
    ba: BaSpr2(0, 1),
    flags: ChkSprDisp
  },
  { cycle: Phi2(59), xpos: 0x170, visible: None, fetch: SprDma0(0), ba: BaSpr2(0, 1), flags: None },
  {
    cycle: Phi1(60),
    xpos: 0x174,
    visible: None,
    fetch: SprDma1(0),
    ba: BaSpr3(0, 1, 2),
    flags: None
  },
  {
    cycle: Phi2(60),
    xpos: 0x178,
    visible: None,
    fetch: SprDma2(0),
    ba: BaSpr3(0, 1, 2),
    flags: None
  },
  { cycle: Phi1(61), xpos: 0x17c, visible: None, fetch: SprPtr(1), ba: BaSpr2(1, 2), flags: None },
  { cycle: Phi2(61), xpos: 0x180, visible: None, fetch: SprDma0(1), ba: BaSpr2(1, 2), flags: None },
  {
    cycle: Phi1(62),
    xpos: 0x184,
    visible: None,
    fetch: SprDma1(1),
    ba: BaSpr3(1, 2, 3),
    flags: None
  },
  {
    cycle: Phi2(62),
    xpos: 0x184,
    visible: None,
    fetch: SprDma2(1),
    ba: BaSpr3(1, 2, 3),
    flags: None
  },
  { cycle: Phi1(63), xpos: 0x184, visible: None, fetch: SprPtr(2), ba: BaSpr2(2, 3), flags: None },
  { cycle: Phi2(63), xpos: 0x188, visible: None, fetch: SprDma0(2), ba: BaSpr2(2, 3), flags: None },
  {
    cycle: Phi1(64),
    xpos: 0x18c,
    visible: None,
    fetch: SprDma1(2),
    ba: BaSpr3(2, 3, 4),
    flags: None
  },
  {
    cycle: Phi2(64),
    xpos: 0x190,
    visible: None,
    fetch: SprDma2(2),
    ba: BaSpr3(2, 3, 4),
    flags: None
  },
  { cycle: Phi1(65), xpos: 0x194, visible: None, fetch: SprPtr(3), ba: BaSpr2(3, 4), flags: None },
  { cycle: Phi2(65), xpos: 0x198, visible: None, fetch: SprDma0(3), ba: BaSpr2(3, 4), flags: None }
];

export const vicMos6567r8: VicChipConfiguration = {
  name: "MOS6567R8" /* name */,
  cyclesPerLine: 65,
  numRasterLines: 263,
  borderLeft: 48,
  borderRight: 48,
  borderTop: 48,
  borderBottom: 48,
  cycleTable: vicCycleTabNtsc /* cycle table */,
  colorLatency: true /* color latency */,
  lightpenOldIrqMode: false /* old light pen irq mode */,
  newLuminances: true /* new luminances */
};

export const vicMos8562: VicChipConfiguration = {
  name: "MOS8562" /* name */,
  cyclesPerLine: 65,
  numRasterLines: 263,
  borderLeft: 48,
  borderRight: 48,
  borderTop: 48,
  borderBottom: 48,
  cycleTable: vicCycleTabNtsc /* cycle table */,
  colorLatency: false /* color latency */,
  lightpenOldIrqMode: false /* old light pen irq mode */,
  newLuminances: true /* new luminances */
};

export const vicMos6572: VicChipConfiguration = {
  name: "MOS6572" /* name */,
  cyclesPerLine: 65,
  numRasterLines: 263,
  borderLeft: 48,
  borderRight: 48,
  borderTop: 48,
  borderBottom: 48,
  cycleTable: vicCycleTabNtsc /* cycle table */,
  colorLatency: true /* color latency */,
  lightpenOldIrqMode: false /* old light pen irq mode */,
  newLuminances: true /* new luminances */
};

/* Old NTSC */
export const vicCycleTabNtscOlld: VicCycle[] = [
  { cycle: Phi1(1), xpos: 0x19c, visible: None, fetch: SprPtr(3), ba: BaSpr2(3, 4), flags: None },
  { cycle: Phi2(1), xpos: 0x1a0, visible: None, fetch: SprDma0(3), ba: BaSpr2(3, 4), flags: None },
  {
    cycle: Phi1(2),
    xpos: 0x1a4,
    visible: None,
    fetch: SprDma1(3),
    ba: BaSpr3(3, 4, 5),
    flags: None
  },
  {
    cycle: Phi2(2),
    xpos: 0x1a8,
    visible: None,
    fetch: SprDma2(3),
    ba: BaSpr3(3, 4, 5),
    flags: None
  },
  { cycle: Phi1(3), xpos: 0x1ac, visible: None, fetch: SprPtr(4), ba: BaSpr2(4, 5), flags: None },
  { cycle: Phi2(3), xpos: 0x1b0, visible: None, fetch: SprDma0(4), ba: BaSpr2(4, 5), flags: None },
  {
    cycle: Phi1(4),
    xpos: 0x1b4,
    visible: None,
    fetch: SprDma1(4),
    ba: BaSpr3(4, 5, 6),
    flags: None
  },
  {
    cycle: Phi2(4),
    xpos: 0x1b8,
    visible: None,
    fetch: SprDma2(4),
    ba: BaSpr3(4, 5, 6),
    flags: None
  },
  { cycle: Phi1(5), xpos: 0x1bc, visible: None, fetch: SprPtr(5), ba: BaSpr2(5, 6), flags: None },
  { cycle: Phi2(5), xpos: 0x1c0, visible: None, fetch: SprDma0(5), ba: BaSpr2(5, 6), flags: None },
  {
    cycle: Phi1(6),
    xpos: 0x1c4,
    visible: None,
    fetch: SprDma1(5),
    ba: BaSpr3(5, 6, 7),
    flags: None
  },
  {
    cycle: Phi2(6),
    xpos: 0x1c8,
    visible: None,
    fetch: SprDma2(5),
    ba: BaSpr3(5, 6, 7),
    flags: None
  },
  { cycle: Phi1(7), xpos: 0x1cc, visible: None, fetch: SprPtr(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi2(7), xpos: 0x1d0, visible: None, fetch: SprDma0(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi1(8), xpos: 0x1d4, visible: None, fetch: SprDma1(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi2(8), xpos: 0x1d8, visible: None, fetch: SprDma2(6), ba: BaSpr2(6, 7), flags: None },
  { cycle: Phi1(9), xpos: 0x1dc, visible: None, fetch: SprPtr(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi2(9), xpos: 0x1e0, visible: None, fetch: SprDma0(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi1(10), xpos: 0x1e4, visible: None, fetch: SprDma1(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi2(10), xpos: 0x1e8, visible: None, fetch: SprDma2(7), ba: BaSpr1(7), flags: None },
  { cycle: Phi1(11), xpos: 0x1ec, visible: None, fetch: Refresh, ba: None, flags: None },
  { cycle: Phi2(11), xpos: 0x1f0, visible: None, fetch: None, ba: None, flags: None },
  { cycle: Phi1(12), xpos: 0x1f4, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(12), xpos: 0x1f8, visible: None, fetch: None, ba: BaFetch, flags: None },
  { cycle: Phi1(13), xpos: 0x1fc, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(13), xpos: 0x000, visible: None, fetch: None, ba: BaFetch, flags: None },
  { cycle: Phi1(14), xpos: 0x004, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(14), xpos: 0x008, visible: None, fetch: None, ba: BaFetch, flags: UpdateVc },
  { cycle: Phi1(15), xpos: 0x00c, visible: None, fetch: Refresh, ba: BaFetch, flags: None },
  { cycle: Phi2(15), xpos: 0x010, visible: None, fetch: FetchC, ba: BaFetch, flags: ChkSprCrunch },
  { cycle: Phi1(16), xpos: 0x014, visible: None, fetch: FetchG, ba: BaFetch, flags: None },
  {
    cycle: Phi2(16),
    xpos: 0x018,
    visible: Vis(0),
    fetch: FetchC,
    ba: BaFetch,
    flags: UpdateMcBase
  },
  { cycle: Phi1(17), xpos: 0x01c, visible: Vis(0), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(17), xpos: 0x020, visible: Vis(1), fetch: FetchC, ba: BaFetch, flags: ChkBrdL1 },
  { cycle: Phi1(18), xpos: 0x024, visible: Vis(1), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(18), xpos: 0x028, visible: Vis(2), fetch: FetchC, ba: BaFetch, flags: ChkBrdL0 },
  { cycle: Phi1(19), xpos: 0x02c, visible: Vis(2), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(19), xpos: 0x030, visible: Vis(3), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(20), xpos: 0x034, visible: Vis(3), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(20), xpos: 0x038, visible: Vis(4), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(21), xpos: 0x03c, visible: Vis(4), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(21), xpos: 0x040, visible: Vis(5), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(22), xpos: 0x044, visible: Vis(5), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(22), xpos: 0x048, visible: Vis(6), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(23), xpos: 0x04c, visible: Vis(6), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(23), xpos: 0x050, visible: Vis(7), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(24), xpos: 0x054, visible: Vis(7), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(24), xpos: 0x058, visible: Vis(8), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(25), xpos: 0x05c, visible: Vis(8), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(25), xpos: 0x060, visible: Vis(9), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(26), xpos: 0x064, visible: Vis(9), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(26), xpos: 0x068, visible: Vis(10), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(27), xpos: 0x06c, visible: Vis(10), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(27), xpos: 0x070, visible: Vis(11), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(28), xpos: 0x074, visible: Vis(11), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(28), xpos: 0x078, visible: Vis(12), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(29), xpos: 0x07c, visible: Vis(12), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(29), xpos: 0x080, visible: Vis(13), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(30), xpos: 0x084, visible: Vis(13), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(30), xpos: 0x088, visible: Vis(14), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(31), xpos: 0x08c, visible: Vis(14), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(31), xpos: 0x090, visible: Vis(15), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(32), xpos: 0x094, visible: Vis(15), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(32), xpos: 0x098, visible: Vis(16), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(33), xpos: 0x09c, visible: Vis(16), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(33), xpos: 0x0a0, visible: Vis(17), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(34), xpos: 0x0a4, visible: Vis(17), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(34), xpos: 0x0a8, visible: Vis(18), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(35), xpos: 0x0ac, visible: Vis(18), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(35), xpos: 0x0b0, visible: Vis(19), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(36), xpos: 0x0b4, visible: Vis(19), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(36), xpos: 0x0b8, visible: Vis(20), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(37), xpos: 0x0bc, visible: Vis(20), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(37), xpos: 0x0c0, visible: Vis(21), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(38), xpos: 0x0c4, visible: Vis(21), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(38), xpos: 0x0c8, visible: Vis(22), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(39), xpos: 0x0cc, visible: Vis(22), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(39), xpos: 0x0d0, visible: Vis(23), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(40), xpos: 0x0d4, visible: Vis(23), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(40), xpos: 0x0d8, visible: Vis(24), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(41), xpos: 0x0dc, visible: Vis(24), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(41), xpos: 0x0e0, visible: Vis(25), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(42), xpos: 0x0e4, visible: Vis(25), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(42), xpos: 0x0e8, visible: Vis(26), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(43), xpos: 0x0ec, visible: Vis(26), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(43), xpos: 0x0f0, visible: Vis(27), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(44), xpos: 0x0f4, visible: Vis(27), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(44), xpos: 0x0f8, visible: Vis(28), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(45), xpos: 0x0fc, visible: Vis(28), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(45), xpos: 0x100, visible: Vis(29), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(46), xpos: 0x104, visible: Vis(29), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(46), xpos: 0x108, visible: Vis(30), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(47), xpos: 0x10c, visible: Vis(30), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(47), xpos: 0x110, visible: Vis(31), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(48), xpos: 0x114, visible: Vis(31), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(48), xpos: 0x118, visible: Vis(32), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(49), xpos: 0x11c, visible: Vis(32), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(49), xpos: 0x120, visible: Vis(33), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(50), xpos: 0x124, visible: Vis(33), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(50), xpos: 0x128, visible: Vis(34), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(51), xpos: 0x12c, visible: Vis(34), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(51), xpos: 0x130, visible: Vis(35), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(52), xpos: 0x134, visible: Vis(35), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(52), xpos: 0x138, visible: Vis(36), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(53), xpos: 0x13c, visible: Vis(36), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(53), xpos: 0x140, visible: Vis(37), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(54), xpos: 0x144, visible: Vis(37), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(54), xpos: 0x148, visible: Vis(38), fetch: FetchC, ba: BaFetch, flags: None },
  { cycle: Phi1(55), xpos: 0x14c, visible: Vis(38), fetch: FetchG, ba: BaFetch, flags: None },
  { cycle: Phi2(55), xpos: 0x150, visible: Vis(39), fetch: None, ba: None, flags: None },
  { cycle: Phi1(56), xpos: 0x154, visible: Vis(39), fetch: Idle, ba: BaSpr1(0), flags: ChkSprDma },
  {
    cycle: Phi2(56),
    xpos: 0x158,
    visible: None,
    fetch: None,
    ba: BaSpr1(0),
    flags: ChkBrdR0 | ChkSprExp
  },
  { cycle: Phi1(57), xpos: 0x15c, visible: None, fetch: Idle, ba: BaSpr1(0), flags: ChkSprDma },
  { cycle: Phi2(57), xpos: 0x160, visible: None, fetch: None, ba: BaSpr1(0), flags: ChkBrdR1 },
  { cycle: Phi1(58), xpos: 0x164, visible: None, fetch: Idle, ba: BaSpr2(0, 1), flags: ChkSprDisp },
  { cycle: Phi2(58), xpos: 0x168, visible: None, fetch: None, ba: BaSpr2(0, 1), flags: UpdateRc },
  { cycle: Phi1(59), xpos: 0x16c, visible: None, fetch: SprPtr(0), ba: BaSpr2(0, 1), flags: None },
  { cycle: Phi2(59), xpos: 0x170, visible: None, fetch: SprDma0(0), ba: BaSpr2(0, 1), flags: None },
  {
    cycle: Phi1(60),
    xpos: 0x174,
    visible: None,
    fetch: SprDma1(0),
    ba: BaSpr3(0, 1, 2),
    flags: None
  },
  {
    cycle: Phi2(60),
    xpos: 0x178,
    visible: None,
    fetch: SprDma2(0),
    ba: BaSpr3(0, 1, 2),
    flags: None
  },
  { cycle: Phi1(61), xpos: 0x17c, visible: None, fetch: SprPtr(1), ba: BaSpr2(1, 2), flags: None },
  { cycle: Phi2(61), xpos: 0x180, visible: None, fetch: SprDma0(1), ba: BaSpr2(1, 2), flags: None },
  {
    cycle: Phi1(62),
    xpos: 0x184,
    visible: None,
    fetch: SprDma1(1),
    ba: BaSpr3(1, 2, 3),
    flags: None
  },
  {
    cycle: Phi2(62),
    xpos: 0x188,
    visible: None,
    fetch: SprDma2(1),
    ba: BaSpr3(1, 2, 3),
    flags: None
  },
  { cycle: Phi1(63), xpos: 0x18c, visible: None, fetch: SprPtr(2), ba: BaSpr2(2, 3), flags: None },
  { cycle: Phi2(63), xpos: 0x190, visible: None, fetch: SprDma0(2), ba: BaSpr2(2, 3), flags: None },
  {
    cycle: Phi1(64),
    xpos: 0x194,
    visible: None,
    fetch: SprDma1(2),
    ba: BaSpr3(2, 3, 4),
    flags: None
  },
  {
    cycle: Phi2(64),
    xpos: 0x198,
    visible: None,
    fetch: SprDma2(2),
    ba: BaSpr3(2, 3, 4),
    flags: None
  }
];

export const vicMos6567r56a: VicChipConfiguration = {
  name: "MOS6567R56A",
  cyclesPerLine: 64,
  numRasterLines: 262,
  borderLeft: 48,
  borderRight: 48,
  borderTop: 48,
  borderBottom: 48,
  cycleTable: vicCycleTabNtscOlld,
  colorLatency: true,
  lightpenOldIrqMode: true,
  newLuminances: false
};

// ================================================================================================
// Helpers

/* Cycle */
function Phi1(x: number) {
  return x;
}
function Phi2(x: number) {
  return x | 0x80;
}

/* Visible */
function Vis(x: number) {
  return x | 0x80;
}

/* Fetch */
export function SprPtr(x: number) {
  return 0x100 | x;
}

export function SprDma0(x: number) {
  return 0x200 | x;
}

export function SprDma1(x: number) {
  return 0x300 | x;
}
export function SprDma2(x: number) {
  return 0x400 | x;
}

/* BA Sprite */
export function BaSpr1(x: number) {
  return 0x000 | (1 << x);
}
export function BaSpr2(x: number, y: number) {
  return 0x000 | (1 << x) | (1 << y);
}
export function BaSpr3(x: number, y: number, z: number) {
  return 0x000 | (1 << x) | (1 << y) | (1 << z);
}
