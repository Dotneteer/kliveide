import { NEXT_REG_DESCRIPTORS, type NextRegDescriptor } from "../nextRegDescriptors";
import type { NextProfile } from "../nextProfiles";
import { NEXT_REG_DELTA_30204 } from "./30204";

/*
 * The NextReg description sets (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D5): core 3.02.01's is the base
 * (`nextRegDescriptors.ts`); a later core's set is the base with its delta applied, a file here that
 * lists only the registers it adds, removes or re-means. A profile names its set (`nextRegSet`), and
 * the machine exposes it to the IDE (`IZxNextIdeMachine.getNextRegDescriptors`).
 *
 * Assembler-side NextReg names use the union of every set: source code does not know which model it
 * will run on.
 */

/** A core version's changes to the base set */
export type NextRegSetDelta = {
  /** Registers new in this core, or whose description changed (replace the base's by `id`) */
  upsert?: readonly NextRegDescriptor[];
  /** Registers this core no longer has */
  remove?: readonly number[];
};

const DELTAS: Readonly<Record<string, NextRegSetDelta>> = {
  "30201": {},
  "30204": NEXT_REG_DELTA_30204
};

/* The base's order is kept; a new register goes before the first one with a higher id */
function applyDelta(base: readonly NextRegDescriptor[], delta: NextRegSetDelta): readonly NextRegDescriptor[] {
  const removed = new Set(delta.remove ?? []);
  const upserts = new Map((delta.upsert ?? []).map((d) => [d.id, d]));
  const result = base.filter((d) => !removed.has(d.id)).map((d) => upserts.get(d.id) ?? d);
  for (const d of delta.upsert ?? []) {
    if (base.some((b) => b.id === d.id)) continue;
    const at = result.findIndex((r) => r.id > d.id);
    result.splice(at < 0 ? result.length : at, 0, d);
  }
  return result;
}

const cache = new Map<string, readonly NextRegDescriptor[]>();

/** A NextReg set by its key ("30201") */
export function nextRegSet(key: string): readonly NextRegDescriptor[] {
  let set = cache.get(key);
  if (!set) {
    const delta = DELTAS[key];
    if (!delta) throw new Error(`Unknown NextReg set '${key}'.`);
    set = applyDelta(NEXT_REG_DESCRIPTORS, delta);
    cache.set(key, set);
  }
  return set;
}

/** The NextReg set a profile's core has */
export function nextRegSetOf(profile: NextProfile): readonly NextRegDescriptor[] {
  return nextRegSet(profile.nextRegSet);
}

/** Every register any supported core has: what the assembler's NextReg names are drawn from */
export function nextRegUnion(): readonly NextRegDescriptor[] {
  const byId = new Map<number, NextRegDescriptor>();
  for (const key of Object.keys(DELTAS)) for (const d of nextRegSet(key)) if (!byId.has(d.id)) byId.set(d.id, d);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** The set keys Klive knows */
export const NEXT_REG_SET_KEYS = Object.keys(DELTAS);
