import {
  dmaByteClocks,
  dmaBytesMoved,
  dmaBytesToMove,
  dmaPacing,
  dmaPendingFollowers,
  dmaStatusByte,
  DmaWrSeq,
  type DmaPacing,
  type DmaPendingFollowers,
  type NextDmaState
} from "@common/zxnext/dma/dmaState";

/**
 * The DMA panel's model (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §3.1, §3.3): the derived state, the
 * progress and pacing figures, the step-aside sources and the diagnostics. Pure and text-free: it holds
 * ids and arguments, the panel formats them (keys at definition, text at display).
 */

/** The header state, first match wins (§3.3) */
export type DmaHeaderState = "deaf" | "locked" | "holding" | "steppedAside" | "waiting" | "starting" | "idle";

export type DmaDiagnosticId =
  | "deaf"
  | "lock"
  | "noLoad"
  | "afterEnd"
  | "partial"
  | "prescalerContinuous"
  | "portOff"
  | "stepAsideIm"
  | "ddmaOn"
  | "prescalerNone"
  | "z80"
  | "zeroLength"
  | "framePause";

export type DmaDiagnostic = {
  id: DmaDiagnosticId;
  severity: "info" | "warning";
  /** The message's arguments (addresses, counts, names) */
  args: Record<string, string | number>;
};

/** The zxnDDMA `$DF` flags by bit, as the guide names them (hardware terms, not translated) */
export const DDMA_FLAG_NAMES = ["physical", "2D", "transparent", "fill", "Layer 2 X,Y", "hidden screen"] as const;

export type DmaModel = {
  header: DmaHeaderState;
  /** The DMA is in a transfer or asking for the bus */
  active: boolean;
  /** Idle with the end of block reached */
  finished: boolean;
  /** The mode the DMA behaves in: byte mode and burst without a prescaler run as continuous */
  behavesAs: "continuous" | "burst";
  bytesToMove: number;
  bytesMoved: number;
  /** 0-1 */
  progress: number;
  /** The status byte a read would give */
  status: number;
  /** CPU clocks a byte takes without wait states */
  byteClocks: number;
  pacing?: DmaPacing;
  pending?: DmaPendingFollowers;
  /** The sources enabled in `$CC`-`$CE` (hardware names), the NMI included */
  stepAside: string[];
  hwIm2: boolean;
  /** The `$DF` flags that are on, by name */
  ddmaFlags: string[];
  /** Physical (22-bit) addresses: zxnDDMA physical mode */
  physical: boolean;
  diagnostics: DmaDiagnostic[];
};

const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;

/** The interrupt sources `$CC`-`$CE` let the DMA step aside for (`zxnextInterruptsDmaRequestActive`) */
export function stepAsideSources(r: NextDmaState["nextRegs"]): string[] {
  const names: string[] = [];
  if (r.rCC & 0x02) names.push("Line");
  if (r.rCE & 0x03) names.push("UART 0 Rx");
  if (r.rCE & 0x30) names.push("UART 1 Rx");
  for (let i = 0; i < 8; i++) if (r.rCD & (1 << i)) names.push(`CTC ${i}`);
  if (r.rCC & 0x01) names.push("ULA");
  if (r.rCE & 0x04) names.push("UART 0 Tx");
  if (r.rCE & 0x40) names.push("UART 1 Tx");
  if (r.rCC & 0x80) names.push("NMI");
  return names;
}

/** A 22-bit physical address as the panel shows it: `$090000` */
export const hex6 = (v: number) => `$${(v & 0x3fffff).toString(16).toUpperCase().padStart(6, "0")}`;

/** The 8K RAM page a physical address falls in (RAM starts at `$40000`); undefined below it */
export function physicalPage(address: number): { page: number; offset: number } | undefined {
  if (address < 0x40000) return undefined;
  return { page: (address - 0x40000) >> 13, offset: (address - 0x40000) & 0x1fff };
}

