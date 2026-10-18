import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";

import type { Z88dkLineDebug, Z88dkMapSymbol } from "./z88dk-map";

/*
 * Map + CDB records → `SourceLevelDebugInfo` (`.plans/Z88DK_INTEGRATION_PLAN.md` §8, phase Z5).
 */

export type Z88dkDebugAdapterInput = {
  symbols: Z88dkMapSymbol[];
  lineDebug: Z88dkLineDebug;
  cwd: string;
  isProjectFile: (absolutePath: string) => boolean;
  partitionOf: (bank: number, address: number) => number;
  image: Uint8Array;
  origin: number;
};

export type Z88dkDebugAdapterOutput = { sourceLevelDebug: SourceLevelDebugInfo; problems: string[] };

export function adaptZ88dkDebugInfo(_input: Z88dkDebugAdapterInput): Z88dkDebugAdapterOutput | undefined {
  return undefined;
}
