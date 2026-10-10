import { useSyncExternalStore } from "react";

import type { RomLayer, RomLayersOf } from "./romLayer";
import type { RomPartitionInfo } from "./romAnnotationLoader";

/*
 * The ROM layers of the machine running now, by ROM partition
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §5.3).
 *
 * Filled by the ROM annotation loader whenever the machine's ROM sources change (a machine start,
 * a ROM property change) or a layer is edited; read by the shared resolver. A module singleton, like
 * the active annotation set, because one IDE window has one machine.
 */

type Listener = () => void;

let layers = new Map<number, readonly RomLayer[]>();
let partitions: RomPartitionInfo[] = [];
let layersOf: RomLayersOf | undefined;
const listeners = new Set<Listener>();

/** Replace every partition's layers. An empty map means no ROM annotations. */
export function setRomLayers(next: Map<number, readonly RomLayer[]>): void {
  layers = next;
  // --- A new function identity per change: it is what the resolver's memo keys on
  layersOf = next.size > 0 ? (partition) => layers.get(partition) ?? [] : undefined;
  listeners.forEach((listener) => listener());
}

/** Replace everything known about the ROM partitions: their sources, user paths and layers. */
export function setRomPartitions(next: RomPartitionInfo[]): void {
  partitions = next;
  setRomLayers(
    new Map(next.filter((info) => info.layers.length > 0).map((info) => [info.partition, info.layers]))
  );
}

/** What is known about each ROM partition. */
export function getRomPartitions(): readonly RomPartitionInfo[] {
  return partitions;
}

/** What is known about one ROM partition. */
export function getRomPartition(partition: number): RomPartitionInfo | undefined {
  return partitions.find((info) => info.partition === partition);
}

/** The layers of one partition, or none. */
export function getRomLayers(partition: number): readonly RomLayer[] {
  return layers.get(partition) ?? [];
}

/** Every partition with layers. */
export function getRomLayerPartitions(): number[] {
  return [...layers.keys()];
}

/** The lookup the resolver takes, or `undefined` when no ROM has annotations. */
export function getRomLayersOf(): RomLayersOf | undefined {
  return layersOf;
}

export function subscribeRomLayers(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The lookup, re-rendering when the layers change. */
export function useRomLayersOf(): RomLayersOf | undefined {
  return useSyncExternalStore(subscribeRomLayers, getRomLayersOf, getRomLayersOf);
}

// --- A working copy appeared or went (`rom-ann-new`, a hand copy, a delete): the host reloads
const reloadListeners = new Set<Listener>();

/** Ask the ROM annotation host to read every page's sidecar again. */
export function requestRomAnnotationsReload(): void {
  reloadListeners.forEach((listener) => listener());
}

export function subscribeRomAnnotationsReload(listener: Listener): () => void {
  reloadListeners.add(listener);
  return () => {
    reloadListeners.delete(listener);
  };
}

/** For tests, which must not leak state between cases. */
export function resetRomLayersForTests(): void {
  layers = new Map();
  partitions = [];
  layersOf = undefined;
  listeners.clear();
  reloadListeners.clear();
}