/** Builds the panel's model */
export function buildDmaModel(s: NextDmaState): DmaModel {
  const active = s.seq !== "idle" || s.busRequested;
  const deaf = s.wrSeq === DmaWrSeq.R4Byte2Deaf;
  const behavesAs = s.operatingMode === "burst" && s.prescaler > 0 ? "burst" : "continuous";
  const locked = active && s.autoRestart && behavesAs === "continuous";

  let header: DmaHeaderState;
  if (deaf) header = "deaf";
  else if (locked) header = "locked";
  else if (s.busAcknowledged) header = "holding";
  else if (active && (s.wasDelayed || s.delayActive)) header = "steppedAside";
  else if (s.seq === "burstWait") header = "waiting";
  else if (s.seq === "start" || s.seq === "transfer") header = "starting";
  else header = "idle";

  const bytesToMove = dmaBytesToMove(s);
  const bytesMoved = Math.min(dmaBytesMoved(s), bytesToMove);
  const byteClocks = dmaByteClocks(s);
  const pacing = dmaPacing(s.prescaler, s.cpuSpeed, byteClocks);
  const pending = deaf ? undefined : dmaPendingFollowers(s);
  const stepAside = stepAsideSources(s.nextRegs);
  const hwIm2 = (s.nextRegs.rC0 & 0x01) !== 0;
  const ddmaFlags = s.ddma ? DDMA_FLAG_NAMES.filter((_, i) => (s.ddma!.flags & (1 << i)) !== 0) : [];
  const physical = !!s.ddma && (s.ddma.flags & 0x01) !== 0;

  const diagnostics: DmaDiagnostic[] = [];
  const warn = (id: DmaDiagnosticId, args: DmaDiagnostic["args"] = {}) => diagnostics.push({ id, severity: "warning", args });
  const info = (id: DmaDiagnosticId, args: DmaDiagnostic["args"] = {}) => diagnostics.push({ id, severity: "info", args });

  if (deaf) warn("deaf", { base: hex2(s.regTemp) });
  if (locked) {
    const sources = stepAside.length > 0 ? stepAside.join(", ") : "";
    warn("lock", { count: stepAside.length, sources });
  }
  if (s.enableNote & 0x01) warn("noLoad", { portA: hex4(s.portA.working), portB: hex4(s.portB.working) });
  if (s.enableNote & 0x02) warn("afterEnd");
  if (pending) warn("partial", { group: pending.group, count: pending.roles.length });
  if (active && s.prescaler > 0 && behavesAs === "continuous" && s.operatingMode !== "burst" && pacing?.effective) {
    const cpuClocksPerFrame = s.tactsInFrame / (8 >> s.cpuSpeed);
    const remaining = Math.max(0, bytesToMove - bytesMoved);
    const frames = cpuClocksPerFrame > 0 ? (remaining * pacing.periodClocks) / cpuClocksPerFrame : 0;
    warn("prescalerContinuous", { frames: Math.round(frames * 10) / 10 });
  }
  if (s.dialect === "zxn" && (s.nextRegs.r82 & 0x20) === 0) warn("portOff", { port: "$6B", reg: "$82", bit: 5 });
  if (s.dialect === "z80" && (s.nextRegs.r85 & 0x02) === 0) warn("portOff", { port: "$0B", reg: "$85", bit: 1 });
  if (!hwIm2 && stepAside.some((n) => n !== "NMI")) info("stepAsideIm");
  if (s.ddma && !active && s.ddma.flags !== 0) info("ddmaOn", { flags: ddmaFlags.join(", ") });
  if (pacing && !pacing.effective) info("prescalerNone", { prescaler: s.prescaler });
  if (s.dialect === "z80") info("z80", { length: s.blockLength, bytes: bytesToMove });
  if (active && s.blockLength === 0 && !(s.ddma && s.ddma.flags & 0x02)) info("zeroLength");
  if (s.busAcknowledged) info("framePause");

  return {
    header,
    active,
    finished: !active && !s.endOfBlockN,
    behavesAs,
    bytesToMove,
    bytesMoved,
    progress: bytesToMove > 0 ? bytesMoved / bytesToMove : 0,
    status: dmaStatusByte(s),
    byteClocks,
    pacing,
    pending,
    stepAside,
    hwIm2,
    ddmaFlags,
    physical,
    diagnostics
  };
}

/** A port's start and working addresses as 16-bit or, in physical mode, 22-bit numbers */
export function portAddresses(s: NextDmaState, port: "A" | "B"): { start: number; working: number } {
  const p = port === "A" ? s.portA : s.portB;
  if (!s.ddma || (s.ddma.flags & 0x01) === 0) return { start: p.start, working: p.working };
  const ext = port === "A" ? s.ddma.extA : s.ddma.extB;
  // --- the working address's high byte is the source's or the destination's, by direction
  const isSource = (port === "A") === s.aToB;
  const hi = isSource ? s.ddma.srcHi : s.ddma.destHi;
  return { start: ((ext & 0x3f) << 16) | p.start, working: ((hi & 0x3f) << 16) | p.working };
}
