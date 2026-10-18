import { applyProjectSettingAction } from "@common/state/actions";
import { mainStore } from "@main/main-store";
import { saveKliveProject } from "@main/projects";

import { Z88DK_CLIB, Z88DK_COMPILER, Z88DK_OPTIMISE } from "./z88dk-config";

/*
 * The Settings › Integrations rows that edit a project's z88dk build options (decision C6). They are
 * project settings: the rows show only while a Klive project is open, and write `klive.project`.
 */

export const Z88DK_COMPILER_CHOICES = ["sccz80", "sdcc"] as const;
export const Z88DK_CLIB_CHOICES = ["classic", "new"] as const;
export const Z88DK_OPTIMISE_CHOICES = ["none", "O1", "O2", "O3", "SO3"] as const;

const CHOICES: Record<string, readonly string[]> = {
  [Z88DK_COMPILER]: Z88DK_COMPILER_CHOICES,
  [Z88DK_CLIB]: Z88DK_CLIB_CHOICES,
  [Z88DK_OPTIMISE]: Z88DK_OPTIMISE_CHOICES
};

/** Writes one build option into the open project; the error text when the value or the project is wrong. */
export async function setZ88dkProjectOption(key: string, value: unknown): Promise<string | undefined> {
  const choices = CHOICES[key];
  if (!choices) return `Unknown z88dk option: ${key}`;
  if (typeof value !== "string" || !choices.includes(value)) return `Invalid value for ${key}: ${value}`;
  if (!mainStore.getState().project?.isKliveProject) return "Open a Klive project to change its z88dk options.";
  mainStore.dispatch(applyProjectSettingAction(key, value));
  await saveKliveProject();
  return undefined;
}
