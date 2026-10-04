/*
 * The check every ZX Spectrum machine makes before it takes a snapshot's state: the snapshot's
 * mapping must name this machine, and a 16K model cannot take a 48K snapshot's RAM. The emulator
 * flow switches machines before this can fail; the check keeps a direct call honest.
 */

import type { SpectrumSnapshot } from "@common/spectrum/snapshot/spectrumSnapshot";
import { mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";

/**
 * Throws when the snapshot cannot be loaded into this machine
 * @param snapshot The parsed snapshot
 * @param machineId The machine's id
 * @param modelId The machine's model id
 */
export function assertSnapshotFitsMachine(
  snapshot: SpectrumSnapshot,
  machineId: string,
  modelId: string | undefined
): void {
  const mapping = mapSpectrumSnapshotToKlive(snapshot);
  if (mapping.errors.length > 0) {
    throw new Error(mapping.errors.join("; "));
  }
  if (mapping.machineId !== machineId) {
    throw new Error(`This snapshot needs a ${mapping.kliveName}`);
  }
  const ramBanks = [...snapshot.ram.keys()].filter((b) => b === 2 || b === 0);
  if (modelId === "pal-16k" && snapshot.machine !== "16k" && ramBanks.length > 0) {
    throw new Error("This snapshot needs 48K of RAM; the ZX Spectrum 16K has 16K");
  }
}
