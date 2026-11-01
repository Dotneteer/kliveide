import type { AnnRegion, AnnRegionKind } from "../annFormat";

/*
 * How a `.ann` region kind maps onto a ROM sidecar's region (`type`, `decode`, `rowBytes`, `radix`).
 * `text`, `fill` and `defc` are `bytes` regions with a `decode` on disk.
 */

/** A ROM sidecar's region, as stored. */
export type SidecarRegion = {
  start: number;
  end: number;
  type: string;
  decode?: string;
  rowBytes?: number;
  radix?: string;
};

/** The `.ann` region for a sidecar region; throws on a kind ROM sidecars do not use. */
export function annRegionOf(region: SidecarRegion, line = 0): AnnRegion {
  const kind = annKindOf(region);
  return {
    start: region.start,
    end: region.end,
    kind,
    ...(region.rowBytes !== undefined ? { rowBytes: region.rowBytes } : {}),
    ...(region.radix === "binary" ? { radix: "binary" as const } : {}),
    line
  };
}

function annKindOf(region: SidecarRegion): AnnRegionKind {
  const where = `region $${region.start.toString(16).toUpperCase()}`;
  if (region.type === "disassemble" && !region.decode) return "code";
  if (region.type === "words" && !region.decode) return "words";
  if (region.type === "bytes") {
    if (!region.decode) return "bytes";
    if (region.decode === "text" || region.decode === "fill" || region.decode === "defc") return region.decode;
  }
  throw new Error(`${where}: type "${region.type}"${region.decode ? ` decode "${region.decode}"` : ""} has no .ann kind`);
}

/** The sidecar region for a `.ann` region, with the keys in the order the shipped files use. */
export function sidecarRegionOf(region: Pick<AnnRegion, "start" | "end" | "kind" | "rowBytes" | "radix">): SidecarRegion {
  const base = { start: region.start, end: region.end };
  switch (region.kind) {
    case "code":
      return { ...base, type: "disassemble" };
    case "words":
      return { ...base, type: "words" };
    case "bytes":
      return {
        ...base,
        type: "bytes",
        ...(region.rowBytes !== undefined ? { rowBytes: region.rowBytes } : {}),
        ...(region.radix ? { radix: region.radix } : {})
      };
    default:
      return { ...base, type: "bytes", decode: region.kind };
  }
}
